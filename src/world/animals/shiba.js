import * as THREE from 'three';
import { Body, loft, blob, at } from './shapes.js';
import { painted } from './shade.js';

/* ------------------------------------------------------------------ *
 * The shiba (Tan, 2026-09-28: the guide dog that leads you round the
 * town, guide.js).  A red shiba inu as the breed looks: the fox face with
 * full cheeks, cream 裏白 on the cheeks, throat, chest, belly and inside the
 * legs, small thick ears tipped forward, dark almond eyes with a shine, a
 * compact body and the tail curled over the back; the head and eyes a
 * little bigger than life, which is what makes it read as a puppyish,
 * friendly dog from a few metres off.
 *
 * Built standing.  Sitting and lying are morphs of the legs (aMorph: the
 * hind legs fold under; aMorph2: all four tuck, forepaws out) and, in the
 * shader, a tilt of the body about the shoulders (sit) or a drop of the
 * whole body to the ground with the head laid on the paws (lie).
 *
 * Parts: 0 body  1 head and neck  2 tail  3/4 forelegs (l/r)
 *        5/6 hind legs (l/r)  7/8 ears (l/r)
 * aPose   x gait phase, y stride (0 still .. 1 trot), z head yaw, w head nod (+ down)
 * aPose2  x posture (0 stand, 1 sit, 2 lie), y tail wag, z ears (1 pricked, 0 back), w head tilt (roll)
 * ------------------------------------------------------------------ */

export const RED = 0xd08a4a, RED_D = 0xbd7439, CREAM = 0xf7eedc, BLACK = 0x110d0b, BROW = 0xe9c9a4, PINK = 0xe27f8e;
/** The shoulders (the sit tilts the body about them), the neck's root, the tongue's root. */
const LIFT = 0.025;                     // the body carried this much higher (legs longer, the back line level and clear of the tail)
const SH = [0, 0.30 + LIFT, 0.12], NK = [0, 0.32 + LIFT, 0.17], TR = [0, 0.398 + LIFT, 0.35];
export const SIT_ANGLE = 0.6, LIE_DROP = 0.13;
/** Its ground shadow, across and along (m), standing. */
export const SHADOW = [0.21, 0.37];

const under = (n, k = -0.35) => n.y < k;
const front = (n, p, w) => n.z > 0.25 && n.y < 0.35 && Math.abs(p.x) < w;

