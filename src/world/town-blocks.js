import * as THREE from 'three';
import { cel, flat } from '../core/toon.js';
import { box, trs, bake } from '../core/util.js';
import { hullOutline } from '../core/outline.js';
import { TOWN, STREET, LAWSON } from '../config.js';
import { makeHouse, makeWall, makeTimberFence, makeBlockFence } from './buildings.js';
import { makeShop, makePaperLantern } from './shops.js';
import { buildSakura, buildGrove, buildShrubs } from './trees.js';
import {
  makePole, makeWires, makeBicycle, makePlanter, makeGuardrail, makeBarrier, makeCone,
  makeBench, makeTapPost, makeLaundryPole, makeBikeRack, makeSignPost, makeAircon,
} from './props.js';
import { addVending } from './vending.js';
import { parkVehicle } from './vehicles.js';
import { buildSignals } from './signals.js';
import { archBoard, closedBoard, binLabel, fieldTex } from './town-tex.js';
import { stationSign } from '../core/textures.js';

/* ------------------------------------------------------------------ *
 * The compact town (SPEC section 3), built round the approved M1 view.
 *
 * Placement rules that protect the famous views (keys 1, 2, 3, standing at
 * (0, 16.5) looking -Z through a 70° lens): nothing new in front of the
 * storefront, the sign or Fuji's cone; poles and wires stay outside the
 * frame or pass above its top; what shows at the frame's edges is low town
 * (roofs, a tree, the far tree line) against sky and horizon.  The Lawson's
 * vending machines, bins and parked cars stand beside the store and in the
 * outer bays, out of shot.
 * ------------------------------------------------------------------ */

const K = 0.15;   // kerb height of every raised walk

const MAT = {
  asphalt: () => cel({ color: 0x4a4e63, bands: 3, tint: 0x5a5480 }),
  road: () => cel({ color: 0x43475b, bands: 3, tint: 0x5a5480 }),
  lane: () => cel({ color: 0x53576a, bands: 3, tint: 0x5a5480 }),
  walk: () => cel({ color: 0xb6b8c4, bands: 3 }),
  kerb: () => cel({ color: 0xd2d3da, bands: 3 }),
  paving: () => cel({ color: 0xcfc6b8, bands: 3, tint: 0x6f6790 }),
  lawn: () => cel({ color: 0x9cc48f, bands: 3, tint: 0x5b6f8c }),
  gravel: () => cel({ color: 0xc9bfae, bands: 3, tint: 0x6f6790 }),
  paint: () => cel({ color: 0xf2f2f5, bands: 3 }),
};

function slab(x0, x1, y0, y1, z0, z1, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.receiveShadow = true;
  return m;
}

function patch(x0, x1, z0, z1, y, mat) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  return m;
}

/** A raised walk: slab, kerb face, walkable platform. */
function walk(ctx, x0, x1, z0, z1, mat) {
  ctx.add(slab(x0, x1, 0, K, z0, z1, mat));
  ctx.platform({ x0, x1, z0, z1, top: K });
}

