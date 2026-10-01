import * as THREE from 'three';
import { rngKit } from '../../core/util.js';
import { ANIMALS } from '../../config.js';
import { Body, loft, blob, sheet, limb, at } from './shapes.js';
import { animalMaterial, Herd, ease, turn } from './shade.js';

/* ------------------------------------------------------------------ *
 * ドバト, the station's pigeons: blue-grey, a green-and-violet sheen on the
 * neck, two black bars on the wing, pink feet.  They walk with the
 * pigeon's nod (the head held still in the air while the body catches up,
 * then thrust forward), peck, turn, and keep a pace or two ahead of
 * someone standing near.  Walk through them and the flock goes up with a
 * clatter to the station's roof edge (or the wires on the spine), sits a
 * while, and drifts back down in ones and twos once you have moved on.
 *
 * Parts: 0 body, 1 head and neck, 2 wings (spread by morph), 3/4 legs.
 * aPose  x head thrust (m), y peck, z wings spread, w wingbeat angle
 * aPose2 x legs tucked, y walk phase, z step angle, w plumage (0 blue-bar,
 *        1 chequer, 2 dark, 3 pale)
 * ------------------------------------------------------------------ */

const GREY = 0x8e93a3, WING = 0xaeb2bd, HEAD = 0x747a8c, BAR = 0x2c2e36;

