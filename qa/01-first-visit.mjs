// Scenario 1, the first-time visitor: cold load, read the card, Start (a real click: real pointer lock),
// meet Hachi, walk to the konbini with the arrow keys, choose, watch the scene, walk out to the view,
// then try the keys the card lists.  Real key events throughout; mouse look is a synthetic mousemove
// (Playwright's mouse under pointer lock carries no movementX).
//   node qa/01-first-visit.mjs [--engine chromium|firefox|webkit] [--size 1280x720] [--item 1..5] [--name x] [--novideo]
import { open, ready, wait, fps, writeJSON, ART } from './lib.mjs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const engine = arg('--engine', 'chromium');
const [W, H] = arg('--size', '1280x720').split('x').map(Number);
const item = arg('--item', '1');
const name = arg('--name', `01-first-visit-${engine}-${W}x${H}`);
const video = !process.argv.includes('--novideo');
const s = await open({ name, engine, viewport: { width: W, height: H }, video, autoplay: false });
const R = { engine, size: `${W}x${H}`, steps: [], notes: [] };
const note = (k, v) => { R.steps.push({ t: s.at(), k, v }); console.log(`[${s.at()}s] ${k}:`, typeof v === 'string' ? v : JSON.stringify(v)); };
const look = (dx, dy = 0) => s.page.evaluate(([dx, dy]) => document.dispatchEvent(new MouseEvent('mousemove', { movementX: dx, movementY: dy, bubbles: true })), [dx, dy]);
const state = () => s.page.evaluate(() => {
  const { player: p, sound } = window.__scene;
  return { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), yaw: +p.yaw.toFixed(3), pitch: +p.pitch.toFixed(3), locked: p.locked, pl: !!document.pointerLockElement, ac: sound.debug?.ac?.state ?? (sound.ready ? 'made' : 'none') };
});
/** Walk to (x, z) with the arrow key, turning with the mouse; stops within `tol`.  Returns the path's stats. */
async function walkTo(x, z, { tol = 0.35, max = 40000, run = false } = {}) {
  const t0 = Date.now();
  let stuck = 0, last = null, lastT = Date.now();
  if (run) await s.page.keyboard.down('Shift');
  let down = false;
  try {
    for (;;) {
      const st = await state();
      const dx = x - st.x, dz = z - st.z, d = Math.hypot(dx, dz);
      if (d < tol) break;
      if (Date.now() - t0 > max) { note('walk-timeout', { to: [x, z], at: [st.x, st.z] }); break; }
      const want = Math.atan2(-dx, -dz);
      let e = want - st.yaw; e = Math.atan2(Math.sin(e), Math.cos(e));
      // the mouse: yaw -= movementX * 0.0022 (the player's own sensitivity)
      if (Math.abs(e) > 0.02) await look(-e / 0.0022, 0);
      if (last && Math.hypot(st.x - last.x, st.z - last.z) < 0.05) { if (Date.now() - lastT > 2500) { stuck++; note('stuck', { at: [st.x, st.z], to: [x, z] }); break; } } else { last = st; lastT = Date.now(); }
      if (d > 1.0) {
        if (!down) { await s.page.keyboard.down('ArrowUp'); down = true; }
        await wait(50);
      } else {
        // the last metre in short taps, as a person lines up on a mark
        if (down) { await s.page.keyboard.up('ArrowUp'); down = false; await wait(250); continue; }
        await s.page.keyboard.down('ArrowUp'); await wait(90); await s.page.keyboard.up('ArrowUp'); await wait(250);
      }
    }
  } finally {
    await s.page.keyboard.up('ArrowUp');
    if (run) await s.page.keyboard.up('Shift');
  }
  await wait(300);
  return { secs: +((Date.now() - t0) / 1000).toFixed(1), stuck, at: await state() };
}

