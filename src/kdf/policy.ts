// One allowlisted profile: imports cannot choose weaker or unbounded work.
export const currentKdf = Object.freeze({
  name: "argon2id",
  version: 19,
  memoryKiB: 65536,
  iterations: 3,
  parallelism: 1,
} as const);
export type Argon2Profile = typeof currentKdf;

export function validateKdf(input: unknown): Argon2Profile {
  const x = input as Record<string, unknown> | null;
  if (
    !x ||
    Object.keys(x).length !== Object.keys(currentKdf).length ||
    Object.entries(currentKdf).some(([key, value]) => x[key] !== value)
  )
    throw new Error("This backup uses unsupported key derivation settings.");
  return { ...currentKdf };
}
