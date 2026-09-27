import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { bake, trs } from '../../core/util.js';
import { hullOutline } from '../../core/outline.js';
import { RAIL_TOP } from '../railway.js';
import { mergeStatic } from '../merge.js';
import { CONTACT_Y } from './track.js';
import { RIDE } from '../../data/town.js';
import { destTex, runNoTex, carNumberTex, doorLcdTex, carAdsTex, CAR_AD_CELLS, prioritySticker } from './tex.js';

/* ------------------------------------------------------------------ *
 * Our train (Tan: "an extremely detailed train, like the real trains of
 * Japan"): a two-car commuter EMU in the stainless-steel manner of the
 * E231/E233 family, in our own livery -- the Fujimi Line's green band with
 * a sakura-pink pinstripe.  Built hollow, so it stops at the platform,
 * opens its doors and can be walked through.
 *
 *   outside   silver skin with bead lines and panel seams, the band, black
 *             rubber round the windows and doors, four doors a side with
 *             their windows, the cab front (black mask, windscreen, the
 *             LED destination 快速 渋谷, run number, head and tail lights,
 *             snowplough, coupler), a single-arm pantograph, the roof
 *             air-conditioner, underfloor boxes and tanks, bogies with
 *             their springs, gangway bellows between the cars
 *   inside    long seats (priority seats at the ends), the tall partitions
 *             by the doors, poles, luggage racks, straps that sway, the
 *             door LCDs, hanging ads and the cards over the windows, the
 *             lit ceiling, the cab behind its partition window
 *
 * Cost: everything that doesn't move is baked per material and merged
 * across the set (merge.js folds the plain colours into one batch); the
 * moving parts are the door leaves (one vertex-coloured mesh and its glass
 * per sliding group), one strap InstancedMesh per set, and one mesh for
 * every destination LED on the set.
 *
 * Doors are two leaves each that slide into the wall pocket (`setDoors`).
 * They open on the car's local -z side, which is the platform side on both
 * tracks: trains keep left, and a westbound set is the eastbound one turned
 * round.
 * ------------------------------------------------------------------ */

export const CAR_L = 19.4, CAR_W = 2.86, PITCH = 20.1;
export const FLOOR = 1.06, TOP = 3.74, ROOF = 3.96;
export const DOORS = [-7.0, -2.4, 2.4, 7.0];
export const DOOR_W = 1.32;
const DOOR_TOP = FLOOR + 1.85;
const WIN_Y0 = 2.02, WIN_Y1 = 3.12;
const BAYS = [[-8.55, 1.5], [-4.7, 3.1], [0, 3.3], [4.7, 3.1], [8.55, 1.5]];
const BAND = [1.80, 1.98], PIN = [1.74, 1.78], TOPLINE = [3.22, 3.28];
const DWIN = [2.06, 2.82];                    // the door windows
const BOGIE_X = 6.85;
const RAIL_Y = TOP - 0.33;                    // the strap rails
export const SEAT_D = 0.52, SEAT_TOP = FLOOR + 0.44;
const CAB_WALL = CAR_L / 2 - 1.75;            // the cab's back wall, from the car's centre

const C = {
  steel: 0xc9cdd5, steelHi: 0xe4e7ec, band: new THREE.Color(RIDE.color).getHex(), pink: new THREE.Color(RIDE.pink).getHex(),
  rubber: 0x24242c, roof: 0x8f939c, gear: 0xaeb2ba, under: 0x3e4049, bogie: 0x33343d, spring: 0x6b6d78,
  wheel: 0x4a4552, insul: 0xe6e2d8, yellow: 0xf2c23c, console: 0x3a3d48, panel: 0xdfe3e9,
};

let M = null;
function mats() {
  if (M) return M;
  const c = (color, tint = 0x6f6796, bands = 3) => cel({ color, bands, tint });
  const live = (color, tint = 0x6a6288) => {
    const m = cel({ color, bands: 3, tint, emissive: color, emissiveIntensity: 0, cache: false });
    m.userData.live = true;
    return m;
  };
  M = {
    steel: c(C.steel, 0x6a6a92), steelHi: c(C.steelHi, 0x6a6a92), band: c(C.band, 0x3f5a6a), pink: c(C.pink, 0x8a5a86),
    rubber: c(C.rubber, 0x4b4560, 2), bellows: c(0x5e606c, 0x4b4560), roof: c(C.roof, 0x60597f), gear: c(C.gear, 0x5c5680), under: c(C.under, 0x4b4560, 2),
    bogie: c(C.bogie, 0x4b4560, 2), spring: c(C.spring, 0x5c5680), wheel: c(C.wheel, 0x4b4560, 2), insul: c(C.insul, 0x7a7090),
    yellow: c(C.yellow, 0x8a6a50), console: c(C.console, 0x4b4560, 2),
    // the interior: its own glow after dark (setNight), so it reads as lit
    lining: live(0xeceae4, 0x7a7090),
    floor: live(0x9c9ca8),
    seat: live(0x3f5f9e, 0x3f4a7a),
    seatPri: live(0xb4606e, 0x6a4a6a),
    seatBase: live(0xb8bac4),
    pole: live(0xd8dce4, 0x666090),
    strap: live(0xf4f2ec, 0x6f6796),
    door: cel({ color: 0xffffff, bands: 3, tint: 0x6a6a92, vertexColors: true, cache: false }),
    light: flat({ color: 0xfffbea }),
    glass: flat({ color: 0xa8c4e0, transparent: true, opacity: 0.2, depthWrite: false }),
    cabGlass: flat({ color: 0x2c3348 }),
    glint: flat({ color: 0xe4eef8, transparent: true, opacity: 0.16, depthWrite: false }),
    head: flat({ color: 0xfff6da }),
    tail: flat({ color: 0xff4a3a }),
    lampOff: flat({ color: 0x5a5660 }),
    tailOff: flat({ color: 0x6a2a2a }),
    lcd: flat({ color: 0xffffff, map: doorLcdTex() }),
    ads: flat({ color: 0xffffff, map: carAdsTex() }),
    runNo: flat({ color: 0xffffff, map: runNoTex() }),
    carNo: [flat({ color: 0xffffff, map: carNumberTex(0) }), flat({ color: 0xffffff, map: carNumberTex(1) })],
    priority: flat({ color: 0xffffff, map: prioritySticker() }),
  };
  M.interior = [M.lining, M.floor, M.seat, M.seatPri, M.seatBase, M.pole, M.strap];
  return M;
}

