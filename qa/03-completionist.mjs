// Scenario 3, the completionist: every thing to do and to hear, at least once, then again and again.
// Real Start click (real pointer lock), real key events; the player is carried between places (teleport)
// to keep the run short.  The audio spy counts every buffer source and oscillator started and ended.
//   node qa/03-completionist.mjs [--only name,name]
import { open, ready, harness, audioSpy, wait, writeJSON, ART } from './lib.mjs';
import path from 'node:path';

const name = '03-completionist';
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1].split(',') : null; })();
const s = await open({ name, autoplay: false });
await audioSpy(s.context);
const { page } = s;
const results = [];
const check = async (id, fn) => {
  if (only && !only.includes(id)) return;
  const t0 = Date.now();
  let r;
  try { r = await fn(); } catch (e) { r = { pass: false, error: String(e.stack || e).slice(0, 600) }; }
  r.secs = +((Date.now() - t0) / 1000).toFixed(1);
  r.id = id;
  results.push(r);
  console.log(`${r.pass === true ? 'PASS' : r.pass === false ? 'FAIL' : 'INFO'} ${id}`, JSON.stringify(r).slice(0, 900));
  writeJSON(path.join(ART, name, 'result.json'), results);
};
const ev = (fn, arg) => page.evaluate(fn, arg);
const key = (k) => page.keyboard.press(k);
const spy = () => ev(() => ({ live: window.__qaAudio.live, peak: window.__qaAudio.peak, osc: window.__qaAudio.osc, voices: window.__scene.sound.debug._voices.size, logN: window.__scene.sound.debug.log.length }));
const logSince = (n, re) => ev(([n, re]) => window.__scene.sound.debug.log.slice(n).filter((l) => new RegExp(re).test(l.name)).map((l) => `${l.t} ${l.name} ${l.src ?? (l.loop ? 'loop' : '')} k${l.k ?? ''}`), [n, re]);
const tp = (x, z, yaw = null, pitch = null) => ev(([x, z, yaw, pitch]) => {
  const { player: p, world } = window.__scene;
  p.pos.set(x, world.heightAt(x, z), z); p.vel.set(0, 0, 0);
  if (yaw !== null) p.yaw = yaw; if (pitch !== null) p.pitch = pitch;
  p.applyCamera(0);
}, [x, z, yaw, pitch]);

