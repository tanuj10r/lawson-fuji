/* One emulated phone, end to end, against the production build (dist/).
 * Read-only: the game is driven from outside, nothing in it changes.
 *
 *   npm run build
 *   node qa/mobile/run-device.mjs <iphone13|iphone15|pixel7|lowend> [--cpu N] [--heap-min 5] [--no-heap]
 *
 * A  Fast 3G, fresh cache: load marks, bytes before the first tap, the start
 *    card in portrait and landscape, a tap on the card (the engine's own API
 *    surface: pointer lock is present in emulation).
 * B  4G, fresh cache, with requestPointerLock removed (as on iPhone Safari and
 *    Android Chrome): load marks, the same tap (does the game start?), then
 *    the game is started from outside (player.locked, as touch controls
 *    would) and measured: fps at the famous view, the shopping street, inside
 *    the konbini (a still view, then the real scripted visit), HUD
 *    screenshots, then a tour of the town for --heap-min minutes sampling the
 *    JS heap (Chromium) and the browser's process memory (both engines).
 *
 * CPU throttling is Chromium-only (CDP); WebKit runs at the host's speed.
 * Network throttling is qa/mobile/throttle-server.mjs for both engines.
 * One browser at a time; closed (and the server stopped) on exit or signal.
 */
import { chromium, webkit, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { serve } from './throttle-server.mjs';

const key = process.argv[2];
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes(`--${k}`);
const ART = new URL('./artifacts/', import.meta.url).pathname;
const INSTRUMENT = new URL('./instrument.js', import.meta.url).pathname;

const DEVICES = {
  iphone13: { label: 'iPhone 13', engine: 'webkit', desc: devices['iPhone 13'], land: devices['iPhone 13 landscape'].viewport, cpu: 1 },
  iphone15: { label: 'iPhone 15', engine: 'webkit', desc: devices['iPhone 15'], land: devices['iPhone 15 landscape'].viewport, cpu: 1 },
  pixel7: { label: 'Pixel 7', engine: 'chromium', desc: devices['Pixel 7'], land: devices['Pixel 7 landscape'].viewport, cpu: 4 },
  // Lighthouse's classic low-end reference (Moto G4: 360x640, DPR 3), 6x CPU
  lowend: { label: 'Low-end Android (Moto G4 profile)', engine: 'chromium', desc: devices['Moto G4'], land: devices['Moto G4 landscape'].viewport, cpu: 6 },
};
const D = DEVICES[key];
if (!D) { console.error('device?', Object.keys(DEVICES).join('|')); process.exit(2); }
const CPU = +arg('cpu', D.cpu);
const HEAP_MIN = flag('no-heap') ? 0 : +arg('heap-min', 5);
const LOAD_ONLY = arg('load-only', null);               // a link profile: measure one load and stop
const LOAD_CAP_MS = +arg('load-cap-min', 12) * 60000;
const tag = `${key}${CPU !== D.cpu ? '-cpu' + CPU : ''}${LOAD_ONLY ? '-load-' + LOAD_ONLY : ''}`;
const out = { device: D.label, engine: D.engine, cpu: D.engine === 'chromium' ? CPU : 'n/a (WebKit: no CPU throttling in Playwright)', viewport: D.desc.viewport, dpr: D.desc.deviceScaleFactor, started: new Date().toISOString() };
const save = () => fs.writeFileSync(`${ART}run-${tag}.json`, JSON.stringify(out, null, 1));
const log = (...a) => console.log(`[${tag}]`, ...a);

const server = await serve({ port: 5181, profile: 'none' });
let browser = null;
const cleanup = async () => { await browser?.close().catch(() => {}); browser = null; await server.close().catch(() => {}); };
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, async () => { await cleanup(); process.exit(130); });

const launch = () => D.engine === 'webkit'
  ? webkit.launch({ headless: true })
  : chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--autoplay-policy=user-gesture-required'] });

