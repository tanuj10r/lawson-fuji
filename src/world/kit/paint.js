import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Painting in code (M2e): the brushes that give the town its weather.
 *
 * Everything here is painted the way a background artist would: flat
 * tones in a few value steps, soft but *shaped* edges, strokes that follow
 * how water and dirt actually move (down from sills and eaves, up from the
 * ground), never photographic noise.  All seeded, so a surface looks the
 * same on every load.
 *
 *   rng(seed)          the seeded PRNG
 *   streak / band / blot / crack / moss      brushes on a 2D context
 *   wearAtlas()        the shared wear atlas (core/toon.js setWearTexture):
 *                      8 x 8 painted "whole wall" cells, multiplied over
 *                      a surface's colour, in four kinds (WEAR)
 * ------------------------------------------------------------------ */

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* The colours dirt paints in, as multipliers over a wall: a cool lilac grey
 * (the palette's shadow family, so grime never goes brown and muddy), and a
 * dusty sage for moss and damp. */
export const GRIME = [150, 142, 168];
export const DAMP = [132, 138, 150];
export const MOSS = [150, 170, 132];
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;

/** Rain streak: a soft curtain from (x, y) down, `len` long, `w` wide at
 * the top, narrowing a little and fading out.  Built from a few overlapping
 * layers so the edge is soft but the shape stays readable. */
export function streak(c, x, y, w, len, a, col = GRIME) {
  for (const [k, al] of [[1, 0.45], [0.7, 0.35], [0.4, 0.3]]) {
    const ww = w * k, ll = len * (0.7 + k * 0.3);
    const g = c.createLinearGradient(0, y, 0, y + ll);
    g.addColorStop(0, rgba(col, a * al));
    g.addColorStop(0.5, rgba(col, a * al * 0.7));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - ww / 2, y);
    c.lineTo(x + ww / 2, y);
    c.lineTo(x + ww * 0.32, y + ll);
    c.lineTo(x - ww * 0.32, y + ll);
    c.fill();
  }
}

/** Splash-back band along the foot of a wall: a wavy top edge, darkest at
 * the ground, `h` tall at its highest. */
export function band(c, r, W, H, h, a, col = GRIME) {
  const g = c.createLinearGradient(0, H, 0, H - h);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(0.45, rgba(col, a * 0.6));
  g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(0, H);
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * W;
    c.lineTo(x, H - h * (0.65 + r() * 0.35));
  }
  c.lineTo(W, H);
  c.fill();
}

/** A soft stain: an irregular blob with a feathered rim. */
export function blot(c, r, x, y, rx, ry, a, col = GRIME) {
  const g = c.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(0.6, rgba(col, a * 0.5));
  g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g;
  c.beginPath();
  const n = 11;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2, k = 0.75 + r() * 0.3;
    c.lineTo(x + Math.cos(t) * rx * k, y + Math.sin(t) * ry * k);
  }
  c.fill();
}

/** A hairline crack: a wandering line with a branch or two. */
export function crack(c, r, x, y, len, a, dir = Math.PI / 2) {
  c.strokeStyle = `rgba(96,88,118,${a})`;
  c.lineCap = 'round';
  const go = (x, y, ang, len, w) => {
    c.lineWidth = w;
    c.beginPath(); c.moveTo(x, y);
    for (let s = 0; s < len; s += 5) {
      ang += (r() - 0.5) * 0.7;
      x += Math.cos(ang) * 5; y += Math.sin(ang) * 5;
      c.lineTo(x, y);
      if (r() < 0.06 && w > 0.9) { c.stroke(); go(x, y, ang + (r() < 0.5 ? 0.8 : -0.8), len * 0.4, w * 0.7); c.lineWidth = w; c.beginPath(); c.moveTo(x, y); }
    }
    c.stroke();
  };
  go(x, y, dir, len, 1.3);
}

/** Moss and damp creeping up from a corner at the foot of a wall. */
export function moss(c, r, x, H, w, h, a) {
  for (let i = 0; i < 5; i++) {
    blot(c, r, x + (r() - 0.5) * w, H - r() * h * 0.6, w * (0.25 + r() * 0.3), h * (0.3 + r() * 0.3), a * (0.6 + r() * 0.4), MOSS);
  }
}

/* ---------------------------------------------------------------- wear */

/** The kinds of wear, one pair of rows each in the atlas. */
export const WEAR = { newer: 0, mortar: 2, old: 4, block: 6 };
export const WEAR_CELLS = 8;          // 8 x 8 cells
const CELL = 256;

/** Paint one whole-wall cell (0..W x 0..H is a wall face, ground at the
 * bottom).  `kind` from WEAR, `i` the variant. */
