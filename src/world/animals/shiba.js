import * as THREE from 'three';
import { Body, loft, blob, at, smooth } from './shapes.js';
import { painted } from './shade.js';

/* ------------------------------------------------------------------ *
 * The shiba pup (Tan, 2026-09-28: "as adorable as possible... a slightly
 * smaller pup").  A three-to-four-month red shiba puppy, built as one
 * smooth plush body: a big round head (near half the body's length), very
 * full cream cheeks, a short button muzzle with a small black nose, big
 * dark glossy eyes set wide with two catch-lights each, pale brow dots,
 * small soft triangular ears that flop forward a little, a round barrel of
 * a body with a thick ruff, short sturdy legs with big round cream paws,
 * and a fluffy curl of a tail.  裏白: cream cheeks, muzzle, throat, chest,
 * belly, the inner and lower legs, under the tail.  Everything is lofted or
 * ellipsoidal with enough sides that no facet or ring shows through the
 * cel bands or the ink pass.
 *
 * Built standing, ~24 cm at the shoulder.  Sitting and lying are morphs of
 * the legs (aMorph: the hind legs fold under; aMorph2: all four tuck, the
 * forepaws out) and, in the shader, a tilt of the body about the shoulders
 * (sit) or a drop to the ground with the head on the paws (lie).  The play
 * bow is the same channel below zero: the body tips about the hips, the
 * chest to the ground, the forelegs stretched out in front, the rump up.
 * Rolling over is done by the instance (guide.js turns it on its back).
 *
 * Parts: 0 body  1 head and neck  2 tail  3/4 forelegs (l/r)
 *        5/6 hind legs (l/r)  7/8 ears (l/r)  9 tongue
 * aPose   x gait phase, y stride (0 still .. 1 trot), z head yaw, w head nod (+ down)
 * aPose2  x posture (-1 play bow, 0 stand, 1 sit, 2 lie), y tail wag,
 *         z ears (1 pricked, 0 back; past 1: excited, tongue out), w head tilt (roll)
 * ------------------------------------------------------------------ */

export const RED = 0xd48f52, RED_D = 0xc27a3f, CREAM = 0xf9f1e2, BLACK = 0x14100e, BROW = 0xf0d3b0, PINK = 0xe58a96;
/** The shoulders (the sit tilts the body about them), the hips (the bow tips it about them), the neck's root, the tongue's root. */
const SH = [0, 0.19, 0.07], HP = [0, 0.175, -0.105], NK = [0, 0.215, 0.115], TR = [0, 0.255, 0.245];
export const SIT_ANGLE = 0.55, LIE_DROP = 0.07, BOW_ANGLE = 0.5;
/** Its ground shadow, across and along (m), standing. */
export const SHADOW = [0.17, 0.27];
/** The height of its back, standing and lying (guide.js rests it on its back when it rolls over). */
export const BACK = 0.245, BODY_R = 0.09;

const under = (n, k = -0.35) => n.y < k;
const front = (n, p, w) => n.z > 0.3 && Math.abs(p.x) < w;