try {
  const { page } = s;
  const t0 = Date.now();
  const resp = await page.goto(process.env.QA_BASE || 'http://127.0.0.1:5180/', { waitUntil: 'commit' });
  note('status', resp.status());
  // what a visitor sees while it loads: sampled
  for (const ms of [700, 2500]) { await wait(ms - (Date.now() - t0) > 0 ? ms - (Date.now() - t0) : 0); R[`loading${ms}`] = await s.shot(`00-loading-${ms}ms`); }
  await page.waitForSelector('.overlay .menu-action', { timeout: 180000 });
  R.cardMs = Date.now() - t0;
  note('start card shown (ms)', R.cardMs);
  await ready(page);
  R.readyMs = Date.now() - t0;
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; });
  note('navigation', nav);
  await wait(800);
  R.card = await s.shot('01-start-card');
  R.cardText = await page.evaluate(() => document.querySelector('.overlay .menu').innerText);
  R.cardFit = await page.evaluate(() => { const m = document.querySelector('.overlay .menu').getBoundingClientRect(); return { w: Math.round(m.width), h: Math.round(m.height), top: Math.round(m.top), bottom: Math.round(m.bottom), vw: innerWidth, vh: innerHeight, overflowX: m.width > innerWidth, overflowY: m.bottom > innerHeight || m.top < 0 }; });
  note('card fits', R.cardFit);
  // before any gesture: no audio context, no audio fetched
  R.beforeGesture = await page.evaluate(() => ({ soundReady: window.__scene.sound.ready, audioFetched: performance.getEntriesByType('resource').filter((e) => /\/audio\//.test(e.name)).map((e) => e.name.split('/').pop()) }));
  note('before gesture', R.beforeGesture);
  // hover the button (a real pointer) then click Start
  await page.hover('.overlay .menu-action');
  await page.click('.overlay .menu-action');
  await wait(1200);
  note('after Start', await state());
  R.afterStart = await s.shot('02-after-start');
  R.controlsText = await page.evaluate(() => document.querySelector('.controls')?.innerText ?? null);
  // Hachi's hello (4 s into play)
  await wait(3800);
  R.hello = await s.shot('03-hachi-hello');
  R.helloCard = await page.evaluate(() => { const c = document.getElementById('hachi-card'); return c ? { text: c.innerText, opacity: c.style.opacity, vis: getComputedStyle(c).visibility } : null; });
  note('hello card', R.helloCard);
  await wait(2500);
  R.hello2 = await s.shot('04-hachi-sits');
  // the store's spot: walk there
  const spot = await page.evaluate(() => { const e = window.__scene.world.lawson.experiences.list.find((q) => q.id === 'konbini'); return { x: e.x, z: e.z }; });
  const w1 = await walkTo(spot.x, spot.z, { tol: 0.4 });
  note('walked to the konbini spot', w1);
  await wait(900);
  R.menuShown = await page.evaluate(() => ({ on: !!document.querySelector('.kmenu.on'), text: document.querySelector('.kmenu')?.innerText ?? '', controls: document.querySelector('.controls')?.innerText ?? '' }));
  note('menu', R.menuShown);
  R.menuShot = await s.shot('05-konbini-menu');
  // choose
  const vis0 = Date.now();
  await page.keyboard.press(`Digit${item}`);
  const marks = [], sounds = [], shots = {};
  let lastLabel = null;
  for (let k = 0; k < 400; k++) {
    await wait(200);
    const v = await page.evaluate(() => {
      const S = window.__store.shop, V = S.debug.visit();
      return { active: V.active, marks: V.marks, phase: S.phase, log: window.__scene.sound.debug.log.slice(-6).map((l) => `${l.name}:${l.src ?? (l.loop ? 'loop' : '')}`), inside: window.__scene.sound.debug.state.inside, toasts: window.__toasts?.slice?.() ?? [] };
    }).catch(() => null);
    if (!v) continue;
    const label = v.marks?.length ? v.marks[v.marks.length - 1][0] : null;
    if (label !== lastLabel && label) { lastLabel = label; shots[label] = await s.shot(`06-scene-${String(Object.keys(shots).length).padStart(2, '0')}-${label}`); }
    if (!v.active) { marks.push(...(v.marks ?? [])); break; }
  }
  R.visitSecs = +((Date.now() - vis0) / 1000).toFixed(1);
  R.visit = await page.evaluate(() => ({ marks: window.__store.shop.debug.visit().marks, heard: window.__store.shop.debug.heard.slice(), log: window.__scene.sound.debug.log.map((l) => `${l.t}s ${l.name} ${l.src ?? (l.loop ? 'loop' : '')}`) }));
  note('visit took (s)', R.visitSecs);
  await wait(400);
  R.afterVisit = await s.shot('07-after-visit');
  R.toastAfter = await page.evaluate(() => document.querySelector('.toast')?.textContent ?? '');
  note('toast after the visit', R.toastAfter);
  // the view spot (0, 16.5): walk back onto it
  const w2 = await walkTo(0, 16.3, { tol: 0.5 });
  note('walked to the view spot', w2);
  await wait(1800);
  R.viewSpot = await state();
  R.viewShot = await s.shot('08-view-spot');
  // keys the card lists
  await page.keyboard.press('KeyM'); await wait(700); R.map = await s.shot('09-map'); await page.keyboard.press('KeyM'); await wait(400);
  await page.keyboard.press('Digit3'); await wait(1200); R.night = await s.shot('10-night');
  await page.keyboard.press('Digit1'); await wait(1200); R.morning = await s.shot('11-morning');
  await page.keyboard.press('Digit2'); await wait(900);
  await page.keyboard.press('KeyN'); await wait(300); R.muteToast = await page.evaluate(() => document.querySelector('.toast')?.textContent); await page.keyboard.press('KeyN'); await wait(300);
  // walk off the view a few metres and whistle
  await walkTo(6, 12, { tol: 0.6 });
  await page.keyboard.press('KeyF');
  await wait(4500);
  R.whistle = await s.shot('12-whistle');
  R.guide = await page.evaluate(() => window.__guide?.state());
  note('hachi after F', R.guide);
  // Esc: the pause card
  await page.keyboard.press('Escape');
  await wait(900);
  R.pause = await state();
  R.pauseShot = await s.shot('13-pause-card');
  note('after Esc', R.pause);
  // Space resumes (a key gesture takes the pointer back)
  await page.keyboard.press('Space');
  await wait(900);
  R.resume = await state();
  note('after Space', R.resume);
  // Space pauses again
  await page.keyboard.press('Space');
  await wait(700);
  R.pause2 = await state();
  note('after Space again', R.pause2);
  await page.click('.overlay .menu-action');
  await wait(700);
  R.fps = await fps(page, 4000);
  note('fps at the end', R.fps);
  R.errors = s.log.errors; R.http = s.log.http; R.failed = s.log.failed;
  R.warnings = s.log.console.filter((c) => c.type === 'warning' || c.type === 'error');
} catch (e) {
  R.crash = String(e.stack || e);
  console.error(e);
  try { await s.shot('zz-crash'); } catch {}
} finally {
  writeJSON(path.join(ART, name, 'result.json'), R);
  await s.close();
}
console.log('errors', R.errors?.length, 'http>=400', R.http?.length, 'warnings', R.warnings?.length);
