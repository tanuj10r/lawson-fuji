// Quick probe: does a real Start click take the pointer lock in this Chrome mode, and does the loop run?
//   node qa/probe.mjs [--headed]
import { open, ready, wait } from './lib.mjs';

const headed = process.argv.includes('--headed');
const s = await open({ name: 'probe' + (headed ? '-headed' : ''), headless: !headed, autoplay: false });
try {
  const { page } = s;
  const t0 = Date.now();
  await page.goto(process.env.QA_BASE || 'http://127.0.0.1:5180/');
  await page.waitForSelector('.overlay .menu-action');
  const card = Date.now() - t0;
  await ready(page);
  const built = Date.now() - t0;
  await s.shot('start-card');
  const before = await page.evaluate(() => ({ ac: window.__scene.sound.ready, locked: window.__scene.player.locked }));
  await page.click('.overlay .menu-action');
  await wait(1500);
  const after = await page.evaluate(() => ({ locked: window.__scene.player.locked, plEl: !!document.pointerLockElement, ac: window.__scene.sound.debug?.ac?.state, overlay: document.querySelector('.overlay').className }));
  await page.keyboard.down('ArrowUp'); await wait(1200); await page.keyboard.up('ArrowUp');
  const pos = await page.evaluate(() => { const p = window.__scene.player.pos; return [p.x.toFixed(2), p.z.toFixed(2)]; });
  await s.shot('after-start');
  console.log(JSON.stringify({ card, built, before, after, pos, errors: s.log.errors, http: s.log.http }, null, 1));
} finally { await s.close(); }
