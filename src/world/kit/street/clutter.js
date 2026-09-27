import * as THREE from 'three';
import { cel } from '../../../core/toon.js';
import { bake, trs } from '../../../core/util.js';
import { PAL } from '../../../core/palette.js';
import { bicycleGeometry } from '../../props.js';

/* ------------------------------------------------------------------ *
 * Street clutter, instanced (town quality pass).
 *
 * Everything small and repeated on the walks and the poles, one
 * InstancedMesh per kind for the whole town (AGENTS.md): each kind is a
 * single vertex-coloured geometry, with an instance colour where copies
 * differ (a crate's plastic, a bicycle's frame).  Generators queue with
 * `clutter.put(kind, x, y, z, ry, { color, tilt, scale })`; `finish()`
 * builds every kind once.
 *
 *   bike      a parked city bicycle with its basket (4 meshes: the shared
 *             bicycle geometry in props.js split by material)
 *   gashapon  a bank of four capsule-toy machines, two up, two across
 *   crate     one plastic bottle crate; stacks are several instances
 *   bollard   車止め: a steel post with a yellow band and a cap
 *   sleeve    支線ガード: the yellow-and-black guard on a pole's stay wire
 *   bolt      a pole step (足場ボルト)
 *   polebox   a grey switch or meter box strapped to a pole
 *   cone      a traffic cone, with its white collar
 * ------------------------------------------------------------------ */

const col = new THREE.Color();
/** A geometry painted one colour, moved by `mx`. */
function part(geo, color, mx) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (mx) g.applyMatrix4(mx);
  col.set(color);
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return { geometry: g };
}
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);

/* ---------------------------------------------------------------- kinds */

function gashaponGeo() {
  const parts = [];
  const bodies = [0xe8483c, 0x2f7fd0, 0xf2c23c, 0x4fae6a];
  const W = 0.44, D = 0.4, H = 0.62;
  for (let i = 0; i < 4; i++) {
    const x = (i % 2 - 0.5) * (W + 0.02), y = 0.08 + Math.floor(i / 2) * (H + 0.02);
    const c = bodies[i];
    parts.push(part(B(W, H, D), c, trs(x, y + H / 2, 0)));
    // the window full of capsules (upper half), and the capsules showing in it
    parts.push(part(B(W - 0.08, H * 0.42, 0.02), 0xe6eef6, trs(x, y + H * 0.7, D / 2 + 0.005)));
    const caps = [0xf08aa8, 0x7ac0f0, 0xf6d24a, 0x9ad07a, 0xffffff, 0xf0a050];
    for (let k = 0; k < 6; k++) {
      const cx = x + ((k % 3) - 1) * 0.1, cy = y + H * (0.6 + Math.floor(k / 3) * 0.17);
      parts.push(part(new THREE.SphereGeometry(0.045, 6, 4), caps[(k + i * 2) % caps.length], trs(cx, cy, D / 2 + 0.02)));
    }
    // the header card, the coin dial and the chute
    parts.push(part(B(W - 0.04, 0.09, 0.02), 0xffffff, trs(x, y + H - 0.06, D / 2 + 0.006)));
    parts.push(part(C(0.055, 0.055, 0.04, 10), 0xc8ccd6, trs(x, y + H * 0.34, D / 2 + 0.02, Math.PI / 2)));
    parts.push(part(B(0.05, 0.1, 0.03), 0x9a9eaa, trs(x, y + H * 0.34, D / 2 + 0.05)));
    parts.push(part(B(0.14, 0.1, 0.05), 0x3c3a48, trs(x, y + 0.1, D / 2 + 0.01)));
  }
  // the steel stand under them
  parts.push(part(B(W * 2 + 0.06, 0.08, D + 0.04), 0x8b8f9a, trs(0, 0.04, 0)));
  return bake(parts);
}

function crateGeo() {
  // a bottle crate: open top, slots in the walls, a dark inside
  const W = 0.46, D = 0.33, H = 0.28, t = 0.03;
  const parts = [];
  const white = 0xffffff, slot = 0x6a6680;
  parts.push(part(B(W, 0.03, D), white, trs(0, 0.015, 0)));
  for (const s of [-1, 1]) {
    parts.push(part(B(W, H, t), white, trs(0, H / 2, s * (D / 2 - t / 2))));
    parts.push(part(B(t, H, D), white, trs(s * (W / 2 - t / 2), H / 2, 0)));
    // hand slots and the grid of vents, as dark insets on the long walls
    parts.push(part(B(0.12, 0.04, 0.005), slot, trs(0, H - 0.06, s * (D / 2 + 0.002))));
    for (let k = -2; k <= 2; k++) parts.push(part(B(0.05, 0.1, 0.005), slot, trs(k * 0.08, H * 0.38, s * (D / 2 + 0.002))));
  }
  // the dividers seen over the rim
  for (let k = -1; k <= 1; k++) parts.push(part(B(0.012, H * 0.8, D - 0.04), 0xd8d8e0, trs(k * 0.11, H * 0.4, 0)));
  parts.push(part(B(W - 0.04, 0.012, 0.012), 0xd8d8e0, trs(0, H * 0.78, 0)));
  return bake(parts);
}

