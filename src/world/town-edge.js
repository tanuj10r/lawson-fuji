import * as THREE from 'three';
import { cel, flat } from '../core/toon.js';
import { TOWN, STREET, LAWSON, mainRoadGaps } from '../config.js';
import { makeTimberFence } from './buildings.js';
import { buildGrove } from './trees.js';
import {
  makePole, makeWires, makeBicycle, makeBarrier, makeCone, makeBikeRack, makeSignPost,
} from './props.js';
import { addVending } from './vending.js';
import { parkVehicle } from './vehicles.js';
import { buildSignals } from './signals.js';
import { closedBoard, binLabel } from './town-tex.js';

/* ------------------------------------------------------------------ *
 * The town's north side (SPEC section 3): M2's frame-edge blocks, kept
 * exactly as they were, because they are what shows at the edges of the
 * famous views.  The residential lane behind-left, the park behind-right,
 * the two low houses behind the store, the Lawson's own dressing, the main
 * road's north walk, its crossing and barricades, and the north tree line.
 * The dense core south of the main road is world/town-plan.js.
 *
 * Placement rules that protect the famous views (keys 1, 2, 3, standing at
 * (0, 16.5) looking -Z through a 70° lens): nothing new in front of the
 * storefront, the sign or Fuji's cone; poles and wires stay outside the
 * frame or pass above its top; what shows at the frame's edges is low town
 * (roofs, a tree, the far tree line) against sky and horizon.
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

/* M2e.3 split this file in two.  The town now stands north of the main
 * road, built turned (world/ctx.js `turned`), and M2's north side swung
 * round with it to the south, behind the start spot:
 *
 *   buildFrame(ctx)     world frame: what the famous views and the start
 *                       spot see -- the main road's walks, ends, crossing
 *                       and signals, the Lawson's own dressing, and the two
 *                       sakura framing the view
 *   buildOldTown(ctx)   the turned frame: the main road's north poles and
 *                       wires, and the edge's tree lines and fence (M2's
 *                       lane, fields and park gave way to the land, town
 *                       pass) */

export function buildFrame(ctx) {
  const S = STREET;
  const out = { vending: [] };
  const mats = Object.fromEntries(Object.entries(MAT).map(([k, f]) => [k, f()]));

  /* ============================== roads & walks ============================== */
  // north walk along the main road, either side of the forecourt, as deep as
  // the south walk (the town's frontage lots start where it ends)
  // broken where the town's lanes and the shopping street meet the road
  const gaps = mainRoadGaps().sort((a, b) => a[0] - b[0]);
  for (const [a0, a1] of [[S.roadX0 + 7, S.x0], [S.x1, S.roadX1 - 7]]) {
    let from = a0;
    for (const [g0, g1] of gaps) {
      if (g1 <= from || g0 >= a1) continue;
      if (g0 > from) walk(ctx, from, g0, 2 * TOWN.grid.main - S.sidewalkZ, S.forecourtZ, mats.walk);
      from = Math.max(from, g1);
    }
    if (a1 > from) walk(ctx, from, a1, 2 * TOWN.grid.main - S.sidewalkZ, S.forecourtZ, mats.walk);
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
  // the main road runs east-west, so this crossing is walked north-south: the cuckoo
  buildSignals(ctx, { x: TOWN.crosswalk.x, zNear: S.forecourtZ, zFar: S.roadZ, width: TOWN.crosswalk.width, sound: 'kakko' });

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

  /* ============ the two sakura that frame the view (M2, mood ref 2) ============
   * town.js builds them (the painted cherry, in the world's frame) */
  out.sakura = [
    // the frame's left edge, behind the store's corner, kept low
    { x: -17.5, z: -9.5, y: 0, scale: 0.82, seed: 1101 },
    // right of the store, just outside the frame
    { x: 20.0, z: -5.0, y: 0, scale: 1.0, seed: 1102 },
  ];

  // trees across the main road's ends, behind the barricades
  for (const sx of [-1, 1]) {
    buildGrove(ctx, [9, 13, 17, 21].map((z) => ({ x: sx * 123.5, z, y: 0, scale: 1.4, seed: 3500 + z + (sx > 0 ? 50 : 0) })), { far: true });
  }
  return out;
}

export function buildOldTown(ctx) {
  const B = TOWN.bounds;
  // (town pass) M2's residential lane, its fields and the old park went:
  // the land north of the road is paddies and a river now (world/land/)

  /* ============================ poles and wires ============================ */
  {
    const poles = [];
    const pole = (x, z, h, seed, o = {}) => {
      const y = ctx.groundAt(x, z);
      ctx.add(makePole({ x, z, y, h, seed, ...o }));
      ctx.collide(x - 0.22, z - 0.22, x + 0.22, z + 0.22, y + h);
      poles.push({ x, z, top: y + h });
      return poles.length - 1;
    };
    /* No poles along the Lawson's own frontage: at golden hour the low sun
     * laid the nearest pair's shadow across the sign.  The real store has
     * no overhead lines in front of it either. */
    const north = [-104, -74, -44, 44, 74, 104].map((x, i) => pole(x, 9.4, 9.2, 1201 + i, { lamp: i % 2 === 0, armDir: 1 }));

    const at = (i, dy = 0, dz = 0) => new THREE.Vector3(poles[i].x, poles[i].top - 0.6 + dy, poles[i].z + dz);
    const runs = [];
    const chain = (idx, offsets, sag = 0.55) => {
      for (const [dy, dz] of offsets) runs.push({ points: idx.map((i) => at(i, dy, dz)), sag });
    };
    chain(north.slice(0, 3), [[0, -0.6], [-0.42, 0], [-0.86, 0.6]]);
    chain(north.slice(3), [[0, -0.6], [-0.42, 0], [-0.86, 0.6]]);
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
    row(B.x0 - 3, B.z0, B.x0 - 3, 4, 11, 3200);                // west, down to the main road
    row(B.x1 + 3, B.z0, B.x1 + 3, 4, 11, 3300);                // east

    const fence = (x0, z0, x1, z1) => {
      const axis = x0 === x1 ? 'z' : 'x';
      const len = axis === 'x' ? x1 - x0 : z1 - z0;
      ctx.add(makeTimberFence({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, y: 0, len, axis, h: 1.2 }));
    };
    fence(B.x0, B.z0, B.x1, B.z0);
    fence(B.x0, B.z0, B.x0, 8.0);
    fence(B.x1, B.z0, B.x1, 8.0);
  }
}
