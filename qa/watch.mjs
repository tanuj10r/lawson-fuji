// Follow a scenario's output file: print each PASS/FAIL/INFO line (cut short) as it lands; exit on `--until` text.
//   node qa/watch.mjs <file> [--until 99-end]
import fs from 'node:fs';

const file = process.argv[2];
const i = process.argv.indexOf('--until');
const until = i > 0 ? process.argv[i + 1] : '99-end';
let seen = 0;
for (;;) {
  let lines = [];
  try { lines = fs.readFileSync(file, 'utf8').split('\n'); } catch {}
  const hits = lines.filter((l) => /^(PASS|FAIL|INFO)|Error|DONE/.test(l));
  for (const l of hits.slice(seen)) console.log(l.slice(0, 320));
  seen = hits.length;
  if (lines.some((l) => l.includes(until)) || lines.some((l) => /^\s+at .*\.mjs/.test(l))) { console.log('WATCH-END'); break; }
  await new Promise((r) => setTimeout(r, 4000));
}
