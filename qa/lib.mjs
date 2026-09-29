// Launch QA helpers (qa/): one browser at a time, everything logged, always closed.
//
//   import { open, ART } from './lib.mjs';
//   const s = await open({ name: 'first-visit', video: true });
//   ... s.page ...
//   await s.close();          // writes qa/artifacts/<name>/log.json
//
// The dev server is ours on 5180 (qa/vite.qa.config.mjs); QA_BASE overrides it
// (the production preview uses the same port).
import fs from 'node:fs';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const ART = path.join(ROOT, 'qa', 'artifacts');
export const BASE = process.env.QA_BASE || 'http://127.0.0.1:5180/';
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ENGINES = { chromium, firefox, webkit };

/**
 * Open a browser and a page with every console line, page error, failed
 * request and response recorded.
 *   engine    chromium (Google Chrome, Metal) | firefox | webkit
 *   autoplay  pass Chrome's no-gesture autoplay flag (headless audio checks)
 *   video     record a video into the scenario's folder
 */
export async function open({ name, engine = 'chromium', headless = true, viewport = { width: 1280, height: 720 }, video = false, autoplay = true, args = [], contextOpts = {} } = {}) {
  const dir = path.join(ART, name);
  fs.mkdirSync(dir, { recursive: true });
  const E = ENGINES[engine];
  let browser;
  if (engine === 'chromium') {
    const flags = ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info', ...(autoplay ? ['--autoplay-policy=no-user-gesture-required'] : []), ...args];
    try { browser = await E.launch({ channel: 'chrome', headless, args: flags }); } catch { browser = await E.launch({ headless, args: flags }); }
  } else {
    browser = await E.launch({ headless, args });
  }
  const context = await browser.newContext({
    viewport,
    ...(video ? { recordVideo: { dir, size: { width: Math.min(viewport.width, 1280), height: Math.min(viewport.height, 720) } } } : {}),
    ...contextOpts,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(180000);
  const log = { engine, viewport, console: [], errors: [], failed: [], http: [], responses: [] };
  const t0 = Date.now();
  const at = () => +((Date.now() - t0) / 1000).toFixed(2);
  const watch = (p) => {
    p.on('console', (m) => log.console.push({ t: at(), type: m.type(), text: m.text().slice(0, 500) }));
    p.on('pageerror', (e) => log.errors.push({ t: at(), text: String(e.stack || e).slice(0, 800) }));
    p.on('requestfailed', (r) => log.failed.push({ t: at(), url: r.url(), why: r.failure()?.errorText }));
    p.on('response', (r) => {
      const u = r.url();
      log.responses.push({ t: at(), url: u, status: r.status(), type: r.request().resourceType(), ct: r.headers()['content-type'] ?? '', cc: r.headers()['cache-control'] ?? '' });
      if (r.status() >= 400) log.http.push({ t: at(), url: u, status: r.status() });
    });
  };
  watch(page);
  context.on('page', (p) => { if (p !== page) watch(p); });
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    fs.writeFileSync(path.join(dir, 'log.json'), JSON.stringify(log, null, 1));
    await Promise.race([context.close().then(() => browser.close()), wait(15000)]).catch(() => {});
    try { await browser.close(); } catch {}
  };
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(sig, async () => { await close(); process.exit(130); });
  process.once('uncaughtException', async (e) => { console.error(e); await close(); process.exit(1); });
  const shot = async (n, opts = {}) => {
    const file = path.join(dir, n + (opts.png ? '.png' : '.jpg'));
    await page.screenshot({ path: file, type: opts.png ? 'png' : 'jpeg', quality: opts.png ? undefined : 82, fullPage: false, ...(opts.clip ? { clip: opts.clip } : {}) });
    return path.relative(ROOT, file);
  };
  const save = (n, obj) => fs.writeFileSync(path.join(dir, n), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 1));
  return { browser, context, page, log, dir, close, shot, save, at };
}

