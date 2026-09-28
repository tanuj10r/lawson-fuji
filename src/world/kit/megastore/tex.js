import * as THREE from 'three';
import { JP, JP_ROUND, JP_BRUSH } from '../tex.js';
import { DONPEN } from '../../../data/town.js';

/* ------------------------------------------------------------------ *
 * ドンペン堂's paint (experiences: the discount megastore), two pages.
 *
 *   FRONT  2048 x 512   the big black band with the gold letters, the
 *                       silver fascia with the name, the canopy's red edge:
 *                       one 17 m front, seen whole from across the spine
 *                       (about 100 px a metre on a 1080p screen)
 *   MISC   1024 x 1024  everything smaller: the product walls, the top
 *                       floor's banners, the blade sign, the price cards
 *                       (POP), the striped stands, the red board, boxes
 *   PROD   768 x 512    the goods: 95 printed packages in 64 px cells
 *                       (PRODUCTS), the 96th cell white; seen at 1.5-3 m
 *                       on the walk, and stamped into the product walls
 *
 * `R.front[k]` / `R.misc[k]` are regions in pixels; uvRegion() maps a
 * geometry's 0..1 UVs into one, so every sign on the store shares one
 * material per page and draws in a single batch.
 * ------------------------------------------------------------------ */

export const PAGE = { front: [2048, 512], misc: [1024, 1024], prod: [768, 512] };
/** Where the mascot sits across the front (0 = the viewer's left end): the
 * band and the fascia leave it a gap there. */
export const PEN_AT = 0.383;
export const R = {
  front: {
    band: [0, 0, 2048, 288],
    fascia: [0, 288, 2048, 160],
    canopy: [0, 448, 2048, 64],
  },
  misc: {
    wall: [0, 0, 1024, 256],
    upper: [0, 256, 896, 176],
    blade: [896, 256, 128, 704],
    side: [0, 432, 320, 256],
    goods: [320, 432, 320, 128],
    stripe: [640, 432, 128, 128],
    board: [768, 432, 128, 192],
    aisle: [320, 560, 448, 128],
    pops: [0, 688, 512, 288],        // 12 cards, 4 x 3, each 128 x 96
    hang: [512, 688, 384, 128],      // 3 ceiling boards, each 128 x 128
    carton: [512, 816, 128, 128],
    gold: [640, 816, 128, 128],      // gold foil: the party goods, the pillars' trim
  },
};
/** A price card's region (0..11). */
export const popRegion = (i) => {
  const [x, y] = R.misc.pops;
  const k = i % 12;
  return [x + (k % 4) * 128, y + Math.floor(k / 4) * 96, 128, 96];
};
export const hangRegion = (i) => [R.misc.hang[0] + (i % 3) * 128, R.misc.hang[1], 128, 128];

