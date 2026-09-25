import * as THREE from 'three';
import { PAL } from '../../core/palette.js';
import { cel } from '../../core/toon.js';
import { rngKit, bake, trs } from '../../core/util.js';
import { LAYER } from './decals.js';

/* ------------------------------------------------------------------ *
 * The town's sakura (SPEC section 3, trees; M2d).
 *
 * The library's cherry (trees.js buildSakura) stays as it is for M2's
 * north side, which frames the famous views.  The town's trees are fuller:
 *
 *   limbs     4-6 main limbs, each forking again, the dark wood showing
 *             through the blossom at the tips and underneath
 *   blossom   many overlapping clusters of small blobs, the outer ones
 *             drooping, three tones by height (light on top, deep below)
 *   hero      a few big trees (scale 1.5-2) at the plaza, the shrine, the
 *             park and the spine's end
 *   ground    petal drifts in a ring under every tree
 *
 * Every tree in the town is built in one call: one wood mesh, three
 * instanced blossom draws.  Generators queue their trees in ctx.sakura.
 * ------------------------------------------------------------------ */

const TONES = [PAL.blossomLight, PAL.blossom, PAL.blossomDeep];
const TINTS = [0xe2c3d2, 0xd8b2c6, 0xc99cba];

export function buildTownSakura(ctx, spots, { decals } = {}) {
  if (!spots.length) return null;
  const wood = [];
  const blobs = [[], [], []];
  const trunkGeo = new THREE.CylinderGeometry(0.7, 1.0, 1, 8, 1);
  const limbGeo = new THREE.CylinderGeometry(0.3, 0.6, 1, 6, 1);
  const twigGeo = new THREE.CylinderGeometry(0.14, 0.32, 1, 5, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const emitters = [];

  /** A tapered piece of wood from a to b, radius r at its base. */
  const branch = (geo, a, b, r) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize());
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    wood.push({ geometry: geo, matrix: new THREE.Matrix4().compose(mid, q, new THREE.Vector3(r, len, r)) });
  };

  for (const spot of spots) {
    const r = rngKit(spot.seed ?? 1);
    const S = spot.scale ?? 1;
    const base = new THREE.Vector3(spot.x, spot.y ?? 0, spot.z);
    const hero = S >= 1.4;

    // trunk: two lengths with a slight kink, flared at the foot
    // big trees spread more than they grow: the trunk scales slower than the crown
    const trunkH = 2.1 * Math.pow(S, 0.6) * r.range(0.9, 1.1);
    const lean = new THREE.Vector3(r.range(-0.25, 0.25), 0, r.range(-0.25, 0.25)).multiplyScalar(S);
    const knee = base.clone().add(new THREE.Vector3(lean.x * 0.4, trunkH * 0.55, lean.z * 0.4));
    const top = base.clone().add(new THREE.Vector3(lean.x, trunkH, lean.z));
    branch(trunkGeo, base, knee, 0.24 * S);
    branch(trunkGeo, knee, top, 0.2 * S);
    wood.push({ geometry: trunkGeo, matrix: trs(base.x, base.y + 0.15 * S, base.z, 0, 0, 0, 0.34 * S, 0.3 * S, 0.34 * S) });

    // limbs, each forking; cluster centres at the ends and along the way
    const centres = [];
    const limbs = r.int(4, hero ? 7 : 5);
    for (let i = 0; i < limbs; i++) {
      const a = (i / limbs) * Math.PI * 2 + r.range(-0.35, 0.35);
      const tilt = r.range(0.85, 1.25);                    // from vertical: an umbrella, not a vase
      const len = 2.3 * S * r.range(0.85, 1.2);
      const end = top.clone().add(new THREE.Vector3(Math.cos(a) * Math.sin(tilt) * len, Math.cos(tilt) * len, Math.sin(a) * Math.sin(tilt) * len));
      branch(limbGeo, top, end, 0.12 * S);
      centres.push({ p: end, w: 1 });
      centres.push({ p: top.clone().lerp(end, 0.55).add(new THREE.Vector3(0, 0.5 * S, 0)), w: 0.6 });
      for (let k = 0; k < 2; k++) {
        const b = r.range(-0.9, 0.9);
        const l2 = len * r.range(0.45, 0.75);
        const d2 = new THREE.Vector3(Math.cos(a + b) * 0.8, r.range(0.05, 0.5), Math.sin(a + b) * 0.8).normalize();
        const e2 = end.clone().addScaledVector(d2, l2);
        branch(twigGeo, end, e2, 0.08 * S);
        centres.push({ p: e2, w: 1 });
      }
    }

    // blossom: clusters round every centre; outer ones droop; tone by height
    // many small blobs, not a few big ones: that is what reads as blossom
    const perTree = Math.round((hero ? 150 : 85) * Math.min(1.3, S) * r.range(0.9, 1.1));
    let yMin = Infinity, yMax = -Infinity;
    for (const c of centres) { yMin = Math.min(yMin, c.p.y); yMax = Math.max(yMax, c.p.y); }
    const reach = centres.reduce((m, c) => Math.max(m, Math.hypot(c.p.x - top.x, c.p.z - top.z)), 0.1);
    for (let i = 0; i < perTree; i++) {
      const c = centres[Math.floor(r.next() * centres.length)].p;
      const rad = 0.5 * Math.sqrt(S) * r.range(0.7, 1.25);
      const px = c.x + r.range(-1.1, 1.1) * S;
      const pz = c.z + r.range(-1.1, 1.1) * S;
      // the further out, the more it hangs: the drooping edge of a full cherry
      const out = Math.hypot(px - top.x, pz - top.z) / reach;
      const py = c.y + r.range(-0.55, 0.75) * S - Math.max(0, out - 0.7) * 1.3 * S;
      const hi = (py - yMin) / Math.max(0.5, yMax + S - yMin);
      let tone = hi > 0.6 ? 0 : hi < 0.25 ? 2 : 1;
      if (r.next() < 0.2) tone = (tone + 1) % 3;
      blobs[tone].push({ m: trs(px, py, pz, r.range(0, 3), r.range(0, 3), r.range(0, 3), rad, rad * r.range(0.7, 0.9), rad), x: base.x, z: base.z, px, py, pz });
    }

    emitters.push({ x: top.x, y: top.y + 0.8 * S, z: top.z, r: 2.6 * S });
    if (spot.collide !== false) ctx.collide(base.x - 0.3 * S, base.z - 0.3 * S, base.x + 0.3 * S, base.z + 0.3 * S, base.y + trunkH);
    ctx.registry?.push({ kind: 'prop', x: base.x, z: base.z });

    // petals on the ground: a ring of drifts, deeper under the big ones
    if (decals) {
      const n = hero ? 16 : 8;
      for (let k = 0; k < n; k++) {
        const a = r.range(0, Math.PI * 2), d = r.range(0.6, 2.8) * S;
        decals.add('petals', base.x + Math.cos(a) * d, base.z + Math.sin(a) * d, r.range(0.8, 1.6) * S, r.range(1.2, 2.6) * S,
          { x: Math.cos(a + 1.3), z: Math.sin(a + 1.3) }, spot.y ?? 0, LAYER.petals);
      }
    }
  }

  const woodMesh = new THREE.Mesh(bake(wood), cel({ color: 0x5e4a52, bands: 3, tint: 0x3e3448 }));
  woodMesh.castShadow = woodMesh.receiveShadow = true;
  woodMesh.name = 'townSakuraWood';
  ctx.add(woodMesh);
  /* Blossom, with distance-based detail (SPEC 11).  Near the player every
   * clump is six little balls merged, each shaded round (radial normals): a
   * single sphere reads as a balloon and a low-poly one as a cut gem, but a
   * clump has the scalloped edge painted blossom has.  Past NEAR metres a
   * clump is one low ball, where its silhouette no longer shows.
   *
   * Only clumps in (or just outside) the view are drawn; they are sorted
   * again when the player has moved or turned a little, with enough margin
   * that nothing pops at the frame's edge.  Shadows come from their own
   * sets, drawn only into the shadow map (main.js), so trees behind the
   * player still shade the street: the clump itself within SHADE_NEAR, where
   * its scalloped edge shows on the ground, and one round ball beyond. */
  const nearGeo = clumpGeometry(1), farGeo = clumpGeometry(0, true);
  const make = (geo, mat, name, n) => {
    const inst = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    inst.castShadow = false;
    inst.receiveShadow = false;        // blossom stays high-key (see trees.js)
    inst.frustumCulled = false;         // the instances move between the sets
    inst.name = name;
    ctx.add(inst);
    return inst;
  };
  const sets = blobs.map((list, i) => {
    const mat = cel({ color: TONES[i], bands: 'soft', tint: TINTS[i], flat: false, emissive: TONES[i], emissiveIntensity: 0, cache: false });   // smooth: cel() is flat by default
    ctx.night?.glowing(mat, TONES[i], 0.28);        // after dark the blossom keeps some of its pink
    return { list, near: make(nearGeo, mat, 'townSakuraNear' + i, list.length), far: make(farGeo, mat, 'townSakuraFar' + i, list.length) };
  });
  const all = blobs.flat();
  // near the player the shadow is the clump itself (its scalloped edge shows
  // on the ground); further out one round ball does
  const shadeMat = cel({ color: TONES[1] });
  const shades = [nearGeo, clumpGeometry(1, true)].map((geo, i) => {
    const m = make(geo, shadeMat, 'townSakuraShadow' + i, all.length);
    m.castShadow = true;
    m.userData.shadowOnly = true;     // main.js shows it to the shadow pass only
    return m;
  });

  const NEAR = 40, SHADE = 68, SHADE_NEAR = 30;   // SHADE: the box diagonal, a tall crown's lean, a turn
  const last = { x: Infinity, z: Infinity, fwd: new THREE.Vector3(), cone: 0 };
  const fwd = new THREE.Vector3(), to = new THREE.Vector3();
  function update(cam) {
    const p = cam.position ?? cam;
    const hasView = !!cam.isCamera;
    if (hasView) cam.getWorldDirection(fwd); else fwd.set(0, 0, 0);
    const moved = Math.hypot(p.x - last.x, p.z - last.z);
    if (moved < 2 && fwd.angleTo(last.fwd) < 0.15) return;
    last.x = p.x; last.z = p.z; last.fwd.copy(fwd);
    // the view's half-diagonal, plus a margin for the turn before the next sort
    const cone = hasView
      ? Math.cos(Math.min(Math.PI, Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * Math.hypot(1, cam.aspect)) + 0.45))
      : -2;
    for (const set of sets) {
      let n = 0, f = 0;
      for (const b of set.list) {
        const d = Math.hypot(b.px - p.x, b.pz - p.z);
        if (d > 8 && cone > -1) {
          to.set(b.px - p.x, b.py - p.y, b.pz - p.z).normalize();
          if (to.dot(fwd) < cone) continue;
        }
        // a whole tree is near or far, never half of one
        if (Math.hypot(b.x - p.x, b.z - p.z) < NEAR) set.near.setMatrixAt(n++, b.m);
        else set.far.setMatrixAt(f++, b.m);
      }
      set.near.count = n;
      set.far.count = f;
      set.near.instanceMatrix.needsUpdate = true;
      set.far.instanceMatrix.needsUpdate = true;
    }
    // only what can fall inside the sun's shadow box (main.js: +-40 m round a
    // point 16 m ahead of the player), with room for the turn before the next sort
    const h = Math.hypot(fwd.x, fwd.z) || 1;
    const tx = p.x + (fwd.x / h) * 16 * (hasView ? 1 : 0), tz = p.z + (fwd.z / h) * 16 * (hasView ? 1 : 0);
    const k = [0, 0];
    for (const b of all) {
      if (Math.hypot(b.px - tx, b.pz - tz) > SHADE) continue;
      const i = Math.hypot(b.px - p.x, b.pz - p.z) < SHADE_NEAR ? 0 : 1;
      shades[i].setMatrixAt(k[i]++, b.m);
    }
    shades.forEach((m, i) => { m.count = k[i]; m.instanceMatrix.needsUpdate = true; });
  }
  update({ x: 0, y: 1.6, z: 16.5 });
  [trunkGeo, limbGeo, twigGeo].forEach((g) => g.dispose());
  return { wood: woodMesh, update, emitters, blobs: blobs.reduce((n, l) => n + l.length, 0) };
}

/** Six small balls round a centre, merged, each with its own radial normals
 *  (`detail` 1 near); or, far, one ball the size of the whole clump. */
function clumpGeometry(detail, single = false) {
  if (single) {
    const g = new THREE.IcosahedronGeometry(0.78, detail);
    const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
    return g;
  }
  const r = rngKit(515);
  const parts = [];
  const offsets = [[0, 0.15, 0], [0.45, 0, 0.1], [-0.4, 0.05, 0.2], [0.1, -0.05, 0.45], [-0.05, 0.1, -0.45], [0.05, 0.45, 0]];
  for (const [x, y, z] of offsets) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
    const s = r.range(0.42, 0.55);
    parts.push({ geometry: g, matrix: trs(x, y, z, 0, 0, 0, s, s, s) });
  }
  return bake(parts);
}