function pigeonGeometry() {
  const b = new Body();
  // body: plump, the breast up and forward
  b.add(loft([
    { p: [0, 0.1, -0.12], rx: 0.02, ry: 0.015 },
    { p: [0, 0.105, -0.09], rx: 0.048, ry: 0.04 },
    { p: [0, 0.11, -0.03], rx: 0.068, ry: 0.066 },
    { p: [0, 0.125, 0.03], rx: 0.07, ry: 0.074 },
    { p: [0, 0.145, 0.07], rx: 0.058, ry: 0.066 },
    { p: [0, 0.165, 0.095], rx: 0.035, ry: 0.04 },
    { p: [0, 0.175, 0.105], rx: 0.0, ry: 0.0 },
  ], 10), {
    color: (p) => {
      // the neck's sheen at the front, a pale rump, grey below
      if (p.z > 0.06 && p.y > 0.13) return Math.abs(p.x) > 0.02 ? (p.y > 0.155 ? 0x5a8a78 : 0x7a6690) : 0x6f7486;
      if (p.z < -0.07 && p.y > 0.1) return 0xb9bcc6;
      return GREY;
    },
  });
  // the tail: a closed fan, grey with a dark band at the end
  b.add(sheet([[-0.028, 0], [0.028, 0], [0.036, -0.12], [-0.036, -0.12]], 0.008), {
    matrix: at(0, 0.108, -0.1, -0.18), color: (p, n, l) => (l.z < -0.095 ? 0x33353e : 0x8a8fa0),
  });
  // folded wings on the flanks: pale grey, two black bars, dark primaries at the back
  for (const s of [-1, 1]) {
    b.add(blob(0.03, 0.05, 0.11, 8, 6), {
      matrix: at(s * 0.05, 0.13, -0.035, -0.12, s * 0.08, 0),
      color: (p) => (p.z < -0.1 ? 0x4a4d58 : (Math.abs(p.z + 0.02) < 0.009 || Math.abs(p.z + 0.048) < 0.009) && p.y < 0.15 ? BAR : WING),
    });
  }
  // spread wings (hidden in the body while folded)
  for (const s of [-1, 1]) {
    const span = 0.3, chord = 0.12;
    const out = [[0, 0.5], [0.4, 0.55], [0.75, 0.35], [1.0, 0.0], [0.9, -0.2], [0.55, -0.45], [0.2, -0.55], [0, -0.5]];
    const g = sheet(out.map(([u, v]) => [u * span, v * chord]), 0.004);
    if (s < 0) {
      g.scale(-1, 1, 1);
      const ix = g.index.array;
      for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
      const Nn = g.attributes.normal;
      for (let i = 0; i < Nn.count; i++) Nn.setX(i, -Nn.getX(i));
    }
    const sh = [s * 0.04, 0.15, 0.03];
    b.add(g, {
      matrix: at(sh[0], sh[1] - 0.02, sh[2] - 0.03, 0, 0, 0, 0.05), morph: at(sh[0], sh[1], sh[2]), part: 2, pivot: sh,
      color: (p, n, l) => { const u = Math.abs(l.x) / span; return u > 0.62 ? 0x3e414c : (u < 0.5 && Math.abs(l.z + 0.01) < 0.012) ? BAR : WING; },
    });
  }
  // neck and head (they nod as one)
  const pivot = [0, 0.16, 0.08];
  b.add(loft([
    { p: [0, 0.15, 0.075], rx: 0.036, ry: 0.036 },
    { p: [0, 0.185, 0.1], rx: 0.03, ry: 0.03 },
    { p: [0, 0.205, 0.108], rx: 0.0, ry: 0.0 },
  ], 10, [0, 0, 1]), { part: 1, pivot, color: (p) => (Math.abs(p.x) > 0.012 ? (p.y > 0.175 ? 0x4f8c72 : 0x7d6096) : 0x6a7082) });
  b.add(blob(0.026, 0.026, 0.032, 10, 7), { matrix: at(0, 0.21, 0.115), part: 1, pivot, color: HEAD });
  // bill: dark, a white cere at its root
  b.add(loft([{ p: [0, 0.208, 0.14], rx: 0.007, ry: 0.007 }, { p: [0, 0.203, 0.156], rx: 0.004, ry: 0.004 }, { p: [0, 0.2, 0.165], rx: 0, ry: 0 }], 6),
    { part: 1, pivot, color: (p) => (p.z < 0.146 ? 0xe8e6e2 : 0x3a3438) });
  for (const s of [-1, 1]) {
    b.add(blob(0.007, 0.007, 0.007, 6, 4), { matrix: at(s * 0.02, 0.215, 0.127), part: 1, pivot, color: 0xd8662c });
    b.add(blob(0.0035, 0.0035, 0.0035, 5, 3), { matrix: at(s * 0.0255, 0.215, 0.13), part: 1, pivot, color: 0x121014 });
  }
  // legs: short, pink-red, three toes forward and one back
  for (const s of [-1, 1]) {
    const part = s < 0 ? 3 : 4;
    const hip = [s * 0.024, 0.075, 0.01], foot = [s * 0.026, 0.006, 0.02];
    b.add(limb(hip, foot, 0.009, 0.006, 5), { part, pivot: hip, color: 0xc8616a });
    for (const a of [-0.45, 0, 0.45, Math.PI]) {
      const len = a === Math.PI ? 0.018 : 0.03;
      b.add(limb([foot[0], 0.004, foot[2]], [foot[0] + Math.sin(a) * len, 0.003, foot[2] + Math.cos(a) * len], 0.0035, 0.0025, 4), { part, pivot: hip, color: 0xc8616a });
    }
  }
  return b.build();
}

const RIG = /* glsl */`
void rig(inout vec3 p, inout vec3 n) {
  float thrust = aPose.x, peck = aPose.y, wings = aPose.z, beat = aPose.w;
  float tuck = aPose2.x, walk = aPose2.y, step = aPose2.z;
  if (isPart(1.0)) {
    vec3 q = p - aJoint.xyz;
    q = rotX(q, peck);
    n = rotX(n, peck);
    p = aJoint.xyz + q + vec3(0.0, -abs(thrust) * 0.3, thrust);
  }
  if (isPart(2.0)) {
    p += aMorph * wings;
    vec3 q = p - aJoint.xyz;
    float s = sign(q.x);
    q = rotZ(q, s * beat);
    n = rotZ(n, s * beat);
    p = aJoint.xyz + q;
  }
  if (isPart(3.0) || isPart(4.0)) {
    float side = isPart(3.0) ? 0.0 : 3.14159;
    vec3 q = p - aJoint.xyz;
    float a = step * sin(walk + side);
    float lift = max(0.0, cos(walk + side)) * step;
    q.y += lift * smoothstep(0.02, 0.07, -q.y) * 0.05;
    q = rotX(q, -a - tuck * 1.3);
    n = rotX(n, -a - tuck * 1.3);
    p = aJoint.xyz + q;
  }
}
`;

