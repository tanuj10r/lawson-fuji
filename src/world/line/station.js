import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { box, cyl, bake, trs } from '../../core/util.js';
import { hullOutline } from '../../core/outline.js';
import { TOWN, ROADS } from '../../config.js';
import { steps, railing } from '../ground.js';
import { makeBench, makeBins, makePhoneBooth, makePlanter, makeBikeRack } from '../props.js';
import { makeBusStop, makeVehicle } from '../vehicles.js';
import { addVending } from '../vending.js';
import { LAYER } from '../kit/decals.js';
import { TRACK_Z } from './track.js';
import {
  nameBoardTex, entranceTex, platformNumberTex, gateSignTex, fareMapTex, machineScreenTex,
  windowSignTex, timetableTex, clockFaceTex, areaMapTex, posterTex, taxiSignTex, makeDepartureBoard, labelTex,
} from './tex.js';
import { buildShop } from '../kit/shopfronts.js';
import { lampMaterial } from '../kit/poles.js';
import { makeAircon, makeBicycle, makeNoticeBoard } from '../props.js';

/* ------------------------------------------------------------------ *
 * The station (SPEC section 3, station and trains).
 *
 *   building   on the plaza's south side, entered up a flight of steps.
 *              The concourse is at platform height: the staffed window and
 *              its office, ticket machines under the fare map, the ticket
 *              gates with the 改札口 sign and a live departure board, a
 *              clock, posters, a bench.  Through the gates, platform 1.
 *   platforms  two side platforms: edge band and tactile line, canopies,
 *              駅名標, platform numbers, hanging departure boards, clocks,
 *              timetables, benches, bins, lamps.  Platform 2 is reached by
 *              the in-station crossing (構内踏切) at the east end.
 *   plaza      completes M2b's: a clock pole, the bus stop and its shelter,
 *              a waiting taxi, bikes, a phone booth, the area map, bins.
 * ------------------------------------------------------------------ */

const PH = 1.08;                               // platform and concourse floor
const B = TOWN.station.building;
const PL = TOWN.station.platforms;
const EDGE = 1.6;                              // track centre to platform edge
const PLAT = [
  { n: 1, z0: TRACK_Z[0] - EDGE - PL.depth, z1: TRACK_Z[0] - EDGE, edge: TRACK_Z[0] - EDGE, face: 1 },
  { n: 2, z0: TRACK_Z[1] + EDGE, z1: TRACK_Z[1] + EDGE + PL.depth, edge: TRACK_Z[1] + EDGE, face: -1 },
];

let M = null;
function mats() {
  if (M) return M;
  M = {
    wall: cel({ color: 0xe8e0d0, bands: 3, tint: 0x6f6790 }),
    wallIn: cel({ color: 0xece8e2, bands: 3, tint: 0x7a7090 }),
    trim: cel({ color: 0x5c7a68, bands: 3, tint: 0x4b5a6a }),
    roof: cel({ color: 0x4f5a6a, bands: 3, tint: 0x4a4468 }),
    canopy: cel({ color: 0xd4d8e0, bands: 3, tint: 0x666090 }),
    floor: cel({ color: 0xc8c6d0, bands: 3, tint: 0x6a6288 }),
    deck: cel({ color: 0xd4d0d8, bands: 3, tint: 0x6a6288 }),
    edge: cel({ color: 0x8a8898, bands: 3, tint: 0x5c5680 }),
    steel: cel({ color: 0xb8bcc6, bands: 3, tint: 0x666090 }),
    dark: cel({ color: 0x3c3a48, bands: 2, tint: 0x4b4560 }),
    cabinet: cel({ color: 0xdfe2e8, bands: 3, tint: 0x6a6288 }),
    wood: cel({ color: 0xa88460, bands: 3, tint: 0x5c5680 }),
    glass: flat({ color: 0xa8c4e0, transparent: true, opacity: 0.25, depthWrite: false }),
    light: flat({ color: 0xfffbea }),
    blue: flat({ color: 0x4aa0ff }),
    green: flat({ color: 0x4ae08a }),
  };
  return M;
}

const reg = (ctx, kind, x, z, rect) => ctx.registry?.push(rect ? { kind, x, z, rect } : { kind, x, z });

/** A picture on a wall or a board: a textured plane with a frame behind. */
function board(g, map, w, h, x, y, z, ry, frame = true) {
  const m = mats();
  if (frame) {
    const f = box(w + 0.08, h + 0.08, 0.05, m.dark, x, y, z);
    f.rotation.y = ry;
    g.add(f);
  }
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), flat({ color: 0xffffff, map, cache: false }));
  p.position.set(x + Math.sin(ry) * 0.03, y, z + Math.cos(ry) * 0.03);
  p.rotation.y = ry;
  p.userData.noOutline = true;
  g.add(p);
  return p;
}