/** Remap a geometry's UVs (0..1) into a region of a page. */
export function uvRegion(geo, region, page) {
  const [W, H] = PAGE[page];
  const [x, y, w, h] = region;
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (x + uv.getX(i) * w) / W, 1 - (y + (1 - uv.getY(i)) * h) / H);
  }
  uv.needsUpdate = true;
  return geo;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function page(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Fit text into maxW at up to `size`; returns the size used. */
function fitSize(c, str, maxW, size, face, weight = 'bold') {
  let s = size;
  for (; s > 6; s--) {
    c.font = `${weight} ${s}px ${face}`;
    if (c.measureText(str).width <= maxW) break;
  }
  return s;
}
function text(c, str, x, y, maxW, size, face, { fill = '#fff', stroke = null, sw = 0, weight = 'bold', align = 'center', sy = 1 } = {}) {
  const s = fitSize(c, str, maxW, size, face, weight);
  c.save();
  c.translate(x, y);
  c.scale(1, sy);
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  if (stroke) { c.lineWidth = sw; c.strokeStyle = stroke; c.strokeText(str, 0, 0); }
  c.fillStyle = fill;
  c.fillText(str, 0, 0);
  c.restore();
  return s;
}

const BRIGHT = ['#e8322e', '#f5c21b', '#2f7fd8', '#35b35a', '#f07ab0', '#ff8a1e', '#8c5cd6', '#1fb7c4', '#ffffff', '#f4e04a', '#d81e62', '#5ad0f0'];

/* ------------------------------------------------------------- FRONT */
let front = null;
export function frontPage() {
  if (front) return front;
  front = page(2048, 512, (c) => {
    band(c, ...R.front.band);
    fascia(c, ...R.front.fascia);
    canopy(c, ...R.front.canopy);
  });
  return front;
}

/** The huge black band: the name in fat gold 3D letters, outlined in red. */
function band(c, x0, y0, w, h) {
  c.save();
  c.translate(x0, y0);
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1c1a20'); g.addColorStop(0.5, '#0c0b0e'); g.addColorStop(1, '#1c1a20');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // gold rules top and bottom
  c.fillStyle = '#d8a82a'; c.fillRect(0, 8, w, 5); c.fillRect(0, h - 13, w, 5);
  // the letters: MEGA to the left of the mascot, the name to its right
  const a = PEN_AT - 0.055, b = PEN_AT + 0.055;
  const runs = [[DONPEN.mega, (0.02 + a) / 2 * w, (a - 0.02) * w], [DONPEN.name, (b + 0.98) / 2 * w, (0.98 - b) * w]];
  const size = Math.min(...runs.map(([s, , mw]) => fitSize(c, s, mw, 236, JP, '900')));
  c.font = `900 ${size}px ${JP}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  const cy = h / 2 + 6;
  for (const [str, cx] of runs) {
    // the extrusion: the outlined shape stepped down and right in deep red-brown
    c.strokeStyle = '#5a0c0a'; c.lineWidth = 26;
    for (let i = 12; i >= 1; i--) c.strokeText(str, cx + i * 0.8, cy + i * 1.1);
    // the red outline, then a thin dark keyline inside it
    c.strokeStyle = '#e0141c'; c.lineWidth = 26; c.strokeText(str, cx, cy);
    c.strokeStyle = '#6a0a08'; c.lineWidth = 9; c.strokeText(str, cx, cy);
    // gold face: bright at the top, deep in the middle, a lighter lip at the foot
    const gold = c.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
    gold.addColorStop(0, '#fff6b8'); gold.addColorStop(0.3, '#ffd23a'); gold.addColorStop(0.55, '#e59a10');
    gold.addColorStop(0.8, '#ffcb3a'); gold.addColorStop(1, '#fff0a0');
    c.fillStyle = gold;
    c.fillText(str, cx, cy);
    // a shine along the tops of the letters
    c.save();
    c.beginPath(); c.rect(0, cy - size * 0.5, w, size * 0.22); c.clip();
    c.fillStyle = 'rgba(255,255,240,0.45)';
    c.fillText(str, cx, cy);
    c.restore();
  }
  // little gold stars at the ends
  for (const sx of [48, w - 48]) star(c, sx, h / 2, 30, 12, '#ffd23a', '#e0141c');
  c.restore();
}

function star(c, x, y, R0, r0, fill, stroke) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r0 : R0;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  if (stroke) { c.lineWidth = 5; c.strokeStyle = stroke; c.lineJoin = 'round'; c.stroke(); }
  c.fillStyle = fill; c.fill();
}

/** The silver fascia: the name white on red outline to the left of the
 * mascot, the tagline in red to the right (the mascot sits between). */
function fascia(c, x0, y0, w, h) {
  c.save();
  c.translate(x0, y0);
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#fbfcfd'); g.addColorStop(0.45, '#cfd4dc'); g.addColorStop(0.55, '#b9c0ca'); g.addColorStop(1, '#eef1f4');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // brushed-metal streaks
  const r = rng(71);
  for (let i = 0; i < 90; i++) {
    c.fillStyle = `rgba(255,255,255,${0.1 + r() * 0.25})`;
    c.fillRect(r() * w, r() * h, 60 + r() * 260, 1.5);
  }
  c.fillStyle = '#d8141c'; c.fillRect(0, 0, w, 7); c.fillRect(0, h - 16, w, 16);
  // the name, left of the mascot
  const a = PEN_AT - 0.05, b = PEN_AT + 0.05;
  text(c, DONPEN.name, (0.01 + a) / 2 * w, h / 2 - 3, (a - 0.03) * w, 124, JP_ROUND, { fill: '#ffffff', stroke: '#d8141c', sw: 22, weight: '900' });
  // the tagline, right of the mascot
  text(c, DONPEN.tagline, (b + 0.99) / 2 * w, h / 2 - 3, (0.97 - b) * w, 118, JP_ROUND, { fill: '#e0141c', stroke: '#ffffff', sw: 12, weight: '900' });
  // round rivets
  c.fillStyle = '#9aa2ae';
  for (let x = 24; x < w; x += 200) { c.beginPath(); c.arc(x, 20, 4, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(x, h - 28, 4, 0, Math.PI * 2); c.fill(); }
  c.restore();
}

/** The canopy's red edge: what's inside, one after another. */
function canopy(c, x0, y0, w, h) {
  c.save();
  c.translate(x0, y0);
  c.fillStyle = '#d8141c'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#f5c21b'; c.fillRect(0, 0, w, 4); c.fillRect(0, h - 4, w, 4);
  const items = DONPEN.canopy;
  let x = 20;
  let i = 0;
  c.textBaseline = 'middle';
  while (x < w - 40) {
    const s = items[i % items.length];
    c.font = `900 40px ${JP_ROUND}`;
    c.fillStyle = '#ffffff';
    c.textAlign = 'left';
    c.fillText(s, x, h / 2 + 1);
    x += c.measureText(s).width + 26;
    star(c, x, h / 2, 14, 6, '#f5c21b', null);
    x += 40;
    i++;
  }
  c.restore();
}

/* -------------------------------------------------------------- MISC */
let misc = null;
export function miscPage() {
  if (misc) return misc;
  misc = page(1024, 1024, (c) => {
    prodPage();   // the packages first: the walls are stamped from them
    productWall(c, ...R.misc.wall, 5, 11, true, 80);
    productWall(c, ...R.misc.side, 5, 23, false, 97);
    productWall(c, ...R.misc.aisle, 3, 37, true, 160);
    upper(c, ...R.misc.upper);
    blade(c, ...R.misc.blade);
    goods(c, ...R.misc.goods);
    stripes(c, ...R.misc.stripe);
    board(c, ...R.misc.board);
    DONPEN.pop.forEach((s, i) => pop(c, popRegion(i), s, i));
    ['激安!', '爆安', '大人気!'].forEach((s, i) => hang(c, hangRegion(i), s, i));
    carton(c, ...R.misc.carton);
    goldFoil(c, ...R.misc.gold);
  });
  return misc;
}

/** Floor-to-ceiling shelves crammed with packs, price rails and POP cards;
 * `signs` puts the category boards along the top. */
function productWall(c, x0, y0, w, h, rows, seed, signs, ppm) {
  const r = rng(seed);
  c.save();
  c.beginPath(); c.rect(x0, y0, w, h); c.clip();
  c.translate(x0, y0);
  c.fillStyle = '#fbf6ee'; c.fillRect(0, 0, w, h);
  const top = signs ? 34 : 6;
  if (signs) {
    const n = Math.max(2, Math.round(w / 170));
    for (let i = 0; i < n; i++) {
      const bx = (i * w) / n + 4, bw = w / n - 8;
      c.fillStyle = i % 2 ? '#d8141c' : '#f5c21b';
      c.fillRect(bx, 3, bw, 28);
      text(c, DONPEN.aisle[(i + seed) % DONPEN.aisle.length], bx + bw / 2, 18, bw - 10, 24, JP_ROUND, { fill: i % 2 ? '#fff' : '#d8141c', weight: '900' });
    }
  }
  const rh = (h - top) / rows;
  for (let k = 0; k < rows; k++) {
    const y = top + k * rh;
    // the shelf's back, a touch darker
    c.fillStyle = '#e9e1d4'; c.fillRect(0, y, w, rh);
    // packs shoulder to shoulder, one kind of thing a shelf (the same
    // printed packages as the goods in front, PROD)
    const pool = PRODUCTS.filter((p) => p.cat === CATS[Math.floor(r() * CATS.length)]);
    let x = 2;
    while (x < w) {
      const p = pool[Math.floor(r() * pool.length)];
      const ph = Math.min(rh - 8, Math.max(rh * 0.55, p.h * ppm * 1.5));
      const pw = stampProd(c, p, x, y + rh - 6, ph);
      x += pw + 1;
    }
    // the price rail and its tags
    c.fillStyle = '#ffffff'; c.fillRect(0, y + rh - 6, w, 6);
    for (let tx = 4 + r() * 20; tx < w; tx += 18 + r() * 30) {
      c.fillStyle = r() < 0.7 ? '#f5e21b' : '#ff5a4a';
      c.fillRect(tx, y + rh - 7, 10, 8);
    }
    // the odd POP card leaning out of the shelf
    if (r() < 0.8) {
      for (let j = 0; j < 1 + Math.floor(w / 220); j++) {
        const px = r() * (w - 30), pw = 22 + r() * 12, ph = 16 + r() * 6;
        c.fillStyle = r() < 0.75 ? '#fff23a' : '#ff9ac8';
        c.fillRect(px, y + rh - 6 - ph - r() * 10, pw, ph);
        c.fillStyle = '#e0141c';
        c.fillRect(px + 3, y + rh - 6 - ph * 0.7 - 4, pw - 6, 3);
        c.fillRect(px + 3, y + rh - 6 - ph * 0.35 - 4, (pw - 6) * 0.6, 3);
      }
    }
    // the shelf's lip
    c.fillStyle = '#b8b0a4'; c.fillRect(0, y, w, 2);
  }
  c.restore();
}

/** The top floor: its windows papered with big sale banners. */
function upper(c, x0, y0, w, h) {
  c.save();
  c.translate(x0, y0);
  c.fillStyle = '#2a2830'; c.fillRect(0, 0, w, h);
  const n = DONPEN.banners.length;
  const cols = ['#f5c21b', '#e0141c', '#f07ab0', '#2f7fd8', '#35b35a', '#ff8a1e'];
  const ink = ['#e0141c', '#fff23a', '#ffffff', '#fff23a', '#ffffff', '#ffffff'];
  for (let i = 0; i < n; i++) {
    const bx = (i * w) / n + 5, bw = w / n - 10;
    c.fillStyle = cols[i]; c.fillRect(bx, 8, bw, h - 16);
    c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.strokeRect(bx + 5, 13, bw - 10, h - 26);
    const s = DONPEN.banners[i];
    if ([...s].length <= 2) text(c, s, bx + bw / 2, h / 2, bw - 16, 96, JP_ROUND, { fill: ink[i], stroke: '#3a1010', sw: 5, weight: '900' });
    else text(c, s, bx + bw / 2, h / 2, bw - 12, 50, JP_ROUND, { fill: ink[i], stroke: '#3a1010', sw: 4, weight: '900' });
  }
  c.restore();
}

/** The vertical sign out over the walk: red, gold edge, the name down it. */
function blade(c, x0, y0, w, h) {
  c.save();
  c.translate(x0, y0);
  c.fillStyle = '#d8141c'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#f5c21b'; c.lineWidth = 8; c.strokeRect(6, 6, w - 12, h - 12);
  // the mascot's face in a white disc
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(w / 2, 70, 48, 0, Math.PI * 2); c.fill();
  penguinFace(c, w / 2, 74, 38);
  // the name down the sign
  const ch = [...DONPEN.name];
  const y1 = h - 110;
  const step = (y1 - 140) / ch.length;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  ch.forEach((g, i) => {
    const y = 140 + step * (i + 0.5);
    c.font = `900 ${Math.floor(Math.min(step * 0.9, 100))}px ${JP_ROUND}`;
    if (g === 'ー') { c.fillStyle = '#fff'; c.fillRect(w / 2 - 7, y - step * 0.32, 14, step * 0.64); return; }
    c.lineWidth = 10; c.strokeStyle = '#7a0a0a'; c.strokeText(g, w / 2, y);
    c.fillStyle = '#ffffff'; c.fillText(g, w / 2, y);
  });
  c.fillStyle = '#f5c21b'; c.fillRect(14, h - 96, w - 28, 70);
  text(c, DONPEN.mega, w / 2, h - 61, w - 36, 48, JP, { fill: '#d8141c', weight: '900' });
  c.restore();
}

/** Our mascot's face, flat, for signs: navy head, white mask, orange beak, red cap. */
export function penguinFace(c, x, y, s) {
  c.save();
  c.fillStyle = '#23336e'; c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffffff';
  c.beginPath(); c.ellipse(x - s * 0.3, y + s * 0.1, s * 0.42, s * 0.5, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(x + s * 0.3, y + s * 0.1, s * 0.42, s * 0.5, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#1a1420';
  c.beginPath(); c.arc(x - s * 0.28, y + s * 0.05, s * 0.13, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(x + s * 0.28, y + s * 0.05, s * 0.13, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ff9a1e';
  c.beginPath(); c.ellipse(x, y + s * 0.42, s * 0.24, s * 0.13, 0, 0, Math.PI * 2); c.fill();
  // the cap: red crown and a peak
  c.fillStyle = '#e0141c';
  c.beginPath(); c.arc(x, y - s * 0.35, s * 0.8, Math.PI, 0); c.fill();
  c.fillRect(x - s * 0.1, y - s * 0.42, s * 1.15, s * 0.16);
  c.fillStyle = '#f5c21b'; c.beginPath(); c.arc(x, y - s * 0.72, s * 0.14, 0, Math.PI * 2); c.fill();
  c.restore();
}

function goods(c, x0, y0, w, h) {
  const r = rng(53);
  c.save(); c.translate(x0, y0);
  c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) {
    for (let x = (y / 16) % 2 ? -8 : 0; x < w; x += 20) {
      c.fillStyle = BRIGHT[Math.floor(r() * BRIGHT.length)];
      c.fillRect(x + 1, y + 1, 18, 14);
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(x + 3, y + 5, 14, 3);
    }
  }
  c.restore();
}

function stripes(c, x0, y0, w, h) {
  c.save(); c.translate(x0, y0);
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#e0141c';
  for (let x = 0; x < w; x += 32) c.fillRect(x, 0, 16, h);
  c.restore();
}

/** The red board on a stand by the door. */
function board(c, x0, y0, w, h) {
  c.save(); c.translate(x0, y0);
  c.fillStyle = '#d8141c'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#f5c21b'; c.lineWidth = 5; c.strokeRect(5, 5, w - 10, h - 10);
  const L = DONPEN.board;
  text(c, L[0], w / 2, 28, w - 20, 26, JP_BRUSH, { fill: '#ffffff' });
  text(c, L[1], w / 2, 64, w - 16, 30, JP_BRUSH, { fill: '#fff23a' });
  c.fillStyle = '#fff23a'; c.fillRect(14, 86, w - 28, 3);
  text(c, L[2], w / 2, 112, w - 20, 28, JP_BRUSH, { fill: '#ffffff' });
  text(c, L[3], w / 2, 150, w - 16, 30, JP_BRUSH, { fill: '#fff23a', stroke: '#7a0a0a', sw: 4 });
  c.restore();
}

/** A hand-lettered price card: yellow (now and then pink or orange), a red
 * burst, marker writing. */
function pop(c, [x0, y0, w, h], s, i) {
  c.save(); c.translate(x0, y0);
  const bg = ['#fff23a', '#fff23a', '#ffb0d0', '#fff23a', '#ffa64a', '#fff23a'][i % 6];
  c.fillStyle = bg; c.fillRect(2, 2, w - 4, h - 4);
  c.strokeStyle = '#e0141c'; c.lineWidth = 4; c.strokeRect(6, 6, w - 12, h - 12);
  const price = /円$/.test(s);
  if (price) {
    star(c, 22, 22, 18, 9, '#e0141c', null);
    text(c, s, w / 2 + 6, h / 2 + 8, w - 20, 60, JP_BRUSH, { fill: '#e0141c', stroke: '#ffffff', sw: 3, weight: '900' });
  } else if ([...s].length > 5) {
    const a = [...s];
    const mid = Math.ceil(a.length / 2);
    text(c, a.slice(0, mid).join(''), w / 2, h * 0.34, w - 16, 36, JP_BRUSH, { fill: '#1a1420' });
    text(c, a.slice(mid).join(''), w / 2, h * 0.7, w - 16, 36, JP_BRUSH, { fill: '#e0141c' });
  } else {
    text(c, s, w / 2, h / 2, w - 16, 54, JP_BRUSH, { fill: '#e0141c', stroke: '#1a1420', sw: 2, weight: '900' });
  }
  c.restore();
}

/** The big boards hung from the ceiling, both faces. */
function hang(c, [x0, y0, w, h], s, i) {
  c.save(); c.translate(x0, y0);
  const bg = ['#fff23a', '#e0141c', '#f07ab0'][i];
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  c.strokeStyle = i === 1 ? '#fff23a' : '#e0141c'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
  text(c, s, w / 2, h / 2, w - 20, 64, JP_BRUSH, { fill: i === 1 ? '#fff23a' : '#e0141c', stroke: i === 1 ? '#5a0a0a' : '#ffffff', sw: 4, weight: '900' });
  c.restore();
}

function carton(c, x0, y0, w, h) {
  c.save(); c.translate(x0, y0);
  c.fillStyle = '#c89a62'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#b48652'; c.fillRect(0, h / 2 - 6, w, 12);
  c.fillStyle = '#e0141c'; c.fillRect(14, 20, w - 28, 34);
  text(c, '特価', w / 2, 37, w - 36, 28, JP_ROUND, { fill: '#fff', weight: '900' });
  c.fillStyle = '#2f5aa8';
  for (let i = 0; i < 4; i++) c.fillRect(16 + i * 26, 80, 18, 30);
  c.restore();
}

function goldFoil(c, x0, y0, w, h) {
  const r = rng(99);
  c.save(); c.translate(x0, y0);
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#fff0a0'); g.addColorStop(0.4, '#f0b820'); g.addColorStop(0.6, '#ffe070'); g.addColorStop(1, '#c88a10');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) {
    c.fillStyle = r() < 0.5 ? 'rgba(255,255,230,0.7)' : 'rgba(160,100,0,0.35)';
    c.fillRect(r() * w, r() * h, 2 + r() * 8, 1.5);
  }
  c.restore();
}

/* -------------------------------------------------------------- PROD */
/* The goods on the walk and in the entrance: 95 packages, each a 64 px
 * cell of printed paint and a body (kind, size, colour) index.js builds
 * the mesh from.  Coined names, no real brand anywhere.  The names are in
 * the system gothic (JP), as packaging is: every character draws. */
export const PC = 64, PCOLS = 12, PROWS = 8;
export const PROD_WHITE = PCOLS * PROWS - 1;
export const prodRegion = (i) => [(i % PCOLS) * PC, Math.floor(i / PCOLS) * PC, PC, PC];

const N = {
  snack: ['パリッチ', 'サクサク王', 'カリッと', 'のりしお', 'うすしお', 'コンソメ', 'えびせん', 'ポテチ極', 'とんがり', 'あげもち', 'コーンぱふ', 'チーズ棒', 'ざくざく', 'ぱりぱり海苔', 'カラムー', 'わさビーフ'],
  choco: ['チョコリッチ', 'ミルクチョコ', 'いちごポッキ', 'アーモンド', 'ビター72', 'クッキーサンド', 'ホワイト', 'カカオ', 'マカダミア', 'ラングド'],
  noodle: ['ラーメン太郎', 'とんこつ', 'しょうゆ', 'みそバター', '担々麺', '焼そば', 'カレーうどん', '塩ラーメン'],
  drink: ['ゴクゴク茶', 'スパークル', 'コーラZ', 'レモンサイダー', 'むぎ茶', 'ミルクティー', 'オレンジ100', 'アクア', 'ジャスミン', 'カルピ'],
  can: ['コーヒー極', 'ブラック', 'カフェオレ', '微糖', 'サイダー', 'レモンサワー', 'ハイボール', 'グレープ'],
  cosme: ['うるおい', 'ホワイトニング', 'クレンジング', 'つやめき', 'モイスト', 'UVミルク', 'ヘアオイル', 'リップ', 'マスク7', 'ハンドクリーム'],
  clean: ['ピカット', 'アワアワ', 'さらさら', '除菌99', 'キラリ', 'ふんわり'],
  tissue: ['やわらか', 'ふわっと', 'はなセレブ', 'ソフト'],
  toy: ['ペンちゃん', 'ロボキング', 'プリンセス', 'ミニカー', 'ぬいぐるみ', 'パズル', 'スライム', 'キラキラ'],
  candy: ['グミッチ', 'ソフトキャン', 'ラムネ', 'ミルキー玉', 'こんぺい', 'ハイチュ', 'あめ玉', 'フルーツ'],
  party: ['パーティー', 'クラッカー', 'カツラ', 'マスク'],
  misc: ['単3電池', '延長コード', 'イヤホン'],
};
const C = {
  snack: ['#e8322e', '#f5c21b', '#2f7fd8', '#35b35a', '#ff8a1e', '#8c5cd6', '#1fb7c4', '#d81e62', '#4a3a8a', '#f4e04a'],
  choco: ['#4a2418', '#7a1a1a', '#1e1a30', '#c8102e', '#f3e8d8', '#2a5a2a', '#8a3a10', '#d8b060'],
  noodle: ['#f6f0e4', '#e0141c', '#f5c21b', '#2a2a2a', '#ffffff', '#3a6ad8'],
  drink: ['#3a9a3a', '#e8e8f0', '#1a1418', '#ffe040', '#8a5a2a', '#d8b890', '#ff8a1e', '#3ab8f0', '#2a7a4a', '#ffffff'],
  can: ['#2a2018', '#1a1a1a', '#c8a060', '#3a6ad8', '#3ab8f0', '#f4e04a', '#d8a020', '#8c5cd6'],
  cosme: ['#ffffff', '#fce8ee', '#f4f8ff', '#fff6e0', '#eaf6ee', '#f8f0ff'],
  clean: ['#2f7fd8', '#35b35a', '#ff8a1e', '#f5c21b', '#1fb7c4', '#e8322e'],
  tissue: ['#ffffff', '#eaf4ff', '#fff2f6', '#f4fff0'],
  toy: ['#f5c21b', '#e8322e', '#f07ab0', '#2f7fd8', '#35b35a', '#ff8a1e', '#8c5cd6', '#1fb7c4'],
  candy: ['#ffd0e0', '#d8f0ff', '#fff4b0', '#d8ffd0', '#f0d8ff', '#ffe0c0'],
  party: ['#f5c21b', '#8c5cd6', '#e8322e', '#1fb7c4'],
  misc: ['#ffffff', '#2f7fd8', '#1a1a1a'],
};
export const CATS = Object.keys(N);

function defs() {
  const r = rng(808);
  const P = [];
  const add = (cat, kind, dims) => N[cat].forEach((name, i) => {
    P.push({ cat, kind, name, body: C[cat][i % C[cat].length], cell: P.length, ...dims(i, r) });
  });
  add('snack', 'bag', () => ({ w: 0.15 + r() * 0.05, h: 0.21 + r() * 0.05, d: 0.065 }));
  add('choco', 'box', () => ({ w: 0.13 + r() * 0.04, h: 0.075 + r() * 0.03, d: 0.03 }));
  add('noodle', 'cup', () => ({ r: 0.047, h: 0.1 }));
  add('drink', 'pet', (i) => (i % 3 === 2 ? { r: 0.046, h: 0.3 } : { r: 0.033, h: 0.21 }));
  add('can', 'can', (i) => ({ r: 0.033, h: i % 2 ? 0.165 : 0.12 }));
  add('cosme', 'tube', (i) => (i % 3 === 1 ? { kind: 'tub', r: 0.036, h: 0.055 } : { w: 0.05, h: 0.14 + r() * 0.03, d: 0.03 }));
  add('clean', 'box', () => ({ w: 0.12 + r() * 0.03, h: 0.24 + r() * 0.03, d: 0.075 }));
  add('tissue', 'box', () => ({ w: 0.23, h: 0.062, d: 0.115 }));
  add('toy', 'box', () => ({ w: 0.18 + r() * 0.06, h: 0.24 + r() * 0.05, d: 0.07 }));
  add('candy', 'bag', () => ({ w: 0.1 + r() * 0.03, h: 0.14 + r() * 0.03, d: 0.04 }));
  add('party', 'bag', () => ({ w: 0.2, h: 0.27, d: 0.05 }));
  add('misc', 'box', () => ({ w: 0.11, h: 0.14, d: 0.04 }));
  return P;
}
export const PRODUCTS = defs();

let prod = null, prodCv = null;
export function prodPage() {
  if (prod) return prod;
  prodCv = document.createElement('canvas');
  prodCv.width = PAGE.prod[0]; prodCv.height = PAGE.prod[1];
  const c = prodCv.getContext('2d');
  PRODUCTS.forEach((p) => {
    const [x, y] = prodRegion(p.cell);
    c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, PC, PC); c.clip();
    paintProd(c, p);
    c.restore();
  });
  const [wx, wy] = prodRegion(PROD_WHITE);
  c.fillStyle = '#ffffff'; c.fillRect(wx, wy, PC, PC);
  prod = new THREE.CanvasTexture(prodCv);
  prod.colorSpace = THREE.SRGBColorSpace;
  prod.anisotropy = 8;
  return prod;
}

const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const ink = (bg) => (lum(bg) > 0.6 ? '#1a1420' : '#ffffff');
const rr = (c, x, y, w, h, r0) => { c.beginPath(); c.roundRect(x, y, w, h, r0); };
/** Small print: a few grey lines, as the back of every pack has. */
function fine(c, x, y, w, n, col = 'rgba(0,0,0,0.35)') {
  c.fillStyle = col;
  for (let i = 0; i < n; i++) c.fillRect(x, y + i * 3, w * (0.6 + ((i * 7) % 5) / 10), 1.2);
}
function barcode(c, x, y, w, h) {
  c.fillStyle = '#ffffff'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
  c.fillStyle = '#111';
  for (let i = 0; i < w; i += 2) if ((i * 7 + 3) % 5 < 3) c.fillRect(x + i, y, 1, h);
}
function burst(c, x, y, s, str, fill = '#e0141c', tcol = '#fff23a') {
  star(c, x, y, s, s * 0.62, fill, null);
  if (str) text(c, str, x, y + 0.5, s * 1.3, s * 0.7, JP, { fill: tcol, weight: '900' });
}

/** One package's face, in a 64 x 64 cell. */
function paintProd(c, p) {
  const r = rng(p.cell * 31 + 7);
  const bg = p.body, tx = ink(bg);
  c.fillStyle = bg; c.fillRect(0, 0, PC, PC);
  switch (p.cat) {
    case 'snack': {
      // a paler swoosh, the name big, a photo of the crisps, a flavour tag
      c.fillStyle = 'rgba(255,255,255,0.22)';
      c.beginPath(); c.moveTo(0, 40); c.quadraticCurveTo(32, 20, 64, 34); c.lineTo(64, 64); c.lineTo(0, 64); c.fill();
      text(c, p.name, 32, 14, 58, 15, JP, { fill: '#fff23a', stroke: '#5a1010', sw: 3, weight: '900' });
      c.fillStyle = ['#f0c060', '#e8b050', '#f4d080'][p.cell % 3];
      c.beginPath(); c.ellipse(34, 44, 22, 13, -0.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(160,90,20,0.5)';
      for (let i = 0; i < 9; i++) { c.beginPath(); c.ellipse(16 + r() * 36, 36 + r() * 16, 4, 2.2, r() * 3, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(18 + r() * 32, 38 + r() * 12, 2.5, 1.2, r() * 3, 0, Math.PI * 2); c.fill(); }
      burst(c, 54, 26, 9, p.cell % 2 ? '増量' : '新');
      fine(c, 4, 55, 20, 3, 'rgba(255,255,255,0.7)');
      break;
    }
    case 'choco': {
      c.strokeStyle = '#e8c060'; c.lineWidth = 1.5; c.strokeRect(3, 3, 58, 58);
      text(c, p.name, 32, 16, 56, 12, JP, { fill: lum(bg) > 0.6 ? '#6a2a10' : '#f4d890', weight: '900' });
      // the bar, and a lighter glint along its top
      c.fillStyle = '#5a2a14';
      rr(c, 12, 30, 40, 20, 3); c.fill();
      c.fillStyle = '#7a3a1c';
      for (let i = 0; i < 4; i++) c.fillRect(15 + i * 9.5, 33, 7, 14);
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(14, 31, 36, 2);
      fine(c, 12, 54, 40, 2, lum(bg) > 0.6 ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)');
      break;
    }
    case 'noodle': {
      // a wrap: the name where the front is (the middle), a broth band, noodles
      c.fillStyle = p.cell % 2 ? '#e0141c' : '#1a1a1a';
      c.fillRect(0, 18, 64, 26);
      c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(0, 44, 64, 4);
      text(c, p.name, 32, 31, 60, 13, JP, { fill: '#fff23a', stroke: '#3a0a0a', sw: 2, weight: '900' });
      c.fillStyle = '#f4d060';
      for (let i = 0; i < 12; i++) { c.beginPath(); c.arc(4 + i * 5.5, 55 + (i % 2) * 3, 2, 0, Math.PI * 2); c.fill(); }
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1;
      for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(i * 9, 2); c.quadraticCurveTo(i * 9 + 4, 8, i * 9 + 8, 2); c.stroke(); }
      text(c, 'カップめん', 32, 9, 40, 7, JP, { fill: tx, weight: 'bold' });
      break;
    }
    case 'drink': {
      // a wrap on a bottle: the label band; the plastic above and below shows the body colour
      const lab = ['#3a9a3a', '#e0141c', '#1a1418', '#ffe040', '#8a5a2a', '#f4f0e8', '#ff8a1e', '#2f7fd8', '#2a7a4a', '#ffffff'][p.cell % 10];
      c.fillStyle = lab; c.fillRect(0, 22, 64, 30);
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, 22, 64, 3);
      text(c, p.name, 32, 34, 60, 12, JP, { fill: ink(lab), stroke: lum(lab) > 0.6 ? null : 'rgba(0,0,0,0.4)', sw: 2, weight: '900' });
      text(c, ['お茶', '炭酸', 'ゼロ', '果汁', '水', 'ミルク'][p.cell % 6], 32, 46, 40, 7, JP, { fill: ink(lab), weight: 'bold' });
      barcode(c, 4, 54, 16, 6);
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(8, 0, 4, 64);
      break;
    }
    case 'can': {
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(6, 0, 3, 64);
      c.fillStyle = p.cell % 2 ? '#f4e04a' : '#ffffff';
      c.fillRect(0, 24, 64, 18);
      text(c, p.name, 32, 33, 60, 12, JP, { fill: '#1a1420', weight: '900' });
      text(c, ['缶コーヒー', 'BLACK', 'ALC 5%', '無糖'][p.cell % 4], 32, 14, 50, 8, JP, { fill: tx, weight: 'bold' });
      burst(c, 50, 54, 7, null, '#e0141c');
      barcode(c, 6, 52, 14, 6);
      break;
    }
    case 'cosme': {
      c.fillStyle = ['#f4b8c8', '#c8dcf4', '#e8d8f8', '#d8ecd8', '#f8e0b8'][p.cell % 5];
      c.beginPath(); c.ellipse(32, 46, 30, 14, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#d8b870'; c.lineWidth = 1; c.beginPath(); c.moveTo(8, 24); c.lineTo(56, 24); c.stroke();
      text(c, p.name, 32, 14, 56, 9, JP, { fill: '#3a3040', weight: 'bold' });
      text(c, ['保湿', '美白', '毛穴', 'ツヤ'][p.cell % 4], 32, 36, 30, 8, JP, { fill: '#8a6a30', weight: 'bold' });
      fine(c, 10, 54, 44, 2, 'rgba(0,0,0,0.3)');
      break;
    }
    case 'clean': {
      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.beginPath(); c.moveTo(0, 64); c.lineTo(64, 10); c.lineTo(64, 64); c.fill();
      for (let i = 0; i < 7; i++) { c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.arc(8 + r() * 48, 40 + r() * 20, 2 + r() * 4, 0, Math.PI * 2); c.fill(); }
      text(c, p.name, 32, 20, 60, 17, JP, { fill: '#ffffff', stroke: '#1a2a5a', sw: 3, weight: '900' });
      burst(c, 52, 46, 9, '強力', '#fff23a', '#e0141c');
      text(c, ['洗剤', '柔軟剤', '漂白', 'スプレー'][p.cell % 4], 20, 48, 30, 8, JP, { fill: '#ffffff', weight: 'bold' });
      break;
    }
    case 'tissue': {
      c.fillStyle = ['#bcdcf4', '#f8c8d8', '#c8ecc8', '#e8d8f8'][p.cell % 4];
      c.beginPath(); c.moveTo(0, 30); c.bezierCurveTo(20, 10, 44, 50, 64, 30); c.lineTo(64, 64); c.lineTo(0, 64); c.fill();
      text(c, p.name, 32, 20, 56, 13, JP, { fill: '#3a4a6a', weight: '900' });
      text(c, 'ティッシュ 200組', 32, 46, 56, 7, JP, { fill: '#3a4a6a', weight: 'bold' });
      break;
    }
    case 'toy': {
      for (let i = 0; i < 6; i++) star(c, r() * 64, r() * 64, 3 + r() * 3, 1.5, 'rgba(255,255,255,0.7)', null);
      // a window with a cartoon face looking out
      c.fillStyle = '#ffffff'; rr(c, 14, 22, 36, 34, 4); c.fill();
      c.fillStyle = ['#23336e', '#f07ab0', '#f5c21b', '#35b35a'][p.cell % 4];
      c.beginPath(); c.arc(32, 40, 12, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(27, 38, 3.5, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(37, 38, 3.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a1420';
      c.beginPath(); c.arc(27.5, 38.5, 1.6, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(37.5, 38.5, 1.6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#1a1420'; c.lineWidth = 1.2; c.beginPath(); c.arc(32, 43, 4, 0.2, Math.PI - 0.2); c.stroke();
      text(c, p.name, 32, 11, 58, 12, JP, { fill: '#ffffff', stroke: '#4a1040', sw: 3, weight: '900' });
      burst(c, 54, 56, 7, null, '#e0141c');
      break;
    }
    case 'candy': {
      c.fillStyle = 'rgba(255,255,255,0.7)';
      for (let y = 4; y < 64; y += 10) for (let x = (y / 10) % 2 ? 4 : 9; x < 64; x += 10) { c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill(); }
      const cc = ['#e8322e', '#f5c21b', '#35b35a', '#8c5cd6', '#ff8a1e'];
      for (let i = 0; i < 5; i++) { c.fillStyle = cc[i]; c.beginPath(); c.arc(14 + i * 9, 44 + (i % 2) * 5, 4.5, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(12 + i * 9, 42 + (i % 2) * 5, 1.5, 0, Math.PI * 2); c.fill(); }
      text(c, p.name, 32, 16, 56, 13, JP, { fill: '#e0141c', stroke: '#ffffff', sw: 3, weight: '900' });
      break;
    }
    case 'party': {
      const cc = ['#e8322e', '#f5c21b', '#35b35a', '#2f7fd8', '#f07ab0', '#ffffff'];
      for (let i = 0; i < 26; i++) { c.fillStyle = cc[i % 6]; c.save(); c.translate(r() * 64, r() * 64); c.rotate(r() * 3); c.fillRect(-2, -1, 4, 2); c.restore(); }
      c.fillStyle = 'rgba(255,255,255,0.85)'; rr(c, 8, 22, 48, 22, 3); c.fill();
      text(c, p.name, 32, 33, 44, 11, JP, { fill: '#8c2cb6', weight: '900' });
      text(c, 'パーティーグッズ', 32, 54, 56, 7, JP, { fill: tx, weight: 'bold' });
      break;
    }
    default: {
      c.fillStyle = p.cell % 2 ? '#2f7fd8' : '#f5c21b'; c.fillRect(0, 0, 64, 14);
      text(c, p.name, 32, 30, 56, 11, JP, { fill: tx, weight: '900' });
      c.fillStyle = '#c8ccd4'; for (let i = 0; i < 4; i++) { rr(c, 8 + i * 13, 40, 9, 18, 2); c.fill(); }
      c.fillStyle = '#d8a020'; for (let i = 0; i < 4; i++) c.fillRect(10 + i * 13, 38, 5, 3);
      break;
    }
  }
}

/** Stamp a package's cell onto a canvas, `ph` high, its foot on `y1`;
 * returns the width used.  Wraps show their front half. */
export function stampProd(c, p, x, y1, ph) {
  prodPage();
  const [sx, sy] = prodRegion(p.cell);
  const wrap = p.r !== undefined;
  const pw = Math.max(4, Math.round(ph * ((wrap ? 2 * p.r : p.w) / p.h)));
  if (wrap) c.drawImage(prodCv, sx + 16, sy, 32, PC, x, y1 - ph, pw, ph);
  else c.drawImage(prodCv, sx, sy, PC, PC, x, y1 - ph, pw, ph);
  return pw;
}
