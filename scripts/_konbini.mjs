// dev helper: the Nippon Konbini experience, headless, end to end.
//
//   node scripts/_konbini.mjs [outdir]            the whole loop, asserted, with frames
//   node scripts/_konbini.mjs [outdir] --measure  draw calls, frame ms and memory only
//   node scripts/_konbini.mjs [outdir] --full     the loop, frames at 1920x1080
//
// It starts its own dev server and Chrome (queued on the shots lock, so it
// never runs beside a screenshot run) and closes both however it ends.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const out = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--tune') ?? path.join(ROOT, '.shots', 'konbini'));
const MEASURE = args.includes('--measure');
const PATHS = args.includes('--paths');        // the walkable floor and each walk, as text
const FULL = args.includes('--full');          // frames at 1920x1080 (the report's)
fs.mkdirSync(out, { recursive: true });

/* Every unit on show against its fixture: nothing may poke out of a basket,
 * through a case's glass or wall, or into the shelf above (run in the page). */
const STOCK_CHECK = () => {
  window.__stockCheck = () => {
    const THREE = window.__scene.THREE, S = window.__store.shop;
    const inside = window.__scene.scene.getObjectByName('lawson-interior');
    const { units, slots } = inside.userData;
    const bb = new THREE.Box3(), o = new THREE.Object3D();
    const up = (s) => {
      const same = slots.filter((t) => t.zone === s.zone && t.y > s.y + 0.01 && (s.zone !== 'drinks' || t.bay === s.bay)
        && (s.zone !== 'gondola' || (t.gi === s.gi && t.side === s.side)) && (s.zone !== 'endcap' || t.gi === s.gi));
      return same.length ? Math.min(...same.map((t) => t.y)) - 0.02 : null;
    };
    const tops = new Map(), bad = [];
    for (const u of units) {
      const s = u.slot;
      if (!s) continue;
      o.position.set(u.x, u.y, u.z); o.rotation.set(u.rx ?? 0, u.ry, 0, 'YXZ'); o.updateMatrix();
      bb.copy(S.debug.productGeometry(u.id).boundingBox).applyMatrix4(o.matrix);
      if (!tops.has(s)) tops.set(s, up(s));
      const top = tops.get(s);
      let lim;
      switch (s.zone) {
        case 'icecase': lim = { x0: s.x0 - 0.03, x1: s.x1 + 0.03, z0: s.z0 - 0.03, z1: s.z1 + 0.03, y1: 0.83 }; break;
        case 'chilled': lim = { x0: -8.22 + 0.12, x1: s.rail + 0.02, z0: -11.6, z1: -3.9, y1: top ?? 2.0 }; break;
        case 'drinks': lim = { x0: s.x0 - 0.1, x1: s.x1 + 0.1, z1: s.rail + 0.005, y1: top ?? 2.24 }; break;
        case 'gondola': lim = { z0: -9.8, z1: -2.6, y1: top ?? 1.9 }; break;               // the top shelf is open above
        case 'endcap': lim = { x0: s.x0 - 0.05, x1: s.x1 + 0.05, z1: s.rail + 0.01, y1: top ?? 1.9 }; break;
        case 'freezer': lim = { x0: 3.55, x1: 5.05, y1: top ?? 2.0 }; break;
        case 'selfserve': lim = { z0: -10.02, z1: -8.98, y1: top ?? 1.95 }; break;
        default: continue;
      }
      const over = [];
      for (const [k, val] of Object.entries(lim)) {
        const ax = k[0], hi = k[1] === '1', got = hi ? bb.max[ax] : bb.min[ax];
        const d = hi ? got - val : val - got;
        if (d > 0.005) over.push(`${k}+${d.toFixed(3)}`);
      }
      if (over.length) bad.push({ id: u.id, zone: s.zone, at: [u.x, u.y, u.z].map((q) => +q.toFixed(2)), over: over.join(' ') });
    }
    const byZone = {};
    for (const b of bad) (byZone[b.zone] ??= []).push(b);
    return { total: bad.length, byZone: Object.fromEntries(Object.entries(byZone).map(([k, list]) => [k, { n: list.length, ids: [...new Set(list.map((b) => b.id))].slice(0, 10), sample: list.slice(0, 3) }])) };
  };
};

