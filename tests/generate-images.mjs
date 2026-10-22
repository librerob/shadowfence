import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
const dir = "test-results/images";
await mkdir(dir, { recursive: true });
const names = [
  "astronaut.png",
  "coffee.png",
  "chelsea.png",
  "camera.png",
  "rocket.jpg",
  "hubble_deep_field.jpg",
];
const cases = [];
for (const [index, name] of names.entries()) {
  const bytes = await readFile(join("tests/fixtures", name));
  const source = sharp(bytes),
    meta = await source.metadata();
  await writeFile(`${dir}/${index}-original.${name.split(".").pop()}`, bytes);
  const paths = {
    original: `${dir}/${index}-original.${name.split(".").pop()}`,
  };
  const variants = {
    resized: () => source.clone().resize({ width: 160 }).png(),
    recompressed: () => source.clone().jpeg({ quality: 35 }),
    brightness: () =>
      source.clone().modulate({ brightness: 1.12 }).jpeg({ quality: 80 }),
    color: () =>
      source
        .clone()
        .modulate({ saturation: 0.7, hue: 12 })
        .jpeg({ quality: 80 }),
    crop: () =>
      source
        .clone()
        .extract({
          left: Math.round(meta.width * 0.1),
          top: Math.round(meta.height * 0.1),
          width: Math.round(meta.width * 0.8),
          height: Math.round(meta.height * 0.8),
        })
        .jpeg(),
    rotation: () => source.clone().rotate(90).jpeg(),
    screenshot: () =>
      source
        .clone()
        .extend({
          top: 80,
          bottom: 60,
          left: 40,
          right: 40,
          background: "#f5f5f5",
        })
        .png(),
    webp: () => source.clone().webp({ quality: 70 }),
  };
  for (const [variant, make] of Object.entries(variants)) {
    const path = `${dir}/${index}-${variant}.${variant === "resized" || variant === "screenshot" ? "png" : variant === "webp" ? "webp" : "jpg"}`;
    await make().toFile(path);
    paths[variant] = path;
  }
  cases.push({ name, paths });
}
await writeFile(
  "test-results/image-cases.json",
  JSON.stringify(cases, null, 2),
);
console.log(
  `Generated ${cases.length} original photographs and ${cases.length * 8} variants.`,
);
