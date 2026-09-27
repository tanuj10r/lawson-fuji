import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { rngKit } from '../../core/util.js';
import { TOWN } from '../../config.js';
import { sheetGeo, boxGeo } from './geo.js';
import { TILE } from './tex.js';

/* ------------------------------------------------------------------ *
 * The paddies (田んぼ) in early April, in the town's frame.
 *
 * Each zone is cut into rows and columns of plots between raised earth
 * paths (畦道: a trodden earth top on grass shoulders).  A plot is one of
 *   flood     flooded, a sky mirror (you cannot walk in it)
 *   seed      flooded, with sparse rows of new seedlings
 *   plough    just ploughed: furrows, clods, puddles
 *   renge     green manure in flower (pink-violet), as April fields are
 * Concrete channels (用水路) run beside the track and along the banks'
 * toes, with small sluice gates where they feed the plots.
 * ------------------------------------------------------------------ */

export const RIDGE = { w: 0.7, top: 0.15, path: 0.36 };
const Y = { flood: 0.05, seed: 0.05, plough: 0.06, renge: 0.065 };

/** Columns from `from` outward (dir ±1) to `to`, widths from the rng. */
function columns(r, from, to, dir) {
  const out = [];
  let x = from;
  while (dir > 0 ? x < to - 6 : x > to + 6) {
    let w = r.range(17, 27);
    const left = Math.abs(to - x);
    if (left - w < 12) w = left;            // no sliver at the end
    const a = x, b = x + dir * w;
    out.push(dir > 0 ? [a, b] : [b, a]);
    x = b;
  }
  return out;
}

/**
 * Lay out every plot.  Returns { plots, ridges, channels }.
 * plots: { x0, x1, z0, z1, kind, zone }
 */