export function buildBlocks(ctx) {
  const B = TOWN.bounds;
  const S = STREET;
  const out = { vending: [] };
  const mats = Object.fromEntries(Object.entries(MAT).map(([k, f]) => [k, f()]));

  /* ============================== roads & walks ============================== */
  // north walk along the main road, either side of the forecourt
  for (const [x0, x1] of [[S.roadX0 + 7, S.x0], [S.x1, S.roadX1 - 7]]) {
    walk(ctx, x0, x1, 8.3, S.forecourtZ, mats.walk);
  }
  // the side road south to the level crossing, with a walk each side
  {
    const R = TOWN.sideRoad;
    const hw = 3.15, ww = 1.55;
    ctx.add(patch(R.x - hw, R.x + hw, S.sidewalkZ, R.z1, 0.004, mats.road));
    const band = [TOWN.rail.z - 3.35, TOWN.rail.z + 3.35];
    for (const s of [-1, 1]) {
      const xa = R.x + s * hw, xb = R.x + s * (hw + ww);
      for (const [z0, z1] of [[S.sidewalkZ, band[0]], [band[1], R.z1]]) {
        walk(ctx, Math.min(xa, xb), Math.max(xa, xb), z0, z1, mats.walk);
      }
      ctx.add(patch(Math.min(xa, xb), Math.max(xa, xb), band[0], band[1], 0.004, mats.road));
    }
    // road end: guardrail, then the trees
    ctx.add(makeGuardrail({ x: R.x, z: R.z1 - 0.3, y: 0, ry: 0, len: 9.6 }));
    ctx.collide(R.x - 4.9, R.z1 - 0.5, R.x + 4.9, R.z1 - 0.1, 1.0);
    // centre line
    const parts = [];
    for (let z = S.sidewalkZ + 1; z < R.z1 - 2; z += 6) {
      if (Math.abs(z - TOWN.rail.z) < 8) continue;
      const g = new THREE.PlaneGeometry(0.15, 3);
      g.rotateX(-Math.PI / 2);
      parts.push({ geometry: g, matrix: trs(R.x, 0.012, z + 1.5) });
    }
    ctx.add(new THREE.Mesh(bake(parts), mats.paint));
    // path from the road to the station steps
    walk(ctx, R.x + hw + ww, 43.4, 53.8, 56.45, mats.paving);
  }
  // the main road's ends: barricaded, trees beyond
  for (const sx of [-1, 1]) {
    const x = sx * 118;
    for (const z of [11.8, 15.9]) {
      ctx.add(makeBarrier({ x, z, y: 0, ry: Math.PI / 2, len: 2.6 }));
    }
    ctx.add(makeCone({ x: x - sx * 1.2, z: 13.85, y: 0 }));
    ctx.add(makeCone({ x: x - sx * 1.0, z: 12.6, y: 0 }));
    for (const [cx, cz] of [[x - sx * 1.2, 13.85], [x - sx * 1.0, 12.6]]) ctx.collide(cx - 0.2, cz - 0.2, cx + 0.2, cz + 0.2, 0.7);
    ctx.add(makeSignPost({
      x, z: 13.85, y: 0, h: 1.6,
      plates: [{ map: closedBoard(), w: 1.0, h: 0.5, y: 1.25, ry: sx < 0 ? Math.PI / 2 : -Math.PI / 2, double: true }],
    }));
    ctx.collide(x - 0.3, 8.3, x + 0.3, 20.5, 1.2);
  }

  /* ========================= crosswalk and signals ========================= */
  buildSignals(ctx, { x: TOWN.crosswalk.x, zNear: S.forecourtZ, zFar: S.roadZ, width: TOWN.crosswalk.width });

  /* =============================== the Lawson =============================== */
  const hw = LAWSON.width / 2;
  {
    // two vending machines and the bin station against the store's left
    // side wall, behind its front corner from the famous view
    out.vending.push(addVending(ctx, { x: -hw - 0.6, z: -4.2, ry: -Math.PI / 2, variant: 0, seed: 11 }));
    out.vending.push(addVending(ctx, { x: -hw - 0.6, z: -5.4, ry: -Math.PI / 2, variant: 1, seed: 12 }));
    const lid = [0xd8453f, 0x2a78c8, 0x3aa25a];
    const body = cel({ color: 0xe9ebef, bands: 3 });
    for (let i = 0; i < 3; i++) {
      const z = -2.2 - i * 0.62;
      ctx.add(slab(-hw - 0.55, -hw - 0.02, 0, 1.0, z - 0.28, z + 0.28, body));
      ctx.add(slab(-hw - 0.57, -hw - 0.02, 1.0, 1.06, z - 0.29, z + 0.29, cel({ color: lid[i], bands: 3 })));
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), flat({ map: binLabel(i) }));
      label.position.set(-hw - 0.56, 0.72, z);
      label.rotation.y = -Math.PI / 2;
      ctx.add(label);
    }
    ctx.collide(-hw - 0.6, -3.8, -hw, -1.9, 1.06);
    ctx.add(makeBikeRack({ x: -hw - 1.2, z: -8.2, y: 0, ry: Math.PI / 2 }));
    ctx.add(makeBicycle({ x: -hw - 1.3, z: -7.6, y: 0, ry: Math.PI, lean: 0.06, color: 0x3f6f9c }));
    ctx.collide(-hw - 2.2, -9.4, -hw - 0.4, -6.8, 1.0);

    // kei cars in the outer bays, nosed in toward the store (mood reference 2)
    const cars = [
      { x: -12.85, color: 0xf2eee6 }, { x: -15.55, color: 0xd9665a },
      { x: 14.15, color: 0x9fc0dc }, { x: 16.85, color: 0xa8d4b4 },
    ];
    for (const c of cars) parkVehicle(ctx, { kind: 'kei', x: c.x, z: 5.1, y: 0, ry: 0, color: c.color });
  }

  /* ============================ shopping street ============================ */
  {
    const T = TOWN.shotengai;
    const z = T.laneZ;
    ctx.add(patch(T.x0, T.x1, z - 3, z + 3, 0.006, mats.paving));
    // plaza joining the lane to the lot
    ctx.add(patch(S.lotX0 - 4, S.lotX0 + 10, S.lotZ - 2, z + 4, 0.005, mats.paving));
    const north = [
      { x: -46, kind: 'hardware', w: 7.4, awning: 2 },
      { x: -58, kind: 'cafe', w: 7.0, awning: 3, blade: true },
      { x: -70, shutter: 1, w: 7.2 },
      { x: -82, kind: 'books', w: 7.6, awning: 0 },
      { x: -94, kind: 'florist', w: 7.0, awning: 0, blade: true },
    ];
    const south = [
      { x: -48, kind: 'bakery', w: 7.2, awning: 1, blade: true },
      { x: -61, kind: 'soba', w: 7.4, noren: 'soba' },
      { x: -74, kind: 'greengrocer', w: 7.6, awning: 4 },
      { x: -87, shutter: 1, w: 7.0 },
    ];
    const d = 6.5;
    north.forEach((o, i) => makeShop(ctx, {
      ...o, z: z - 3 - d / 2, y: 0, d, face: 'z+', floors: i % 2 ? 2 : 1, seed: 510 + i,
      roofKind: i % 2 ? 'flat' : 'gable', shutter: o.shutter ?? 0, awning: o.awning ?? false,
      wall: (i * 2) % 6, roof: i % 4, lit: true,
    }));
    south.forEach((o, i) => makeShop(ctx, {
      ...o, z: z + 3 + d / 2, y: 0, d, face: 'z-', floors: i % 2 ? 1 : 2, seed: 530 + i,
      roofKind: i % 2 ? 'gable' : 'flat', shutter: o.shutter ?? 0, awning: o.awning ?? false,
      wall: (i * 2 + 1) % 6, roof: (i + 2) % 4, lit: true,
    }));

    // the arch over the entrance
    {
      const post = cel({ color: 0xb5322f, bands: 3, tint: 0x7a4060 });
      const ax = T.x1 - 0.5;
      for (const s of [-1, 1]) {
        ctx.add(box(0.3, 4.6, 0.3, post, ax, 2.3, z + s * 3.2));
        ctx.collide(ax - 0.2, z + s * 3.2 - 0.2, ax + 0.2, z + s * 3.2 + 0.2, 4.6);
      }
      const beam = box(0.3, 0.9, 7.2, cel({ color: 0xf7f1e2, bands: 3 }), ax, 4.4, z);
      ctx.add(beam);
      hullOutline(beam, { thickness: 0.003 });
      for (const s of [-1, 1]) {
        const board = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 0.8), flat({ map: archBoard() }));
        board.position.set(ax + s * 0.16, 4.4, z);
        board.rotation.y = s * Math.PI / 2;
        ctx.add(board);
      }
    }

    // lantern strings down the lane
    {
      const runs = [];
      const lanterns = [];
      const shared = new Map();
      for (const s of [-1, 1]) {
        const zz = z + s * 2.2;
        runs.push({ points: [new THREE.Vector3(T.x0 + 2, 3.7, zz), new THREE.Vector3(T.x1 - 1, 3.7, zz)], sag: 0.35, r: 0.012 });
        let i = 0;
        for (let x = T.x1 - 3; x > T.x0 + 3; x -= 2.6, i++) {
          const variant = (i + (s > 0 ? 1 : 0)) % 5;
          const l = makePaperLantern({ x, z: zz, y: 3.62, variant, lit: true, drop: 0.12 });
          // one material per variant, not per lantern
          const body = l.children[0];
          if (!shared.has(variant)) shared.set(variant, body.material);
          else body.material = shared.get(variant);
          lanterns.push(l);
          ctx.add(l);
        }
      }
      makeWires(ctx, runs);
    }

    // the west end closes with a fence and trees
    ctx.add(makeTimberFence({ x: T.x0 - 0.5, z, y: 0, len: 6.4, axis: 'z', h: 1.6 }));
    ctx.collide(T.x0 - 0.8, z - 3.2, T.x0 - 0.2, z + 3.2, 1.6);

    out.vending.push(addVending(ctx, { x: T.x1 + 2.2, z: z + 4.4, ry: Math.PI, variant: 2, seed: 13 }));
  }

  /* ============================ residential lane ============================ */
  {
    const R = TOWN.residential;
    const z = R.laneZ;
    ctx.add(patch(R.laneX0, R.sideLaneX + 2.5, z - 2.5, z + 2.5, 0.005, mats.lane));
    ctx.add(patch(R.sideLaneX - 2.5, R.sideLaneX + 2.5, z + 2.5, 0, 0.005, mats.lane));
    ctx.add(makeTimberFence({ x: R.laneX0 - 0.4, z, y: 0, len: 5.2, axis: 'z', h: 1.6 }));
    ctx.collide(R.laneX0 - 0.7, z - 2.6, R.laneX0 - 0.1, z + 2.6, 1.6);

    const xs = [-32, -45, -58, -71, -84, -97];
    const widths = [7.4, 6.6, 7.2, 6.8, 7.4, 6.6];
    const fenceKinds = [makeBlockFence, makeTimberFence, makeWall];
    const bikeCols = [0x3f6f9c, 0xd8a03c, 0x9c5a4a, 0x4f8f6a, 0xe8e2d4, 0x8f6fb5];
    let n = 0;
    for (const side of [1, -1]) {                 // 1: between lane and main road
      xs.forEach((x, i) => {
        const w = widths[(i + (side > 0 ? 0 : 3)) % widths.length];
        const dd = 7.0;
        const hz = side > 0 ? z + 2.5 + 2.2 + dd / 2 : z - 2.5 - 2.2 - dd / 2;
        const seed = 600 + n;
        const floors = (i + (side > 0 ? 0 : 1)) % 3 === 0 ? 1 : 2;
        ctx.add(makeHouse({
          x, z: hz, y: 0, w, d: dd, face: side > 0 ? 'z-' : 'z+', floors, seed,
          wall: (n * 3) % 8, roof: n % 4, roofKind: ['gable', 'hip', 'gable', 'flat'][n % 4],
        }));
        ctx.collide(x - w / 2 - 0.1, hz - dd / 2 - 0.1, x + w / 2 + 0.1, hz + dd / 2 + 0.1, 2.72 * floors);
        // garden wall along the lane, with the gate gap on one side
        const fz = side > 0 ? z + 2.5 + 0.35 : z - 2.5 - 0.35;
        const gate = (n % 2 ? 1 : -1) * (w / 2 - 1.1);
        const segs = [[x - w / 2 - 0.4, x + gate - 0.6], [x + gate + 0.6, x + w / 2 + 0.4]];
        for (const [a, b] of segs) {
          if (b - a < 0.6) continue;
          const f = fenceKinds[n % 3]({ x: (a + b) / 2, z: fz, y: 0, len: b - a, axis: 'x', h: 0.8, fence: n % 2 === 0 });
          ctx.add(f);
          ctx.collide(a, fz - 0.18, b, fz + 0.18, f.userData.top ?? 1.0);
        }
        // the garden: a bicycle by the gate, pots, washing on the side
        const gz = (fz + (side > 0 ? hz - dd / 2 : hz + dd / 2)) / 2;
        ctx.add(makeBicycle({ x: x + gate, z: gz, y: 0, ry: Math.PI / 2 + 0.1 * side, lean: 0.07, color: bikeCols[n % bikeCols.length] }));
        ctx.collide(x + gate - 0.3, gz - 0.9, x + gate + 0.3, gz + 0.9, 1.0);
        ctx.add(makePlanter({ x: x - gate * 0.5, z: gz, y: 0, r: 0.22, flower: true, seed: 700 + n, n: 5 }));
        ctx.add(makePlanter({ x: x - gate * 0.5 + 0.6, z: gz + 0.2, y: 0, r: 0.18, flower: n % 2 === 0, seed: 720 + n, n: 4 }));
        ctx.collide(x - gate * 0.5 - 0.3, gz - 0.3, x - gate * 0.5 + 0.85, gz + 0.45, 0.7);
        if (n % 3 !== 1) {
          ctx.add(makeLaundryPole({ x: x + w / 2 + 0.9, z: hz, y: 0, ry: Math.PI / 2, len: 2.4, h: 1.9, seed: 740 + n }));
          ctx.collide(x + w / 2 + 0.6, hz - 1.3, x + w / 2 + 1.2, hz + 1.3, 1.9);
        }
        if (n % 2) {
          ctx.add(makeAircon({ x: x - w / 2 - 0.35, z: hz + 1.2, y: 0, ry: -Math.PI / 2 }));
          ctx.collide(x - w / 2 - 0.75, hz + 0.7, x - w / 2, hz + 1.7, 0.8);
        }
        n++;
      });
    }
  }

  /* ============================ fields and fill ============================
   * The open ground between the zones is farmland, which is what the edge of
   * a town under Fuji actually is: three vegetable fields. */
  {
    const fields = [
      [-114, -42, -24, 4, 0],     // west, between the lane and the main road
      [76, 114, -56, -6, 1],      // east of the park
      [44, 112, 22, 48, 0],       // south-east, short of the station
    ];
    for (const [x0, x1, z0, z1, v] of fields) {
      const tex = fieldTex(v).clone();
      tex.repeat.set((x1 - x0) / 8, (z1 - z0) / 8);
      tex.needsUpdate = true;
      const f = patch(x0, x1, z0, z1, 0.007, cel({ color: 0xffffff, bands: 3, tint: 0x6f5a80, map: tex }));
      ctx.add(f);
      // a low ridge of earth round each, so the edge reads
      for (const [a, b, c, d] of [[x0, x1, z0 - 0.3, z0], [x0, x1, z1, z1 + 0.3], [x0 - 0.3, x0, z0, z1], [x1, x1 + 0.3, z0, z1]]) {
        ctx.add(slab(a, b, 0, 0.12, c, d, mats.gravel));
      }
    }

    /* Two single-storey houses behind the store.  From the famous views they
     * stand below the Lawson's roofline and inside its width, so they never
     * show; from everywhere else they close the gap behind it. */
    [[-4, -24, 7.2, 1601], [7.5, -26, 6.8, 1602]].forEach(([x, z, w, seed], i) => {
      ctx.add(makeHouse({ x, z, y: 0, w, d: 6.6, face: 'z+', floors: 1, seed, wall: 3 + i * 2, roof: i + 1, roofKind: 'hip' }));
      ctx.collide(x - w / 2 - 0.1, z - 3.4, x + w / 2 + 0.1, z + 3.4, 2.72);
    });

    // the photographers' lot: painted bays and two cars, behind the famous view
    {
      const parts = [];
      const line = (x0, x1, z0, z1) => {
        const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
        g.rotateX(-Math.PI / 2);
        parts.push({ geometry: g, matrix: trs((x0 + x1) / 2, 0.012, (z0 + z1) / 2) });
      };
      for (let x = -36; x <= -8; x += 2.6) line(x - 0.06, x + 0.06, 30.5, 35.5);
      line(-36, -8, 35.4, 35.52);
      ctx.add(new THREE.Mesh(bake(parts), mats.paint));
      parkVehicle(ctx, { kind: 'kei', x: -32.1, z: 33.0, y: 0, ry: Math.PI, color: 0xe9dfc6 });
      parkVehicle(ctx, { kind: 'hatch', x: -18.9, z: 33.0, y: 0, ry: Math.PI, color: 0x7f93a4 });
    }

    // the station's name, facing the town at the foot of its path
    ctx.add(makeSignPost({
      x: TOWN.sideRoad.x + 5.3, z: 53.2, y: 0, h: 2.8,
      plates: [{ map: stationSign(), w: 1.9, h: 0.48, y: 2.5, ry: Math.PI / 2, double: true }],
    }));
    ctx.collide(TOWN.sideRoad.x + 5.1, 53.0, TOWN.sideRoad.x + 5.5, 53.4, 2.8);
  }

  /* ================================== park ================================== */
  {
    const P = TOWN.park;
    ctx.add(patch(P.x0, P.x1, P.z0, P.z1, 0.006, mats.lawn));
    const midX = (P.x0 + P.x1) / 2, midZ = (P.z0 + P.z1) / 2;
    ctx.add(patch(midX - 1.1, midX + 1.1, P.z0, 8.3, 0.009, mats.gravel));   // path in from the walk
    ctx.add(patch(P.x0, P.x1, midZ - 1.1, midZ + 1.1, 0.009, mats.gravel));
    // low fence with openings on the paths
    const fences = [
      [P.x0, midX - 1.4, P.z1, 'x'], [midX + 1.4, P.x1, P.z1, 'x'],
      [P.x0, P.x1, P.z0, 'x'],
      [P.z0, midZ - 1.4, P.x0, 'z'], [midZ + 1.4, P.z1, P.x0, 'z'],
      [P.z0, midZ - 1.4, P.x1, 'z'], [midZ + 1.4, P.z1, P.x1, 'z'],
    ];
    for (const [a, b, at, axis] of fences) {
      const c = (a + b) / 2;
      const f = makeTimberFence(axis === 'x'
        ? { x: c, z: at, y: 0, len: b - a, axis: 'x', h: 0.7 }
        : { x: at, z: c, y: 0, len: b - a, axis: 'z', h: 0.7 });
      ctx.add(f);
      if (axis === 'x') ctx.collide(a, at - 0.15, b, at + 0.15, 0.9);
      else ctx.collide(at - 0.15, a, at + 0.15, b, 0.9);
    }
    for (const [x, z, ry] of [[midX - 6, midZ - 1.9, 0], [midX + 7, midZ + 1.9, Math.PI], [midX - 1.9, P.z0 + 12, Math.PI / 2]]) {
      ctx.add(makeBench({ x, z, y: 0, ry, len: 1.8 }));
      const c = Math.abs(Math.sin(ry)) > 0.5;
      ctx.collide(x - (c ? 0.35 : 0.95), z - (c ? 0.95 : 0.35), x + (c ? 0.35 : 0.95), z + (c ? 0.95 : 0.35), 0.8);
    }
    // the drinking fountain
    ctx.add(makeTapPost({ x: midX + 2.2, z: midZ + 2.4, y: 0, h: 0.9 }));
    ctx.collide(midX + 1.9, midZ + 2.1, midX + 2.5, midZ + 2.7, 1.0);
    const shrubs = [
      { x: P.x0 + 3, z: P.z1 - 3, r: 0.6, count: 5, spread: 2.2, seed: 811, y: 0 },
      { x: P.x1 - 3, z: P.z1 - 3, r: 0.6, count: 5, spread: 2.2, seed: 812, y: 0 },
      { x: P.x0 + 3, z: P.z0 + 3, r: 0.6, count: 5, spread: 2.2, seed: 813, y: 0 },
      { x: P.x1 - 4, z: P.z0 + 4, r: 0.6, count: 5, spread: 2.2, seed: 814, y: 0 },
    ];
    buildShrubs(ctx, shrubs);
    for (const b of shrubs) ctx.collide(b.x - b.spread / 2 - 0.4, b.z - b.spread / 2 - 0.4, b.x + b.spread / 2 + 0.4, b.z + b.spread / 2 + 0.4, 1.0);
  }

  /* ================================= sakura ================================= */
  {
    const spots = [
      // the frame's left edge, behind the store's corner, kept low (mood ref 2)
      { x: -17.5, z: -9.5, scale: 0.82, seed: 1101, lean: 0.08 },
      // right of the store, just outside the frame
      { x: 20.0, z: -5.0, scale: 1.0, seed: 1102, lean: 0.1 },
      // the park
      { x: 30, z: -20, scale: 1.15, seed: 1103, lean: 0.07 },
      { x: 42, z: -17, scale: 1.05, seed: 1104, lean: 0.1 },
      { x: 58, z: -22, scale: 1.2, seed: 1105, lean: 0.06 },
      { x: 33, z: -45, scale: 1.1, seed: 1106, lean: 0.09 },
      { x: 50, z: -50, scale: 1.25, seed: 1107, lean: 0.05 },
      { x: 63, z: -40, scale: 1.0, seed: 1108, lean: 0.08 },
      // the plaza, the side road and the station
      { x: -34, z: 47.5, scale: 1.0, seed: 1109, lean: 0.07 },
      { x: 21.5, z: 46, scale: 1.1, seed: 1110, lean: 0.08 },
      { x: 40.5, z: 30, scale: 0.95, seed: 1111, lean: 0.09 },
      { x: 41, z: 50.5, scale: 1.05, seed: 1112, lean: 0.06 },
    ];
    buildSakura(ctx, spots.map((s) => ({ ...s, y: 0 })));
    for (const s of spots) ctx.collide(s.x - 0.3, s.z - 0.3, s.x + 0.3, s.z + 0.3, 2.5);
  }

  /* ============================ poles and wires ============================ */
  {
    const poles = [];
    const pole = (x, z, h, seed, o = {}) => {
      const y = ctx.heightAt(x, z);
      ctx.add(makePole({ x, z, y, h, seed, ...o }));
      ctx.collide(x - 0.22, z - 0.22, x + 0.22, z + 0.22, y + h);
      poles.push({ x, z, top: y + h });
      return poles.length - 1;
    };
    /* No poles along the Lawson's own frontage: at golden hour the low sun
     * laid the nearest pair's shadow across the sign.  The real store has
     * no overhead lines in front of it either. */
    const north = [-104, -74, -44, 44, 74, 104].map((x, i) => pole(x, 9.4, 9.2, 1201 + i, { lamp: i % 2 === 0, armDir: 1 }));
    const south = [-100, -70, -40, -10, 20, 50, 80, 110].map((x, i) => pole(x, 18.7, 9.0, 1221 + i, { lamp: i % 2 === 1, armDir: -1 }));
    const res = [-48, -73, -98].map((x, i) => pole(x, TOWN.residential.laneZ - 3.1, 8.6, 1241 + i, { lamp: true, armDir: 1 }));
    const side = [26, 46, 76].map((z, i) => pole(TOWN.sideRoad.x + 5.1, z, 8.8, 1251 + i, { lamp: true, armDir: -1 }));

    const at = (i, dy = 0, dz = 0) => new THREE.Vector3(poles[i].x, poles[i].top - 0.6 + dy, poles[i].z + dz);
    const runs = [];
    const chain = (idx, offsets, sag = 0.55) => {
      for (const [dy, dz] of offsets) runs.push({ points: idx.map((i) => at(i, dy, dz)), sag });
    };
    chain(north.slice(0, 3), [[0, -0.6], [-0.42, 0], [-0.86, 0.6]]);
    chain(north.slice(3), [[0, -0.6], [-0.42, 0], [-0.86, 0.6]]);
    chain(south, [[0, -0.6], [-0.42, 0], [-0.86, 0.6]]);
    chain(res, [[0, -0.5], [-0.5, 0.5]]);
    chain(side, [[0, -0.5], [-0.5, 0.5]]);
    // across the road and out to the lanes
    chain([north[0], south[0]], [[-0.2, 0], [-0.7, 0]]);
    chain([north[2], south[2]], [[-0.2, 0]]);
    chain([north[3], south[5]], [[-0.2, 0], [-0.7, 0]]);
    chain([north[5], south[7]], [[-0.2, 0]]);
    chain([north[2], res[0]], [[-1.2, 0]]);
    chain([south[4], side[0]], [[-0.3, 0], [-0.8, 0]]);
    makeWires(ctx, runs);
  }

  /* ============================== the town edge ==============================
   * Tree lines and a low fence all round; the clamp on the player sits on the
   * fence line, so the edge is always something you can see. */
  {
    // one grove per edge, so each can be culled on its own
    const row = (x0, z0, x1, z1, step, seed) => {
      const spots = [];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / step));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const j = ((i * 37 + seed) % 11) / 11 - 0.5;
        spots.push({
          x: x0 + (x1 - x0) * t + (z1 !== z0 ? j * 3 : 0),
          z: z0 + (z1 - z0) * t + (x1 !== x0 ? j * 3 : 0),
          y: 0, scale: 1.25 + ((i * 13 + seed) % 7) / 10, seed: seed + i,
        });
      }
      buildGrove(ctx, spots, { far: true });
    };
    for (let k = 0; k < 3; k++) {                                // north, in three runs
      const xa = B.x0 + 2 + ((B.x1 - B.x0 - 4) * k) / 3, xb = B.x0 + 2 + ((B.x1 - B.x0 - 4) * (k + 1)) / 3;
      row(xa, B.z0 - 3, xb, B.z0 - 3, 10, 3000 + k * 40);
    }
    row(B.x0 - 3, B.z0, B.x0 - 3, 44, 11, 3200);               // west, down to the cutting
    row(B.x1 + 3, B.z0, B.x1 + 3, 44, 11, 3300);               // east
    for (let k = 0; k < 2; k++) {                                // south
      const xa = B.x0 + 2 + ((B.x1 - B.x0 - 4) * k) / 2, xb = B.x0 + 2 + ((B.x1 - B.x0 - 4) * (k + 1)) / 2;
      row(xa, B.z1 + 3, xb, B.z1 + 3, 11, 3400 + k * 40);
    }
    // across the main road's ends, behind the barricades
    for (const sx of [-1, 1]) {
      buildGrove(ctx, [9, 13, 17, 21].map((z) => ({ x: sx * 123.5, z, y: 0, scale: 1.4, seed: 3500 + z + (sx > 0 ? 50 : 0) })), { far: true });
    }

    const fence = (x0, z0, x1, z1) => {
      const axis = x0 === x1 ? 'z' : 'x';
      const len = axis === 'x' ? x1 - x0 : z1 - z0;
      ctx.add(makeTimberFence({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, y: 0, len, axis, h: 1.2 }));
    };
    fence(B.x0, B.z0, B.x1, B.z0);
    fence(B.x0, B.z1, B.x1, B.z1);
    fence(B.x0, B.z0, B.x0, 8.0);
    fence(B.x1, B.z0, B.x1, 8.0);
    fence(B.x0, 21, B.x0, 36);
    fence(B.x1, 21, B.x1, 36);
    fence(B.x0, 84, B.x0, B.z1);
    fence(B.x1, 84, B.x1, B.z1);
  }

  return out;
}