export function shibaGeometry() {
  const b = new Body();
  /* the body: a plush barrel, the chest round and deep just behind the
   * forelegs, a full back, a broad rump; a thick double coat */
  b.add(loft([
    { p: [0, 0.29, -0.26], rx: 0.04, ry: 0.045 },
    { p: [0, 0.287, -0.225], rx: 0.09, ry: 0.105 },
    { p: [0, 0.28, -0.11], rx: 0.1, ry: 0.12 },
    { p: [0, 0.278, 0.0], rx: 0.098, ry: 0.122 },
    { p: [0, 0.28, 0.1], rx: 0.1, ry: 0.13 },
    { p: [0, 0.293, 0.18], rx: 0.088, ry: 0.112 },
    { p: [0, 0.31, 0.235], rx: 0.04, ry: 0.045 },
  ], 28, [0, 1, 0], 4), {
    color: (p, n) => {
      if (front(n, p, 0.085) && p.y < 0.34) return CREAM;                       // the chest
      if (under(n, -0.3)) return CREAM;                                         // the belly
      if (n.y > 0.75 && p.z < 0.08) return RED_D;                               // the saddle, a shade deeper
      return RED;
    },
  });
  // the "pants" on the haunches and the shoulders' fluff
  for (const s of [-1, 1]) {
    b.add(blob(0.062, 0.085, 0.1, 18, 12), { matrix: at(s * 0.078, 0.235, -0.15, 0.15, 0, s * 0.12), color: (p, n) => (under(n, -0.45) || n.x * s < -0.6 ? CREAM : RED) });
    b.add(blob(0.05, 0.07, 0.065, 14, 10), { matrix: at(s * 0.075, 0.26, 0.115), color: (p, n) => (front(n, p, 0.2) && n.x * s < 0.35 ? CREAM : RED) });
  }
  // the ruff round the neck: a thick cream collar at the throat and chest
  b.add(blob(0.11, 0.1, 0.085, 24, 16), { matrix: at(0, 0.325, 0.16, -0.45, 0, 0), color: (p, n) => (front(n, p, 0.075) || under(n, -0.4) ? CREAM : RED) });

  /* ---- head and neck (part 1), turning about the neck's root ---- */
  const head = { part: 1, pivot: NK };
  b.add(loft([
    { p: [0, 0.30, 0.14], rx: 0.085, ry: 0.085 },
    { p: [0, 0.36, 0.2], rx: 0.076, ry: 0.074 },
    { p: [0, 0.41, 0.245], rx: 0.066, ry: 0.066 },
    { p: [0, 0.43, 0.262], rx: 0.0, ry: 0.0 },
  ], 20, [0, 0, 1], 2), { ...head, color: (p, n) => (front(n, p, 0.055) || under(n, -0.5) ? CREAM : RED) });
  const hc = [0, 0.445, 0.28];
  // the skull: round, broad between the ears, filling out at the cheeks
  const skull = blob(0.088, 0.08, 0.082, 28, 20);
  {
    const P = skull.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i), z = P.getZ(i);
      const cheek = 1 + 0.22 * Math.max(0, -y / 0.08) * Math.max(0, z / 0.082 + 0.35);
      P.setX(i, P.getX(i) * cheek);
    }
    skull.computeVertexNormals();
  }
  // 裏白 on the face: the cheeks, jaw and the sides of the muzzle are cream,
  // the bridge of the nose and the forehead stay red
  const face = (p) => {
    const dy = p.y - hc[1], dz = p.z - hc[2], ax = Math.abs(p.x);
    if (dz > 0.03 && dy > -0.016 && ax < 0.021) return RED;                     // the bridge of the nose
    if (dy < -0.008 - 0.1 * Math.max(0, -dz) && dz > -0.045) return CREAM;        // cheeks, jaw, muzzle
    return RED;
  };
  b.add(skull, { ...head, matrix: at(hc[0], hc[1], hc[2]), color: face });
  // the big round cream cheeks
  for (const s of [-1, 1]) b.add(blob(0.05, 0.042, 0.046, 16, 12), { ...head, matrix: at(hc[0] + s * 0.06, hc[1] - 0.03, hc[2] + 0.02), color: CREAM });
  // the muzzle: short, a little blunt, black nose at the tip
  b.add(loft([
    { p: [0, hc[1] - 0.008, hc[2] + 0.025], rx: 0.054, ry: 0.044 },
    { p: [0, hc[1] - 0.016, hc[2] + 0.055], rx: 0.041, ry: 0.035 },
    { p: [0, hc[1] - 0.021, hc[2] + 0.08], rx: 0.031, ry: 0.027 },
    { p: [0, hc[1] - 0.023, hc[2] + 0.094], rx: 0.022, ry: 0.02 },
    { p: [0, hc[1] - 0.024, hc[2] + 0.1], rx: 0.0, ry: 0.0 },
  ], 18, [0, 1, 0], 2), { ...head, color: face });
  b.add(blob(0.02, 0.014, 0.014, 12, 8), { ...head, matrix: at(0, hc[1] - 0.017, hc[2] + 0.099), color: BLACK });
  // the mouth's line, dark, back along the muzzle's side: the shiba's smile
  for (const s of [-1, 1]) b.add(blob(0.004, 0.003, 0.03, 5, 3), { ...head, matrix: at(s * 0.021, hc[1] - 0.041, hc[2] + 0.07, 0.15, s * 0.35, 0), color: 0x5a3c30 });
  // the open mouth and the tongue (part 9): out at a trot and when it is excited, else gone
  b.add(blob(0.02, 0.008, 0.024, 10, 6), { part: 9, pivot: NK, matrix: at(0, hc[1] - 0.047, hc[2] + 0.078, 0.2, 0, 0), color: 0x3a1f22 });
  b.add(blob(0.013, 0.006, 0.03, 10, 6), { part: 9, pivot: NK, matrix: at(0, hc[1] - 0.056, hc[2] + 0.088, 0.55, 0, 0), color: PINK });
  // eyes: big dark almonds set on the slant of the face, each with a clear shine
  for (const s of [-1, 1]) {
    b.add(blob(0.019, 0.015, 0.007, 14, 10), { ...head, matrix: at(hc[0] + s * 0.038, hc[1] + 0.013, hc[2] + 0.062, 0, s * 0.5, s * 0.25), color: BLACK });
    b.add(blob(0.006, 0.006, 0.003, 8, 6), { ...head, matrix: at(hc[0] + s * 0.033, hc[1] + 0.021, hc[2] + 0.07, 0, s * 0.5, 0), color: 0xffffff });
    // the pale brow spots
    b.add(blob(0.011, 0.006, 0.005, 8, 6), { ...head, matrix: at(hc[0] + s * 0.034, hc[1] + 0.044, hc[2] + 0.056, 0.3, s * 0.4, 0), color: BROW });
  }
  // ears (parts 7, 8): small thick triangles, set wide, tipped a little forward, cream inside
  for (const s of [-1, 1]) {
    const e = new THREE.ConeGeometry(0.037, 0.078, 4, 2);
    e.rotateY(Math.PI / 4);
    e.scale(1.0, 1, 0.55);
    const base = [hc[0] + s * 0.05, hc[1] + 0.04, hc[2] - 0.006];
    // cream inside; the back and the edges a deeper red, so they read from behind
    b.add(e, { part: s < 0 ? 7 : 8, pivot: base, matrix: at(hc[0] + s * 0.05, hc[1] + 0.076, hc[2] - 0.008, 0.16, 0, -s * 0.2), color: (p, n, l) => (l.z > 0.004 && l.y < 0.022 && Math.abs(l.x) < 0.022 ? 0xf1d8c4 : Math.abs(l.x) > 0.024 || l.y > 0.03 || l.z < -0.012 ? 0xa8602c : RED) });
  }

  /* ---- the tail (part 2): thick and fluffy, a tight curl over the back, cream inside ---- */
  const tb = [0, 0.33, -0.225];
  b.add(loft([
    { p: [0, 0.3, -0.24], rx: 0.046, ry: 0.046 },
    { p: [0, 0.365, -0.275], rx: 0.055, ry: 0.055 },
    { p: [0.005, 0.44, -0.25], rx: 0.056, ry: 0.056 },
    { p: [0.028, 0.455, -0.18], rx: 0.052, ry: 0.052 },
    { p: [0.065, 0.42, -0.14], rx: 0.045, ry: 0.045 },
    { p: [0.085, 0.375, -0.15], rx: 0.032, ry: 0.032 },
    { p: [0.09, 0.355, -0.165], rx: 0.0, ry: 0.0 },
  ], 16, [1, 0, 0], 3), { part: 2, pivot: tb, color: (p, n) => (n.y > 0.2 || p.x > 0.05 ? RED : CREAM) });

  /* ---- legs: short and sturdy, cream socks; one loft through the joints for
   * each pose (standing, sitting, lying), the same sections, so a morph
   * between them is a clean fold ---- */
  const leg = (part, pivot, radii, poses, paws) => {
    const mk = (pts) => loft(pts.map((q, i) => ({ p: q, rx: radii[i], ry: radii[i] })), 12, [1, 0, 0], 3);
    const g0 = mk(poses[0]), g1 = mk(poses[1]), g2 = mk(poses[2]);
    const P0 = g0.attributes.position, P1 = g1.attributes.position, P2 = g2.attributes.position;
    let v1 = 0, v2 = 0, ci = 0;
    const rings = P0.count - 2;
    const sx = Math.sign(pivot[0]);
    b.add(g0, {
      part, pivot,
      // red outside, cream on the inner face and the sock
      color: (p, n) => { const t = ci++ / rings; return t > 0.58 || n.x * sx < -0.55 ? CREAM : RED; },
      morph: () => { const d = [P1.getX(v1) - P0.getX(v1), P1.getY(v1) - P0.getY(v1), P1.getZ(v1) - P0.getZ(v1)]; v1++; return d; },
      morph2: () => { const d = [P2.getX(v2) - P1.getX(v2), P2.getY(v2) - P1.getY(v2), P2.getZ(v2) - P1.getZ(v2)]; v2++; return d; },
    });
    const paw = (a, c) => [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    b.add(blob(0.036, 0.026, 0.045, 12, 8), { part, pivot, matrix: at(...paws[0]), morph: () => paw(paws[0], paws[1]), morph2: () => paw(paws[1], paws[2]), color: CREAM });
  };
  for (const s of [-1, 1]) {
    // forelegs: straight and sturdy; sitting they stand a touch forward; lying they stretch out in front
    leg(s < 0 ? 3 : 4, [s * 0.062, 0.29, 0.12], [0.046, 0.036, 0.032, 0.03], [
      [[s * 0.062, 0.29, 0.12], [s * 0.064, 0.19, 0.125], [s * 0.064, 0.1, 0.125], [s * 0.064, 0.035, 0.13]],
      [[s * 0.062, 0.29, 0.12], [s * 0.064, 0.19, 0.135], [s * 0.064, 0.1, 0.145], [s * 0.064, 0.035, 0.15]],
      [[s * 0.062, 0.16, 0.12], [s * 0.07, 0.08, 0.1], [s * 0.068, 0.04, 0.2], [s * 0.068, 0.032, 0.29]],
    ], [[s * 0.064, 0.026, 0.148], [s * 0.064, 0.026, 0.168], [s * 0.068, 0.028, 0.312]]);
    // hind legs: thigh, the angled shank, hock and the upright foot; sitting the
    // shank lies flat with the foot forward; lying they tuck under the hips
    leg(s < 0 ? 5 : 6, [s * 0.068, 0.28, -0.15], [0.06, 0.038, 0.03, 0.03], [
      [[s * 0.068, 0.28, -0.15], [s * 0.072, 0.17, -0.11], [s * 0.07, 0.1, -0.2], [s * 0.07, 0.035, -0.17]],
      [[s * 0.068, 0.13, -0.09], [s * 0.088, 0.1, 0.0], [s * 0.084, 0.035, -0.14], [s * 0.082, 0.03, -0.01]],
      [[s * 0.068, 0.15, -0.15], [s * 0.098, 0.08, -0.05], [s * 0.093, 0.035, -0.19], [s * 0.09, 0.03, -0.06]],
    ], [[s * 0.07, 0.026, -0.15], [s * 0.082, 0.024, 0.012], [s * 0.09, 0.024, -0.04]]);
  }
  const g = b.build();
  const P = g.attributes.position, J = g.attributes.aJoint;
  const up = (y) => y + LIFT * THREE.MathUtils.smoothstep(y, 0.1, 0.2);
  for (let i = 0; i < P.count; i++) { P.setY(i, up(P.getY(i))); J.setY(i, up(J.getY(i))); }
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}