export function planPaddies() {
  const L = TOWN.land;
  const T = L.track;
  const tw0 = T.x - T.w / 2 - 0.8, tw1 = T.x + T.w / 2 + 0.8;   // the track and its shoulders
  const ch = { x0: tw1, x1: tw1 + 0.7 };                        // the channel east of the track
  const plots = [];
  const ridges = [];         // [x0, z0, x1, z1] earth-path rectangles (full width)
  const channels = [];       // { x0, z0, x1, z1 } runs of concrete channel
  const r = rngKit(4101);
  const W = RIDGE.w;

  /* A zone: rows (z ranges) × columns (x ranges), both sides of the track. */
  const zone = (name, rect, rows, { track = true, seed = 1 } = {}) => {
    const rr = rngKit(seed);
    const [zx0, , zx1] = rect;
    const cols = track
      ? [...columns(rr, tw0 - W / 2, zx0, -1).map((c) => ({ c, side: -1 })),
         ...columns(rr, ch.x1 + W / 2, zx1, 1).map((c) => ({ c, side: 1 }))]
      : columns(rr, zx0, zx1, 1).map((c) => ({ c, side: 1 }));
    rows.forEach(([rz0, rz1], ri) => {
      cols.forEach(({ c: [cx0, cx1], side }, ci) => {
        plots.push({ x0: cx0 + W / 2, x1: cx1 - W / 2, z0: rz0 + W / 2, z1: rz1 - W / 2, zone: name, row: ri, side, col: ci, kind: null });
      });
    });
    // ridges: along every row edge, and along every column edge within each row
    const xs = track ? [[zx0, tw0], [ch.x1, zx1]] : [[zx0, zx1]];
    const zEdges = new Set();
    rows.forEach(([a, b]) => { zEdges.add(a); zEdges.add(b); });
    for (const z of zEdges) for (const [a, b] of xs) ridges.push([a, z - W / 2, b, z + W / 2]);
    for (const [a, b] of rows) {
      const xEdges = new Set();
      for (const { c } of cols) { xEdges.add(c[0]); xEdges.add(c[1]); }
      for (const x of xEdges) ridges.push([x - W / 2, a, x + W / 2, b]);
    }
  };

  // near: from the far-side row to the levee's toe (a grass strip and the channel there)
  const nz0 = L.near[1] + 1.6, nz1 = L.near[3] - 0.4;
  const nMid = (nz0 + nz1) / 2 - 0.4;
  zone('near', L.near, [[nz0, nMid], [nMid, nz1]], { seed: 4111 });
  channels.push({ x0: L.near[0], z0: L.near[1] + 0.5, x1: L.near[2], z1: L.near[1] + 1.2, axis: 'x' });
  channels.push({ x0: ch.x0, z0: nz0, x1: ch.x1, z1: nz1, axis: 'z' });

  // far: from the far bank's toe to the tree line
  const fz0 = L.far[1] + 1.4, fz1 = L.far[3] - 1.6;
  const fMid = (fz0 + fz1) / 2 + 0.3;
  zone('far', L.far, [[fz0, fMid], [fMid, fz1]], { seed: 4121 });
  channels.push({ x0: L.far[0], z0: L.far[3] - 1.2, x1: L.far[2], z1: L.far[3] - 0.5, axis: 'x' });
  channels.push({ x0: ch.x0, z0: L.deerGate.z + 6.5, x1: ch.x1, z1: fz1 - 0.1, axis: 'z' });

  // east: the freed block behind the main road's shops
  {
    const [ex0, ez0, ex1, ez1] = L.east;
    const rows = [];
    for (let z = ez0 + 0.6; z < ez1 - 8;) {
      const d = Math.min(r.range(12, 16), ez1 - 0.6 - z);
      rows.push([z, z + d]); z += d;
    }
    rows[rows.length - 1][1] = ez1 - 0.6;
    zone('east', [ex0 + 0.6, ez0, ex1 - 0.6, ez1], rows, { track: false, seed: 4131 });
  }

  /* ---- what grows where: a seeded mix, with a few set by hand so the
   * walk up the track passes each kind close by ---- */
  const kr = rngKit(4141);
  for (const p of plots) {
    const t = kr.next();
    p.kind = t < 0.46 ? 'flood' : t < 0.54 ? 'seed' : t < 0.78 ? 'plough' : 'renge';
  }
  const set = (zoneName, row, side, col, kind) => {
    const p = plots.find((q) => q.zone === zoneName && q.row === row && q.side === side && plots.filter((o) => o.zone === zoneName && o.row === row && o.side === side).indexOf(q) === col);
    if (p) p.kind = kind;
  };
  set('near', 1, 1, 0, 'flood');      // right of the track, as you leave the road
  set('near', 1, -1, 0, 'seed');      // left of it: the first seedlings
  set('near', 1, -1, 1, 'flood');
  set('near', 1, 1, 1, 'renge');
  set('near', 0, 1, 0, 'plough');     // up by the levee: the pump shed's side
  set('near', 0, -1, 0, 'renge');     // the scarecrow's
  set('near', 0, -1, 1, 'flood');
  set('far', 0, -1, 0, 'flood');
  set('far', 0, 1, 0, 'renge');
  set('far', 1, 1, 0, 'flood');
  set('far', 1, -1, 0, 'plough');

  /* Carve out the pump shed's apron and the gate's forecourt: plots that
   * meet them are shortened (the ridges stay; they read as the apron's
   * edge). */
  const keep = [
    [tw1 + 0.7, L.near[1], tw1 + 13, L.near[1] + 7.5],               // the pump shed and the kei truck
    [L.deerGate.x - 7, L.deerGate.z - 2, L.deerGate.x + 7, L.deerGate.z + 6.5],   // the gate's forecourt
  ];
  const out = [];
  for (const p of plots) {
    let q = { ...p };
    for (const k of keep) {
      if (q.x1 <= k[0] || q.x0 >= k[2] || q.z1 <= k[1] || q.z0 >= k[3]) continue;
      // keep the larger part of the plot outside the rectangle, along z
      const a = k[1] - W / 2 - q.z0, b = q.z1 - (k[3] + W / 2);
      if (Math.max(a, b) < 4) { q = null; break; }
      if (a >= b) q.z1 = k[1] - W / 2; else q.z0 = k[3] + W / 2;
    }
    if (q) out.push(q);
  }
  return { plots: out, ridges, channels, keep, trackEdge: [tw0, tw1], channelX: ch };
}

