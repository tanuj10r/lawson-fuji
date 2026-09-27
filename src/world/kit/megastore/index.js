import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cel, flat } from '../../../core/toon.js';
import { rngKit } from '../../../core/util.js';
import { hullOutline } from '../../../core/outline.js';
import { soundBus } from '../../../core/soundBus.js';
import { DONPEN } from '../../../data/town.js';
import { frontPage, miscPage, R, uvRegion, popRegion, hangRegion, PEN_AT } from './tex.js';
import { makePenguin } from './mascot.js';

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
 *   E            ペンちゃん dances, price cards flutter down, the theme swells
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
 * from `far` in, full from `near`; E swells it to `burstLevel` for `swell` s.
 * The mascot moves only within `animate` m. */
const S = { near: 6, far: 24, level: 0.6, burstLevel: 1.0, swell: 4.5, animate: 60 };

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
    goods: new THREE.MeshBasicMaterial({ vertexColors: true }),
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

const BRIGHT = [0xe8322e, 0xf5c21b, 0x2f7fd8, 0x35b35a, 0xf07ab0, 0xff8a1e, 0x8c5cd6, 0x1fb7c4, 0xf4f2ee, 0xd81e62];

export function buildMegastore(ctx, net, kit, s, F) {
  const m = mats();
  const r = rngKit(4040);
  let popK = 0;                       // which price card is next
  const heaps = [];                   // the goods on the wagons, one mesh (heap())
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
    block(sx * (W2 - 0.6), 0, ZIN, sx * W2, H1, ZF + 0.12, m.silver, { outline: 0.003 });
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
  block(-ex, 0, ZIN, ex, FLOOR, 0.12, m.floor, { shadow: false });
  {
    const a = T(-ex, ZIN), b = T(ex, 0.12);
    ctx.platform({ x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z), top: FLOOR });
  }

  /* ------------------------------------------------ the front */
  // the canopy over the entrance, its red edge lettered with what's inside
  const CY0 = 4.0, CZ = 1.1;
  block(-W2, CY0, ZF, W2, H1 + 0.05, CZ, m.red, { outline: 0.003 });
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
    card(z1 - z0, y1 - y0, R.misc.blade, 'misc', m.signM, bx + 0.075, (y0 + y1) / 2, (z0 + z1) / 2, Math.PI / 2);
    card(z1 - z0, y1 - y0, R.misc.blade, 'misc', m.signM, bx - 0.075, (y0 + y1) / 2, (z0 + z1) / 2, -Math.PI / 2);
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
  // a sale wagon across the aisle's mouth (the entrance ends here)
  wagon(-1.1, -3.85, 2.2, 0.7, 0.8, 11);
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
  /** A price card on a stick, standing on something `top` high. */
  function pop(x, z, top, ry = 0) {
    const k = popK++;
    const y = top + 0.3;
    card(0.34, 0.255, popRegion(k), 'misc', m.signM, x, y, z, ry, r.range(-0.08, 0.08));
    detail(block(x - 0.008, top, z - 0.02, x + 0.008, y - 0.1, z - 0.004, m.string, { shadow: false }));
  }
  /** Goods heaped on a wagon's top: packs and boxes in every colour, their
   * faces shaded in the paint (the entrance is lit from inside), gathered
   * into one mesh at the end. */
  function heap(x0, z0, w, d, y, n, seed) {
    const q = rngKit(seed);
    for (let i = 0; i < n; i++) {
      const bw = q.range(0.12, 0.3), bh = q.range(0.08, 0.28), bd = q.range(0.12, 0.26);
      const x = x0 + q.range(bw / 2, w - bw / 2), z = z0 + q.range(bd / 2, d - bd / 2);
      const layer = q.int(0, 2);
      const geo = new THREE.BoxGeometry(bw, bh, bd);
      const base = new THREE.Color(q.pick(BRIGHT));
      // faces: +x, -x, +y, -y, +z, -z, four corners each
      const shade = [0.78, 0.7, 1.0, 0.5, 0.9, 0.62];
      const col = new Float32Array(24 * 3);
      for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) col.set([base.r * shade[f], base.g * shade[f], base.b * shade[f]], (f * 4 + k) * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.deleteAttribute('uv');
      geo.applyMatrix4(new THREE.Matrix4().compose(
        new THREE.Vector3(x, y + bh / 2 + layer * 0.12, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), q.range(-0.4, 0.4)),
        new THREE.Vector3(1, 1, 1)));
      heaps.push(geo);
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
    heap(x0, z0, w, d, FLOOR + h, Math.round(w * d * 40), seed);
    pop(x0 + w * (0.3 + (seed % 3) * 0.2), z0 + d * 0.7, FLOOR + h + 0.15);
  }
  /** A tall rack of shelves, its face a product wall (the aisle paint). */
  function rack(x0, z0, w, d, h) {
    block(x0, FLOOR, z0, x0 + w, FLOOR + h, z0 + d, m.wall);
    card(w - 0.04, h - 0.1, R.misc.aisle, 'misc', m.signM, x0 + w / 2, FLOOR + h / 2, z0 + d + 0.006);
    pop(x0 + w * 0.3, z0 + d + 0.02, FLOOR + h - 0.15);
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

  // left of the door: racks against the end wall, wagons in front, a carton stack
  rack(-ex + 0.05, -3.25, 1.9, 0.5, 2.3);
  rack(-ex + 0.05, -2.3, 0.5, 1.7, 2.0);
  wagon(-ex + 0.8, -1.6, 1.3, 0.7, 0.85, 21);
  wagon(-5.2, -2.9, 1.1, 0.7, 0.8, 22);
  wagon(-3.6, -3.25, 1.3, 0.6, 1.0, 23);
  collide(-ex, -3.3, -ex + 2.15, -0.85, 2.4);
  collide(-5.3, -3.35, -2.25, -2.15, 1.1);
  // right of the door: the carts in a row, red baskets, cartons
  for (let i = 0; i < 6; i++) cart(6.9, -3.05 + i * 0.34);
  collide(6.55, -3.3, 7.3, -0.85, 1.1);
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.28, 0.36), m.basket);
    b.position.set(5.6, FLOOR + 0.14 + i * 0.085, -3.0);
    add(detail(b), { shadow: i === 6 });
  }
  cartons(4.95, -2.95, 3, 31);
  collide(4.6, -3.3, 5.95, -2.6, 1.3);
  wagon(3.0, -3.25, 1.3, 0.6, 0.9, 24);
  collide(2.95, -3.35, 4.35, -2.6, 1.0);

  // spilling onto the walk: wagons and cartons along the frontage, within 0.65 m
  wagon(-8.1, 0.02, 1.4, 0.6, 0.75, 41);
  wagon(-6.5, 0.02, 1.4, 0.6, 0.75, 42);
  collide(-8.15, -0.05, -5.05, 0.67, 1.0);
  reg('prop', -7.4, 0.3); reg('prop', -5.8, 0.3);
  const cTop = cartons(7.6, 0.28, 3, 43);
  collide(7.25, 0.0, 7.95, 0.6, cTop);
  reg('prop', 7.6, 0.3);
  wagon(5.2, 0.02, 1.3, 0.6, 0.75, 44);
  collide(5.15, -0.05, 6.55, 0.67, 1.0);
  reg('prop', 5.85, 0.3);
  // the red board on its stand by the door
  {
    const x = 3.35, z = 0.3;
    card(0.55, 0.82, R.misc.board, 'misc', m.signM, x, FLOOR + 0.78, z + 0.03, 0, 0);
    block(x - 0.3, FLOOR + 0.34, z - 0.02, x + 0.3, FLOOR + 1.22, z + 0.02, m.red);
    for (const sx of [-0.25, 0.25]) block(x + sx - 0.02, FLOOR, z - 0.18, x + sx + 0.02, FLOOR + 0.4, z + 0.02, m.wheel, { shadow: false });
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

  if (heaps.length) {
    const hm = new THREE.Mesh(mergeGeometries(heaps), m.goods);
    hm.userData.detail = true;
    hm.userData.noOutline = true;
    g.add(hm);
  }

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

  /* ------------------------------------------------ the mascot, the flutter, E */
  const pen = makePenguin();
  const PX = -W2 + PEN_AT * 2 * W2, PZ = 0.35, PY = H1 + 0.05;   // in the band's gap
  pen.group.position.set(PX, PY, PZ);
  pen.group.scale.setScalar(1.2);
  pen.group.userData.dynamic = true;
  g.add(pen.group);
  ctx.night?.glowing(pen.mat, 0x5560a0, 0.9);   // floodlit from the canopy

  const confetti = makeConfetti();
  confetti.mesh.position.x = PX;
  g.add(confetti.mesh);

  const at = ctx.toWorld(T(PX, -0.6));
  const theme = soundBus.zone('donki-theme', { x: at.x, z: at.z, y: 3, near: S.near, far: S.far, level: S.level });
  const penWorld = ctx.toWorld(T(PX, PZ));
  let t = 0, burst = -1, lastLevel = S.level;
  const spot = ctx.experiences?.add({
    id: 'donki', name: DONPEN.en, jp: DONPEN.name, label: DONPEN.label,
    ...T(PX, -1.7), r: 1.3, h: 2.2, y: FLOOR,
    action: () => {
      if (burst >= 0 && burst < 2) return;
      burst = 0;
      confetti.start();
      spot?.done();
    },
  });

  ctx.update((dt, cam) => {
    if (!cam) return;
    const d = Math.hypot(cam.x - penWorld.x, cam.z - penWorld.z);
    if (d > S.animate && burst < 0) return;          // nothing moves unseen
    t += dt;
    let env = 0;
    if (burst >= 0) {
      burst += dt;
      const b = burst;
      env = b < 0.3 ? b / 0.3 : b < S.swell ? 1 : Math.max(0, 1 - (b - S.swell) / 2.5);
      if (b > S.swell + 2.5) { burst = -1; env = 0; }
    }
    // idle: a slow rock and a lazy wave; the burst: a hopping, swaying dance
    const G = pen.group;
    G.rotation.z = 0.05 * Math.sin(t * 1.3) * (1 - env) + 0.2 * Math.sin(t * 6.5) * env;
    G.rotation.y = 0.12 * Math.sin(t * 3.2) * env;
    G.position.y = PY + 0.02 * Math.sin(t * 2.6) * (1 - env) + 0.28 * Math.abs(Math.sin(t * 5.5)) * env;
    pen.flipper.rotation.z = -1.05 + 0.22 * Math.sin(t * 2.2) * (1 - env) + 0.65 * Math.sin(t * 11) * env;
    confetti.update(dt);
    const level = S.level + (S.burstLevel - S.level) * env;
    if (Math.abs(level - lastLevel) > 0.005) { theme.set({ level }); lastLevel = level; }
  });

  return { group: g, penguin: pen };
}

