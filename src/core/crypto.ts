import { validateData, type VaultData } from "./model";
import { deriveArgon2 } from "../kdf/client";
import { validateKdf, type Argon2Profile } from "../kdf/policy";

interface BaseEnvelope {
  format: "shadowfence";
  salt: string;
  iv: string;
  ciphertext: string;
  revision: string;
}
export interface LegacyEnvelope extends BaseEnvelope {
  version: 1;
  iterations: 600000;
}
export interface CurrentEnvelope extends BaseEnvelope {
  version: 2;
  kdf: Argon2Profile;
}
export type Envelope = LegacyEnvelope | CurrentEnvelope;
const encoder = new TextEncoder();
export const toBase64 = (bytes: Uint8Array) => {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
};
const fromBase64 = (value: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const base64 = /^[A-Za-z0-9+/]*={0,2}$/;

export function validateEnvelope(input: unknown): Envelope {
  const x = input as Record<string, unknown> | null;
  if (
    !x ||
    x.format !== "shadowfence" ||
    (x.version !== 1 && x.version !== 2) ||
    typeof x.salt !== "string" ||
    x.salt.length !== 24 ||
    typeof x.iv !== "string" ||
    x.iv.length !== 16 ||
    typeof x.ciphertext !== "string" ||
    x.ciphertext.length < 24 ||
    x.ciphertext.length > 12_000_000 ||
    typeof x.revision !== "string" ||
    !/^[\da-f-]{36}$/.test(x.revision)
  )
    throw new Error("This is not a supported ShadowFence encrypted backup.");
  const version = x.version;
  const profile = version === 2 ? validateKdf(x.kdf) : undefined;
  if (version === 1 && x.iterations !== 600000)
    throw new Error("This backup uses unsupported key derivation settings.");
  try {
    if (
      !base64.test(x.salt) ||
      !base64.test(x.iv) ||
      !base64.test(x.ciphertext) ||
      x.ciphertext.length % 4 !== 0 ||
      fromBase64(x.salt).length !== 16 ||
      fromBase64(x.iv).length !== 12 ||
      fromBase64(x.ciphertext).length < 16
    )
      throw new Error();
  } catch {
    throw new Error("The encrypted record is damaged.");
  }
  const common: BaseEnvelope = {
    format: "shadowfence",
    salt: x.salt,
    iv: x.iv,
    ciphertext: x.ciphertext,
    revision: x.revision,
  };
  return version === 1
    ? { ...common, version: 1, iterations: 600000 }
    : { ...common, version: 2, kdf: profile! };
}

// Fixed field order, independent of the JSON property order in an imported file.
function additionalData(envelope: Envelope) {
  return envelope.version === 1
    ? encoder.encode("ShadowFence vault v1")
    : encoder.encode(
        JSON.stringify([
          envelope.format,
          envelope.version,
          envelope.kdf.name,
          envelope.kdf.version,
          envelope.kdf.memoryKiB,
          envelope.kdf.iterations,
          envelope.kdf.parallelism,
          envelope.salt,
          envelope.iv,
          envelope.revision,
        ]),
      );
}

// An absent profile is exclusively the version-1 PBKDF2 compatibility path.
export async function deriveKey(
  passphrase: string,
  salt: string,
  profile?: Argon2Profile,
  signal?: AbortSignal,
): Promise<CryptoKey> {
  signal?.throwIfAborted();
  if (!passphrase.length || passphrase.length > 1024 || salt.length !== 24)
    throw new Error("Invalid key derivation input.");
  const password = encoder.encode(passphrase),
    saltBytes = fromBase64(salt);
  try {
    if (saltBytes.length !== 16)
      throw new Error("Invalid key derivation input.");
    if (profile)
      return await deriveArgon2(password, saltBytes, profile, signal);
    const material = await crypto.subtle.importKey(
      "raw",
      password,
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: saltBytes, iterations: 600000, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    signal?.throwIfAborted();
    return key;
  } finally {
    // Transferred buffers are detached in the page; the worker clears its copy.
    if (password.byteLength) password.fill(0);
  }
}

export async function seal(
  data: VaultData,
  key: CryptoKey,
  salt: string,
  profile?: Argon2Profile,
): Promise<Envelope> {
  validateData(data);
  if (profile) validateKdf(profile);
  const common: BaseEnvelope = {
    format: "shadowfence",
    salt,
    iv: toBase64(crypto.getRandomValues(new Uint8Array(12))),
    ciphertext: "",
    revision: crypto.randomUUID(),
  };
  const envelope: Envelope = profile
    ? { ...common, version: 2, kdf: { ...profile } }
    : { ...common, version: 1, iterations: 600000 };
  const bytes = encoder.encode(JSON.stringify(data));
  try {
    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: fromBase64(envelope.iv),
        additionalData: additionalData(envelope),
        tagLength: 128,
      },
      key,
      bytes,
    );
    return validateEnvelope({
      ...envelope,
      ciphertext: toBase64(new Uint8Array(encrypted)),
    });
  } finally {
    bytes.fill(0);
  }
}

export async function open(
  input: Envelope,
  key: CryptoKey,
): Promise<VaultData> {
  const envelope = validateEnvelope(input);
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: fromBase64(envelope.iv),
          additionalData: additionalData(envelope),
          tagLength: 128,
        },
        key,
        fromBase64(envelope.ciphertext),
      ),
    );
  } catch {
    throw new Error(
      "Could not unlock. Check your passphrase; the record may also be damaged.",
    );
  }
  try {
    return validateData(JSON.parse(new TextDecoder().decode(bytes)));
  } finally {
    bytes.fill(0);
  }
}
export function newSalt() {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)));
}
export function checkPassphrase(passphrase: string) {
  if (passphrase.length < 12 || passphrase.length > 1024)
    throw new Error(
      "Use a passphrase between 12 and 1,024 characters. Several random words work well.",
    );
}
