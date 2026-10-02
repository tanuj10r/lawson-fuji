import * as THREE from 'three';
import { Body, loft, blob, at, smooth } from '../animals/shapes.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ *
 * The moon rabbits of ぺったん堂 (月の兎; Tan: "three adorable white moon
 * rabbits in indigo happi and twisted hachimaki").  Built like the town's
 * animals (animals/shapes.js: lofts and ellipsoids baked into one geometry,
 * the parts turned by a small vertex-shader rig, animals/shade.js), one
 * instanced mesh for all three.
 *
 * A round white rabbit standing on its hind feet: a big head (near half its
 * height), wide-set glossy eyes, pink cheeks and nose, long ears that flop,
 * a pear of a body in a short indigo happi with a pale collar and a full
 * moon on its back, stubby arms, big feet, a round tail; a twisted
 * headband (ねじり鉢巻) knotted at the side, its two tails loose.
 *
 * Authored facing +z, 0.81 m to the top of the head (the instance scales
 * it), feet on y 0.  All three share the geometry: the pounders hold the
 * mallet (杵) in both paws; the turner's is folded away (scaled to nothing)
 * and its arms move free.  The role is a pose number, so a pounder can let go
 * of its mallet (it hops out with free paws and takes the mallet up at the
 * mortar: `malletGeometry` is the same mallet as a thing of its own, for
 * while nobody holds it, and `malletMatrix` puts it where a rabbit's would be).
 *
 * Parts: 0 body and feet  1 head and headband  2/3 ears (l/r)  4/5 arms (l/r)
 *        6 the mallet  7 tail  8 the headband's tails  9 the mochi the turner holds up
 * aMorph.x  ears: how far along the ear (0 base .. 1 tip), for the flop
 * aPose   x swing: the mallet's angle about the shoulders (rad; 0 level in front, - up and back, + down)
 *         y lean: the body bends forward about the hips (rad)   z squash (+ stretch, - squash)   w ear flop (+ forward)
 * aPose2  x role (0 pounder, 1 turner)   y reach: the turner's right paw into the mortar (0..1)
 *         z head nod (+ down)   w head turn
 * aPose3  x the headband's tails flick   y hold: the turner's right paw up, the mochi in it (0..1)
 *         z wipe: the left paw to the brow (0..1)   w twitch (ears apart, the tail's wiggle)
 * ------------------------------------------------------------------ */

export const FUR = 0xfdfaf4, FUR_SHADE = 0xf1ece4, PINK = 0xf2a3b0, INK = 0x1c1620, INDIGO = 0x2f4a94, INDIGO_D = 0x223672, COLLAR = 0xf4efe2;
const WOOD = 0xcaa16c, WOOD_D = 0xa9814e, MOCHI_W = 0xfbf8f0;

/** The hips (the bow bends about them), the neck, the shoulders' axis, each shoulder, the paw at the end of an arm. */
export const HP = [0, 0.18, 0], NK = [0, 0.45, 0.0], SH = [0, 0.385, 0.035];
const SHX = 0.128, ARM = 0.27;
/** The mochi the turner holds up: just past its right paw (the arm built level: past is up once it is raised). */
const HELD = [SHX, SH[1], SH[2] + ARM + 0.066];
/** How far the arms turn in for the grip (the paws meet on the handle). */
const GRIP = 0.46;
/** The mallet: its head's centre and half length (the head hangs below the handle). */
const KH = [0, 0.31, 0.66], KHALF = 0.11, KR = 0.06;
/** The arms' free angles (rad about the shoulder, 0 level in front, + down). */
const HANG = 1.18, REACH = 0.1, HOLD = -1.2, WIPE = -0.95;

const v3 = (a) => `vec3(${a.map((x) => x.toFixed(4)).join(', ')})`;

export function rabbitGeometry() {
  const b = new Body();
  const front = (n, k = 0.25) => n.z > k;

  /* ---- the body (part 0): a pear in a short happi; the feet ---- */
  b.add(loft(smooth([
    { p: [0, 0.045, 0], rx: 0, ry: 0 },
    { p: [0, 0.07, 0], rx: 0.115, ry: 0.105 },
    { p: [0, 0.15, 0.004], rx: 0.162, ry: 0.146 },
    { p: [0, 0.25, 0.004], rx: 0.15, ry: 0.134 },
    { p: [0, 0.35, 0.002], rx: 0.118, ry: 0.106 },
    { p: [0, 0.42, 0], rx: 0.08, ry: 0.075 },
    { p: [0, 0.47, 0], rx: 0, ry: 0 },
  ], 9), 16, [0, 0, 1]), {
    color: (p, n) => {
      if (p.y < 0.13) return FUR;                                              // below the hem: fur
      if (p.y < 0.148) return COLLAR;                                           // the hem's pale band
      // the open front: fur down the chest and belly, the collar's band either side of it
      const half = 0.03 + (p.y - 0.14) * 0.2;
      if (front(n) && Math.abs(p.x) < half) return FUR;
      if (front(n, 0.1) && Math.abs(p.x) < half + 0.026) return COLLAR;
      // the full moon on its back
      if (n.z < -0.5 && Math.hypot(p.x, p.y - 0.27) < 0.055) return COLLAR;
      return INDIGO;
    },
  });
  for (const s of [-1, 1]) b.add(blob(0.052, 0.036, 0.088, 8, 6), { matrix: at(s * 0.08, 0.036, 0.045, 0, s * 0.22, 0), color: (p, n) => (n.y < -0.5 ? FUR_SHADE : FUR) });
  // the tail (part 7): a round puff
  b.add(blob(0.05, 0.048, 0.046, 8, 6), { part: 7, pivot: [0, 0.13, -0.12], matrix: at(0, 0.14, -0.158), color: FUR });

  /* ---- the head (part 1): a big round dome, fuller at the cheeks ---- */
  const hc = [0, 0.615, 0.012];
  const head = { part: 1, pivot: NK };
  const skull = blob(0.19, 0.172, 0.172, 24, 16);
  {
    const P = skull.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i), z = P.getZ(i);
      P.setX(i, P.getX(i) * (1 + 0.14 * Math.max(0, -y / 0.172 + 0.1) * Math.max(0, z / 0.172 + 0.5)));
    }
    skull.computeVertexNormals();
  }
  b.add(skull, { ...head, matrix: at(...hc), color: FUR });
  for (const s of [-1, 1]) {
    // eyes: tall, dark and glossy, set wide; a big catch-light and a small one
    const ex = s * 0.074, ey = hc[1] + 0.004, ez = hc[2] + 0.152;
    b.add(blob(0.027, 0.037, 0.012, 8, 6), { ...head, matrix: at(ex, ey, ez, -0.05, s * 0.42, 0), color: INK });
    b.add(blob(0.0095, 0.0115, 0.004, 6, 4), { ...head, matrix: at(ex - 0.007, ey + 0.015, ez + 0.0095, 0, s * 0.42, 0), color: 0xffffff });
    b.add(blob(0.0045, 0.005, 0.003, 5, 3), { ...head, matrix: at(ex + 0.009, ey - 0.014, ez + 0.0085, 0, s * 0.42, 0), color: 0xffffff });
    // the blush
    b.add(blob(0.034, 0.022, 0.008, 8, 4), { ...head, matrix: at(s * 0.128, hc[1] - 0.05, hc[2] + 0.121, 0, s * 0.74, 0), color: PINK });
    // the mouth: two little curves under the nose
    b.add(blob(0.012, 0.004, 0.004, 6, 3), { ...head, matrix: at(s * 0.0115, hc[1] - 0.058, hc[2] + 0.166, 0, s * 0.15, s * 0.5), color: 0x8a5560 });
  }
  b.add(blob(0.013, 0.0095, 0.008, 8, 5), { ...head, matrix: at(0, hc[1] - 0.034, hc[2] + 0.17), color: 0xe98a9a });
  /* the twisted headband: a rope of white and indigo round the brow, knotted over the right ear's side */
  {
    const ty = hc[1] + 0.1, R = [0.158, 0.143], tube = 0.0175;
    const g = new THREE.TorusGeometry(1, tube, 5, 16);
    g.rotateX(Math.PI / 2);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      // the ring's own radius is 1: stretch it to the brow's ellipse, the tube kept round
      const x = P.getX(i), z = P.getZ(i), l = Math.hypot(x, z) || 1, cx = x / l, cz = z / l, off = l - 1;
      P.setXYZ(i, cx * (R[0] + off), P.getY(i), cz * (R[1] + off));
    }
    g.computeVertexNormals();
    b.add(g, {
      ...head, matrix: at(0, ty, hc[2] - 0.002, -0.14, 0, 0),
      color: (p, n, l) => {
        const a = Math.atan2(l.z / R[1], l.x / R[0]), th = Math.atan2(l.y, (Math.hypot(l.x / R[0], l.z / R[1]) - 1) * 0.145);
        return Math.sin(a * 9 + th * 2) > 0.25 ? INDIGO : 0xffffff;
      },
    });
    const kn = [0.128, ty + 0.012, hc[2] - 0.09];
    b.add(blob(0.026, 0.022, 0.024, 7, 5), { ...head, matrix: at(...kn), color: 0xffffff });
    // the two tails (part 8): short tapes that fly up when it jumps
    for (const [k, rz] of [[0, 0.5], [1, 0.95]]) {
      b.add(loft([
        { p: [0, 0, 0], rx: 0.012, ry: 0.004 }, { p: [0, -0.05, -0.008], rx: 0.016, ry: 0.004 }, { p: [0, -0.1, -0.012], rx: 0.019, ry: 0.004 }, { p: [0, -0.112, -0.012], rx: 0, ry: 0 },
      ], 6, [0, 0, 1]), { part: 8, pivot: kn, matrix: at(kn[0] + 0.008, kn[1] - 0.006, kn[2] - 0.006 - k * 0.012, 0.25, 0, rz), color: (p, n, l) => (l.y < -0.07 ? INDIGO : 0xffffff) });
    }
  }
  /* ---- the ears (parts 2, 3): long, flat, pink inside; aMorph.x runs base to tip ---- */
  for (const s of [-1, 1]) {
    const base = [s * 0.078, hc[1] + 0.14, hc[2] - 0.03], L = 0.31;
    const m = at(base[0], base[1], base[2], -0.12, 0, -s * 0.2);
    b.add(loft(smooth([
      { p: [0, -0.03, 0], rx: 0.036, ry: 0.018 },
      { p: [0, 0.05, 0], rx: 0.05, ry: 0.02 },
      { p: [0, 0.15, 0], rx: 0.06, ry: 0.02 },
      { p: [0, 0.24, 0], rx: 0.054, ry: 0.018 },
      { p: [0, 0.285, 0], rx: 0.04, ry: 0.015 },
      { p: [0, 0.305, 0], rx: 0.022, ry: 0.01 },
      { p: [0, L, 0], rx: 0, ry: 0 },
    ], 7), 10, [0, 0, 1]), {
      part: s < 0 ? 2 : 3, pivot: base, matrix: m,
      color: (p, n, l) => (l.z > 0.005 && Math.abs(l.x) < 0.036 && l.y > 0.02 && l.y < 0.268 ? PINK : FUR),
      morph: (p, l) => [Math.max(0, Math.min(1, l.y / L)), 0, 0],
    });
  }

  /* ---- the arms (parts 4, 5): built level, straight out in front of each shoulder; the rig turns them ---- */
  for (const s of [-1, 1]) {
    const sh = [s * SHX, SH[1], SH[2]];
    const arm = { part: s < 0 ? 4 : 5, pivot: sh };
    b.add(loft(smooth([
      { p: [sh[0], sh[1], sh[2] - 0.01], rx: 0, ry: 0 },
      { p: [sh[0], sh[1], sh[2] + 0.02], rx: 0.05, ry: 0.052 },
      { p: [sh[0], sh[1], sh[2] + 0.13], rx: 0.046, ry: 0.046 },
      { p: [sh[0], sh[1], sh[2] + ARM - 0.03], rx: 0.04, ry: 0.04 },
      { p: [sh[0], sh[1], sh[2] + ARM], rx: 0, ry: 0 },
    ], 6), 8, [0, 1, 0]), { ...arm, color: (p) => (p.z < sh[2] + 0.15 ? INDIGO : p.z < sh[2] + 0.168 ? COLLAR : FUR) });
    b.add(blob(0.05, 0.046, 0.052, 8, 6), { ...arm, matrix: at(sh[0], sh[1], sh[2] + ARM), color: FUR });
  }
  // the mochi the turner holds up at the end (part 9): in its right paw
  b.add(blob(0.05, 0.036, 0.05, 8, 6), { part: 9, pivot: [SHX, SH[1], SH[2]], matrix: at(...HELD), color: MOCHI_W });

  /* ---- the mallet (part 6): a long handle through a wooden head, held level in front ---- */
  const kine = { part: 6, pivot: SH };
  b.add(new THREE.CylinderGeometry(0.015, 0.015, 0.62, 6).rotateX(Math.PI / 2), { ...kine, matrix: at(0, SH[1] - 0.004, SH[2] + 0.43), color: WOOD_D });
  b.add(new THREE.CylinderGeometry(KR, KR * 0.94, KHALF * 2, 10), { ...kine, matrix: at(...KH), color: (p, n) => (Math.abs(n.y) > 0.5 ? 0xe2c79a : WOOD) });
  const g = b.build();
  // every instance moves well outside the geometry's own box (the mallet over its head, a jump)
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.6, 0.1), 1.2);
  return g;
}

