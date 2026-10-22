import sharp from "sharp";
for (const size of [16, 32, 48, 128])
  await sharp("public/icons/icon.svg")
    .resize(size, size)
    .png()
    .toFile(`public/icons/${size}.png`);
console.log("Exported toolbar and extension icons from the SVG master.");
