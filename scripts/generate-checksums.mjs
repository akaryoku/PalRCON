import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const release = path.join(root, 'release');
const names = [`PalRCON-Portable-${pkg.version}-x64.exe`, `PalRCON-Setup-${pkg.version}-x64.exe`];
const lines = [];
for (const name of names) {
  const content = await fs.readFile(path.join(release, name));
  lines.push(`${crypto.createHash('sha256').update(content).digest('hex')}  ${name}`);
}
await fs.writeFile(path.join(release, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`, 'utf8');
console.log(`Generated release/SHA256SUMS.txt for ${pkg.version}`);
