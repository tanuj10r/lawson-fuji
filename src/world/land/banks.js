import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { rngKit } from '../../core/util.js';
import { TOWN } from '../../config.js';
import { RIVER, LAND_SIGNS } from '../../data/town.js';
import { makeBench } from '../props.js';
import { parkVehicle } from '../vehicles.js';
import { sheetGeo, quadGeo, boxGeo } from './geo.js';
import { TILE, postPlateTex, noticeTex, riverSignTex } from './tex.js';

/* ------------------------------------------------------------------ *
 * The levee (堤防), the river 桜川, the far bank, the farm track with its
 * ramps and the bridge, in the town's frame (north is -z).
 *
 *   levee     a grass slope up from the paddies, a wide crest (the sakura
 *             row, then a paved path), a concrete-block face to the water
 *   river     16 m of sky-tinted water between the faces, stones and reeds
 *             at the edges, a reedy sandbar downstream
 *   far bank  a low bank: a short face, a grass crest, a back slope
 *   track     packed earth from the main road's zebra; it ramps up onto
 *             the crest, crosses the bridge (富士見橋) and ramps down
 *
 * Walking: every slope you can walk is a stair of thin platforms (the
 * player steps up to 0.38 m); faces, water and embankment sides are
 * colliders whose tops follow the ground, so you walk on what looks
 * walkable and nowhere else.
 * ------------------------------------------------------------------ */

const EXT = 320;                    // the levee and river run on into the fog
const WALK_X = [-122, 122];         // the town's bounds: walkable strips end here
export const STAIR_X = -12;         // steps down the levee both sides, to a landing at the water

/** The levee's cross-section, from the paddies to the water. */
export function leveeProfile() {
  const L = TOWN.land.levee;
  const slope = L.z1 - L.z0 - L.crest - L.face;
  const zS = L.z1 - slope, zC = zS - L.crest;
  return { toe: L.z1, zS, zC, water: L.z0, top: L.top, slope };
}
export function farProfile() {
  const F = TOWN.land.farBank;
  const zF = F.z1 - F.face, zB = zF - F.crest;
  return { face: F.z1, zF, zB, toe: F.z0, top: F.top };
}

/** The track's height along z (its top), from the road to the gate. */
export function trackY(z) {
  const L = TOWN.land, T = L.track, top = L.levee.top;
  const lv = leveeProfile();
  const [r0, r1] = T.ramp;
  if (z >= r0) return T.top;
  if (z >= lv.zS) return T.top + (top - T.top) * (r0 - z) / (r0 - lv.zS);
  if (z >= L.bridge.z0) return top;
  if (z >= r1) return top - (top - T.top) * (L.bridge.z0 - z) / (L.bridge.z0 - r1);
  return T.top;
}

/** A slope strip from (za, ya) to (zb, yb), za > zb, across x0..x1, with its
 * normal up; UVs: u = x / uTile, v across the slope in metres / vTile. */
function slope(x0, x1, za, ya, zb, yb, uTile = 1, vTile = 1, v0 = 0) {
  const len = Math.hypot(za - zb, ya - yb);
  return quadGeo([x0, ya, za], [x1, ya, za], [x1, yb, zb], [x0, yb, zb],
    [x0 / uTile, v0, x1 / uTile, v0, x1 / uTile, v0 + len / vTile, x0 / uTile, v0 + len / vTile]);
}

/** A quad whose normal is turned to face up (for side slopes built any way round). */
function quadUp(a, b, c, d, uv) {
  const g = quadGeo(a, b, c, d, uv);
  const n = g.attributes.normal;
  if (n.getY(0) < 0) return quadGeo(d, c, b, a, uv && [uv[6], uv[7], uv[4], uv[5], uv[2], uv[3], uv[0], uv[1]]);
  return g;
}