function paintWall(c, W, H, kind, seed) {
  const r = rng(seed);
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, W, H);
  const heavy = kind === WEAR.old ? 1 : kind === WEAR.mortar ? 0.8 : kind === WEAR.block ? 0.75 : 0.5;
  // faint tonal blotches: no wall ages evenly
  for (let i = 0; i < 5; i++) blot(c, r, r() * W, r() * H, W * (0.12 + r() * 0.2), H * (0.1 + r() * 0.2), 0.1 * heavy);
  // dirt splashed up from the ground: a soft band, taller on older walls
  band(c, r, W, H, H * (0.12 + r() * 0.08) * (0.6 + heavy * 0.7), 0.4 + heavy * 0.3);
  // under the eaves, the damp line weather has not washed
  if (kind !== WEAR.block) {
    const g = c.createLinearGradient(0, 0, 0, H * 0.1);
    g.addColorStop(0, rgba(DAMP, 0.35 * heavy)); g.addColorStop(1, rgba(DAMP, 0));
    c.fillStyle = g; c.fillRect(0, 0, W, H * 0.1);
  }
  // rain curtains: from the eaves, in broad soft runs
  const eaves = Math.round(2 + heavy * 4 + r() * 2);
  for (let i = 0; i < eaves; i++) {
    streak(c, r() * W, 0, W * (0.06 + r() * 0.12), H * (0.25 + r() * 0.45) * (0.6 + heavy * 0.5), (0.3 + r() * 0.25) * (0.5 + heavy * 0.6));
  }
  // (streaks under sills belong to real windows: Phase 5 paints them there)
  // a stain or two
  const stains = Math.round(heavy * 2.5 * r());
  for (let i = 0; i < stains; i++) blot(c, r, r() * W, H * (0.3 + r() * 0.6), W * (0.04 + r() * 0.08), H * (0.03 + r() * 0.08), 0.25 * heavy);
  // mortar and old render crack; block walls do not (their joints move instead)
  if (kind === WEAR.mortar || kind === WEAR.old) {
    const n = 1 + Math.round(r() * (kind === WEAR.old ? 3 : 2));
    for (let i = 0; i < n; i++) crack(c, r, r() * W, r() < 0.5 ? H * (0.3 + r() * 0.4) : H * 0.02, H * (0.12 + r() * 0.25), 0.5);
  }
  // moss and damp at the feet of old walls and block walls
  if (kind === WEAR.old || kind === WEAR.block) {
    moss(c, r, r() * W * 0.3, H, W * 0.25, H * 0.16, 0.55);
    if (r() < 0.6) moss(c, r, W - r() * W * 0.3, H, W * 0.2, H * 0.12, 0.5);
  }
  // block walls: dark water marks down from the coping
  if (kind === WEAR.block) {
    for (let i = 0; i < 5; i++) streak(c, r() * W, 0, W * (0.06 + r() * 0.1), H * (0.3 + r() * 0.5), 0.35 + r() * 0.2, DAMP);
  }
}

let atlas = null;
/** The shared wear atlas: 8 x 8 cells of 256, rows in pairs by WEAR kind. */
export function wearAtlas() {
  if (atlas) return atlas;
  const cv = document.createElement('canvas');
  cv.width = cv.height = CELL * WEAR_CELLS;
  const c = cv.getContext('2d');
  for (let j = 0; j < WEAR_CELLS; j++) {
    for (let i = 0; i < WEAR_CELLS; i++) {
      c.save();
      c.translate(i * CELL, j * CELL);
      c.beginPath(); c.rect(0, 0, CELL, CELL); c.clip();
      paintWall(c, CELL, CELL, j - (j % 2), 9001 + j * 31 + i * 7);
      c.restore();
    }
  }
  atlas = new THREE.CanvasTexture(cv);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 8;
  return atlas;
}

/** The atlas rectangle (in UV, v up) of variant `i` of `kind`. */
export function wearCell(kind, i) {
  const col = i % WEAR_CELLS, row = kind + (Math.floor(i / WEAR_CELLS) % 2);
  // a half-texel inset keeps the filter from bleeding in the next cell
  const inset = 1.5 / (CELL * WEAR_CELLS), s = 1 / WEAR_CELLS;
  return { u0: col * s + inset, v0: 1 - (row + 1) * s + inset, du: s - 2 * inset, dv: s - 2 * inset };
}

let chips = null;
/** Worn road paint: white with small chips and faint tyre-worn bands in the
 * asphalt's grey, multiplied over a painted line's white.  Filtered, never
 * cut out, so lines stay clean at a grazing angle.  Tiles every 1.6 m,
 * world-mapped. */
