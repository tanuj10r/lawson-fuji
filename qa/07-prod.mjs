// The production build, served by `vite preview` on 5180 (start it first: see QA_REPORT.md).
//   load     cold loads: plain, "Fast 4G" and "Slow 4G" with a 4x slower CPU; time to the card, bytes, requests
//   perf     frame times, draw calls and triangles at the heavy spots, 1920x1080 and 2560x1440; heap after GC
//   leak     globals and logs a visitor's console would show
//   node qa/07-prod.mjs [--only load,perf,leak]
import { open, wait, fps, writeJSON, ART } from './lib.mjs';
import path from 'node:path';

const name = '07-prod';
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1].split(',') : null; })();
const want = (id) => !only || only.includes(id);
const BASE = process.env.QA_BASE || 'http://127.0.0.1:5180/';
const results = {};
const save = () => writeJSON(path.join(ART, name, 'result.json'), results);

async function coldLoad(label, net = null, cpu = 1) {
  const s = await open({ name: `${name}/load-${label}`, autoplay: false });
  const { page } = s;
  const cdp = await s.context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (net) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...net });
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const reqs = new Map();
  cdp.on('Network.responseReceived', (e) => reqs.set(e.requestId, { url: e.response.url, status: e.response.status, type: e.type, mime: e.response.mimeType, enc: e.response.headers['content-encoding'] ?? e.response.headers['Content-Encoding'] ?? '', cc: e.response.headers['cache-control'] ?? e.response.headers['Cache-Control'] ?? '' }));
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
  const r = { label, net, cpu };
  try {
    const t0 = Date.now();
    await page.goto(BASE, { waitUntil: 'commit' });
    await page.waitForSelector('.overlay .menu-action', { timeout: 300000 });
    r.cardMs = Date.now() - t0;
    // longest main-thread block while loading: a probe timer every 50 ms
    const paint = await page.evaluate(() => { const p = performance.getEntriesByType('paint'); const n = performance.getEntriesByType('navigation')[0]; return { fcp: Math.round(p.find((x) => x.name === 'first-contentful-paint')?.startTime ?? -1), fp: Math.round(p.find((x) => x.name === 'first-paint')?.startTime ?? -1), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), ttfb: Math.round(n.responseStart) }; });
    r.paint = paint;
    // the key art in the card: loaded?
    r.keyart = await page.evaluate(() => { const i = document.querySelector('.menu-art img'); return i ? { complete: i.complete, w: i.naturalWidth } : null; });
    // Start works at once?
    await page.click('.overlay .menu-action');
    await wait(800);
    r.startLocked = await page.evaluate(() => !!document.pointerLockElement);
    const f = Date.now();
    // Fuji: the mountain is built when its elevation arrives (async): how long after Start is it there?
    await page.waitForFunction(() => { let n = 0; window.__scene?.scene.traverse((o) => { if (o.name && /fuji/i.test(o.name) && o.isMesh) n++; }); return n > 0; }, null, { timeout: 120000 }).catch(() => {});
    r.fujiAfterStartMs = Date.now() - f;
    await wait(3000);
    r.shot = await s.shot('after-start');
    const list = [...reqs.values()];
    r.requests = list.length;
    r.bytes = list.reduce((n, x) => n + (x.bytes ?? 0), 0);
    r.byType = {};
    for (const x of list) { const k = x.url.includes('/audio/') ? 'audio' : x.type; r.byType[k] = (r.byType[k] ?? 0) + (x.bytes ?? 0); }
    r.largest = list.sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0)).slice(0, 12).map((x) => ({ url: x.url.replace(BASE, '/'), kB: Math.round((x.bytes ?? 0) / 1024), mime: x.mime, enc: x.enc, cc: x.cc }));
    r.non200 = list.filter((x) => x.status !== 200 && x.status !== 304).map((x) => `${x.status} ${x.url}`);
    r.errors = s.log.errors.map((e) => e.text.slice(0, 200));
    r.console = s.log.console.map((c) => `${c.type}: ${c.text.slice(0, 160)}`);
  } catch (e) { r.crash = String(e.stack || e).slice(0, 500); } finally { await s.close(); }
  results[`load-${label}`] = r;
  console.log(label, JSON.stringify({ cardMs: r.cardMs, paint: r.paint, fuji: r.fujiAfterStartMs, requests: r.requests, MB: +(r.bytes / 1048576).toFixed(2), non200: r.non200, errors: r.errors }));
  save();
}

if (want('load')) {
  await coldLoad('plain');
  await coldLoad('fast4g-cpu4x', { latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 }, 4);
  await coldLoad('slow4g-cpu4x', { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (0.75 * 1024 * 1024) / 8 }, 4);
}

