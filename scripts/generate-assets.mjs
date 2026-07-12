import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = path.resolve(import.meta.dirname, '..');
const build = path.join(root, 'build');
const source = await fs.readFile(path.join(build, 'icon.svg'));
const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = await Promise.all(sizes.map((size) => sharp(source).resize(size, size).png().toBuffer()));
await fs.writeFile(path.join(build, 'icon.png'), await sharp(source).resize(512, 512).png().toBuffer());
await fs.writeFile(path.join(build, 'icon.ico'), await pngToIco(pngs));
console.log('Generated build/icon.png and build/icon.ico');