/** Build the paddies into `parts` (and `scatter`), colliders into ctx. */
export function buildPaddies(ctx, parts, scatter, water, plan) {
  const { plots, ridges, channels } = plan;
  const r = rngKit(4201);

  /* ---- plot surfaces: one mesh per kind ---- */
  const flood = [];
  for (const p of plots) {
    if (p.kind === 'flood' || p.kind === 'seed') {
      flood.push(sheetGeo(p.x0, p.x1, p.z0, p.z1, Y.flood, TILE.water));
      // flooded plots are not for walking: the earth paths are
      ctx.collide(p.x0 + 0.3, p.z0 + 0.3, p.x1 - 0.3, p.z1 - 0.3, 1.0);
    } else if (p.kind === 'plough') {
      // furrows run along the plot's long side
      const along = p.x1 - p.x0 > p.z1 - p.z0;
      parts.add('plough', sheetGeo(p.x0, p.x1, p.z0, p.z1, Y.plough, TILE.plough, { rot: along }));
    } else {
      parts.add('renge', sheetGeo(p.x0, p.x1, p.z0, p.z1, Y.renge, TILE.renge));
    }
    // a muddy lip round every plot, where the water meets the path
    const lip = 0.18;
    for (const [a, b, c, d] of [
      [p.x0, p.x1, p.z0, p.z0 + lip], [p.x0, p.x1, p.z1 - lip, p.z1],
      [p.x0, p.x0 + lip, p.z0, p.z1], [p.x1 - lip, p.x1, p.z0, p.z1],
    ]) parts.add('mud', sheetGeo(a, b, c, d, Y.renge + 0.004));
  }

  /* ---- the earth paths: grass shoulders, a trodden top ---- */
  for (const [x0, z0, x1, z1] of ridges) {
    const alongX = x1 - x0 > z1 - z0;
    parts.box('ridgeGrass', x0, x1, 0, RIDGE.top - 0.03, z0, z1);
    const inset = (RIDGE.w - RIDGE.path) / 2;
    if (alongX) parts.box('ridgeTop', x0, x1, RIDGE.top - 0.05, RIDGE.top, z0 + inset, z1 - inset);
    else parts.box('ridgeTop', x0 + inset, x1 - inset, RIDGE.top - 0.05, RIDGE.top, z0, z1);
    // weeds along the shoulders, dandelions here and there
    const len = alongX ? x1 - x0 : z1 - z0;
    const n = Math.floor(len / 1.6);
    for (let i = 0; i < n; i++) {
      const t = (i + r.next()) / n;
      const s = r.sign() * (RIDGE.w / 2 - 0.06);
      const x = alongX ? x0 + (x1 - x0) * t : (x0 + x1) / 2 + s;
      const z = alongX ? (z0 + z1) / 2 + s : z0 + (z1 - z0) * t;
      const h = r.range(0.12, 0.26);
      scatter.put('tuft', x, RIDGE.top - 0.04, z, h * 0.9, h, h * 0.9, r.range(0, 6.3), r.pick([0x7fa65a, 0x8db265, 0x74985a]));
      if (r.chance(0.12)) scatter.put('head', x + 0.03, RIDGE.top - 0.04 + h * 0.8, z, 0.04, 0.03, 0.04, 0, r.chance(0.7) ? 0xf4cf3a : 0xfbfaf0);
    }
  }

  /* ---- seedlings: sparse rows across the flooded plots marked 'seed' ---- */
  for (const p of plots.filter((q) => q.kind === 'seed')) {
    const alongX = p.x1 - p.x0 > p.z1 - p.z0;
    const rowGap = 0.36, hillGap = 0.34;
    const [a0, a1] = alongX ? [p.x0 + 0.4, p.x1 - 0.4] : [p.z0 + 0.4, p.z1 - 0.4];
    const [b0, b1] = alongX ? [p.z0 + 0.4, p.z1 - 0.4] : [p.x0 + 0.4, p.x1 - 0.4];
    // planted from one side, not yet finished: the far part still bare water
    const stop = a0 + (a1 - a0) * r.range(0.55, 0.8);
    for (let b = b0; b < b1; b += rowGap) {
      for (let a = a0; a < stop; a += hillGap) {
        if (r.chance(0.06)) continue;
        const x = alongX ? a : b + r.range(-0.03, 0.03);
        const z = alongX ? b + r.range(-0.03, 0.03) : a;
        const h = r.range(0.13, 0.19);
        scatter.put('tuft', x, Y.flood - 0.02, z, 0.5 * h, h, 0.5 * h, r.range(0, 6.3), r.pick([0x98c95c, 0x8cc257, 0xa4d066]));
      }
    }
  }

  /* ---- renge in flower: tufts and heads over the painted carpet ---- */
  for (const p of plots.filter((q) => q.kind === 'renge')) {
    const n = Math.floor((p.x1 - p.x0) * (p.z1 - p.z0) * 0.5);
    for (let i = 0; i < n; i++) {
      const x = r.range(p.x0 + 0.2, p.x1 - 0.2), z = r.range(p.z0 + 0.2, p.z1 - 0.2);
      const h = r.range(0.1, 0.18);
      scatter.put('tuft', x, Y.renge - 0.01, z, h * 1.3, h, h * 1.3, r.range(0, 6.3), r.pick([0x86b062, 0x7ba65a]));
      scatter.put('head', x, Y.renge + h * 0.9, z, 0.07, 0.05, 0.07, r.range(0, 6.3), r.pick([0xd47fc2, 0xc670b8, 0xe6a0d4]));
    }
  }

  /* ---- plough: a few clods standing proud ---- */
  for (const p of plots.filter((q) => q.kind === 'plough')) {
    const n = Math.floor((p.x1 - p.x0) * (p.z1 - p.z0) * 0.05);
    for (let i = 0; i < n; i++) {
      const s = r.range(0.08, 0.16);
      scatter.put('stone', r.range(p.x0 + 0.3, p.x1 - 0.3), Y.plough, r.range(p.z0 + 0.3, p.z1 - 0.3), s * 1.4, s, s, r.range(0, 6.3), r.pick([0x7a6048, 0x8a6e52]));
    }
  }

  /* ---- the water meshes: plots and channels together ---- */
  const chWater = [];
  for (const c of channels) {
    const alongX = c.axis === 'x';
    const t = 0.1;   // wall thickness
    const top = 0.2;
    if (alongX) {
      parts.box('concrete', c.x0, c.x1, 0, top, c.z0, c.z0 + t);
      parts.box('concrete', c.x0, c.x1, 0, top, c.z1 - t, c.z1);
      chWater.push(sheetGeo(c.x0, c.x1, c.z0 + t, c.z1 - t, 0.13, TILE.water));
    } else {
      parts.box('concrete', c.x0, c.x0 + t, 0, top, c.z0, c.z1);
      parts.box('concrete', c.x1 - t, c.x1, 0, top, c.z0, c.z1);
      chWater.push(sheetGeo(c.x0 + t, c.x1 - t, c.z0, c.z1, 0.13, TILE.water));
    }
    parts.box('concreteDark', alongX ? c.x0 : c.x0 + t, alongX ? c.x1 : c.x1 - t, 0, 0.1, alongX ? c.z0 + t : c.z0, alongX ? c.z1 - t : c.z1);
  }
  const waterMesh = new THREE.Mesh(mergeFlat([...flood, ...chWater]), water.paddy);
  waterMesh.name = 'land-paddy-water';
  waterMesh.userData.dynamic = true;
  waterMesh.receiveShadow = false;
  ctx.add(waterMesh);

  /* ---- sluice gates where the side channel feeds a flooded plot ---- */
  const cx = plan.channelX;
  for (const p of plots) {
    if (p.side !== 1 || p.col !== 0 || p.zone === 'east' || !(p.kind === 'flood' || p.kind === 'seed')) continue;
    sluice(parts, cx.x1 - 0.05, (p.z0 + p.z1) / 2, 'x');
  }
  for (const p of plots) {
    if (p.zone !== 'near' || p.row !== 0 || !(p.kind === 'flood' || p.kind === 'seed') || p.col % 2) continue;
    sluice(parts, (p.x0 + p.x1) / 2, TOWN.land.near[1] + 0.85, 'z');
  }
  return { water: waterMesh };
}

