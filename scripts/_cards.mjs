/* The start and pause cards at the desktop sizes (Tan, 2026-09-28): a page
 * screenshot of the DOM over the live game, both modes, into .shots/cards/.
 * Also checks the two cards list the same keys and that nothing overflows.
 *
 *   node scripts/_cards.mjs                 1280x720 1440x900 1920x1080 2560x1440
 *   node scripts/_cards.mjs 1280x720        only these
 *
 * Its own dev server and headless Chrome, on the shots lock; both closed. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sizes = (process.argv.slice(2).filter((a) => /^\d+x\d+$/.test(a)).length
  ? process.argv.slice(2).filter((a) => /^\d+x\d+$/.test(a))
  : ['1280x720', '1440x900', '1920x1080', '2560x1440']).map((s) => s.split('x').map(Number));
const OUT = path.join(ROOT, '.shots', 'cards');
fs.mkdirSync(OUT, { recursive: true });

const LOCK = path.join(os.tmpdir(), 'takemebacktojapan-shots.lock');
for (;;) {
  try { fs.mkdirSync(LOCK); fs.writeFileSync(path.join(LOCK, 'pid'), String(process.pid)); break; } catch {
    let pid = 0;
    try { pid = +fs.readFileSync(path.join(LOCK, 'pid'), 'utf8'); } catch {}
    let alive = false;
    try { if (pid) { process.kill(pid, 0); alive = true; } } catch {}
    if (!alive) { fs.rmSync(LOCK, { recursive: true, force: true }); continue; }
    console.log(`  waiting for another shots run (pid ${pid})`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
process.on('exit', () => { try { if (+fs.readFileSync(path.join(LOCK, 'pid'), 'utf8') === process.pid) fs.rmSync(LOCK, { recursive: true, force: true }); } catch {} });

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5192, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const base = server.resolvedUrls.local[0];
const launchArgs = ['--use-angle=metal', '--ignore-gpu-blocklist'];
let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: true, args: launchArgs }); } catch { browser = await chromium.launch({ headless: true, args: launchArgs }); }
const done = () => Promise.race([Promise.all([browser.close(), server.close()]), new Promise((r) => setTimeout(r, 5000))]).catch(() => {});
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await done(); process.exit(130); });

let bad = 0;
const check = (name, ok, info) => { if (!ok) bad++; console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${ok ? '' : '  ' + JSON.stringify(info)}`); };
try {
  const page = await browser.newPage({ viewport: { width: sizes[0][0], height: sizes[0][1] } });
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => console.log('  [page error]', e.message));
  await page.goto(base);
  await page.waitForFunction(() => window.__ready === true && document.querySelector('.menu-art img')?.complete, null, { timeout: 180000, polling: 250 });
  const info = await page.evaluate(() => ({
    lang: document.documentElement.lang, translate: document.documentElement.getAttribute('translate'),
    title: document.title, jpMarked: [...document.querySelectorAll('.menu [lang=ja]')].map((n) => n.textContent),
  }));
  check('page is English, not translated', info.lang === 'en' && info.translate === 'no', info);
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    for (const mode of ['start', 'paused']) {
      await page.evaluate((m) => {
        const { hud } = window.__scene;
        if (m === 'paused') { hud.setLocked(true); hud.setLocked(false); }
        document.querySelector('.overlay').dataset.mode = m;
        document.querySelector('.overlay').classList.remove('hidden');
      }, mode);
      await page.waitForTimeout(700);
      const m = await page.evaluate(() => {
        const r = document.querySelector('.menu').getBoundingClientRect();
        const keys = [...document.querySelectorAll('.menu-keys li')].map((li) => li.textContent.trim());
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vw: innerWidth, vh: innerHeight, keys,
          over: [...document.querySelectorAll('.menu *')].filter((n) => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflow !== 'visible').length };
      });
      check(`${w}x${h} ${mode}: fits the window`, m.top >= 0 && m.bottom <= m.vh && m.left >= 0 && m.right <= m.vw, m);
      const file = path.join(OUT, `${mode}-${w}x${h}.png`);
      await page.screenshot({ path: file });
      console.log(`  ${path.relative(ROOT, file)}  card ${Math.round(m.right - m.left)}x${Math.round(m.bottom - m.top)}  keys: ${m.keys.join(' | ')}`);
    }
  }
} finally {
  await done();
}
console.log(bad ? `${bad} FAILED` : 'all passed');
process.exitCode = bad ? 1 : 0;