export const CHIP_TILE = 1.6;
export function chipTex() {
  if (chips) return chips;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  const r = rng(515);
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, 256, 256);
  // tyre-worn bands: the paint thinned where wheels cross it
  for (let i = 0; i < 3; i++) {
    const x = r() * 256, w = 10 + r() * 22;
    const g = c.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, 'rgba(150,152,170,0)'); g.addColorStop(0.5, 'rgba(150,152,170,0.45)'); g.addColorStop(1, 'rgba(150,152,170,0)');
    c.fillStyle = g; c.fillRect(x - w, 0, w * 2, 256);
  }
  // chips: small flakes gone to the asphalt
  for (let i = 0; i < 70; i++) {
    const x = r() * 256, y = r() * 256, s = 1.5 + r() * 4;
    c.fillStyle = 'rgba(96,100,122,0.9)';
    c.beginPath();
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; c.lineTo(x + Math.cos(a) * s * (0.6 + r() * 0.6), y + Math.sin(a) * s * (0.6 + r() * 0.6)); }
    c.fill();
  }
  chips = new THREE.CanvasTexture(cv);
  chips.colorSpace = THREE.SRGBColorSpace;
  chips.wrapS = chips.wrapT = THREE.RepeatWrapping;
  chips.anisotropy = 16;
  return chips;
}

/* ------------------------------------------------------------ blossom
 * Painted sakura (M2e Phase 3).  The reference canopies are faceted
 * clumps too; what makes them read as blossom is the paint on them:
 * hundreds of small five-petalled florets, a few shades of pink, pale
 * centres and the odd white one catching the light. */

/** One floret: five round petals about a centre, with a pale middle. */
function floret(c, x, y, s, rot, col, mid) {
  c.fillStyle = col;
  for (let k = 0; k < 5; k++) {
    const a = rot + (k / 5) * Math.PI * 2;
    c.beginPath();
    c.ellipse(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.5, s * 0.36, a, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = mid;
  c.beginPath(); c.arc(x, y, s * 0.22, 0, Math.PI * 2); c.fill();
}

let floretT = null;
/** The clumps' skin: florets over a pale ground, tiling.  Drawn in pinks
 * near white, so the material's tone (light / mid / deep by height) sets
 * the overall shade and this adds the flowers. */
export function floretTex() {
  if (floretT) return floretT;
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const r = rng(7707);
  c.fillStyle = '#f7ecf0'; c.fillRect(0, 0, S, S);
  // shade blotches: clusters within the clump, deeper between them
  for (let i = 0; i < 26; i++) {
    const x = r() * S, y = r() * S, rad = 30 + r() * 60;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      g.addColorStop(0, 'rgba(214,170,196,0.45)'); g.addColorStop(1, 'rgba(214,170,196,0)');
      c.fillStyle = g; c.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }
  const cols = ['#fff6f9', '#fbe3ec', '#f3d0de', '#ecbfd2', '#ffffff'];
  for (let i = 0; i < 900; i++) {
    const x = r() * S, y = r() * S, s = 5 + r() * 7, rot = r() * 6.3;
    const col = cols[Math.floor(r() * cols.length)];
    const mid = r() < 0.7 ? '#e7a3bd' : '#fff4c8';
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      if (x + ox < -20 || x + ox > S + 20 || y + oy < -20 || y + oy > S + 20) continue;
      floret(c, x + ox, y + oy, s, rot, col, mid);
    }
  }
  // tiny deep specks: buds and the gaps between flowers
  for (let i = 0; i < 700; i++) {
    c.fillStyle = r() < 0.6 ? 'rgba(196,120,158,0.55)' : 'rgba(150,110,150,0.4)';
    c.fillRect(r() * S, r() * S, 1.5 + r() * 1.5, 1.5 + r() * 1.5);
  }
  floretT = new THREE.CanvasTexture(cv);
  floretT.colorSpace = THREE.SRGBColorSpace;
  floretT.wrapS = floretT.wrapT = THREE.RepeatWrapping;
  floretT.anisotropy = 8;
  return floretT;
}

let cardT = null;
/** A lacy cluster for the canopy's rim, alpha-cut: a ragged spray of
 * florets on a few thin twigs, sky showing between them. */
export function blossomCardTex() {
  if (cardT) return cardT;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const r = rng(8808);
  // twigs first, so florets sit on them
  c.strokeStyle = '#5e4a52'; c.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    let x = S / 2 + (r() - 0.5) * 30, y = S * 0.85, a = -Math.PI / 2 + (r() - 0.5) * 1.4;
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 8; k++) { a += (r() - 0.5) * 0.5; x += Math.cos(a) * 14; y += Math.sin(a) * 14; c.lineTo(x, y); c.lineWidth *= 0.9; }
    c.stroke();
  }
  // florets in overlapping sprays, thinning to the edge
  const cols = ['#fff6f9', '#fbe3ec', '#f3d0de', '#ecbfd2', '#ffffff'];
  for (let i = 0; i < 260; i++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.8) * S * 0.44;
    const x = S / 2 + Math.cos(a) * d, y = S * 0.5 + Math.sin(a) * d * 0.85;
    floret(c, x, y, 5 + r() * 6, r() * 6.3, cols[Math.floor(r() * cols.length)], r() < 0.7 ? '#e7a3bd' : '#fff4c8');
  }
  cardT = new THREE.CanvasTexture(cv);
  cardT.colorSpace = THREE.SRGBColorSpace;
  cardT.anisotropy = 8;
  return cardT;
}

