import * as THREE from 'three';
import { cel } from '../../core/toon.js';

/* ------------------------------------------------------------------ *
 * Han, as in the Tokyo Drift still Tan gave as the reference (2026-09-28):
 * a slim man of 1.78 m leaning back against the car's flank ahead of the
 * rear wheel, his weight on the car, legs out and crossed at the ankle,
 * arms folded low across his stomach, head a little forward; long dark
 * layered hair to the collar parted in the middle and framing a long,
 * high-cheekboned face; a dark navy zip jacket open over a grey-green
 * top, a thin pendant chain, loose olive cargo trousers bunched over
 * dark shoes.  Built in code, no photo; cel-shaded like the town but at
 * real proportions: the aim is a person, not a mannequin.
 *
 * Bone-free: a tree of pivots (pelvis, spine, chest, neck, head, the
 * arms and legs), each part a mesh hung from its pivot.  A pose is a
 * table of joint angles (POSES); han/index.js blends between them and
 * lays the small motions on top (breathing, the head turn, the nod).  He
 * faces +z in his own frame; his left is +x.
 *
 * Draws: parts are gathered per joint and kind (skin / cloth / hair) and
 * merged, colours per vertex: about 20 draws for the whole man.
 * ------------------------------------------------------------------ */

const C = {
  skin: 0xc48e68,
  skinShade: 0xac7856,
  hair: 0x1c1517,
  jacket: 0x252d48,
  jacketDark: 0x1c2238,
  tee: 0x7f8672,
  khaki: 0x8e8468,
  khakiDark: 0x7a7058,
  shoe: 0x2a2724,
  sole: 0x9c968a,
  chain: 0xd9dbe0,
  lip: 0xb07868,
};

/* Joint angles, radians.  L = his left (+x). */
export const POSES = {
  /* the still: hips on the car, legs out and crossed at the ankle, arms folded low */
  lean: {
    pelvisY: 0.865, pelvisX: -0.14, pelvisZ: 0.03, spineX: -0.1, chestX: -0.02, chestZ: 0.0, neckX: 0.16, headX: 0.12, headZ: 0.07,
    lShX: -0.14, lShZ: 0.16, lShY: 0.0, lElX: -1.62, lElY: -1.45, lHand: 1.1,
    rShX: -0.36, rShZ: -0.16, rShY: 0.0, rElX: -1.72, rElY: 1.45, rHand: 1.1,
    lHipX: -0.54, lHipZ: -0.19, lKnee: 0.02, lFoot: 0.5, lFootY: 0.35,
    rHipX: -0.48, rHipZ: 0.12, rKnee: 0.04, rFoot: 0.45, rFootY: -0.55,
  },
  /* standing, weight even, arms down */
  stand: {
    pelvisY: 0.97, pelvisX: 0, pelvisZ: 0, spineX: 0, chestX: 0.02, chestZ: 0, neckX: 0.02, headX: 0.04, headZ: 0,
    lShX: 0.05, lShZ: 0.1, lShY: 0, lElX: -0.25, lElY: 0, lHand: 0.1,
    rShX: 0.05, rShZ: -0.1, rShY: 0, rElX: -0.25, rElY: 0, rHand: 0.1,
    lHipX: 0, lHipZ: 0.03, lKnee: 0, lFoot: 0, lFootY: 0.1,
    rHipX: 0, rHipZ: -0.03, rKnee: 0, rFoot: 0, rFootY: -0.1,
  },
  /* in the driver's seat, hands on the wheel */
  seat: {
    pelvisY: 0.08, pelvisX: -0.1, pelvisZ: 0, spineX: -0.2, chestX: 0.02, chestZ: 0, neckX: 0.12, headX: 0.1, headZ: 0,
    lShX: -1.0, lShZ: 0.18, lShY: 0, lElX: -0.55, lElY: -0.3, lHand: 0.2,
    rShX: -1.0, rShZ: -0.18, rShY: 0, rElX: -0.55, rElY: 0.3, rHand: 0.2,
    lHipX: -1.45, lHipZ: 0.08, lKnee: 1.35, lFoot: -0.2, lFootY: 0,
    rHipX: -1.45, rHipZ: -0.08, rKnee: 1.35, rFoot: -0.2, rFootY: 0,
  },
};