/** The mallet alone, in a rabbit's own frame exactly where its rig holds it (level in front), vertex-coloured. */
export function malletGeometry() {
  const col = new THREE.Color();
  const paint = (g, f) => {
    const P = g.attributes.position, N = g.attributes.normal, c = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) { col.set(f(N.getY(i))); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  };
  const handle = paint(new THREE.CylinderGeometry(0.015, 0.015, 0.62, 6).rotateX(Math.PI / 2).translate(0, SH[1] - 0.004, SH[2] + 0.43), () => WOOD_D);
  const head = paint(new THREE.CylinderGeometry(KR, KR * 0.94, KHALF * 2, 10), (ny) => (Math.abs(ny) > 0.5 ? 0xe2c79a : WOOD)).translate(KH[0], KH[1], KH[2]);
  const g = mergeGeometries([handle, head], false);
  g.computeBoundingSphere();
  return g;
}
/** Where the rig puts the mallet of a rabbit standing at (x, y, z), turned `yaw`, `scale` big, for a swing and a lean. */
const _T = new THREE.Matrix4(), _R = new THREE.Matrix4();
export function malletMatrix(out, x, y, z, yaw, scale, swing, lean) {
  out.makeTranslation(x, y, z).multiply(_R.makeRotationY(yaw)).multiply(_T.makeScale(scale, scale, scale));
  out.multiply(_T.makeTranslation(HP[0], HP[1], HP[2])).multiply(_R.makeRotationX(lean)).multiply(_T.makeTranslation(-HP[0], -HP[1], -HP[2]));
  out.multiply(_T.makeTranslation(SH[0], SH[1], SH[2])).multiply(_R.makeRotationX(swing)).multiply(_T.makeTranslation(-SH[0], -SH[1], -SH[2]));
  return out;
}