/** The side-wall intervals along x, each with its openings (door / window / solid). */
function wallCells() {
  const edges = new Set([-CAR_L / 2, CAR_L / 2]);
  for (const d of DOORS) { edges.add(d - DOOR_W / 2); edges.add(d + DOOR_W / 2); }
  for (const [c, w] of BAYS) { edges.add(c - w / 2); edges.add(c + w / 2); }
  const xs = [...edges].sort((a, b) => a - b);
  const cells = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = xs[i], b = xs[i + 1], m = (a + b) / 2;
    if (b - a < 1e-3) continue;
    const door = DOORS.some((d) => Math.abs(m - d) < DOOR_W / 2);
    const win = !door && BAYS.some(([c, w]) => Math.abs(m - c) < w / 2);
    cells.push({ a, b, kind: door ? 'door' : win ? 'window' : 'solid' });
  }
  return cells;
}

/** The long seats: [x0, x1] between the doors (and the cab wall / end wall). */
export function benchRuns(cab = 0) {
  const lo = cab < 0 ? -CAB_WALL + 0.1 : -CAR_L / 2 + 0.55;
  const hi = cab > 0 ? CAB_WALL - 0.1 : CAR_L / 2 - 0.55;
  const stops = [lo, ...DOORS.flatMap((d) => [d - DOOR_W / 2 - 0.12, d + DOOR_W / 2 + 0.12]), hi];
  const runs = [];
  for (let i = 0; i + 1 < stops.length; i += 2) if (stops[i + 1] - stops[i] > 0.8) runs.push([stops[i], stops[i + 1]]);
  return runs;
}

/**
 * What a walker meets inside one car, in the car's own frame: the seats,
 * the partitions and the end walls, as boxes [x0, z0, x1, z1, top].
 * `cab` +1 / -1: which end is a cab (0 for none).  line/boarding.js places
 * them while the train stands at the platform.
 */
export function carColliders(cab = 0) {
  const out = [];
  for (const sz of [1, -1]) {
    const zIn = sz * (CAR_W / 2 - 0.08), zSeat = sz * (CAR_W / 2 - 0.08 - SEAT_D);
    for (const [a, b] of benchRuns(cab)) out.push([a, Math.min(zIn, zSeat), b, Math.max(zIn, zSeat), SEAT_TOP + 0.3]);
    // the far wall (the near wall is the platform edge's colliders, with gaps at the doors)
    if (sz > 0) out.push([-CAR_L / 2, CAR_W / 2 - 0.12, CAR_L / 2, CAR_W / 2 + 0.2, TOP]);
  }
  // the ends: the cab's back wall (its door shut), or the end wall with its gangway opening
  for (const s of [-1, 1]) {
    if (s === cab) {
      out.push([s * CAB_WALL - 0.08, -CAR_W / 2, s * CAB_WALL + 0.08, CAR_W / 2, TOP]);
    } else {
      const x = s * (CAR_L / 2 - 0.06);
      out.push([x - 0.08, -CAR_W / 2, x + 0.08, -0.45, TOP]);
      out.push([x - 0.08, 0.45, x + 0.08, CAR_W / 2, TOP]);
    }
  }
  return out;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
/** A geometry painted one colour (for the vertex-coloured door leaves). */
function painted(geo, hex) {
  const n = geo.attributes.position.count, col = new Float32Array(n * 3), c = new THREE.Color(hex);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
/** A plane showing cell `k` of `n` across a strip atlas (u only). */
function cellPlane(w, h, k, n) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / n);
  return g;
}

