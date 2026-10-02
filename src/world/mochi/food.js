import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ *
 * What ぺったん堂 sells, and what Hachi gets instead (remade 2026-10-02
 * after Tan's play-test: "the mochi looks like shit; eating it looks
 * worse").
 *
 * 抹茶いちご餅: a plump matcha mochi, soft and a little uneven, sagging
 * over the rim of its pleated paper cup, dusted pale on top; a whole
 * strawberry pressed tip-down into it, a ruff of cream where it goes in:
 * round shoulders tapering to the point, deep red and paler at the
 * shoulder, seeds in their dimples, a fresh calyx of seven leaves and the
 * stem, a crisp highlight and a soft sheen.  6.8 cm across, 7.5 cm tall,
 * about 7,400 triangles.
 *
 * The form is geometry (smooth, enough of it for a close look); the fine
 * things are drawn by its own material (`foodMaterial`), in the fragment
 * shader, so they stay crisp at any size: the dusting's speckle, the
 * seeds and their dimples, the highlight, the leaves' veins, the cup's
 * line, and what a bite shows.
 *
 * Eaten (store/eat.js RECIPE.mochi): a bite is a ball cut cleanly out of it.
 * Every surface is clipped against the ball, and the ball's own surface
 * inside the food is the cut: the mochi's pale skin at the rim, white bean
 * paste within, the cream, the strawberry's red rind, pink flesh and white
 * heart.  The first bite draws the mochi out in a strand that thins, sags
 * and snaps (`mochiFx`), with a puff of the dusting at each bite.
 * ------------------------------------------------------------------ */

const MATCHA = 0xb6cf74, SKIN_IN = 0xd9e6a8, ANKO = 0xfdf4dc, CREAM = 0xfffaf0, DUST = 0xf4efcf, DUST_D = 0x86a650;
const BERRY = 0xdc2036, BERRY_D = 0xb3122a, BERRY_PALE = 0xf7b48e, FLESH = 0xf2646a, HEART = 0xfff1ec, SEED = 0xf7dd7c;
const LEAF = 0x6cc04e, LEAF_D = 0x4ea540, LEAF_L = 0xa6dd74, PAPER = 0xfdfaf2, PAPER_LINE = 0x3b4f9c, STRAND = 0xecf3cf;

/* ------------------------------ the shapes ------------------------------ */
const R = 0.034, HU = 0.027, HD = 0.0155;            // the mochi: half width, height above and below its widest
const YC = HD;                                         // (its base on y 0)
const SH = 0.045, SR = 0.0178;                         // the strawberry: tip to shoulder, widest radius
const SINK = 0.2;                                      // how much of it is pressed into the mochi
export const MOCHI_H = YC + HU + SH * (1 - SINK);

/** The mochi's outline round its middle: not quite round. */
const lump = (th) => 1 + 0.035 * Math.sin(2 * th + 0.6) + 0.024 * Math.sin(3 * th + 2.1) + 0.011 * Math.sin(5 * th + 4.0);
/** < 0 inside the mochi (a soft superellipsoid: flat where it rests, a fuller sag just over the cup's rim). */
function mochiF(x, y, z) {
  const th = Math.atan2(z, x);
  const sag = 1 + 0.07 * Math.exp(-(((y - 0.0185) / 0.0075) ** 2)) - 0.1 * Math.exp(-((y / 0.008) ** 2));
  const rr = Math.hypot(x, z) / (R * lump(th) * sag);
  const up = y > YC, q = Math.abs(y - YC) / (up ? HU * (1 + 0.05 * Math.sin(th + 1.0)) : HD);
  return rr ** 2.3 + q ** (up ? 2.1 : 3.4) - 1;
}
const _g = [0, 0, 0];
function mochiGrad(x, y, z) {
  const e = 1e-4;
  _g[0] = mochiF(x + e, y, z) - mochiF(x - e, y, z); _g[1] = mochiF(x, y + e, z) - mochiF(x, y - e, z); _g[2] = mochiF(x, y, z + e) - mochiF(x, y, z - e);
  return _g;
}
/** How deep (m) a point is inside the mochi (- outside). */
function mochiDepth(x, y, z) {
  const g = mochiGrad(x, y, z), l = Math.hypot(g[0], g[1], g[2]) / 2e-4 || 1;
  return -mochiF(x, y, z) / l;
}
/** The strawberry's radius (0..1 of SR) along it: 0 the tip, 1 the shoulder's top. */
const prof = (t) => Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(Math.min(1, Math.max(0, t)), 1.5))), 0.62);
const berryWob = (th) => 1 + 0.035 * Math.cos(3 * th + 0.5);
const BZ = 0.93;                                       // a little flatter front to back
/** The strawberry's own frame (tip at the origin, +y up it) into the mochi's: pressed in at the top, leaning to you. */
const MB = new THREE.Matrix4().makeTranslation(0.0015, YC + HU - 0.0012, 0.001)
  .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.46, 0, -0.2)))
  .multiply(new THREE.Matrix4().makeTranslation(0, -SH * SINK, 0));
