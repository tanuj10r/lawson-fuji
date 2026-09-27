import * as THREE from 'three';
import { rngKit } from '../../core/util.js';
import { ANIMALS } from '../../config.js';
import { Body, loft, blob, sheet, limb, at, spine } from './shapes.js';
import { animalMaterial, Herd, ease, turn, reflectionOf } from './shade.js';

/* ------------------------------------------------------------------ *
 * The wading birds: the grey heron (アオサギ) standing like a post in the
 * river's shallows, and little egrets (コサギ) stepping through the flooded
 * paddies in twos and threes.  One body plan, drawn twice:
 *
 *   heron   grey back, white neck streaked black down the front, a black
 *           stripe from the eye to a thin black plume, a yellow dagger
 *           bill, yellowish legs; 1.7 m of arched grey-and-black wings
 *   egret   all white, a black bill and legs with yellow feet, two long
 *           nape plumes and lace down the back in April
 *
 * Parts: 0 body, 1 neck and head, 2 wings, 3 left leg, 4 right leg.
 * aPose  x neck (0 drawn in, 1 stretched out to strike), y wings (0
 *        folded, 1 spread), z the wingbeat's angle, w head turn
 * aPose2 x legs trailed back (flight), y walk phase, z step size, w lift
 * ------------------------------------------------------------------ */