export function shibaGeometry() {
  const b = new Body();
  /* the body: a round plush barrel, deepest just behind the forelegs */
  b.add(loft(smooth([
    { p: [0, 0.158, -0.162], rx: 0, ry: 0 },
    { p: [0, 0.156, -0.125], rx: 0.078, ry: 0.08 },
    { p: [0, 0.155, -0.06], rx: 0.089, ry: 0.087 },
    { p: [0, 0.155, 0.01], rx: 0.091, ry: 0.09 },
    { p: [0, 0.16, 0.07], rx: 0.086, ry: 0.085 },
    { p: [0, 0.172, 0.112], rx: 0.07, ry: 0.07 },
    { p: [0, 0.19, 0.15], rx: 0, ry: 0 },
  ], 32), 44, [0, 1, 0]), {
    color: (p, n) => {
      if (front(n, p, 0.075) && p.y < 0.215) return CREAM;                      // the chest
      if (under(n, -0.25)) return CREAM;                                        // the belly
      if (n.y > 0.8 && p.z < 0.06 && p.z > -0.12) return RED_D;                 // the saddle, a shade deeper
      return RED;
    },
  });
  // the "pants" on the haunches, the shoulders' fluff, the chest's tuft
  for (const s of [-1, 1]) {
    b.add(blob(0.05, 0.062, 0.07, 20, 14), { matrix: at(s * 0.06, 0.13, -0.092, 0.12, 0, s * 0.1), color: (p, n) => (under(n, -0.4) || n.x * s < -0.65 ? CREAM : RED) });
    b.add(blob(0.04, 0.05, 0.046, 18, 12), { matrix: at(s * 0.056, 0.15, 0.072), color: (p, n) => (front(n, p, 0.2) && n.x * s < 0.3 ? CREAM : RED) });
  }
  b.add(blob(0.05, 0.042, 0.038, 18, 12), { matrix: at(0, 0.128, 0.125, -0.3, 0, 0), color: CREAM });
  // the ruff round the neck: a thick soft collar, cream at the throat and chest
  b.add(blob(0.088, 0.078, 0.07, 28, 18), { matrix: at(0, 0.205, 0.105, -0.5, 0, 0), color: (p, n) => (front(n, p, 0.07) || under(n, -0.35) ? CREAM : RED) });

  /* ---- head and neck (part 1), turning about the neck's root ---- */
  const head = { part: 1, pivot: NK };
  b.add(loft(smooth([
    { p: [0, 0.2, 0.095], rx: 0.068, ry: 0.066 },
    { p: [0, 0.235, 0.13], rx: 0.062, ry: 0.06 },
    { p: [0, 0.26, 0.15], rx: 0.05, ry: 0.05 },
    { p: [0, 0.272, 0.16], rx: 0.0, ry: 0.0 },
  ], 12), 24, [0, 0, 1]), { ...head, color: (p, n) => (front(n, p, 0.05) || under(n, -0.45) ? CREAM : RED) });
  const hc = [0, 0.275, 0.165];
  // the skull: a big round dome, broad across the cheeks, a little flat in front
  const skull = blob(0.083, 0.077, 0.075, 36, 26);
  {
    const P = skull.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i), z = P.getZ(i);
      const cheek = 1 + 0.16 * Math.max(0, -y / 0.077) * Math.max(0, z / 0.075 + 0.4);
      P.setX(i, P.getX(i) * cheek);
    }
    skull.computeVertexNormals();
  }
  // 裏白 on the face: the cheeks, jaw and muzzle's sides cream, the bridge and forehead red
  const face = (p) => {
    const dy = p.y - hc[1], dz = p.z - hc[2], ax = Math.abs(p.x);
    if (dz > 0.028 && dy > -0.012 && ax < 0.02) return RED;                      // the bridge of the nose
    if (dy < -0.004 - 0.12 * Math.max(0, -dz) && dz > -0.04) return CREAM;        // cheeks, jaw, muzzle
    return RED;
  };
  b.add(skull, { ...head, matrix: at(hc[0], hc[1], hc[2]), color: face });
  // the very full round cream cheeks, and a soft tuft under each
  for (const s of [-1, 1]) {
    b.add(blob(0.046, 0.041, 0.043, 22, 16), { ...head, matrix: at(hc[0] + s * 0.054, hc[1] - 0.03, hc[2] + 0.014), color: CREAM });
    b.add(blob(0.03, 0.022, 0.03, 14, 10), { ...head, matrix: at(hc[0] + s * 0.07, hc[1] - 0.05, hc[2] + 0.002, 0, 0, -s * 0.5), color: CREAM });
  }
  // the muzzle: a short button, a small black nose at its tip
  b.add(loft(smooth([
    { p: [0, hc[1] - 0.012, hc[2] + 0.028], rx: 0.044, ry: 0.036 },
    { p: [0, hc[1] - 0.016, hc[2] + 0.055], rx: 0.032, ry: 0.028 },
    { p: [0, hc[1] - 0.018, hc[2] + 0.076], rx: 0.024, ry: 0.021 },
    { p: [0, hc[1] - 0.017, hc[2] + 0.088], rx: 0.016, ry: 0.014 },
    { p: [0, hc[1] - 0.016, hc[2] + 0.094], rx: 0.0, ry: 0.0 },
  ], 14), 24, [0, 1, 0]), { ...head, color: face });
  b.add(blob(0.015, 0.011, 0.011, 16, 10), { ...head, matrix: at(0, hc[1] - 0.008, hc[2] + 0.093), color: BLACK });
  b.add(blob(0.004, 0.003, 0.003, 6, 4), { ...head, matrix: at(-0.004, hc[1] - 0.003, hc[2] + 0.102), color: 0x8a8a90 });   // a wet glint on the nose
  // the mouth's line, back along the muzzle's side: the shiba smile
  for (const s of [-1, 1]) b.add(blob(0.003, 0.0025, 0.022, 6, 4), { ...head, matrix: at(s * 0.014, hc[1] - 0.034, hc[2] + 0.07, 0.2, s * 0.4, 0), color: 0x6a4438 });
  // the open mouth and the tongue (part 9): out at a trot and when it is excited, else gone
  b.add(blob(0.016, 0.007, 0.018, 10, 6), { part: 9, pivot: NK, matrix: at(0, hc[1] - 0.038, hc[2] + 0.075, 0.2, 0, 0), color: 0x3a1f22 });
  b.add(blob(0.011, 0.005, 0.024, 10, 6), { part: 9, pivot: NK, matrix: at(0, hc[1] - 0.046, hc[2] + 0.083, 0.5, 0, 0), color: PINK });
  // eyes: big, round, dark and glossy, set wide on the dome; two catch-lights each; a soft brow dot above
  for (const s of [-1, 1]) {
    const ex = hc[0] + s * 0.035, ey = hc[1] + 0.01, ez = hc[2] + 0.059;
    b.add(blob(0.0175, 0.019, 0.008, 18, 14), { ...head, matrix: at(ex, ey, ez, -0.05, s * 0.42, s * 0.12), color: (p, n, l) => (l.y < -0.004 && l.y > -0.014 && Math.abs(l.x) < 0.012 ? 0x2a1a12 : BLACK) });
    b.add(blob(0.0052, 0.0055, 0.003, 10, 8), { ...head, matrix: at(ex - s * 0.005, ey + 0.0075, ez + 0.0075, 0, s * 0.42, 0), color: 0xffffff });
    b.add(blob(0.0026, 0.0026, 0.002, 8, 6), { ...head, matrix: at(ex + s * 0.0065, ey - 0.006, ez + 0.0075, 0, s * 0.42, 0), color: 0xffffff });
    b.add(blob(0.011, 0.0065, 0.005, 12, 8), { ...head, matrix: at(hc[0] + s * 0.031, hc[1] + 0.041, hc[2] + 0.052, 0.4, s * 0.35, 0), color: BROW });
  }
  // ears (parts 7, 8): small soft triangles with rounded tips, set wide, leaning a little forward and out; cream-pink inside, deeper red edges and backs
  for (const s of [-1, 1]) {
    const e = loft(smooth([
      { p: [0, -0.006, 0], rx: 0.024, ry: 0.009 },
      { p: [0, 0.012, 0.001], rx: 0.024, ry: 0.009 },
      { p: [0, 0.03, 0.004], rx: 0.017, ry: 0.007 },
      { p: [0, 0.045, 0.008], rx: 0.009, ry: 0.005 },
      { p: [0, 0.053, 0.011], rx: 0.003, ry: 0.003 },
      { p: [0, 0.055, 0.012], rx: 0.0, ry: 0.0 },
    ], 12), 16, [0, 0, 1]);
    const base = [hc[0] + s * 0.046, hc[1] + 0.05, hc[2] - 0.012];
    b.add(e, { part: s < 0 ? 7 : 8, pivot: base, matrix: at(base[0], base[1], base[2], 0.32, 0, -s * 0.38), color: (p, n, l) => (l.z > 0.003 && l.y > 0.004 && Math.abs(l.x) < 0.015 && l.y < 0.044 ? 0xf3d9c8 : Math.abs(l.x) > 0.017 || l.y > 0.046 ? 0xa9622e : RED) });
  }

  /* ---- the tail (part 2): a fluffy curl over the back, cream beneath ---- */
  const tb = [0, 0.215, -0.125];
  b.add(loft(smooth([
    { p: [0, 0.195, -0.138], rx: 0.028, ry: 0.028 },
    { p: [0.004, 0.24, -0.162], rx: 0.035, ry: 0.035 },
    { p: [0.014, 0.286, -0.142], rx: 0.037, ry: 0.037 },
    { p: [0.034, 0.296, -0.1], rx: 0.034, ry: 0.034 },
    { p: [0.058, 0.272, -0.078], rx: 0.028, ry: 0.028 },
    { p: [0.07, 0.242, -0.088], rx: 0.018, ry: 0.018 },
    { p: [0.072, 0.228, -0.1], rx: 0.0, ry: 0.0 },
  ], 22), 18, [1, 0, 0]), { part: 2, pivot: tb, color: (p) => (Math.hypot(p.x - 0.036, p.y - 0.256, p.z + 0.118) < 0.04 || p.y < 0.215 ? CREAM : RED) });   // cream inside the curl and beneath

  /* ---- legs: short and sturdy, cream socks, big round paws; one loft through
   * the joints for each pose (standing, sitting, lying), the same sections,
   * so a morph between them is a clean fold ---- */
  const leg = (part, pivot, radii, poses, paws) => {
    const mk = (pts) => loft(smooth(pts.map((q, i) => ({ p: q, rx: radii[i], ry: radii[i] })), 12), 16, [1, 0, 0]);
    const g0 = mk(poses[0]), g1 = mk(poses[1]), g2 = mk(poses[2]);
    const P0 = g0.attributes.position, P1 = g1.attributes.position, P2 = g2.attributes.position;
    let v1 = 0, v2 = 0, ci = 0;
    const rings = P0.count - 2;
    const sx = Math.sign(pivot[0]);
    b.add(g0, {
      part, pivot,
      // red outside, cream on the inner face and the sock
      color: (p, n) => { const t = ci++ / rings; return t > 0.5 || n.x * sx < -0.5 ? CREAM : RED; },
      morph: () => { const d = [P1.getX(v1) - P0.getX(v1), P1.getY(v1) - P0.getY(v1), P1.getZ(v1) - P0.getZ(v1)]; v1++; return d; },
      morph2: () => { const d = [P2.getX(v2) - P1.getX(v2), P2.getY(v2) - P1.getY(v2), P2.getZ(v2) - P1.getZ(v2)]; v2++; return d; },
    });
    const paw = (a, c) => [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    b.add(blob(0.031, 0.022, 0.036, 16, 10), { part, pivot, matrix: at(...paws[0]), morph: () => paw(paws[0], paws[1]), morph2: () => paw(paws[1], paws[2]), color: CREAM });
  };
  for (const s of [-1, 1]) {
    // forelegs: straight and sturdy; sitting they stand a touch forward; lying they stretch out in front
    leg(s < 0 ? 3 : 4, [s * 0.046, 0.175, 0.07], [0.036, 0.028, 0.025, 0.024], [
      [[s * 0.046, 0.175, 0.07], [s * 0.048, 0.11, 0.074], [s * 0.048, 0.055, 0.074], [s * 0.048, 0.022, 0.078]],
      [[s * 0.046, 0.175, 0.07], [s * 0.048, 0.11, 0.08], [s * 0.048, 0.055, 0.088], [s * 0.048, 0.022, 0.092]],
      [[s * 0.046, 0.1, 0.07], [s * 0.052, 0.05, 0.06], [s * 0.052, 0.024, 0.12], [s * 0.052, 0.02, 0.17]],
    ], [[s * 0.048, 0.02, 0.092], [s * 0.048, 0.02, 0.106], [s * 0.052, 0.02, 0.19]]);
    // hind legs: thigh, the angled shank, hock and the upright foot; sitting the
    // shank lies flat with the foot forward; lying they tuck under the hips
    leg(s < 0 ? 5 : 6, [s * 0.05, 0.165, -0.1], [0.046, 0.03, 0.024, 0.024], [
      [[s * 0.05, 0.165, -0.1], [s * 0.054, 0.095, -0.072], [s * 0.052, 0.05, -0.126], [s * 0.052, 0.022, -0.108]],
      [[s * 0.05, 0.075, -0.06], [s * 0.066, 0.052, 0.0], [s * 0.062, 0.022, -0.09], [s * 0.06, 0.02, -0.005]],
      [[s * 0.05, 0.085, -0.1], [s * 0.074, 0.045, -0.03], [s * 0.07, 0.022, -0.125], [s * 0.068, 0.02, -0.04]],
    ], [[s * 0.052, 0.02, -0.094], [s * 0.062, 0.019, 0.01], [s * 0.07, 0.019, -0.026]]);
  }
  const g = b.build();
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}

