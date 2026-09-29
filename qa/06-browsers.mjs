// Browsers and screens: the core scenario on Chrome (Chromium), Firefox and WebKit (Playwright's builds,
// headless) at 1366x768, 1920x1080 and 2560x1440.  Per run: time to the card, the card fitting, Start
// (real pointer lock where the engine gives it), the famous view, frame times, the audio decoding,
// and (at 1366x768) one konbini visit through to eating.
//   node qa/06-browsers.mjs [--engines chromium,firefox,webkit] [--sizes 1366x768,1920x1080,2560x1440]
import { open, ready, harness, audioSpy, wait, fps, writeJSON, ART } from './lib.mjs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const engines = arg('--engines', 'chromium,firefox,webkit').split(',');
const sizes = arg('--sizes', '1366x768,1920x1080,2560x1440').split(',').map((s) => s.split('x').map(Number));
const BASE = process.env.QA_BASE || 'http://127.0.0.1:5180/';
const out = [];
const file = path.join(ART, '06-browsers', 'result.json');

for (const engine of engines) {
  for (const [W, H] of sizes) {
    const id = `${engine}-${W}x${H}`;
    const s = await open({ name: `06-browsers/${id}`, engine, viewport: { width: W, height: H }, autoplay: false });
    await audioSpy(s.context);
    const { page } = s;
    const r = { id, engine, W, H };
    try {
      const t0 = Date.now();
      await page.goto(BASE, { waitUntil: 'commit', timeout: 120000 });
      await page.waitForSelector('.overlay .menu-action', { timeout: 240000 });
      r.cardMs = Date.now() - t0;
      await ready(page, { timeout: 240000 });
      r.readyMs = Date.now() - t0;
      await wait(1000);
      r.gpu = await page.evaluate(() => { const gl = window.__scene.renderer.getContext(); const d = gl.getExtension('WEBGL_debug_renderer_info'); return { webgl2: gl instanceof WebGL2RenderingContext, renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) }; });
      r.fit = await page.evaluate(() => { const m = document.querySelector('.overlay .menu').getBoundingClientRect(); return { w: Math.round(m.width), h: Math.round(m.height), inside: m.left >= 0 && m.top >= 0 && m.right <= innerWidth && m.bottom <= innerHeight }; });
      r.cardShot = await s.shot('card');
      await page.click('.overlay .menu-action');
      await wait(1500);
      r.lock = await page.evaluate(() => ({ locked: window.__scene.player.locked, pl: !!document.pointerLockElement, ac: window.__scene.sound.debug?.ac?.state ?? null, contexts: window.__qaAudio.contexts.length }));
      await harness(page, { lockFake: !r.lock.locked, startSound: true });
      await wait(1500);
      r.viewShot = await s.shot('view');
      r.fps = await fps(page, 4000);
      // audio: do the files decode here?  (AAC, HE-AAC in .m4a)
      r.audio = await page.evaluate(async () => {
        const snd = window.__scene.sound;
        const names = ['lawson-chime', 'kiosk-scan', 'kiosk-pay', 'ka-ching', 'walk-kakko', 'railway-bells', 'han-drift', 'donki-theme', 'station-ambience', 'train-nextstop', 'rural-flute', 'shrine-chimes', 'birds', 'wind', 'night-insects', 'crows', 'bite', 'munch', 'gulp', 'can-open', 'wrapper', 'auto-door', 'fridge-door'];
        const ok = await snd.preload(names);
        const bad = names.filter((n) => !snd.debug.buffers.has(n));
        // the streamed ones (store music, the title song): can this engine play them?
        const probe = async (f) => { const a = new Audio('audio/' + f); a.muted = true; try { await a.play(); await new Promise((r) => setTimeout(r, 400)); const t = a.currentTime; a.pause(); return t > 0 ? 'plays' : 'stalled'; } catch (e) { return 'error: ' + e.name; } };
        return { allDecoded: ok, notDecoded: bad, storeBgm: await probe('store-bgm.m4a'), theme: await probe('theme.m4a'), ctx: snd.debug.ac?.state, sampleRate: snd.debug.ac?.sampleRate };
      });
      // the trains' own AudioContext (line/sfx.js) is made later, outside any click: does this engine let it run?
      await page.evaluate(() => { const { player: p, world } = window.__scene; world.line.local.service.stage('platform'); const r0 = world.line.local.service.runs[0]; r0.phase = 'hold'; r0.t = 2.5; p.pos.set(56, world.heightAt(56, -129), -129); p.applyCamera(0); });
      await wait(5000);
      r.trainCtx = await page.evaluate(async () => ({ contexts: window.__qaAudio.contexts.length, states: window.__qaAudio.events.filter((e) => e.k === 'ctx').map((e) => `${e.i}:${e.state}`), level: window.__qaAudio.contexts.length > 1 ? await window.__qaAudio.level(1, 800) : null }));
      await page.evaluate(() => { const { player: p, world } = window.__scene; p.pos.set(-8, world.heightAt(-8, 8), 8); p.yaw = 0; p.applyCamera(0); });
      await wait(800);
      if (W === sizes[0][0]) {
        // the konbini, start to finish
        // off the ring for a few drawn frames (slow engines draw slowly), then onto it
        await page.evaluate(() => { const p = window.__scene.player, W = window.__scene.world; p.pos.set(-2.3, W.heightAt(-2.3, 6), 6); });
        const d0 = await page.evaluate(() => window.__drawn ?? 0);
        for (let k = 0; k < 100 && (await page.evaluate(() => window.__drawn ?? 0)) < d0 + 4; k++) await wait(100);
        await page.evaluate(() => { const p = window.__scene.player, W = window.__scene.world; p.pos.set(-2.3, W.heightAt(-2.3, 2.3), 2.3); });
        let menu = false;
        for (let k = 0; k < 100 && !menu; k++) { await wait(200); menu = await page.evaluate(() => !!document.querySelector('.kmenu.on')); }
        await page.keyboard.press('Digit5');
        const v0 = Date.now();
        let mid = null;
        for (let k = 0; k < 480; k++) {
          await wait(250);
          const v = await page.evaluate(() => ({ a: window.__store.shop.visiting, t: window.__store.shop.debug.visit().t, phase: window.__store.shop.phase }));
          if (!mid && v.phase === 'till') mid = await s.shot('konbini-till');
          if (!v.a && k > 2) { r.konbini = { menu, gameT: +(v.t ?? 0).toFixed(1), started: v.t !== undefined, wallS: +((Date.now() - v0) / 1000).toFixed(1) }; break; }
        }
        r.konbini ??= { menu, stuck: true };
        r.konbini.heard = await page.evaluate(() => window.__store.shop.debug.heard.slice());
        r.konbini.eatShot = await s.shot('konbini-after');
      }
      r.errors = s.log.errors.map((e) => e.text.slice(0, 300));
      r.warnings = s.log.console.filter((c) => c.type === 'warning' || c.type === 'error').map((c) => c.text.slice(0, 200)).slice(0, 12);
      r.http = s.log.http;
    } catch (e) {
      r.crash = String(e.stack || e).slice(0, 600);
      try { r.crashShot = await s.shot('crash'); } catch {}
    } finally {
      await s.close();
    }
    out.push(r);
    console.log(JSON.stringify({ id: r.id, cardMs: r.cardMs, readyMs: r.readyMs, fit: r.fit, lock: r.lock, fps: r.fps && { fps: r.fps.fps, p95: r.fps.p95 }, audio: r.audio, trainCtx: r.trainCtx, konbini: r.konbini && { gameT: r.konbini.gameT, wall: r.konbini.wallS, heard: r.konbini.heard }, errors: r.errors?.length, crash: r.crash?.slice(0, 200) }));
    writeJSON(file, out);
  }
}
