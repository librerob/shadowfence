export const identityColors = [
  "violet",
  "blue",
  "teal",
  "green",
  "rose",
  "neutral",
] as const;
export type IdentityColor = (typeof identityColors)[number];
export interface Fingerprint {
  sha256: string;
  phash: string;
  dhash: string;
  detail: number;
  algorithm: 1;
}
export interface RegisteredImage extends Fingerprint {
  id: string;
  label: string;
}
export interface Identifier {
  id: string;
  value: string;
}
export interface Identity {
  id: string;
  name: string;
  color: IdentityColor;
  description: string;
  images: RegisteredImage[];
  identifiers: Identifier[];
}
export interface VaultData {
  version: 1;
  identities: Identity[];
  currentId: string;
}
export const emptyVault = (): VaultData => ({
  version: 1,
  identities: [],
  currentId: "",
});
export const uid = () => crypto.randomUUID();

const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const text = (x: unknown, max: number): x is string =>
  typeof x === "string" && x.length <= max;
const hash = (x: unknown, size: number) =>
  typeof x === "string" && new RegExp(`^[a-f0-9]{${size}}$`).test(x);
export function isFingerprint(x: unknown): x is Fingerprint {
  return (
    object(x) &&
    x.algorithm === 1 &&
    hash(x.sha256, 64) &&
    hash(x.phash, 16) &&
    hash(x.dhash, 16) &&
    typeof x.detail === "number" &&
    Number.isFinite(x.detail) &&
    x.detail >= 0 &&
    x.detail <= 128
  );
}

export function validateData(x: unknown): VaultData {
  if (
    !object(x) ||
    x.version !== 1 ||
    !text(x.currentId, 64) ||
    !Array.isArray(x.identities) ||
    x.identities.length > 100
  )
    throw new Error("The vault data is invalid or uses an unsupported format.");
  const ids = new Set<string>();
  let images = 0;
  for (const i of x.identities) {
    if (
      !object(i) ||
      !text(i.id, 64) ||
      !i.id ||
      ids.has(i.id) ||
      !text(i.name, 60) ||
      !i.name.trim() ||
      !identityColors.includes(i.color as IdentityColor) ||
      !text(i.description, 240) ||
      !Array.isArray(i.images) ||
      !Array.isArray(i.identifiers) ||
      i.identifiers.length > 200
    )
      throw new Error("An identity record is invalid.");
    ids.add(i.id);
    const recordIds = new Set<string>();
    const exactHashes = new Set<string>();
    images += i.images.length;
    for (const image of i.images) {
      if (
        !object(image) ||
        !text(image.id, 64) ||
        recordIds.has(image.id) ||
        !text(image.label, 120) ||
        !isFingerprint(image) ||
        exactHashes.has(image.sha256)
      )
        throw new Error("An image record is invalid.");
      recordIds.add(image.id);
      exactHashes.add(image.sha256);
    }
    for (const identifier of i.identifiers) {
      if (
        !object(identifier) ||
        !text(identifier.id, 64) ||
        recordIds.has(identifier.id) ||
        !text(identifier.value, 200) ||
        !identifier.value.trim()
      )
        throw new Error("An identifier record is invalid.");
      recordIds.add(identifier.id);
    }
  }
  if (images > 10000 || (x.currentId !== "" && !ids.has(x.currentId)))
    throw new Error(
      "The vault exceeds its limits or has an invalid active identity.",
    );
  return x as unknown as VaultData;
}

export function addImage(
  data: VaultData,
  identityId: string,
  fp: Fingerprint,
  label = "",
): { data: VaultData; duplicate: boolean } {
  const next = structuredClone(data);
  const target = next.identities.find((i) => i.id === identityId);
  if (!target) throw new Error("Choose an identity first.");
  if (target.images.some((i) => i.sha256 === fp.sha256))
    return { data, duplicate: true };
  target.images.push({ ...fp, id: uid(), label: label.trim().slice(0, 120) });
  validateData(next);
  return { data: next, duplicate: false };
}
