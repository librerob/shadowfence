import { argon2id } from "@noble/hashes/argon2.js";
import { validateKdf, type Argon2Profile } from "./policy";

// Called in a disposable worker in production, directly by known-answer tests.
export async function argonKey(
  password: Uint8Array,
  salt: Uint8Array,
  profile: Argon2Profile,
): Promise<CryptoKey> {
  validateKdf(profile);
  if (password.length < 1 || password.length > 4096 || salt.length !== 16)
    throw new Error("Invalid key derivation input.");
  let bytes: Uint8Array<ArrayBuffer> | undefined;
  try {
    bytes = argon2id(password, salt, {
      m: profile.memoryKiB,
      t: profile.iterations,
      p: profile.parallelism,
      version: profile.version,
      dkLen: 32,
      maxmem: profile.memoryKiB * 1024,
    });
    return await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
      "encrypt",
      "decrypt",
    ]);
  } finally {
    password.fill(0);
    bytes?.fill(0);
  }
}