/* The rig.  Order: the arms and the mallet about the shoulders; the ears and
 * the headband's tails on the head; the head about the neck; everything above
 * the hips leans; then the whole rabbit squashes or stretches from its feet. */
export const RIG = /* glsl */`
attribute vec4 aPose3;
const vec3 HP = ${v3(HP)};
const vec3 NK = ${v3(NK)};
const vec3 SH = ${v3(SH)};
const vec3 PAW = ${v3(HELD)};
vec3 freeArm(vec3 q, float pitch, float yaw, float stretch) {
  q.z *= stretch;
  return rotY(rotX(q, pitch), yaw);
}
void rig(inout vec3 p, inout vec3 n) {
  float swing = aPose.x, lean = aPose.y, sq = aPose.z, flop = aPose.w;
  float role = aPose2.x, reach = aPose2.y, nod = aPose2.z, look = aPose2.w;
  float flick = aPose3.x, hold = aPose3.y, wipe = aPose3.z, twitch = aPose3.w;
  float id = aJoint.w;
  float w = 1.0;
  if (id < 0.5) {
    w = smoothstep(0.08, 0.26, p.y);
  } else if (id > 3.5 && id < 5.5 || id > 8.5) {
    float side = id == 4.0 ? -1.0 : 1.0;
    vec3 piv = aJoint.xyz;
    if (id > 8.5) p = PAW + (p - PAW) * smoothstep(0.7, 0.95, hold) * role;
    vec3 q = p - piv;
    vec3 nn = n;
    // free: hanging at its side; the right paw darts into the mortar or lifts the mochi; the left wipes the brow
    float pitch = ${HANG.toFixed(3)}, yaw = side * 0.22, st = 1.0;
    if (side > 0.0) {
      pitch = mix(pitch, ${REACH.toFixed(3)}, reach); st += 0.5 * reach; yaw = mix(yaw, -0.12, reach);
      pitch = mix(pitch, ${HOLD.toFixed(3)}, hold); yaw = mix(yaw, 0.45, hold); st += 0.25 * hold;
    } else {
      pitch = mix(pitch, ${WIPE.toFixed(3)}, wipe); yaw = mix(yaw, 0.6, wipe); st += 0.12 * wipe;
    }
    vec3 fr = freeArm(q, pitch, yaw, st);
    // gripping the mallet: turned in to the handle, swung with it about the shoulders
    vec3 gr = rotX(rotY(q, -side * ${GRIP.toFixed(3)}), swing);
    float grip = (1.0 - role) * (side > 0.0 ? 1.0 : 1.0 - wipe);
    p = piv + mix(fr, gr, grip);
    n = normalize(mix(rotY(rotX(nn, pitch), yaw), rotX(rotY(nn, -side * ${GRIP.toFixed(3)}), swing), grip));
  } else if (id == 6.0) {
    p = SH + rotX(p - SH, swing) * (1.0 - role);
    n = rotX(n, swing);
  } else if (id == 7.0) {
    p.x += twitch * 0.022 * step(0.5, id);
  } else {
    // the head and what rides on it
    if (id == 2.0 || id == 3.0) {
      float side = id == 2.0 ? -1.0 : 1.0;
      float t = aMorph.x;
      vec3 e = aJoint.xyz;
      float a = flop * 1.15 * pow(t, 1.3);
      vec3 q = rotZ(rotX(p - e, a), -side * twitch * 0.3 * t);
      p = e + q;
      n = rotX(n, a);
    } else if (id == 8.0) {
      vec3 k = aJoint.xyz;
      p = k + rotX(rotZ(p - k, flick * 0.9), -flick * 1.5);
    }
    p = NK + rotY(rotX(p - NK, nod), look);
    n = rotY(rotX(n, nod), look);
  }
  // the bow: everything above the hips bends forward
  p = HP + rotX(p - HP, lean * w);
  n = rotX(n, lean * w);
  // squash and stretch from the feet
  p.y *= 1.0 + sq;
  p.xz *= 1.0 - 0.45 * sq;
}
`;