/* -------------------------------------------------------------- leaves
 * Green in the same painted manner as the blossom (M2e Phase 4): a tiling
 * skin of small leaves with light catching their tops, and an alpha-cut
 * spray for a canopy's rim.  Drawn in near-white greens; the species' tones
 * set the colour. */

const LEAF = {
  broad: { ground: '#eef3e2', cols: ['#ffffff', '#f2f7e6', '#e2edcf', '#d3e3bd', '#c4d8ad'], dark: 'rgba(120,150,110,0.55)', n: 1100, size: [5, 9] },
  glossy: { ground: '#e8efdc', cols: ['#ffffff', '#f4f8ea', '#dbe8c8', '#c8dab4', '#b4cba0'], dark: 'rgba(96,126,100,0.6)', n: 1300, size: [5, 8] },
  maple: { ground: '#f2f1e2', cols: ['#ffffff', '#f7f3e4', '#ece6cf', '#e0d8bd'], dark: 'rgba(140,130,100,0.5)', n: 700, size: [7, 11], star: true },
};

/** One leaf: a pointed oval with a light edge (or a five-point maple star). */
function leaf(c, x, y, s, rot, col, star) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = col;
  c.beginPath();
  if (star) {
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? s * 0.38 : s;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
  } else {
    c.moveTo(0, -s);
    c.quadraticCurveTo(s * 0.55, 0, 0, s);
    c.quadraticCurveTo(-s * 0.55, 0, 0, -s);
  }
  c.fill();
  c.restore();
}

const leafCache = {};
/** A tiling skin of leaves: `kind` broad (zelkova), glossy (camphor), maple. */
export function leafTex(kind = 'broad') {
  if (leafCache[kind]) return leafCache[kind];
  const L = LEAF[kind];
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const r = rng(kind.length * 977 + 11);
  c.fillStyle = L.ground; c.fillRect(0, 0, S, S);
  // shade between the sprays
  for (let i = 0; i < 30; i++) {
    const x = r() * S, y = r() * S, rad = 26 + r() * 50;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      g.addColorStop(0, L.dark); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }
  for (let i = 0; i < L.n; i++) {
    const x = r() * S, y = r() * S, s = L.size[0] + r() * (L.size[1] - L.size[0]), rot = r() * 6.3;
    const col = L.cols[Math.floor(r() * L.cols.length)];
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      if (x + ox < -20 || x + ox > S + 20 || y + oy < -20 || y + oy > S + 20) continue;
      leaf(c, x + ox, y + oy, s, rot, col, L.star);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return (leafCache[kind] = t);
}

const cardCache = {};
/** An alpha-cut spray of leaves on a twig, for a green canopy's rim. */
export function leafCardTex(kind = 'broad') {
  if (cardCache[kind]) return cardCache[kind];
  const L = LEAF[kind];
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const r = rng(kind.length * 331 + 5);
  c.strokeStyle = '#4e4a44'; c.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    let x = S / 2 + (r() - 0.5) * 30, y = S * 0.88, a = -Math.PI / 2 + (r() - 0.5) * 1.2;
    c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 9; k++) { a += (r() - 0.5) * 0.5; x += Math.cos(a) * 13; y += Math.sin(a) * 13; c.lineTo(x, y); }
    c.stroke();
  }
  for (let i = 0; i < 170; i++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.8) * S * 0.44;
    const x = S / 2 + Math.cos(a) * d, y = S * 0.5 + Math.sin(a) * d * 0.85;
    leaf(c, x, y, (L.size[0] + r() * (L.size[1] - L.size[0])) * 1.1, r() * 6.3, L.cols[Math.floor(r() * L.cols.length)], L.star);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return (cardCache[kind] = t);
}

