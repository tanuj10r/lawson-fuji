import { rngKit } from '../../core/util.js';
import { ANIMALS } from '../../config.js';
import { Body, loft, sheet } from './shapes.js';
import { animalMaterial, Herd } from './shade.js';

/* ------------------------------------------------------------------ *
 * モンシロチョウ, the cabbage white: April's butterfly over the renge and the
 * nanohana.  Cream-white wings, a sooty tip and a dot or two on the
 * forewing; a quick, fluttering, wandering flight a foot or two over the
 * flowers, a settle on one with the wings shut upright, a few slow opens,
 * and away again.
 *
 * Parts: 0 body, 2 left wings, 3 right wings.  aPose x wing angle
 * (0 open flat, 1.5 shut upright).
 * ------------------------------------------------------------------ */

function butterflyGeometry() {
  const b = new Body();
  // the body: a small dark grey rod, furry-pale at the thorax
  b.add(loft([
    { p: [0, 0, 0.012], rx: 0.0, ry: 0.0 },
    { p: [0, 0, 0.01], rx: 0.0022, ry: 0.0022 },
    { p: [0, 0, 0.004], rx: 0.0024, ry: 0.0026 },
    { p: [0, 0, -0.006], rx: 0.0018, ry: 0.0018 },
    { p: [0, 0, -0.014], rx: 0.0, ry: 0.0 },
  ], 6), { color: (p) => (p.z > 0 ? 0x8a8a86 : 0x4a4a4e) });
  // antennae
  for (const s of [-1, 1]) b.add(loft([{ p: [0, 0.001, 0.011], rx: 0.0004, ry: 0.0004 }, { p: [s * 0.004, 0.004, 0.02], rx: 0.0004, ry: 0.0004 }, { p: [s * 0.005, 0.0045, 0.022], rx: 0.0009, ry: 0.0009 }], 3), { color: 0x3a3a3e });
  for (const s of [-1, 1]) {
    const part = s < 0 ? 2 : 3;
    const mirror = (g) => {
      if (s > 0) return g;
      g.scale(-1, 1, 1);
      const ix = g.index.array;
      for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
      return g;
    };
    // forewing: a rounded triangle, the sooty tip and a black dot
    const fore = mirror(sheet([[0.001, 0.005], [0.01, 0.012], [0.02, 0.016], [0.028, 0.013], [0.031, 0.006], [0.026, -0.001], [0.015, -0.004], [0.002, -0.002]], 0.0006));
    b.add(fore, {
      part, pivot: [0, 0, 0],
      color: (p, n, l) => {
        const x = Math.abs(l.x);
        if (x > 0.022 && l.z > 0.007) return 0x55555c;
        if (Math.hypot(x - 0.018, l.z - 0.004) < 0.0028) return 0x3c3c42;
        if (x < 0.006) return 0xc8c8c0;
        return 0xf7f5ea;
      },
    });
    // hindwing: rounder, a cream-yellow wash
    const hind = mirror(sheet([[0.001, -0.002], [0.012, -0.003], [0.022, -0.008], [0.023, -0.016], [0.016, -0.022], [0.007, -0.02], [0.001, -0.011]], 0.0006));
    b.add(hind, { part, pivot: [0, -0.0003, 0], color: (p, n, l) => (Math.abs(l.x) < 0.005 ? 0xd4d2c4 : 0xf6f2de) });
  }
  return b.build();
}

const RIG = /* glsl */`
void rig(inout vec3 p, inout vec3 n) {
  float a = aPose.x;
  if (isPart(2.0) || isPart(3.0)) {
    float s = isPart(2.0) ? -1.0 : 1.0;
    // the hindwing lags the forewing a touch
    float lag = p.z < -0.001 ? 0.12 : 0.0;
    p = rotZ(p, s * (a - lag));
    n = rotZ(n, s * (a - lag));
  }
}
`;

/**
 * @param patches [{ x, z, y (the flowers' tops), n, r }]
 */