const tmp = {};
export function blendPose(a, b, t, out = tmp) {
  for (const k in a) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

/* ------------------------------ geometry ------------------------------ */

const sm = THREE.MathUtils.smoothstep;
const TAU = Math.PI * 2;

/**
 * A tube of elliptical rings, top to bottom: rings [{ y, rx, rz, x, z }].
 * `fold(a, t, i)` scales the radius at angle a (0 = front, +z; rising
 * toward +x) and height fraction t: cloth folds are carved this way.
 */
function tube(rings, seg = 20, { fold = null, capTop = false, capBottom = false } = {}) {
  const pos = [], idx = [];
  const n = rings.length;
  for (let i = 0; i < n; i++) {
    const r = rings[i], t = i / (n - 1);
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * TAU;
      const k = fold ? fold(a, t, i) : 1;
      pos.push((r.x || 0) + Math.sin(a) * r.rx * k, r.y, (r.z || 0) + Math.cos(a) * r.rz * k);
    }
  }
  const W = seg + 1;
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * W + j, b = (i + 1) * W + j, c = (i + 1) * W + j + 1, d = i * W + j + 1;
    idx.push(a, b, c, a, c, d);
  }
  const cap = (i, up) => {
    const r = rings[i], ci = pos.length / 3;
    pos.push(r.x || 0, r.y, r.z || 0);
    for (let j = 0; j < seg; j++) {
      const a = i * W + j, b = i * W + j + 1;
      if (up) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  };
  if (capTop) cap(0, true);
  if (capBottom) cap(n - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------- the head ------------------------------- */
/* The head is one parametric grid (azimuth x polar), dense over the face,
 * the features sculpted as a height field on the base ellipsoid: brow ridge,
 * sockets, the nose with its wings and underside, the cheekbones, the lips,
 * the chin.  The face map is painted in the same (azimuth, height) frame, so
 * every mark lands on the form it belongs to. */
const HEAD = { rx: 0.0785, ry: 0.1175, rz: 0.0931 };   // half sizes: 0.157 wide, 0.235 tall, 0.186 deep
const HEAD_Y = 0.103;                                   // the head's centre above its pivot
/* feature heights, metres from the head's centre (chin -0.1175, crown +0.1175) */
const F = { brow: 0.027, eye: 0.009, eyeX: 0.031, noseTip: -0.035, noseBase: -0.043, lipTop: -0.059, mouth: -0.0685, lipBot: -0.0785, chin: -0.106 };
const EYE_R = 0.0125;
const G = (x, s) => Math.exp(-(x * x) / (2 * s * s));
const G2 = (x, sx, y, sy) => G(x, sx) * G(y, sy);
const clamp = THREE.MathUtils.clamp;

/** The base skull, azimuth d (0 = front, +z; rising toward +x) and polar th (0 crown .. PI chin):
 * long, a high wide cheekbone, a strong jaw narrowing to the chin, a forehead sloping back, the skull long behind. */
function headBase(d, th) {
  const st = Math.sin(th), t = Math.cos(th);
  let x = st * Math.sin(d) * HEAD.rx, z = st * Math.cos(d) * HEAD.rz;
  const y = t * HEAD.ry;
  const front = sm(Math.cos(d) * st, -0.2, 0.5);
  let sx = 1, sz = 1;
  sx *= 1 + 0.04 * Math.exp(-(((t + 0.05) / 0.2) ** 2)) * front;
  if (t < -0.1) sx *= 1 - 0.34 * ((-t - 0.1) / 0.9) ** 1.35;
  if (t > 0.4) sx *= 1 - 0.1 * (t - 0.4);
  if (t < -0.25) sz *= 1 - 0.16 * ((-t - 0.25) / 0.75) ** 1.5 * (z > 0 ? 0.6 : 1);
  if (z > 0 && t > 0.45) sz *= 1 - 0.12 * (t - 0.45);
  if (z < 0) sz *= 1.05;
  x *= sx; z *= sz;
  if (t < -0.6 && z > 0) z += 0.016 * (-t - 0.6) / 0.4;
  if (z > 0 && t > -0.35 && t < 0.15) z -= 0.006 * front;
  return [x, y, z];
}

/** The features, as height (m, outward) over the base at face position (fx, fy), depth z. */
function features(fx, fy, z) {
  const ax = Math.abs(fx);
  const fr = sm(z, 0.015, 0.06);
  let h = 0;
  // the brow ridge: a bar over both eyes, easing at the glabella and fading at the temples
  h += 0.0045 * G(fy - F.brow + 0.003, 0.011) * sm(0.064 - ax, 0, 0.02) * (0.72 + 0.28 * sm(ax, 0.004, 0.02)) * fr;
  // the sockets the eyes sit in
  h -= 0.0075 * G2(ax - F.eyeX, 0.019, fy - F.eye + 0.001, 0.011) * fr;
  // the nose: a bridge widening down to the tip, the wings, the underside cut back to the lip
  const nb = sm(fy, F.noseBase - 0.005, F.noseBase + 0.005);
  const along = 1 - sm(fy, F.noseTip, F.brow - 0.004);
  h += (0.0045 + 0.0095 * along ** 1.4) * G(fx, 0.0075 + 0.005 * along) * nb * fr;
  h += 0.0045 * G2(fx, 0.012, fy - F.noseTip - 0.001, 0.01) * fr;
  h += 0.0075 * G2(ax - 0.0135, 0.0065, fy - (F.noseBase + 0.006), 0.007) * fr;
  // the cheekbones, and the hollow under them
  h += 0.0055 * G2(ax - 0.06, 0.016, fy - 0.004, 0.014) * sm(z, -0.02, 0.03);
  h -= 0.0035 * G2(ax - 0.05, 0.016, fy + 0.038, 0.015) * sm(z, -0.01, 0.03);
  // the mouth: the philtrum, the upper lip with its bow, the line, the fuller lower lip, the fold below, the chin
  const mw = sm(0.026 - ax, 0, 0.012);
  h -= 0.0012 * G(fx, 0.0045) * sm(fy, F.mouth + 0.006, F.lipTop) * (1 - sm(fy, F.noseBase - 0.006, F.noseBase)) * fr;
  const bow = F.lipTop - 0.0025 * G(fx, 0.005) + 0.001 * G(ax - 0.008, 0.004);
  h += 0.0045 * G(fy - (bow + F.mouth) / 2, (bow - F.mouth) / 2.2) * mw * fr;
  h -= 0.0025 * G(fy - F.mouth, 0.0022) * sm(0.027 - ax, 0, 0.008) * fr;
  h += 0.0055 * G(fy - (F.mouth + F.lipBot) / 2, (F.mouth - F.lipBot) / 2.1) * sm(0.022 - ax, 0, 0.012) * fr;
  h -= 0.003 * G(fy - (F.lipBot - 0.011), 0.006) * sm(0.02 - ax, 0, 0.012) * fr;
  h += 0.0075 * G2(fx, 0.022, fy - F.chin - 0.002, 0.014) * fr;
  // the temples flatten
  h -= 0.003 * G2(ax - 0.07, 0.015, fy - 0.045, 0.02) * sm(z, 0.0, 0.03);
  return h;
}

/** Texture frame: u from the azimuth (the front 230 degrees across the map), v from the base height. */
const UV_D = 2.0, UV_V = 0.96;   // the bottom 4 % of the map is the swatch strip
const headUV = (d, y) => [0.5 + clamp(d, -UV_D, UV_D) / (2 * UV_D), ((HEAD.ry - y) / (2 * HEAD.ry)) * UV_V];
const SWATCH = [0.5, 0.985];      // white: parts drawn with vertex colours only
/** The azimuth at which the base passes through face position (fx, fy) (front half). */
function azAt(fx, fy) {
  const th = Math.acos(clamp(fy / HEAD.ry, -0.999, 0.999));
  let lo = 0, hi = Math.PI / 2;
  const ax = Math.abs(fx);
  for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (headBase(m, th)[0] < ax) lo = m; else hi = m; }
  return Math.sign(fx) * (lo + hi) / 2;
}
/** The base surface point (undisplaced) at a face position. */
function baseAt(fx, fy) { return headBase(azAt(fx, fy), Math.acos(clamp(fy / HEAD.ry, -0.999, 0.999))); }

/** Row positions that put most of the grid where the features are. */
function warpRows(n, density) {
  const S = 2000, cum = new Float64Array(S + 1);
  for (let i = 0; i < S; i++) cum[i + 1] = cum[i] + density((i + 0.5) / S);
  const out = [];
  let k = 0;
  for (let j = 0; j <= n; j++) {
    const want = (j / n) * cum[S];
    while (k < S - 1 && cum[k + 1] < want) k++;
    const f = (want - cum[k]) / (cum[k + 1] - cum[k] || 1);
    out.push(clamp((k + f) / S, 0, 1));
  }
  return out;
}

function headGeometry() {
  const NU = 96, NV = 56;
  const us = warpRows(NU, (u) => { const s = Math.abs(2 * u - 1); return 1 / (0.55 + 1.35 * s * s); });   // denser at the front
  const vs = warpRows(NV, (v) => 0.55 + 1.0 * sm(v, 0.22, 0.4) - 0.5 * sm(v, 0.93, 1.0));               // denser from the brow to the chin
  const pos = [], uv = [], idx = [];
  const n = new THREE.Vector3();
  for (let j = 0; j <= NV; j++) {
    const th = vs[j] * Math.PI;
    for (let i = 0; i <= NU; i++) {
      const d = (us[i] * 2 - 1) * Math.PI;
      const [x, y, z] = headBase(d, th);
      n.set(x / (HEAD.rx * HEAD.rx), y / (HEAD.ry * HEAD.ry), z / (HEAD.rz * HEAD.rz)).normalize();
      const h = features(x, y, z);
      pos.push(x + n.x * h, y + n.y * h, z + n.z * h);
      uv.push(...headUV(d, y));
    }
  }
  const W = NU + 1;
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const a = j * W + i, b = (j + 1) * W + i, c = (j + 1) * W + i + 1, e = j * W + i + 1;
    idx.push(a, b, c, a, c, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The face map, 512 x 384: skin with its variation, the shading the form
 * doesn't give, brows, the nostrils, the lips, a light moustache, the goatee,
 * stubble.  Drawn in the head's (azimuth, height) frame through P(). */
function faceMap() {
  const W = 512, H = 384;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const P = (fx, fy) => { const [u, v] = headUV(azAt(fx, fy), fy); return [u * W, v * H]; };
  const PD = (d, fy) => { const [u, v] = headUV(d, fy); return [u * W, v * H]; };
  const K = W / (2 * UV_D) / HEAD.rx;    // px per metre, across the face's middle
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const rgba = (hex, a) => `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`;
  // an ellipse at a face position, mapped point by point
  const blob = (fx, fy, rx, ry, hex, a, rot = 0) => {
    g.fillStyle = rgba(hex, a);
    g.beginPath();
    for (let k = 0; k <= 24; k++) {
      const t = (k / 24) * TAU, ex = Math.cos(t) * rx, ey = Math.sin(t) * ry;
      const [px, py] = P(fx + ex * Math.cos(rot) - ey * Math.sin(rot), fy + ex * Math.sin(rot) + ey * Math.cos(rot));
      k ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath(); g.fill();
  };
  // a soft blob: layered, fading out
  const soft = (fx, fy, rx, ry, hex, a, rot = 0) => { for (let k = 4; k >= 1; k--) blob(fx, fy, rx * k / 4, ry * k / 4, hex, a / 4, rot); };
  const line = (pts, hex, a, w) => {
    g.strokeStyle = rgba(hex, a); g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    pts.forEach(([fx, fy], k) => { const [px, py] = P(fx, fy); k ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.stroke();
  };
  // a hair stroke: from (fx, fy), length len, angle ang (0 = his left, PI/2 = up)
  const hairStroke = (fx, fy, len, ang, hex, a, w) => {
    line([[fx, fy], [fx + Math.cos(ang) * len * 0.5, fy + Math.sin(ang) * len * 0.5], [fx + Math.cos(ang) * len, fy + Math.sin(ang) * len]], hex, a, w);
  };

  // skin
  g.fillStyle = '#bd8c6e'; g.fillRect(0, 0, W, H);
  const mottle = [0xd29a72, 0xb47f5c, 0xc9886c, 0xb98b6c, 0xcf9470];
  for (let i = 0; i < 1400; i++) {
    const r = 3 + rnd() * 12;
    g.fillStyle = rgba(mottle[i % mottle.length], 0.05 + rnd() * 0.04);
    g.beginPath(); g.ellipse(rnd() * W, rnd() * H * UV_V, r, r * (0.6 + rnd() * 0.6), rnd() * 3, 0, TAU); g.fill();
  }
  // zones: the forehead lighter, the cheeks and the nose warm, under the eyes a little bruised, the beard cool
  soft(0, 0.075, 0.07, 0.03, 0xd8a47c, 0.28);
  for (const s of [-1, 1]) {
    soft(s * 0.05, -0.02, 0.03, 0.024, 0xcf7c5c, 0.22);
    soft(s * 0.031, -0.006, 0.017, 0.007, 0x9e6e66, 0.34);
    soft(s * 0.079, 0.0, 0.012, 0.03, 0xcf7c5c, 0.25);       // the ears' side
  }
  soft(0, F.noseTip, 0.016, 0.012, 0xcd785a, 0.3);
  // the beard zone: from the mouth's corners down over the chin and along the jaw to the ears
  g.fillStyle = rgba(0x8d7770, 0.2);
  g.beginPath();
  [[-1.9, -0.02], [-1.9, -0.13], [1.9, -0.13], [1.9, -0.02], [1.2, -0.03], [0.6, -0.055], [0.3, -0.075], [0.0, -0.08], [-0.3, -0.075], [-0.6, -0.055], [-1.2, -0.03]]
    .forEach(([d, fy], k) => { const [px, py] = PD(d, fy); k ? g.lineTo(px, py) : g.moveTo(px, py); });
  g.closePath(); g.fill();
  // the upper lip's shadow zone, cool as well
  soft(0, -0.052, 0.024, 0.006, 0x8d7770, 0.3);
  // the jaw's underside, darker
  {
    const y0 = headUV(0, -0.095)[1] * H, y1 = H * UV_V;
    const grd = g.createLinearGradient(0, y0, 0, y1);
    grd.addColorStop(0, rgba(0x9a6a4e, 0)); grd.addColorStop(1, rgba(0x8a5c44, 0.4));
    g.fillStyle = grd; g.fillRect(0, y0, W, y1 - y0);
  }
  // under the hair: no bright bald forehead through the strands
  {
    const y0 = headUV(0, 0.075)[1] * H;
    const grd = g.createLinearGradient(0, y0, 0, 0);
    grd.addColorStop(0, rgba(0x7a5642, 0)); grd.addColorStop(0.35, rgba(0x6a4a3a, 0.4)); grd.addColorStop(1, rgba(0x3a2a24, 0.7));
    g.fillStyle = grd; g.fillRect(0, 0, W, y0);
  }

  // shading the form doesn't give: the sockets, the nose's sides and underside, the nasolabial fold, under the lower lip
  for (const s of [-1, 1]) {
    soft(s * F.eyeX, F.eye - 0.001, 0.022, 0.014, 0x7c5044, 0.18);
    line([[s * 0.009, 0.02], [s * 0.011, -0.005], [s * 0.014, -0.03]], 0x8e5a48, 0.12, 0.0035 * K);
    line([[s * 0.018, -0.04], [s * 0.026, -0.058], [s * 0.031, -0.077]], 0x9a6852, 0.16, 0.004 * K);
    line([[s * 0.018, -0.04], [s * 0.026, -0.058], [s * 0.031, -0.077]], 0x9a6852, 0.14, 0.002 * K);
  }
  soft(0, F.noseBase - 0.002, 0.016, 0.005, 0x5c3a30, 0.5);
  soft(0, F.lipBot - 0.005, 0.014, 0.004, 0x7a4a3c, 0.4);
  // the nostrils, on the underside
  for (const s of [-1, 1]) blob(s * 0.0105, F.noseBase + 0.001, 0.0045, 0.0028, 0x2e1a16, 0.9, s * 0.35);
  // behind the eyes: dark, so no gap between eyeball and lid shows skin
  for (const s of [-1, 1]) blob(s * F.eyeX, F.eye, 0.0152, 0.006, 0x2e1c18, 1, s * 0.08);

  // brows: straight and dark, thick at the inner end, tapering out; a soft mass, then the hairs
  for (const s of [-1, 1]) {
    const yAt = (ax) => F.brow - 0.004 + 0.007 * sm(ax, 0.01, 0.036) - 0.004 * sm(ax, 0.036, 0.05);
    line([[s * 0.012, yAt(0.012)], [s * 0.03, yAt(0.03)], [s * 0.046, yAt(0.046)]], 0x2a1a14, 0.55, 0.0045 * K);
    line([[s * 0.012, yAt(0.012) - 0.001], [s * 0.028, yAt(0.028)], [s * 0.05, yAt(0.05) - 0.0005]], 0x1e1410, 0.45, 0.0025 * K);
    for (let i = 0; i < 46; i++) {
      const ax = 0.01 + rnd() * 0.041;
      const spread = 0.0032 - 0.0022 * sm(ax, 0.012, 0.048);
      const fy = yAt(ax) + (rnd() - 0.5) * 2 * spread;
      const ang = ax < 0.02 ? 1.0 - rnd() * 0.4 : ax < 0.036 ? 0.35 - rnd() * 0.3 : -0.15 - rnd() * 0.3;
      hairStroke(s * ax, fy, 0.0032 + rnd() * 0.0015, s > 0 ? ang : Math.PI - ang, 0x1a100e, 0.5 + rnd() * 0.4, (0.6 + rnd() * 0.6) * K * 0.0006);
    }
  }
  // the lips: the upper darker with its bow, the lower fuller and warmer with a light band; the line; his left corner lifted
  {
    const top = (fx) => F.lipTop - 0.0025 * G(fx, 0.005) + 0.001 * G(Math.abs(fx) - 0.008, 0.004) - 0.006 * sm(Math.abs(fx), 0.014, 0.0275);
    const mid = (fx) => F.mouth - 0.0008 * G(fx, 0.012) + 0.0012 * sm(fx, 0.01, 0.0275) - 0.0002 * sm(-fx, 0.01, 0.0275);
    const bot = (fx) => F.lipBot + 0.0008 + 0.0085 * sm(Math.abs(fx), 0.01, 0.0275);
    const poly = (f0, f1, hex, a) => {
      g.fillStyle = rgba(hex, a); g.beginPath();
      for (let k = 0; k <= 24; k++) { const fx = -0.0275 + (k / 24) * 0.055; const [px, py] = P(fx, f0(fx)); k ? g.lineTo(px, py) : g.moveTo(px, py); }
      for (let k = 24; k >= 0; k--) { const fx = -0.0275 + (k / 24) * 0.055; const [px, py] = P(fx, f1(fx)); g.lineTo(px, py); }
      g.closePath(); g.fill();
    };
    poly(top, mid, 0x8e5a4e, 0.6);
    poly(mid, bot, 0xa8685a, 0.55);
    poly((fx) => mid(fx) - 0.003 - 0.002 * sm(Math.abs(fx), 0.008, 0.02), (fx) => mid(fx) - 0.0055, 0xc07a6a, 0.22);
    for (let i = 0; i < 9; i++) { const fx = -0.016 + i * 0.004 + (rnd() - 0.5) * 0.002; line([[fx, mid(fx) - 0.001], [fx + 0.0005, bot(fx) + 0.001]], 0x6a3a34, 0.14, 0.0006 * K); }
    line([[-0.027, mid(-0.027)], [-0.012, mid(-0.012)], [0, mid(0)], [0.012, mid(0.012)], [0.027, mid(0.027)]], 0x3a2020, 0.9, 0.0016 * K);
    line([[-0.0275, mid(-0.0275) + 0.0005], [-0.026, mid(-0.026)]], 0x2a1614, 0.7, 0.002 * K);
    line([[0.0275, mid(0.0275) + 0.0008], [0.026, mid(0.026)]], 0x2a1614, 0.7, 0.002 * K);
    soft(0.03, mid(0.0275) - 0.003, 0.006, 0.004, 0x8a5646, 0.3);   // the smile's fold at his left corner
  }
  // the moustache: light, fine, sparse at the philtrum, sweeping down and out
  for (const s of [-1, 1]) {
    soft(s * 0.012, -0.0535, 0.011, 0.0035, 0x2a1a16, 0.22);
    for (let i = 0; i < 110; i++) {
      const ax = 0.003 + rnd() * rnd() * 0.022, fy = -0.0495 - rnd() * 0.0065;
      if (ax < 0.006 && rnd() < 0.6) continue;
      const ang = -Math.PI / 2 + s * (0.35 + 0.4 * (ax / 0.024));
      hairStroke(s * ax, fy, 0.0016 + rnd() * 0.0012, ang, 0x241614, 0.25 + rnd() * 0.25, (0.4 + rnd() * 0.4) * K * 0.0005);
    }
  }
  // the goatee: a soul patch under the lip, the beard over the chin and under it, thinning along the jaw
  soft(0, -0.089, 0.0085, 0.006, 0x2a1a16, 0.5);
  soft(0, -0.106, 0.02, 0.012, 0x2a1a16, 0.5);
  for (let i = 0; i < 320; i++) {
    const inPatch = rnd() < 0.3;
    const fx = inPatch ? (rnd() - 0.5) * 0.016 : (rnd() - 0.5) * 0.044;
    const fy = inPatch ? -0.083 - rnd() * 0.011 : -0.095 - rnd() * 0.023;
    if (!inPatch && Math.abs(fx) > 0.02 && rnd() < 0.5) continue;
    hairStroke(fx, fy, 0.0016 + rnd() * 0.0016, -Math.PI / 2 + (rnd() - 0.5) * 0.7 + fx * 12, 0x1e1210, 0.3 + rnd() * 0.4, (0.4 + rnd() * 0.5) * K * 0.0005);
  }
  // stubble over the beard zone, thinning toward the cheekbones; none on the lips
  for (let i = 0; i < 1500; i++) {
    const d = (rnd() - 0.5) * 3.8, fy = -0.03 - rnd() * 0.09;
    const ad = Math.abs(d);
    if (fy > -0.084 && fy < -0.046 && ad < 0.34) continue;
    const edge = ad < 0.4 ? sm(-fy, 0.078, 0.09) : ad < 0.9 ? sm(-fy, 0.045 + (0.9 - ad) * 0.06, 0.07 + (0.9 - ad) * 0.05) : sm(-fy, 0.03, 0.05);
    if (rnd() > edge) continue;
    const [px, py] = PD(d, fy);
    g.fillStyle = rgba(0x3a2620, 0.14 + rnd() * 0.16);
    g.beginPath(); g.arc(px, py, 0.6 + rnd() * 0.6, 0, TAU); g.fill();
  }
  // the swatch strip: white, for the parts drawn in vertex colours
  g.fillStyle = '#ffffff'; g.fillRect(0, Math.floor(H * UV_V) + 1, W, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;         // v runs crown to chin, as the canvas does
  t.anisotropy = 4;
  return t;
}

/** A toon ramp of our own (the face and hair shade softer than the town's bands). */
function ramp(stops) {
  const data = new Uint8Array(stops.length * 4);
  stops.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const tex = new THREE.DataTexture(data, stops.length, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/* ------------------------------- the eyes ------------------------------- */
/** The eye opening: the lid margins over the eyeball, s -1 (inner corner) .. 1 (outer), as
 * elevation angles on the eyeball (rad).  Narrow: the upper lid heavy and low, the outer corner a touch higher. */
const AZ_HALF = 1.36;   // the corners' azimuth on the eyeball
const lidUp = (s) => 0.29 * (1 - s * s) ** 0.5 + 0.06 * (1 - s * s) * (0.4 - s) + 0.05 * s;
const lidLo = (s) => -0.2 * (1 - s * s) ** 0.7 + 0.05 * s;

/** Eyeballs, lids and the catch lights, in the head's frame.  Returns { parts: [{geo, color|colored}], lights: [geo] }. */
function eyeParts() {
  const parts = [], lights = [];
  for (const s of [-1, 1]) {
    const [bx, by, bz] = baseAt(s * F.eyeX, F.eye);
    const C0 = new THREE.Vector3(bx, by, bz - 0.0105);      // the eyeball's centre, back in its socket
    const tiltY = s * 0.12;                                 // the eyes' axes toe out with the face's curve
    const place = (g) => { g.rotateY(tiltY); g.translate(C0.x, C0.y, C0.z); return g; };
    // the eyeball: a cap facing +z, the iris and pupil in vertex colour, the cornea a slight dome
    const eye = new THREE.SphereGeometry(EYE_R, 22, 14, 0, TAU, 0, Math.PI * 0.62);
    eye.rotateX(Math.PI / 2);
    {
      const p = eye.getAttribute('position'), col = new Float32Array(p.count * 3);
      const v = new THREE.Vector3(), cc = new THREE.Color(), sc = new THREE.Color(0xe4d8cc), top = new THREE.Color(0xa08a80), pink = new THREE.Color(0xc98a7c);
      const iris = new THREE.Color(0x3b2216), rim = new THREE.Color(0x1e1210), light = new THREE.Color(0x6a4224), pupil = new THREE.Color(0x050303);
      for (let i = 0; i < p.count; i++) {
        v.set(p.getX(i), p.getY(i), p.getZ(i));
        const ang = Math.acos(clamp(v.z / EYE_R, -1, 1));          // from the axis
        const el = Math.atan2(v.y, Math.hypot(v.x, v.z));
        if (ang < 0.5) { const k = 1 + 0.07 * (1 - ang / 0.5) ** 2; p.setXYZ(i, v.x * k, v.y * k, v.z * k); }
        if (ang < 0.19) cc.copy(pupil);
        else if (ang < 0.5) {
          cc.copy(iris).lerp(light, 0.55 * sm(-v.y / EYE_R, -0.1, 0.45) * sm(ang, 0.2, 0.42));   // lit from below, as an iris is
          cc.lerp(rim, sm(ang, 0.4, 0.5));
          cc.lerp(pupil, 0.5 * (1 - sm(ang, 0.19, 0.26)));
        } else {
          cc.copy(sc).lerp(top, sm(el, 0.15, 0.7));                       // under the upper lid
          cc.lerp(pink, 0.7 * sm(-s * v.x / EYE_R, 0.55, 0.95));         // the inner corner
          cc.lerp(top, 0.35 * sm(ang, 0.9, 1.6));
        }
        col.set([cc.r, cc.g, cc.b], i * 3);
      }
      eye.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    parts.push({ geo: place(eye), colored: true });
    // the lids: strips from the margin outward, on a sphere just over the eyeball, thick over the top
    const lid = (upper) => {
      const NS = 22, NV = 5, pos = [], col = [], idx = [];
      const skin = new THREE.Color(C.skin), lash = new THREE.Color(upper ? 0x2a1814 : 0x6a4438), deep = new THREE.Color(C.skinShade);
      const cc = new THREE.Color();
      for (let j = 0; j <= NV; j++) {
        const v = j / NV;
        for (let i = 0; i <= NS; i++) {
          const sgn = (i / NS) * 2 - 1;                     // -1 inner .. 1 outer
          const az = -s * sgn * AZ_HALF;                    // inner corner toward the nose
          const e0 = upper ? lidUp(sgn) : lidLo(sgn);
          const span = (upper ? 0.62 : -0.3) * (0.55 + 0.45 * (1 - sgn * sgn));
          const el = e0 + span * v;
          const r = EYE_R + 0.0012 + (upper ? 0.0038 : 0.0014) * Math.sin(Math.PI * v) ** 0.9 * (0.5 + 0.5 * (1 - sgn * sgn));
          pos.push(r * Math.sin(az) * Math.cos(el), r * Math.sin(el), r * Math.cos(az) * Math.cos(el));
          cc.copy(skin).lerp(deep, upper ? 0.35 * sm(v, 0.5, 1) : 0.45 * (1 - sm(v, 0.3, 1)));
          cc.lerp(lash, upper ? 1 - sm(v, 0.06, 0.34) : 0.85 * (1 - sm(v, 0.0, 0.35)));
          col.push(cc.r, cc.g, cc.b);
        }
      }
      const Wd = NS + 1;
      for (let j = 0; j < NV; j++) for (let i = 0; i < NS; i++) {
        const a = j * Wd + i, b = (j + 1) * Wd + i, c2 = (j + 1) * Wd + i + 1, d = j * Wd + i + 1;
        idx.push(a, b, c2, a, c2, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      // the normals must face out of the eye, whichever way the strip winds
      const nn = g.getAttribute('normal'), pp = g.getAttribute('position');
      let dot = 0;
      for (let i = 0; i < nn.count; i++) dot += nn.getX(i) * pp.getX(i) + nn.getY(i) * pp.getY(i) + nn.getZ(i) * pp.getZ(i);
      if (dot < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
      return place(g);
    };
    parts.push({ geo: lid(true), colored: true });
    parts.push({ geo: lid(false), colored: true });
    // the catch light: a small disc on the cornea, up and toward the nose
    const cl = new THREE.CircleGeometry(0.0011, 10);
    cl.translate(0, 0, EYE_R * 1.07 + 0.0002);
    cl.rotateX(-0.24); cl.rotateY(-s * 0.2);
    lights.push(place(cl));
  }
  return { parts, lights };
}

/** An ear, in the head's frame: the shell, the helix's rim, the lobe; most of it under the hair. */
function earParts(s) {
  const parts = [];
  const x = HEAD.rx * 0.985, y = -0.003, z = -0.012;
  const shell = new THREE.SphereGeometry(0.016, 12, 9);
  shell.scale(0.3, 1.75, 1.0); shell.rotateZ(-s * 0.12); shell.translate(s * (x + 0.002), y, z);
  {
    const p = shell.getAttribute('position'), col = new Float32Array(p.count * 3);
    const a = new THREE.Color(C.skin), b = new THREE.Color(0x8a5a42), cc = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const ox = (p.getX(i) - s * (x + 0.002)) * s;   // outward
      cc.copy(a).lerp(b, 0.75 * (1 - sm(ox, -0.001, 0.004)));   // the concha, in shadow
      col.set([cc.r, cc.g, cc.b], i * 3);
    }
    shell.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  parts.push({ geo: shell, colored: true });
  const rim = new THREE.TorusGeometry(0.0125, 0.0038, 6, 18, Math.PI * 1.25);
  rim.rotateZ(Math.PI * 0.62); rim.scale(1, 1.55, 1); rim.rotateY(s * Math.PI / 2); rim.translate(s * (x + 0.006), y + 0.006, z);
  parts.push({ geo: rim, color: C.skin });
  const lobe = new THREE.SphereGeometry(0.0065, 10, 8);
  lobe.scale(0.7, 1, 1); lobe.translate(s * (x + 0.005), y - 0.025, z + 0.002);
  parts.push({ geo: lobe, color: C.skin });
  return parts;
}

/* ------------------------------- the hair ------------------------------- */
/** The hair's strip map, 64 x 256: strands along v, the ribbon's edges and tip frayed in alpha. */
function hairMap() {
  const W = 64, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  let seed = 5;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.fillStyle = 'rgb(190,182,178)'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W, w = 0.6 + rnd() * 2.6, v = 90 + rnd() * 165;
    g.fillStyle = `rgba(${v | 0},${(v * 0.96) | 0},${(v * 0.94) | 0},${0.35 + rnd() * 0.5})`;
    g.fillRect(x, 0, w, H);
  }
  // a light along the clump's middle
  const grd = g.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, 'rgba(0,0,0,0.35)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.12)'); grd.addColorStop(0.6, 'rgba(255,255,255,0.1)'); grd.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // alpha: cut the edges ragged and the tip into strands
  const img = g.getImageData(0, 0, W, H), d = img.data;
  const edge = new Float32Array(W), tipLen = new Float32Array(W);
  for (let x = 0; x < W; x++) { edge[x] = rnd(); tipLen[x] = rnd(); }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / (W - 1), v = y / (H - 1);
    const e = Math.min(u, 1 - u);                                   // distance to the edge
    let a = sm(e, 0.02, 0.08 + 0.08 * edge[x]);
    const fray = 0.86 + 0.13 * tipLen[x] * tipLen[(x + 2) % W];   // where this strand ends
    a *= 1 - sm(v, fray - 0.03, fray);
    d[(y * W + x) * 4 + 3] = Math.round(255 * a);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;         // v runs root to tip, as the canvas does
  t.anisotropy = 4;
  return t;
}

/** A flattened, slightly cupped ribbon along a polyline: half-width hw(u), `across` quads wide.
 * uv v runs along it; aHang (0 on the skull .. 1 at the tip) lets the ends swing. */
function ribbon(pts, hw, hangFrom, across = 3) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.5);
  const N = Math.max(6, Math.round(pts.length * 1.8));
  const P = curve.getPoints(N);
  const pos = [], uv = [], hang = [], idx = [];
  const T = new THREE.Vector3(), R = new THREE.Vector3(), S = new THREE.Vector3(), Nn = new THREE.Vector3(), prevS = new THREE.Vector3();
  for (let i = 0; i <= N; i++) {
    const p = P[i], u = i / N;
    T.subVectors(P[Math.min(N, i + 1)], P[Math.max(0, i - 1)]).normalize();
    R.set(p.x, p.y * 0.35, p.z).normalize();                      // outward from the head
    S.crossVectors(R, T);
    if (S.lengthSq() < 1e-6) S.copy(prevS); else S.normalize();
    if (i > 0 && S.dot(prevS) < 0) S.negate();
    prevS.copy(S);
    Nn.crossVectors(T, S).normalize();
    const w = hw(u), h = Math.max(0, (u - hangFrom) / (1 - hangFrom || 1));
    for (let k = 0; k <= across; k++) {
      const a = (k / across) * 2 - 1;
      const cup = (1 - a * a) * w * 0.35;
      pos.push(p.x + S.x * a * w + Nn.x * cup, p.y + S.y * a * w + Nn.y * cup, p.z + S.z * a * w + Nn.z * cup);
      uv.push(k / across, u);
      hang.push(h);
    }
  }
  const Wd = across + 1;
  for (let i = 0; i < N; i++) for (let k = 0; k < across; k++) {
    const a = i * Wd + k, b = (i + 1) * Wd + k, c = (i + 1) * Wd + k + 1, d = i * Wd + k + 1;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aHang', new THREE.Float32BufferAttribute(hang, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Hair: a scalp shell cut at the hairline, and layered ribbon clumps from a
 * centre part (a touch to his left): the fringe in curtains over the temples,
 * the sides past the ears to the jaw, the back to the collar, short clumps
 * over the crown for volume.  Head frame, centred on the head. */
function hairParts() {
  const parts = [];
  const RX = HEAD.rx * 1.06, RY = HEAD.ry * 1.06, RZ = HEAD.rz * 1.06;
  const PART = 0.06;    // the part's azimuth offset, toward his left
  const shell = new THREE.SphereGeometry(1, 30, 20);
  {
    const p = shell.getAttribute('position'), uv = shell.getAttribute('uv'), hang = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      let th = Math.acos(clamp(y, -1, 1));
      const d = Math.atan2(x, z), ad = Math.abs(d);
      let hl = 0.98 + 0.3 * sm(ad, 0.4, 1.0) + 0.8 * sm(ad, 1.0, 2.3);
      hl += 0.04 * Math.sin(d * 9.0) * sm(ad, 0.1, 0.6);
      if (th > hl) th = hl;
      const st = Math.sin(th), ct = Math.cos(th);
      const k = Math.hypot(x, z) || 1;
      const part = 1 - 0.022 * Math.exp(-(((d - PART) / 0.09) ** 2)) * sm(z, -0.6, 0.2) * sm(ct, 0.3, 0.9);
      const crown = 1 + 0.04 * sm(ct, 0.2, 0.9) * (1 - 0.5 * sm(z, 0.2, 0.7));   // volume at the crown and behind
      p.setXYZ(i, (x / k) * st * RX * part * crown, ct * RY * part * crown + 0.003, (z / k) * st * RZ * part * crown);
      uv.setY(i, uv.getY(i) * 0.6);
    }
    shell.setAttribute('aHang', new THREE.BufferAttribute(hang, 1));
    shell.computeVertexNormals();
  }
  parts.push({ geo: shell, color: 0x2a201e });
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const onHead = (th, az, out) => [Math.sin(th) * Math.sin(az) * (RX + out), Math.cos(th) * (RY + out), Math.sin(th) * Math.cos(az) * (RZ + out)];
  /* s side, az0..az1 the root's azimuth drift over the skull, len the hang
   * below the ear line, w the clump's half-width, flare out at the ends,
   * out the layer's lift off the scalp, thEnd where the skull part ends. */
  const add = (s, az0, az1, len, w, flare, out, tone, thEnd = 1.35) => {
    const pts = [];
    const th0 = 0.2 + rnd() * 0.06;
    for (let k = 0; k <= 5; k++) {
      const u = k / 5, th = th0 + u * (thEnd - th0), az = PART + s * (az0 + (az1 - az0) * u);
      pts.push(onHead(th, az, out * (0.3 + 0.7 * u) + 0.002));
    }
    let hangFrom = 1;
    if (len > 0) {
      const [ex, ey, ez] = pts[pts.length - 1];
      const hx = ex / Math.hypot(ex, ez), hz = ez / Math.hypot(ex, ez);
      const curl = 0.4 + rnd() * 0.6;
      for (let k = 1; k <= 3; k++) {
        const u = k / 3;
        pts.push([ex + hx * flare * u * u - hx * 0.006 * u * curl, ey - len * u, ez + hz * flare * u * u - 0.012 * u * curl]);
      }
      hangFrom = 5 / 8;
    }
    const hw = (u) => w * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.6) * (1 - 0.55 * sm(u, 0.75, 1));
    parts.push({ geo: ribbon(pts, hw, hangFrom), color: tone });
  };
  const T = { deep: 0x36282a, mid: 0x44342e, top: 0x503e38, warm: 0x5e4a40 };
  for (const s of [-1, 1]) {
    // the fringe: wide clumps from the part sweeping sideways over the temples to the cheekbone, a loose strand forward
    add(s, 0.02, 0.6, 0.03 + rnd() * 0.02, 0.015, 0.004, 0.003, T.mid);
    add(s, 0.1, 0.8, 0.05 + rnd() * 0.02, 0.015, 0.006, 0.006, T.top);
    add(s, 0.16, 1.0, 0.07 + rnd() * 0.02, 0.015, 0.01, 0.004, T.mid);
    add(s, 0.24, 1.2, 0.09 + rnd() * 0.02, 0.014, 0.013, 0.007, T.top);
    add(s, 0.33, 1.4, 0.1, 0.013, 0.016, 0.003, T.deep);
    add(s, 0.42, 1.55, 0.11, 0.013, 0.018, 0.008, T.warm);
    add(s, 0.03, 0.35, 0.025, 0.005, 0.01, 0.01, T.top);      // a loose strand off the part
    // the sides, over the ear: an inner layer close and wide, an outer layer lighter
    for (let i = 0; i < 9; i++) {
      const a0 = 0.5 + i * 0.18 + rnd() * 0.06;
      add(s, a0, a0 + 0.8 + rnd() * 0.3, 0.12 + rnd() * 0.04, 0.014 + rnd() * 0.003, 0.012 + rnd() * 0.01, 0.0015, i % 2 ? T.deep : T.mid);
    }
    for (let i = 0; i < 6; i++) {
      const a0 = 0.6 + i * 0.27 + rnd() * 0.08;
      add(s, a0, a0 + 0.9 + rnd() * 0.3, 0.11 + rnd() * 0.05, 0.011 + rnd() * 0.003, 0.016 + rnd() * 0.012, 0.006, i % 3 ? T.top : T.warm);
    }
    // the back, to the collar
    for (let i = 0; i < 7; i++) {
      const a0 = 2.2 + i * 0.14 + rnd() * 0.06;
      add(s, a0, Math.min(3.1, a0 + 0.5 + rnd() * 0.4), 0.17 + rnd() * 0.04, 0.015, 0.008, 0.0015, i % 2 ? T.deep : T.mid);
    }
    for (let i = 0; i < 5; i++) {
      const a0 = 2.3 + i * 0.2 + rnd() * 0.08;
      add(s, a0, Math.min(3.1, a0 + 0.6 + rnd() * 0.4), 0.15 + rnd() * 0.05, 0.012, 0.012, 0.006, T.top);
    }
    // short clumps lying over the crown from the part
    for (let i = 0; i < 6; i++) {
      const a0 = 0.1 + i * 0.5 + rnd() * 0.2;
      add(s, a0, a0 + 0.3 + rnd() * 0.3, 0, 0.012, 0, 0.003 + rnd() * 0.003, i % 2 ? T.top : T.mid, 0.9 + rnd() * 0.2);
    }
  }
  return parts;
}

/** Concatenate geometries (non-indexed) on the given attributes. */
function mergeGeos(list, attrs = [['position', 3], ['normal', 3]]) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of geos) n += g.getAttribute('position').count;
  const out = new THREE.BufferGeometry();
  for (const [k, size] of attrs) {
    const arr = new Float32Array(n * size);
    let o = 0;
    for (const g of geos) { const a = g.getAttribute(k); if (a) arr.set(a.array, o * size); o += g.getAttribute('position').count; }
    out.setAttribute(k, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

/* ------------------------------ the figure ------------------------------ */

export function makeHan() {
  const J = {};
  const root = new THREE.Group();
  root.name = 'han';
  const node = (name, parent, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.name = 'han-' + name;
    g.position.set(x, y, z);
    parent.add(g);
    J[name] = g;
    return g;
  };
  /* Parts are gathered per joint and kind and drawn as one mesh each,
   * their colours per vertex. */
  const buckets = new Map();
  const mesh = (parent, geo, hex, kind = 'cloth', mapped = false, colored = false) => {
    const key = parent.uuid + kind;
    if (!buckets.has(key)) buckets.set(key, { parent, kind, list: [] });
    buckets.get(key).list.push({ geo, color: new THREE.Color(hex), mapped, colored });
  };
  // cloth folds: soft vertical ridges, stronger where `w(t)` says
  const ridges = (n, amp, w = () => 1, ph = 0) => (a, t) => 1 + amp * w(t) * Math.sin(a * n + ph) * (0.6 + 0.4 * Math.sin(a * (n - 1) * 0.5 + 1.3));

  const pelvis = node('pelvis', root, 0, 0.97, 0);
  /* the hips and the seat of the trousers, the waistband under the jacket */
  {
    const hips = tube([
      { y: 0.1, rx: 0.15, rz: 0.1 }, { y: 0.04, rx: 0.165, rz: 0.115 }, { y: -0.04, rx: 0.17, rz: 0.125, z: -0.008 },
      { y: -0.1, rx: 0.16, rz: 0.12 }, { y: -0.14, rx: 0.14, rz: 0.1 },
    ], 22, { capTop: true, capBottom: true, fold: ridges(7, 0.012, (t) => sm(t, 0.3, 1)) });
    mesh(pelvis, hips, C.khaki);
    const belt = new THREE.TorusGeometry(0.152, 0.012, 6, 28);
    belt.rotateX(Math.PI / 2); belt.scale(1, 1, 0.68); belt.translate(0, 0.1, 0);
    mesh(pelvis, belt, C.shoe);
  }
  const spine = node('spine', pelvis, 0, 0.08, 0);
  const chest = node('chest', spine, 0, 0.12, 0);
  {
    // the top under the open jacket: from the collarbones down over the stomach to the belt
    const tee = tube([
      { y: 0.36, rx: 0.075, rz: 0.06 }, { y: 0.33, rx: 0.13, rz: 0.085 }, { y: 0.26, rx: 0.16, rz: 0.1 }, { y: 0.14, rx: 0.155, rz: 0.1 },
      { y: 0.0, rx: 0.145, rz: 0.095 }, { y: -0.12, rx: 0.145, rz: 0.098 }, { y: -0.2, rx: 0.15, rz: 0.1 },
    ], 22, { capTop: true, capBottom: true, fold: ridges(6, 0.01, (t) => sm(t, 0.4, 1), 0.4) });
    mesh(chest, tee, C.tee);
    // the jacket: open down the front, loose over the hips, a zip placket either side
    const OPEN = 0.3;   // half-angle of the opening at the front: a hand's width of the top shows
    const jk = (() => {
      const rings = [
        { y: 0.39, rx: 0.135, rz: 0.1, z: -0.005 }, { y: 0.35, rx: 0.19, rz: 0.125 }, { y: 0.3, rx: 0.205, rz: 0.135 }, { y: 0.2, rx: 0.2, rz: 0.135 },
        { y: 0.08, rx: 0.19, rz: 0.13 }, { y: -0.05, rx: 0.185, rz: 0.13 }, { y: -0.16, rx: 0.19, rz: 0.135 }, { y: -0.24, rx: 0.195, rz: 0.14 },
      ];
      const seg = 30;
      const pos = [], idx = [];
      const n = rings.length;
      for (let i = 0; i < n; i++) {
        const r = rings[i], t = i / (n - 1);
        for (let j = 0; j <= seg; j++) {
          const a = OPEN + (TAU - 2 * OPEN) * (j / seg);              // from one edge of the opening round the back to the other
          // folds: soft ridges, gathering toward the hem; the cloth pulled at the folded arms' height
          const k = 1 + 0.018 * (0.5 + 0.5 * sm(t, 0.3, 1)) * Math.sin(a * 6 + 0.8) * (0.7 + 0.3 * Math.sin(a * 2.5 + 2.0))
            + 0.01 * Math.exp(-(((t - 0.62) / 0.12) ** 2)) * Math.sin(a * 3 + 1.5);
          pos.push((r.x || 0) + Math.sin(a) * r.rx * k, r.y, (r.z || 0) + Math.cos(a) * r.rz * k);
        }
      }
      const W = seg + 1;
      for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
        const a = i * W + j, b = (i + 1) * W + j, c = (i + 1) * W + j + 1, d = i * W + j + 1;
        idx.push(a, b, c, a, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    })();
    mesh(chest, jk, C.jacket);
    // the collar: a stand collar round the neck, open at the front
    const col = tube([{ y: 0.46, rx: 0.088, rz: 0.078, z: -0.01 }, { y: 0.38, rx: 0.1, rz: 0.088, z: -0.01 }], 22, {
      fold: (a) => (Math.abs(((a + Math.PI) % TAU) - Math.PI) < 0.55 ? 0.001 : 1),
    });
    mesh(chest, col, C.jacketDark);
    // the chain, a thin loop lying on the top, and its pendant
    const ch = new THREE.TorusGeometry(0.075, 0.004, 5, 30, Math.PI);
    ch.rotateZ(Math.PI); ch.rotateX(-1.25);
    ch.translate(0, 0.33, 0.06);
    mesh(chest, ch, C.chain, 'skin');
    const pend = new THREE.CylinderGeometry(0.006, 0.006, 0.022, 8);
    pend.translate(0, 0.255, 0.102);
    mesh(chest, pend, C.chain, 'skin');
  }
  const neck = node('neck', chest, 0, 0.345, 0.0);
  const head = node('head', neck, 0, 0.055, 0.01);
  {
    // the neck, drawn with the head (it turns with it)
    const nk = tube([{ y: 0.03, rx: 0.052, rz: 0.05 }, { y: -0.06, rx: 0.056, rz: 0.056, z: -0.004 }, { y: -0.13, rx: 0.07, rz: 0.062, z: -0.01 }], 16, { capBottom: true });
    mesh(head, nk, 0xb8845e, 'face');
    // the head, with the face map
    const hg = headGeometry();
    hg.translate(0, HEAD_Y, 0);
    mesh(head, hg, 0xffffff, 'face', true);
    const eyes = eyeParts();
    for (const e of eyes.parts) { e.geo.translate(0, HEAD_Y, 0); mesh(head, e.geo, e.color ?? 0xffffff, 'face', false, e.colored); }
    for (const g of eyes.lights) { g.translate(0, HEAD_Y, 0); mesh(head, g, 0xffffff, 'face'); }
    for (const s of [-1, 1]) for (const e of earParts(s)) { e.geo.translate(0, HEAD_Y, 0); mesh(head, e.geo, e.color ?? 0xffffff, 'face', false, e.colored); }
    for (const h of hairParts()) { h.geo.translate(0, HEAD_Y, 0); mesh(head, h.geo, h.color, 'hair', true); }
  }
  /* arms: the sleeves loose, a bend crease at the elbow, cuffs at the wrist, the hands */
  const arm = (side) => {
    const s = side === 'l' ? 1 : -1;
    const sh = node(side + 'Sh', chest, s * 0.2, 0.29, -0.005);
    sh.rotation.order = 'ZXY';
    const cap = new THREE.SphereGeometry(0.07, 14, 10);
    cap.scale(1.05, 0.9, 0.95); cap.translate(0, -0.01, 0);
    mesh(sh, cap, C.jacket);
    const upper = tube([{ y: -0.01, rx: 0.068, rz: 0.066 }, { y: -0.13, rx: 0.062, rz: 0.062 }, { y: -0.26, rx: 0.058, rz: 0.058 }, { y: -0.34, rx: 0.056, rz: 0.056 }], 16,
      { capBottom: true, fold: ridges(5, 0.02, (t) => sm(t, 0.4, 1), 0.7) });
    mesh(sh, upper, C.jacket);
    const el = node(side + 'El', sh, 0, -0.33, 0);
    el.rotation.order = 'YXZ';
    const fore = tube([{ y: 0.02, rx: 0.056, rz: 0.056 }, { y: -0.08, rx: 0.052, rz: 0.052 }, { y: -0.18, rx: 0.046, rz: 0.046 }, { y: -0.245, rx: 0.042, rz: 0.04 }], 14,
      { capTop: true, capBottom: true, fold: ridges(5, 0.018, (t) => 1 - 0.6 * t, 2.1) });
    mesh(el, fore, C.jacket);
    const cuff = new THREE.CylinderGeometry(0.037, 0.04, 0.03, 14);
    cuff.translate(0, -0.26, 0);
    mesh(el, cuff, C.jacketDark);
    // the hand, cupped: palm, four fingers together, the thumb
    const hand = node(side + 'Hand', el, 0, -0.275, 0);
    const palm = new THREE.SphereGeometry(0.036, 12, 8);
    palm.scale(0.95, 1.3, 0.5); palm.translate(0, -0.03, 0.004);
    mesh(hand, palm, C.skin, 'skin');
    for (let i = 0; i < 4; i++) {
      const f = new THREE.CapsuleGeometry(0.0085, 0.036 - Math.abs(i - 1.2) * 0.005, 3, 7);
      f.rotateX(0.9); f.translate(s * (-0.024 + i * 0.016), -0.072, 0.02);
      mesh(hand, f, C.skin, 'skin');
    }
    const thumb = new THREE.CapsuleGeometry(0.009, 0.032, 3, 7);
    thumb.rotateZ(s * 0.9); thumb.rotateX(0.5); thumb.translate(s * 0.035, -0.04, 0.012);
    mesh(hand, thumb, C.skin, 'skin');
  };
  arm('l'); arm('r');
  /* legs: loose cargo trousers, a pocket on each thigh, the hems bunched over the shoes */
  const leg = (side) => {
    const s = side === 'l' ? 1 : -1;
    const hip = node(side + 'Hip', pelvis, s * 0.09, -0.03, 0);
    const thigh = tube([{ y: 0.03, rx: 0.095, rz: 0.1 }, { y: -0.12, rx: 0.098, rz: 0.1 }, { y: -0.28, rx: 0.092, rz: 0.095 }, { y: -0.42, rx: 0.086, rz: 0.088 }, { y: -0.47, rx: 0.082, rz: 0.084 }], 18,
      { capTop: true, capBottom: true, fold: ridges(6, 0.02, (t) => 0.4 + 0.6 * sm(t, 0.3, 1), s * 0.9) });
    mesh(hip, thigh, C.khaki);
    // the cargo pocket, on the outside of the thigh, with its flap
    const pk = new THREE.BoxGeometry(0.03, 0.15, 0.13, 1, 2, 2);
    pk.translate(s * 0.095, -0.27, 0.01);
    mesh(hip, pk, C.khaki);
    const flap = new THREE.BoxGeometry(0.034, 0.04, 0.135);
    flap.translate(s * 0.096, -0.2, 0.01);
    mesh(hip, flap, C.khakiDark);
    const knee = node(side + 'Knee', hip, 0, -0.44, 0);
    const shin = tube([{ y: 0.03, rx: 0.084, rz: 0.086 }, { y: -0.12, rx: 0.088, rz: 0.09 }, { y: -0.26, rx: 0.09, rz: 0.094 }, { y: -0.36, rx: 0.094, rz: 0.1 }, { y: -0.42, rx: 0.1, rz: 0.105 }], 18,
      { capTop: true, capBottom: true, fold: ridges(7, 0.03, (t) => 0.3 + 0.7 * sm(t, 0.5, 1), s * 1.7) });
    mesh(knee, shin, C.khaki);
    // the hem, bunched: a heavier ring of folds sitting on the shoe
    const hem = tube([{ y: -0.4, rx: 0.098, rz: 0.104 }, { y: -0.44, rx: 0.104, rz: 0.11 }, { y: -0.47, rx: 0.098, rz: 0.104 }], 18,
      { capBottom: true, fold: ridges(8, 0.05, () => 1, s * 0.3) });
    mesh(knee, hem, C.khakiDark);
    const ankle = node(side + 'Foot', knee, 0, -0.43, 0);
    ankle.rotation.order = 'YXZ';
    // a low dark trainer: the upper a long rounded shape, a toe cap, the sole
    const shoe = new THREE.SphereGeometry(0.05, 14, 10);
    shoe.scale(0.95, 0.75, 2.5); shoe.translate(0, -0.03, 0.075);
    mesh(ankle, shoe, C.shoe);
    const heel = new THREE.SphereGeometry(0.048, 12, 8);
    heel.scale(0.9, 1.0, 0.9); heel.translate(0, -0.015, -0.02);
    mesh(ankle, heel, C.shoe);
    const sole = new THREE.BoxGeometry(0.1, 0.028, 0.29, 1, 1, 3);
    { const p = sole.getAttribute('position'); for (let i = 0; i < p.count; i++) { const z = p.getZ(i); if (z > 0.1) p.setX(i, p.getX(i) * 0.85); } }
    sole.translate(0, -0.064, 0.075);
    mesh(ankle, sole, C.sole);
  };
  leg('l'); leg('r');

  // the skin shades softly (a painted face, not three bands); the hair keeps a crisp highlight band
  const skinRamp = ramp([136, 150, 164, 178, 192, 206, 220, 234, 246, 255]);
  const skinMat = cel({ color: 0xffffff, bands: 'soft3', tint: 0xb07a8a, flat: false, vertexColors: true });
  skinMat.gradientMap = skinRamp;
  const faceMat = cel({ color: 0xffffff, map: faceMap(), bands: 'soft3', tint: 0xa8788a, flat: false, vertexColors: true });
  faceMat.gradientMap = skinRamp;
  const clothMat = cel({ color: 0xffffff, bands: 4, tint: 0x5a5480, flat: false, vertexColors: true, side: THREE.DoubleSide });
  const hairMat = cel({ color: 0xffffff, map: hairMap(), bands: 3, tint: 0x4a4068, flat: false, vertexColors: true, side: THREE.DoubleSide, alphaTest: 0.5 });
  hairMat.gradientMap = ramp([54, 92, 132, 255]);
  // the hair's ends swing: a small offset in the head's frame, by how far down the ribbon a vertex is
  const swing = { value: new THREE.Vector2() };
  {
    const prev = hairMat.onBeforeCompile;
    hairMat.onBeforeCompile = (shader) => {
      prev?.(shader);
      shader.uniforms.uSwing = swing;
      shader.vertexShader = 'attribute float aHang;\nuniform vec2 uSwing;\n'
        + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed += vec3( uSwing.x, -0.3 * length( uSwing ), uSwing.y ) * aHang * aHang;');
    };
    hairMat.customProgramCacheKey = () => 'hanHair';
  }
  for (const b of buckets.values()) {
    const withUV = b.kind === 'face' || b.kind === 'hair';
    const geos = b.list.map(({ geo, color, mapped, colored }) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      const n = g.getAttribute('position').count;
      if (!colored) {
        const c = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      }
      if (withUV && !mapped) {
        const uv = new Float32Array(n * 2);
        for (let i = 0; i < n; i++) uv.set(SWATCH, i * 2);
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      }
      if (b.kind === 'hair' && !g.getAttribute('aHang')) g.setAttribute('aHang', new THREE.BufferAttribute(new Float32Array(n), 1));
      return g;
    });
    const attrs = [['position', 3], ['normal', 3], ['color', 3]];
    if (withUV) attrs.push(['uv', 2]);
    if (b.kind === 'hair') attrs.push(['aHang', 1]);
    const out = mergeGeos(geos, attrs);
    const m = new THREE.Mesh(out, b.kind === 'skin' ? skinMat : b.kind === 'face' ? faceMat : b.kind === 'hair' ? hairMat : clothMat);
    m.castShadow = b.kind !== 'skin' && b.kind !== 'face';       // the face and neck sit in the hair's and jacket's shadow anyway
    b.parent.add(m);
  }

  /* the hair's swing: a damped spring in the head's frame, kicked by the
   * head's turning and by how the head is thrown about (the car) */
  const H = { last: 0, rx: 0, ry: 0, s: new THREE.Vector2(), v: new THREE.Vector2(), p: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(), a: new THREE.Vector3(), w: new THREE.Vector3(), lastVel: new THREE.Vector3() };
  const swingStep = () => {
    const now = performance.now();
    const dt = H.last ? Math.min(0.05, (now - H.last) / 1000) : 0;
    H.last = now;
    if (dt <= 0) return;
    // the head's angles as they ended last frame (index.js adds the look and the nod after apply)
    const rx = J.head.rotation.x, ry = J.head.rotation.y;
    const wy = (ry - H.ry) / dt, wx = (rx - H.rx) / dt;
    H.rx = rx; H.ry = ry;
    J.head.matrixWorld.decompose(H.w, H.q, H.a);
    const first = H.p.lengthSq() === 0;
    H.vel.subVectors(H.w, H.p).divideScalar(dt);
    H.p.copy(H.w);
    // the head's acceleration, into its own frame (the car throws him about)
    let ax = 0, az = 0;
    if (!first && H.vel.lengthSq() < 400) {
      H.a.subVectors(H.vel, H.lastVel).divideScalar(dt).applyQuaternion(H.q.invert());
      ax = clamp(H.a.x, -30, 30); az = clamp(H.a.z, -30, 30);
    }
    H.lastVel.copy(H.vel);
    const kx = -0.006 * clamp(wy, -8, 8) - 0.0015 * ax, kz = 0.006 * clamp(wx, -8, 8) - 0.0015 * az;
    const K = 140, Cd = 9;
    H.v.x += (-K * H.s.x - Cd * H.v.x) * dt + kx;
    H.v.y += (-K * H.s.y - Cd * H.v.y) * dt + kz;
    H.s.addScaledVector(H.v, dt);
    H.s.x = clamp(H.s.x, -0.03, 0.03); H.s.y = clamp(H.s.y, -0.03, 0.03);
    swing.value.copy(H.s);
  };

  const apply = (p) => {
    J.pelvis.position.y = p.pelvisY;
    J.pelvis.rotation.set(p.pelvisX, 0, p.pelvisZ);
    J.spine.rotation.set(p.spineX, 0, 0);
    J.chest.rotation.x = p.chestX;
    J.chest.rotation.z = p.chestZ;
    J.neck.rotation.x = p.neckX;
    J.head.rotation.x = p.headX;
    J.head.rotation.z = p.headZ;
    J.lSh.rotation.set(p.lShX, p.lShY, p.lShZ);
    J.rSh.rotation.set(p.rShX, p.rShY, p.rShZ);
    J.lEl.rotation.set(p.lElX, p.lElY, 0);
    J.rEl.rotation.set(p.rElX, p.rElY, 0);
    // the wrist bends toward the body (the elbow's YXZ frame puts the body at local -x for the left arm, +x for the right)
    J.lHand.rotation.set(0, 0, -p.lHand);
    J.rHand.rotation.set(0, 0, p.rHand);
    J.lHip.rotation.set(p.lHipX, 0, p.lHipZ);
    J.rHip.rotation.set(p.rHipX, 0, p.rHipZ);
    J.lKnee.rotation.x = p.lKnee;
    J.rKnee.rotation.x = p.rKnee;
    J.lFoot.rotation.set(p.lFoot, p.lFootY, 0);
    J.rFoot.rotation.set(p.rFoot, p.rFootY, 0);
  };
  const applyAll = (p) => { swingStep(); apply(p); };
  applyAll(POSES.lean);
  return { group: root, joints: J, apply: applyAll };
}
