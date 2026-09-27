/* The cashier's voice (Tan's konbini): her lines, said by macOS's Kyoko.
 *
 *   node scripts/gen-voices.mjs     then   npm run audio
 *
 * Writes assets/audio/v-*.aiff (never committed: assets/audio is ignored)
 * and makes sure scripts/audio-cuts.json cuts each one.  One line per total
 * two of the featured things can come to ("588円になります"), the same list
 * store/shop.js asks for, and a general one for anything else.  macOS only
 * (`say`); without the files the game falls back to a soft tap and the
 * subtitle still shows.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { FEATURED, PRODUCT } from '../src/data/catalog.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'assets', 'audio');
const VOICE = 'Kyoko', RATE = '190';

const prices = FEATURED.flatMap((f) => f.ids).map((id) => PRODUCT[id].priceYen);
const totals = [...new Set(prices.flatMap((a, i) => [a, ...prices.slice(i).map((b) => a + b)]))].sort((a, b) => a - b);

const LINES = {
  'v-irasshaimase': 'いらっしゃいませ！',
  'v-oazukari': 'お預かりします。',
  'v-total': 'お会計、こちらになります。',
  'v-arigatou': 'ありがとうございます。',
  'v-arigatou-mashita': 'ありがとうございました！',
  ...Object.fromEntries(totals.map((n) => [`v-total-${n}`, `${n}円になります。`])),
};

fs.mkdirSync(OUT, { recursive: true });
const { files } = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'audio-cuts.json'), 'utf8'));
const missing = [];
for (const [name, text] of Object.entries(LINES)) {
  execFileSync('say', ['-v', VOICE, '-r', RATE, '-o', path.join(OUT, name + '.aiff'), text]);
  if (!files[name]) missing.push(name);
  console.log(`  ${name.padEnd(22)} ${text}`);
}
console.log(`${Object.keys(LINES).length} lines in ${path.relative(ROOT, OUT)}/; now npm run audio`);
// each needs its line in scripts/audio-cuts.json (a price changed: add the new total's)
if (missing.length) console.log(`MISSING in scripts/audio-cuts.json: ${missing.join(', ')}`);
