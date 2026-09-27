import { rngKit } from '../../core/util.js';
import { ROADS, MARKINGS } from '../../config.js';
import { LAYER } from './decals.js';
import { tactilePad } from './roads.js';

/* ------------------------------------------------------------------ *
 * Road markings by rule (SPEC section 3, roads kit).
 *
 *   main       yellow centreline, white edge lines, green cycle lanes with
 *              bikes and arrows, 40 numerals
 *   shopping   white dashed centreline, 30 numerals
 *   lane       white edge lines; some get スクールゾーン with green side
 *              strips, some 歩行者優先
 *   junctions  a minor approach gets a stop line and 止まれ
 *   crossings  zebra, ◇ ahead on each approach, stop lines, tactile pads
 *   bus stops  a yellow box with バス
 *
 * Traffic keeps left.  Returns the features signs.js dresses: stops,
 * crossings, segment starts, bus stops.
 * ------------------------------------------------------------------ */

const AY = ROADS.asphaltY;
/** Worn versions of road words (street/atlas.js). */
const OLD = { tomare: 'tomareOld', n30: 'n30Old' };

/** Heading of the traffic on `side` of an edge (+1 = toward its hi end). */
const headingOn = (e, side) => (e.axis === 'x' ? -side : side);

export function paintMarkings(net, decals) {
  const features = { stops: [], crossings: [], starts: [], busStops: [], edges: [] };

  /** A painted strip from s0 to s1 at `off`, cut in pieces so wear keeps its scale. */
  const strip = (e, cell, s0, s1, off, width, piece = 6, layer = LAYER.paint) => {
    const f = net.along(e, 1);
    const n = Math.max(1, Math.round((s1 - s0) / piece));
    const L = (s1 - s0) / n;
    for (let k = 0; k < n; k++) {
      const p = net.at(e, s0 + (k + 0.5) * L, off);
      decals.add(cell, p.x, p.z, width, L + 0.002, f, AY, layer);
    }
  };
  const dashed = (e, s0, s1, off, width) => {
    const [paint, gap] = MARKINGS.dash;
    const f = net.along(e, 1);
    for (let s = s0 + gap / 2; s + paint <= s1; s += paint + gap) {
      const p = net.at(e, s + paint / 2, off);
      decals.add('white', p.x, p.z, width, paint, f, AY);
    }
  };
  /** Road lettering or a symbol, read by traffic heading `dir`. */
  const word = (e, cell, s, off, across, along, dir) => {
    const p = net.at(e, s, off);
    if (net.quiet(p.x, p.z)) return;
    const f = net.along(e, dir);
    // two in five of the lanes' words are worn half away by tyres (the
    // spine's are repainted: it is the town's showpiece)
    const worn = OLD[cell] && e.cls === 'lane' && (((Math.round(p.x * 7 + p.z * 13) % 5) + 5) % 5) < 2;
    decals.add(worn ? OLD[cell] : cell, p.x, p.z, across, along, f, AY, LAYER.symbol);
  };

  /* ---- along every edge ---- */
  for (const e of net.edges) {
    const r = rngKit(e.seed + 7);
    const spec = e.spec;
    if (e.len < 2) continue;
    const s0 = e.a0, s1 = e.a1;
    const info = { e, school: false, pedPriority: false };
    features.edges.push(info);

    if (e.cls === 'main') {
      const ch = spec.carriage / 2;
      strip(e, 'yellow', s0, s1, 0, 0.15);
      for (const side of [-1, 1]) {
        strip(e, 'white', s0, s1, side * ch, 0.15);
        // cycle lane: green between the edge line and the kerb
        const c0 = ch + 0.12, c1 = e.a - 0.1;
        strip(e, 'green', s0, s1, side * (c0 + c1) / 2, c1 - c0, 5, LAYER.wear);
        const dir = headingOn(e, side);
        for (let s = s0 + 8; s < s1 - 6; s += 18) {
          word(e, 'bike', s, side * (c0 + c1) / 2, 1.1, 1.3, dir);
          word(e, 'arrow', s + dir * 2.4, side * (c0 + c1) / 2, 0.7, 1.4, dir);
        }
      }
    } else if (e.cls === 'hero') {
      /* The Lawson's road keeps its own paint (lawson.js).  Its cycle lanes
       * are the blue 自転車ナビライン: feathered arrows down each lane edge,
       * a bicycle every few. */
      for (const side of [-1, 1]) {
        const dir = headingOn(e, side);
        const off = side * (e.a - 1.0);
        let k = 0;
        for (let s = s0 + 3; s < s1 - 3; s += 6, k++) {
          word(e, k % 5 === 0 ? 'bikeBlue' : 'navi', s, off, 0.75, k % 5 === 0 ? 1.1 : 1.6, dir);
        }
      }
    } else if (e.cls === 'shopping') {
      dashed(e, s0, s1, 0, 0.12);
    } else {
      // lanes: edge lines, and some are school zones with green side strips
      info.school = e.opts.school ?? r.chance(MARKINGS.schoolZoneChance);
      info.pedPriority = e.opts.pedPriority ?? (!info.school && r.chance(MARKINGS.pedPriorityChance));
      const inset = info.school ? 0.7 : MARKINGS.edgeInset;
      const lineOff = e.a - spec.gutter - inset;
      for (const side of [-1, 1]) {
        strip(e, 'white', s0, s1, side * lineOff, 0.12);
        if (info.school) {
          const g0 = lineOff + 0.08, g1 = e.a - spec.gutter;
          strip(e, 'green', s0, s1, side * (g0 + g1) / 2, g1 - g0, 5, LAYER.wear);
        }
      }
    }

    /* speed numerals and lane words near each end, for traffic entering */
    const speedCell = spec.speed >= 40 ? 'n40' : 'n30';
    for (const dir of [1, -1]) {
      if (e.len < 30) break;
      const sIn = dir > 0 ? s0 + 12 : s1 - 12;
      const side = e.axis === 'x' ? -dir : dir;          // the half this traffic uses
      const off = e.cls === 'lane' ? 0 : side * (e.cls === 'main' || e.cls === 'hero' ? spec.carriage / 4 : e.a / 2);
      const across = e.cls === 'lane' ? 1.5 : 1.6;
      word(e, speedCell, sIn, off, across, 2.6, dir);
      if (e.cls === 'lane' && (info.school || info.pedPriority) && e.len > 40) {
        word(e, info.school ? 'school' : 'pedprio', sIn + dir * 5, 0, 2.6, 2.4, dir);
      }
      features.starts.push({ e, s: dir > 0 ? s0 : s1, dir, side, speed: spec.speed, school: info.school });
    }
  }

  /* ---- junctions: minor approaches stop ---- */
  for (const n of Object.values(net.nodes)) {
    if (n.degree < 3) continue;
    const top = n.rank;
    const allEqual = n.edges.every((e) => e.rank === top);
    for (const e of n.edges) {
      const minor = allEqual ? e.axis === 'z' : e.rank < top;
      if (!minor || e.len < 8) continue;
      const dir = e.hi === n ? 1 : -1;                    // heading into the node
      const edgePos = dir > 0 ? e.a1 : e.a0;
      const sStop = edgePos - dir * 1.0;
      const side = e.axis === 'x' ? -dir : dir;
      const inner = e.a - (e.spec.gutter || 0);
      // no lettering where a zebra already fills the approach
      const sWord = sStop - dir * 3.2;
      const zebraThere = net.crossings.some((c) => c.e === e && Math.abs(c.at - sWord) < 4);
      if (e.cls === 'lane') {
        const p = net.at(e, sStop, 0);
        decals.add('white', p.x, p.z, inner * 2, 0.45, net.along(e, dir), AY);
        if (!zebraThere) word(e, 'tomare', sWord, 0, Math.min(2.8, inner * 1.5), 2.6, dir);
      } else {
        const half = e.cls === 'main' ? e.spec.carriage / 2 : inner;
        const p = net.at(e, sStop, side * half / 2);
        decals.add('white', p.x, p.z, half, 0.45, net.along(e, dir), AY);
        if (!zebraThere) word(e, 'tomare', sWord, side * half / 2, Math.min(2.8, half * 0.9), 2.6, dir);
      }
      features.stops.push({ node: n, e, dir, s: sStop, side });
    }
  }

  /* ---- zebra crossings ---- */
  for (const c of net.crossings) {
    const e = c.e;
    const f = net.along(e, 1);
    const L = e.cls === 'main' ? 4 : 3;
    const reach = e.a - (e.spec.gutter || 0) - 0.3;
    for (let o = -reach + 0.225; o <= reach - 0.225 + 1e-6; o += 0.9) {
      const p = net.at(e, c.at, o);
      decals.add('white', p.x, p.z, 0.45, L, f, AY);
    }
    for (const dir of [1, -1]) {
      const side = e.axis === 'x' ? -dir : dir;
      const laneOff = side * (e.cls === 'main' ? e.spec.carriage / 4 : e.a / 2);
      const half = e.cls === 'main' ? e.spec.carriage / 2 : reach;
      // stop line before the zebra, then ◇ further back
      const sl = c.at - dir * (L / 2 + 2);
      const p = net.at(e, sl, side * half / 2);
      decals.add('white', p.x, p.z, half, 0.4, net.along(e, dir), AY);
      for (const d of MARKINGS.diamondAhead) {
        const s = c.at - dir * d;
        if (s < e.a0 + 2 || s > e.a1 - 2) continue;
        word(e, 'diamond', s, laneOff, 1.5, 5, dir);
      }
      if (e.spec.walk > 0) {
        const q = net.at(e, c.at, side * (e.a + 0.45));
        tactilePad(decals, q.x, q.z, net.along(e, 1));
      }
    }
    features.crossings.push({ e, s: c.at, L });
  }

  /* ---- bus stops ---- */
  for (const b of net.busStops) {
    const e = b.e;
    const dir = headingOn(e, b.side);
    const f = net.along(e, dir);
    // the box covers the cycle lane and the kerbside metre of the carriageway
    const inner = e.cls === 'main' ? e.spec.carriage / 2 - 1.3 : e.a - 2.6;
    const o0 = b.side * inner, o1 = b.side * (e.a - 0.1);
    const mid = (o0 + o1) / 2, w = Math.abs(o1 - o0);
    const len = 13;
    for (const d of [-1, 1]) {
      const p = net.at(e, b.at + d * len / 2, mid);
      decals.add('yellow', p.x, p.z, w, 0.15, f, AY, LAYER.symbol);
    }
    const q = net.at(e, b.at, mid);
    const outer = net.at(e, b.at, o1 - b.side * 0.075);
    const inn = net.at(e, b.at, o0 + b.side * 0.075);
    for (const p of [outer, inn]) decals.add('yellow', p.x, p.z, 0.15, len, f, AY, LAYER.symbol);
    decals.add('bus', q.x, q.z, Math.min(w - 0.4, 1.8), 2.6, f, AY, LAYER.symbol);
    features.busStops.push({ ...b, dir });
  }

  return features;
}
