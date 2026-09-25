import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { rngKit, box } from '../../core/util.js';
import { namePlate } from '../../core/textures.js';
import { makeHouse, makeBlockFence, makeWall, makeTimberFence } from '../buildings.js';
import { makeAtticHouse, makeWalkup, makeTerrace } from '../housing.js';
import {
  makePlanter, makeBicycle, makeAircon, makeLaundryPole, makePotShelf, makeUmbrellaStand,
  makeBucket, makeDeliveryBox,
} from '../props.js';
import { makeGasMeter, makeWaterMeter, makeKidBike } from '../streetprops.js';
import { makeVehicle } from '../vehicles.js';
import { sidingTex, kawaraTex, boardTex, laundryTex, mortarTex, MORTAR_TILE, sheetTex, rustTex } from './tex.js';
import { wearBuilding, WEAR } from './wear.js';
import { windowCell, sillStreakTex } from './paint.js';
import { plant, potCrowd, ivyPanel } from './green.js';

/* ------------------------------------------------------------------ *
 * The house generator (SPEC section 3, buildings).
 *
 * Four styles on the library's house (buildings.js makeHouse), plus the
 * library's attic house, walk-up and terrace for variety:
 *
 *   siding   2 storeys clad in horizontal boards (a textured overlay)
 *   mortar   plain rendered walls, pale tones
 *   old      kawara-tiled roof, a timber-boarded ground floor
 *   modern   a flat-roofed box, dark or white, with a timber accent
 *
 * Then the front, by how much yard there is: a block wall with a gate,
 * posts, nameplate and mailbox (or a hedge, or a timber fence, or nothing),
 * potted plants, a bicycle, meters, an outdoor AC unit, a laundry pole
 * with washing, sometimes a car.  Everything is registered for the
 * density check.
 * ------------------------------------------------------------------ */

const SIDING = [0xe9e4d6, 0xc9d8cc, 0xcad6e4, 0xe6d8c4, 0xd6d4da, 0xeed8cf];
const MORTAR = [0xf1ede4, 0xe8dfcf, 0xf2e2de, 0xe2e2e6, 0xefe6d2];
const MODERN = [0x5d5b66, 0xf0eff2, 0x8a8894, 0xe9e2d8];

const cache = new Map();
function mat(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}
const sidingMat = (c) => mat(`siding${c}`, () => cel({ color: c, map: sidingTex(), bands: 3, tint: 0x6f6790, cache: false }));
const plainMat = (c) => mat(`plain${c}`, () => cel({ color: c, bands: 3, tint: 0x6f6790 }));
const kawaraMat = () => mat('kawara', () => cel({ color: 0x6e7384, map: kawaraTex(), bands: 3, tint: 0x4a4468, cache: false }));
const boardMat = () => mat('board', () => cel({ color: 0xb08e68, map: boardTex(), bands: 3, tint: 0x5c5680, cache: false }));
const accentMat = () => mat('accent', () => cel({ color: 0xc49a6a, map: boardTex(), bands: 3, tint: 0x5c5680, cache: false }));
const postMat = () => mat('post', () => cel({ color: 0xcfcad4, bands: 3, tint: 0x6a6288 }));
const boxMat = () => mat('mailbox', () => cel({ color: 0x8c95a6, bands: 3, tint: 0x5c5680 }));

const trimMat = () => mat('trim', () => cel({ color: 0xe8e4ea, bands: 3, tint: 0x5c5680 }));
const glassMat = () => mat('glass', () => cel({ color: 0x6f7c9c, bands: 2, tint: 0x4b4560 }));

/**
 * Windows on the two side walls of a box standing in `g`'s frame: the
 * flanks you see down the gap between two houses or on a corner.  `sideX`
 * true puts them on the x = +-hw walls, else on z = +-hd.  A frame, a pane
 * and a sill each, `floors` high, two along the wall.
 */
