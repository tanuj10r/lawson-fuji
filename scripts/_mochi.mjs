// dev helper: ぺったん堂, the mochi-pounding shop (world/mochi/), played headless.
//
//   node scripts/_mochi.mjs [outdir]
//
// The real loop runs with sound on.  Checks: the show starts only when you
// are near and is silent at the famous view and down the shopping street;
// the rabbits' clock is the recording's own (never more than a frame off it,
// standing still under the pause card); the cue table against the encoded
// file (each mallet strike's thud, found in the decoded audio, against its
// `hit` cue); buying one (the prompt and toast in English, the card's
// ka-ching, the mochi served, taken and eaten, you set free again); Hachi
// sat watching, his treat and his sneeze.  Frames of each go to outdir.
//
// Starts its own dev server (PORT, default 5195; VITE_CACHE_DIR for a private
// vite cache) and Chrome, queued on the shots lock, and closes both however it ends.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.resolve(process.argv[2] ?? path.join(ROOT, '.shots', 'mochi'));
fs.mkdirSync(out, { recursive: true });

const LOCK = path.join(os.tmpdir(), 'takemebacktojapan-shots.lock');
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

const server = await createServer({
  root: ROOT, logLevel: 'error', ...(process.env.VITE_CACHE_DIR ? { cacheDir: process.env.VITE_CACHE_DIR } : {}),
  server: { port: +process.env.PORT || 5195, strictPort: !!process.env.PORT, host: '127.0.0.1' },
});
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

let bad = 0;
const save = (name, data) => { if (data) fs.writeFileSync(path.join(out, name + '.jpg'), Buffer.from(data.split(',')[1], 'base64')); };
async function step(name, fn, check, arg) {
  let r;
  try { r = await page.evaluate(fn, arg); } catch (e) { r = { error: String(e).slice(0, 500) }; }
  for (const [k, v] of Object.entries(r ?? {})) if (typeof v === 'string' && v.startsWith('data:image')) { save(`${name}-${k}`, v); delete r[k]; }
  const ok = !r?.error && (check ? !!check(r) : true);
  if (!ok) bad++;
  console.log(ok ? 'pass' : 'FAIL', name, JSON.stringify(r));
  return r;
}
const english = (x) => !!x && !/[぀-ヿ一-鿿]/.test(x);

