import { validateKdf, type Argon2Profile } from "./policy";

export function deriveArgon2(
  password: Uint8Array<ArrayBuffer>,
  salt: Uint8Array<ArrayBuffer>,
  profile: Argon2Profile,
  signal?: AbortSignal,
): Promise<CryptoKey> {
  validateKdf(profile);
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./key-worker.ts", import.meta.url), {
      type: "module",
      name: "shadowfence-kdf",
    });
    const stop = () => {
      worker.terminate();
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      stop();
      reject(new Error("Key derivation cancelled. Unlock to continue."));
    };
    const timer = setTimeout(() => {
      stop();
      reject(
        new Error("Key derivation timed out. Close unused tabs and try again."),
      );
    }, 60_000);
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (e) => {
      stop();
      const key = e.data?.key;
      if (
        key instanceof CryptoKey &&
        !key.extractable &&
        key.type === "secret" &&
        key.algorithm.name === "AES-GCM" &&
        (key.algorithm as AesKeyAlgorithm).length === 256 &&
        key.usages.length === 2 &&
        key.usages.includes("encrypt") &&
        key.usages.includes("decrypt")
      )
        resolve(key);
      else reject(new Error("Key derivation failed. Please try again."));
    };
    worker.onerror = worker.onmessageerror = () => {
      stop();
      reject(new Error("Key derivation failed. Please try again."));
    };
    try {
      worker.postMessage({ password, salt, profile }, [password.buffer]);
    } catch (error) {
      stop();
      reject(error);
    }
  });
}
