export const MAX_FILE_BYTES = 16 * 1024 * 1024;
export const MAX_PIXELS = 24_000_000;
export function dimensions(buffer: ArrayBuffer): {
  width: number;
  height: number;
  mime: string;
} {
  const b = new Uint8Array(buffer),
    v = new DataView(buffer);
  let width = 0,
    height = 0,
    mime = "";
  const word = (offset: number, count: number) =>
    String.fromCharCode(...b.slice(offset, offset + count));
  if (
    b.length >= 24 &&
    word(0, 8) === "\x89PNG\r\n\x1a\n" &&
    word(12, 4) === "IHDR"
  ) {
    width = v.getUint32(16);
    height = v.getUint32(20);
    mime = "image/png";
  } else if (b.length >= 12 && b[0] === 255 && b[1] === 216) {
    mime = "image/jpeg";
    let p = 2;
    while (p + 4 <= b.length) {
      if (b[p++] !== 255) break;
      while (b[p] === 255) p++;
      const marker = b[p++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (p + 2 > b.length) break;
      const len = v.getUint16(p);
      if (len < 2 || p + len > b.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker) && len >= 8) {
        height = v.getUint16(p + 3);
        width = v.getUint16(p + 5);
        break;
      }
      p += len;
    }
  } else if (b.length >= 30 && word(0, 4) === "RIFF" && word(8, 4) === "WEBP") {
    mime = "image/webp";
    const type = word(12, 4);
    if (type === "VP8X") {
      if (b[20] & 2)
        throw new Error(
          "Animated WebP is not supported. Choose a still image.",
        );
      width = 1 + b[24] + (b[25] << 8) + (b[26] << 16);
      height = 1 + b[27] + (b[28] << 8) + (b[29] << 16);
    } else if (
      type === "VP8 " &&
      b[23] === 0x9d &&
      b[24] === 0x01 &&
      b[25] === 0x2a
    ) {
      width = v.getUint16(26, true) & 0x3fff;
      height = v.getUint16(28, true) & 0x3fff;
    } else if (type === "VP8L" && b[20] === 0x2f) {
      const bits = v.getUint32(21, true);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    }
  }
  if (!mime || !width || !height)
    throw new Error(
      "Choose a valid, still JPEG, PNG, or WebP image. AVIF and active formats are not supported in this release.",
    );
  if (width * height > MAX_PIXELS || width > 10000 || height > 10000)
    throw new Error(
      "This image is too large. Use at most 24 megapixels and 10,000 pixels on either side.",
    );
  return { width, height, mime };
}