const v3 = (a) => `vec3(${a.map((x) => x.toFixed(3)).join(', ')})`;
export const RIG = /* glsl */`
attribute vec3 aMorph2;
const vec3 SH = ${v3(SH)};
const vec3 HP = ${v3(HP)};
const vec3 NK = ${v3(NK)};
const vec3 TR = ${v3(TR)};
void rig(inout vec3 p, inout vec3 n) {
  float ph = aPose.x, amp = aPose.y, look = aPose.z, nod = aPose.w;
  float sit = clamp(aPose2.x, 0.0, 1.0), lie = clamp(aPose2.x - 1.0, 0.0, 1.0), bow = clamp(-aPose2.x, 0.0, 1.0);
  float wag = aPose2.y, perk = min(aPose2.z, 1.0), tilt = aPose2.w;
  // the tongue: out at a trot, or when excited (ears asked past 1)
  float tongue = clamp(max(amp * 2.0 - 0.4, (aPose2.z - 1.0) * 4.0), 0.0, 1.0);
  float sitA = -${SIT_ANGLE.toFixed(3)} * sit * (1.0 - lie);
  float bowA = ${BOW_ANGLE.toFixed(3)} * bow;
  vec3 drop = vec3(0.0, -${LIE_DROP.toFixed(3)} * lie, 0.0);
  float id = aJoint.w;
  if (id > 2.5 && id < 6.5) {
    // legs: fold by the morphs; swing about the joint at a trot, diagonal pairs together
    p += aMorph * sit + aMorph2 * lie;
    float off = (id == 4.0 || id == 5.0) ? 3.14159 : 0.0;
    float sw = amp * (id < 4.5 ? 0.45 : 0.36) * sin(ph + off);
    vec3 piv = aJoint.xyz;
    vec3 q = p - piv;
    // the lower leg lifts as it swings forward
    float lift = amp * (id < 4.5 ? 0.7 : 0.25) * max(0.0, sin(ph + off + 0.6));
    if (q.y < -0.07) { vec3 k = vec3(0.0, -0.07, 0.0); q = k + rotX(q - k, lift); }
    // the play bow: the forelegs stretch out flat in front as the body tips about the hips
    if (id < 4.5) { q = rotX(q, -1.25 * bow); n = rotX(n, -1.25 * bow); }
    q = rotX(q, sw);
    n = rotX(n, sw);
    p = piv + q;
    if (id < 4.5 && bow > 0.0) { p = HP + rotX(p - HP, bowA); n = rotX(n, bowA); }
  } else {
    if (id > 8.5) p = TR + (p - TR) * tongue;
    // body, head, tail, ears: the sit's tilt about the shoulders, the bow's about the hips, then down to the ground for the lie
    vec3 q = rotX(p - SH, sitA) + SH + drop;
    q = HP + rotX(q - HP, bowA);
    if (id == 1.0 || id > 6.5) {
      vec3 nk = HP + rotX(rotX(NK - SH, sitA) + SH + drop - HP, bowA);
      vec3 rest = vec3(0.0, -0.05, 0.015) * lie;
      float hx = nod - sitA * 0.8 + lie * 0.85 - 0.12 * amp - bowA * 1.4;
      // at a trot the head is carried a little higher and forward, the neck stretching from its root
      q += vec3(0.0, 0.025, 0.03) * amp * smoothstep(0.0, 0.1, q.y - NK.y);
      q = nk + rotY(rotX(rotZ(q - nk, tilt), hx), look) + rest;
      n = rotY(rotX(rotZ(n, tilt), hx), look);
      if (id > 6.5 && id < 8.5) {
        // ears: pricked, or laid back; with a head tilt the upper ear perks and the lower one droops; a flop at a trot
        vec3 e = HP + rotX(rotX(aJoint.xyz - SH, sitA) + SH + drop - HP, bowA);
        e = nk + rotY(rotX(rotZ(e - nk, tilt), hx), look) + rest;
        float side = id < 7.5 ? -1.0 : 1.0;
        float pk = clamp(perk + side * tilt * 0.9, 0.0, 1.0);
        float back = (1.0 - pk) * 0.8 + amp * 0.14 * (0.5 + 0.5 * sin(2.0 * ph + 0.8));
        q = e + rotX(q - e, back);
        n = rotX(n, back);
      }
    } else if (id == 2.0) {
      vec3 tb = HP + rotX(rotX(aJoint.xyz - SH, sitA) + SH + drop - HP, bowA);
      q = tb + rotY(rotZ(q - tb, wag), wag * 0.5);
      n = rotY(rotZ(n, wag), wag * 0.5);
    } else {
      n = rotX(n, sitA + bowA);
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
