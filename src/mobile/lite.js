import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MOBILE, TOWN, ANIMALS } from '../config.js';
import { repackStore, pageLevels } from './konbini.js';
import { decalAtlas } from '../world/kit/tex.js';

/* ------------------------------------------------------------------ *
 * What makes the town light enough for a phone (docs/decisions/
 * mobile-lite.md).  The desktop game's builders and look are used as they
 * are; around them:
 *
 *   before the build   liteConfig(): the shared tunables the builders read
 *                      (config.js), turned down: fewer petals, fewer
 *                      distance fields for Hachi.  The desktop never runs it.
 *   after the build    liteScene(): no mirrors (the painted water they
 *                      stand in for stays), textures no bigger than
 *                      MOBILE.maxTexture on the GPU, and the CPU's copies of
 *                      the big static textures and batches freed once they
 *                      are on the GPU
 *   every frame        the culler: static batches past MOBILE.far, and the
 *                      small instanced things past MOBILE.detail, are not
 *                      drawn (the fog has closed in before either)
 * ------------------------------------------------------------------ */

export function liteConfig() {
  // the two petal fields: 150 in the air and 250 falling from the trees on desktop
  TOWN.petals.air = 70;
  TOWN.petals.trees = 110;
  // Hachi's distance fields kept grown at once (2.6 MB each)
  ANIMALS.guide.fields = 3;
  // POCKET: the plain local trains only (the Pokémon wrap's 4096 x 1024 page is 21 MB on the GPU)
  TOWN.rail.trains = TOWN.rail.trains.filter((t) => t !== 'poke');
}

/**
 * After the build: the mirrors off, the texture cap, the CPU copies freed.
 * Returns what it did, for the report.
 */
