import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { rngKit, bake, trs, sagCurve } from '../../core/util.js';
import { makeCrow } from '../props.js';
import { POLES } from '../../config.js';

/* ------------------------------------------------------------------ *
 * Life in the town (SPEC section 3, trees, light and life; M2d).
 *
 *   wire birds    sparrows (and a few crows) sat along the power lines;
 *                 near the player they shuffle and turn their heads
 *   ground birds  small flocks pecking in the park, on the plaza and at the
 *                 shrine; they hop while you are near and fly up to a wire
 *                 if you come within a few metres, then drift back down
 *   cats          the town's cats swish their tails
 *
 * Sparrows are instanced (one draw for every bird); only the ones within
 * NEAR metres are touched each frame.
 * ------------------------------------------------------------------ */

const NEAR = 32;

/** A sparrow: round body, head, beak, tail, all one small mesh. */
function sparrowGeometry() {
  const body = new THREE.SphereGeometry(0.06, 7, 5);
  const head = new THREE.SphereGeometry(0.038, 6, 4);
  const tail = new THREE.BoxGeometry(0.02, 0.012, 0.07);
  const beak = new THREE.ConeGeometry(0.01, 0.025, 4);
  beak.rotateX(Math.PI / 2);
  return bake([
    { geometry: body, matrix: trs(0, 0.06, 0, 0, 0, 0, 0.9, 0.85, 1.25) },
    { geometry: head, matrix: trs(0, 0.105, 0.06) },
    { geometry: beak, matrix: trs(0, 0.1, 0.1) },
    { geometry: tail, matrix: trs(0, 0.06, -0.1, 0.35, 0, 0) },
  ]);
}

/**
 * @param wireRuns  the kit's power lines ({ points, sag })
 * @param flocks    [{ x, z, y, n }] where sparrows peck on the ground
 */
