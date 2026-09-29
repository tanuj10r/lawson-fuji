// Scenario 4, the lingerer: 20+ minutes in the town.  Follows Hachi's tour on the arrow keys (a simple
// follower: walk at the pup, step into the ring it waits by), changes the time of day every two minutes,
// pauses now and then, and samples every 30 s: JS heap (CDP), DOM nodes, three.js geometries / textures /
// programs, the audio (live buffer sources, oscillators, placed voices), frame times.
//   node qa/04-lingerer.mjs [--minutes 22]
import { open, ready, harness, audioSpy, wait, fps, writeJSON, ART } from './lib.mjs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MIN = +arg('--minutes', '22');
const name = '04-lingerer';
const s = await open({ name, autoplay: false });
await audioSpy(s.context);
const { page } = s;
const cdp = await s.context.newCDPSession(page);
await cdp.send('Performance.enable');
const ev = (fn, a) => page.evaluate(fn, a);
const samples = [], events = [];
const note = (k, v) => { events.push({ t: s.at(), k, v }); console.log(`[${s.at()}] ${k}`, JSON.stringify(v).slice(0, 400)); };
const metrics = async () => {
  const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  return { heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), heapTotalMB: +(m.JSHeapTotalSize / 1048576).toFixed(1), nodes: m.Nodes, listeners: m.JSEventListeners, docs: m.Documents };
};
const sample = async (label = '') => {
  const f = await fps(page, 2500);
  const g = await ev(() => ({
    gl: (() => { const i = window.__scene.renderer.info; return { geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length ?? 0 }; })(),
    audio: { live: window.__qaAudio.live, peak: window.__qaAudio.peak, osc: window.__qaAudio.osc, oscPeak: window.__qaAudio.oscPeak, voices: window.__scene.sound.debug._voices.size, zonesLive: window.__soundZones.filter((z) => z.node?.src).map((z) => z.name), log: window.__scene.sound.debug.log.length, media: window.__qaAudio.media.length },
    look: window.__scene.sound.debug.state.look,
    pos: [+window.__scene.player.pos.x.toFixed(1), +window.__scene.player.pos.z.toFixed(1)],
    guide: (({ state, leg, target, done }) => ({ state, leg, target, done: done.length }))(window.__guide.state()),
    locked: window.__scene.player.locked,
  }));
  const m = await metrics();
  const r = { t: s.at(), label, ...m, fps: f.fps, p95: f.p95, max: f.max, over50: f.over50, ...g };
  samples.push(r);
  console.log(`[${r.t}s] heap ${r.heapMB} MB, nodes ${r.nodes}, fps ${r.fps} (p95 ${r.p95} ms), geo ${g.gl.geometries} tex ${g.gl.textures} prog ${g.gl.programs}, audio live ${g.audio.live} osc ${g.audio.osc} voices ${g.audio.voices} zones ${g.audio.zonesLive.join('+')}, ${g.look}, hachi ${g.guide.state}/${g.guide.target} leg ${g.guide.leg} done ${g.guide.done}`);
  writeJSON(path.join(ART, name, 'samples.json'), { samples, events });
};
const look = (dx, dy = 0) => ev(([dx, dy]) => document.dispatchEvent(new MouseEvent('mousemove', { movementX: dx, movementY: dy, bubbles: true })), [dx, dy]);

