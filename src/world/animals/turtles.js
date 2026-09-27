import * as THREE from 'three';
import { rngKit } from '../../core/util.js';
import { ANIMALS } from '../../config.js';
import { Body, loft, blob, sheet, at } from './shapes.js';
import { animalMaterial, Herd, ease, turn, painted } from './shade.js';

/* ------------------------------------------------------------------ *
 * Turtles on 鏡池's stones: pond sliders (the ones every Japanese park
 * pond has), basking in a row with their necks out and their hind legs
 * stretched back.  Come within a few metres and they slip off, one after
 * another, with a plop and a ring; a little later a head shows here and
 * there in the water, and when you have gone they climb back up.
 * ------------------------------------------------------------------ */

const OLIVE = 0x6a6a44, OLIVE_D = 0x4a4c30, RIM = 0x8a8448, YELLOW = 0xe0c860, SKIN = 0x4c5636, RED = 0xd0442e;

/* part ids: 0 shell, 1 head and neck, 2 front legs, 3 hind legs, 4 tail */
function turtleGeometry() {
  const b = new Body();
  // the carapace: a low dome, scutes in darker seams, a pale rim
  const dome = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(0.092, 0.05, 0.118);
  b.add(dome, {
    matrix: at(0, 0.03, 0),
    color: (p) => {
      if (p.y < 0.036) return RIM;
      // the scutes: a row down the middle and a row either side
      const seamZ = Math.abs(Math.sin((p.z + 0.02) * 40)) < 0.16;
      const seamX = Math.abs(Math.abs(p.x) - 0.035) < 0.006;
      if ((seamZ && p.y > 0.045) || seamX) return OLIVE_D;
      // a yellow fleck or two on each scute
      if (Math.abs(Math.sin(p.x * 90) * Math.sin(p.z * 70)) > 0.93 && p.y > 0.05) return 0x8a8a3e;
      return OLIVE;
    },
  });
  // the plastron, flat and yellow, and the bridge between
  b.add(blob(0.086, 0.018, 0.11, 14, 5), { matrix: at(0, 0.028, 0), color: (p) => (p.y < 0.03 ? 0xc8b86a : RIM) });
  // neck and head: a stripy neck out of the shell, the head held up
  const neck = loft([
    { p: [0, 0.03, 0.07], rx: 0.024, ry: 0.02 },
    { p: [0, 0.036, 0.11], rx: 0.02, ry: 0.018 },
    { p: [0, 0.048, 0.14], rx: 0.018, ry: 0.017 },
    { p: [0, 0.058, 0.16], rx: 0.019, ry: 0.018 },
    { p: [0, 0.061, 0.178], rx: 0.016, ry: 0.015 },
    { p: [0, 0.059, 0.192], rx: 0.009, ry: 0.009 },
    { p: [0, 0.058, 0.197], rx: 0.0, ry: 0.0 },
  ], 9);
  b.add(neck, {
    part: 1, pivot: [0, 0.03, 0.08],
    color: (p) => {
      // the red-eared slider's red patch behind the eye
      if (p.z > 0.152 && p.z < 0.168 && Math.abs(p.x) > 0.012 && p.y > 0.052) return RED;
      // yellow stripes along the neck and head
      const k = Math.sin(Math.atan2(p.y - 0.045, p.x) * 5);
      return k > 0.55 ? YELLOW : SKIN;
    },
  });
  for (const s of [-1, 1]) b.add(blob(0.005, 0.005, 0.005, 6, 4), { matrix: at(s * 0.013, 0.066, 0.176), color: 0x141414, part: 1, pivot: [0, 0.03, 0.08] });
  // legs: front legs out and forward, hind legs stretched back (basking)
  for (const s of [-1, 1]) {
    const fl = loft([
      { p: [s * 0.05, 0.03, 0.07], rx: 0.018, ry: 0.012 },
      { p: [s * 0.085, 0.024, 0.095], rx: 0.016, ry: 0.01 },
      { p: [s * 0.11, 0.016, 0.11], rx: 0.02, ry: 0.007 },
      { p: [s * 0.123, 0.012, 0.118], rx: 0.0, ry: 0.0 },
    ], 7);
    b.add(fl, { part: 2, pivot: [s * 0.05, 0.03, 0.07], color: (p) => (Math.sin(p.z * 260) > 0.9 ? YELLOW : SKIN) });
    const hl = loft([
      { p: [s * 0.05, 0.028, -0.07], rx: 0.02, ry: 0.013 },
      { p: [s * 0.075, 0.02, -0.115], rx: 0.017, ry: 0.01 },
      { p: [s * 0.09, 0.012, -0.155], rx: 0.02, ry: 0.006 },
      { p: [s * 0.094, 0.01, -0.17], rx: 0.0, ry: 0.0 },
    ], 7);
    b.add(hl, { part: 3, pivot: [s * 0.05, 0.028, -0.07], color: (p) => (Math.sin(p.x * 300) > 0.9 ? YELLOW : SKIN) });
  }
  const tail = loft([{ p: [0, 0.03, -0.1], rx: 0.012, ry: 0.01 }, { p: [0, 0.024, -0.13], rx: 0.007, ry: 0.006 }, { p: [0, 0.02, -0.15], rx: 0, ry: 0 }], 6);
  b.add(tail, { part: 4, color: SKIN });
  return b.build();
}

