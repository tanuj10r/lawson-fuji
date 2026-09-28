// dev helper (M4): the audio check.  The first click starts the sound;
// the files load; walking from the famous view into the store and out
// plays the chime once each way, muffles the town within a second, and
// runs the store's music only inside; the bed follows the time of day;
// nothing local plays out of its range.   usage: node scripts/_audio.mjs
// BROWSER=webkit (Safari's engine) or firefox; Chrome by default
import { chromium, webkit, firefox } from 'playwright';
const which = process.env.BROWSER ?? 'chrome';
const browser = which === 'webkit' ? await webkit.launch({ headless: true })
  : which === 'firefox' ? await firefox.launch({ headless: true, firefoxUserPrefs: { 'media.autoplay.default': 5, 'media.autoplay.blocking_policy': 0 } })
  : await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--autoplay-policy=user-gesture-required'] });
console.log('browser', which, browser.version());
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [], missing = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('response', (r) => { if (r.status() >= 400) missing.push(r.status() + ' ' + r.url()); });
const t0 = Date.now();
await page.goto(process.env.AUDIO_URL ?? 'http://localhost:5178/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const firstFrame = (Date.now() - t0) / 1000;
let bad = 0;
const check = (name, ok, info) => { if (!ok) bad++; console.log(ok ? 'pass' : 'FAIL', name, info === undefined ? '' : JSON.stringify(info)); };

const before = await page.evaluate(() => ({ ac: window.__scene.sound.debug.ac, fetched: performance.getEntriesByType('resource').filter((r) => /audio\//.test(r.name)).length }));
check('no audio before the first click, nothing fetched', before.ac === null && before.fetched === 0, before);

await page.mouse.click(640, 360);
await page.waitForFunction(() => window.__scene.sound.debug.ac?.state === 'running' && Object.keys(window.__scene.sound.debug.manifest).length > 0, null, { timeout: 20000 });
const s1 = await page.evaluate(() => ({ state: window.__scene.sound.debug.ac.state, files: Object.keys(window.__scene.sound.debug.manifest).length }));
check('the first click starts it (running), the manifest loads', s1.state === 'running' && s1.files >= 15, s1);

// every file decodes, and its loop span fits
const dec = await page.evaluate(async () => {
  const { manifest, ac } = window.__scene.sound.debug;
  const out = {};
  for (const [k, m] of Object.entries(manifest)) {
    const b = await ac.decodeAudioData(await (await fetch('audio/' + m.file)).arrayBuffer());
    out[k] = +(b.duration - m.duration).toFixed(3);
  }
  return out;
});
check('every file decodes (decoded minus cut length, s)', Object.values(dec).every((d) => d >= -0.01 && d < 0.2), dec);

const walk = (x, z, yaw = 3.14) => page.evaluate(([x, z, yaw]) => { const p = window.__scene.player; p.pos.set(x, p.pos.y, z); p.yaw = yaw; }, [x, z, yaw]);
const st = () => page.evaluate(() => ({ ...window.__scene.sound.debug.state, log: window.__scene.sound.debug.log.map((l) => l.name) }));
const count = (log, n) => log.filter((x) => x === n).length;

await walk(-2.3, 16.5); await page.waitForTimeout(1500);
let s = await st();
check('the famous view: no chime, the town open', count(s.log, 'lawson-chime') === 0 && !s.inside, s);
await walk(-2.3, 1.2); await page.waitForTimeout(1500);
await walk(-2.3, -1.2, 0);
await page.waitForTimeout(1000);
s = await st();
check('in: the chime once, the town muffled within 1 s, the music on', count(s.log, 'lawson-chime') === 1 && s.lowpassTarget === 900 && s.lowpass <= 2000 && s.music && s.inside, { chimes: count(s.log, 'lawson-chime'), lowpass: s.lowpass, target: s.lowpassTarget, music: s.music, door: count(s.log, 'auto-door') });
// the music really streams: the element is playing and sound is coming out
const mus = await page.evaluate(async () => {
  const m = window.__scene.sound.debug._music;
  await new Promise((r) => setTimeout(r, 1500));
  return { streaming: !!m.el && !m.el.paused, at: +(m.el?.currentTime ?? 0).toFixed(1), decoded: window.__scene.sound.debug.buffers.has('store-bgm'), level: await window.__scene.sound.debug.level(1500) };
});
check('the store music streams (not decoded) and is audible', mus.streaming && !mus.decoded && mus.at > 0 && mus.level.rms > 0.002, mus);

await walk(-4, -8, 0); await page.waitForTimeout(3000);
s = await st();
check('shopping: still one chime', count(s.log, 'lawson-chime') === 1, { chimes: count(s.log, 'lawson-chime') });
await walk(-2.3, -1.0, 3.14); await page.waitForTimeout(800);
await walk(-2.3, 1.2, 3.14); await page.waitForTimeout(1000);
s = await st();
check('out: the chime again, the town open, the music off', count(s.log, 'lawson-chime') === 2 && s.lowpassTarget === 20000 && !s.music && !s.inside, { chimes: count(s.log, 'lawson-chime'), lowpass: s.lowpass, music: s.music });

// walking out: the chime fades behind you, and comes through the glass muffled
await walk(-2.3, -1.0, 3.14); await page.waitForTimeout(600);
await walk(-2.3, 1.2, 3.14); await page.waitForTimeout(150);
const v1 = await page.evaluate(() => window.__scene.sound.debug.voiceLevels());
await walk(-2.3, 12, 3.14); await page.waitForTimeout(600);
const v2 = await page.evaluate(() => window.__scene.sound.debug.voiceLevels());
const chime = (v) => v.find((x) => x.indoor);
check('the exit chime fades as you walk away, muffled through the glass', chime(v1) && chime(v2) && chime(v2).k < chime(v1).k * 0.5 && chime(v1).f <= 1400, { atDoor: chime(v1), at12m: chime(v2) });

// the zebras: the walk signal plays while a walk light is green, near it only
const zebras = await page.evaluate(() => window.__walkList?.length ?? 0);
check('every zebra has a walk light', zebras >= 3, { zebras });
const heard = await page.evaluate(async () => {
  const list = window.__walkList;
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    const p = window.__scene.player; p.pos.set(w.x + 3, p.pos.y, w.z + 3);
    // wait for a green (the cycle is 47 s: step time on quickly)
    let tries = 0;
    while (!(list[i].on && window.__scene.sound.debug.state.walking) && tries++ < 400) await new Promise((r) => setTimeout(r, 250));
    out.push({ i, green: list[i].on, playing: window.__scene.sound.debug.state.walking });
  }
  return out;
});
check('each zebra plays its signal while green', heard.every((h) => h.green && h.playing >= 1), heard);

// each crossing calls with its own voice: the cuckoo on the main road it is
// walked across, the chick on the shopping street's
const voices = await page.evaluate(() => window.__walkList.map((w) => ({ sound: w.sound, x: Math.round(w.x), z: Math.round(w.z) })));
// the main road (world z ~14) is crossed north-south: the cuckoo; every other crossing, the chick
check('the main road crossings call kakko, the side streets piyo', voices.every((v) => (Math.abs(v.z - 14) < 3) === (v.sound === 'kakko')), voices);

// from where the game starts you hear one crossing, never two at once
const spawnHeard = await page.evaluate(async () => {
  const { player, sound, camera } = window.__scene;
  player.pos.set(-2.3, player.pos.y, 16.5); player.locked = true;
  let most = 0;
  const names = new Set();
  const before = sound.debug.log.length;
  for (let k = 0; k < 160; k++) {
    await new Promise((r) => setTimeout(r, 250));
    most = Math.max(most, sound.debug.state.walking ?? 0);
  }
  for (const l of sound.debug.log.slice(before)) if (l.name.startsWith('walk-')) names.add(l.name);
  return { most, names: [...names], distances: window.__walkList.map((w) => Math.round(Math.hypot(w.x - camera.position.x, w.z - camera.position.z))) };
});
check('at the spawn point only one crossing is ever heard', spawnHeard.most <= 1, spawnHeard);

// the bed follows the time of day
// (golden hour has no bed: a crow now and then, far off -- Tan 2026-09-28)
for (const [view, bed] of [['morning', 'birds'], ['golden', 'crow-call'], ['night', 'night-insects']]) {
  await page.evaluate((v) => window.__scene.enterHero(v), view);
  await page.waitForFunction((b) => window.__scene.sound.debug.log.some((l) => l.name === b), bed, { timeout: 14000 }).catch(() => {});
  s = await st();
  check(`look ${view}: ${bed} plays`, s.look && s.log.includes(bed), { look: s.look });
}
// golden hour's crows: a few single calls, spaced out and far off, never a chorus
const crows = await page.evaluate(async () => {
  const { log } = window.__scene.sound.debug;
  window.__scene.enterHero('golden');
  const from = log.length, t0 = performance.now();
  await new Promise((r) => setTimeout(r, 30000));
  const calls = log.slice(from).filter((l) => l.name === 'crow-call');
  return { secs: Math.round((performance.now() - t0) / 1000), n: calls.length, d: calls.map((c) => c.d), k: calls.map((c) => c.k), chorus: log.slice(from).some((l) => l.name === 'crows') };
});
check('golden hour: 1-6 crow calls in 30 s, all 55 m or more away and quiet, no chorus loop', crows.n >= 1 && crows.n <= 6 && crows.d.every((d) => d >= 55) && crows.k.every((k) => k <= 0.13) && !crows.chorus, crows);
// the crossing's bells are never heard at the store (its range)
s = await st();
check('the crossing bells: not playing at the store', !s.bells, { bells: s.bells });
// the keys on screen follow where the player is (M4, Tan)
const ctl = await page.evaluate(async () => {
  const { player } = window.__scene;
  const read = () => [...document.querySelectorAll('.controls.on kbd')].map((k) => k.textContent);
  player.locked = true;
  const seen = {};
  player.pos.set(50, player.pos.y, -38);
  await new Promise((r) => setTimeout(r, 600));
  seen.town = read();
  player.pos.set(-4, player.pos.y, -8);
  await new Promise((r) => setTimeout(r, 600));
  seen.store = read();
  window.__scene.enterHero('golden');
  await new Promise((r) => setTimeout(r, 600));
  seen.famousView = read();
  return seen;
});
check('the keys shown follow the place',
  ctl.town.includes('M') && ctl.town.includes('Shift') && !ctl.town.includes('Tab')
  && ctl.store.includes('E') && !ctl.store.includes('Tab')
  && ctl.famousView.join() === '↑,↓,←,→,1,2,3', ctl);   // (the basket panel went with the konbini rework: its keys are the store's)

check('no 404s', missing.length === 0, missing);
check('the first frame did not wait on audio', firstFrame < 60 && before.fetched === 0, { readyS: firstFrame });
if (errs.length) console.log('PAGE ERRORS', errs);
console.log(bad ? `${bad} FAILED` : 'all passed');
await browser.close();