const v3 = (a) => `vec3(${a.map((x) => x.toFixed(3)).join(', ')})`;
export const RIG = /* glsl */`
attribute vec3 aMorph2;
const vec3 SH = ${v3(SH)};
const vec3 NK = ${v3(NK)};
const vec3 TR = ${v3(TR)};
void rig(inout vec3 p, inout vec3 n) {
  float ph = aPose.x, amp = aPose.y, look = aPose.z, nod = aPose.w;
  float sit = clamp(aPose2.x, 0.0, 1.0), lie = clamp(aPose2.x - 1.0, 0.0, 1.0);
  float wag = aPose2.y, perk = min(aPose2.z, 1.0), tilt = aPose2.w;
  // the tongue: out at a trot, or when excited (ears asked past 1)
  float tongue = clamp(max(amp * 2.0 - 0.4, (aPose2.z - 1.0) * 4.0), 0.0, 1.0);
  float sitA = -${SIT_ANGLE.toFixed(3)} * sit * (1.0 - lie);
  vec3 drop = vec3(0.0, -${LIE_DROP.toFixed(3)} * lie, 0.0);
  float id = aJoint.w;
  if (id > 2.5 && id < 6.5) {
    // legs: fold by the morphs; swing about the joint at a trot, diagonal pairs together
    p += aMorph * sit + aMorph2 * lie;
    float off = (id == 4.0 || id == 5.0) ? 3.14159 : 0.0;
    float sw = amp * (id < 4.5 ? 0.4 : 0.32) * sin(ph + off);
    vec3 piv = aJoint.xyz;
    vec3 q = p - piv;
    // the lower leg lifts as it swings forward
    float lift = amp * (id < 4.5 ? 0.6 : 0.22) * max(0.0, sin(ph + off + 0.6));
    if (q.y < -0.12) { vec3 k = vec3(0.0, -0.12, 0.0); q = k + rotX(q - k, lift); }
    q = rotX(q, sw);
    n = rotX(n, sw);
    p = piv + q;
  } else {
    if (id > 8.5) p = TR + (p - TR) * tongue;
    // body, head, tail, ears: the sit's tilt about the shoulders, then down to the ground for the lie
    vec3 q = rotX(p - SH, sitA) + SH + drop;
    if (id == 1.0 || id > 6.5) {
      vec3 nk = rotX(NK - SH, sitA) + SH + drop;
      vec3 rest = vec3(0.0, -0.06, 0.02) * lie;
      float hx = nod - sitA * 0.8 + lie * 0.9 - 0.12 * amp;
      // at a trot the head is carried a little higher and forward, the neck stretching from its root
      q += vec3(0.0, 0.03, 0.035) * amp * smoothstep(0.0, 0.12, q.y - NK.y);
      q = nk + rotY(rotX(rotZ(q - nk, tilt), hx), look) + rest;
      n = rotY(rotX(rotZ(n, tilt), hx), look);
      if (id > 6.5 && id < 8.5) {
        // ears: pricked, or laid back
        vec3 e = rotX(aJoint.xyz - SH, sitA) + SH + drop;
        e = nk + rotY(rotX(rotZ(e - nk, tilt), hx), look) + rest;
        float back = (1.0 - perk) * 0.7;
        q = e + rotX(q - e, back);
        n = rotX(n, back);
      }
    } else if (id == 2.0) {
      vec3 tb = rotX(aJoint.xyz - SH, sitA) + SH + drop;
      q = tb + rotY(rotZ(q - tb, wag), wag * 0.5);
      n = rotY(rotZ(n, wag), wag * 0.5);
    } else {
      n = rotX(n, sitA);
    }
    p = q;
  }
}
`;

