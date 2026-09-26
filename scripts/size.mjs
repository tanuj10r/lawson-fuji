/* npm run size: what a first visit downloads (SPEC M7: under 5 MB), from a
 * fresh build.  Code is counted as it travels (gzip), media as it is. */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = new URL('..', import.meta.url).pathname, DIST = path.join(ROOT, 'dist');
execSync('npx vite build', { cwd: ROOT, stdio: 'ignore' });
const rows = {};
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk(DIST)) {
  const raw = fs.statSync(f).size, ext = path.extname(f);
  const text = ['.js', '.css', '.html', '.json', '.svg'].includes(ext);
  const wire = text ? zlib.gzipSync(fs.readFileSync(f)).length : raw;
  const kind = f.includes('/audio/') ? 'audio (after the first click)' : ext === '.js' ? 'code' : ext === '.bin' ? 'Fuji elevation' : 'other';
  rows[kind] = (rows[kind] ?? 0) + wire;
}
const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
let total = 0;
for (const [k, v] of Object.entries(rows)) { total += v; console.log(`  ${k.padEnd(30)} ${mb(v)}`); }
const first = total - (rows['audio (after the first click)'] ?? 0);
console.log(`SIZE ${mb(total)} in all; ${mb(first)} before the first click (budget 5 MB: ${total <= 5 * 1024 * 1024 ? 'pass' : 'FAIL'})`);
