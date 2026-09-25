import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { rngKit, box, cyl } from '../../core/util.js';
import { hullOutline } from '../../core/outline.js';
import { makeWalkup, makeBikeShelter } from '../housing.js';
import { makeTimberFence } from '../buildings.js';
import {
  makeBench, makeTapPost, makePlanter, makeAircon, makeMailboxBank, makeBicycle, makeBikeRack, makeWires,
} from '../props.js';
import { makeWheelStops } from '../streetprops.js';
import { makeVehicle, tyreMarks } from '../vehicles.js';
import { buildShrubs } from '../trees.js';
import { ROADS } from '../../config.js';
import { COIN_PARKING, SHRINE, FOR_SALE, PARK_NAME } from '../../data/town.js';
import { signPost } from './signs.js';
import { noboriTex } from './tex.js';
import { LAYER } from './decals.js';

/* ------------------------------------------------------------------ *
 * The special lots (SPEC section 3, mixing): an inari shrine, the coin
 * parking, a 2-floor apartment block, a weedy vacant lot, a tiny park,
 * and for now the station plaza's paving and its big sakura (M2c fills
 * the plaza in).
 *
 * Each is given its world rectangle and the side its frontage faces
 * (town-plan.js SPECIALS), and builds in a local frame: u along the
 * frontage (-w/2..w/2), v back from it (0..d).
 * ------------------------------------------------------------------ */

const AY = ROADS.asphaltY;

function frame(s) {
  const W = s.x1 - s.x0, D = s.z1 - s.z0;
  const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
  // face: which world direction the frontage looks
  const f = { 'z-': [0, -1], 'z+': [0, 1], 'x-': [-1, 0], 'x+': [1, 0] }[s.face];
  const along = s.face[0] === 'z';
  const w = along ? W : D, d = along ? D : W;
  const r = [-f[1], f[0]];              // u axis: the frontage's own right, looking out
  return {
    w, d, f: { x: f[0], z: f[1] },
    /** world point at u along the frontage, v back from it */
    at(u, v) {
      const fx = cx + f[0] * (d / 2), fz = cz + f[1] * (d / 2);   // frontage centre
      return { x: fx + r[0] * u - f[0] * v, z: fz + r[1] * u - f[1] * v };
    },
    ry: Math.atan2(f[0], f[1]),          // turns a +z-facing part to look out
  };
}

const reg = (ctx, kind, p) => ctx.registry?.push({ kind, x: p.x, z: p.z });

export function buildSpecial(ctx, net, kit, s) {
  const fn = { coinParking, shrine, apartment, vacant, park, plaza }[s.kind];
  return fn?.(ctx, net, kit, s, frame(s));
}

/* ---------------------------------------------------------------- mats */
let M = null;
function mats() {
  if (M) return M;
  M = {
    red: cel({ color: 0xd2402f, bands: 3, tint: 0x7a4060 }),
    black: cel({ color: 0x2e2a34, bands: 2, tint: 0x4b4560 }),
    stone: cel({ color: 0xb5afbd, bands: 3, tint: 0x655d80 }),
    stoneDark: cel({ color: 0x8f889a, bands: 3, tint: 0x605878 }),
    gravel: cel({ color: 0xd8d0c2, bands: 3, tint: 0x6f6790 }),
    grass: cel({ color: 0x9cc48f, bands: 3, tint: 0x5b6f8c }),
    weeds: cel({ color: 0x8fae6e, bands: 3, tint: 0x5b6f8c }),
    earth: cel({ color: 0xb8a58a, bands: 3, tint: 0x6f5a80 }),
    sand: cel({ color: 0xe8d8b0, bands: 3, tint: 0x7a6a80 }),
    paving: cel({ color: 0xdcd5d0, bands: 3, tint: 0x7d74a0 }),
    wood: cel({ color: 0x9c7f5e, bands: 3, tint: 0x5c5680 }),
    metal: cel({ color: 0xb8bcc6, bands: 3, tint: 0x666090 }),
    white: cel({ color: 0xf4f2ee, bands: 3, tint: 0x6f6790 }),
    machine: cel({ color: 0xe6e2da, bands: 3, tint: 0x6a6288 }),
    rope: cel({ color: 0xd8c8a0, bands: 2, tint: 0x6f6790 }),
  };
  return M;
}

