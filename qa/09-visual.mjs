// Visual pass: every landmark at morning, golden hour and night (the real keys 1 2 3, the real pipeline),
// plus the transition itself (frames through the dip to dark).  World coordinates; yaw 0 faces -z (Fuji).
//   node qa/09-visual.mjs [--size 1600x900]
import { open, ready, harness, wait, writeJSON, ART } from './lib.mjs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const [W, H] = arg('--size', '1600x900').split('x').map(Number);
const name = '09-visual';
const s = await open({ name, viewport: { width: W, height: H }, autoplay: false });
const { page } = s;
const ev = (fn, a) => page.evaluate(fn, a);
const SPOTS = [
  ['famous-view', 0, 16.5, 0, 0.16],
  ['konbini-door', -2.3, 4.5, 0, 0.02],
  ['han-rx7', -19, 21, 1.94, -0.05],
  ['master-junction', -18, 19.5, 1.25, 0.02],
  ['shopping-street', 50, 5, 0, 0.03],
  ['donpen-do', 50, -36, -1.1, 0.08],
  ['shrine', -13, -52.3, 0, 0.08],
  ['station-plaza', 50, -101, 0, 0.06],
  ['platform-1-train', 53, -129.2, -1.3, 0.02, 'platform'],
  ['level-crossing', 80, -122, 0, 0.02, 'crossing'],
  ['kagami-pond', -66.6, -100.3, 1.57, 0.0],
  ['slow-life-bench', -71, -73, 0.9, 0.05],
  ['paddies', -58, -62, 1.3, -0.02],
  ['river-walk', 0, 44, -1.57, 0.0],
  ['deer-park-gate', -30, 57, 3.1416, 0.03],
  ['main-road-east-end', 100, 18.8, -1.5708, 0.02],
  ['main-road-west-end', -100, 18.8, 1.5708, 0.02],
];
const out = [];
try {
  await page.goto(process.env.QA_BASE || 'http://127.0.0.1:5180/');
  await ready(page);
  await page.click('.overlay .menu-action');
  await wait(1500);
  if (!(await ev(() => window.__scene.player.locked))) { await page.click('.overlay .menu-action').catch(() => {}); await wait(1500); }
  const locked = await ev(() => window.__scene.player.locked);
  console.log('pointer lock taken:', locked);
  await harness(page, { lockFake: !locked, startSound: true });
  // the corner panel and the minimap would hide parts of the frame: hide them for the pass
  await ev(() => { const st = document.createElement('style'); st.textContent = '.controls,.minimap,#hachi-card{visibility:hidden!important}'; document.head.appendChild(st); window.__scene.player.scripted = true; });
  for (const [key, look] of [['Digit1', 'morning'], ['Digit2', 'golden'], ['Digit3', 'night']]) {
    await page.keyboard.press(key);
    await wait(1400);
    for (const [n, x, z, yaw, pitch, train] of SPOTS) {
      if (train) await ev((k) => window.__scene.world.line.local.service.stage(k), train);
      await ev(([x, z, yaw, pitch]) => { const { player: p, world } = window.__scene; p.pos.set(x, world.heightAt(x, z), z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch; p.applyCamera(0); }, [x, z, yaw, pitch]);
      await wait(1300);
      out.push({ n, look, shot: await s.shot(`${n}-${look}`) });
    }
  }
  // the switch itself: frames through 3 -> 1 at the famous view (the dip to dark)
  await ev(() => { const { player: p, world } = window.__scene; p.pos.set(0, world.heightAt(0, 16.5), 16.5); p.yaw = 0; p.pitch = 0.16; p.applyCamera(0); });
  await page.keyboard.press('Digit3'); await wait(1500);
  await page.keyboard.press('Digit1');
  for (let k = 0; k < 6; k++) { await wait(110); out.push({ n: 'transition', k, shot: await s.shot(`transition-${k}`) }); }
  await ev(() => { window.__scene.player.scripted = false; });
} catch (e) { console.error(e); } finally {
  writeJSON(path.join(ART, name, 'result.json'), out);
  await s.close();
}
console.log(out.length, 'frames');
