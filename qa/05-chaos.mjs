// Scenario 5, the chaos player: key mashing, resizes, focus and visibility, losing the pointer lock,
// two tabs, refresh mid-scene, the GPU context lost, no WebGL at all, and a phone.
//   node qa/05-chaos.mjs [--only mash,resize,...]
import { open, ready, harness, audioSpy, wait, fps, writeJSON, ART } from './lib.mjs';
import path from 'node:path';
import { devices } from 'playwright';

const name = '05-chaos';
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1].split(',') : null; })();
const BASE = process.env.QA_BASE || 'http://127.0.0.1:5180/';
const results = {};
const want = (id) => !only || only.includes(id);
const save = () => writeJSON(path.join(ART, name, 'result.json'), results);
const log = (id, r) => { results[id] = r; console.log(id, JSON.stringify(r).slice(0, 1400)); save(); };

/* ---------- one session for the in-game chaos ---------- */
if (['mash', 'resize', 'focus', 'unlock', 'refresh', 'ctxlost', 'tabs'].some(want)) {
  const s = await open({ name, autoplay: false });
  await audioSpy(s.context);
  const { page } = s;
  const ev = (fn, a) => page.evaluate(fn, a);
  const start = async () => { await page.goto(BASE); await ready(page); await wait(400); await page.click('.overlay .menu-action'); await wait(1200); await harness(page, { lockFake: false, startSound: false }); };
  try {
    await start();
    if (want('mash')) {
      const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyE', 'KeyF', 'KeyM', 'KeyN', 'KeyR', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit9', 'Digit0', 'KeyQ', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'KeyP', 'KeyI', 'KeyU', 'KeyY', 'KeyT', 'KeyO', 'KeyG', 'Tab', 'Enter', 'Backspace', 'Backquote', 'Minus', 'Equal', 'BracketLeft', 'Semicolon', 'Slash', 'ShiftLeft', 'AltLeft', 'CapsLock', 'F1', 'Home', 'PageDown'];
      let seed = 7;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const out = [];
      for (let round = 0; round < 3; round++) {
        // round 1 on the famous view, round 2 on the konbini's spot mid-scene, round 3 by Han mid-show
        if (round === 1) { await ev(() => { window.__standBy(-2.3, 6, 0.01); }); await wait(300); await ev(() => { const p = window.__scene.player, W = window.__scene.world; p.pos.set(-2.3, W.heightAt(-2.3, 2.3), 2.3); }); await wait(700); await page.keyboard.press('Digit2'); await wait(600); }
        if (round === 2) { await ev(() => { const s = window.__spotOf('han'); const p = window.__scene.player, W = window.__scene.world; p.pos.set(s.x + 3, W.heightAt(s.x, s.z), s.z); }); await wait(400); await ev(() => { const s = window.__spotOf('han'); const p = window.__scene.player, W = window.__scene.world; p.pos.set(s.x, W.heightAt(s.x, s.z), s.z); }); await wait(600); }
        for (let k = 0; k < 250; k++) {
          const code = keys[Math.floor(rnd() * keys.length)];
          const key = code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code;
          try { if (rnd() < 0.2) { await page.keyboard.down(key); await wait(rnd() * 300); await page.keyboard.up(key); } else await page.keyboard.press(key); } catch {}
          if (k % 25 === 0) await wait(120);
        }
        await wait(1500);
        // whatever state it was left in: can we still play?  (resume if paused, close the map if open)
        const st = await ev(() => ({ locked: window.__scene.player.locked, susp: !!window.__scene.player.suspended, scripted: !!window.__scene.player.scripted, seat: !!window.__scene.player.seat, visiting: window.__store.shop.visiting, han: window.__han.state().run, coords: document.querySelector('.coords')?.classList.contains('on'), ink: window.__scene.pipeline.enabled.ink, grade: window.__scene.pipeline.enabled.grade, muted: window.__scene.sound.muted, filter: document.getElementById('view').style.filter, fade: [...document.body.children].find((e) => e.style?.zIndex === '4')?.style.opacity }));
        out.push({ round, ...st, shot: await s.shot(`mash-round${round}`) });
        if (!st.locked) { await page.click('.overlay .menu-action').catch(() => {}); await wait(800); }
        await ev(() => { if (window.__store.shop.visiting) window.__store.shop.debug.cancel(); window.__han.stop(); });
        await ev(() => { window.__scene.pipeline.enabled.ink = true; window.__scene.pipeline.enabled.grade = true; });
      }
      log('mash', { out, errors: s.log.errors.slice() });
    }
    if (want('resize')) {
      const sizes = [[800, 600], [1920, 1080], [1366, 768], [640, 480], [2560, 1440], [1024, 700], [3440, 1440], [1280, 720]];
      const out = [];
      for (let r = 0; r < 3; r++) for (const [w, h] of sizes) { await page.setViewportSize({ width: w, height: h }); await wait(r === 2 ? 700 : 80); if (r === 2) out.push({ w, h, ...(await ev(() => ({ canvas: [document.getElementById('view').width, document.getElementById('view').height], css: [innerWidth, innerHeight], aspect: +window.__scene.camera.aspect.toFixed(3) }))) }); }
      // the pause card at the smallest sizes
      await ev(() => document.exitPointerLock());
      await wait(700);
      const cards = [];
      for (const [w, h] of [[800, 600], [1024, 640], [1280, 720], [640, 480]]) {
        await page.setViewportSize({ width: w, height: h }); await wait(500);
        const fit = await ev(() => { const m = document.querySelector('.overlay .menu').getBoundingClientRect(); const b = document.querySelector('.overlay .menu-action').getBoundingClientRect(); return { menu: [Math.round(m.left), Math.round(m.top), Math.round(m.right), Math.round(m.bottom)], button: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], vw: innerWidth, vh: innerHeight, cutOff: m.left < 0 || m.right > innerWidth || m.top < 0 || m.bottom > innerHeight, buttonVisible: b.right <= innerWidth && b.bottom <= innerHeight }; });
        cards.push({ w, h, ...fit, shot: await s.shot(`resize-card-${w}x${h}`) });
      }
      await page.setViewportSize({ width: 1280, height: 720 }); await wait(500);
      await page.click('.overlay .menu-action'); await wait(800);
      log('resize', { out, cards, errors: s.log.errors.slice() });
    }
    if (want('focus')) {
      // another tab in front: the game's tab hidden.  Does it stop drawing and suspend audio?
      const d0 = await ev(() => window.__drawn);
      const page2 = await s.context.newPage();
      await page2.goto('about:blank');
      await page2.bringToFront();
      await wait(3000);
      const hid = await ev(() => ({ hidden: document.hidden, drawn: window.__drawn, ac: window.__scene.sound.debug.ac.state, sfx: window.__qaAudio.events.filter((e) => e.k === 'ctx').slice(-4) }));
      await page.bringToFront();
      await wait(1500);
      const back = await ev(() => ({ hidden: document.hidden, drawn: window.__drawn, ac: window.__scene.sound.debug.ac.state, locked: window.__scene.player.locked }));
      await page2.close();
      // window blur while playing (alt-tab): keys held stay held?
      await page.keyboard.down('ArrowUp'); await wait(300);
      await ev(() => window.dispatchEvent(new Event('blur')));
      await wait(600);
      const p0 = await ev(() => [window.__scene.player.pos.x, window.__scene.player.pos.z]);
      await wait(800);
      const p1 = await ev(() => [window.__scene.player.pos.x, window.__scene.player.pos.z]);
      await page.keyboard.up('ArrowUp');
      log('focus', { drawnWhileHidden: hid.drawn - d0, hid, back, keptWalkingAfterBlur: Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 0.1 });
    }
    if (want('unlock')) {
      // pointer lock lost mid-konbini, mid-Han, seated, map open: then regained
      const out = {};
      await ev(() => { const p = window.__scene.player, W = window.__scene.world; p.pos.set(-2.3, W.heightAt(-2.3, 6), 6); }); await wait(400);
      await ev(() => { const p = window.__scene.player, W = window.__scene.world; p.pos.set(-2.3, W.heightAt(-2.3, 2.3), 2.3); }); await wait(800);
      await page.keyboard.press('Digit1'); await wait(3000);
      const t0 = await ev(() => window.__store.shop.debug.visit().t);
      await ev(() => document.exitPointerLock()); await wait(3000);
      const t1 = await ev(() => window.__store.shop.debug.visit().t);
      out.konbini = { heldWhilePaused: +(t1 - t0).toFixed(2), card: await ev(() => document.querySelector('.overlay').dataset.mode), shot: await s.shot('unlock-konbini') };
      await page.click('.overlay .menu-action'); await wait(1200);
      out.konbini.resumed = await ev(() => ({ locked: window.__scene.player.locked, visiting: window.__store.shop.visiting }));
      for (let k = 0; k < 200 && await ev(() => window.__store.shop.visiting); k++) await wait(250);
      // map open, lose lock
      await page.keyboard.press('KeyM'); await wait(400);
      await ev(() => document.exitPointerLock()); await wait(700);
      out.map = await ev(() => ({ susp: !!window.__scene.player.suspended, mapOpen: !document.querySelector('.fullmap').classList.contains('hidden') }));
      await page.click('.overlay .menu-action'); await wait(900);
      out.map.after = await ev(() => ({ susp: !!window.__scene.player.suspended, locked: window.__scene.player.locked }));
      // clicking the canvas while paused? (the card covers it)  Enter on the focused button resumes?
      await ev(() => document.exitPointerLock()); await wait(700);
      await page.keyboard.press('Enter'); await wait(900);
      out.enterResumes = await ev(() => window.__scene.player.locked);
      if (!out.enterResumes) { await page.click('.overlay .menu-action'); await wait(800); }
      log('unlock', out);
    }
    if (want('ctxlost')) {
      const r = {};
      r.before = await ev(() => ({ drawn: window.__drawn }));
      await ev(() => { window.__lose = window.__scene.renderer.getContext().getExtension('WEBGL_lose_context'); window.__lose.loseContext(); });
      await wait(2000);
      r.lost = await ev(() => ({ drawn: window.__drawn, isLost: window.__scene.renderer.getContext().isContextLost(), msg: document.body.innerText.slice(0, 200) }));
      r.lostShot = await s.shot('ctx-lost');
      await ev(() => window.__lose.restoreContext());
      await wait(4000);
      r.restored = await ev(() => ({ drawn: window.__drawn, isLost: window.__scene.renderer.getContext().isContextLost() }));
      r.restoredShot = await s.shot('ctx-restored');
      r.errors = s.log.errors.slice(-5);
      log('ctxlost', r);
      await start();
    }
    if (want('refresh')) {
      const r = {};
      await ev(() => { const p = window.__scene.player, W = window.__scene.world; p.pos.set(-2.3, W.heightAt(-2.3, 6), 6); }); await wait(400);
      await ev(() => { const p = window.__scene.player, W = window.__scene.world; p.pos.set(-2.3, W.heightAt(-2.3, 2.3), 2.3); }); await wait(800);
      await page.keyboard.press('Digit2'); await wait(4000);
      const e0 = s.log.errors.length;
      const t0 = Date.now();
      await page.reload();
      await ready(page);
      r.reloadMs = Date.now() - t0;
      r.afterReload = await ev(() => ({ card: document.querySelector('.overlay').dataset.mode, hidden: document.querySelector('.overlay').classList.contains('hidden'), volume: localStorage.getItem('lawson-fuji-volume') }));
      r.newErrors = s.log.errors.slice(e0);
      await page.click('.overlay .menu-action'); await wait(1200);
      await harness(page, { lockFake: false, startSound: false });
      r.state = await ev(() => ({ visiting: window.__store.shop.visiting, stock: window.__store.shop.debug.pickable.map((u) => `${u.id}:${u.count}`) }));
      log('refresh', r);
    }
    if (want('tabs')) {
      // the game open twice
      const page2 = await s.context.newPage();
      const t0 = Date.now();
      await page2.goto(BASE);
      await page2.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
      const r = { secondReadyMs: Date.now() - t0 };
      await page2.click('.overlay .menu-action'); await wait(1500);
      r.second = await page2.evaluate(() => ({ locked: window.__scene.player.locked, ac: window.__scene.sound.debug.ac?.state }));
      r.first = await ev(() => ({ locked: window.__scene.player.locked, hidden: document.hidden, ac: window.__scene.sound.debug.ac.state }));
      const cdp = await s.context.newCDPSession(page2);
      const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
      r.secondHeapMB = Math.round(m.JSHeapUsedSize / 1048576);
      await page2.close();
      await page.bringToFront();
      log('tabs', r);
    }
  } catch (e) { console.error(e); results.crash = String(e.stack || e); } finally { save(); await s.close(); }
}