function buildCar({ cab, tail, index, dests, straps, xOff }) {
  const m = mats();
  const car = new THREE.Group();
  const P = {};
  const push = (k, geo, mx) => (P[k] ??= []).push({ geometry: geo, matrix: mx });
  /** A box from its extents. */
  const B = (k, x0, x1, y0, y1, z0, z1, rx = 0, ry = 0, rz = 0) =>
    push(k, box(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), trs((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, rx, ry, rz));
  const cabEnd = cab ? 1 : tail ? -1 : 0;
  const face = (sz) => (sz > 0 ? 0 : Math.PI);            // a plane on the side wall facing out

  /* ================================ the shell ================================ */
  // floor, and the underframe's edge under the skin
  B('floor', -CAR_L / 2 + 0.06, CAR_L / 2 - 0.06, FLOOR - 0.1, FLOOR, -CAR_W / 2 + 0.06, CAR_W / 2 - 0.06);
  B('steel', -CAR_L / 2, CAR_L / 2, FLOOR - 0.2, FLOOR, -CAR_W / 2, CAR_W / 2);
  B('under', -BOGIE_X + 1.6, BOGIE_X - 1.6, FLOOR - 0.3, FLOOR - 0.2, -CAR_W / 2 + 0.25, CAR_W / 2 - 0.25);
  // the roof: three shallow steps make its curve; gutters; the cornice
  B('steel', -CAR_L / 2, CAR_L / 2, TOP - 0.12, TOP, -CAR_W / 2, CAR_W / 2);
  B('roof', -CAR_L / 2 + 0.02, CAR_L / 2 - 0.02, TOP, TOP + 0.1, -CAR_W / 2 + 0.06, CAR_W / 2 - 0.06);
  B('roof', -CAR_L / 2 + 0.05, CAR_L / 2 - 0.05, TOP + 0.1, TOP + 0.17, -CAR_W / 2 + 0.3, CAR_W / 2 - 0.3);
  B('roof', -CAR_L / 2 + 0.08, CAR_L / 2 - 0.08, TOP + 0.17, ROOF, -CAR_W / 2 + 0.7, CAR_W / 2 - 0.7);
  for (const s of [-1, 1]) B('rubber', -CAR_L / 2, CAR_L / 2, TOP - 0.02, TOP + 0.04, s * (CAR_W / 2 - 0.02) - 0.03, s * (CAR_W / 2 - 0.02) + 0.03);
  // the ceiling, its central duct, the two light strips
  B('lining', -CAR_L / 2 + 0.1, CAR_L / 2 - 0.1, TOP - 0.16, TOP - 0.12, -CAR_W / 2 + 0.1, CAR_W / 2 - 0.1);
  B('lining', -CAR_L / 2 + 0.4, CAR_L / 2 - 0.4, TOP - 0.28, TOP - 0.16, -0.36, 0.36);
  const lights = [];
  for (const z of [-0.52, 0.52]) lights.push({ geometry: box(CAR_L - 1.4, 0.03, 0.16), matrix: trs(0, TOP - 0.19, z) });

  /* ---- the side walls between the openings: skin, lining, livery ---- */
  const cells = wallCells();
  for (const sz of [1, -1]) {
    const zSkin = sz * (CAR_W / 2 - 0.03), zLine = sz * (CAR_W / 2 - 0.1), zOut = sz * (CAR_W / 2 + 0.004);
    for (const c of cells) {
      const len = c.b - c.a, cx = (c.a + c.b) / 2;
      const spans = c.kind === 'door' ? [[DOOR_TOP, TOP - 0.12]]
        : c.kind === 'window' ? [[FLOOR, WIN_Y0], [WIN_Y1, TOP - 0.12]]
          : [[FLOOR, TOP - 0.12]];
      for (const [y0, y1] of spans) {
        push('steel', box(len, y1 - y0, 0.06), trs(cx, (y0 + y1) / 2, zSkin));
        push('lining', box(len, y1 - y0, 0.04), trs(cx, (y0 + y1) / 2, zLine));
      }
      // the band, the pinstripe, the line over the windows, the beads
      if (c.kind !== 'door') {
        for (const [k, [y0, y1]] of [['band', BAND], ['pink', PIN]]) push(k, box(len, y1 - y0, 0.012), trs(cx, (y0 + y1) / 2, zOut));
        for (const y of [1.3, 1.52]) push('steelHi', box(len, 0.018, 0.01), trs(cx, y, zOut));
      }
      push('band', box(len, TOPLINE[1] - TOPLINE[0], 0.012), trs(cx, (TOPLINE[0] + TOPLINE[1]) / 2, zOut));
      if (c.kind === 'window') {
        // black rubber round the glass, and the centre mullion of a wide bay
        for (const y of [WIN_Y0, WIN_Y1]) push('rubber', box(len, 0.05, 0.1), trs(cx, y, zSkin));
        for (const x of [c.a, c.b]) push('rubber', box(0.05, WIN_Y1 - WIN_Y0, 0.1), trs(x, (WIN_Y0 + WIN_Y1) / 2, zSkin));
        if (len > 2) push('rubber', box(0.06, WIN_Y1 - WIN_Y0, 0.08), trs(cx, (WIN_Y0 + WIN_Y1) / 2, zSkin));
        push('glass', new THREE.PlaneGeometry(len, WIN_Y1 - WIN_Y0), trs(cx, (WIN_Y0 + WIN_Y1) / 2, zSkin, 0, face(sz), 0));
        push('glint', new THREE.PlaneGeometry(len * 0.16, (WIN_Y1 - WIN_Y0) * 0.9), trs(cx - len * 0.22, (WIN_Y0 + WIN_Y1) / 2, zSkin + sz * 0.035, 0, face(sz), 0.22));
      }
    }
    // the door openings: rubber at the jambs and the head, a sill; seams beside them
    for (const d of DOORS) {
      for (const e of [-1, 1]) {
        push('rubber', box(0.035, DOOR_TOP - FLOOR, 0.1), trs(d + e * DOOR_W / 2, (FLOOR + DOOR_TOP) / 2, zSkin));
        push('rubber', box(0.012, TOP - 0.2 - FLOOR + 0.18, 0.01), trs(d + e * (DOOR_W / 2 + 0.3), (FLOOR - 0.18 + TOP - 0.2) / 2, zOut));
      }
      push('rubber', box(DOOR_W + 0.07, 0.04, 0.1), trs(d, DOOR_TOP, zSkin));
      push('steelHi', box(DOOR_W, 0.04, 0.2), trs(d, FLOOR + 0.02, sz * (CAR_W / 2 - 0.08)));
      // inside: the yellow line at the door's edge
      push('yellow', box(DOOR_W - 0.1, 0.006, 0.08), trs(d, FLOOR + 0.004, sz * (CAR_W / 2 - 0.26)));
    }
    // panel seams at the car's corners, and the car's number by each end
    for (const e of [-1, 1]) push('rubber', box(0.014, TOP - FLOOR + 0.15, 0.01), trs(e * (CAR_L / 2 - 0.2), (FLOOR - 0.15 + TOP) / 2, zOut));
    push('carNo', new THREE.PlaneGeometry(0.62, 0.12), trs(-cabEnd * (CAR_L / 2 - 2.2) || CAR_L / 2 - 2.2, 1.46, zOut + sz * 0.004, 0, face(sz), 0));
    // the side destination LED, over the window by door 2
    dests.push({ geometry: new THREE.PlaneGeometry(0.66, 0.165), matrix: trs(xOff - 4.7, 3.44, zOut + sz * 0.006, 0, face(sz), 0) });
    push('rubber', box(0.74, 0.22, 0.02), trs(-4.7, 3.44, zOut));
  }
  // the crew doors on a cab's sides (outlines, a handhold)
  if (cabEnd) {
    for (const sz of [1, -1]) {
      const zOut = sz * (CAR_W / 2 + 0.006);
      for (const x of [7.62, 9.42]) push('rubber', box(0.025, 2.3, 0.01), trs(cabEnd * x, FLOOR + 1.12, zOut));
      push('rubber', box(1.8, 0.025, 0.01), trs(cabEnd * 8.52, FLOOR + 2.27, zOut));
      push('steelHi', box(0.03, 0.5, 0.04), trs(cabEnd * 9.55, FLOOR + 0.95, zOut + sz * 0.02));
    }
  }

  /* ---- the door leaves: two per door, sliding into the pocket ----
   * Only the platform side (local -z) ever opens, and on it every left leaf
   * slides the same way, as does every right one: so a car has two sliding
   * groups, each one vertex-coloured mesh and its glass.  The far side's
   * leaves are plain parts of the body. */
  const leaves = { 1: [], [-1]: [] };
  const lw = DOOR_W / 2;
  const leafParts = (x, half, z, sz) => {
    const out = [];
    const add = (hex, x0, x1, y0, y1, dz = 0, t = 0.018) => out.push({
      geometry: painted(box(x1 - x0, y1 - y0, t), hex), matrix: trs((x0 + x1) / 2, (y0 + y1) / 2, z + sz * dz),
    });
    const a = x - lw / 2, b = x + lw / 2;
    const wi0 = a + (half > 0 ? 0.1 : 0.14), wi1 = b - (half > 0 ? 0.14 : 0.1);
    add(C.steel, a, b, FLOOR, DWIN[0]);
    add(C.steel, a, b, DWIN[1], DOOR_TOP);
    add(C.steel, a, wi0, DWIN[0], DWIN[1]);
    add(C.steel, wi1, b, DWIN[0], DWIN[1]);
    for (const [k, [y0, y1]] of [[C.band, BAND], [C.pink, PIN]]) add(k, a, b, y0, y1, 0.012, 0.008);
    for (const y of [1.3, 1.52]) add(C.steelHi, a, b, y - 0.009, y + 0.009, 0.012, 0.006);
    // the rubber: the meeting edge, and round the window
    const meet = half > 0 ? a : b;
    add(C.rubber, meet - 0.018, meet + 0.018, FLOOR, DOOR_TOP, 0.004, 0.03);
    add(C.rubber, wi0 - 0.02, wi1 + 0.02, DWIN[0] - 0.02, DWIN[0] + 0.01, 0.01, 0.01);
    add(C.rubber, wi0 - 0.02, wi1 + 0.02, DWIN[1] - 0.01, DWIN[1] + 0.02, 0.01, 0.01);
    add(C.rubber, wi0 - 0.02, wi0 + 0.01, DWIN[0], DWIN[1], 0.01, 0.01);
    add(C.rubber, wi1 - 0.01, wi1 + 0.02, DWIN[0], DWIN[1], 0.01, 0.01);
    const pane = { geometry: new THREE.PlaneGeometry(wi1 - wi0, DWIN[1] - DWIN[0]), matrix: trs((wi0 + wi1) / 2, (DWIN[0] + DWIN[1]) / 2, z, 0, face(sz), 0) };
    return { out, pane };
  };
  for (const sz of [1, -1]) {
    const z = sz * (CAR_W / 2 - 0.07);
    for (const half of [-1, 1]) {
      const body = [], glass = [];
      for (const d of DOORS) {
        const { out, pane } = leafParts(d + half * (lw / 2), half, z, sz);
        body.push(...out); glass.push(pane);
      }
      if (sz < 0) {
        const grp = new THREE.Group();
        const mb = new THREE.Mesh(bake(body), m.door);
        mb.castShadow = true;
        const mg = new THREE.Mesh(bake(glass), m.glass);
        mg.userData.noOutline = true;
        grp.add(mb, mg);
        grp.userData.half = half;
        grp.userData.dynamic = true;       // it slides: never batched
        car.add(grp);
        leaves[sz].push(grp);
      } else {
        (P.doorStatic ??= []).push(...body);
        (P.glass ??= []).push(...glass);
      }
    }
  }

  /* ================================ the interior ================================ */
  const runs = benchRuns(cabEnd);
  for (const sz of [1, -1]) {
    const zw = sz * (CAR_W / 2 - 0.08);
    runs.forEach(([a, b], i) => {
      const len = b - a, cx = (a + b) / 2;
      const pri = cabEnd ? (i === (cabEnd > 0 ? runs.length - 1 : 0)) : (i === 0 || i === runs.length - 1);
      const seat = pri ? 'seatPri' : 'seat';
      // the base, the cushion, the back
      push('seatBase', box(len, 0.3, SEAT_D - 0.08), trs(cx, FLOOR + 0.15, zw - sz * (SEAT_D / 2 + 0.02)));
      push(seat, box(len, 0.12, SEAT_D), trs(cx, SEAT_TOP - 0.06, zw - sz * SEAT_D / 2));
      push(seat, box(len, 0.5, 0.1), trs(cx, SEAT_TOP + 0.3, zw - sz * 0.07, sz * 0.1, 0, 0));
      // seat dividers: a seam every 0.46 m
      for (let x = a + 0.46; x < b - 0.2; x += 0.46) push('seatBase', box(0.02, 0.02, SEAT_D - 0.04), trs(x, SEAT_TOP + 0.005, zw - sz * SEAT_D / 2));
      // the luggage rack and its brackets
      push('pole', box(len - 0.1, 0.025, 0.3), trs(cx, FLOOR + 1.74, zw - sz * 0.18));
      for (const x of [a + 0.1, b - 0.1]) push('pole', box(0.03, 0.2, 0.3), trs(x, FLOOR + 1.84, zw - sz * 0.18));
      // the tall partitions at the door ends (袖仕切り), each with its pole
      for (const [x, e] of [[a, -1], [b, 1]]) {
        const nearDoor = DOORS.some((d) => Math.abs(x - (d - e * (DOOR_W / 2 + 0.12))) < 0.02);
        if (!nearDoor) continue;
        push('lining', box(0.04, 1.62, SEAT_D + 0.04), trs(x + e * 0.02, FLOOR + 0.86, zw - sz * (SEAT_D / 2 + 0.02)));
        push('pole', new THREE.CylinderGeometry(0.018, 0.018, TOP - 0.2 - FLOOR, 6), trs(x + e * 0.02, (FLOOR + TOP - 0.2) / 2, zw - sz * (SEAT_D + 0.06)));
      }
      // a pole through the middle of a seven-seat run (3 + 4)
      if (len > 2.6) push('pole', new THREE.CylinderGeometry(0.018, 0.018, TOP - 0.2 - SEAT_TOP, 6), trs(a + 0.46 * 3 + 0.02, (SEAT_TOP + TOP - 0.2) / 2, zw - sz * (SEAT_D - 0.04)));
      // the strap rail over the seat front, and its straps
      for (let x = a + 0.2; x < b - 0.1; x += 0.3) straps.push({ x: xOff + x, z: sz * (CAR_W / 2 - 0.62), ph: (x * 1.7 + sz) % 6.28 });
      // priority seats: the stickers on the window over them
      if (pri) {
        const win = BAYS.find(([c]) => Math.abs(c - cx) < 1.2);
        if (win) push('priority', new THREE.PlaneGeometry(0.24, 0.12), trs(win[0], WIN_Y0 + 0.14, sz * (CAR_W / 2 - 0.035), 0, face(-sz), 0));
      }
    });
    push('pole', box(CAR_L - (cabEnd ? 2.6 : 1.4), 0.03, 0.03), trs(-cabEnd * 0.6, RAIL_Y, sz * (CAR_W / 2 - 0.62)));
    // door poles, and the LCD pair over each door
    for (const d of DOORS) {
      push('rubber', box(DOOR_W + 0.3, 0.3, 0.06), trs(d, DOOR_TOP + 0.2, sz * (CAR_W / 2 - 0.15)));
      push('lcd', new THREE.PlaneGeometry(1.06, 0.3), trs(d, DOOR_TOP + 0.2, sz * (CAR_W / 2 - 0.185), 0, face(-sz), 0));
    }
    // the cards over the windows
    BAYS.forEach(([c, w], i) => {
      if (w < 2) return;
      for (const k of [-1, 1]) push('ads', cellPlane(0.62, 0.2, (i * 2 + (k > 0 ? 1 : 0) + index * 3 + (sz > 0 ? 4 : 0)) % CAR_AD_CELLS, CAR_AD_CELLS),
        trs(c + k * w * 0.24, WIN_Y1 + 0.2, sz * (CAR_W / 2 - 0.125), 0, face(-sz), 0));
    });
  }
  // the hanging ads (中吊り) down the aisle, each two-sided, on a rail
  push('pole', box(CAR_L - 3, 0.02, 0.02), trs(-cabEnd * 0.8, TOP - 0.3, 0));
  runs.forEach(([a, b], i) => {
    if (b - a < 2.5) return;
    const cx = (a + b) / 2;
    for (const [k, ry] of [[(i + index * 2) % CAR_AD_CELLS, Math.PI / 2], [(i + 5 + index) % CAR_AD_CELLS, -Math.PI / 2]]) {
      push('ads', cellPlane(0.54, 0.36, k, CAR_AD_CELLS), trs(cx + (ry > 0 ? 0.004 : -0.004), TOP - 0.52, 0, 0, ry, 0));
    }
    push('pole', box(0.02, 0.02, 0.56), trs(cx, TOP - 0.33, 0));
  });
  // door-side grab poles
  for (const sz of [1, -1]) for (const d of DOORS) for (const e of [-1, 1]) {
    push('pole', new THREE.CylinderGeometry(0.02, 0.02, TOP - 0.2 - FLOOR, 6), trs(d + e * (DOOR_W / 2 + 0.07), (FLOOR + TOP - 0.2) / 2, sz * (CAR_W / 2 - 0.2)));
  }

  /* ---- the ends: a cab, or the end wall with its gangway ---- */
  for (const s of [-1, 1]) {
    if (s === cabEnd) continue;
    const x = s * (CAR_L / 2 - 0.04), xi = s * (CAR_L / 2 - 0.1);
    const GW = 0.45, GH = FLOOR + 1.95;
    for (const e of [-1, 1]) {
      B('steel', x - 0.04, x + 0.04, FLOOR - 0.2, TOP, e * GW, e * CAR_W / 2);
      B('lining', xi - 0.02, xi + 0.02, FLOOR, TOP - 0.12, e * GW, e * (CAR_W / 2 - 0.1));
    }
    B('steel', x - 0.04, x + 0.04, GH, TOP, -GW, GW);
    B('lining', xi - 0.02, xi + 0.02, GH, TOP - 0.12, -GW, GW);
    B('rubber', xi - 0.03, xi + 0.03, FLOOR, GH, -GW - 0.03, -GW);
    B('rubber', xi - 0.03, xi + 0.03, FLOOR, GH, GW, GW + 0.03);
    // the bellows to the next car (from this car's -x end only, so once)
    if (s < 0) {
      const g0 = -CAR_L / 2 - (PITCH - CAR_L) - 0.02, g1 = -CAR_L / 2 + 0.02;
      for (const e of [-1, 1]) B('bellows', g0, g1, FLOOR - 0.08, GH + 0.1, e * (GW + 0.02), e * (GW + 0.14));
      B('bellows', g0, g1, GH, GH + 0.12, -GW - 0.14, GW + 0.14);
      B('steelHi', g0, g1, FLOOR - 0.04, FLOOR, -GW, GW);
      for (let k = 1; k < 5; k++) {
        const gx = g0 + ((g1 - g0) * k) / 5;
        for (const e of [-1, 1]) B('rubber', gx - 0.01, gx + 0.01, FLOOR - 0.06, GH + 0.1, e * (GW + 0.14), e * (GW + 0.15));
      }
      // the coupler under it
      B('under', g0 - 0.1, g1 + 0.1, 0.78, 0.98, -0.15, 0.15);
    }
  }

  /* ---- the cab ---- */
  let lamps = null;
  if (cabEnd) {
    const s = cabEnd, fx = s * (CAR_L / 2);
    const ry = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    // the silver end below the mask, the band and pinstripe wrapping round
    B('steel', fx - s * 0.08, fx, FLOOR - 0.2, 2.0, -CAR_W / 2, CAR_W / 2);
    B('band', fx - s * 0.02, fx + s * 0.012, 1.72, 2.0, -CAR_W / 2 - 0.004, CAR_W / 2 + 0.004);
    B('pink', fx - s * 0.02, fx + s * 0.012, 1.66, 1.72, -CAR_W / 2 - 0.004, CAR_W / 2 + 0.004);
    for (const y of [1.3, 1.5]) B('steelHi', fx, fx + s * 0.01, y - 0.009, y + 0.009, -CAR_W / 2 + 0.1, CAR_W / 2 - 0.1);
    // the black mask with the silver pillars at its corners
    B('rubber', fx - s * 0.08, fx + s * 0.02, 2.0, TOP, -CAR_W / 2 + 0.1, CAR_W / 2 - 0.1);
    for (const e of [-1, 1]) B('steel', fx - s * 0.08, fx + s * 0.03, 2.0, TOP, e * (CAR_W / 2 - 0.1), e * CAR_W / 2);
    // the windscreen, two big panes, a glint on each
    for (const [z0, z1] of [[-1.24, -0.05], [0.05, 1.24]]) {
      push('cabGlass', new THREE.PlaneGeometry(z1 - z0, 0.98), trs(fx + s * 0.025, 2.82, (z0 + z1) / 2, 0, ry, 0));
      push('glint', new THREE.PlaneGeometry(0.22, 0.9), trs(fx + s * 0.03, 2.82, z0 + (z1 - z0) * 0.3, 0, ry, 0.26));
      // a wiper, parked
      push('rubber', box(0.02, 0.62, 0.03), trs(fx + s * 0.035, 2.52, z0 + 0.2, s * 1.25, 0, 0));
    }
    // the destination LED and the run number, lit, in the mask
    dests.push({ geometry: new THREE.PlaneGeometry(1.36, 0.34), matrix: trs(xOff + fx + s * 0.028, 3.5, 0, 0, ry, 0) });
    push('runNo', new THREE.PlaneGeometry(0.36, 0.135), trs(fx + s * 0.028, 3.5, s > 0 ? -0.98 : 0.98, 0, ry, 0));
    // head and tail lights in their housings, low on the corners
    lamps = [];
    for (const e of [-1, 1]) {
      B('rubber', fx - s * 0.02, fx + s * 0.06, 1.26, 1.6, e * 0.72, e * 1.3);
      for (const [dz, r, kind] of [[1.14, 0.1, 'head'], [0.86, 0.075, 'tail']]) {
        const g = new THREE.CircleGeometry(r, 16);
        lamps.push({ kind, geometry: g, matrix: trs(fx + s * 0.065, 1.43, e * dz, 0, ry, 0) });
        push('steelHi', new THREE.RingGeometry(r, r + 0.025, 16), trs(fx + s * 0.064, 1.43, e * dz, 0, ry, 0));
      }
    }
    // handrails at the corners, and below them the step
    for (const e of [-1, 1]) {
      push('steelHi', new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6), trs(fx + s * 0.08, 1.6, e * 1.36));
      B('under', fx, fx + s * 0.22, 0.62, 0.66, e * 1.0, e * 1.35);
    }
    // the snowplough (排障器), raked, and the coupler
    push('under', box(0.06, 0.56, 2.3), trs(fx + s * 0.34, 0.66, 0, 0, 0, s * -0.35));
    for (const e of [-1, 1]) push('under', box(0.5, 0.5, 0.05), trs(fx + s * 0.18, 0.62, e * 1.13, 0, s * e * 0.3, 0));
    B('under', fx, fx + s * 0.6, 0.86, 1.02, -0.13, 0.13);
    B('rubber', fx + s * 0.6, fx + s * 0.72, 0.8, 1.08, -0.2, 0.2);
    // inside: the back wall with its door and window, the desk, the seat
    const xw = s * CAB_WALL;
    B('lining', xw - 0.03, xw + 0.03, FLOOR, TOP - 0.12, -CAR_W / 2 + 0.1, -0.35);
    B('lining', xw - 0.03, xw + 0.03, FLOOR, 2.0, 0.35, CAR_W / 2 - 0.1);
    B('lining', xw - 0.03, xw + 0.03, 2.8, TOP - 0.12, 0.35, CAR_W / 2 - 0.1);
    push('glass', new THREE.PlaneGeometry(CAR_W / 2 - 0.45, 0.8), trs(xw, 2.4, (0.35 + CAR_W / 2 - 0.1) / 2, 0, -ry, 0));
    B('rubber', xw - 0.02, xw + 0.02, 1.99, 2.03, 0.35, CAR_W / 2 - 0.1);
    B('rubber', xw - 0.02, xw + 0.02, 2.77, 2.81, 0.35, CAR_W / 2 - 0.1);
    B('panel', xw - 0.025, xw + 0.025, FLOOR, FLOOR + 1.9, -0.35, 0.35);
    B('rubber', xw - s * 0.03, xw - s * 0.02, 2.2, 2.7, -0.2, 0.2);
    B('console', fx - s * 0.75, fx - s * 0.12, FLOOR, FLOOR + 0.95, -1.3, 1.3);
    B('console', fx - s * 0.5, fx - s * 0.12, FLOOR + 0.95, FLOOR + 1.12, -1.3, 0.1, 0, 0, s * 0.3);
    B('console', fx - s * 1.35, fx - s * 1.0, FLOOR, FLOOR + 1.1, -0.85, -0.3);
    lights.push({ geometry: box(0.8, 0.03, 0.14), matrix: trs(fx - s * 1.0, TOP - 0.19, 0) });
    // the cab end's own roof gear: two little antennae
    for (const dz of [-0.35, 0.35]) B('rubber', fx - s * 1.5, fx - s * 1.2, ROOF, ROOF + 0.12, dz - 0.05, dz + 0.05);
  }

  /* ================================ the roof ================================ */
  // the air-conditioner, one big unit mid-car, its grille and two fans
  B('gear', -1.8, 1.8, ROOF, ROOF + 0.32, -0.95, 0.95);
  for (let x = -1.6; x <= 1.6; x += 0.2) B('under', x - 0.02, x + 0.02, ROOF + 0.32, ROOF + 0.325, -0.9, -0.2);
  for (const x of [-0.8, 0.8]) push('under', new THREE.CylinderGeometry(0.34, 0.34, 0.02, 16), trs(x, ROOF + 0.33, 0.45));
  for (const x of [-7.0, 7.0]) B('gear', x - 0.4, x + 0.4, ROOF, ROOF + 0.12, -0.5, 0.5);
  // the pantograph: a single arm, on the motor car
  if (tail) {
    const px = 5.2, py = ROOF + 0.05;
    B('under', px - 0.7, px + 0.7, py, py + 0.08, -0.55, 0.55);
    for (const dx of [-0.55, 0.55]) for (const dz of [-0.45, 0.45]) push('insul', new THREE.CylinderGeometry(0.05, 0.06, 0.14, 8), trs(px + dx, py + 0.15, dz));
    B('metal', px - 0.8, px + 0.8, py + 0.22, py + 0.28, -0.5, 0.5);
    const top = CONTACT_Y - 0.02;
    const hinge = [px - 0.65, py + 0.32], knee = [px + 0.62, py + 0.62], head = [px - 0.05, top - 0.08];
    const arm = (a, b, r) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      push('metal', new THREE.CylinderGeometry(r, r, len, 6), trs((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0, 0, 0, Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2));
    };
    const arm2 = (a, b, r, dz) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      push('metal', new THREE.CylinderGeometry(r, r, len, 6), trs((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, dz, 0, 0, Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2));
    };
    for (const dz of [-0.2, 0.2]) arm2(hinge, knee, 0.04, dz);
    arm(knee, head, 0.028);
    arm([hinge[0] + 0.2, hinge[1]], [knee[0] - 0.2, knee[1] - 0.05], 0.012);          // the damper
    B('metal', head[0] - 0.05, head[0] + 0.05, head[1] - 0.02, head[1] + 0.03, -0.55, 0.55);
    for (const dx of [-0.13, 0.13]) {
      B('metal', head[0] + dx - 0.035, head[0] + dx + 0.035, top - 0.04, top, -0.62, 0.62);
      for (const e of [-1, 1]) push('metal', box(0.05, 0.03, 0.3), trs(head[0] + dx, top - 0.09, e * 0.74, e * -0.5, 0, 0));
    }
    // the roof wiring to it
    B('insul', px - 3.5, px - 0.7, ROOF + 0.06, ROOF + 0.1, 0.62, 0.66);
  }

  /* ================================ underneath ================================ */
  // the boxes between the bogies: a different set on each car
  const kit = index % 2
    ? [[-4.8, -2.2, 0.55, 'L'], [-1.9, 0.6, 0.62, 'R'], [1.0, 2.6, 0.5, 'L'], [3.0, 4.6, 0.45, 'R']]      // the motor car: inverter, reactor
    : [[-4.6, -3.0, 0.45, 'L'], [-2.6, -0.4, 0.55, 'R'], [0.2, 2.2, 0.48, 'L'], [2.8, 4.6, 0.4, 'R']];     // the trailer: SIV, compressor, battery
  for (const [x0, x1, depth, side] of kit) {
    const z0 = side === 'L' ? -1.2 : 0.05, z1 = side === 'L' ? -0.05 : 1.2;
    B('under', x0, x1, FLOOR - 0.3 - depth * 0.7, FLOOR - 0.3, z0, z1);
    // a lid line and bolts: a lighter strip along the face
    B('spring', x0 + 0.05, x1 - 0.05, FLOOR - 0.3 - depth * 0.35 - 0.01, FLOOR - 0.3 - depth * 0.35 + 0.01, side === 'L' ? z0 - 0.005 : z1 - 0.005, side === 'L' ? z0 + 0.005 : z1 + 0.005);
  }
  // the air tanks, lying along the car
  for (const [x, z] of [[-1.2, -0.7], [1.6, 0.75]]) push('spring', new THREE.CylinderGeometry(0.16, 0.16, 2.2, 10), trs(x, 0.6, z, 0, 0, Math.PI / 2));
  // the bogies: frames, axle boxes, springs, air springs, the wheels and axles
  const WR = 0.36, WY = RAIL_TOP + WR;
  const wheelGeo = new THREE.CylinderGeometry(WR, WR, 0.13, 16);
  for (const bx of [-BOGIE_X, BOGIE_X]) {
    for (const e of [-1, 1]) {
      B('bogie', bx - 1.45, bx + 1.45, 0.56, 0.76, e * 0.92, e * 1.08);
      push('spring', new THREE.CylinderGeometry(0.24, 0.24, 0.16, 12), trs(bx, 0.8, e * 0.98));
      for (const wx of [-1.05, 1.05]) {
        B('bogie', bx + wx - 0.17, bx + wx + 0.17, WY - 0.14, WY + 0.12, e * 0.9, e * 1.12);
        push('spring', new THREE.CylinderGeometry(0.08, 0.08, 0.1, 8), trs(bx + wx, WY + 0.17, e * 1.0));
        push('wheel', wheelGeo, trs(bx + wx, WY, e * 0.6, Math.PI / 2, 0, 0));
        push('bogie', new THREE.CylinderGeometry(0.1, 0.1, 0.1, 10), trs(bx + wx, WY, e * 0.7, Math.PI / 2, 0, 0));
        // a brake unit behind each wheel
        B('bogie', bx + wx * 0.55 - 0.1, bx + wx * 0.55 + 0.1, 0.5, 0.72, e * 0.62, e * 0.8);
      }
    }
    B('bogie', bx - 0.2, bx + 0.2, 0.56, 0.74, -0.92, 0.92);
    for (const wx of [-1.05, 1.05]) push('bogie', new THREE.CylinderGeometry(0.07, 0.07, 1.4, 8), trs(bx + wx, WY, 0, Math.PI / 2, 0, 0));
    if (index % 2) for (const wx of [-0.55, 0.55]) push('under', new THREE.CylinderGeometry(0.2, 0.2, 0.9, 12), trs(bx + wx * 0.8, 0.62, 0, Math.PI / 2, 0, 0));   // traction motors
  }

  /* ---- bake ---- */
  const matFor = {
    steel: m.steel, steelHi: m.steelHi, band: m.band, pink: m.pink, rubber: m.rubber, roof: m.roof, gear: m.gear,
    under: m.under, bellows: m.bellows, bogie: m.bogie, spring: m.spring, wheel: m.wheel, insul: m.insul, yellow: m.yellow, console: m.console,
    metal: m.gear, panel: m.lining, floor: m.floor, lining: m.lining, seat: m.seat, seatPri: m.seatPri, seatBase: m.seatBase, pole: m.pole,
    glass: m.glass, glint: m.glint, cabGlass: m.cabGlass, lcd: m.lcd, ads: m.ads, runNo: m.runNo, carNo: m.carNo[index % 2],
    priority: m.priority, doorStatic: m.door,
  };
  const inside = new Set(['lining', 'panel', 'floor', 'seat', 'seatPri', 'seatBase', 'pole', 'lcd', 'ads', 'priority', 'yellow', 'console']);
  const see = new Set(['glass', 'glint', 'cabGlass', 'lcd', 'ads', 'runNo', 'carNo', 'priority']);
  for (const [k, list] of Object.entries(P)) {
    const mesh = new THREE.Mesh(bake(list), matFor[k]);
    mesh.castShadow = !inside.has(k) && !see.has(k);
    mesh.receiveShadow = !see.has(k);
    if (inside.has(k) || see.has(k)) mesh.userData.noOutline = true;
    car.add(mesh);
    if (k === 'roof' || k === 'steel') hullOutline(mesh, { thickness: 0.003 });
  }
  const lit = new THREE.Mesh(bake(lights), m.light);
  lit.userData.noOutline = true;
  car.add(lit);
  if (lamps) {
    // the leading end shows its headlights, the trailing end its tail lights
    const on = lamps.filter((l) => (cab ? l.kind === 'head' : l.kind === 'tail'));
    const off = lamps.filter((l) => !on.includes(l));
    const a = new THREE.Mesh(bake(on), cab ? m.head : m.tail);
    const b = new THREE.Mesh(bake(off), cab ? m.tailOff : m.lampOff);
    for (const x of [a, b]) { x.userData.noOutline = true; car.add(x); }
  }
  return { car, leaves };
}