/** A ground slab over a special lot. */
function ground(ctx, s, mat, y = 0.03) {
  const b = box(s.x1 - s.x0, y, s.z1 - s.z0, mat, (s.x0 + s.x1) / 2, y / 2, (s.z0 + s.z1) / 2);
  b.receiveShadow = true;
  ctx.add(b);
  return b;
}

/* --------------------------------------------------------- coin parking
 * The paved lot across the road from the store, where the famous photo is
 * taken.  One row of bays along its back, nosed in, with the lock flaps;
 * the middle stays clear, because that is where the photographers stand. */
function coinParking(ctx, net, kit, s, F) {
  const r = rngKit(9101);
  const m = mats();
  const bayW = 2.5, bayD = 5.2;
  const vBack = F.d - 0.4;
  const us = [];
  for (let u = -F.w / 2 + 1.5; u < F.w / 2 - 1.5; u += bayW) {
    if (Math.abs(F.at(u, 0).x) < 6.5) continue;     // the photographers' clear strip, round x = 0
    us.push(u);
  }
  for (const u of us) {
    // bay lines: two sides and the back
    for (const du of [-bayW / 2, bayW / 2]) {
      const p = F.at(u + du, vBack - bayD / 2);
      kit.decals.add('white', p.x, p.z, 0.12, bayD, F.f, AY - 0.012, LAYER.paint);
    }
    const stop = F.at(u, vBack - 0.7);
    const ws = makeWheelStops({ x: stop.x, y: 0, z: stop.z, ry: F.ry, n: 1 });
    ctx.add(ws);
    // the lock flap in the middle of the bay
    const flap = F.at(u, vBack - 2.6);
    const lock = box(0.5, 0.12, 0.9, m.metal, flap.x, 0.06, flap.z);
    lock.rotation.y = F.ry;
    ctx.add(lock);
    reg(ctx, 'prop', stop);
    if (r.chance(0.6)) {
      const c = F.at(u, vBack - 2.5);
      const car = makeVehicle({ kind: r.pick(['kei', 'kei', 'hatch', 'keivan', 'wagon']), color: r.pick([0xf2eee6, 0xd9665a, 0x9fc0dc, 0xa8d4b4, 0x7f93a4, 0xe9dfc6, 0x3c3c48]) });
      car.position.set(c.x, 0, c.z);
      car.rotation.y = F.ry + Math.PI / 2;   // nosed in, toward the back (cars are authored nose +x)
      car.userData.detail = true;
      ctx.add(car);
      ctx.collide(c.x - 1.3, c.z - 1.3, c.x + 1.3, c.z + 1.3, 1.6);
      reg(ctx, 'prop', c);
    }
  }
  // a light over the bays, wired to the street
  const lp = F.at(F.w * 0.15, F.d - 0.4);
  kit.standPole(lp.x, lp.z);
  // the pay machine and the tall sign at the corner by the lane
  const pm = F.at(-F.w / 2 + 1.2, F.d - 1.2);
  const machine = box(0.62, 1.45, 0.5, m.machine, pm.x, 0.725, pm.z);
  machine.rotation.y = F.ry;
  machine.castShadow = true;
  ctx.add(machine);
  hullOutline(machine, { thickness: 0.003 });
  const screen = box(0.4, 0.3, 0.02, flat({ color: 0x4a7ab8 }), pm.x + F.f.x * 0.26, 1.1, pm.z + F.f.z * 0.26);
  screen.rotation.y = F.ry;
  ctx.add(screen);
  ctx.collide(pm.x - 0.4, pm.z - 0.4, pm.x + 0.4, pm.z + 0.4, 1.45);
  reg(ctx, 'prop', pm);
  const sp = F.at(-F.w / 2 + 0.6, 1.0);
  signPost(ctx, { x: sp.x, z: sp.z, ry: F.ry, h: 3.6, name: 'sign-parking', plates: [{ kind: 'parking', o: COIN_PARKING, w: 0.9, y: 2.9, double: true }] });
}

/* --------------------------------------------------------------- shrine
 * 稲荷: a red torii at the lane, a stone path, a pair of foxes, stone
 * lanterns, red nobori down the path, the little hall at the back, a
 * low fence round it and a tree over it. */