/* Price cards fluttering down from the canopy: one instanced mesh, shown
 * only while they fall. */
function makeConfetti() {
  const N = 56;
  const geo = new THREE.PlaneGeometry(0.16, 0.12);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.userData.dynamic = true;
  mesh.userData.noOutline = true;
  mesh.frustumCulled = false;
  mesh.visible = false;
  const cols = [0xfff23a, 0xfff23a, 0xff9ac8, 0xe0141c, 0xffffff, 0xffa64a, 0x5ad0f0];
  const r = rngKit(777);
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) mesh.setColorAt(i, c.set(cols[i % cols.length]));
  const P = Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), a: new THREE.Euler(), w: new THREE.Vector3(), ph: 0 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  let life = -1;
  return {
    mesh,
    start() {
      life = 0;
      mesh.visible = true;
      for (const k of P) {
        k.p.set(r.range(-2.2, 2.2), r.range(5.2, 7.2), r.range(0.4, 1.3));
        k.v.set(r.range(-1.6, 1.6), r.range(0.8, 2.6), r.range(0.6, 2.2));
        k.a.set(r.next() * 6, r.next() * 6, r.next() * 6);
        k.w.set(r.range(-5, 5), r.range(-5, 5), r.range(-5, 5));
        k.ph = r.next() * 6;
      }
    },
    update(dt) {
      if (life < 0) return;
      life += dt;
      if (life > 6) { life = -1; mesh.visible = false; return; }
      P.forEach((k, i) => {
        if (k.p.y > 0.2) {
          // paper: gravity against heavy drag, and a side-to-side flutter
          k.v.y -= 3.2 * dt;
          k.v.multiplyScalar(Math.exp(-2.4 * dt));
          k.p.addScaledVector(k.v, dt);
          k.p.x += Math.sin(life * 5 + k.ph) * 0.6 * dt;
          k.a.x += k.w.x * dt; k.a.y += k.w.y * dt; k.a.z += k.w.z * dt;
        }
        q.setFromEuler(k.a);
        m4.compose(k.p, q, one);
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
