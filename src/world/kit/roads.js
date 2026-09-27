import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { rngKit } from '../../core/util.js';
import { PAL } from '../../core/palette.js';
import { ROADS, MARKINGS } from '../../config.js';
import { asphaltTex, paverTex, concreteTex, ASPHALT_TILE, PAVER_TILE } from './tex.js';
import { LAYER } from './decals.js';

/* ------------------------------------------------------------------ *
 * Roads kit (SPEC section 3): asphalt, pavements, kerbs, lane gutters
 * (側溝) and everything set flush in the road -- manholes, drain grates,
 * gutter lids, patches, cracks, stains, petal drifts, tactile paving.
 *
 * Junction rules (network.js walkEnd): x roads carry their pavement round
 * a corner; z roads butt against it; a lane mouth cuts through a pavement.
 * So no two slabs ever overlap and no corner is left bare.
 * ------------------------------------------------------------------ */

const AY = ROADS.asphaltY;
const WY = ROADS.asphaltY + ROADS.kerbH;

let M = null;
function mats() {
  if (M) return M;
  const asphalt = asphaltTex();
  const paver = paverTex();
  const conc = concreteTex();
  M = {
    asphalt: cel({ color: PAL.road, map: asphalt, bands: 3, tint: 0x6a608f, cache: false }),
    walk: cel({ color: 0xe4dfe8, map: paver, bands: 3, tint: 0x7d74a0, cache: false }),
    kerb: cel({ color: PAL.curb, map: conc, bands: 3, tint: 0x6f6790, cache: false }),
    gutter: cel({ color: PAL.concreteMid, map: conc, bands: 3, tint: 0x6a6288, cache: false }),
  };
  return M;
}

/**
 * A box from (x0, z0) to (x1, z1), top at `top`, `h` deep, whose UVs are
 * world metres / `tile` -- so neighbouring slabs share one continuous
 * texture and nothing stretches.
 */
function slab(x0, z0, x1, z1, top, h, mat, tile, name) {
  const w = x1 - x0, d = z1 - z0;
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x0 + w / 2, top - h / 2, z0 + d / 2);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, x / tile, -z / tile);
    else if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, z / tile, y / tile);
    else uv.setXY(i, x / tile, y / tile);
  }
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  m.name = name;
  return m;
}

/** Rectangle helper on an edge: s0..s1 along, o0..o1 across. */
function edgeRect(e, s0, s1, o0, o1) {
  if (e.axis === 'x') return [Math.min(s0, s1), e.c + Math.min(o0, o1), Math.max(s0, s1), e.c + Math.max(o0, o1)];
  return [e.c + Math.min(o0, o1), Math.min(s0, s1), e.c + Math.max(o0, o1), Math.max(s0, s1)];
}