const FRAG = /* glsl */`
{
  float plum = vPose2.w;
  bool feather = vPart < 2.5;
  vec3 c = diffuseColor.rgb;
  if (feather) {
    float grey = dot(c, vec3(0.3, 0.55, 0.15));
    if (plum > 0.5 && plum < 1.5) c = mix(c, c * (0.62 + 0.38 * step(0.5, fract(vLocal.z * 45.0 + step(0.0, vLocal.x) * 0.5))), step(0.12, grey) * step(abs(vLocal.x), 0.075) * step(0.1, vLocal.y));
    else if (plum > 1.5 && plum < 2.5) c *= 0.55;
    else if (plum > 2.5) c = mix(c, vec3(0.93, 0.92, 0.9), 0.55);
  }
  diffuseColor.rgb = c;
}
`;

/**
 * @param flocks [{ x, z, y, n, r, perches: [{ x, y, z, ry }] }]
 */
/** For the pup (guide.js, Tan: "he does zoomies through the pigeons and scatters them"): where the flocks are and how
 *  many of each are down on the ground (the town's own frame), and `scare`: a second thing that flushes them, set to
 *  where the pup is ({ x, z }, the town's frame) while it charges, else null. */
export const PIGEONS = { flocks: [], scare: null };

export function buildPigeons(ctx, { flocks, shadows, bounds }) {
  const A = ANIMALS.pigeons;
  const r = rngKit(9701);
  const geo = pigeonGeometry();
  const mat = animalMaterial({ key: 'pigeon', rig: RIG, frag: FRAG, tint: 0x6a6490 });
  const count = flocks.reduce((a, f) => a + f.n, 0);
  const herd = new Herd(ctx, geo, mat, count, 'pigeons', { bounds });
  const list = [];
  for (const f of flocks) {
    for (let k = 0; k < f.n; k++) {
      let x, z;
      do { x = f.x + r.range(-f.r, f.r); z = f.z + r.range(-f.r, f.r); } while (f.avoid?.(x, z));
      list.push({
        f, x, z, y: f.y, yaw: r.range(0, 6.28), state: 'walk', t: r.range(0, 3), speed: 0, want: 0,
        walk: r.range(0, 6), step: 0, thrust: 0, peck: 0, peckT: 0, wings: 0, beat: 0, tuck: 0, pitch: 0,
        plum: [0, 0, 0, 1, 0, 1, 2, 0, 3, 0][list.length % 10], shadow: shadows.slot(), goal: null, size: r.range(0.92, 1.06),
      });
    }
  }
  const place = (b, i) => {
    herd.set(i, b.x, b.y, b.z, b.yaw, b.pitch, 0, b.size);
    herd.setPose(i, b.thrust, b.peck, b.wings, b.beat);
    herd.setPose2(i, b.tuck, b.walk, b.step, b.plum);
    // the shadow on the ground under it (smaller and fainter as it climbs)
    const up = b.y - b.f.y;
    const k = b.state === 'perch' ? 0 : Math.max(0, 1 - up / 3);
    shadows.set(b.shadow, b.x, b.f.y, b.z, 0.07 * k * b.size, 0.12 * k * b.size, b.yaw);
  };
  list.forEach(place);
  herd.flush();
  PIGEONS.flocks = flocks.map((f) => ({ x: f.x, z: f.z, r: f.r, grounded: () => list.reduce((n, b) => n + (b.f === f && (b.state === 'walk' || b.state === 'peck') ? 1 : 0), 0) }));

  const lastCam = { x: 0, z: 0, v: 0, ok: false };
  function update(dt, cam) {
    // how fast the player is moving (walking through them is what flushes them)
    if (lastCam.ok && dt > 0) lastCam.v = lastCam.v * 0.8 + 0.2 * Math.hypot(cam.x - lastCam.x, cam.z - lastCam.z) / dt;
    lastCam.x = cam.x; lastCam.z = cam.z; lastCam.ok = true;
    for (const f of flocks) {
      const members = list.filter((b) => b.f === f);
      const close = members.some((b) => b.state !== 'perch' && b.state !== 'fly' && Math.hypot(b.x - cam.x, b.z - cam.z) < A.flush && Math.abs(cam.y - 1.6 - b.y) < 1.5);
      // (or the pup tearing through them)
      const dog = PIGEONS.scare;
      const charged = !!dog && members.some((b) => b.state !== 'perch' && b.state !== 'fly' && b.state !== 'wait' && Math.hypot(b.x - dog.x, b.z - dog.z) < A.flush);
      if ((close && lastCam.v > A.flushSpeed) || charged) {
        // up they go, not quite all at once
        for (const b of members) {
          if (b.state === 'fly' || b.state === 'perch') continue;
          const p = f.perches[Math.floor(r.next() * f.perches.length)];
          b.state = 'wait'; b.t = r.range(0, 0.35);
          b.to = { x: p.x + r.range(-0.5, 0.5) * (p.along ?? 0), y: p.y, z: p.z, ry: p.ry };
        }
      }
      f.gone = Math.hypot(f.x - cam.x, f.z - cam.z) > A.back;
    }
    list.forEach((b, i) => {
      b.t -= dt;
      const d = Math.hypot(b.x - cam.x, b.z - cam.z);
      if (b.state === 'wait' && b.t <= 0) {
        Object.assign(b, { state: 'fly', u: 0, from: { x: b.x, y: b.y, z: b.z }, dur: Math.hypot(b.to.x - b.x, b.to.z - b.z, b.to.y - b.y) / A.flySpeed + 0.6 });
      }
      if (b.state === 'walk' || b.state === 'peck') {
        // keep a pace or two from someone standing near
        const shy = d < A.shy;
        if (shy) {
          const away = Math.atan2(b.x - cam.x, b.z - cam.z);
          b.goal = { x: b.x + Math.sin(away) * 1.2, z: b.z + Math.cos(away) * 1.2 };
          b.state = 'walk'; b.hurry = true;
        } else b.hurry = false;
        if (b.t <= 0 && !shy) {
          const roll = r.next();
          if (roll < 0.45) { b.state = 'peck'; b.t = r.range(0.8, 2.4); b.peckT = 0; b.goal = null; }
          else {
            b.state = 'walk'; b.t = r.range(1.2, 3.5);
            const a = b.yaw + r.range(-1.6, 1.6), dist = r.range(0.3, 1.2);
            let gx = b.x + Math.sin(a) * dist, gz = b.z + Math.cos(a) * dist;
            if (Math.hypot(gx - b.f.x, gz - b.f.z) > b.f.r) { gx = b.f.x + r.range(-1, 1); gz = b.f.z + r.range(-1, 1); }
            b.goal = b.f.avoid?.(gx, gz) ? null : { x: gx, z: gz };
          }
        }
        if (b.state === 'walk' && b.goal) {
          const want = Math.atan2(b.goal.x - b.x, b.goal.z - b.z);
          const dy = turn(b.yaw, want);
          b.yaw += THREE.MathUtils.clamp(dy * 4, -4, 4) * dt;
          b.want = Math.abs(dy) > 0.9 ? 0.04 : b.hurry ? A.walkSpeed * 1.8 : A.walkSpeed;
          if (Math.hypot(b.goal.x - b.x, b.goal.z - b.z) < 0.06) { b.goal = null; b.want = 0; }
        } else b.want = 0;
        if (b.state === 'peck') {
          // two or three quick pecks at the ground
          b.peckT += dt;
          const c = b.peckT % 0.55;
          b.peck = c < 0.28 ? Math.sin((c / 0.28) * Math.PI) * 1.25 : 0;
        } else b.peck += (0 - b.peck) * Math.min(1, dt * 10);
        b.speed += (b.want - b.speed) * Math.min(1, dt * 6);
        const nx = b.x + Math.sin(b.yaw) * b.speed * dt, nz = b.z + Math.cos(b.yaw) * b.speed * dt;
        if (!b.f.avoid?.(nx, nz)) { b.x = nx; b.z = nz; } else b.goal = null;
        // the nod: the head holds still in the air, then is thrust forward
        const stepLen = 2 * 0.075 * Math.sin(A.stepAngle);
        b.walk += (b.speed * dt) / stepLen * Math.PI;
        b.step += ((b.speed > 0.02 ? A.stepAngle : 0) - b.step) * Math.min(1, dt * 8);
        const u = ((b.walk / Math.PI) % 1 + 1) % 1;
        const amp = 0.35 * stepLen;
        b.thrust = b.speed > 0.02 ? (u < 0.7 ? amp - (u / 0.7) * 2 * amp : -amp + ((u - 0.7) / 0.3) * 2 * amp) : b.thrust * (1 - Math.min(1, dt * 6));
        b.y = b.f.y;
        b.wings += (0 - b.wings) * Math.min(1, dt * 4);
        b.beat += (0 - b.beat) * Math.min(1, dt * 4);
        b.tuck += (0 - b.tuck) * Math.min(1, dt * 6);
        b.pitch += (0 - b.pitch) * Math.min(1, dt * 6);
      } else if (b.state === 'fly') {
        b.u += dt / b.dur;
        const u = Math.min(1, b.u);
        const e = ease(u);
        const up = b.to.y > b.from.y;
        // up steeply and clattering; down in a glide, wings raised to land
        const lift = up ? Math.sin(Math.min(1, u * 1.6) * Math.PI / 2) : 1 - (1 - u) * (1 - u);
        b.x = b.from.x + (b.to.x - b.from.x) * e;
        b.z = b.from.z + (b.to.z - b.from.z) * e;
        b.y = b.from.y + (b.to.y - b.from.y) * lift + Math.sin(u * Math.PI) * (up ? 0.3 : 0.6);
        b.yaw += turn(b.yaw, Math.atan2(b.to.x - b.from.x, b.to.z - b.from.z)) * Math.min(1, dt * 8);
        b.wings = 1;
        b.tuck = 1;
        const glide = !up && u > 0.2 && u < 0.8;
        b.flap = (b.flap ?? 0) + dt * (glide ? 0 : up ? 8.5 : 6) * Math.PI * 2;
        b.beat = glide ? 0.22 : Math.sin(b.flap) * 0.85 + (u > 0.85 ? 0.5 : 0.1);
        b.pitch = up ? -0.35 * (1 - u) : u > 0.8 ? -0.5 : 0.15;
        b.thrust = 0; b.peck = 0; b.step = 0;
        if (u >= 1) {
          b.x = b.to.x; b.y = b.to.y; b.z = b.to.z;
          if (up) { b.state = 'perch'; b.t = r.range(A.sit[0], A.sit[1]); b.yawTo = b.to.ry; b.pitch = 0; }
          else { b.state = 'walk'; b.t = r.range(0.5, 2); b.goal = null; }
        }
      } else if (b.state === 'perch') {
        b.wings += (0 - b.wings) * Math.min(1, dt * 5);
        b.beat += (0 - b.beat) * Math.min(1, dt * 5);
        b.tuck += (0.4 - b.tuck) * Math.min(1, dt * 4);
        b.yaw += turn(b.yaw, b.yawTo) * Math.min(1, dt * 3);
        b.pitch += (0 - b.pitch) * Math.min(1, dt * 5);
        if (b.t <= 0 && b.f.gone) {
          // back down, one at a time
          let gx, gz;
          do { gx = b.f.x + r.range(-b.f.r, b.f.r); gz = b.f.z + r.range(-b.f.r, b.f.r); } while (b.f.avoid?.(gx, gz));
          Object.assign(b, { state: 'fly', u: 0, from: { x: b.x, y: b.y, z: b.z }, to: { x: gx, y: b.f.y, z: gz } });
          b.dur = Math.hypot(gx - b.x, gz - b.z, b.y - b.f.y) / (A.flySpeed * 0.8) + 0.8;
        } else if (b.t <= 0) b.t = r.range(2, 5);
      }
      place(b, i);
    });
    herd.flush();
  }
  return { update, herd, list };
}