export function bankMats(tex) {
  return {
    grass: cel({ color: 0xffffff, bands: 3, tint: 0x5b6f8c, map: tex.grass }),
    grassDeep: cel({ color: 0x86ad6c, bands: 3, tint: 0x55688a }),
    path: cel({ color: 0xbdb6a8, bands: 3, tint: 0x6a6388 }),
    blocks: cel({ color: 0xffffff, bands: 3, tint: 0x6a6490, map: tex.blocks }),
    track: cel({ color: 0xffffff, bands: 3, tint: 0x6f6790, map: tex.track }),
    earth: cel({ color: 0x9e8668, bands: 3, tint: 0x655676 }),
    sand: cel({ color: 0xcbbd9c, bands: 3, tint: 0x6a6388 }),
    gravel: cel({ color: 0xc7bca4, bands: 3, tint: 0x6a6388 }),
    deck: cel({ color: 0x8e8c94, bands: 3, tint: 0x5a5480 }),
    bridge: cel({ color: 0xd6d2c8, bands: 3, tint: 0x6f6790 }),
    bridgeDark: cel({ color: 0xaeaaa0, bands: 3, tint: 0x5f5880 }),
    rail: cel({ color: 0x8fb2c0, bands: 3, tint: 0x4f5a88 }),
    white: cel({ color: 0xf2f0ea, bands: 3, tint: 0x6f6790 }),
    post: cel({ color: 0x7a7a80, bands: 3, tint: 0x4f4a70 }),
    wood: cel({ color: 0x9a7a58, bands: 3, tint: 0x5a4a68 }),
  };
}