if (want('perf')) {
  for (const [W, H] of [[1920, 1080], [2560, 1440]]) {
    const s = await open({ name: `${name}/perf-${W}x${H}`, viewport: { width: W, height: H }, autoplay: false });
    const { page } = s;
    const cdp = await s.context.newCDPSession(page);
    await cdp.send('Performance.enable');
    const r = { W, H, spots: [] };
    try {
      await page.goto(BASE);
      await page.waitForSelector('.overlay .menu-action', { timeout: 300000 });
      await wait(3000);
      await page.click('.overlay .menu-action');
      await wait(2500);
      const gpu = await page.evaluate(() => { const gl = window.__scene.renderer.getContext(); const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null; });
      r.gpu = gpu;
      // the places a player stands (world x, z, yaw); the town frame is world = (-x, 27.7 - z)
      const spots = [
        ['famous-view', 0, 16.5, 0, 0.16], ['konbini-door', -2.3, 3, 0, 0], ['car-park-han', -21.7, 23.5, 1.2, 0],
        ['master-junction', -30, 8, -1.57, 0], ['shopping-street', 50, -20, 0, 0], ['donpen-front', 50, -40, -1.4, 0],
        ['station-plaza', 52, -105, 0, 0.05], ['platform-1', 53, -129, 1.57, 0], ['level-crossing', 80, -128, 0, 0],
        ['shrine', -13, -60, 0, 0], ['pond-bench', -73, -74.8, 3.1, 0.1], ['pond-promenade', -75, -100, 0, 0], ['river-walk', 0, 34, 3.14, -0.1], ['deer-gate', -30, 58, 3.14, 0], ['far-bank', 30, 60, 0, 0.05],
      ];
      for (const [n, x, z, yaw, pitch] of spots) {
        await page.evaluate(([x, z, yaw, pitch]) => { const { player: p, world } = window.__scene; p.pos.set(x, world.heightAt(x, z), z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch; p.applyCamera(0); }, [x, z, yaw, pitch]);
        await wait(1500);
        const info = await page.evaluate(() => { const r = window.__scene.renderer; r.info.autoReset = false; r.info.reset(); return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => { const o = { calls: r.info.render.calls, tris: r.info.render.triangles }; r.info.autoReset = true; res(o); }))); });
        const f = await fps(page, 3000);
        r.spots.push({ n, ...info, fps: f.fps, avgMs: f.avgMs, p95: f.p95, max: f.max, over33: f.over33 });
        console.log(W, n, JSON.stringify(r.spots[r.spots.length - 1]));
      }
      const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
      await cdp.send('HeapProfiler.collectGarbage');
      await wait(1000);
      const m2 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
      r.heapMB = Math.round(m.JSHeapUsedSize / 1048576);
      r.heapAfterGcMB = Math.round(m2.JSHeapUsedSize / 1048576);
      r.perfMemory = await page.evaluate(() => performance.memory ? { usedMB: Math.round(performance.memory.usedJSHeapSize / 1048576), totalMB: Math.round(performance.memory.totalJSHeapSize / 1048576) } : null);
      // the whole renderer's memory (JS heap plus ArrayBuffers, canvases, the geometry kept on the CPU)
      r.uaMemory = await page.evaluate(async () => { try { const m = await performance.measureUserAgentSpecificMemory(); return { MB: Math.round(m.bytes / 1048576) }; } catch (e) { return { error: e.name }; } });
      r.gl = await page.evaluate(() => { const i = window.__scene.renderer.info; return { geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length }; });
      // texture memory estimate: every texture uploaded, width x height x 4 (x 4/3 mipmapped)
      r.texMB = await page.evaluate(() => {
        const seen = new Set(); let bytes = 0; const big = [];
        window.__scene.scene.traverse((o) => { const ms = [o.material].flat().filter(Boolean); for (const m of ms) for (const v of Object.values(m)) if (v && v.isTexture && !seen.has(v)) { seen.add(v); const img = v.image; const w = img?.width ?? 0, h = img?.height ?? 0; const b = w * h * 4 * (v.generateMipmaps ? 4 / 3 : 1); bytes += b; big.push([v.name || img?.constructor?.name || '?', w, h, Math.round(b / 1048576 * 10) / 10]); } });
        big.sort((a, b) => b[3] - a[3]);
        return { total: Math.round(bytes / 1048576), textures: seen.size, largest: big.slice(0, 10) };
      });
    } catch (e) { r.crash = String(e.stack || e).slice(0, 500); } finally { await s.close(); }
    results[`perf-${W}x${H}`] = r;
    save();
  }
}

if (want('leak')) {
  const s = await open({ name: `${name}/leak`, autoplay: false });
  const { page } = s;
  try {
    await page.goto(BASE);
    await page.waitForSelector('.overlay .menu-action', { timeout: 300000 });
    await wait(4000);
    results.leak = {
      globals: await page.evaluate(() => Object.keys(window).filter((k) => k.startsWith('__'))),
      console: s.log.console.map((c) => `${c.type}: ${c.text.slice(0, 200)}`),
      title: await page.title(),
      meta: await page.evaluate(() => [...document.querySelectorAll('meta, link[rel]')].map((m) => m.outerHTML)),
      favicon: await page.evaluate(async () => (await fetch('/favicon.ico')).status),
      robots: await page.evaluate(async () => (await fetch('/robots.txt')).status),
      notFound: await page.evaluate(async () => { const r = await fetch('/some/missing/page'); return { status: r.status, type: r.headers.get('content-type') }; }),
    };
    // the dev keys in a production build
    await page.click('.overlay .menu-action'); await wait(1000);
    await page.keyboard.press('KeyC'); await wait(500);
    results.leak.coordsInProd = await page.evaluate(() => document.querySelector('.coords')?.classList.contains('on'));
    results.leak.coordsShot = await s.shot('prod-C-coordinates');
    await page.keyboard.press('KeyC');
    await page.keyboard.press('KeyG'); await wait(500);
    results.leak.gradeOffShot = await s.shot('prod-G-grade-off');
    await page.keyboard.press('KeyG');
    await page.keyboard.press('Backquote'); await wait(500);
    results.leak.backquote = await page.evaluate(() => document.querySelector('.toast')?.textContent);
    console.log(JSON.stringify(results.leak, null, 1).slice(0, 3000));
  } finally { await s.close(); save(); }
}