let needleT = null;
/** Pine needles for a clipped pine's pads: tufts of fine strokes. */
export function needleTex() {
  if (needleT) return needleT;
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const r = rng(4411);
  c.fillStyle = '#e4ecdc'; c.fillRect(0, 0, S, S);
  c.lineCap = 'round';
  for (let i = 0; i < 700; i++) {
    const x = r() * S, y = r() * S, n = 7, len = 10 + r() * 8;
    const col = ['#ffffff', '#eef4e6', '#d6e2cc', '#bfd0b6'][Math.floor(r() * 4)];
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      if (x + ox < -20 || x + ox > S + 20 || y + oy < -20 || y + oy > S + 20) continue;
      c.strokeStyle = col; c.lineWidth = 1.6;
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (k / (n - 1) - 0.5) * 2.2;
        c.beginPath(); c.moveTo(x + ox, y + oy); c.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); c.stroke();
      }
    }
  }
  needleT = new THREE.CanvasTexture(cv);
  needleT.colorSpace = THREE.SRGBColorSpace;
  needleT.wrapS = needleT.wrapT = THREE.RepeatWrapping;
  needleT.anisotropy = 8;
  return needleT;
}

let grassT = null;
/** A tuft of weeds and grass, alpha-cut: blades, a dandelion or two. */
export function grassTex() {
  if (grassT) return grassT;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const r = rng(2323);
  c.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const x = S * (0.2 + r() * 0.6), h = S * (0.25 + r() * 0.65), lean = (r() - 0.5) * S * 0.35;
    c.strokeStyle = ['#8fb870', '#a7c888', '#7aa464', '#b9d49c', '#6f9660'][Math.floor(r() * 5)];
    c.lineWidth = 2 + r() * 3;
    c.beginPath(); c.moveTo(x, S); c.quadraticCurveTo(x + lean * 0.3, S - h * 0.6, x + lean, S - h); c.stroke();
  }
  // a few broad leaves low down, and a dandelion
  for (let i = 0; i < 6; i++) leaf(c, S * (0.25 + r() * 0.5), S * (0.8 + r() * 0.15), 16 + r() * 10, (r() - 0.5) * 2.5, '#7fa66a', false);
  if (r() < 0.9) {
    c.fillStyle = '#f5cf3a';
    c.beginPath(); c.arc(S * 0.62, S * 0.42, 9, 0, Math.PI * 2); c.fill();
  }
  grassT = new THREE.CanvasTexture(cv);
  grassT.colorSpace = THREE.SRGBColorSpace;
  grassT.anisotropy = 8;
  return grassT;
}

let ivyT = null;
/** Ivy on a wall, alpha-cut: runners with leaves, thinning upward. */
export function ivyTex() {
  if (ivyT) return ivyT;
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const r = rng(6161);
  const cols = ['#6f9a5e', '#86ad6c', '#5c8752', '#9cbd7e'];
  for (let k = 0; k < 9; k++) {
    let x = S * (0.1 + r() * 0.8), y = S, a = -Math.PI / 2 + (r() - 0.5) * 0.6;
    const steps = 12 + Math.floor(r() * 20);
    for (let s = 0; s < steps; s++) {
      a += (r() - 0.5) * 0.6;
      x += Math.cos(a) * 12; y += Math.sin(a) * 12;
      c.strokeStyle = '#5a5a44'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - Math.cos(a) * 12, y - Math.sin(a) * 12); c.stroke();
      for (let l = 0; l < 3; l++) leaf(c, x + (r() - 0.5) * 16, y + (r() - 0.5) * 16, 7 + r() * 5, r() * 6.3, cols[Math.floor(r() * cols.length)], false);
    }
  }
  ivyT = new THREE.CanvasTexture(cv);
  ivyT.colorSpace = THREE.SRGBColorSpace;
  ivyT.anisotropy = 8;
  return ivyT;
}

/* ------------------------------------------------------------ windows
 * What is behind the glass (M2e Phase 5): Japanese houses show lace
 * curtains, drawn curtains, blinds, a frosted bathroom pane with bottles on
 * the sill, shoji, a plant, or just a dark room with the sky in it.  One
 * atlas of 4 x 2 painted interiors; a pane picks a cell (windowCell).  The
 * same atlas is the night glass's emissive map, so a lit window glows
 * through its curtains rather than as a flat panel. */