export function buildLife(ctx, { wireRuns = [], flocks = [], cats = [] }) {
  const r = rngKit(4466);
  const geo = sparrowGeometry();
  const mat = cel({ color: 0x8a6a52, bands: 3, tint: 0x5c4a58 });

  /* ---- where they sit on the wires ---- */
  const perches = [];
  for (let k = 0; k < 70 && wireRuns.length; k++) {
    const run = wireRuns[Math.floor(r.next() * wireRuns.length)];
    if (run.points.length < 2) continue;
    const i = Math.floor(r.next() * (run.points.length - 1));
    const a = run.points[i], b = run.points[i + 1];
    const d = a.distanceTo(b);
    if (d < 6) continue;
    const curve = sagCurve(a, b, (run.sag ?? POLES.sag) * Math.min(1.6, d / 14), 12);
    const t = r.range(0.2, 0.8);
    const along = new THREE.Vector3().subVectors(b, a).normalize();
    // birds on a wire sit a little apart, facing across it
    const n = r.int(1, 4);
    for (let j = 0; j < n; j++) {
      const q = curve.getPoint(Math.min(0.95, t + j * 0.03));
      perches.push({ x: q.x, y: q.y + 0.01, z: q.z, ry: Math.atan2(along.x, along.z) + Math.PI / 2 + (r.chance(0.5) ? Math.PI : 0) });
    }
  }

  /* ---- sparrows: on wires, and on the ground ---- */
  const birds = [];
  for (const p of perches.slice(0, 60)) birds.push({ ...p, home: { ...p }, mode: 'wire', t: r.range(0, 5) });
  for (const f of flocks) {
    for (let j = 0; j < (f.n ?? 4); j++) {
      const x = f.x + r.range(-1.2, 1.2), z = f.z + r.range(-1.2, 1.2);
      birds.push({ x, y: f.y ?? 0, z, ry: r.range(0, Math.PI * 2), home: { x, y: f.y ?? 0, z }, mode: 'ground', t: r.range(0, 5), hop: 0 });
    }
  }
  const inst = new THREE.InstancedMesh(geo, mat, Math.max(1, birds.length));
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst.castShadow = false;
  inst.frustumCulled = false;
  inst.name = 'sparrows';
  inst.userData.dynamic = true;
  ctx.add(inst);
  const d = new THREE.Object3D();
  const write = (i, b) => {
    d.position.set(b.x, b.y + (b.hopY ?? 0), b.z);
    d.rotation.set(b.peck ? 0.5 : 0, b.ry, 0);
    d.scale.setScalar(1);
    d.updateMatrix();
    inst.setMatrixAt(i, d.matrix);
  };
  birds.forEach((b, i) => write(i, b));

  /* ---- a few crows, on the wires further along ---- */
  for (const p of perches.slice(60, 64)) {
    const c = makeCrow({ x: p.x, y: p.y - 0.02, z: p.z, ry: p.ry });
    c.position.set(p.x, p.y - 0.02, p.z);
    c.rotation.y = p.ry;
    c.userData.dynamic = true;
    ctx.add(c);
  }

  /* ---- the frame: only birds near the player move ---- */
  let clock = 0;
  function update(dt, cam) {
    if (!cam) return;
    clock += dt;
    let dirty = false;
    birds.forEach((b, i) => {
      const dist = Math.hypot(b.x - cam.x, b.z - cam.z);
      if (dist > NEAR && b.mode !== 'flying') return;
      b.t -= dt;
      if (b.mode === 'ground') {
        if (dist < 3.2) {
          // startled: off to the nearest perch
          // one of the few nearest perches, and not all on the same spot of wire
          const near = perches.slice().sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z)).slice(0, 5);
          const pick = near[Math.floor(r.next() * near.length)] ?? b.home;
          const target = { x: pick.x + r.range(-0.3, 0.3), y: pick.y, z: pick.z + r.range(-0.3, 0.3) };
          Object.assign(b, { mode: 'flying', from: { x: b.x, y: b.y, z: b.z }, to: target, u: 0, back: true });
        } else if (b.t <= 0) {
          // hop, peck, turn
          b.t = r.range(0.4, 1.8);
          b.ry += r.range(-1.2, 1.2);
          b.x += Math.sin(b.ry) * 0.15; b.z += Math.cos(b.ry) * 0.15;
          if (Math.hypot(b.x - b.home.x, b.z - b.home.z) > 1.6) { b.x = b.home.x; b.z = b.home.z; }
          b.hop = 0.25;
          b.peck = r.chance(0.4);
        }
        b.hop = Math.max(0, (b.hop ?? 0) - dt);
        b.hopY = Math.sin((b.hop / 0.25) * Math.PI) * 0.05;
      } else if (b.mode === 'wire') {
        if (b.t <= 0) { b.t = r.range(1, 4); b.ry += r.chance(0.5) ? Math.PI : r.range(-0.4, 0.4); }
      } else if (b.mode === 'flying') {
        b.u = Math.min(1, b.u + dt / 1.6);
        const e = b.u * b.u * (3 - 2 * b.u);
        b.x = b.from.x + (b.to.x - b.from.x) * e;
        b.z = b.from.z + (b.to.z - b.from.z) * e;
        b.y = b.from.y + (b.to.y - b.from.y) * e + Math.sin(b.u * Math.PI) * 1.5;
        b.ry = Math.atan2(b.to.x - b.from.x, b.to.z - b.from.z);
        b.peck = false;
        if (b.u >= 1) {
          if (b.back && Math.hypot(b.home.x - cam.x, b.home.z - cam.z) > 8) {
            // the player has moved on: back down to peck
            Object.assign(b, { from: { x: b.x, y: b.y, z: b.z }, to: b.home, u: 0, back: false });
          } else if (!b.back) {
            b.mode = 'ground';
          } else {
            b.u = 0.999;                   // waiting on the wire
            b.from = { x: b.x, y: b.y, z: b.z };
          }
        }
      }
      write(i, b);
      dirty = true;
    });
    if (dirty) inst.instanceMatrix.needsUpdate = true;
    // cats: a slow swish of the tail
    for (const c of cats) {
      if (Math.hypot(c.position.x - cam.x, c.position.z - cam.z) > NEAR) continue;
      const tail = c.userData.tail;
      if (tail) tail.rotation.y = Math.sin(clock * 1.7 + c.id) * 0.35;
    }
  }
  return { update, birds: birds.length, perches: perches.length };
}
