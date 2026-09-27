import * as THREE from 'three';
import { ANIMALS } from '../../config.js';
import { Body, loft, blob, limb, at } from './shapes.js';
import { animalMaterial, Herd, ease, turn, painted } from './shade.js';

/* ------------------------------------------------------------------ *
 * The shiba in a front yard (外飼い, by its kennel): a red shiba, cream
 * underneath (the 裏白 of cheeks, throat, chest and the tail's curl),
 * prick ears, the tail curled over its back.  It dozes with its chin on
 * its paws; hears you coming and lifts its head to watch you by; if you
 * stop at the gate it gets up and wags.
 *
 * The geometry is the lying dog; standing is a morph (the legs unfold, the
 * body rises).  Parts: 0 body, 1 head and neck, 2 tail, 3 legs.
 * aPose  x standing, y head turn, z head nod (+ down), w tail wag angle
 * aPose2 x breath, y ears back
 * ------------------------------------------------------------------ */

const RED = 0xcf7f3e, RED_D = 0xb96a33, CREAM = 0xf4e8d0, BLACK = 0x1c1818;
const UP = 0.19;                      // how far the body rises when it stands

/* 裏白 (urajiro): the cream underside, read from which way a surface faces,
 * so it blends round the body the way the real marking does. */
const under = (n, k = -0.35) => n.y < k;
const front = (n, p, w) => n.z > 0.25 && n.y < 0.35 && Math.abs(p.x) < w;