export function liteScene(scene, renderer, world) {
  // (dev, scripts/_mobile-seen.mjs: ?seen keeps the store's pages as the desktop paints them)
  const raw = import.meta.env?.DEV && /[?&]seen/.test(location.search);
  const store = raw ? null : repackStore(scene);
  const out = { packed: packBatches(scene), store, decals: cropDecals(scene), atlasPages: cropAtlasPages(scene), storeQuads: raw ? 0 : mergeStoreQuads(scene, { pages: store?.pages }), mirrors: 0, freedTextures: 0, freedTextureMB: 0, freedGeometry: 0, freedGeometryMB: 0 };

  /* The mirrors (land/mirror.js: the pond, the river, the paddies) each draw
   * the scene again.  Their own updaters show them near their water: here
   * they are never shown, so the painted water under them always is. */
  scene.traverse((o) => {
    if (!/mirror$/.test(o.name) || !o.isMesh || !o.camera) return;
    out.mirrors++;
    o.getRenderTarget?.()?.dispose();
    o.onBeforeRender = () => {};
    Object.defineProperty(o, 'visible', { get: () => false, set: () => {}, configurable: true });
  });

  /* The inverted-hull outlines (core/outline.js: a second, heavier contour
   * round the hero props) go: the ink pass still draws every line, and at a
   * phone's size the two read as one.  A draw call and the shape again each. */
  const hulls = [];
  scene.traverse((o) => { if (o.isMesh && o.material?.uniforms?.uThickness && o.material.uniforms.uResolution) hulls.push(o); });
  for (const o of hulls) o.parent?.remove(o);
  out.hulls = hulls.length;

  /* One shader program per toon style, not per shadow tint.  core/toon.js
   * puts the tint's hex in each material's program key, but the tint is a
   * uniform (uShadowTint, set per material in onBeforeCompile, which three
   * runs for every material even when it reuses a compiled program): the
   * shaders are the same text.  326 programs became ~half, each one less
   * to compile and to hold on the GPU. */
  const programKeys = new Set();
  scene.traverse((o) => {
    for (const m of [o.material].flat()) {
      if (!m?.customProgramCacheKey || !m.isMeshToonMaterial || m.userData.liteKey) continue;
      const k = m.customProgramCacheKey();
      const g = /^celTint_[0-9a-f]{6}(W?)$/.exec(k);
      if (!g) continue;
      m.userData.liteKey = true;
      m.customProgramCacheKey = () => 'celTint' + g[1];
      programKeys.add(k);
    }
  });
  out.tintKeysShared = programKeys.size;

  /* The store's insides cast no sun shadows: under its roof the sun only
   * reaches them through the glass, and the shadow pass drew every can. */
  scene.getObjectByName('lawson-interior')?.traverse((o) => { if (o.isMesh) o.castShadow = false; });

  /* Textures: the town's and the konbini's pages at the size a phone sees
   * them (shrinkCanvases; town.js already did most of it while building). */
  const real = renderer.capabilities.maxTextureSize;
  renderer.capabilities.maxTextureSize = Math.min(real, MOBILE.storeTexture);
  Object.assign(out, shrinkCanvases(scene, { real }));
  // the light tier keeps every CPU copy: to stream (makeCuller) and to survive a lost context
  if (MOBILE.keepCpu) { world.batching = null; boundsOf(scene); if (import.meta.env?.DEV) window.__lite = out; return out; }

  /* Once uploaded, the small copies made here go too (a phone counts a
   * canvas's backing store against the tab), when one texture uses them: a
   * redraw later (the departure board) puts them back first (see trap). */
  const users = new Map();
  scene.traverse((o) => {
    for (const m of [o.material].flat()) if (m) for (const t of texturesOf(m)) {
      if (!t.source) continue;
      if (!users.has(t.source)) users.set(t.source, new Set());
      users.get(t.source).add(t);
    }
  });
  for (const [src, set] of users) {
    const img = src.data, dims = SMALL.get(img);
    if (set.size !== 1 || !dims || Math.max(dims.w, dims.h) < 256) continue;
    const t = [...set][0];
    if (t.onUpdate) continue;
    const mb = (dims.w * dims.h * 4) / 1048576;
    t.onUpdate = () => {
      t.onUpdate = null;
      t.__w = dims.w; t.__h = dims.h;
      img.width = 1; img.height = 1;
      out.freedTextures++; out.freedTextureMB += mb;
    };
  }

  /* The static batches (merge.js: everything that never moves, baked into
   * world space) keep a CPU copy of every vertex: free it once uploaded.
   * Their bounds are computed first (culling reads them; nothing raycasts
   * them: the player picks hitboxes, the town is walked on colliders). */
  /* The town's batching result holds (in its cullDetail closure's scope)
   * every mesh it merged away, geometry and all: ~90 MB the phone can't
   * spare.  The lite build culls on its own, so the reference goes. */
  world.batching = null;
  boundsOf(scene);
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !(/^merged/.test(o.name) || o.name === 'fuji-dem')) return;
    const g = o.geometry;
    const attrs = [...Object.values(g.attributes), ...(g.index ? [g.index] : [])];
    for (const a of attrs) {
      if (a.__lite) continue;
      a.__lite = true;
      a.onUpload(function () {
        out.freedGeometryMB += this.array.byteLength / 1048576;
        this.array = new this.array.constructor(0);   // (an empty array: count reads stay safe)
      });
    }
    out.freedGeometry++;
  });
  if (import.meta.env?.DEV) window.__lite = out;
  return out;
}

/* ------------------------------------------------------------------ *
 * Painted pages at a phone's size.  Every canvas texture larger than
 * MOBILE.maxTexture (the town) or MOBILE.storeTexture (the konbini, where
 * the labels are read up close) is redrawn into a small canvas, which the
 * texture (and every clone sharing its image) uses instead; the big
 * original is left to be collected.  Called during the build (town.js),
 * as each big part is made, so the big pages never pile up, and again
 * after it.  A texture drawn on later (the departure board, the till's
 * screen) is caught: setting its needsUpdate redraws the original, if it is
 * still alive, into the small copy first.
 * ------------------------------------------------------------------ */
