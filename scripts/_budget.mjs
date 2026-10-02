// dev helper (the phone build's budget; docs/decisions/mobile-lite.md "Mobile v3: budget"): load the phone page on an
// emulated iPhone 15 and run a probe in it.
//
//   node scripts/_budget.mjs <out.json> [--init=file.js] [--eval=file.js] [--q=tier=light] [--portrait]
//                            [--url=http://127.0.0.1:5195] [--arg=json]
//
// --init runs before any page code (it may set window.__preMerge, which mobile/town.js calls with the unmerged
// town on a dev server); --eval is an expression (an async IIFE) whose value is written to <out.json>.  With
// neither, the built-in probe: the systems table (triangles, buffers, textures per system before batching) and the
// places table (GPU MB, draws at each stop of the tour).
// One browser at a time on this laptop: /tmp/lawson-browser.lock is taken first (retried every 10 s).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)]; }));
const out = args.find((a) => !a.startsWith('--'));
const here = path.dirname(new URL(import.meta.url).pathname);
const init = fs.readFileSync(flags.init ?? path.join(here, 'budget', 'systems-init.js'), 'utf8');
const probe = fs.readFileSync(flags.eval ?? path.join(here, 'budget', 'places.js'), 'utf8');

const LOCK = '/tmp/lawson-browser.lock';
let mine = false;
for (let i = 0; i < 360 && !mine; i++) { try { fs.mkdirSync(LOCK); mine = true; } catch { await new Promise((r) => setTimeout(r, 10000)); } }
if (!mine) { console.error('browser lock busy'); process.exit(2); }
const unlock = () => { if (mine) { try { fs.rmdirSync(LOCK); } catch { /* gone */ } mine = false; } };
process.on('exit', unlock);
process.on('SIGINT', () => { unlock(); process.exit(130); });
process.on('SIGTERM', () => { unlock(); process.exit(143); });

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const report = {};
const errs = [];
try {
  const vp = flags.portrait ? { width: 393, height: 852 } : { width: 852, height: 393 };
  const ctx = await browser.newContext({
    viewport: vp, deviceScaleFactor: Number(flags.dpr ?? 3), isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript(`window.__budgetArg = ${flags.arg ?? 'null'};\n` + init);
  const t0 = Date.now();
  await page.goto((flags.url ?? 'http://127.0.0.1:5195') + '/m.html?stats' + (flags.q ? '&' + flags.q : ''), { waitUntil: 'domcontentloaded', timeout: 240000 });
  try { await page.waitForFunction(() => document.getElementById('boot')?.classList.contains('ready') && window.__m, null, { timeout: Number(flags.wait ?? 120000) }); } catch (e) { console.error('the page never became ready:', errs.join('\n')); throw e; }
  report.wall = Date.now() - t0;
  report.load = await page.evaluate(() => ({ marks: window.__m.marks, stages: window.__m.diag.stages, tier: window.__m.tier, scale: window.__m.scale, lots: window.__m.world.core.lots.length, timings: window.__timings ?? null }));
  report.systems = await page.evaluate(() => window.__systems ?? null);
  await page.addStyleTag({ content: '#boot, #gate, .scrim, .m-hud, #hachi-card, #hud, .hud { display: none !important; }' });
  report.eval = await page.evaluate(probe);
  await ctx.close();
} finally {
  await browser.close();
  unlock();
}
if (errs.length) report.errors = [...new Set(errs)].slice(0, 12);
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.load), JSON.stringify(report.errors ?? []));
