/* AGENTS.md: no Sakura Crossing place, shop or line names in the game.
 * Builds, then searches the shipped bundle for every name we know of. */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const NAMES = [
  'ひばり', 'HIBARI', 'さくら坂', '桜坂', 'SAKURAZAKA', '青空商店', 'さかえ', 'SAKAE',
  '桜ヶ丘', 'ひだまり', 'HIDAMARI', '桜川電鉄', '春風', '桜守', 'はるかぜ',
];
execSync('npx vite build', { cwd: ROOT, stdio: 'ignore' });
const dir = path.join(ROOT, 'dist', 'assets');
let found = 0;
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  for (const n of NAMES) {
    const k = src.split(n).length - 1;
    if (k) { found += k; console.log(`FOUND ${n} x${k} in ${f}`); }
  }
}
console.log(found ? `FAIL: ${found} Sakura Crossing name(s) in the bundle` : `pass: none of ${NAMES.length} names in the bundle`);
process.exitCode = found ? 1 : 0;