try {
  await page.goto(process.env.QA_BASE || 'http://127.0.0.1:5180/');
  await ready(page);
  await wait(500);
  await page.click('.overlay .menu-action');
  await wait(1500);
  await harness(page, { lockFake: false, startSound: false });
  await check('00-start', async () => {
    const r = await ev(() => ({ locked: window.__scene.player.locked, ac: window.__scene.sound.debug.ac.state, gesture: window.__qaAudio.firstGesture, ctx: window.__qaAudio.contexts }));
    // the context is made only after the first gesture
    return { pass: r.locked && r.ac === 'running' && r.ctx.length === 1 && r.gesture && r.ctx[0].t >= r.gesture.t, ...r };
  });

  /* ---------------------------- the konbini ---------------------------- */
  const visit = async (digit, extra = null) => {
    const n0 = (await spy()).logN;
    await tp(-2.3, 6, 0, 0); await wait(400);
    await tp(-2.3, 2.3, 0, 0); await wait(900);
    const menu = await ev(() => !!document.querySelector('.kmenu.on'));
    await key(`Digit${digit}`);
    await wait(300);
    const started = await ev(() => window.__store.shop.visiting);
    let r = null;
    if (extra) r = await extra();
    let gameT = 0;
    for (let k = 0; k < 600; k++) {
      await wait(250);
      const v = await ev(() => ({ a: window.__store.shop.visiting, m: window.__store.shop.debug.visit().marks, t: window.__store.shop.debug.visit().t }));
      gameT = v.t;
      if (!v.a) break;
    }
    const heard = await logSince(n0, '.');
    const sp = await spy();
    const toast = await ev(() => window.__toasts.slice(-2));
    const shop = await ev(() => ({ phase: window.__store.shop.phase, held: window.__store.shop.held.length, p: { x: +window.__scene.player.pos.x.toFixed(2), z: +window.__scene.player.pos.z.toFixed(2) }, susp: !!window.__scene.player.suspended, scripted: !!window.__scene.player.scripted, filter: document.getElementById('view').style.filter }));
    return { menu, started, gameT: +gameT.toFixed(1), heard, sp, toast, shop, extra: r };
  };
  for (const d of [1, 2, 3, 5]) {
    await check(`10-konbini-item${d}`, async () => {
      const r = await visit(d);
      const names = r.heard.map((h) => h.split(' ')[1]);
      const need = ['auto-door', 'lawson-chime', 'kiosk-scan', 'kiosk-pay', 'ka-ching'];
      const missing = need.filter((n) => !names.includes(n));
      const chimes = names.filter((n) => n === 'lawson-chime').length;
      const recipesInsteadOfFiles = r.heard.filter((h) => /kiosk|ka-ching|chime|bite|munch|gulp|can-open|wrapper/.test(h) && / recipe/.test(h));
      return { pass: r.menu && r.started && missing.length === 0 && chimes === 2 && r.shop.phase === 'out' && r.shop.held === 0 && !r.shop.susp && !r.shop.scripted && r.gameT >= 20 && r.gameT <= 36 && recipesInsteadOfFiles.length === 0, missing, chimes, recipesInsteadOfFiles, ...r, heard: r.heard.filter((h) => !/step|crow|dog|walk-/.test(h)) };
    });
  }
  // the Strong Nine: tipsy ten seconds, Hachi rolls with you
  await check('11-konbini-strong-nine', async () => {
    const r = await visit(4, null);
    const f = [];
    for (let k = 0; k < 6; k++) { f.push(await ev(() => document.getElementById('view').style.filter)); await wait(700); }
    s.shot && await s.shot('11-tipsy');
    const guide = await ev(() => window.__guide.state());
    await wait(8000);
    const after = await ev(() => document.getElementById('view').style.filter);
    return { pass: f.some((x) => /blur/.test(x)) && after === '' && r.toast.some((t) => /Strong Nine/.test(t)), filters: f, after, guide: { state: guide.state, act: guide.act }, toast: r.toast };
  });
  // keys that must do nothing while the scene plays: R, M, F, E, arrows; Space pauses and holds it
  await check('12-konbini-keys-mid-scene', async () => {
    const r = await visit(3, async () => {
      await wait(2500);
      const p0 = await ev(() => ({ x: window.__scene.player.pos.x, z: window.__scene.player.pos.z, t: window.__store.shop.debug.visit().t }));
      for (const k of ['KeyR', 'KeyM', 'KeyF', 'KeyE', 'ArrowDown', 'KeyW', 'Tab']) { await key(k); await wait(120); }
      const map = await ev(() => !document.querySelector('.fullmap').classList.contains('hidden'));
      // pause mid-scene: game time must stand still
      await key('Space'); await wait(300);
      const tA = await ev(() => window.__store.shop.debug.visit().t);
      await wait(2500);
      const tB = await ev(() => window.__store.shop.debug.visit().t);
      const lockedPaused = await ev(() => window.__scene.player.locked);
      await s.shot('12-paused-mid-scene');
      await key('Space'); await wait(600);
      const lockedAfter = await ev(() => window.__scene.player.locked);
      const p1 = await ev(() => ({ x: window.__scene.player.pos.x, z: window.__scene.player.pos.z, visiting: window.__store.shop.visiting }));
      return { map, frozen: +(tB - tA).toFixed(3), lockedPaused, lockedAfter, stillVisiting: p1.visiting, rJumped: Math.hypot(p1.x, p1.z - 16.5) < 0.5 };
    });
    return { pass: !r.extra.map && r.extra.frozen === 0 && r.extra.stillVisiting && !r.extra.rJumped && r.extra.lockedAfter && r.shop.phase === 'out', ...r.extra, gameT: r.gameT };
  });
  // straight back on: the menu needs a step off first (armed), then works again; ten quick on/off
  await check('13-konbini-spot-spam', async () => {
    const res = [];
    for (let k = 0; k < 10; k++) {
      await tp(-2.3, k % 2 ? 2.3 : 4.2, 0, 0);
      await wait(120);
      res.push(await ev(() => !!document.querySelector('.kmenu.on')));
    }
    // mash every digit on the spot: exactly one visit
    await tp(-2.3, 4.2); await wait(300); await tp(-2.3, 2.3); await wait(600);
    for (const d of '1234512345') await page.keyboard.press(`Digit${d}`);
    await wait(400);
    const one = await ev(() => ({ visiting: window.__store.shop.visiting, id: window.__store.shop.debug.visit().id }));
    for (let k = 0; k < 400 && await ev(() => window.__store.shop.visiting); k++) await wait(250);
    const after = await ev(() => ({ phase: window.__store.shop.phase, held: window.__store.shop.held.length, stock: window.__store.shop.debug.pickable.filter((u) => u.count < u.full).map((u) => `${u.id}:${u.count}/${u.full}`) }));
    return { pass: one.visiting && one.id === 'egg_sando' && after.phase === 'out', menuStates: res, one, after };
  });
  // repeated visits: does stock run out (the same facing taken each time)?
  await check('14-konbini-repeat-20', async () => {
    const out = [];
    for (let k = 0; k < 20; k++) {
      await tp(-2.3, 4.5); await wait(250); await tp(-2.3, 2.3); await wait(700);
      await ev(() => window.__press('Digit3'));
      await wait(200);
      const started = await ev(() => window.__store.shop.visiting);
      if (!started) { out.push({ k, started }); continue; }
      // fast-forward: the dev cancel puts things back; instead let it play at 4x by stepping the shop
      for (let j = 0; j < 400 && await ev(() => window.__store.shop.visiting); j++) await wait(250);
      const u = await ev(() => window.__store.shop.debug.pickable.filter((q) => q.id === 'tuna_mayo_onigiri' || /onigiri/.test(q.id)).map((q) => `${q.id}:${q.count}`));
      out.push({ k, started, u });
      if (k >= 3 && out.every((o) => o.started)) {
        // enough real plays; the rest via the dev fast path would not be a real test
        break;
      }
    }
    const sp = await spy();
    const gl = await ev(() => window.__gl());
    return { pass: out.every((o) => o.started), out, sp, gl };
  });

  // the stock: how many visits each choice has, and what a player sees when one has run out
  await check('15-konbini-stock-out', async () => {
    const stock = await ev(() => { const S = window.__store.shop; const t = {}; for (const u of S.debug.pickable) t[u.id] = (t[u.id] ?? 0) + u.count; return { menu: S.menu, left: t }; });
    // empty the choco wafer (1 in stock at the start) by the dev hook, then ask for it
    await ev(() => { for (const u of window.__store.shop.debug.pickable) if (u.id === 'choco_wafer_jumbo') u.count = 0; });
    await tp(-2.3, 6, 0, 0); await wait(400); await tp(-2.3, 2.3, 0, 0);
    for (let k = 0; k < 20 && !(await ev(() => !!document.querySelector('.kmenu.on'))); k++) await wait(150);
    const t0 = await ev(() => window.__toasts.length);
    await key('Digit5'); await wait(1500);
    const r = await ev((t0) => ({ visiting: window.__store.shop.visiting, menuStill: !!document.querySelector('.kmenu.on'), toasts: window.__toasts.slice(t0), menuText: document.querySelector('.kmenu')?.innerText.split('\n').slice(-4) }), t0);
    await s.shot('15-stock-out-menu');
    return { pass: r.visiting || r.toasts.length > 0, stockAtThisPoint: stock, ...r, note: 'the menu offers it; the key does nothing and nothing says why' };
  });
  // Han's song the first time: fetched only when the show starts, so it starts late
  await check('23-han-song-latency', async () => {
    const spot = await ev(() => window.__spotOf('han'));
    const had = await ev(() => window.__scene.sound.debug.buffers.has('han-drift'));
    await tp(spot.x + 2.5, spot.z); await wait(400);
    const n0 = await ev(() => window.__qaAudio.events.length);
    const t0 = await ev(() => performance.now() / 1000);
    await tp(spot.x, spot.z);
    let late = null;
    for (let k = 0; k < 80 && late === null; k++) {
      await wait(50);
      late = await ev(([n0, t0]) => { const e = window.__qaAudio.events.slice(n0).find((x) => x.k === 'buf' && x.dur > 15 && x.dur < 20); return e ? +(e.t - t0).toFixed(2) : null; }, [n0, t0]);
    }
    for (let k = 0; k < 100 && await ev(() => window.__han.state().run); k++) await wait(250);
    return { pass: null, cachedBefore: had, songStartsAfterS: late, note: 'on localhost; on a real connection add the 134 KB fetch' };
  });

  /* ---------------------------- Han's RX-7 ---------------------------- */
  await check('20-han-show', async () => {
    const spot = await ev(() => window.__spotOf('han'));
    const n0 = (await spy()).logN;
    await tp(spot.x + 2.5, spot.z); await wait(400);
    await tp(spot.x, spot.z); await wait(500);
    const st1 = await ev(() => window.__han.state());
    // spam E and step out and back in while it runs
    for (let k = 0; k < 8; k++) { await key('KeyE'); await wait(80); }
    await wait(2000);
    await s.shot('20-han-mid');
    const peak = [];
    for (let k = 0; k < 90; k++) {
      await wait(250);
      const r = await ev(() => ({ run: window.__han.state().run, live: window.__qaAudio.live, susp: !!window.__scene.player.suspended }));
      peak.push(r.live);
      if (!r.run) break;
    }
    const songs = await logSince(n0, 'han-drift');
    const after = await ev(() => ({ run: window.__han.state().run, susp: !!window.__scene.player.suspended, x: window.__han.state().x, z: window.__han.state().z }));
    return { pass: st1.run && songs.length === 1 && !after.run && !after.susp, songs, peakLive: Math.max(...peak), after };
  });
  await check('21-han-pause-desync', async () => {
    // pause 6 s mid-show: the car stands still, but does the song?
    const spot = await ev(() => window.__spotOf('han'));
    await tp(spot.x + 2.5, spot.z); await wait(400);
    await tp(spot.x, spot.z); await wait(3000);
    const a = await ev(() => ({ t: window.__han.state().t, ac: window.__scene.sound.debug.ac.currentTime }));
    await key('Space'); await wait(6000);
    const b = await ev(() => ({ t: window.__han.state().t, ac: window.__scene.sound.debug.ac.currentTime, locked: window.__scene.player.locked }));
    await key('Space'); await wait(500);
    for (let k = 0; k < 100 && await ev(() => window.__han.state().run); k++) await wait(250);
    const c = await ev(() => window.__scene.sound.debug.ac.currentTime);
    return { pass: null, showT: [a.t, b.t], audioClockAdvanced: +(b.ac - a.ac).toFixed(2), pausedLocked: b.locked, note: 'the song is an AudioBufferSource one-shot: the audio clock runs on while the show is frozen, so on resume the song is ahead of the car by the pause length' };
  });
  await check('22-han-R-mid-show', async () => {
    const spot = await ev(() => window.__spotOf('han'));
    await tp(spot.x + 2.5, spot.z); await wait(400);
    await tp(spot.x, spot.z); await wait(2500);
    await key('KeyR'); await wait(800);
    const r = await ev(() => ({ p: [+window.__scene.player.pos.x.toFixed(2), +window.__scene.player.pos.z.toFixed(2)], susp: !!window.__scene.player.suspended, run: window.__han.state().run, watch: { ...window.__watch, t: undefined, at: undefined } }));
    // can we walk now?
    await page.keyboard.down('ArrowDown'); await wait(800); await page.keyboard.up('ArrowDown');
    const moved = await ev(() => [+window.__scene.player.pos.x.toFixed(2), +window.__scene.player.pos.z.toFixed(2)]);
    for (let k = 0; k < 100 && await ev(() => window.__han.state().run); k++) await wait(250);
    return { pass: !r.susp && Math.hypot(moved[0] - r.p[0], moved[1] - r.p[1]) > 0.5, ...r, moved };
  });

  /* ---------------------------- the train ---------------------------- */
  await check('30-train-spot-stacking', async () => {
    const s0 = await ev(() => window.__spotOf('train'));
    await ev(() => window.__scene.world.line.local.service.stage('platform'));
    await wait(1500);
    const n0 = (await spy()).logN;
    // in and out of the ring six times, a second apart
    for (let k = 0; k < 6; k++) {
      await tp(s0.x, s0.z); await wait(700);
      await tp(s0.x + 2.2, s0.z); await wait(500);
    }
    await tp(s0.x, s0.z); await wait(1200);
    const plays = await logSince(n0, 'train-nextstop');
    const voices = await ev(() => window.__scene.sound.debug.voiceLevels().filter((v) => v.k > 0.05).length);
    const sp = await spy();
    await s.shot('30-train-spot');
    return { pass: plays.length <= 2 && voices <= 1, plays: plays.length, audibleVoices: voices, sp, note: 'each step into the ring starts another copy of the announcement' };
  });
  await check('31-train-ring-hidden-most-of-the-time', async () => {
    // over the service cycle: how long is platform 1's ring on offer?  (simulated on the service at 20 Hz)
    return ev(() => {
      const L = window.__scene.world.line.local, S = L.service;
      const snap = S.runs.map((r) => ({ ...r }));
      let open = 0, total = 0, longestGap = 0, gap = 0;
      for (let t = 0; t < 1200; t += 0.05) {
        S.update(0.05);
        const r = S.runs[0];
        const o = !!r && (r.phase === 'dwell' || (r.phase === 'opening' && r.doors > 0.9));
        total++; if (o) { open++; longestGap = Math.max(longestGap, gap); gap = 0; } else gap += 0.05;
      }
      S.runs.forEach((r, i) => Object.assign(r, snap[i]));
      return { pass: null, openShare: +(open / total).toFixed(2), longestWaitS: Math.round(Math.max(longestGap, gap)) };
    });
  });

  /* ---------------------------- the bench ---------------------------- */
  await check('40-bench-step-in', async () => {
    const b = await ev(() => window.__spotOf('slowlife'));
    // a player walks into the glowing ring, as with every other one, and looks around
    await tp(b.x, b.z, null, 0);
    const prompts = [];
    for (let k = 0; k < 8; k++) {
      await ev((yaw) => { window.__scene.player.yaw = yaw; }, k * Math.PI / 4);
      await wait(250);
      prompts.push(await ev(() => window.__prompt()));
    }
    await key('KeyE'); await wait(1500);
    const seatedInRing = await ev(() => !!window.__scene.player.seat);
    await s.shot('40-bench-in-ring');
    return { pass: seatedInRing || prompts.some(Boolean), prompts, seatedInRing, note: 'standing in the ring: does E (or anything) seat you?' };
  });
  await check('41-bench-sit-spam', async () => {
    const b = await ev(() => window.__spotOf('slowlife'));
    await ev((b) => window.__standBy(b.x, b.z, 2.0, 0.5), b); await wait(400);
    const prompt = await ev(() => window.__prompt());
    const flutes = [];
    await key('KeyE'); await wait(2000);
    const seated = await ev(() => !!window.__scene.player.seat);
    await s.shot('41-bench-seated');
    for (const k of ['KeyE', 'KeyE', 'KeyF', 'KeyM', 'KeyR', 'Digit3', 'KeyN', 'KeyN', 'Digit2']) { await key(k); await wait(250); }
    const stillSeated = await ev(() => ({ seat: !!window.__scene.player.seat, map: !document.querySelector('.fullmap').classList.contains('hidden') }));
    await key('ArrowUp'); await wait(1500);
    const stood = await ev(() => !window.__scene.player.seat);
    // sit/stand ten times fast
    for (let k = 0; k < 10; k++) { await ev((b) => window.__standBy(b.x, b.z, 2.0, 0.5), b); await wait(150); await key('KeyE'); await wait(300); await key('ArrowUp'); await wait(300); }
    await wait(2000);
    const end = await ev(() => ({ seat: !!window.__scene.player.seat, susp: !!window.__scene.player.suspended, flute: (window.__soundZones.find((z) => z.name === 'rural-flute') || {}).level }));
    return { pass: seated && stillSeated.seat && stood && !end.seat && end.flute < 0.5, prompt, seated, stillSeated, stood, end };
  });

  /* ---------------------------- the view spot ---------------------------- */
  await check('50-view-spot-glide', async () => {
    await tp(3, 20, Math.PI, -0.2); await wait(400);
    await tp(0.3, 16.8); await wait(300);
    const mid = await ev(() => ({ scripted: !!window.__scene.player.scripted }));
    // mash keys mid-glide
    for (const k of ['KeyR', 'KeyM', 'KeyF', 'Digit3']) { await key(k); await wait(100); }
    await wait(2200);
    const end = await ev(() => ({ x: +window.__scene.player.pos.x.toFixed(2), z: +window.__scene.player.pos.z.toFixed(2), yaw: +window.__scene.player.yaw.toFixed(2), pitch: +window.__scene.player.pitch.toFixed(2), scripted: !!window.__scene.player.scripted, map: !document.querySelector('.fullmap').classList.contains('hidden') }));
    await s.shot('50-view-spot');
    await key('Digit2'); await wait(900);
    return { pass: mid.scripted && !end.scripted && Math.hypot(end.x, end.z - 16.5) < 0.1, mid, end };
  });

  /* ---------------------------- things to hear ---------------------------- */
  await check('60-sound-places', async () => {
    const zones = await ev(() => window.__soundZones.map((z) => ({ name: z.name, x: z.x, z: z.z, near: z.near, far: z.far, level: z.level })));
    const out = {};
    for (const z of zones) {
      await tp(z.x + 3, z.z + 3); await wait(2500);
      const lvl = await ev((n) => { const q = window.__soundZones.find((z) => z.name === n); return q.g ? +q.g.gain.value.toFixed(3) : 0; }, z.name);
      const playing = await ev((n) => { const q = window.__soundZones.find((z) => z.name === n); return !!q.node?.src; }, z.name);
      await tp(z.x + z.far + 5, z.z); await wait(2500);
      const beyond = await ev((n) => { const q = window.__soundZones.find((z) => z.name === n); return { g: q.g ? +q.g.gain.value.toFixed(4) : 0, src: !!q.node?.src }; }, z.name);
      out[z.name] = { near: lvl, playing, beyond };
    }
    return { pass: Object.values(out).every((o) => o.near > 0.05 && o.playing && o.beyond.g < 0.005 && !o.beyond.src), out };
  });
  await check('61-walk-signals', async () => {
    const list = await ev(() => window.__walkList.map((w) => ({ x: w.x, z: w.z, sound: w.sound })));
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      await tp(w.x + 4, w.z + 4);
      const n0 = (await spy()).logN;
      let green = false;
      for (let k = 0; k < 160 && !green; k++) { await wait(250); green = await ev((i) => window.__walkList[i].on, i); }
      await wait(800);
      const heard = await logSince(n0, 'walk-');
      out.push({ i, sound: w.sound, green, heard: heard.slice(0, 3) });
    }
    return { pass: out.every((o) => o.green && o.heard.length > 0), n: list.length, out };
  });
  await check('62-crossing-bells', async () => {
    const c = await ev(() => { const L = window.__scene.world.line; return { x: L.crossingPos.x, z: L.crossingPos.z }; });
    await tp(c.x + 6, c.z - 8);
    await ev(() => window.__scene.world.line.local.service.stage('crossing'));
    const n0 = (await spy()).logN;
    let bells = false;
    for (let k = 0; k < 80 && !bells; k++) { await wait(250); bells = await ev(() => window.__scene.world.line.service.cross.bells); }
    await wait(1500);
    const heard = await logSince(n0, 'railway-bells');
    await s.shot('62-crossing');
    return { pass: bells && heard.length >= 1, bells, heard };
  });

  /* ---------------------------- Hachi and the keys ---------------------------- */
  await check('70-whistle-spam', async () => {
    await tp(-30, 30, 0, 0); await wait(600);
    const a = await spy();
    for (let k = 0; k < 12; k++) { await key('KeyF'); await wait(150); }
    await wait(5000);
    const b = await spy();
    const st = await ev(() => window.__guide.state());
    const onScreen = await ev(() => {
      const { camera, THREE } = window.__scene, G = window.__guide.G;
      const v = new THREE.Vector3(G.x, G.y + 0.2, G.z).project(camera);
      return { x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(3), d: +Math.hypot(G.x - camera.position.x, G.z - camera.position.z).toFixed(2) };
    });
    await s.shot('70-whistle-level');
    return { pass: b.peak < 200 && st.state !== 'lost', before: a, after: b, st: { state: st.state, act: st.act }, onScreen };
  });
  await check('71-whistle-greeting-in-view-at-spawn-pitch', async () => {
    // most players never move the mouse up or down: the spawn's pitch (0.16, looking up at Fuji) stays
    const res = {};
    for (const pitch of [0.16, 0]) {
      await tp(-30, 30, 0, pitch); await wait(3000);
      await key('KeyF');
      let seen = 0, n = 0, greet = 0;
      for (let k = 0; k < 40; k++) {
        await wait(150);
        await ev((p) => { window.__scene.player.pitch = p; }, pitch);
        const r = await ev(() => {
          const { camera, THREE } = window.__scene, G = window.__guide.G;
          const v = new THREE.Vector3(G.x, G.y + 0.15, G.z).project(camera);
          return { in: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1, act: G.act?.name ?? null, state: G.state };
        });
        if (r.act === 'greet') { greet++; if (r.in) seen++; }
        n++;
      }
      res[pitch] = { greetSamples: greet, inFrame: seen };
      if (pitch === 0.16) await s.shot('71-greet-at-pitch-0.16');
    }
    return { pass: res['0.16'].inFrame >= res['0.16'].greetSamples * 0.5, res };
  });
  await check('72-time-of-day-spam', async () => {
    await tp(0, 16.5, 0, 0.16);
    for (const d of '123123321312') { await key(`Digit${d}`); await wait(60); }
    await wait(1500);
    const look = await ev(() => ({ fog: '#' + window.__scene.scene.fog.color.getHexString(), fade: getComputedStyle([...document.body.children].find((e) => e.style?.zIndex === '4') ?? document.body).opacity }));
    await key('Digit2'); await wait(1200);
    return { pass: look.fade === '0', look };
  });
  await check('73-map-and-sound-spam', async () => {
    for (let k = 0; k < 9; k++) { await key('KeyM'); await wait(90); }
    await wait(500);
    const open = await ev(() => ({ susp: !!window.__scene.player.suspended }));
    await key('KeyM'); await wait(300);
    const closed = await ev(() => ({ susp: !!window.__scene.player.suspended }));
    for (let k = 0; k < 7; k++) { await key('KeyN'); await wait(90); }
    await wait(300);
    const muted = await ev(() => window.__scene.sound.muted);
    await key('KeyN'); await wait(200);
    const unmuted = await ev(() => window.__scene.sound.muted);
    return { pass: open.susp === true && closed.susp === false && muted === true && unmuted === false, open, closed, muted, unmuted };
  });
  await check('74-debug-keys-in-play', async () => {
    // keys not on the card: C (coordinates), O (ink off), G (grade off), backquote (dev overlay)
    await tp(0, 16.5, 0, 0.16); await wait(600);
    await key('KeyC'); await wait(400);
    const coords = await ev(() => ({ on: document.querySelector('.coords')?.classList.contains('on'), text: document.querySelector('.coords')?.innerText, toast: document.querySelector('.toast')?.textContent }));
    await s.shot('74-C-coords');
    await key('KeyC'); await wait(200);
    await key('KeyO'); await key('KeyG'); await wait(500);
    const passes = await ev(() => ({ ...window.__scene.pipeline.enabled }));
    await s.shot('74-O-G-passes-off');
    await key('KeyO'); await key('KeyG'); await wait(300);
    return { pass: null, coords, passes };
  });
  await check('75-vending-and-gate', async () => {
    // vending machines: no prompt on purpose.  The Deer Park gate: shut?
    const gate = await ev(() => { const P = window.__mapArt?.places?.find((p) => p.id === 'deerGate'); return P?.w ?? null; });
    let through = null;
    if (gate) {
      await tp(gate.x, gate.z + 6, Math.PI, 0); await wait(400);
      await page.keyboard.down('ArrowUp'); await wait(5000); await page.keyboard.up('ArrowUp');
      through = await ev(() => [+window.__scene.player.pos.x.toFixed(2), +window.__scene.player.pos.z.toFixed(2)]);
      await s.shot('75-deer-gate');
    }
    return { pass: null, gate, through };
  });
  const sp = await spy();
  await check('99-end', async () => ({ pass: s.log.errors.length === 0, errors: s.log.errors, http: s.log.http, audio: sp, gl: await ev(() => window.__gl()), mem: await ev(() => window.__mem()) }));
} catch (e) {
  console.error(e);
} finally {
  writeJSON(path.join(ART, name, 'result.json'), results);
  await s.close();
}
