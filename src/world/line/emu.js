import * as THREE from 'three';
import { PAL } from '../../core/palette.js';
import { cel, flat } from '../../core/toon.js';
import { box, cyl, bake, trs, rngKit } from '../../core/util.js';
import { hullOutline } from '../../core/outline.js';
import { trainNumber } from '../../core/textures.js';
import { RAIL_TOP } from '../railway.js';
import { mergeStatic } from '../merge.js';
import { CONTACT_Y } from './track.js';
import { destTex } from './tex.js';

/* ------------------------------------------------------------------ *
 * Our train (SPEC section 3): a two-car local in green and cream, built
 * hollow so it can stop at the platform and open its doors.
 *
 * Proportions follow the library's EMU (train.js): 19.4 m cars on a
 * 20.1 m pitch, four doors a side.  But every car here is a shell -- floor,
 * roof, end walls, and side walls built between the door and window
 * openings, with a cream lining inside -- so the interior is real: long
 * bench seats in green moquette, poles, luggage racks, straps, lit ceiling
 * strips, and a few passengers as dark silhouettes (SPEC asks for them).
 *
 * Doors are two leaves each that slide into the wall pocket (`setDoors`).
 * They open on the car's local -z side, which is the platform side on both
 * tracks: trains keep left, and a westbound set is the eastbound one turned
 * round.
 * ------------------------------------------------------------------ */

export const CAR_L = 19.4, CAR_W = 2.86, PITCH = 20.1;
const FLOOR = 1.06, TOP = 3.74, ROOF = 3.96;
const DOORS = [-7.0, -2.4, 2.4, 7.0];
const DOOR_W = 1.32, DOOR_TOP = FLOOR + 1.9;
const WIN_Y0 = 2.16, WIN_Y1 = 3.16;
const BAYS = [[-8.5, 1.7], [-4.7, 3.2], [0, 3.4], [4.7, 3.2], [8.5, 1.7]];
const LIVERY = { body: 0x3f8f5e, band: 0xf2ead2, door: 0x3f8f5e };
const BAND = [1.95, 3.37];                   // the cream band round the windows