const SMALL = new WeakMap();             // small canvas -> { w, h, from: WeakRef(original) }
export function texturesOf(m) {
  const list = [];
  for (const v of Object.values(m)) if (v?.isTexture) list.push(v);
  if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) list.push(u.value);
  return list;
}
function trap(t) {
  if (Object.getOwnPropertyDescriptor(t, 'needsUpdate')) return;
  Object.defineProperty(t, 'needsUpdate', {
    configurable: true,
    set(v) {
      if (v !== true) return;
      const small = t.source.data, d = SMALL.get(small), from = d?.from.deref();
      if (d && from && from.width > 1) {
        if (small.width !== d.w) { small.width = d.w; small.height = d.h; }
        const c = small.getContext('2d');
        c.clearRect(0, 0, d.w, d.h);
        c.drawImage(from, 0, 0, d.w, d.h);
      }
      t.version++;
      t.source.needsUpdate = true;
    },
  });
}
export function shrinkCanvases(root, { store = false, real = 16384 } = {}) {
  const out = { resized: 0, resizedFromMB: 0, resizedToMB: 0 };
  const inStore = new Set();
  if (!store) root.getObjectByName?.('lawson')?.traverse((o) => inStore.add(o));
  const users = new Map();
  root.traverse((o) => {
    for (const m of [o.material].flat()) if (m) for (const t of texturesOf(m)) {
      if (!t.source) continue;
      if (!users.has(t.source)) users.set(t.source, { set: new Set(), store: false });
      const u = users.get(t.source);
      u.set.add(t);
      if (store || inStore.has(o)) u.store = true;
    }
  });
  for (const [src, u] of users) {
    const img = src.data;
    if (!(img instanceof HTMLCanvasElement) || SMALL.has(img)) continue;
    const limit = Math.min(real, u.store ? MOBILE.storeTexture : MOBILE.maxTexture);
    const side = Math.max(img.width, img.height);
    if (side <= limit) continue;
    const k = limit / side;
    const cv = document.createElement('canvas');
    const w = Math.max(1, Math.floor(img.width * k)), h = Math.max(1, Math.floor(img.height * k));
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, 0, 0, w, h);
    SMALL.set(cv, { w, h, from: new WeakRef(img) });
    src.data = cv;
    for (const t of u.set) { trap(t); t.needsUpdate = true; }
    out.resized++;
    out.resizedFromMB += (img.width * img.height * 4) / 1048576;
    out.resizedToMB += (w * h * 4) / 1048576;
  }
  return out;
}

/**
 * The static batches' vertices in fewer bytes: merge.js bakes every part
 * into float32 position, normal, colour and shadow tint (48 bytes a vertex,
 * unindexed).  A normal needs no more than a byte an axis, a colour or a
 * tint no more than 16 bits: 27 bytes, the same picture.  Before the first
 * upload, so the GPU and the CPU copy both shrink.
 */
export function packBatches(scene) {
  let before = 0, after = 0;
  const pack = (g, name, Type, bytes) => {
    const a = g.attributes[name];
    if (!a || !(a.array instanceof Float32Array) || a.isInterleavedBufferAttribute) return;
    const src = a.array, dst = new Type(src.length), max = Type === Int8Array ? 127 : 65535;
    for (let i = 0; i < src.length; i++) {
      const v = Type === Int8Array ? Math.max(-1, Math.min(1, src[i])) : Math.max(0, Math.min(1, src[i]));
      dst[i] = Math.round(v * max);
    }
    before += src.byteLength; after += dst.byteLength;
    g.setAttribute(name, new THREE.BufferAttribute(dst, a.itemSize, true));
    void bytes;
  };
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !/^merged/.test(o.name) || o.geometry.userData.packed) return;
    const g = o.geometry;
    g.userData.packed = true;
    pack(g, 'normal', Int8Array);
    pack(g, 'color', Uint16Array);
    pack(g, 'aTint', Uint16Array);
  });
  return { beforeMB: +(before / 1048576).toFixed(1), afterMB: +(after / 1048576).toFixed(1) };
}

/** Bounds for every static batch before its arrays can go (culling reads them). */
function boundsOf(scene) {
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !/^merged/.test(o.name)) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
  });
}

/**
 * The konbini's painted quads (store/painter.js: signs, labels, the floor
 * and ceiling, one draw per texture: ~60 draws through the glass) packed
 * onto one page and drawn as one mesh per kind (opaque, cut-out).  Their
 * brightness still follows the look: the merged material shares the
 * originals' colour object, which lawson.js setLook sets in place.
 */
