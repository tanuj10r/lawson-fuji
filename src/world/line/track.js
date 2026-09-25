import * as THREE from 'three';
import { PAL } from '../../core/palette.js';
import { cel, flat } from '../../core/toon.js';
import { box, bake, trs } from '../../core/util.js';
import { TOWN } from '../../config.js';
import { meshFence } from '../ground.js';
import { gravelTex, GRAVEL_TILE } from '../kit/paint.js';

const ballastMap = () => gravelTex();
import { makeWires } from '../props.js';
import { buildGrove } from '../trees.js';
import { noEntryPlate } from '../town-tex.js';
import { RAIL_TOP } from '../railway.js';

/* ------------------------------------------------------------------ *
 * The line (SPEC section 3, station and trains): double track along the
 * town's south edge.  Track 1 (north, z - spacing/2) carries eastbound
 * trains and track 2 (south) westbound: trains keep left.
 *
 * Ballast, sleepers (instanced), rails, lineside mesh fences with the
 * station and the crossings let through, portal catenary gantries every
 * 40 m with messenger and contact wires, and the cuttings where the line
 * leaves town.  Everything the train needs to know is exported here.
 * ------------------------------------------------------------------ */

const R = TOWN.rail;
export const LINE_Z = R.z;
export const TRACK_Z = [R.z - R.spacing / 2, R.z + R.spacing / 2];   // track 1, track 2
export const GAUGE = R.gauge;
export const LINE_X = [-420, 420];
export const CONTACT_Y = 4.88;              // the train's pantograph reaches this
export const FENCE_OFF = 7.4;               // lineside fences, either side of the centre
const LOCAL = [-260, 260];                  // sleepers and gantries only this far: fog beyond

function mats() {
  return {
    ballast: cel({ color: 0xe8e4ee, map: ballastMap(), bands: 3, tint: 0x655d84, cache: false }),
    sleeper: cel({ color: PAL.sleeper, bands: 3, tint: 0x5d5878 }),
    rail: cel({ color: PAL.railMetal, bands: 3, tint: 0x5f5878 }),
    head: cel({ color: PAL.railHead, bands: 2, tint: 0x6f6890 }),
    mast: cel({ color: 0xa9aeb8, bands: 3, tint: 0x666090 }),
    beam: cel({ color: 0x8f95a2, bands: 3, tint: 0x5c5680 }),
    insulator: cel({ color: 0x6b5a4a, bands: 2, tint: 0x4b4560 }),
    wire: cel({ color: 0x3f3a4c, bands: 2, tint: 0x413c58 }),
    bank: cel({ color: 0x86ab84, bands: 3, tint: 0x5b6f8c }),
  };
}

/**
 * @param o.gaps  [{ x0, x1, side? }] where the lineside fences stop (crossings, the station)
 */
