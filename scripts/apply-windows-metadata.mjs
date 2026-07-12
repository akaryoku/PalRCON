import fs from 'node:fs/promises';
import path from 'node:path';
import { rcedit } from 'rcedit';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const executable = path.join(root, 'release', 'win-unpacked', 'PalRCON.exe');
await rcedit(executable, {
  icon: path.join(root, 'build', 'icon.ico'),
  'file-version': pkg.version,
  'product-version': pkg.version,
  'version-string': {
    CompanyName: 'PalRCON',
    FileDescription: 'PalRCON desktop administration console',
    InternalName: 'PalRCON',
    OriginalFilename: 'PalRCON.exe',
    ProductName: 'PalRCON'
  }
});
console.log(`Applied PalRCON ${pkg.version} icon and Windows metadata`);
