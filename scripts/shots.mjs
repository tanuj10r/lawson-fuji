/* The render-check loop (SPEC section 12, M2 working method).
 *
 * Runs the dev build in headless Chrome, visits every named camera spot in
 * src/config.js SHOT_SPOTS at each of its looks, and saves lossless frames to
 * screenshots/<date>/.  For spots with a reference frame it also saves
 * <spot>-vs-ref.jpg (ours left, reference/density/ right).  Heroes 1/2/3 are
 * diffed against screenshots/baseline/ so a change that moves the famous view
 * shows up at once.  Draw calls, triangles and frame time go to stats.json.
 *
 *   npm run shots                        every spot
 *   npm run shots -- --spots kit,hero-1  names or name prefixes
 *   npm run shots -- --looks day         only these looks
 *   npm run shots -- --baseline          (re)save the hero baseline
 *   npm run shots -- --no-time           skip the frame-time pass
 *   npm run shots -- --no-density        skip the density and bare-stretch checks
 *   npm run shots -- --no-train          skip the train-service check
 *   npm run shots -- --quick             frames and the hero guard only
 *   npm run shots -- --size 1280x720 --scale 1   light run (a quarter of the pixels; no guard)
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { SHOT_SPOTS } from '../src/config.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const flag = (k) => args.includes(`--${k}`);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const [W, H] = opt('size', '1920x1080').split('x').map(Number);
const SCALE = +opt('scale', '2');
const fullSize = W === 1920 && H === 1080 && SCALE === 2;   // the hero guard's baseline size   // render scale before FXAA; 1 for light work-in-progress runs
const onlySpots = opt('spots', '').split(',').filter(Boolean);
const onlyLooks = opt('looks', '').split(',').filter(Boolean);
const baseline = flag('baseline');
const quick = flag('quick');   // frames only: no timing, density or train checks
const timeIt = !flag('no-time') && !quick;
const densityIt = !flag('no-density') && !quick;
const trainIt = !flag('no-train') && !quick;
const GUARD_LIMIT = 0.5;   // % of hero pixels allowed to change

const d = new Date();
const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const outDir = path.join(ROOT, 'screenshots', day);
const baseDir = path.join(ROOT, 'screenshots', 'baseline');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(baseDir, { recursive: true });

let spots = SHOT_SPOTS.filter((s) =>
  !onlySpots.length || onlySpots.some((k) => s.name === k || s.name.startsWith(k)));
if (baseline) spots = SHOT_SPOTS.filter((s) => s.guard);

const writeData = (file, dataUrl) =>
  fs.writeFileSync(file, Buffer.from(dataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
const readData = (file) =>
  `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;

/* One run at a time on this machine (parallel agents share it): a lock
 * directory holding the owner's pid; a lock whose owner is gone is stale. */
const LOCK = path.join(os.tmpdir(), 'lawson-fuji-shots.lock');
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
const unlock = () => { try { if (+fs.readFileSync(path.join(LOCK, 'pid'), 'utf8') === process.pid) fs.rmSync(LOCK, { recursive: true, force: true }); } catch {} };
process.on('exit', unlock);

const server = await createServer({
  root: ROOT,
  logLevel: 'error',
  server: { port: 5190, strictPort: false, host: '127.0.0.1' },
});
await server.listen();
const base = server.resolvedUrls.local[0];

/* The system Chrome, so the GPU is the real one (Metal on macOS); the
 * Playwright build is the fallback. */
const launchArgs = ['--use-angle=metal', '--ignore-gpu-blocklist'];   // (GPU rasterization hung toDataURL after the first shot)
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: launchArgs });
} catch {
  browser = await chromium.launch({ headless: true, args: launchArgs });
}
const page = await browser.newPage({ viewport: { width: W, height: H } });
// this run starts its own dev server, which compiles cold: on a machine short
// of memory a page can take well over the default 30 s to load
page.setDefaultNavigationTimeout(180000);
// stopped from outside: close Chrome and the dev server, never leave them behind
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, async () => {
    await Promise.race([Promise.all([browser.close(), server.close()]), new Promise((r) => setTimeout(r, 5000))]).catch(() => {});
    process.exit(130);
  });
}
page.on('console', (m) => { if (m.type() === 'error') console.log('  [page]', m.text()); });
page.on('pageerror', (e) => console.log('  [page error]', e.message));

const stats = {};
const guards = [];
const densityRows = [];
let bare = null;
let scene = null;