/** Wait until the town is built and Fuji has loaded (dev hook), or the start card at least (production). */
export async function ready(page, { dev = true, timeout = 150000 } = {}) {
  if (dev) await page.waitForFunction(() => window.__ready === true, null, { timeout, polling: 250 });
  else await page.waitForSelector('.overlay .menu-action', { timeout });
  await page.waitForFunction(() => !!window.__scene, null, { timeout, polling: 250 });
}

/**
 * The in-page harness (after ready): standBy, press, prompt, audible, spotOf.
 * `lockFake` marks the player locked (headless Chrome has no pointer lock).
 */
export async function harness(page, { lockFake = true, startSound = true } = {}) {
  await page.evaluate(({ lockFake, startSound }) => {
    const { player, hud, sound, world, camera } = window.__scene;
    window.__toasts = [];
    const flash = hud.flash.bind(hud);
    hud.flash = (t, ...a) => { window.__toasts.push(t); return flash(t, ...a); };
    if (startSound) sound.start();
    if (lockFake) {
      player.locked = true;
      player.onLockChange?.(true);
    }
    window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__prompt = () => { const p = document.querySelector('.hud .prompt'); return p?.classList.contains('on') ? p.textContent : ''; };
    window.__standBy = (sx, sz, d = 2.0, aimY = 1.0, prefer = null) => {
      const R = 0.34;
      const blocked = (x, z) => world.colliders.some((c) => c.top > world.heightAt(x, z) + 0.45 && x > c.x0 - R && x < c.x1 + R && z > c.z0 - R && z < c.z1 + R);
      const angs = [];
      for (let k = 0; k < 16; k++) angs.push((k / 16) * Math.PI * 2);
      if (prefer !== null) angs.unshift(prefer);
      for (const a of angs) {
        const x = sx + Math.sin(a) * d, z = sz + Math.cos(a) * d;
        if (blocked(x, z)) continue;
        player.pos.set(x, world.heightAt(x, z), z);
        player.vel.set(0, 0, 0);
        const dx = sx - x, dz = sz - z;
        if (d > 0.01) player.yaw = Math.atan2(-dx, -dz);
        player.pitch = d > 0.01 ? Math.atan2(world.heightAt(sx, sz) + aimY - (player.pos.y + 1.6), d) : player.pitch;
        return { x: +x.toFixed(2), z: +z.toFixed(2) };
      }
      return null;
    };
    window.__press = (code) => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    };
    window.__spotOf = (id) => world.experiences.list.find((e) => e.id === id) ?? world.lawson.experiences.list.find((e) => e.id === id);
    window.__audible = () => (window.__soundZones ?? []).map((z) => ({ name: z.name, d: Math.hypot(z.x - camera.position.x, z.z - camera.position.z), far: z.far, lvl: z.g ? +z.g.gain.value.toFixed(3) : 0 }))
      .filter((z) => z.d < z.far).map((z) => `${z.name}@${z.d.toFixed(1)}m g${z.lvl}`);
    window.__mem = () => (performance.memory ? { used: Math.round(performance.memory.usedJSHeapSize / 1048576), total: Math.round(performance.memory.totalJSHeapSize / 1048576) } : null);
    window.__gl = () => { const i = window.__scene.renderer.info; return { geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length ?? 0, calls: i.render.calls, tris: i.render.triangles }; };
  }, { lockFake, startSound });
}

/**
 * Audio spy (add before the page loads): every AudioContext made, every buffer source and
 * oscillator started and ended, every <audio> play/pause, and the first user gesture, with
 * times.  window.__qaAudio = { firstGesture, contexts: [...], events: [...], active(), media: [...] }.
 */
