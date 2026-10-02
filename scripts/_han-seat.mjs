// dev check: Han in the RX-7 (Tan, 2026-10-02: "after the car leaves, Han's leg is visible under the car").
//
//   node scripts/_han-seat.mjs                    the measurement, in node (no browser): the show stepped at 60 Hz
//                                                 (the nod, getting in, the drive and its slide, parking, getting out),
//                                                 every vertex of Han in the sprung body's own frame:
//                                                   none under the car's floor within its footprint (what would show
//                                                   under the car), seated or on his way in and out;
//                                                   seated: none outside the body's sides, and the roof or the glass
//                                                   over every point of his head and hands
//   node scripts/_han-seat.mjs --sheets [outdir]  contact sheets as well: the show from where you watch, and from low
//                                                 at the car's two sides and its front quarter (its own dev server
//                                                 and Chrome, queued on the browser lock, closed however it ends)
//   --root <dir>                                  another checkout (a before/after pair)
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : null; };
const HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ROOT = path.resolve(opt('root') ?? HERE);
const SHEETS = args.includes('--sheets');
const out = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--root') ?? path.join(HERE, '.shots', 'han-seat'));
const T_IN = 2.8, T_DRIVE = 12.6, T_END = T_IN + T_DRIVE + 2.3;      // han/index.js, han/drive.js (kept in step by hand)
let fail = 0;
const check = (ok, what, info) => { console.log(`${ok ? 'pass' : 'FAIL'}  ${what}  ${JSON.stringify(info)}`); if (!ok) fail++; };

