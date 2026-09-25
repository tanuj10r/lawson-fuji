import * as THREE from 'three';
import { LAWSON } from '../../config.js';
import { rngKit } from '../../core/util.js';
import { makePainter } from './painter.js';
import { paintBasketStack } from './basket.js';
import { stockStore, CHILLED_SECTIONS, DOOR_SIGNS, AISLES } from './planogram.js';
import {
  floorTex, FLOOR_TILE, ceilingTex, CEIL_TILE, hangingSign, popCard, cigaretteTex, magazineTex,
  machineFace, doorSign, registerScreen, counterLabel, batteryFace, stripSign, smallSign,
} from './tex.js';

/* ------------------------------------------------------------------ *
 * Inside the Lawson (SPEC 5 floor plan; reference/konbini-details.md).
 *
 * Looking in from the door, which is left of centre:
 *   left wall     the ticket kiosk, the copier and the ATM by the front,
 *                 then the open chilled case (onigiri, sandwiches, bento)
 *   back wall     the walk-in cooler: eight glass doors, lit from inside
 *   the floor     four gondolas, 1.5 m, below eye height, so you see over
 *                 them to the drinks; end caps with POP toward the front
 *   front glass   the magazine rack, right of the door
 *   right side    the counter: registers, the hot showcase, the steamer,
 *                 oden, the coffee machine at its end; behind it the
 *                 cigarette wall, the back counter and the staff door
 *   back right    the toilet door
 * Aisles are 1.4 m.  Units: the store's frame (glass at z 0, back at -10).
 *
 * `slots` lists every shelf run (position, zone, facing) for M3b's
 * products; the filler stock painted here stands in until then.
 * ------------------------------------------------------------------ */

const hw = LAWSON.width / 2;
const X0 = -hw + 0.28, X1 = hw, Z0 = -LAWSON.depth + 0.28, Z1 = 0;
const FLOOR = 0.02;
const SLOPE = 0.14;                 // gravity shelves, tilted toward you (about 8°)
const CEIL = LAWSON.height - LAWSON.coping - LAWSON.signBand - 0.02;   // 2.94

const C = {
  wall: 0xf2efe8, wallLow: 0xe2ddd4, skirt: 0x8a8e9a,
  shelf: 0xeceef2, upright: 0xb8bcc6, kick: 0x5a5e6a, rail: 0xdfe8f0,
  coolerFrame: 0x2c2e38, coolerBack: 0xf6f8fc, coolerShelf: 0xd8dce4,
  caseBody: 0xe8eaee, caseDark: 0x3a3e4a, caseLight: 0xfdfdf6,
  counterFront: 0xd9c4a0, counterTop: 0x7c808c, counterBack: 0xe8e4dc,
  steel: 0xc8ccd4, black: 0x26282e, mat: 0x4a4e5a, glassTint: 0xcfe0ec,
};
const GOODS = [0xd8504a, 0xf2c23c, 0x4f8fd0, 0x6fb86a, 0xf2f2f2, 0xe8864a, 0xc070b0, 0x7ac8d8, 0xe8d8b0];