/** Memory of every process of the browser under test (RSS, MB): a proxy, GPU memory on macOS is only partly in RSS. */
function procMem() {
  try {
    const ps = execFileSync('ps', ['-Ao', 'pid=,ppid=,rss=,command='], { encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n').map((l) => l.trim()).filter(Boolean);
    // this run's browser only: Chromium by the profile directory of the browser this node process launched
    // (other sessions on this Mac run Playwright Chrome too); WebKit's helpers are XPC services, matched by path
    let mine;
    if (D.engine === 'webkit') mine = ps.filter((l) => /ms-playwright\/webkit/.test(l));
    else {
      const main = ps.find((l) => +l.split(/\s+/)[1] === process.pid && /user-data-dir=/.test(l));
      const dir = main && /user-data-dir=(\S+)/.exec(main)[1];
      mine = dir ? ps.filter((l) => l.includes(dir)) : [];
    }
    const rss = mine.map((l) => [parseInt(l.split(/\s+/)[2], 10) / 1024, l]);
    const total = rss.reduce((a, [r]) => a + r, 0);
    const top = rss.sort((a, b) => b[0] - a[0])[0];
    const kind = (l) => /WebContent|WebProcess/.test(l) ? 'web content' : /--type=renderer/.test(l) ? 'renderer' : /--type=gpu/.test(l) ? 'gpu' : /GPU/.test(l) ? 'gpu' : 'other';
    return { totalMB: Math.round(total), topMB: Math.round(top?.[0] ?? 0), topKind: top ? kind(top[1]) : null, procs: mine.length, load1: +os.loadavg()[0].toFixed(1) };
  } catch { return null; }
}

async function newPage({ phoneApis }) {
  const ctx = await browser.newContext({ ...D.desc });
  if (phoneApis) await ctx.addInitScript('window.__QA_PHONE_APIS = true');
  await ctx.addInitScript({ path: INSTRUMENT });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
  page.on('crash', () => errors.push('PAGE CRASHED'));
  if (D.engine === 'chromium' && CPU > 1) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  }
  return { ctx, page, errors };
}

/** Load the build on a link profile and wait for the first frame with Fuji in it. */
async function load(page, profile) {
  server.setProfile(profile);
  const n0 = server.bytesLog.length;
  const t0 = Date.now();
  await page.goto(server.url, { waitUntil: 'domcontentloaded', timeout: LOAD_CAP_MS });
  // progress every 15 s: the marks so far and the bytes sent (a page stuck in one long task answers late)
  let ok = false;
  while (Date.now() - t0 < LOAD_CAP_MS) {
    const m = await Promise.race([page.evaluate(() => window.__qa?.marks), new Promise((r) => setTimeout(() => r('busy'), 15000))]);
    const sent = Math.round(server.bytesLog.slice(n0).reduce((a, b) => a + b.bytes, 0) / 1024);
    if (m && m !== 'busy' && m.fujiFrame) { ok = true; break; }
    log(`  ${profile} ${Math.round((Date.now() - t0) / 1000)} s: marks ${JSON.stringify(m)}, ${sent} KB sent`);
    await new Promise((r) => setTimeout(r, m === 'busy' ? 0 : 15000));
  }
  const wall = Date.now() - t0;
  const r = await page.evaluate(() => {
    const q = window.__qa;
    const lt = q.longTasks;
    const btn = document.querySelector('.menu-action')?.getBoundingClientRect();
    const menu = document.querySelector('.menu')?.getBoundingClientRect();
    return {
      marks: q.marks, longTasks: lt.length, longestTaskMs: lt.length ? Math.max(...lt.map((l) => l[1])) : null, blockedMs: lt.reduce((a, l) => a + l[1], 0),
      heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
      pipeline: window.__scene ? [window.__scene.pipeline.size.x, window.__scene.pipeline.size.y] : null,
      startButton: btn && { x: Math.round(btn.x), y: Math.round(btn.y), w: Math.round(btn.width), h: Math.round(btn.height) },
      card: menu && { x: Math.round(menu.x), y: Math.round(menu.y), w: Math.round(menu.width), h: Math.round(menu.height) },
      viewport: [innerWidth, innerHeight],
      startVisible: !!btn && btn.x >= 0 && btn.y >= 0 && btn.right <= innerWidth && btn.bottom <= innerHeight,
    };
  });
  const bytes = server.bytesLog.slice(n0).reduce((a, b) => a + b.bytes, 0);
  return { profile, ok, wallMs: wall, bytesBeforeTapKB: Math.round(bytes / 1024), hostLoad1: +os.loadavg()[0].toFixed(1), ...r };
}

async function shot(page, name) {
  const file = `${ART}${tag}-${name}.jpg`;
  await page.screenshot({ path: file, type: 'jpeg', quality: 72, scale: 'css', timeout: 120000 }).catch((e) => log('screenshot failed', name, e.message));
  return file.replace(ART, 'qa/mobile/artifacts/');
}

/** Tap the middle of the start card, as a thumb would; what happened? */
async function tapStart(page, server) {
  const n0 = server.bytesLog.length;
  const [w, h] = await page.evaluate(() => [innerWidth, innerHeight]);
  await page.touchscreen.tap(Math.round(w / 2), Math.round(h / 2));
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => ({
    pointerLockApi: typeof Element.prototype.requestPointerLock,
    locked: window.__scene.player.locked,
    cardHidden: document.querySelector('.overlay').classList.contains('hidden'),
    audioContexts: window.__qa.acState(),
    mediaPlays: window.__qa.plays.map((p) => `${p.src}: ${p.result}`),
  }));
  r.audioKBAfter4s = Math.round(server.bytesLog.slice(n0).reduce((a, b) => a + b.bytes, 0) / 1024);
  return r;
}

