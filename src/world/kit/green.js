import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { rngKit, bake, trs } from '../../core/util.js';
import { buildCanopyTrees } from './canopy.js';
import { leafTex, leafCardTex, needleTex, grassTex, ivyTex } from './paint.js';

/* ------------------------------------------------------------------ *
 * The town's green (SPEC M2e; reference/japan-details.md section 6).
 *
 * Painted trees, in the same manner as the sakura (kit/canopy.js):
 *   zelkova   欅, the street tree: a vase of upward limbs, fresh spring green
 *   camphor   楠, the shrine's and the park's: round, dense, glossy
 *   maple     紅葉, a garden's: small, layered, feathery (and a red-leaved one)
 *   pine      松, the clipped garden pine: flat pads on a leaning trunk
 *   shrub     the plant in a pot, a garden's low bush
 * and what grows between: crowds of pots on doorsteps, weeds at every wall
 * foot, kerb and pole, ivy on the old block walls.
 *
 * Generators queue trees with plant(ctx, species, spot); buildGreen builds
 * each species in one batch at the end, like the sakura.
 * ------------------------------------------------------------------ */

const SHADE = [0x8ca0b0, 0x7a92a8, 0x6a7e9c];     // green's shade side: blue-violet, never grey-green

export const LOOKS = {
  zelkova: {
    name: 'zelkova', tones: [0xe4f2c4, 0xc6e2a2, 0xa4cc88], tints: SHADE, bands: 'soft3',
    skin: () => leafTex('broad'), skinRepeat: [2, 1], card: () => leafCardTex('broad'),
    wood: 0x6a5a58, ground: { drift: 'leaves' },
    form: {
      // a vase: steep limbs that hardly bend, lobes up their length (sakura pass)
      lobes: true, trunkH: 2.6, lean: 0.12, girth: 0.2, limbs: [4, 5], heroLimbs: [5, 7],
      tilt: [0.2, 0.4], heroTilt: [0.25, 0.45], len: 3.6, heroLen: 4.2, bend: [0.12, 0.22],
      fineTwigs: 2, fineLen: 0.6, lobeR: 1.0, perLobe: 8, cushion: 0.5,
      droop: 0.3, flatten: [0.6, 0.8], wide: 1.1, rimFrom: 0.7,
    },
  },
  camphor: {
    name: 'camphor', tones: [0xd2e8b0, 0xa8cf8c, 0x80b075], tints: [0x7890a4, 0x6a8298, 0x5a708c], bands: 'soft3',
    skin: () => leafTex('glossy'), skinRepeat: [2, 1], card: () => leafCardTex('glossy'),
    wood: 0x5a4e4c, ground: { drift: 'leaves' },
    form: {
      // round and dense: lobes packed into one dome, a heavy trunk under it (sakura pass)
      lobes: true, trunkH: 2.2, lean: 0.2, girth: 0.3, limbs: [4, 5], heroLimbs: [5, 6],
      tilt: [0.45, 0.7], heroTilt: [0.55, 0.8], len: 3.0, heroLen: 3.4, bend: [0.25, 0.4],
      fineTwigs: 1, fineLen: 0.5, lobeR: 1.2, perLobe: 9, cushion: 0.55,
      droop: 0.4, flatten: [0.7, 0.85], wide: 1.15, rimFrom: 0.7,
    },
  },
  maple: {
    name: 'maple', tones: [0xeef5c8, 0xd8eaa8, 0xbcd88e], tints: SHADE, bands: 'soft3',
    skin: () => leafTex('maple'), skinRepeat: [2, 1], card: () => leafCardTex('maple'),
    wood: 0x6a5656,
    form: {
      trunkH: 1.5, lean: 0.35, girth: 0.12, limbs: [4, 5], heroLimbs: [5, 7],
      tilt: [0.8, 1.3], heroTilt: [0.9, 1.35], len: 1.7, heroLen: 2.2, rise: 0.8,
      forks: 2, fineTwigs: 2, fineLen: 0.6, perTree: [50, 90], cushion: 0.42, spread: 0.8,
      droop: 0.5, flatten: [0.45, 0.6], wide: 1.2, rimFrom: 0.7,
    },
  },
  mapleRed: {
    name: 'mapleRed', tones: [0xf2bca8, 0xe0978a, 0xc8787e], tints: [0x9a7890, 0x8a6a88, 0x7a5c80], bands: 'soft3',
    skin: () => leafTex('maple'), skinRepeat: [2, 1], card: () => leafCardTex('maple'),
    wood: 0x5e4a52,
    form: null,                     // the maple's (below)
  },
  pine: {
    name: 'pine', tones: [0xc0d8b8, 0x98bc9e, 0x76a086], tints: [0x6a8098, 0x5c7290, 0x506688], bands: 'soft3',
    skin: needleTex, skinRepeat: [3, 1.5], card: null, wood: 0x5c4e4a,
    form: {
      trunkH: 1.6, lean: 0.7, girth: 0.16, limbs: [5, 7], heroLimbs: [7, 9],
      tilt: [1.1, 1.5], heroTilt: [1.1, 1.55], len: 1.6, heroLen: 2.1, rise: 0.5,
      forks: 1, fineTwigs: 0, fineLen: 0, perTree: [0, 0], cushion: 0.75, spread: 1,
      droop: 0, flatten: [0.28, 0.38], wide: 1.3, rimFrom: 9, padsOnly: true,
    },
  },
  shrub: {
    name: 'shrub', tones: [0xd8ecb8, 0xb4d696, 0x90bc7c], tints: SHADE, bands: 'soft3',
    skin: () => leafTex('glossy'), skinRepeat: [2, 1], card: () => leafCardTex('broad'),
    wood: 0x6a5a50,
    form: {
      trunkH: 0.15, lean: 0.1, girth: 0.03, limbs: [3, 4], heroLimbs: [3, 4],
      tilt: [0.3, 0.9], heroTilt: [0.3, 0.9], len: 0.35, heroLen: 0.35, rise: 1,
      forks: 1, fineTwigs: 0, fineLen: 0, perTree: [12, 12], cushion: 0.5, spread: 0.6,
      droop: 0, flatten: [0.8, 1.0], wide: 1, rimFrom: 0.5,
    },
  },
};
LOOKS.mapleRed.form = LOOKS.maple.form;