function shrine(ctx, net, kit, s, F) {
  const m = mats();
  ground(ctx, s, m.gravel, 0.04);
  // the path
  for (let v = 0.6; v < F.d - 3.5; v += 0.9) {
    const p = F.at(0, v);
    const st = box(1.1, 0.06, 0.7, m.stone, p.x, 0.05, p.z);
    st.rotation.y = F.ry;
    st.receiveShadow = true;
    ctx.add(st);
  }
  // torii at the front, and a smaller one halfway
  torii(ctx, F, 0.8, 3.0, 4.3);
  torii(ctx, F, F.d * 0.45, 2.0, 3.2);
  // foxes either side of the path, on plinths
  for (const su of [-1, 1]) {
    const p = F.at(su * 1.4, 2.6);
    ctx.add(fox(p, F.ry + su * -0.25, su));
    ctx.collide(p.x - 0.35, p.z - 0.35, p.x + 0.35, p.z + 0.35, 1.6);
    reg(ctx, 'prop', p);
    const l = F.at(su * 1.6, F.d * 0.62);
    ctx.add(stoneLantern(l));
    ctx.collide(l.x - 0.3, l.z - 0.3, l.x + 0.3, l.z + 0.3, 1.8);
    reg(ctx, 'prop', l);
  }
  // nobori down both sides of the path
  const cloth = flat({ color: 0xffffff, map: noboriTex(SHRINE.nobori), side: THREE.DoubleSide, cache: false });
  for (let v = 1.8; v < F.d - 4; v += 1.9) {
    for (const su of [-1, 1]) {
      const p = F.at(su * 2.5, v);
      const g = new THREE.Group();
      g.add(cyl(0.025, 0.025, 3.2, 5, m.metal, 0, 1.6, 0));
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.8), cloth);
      c.position.set(0.23, 2.1, 0);
      c.castShadow = true;
      c.userData.noOutline = true;
      g.add(c);
      g.position.set(p.x, 0, p.z);
      g.rotation.y = F.ry + Math.PI / 2;
      ctx.add(g);
      ctx.collide(p.x - 0.12, p.z - 0.12, p.x + 0.12, p.z + 0.12, 3.2);
      reg(ctx, 'prop', p);
    }
  }
  // the hall
  const hp = F.at(0, F.d - 2.0);
  const hall = new THREE.Group();
  hall.add(box(2.2, 0.5, 2.0, m.stone, 0, 0.25, 0));
  hall.add(box(1.7, 1.6, 1.5, m.wood, 0, 1.3, 0));
  hall.add(box(1.5, 1.2, 0.05, m.red, 0, 1.3, 0.76));
  const roofMat = cel({ color: 0x5a6070, bands: 3, tint: 0x4a4468 });
  for (const sx of [-1, 1]) {
    const slab = box(1.45, 0.1, 2.4, roofMat, sx * 0.62, 2.35, 0);
    slab.rotation.z = -sx * 0.5;
    hall.add(slab);
  }
  hall.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  hall.position.set(hp.x, 0, hp.z);
  hall.rotation.y = F.ry;
  ctx.add(hall);
  hullOutline(hall.children[1], { thickness: 0.003 });
  ctx.collide(hp.x - 1.2, hp.z - 1.2, hp.x + 1.2, hp.z + 1.2, 2.6);
  ctx.registry?.push({ kind: 'building', x: hp.x, z: hp.z, rect: [hp.x - 1.1, hp.z - 1.1, hp.x + 1.1, hp.z + 1.1] });
  // the name post at the gate
  const np = F.at(-2.4, 0.3);
  signPost(ctx, { x: np.x, z: np.z, ry: F.ry, h: 1.6, name: 'sign-shrine', plates: [{ kind: 'shrineName', o: { t: SHRINE.name }, w: 0.3, y: 0.95 }] });
  // fence round the sides and back, and a big tree behind
  shrineFence(ctx, s, F);
  const t = F.at(F.w / 2 - 2.2, F.d - 2.2);
  ctx.sakura.push({ x: t.x, z: t.z, y: 0, scale: 1.6, seed: 7701 });        // a hero tree over the shrine
  ctx.collide(t.x - 0.4, t.z - 0.4, t.x + 0.4, t.z + 0.4, 3);
}