/** A steel garden shed, 1.2 x 0.7 x 1.4 m, doors facing +z. */
function storageShed(color, rusty) {
  const g = new THREE.Group();
  const body = cel({ color, map: rusty ? rustTex() : null, bands: 3, tint: 0x5c5680, cache: false });
  const doorM = cel({ color: new THREE.Color(color).multiplyScalar(0.9).getHex(), map: sheetTex(), bands: 3, tint: 0x5c5680, cache: false });
  const dark = cel({ color: 0x5a5a66, bands: 3 });
  g.add(box(1.2, 1.35, 0.7, body, 0, 0.68, 0));
  const lid = box(1.3, 0.06, 0.82, body, 0, 1.4, 0.02);
  lid.rotation.x = 0.06;
  g.add(lid);
  for (const sx of [-0.29, 0.29]) g.add(box(0.56, 1.15, 0.02, doorM, sx, 0.68, 0.36));
  g.add(box(1.2, 0.04, 0.05, dark, 0, 0.1, 0.37));
  g.add(box(0.04, 0.12, 0.02, dark, 0.02, 0.8, 0.38));
  g.add(box(1.24, 0.1, 0.74, dark, 0, 0.05, 0));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  return g;
}

let sideStreak = null;
export function sideWindows(g, { hw, hd, floors, fh = 2.72, sideX, y0 = 0, glass = null, seed = 1 }) {
  const len = sideX ? hd * 2 : hw * 2;
  const n = len > 7 ? 2 : 1;
  const r = rngKit(seed + 4141);
  sideStreak ??= flat({ color: 0xffffff, map: sillStreakTex(), transparent: true, depthWrite: false, cache: false });
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < n; i++) {
      const t = -len / 2 + (len * (i + 1)) / (n + 1);
      const y = y0 + f * fh + 1.5;
      for (const s of [-1, 1]) {
        const out = (sideX ? hw : hd) + 0.03;
        const px = sideX ? s * out : t, pz = sideX ? t : s * out;
        const fw = 0.95, fhh = 1.05;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(sideX ? 0.08 : fw + 0.14, fhh + 0.14, sideX ? fw + 0.14 : 0.08), trimMat());
        frame.position.set(px, y, pz);
        g.add(frame);
        // what is behind the glass (kit/paint.js windowAtlas): frosted glass likelier low down
        const cell = f === 0 && r.chance(0.35) ? 3 : r.pick([0, 1, 2, 4, 5, 7]);
        const pane = new THREE.Mesh(windowCell(new THREE.BoxGeometry(sideX ? 0.1 : fw, fhh, sideX ? fw : 0.1), cell), glass ?? glassMat());
        pane.position.set(px + (sideX ? s * 0.01 : 0), y, pz + (sideX ? 0 : s * 0.01));
        g.add(pane);
        const sill = new THREE.Mesh(new THREE.BoxGeometry(sideX ? 0.2 : fw + 0.2, 0.07, sideX ? fw + 0.2 : 0.2), trimMat());
        sill.position.set(px + (sideX ? s * 0.06 : 0), y - fhh / 2 - 0.06, pz + (sideX ? 0 : s * 0.06));
        g.add(sill);
        // the sash's meeting rail, and the streak under the sill
        const rail = new THREE.Mesh(new THREE.BoxGeometry(sideX ? 0.12 : 0.05, fhh, sideX ? 0.05 : 0.12), trimMat());
        rail.position.set(px + (sideX ? s * 0.02 : 0), y, pz + (sideX ? 0 : s * 0.02));
        g.add(rail);
        const sh = r.range(0.5, 0.9);
        const st = new THREE.Mesh(new THREE.PlaneGeometry(fw * 0.95, sh), sideStreak);
        st.position.set(px + (sideX ? s * 0.012 : 0), y - fhh / 2 - 0.12 - sh / 2, pz + (sideX ? 0 : s * 0.012));
        st.rotation.y = sideX ? s * Math.PI / 2 : (s > 0 ? 0 : Math.PI);
        st.userData.noOutline = true;
        st.renderOrder = 1;
        g.add(st);
      }
    }
  }
}

/** A textured panel just proud of a wall: u along the wall, v up it, in metres. */
function panel(g, material, cx, cy, cz, len, h, ry, tile = 1) {
  const geo = new THREE.PlaneGeometry(len, h);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / tile, uv.getY(i) * h / tile);
  const m = new THREE.Mesh(geo, material);
  m.position.set(cx, cy, cz);
  m.rotation.y = ry;
  m.receiveShadow = true;
  m.userData.noOutline = true;
  g.add(m);
  return m;
}