const MB_INV = MB.clone().invert();
const _q = new THREE.Vector3();
/** Depth inside the strawberry (m), and how far out from its axis (0..1) in `out`. */
function berryDepth(x, y, z, out = null) {
  _q.set(x, y, z).applyMatrix4(MB_INV);
  const t = _q.y / SH;
  if (t <= 0 || t >= 1) { if (out) out.rho = 1; return -Math.max(-_q.y, _q.y - SH) - 0.0005; }
  const th = Math.atan2(_q.z / BZ, _q.x), r = SR * prof(t) * berryWob(th), rho = Math.hypot(_q.x, _q.z / BZ);
  if (out) out.rho = r > 1e-6 ? rho / r : 1;
  return Math.min(r - rho, _q.y * 0.8, (SH - _q.y) * 0.8);
}
/* the cream: a soft uneven ring where the strawberry goes in */
const CR = { y: SH * SINK + 0.0022, R: (th) => SR * prof(SINK + 0.05) * berryWob(th) + 0.0028 + 0.0007 * Math.sin(4 * th + 1), r: (th) => 0.0043 * (1 + 0.16 * Math.sin(6 * th + 0.4) + 0.1 * Math.sin(11 * th)) };
function creamDepth(x, y, z) {
  _q.set(x, y, z).applyMatrix4(MB_INV);
  const th = Math.atan2(_q.z, _q.x);
  return CR.r(th) - Math.hypot(Math.hypot(_q.x, _q.z) - CR.R(th), _q.y - CR.y);
}

/* ------------------------------ building ------------------------------ */
const KIND = { mochi: 0, berry: 1, leaf: 2, cut: 3, cream: 4, paper: 5, plain: 6 };
const _c = new THREE.Color(), _v = new THREE.Vector3(), _n = new THREE.Vector3();
const rgb = (hex) => { _c.set(hex); return [_c.r, _c.g, _c.b]; };

/**
 * A surface over a grid: `f(u, v)` (0..1 each) returns { p: [x, y, z], n?: [x, y, z], data?: [a, b, c, d] }.
 * Indexed, smooth; where no normal is given it is taken from the faces.
 */
function surf(nu, nv, f, { kind, paint, matrix = null }) {
  const N = (nu + 1) * (nv + 1);
  const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), dat = new Float32Array(N * 4), idx = [];
  let own = true;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const k = j * (nu + 1) + i, o = f(i / nu, j / nv);
    pos.set(o.p, k * 3);
    if (o.n) nor.set(o.n, k * 3); else own = false;
    if (o.data) dat.set(o.data, k * 4);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  if (own) g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); else g.computeVertexNormals();
  const col = new Float32Array(N * 3), kd = new Float32Array(N).fill(KIND[kind]), c = rgb(paint);
  for (let i = 0; i < N; i++) col.set(c, i * 3);
  g.setAttribute('paint', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aKind', new THREE.BufferAttribute(kd, 1));
  g.setAttribute('aData', new THREE.BufferAttribute(dat, 4));
  if (matrix) g.applyMatrix4(matrix);
  return g;
}
/** Make a closed-round surface's seam smooth (its first and last columns are the same points). */
function seam(g, nu, nv) {
  const n = g.attributes.normal;
  for (let j = 0; j <= nv; j++) {
    const a = j * (nu + 1), b = a + nu;
    _n.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, _n.x, _n.y, _n.z); n.setXYZ(b, _n.x, _n.y, _n.z);
  }
  return g;
}

function mochiBody(d) {
  const nu = Math.round(56 * d), nv = Math.round(30 * d);
  return surf(nu, nv, (u, v) => {
    const th = u * Math.PI * 2, ph = (v - 0.5) * Math.PI;
    const dx = Math.cos(ph) * Math.cos(th), dy = Math.sin(ph), dz = Math.cos(ph) * Math.sin(th);
    let a = 0, b = 0.07;
    for (let k = 0; k < 26; k++) { const m = (a + b) / 2; if (mochiF(dx * m, YC + dy * m, dz * m) < 0) a = m; else b = m; }
    const x = dx * a, y = Math.max(0, YC + dy * a), z = dz * a, g = mochiGrad(x, y, z), l = Math.hypot(g[0], g[1], g[2]) || 1;
    return { p: [x, y, z], n: [g[0] / l, g[1] / l, g[2] / l] };
  }, { kind: 'mochi', paint: MATCHA });
}

