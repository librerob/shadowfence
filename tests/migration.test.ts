import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import legacyJson from "./fixtures/vault-v1.json";
import { argonKey } from "../src/kdf/argon";
import { argon2id } from "@noble/hashes/argon2.js";
import { currentKdf } from "../src/kdf/policy";
import { deriveArgon2 } from "../src/kdf/client";
import {
  newSalt,
  open,
  seal,
  validateEnvelope,
  type CurrentEnvelope,
} from "../src/core/crypto";
import { unlockRecord } from "../src/core/unlock";
import { readEnvelope, writeEnvelope } from "../src/core/storage";
import { emptyVault } from "../src/core/model";

// Replace only browser worker transport; run the real 64 MiB / 3-pass KDF.
vi.mock("../src/kdf/client", async () => {
  const { argonKey } = await import("../src/kdf/argon");
  return {
    deriveArgon2: vi.fn(async (password, salt, profile, signal) => {
      signal?.throwIfAborted();
      const key = await argonKey(password, salt, profile);
      signal?.throwIfAborted();
      return key;
    }),
  };
});
const secret = "legacy test passphrase only";
const legacy = validateEnvelope(legacyJson);
afterEach(() => vi.restoreAllMocks());

it("passes the Argon2id test vector in RFC 9106 section 5.3", () => {
  const result = argon2id(
    new Uint8Array(32).fill(1),
    new Uint8Array(16).fill(2),
    {
      m: 32,
      t: 3,
      p: 4,
      version: 19,
      dkLen: 32,
      key: new Uint8Array(8).fill(3),
      personalization: new Uint8Array(12).fill(4),
    },
  );
  expect(Buffer.from(result).toString("hex")).toBe(
    "0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659",
  );
});

it("matches an independent hash-wasm known answer without exporting the derived key", async () => {
  const password = new TextEncoder().encode("synthetic benchmark passphrase");
  const key = await argonKey(password, new Uint8Array(16).fill(7), currentKdf);
  const reference = Uint8Array.from(
    Buffer.from(
      "6160c13cfd1e691e15a8315f9fcb3bdb632811606e6b53aa7c56e5a0aa634da5",
      "hex",
    ),
  );
  const expected = await crypto.subtle.importKey(
    "raw",
    reference,
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const algorithm = { name: "AES-GCM", iv: new Uint8Array(12).fill(1) };
  const plaintext = new TextEncoder().encode("known-answer encryption");
  expect(await crypto.subtle.encrypt(algorithm, key, plaintext)).toEqual(
    await crypto.subtle.encrypt(algorithm, expected, plaintext),
  );
  expect(key.extractable).toBe(false);
  expect(password.every((byte) => byte === 0)).toBe(true);
  await expect(crypto.subtle.exportKey("raw", key)).rejects.toThrow();
});

describe("versioned vault migration", () => {
  beforeEach(async () => {
    const current = await readEnvelope();
    if (current) await writeEnvelope(null, current.revision);
    vi.mocked(deriveArgon2).mockClear();
  });
  it("authenticates a v1 fixture and upgrades atomically while preserving all records", async () => {
    await writeEnvelope(legacy, null);
    const result = await unlockRecord(secret, legacy);
    expect(result.changed).toBe(true);
    expect(result.envelope.version).toBe(2);
    expect(result.envelope.salt).not.toBe(legacy.salt);
    expect(result.data.identities[0].name).toBe("Legacy synthetic");
    expect(result.data.identities[0].identifiers[0].value).toBe(
      "legacy@example.com",
    );
    expect(result.data.identities[0].images[0].label).toBe("Legacy photo");
    expect(await readEnvelope()).toEqual(legacy); // preparation alone cannot write
    await writeEnvelope(result.envelope, legacy.revision);
    const again = await unlockRecord(secret, (await readEnvelope())!);
    expect(again.changed).toBe(false);
    expect(again.envelope.revision).toBe(result.envelope.revision);
    expect(again.data).toEqual(result.data);
  });
  it("never runs Argon2 or modifies storage after a wrong legacy passphrase", async () => {
    await writeEnvelope(legacy, null);
    await expect(
      unlockRecord("incorrect passphrase here", legacy),
    ).rejects.toThrow("Could not unlock");
    expect(deriveArgon2).not.toHaveBeenCalled();
    expect(await readEnvelope()).toEqual(legacy);
  });
  it("preserves the old record if migration cannot commit", async () => {
    await writeEnvelope(legacy, null);
    const result = await unlockRecord(secret, legacy);
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(function (
      this: IDBObjectStore,
      ...args
    ) {
      const request = put.apply(this, args);
      this.transaction.abort();
      return request;
    });
    await expect(
      writeEnvelope(result.envelope, legacy.revision),
    ).rejects.toThrow("could not be saved");
    expect(await readEnvelope()).toEqual(legacy);
    await writeEnvelope(result.envelope, legacy.revision);
  });
  it("rejects a stale migration instead of overwriting newer data", async () => {
    await writeEnvelope(legacy, null);
    const result = await unlockRecord(secret, legacy);
    const newer = await seal(
      result.data,
      result.key,
      result.envelope.salt,
      currentKdf,
    );
    await writeEnvelope(newer, legacy.revision);
    await expect(
      writeEnvelope(result.envelope, legacy.revision),
    ).rejects.toThrow("another tab");
    expect(await readEnvelope()).toEqual(newer);
  });
  it("rejects hostile KDF profiles before starting a worker", async () => {
    const common = { ...legacy, version: 2, kdf: currentKdf };
    for (const kdf of [
      { ...currentKdf, memoryKiB: 2 ** 30 },
      { ...currentKdf, iterations: 1 },
      { ...currentKdf, parallelism: 128 },
      { ...currentKdf, version: 16 },
      { ...currentKdf, extra: true },
    ])
      expect(() => validateEnvelope({ ...common, kdf })).toThrow(
        "unsupported key derivation",
      );
    expect(() =>
      validateEnvelope({ ...legacy, salt: "a".repeat(10000) }),
    ).toThrow();
    expect(deriveArgon2).not.toHaveBeenCalled();
  });
  it("binds the v2 header and accepts reordered JSON properties", async () => {
    const result = await unlockRecord(secret, null);
    const envelope = result.envelope as CurrentEnvelope;
    expect(result.data).toEqual(emptyVault());
    const reordered = Object.fromEntries(
      Object.entries(envelope).reverse(),
    ) as CurrentEnvelope;
    expect(await open(reordered, result.key)).toEqual(result.data);
    for (const changed of [
      { ...envelope, revision: crypto.randomUUID() },
      { ...envelope, salt: newSalt() },
      { ...envelope, iv: btoa("x".repeat(12)) },
      { ...envelope, version: 1 as const, iterations: 600000 as const },
      {
        ...envelope,
        ciphertext:
          (envelope.ciphertext[0] === "A" ? "B" : "A") +
          envelope.ciphertext.slice(1),
      },
    ])
      await expect(open(changed, result.key)).rejects.toThrow(
        "Could not unlock",
      );
  });
  it("does not start work or commit when already cancelled", async () => {
    await writeEnvelope(legacy, null);
    const controller = new AbortController();
    controller.abort();
    await expect(
      unlockRecord(secret, legacy, controller.signal),
    ).rejects.toThrow();
    expect(deriveArgon2).not.toHaveBeenCalled();
    expect(await readEnvelope()).toEqual(legacy);
  });
});