function shibaGeometry() {
  const b = new Body();
  const rise = () => [0, UP, 0];
  // the body, lying flat: a barrel on the ground, the chest a little up
  b.add(loft([
    { p: [0, 0.13, -0.24], rx: 0.02, ry: 0.02 },
    { p: [0, 0.132, -0.215], rx: 0.085, ry: 0.085 },
    { p: [0, 0.135, -0.13], rx: 0.1, ry: 0.098 },
    { p: [0, 0.142, -0.02], rx: 0.105, ry: 0.104 },
    { p: [0, 0.155, 0.08], rx: 0.11, ry: 0.114 },
    { p: [0, 0.17, 0.15], rx: 0.094, ry: 0.106 },
    { p: [0, 0.18, 0.2], rx: 0.04, ry: 0.05 },
  ], 20, [0, 1, 0], 3), {
    morph: rise,
    color: (p, n) => {
      if (front(n, p, 0.07) && p.y < 0.2) return CREAM;                        // the chest
      if (under(n)) return CREAM;                                               // the belly
      if (n.y > 0.8 && p.z < 0.05) return RED_D;                                // a darker saddle
      return RED;
    },
  });
  // haunches.  Lying, the hips rolled over to the right, that thigh flat on
  // the ground (a resting dog, not a crouch); standing, under the hips.
  for (const s of [-1, 1]) {
    b.add(blob(0.052, 0.068, 0.088, 14, 10), {
      matrix: at(s * 0.078, 0.092, -0.13, 0.2, 0, s * 0.25),
      morph: at(s * 0.058, 0.305, -0.15, 0.15, 0, 0, [0.74, 0.86, 0.74]),
      color: (p, n) => (under(n, -0.5) ? CREAM : RED),
    });
    b.add(blob(0.042, 0.06, 0.06, 12, 8), { matrix: at(s * 0.062, 0.125, 0.11), morph: at(s * 0.058, 0.3, 0.115), color: (p, n) => (front(n, p, 0.2) && n.x * s < 0.3 ? CREAM : RED) });
  }
  // a ruff round the neck, cream at the throat
  b.add(blob(0.085, 0.08, 0.06, 16, 10), { matrix: at(0, 0.18, 0.15, -0.5, 0, 0), morph: rise, color: (p, n) => (front(n, p, 0.055) ? CREAM : RED) });
  // neck and head: turning about the neck's root
  const piv = [0, 0.2, 0.15];
  const head = { part: 1, pivot: piv, morph: rise };
  b.add(loft([
    { p: [0, 0.16, 0.12], rx: 0.068, ry: 0.068 },
    { p: [0, 0.22, 0.17], rx: 0.06, ry: 0.058 },
    { p: [0, 0.27, 0.205], rx: 0.052, ry: 0.052 },
    { p: [0, 0.29, 0.222], rx: 0.0, ry: 0.0 },
  ], 16, [0, 0, 1], 2), { ...head, color: (p, n) => (front(n, p, 0.04) || under(n, -0.5) ? CREAM : RED) });
  const hc = [0, 0.3, 0.24];
  const HS = 1.18;
  const hm = (m = new THREE.Matrix4()) => new THREE.Matrix4().makeTranslation(hc[0], hc[1], hc[2])
    .multiply(new THREE.Matrix4().makeScale(HS, HS, HS)).multiply(new THREE.Matrix4().makeTranslation(-hc[0], -hc[1], -hc[2])).multiply(m);
  // the skull: broad between the ears, full at the cheeks, then the wedge
  // of the muzzle: the fox-like face
  const skull = blob(0.06, 0.054, 0.058, 22, 16);
  {
    const P = skull.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i), z = P.getZ(i);
      const cheek = 1 + 0.16 * Math.max(0, -y / 0.054) * Math.max(0, z / 0.058 + 0.3);
      P.setX(i, P.getX(i) * cheek);
    }
    skull.computeVertexNormals();
  }
  // urajiro on the face: below a line from under the eye down to the jaw's
  // corner (the cheeks and the side of the muzzle), the bridge stays red
  const face = (p) => {
    const dy = (p.y - hc[1]) / HS, dz = (p.z - hc[2]) / HS, ax = Math.abs(p.x) / HS;
    if (dz > 0.03 && dy > -0.014 && ax < 0.017) return RED;                     // the bridge of the nose
    if (dy < -0.006 - 0.12 * Math.max(0, -dz) && dz > -0.035) return CREAM;       // cheeks, jaw, muzzle
    if (dy > 0.024 && dy < 0.032 && ax > 0.018 && ax < 0.03 && dz > 0.03) return CREAM;   // the brow dots
    return RED;
  };
  b.add(skull, { ...head, matrix: hm(at(hc[0], hc[1], hc[2])), color: face });
  b.add(loft([
    { p: [0, hc[1] - 0.01, hc[2] + 0.02], rx: 0.048, ry: 0.038 },
    { p: [0, hc[1] - 0.017, hc[2] + 0.052], rx: 0.036, ry: 0.03 },
    { p: [0, hc[1] - 0.022, hc[2] + 0.078], rx: 0.027, ry: 0.023 },
    { p: [0, hc[1] - 0.024, hc[2] + 0.094], rx: 0.02, ry: 0.018 },
    { p: [0, hc[1] - 0.025, hc[2] + 0.101], rx: 0.0, ry: 0.0 },
  ], 14, [0, 1, 0], 2), { ...head, matrix: hm(), color: face });
  b.add(blob(0.017, 0.012, 0.012, 10, 6), { ...head, matrix: hm(at(0, hc[1] - 0.019, hc[2] + 0.099)), color: BLACK });
  // the mouth's line, dark under the muzzle's side
  for (const s of [-1, 1]) b.add(blob(0.004, 0.003, 0.03, 5, 3), { ...head, matrix: hm(at(s * 0.019, hc[1] - 0.036, hc[2] + 0.064, 0.1, s * 0.25, 0)), color: 0x5a3c30 });
  // eyes: small, dark, almond, set on the slant of the face
  for (const s of [-1, 1]) {
    b.add(blob(0.0115, 0.0062, 0.005, 10, 6), { ...head, matrix: hm(at(s * 0.027, hc[1] + 0.012, hc[2] + 0.051, 0, s * 0.45, s * 0.32)), color: BLACK });
  }
  // ears: triangles, wide at the base, pricked and tipped forward, cream inside
  for (const s of [-1, 1]) {
    const e = new THREE.ConeGeometry(0.036, 0.074, 4, 1);
    e.rotateY(Math.PI / 4);
    e.scale(1.0, 1, 0.5);
    b.add(e, { ...head, matrix: hm(at(s * 0.035, hc[1] + 0.07, hc[2] - 0.006, 0.28, 0, -s * 0.2)), color: (p, n, l) => (l.z > 0.004 && l.y < 0.02 && Math.abs(l.x) < 0.02 ? 0xf0d8c4 : RED) });
  }
  // the tail: a thick curl over the back, cream beneath
  const tb = [0, 0.2, -0.22];
  const curl = loft([
    { p: [0, 0.2, -0.23], rx: 0.042, ry: 0.042 },
    { p: [0, 0.27, -0.26], rx: 0.048, ry: 0.048 },
    { p: [0, 0.335, -0.22], rx: 0.048, ry: 0.048 },
    { p: [0.012, 0.345, -0.14], rx: 0.044, ry: 0.044 },
    { p: [0.048, 0.305, -0.1], rx: 0.036, ry: 0.036 },
    { p: [0.072, 0.275, -0.13], rx: 0.024, ry: 0.024 },
    { p: [0.078, 0.268, -0.15], rx: 0.0, ry: 0.0 },
  ], 12, [1, 0, 0], 3);
  b.add(curl, { part: 2, pivot: tb, morph: rise, color: (p, n) => (n.y > 0.2 || p.x > 0.045 ? RED : CREAM) });
  // legs: each a loft through its joints, lying and standing, the same
  // sections (so the morph between them is a clean fold, never a knot),
  // and a round paw that rides with it
  const leg = (lie, stand, radii, pawLie, pawStand) => {
    const mk = (pts) => loft(pts.map((q, i) => ({ p: q, rx: radii[i], ry: radii[i] })), 10, [1, 0, 0], 3);
    const gl = mk(lie), gs = mk(stand);
    const PS = gs.attributes.position;
    let vi = 0;
    // red outside, cream on the inner face and the lower leg (by how far down the leg, not by height)
    const N = gl.attributes.position.count, rings = N - 2;
    let ci = 0;
    b.add(gl, { part: 3, color: (p, n, l) => { const t = ci++ / rings; return t > 0.72 || n.x * Math.sign(l.x) < -0.55 ? CREAM : RED; }, morph: () => { const d = [PS.getX(vi) - gl.attributes.position.getX(vi), PS.getY(vi) - gl.attributes.position.getY(vi), PS.getZ(vi) - gl.attributes.position.getZ(vi)]; vi++; return d; } });
    b.add(blob(0.022, 0.015, 0.03, 10, 6), { part: 3, matrix: at(...pawLie), morph: at(...pawStand), color: CREAM });
  };
  for (const s of [-1, 1]) {
    // forelegs: straight and slim when standing; out in front, lying
    leg([[s * 0.06, 0.13, 0.12], [s * 0.064, 0.05, 0.14], [s * 0.062, 0.03, 0.2], [s * 0.062, 0.026, 0.25]],
      [[s * 0.058, 0.33, 0.12], [s * 0.058, 0.2, 0.116], [s * 0.058, 0.08, 0.124], [s * 0.058, 0.036, 0.13]],
      [0.03, 0.022, 0.019, 0.018], [s * 0.062, 0.018, 0.27], [s * 0.058, 0.016, 0.142]);
    // hind legs: thigh, the angled shank, the hock, the upright foot.  Lying,
    // the right one stretched out to the side, the left tucked under.
    const lie = [[s * 0.065, 0.1, -0.15], [s * 0.084, 0.07, -0.09], [s * 0.09, 0.05, -0.14], [s * 0.092, 0.036, -0.075]];
    leg(lie,
      [[s * 0.06, 0.3, -0.16], [s * 0.064, 0.19, -0.115], [s * 0.063, 0.095, -0.2], [s * 0.063, 0.036, -0.19]],
      [0.036, 0.022, 0.018, 0.017], [s * 0.094, 0.018, -0.045], [s * 0.063, 0.016, -0.175]);
  }
  return b.build();
}

