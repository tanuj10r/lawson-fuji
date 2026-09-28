// dev check: the guide pup (animals/guide.js), headless, end to end.
//
//   node scripts/_guide.mjs [outdir]              the voice check, then four fake players:
//                                                   follow   follows every suggestion: reaches every engagement in turn,
//                                                            how long, how far, ever stuck, ever through anything solid
//                                                   turnaway turns from the first suggestion and walks off: the pup must
//                                                            drop it within ~3 s, catch up within ~6 s, then suggest a
//                                                            spot that lies the player's way
//                                                   wander   wanders aimlessly for 60 s: the pup stays with them (never
//                                                            > 12 m off after catching up) and invites at most every 20 s
//                                                   whistle  the pup far off (napping 40 m and 100+ m away): F brings it
//                                                            to the player in a sensible time and it guides on
//                                                 plus the respawn rule (a jump onto the view: out of the frame) and a
//                                                 map of the follow run's trail
//   node scripts/_guide.mjs --measure [--root d]  draw calls, triangles and frame ms at the hero view
//                                                 and three spots the pup waits at (--root: another checkout)
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
const ONLY = opt('only');   // --only turnaway,whistle: just these scenarios
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
const flags = ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'];
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

/* The fake players, run in the page.  `kind` picks the policy; the sim returns what happened. */
const SIM = async (kind) => {
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
  let prog = { x: P.x, z: P.z, t: 0 }, detour = 0;
  const walk = (goal, v, loose = false) => {
    const dx = goal.x - P.x, dz = goal.z - P.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return true;
    if (!loose && !W.free(P.x, P.z)) { const c = W.nearest(P.x, P.z, 2); if (c >= 0) { const q = W.at(c); P.x = q.x; P.z = q.z; } }
    if (dist(P, prog) > 0.5) prog = { x: P.x, z: P.z, t: 0 }; else if ((prog.t += dt) > 2) detour = 3;
    if (detour > 0 && g.G.field?.ready) {
      detour -= dt;
      const c = W.cell(P.x, P.z), n = c >= 0 ? g.G.field.next(c) : -1;
      if (n >= 0) { const q = W.at(n); const qx = q.x - P.x, qz = q.z - P.z, qd = Math.hypot(qx, qz) || 1, s = Math.min(qd, v * dt); P.x += (qx / qd) * s; P.z += (qz / qd) * s; prog = { x: P.x, z: P.z, t: 0 }; return true; }
    }
    const s = Math.min(d, v * dt);
    const nx = P.x + (dx / d) * s, nz = P.z + (dz / d) * s;
    const clearTo = () => { for (let k = 1; k <= 8; k++) if (hit(P.x + dx * k / 8, P.z + dz * k / 8)) return false; return true; };
    if (W.free(nx, nz) || (loose && d < 2.5 && clearTo())) { P.x = nx; P.z = nz; return true; }
    if (W.free(nx, P.z)) { P.x = nx; return true; }
    if (W.free(P.x, nz)) { P.z = nz; return true; }
    return false;
  };
  // a step along a heading, sliding; false when nothing gives
  const stride = (yaw, v) => walk({ x: P.x + Math.sin(yaw) * 3, z: P.z + Math.cos(yaw) * 3 }, v);
  const S = g.G;
  const spots = () => world.experiences.list.concat(world.lawson.experiences.list).filter((e) => e.kind === 'engage');
  const angleTo = (e, hx, hz) => { const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz) || 1; return Math.acos(Math.max(-1, Math.min(1, (dx * hx + dz * hz) / d))) * 180 / Math.PI; };
  const rows = [], trail = [], events = [];
  let t = 0, away = null, lastDone = S.done.size, cur = null, viol = 0, wall = 0, pstuck = 0, stuck = 0, still = 0, lastPos = { x: S.x, z: S.z }, rest = 0, fieldMs = 0;
  let state = S.state, act = null;
  const acts = new Set(), states = new Set();
  const cone = (() => { const dx = S.x - P.x, dz = S.z - P.z; return Math.acos(-dz / Math.hypot(dx, dz)) * 180 / Math.PI; })();
  sync();
  const home0 = { x: S.x, z: S.z, state: S.state };
  const step = () => {
    const t0 = performance.now();
    g.step(dt, P);
    fieldMs += performance.now() - t0;
    t += dt;
    if (Math.round(t * 30) % 15 === 0) sync();
    if (Math.round(t * 30) % 6 === 0) trail.push([+S.x.toFixed(2), +S.z.toFixed(2)]);
    if (!W.free(S.x, S.z) && !(S.act?.name === 'circle')) viol++;
    if (hit(S.x, S.z)) wall++;
    if (S.state !== state) { events.push({ t: +t.toFixed(1), from: state, to: S.state, target: S.target?.id ?? null, dP: +dist(P, S).toFixed(1) }); state = S.state; states.add(state); }
    if (S.act?.name && S.act.name !== act) acts.add(S.act.name);
    act = S.act?.name ?? null;
  };
  // the follower: stands a moment after each engagement, else follows the pup, stepping into the ring once the pup waits by it
  const follow = () => {
    if (rest > 0) { rest -= dt; }
    else if (away && dist(P, away) < 5) {
      const dx = P.x - away.x, dz = P.z - away.z, d = Math.hypot(dx, dz) || 1;
      const goal = { x: P.x + (dx / d) * 2, z: P.z + (dz / d) * 2 };
      lookAt(goal.x, goal.z); if (!walk(goal, 2.3)) { if (!walk({ x: P.x - (dz / d) * 2, z: P.z + (dx / d) * 2 }, 2.3)) pstuck += dt; }
    } else {
      away = null;
      const tgt = S.target;
      let goal = null;
      if (tgt && (S.state === 'atSpot' || (S.state === 'lead' && dist(S, tgt) < 2.5))) goal = tgt;
      else if (tgt && S.state === 'invite') goal = tgt;
      else if (dist(P, S) > 3.2 && S.state !== 'home') goal = S;
      else if (S.state === 'home' && t < 3) goal = { x: P.x, z: P.z - 1 };      // walk off the view toward the store
      if (goal) { lookAt(goal.x, goal.z); if (!walk(goal, 2.3, goal === tgt)) pstuck += dt; }
    }
    if (S.state === 'lead' && dist(P, S) < 9) {
      if (dist(S, lastPos) < 0.3) { still += dt; if (still > 4) { stuck += dt; } } else { still = 0; lastPos = { x: S.x, z: S.z }; }
    } else still = 0;
    if (S.target?.id !== cur?.id && S.state === 'lead') { cur = { id: S.target.id, t0: t, moved: S.moved, p0: { x: P.x, z: P.z } }; }
    if (S.done.size > lastDone) {
      lastDone = S.done.size;
      if (cur) rows.push({ id: cur.id, secs: +(t - cur.t0).toFixed(1), dogM: +(S.moved - cur.moved).toFixed(1), crowM: +dist(cur.p0, S.target).toFixed(1) });
      rest = 3; away = { x: S.target?.x ?? P.x, z: S.target?.z ?? P.z };
      cur = null;
    }
  };
  const res = { kind, cone: +cone.toFixed(0), home0 };

  if (kind === 'follow') {
    while (t < 900) { follow(); step(); if (S.state === 'nap' && S.posture > 1.9) break; }
    res.rows = rows; res.secs = +t.toFixed(0); res.end = g.state(); res.pstuck = +pstuck.toFixed(1); res.stuck = +stuck.toFixed(1);
    // the respawn (H, or anything that puts you back on the view in a jump): the pup is home, out of the frame, at once
    {
      g.reset();
      const Q = { x: 0, y: 1.6, z: 16.5 };
      for (let k = 0; k < 90; k++) { if (k > 5) Q.z -= 2.3 * dt; g.step(dt, Q); }
      const before = { state: S.state, x: +S.x.toFixed(1), z: +S.z.toFixed(1), d: +dist(Q, S).toFixed(1) };
      Q.x = 0; Q.z = 16.5;
      g.step(dt, Q);
      const dx = S.x - Q.x, dz = S.z - Q.z;
      const angle = Math.acos(-dz / Math.hypot(dx, dz)) * 180 / Math.PI;
      res.respawn = { before, after: { state: S.state, x: +S.x.toFixed(1), z: +S.z.toFixed(1) }, angle: +angle.toFixed(0), ok: angle > 60 && S.state === 'home' };
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
    res.map = c.toDataURL('image/png');
    res.ok = rows.length === 4 && viol === 0 && wall === 0 && stuck < 5 && res.end.state === 'nap' && res.respawn.ok && cone > 60;
  } else if (kind === 'turnaway') {
    // off the view until the pup suggests something; then the other way
    while (t < 20 && !(S.state === 'lead' && S.target)) { lookAt(P.x, P.z - 2); if (t < 3) walk({ x: P.x, z: P.z - 1 }, 2.3); else { if (dist(P, S) > 3.2) { lookAt(S.x, S.z); walk(S, 2.3); } } step(); }
    const first = S.target?.id ?? null;
    // follow it for 2 s (so the suggestion is real), then turn 150-180 degrees from its way and walk
    for (let k = 0; k < 60 && S.state === 'lead'; k++) { lookAt(S.x, S.z); if (dist(P, S) > 2.5) walk(S, 2.3); step(); }
    const tTurn = t;
    let yaw = Math.atan2(P.x - S.x, P.z - S.z);       // away from the pup
    // (a heading that has room: try a few turns off "straight away")
    for (const d of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5]) { const y = yaw + d; if (W.free(P.x + Math.sin(y) * 4, P.z + Math.cos(y) * 4) && W.free(P.x + Math.sin(y) * 8, P.z + Math.cos(y) * 8)) { yaw = y; break; } }
    let tDrop = null, tCatch = null, next = null, nextAngle = null, dropDist = null, maxAfter = 0;
    let hx = Math.sin(yaw), hz = Math.cos(yaw), candidates = null;
    while (t - tTurn < 30) {
      lookAt(P.x + hx * 3, P.z + hz * 3);
      if (!stride(yaw, 2.3)) { yaw += 0.6; }
      step();
      if (tDrop === null && S.state === 'chase') { tDrop = t - tTurn; dropDist = +dist(P, S).toFixed(1); }
      if (tDrop !== null && tCatch === null && (S.state === 'caught' || S.state === 'lead' || S.state === 'company')) tCatch = t - tTurn - tDrop;
      if (tCatch !== null && next === null && (S.state === 'lead' || S.state === 'company' || S.state === 'invite')) {
        next = S.state === 'lead' ? S.target?.id : S.state;
        hx = Math.sin(yaw); hz = Math.cos(yaw);      // the heading the walker really has by now (it turns where nothing gives)
        candidates = spots().filter((e) => !S.done.has(e.id)).map((e) => ({ id: e.id, angle: +angleTo(e, hx, hz).toFixed(0), skipped: S.skipped.has(e.id) }));
        if (S.state === 'lead') nextAngle = +angleTo(S.target, hx, hz).toFixed(0);
      }
      if (tCatch !== null) maxAfter = Math.max(maxAfter, dist(P, S));
      if (next !== null && t - tTurn > 12) break;
    }
    // did anything lie the player's way (within 80 degrees, not done)?
    candidates ??= spots().filter((e) => !S.done.has(e.id)).map((e) => ({ id: e.id, angle: +angleTo(e, hx, hz).toFixed(0), skipped: S.skipped.has(e.id) }));
    const anyThatWay = candidates.some((c) => c.angle < 80 && c.id !== first);
    res.first = first; res.tDrop = tDrop === null ? null : +tDrop.toFixed(1); res.dropDist = dropDist; res.tCatch = tCatch === null ? null : +tCatch.toFixed(1);
    res.next = next; res.nextAngle = nextAngle; res.candidates = candidates; res.maxAfter = +maxAfter.toFixed(1); res.skipped = [...S.skipped]; res.events = events.slice(0, 14);
    res.ok = !!first && tDrop !== null && tDrop <= 3 && tCatch !== null && tCatch <= 6 && S.skipped.has(first) && !S.done.has(first)
      && (anyThatWay ? (next !== null && next !== first && nextAngle !== null && nextAngle <= 80) : (next === 'company' || next === 'invite' || (nextAngle !== null && nextAngle <= 80)));
  } else if (kind === 'wander') {
    // off the view, then a new heading every 4-6 s for 60 s
    for (let k = 0; k < 90; k++) { lookAt(P.x, P.z - 2); walk({ x: P.x, z: P.z - 1 }, 2.3); step(); }
    const t0 = t;
    let yaw = Math.PI * 0.5, until = t, caught = null, maxD = 0, farT = 0;
    const invites = [];
    let prevState = S.state, lastChase = -99;
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    while (t - t0 < 60) {
      if (t >= until) { yaw += (rnd() < 0.5 ? -1 : 1) * (Math.PI / 2 + rnd() * Math.PI / 2); until = t + 4 + rnd() * 2; }
      lookAt(P.x + Math.sin(yaw) * 3, P.z + Math.cos(yaw) * 3);
      if (!stride(yaw, 2.3)) yaw += 0.7;
      step();
      if (S.state === 'chase') lastChase = t;
      if (caught === null && (S.state === 'caught' || (S.state === 'company'))) caught = t - t0;
      if (caught !== null && S.state !== 'chase' && S.state !== 'come') { const d = dist(P, S); if (d > maxD) maxD = d; if (d > 12) farT += dt; }
      if (S.state !== prevState) {
        if ((S.state === 'lead' || S.state === 'invite') && caught !== null) invites.push({ t: +(t - t0).toFixed(1), kind: S.state, target: S.target?.id ?? S.inviteE?.id ?? null, afterChase: t - lastChase < 1.5 });
        prevState = S.state;
      }
    }
    const gaps = [];
    for (let i = 1; i < invites.length; i++) if (!invites[i].afterChase) gaps.push(+(invites[i].t - invites[i - 1].t).toFixed(1));
    const replans = invites.filter((i) => i.afterChase).length;
    res.caught = caught === null ? null : +caught.toFixed(1); res.maxAfter = +maxD.toFixed(1); res.farSecs = +farT.toFixed(1); res.invites = invites; res.gaps = gaps; res.replans = replans;
    res.states = [...states]; res.acts = [...acts]; res.energy = +S.energy.toFixed(2); res.end = S.state;
    res.ok = caught !== null && maxD <= 12 && gaps.every((x) => x >= 19.5) && replans <= 4;
  } else if (kind === 'whistle') {
    // the pup left napping by the bench, the player at the view (about 100 m by the way): F
    const run = (place, label) => {
      g.reset();
      const dt = 1 / 30;
      Object.assign(S, { x: place.x, z: place.z, state: 'nap', field: null, target: null });
      P.x = 0; P.z = 11; P.yaw = 0; sync();          // (off the famous view: standing on one, the hero-frame rule wins and it waits behind you)
      for (let k = 0; k < 15; k++) g.step(dt, P);
      const d0 = +dist(P, S).toFixed(1), from = { x: +S.x.toFixed(1), z: +S.z.toFixed(1) };
      g.whistle();
      const at = { x: +S.x.toFixed(1), z: +S.z.toFixed(1) }, d1 = +dist(P, S).toFixed(1);
      // out of the lens (looking -z)?
      const dx = S.x - P.x, dz = S.z - P.z, angle = +(Math.acos(-dz / Math.hypot(dx, dz)) * 180 / Math.PI).toFixed(0);
      let tt = 0, reached = null, resumed = null, states = [];
      while (tt < 60) {
        g.step(dt, P); tt += dt;
        if (!states.includes(S.state)) states.push(S.state);
        if (reached === null && dist(P, S) < 3) reached = +tt.toFixed(1);
        if (reached !== null && resumed === null && ['lead', 'company', 'invite', 'nap'].includes(S.state)) { resumed = { t: +tt.toFixed(1), state: S.state, target: S.target?.id ?? null }; break; }
      }
      return { label, from, d0, at, d1, angle, reached, resumed, states };
    };
    const bench = window.__scene.world.frame.toWorld({ x: 75.6, z: 103.6 });
    const far = run(bench, 'bench, 100+ m');
    // and 40 m up the main road (under the "appear from a corner" distance): it must run all the way
    let mid = null;
    for (const cand of [{ x: 0, z: -24 }, { x: 4.6, z: -22 }, { x: -3, z: -22 }]) { const c = W.nearest(cand.x, cand.z, 4); if (c >= 0) { mid = W.at(c); break; } }
    const near = mid ? run(mid, 'main road, ~40 m') : null;
    res.far = far; res.near = near;
    res.ok = far.reached !== null && far.reached <= 15 && far.d1 <= 42 && far.angle > 60 && !!far.resumed
      && (!near || (near.reached !== null && near.reached <= near.d0 / 4 + 8 && Math.abs(near.d1 - near.d0) < 0.5 && !!near.resumed));
  }
  res.viol = viol; res.wall = wall; res.gridMs = +W.ms.toFixed(0); res.cells = W.N; res.msPerStep = +(fieldMs / Math.max(1, Math.round(t * 30))).toFixed(3);
  return res;
};

