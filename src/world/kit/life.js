import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { rngKit, sagCurve } from '../../core/util.js';
import { makeCrow } from '../props.js';
import { POLES } from '../../config.js';
import { Body, loft, blob, limb, at } from '../animals/shapes.js';
import { dressCat } from '../animals/cat.js';
import { makeShadows } from '../animals/shade.js';

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

/** A tree sparrow (スズメ): a plump brown bird, the chestnut cap, a white
 * cheek with its black spot, a small black bib, streaked back, a white
 * wing bar, a stubby dark bill.  One small mesh, painted per vertex. */
function sparrowGeometry() {
  const b = new Body();
  const back = (p) => (Math.sin(p.x * 260) * Math.sin(p.z * 90) > 0.45 ? 0x3e2c22 : 0x9a6c46);
  b.add(loft([
    { p: [0, 0.055, -0.07], rx: 0.0, ry: 0.0 },
    { p: [0, 0.056, -0.06], rx: 0.022, ry: 0.02 },
    { p: [0, 0.06, -0.025], rx: 0.04, ry: 0.04 },
    { p: [0, 0.066, 0.015], rx: 0.042, ry: 0.043 },
    { p: [0, 0.075, 0.045], rx: 0.034, ry: 0.036 },
    { p: [0, 0.084, 0.06], rx: 0.0, ry: 0.0 },
  ], 8), { color: (p) => (p.y < 0.062 ? 0xdcd4c4 : p.y < 0.075 && p.z > 0.0 ? 0xcfc6b4 : back(p)) });
  // folded wings: brown, a white bar, dark tips
  for (const s of [-1, 1]) {
    b.add(blob(0.018, 0.022, 0.05, 6, 4), {
      matrix: at(s * 0.03, 0.074, -0.012, -0.15, s * 0.1, 0),
      color: (p) => (p.z < -0.045 ? 0x3a2a22 : Math.abs(p.z - 0.004) < 0.005 ? 0xf2eee4 : back(p)),
    });
  }
  // the head: chestnut cap, white cheeks with a black spot, a black bib
  const hy = 0.094, hz = 0.05;
  b.add(blob(0.028, 0.027, 0.03, 9, 6), {
    matrix: at(0, hy, hz),
    color: (p) => {
      const ax = Math.abs(p.x);
      if (p.y > hy + 0.009) return 0x8e4a2c;
      if (p.y < hy - 0.012 && p.z > hz + 0.012 && ax < 0.012) return 0x1e1a1a;        // the bib
      if (ax > 0.018 && Math.abs(p.y - (hy - 0.004)) < 0.006 && Math.abs(p.z - hz) < 0.008) return 0x1e1a1a;   // the cheek spot
      if (ax > 0.012 && p.y < hy + 0.006) return 0xf4f0e6;
      return 0x8e4a2c;
    },
  });
  b.add(loft([{ p: [0, hy - 0.004, hz + 0.024], rx: 0.009, ry: 0.009 }, { p: [0, hy - 0.006, hz + 0.036], rx: 0.004, ry: 0.004 }, { p: [0, hy - 0.007, hz + 0.042], rx: 0, ry: 0 }], 5), { color: 0x2e2a2a });
  for (const s of [-1, 1]) b.add(blob(0.004, 0.004, 0.004, 4, 3), { matrix: at(s * 0.02, hy + 0.004, hz + 0.014), color: 0x121010 });
  // the tail: short, brown
  b.add(blob(0.017, 0.005, 0.04, 5, 3), { matrix: at(0, 0.064, -0.075, -0.2, 0, 0), color: 0x6a4a34 });
  // legs: thin, pinkish brown
  for (const s of [-1, 1]) b.add(limb([s * 0.012, 0.05, 0.005], [s * 0.013, 0.002, 0.012], 0.0035, 0.003, 3), { color: 0xa8826e });
  return b.build();
}

/**
 * @param wireRuns  the kit's power lines ({ points, sag })
 * @param flocks    [{ x, z, y, n }] where sparrows peck on the ground
 */
export function buildLife(ctx, { wireRuns = [], flocks = [], cats = [] }) {
  const r = rngKit(4466);
  const geo = sparrowGeometry();
  const mat = cel({ color: 0xffffff, bands: 3, tint: 0x5c4a58, flat: false, vertexColors: true, cache: false });
  // the cats: the proper cat in each dressing's place (animals/cat.js)
  cats.forEach((c, i) => dressCat(c, i));

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
  // soft contact shadows under the ground birds (the shadow map can't follow them)
  const shade = makeShadows(ctx, Math.max(1, birds.filter((b) => b.mode === 'ground').length));
  for (const b of birds) if (b.mode === 'ground') b.shadow = shade.slot();
  const d = new THREE.Object3D();
  const write = (i, b) => {
    if (b.shadow !== undefined) {
      const up = Math.max(0, b.y + (b.hopY ?? 0) - b.home.y);
      const k = b.mode === 'flying' || up > 0.5 ? Math.max(0, 1 - up / 2) * 0.8 : 1;
      shade.set(b.shadow, b.x, b.home.y, b.z, 0.035 * k, 0.06 * k, b.ry);
    }
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
    shade.mesh.visible = birds.some((b) => b.shadow !== undefined && Math.hypot(b.home.x - cam.x, b.home.z - cam.z) < NEAR * 2);
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