/* ---- the measurement: the car and Han built in node (a DOM just big enough for the canvases they paint) ---- */
{
  const noop = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : noop), apply: () => noop, set: () => true });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => noop, style: {}, addEventListener() {} }) };
  globalThis.window = globalThis;
  let NOW = 0;
  const realPerf = globalThis.performance;
  globalThis.performance = { now: () => NOW };
  const THREE = await import(path.join(ROOT, 'node_modules/three/build/three.module.js'));
  const { buildHan, HAN_BAY } = await import(path.join(ROOT, 'src/world/han/index.js'));
  const updates = [];
  let action = null;
  const { car, han } = buildHan({
    add() {}, colliders: [], scene: new THREE.Scene(),
    toWorld: (p) => ({ x: p.x, z: p.z }), toLocal: (p) => ({ x: p.x, z: p.z }),
    update: (f) => updates.push(f), groundAt: () => 0,
    experiences: { add: (o) => { action = o.action; return { done() {}, show() {} }; } },
  });
  const cam = { x: HAN_BAY.x - 6, y: 1.6, z: HAN_BAY.z + 9 };       // watching, clear of the car's way
  const step = (dt) => { NOW += dt * 1000; for (const f of updates) f(dt, cam); };
  const FLOOR = 0.165, IN = 0.03;      // the sill's underside (rx7.js sillY 0.16); how far inside the paint counts as under the car
  const inv = new THREE.Matrix4(), m = new THREE.Matrix4(), v = new THREE.Vector3();
  const meshes = [], shell = [];
  han.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  car.body.traverse((o) => { if (!o.isMesh || meshes.includes(o)) return; o.geometry.computeBoundingBox(); if (o.geometry.boundingBox.max.y < 1.0) return; o.material.side = THREE.DoubleSide; shell.push(o); });      // (what reaches the roof line)
  const measure = () => {
    car.group.updateMatrixWorld(true);
    inv.copy(car.body.matrixWorld).invert();
    let under = 0, low = 9, lowAll = 9, outside = 0, side = 0;
    for (const o of meshes) {
      m.multiplyMatrices(inv, o.matrixWorld);
      const p = o.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m);
        lowAll = Math.min(lowAll, v.y);
        const w = car.halfW(v.x);
        if (Math.abs(v.z) < w - IN && Math.abs(v.x) < 2.1 && v.y < FLOOR) { under++; low = Math.min(low, v.y); }
        if (Math.abs(v.z) > w) { outside++; side = Math.max(side, Math.abs(v.z) - w); }
      }
    }
    return { under, low, lowAll, outside, side };
  };
  /** Seated: every point of him over 0.8 m has the roof or the glass over it; the least room over his head. */
  const ray = new THREE.Raycaster(), up = new THREE.Vector3(0, 1, 0);
  const headroom = () => {
    car.group.updateMatrixWorld(true);
    let open = 0, gap = 9;
    for (const o of meshes) {
      const p = o.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i += 13) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        if (v.y < 0.8) continue;
        ray.set(v, up); ray.far = 0.7;
        const h = ray.intersectObjects(shell, false).filter((q) => q.point.y > 0.98 && q.distance > 0.002);      // (the roof and the glass: not the seats, the wheel)
        if (!h.length) open++; else if (v.y > 1.05) gap = Math.min(gap, h[0].distance);
      }
    }
    return { open, gap };
  };
  step(1 / 60); step(1 / 60);
  action();
  const rows = [], heads = [];
  for (let t = 1 / 60; t < T_END + 0.5; t += 1 / 60) {
    step(1 / 60);
    rows.push({ t: +t.toFixed(3), ...measure() });
    if (t > T_IN + 0.1 && t < T_IN + T_DRIVE - 0.1 && rows.length % 150 === 0) heads.push(headroom());
  }
  globalThis.performance = realPerf;
  const f = (x) => +x.toFixed(3);
  const bad = rows.filter((r) => r.under > 0);
  const seated = rows.filter((r) => r.t > T_IN + 0.05 && r.t < T_IN + T_DRIVE - 0.05);
  const moving = rows.filter((r) => (r.t > 1.4 && r.t <= T_IN) || r.t >= T_IN + T_DRIVE);
  check(bad.length === 0, `none of Han under the car's floor within its footprint, ${rows.length} frames of the show`,
    bad.length ? { frames: bad.length, from: bad[0].t, to: bad[bad.length - 1].t, lowest: f(Math.min(...bad.map((r) => r.low))), floor: FLOOR } : { lowestSeated: f(Math.min(...seated.map((r) => r.lowAll))), floor: FLOOR });
  check(seated.every((r) => !r.outside), 'seated: none of him outside the body', { frames: seated.filter((r) => r.outside).length, by: f(Math.max(...seated.map((r) => r.side))) });
  check(heads.every((h) => h.open === 0) && Math.min(...heads.map((h) => h.gap)) > 0.03, 'seated: the roof or the glass over all of him, room over his head',
    { moments: heads.length, uncovered: Math.max(...heads.map((h) => h.open)), headroom: f(Math.min(...heads.map((h) => h.gap))) });
  check(Math.min(...moving.map((r) => r.lowAll)) > -0.04, 'in and out: his feet on the ground, not in it', { lowest: f(Math.min(...moving.map((r) => r.lowAll))) });
}