export function mergeStoreQuads(scene, { page = 2048, pages = null } = {}) {
  const inside = scene.getObjectByName('lawson-interior');
  if (!inside) return 0;
  inside.updateMatrixWorld(true);
  const list = [];
  inside.traverse((o) => {
    if (!o.isMesh || o.name !== 'store-quads' || o.isInstancedMesh) return;
    const t = o.material.map, img = t?.image;
    if (!img || !(img.width > 0) || o.material.alphaMap || t.name === 'store-tags') return;     // (the price tags keep their own page: konbini.js)
    const uv = o.geometry.attributes.uv;
    if (!uv) return;
    for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); if (u < -0.001 || u > 1.001 || v < -0.001 || v > 1.001) return; }
    if (t.wrapS !== THREE.ClampToEdgeWrapping || t.wrapT !== THREE.ClampToEdgeWrapping || !t.flipY || t.repeat.x !== 1 || t.repeat.y !== 1 || t.offset.x || t.offset.y) return;
    list.push(o);
  });
  if (list.length < 2) return 0;
  /* each texture once, at its own size (the pocket edition: the old round
   * scaled them all down to fit one 2048 page): shelf packing, tallest
   * first, `page` wide and as tall as it takes */
  const texs = [...new Set(list.map((o) => o.material.map))];
  const PAD = 4;
  const slots = new Map();
  let x = 0, y = 0, shelf = 0;
  for (const t of [...texs].sort((a, b) => b.image.height - a.image.height)) {
    const w = t.image.width, h = t.image.height;
    if (x + w + PAD * 2 > page) { x = 0; y += shelf; shelf = 0; }
    slots.set(t, { x: x + PAD, y: y + PAD, w, h });
    x += w + PAD * 2; shelf = Math.max(shelf, h + PAD * 2);
  }
  const pageH = y + shelf;
  const cv = document.createElement('canvas');
  cv.width = page; cv.height = pageH;
  const c = cv.getContext('2d');
  for (const [t, s] of slots) {
    c.drawImage(t.image, s.x - PAD, s.y - PAD, s.w + PAD * 2, s.h + PAD * 2);   // bleed its own edge into the padding
    c.clearRect(s.x, s.y, s.w, s.h);
    c.drawImage(t.image, s.x, s.y, s.w, s.h);
  }
  const atlas = new THREE.CanvasTexture(cv);
  atlas.colorSpace = list[0].material.map.colorSpace;
  atlas.anisotropy = 8;
  const inv = inside.matrixWorld.clone().invert(), rel = new THREE.Matrix4();
  const groups = new Map();
  for (const o of list) {
    const m = o.material, key = `${m.transparent}|${m.alphaTest}|${m.side}|${m.depthWrite}`;
    if (!groups.has(key)) groups.set(key, { src: m, geos: [], meshes: [] });
    const s = slots.get(m.map);
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'uv') g.deleteAttribute(name);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (s.x + uv.getX(i) * s.w) / page, 1 - (s.y + (1 - uv.getY(i)) * s.h) / pageH);
    g.applyMatrix4(rel.multiplyMatrices(inv, o.matrixWorld));
    groups.get(key).geos.push(g);
    groups.get(key).meshes.push(o);
  }
  let removed = 0;
  const made = [];
  for (const { src, geos, meshes } of groups.values()) {
    const geo = mergeGeometries(geos, false);
    if (!geo) continue;
    const mat = new THREE.MeshBasicMaterial({ map: atlas, transparent: src.transparent, alphaTest: src.alphaTest, side: src.side, depthWrite: src.depthWrite });
    mat.color = src.color;               // the same Color object: setLook brightens it in place
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'store-quads-lite';
    made.push(mat);
    mesh.userData.noOutline = true;
    mesh.castShadow = mesh.receiveShadow = false;
    inside.add(mesh);
    for (const o of meshes) { o.parent.remove(o); removed++; }
  }
  pages?.push(pageLevels(made, atlas, MOBILE.store.quads));      // (konbini.js: smaller copies outside)
  // the pages now in the atlas, where nothing else draws with them: their canvases go
  const still = new Set();
  scene.traverse((o) => { for (const m of [o.material].flat()) if (m?.map) still.add(m.map); });
  for (const t of texs) if (!still.has(t)) { t.dispose(); if ('width' in t.image) { t.image.width = 1; t.image.height = 1; } }
  return removed;
}