let winAtlas = null;
export function windowAtlas() {
  if (winAtlas) return winAtlas;
  const C = 256, cols = 4, rows = 2;
  const cv = document.createElement('canvas');
  cv.width = C * cols; cv.height = C * rows;
  const c = cv.getContext('2d');
  const r = rng(5151);
  const room = (x, y, top = '#3c4460', bot = '#565a78') => {
    const g = c.createLinearGradient(0, y, 0, y + C);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    c.fillStyle = g; c.fillRect(x, y, C, C);
  };
  const sky = (x, y, a = 0.35) => {
    // the sky caught in the glass: a pale diagonal sheen
    c.save(); c.beginPath(); c.rect(x, y, C, C); c.clip();
    c.fillStyle = `rgba(200,220,245,${a})`;
    c.beginPath(); c.moveTo(x + C * 0.1, y); c.lineTo(x + C * 0.45, y); c.lineTo(x + C * 0.05, y + C * 0.7); c.lineTo(x - C * 0.3, y + C * 0.7); c.fill();
    c.fillStyle = `rgba(220,235,250,${a * 0.6})`;
    c.beginPath(); c.moveTo(x + C * 0.55, y); c.lineTo(x + C * 0.62, y); c.lineTo(x + C * 0.3, y + C * 0.55); c.lineTo(x + C * 0.23, y + C * 0.55); c.fill();
    c.restore();
  };
  const cells = [
    // 0 lace curtain across the whole pane
    (x, y) => {
      room(x, y, '#8a8ea8', '#9a9cb4');
      c.fillStyle = 'rgba(245,245,250,0.55)'; c.fillRect(x, y, C, C);
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2;
      for (let i = 0; i < 14; i++) { c.beginPath(); c.moveTo(x + i * 19, y); c.quadraticCurveTo(x + i * 19 + 6, y + C / 2, x + i * 19, y + C); c.stroke(); }
      for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(x + r() * C, y + r() * C, 3 + r() * 4, 0, 7); c.fill(); }
      sky(x, y, 0.2);
    },
    // 1 curtains drawn to the sides, the room dark between
    (x, y) => {
      room(x, y);
      const col = ['#c8a07a', '#8aa0c0', '#c89aa8', '#a8b890'][Math.floor(r() * 4)];
      for (const [x0, w] of [[0, 0.3], [0.72, 0.28]]) {
        c.fillStyle = col; c.fillRect(x + x0 * C, y, w * C, C);
        c.fillStyle = 'rgba(0,0,0,0.15)';
        for (let i = 0; i < 5; i++) c.fillRect(x + x0 * C + i * w * C / 5, y, 5, C);
      }
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x + 0.3 * C, y, 0.42 * C, 10);
      sky(x, y);
    },
    // 2 a venetian blind, part lowered
    (x, y) => {
      room(x, y);
      const drop = C * (0.4 + r() * 0.5);
      for (let yy = 0; yy < drop; yy += 12) {
        c.fillStyle = '#d8dce4'; c.fillRect(x, y + yy, C, 8);
        c.fillStyle = '#a8aebc'; c.fillRect(x, y + yy + 8, C, 3);
      }
      sky(x, y, 0.25);
    },
    // 3 frosted bathroom glass, shapes of bottles on the sill
    (x, y) => {
      room(x, y, '#b4bccb', '#c2c8d4');
      for (let i = 0; i < 6; i++) {
        const bx = x + 20 + r() * (C - 50), bh = 30 + r() * 50;
        c.fillStyle = ['rgba(120,150,190,0.5)', 'rgba(200,120,140,0.45)', 'rgba(110,160,120,0.45)', 'rgba(230,230,235,0.6)'][Math.floor(r() * 4)];
        c.fillRect(bx, y + C - 14 - bh, 16 + r() * 10, bh);
      }
      c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 1;
      for (let i = 0; i < 30; i++) { c.beginPath(); c.moveTo(x, y + i * 9); c.lineTo(x + C, y + i * 9 + 4); c.stroke(); }
    },
    // 4 a dark room with the sky in it
    (x, y) => { room(x, y, '#2e3450', '#3e4462'); sky(x, y, 0.5); },
    // 5 a plant on the sill, a curtain half drawn
    (x, y) => {
      room(x, y);
      c.fillStyle = '#e8e2d4'; c.fillRect(x, y, C * 0.45, C);
      c.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 4; i++) c.fillRect(x + i * C * 0.11, y, 4, C);
      c.fillStyle = '#b86a50'; c.fillRect(x + C * 0.6, y + C - 50, 44, 40);
      c.fillStyle = '#6f9a5e';
      for (let i = 0; i < 8; i++) { c.beginPath(); c.ellipse(x + C * 0.6 + 22 + (r() - 0.5) * 60, y + C - 70 - r() * 50, 14, 8, r() * 3, 0, 7); c.fill(); }
      sky(x, y, 0.25);
    },
    // 6 shoji: a paper grid (glows warm at night)
    (x, y) => {
      c.fillStyle = '#ece6d6'; c.fillRect(x, y, C, C);
      c.strokeStyle = '#8a7a64'; c.lineWidth = 4;
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x + i * C / 4, y); c.lineTo(x + i * C / 4, y + C); c.stroke(); }
      for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(x, y + i * C / 6); c.lineTo(x + C, y + i * C / 6); c.stroke(); }
      sky(x, y, 0.15);
    },
    // 7 a roller blind pulled most of the way down
    (x, y) => {
      room(x, y);
      c.fillStyle = ['#e8e4dc', '#dfe6ee', '#efe2c8'][Math.floor(r() * 3)];
      c.fillRect(x, y, C, C * 0.75);
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x, y + C * 0.75 - 6, C, 6);
      sky(x, y, 0.2);
    },
  ];
  cells.forEach((f, i) => {
    const x = (i % cols) * C, y = Math.floor(i / cols) * C;
    c.save(); c.beginPath(); c.rect(x, y, C, C); c.clip(); f(x, y); c.restore();
  });
  winAtlas = new THREE.CanvasTexture(cv);
  winAtlas.colorSpace = THREE.SRGBColorSpace;
  winAtlas.anisotropy = 8;
  return winAtlas;
}

