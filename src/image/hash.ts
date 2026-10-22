// A 32x32 luminance DCT, with the DC coefficient excluded from the median.
// Pairing pHash with horizontal dHash reduces matches between unrelated layouts.
const N = 32;
const cosines = Array.from({ length: 8 }, (_, u) =>
  Array.from({ length: N }, (_, x) =>
    Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)),
  ),
);
const hex = (bits: boolean[]) =>
  bits
    .reduce((n, b) => (n << 1n) | (b ? 1n : 0n), 0n)
    .toString(16)
    .padStart(16, "0");
export function perceptualHash(gray: ArrayLike<number>) {
  if (gray.length !== N * N)
    throw new Error("Expected 32×32 luminance samples.");
  const row = new Float64Array(N * 8);
  for (let y = 0; y < N; y++)
    for (let u = 0; u < 8; u++) {
      let sum = 0;
      for (let x = 0; x < N; x++) sum += gray[y * N + x] * cosines[u][x];
      row[y * 8 + u] = sum;
    }
  const coefficients: number[] = [];
  for (let v = 0; v < 8; v++)
    for (let u = 0; u < 8; u++) {
      if (u === 0 && v === 0) continue;
      let sum = 0;
      for (let y = 0; y < N; y++) sum += row[y * 8 + u] * cosines[v][y];
      coefficients.push(sum);
    }
  const median = [...coefficients].sort((a, b) => a - b)[31];
  const mean = Array.from(gray).reduce((a, b) => a + b, 0) / gray.length;
  const detail = Math.sqrt(
    Array.from(gray).reduce((a, b) => a + (b - mean) ** 2, 0) / gray.length,
  );
  return { phash: hex(coefficients.map((c) => c > median)), detail };
}
export function differenceHash(gray: ArrayLike<number>) {
  if (gray.length !== 72) throw new Error("Expected 9×8 luminance samples.");
  return hex(
    Array.from(
      { length: 64 },
      (_, i) =>
        gray[Math.floor(i / 8) * 9 + (i % 8)] >
        gray[Math.floor(i / 8) * 9 + (i % 8) + 1],
    ),
  );
}