/**
 * The town's decal atlas (kit/tex.js: every road marking, lid, crack and
 * petal drift, 8 x 8 cells of 256 px on a 2048 page) has its bottom two rows
 * empty: the page is cropped to the six that are painted, and every decal's
 * v scaled to match.  The same cells at the same size; 21 -> 16 MB.
 */
export function cropDecals(scene, rows = 6) {
  const t = decalAtlas(), img = t.image;
  if (!img || t.userData.cropped) return 0;
  const h = Math.round(img.height * rows / 8), k = img.height / h;
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = h;
  cv.getContext('2d').drawImage(img, 0, 0, img.width, h, 0, 0, img.width, h);
  t.image = cv;
  t.userData.cropped = true;
  t.needsUpdate = true;
  const done = new Set();
  let n = 0;
  scene.traverse((o) => {
    if (!o.isMesh || o.material?.map !== t || done.has(o.geometry)) return;
    done.add(o.geometry);
    const uv = o.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (1 - uv.getY(i)) * k);
    uv.needsUpdate = true;
    n++;
  });
  img.width = img.height = 1;
  return n;
}

/**
 * The town's sign atlas pages (world/merge.js) are always 4096 wide, the
 * last of a set only as tall as what landed on it: packed per region
 * (mobile/town.js), a region's page is often a few hundred texels of one
 * shelf, the rest of its width empty.  Each page is cropped to the width
 * its signs use and the batches' u scaled to match: the same texels, less
 * page.  Returns [before, after] MB.
 */
export function cropAtlasPages(scene) {
  const users = new Map();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) {
      const t = m?.map;
      if (!t) continue;
      if (!users.has(t)) users.set(t, []);
      users.get(t).push(o);
    }
  });
  let from = 0, to = 0;
  for (const [t, list] of users) {
    const img = t.image;
    if (!(img instanceof HTMLCanvasElement) || img.width < 2048 || !list.some((o) => /^merged/.test(o.name))) continue;
    if (list.some((o) => Array.isArray(o.material))) continue;
    const c = img.getContext('2d', { willReadFrequently: true });
    const d = c.getImageData(0, 0, img.width, img.height).data;
    let used = 0;
    for (let y = 0; y < img.height; y++) for (let x = img.width - 1; x > used; x--) if (d[(y * img.width + x) * 4 + 3]) { used = x; break; }
    const w = Math.min(img.width, Math.ceil((used + 9) / 16) * 16);
    if (w > img.width * 0.9) continue;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = img.height;
    cv.getContext('2d').drawImage(img, 0, 0);
    const k = img.width / w;
    const done = new Set();
    for (const o of list) {
      const uv = o.geometry.attributes.uv;
      if (!uv || done.has(uv)) continue;
      done.add(uv);
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * k);
      uv.needsUpdate = true;
    }
    from += img.width * img.height; to += w * img.height;
    t.image = cv;
    t.needsUpdate = true;
    img.width = img.height = 1;
  }
  const MB = (n) => +((n * 4 * 4 / 3) / 1048576).toFixed(1);
  return [MB(from), MB(to)];
}

/**
 * Mt. Fuji at half the grid (a quarter of the triangles): the same
 * vertices, so the snow line, the gullies and the silhouette's shape stay;
 * every other row and column of the elevation grid joins the mesh.
 */
