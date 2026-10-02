/* AGENTS.md: all place, shop and line names are our own.
 * Builds, then searches the shipped bundle for every name known not to be. */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const NAMES = [
  'ひばり', 'HIBARI', 'さくら坂', '桜坂', 'SAKURAZAKA', '青空商店', 'さかえ', 'SAKAE',
  '桜ヶ丘', 'ひだまり', 'HIDAMARI', '桜川電鉄', '春風', '桜守', 'はるかぜ',
];
/* And no real product brands on the shelves (AGENTS.md: products are
 * generic), and no real chain's name: the store is NIPPON (M3d). */
const BRANDS = [
  'Pocari', 'ポカリ', 'Strong Zero', 'ストロングゼロ', '-196', 'Suntory', 'サントリー', '伊右衛門', 'BOSS',
  'Calpis', 'カルピス', 'Kirin', 'キリン', 'Asahi', 'アサヒ', 'Sapporo', 'サッポロ', 'Yebisu', 'ヱビス',
  'Häagen', 'ハーゲンダッツ', '雪見だいふく', 'Pino', 'ピノ', 'Coca', 'コカ', 'Pepsi', 'ペプシ', '三ツ矢',
  'Karaage-kun', 'からあげクン', 'Loppi', 'ChargeSPOT', 'チャージスポット', 'MACHI', 'マチカフェ',
  'FamilyMart', 'ファミリーマート', 'LAWSON', 'Lawson', 'ローソン', '7-Eleven', 'セブン', 'Oi Ocha', 'お〜いお茶', 'Aquarius', 'アクエリアス',
];
NAMES.push(...BRANDS);
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
console.log(found ? `FAIL: ${found} name(s) that are not ours in the bundle` : `pass: none of ${NAMES.length} names in the bundle`);
process.exitCode = found ? 1 : 0;
