import type { Fingerprint, Identity, RegisteredImage } from "./model";
export const PHASH_LIMIT = 8;
export const DHASH_LIMIT = 10;
export function hamming(a: string, b: string): number {
  if (a.length !== b.length || !/^[\da-f]+$/i.test(a + b))
    throw new Error("Invalid fingerprint.");
  let value = BigInt("0x" + a) ^ BigInt("0x" + b),
    count = 0;
  while (value) {
    value &= value - 1n;
    count++;
  }
  return count;
}
export function matchKind(
  a: Fingerprint,
  b: Fingerprint,
): "exact" | "similar" | null {
  if (a.sha256 === b.sha256) return "exact";
  if (a.detail < 8 || b.detail < 8) return null;
  return hamming(a.phash, b.phash) <= PHASH_LIMIT &&
    hamming(a.dhash, b.dhash) <= DHASH_LIMIT
    ? "similar"
    : null;
}
export interface ImageMatch {
  identity: Identity;
  image: RegisteredImage;
  kind: "exact" | "similar";
}
export function imageMatches(
  fp: Fingerprint,
  identities: Identity[],
  currentId: string,
): ImageMatch[] {
  return identities
    .filter((i) => i.id !== currentId)
    .flatMap((identity) =>
      identity.images.flatMap((image) => {
        const kind = matchKind(fp, image);
        return kind ? [{ identity, image, kind }] : [];
      }),
    );
}
export const normalize = (s: string) => s.normalize("NFKC").toLowerCase();
// Treat email/handle punctuation as part of a token to avoid matching inside another address.
const isToken = (s: string) => /[\p{L}\p{N}_@.+-]/u.test(s);
export function containsIdentifier(text: string, value: string) {
  return containsNormalized(normalize(text), normalize(value.trim()));
}
function containsNormalized(haystack: string, needle: string) {
  if (!needle.length) return false;
  let start = haystack.indexOf(needle);
  while (start !== -1) {
    const before =
      Array.from(haystack.slice(Math.max(0, start - 2), start)).at(-1) ?? "";
    const after =
      Array.from(
        haystack.slice(start + needle.length, start + needle.length + 2),
      )[0] ?? "";
    // A terminal full stop is sentence punctuation, unless followed by another token character.
    const terminalPeriod =
      after === "." && !isToken(haystack[start + needle.length + 1] ?? "");
    if (!isToken(before) && (!isToken(after) || terminalPeriod)) return true;
    start = haystack.indexOf(needle, start + 1);
  }
  return false;
}
export function textMatches(
  text: string,
  identities: Identity[],
  currentId: string,
) {
  const normalized = normalize(text);
  return identities
    .filter((i) => i.id !== currentId)
    .flatMap((identity) =>
      identity.identifiers
        .filter((i) =>
          containsNormalized(normalized, normalize(i.value.trim())),
        )
        .map((identifier) => ({ identity, identifier })),
    );
}
