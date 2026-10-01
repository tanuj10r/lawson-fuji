import * as THREE from 'three';
import { PLAYER_VFOV, LAWSON } from '../config.js';
import { CATALOG } from '../data/catalog.js';
import { productGeometry } from '../world/store/products.js';
import { labelAtlas, TAG_TPM } from '../world/store/labels.js';

/* ------------------------------------------------------------------ *
 * Dev tool (never imported by the game; scripts/_store-seen.mjs runs it
 * on a page opened with ?shots&storewhole): what of the konbini is ever
 * seen, and how large.
 *
 * You no longer roam the store: you stand outside, or one of the five
 * visits walks you through it.  So every pose a player can have is known:
 *   visits    the five scenes, stepped at 60 and at 30 frames a second
 *   looking   after you have paid the view is yours again while the walk
 *             carries you out: along that leg, every way you could turn
 *   outside   a grid over the forecourt, the car park, the street and
 *             beyond, up to the glass, turned every way toward the store
 *   famous    the three famous views' own lenses
 * From each, the store is drawn with every stock unit's six sides, every
 * painted quad (signs, price tags) and every solid part in a colour of
 * its own, behind everything opaque in the town (glass, cut-outs and what
 * moves never hide anything: the safe side), at a very wide window
 * (32:9), and what lands on a pixel is seen.  For what is seen, the most
 * screen pixels a metre of it ever covers (at a 2160-line frame, 16:9)
 * against its label's texels a metre says which mipmap is the sharpest
 * ever sampled, by how far the camera is from the glass.
 * ------------------------------------------------------------------ */

const WIDE = 32 / 9, RW = 3584, RH = 1008;
const LINES = 2160;                               // the tallest frame the game draws (post.js: 4.6 M pixels at most)
export const BANDS = [0, 3, 5, 7, 9, 11, 13, 15, 18, 21, 25, 30, 36, Infinity];   // metres from the glass (inside: 0)
const QUAD0 = 100000, SOLID0 = 200000;

