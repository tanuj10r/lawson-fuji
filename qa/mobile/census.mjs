/* Scene census for the mobile study (read-only; nothing in the game changes).
 *
 *   node qa/mobile/census.mjs [--url http://127.0.0.1:5181/]
 *
 * Needs a dev server (window.__shot and ?shots are dev-only).  One headless
 * Chrome (Metal), closed on exit.  Writes qa/mobile/artifacts/census.json.
 *
 *  - every texture the scene references: size, type, estimated GPU bytes
 *    (w*h*bytes/px, x4/3 with mips), largest first; render targets too
 *  - geometry: unique BufferGeometry bytes (the GPU copy, and the CPU copy
 *    three.js keeps)
 *  - lights by type, instanced meshes, visible meshes
 *  - draw calls / triangles (all passes and main pass) at the busiest views,
 *    at a phone-landscape render size and at 1440p
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const BASE = arg('url', 'http://127.0.0.1:5181/');
const OUT = new URL('./artifacts/census.json', import.meta.url).pathname;

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const bail = async (c = 1) => { await browser.close().catch(() => {}); process.exit(c); };
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => bail(130));
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(180000);
  await page.goto(BASE + '?shots', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000, polling: 500 });

  const census = await page.evaluate(() => {
    const { scene, renderer, pipeline, THREE } = window.__scene;
    const gl = renderer.getContext();
    const texs = new Map();
    const bpp = (t) => {
      const type = t.type, fmt = t.format;
      const ch = fmt === THREE.RedFormat ? 1 : fmt === THREE.RGFormat ? 2 : fmt === THREE.RGBFormat ? 3 : 4;
      const b = type === THREE.FloatType ? 4 : type === THREE.HalfFloatType ? 2 : 1;
      return ch * b;
    };
    const addTex = (t, where) => {
      if (!t || !t.isTexture) return;
      const img = t.image;
      const w = img?.width ?? img?.videoWidth ?? 0, h = img?.height ?? 0;
      const key = t.source?.uuid ?? t.uuid;
      const e = texs.get(key) ?? { name: t.name || '', w, h, kind: t.isCanvasTexture ? 'canvas' : t.isDataTexture ? 'data' : (img?.constructor?.name ?? '?'), bpp: bpp(t), mips: t.generateMipmaps && t.minFilter !== THREE.LinearFilter && t.minFilter !== THREE.NearestFilter, users: new Set() };
      e.users.add(where);
      texs.set(key, e);
    };
    const geos = new Map();
    let meshes = 0, visibleMeshes = 0, inst = 0, instances = 0, tris = 0;
    const lights = {};
    const mats = new Set();
    scene.traverse((o) => {
      if (o.isLight) lights[o.type] = (lights[o.type] ?? 0) + 1;
      if (!o.isMesh && !o.isPoints && !o.isLine) return;
      meshes++;
      if (o.visible) visibleMeshes++;
      if (o.isInstancedMesh) { inst++; instances += o.count; }
      const g = o.geometry;
      if (g && !geos.has(g.uuid)) {
        let bytes = 0;
        for (const a of Object.values(g.attributes)) bytes += a.array?.byteLength ?? 0;
        if (g.index) bytes += g.index.array.byteLength;
        geos.set(g.uuid, bytes);
      }
      let a = o; while (a.parent && !a.name) a = a.parent;
      for (const m of [o.material].flat()) {
        if (!m) continue;
        mats.add(m.uuid);
        for (const v of Object.values(m)) if (v && v.isTexture) addTex(v, a.name || o.name || 'anon');
        if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) addTex(u.value, a.name || o.name || 'anon');
      }
    });
    const rows = [...texs.values()].map((e) => {
      const bytes = e.w * e.h * e.bpp * (e.mips ? 4 / 3 : 1);
      return { name: e.name, w: e.w, h: e.h, kind: e.kind, mb: +(bytes / 1048576).toFixed(1), users: [...e.users].slice(0, 3).join(', ') + (e.users.size > 3 ? ` +${e.users.size - 3}` : '') };
    }).sort((a, b) => b.mb - a.mb);
    const texMB = rows.reduce((s, r) => s + r.mb, 0);
    // render targets: the pipeline's three, the shadow map
    const s = pipeline.size;
    const rt = { pipeline: `${s.x}x${s.y}`, pipelineMB: +((s.x * s.y * (8 + 4 + 8 + 4)) / 1048576).toFixed(1), shadowMB: 2048 * 2048 * 4 / 1048576 };
    const geoMB = [...geos.values()].reduce((a, b) => a + b, 0) / 1048576;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '?',
      webgl2: gl instanceof WebGL2RenderingContext,
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      info: renderer.info.memory,
      programs: renderer.info.programs?.length,
      heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
      meshes, visibleMeshes, instancedMeshes: inst, instances, materials: mats.size, lights,
      textures: rows.length, textureMB: +texMB.toFixed(0), rt,
      geometries: geos.size, geometryMB: +geoMB.toFixed(0),
      top: rows.slice(0, 25),
    };
  });

  /* the busiest views (config SHOT_SPOTS names): the famous view, the shopping
   * street, inside the konbini, the paddies from the lane end (a known worst,
   * with a mirror) and the train at the platform */
  const views = [
    ['famous view (hero-1)', { hero: 'morning', look: 'day' }],
    ['shopping street (town-spine-north)', { look: 'day', pos: [-46.2, 0, 23.5], yaw: 3.1416, pitch: 0.03 }],
    ['inside the konbini (store-aisle)', { look: 'day', pos: [-2.1, 0, -3.0], yaw: 0, pitch: -0.12, frame: 'world' }],
    ['paddies, lane end (paddy-lane)', { look: 'golden', pos: [49, 0, 45], yaw: -1.5708, pitch: -0.04 }],
    ['train at platform (train-at-platform)', { look: 'day', pos: [-28, 0, 166.8], yaw: 1.2, pitch: 0.03, train: 'platform' }],
  ];
  const sizes = [['phone landscape 844x390 @ scale 2', 844, 390, 2], ['1440p @ scale 1.5', 2560, 1440, 1.5]];
  const frames = [];
  for (const [name, o] of views) {
    for (const [label, W, H, scale] of sizes) {
      const r = await page.evaluate(([W, H, o]) => window.__shot('census', W, H, { ...o, returnData: false, png: false, time: 20 }), [W, H, { ...o, scale }]);
      frames.push({ view: name, size: label, calls: r.calls, mainCalls: r.mainCalls, tris: r.triangles, mainTris: r.mainTriangles, ms: +r.ms.toFixed(2), internal: r.internal });
      console.log(`${name.padEnd(40)} ${label.padEnd(34)} calls ${r.calls} (main ${r.mainCalls})  tris ${(r.triangles / 1e6).toFixed(2)} M (main ${(r.mainTriangles / 1e6).toFixed(2)} M)  ${r.ms.toFixed(2)} ms  internal ${r.internal}`);
    }
  }
  census.frames = frames;
  census.heapAfterMB = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
  fs.writeFileSync(OUT, JSON.stringify(census, null, 1));
  console.log(JSON.stringify({ ...census, top: undefined, frames: undefined }, null, 1));
  console.log('top textures:');
  for (const t of census.top) console.log(`  ${String(t.mb).padStart(6)} MB  ${t.w}x${t.h}  ${t.kind}  ${t.name}  [${t.users}]`);
} catch (e) {
  console.error(e);
  await bail(1);
}
await browser.close();