/** Map a pane's UVs (0..1 on every face) into window cell `i`. */
export function windowCell(geo, i) {
  const cols = 4, rows = 2, col = i % cols, row = Math.floor(i / cols) % rows;
  const inset = 0.01;
  const u0 = col / cols + inset, du = 1 / cols - 2 * inset;
  const v0 = 1 - (row + 1) / rows + inset, dv = 1 / rows - 2 * inset;
  const uv = geo.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * du, v0 + uv.getY(k) * dv);
  uv.needsUpdate = true;
  return geo;
}

let sillT = null;
/** The streak a sill leaves on the wall below it: a soft grey curtain of
 * dirt, darkest under the sill's ends where the water runs off. */
export function sillStreakTex() {
  if (sillT) return sillT;
  const W = 128, H = 128;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const r = rng(7373);
  for (const [x, w, a] of [[0.12, 0.2, 0.55], [0.88, 0.2, 0.55], [0.5, 0.7, 0.28]]) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(96,88,118,${a})`); g.addColorStop(1, 'rgba(96,88,118,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo((x - w / 2) * W, 0); c.lineTo((x + w / 2) * W, 0);
    c.lineTo((x + w * 0.3) * W, H * (0.7 + r() * 0.3)); c.lineTo((x - w * 0.3) * W, H * (0.7 + r() * 0.3));
    c.fill();
  }
  sillT = new THREE.CanvasTexture(cv);
  sillT.colorSpace = THREE.SRGBColorSpace;
  return sillT;
}

/* ------------------------------------------------------------ shops
 * M2e Phase 6: the paper on the glass, the wear on the shutters. */

const JPF = `'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Yu Gothic', Meiryo, sans-serif`;
const HAND = `'Hiragino Maru Gothic ProN', 'Yu Gothic', 'Hiragino Sans', sans-serif`;

function fitText(c, str, x, y, maxW, size, color, font, weight = 'bold') {
  let s = size;
  do { c.font = `${weight} ${s}px ${font}`; if (c.measureText(str).width <= maxW) break; s -= 1; } while (s > 8);
  c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(str, x, y);
}

const noticeCache = new Map();
/** A notice taped to the glass: paper, slightly crooked writing, tape at
 * the corners, a sun-faded top. `n` { t, s, paper, ink }. */
export function noticeTex(n, key) {
  if (noticeCache.has(key)) return noticeCache.get(key);
  const W = 256, H = 352;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = n.paper; c.fillRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, 0, H * 0.3);
  g.addColorStop(0, 'rgba(236,214,160,0.35)'); g.addColorStop(1, 'rgba(236,214,160,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.save(); c.translate(W / 2, H * 0.36); c.rotate(-0.03);
  fitText(c, n.t, 0, 0, W * 0.86, 56, n.ink, HAND);
  c.restore();
  c.strokeStyle = n.ink; c.lineWidth = 3;
  c.beginPath(); c.moveTo(W * 0.12, H * 0.5); c.lineTo(W * 0.88, H * 0.49); c.stroke();
  // the small print, in two lines if it is long
  const words = n.s.split(' ');
  const half = Math.ceil(words.length / 2);
  const lines = n.s.length > 11 ? [words.slice(0, half).join(' '), words.slice(half).join(' ')] : [n.s];
  lines.forEach((l, i) => fitText(c, l, W / 2, H * (0.62 + i * 0.12), W * 0.84, 30, '#333340', JPF, 'normal'));
  // tape
  c.fillStyle = 'rgba(240,236,200,0.75)';
  for (const [x, y, a] of [[18, 10, -0.6], [W - 18, 10, 0.6]]) { c.save(); c.translate(x, y); c.rotate(a); c.fillRect(-20, -8, 40, 16); c.restore(); }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  noticeCache.set(key, t);
  return t;
}

let rentT = null;
/** 貸店舗: the estate agent's board on a closed shop's shutter. */
export function forRentTex(n) {
  if (rentT) return rentT;
  const W = 320, H = 240;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#d8342f'; c.fillRect(0, 0, W, H * 0.46);
  fitText(c, n.t, W / 2, H * 0.24, W * 0.86, 84, '#ffffff', JPF);
  fitText(c, n.s, W / 2, H * 0.62, W * 0.86, 36, '#222222', JPF);
  fitText(c, 'TEL ' + n.tel, W / 2, H * 0.84, W * 0.86, 30, '#d8342f', JPF);
  rentT = new THREE.CanvasTexture(cv);
  rentT.colorSpace = THREE.SRGBColorSpace;
  return rentT;
}

let shutT = null;
/** A roller shutter that has been up and down for thirty years: slats,
 * grime rising from the ground, rust at the bottom rail and running from
 * the slat joints, a scuff where it is pushed up, an old sticker. */
export function wornShutterTex() {
  if (shutT) return shutT;
  const W = 256, H = 512, rows = 22;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const r = rng(3131);
  const step = H / rows;
  for (let i = 0; i < rows; i++) {
    c.fillStyle = i % 2 ? '#c9c4d2' : '#e6e2ea'; c.fillRect(0, i * step, W, step);
    c.fillStyle = '#9a94a6'; c.fillRect(0, i * step + step - 2.5, W, 2.5);
  }
  // grime from the ground up
  const g = c.createLinearGradient(0, H, 0, H * 0.55);
  g.addColorStop(0, 'rgba(96,86,100,0.55)'); g.addColorStop(1, 'rgba(96,86,100,0)');
  c.fillStyle = g; c.fillRect(0, H * 0.55, W, H * 0.45);
  // rust runs from the joints, heavier low down
  for (let i = 0; i < 26; i++) {
    const x = r() * W, y = H * (0.3 + r() * 0.65), len = 12 + r() * 40;
    const rg = c.createLinearGradient(0, y, 0, y + len);
    rg.addColorStop(0, 'rgba(176,98,64,0.6)'); rg.addColorStop(1, 'rgba(176,98,64,0)');
    c.fillStyle = rg; c.fillRect(x, y, 2 + r() * 3, len);
  }
  c.fillStyle = 'rgba(160,90,60,0.7)'; c.fillRect(0, H - 10, W, 10);
  // the scuff in the middle where hands push it up
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(W * 0.4, H * 0.78, W * 0.2, H * 0.12);
  // an old sticker, sun-bleached
  c.fillStyle = 'rgba(240,210,90,0.55)'; c.fillRect(W * 0.66, H * 0.62, 34, 22);
  shutT = new THREE.CanvasTexture(cv);
  shutT.colorSpace = THREE.SRGBColorSpace;
  shutT.anisotropy = 8;
  return shutT;
}

let gravelT = null;
/** Track ballast: packed grey-violet stones, lit tops and dark gaps, with
 * the rust-brown stain the line leaves. Tiles every 1.4 m. */
export const GRAVEL_TILE = 1.4;
export function gravelTex() {
  if (gravelT) return gravelT;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const r = rng(8484);
  c.fillStyle = '#6a6474'; c.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {
    const x = r() * S, y = r() * S, s = 3 + r() * 5;
    const t = r();
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      c.fillStyle = t < 0.3 ? '#8e8898' : t < 0.6 ? '#a8a2b0' : t < 0.85 ? '#c2bcc8' : '#9a7f70';
      c.beginPath();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + t; c.lineTo(x + ox + Math.cos(a) * s * (0.7 + ((k * 37) % 5) / 10), y + oy + Math.sin(a) * s * 0.8); }
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(x + ox - s * 0.3, y + oy - s * 0.5, s * 0.5, 1.5);
    }
  }
  gravelT = new THREE.CanvasTexture(cv);
  gravelT.colorSpace = THREE.SRGBColorSpace;
  gravelT.wrapS = gravelT.wrapT = THREE.RepeatWrapping;
  gravelT.anisotropy = 16;
  return gravelT;
}
