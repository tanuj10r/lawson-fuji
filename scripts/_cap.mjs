// dev helper: capture named views to the scratchpad (M2e review)
import { chromium } from 'playwright';
import fs from 'node:fs';
const [out, json] = process.argv.slice(2);
const shots = JSON.parse(json);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://localhost:5178/?shots', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
for (const [name, o] of Object.entries(shots)) {
  const r = await page.evaluate(([n, o]) => window.__shot(n, 1600, 900, { png: true, returnData: true, ...o }), [name, o]);
  fs.writeFileSync(`${out}/${name}.png`, Buffer.from(r.data.split(',')[1], 'base64'));
}
if (errs.length) console.log('PAGE ERRORS', errs);
await browser.close();
