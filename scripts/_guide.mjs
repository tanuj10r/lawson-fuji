// dev check: the guide shiba (animals/guide.js), headless, end to end.
//
//   node scripts/_guide.mjs [outdir]              a player who follows the dog: does it reach every
//                                                 engagement in turn, how long, how far, ever stuck,
//                                                 ever through anything solid; a map of its trail
//   node scripts/_guide.mjs --measure [--root d]  draw calls, triangles and frame ms at the hero view
//                                                 and three spots the dog waits at (--root: another checkout)
//
// Starts its own dev server and Chrome (queued on the shots lock) and closes
// both however it ends.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : null; };
const ROOT = path.resolve(opt('root') ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'));
const HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--root') ?? path.join(HERE, '.shots', 'guide'));
const MEASURE = args.includes('--measure');
fs.mkdirSync(out, { recursive: true });

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

const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), logLevel: 'error', server: { port: 5194, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const base = server.resolvedUrls.local[0];
const flags = ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info'];
let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: true, args: flags }); }
catch { browser = await chromium.launch({ headless: true, args: flags }); }
const close = async () => { await Promise.race([browser.close().then(() => server.close()), new Promise((r) => setTimeout(r, 8000))]).catch(() => {}); };
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await close(); process.exit(130); });

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(180000);
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });

let bad = 0;
try {
  await page.goto(`${base}?shots`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 150000, polling: 250 });

  if (MEASURE) {
    const res = await page.evaluate(async () => {
      const { renderer } = window.__scene;
      const F = window.__scene.world.frame;
      const spots = {
        hero1: { hero: 'morning', look: 'day' },
        door: { look: 'day', pos: [-2.3, 0, 6.2], yaw: 0, pitch: 0.1, guide: 'sit' },                                  // outside NIPPON's door, the dog sat by the ring
        han: { look: 'day', frame: 'core', pos: [18.2, 0, 4.2], yaw: -1.5708, pitch: 0.05, guide: 'sit' },             // the car park, by Han's spot
        bench: { look: 'day', frame: 'core', pos: [70.5, 0, 103.5], yaw: 1.5708, pitch: 0.1, guide: 'nap' },           // the slow-life bench
      };
      const res = {};
      for (const [k, o] of Object.entries(spots)) {
        const g = o.guide; delete o.guide;
        const r = await window.__shot('m', 2560, 1440, { ...o, ...(window.__guide ? { guide: g } : {}), returnData: false, png: false, scale: 1.5, time: 20 });
        res[k] = { calls: r.mainCalls, tris: Math.round(r.mainTriangles / 1000) + 'k', ms: +r.ms.toFixed(2) };
      }
      const geo = window.__scene.scene.getObjectByName('animals-shiba')?.geometry;
      res.dog = geo ? { tris: geo.index.count / 3, verts: geo.attributes.position.count } : null;
      res.gpu = { textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries };
      return res;
    });
    await (await page.context().newCDPSession(page)).send('HeapProfiler.collectGarbage');
    res.heapMB = await page.evaluate(() => +(performance.memory.usedJSHeapSize / 1048576).toFixed(0));
    console.log(JSON.stringify(res, null, 1));
  } else {
    const r = await page.evaluate(async () => {
      const g = window.__guide, W = g.walk, world = window.__scene.world, camera = window.__scene.camera;
      g.reset();
      const dt = 1 / 30;
      const P = { x: 0, y: 1.6, z: 16.5, yaw: 0 };
      const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
      const solid = world.colliders.filter((c) => (c.bottom ?? 0) < 0.8 && (c.top ?? 9) > 0.3 && c.x1 - c.x0 > 0.01);
      const hit = (x, z) => solid.some((c) => x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1);
      const lookAt = (tx, tz) => { P.yaw = Math.atan2(-(tx - P.x), -(tz - P.z)); };
      const sync = () => { camera.position.set(P.x, P.y, P.z); camera.rotation.set(0, P.yaw, 0); camera.updateMatrixWorld(); world.update(0, camera); };
      // a walker: straight at the goal on free ground, sliding along whatever is in the way
      const walk = (goal, v) => {
        const dx = goal.x - P.x, dz = goal.z - P.z, d = Math.hypot(dx, dz);
        if (d < 0.05) return true;
        const s = Math.min(d, v * dt);
        const nx = P.x + (dx / d) * s, nz = P.z + (dz / d) * s;
        if (W.free(nx, nz)) { P.x = nx; P.z = nz; return true; }
        if (W.free(nx, P.z)) { P.x = nx; return true; }
        if (W.free(P.x, nz)) { P.z = nz; return true; }
        return false;
      };
      const rows = [], trail = [];
      let t = 0, away = null, lastDone = g.G.done.size, cur = null, viol = 0, wall = 0, pstuck = 0, stuck = 0, still = 0, lastPos = { x: g.G.x, z: g.G.z }, rest = 0, fieldMs = 0;
      const start0 = { moved: 0 };
      const cone = (() => { const dx = g.G.x - P.x, dz = g.G.z - P.z; return Math.acos((dx * 0 + dz * -1) / Math.hypot(dx, dz)) * 180 / Math.PI; })();
      sync();
      const home0 = { x: g.G.x, z: g.G.z, state: g.G.state };
      while (t < 900) {
        // the player: stands a moment after each engagement, else follows the dog, stepping into the ring once the dog waits by it
        const S = g.G;
        if (rest > 0) { rest -= dt; }
        else if (away && dist(P, away) < 5) {
          // and then wanders off the spot, the way it came, so the dog moves on
          const dx = P.x - away.x, dz = P.z - away.z, d = Math.hypot(dx, dz) || 1;
          const goal = { x: P.x + (dx / d) * 2, z: P.z + (dz / d) * 2 };
          lookAt(goal.x, goal.z); if (!walk(goal, 2.3)) { if (!walk({ x: P.x - (dz / d) * 2, z: P.z + (dx / d) * 2 }, 2.3)) pstuck += dt; }
        } else {
          away = null;
          const tgt = S.target;
          let goal = null;
          if (tgt && (S.state === 'atSpot' || (S.state === 'lead' && dist(S, tgt) < 2.5))) goal = tgt;
          else if (dist(P, S) > 3.2 && S.state !== 'home') goal = S;
          else if (S.state === 'home' && t < 3) goal = { x: P.x, z: P.z - 1 };      // walk off the view toward the store
          if (goal) { lookAt(goal.x, goal.z); if (!walk(goal, 2.3)) pstuck += dt; }
        }
        // the dog
        const t0 = performance.now();
        g.step(dt, P);
        fieldMs += performance.now() - t0;
        t += dt;
        if (Math.round(t * 30) % 15 === 0) sync();
        if (Math.round(t * 30) % 6 === 0) trail.push([+S.x.toFixed(2), +S.z.toFixed(2)]);
        // checks
        if (!W.free(S.x, S.z)) viol++;
        if (hit(S.x, S.z)) wall++;
        if (S.state === 'lead' && dist(P, S) < 9) {
          if (dist(S, lastPos) < 0.3) { still += dt; if (still > 4) { stuck += dt; } } else { still = 0; lastPos = { x: S.x, z: S.z }; }
        } else still = 0;
        // a new target, or one done
        if (S.target?.id !== cur?.id && S.state === 'lead') { cur = { id: S.target.id, t0: t, moved: S.moved, from: { x: S.x, z: S.z }, p0: { x: P.x, z: P.z } }; }
        if (S.done.size > lastDone) {
          lastDone = S.done.size;
          if (cur) rows.push({ id: cur.id, secs: +(t - cur.t0).toFixed(1), dogM: +(S.moved - cur.moved).toFixed(1), crowM: +dist(cur.p0, S.target).toFixed(1) });
          rest = 3; away = { x: S.target?.x ?? P.x, z: S.target?.z ?? P.z };
          cur = null;
        }
        if (S.state === 'nap' && S.posture > 1.9) break;
      }
      // the map: the grid (black solid, grey asphalt, pale pavement) and the trail (red)
      const c = document.createElement('canvas');
      const sc = 2;
      c.width = W.nx * sc; c.height = W.nz * sc;
      const ctx = c.getContext('2d');
      for (let iz = 0; iz < W.nz; iz++) for (let ix = 0; ix < W.nx; ix++) {
        const k = W.cost[iz * W.nx + ix];
        ctx.fillStyle = k === 0 ? '#111' : k >= 50 ? '#777' : k >= 20 ? '#9a9' : k <= 10 ? '#eee' : '#cdc';
        ctx.fillRect(ix * sc, (W.nz - 1 - iz) * sc, sc, sc);
      }
      ctx.strokeStyle = '#e02020'; ctx.lineWidth = 2; ctx.beginPath();
      trail.forEach(([x, z], i) => { const px = ((x - W.X0) / W.C) * sc, pz = (W.nz - (z - W.Z0) / W.C) * sc; i ? ctx.lineTo(px, pz) : ctx.moveTo(px, pz); });
      ctx.stroke();
      return { cone: +cone.toFixed(0), home0, rows, secs: +t.toFixed(0), end: g.state(), viol, wall, pstuck: +pstuck.toFixed(1), stuck: +stuck.toFixed(1), gridMs: +W.ms.toFixed(0), cells: W.N, dogMs: +fieldMs.toFixed(0), steps: Math.round(t * 30), map: c.toDataURL('image/png') };
    });
    fs.writeFileSync(path.join(out, 'trail.png'), Buffer.from(r.map.split(',')[1], 'base64'));
    delete r.map;
    const ok = r.cone > 60 && r.rows.length === 4 && r.viol === 0 && r.wall === 0 && r.stuck === 0 && r.end.state === 'nap';
    if (!ok) bad++;
    console.log(ok ? 'pass' : 'FAIL', 'guide', JSON.stringify(r, null, 1));
    console.log(`  ${(r.dogMs / r.steps).toFixed(3)} ms per step for the dog (grid and fields included)`);
  }
} finally {
  if (errs.length) { console.log('page errors:'); for (const e of errs.slice(0, 10)) console.log('  ', e); }
  await close();
}
if (bad || errs.length) process.exitCode = 1;