const RIG = /* glsl */`
void rig(inout vec3 p, inout vec3 n) {
  float stand = aPose.x, look = aPose.y, nod = aPose.z, wag = aPose.w;
  float breath = aPose2.x;
  p += aMorph * stand;
  vec3 piv = aJoint.xyz + vec3(0.0, ${UP.toFixed(3)} * stand, 0.0);
  if (isPart(0.0)) {
    // breathing: the ribs rise and fall
    p.x *= 1.0 + breath * 0.025 * smoothstep(-0.1, 0.1, p.z);
    p.y += breath * 0.006 * smoothstep(0.1, 0.25, p.y);
  }
  if (isPart(1.0)) {
    vec3 q = p - piv;
    q = rotX(q, nod);
    q = rotY(q, look);
    n = rotY(rotX(n, nod), look);
    p = piv + q;
  }
  if (isPart(2.0)) {
    vec3 q = p - piv;
    q = rotZ(q, wag);
    q = rotY(q, wag * 0.6);
    n = rotY(rotZ(n, wag), wag * 0.6);
    p = piv + q;
  }
}
`;

/** A kennel: pale timber, a dark red roof, a round door; the dog's bowl. */
function kennelGeometry(bowl = [0.45, 0.5]) {
  const b = new Body();
  const wood = (p) => (Math.sin(p.y * 70) > 0.85 ? 0xa4845e : 0xc4a57c);
  b.add(new THREE.BoxGeometry(0.62, 0.46, 0.72).translate(0, 0.25, 0), { color: wood });
  b.add(new THREE.BoxGeometry(0.66, 0.04, 0.76).translate(0, 0.02, 0), { color: 0x8a6c4c });
  // gable roof
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(0.42, 0.03, 0.84);
    b.add(g, { matrix: at(s * 0.17, 0.58, 0, 0, 0, -s * 0.62), color: 0x8e3a30 });
  }
  const gable = new THREE.BufferGeometry();
  gable.setAttribute('position', new THREE.Float32BufferAttribute([-0.31, 0.48, 0.361, 0.31, 0.48, 0.361, 0, 0.7, 0.361, 0.31, 0.48, -0.361, -0.31, 0.48, -0.361, 0, 0.7, -0.361], 3));
  gable.computeVertexNormals();
  b.add(gable, { color: wood });
  // the door: a dark arch in front
  const door = new THREE.CircleGeometry(0.15, 14, 0, Math.PI);
  const pts = door.attributes.position;
  for (let i = 0; i < pts.count; i++) pts.setY(i, pts.getY(i) * 1.1);
  b.add(door, { matrix: at(0, 0.2, 0.362), color: 0x2a221e });
  b.add(new THREE.PlaneGeometry(0.3, 0.2).translate(0, 0.1, 0.362), { color: 0x2a221e });
  // a steel bowl
  b.add(new THREE.CylinderGeometry(0.09, 0.07, 0.05, 14).translate(bowl[0], 0.025, bowl[1]), { color: 0xc4c8d0 });
  b.add(new THREE.CylinderGeometry(0.075, 0.075, 0.01, 14).translate(bowl[0], 0.045, bowl[1]), { color: 0x7fa8c8 });
  return b.build();
}

