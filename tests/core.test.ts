import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
  addImage,
  emptyVault,
  validateData,
  type Fingerprint,
  type VaultData,
} from "../src/core/model";
import {
  containsIdentifier,
  hamming,
  imageMatches,
  matchKind,
  textMatches,
} from "../src/core/matching";
import {
  checkPassphrase,
  deriveKey,
  newSalt,
  open,
  seal,
  validateEnvelope,
} from "../src/core/crypto";
import { readEnvelope, writeEnvelope } from "../src/core/storage";
import { differenceHash, perceptualHash } from "../src/image/hash";
import { dimensions } from "../src/image/headers";

const fp: Fingerprint = {
  algorithm: 1,
  sha256: "a".repeat(64),
  phash: "1234567890abcdef",
  dhash: "fedcba0987654321",
  detail: 34,
};
const fixture = (): VaultData => ({
  version: 1,
  currentId: "anonymous",
  identities: [
    {
      id: "personal",
      name: "Personal",
      color: "blue",
      description: "Private",
      images: [{ ...fp, id: "photo", label: "Garden" }],
      identifiers: [
        { id: "email", value: "personal@example.com" },
        { id: "handle", value: "@robin" },
      ],
    },
    {
      id: "anonymous",
      name: "Anonymous",
      color: "violet",
      description: "",
      images: [],
      identifiers: [],
    },
  ],
});
describe("identity boundaries", () => {
  it("reports cross-identity exact matches and ignores the current identity", () => {
    expect(imageMatches(fp, fixture().identities, "anonymous")[0].kind).toBe(
      "exact",
    );
    expect(imageMatches(fp, fixture().identities, "personal")).toHaveLength(0);
  });
  it("deduplicates registrations and makes intentional reuse explicit", () => {
    const duplicate = addImage(fixture(), "personal", fp);
    expect(duplicate.duplicate).toBe(true);
    const shared = addImage(fixture(), "anonymous", fp, "Shared photo");
    expect(shared.data.identities[1].images).toHaveLength(1);
    expect(imageMatches(fp, shared.data.identities, "anonymous")).toHaveLength(
      1,
    );
    expect(fixture().identities[1].images).toHaveLength(0);
  });
  it("rejects broken records, duplicate identities and excessive data", () => {
    expect(() =>
      validateData({ ...fixture(), currentId: "missing" }),
    ).toThrow();
    const broken = fixture();
    broken.identities.push(broken.identities[0]);
    expect(() => validateData(broken)).toThrow();
    expect(() => validateData({ version: 2 })).toThrow();
    expect(() => addImage(fixture(), "missing", fp)).toThrow();
  });
});
describe("matching", () => {
  it("counts Hamming distance correctly", () => {
    expect(hamming("0000", "ffff")).toBe(16);
    expect(hamming("8001", "0000")).toBe(2);
    expect(() => hamming("z", "1")).toThrow();
  });
  it("requires both perceptual methods and sufficient image detail", () => {
    expect(matchKind(fp, { ...fp, sha256: "b".repeat(64) })).toBe("similar");
    expect(
      matchKind(fp, { ...fp, sha256: "b".repeat(64), detail: 0 }),
    ).toBeNull();
    expect(
      matchKind(fp, {
        ...fp,
        sha256: "b".repeat(64),
        dhash: "0000000000000000",
      }),
    ).toBeNull();
    expect(matchKind({ ...fp, detail: 0 }, { ...fp, detail: 0 })).toBe("exact");
  });
  it("normalizes Unicode and case, with identifier boundaries", () => {
    expect(
      containsIdentifier(
        "Contact PERSONAL@example.com.",
        "personal@example.com",
      ),
    ).toBe(true);
    expect(containsIdentifier("Hello (@Robin)!", "@robin")).toBe(true);
    expect(containsIdentifier("ｒｏｂｉｎ", "robin")).toBe(true);
    expect(containsIdentifier("robinson", "robin")).toBe(false);
    expect(
      containsIdentifier("otherpersonal@example.com", "personal@example.com"),
    ).toBe(false);
    expect(
      containsIdentifier(
        "personal@example.com.attacker.net",
        "personal@example.com",
      ),
    ).toBe(false);
    expect(containsIdentifier("x@robin", "@robin")).toBe(false);
    expect(containsIdentifier("𐐀robin", "robin")).toBe(false);
    expect(
      textMatches("personal@example.com", fixture().identities, "personal"),
    ).toHaveLength(0);
    expect(
      textMatches("personal@example.com", fixture().identities, "anonymous"),
    ).toHaveLength(1);
  });
  it("hashes uniform images deterministically, with low-detail suppression", () => {
    const gray = Array(1024).fill(128);
    expect(perceptualHash(gray).detail).toBe(0);
    expect(differenceHash(Array(72).fill(0))).toBe("0000000000000000");
    expect(() => perceptualHash([])).toThrow();
  });
});
describe("authenticated encryption", () => {
  it("encrypts all sensitive fields and restores the original data", async () => {
    const salt = newSalt(),
      key = await deriveKey("four random words here", salt),
      data = fixture();
    const encrypted = await seal(data, key, salt);
    expect(JSON.stringify(encrypted)).not.toContain("Personal");
    expect(JSON.stringify(encrypted)).not.toContain("example.com");
    expect(await open(encrypted, key)).toEqual(data);
    expect(key.extractable).toBe(false);
    expect((await seal(data, key, salt)).iv).not.toBe(encrypted.iv);
  });
  it("rejects wrong passphrases and tampered ciphertext", async () => {
    const salt = newSalt(),
      key = await deriveKey("four random words here", salt),
      encrypted = await seal(fixture(), key, salt);
    await expect(
      open(encrypted, await deriveKey("another passphrase entirely", salt)),
    ).rejects.toThrow("Could not unlock");
    const changed = {
      ...encrypted,
      ciphertext:
        (encrypted.ciphertext[0] === "A" ? "B" : "A") +
        encrypted.ciphertext.slice(1),
    };
    await expect(open(changed, key)).rejects.toThrow("Could not unlock");
  });
  it("rejects hostile KDF settings, malformed backups and weak new passphrases", () => {
    expect(() => validateEnvelope({ iterations: 1e12 })).toThrow();
    expect(() => checkPassphrase("short")).toThrow();
  });
});
describe("persistent storage", () => {
  beforeEach(async () => {
    const current = await readEnvelope();
    if (current) await writeEnvelope(null, current.revision);
  });
  it("persists encrypted records, rejects stale saves, and deletes atomically", async () => {
    const salt = newSalt(),
      key = await deriveKey("four random words here", salt),
      envelope = await seal(emptyVault(), key, salt);
    await writeEnvelope(envelope, null);
    expect(await readEnvelope()).toEqual(envelope);
    await expect(
      writeEnvelope({ ...envelope, revision: crypto.randomUUID() }, null),
    ).rejects.toThrow("another tab");
    await writeEnvelope(null, envelope.revision);
    expect(await readEnvelope()).toBeNull();
  });
});
describe("untrusted image headers", () => {
  it("rejects SVG and oversized PNG before decoding", () => {
    expect(() =>
      dimensions(new TextEncoder().encode("<svg></svg>").buffer),
    ).toThrow("JPEG");
    const png = new Uint8Array(24);
    png.set([137, 80, 78, 71, 13, 10, 26, 10]);
    png.set([73, 72, 68, 82], 12);
    const view = new DataView(png.buffer);
    view.setUint32(16, 100000);
    view.setUint32(20, 100000);
    expect(() => dimensions(png.buffer)).toThrow("too large");
    view.setUint32(16, 100);
    view.setUint32(20, 200);
    expect(dimensions(png.buffer)).toEqual({
      width: 100,
      height: 200,
      mime: "image/png",
    });
  });
});
