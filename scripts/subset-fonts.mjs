/* Self-hosted Japanese fonts for the signage (town quality pass).
 *
 * The full fonts (SIL OFL 1.1) live in assets/fonts/, never committed:
 *   MPLUSRounded1c-Bold.ttf    github.com/google/fonts/raw/main/ofl/mplusrounded1c/
 *   YujiSyuku-Regular.ttf      github.com/google/fonts/raw/main/ofl/yujisyuku/
 * This cuts each down to the characters the game's source actually draws:
 * the rounded face every non-ASCII character in src/, plus ASCII and both
 * kana sets; the brush face (heavy strokes, ~0.6 KB a glyph) only the sign
 * text in src/data/town.js and the kana.  It
 * writes woff2 to src/assets/fonts/, which is committed.  Needs fontTools'
 * pyftsubset (PYFTSUBSET=path, else on PATH).  Rerun after adding signs.
 *
 *   npm run fonts
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'assets', 'fonts');
const OUT = path.join(ROOT, 'src', 'assets', 'fonts');
const FONTS = [
  { from: 'MPLUSRounded1c-Bold.ttf', to: 'round.woff2', only: null },
  { from: 'YujiSyuku-Regular.ttf', to: 'brush.woff2', only: ['data/town.js'] },
];
const BUDGET_KB = 520;   // a guide (Tan: budgets are guides); was 450 before wave 1's sign text

const base = () => {
  const set = new Set();
  for (let c = 0x20; c <= 0x7e; c++) set.add(String.fromCodePoint(c));
  for (let c = 0x3041; c <= 0x30ff; c++) set.add(String.fromCodePoint(c));   // hiragana, katakana
  for (const c of '、。「」『』・ー〜！？（）　￥々〒') set.add(c);
  return set;
};
const addFile = (set, p) => { for (const c of fs.readFileSync(p, 'utf8')) if (c.codePointAt(0) > 0x7e) set.add(c); };
const walk = (set, dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== 'assets') walk(set, p); continue; }
    if (/\.(js|json)$/.test(f.name)) addFile(set, p);
  }
};

const tool = process.env.PYFTSUBSET || 'pyftsubset';
fs.mkdirSync(OUT, { recursive: true });
const textFile = path.join(OUT, '.chars.txt');
let total = 0;
for (const f of FONTS) {
  const chars = base();
  if (f.only) for (const p of f.only) addFile(chars, path.join(ROOT, 'src', p));
  else walk(chars, path.join(ROOT, 'src'));
  fs.writeFileSync(textFile, [...chars].join(''));
  const src = path.join(SRC, f.from);
  if (!fs.existsSync(src)) { console.error(`missing ${src} (see the header of this script)`); process.exit(1); }
  const out = path.join(OUT, f.to);
  execFileSync(tool, [src, `--text-file=${textFile}`, '--flavor=woff2', '--layout-features=*', '--no-hinting', '--desubroutinize', `--output-file=${out}`]);
  const kb = fs.statSync(out).size / 1024;
  total += kb;
  console.log(`  ${f.to.padEnd(12)} ${kb.toFixed(0)} KB (${chars.size} characters)`);
}
fs.unlinkSync(textFile);
console.log(`FONTS ${total.toFixed(0)} KB (budget ${BUDGET_KB} KB: ${total <= BUDGET_KB ? 'pass' : 'FAIL'})`);
if (total > BUDGET_KB) process.exit(1);