for (const spot of spots) {
  if (spot.scene !== scene) {
    scene = spot.scene;
    // a page error before the scene is ready ends the run at once
    let onError;
    const crashed = new Promise((_, reject) => { onError = (e) => reject(e); page.on('pageerror', onError); });
    const tl = Date.now();
    await page.goto(`${base}?shots${scene === 'kit' ? '&kit' : ''}`);
    await Promise.race([page.waitForFunction(() => window.__ready === true, null, { timeout: 120000, polling: 250 }), crashed]);
    page.off('pageerror', onError);
    crashed.catch(() => {});
    const gpu = await page.evaluate(() => {
      const gl = window.__scene.renderer.getContext();
      const e = gl.getExtension('WEBGL_debug_renderer_info');
      return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown';
    });
    console.log(`scene ${scene}  (${gpu}), ready in ${((Date.now() - tl) / 1000).toFixed(0)} s`);
    const fonts = await page.evaluate(() => ['NF Round', 'NF Brush'].map((f) => `${f} ${document.fonts.check(`16px '${f}'`, '富') ? 'ok' : 'MISSING'}`).join(', '));
    console.log(`  fonts: ${fonts}`);
    // the store's stock (M3d): how many products, never more than CAP of one
    if (scene === 'town') stats._stock = await page.evaluate(() => window.__store?.shop?.stats ?? null);
  }
  const looks = spot.looks.filter((l) => !onlyLooks.length || onlyLooks.includes(l));
  for (const look of looks) {
    const name = spot.looks.length > 1 ? `${spot.name}-${look}` : spot.name;
    const opts = {
      hero: spot.hero, look, pos: spot.pos, yaw: spot.yaw, pitch: spot.pitch, lift: spot.lift, train: spot.train, frame: spot.frame, guide: spot.guide,
      png: true, scale: SCALE, returnData: true,
    };
    const t0 = Date.now();
    const r = await page.evaluate(([n, w, h, o]) => window.__shot(n, w, h, o), [name, W, H, opts]);
    if (flag('verbose')) console.log(`  (${name} rendered in ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    const file = path.join(baseline ? baseDir : outDir, `${name}.png`);
    writeData(file, r.data);
    const row = { calls: r.calls, triangles: r.triangles, mainCalls: r.mainCalls, mainTriangles: r.mainTriangles };

    if (timeIt && !baseline) {
      // SPEC section 11: 60 fps at 1440p
      const t = await page.evaluate(([n, o]) => window.__shot(n, 2560, 1440, o),
        [name, { ...opts, returnData: false, png: false, scale: 1.5, time: 30 }]);
      row.ms = +t.ms.toFixed(2);
      row.internal = t.internal;
    }

    if (spot.guard && !baseline && fullSize) {
      const bfile = path.join(baseDir, `${name}.png`);
      if (fs.existsSync(bfile)) {
        const { pct, mask } = await page.evaluate(diffImages, [r.data, readData(bfile)]);
        row.heroDiff = +pct.toFixed(3);
        if (pct > 0) writeData(path.join(outDir, `${name}-diff.png`), mask);
        guards.push([name, pct]);
      } else {
        guards.push([name, null]);
      }
    }

    if (spot.ref && !baseline) {
      const pair = await page.evaluate(sideBySide, [r.data, `/reference/density/${spot.ref}`]);
      writeData(path.join(outDir, `${name}-vs-ref.jpg`), pair);
    }
    // the density budget, from every street-level town spot (not heroes or overviews)
    if (densityIt && spot.scene === 'town' && !spot.hero && !spot.lift && !spot.close && !baseline) {
      const dens = await page.evaluate((sp) => window.__density(sp),
        { x: spot.pos[0], z: spot.pos[2], yaw: spot.yaw, indoor: spot.indoor });
      if (dens?.spot) {
        row.density = dens.spot;
        densityRows.push([name, dens.spot]);
      }
    }
    stats[name] = row;
    const bits = [`calls ${row.calls} (main ${row.mainCalls})`, `tris ${Math.round(row.triangles / 1000)}k (main ${Math.round(row.mainTriangles / 1000)}k)`];
    if (row.ms !== undefined) bits.push(`${row.ms} ms @1440p`);
    if (row.heroDiff !== undefined) bits.push(`hero diff ${row.heroDiff}%`);
    console.log(`  ${name.padEnd(26)} ${bits.join('  ')}`);
  }
}

if (densityIt && !baseline && densityRows.length) {
  // town-wide bare stretches, once
  await page.goto(`${base}?shots`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000, polling: 250 });
  bare = (await page.evaluate(() => window.__density()))?.bare ?? null;
  stats._bare = bare;
}
// the train service (M2c): dwell, headway, and the crossing against the trains
if (trainIt && !baseline && spots.some((s) => s.scene === 'town')) {
  await page.goto(`${base}?traincheck`);
  await page.waitForFunction(() => window.__traincheck, null, { timeout: 120000, polling: 500 });
  const tc = await page.evaluate(() => window.__traincheck);
  stats._traincheck = tc;
  const dw = tc.dwell, hw = tc.headway.map((h) => h.s);
  const alt = tc.headway.every((h) => h.from !== h.to);
  const okDwell = dw.length && dw.every((d) => Math.abs(d - 60) <= 1);
  const okOrder = tc.order.length && tc.order.every((o) => o === 'chime-then-close');
  const okHead = hw.length && hw.every((h) => Math.abs(h - 60) <= 5);
  const okCross = tc.crossing.openWhileNear === 0 && tc.crossing.lampsOffWhileDown === 0;
  console.log(`TRAIN dwell ${Math.min(...dw)}-${Math.max(...dw)} s ${okDwell ? 'pass' : 'FAIL'}; chime before doors close ${okOrder ? 'pass' : 'FAIL'}; headway ${Math.min(...hw)}-${Math.max(...hw)} s ${okHead ? 'pass' : 'FAIL'}; alternating tracks ${alt ? 'pass' : 'FAIL'}`);
  console.log(`TRAIN crossing: open with a train near it ${tc.crossing.openWhileNear} steps, lamps off while down ${tc.crossing.lampsOffWhileDown} steps ${okCross ? 'pass' : 'FAIL'} (${tc.crossing.steps} steps)`);
}
if (!baseline) {
  fs.writeFileSync(path.join(outDir, 'stats.json'), JSON.stringify(stats, null, 2));
  for (const [name, d] of densityRows) {
    const counts = `buildings ${d.building}, poles ${d.pole}, props ${d.prop}, markings ${d.marking}`;
    console.log(`DENSITY ${name}: ${d.pass ? 'pass' : 'FAIL (' + d.fail.join(', ') + ')'}  ${counts}`);
  }
  if (bare) {
    console.log(`BARE frontage: ${bare.frontage.len} m (${bare.frontage.cls} at ${JSON.stringify(bare.frontage.at)})`);
    console.log(`BARE asphalt: ${bare.asphalt.len} m (${bare.asphalt.cls} at ${JSON.stringify(bare.asphalt.at)})  ${bare.pass ? 'pass' : 'FAIL'}`);
  }
  let fail = false;
  const st = stats._stock;
  if (st) {
    const ok = st.max <= 18;
    if (!ok) fail = true;
    console.log(`STOCK ${st.products} products, ${st.units} units, most of one: ${st.max} (${st.maxId}) ${ok ? 'pass' : 'FAIL'}${st.unplaced.length ? `; not on a shelf: ${st.unplaced.length} (${st.unplaced.join(', ')})` : ''}`);
  }
  for (const [name, pct] of guards) {
    if (pct === null) console.log(`GUARD ${name}: no baseline (run with --baseline first)`);
    else if (pct > GUARD_LIMIT) { fail = true; console.log(`GUARD ${name}: FAIL, ${pct.toFixed(3)}% of pixels changed`); }
    else console.log(`GUARD ${name}: pass (${pct.toFixed(3)}%)`);
  }
  if (fail) process.exitCode = 1;
}
console.log(`saved to ${path.relative(ROOT, baseline ? baseDir : outDir)}/`);

await browser.close();
await server.close();

/* ---- run in the page ---- */

/** % of pixels whose largest channel differs by more than 24, and a mask of them. */
async function diffImages([a, b]) {
  const load = async (src) => { const i = new Image(); i.src = src; await i.decode(); return i; };
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  if (ia.width !== ib.width || ia.height !== ib.height) return { pct: 100, mask: a };
  const px = (img) => {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    return x.getImageData(0, 0, c.width, c.height).data;
  };
  const pa = px(ia), pb = px(ib);
  // the mask: the frame dimmed, changed pixels in magenta
  const c = document.createElement('canvas');
  c.width = ia.width; c.height = ia.height;
  const x = c.getContext('2d');
  const out = x.createImageData(c.width, c.height);
  let n = 0;
  for (let i = 0; i < pa.length; i += 4) {
    const dd = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
    const hit = dd > 24;
    if (hit) n++;
    out.data[i] = hit ? 255 : pa[i] * 0.35;
    out.data[i + 1] = hit ? 0 : pa[i + 1] * 0.35;
    out.data[i + 2] = hit ? 255 : pa[i + 2] * 0.35;
    out.data[i + 3] = 255;
  }
  x.putImageData(out, 0, 0);
  return { pct: (100 * n) / (pa.length / 4), mask: c.toDataURL('image/png') };
}

/** Ours on the left, the reference frame on the right, both 810 px tall. */
async function sideBySide([ours, ref]) {
  const load = async (src) => { const i = new Image(); i.src = src; await i.decode(); return i; };
  const [a, b] = await Promise.all([load(ours), load(ref)]);
  const h = 810;
  const wa = Math.round((a.width * h) / a.height), wb = Math.round((b.width * h) / b.height);
  const c = document.createElement('canvas');
  c.width = wa + wb + 8; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#111';
  x.fillRect(0, 0, c.width, h);
  x.drawImage(a, 0, 0, wa, h);
  x.drawImage(b, wa + 8, 0, wb, h);
  return c.toDataURL('image/jpeg', 0.85);
}
