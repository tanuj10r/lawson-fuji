// dev helper (the phone build): what of the konbini is ever seen, and how big, written to src/mobile/konbini-seen.js.
//
//   node scripts/_mobile-seen.mjs [dev server, default http://localhost:5198]
//
// Needs a running dev server (npm run dev -- --port 5198).  Loads the phone page (?seen: the store's
// painted pages as the desktop builds them), plays the five konbini visits and records the camera every
// frame, adds the famous views and a grid of poses outside up to the glass (you can walk up to it), then
// renders the store with every product unit, price tag and painted quad in its own id colour and keeps,
// for each, the widest and tallest it was ever drawn at the phone build's most (1704 x 786).  lite.js repackStore
// sizes each product's label and each price tag from this (docs/decisions/mobile-lite.md).
//
// One browser at a time: waits on /tmp/lawson-browser.lock, and removes it and closes Chrome however it ends.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const base = process.argv[2] ?? 'http://localhost:5198';
const LOCK = '/tmp/lawson-browser.lock';
for (;;) { try { fs.mkdirSync(LOCK); break; } catch { console.log('  waiting for the browser lock'); await new Promise((r) => setTimeout(r, 10000)); } }
const unlock = () => { try { fs.rmdirSync(LOCK); } catch {} };
let browser;
const close = async () => { try { await Promise.race([browser?.close(), new Promise((r) => setTimeout(r, 8000))]); } catch {} unlock(); };
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await close(); process.exit(130); });

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  await page.goto(`${base}/m.html?tier=full&seen`);
  await page.waitForFunction(() => document.getElementById('boot')?.classList.contains('ready') && window.__m, null, { polling: 500 });
  await page.evaluate(() => document.getElementById('boot').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(800);

  // 1. the visits, the camera every frame
  await page.evaluate(() => {
    const m = window.__m;
    window.__poses = [];
    window.__rec = (kind) => { m.camera.updateMatrixWorld(); window.__poses.push({ kind, mw: m.camera.matrixWorld.toArray(), pm: m.camera.projectionMatrix.toArray() }); };
    let on = null;
    const tick = () => { if (on) window.__rec(on); requestAnimationFrame(tick); };
    tick();
    window.__recOn = (k) => { on = k; };
  });
  const menu = await page.evaluate(() => window.__m.world.lawson.shop.menu);
  for (const id of menu) {
    await page.evaluate(() => { const p = window.__m.player; p.pos.set(-2.3, 0, 5); p.yaw = 0; p.pitch = 0; p.applyCamera(0); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { const p = window.__m.player; p.pos.set(-2.3, 0, 2.3); p.applyCamera(0); });
    await page.waitForTimeout(600);
    const ok = await page.evaluate((id) => { window.__recOn('visit:' + id); return window.__m.world.lawson.shop.play(id); }, id);
    if (!ok) throw new Error(`the visit for ${id} did not start`);
    await page.waitForFunction(() => !window.__m.world.lawson.shop.visiting, null, { timeout: 90000, polling: 200 });
    await page.evaluate(() => window.__recOn(null));
    console.log(`  ${id}: ${await page.evaluate(() => window.__poses.length)} poses so far`);
  }
  // 2. outside: the famous views, and anywhere in front of the store up to the glass
  const { MOBILE } = await import(path.join(ROOT, 'src/config.js'));
  await page.evaluate((near) => { window.__near = near; }, MOBILE.store.near);
  await page.evaluate(() => {
    const m = window.__m, pl = m.player;
    for (const h of ['golden', 'morning', 'night']) { m.enterHero(h); window.__rec('hero'); }
    /* outside: 'outside' within MOBILE.store.near of the store's middle, 'outside-far' beyond (the pages'
     * near and far levels switch there, konbini.js) */
    const c = new m.THREE.Box3().setFromObject(m.scene.getObjectByName('lawson-interior')).getCenter(new m.THREE.Vector3());
    const rec = (x, z) => window.__rec(Math.hypot(x - c.x, z - c.z) < window.__near ? 'outside' : 'outside-far');
    for (let x = -10; x <= 12; x += 1.5) for (const z of [0.45, 1.2, 2.5, 5, 9, 13]) for (let yaw = -1.2; yaw <= 1.21; yaw += 0.3) for (const pitch of [-0.35, -0.1, 0.15]) {
      pl.pos.set(x, 0, z); pl.yaw = yaw; pl.pitch = pitch; pl.applyCamera(0); rec(x, z);
    }
    // and the approach: the car park, the road, the famous views' ground
    for (let x = -26; x <= 28; x += 3) for (let z = 15; z <= 33; z += 3) for (let yaw = -1.2; yaw <= 1.21; yaw += 0.4) for (const pitch of [-0.12, 0.1]) {
      pl.pos.set(x, 0, z); pl.yaw = yaw; pl.pitch = pitch; pl.applyCamera(0); rec(x, z);
    }
  });

  // 3. the id pass
  const res = await page.evaluate(async () => {
    const { scene, renderer, THREE, culler, camera } = window.__m;
    const { tagAtlas, cellRect, WHITE } = await import('/src/world/store/labels.js');
    const { CATALOG } = await import('/src/data/catalog.js');
    const { quadPages } = await import('/src/mobile/konbini.js');
    const pageKey = quadPages(scene.getObjectByName('lawson-interior'));
    const tags = tagAtlas();
    culler.update = () => {};
    for (const e of culler.list) e.near = true;
    const root = scene.getObjectByName('lawson'), inside = scene.getObjectByName('lawson-interior');
    const units = inside.userData.units;
    root.updateMatrixWorld(true);
    const idMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, toneMapped: false });
    const black = new THREE.MeshBasicMaterial({ color: 0, side: THREE.DoubleSide, fog: false });
    const enc = (id, arr, k) => { arr[k] = id & 255; arr[k + 1] = (id >> 8) & 255; arr[k + 2] = (id >> 16) & 255; };
    // ids: 1.. units; 100000 + i tag quads; 200000 + quad meshes (by mesh)
    const swaps = [], tagOf = [], quadMesh = [];
    root.traverse((o) => {
      swaps.push({ o, mat: o.material, geo: o.geometry, vis: o.visible });
      if (!o.isMesh) { if (o.isLine || o.isPoints || o.isSprite) o.visible = false; return; }
      const mat = [o.material].flat()[0];
      const idGeo = (fill) => {
        const pos = o.geometry.attributes.position, c = new Uint8Array(pos.count * 3);
        fill(c);
        const g = new THREE.BufferGeometry(); g.setAttribute('position', pos); if (o.geometry.index) g.setIndex(o.geometry.index);
        g.setAttribute('color', new THREE.BufferAttribute(c, 3, true));
        o.geometry = g; o.material = idMat;
      };
      if (/^stock-page/.test(o.name)) {
        idGeo((c) => units.forEach((u, k) => { if (u.mat === mat) for (let i = 0; i < u.n; i++) enc(k + 1, c, (u.start + i) * 3); }));
      } else if (mat?.map === tags.tex) {
        const uv = o.geometry.attributes.uv;
        idGeo((c) => {
          for (let i = 0; i < uv.count; i += 4) {
            let u = 0, v = 0;
            for (let k = 0; k < 4; k++) { u += uv.getX(i + k) / 4; v += uv.getY(i + k) / 4; }
            const cell = Math.floor(u * 8) + 8 * Math.floor((1 - v) * Math.ceil(CATALOG.length / 8));
            const q = tagOf.length; tagOf.push(CATALOG[cell]?.id ?? null);
            for (let k = 0; k < 4; k++) enc(100000 + q, c, (i + k) * 3);
          }
        });
      } else if (/quads/.test(o.name) && mat?.map) {
        // each painted quad on its own: its texture's key and the part of the texture it shows
        const uv = o.geometry.attributes.uv, key = pageKey.get(mat.map);
        if (!key) { o.material = black; return; }
        idGeo((c) => {
          for (let i = 0; i + 3 < uv.count; i += 4) {
            let u0 = 1, u1 = 0, v0 = 1, v1 = 0;
            for (let k = 0; k < 4; k++) { u0 = Math.min(u0, uv.getX(i + k)); u1 = Math.max(u1, uv.getX(i + k)); v0 = Math.min(v0, uv.getY(i + k)); v1 = Math.max(v1, uv.getY(i + k)); }
            const q = quadMesh.length;
            quadMesh.push({ key, w: (u1 - u0) * mat.map.image.width, h: (v1 - v0) * mat.map.image.height });
            for (let k = 0; k < 4; k++) enc(200000 + q, c, (i + k) * 3);
          }
        });
      } else if ((mat?.transparent && !(mat.alphaTest > 0)) || o.name === 'shop-view') o.visible = false;
      else o.material = black;
    });
    /* Rendered at 1278 x 590 (half the phone's 2556 x 1179); sizes are counted at the most the phone build
     * ever draws, twice the CSS size (MOBILE.render.scale 2: 1704 x 786), so extents x 4/3. */
    const W = 1278, H = 590, K = 4, X = 1704 / 1278;
    const rt = new THREE.WebGLRenderTarget(W, H);
    const px = new Uint8Array(W * H * 4);
    const seen = new Map();                               // id -> the widest and tallest it was ever seen, px at 1704 x 786
    const seenBy = {};                                    // the same, per kind of pose (each visit, outside, hero)
    const cam = camera.clone();
    cam.matrixAutoUpdate = false;
    const poses = window.__poses;
    for (let p = 0; p < poses.length; p++) {
      const P = poses[p];
      if (P.kind.startsWith('visit') && p % 3) continue;          // every third frame of a visit
      cam.matrixWorld.fromArray(P.mw); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
      cam.projectionMatrix.fromArray(P.pm); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear();
      renderer.render(root, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
      const box = new Map();
      for (let i = 0, j = 0; i < px.length; i += 4, j++) {
        const id = px[i] | (px[i + 1] << 8) | (px[i + 2] << 16);
        if (!id) continue;
        const x = j % W, y = (j / W) | 0;
        let b = box.get(id);
        if (!b) box.set(id, (b = [x, x, y, y, 0]));
        if (x < b[0]) b[0] = x; if (x > b[1]) b[1] = x; if (y < b[2]) b[2] = y; if (y > b[3]) b[3] = y; b[4]++;
      }
      for (const [id, b] of box) {
        if (b[4] * K <= 16) continue;                     // a few stray pixels at an edge are not a sighting
        for (const map of [seen, (seenBy[P.kind] ??= new Map())]) {
          const s = map.get(id) ?? [0, 0];
          s[0] = Math.max(s[0], (b[1] - b[0] + 1) * X); s[1] = Math.max(s[1], (b[3] - b[2] + 1) * X);
          map.set(id, s);
        }
      }
    }
    renderer.setRenderTarget(null);
    for (const r of swaps) { r.o.material = r.mat; r.o.geometry = r.geo; r.o.visible = r.vis; }
    const { productGeometry } = await import('/src/world/store/products.js');
    /* a wrap (bottles, cans, cups) shows half its label's width at a time: it needs twice what is seen across */
    const wraps = (id) => {
      const g = productGeometry(id), uv = g.attributes.uv, nz = g.attributes.normal;
      const Wr = cellRect(WHITE), u0 = Wr[0] + 0.5 * (Wr[2] - Wr[0]), v0 = Wr[1] + 0.5 * (Wr[3] - Wr[1]);
      for (let i = 0; i < uv.count; i++) if (nz.getZ(i) < -0.35 && Math.abs(nz.getY(i)) < 0.6 && (Math.abs(uv.getX(i) - u0) > 1e-5 || Math.abs(uv.getY(i) - v0) > 1e-5)) return true;
      return false;
    };
    const labels = {}, tagPx = {}, wrapOf = {};
    units.forEach((u, k) => {
      const s = seen.get(k + 1);
      wrapOf[u.id] ??= wraps(u.id);
      const need = s ? Math.max(s[0] * (wrapOf[u.id] ? 2 : 1), s[1]) : 0;
      labels[u.id] = Math.max(labels[u.id] ?? 0, need);
    });
    tagOf.forEach((id, q) => { if (!id) return; const s = seen.get(100000 + q); tagPx[id] = Math.max(tagPx[id] ?? 0, s ? s[0] : 0); });
    // a painted quad's page: the most of its texels any sighting needs, as a share of its size
    const quads = {};
    quadMesh.forEach((Q, q) => {
      const s = seen.get(200000 + q);
      const need = s ? Math.max(s[0] / Math.max(1, Q.w), s[1] / Math.max(1, Q.h)) : 0;
      quads[Q.key] = Math.max(quads[Q.key] ?? 0, need);
    });
    // per kind of pose: each product's label need, each tag's, each quad page's share
    const by = {};
    for (const [kind, map] of Object.entries(seenBy)) {
      const L = {}, Tg = {}, Q = {};
      units.forEach((u, k) => { const s = map.get(k + 1); if (s) L[u.id] = Math.max(L[u.id] ?? 0, Math.max(s[0] * (wrapOf[u.id] ? 2 : 1), s[1])); });
      tagOf.forEach((id, q) => { const s = id && map.get(100000 + q); if (s) Tg[id] = Math.max(Tg[id] ?? 0, s[0]); });
      quadMesh.forEach((Qm, q) => { const s = map.get(200000 + q); if (s) Q[Qm.key] = Math.max(Q[Qm.key] ?? 0, Math.max(s[0] / Math.max(1, Qm.w), s[1] / Math.max(1, Qm.h))); });
      by[kind] = { labels: L, tags: Tg, quads: Q };
    }
    return { labels, tags: tagPx, quads, by, poses: poses.length, units: units.length, tagQuads: tagOf.length };
  });
  /* A unit's label covers its front (or its wrap): ~its seen size on screen.  The cell it needs is that,
   * with a margin, rounded up to a step; mipmapping means a bigger cell would never be sampled. */
  const STEPS = [8, 16, 24, 32, 48, 64, 96, 128, 192];
  const cell = (s, top) => { if (!s) return STEPS[0]; const t = s * 1.05; return STEPS.find((l) => l >= t) ?? top; };
  const labels = Object.fromEntries(Object.entries(res.labels).map(([id, s]) => [id, Math.min(192, cell(s, 192))]).sort());
  for (const id of menu) labels[id] = 192;                  // what the visits hand you: always the whole cell
  // a tag is 256 x 96: its widest sighting, with the margin
  const tagSteps = [32, 64, 128, 256];
  const tagsOut = Object.fromEntries(Object.entries(res.tags).map(([id, s]) => {
    const w = s * 1.05;
    return [id, s ? tagSteps.find((l) => l >= w) ?? 256 : 16];
  }).sort());
  // a quad page's share, with the margin, as a power of two (1, 1/2, 1/4 ...)
  const share = (v) => (v ? Math.min(1, 2 ** Math.ceil(Math.log2(v * 1.05))) : 0.125);
  const quadsOut = Object.fromEntries(Object.entries(res.quads).map(([k, v]) => [k, share(v)]).sort());
  /* the levels (konbini.js): each visit; near (every pose outside); far (the famous views, and the poses
   * outside beyond MOBILE.store.near) */
  const merge = (...kinds) => {
    const o = { labels: {}, tags: {}, quads: {} };
    for (const kd of kinds) for (const part of ['labels', 'tags', 'quads']) for (const [id, v] of Object.entries(res.by[kd]?.[part] ?? {})) o[part][id] = Math.max(o[part][id] ?? 0, v);
    return o;
  };
  const levels = { near: merge('outside', 'outside-far'), far: merge('hero', 'outside-far') };
  for (const kd of Object.keys(res.by)) if (kd.startsWith('visit:')) levels[kd] = merge(kd);
  const LV = { labels: {}, tags: {}, quads: {} };
  for (const [lv, o] of Object.entries(levels)) {
    LV.labels[lv] = Object.fromEntries(Object.entries(o.labels).filter(([, v]) => v).map(([id, v]) => [id, cell(v, 192)]).sort());
    LV.tags[lv] = Object.fromEntries(Object.entries(o.tags).filter(([, v]) => v).map(([id, v]) => [id, tagSteps.find((l) => l >= v * 1.05) ?? 256]).sort());
    LV.quads[lv] = Object.fromEntries(Object.entries(o.quads).filter(([, v]) => v).map(([k, v]) => [k, share(v)]).sort());
  }
  const file = path.join(ROOT, 'src/mobile/konbini-seen.js');
  fs.writeFileSync(file, `/* Generated by scripts/_mobile-seen.mjs (${res.poses} poses: the five konbini visits, the famous views,
 * the forecourt up to the glass).  The size, in texels, each product's label cell and each price tag
 * needs on a phone: the most it is ever seen at on an iPhone 15 in landscape, at the most the
 * build renders (2x the CSS size, 1704 x 786), with a margin.  A product
 * missing here keeps the desktop's cell (lite.js repackStore). */
export const LABEL_PX = ${JSON.stringify(labels)};
export const TAG_PX = ${JSON.stringify(tagsOut)};
/* The store's painted quads (signs, POP, posters): each page's share of its size that is ever needed,
 * by the page's key (konbini.js quadPages). */
export const QUAD_K = ${JSON.stringify(quadsOut)};
/* The same per level of the pages (konbini.js levelPage): each visit's poses, 'near' (outside), 'far'
 * (the famous views and outside beyond MOBILE.store.near).  What a level never saw is not listed. */
export const LABEL_LV = ${JSON.stringify(LV.labels)};
export const TAG_LV = ${JSON.stringify(LV.tags)};
export const QUAD_LV = ${JSON.stringify(LV.quads)};
`);
  if (process.env.SEEN_SPLIT) fs.writeFileSync(process.env.SEEN_SPLIT, JSON.stringify(res.by));
  const hist = (o) => Object.values(o).reduce((h, v) => ((h[v] = (h[v] ?? 0) + 1), h), {});
  console.log('labels', hist(labels), '\ntags', hist(tagsOut), '\nquads', hist(quadsOut), `\n${res.units} units, ${res.tagQuads} tags; wrote ${path.relative(ROOT, file)}`);
} finally {
  await close();
}
