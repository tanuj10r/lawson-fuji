import * as THREE from 'three';
import { cel, flat } from '../../../core/toon.js';
import { rngKit } from '../../../core/util.js';
import { hullOutline } from '../../../core/outline.js';
import { soundBus } from '../../../core/soundBus.js';
import { DONPEN } from '../../../data/town.js';
import { frontPage, miscPage, R, uvRegion, popRegion, hangRegion, PEN_AT } from './tex.js';
import { makePenguin } from './mascot.js';
import { makeStock, widthOf, depthOf } from './goods.js';

/* ------------------------------------------------------------------ *
 * ドンペン堂, the discount megastore (experiences): a loving homage to the
 * big discount palaces, on two of the spine's lots.
 *
 *   the front    three storeys: the silver fascia with the name, the huge
 *                black band with the gold letters, the top floor papered
 *                with sale banners, a red blade sign out over the walk
 *   the mascot   ペンちゃん (mascot.js) on the entrance canopy
 *   the entrance open and packed floor to ceiling: product walls, an aisle
 *                you can see down but not walk, striped wagons heaped with
 *                goods, carts in a row, red baskets, cartons, hanging gold
 *                party goods and hand-lettered price cards on everything;
 *                a few wagons spill onto the walk (1.6 m of it stays clear)
 *   night        the signs and the inside are unlit paint, so they glow;
 *                bright pools on the walk: the brightest place on the street
 *   the theme    heard as you pass (a sound experience: no highlight, no E;
 *                Tan, 2026-09-28)
 *
 * Built in a local frame round the frontage's centre: x runs across the
 * front as you face it from the street, z out toward the street (the
 * frontage line is z 0), y up.  One page of paint for the front and one
 * for the rest (tex.js): the signs draw in two batches.
 * ------------------------------------------------------------------ */

const W2 = 8.6;          // half the front
const ZF = -0.1;         // the upper floors' face (the street wall, as the neighbours')
const ZIN = -3.4;        // the back of the entrance: you can walk this far in
const H1 = 4.4;          // the ground floor's ceiling
const H = 12.2;          // the roof
const FLOOR = 0.17;      // the entrance floor, flush with the walk
/* The theme (Tan's 14 s recording of a discount palace's song, looped): heard
 * from `far` in, full from `near`.  The mascot moves only within `animate` m. */
const S = { near: 6, far: 24, level: 0.6, animate: 60 };

let M = null;
function mats() {
  if (M) return M;
  const front = frontPage(), misc = miscPage();
  M = {
    signF: flat({ map: front, cache: false }),
    signM: flat({ map: misc, cache: false }),
    signM2: flat({ map: misc, side: THREE.DoubleSide, cache: false }),
    paint: cel({ map: misc, bands: 3, tint: 0x6f6790, cache: false }),
    wall: cel({ color: 0xdedbe4, bands: 3, tint: 0x6f6790 }),
    wallDark: cel({ color: 0xb9b4c4, bands: 3, tint: 0x5f5880 }),
    black: cel({ color: 0x1a181f, bands: 2, tint: 0x3b3550 }),
    red: cel({ color: 0xd8141c, bands: 3, tint: 0x7a4060 }),
    silver: cel({ color: 0xd4d8e0, bands: 3, tint: 0x666090 }),
    gold: cel({ color: 0xf2c02a, bands: 3, tint: 0x8a6040 }),
    goldLit: flat({ color: 0xf5c83a }),
    goldPale: flat({ color: 0xfff0a8 }),
    floor: cel({ color: 0xf1ede6, bands: 3, tint: 0x7d74a0 }),
    light: flat({ color: 0xfffaf0 }),
    ceiling: flat({ color: 0xf6f0e4 }),
    wire: cel({ color: 0xb8bcc6, bands: 3, tint: 0x666090 }),
    basket: cel({ color: 0xe0303a, bands: 3, tint: 0x7a4060 }),
    handle: cel({ color: 0xd8141c, bands: 3, tint: 0x7a4060 }),
    wheel: cel({ color: 0x2e2a34, bands: 2, tint: 0x4b4560 }),
    string: cel({ color: 0x8a8290, bands: 2, tint: 0x4b4560 }),
  };
  return M;
}