export function buildButterflies(ctx, { patches }) {
  const A = ANIMALS.butterflies;
  const r = rngKit(9901);
  const geo = butterflyGeometry();
  const mat = animalMaterial({ key: 'butterfly', rig: RIG, tint: 0xb4aecb, bands: 'soft3', transparent: true });
  // drawn after the ground and not into the depth the ink reads: at a few
  // pixels across, an inked butterfly is a black speck, not a white one
  mat.depthWrite = false;
  const count = patches.reduce((a, p) => a + p.n, 0);
  const herd = new Herd(ctx, geo, mat, count, 'butterflies');
  herd.mesh.renderOrder = 4;
  const list = [];
  for (const h of patches) {
    for (let k = 0; k < h.n; k++) {
      const x = h.x + r.range(-h.r, h.r), z = h.z + r.range(-h.r, h.r);
      const sit = k === 0;          // one of each patch starts sat on a flower
      list.push({
        h, x, z, y: sit ? h.y : h.y + r.range(0.25, 0.9), yaw: r.range(0, 6.28), vx: 0, vy: 0, vz: 0,
        state: sit ? 'sit' : 'fly', t: r.range(1, 6), flap: r.range(0, 6), wing: sit ? 1.45 : 0.4, seed: r.range(0, 100), goal: null,
      });
    }
  }
  const place = (b, i) => {
    herd.set(i, b.x, b.y, b.z, b.yaw, b.state === 'fly' ? -0.25 : 0, b.state === 'fly' ? Math.sin(b.flap * 0.23) * 0.3 : 0, A.size);
    herd.setPose(i, b.wing, 0, 0, 0);
  };
  list.forEach(place);
  herd.flush();

  function update(dt, cam) {
    list.forEach((b, i) => {
      if (Math.hypot(b.x - cam.x, b.z - cam.z) > A.near) return;
      b.t -= dt;
      const h = b.h;
      if (b.state === 'fly') {
        // flutter: a quick beat, and a path that wanders and bobs
        b.flap += dt * A.beatHz * Math.PI * 2;
        b.wing = 0.55 + Math.sin(b.flap) * 0.95;
        if (!b.goal || b.t <= 0 || Math.hypot(b.goal.x - b.x, b.goal.z - b.z) < 0.2) {
          b.goal = { x: h.x + r.range(-h.r, h.r), z: h.z + r.range(-h.r, h.r), y: h.y + r.range(0.2, 1.0) };
          b.t = r.range(1.5, 4);
          if (r.chance(0.28)) { b.state = 'land'; b.goal.y = h.y; b.t = 6; }
        }
        const s = b.seed;
        const wob = 1.4;
        const ax = (b.goal.x - b.x) * 0.9 + Math.sin(b.flap * 0.11 + s) * wob;
        const az = (b.goal.z - b.z) * 0.9 + Math.cos(b.flap * 0.13 + s * 1.3) * wob;
        const ay = (b.goal.y - b.y) * 1.5 + Math.sin(b.flap * 0.5) * 1.6;
        b.vx += (ax - b.vx) * Math.min(1, dt * 3);
        b.vz += (az - b.vz) * Math.min(1, dt * 3);
        b.vy += (ay - b.vy) * Math.min(1, dt * 4);
        const sp = Math.hypot(b.vx, b.vz);
        if (sp > A.speed) { b.vx *= A.speed / sp; b.vz *= A.speed / sp; }
        b.x += b.vx * dt; b.z += b.vz * dt; b.y = Math.max(h.y + 0.08, b.y + b.vy * dt * 0.5);
        if (sp > 0.05) b.yaw = Math.atan2(b.vx, b.vz);
      } else if (b.state === 'land') {
        b.flap += dt * A.beatHz * Math.PI * 2;
        b.wing = 0.55 + Math.sin(b.flap) * 0.9;
        const dx = b.goal.x - b.x, dz = b.goal.z - b.z, dy = b.goal.y - b.y;
        const d = Math.hypot(dx, dz, dy);
        const k = Math.min(1, dt * 1.8);
        b.x += dx * k; b.z += dz * k; b.y += dy * k;
        if (Math.hypot(dx, dz) > 0.02) b.yaw = Math.atan2(dx, dz);
        if (d < 0.03 || b.t <= 0) { b.state = 'sit'; b.t = r.range(3, 9); b.y = b.goal.y; }
      } else if (b.state === 'sit') {
        // wings shut upright, opened slowly now and then to the sun
        b.flap += dt * 1.2;
        b.wing = 1.45 - Math.max(0, Math.sin(b.flap)) * 0.8;
        const near = Math.hypot(b.x - cam.x, b.z - cam.z) < A.shy;
        if (b.t <= 0 || near) { b.state = 'fly'; b.goal = null; b.vy = 1.2; b.t = 0; }
      }
      place(b, i);
    });
    herd.flush();
  }
  return { update, herd, list };
}