function waderGeometry(o) {
  const b = new Body();
  const k = o.scale;                 // everything is drawn heron-sized, then scaled
  const hipY = 0.5 * k;
  // the body: a long ellipsoid tilted up at the front, the folded wings' colours on it
  const tilt = o.tilt;
  const [bx, by, bz] = o.body ?? [1, 1, 1];
  b.add(blob(0.085 * k * bx, 0.095 * k * by, 0.21 * k * bz, 14, 10), {
    matrix: at(0, 0.6 * k, 0, -tilt, 0, 0),
    color: (p) => o.bodyColor(p, k),
  });
  // the tail: short, under the wingtips
  b.add(blob(0.045 * k, 0.016 * k, 0.07 * k, 8, 5), { matrix: at(0, 0.56 * k, -0.15 * k, -tilt + 0.1, 0, 0), color: o.tail });
  // neck: an S from the shoulders to the head; extended (morph) it reaches forward and down
  const retracted = o.neck.map(([y, z]) => [0, y * k, z * k]);
  const extended = o.neckOut.map(([y, z]) => [0, y * k, z * k]);
  const N = 9;
  const sR = spine(retracted, N), sE = spine(extended, N);
  const pivot = [0, retracted[0][1], retracted[0][2]];
  const radii = o.neckR.map((r) => r * k);
  const secR = sR.map((p, i) => ({ p, rx: radii[Math.min(radii.length - 1, Math.floor((i / (N - 1)) * (radii.length - 1)))], ry: radii[Math.min(radii.length - 1, Math.floor((i / (N - 1)) * (radii.length - 1)))] }));
  const neckGeo = loft(secR, 9, [1, 0, 0]);
  const secE = sE.map((p, i) => ({ p, rx: secR[i].rx, ry: secR[i].ry }));
  const neckOut = loft(secE, 9, [1, 0, 0]);
  const PO = neckOut.attributes.position;
  let vi = 0;
  b.add(neckGeo, { part: 1, pivot, color: (p) => o.neckColor(p, k, sR), morph: (p) => { const d = [PO.getX(vi) - p.x, PO.getY(vi) - p.y, PO.getZ(vi) - p.z]; vi++; return d; } });
  // the head at the neck's end (it rides the neck's morph: the same offset)
  const hR = sR[N - 1], hE = sE[N - 1];
  const hOff = [hE[0] - hR[0], hE[1] - hR[1], hE[2] - hR[2]];
  const headTilt = o.headTilt;
  const head = (geo, m, color) => b.add(geo, { matrix: m, part: 1, pivot, color, morph: () => hOff });
  head(blob(0.034 * k, 0.036 * k, 0.05 * k, 12, 9), at(hR[0], hR[1], hR[2] + 0.012 * k, headTilt), (p) => o.headColor(p, k, hR));
  // the bill: a long dagger
  const bl = o.bill * k;
  const bill = loft([
    { p: [0, 0, 0], rx: 0.016 * k, ry: 0.018 * k },
    { p: [0, -0.002 * k, bl * 0.35], rx: 0.012 * k, ry: 0.013 * k },
    { p: [0, -0.004 * k, bl * 0.75], rx: 0.007 * k, ry: 0.007 * k },
    { p: [0, -0.006 * k, bl], rx: 0.0, ry: 0.0 },
  ], 7);
  head(bill, at(hR[0], hR[1] - 0.008 * k, hR[2] + 0.05 * k, headTilt), o.billColor);
  for (const s of [-1, 1]) head(blob(0.006 * k, 0.006 * k, 0.006 * k, 6, 4), at(s * 0.027 * k, hR[1] + 0.008 * k, hR[2] + 0.03 * k), o.eye);
  // plumes: thin streamers from the nape, lying back
  for (const [dx, len, dy] of o.plumes) {
    const pl = loft([
      { p: [dx * k, 0, 0], rx: 0.006 * k * (o.plumeR ?? 1), ry: 0.004 * k * (o.plumeR ?? 1) },
      { p: [dx * k, -0.01 * k, -len * 0.5 * k], rx: 0.004 * k * (o.plumeR ?? 1), ry: 0.003 * k * (o.plumeR ?? 1) },
      { p: [dx * k, -0.03 * k, -len * k], rx: 0.0, ry: 0.0 },
    ], 5);
    head(pl, at(hR[0], hR[1] + 0.012 * k, hR[2] - 0.03 * k, headTilt - 0.25), o.plumeColor);
  }
  // back plumes (the egret's lace), drooping over the tail
  if (o.lace) {
    for (let i = 0; i < 7; i++) {
      const s = (i / 6 - 0.5) * 2;
      const pl = loft([
        { p: [s * 0.035 * k, 0.68 * k, 0.03 * k], rx: 0.014 * k, ry: 0.006 * k },
        { p: [s * 0.05 * k, 0.64 * k, -0.15 * k], rx: 0.02 * k, ry: 0.006 * k },
        { p: [s * 0.045 * k, 0.55 * k, -0.28 * k], rx: 0.013 * k, ry: 0.005 * k },
        { p: [s * 0.035 * k, 0.49 * k, -0.33 * k], rx: 0.0, ry: 0.0 },
      ], 5);
      b.add(pl, { color: 0xf6f4ee });
    }
  }
  // wings: spread (the morph) broad and arched, the hand black; folded they
  // shrink to nothing inside the body, whose paint shows the folded wing
  for (const s of [-1, 1]) {
    const span = o.span * k, chord = o.chord * k;
    const outline = [[0, 0.5], [0.3, 0.55], [0.62, 0.45], [0.86, 0.3], [1.0, 0.05], [0.97, -0.1], [0.84, -0.18], [0.72, -0.12], [0.6, -0.2], [0.44, -0.3], [0.3, -0.42], [0.12, -0.5], [0, -0.5]];
    const g = sheet(outline.map(([u, v]) => [u * span, v * chord]), 0.006 * k);
    // arched: the hand drooped
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) P.setY(i, P.getY(i) - Math.pow(P.getX(i) / span, 2) * 0.12 * span);
    if (s < 0) {
      g.scale(-1, 1, 1);
      const ix = g.index.array;
      for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
      const Nn = g.attributes.normal;
      for (let i = 0; i < Nn.count; i++) Nn.setX(i, -Nn.getX(i));
    }
    const shoulder = [s * 0.06 * k, 0.68 * k, 0.06 * k];
    const spread = at(shoulder[0], shoulder[1], shoulder[2], 0, 0, 0);
    const folded = at(shoulder[0], shoulder[1] - 0.04 * k, shoulder[2] - 0.08 * k, 0, 0, 0, 0.04);
    b.add(g, { matrix: folded, morph: spread, part: 2, pivot: shoulder, color: (p, n, l) => o.wingColor(Math.abs(l.x) / span, l.z / chord) });
  }
  // legs: thigh hidden in the body, the shank down to the foot; toes spread
  for (const s of [-1, 1]) {
    const part = s < 0 ? 3 : 4;
    const hip = [s * 0.03 * k, hipY + 0.04 * k, 0.0];
    const knee = [s * 0.032 * k, 0.26 * k, -0.02 * k];
    const foot = [s * 0.03 * k, 0.012 * k, 0.0];
    b.add(limb(hip, knee, 0.012 * k, 0.01 * k, 6), { part, pivot: hip, color: o.legColor });
    b.add(limb(knee, foot, 0.01 * k, 0.009 * k, 6), { part, pivot: hip, color: o.legColor });
    for (const a of [-0.5, 0, 0.5, Math.PI]) {
      const len = (a === Math.PI ? 0.045 : 0.075) * k;
      const tip = [foot[0] + Math.sin(a) * len, 0.004 * k, foot[2] + Math.cos(a) * len];
      b.add(limb([foot[0], 0.008 * k, foot[2]], tip, 0.006 * k, 0.004 * k, 4), { part, pivot: hip, color: o.footColor });
    }
  }
  return b.build();
}