export async function audioSpy(context) {
  await context.addInitScript(() => {
    const A = window.__qaAudio = { firstGesture: null, contexts: [], events: [], media: [], live: 0, peak: 0, osc: 0, oscPeak: 0 };
    const now = () => +(performance.now() / 1000).toFixed(3);
    for (const ev of ['pointerdown', 'keydown', 'click']) window.addEventListener(ev, (e) => { if (A.firstGesture === null && e.isTrusted) A.firstGesture = { t: now(), ev }; }, { capture: true });
    const Orig = window.AudioContext || window.webkitAudioContext;
    const ctxs = [];
    if (Orig) {
      const Spy = function (...a) { const c = new Orig(...a); ctxs.push(c); A.contexts.push({ t: now(), state: c.state }); c.addEventListener?.('statechange', () => A.events.push({ t: now(), k: 'ctx', state: c.state, i: ctxs.indexOf(c) })); return c; };
      Spy.prototype = Orig.prototype;
      window.AudioContext = Spy;
      if (window.webkitAudioContext) window.webkitAudioContext = Spy;
      // every connection into a context's speakers is also tapped into an analyser, one per context
      const connect = AudioNode.prototype.connect;
      const taps = new Map();
      AudioNode.prototype.connect = function (dest, ...rest) {
        const r = connect.call(this, dest, ...rest);
        if (dest instanceof AudioDestinationNode) {
          const c = dest.context;
          if (!taps.has(c)) { const an = c.createAnalyser(); an.fftSize = 2048; taps.set(c, an); }
          connect.call(this, taps.get(c));
        }
        return r;
      };
      /** RMS and peak coming out of context i over `ms` (what the speakers get from it). */
      A.level = async (i, ms = 1200) => {
        const c = ctxs[i]; const an = c && taps.get(c);
        if (!an) return null;
        const buf = new Float32Array(an.fftSize);
        let peak = 0, sum = 0, n = 0;
        const t0 = performance.now();
        while (performance.now() - t0 < ms) {
          an.getFloatTimeDomainData(buf);
          for (const v of buf) { peak = Math.max(peak, Math.abs(v)); sum += v * v; n++; }
          await new Promise((r) => setTimeout(r, 40));
        }
        return { rms: +Math.sqrt(sum / n).toFixed(5), peak: +peak.toFixed(4), state: c.state };
      };
      A.nContexts = () => ctxs.length;
    }
    const bs = window.AudioBufferSourceNode?.prototype;
    if (bs) {
      const start = bs.start;
      bs.start = function (...a) {
        A.live++; A.peak = Math.max(A.peak, A.live);
        const dur = this.buffer ? +this.buffer.duration.toFixed(2) : null;
        A.events.push({ t: now(), k: 'buf', dur, loop: this.loop });
        this.addEventListener('ended', () => { A.live--; });
        return start.apply(this, a);
      };
    }
    const os = window.OscillatorNode?.prototype;
    if (os) {
      const start = os.start;
      os.start = function (...a) { A.osc++; A.oscPeak = Math.max(A.oscPeak, A.osc); this.addEventListener('ended', () => { A.osc--; }); return start.apply(this, a); };
    }
    const mp = HTMLMediaElement.prototype;
    const play = mp.play, pause = mp.pause;
    mp.play = function (...a) { A.media.push({ t: now(), k: 'play', src: (this.currentSrc || this.src).split('/').pop(), at: +this.currentTime.toFixed(2) }); return play.apply(this, a); };
    mp.pause = function (...a) { A.media.push({ t: now(), k: 'pause', src: (this.currentSrc || this.src).split('/').pop(), at: +this.currentTime.toFixed(2) }); return pause.apply(this, a); };
  });
}

/** Frame-time sampler in the page: rAF intervals for `ms`. */
export async function fps(page, ms = 5000) {
  return page.evaluate(async (ms) => {
    const d = [];
    let last = performance.now();
    await new Promise((res) => {
      const t0 = last;
      const f = (t) => { d.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(f); else res(); };
      requestAnimationFrame(f);
    });
    d.shift();
    d.sort((a, b) => a - b);
    const avg = d.reduce((a, b) => a + b, 0) / d.length;
    return { frames: d.length, avgMs: +avg.toFixed(2), fps: +(1000 / avg).toFixed(1), p50: +d[d.length >> 1].toFixed(2), p95: +d[Math.floor(d.length * 0.95)].toFixed(2), p99: +d[Math.floor(d.length * 0.99)].toFixed(2), max: +d[d.length - 1].toFixed(2), over33: d.filter((x) => x > 33.4).length, over50: d.filter((x) => x > 50).length };
  }, ms);
}

export function writeJSON(file, obj) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(obj, null, 1)); }