function mergeFlat(geos) {
  const g = new THREE.BufferGeometry();
  const pos = [], uv = [], nrm = [], idx = [];
  let base = 0;
  for (const s of geos) {
    const p = s.attributes.position, u = s.attributes.uv;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); uv.push(u.getX(i), u.getY(i)); nrm.push(0, 1, 0); }
    const ix = s.index.array;
    for (let i = 0; i < ix.length; i++) idx.push(ix[i] + base);
    base += p.count;
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

/** A small sluice gate (水門): a steel plate in a frame, a handwheel on top. */
function sluice(parts, x, z, across) {
  const w = 0.62, h = 0.72;
  const ax = across === 'x';
  const [dx, dz] = ax ? [0.04, w / 2] : [w / 2, 0.04];
  // the frame's two posts and head
  for (const s of [-1, 1]) {
    const px = ax ? x : x + s * w / 2, pz = ax ? z + s * w / 2 : z;
    parts.add('steel', boxGeo(px - 0.035, px + 0.035, 0, h, pz - 0.035, pz + 0.035));
  }
  parts.add('steel', boxGeo(x - (ax ? 0.05 : w / 2 + 0.04), x + (ax ? 0.05 : w / 2 + 0.04), h - 0.06, h, z - (ax ? w / 2 + 0.04 : 0.05), z + (ax ? w / 2 + 0.04 : 0.05)));
  // the plate, half raised
  parts.add('steelBlue', boxGeo(x - dx, x + dx, 0.12, 0.46, z - dz, z + dz));
  // spindle and wheel
  parts.add('steel', boxGeo(x - 0.012, x + 0.012, h, h + 0.16, z - 0.012, z + 0.012));
  const wheel = new THREE.TorusGeometry(0.13, 0.014, 4, 10);
  wheel.rotateX(Math.PI / 2);
  wheel.translate(x, h + 0.16, z);
  parts.add('steelRed', wheel);
}

/** The land's materials shared by the parts. */
export function landMats(tex) {
  return {
    plough: cel({ color: 0xffffff, bands: 3, tint: 0x6a5a78, map: tex.plough }),
    renge: cel({ color: 0xffffff, bands: 3, tint: 0x5b6f8c, map: tex.renge }),
    mud: cel({ color: 0x7d6650, bands: 3, tint: 0x5e5070 }),
    ridgeGrass: cel({ color: 0x8fb36a, bands: 3, tint: 0x55708a }),
    ridgeTop: cel({ color: 0xa88e6e, bands: 3, tint: 0x655676 }),
    concrete: cel({ color: 0xd2cec4, bands: 3, tint: 0x6f6790 }),
    concreteDark: cel({ color: 0x9c9a92, bands: 3, tint: 0x5f5880 }),
    steel: cel({ color: 0x7c8088, bands: 3, tint: 0x4f4a70 }),
    steelBlue: cel({ color: 0x6f96b4, bands: 3, tint: 0x4a5a86 }),
    steelRed: cel({ color: 0xc8483a, bands: 3, tint: 0x6a3a5a }),
  };
}
