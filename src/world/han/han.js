import * as THREE from 'three';
import { cel } from '../../core/toon.js';

/* ------------------------------------------------------------------ *
 * Han, as in the Tokyo Drift still Tan gave as the reference (2026-09-28):
 * a slim man of 1.78 m leaning back against the car's flank ahead of the
 * rear wheel, his weight on the car, legs out and crossed at the ankle,
 * arms folded low across his stomach, head a little forward; thick near-black
 * shaggy hair to the collar, parted on his right with a long fringe swept
 * across to his left, framing a long, high-cheekboned face with an easy
 * half-smile and light stubble; a washed charcoal-navy denim overshirt worn
 * open (point collar, snap placket, flap chest pockets) over a mid-blue
 * tee, a thin pendant chain, loose olive cargo trousers bunched over dark
 * shoes.  Built in code, no photo; cel-shaded like the town but at
 * real proportions: the aim is a person, not a mannequin.
 *
 * Bone-free: a tree of pivots (pelvis, spine, chest, neck, head, the
 * arms and legs), each part a mesh hung from its pivot.  A pose is a
 * table of joint angles (POSES); han/index.js blends between them and
 * lays the small motions on top (breathing, the head turn, the nod).  He
 * faces +z in his own frame; his left is +x.
 *
 * Draws: parts are gathered per joint and kind (skin / face / cloth / hair)
 * and merged, colours per vertex (the cloth over a tiled weave map): 17
 * draws for the whole man.
 * ------------------------------------------------------------------ */