/**
 * Build a house on a lot.
 * @param F   the lot frame (kit/lots.js lotFrame)
 * @returns { group, style, front } for the caller's bookkeeping
 */
export function buildHouse(ctx, net, kit, lot, F, o = {}) {
  const r = rngKit(lot.seed + 5);
  const reg = (kind, p) => ctx.registry?.push({ kind, x: p.x, z: p.z });
  const lane = lot.e.cls === 'lane';

  /* ---- choose the building ---- */
  const wide = lot.w >= 10.5;
  let type = r.pick(['siding', 'siding', 'mortar', 'old', 'modern', 'siding', 'mortar', 'attic']);
  if (wide && r.chance(0.2)) type = 'terrace';
  if ((o.maxFloors ?? 3) < 2) type = 'old';        // a single-storey house is the old kind
  if (!lane && wide && r.chance(0.25)) type = 'walkup';
  const maxFloors = o.maxFloors ?? 3;

  // yard in front: lanes get a garden, busier streets a strip
  const yard = lane ? r.range(1.3, 2.6) : r.range(0.5, 1.0);
  const carport = lane && lot.w >= 10.5 && r.chance(0.45);
  const bw = Math.max(5.6, lot.w - (carport ? 3.0 : r.range(0.6, 1.4)));
  const bd = Math.min(lot.depth - yard - 0.6, r.range(7.5, 10));
  const shift = carport ? (r.chance(0.5) ? 1 : -1) * (lot.w - bw) / 2 : r.range(-0.3, 0.3);
  const c = F.at(shift, yard + bd / 2);
  const along = F.faceKey[0] === 'z';            // frontage runs along x
  const W = along ? bw : bd, D = along ? bd : bw; // world-axis footprint

  let g, H, doorU = 0;
  if (type === 'attic' && maxFloors >= 3) {
    g = makeAtticHouse({ x: c.x, y: 0, z: c.z, w: bw, d: bd, face: F.faceKey, seed: lot.seed, wall: r.int(0, 7), roof: r.int(0, 3) });
    H = 7.5;
  } else if (type === 'walkup' && maxFloors >= 3) {
    g = makeWalkup({ x: c.x, y: 0, z: c.z, w: bw, d: bd, face: F.faceKey, seed: lot.seed, floors: 3, units: Math.max(2, Math.round(bw / 2.6)), wall: r.int(0, 7) });
    H = 8.4;
  } else if (type === 'terrace') {
    const units = Math.max(2, Math.floor(bw / 3.2));
    g = makeTerrace({ x: c.x, y: 0, z: c.z, d: bd, units, unitW: bw / units, face: F.faceKey, seed: lot.seed, wall: r.int(0, 7) });
    H = 6.3;
  } else {
    if (type === 'attic' || type === 'walkup') type = 'siding';
    const floors = Math.min(o.maxFloors ?? 3, type === 'old' ? (r.chance(0.35) ? 1 : 2) : 2);
    const tone = type === 'siding' ? r.pick(SIDING) : type === 'modern' ? r.pick(MODERN) : type === 'old' ? 0xefe7d6 : r.pick(MORTAR);
    // siding is a panel on each wall (tiled in metres); the wall under it is plain
    const wallMat = plainMat(tone);
    const roofMat = type === 'old' ? kawaraMat() : undefined;
    const roofKind = type === 'modern' ? 'flat' : type === 'old' ? r.pick(['gable', 'hip']) : r.pick(['gable', 'hip', 'gable', 'shed']);
    // at night about half the houses have their lights on (kit/night.js)
    const glass = ctx.night?.glass(r.chance(0.55));
    g = makeHouse({
      x: c.x, y: 0, z: c.z, w: W, d: D, face: F.faceKey, floors, seed: lot.seed,
      wallMat, roofMat, roofKind, shutters: type !== 'modern', porch: r.chance(0.6), glassMat: glass,
    });
    g.userData.glass = glass;
    doorU = g.userData.doorU ?? 0;
    H = 2.72 * floors;
    // the flanks, seen down every gap and on every corner
    sideWindows(g, { hw: W / 2, hd: D / 2, floors, sideX: along, glass: g.userData.glass, seed: lot.seed });
    // cladding and accents, on the walls the street sees
    const fx = F.face.x, fz = F.face.z;
    const hw = W / 2 + 0.013, hd = D / 2 + 0.013;
    if (type === 'siding') {
      const sm = sidingMat(tone);
      for (const s of [-1, 1]) {
        panel(g, sm, s * hw, H / 2, 0, D, H, s * Math.PI / 2, 2.4);
        panel(g, sm, 0, H / 2, s * hd, W, H, s > 0 ? 0 : Math.PI, 2.4);
      }
    } else if (type === 'old') {
      // the boarded ground floor on the frontage
      const bh = 1.9;
      if (along) panel(g, boardMat(), 0, 0.42 + bh / 2, fz * hd, W, bh, fz > 0 ? 0 : Math.PI, 1.2);
      else panel(g, boardMat(), fx * hw, 0.42 + bh / 2, 0, D, bh, fx > 0 ? Math.PI / 2 : -Math.PI / 2, 1.2);
    } else if (type === 'modern') {
      const u = doorU + (doorU > 0 ? -1.4 : 1.4);
      if (along) panel(g, accentMat(), u, H / 2, fz * (hd + 0.002), 0.9, H - 0.5, fz > 0 ? 0 : Math.PI, 1.2);
      else panel(g, accentMat(), fx * (hw + 0.002), H / 2, u, 0.9, H - 0.5, fx > 0 ? Math.PI / 2 : -Math.PI / 2, 1.2);
    }
  }
  g.name = `house-${type}`;
  // weather, by how old the house is: new boxes are nearly clean, old
  // mortar is streaked and cracked (its own draw, so the layout never shifts)
  {
    const w = rngKit(lot.seed + 77);
    const [kind, a0, a1] = {
      modern: [WEAR.newer, 0.0, 0.35], siding: [WEAR.newer, 0.2, 0.65],
      mortar: [WEAR.mortar, 0.45, 0.9], old: [WEAR.old, 0.7, 1.0],
    }[type] ?? [WEAR.mortar, 0.35, 0.8];
    // rendered walls get the trowelled mortar skin under their weather
    const skin = type === 'mortar' || type === 'old' ? { tex: mortarTex(), tile: MORTAR_TILE } : null;
    wearBuilding(g, kind, w.int(0, 15), w.range(a0, a1), { skin });
  }
  ctx.add(g);
  const hx = (along ? bw : bd) / 2, hz = (along ? bd : bw) / 2;
  ctx.collide(c.x - hx - 0.05, c.z - hz - 0.05, c.x + hx + 0.05, c.z + hz + 0.05, H);
  ctx.registry?.push({ kind: 'building', x: c.x, z: c.z, rect: [c.x - hx, c.z - hz, c.x + hx, c.z + hz] });

  // a service drop to the upper floor, on the street face
  const drop = F.at(shift + r.range(-bw * 0.3, bw * 0.3), yard + 0.05);
  kit.serviceDrop(new THREE.Vector3(drop.x, Math.min(H - 0.6, 5.2), drop.z));

  dressFront(ctx, lot, F, { r, yard, bw, bd, shift, doorU, carport, lane, H, reg });
  return { group: g, type, H };
}