/** Queue a tree (or a potted plant) of `species` at `spot` for buildGreen. */
export function plant(ctx, species, spot) {
  (ctx.green ??= {});
  (ctx.green[species] ??= []).push(spot);
}

/** Build every queued species in one batch each.  Returns their updaters. */
export function buildGreen(ctx, { decals } = {}) {
  const out = [];
  for (const [species, spots] of Object.entries(ctx.green ?? {})) {
    if (!spots.length) continue;
    const t = buildCanopyTrees(ctx, spots, LOOKS[species], { decals });
    if (t) out.push(t);
  }
  return { update: (cam) => out.forEach((t) => t.update(cam)), trees: out };
}

/* ------------------------------------------------------------- pots */

let potMats = null;
function pots() {
  if (!potMats) {
    potMats = {
      clay: cel({ color: 0xc4785a, bands: 3, tint: 0x6a5078 }),
      glaze: cel({ color: 0x4e6a8a, bands: 3, tint: 0x3e4a70 }),
      plastic: cel({ color: 0x5a5a62, bands: 3, tint: 0x4a4668 }),
      green: cel({ color: 0x6f8f5a, bands: 3, tint: 0x4a5a6e }),
      foam: cel({ color: 0xf2f2ee, bands: 3, tint: 0x8a86b0 }),
      soil: cel({ color: 0x5a4a40, bands: 2, tint: 0x3e3448 }),
    };
  }
  return potMats;
}

/**
 * A crowd of pots on a doorstep (Tan's Yotsugi photos): clay, glazed and
 * plastic pots of every size, a styrofoam box of seedlings, each with its
 * plant.  `at` a point, `along` a unit vector along the frontage, `n` pots.
 * Returns the footprint half-size for the caller's collider.
 */
