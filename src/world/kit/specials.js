import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { rngKit, box, cyl } from '../../core/util.js';
import { hullOutline } from '../../core/outline.js';
import { makeWalkup, makeBikeShelter } from '../housing.js';
import { makeTimberFence } from '../buildings.js';
import {
  makeBench, makeTapPost, makePlanter, makeAircon, makeMailboxBank, makeBicycle, makeWires,
} from '../props.js';
import { makeWheelStops } from '../streetprops.js';
import { makeVehicle, vehicleSize, tyreMarks } from '../vehicles.js';
import { buildShrubs } from '../trees.js';
import { plant } from './green.js';
import { ROADS } from '../../config.js';
import { COIN_PARKING, FOR_SALE, PARK_NAME } from '../../data/town.js';
import { signPost } from './signs.js';
import { buildShrine } from './shrine/index.js';
import { LAYER } from './decals.js';
import { buildMegastore } from './megastore/index.js';

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
  const fn = { coinParking, shrine, apartment, vacant, park, plaza, megastore: buildMegastore }[s.kind];
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
      const kind = r.pick(['kei', 'kei', 'hatch', 'keivan', 'wagon']);
      const car = makeVehicle({ kind, color: r.pick([0xf2eee6, 0xd9665a, 0x9fc0dc, 0xa8d4b4, 0x7f93a4, 0xe9dfc6, 0x3c3c48]) });
      car.position.set(c.x, 0, c.z);
      car.rotation.y = F.ry + Math.PI / 2;   // nosed in, toward the back (cars are authored nose +x)
      car.userData.detail = true;
      ctx.add(car);
      // the car's own size, turned (as parkVehicle does): long along the bay
      const { L, W, H } = vehicleSize(kind);
      const cs = Math.abs(Math.cos(car.rotation.y)), sn = Math.abs(Math.sin(car.rotation.y));
      const hw = (cs * L + sn * W) / 2 - 0.06, hd = (sn * L + cs * W) / 2 - 0.06;
      ctx.collide(c.x - hw, c.z - hd, c.x + hw, c.z + hd, H - 0.15);
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
 * 富士見稲荷神社: its own module now (kit/shrine/), the town's experience 3. */
function shrine(ctx, net, kit, s, F) {
  return buildShrine(ctx, net, kit, s, F);
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
  // its own lamp by the stair, lighting the way in (and the lane)
  const lp = F.at(-F.w / 2 + 2.2, 0.35);
  kit.lampPost(lp.x, lp.z, F.ry);
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
  // a camphor and a zelkova for shade, green among the cherries (M2e)
  const g1 = F.at(F.w / 2 - 2.5, F.d - 3), g2 = F.at(-F.w / 2 + 2.5, F.d * 0.3);
  plant(ctx, 'camphor', { x: g1.x, z: g1.z, y: 0, scale: 1.1, seed: 7811 });
  plant(ctx, 'zelkova', { x: g2.x, z: g2.z, y: 0, scale: 0.95, seed: 7812 });
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
  const pl = F.at(1.8, 0.8);
  ctx.add(makePlanter({ x: pl.x, y: 0, z: pl.z, r: 0.3, flower: true, seed: 7811, n: 6 }));
  ctx.collide(pl.x - 0.35, pl.z - 0.35, pl.x + 0.35, pl.z + 0.35, 0.7);
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
  // zelkovas at the plaza's road corners (M2e)
  for (const [x, z, sd] of [[s.x0 + 3, s.z0 + 3, 8811], [s.x1 - 3, s.z0 + 3, 8812]]) plant(ctx, 'zelkova', { x, z, y, scale: 1.05, seed: sd });
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