/** A wall clock: face, hands set to the time, kept turning. */
function clock(ctx, g, x, y, z, ry, r = 0.35) {
  const m = mats();
  const c = new THREE.Group();
  c.position.set(x, y, z);
  c.rotation.y = ry;
  c.userData.dynamic = true;          // the hands turn
  c.add(cyl(r + 0.04, r + 0.04, 0.08, 20, m.dark, 0, 0, 0).rotateX(Math.PI / 2));
  const face = new THREE.Mesh(new THREE.CircleGeometry(r, 24), flat({ color: 0xffffff, map: clockFaceTex(), cache: false }));
  face.position.z = 0.045;
  c.add(face);
  const hands = [];
  for (const [len, wid] of [[r * 0.55, 0.035], [r * 0.82, 0.022]]) {
    const pivot = new THREE.Group();
    pivot.position.z = 0.05;
    pivot.add(box(wid, len, 0.01, m.dark, 0, len / 2, 0));
    c.add(pivot);
    hands.push(pivot);
  }
  pivot0(hands);
  g.add(c);
  ctx.update(() => pivot0(hands));
  return c;
}
function pivot0([hr, mn]) {
  const d = new Date();
  const mins = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  hr.rotation.z = -((mins / 720) % 1) * Math.PI * 2;
  mn.rotation.z = -((mins / 60) % 1) * Math.PI * 2;
}

/**
 * A small building (waiting room, annex, police box): walls, a flat roof, a
 * glazed front with a door, windows down the sides, a sign over the door,
 * an AC unit.  `face` is the way its front looks ('x+', 'x-', 'z+', 'z-').
 */
function smallBuilding(ctx, g, { x0, z0, x1, z1, y = 0, h = 2.8, face, sign, wall = 0xe8e2d6, glassFront = true }) {
  const m = mats();
  const wm = cel({ color: wall, bands: 3, tint: 0x6f6790 });
  const W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const b = new THREE.Group();
  b.position.set(cx, y, cz);
  const fx = { 'x+': 1, 'x-': -1 }[face] ?? 0, fz = { 'z+': 1, 'z-': -1 }[face] ?? 0;
  const body = box(W, h, D, wm, 0, h / 2, 0);
  body.castShadow = body.receiveShadow = true;
  b.add(body);
  hullOutline(body, { thickness: 0.003 });
  const roof = box(W + 0.4, 0.18, D + 0.4, m.roof, 0, h + 0.09, 0);
  roof.castShadow = true;
  b.add(roof);
  // the front: glazing and a door, a sign over it
  const fw = fx ? D : W, out = (fx ? W : D) / 2 + 0.02;
  const place = (o, u, yy, extra = 0) => {
    o.position.set(fx ? fx * (out + extra) : u, yy, fx ? u : fz * (out + extra));
    o.rotation.y = fx ? (fx > 0 ? Math.PI / 2 : -Math.PI / 2) : (fz > 0 ? 0 : Math.PI);
    b.add(o);
  };
  if (glassFront) {
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(fw - 0.6, h - 1.0), cel({ color: 0x8aa4c0, bands: 2, tint: 0x4b4560 }));
    place(gl, 0, 0.35 + (h - 1.0) / 2);
  }
  place(box(1.0, 2.1, 0.06, m.dark, 0, 0, 0), fw * 0.28, 1.05, 0.02);
  if (sign) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(fw - 0.4, 2.4), 0.72), flat({ color: 0xffffff, map: sign, cache: false }));
    place(p, 0, h - 0.4, 0.03);
  }
  // windows down the sides
  for (const s of [-1, 1]) {
    const wgl = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.9), cel({ color: 0x6f7c9c, bands: 2, tint: 0x4b4560 }));
    if (fx) { wgl.position.set(0, 1.6, s * (D / 2 + 0.02)); wgl.rotation.y = s > 0 ? 0 : Math.PI; }
    else { wgl.position.set(s * (W / 2 + 0.02), 1.6, 0); wgl.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; }
    b.add(wgl);
  }
  g.add(b);
  const ac = makeAircon({ x: 0, y: 0, z: 0 });
  ac.position.set(cx + (fx ? -fx * (W / 2 + 0.4) : W / 2 - 0.6), y, cz + (fz ? -fz * (D / 2 + 0.4) : D / 2 - 0.6));
  ac.rotation.y = fx ? (fx > 0 ? -Math.PI / 2 : Math.PI / 2) : (fz > 0 ? Math.PI : 0);
  g.add(ac);
  ctx.collide(x0, z0, x1, z1, y + h);
  reg(ctx, 'building', cx, cz, [x0, z0, x1, z1]);
  return b;
}

