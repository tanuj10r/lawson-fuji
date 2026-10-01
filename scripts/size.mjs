/* npm run size: what a first visit downloads (SPEC M7: under 5 MB), from a
 * fresh build.  Code is counted as it travels (gzip), media as it is. */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = new URL('..', import.meta.url).pathname, DIST = path.join(ROOT, 'dist');
execSync('npx vite build', { cwd: ROOT, stdio: 'ignore' });
const rows = {};
/* share images, large icons and the side pages (scripts/share-art.mjs,
 * QA-005/008/018): served, but only link previews, home screens and the
 * Credits link ask for them, so they sit outside the game's budget */
const EXTRAS = /^(og(-square)?\.jpg|icon-\d+\.png|apple-touch-icon\.png|favicon-32\.png|credits\.html|404\.html|LICENSE\.txt|OFL\.txt|robots\.txt|_headers)$/;
/* the key art's other sizes (scripts/keyart.mjs): a screen takes one of them
 * instead of keyart-1920.webp (srcset: small windows, large high-DPI screens; the phone card) */
const ALT_ART = /^keyart-(1280|2560|portrait)\.webp$/;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk(DIST)) {
  const raw = fs.statSync(f).size, ext = path.extname(f);
  const text = ['.js', '.css', '.html', '.json', '.svg'].includes(ext);
  const wire = text ? zlib.gzipSync(fs.readFileSync(f)).length : raw;
  const kind = /^(postcardSelfie-|hachi-peek-)/.test(path.basename(f)) ? 'selfie postcard (on its click)' : EXTRAS.test(path.basename(f)) ? 'page extras (not the game)' : ALT_ART.test(path.basename(f)) ? 'key art alternates' : f.includes('/audio/') ? 'audio (after the first click)' : ext === '.js' ? 'code' : ext === '.bin' ? 'Fuji elevation' : ext === '.woff2' ? 'sign fonts' : 'other';
  rows[kind] = (rows[kind] ?? 0) + wire;
}
const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
let total = 0;
for (const [k, v] of Object.entries(rows)) { if (!k.startsWith('page extras') && !k.startsWith('key art alt')) total += v; console.log(`  ${k.padEnd(30)} ${mb(v)}`); }
const first = total - (rows['audio (after the first click)'] ?? 0) - (rows['selfie postcard (on its click)'] ?? 0);
console.log(`SIZE ${mb(total)} in all; ${mb(first)} before the first click (budget 5 MB: ${total <= 5 * 1024 * 1024 ? "pass" : "FAIL"}); plus ${mb(rows["page extras (not the game)"] ?? 0)} of page extras`);
const alt = fs.existsSync(path.join(DIST, 'keyart-2560.webp')) ? fs.statSync(path.join(DIST, 'keyart-2560.webp')).size - fs.statSync(path.join(DIST, 'keyart-1920.webp')).size : 0;
if (alt) console.log(`  (a large high-DPI screen takes keyart-2560.webp instead of -1920: +${mb(alt)} before the first click)`);
