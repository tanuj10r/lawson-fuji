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

    await step('01-outside', async () => {
      const data = await window.__go({ pos: [-2.3, 0, 4.5], yaw: 0, pitch: 0.02 }, 0.3, 'outside');
      return { ...window.__state(), data };
    }, (r) => r.phase === 'out' && r.up === 0);
    await step('02-enter-hands', async () => {
      await window.__go({ pos: [-2.3, 0, -1.4], yaw: 0, pitch: -0.05 }, 0.05);
      const data = await window.__go({ pos: [-2.3, 0, -1.4], yaw: 0, pitch: -0.05 }, 0.9, 'hands');
      return { ...window.__state(), said: window.__said.slice(), toasts: window.__toasts.slice(), data };
    }, (r) => r.phase === 'shop' && r.up === 1 && r.said.includes('Welcome!') && r.wallet === 1000);
    await step('03-onigiri-spot', async () => {
      const sp = window.__spot('onigiri'), c = sp.box.getCenter(new window.__scene.THREE.Vector3());
      const o = window.__look(c.x + 1.2, c.z + 0.3, c);
      const data = await window.__go(o, 0.1, 'spot');
      const t = window.__store.shop.pick(window.__scene.camera);
      const label = t?.label; const n0 = t?.unit?.count;
      t?.action();
      await window.__go(o, 0.6);
      return { label, took: window.__state().held, countDown: n0 - (t?.unit?.count ?? 0), data };
    }, (r) => r.label === 'Take the Tuna-mayo onigiri (¥150)' && r.took.length === 1 && r.countDown === 1);
    await step('04-scenery-not-takeable', async () => {
      // an ordinary onigiri: aiming at it does nothing
      const S = window.__store.shop;
      const inside = window.__scene.scene.getObjectByName('lawson-interior');
      const u = inside.userData.units.find((x) => !x.feature && !x.front && x.slot?.zone === 'chilled' && x.id.startsWith('onigiri'));
      const o = window.__look(u.x + 1.0, u.z, { x: u.x, y: u.y + 0.04, z: u.z });
      await window.__go(o, 0.05);
      const t = S.pick(window.__scene.camera);
      return { aimed: t?.label ?? null, id: u.id };
    }, (r) => r.aimed === null);
    await step('05-fruit-sando', async () => {
      const S = window.__store.shop;
      const u = S.debug.pickable.find((x) => x.id === 'fruit_sando');
      const o = window.__look(u.centre.x + 1.1, u.centre.z, u.centre);
      await window.__go(o, 0.05);
      const t = S.pick(window.__scene.camera);
      const label = t?.label;
      t?.action();
      const data = await window.__go(o, 0.6, 'two');
      const full = S.pick(window.__scene.camera)?.label;
      return { label, full, ...window.__state(), data };
    }, (r) => r.held.length === 2 && /Fruit sando \(¥398\)/.test(r.label) && /hands are full/.test(r.full));
    await step('06-put-back', async () => {
      const S = window.__store.shop;
      const u = S.debug.pickable.find((x) => x.id === 'fruit_sando');
      const before = u.count;
      const ok = S.putBack();
      await window.__go({ pos: [-6.3, 0, -6.2], yaw: 1.4, pitch: -0.3 }, 0.7);
      return { ok, before, after: u.count, ...window.__state() };
    }, (r) => r.ok && r.after === r.before + 1 && r.held.length === 1);
    await step('07-strong-nine', async () => {
      const S = window.__store.shop;
      const sp = window.__spot('chuhi'), c = sp.box.getCenter(new window.__scene.THREE.Vector3());
      const o = window.__look(c.x + 0.2, c.z + 1.25, c);
      const data = await window.__go(o, 0.1, 'spot');
      const t = S.pick(window.__scene.camera);
      const label = t?.label;
      t?.action();
      await window.__go(o, 1.0);
      return { label, ...window.__state(), data };
    }, (r) => /Strong Nine/.test(r.label) && r.held.length === 2 && r.held.some((h) => h.startsWith('strong_nine')));
    await step('08-ice-spot', async () => {
      const S = window.__store.shop;
      const sp = window.__spot('ice'), c = sp.box.getCenter(new window.__scene.THREE.Vector3());
      const o = window.__look(c.x - 0.1, c.z + 1.0, c);
      const data = await window.__go(o, 0.1, 'spot');
      return { label: S.pick(window.__scene.camera)?.label, data };
    }, (r) => /hands are full/.test(r.label));
    await step('09-door-refuses', async () => {
      window.__toasts.length = 0;
      await window.__go({ pos: [-2.3, 0, -0.9], yaw: 0, pitch: 0 }, 0.3);
      const door = window.__scene.world.lawson.door;
      return { hold: door.hold({ x: -2.3, z: -0.9 }), toasts: window.__toasts.slice() };
    }, (r) => r.hold === true && r.toasts.some((t) => /Pay at the till first/.test(t)) && r.toasts.every(english));
    await step('10-checkout', async () => {
      const S = window.__store.shop, T = S.debug.TILL;
      window.__said.length = 0;
      const o = window.__look(T.stand.x, T.stand.z, T.look);
      await window.__go(o, 0.05);
      const t = S.pick(window.__scene.camera);
      const label = t?.label;
      t?.action();
      const mid = await window.__go(o, 1.5, 'scan');
      const pay = await window.__go(o, 2.9, 'pay');
      await window.__go(o, 3.5);
      return { label, said: window.__said.slice(), ...window.__state(), mid, pay };
    }, (r) => r.label === 'Pay ¥348 at the till' && r.phase === 'paid' && r.wallet === 652 && r.said.join('|') === "I'll take those.|That comes to ¥348.|Thank you very much." && r.held.every((h) => h.endsWith(':paid')));
    await step('11-cashier-1.5m', async () => {
      const o = window.__look(5.82, -4.5, { x: 7.32, y: 1.42, z: -4.5 });
      const data = await window.__go(o, 0.4, 'cashier');
      return { data };
    });
    await step('12-leave-eat', async () => {
      const S = window.__store.shop;
      window.__said.length = 0;
      const at = { pos: [-2.3, 0, 3.0], yaw: 0, pitch: 0.12 };
      await window.__go({ pos: [-2.3, 0, -0.7], yaw: 0, pitch: 0 }, 0.1);
      await window.__go({ pos: [-2.3, 0, 0.8], yaw: 0, pitch: 0.05 }, 0.2);
      const farewell = window.__said.slice();
      await window.__go(at, 0.1);
      const phaseOut = S.phase;
      const e1 = await window.__go(at, 1.05, 'eat-a');
      const e2 = await window.__go(at, 0.75, 'eat-b');
      const e3 = await window.__go(at, 2.3, 'eat-c');
      const e4 = await window.__go(at, 1.2, 'eat-d');
      await window.__go(at, 3.0);
      return { farewell, phaseOut, ...window.__state(), toasts: window.__toasts.slice(-1), e1, e2, e3, e4 };
    }, (r) => r.farewell.includes('Thank you, come again!') && r.phaseOut === 'eat' && r.phase === 'out' && r.held.length === 0 && r.up === 0);
    await step('13-again', async () => {
      // a second visit: a fresh ¥1,000; the egg sando and the ice this time
      const S = window.__store.shop;
      await window.__go({ pos: [-2.3, 0, -1.4], yaw: 0, pitch: 0 }, 0.9);
      const wallet = S.wallet;
      for (const id of ['sando_egg', 'choco_wafer_jumbo']) {
        const u = S.debug.pickable.find((x) => x.id === id && x.count > 0);
        const o = id === 'sando_egg' ? window.__look(u.centre.x + 1.1, u.centre.z, u.centre) : window.__look(u.centre.x - 0.2, u.centre.z + 1.0, u.centre);
        await window.__go(o, 0.05);
        S.pick(window.__scene.camera)?.action();
        await window.__go(o, 0.6);
      }
      const T = S.debug.TILL, o = window.__look(T.stand.x, T.stand.z, T.look);
      await window.__go(o, 0.05);
      S.pick(window.__scene.camera)?.action();
      await window.__go(o, 8);
      const paid = window.__state();
      const at = { pos: [-2.3, 0, 3.0], yaw: 0, pitch: 0.12 };
      await window.__go({ pos: [-2.3, 0, -0.7], yaw: 0, pitch: 0 }, 0.1);
      await window.__go(at, 0.2);
      const e1 = await window.__go(at, 1.7, 'eat-sando');
      await window.__go(at, 2.3);
      const e2 = await window.__go(at, 1.35, 'eat-ice');
      await window.__go(at, 4);
      return { wallet, paid, end: window.__state(), e1, e2 };
    }, (r) => r.wallet === 1000 && r.paid.phase === 'paid' && r.paid.wallet === 1000 - 298 - 190 && r.end.phase === 'out');
    await step('14-unpaid-out', async () => {
      // walked out with something unpaid (a famous-view key): it goes back on its shelf
      const S = window.__store.shop;
      await window.__go({ pos: [-2.3, 0, -1.4], yaw: 0, pitch: 0 }, 0.9);
      const u = S.debug.pickable.find((x) => x.id === 'onigiri_tuna' && x.count > 0);
      const o = window.__look(u.centre.x + 1.1, u.centre.z, u.centre);
      await window.__go(o, 0.05);
      const before = u.count;
      S.pick(window.__scene.camera)?.action();
      await window.__go(o, 0.6);
      window.__toasts.length = 0;
      await window.__go({ pos: [0, 0, 16.5], yaw: 0, pitch: 0 }, 0.2);
      return { before, after: u.count, ...window.__state(), toasts: window.__toasts.slice() };
    }, (r) => r.after === r.before && r.held.length === 0 && r.phase === 'out' && r.toasts.some((t) => /Pay at the till/.test(t)));
    await step('15-stock-inside', () => window.__stockCheck(), (r) => r.total === 0);
  }
} finally {
  if (errs.length) { console.log('page errors:'); for (const e of errs.slice(0, 10)) console.log('  ', e); }
  await close();
}
if (bad || errs.length) process.exitCode = 1;