/* ---- the sheets ---- */
if (SHEETS) {
  const { createServer } = await import('vite');
  const { chromium } = await import('playwright');
  fs.mkdirSync(out, { recursive: true });
  const BLOCK = '/tmp/lawson-browser.lock';
  let mine = false;
  for (let k = 0; ; k++) { try { fs.mkdirSync(BLOCK); mine = true; break; } catch { if (k % 6 === 0) console.log('  waiting for the browser lock'); await new Promise((r) => setTimeout(r, 10000)); } }
  const unlock = () => { if (mine) { try { fs.rmdirSync(BLOCK); } catch {} mine = false; } };
  process.on('exit', unlock);
  const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), logLevel: 'error', server: { port: +process.env.PORT || 5194, strictPort: !!process.env.PORT, host: '127.0.0.1' } });
  await server.listen();
  const flags = ['--use-angle=metal', '--ignore-gpu-blocklist'];
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome', headless: true, args: flags }); }
  catch { browser = await chromium.launch({ headless: true, args: flags }); }
  const close = async () => { await Promise.race([browser.close().then(() => server.close()), new Promise((r) => setTimeout(r, 8000))]).catch(() => {}); };
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await close(); unlock(); process.exit(130); });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.setDefaultNavigationTimeout(180000);
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(server.resolvedUrls.local[0] + '?shots', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ready === true && !!window.__han, null, { timeout: 180000 });
    const sheets = await page.evaluate(async () => {
      const { THREE, world, camera, scene } = window.__scene, H = window.__han;
      const car = scene.getObjectByName('rx7-body').parent, body = scene.getObjectByName('rx7-body');
      const at = (t) => { H.set(t); world.update(0, camera); car.updateMatrixWorld(true); };
      const shot = async (o) => (await window.__shot('s', 640, 360, { returnData: true, quality: 0.85, look: 'day', frame: 'world', ...o })).data;
      const p = new THREE.Vector3(), q = new THREE.Vector3();
      const aim = (from, to, eye, toY) => ({ pos: [from.x, 0, from.z], yaw: Math.atan2(-(to.x - from.x), -(to.z - from.z)), pitch: Math.atan2(toY - eye, Math.hypot(to.x - from.x, to.z - from.z)), lift: eye - 1.6 });
      const off = (lx, lz) => { q.set(lx, 0, lz).applyMatrix4(car.matrixWorld); return { x: q.x, z: q.z }; };
      at(0);
      const spot = off(-0.9, 3.3);       // a step back from the glow you step into (HAN_SPOT), as you stand watching
      const times = [0, 1.2, 1.7, 1.95, 2.1, 2.2, 2.3, 2.45, 2.8, 3.6, 4.6, 6.0, 7.5, 9.0, 10.0, 11.0, 12.5, 14.0, 15.4, 15.75, 15.9, 16.0, 16.15, 16.4, 16.8];
      const sets = { watch: [], 'low-right': [], 'low-left': [], 'low-front': [] };
      for (const t of times) {
        at(t);
        body.getWorldPosition(p);
        sets.watch.push([t, await shot(aim(spot, p, 1.6, 0.55))]);
        // low: 3.4 m off each side and from the front quarter, the eye 0.3 m up
        sets['low-right'].push([t, await shot(aim(off(0.1, 3.4), p, 0.3, 0.3))]);
        sets['low-left'].push([t, await shot(aim(off(0.1, -3.4), p, 0.3, 0.3))]);
        sets['low-front'].push([t, await shot(aim(off(3.3, 2.2), p, 0.28, 0.3))]);
      }
      H.stop();
      const TITLE = { watch: 'The show from where you watch (a step back from the glow)', 'low-right': "Low at the driver's side (eye 0.3 m, 3.4 m off)", 'low-left': 'Low at the far side (eye 0.3 m, 3.4 m off)', 'low-front': 'Low at the front quarter (eye 0.28 m)' };
      const res = {};
      for (const [name, frames] of Object.entries(sets)) {
        const cols = 5, W = 480, Hh = 270, pad = 6, top = 34;
        const cv = document.createElement('canvas');
        cv.width = cols * (W + pad) + pad; cv.height = top + Math.ceil(frames.length / cols) * (Hh + pad);
        const g = cv.getContext('2d');
        g.fillStyle = '#16161c'; g.fillRect(0, 0, cv.width, cv.height);
        g.fillStyle = '#fff'; g.font = '16px sans-serif'; g.fillText(TITLE[name], pad, 22);
        for (let i = 0; i < frames.length; i++) {
          const img = new Image(); img.src = frames[i][1]; await img.decode();
          const x = pad + (i % cols) * (W + pad), y = top + Math.floor(i / cols) * (Hh + pad);
          g.drawImage(img, x, y, W, Hh);
          g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, y, 74, 22);
          g.fillStyle = '#fff'; g.fillText(`t ${frames[i][0].toFixed(2)}`, x + 6, y + 16);
        }
        res[name] = cv.toDataURL('image/jpeg', 0.88);
      }
      return res;
    });
    for (const [k, d] of Object.entries(sheets)) { const file = path.join(out, `han-${k}.jpg`); fs.writeFileSync(file, Buffer.from(d.split(',')[1], 'base64')); console.log('  ' + file); }
    check(errs.length === 0, 'the sheets: no page errors', errs.slice(0, 5));
  } finally {
    await close();
    unlock();
  }
}
console.log(fail ? `HAN SEAT FAIL (${fail})` : 'HAN SEAT pass');
process.exit(fail ? 1 : 0);