export function buildInterior(group, { lit, colliders }) {
  const p = makePainter();
  const r = rngKit(3301);
  const slots = [];
  // the glass doors of the cooler and freezers (store/doors.js hangs them):
  // a hinge at (x, z), turned `base` so the leaf runs along local +x (times
  // `s`) with the shop at local +z; `holds` says which stock is behind it
  const doors = [];
  const block = (x0, x1, z0, z1, top = 2) => colliders.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), top });

  /* ---------------------------- the room ---------------------------- */
  p.quad(floorTex(), 0, FLOOR, (Z0 + Z1) / 2, X1 - X0, Z1 - Z0, { rx: -Math.PI / 2, uv: [0, 0, (X1 - X0) / FLOOR_TILE, (Z1 - Z0) / FLOOR_TILE] });
  p.quad(ceilingTex(), 0, CEIL, (Z0 + Z1) / 2, X1 - X0, Z1 - Z0, { rx: Math.PI / 2, uv: [0, 0, (X1 - X0) / CEIL_TILE, (Z1 - Z0) / CEIL_TILE] });
  // walls: warm white, a skirting board, a band of the store's blue up high
  // (a centimetre inside the shell's faces, so the two never fight)
  p.box(X0 + 0.01, X0 + 0.03, FLOOR, CEIL, Z0, Z1, C.wall);
  p.box(X0, X1, FLOOR, CEIL, Z0 + 0.01, Z0 + 0.03, C.wall);
  p.box(X1 - 0.03, X1 - 0.01, FLOOR, CEIL, Z0, Z1, C.wall);
  p.box(X0, X0 + 0.02, FLOOR, FLOOR + 0.1, Z0, Z1, C.skirt);
  p.box(X1 - 0.02, X1, FLOOR, FLOOR + 0.1, Z0, Z1, C.skirt);
  // the light rows: long troffers over every aisle, running front to back
  for (const x of [-7.0, -4.4, -2.1, 0.2, 2.6, 5.0, 7.4]) {
    for (let z = -1.2; z > Z0 + 0.5; z -= 2.0) p.box(x - 0.16, x + 0.16, CEIL - 0.05, CEIL - 0.01, z - 0.9, z + 0.9, 0xffffff, { shade: [1, 1, 1, 1.12, 1, 1] });
  }

  /* ------------------------ the walk-in cooler ------------------------
   * Eight glass doors across the back wall, each one category with its
   * sign on the header (DOOR_SIGNS, store/planogram.js), six gravity
   * shelves sloped toward you, the drinks in vertical blocks. */
  {
    const zf = Z0 + 0.72, xa = -8.0, bays = 8, bw = 1.4;
    const levels = [0.14, 0.52, 0.86, 1.18, 1.5, 1.82];
    // the lit inside: its back wall, floor and ceiling (the drinks stand in it)
    p.box(xa, xa + bays * bw, FLOOR, CEIL, Z0, Z0 + 0.05, C.coolerBack);
    p.box(xa, xa + bays * bw, FLOOR, 0.1, Z0, zf - 0.08, C.coolerShelf);
    p.box(xa, xa + bays * bw, 2.3, 2.34, Z0, zf - 0.08, 0xffffff);
    for (let b = 0; b < bays; b++) {
      const x = xa + b * bw;
      levels.forEach((y, k) => {
        // a gravity shelf, 8° down toward the door, with its price strip
        p.box(x + 0.06, x + bw - 0.06, y - 0.03, y - 0.01, zf - 0.62, zf - 0.08, C.coolerShelf, { rx: SLOPE });
        p.box(x + 0.06, x + bw - 0.06, y - 0.07, y - 0.01, zf - 0.1, zf - 0.08, C.rail);
        slots.push({ zone: 'drinks', bay: b, level: k, x0: x + 0.1, x1: x + bw - 0.1, y, z: zf - 0.16, rail: zf - 0.075, face: { x: 0, z: 1 } });
      });
      // the door's opening: black posts, header and sill; the door hangs in it
      p.box(x, x + 0.06, FLOOR, 2.3, zf - 0.08, zf, C.coolerFrame);
      p.box(x, x + bw, 2.24, 2.3, zf - 0.08, zf, C.coolerFrame);
      p.box(x, x + bw, FLOOR, 0.12, zf - 0.08, zf, C.coolerFrame);
      doors.push({ x: x + 0.06, z: zf + 0.012, base: 0, s: 1, len: bw - 0.06, y0: 0.12, y1: 2.24, sticker: b % 3 === 1,
        holds: { zone: 'drinks', axis: 'x', a: x, b: x + bw } });
      const [jp, en, col] = DOOR_SIGNS[b];
      p.quad(stripSign(jp, en, col), x + bw / 2, 2.5, zf + 0.01, bw - 0.1, 0.26);
    }
    p.box(xa + bays * bw - 0.06, xa + bays * bw, FLOOR, 2.3, zf - 0.08, zf, C.coolerFrame);
    p.box(xa, xa + bays * bw, 2.3, CEIL, zf - 0.08, zf, C.wall);                     // the bulkhead over it
    block(xa, xa + bays * bw, Z0, zf + 0.05);
  }

  /* ---------------------- the back-right corner ----------------------
   * An upright glass-door freezer (frozen food, bags of ice), the toilet. */
  {
    const fx0 = 3.5, fx1 = 5.1, fz = Z0 + 0.7;
    // a hollow cabinet: lit back, sides, top and bottom (the shelves show)
    p.box(fx0, fx1, FLOOR, 2.1, Z0, Z0 + 0.06, C.coolerBack);
    for (const x of [fx0, fx1 - 0.05]) p.box(x, x + 0.05, FLOOR, 2.1, Z0, fz, 0xeef0f4);
    p.box(fx0, fx1, FLOOR, 0.12, Z0, fz, 0xeef0f4);
    p.box(fx0, fx1, 2.0, 2.1, Z0, fz, 0xeef0f4);
    for (let k = 0; k < 4; k++) {
      const y = 0.2 + k * 0.46;
      p.box(fx0 + 0.05, fx1 - 0.05, y - 0.02, y, fz - 0.6, fz - 0.05, C.coolerShelf);
      slots.push({ zone: 'freezer', level: k, x0: fx0 + 0.1, x1: fx1 - 0.1, y, z: fz - 0.2 });
    }
    for (const x of [fx0, (fx0 + fx1) / 2, fx1 - 0.05]) p.box(x, x + 0.05, FLOOR, 2.1, fz, fz + 0.05, C.coolerFrame);
    p.box(fx0, fx1, 2.05, 2.1, fz, fz + 0.05, C.coolerFrame);
    p.box(fx0, fx1, FLOOR, 0.1, fz, fz + 0.05, C.coolerFrame);
    p.quad(stripSign('冷凍食品・氷', 'Frozen', '#3a8ad0'), (fx0 + fx1) / 2, 2.35, fz + 0.02, 1.5, 0.28);
    const mid = (fx0 + fx1) / 2;
    doors.push({ x: fx0 + 0.05, z: fz + 0.065, base: 0, s: 1, len: mid - fx0 - 0.05, y0: 0.1, y1: 2.05, holds: { zone: 'freezer', axis: 'x', a: fx0, b: mid + 0.025 } });
    doors.push({ x: fx1 - 0.05, z: fz + 0.065, base: 0, s: -1, len: fx1 - mid - 0.1, y0: 0.1, y1: 2.05, holds: { zone: 'freezer', axis: 'x', a: mid + 0.025, b: fx1 } });
    block(fx0, fx1, Z0, fz + 0.06);
    // the toilet door and its sign
    p.box(5.6, 6.5, FLOOR, 2.1, Z0, Z0 + 0.05, 0xd8d4cc);
    p.box(6.33, 6.38, 0.95, 1.05, Z0 + 0.05, Z0 + 0.1, C.steel);
    p.quad(doorSign('toilet'), 6.05, 2.35, Z0 + 0.03, 0.6, 0.3);
    // a convex security mirror high in the back-left corner, and dome cameras
    p.cyl(X0 + 0.4, CEIL - 0.6, Z0 + 0.4, 0.28, 0.06, 0xdce8f0, 16);
    p.cyl(-1.0, CEIL - 0.1, -6.0, 0.08, 0.06, 0x2a2a30, 10);
    p.cyl(5.2, CEIL - 0.1, -1.5, 0.08, 0.06, 0x2a2a30, 10);
  }

  /* --------------------- the open chilled case (left) ---------------------
   * Grouped by type in vertical sections along its length (CHILLED_SECTIONS,
   * store/planogram.js): onigiri, sandwiches, bento and noodles, salads,
   * sweets, dairy -- a strip on the canopy names each. */
  {
    const xb = X0, xf = X0 + 0.85, za = -11.6, zb = -3.9;
    p.box(xb, xf, FLOOR, 0.35, za, zb, C.caseDark);                               // the base grille
    p.box(xb, xb + 0.12, 0.35, 2.1, za, zb, C.caseBody);                            // the back
    p.box(xb, xf + 0.05, 2.0, 2.2, za, zb, C.caseBody);                             // the canopy
    p.box(xf - 0.05, xf + 0.05, 1.98, 2.02, za, zb, C.caseDark);                    // the air-curtain grille
    for (let k = 0; k < 5; k++) {
      const y = 0.45 + k * 0.33, depth = 0.8 - k * 0.1;
      p.box(xb + 0.12, xb + depth, y - 0.02, y, za, zb, C.shelf);
      p.box(xb + 0.12, xb + depth, y + 0.28, y + 0.3, za, zb, C.caseLight);         // the light under the shelf above
      p.box(xb + depth - 0.02, xb + depth, y - 0.06, y, za, zb, C.rail);
      slots.push({ zone: 'chilled', level: k, depth, x: xb + depth - 0.12, y, z0: za + 0.05, z1: zb - 0.05, rail: xb + depth + 0.012, face: { x: 1, z: 0 } });
    }
    for (const sec of CHILLED_SECTIONS) {
      p.quad(stripSign(sec.jp, sec.en, sec.col), xf + 0.06, 2.1, (sec.z0 + sec.z1) / 2, Math.min(1.4, Math.abs(sec.z1 - sec.z0) - 0.06), 0.2, { ry: Math.PI / 2 });
    }
    block(xb, xf + 0.05, za, zb);
  }

  /* ------------------- the machines by the door (left) ------------------- */
  {
    const machines = [['kiosk', -0.35, -0.95, 1.5], ['copy', -1.1, -2.1, 1.25], ['atm', -2.25, -3.2, 1.6]];
    for (const [kind, za, zb, h] of machines) {
      const col = kind === 'kiosk' ? 0xd8342f : kind === 'atm' ? 0xe0e4ea : 0xeaeaea;
      p.box(X0, X0 + 0.7, FLOOR, h, zb, za, col);
      p.quad(machineFace(kind), X0 + 0.705, h * 0.55, (za + zb) / 2, Math.abs(za - zb) - 0.08, h * 0.9, { ry: Math.PI / 2 });
    }
    block(X0, X0 + 0.72, -3.2, -0.3);
    // the phone-battery rental kiosk on the wall beyond the ATM (generic)
    p.box(X0, X0 + 0.22, 0.4, 1.75, -3.78, -3.3, 0xf2f2f0);
    p.quad(batteryFace(), X0 + 0.225, 1.08, -3.54, 0.44, 1.3, { ry: Math.PI / 2 });
    block(X0, X0 + 0.24, -3.8, -3.3, 1.8);
  }

  /* ------------------------------ gondolas ------------------------------ */
  const H = 1.5, runs = [-5.55, -3.25, -0.95, 1.35], zA = -9.8, zB = -2.6;
  runs.forEach((cx, gi) => {
    const x0 = cx - 0.45, x1 = cx + 0.45;
    p.box(cx - 0.03, cx + 0.03, FLOOR, H, zA, zB, C.upright);                        // the spine
    p.box(x0, x1, FLOOR, 0.12, zA, zB, C.kick);
    p.box(x0 - 0.02, x1 + 0.02, H - 0.03, H, zA - 0.02, zB + 0.02, C.upright);        // the top cap
    for (const side of [-1, 1]) {
      const xs = side < 0 ? x0 : x1;
      for (let k = 0; k < 5; k++) {
        const y = 0.16 + k * 0.27;
        p.box(Math.min(cx, xs), Math.max(cx, xs), y - 0.02, y, zA, zB, C.shelf);
        p.box(xs - 0.01, xs + 0.01, y - 0.06, y, zA, zB, C.rail);                     // the price rail
        slots.push({ zone: 'gondola', gi, side, level: k, x: xs, y, z0: zA + 0.05, z1: zB - 0.05, face: { x: side, z: 0 } });
      }
    }
    // the end cap toward the front, and its POP card on top
    p.box(x0, x1, FLOOR, H, zB, zB + 0.04, C.shelf);                                // its back panel
    p.box(x0, x0 + 0.03, FLOOR, H, zB, zB + 0.36, C.upright);
    p.box(x1 - 0.03, x1, FLOOR, H, zB, zB + 0.36, C.upright);
    p.box(x0, x1, FLOOR, 0.12, zB, zB + 0.36, C.kick);
    for (let k = 0; k < 4; k++) {
      const y = 0.2 + k * 0.33;
      p.box(x0 + 0.03, x1 - 0.03, y - 0.02, y, zB + 0.04, zB + 0.36, C.shelf);
      p.box(x0, x1, y - 0.05, y, zB + 0.34, zB + 0.36, C.rail);
      slots.push({ zone: 'endcap', gi, level: k, x0: x0 + 0.05, x1: x1 - 0.05, y, z: zB + 0.22, rail: zB + 0.37, face: { x: 0, z: 1 } });
    }
    p.quad(popCard(['new', 'rec', 'limited', 'sale'][gi]), cx, H + 0.2, zB + 0.2, 0.52, 0.39);
    // each side's category on a strip along its top edge (M3d)
    for (const side of [-1, 1]) {
      const [, jp, en, col] = AISLES[gi][side];
      for (const z of [zA + 1.2, (zA + zB) / 2, zB - 1.2]) p.quad(stripSign(jp, en, col), cx + side * 0.472, H + 0.055, z, 0.5, 0.1, { ry: side * Math.PI / 2 });
    }
    p.box(cx - 0.01, cx + 0.01, H, H + 0.02, zB + 0.18, zB + 0.22, C.upright);
    block(x0, x1, zA, zB + 0.36, H);
  });

  /* ----------------------------- hanging signs ----------------------------- */
  // one over each aisle, naming the two sides it runs between (AISLES, planogram.js)
  const signs = [
    ['パン', 'Bread', '#d8a060', -6.85], ['カップ麺・スナック', 'Instant food & snacks', '#e8864a', -4.4],
    ['お菓子・医薬品', 'Sweets & medicine', '#2e8a5a', -2.1], ['コスメ・日用品', 'Cosmetics & daily goods', '#d86a8a', 0.2],
    ['お酒・おつまみ', 'Wine, sake & snacks', '#8a4aa8', 2.6],
  ];
  for (const [jp, en, band, x] of signs) p.quad(hangingSign(jp, en, band), x, CEIL - 0.45, -4.4, 1.2, 0.375);
  p.quad(hangingSign('飲料・お酒', 'Drinks & alcohol', '#3a8ad0'), -2.4, CEIL - 0.3, -10.8, 1.6, 0.5);
  p.quad(hangingSign('アイスクリーム', 'Ice cream', '#3a8ad0'), 3.35, CEIL - 0.45, -4.2, 1.2, 0.375, { ry: Math.PI / 2 });

  /* ---------------- the magazine rack, left of the eat-in ---------------- */
  {
    const xa = -1.05, xb = 1.9, zb = -0.18, zf = -0.62;
    p.box(xa, xb, FLOOR, 0.5, zf, zb, C.upright);
    for (let k = 0; k < 2; k++) {
      const y = 0.55 + k * 0.32;
      p.box(xa, xb, y - 0.02, y, zf + k * 0.12, zb, C.shelf);
      p.quad(magazineTex(), (xa + xb) / 2, y + 0.14, zf + k * 0.12 + 0.02, xb - xa, 0.3, { rx: -0.25, uv: [0, 0, (xb - xa) / 1.9, 1] });
    }
    block(xa, xb, zf, zb, 1.1);
  }
  magazineTex().wrapS = THREE.RepeatWrapping;

  /* ------------- the eat-in counter (イートイン) at the window -------------
   * A counter along the glass, stools, and the self-serve microwaves at its
   * end with a hand sanitiser -- as many konbini now have. */
  {
    const xa = 2.2, xb = 5.25, zb = -0.18, zf = -0.66;
    p.box(xa, xb, 0.98, 1.02, zf, zb, 0xc9a878);                                     // the counter top, wood
    p.box(xa, xb, FLOOR, 0.98, zb - 0.06, zb, 0xe8e4dc);                              // its front panel at the glass
    for (const x of [xa + 0.05, xb - 0.05]) p.box(x - 0.03, x + 0.03, FLOOR, 0.98, zf + 0.05, zb - 0.06, C.steel);
    for (let i = 0; i < 4; i++) {
      const x = xa + 0.4 + i * 0.75;
      p.cyl(x, FLOOR, -1.0, 0.02, 0.66, C.steel, 8);
      p.cyl(x, 0.66, -1.0, 0.17, 0.05, 0x3a3e4a, 14);
      p.cyl(x, FLOOR, -1.0, 0.16, 0.02, C.steel, 14);
    }
    p.quad(smallSign('eatin'), (xa + xb) / 2, 2.45, -0.2, 0.6, 0.3);
    block(xa, xb, zf, zb, 1.1);
    // the microwaves, on their own table at the counter's end
    const mx0 = 5.35, mx1 = 6.0;
    p.box(mx0, mx1, FLOOR, 0.9, -0.75, -0.2, 0xe8e4dc);
    for (const z of [-0.6, -0.33]) {
      p.box(mx0 + 0.04, mx1 - 0.04, 0.9, 1.2, z - 0.12, z + 0.12, 0xf2f2f2);
      p.box(mx0 + 0.02, mx0 + 0.04, 0.95, 1.16, z - 0.1, z + 0.06, 0x2a2e36);                // the window, facing the shop (-x)
      p.box(mx0 + 0.02, mx0 + 0.04, 1.0, 1.1, z + 0.08, z + 0.11, 0x58e08a);                 // its display
    }
    p.cyl(mx0 + 0.3, 0.9, -0.72, 0.035, 0.16, 0xe8f0f4, 10);                                // the sanitiser
    p.quad(smallSign('microwave'), mx0 - 0.005, 1.45, -0.47, 0.5, 0.25, { ry: -Math.PI / 2 });
    block(mx0, mx1, -0.78, -0.18, 1.3);
  }

  /* ------------------- baskets, mat and umbrella bags ------------------- */
  {
    // two stacks of baskets on dollies, by the door and at the counter's end
    // (M3d): real nested baskets; the top one of each is drawn on its own (shop.js)
    const stacks = [];
    for (const [bx, bz] of [[-4.3, -0.9], [5.55, -1.3]]) {
      const top = paintBasketStack(p, bx, bz, 5, smallSign('baskets'));
      stacks.push(top);
      block(bx - 0.29, bx + 0.29, bz - 0.22, bz + 0.22, 0.6);
    }
    group.userData.basketStacks = stacks;
    p.box(-3.3, -1.3, FLOOR, FLOOR + 0.012, -1.2, -0.1, C.mat);
    p.box(-0.9 - 0.12, -0.9 + 0.12, FLOOR, 0.9, -0.95, -0.75, C.steel);
    p.box(-0.9 - 0.1, -0.9 + 0.1, 0.9, 1.25, -0.9, -0.8, 0xeef2f6);
    // the umbrella stand, just inside the door
    const ux = -0.55, uz = -1.4;
    p.box(ux - 0.2, ux + 0.2, FLOOR, 0.45, uz - 0.15, uz + 0.15, C.steel);
    p.box(ux - 0.18, ux + 0.18, 0.45, 0.47, uz - 0.13, uz + 0.13, C.kick);
    block(ux - 0.22, ux + 0.22, uz - 0.17, uz + 0.17, 0.8);
    slots.push({ zone: 'umbrella', x: ux, y: 0.1, z: uz });
  }

  /* ------------------------------ the counter ------------------------------ */
  {
    const xf = 6.1, xb = 6.85, za = -6.6, zb = -1.6;
    p.box(xf, xb, FLOOR, 0.92, za, zb, C.counterFront);
    p.box(xf - 0.04, xb + 0.02, 0.92, 0.97, za - 0.04, zb + 0.04, C.counterTop);
    p.box(xf - 0.01, xf, 0.1, 0.12, za, zb, 0xfff6e0);                               // the kick light
    // the front end: hot showcase and steamer
    // the hot showcase: a steel frame, a warm-lit back, glass to the shop
    p.box(xb - 0.12, xb - 0.05, 0.97, 1.5, zb - 0.9, zb - 0.1, 0xffe0a8);             // the lit back
    p.box(xf + 0.05, xb - 0.05, 0.97, 1.02, zb - 0.9, zb - 0.1, C.steel);
    p.box(xf + 0.03, xb - 0.03, 1.48, 1.54, zb - 0.92, zb - 0.08, C.steel);
    for (const z of [zb - 0.9, zb - 0.1]) p.box(xf + 0.05, xb - 0.05, 1.02, 1.48, z - 0.02, z + 0.02, C.steel);
    p.quad(counterLabel('hot'), xf + 0.02, 1.62, zb - 0.5, 0.6, 0.22, { ry: -Math.PI / 2 });
    for (let k = 0; k < 2; k++) {
      p.box(xf + 0.08, xb - 0.14, 1.03 + k * 0.22, 1.04 + k * 0.22, zb - 0.85, zb - 0.15, C.steel);     // the trays
      slots.push({ zone: 'hot', id: 'karaage', x: xf + 0.35, y: 1.04 + k * 0.22, z0: zb - 0.82, z1: zb - 0.18 });
    }
    // the steamer: a glass box on a steel base, buns on a rack inside
    p.box(xf + 0.05, xb - 0.05, 0.97, 1.08, zb - 1.7, zb - 1.05, C.steel);
    p.box(xf + 0.05, xb - 0.05, 1.42, 1.46, zb - 1.7, zb - 1.05, C.steel);
    for (let k = 0; k < 2; k++) {
      p.box(xf + 0.08, xb - 0.08, 1.07 + k * 0.17, 1.08 + k * 0.17, zb - 1.66, zb - 1.09, C.steel);
      slots.push({ zone: 'hot', id: 'nikuman', x: xf + 0.35, y: 1.08 + k * 0.17, z0: zb - 1.62, z1: zb - 1.12 });
    }
    p.quad(counterLabel('steam'), xf + 0.02, 1.55, zb - 1.38, 0.5, 0.18, { ry: -Math.PI / 2 });
    // two registers, each with its customer display and card reader
    for (const z of [-3.3, -4.5]) {
      p.box(xf + 0.35, xb - 0.02, 0.97, 1.2, z - 0.25, z + 0.25, C.black);
      p.box(xf + 0.05, xf + 0.1, 1.05, 1.35, z - 0.14, z + 0.14, C.black);
      p.quad(registerScreen(), xf + 0.045, 1.22, z, 0.26, 0.13, { ry: -Math.PI / 2 });
      p.box(xf + 0.12, xf + 0.26, 0.97, 1.02, z + 0.3, z + 0.42, 0x3a3e4a);        // the card reader
      p.box(xf + 0.06, xf + 0.3, 0.97, 0.99, z - 0.45, z - 0.3, 0x9aa0aa);        // the coin tray
    }
    // oden and the coffee machine at the back end
    p.box(xf + 0.1, xb - 0.1, 0.97, 1.2, -5.5, -5.0, C.steel);
    for (let i = 0; i < 4; i++) p.box(xf + 0.12 + (i % 2) * 0.27, xf + 0.36 + (i % 2) * 0.27, 1.2, 1.21, -5.45 + Math.floor(i / 2) * 0.22, -5.27 + Math.floor(i / 2) * 0.22, 0xe8c888);
    p.quad(counterLabel('oden'), xf + 0.08, 1.32, -5.25, 0.4, 0.15, { ry: -Math.PI / 2 });
    p.quad(counterLabel('counter'), xf - 0.01, 0.75, -3.9, 0.9, 0.34, { ry: -Math.PI / 2 });
    p.quad(counterLabel('coffee'), xf + 0.08, 1.9, za + 0.35, 0.5, 0.19, { ry: -Math.PI / 2 });
    // the counter's front: a panel line and a darker plinth
    p.box(xf - 0.01, xf, FLOOR, 0.1, za, zb, 0x6a6e7a);
    p.box(xf - 0.012, xf, 0.5, 0.52, za, zb, 0xc2a880);
    p.box(xf + 0.1, xb - 0.05, 0.97, 1.75, za + 0.1, za + 0.6, 0x3a3e4a);            // the coffee machine
    p.box(xf + 0.08, xf + 0.1, 1.2, 1.6, za + 0.15, za + 0.55, 0xc88a4a);
    p.box(xf + 0.12, xb - 0.1, 0.97, 1.3, za + 0.7, za + 0.95, 0xf2f2f2);              // cups and lids
    block(xf - 0.04, X1, za - 0.3, zb + 0.04, 1.2);
    // behind: the back counter, microwaves, the cigarette wall, the staff door
    p.box(X1 - 0.6, X1, FLOOR, 0.9, -6.6, -1.6, C.counterBack);
    for (const z of [-2.6, -3.5]) { p.box(X1 - 0.55, X1 - 0.08, 0.9, 1.22, z - 0.3, z + 0.3, 0xf2f2f2); p.box(X1 - 0.56, X1 - 0.54, 0.95, 1.17, z - 0.24, z + 0.1, 0x2a2e36); }
    p.box(X1 - 0.3, X1, 1.4, 2.7, -6.2, -1.9, 0x3a3e4a);
    p.quad(cigaretteTex(), X1 - 0.305, 2.05, -4.05, 4.2, 1.26, { ry: -Math.PI / 2 });
    p.box(X1 - 0.04, X1, FLOOR, 2.05, -7.9, -7.0, 0xc8ccd4);
    p.quad(doorSign('staff'), X1 - 0.05, 2.3, -7.45, 0.8, 0.4, { ry: -Math.PI / 2 });
    slots.push({ zone: 'hot', id: 'oden', x: xf + 0.25, y: 0.97, z0: -4.95, z1: -4.75 });
    slots.push({ zone: 'coffee', x: xf + 0.3, y: 0.97, z0: za + 0.72, z1: za + 0.93 });
  }

  /* ---------------- the ice-cream case: an open flat freezer ----------------
   * 冷凍平台: an open top you reach into from every side, a cold rim, wire
   * baskets dividing the kinds (ICE_BASKETS, store/planogram.js). */
  {
    const x0 = 2.85, x1 = 3.85, z0 = -5.6, z1 = -3.0, top = 0.84, floorY = 0.6;
    // an open well: four walls with a rim, a floor inside, a kick grille
    const wall = 0.06;
    for (const [a0, a1, b0, b1] of [[x0, x1, z0, z0 + wall], [x0, x1, z1 - wall, z1], [x0, x0 + wall, z0, z1], [x1 - wall, x1, z0, z1]]) {
      p.box(a0, a1, FLOOR, top - 0.03, b0, b1, 0xeef0f4);
      p.box(a0 - 0.005, a1 + 0.005, top - 0.03, top, b0 - 0.005, b1 + 0.005, 0x9aa8b8);
    }
    p.box(x0 + wall, x1 - wall, 0.12, floorY, z0 + wall, z1 - wall, 0xdfe6ee);             // the well's floor, frosted
    p.box(x0 + 0.02, x1 - 0.02, FLOOR, 0.12, z0 - 0.005, z1 + 0.005, C.caseDark);          // the kick grille
    const cols = 2, rows = 6, bw = (x1 - x0 - 0.12) / cols, bl = (z1 - z0 - 0.12) / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const bx0 = x0 + 0.06 + i * bw, bz0 = z0 + 0.06 + j * bl;
        // the wire basket's rim and dividers
        p.box(bx0, bx0 + bw, top - 0.1, top - 0.08, bz0, bz0 + 0.012, C.steel);
        p.box(bx0, bx0 + 0.012, top - 0.1, top - 0.08, bz0, bz0 + bl, C.steel);
        slots.push({ zone: 'icecase', basket: i * rows + j, x0: bx0 + 0.02, x1: bx0 + bw - 0.02, z0: bz0 + 0.02, z1: bz0 + bl - 0.02, y: floorY, tagY: top - 0.07, tagX: i === 0 ? x0 + 0.01 : x1 - 0.01, side: i === 0 ? -1 : 1 });
      }
    }
    p.quad(smallSign('ice'), (x0 + x1) / 2, 1.2, z1 + 0.02, 0.5, 0.25);
    p.box((x0 + x1) / 2 - 0.01, (x0 + x1) / 2 + 0.01, top, 1.07, z1 - 0.01, z1 + 0.01, C.steel);
    block(x0, x1, z0, z1, 0.95);
  }

  /* ------------- the self-serve corner: smoothies, ice for coffee -------------
   * Along the right wall past the staff door: a freezer door of frozen fruit
   * cups and ice cups, and the blender you set a cup into (7-Eleven style,
   * generic); the drinks are made in M5/M6. */
  {
    const xw = X1, xc = X1 - 0.62;
    // the freezer door: cups of cut fruit behind glass
    p.box(xw - 0.06, xw, FLOOR, 2.0, -10.1, -8.9, C.coolerBack);                     // the lit back
    for (const z of [-10.1, -8.95]) p.box(xc, xw, FLOOR, 2.0, z, z + 0.05, 0xeef0f4);   // the sides
    p.box(xc, xw, FLOOR, 0.12, -10.1, -8.9, 0xeef0f4);
    p.box(xc, xw, 1.95, 2.0, -10.1, -8.9, 0xeef0f4);
    for (let k = 0; k < 4; k++) {
      const y = 0.25 + k * 0.42;
      p.box(xc + 0.04, xw - 0.04, y - 0.02, y, -10.02, -8.98, C.coolerShelf);
      slots.push({ zone: 'selfserve', level: k, x: xc + 0.22, y, z0: -10.0, z1: -9.0 });
    }
    for (const z of [-10.1, -9.5, -8.95]) p.box(xc - 0.05, xc, FLOOR, 2.0, z, z + 0.05, C.coolerFrame);
    doors.push({ x: xc - 0.065, z: -10.05, base: -Math.PI / 2, s: 1, len: 0.55, y0: 0.1, y1: 1.95, holds: { zone: 'selfserve', axis: 'z', a: -10.1, b: -9.475 } });
    doors.push({ x: xc - 0.065, z: -8.95, base: -Math.PI / 2, s: -1, len: 0.5, y0: 0.1, y1: 1.95, holds: { zone: 'selfserve', axis: 'z', a: -9.475, b: -8.9 } });
    // the counter with two blenders, lids and straws, a sink
    p.box(xc, xw, FLOOR, 0.92, -11.9, -10.2, 0xe8e4dc);
    p.box(xc - 0.03, xw, 0.92, 0.96, -11.93, -10.17, C.counterTop);
    for (const z of [-11.5, -10.8]) {
      p.box(xc + 0.08, xw - 0.08, 0.96, 1.5, z - 0.22, z + 0.22, 0xf2f2f2);           // the machine
      p.box(xc + 0.06, xc + 0.1, 1.1, 1.3, z - 0.12, z + 0.12, 0x2a3a5a);             // its screen
      p.cyl(xc + 0.3, 1.5, z, 0.1, 0.18, 0xdce8f0, 14);                               // the dome it blends under
      p.box(xc + 0.05, xc + 0.08, 1.02, 1.05, z + 0.14, z + 0.18, 0x58e08a);          // a lit button
    }
    p.quad(smallSign('smoothie'), xw - 0.01, 2.25, -10.5, 1.1, 0.55, { ry: -Math.PI / 2 });
    block(xc - 0.06, xw, -11.95, -8.85, 1.6);
  }

  // the products on every shelf, and their price tags (M3b, store/planogram.js)
  const units = stockStore(p, slots, group, lit);
  p.build(group, lit, { name: 'store' });
  group.userData.slots = slots;
  group.userData.units = units;
  group.userData.doors = doors;
  return { slots, units, doors };
}