/** The shiba at `spot` { x, z, y, yaw } (the kennel behind it). */
export function buildShiba(ctx, { spot, shadows }) {
  const A = ANIMALS.shiba;
  const geo = shibaGeometry();
  const mat = animalMaterial({ key: 'shiba', rig: RIG, tint: 0x7a6488 });
  const herd = new Herd(ctx, geo, mat, 1, 'shiba', { bounds: [spot.x, spot.y, spot.z, 3] });
  // the kennel, a pace behind and to one side
  const kx = spot.kennel?.x ?? spot.x + Math.cos(spot.yaw) * 0.85, kz = spot.kennel?.z ?? spot.z - Math.sin(spot.yaw) * 0.85;
  const kyaw = spot.kennelYaw ?? spot.yaw;
  // the bowl where the placer found room, in the kennel's own frame
  const bw = spot.bowl ? [(spot.bowl.x - kx) * Math.cos(kyaw) - (spot.bowl.z - kz) * Math.sin(kyaw), (spot.bowl.x - kx) * Math.sin(kyaw) + (spot.bowl.z - kz) * Math.cos(kyaw)] : undefined;
  const kennel = new THREE.Mesh(kennelGeometry(bw), painted());
  kennel.position.set(kx, spot.y, kz);
  kennel.rotation.y = kyaw;
  kennel.castShadow = kennel.receiveShadow = true;
  kennel.name = 'animals-kennel';
  ctx.add(kennel);
  ctx.collide(kx - 0.45, kz - 0.45, kx + 0.45, kz + 0.45, spot.y + 0.7);
  ctx.collide(spot.x - 0.3, spot.z - 0.3, spot.x + 0.3, spot.z + 0.3, spot.y + 0.5);

  const dog = { stand: 0, look: 0, nod: 0, wag: 0, wagA: 0, breath: 0, t: 0, state: 'watch', seen: 0, away: 0, shadow: shadows.slot(), ph: 0 };
  const place = () => {
    herd.set(0, spot.x, spot.y, spot.z, spot.yaw, 0, 0, A.size);
    herd.setPose(0, dog.stand, dog.look, dog.nod, dog.wag);
    herd.setPose2(0, dog.breath, 0, 0, 0);
    shadows.set(dog.shadow, spot.x + Math.sin(spot.yaw) * 0.03, spot.y, spot.z + Math.cos(spot.yaw) * 0.03, 0.17 * A.size, 0.36 * A.size, spot.yaw);
  };
  place();
  herd.flush();

  function update(dt, cam) {
    dog.t += dt;
    const dx = cam.x - spot.x, dz = cam.z - spot.z;
    const d = Math.hypot(dx, dz);
    // where you are, from its head: a turn and a tilt, within what a neck does
    const toYaw = THREE.MathUtils.clamp(turn(spot.yaw, Math.atan2(dx, dz)), -1.25, 1.25);
    const headY = spot.y + (0.3 + UP * dog.stand) * A.size;
    const toNod = THREE.MathUtils.clamp(-Math.atan2(cam.y - headY, Math.max(0.5, d)) * 0.8, -0.5, 0.35);
    if (d < A.hear) dog.seen += dt; else dog.seen = 0;
    if (d > A.leave) dog.away += dt; else dog.away = 0;
    if (dog.state === 'doze') {
      dog.look += (0.2 - dog.look) * Math.min(1, dt);
      dog.nod += (0.85 - dog.nod) * Math.min(1, dt * 1.5);
      if (dog.seen > 0.6) dog.state = 'watch';
    } else if (dog.state === 'watch' || dog.state === 'up') {
      dog.look += (toYaw - dog.look) * Math.min(1, dt * 3);
      dog.nod += (toNod - dog.nod) * Math.min(1, dt * 3);
      if (dog.state === 'watch' && d < A.greet) { dog.greetT = (dog.greetT ?? 0) + dt; if (dog.greetT > 1.2) dog.state = 'up'; } else dog.greetT = 0;
      if (dog.state === 'up' && d > A.greet + 2.5) { dog.downT = (dog.downT ?? 0) + dt; if (dog.downT > 3) { dog.state = 'watch'; dog.downT = 0; } } else dog.downT = 0;
      if (dog.away > 4) dog.state = 'doze';
    }
    const standTo = dog.state === 'up' ? 1 : 0;
    dog.stand += Math.sign(standTo - dog.stand) * Math.min(Math.abs(standTo - dog.stand), dt * 1.4);
    // the wag: quick and wide when it's up, a slow sweep when watching
    const wagTo = dog.state === 'up' ? 0.5 : dog.state === 'watch' && d < A.greet * 2 ? 0.12 : 0;
    dog.wagA += (wagTo - dog.wagA) * Math.min(1, dt * 3);
    dog.ph += dt * (dog.state === 'up' ? 13 : 6);
    dog.wag = Math.sin(dog.ph) * dog.wagA;
    dog.breath = Math.sin(dog.t * (dog.state === 'doze' ? 1.6 : 3.2)) * (dog.state === 'doze' ? 1 : 0.6);
    place();
    herd.flush();
  }
  return { update, herd, dog };
}