function bollardGeo() {
  const parts = [];
  const H = 0.85;
  parts.push(part(C(0.055, 0.055, H, 10), 0xc4c8d2, trs(0, H / 2, 0)));
  parts.push(part(C(0.058, 0.058, 0.14, 10), 0xf2c23c, trs(0, H - 0.2, 0)));
  parts.push(part(C(0.058, 0.058, 0.05, 10), 0x2a2834, trs(0, H - 0.3, 0)));
  parts.push(part(new THREE.SphereGeometry(0.058, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0xc4c8d2, trs(0, H, 0)));
  parts.push(part(C(0.09, 0.09, 0.02, 10), 0x8b8f9a, trs(0, 0.01, 0)));
  return bake(parts);
}

function sleeveGeo() {
  // along +y, 1.8 m, foot at 0: yellow with black bands
  const parts = [];
  const n = 9, L = 1.8;
  for (let i = 0; i < n; i++) {
    parts.push(part(C(0.042, 0.042, L / n, 8), i % 2 ? PAL.gateBlack : PAL.gateYellow, trs(0, (i + 0.5) * (L / n), 0)));
  }
  return bake(parts);
}

function boltGeo() {
  return bake([part(C(0.017, 0.017, 0.24, 5), 0x6f7380, trs(0, 0, 0.11, Math.PI / 2))]);
}

function poleBoxGeo() {
  const parts = [];
  parts.push(part(B(0.3, 0.42, 0.2), 0xb4b8c2, trs(0, 0, 0.26)));
  parts.push(part(B(0.32, 0.04, 0.22), 0x9a9eaa, trs(0, 0.23, 0.26)));
  parts.push(part(B(0.06, 0.04, 0.12), 0x6a6e7a, trs(0, 0, 0.12)));
  parts.push(part(B(0.12, 0.08, 0.01), 0xf6f4ec, trs(0, 0.06, 0.365)));
  for (const y of [-0.1, 0.1]) parts.push(part(new THREE.TorusGeometry(0.2, 0.008, 3, 12), 0x6a6e7a, trs(0, y, 0.05, Math.PI / 2)));
  return bake(parts);
}

function coneGeo() {
  const parts = [];
  parts.push(part(B(0.38, 0.04, 0.38), 0x2a2834, trs(0, 0.02, 0)));
  parts.push(part(C(0.03, 0.14, 0.66, 10), 0xe8583c, trs(0, 0.37, 0)));
  parts.push(part(C(0.075, 0.1, 0.14, 10), 0xf6f4f8, trs(0, 0.36, 0)));
  return bake(parts);
}

const KINDS = {
  gashapon: { geo: gashaponGeo, shadow: true },
  crate: { geo: crateGeo, shadow: true },
  bollard: { geo: bollardGeo, shadow: true },
  sleeve: { geo: sleeveGeo, shadow: true },
  bolt: { geo: boltGeo, shadow: false },
  polebox: { geo: poleBoxGeo, shadow: true },
  cone: { geo: coneGeo, shadow: true },
};

export function makeClutter(ctx) {
  const queue = {};
  const d = new THREE.Object3D();
  const built = [];
  return {
    /** `o.tilt` pitches the copy (a stay-wire guard), `o.roll` leans it. */
    put(kind, x, y, z, ry = 0, o = {}) {
      (queue[kind] ??= []).push({ x, y, z, ry, ...o });
    },
    count: (kind) => queue[kind]?.length ?? 0,
    finish() {
      for (const [kind, list] of Object.entries(queue)) {
        if (!list.length) continue;
        if (kind === 'bike') { built.push(...bikes(ctx, list, d)); continue; }
        const K = KINDS[kind];
        const mat = cel({ color: 0xffffff, bands: 3, tint: 0x5c5a8a, vertexColors: true });
        const inst = new THREE.InstancedMesh(K.geo(), mat, list.length);
        list.forEach((p, i) => {
          d.position.set(p.x, p.y, p.z);
          d.rotation.set(p.tilt ?? 0, p.ry, p.roll ?? 0, 'YXZ');
          d.scale.setScalar(p.scale ?? 1);
          d.updateMatrix();
          inst.setMatrixAt(i, d.matrix);
          inst.setColorAt(i, col.set(p.color ?? 0xffffff));
        });
        finishInst(ctx, inst, `clutter-${kind}`, K.shadow);
        built.push(inst);
      }
      return built;
    },
  };
}

function finishInst(ctx, inst, name, shadow) {
  inst.name = name;
  inst.castShadow = shadow;
  inst.receiveShadow = true;
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.computeBoundingSphere();
  ctx.add(inst);
}

/** Parked bicycles: the shared bicycle, four meshes for all of them. */
function bikes(ctx, list, d) {
  const g = bicycleGeometry();
  const n = list.length;
  const meshes = [
    new THREE.InstancedMesh(g.dark, cel({ color: PAL.black, bands: 2, tint: 0x4b4560 }), n),
    new THREE.InstancedMesh(g.frame, cel({ color: 0xffffff, bands: 3, tint: 0x4a4a92, cache: false }), n),
    new THREE.InstancedMesh(g.brite, cel({ color: PAL.metal, bands: 3, tint: 0x666090 }), n),
    new THREE.InstancedMesh(g.mesh, cel({ color: PAL.metal, bands: 3, side: THREE.DoubleSide, tint: 0x666090 }), n),
  ];
  list.forEach((p, i) => {
    d.position.set(p.x, p.y, p.z);
    d.rotation.set(p.roll ?? 0, p.ry, 0, 'YXZ');
    d.scale.setScalar(1);
    d.updateMatrix();
    for (const m of meshes) m.setMatrixAt(i, d.matrix);
    meshes[1].setColorAt(i, col.set(p.color ?? 0x3f6f9c));
  });
  meshes.forEach((m, k) => finishInst(ctx, m, `clutter-bike-${k}`, true));
  return meshes;
}