const C = {
  skin: 0xcda995,
  skinShade: 0xb2917a,
  hair: 0x1c1517,
  jacket: 0x333b4c,      // washed charcoal-navy denim (the cloth map darkens it a little)
  jacketDark: 0x272d3c,  // its seams, the collar's underside, the cuffs
  snap: 0x6a6e74,        // the placket's snaps
  tee: 0x4c6b94,         // a mid-blue crew-neck
  khaki: 0x968b6e,
  khakiDark: 0x7f755c,
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
function tube(rings, seg = 20, { fold = null, capTop = false, capBottom = false, uvScale = [3, 1] } = {}) {
  const pos = [], uv = [], idx = [];
  const n = rings.length;
  for (let i = 0; i < n; i++) {
    const r = rings[i], t = i / (n - 1);
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * TAU;
      const k = fold ? fold(a, t, i) : 1;
      pos.push((r.x || 0) + Math.sin(a) * r.rx * k, r.y, (r.z || 0) + Math.cos(a) * r.rz * k);
      uv.push((j / seg) * uvScale[0], t * uvScale[1]);
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
    uv.push(0.5, 0.5);
    for (let j = 0; j < seg; j++) {
      const a = i * W + j, b = i * W + j + 1;
      if (up) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  };
  if (capTop) cap(0, true);
  if (capBottom) cap(n - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A grid strip from rows of points (each row the same length): rows x cols, quads between neighbours. */
function strip(rows, uvScale = [1, 1]) {
  const pos = [], uv = [], idx = [];
  const R = rows.length, Cn = rows[0].length;
  for (let i = 0; i < R; i++) for (let j = 0; j < Cn; j++) {
    pos.push(...rows[i][j]);
    uv.push((j / (Cn - 1)) * uvScale[0], (i / (R - 1)) * uvScale[1]);
  }
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < Cn - 1; j++) {
    const a = i * Cn + j, b = (i + 1) * Cn + j, c = (i + 1) * Cn + j + 1, d = i * Cn + j + 1;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The cloth map, 256 x 256, tiled: a washed weave.  Neutral (mean ~0.9),
 * the garment's colour comes from the vertices: on the jacket it reads as
 * worn denim (the twill, the wash's mottle, a few faded whiskers), on the
 * tee as heather, on the cargos as twill. */
function clothMap() {
  const W = 256, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  let seed = 17;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.fillStyle = 'rgb(226,226,228)'; g.fillRect(0, 0, W, H);
  // the wash: soft mottle, lighter and darker patches (drawn 3 x 3 so the tile wraps)
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W, y = rnd() * H, r = 5 + rnd() * 26, v = rnd() < 0.5 ? 255 : 150;
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.05 + rnd() * 0.07})`;
    for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) { g.beginPath(); g.ellipse(x + dx, y + dy, r, r * (0.5 + rnd() * 0.7), rnd() * 3, 0, TAU); g.fill(); }
  }
  // faded whiskers: a few long soft vertical streaks
  for (let i = 0; i < 14; i++) {
    const x = rnd() * W, w = 2 + rnd() * 5;
    const grd = g.createLinearGradient(x - w, 0, x + w, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.5, `rgba(255,255,255,${0.08 + rnd() * 0.1})`); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(x - w, 0, 2 * w, H);
  }
  // the twill: fine diagonal lines, both tones
  g.lineWidth = 1;
  for (let k = -H; k < W; k += 3) {
    g.strokeStyle = (k / 3) % 2 ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.07)';
    g.beginPath(); g.moveTo(k, 0); g.lineTo(k + H, H); g.stroke();
  }
  // grain
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
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
const EYE_R = 0.0117;
/** The half-smile: how far the mouth rises at face x (0 at the middle, ~3.5 mm at the corners). */
const smileLift = (fx) => 0.0036 * sm(Math.abs(fx), 0.005, 0.027) + 0.0006 * sm(fx, 0.01, 0.027);
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
  h -= 0.0035 * G2(ax - F.eyeX, 0.016, fy - F.eye + 0.009, 0.006) * fr;
  // the nose: a bridge widening down to the tip, the wings, the underside cut back to the lip
  const nb = sm(fy, F.noseBase - 0.005, F.noseBase + 0.005);
  const along = 1 - sm(fy, F.noseTip, F.brow - 0.004);
  h += (0.0045 + 0.0095 * along ** 1.4) * G(fx, 0.0075 + 0.005 * along) * nb * fr;
  h += 0.0045 * G2(fx, 0.012, fy - F.noseTip - 0.001, 0.01) * fr;
  h += 0.0075 * G2(ax - 0.0135, 0.0065, fy - (F.noseBase + 0.006), 0.007) * fr;
  // the cheekbones, and the hollow under them
  h += 0.0055 * G2(ax - 0.06, 0.016, fy - 0.004, 0.014) * sm(z, -0.02, 0.03);
  h -= 0.0035 * G2(ax - 0.05, 0.016, fy + 0.038, 0.015) * sm(z, -0.01, 0.03);
  // the mouth: the philtrum, the upper lip with its bow, the line, the fuller lower lip, the fold below, the chin;
  // the corners lifted (the half-smile), the cheeks mounded beside it, the smile's fold from the nose's wing
  const lift = smileLift(fx);
  const my = fy - lift;
  const mw = sm(0.028 - ax, 0, 0.012);
  h -= 0.0012 * G(fx, 0.0045) * sm(fy, F.mouth + 0.006, F.lipTop) * (1 - sm(fy, F.noseBase - 0.006, F.noseBase)) * fr;
  const bow = F.lipTop - 0.0025 * G(fx, 0.005) + 0.001 * G(ax - 0.008, 0.004);
  h += 0.0045 * G(my - (bow + F.mouth) / 2, (bow - F.mouth) / 2.2) * mw * fr;
  h -= 0.0025 * G(my - F.mouth, 0.0022) * sm(0.029 - ax, 0, 0.008) * fr;
  h += 0.0055 * G(my - (F.mouth + F.lipBot) / 2, (F.mouth - F.lipBot) / 2.1) * sm(0.023 - ax, 0, 0.012) * fr;
  h -= 0.003 * G(my - (F.lipBot - 0.011), 0.006) * sm(0.02 - ax, 0, 0.012) * fr;
  h += 0.0075 * G2(fx, 0.022, fy - F.chin - 0.002, 0.014) * fr;
  h += 0.0032 * G2(ax - 0.046, 0.013, fy + 0.038, 0.014) * fr;                                  // the cheek's mound
  h -= 0.0016 * G(ax - (0.019 + 0.012 * sm(-fy, 0.04, 0.072)), 0.0035) * sm(-fy, 0.04, 0.05) * (1 - sm(-fy, 0.07, 0.078)) * fr;   // the fold
  h -= 0.0014 * G2(ax - 0.034, 0.008, my - F.mouth + 0.001, 0.004) * fr;                         // the dimple past the corner
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
  g.fillStyle = '#cda994'; g.fillRect(0, 0, W, H);
  const mottle = [0xdab69f, 0xc09a82, 0xd3a893, 0xc7a48f, 0xd6b098];
  for (let i = 0; i < 1400; i++) {
    const r = 3 + rnd() * 12;
    g.fillStyle = rgba(mottle[i % mottle.length], 0.05 + rnd() * 0.04);
    g.beginPath(); g.ellipse(rnd() * W, rnd() * H * UV_V, r, r * (0.6 + rnd() * 0.6), rnd() * 3, 0, TAU); g.fill();
  }
  // zones: the forehead lighter, the cheeks and the nose warm, under the eyes a little bruised, the beard cool
  soft(0, 0.075, 0.07, 0.03, 0xe0bc9e, 0.28);
  for (const s of [-1, 1]) {
    soft(s * 0.05, -0.02, 0.03, 0.024, 0xd28e74, 0.11);
    soft(s * 0.031, -0.006, 0.017, 0.007, 0x9e6e66, 0.34);
    soft(s * 0.079, 0.0, 0.012, 0.03, 0xd28e74, 0.15);       // the ears' side
  }
  soft(0, F.noseTip, 0.016, 0.012, 0xd08a70, 0.22);
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
  soft(0, F.noseBase - 0.002, 0.016, 0.005, 0x5c3a30, 0.32);
  soft(0, F.lipBot - 0.005, 0.014, 0.004, 0x7a4a3c, 0.4);
  // the nostrils, on the underside
  for (const s of [-1, 1]) blob(s * 0.0105, F.noseBase + 0.001, 0.0045, 0.0028, 0x2e1a16, 0.9, s * 0.35);
  // behind the eyes: dark, so no gap between eyeball and lid shows skin
  for (const s of [-1, 1]) blob(s * F.eyeX, F.eye, 0.0152, 0.006, 0x2e1c18, 1, s * 0.08);

  // brows: straight and dark, thick at the inner end, tapering out; a soft mass, then the hairs
  for (const s of [-1, 1]) {
    const yAt = (ax) => F.brow - 0.0045 + 0.0035 * sm(ax, 0.01, 0.036) - 0.003 * sm(ax, 0.036, 0.05);
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
  // the lips: the upper darker with its bow, the lower fuller and warmer with a light band; the line curving
  // up into the corners (the half-smile, matching the form), the corners tucked into the cheeks
  {
    const XM = 0.029;
    const top = (fx) => smileLift(fx) + F.lipTop - 0.0025 * G(fx, 0.005) + 0.001 * G(Math.abs(fx) - 0.008, 0.004) - 0.0065 * sm(Math.abs(fx), 0.014, XM);
    const mid = (fx) => smileLift(fx) + F.mouth - 0.0008 * G(fx, 0.012);
    const bot = (fx) => smileLift(fx) + F.lipBot + 0.0008 + 0.0085 * sm(Math.abs(fx), 0.01, XM);
    const poly = (f0, f1, hex, a) => {
      g.fillStyle = rgba(hex, a); g.beginPath();
      for (let k = 0; k <= 24; k++) { const fx = -XM + (k / 24) * 2 * XM; const [px, py] = P(fx, f0(fx)); k ? g.lineTo(px, py) : g.moveTo(px, py); }
      for (let k = 24; k >= 0; k--) { const fx = -XM + (k / 24) * 2 * XM; const [px, py] = P(fx, f1(fx)); g.lineTo(px, py); }
      g.closePath(); g.fill();
    };
    poly(top, mid, 0x8e5a4e, 0.42);
    poly(mid, bot, 0xa8685a, 0.38);
    poly((fx) => mid(fx) - 0.003 - 0.002 * sm(Math.abs(fx), 0.008, 0.02), (fx) => mid(fx) - 0.0055, 0xc07a6a, 0.22);
    for (let i = 0; i < 9; i++) { const fx = -0.016 + i * 0.004 + (rnd() - 0.5) * 0.002; line([[fx, mid(fx) - 0.001], [fx + 0.0005, bot(fx) + 0.001]], 0x6a3a34, 0.14, 0.0006 * K); }
    const pts = []; for (let k = 0; k <= 12; k++) { const fx = -XM + (k / 12) * 2 * XM; pts.push([fx, mid(fx)]); }
    line(pts, 0x3a2020, 0.75, 0.0014 * K);
    for (const s of [-1, 1]) {
      line([[s * XM, mid(s * XM) + 0.0012], [s * (XM - 0.002), mid(s * (XM - 0.002))]], 0x2a1614, 0.75, 0.002 * K);   // the corner, tucked
      soft(s * 0.033, mid(s * XM) - 0.002, 0.006, 0.005, 0x8a5646, 0.3);                                            // the dimple past it
      // the smile's fold, from the nose's wing round the cheek's mound to below the corner
      line([[s * 0.017, -0.041], [s * 0.026, -0.054], [s * 0.032, -0.066], [s * 0.034, -0.077]], 0x8e5c4a, 0.12, 0.0028 * K);
      // the crease under the eye when the cheek lifts
      soft(s * 0.031, -0.012, 0.012, 0.0035, 0x9a6a58, 0.14);                                                       // the cheek lifted under the eye
      line([[s * 0.048, 0.006], [s * 0.053, 0.001]], 0x9a6a58, 0.12, 0.001 * K);                                    // the crow's foot
    }
  }
  // the moustache: light, fine, sparse at the philtrum, sweeping down and out
  for (const s of [-1, 1]) {
    soft(s * 0.012, -0.0535, 0.011, 0.0035, 0x2a1a16, 0.14);
    for (let i = 0; i < 110; i++) {
      const ax = 0.003 + rnd() * rnd() * 0.022, fy = -0.0495 - rnd() * 0.0065;
      if (ax < 0.006 && rnd() < 0.6) continue;
      const ang = -Math.PI / 2 + s * (0.35 + 0.4 * (ax / 0.024));
      hairStroke(s * ax, fy, 0.0016 + rnd() * 0.0012, ang, 0x241614, 0.25 + rnd() * 0.25, (0.4 + rnd() * 0.4) * K * 0.0005);
    }
  }
  // the goatee: a soul patch under the lip, the beard over the chin and under it, thinning along the jaw
  soft(0, -0.089, 0.0085, 0.006, 0x2a1a16, 0.26);
  soft(0, -0.106, 0.02, 0.012, 0x2a1a16, 0.24);
  for (let i = 0; i < 320; i++) {
    const inPatch = rnd() < 0.3;
    const fx = inPatch ? (rnd() - 0.5) * 0.016 : (rnd() - 0.5) * 0.044;
    const fy = inPatch ? -0.083 - rnd() * 0.011 : -0.095 - rnd() * 0.023;
    if (!inPatch && Math.abs(fx) > 0.02 && rnd() < 0.5) continue;
    hairStroke(fx, fy, 0.0016 + rnd() * 0.0016, -Math.PI / 2 + (rnd() - 0.5) * 0.7 + fx * 12, 0x1e1210, 0.18 + rnd() * 0.3, (0.4 + rnd() * 0.5) * K * 0.0005);
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
const AZ_HALF = 1.32;   // the corners' azimuth on the eyeball
const lidUp = (s) => 0.2 * (1 - s * s) ** 0.5 + 0.04 * (1 - s * s) * (0.4 - s) + 0.1 * s;   // the outer corner up
const lidLo = (s) => -0.07 * (1 - s * s) ** 0.6 + 0.08 * s;   // the lower lid pushed up by the smiling cheek, rising to the outer corner

/** Eyeballs, lids and the catch lights, in the head's frame.  Returns { parts: [{geo, color|colored}], lights: [geo] }. */
function eyeParts() {
  const parts = [], lights = [];
  for (const s of [-1, 1]) {
    const [bx, by, bz] = baseAt(s * F.eyeX, F.eye);
    const C0 = new THREE.Vector3(bx, by, bz - 0.0098);      // the eyeball's centre, back in its socket
    const tiltY = s * 0.12;                                 // the eyes' axes toe out with the face's curve
    const place = (g) => { g.rotateY(tiltY); g.translate(C0.x, C0.y, C0.z); return g; };
    // the eyeball: a cap facing +z, the iris and pupil in vertex colour, the cornea a slight dome
    const eye = new THREE.SphereGeometry(EYE_R, 22, 14, 0, TAU, 0, Math.PI * 0.62);
    eye.rotateX(Math.PI / 2);
    {
      const p = eye.getAttribute('position'), col = new Float32Array(p.count * 3);
      const v = new THREE.Vector3(), cc = new THREE.Color(), sc = new THREE.Color(0xd8ccc0), top = new THREE.Color(0x968078), pink = new THREE.Color(0xc98a7c);
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
          cc.lerp(top, 0.5 * sm(-el, 0.1, 0.5));                           // and toward the lower
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
      const skin = new THREE.Color(C.skin), lash = new THREE.Color(upper ? 0x2a1814 : 0x5a3a30), deep = new THREE.Color(upper ? C.skinShade : 0x7a5240);
      const cc = new THREE.Color();
      for (let j = 0; j <= NV; j++) {
        const v = j / NV;
        for (let i = 0; i <= NS; i++) {
          const sgn = (i / NS) * 2 - 1;                     // -1 inner .. 1 outer
          const az = -s * sgn * AZ_HALF;                    // inner corner toward the nose
          const e0 = upper ? lidUp(sgn) : lidLo(sgn);
          const span = (upper ? 0.62 : -0.62) * (0.55 + 0.45 * (1 - sgn * sgn));   // both reach the socket floor
          const el = e0 + span * v;
          const r = EYE_R + 0.0012 + (upper ? 0.0026 : 0.0011) * Math.sin(Math.PI * v) ** 0.9 * (0.5 + 0.5 * (1 - sgn * sgn));
          pos.push(r * Math.sin(az) * Math.cos(el), r * Math.sin(el), r * Math.cos(az) * Math.cos(el));
          cc.copy(skin).lerp(deep, upper ? 0.35 * sm(v, 0.5, 1) : 0.9 - 0.4 * sm(v, 0.4, 1));   // the lower lid in the eye's shadow
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
      // the lower lid sits in the eye's shadow: its normals bent down so the sun (2.2, which clips lit skin to paper) doesn't light it as a shelf
      if (!upper) { const v = new THREE.Vector3(); for (let i = 0; i < nn.count; i++) { v.set(nn.getX(i), nn.getY(i) - 0.9, nn.getZ(i)).normalize(); nn.setXYZ(i, v.x, v.y, v.z); } }
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
  const x = HEAD.rx * 0.94, y = -0.003, z = -0.02;   // tucked in and back: the side hair covers them
  const shell = new THREE.SphereGeometry(0.016, 12, 9);
  shell.scale(0.3, 1.75, 1.0); shell.rotateZ(-s * 0.06); shell.translate(s * (x + 0.002), y, z);
  {
    const p = shell.getAttribute('position'), col = new Float32Array(p.count * 3);
    const a = new THREE.Color(0x9e7f6a), b = new THREE.Color(0x7e5c48), cc = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const ox = (p.getX(i) - s * (x + 0.002)) * s;   // outward
      cc.copy(a).lerp(b, 0.75 * (1 - sm(ox, -0.001, 0.004)));   // the concha, in shadow
      col.set([cc.r, cc.g, cc.b], i * 3);
    }
    shell.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  parts.push({ geo: shell, colored: true });
  const rim = new THREE.TorusGeometry(0.0125, 0.0038, 6, 18, Math.PI * 1.25);
  rim.rotateZ(Math.PI * 0.62); rim.scale(1, 1.55, 1); rim.rotateY(s * Math.PI / 2); rim.translate(s * (x + 0.003), y + 0.006, z);
  parts.push({ geo: rim, color: 0xa8866e });
  const lobe = new THREE.SphereGeometry(0.0065, 10, 8);
  lobe.scale(0.7, 1, 1); lobe.translate(s * (x + 0.003), y - 0.025, z + 0.002);
  parts.push({ geo: lobe, color: 0x9e7f6a });
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
      const cup = (1 - a * a) * w * 0.5;   // chunky: rounder across
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

/** Hair, from the stills: thick, near-black, chin-to-collar, layered and
 * shaggy.  A scalp shell cut at the hairline under ~75 chunky ribbon locks:
 * the part on his right, a long fringe sweeping across the forehead to his
 * left and down past the brow to the cheekbone, the right side swept back
 * over the temple, the sides over the ears flicking out at the jaw, the back
 * to the collar, short thick clumps piled at the crown.  Head frame, centred
 * on the head; azimuth 0 = front, positive toward his left (+x). */
function hairParts() {
  const parts = [];
  const RX = HEAD.rx * 1.09, RY = HEAD.ry * 1.06, RZ = HEAD.rz * 1.08;
  const PART = -0.4;    // the part's azimuth: on his right
  const shell = new THREE.SphereGeometry(1, 30, 20);
  {
    const p = shell.getAttribute('position'), uv = shell.getAttribute('uv'), hang = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      let th = Math.acos(clamp(y, -1, 1));
      const d = Math.atan2(x, z), ad = Math.abs(d);
      let hl = 1.0 + 0.3 * sm(ad, 0.4, 1.0) + 0.8 * sm(ad, 1.0, 2.3);
      hl += 0.04 * Math.sin(d * 9.0) * sm(ad, 0.1, 0.6);
      if (th > hl) th = hl;
      const st = Math.sin(th), ct = Math.cos(th);
      const k = Math.hypot(x, z) || 1;
      const part = 1 - 0.02 * Math.exp(-(((d - PART) / 0.08) ** 2)) * sm(z, -0.6, 0.2) * sm(ct, 0.3, 0.9);
      const crown = 1 + 0.18 * sm(ct, 0.05, 0.9) * (1 - 0.4 * sm(z, 0.2, 0.7)) * (1 + 0.2 * sm(x, -0.2, 0.5));   // volume at the crown, more where the sweep piles
      p.setXYZ(i, (x / k) * st * RX * part * crown, ct * RY * part * crown + 0.003, (z / k) * st * RZ * part * crown);
      uv.setY(i, uv.getY(i) * 0.6);
    }
    shell.setAttribute('aHang', new THREE.BufferAttribute(hang, 1));
    shell.computeVertexNormals();
  }
  parts.push({ geo: shell, color: 0x221a1d });
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const onHead = (th, az, out) => [Math.sin(th) * Math.sin(az) * (RX + out), Math.cos(th) * (RY + out), Math.sin(th) * Math.cos(az) * (RZ + out)];
  /* A lock: over the skull from (th0, az0) to (th1, az1), lifted `out`
   * (more at the crown, settling toward the ear line), then hanging `len`
   * below with its end flicked outward by `flare` and drifting `drift`
   * (x, z) in the head's frame; w the half-width, tone the vertex colour. */
  const lock = ({ az0, az1, th0 = 0.24, th1 = 1.35, len = 0, w = 0.02, flare = 0.02, out = 0.004, drift = [0, -0.008], tone, crown = 0.018 }) => {
    const pts = [];
    for (let k = 0; k <= 5; k++) {
      const u = k / 5, th = th0 + u * (th1 - th0), az = az0 + (az1 - az0) * u;
      pts.push(onHead(th, az, out * (0.5 + 0.5 * u) + 0.003 + crown * (1 - u) ** 1.5));
    }
    let hangFrom = 1;
    if (len > 0) {
      const [ex, ey, ez] = pts[pts.length - 1];
      const hx = ex / Math.hypot(ex, ez), hz = ez / Math.hypot(ex, ez);
      const wob = (rnd() - 0.5) * 0.008;
      for (let k = 1; k <= 3; k++) {
        const u = k / 3;
        pts.push([ex + hx * flare * u * u + drift[0] * u + wob * Math.sin(u * 3), ey - len * u, ez + hz * flare * u * u + drift[1] * u]);
      }
      hangFrom = 5 / 8;
    }
    const hw = (u) => w * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.5) * (1 - 0.7 * sm(u, 0.7, 1));
    parts.push({ geo: ribbon(pts, hw, hangFrom), color: tone });
  };
  const T = { deep: 0x261e22, mid: 0x322629, top: 0x3e3034, warm: 0x4a3a3a, sheen: 0x584848 };
  const J = (a, b) => a + (b - a) * rnd();
  const pick = (...t) => t[(rnd() * t.length) | 0];

  /* the fringe: a fan of locks from the part, their ends stepping down a
   * diagonal: high over his right brow, across the forehead, down past his
   * left brow to the cheekbone; narrow enough to read as separate pieces */
  for (let i = 0; i < 10; i++) {
    const k = i / 9;
    const az1 = -0.45 + 1.8 * k + J(-0.06, 0.06);                  // his right temple .. his left temple
    const th1 = 0.98 + 0.36 * sm(k, 0.1, 0.85) + J(-0.03, 0.03);    // ending higher on his right, lower on his left
    const len = k < 0.45 ? 0 : (k - 0.45) * 0.16 + J(0, 0.02);
    lock({ az0: PART + J(-0.2, 0.12), az1, th0: J(0.24, 0.42), th1, len, w: J(0.015, 0.021), flare: 0.006 + 0.02 * k, out: 0.003 + (i % 3) * 0.006, drift: [0.006 + 0.006 * k, 0.004 - 0.01 * k], tone: pick(T.deep, T.mid, T.top, T.warm, T.sheen) });
  }
  lock({ az0: PART - 0.02, az1: 0.12, th0: 0.24, th1: 1.08, len: 0.02, w: 0.011, flare: 0.0, out: 0.024, drift: [0.004, 0.008], tone: T.top });   // a stray over the forehead
  lock({ az0: PART + 0.3, az1: 1.45, th0: 0.55, th1: 1.34, len: 0.1, w: 0.02, flare: 0.026, out: 0.012, drift: [0.004, -0.008], tone: T.mid });    // the sweep's tail, over the left temple

  /* his right of the part: swept sideways and back over the temple, the
   * forehead's corner open, the rest over the ear */
  lock({ az0: PART + 0.04, az1: -0.85, th0: 0.28, th1: 1.0, w: 0.024, flare: 0.006, out: 0.005, tone: T.top });
  lock({ az0: PART - 0.06, az1: -1.1, th0: 0.3, th1: 1.2, len: 0.03, w: 0.024, flare: 0.012, out: 0.011, drift: [-0.006, 0.0], tone: T.mid });
  lock({ az0: PART - 0.16, az1: -1.35, th0: 0.34, th1: 1.34, len: 0.1, w: 0.024, flare: 0.024, out: 0.005, drift: [0, -0.006], tone: T.deep });
  lock({ az0: PART - 0.3, az1: -1.6, th0: 0.4, th1: 1.36, len: 0.12, w: 0.023, flare: 0.03, out: 0.012, drift: [0, -0.01], tone: T.warm });
  lock({ az0: PART - 0.2, az1: -1.0, th0: 0.6, th1: 1.1, len: 0.02, w: 0.016, flare: 0.006, out: 0.022, drift: [-0.006, 0.004], tone: T.sheen });
  lock({ az0: PART - 0.1, az1: -0.75, th0: 0.5, th1: 1.24, len: 0.03, w: 0.017, flare: 0.008, out: 0.008, drift: [-0.004, 0.004], tone: T.mid });    // falling over the right temple
  lock({ az0: PART - 0.22, az1: -1.0, th0: 0.55, th1: 1.3, len: 0.05, w: 0.018, flare: 0.012, out: 0.014, drift: [-0.006, 0.0], tone: T.top });

  /* the sides, over the ears: an inner layer close and wide, an outer
   * layer lighter and lifted, the ends flicking out round the jaw */
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const a0 = s * (0.75 + i * 0.22 + J(0, 0.06));
      lock({ az0: a0, az1: a0 + s * J(0.6, 0.9), th0: J(0.22, 0.3), th1: 1.36, len: J(0.08, 0.15), w: J(0.02, 0.024), flare: J(0.022, 0.038), out: 0.005, drift: [0, J(-0.012, -0.004)], tone: pick(T.deep, T.mid, T.mid) });
    }
    for (let i = 0; i < 4; i++) {
      const a0 = s * (0.95 + i * 0.35 + J(0, 0.08));
      lock({ az0: a0, az1: a0 + s * J(0.7, 1.0), th0: J(0.3, 0.4), th1: 1.34, len: J(0.07, 0.13), w: J(0.016, 0.02), flare: J(0.028, 0.044), out: 0.015, drift: [0, J(-0.01, -0.002)], tone: pick(T.top, T.warm, T.sheen) });
    }
    // over the ear itself: an inner curtain hugging the skull below the ear line, two heavier locks hung forward over it
    lock({ az0: s * 1.45, az1: s * 1.85, th0: 0.6, th1: 1.5, len: 0.1, w: 0.03, flare: 0.006, out: 0.002, drift: [0, 0.004], tone: T.deep });
    lock({ az0: s * 1.7, az1: s * 2.05, th0: 0.6, th1: 1.5, len: 0.1, w: 0.03, flare: 0.006, out: 0.002, drift: [0, 0.002], tone: T.deep });
    lock({ az0: s * 1.4, az1: s * 1.7, th0: 0.5, th1: 1.4, len: 0.13, w: 0.024, flare: 0.012, out: 0.01, drift: [0, 0.008], tone: T.mid });
    lock({ az0: s * 1.65, az1: s * 1.95, th0: 0.55, th1: 1.4, len: 0.14, w: 0.024, flare: 0.016, out: 0.01, drift: [0, 0.004], tone: T.top });
    /* the back, to the collar, layered and flicked */
    for (let i = 0; i < 6; i++) {
      const a0 = s * (2.25 + i * 0.16 + J(0, 0.05));
      lock({ az0: a0, az1: s * Math.min(3.12, Math.abs(a0) + J(0.45, 0.8)), th0: J(0.2, 0.28), th1: 1.42, len: J(0.16, 0.2), w: 0.019, flare: J(0.008, 0.02), out: 0.0015, drift: [0, J(-0.006, 0.002)], tone: pick(T.deep, T.mid) });
    }
    for (let i = 0; i < 4; i++) {
      const a0 = s * (2.35 + i * 0.24 + J(0, 0.08));
      lock({ az0: a0, az1: s * Math.min(3.12, Math.abs(a0) + J(0.5, 0.9)), th0: J(0.3, 0.4), th1: 1.4, len: J(0.14, 0.18), w: 0.016, flare: J(0.014, 0.026), out: 0.007, drift: [0, J(-0.006, 0.0)], tone: pick(T.top, T.warm) });
    }
  }
  /* the crown: short thick clumps piled from the part, most of them
   * crossing to his left with the sweep, a few back over the whorl */
  for (let i = 0; i < 6; i++) {
    const a0 = PART + J(-0.1, 0.1);
    lock({ az0: a0, az1: a0 + J(0.5, 1.3), th0: J(0.18, 0.3), th1: J(0.75, 0.95), w: J(0.024, 0.03), out: J(0.01, 0.024), crown: 0.02, tone: pick(T.mid, T.top, T.sheen) });
  }
  for (let i = 0; i < 4; i++) {
    const a0 = PART + J(-0.15, 0.05);
    lock({ az0: a0, az1: a0 - J(0.4, 1.0), th0: J(0.18, 0.3), th1: J(0.7, 0.9), w: J(0.022, 0.028), out: J(0.008, 0.02), crown: 0.02, tone: pick(T.mid, T.top) });
  }
  for (let i = 0; i < 5; i++) {
    const a0 = J(-2.6, 2.6);
    lock({ az0: a0 * 0.3, az1: a0, th0: J(0.15, 0.25), th1: J(0.7, 0.95), w: J(0.018, 0.024), out: J(0.008, 0.018), crown: 0.014, tone: pick(T.deep, T.mid, T.top) });
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
    // the tee's ribbed neck
    const rib = new THREE.TorusGeometry(0.07, 0.006, 6, 24, Math.PI * 1.3);
    rib.rotateZ(Math.PI * 0.85); rib.rotateX(-1.35); rib.scale(1, 1, 0.8); rib.translate(0, 0.365, 0.045);
    mesh(chest, rib, 0x42608a);
    /* the overshirt: washed denim, worn open, loose and rumpled: a loft from
     * one front edge round the back to the other, its radius carved by soft
     * folds, a heavier crumple where the folded arms pull it and a sag at the
     * hem; the fronts hang a little apart over the tee */
    const OPEN = 0.34;   // half-angle of the opening at the front
    const JR = [
      { y: 0.4, rx: 0.13, rz: 0.098, z: -0.006 }, { y: 0.36, rx: 0.185, rz: 0.124 }, { y: 0.31, rx: 0.2, rz: 0.134 }, { y: 0.2, rx: 0.198, rz: 0.134 },
      { y: 0.08, rx: 0.19, rz: 0.13 }, { y: -0.05, rx: 0.186, rz: 0.13 }, { y: -0.16, rx: 0.19, rz: 0.134 }, { y: -0.25, rx: 0.196, rz: 0.14 },
    ];
    const jkRadius = (a, t) => 1 + 0.02 * (0.5 + 0.5 * sm(t, 0.3, 1)) * Math.sin(a * 6 + 0.8) * (0.7 + 0.3 * Math.sin(a * 2.5 + 2.0))
      + 0.014 * Math.exp(-(((t - 0.62) / 0.12) ** 2)) * Math.sin(a * 3 + 1.5)
      + 0.008 * Math.exp(-(((t - 0.45) / 0.1) ** 2)) * Math.sin(a * 9 + 0.3)
      + 0.006 * sm(t, 0.7, 1) * Math.sin(a * 12 + 2.2);
    const jkPoint = (a, i) => {
      const r = JR[i], t = i / (JR.length - 1), k = jkRadius(a, t);
      // the fronts hang apart and a touch forward below the chest
      const front = Math.exp(-(((Math.abs(((a + Math.PI) % TAU) - Math.PI)) / 0.5) ** 2));
      return [(r.x || 0) + Math.sin(a) * r.rx * k, r.y, (r.z || 0) + Math.cos(a) * r.rz * k + 0.006 * front * sm(t, 0.2, 0.8)];
    };
    {
      const seg = 32, rows = [];
      for (let i = 0; i < JR.length; i++) {
        const row = [];
        for (let j = 0; j <= seg; j++) row.push(jkPoint(OPEN + (TAU - 2 * OPEN) * (j / seg), i));
        rows.push(row);
      }
      mesh(chest, strip(rows, [5, 2.2]), C.jacket);
    }
    // the plackets: a doubled band down each front edge, the snaps on his left one
    for (const s of [-1, 1]) {
      const rows = [];
      for (let i = 0; i < JR.length; i++) {
        const a0 = s > 0 ? OPEN : TAU - OPEN;
        const p0 = jkPoint(a0 - s * 0.0, i), p1 = jkPoint(a0 + s * 0.11, i), p2 = jkPoint(a0 + s * 0.2, i);
        const lift = (p) => [p[0] * 1.03, p[1], p[2] + 0.004];
        rows.push([[p0[0] * 1.01, p0[1], p0[2] + 0.001], lift(p1), [p2[0] * 1.01, p2[1], p2[2] + 0.001]]);
      }
      mesh(chest, strip(rows, [0.3, 2.2]), C.jacket);
      if (s > 0) for (const y of [0.3, 0.19, 0.08, -0.03, -0.14, -0.23]) {
        const i = JR.findIndex((r) => r.y <= y), j = Math.max(1, i);
        const f = (JR[j - 1].y - y) / (JR[j - 1].y - JR[j].y || 1);
        const pa = jkPoint(OPEN + 0.1, j - 1), pb = jkPoint(OPEN + 0.1, j);
        const snap = new THREE.CylinderGeometry(0.006, 0.006, 0.003, 10);
        snap.rotateX(Math.PI / 2); snap.rotateY(OPEN + 0.1);
        snap.translate(pa[0] + (pb[0] - pa[0]) * f + 0.002, y, pa[2] + (pb[2] - pa[2]) * f + 0.006);
        mesh(chest, snap, C.snap);
      }
    }
    // the chest pockets, with their flaps and a snap each, lying on the fronts
    for (const s of [-1, 1]) {
      const a = s > 0 ? 0.78 : TAU - 0.78;
      const p = jkPoint(a, 3), q = jkPoint(a, 2);
      const nx = Math.sin(a) * 0.134, nz = Math.cos(a) * 0.198;   // the surface normal's direction, roughly
      const nl = Math.hypot(nx, nz);
      const put = (g, dy, lift, hex) => { g.rotateY(a); g.rotateX(-0.06); g.translate(p[0] + (nx / nl) * lift, (p[1] + q[1]) / 2 + dy, p[2] + (nz / nl) * lift); mesh(chest, g, hex); };
      const bag = new THREE.BoxGeometry(0.1, 0.11, 0.012, 2, 2, 1);
      { const v = bag.getAttribute('position'); for (let i = 0; i < v.count; i++) if (v.getY(i) < -0.05) v.setX(i, v.getX(i) * 0.92); }   // the bottom corners eased
      put(bag, -0.01, 0.007, C.jacket);
      const flap = new THREE.BoxGeometry(0.108, 0.034, 0.014, 2, 1, 1);
      put(flap, 0.058, 0.009, 0x2e3545);
      const snap = new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 10);
      snap.rotateX(Math.PI / 2);
      put(snap, 0.052, 0.0165, C.snap);
    }
    /* the collar: a shirt's point collar, a short stand round the neck and
     * the leaf rolled over it, widening to the points that lie on the chest */
    {
      const CO = 0.55;   // the collar opens wider than the fronts
      const stand = tube([{ y: 0.455, rx: 0.084, rz: 0.075, z: -0.012 }, { y: 0.395, rx: 0.098, rz: 0.086, z: -0.01 }], 22, {
        fold: (a) => (Math.abs(((a + Math.PI) % TAU) - Math.PI) < CO ? 0.001 : 1), uvScale: [1, 0.2],
      });
      mesh(chest, stand, C.jacketDark);
      const N = 26, rows = [[], [], [], []];
      for (let j = 0; j <= N; j++) {
        const a = CO + (TAU - 2 * CO) * (j / N);
        const back = 0.5 + 0.5 * Math.cos(a);           // 1 at the front points, 0 at the nape
        const tip = Math.exp(-(((Math.abs(((a + Math.PI) % TAU) - Math.PI) - CO) / 0.32) ** 2));   // the points
        const w = 0.028 + 0.024 * tip, drop = 0.024 + 0.05 * tip + 0.006 * back;
        const sx = Math.sin(a), cz = Math.cos(a);
        const rIn = [0.086, 0.078], y0 = 0.452;
        rows[0].push([sx * rIn[0], y0, cz * rIn[1] - 0.012]);
        rows[1].push([sx * (rIn[0] + w * 0.35), y0 + 0.004, cz * (rIn[1] + w * 0.35) - 0.011]);
        rows[2].push([sx * (rIn[0] + w * 0.75), y0 - drop * 0.55, cz * (rIn[1] + w * 0.8) - 0.006]);
        rows[3].push([sx * (rIn[0] + w * 1.0), y0 - drop, cz * (rIn[1] + w * 1.15) - 0.002]);
      }
      mesh(chest, strip(rows, [2, 0.3]), C.jacket);
    }
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
    mesh(head, nk, 0xbf9d86, 'face');
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
    // a soft dropped shoulder (no padding): the sleeve's head sits low and loose
    const cap = new THREE.SphereGeometry(0.066, 14, 10);
    cap.scale(1.0, 0.85, 0.95); cap.translate(s * 0.004, -0.018, 0);
    mesh(sh, cap, C.jacket);
    const upper = tube([{ y: -0.02, rx: 0.068, rz: 0.066 }, { y: -0.13, rx: 0.064, rz: 0.063 }, { y: -0.26, rx: 0.06, rz: 0.059 }, { y: -0.34, rx: 0.058, rz: 0.057 }], 16,
      { capBottom: true, fold: ridges(5, 0.024, (t) => sm(t, 0.35, 1), 0.7), uvScale: [2.2, 1.2] });
    mesh(sh, upper, C.jacket);
    const el = node(side + 'El', sh, 0, -0.33, 0);
    el.rotation.order = 'YXZ';
    // the sleeve pushed a little up the forearm: it rumples into rings above the cuff
    const fore = tube([{ y: 0.02, rx: 0.058, rz: 0.058 }, { y: -0.07, rx: 0.054, rz: 0.054 }, { y: -0.15, rx: 0.05, rz: 0.05 }, { y: -0.185, rx: 0.054, rz: 0.053 },
      { y: -0.21, rx: 0.047, rz: 0.047 }, { y: -0.232, rx: 0.052, rz: 0.051 }, { y: -0.25, rx: 0.044, rz: 0.043 }], 14,
      { capTop: true, capBottom: true, fold: ridges(5, 0.02, (t) => 0.5 + 0.9 * sm(t, 0.5, 1), 2.1), uvScale: [2, 0.9] });
    mesh(el, fore, C.jacket);
    const cuff = new THREE.CylinderGeometry(0.038, 0.041, 0.026, 14);
    cuff.translate(0, -0.262, 0);
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
  const skinRamp = ramp([124, 138, 152, 166, 180, 194, 206, 218, 228, 236]);
  const skinMat = cel({ color: 0xffffff, bands: 'soft3', tint: 0xb07a8a, flat: false, vertexColors: true });
  skinMat.gradientMap = skinRamp;
  const faceMat = cel({ color: 0xffffff, map: faceMap(), bands: 'soft3', tint: 0xa8788a, flat: false, vertexColors: true });
  faceMat.gradientMap = skinRamp;
  const clothMat = cel({ color: 0xffffff, map: clothMap(), bands: 4, tint: 0x5a5480, flat: false, vertexColors: true, side: THREE.DoubleSide });
  const hairMat = cel({ color: 0xffffff, map: hairMap(), bands: 3, tint: 0x4a4068, flat: false, vertexColors: true, side: THREE.DoubleSide, alphaTest: 0.5 });
  hairMat.gradientMap = ramp([44, 82, 126, 250]);
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
    const withUV = b.kind === 'face' || b.kind === 'hair' || b.kind === 'cloth';
    const geos = b.list.map(({ geo, color, mapped, colored }) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      const n = g.getAttribute('position').count;
      if (!colored) {
        const c = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      }
      // the cloth keeps each part's own uv (the weave tiles); the face's unmapped parts point at the swatch
      if (withUV && !mapped && (b.kind !== 'cloth' || !g.getAttribute('uv'))) {
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
    const f = dt * 60;   // the kicks are impulses per 60 Hz frame
    const kx = (-0.003 * clamp(wy, -8, 8) - 0.0008 * ax) * f, kz = (0.003 * clamp(wx, -8, 8) - 0.0008 * az) * f;
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
