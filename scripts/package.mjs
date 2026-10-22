import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { zipSync, unzipSync } from "fflate";
import { createHash } from "node:crypto";
await import("./validate-package.mjs");
const files = {};
async function walk(dir, prefix = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name),
      name = prefix + entry.name;
    if (entry.isDirectory()) await walk(path, name + "/");
    else files[name] = new Uint8Array(await readFile(path));
  }
}
await walk("dist");
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const zip = zipSync(files, { level: 9 });
const check = unzipSync(zip);
if (
  !check["manifest.json"] ||
  Object.keys(check).some((name) => name.includes("node_modules"))
)
  throw new Error("Invalid ZIP structure.");
await mkdir("release", { recursive: true });
const filename = `shadowfence-${version}.zip`;
await writeFile(`release/${filename}`, zip);
await writeFile(
  "release/SHA256SUMS",
  createHash("sha256").update(zip).digest("hex") + "  " + filename + "\n",
);
console.log(
  `Created release/${filename} (${zip.length.toLocaleString()} bytes, ${Object.keys(files).length} files).`,
);