try {
  await page.goto(process.env.QA_BASE || 'http://127.0.0.1:5180/');
  await ready(page);
  await wait(500);
  await sample('card');
  await page.click('.overlay .menu-action');
  await wait(1500);
  await harness(page, { lockFake: false, startSound: false });
  await sample('start');
  const T0 = Date.now();
  let lastSample = Date.now(), lastLook = Date.now(), lastPause = Date.now(), looks = ['1', '3', '2'], li = 0, shots = 0, down = false;
  let lastTarget = null, sameTargetSince = Date.now();
  while (Date.now() - T0 < MIN * 60000) {
    // the follower
    const st = await ev(() => {
      const G = window.__guide.G, p = window.__scene.player, st = window.__guide.state();
      const tgt = st.target ? window.__spotOf(st.target) : null;
      return { px: p.pos.x, pz: p.pos.z, yaw: p.yaw, locked: p.locked, gx: G.x, gz: G.z, state: st.state, target: st.target, leg: st.leg, tgt: tgt ? { x: tgt.x, z: tgt.z, hidden: tgt.hidden } : null, done: st.done, menu: !!document.querySelector('.kmenu.on'), visiting: window.__store.shop.visiting, seat: !!p.seat, susp: !!p.suspended };
    }).catch(() => null);
    if (!st) { await wait(500); continue; }
    if (!st.locked) { await page.click('.overlay .menu-action').catch(() => {}); await wait(800); continue; }
    if (st.target !== lastTarget) { note('target', { target: st.target, state: st.state, leg: st.leg, done: st.done }); lastTarget = st.target; sameTargetSince = Date.now(); }
    if (st.menu) { await page.keyboard.press('Digit3'); note('konbini', 'chose 3'); await wait(1000); continue; }
    if (st.visiting || st.susp) { if (down) { await page.keyboard.up('ArrowUp'); down = false; } await wait(1000); continue; }
    if (st.seat) { await wait(4000); await page.keyboard.press('ArrowUp'); continue; }
    // at a stop: walk into the ring; else follow the pup
    let tx = st.gx, tz = st.gz, stopAt = 2.2;
    if ((st.state === 'atSpot' || st.state === 'gate') && st.tgt) { tx = st.tgt.x; tz = st.tgt.z; stopAt = 0.4; }
    // lingering by a place you've done, it waits for you to come away: walk 6 m off the place, past the pup
    if (st.state === 'linger' && st.tgt) {
      const ax = st.gx - st.tgt.x, az = st.gz - st.tgt.z, al = Math.hypot(ax, az) || 1;
      tx = st.tgt.x + (ax / al) * 6.5; tz = st.tgt.z + (az / al) * 6.5; stopAt = 0.6;
    }
    const dx = tx - st.px, dz = tz - st.pz, d = Math.hypot(dx, dz);
    let e = Math.atan2(-dx, -dz) - st.yaw; e = Math.atan2(Math.sin(e), Math.cos(e));
    if (Math.abs(e) > 0.05) await look(-e / 0.0022 * 0.7, 0);
    if (d > stopAt) { if (!down) { await page.keyboard.down('ArrowUp'); down = true; } }
    else if (down) { await page.keyboard.up('ArrowUp'); down = false; if (st.state === 'atSpot' && st.target === 'slowlife') { await page.keyboard.press('KeyE'); } }
    // a player who can't get into the ring but sees the E prompt presses E (Han's glow: see the report)
    if (st.state === 'atSpot' && Date.now() - sameTargetSince > 15000 && (await ev(() => window.__prompt()))) {
      await page.keyboard.press('KeyE'); note('pressed E at', st.target); sameTargetSince = Date.now() - 5000;
    }
    // the bench needs E looking at it from outside its ring (see the report): try from 1.8 m once we stand still there
    if (st.state === 'atSpot' && st.target === 'slowlife' && Date.now() - sameTargetSince > 20000 && d < 2.5) {
      await ev(() => { const b = window.__spotOf('slowlife'); window.__standBy(b.x, b.z, 2.0, 0.5); });
      await wait(300); await page.keyboard.press('KeyE'); note('bench', 'pressed E from outside the ring');
      sameTargetSince = Date.now();
    }
    // a stall: the same target for 3 minutes
    if (Date.now() - sameTargetSince > 180000) { note('stall', { target: st.target, state: st.state, at: [st.px, st.pz], hidden: st.tgt?.hidden }); sameTargetSince = Date.now(); await page.keyboard.press('KeyF'); }
    await wait(120);
    if (Date.now() - lastLook > 120000) { if (down) { await page.keyboard.up('ArrowUp'); down = false; } await page.keyboard.press(`Digit${looks[li++ % 3]}`); lastLook = Date.now(); note('look', looks[(li - 1) % 3]); }
    if (Date.now() - lastPause > 300000) {
      if (down) { await page.keyboard.up('ArrowUp'); down = false; }
      await page.keyboard.press('Space'); await wait(8000);
      const paused = await ev(() => ({ locked: window.__scene.player.locked }));
      const lv = await ev(async () => Promise.all([0, 1].map((i) => window.__qaAudio.level(i, 1000))));
      note('paused 8 s', { ...paused, levels: lv });
      await page.click('.overlay .menu-action').catch(async () => { await page.keyboard.press('Space'); });
      await wait(800);
      lastPause = Date.now();
    }
    if (Date.now() - lastSample > 30000) {
      if (down) { await page.keyboard.up('ArrowUp'); down = false; }
      await sample();
      lastSample = Date.now();
      if (shots++ % 4 === 0) await s.shot(`t${String(Math.round(s.at())).padStart(5, '0')}`);
    }
  }
  if (down) await page.keyboard.up('ArrowUp');
  // idle for 60 s at the end (a long idle), then a forced collection
  await wait(60000);
  await sample('idle-60s');
  await cdp.send('HeapProfiler.collectGarbage');
  await wait(1500);
  await sample('after-gc');
} catch (e) {
  console.error(e);
  note('crash', String(e.stack || e));
} finally {
  writeJSON(path.join(ART, name, 'samples.json'), { samples, events, errors: s.log.errors, http: s.log.http });
  await s.close();
}