function berryParts(d) {
  const parts = [];
  /* the body, from just inside the mochi up to the shoulder's top */
  const nu = Math.round(44 * d), nv = Math.round(24 * d), T0 = SINK - 0.1;
  const at = (th, t) => { const r = SR * prof(t) * berryWob(th); return [Math.cos(th) * r, t * SH, Math.sin(th) * r * BZ]; };
  parts.push(surf(nu, nv, (u, v) => {
    const w = (q) => 0.5 - 0.5 * Math.cos(Math.PI * (0.12 + 0.88 * q));                   // (closer rows over the shoulder, where it turns)
    const th = u * Math.PI * 2, t = T0 + (1 - T0) * ((w(v) - w(0)) / (w(1) - w(0)));
    // the normal from the surface's own slopes
    const e = 1e-3, p = at(th, t), pa = at(th + e, t), pb = at(th, Math.min(0.9999, t + e));
    _v.set(pa[0] - p[0], pa[1] - p[1], pa[2] - p[2]); _n.set(pb[0] - p[0], pb[1] - p[1], pb[2] - p[2]).cross(_v).normalize();
    if (t > 0.997) _n.set(0, 1, 0);
    return { p, n: [_n.x, _n.y, _n.z], data: [th, t, 0, 0] };
  }, { kind: 'berry', paint: BERRY, matrix: MB }));

  /* the calyx: seven pointed leaves laid over the shoulders, their tips lifting; the stem */
  const top = (r) => SH * (1 - Math.pow(Math.min(1, r / SR), 1.61) / 4.71);       // the shoulder's height at radius r
  const LEAVES = 7;
  for (let k = 0; k < LEAVES; k++) {
    const a0 = (k / LEAVES) * Math.PI * 2 + 0.25 + 0.22 * Math.sin(k * 2.7), L = 0.0105 + 0.0035 * ((k * 0.618) % 1), W = 0.0038 + 0.001 * ((k * 0.37) % 1);
    const lift = 0.004 + 0.005 * ((k * 0.53 + 0.2) % 1), curl = 0.5 * Math.sin(k * 1.9 + 1);
    const na = Math.max(4, Math.round(8 * d)), nb = d < 0.8 ? 2 : 4;
    const leaf = (flip) => surf(nb, na, (u, v) => {
      const s = v, w = W * Math.pow(Math.sin(Math.PI * Math.pow(0.04 + 0.96 * s, 0.72)), 0.85) * (s > 0.999 ? 0 : 1), ac = (u - 0.5) * 2;
      const r = 0.0012 + L * s, a = a0 + curl * s * s * 0.5;
      // along the shoulder, then up off it; a fold down the middle, the edges a little raised
      const y = top(r) + 0.0006 + lift * Math.pow(Math.max(0, (s - 0.35) / 0.65), 1.6) + 0.0009 * Math.abs(ac) * Math.sin(Math.PI * s) + (flip ? -0.00035 : 0);
      const cx = Math.cos(a), cz = Math.sin(a);
      return { p: [cx * r - cz * ac * w, y, (cz * r + cx * ac * w) * BZ], data: [ac, s, flip ? 1 : 0, 0] };
    }, { kind: 'leaf', paint: flip ? LEAF_L : k % 2 ? LEAF : LEAF_D, matrix: MB });
    parts.push(leaf(false), leaf(true));
  }
  parts.push(surf(8, 4, (u, v) => {
    const th = u * Math.PI * 2, r = v > 0.99 ? 0 : 0.0015 - 0.0004 * v, bend = 0.0035 * v * v;
    return { p: [Math.cos(th) * r + bend, SH - 0.0012 + 0.0105 * v, Math.sin(th) * r - bend * 0.5], data: [0.9, v, 0, 0] };
  }, { kind: 'leaf', paint: LEAF_L, matrix: MB }));
  return parts;
}

function creamRing(d) {
  const nu = Math.round(32 * d), nv = 6;
  return seam(surf(nu, nv, (u, v) => {
    const th = u * Math.PI * 2, ph = v * Math.PI * 2, Rm = CR.R(th), rt = CR.r(th);
    const r = Rm + Math.cos(ph) * rt;
    return { p: [Math.cos(th) * r, CR.y + Math.sin(ph) * rt, Math.sin(th) * r], n: [Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph)] };
  }, { kind: 'cream', paint: CREAM, matrix: MB }), nu, nv);
}

/** The pleated paper cup it sits in. */
const CUP = { h: 0.0165, r0: 0.0262, r1: 0.0372, pleats: 22 };
function paperCup(d) {
  const per = 2, nu = CUP.pleats * per, parts = [];
  const zig = (u) => { const x = (u * CUP.pleats) % 1; return Math.abs(x * 2 - 1) * 2 - 1; };       // -1..1, a pleat a period
  for (const side of [1, -1]) {
    parts.push(surf(nu, 3, (u, v) => {
      const th = u * Math.PI * 2, k = v, r = CUP.r0 + (CUP.r1 - CUP.r0) * Math.pow(k, 0.85) + zig(u) * (0.0003 + 0.0011 * k) - (side < 0 ? 0.0003 : 0);
      const y = k * CUP.h * (1 + 0.035 * zig(u) * k) - 0.0004;
      return { p: [Math.cos(th) * r * lump(th), y, Math.sin(th) * r * lump(th)], data: [k, side, 0, 0] };
    }, { kind: 'paper', paint: PAPER }));
  }
  parts.push(surf(nu / 2, 1, (u, v) => { const th = u * Math.PI * 2, r = v * CUP.r0; return { p: [Math.cos(th) * r * lump(th), -0.0004, Math.sin(th) * r * lump(th)], n: [0, -1, 0], data: [0, 1, 0, 0] }; }, { kind: 'paper', paint: PAPER }));
  return parts;
}