let bad = 0;
try {
  await page.goto(`${base}?shots`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 150000, polling: 250 });

  if (MEASURE) {
    const res = await page.evaluate(async () => {
      const { renderer } = window.__scene;
      const spots = {
        hero1: { hero: 'morning', look: 'day' },
        door: { look: 'day', pos: [-2.3, 0, 6.2], yaw: 0, pitch: 0.1, guide: 'sit' },                                  // outside NIPPON's door, the pup sat by the ring
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
    /* its voice (Tan: "very cute, adorable sounds"): each dog-* recipe, and your whistle, really comes out, at the listener */
    await page.mouse.click(800, 450);
    await page.waitForFunction(() => window.__scene.sound.debug.ac?.state === 'running', null, { timeout: 20000 }).catch(() => {});
    const voice = await page.evaluate(async () => {
      const snd = window.__scene.sound, dbg = snd.debug;
      if (!dbg.ac || dbg.ac.state !== 'running') return { error: 'no sound running' };
      const out = {};
      for (const n of ['dog-yip', 'dog-boof', 'dog-whine', 'dog-hmm', 'dog-pant', 'dog-shake', 'dog-snore', 'dog-awoo', 'dog-snort', 'dog-sneeze', 'whistle']) {
        await new Promise((r) => setTimeout(r, 900));
        const before = await dbg.level(250);
        snd.oneShot(n, { gain: 0.7, recipe: n });
        const during = await dbg.level(700);
        out[n] = { before: +before.peak.toFixed(3), peak: +during.peak.toFixed(3) };
      }
      dbg.log.length = 0;
      return out;
    });
    const loud = voice.error ? false : Object.values(voice).every((v) => v.peak > 0.01 && v.peak > v.before * 1.5);
    if (!loud) bad++;
    console.log(loud ? 'pass' : 'FAIL', 'voice', JSON.stringify(voice));

    for (const kind of ['follow', 'turnaway', 'wander', 'whistle'].filter((k) => !ONLY || ONLY.split(',').includes(k))) {
      const r = await page.evaluate(SIM, kind);
      if (r.map) { fs.writeFileSync(path.join(out, 'trail.png'), Buffer.from(r.map.split(',')[1], 'base64')); delete r.map; }
      const said = await page.evaluate(() => { const l = [...new Set(window.__scene.sound.debug.log.map((e) => e.name).filter((n) => /^dog-|^whistle/.test(n ?? '')))]; window.__scene.sound.debug.log.length = 0; return l; });
      r.said = said;
      if (kind === 'follow' && said.length < 2) r.ok = false;
      if (!r.ok) bad++;
      console.log(r.ok ? 'pass' : 'FAIL', kind, JSON.stringify(r, null, 1));
    }
  }
} finally {
  if (errs.length) { console.log('page errors:'); for (const e of errs.slice(0, 10)) console.log('  ', e); }
  await close();
}
if (bad || errs.length) process.exitCode = 1;