/**
 * The two-car set.  Returns the group and its moving parts; line/service.js
 * places it and decides what it does.
 */
export function buildEmu(ctx, { cars = 2, seed = 2104 } = {}) {
  const m = mats();
  const group = new THREE.Group();
  group.name = 'train';
  group.userData.seed = seed;
  ctx.add(group);
  const leaves = { 1: [], [-1]: [] };
  const dests = [], straps = [];
  const carX = [];
  for (let i = 0; i < cars; i++) {
    const xOff = ((cars - 1) / 2 - i) * PITCH;       // the cab car leads, at +x
    const c = buildCar({ cab: i === 0, tail: i === cars - 1, index: i, dests, straps, xOff });
    c.car.position.x = xOff;
    group.add(c.car);
    carX.push({ x: xOff, cab: i === 0 ? 1 : i === cars - 1 ? -1 : 0 });
    leaves[1].push(...c.leaves[1]);
    leaves[-1].push(...c.leaves[-1]);
  }
  // batch the car bodies inside the set; the doors, the LEDs and the straps move or change
  mergeStatic(group);
  group.userData.dynamic = true;

  // every destination LED on the set: one mesh, its texture swapped by direction
  const destMat = flat({ color: 0xffffff, map: destTex('east'), cache: false });
  const dest = new THREE.Mesh(bake(dests), destMat);
  dest.userData.noOutline = true;
  dest.userData.keep = true;
  group.add(dest);

  // the straps: one InstancedMesh, swaying about their rail
  const strapGeo = (() => {
    const parts = [
      { geometry: box(0.05, 0.04, 0.03), matrix: trs(0, -0.02, 0) },
      { geometry: box(0.024, 0.2, 0.008), matrix: trs(0, -0.14, 0) },
      { geometry: new THREE.TorusGeometry(0.068, 0.012, 5, 14), matrix: trs(0, -0.31, 0) },
    ];
    return bake(parts);
  })();
  const strapMesh = new THREE.InstancedMesh(strapGeo, m.strap, straps.length);
  strapMesh.userData.noOutline = true;
  strapMesh.castShadow = false;
  strapMesh.frustumCulled = false;
  group.add(strapMesh);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
  const placeStraps = (t, lean, amp) => {
    straps.forEach((s, i) => {
      _e.set(0.04 * Math.sin(t * 1.3 + s.ph * 2), 0, lean + amp * Math.sin(t * 2.1 + s.ph));
      _q.setFromEuler(_e);
      _p.set(s.x, RAIL_Y, s.z);
      _m.compose(_p, _q, _s);
      strapMesh.setMatrixAt(i, _m);
    });
    strapMesh.instanceMatrix.needsUpdate = true;
  };
  placeStraps(0, 0, 0);

  let doorT = 0, swayT = 0, lastV = 0, accel = 0, lean = 0;
  return {
    group,
    length: PITCH * cars,
    carX,
    /** 0 shut .. 1 open, on the platform side (local -z) */
    setDoors(t) {
      doorT = t;
      const e = t * t * (3 - 2 * t);
      for (const l of leaves[-1]) l.position.x = l.userData.half * (DOOR_W / 2) * e * 0.96;
    },
    get doors() { return doorT; },
    /** 0 by day .. 1 at night: the interior lights up. */
    setNight(k) {
      for (const mm of mats().interior) mm.emissiveIntensity = 0.62 * k;
    },
    setDest(dir) {
      destMat.map = destTex(dir);
      destMat.needsUpdate = true;
    },
    /** The wheels are baked in (a turning disc looks the same): kept for the service. */
    spin() {},
    /**
     * The straps: they lean back as the train pulls away, swing forward as it
     * brakes, and sway a little while it runs or stands.  Only when near.
     */
    animate(dt, v, near) {
      if (dt <= 0) return;
      accel += ((v - lastV) / dt - accel) * Math.min(1, dt * 3);
      lastV = v;
      if (!near) return;
      swayT += dt;
      lean += (THREE.MathUtils.clamp(-accel * 0.14, -0.22, 0.22) - lean) * Math.min(1, dt * 2.5);
      const amp = 0.015 + Math.min(1, v / 22) * 0.05;
      placeStraps(swayT, lean, amp);
    },
  };
}