function torii(ctx, F, v, halfW, H) {
  const m = mats();
  const g = new THREE.Group();
  for (const su of [-1, 1]) {
    const post = cyl(0.14, 0.17, H, 10, m.red, su * halfW * 0.5, H / 2, 0);
    post.castShadow = true;
    g.add(post);
    g.add(cyl(0.2, 0.2, 0.3, 10, m.black, su * halfW * 0.5, 0.15, 0));
    hullOutline(post, { thickness: 0.003 });
  }
  const kasagi = box(halfW + 1.3, 0.22, 0.34, m.black, 0, H + 0.12, 0);
  const shimaki = box(halfW + 1.0, 0.2, 0.3, m.red, 0, H - 0.1, 0);
  const nuki = box(halfW + 0.5, 0.18, 0.18, m.red, 0, H - 0.8, 0);
  for (const b of [kasagi, shimaki, nuki]) { b.castShadow = true; g.add(b); }
  hullOutline(kasagi, { thickness: 0.003 });
  const p = F.at(0, v);
  g.position.set(p.x, 0, p.z);
  g.rotation.y = F.ry;
  ctx.add(g);
  for (const su of [-1, 1]) {
    const q = F.at(su * halfW * 0.5, v);
    ctx.collide(q.x - 0.2, q.z - 0.2, q.x + 0.2, q.z + 0.2, H);
  }
  reg(ctx, 'prop', p);
}

/** A seated stone fox with a red bib and a scroll in its mouth. */
function fox(p, ry, su) {
  const m = mats();
  const g = new THREE.Group();
  g.add(box(0.6, 0.7, 0.6, m.stoneDark, 0, 0.35, 0));
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 8), m.white);
  body.position.set(0, 0.97, 0);
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), m.white);
  head.position.set(0, 1.32, 0.05);
  g.add(head);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), m.white);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 1.3, 0.2);
  g.add(snout);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 4), m.white);
    ear.position.set(s * 0.07, 1.47, 0.02);
    g.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 6), m.white);
  tail.position.set(su * 0.12, 1.05, -0.18);
  tail.rotation.x = -0.5;
  g.add(tail);
  const bib = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.2), cel({ color: 0xd2402f, bands: 2, side: THREE.DoubleSide }));
  bib.position.set(0, 1.12, 0.14);
  bib.rotation.x = 0.2;
  g.add(bib);
  g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  hullOutline(body, { thickness: 0.003 });
  g.position.set(p.x, 0, p.z);
  g.rotation.y = ry;
  return g;
}

function stoneLantern(p) {
  const m = mats();
  const g = new THREE.Group();
  g.add(box(0.5, 0.15, 0.5, m.stoneDark, 0, 0.075, 0));
  g.add(cyl(0.1, 0.12, 0.8, 8, m.stone, 0, 0.55, 0));
  g.add(box(0.44, 0.1, 0.44, m.stone, 0, 1.0, 0));
  g.add(box(0.34, 0.34, 0.34, m.stone, 0, 1.22, 0));
  g.add(box(0.3, 0.2, 0.36, flat({ color: 0x3a3440 }), 0, 1.22, 0));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.3, 4), m.stoneDark);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 1.55, 0);
  g.add(roof);
  g.add(cyl(0.05, 0.05, 0.12, 6, m.stone, 0, 1.76, 0));
  g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  hullOutline(roof, { thickness: 0.003 });
  g.position.set(p.x, 0, p.z);
  return g;
}

function shrineFence(ctx, s, F) {
  // sides and back; the front is open at the torii
  const runs = [
    [F.at(-F.w / 2 + 0.2, 0.3), F.at(-F.w / 2 + 0.2, F.d - 0.2)],
    [F.at(F.w / 2 - 0.2, 0.3), F.at(F.w / 2 - 0.2, F.d - 0.2)],
    [F.at(-F.w / 2 + 0.2, F.d - 0.2), F.at(F.w / 2 - 0.2, F.d - 0.2)],
  ];
  for (const [a, b] of runs) {
    const axis = Math.abs(a.x - b.x) > Math.abs(a.z - b.z) ? 'x' : 'z';
    const len = Math.hypot(a.x - b.x, a.z - b.z);
    ctx.add(makeTimberFence({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, y: 0, len, axis, h: 1.1 }));
    ctx.collide(Math.min(a.x, b.x) - 0.15, Math.min(a.z, b.z) - 0.15, Math.max(a.x, b.x) + 0.15, Math.max(a.z, b.z) + 0.15, 1.1);
  }
}

/* ------------------------------------------------------------ apartment
 * A 2-floor walk-up: open steel stair at one end, the access gallery on
 * the street side with numbered doors, AC units, the mailbox bank and a
 * bike shelter by the stair. */