const RIG = /* glsl */`
void rig(inout vec3 p, inout vec3 n) {
  float neck = aPose.x, look = aPose.y, paddle = aPose.z, swim = aPose.w;
  if (isPart(1.0)) {
    // the neck: drawn in (0) or stretched out and up (1), the head turning
    vec3 q = p - aJoint.xyz;
    q.z *= mix(0.45, 1.0, neck);
    q = rotX(q, -0.35 * neck);
    q = rotY(q, look);
    n = rotY(rotX(n, -0.35 * neck), look);
    p = aJoint.xyz + q;
  }
  if (isPart(2.0) || isPart(3.0)) {
    // legs: splayed on the stone; swimming, they paddle
    float s = sign(p.x);
    float front = isPart(2.0) ? 1.0 : -1.0;
    vec3 q = p - aJoint.xyz;
    float a = swim * sin(paddle + (front > 0.0 ? 0.0 : 3.14) + (s > 0.0 ? 0.0 : 3.14)) * 0.7;
    q = rotY(q, a * s);
    p = aJoint.xyz + q;
  }
}
`;

/** The basking stones, and the turtles on them. */
export function buildTurtles(ctx, { water, marks, shadows, reflect }) {
  const A = ANIMALS.turtles;
  const r = rngKit(9301);

  /* ---- the stones: rounded granite, flat on top, wet at the waterline ---- */
  const sb = new Body();
  const tops = [];
  A.stones.forEach(([x, z, w, d, h, yaw], k) => {
    const g = new THREE.IcosahedronGeometry(1, 3);
    const P = g.attributes.position;
    const rr = rngKit(9311 + k);
    const bumps = Array.from({ length: 9 }, () => [rr.range(-1, 1), rr.range(-0.2, 1), rr.range(-1, 1), rr.range(0.12, 0.3)]);
    for (let i = 0; i < P.count; i++) {
      let px = P.getX(i), py = P.getY(i), pz = P.getZ(i);
      // worn granite: lumps and hollows, a gently rounded top
      let s = 1;
      for (const [bx, by, bz, a] of bumps) s += a * Math.exp(-((px - bx) ** 2 + (py - by) ** 2 + (pz - bz) ** 2) * 3) * (bx > 0 ? 1 : -0.6);
      s += 0.06 * Math.sin(px * 9 + k) * Math.sin(pz * 8 - k) + 0.04 * Math.sin(py * 11 + px * 5);
      px *= s; py *= s; pz *= s;
      if (py > 0.75) py = 0.75 + (py - 0.75) * 0.4;
      P.setXYZ(i, px, py, pz);
    }
    g.computeVertexNormals();
    // the widest girth at the waterline, a rounded cap above it
    const SY = h / 0.85;
    const m = at(x, water, z, 0, yaw, 0, [w / 2, SY, d / 2]);
    sb.add(g, {
      matrix: m,
      color: (p) => (p.y < water + 0.035 ? 0x55524a : p.y < water + 0.075 ? 0x6f6b61 : Math.sin(p.x * 17 + p.z * 11) * Math.sin(p.z * 13) > 0.55 ? 0xa39d8e : 0x8c877b),
    });
    // the top's height at (px, pz), in the stone's own axes
    const heightAt = (px, pz) => {
      const dx = px - x, dz = pz - z;
      const lx = (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / (w / 2), lz = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / (d / 2);
      const py = Math.sqrt(Math.max(0, 1 - lx * lx - lz * lz));
      return water + (py > 0.75 ? 0.75 + (py - 0.75) * 0.4 : py) * SY;
    };
    tops.push({ x, z, y: water + h, w, d, yaw, heightAt });
  });
  const stoneGeo = sb.build();
  const stones = new THREE.Mesh(stoneGeo, painted());
  stones.name = 'animals-stones';
  stones.castShadow = true;
  stones.receiveShadow = true;
  stones.layers.enable(reflect);
  ctx.add(stones);

  /* ---- the turtles ---- */
  const geo = turtleGeometry();
  const mat = animalMaterial({ key: 'turtle', rig: RIG, tint: 0x5a5478 });
  const cx = tops.reduce((a, t) => a + t.x, 0) / tops.length, cz = tops.reduce((a, t) => a + t.z, 0) / tops.length;
  const herd = new Herd(ctx, geo, mat, A.count, 'turtles', { reflect, bounds: [cx, water, cz, 40] });
  const list = [];
  const big = tops.filter((t) => t.w >= 0.8);
  for (let i = 0; i < A.count; i++) {
    const st = big[i % big.length];
    const k = Math.floor(i / big.length);
    // a row along the stone's long side, facing out over the water (to the sun)
    const along = (k - 0.5 * (Math.ceil(A.count / big.length) - 1)) * 0.3;
    const x = st.x + Math.cos(st.yaw) * along + r.range(-0.05, 0.05);
    const z = st.z - Math.sin(st.yaw) * along + r.range(-0.05, 0.05);
    const yaw = st.yaw + r.range(-0.45, 0.45);
    const size = r.range(1.05, 1.4);
    const y = st.heightAt(x, z) - 0.01;
    list.push({ home: { x, z, y, yaw }, stone: st, x, z, y, yaw, pitch: 0, size, state: 'bask', t: r.range(0, 5), look: 0, lookTo: 0, neck: 1, swim: 0, pad: 0, shadow: shadows.slot(), delay: 0 });
  }
  const place = (b, i) => {
    herd.set(i, b.x, b.y, b.z, b.yaw, b.pitch, 0, b.hidden ? 0 : b.size);
    herd.setPose(i, b.neck, b.look, b.pad, b.swim);
    if (b.state === 'bask' || b.state === 'climb') shadows.set(b.shadow, b.x, b.stone.heightAt(b.x, b.z), b.z, 0.11 * b.size, 0.15 * b.size, b.yaw);
    else shadows.set(b.shadow, 0, 0, 0, 0, 0);
  };
  list.forEach(place);
  herd.flush();

  function update(dt, cam) {
    const alarmed = list.some((b) => b.state === 'bask' && Math.hypot(b.x - cam.x, b.z - cam.z) < A.flee);
    const gone = list.every((b) => Math.hypot(b.home.x - cam.x, b.home.z - cam.z) > A.back);
    list.forEach((b, i) => {
      b.t -= dt;
      if (b.state === 'bask') {
        b.neck += (1 - b.neck) * Math.min(1, dt * 2);
        if (b.t <= 0) { b.lookTo = r.range(-0.6, 0.6); b.t = r.range(2, 7); }
        b.look += (b.lookTo - b.look) * Math.min(1, dt * 1.5);
        // one goes, they all go (a stone's row, one after another)
        if (alarmed && Math.hypot(b.stone.x - cam.x, b.stone.z - cam.z) < A.flee + 2) {
          b.state = 'slip'; b.u = 0; b.delay = r.range(0, 0.9);
          // off the nearest edge, away from the player
          const away = Math.atan2(b.x - cam.x, b.z - cam.z);
          b.dir = away + r.range(-0.5, 0.5);
          b.from = { x: b.x, z: b.z, y: b.y, yaw: b.yaw };
        }
      } else if (b.state === 'slip') {
        if (b.delay > 0) { b.delay -= dt; b.neck += (0.3 - b.neck) * Math.min(1, dt * 6); }
        else {
          b.u += dt / 0.7;
          const e = ease(Math.min(1, b.u));
          b.yaw = b.from.yaw + turn(b.from.yaw, b.dir) * Math.min(1, b.u * 2.5);
          const reach = Math.max(b.stone.w, b.stone.d) * 0.45 + 0.25;
          b.x = b.from.x + Math.sin(b.dir) * reach * e;
          b.z = b.from.z + Math.cos(b.dir) * reach * e;
          b.pitch = 0.9 * ease(Math.min(1, b.u * 1.6));
          b.y = b.from.y - (b.from.y - water + 0.2) * e * e;
          if (b.u >= 1) {
            b.state = 'under'; b.hidden = true; b.t = r.range(4, 9);
            marks.ring(b.x, water, b.z, { r0: 0.05, r1: 0.8, life: 2.2, strength: 1 });
          }
        }
      } else if (b.state === 'under') {
        if (b.t <= 0) {
          // a head at the surface, a few metres off
          b.state = 'peek'; b.hidden = false; b.t = r.range(5, 12);
          const a = r.range(0, Math.PI * 2), d = r.range(2, 5);
          b.x = b.stone.x + Math.sin(a) * d; b.z = b.stone.z + Math.cos(a) * d;
          b.yaw = r.range(0, Math.PI * 2); b.y = water - 0.035; b.pitch = -0.25; b.neck = 0.8; b.swim = 0.4;
          marks.ring(b.x + Math.sin(b.yaw) * 0.18 * b.size, water, b.z + Math.cos(b.yaw) * 0.18 * b.size, { r0: 0.03, r1: 0.3, life: 1.5, strength: 0.6 });
        }
      } else if (b.state === 'peek') {
        b.pad += dt * 3;
        b.x += Math.sin(b.yaw) * 0.05 * dt; b.z += Math.cos(b.yaw) * 0.05 * dt;
        if (b.t <= 0) {
          if (gone) { b.state = 'climb'; b.u = 0; b.hidden = false; b.from = { x: b.x, z: b.z }; }
          else { b.state = 'under'; b.hidden = true; b.t = r.range(4, 10); }
        }
      } else if (b.state === 'climb') {
        // swim to the stone, then haul out onto it
        b.u += dt / 6;
        const e = ease(Math.min(1, b.u));
        b.x = b.from.x + (b.home.x - b.from.x) * e;
        b.z = b.from.z + (b.home.z - b.from.z) * e;
        b.yaw += turn(b.yaw, Math.atan2(b.home.x - b.from.x, b.home.z - b.from.z)) * Math.min(1, dt * 3);
        const out = Math.max(0, (b.u - 0.75) / 0.25);
        b.y = water - 0.035 + (b.home.y - water + 0.035) * ease(out);
        b.pitch = out > 0 && out < 1 ? -0.5 * Math.sin(out * Math.PI) : -0.25 * (1 - out);
        b.pad += dt * 4; b.swim = 1 - out;
        if (b.u >= 1) { Object.assign(b, { state: 'bask', x: b.home.x, z: b.home.z, y: b.home.y, pitch: 0, swim: 0, t: 1 }); b.yaw += turn(b.yaw, b.home.yaw); }
      }
      place(b, i);
    });
    herd.flush();
  }
  return { update, herd, list, stones };
}