/* ---- the same sums in JS, for what must meet the rig: the mallet's face in the mortar, the paws ---- */
const rotX = (y, z, a) => [Math.cos(a) * y - Math.sin(a) * z, Math.sin(a) * y + Math.cos(a) * z];
/** The middle of the mallet's striking face, [y, z] in the rabbit's own frame, for a swing and a lean. */
export function malletFace(swing, lean = 0) {
  let [y, z] = rotX(KH[1] - KHALF - SH[1], KH[2] - SH[2], swing);
  y += SH[1]; z += SH[2];
  [y, z] = rotX(y - HP[1], z - HP[2], lean);
  return [y + HP[1], z + HP[2]];
}
/** The swing that lands the mallet's face at height `y` (the rabbit's frame) with the body leaning `lean`. */
export function swingFor(y, lean) {
  let a = -0.6, c = 0.9;
  for (let i = 0; i < 24; i++) { const m = (a + c) / 2; if (malletFace(m, lean)[0] > y) a = m; else c = m; }
  return (a + c) / 2;
}
/** The turner's right paw, [x, y, z] in its own frame, reaching (0..1) with the body leaning. */
export function pawAt(reach, lean = 0, hold = 0) {
  const pitch = HANG + (REACH - HANG) * reach + (HOLD - (HANG + (REACH - HANG) * reach)) * hold;
  const yaw = (0.22 + (-0.12 - 0.22) * reach) * (1 - hold) + 0.45 * hold, st = 1 + 0.5 * reach + 0.25 * hold;
  let [y, z] = rotX(0, ARM * st, pitch);
  const x = SHX + Math.sin(yaw) * z;
  z = Math.cos(yaw) * z;
  y += SH[1]; z += SH[2];
  [y, z] = rotX(y - HP[1], z - HP[2], lean);
  return [x, y + HP[1], z + HP[2]];
}