/* -------------------------------------------------------------------- *
 * The automatic door: two sliding glass leaves on the entrance, opening
 * as you come within `near` metres, closing `hold` seconds after you are
 * clear, over `ease` seconds.  Solid only while shut.
 * -------------------------------------------------------------------- */
export function buildDoor(root, { alu, glassMat, colliders, near = 1.8, hold = 2.0, ease = 0.6 }) {
  const d0 = LAWSON.doorX - LAWSON.doorWidth / 2, d1 = LAWSON.doorX + LAWSON.doorWidth / 2;
  const top = 2.16, lw = LAWSON.doorWidth / 2;
  const leaves = [];
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    const x = LAWSON.doorX + side * lw / 2;
    const frame = [
      [lw, 0.06, -lw / 2, 0.08 + 0.03], [lw, 0.06, -lw / 2, top - 0.03],
    ];
    for (const [w, h, , y] of frame) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), alu);
      m.position.set(0, y, 0);
      g.add(m);
    }
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, top - 0.08, 0.05), alu);
      m.position.set(sx * (lw / 2 - 0.025), (top + 0.08) / 2, 0);
      g.add(m);
    }
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(lw - 0.1, top - 0.14), glassMat);
    pane.position.set(0, (top + 0.08) / 2, 0.01);
    pane.userData.noOutline = true;
    pane.renderOrder = 2;
    g.add(pane);
    g.position.set(x, 0, -0.1);
    g.userData.dynamic = true;
    root.add(g);
    leaves.push({ g, side, x });
  }
  const block = { x0: d0, x1: d1, z0: -0.2, z1: 0.35, top: 3 };
  colliders.push(block);
  let open = 0, clear = 0;
  return {
    d0, d1,
    get open() { return open; },
    /** `p` the player's position (the store's frame is the world's). */
    update(dt, p) {
      const dist = Math.hypot(Math.max(0, Math.abs(p.x - LAWSON.doorX) - lw), p.z);
      if (dist < near) clear = 0; else clear += dt;
      const want = dist < near || clear < hold ? 1 : 0;
      open = Math.max(0, Math.min(1, open + (want ? 1 : -1) * dt / ease));
      const e = open * open * (3 - 2 * open);
      for (const l of leaves) l.g.position.x = l.x + l.side * e * (lw - 0.06);
      block.top = open > 0.8 ? -1 : 3;          // walk through once it is mostly open
    },
  };
}