/* ------------------------------ bites ------------------------------ */
const A_SIZE = { position: 3, normal: 3, paint: 3, aKind: 1, aData: 4 };
/** Keep the part of triangle soup `g` where keep(x, y, z) > 0, cutting the triangles that cross (the crossing found on the edge). */
function clip(g, keep) {
  const src = g.index ? g.toNonIndexed() : g;
  const names = Object.keys(A_SIZE), A = names.map((k) => src.attributes[k]), W = names.map((k) => A_SIZE[k]);
  const stride = W.reduce((a, b) => a + b, 0), out = [];
  const read = (i) => { const v = new Float32Array(stride); let o = 0; for (let k = 0; k < A.length; k++) for (let c = 0; c < W[k]; c++) v[o++] = A[k].array[i * W[k] + c]; return v; };
  const cross = (a, b) => {
    // a is kept, b is not: where the edge leaves
    let lo = 0, hi = 1;
    for (let k = 0; k < 12; k++) { const m = (lo + hi) / 2; if (keep(a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m, a[2] + (b[2] - a[2]) * m) > 0) lo = m; else hi = m; }
    const v = new Float32Array(stride);
    for (let c = 0; c < stride; c++) v[c] = a[c] + (b[c] - a[c]) * lo;
    return v;
  };
  const n = src.attributes.position.count;
  for (let i = 0; i < n; i += 3) {
    const t = [read(i), read(i + 1), read(i + 2)], k = t.map((v) => keep(v[0], v[1], v[2]) > 0), cnt = k[0] + k[1] + k[2];
    if (cnt === 3) out.push(t[0], t[1], t[2]);
    else if (cnt === 1) { const a = k.indexOf(true), p = t[a], q = t[(a + 1) % 3], r = t[(a + 2) % 3]; out.push(p, cross(p, q), cross(p, r)); }
    else if (cnt === 2) { const a = k.indexOf(false), p = t[a], q = t[(a + 1) % 3], r = t[(a + 2) % 3], qp = cross(q, p), rp = cross(r, p); out.push(q, r, qp, r, rp, qp); }
  }
  const res = new THREE.BufferGeometry();
  let o = 0;
  for (let k = 0; k < names.length; k++) {
    const arr = new Float32Array(out.length * W[k]);
    for (let i = 0; i < out.length; i++) for (let c = 0; c < W[k]; c++) arr[i * W[k] + c] = out[i][o + c];
    res.setAttribute(names[k], new THREE.BufferAttribute(arr, W[k]));
    o += W[k];
  }
  return res;
}
/** The surface a bite leaves: its ball's skin where that is inside the food (and not in another bite), facing out of the food. */
function cutFace(bites, k, d) {
  const [bx, by, bz, br] = bites[k], rho = { rho: 1 };
  const solid = (x, y, z) => Math.max(y > 0 ? mochiDepth(x, y, z) : -1, berryDepth(x, y, z), creamDepth(x, y, z));
  const g = surf(Math.round(48 * d), Math.round(32 * d), (u, v) => {
    const th = u * Math.PI * 2, ph = (v - 0.5) * Math.PI * 0.9995;
    const nx = Math.cos(ph) * Math.cos(th), ny = Math.sin(ph), nz = Math.cos(ph) * Math.sin(th);
    const x = bx + nx * br, y = by + ny * br, z = bz + nz * br;
    const dm = y > 0 ? mochiDepth(x, y, z) : -1, db = berryDepth(x, y, z, rho);
    return { p: [x, y, z], n: [-nx, -ny, -nz], data: [dm, db, creamDepth(x, y, z), rho.rho] };
  }, { kind: 'cut', paint: ANKO });
  return clip(g, (x, y, z) => {
    let o = solid(x, y, z);
    for (let j = 0; j < bites.length; j++) if (j !== k) o = Math.min(o, Math.hypot(x - bites[j][0], y - bites[j][1], z - bites[j][2]) - bites[j][3]);
    return o;
  });
}

/**
 * The mochi, its base on y 0.  `bites`: [[x, y, z, r], ...] balls bitten out of it.
 * `detail`: 1 for the one in your hand, less for the ones on the tray.
 */
export function mochiGeometry({ bites = [], detail = 1, cup = true } = {}) {
  let parts = [mochiBody(detail), ...berryParts(detail), creamRing(detail)];
  if (bites.length) {
    const out = (x, y, z) => { let o = Infinity; for (const b of bites) o = Math.min(o, Math.hypot(x - b[0], y - b[1], z - b[2]) - b[3]); return o; };
    parts = parts.map((g) => clip(g, out)).filter((g) => g.attributes.position.count);
    for (let k = 0; k < bites.length; k++) { const g = cutFace(bites, k, detail); if (g.attributes.position.count) parts.push(g); }
  }
  if (cup) parts.push(...paperCup(detail));
  const geo = mergeGeometries(bites.length ? parts.map((g) => (g.index ? g.toNonIndexed() : g)) : parts, false);
  for (const g of parts) g.dispose();
  // where each point is in the mochi's own frame, whatever is done to the geometry afterwards (the speckle is drawn from it)
  geo.setAttribute('aObj', new THREE.BufferAttribute(geo.attributes.position.array.slice(), 3));
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  return geo;
}

/**
 * The eating (store/eat.js): whole, after the first bite (a shoulder of the mochi and the strawberry's side), after
 * the second (the other shoulder and the rest of the strawberry).  Centred to be held about its middle.
 */
const HOLD_Y = 0.02;
export function mochiStages() {
  const b1 = [[0.03, 0.04, 0.024, 0.028], [0.013, 0.065, 0.022, 0.0225]];
  const b2 = [...b1, [-0.03, 0.04, 0.024, 0.028], [-0.008, 0.068, 0.016, 0.026], [0.01, 0.086, 0.0, 0.022]];
  const st = [[], b1, b2].map((bites) => mochiGeometry({ bites }).translate(0, -HOLD_Y, 0));
  st.turn = [0.36, -0.3, 0];
  st.seat = [0, 0.018, 0.02];                  // where it sits on your fingers (the anchor's frame)
  st.wrapped = false;                         // nothing to unwrap: it is handed to you in its paper cup
  st.bites = [0.8, 2.25, 3.05];               // when each bite starts (s); the first is long: the mochi draws out
  st.win = [1.3, 0.62, 0.62];                 // how long each takes, in and away again
  st.per = 4.5;
  // the strand leaves from the first bite's lower rim, on the mochi's skin
  const d = new THREE.Vector3(-0.5, -0.42, 0.76).normalize(), p = new THREE.Vector3(b1[0][0], b1[0][1], b1[0][2]).addScaledVector(d, b1[0][3]);
  let lo = 0.5, hi = 1.6;
  for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; if (mochiF(p.x * m, YC + (p.y - YC) * m, p.z * m) < 0) lo = m; else hi = m; }
  st.fx = mochiFx([p.x * lo, YC + (p.y - YC) * lo - HOLD_Y, p.z * lo]);
  return st;
}

