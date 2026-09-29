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
  if (kind === 'intro') g.introReset(); else g.introMark();   // the hello is its own check; elsewhere it has been said
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
  /* the tour's books: how near the player passed each sound place and the gate; the pup's cells on water, in
   * alleys and on paddy plots; flights entered from the side; its feet against the real ground */
  const A = window.__guide.A;
  const hear = Object.fromEntries(Object.entries(A.hear).map(([k, v]) => [k, { need: v[2], min: 999 }]));
  const gateW = A.tour.find((l) => l.id === 'gate');
  let gateMin = 999, waterCells = 0, alleyCells = 0, plotCells = 0, sideEntries = 0, feetLow = 0, feetWorst = 0, lastCell = -1;
  const KC = A.costs;
  const step = () => {
    const t0 = performance.now();
    g.step(dt, P);
    fieldMs += performance.now() - t0;
    t += dt;
    if (Math.round(t * 30) % 15 === 0) sync();
    if (Math.round(t * 30) % 6 === 0) trail.push([+S.x.toFixed(2), +S.z.toFixed(2)]);
    if (!W.free(S.x, S.z) && !(S.act?.name === 'circle')) viol++;
    if (hit(S.x, S.z)) wall++;
    for (const k in hear) { const v = A.hear[k], d = Math.hypot(P.x - v[0], P.z - v[1]); if (d < hear[k].min) hear[k].min = +d.toFixed(1); }
    if (gateW) gateMin = Math.min(gateMin, Math.hypot(P.x - gateW.x, P.z - gateW.z));
    const c = W.cell(S.x, S.z);
    if (c >= 0) {
      if (W.water[c]) waterCells++;
      if (W.cost[c] === KC.alley) alleyCells++;
      if (W.cost[c] === KC.plot) plotCells++;
      if (c !== lastCell && lastCell >= 0) {
        const s = W.stair[c] || W.stair[lastCell];
        if (s) { const dx = (c % W.nx) - (lastCell % W.nx), dz = ((c / W.nx) | 0) - ((lastCell / W.nx) | 0); if ((s === 1 && dz !== 0) || (s === 2 && dx !== 0)) sideEntries++; }
      }
      lastCell = c;
    }
    const gy = world.heightAt(S.x, S.z), low = S.y - gy;
    if (low < -0.035) { feetLow++; feetWorst = Math.min(feetWorst, low); }
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

  if (kind === 'tour') {
    // the follower goes wherever Hachi leads: the whole tour, to the nap
    while (t < 1500) { follow(); step(); if (S.state === 'nap' && S.posture > 1.9) break; }
    res.rows = rows; res.secs = +t.toFixed(0); res.tourM = +S.moved.toFixed(0); res.end = g.state(); res.pstuck = +pstuck.toFixed(1); res.stuck = +stuck.toFixed(1);
    res.hear = hear; res.gateMin = +gateMin.toFixed(1); res.waterCells = waterCells; res.alleyCells = alleyCells; res.plotCells = plotCells; res.sideEntries = sideEntries;
    res.feetLow = feetLow; res.feetWorst = +feetWorst.toFixed(3); res.legs = A.tour.length; res.lastLeg = S.leg;
    const heard = Object.values(hear).every((h) => h.min <= h.need);
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
      ctx.fillStyle = k === 0 ? (W.water[iz * W.nx + ix] ? '#235' : '#111') : k === KC.alley ? '#555' : k === KC.plot ? '#8a7' : k >= 50 ? '#777' : k >= 20 ? '#9a9' : k <= 12 ? '#eee' : '#cdc';
      ctx.fillRect(ix * sc, (W.nz - 1 - iz) * sc, sc, sc);
    }
    ctx.strokeStyle = '#e02020'; ctx.lineWidth = 2; ctx.beginPath();
    trail.forEach(([x, z], i) => { const px = ((x - W.X0) / W.C) * sc, pz = (W.nz - (z - W.Z0) / W.C) * sc; i ? ctx.lineTo(px, pz) : ctx.moveTo(px, pz); });
    ctx.stroke();
    res.map = c.toDataURL('image/png');
    res.ok = rows.length === 4 && viol === 0 && wall === 0 && stuck < 5 && res.end.state === 'nap' && res.respawn.ok && cone > 60
      && heard && gateMin <= 8 && waterCells === 0 && alleyCells === 0 && sideEntries === 0 && feetLow === 0 && t < 900;
  } else if (kind === 'intro') {
    // the hello: never on the famous view (even looking straight at it), once when you look at it off the view, never after a reload that remembers
    const introCount = { onView: 0, off: 0, again: 0 };
    const look = (secs, at) => { for (let k = 0; k < secs * 30; k++) { if (at) lookAt(at.x, at.z); sync(); step(); } };
    g.introReset();
    // on the view, turned round to look at it where it waits behind you
    look(4, S);
    introCount.onView = g.intro();
    // off the view, looking at it as it comes: once
    for (let k = 0; k < 60; k++) { lookAt(P.x, P.z - 2); walk({ x: P.x, z: P.z - 1 }, 2.3); sync(); step(); }
    let fired = null, saidAt = null;
    for (let k = 0; k < 20 * 30; k++) {
      lookAt(S.x, S.z); sync(); step();
      if (fired === null && g.intro() === 1) fired = +t.toFixed(1);
      if (fired !== null && S.state === 'intro' && S.posture > 0.8 && saidAt === null) saidAt = { t: +t.toFixed(1), d: +dist(P, S).toFixed(1), posture: +S.posture.toFixed(2) };
    }
    introCount.off = g.intro();
    const card = typeof document !== 'undefined' && document.getElementById('hachi-card');
    const cardText = card ? card.textContent : null;
    // wander on 20 s, looking at it: still once; then a "reload" with the flag kept: never
    look(20, S);
    const stillOnce = g.intro() === 2;
    g.reset(); g.introReset(); g.introMark();
    P.x = 0; P.z = 16.5;
    for (let k = 0; k < 60; k++) { lookAt(P.x, P.z - 2); walk({ x: P.x, z: P.z - 1 }, 2.3); sync(); step(); }
    look(12, S);
    introCount.again = g.intro();
    g.introReset();
    res.introCount = introCount; res.fired = fired; res.sat = saidAt; res.card = cardText; res.stillOnce = stillOnce;
    res.ok = introCount.onView === 0 && fired !== null && introCount.off >= 1 && stillOnce && introCount.again === 0 && !!saidAt && saidAt.d < 3.5 && !!cardText;
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
    const hist = [];   // where the walker really was, for its true heading (the pup reads a smoothed velocity, not the commanded yaw)
    const heading = () => { const o = hist[Math.max(0, hist.length - 20)]; const dx = P.x - o[0], dz = P.z - o[1], l = Math.hypot(dx, dz); return l > 0.3 ? [dx / l, dz / l] : [Math.sin(yaw), Math.cos(yaw)]; };
    // what could be picked: engagements not done and the tour's waypoints (a leg the player's way counts as much as a spot)
    const options = () => [...spots().filter((e) => !S.done.has(e.id)).map((e) => ({ id: e.id, x: e.x, z: e.z, skipped: S.skipped.has(e.id) })), ...A.tour.map((l, k) => ({ id: l.id ?? `leg${k}`, x: l.x, z: l.z, leg: k })).filter((o) => !S.done.has(o.id))];
    while (t - tTurn < 30) {
      lookAt(P.x + hx * 3, P.z + hz * 3);
      hist.push([P.x, P.z]);
      if (!stride(yaw, 2.3)) { yaw += 0.6; }
      step();
      if (tDrop === null && S.state === 'chase') { tDrop = t - tTurn; dropDist = +dist(P, S).toFixed(1); }
      if (tDrop !== null && tCatch === null && (S.state === 'caught' || S.state === 'lead' || S.state === 'company')) tCatch = t - tTurn - tDrop;
      if (tCatch !== null && next === null && (S.state === 'lead' || S.state === 'company' || S.state === 'invite')) {
        next = S.state === 'lead' ? (S.target?.id ?? `leg${S.target?.k}`) : S.state;
        [hx, hz] = heading();
        candidates = options().map((o) => ({ ...o, angle: +angleTo(o, hx, hz).toFixed(0) }));
        if (S.state === 'lead') nextAngle = +angleTo(S.target, hx, hz).toFixed(0);
      }
      if (tCatch !== null) maxAfter = Math.max(maxAfter, dist(P, S));
      if (next !== null && t - tTurn > 12) break;
    }
    // did anything lie the player's way (within 80 degrees, not done)?
    candidates ??= options().map((o) => ({ ...o, angle: +angleTo(o, hx, hz).toFixed(0) }));
    const anyThatWay = candidates.some((c) => c.angle < 70 && c.id !== first);    // (clearly the player's way, by the walker's own heading)
    res.first = first; res.tDrop = tDrop === null ? null : +tDrop.toFixed(1); res.dropDist = dropDist; res.tCatch = tCatch === null ? null : +tCatch.toFixed(1);
    res.next = next; res.nextAngle = nextAngle; res.candidates = candidates; res.maxAfter = +maxAfter.toFixed(1); res.skipped = [...S.skipped]; res.events = events.slice(0, 14);
    res.ok = !!first && tDrop !== null && tDrop <= 3 && tCatch !== null && tCatch <= 6 && S.skipped.has(first) && !S.done.has(first)
      && (anyThatWay ? (next !== null && next !== first && nextAngle !== null && nextAngle <= 100) : (next === 'company' || next === 'invite' || (nextAngle !== null && nextAngle <= 100)));
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
    const run = (place, label, yaw = 0) => {
      g.reset();
      const dt = 1 / 30;
      Object.assign(S, { x: place.x, z: place.z, state: 'nap', field: null, target: null });
      P.x = 0; P.z = 11; P.yaw = yaw; sync();          // (off the famous view: standing on one, the hero-frame rule wins and it waits behind you)
      for (let k = 0; k < 15; k++) g.step(dt, P);
      const d0 = +dist(P, S).toFixed(1), from = { x: +S.x.toFixed(1), z: +S.z.toFixed(1) };
      // the sound log, in game time (the sim runs faster than the clock, so the log's own times mean nothing here)
      const log = window.__scene.sound.debug.log; log.length = 0;
      let seen = 0, tWhistle = null, tYip = null, whistles = 0, yips = 0;
      const readLog = (tt) => { for (; seen < log.length; seen++) { const n = log[seen].name; if (n === 'whistle') { whistles++; tWhistle ??= tt; } if (n === 'dog-yip') { yips++; tYip ??= tt; } } };
      g.whistle(); g.whistle();                          // a double press: one whistle, one answer
      readLog(0);
      let tt = 0, reached = null, resumed = null, states = [], at = null, d1 = null, angle = null, perkUp = 0, runF = 0, seenF = 0, greeted = false, popped = null;
      while (tt < 60) {
        g.step(dt, P); tt += dt;
        readLog(tt);
        if (tt < 0.8 && S.perk > 1.05) perkUp++;
        if (at === null && tt >= 1.0) {
          at = { x: +S.x.toFixed(1), z: +S.z.toFixed(1) }; d1 = +dist(P, S).toFixed(1);
          const dx = S.x - P.x, dz = S.z - P.z; angle = +(Math.acos((-Math.sin(P.yaw) * dx - Math.cos(P.yaw) * dz) / Math.hypot(dx, dz)) * 180 / Math.PI).toFixed(0);   // out of the lens (looking -z)?
        }
        if (!states.includes(S.state)) states.push(S.state);
        if (S.act?.name === 'greet') greeted = true;
        // the moment it answers: moved (a jump) only to where you can't see it, or far off; never popping up in view
        if (popped === null && S.state === 'come') { const dx = S.x - P.x, dz = S.z - P.z, d = Math.hypot(dx, dz) || 1, jumped = Math.abs(d - d0) > 1; const lens = (-Math.sin(P.yaw) * dx - Math.cos(P.yaw) * dz) / d > Math.cos(40 * Math.PI / 180); popped = jumped && lens && d < 26 && !W.hidden(S.x, S.z, P.x, P.z); }
        // the run you watch: from the answer until it is with you, in the lens (35 degrees) with nothing between
        if (tt > 0.9 && reached === null) { runF++; const dx = S.x - P.x, dz = S.z - P.z, d = Math.hypot(dx, dz) || 1; if ((-Math.sin(P.yaw) * dx - Math.cos(P.yaw) * dz) / d > Math.cos(33 * Math.PI / 180) && !W.hidden(S.x, S.z, P.x, P.z)) seenF++; }   // on screen (hfov 70) and not behind anything
        if (reached === null && dist(P, S) < 5) reached = +tt.toFixed(1);
        if (reached !== null && resumed === null && tt > 1.2 && ['lead', 'company', 'invite', 'nap'].includes(S.state)) { resumed = { t: +tt.toFixed(1), state: S.state, target: S.target?.id ?? null }; break; }
      }
      return { label, from, d0, at, d1, angle, reached, resumed, states, whistles, yips, tWhistle, tYip: tYip === null ? null : +tYip.toFixed(2), earsUpFrames: perkUp, seen: +(seenF / Math.max(1, runF)).toFixed(2), greeted, popped };
    };
    const bench = window.__scene.world.frame.toWorld({ x: 75.6, z: 103.6 });
    const far = run(bench, 'bench, 100+ m (you facing the store: it can only come round the store\'s corner)');
    const far2 = run(bench, 'bench, 100+ m, you facing the car park', Math.PI);
    // and 40 m up the main road (under the "appear from a corner" distance): it must run all the way
    let mid = null;
    for (const cand of [{ x: 0, z: -24 }, { x: 4.6, z: -22 }, { x: -3, z: -22 }]) { const c = W.nearest(cand.x, cand.z, 4); if (c >= 0) { mid = W.at(c); break; } }
    const behind = mid ? run(mid, 'behind the store, ~35 m') : null;
    // and in plain view ahead (the camera looking along open street): it runs from where it is, no jump
    let ahead = null;
    for (const yaw of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
      for (const d of [22, 18, 14]) {
        const c = W.nearest(P.x - Math.sin(yaw) * d, P.z - Math.cos(yaw) * d, 3);
        if (c < 0) continue;
        const q = W.at(c);
        if (W.sight(q.x, q.z, 0, 11)) { ahead = { q, yaw }; break; }
      }
      if (ahead) break;
    }
    const near = ahead ? run(ahead.q, 'in view, ~20 m', ahead.yaw) : null;
    // and beside you already (2 m): no run, just the answer once the whistle is over
    const here = (() => {
      g.reset();
      P.x = 0; P.z = 11; P.yaw = 0; sync();
      for (let k = 0; k < 90; k++) g.step(1 / 30, P);        // it comes and starts leading
      const c = W.nearest(P.x, P.z - 2, 2); const q = c >= 0 ? W.at(c) : { x: P.x, z: P.z - 2 };
      Object.assign(S, { x: q.x, z: q.z, state: 'company', field: null, act: null, sinceInvite: 0 });   // (no invitation due, so what it does next is the answer alone)
      const log = window.__scene.sound.debug.log; log.length = 0;
      const d0 = +dist(P, S).toFixed(1);
      g.whistle(); g.whistle();
      let tt = 0, seen = 0, tWhistle = null, tYip = null, whistles = 0, yips = 0, hopped = false, ran = false, greetAt = null;
      while (tt < 4) {
        g.step(1 / 30, P); tt += 1 / 30;
        for (; seen < log.length; seen++) { const n = log[seen].name; if (n === 'whistle') { whistles++; tWhistle ??= +tt.toFixed(2); } if (n === 'dog-yip') { yips++; tYip ??= +tt.toFixed(2); } }
        if (S.act?.name === 'greet') hopped = true;
        if (S.act?.name === 'greet' && greetAt === null) greetAt = +dist(P, S).toFixed(1);
        if (S.state === 'chase' || dist(P, S) > 6) ran = true;   // (it bounds out in front of you to greet you; it must not run off)
      }
      return { d0, whistles, yips, tWhistle, tYip, hopped, ran, greetAt, d1: +dist(P, S).toFixed(1) };
    })();
    res.far = far; res.far2 = far2; res.behind = behind; res.near = near; res.here = here;
    const timing = (r) => r.whistles === 1 && r.yips >= 1 && r.tYip !== null && r.tYip - (r.tWhistle ?? 0) >= 0.52;
    // Tan: seen running to you, wherever you look: far off, it sets out ahead of you, in the lens, and you watch it come
    res.ok = far.reached !== null && far.reached <= 8 && far.d1 >= 7 && far.d1 <= 20 && far.angle < 52 && far.seen >= 0.25 && far.popped === false && far.greeted && !!far.resumed && timing(far)
      && far2.reached !== null && far2.reached <= 8 && far2.seen >= 0.6 && far2.popped === false && far2.greeted && !!far2.resumed && timing(far2)
      && (!behind || (behind.reached !== null && behind.reached <= 8 && behind.angle < 52 && behind.seen >= 0.25 && behind.popped === false && behind.greeted && !!behind.resumed && timing(behind)))
      && !!near && near.reached !== null && near.reached <= near.d0 / 3.5 + 3 && Math.abs(near.d1 - near.d0) < 0.5 && near.seen >= 0.85 && near.popped === false && near.greeted && !!near.resumed && timing(near) && near.earsUpFrames > 5
      && here.whistles === 1 && here.yips >= 1 && here.tYip - here.tWhistle >= 0.52 && here.hopped && !here.ran && here.greetAt >= 3.2 && here.greetAt <= 5.2;
  } else if (kind === 'tipsy') {
    // the Strong Nine: the pup napping by the bench far off, you tipsy on the main road looking up it: it comes into
    // view, to just in front of you, and giggles and rolls about until the ten seconds are up
    g.reset();
    const dt = 1 / 30;
    const bench = window.__scene.world.frame.toWorld({ x: 75.6, z: 103.6 });
    Object.assign(S, { x: bench.x, z: bench.z, state: 'nap', field: null, target: null });
    P.x = 0; P.z = 11; P.yaw = 0; sync();
    for (let k = 0; k < 15; k++) g.step(dt, P);
    const log = window.__scene.sound.debug.log; log.length = 0;
    g.tipsy(10);
    let tt = 0, there = null, rolls = 0, lastAct = null, inLens = 0, frames = 0, giggles = 0, seen = 0, endState = null;
    while (tt < 13) {
      g.step(dt, P); tt += dt;
      for (; seen < log.length; seen++) if (log[seen].name === 'dog-giggle') giggles++;
      if (S.act?.name !== lastAct) { lastAct = S.act?.name ?? null; if (lastAct === 'roll') rolls++; }
      if (there === null && dist(P, S) < 5) there = +tt.toFixed(1);
      if (tt > 1 && tt < 10) { frames++; const dx = S.x - P.x, dz = S.z - P.z, d = Math.hypot(dx, dz) || 1; if (-dz / d > Math.cos(40 * Math.PI / 180)) inLens++; }
    }
    endState = S.state;
    res.tipsy = { there, rolls, giggles, inLens: +(inLens / frames).toFixed(2), endState };
    res.ok = there !== null && there <= 4 && rolls >= 2 && giggles >= 3 && inLens >= 0.85 && endState !== 'party';
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
      // the engine really putting sound out before the first measure (it was 0 on a slow start)
      for (let k = 0; k < 20 && (await dbg.level(250)).peak < 0.001; k++) await new Promise((r) => setTimeout(r, 250));
      const out = {};
      for (const n of ['dog-yip', 'dog-boof', 'dog-whine', 'dog-hmm', 'dog-pant', 'dog-shake', 'dog-snore', 'dog-awoo', 'dog-snort', 'dog-sneeze', 'dog-giggle', 'whistle']) {
        await new Promise((r) => setTimeout(r, 900));
        // the town's own sound varies: its level is the median of three short reads
        const bs = [(await dbg.level(200)).peak, (await dbg.level(200)).peak, (await dbg.level(200)).peak].sort((a, b) => a - b);
        const before = { peak: bs[1] };
        snd.oneShot(n, { gain: 0.7, recipe: n });
        const during = await dbg.level(700);
        out[n] = { before: +before.peak.toFixed(3), peak: +during.peak.toFixed(3) };
      }
      dbg.log.length = 0;
      return out;
    });
    const loud = voice.error ? false : Object.values(voice).every((v) => v.peak > 0.01 && v.peak > v.before * 1.4 && v.peak - v.before > 0.005);
    if (!loud) bad++;
    console.log(loud ? 'pass' : 'FAIL', 'voice', JSON.stringify(voice));

    for (const kind of ['tour', 'intro', 'turnaway', 'wander', 'whistle', 'tipsy'].filter((k) => !ONLY || ONLY.split(',').includes(k))) {
      const r = await page.evaluate(SIM, kind);
      if (r.map) { fs.writeFileSync(path.join(out, 'trail.png'), Buffer.from(r.map.split(',')[1], 'base64')); delete r.map; }
      const said = await page.evaluate(() => { const l = [...new Set(window.__scene.sound.debug.log.map((e) => e.name).filter((n) => /^dog-|^whistle/.test(n ?? '')))]; window.__scene.sound.debug.log.length = 0; return l; });
      r.said = said;
      if (kind === 'tour' && said.length < 2) r.ok = false;
      if (!r.ok) bad++;
      console.log(r.ok ? 'pass' : 'FAIL', kind, JSON.stringify(r, null, 1));
    }
  }
} finally {
  if (errs.length) { console.log('page errors:'); for (const e of errs.slice(0, 10)) console.log('  ', e); }
  await close();
}
if (bad || errs.length) process.exitCode = 1;
