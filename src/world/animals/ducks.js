import * as THREE from 'three';
import { rngKit } from '../../core/util.js';
import { ANIMALS } from '../../config.js';
import { Body, loft, blob, at } from './shapes.js';
import { animalMaterial, Herd, ease, turn } from './shade.js';

/* ------------------------------------------------------------------ *
 * カルガモ, the spot-billed duck: Japan's everyday duck, on 鏡池 and the
 * river.  Scaly brown, a pale face with a dark crown and eye stripe, a
 * black bill tipped yellow, a white line of tertials along the flank.
 * They go about in pairs: paddle slowly with a small V of wake, dabble
 * (head down, and now and then bottoms up), preen, and paddle off if you
 * come right to the edge beside them.
 * ------------------------------------------------------------------ */

const BROWN = 0x76593f, PALE = 0xb09470, DARK = 0x3a2e26;

/* part ids: 0 body, 1 neck and head, 2 tail */
function duckGeometry() {
  const b = new Body();
  // the body afloat: a full breast rising to the neck, a flat back, the
  // stern drawn up to the tail's point (y 0 is the waterline)
  const S = [
    [-0.285, 0.085, 0.004, 0.003],
    [-0.26, 0.078, 0.03, 0.017],
    [-0.22, 0.066, 0.07, 0.04],
    [-0.15, 0.054, 0.104, 0.062],
    [-0.06, 0.048, 0.12, 0.074],
    [0.04, 0.05, 0.12, 0.078],
    [0.11, 0.058, 0.108, 0.078],
    [0.165, 0.07, 0.085, 0.07],
    [0.2, 0.08, 0.055, 0.052],
    [0.218, 0.085, 0.0, 0.0],
  ];
  const scaly = (p, base, pale) => {
    const ax = Math.abs(p.x);
    const u = p.z * 22 + (p.y * 24 + ax * 6), v = Math.floor(p.y * 28 + ax * 10);
    return (u + 0.5 * v) % 1 < 0.22 ? pale : base;
  };
  b.add(loft(S.map(([z, y, rx, ry]) => ({ p: [0, y, z], rx, ry })), 14), {
    color: (p) => {
      if (p.z < -0.215) return DARK;
      if (p.z > 0.13) return scaly(p, 0x86694c, 0xae936e);        // the breast, paler
      return scaly(p, BROWN, PALE);
    },
  });
  // the folded wings over the back: dark, pale-edged, a white line of
  // tertials along their lower edge, the primaries crossed over the tail
  for (const s of [-1, 1]) {
    b.add(blob(0.055, 0.03, 0.165, 12, 7), {
      matrix: at(s * 0.062, 0.1, -0.07, 0.06, s * 0.08, s * 0.28),
      color: (p) => {
        const ax = Math.abs(p.x);
        if (p.y < 0.093 && ax > 0.085 && p.z < -0.02 && p.z > -0.19) return 0xf0ece2;     // tertials
        if (p.y < 0.098 && p.y > 0.09 && ax > 0.075 && p.z < -0.08 && p.z > -0.13) return 0x4a5fb0;   // a glint of speculum
        return (p.z * 30 + ax * 20) % 1 < 0.2 ? 0x9a7e5c : 0x5e4632;
      },
    });
    b.add(blob(0.022, 0.012, 0.09, 8, 5), { matrix: at(s * 0.022, 0.108, -0.2, 0.12, -s * 0.18, 0), color: 0x3a2e26 });
  }
  // neck and head, turning about the neck's root
  const pivot = [0, 0.09, 0.14];
  const neck = loft([
    { p: [0, 0.05, 0.13], rx: 0.058, ry: 0.058 },
    { p: [0, 0.1, 0.16], rx: 0.052, ry: 0.05 },
    { p: [0, 0.145, 0.172], rx: 0.045, ry: 0.044 },
    { p: [0, 0.185, 0.178], rx: 0.04, ry: 0.04 },
    { p: [0, 0.21, 0.182], rx: 0.0, ry: 0.0 },
  ], 12, [0, 0, 1]);
  b.add(neck, { part: 1, pivot, color: (p) => (p.y > 0.155 ? 0xcfbd96 : p.y > 0.12 ? 0xb49a74 : 0x92785a) });
  const face = (p) => {
    if (p.y > 0.219) return 0x44372a;                                   // the dark crown
    if (p.y > 0.203 && p.y < 0.211 && p.z > 0.186) return 0x44372a;      // the eye stripe
    if (p.y > 0.187 && p.y < 0.193 && p.z > 0.2 && p.z < 0.236) return 0x8a7252;   // the cheek stripe
    return 0xe0d2ae;
  };
  b.add(blob(0.039, 0.042, 0.056, 14, 10), { matrix: at(0, 0.2, 0.192, -0.12), part: 1, pivot, color: face });
  // the bill: black, a yellow tip
  const bill = loft([
    { p: [0, 0.197, 0.228], rx: 0.02, ry: 0.013 },
    { p: [0, 0.19, 0.258], rx: 0.021, ry: 0.0085 },
    { p: [0, 0.184, 0.288], rx: 0.02, ry: 0.0065 },
    { p: [0, 0.182, 0.3], rx: 0.013, ry: 0.0045 },
    { p: [0, 0.181, 0.303], rx: 0.0, ry: 0.0 },
  ], 8);
  b.add(bill, { part: 1, pivot, color: (p) => (p.z > 0.28 ? 0xe8c53a : 0x24222a) });
  for (const s of [-1, 1]) b.add(blob(0.0075, 0.0075, 0.0075, 6, 4), { matrix: at(s * 0.035, 0.207, 0.206), part: 1, pivot, color: 0x121014 });
  // the tail's point, which waggles
  b.add(loft([{ p: [0, 0.075, -0.215], rx: 0.036, ry: 0.016 }, { p: [0, 0.088, -0.265], rx: 0.02, ry: 0.008 }, { p: [0, 0.096, -0.3], rx: 0, ry: 0 }], 8), { part: 2, pivot: [0, 0.075, -0.215], color: DARK });
  return b.build();
}