export function buildStation(ctx, { kit, service }) {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'station';
  ctx.add(g);
  const boards = [];

  /* ================================ building ================================ */
  const H = 3.4;                                  // floor to ceiling
  const cxE = (B.x0 + B.x1) / 2;                  // entrance on the spine's axis
  const entW = 5.0;
  {
    // floor slab at platform height, and the walkable top
    const floor = box(B.x1 - B.x0, PH, B.z1 - B.z0, m.floor, cxE, PH / 2, (B.z0 + B.z1) / 2);
    floor.receiveShadow = true;
    g.add(floor);
    ctx.platform({ x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1 + 0.05, top: PH });

    const parts = { wall: [], wallIn: [], trim: [], roof: [] };
    const push = (k, x0, x1, y0, y1, z0, z1) => parts[k].push({
      geometry: new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), matrix: trs((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
    });
    const T = 0.25, y0 = PH, y1 = PH + H;
    // front wall, the entrance and two windows cut out of it
    const openings = [[cxE - entW / 2, cxE + entW / 2, y0, y0 + 2.6], [B.x0 + 2, B.x0 + 6, y0 + 0.9, y0 + 2.4], [B.x1 - 6, B.x1 - 2, y0 + 0.9, y0 + 2.4]];
    const xs = [B.x0, ...openings.flatMap((o) => [o[0], o[1]]), B.x1].sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i++) {
      const a = xs[i], b = xs[i + 1], mid = (a + b) / 2;
      const o = openings.find((q) => mid > q[0] && mid < q[1]);
      if (!o) { push('wall', a, b, y0, y1, B.z0, B.z0 + T); continue; }
      if (o[2] > y0) push('wall', a, b, y0, o[2], B.z0, B.z0 + T);
      push('wall', a, b, o[3], y1, B.z0, B.z0 + T);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(b - a, o[3] - o[2]), m.glass);
      gl.position.set(mid, (o[2] + o[3]) / 2, B.z0 + 0.02);
      gl.rotation.y = Math.PI;
      gl.userData.noOutline = true;
      if (o[2] > y0) g.add(gl);           // the entrance itself stands open
    }
    // sides
    for (const x of [B.x0, B.x1 - T]) push('wall', x, x + T, y0, y1, B.z0, B.z1);
    // back wall, open over the gates to the platform
    const gate0 = cxE - 6, gate1 = cxE + 6;
    push('wall', B.x0, gate0, y0, y1, B.z1 - T, B.z1);
    push('wall', gate1, B.x1, y0, y1, B.z1 - T, B.z1);
    push('wall', gate0, gate1, y0 + 2.7, y1, B.z1 - T, B.z1);
    // roof, eaves, and the canopy over the steps
    push('roof', B.x0 - 0.5, B.x1 + 0.5, y1, y1 + 0.3, B.z0 - 0.5, B.z1 + 0.5);
    push('trim', B.x0 - 0.55, B.x1 + 0.55, y1 - 0.25, y1, B.z0 - 0.55, B.z0 - 0.4);
    push('roof', cxE - entW / 2 - 1.2, cxE + entW / 2 + 1.2, y0 + 2.8, y0 + 2.95, B.z0 - 2.6, B.z0);
    for (const s of [-1, 1]) push('trim', cxE + s * (entW / 2 + 1.0) - 0.08, cxE + s * (entW / 2 + 1.0) + 0.08, 0.17, y0 + 2.8, B.z0 - 2.5, B.z0 - 2.34);
    // a plinth band along the front
    push('trim', B.x0, B.x1, y0, y0 + 0.5, B.z0 - 0.04, B.z0);
    // inside lining and ceiling
    push('wallIn', B.x0 + T, B.x1 - T, y1 - 0.06, y1 - 0.02, B.z0 + T, B.z1 - T);
    for (const [k, list] of Object.entries(parts)) {
      const mesh = new THREE.Mesh(bake(list), m[k]);
      mesh.castShadow = mesh.receiveShadow = true;
      g.add(mesh);
      if (k === 'wall' || k === 'roof') hullOutline(mesh, { thickness: 0.0032 });
    }
    // colliders: walls, with the entrance and the gate line open
    ctx.collide(B.x0, B.z0, cxE - entW / 2, B.z0 + T, y1);
    ctx.collide(cxE + entW / 2, B.z0, B.x1, B.z0 + T, y1);
    ctx.collide(B.x0, B.z0, B.x0 + T, B.z1, y1);
    ctx.collide(B.x1 - T, B.z0, B.x1, B.z1, y1);
    ctx.collide(B.x0, B.z1 - T, gate0, B.z1, y1);
    ctx.collide(gate1, B.z1 - T, B.x1, B.z1, y1);
    for (const s of [-1, 1]) ctx.collide(cxE + s * (entW / 2 + 1.0) - 0.12, B.z0 - 2.55, cxE + s * (entW / 2 + 1.0) + 0.12, B.z0 - 2.3, 3);
    reg(ctx, 'building', cxE, (B.z0 + B.z1) / 2, [B.x0, B.z0, B.x1, B.z1]);

    // the steps up from the plaza, full width of the entrance and canopy, handrails either side and down the middle
    const stepY = ROADS.asphaltY + ROADS.kerbH, run = 0.38 * 6;
    // `dir` is the way up: start at the foot on the plaza and climb toward the door
    steps(ctx, { x: cxE, z: B.z0 - run, axis: 'z', dir: 1, n: 6, rise: (PH - stepY) / 6, run: 0.38, w: entW + 2.2, y: stepY });
    {
      const rails = [];
      for (const ox of [-(entW / 2 + 1.0), 0, entW / 2 + 1.0]) {
        const x = cxE + ox;
        for (const [z, yy] of [[B.z0 - run, stepY], [B.z0 - 0.1, PH]]) rails.push({ geometry: new THREE.BoxGeometry(0.05, 0.9, 0.05), matrix: trs(x, yy + 0.45, z) });
        const len = Math.hypot(run, PH - stepY);
        // a box along z tilted by +t about x drops its +z end: the rail has to
        // rise toward the door (+z), so the tilt is negative
        rails.push({ geometry: new THREE.BoxGeometry(0.05, 0.05, len), matrix: trs(x, (stepY + PH) / 2 + 0.9, B.z0 - run / 2, -Math.atan2(PH - stepY, run), 0, 0) });
      }
      const rm = new THREE.Mesh(bake(rails), m.steel);
      rm.castShadow = true;
      g.add(rm);
    }
    // lights under the ceiling and the canopy
    const lights = [];
    for (let x = B.x0 + 2; x < B.x1 - 1; x += 3) for (const z of [B.z0 + 2, B.z1 - 2.2]) lights.push({ geometry: new THREE.BoxGeometry(1.2, 0.03, 0.3), matrix: trs(x, y1 - 0.09, z) });
    lights.push({ geometry: new THREE.BoxGeometry(2.4, 0.03, 0.3), matrix: trs(cxE, y0 + 2.78, B.z0 - 1.3) });
    const lit = new THREE.Mesh(bake(lights), m.light);
    lit.userData.noOutline = true;
    g.add(lit);

    // the station's face: downpipes at the corners, posters in frames, a vending pair
    for (const x of [B.x0 + 0.2, B.x1 - 0.2]) g.add(box(0.12, H + PH, 0.12, m.steel, x, (H + PH) / 2, B.z0 - 0.08));
    [[cxE - 7.5, 0], [cxE + 7.8, 3]].forEach(([x, v]) => board(g, posterTex(v), 0.72, 1.0, x, PH + 1.4, B.z0 - 0.02, Math.PI));
    for (const [k, x] of [[0, B.x0 + 2.0], [1, B.x0 + 3.2]]) {
      addVending(ctx, { detail: true, x, y: ROADS.asphaltY + ROADS.kerbH, z: B.z0 - 0.5, ry: Math.PI, variant: k, seed: 8870 + k });
      ctx.night?.pool(x, B.z0 - 1.2, 1.8, { y: ROADS.asphaltY + ROADS.kerbH, color: 0xe8f0ff, strength: 0.8 });
      reg(ctx, 'prop', x, B.z0 - 0.5);
    }
    // name over the entrance
    board(g, entranceTex(), 7.2, 1.8, cxE, y0 + 3.6, B.z0 - 0.58, Math.PI, true);
    // lit from inside after dark: the open entrance and the two windows
    ctx.night?.glow(g, entW - 0.2, 2.5, cxE, PH + 1.3, B.z0 + 0.3, Math.PI);
    for (const x of [B.x0 + 4, B.x1 - 4]) ctx.night?.glow(g, 3.8, 1.4, x, PH + 1.65, B.z0 - 0.03, Math.PI);
    // the light it throws: the concourse, and down the steps
    for (let x = B.x0 + 4; x < B.x1 - 2; x += 6) ctx.night?.pool(x, (B.z0 + B.z1) / 2, 3.4, { y: PH, strength: 0.8 });
    ctx.night?.pool(cxE, B.z0 - 2.4, 4.2, { y: ROADS.asphaltY + ROADS.kerbH, strength: 1.1 });
  }

  /* ---- concourse ---- */
  {
    // the staffed window: an office in the west end, a window onto the concourse
    const offX = B.x0 + 7.5;
    const office = new THREE.Group();
    office.add(box(0.2, 1.0, B.z1 - B.z0 - 0.6, m.wallIn, offX, PH + 0.5, (B.z0 + B.z1) / 2));
    office.add(box(0.2, 0.8, B.z1 - B.z0 - 0.6, m.wallIn, offX, PH + 3.0, (B.z0 + B.z1) / 2));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(B.z1 - B.z0 - 0.6, 1.6), m.glass);
    win.position.set(offX + 0.11, PH + 1.8, (B.z0 + B.z1) / 2);
    win.rotation.y = Math.PI / 2;
    win.userData.noOutline = true;
    office.add(win);
    office.add(box(0.7, 0.08, 3.0, m.wood, offX + 0.4, PH + 1.0, (B.z0 + B.z1) / 2));        // the counter
    office.add(box(1.4, 0.75, 0.7, m.cabinet, offX - 1.2, PH + 0.37, B.z0 + 2.5));          // desk inside
    office.add(box(0.5, 1.8, 0.5, m.cabinet, B.x0 + 1.0, PH + 0.9, B.z1 - 1.2));            // lockers
    office.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    g.add(office);
    ctx.collide(offX - 0.1, B.z0, offX + 0.8, B.z1, PH + 3.4);
    board(g, windowSignTex(), 2.2, 0.55, offX + 0.13, PH + 2.95, (B.z0 + B.z1) / 2, Math.PI / 2);
    clock(ctx, g, offX + 0.14, PH + 2.95, B.z0 + 1.1, Math.PI / 2, 0.3);
    reg(ctx, 'prop', offX + 0.5, (B.z0 + B.z1) / 2);

    // ticket machines on the east wall, the fare map over them
    for (let i = 0; i < 2; i++) {
      const z = B.z0 + 1.6 + i * 1.1;
      const x = B.x1 - 0.6;
      const mach = box(0.6, 1.7, 0.9, m.cabinet, x, PH + 0.85, z);
      mach.castShadow = true;
      g.add(mach);
      hullOutline(mach, { thickness: 0.003 });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), flat({ color: 0xffffff, map: machineScreenTex(), cache: false }));
      scr.position.set(x - 0.31, PH + 1.15, z);
      scr.rotation.y = -Math.PI / 2;
      scr.rotation.x = -0.25;
      g.add(scr);
      g.add(box(0.05, 0.1, 0.4, m.dark, x - 0.31, PH + 0.75, z));
      ctx.collide(x - 0.3, z - 0.45, x + 0.3, z + 0.45, PH + 1.7);
      reg(ctx, 'prop', x, z);
    }
    board(g, fareMapTex(), 2.8, 1.05, B.x1 - 0.27, PH + 2.55, B.z0 + 2.15, -Math.PI / 2);

    // the ticket gates: five cabinets, walkable aisles between
    const gz = B.z1 - 1.4;
    for (let k = 0; k < 5; k++) {
      const x = cxE - 4 + k * 2;
      const cab = new THREE.Group();
      cab.add(box(0.32, 1.0, 1.3, m.cabinet, 0, 0.5, 0));
      cab.add(box(0.34, 0.08, 1.34, m.dark, 0, 1.02, 0));
      // reader panel and the lit indicators at each end
      cab.add(box(0.26, 0.02, 0.3, m.blue, 0, 1.07, -0.3));
      cab.add(box(0.1, 0.12, 0.02, k % 2 ? m.green : m.blue, 0, 0.85, -0.66));
      cab.add(box(0.1, 0.12, 0.02, m.green, 0, 0.85, 0.66));
      // flaps, open
      for (const s of [-1, 1]) cab.add(box(0.28, 0.3, 0.03, cel({ color: 0xf2c23c, bands: 3 }), s * 0.3, 0.7, 0.1));
      cab.position.set(x, PH, gz);
      cab.traverse((n) => { if (n.isMesh) n.castShadow = true; });
      g.add(cab);
      ctx.collide(x - 0.17, gz - 0.65, x + 0.17, gz + 0.65, PH + 1.0);
      reg(ctx, 'prop', x, gz);
    }
    // a rail from the gates to each side wall, so the gates are the way through
    for (const [a, b] of [[B.x0 + 8.3, cxE - 4.2], [cxE + 4.2, B.x1 - 0.3]]) {
      railing(ctx, { axis: 'x', from: a, to: b, at: gz, h: 1.0, y: PH });
    }
    board(g, gateSignTex(), 4.4, 0.82, cxE, PH + 2.95, gz - 0.9, Math.PI);
    const dep = makeDepartureBoard();
    boards.push(dep);
    board(g, dep.texture, 2.4, 0.8, cxE + 3.8, PH + 2.95, gz - 0.9, Math.PI).userData.keep = true;   // live: never atlased
    // posters and a bench on the walls
    [[B.x1 - 0.14, B.z1 - 2.6, -Math.PI / 2, 0], [B.x0 + 8.4, B.z1 - 2.2, Math.PI / 2, 1], [cxE - 4.5, B.z0 + 0.14, 0, 2], [cxE + 4.5, B.z0 + 0.14, 0, 3]]
      .forEach(([x, z, ry, v]) => board(g, posterTex(v), 0.7, 0.98, x, PH + 1.7, z, ry));
    const bench = makeBench({ x: cxE + 6.2, y: PH, z: B.z0 + 0.8, ry: 0, len: 2.2, wood: true });
    g.add(bench);
    ctx.collide(cxE + 5.0, B.z0 + 0.3, cxE + 7.4, B.z0 + 1.3, PH + 0.8);
    reg(ctx, 'prop', cxE + 6.2, B.z0 + 0.8);
  }

  /* ================================ platforms ================================ */
  for (const P of PLAT) {
    const zc = (P.z0 + P.z1) / 2;
    const deck = box(PL.x1 - PL.x0, PH, P.z1 - P.z0, m.deck, (PL.x0 + PL.x1) / 2, PH / 2, zc);
    deck.receiveShadow = deck.castShadow = true;
    g.add(deck);
    hullOutline(deck, { thickness: 0.0028 });
    ctx.platform({ x0: PL.x0, x1: PL.x1, z0: P.z0 - (P.n === 1 ? 0.05 : 0), z1: P.z1, top: PH });
    // the edge: a darker coping and a line nobody may stand beyond
    const ez = P.edge - P.face * 0.2;
    g.add(box(PL.x1 - PL.x0, 0.03, 0.4, m.edge, (PL.x0 + PL.x1) / 2, PH + 0.005, ez));
    ctx.collide(PL.x0, P.edge - P.face * 0.05 - 0.05, PL.x1, P.edge - P.face * 0.05 + 0.05, PH + 1.2);
    // yellow tactile line, a metre in from the edge
    for (let x = PL.x0 + 0.3; x < PL.x1 - 0.15; x += 0.3) {
      kit.decals.add('tactileLine', x, P.edge - P.face * 0.95, 0.3, 0.3, { x: 1, z: 0 }, PH - ROADS.asphaltY, LAYER.paint);
    }
    // canopy over the middle
    const c0 = -64, c1 = -36, colZ = P.edge - P.face * 2.3;
    const parts = [];
    for (let x = c0; x <= c1 + 0.01; x += 7) {
      parts.push({ geometry: new THREE.BoxGeometry(0.22, 3.1, 0.22), matrix: trs(x, PH + 1.55, colZ) });
      parts.push({ geometry: new THREE.BoxGeometry(0.12, 0.12, 3.2), matrix: trs(x, PH + 3.05, colZ + P.face * 0.9, P.face * -0.08, 0, 0) });
      ctx.collide(x - 0.15, colZ - 0.15, x + 0.15, colZ + 0.15, PH + 3.1);
    }
    const cols = new THREE.Mesh(bake(parts), m.steel);
    cols.castShadow = true;
    g.add(cols);
    const roof = box(c1 - c0 + 3, 0.12, 3.8, m.canopy, (c0 + c1) / 2, PH + 3.18, colZ + P.face * 0.8);
    roof.rotation.x = P.face * -0.08;
    roof.castShadow = true;
    g.add(roof);
    hullOutline(roof, { thickness: 0.003 });
    const lights = [];
    for (let x = c0 + 1.5; x < c1; x += 3.5) lights.push({ geometry: new THREE.BoxGeometry(1.2, 0.03, 0.2), matrix: trs(x, PH + 3.02, colZ + P.face * 0.6) });
    const lit = new THREE.Mesh(bake(lights), m.light);
    lit.userData.noOutline = true;
    g.add(lit);
    for (let x = c0 + 1.5; x < c1; x += 7) ctx.night?.pool(x, colZ + P.face * 0.6, 3.2, { y: PH, strength: 0.9 });
    // hanging under the canopy: platform number, departure board, clock
    const hz = colZ + P.face * 1.2;
    const ry = P.face > 0 ? 0 : Math.PI;
    board(g, platformNumberTex(P.n), 0.7, 0.7, c0 + 3.5, PH + 2.5, hz, ry);
    const dep = makeDepartureBoard();
    boards.push(dep);
    board(g, dep.texture, 1.8, 0.6, -50, PH + 2.6, hz, ry).userData.keep = true;
    clock(ctx, g, -43, PH + 2.55, hz, ry, 0.3);
    // name boards on legs, facing the track, and the timetable
    for (const x of [-68, -31]) {
      const nb = new THREE.Group();
      for (const s of [-1, 1]) nb.add(box(0.08, 2.2, 0.08, m.steel, s * 1.2, 1.1, 0));
      nb.position.set(x, PH, P.edge - P.face * 1.6);
      g.add(nb);
      board(g, nameBoardTex(), 2.6, 0.81, x, PH + 1.75, P.edge - P.face * 1.55, ry);
      ctx.collide(x - 1.3, P.edge - P.face * 1.6 - 0.1, x + 1.3, P.edge - P.face * 1.6 + 0.1, PH + 2.2);
      reg(ctx, 'sign', x, P.edge - P.face * 1.6);
    }
    board(g, timetableTex(), 0.7, 0.88, -57.5, PH + 1.5, colZ - P.face * 0.14, ry);
    // benches, bins, lamps along the back
    const bz = P.edge - P.face * (PL.depth - 0.6);
    for (const x of [-60, -53, -46, -39]) {
      const bb = makeBench({ x, y: PH, z: bz, ry: ry, len: 1.8, wood: false });
      g.add(bb);
      ctx.collide(x - 0.95, bz - 0.35, x + 0.95, bz + 0.35, PH + 0.8);
      reg(ctx, 'prop', x, bz);
    }
    for (const x of [-56.5, -42.5]) {
      g.add(makeBins({ x, y: PH, z: bz, ry }));
      ctx.collide(x - 0.8, bz - 0.35, x + 0.8, bz + 0.35, PH + 1.0);
      reg(ctx, 'prop', x, bz);
    }
    for (const x of [-72, -66, -34, -28]) {
      g.add(cyl(0.06, 0.07, 3.2, 8, m.steel, x, PH + 1.6, bz + P.face * -0.1));
      g.add(box(0.5, 0.1, 0.25, m.steel, x, PH + 3.2, bz + P.face * 0.1));
      g.add(box(0.44, 0.03, 0.2, m.light, x, PH + 3.14, bz + P.face * 0.1));
      ctx.collide(x - 0.12, bz - 0.12, x + 0.12, bz + 0.12, PH + 3.2);
    }
    // (behind both platforms the lineside fences close the station)
    // the platform ends: railings, except where the in-station crossing leaves
    railing(ctx, { axis: 'z', from: P.z0, to: P.z1, at: PL.x0 + 0.1, h: 1.1, y: PH });
  }

  /* ---- a waiting room on platform 2, and the station's annex ---- */
  {
    const P2 = PLAT[1];
    smallBuilding(ctx, g, { x0: -35, z0: P2.z1 - 2.1, x1: -29.5, z1: P2.z1 - 0.1, y: PH, h: 2.6, face: 'z-', sign: labelTex('待合室', '#1f3f7a', '#f7f2e4', 'Waiting Room') });
    smallBuilding(ctx, g, { x0: B.x1 + 0.4, z0: B.z0 + 0.8, x1: B.x1 + 6.4, z1: B.z1 - 0.4, y: 0.17, h: 3.0, face: 'z-', glassFront: false,
      sign: labelTex('お手洗い', '#f7f2e4', '#23222c', 'Toilets'), wall: 0xe0d8c8 });
  }

  /* ---- the in-station crossing (構内踏切) at the east end ---- */
  {
    const xw0 = PL.x1 + 6 * 0.42, xw1 = xw0 + 2.6;
    for (const P of PLAT) {
      steps(ctx, { x: xw0, z: (P.z0 + P.z1) / 2, axis: 'x', dir: -1, n: 6, rise: (PH - 0.31) / 6, run: 0.42, w: PL.depth, y: 0.31, mat: m.deck });
    }
    const walk = box(xw1 - xw0, 0.31, PLAT[1].z1 - PLAT[0].z0, m.edge, (xw0 + xw1) / 2, 0.155, (PLAT[0].z0 + PLAT[1].z1) / 2);
    walk.receiveShadow = true;
    g.add(walk);
    ctx.platform({ x0: PL.x1, x1: xw1, z0: PLAT[0].z0, z1: PLAT[1].z1, top: 0.31 });
    // keep to the walk between the platforms
    ctx.collide(PL.x1 - 0.05, PLAT[0].z1 + 0.05, PL.x1 + 0.05, PLAT[1].z0 - 0.05, 1.2);
    ctx.collide(xw1, PLAT[0].z0, xw1 + 0.1, PLAT[1].z1, 1.2);
    // and a warning post at each side of the tracks
    for (const P of PLAT) {
      const z = P.face > 0 ? P.z1 + 0.3 : P.z0 - 0.3;
      const post = new THREE.Group();
      post.add(cyl(0.05, 0.05, 1.8, 8, m.steel, 0, 0.9, 0));
      for (let k = 0; k < 4; k++) post.add(cyl(0.06, 0.06, 0.18, 8, k % 2 ? m.dark : cel({ color: 0xf2c23c, bands: 3 }), 0, 0.1 + k * 0.18, 0));
      post.add(box(0.5, 0.35, 0.03, cel({ color: 0xd8302c, bands: 3 }), 0, 1.6, 0));
      post.position.set(xw1 - 0.2, 0.31, z);
      g.add(post);
      reg(ctx, 'sign', xw1 - 0.2, z);
    }
  }

  /* ================================= plaza ================================= */
  {
    const P = TOWN.plaza;
    const y = ROADS.asphaltY + ROADS.kerbH;
    // the clock pole by the entrance
    const cp = { x: cxE - 7, z: B.z0 - 5 };
    g.add(cyl(0.09, 0.11, 3.6, 10, m.dark, cp.x, y + 1.8, cp.z));
    for (const ry of [0, Math.PI]) clock(ctx, g, cp.x, y + 3.9, cp.z + (ry ? -0.06 : 0.06), ry, 0.42);
    ctx.collide(cp.x - 0.2, cp.z - 0.2, cp.x + 0.2, cp.z + 0.2, 4.3);
    reg(ctx, 'prop', cp.x, cp.z);
    // bus stop with its shelter on the west side
    const bs = { x: P.x0 + 2.2, z: P.z0 + 8 };
    const stop = makeBusStop({ x: bs.x, y, z: bs.z - 2.4, ry: Math.PI / 2 });
    g.add(stop);
    ctx.collide(bs.x - 0.2, bs.z - 2.6, bs.x + 0.2, bs.z - 2.2, 2.5);
    {
      const sh = new THREE.Group();
      for (const dz of [-1.6, 1.6]) sh.add(box(0.1, 2.4, 0.1, m.steel, 0.6, 1.2, dz));
      sh.add(box(1.6, 0.1, 3.6, m.roof, 0.3, 2.45, 0));
      const back = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.8), m.glass);
      back.position.set(-0.35, 1.2, 0);
      back.rotation.y = Math.PI / 2;
      sh.add(back);
      sh.add(box(0.4, 0.08, 2.6, m.wood, -0.1, 0.45, 0));
      board(sh, posterTex(0), 0.7, 1.0, -0.3, 1.3, 1.2, Math.PI / 2, false);
      sh.position.set(bs.x - 0.8, y, bs.z + 0.6);
      sh.traverse((n) => { if (n.isMesh) n.castShadow = true; });
      g.add(sh);
      ctx.collide(bs.x - 1.25, bs.z - 1.2, bs.x - 1.05, bs.z + 2.4, 2.4);
      reg(ctx, 'prop', bs.x, bs.z);
    }
    // the taxi, waiting on the east side, nose to the entrance
    const tx = { x: P.x1 - 4.5, z: B.z0 - 7 };
    const taxi = makeVehicle({ kind: 'sedan', color: 0xf0eadc });
    taxi.position.set(tx.x, y, tx.z);
    taxi.rotation.y = Math.PI / 2;
    g.add(taxi);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.14), [
      m.dark, m.dark, m.dark, m.dark,
      flat({ color: 0xffffff, map: taxiSignTex(), cache: false }), flat({ color: 0xffffff, map: taxiSignTex(), cache: false }),
    ]);
    sign.position.set(tx.x, y + 1.62, tx.z);
    sign.rotation.y = Math.PI / 2;
    g.add(sign);
    ctx.collide(tx.x - 1.0, tx.z - 2.4, tx.x + 1.0, tx.z + 2.4, 1.6);
    reg(ctx, 'prop', tx.x, tx.z);
    // phone booth, area map, bins and planters by the entrance
    const pb = { x: P.x0 + 2.5, z: P.z1 - 3 };
    g.add(makePhoneBooth({ x: pb.x, y, z: pb.z, ry: Math.PI / 2 }));
    ctx.collide(pb.x - 0.6, pb.z - 0.6, pb.x + 0.6, pb.z + 0.6, 2.4);
    reg(ctx, 'prop', pb.x, pb.z);
    const am = { x: cxE - 10, z: B.z0 - 3.2 };
    for (const s of [-1, 1]) g.add(box(0.08, 1.2, 0.08, m.steel, am.x + s * 0.8, y + 0.6, am.z));
    board(g, areaMapTex(), 1.8, 1.2, am.x, y + 1.7, am.z, Math.PI);
    ctx.collide(am.x - 0.95, am.z - 0.1, am.x + 0.95, am.z + 0.1, 2.3);
    reg(ctx, 'sign', am.x, am.z);
    const bn = { x: cxE + 5.5, z: B.z0 - 3.0 };
    g.add(makeBins({ x: bn.x, y, z: bn.z, ry: Math.PI }));
    ctx.collide(bn.x - 0.8, bn.z - 0.35, bn.x + 0.8, bn.z + 0.35, 1.0);
    reg(ctx, 'prop', bn.x, bn.z);
    for (const x of [cxE - 5, cxE + 3.8]) {
      g.add(makePlanter({ x, y, z: B.z0 - 3.2, r: 0.35, flower: true, seed: Math.round(x * 3), n: 7 }));
      ctx.collide(x - 0.4, B.z0 - 3.6, x + 0.4, B.z0 - 2.8, y + 0.8);
      reg(ctx, 'prop', x, B.z0 - 3.2);
    }
    // one more rack of bicycles, full
    const br = { x: P.x1 - 1.1, z: P.z1 - 4 };
    g.add(makeBikeRack({ x: br.x, y, z: br.z, ry: Math.PI / 2, n: 6, seed: 8830 }));
    ctx.collide(br.x - 1.0, br.z - 2.2, br.x + 1.0, br.z + 2.2, y + 1.0);
    reg(ctx, 'prop', br.x, br.z);
    // lamp posts round the plaza, each with its pool of light after dark
    for (const [lx, lz] of [[P.x0 + 9, P.z0 + 6], [P.x1 - 9, P.z0 + 5], [cxE + 10, B.z0 - 8]]) {
      const lp = new THREE.Group();
      lp.add(cyl(0.07, 0.09, 3.8, 8, m.dark, 0, 1.9, 0));
      lp.add(cyl(0.2, 0.26, 0.4, 8, m.dark, 0, 3.95, 0));
      lp.add(cyl(0.17, 0.17, 0.26, 8, lampMaterial(), 0, 3.7, 0));
      lp.add(cyl(0.16, 0.2, 0.2, 8, m.dark, 0, 0.1, 0));
      lp.position.set(lx, y, lz);
      lp.traverse((n) => { if (n.isMesh) n.castShadow = true; });
      g.add(lp);
      ctx.collide(lx - 0.15, lz - 0.15, lx + 0.15, lz + 0.15, y + 4);
      reg(ctx, 'prop', lx, lz);
      ctx.night?.pool(lx, lz, 5.5, { y, strength: 1.1 });
    }
    // a light over the plaza, wired to the street
    kit.standPole(P.x0 + 1.2, P.z0 + 1.2);
    kit.standPole(cxE - 5.5, B.z0 - 1.2);   // at the plaza's south edge, beside the steps
    // a kiosk beside the entrance, the kind every small station has
    smallBuilding(ctx, g, { x0: B.x1 - 5.5, z0: B.z0 - 3.4, x1: B.x1 - 0.5, z1: B.z0 - 0.3, y, h: 2.7, face: 'z-',
      sign: labelTex('ふじみ売店', '#2f7a4a', '#f7f2e4', 'きっぷ ・ おみやげ'), wall: 0xefe6d6 });
    // the police box on the west side, a bicycle and its notice board outside
    smallBuilding(ctx, g, { x0: P.x0 + 0.6, z0: P.z0 + 11.5, x1: P.x0 + 4.4, z1: P.z0 + 15.5, y, h: 3.0, face: 'x+',
      sign: labelTex('交番', '#f4f2ee', '#1f3f7a', 'KOBAN'), wall: 0xd8dce4 });
    {
      const kx = P.x0 + 5.2, kz = P.z0 + 12.2;
      const bike = makeBicycle({ x: kx, y, z: kz, ry: 0.1, lean: 0.06, color: 0xf4f4f6 });
      g.add(bike);
      ctx.collide(kx - 0.35, kz - 0.9, kx + 0.35, kz + 0.9, y + 1.0);
      reg(ctx, 'prop', kx, kz);
      const nbd = makeNoticeBoard({ x: kx, y, z: P.z0 + 15.1, ry: Math.PI / 2 });
      g.add(nbd);
      reg(ctx, 'prop', kx, P.z0 + 15.1);
    }
    // a shop on the east side, facing the plaza (the kit's shopfront, a lot of its own)
    {
      const lot = { e: { cls: 'shopping', spec: ROADS.shopping }, w: 8.5, depth: 6.4, seed: 8850, side: 1 };
      const fx0 = P.x1 - 6.4;
      const F = { at: (u, v) => ({ x: fx0 + v, z: P.z0 + 5.5 - u }), face: { x: -1, z: 0 }, faceKey: 'x-', ry: -Math.PI / 2 };
      buildShop(ctx, null, kit, lot, F, 'cafe', { maxFloors: 2 });
    }
    // the guide path in yellow from the shopping street to the steps, and to the bus stop
    const tz = y - ROADS.asphaltY;
    for (let z = P.z0 + 0.3; z < B.z0 - 2.3; z += 0.3) kit.decals.add('tactileLine', cxE - 2.5, z, 0.3, 0.3, { x: 0, z: 1 }, tz, LAYER.paint);
    for (let x = bs.x + 1.0; x < cxE - 2.6; x += 0.3) kit.decals.add('tactileLine', x, bs.z - 0.6, 0.3, 0.3, { x: 1, z: 0 }, tz, LAYER.paint);
    // the taxi rank: a yellow box round the waiting cab
    for (const dx of [-1.3, 1.3]) kit.decals.add('yellow', tx.x + dx, tx.z, 0.15, 5.6, { x: 0, z: 1 }, tz, LAYER.paint);
    for (const dz of [-2.8, 2.8]) kit.decals.add('yellow', tx.x, tx.z + dz, 2.6, 0.15, { x: 0, z: 1 }, tz, LAYER.paint);
  }

  // the boards follow the service, once a second
  let acc = 1;
  const redraw = () => {
    const rows = service.boardRows();
    for (const b of boards) b.draw(rows);
  };
  redraw();
  ctx.update((dt) => { acc += dt; if (acc >= 1) { acc = 0; redraw(); } });
  return { group: g, boards, platforms: PLAT, PH };
}
