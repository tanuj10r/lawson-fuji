// dev helper: what the konbini costs, and whether a change to it can be seen.
//
//   node scripts/_store-lean.mjs measure [out.json]     texture / geometry MB, triangles, draw calls, frame ms, heap
//   node scripts/_store-lean.mjs frames <dir>           lossless frames: the famous views, the forecourt, the door,
//                                                        and along all five visits (the same moments every run)
//   node scripts/_store-lean.mjs compare <dirA> <dirB>  pixel differences between two `frames` runs (masks into dirB/diff)
//
// Its own dev server (PORT, default 5184) and one headless Chrome, on /tmp/lawson-browser.lock; both are
// closed however it ends.  Add `whole` after the mode to build the store whole (?storewhole: nothing pruned).
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = process.env.STORE_ROOT ? path.resolve(process.env.STORE_ROOT) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');   // (STORE_ROOT: another checkout, to compare against)
const [mode, ...rest] = process.argv.slice(2);
const WHOLE = rest.includes('whole');
const argv = rest.filter((a) => a !== 'whole');
const PORT = +process.env.PORT || 5184;
const VISITS = ['onigiri_tuna', 'sando_egg', 'fruit_sando', 'strong_nine', 'choco_wafer_jumbo'];

const LOCK = '/tmp/lawson-browser.lock';
for (;;) { try { fs.mkdirSync(LOCK); break; } catch { console.log('  waiting for the browser lock'); await new Promise((r) => setTimeout(r, 10000)); } }
let server, browser;
const done = async () => {
  await Promise.race([Promise.all([browser?.close(), server?.close()]), new Promise((r) => setTimeout(r, 8000))]).catch(() => {});
  try { fs.rmdirSync(LOCK); } catch {}
};
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await done(); process.exit(130); });

/* Where the frames are taken outside (store frame = world): the forecourt, the glass, the door's spot. */
const SPOTS = {
  'hero-morning': { hero: 'morning', look: 'day' },
  'hero-golden': { hero: 'golden', look: 'golden' },
  'hero-night': { hero: 'night', look: 'blue' },
  'street': { pos: [3, 0, 14], yaw: 0.15, pitch: 0.02, look: 'day' },
  'forecourt': { pos: [0, 0, 8], yaw: 0, pitch: 0, look: 'day' },
  'forecourt-left': { pos: [-7, 0, 5], yaw: -0.55, pitch: -0.05, look: 'day' },
  'forecourt-night': { pos: [4, 0, 6], yaw: 0.4, pitch: -0.02, look: 'blue' },
  'glass-right': { pos: [3, 0, 0.9], yaw: 0.25, pitch: -0.12, look: 'day' },
  'glass-left': { pos: [-6, 0, 0.9], yaw: -0.5, pitch: -0.2, look: 'day' },
  'door': { pos: [-2.3, 0, 2.3], yaw: 0, pitch: 0, look: 'day' },
};