/* ---------------------------------------------------------------- front */

function dressFront(ctx, lot, F, { r, yard, bw, bd, shift, doorU, carport, lane, H, reg }) {
  const ry = F.ry;
  const add = (obj, p, kind = 'prop', col = 0.35, h = 1.0) => {
    obj.userData.detail = true;       // small: drawn near the camera only
    ctx.add(obj);
    reg(kind, p);
    if (col > 0) ctx.collide(p.x - col, p.z - col, p.x + col, p.z + col, h);
    return obj;
  };
  const doorAt = shift + doorU;
  const w = lot.w;

  /* boundary along the frontage, with the gate opposite the door */
  const edge = lane ? r.pick(['block', 'block', 'block', 'hedge', 'timber', 'open']) : r.pick(['open', 'open', 'block', 'planters']);
  const gateHalf = 0.65;
  const carGap = carport ? [shift > 0 ? -w / 2 : w / 2 - 3.0, shift > 0 ? -w / 2 + 3.0 : w / 2] : null;
  const segs = [];
  {
    const cuts = [[doorAt - gateHalf, doorAt + gateHalf]];
    if (carGap) cuts.push([Math.min(...carGap), Math.max(...carGap)]);
    cuts.sort((a, b) => a[0] - b[0]);
    let u0 = -w / 2 + 0.1;
    for (const [a, b] of cuts) { if (a - u0 > 0.5) segs.push([u0, a]); u0 = Math.max(u0, b); }
    if (w / 2 - 0.1 - u0 > 0.5) segs.push([u0, w / 2 - 0.1]);
  }
  const vWall = 0.18;
  const axis = F.faceKey[0] === 'z' ? 'x' : 'z';
  if (edge === 'block' || edge === 'timber') {
    const make = edge === 'block' ? (r.chance(0.7) ? makeBlockFence : makeWall) : makeTimberFence;
    for (const [a, b] of segs) {
      const p = F.at((a + b) / 2, vWall);
      const f = make({ x: p.x, z: p.z, y: 0, len: b - a, axis, h: edge === 'timber' ? 1.5 : 0.8, fence: r.chance(0.5) });
      ctx.add(f);
      const q0 = F.at(a, vWall - 0.12), q1 = F.at(b, vWall + 0.12);
      ctx.collide(Math.min(q0.x, q1.x), Math.min(q0.z, q1.z), Math.max(q0.x, q1.x), Math.max(q0.z, q1.z), f.userData.top ?? 1.0);
      reg('prop', p);
    }
    // gate posts: nameplate on one, mailbox on the other
    for (const s of [-1, 1]) {
      const p = F.at(doorAt + s * (gateHalf + 0.12), vWall);
      const post = box(0.26, 1.25, 0.26, postMat(), p.x, 0.625, p.z);
      post.castShadow = true;
      ctx.add(post);
      ctx.collide(p.x - 0.14, p.z - 0.14, p.x + 0.14, p.z + 0.14, 1.25);
      const f = F.face;
      if (s < 0) {
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.11),
          flat({ color: 0xffffff, map: namePlate(lot.seed % 12), cache: false }));
        plate.position.set(p.x + f.x * 0.135, 1.02, p.z + f.z * 0.135);
        plate.rotation.y = ry;
        plate.userData.noOutline = true;
        ctx.add(plate);
      } else {
        const mb = box(0.3, 0.24, 0.14, boxMat(), p.x + f.x * 0.2, 0.98, p.z + f.z * 0.2);
        mb.rotation.y = ry;
        mb.castShadow = true;
        ctx.add(mb);
      }
    }
    reg('prop', F.at(doorAt, vWall));
  } else if (edge === 'hedge') {
    for (const [a, b] of segs) {
      const n = Math.max(1, Math.round((b - a) / 1.1));
      for (let i = 0; i < n; i++) {
        const u = a + ((i + 0.5) * (b - a)) / n;
        ctx.hedges?.push({ ...F.at(u, 0.45), y: 0, r: 0.5, count: 3, spread: 0.9, seed: lot.seed + i });
      }
      const q0 = F.at(a, 0.0), q1 = F.at(b, 0.9);
      ctx.collide(Math.min(q0.x, q1.x), Math.min(q0.z, q1.z), Math.max(q0.x, q1.x), Math.max(q0.z, q1.z), 1.1);
      reg('prop', F.at((a + b) / 2, 0.45));
    }
  } else if (edge === 'planters') {
    for (let u = -w / 2 + 0.8; u < w / 2 - 0.6; u += r.range(1.6, 2.6)) {
      if (Math.abs(u - doorAt) < 1.0) continue;
      const p = F.at(u, 0.35);
      add(makePlanter({ x: p.x, y: 0, z: p.z, r: 0.24, flower: r.chance(0.6), seed: lot.seed + Math.round(u * 10), n: 5 }), p, 'prop', 0.3, 0.7);
    }
  }

  /* the yard */
  const inYard = (u, v) => F.at(u, Math.min(v, yard - 0.2));
  if (yard > 0.9) {
    // pots by the door
    const pu = doorAt + (r.chance(0.5) ? 1 : -1) * r.range(0.8, 1.3);
    const p = inYard(pu, yard - 0.5);
    add(r.chance(0.5)
      ? makePotShelf({ x: p.x, y: 0, z: p.z, ry, w: 0.9, seed: lot.seed })
      : makePlanter({ x: p.x, y: 0, z: p.z, r: 0.22, flower: true, seed: lot.seed + 3, n: 6 }), p, 'prop', 0.35, 0.9);
    // a bicycle by the gate
    if (r.chance(0.6)) {
      const q = inYard(doorAt + (pu > doorAt ? -1.3 : 1.3), yard * 0.55);
      const bike = r.chance(0.2)
        ? makeKidBike({ x: q.x, y: 0, z: q.z, ry: ry + Math.PI / 2, color: r.pick([0xe86a5a, 0x5aa0e0, 0xf2c23c]) })
        : makeBicycle({ x: q.x, y: 0, z: q.z, ry: ry + Math.PI / 2 + r.range(-0.2, 0.2), lean: 0.07, color: r.pick([0x3f6f9c, 0xd8a03c, 0x9c5a4a, 0x4f8f6a, 0xe8e2d4, 0x8f6fb5]) });
      bike.position.set(q.x, 0, q.z);
      add(bike, q, 'prop', 0.4, 1.0);
    }
    if (r.chance(0.35)) {
      const q = inYard(pu + (pu > doorAt ? 0.9 : -0.9), yard - 0.4);
      add(r.chance(0.5) ? makeUmbrellaStand({ x: q.x, y: 0, z: q.z, ry, seed: lot.seed })
        : makeBucket({ x: q.x, y: 0, z: q.z, ry, color: 0x5aa0c8 }), q, 'prop', 0.2, 0.6);
    }
    if (r.chance(0.25)) {
      const q = inYard(doorAt + 0.8, yard - 0.35);
      add(makeDeliveryBox({ x: q.x, y: 0, z: q.z, ry }), q, 'prop', 0.3, 0.7);
    }
  }

  /* green (M2e Phase 4), from its own draw so the layout never shifts:
   * pots crowding the front, a garden tree over the wall, ivy on it */
  {
    const g = rngKit(lot.seed + 313);
    const o = F.at(0, 0), a1 = F.at(1, 0);
    const along = { x: a1.x - o.x, z: a1.z - o.z };
    const face = F.face;
    if (yard > 0.9 && g.chance(0.7)) {
      // along the house front, the other side of the door from the pots above
      const u = doorAt + (g.chance(0.5) ? 1 : -1) * g.range(1.5, 2.6);
      if (Math.abs(u) < w / 2 - 0.8) {
        const p = inYard(u, yard - 0.35);
        const half = potCrowd(ctx, p, along, { n: g.int(4, 9), seed: lot.seed + 17, reg });
        ctx.collide(p.x - half, p.z - half, p.x + half, p.z + half, 0.7);
      }
    } else if (!lane && g.chance(0.45)) {
      // no yard: the pots stand on the street edge against the house (Tan's photo)
      const u = doorAt + (g.chance(0.5) ? 1 : -1) * g.range(1.2, 2.2);
      if (Math.abs(u) < w / 2 - 0.8) {
        const p = F.at(u, 0.3);
        const half = potCrowd(ctx, p, along, { n: g.int(3, 7), seed: lot.seed + 19, reg });
        ctx.collide(p.x - half, p.z - half, p.x + half, p.z + half, 0.7);
      }
    }
    if (lane && yard > 1.6 && edge !== 'open' && g.chance(0.45)) {
      const species = g.pick(['pine', 'pine', 'maple', 'camphor', 'mapleRed']);
      const u = (doorAt > 0 ? -1 : 1) * (w / 2 - g.range(0.9, 1.4));
      const q = inYard(u, yard * 0.55);
      plant(ctx, species, { x: q.x, z: q.z, y: 0, scale: species === 'pine' ? g.range(0.55, 0.8) : g.range(0.5, 0.7), seed: lot.seed + 23 });
    }
    // a steel storage shed (物置) in the garden's far corner: sliding doors
    // with their runner, a sloped lid, rust at the foot on the old ones
    if (lane && yard > 1.6 && g.chance(0.3)) {
      const u = (doorAt > 0 ? -1 : 1) * (w / 2 - 0.8);
      const q = inYard(u, yard - 0.55);
      const shed = storageShed(g.pick([0xd8d4c8, 0xc4ccc4, 0xb8c0cc, 0xd8c8a8]), g.chance(0.5));
      shed.position.set(q.x, 0, q.z);
      shed.rotation.y = ry;
      add(shed, q, 'prop', 0.6, 1.4);
    }
    if ((edge === 'block' || edge === 'timber') && segs.length && g.chance(0.3)) {
      const [a, b] = segs[g.int(0, segs.length - 1)];
      const len = Math.min(b - a, g.range(1.2, 2.6));
      const u = a + g.range(0, Math.max(0, b - a - len)) + len / 2;
      const c = F.at(u, vWall - 0.12);
      ivyPanel(ctx, c, face, len, g.range(0.8, 1.4));
    }
  }

  /* services down the side of the house */
  const sideU = shift + (r.chance(0.5) ? 1 : -1) * (bw / 2 + 0.28);
  const room = (w - bw) / 2 - Math.abs(shift) > 0.25 || carport;
  if (room) {
    const q = F.at(sideU, yard + 1.2);
    const ac = makeAircon({ x: q.x, y: 0, z: q.z, ry: ry + (sideU > shift ? -Math.PI / 2 : Math.PI / 2) });
    add(ac, q, 'prop', 0.35, 0.8);
    const gm = F.at(sideU, yard + 3.0);
    add(makeGasMeter({ x: gm.x, y: 0, z: gm.z, ry: ry + (sideU > shift ? -Math.PI / 2 : Math.PI / 2) }), gm, 'prop', 0, 0);
  }
  if (yard > 1.2 && r.chance(0.5)) {
    const q = inYard(doorAt + 1.6, 0.6);
    add(makeWaterMeter({ x: q.x, y: 0.01, z: q.z, ry }), q, 'prop', 0, 0);
  }
  // washing out on a pole in the yard or beside the house
  if (r.chance(0.45)) {
    const u = room ? sideU : (doorAt > 0 ? -w / 2 + 1.4 : w / 2 - 1.4);
    const q = F.at(u, room ? yard + 2.2 : Math.max(0.6, yard - 0.6));
    const pole = makeLaundryPole({ x: q.x, y: 0, z: q.z, ry: ry + Math.PI / 2, len: 2.2, h: 1.9, seed: lot.seed + 9 });
    add(pole, q, 'prop', 0.3, 1.9);
    hangLaundry(ctx, q, ry + Math.PI / 2, r);
  }
  // the car in the carport
  if (carport) {
    const u = (carGap[0] + carGap[1]) / 2;
    const q = F.at(u, 2.6);
    const car = makeVehicle({ kind: r.pick(['kei', 'kei', 'hatch', 'keivan']), color: r.pick([0xf2eee6, 0xd9665a, 0x9fc0dc, 0xa8d4b4, 0x7f93a4, 0xe9dfc6]) });
    car.position.set(q.x, 0, q.z);
    car.rotation.y = ry + Math.PI / 2;
    car.userData.detail = true;
    ctx.add(car);
    ctx.collide(q.x - 1.1, q.z - 1.1, q.x + 1.1, q.z + 1.1, 1.6);
    reg('prop', q);
  }
}

/** A few pieces of washing on a pole: towels and shirts as cloth cards. */
export function hangLaundry(ctx, p, ry, r, y = 1.52) {
  const n = r.int(2, 4);
  for (let i = 0; i < n; i++) {
    const t = -0.8 + (1.6 * (i + 0.5)) / n;
    const shirt = r.chance(0.5);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(shirt ? 0.5 : 0.36, shirt ? 0.55 : 0.6),
      cel({ color: 0xffffff, map: laundryTex(r.int(0, 5)), bands: 2, side: THREE.DoubleSide, tint: 0x6f6790, alphaTest: 0.5, cache: false }));
    m.position.set(p.x + Math.sin(ry) * t, y, p.z + Math.cos(ry) * t);
    m.rotation.y = ry + Math.PI / 2;
    m.castShadow = true;
    m.userData.noOutline = true;
    ctx.add(m);
  }
}

