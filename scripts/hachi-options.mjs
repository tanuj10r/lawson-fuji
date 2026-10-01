/* Three Hachis for the selfie postcard, for Tan to choose from (src/dev/hachiOptions.js): each alone (PNG, alpha, and
 * on a neutral ground) and on the polaroid in the saved picture, and one sheet of all three.  Nothing is shipped.
 *   node scripts/hachi-options.mjs OUT-DIR [--rig REF] [--only AB]
 *   --rig REF   take src/world/animals/shiba.js and shade.js from that git ref (the expressions, aPose3..5, are on
 *               `director-mode` until they reach main); only this render reads them
 * Its own dev server (PORT, default 5187) and one headless Chrome under the browser lock; both closed however it ends. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, '.shots', 'hachi'));
const RIG = arg('--rig'), ONLY = arg('--only');
const PORT = +process.env.PORT || 5187;
fs.mkdirSync(OUT, { recursive: true });
const rigFrom = (ref) => ({
  name: 'rig-from-ref',
  enforce: 'pre',
  load(id) {
    const m = /\/src\/world\/animals\/(shiba|shade)\.js$/.exec(id.split('?')[0]);
    return m ? execFileSync('git', ['show', `${ref}:src/world/animals/${m[1]}.js`], { cwd: ROOT, encoding: 'utf8' }) : null;
  },
});

const LOCK = '/tmp/lawson-browser.lock';
for (;;) { try { fs.mkdirSync(LOCK); break; } catch { console.log('  waiting for the browser lock'); await new Promise((r) => setTimeout(r, 10000)); } }
let server, browser;
const done = async () => {
  await Promise.race([Promise.all([browser?.close(), server?.close()]), new Promise((r) => setTimeout(r, 6000))]).catch(() => {});
  try { fs.rmdirSync(LOCK); } catch {}
};
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await done(); process.exit(130); });
const write = (name, dataUrl) => { const f = path.join(OUT, name); fs.writeFileSync(f, Buffer.from(dataUrl.replace(/^data:[\w/+-]+;base64,/, ''), 'base64')); console.log('  ' + f); };

try {
  server = await createServer({ root: ROOT, logLevel: 'error', plugins: RIG ? [rigFrom(RIG)] : [], server: { port: PORT, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(300000);
  page.on('pageerror', (e) => console.log('  [page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [console]', m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/credits.html`);
  const r = await page.evaluate(async (only) => {
    const { hachiOptions } = await import('/src/dev/hachiOptions.js');
    return hachiOptions(only);
  }, ONLY);
  for (const [k, o] of Object.entries(r)) {
    if (k === 'sheet') { write('hachi-options.jpg', o); continue; }
    write(`hachi-opt-${k}-alpha.png`, o.alpha); write(`hachi-opt-${k}.png`, o.alone); write(`hachi-opt-${k}-postcard.jpg`, o.postcard);
    console.log(`  ${k}: ${o.w}x${o.h}`);
  }
} finally {
  await done();
}