export function buildTrack(ctx, o = {}) {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'line';
  ctx.add(g);
  const [X0, X1] = LINE_X;
  const len = X1 - X0;

  /* ---- ballast: one bed under both tracks ---- */
  {
    const half = R.spacing / 2 + 1.7;
    const shape = new THREE.Shape();
    shape.moveTo(-half - 0.9, 0);
    shape.lineTo(-half, 0.2);
    shape.lineTo(half, 0.2);
    shape.lineTo(half + 0.9, 0);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
    geo.rotateY(Math.PI / 2);
    geo.translate(X0, 0, R.z);
    // the extrusion's UVs are in metres: scale them to the gravel's tile
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / GRAVEL_TILE, uv.getY(i) / GRAVEL_TILE);
    const b = new THREE.Mesh(geo, m.ballast);
    b.receiveShadow = true;
    b.userData.noOutline = true;
    g.add(b);
  }

  /* ---- sleepers (instanced) and rails ---- */
  {
    const step = 0.62;
    const n = Math.floor((LOCAL[1] - LOCAL[0]) / step);
    const sleeper = new THREE.BoxGeometry(0.22, 0.12, GAUGE + 0.9);
    const inst = new THREE.InstancedMesh(sleeper, m.sleeper, n * 2);
    const d = new THREE.Object3D();
    let k = 0;
    for (const tz of TRACK_Z) {
      for (let i = 0; i < n; i++) {
        d.position.set(LOCAL[0] + i * step, 0.24, tz);
        d.updateMatrix();
        inst.setMatrixAt(k++, d.matrix);
      }
    }
    inst.receiveShadow = true;
    inst.userData.noOutline = true;
    g.add(inst);
    const railParts = [];
    const headParts = [];
    for (const tz of TRACK_Z) {
      for (const s of [-1, 1]) {
        const z = tz + (s * GAUGE) / 2;
        railParts.push({ geometry: new THREE.BoxGeometry(len, 0.07, 0.06), matrix: trs(0, RAIL_TOP - 0.05, z) });
        headParts.push({ geometry: new THREE.BoxGeometry(len, 0.03, 0.075), matrix: trs(0, RAIL_TOP - 0.005, z) });
      }
    }
    const rails = new THREE.Mesh(bake(railParts), m.rail);
    const heads = new THREE.Mesh(bake(headParts), m.head);
    rails.position.x = heads.position.x = (X0 + X1) / 2;
    rails.userData.noOutline = heads.userData.noOutline = true;
    g.add(rails, heads);
  }

  /* ---- lineside fences, open where the gaps are ---- */
  const gaps = (o.gaps ?? []).slice().sort((a, b) => a.x0 - b.x0);
  const x0 = TOWN.core.x0, x1 = TOWN.core.x1;
  for (const s of [-1, 1]) {
    const sideGaps = gaps.filter((gp) => !gp.side || gp.side === s);
    let from = x0;
    for (const { x0: a, x1: b } of sideGaps) {
      if (a - from > 0.6) meshFence(ctx, { axis: 'x', from, to: a, at: R.z + s * FENCE_OFF, h: 1.5, spacing: 2.5 });
      from = Math.max(from, b);
    }
    if (x1 - from > 0.6) meshFence(ctx, { axis: 'x', from, to: x1, at: R.z + s * FENCE_OFF, h: 1.5, spacing: 2.5 });
  }

  /* ---- catenary: portal gantries every 40 m, wires between ---- */
  const gantryXs = [];
  // every 20 m, but none on the level crossing or behind the ticket gates,
  // and one just east of the gates so the platforms keep a mast mid-way
  const cross = TOWN.rail.crossX, gates = TOWN.station.stopX - 1;
  for (let x = -250; x <= LOCAL[1]; x += 20) {
    if (Math.abs(x - cross) < 6 || Math.abs(x - gates) < 6.5) continue;
    gantryXs.push(x);
  }
  gantryXs.push(gates + 9);
  gantryXs.sort((a, b) => a - b);
  {
    const parts = { mast: [], beam: [], ins: [] };
    const push = (k, geo, mx) => parts[k].push({ geometry: geo, matrix: mx });
    const mastOff = FENCE_OFF - 0.6, top = 6.3;
    for (const x of gantryXs) {
      for (const s of [-1, 1]) {
        push('mast', new THREE.BoxGeometry(0.28, top, 0.28), trs(x, top / 2, R.z + s * mastOff));
        push('mast', new THREE.BoxGeometry(0.5, 0.2, 0.5), trs(x, 0.1, R.z + s * mastOff));
      }
      // the lattice beam across both tracks: two chords and diagonals
      const span = mastOff * 2;
      for (const y of [top - 0.1, top - 0.7]) push('beam', new THREE.BoxGeometry(0.12, 0.12, span + 0.4), trs(x, y, R.z));
      for (let i = 0; i < 10; i++) {
        const z = R.z - mastOff + (span * (i + 0.5)) / 10;
        push('beam', new THREE.BoxGeometry(0.05, 0.72, 0.05), trs(x, top - 0.4, z, (i % 2 ? 1 : -1) * 0.6, 0, 0));
      }
      // drop arms and insulators over each track
      for (const tz of TRACK_Z) {
        push('beam', new THREE.BoxGeometry(0.06, top - 0.7 - CONTACT_Y - 0.9, 0.06), trs(x, (top - 0.7 + CONTACT_Y + 0.9) / 2, tz));
        push('ins', new THREE.CylinderGeometry(0.07, 0.07, 0.36, 8), trs(x, CONTACT_Y + 1.1, tz));
        push('beam', new THREE.BoxGeometry(0.05, 0.05, 0.9), trs(x, CONTACT_Y + 0.02, tz - 0.4, 0, 0, 0));
      }
    }
    const matFor = { mast: m.mast, beam: m.beam, ins: m.insulator };
    for (const [k, list] of Object.entries(parts)) {
      const mesh = new THREE.Mesh(bake(list), matFor[k]);
      mesh.castShadow = true;
      g.add(mesh);
    }
    for (const x of gantryXs) {
      for (const s of [-1, 1]) {
        const z = R.z + s * mastOff;
        if (x > x0 && x < x1) {
          ctx.collide(x - 0.25, z - 0.25, x + 0.25, z + 0.25, top);
          ctx.registry?.push({ kind: 'pole', x, z });     // a pole with wires, like any other
        }
      }
    }
    // contact wires straight, messengers sagging between gantries
    const straight = [];
    for (const tz of TRACK_Z) {
      straight.push({ geometry: new THREE.BoxGeometry(len, 0.025, 0.025), matrix: trs(0, CONTACT_Y, tz) });
    }
    const cw = new THREE.Mesh(bake(straight), m.wire);
    cw.position.x = (X0 + X1) / 2;
    cw.userData.noOutline = true;
    g.add(cw);
    const runs = TRACK_Z.map((tz) => ({
      points: gantryXs.map((x) => new THREE.Vector3(x, CONTACT_Y + 0.95, tz)), sag: 0.7, r: 0.018,
    }));
    makeWires(ctx, runs, { seg: 8, radial: 3 });
  }

  /* ---- cuttings where the line leaves town, and the right-of-way ---- */
  {
    const spots = [];
    for (const [a, b] of [[-440, TOWN.bounds.x0 + 12], [TOWN.bounds.x1 - 12, 460]]) {
      for (const s of [-1, 1]) {
        const shape = new THREE.Shape();
        const u = (v) => -s * v;
        shape.moveTo(u(FENCE_OFF + 1), 0);
        shape.lineTo(u(26), 0);
        shape.lineTo(u(22), 5.2);
        shape.lineTo(u(14), 5.2);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: b - a, bevelEnabled: false });
        geo.rotateY(Math.PI / 2);
        const bank = new THREE.Mesh(geo, m.bank);
        bank.position.set(a, 0, R.z);
        bank.receiveShadow = bank.castShadow = true;
        bank.userData.noOutline = true;
        g.add(bank);
        for (let x = a + 4; x < b; x += 11) {
          spots.push({ x, z: R.z + s * (17 + ((x * 7) % 5)), y: 5.2, scale: 1.1 + ((x * 13) % 7) / 14, seed: 900 + spots.length, far: x < 0 });
        }
      }
    }
    for (const west of [true, false]) {
      buildGrove(ctx, spots.filter((p) => Math.abs(p.x) < 240 && (p.x < 0) === west), { far: true });
    }
    // where the line leaves the core: posts, the plate, no walking down it
    const post = cel({ color: 0xb8bcc6, bands: 3, tint: 0x666090 });
    for (const ex of [x0, x1]) {
      for (const s of [-1, 1]) {
        g.add(box(0.12, 1.3, 1.2, post, ex, 0.65, R.z + s * (FENCE_OFF - 0.6)));
      }
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.0), flat({ map: noEntryPlate(), side: THREE.DoubleSide, cache: false }));
      plate.position.set(ex, 1.4, R.z - FENCE_OFF + 0.9);
      plate.rotation.y = Math.PI / 2;
      g.add(plate);
      ctx.collide(ex - 0.2, R.z - FENCE_OFF, ex + 0.2, R.z + FENCE_OFF, 2.0);
    }
  }

  return { group: g, gantryXs };
}
