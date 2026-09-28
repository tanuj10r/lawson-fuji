import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { JP } from '../kit/tex.js';

/* ------------------------------------------------------------------ *
 * Han's car: the Mazda RX-7 (FD3S) in the VeilSide Fortune widebody,
 * orange with the black side sweep, from The Fast and the Furious:
 * Tokyo Drift (Tan's one real-name exception, docs/EXPERIENCES.md).
 *
 * A hero object, so it is not a vehicles.js table row: the body is a
 * smooth loft of cross-sections along the car, the way the FD's shape
 * is really made (a low nose between tall front fenders, the widebody's
 * flared hips, the double-bubble glasshouse and the wrap-round hatch
 * glass), cel-shaded in bands like everything else.
 *
 * Authored in the vehicle convention (vehicles.js): along +x with the
 * nose at +x, origin on the ground at the footprint's centre.  The right
 * side (+z) is the driver's: the car is right-hand drive.
 *
 *   body   one loft: floor, wheel wells and flared arch lips, the sides,
 *          and the top curve over the hood, fenders and deck.  Paint is a
 *          side-projected Canvas2D texture (orange, the black sweep, the
 *          shut lines), so both sides and the tops share one small map.
 *   cabin  a second loft blended up out of the body's top: windscreen,
 *          roof, hatch.  Its glass is cut out of the same grid, so the
 *          window edges are exact, and the interior shows through.
 *   door   the driver's door skin and its glass, cut from the same grids,
 *          on a hinge: Han gets in and out (han/index.js).
 *   wheels two InstancedMeshes, colours per vertex: what turns (tyre, chrome
 *          multi-spoke rim) and what only steers (disc, red caliper): two
 *          draws for all four wheels.
 * ------------------------------------------------------------------ */

export const RX7 = {
  L: 4.36, W: 1.98, H: 1.25,
  axle: { f: 1.23, r: -1.2 },
  R: 0.325,                        // tyre radius
  track: { f: 0.80, r: 0.795 },    // wheel centre from the centreline
  door: [-0.56, 0.62],              // the door's rear and front (hinge) edges
};
const HL = RX7.L / 2;
const ARCH = 0.372;                // wheel-arch radius: a slammed car
const N = 2.6;                     // the top curve's superellipse exponent (a soft shoulder)
const TUCK = 0.075;                // how far the shoulder sits in from the side's widest point (less round the narrow nose)
const tuckAt = (W) => TUCK * THREE.MathUtils.clamp((W - 0.45) / 0.45, 0.25, 1);
const A_BELT = 0.62;               // where the cabin stands on the top curve (the belt: 88% of the half-width)
const PAINT_V = 1.3;               // the paint map's side band: height in metres
const SIDE_V = 300 / 460;          // the side band's share of the map; above it the plan band (the tops)

/* ---------------------------- the shape ---------------------------- */

