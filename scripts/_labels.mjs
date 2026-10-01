// dev helper: walk near each named sound and photograph its label (ui/soundLabels.js).
//
//   PORT=5182 node scripts/_labels.mjs <outdir> ['?shots']
//
// Starts its own dev server and Chrome (queued on /tmp/lawson-browser.lock) and closes both however it ends.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.resolve(process.argv[2] ?? path.join(ROOT, '.shots', 'labels'));
fs.mkdirSync(out, { recursive: true });
const LOCK = '/tmp/lawson-browser.lock';
let mine = false;
for (;;) { try { fs.mkdirSync(LOCK); mine = true; break; } catch { console.log('waiting for the browser lock'); await new Promise((r) => setTimeout(r, 10000)); } }
const unlock = () => { if (mine) { try { fs.rmdirSync(LOCK); } catch {} mine = false; } };
process.on('exit', unlock);
const CACHE = fs.mkdtempSync(path.join(os.tmpdir(), 'labels-vite-'));
const server = await createServer({ root: ROOT, logLevel: 'error', cacheDir: CACHE, server: { port: +process.env.PORT || 5182, strictPort: true, host: '127.0.0.1' } });
await server.listen();
const flags = ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: flags });
const close = async () => { await Promise.race([browser.close().then(() => server.close()), new Promise((r) => setTimeout(r, 8000))]).catch(() => {}); unlock(); fs.rmSync(CACHE, { recursive: true, force: true }); };
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await close(); process.exit(130); });
const errs = [];
let bad = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });
  const mode = process.argv[3] ?? '';
  await page.goto(server.resolvedUrls.local[0] + mode);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 150000, polling: 250 });
  const shot = async (name, full = false) => page.screenshot({ path: path.join(out, name + '.png'), ...(full ? {} : { clip: { x: 0, y: 0, width: 760, height: 260 } }) });
  if (mode) {   // ?shots: nothing at all
    await page.waitForTimeout(1500);
    const n = await page.evaluate(() => document.querySelectorAll('.snd').length);
    if (n) bad++;
    console.log(n ? 'FAIL' : 'pass', 'shots mode: .snd elements', n);
  } else {
    await shot('00-start-card', true);
    console.log('start card: .snd', await page.evaluate(() => getComputedStyle(document.querySelector('.snd')).visibility));
    await page.evaluate(async () => {
      const { player, sound } = window.__scene;
      const cfg = await import('/src/config.js');
      cfg.SOUND_LABELS.ambient.wind = 30;
      window.__seen = [];
      new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => window.__seen.push(n.textContent)))).observe(document.querySelector('.snd'), { childList: true });
      window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
      window.__go = (x, z) => player.pos.set(x, window.__scene.world.heightAt?.(x, z) ?? player.pos.y, z);
      window.__for = async (re, ms = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if ([...document.querySelectorAll('.snd-pill')].some((p) => re.test(p.textContent))) return true; await window.__wait(100); } return false; };
      window.__press = (code) => { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { code, key: code.replace(/^Key|^Digit/, '').toLowerCase(), bubbles: true })); };
      sound.start();
      player.locked = true;
      window.__scene.hud.setLocked(true);   // (no pointer lock headless: the card is put away by hand)
    });
    await page.waitForTimeout(1500);
    console.log('info', JSON.stringify(await page.evaluate(() => ({
      ac: window.__scene.sound.graph()?.ac.state, muted: window.__scene.sound.muted,
      zones: window.__soundZones.map((z) => `${z.name}(${z.x.toFixed(0)},${z.z.toFixed(0)}) ${z.near}-${z.far}`),
      walk: window.__walkList.map((w) => `${w.sound}(${w.x.toFixed(0)},${w.z.toFixed(0)})`),
      spots: [...window.__scene.world.experiences.list, ...window.__scene.world.lawson.experiences.list].map((e) => `${e.kind}:${e.id}(${e.x.toFixed(1)},${e.z.toFixed(1)})`),
      pos: [window.__scene.player.pos.x, window.__scene.player.pos.z],
    }))));
    const ONLY = process.env.ONLY?.split(',');
    const step = async (name, fn, re, ms = 9000, arg) => {
      if (ONLY && !ONLY.some((o) => name.includes(o))) return true;
      let ok = false;
      try { await page.evaluate(fn, arg); ok = await page.evaluate(([s, ms]) => window.__for(new RegExp(s), ms), [re.source, ms]); } catch (e) { errs.push(name + ': ' + String(e).slice(0, 300)); }
      await page.waitForTimeout(700);
      await shot(name);
      if (!ok) bad++;
      console.log(ok ? 'pass' : 'FAIL', name, JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.snd-pill')].map((p) => p.textContent))));
      return ok;
    };
    await step('00-bed-golden', () => {}, /crows/, 30000);
    // walk signals: stand by each kind, wait for its green
    for (const kind of ['piyo', 'kakko']) {
      await step('01-walk-' + kind, (kind) => { const w = window.__walkList.find((w) => (w.sound ?? 'piyo') === kind); window.__go(w.x + 3, w.z + 3); }, new RegExp(kind === 'piyo' ? 'chick' : 'cuckoo'), 90000, kind);
    }
    await shot('01-walk-full', true);
    await step('04-bells', () => { const c = window.__scene.world.line.crossingPos; window.__go(c.x + 4, c.z + 9); window.__train('approach'); }, /level crossing/, 30000);
    await shot('04-bells-full', true);
    for (const [z, re] of [['donki-theme', /megastore/], ['shrine-chimes', /wind chimes/], ['rural-flute', /slow life/], ['station-ambience', /station/]]) {
      await step('02-zone-' + z, async (name) => { const z = window.__soundZones.find((z) => z.name === name); window.__go(z.x + 90, z.z); await window.__wait(300); window.__go(z.x + 2, z.z + 2); }, re, 6000, z);
    }
    await shot('02-station-full', true);
    // the trains, from the station: one standing with its doors open (chime, then it departs), then one coming in
    await step('03-train-chime', () => { window.__train('platform'); }, /door chime/, 70000);
    await step('03-train-depart', () => {}, /departing/, 40000);
    await step('03-train-arrive', () => { window.__train('approach'); }, /arriving/, 60000);
    // a new shop's sound, by name (the mochi shop, when it is merged)
    await step('05-mochi', () => { const p = window.__scene.player.pos; window.__scene.sound.oneShot('mochi-pound', { x: p.x + 2, z: p.z, near: 4, far: 20, gain: 0.2, recipe: 'box' }); }, /mochi/);
    // Han: step into the glow by his car (from outside it: that is what arms the show)
    await step('06-han', async () => { const s = window.__scene.world.experiences.list.find((e) => e.id === 'han'); window.__go(s.x + 8, s.z); await window.__wait(800); window.__go(s.x, s.z); }, /Han/, 25000);
    await shot('06-han-full', true);
    // the konbini: its spot, the choice, the scene (chime, music, the kiosk, ka-ching)
    await step('07-konbini-chime', async () => {
      const s = window.__scene.world.lawson.experiences.list.find((e) => e.id === 'konbini');
      window.__go(s.x, s.z + 3); await window.__wait(300); window.__go(s.x, s.z);
      for (let k = 0; k < 30 && !document.querySelector('.kmenu.on'); k++) await window.__wait(100);
      window.__press('Digit2');
    }, /konbini door chime/, 30000);
    await step('07-konbini-music', () => {}, /store music/, 20000);
    await shot('07-konbini-full', true);
    await step('07-konbini-kiosk', () => {}, /self-checkout/, 90000);
    await step('07-konbini-kaching', () => {}, /ka-ching/, 30000);
    // the beds: each time of day; then the wind
    for (const [look, re] of [['morning', /birdsong/], ['night', /night insects/]]) {
      await step('08-bed-' + look, (look) => { window.__scene.enterHero(look); window.__scene.player.locked = true; }, re, 40000, look);
    }
    if (!ONLY) { const ok = await page.evaluate(() => window.__seen.some((t) => /wind·|·wind/.test(t))); if (!ok) bad++; console.log(ok ? 'pass' : 'FAIL', '08-wind (seen along the way)'); }
    // muted: nothing; paused: hidden
    const n0 = await page.evaluate(() => window.__seen.length);
    await page.evaluate(async () => { window.__scene.sound.toggle(); const z = window.__soundZones.find((z) => z.name === 'shrine-chimes'); window.__go(z.x + 60, z.z); await window.__wait(500); window.__go(z.x + 2, z.z + 2); await window.__wait(1500); });
    const muted = await page.evaluate((n0) => window.__seen.length - n0, n0);
    if (muted) bad++;
    console.log(muted ? 'FAIL' : 'pass', 'muted: new labels', muted);
    await page.evaluate(async () => { window.__scene.sound.toggle(); const z = window.__soundZones.find((z) => z.name === 'donki-theme'); window.__go(z.x + 60, z.z); await window.__wait(400); window.__go(z.x + 2, z.z + 2); await window.__wait(1200); window.__scene.player.locked = false; await window.__wait(600); });
    console.log('paused:', await page.evaluate(() => `${document.querySelectorAll('.snd-pill').length} pills in the box, visibility ${getComputedStyle(document.querySelector('.snd')).visibility}`));
    await shot('09-paused', true);
    console.log('seen', JSON.stringify(await page.evaluate(() => window.__seen), null, 1));
  }
} finally {
  console.log(`errors ${errs.length}`, errs.slice(0, 8), bad ? `${bad} FAILED` : 'all pass');
  await close();
}
process.exit(bad || errs.length ? 1 : 0);