export function liteFuji(mesh) {
  const g = mesh?.geometry;
  if (!g?.index || g.userData.lite) return 0;
  const n = Math.round(Math.sqrt(g.attributes.position.count));
  if (n * n !== g.attributes.position.count) return 0;
  const old = g.index.array, used = new Uint8Array(n * n);
  for (let i = 0; i < old.length; i++) used[old[i]] = 1;
  const idx = [];
  const at = (r, c) => r * n + c;
  for (let r = 0; r + 2 < n; r += 2) {
    for (let c = 0; c + 2 < n; c += 2) {
      const a = at(r, c), b = at(r, c + 2), d = at(r + 2, c), e = at(r + 2, c + 2);
      if (!(used[a] && used[b] && used[d] && used[e])) continue;
      idx.push(a, d, b, b, d, e);
    }
  }
  const before = old.length / 3;
  g.setIndex(idx);
  g.userData.lite = true;
  // static from here: its CPU copy goes once it is on the GPU
  if (!MOBILE.keepCpu) for (const a of [...Object.values(g.attributes), g.index]) a.onUpload(function () { this.array = new this.array.constructor(0); });
  return { before, after: idx.length / 3 };
}

/**
 * Distance culling.  `far`: the static batches (their bounds are in world
 * space); `detail`: small instanced kinds (clutter, weeds, flowers: one
 * draw each, spread town-wide, so they are shown when their nearest
 * instance is within reach) and merge.js's detail cells.
 */
export function makeCuller(scene) {
  const list = [];
  const sphere = new THREE.Sphere(), box = new THREE.Box3();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    // the konbini's goods (hundreds of thousands of vertices) are drawn only from near the store
    const stock = /^stock-page/.test(o.name);
    if (!(o.isMesh || o.isPoints || o.isLine) || (!o.frustumCulled && !stock) || o.userData.shadowOnly) return;
    const own = Object.getOwnPropertyDescriptor(o, 'visible');
    if (own && (own.get || !own.writable)) return;                  // (the mirrors: always off)
    const g = o.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    if (!g.boundingSphere || !Number.isFinite(g.boundingSphere.radius)) return;
    sphere.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
    // spread town-wide (a kind's instances, a moving thing's long reach): always drawn; what never moves is measured by its box instead
    if (sphere.radius > MOBILE.far * 0.6 && (o.matrixAutoUpdate || o.isInstancedMesh)) return;
    /* The game shows and hides things itself (the trees' near and far
     * sets, the painted water under a mirror, the store's goods): `visible`
     * becomes what the game says AND near enough, so neither undoes the other. */
    let mine = o.visible;
    const e = { o, near: true, detail: o.name === 'merged-detail' || (o.isInstancedMesh && sphere.radius < 40), moves: o.matrixAutoUpdate, x: sphere.center.x, z: sphere.center.z, r: sphere.radius, box: null, reach: stock ? 45 : 0 };
    // what never moves is measured by its box (a batch's cell is square: its sphere reaches far past its corners)
    if (!e.moves && !o.isInstancedMesh) {
      if (!g.boundingBox) g.computeBoundingBox();
      if (g.boundingBox && Number.isFinite(g.boundingBox.min.x)) e.box = box.copy(g.boundingBox).applyMatrix4(o.matrixWorld).clone();
    }
    Object.defineProperty(o, 'visible', { get: () => mine && e.near, set: (v) => { mine = v; }, configurable: true });
    list.push(e);
  });
  /* Streaming (MOBILE.stream, the light tier): what lies past far + stream
   * gives its GPU copy back (geometry.dispose(); textures only it uses too),
   * keeping the CPU copy, and three uploads it again when it is drawn next.
   * Only geometry and textures with no other user in the scene take part. */
  const stream = MOBILE.stream > 0 && MOBILE.keepCpu;
  if (stream) {
    const geoUsers = new Map(), texUsers = new Map();
    const texOf = (m) => Object.values(m).filter((v) => v?.isTexture);
    scene.traverse((o) => {
      if (!o.geometry) return;
      geoUsers.set(o.geometry, (geoUsers.get(o.geometry) ?? 0) + 1);
      for (const m of [o.material].flat()) if (m) for (const t of texOf(m)) { if (!texUsers.has(t)) texUsers.set(t, new Set()); texUsers.get(t).add(o); }
    });
    const inList = new Set(list.map((e) => e.o));
    for (const e of list) {
      e.streams = !e.o.isInstancedMesh && geoUsers.get(e.o.geometry) === 1;
      // its textures: those whose every user is streamed
      e.tex = [];
      for (const m of [e.o.material].flat()) if (m) for (const t of texOf(m)) if ([...texUsers.get(t)].every((u) => inList.has(u))) e.tex.push(t);
    }
    // each texture goes when all its users are out, back when one comes in
    for (const e of list) for (const t of e.tex) t.__users = (t.__users ?? 0) + (e.streams ? 1 : 1e9);
    for (const e of list) for (const t of e.tex) t.__in = t.__users;
  }
  let n = 0, out = 0, clock = 0, lastBehind = null;
  const api = {
    list,
    get out() { return out; },
    /** Every few frames: what is near enough to draw. */
    update(cam, every = 3, behind = null) {
      const turned = behind !== lastBehind;              // (into or out of the store: at once, so the store's pages never land on top of the whole town)
      lastBehind = behind;
      if (n++ % every && !turned) return;
      /* `behind` (in the konbini: MOBILE.store.behind, world z): what lies wholly beyond that line is
       * behind the store's back wall and sides, never seen from inside; it is not drawn and streams out */
      const px = cam.x, pz = cam.z;
      const streamNow = stream && (++clock % 10 === 0 || turned);       // (about three times a second)
      for (const e of list) {
        if (e.moves) {
          const bs = e.o.geometry.boundingSphere;
          sphere.copy(bs).applyMatrix4(e.o.matrixWorld);
          e.x = sphere.center.x; e.z = sphere.center.z;
        }
        const d = e.box
          ? Math.hypot(Math.max(e.box.min.x - px, 0, px - e.box.max.x), Math.max(e.box.min.z - pz, 0, pz - e.box.max.z))
          : Math.hypot(e.x - px, e.z - pz) - e.r;
        const hidden = behind !== null && (e.box ? e.box.max.z : e.z + e.r) < behind;
        e.near = !hidden && d < (e.detail ? MOBILE.detail : MOBILE.far);
        if (!streamNow || !e.streams) continue;
        // small props (the detail cells) stream just past where they stop being drawn
        const far = hidden ? -1e9 : e.reach || (e.detail ? MOBILE.detail + 16 : MOBILE.far + MOBILE.stream);
        if (!e.gone && d > far) {
          e.gone = true; out++;
          e.o.geometry.dispose();
          for (const t of e.tex) if (--t.__in <= 0) t.dispose();
        } else if (e.gone && d < far - 10) {
          e.gone = false; out--;
          for (const t of e.tex) t.__in++;          // (three uploads it when it is drawn)
        }
      }
    },
  };
  return api;
}