function apartment(ctx, net, kit, s, F) {
  const r = rngKit(5501);
  const w = F.w - 3.0, d = Math.min(F.d - 3.0, 8.5);
  const c = F.at(0.8, 2.2 + d / 2);
  const faceKey = { '0,-1': 'z-', '0,1': 'z+', '-1,0': 'x-', '1,0': 'x+' }[`${F.f.x},${F.f.z}`];
  const g = makeWalkup({ x: c.x, y: 0, z: c.z, w, d, face: faceKey, floors: 2, units: 4, seed: 5501, wall: 1, plate: 8 });
  g.name = 'apartment';
  ctx.add(g);
  const hx = F.f.x !== 0 ? d / 2 : w / 2, hz = F.f.x !== 0 ? w / 2 : d / 2;
  ctx.collide(c.x - hx, c.z - hz, c.x + hx, c.z + hz, 6);
  ctx.registry?.push({ kind: 'building', x: c.x, z: c.z, rect: [c.x - hx, c.z - hz, c.x + hx, c.z + hz] });
  const dp = F.at(0, 2.3);
  kit.serviceDrop(new THREE.Vector3(dp.x, 5.0, dp.z));
  // AC units along the front, at the foot of the gallery
  for (let i = 0; i < 4; i++) {
    const p = F.at(0.8 - w / 2 + 1.2 + i * (w - 2.4) / 3, 1.2);
    ctx.add(makeAircon({ x: p.x, y: 0, z: p.z, ry: F.ry }));
    ctx.collide(p.x - 0.4, p.z - 0.4, p.x + 0.4, p.z + 0.4, 0.8);
    reg(ctx, 'prop', p);
  }
  // mailboxes and the bike shelter at the stair end
  const mb = F.at(-F.w / 2 + 0.9, 0.9);
  ctx.add(makeMailboxBank({ x: mb.x, y: 0, z: mb.z, ry: F.ry, cols: 4, rows: 2 }));
  ctx.collide(mb.x - 0.5, mb.z - 0.5, mb.x + 0.5, mb.z + 0.5, 1.5);
  reg(ctx, 'prop', mb);
  const bs = F.at(-F.w / 2 + 1.2, F.d - 1.4);
  ctx.add(makeBikeShelter({ x: bs.x, y: 0, z: bs.z, ry: F.ry + Math.PI / 2, w: 3.6 }));
  for (let i = 0; i < 3; i++) {
    const b = F.at(-F.w / 2 + 1.2, F.d - 3.0 + i * 0.7);
    const bike = makeBicycle({ x: b.x, y: 0, z: b.z, ry: F.ry, lean: 0.06, color: r.pick([0x3f6f9c, 0xd8a03c, 0xe8e2d4, 0x9c5a4a]) });
    bike.userData.detail = true;
    ctx.add(bike);
    ctx.collide(b.x - 0.35, b.z - 0.35, b.x + 0.35, b.z + 0.35, 1.0);
  }
  reg(ctx, 'prop', bs);
}

/* --------------------------------------------------------------- vacant
 * 売地: weeds, a rope strung between short posts along the lane, the
 * agent's board, and the tyre marks of someone who parked there anyway. */
function vacant(ctx, net, kit, s, F) {
  const m = mats();
  const r = rngKit(6601);
  ground(ctx, s, m.earth, 0.03);
  // weeds in clumps
  const clumps = [];
  for (let i = 0; i < 26; i++) {
    const p = F.at(r.range(-F.w / 2 + 0.6, F.w / 2 - 0.6), r.range(0.6, F.d - 0.6));
    clumps.push({ x: p.x, z: p.z, y: 0, r: r.range(0.25, 0.5), count: r.int(2, 4), spread: 0.7, seed: 6700 + i });
  }
  buildShrubs(ctx, clumps);
  // rope and posts along the frontage
  const posts = [];
  for (let u = -F.w / 2 + 0.3; u <= F.w / 2 - 0.3 + 1e-6; u += (F.w - 0.6) / 5) {
    const p = F.at(u, 0.3);
    const post = box(0.09, 0.8, 0.09, m.white, p.x, 0.4, p.z);
    post.castShadow = true;
    ctx.add(post);
    posts.push(new THREE.Vector3(p.x, 0.72, p.z));
  }
  const rope = makeWires(ctx, [{ points: posts, sag: 0.12, r: 0.012 }]);
  if (rope) rope.material = m.rope;
  const a = F.at(-F.w / 2, 0.3), b = F.at(F.w / 2, 0.3);
  ctx.collide(Math.min(a.x, b.x), Math.min(a.z, b.z) - 0.1, Math.max(a.x, b.x), Math.max(a.z, b.z) + 0.1, 0.8);
  reg(ctx, 'prop', F.at(0, 0.3));
  // a pole at the kerb, as there always is
  const cp = F.at(F.w * 0.1, 0.4);
  kit.standPole(cp.x, cp.z);
  // the board
  const bp = F.at(F.w * 0.2, 1.0);
  signPost(ctx, { x: bp.x, z: bp.z, ry: F.ry, h: 1.9, name: 'sign-forsale', plates: [{ kind: 'forSale', o: FOR_SALE, w: 1.2, y: 1.45 }] });
  // two tyre tracks in from the lane
  tyreMarks(ctx, [-0.7, 0.7].map((du) => ({ ...F.at(du, 2.2), y: 0.035, w: 0.22, d: 3.4, ry: F.ry })));
}