export async function runSeen({ log = () => {} } = {}) {
  const { scene, camera, renderer, world, player } = window.__scene;
  const S = window.__store.shop;
  const inside = scene.getObjectByName('lawson-interior');
  const units = inside.userData.units;
  const counts = inside.userData.counts;
  scene.updateMatrixWorld(true);

  /* ---------------- the id scene ---------------- */
  const ids = new THREE.Scene();
  const idMat = (side) => new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false, side });
  const blackMat = (side) => new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, toneMapped: false, side });
  const idMats = new Map(), blacks = new Map();
  const mat = (cache, make, side) => cache.get(side) ?? cache.set(side, make(side)).get(side);
  const enc = (c, v, id) => { c[v * 3] = id & 255; c[v * 3 + 1] = (id >> 8) & 255; c[v * 3 + 2] = (id >> 16) & 255; };
  const centre = new Map();                         // id -> its middle, in the world
  const idMeshes = new Set();
  const addId = (o, fill) => {
    const pos = o.geometry.attributes.position, col = new Uint8Array(pos.count * 3);
    fill(col, pos);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', pos);
    if (o.geometry.index) g.setIndex(o.geometry.index);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    const m = new THREE.Mesh(g, mat(idMats, idMat, o.material.side));
    m.matrixAutoUpdate = false; m.matrix.copy(o.matrixWorld); m.frustumCulled = false;
    ids.add(m);
    idMeshes.add(o);
  };
  const _v = new THREE.Vector3();
  inside.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.ids) {
      // the stock: unit and side for every vertex
      const { unit, cls } = o.userData.ids;
      addId(o, (col) => { for (let v = 0; v < unit.length; v++) enc(col, v, 1 + unit[v] * 6 + cls[v]); });
    } else if (o.userData.quads) {
      addId(o, (col, pos) => o.userData.quads.forEach((q, k) => {
        const c = new THREE.Vector3();
        for (let j = 0; j < 4; j++) { enc(col, k * 4 + j, QUAD0 + q); c.add(_v.fromBufferAttribute(pos, k * 4 + j)); }
        centre.set(QUAD0 + q, c.multiplyScalar(0.25).applyMatrix4(o.matrixWorld));
      }));
    } else if (o.userData.parts) {
      addId(o, (col) => { let v = 0; for (const p of o.userData.parts) for (let j = 0; j < p.verts; j++) enc(col, v++, SOLID0 + p.id); });
    }
  });
  units.forEach((u, k) => {
    const bb = productGeometry(u.id).boundingBox;
    const c = new THREE.Vector3(u.x, u.y + (bb.max.y - bb.min.y) / 2, u.z).applyMatrix4(inside.matrixWorld);
    for (let s = 0; s < 6; s++) centre.set(1 + k * 6 + s, c);
  });
  // what hides: everything opaque and still in the town (not glass, cut-outs, outline hulls, what moves, the hand)
  let hiders = 0;
  scene.traverse((o) => {
    if (!o.isMesh || idMeshes.has(o) || o.isInstancedMesh || o.isSkinnedMesh) return;
    for (let p = o; p; p = p.parent) if (!p.visible || p.userData.dynamic || p.name === 'shop-view' || p.name === 'shop-fx') return;
    const m = [o.material].flat()[0];
    if (!m || m.transparent || m.alphaTest > 0 || m.isShaderMaterial || m.depthWrite === false || m.visible === false || m.opacity < 1) return;
    const c = new THREE.Mesh(o.geometry, mat(blacks, blackMat, m.side));
    c.matrixAutoUpdate = false; c.matrix.copy(o.matrixWorld);
    ids.add(c); hiders++;
  });
  ids.background = new THREE.Color(0x000000);
  log(`id scene: ${units.length} units, ${counts.quads} quads, ${counts.solids} solid parts, ${hiders} hiders`);

  /* ---------------- how fine each label is ---------------- */
  const A = labelAtlas();
  const tpmOf = {};
  for (const p of CATALOG) {
    const g = productGeometry(p.id), P = g.attributes.position.array, U = g.attributes.uv.array;
    const pg = A.pages[A.cellOf[p.id].page], [u0, v0, u1, v1] = A.rect(p.id);
    let min = Infinity;
    for (let t = 0; t < P.length / 9; t++) {
      const a = t * 3, uv = [0, 1, 2].map((j) => [U[(a + j) * 2] * pg.w, U[(a + j) * 2 + 1] * pg.h]);
      if (!uv.every(([x, y]) => x >= u0 * pg.w - 0.5 && x <= u1 * pg.w + 0.5 && y >= v0 * pg.h - 0.5 && y <= v1 * pg.h + 0.5)) continue;
      const p0 = new THREE.Vector3().fromArray(P, a * 3), e1 = new THREE.Vector3().fromArray(P, a * 3 + 3).sub(p0), e2 = new THREE.Vector3().fromArray(P, a * 3 + 6).sub(p0);
      // the triangle in its own plane, and the texels a metre across it the sparse way
      const x1 = e1.length(), ex = e1.clone().divideScalar(x1 || 1), x2 = e2.dot(ex), y2 = e2.clone().addScaledVector(ex, -x2).length();
      if (x1 < 1e-7 || y2 < 1e-7) continue;
      const du1 = uv[1][0] - uv[0][0], dv1 = uv[1][1] - uv[0][1], du2 = uv[2][0] - uv[0][0], dv2 = uv[2][1] - uv[0][1];
      const j11 = du1 / x1, j21 = dv1 / x1, j12 = (du2 - j11 * x2) / y2, j22 = (dv2 - j21 * x2) / y2;
      const a2 = j11 * j11 + j21 * j21, b2 = j12 * j12 + j22 * j22, ab = j11 * j12 + j21 * j22;
      const tr = a2 + b2, det = a2 * b2 - ab * ab;
      const lo = Math.sqrt(Math.max(0, (tr - Math.sqrt(Math.max(0, tr * tr - 4 * det))) / 2));
      if (lo > 1 && lo < min) min = lo;
    }
    tpmOf[p.id] = Number.isFinite(min) ? min : null;      // null: no label on it (its colour is its vertices')
  }

  /* ---------------- the counter ---------------- */
  const rt = new THREE.WebGLRenderTarget(RW, RH, { depthBuffer: true });
  const px = new Uint8Array(RW * RH * 4);
  const NID = SOLID0 + counts.solids + 1;
  const seen = new Uint8Array(NID), stamp = new Int32Array(NID).fill(-1);
  const NB = BANDS.length;                                  // the bands, and one more for the famous views
  const ratio = {};                                         // product -> the most screen pixels a texel ever covers, per band
  for (const p of CATALOG) ratio[p.id] = new Float32Array(NB);
  const tagRatio = {};                                      // product -> the same of its price tag, from anywhere
  const cam = new THREE.PerspectiveCamera(PLAYER_VFOV, WIDE, 0.25, 400);
  cam.matrixAutoUpdate = false;
  const hw = LAWSON.width / 2;
  const bandOf = (x, z) => { const d = z <= 0 && Math.abs(x) <= hw ? 0 : Math.hypot(Math.max(0, Math.abs(x) - hw), Math.max(0, z)); let b = 0; while (BANDS[b + 1] <= d) b++; return b; };
  const view = new THREE.Vector3();
  const list = [];
  let nPose = 0;
  const tagIds = inside.userData.tagQuads;                  // quad id -> true for a price tag
  /** One pose: where the camera is (a world matrix), its lens (null: the play lens, wide), what kind it is. */
  function sample(mw, pm, hero = false) {
    cam.matrix.copy(mw); cam.matrixWorld.copy(mw); cam.matrixWorldInverse.copy(mw).invert();
    if (pm) { cam.projectionMatrix.copy(pm); cam.projectionMatrixInverse.copy(pm).invert(); } else cam.updateProjectionMatrix();
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(ids, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, RW, RH, px);
    const k = nPose++;
    list.length = 0;
    for (let i = 0; i < px.length; i += 4) {
      const id = px[i] | (px[i + 1] << 8) | (px[i + 2] << 16);
      if (id && stamp[id] !== k) { stamp[id] = k; list.push(id); }
    }
    const e = cam.matrixWorld.elements, band = hero ? NB - 1 : bandOf(e[12], e[14]);
    const f = cam.projectionMatrix.elements[5] * LINES / 2, crop = hero ? Infinity : (16 / 9) / WIDE;
    for (const id of list) {
      seen[id] = 1;
      const tag = id >= QUAD0 && id < SOLID0 && tagIds[id - QUAD0];
      if (id >= QUAD0 && !tag) continue;
      const c = centre.get(id);
      view.copy(c).applyMatrix4(cam.matrixWorldInverse);
      const depth = -view.z;
      if (depth < 0.05) continue;
      if (Math.abs(view.x / depth) * cam.projectionMatrix.elements[0] > crop * 1.02) continue;     // outside a 16:9 frame
      const ppm = f * view.length() / (depth * depth);
      if (tag) { const r = ppm / TAG_TPM; if (r > (tagRatio[tag] ?? 0)) tagRatio[tag] = r; continue; }
      const u = units[Math.floor((id - 1) / 6)], t = tpmOf[u.id];
      if (!t) continue;
      const r = ppm / t, R = ratio[u.id];
      if (r > R[band]) R[band] = r;
    }
  }
  const mw = new THREE.Matrix4(), q = new THREE.Quaternion(), eul = new THREE.Euler(0, 0, 0, 'YXZ'), one = new THREE.Vector3(1, 1, 1), at = new THREE.Vector3();
  const pose = (x, y, z, yaw, pitch) => { eul.set(pitch, yaw, 0); sample(mw.compose(at.set(x, y, z), q.setFromEuler(eul), one), null); };

  /* ---------------- 1. the visits, stepped ---------------- */
  const out = { visits: {} };
  const rec = [];
  let recOn = null;
  const update = S.update;
  S.update = (dt, c, bob) => { update(dt, c, bob); if (recOn && dt > 0) { c.updateMatrixWorld(); rec.push({ mw: c.matrixWorld.clone(), leg: S.debug.visit().marks.at(-1)?.[0] ?? '', kind: recOn, paid: S.phase === 'paid' || S.phase === 'eat' }); } };
  const stand = async (z) => window.__shot('k', 640, 360, { png: true, look: 'day', frame: 'world', pos: [-2.3, 0, z], yaw: 0, pitch: 0, shop: 0.2 });
  for (const dt of [1 / 60, 1 / 30]) {
    for (const id of S.menu) {
      await stand(6); await stand(2.3);
      if (!S.play(id)) throw new Error('the visit did not start: ' + id);
      recOn = id;
      const n0 = rec.length;
      let t = 0;
      while (S.visiting && t < 120) { world.update(dt, camera); S.update(dt, camera, 0); t += dt; }
      recOn = null;
      out.visits[id] ??= [];
      out.visits[id].push({ dt: +dt.toFixed(4), secs: +t.toFixed(1), frames: rec.length - n0 });
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  S.update = update;
  await stand(6);
  let last = null, n = 0;
  const visitPoses = [];
  for (const r of rec) {
    const e = r.mw.elements;
    // (a pose a centimetre and a hair's turn from the last adds nothing)
    if (last && Math.hypot(e[12] - last[12], e[13] - last[13], e[14] - last[14]) < 0.03 && Math.abs(e[0] - last[0]) + Math.abs(e[2] - last[2]) + Math.abs(e[5] - last[5]) < 0.012) continue;
    last = e; visitPoses.push(r); n++;
  }
  log(`visits: ${rec.length} frames, ${visitPoses.length} poses`);
  let k = 0;
  for (const r of visitPoses) { sample(r.mw, null); if (++k % 1000 === 0) { log(`  ${k}`); await new Promise((r2) => setTimeout(r2, 0)); } }

  /* ---------------- 2. looking round on the way out (the view is yours once you have paid) ---------------- */
  const free = [];
  for (const r of rec) {
    if (!r.paid) continue;
    const e = r.mw.elements;
    if (e[14] > 3.4) continue;
    if (free.some((p) => Math.hypot(p[0] - e[12], p[2] - e[14]) < 0.22)) continue;
    free.push([e[12], e[13], e[14]]);
  }
  for (const [x, y, z] of free) for (let a = 0; a < 8; a++) for (const pitch of [-1.15, -0.75, -0.4, -0.06, 0.3, 0.7, 1.05]) pose(x, y, z, a * Math.PI / 4, pitch);
  log(`looking round: ${free.length} places, ${free.length * 56} poses`);
  await new Promise((r) => setTimeout(r, 0));

  /* ---------------- 3. outside ---------------- */
  const eye = camera.position.y - player.pos.y + world.heightAt(0, 8);
  const zs = [0.5, 0.62, 0.8, 1.05, 1.4, 1.9, 2.5, 3.2, 4.1, 5.2, 6.5, 8, 9.5, 11, 12.5, 14, 16, 18, 20.5, 23, 26, 30, 35, 41];
  let no = 0;
  for (const z of zs) {
    const step = z < 2 ? 0.4 : z < 5 ? 0.7 : z < 12 ? 1.2 : 2.2;
    const xr = z < 12 ? 16 : 34;
    for (let x = -xr; x <= xr + 1e-6; x += step) {
      const h = world.heightAt(x, z);
      // toward the store's middle, and either way of it; a wide window covers 109 degrees a pose
      const base = Math.atan2(-(0 - x), -(-5 - z));
      for (const dy of [-1.5, -0.75, 0, 0.75, 1.5]) for (const pitch of z < 6 ? [-1.0, -0.55, -0.15, 0.2, 0.6] : [-0.45, -0.1, 0.25]) { pose(x, h + eye, z, base + dy, pitch); no++; }
      if (z > 16) for (const dy of [-0.75, 0, 0.75]) { pose(x, h + eye + 0.25, z, base + dy, -0.1); no++; }
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  // round the sides and the back (walls: nothing of the inside shows, and this proves it)
  for (const [x, z] of [[-10.5, -2], [-10.5, -7], [-10.5, -12], [12.5, -2], [12.5, -7], [12.5, -12], [-5, -15], [0, -15], [5, -15], [-12, -16], [14, -16]]) {
    for (let a = 0; a < 8; a++) for (const pitch of [-0.4, 0, 0.3]) { pose(x, world.heightAt(x, z) + eye, z, a * Math.PI / 4, pitch); no++; }
  }
  log(`outside: ${no} poses`);

  /* ---------------- 4. the famous views ---------------- */
  for (const h of ['morning', 'golden', 'night']) {
    await window.__shot('k', 1280, 360, { png: true, hero: h });
    camera.updateMatrixWorld();
    sample(camera.matrixWorld, camera.projectionMatrix, true);
  }
  renderer.setRenderTarget(null);
  rt.dispose();
  await stand(6);

  /* ---------------- what it comes to ---------------- */
  // a side seen on one unit counts for its neighbours a facing away too (a sliver between two poses is never the difference)
  const cell = 0.14, grid = new Map(), key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  units.forEach((u, i) => { const g = key(u.x, u.y, u.z); (grid.get(g) ?? grid.set(g, []).get(g)).push(i); });
  const near = (u, r, fn) => {
    const n2 = Math.ceil(r / cell);
    const cx = Math.floor(u.x / cell), cy = Math.floor(u.y / cell), cz = Math.floor(u.z / cell);
    for (let a = -n2; a <= n2; a++) for (let b = -n2; b <= n2; b++) for (let c = -n2; c <= n2; c++) for (const j of grid.get(`${cx + a},${cy + b},${cz + c}`) ?? []) {
      const w = units[j];
      if (Math.hypot(w.x - u.x, w.y - u.y, w.z - u.z) <= r) fn(j);
    }
  };
  const raw = units.map((u, i) => { let m = 0; for (let s = 0; s < 6; s++) if (seen[1 + i * 6 + s]) m |= 1 << s; return m; });
  const mask = raw.slice();
  units.forEach((u, i) => { if (raw[i]) near(u, 0.13, (j) => { mask[j] |= raw[i]; }); });
  // the featured things, what stands behind them and round them: whole (they are taken, the next slides forward)
  units.forEach((u, i) => { if (u.feature) near(u, 0.4, (j) => { mask[j] = 63; }); });
  const quadsUnseen = [], solidsUnseen = [];
  for (let i = 0; i < counts.quads; i++) if (!seen[QUAD0 + i]) quadsUnseen.push(i);
  for (let i = 0; i < counts.solids; i++) if (!seen[SOLID0 + i]) solidsUnseen.push(i);
  let tagMax = 0;
  for (const r of Object.values(tagRatio)) if (r > tagMax) tagMax = r;
  Object.assign(out, {
    poses: nPose, counts, catalog: CATALOG.length,
    mask, rawUnseenUnits: raw.filter((m) => !m).length, unseenUnits: mask.filter((m) => !m).length,
    sides: [0, 1, 2, 3, 4, 5].map((s) => [raw.filter((m) => m & (1 << s)).length, mask.filter((m) => m & (1 << s)).length]),
    quadsUnseen, solidsUnseen, tagMax, tag: tagRatio, featured: [...new Set(units.filter((u) => u.feature).map((u) => u.id))],
    tagQuads: Object.keys(tagIds).length,
    ratio: Object.fromEntries(Object.entries(ratio).map(([id, r]) => [id, Array.from(r, (v) => +v.toFixed(4))])),
    tpm: tpmOf,
    pageOf: Object.fromEntries(CATALOG.map((p) => [p.id, A.cellOf[p.id].page])),
  });
  return out;
}