export function potCrowd(ctx, at, along, { n = 6, seed = 1, reg } = {}) {
  const r = rngKit(seed);
  const m = pots();
  const byMat = new Map();
  const put = (mat, geo, mx) => (byMat.get(mat) ?? byMat.set(mat, []).get(mat)).push({ geometry: geo, matrix: mx });
  let u = -((n - 1) * 0.3) / 2;
  const across = { x: along.z, z: -along.x };
  for (let i = 0; i < n; i++) {
    const kind = r.next();
    const back = r.range(-0.15, 0.2);
    const x = at.x + along.x * u + across.x * back, z = at.z + along.z * u + across.z * back;
    const y = at.y ?? 0;
    if (kind < 0.15) {
      // a styrofoam box of seedlings
      const w = r.range(0.45, 0.6), d = 0.32, h = 0.2;
      put(m.foam, new THREE.BoxGeometry(w, h, d), trs(x, y + h / 2, z, 0, Math.atan2(along.x, along.z) + Math.PI / 2, 0));
      put(m.soil, new THREE.BoxGeometry(w - 0.06, 0.02, d - 0.06), trs(x, y + h - 0.02, z, 0, Math.atan2(along.x, along.z) + Math.PI / 2, 0));
      for (let k = 0; k < 3; k++) plant(ctx, 'shrub', { x: x + along.x * (k - 1) * 0.16, z: z + along.z * (k - 1) * 0.16, y: y + h, scale: r.range(0.18, 0.26), seed: seed * 7 + i * 3 + k, collide: false });
      u += w * 0.9;
      continue;
    }
    const rad = r.range(0.1, 0.24), h = rad * r.range(1.1, 1.6);
    const mat = kind < 0.5 ? m.clay : kind < 0.65 ? m.glaze : kind < 0.85 ? m.plastic : m.green;
    put(mat, new THREE.CylinderGeometry(rad, rad * 0.75, h, 12), trs(x, y + h / 2, z));
    put(m.soil, new THREE.CylinderGeometry(rad * 0.92, rad * 0.92, 0.02, 12), trs(x, y + h - 0.015, z));
    plant(ctx, r.next() < 0.1 ? 'maple' : 'shrub', { x, z, y: y + h - 0.02, scale: rad * r.range(1.8, 2.8), seed: seed * 7 + i, collide: false });
    u += rad * 2 + r.range(0.02, 0.1);
  }
  for (const [mat, parts] of byMat) {
    const mesh = new THREE.Mesh(bake(parts), mat);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.detail = true;
    ctx.add(mesh);
  }
  reg?.('prop', at);
  return Math.max(0.3, u / 2);
}

/* ------------------------------------------------------------- ivy */

let ivyMat = null;
/** A patch of ivy on a wall face: `c` its centre at the wall foot, facing
 * `face` (unit, out of the wall), w wide, h tall. */
export function ivyPanel(ctx, c, face, w, h) {
  ivyMat ??= cel({ color: 0xffffff, map: ivyTex(), bands: 3, tint: 0x5a6a88, alphaTest: 0.5, side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ivyMat);
  m.position.set(c.x + face.x * 0.02, (c.y ?? 0) + h / 2, c.z + face.z * 0.02);
  m.rotation.y = Math.atan2(face.x, face.z);
  m.userData.noOutline = true;
  m.receiveShadow = true;
  ctx.add(m);
  return m;
}

/* ------------------------------------------------------------- weeds */

/**
 * Weeds: crossed-quad tufts at every wall foot, kerb, gutter and pole, and
 * a field of them in the vacant lot.  One instanced draw for the town.
 * `spots` [{ x, z, y, s }].
 */
export function buildWeeds(ctx, spots) {
  if (!spots.length) return null;
  const a = new THREE.PlaneGeometry(1, 1);
  a.translate(0, 0.5, 0);
  const b = a.clone();
  b.rotateY(Math.PI / 2);
  const geo = bake([{ geometry: a }, { geometry: b }]);
  const nr = geo.attributes.normal;
  for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);     // lit like the ground they grow from
  const mat = cel({ color: 0xffffff, map: grassTex(), bands: 3, tint: 0x5a6a88, alphaTest: 0.5, side: THREE.DoubleSide });
  const inst = new THREE.InstancedMesh(geo, mat, spots.length);
  const d = new THREE.Object3D();
  const r = rngKit(9191);
  spots.forEach((p, i) => {
    d.position.set(p.x, p.y ?? 0, p.z);
    d.rotation.set(0, r.range(0, Math.PI), 0);
    const s = p.s ?? r.range(0.22, 0.5);
    d.scale.set(s * r.range(0.8, 1.3), s, s * r.range(0.8, 1.3));
    d.updateMatrix();
    inst.setMatrixAt(i, d.matrix);
  });
  inst.name = 'weeds';
  inst.castShadow = false;
  inst.receiveShadow = true;
  inst.userData.noOutline = true;
  ctx.add(inst);
  return inst;
}
