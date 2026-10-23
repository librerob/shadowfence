import { readFile, access, readdir } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
import sharp from "sharp";
const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
assert.equal(manifest.manifest_version, 3);
assert.equal(
  manifest.version,
  JSON.parse(await readFile("package.json", "utf8")).version,
);
assert.equal(manifest.minimum_chrome_version, "120");
assert.equal(manifest.permissions, undefined);
assert.equal(manifest.host_permissions, undefined);
assert.equal(manifest.content_scripts, undefined);
assert.equal(manifest.web_accessible_resources, undefined);
assert.match(
  manifest.content_security_policy.extension_pages,
  /connect-src 'none'/,
);
assert.doesNotMatch(
  manifest.content_security_policy.extension_pages,
  /unsafe-eval/,
);
for (const file of [
  manifest.action.default_popup,
  manifest.options_ui.page,
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon),
  "icons/icon.svg",
  "appearance.js",
])
  await access(join("dist", file));
for (const [size, file] of Object.entries({
  ...manifest.icons,
  ...manifest.action.default_icon,
})) {
  const meta = await sharp(join("dist", file)).metadata();
  assert.equal(meta.format, "png");
  assert.equal(meta.width, Number(size));
  assert.equal(meta.height, Number(size));
}
const storeIcon = await sharp("dist/icons/128.png")
  .ensureAlpha()
  .raw()
  .toBuffer();
for (let y = 0; y < 128; y++)
  for (let x = 0; x < 128; x++) {
    if (x < 16 || x >= 112 || y < 16 || y >= 112)
      assert.equal(
        storeIcon[(y * 128 + x) * 4 + 3],
        0,
        "Store icon has transparent 16px padding",
      );
  }
for (const page of ["app.html", "popup.html"]) {
  const html = await readFile(join("dist", page), "utf8");
  for (const [, file] of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g))
    await access(join("dist", file));
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
}
const assets = await readdir("dist/assets");
await access("dist/LICENSE.txt");
await access("dist/THIRD-PARTY-NOTICES.txt");
assert.ok(assets.some((x) => x.startsWith("worker-") && x.endsWith(".js")));
assert.ok(assets.some((x) => x.startsWith("key-worker-") && x.endsWith(".js")));
console.log(
  "Package validated: MV3, local assets, image worker, zero permissions, no runtime connections.",
);