/* the shots lock (scripts/shots.mjs): one Chrome at a time on this machine */
const LOCK = path.join(os.tmpdir(), 'lawson-fuji-shots.lock');
for (;;) {
  try { fs.mkdirSync(LOCK); fs.writeFileSync(path.join(LOCK, 'pid'), String(process.pid)); break; } catch {
    let pid = 0, alive = false;
    try { pid = +fs.readFileSync(path.join(LOCK, 'pid'), 'utf8'); } catch {}
    try { if (pid) { process.kill(pid, 0); alive = true; } } catch {}
    if (!alive) { fs.rmSync(LOCK, { recursive: true, force: true }); continue; }
    console.log(`  waiting for another run (pid ${pid})`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
const unlock = () => { try { if (+fs.readFileSync(path.join(LOCK, 'pid'), 'utf8') === process.pid) fs.rmSync(LOCK, { recursive: true, force: true }); } catch {} };
process.on('exit', unlock);

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5191, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const base = server.resolvedUrls.local[0];
let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] }); }
catch { browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] }); }
const close = async () => { await Promise.race([browser.close().then(() => server.close()), new Promise((r) => setTimeout(r, 8000))]).catch(() => {}); };
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await close(); process.exit(130); });

const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultNavigationTimeout(180000);
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });

let bad = 0;
try {
  await page.goto(`${base}?shots`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 150000, polling: 250 });

  /* ------------------------------ measuring ------------------------------ */
  const measure = () => page.evaluate(async () => {
    const { renderer } = window.__scene;
    const spots = {
      counter: { look: 'day', pos: [3.4, 0, -2.2], yaw: -1.2, pitch: -0.1 },
      aisle: { look: 'day', pos: [-2.1, 0, -3.0], yaw: 0, pitch: -0.12 },
      hero: { hero: 'morning', look: 'day' },
    };
    const res = {};
    for (const [k, o] of Object.entries(spots)) {
      const r = await window.__shot('m', 2560, 1440, { ...o, returnData: false, png: false, scale: 1.5, time: 20, shop: 0.5 });
      res[k] = { calls: r.mainCalls, tris: Math.round(r.mainTriangles / 1000) + 'k', ms: +r.ms.toFixed(2) };
    }
    const mem = performance.memory;
    res.heapMB = mem ? +(mem.usedJSHeapSize / 1048576).toFixed(0) : null;
    res.gpu = { textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries };
    return res;
  });
  const tuneAt = args.indexOf('--tune');
  if (tuneAt >= 0) {
    // dev: a scratch module's tune(page, save) against the running game
    const { tune } = await import(path.resolve(args[tuneAt + 1]));
    await tune(page, (name, data) => fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(data.split(',')[1], 'base64')));
  } else if (MEASURE) {
    const res = await measure();
    // the heap after a full collection, so runs compare
    await (await page.context().newCDPSession(page)).send("HeapProfiler.collectGarbage");
    res.heapMB = await page.evaluate(() => +(performance.memory.usedJSHeapSize / 1048576).toFixed(0));
    console.log(JSON.stringify(res, null, 1));
  } else if (PATHS) {
    for (const id of ['onigiri_tuna', 'sando_egg', 'strong_nine', 'choco_wafer_jumbo']) console.log(id + '\n' + await page.evaluate((id) => window.__store.shop.debug.pathMap(id), id));
  } else {
    await loop();
  }

  /* ------------------------------ the loop ------------------------------ */
  async function loop() {
    await page.evaluate((f) => { window.__FULL = f; }, FULL);
    await page.evaluate(() => {
      const S = window.__store.shop;
      window.__toasts = []; window.__said = [];
      S.flash = (t) => window.__toasts.push(t);
      const say = S.onSay;
      S.onSay = (l) => { window.__said.push(l.en); say?.(l); };
      window.__look = (px, pz, t, y = 1.6) => {
        const dx = t.x - px, dz = t.z - pz;
        return { pos: [px, 0, pz], yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(t.y - y, Math.hypot(dx, dz)) };
      };
      window.__go = async (o, secs = 0, name = null) => {
        const r = await window.__shot(name ?? 'k', window.__W, window.__H, { png: true, returnData: !!name, look: window.__lookName ?? 'day', frame: 'world', ...o, shop: secs });
        return r?.data ?? null;
      };
      window.__spot = (key) => S.debug.spots.find((s) => s.key === key);
      window.__state = () => ({ phase: S.phase, wallet: S.wallet, held: S.held.map((h) => `${h.id}:${h.hand}:${h.where}${h.paid ? ':paid' : ''}`), up: +S.hands.up.toFixed(2) });
      window.__W = window.__FULL ? 1920 : 1280; window.__H = window.__FULL ? 1080 : 720;
    });
    await page.evaluate(STOCK_CHECK);
    const save = (name, data) => { if (data) fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(data.split(',')[1], 'base64')); };
    async function step(name, fn, check) {
      let r;
      try { r = await page.evaluate(fn); } catch (e) { r = { error: String(e).slice(0, 300) }; }
      for (const [k, val] of Object.entries(r ?? {})) if (typeof val === 'string' && val.startsWith('data:image')) { save(`${name}${k === 'data' ? '' : '-' + k}`, val); delete r[k]; }
      const ok = !r?.error && (check ? !!check(r) : true);
      if (!ok) bad++;
      console.log(ok ? 'pass' : 'FAIL', name, JSON.stringify(r));
      return r;
    }
    const english = (x) => !!x && !/[぀-ヿ一-鿿]/.test(x);

    // the scene, played through: frames at its moments, what was said, where it ends
    const play = (id, frames) => page.evaluate(async ({ id, frames }) => {
      const S = window.__store.shop;
      window.__said.length = 0; window.__toasts.length = 0;
      let tipsy = false;
      const t0 = S.onTipsy;
      S.onTipsy = () => { tipsy = true; t0?.(); };
      await window.__go({ pos: [-2.3, 0, 5], yaw: 0, pitch: 0 }, 0.1);
      await window.__go({ pos: [-2.3, 0, 2.3], yaw: 0, pitch: 0 }, 0.3);
      const atSpot = S.atSpot;
      const ok = S.play(id);
      const shots = {}, phases = [];
      let t = 0, inside = false, took = false, eatT = 0;
      while (S.visiting && t < 120) {
        await window.__go({ stepWorld: true }, 0.5);
        t += 0.5;
        const ph = S.phase;
        if (phases[phases.length - 1] !== ph) phases.push(ph);
        if (frames) {
          const cam = window.__scene.camera.position;
          if (!inside && cam.z < -0.5) { inside = true; shots.door = (await window.__go({}, 0, 'x')); }
          if (frames && inside && S.phase !== 'eat' && Math.round(t * 2) % 8 === 0) shots['walk' + Math.round(t)] = (await window.__go({}, 0, 'x'));
          if (!took && S.held.some((h) => h.where === 'hand')) { took = true; shots.take = (await window.__go({}, 0, 'x')); }
          if (ph === 'till' && !shots.till && S.debug.checkout?.t > 2.2) shots.till = (await window.__go({}, 0, 'x'));
          if (ph === 'eat' && !shots.eat && (eatT += 0.5) >= 1.5) shots.eat = (await window.__go({}, 0, 'x'));
        }
      }
      S.onTipsy = t0;
      const p = window.__scene.player.pos;
      return { ok, atSpot, secs: t, phases, said: window.__said.slice(), toasts: window.__toasts.slice(), tipsy, end: [+p.x.toFixed(2), +p.z.toFixed(2)], scripted: !!window.__scene.player.scripted, ...shots };
    }, { id, frames });
    const sayAll = (r) => ['Welcome!', 'Thank you very much.', 'Thank you, come again!'].every((l) => r.said.includes(l)) && r.said.some((l) => /comes to/.test(l));
    const done = (r) => r.ok && r.atSpot && !r.scripted && r.secs < 120 && Math.hypot(r.end[0] + 2.3, r.end[1] - 2.4) < 0.5 && r.phases.includes('eat') && sayAll(r);
    let prev = null;
    for (const [i, id] of ['onigiri_tuna', 'sando_egg', 'fruit_sando', 'strong_nine', 'choco_wafer_jumbo'].entries()) {
      const r = await play(id, i === 0 || id === 'strong_nine' || id === 'choco_wafer_jumbo');
      for (const k of Object.keys(r).filter((k) => /^(door|take|till|eat|walk\d+)$/.test(k))) if (r[k]) { fs.writeFileSync(path.join(out, `${id}-${k}.png`), Buffer.from(r[k].split(',')[1], 'base64')); delete r[k]; }
      const ok = done(r) && (id !== 'strong_nine' || r.tipsy) && r.toasts.every(english);
      if (!ok) bad++;
      console.log(ok ? 'pass' : 'FAIL', id, JSON.stringify(r));
      prev = r;
    }
    await step('06-no-roaming', async () => {
      const S = window.__store.shop, door = window.__scene.world.lawson.door;
      await window.__go({ pos: [-2.3, 0, 0.9], yaw: 0, pitch: 0, stepWorld: true }, 2.5);
      return { held: S.holdDoor({ x: -2.3, z: 0.9 }), open: +door.open.toFixed(2), visiting: S.visiting };
    }, (r) => r.held && r.open === 0 && !r.visiting);
    await step('07-spot-again', async () => {
      const S = window.__store.shop;
      await window.__go({ pos: [-2.3, 0, 5], yaw: 0, pitch: 0 }, 0.1);
      await window.__go({ pos: [-2.3, 0, 2.3], yaw: 0, pitch: 0 }, 0.2);
      return { atSpot: S.atSpot };
    }, (r) => r.atSpot);
    await step('15-stock-inside', () => window.__stockCheck(), (r) => r.total === 0);
  }
} finally {
  if (errs.length) { console.log('page errors:'); for (const e of errs.slice(0, 10)) console.log('  ', e); }
  await close();
}
if (bad || errs.length) process.exitCode = 1;