/** A smooth, non-overshooting curve through [x, y] points (x ascending). */
function spline(pts) {
  const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {            // Fritsch-Carlson
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i]
      + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// half-width: the Fortune's hips over the rear wheels, the round nose in plan
const halfW = spline([[-2.18, 0.8], [-2.12, 0.9], [-1.95, 0.97], [-1.55, 0.995], [-1.2, 0.99], [-0.8, 0.965],
  [-0.35, 0.93], [0.25, 0.92], [0.85, 0.935], [1.23, 0.95], [1.55, 0.93], [1.85, 0.87], [2.03, 0.78], [2.13, 0.66], [2.18, 0.54]]);
// the floor: a front splitter low over the road, the diffuser kicking up at the tail
const floorY = spline([[-2.18, 0.27], [-1.95, 0.22], [-1.55, 0.14], [1.45, 0.13], [1.95, 0.16], [2.18, 0.17]]);
const sillY = spline([[-2.18, 0.27], [-1.95, 0.22], [-1.55, 0.16], [1.45, 0.16], [1.95, 0.17], [2.18, 0.17]]);
// the shoulder, where the sides turn into the top: an FD's belt is about 0.85 m
// at the door, higher over the hips, falling away down the long nose
const shoulderY = spline([[-2.18, 0.78], [-1.95, 0.86], [-1.5, 0.885], [-1.2, 0.875], [-0.75, 0.82], [-0.2, 0.78], [0.4, 0.78], [0.85, 0.8], [1.23, 0.83], [1.55, 0.79], [1.85, 0.68], [2.05, 0.58], [2.18, 0.5]]);
// the top along the centre: the low bonnet sunk between the fenders, falling to the round nose; the ducktail at the back
const topY = spline([[-2.18, 0.86], [-2.1, 0.94], [-1.98, 0.975], [-1.7, 0.985], [-1.1, 0.95], [-0.3, 0.9], [0.45, 0.855], [0.9, 0.8],
  [1.4, 0.72], [1.8, 0.645], [2.05, 0.585], [2.18, 0.535]]);
// the fenders stand proud of the bonnet (the FD's signature), the round hips over the rear wheels
const fender = (x) => 0.065 * Math.exp(-(((x - 1.2) / 0.42) ** 2)) + 0.06 * Math.exp(-(((x + 1.22) / 0.55) ** 2));

const pw = (c) => Math.sign(c) * Math.abs(c) ** (2 / N);

function archY(x) {
  let y = -1;
  for (const a of [RX7.axle.f, RX7.axle.r]) {
    const d = Math.abs(x - a);
    if (d < ARCH) y = Math.max(y, RX7.R + Math.sqrt(ARCH * ARCH - d * d));
  }
  return y;
}

/** A point on the top curve at station x, a in [0 (side), PI/2 (centre)]. */
function topPoint(x, a) {
  const W = halfW(x) - tuckAt(halfW(x)), ySh = shoulderY(x), yT = topY(x);
  const lat = W * pw(Math.cos(a));
  const k = lat / W;
  const y = ySh + (yT - ySh) * pw(Math.sin(a)) + fender(x) * Math.exp(-(((k - 0.78) / 0.24) ** 2));
  return [lat, y];
}

/* The body's half-section at station x: bottom centre to top centre.
 * Each entry [lat, y, shade, tag]: shade darkens the underside and wells;
 * tag marks the door's rows. */
const TOP_A = [];
for (let i = 0; i <= 6; i++) TOP_A.push(A_BELT * i / 6);
for (let i = 1; i <= 10; i++) TOP_A.push(A_BELT + (Math.PI / 2 - A_BELT) * i / 10);
function bodySection(x) {
  const W = halfW(x), yF = floorY(x);
  const yS = Math.max(sillY(x), archY(x));
  const Wi = Math.min(W - 0.4, 0.56), lip = W - 0.05;
  const ySh = shoulderY(x);
  const pts = [
    [0, yF, 0.3], [Wi * 0.5, yF, 0.3], [Wi, yF, 0.3], [Wi, (yF + yS) / 2, 0.3], [Wi, yS, 0.3],
    [(Wi + lip) / 2, yS, 0.3], [lip - 0.015, yS, 0.45],
  ];
  // the side: from the lip up to the shoulder, tucked in at the sill, fullest
  // just above the middle, rolling in again toward the shoulder
  const y0 = yS + 0.012, y1 = Math.max(ySh, y0 + 0.004);
  for (let i = 0; i <= 8; i++) {
    const k = i / 8;
    pts.push([W - 0.09 * (1 - k) ** 2 - tuckAt(W) * k ** 2.2, y0 + (y1 - y0) * k, 1, 'side']);
  }
  // the top curve (skipping a = 0: the shoulder is the side's last point);
  // over a wheel it never dips below the arch.  The belt point is doubled,
  // once as the side's last and once as the top's first, so the paint's two
  // bands (side, plan) meet there without a smeared quad.
  for (let i = 1; i < TOP_A.length; i++) {
    const [lat, y] = topPoint(x, TOP_A[i]);
    const yy = lat > Wi ? Math.max(y, y1) : y;
    if (Math.abs(TOP_A[i] - A_BELT) < 1e-6) { pts.push([lat, yy, 1, 'side'], [lat, yy, 1, 'top']); continue; }
    pts.push([lat, yy, 1, TOP_A[i] < A_BELT ? 'side' : 'top']);
  }
  return pts;
}
const SEC_N = bodySection(0).length;

/* ------------------------- the cabin's shape ------------------------ */
const CAB = { cowl: 0.45, rf: -0.3, rr: -0.72, tail: -1.9, phiE: 0.55 };
const roofY = spline([[-1.9, 1.0], [-1.4, 1.13], [-0.72, 1.225], [-0.5, 1.235], [-0.3, 1.232], [0.45, 1.17]]);
const roofW = spline([[-1.9, 0.44], [-1.3, 0.53], [-0.72, 0.57], [-0.3, 0.57], [0.45, 0.55]]);
/** How far the cabin stands up out of the body top: 0 at the cowl and the tail. */
function cabH(x) {
  if (x >= CAB.cowl) return 0;
  // the windscreen: fast and nearly straight, rounding only into the header
  if (x > CAB.rf) { const t = (CAB.cowl - x) / (CAB.cowl - CAB.rf); return 1 - (1 - t) ** 1.7; }
  if (x >= CAB.rr) return 1;
  // the hatch glass: a long fastback, holding the roofline then sweeping down to the deck
  if (x > CAB.tail) { const t = (CAB.rr - x) / (CAB.rr - CAB.tail); return Math.cos(t * Math.PI / 2) ** 0.7; }
  return 0;
}
/** The double-bubble roof panel: two shallow domes over the seats, and only there. */
const bubble = (x) => THREE.MathUtils.smoothstep(x, -1.05, -0.8) * (1 - THREE.MathUtils.smoothstep(x, -0.2, 0.05));
/** A point on the cabin: phi 0 on the crown's centre, 1 at the belt. */
function cabinPoint(x, phi) {
  const a = Math.PI / 2 - phi * (Math.PI / 2 - A_BELT);
  const [bl, by] = topPoint(x, a);
  const [wb, yb] = topPoint(x, A_BELT);
  const Wr = roofW(x), yR = roofY(x);
  let lat, y;
  if (phi <= CAB.phiE) {
    const t = phi / CAB.phiE;
    lat = Wr * t;
    y = yR - 0.075 * t * t + 0.03 * Math.sin(Math.PI * t) ** 2 * bubble(x);
  } else {
    const t = (phi - CAB.phiE) / (1 - CAB.phiE);
    lat = Wr + (wb - Wr) * t ** 1.35;
    y = yR - 0.075 + (yb - (yR - 0.075)) * (t * t * 0.35 + t * 0.65);
  }
  const h = cabH(x);
  return [bl + (lat - bl) * h, by + (y - by) * h];
}

/* ------------------------- grids to geometry ------------------------ */

/** Positions on a grid (rows i along the car, columns j round the section),
 * smooth normals from the whole grid, then the quads split into parts by
 * `classify(i, j)` -> key.  Returns { key: BufferGeometry }. */
function gridParts(P, { closed = false, classify, uv, shade }) {
  const ni = P.length, nj = P[0].length;
  const pos = new Float32Array(ni * nj * 3), col = new Float32Array(ni * nj * 3), uvs = new Float32Array(ni * nj * 2);
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
    const k = i * nj + j, p = P[i][j];
    pos.set([p[0], p[1], p[2]], k * 3);
    const s = shade ? shade(i, j) : 1;
    col.set([s, s, s], k * 3);
    const u = uv(p, i, j);
    uvs.set(u, k * 2);
  }
  const all = [];
  const byKey = new Map();
  const jn = closed ? nj : nj - 1;
  for (let i = 0; i < ni - 1; i++) for (let j = 0; j < jn; j++) {
    const j1 = (j + 1) % nj;
    const a = i * nj + j, b = (i + 1) * nj + j, c = (i + 1) * nj + j1, d = i * nj + j1;
    const tri = [a, b, d, b, c, d];
    all.push(...tri);
    const key = classify(i, j);
    if (key === null) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(...tri);
  }
  const full = new THREE.BufferGeometry();
  full.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  full.setIndex(all);
  full.computeVertexNormals();
  const nrm = full.getAttribute('normal').array;
  // columns that share a point (the belt, doubled for the paint) share a normal too, or the ink finds a seam
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj - 1; j++) {
    const a = P[i][j], b = P[i][j + 1];
    if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) continue;
    const ka = (i * nj + j) * 3, kb = ka + 3;
    const x = nrm[ka] + nrm[kb], y = nrm[ka + 1] + nrm[kb + 1], z = nrm[ka + 2] + nrm[kb + 2], l = Math.hypot(x, y, z) || 1;
    nrm[ka] = nrm[kb] = x / l; nrm[ka + 1] = nrm[kb + 1] = y / l; nrm[ka + 2] = nrm[kb + 2] = z / l;
  }
  const out = {};
  for (const [key, idx] of byKey) {
    // re-index to the vertices this part uses
    const map = new Map(), P2 = [], N2 = [], C2 = [], U2 = [], I2 = [];
    for (const v of idx) {
      if (!map.has(v)) {
        map.set(v, map.size);
        P2.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
        N2.push(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]);
        C2.push(col[v * 3], col[v * 3 + 1], col[v * 3 + 2]);
        U2.push(uvs[v * 2], uvs[v * 2 + 1]);
      }
      I2.push(map.get(v));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N2, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C2, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U2, 2));
    g.setIndex(I2);
    out[key] = g;
  }
  full.dispose();
  return out;
}

