/* npm run size:mobile: what a phone's first visit to the lite version
 * (m.html, src/mobile/) downloads, from a fresh phone build.  Code is
 * counted as it travels (gzip), media as it is.  Budget: well under 5 MB
 * before the audio (docs/decisions/mobile-lite.md). */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = new URL('..', import.meta.url).pathname, DIST = path.join(ROOT, 'dist');
execSync('npx vite build --mode mobile', { cwd: ROOT, stdio: 'ignore' });
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const wire = (f) => {
  const ext = path.extname(f);
  return ['.js', '.css', '.html', '.json', '.svg'].includes(ext) ? zlib.gzipSync(fs.readFileSync(f)).length : fs.statSync(f).size;
};
const rows = {};
const add = (k, f) => { rows[k] = (rows[k] ?? 0) + wire(f); };
add('page (m.html)', path.join(DIST, 'm.html'));
add('key art', path.join(DIST, 'keyart.webp'));
for (const f of walk(path.join(DIST, 'm'))) {
  const ext = path.extname(f);
  add(ext === '.js' ? 'code' : ext === '.bin' ? 'Fuji elevation' : ext === '.woff2' ? 'sign fonts' : 'other', f);
}
const audio = fs.existsSync(path.join(DIST, 'audio')) ? walk(path.join(DIST, 'audio')) : [];
for (const f of audio) add('audio (after the tap, most near their place)', f);
const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
let total = 0;
for (const [k, v] of Object.entries(rows)) { total += v; console.log(`  ${k.padEnd(46)} ${mb(v)}`); }
const before = total - (rows['audio (after the tap, most near their place)'] ?? 0);
console.log(`SIZE (phone) ${mb(total)} in all; ${mb(before)} before the tap`);
