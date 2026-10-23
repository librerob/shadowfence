import {
  deriveKey,
  newSalt,
  open,
  seal,
  validateEnvelope,
  type Envelope,
} from "./crypto";
import { emptyVault, type VaultData } from "./model";
import { currentKdf } from "../kdf/policy";

// Preparation does not mutate storage. The caller commits with the old revision
// only after authentication, schema validation, and successful re-encryption.
export async function unlockRecord(
  passphrase: string,
  input: Envelope | null,
  signal?: AbortSignal,
) {
  const existing = input ? validateEnvelope(input) : null;
  if (existing) {
    const key = await deriveKey(
      passphrase,
      existing.salt,
      existing.version === 2 ? existing.kdf : undefined,
      signal,
    );
    const data = await open(existing, key);
    signal?.throwIfAborted();
    if (existing.version === 2)
      return { key, envelope: existing, data, changed: false };
    // An old record must authenticate before it can trigger another KDF or write.
    return rewrap(passphrase, data, signal);
  }
  return rewrap(passphrase, emptyVault(), signal);
}

async function rewrap(
  passphrase: string,
  data: VaultData,
  signal?: AbortSignal,
) {
  const salt = newSalt();
  const key = await deriveKey(passphrase, salt, currentKdf, signal);
  signal?.throwIfAborted();
  const envelope = await seal(data, key, salt, currentKdf);
  return { key, envelope, data, changed: true };
}