/** Dev: what the scene costs (textures, geometry), for the report. */
export function census(scene, renderer) {
  const texs = new Map();
  let geoBytes = 0;
  const geos = new Set();
  scene.traverse((o) => {
    const g = o.geometry;
    if (g && !geos.has(g)) {
      geos.add(g);
      for (const a of Object.values(g.attributes)) geoBytes += a.array?.byteLength ?? 0;
      if (g.index) geoBytes += g.index.array?.byteLength ?? 0;
    }
    for (const m of [o.material].flat()) {
      if (!m) continue;
      for (const v of Object.values(m)) if (v?.isTexture) texs.set(v.source?.uuid ?? v.uuid, v);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) texs.set(u.value.source?.uuid ?? u.value.uuid, u.value);
    }
  });
  const cap = renderer.capabilities.maxTextureSize;
  let gpu = 0;
  for (const t of texs.values()) {
    let w = t.image?.width ?? 0, h = t.image?.height ?? 0;
    if (t.__w) { w = t.__w; h = t.__h; }
    const k = Math.min(1, cap / Math.max(w, h, 1));
    gpu += Math.floor(w * k) * Math.floor(h * k) * 4 * (t.generateMipmaps ? 4 / 3 : 1);
  }
  return { textures: texs.size, textureMB: Math.round(gpu / 1048576), geometryCpuMB: Math.round(geoBytes / 1048576), info: renderer.info.memory };
}