let M = null;
function mats() {
  if (M) return M;
  M = {
    body: cel({ color: LIVERY.body, bands: 3, tint: 0x5a6f86 }),
    band: cel({ color: LIVERY.band, bands: 3, tint: 0x6f6796 }),
    roof: cel({ color: PAL.trainRoof, bands: 3, tint: 0x60597f }),
    skirt: cel({ color: PAL.trainSkirt, bands: 3, tint: 0x5b5480 }),
    dark: cel({ color: PAL.black, bands: 2, tint: 0x4b4560 }),
    metal: cel({ color: PAL.metalDark, bands: 3, tint: 0x5c5680 }),
    wheel: cel({ color: 0x4a4552, bands: 2, tint: 0x4b4560 }),
    // the interior: its own glow after dark (setNight), so it reads as lit
    lining: cel({ color: 0xece6d8, bands: 3, tint: 0x7a7090, emissive: 0xece6d8, emissiveIntensity: 0, cache: false }),
    floor: cel({ color: 0x8c8a98, bands: 3, tint: 0x5c5680, emissive: 0x8c8a98, emissiveIntensity: 0, cache: false }),
    seat: cel({ color: 0x3f7a5a, bands: 3, tint: 0x3f5a6a, emissive: 0x3f7a5a, emissiveIntensity: 0, cache: false }),
    seatBase: cel({ color: 0xb8b6c0, bands: 3, tint: 0x5c5680, emissive: 0xb8b6c0, emissiveIntensity: 0, cache: false }),
    pole: cel({ color: 0xd8dce4, bands: 3, tint: 0x666090, emissive: 0xd8dce4, emissiveIntensity: 0, cache: false }),
    person: cel({ color: 0x3a3646, bands: 2, tint: 0x2e2a3c }),
    light: flat({ color: 0xfffbea }),
    glass: flat({ color: 0xa8c4e0, transparent: true, opacity: 0.22, depthWrite: false }),
    cabGlass: flat({ color: PAL.trainWindow }),
    head: flat({ color: 0xfff6da }),
    tail: flat({ color: 0xff5a4a }),
  };
  M.interior = [M.lining, M.floor, M.seat, M.seatBase, M.pole];
  for (const m of M.interior) m.userData.live = true;
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

function buildCar({ cab, tail, rng }) {
  const m = mats();
  const car = new THREE.Group();
  const P = {};
  const push = (k, geo, mx) => (P[k] ??= []).push({ geometry: geo, matrix: mx });

  /* ---- shell: floor, roof, end walls ---- */
  push('floor', new THREE.BoxGeometry(CAR_L, 0.1, CAR_W - 0.1), trs(0, FLOOR - 0.05, 0));
  push('roof', new THREE.BoxGeometry(CAR_L - 0.1, ROOF - TOP, CAR_W - 0.24), trs(0, (TOP + ROOF) / 2, 0));
  push('body', new THREE.BoxGeometry(CAR_L, 0.12, CAR_W), trs(0, TOP - 0.06, 0));      // cornice
  for (const s of [-1, 1]) {
    push('roof', new THREE.BoxGeometry(CAR_L - 0.05, 0.07, 0.1), trs(0, TOP + 0.02, s * (CAR_W / 2 - 0.06)));
    // end walls: outside in livery, inside in lining
    const ex = s * (CAR_L / 2 - 0.04);
    push('body', new THREE.BoxGeometry(0.08, BAND[0] - FLOOR, CAR_W), trs(ex, (FLOOR + BAND[0]) / 2, 0));
    push('band', new THREE.BoxGeometry(0.09, BAND[1] - BAND[0], CAR_W + 0.02), trs(ex, (BAND[0] + BAND[1]) / 2, 0));
    push('body', new THREE.BoxGeometry(0.08, TOP - BAND[1], CAR_W), trs(ex, (BAND[1] + TOP) / 2, 0));
    push('lining', new THREE.BoxGeometry(0.04, TOP - FLOOR, CAR_W - 0.24), trs(ex - s * 0.07, (FLOOR + TOP) / 2, 0));
  }
  // ceiling panel and the two light strips
  push('lining', new THREE.BoxGeometry(CAR_L - 0.2, 0.03, CAR_W - 0.2), trs(0, TOP - 0.13, 0));
  const lights = [];
  for (const z of [-0.62, 0.62]) lights.push({ geometry: new THREE.BoxGeometry(CAR_L - 1.2, 0.03, 0.2), matrix: trs(0, TOP - 0.16, z) });

  /* ---- side walls between the openings, skin and lining ---- */
  const cells = wallCells();
  for (const sz of [1, -1]) {
    const zSkin = sz * (CAR_W / 2 - 0.03), zLine = sz * (CAR_W / 2 - 0.1);
    for (const c of cells) {
      const len = c.b - c.a, cx = (c.a + c.b) / 2;
      const spans = c.kind === 'door' ? [[DOOR_TOP, TOP - 0.12]]
        : c.kind === 'window' ? [[FLOOR, WIN_Y0], [WIN_Y1, TOP - 0.12]]
          : [[FLOOR, TOP - 0.12]];
      for (const [y0, y1] of spans) {
        // the skin, cut into the livery's bands
        for (const [b0, b1, k] of [[FLOOR, BAND[0], 'body'], [BAND[0], BAND[1], 'band'], [BAND[1], TOP, 'body']]) {
          const a = Math.max(y0, b0), b = Math.min(y1, b1);
          if (b - a > 1e-3) push(k, new THREE.BoxGeometry(len, b - a, k === 'band' ? 0.08 : 0.06), trs(cx, (a + b) / 2, zSkin + (k === 'band' ? sz * 0.01 : 0)));
        }
        push('lining', new THREE.BoxGeometry(len, y1 - y0, 0.04), trs(cx, (y0 + y1) / 2, zLine));
      }
      if (c.kind === 'window') {
        push('metal', new THREE.BoxGeometry(len, 0.05, 0.1), trs(cx, WIN_Y0, zSkin));
        push('metal', new THREE.BoxGeometry(len, 0.05, 0.1), trs(cx, WIN_Y1, zSkin));
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(len, WIN_Y1 - WIN_Y0), m.glass);
        gl.position.set(cx, (WIN_Y0 + WIN_Y1) / 2, zSkin);
        gl.rotation.y = sz > 0 ? 0 : Math.PI;
        gl.userData.noOutline = true;
        car.add(gl);
      }
    }
  }

  /* ---- doors: two leaves each, sliding into the pocket ----
   * Only the platform side (local -z) ever opens, and on it every left leaf
   * slides the same way, as does every right one: so a car has two sliding
   * groups, each one baked mesh per material.  The far side's leaves are
   * plain parts of the body. */
  const leaves = { 1: [], [-1]: [] };
  const w = DOOR_W / 2;
  for (const sz of [1, -1]) {
    const z = sz * (CAR_W / 2 - 0.068);
    for (const half of [-1, 1]) {
      const slide = sz < 0 ? { body: [], band: [], glass: [] } : null;
      for (const d of DOORS) {
        const x = d + half * (w / 2);
        const pieces = [
          ['body', new THREE.BoxGeometry(w, BAND[0] - FLOOR, 0.02), trs(x, (FLOOR + BAND[0]) / 2, z)],
          ['band', new THREE.BoxGeometry(w, DOOR_TOP - BAND[0], 0.02), trs(x, (BAND[0] + DOOR_TOP) / 2, z)],
        ];
        for (const [k, geo, mx] of pieces) (slide ? slide[k] : (P[k] ??= [])).push({ geometry: geo, matrix: mx });
        const pane = { geometry: new THREE.PlaneGeometry(w - 0.16, 0.8), matrix: trs(x, 2.55, z + sz * 0.012, 0, sz > 0 ? 0 : Math.PI, 0) };
        if (slide) slide.glass.push(pane);
        else (P.glassStatic ??= []).push(pane);
      }
      if (slide) {
        const grp = new THREE.Group();
        for (const [k, list] of Object.entries(slide)) {
          const mesh = new THREE.Mesh(bake(list), k === 'glass' ? m.glass : m[k]);
          mesh.castShadow = k !== 'glass';
          if (k === 'glass') mesh.userData.noOutline = true;
          grp.add(mesh);
        }
        grp.userData.half = half;
        grp.userData.dynamic = true;       // it slides: never batched
        car.add(grp);
        leaves[sz].push(grp);
      }
    }
    for (const d of DOORS) push('dark', new THREE.BoxGeometry(DOOR_W + 0.1, 0.06, 0.1), trs(d, DOOR_TOP + 0.03, sz * (CAR_W / 2 - 0.03)));
  }

  /* ---- interior: benches, poles, racks, straps ---- */
  const benchRuns = [];
  {
    const stops = [-CAR_L / 2 + 0.9, ...DOORS.flatMap((d) => [d - DOOR_W / 2 - 0.15, d + DOOR_W / 2 + 0.15]), CAR_L / 2 - 0.9];
    for (let i = 0; i + 1 < stops.length; i += 2) if (stops[i + 1] - stops[i] > 0.8) benchRuns.push([stops[i], stops[i + 1]]);
  }
  for (const sz of [1, -1]) {
    for (const [a, b] of benchRuns) {
      const len = b - a, cx = (a + b) / 2;
      push('seatBase', new THREE.BoxGeometry(len, 0.34, 0.46), trs(cx, FLOOR + 0.17, sz * (CAR_W / 2 - 0.36)));
      push('seat', new THREE.BoxGeometry(len, 0.1, 0.5), trs(cx, FLOOR + 0.42, sz * (CAR_W / 2 - 0.38)));
      push('seat', new THREE.BoxGeometry(len, 0.48, 0.1), trs(cx, FLOOR + 0.72, sz * (CAR_W / 2 - 0.17), sz * 0.12, 0, 0));
      push('pole', new THREE.BoxGeometry(len, 0.03, 0.3), trs(cx, FLOOR + 1.95, sz * (CAR_W / 2 - 0.27)));     // rack
      for (let x = a + 0.3; x < b; x += 0.55) {
        push('pole', new THREE.BoxGeometry(0.03, 0.22, 0.03), trs(x, TOP - 0.45, sz * (CAR_W / 2 - 0.6)));
        push('seatBase', new THREE.BoxGeometry(0.1, 0.1, 0.03), trs(x, TOP - 0.6, sz * (CAR_W / 2 - 0.6)));
      }
    }
    push('pole', new THREE.BoxGeometry(CAR_L - 1.4, 0.035, 0.035), trs(0, TOP - 0.33, sz * (CAR_W / 2 - 0.6)));
    for (const d of DOORS) {
      for (const e of [-1, 1]) push('pole', new THREE.CylinderGeometry(0.02, 0.02, TOP - FLOOR, 6), trs(d + e * (DOOR_W / 2 + 0.1), (FLOOR + TOP) / 2, sz * (CAR_W / 2 - 0.4)));
    }
  }

  /* ---- passengers: a few, seated and standing, as silhouettes ---- */
  const people = [];
  const seated = rng.int(2, 4);
  for (let i = 0; i < seated; i++) {
    const [a, b] = rng.pick(benchRuns);
    const sz = rng.sign();
    const x = rng.range(a + 0.3, b - 0.3), z = sz * (CAR_W / 2 - 0.45);
    people.push({ geometry: new THREE.BoxGeometry(0.42, 0.62, 0.26), matrix: trs(x, FLOOR + 0.78, z) });
    people.push({ geometry: new THREE.SphereGeometry(0.12, 8, 6), matrix: trs(x, FLOOR + 1.22, z) });
    people.push({ geometry: new THREE.BoxGeometry(0.36, 0.14, 0.42), matrix: trs(x, FLOOR + 0.5, z - sz * 0.25) });
    people.push({ geometry: new THREE.BoxGeometry(0.3, 0.5, 0.12), matrix: trs(x, FLOOR + 0.25, z - sz * 0.46) });
  }
  if (rng.chance(0.7)) {
    const d = rng.pick(DOORS), sz = rng.sign();
    const x = d + (DOOR_W / 2 + 0.35), z = sz * 0.6;
    people.push({ geometry: new THREE.BoxGeometry(0.44, 0.7, 0.28), matrix: trs(x, FLOOR + 1.25, z) });
    people.push({ geometry: new THREE.SphereGeometry(0.12, 8, 6), matrix: trs(x, FLOOR + 1.75, z) });
    people.push({ geometry: new THREE.BoxGeometry(0.34, 0.85, 0.22), matrix: trs(x, FLOOR + 0.45, z) });
  }

  /* ---- underframe, bogies, roof gear ---- */
  push('skirt', new THREE.BoxGeometry(CAR_L - 0.3, 0.5, CAR_W - 0.34), trs(0, FLOOR - 0.35, 0));
  push('skirt', new THREE.BoxGeometry(CAR_L - 1.6, 0.28, CAR_W - 0.8), trs(0, FLOOR - 0.62, 0));
  for (const bx of [-6.3, 6.3]) {
    push('metal', new THREE.BoxGeometry(2.9, 0.42, CAR_W - 0.9), trs(bx, 0.78, 0));
    push('dark', new THREE.BoxGeometry(3.3, 0.2, 0.28), trs(bx, 0.62, 0));
  }
  for (const rx of [-5.6, -1.4, 3.2, 7.4]) push('roof', new THREE.BoxGeometry(2.1, 0.3, 1.5), trs(rx, ROOF + 0.13, rx % 2 === 0 ? 0.18 : -0.18));
  // gangway bellows at the inner ends
  for (const s of [-1, 1]) {
    if ((s > 0 && cab) || (s < 0 && tail)) continue;
    push('dark', new THREE.BoxGeometry(0.5, 2.1, 1.2), trs(s * (CAR_L / 2 + 0.2), FLOOR + 1.05, 0));
  }

  /* ---- cab end ---- */
  let dest = null;
  if (cab || tail) {
    const s = cab ? 1 : -1;
    const fx = s * (CAR_L / 2);
    push('dark', new THREE.BoxGeometry(0.1, 1.34, CAR_W - 0.22), trs(fx + s * 0.03, 2.86, 0));
    for (const wz of [-0.72, 0.72]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 1.02), m.cabGlass);
      pane.position.set(fx + s * 0.085, 2.88, wz);
      pane.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      pane.userData.noOutline = true;
      car.add(pane);
    }
    dest = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), flat({ color: 0xffffff, map: destTex('east'), cache: false }));
    dest.position.set(fx + s * 0.09, 3.52, 0);
    dest.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    dest.userData.noOutline = true;
    dest.userData.keep = true;
    car.add(dest);
    push('dark', new THREE.BoxGeometry(0.08, 0.5, 1.66), trs(fx + s * 0.04, 3.52, 0));
    for (const lz of [-1.06, 1.06]) {
      push('dark', new THREE.BoxGeometry(0.14, 0.42, 0.5), trs(fx + s * 0.05, 1.55, lz));
      for (const [ly, lamp] of [[1.63, cab ? m.head : m.tail], [1.44, cab ? m.tail : m.head]]) {
        const l = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.15), lamp);
        l.position.set(fx + s * 0.13, ly, lz);
        l.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
        l.userData.noOutline = true;
        car.add(l);
      }
    }
    push('skirt', new THREE.BoxGeometry(0.34, 0.78, CAR_W - 0.5), trs(fx + s * 0.1, 0.82, 0));
    push('dark', new THREE.BoxGeometry(0.5, 0.22, 0.34), trs(fx + s * 0.25, 0.62, 0));
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.24), flat({ color: 0xffffff, map: trainNumber(), cache: false }));
    plate.position.set(fx - s * 1.4, 1.42, CAR_W / 2 + 0.02);
    plate.userData.noOutline = true;
    car.add(plate);
    // pantograph
    const p = new THREE.Group();
    p.position.set(cab ? -4.0 : 4.0, ROOF + 0.05, 0);
    p.scale.y = (CONTACT_Y - p.position.y) / 1.64;
    p.add(box(1.5, 0.08, 1.5, m.metal, 0, 0.04, 0));
    for (const t of [-1, 1]) {
      const lower = box(0.06, 0.9, 0.06, m.metal, t * 0.35, 0.5, 0);
      lower.rotation.z = t * 0.55;
      p.add(lower);
      const upper = box(0.05, 0.78, 0.05, m.metal, t * 0.0575, 1.247, 0);
      upper.rotation.z = t * 0.148;
      p.add(upper);
    }
    p.add(box(0.24, 0.05, 1.34, m.metal, 0, 1.64, 0));
    car.add(p);
  }

  /* ---- bake ---- */
  const matFor = {
    floor: m.floor, roof: m.roof, body: m.body, band: m.band, lining: m.lining, metal: m.metal,
    dark: m.dark, seat: m.seat, seatBase: m.seatBase, pole: m.pole, skirt: m.skirt, glassStatic: m.glass,
  };
  for (const [k, list] of Object.entries(P)) {
    const mesh = new THREE.Mesh(bake(list), matFor[k]);
    mesh.castShadow = k !== 'lining' && k !== 'seat' && k !== 'pole';
    mesh.receiveShadow = true;
    if (['lining', 'seat', 'seatBase', 'pole', 'floor', 'glassStatic'].includes(k)) mesh.userData.noOutline = true;
    if (k === 'glassStatic') mesh.castShadow = false;
    car.add(mesh);
    if (k === 'roof' || k === 'skirt') hullOutline(mesh, { thickness: 0.0034 });
  }
  const lit = new THREE.Mesh(bake(lights), m.light);
  lit.userData.noOutline = true;
  car.add(lit);
  if (people.length) {
    const ppl = new THREE.Mesh(bake(people), m.person);
    ppl.userData.noOutline = true;
    car.add(ppl);
  }

  /* ---- wheels ---- */
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.14, 12);
  wheelGeo.rotateX(Math.PI / 2);
  for (const bx of [-6.3, 6.3]) {
    for (const wx of [-1.05, 1.05]) {
      for (const wz of [-0.62, 0.62]) {
        const hub = new THREE.Group();
        hub.position.set(bx + wx, RAIL_TOP + 0.43, wz);
        const axle = new THREE.Group();
        axle.add(new THREE.Mesh(wheelGeo, m.wheel));
        hub.add(axle);
        car.add(hub);
        wheels.push(axle);
      }
    }
  }
  return { car, wheels, leaves, dest };
}

