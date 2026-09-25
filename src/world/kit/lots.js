import { rngKit } from '../../core/util.js';

/* ------------------------------------------------------------------ *
 * Frontage lots (SPEC section 3, buildings).
 *
 * Walk down each side of every street and cut lots 7-12 m wide with a
 * 0.5-1.5 m gap between them, each as deep as the block allows (7-14 m),
 * so lots from opposite streets meet back to back and fill the block.
 * Busier streets go first: the spine and the main road get the corners.
 *
 * A lot is { e, side, s0, s1, w, depth, front, face, rect, corner, seed }:
 *   front  offset of the frontage line from the edge centre (signed)
 *   face   unit vector the frontage looks along (toward the street)
 * ------------------------------------------------------------------ */

const PRIORITY = { hero: 0, main: 0, shopping: 1, lane: 2 };

/**
 * @param net       kit network
 * @param reserved  [[x0, z0, x1, z1]] not to build on (specials, plaza, rail...)
 * @param o.inside  (rect) => boolean: the lot is inside the buildable core
 * @param o.sides   (e) => [sides] which sides of an edge get lots
 */
export function cutLots(net, reserved, o = {}) {
  const taken = [...reserved];
  const pad = 0.15;
  const hits = (r) => taken.some((t) => r[0] < t[2] - pad && r[2] > t[0] + pad && r[1] < t[3] - pad && r[3] > t[1] + pad);
  const rectOf = (e, s0, s1, o0, o1) => {
    const a = net.at(e, s0, o0), b = net.at(e, s1, o1);
    return [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)];
  };

  // every road, pavements included, is taken
  for (const e of net.edges) taken.push(rectOf(e, e.s0, e.s1, -e.t, e.t));
  for (const n of Object.values(net.nodes)) taken.push([n.x - n.tx, n.z - n.tz, n.x + n.tx, n.z + n.tz]);

  const lots = [];
  const edges = [...net.edges].sort((a, b) => PRIORITY[a.cls] - PRIORITY[b.cls]);
  for (const e of edges) {
    const r = rngKit(e.seed + 211);
    for (const side of o.sides?.(e) ?? [-1, 1]) {
      const front = side * (e.t + (e.spec.walk > 0 ? 0.1 : 0.25));
      // start clear of the crossing roads at each end
      const clear0 = e.s0 + (e.axis === 'x' ? e.lo.tx : e.lo.tz) + 0.2;
      const clear1 = e.s1 - (e.axis === 'x' ? e.hi.tx : e.hi.tz) - 0.2;
      let s = clear0;
      let k = 0;
      while (s < clear1 - 6) {
        const w = Math.min(r.range(7, 12), clear1 - s);
        let placed = null;
        for (let depth = 14; depth >= 7; depth -= 0.5) {
          const rect = rectOf(e, s, s + w, front, front + side * depth);
          if (o.inside && !o.inside(rect)) continue;
          if (!hits(rect)) { placed = { rect, depth }; break; }
        }
        if (!placed || w < 6) { s += 1; continue; }
        taken.push(placed.rect);
        // the frontage looks back at the street: a lot on +side looks -side
        const fc = e.axis === 'x' ? { x: 0, z: -side } : { x: -side, z: 0 };
        lots.push({
          e, side, s0: s, s1: s + w, w, depth: placed.depth, front, face: fc, rect: placed.rect,
          corner: s - clear0 < 1 || clear1 - (s + w) < 7,
          seed: e.seed * 31 + side * 7 + k * 101,
          index: k,
        });
        k++;
        s += w + r.range(0.5, 1.5);
      }
    }
  }
  return lots;
}

/** A lot's frame: where its frontage centre is and how to place things in it.
 *  `u` runs along the frontage (-w/2..w/2), `v` back from it (0..depth). */
export function lotFrame(net, lot) {
  const { e, side } = lot;
  const sMid = (lot.s0 + lot.s1) / 2;
  const f = net.along(e, 1);
  return {
    at(u, v) {
      const p = net.at(e, sMid + u, lot.front + side * v);
      return p;
    },
    /** rotation.y that turns a +z-facing part to look at the street */
    ry: Math.atan2(lot.face.x, lot.face.z),
    face: lot.face,
    along: f,
    faceKey: lot.face.x > 0.5 ? 'x+' : lot.face.x < -0.5 ? 'x-' : lot.face.z > 0.5 ? 'z+' : 'z-',
  };
}
