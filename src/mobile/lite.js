import * as THREE from 'three';
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
  const out = { mirrors: 0, freedTextures: 0, freedTextureMB: 0, freedGeometry: 0, freedGeometryMB: 0 };

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

  /* Textures: three downsizes any image larger than capabilities.maxTextureSize as it uploads it,
   * keeping its shape, so capping that caps every painted page (a 4096 atlas becomes 1024). */
  const real = renderer.capabilities.maxTextureSize;
  renderer.capabilities.maxTextureSize = Math.min(real, MOBILE.maxTexture);

  /* The big static canvases are dropped once uploaded: a phone counts a
   * canvas's backing store against the tab.  Only a texture that is the one
   * user of its image (no clone would upload it again later), 512 px or more,
   * and not drawn on while the game runs (the till's screen, the departure
   * board and the train's destination sign are small and stay). */
  const users = new Map();
  const texOf = (m) => {
    const list = [];
    for (const v of Object.values(m)) if (v?.isTexture) list.push(v);
    if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) list.push(u.value);
    return list;
  };
  scene.traverse((o) => {
    for (const m of [o.material].flat()) {
      if (!m) continue;
      for (const t of texOf(m)) {
        const key = t.source ?? t;
        if (!users.has(key)) users.set(key, new Set());
        users.get(key).add(t);
      }
    }
  });
  for (const [src, set] of users) {
    if (set.size !== 1) continue;
    const t = [...set][0];
    const img = t.image;
    if (!(img instanceof HTMLCanvasElement) || Math.max(img.width, img.height) < 512) continue;
    if (t.onUpdate) continue;
    const mb = (img.width * img.height * 4) / 1048576;
    t.onUpdate = () => {
      t.onUpdate = null;
      // later needsUpdate calls (none expected) would upload a 1x1: the page's colour
      t.__w = img.width; t.__h = img.height;
      img.width = 1; img.height = 1;
      out.freedTextures++; out.freedTextureMB += mb;
    };
    void src;
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
 * Distance culling.  `far`: the static batches (their bounds are in world
 * space); `detail`: small instanced kinds (clutter, weeds, flowers: one
 * draw each, spread town-wide, so they are shown when their nearest
 * instance is within reach) and merge.js's detail cells.
 */
export function makeCuller(scene) {
  const list = [];
  const sphere = new THREE.Sphere();
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
    const e = { o, near: true, detail: o.name === 'merged-detail' || (o.isInstancedMesh && sphere.radius < 40), moves: o.matrixAutoUpdate, x: sphere.center.x, z: sphere.center.z, r: sphere.radius };
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
        e.near = Math.hypot(e.x - px, e.z - pz) - e.r < (e.detail ? MOBILE.detail : MOBILE.far);
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