export function buildBanks(ctx, parts, scatter, water) {
  const L = TOWN.land;
  const lv = leveeProfile(), fb = farProfile();
  const R = L.river, T = L.track, B = L.bridge;
  const bx0 = B.x - B.w / 2, bx1 = B.x + B.w / 2;
  const tx0 = T.x - T.w / 2, tx1 = T.x + T.w / 2;
  const r = rngKit(4301);
  const top = lv.top;

  /* ================= the levee ================= */
  parts.add('grass', slope(-EXT, EXT, lv.toe, 0, lv.zS, top, TILE.grass, TILE.grass));
  // the crest: a grass strip for the sakura, then the paved path on the river side
  const pathZ = [lv.zC + 0.35, lv.zC + 3.0];
  parts.add('grass', sheetGeo(-EXT, EXT, pathZ[1], lv.zS, top, TILE.grass));
  parts.add('path', sheetGeo(-EXT, EXT, pathZ[0], pathZ[1], top + 0.02));
  parts.add('grassDeep', sheetGeo(-EXT, EXT, lv.zC, pathZ[0], top));
  // the face: concrete blocks, moss at the waterline; open where the steps go down
  for (const [a, b] of [[-EXT, STAIR_X - 0.94], [STAIR_X + 0.94, EXT]]) {
    parts.add('blocks', quadGeo([a, top, lv.zC], [b, top, lv.zC], [b, 0, lv.water], [a, 0, lv.water],
      [a / TILE.blocks, 1, b / TILE.blocks, 1, b / TILE.blocks, 0, a / TILE.blocks, 0]));
  }
  // a coping along the crest's edge (open at the steps, with a riser there)
  for (const [a, b] of [[-EXT, STAIR_X - 0.94], [STAIR_X + 0.94, EXT]]) parts.box('bridge', a, b, top - 0.05, top + 0.08, lv.zC - 0.05, lv.zC + 0.3);
  parts.box('bridge', STAIR_X - 0.94, STAIR_X + 0.94, 0, top, lv.zC, lv.zC + 0.3);

  // walking: the slope as a stair of thin strips, the crest flat, the face shut
  {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const za = lv.toe - (lv.slope * i) / n, zb = lv.toe - (lv.slope * (i + 1)) / n;
      ctx.platform({ x0: WALK_X[0], x1: WALK_X[1], z0: zb, z1: za, top: (top * (i + 0.5)) / n });
    }
    ctx.platform({ x0: WALK_X[0], x1: WALK_X[1], z0: lv.zC, z1: lv.zS, top });
    const sx0 = STAIR_X - 0.8, sx1 = STAIR_X + 0.8;
    for (const [a, b] of [[WALK_X[0] - 10, sx0], [sx1, bx0], [bx1, WALK_X[1] + 10]]) {
      ctx.collide(a, lv.water, b, lv.zC, top + 0.8);
    }
  }

  /* ================= the river ================= */
  {
    // flat bands across the stream: darker at the banks, light mid-stream
    const bands = [[0, 0.1, 0.78], [0.1, 0.24, 0.9], [0.24, 0.8, 1.0], [0.8, 0.9, 0.9], [0.9, 1, 0.8]];
    const pos = [], col = [], idx = [], uv = [];
    const U = 12, V = 7;       // the ripples' tile, metres
    const w = R.z1 - R.z0;
    bands.forEach(([a, b, k], i) => {
      const za = R.z1 - a * w, zb = R.z1 - b * w;
      const v = pos.length / 3;
      pos.push(-EXT, R.water, za, EXT, R.water, za, EXT, R.water, zb, -EXT, R.water, zb);
      uv.push(-EXT / U, za / V, EXT / U, za / V, EXT / U, zb / V, -EXT / U, zb / V);
      for (let j = 0; j < 4; j++) col.push(k, k * 1.0, k);
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      void i;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setIndex(idx);
    const base = new THREE.Mesh(g, water.river);
    base.name = 'land-river';
    base.userData.dynamic = true;
    ctx.add(base);
    water.watch(base, [-EXT, R.z0, EXT, R.z1]);
    // the water is not for walking; the landing and the bridge are
    const lx0 = STAIR_X - 0.9, lx1 = STAIR_X + 0.9, lz = lv.water - 1.4;
    for (const [a, b] of [[WALK_X[0] - 10, lx0], [lx1, bx0], [bx1, WALK_X[1] + 10]]) ctx.collide(a, R.z0, b, R.z1, 3.2);
    ctx.collide(lx0, R.z0, lx1, lz, 3.2);
  }

  /* the sandbar (中州) downstream, and the stones and reeds at the edges */
  {
    const sb = { x0: 62, x1: 92, z0: -60.5, z1: -55.5 };
    const shape = new THREE.Shape();
    const cx = (sb.x0 + sb.x1) / 2, cz = (sb.z0 + sb.z1) / 2, rx = (sb.x1 - sb.x0) / 2, rz = (sb.z1 - sb.z0) / 2;
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const k = 1 + 0.08 * Math.sin(a * 3) + (a > Math.PI ? -0.2 * Math.sin(a) : 0);
      const x = cx + Math.cos(a) * rx * k, z = cz + Math.sin(a) * rz * k;
      if (i === 0) shape.moveTo(x, -z); else shape.lineTo(x, -z);
    }
    const sand = new THREE.ShapeGeometry(shape);
    sand.rotateX(-Math.PI / 2);
    sand.translate(0, R.water + 0.05, 0);
    parts.add('sand', sand);
    const grassy = sand.clone();
    grassy.translate(-cx, 0, -cz); grassy.scale(0.7, 1, 0.55); grassy.translate(cx + 2, 0.03, cz);
    parts.add('grassDeep', grassy);
    for (let i = 0; i < 26; i++) {
      const a = r.range(0, Math.PI * 2), d = Math.sqrt(r.next()) * 0.7;
      scatter.put('reed', cx + 2 + Math.cos(a) * rx * d, R.water + 0.05, cz + Math.sin(a) * rz * d * 0.8, r.range(0.9, 1.4), r.range(0.9, 1.5), r.range(0.9, 1.4), r.range(0, 6.3), r.pick([0xd8c49a, 0xc9b88e, 0xa8c07a]));
    }
    for (let i = 0; i < 18; i++) {
      const a = r.range(0, Math.PI * 2);
      const s = r.range(0.15, 0.4);
      scatter.put('stone', cx + Math.cos(a) * rx * r.range(0.9, 1.1), R.water, cz + Math.sin(a) * rz * r.range(0.9, 1.15), s * 1.3, s, s, r.range(0, 6.3), r.pick([0xb8b4aa, 0xa6a39c, 0xc8c2b4]));
    }
  }
  // riprap and reeds along both waterlines, in patches
  for (const [zEdge, dir] of [[R.z1, -1], [R.z0, 1]]) {
    for (let x = -150; x < 150; x += r.range(0.8, 2.2)) {
      if (x > bx0 - 1 && x < bx1 + 1) continue;
      if (Math.abs(x - STAIR_X) < 1.4 && dir < 0) continue;
      const s = r.range(0.18, 0.45);
      scatter.put('stone', x, R.water - 0.02, zEdge + dir * r.range(0.1, 0.9), s * 1.3, s * 1.2, s * 1.1, r.range(0, 6.3), r.pick([0xa8a49a, 0x96938c, 0xb8b2a4, 0x8c8a84]));
    }
    // reed beds: a few long patches per side
    for (let k = 0; k < 9; k++) {
      const xc = r.range(-140, 140);
      if (xc > bx0 - 8 && xc < bx1 + 8) continue;
      const len = r.range(6, 18);
      for (let x = xc - len / 2; x < xc + len / 2; x += r.range(0.35, 0.8)) {
        scatter.put('reed', x, R.water, zEdge + dir * r.range(0.2, 1.6), r.range(0.8, 1.3), r.range(0.8, 1.5), r.range(0.8, 1.3), r.range(0, 6.3), r.pick([0xd8c49a, 0xcbb98f, 0xb9c486, 0x9fbe74]));
      }
    }
  }

  /* the verges: grass between the far paddies and the town's fence, and
   * at the paddies' ends, so no bare ground shows */
  {
    const [x0, z0, x1] = L.far;
    parts.add('grass', sheetGeo(WALK_X[0] - 6, WALK_X[1] + 6, -100, z0 + 0.8, 0.02, TILE.grass));
    for (const [a, b] of [[WALK_X[0] - 6, x0], [x1, WALK_X[1] + 6]]) {
      parts.add('grass', sheetGeo(a, b, L.far[1], L.far[3], 0.02, TILE.grass));
      parts.add('grass', sheetGeo(a, b, L.near[1], L.near[3], 0.02, TILE.grass));
    }
  }

  /* ================= the far bank ================= */
  {
    parts.add('blocks', quadGeo([-EXT, 0, fb.face], [EXT, 0, fb.face], [EXT, fb.top, fb.zF], [-EXT, fb.top, fb.zF],
      [-EXT / TILE.blocks, 0, EXT / TILE.blocks, 0, EXT / TILE.blocks, 0.62, -EXT / TILE.blocks, 0.62]));
    parts.add('grass', sheetGeo(-EXT, EXT, fb.zB, fb.zF, fb.top, TILE.grass));
    parts.add('grass', slope(-EXT, EXT, fb.zB, fb.top, fb.toe, 0, TILE.grass, TILE.grass));
    parts.box('bridge', -EXT, EXT, fb.top - 0.05, fb.top + 0.06, fb.zF - 0.25, fb.zF + 0.05);
    ctx.platform({ x0: WALK_X[0], x1: WALK_X[1], z0: fb.zB, z1: fb.zF, top: fb.top });
    const n = 7;
    for (let i = 0; i < n; i++) {
      const za = fb.zB - ((fb.zB - fb.toe) * i) / n, zb = fb.zB - ((fb.zB - fb.toe) * (i + 1)) / n;
      ctx.platform({ x0: WALK_X[0], x1: WALK_X[1], z0: zb, z1: za, top: fb.top * (1 - (i + 0.5) / n) });
    }
    for (const [a, b] of [[WALK_X[0] - 10, bx0], [bx1, WALK_X[1] + 10]]) ctx.collide(a, fb.zF, b, fb.face, fb.top + 0.8);
  }

  /* ================= the track, its ramps, the crossing on the crest ================= */
  {
    const Tt = T.top;
    const edges = [T.z1, T.ramp[0], lv.zS, B.z1, B.z0, T.ramp[1], T.z0];
    // along z, a point every metre (every edge kept), with the track's height
    const zs = [];
    for (let i = 0; i < edges.length - 1; i++) {
      const a = edges[i], b = edges[i + 1];
      const n = Math.max(1, Math.round((a - b) / 1));
      for (let k = 0; k < n; k++) zs.push(a - ((a - b) * k) / n);
    }
    zs.push(T.z0);
    const onBridge = (z) => z < B.z1 && z > B.z0;
    const RUN = 0.75;             // side slopes: metres out per metre up
    for (let i = 0; i < zs.length - 1; i++) {
      const za = zs[i], zb = zs[i + 1], ya = trackY(za), yb = trackY(zb);
      if (onBridge((za + zb) / 2)) continue;
      // the top: earth with its ruts, UVs across the width and along z
      parts.add('track', quadUp([tx0, ya, za], [tx1, ya, za], [tx1, yb, zb], [tx0, yb, zb],
        [0, za / TILE.track * 0.5, 1, za / TILE.track * 0.5, 1, zb / TILE.track * 0.5, 0, zb / TILE.track * 0.5]));
      // the sides: grass embankment down to the paddies
      for (const s of [-1, 1]) {
        const xe = s < 0 ? tx0 : tx1;
        const oa = Math.max(0.8, ya * RUN + 0.3), ob = Math.max(0.8, yb * RUN + 0.3);
        const G = TILE.grass;
        parts.add('grass', quadUp([xe, ya - 0.01, za], [xe + s * oa, 0.0, za], [xe + s * ob, 0.0, zb], [xe, yb - 0.01, zb],
          [za / G, 0, za / G, oa / G, zb / G, ob / G, zb / G, 0]));
      }
      // walking: the ramp's top, strip by strip; its sides are shut to anyone below
      const hi = Math.max(ya, yb);
      if (hi > 0.2) {
        ctx.platform({ x0: tx0, x1: tx1, z0: zb, z1: za, top: (ya + yb) / 2 });
        if (hi > 0.45) {
          for (const s of [-1, 1]) {
            const xe = s < 0 ? tx0 : tx1;
            const o = hi * RUN + 0.3;
            ctx.collide(Math.min(xe, xe + s * o), zb, Math.max(xe, xe + s * o), za, hi);
          }
        }
      }
    }
    // the crest crossing: the path runs over the track
    parts.add('path', sheetGeo(tx0, tx1, lv.zC + 0.35, lv.zC + 3.0, top + 0.025));
    // white guard posts with a rail along the high parts of both ramps
    for (const [z0, z1] of [[lv.zS + 0.2, T.ramp[0] - 3], [T.ramp[1] + 3, B.z0 - 0.4]]) {
      for (const s of [-1, 1]) {
        const x = s < 0 ? tx0 - 0.25 : tx1 + 0.25;
        const n = Math.round((z1 - z0) / 2);
        for (let k = 0; k <= n; k++) {
          const z = z0 + ((z1 - z0) * k) / n;
          const y = trackY(z);
          parts.box('white', x - 0.035, x + 0.035, y - 0.3, y + 0.72, z - 0.035, z + 0.035);
        }
        const ya = trackY(z0), yb = trackY(z1);
        const len = Math.hypot(z1 - z0, yb - ya);
        const g = new THREE.BoxGeometry(0.05, 0.1, len);
        const m = new THREE.Matrix4().makeRotationX(-Math.atan2(yb - ya, z1 - z0));
        g.applyMatrix4(m);
        g.translate(x, (ya + yb) / 2 + 0.64, (z0 + z1) / 2);
        parts.add('white', g);
        ctx.collide(x - 0.12, Math.min(z0, z1), x + 0.12, Math.max(z0, z1), Math.max(ya, yb) + 1);
      }
    }
    // from the road's far-side row to the paddies: the track's first stretch
    parts.add('track', sheetGeo(tx0, tx1, T.z1, T.z1 + 2.2, Tt - 0.02, 1, { rot: false, uTile: 1 }));
  }

  /* ================= the bridge: 富士見橋 ================= */
  {
    const deckB = top - 0.5;
    const z0 = B.z0, z1 = B.z1;
    parts.box('bridge', bx0, bx1, deckB, top - 0.01, z0, z1);
    parts.add('deck', sheetGeo(bx0 + 0.3, bx1 - 0.3, z0, z1, top));
    // kerbs, and the railing on them
    for (const s of [-1, 1]) {
      const xa = s < 0 ? bx0 : bx1 - 0.3, xb = xa + 0.3;
      parts.box('bridge', xa, xb, top - 0.01, top + 0.22, z0, z1);
      const xr = (xa + xb) / 2;
      const n = Math.round((z1 - z0) / 1.5);
      for (let k = 0; k <= n; k++) {
        const z = z0 + ((z1 - z0) * k) / n;
        parts.box('rail', xr - 0.04, xr + 0.04, top + 0.22, top + 1.1, z - 0.04, z + 0.04);
      }
      parts.box('rail', xr - 0.06, xr + 0.06, top + 1.05, top + 1.15, z0, z1);
      parts.box('rail', xr - 0.025, xr + 0.025, top + 0.62, top + 0.68, z0, z1);
      ctx.collide(xa - 0.05, z0, xb + 0.05, z1, top + 1.2);
    }
    // girders, a pier mid-stream, the abutments
    for (const gx of [B.x - 1.2, B.x + 1.2]) parts.box('bridgeDark', gx - 0.3, gx + 0.3, deckB - 0.55, deckB, z0, z1);
    const pz = (R.z0 + R.z1) / 2;
    parts.box('bridge', bx0 + 0.3, bx1 - 0.3, deckB - 0.75, deckB - 0.55, pz - 0.7, pz + 0.7);
    parts.box('bridgeDark', bx0 + 0.6, bx1 - 0.6, 0, deckB - 0.75, pz - 0.45, pz + 0.45);
    for (const s of [-1, 1]) {
      const c = new THREE.CylinderGeometry(0.45, 0.45, deckB - 0.75, 10);
      c.translate(s < 0 ? bx0 + 0.6 : bx1 - 0.6, (deckB - 0.75) / 2, pz);
      parts.add('bridgeDark', c);
    }
    parts.box('bridge', bx0 - 0.2, bx1 + 0.2, 0, deckB, lv.water - 0.2, lv.water + 0.8);
    parts.box('bridge', bx0 - 0.2, bx1 + 0.2, 0, deckB, fb.face - 0.8, fb.face + 0.2);
    // the far abutment's back wall, where the ramp's bank begins
    parts.box('bridge', tx0 - 0.1, tx1 + 0.1, 0, top - 0.02, z0 - 0.02, z0 + 0.3);
    // and the ends of the ramp's grass banks there, closed
    for (const s of [-1, 1]) {
      const xe = s < 0 ? tx0 : tx1, o = top * 0.75 + 0.3;
      const tri = new THREE.BufferGeometry();
      tri.setAttribute('position', new THREE.Float32BufferAttribute([xe, top, z0, xe + s * o, 0, z0, xe, 0, z0, xe, top, z0, xe, 0, z0, xe + s * o, 0, z0], 3));
      tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0.4, 0.3, 0, 0, 0, 0, 0.4, 0, 0, 0.3, 0], 2));
      tri.computeVertexNormals();
      parts.add('grass', tri);
    }
    // under the deck over the far bank: shut to anyone on the bank
    ctx.collide(bx0 - 0.3, B.z0, bx1 + 0.3, fb.face, top);
    ctx.platform({ x0: bx0, x1: bx1, z0, z1, top });

    // the four posts (親柱), each with its cast plate
    const post = (x, z, face, text, key) => {
      parts.box('bridge', x - 0.26, x + 0.26, top - 0.1, top + 1.3, z - 0.26, z + 0.26);
      const cap = new THREE.ConeGeometry(0.37, 0.28, 4, 1);
      cap.rotateY(Math.PI / 4);
      cap.translate(x, top + 1.44, z);
      parts.add('bridge', cap);
      parts.box('bridgeDark', x - 0.3, x + 0.3, top + 1.24, top + 1.3, z - 0.3, z + 0.3);
      ctx.collide(x - 0.28, z - 0.28, x + 0.28, z + 0.28, top + 1.5);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.86), flat({ map: postPlateTex(text, key) }));
      plate.position.set(x, top + 0.72, z);
      plate.rotation.y = face;
      plate.translateZ(0.265);
      plate.userData.detail = true;
      ctx.add(plate);
    };
    const px0 = bx0 - 0.25, px1 = bx1 + 0.25;
    // the town end: facing you as you come up the ramp (left the bridge, right the river)
    post(px0, z1 + 0.1, 0, RIVER.bridge, 'b');
    post(px1, z1 + 0.1, 0, RIVER.jp, 'r');
    // the far end, facing the way back: left and right as you come home
    post(px1, z0 - 0.1, Math.PI, RIVER.bridgeKana, 'bk');
    post(px0, z0 - 0.1, Math.PI, RIVER.kana, 'rk');
    // the year it was built, on the inside of the first post
    const yr = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.86), flat({ map: postPlateTex(RIVER.built, 'y') }));
    yr.position.set(px0 + 0.265, top + 0.72, z1 + 0.1);
    yr.rotation.y = Math.PI / 2;
    yr.userData.detail = true;
    ctx.add(yr);
  }

  /* ================= steps down the levee, both sides ================= */
  {
    const x0 = STAIR_X - 0.8, x1 = STAIR_X + 0.8;
    // town side: concrete steps set in the grass
    const n = 9;
    for (let i = 0; i < n; i++) {
      const za = lv.toe - (lv.slope * i) / n + 0.2, zb = lv.toe - (lv.slope * (i + 1)) / n + 0.2;
      const y = (top * (i + 1)) / n;
      parts.box('bridge', x0, x1, 0, y, zb, za);
    }
    for (const x of [x0 - 0.12, x1]) parts.box('bridgeDark', x, x + 0.12, 0, 0.3, lv.toe - lv.slope + 0.2, lv.toe + 0.2);
    // river side: down the face to a landing just above the water
    const m = 8, land = 0.32, face = lv.zC - lv.water;
    for (let i = 0; i < m; i++) {
      const za = lv.zC - (face * i) / m, zb = lv.zC - (face * (i + 1)) / m;
      const y = top - ((top - land) * (i + 1)) / m;
      parts.box('bridge', x0, x1, 0, y, zb, za);
      ctx.platform({ x0, x1, z0: zb, z1: za, top: y });
      // the side walls, stepping down with the stair
      for (const x of [x0 - 0.14, x1]) parts.box('bridgeDark', x, x + 0.14, 0, y + 0.3, zb, za);
    }
    const lz0 = lv.water - 1.4;
    parts.box('bridge', x0 - 0.1, x1 + 0.1, 0, land, lz0, lv.water);
    ctx.platform({ x0: x0 - 0.1, x1: x1 + 0.1, z0: lz0, z1: lv.water, top: land });
    // the landing's lip
    ctx.collide(x0 - 0.2, lz0 - 0.3, x1 + 0.2, lz0, 1.4);
  }

  /* ================= the sakura row on the crest, benches under it ================= */
  {
    // near the path's edge: the petal carpet under each tree stays on the crest
    const zT = lv.zC + 3.7;
    const benches = [-6.5, 24.5, 52];
    const skip = (x) => (x > tx0 - 6 && x < tx1 + 6) || Math.abs(x - STAIR_X) < 3 || benches.some((b) => Math.abs(x - b) < 2.6);
    let i = 0;
    for (let x = -112; x <= 116; x += r.range(9.5, 12)) {
      if (skip(x)) continue;
      ctx.sakura.push({ x, z: zT + r.range(-0.2, 0.2), y: top, scale: r.range(0.92, 1.12), seed: 5101 + i++, lean: r.range(0.05, 0.14), leanDir: r.range(0, 6.3) });
    }
    // benches facing the river, between trees
    for (const bx of benches) {
      const z = lv.zC + 3.1;
      ctx.add(makeBench({ x: bx, z, y: top, ry: Math.PI, len: 1.6 }));
      ctx.collide(bx - 0.82, z - 0.2, bx + 0.82, z + 0.26, top + 0.9);
    }
    // nanohana (rape blossom) along the town slope, in drifts
    for (let k = 0; k < 16; k++) {
      const xc = r.range(-115, 115);
      if (xc > tx0 - 3 && xc < tx1 + 3) continue;
      const len = r.range(4, 12);
      const cnt = Math.round(len * 5);
      for (let j = 0; j < cnt; j++) {
        const x = xc + r.range(-len / 2, len / 2);
        const t = r.range(0.1, 0.85);
        const z = lv.toe - lv.slope * t, y = top * t;
        const h = r.range(0.35, 0.6);
        scatter.put('tuft', x, y - 0.03, z, h * 0.8, h, h * 0.8, r.range(0, 6.3), r.pick([0x7ea85a, 0x8cb562]));
        // a loose spike of small four-petal flowers at the top
        const hc = r.pick([0xf6d93a, 0xf2cc2e, 0xfae060]);
        for (let q = 0; q < 4; q++) {
          scatter.put('head', x + r.range(-0.06, 0.06), y + h * (0.8 + q * 0.07), z + r.range(-0.06, 0.06), 0.045, 0.035, 0.045, r.range(0, 6.3), hc);
        }
      }
    }
    // tufts all over both banks' grass, so the slopes are not bare
    for (let k = 0; k < 900; k++) {
      const x = r.range(-125, 125);
      const onFar = r.chance(0.35);
      let y, z;
      if (onFar) { z = r.range(fb.toe, fb.zB); y = fb.top * (z - fb.toe) / (fb.zB - fb.toe); }
      else { const t = r.range(0.02, 0.98); z = lv.toe - lv.slope * t; y = top * t; }
      const h = r.range(0.14, 0.3);
      scatter.put('tuft', x, y - 0.03, z, h, h, h, r.range(0, 6.3), r.pick([0x86ad62, 0x94b86a, 0x7a9e5a]));
      if (r.chance(0.18)) scatter.put('head', x, y + h * 0.8, z, 0.045, 0.03, 0.045, 0, r.chance(0.6) ? 0xf4cf3a : 0xfbfaf0);
    }
  }

  /* ================= signs, the pump shed, the kei truck, the scarecrow ================= */
  {
    // 一級河川 桜川, on the crest by the track, facing the town
    const sx = tx0 - 3.2, sz = lv.zS - 0.9;
    for (const dx of [-0.62, 0.62]) parts.box('post', sx + dx - 0.04, sx + dx + 0.04, top, top + 2.0, sz - 0.04, sz + 0.04);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), flat({ map: riverSignTex(RIVER) }));
    board.position.set(sx, top + 1.65, sz + 0.05);
    board.userData.detail = true;
    ctx.add(board);
    parts.box('post', sx - 0.78, sx + 0.78, top + 1.38, top + 1.92, sz - 0.02, sz + 0.03);
    ctx.collide(sx - 0.72, sz - 0.1, sx + 0.72, sz + 0.1, top + 2);

    // 田んぼに入らないでください, on a stake by the track as it leaves the road
    const nx = tx0 - 1.2, nz = T.z1 - 6.5;
    parts.box('wood', nx - 0.04, nx + 0.04, 0, 1.05, nz - 0.04, nz + 0.04);
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.36), flat({ map: noticeTex('paddy', LAND_SIGNS.paddy, { red: { line: 1, color: '#c0392b' } }) }));
    note.position.set(nx, 0.92, nz + 0.05);
    note.userData.detail = true;
    ctx.add(note);
    parts.box('white', nx - 0.38, nx + 0.38, 0.72, 1.1, nz - 0.01, nz + 0.04);
  }
}