export function buildMegastore(ctx, net, kit, s, F) {
  const m = mats();
  const r = rngKit(4040);
  let popK = 0;                       // which price card is next
  const g = new THREE.Group();
  g.name = 'megastore';
  g.userData.noAtlas = true;          // its own two pages, drawn at the size they are seen
  const p0 = F.at(0, 0);
  g.position.set(p0.x, 0, p0.z);
  g.rotation.y = F.ry;
  ctx.add(g);

  /** Local (x, z) to the town frame. */
  const T = (x, z) => F.at(-x, -z);
  const collide = (x0, z0, x1, z1, top) => {
    const a = T(x0, z0), b = T(x1, z1);
    ctx.collide(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z), top);
  };
  const reg = (kind, x, z) => { const p = T(x, z); ctx.registry?.push({ kind, x: p.x, z: p.z }); };

  const add = (mesh, { shadow = true, outline = 0 } = {}) => {
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    g.add(mesh);
    if (outline) hullOutline(mesh, { thickness: outline });
    return mesh;
  };
  /** An axis-aligned box from its extents. */
  const block = (x0, y0, z0, x1, y1, z1, mat, o) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return add(b, o);
  };
  /** A painted card from a page region; `ry` turns it (0 faces the street). */
  const card = (w, h, region, page, mat, x, y, z, ry = 0, rz = 0) => {
    const geo = uvRegion(new THREE.PlaneGeometry(w, h), region, page);
    const c = new THREE.Mesh(geo, mat);
    c.position.set(x, y, z);
    c.rotation.set(0, ry, rz);
    c.userData.noOutline = true;
    g.add(c);
    return c;
  };
  const detail = (o) => { o.traverse?.((k) => { k.userData.detail = true; }); return o; };

  /* ------------------------------------------------ the building */
  // the ground floor's mass behind the entrance, hollowed for the aisle
  block(-W2, 0, -13.6, -1.6, H1, ZIN, m.wall);
  block(1.6, 0, -13.6, W2, H1, ZIN, m.wall);
  block(-1.6, 0, -13.6, 1.6, H1, -7.2, m.wall);
  // the upper floors, flush with the neighbours' street wall
  block(-W2, H1, -13.6, W2, H, ZF, m.wall, { outline: 0.003 });
  // the roof's red parapet with a gold line
  block(-W2 - 0.05, H - 0.05, ZF - 0.02, W2 + 0.05, H + 0.35, ZF + 0.22, m.red, { outline: 0.003 });
  block(-W2 - 0.06, H + 0.06, ZF + 0.225, W2 + 0.06, H + 0.12, ZF + 0.235, m.gold, { shadow: false });
  // the entrance's two end walls (silver faced, red edged) and two slim columns
  for (const sx of [-1, 1]) {
    block(sx * (W2 - 0.6), 0, ZIN/*@mini + 0.004 @*//*@@*/, sx * W2, H1/*@mini - 0.004 @*//*@@*/, ZF + 0.12, m.silver, { outline: 0.003 });
    block(sx * (W2 - 0.08), 0, ZF + 0.12, sx * (W2 + 0.02), H1, ZF + 0.2, m.red, { shadow: false });
    block(sx * 4.3 - 0.22, FLOOR, -0.62, sx * 4.3 + 0.22, H1, -0.18, m.silver, { outline: 0.003 });
    block(sx * 4.3 - 0.24, FLOOR, -0.64, sx * 4.3 + 0.24, 0.5, -0.16, m.red, { shadow: false });
  }
  const ex = W2 - 0.6;
  collide(-W2, -13.6, W2, ZIN, H);
  collide(-W2, ZIN, -ex, ZF + 0.2, H1);
  collide(ex, ZIN, W2, ZF + 0.2, H1);
  for (const sx of [-1, 1]) collide(sx * 4.3 - 0.24, -0.64, sx * 4.3 + 0.24, -0.16, H1);
  {
    const a = T(-W2, -13.6), b = T(W2, 0);
    ctx.registry?.push({ kind: 'building', x: (a.x + b.x) / 2, z: (a.z + b.z) / 2,
      rect: [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)] });
  }
  // the entrance floor, flush with the walk
  block(-ex/*@mini + 0.004 @*//*@@*/, 0, ZIN, ex/*@mini - 0.004 @*//*@@*/, FLOOR, 0.12, m.floor, { shadow: false });
  {
    const a = T(-ex, ZIN), b = T(ex, 0.12);
    ctx.platform({ x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z), top: FLOOR });
  }

  /* ------------------------------------------------ the front */
  // the canopy over the entrance, its red edge lettered with what's inside
  const CY0 = 4.0, CZ = 1.1;
  // (a centimetre past the entrance's end walls each side: its ends lay in their outer faces)
  block(-W2 - 0.01, CY0, ZF, W2 + 0.01, H1 + 0.05, CZ, m.red, { outline: 0.003 });
  card(W2 * 2, H1 + 0.05 - CY0, R.front.canopy, 'front', m.signF, 0, (CY0 + H1 + 0.05) / 2, CZ + 0.006);
  // its underside: a lit ceiling
  card(W2 * 2, CZ - ZF, [0, 0, 4, 4], 'front', m.light, 0, CY0 - 0.006, (CZ + ZF) / 2).rotation.set(Math.PI / 2, 0, 0);
  // the silver fascia with the name
  block(-W2, H1 + 0.05, ZF, W2, 5.65, ZF + 0.3, m.silver, { outline: 0.003 });
  card(W2 * 2, 5.65 - H1 - 0.05, R.front.fascia, 'front', m.signF, 0, (5.65 + H1 + 0.05) / 2, ZF + 0.306);
  // the black band and its gold letters
  const B0 = 5.75, B1 = 8.2;
  block(-W2, B0, ZF, W2, B1, ZF + 0.45, m.black, { outline: 0.003 });
  card(W2 * 2 - 0.1, B1 - B0, R.front.band, 'front', m.signF, 0, (B0 + B1) / 2, ZF + 0.456);
  // the top floor: its windows papered with sale banners
  card(W2 * 2 - 0.6, 3.1, R.misc.upper, 'misc', m.signM, 0, 10.05, ZF + 0.012);
  block(-W2, 8.45, ZF, W2, 8.6, ZF + 0.12, m.wallDark, { shadow: false });
  // the near flank, over the neighbours' roofs: the band again
  card(12.6, 1.75, R.front.band, 'front', m.signF, W2 + 0.012, 10.3, -6.9, Math.PI / 2);
  card(12.6, 1.75, R.front.band, 'front', m.signF, -W2 - 0.012, 10.3, -6.9, -Math.PI / 2);
  // the blade sign out over the walk, at the near end (seen down the street both ways)
  {
    const bx = W2 - 0.45, z0 = 0.5, z1 = 1.8, y0 = 4.8, y1 = 11.55;
    block(bx - 0.07, y0 - 0.06, z0 - 0.06, bx + 0.07, y1 + 0.06, z1 + 0.06, m.red, { outline: 0.003 });
    // (1.5 cm off the blade's faces: at 5 mm they fought it from the station's steps, 100 m off)
    card(z1 - z0, y1 - y0, R.misc.blade, 'misc', m.signM, bx + 0.085, (y0 + y1) / 2, (z0 + z1) / 2, Math.PI / 2);
    card(z1 - z0, y1 - y0, R.misc.blade, 'misc', m.signM, bx - 0.085, (y0 + y1) / 2, (z0 + z1) / 2, -Math.PI / 2);
    for (const y of [y0 + 0.6, y1 - 0.6]) block(bx - 0.04, y - 0.04, ZF + 0.45, bx + 0.04, y + 0.04, z0, m.silver, { shadow: false });
  }

  /* ------------------------------------------------ inside the entrance */
  // the lit ceiling, with light strips
  card(ex * 2, -ZIN + ZF + 3.8, [0, 0, 4, 4], 'front', m.ceiling, 0, H1 - 0.02, (ZIN - 3.8 + ZF) / 2).rotation.set(Math.PI / 2, 0, 0);
  for (const z of [-0.9, -2.3]) {
    for (const x of [-5.6, -2.4, 2.4, 5.6]) block(x - 1.2, H1 - 0.08, z - 0.09, x + 1.2, H1 - 0.03, z + 0.09, m.light, { shadow: false });
  }
  // product walls, floor to ceiling: the back (either side of the aisle), the ends
  const WH = 4.1, wy = FLOOR + WH / 2;
  const [wx, wyy, ww, wh] = R.misc.wall;
  card(ex - 1.6, WH, [wx, wyy, ww / 2, wh], 'misc', m.signM, -(ex + 1.6) / 2, wy, ZIN + 0.01);
  card(ex - 1.6, WH, [wx + ww / 2, wyy, ww / 2, wh], 'misc', m.signM, (ex + 1.6) / 2, wy, ZIN + 0.01);
  card(-ZIN + ZF, WH, R.misc.side, 'misc', m.signM, -ex + 0.01, wy, (ZIN + ZF) / 2, Math.PI / 2);
  card(-ZIN + ZF, WH, R.misc.side, 'misc', m.signM, ex - 0.01, wy, (ZIN + ZF) / 2, -Math.PI / 2);
  // the aisle you can see down: shelves both sides, a wall of goods at its end
  card(3.8, WH, R.misc.side, 'misc', m.signM, -1.59, wy, ZIN - 1.9, Math.PI / 2);
  card(3.8, WH, R.misc.side, 'misc', m.signM, 1.59, wy, ZIN - 1.9, -Math.PI / 2);
  card(3.2, WH, R.misc.side, 'misc', m.signM, 0, wy, -7.19);
  block(-1.6, 0, -7.2, 1.6, FLOOR, ZIN, m.floor, { shadow: false });
  collide(-1.6, ZIN - 0.1, 1.6, ZIN, 1.0);

  // hanging from the ceiling: gold garlands, stars, and big price boards
  const ico = new THREE.IcosahedronGeometry(0.085, 0);
  for (let i = 0; i < 9; i++) {
    const x0 = -ex + 0.6 + i * ((2 * ex - 1.2) / 8);
    const z = r.range(-2.9, -0.5);
    for (let k = 0; k < 6; k++) {
      const b = new THREE.Mesh(ico, m.goldLit);
      b.position.set(x0 + r.range(-0.2, 0.2), H1 - 0.25 - k * 0.2, z + r.range(-0.05, 0.05));
      b.rotation.set(r.next() * 3, r.next() * 3, 0);
      add(b, { shadow: false });
    }
    block(x0 - 0.005, H1 - 1.4, z - 0.005, x0 + 0.005, H1, z + 0.005, m.string, { shadow: false });
  }
  // garlands of gold foil beads swagged across the entrance
  const bead = new THREE.IcosahedronGeometry(0.06, 0);
  for (const z of [-0.45, -1.75, -3.05]) {
    const swag = 1.8;
    for (let x = -ex + 0.3; x < ex - 0.3; x += 0.11) {
      const t = (((x + ex) % swag) + swag) % swag / swag;
      const b = new THREE.Mesh(bead, Math.round(x / 0.11) % 3 ? m.goldLit : m.goldPale);
      b.position.set(x, H1 - 0.1 - 0.32 * Math.sin(t * Math.PI), z);
      b.rotation.set(x * 7, x * 3, 0);
      b.userData.noOutline = true;
      g.add(b);
    }
  }
  const boards = [[-5.8, -1.5], [-2.6, -2.4], [2.6, -1.2], [5.8, -2.2], [0, -2.9]];
  boards.forEach(([x, z], i) => {
    const y = H1 - 0.85;
    card(0.9, 0.9, hangRegion(i), 'misc', m.signM, x, y, z + 0.01);
    card(0.9, 0.9, hangRegion(i + 1), 'misc', m.signM, x, y, z - 0.01, Math.PI);
    block(x - 0.3, y + 0.45, z - 0.004, x - 0.29, H1, z + 0.004, m.string, { shadow: false });
    block(x + 0.29, y + 0.45, z - 0.004, x + 0.3, H1, z + 0.004, m.string, { shadow: false });
  });

  /* ------------------------------------------------ the goods */
  /* Real packages (goods.js) on real fixtures, the way a discount palace
   * fronts: gondola shelving inside, chrome shelving carts, wire baskets,
   * cut-open cases and a dump bin out on the walk, goods hung on rails and
   * pegboards, a price card on everything.  Every fixture is built in its
   * own frame (frame()), so shelves can face any way. */
  const stock = makeStock(4242);
  /** A fixture's frame: local x runs left to right as seen from its front,
   * local z toward the viewer; `at` maps to the store's frame. */
  const frame = (x, z, yaw) => ({
    x, z, yaw, nx: Math.sin(yaw), nz: Math.cos(yaw),
    at: (lx, lz) => ({ x: x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z: z - lx * Math.sin(yaw) + lz * Math.cos(yaw) }),
  });
  /** A box in a fixture's frame. */
  const fblock = (F, x0, y0, z0, x1, y1, z1, mat, o) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    const p = F.at((x0 + x1) / 2, (z0 + z1) / 2);
    b.position.set(p.x, (y0 + y1) / 2, p.z);
    b.rotation.y = F.yaw;
    return add(b, o);
  };
  /** A collider round a fixture's local rect. */
  const fcollide = (F, x0, z0, x1, z1, top) => {
    const c = [F.at(x0, z0), F.at(x1, z0), F.at(x0, z1), F.at(x1, z1)];
    collide(Math.min(...c.map((p) => p.x)), Math.min(...c.map((p) => p.z)), Math.max(...c.map((p) => p.x)), Math.max(...c.map((p) => p.z)), top);
    const p = F.at((x0 + x1) / 2, (z0 + z1) / 2);
    reg('prop', p.x, p.z);
  };
  /** A shelf's worth of one kind of thing, in a fixture's frame: from its
   * front-left corner (lx, lz), `len` along, facing the fixture's front. */
  const shelf = (F, cat, lx, y, lz, len, o) => {
    const p = F.at(lx, lz);
    return stock.fill(cat, p.x, y, p.z, len, F.nx, F.nz, o);
  };

  /** A price card on a stick, standing on something `top` high, turned `ry`. */
  function pop(x, z, top, ry = 0, big = false) {
    const k = popK++;
    const w = big ? 0.5 : 0.34, h = big ? 0.375 : 0.255;
    const y = top + (big ? 0.42 : 0.3);
    card(w, h, popRegion(k), 'misc', m.signM, x, y, z, ry, r.range(-0.08, 0.08));
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.014, y - 0.08 - top, 0.014), m.string);
    s.position.set(x - 0.012 * Math.sin(ry), (top + y - 0.08) / 2, z - 0.012 * Math.cos(ry));
    add(detail(s), { shadow: false });
  }
  /** A card hung on two strings from `yTop`, its top at `y`, both faces printed. */
  function dangle(x, y, z, yTop, ry = 0, w = 0.34, h = 0.255) {
    const k = popK++;
    const c = card(w, h, popRegion(k), 'misc', m.signM, x, y - h / 2, z, ry, 0);
    const b = card(w, h, popRegion(k), 'misc', m.signM, x, y - h / 2, z, ry + Math.PI, 0);
    c.position.x += 0.004 * Math.sin(ry); c.position.z += 0.004 * Math.cos(ry);
    b.position.x -= 0.004 * Math.sin(ry); b.position.z -= 0.004 * Math.cos(ry);
    for (const s of [-0.4, 0.4]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.006, yTop - y, 0.006), m.string);
      st.position.set(x + s * w * Math.cos(ry), (yTop + y) / 2, z - s * w * Math.sin(ry));
      add(detail(st), { shadow: false });
    }
  }

  /** Gondola shelving: a black plinth, a printed back, steel shelves with
   * gold price rails, five shelves each lined with one kind of thing. */
  function gondola(F, w, cats, { h = 2.1, d = 0.42, shelves = 5 } = {}) {
    // (the plinth and the back stand between the two uprights, which own the ends: all three ended in one plane)
    fblock(F, 0.03, FLOOR, -d, w - 0.03, FLOOR + 0.1, 0.02, m.black, { shadow: false });
    fblock(F, 0.03, FLOOR, -d, w - 0.03, FLOOR + h, -d + 0.04, m.wallDark);
    const back = F.at(w / 2, -d + 0.046);
    card(w - 0.04, h - 0.16, R.misc.aisle, 'misc', m.signM, back.x, FLOOR + h / 2 + 0.02, back.z, F.yaw);
    for (const lx of [0, w - 0.03]) fblock(F, lx, FLOOR, -d, lx + 0.03, FLOOR + h, 0, m.silver, { shadow: false });
    const pitch = (h - 0.1) / shelves;
    for (let k = 0; k < shelves; k++) {
      const y = FLOOR + 0.1 + k * pitch;
      fblock(F, 0.03, y, -d + 0.04, w - 0.03, y + 0.02, 0, m.silver, { shadow: false });
      fblock(F, 0.03, y + 0.02, -0.008, w - 0.03, y + 0.05, 0, m.gold, { shadow: false });
      shelf(F, cats[k % cats.length], 0.04, y + 0.02, 0, w - 0.08, { back: 0.03 });
      if (k % 2 === (w > 2.5 ? 0 : 1)) {
        const p = F.at(w * (0.25 + ((k * 37) % 50) / 100), 0.01);
        pop(p.x, p.z, y + 0.03, F.yaw);
      }
    }
    // the header: a big card on the top
    const p = F.at(w * 0.62, -0.05);
    pop(p.x, p.z, FLOOR + h, F.yaw, true);
    fcollide(F, -0.02, -d - 0.02, w + 0.02, 0.05, FLOOR + h);
  }

  /** A chrome shelving cart (three wire tiers on casters) crammed with
   * goods two deep, the top tier heaped, cards on every tier. */
  function shelvingCart(F, cats, { w = 1.25, d = 0.55, tiers = [0.2, 0.72, 1.24] } = {}) {
    for (const [lx, lz] of [[0.02, -d + 0.02], [w - 0.05, -d + 0.02], [0.02, -0.05], [w - 0.05, -0.05]]) {
      fblock(F, lx, FLOOR + 0.06, lz, lx + 0.03, FLOOR + 1.62, lz + 0.03, m.wire, { shadow: false });
      fblock(F, lx - 0.01, FLOOR, lz - 0.01, lx + 0.04, FLOOR + 0.07, lz + 0.05, m.wheel, { shadow: false });
    }
    tiers.forEach((t, k) => {
      const y = FLOOR + t;
      fblock(F, 0, y, -d, w, y + 0.018, 0, m.wire, { shadow: false });
      fblock(F, 0, y + 0.018, -0.012, w, y + 0.06, 0, m.wire, { shadow: false });   // the front lip
      if (k === tiers.length - 1) {
        const p = F.at(0.05, -d + 0.05);
        stock.heap(cats[k % cats.length], p.x, y + 0.018, p.z, w - 0.1, d - 0.1, Math.round(w * d * 26), { lay: 0.6 });
      } else {
        shelf(F, cats[k % cats.length], 0.03, y + 0.018, 0, w - 0.06, { rows: 2, back: 0.03 });
      }
      const p = F.at(w * (0.2 + k * 0.3), 0.005);
      pop(p.x, p.z, y + 0.06, F.yaw);
    });
    const p = F.at(w * 0.5, -0.02);
    pop(p.x, p.z, FLOOR + 1.62, F.yaw, true);
    fcollide(F, -0.02, -d - 0.02, w + 0.02, 0.04, FLOOR + 1.7);
  }

  /** Wire baskets stacked two high, bottles standing in the lower, bags
   * heaped in the upper. */
  function wireBaskets(F, { w = 0.6, d = 0.4, h = 0.28 } = {}) {
    for (let k = 0; k < 2; k++) {
      const y = FLOOR + k * h;
      fblock(F, 0, y, -d, w, y + 0.012, 0, m.wire, { shadow: false });
      for (const [lx, lz] of [[0, -d], [w - 0.012, -d], [0, -0.012], [w - 0.012, -0.012]]) fblock(F, lx, y, lz, lx + 0.012, y + h, lz + 0.012, m.wire, { shadow: false });
      fblock(F, 0, y + h - 0.012, -d, w, y + h, -d + 0.012, m.wire, { shadow: false });
      fblock(F, 0, y + h - 0.012, -0.012, w, y + h, 0, m.wire, { shadow: false });
      fblock(F, 0, y + h - 0.012, -d, 0.012, y + h, 0, m.wire, { shadow: false });
      fblock(F, w - 0.012, y + h - 0.012, -d, w, y + h, 0, m.wire, { shadow: false });
      if (k === 0) shelf(F, 'can', 0.03, y + 0.012, 0, w - 0.06, { rows: 3, back: 0.03, pitch: 0.08 });
      else { const p = F.at(0.04, -d + 0.04); stock.heap(['candy', 'choco'], p.x, y + 0.012, p.z, w - 0.08, d - 0.08, 10, { lay: 0.7 }); }
    }
    const p = F.at(w * 0.5, 0.005);
    pop(p.x, p.z, FLOOR + 2 * h, F.yaw);
    fcollide(F, -0.02, -d - 0.02, w + 0.02, 0.03, FLOOR + 2 * h + 0.1);
  }

  /** Cardboard cases with their fronts cut open, stacked, cans and bottles
   * in rows inside: the cheapest display there is. */
  function cutCases(F, { w = 0.5, d = 0.36, h = 0.25, cols = 2, rows = 3 } = {}) {
    const box = (x0, y0, z0, x1, y1, z1) => {
      const b = new THREE.Mesh(uvRegion(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), R.misc.carton, 'misc'), m.paint);
      const p = F.at((x0 + x1) / 2, (z0 + z1) / 2);
      b.position.set(p.x, (y0 + y1) / 2, p.z);
      b.rotation.y = F.yaw;
      add(detail(b), { shadow: false });
    };
    for (let i = 0; i < cols; i++) {
      for (let k = 0; k < rows; k++) {
        const x0 = i * (w + 0.02), y = FLOOR + k * h;
        // (the two sides own the corners; the floor, the back and the lip sit between them: five boards through
        //  each other had their faces in one plane along every edge)
        const t = 0.015;
        box(x0 + t, y, -d + t, x0 + w - t, y + t, -t);            // the floor
        box(x0 + t, y, -d, x0 + w - t, y + h, -d + t);            // the back
        box(x0, y, -d, x0 + t, y + h, 0);                         // the sides
        box(x0 + w - t, y, -d, x0 + w, y + h, 0);
        box(x0 + t, y, -t, x0 + w - t, y + 0.07, 0);              // the cut front lip
        shelf(F, k % 2 ? 'can' : 'drink', x0 + 0.03, y + 0.015, -0.015, w - 0.06, { rows: 2, back: 0.02, pitch: 0.075, gap: 0.006 });
      }
      const p = F.at(i * (w + 0.02) + w * 0.5, 0.01);
      pop(p.x, p.z, FLOOR + rows * h - 0.02, F.yaw, i === 0);
    }
    const W = cols * (w + 0.02);
    fcollide(F, -0.02, -d - 0.02, W, 0.03, FLOOR + rows * h + 0.1);
  }

  /** A dump bin: a big cardboard bin heaped over the brim with snacks. */
  function dumpBin(F, cats, { w = 0.9, d = 0.6, h = 0.7 } = {}) {
    const box = (x0, y0, z0, x1, y1, z1) => {
      const b = new THREE.Mesh(uvRegion(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), R.misc.carton, 'misc'), m.paint);
      const p = F.at((x0 + x1) / 2, (z0 + z1) / 2);
      b.position.set(p.x, (y0 + y1) / 2, p.z);
      b.rotation.y = F.yaw;
      add(detail(b), { shadow: false });
    };
    box(0, FLOOR, -d, w, FLOOR + h, -d + 0.02);
    box(0, FLOOR, -0.02, w, FLOOR + h, 0);
    box(0, FLOOR, -d + 0.02, 0.02, FLOOR + h, -0.02);            // (the sides, between the front and the back)
    box(w - 0.02, FLOOR, -d + 0.02, w, FLOOR + h, -0.02);
    fblock(F, 0.02, FLOOR + h - 0.2, -d + 0.02, w - 0.02, FLOOR + h - 0.18, -0.02, m.wallDark, { shadow: false });   // the false bottom
    const p = F.at(0.05, -d + 0.05);
    stock.heap(cats, p.x, FLOOR + h - 0.18, p.z, w - 0.1, d - 0.1, Math.round(w * d * 40), { lay: 0.65, layers: 3 });
    const q = F.at(w * 0.5, 0.005);
    pop(q.x, q.z, FLOOR + h, F.yaw, true);
    fcollide(F, -0.02, -d - 0.02, w + 0.02, 0.03, FLOOR + h + 0.1);
  }

  /** A rail hung with goods: bags on hooks, boxes, umbrellas, price cards
   * dangling between; from lx0 to lx1 at height y (the goods hang below). */
  function hangRail(F, lx0, lx1, y, lz, cats) {
    fblock(F, lx0, y - 0.015, lz - 0.015, lx1, y + 0.015, lz + 0.015, m.wire, { shadow: false });
    for (const lx of [lx0 + 0.15, lx1 - 0.15]) fblock(F, lx - 0.006, y, lz - 0.006, lx + 0.006, H1, lz + 0.006, m.string, { shadow: false });
    const P = stock.pool(cats);
    let t = lx0 + 0.12, i = 0;
    while (t < lx1 - 0.12) {
      const p = F.at(t, lz);
      const roll = stock.q.next();
      if (roll < 0.14) {
        // an umbrella, furled: a slim bright stick with a hooked handle
        const mat = [m.red, m.gold, m.black, m.basket][i % 4];
        const u = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.72, 0.03), mat);
        u.position.set(p.x, y - 0.44, p.z); u.rotation.set(0, F.yaw, 0.05);
        add(detail(u), { shadow: false });
        const hk = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.012), m.string);
        hk.position.set(p.x, y - 0.045, p.z);
        add(detail(hk), { shadow: false });
        t += 0.09;
      } else if (roll < 0.28) {
        dangle(p.x, y - 0.12 - stock.q.range(0, 0.15), p.z, y, F.yaw);
        t += 0.42;
      } else {
        const g = stock.q.pick(P);
        const hk = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.05, 0.008), m.string);
        hk.position.set(p.x, y - 0.025, p.z);
        add(detail(hk), { shadow: false });
        stock.stamp(g, p.x - F.nx * (depthOf(g) / 2), y - 0.05 - g.h, p.z - F.nz * (depthOf(g) / 2), F.yaw + stock.q.range(-0.15, 0.15), 0, stock.q.range(-0.06, 0.06));
        t += widthOf(g) + 0.03;
      }
      i++;
    }
  }

  /** A pegboard strip with goods on hooks, `cols` across, from y0 up to y1. */
  function pegboard(F, w, y0, y1, cats, cols = 2) {
    fblock(F, 0, y0, -0.02, w, y1, 0, m.red, { shadow: false });
    const P = stock.pool(cats);
    for (let c = 0; c < cols; c++) {
      let y = y1 - 0.08;
      while (y > y0 + 0.12) {
        const g = stock.q.pick(P);
        if (y - g.h < y0) break;
        const p = F.at((c + 0.5) * (w / cols), 0.005 + depthOf(g) / 2);
        const hk = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.06), m.string);
        const hp = F.at((c + 0.5) * (w / cols), 0.03);
        hk.position.set(hp.x, y, hp.z); hk.rotation.y = F.yaw;
        add(detail(hk), { shadow: false });
        stock.stamp(g, p.x, y - 0.02 - g.h, p.z, F.yaw + stock.q.range(-0.08, 0.08));
        y -= g.h + 0.06;
      }
    }
  }

  /** A red-and-white striped wagon (ワゴン) heaped with goods and a price card. */
  function wagon(x0, z0, w, d, h, seed) {
    const geo = uvRegion(new THREE.BoxGeometry(w, h, d), R.misc.stripe, 'misc');
    const b = new THREE.Mesh(geo, m.signM);
    b.position.set(x0 + w / 2, FLOOR + h / 2, z0 + d / 2);
    add(detail(b));
    const top = new THREE.Mesh(uvRegion(new THREE.PlaneGeometry(w - 0.04, d - 0.04), R.misc.goods, 'misc'), m.signM);
    top.rotation.x = -Math.PI / 2;
    top.position.set(x0 + w / 2, FLOOR + h + 0.005, z0 + d / 2);
    g.add(detail(top));
    const cats = [['snack', 'candy'], ['choco', 'candy'], ['clean', 'tissue'], ['toy', 'party'], ['noodle', 'can']][seed % 5];
    stock.heap(cats, x0 + 0.04, FLOOR + h, z0 + 0.04, w - 0.08, d - 0.08, Math.round(w * d * 32), { lay: 0.55 });
    pop(x0 + w * (0.3 + (seed % 3) * 0.2), z0 + d * 0.85, FLOOR + h + 0.12, 0, seed % 2 === 0);
  }
  /** Cardboard cartons stacked up, printed. */
  function cartons(x, z, n, seed) {
    const q = rngKit(seed);
    let y = FLOOR;
    for (let i = 0; i < n; i++) {
      const w = q.range(0.45, 0.6), h = q.range(0.3, 0.42), d = q.range(0.38, 0.5);
      const b = new THREE.Mesh(uvRegion(new THREE.BoxGeometry(w, h, d), R.misc.carton, 'misc'), m.paint);
      b.position.set(x + q.range(-0.05, 0.05), y + h / 2, z);
      b.rotation.y = q.range(-0.15, 0.15);
      add(detail(b));
      y += h;
    }
    return y;
  }

  // a sale wagon across the aisle's mouth (the entrance ends here)
  wagon(-1.1, -3.85, 2.2, 0.7, 0.8, 11);
  // the entrance mat between the columns, black with a gold edge
  block(-3.6, FLOOR, -1.0, 3.6, FLOOR + 0.012, 0.05, m.black, { shadow: false });
  block(-3.6, FLOOR + 0.012, -1.0, 3.6, FLOOR + 0.014, -0.94, m.gold, { shadow: false });
  block(-3.6, FLOOR + 0.012, -0.01, 3.6, FLOOR + 0.014, 0.05, m.gold, { shadow: false });

  // left of the door: gondolas along the back and the end wall, a wagon and a bin before them
  gondola(frame(-7.95, -2.94, 0), 3.3, ['snack', 'noodle', 'clean', 'choco', 'tissue']);
  gondola(frame(-7.56, -0.8, Math.PI / 2), 2.1, ['cosme', 'candy', 'cosme', 'misc', 'toy']);
  wagon(-4.4, -2.55, 1.3, 0.7, 0.85, 21);
  collide(-4.45, -2.6, -3.05, -1.8, 1.0);
  wagon(-3.0, -3.3, 1.2, 0.65, 0.95, 23);
  collide(-3.05, -3.35, -1.75, -2.6, 1.0);
  dumpBin(frame(-6.9, -1.6, 0), ['snack', 'candy']);
  // right of the door: a gondola along the back, the carts in a row, cartons, a wagon, the red baskets by the door
  gondola(frame(4.65, -2.94, 0), 1.8, ['drink', 'can', 'noodle', 'snack', 'choco']);
  for (let i = 0; i < 6; i++) cart(6.9, -3.05 + i * 0.34);
  collide(6.55, -3.3, 7.3, -0.85, 1.1);
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.28, 0.36), m.basket);
    b.position.set(6.0, FLOOR + 0.14 + i * 0.085, -1.3);
    add(detail(b), { shadow: i === 6 });
  }
  collide(5.72, -1.5, 6.28, -1.1, 1.0);
  cartons(3.1, -3.0, 3, 31);
  collide(2.75, -3.3, 3.45, -2.7, 1.3);
  wagon(2.3, -2.3, 1.3, 0.7, 0.9, 24);
  collide(2.25, -2.35, 3.65, -1.55, 1.0);
  // the columns: pegboards of hanging goods on their street faces
  for (const sx of [-1, 1]) pegboard(frame(sx * 4.3 - 0.22, -0.155, 0), 0.44, 0.95, 2.7, ['candy', 'cosme', 'misc']);
  // rails of hanging goods across the entrance, under the canopy's edge
  hangRail(frame(0, -0.5, 0), -3.9, 3.9, 2.6, 0, ['party', 'toy', 'snack']);
  hangRail(frame(0, -0.5, 0), 4.6, 7.7, 2.6, 0, ['party', 'candy', 'toy']);
  hangRail(frame(0, -0.5, 0), -7.7, -4.6, 2.6, 0, ['toy', 'party', 'snack']);
  // price cards on long strings from the canopy, over the walk's goods
  for (const [x, yy] of [[-7.2, 2.75], [-5.4, 2.55], [-2.9, 2.65], [3.4, 2.7], [5.2, 2.5], [6.9, 2.7]]) dangle(x, yy, 0.55, CY0, 0);

  // spilling onto the walk (within 0.65 m of the frontage; 1.55 m stays clear):
  // two shelving carts and wire baskets on the left, cases, a wagon and cartons on the right
  shelvingCart(frame(-8.0, 0.6, 0), [['clean', 'tissue'], ['snack', 'choco'], ['snack', 'candy']]);
  shelvingCart(frame(-6.6, 0.6, 0), [['drink', 'can'], ['noodle', 'can'], ['candy', 'choco']]);
  wireBaskets(frame(-5.2, 0.5, 0));
  dumpBin(frame(-3.5, 0.62, 0), ['snack', 'party']);
  cutCases(frame(4.5, 0.5, 0));
  wagon(5.7, 0.02, 1.3, 0.6, 0.75, 44);
  collide(5.65, -0.05, 7.05, 0.67, 1.0);
  reg('prop', 6.35, 0.3);
  const cTop = cartons(7.6, 0.28, 3, 43);
  collide(7.25, 0.0, 7.95, 0.6, cTop);
  reg('prop', 7.6, 0.3);
  // the red board on its stand by the door
  {
    const x = 3.35, z = 0.3;
    card(0.55, 0.82, R.misc.board, 'misc', m.signM, x, FLOOR + 0.78, z + 0.03, 0, 0);
    block(x - 0.3, FLOOR + 0.34, z - 0.02, x + 0.3, FLOOR + 1.22, z + 0.02, m.red);
    for (const sx of [-0.25, 0.25]) block(x + sx - 0.02, FLOOR, z - 0.18, x + sx + 0.02, FLOOR + 0.4, z + 0.01, m.wheel, { shadow: false });   // (a centimetre behind the board's face: they were one plane)
    collide(x - 0.32, z - 0.2, x + 0.32, z + 0.05, 1.2);
    reg('prop', x, z);
  }

  /** A shopping cart, nose into the store. */
  function cart(x, z) {
    const c = new THREE.Group();
    const L = 0.8, Wc = 0.55, y0 = 0.45, y1 = 0.9;
    const bar = (x0, yy0, z0, x1, yy1, z1, mat = m.wire) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, yy1 - yy0, z1 - z0), mat);
      b.position.set((x0 + x1) / 2, (yy0 + yy1) / 2, (z0 + z1) / 2);
      c.add(b);
    };
    // the basket: a floor, rails round the top and middle, uprights
    bar(-Wc / 2, y0, -L / 2, Wc / 2, y0 + 0.02, L / 2);
    for (const y of [y1, (y0 + y1) / 2]) {
      bar(-Wc / 2, y - 0.012, -L / 2, Wc / 2, y + 0.012, -L / 2 + 0.024);
      bar(-Wc / 2, y - 0.012, L / 2 - 0.024, Wc / 2, y + 0.012, L / 2);
      bar(-Wc / 2, y - 0.012, -L / 2, -Wc / 2 + 0.024, y + 0.012, L / 2);
      bar(Wc / 2 - 0.024, y - 0.012, -L / 2, Wc / 2, y + 0.012, L / 2);
    }
    for (let k = 0; k <= 5; k++) {
      const zz = -L / 2 + (k * L) / 5;
      for (const sx of [-1, 1]) bar(sx * Wc / 2 - 0.01, y0, zz - 0.01, sx * Wc / 2 + 0.01, y1, zz + 0.01);
    }
    for (let k = 1; k < 4; k++) bar(-Wc / 2 + (k * Wc) / 4 - 0.01, y0, L / 2 - 0.02, -Wc / 2 + (k * Wc) / 4 + 0.01, y1, L / 2);
    // the red handle at the back, the frame and the wheels
    bar(-Wc / 2 - 0.02, y1 + 0.06, L / 2 + 0.06, Wc / 2 + 0.02, y1 + 0.12, L / 2 + 0.12, m.handle);
    for (const sx of [-1, 1]) {
      bar(sx * Wc / 2 - 0.015, 0.1, L / 2 - 0.02, sx * Wc / 2 + 0.015, y1 + 0.1, L / 2 + 0.08);
      bar(sx * (Wc / 2 - 0.05) - 0.015, 0.1, -L / 2 + 0.05, sx * (Wc / 2 - 0.05) + 0.015, y0, -L / 2 + 0.08);
      bar(sx * (Wc / 2 - 0.05) - 0.015, 0.08, -L / 2 + 0.05, sx * (Wc / 2 - 0.05) + 0.015, 0.11, L / 2);
      for (const zz of [-L / 2 + 0.07, L / 2 - 0.02]) bar(sx * (Wc / 2 - 0.05) - 0.02, 0, zz - 0.05, sx * (Wc / 2 - 0.05) + 0.02, 0.1, zz + 0.05, m.wheel);
    }
    // a red child seat flap, folded
    bar(-Wc / 2 + 0.03, y1 - 0.2, L / 2 - 0.05, Wc / 2 - 0.03, y1, L / 2 - 0.03, m.handle);
    c.position.set(x, FLOOR, z);
    c.rotation.y = Math.PI / 2;
    for (const k of c.children) { k.castShadow = false; k.receiveShadow = true; }
    g.add(detail(c));
  }

  // every package on the front: one mesh
  const goods = stock.build();
  if (goods) g.add(goods);

  /* ------------------------------------------------ night */
  if (ctx.night) {
    for (const u of [-5.8, 0, 5.8]) {
      const p = T(u, 1.1);
      ctx.night.pool(p.x, p.z, 4.2, { y: FLOOR, color: 0xfff0d8, strength: 1.15 });
    }
    for (const u of [-4, 4]) {
      const p = T(u, -1.8);
      ctx.night.pool(p.x, p.z, 3.4, { y: FLOOR, color: 0xfff6e8, strength: 0.8 });
    }
  }

  /* ------------------------------------------------ the mascot, and the theme as you pass */
  const pen = makePenguin();
  const PX = -W2 + PEN_AT * 2 * W2, PZ = 0.35, PY = H1 + 0.05;   // in the band's gap
  pen.group.position.set(PX, PY, PZ);
  pen.group.scale.setScalar(1.2);
  pen.group.userData.dynamic = true;
  g.add(pen.group);
  ctx.night?.glowing(pen.mat, 0x5560a0, 0.9);   // floodlit from the canopy

  const at = ctx.toWorld(T(PX, -0.6));
  soundBus.zone('donki-theme', { x: at.x, z: at.z, y: 3, near: S.near, far: S.far, level: S.level });
  // a sound experience (Tan, 2026-09-28): a speaker on the map, no highlight in town
  ctx.experiences?.add({ kind: 'sound', id: 'donki', name: DONPEN.en, jp: DONPEN.name, ...T(PX, -0.6) });
  const penWorld = ctx.toWorld(T(PX, PZ));
  let t = 0;

  ctx.update((dt, cam) => {
    if (!cam) return;
    const d = Math.hypot(cam.x - penWorld.x, cam.z - penWorld.z);
    if (d > S.animate) return;                       // nothing moves unseen
    t += dt;
    // a slow rock and a lazy wave
    const G = pen.group;
    G.rotation.z = 0.05 * Math.sin(t * 1.3);
    G.position.y = PY + 0.02 * Math.sin(t * 2.6);
    pen.flipper.rotation.z = -1.05 + 0.22 * Math.sin(t * 2.2);
  });

  return { group: g, penguin: pen };
}