const RIG = /* glsl */`
uniform float uHip;
void rig(inout vec3 p, inout vec3 n) {
  float neck = aPose.x, wings = aPose.y, beat = aPose.z, look = aPose.w;
  float trail = aPose2.x, walk = aPose2.y, step = aPose2.z;
  if (isPart(1.0)) {
    p += aMorph * neck;
    vec3 q = p - aJoint.xyz;
    q = rotY(q, look);
    n = rotY(n, look);
    p = aJoint.xyz + q;
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
    // walking: the leg swings from the hip; in the swing half the foot lifts
    float a = step * sin(walk + side);
    float lift = max(0.0, cos(walk + side)) * step * 1.4;
    float below = clamp(-q.y / uHip, 0.0, 1.0);
    q.z += lift * below * below * uHip * 0.35;
    q.y += lift * below * below * uHip * 0.22;
    q = rotX(q, -a);
    // flying: trailed straight back under the tail
    q = rotX(q, -trail * 1.45);
    n = rotX(n, -a - trail * 1.45);
    p = aJoint.xyz + q;
  }
}
`;

const HERON = {
  scale: 1, tilt: 0.72, span: 0.86, chord: 0.36, bill: 0.15, headTilt: 0.12,
  neck: [[0.72, 0.12], [0.84, 0.08], [0.96, 0.1], [1.03, 0.15], [1.05, 0.2]],
  neckOut: [[0.72, 0.12], [0.76, 0.28], [0.74, 0.43], [0.68, 0.54], [0.64, 0.6]],
  neckR: [0.05, 0.036, 0.028, 0.026, 0.026],
  plumes: [[-0.005, 0.2, 0], [0.005, 0.16, 0]],
  bodyColor: (p, k) => {
    // アオサギ: blue-grey back and folded wings, a black band along the side
    // of the breast up to the bend of the wing, black flight feathers at the
    // back, pale grey below
    const ax = Math.abs(p.x);
    if (p.z < -0.13 * k && p.y > 0.55 * k) return 0x2a2c34;                      // primaries over the tail
    if (p.z > 0.02 * k && ax > 0.05 * k && p.y > 0.6 * k && p.y < 0.7 * k) return 0x23242c;   // the black shoulder band
    if (p.y < 0.57 * k) return 0xc9ccd4;                                          // underparts
    return (p.z * 40) % 1 < 0.14 ? 0x8a93a6 : 0x9ca5b6;                          // the grey mantle, feathered
  },
  tail: 0x7a8294,
  // the neck white, a double line of black streaks down its front
  neckColor: (p, k) => (p.z > 0.1 * k && Math.abs(Math.abs(p.x) - 0.007 * k) < 0.006 * k && p.y < 0.98 * k && Math.sin(p.y * 160) > -0.4 ? 0x23242c : 0xf2f2ee),
  headColor: (p, k, c) => {
    const dy = p.y - c[1], dz = p.z - c[2];
    // the black stripe from the eye back to the crest
    if (dy > -0.006 * k && dy < 0.022 * k && Math.abs(p.x) > 0.014 * k && dz < 0.034 * k) return 0x1e1f26;
    if (dy > 0.026 * k && dz < 0.004 * k) return 0x1e1f26;
    return 0xf8f8f4;
  },
  billColor: 0xe79a2e, eye: 0xf0dc3a, plumeColor: 0x1e1f26,
  wingColor: (u, v) => (u > 0.58 ? 0x23242c : v < -0.22 ? 0x5c6476 : v > 0.3 && u < 0.3 ? 0xb2b8c6 : 0x8e98ac),
  legColor: 0xc9ac5e, footColor: 0xb89a50,
  plumeR: 1.6,
};

