/* What each emulated engine offers the game (read-only): WebGL2 and the
 * extensions the pipeline needs, pointer lock, touch, audio, and whether the
 * production build reaches its first frame.  One browser at a time.
 *
 *   npm run build && node qa/mobile/probe-engines.mjs
 */
import { chromium, webkit, devices } from 'playwright';
import fs from 'node:fs';
import { serve } from './throttle-server.mjs';

const OUT = new URL('./artifacts/engines.json', import.meta.url).pathname;
const server = await serve({ port: 5181, profile: 'none' });
const results = {};
const runs = [
  ['iPhone 13 (WebKit)', webkit, devices['iPhone 13'], {}],
  ['Pixel 7 (Chromium)', chromium, devices['Pixel 7'], { channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] }],
];
let browser = null;
const cleanup = async () => { await browser?.close().catch(() => {}); await server.close(); };
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, async () => { await cleanup(); process.exit(130); });
try {
  for (const [name, type, device, launch] of runs) {
    browser = await type.launch({ headless: true, ...launch });
    const ctx = await browser.newContext({ ...device });
    await ctx.addInitScript({ path: new URL('./instrument.js', import.meta.url).pathname });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const t0 = Date.now();
    await page.goto(server.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const started = await page.waitForFunction(() => !!window.__scene, null, { timeout: 120000, polling: 200 }).then(() => true, () => false);
    const tScene = Date.now() - t0;
    const r = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2');
      const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
      const ext = gl ? gl.getSupportedExtensions() : [];
      const s = window.__scene;
      let fuji = null;
      if (s) fuji = await Promise.race([s.world.fuji.ready.then(() => true, () => 'failed'), new Promise((r) => setTimeout(() => r('timeout'), 60000))]);
      return {
        ua: navigator.userAgent,
        webgl2: !!gl,
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER),
        maxTexture: gl?.getParameter(gl.MAX_TEXTURE_SIZE),
        colorBufferHalfFloat: ext.includes('EXT_color_buffer_half_float'),
        colorBufferFloat: ext.includes('EXT_color_buffer_float'),
        requestPointerLock: typeof Element.prototype.requestPointerLock,
        fullscreen: typeof document.documentElement.requestFullscreen,
        maxTouchPoints: navigator.maxTouchPoints,
        coarse: matchMedia('(pointer: coarse)').matches,
        hover: matchMedia('(hover: hover)').matches,
        audioContext: typeof (window.AudioContext || window.webkitAudioContext),
        audioSession: typeof navigator.audioSession,
        heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 'n/a (no performance.memory)',
        dpr: devicePixelRatio, inner: [innerWidth, innerHeight],
        pipeline: s ? [s.pipeline.size.x, s.pipeline.size.y, s.pipeline.scale] : null,
        fuji,
        overlay: !!document.querySelector('.overlay'),
      };
    });
    // a tap on Start: does the game begin (pointer lock) and does sound start?
    await page.tap('.menu-action').catch((e) => errors.push('tap: ' + e.message));
    await page.waitForTimeout(2500);
    r.afterTap = await page.evaluate(() => ({
      locked: window.__scene?.player.locked,
      overlayHidden: document.querySelector('.overlay')?.classList.contains('hidden'),
      audio: window.__qa.acState(),
      plays: window.__qa.plays,
      marks: window.__qa.marks,
    }));
    r.started = started; r.tSceneMs = tScene; r.errors = errors.slice(0, 5);
    results[name] = r;
    console.log(name, JSON.stringify(r, null, 1));
    await browser.close(); browser = null;
  }
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
} finally {
  await cleanup();
}