try {
  server = await createServer({ root: ROOT, logLevel: 'error', server: { port: PORT, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.setDefaultNavigationTimeout(180000);
  page.setDefaultTimeout(600000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|ERR_/.test(m.text())) errs.push(m.text()); });
  const open = async () => {
    await page.goto(`http://127.0.0.1:${PORT}/?shots${WHOLE ? '&storewhole' : ''}`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000, polling: 250 });
    await page.evaluate((VISITS) => {
      window.__VISITS = VISITS;
      const S = window.__store.shop;
      S.flash = () => {};
      /** Stand at the spot and start the visit for `id`. */
      window.__begin = async (id) => {
        await window.__shot('k', 640, 360, { png: true, look: 'day', frame: 'world', pos: [-2.3, 0, 5], yaw: 0, pitch: 0, shop: 0.1 });
        await window.__shot('k', 640, 360, { png: true, look: 'day', frame: 'world', pos: [-2.3, 0, 2.3], yaw: 0, pitch: 0, shop: 0.3 });
        return S.play(id);
      };
      /** `secs` of the visit pass (60 steps a second, the world stepped with it); a small frame keeps it quick. */
      window.__pass = (secs) => window.__shot('k', 640, 360, { png: true, look: 'day', frame: 'world', stepWorld: true, shop: secs });
    }, VISITS);
  };

  if (mode === 'measure') {
    await open();
    const cdp = await page.context().newCDPSession(page);
    const res = await page.evaluate(async () => {
      const { scene, renderer } = window.__scene, S = window.__store.shop;
      const MB = (n) => +(n / 1048576).toFixed(1);
      /* what the store holds: its textures as the GPU stores them (RGBA8, a third more with mipmaps), its
       * vertex data, its triangles */
      const tally = (roots, top = 6) => {
        const tex = new Map(), geo = new Set();
        let tris = 0, meshes = 0;
        for (const root of roots) root?.traverse((o) => {
          if (!o.isMesh && !o.isPoints && !o.isLine && !o.isSprite) return;
          for (const m of [o.material].flat()) {
            if (!m) continue;
            for (const k of ['map', 'alphaMap', 'emissiveMap', 'gradientMap', 'normalMap']) {
              const t = m[k], img = t?.image;
              if (!t || !img || tex.has(t)) continue;
              const [w, h] = t.userData?.size ?? [img.width ?? img.videoWidth ?? 0, img.height ?? img.videoHeight ?? 0];   // (size: a page whose canvas was given back, store/pages.js)
              const mips = t.generateMipmaps && t.minFilter !== 1003 && t.minFilter !== 1006;
              tex.set(t, { name: `${o.name || o.parent?.name || '?'} ${w}x${h}`, bytes: w * h * 4 * (mips ? 4 / 3 : 1), canvas: img instanceof HTMLCanvasElement ? img.width * img.height * 4 : 0 });
            }
          }
          if (o.geometry && !geo.has(o.geometry)) geo.add(o.geometry);
          if (o.isMesh && o.geometry) { meshes++; const g = o.geometry; tris += ((g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3) * (o.isInstancedMesh ? o.count : 1); }
        });
        let gb = 0, cpu = 0;
        const seenArr = new Set();
        for (const g of geo) for (const a of [...Object.values(g.attributes), g.index].filter(Boolean)) {
          const src = a.isInterleavedBufferAttribute ? a.data : a;
          if (seenArr.has(src)) continue;
          seenArr.add(src);
          const n = src.bytes ?? src.array.byteLength;                 // (bytes: an array let go once uploaded, store/products.js)
          gb += n;
          cpu += src.array?.byteLength ?? 0;
        }
        const list = [...tex.values()].sort((a, b) => b.bytes - a.bytes);
        return {
          textureMB: MB(list.reduce((s, t) => s + t.bytes, 0)), textures: list.length,
          canvasMB: MB(list.reduce((s, t) => s + t.canvas, 0)),
          geometryMB: MB(gb), geometryCpuMB: MB(cpu), triangles: Math.round(tris), meshes,
          top: list.slice(0, top).map((t) => `${t.name} ${MB(t.bytes)} MB`),
        };
      };
      const store = () => tally([scene.getObjectByName('lawson'), S.view, S.fx]);
      const frame = async (o, secs = 0) => {
        const r = await window.__shot('m', 2560, 1440, { look: 'day', frame: 'world', ...o, returnData: false, png: false, scale: 1.5, time: 20, shop: secs });
        return { calls: r.mainCalls, allCalls: r.calls, tris: Math.round(r.mainTriangles / 1000) + 'k', ms: +r.ms.toFixed(2) };
      };
      const out = { at: {}, visits: {} };
      out.at.hero = await frame({ hero: 'golden', look: 'golden' });
      out.storeAtHero = store();
      out.sceneAtHero = tally([scene], 10);
      out.at.street = await frame({ pos: [3, 0, 14], yaw: 0.15, pitch: 0.02 });
      out.at.door = await frame({ pos: [-2.3, 0, 2.3], yaw: 0, pitch: 0 }, 0.3);
      out.storeAtDoor = store();
      for (const id of window.__VISITS) {
        if (!(await window.__begin(id))) { out.visits[id] = 'did not start'; continue; }
        const rows = [];
        let t = 0, peak = null;
        while (S.visiting && t < 90) {
          await window.__pass(1); t += 1;
          if (S.phase === 'eat') continue;
          const r = await frame({ stepWorld: true });
          rows.push(r);
          const st = store();
          if (!peak || st.textureMB > peak.textureMB) peak = st;
        }
        const avg = (k) => +(rows.reduce((s, r) => s + r[k], 0) / rows.length).toFixed(2);
        out.visits[id] = { secs: t, frames: rows.length, calls: [Math.min(...rows.map((r) => r.calls)), Math.round(avg('calls')), Math.max(...rows.map((r) => r.calls))], ms: [Math.min(...rows.map((r) => r.ms)), avg('ms'), Math.max(...rows.map((r) => r.ms))], trisMax: Math.max(...rows.map((r) => parseInt(r.tris))) + 'k', storePeak: { textureMB: peak.textureMB, canvasMB: peak.canvasMB, geometryMB: peak.geometryMB } };
        await window.__shot('k', 640, 360, { png: true, look: 'day', frame: 'world', pos: [-2.3, 0, 6], yaw: 0, pitch: 0, shop: 0.3 });
      }
      // back on the famous view: what stays once you have walked away
      await window.__shot('k', 640, 360, { png: true, hero: 'golden', look: 'golden', shop: 2, stepWorld: true });
      out.at.heroAfter = await frame({ hero: 'golden', look: 'golden' }, 1);
      out.storeAfter = store();
      out.sceneAfter = tally([scene], 10);
      out.gl = { textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries };
      return out;
    });
    await cdp.send('HeapProfiler.collectGarbage');
    res.heapMB = await page.evaluate(() => +(performance.memory.usedJSHeapSize / 1048576).toFixed(0));
    // the heap straight after a fresh start, before anything is played
    await open();
    await page.waitForTimeout(1500);
    await cdp.send('HeapProfiler.collectGarbage');
    res.heapAtStartMB = await page.evaluate(() => +(performance.memory.usedJSHeapSize / 1048576).toFixed(0));
    const text = JSON.stringify(res, null, 1);
    console.log(text);
    if (argv[0]) fs.writeFileSync(path.resolve(argv[0]), text);
  } else if (mode === 'frames') {
    const out = path.resolve(argv[0] ?? path.join(ROOT, '.shots', 'store-lean'));
    fs.mkdirSync(out, { recursive: true });
    await open();
    const save = (name, data) => { fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(data.split(',')[1], 'base64')); };
    // the petals in the air fall where chance puts them: out of the frames, so two runs compare
    await page.evaluate(() => window.__scene.scene.traverse((o) => { if (o.isInstancedMesh && o.instanceMatrix.usage === window.__scene.THREE.DynamicDrawUsage) o.visible = false; }));
    const W = 1920, H = 1080, O = { png: true, returnData: true, scale: 1.5, frame: 'world' };
    for (const [name, o] of Object.entries(SPOTS)) {
      const r = await page.evaluate(([W, H, o]) => window.__shot('f', W, H, o), [W, H, { ...O, ...o, shop: 0.3 }]);
      save(name, r.data);
    }
    for (const id of VISITS) {
      if (!(await page.evaluate((id) => window.__begin(id), id))) { console.log('FAIL', id, 'did not start'); continue; }
      let n = 0;
      for (let t = 0; t < 90; t += 1.5) {
        const st = await page.evaluate(async () => { await window.__pass(1.5); const S = window.__store.shop; return { on: S.visiting, phase: S.phase }; });
        if (!st.on) break;
        const r = await page.evaluate(([W, H, o]) => window.__shot('f', W, H, o), [W, H, { ...O, look: 'day', stepWorld: true }]);
        save(`${id}-${String(++n).padStart(2, '0')}-${st.phase}`, r.data);
      }
      await page.evaluate(() => window.__shot('k', 640, 360, { png: true, look: 'day', frame: 'world', pos: [-2.3, 0, 6], yaw: 0, pitch: 0, shop: 0.3 }));
      console.log(`  ${id}: ${n} frames`);
    }
    console.log('frames in', out);
  } else if (mode === 'approach') {
    // the real loop (not the frozen shots mode): walk from the street to the door and back, and watch the
    // painted pages come and go (store/pages.js) and what the longest frame was while they did
    await page.goto(`http://127.0.0.1:${PORT}/`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000, polling: 250 });
    const log = await page.evaluate(async () => {
      const { player, camera } = window.__scene;
      const { storePages } = await import('/src/world/store/pages.js');
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = [];
      const state = () => storePages.map((p) => `${p.name}:${p.level}${p.busy ? '*' : ''}`).join(' ');
      let worst = 0, last = performance.now(), on = true;
      const tick = () => { const t = performance.now(); worst = Math.max(worst, t - last); last = t; if (on) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      const walk = async (z0, z1, secs, label) => {
        const t0 = performance.now(); worst = 0; last = t0;
        let near = null, s0 = state();
        for (;;) {
          const k = Math.min(1, (performance.now() - t0) / (secs * 1000));
          player.pos.set(-2.3, 0, z0 + (z1 - z0) * k); player.yaw = 0; player.pitch = 0; player.applyCamera(0);
          await wait(16);
          const s = state();
          if (s !== s0) { out.push(`  ${label} z ${camera.position.z.toFixed(1)}: ${s}`); s0 = s; }
          if (k >= 1) break;
        }
        await wait(600);
        out.push(`${label}: ${state()}  (longest frame ${worst.toFixed(0)} ms)`);
        void near;
      };
      await wait(1500);
      out.push('start: ' + state());
      await walk(30, 2.5, 7, 'walking up (4 m/s)');
      await walk(2.5, 30, 7, 'walking away');
      await walk(30, 2.5, 3, 'running up (9 m/s)');
      on = false;
      return out;
    });
    console.log(log.join('\n'));
  } else if (mode === 'compare') {
    const [A, B] = argv.map((d) => path.resolve(d));
    const dd = path.join(B, 'diff');
    fs.mkdirSync(dd, { recursive: true });
    await page.goto(`http://127.0.0.1:${PORT}/404.html`);
    const names = fs.readdirSync(A).filter((f) => f.endsWith('.png'));
    let same = 0, worst = [];
    for (const f of names) {
      if (!fs.existsSync(path.join(B, f))) { console.log(`  ${f}: missing in B`); continue; }
      const url = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
      const r = await page.evaluate(async ([a, b]) => {
        const load = async (src) => { const i = new Image(); i.src = src; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0); return { c, x, d: x.getImageData(0, 0, c.width, c.height) }; };
        const [pa, pb] = await Promise.all([load(a), load(b)]);
        if (pa.c.width !== pb.c.width || pa.c.height !== pb.c.height) return { size: true };
        const A = pa.d.data, B = pb.d.data, out = pa.x.createImageData(pa.c.width, pa.c.height), O = out.data;
        let n = 0, n8 = 0, max = 0;
        for (let i = 0; i < A.length; i += 4) {
          const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
          if (d > 0) n++;
          if (d > 8) n8++;
          if (d > max) max = d;
          const g = (A[i] + A[i + 1] + A[i + 2]) / 9;
          if (d > 8) { O[i] = 255; O[i + 1] = 0; O[i + 2] = 255; } else if (d > 0) { O[i] = 255; O[i + 1] = 200; O[i + 2] = 0; } else { O[i] = O[i + 1] = O[i + 2] = g; }
          O[i + 3] = 255;
        }
        pa.x.putImageData(out, 0, 0);
        return { n, n8, max, total: A.length / 4, mask: n ? pa.c.toDataURL('image/png') : null };
      }, [url(path.join(A, f)), url(path.join(B, f))]);
      if (r.size) { console.log(`  ${f}: sizes differ`); continue; }
      if (!r.n) { same++; continue; }
      fs.writeFileSync(path.join(dd, f), Buffer.from(r.mask.split(',')[1], 'base64'));
      worst.push([f, r.n, r.n8, r.max, (100 * r.n / r.total)]);
    }
    worst.sort((a, b) => b[2] - a[2] || b[1] - a[1]);
    console.log(`${names.length} frames: ${same} identical, ${worst.length} differ`);
    for (const [f, n, n8, max, pct] of worst) console.log(`  ${f.padEnd(44)} ${String(n).padStart(8)} px differ (${pct.toFixed(3)}%), ${String(n8).padStart(7)} by more than 8/255, most ${max}`);
    if (worst.length) console.log('masks in', dd);
  } else {
    console.log('usage: node scripts/_store-lean.mjs measure|frames|compare ...');
  }
  if (errs.length) { console.log('page errors:'); for (const e of errs.slice(0, 10)) console.log('  ', e); process.exitCode = 1; }
} finally {
  await done();
}