const EGRET = {
  scale: 0.62, tilt: 0.42, body: [1.22, 1.18, 1.1], span: 0.78, chord: 0.33, bill: 0.15, headTilt: 0.05,
  neck: [[0.7, 0.13], [0.84, 0.08], [0.98, 0.1], [1.08, 0.16], [1.12, 0.21]],
  neckOut: [[0.7, 0.13], [0.8, 0.28], [0.8, 0.43], [0.72, 0.55], [0.66, 0.6]],
  neckR: [0.045, 0.03, 0.024, 0.022, 0.024],
  plumes: [[-0.005, 0.2, 0], [0.005, 0.17, 0]],
  lace: true,
  bodyColor: () => 0xf8f7f2, tail: 0xf2f1ec,
  neckColor: () => 0xf8f7f2,
  headColor: (p, k, c) => (p.z - c[2] > 0.035 * k && Math.abs(p.x) < 0.016 * k && p.y - c[1] < 0.004 * k ? 0xd8c26a : 0xf8f7f2),   // the bare yellowish lores
  billColor: 0x1e1e24, eye: 0xe8d23a, plumeColor: 0xf8f7f2,
  wingColor: () => 0xf6f5ef,
  legColor: 0x1e1e24, footColor: 0xf0c832,
};

/**
 * Build one kind of wader.  `birds`: [{ x, z, y (the bottom), water (the
 * surface), yaw, area(x, z) => bool, landings: [[x, z], ...] }].
 */
