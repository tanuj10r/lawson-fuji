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

const RED = 0xcf7f3e, RED_D = 0xb5652e, CREAM = 0xf3e6cc, BLACK = 0x1c1818;
const UP = 0.19;                      // how far the body rises when it stands

function shibaGeometry() {
  const b = new Body();
  const rise = () => [0, UP, 0];
  // the body, lying: a barrel on the ground, cream underneath
  const cream = (p, under) => (p.y < under ? CREAM : RED);
  b.add(loft([
    { p: [0, 0.13, -0.24], rx: 0.02, ry: 0.02 },
    { p: [0, 0.135, -0.215], rx: 0.085, ry: 0.085 },
    { p: [0, 0.14, -0.13], rx: 0.1, ry: 0.098 },
    { p: [0, 0.15, -0.02], rx: 0.106, ry: 0.108 },
    { p: [0, 0.165, 0.08], rx: 0.112, ry: 0.12 },
    { p: [0, 0.18, 0.15], rx: 0.094, ry: 0.11 },
    { p: [0, 0.19, 0.2], rx: 0.04, ry: 0.05 },
  ], 20, [0, 1, 0], 3), {
    morph: rise,
    color: (p) => {
      if (p.z > 0.12 && Math.abs(p.x) < 0.06 && p.y < 0.2) return CREAM;       // the chest
      if (p.y > 0.23 && Math.abs(p.x) < 0.05 && p.z < 0.05) return RED_D;     // a darker line down the back
      return cream(p, 0.085);
    },
  });
  // the haunches: round thighs on the ground either side (lying), under the hips (standing)
  for (const s of [-1, 1]) {
    b.add(blob(0.05, 0.07, 0.085, 14, 10), {
      matrix: at(s * 0.078, 0.1, -0.13, 0.25, 0, s * 0.15),
      morph: at(s * 0.058, 0.31, -0.15, 0.2, 0, 0, [0.72, 0.8, 0.72]),
      color: (p, n, l) => (l.y < -0.035 && l.z > -0.02 ? CREAM : RED),
    });
    // the shoulders over the forelegs
    b.add(blob(0.042, 0.06, 0.06, 12, 8), { matrix: at(s * 0.062, 0.13, 0.11), morph: at(s * 0.058, 0.3, 0.115), color: RED });
  }
  // a ruff round the neck
  b.add(blob(0.085, 0.08, 0.06, 16, 10), { matrix: at(0, 0.19, 0.15, -0.5, 0, 0), morph: rise, color: (p) => (p.z > 0.17 && Math.abs(p.x) < 0.05 ? CREAM : RED) });
  // neck and head: turning about the neck's root
  const piv = [0, 0.2, 0.15];
  const head = { part: 1, pivot: piv, morph: rise };
  b.add(loft([
    { p: [0, 0.16, 0.12], rx: 0.07, ry: 0.07 },
    { p: [0, 0.22, 0.17], rx: 0.065, ry: 0.062 },
    { p: [0, 0.27, 0.2], rx: 0.058, ry: 0.058 },
    { p: [0, 0.3, 0.22], rx: 0.0, ry: 0.0 },
  ], 16, [0, 0, 1], 2), { ...head, color: (p) => (p.z > 0.17 && Math.abs(p.x) < 0.045 && p.y < 0.26 ? CREAM : RED) });
  const hc = [0, 0.3, 0.24];
  // the skull, cheeks puffed out cream
  b.add(blob(0.07, 0.064, 0.07, 20, 14), {
    ...head, matrix: at(hc[0], hc[1], hc[2]),
    color: (p) => (p.y < hc[1] - 0.012 && p.z > hc[2] - 0.02 ? CREAM : p.y > hc[1] + 0.035 && Math.abs(p.x) < 0.02 && p.z > hc[2] + 0.03 ? CREAM : RED),
  });
  for (const s of [-1, 1]) b.add(blob(0.04, 0.034, 0.04, 14, 10), { ...head, matrix: at(s * 0.046, hc[1] - 0.024, hc[2] + 0.035), color: CREAM });
  // the muzzle: short and tapering, cream, a black nose
  b.add(loft([
    { p: [0, hc[1] - 0.012, hc[2] + 0.04], rx: 0.04, ry: 0.034 },
    { p: [0, hc[1] - 0.018, hc[2] + 0.085], rx: 0.03, ry: 0.026 },
    { p: [0, hc[1] - 0.022, hc[2] + 0.115], rx: 0.02, ry: 0.018 },
    { p: [0, hc[1] - 0.022, hc[2] + 0.125], rx: 0.0, ry: 0.0 },
  ], 14, [0, 1, 0], 2), { ...head, color: (p) => (p.y > hc[1] - 0.004 && p.z < hc[2] + 0.08 ? RED : CREAM) });
  b.add(blob(0.014, 0.011, 0.01, 8, 5), { ...head, matrix: at(0, hc[1] - 0.012, hc[2] + 0.123), color: BLACK });
  // eyes: small, dark, a little almond (slanted); cream brows over them
  for (const s of [-1, 1]) {
    b.add(blob(0.011, 0.008, 0.006, 8, 5), { ...head, matrix: at(s * 0.03, hc[1] + 0.012, hc[2] + 0.062, 0, 0, s * 0.35), color: BLACK });
    b.add(blob(0.01, 0.006, 0.006, 6, 4), { ...head, matrix: at(s * 0.028, hc[1] + 0.03, hc[2] + 0.06), color: CREAM });
  }
  // ears: pricked, thick triangles leaning forward, cream inside
  for (const s of [-1, 1]) {
    const e = new THREE.ConeGeometry(0.036, 0.085, 6, 1);
    e.scale(1.1, 1, 0.55);
    b.add(e, { ...head, matrix: at(s * 0.042, hc[1] + 0.088, hc[2] - 0.008, 0.22, 0, -s * 0.2), color: (p) => (p.z > hc[2] + 0.004 && p.y < hc[1] + 0.105 ? CREAM : RED) });
  }
  // the tail: a thick cream-and-red curl over the back
  const tb = [0, 0.2, -0.22];
  const curl = loft([
    { p: [0, 0.2, -0.23], rx: 0.036, ry: 0.036 },
    { p: [0, 0.27, -0.26], rx: 0.04, ry: 0.04 },
    { p: [0, 0.33, -0.22], rx: 0.04, ry: 0.04 },
    { p: [0.01, 0.34, -0.14], rx: 0.036, ry: 0.036 },
    { p: [0.045, 0.3, -0.1], rx: 0.03, ry: 0.03 },
    { p: [0.07, 0.27, -0.13], rx: 0.02, ry: 0.02 },
    { p: [0.075, 0.265, -0.15], rx: 0.0, ry: 0.0 },
  ], 12, [1, 0, 0], 3);
  b.add(curl, { part: 2, pivot: tb, morph: rise, color: (p) => (p.y > 0.315 || p.x > 0.03 ? RED : CREAM) });
  // legs.  Lying: the forelegs out in front on the ground, the hind legs
  // folded along the flanks.  Standing (the morph): straight under the body.
  const leg = (lie, stand, r0, r1, paw) => {
    const mk = (pts) => loft(pts.map((q, i) => ({ p: q, rx: i === 0 ? r0 : i === pts.length - 1 ? 0.0 : r0 + (r1 - r0) * (i / (pts.length - 1)), ry: i === 0 ? r0 : i === pts.length - 1 ? 0.0 : r0 + (r1 - r0) * (i / (pts.length - 1)) })), 10, [0, 1, 0], 3);
    const gl = mk(lie), gs = mk(stand);
    const PS = gs.attributes.position;
    let vi = 0;
    b.add(gl, { part: 3, color: (p, n, l) => (paw(l) ? CREAM : RED), morph: (p) => { const d = [PS.getX(vi) - p.x, PS.getY(vi) - p.y, PS.getZ(vi) - p.z]; vi++; return d; } });
  };
  for (const s of [-1, 1]) {
    // forelegs: shoulder, elbow, wrist, paw
    leg([[s * 0.06, 0.15, 0.12], [s * 0.065, 0.06, 0.14], [s * 0.062, 0.025, 0.22], [s * 0.062, 0.02, 0.29], [s * 0.062, 0.02, 0.3]],
      [[s * 0.06, 0.34, 0.12], [s * 0.06, 0.2, 0.125], [s * 0.06, 0.08, 0.13], [s * 0.06, 0.02, 0.15], [s * 0.06, 0.02, 0.16]],
      0.035, 0.026, (l) => l.y < 0.045 && l.z > 0.2);
    // hind legs: hip, knee, hock, paw
    leg([[s * 0.075, 0.13, -0.15], [s * 0.1, 0.07, -0.04], [s * 0.095, 0.03, -0.12], [s * 0.09, 0.02, -0.02], [s * 0.09, 0.02, -0.01]],
      [[s * 0.065, 0.3, -0.17], [s * 0.068, 0.2, -0.13], [s * 0.066, 0.1, -0.21], [s * 0.066, 0.02, -0.18], [s * 0.066, 0.02, -0.17]],
      0.045, 0.026, (l) => l.y < 0.04 && l.z > -0.06);
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
function kennelGeometry() {
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
  b.add(new THREE.CylinderGeometry(0.09, 0.07, 0.05, 14).translate(0.45, 0.025, 0.5), { color: 0xc4c8d0 });
  b.add(new THREE.CylinderGeometry(0.075, 0.075, 0.01, 14).translate(0.45, 0.045, 0.5), { color: 0x7fa8c8 });
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
  const kennel = new THREE.Mesh(kennelGeometry(), painted());
  kennel.position.set(kx, spot.y, kz);
  kennel.rotation.y = spot.yaw;
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
      dog.nod += (0.55 - dog.nod) * Math.min(1, dt * 1.5);
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
