import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { bake, trs } from '../../core/util.js';
import { kawaraTex, boardTex, paverTex, PAVER_TILE } from '../kit/tex.js';
import { roomTex, counterTex } from '../kit/facade/signs.js';
import { windowCell } from '../kit/paint.js';
import { makePaperLantern } from '../shops.js';
import { boardTex as nameBoardTex, norenTex, flagTex, cardTex, sideTex, jarTex, clothTex, orderTex } from './tex.js';
import { PETTAN } from '../../data/town.js';
import { MOCHI, ROADS } from '../../config.js';

/* ------------------------------------------------------------------ *
 * ぺったん堂's building and stage (the static part; the merge pass batches
 * it with the town).  A low single-storey 町家 front, set back so the strip
 * before it is an open stage paved level with the pavement:
 *
 *   the house   plaster over dark boards, a tiled roof with its eaves to the
 *               street and the name on a board standing on the roof, a
 *               lattice window (warm after dark) on the car park's side,
 *               a lattice door on the other, between them the open shop:
 *               the kit's wagashi room behind a counter (kit/facade/signs.js
 *               roomTex, counterTex), an indigo noren with the crest, two
 *               paper lanterns under the eave
 *   the stage   the stone mortar (臼) on its timber base and a step either
 *               side for the pounders, the water tub, the steamer stack on
 *               its stove, a bench under red felt, the display table (cloth,
 *               tray, price card, the dogs' jar), the order stand at the
 *               stage's edge by the ring (the card reader, the plate yours is
 *               set on, a step behind it for whoever serves), two red nobori,
 *               a board on the flank for the car park
 *
 * Authored in the lot's own frame (config MOCHI): x along the frontage, z out
 * toward the road from the frontage line.  Returns where things stand, for
 * the show (index.js).
 * ------------------------------------------------------------------ */

/** The stage's top: level with the pavement. */
export const Y0 = ROADS.asphaltY + ROADS.kerbH;
/** The mortar: its rim's height above the stage, the bowl's radius, where the dough's top rests. */
export const USU = { rim: 0.5, bowl: 0.215, dough: 0.47, step: 0.16 };
/** The display table's top above the stage; the order stand's; the step behind that (a rabbit is a metre tall). */
export const STAND_H = 0.64;
export const ORDER = { top: 0.96, w: 0.5, d: 0.32, step: 0.24 };
/** The room behind the counter: its floor above the stage, and how far in the line the rabbits wait on is. */
export const ROOM = { floor: 0.1, back: 0.76 };
const W = 9.4, D = 9.2, REC = 1.5, WALL = 2.7, RISE = 1.75, EAVE = 1.0;

/** A box whose faces tile a texture in metres (`tile` m to a repeat). */
function tiled(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
  return g;
}