const paintUV = (p) => [(p[0] + HL) / RX7.L, (p[1] / PAINT_V) * SIDE_V];             // the side band: (x, height)
const planUV = (p) => [(p[0] + HL) / RX7.L, SIDE_V + (1 - SIDE_V) * (0.5 + p[2] / 2)];   // the plan band: (x, across)

/** Stations along x: an even step plus every edge that must be exact. */
function stations(x0, x1, step, extra) {
  const s = new Set();
  for (let x = x0; x < x1 - 1e-6; x += step) s.add(+x.toFixed(4));
  s.add(x1);
  for (const e of extra) if (e > x0 && e < x1) s.add(+e.toFixed(4));
  return [...s].sort((a, b) => a - b);
}

/* ------------------------------ paint ------------------------------ */
const ORANGE = '#ff7d22';
const BLACK = '#26242c';
/* The sweep: black from behind the front wheel, rising along the door to
 * the rear hip, where it runs out over the rear arch. */
export function sweepTop(x) {
  if (x > 0.86 || x < -1.55) return -1;
  const t = THREE.MathUtils.smoothstep(x, -0.83, 0.86);    // 1 at the front, 0 at the rear
  return 0.27 + 0.5 * (1 - t) ** 1.25;
}
function paintTex() {
  const Wp = 1024, Hp = 460, Hs = Hp * SIDE_V;     // the side band (300 px) below, the plan band (160 px) above
  const c = document.createElement('canvas');
  c.width = Wp; c.height = Hp;
  const g = c.getContext('2d');
  const X = (x) => (x + HL) / RX7.L * Wp;
  const Y = (y) => Hp - y / PAINT_V * Hs;
  const Z = (lat) => (Hp - Hs) * (0.5 - lat / 2);   // the plan band: lat +1 (the right side) at the top
  g.fillStyle = ORANGE; g.fillRect(0, 0, Wp, Hp);
  /* ---- the plan band: the shut lines seen from above ---- */
  {
    g.strokeStyle = 'rgba(40,24,30,0.6)'; g.lineWidth = 1.5; g.lineJoin = 'round';
    // the bonnet: sunk between the fenders, its edges running forward along the
    // inside of the crests to a wide, nearly straight front edge at the nose
    g.beginPath();
    g.moveTo(X(0.5), Z(-0.64)); g.lineTo(X(0.5), Z(0.64)); g.lineTo(X(1.72), Z(0.54)); g.lineTo(X(1.94), Z(0.5));
    g.quadraticCurveTo(X(1.985), Z(0.48), X(1.99), Z(0.4)); g.lineTo(X(1.99), Z(-0.4)); g.quadraticCurveTo(X(1.985), Z(-0.48), X(1.94), Z(-0.5));
    g.lineTo(X(1.72), Z(-0.54)); g.closePath(); g.stroke();
    // the bumper seams over the fender tops (the bonnet's edge takes over between them)
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(X(1.72), Z(s)); g.lineTo(X(1.72), Z(s * 0.52)); g.stroke();
      g.beginPath(); g.moveTo(X(-1.72), Z(s)); g.lineTo(X(-1.72), Z(s * 0.82)); g.stroke();
      // the hatch's sides continuing from the glass to its edge on the deck
      g.beginPath(); g.moveTo(X(-1.79), Z(s * 0.7)); g.lineTo(X(-1.9), Z(s * 0.8)); g.stroke();
    }
    g.beginPath(); g.moveTo(X(-1.9), Z(-0.8)); g.lineTo(X(-1.9), Z(0.8)); g.stroke();
    // the cowl vent between bonnet and windscreen: a soft dark strip
    g.fillStyle = 'rgba(30,20,26,0.35)'; g.fillRect(X(0.44), Z(0.62), X(0.5) - X(0.44), Z(-0.62) - Z(0.62));
    // the fenders' crests read a shade darker than the bonnet between them (the cel band does the rest)
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(X(0.5), Z(0.62), X(2.0) - X(0.5), Z(-0.62) - Z(0.62));
  }
  /* ---- the side band ---- */
  g.save(); g.beginPath(); g.rect(0, Hp - Hs, Wp, Hs); g.clip();
  // the black sweep: a wedge that grows toward the rear
  g.fillStyle = BLACK;
  g.beginPath();
  g.moveTo(X(0.86), Y(0));
  for (let x = 0.86; x >= -1.55; x -= 0.02) {
    let y = sweepTop(x);
    if (x < -0.83) y = 0.77 - ((x + 0.83) / 0.72) ** 2 * 0.48;   // runs out over the rear hip
    g.lineTo(X(x), Y(y));
  }
  g.lineTo(X(-1.55), Y(0));
  g.closePath(); g.fill();
  // a thin pinstripe of lighter orange along the sweep's edge
  g.strokeStyle = '#ffb066'; g.lineWidth = 2;
  g.beginPath();
  for (let x = 0.84; x >= -0.83; x -= 0.02) { const y = sweepTop(x) + 0.018; if (x === 0.84) g.moveTo(X(x), Y(y)); else g.lineTo(X(x), Y(y)); }
  g.stroke();
  // shut lines: the door, the bumper seams, the fuel flap
  g.strokeStyle = 'rgba(40,24,30,0.75)'; g.lineWidth = 2;
  for (const x of RX7.door) { g.beginPath(); g.moveTo(X(x), Y(0.2)); g.lineTo(X(x + (x > 0 ? -0.02 : 0.03)), Y(0.9)); g.stroke(); }
  for (const x of [1.72, -1.72]) { g.beginPath(); g.moveTo(X(x), Y(0.2)); g.lineTo(X(x), Y(0.95)); g.stroke(); }
  g.strokeRect(X(-1.62), Y(0.82), 22, 16);
  // the rear-quarter intake ahead of the hip (in the black: its dark mouth)
  g.fillStyle = '#0e0d12';
  g.beginPath();
  g.moveTo(X(-0.62), Y(0.38)); g.lineTo(X(-0.76), Y(0.38)); g.quadraticCurveTo(X(-0.8), Y(0.5), X(-0.72), Y(0.6));
  g.lineTo(X(-0.58), Y(0.56)); g.closePath(); g.fill();
  // the fender gills behind the front wheel: three slats
  g.fillStyle = 'rgba(20,14,18,0.85)';
  for (let k = 0; k < 3; k++) { const x = 0.78 - k * 0.06; g.beginPath(); g.moveTo(X(x), Y(0.5)); g.lineTo(X(x + 0.03), Y(0.5)); g.lineTo(X(x + 0.06), Y(0.68)); g.lineTo(X(x + 0.03), Y(0.68)); g.closePath(); g.fill(); }
  // the door handle
  g.fillStyle = 'rgba(30,20,26,0.8)'; g.fillRect(X(-0.38), Y(0.78), 26, 5);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Glass: a dark, see-through tint with the anime double highlight. */