/**
 * The two-car set.  Returns the group and its moving parts; line/service.js
 * places it and decides what it does.
 */
export function buildEmu(ctx, { cars = 2, seed = 2104 } = {}) {
  const rng = rngKit(seed);
  const group = new THREE.Group();
  group.name = 'train';
  ctx.add(group);
  const wheels = [], leaves = { 1: [], [-1]: [] }, dests = [];
  for (let i = 0; i < cars; i++) {
    const c = buildCar({ cab: i === 0, tail: i === cars - 1, rng });
    c.car.position.x = ((cars - 1) / 2 - i) * PITCH;       // the cab car leads, at +x
    group.add(c.car);
    wheels.push(...c.wheels);
    leaves[1].push(...c.leaves[1]);
    leaves[-1].push(...c.leaves[-1]);
    if (c.dest) dests.push(c.dest);
  }
  // batch the car bodies inside the set; wheels, doors and the destination boards move
  for (const w of wheels) w.userData.dynamic = true;
  mergeStatic(group);
  for (const w of wheels) w.userData.dynamic = false;
  group.userData.dynamic = true;

  let doorT = 0;
  return {
    group,
    length: PITCH * cars,
    wheels,
    /** 0 shut .. 1 open, on the platform side (local -z) */
    setDoors(t) {
      doorT = t;
      const e = t * t * (3 - 2 * t);
      for (const l of leaves[-1]) l.position.x = l.userData.half * (DOOR_W / 2) * e * 0.96;
    },
    get doors() { return doorT; },
    /** 0 by day .. 1 at night: the interior lights up. */
    setNight(k) {
      for (const m of mats().interior) m.emissiveIntensity = 0.62 * k;
    },
    setDest(dir) {
      for (const d of dests) d.material.map = destTex(dir);
    },
    spin(dist) {
      const a = dist / 0.43;
      for (const w of wheels) w.rotation.z -= a;
    },
  };
}
