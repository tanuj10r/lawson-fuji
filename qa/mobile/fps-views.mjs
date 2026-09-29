/* Frame rate of the live game loop at the busiest views, on an emulated phone
 * (production build, landscape, the phone API surface: no pointer lock).
 * The game is started from outside (player.locked, as touch controls would)
 * and the player held still (`suspended`, so Hachi's hello does not turn the
 * view away).  Each view: 3 windows of 4 s; the best and the median are kept,
 * because this Mac is shared and other sessions' load comes and goes.
 *
 *   npm run build && node qa/mobile/fps-views.mjs <iphone13|iphone15|pixel7|lowend|desktop> [--cpu N]
 */
import { chromium, webkit, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import { serve } from './throttle-server.mjs';

const key = process.argv[2];
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const ART = new URL('./artifacts/', import.meta.url).pathname;
const INSTRUMENT = new URL('./instrument.js', import.meta.url).pathname;
const DEVICES = {
  iphone13: { label: 'iPhone 13', engine: 'webkit', desc: { ...devices['iPhone 13'], viewport: devices['iPhone 13 landscape'].viewport }, cpu: 1 },
  iphone15: { label: 'iPhone 15', engine: 'webkit', desc: { ...devices['iPhone 15'], viewport: devices['iPhone 15 landscape'].viewport }, cpu: 1 },
  pixel7: { label: 'Pixel 7', engine: 'chromium', desc: { ...devices['Pixel 7'], viewport: devices['Pixel 7 landscape'].viewport }, cpu: 4 },
  lowend: { label: 'Low-end Android (Moto G4 profile)', engine: 'chromium', desc: { ...devices['Moto G4'], viewport: devices['Moto G4 landscape'].viewport }, cpu: 6 },
  desktop: { label: 'Desktop reference (1280x720, DPR 1)', engine: 'chromium', desc: { viewport: { width: 1280, height: 720 } }, cpu: 1 },
};
const D = DEVICES[key];
if (!D) { console.error('device?', Object.keys(DEVICES).join('|')); process.exit(2); }
const CPU = +arg('cpu', D.cpu);
const tag = `fps-${key}${CPU !== D.cpu ? '-cpu' + CPU : ''}`;
const log = (...a) => console.log(`[${tag}]`, ...a);

const VIEWS = [
  ['famous view', { hero: 'morning' }],
  ['shopping street', { pos: [-46.2, 0, 23.5], yaw: 3.1416, pitch: 0.03 }],
  ['inside the konbini', { pos: [-2.1, 0, -3.0], yaw: 0, pitch: -0.12 }],
  ['paddies (mirror)', { pos: [49, 0, 45], yaw: -1.5708, pitch: -0.04, look: 'golden' }],
  ['platform, train in', { pos: [-28, 0, 166.8], yaw: 1.2, pitch: 0.03 }],
];

const server = await serve({ port: 5181, profile: 'none' });
let browser = null;
const cleanup = async () => { await browser?.close().catch(() => {}); browser = null; await server.close().catch(() => {}); };
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, async () => { await cleanup(); process.exit(130); });
const out = { device: D.label, engine: D.engine, cpu: D.engine === 'chromium' ? CPU : 'n/a (WebKit)', viewport: D.desc.viewport, dpr: D.desc.deviceScaleFactor ?? 1, views: {} };
try {
  browser = D.engine === 'webkit' ? await webkit.launch({ headless: true })
    : await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
  const ctx = await browser.newContext({ ...D.desc });
  await ctx.addInitScript('window.__QA_PHONE_APIS = true');
  await ctx.addInitScript({ path: INSTRUMENT });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
  if (D.engine === 'chromium' && CPU > 1) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  }
  await page.goto(server.url, { waitUntil: 'domcontentloaded', timeout: 600000 });
  await page.waitForFunction(() => window.__qa?.marks.fujiFrame, null, { timeout: 900000, polling: 1000 });
  out.marks = await page.evaluate(() => window.__qa.marks);
  out.pipeline = await page.evaluate(() => [window.__scene.pipeline.size.x, window.__scene.pipeline.size.y]);
  log('loaded', JSON.stringify(out.marks), 'internal', out.pipeline.join('x'));
  await page.evaluate(() => { const s = window.__scene; s.player.locked = true; s.hud.setLocked(true); s.player.suspended = true; });

  const windowFps = async (sec) => {
    await page.evaluate(() => { window.__qa.frames = []; });
    await page.waitForTimeout(sec * 1000);
    const r = await page.evaluate(() => {
      const f = window.__qa.frames; window.__qa.frames = null;
      const d = []; for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
      d.sort((a, b) => a - b);
      const span = f.length > 1 ? (f[f.length - 1] - f[0]) / 1000 : 0;
      return { fps: span ? +((f.length - 1) / span).toFixed(1) : 0, p95ms: d.length ? +d[Math.floor(0.95 * (d.length - 1))].toFixed(0) : null };
    });
    return { ...r, load1: +os.loadavg()[0].toFixed(1) };
  };
  for (const [name, s] of VIEWS) {
    await page.evaluate((s) => {
      const { player, world, enterHero, applyLook } = window.__scene;
      enterHero('morning');
      if (!s.hero) {
        if (s.look) applyLook(s.look);
        player.pos.set(s.pos[0], world.heightAt(s.pos[0], s.pos[2]), s.pos[2]);
        player.vel.set(0, 0, 0); player.yaw = s.yaw; player.pitch = s.pitch; player.applyCamera(0);
      }
      player.suspended = true;
    }, s);
    await page.waitForTimeout(2500);
    const w = [];
    for (let i = 0; i < 3; i++) w.push(await windowFps(4));
    const sorted = [...w].sort((a, b) => b.fps - a.fps);
    out.views[name] = { best: sorted[0].fps, median: sorted[1].fps, p95msAtBest: sorted[0].p95ms, windows: w };
    log(name, JSON.stringify(out.views[name]));
    await page.screenshot({ path: `${ART}${tag}-${name.replace(/[^a-z]+/g, '-')}.jpg`, type: 'jpeg', quality: 70, scale: 'css' }).catch(() => {});
  }
  // the konbini's real scene: stand on its spot, pick the first item, 20 s of the visit
  await page.evaluate(() => {
    const { player, world, enterHero } = window.__scene;
    enterHero('morning'); player.suspended = false;
    player.pos.set(-2.3, world.heightAt(-2.3, 2.3), 2.3); player.yaw = 0; player.pitch = -0.05; player.applyCamera(0);
  });
  await page.waitForTimeout(2500);
  const played = await page.evaluate(() => { const shop = window.__scene.world.lawson.shop; return shop.play(shop.menu[0]); });
  if (played) {
    await page.waitForTimeout(3000);
    const w = [];
    for (let i = 0; i < 4; i++) w.push(await windowFps(4));
    const sorted = [...w].sort((a, b) => b.fps - a.fps);
    out.views['konbini visit (scripted)'] = { best: sorted[0].fps, median: sorted[2].fps, windows: w };
    log('konbini visit', JSON.stringify(out.views['konbini visit (scripted)']));
  }
  out.heapMB = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
  out.errors = errors.slice(0, 6);
  fs.writeFileSync(`${ART}${tag}.json`, JSON.stringify(out, null, 1));
  await ctx.close();
} catch (e) {
  out.error = String(e?.stack ?? e);
  log('ERROR', out.error);
  fs.writeFileSync(`${ART}${tag}.json`, JSON.stringify(out, null, 1));
} finally {
  await cleanup();
}