const RIG = /* glsl */`
void rig(inout vec3 p, inout vec3 n) {
  float dip = aPose.x, look = aPose.y, wag = aPose.z;
  if (isPart(1.0)) {
    vec3 q = p - aJoint.xyz;
    q = rotX(q, dip);
    q = rotY(q, look);
    n = rotY(rotX(n, dip), look);
    p = aJoint.xyz + q;
  }
  if (isPart(2.0)) {
    vec3 q = p - aJoint.xyz;
    q = rotY(q, wag);
    p = aJoint.xyz + q;
  }
}
`;

/**
 * Ducks on some water.  `groups`: [{ x, z, n, area(x, z) => bool,
 * water, flow }] (flow: the current, m/s along +x).
 */
export function buildDucks(ctx, { groups, marks, reflect, name = 'ducks', seed = 9401, bounds, wakeBase = 0 }) {
  const A = ANIMALS.ducks;
  const r = rngKit(seed);
  const geo = duckGeometry();
  const mat = animalMaterial({ key: 'duck', rig: RIG, tint: 0x5a5478 });
  const count = groups.reduce((a, g) => a + g.n, 0);
  const herd = new Herd(ctx, geo, mat, count, name, { reflect, bounds });
  const list = [];
  let w = wakeBase;
  for (const g of groups) {
    let lead = null;
    for (let k = 0; k < g.n; k++) {
      const d = {
        g, lead, x: g.x + k * 0.9, z: g.z + k * 0.5, y: g.water, yaw: r.range(0, 6.28), speed: 0, want: 0,
        state: 'paddle', t: r.range(0, 4), dip: 0, dipTo: 0, look: 0, lookTo: 0, wag: 0, bob: r.range(0, 6), pitch: 0, target: null,
        size: r.range(0.95, 1.05), wake: w++,
      };
      list.push(d);
      lead ??= d;
    }
  }
  const place = (d, i) => {
    herd.set(i, d.x, d.y + Math.sin(d.bob) * 0.004, d.z, d.yaw, d.pitch, Math.sin(d.bob * 0.7) * 0.03, d.size);
    herd.setPose(i, d.dip, d.look, d.wag, 0);
    marks.wake(d.wake, d.x - Math.sin(d.yaw) * 0.05, d.g.water, d.z - Math.cos(d.yaw) * 0.05, d.yaw, d.pitch > 0.3 ? 0 : d.speed * 4.5);
  };
  list.forEach(place);
  herd.flush();

  const pickTarget = (d) => {
    const g = d.g;
    for (let k = 0; k < 30; k++) {
      const x = d.lead ? d.lead.x + r.range(-1.4, 1.4) : g.x + r.range(-g.roam, g.roam);
      const z = d.lead ? d.lead.z + r.range(-1.4, 1.4) : g.z + r.range(-g.roam * 0.5, g.roam * 0.5);
      if (g.area(x, z)) { d.target = { x, z }; return; }
    }
    d.target = { x: g.x, z: g.z };
  };

  function update(dt, cam) {
    list.forEach((d, i) => {
      d.t -= dt;
      d.bob += dt * (1.2 + d.speed * 8);
      const near = Math.hypot(d.x - cam.x, d.z - cam.z);
      const shy = near < A.shy && Math.abs(cam.y - d.g.water) < 3.5;
      if (shy && d.state !== 'flee') {
        d.state = 'flee'; d.t = r.range(3, 5); d.pitch = 0; d.dipTo = 0;
        const away = Math.atan2(d.x - cam.x, d.z - cam.z);
        d.target = null;
        for (let k = 0; k < 12; k++) {
          const a = away + r.range(-0.7, 0.7), dist = r.range(3, 6);
          const x = d.x + Math.sin(a) * dist, z = d.z + Math.cos(a) * dist;
          if (d.g.area(x, z)) { d.target = { x, z }; break; }
        }
        d.target ??= { x: d.g.x, z: d.g.z };
      }
      if (d.state === 'paddle' || d.state === 'flee') {
        if (!d.target || Math.hypot(d.target.x - d.x, d.target.z - d.z) < 0.4) {
          if (d.state === 'flee') { d.state = 'paddle'; d.t = r.range(2, 5); }
          pickTarget(d);
          // now and then a pause for a dabble, or to preen
          if (d.state === 'paddle' && r.chance(0.5)) { d.state = r.chance(0.7) ? 'dabble' : 'preen'; d.t = r.range(4, 10); d.u = 0; }
        }
        const tx = d.target.x, tz = d.target.z;
        const wantYaw = Math.atan2(tx - d.x, tz - d.z);
        d.yaw += THREE.MathUtils.clamp(turn(d.yaw, wantYaw) * 1.5, -1.2, 1.2) * dt;
        const far = Math.hypot(tx - d.x, tz - d.z);
        d.want = d.state === 'flee' ? 0.45 : Math.min(0.14, far * 0.12);
        d.dipTo = 0; d.lookTo = Math.sin(d.bob * 0.13) * 0.3;
      } else if (d.state === 'dabble') {
        d.want = 0;
        d.u += dt;
        // head down to the water, up again; once in a while, bottoms up
        const cyc = d.u % 3.2;
        if (d.upend) {
          d.pitch += (1.05 - d.pitch) * Math.min(1, dt * 5);
          if (d.u > d.upend) { d.upend = 0; marks.ring(d.x, d.g.water, d.z, { r0: 0.1, r1: 0.5, life: 1.4, strength: 0.7 }); d.wagT = 1.2; }
        } else {
          d.pitch += (0 - d.pitch) * Math.min(1, dt * 4);
          d.dipTo = cyc < 1.4 ? 1.15 : -0.1;
          if (cyc < dt * 1.5 && r.chance(0.35) && d.g.upend) {
            d.upend = d.u + r.range(1.8, 3.4);
            marks.ring(d.x + Math.sin(d.yaw) * 0.15, d.g.water, d.z + Math.cos(d.yaw) * 0.15, { r0: 0.1, r1: 0.55, life: 1.5, strength: 0.8 });
          }
        }
        if (d.t <= 0 && !d.upend) { d.state = 'paddle'; d.target = null; }
      } else if (d.state === 'preen') {
        d.want = 0;
        d.u += dt;
        // the bill back into the flank feathers, a shake, again
        const k = Math.floor(d.u / 1.6) % 2;
        d.lookTo = (k ? 1 : -1) * 2.3;
        d.dipTo = 0.9;
        if (d.t <= 0) { d.state = 'paddle'; d.target = null; d.lookTo = 0; d.dipTo = 0; d.wagT = 1; }
      }
      // tail waggle after coming up or a preen
      if (d.wagT > 0) { d.wagT -= dt; d.wag = Math.sin(d.wagT * 28) * 0.35 * d.wagT; } else d.wag = 0;
      d.speed += (d.want - d.speed) * Math.min(1, dt * (d.state === 'flee' ? 2.5 : 1));
      const flow = d.g.flow ?? 0;
      const nx = d.x + Math.sin(d.yaw) * d.speed * dt + (d.state === 'paddle' || d.state === 'flee' ? 0 : flow * dt * 0.3);
      const nz = d.z + Math.cos(d.yaw) * d.speed * dt;
      if (d.g.area(nx, nz)) { d.x = nx; d.z = nz; } else { d.target = null; d.state = 'paddle'; }
      d.dip += (d.dipTo - d.dip) * Math.min(1, dt * 3);
      d.look += (d.lookTo - d.look) * Math.min(1, dt * 2.5);
      if (d.state !== 'dabble') d.pitch += (0 - d.pitch) * Math.min(1, dt * 4);
      place(d, i);
    });
    herd.flush();
  }
  return { update, herd, list };
}
