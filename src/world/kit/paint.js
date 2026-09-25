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
