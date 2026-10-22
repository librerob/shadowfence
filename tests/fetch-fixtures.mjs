import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const sources={
 'astronaut.png':'88431cd9653ccd539741b555fb0a46b61558b301d4110412b5bc28b5e3ea6cb5',
 'coffee.png':'cc02f8ca188b167c775a7101b5d767d1e71792cf762c33d6fa15a4599b5a8de7',
 'chelsea.png':'596aa1e7cb875eb79f437e310381d26b338a81c2da23439704a73c4651e8c4bb',
 'camera.png':'b0793d2adda0fa6ae899c03989482bff9a42d3d5690fc7e3648f2795d730c23a',
 'rocket.jpg':'c2dd0de7c538df8d111e479619b129464d0269d0ae5fd18ca91d33a7fdfea95c',
 'hubble_deep_field.jpg':'3a19c5dd8a927a9334bb1229a6d63711b1c0c767fb27e2286e7c84a3e2c2f5f4',
};
await mkdir('tests/fixtures',{recursive:true});
for(const [name,hash] of Object.entries(sources)){
 const path='tests/fixtures/'+name;
 let bytes;try{bytes=await readFile(path);}catch{const response=await fetch('https://raw.githubusercontent.com/scikit-image/scikit-image/v0.25.2/skimage/data/'+name);if(!response.ok)throw Error(`Fixture download failed: ${name}`);bytes=Buffer.from(await response.arrayBuffer());}
 if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error(`Fixture checksum mismatch: ${name}`);
 await writeFile(path,bytes);
}
console.log('Verified six test photographs. These downloads are development-only.');