function glassTex() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, 'rgba(168,186,215,0.92)');    // the sky, pale in the top of the glass
  grad.addColorStop(0.35, 'rgba(96,110,148,0.85)');
  grad.addColorStop(0.7, 'rgba(52,58,86,0.78)');
  grad.addColorStop(1, 'rgba(34,38,58,0.7)');
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(220,232,255,0.62)';
  g.beginPath(); g.moveTo(S * 0.3, 0); g.lineTo(S * 0.48, 0); g.lineTo(S * 0.18, S); g.lineTo(S * 0.0, S); g.closePath(); g.fill();
  g.fillStyle = 'rgba(220,232,255,0.4)';
  g.beginPath(); g.moveTo(S * 0.56, 0); g.lineTo(S * 0.62, 0); g.lineTo(S * 0.32, S); g.lineTo(S * 0.26, S); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The rear plate: a private car's white plate, green characters. */
function plateTex() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f2ea'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#2f6a3c'; g.lineWidth = 6; g.strokeRect(5, 5, 246, 118);
  g.fillStyle = '#2f6a3c';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold 30px ${JP}`;
  g.fillText('富士山 330', 128, 34);
  g.font = `bold 30px ${JP}`;
  g.fillText('は', 34, 88);
  g.font = `bold 62px ${JP}`;
  g.fillText('23-06', 146, 88);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The headlamps: slim projectors under a clear cover. */
function lampTex() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 48;
  const g = c.getContext('2d');
  g.fillStyle = '#39404f'; g.fillRect(0, 0, 128, 48);
  const grad = g.createLinearGradient(0, 0, 0, 48);
  grad.addColorStop(0, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 48);
  for (const [x, r] of [[40, 15], [82, 12]]) {
    g.fillStyle = '#c9ced8'; g.beginPath(); g.arc(x, 24, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fbfaf2'; g.beginPath(); g.arc(x, 24, r * 0.62, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#f0a040'; g.fillRect(104, 18, 18, 12);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------ wheels ------------------------------ */
function lathe(profile, seg) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}
/** Parts of one wheel, axis along +z, outer face at +z. */
function wheelGeos(width) {
  const R = RX7.R, rr = 0.245, w = width / 2;
  // the tyre: a low, square-shouldered profile (sidewall bulging a little)
  const tyre = lathe([[rr, -w + 0.01], [rr + 0.03, -w], [R - 0.03, -w + 0.005], [R - 0.004, -w + 0.03], [R, -w + 0.06],
    [R, w - 0.06], [R - 0.004, w - 0.03], [R - 0.03, w - 0.005], [rr + 0.03, w], [rr, w - 0.01]], 36);
  tyre.rotateX(Math.PI / 2);
  // the rim: a stepped chrome lip, dished face, barrel
  const lip = lathe([[rr - 0.02, -w + 0.02], [rr, w - 0.012], [rr + 0.006, w - 0.006], [rr - 0.012, w + 0.002], [rr - 0.03, w - 0.004], [rr - 0.034, w - 0.05]], 36);
  lip.rotateX(Math.PI / 2);
  const parts = [lip];
  // multi-spoke: ten pairs, fanned from the hub to the lip, dished
  const spoke = new THREE.BoxGeometry(0.02, 0.18, 0.022);
  spoke.translate(0, 0.125, 0);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + (i % 2 ? 0.07 : -0.07);
    const s = spoke.clone();
    s.applyMatrix4(m.makeRotationX(-0.16));               // dished: the hub sits back
    s.applyMatrix4(m.makeRotationZ(a));
    s.translate(0, 0, w - 0.035);
    parts.push(s);
  }
  const hub = new THREE.CylinderGeometry(0.058, 0.064, 0.05, 20);
  hub.rotateX(Math.PI / 2); hub.translate(0, 0, w - 0.05);
  parts.push(hub);
  const nut = new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10);
  nut.rotateX(Math.PI / 2); nut.translate(0, 0, w - 0.018);
  parts.push(nut);
  const rim = mergeGeos(parts);
  const disc = new THREE.CylinderGeometry(0.19, 0.19, 0.028, 28);
  disc.rotateX(Math.PI / 2); disc.translate(0, 0, w - 0.12);
  const caliper = new THREE.BoxGeometry(0.1, 0.13, 0.06);
  caliper.translate(0, 0.14, w - 0.105);
  caliper.rotateZ(-0.7);
  return { tyre, rim, disc, caliper };
}

function mergeGeos(list) {
  const flatList = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of flatList) n += g.getAttribute('position').count;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of flatList) {
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const c = g.getAttribute('position').count;
    pos.set(g.getAttribute('position').array, o * 3);
    nrm.set(g.getAttribute('normal').array, o * 3);
    if (g.getAttribute('uv')) uv.set(g.getAttribute('uv').array.subarray(0, c * 2), o * 2);
    o += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

/** Give a geometry the paint map's side projection and a vertex colour. */
function painted(g, shade = 1) {
  g = g.index ? g.toNonIndexed() : g;
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const p = g.getAttribute('position'), n = p.count;
  const uv = new Float32Array(n * 2), col = new Float32Array(n * 3).fill(shade);
  for (let i = 0; i < n; i++) { uv[i * 2] = (p.getX(i) + HL) / RX7.L; uv[i * 2 + 1] = (p.getY(i) / PAINT_V) * SIDE_V; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function mergeAll(list) {
  const flatList = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const names = ['position', 'normal', 'uv', 'color'];
  let n = 0;
  for (const g of flatList) n += g.getAttribute('position').count;
  const out = new THREE.BufferGeometry();
  for (const k of names) {
    const size = k === 'uv' ? 2 : 3;
    const arr = new Float32Array(n * size);
    let o = 0;
    for (const g of flatList) {
      const a = g.getAttribute(k);
      const c = g.getAttribute('position').count;
      if (a) arr.set(a.array.subarray(0, c * size), o * size);
      else if (k === 'color') arr.fill(1, o * 3, (o + c) * 3);
      o += c;
    }
    out.setAttribute(k, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

/* ------------------------------ the car ------------------------------ */

export function makeRX7() {
  const group = new THREE.Group();
  group.name = 'rx7';
  const paint = cel({ color: 0xffffff, map: paintTex(), bands: 3, tint: 0x6a4a78, flat: false, vertexColors: true });
  const glassMat = new THREE.MeshBasicMaterial({ map: glassTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const trim = cel({ color: 0x1d1c22, bands: 2, tint: 0x3b3550 });
  const interior = cel({ color: 0x43414b, bands: 2, tint: 0x4b4560, side: THREE.BackSide });
  const seatMat = cel({ color: 0x3c3a45, bands: 3, tint: 0x4b4560, flat: false });
  const tail = flat({ color: 0x8a1f26 });

  /* the body */
  const xs = stations(-HL, HL, 0.035, [
    RX7.axle.f - ARCH - 0.002, RX7.axle.f - ARCH + 0.002, RX7.axle.f + ARCH - 0.002, RX7.axle.f + ARCH + 0.002,
    RX7.axle.r - ARCH - 0.002, RX7.axle.r - ARCH + 0.002, RX7.axle.r + ARCH - 0.002, RX7.axle.r + ARCH + 0.002,
    ...RX7.door, 1.72, 2.06, -2.12]);
  // a ring: right half bottom->top (+z), then the left half back down (-z)
  const ringOf = (sec) => {
    const r = sec.map(([lat, y]) => [lat, y]);
    for (let j = sec.length - 2; j >= 0; j--) r.push([-sec[j][0], sec[j][1]]);
    return r;
  };
  const secs = xs.map((x) => bodySection(x));
  const P = xs.map((x, i) => ringOf(secs[i]).map(([lat, y]) => [x, y, lat]));
  const RING = P[0].length;
  const sideOf = (j) => (j < SEC_N - 1 ? 1 : j > SEC_N - 1 ? -1 : 0);
  const inDoor = (i) => xs[i] >= RX7.door[0] - 1e-6 && xs[i + 1] <= RX7.door[1] + 1e-6;
  const body = gridParts(P, {
    closed: false,
    // the sides take the paint's side band, the tops (bonnet, deck) its plan band
    uv: (p, i, j) => (secs[i][j < SEC_N ? j : RING - 1 - j][3] === 'top' ? planUV(p) : paintUV(p)),
    shade: (i, j) => { const jj = j < SEC_N ? j : RING - 1 - j; return secs[i][jj][2]; },
    classify: (i, j) => {
      // the driver's door: its side rows between the edges, right side only
      const jj = j < SEC_N ? j : RING - 1 - j, jn = j < SEC_N - 1 ? j + 1 : RING - 2 - j;
      // under the cabin the body's top is not drawn: through the glass you see in
      if (cabH((xs[i] + xs[i + 1]) / 2) > 0 && (secs[i][jj][3] === 'top' || secs[i][jn]?.[3] === 'top')) return null;
      if (inDoor(i) && sideOf(j) === 1 && secs[i][jj][3] === 'side' && secs[i][jj + 1]?.[3] === 'side') return 'door';
      return 'body';
    },
  });

  // the two ends: slightly domed caps (the front mouth and the rear panel go on them)
  const cap = (i, bulge) => {
    const ring = P[i], x = xs[i];
    let cy = 0; for (const p of ring) cy += p[1]; cy /= ring.length;
    const pos = [], uv = [];
    const c = [x + bulge, cy, 0];
    for (let j = 0; j < ring.length - 1; j++) {
      const a = ring[j], b = ring[j + 1];
      const tri = bulge > 0 ? [c, b, a] : [c, a, b];
      for (const p of tri) { pos.push(...p); uv.push(...paintUV(p)); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return painted(g);
  };

  /* the cabin */
  const cx = stations(CAB.tail, CAB.cowl, 0.04, [CAB.rf, CAB.rr, CAB.rf + 0.05, CAB.cowl - 0.035, CAB.cowl - 0.14,
    CAB.rr + 0.02, CAB.rr - 0.08, CAB.tail + 0.11, RX7.door[0], 0.5]);
  const PHI = [0, 0.1, 0.2, 0.3, 0.4, 0.47, 0.51, 0.55, 0.61, 0.67, 0.73, 0.79, 0.85, 0.9, 0.935, 0.97, 1];
  // from the right belt (phi 1, +z) up over the crown and down to the left belt
  const cabRingFixed = [...PHI.slice().reverse().map((p) => [p, 1]), ...PHI.slice(1).map((p) => [p, -1])];
  const CP = cx.map((x) => cabRingFixed.map(([phi, s]) => {
    const [lat, y] = cabinPoint(x, phi);
    return [x, y, s * lat];
  }));
  const region = (x, phi) => {
    if (x > CAB.rf + 0.05 && x < CAB.cowl - 0.035 && phi < 0.51) return 'glass';
    if (x > CAB.rr + 0.02 && x < CAB.cowl - 0.14 && phi > 0.61 && phi < 0.935) return 'side';
    if (x > CAB.tail + 0.11 && x < CAB.rr - 0.08 && phi < 0.935) return 'glass';
    return 'frame';
  };
  const cab = gridParts(CP, {
    uv: paintUV,
    classify: (i, j) => {
      const xm = (cx[i] + cx[i + 1]) / 2;
      const a = cabRingFixed[j], b = cabRingFixed[j + 1];
      const phim = (a[0] + b[0]) / 2, s = a[1] + b[1];
      const r = region(xm, phim);
      if (r === 'side') {
        if (s > 0 && xm > RX7.door[0] && xm < 0.5) return 'doorGlass';
        return 'glass';
      }
      return r;
    },
  });
  // glass: its own UVs, so the highlight streaks run across each pane
  const glassUV = (g, x0, x1) => {
    const p = g.getAttribute('position'), uv = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), v = (p.getY(i) - 0.8) / 0.45;
      // the windscreen: its streaks run across, from the driver's corner
      if (x > CAB.rf + 0.02) uv.setXY(i, 0.15 + (0.5 - p.getZ(i) / 1.5) * 1.3, v);
      else uv.setXY(i, (x - x0) / (x1 - x0) * 2.2, v);
    }
    uv.needsUpdate = true;
  };
  glassUV(cab.glass, CAB.tail, CAB.cowl);
  glassUV(cab.doorGlass, CAB.tail, CAB.cowl);

  /* the wing: two uprights and a curved blade with end plates */
  const wingParts = [];
  {
    const sh = new THREE.Shape();
    // an airfoil in (x, y): chord 0.34 m
    sh.moveTo(0.17, 0); sh.quadraticCurveTo(0.1, 0.05, -0.06, 0.035); sh.quadraticCurveTo(-0.17, 0.02, -0.17, -0.005);
    sh.quadraticCurveTo(-0.05, -0.012, 0.17, 0);
    const blade = new THREE.ExtrudeGeometry(sh, { depth: 1.84, bevelEnabled: false, curveSegments: 8 });
    blade.translate(0, 0, -0.92);
    blade.rotateZ(0.08);
    blade.translate(-1.98, 1.29, 0);
    wingParts.push(blade);
    // the end plates: rounded, deeper at the back
    const ps = new THREE.Shape();
    ps.moveTo(-0.2, -0.06); ps.lineTo(0.14, -0.04); ps.quadraticCurveTo(0.22, -0.03, 0.22, 0.04); ps.lineTo(0.22, 0.09);
    ps.quadraticCurveTo(0.22, 0.13, 0.17, 0.13); ps.lineTo(-0.16, 0.1); ps.quadraticCurveTo(-0.2, 0.1, -0.2, 0.06); ps.closePath();
    for (const s of [-1, 1]) {
      // the upright: a swept blade, wider at its foot
      const us = new THREE.Shape();
      us.moveTo(-0.14, 0); us.lineTo(0.1, 0); us.lineTo(0.02, 0.33); us.lineTo(-0.06, 0.33); us.closePath();
      const up = new THREE.ExtrudeGeometry(us, { depth: 0.03, bevelEnabled: false });
      up.translate(-1.9, 0.97, s * 0.58 - 0.015);
      wingParts.push(up);
      const plate = new THREE.ExtrudeGeometry(ps, { depth: 0.02, bevelEnabled: false, curveSegments: 6 });
      plate.translate(-1.99, 1.27, s * 0.93 - 0.01);
      wingParts.push(plate);
    }
  }
  /* mirrors (aero), the driver's goes with the door */
  const mirror = (s) => {
    const shell = new THREE.SphereGeometry(0.075, 14, 10);
    shell.scale(1.1, 0.62, 0.7);
    const [wb, yb] = topPoint(0.3, A_BELT);
    shell.translate(0.3, yb + 0.07, s * (wb + 0.13));
    const stalk = new THREE.BoxGeometry(0.05, 0.03, 0.14);
    stalk.translate(0.33, yb + 0.04, s * (wb + 0.06));
    return [shell, stalk];
  };

  const bodyGeo = mergeAll([
    body.body, cab.frame, cap(0, -0.004), cap(xs.length - 1, 0.05),
    ...wingParts.map((g) => painted(g)), ...mirror(-1).map((g) => painted(g)),
  ]);
  const bodyMesh = new THREE.Mesh(bodyGeo, paint);
  bodyMesh.castShadow = true;
  group.add(bodyMesh);
  const glass = new THREE.Mesh(cab.glass, glassMat);
  glass.renderOrder = 2;
  glass.userData.noOutline = true;
  group.add(glass);

  /* the door, on its hinge at the front edge */
  const hingeX = RX7.door[1], hingeZ = halfW(hingeX) - 0.02;
  const door = new THREE.Group();
  door.name = 'rx7-door';
  door.position.set(hingeX, 0, hingeZ);
  const shiftBack = (g) => { g.translate(-hingeX, 0, -hingeZ); return g; };
  const doorSkin = new THREE.Mesh(shiftBack(mergeAll([body.door, ...mirror(1).map((g) => painted(g))])), paint);
  doorSkin.castShadow = true;
  const doorInner = new THREE.Mesh(body.door.clone(), cel({ color: 0x2a2830, bands: 2, tint: 0x4b4560, side: THREE.BackSide }));
  doorInner.geometry.translate(-hingeX, 0, -hingeZ);
  doorInner.userData.noOutline = true;
  doorInner.visible = false;              // drawn only while the door is open
  const doorGlass = new THREE.Mesh(shiftBack(cab.doorGlass), glassMat);
  doorGlass.renderOrder = 2;
  doorGlass.userData.noOutline = true;
  door.add(doorSkin, doorInner, doorGlass);
  group.add(door);

  /* trim: the mouth, the side intakes, the rear panel, lamps, plate, exhausts, splitter */
  const trimParts = [];
  const x1 = xs[xs.length - 1], x0 = xs[0];
  {
    // front: the big mouth and its two outer ducts, on the bumper face
    const mouth = new THREE.CapsuleGeometry(0.1, 0.72, 4, 12);   // the Fortune's wide, round-ended mouth
    mouth.rotateX(Math.PI / 2); mouth.scale(0.3, 1, 1); mouth.translate(x1 + 0.03, 0.3, 0);
    trimParts.push(mouth);
    const splitter = new THREE.BoxGeometry(0.3, 0.02, 1.36);
    splitter.translate(x1 - 0.17, 0.125, 0);
    trimParts.push(splitter);
    for (const s of [-1, 1]) {
      const duct = new THREE.BoxGeometry(0.14, 0.09, 0.2);
      duct.rotateY(s * 0.9);
      duct.translate(2.07, 0.25, s * 0.58);
      trimParts.push(duct);
      // side skirts
      const skirt = new THREE.BoxGeometry(1.7, 0.05, 0.05);
      skirt.translate(0.1, 0.17, s * (halfW(0.1) - 0.04));
      trimParts.push(skirt);
    }
    // rear: the dark panel the lamps sit in, the diffuser, the plate recess
    const panel = new THREE.BoxGeometry(0.03, 0.2, 1.58);
    panel.translate(x0 - 0.01, 0.72, 0);
    trimParts.push(panel);
    const diff = new THREE.BoxGeometry(0.3, 0.05, 1.2);
    diff.translate(x0 + 0.1, 0.27, 0);
    trimParts.push(diff);
    for (let k = -2; k <= 2; k++) {
      const fin = new THREE.BoxGeometry(0.28, 0.1, 0.018);
      fin.translate(x0 + 0.08, 0.24, k * 0.2);
      trimParts.push(fin);
    }
  }

  // tail lamps: the FD's three round lamps a side (the inner one the reverse lamp), in bezels
  const lampParts = [], reverseParts = [];
  for (const s of [-1, 1]) for (const [k, z] of [0.36, 0.53, 0.7].entries()) {
    const ring = new THREE.CylinderGeometry(0.075, 0.075, 0.03, 24);
    ring.rotateZ(Math.PI / 2); ring.translate(x0 - 0.02, 0.72, s * z);
    trimParts.push(ring);
    const lens = new THREE.CylinderGeometry(0.056, 0.056, 0.03, 24);
    lens.rotateZ(Math.PI / 2); lens.translate(x0 - 0.03, 0.72, s * z);
    (k === 0 ? reverseParts : lampParts).push(lens);
  }
  const tailMesh = new THREE.Mesh(mergeGeos(lampParts), tail);
  tailMesh.userData.noOutline = true;
  group.add(tailMesh);
  const reverseMesh = new THREE.Mesh(mergeGeos(reverseParts), flat({ color: 0xd9dbd6 }));
  reverseMesh.userData.noOutline = true;
  group.add(reverseMesh);

  // exhausts: twin round tips, chrome
  {
    const tips = [];
    for (const s of [-1, 1]) {
      const t = new THREE.CylinderGeometry(0.048, 0.052, 0.12, 18, 1, true);
      t.rotateZ(Math.PI / 2); t.translate(x0 - 0.02, 0.31, s * 0.14);
      tips.push(t);
    }
    const m = new THREE.Mesh(mergeGeos(tips), cel({ color: 0xd8dce4, bands: 3, tint: 0x5a6290, side: THREE.DoubleSide }));
    group.add(m);
  }

  // headlamps: slim lozenges on the nose, following the fender top
  {
    const pos = [], uv = [];
    for (const s of [-1, 1]) {
      const nu = 10, nv = 4;
      const pt = (u, v) => {
        const x = 1.7 + u * 0.36;
        const a0 = 0.12 + u * 0.1, a1 = 0.46 + u * 0.16;
        const [lat, y] = topPoint(x, a0 + (a1 - a0) * v);
        return [x, y + 0.006, s * lat];
      };
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => ({ p: pt(a / nu, b / nv), t: [a / nu, b / nv] }));
        const tris = s > 0 ? [q[0], q[1], q[2], q[0], q[2], q[3]] : [q[0], q[2], q[1], q[0], q[3], q[2]];
        for (const t of tris) { pos.push(...t.p); uv.push(t.t[0], s > 0 ? t.t[1] : 1 - t.t[1]); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, flat({ map: lampTex() }));
    m.userData.noOutline = true;
    group.add(m);
  }

  // the plate
  {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.165), flat({ map: plateTex() }));
    plate.rotation.y = -Math.PI / 2;
    plate.position.set(x0 - 0.035, 0.47, 0);
    plate.userData.noOutline = true;
    group.add(plate);
    const recess = new THREE.BoxGeometry(0.02, 0.2, 0.37);
    recess.translate(x0 - 0.02, 0.47, 0);
    trimParts.push(recess);
  }
  group.add(new THREE.Mesh(mergeGeos(trimParts), trim));

  /* the interior: a dark tub, two buckets, the wheel on the right */
  {
    const tub = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.12), interior);
    tub.position.set(-0.45, 0.6, 0);        // kept inside the glasshouse: it must never show above the hatch
    tub.userData.noOutline = true;
    group.add(tub);
    const seats = [];
    for (const s of [-1, 1]) {
      const back = new THREE.BoxGeometry(0.12, 0.62, 0.46, 1, 3, 2);
      back.translate(0, 0.31, 0); back.rotateZ(0.22); back.translate(-0.62, 0.3, s * 0.37);
      const head = new THREE.BoxGeometry(0.1, 0.2, 0.26);
      head.translate(-0.73, 0.98, s * 0.37);
      const cush = new THREE.BoxGeometry(0.5, 0.12, 0.46);
      cush.translate(-0.35, 0.3, s * 0.37);
      seats.push(back, head, cush);
    }
    const dash = new THREE.BoxGeometry(0.4, 0.16, 1.46);
    dash.translate(0.3, 0.76, 0);
    seats.push(dash);
    const wheel = new THREE.TorusGeometry(0.17, 0.022, 8, 24);
    wheel.rotateY(Math.PI / 2); wheel.rotateZ(0.45);
    wheel.translate(0.22, 0.82, 0.37);
    seats.push(wheel);
    group.add(new THREE.Mesh(mergeGeos(seats), seatMat));
  }

  /* the wheels: two InstancedMeshes for all four, colours per vertex --
   * what turns (tyre, chrome rim and spokes) and what only steers (disc, caliper) */
  const wr = wheelGeos(0.3);
  const coloured = (list) => mergeAll(list.map(([g, hex]) => {
    g = g.index ? g.toNonIndexed() : g.clone();
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const c = new THREE.Color(hex), n = g.getAttribute('position').count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  }));
  const wheelMat = cel({ color: 0xffffff, bands: 3, tint: 0x4b4a78, flat: false, side: THREE.DoubleSide, vertexColors: true });
  const hubMat = cel({ color: 0xffffff, bands: 2, tint: 0x4b4560, vertexColors: true });
  // front and rear differ in width: the front's instances are scaled, not a second set
  const inst = {};
  const mk = (key, geo, mat, cast) => {
    const m = new THREE.InstancedMesh(geo, mat, 4);
    m.castShadow = cast;
    m.frustumCulled = false;
    inst[key] = m;
    group.add(m);
  };
  mk('turn', coloured([[wr.tyre, 0x302e36], [wr.rim, 0xe4e8f0]]), wheelMat, true);
  mk('steer', coloured([[wr.disc, 0x77757e], [wr.caliper, 0xd8342e]]), hubMat, false);
  const wheels = [
    { x: RX7.axle.f, z: RX7.track.f, s: 1, front: true, w: 0.265 / 0.3 },
    { x: RX7.axle.f, z: -RX7.track.f, s: -1, front: true, w: 0.265 / 0.3 },
    { x: RX7.axle.r, z: RX7.track.r, s: 1, front: false, w: 1 },
    { x: RX7.axle.r, z: -RX7.track.r, s: -1, front: false, w: 1 },
  ];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YZX');
  const v = new THREE.Vector3(), sc = new THREE.Vector3();
  function setWheels(spin = 0, steer = 0) {
    wheels.forEach((w, i) => {
      const st = w.front ? steer : 0;
      v.set(w.x, RX7.R, w.z);
      sc.set(1, 1, w.w);
      // the outer face points out: the left wheels are turned half round
      e.set(0, st + (w.s < 0 ? Math.PI : 0), 0);
      q.setFromEuler(e);
      m4.compose(v, q, sc);
      inst.steer.setMatrixAt(i, m4);
      e.set(0, st + (w.s < 0 ? Math.PI : 0), -spin * w.s);
      q.setFromEuler(e);
      m4.compose(v, q, sc);
      inst.turn.setMatrixAt(i, m4);
    });
    for (const k in inst) inst[k].instanceMatrix.needsUpdate = true;
  }
  setWheels(0, 0);

  return {
    group, door, setWheels,
    setDoor(a) { door.rotation.y = a; doorInner.visible = a > 0.01; },
    /** The driver's seat (Han sits here), car frame. */
    seat: new THREE.Vector3(-0.42, 0.28, 0.37),
    halfW,
  };
}