export function buildRoads(ctx, net, decals) {
  const m = mats();
  const group = new THREE.Group();
  group.name = 'roads';
  ctx.add(group);

  /* ---- junction squares ---- */
  for (const n of Object.values(net.nodes)) {
    if (!n.ax || !n.az || n.external) continue;
    group.add(slab(n.x - n.ax, n.z - n.az, n.x + n.ax, n.z + n.az, AY, 0.06, m.asphalt, ASPHALT_TILE, 'junction'));
  }

  for (const e of net.edges) {
    // a road built elsewhere (the Lawson's): the kit only dresses it
    if (e.opts.surface === false) continue;
    const r = rngKit(e.seed);
    const spec = e.spec;

    /* ---- asphalt ---- */
    if (e.len > 0.01) {
      group.add(slab(...edgeRect(e, e.a0, e.a1, -e.a, e.a), AY, 0.06, m.asphalt, ASPHALT_TILE, 'asphalt'));
    }

    /* ---- pavements and kerbs ---- */
    if (spec.walk > 0) {
      for (const side of [-1, 1]) {
        const s0 = net.walkEnd(e, side, 'lo');
        const s1 = net.walkEnd(e, side, 'hi');
        if (s1 - s0 < 0.05) continue;
        const o0 = side * e.a, o1 = side * e.t;
        const rect = edgeRect(e, s0, s1, o0, o1);
        group.add(slab(...rect, WY, 0.2, m.walk, PAVER_TILE, 'pavement'));
        ctx.platform({ x0: rect[0], z0: rect[1], x1: rect[2], z1: rect[3], top: WY });
        // kerb stones along the road edge
        group.add(slab(...edgeRect(e, s0, s1, o0, o0 + side * 0.18), WY + 0.006, 0.2, m.kerb, 1, 'kerb'));
      }
    }

    /* ---- lane gutters (側溝): concrete strip, lids, a grating now and then ---- */
    if (spec.gutter > 0 && e.len > 0.5) {
      const gw = spec.gutter;
      for (const side of [-1, 1]) {
        const o0 = side * (e.a - gw), o1 = side * e.a;
        group.add(slab(...edgeRect(e, e.a0, e.a1, o0, o1), AY + 0.012, 0.08, m.gutter, 1, 'gutter'));
        const L = MARKINGS.gutterLid;
        const count = Math.floor(e.len / L);
        const off = side * (e.a - gw / 2);
        const f = net.along(e, 1);
        for (let k = 0; k < count; k++) {
          const s = e.a0 + (k + 0.5) * (e.len / count);
          const p = net.at(e, s, off);
          const grating = k % MARKINGS.gratingEvery === 2;
          decals.add(grating ? 'lidGrate' : 'lid', p.x, p.z, gw * 0.96, e.len / count, f, AY + 0.012, LAYER.lid);
        }
      }
    }

    /* ---- set in the road ---- */
    const f = net.along(e, 1);
    const fr = { x: -f.z, z: f.x };        // rotated a quarter: across the road
    const [mh0, mh1] = MARKINGS.manholeEvery;
    let designed = e.cls === 'shopping';        // the spine shows off the town's own lid once per block
    // clear of the painted words (markings.js): numerals 12 m in, 止まれ 4 m in, zebras
    const painted = (s) => [e.a0 + 12, e.a1 - 12, e.a0 + 4.2, e.a1 - 4.2].some((w) => Math.abs(s - w) < 2.2)
      || net.crossings.some((c) => c.e === e && Math.abs(s - c.at) < 4);
    for (let s = e.a0 + r.range(4, 10), next = 0; s < e.a1 - 3; s += next) {
      next = r.range(mh0, mh1);
      if (painted(s)) { next = 1.5; continue; }
      let kind = r.pick(['mhSewer', 'mhSewer', 'mhCity', 'mhWater', 'mhSquare', 'mhRelief', 'mhRelief']);
      if (designed) { kind = 'mhFuji'; designed = false; }
      else if (r.chance(0.12)) kind = 'mhFuji';
      const inner = e.cls === 'main' ? ROADS.main.carriage / 2 - 1 : e.a - (spec.gutter || 0) - 0.8;
      const p = net.at(e, s, r.range(-inner, inner));
      const size = kind === 'mhSquare' ? 0.75 : kind === 'mhFuji' || kind === 'mhRelief' ? 0.62 : r.pick([0.6, 0.75, 0.9]);
      const dir = r.chance(0.5) ? f : fr;
      decals.add(kind, p.x, p.z, size, size, dir, AY, LAYER.lid);
      // the newer asphalt squared off round a lid that has been reset
      if (r.chance(0.45)) decals.add('patchDark', p.x, p.z, size * 2.1, size * 2.1, dir, AY, LAYER.wear);
    }
    // drain grates at the kerb on kerbed roads
    if (spec.walk > 0) {
      const [d0, d1] = MARKINGS.drainEvery;
      for (const side of [-1, 1]) {
        for (let s = e.a0 + r.range(2, 6); s < e.a1 - 1; s += r.range(d0, d1)) {
          const p = net.at(e, s, side * (e.a - 0.26));
          decals.add('grate', p.x, p.z, 0.42, 0.9, f, AY, LAYER.lid);
        }
      }
    }
    // patches, cracks, stains
    const per = e.len / 100;
    for (let k = 0; k < Math.round(MARKINGS.patchesPer100m * per); k++) {
      const p = net.at(e, r.range(e.a0, e.a1), r.range(-e.a * 0.8, e.a * 0.8));
      const long = r.chance(0.4);   // a trench patch running along the road
      decals.add(r.chance(0.6) ? 'patchDark' : 'patchLight', p.x, p.z,
        long ? r.range(0.8, 1.4) : r.range(1.2, 3.2), long ? r.range(4, 9) : r.range(1.2, 3.2),
        r.chance(0.5) ? f : fr, AY, LAYER.wear);
    }
    for (let k = 0; k < Math.round(MARKINGS.cracksPer100m * per); k++) {
      const p = net.at(e, r.range(e.a0, e.a1), r.range(-e.a * 0.9, e.a * 0.9));
      const ang = r.range(-0.6, 0.6) + (r.chance(0.3) ? Math.PI / 2 : 0);
      const dir = { x: f.x * Math.cos(ang) - fr.x * Math.sin(ang), z: f.z * Math.cos(ang) - fr.z * Math.sin(ang) };
      decals.add('crack', p.x, p.z, r.range(0.5, 0.9), r.range(1.5, 3.5), dir, AY, LAYER.wear);
    }
    for (let k = 0; k < Math.round(per * 3); k++) {
      const p = net.at(e, r.range(e.a0, e.a1), r.range(-e.a * 0.5, e.a * 0.5));
      decals.add('stain', p.x, p.z, r.range(0.6, 1.4), r.range(0.8, 1.8), f, AY, LAYER.wear);
    }
    // grit and petals collecting where road meets kerb or gutter
    for (const side of [-1, 1]) {
      const edgeOff = side * (e.a - (spec.gutter || 0) - 0.25);
      for (let k = 0; k < Math.round(MARKINGS.petalsPer100m * per); k++) {
        const p = net.at(e, r.range(e.a0, e.a1), edgeOff);
        decals.add('petals', p.x, p.z, r.range(0.5, 0.9), r.range(1.5, 4), f, AY, LAYER.petals);
      }
      for (let k = 0; k < Math.round(per * 5); k++) {
        const p = net.at(e, r.range(e.a0, e.a1), edgeOff);
        decals.add('leaves', p.x, p.z, 0.5, r.range(1.2, 2.5), f, AY, LAYER.wear);
      }
    }

    /* ---- kerbed streets (town quality pass) ----
     * the concrete L-gutter along each kerb foot, in 1 m pieces (the grates
     * sit in it), small valve and gas lids on the pavement, and on the
     * shopping street the tactile guide line with warning pads at each end */
    if (spec.walk > 0) {
      for (const side of [-1, 1]) {
        const w0 = net.walkEnd(e, side, 'lo'), w1 = net.walkEnd(e, side, 'hi');
        const n = Math.max(1, Math.round(e.len));
        for (let k = 0; k < n; k++) {
          const p = net.at(e, e.a0 + (k + 0.5) * (e.len / n), side * (e.a - 0.17));
          decals.add('lid', p.x, p.z, 0.34, e.len / n + 0.002, f, AY, LAYER.wear);
        }
        for (let s = w0 + r.range(1, 4); s < w1 - 1; s += r.range(5, 11)) {
          // either side of the shopping street's guide line, never on it
          const o = e.cls === 'shopping' ? (r.chance(0.5) ? r.range(0.35, 0.7) : r.range(1.5, spec.walk - 0.3)) : r.range(0.5, spec.walk - 0.4);
          const p = net.at(e, s, side * (e.a + o));
          if (net.quiet(p.x, p.z)) continue;
          const gas = r.chance(0.5);
          decals.add(gas ? 'gasLid' : 'valveLid', p.x, p.z, gas ? 0.26 : 0.32, gas ? 0.26 : 0.32, r.chance(0.5) ? f : fr, WY, LAYER.lid);
        }
        if (e.cls === 'shopping') {
          const off = side * (e.a + spec.walk * 0.5);
          for (let s = w0 + 0.75; s < w1 - 0.75; s += 0.3) {
            const p = net.at(e, s, off);
            decals.add('tactileLine', p.x, p.z, 0.3, 0.3, f, WY, LAYER.paint);
          }
          for (const s of [w0 + 0.45, w1 - 0.45]) {
            const p = net.at(e, s, off);
            tactilePad(decals, p.x, p.z, f);
          }
        }
      }
    }

    /* ---- tactile guide line along main-road pavements ---- */
    if (e.cls === 'main') {
      const side = e.opts.tactileSide ?? 1;
      const s0 = net.walkEnd(e, side, 'lo'), s1 = net.walkEnd(e, side, 'hi');
      const off = side * (e.a + spec.walk * 0.62);
      for (let s = s0 + 0.15; s < s1 - 0.15; s += 0.3) {
        const p = net.at(e, s, off);
        decals.add('tactileLine', p.x, p.z, 0.3, 0.3, f, WY, LAYER.paint);
      }
    }
  }

  return { group, mats: m, walkY: WY, roadY: AY };
}

/** A 3 x 3 pad of warning tiles (point blocks) on a pavement. */
export function tactilePad(decals, x, z, f, n = 3, y = WY) {
  const rx = -f.z, rz = f.x;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 2; j++) {
      const a = (i - (n - 1) / 2) * 0.3, l = (j - 0.5) * 0.3;
      decals.add('tactileDot', x + rx * a + f.x * l, z + rz * a + f.z * l, 0.3, 0.3, f, y, LAYER.paint);
    }
  }
}