export function buildShopfront(ctx, { cx, fz }) {
  const S = MOCHI.setback;
  const g = new THREE.Group();
  g.name = 'pettan-do';
  g.position.set(cx, 0, fz);
  ctx.add(g);

  const M = {
    wood: cel({ color: 0x5a4233, bands: 3, tint: 0x4b4560 }),
    boards: cel({ color: 0x7b5b42, map: boardTex(), bands: 3, tint: 0x4b4560, cache: false }),
    plaster: cel({ color: 0xf1e9d8, bands: 3, tint: 0x6f6790 }),
    roof: cel({ color: 0x626878, map: kawaraTex(), bands: 3, tint: 0x4a4468, cache: false }),
    stone: cel({ color: 0xa6a6ae, bands: 3, tint: 0x5c5680 }),
    paving: cel({ color: 0xcfc8ba, map: paverTex(), bands: 3, tint: 0x7a7396, cache: false }),
    pale: cel({ color: 0xdcbc8e, bands: 3, tint: 0x6f5680 }),
    felt: cel({ color: 0xc8322c, bands: 3, tint: 0x6f4a70 }),
    iron: cel({ color: 0x3c3a44, bands: 2, tint: 0x4b4560 }),
    water: flat({ color: 0x9ccbe0 }),
    ember: flat({ color: 0xf2903a }),
  };
  const P = Object.fromEntries(Object.keys(M).map((k) => [k, []]));
  const add = (k, geo, m) => P[k].push({ geometry: geo, matrix: m });
  const bx = (k, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => add(k, new THREE.BoxGeometry(w, h, d), trs(x, y, z, rx, ry, rz));
  const hw = W / 2, zf = -S, zb = -S - D, zm = -S - D / 2;

  /* ---- the ground: the stage, paved level with the pavement, and the house's plinth ---- */
  add('paving', tiled(10.5, Y0, S + 0.1, PAVER_TILE), trs(0, Y0 / 2, -S / 2 + 0.05));
  bx('stone', W + 0.24, Y0 + 0.1, D + 0.1, 0, (Y0 + 0.1) / 2, zm - 0.03);

  /* ---- the house: the back volume, the two front bays, the open shop between them ---- */
  const wy = Y0 + WALL / 2;
  bx('plaster', W, WALL, D - REC, 0, wy, zb + (D - REC) / 2);
  const BAY = 2.75, bayX = hw - BAY / 2;
  for (const s of [-1, 1]) {
    bx('plaster', BAY, WALL, REC, s * bayX, wy, zf - REC / 2);
    // dark boards to the sill, and down the flank
    add('boards', tiled(BAY + 0.04, 0.86, 0.06, 1.2), trs(s * bayX, Y0 + 0.43, zf + 0.02));
  }
  for (const s of [-1, 1]) add('boards', tiled(0.06, 1.0, D + 0.04, 1.2), trs(s * (hw + 0.02), Y0 + 0.5, zm));
  // down each flank: two small lattice windows (the kitchen, the store room), lit or dark after dark
  for (const s of [-1, 1]) for (const [z, lit] of [[zm + 1.6, s > 0], [zm - 2.2, s < 0]]) {
    const w = 1.3, h = 0.9, y = Y0 + 1.75, x = s * (hw + 0.012);
    const pane = new THREE.Mesh(windowCell(new THREE.PlaneGeometry(w, h), 6), ctx.night?.glass(lit) ?? M.iron);
    pane.position.set(x, y, z);
    pane.rotation.y = s * Math.PI / 2;
    pane.userData.noOutline = true;
    g.add(pane);
    bx('wood', 0.1, 0.08, w + 0.2, x + s * 0.03, y + h / 2 + 0.04, z);
    bx('wood', 0.14, 0.06, w + 0.24, x + s * 0.05, y - h / 2 - 0.03, z);
    for (let i = 0; i < 7; i++) bx('wood', 0.04, h, 0.032, x + s * 0.045, y, z - w / 2 + (w * (i + 0.5)) / 7);
  }
  // posts and beams: the frame a machiya shows
  // (the corner posts stand 2.5 cm proud of the flank and the back wall: no face of theirs lies in a wall's plane)
  for (const x of [-hw + 0.055, -hw + BAY, hw - BAY, hw - 0.055]) bx('wood', 0.16, WALL, 0.16, x, wy, zf + 0.03);
  bx('wood', W + 0.1, 0.2, 0.2, 0, Y0 + WALL - 0.1, zf + 0.03);
  bx('wood', W - 2 * BAY, 0.3, 0.16, 0, Y0 + 2.42, zf + 0.02);          // the lintel the noren hangs under
  for (const s of [-1, 1]) bx('wood', 0.12, WALL, 0.12, s * (hw - 0.04), wy, zb + 0.04);

  /* the lattice window (the car park's side: +x): glass that glows after dark, bars before it */
  {
    const x = bayX, y = Y0 + 1.58, w = 2.0, h = 1.3;
    const glass = new THREE.Mesh(windowCell(new THREE.PlaneGeometry(w, h), 6), ctx.night?.glass(true) ?? M.iron);
    glass.position.set(x, y, zf + 0.012);
    glass.userData.noOutline = true;
    g.add(glass);
    bx('wood', w + 0.16, 0.09, 0.14, x, y + h / 2 + 0.04, zf + 0.06);
    bx('wood', w + 0.24, 0.07, 0.2, x, y - h / 2 - 0.035, zf + 0.08);
    for (const s of [-1, 1]) bx('wood', 0.08, h, 0.12, x + s * (w / 2 + 0.04), y, zf + 0.06);
    for (let i = 0; i < 12; i++) bx('wood', 0.034, h, 0.045, x - w / 2 + (w * (i + 0.5)) / 12, y, zf + 0.085);
    bx('wood', w, 0.03, 0.03, x, y + 0.02, zf + 0.1);
    ctx.night?.glow(g, w, h, x, y, zf + 0.02);
  }
  /* the lattice door on the other side */
  {
    const x = -bayX, w = 1.5, h = 2.0, y = Y0 + h / 2 + 0.04;
    const glass = new THREE.Mesh(windowCell(new THREE.PlaneGeometry(w, h), 6), ctx.night?.glass(false) ?? M.iron);
    glass.position.set(x, y, zf + 0.012);
    glass.userData.noOutline = true;
    g.add(glass);
    bx('wood', w + 0.2, 0.1, 0.14, x, y + h / 2 + 0.05, zf + 0.06);
    for (const s of [-1, 0, 1]) bx('wood', s ? 0.09 : 0.06, h, 0.1, x + s * (w / 2 + 0.045), y, zf + 0.06);
    for (let i = 0; i < 8; i++) { if (i === 3 || i === 4) continue; bx('wood', 0.03, h - 0.5, 0.04, x - w / 2 + (w * (i + 0.5)) / 8, y + 0.25, zf + 0.075); }
    bx('boards', w, 0.48, 0.04, x, Y0 + 0.28, zf + 0.05);
    bx('stone', 1.9, 0.06, 0.5, x, Y0 + 0.03, zf + 0.26);                 // the door's step stone
  }

  /* the open shop: the kit's wagashi room as two painted cards behind a real counter */
  const openW = W - 2 * BAY;
  {
    const room = new THREE.Mesh(new THREE.PlaneGeometry(openW, 2.3), flat({ color: 0xc8bfcc, map: roomTex('wagashi', 'counter'), cache: false }));
    room.position.set(0, Y0 + 1.15, zf - REC + 0.03);
    room.userData.noOutline = true;
    g.add(room);
    const cw = openW - 0.3, ch = 1.2;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), flat({ color: 0xd8d0dc, map: counterTex('wagashi', 'counter', cw / ch), alphaTest: 0.5, cache: false }));
    card.position.set(0, Y0 + 0.1 + ch / 2, zf - REC * 0.55);
    card.userData.noOutline = true;
    g.add(card);
    bx('plaster', openW, 0.1, REC, 0, Y0 + 2.6, zf - REC / 2);           // the room's ceiling
    bx('stone', openW, 0.1, REC, 0, Y0 + 0.05, zf - REC / 2);            // its floor
    // the counter across most of the opening, a gap at the door's end for whoever serves
    const cx0 = 0.45, cwid = openW - 1.0;
    add('boards', tiled(cwid, 0.84, 0.44, 1.2), trs(cx0, Y0 + 0.42, zf - 0.3));
    bx('pale', cwid + 0.1, 0.05, 0.56, cx0, Y0 + 0.865, zf - 0.28);
    // on it: the price card on its little easel, a stack of wooden trays
    const pc = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.27), flat({ color: 0xffffff, map: cardTex(), cache: false }));
    pc.position.set(cx0 + 0.9, Y0 + 1.04, zf - 0.12);
    pc.rotation.x = -0.2;
    pc.userData.noOutline = true;
    g.add(pc);
    bx('wood', 0.38, 0.29, 0.02, cx0 + 0.9, Y0 + 1.035, zf - 0.135, -0.2);
    for (let i = 0; i < 3; i++) bx('pale', 0.5, 0.05, 0.34, cx0 - 0.75, Y0 + 0.915 + i * 0.055, zf - 0.3, 0, 0.06 * (i - 1));
    ctx.night?.glow(g, openW - 0.1, 2.2, 0, Y0 + 1.25, zf - 0.02);
  }

  /* ---- the roof: eaves to the street, tiled; plaster gables; the ridge ---- */
  {
    const slope = RISE / (D / 2), rw = W + 0.9;
    const yRidge = Y0 + WALL + RISE;
    for (const [z0, z1] of [[zf + EAVE, zm], [zb - 0.6, zm]]) {
      const run = Math.abs(z1 - z0), len = Math.hypot(run, run * slope) + 0.1;
      const y0 = yRidge - run * slope;
      add('roof', tiled(rw, 0.14, len, 2.4), trs(0, (y0 + yRidge) / 2 + 0.06, (z0 + z1) / 2, z0 > z1 ? Math.atan(slope) : -Math.atan(slope)));
      bx('wood', rw, 0.1, 0.07, 0, y0 + 0.0, z0 + (z0 > z1 ? -0.03 : 0.03));   // the eave's board
    }
    bx('roof', rw + 0.1, 0.2, 0.4, 0, yRidge + 0.14, zm);
    for (const s of [-1, 1]) bx('roof', 0.2, 0.34, 0.5, s * (rw / 2 + 0.02), yRidge + 0.18, zm);
    // the gables
    for (const s of [-1, 1]) {
      const tri = new THREE.BufferGeometry();
      const x = s * hw, a = [x, Y0 + WALL, zf], b = [x, Y0 + WALL, zb], c = [x, yRidge - 0.05, zm];
      tri.setAttribute('position', new THREE.Float32BufferAttribute(s > 0 ? [...a, ...b, ...c] : [...b, ...a, ...c], 3));
      tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
      tri.setIndex([0, 1, 2]);
      tri.computeVertexNormals();
      add('plaster', tri, null);
      bx('wood', 0.1, 0.18, D + 0.3, s * (hw + 0.03), Y0 + WALL + 0.02, zm);
    }
    /* the name: a board standing on the roof over the shop, a little cap of its own */
    const by = Y0 + WALL + 0.62, bz = zf - 0.42;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.75), flat({ color: 0xffffff, map: nameBoardTex(), cache: false }));
    board.position.set(0, by, bz + 0.045);
    board.userData.noOutline = true;
    g.add(board);
    bx('wood', 3.08, 0.83, 0.07, 0, by, bz);
    bx('wood', 3.3, 0.07, 0.3, 0, by + 0.45, bz);
    for (const s of [-1, 1]) bx('wood', 0.09, 0.7, 0.09, s * 1.2, by - 0.42, bz - 0.12, 0.35);
  }

  /* ---- the noren, the lanterns ---- */
  {
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(openW - 0.16, 0.74), flat({ color: 0xffffff, map: norenTex(), alphaTest: 0.5, side: THREE.DoubleSide, cache: false }));
    cloth.position.set(0, Y0 + 1.92, zf + 0.13);
    cloth.userData.noOutline = true;
    g.add(cloth);
    add('wood', new THREE.CylinderGeometry(0.018, 0.018, openW, 6).rotateZ(Math.PI / 2), trs(0, Y0 + 2.28, zf + 0.13));
    for (const s of [-1, 1]) {
      const l = makePaperLantern({ x: s * (openW / 2 + 0.28), y: Y0 + 2.2, z: zf + 0.5, variant: 1, lit: true, drop: 0.22, r: 0.17 });
      l.userData.detail = true;
      g.add(l);
    }
  }

  /* ---- the board on the flank, for the car park (+x) ---- */
  {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 2.24), flat({ color: 0xffffff, map: sideTex(), cache: false }));
    b.position.set(hw + 0.115, Y0 + 1.75, zf - 0.75);
    b.rotation.y = Math.PI / 2;
    b.userData.noOutline = true;
    g.add(b);
    bx('wood', 0.07, 2.34, 0.64, hw + 0.07, Y0 + 1.75, zf - 0.75);
  }

  /* ================================ the stage ================================ */
  const [ux, uz] = MOCHI.usu;
  /* the mortar: stone, a bowl hollowed in its top, on a square timber base */
  {
    const pr = [[0, 0], [0.25, 0], [0.275, 0.05], [0.285, 0.2], [0.31, 0.4], [0.3, 0.44], [USU.bowl + 0.012, 0.44], [USU.bowl - 0.02, 0.36], [0.12, 0.29], [0, 0.275]];
    const lathe = new THREE.LatheGeometry(pr.map(([r, y]) => new THREE.Vector2(r, y)), 18);
    add('stone', lathe, trs(ux, Y0 + 0.06, uz));
    bx('pale', 0.74, 0.06, 0.74, ux, Y0 + 0.03, uz);
    // the pounders' steps, either side
    for (const s of [-1, 1]) bx('pale', 0.42, USU.step, 0.46, ux + s * 0.82, Y0 + USU.step / 2, uz);
    // the water tub by the turner's place, a ladle's worth of water in it
    add('pale', new THREE.CylinderGeometry(0.14, 0.12, 0.2, 12, 1, true), trs(ux + 0.5, Y0 + 0.1, uz - 0.72));
    add('water', new THREE.CircleGeometry(0.128, 12).rotateX(-Math.PI / 2), trs(ux + 0.5, Y0 + 0.165, uz - 0.72));
    for (const y of [0.04, 0.16]) add('iron', new THREE.CylinderGeometry(0.143, 0.14, 0.018, 12, 1, true), trs(ux + 0.5, Y0 + y, uz - 0.72));
  }
  /* the steamer: a clay stove, its pot, three square seiro and the lid */
  const seiro = [3.25, -2.3];
  {
    const [x, z] = seiro;
    bx('iron', 0.66, 0.5, 0.62, x, Y0 + 0.25, z);
    add('ember', new THREE.PlaneGeometry(0.26, 0.16), trs(x, Y0 + 0.17, z + 0.312));
    add('iron', new THREE.CylinderGeometry(0.27, 0.3, 0.1, 12), trs(x, Y0 + 0.55, z));
    for (let i = 0; i < 3; i++) {
      bx('pale', 0.5, 0.125, 0.5, x, Y0 + 0.665 + i * 0.13, z, 0, i * 0.05);
      bx('wood', 0.51, 0.022, 0.51, x, Y0 + 0.61 + i * 0.13, z, 0, i * 0.05);
    }
    bx('pale', 0.53, 0.035, 0.53, x, Y0 + 1.01, z, 0, 0.1);
    bx('wood', 0.2, 0.03, 0.05, x, Y0 + 1.045, z, 0, 0.1);
  }
  /* the bench under red felt, side-on to the show */
  const bench = [-3.75, -1.55];
  {
    const [x, z] = bench;
    bx('wood', 0.5, 0.05, 1.5, x, Y0 + 0.4, z);
    for (const s of [-1, 1]) for (const t of [-1, 1]) bx('wood', 0.06, 0.4, 0.06, x + s * 0.19, Y0 + 0.2, z + t * 0.62);
    for (const t of [-1, 1]) bx('wood', 0.38, 0.05, 0.05, x, Y0 + 0.16, z + t * 0.62);
    bx('felt', 0.54, 0.02, 1.54, x, Y0 + 0.435, z);
    for (const t of [-1, 1]) bx('felt', 0.54, 0.16, 0.012, x, Y0 + 0.36, z + t * 0.776);
  }
  /* the display table: a low table under an indigo cloth, the tray, the price card, the dogs' jar */
  const [sx, sz] = MOCHI.stand;
  const top = Y0 + STAND_H;
  {
    bx('pale', 0.9, 0.04, 0.5, sx, top - 0.02, sz);
    for (const s of [-1, 1]) for (const t of [-1, 1]) bx('wood', 0.05, STAND_H - 0.04, 0.05, sx + s * 0.4, Y0 + (STAND_H - 0.04) / 2, sz + t * 0.2);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.5), flat({ color: 0xffffff, map: clothTex(), cache: false }));
    cloth.position.set(sx, top - 0.29, sz + 0.256);
    cloth.userData.noOutline = true;
    g.add(cloth);
    // the lacquer tray the day's mochi sit on (index.js sets them out)
    bx('iron', 0.44, 0.016, 0.26, sx - 0.2, top + 0.008, sz - 0.04);
    // the price card
    const pc = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.15), flat({ color: 0xffffff, map: cardTex(), cache: false }));
    pc.position.set(sx - 0.24, top + 0.1, sz + 0.17);
    pc.rotation.x = -0.3;
    pc.userData.noOutline = true;
    g.add(pc);
    bx('wood', 0.21, 0.16, 0.012, sx - 0.24, top + 0.098, sz + 0.162, -0.3);
    // the jar of dried sweet potato, for dogs
    const jx = sx + 0.33, jz = sz - 0.08;
    add('pale', new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10), trs(jx, top + 0.05, jz));          // the strips inside, a block of amber
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.15, 12, 1, true), flat({ color: 0xe6f2f8, transparent: true, opacity: 0.3, depthWrite: false, cache: false }));
    glass.position.set(jx, top + 0.075, jz);
    glass.userData.noOutline = true; glass.userData.noShadow = true;
    g.add(glass);
    add('wood', new THREE.CylinderGeometry(0.066, 0.066, 0.022, 12), trs(jx, top + 0.161, jz));
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.085), flat({ color: 0xffffff, map: jarTex(), cache: false }));
    label.position.set(jx, top + 0.075, jz + 0.0635);
    label.userData.noOutline = true;
    g.add(label);
  }
  /* the order stand, at the stage's edge by the ring: a slim cabinet of dark boards under a pale top, its sign on the
   * front; on it the card reader (tipped toward you) and the plate; behind it a step for whoever serves */
  const [ox, oz] = MOCHI.counter;
  const otop = Y0 + ORDER.top;
  const reader = [ox + 0.12, otop + 0.034, oz + 0.035], plate = [ox - 0.1, otop + 0.014, oz - 0.03], stool = [ox - 0.26, Y0 + ORDER.step, oz - 0.5];
  {
    add('boards', tiled(ORDER.w - 0.08, ORDER.top - 0.04, ORDER.d - 0.08, 1.2), trs(ox, Y0 + (ORDER.top - 0.04) / 2, oz));
    bx('pale', ORDER.w, 0.04, ORDER.d, ox, otop - 0.02, oz);
    bx('wood', ORDER.w - 0.04, 0.06, ORDER.d - 0.04, ox, Y0 + 0.03, oz);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), flat({ color: 0xffffff, map: orderTex(), cache: false }));
    sign.position.set(ox, Y0 + 0.66, oz + (ORDER.d - 0.08) / 2 + 0.006);
    sign.userData.noOutline = true;
    g.add(sign);
    // the reader: a dark pad on a little wedge, its face to you
    bx('iron', 0.13, 0.024, 0.1, reader[0], reader[1] - 0.012, reader[2], 0.3);
    bx('iron', 0.11, 0.03, 0.05, reader[0], otop + 0.012, reader[2] - 0.03);
    // the plate
    add('plaster', new THREE.CylinderGeometry(0.068, 0.05, 0.014, 28), trs(plate[0], otop + 0.007, plate[2]));
    // the server's step
    bx('pale', 0.38, 0.04, 0.34, stool[0], stool[1] - 0.02, stool[2]);
    for (const s2 of [-1, 1]) bx('wood', 0.04, ORDER.step - 0.04, 0.3, stool[0] + s2 * 0.15, Y0 + (ORDER.step - 0.04) / 2, stool[2]);
  }
  /* the nobori, at the stage's front corners */
  const flags = [[4.85, -0.42, 0], [-4.85, -0.42, 1]];
  for (const [x, z, k] of flags) {
    add('iron', new THREE.CylinderGeometry(0.02, 0.02, 2.75, 6), trs(x, Y0 + 1.375, z));
    add('iron', new THREE.CylinderGeometry(0.012, 0.012, 0.52, 5).rotateZ(Math.PI / 2), trs(x - Math.sign(x) * 0.24, Y0 + 2.7, z));
    add('stone', new THREE.CylinderGeometry(0.13, 0.16, 0.12, 10), trs(x, Y0 + 0.06, z));
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 1.84), flat({ color: 0xffffff, map: flagTex(PETTAN.flags[k]), side: THREE.DoubleSide, cache: false }));
    cloth.position.set(x - Math.sign(x) * 0.25, Y0 + 1.77, z + 0.01);
    cloth.rotation.y = -Math.sign(x) * 0.1;
    cloth.userData.noOutline = true;
    g.add(cloth);
  }

  let tris = 0;
  for (const [k, list] of Object.entries(P)) {
    if (!list.length) continue;
    const mesh = new THREE.Mesh(bake(list), M[k]);
    tris += (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3;
    mesh.castShadow = k !== 'water' && k !== 'ember';
    mesh.receiveShadow = true;
    if (k === 'water' || k === 'ember') mesh.userData.noOutline = true;
    g.add(mesh);
  }

  /* ---- what is solid, what the town counts, the light after dark ---- */
  const C = (x0, z0, x1, z1, topY) => ctx.collide(cx + x0, fz + z0, cx + x1, fz + z1, topY);
  C(-hw, zb, hw, zf, Y0 + WALL);
  C(ux - 1.22, uz - 1.15, ux + 1.22, uz + 0.5, Y0 + 1.2);                 // the mortar and the three at it
  C(sx - 0.5, sz - 0.3, sx + 0.5, sz + 0.3, top + 0.1);
  C(ox - ORDER.w / 2 - 0.22, oz - 0.7, ox + ORDER.w / 2, oz + ORDER.d / 2, otop + 0.1);      // the order stand and the step behind it
  C(seiro[0] - 0.4, seiro[1] - 0.38, seiro[0] + 0.4, seiro[1] + 0.38, Y0 + 1.0);
  C(bench[0] - 0.3, bench[1] - 0.8, bench[0] + 0.3, bench[1] + 0.8, Y0 + 0.45);
  for (const [x, z] of flags) C(x - 0.15, z - 0.15, x + 0.15, z + 0.15, Y0 + 2.0);
  ctx.platform({ x0: cx - 5.25, x1: cx + 5.25, z0: fz - S, z1: fz + 0.05, top: Y0 });
  ctx.registry?.push({ kind: 'building', x: cx, z: fz + zm, rect: [cx - hw, fz + zb, cx + hw, fz + zf] });
  for (const [x, z] of [[ux, uz], [sx, sz], [ox, oz], seiro, bench, ...flags]) ctx.registry?.push({ kind: 'prop', x: cx + x, z: fz + z });
  ctx.night?.pool(cx, fz - S * 0.45, 3.4, { y: Y0, strength: 1.1 });
  ctx.night?.pool(cx + sx, fz + sz, 1.4, { y: Y0, strength: 0.6 });

  return {
    group: g, tris, seiro: [seiro[0], Y0 + 1.06, seiro[1]], standTop: top, tray: [sx - 0.2, top + 0.016, sz - 0.04], jar: [sx + 0.33, top + 0.17, sz - 0.08],
    plate, reader, stool, orderTop: otop,
    // the room: the line behind the counter the rabbits wait on (its floor), and the gap at the door's end they come out by
    room: { y: Y0 + ROOM.floor, z: zf - ROOM.back, gap: -openW / 2 + 0.475, counterTop: Y0 + 0.89 },
    H: Y0 + WALL + RISE + 0.3,
  };
}