export function buildWaders(ctx, { kind, birds, marks, reflect, bounds }) {
  const spec = kind === 'heron' ? HERON : EGRET;
  const A = ANIMALS[kind];
  const r = rngKit(kind === 'heron' ? 9501 : 9601);
  const geo = waderGeometry(spec);
  const hipLen = 0.54 * spec.scale;
  const mat = animalMaterial({ key: kind, rig: RIG, tint: kind === 'heron' ? 0x6a6890 : 0x9a94b8, uniforms: { uHip: { value: hipLen } }, bands: kind === 'heron' ? 3 : 'soft3' });
  const herd = new Herd(ctx, geo, mat, birds.length, kind, { reflect, bounds });
  // their reflection in the paddy water or the river (both painted, not mirrors)
  reflectionOf(ctx, herd, {
    rig: RIG, key: kind, waterY: birds[0].water, uniforms: { uHip: { value: hipLen } },
    tint: kind === 'heron' ? 0x4a8aa8 : 0xa8c8ec, mix: kind === 'heron' ? 0.45 : 0.3, alpha: kind === 'heron' ? 0.5 : 0.62,
  });
  const list = birds.map((b, i) => ({
    ...b, home: { x: b.x, z: b.z }, state: 'stand', t: r.range(1, 5), yaw: b.yaw ?? r.range(0, 6.28), neck: 0, neckTo: 0, look: 0, lookTo: 0,
    wings: 0, beat: 0, trail: 0, walk: 0, step: 0, lift: 0, alt: b.y, pitch: 0, speed: 0,
    ring: marks.still(b.x, b.water, b.z, 0.09 * spec.scale / 0.62 * 0.62 + 0.05, 0.4), id: i,
  }));
  const place = (b, i) => {
    herd.set(i, b.x, b.alt, b.z, b.yaw, b.pitch, 0, 1);
    herd.setPose(i, b.neck, b.wings, b.beat, b.look);
    herd.setPose2(i, b.trail, b.walk, b.step, 0);
    const wet = b.state !== 'fly' && b.alt < b.water + 0.02;
    marks.move(b.ring, b.x + Math.sin(b.yaw) * 0.02, b.water, b.z + Math.cos(b.yaw) * 0.02, wet ? 0.45 : 0);
  };
  list.forEach(place);
  herd.flush();

  const takeOff = (b, cam) => {
    // somewhere else along its water, well away from the player
    const opts = b.landings.filter(([x, z]) => Math.hypot(x - b.x, z - b.z) > A.hop[0] && Math.hypot(x - b.x, z - b.z) < A.hop[1] && Math.hypot(x - cam.x, z - cam.z) > A.flee * 3);
    const [tx, tz] = opts.length ? opts[Math.floor(r.next() * opts.length)] : b.landings[0];
    Object.assign(b, { state: 'fly', u: 0, from: { x: b.x, z: b.z, y: b.alt }, to: { x: tx, z: tz }, dur: Math.max(4, Math.hypot(tx - b.x, tz - b.z) / A.flySpeed), flap: 0 });
    b.yawTo = Math.atan2(tx - b.x, tz - b.z);
  };

  let clock = 0;
  function update(dt, cam) {
    clock += dt;
    list.forEach((b, i) => {
      b.t -= dt;
      const d = Math.hypot(b.x - cam.x, b.z - cam.z);
      if (b.state !== 'fly' && d < A.flee) { b.state = 'crouch'; b.u = 0; b.neckTo = 0; b.fleeFrom = { ...cam }; }
      if (b.state === 'stand' || b.state === 'walk') {
        // still as a post, now and then a turn of the head, a step, a strike
        if (b.t <= 0) {
          const roll = r.next();
          if (b.state === 'walk') { b.state = 'stand'; b.t = r.range(1.5, 4); }
          else if (roll < A.walkChance) {
            b.state = 'walk'; b.t = r.range(2, 5);
            for (let k = 0; k < 10; k++) {
              const a = b.yaw + r.range(-1.2, 1.2), dist = r.range(0.8, 2.5);
              const x = b.x + Math.sin(a) * dist, z = b.z + Math.cos(a) * dist;
              if (b.area(x, z)) { b.goal = { x, z }; break; }
            }
          } else if (roll < A.walkChance + 0.25) { b.state = 'strike'; b.u = 0; }
          else { b.lookTo = r.range(-0.9, 0.9); b.t = r.range(2, 6); }
        }
      }
      if (b.state === 'walk' && b.goal) {
        const want = Math.atan2(b.goal.x - b.x, b.goal.z - b.z);
        b.yaw += THREE.MathUtils.clamp(turn(b.yaw, want) * 2, -1.5, 1.5) * dt;
        b.speed = A.walkSpeed;
        b.step += (A.stepAngle - b.step) * Math.min(1, dt * 3);
        b.lookTo = 0;
        if (Math.hypot(b.goal.x - b.x, b.goal.z - b.z) < 0.15) { b.state = 'stand'; b.t = r.range(1, 4); }
      } else if (b.state !== 'fly') { b.speed = 0; b.step += (0 - b.step) * Math.min(1, dt * 4); }
      if (b.state === 'strike') {
        // a slow lean, a lightning stab, back up to swallow
        b.u += dt;
        b.neckTo = b.u < 1.2 ? 0.35 * ease(b.u / 1.2) : b.u < 1.35 ? 1 : b.u < 2.4 ? 0.35 : 0;
        if (b.u > 1.3 && !b.splash) {
          b.splash = true;
          marks.ring(b.x + Math.sin(b.yaw) * 0.55 * spec.scale, b.water, b.z + Math.cos(b.yaw) * 0.55 * spec.scale, { r0: 0.03, r1: 0.35, life: 1.4, strength: 0.8 });
        }
        if (b.u > 3) { b.state = 'stand'; b.t = r.range(2, 6); b.splash = false; }
      }
      if (b.state === 'crouch') {
        // a crouch and a first heavy beat
        b.u += dt;
        b.wings += (1 - b.wings) * Math.min(1, dt * 6);
        b.beat = -0.6 * ease(b.u / 0.35);
        if (b.u > 0.35) takeOff(b, b.fleeFrom);
      }
      if (b.state === 'fly') {
        b.u += dt / b.dur;
        const u = Math.min(1, b.u);
        const e = ease(u);
        b.x = b.from.x + (b.to.x - b.from.x) * e;
        b.z = b.from.z + (b.to.z - b.from.z) * e;
        const top = A.cruise;
        const land = b.y;
        b.alt = (1 - u) * b.from.y + u * land + Math.sin(Math.PI * Math.min(1, u * 1.15)) * top;
        b.yaw += turn(b.yaw, b.yawTo) * Math.min(1, dt * 3);
        // slow deep beats climbing, a glide, then wings up and legs down to land
        const gliding = u > 0.62 && u < 0.86;
        const landing = u >= 0.86;
        const f = gliding ? 0.25 : landing ? 0.6 : 1;
        b.flap += dt * A.beatHz * Math.PI * 2 * (gliding ? 0.2 : 1);
        b.beat = Math.sin(b.flap) * A.beatAmp * f + (landing ? 0.25 : 0.05);
        b.wings = 1;
        b.trail += ((landing ? 0.15 : 1) - b.trail) * Math.min(1, dt * 3);
        b.pitch = (landing ? -0.2 : 0.5 * b.trail) ;
        b.neck = 0;
        if (u >= 1) {
          Object.assign(b, { state: 'stand', t: r.range(2, 5), alt: land, pitch: 0, trail: 0, beat: 0 });
          b.wingsT = 0.8;
          marks.ring(b.x, b.water, b.z, { r0: 0.1, r1: 0.7, life: 1.8, strength: 0.8 });
        }
      } else {
        b.alt = b.y;
        b.pitch += (0 - b.pitch) * Math.min(1, dt * 4);
        b.trail += (0 - b.trail) * Math.min(1, dt * 5);
        if (b.state !== 'crouch') {
          // fold the wings after landing
          b.wings += (0 - b.wings) * Math.min(1, dt * 2.5);
          b.beat += (0 - b.beat) * Math.min(1, dt * 3);
        }
        b.neck += (b.neckTo - b.neck) * Math.min(1, dt * (b.state === 'strike' && b.u > 1.2 && b.u < 1.4 ? 25 : 3));
      }
      b.look += (b.lookTo - b.look) * Math.min(1, dt * 2);
      if (b.speed > 0) {
        const nx = b.x + Math.sin(b.yaw) * b.speed * dt, nz = b.z + Math.cos(b.yaw) * b.speed * dt;
        if (b.area(nx, nz)) { b.x = nx; b.z = nz; } else { b.state = 'stand'; b.t = 1; }
        // the legs keep time with the ground covered (no sliding feet)
        b.walk += (b.speed * dt) / (2 * hipLen * Math.sin(A.stepAngle) + 1e-3) * Math.PI;
      }
      place(b, i);
    });
    herd.flush();
  }
  return { update, herd, list };
}