/* ----------------------------------------------------------------- park
 * ちびっこ広場: grass, a low fence with a gap at the lane, two sakura,
 * benches under them, a swing, a sandpit, the tap and the rule board. */
function park(ctx, net, kit, s, F) {
  const m = mats();
  ground(ctx, s, m.grass, 0.04);
  // fence with the entrance gap
  const L = F.at(-F.w / 2 + 0.2, 0.2), R = F.at(F.w / 2 - 0.2, 0.2);
  const gapL = F.at(-1.2, 0.2), gapR = F.at(1.2, 0.2);
  for (const [a, b] of [[L, gapL], [gapR, R]]) {
    const axis = Math.abs(a.x - b.x) > Math.abs(a.z - b.z) ? 'x' : 'z';
    ctx.add(makeTimberFence({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, y: 0, len: Math.hypot(a.x - b.x, a.z - b.z), axis, h: 0.8 }));
    ctx.collide(Math.min(a.x, b.x) - 0.12, Math.min(a.z, b.z) - 0.12, Math.max(a.x, b.x) + 0.12, Math.max(a.z, b.z) + 0.12, 0.8);
  }
  reg(ctx, 'prop', F.at(-F.w / 3, 0.2));
  reg(ctx, 'prop', F.at(F.w / 3, 0.2));
  // and round the sides and back
  for (const [a, b] of [
    [F.at(-F.w / 2 + 0.2, 0.2), F.at(-F.w / 2 + 0.2, F.d - 0.2)],
    [F.at(F.w / 2 - 0.2, 0.2), F.at(F.w / 2 - 0.2, F.d - 0.2)],
    [F.at(-F.w / 2 + 0.2, F.d - 0.2), F.at(F.w / 2 - 0.2, F.d - 0.2)],
  ]) {
    const axis = Math.abs(a.x - b.x) > Math.abs(a.z - b.z) ? 'x' : 'z';
    const len = Math.hypot(a.x - b.x, a.z - b.z);
    ctx.add(makeTimberFence({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, y: 0, len, axis, h: 0.8 }));
    ctx.collide(Math.min(a.x, b.x) - 0.12, Math.min(a.z, b.z) - 0.12, Math.max(a.x, b.x) + 0.12, Math.max(a.z, b.z) + 0.12, 0.8);
    for (let t = 0.1; t < 1; t += 0.2) reg(ctx, 'prop', { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  }
  // trees and benches
  const trees = [F.at(-F.w / 2 + 3.5, F.d - 4), F.at(F.w / 2 - 3.5, F.d * 0.45)];
  ctx.sakura.push(...trees.map((t, i) => ({ x: t.x, z: t.z, y: 0, scale: i ? 1.1 : 1.5, seed: 7801 + i })));
  for (const t of trees) ctx.collide(t.x - 0.4, t.z - 0.4, t.x + 0.4, t.z + 0.4, 3);
  for (const [u, v, turn] of [[-F.w / 2 + 3.5, F.d - 6.3, 0], [F.w / 2 - 5.8, F.d * 0.45, Math.PI / 2]]) {
    const p = F.at(u, v);
    ctx.add(makeBench({ x: p.x, y: 0, z: p.z, ry: F.ry + turn, len: 1.6, wood: true }));
    ctx.collide(p.x - 0.8, p.z - 0.8, p.x + 0.8, p.z + 0.8, 0.8);
    reg(ctx, 'prop', p);
  }
  // swing
  const sw = F.at(2.5, F.d - 4.5);
  ctx.add(swing(sw, F.ry));
  ctx.collide(sw.x - 1.6, sw.z - 1.0, sw.x + 1.6, sw.z + 1.0, 2.2);
  reg(ctx, 'prop', sw);
  // sandpit
  const sp = F.at(-2.2, 4.0);
  const rim = new THREE.Group();
  rim.add(box(2.6, 0.08, 2.0, m.sand, 0, 0.06, 0));
  for (const [dx, dz, w, d] of [[0, -1.05, 2.8, 0.14], [0, 1.05, 2.8, 0.14], [-1.35, 0, 0.14, 2.0], [1.35, 0, 0.14, 2.0]]) {
    rim.add(box(w, 0.22, d, m.wood, dx, 0.11, dz));
  }
  rim.position.set(sp.x, 0.04, sp.z);
  rim.rotation.y = F.ry;
  ctx.add(rim);
  reg(ctx, 'prop', sp);
  // tap and board
  const tp = F.at(F.w / 2 - 1.5, 1.6);
  ctx.add(makeTapPost({ x: tp.x, y: 0, z: tp.z, h: 0.9 }));
  ctx.collide(tp.x - 0.3, tp.z - 0.3, tp.x + 0.3, tp.z + 0.3, 1.0);
  reg(ctx, 'prop', tp);
  // a street light at the gate, wired to the lane's poles
  const lp = F.at(-2.2, 0.5);
  kit.standPole(lp.x, lp.z);
  const bp = F.at(-F.w / 2 + 1.6, 0.8);
  signPost(ctx, { x: bp.x, z: bp.z, ry: F.ry, h: 1.8, name: 'sign-park', plates: [{ kind: 'parkName', o: { t: PARK_NAME }, w: 1.1, y: 1.35 }] });
  ctx.add(makePlanter({ x: F.at(1.8, 0.8).x, y: 0, z: F.at(1.8, 0.8).z, r: 0.3, flower: true, seed: 7811, n: 6 }));
}

function swing(p, ry) {
  const m = mats();
  const g = new THREE.Group();
  const frame = cel({ color: 0x3a8ad0, bands: 3, tint: 0x5a5a90 });
  for (const sx of [-1.4, 1.4]) {
    for (const sz of [-1, 1]) {
      const leg = cyl(0.05, 0.05, 2.3, 6, frame, sx, 1.1, sz * 0.4);
      leg.rotation.x = sz * 0.35;
      g.add(leg);
    }
  }
  g.add(cyl(0.06, 0.06, 3.0, 6, frame, 0, 2.2, 0).rotateZ(Math.PI / 2));
  for (const x of [-0.6, 0.6]) {
    for (const dx of [-0.2, 0.2]) g.add(box(0.02, 1.7, 0.02, m.metal, x + dx, 1.35, 0));
    g.add(box(0.5, 0.05, 0.22, cel({ color: 0xe8c040, bands: 3 }), x, 0.5, 0));
  }
  g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  g.position.set(p.x, 0, p.z);
  g.rotation.y = ry;
  return g;
}

/* ---------------------------------------------------------------- plaza
 * M2b lays the paving and plants the big sakura with its ring of benches;
 * M2c brings the station building, clock, bus stop, taxi and bike racks. */
function plaza(ctx, net, kit, s) {
  const m = mats();
  ground(ctx, s, m.paving, ROADS.asphaltY + ROADS.kerbH);
  ctx.platform({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, top: ROADS.asphaltY + ROADS.kerbH });
  const cx = (s.x0 + s.x1) / 2 + 4, cz = (s.z0 + s.z1) / 2;
  const y = ROADS.asphaltY + ROADS.kerbH;
  ctx.sakura.push({ x: cx, z: cz, y, scale: 1.9, seed: 8801 });              // the plaza's big one
  ctx.collide(cx - 0.6, cz - 0.6, cx + 0.6, cz + 0.6, 4);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = cx + Math.cos(a) * 3.2, z = cz + Math.sin(a) * 3.2;
    ctx.add(makeBench({ x, y, z, ry: -a + Math.PI / 2, len: 1.5, wood: true }));
    ctx.collide(x - 0.6, z - 0.6, x + 0.6, z + 0.6, y + 0.8);
    reg(ctx, 'prop', { x, z });
  }
  // (the station's side of the plaza -- racks, taxi, shop -- is line/station.js)
}
