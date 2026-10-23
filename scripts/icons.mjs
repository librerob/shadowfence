import sharp from "sharp";
for (const size of [16, 24, 32, 48])
  await sharp("public/icons/icon.svg")
    .resize(size, size)
    .png()
    .toFile(`public/icons/${size}.png`);
await sharp("public/icons/icon.svg")
  .resize(96, 96)
  .extend({
    top: 16,
    bottom: 16,
    left: 16,
    right: 16,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile("public/icons/128.png");
console.log(
  "Exported toolbar icons and a 128px Store icon with transparent padding.",
);