/* ------------------------------ the pull, the puff ------------------------------ */
/**
 * What the eating shows besides the food (store/eat.js calls it): `frame(o)` every frame with { view, material, food,
 * bite, x, win, dt } (which bite is on, seconds into it), `puff(b)` as a bite is taken, `end()` when it is over.
 * The strand: the mochi's skin drawn out from the bitten edge to your mouth (just under the lens) as the hand comes
 * away: a tapered ribbon that sags, thins in its middle and snaps; the food's end springs back to a soft point.
 * `from`: where it leaves the food, in the food's own frame.
 */
function mochiFx(from) {
  const N = 18, RAD = 8;
  let strand = null, dust = null, live = [];
  const pos = new Float32Array((N + 1) * RAD * 3), nor = new Float32Array((N + 1) * RAD * 3);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), M = new THREE.Vector3(), P = new THREE.Vector3(), T = new THREE.Vector3(), U = new THREE.Vector3(), S = new THREE.Vector3(), Q = new THREE.Vector3();
  const MOUTH = new THREE.Vector3(0.05, -0.122, -0.2);       // just under the lens: off the bottom of the frame
  const _o = new THREE.Object3D(), _hide = new THREE.Matrix4().makeScale(0, 0, 0);
  const DUSTS = 24;
  function make(view, material) {
    const g = new THREE.BufferGeometry(), idx = [];
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
    const n = (N + 1) * RAD, col = new Float32Array(n * 3);
    // (the mochi's own green where it leaves it, paler as it is drawn thin)
    for (let i = 0; i < n; i++) { const k = Math.min(1, Math.floor(i / RAD) / 5); _c.set(SKIN_IN).lerp(new THREE.Color(STRAND), k); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('paint', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(n).fill(KIND.plain), 1));
    g.setAttribute('aData', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
    g.setAttribute('aObj', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    for (let i = 0; i < N; i++) for (let j = 0; j < RAD; j++) { const a = i * RAD + j, b = i * RAD + ((j + 1) % RAD), c2 = a + RAD, d = b + RAD; idx.push(a, c2, b, b, c2, d); }
    g.setIndex(idx);
    strand = new THREE.Mesh(g, material);
    strand.frustumCulled = false; strand.renderOrder = 11; strand.visible = false;
    dust = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false }), DUSTS);
    dust.frustumCulled = false; dust.renderOrder = 12; dust.userData.noOutline = true;
    for (let i = 0; i < DUSTS; i++) { dust.setMatrixAt(i, _hide); dust.setColorAt(i, _c.set(DUST)); }
    live = Array.from({ length: DUSTS }, () => ({ t: 1, life: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0, crumb: false }));
    view.add(strand, dust);
  }
  /** The ribbon from a (the food) to b along a sagging curve, drawn from s0 to s1 of its length, `w` its width there. */
  function ribbon(a, b, sag, s0, s1, w) {
    M.copy(a).lerp(b, 0.5); M.y -= sag;
    for (let i = 0; i <= N; i++) {
      const s = s0 + (s1 - s0) * (i / N), k = 1 - s;
      P.set(k * k * a.x + 2 * k * s * M.x + s * s * b.x, k * k * a.y + 2 * k * s * M.y + s * s * b.y, k * k * a.z + 2 * k * s * M.z + s * s * b.z);
      T.set(2 * k * (M.x - a.x) + 2 * s * (b.x - M.x), 2 * k * (M.y - a.y) + 2 * s * (b.y - M.y), 2 * k * (M.z - a.z) + 2 * s * (b.z - M.z)).normalize();
      U.set(1, 0, 0).addScaledVector(T, -T.x).normalize(); S.crossVectors(T, U);
      const [wx, wy] = w(s, i / N);
      for (let j = 0; j < RAD; j++) {
        const an = (j / RAD) * Math.PI * 2, c = Math.cos(an), sn = Math.sin(an), o = (i * RAD + j) * 3;
        pos[o] = P.x + U.x * c * wx + S.x * sn * wy; pos[o + 1] = P.y + U.y * c * wx + S.y * sn * wy; pos[o + 2] = P.z + U.z * c * wx + S.z * sn * wy;
        Q.set(U.x * c * wy + S.x * sn * wx, U.y * c * wy + S.y * sn * wx, U.z * c * wy + S.z * sn * wx).normalize();
        nor[o] = Q.x; nor[o + 1] = Q.y; nor[o + 2] = Q.z;
      }
    }
    strand.geometry.attributes.position.needsUpdate = true; strand.geometry.attributes.normal.needsUpdate = true;
  }
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  return {
    frame({ view, material, food, bite, x, win, dt }) {
      if (!strand) make(view, material);
      if (!strand.parent) view.add(strand, dust);
      /* the strand: only in the first bite, once the teeth are in */
      let on = false;
      if (bite === 0 && x >= 0.2 && food.parent) {
        const u = (x - 0.2) / (win - 0.2);                  // 0 the bite .. 1 the hand away again
        const SNAP = 0.62;
        food.updateWorldMatrix(true, false); view.updateWorldMatrix(true, false);
        A.set(from[0], from[1], from[2]); food.localToWorld(A); view.worldToLocal(A);
        B.copy(MOUTH);
        const len = A.distanceTo(B);
        if (u < 1 && len > 0.01) {
          on = true;
          if (u < SNAP) {
            // drawn out: a broad foot on the food, thinning with the stretch, thinnest a little past its middle
            const thin = 1 / (1 + 9 * u), neck = 0.25 + 0.75 * (1 - sm(0.3, 1, u / SNAP));
            ribbon(A, B, 0.012 * sm(0, 0.5, u) + 0.01 * u, 0, 1, (s) => {
              const foot = 0.0075 * Math.exp(-s * 11) + 0.002 * Math.exp(-(1 - s) * 7);
              const mid = (0.0007 + 0.003 * thin) * (1 - (1 - neck) * Math.exp(-(((s - 0.56) / 0.2) ** 2)));
              return [(foot + mid) * 1.3, (foot + mid) * 0.55];
            });
          } else {
            // snapped: the food's end springs back and droops to a soft point; your end is gone
            const k = (u - SNAP) / (1 - SNAP), back = 0.5 * (1 - sm(0, 0.55, k)) + 0.012;
            ribbon(A, B, 0.02 + 0.03 * k, 0, back, (s, f) => { const r = (0.0065 * (1 - sm(0.3, 1, k) * 0.8)) * Math.pow(1 - f, 0.8) + 0.0002; return [r * 1.2, r * 0.6]; });
          }
        }
      }
      strand.visible = on;
      /* the dusting's puff and the crumbs */
      let any = false;
      for (let i = 0; i < DUSTS; i++) {
        const p = live[i];
        if (p.t >= 1) continue;
        p.t += dt / p.life;
        if (p.t >= 1) { dust.setMatrixAt(i, _hide); any = true; continue; }
        p.v.y -= (p.crumb ? 0.9 : 0.3) * dt; p.v.multiplyScalar(1 - (p.crumb ? 0.6 : 2.0) * dt);
        p.p.addScaledVector(p.v, dt);
        _o.position.copy(p.p);
        _o.scale.setScalar(p.r * (1 - p.t * p.t * (p.crumb ? 0.6 : 1)));
        _o.updateMatrix();
        dust.setMatrixAt(i, _o.matrix);
        any = true;
      }
      if (any) dust.instanceMatrix.needsUpdate = true;
    },
    /** A bite is taken: a puff of the dusting off the food, a few crumbs dropping. */
    puff(b, { view, food }) {
      if (!dust) return;
      food.updateWorldMatrix(true, false);
      A.set(from[0] * (b === 1 ? -1.6 : 1), from[1], from[2]); food.localToWorld(A); view.worldToLocal(A);
      let k = 0;
      for (let i = 0; i < DUSTS && k < 11; i++) {
        const p = live[i];
        if (p.t < 1) continue;
        const crumb = k >= 8, a = (k / 8) * Math.PI * 2 + b + 0.9 * Math.sin(k * 7.3);
        p.t = 0; p.crumb = crumb; p.life = crumb ? 0.7 : 0.55 + 0.25 * ((k * 0.37) % 1);
        p.p.copy(A); p.p.x += Math.cos(a) * 0.006; p.p.y += Math.sin(a) * 0.004;
        p.v.set(Math.cos(a) * (crumb ? 0.05 : 0.06 + 0.05 * ((k * 0.37) % 1)), crumb ? 0.03 : 0.05 + 0.05 * Math.sin(a), 0.01);
        p.r = crumb ? 0.0016 + 0.0008 * (k % 2) : 0.0007 + 0.0007 * ((k * 0.61) % 1);
        dust.setColorAt(i, _c.set(crumb ? (k % 2 ? MATCHA : ANKO) : DUST));
        k++;
      }
      dust.instanceColor.needsUpdate = true;
    },
    end() {
      strand?.removeFromParent(); dust?.removeFromParent();
      if (strand) strand.visible = false;
      for (const p of live) p.t = 1;
      if (dust) { for (let i = 0; i < DUSTS; i++) dust.setMatrixAt(i, _hide); dust.instanceMatrix.needsUpdate = true; }
    },
  };
}

