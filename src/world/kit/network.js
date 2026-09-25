import { ROADS } from '../../config.js';

/* ------------------------------------------------------------------ *
 * The road network the whole kit is generated from (SPEC section 3).
 *
 * A grid of nodes joined by straight, axis-aligned edges.  Each edge has a
 * class (lane / shopping / main, config.js ROADS) and a seed.  Everything
 * else -- asphalt, pavements, markings, poles, wires, signs -- is derived
 * from this description by rules, so M2b only has to describe its streets.
 *
 * Conventions.  An edge runs from its low end to its high end along `axis`
 * ('x' or 'z') at the fixed coordinate `c`.  `side` -1 / +1 is the low /
 * high side across it.  Traffic keeps left: a driver heading +x is on the
 * -z half, a driver heading +z on the +x half.
 * ------------------------------------------------------------------ */

/** Half widths of an edge: asphalt, and asphalt plus pavement. */
function halves(cls) {
  const r = ROADS[cls];
  return { a: r.asphalt / 2, t: r.asphalt / 2 + r.walk };
}

/**
 * @param def.nodes     { id: [x, z] }
 * @param def.edges     [[from, to, cls, opts?]]  opts: { seed, school, pedPriority, poles: side|0, surface: false }
 * @param def.crossings [{ edge, at }]  a zebra across edge `edge` at `at` along it
 * @param def.busStops  [{ edge, at, side }]
 * @param def.quiet     [[x0, z0, x1, z1]]  no furniture inside (the hero window)
 */
export function makeNetwork(def) {
  const nodes = {};
  for (const [id, [x, z]] of Object.entries(def.nodes)) {
    nodes[id] = { id, x, z, dirs: {} };  // dirs: '+x' | '-x' | '+z' | '-z' -> edge
  }
  const edges = def.edges.map(([from, to, cls, opts = {}], i) => {
    const A = nodes[from], B = nodes[to];
    if (!A || !B) throw new Error(`edge ${i}: unknown node`);
    const axis = A.z === B.z ? 'x' : A.x === B.x ? 'z' : null;
    if (!axis) throw new Error(`edge ${from}-${to} is not axis-aligned`);
    const [lo, hi] = (axis === 'x' ? A.x < B.x : A.z < B.z) ? [A, B] : [B, A];
    const e = {
      i, cls, axis, lo, hi, spec: ROADS[cls], rank: ROADS[cls].rank,
      c: axis === 'x' ? A.z : A.x,
      s0: axis === 'x' ? lo.x : lo.z,
      s1: axis === 'x' ? hi.x : hi.z,
      seed: opts.seed ?? 1000 + i * 17,
      ...halves(cls),
      opts,
    };
    lo.dirs[`+${axis}`] = e;
    hi.dirs[`-${axis}`] = e;
    return e;
  });

  /* Junction extents: how far the crossing roads reach from the node.
   *   ax / az   asphalt half-width of the widest road across x / across z
   *   tx / tz   the same, pavements included */
  for (const n of Object.values(nodes)) {
    const zs = [n.dirs['+z'], n.dirs['-z']].filter(Boolean);
    const xs = [n.dirs['+x'], n.dirs['-x']].filter(Boolean);
    n.ax = Math.max(0, ...zs.map((e) => e.a));
    n.tx = Math.max(0, ...zs.map((e) => e.t));
    n.az = Math.max(0, ...xs.map((e) => e.a));
    n.tz = Math.max(0, ...xs.map((e) => e.t));
    n.edges = [...xs, ...zs];
    n.rank = Math.max(...n.edges.map((e) => e.rank));
    n.degree = n.edges.length;
  }

  /** Where an edge's asphalt stops short of a node (along its axis). */
  const trim = (e, n) => (e.axis === 'x' ? n.ax : n.az);
  for (const e of edges) {
    e.a0 = e.s0 + trim(e, e.lo);
    e.a1 = e.s1 - trim(e, e.hi);
    e.len = e.a1 - e.a0;
  }

  /** World point at `s` along an edge, `off` across it. */
  const at = (e, s, off = 0) => (e.axis === 'x' ? { x: s, z: e.c + off } : { x: e.c + off, z: s });
  /** Unit vector along an edge, heading `dir` (+1 toward hi). */
  const along = (e, dir = 1) => (e.axis === 'x' ? { x: dir, z: 0 } : { x: 0, z: dir });

  /**
   * Where the pavement on `side` of edge `e` ends at its `end` ('lo'|'hi'),
   * as a coordinate along the edge.  See the junction rules in roads.js.
   */
  function walkEnd(e, side, end) {
    const n = end === 'lo' ? e.lo : e.hi;
    const d = end === 'lo' ? -1 : 1;          // direction from the edge into the node
    const pos = e.axis === 'x' ? n.x : n.z;
    const other = e.axis === 'x' ? 'z' : 'x';
    const crossing = n.dirs[`${side > 0 ? '+' : '-'}${other}`];
    const straight = n.dirs[`${d > 0 ? '+' : '-'}${e.axis}`];
    if (e.axis === 'x') {
      // x roads carry their pavement round the corner
      if (crossing) return pos - d * n.ax;
      if (straight) return pos;
      return pos + d * n.tx;
    }
    // z roads butt against the x road's pavement
    if (crossing) return pos - d * n.tz;
    if (straight) return pos;
    return pos + d * n.az;
  }

  /** Quiet zones ([x0, z0, x1, z1]): no poles, signs or road words inside. */
  const quietRects = def.quiet ?? [];
  const quiet = (x, z) => quietRects.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  // a node where a road the kit doesn't pave meets others is paved by that road
  for (const n of Object.values(nodes)) n.external = n.edges.some((e) => e.opts.surface === false);

  return {
    nodes, edges, at, along, walkEnd, quiet,
    crossings: (def.crossings ?? []).map((c) => ({ ...c, e: edges[c.edge] })),
    busStops: (def.busStops ?? []).map((b) => ({ ...b, e: edges[b.edge] })),
  };
}