/* ---------- no WebGL at all ---------- */
if (want('nowebgl')) {
  const s = await open({ name: name + '-nowebgl', args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] });
  try {
    await s.page.goto(BASE);
    await wait(15000);
    const r = { text: await s.page.evaluate(() => document.body.innerText.slice(0, 300)), overlay: await s.page.evaluate(() => !!document.querySelector('.overlay')), errors: s.log.errors.map((e) => e.text.slice(0, 200)), shot: await s.shot('no-webgl') };
    log('nowebgl', r);
  } finally { await s.close(); }
}

/* ---------- a phone (the most likely first visit, from a social link) ---------- */
for (const [id, dev, engine] of [['phone-iphone', 'iPhone 13', 'webkit'], ['phone-android', 'Pixel 7', 'chromium']]) {
  if (!want(id)) continue;
  const d = devices[dev];
  const s = await open({ name: name + '-' + id, engine, viewport: d.viewport, contextOpts: { userAgent: d.userAgent, deviceScaleFactor: d.deviceScaleFactor, isMobile: d.isMobile, hasTouch: d.hasTouch } });
  try {
    const t0 = Date.now();
    await s.page.goto(BASE);
    const r = {};
    try { await s.page.waitForSelector('.overlay .menu-action', { timeout: 150000 }); r.cardMs = Date.now() - t0; } catch { r.cardMs = null; }
    await wait(1500);
    r.card = await s.shot('card');
    r.fit = await s.page.evaluate(() => { const m = document.querySelector('.overlay .menu')?.getBoundingClientRect(); return m ? { left: Math.round(m.left), right: Math.round(m.right), top: Math.round(m.top), bottom: Math.round(m.bottom), vw: innerWidth, vh: innerHeight } : null; });
    try { await s.page.tap('.overlay .menu-action', { timeout: 5000 }); } catch (e) { r.tapError = String(e).slice(0, 200); }
    await wait(2500);
    r.afterTap = await s.page.evaluate(() => ({ locked: window.__scene?.player.locked ?? null, overlay: document.querySelector('.overlay')?.className, pointerLockApi: typeof document.body.requestPointerLock }));
    r.afterTapShot = await s.shot('after-tap');
    r.errors = s.log.errors.map((e) => e.text.slice(0, 300));
    r.heap = await s.page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
    log(id, r);
  } finally { await s.close(); }
}
