// Shrink screenshots before committing them (macOS `sips`): at most `max` px wide, JPEG quality `q`.
//   node qa/shrink.mjs <folder> [max=1280] [q=70]      (sheet-*.jpg are left as they are)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [dir, max = '1280', q = '70'] = process.argv.slice(2);
let before = 0, after = 0, n = 0;
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.jpg') || f.startsWith('sheet-')) continue;
  const p = path.join(dir, f);
  before += fs.statSync(p).size;
  execFileSync('sips', ['-Z', max, '-s', 'formatOptions', q, p, '--out', p], { stdio: 'ignore' });
  after += fs.statSync(p).size;
  n++;
}
console.log(`${dir}: ${n} files, ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