/** Frames over `sec` seconds of the live loop: fps and frame-time percentiles. */
async function fps(page, sec) {
  await page.evaluate(() => { window.__qa.frames = []; });
  await page.waitForTimeout(sec * 1000);
  const hostLoad1 = +os.loadavg()[0].toFixed(1);
  return { hostLoad1, ...(await page.evaluate(() => {
    const f = window.__qa.frames; window.__qa.frames = null;
    const d = []; for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
    d.sort((a, b) => a - b);
    const pc = (p) => d.length ? +d[Math.min(d.length - 1, Math.floor(p * d.length))].toFixed(1) : null;
    const span = f.length > 1 ? (f[f.length - 1] - f[0]) / 1000 : 0;
    return { fps: span ? +((f.length - 1) / span).toFixed(1) : 0, p50ms: pc(0.5), p95ms: pc(0.95), worstMs: d.length ? +d[d.length - 1].toFixed(0) : null, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null };
  })) };
}

/** Stand somewhere (world coordinates, config SHOT_SPOTS), in a look. */
const standAt = (page, s) => page.evaluate((s) => {
  const { player, world, enterHero, applyLook } = window.__scene;
  if (s.hero) { enterHero(s.hero); player.suspended = true; return; }
  enterHero('morning');                // the day look, the famous-view state cleared below
  if (s.look) applyLook(s.look);
  player.pos.set(s.pos[0], world.heightAt(s.pos[0], s.pos[2]), s.pos[2]);
  player.vel.set(0, 0, 0);
  player.yaw = s.yaw; player.pitch = s.pitch ?? 0;
  player.applyCamera(0);
  player.suspended = true;             // held still: Hachi's hello would otherwise turn the view toward the pup
}, s);

const VIEWS = [
  ['famous view', { hero: 'morning' }],
  ['shopping street', { pos: [-46.2, 0, 23.5], yaw: 3.1416, pitch: 0.03 }],
  ['inside the konbini (still)', { pos: [-2.1, 0, -3.0], yaw: 0, pitch: -0.12 }],
];
const TOUR = [
  ['famous view', { hero: 'morning' }],
  ['spine north', { pos: [-46.2, 0, 23.5], yaw: 3.1416, pitch: 0.03 }],
  ['spine shops', { pos: [-46.6, 0, 62], yaw: 2.2, pitch: 0.02 }],
  ['station plaza', { pos: [-50, 0, 125.5], yaw: 3.1416, pitch: 0.05 }],
  ['platform, train', { pos: [-28, 0, 166.8], yaw: 1.2, pitch: 0.03 }],
  ['level crossing', { pos: [-80.6, 0, 150], yaw: 3.1416, pitch: 0.03 }],
  ['shrine tunnel', { pos: [13, 0, 88.2], yaw: 3.1416, pitch: 0.05 }],
  ['lane houses', { pos: [52, 0, 79.4], yaw: 1.5708, pitch: 0.04 }],
  ['paddies (mirror)', { pos: [49, 0, 45], yaw: -1.5708, pitch: -0.04 }],
  ['main road east', { pos: [96, 0, 18.8], yaw: 1.5708, pitch: 0.03 }],
  ['junction walk', { pos: [-20, 0, 21.5], yaw: 1.3, pitch: -0.15 }],
  ['Deer Park gate', { pos: [30, 0, -35.5], yaw: 0, pitch: 0.04 }],
  ['main road west', { pos: [-72, 0, 18.8], yaw: -1.5708, pitch: 0.03 }],
  ['konbini forecourt', { pos: [3.0, 0, 9.5], yaw: 0.35, pitch: 0.02 }],
  ['famous view again', { hero: 'morning' }],
];

