// Contact sheets: every jpg in a folder, in a labelled grid, one sheet per filter.
//   node qa/contact-sheet.mjs <folder> <filter-substring> <out.jpg> [cols=4] [thumbW=400]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [dir, filter, out, cols = '4', tw = '400'] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg') && f.includes(filter)).sort();
const W = +tw, H = Math.round(W * 9 / 16), C = +cols, rows = Math.ceil(files.length / C);
const html = `<html><body style="margin:0;background:#222;font:12px sans-serif;color:#fff;display:grid;grid-template-columns:repeat(${C},${W}px);gap:4px;padding:4px">
${files.map((f) => `<div><img src="data:image/jpeg;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}" style="width:${W}px;height:${H}px;display:block"><div>${f}</div></div>`).join('')}</body></html>`;
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage({ viewport: { width: C * (W + 4) + 4, height: rows * (H + 22) + 8 } });
  await p.setContent(html);
  await p.screenshot({ path: out, type: 'jpeg', quality: 80, fullPage: true });
} finally { await b.close(); }
console.log(out, files.length);