/** The pump shed (揚水機場), its apron, and a kei truck parked by it. */
export function buildPumpShed(ctx, parts, keep) {
  const [ax0, az0, ax1, az1] = keep;
  parts.add('gravel', sheetGeo(ax0, ax1, az0 + 1.2, az1, 0.03));
  const sx0 = ax0 + 0.6, sx1 = sx0 + 3.0, sz0 = az0 + 1.4, sz1 = sz0 + 2.4, h = 2.3;
  parts.box('shedWall', sx0, sx1, 0, h, sz0, sz1);
  // a lean-to roof of corrugated sheet, falling to the back
  const roof = new THREE.BoxGeometry(sx1 - sx0 + 0.5, 0.06, sz1 - sz0 + 0.6);
  roof.rotateX(-0.16);
  roof.translate((sx0 + sx1) / 2, h + 0.16, (sz0 + sz1) / 2);
  parts.add('shedRoof', roof);
  // the door (to the track), a vent, the plate
  parts.box('shedDoor', sx0 + 0.3, sx0 + 1.2, 0.02, 1.95, sz1, sz1 + 0.03);
  parts.box('steel', sx1 - 0.9, sx1 - 0.3, 1.4, 1.8, sz1, sz1 + 0.03);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.24), flat({ map: noticeTex('pump', LAND_SIGNS.pump, { w: 256, h: 64 }) }));
  plate.position.set(sx0 + 2.0, 2.0, sz1 + 0.035);
  plate.userData.detail = true;
  ctx.add(plate);
  // the discharge pipe into the channel at the levee's toe
  const pipe = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8);
  pipe.rotateX(Math.PI / 2);
  pipe.translate(sx0 + 0.8, 0.45, sz0 - 0.5);
  parts.add('steelBlue', pipe);
  // an electric box on a post
  parts.box('post', sx1 + 0.4, sx1 + 0.5, 0, 1.9, sz1 - 0.3, sz1 - 0.2);
  parts.box('white', sx1 + 0.3, sx1 + 0.6, 1.2, 1.7, sz1 - 0.2, sz1);
  ctx.collide(sx0 - 0.05, sz0 - 0.05, sx1 + 0.05, sz1 + 0.05, h);
  // the farmer's kei truck, nose to the track, a sheet over its load
  parkVehicle(ctx, { kind: 'keitruck', x: ax0 + 6.6, z: az0 + 4.6, y: 0.03, ry: Math.PI, color: 0xf2eee6, load: 'sheet' });
}