try {
  await page.goto(base);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 170000, polling: 250 });
  await page.evaluate(async () => {
    const { player, sound } = window.__scene;
    window.wait = (ms) => new Promise((r) => setTimeout(r, ms));
    window.frames = (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    window.put = (x, z, yaw = Math.PI, pitch = -0.2) => { player.pos.set(x, player.pos.y, z); player.yaw = yaw; player.pitch = pitch; player.vel.set(0, 0, 0); };
    window.snap = async (W = 1280, H = 720) => (await window.__shot('x', W, H, { returnData: true })).data;
    player.locked = true;
    await sound.start();
    sound.setMenu(false);
    window.__guide?.introMark?.();
    await window.wait(600);
  });

  /* far off: nothing of it plays or sounds */
  await step('far', async () => {
    const { sound } = window.__scene, M = window.__mochi;
    window.put(0, 16.5, 0, 0.1);
    await window.wait(1500);
    return { state: M.S.state, played: sound.debug.log.filter((e) => e.name === 'mochi-pound').length, inManifest: !!sound.debug.manifest['mochi-pound'] };
  }, (r) => r.state === 'idle' && r.played === 0);

  /* near: the show starts, on the file; the rabbits' clock is the recording's */
  const sync = await step('show', async () => {
    const { sound } = window.__scene, M = window.__mochi;
    const w = M.world;
    // (a jump: the sound's listener catches up a frame later, so the show is held until it has)
    M.hold(true); window.put(w.spot.x, w.spot.z, Math.PI, -0.2); await window.frames(4); M.hold(false);
    const t0 = performance.now();
    while (!(M.S.state === 'show' && M.S.handle?.pos) && performance.now() - t0 < 8000) await window.frames(1);
    if (!M.S.handle?.pos) return { error: 'the show did not start on a sound', state: M.S.state, handle: !!M.S.handle };
    const entry = sound.debug.log.filter((e) => e.name === 'mochi-pound').pop();
    const ac = sound.debug.ac, h = M.S.handle;
    // every frame for one show: the audio clock, the recording's position, the show's clock, each cue as it fires
    const rows = [], fired = [];
    let ci = M.S.ci, last = null, drift = 0, frame = 0, n = 0, shots = {};
    const a0 = ac.currentTime, p0 = h.pos();
    const want = { hit: 1.0, turn: 1.41, cheer: 11.05, bow: 14.4 };
    while (M.S.shows === 1 && M.S.state === 'show' && performance.now() - t0 < 30000) {
      await window.frames(1);
      const now = performance.now(), pos = h.ended ? null : h.pos(), t = M.S.t;
      if (last !== null) frame = Math.max(frame, now - last);
      last = now; n++;
      if (pos !== null) drift = Math.max(drift, Math.abs(t - pos - 0.03));
      while (ci < M.S.ci) { const c = M.cues[ci++]; fired.push({ kind: c.kind, t: c.t, late: +((t - c.t) * 1000).toFixed(1) }); }
      for (const [k, at] of Object.entries(want)) if (!shots[k] && t >= at) { shots[k] = await window.snap(); last = null; }
      rows.push(t);
    }
    const a1 = ac.currentTime, p1 = h.pos?.() ?? 0;
    const late = fired.map((f) => f.late);
    return {
      src: entry?.src, k: entry?.k, frames: n, worstFrameMs: +frame.toFixed(1), clockOffMs: +(drift * 1000).toFixed(2),
      cues: fired.length, lateMsMax: Math.max(...late), lateMsMean: +(late.reduce((a, b) => a + b, 0) / late.length).toFixed(1),
      hits: fired.filter((f) => f.kind === 'hit').length, ended: h.ended, endT: +M.S.t.toFixed(2), outputLatencyMs: +((ac.outputLatency ?? 0) * 1000).toFixed(1), baseLatencyMs: +((ac.baseLatency ?? 0) * 1000).toFixed(1),
      ...shots,
    };
  }, (r) => (r.src === 'file' || r.src === 'file-late') && r.cues === 31 && r.clockOffMs < r.worstFrameMs + 5 && r.lateMsMax < r.worstFrameMs + 25 && r.hits === 8);   // (never more than a frame behind the recording)

  /* the cue table against the encoded file: each strike's thud in the decoded audio */
  await step('cues-vs-file', async () => {
    const { sound } = window.__scene, M = window.__mochi;
    const man = sound.debug.manifest['mochi-pound'];
    if (!man) return { skipped: 'no file: the recipe follows the table by construction' };
    const b = sound.debug.buffers.get('mochi-pound');
    const sr = b.sampleRate, x = b.getChannelData(0), pad = Math.min(2112 / sr, Math.max(0, b.duration - man.duration));
    // the mallet's crack: the broadband level's sharpest rise within 90 ms of the cue (2 ms windows; where a call lands
    // on the blow, as at 7.5, 9.1 and 10.6 s, this picks the voice: those three read up to 60 ms off, the others under 10)
    const w = Math.round(sr * 0.002), env = [];
    for (let i = 0; i + w <= x.length; i += w) { let m = 0; for (let k = 0; k < w; k++) m = Math.max(m, Math.abs(x[i + k])); env.push(m); }
    const rows = M.cues.filter((c) => c.kind === 'hit').map((c) => {
      const i0 = Math.round((c.t + pad - 0.09) / 0.002), i1 = Math.round((c.t + pad + 0.09) / 0.002);
      let best = 0, at = i0;
      for (let i = i0 + 3; i < i1; i++) { const rise = env[i] - Math.max(env[i - 1], env[i - 2], env[i - 3]); if (rise > best) { best = rise; at = i; } }
      return { cue: c.t, thud: +(at * 0.002 - pad).toFixed(3), offMs: Math.round((at * 0.002 - pad - c.t) * 1000) };
    });
    return { pad: +pad.toFixed(4), dur: +b.duration.toFixed(3), worstMs: Math.max(...rows.map((r) => Math.abs(r.offMs))), rows };
  }, (r) => r.skipped || r.worstMs <= 65);

  /* under the pause card the recording stands still, and the rabbits with it */
  await step('pause', async () => {
    const { sound } = window.__scene, M = window.__mochi;
    const t0 = performance.now();
    while (!(M.S.state === 'show' && M.S.handle?.pos && M.S.t > 1.2 && M.S.t < 9) && performance.now() - t0 < 25000) await window.frames(1);
    const h = M.S.handle;
    sound.setMenu(true);
    await window.wait(300);
    const a = h.pos(), sa = M.S.t;
    await window.wait(900);
    const b = h.pos(), sb = M.S.t;
    sound.setMenu(false);
    await window.wait(500);
    const c = h.pos();
    return { heldMs: +((b - a) * 1000).toFixed(1), showHeldMs: +((sb - sa) * 1000).toFixed(1), resumed: c > b + 0.2 };
  }, (r) => Math.abs(r.heldMs) < 5 && Math.abs(r.showHeldMs) < 40 && r.resumed);

  /* local: heard on the stage, not at the famous view, not at ドンペン堂 */
  await step('local', async () => {
    const { sound, camera, player } = window.__scene, M = window.__mochi;
    const level = async (x, z) => {
      window.put(x, z, 0, 0); await window.frames(3);
      const d = Math.hypot(x - M.world.usu.x, z - M.world.usu.z);
      const v = [...sound.debug._voices].filter((q) => Math.abs(q.at.x - M.world.usu.x) < 0.1);
      return { d: +d.toFixed(1), k: v.length ? +Math.max(...v.map((q) => q.gain * (d <= q.range.near ? 1 : d >= q.range.far ? 0 : 1))).toFixed(2) : 0, far: v.length ? d >= v[0].range.far : true };
    };
    const t0 = performance.now();
    window.put(M.world.spot.x, M.world.spot.z);
    while (!(M.S.state === 'show' && M.S.handle?.pos && M.S.t < 8) && performance.now() - t0 < 25000) await window.frames(1);
    const here = await level(M.world.spot.x, M.world.spot.z);
    const view = await level(1.6, 14.6), donki = await level(55.9, -41.4), zebra = await level(50, -2.3);
    window.put(M.world.spot.x, M.world.spot.z);
    return { here, view, donki, zebra };
  }, (r) => r.here.k > 0 && !r.here.far && r.view.far && r.donki.far && r.zebra.far);

  /* Hachi comes and sits to watch */
  await step('hachi-watches', async () => {
    const { GUIDE_ } = window, M = window.__mochi, G = window.__guide.G;
    window.put(M.world.spot.x, M.world.spot.z, Math.PI, -0.32);
    Object.assign(G, { x: M.world.spot.x - 2.2, z: M.world.spot.z + 0.2, state: 'wait', act: null, since: 0, waitT: 0 });
    const t0 = performance.now();
    let sat = false, nods = 0, lastHit = M.S.hitT;
    while (performance.now() - t0 < 16000) {
      await window.frames(1);
      const seat = M.world.seat;
      if (!sat && Math.hypot(G.x - seat.x, G.z - seat.z) < 0.3 && G.posture > 0.8) sat = performance.now() - t0;
      if (sat && M.S.hitT !== lastHit) { lastHit = M.S.hitT; await window.frames(3); if (G.nod > 0.02) nods++; }
      if (sat && nods >= 2) break;
    }
    return { satAfterMs: sat ? Math.round(sat) : null, nods, state: G.state, posture: +G.posture.toFixed(2), off: +Math.hypot(G.x - M.world.seat.x, G.z - M.world.seat.z).toFixed(2), show: M.S.state, shot: await window.snap() };
  }, (r) => r.satAfterMs !== null && r.nods >= 2);

  /* buying one */
  await step('buy', async () => {
    const { player, hud, sound, world } = window.__scene, M = window.__mochi;
    window.put(M.world.spot.x, M.world.spot.z, Math.PI, -0.25);
    await window.frames(20);
    const item = world.interactables.find((i) => /Buy a mochi/.test(i.label));
    if (!item) return { error: 'no Buy a mochi interactable' };
    const prompt = `E  ·  ${item.label.replace(/^.*?·\s*/, '')}`;
    const hovered = player.pick(world.interactables) === item;
    const log0 = sound.debug.log.length;
    const toasts = [];
    const flash = hud.flash.bind(hud);
    hud.flash = (text, ...a) => { toasts.push(text); return flash(text, ...a); };
    const t0 = performance.now();
    player.onInteract(item);
    const seen = { served: false, onPlate: false, held: false, stretch: false, treat: false, suspended: player.suspended };
    const shots = {}, want = { '1-card': 0.5, '2-carried': 1.5, '3-set': 2.2, '4-take': 2.62, '5-treat': 3.35, '6-pull': 4.42, '7-bite2': 5.6, '8-last': 6.3 };
    while (M.buy && performance.now() - t0 < 20000) {
      await window.frames(1);
      const b = M.buy; if (!b) break;
      if (M.served.visible) { seen.served = true; if (b.t > 2.0 && b.t < 2.4) seen.onPlate = true; }
      if (M.held()?.parent) seen.held = true;
      if (M.potato.visible) seen.treat = true;
      for (const [k, at] of Object.entries(want)) if (!shots[k] && b.t >= at) shots[k] = await window.snap();
    }
    hud.flash = flash;
    const names = sound.debug.log.slice(log0).map((e) => e.name);
    return {
      prompt, hovered, seconds: +((performance.now() - t0) / 1000).toFixed(1), ...seen, done: !M.buy, free: !player.suspended, toasts,
      kaching: names.includes('ka-ching'), bites: names.filter((n) => n === 'bite').length, sneeze: names.includes('dog-sneeze'),
      handDown: (await window.wait(700), window.__store.shop.hands.up < 0.05), ...shots,
    };
  }, (r) => r.prompt === 'E  ·  Buy a mochi  ¥200' && english(r.prompt) && r.served && r.held && r.done && r.free && r.kaching && r.bites === 3 && r.toasts.length === 1 && english(r.toasts[0]) && r.suspended && r.handDown && r.sneeze);

  /* what it costs, on the ring with the show on */
  await step('cost', async () => {
    const { renderer } = window.__scene, M = window.__mochi;
    window.put(M.world.spot.x, M.world.spot.z, Math.PI, -0.2);
    await window.frames(5);
    const on = await window.__shot('x', 1280, 720, { returnData: true, time: 30 });
    const dyn = [];
    M.herd.mesh.parent.traverse((o) => { if (o.isMesh) dyn.push(o); });
    for (const o of dyn) o.visible = false;
    const off = await window.__shot('x', 1280, 720, { returnData: true });
    for (const o of dyn) o.visible = true;
    return { calls: on.mainCalls, tris: on.mainTriangles, ms: +on.ms.toFixed(2), showCalls: on.mainCalls - off.mainCalls, showTris: on.mainTriangles - off.mainTriangles, parts: M.tris(), heapMB: Math.round(performance.memory.usedJSHeapSize / 1048576), textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, atlas: window.__atlasPages };
  });
  if (errs.length) { bad++; console.log('FAIL errors', [...new Set(errs)].slice(0, 8)); }
} catch (e) { bad++; console.log('FAILED', String(e).slice(0, 600)); }
await close();
console.log(bad ? `MOCHI: ${bad} FAILED` : 'MOCHI: all pass');
process.exit(bad ? 1 : 0);
