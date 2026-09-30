import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MOBILE, TOWN, ANIMALS } from '../config.js';

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
}

/**
 * After the build: the mirrors off, the texture cap, the CPU copies freed.
 * Returns what it did, for the report.
 */
export function liteScene(scene, renderer, world) {
  const out = { storeQuads: mergeStoreQuads(scene), mirrors: 0, freedTextures: 0, freedTextureMB: 0, freedGeometry: 0, freedGeometryMB: 0 };

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

  /* The store's insides cast no sun shadows: under its roof the sun only
   * reaches them through the glass, and the shadow pass drew every can. */
  scene.getObjectByName('lawson-interior')?.traverse((o) => { if (o.isMesh) o.castShadow = false; });

  /* Textures, painted for a desktop at up to 4096 px a side, are made the
   * size a phone sees them at: MOBILE.maxTexture (1024) for the town,
   * MOBILE.storeTexture (2048) for the konbini, where you stand a metre
   * from the labels.  Each image is redrawn smaller before it is uploaded
   * (the big canvas is let go), once per image, so every texture sharing it
   * shares the small one; three's own cap catches anything made later. */
  const users = new Map();
  const texOf = (m) => {
    const list = [];
    for (const v of Object.values(m)) if (v?.isTexture) list.push(v);
    if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) list.push(u.value);
    return list;
  };
  const store = new Set();
  scene.getObjectByName('lawson')?.traverse((o) => store.add(o));
  scene.traverse((o) => {
    for (const m of [o.material].flat()) {
      if (!m) continue;
      for (const t of texOf(m)) {
        if (!t.source) continue;
        if (!users.has(t.source)) users.set(t.source, { set: new Set(), store: false });
        const u = users.get(t.source);
        u.set.add(t);
        if (store.has(o)) u.store = true;
      }
    }
  });
  const real = renderer.capabilities.maxTextureSize;
  renderer.capabilities.maxTextureSize = Math.min(real, MOBILE.storeTexture);
  out.resized = 0; out.resizedFromMB = 0; out.resizedToMB = 0;
  for (const [src, u] of users) {
    const img = src.data;
    if (!(img instanceof HTMLCanvasElement)) continue;
    const limit = Math.min(real, u.store ? MOBILE.storeTexture : MOBILE.maxTexture);
    const side = Math.max(img.width, img.height);
    if (side <= limit) continue;
    const k = limit / side;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.floor(img.width * k)); cv.height = Math.max(1, Math.floor(img.height * k));
    const c = cv.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, 0, 0, cv.width, cv.height);
    src.data = cv;
    for (const t of u.set) t.needsUpdate = true;
    out.resized++;
    out.resizedFromMB += (img.width * img.height * 4) / 1048576;
    out.resizedToMB += (cv.width * cv.height * 4) / 1048576;
  }

  /* Once uploaded, the big static canvases go too (a phone counts a
   * canvas's backing store against the tab): only an image with one texture
   * (no clone would upload it again later), 512 px or more, and not drawn
   * on while the game runs (the till's screen, the departure board and the
   * train's destination sign are small and stay). */
  for (const [src, u] of users) {
    if (u.set.size !== 1) continue;
    const t = [...u.set][0];
    const img = src.data;
    if (!(img instanceof HTMLCanvasElement) || Math.max(img.width, img.height) < 512 || t.onUpdate) continue;
    const mb = (img.width * img.height * 4) / 1048576;
    t.onUpdate = () => {
      t.onUpdate = null;
      // later needsUpdate calls (none expected) would upload a 1x1: the page's colour
      t.__w = img.width; t.__h = img.height;
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
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !(/^merged/.test(o.name) || o.name === 'fuji-dem')) return;
    const g = o.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    if (!g.boundingBox) g.computeBoundingBox();
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

/**
 * The konbini's painted quads (store/painter.js: signs, labels, the floor
 * and ceiling, one draw per texture: ~60 draws through the glass) packed
 * onto one page and drawn as one mesh per kind (opaque, cut-out).  Their
 * brightness still follows the look: the merged material shares the
 * originals' colour object, which lawson.js setLook sets in place.
 */
export function mergeStoreQuads(scene, { page = 2048 } = {}) {
  const inside = scene.getObjectByName('lawson-interior');
  if (!inside) return 0;
  inside.updateMatrixWorld(true);
  const list = [];
  inside.traverse((o) => {
    if (!o.isMesh || o.name !== 'store-quads' || o.isInstancedMesh) return;
    const t = o.material.map, img = t?.image;
    if (!img || !(img.width > 0) || o.material.alphaMap) return;
    const uv = o.geometry.attributes.uv;
    if (!uv) return;
    for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); if (u < -0.001 || u > 1.001 || v < -0.001 || v > 1.001) return; }
    if (t.wrapS !== THREE.ClampToEdgeWrapping || t.wrapT !== THREE.ClampToEdgeWrapping || !t.flipY || t.repeat.x !== 1 || t.repeat.y !== 1 || t.offset.x || t.offset.y) return;
    list.push(o);
  });
  if (list.length < 2) return 0;
  // each texture once, scaled so the lot fits one page: shelf packing, tallest first
  const texs = [...new Set(list.map((o) => o.material.map))];
  const area = texs.reduce((s, t) => s + t.image.width * t.image.height, 0);
  let k = Math.min(1, Math.sqrt((page * page * 0.8) / area));
  const PAD = 4;
  let slots;
  for (let tries = 0; tries < 8; tries++, k *= 0.9) {
    slots = new Map();
    let x = 0, y = 0, shelf = 0, ok = true;
    for (const t of [...texs].sort((a, b) => b.image.height - a.image.height)) {
      const w = Math.max(4, Math.round(t.image.width * k)), h = Math.max(4, Math.round(t.image.height * k));
      if (x + w + PAD * 2 > page) { x = 0; y += shelf; shelf = 0; }
      if (y + h + PAD * 2 > page) { ok = false; break; }
      slots.set(t, { x: x + PAD, y: y + PAD, w, h });
      x += w + PAD * 2; shelf = Math.max(shelf, h + PAD * 2);
    }
    if (ok) break;
    slots = null;
  }
  if (!slots) return 0;
  const cv = document.createElement('canvas');
  cv.width = cv.height = page;
  const c = cv.getContext('2d');
  for (const [t, s] of slots) {
    c.drawImage(t.image, s.x - PAD, s.y - PAD, s.w + PAD * 2, s.h + PAD * 2);   // bleed its own edge into the padding
    c.clearRect(s.x, s.y, s.w, s.h);
    c.drawImage(t.image, s.x, s.y, s.w, s.h);
  }
  const atlas = new THREE.CanvasTexture(cv);
  atlas.colorSpace = list[0].material.map.colorSpace;
  atlas.anisotropy = 4;
  const inv = inside.matrixWorld.clone().invert(), rel = new THREE.Matrix4();
  const groups = new Map();
  for (const o of list) {
    const m = o.material, key = `${m.transparent}|${m.alphaTest}|${m.side}|${m.depthWrite}`;
    if (!groups.has(key)) groups.set(key, { src: m, geos: [], meshes: [] });
    const s = slots.get(m.map);
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'uv') g.deleteAttribute(name);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (s.x + uv.getX(i) * s.w) / page, 1 - (s.y + (1 - uv.getY(i)) * s.h) / page);
    g.applyMatrix4(rel.multiplyMatrices(inv, o.matrixWorld));
    groups.get(key).geos.push(g);
    groups.get(key).meshes.push(o);
  }
  let removed = 0;
  for (const { src, geos, meshes } of groups.values()) {
    const geo = mergeGeometries(geos, false);
    if (!geo) continue;
    const mat = new THREE.MeshBasicMaterial({ map: atlas, transparent: src.transparent, alphaTest: src.alphaTest, side: src.side, depthWrite: src.depthWrite });
    mat.color = src.color;               // the same Color object: setLook brightens it in place
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'store-quads-lite';
    mesh.userData.noOutline = true;
    mesh.castShadow = mesh.receiveShadow = false;
    inside.add(mesh);
    for (const o of meshes) { o.parent.remove(o); removed++; }
  }
  return removed;
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
  for (const a of [...Object.values(g.attributes), g.index]) a.onUpload(function () { this.array = new this.array.constructor(0); });
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
    if (!(o.isMesh || o.isPoints || o.isLine) || !o.frustumCulled || o.userData.shadowOnly) return;
    const own = Object.getOwnPropertyDescriptor(o, 'visible');
    if (own && (own.get || !own.writable)) return;                  // (the mirrors: always off)
    const g = o.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    if (!g.boundingSphere || !Number.isFinite(g.boundingSphere.radius)) return;
    sphere.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
    if (sphere.radius > MOBILE.far * 0.6) return;                    // spread town-wide (a kind's instances): always drawn
    /* The game shows and hides things itself (the trees' near and far
     * sets, the painted water under a mirror, the store's goods): `visible`
     * becomes what the game says AND near enough, so neither undoes the other. */
    let mine = o.visible;
    const e = { o, near: true, detail: o.name === 'merged-detail' || (o.isInstancedMesh && sphere.radius < 40), moves: o.matrixAutoUpdate, x: sphere.center.x, z: sphere.center.z, r: sphere.radius, box: null };
    // what never moves is measured by its box (a batch's cell is square: its sphere reaches far past its corners)
    if (!e.moves && !o.isInstancedMesh) {
      if (!g.boundingBox) g.computeBoundingBox();
      if (g.boundingBox && Number.isFinite(g.boundingBox.min.x)) e.box = box.copy(g.boundingBox).applyMatrix4(o.matrixWorld).clone();
    }
    Object.defineProperty(o, 'visible', { get: () => mine && e.near, set: (v) => { mine = v; }, configurable: true });
    list.push(e);
  });
  let n = 0;
  return {
    list,
    /** Every few frames: what is near enough to draw. */
    update(cam, every = 3) {
      if (n++ % every) return;
      const px = cam.x, pz = cam.z;
      for (const e of list) {
        if (e.moves) {
          const bs = e.o.geometry.boundingSphere;
          sphere.copy(bs).applyMatrix4(e.o.matrixWorld);
          e.x = sphere.center.x; e.z = sphere.center.z;
        }
        const d = e.box
          ? Math.hypot(Math.max(e.box.min.x - px, 0, px - e.box.max.x), Math.max(e.box.min.z - pz, 0, pz - e.box.max.z))
          : Math.hypot(e.x - px, e.z - pz) - e.r;
        e.near = d < (e.detail ? MOBILE.detail : MOBILE.far);
      }
    },
  };
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
