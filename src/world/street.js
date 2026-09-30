import * as THREE from 'three';
import { sstep } from '../core/util.js';

/* ------------------------------------------------------------------ *
 * The street.
 *
 * Everything in the world is placed relative to a single curved
 * centreline.  The stretch around the railway crossing is kept straight so
 * the crossing reads cleanly, then the road bends and climbs away to the
 * north-west and bends the other way behind the player, which hides both
 * ends of the scene without a visible wall.
 * ------------------------------------------------------------------ */

export const ROAD_HALF = 3.15;
export const WALK_H = 0.135;

/** Track centre is z = 0; the gates stand just outside the ballast. */
export const TRACK_HALF = 2.2;
export const GATE_Z = 2.95;
export const CROSS_BAND = 3.35;

/** Lateral drift of the road centre. */
export function centerX(z) {
  let x = 0;
  x += 3.0 * sstep(-11, -36, z);
  x -= 3.4 * sstep(16, 44, z);
  return x;
}

/** Ground height along the street: it climbs gently past the crossing. */
export function groundY(z) {
  return 1.05 * sstep(-13, -32, z) + 0.45 * sstep(28, 48, z);
}

/* ----------------------------- strip builder ----------------------------- */

/**
 * Quad strip swept along z.  `a(z)` and `b(z)` return the two edge points;
 * for horizontal surfaces a is the -X edge, for vertical faces a is the
 * bottom edge.
 */
export function makeStrip({ z0, z1, step = 1.2, a, b, uv = [1, 1], flip = false }) {
  const rows = Math.max(2, Math.round(Math.abs(z1 - z0) / step) + 1);
  const pos = [];
  const uvs = [];
  const idx = [];
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1);
    const z = z0 + (z1 - z0) * t;
    const pa = a(z);
    const pb = b(z);
    pos.push(pa.x, pa.y, z, pb.x, pb.y, z);
    uvs.push(0, t * uv[1], uv[0], t * uv[1]);
  }
  for (let i = 0; i < rows - 1; i++) {
    const o = i * 2;
    if (flip) idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    else idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* -------------------------------- builder -------------------------------- */

