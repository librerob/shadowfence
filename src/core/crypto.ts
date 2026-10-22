import { validateData, type VaultData } from "./model";

export interface Envelope {
  format: "shadowfence";
  version: 1;
  iterations: 600000;
  salt: string;
  iv: string;
  ciphertext: string;
  revision: string;
}
const encoder = new TextEncoder();
const aad = encoder.encode("ShadowFence vault v1");
export const toBase64 = (bytes: Uint8Array) => {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
};
const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
export function validateEnvelope(input: unknown): Envelope {
  const x = input as Partial<Envelope> | null;
  if (
    !x ||
    x.format !== "shadowfence" ||
    x.version !== 1 ||
    x.iterations !== 600000 ||
    typeof x.salt !== "string" ||
    typeof x.iv !== "string" ||
    typeof x.ciphertext !== "string" ||
    typeof x.revision !== "string" ||
    !/^[\da-f-]{36}$/.test(x.revision) ||
    x.ciphertext.length > 12_000_000
  )
    throw new Error("This is not a supported ShadowFence encrypted backup.");
  try {
    if (
      fromBase64(x.salt).length !== 16 ||
      fromBase64(x.iv).length !== 12 ||
      fromBase64(x.ciphertext).length < 16
    )
      throw new Error();
  } catch {
    throw new Error("The encrypted record is damaged.");
  }
  return x as Envelope;
}
export async function deriveKey(
  passphrase: string,
  salt: string,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: fromBase64(salt),
      iterations: 600000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(
  data: VaultData,
  key: CryptoKey,
  salt: string,
): Promise<Envelope> {
  validateData(data);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = encoder.encode(JSON.stringify(data));
  try {
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 },
      key,
      bytes,
    );
    return {
      format: "shadowfence",
      version: 1,
      iterations: 600000,
      salt,
      iv: toBase64(iv),
      ciphertext: toBase64(new Uint8Array(encrypted)),
      revision: crypto.randomUUID(),
    };
  } finally {
    bytes.fill(0);
  }
}
export async function open(
  envelope: Envelope,
  key: CryptoKey,
): Promise<VaultData> {
  validateEnvelope(envelope);
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: fromBase64(envelope.iv),
          additionalData: aad,
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
