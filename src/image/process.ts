import { differenceHash, perceptualHash } from "./hash";
import { dimensions, MAX_FILE_BYTES } from "./headers";
import type { Fingerprint } from "../core/model";

function luminance(bitmap: ImageBitmap, width: number, height: number) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx)
    throw new Error("Image processing is not available in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  const rgba = ctx.getImageData(0, 0, width, height).data;
  return Array.from(
    { length: width * height },
    (_, i) =>
      rgba[i * 4] * 0.299 + rgba[i * 4 + 1] * 0.587 + rgba[i * 4 + 2] * 0.114,
  );
}
export async function fingerprint(blob: Blob): Promise<Fingerprint> {
  if (!blob.size || blob.size > MAX_FILE_BYTES)
    throw new Error("Choose an image smaller than 16 MB.");
  const bytes = await blob.arrayBuffer();
  const { mime } = dimensions(bytes);
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }), {
    imageOrientation: "from-image",
    resizeWidth: 256,
    resizeHeight: 256,
    resizeQuality: "high",
  });
  try {
    const sha256 = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    return {
      sha256,
      ...perceptualHash(luminance(bitmap, 32, 32)),
      dhash: differenceHash(luminance(bitmap, 9, 8)),
      algorithm: 1,
    };
  } finally {
    bitmap.close();
  }
}