/** A kennel: pale timber, a dark red roof, a round door; the dog's bowl. */
function kennelGeometry(bowl = [0.45, 0.5]) {
  const b = new Body();
  const wood = (p) => (Math.sin(p.y * 70) > 0.85 ? 0xa4845e : 0xc4a57c);
  b.add(new THREE.BoxGeometry(0.62, 0.46, 0.72).translate(0, 0.25, 0), { color: wood });
  b.add(new THREE.BoxGeometry(0.66, 0.04, 0.76).translate(0, 0.02, 0), { color: 0x8a6c4c });
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(0.42, 0.03, 0.84);
    b.add(g, { matrix: at(s * 0.17, 0.58, 0, 0, 0, -s * 0.62), color: 0x8e3a30 });
  }
  const gable = new THREE.BufferGeometry();
  gable.setAttribute('position', new THREE.Float32BufferAttribute([-0.31, 0.48, 0.361, 0.31, 0.48, 0.361, 0, 0.7, 0.361, 0.31, 0.48, -0.361, -0.31, 0.48, -0.361, 0, 0.7, -0.361], 3));
  gable.computeVertexNormals();
  b.add(gable, { color: wood });
  const door = new THREE.CircleGeometry(0.15, 14, 0, Math.PI);
  const pts = door.attributes.position;
  for (let i = 0; i < pts.count; i++) pts.setY(i, pts.getY(i) * 1.1);
  b.add(door, { matrix: at(0, 0.2, 0.362), color: 0x2a221e });
  b.add(new THREE.PlaneGeometry(0.3, 0.2).translate(0, 0.1, 0.362), { color: 0x2a221e });
  b.add(new THREE.CylinderGeometry(0.09, 0.07, 0.05, 14).translate(bowl[0], 0.025, bowl[1]), { color: 0xc4c8d0 });
  b.add(new THREE.CylinderGeometry(0.075, 0.075, 0.01, 14).translate(bowl[0], 0.045, bowl[1]), { color: 0x7fa8c8 });
  return b.build();
}

/** The dog's kennel in its yard, `spot` { x, z, y, yaw, kennel, kennelYaw, bowl } (the dog itself is out, guiding). */
export function buildKennel(ctx, spot) {
  const kx = spot.kennel?.x ?? spot.x + Math.cos(spot.yaw) * 0.85, kz = spot.kennel?.z ?? spot.z - Math.sin(spot.yaw) * 0.85;
  const kyaw = spot.kennelYaw ?? spot.yaw;
  const bw = spot.bowl ? [(spot.bowl.x - kx) * Math.cos(kyaw) - (spot.bowl.z - kz) * Math.sin(kyaw), (spot.bowl.x - kx) * Math.sin(kyaw) + (spot.bowl.z - kz) * Math.cos(kyaw)] : undefined;
  const kennel = new THREE.Mesh(kennelGeometry(bw), painted());
  kennel.position.set(kx, spot.y, kz);
  kennel.rotation.y = kyaw;
  kennel.castShadow = kennel.receiveShadow = true;
  kennel.name = 'animals-kennel';
  ctx.add(kennel);
  ctx.collide(kx - 0.45, kz - 0.45, kx + 0.45, kz + 0.45, spot.y + 0.7);
}