/* ------------------------------ the paint ------------------------------ */
const lin = (hex) => { _c.set(hex); return `vec3(${_c.r.toFixed(4)}, ${_c.g.toFixed(4)}, ${_c.b.toFixed(4)})`; };
const VERT = /* glsl */ `
  attribute vec3 paint;
  attribute float aKind;
  attribute vec4 aData;
  attribute vec3 aObj;
  varying vec3 vPaint;
  varying vec3 vN;
  varying vec3 vNo;
  varying vec3 vObj;
  varying vec3 vW;
  varying vec4 vData;
  varying float vKind;
  void main() {
    vPaint = paint; vKind = aKind; vData = aData; vObj = aObj; vNo = normal;
    vN = normalize( mat3( modelMatrix ) * normal );
    vec4 w = modelMatrix * vec4( position, 1.0 );
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
    #ifdef ON_TOP
      gl_Position.z = -gl_Position.w + 0.02 * max( gl_Position.z + gl_Position.w, 0.0001 * gl_Position.w );
    #endif
  }
`;
const FRAG = /* glsl */ `
  uniform vec3 uLight;
  uniform vec3 uBright;
  uniform vec3 uTint;
  varying vec3 vPaint;
  varying vec3 vN;
  varying vec3 vNo;
  varying vec3 vObj;
  varying vec3 vW;
  varying vec4 vData;
  varying float vKind;
  const float SR = ${SR.toFixed(5)};
  const float SH = ${SH.toFixed(5)};
  float hash3( vec3 p ) { p = fract( p * 0.3183099 + vec3( 0.71, 0.113, 0.419 ) ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
  float prof( float t ) { return pow( max( sin( 3.14159265 * pow( clamp( t, 0.0, 1.0 ), 1.5 ) ), 0.0 ), 0.62 ); }
  /* round flecks, one to a cell at most, soft at their edge whatever the size on screen */
  float flecks( vec3 p, float cell, float r0, float r1, float density ) {
    vec3 q = p / cell, id = floor( q ), f = q - id;
    float aa = length( fwidth( q ) ) * 0.7 + 0.02;
    vec3 c = 0.3 + 0.4 * vec3( hash3( id + 11.3 ), hash3( id + 47.7 ), hash3( id + 83.1 ) );
    float r = mix( r0, r1, hash3( id + 5.5 ) ), d = length( f - c );
    return ( 1.0 - smoothstep( r - aa, r + aa, d ) ) * clamp( 1.6 - aa / r, 0.0, 1.0 ) * step( hash3( id ), density );
  }
  void main() {
    vec3 N = normalize( vN ), V = normalize( cameraPosition - vW );
    if ( dot( N, V ) < 0.0 ) N = -N;                  // (thin things, leaves and paper, are seen from both sides)
    vec3 c = vPaint;
    float soft = 0.03, gloss = 0.0, sheen = 0.0;
    if ( vKind < 0.5 ) {
      /* the mochi: paler where the dusting lies (its top and shoulders), a fine pale speckle, a few green flecks */
      float up = normalize( vNo ).y;
      float lie = smoothstep( -0.25, 0.85, up );
      c = mix( c, ${lin(DUST)}, 0.2 * lie * lie );
      float fine = flecks( vObj, 0.0007, 0.2, 0.42, 0.25 + 0.6 * lie ) + flecks( vObj.zxy + 3.1, 0.00115, 0.2, 0.4, 0.1 + 0.5 * lie );
      c = mix( c, ${lin(DUST)}, min( 1.0, fine ) * ( 0.25 + 0.5 * lie ) );
      c = mix( c, ${lin(DUST_D)}, flecks( vObj.yzx + 7.7, 0.0016, 0.12, 0.26, 0.2 ) * 0.5 );
      soft = 0.11; sheen = 0.07;
    } else if ( vKind < 1.5 ) {
      /* the strawberry: deeper to the tip, paler at the shoulder; the seeds in their dimples */
      float th = vData.x, t = vData.y;
      c = mix( ${lin(BERRY_D)}, c, smoothstep( 0.15, 0.6, t ) );
      c = mix( c, ${lin(0xee5a48)}, smoothstep( 0.76, 0.93, t ) );
      c = mix( c, ${lin(BERRY_PALE)}, smoothstep( 0.9, 0.995, t ) );
      const float ROWS = 10.0;
      float row = floor( t * ROWS ), tc = ( row + 0.5 ) / ROWS;
      float n = floor( prof( tc ) * 15.0 + 3.5 );
      float a = th / 6.2831853 * n + 0.5 * mod( row, 2.0 ) + 0.37 * row;
      float cx = ( fract( a ) - 0.5 ) / n * 6.2831853 * prof( tc ) * SR, cy = ( t - tc ) * SH;
      float on = step( 0.14, tc ) * step( tc, 0.9 );
      float aa = fwidth( t ) * SH / 0.0012;
      float fade = clamp( 1.7 - aa, 0.0, 1.0 ) * on;
      float dd = length( vec2( cx, cy ) ) / 0.0021;
      float pit = ( 1.0 - smoothstep( 0.55, 1.0, dd ) ) * fade;
      c = mix( c, c * vec3( 0.66, 0.5, 0.56 ), pit * 0.75 * smoothstep( -0.9, 0.7, cy / 0.0021 ) );
      c += vec3( 0.16, 0.07, 0.06 ) * smoothstep( 0.7, 0.92, dd ) * ( 1.0 - smoothstep( 0.92, 1.2, dd ) ) * smoothstep( 0.2, -0.8, cy / 0.0021 ) * fade;
      float sd = length( vec2( cx / 0.00078, ( cy + 0.0002 ) / 0.00135 ) );
      c = mix( c, ${lin(SEED)}, ( 1.0 - smoothstep( 1.0 - 0.5 * aa, 1.0 + 0.5 * aa, sd ) ) * fade );
      gloss = 1.0 - 0.85 * pit; sheen = 0.26;
    } else if ( vKind < 2.5 ) {
      /* a leaf: the vein down its middle */
      float ac = abs( vData.x ), aa = fwidth( vData.x ) + 0.01;
      c = mix( c, ${lin(LEAF_L)}, ( 1.0 - smoothstep( 0.07, 0.07 + aa, ac ) ) * 0.55 * ( 1.0 - vData.z ) * smoothstep( 1.0, 0.75, vData.y ) );
      sheen = 0.1;
    } else if ( vKind < 3.5 ) {
      /* what a bite shows */
      float dm = vData.x, db = vData.y, dc = vData.z, rho = vData.w;
      if ( db > 0.0 ) {
        float aa = fwidth( db ) + 0.00002;
        vec3 flesh = mix( ${lin(HEART)}, ${lin(FLESH)}, smoothstep( 0.22, 1.0, rho ) * 0.9 );
        flesh = mix( flesh, ${lin(HEART)}, 0.35 * smoothstep( 0.55, 1.0, abs( sin( atan( vObj.z, vObj.x ) * 9.0 + vObj.y * 300.0 ) ) ) * smoothstep( 0.2, 0.6, rho ) * ( 1.0 - smoothstep( 0.7, 0.95, rho ) ) );
        c = mix( ${lin(BERRY)}, flesh, smoothstep( 0.0011 - aa, 0.0011 + aa, db ) );
      } else if ( dc > 0.0 ) {
        c = ${lin(CREAM)};
      } else {
        float aa = fwidth( dm ) + 0.00002;
        vec3 paste = ${lin(ANKO)} * ( 1.0 - 0.06 * flecks( vObj, 0.0012, 0.2, 0.45, 0.6 ) );
        paste = mix( paste, ${lin(0xf3e3bd)}, smoothstep( 0.006, 0.016, dm ) * 0.6 );
        c = mix( ${lin(SKIN_IN)}, paste, smoothstep( 0.0034 - aa, 0.0034 + aa, dm ) );
        c = mix( c, vec3( 1.0 ), ( 1.0 - smoothstep( 0.0, 0.0007 + aa, abs( dm - 0.0034 ) ) ) * 0.5 );
        c = mix( ${lin(MATCHA)}, c, smoothstep( 0.0005 - aa, 0.0005 + aa, dm ) );
      }
      soft = 0.12; sheen = 0.05;
    } else if ( vKind < 4.5 ) {
      soft = 0.12; sheen = 0.12;
    } else if ( vKind < 5.5 ) {
      /* the paper cup: a thin indigo line under its rim */
      float k = vData.x, aa = fwidth( k );
      c = mix( c, ${lin(PAPER_LINE)}, smoothstep( 0.78 - aa, 0.78 + aa, k ) * ( 1.0 - smoothstep( 0.87 - aa, 0.87 + aa, k ) ) * step( 0.0, vData.y ) );
      soft = 0.05;
    } else {
      soft = 0.1; sheen = 0.1;
    }
    float d = dot( N, uLight );
    // two bands, the edge between them soft on what is soft; a third, softer, on the far side
    float lit = smoothstep( 0.16 - soft, 0.16 + soft, d ), deep = 1.0 - smoothstep( -0.5 - soft, -0.5 + soft, d );
    float band = mix( mix( 0.8, 0.69, deep ), 1.0, lit );
    c *= mix( uTint, vec3( 1.0 ), band );
    // gloss: a crisp highlight and a soft sheen round it
    // (painted, not measured: the strawberry leans to you, so a true highlight would hide under its leaves; its
    // light is brought down and toward you, and the highlight sits on the flank you see)
    vec3 H = normalize( normalize( vec3( uLight.x, uLight.y * ( 1.0 - 1.55 * gloss ), uLight.z ) ) + V * ( 1.0 + 0.5 * gloss ) );
    float nh = max( dot( N, H ), 0.0 );
    c += vec3( 1.0, 0.92, 0.9 ) * sheen * pow( nh, 9.0 ) * ( 0.4 + 0.6 * lit );
    float sp = pow( nh, 22.0 ), aw = fwidth( sp ) + 0.015;
    c = mix( c, vec3( 1.0 ), gloss * smoothstep( 0.5 - aw, 0.5 + aw, sp ) * 0.95 );
    c = mix( c, vec3( 1.0 ), gloss * 0.22 * smoothstep( 0.12, 0.5, sp ) );
    gl_FragColor = vec4( c * uBright, 1.0 );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
/**
 * The mochi's material.  `onTop`: drawn over the world and near-clamped, as your hand is (store/figure.js), for the
 * one you hold.  Its light and brightness are the hand's: `follow(skinMat)` copies them each frame.
 */
export function foodMaterial({ onTop = false } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uLight: { value: new THREE.Vector3(-0.35, 0.85, 0.4).normalize() },
      uBright: { value: new THREE.Color(1, 1, 1) },
      uTint: { value: new THREE.Color(0x6c5f8c) },
    },
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
    defines: onTop ? { ON_TOP: 1 } : {},
  });
  m.color = m.uniforms.uBright.value;
  m.follow = (skin) => { m.uniforms.uLight.value.copy(skin.uniforms.uLight.value); m.uniforms.uBright.value.copy(skin.uniforms.uBright.value); };
  return m;
}

/** Hachi's treat (干し芋, dried sweet potato): a thick golden slice, bent a little, paler at its edges. */
export function potatoGeometry() {
  const g = new THREE.BoxGeometry(0.105, 0.012, 0.042, 8, 1, 3);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i), k = 1 - 0.55 * (Math.abs(x) / 0.0525) ** 3;
    P.setXYZ(i, x, P.getY(i) * (0.7 + 0.3 * k) + 0.008 * Math.cos(x * 30), z * k);
  }
  g.computeVertexNormals();
  const col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) { _c.set(Math.abs(P.getX(i)) > 0.04 || Math.abs(P.getZ(i)) > 0.016 ? 0xf0c672 : 0xe2a23e); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
