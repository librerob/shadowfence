import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const dir = "test-results/store";
await mkdir(dir, { recursive: true });
const mark = (x, y, size) =>
  `<g transform="translate(${x} ${y}) scale(${size / 128})"><rect width="128" height="128" rx="30" fill="#6650a4"/><path d="M28 35h22v58H28zm50 0h22v58H78z" fill="#f5eeff"/><path d="M60 24h8v80h-8z" fill="#d3bcff"/><path d="M28 35h22v14H28zm50 44h22v14H78z" fill="#d3bcff"/></g>`;
const words = JSON.parse(await readFile("store/wordmarks.json", "utf8"));
const wordmark = (key, x, y, size, fill, center = false) => {
  const word = words[key],
    scale = size / word.units;
  const left = center ? x - (word.advance * scale) / 2 : x;
  return `<path d="${word.path}" fill="${fill}" transform="translate(${left} ${y}) scale(${scale} ${-scale})"/>`;
};
const small = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#17131f"/><stop offset="1" stop-color="#352345"/></linearGradient></defs>
<rect width="440" height="280" fill="url(#bg)"/>
<g fill="none" stroke="#82669c" stroke-width="1.5" opacity=".4"><rect x="-18" y="64" width="140" height="156" rx="24"/><rect x="318" y="32" width="140" height="156" rx="24"/></g>
<g fill="#d3bcff" opacity=".12"><rect x="10" y="100" width="78" height="9" rx="4.5"/><rect x="10" y="124" width="56" height="9" rx="4.5"/><rect x="348" y="92" width="84" height="9" rx="4.5"/><rect x="348" y="116" width="62" height="9" rx="4.5"/></g>
${mark(172, 47, 96)}
${wordmark("name", 220, 204, 32, "#f5eeff", true)}
</svg>`;
const marquee = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="560" viewBox="0 0 1400 560">
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#15111d"/><stop offset="1" stop-color="#352345"/></linearGradient></defs>
<rect width="1400" height="560" fill="url(#bg)"/>
<path d="M900 0v560" stroke="#d3bcff" opacity=".1"/>
${mark(100, 188, 128)}
${wordmark("name", 270, 263, 66, "#f5eeff")}
${wordmark("tagline", 272, 310, 25, "#d3bcff")}
<g transform="translate(952 110)"><rect width="174" height="228" rx="28" fill="#251e30" stroke="#73558d"/><circle cx="46" cy="52" r="18" fill="#493565"/><path d="M78 46h63M78 60h41M30 104h114M30 126h89M30 148h102" stroke="#ad96c4" stroke-width="7" stroke-linecap="round" opacity=".65"/></g>
<g transform="translate(1154 210)"><rect width="174" height="228" rx="28" fill="#251e30" stroke="#73558d"/><circle cx="46" cy="52" r="18" fill="#493565"/><path d="M78 46h63M78 60h41M30 104h114M30 126h89M30 148h102" stroke="#ad96c4" stroke-width="7" stroke-linecap="round" opacity=".65"/></g>
<rect x="1136" y="166" width="6" height="230" rx="3" fill="#d3bcff" opacity=".8"/>
</svg>`;
for (const [name, svg] of [
  ["promo-small-440x280", small],
  ["promo-marquee-1400x560", marquee],
]) {
  await writeFile(`${dir}/${name}.svg`, svg);
  await sharp(Buffer.from(svg))
    .removeAlpha()
    .png()
    .toFile(`${dir}/${name}.png`);
}
await writeFile(
  `${dir}/store-icon-128.png`,
  await readFile("public/icons/128.png"),
);
console.log("Generated Store icon and original vector promotional tiles.");
