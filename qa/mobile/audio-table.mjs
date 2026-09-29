// Audio inventory for MOBILE_FEASIBILITY.md: format, channels, bitrate, duration, size (macOS afinfo).
//   node qa/mobile/audio-table.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DIR = new URL('../../public/audio/', import.meta.url).pathname;
const rows = [];
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.m4a'))) {
  const out = execFileSync('afinfo', [path.join(DIR, f)], { encoding: 'utf8' });
  const fmt = /Data format:\s+(.*)/.exec(out)?.[1] ?? '?';
  const dur = +(/estimated duration:\s+([\d.]+)/.exec(out)?.[1] ?? 0);
  const br = +(/bit rate:\s+(\d+)/.exec(out)?.[1] ?? 0);
  const ch = /(\d) ch/.exec(fmt)?.[1];
  const hz = /(\d+) Hz/.exec(fmt)?.[1];
  const codec = /Hz,\s+(\w+)/.exec(fmt)?.[1];
  rows.push({ f, codec: `${codec} ${hz / 1000} kHz`, ch, kbps: Math.round(br / 1000), dur: dur.toFixed(1), kb: Math.round(fs.statSync(path.join(DIR, f)).size / 1024) });
}
rows.sort((a, b) => b.kb - a.kb);
console.log('| File | Codec | Ch | kbps | Duration s | KB |\n|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.f} | ${r.codec} | ${r.ch} | ${r.kbps} | ${r.dur} | ${r.kb} |`);
console.log(`| total | | | | ${rows.reduce((a, r) => a + +r.dur, 0).toFixed(0)} | ${rows.reduce((a, r) => a + r.kb, 0)} |`);