try {
  browser = await launch();
  out.browserVersion = browser.version();
  log(D.label, D.engine, browser.version(), 'cpu', CPU);

  if (LOAD_ONLY) {
    const { ctx, page, errors } = await newPage({ phoneApis: true });
    out.load = await load(page, LOAD_ONLY);
    out.load.procMem = procMem();
    out.load.errors = errors.slice(0, 8);
    log('load', JSON.stringify(out.load));
    save();
    await ctx.close();
  }
  /* ---------- A: Fast 3G ---------- */
  if (!LOAD_ONLY) {
    const { ctx, page, errors } = await newPage({ phoneApis: false });
    out.fast3g = await load(page, 'fast3g');
    out.fast3g.procMem = procMem();
    log('fast3g', JSON.stringify(out.fast3g));
    out.shots = { startPortrait: await shot(page, 'start-portrait') };
    await page.setViewportSize(D.land);
    await page.waitForTimeout(2500);
    out.fast3g.landscape = await page.evaluate(() => {
      const b = document.querySelector('.menu-action').getBoundingClientRect();
      return { viewport: [innerWidth, innerHeight], startButton: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }, startVisible: b.x >= 0 && b.y >= 0 && b.right <= innerWidth && b.bottom <= innerHeight };
    });
    out.shots.startLandscape = await shot(page, 'start-landscape');
    await page.setViewportSize(D.desc.viewport);
    await page.waitForTimeout(1500);
    server.setProfile('fast3g');
    out.fast3g.tap = await tapStart(page, server);
    log('tap (emulation API surface)', JSON.stringify(out.fast3g.tap));
    out.fast3g.errors = errors.slice(0, 8);
    save();
    await ctx.close();
  }

  /* ---------- B: 4G, phone API surface ---------- */
  if (!LOAD_ONLY) {
    const { ctx, page, errors } = await newPage({ phoneApis: true });
    out.g4 = await load(page, '4g');
    log('4g', JSON.stringify(out.g4));
    out.g4.tap = await tapStart(page, server);
    log('tap (phone API surface: no pointer lock)', JSON.stringify(out.g4.tap));
    out.shots.afterTapPortrait = await shot(page, 'after-tap-portrait');
    save();

    // started from outside, as touch controls would (no pointer lock on phones)
    await page.evaluate(() => { const s = window.__scene; s.player.locked = true; s.hud.setLocked(true); });
    out.views = {};
    for (const [name, s] of VIEWS) {
      await standAt(page, s);
      await page.waitForTimeout(3000);
      out.views[name] = await fps(page, 8);
      log('view', name, JSON.stringify(out.views[name]));
      if (name === 'famous view') out.shots.playFamousPortrait = await shot(page, 'play-famous-portrait');
      if (name === 'shopping street') out.shots.playStreetPortrait = await shot(page, 'play-street-portrait');
    }
    // the konbini for real: stand on its spot (the choice card), then the scripted visit
    await standAt(page, { pos: [-2.3, 0, 2.3], yaw: 0, pitch: -0.05 });
    await page.waitForTimeout(2500);
    out.shots.konbiniMenuPortrait = await shot(page, 'konbini-menu-portrait');
    const played = await page.evaluate(() => { const shop = window.__scene.world.lawson.shop; return shop.play(shop.menu[0]); });
    out.views['konbini visit (scripted, 30 s)'] = played ? await fps(page, 30) : { skipped: 'play() refused' };
    log('konbini visit', JSON.stringify(out.views['konbini visit (scripted, 30 s)']));
    await page.waitForTimeout(20000);                     // let the visit finish
    // HUD in landscape, and the full map
    await page.setViewportSize(D.land);
    await standAt(page, { pos: [-46.2, 0, 23.5], yaw: 3.1416, pitch: 0.03 });
    await page.waitForTimeout(3000);
    out.shots.playStreetLandscape = await shot(page, 'play-street-landscape');
    out.views['shopping street (landscape)'] = await fps(page, 6);
    // (the full map is not shot: M is ignored while the konbini scene runs, and on the slow
    // profiles the scene is still running here, as slow frames play it in slow motion)
    await page.setViewportSize(D.desc.viewport);
    await page.waitForTimeout(1500);
    save();

    /* ---------- the town tour: memory over time ---------- */
    if (HEAP_MIN > 0) {
      const per = (HEAP_MIN * 60) / TOUR.length;
      out.tour = [];
      const t0 = Date.now();
      for (const [name, s] of TOUR) {
        await standAt(page, s);
        const f = await fps(page, Math.max(4, per - 1.5));
        const row = { t: Math.round((Date.now() - t0) / 1000), stop: name, ...f, proc: procMem() };
        out.tour.push(row);
        log('tour', JSON.stringify(row));
        save();
      }
    }
    out.g4.errors = errors.slice(0, 8);
    out.finished = new Date().toISOString();
    save();
    await ctx.close();
  }
} catch (e) {
  out.error = String(e?.stack ?? e);
  log('ERROR', out.error);
  save();
} finally {
  await cleanup();
}
