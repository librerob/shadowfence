import { readFile, writeFile } from "node:fs/promises";
const notices = [];
for (const name of ["react", "react-dom", "scheduler", "@noble/hashes"]) {
  const pkg = JSON.parse(
    await readFile(`node_modules/${name}/package.json`, "utf8"),
  );
  notices.push(
    `${name} ${pkg.version}\n${await readFile(`node_modules/${name}/LICENSE`, "utf8")}`,
  );
}
await writeFile("public/THIRD-PARTY-NOTICES.txt", notices.join("\n\n---\n\n"));
await writeFile("public/LICENSE.txt", await readFile("LICENSE"));