/** A scarecrow (案山子): a pole, a crossbar, a shirt, a straw hat. */
export function buildScarecrow(parts, x, z) {
  parts.box('wood', x - 0.04, x + 0.04, 0, 1.7, z - 0.04, z + 0.04);
  parts.box('wood', x - 0.7, x + 0.7, 1.28, 1.34, z - 0.03, z + 0.03);
  // shirt (indigo), a towel round the neck
  parts.box('cloth', x - 0.3, x + 0.3, 0.8, 1.38, z - 0.12, z + 0.12);
  parts.box('cloth', x - 0.72, x - 0.3, 1.2, 1.38, z - 0.1, z + 0.1);
  parts.box('cloth', x + 0.3, x + 0.72, 1.2, 1.38, z - 0.1, z + 0.1);
  parts.box('white', x - 0.2, x + 0.2, 1.36, 1.44, z - 0.13, z + 0.13);
  // straw head and hat
  const head = new THREE.SphereGeometry(0.17, 8, 6);
  head.translate(x, 1.58, z);
  parts.add('straw', head);
  const hat = new THREE.ConeGeometry(0.42, 0.22, 12);
  hat.translate(x, 1.8, z);
  parts.add('straw', hat);
  // straw hands
  for (const s of [-1, 1]) {
    const hand = new THREE.ConeGeometry(0.08, 0.2, 6);
    hand.rotateZ(s * Math.PI / 2);
    hand.translate(x + s * 0.8, 1.31, z);
    parts.add('straw', hand);
  }
}
