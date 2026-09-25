import * as THREE from 'three';
import { CATALOG } from '../../data/catalog.js';
import { FOOD } from '../foodart.js';

/* ------------------------------------------------------------------ *
 * Packaging, painted (SPEC 7; M3b).
 *
 * One 2048 atlas, 8 x 8 cells of 256 px: a cell per product (its front,
 * or its wrap for bottles and cups), and cell 63 plain white for every
 * unlabelled part (their colour comes from the vertex colours).  A second
 * atlas holds the shelf price tags.  All generic and ours.
 * ------------------------------------------------------------------ */

const JP = `'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Yu Gothic', Meiryo, sans-serif`;
const N = 8, CELL = 256, SIZE = N * CELL;
export const WHITE = 63;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };   // seeded: labels never change between loads

function fit(c, str, x, y, maxW, size, color, weight = 'bold') {
  let s = size;
  do { c.font = `${weight} ${s}px ${JP}`; if (c.measureText(str).width <= maxW) break; s -= 1; } while (s > 8);
  c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(str, x, y);
}
/** Vertical text, top to bottom, for tall narrow faces. */
function vfit(c, str, x, y0, y1, size, color) {
  const chars = [...str];
  const step = Math.min(size * 1.05, (y1 - y0) / chars.length);
  c.font = `bold ${Math.round(step * 0.92)}px ${JP}`; c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle';
  chars.forEach((ch, i) => c.fillText(ch, x, y0 + step * (i + 0.5)));
}

/* What each shape's label shows, in a 256 cell (u right, v down as drawn). */
const PAINT = {
  onigiri(c, p, m) {
    // the clear wrapper: rice with its grains, nori at the foot, the name strip on top
    c.fillStyle = '#fbfaf4'; c.fillRect(0, 0, CELL, CELL);
    for (let i = 0; i < 160; i++) { c.fillStyle = i % 2 ? '#e8e2d4' : '#ffffff'; c.beginPath(); c.ellipse(rnd() * CELL, rnd() * CELL, 5, 3, rnd() * 3, 0, 7); c.fill(); }
    c.fillStyle = '#2d3b36'; c.fillRect(CELL * 0.3, CELL * 0.62, CELL * 0.4, CELL * 0.38);
    c.fillStyle = hex(m.filling); c.beginPath(); c.ellipse(CELL / 2, CELL * 0.45, 26, 16, 0, 0, 7); c.fill();
    c.fillStyle = hex(m.band); c.fillRect(CELL * 0.18, CELL * 0.1, CELL * 0.64, CELL * 0.22);
    fit(c, p.nameJa.replace('おにぎり', ''), CELL / 2, CELL * 0.21, CELL * 0.6, 44, '#ffffff');
    fit(c, '¥' + p.priceYen, CELL / 2, CELL * 0.86, CELL * 0.4, 26, '#ffffff');
  },
  bento(c, p, m) {
    // seen from above through the lid: rice, the mains, a sticker with the name
    c.fillStyle = '#2a2a30'; c.fillRect(0, 0, CELL, CELL);
    FOOD.bento(c, CELL / 2, CELL * 0.55, CELL * 1.05);
    c.fillStyle = hex(m.band); c.beginPath(); c.roundRect(CELL * 0.08, CELL * 0.06, CELL * 0.84, CELL * 0.2, 10); c.fill();
    fit(c, p.nameJa, CELL / 2, CELL * 0.16, CELL * 0.8, 38, '#ffffff');
    c.fillStyle = '#ffe24a'; c.beginPath(); c.arc(CELL * 0.84, CELL * 0.82, 30, 0, 7); c.fill();
    fit(c, '¥' + p.priceYen, CELL * 0.84, CELL * 0.82, 52, 22, '#c8342f');
  },
  sandwich(c, p, m) {
    c.fillStyle = '#eef2f6'; c.fillRect(0, 0, CELL, CELL);
    FOOD.sandwich(c, CELL / 2, CELL * 0.58, CELL * 0.95);
    c.fillStyle = hex(m.band); c.fillRect(0, 0, CELL, CELL * 0.2);
    fit(c, p.nameJa, CELL / 2, CELL * 0.1, CELL * 0.9, 40, '#3a2a1a');
  },
  wrap(c, p, m, { liquid = null } = {}) {
    // a bottle or cup's wrap: the liquid above and below, the label round the middle
    c.fillStyle = liquid ?? hex(m.body); c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = hex(m.band); c.fillRect(0, CELL * 0.28, CELL, CELL * 0.5);
    c.fillStyle = 'rgba(255,255,255,0.92)'; c.fillRect(0, CELL * 0.34, CELL, CELL * 0.38);
    // the name twice round, so a bottle shows it from any side
    for (const x of [CELL * 0.25, CELL * 0.75]) {
      fit(c, p.nameJa, x, CELL * 0.49, CELL * 0.46, 30, hex(m.band));
      fit(c, p.nameEn, x, CELL * 0.64, CELL * 0.44, 14, '#555', 'normal');
    }
  },
  box(c, p, m, { vertical = false } = {}) {
    c.fillStyle = hex(m.body); c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = hex(m.band); c.fillRect(0, CELL * 0.7, CELL, CELL * 0.3);
    c.fillStyle = 'rgba(255,255,255,0.2)'; c.beginPath(); c.arc(CELL * 0.5, CELL * 0.45, CELL * 0.26, 0, 7); c.fill();
    if (vertical) vfit(c, p.nameJa, CELL / 2, CELL * 0.05, CELL * 0.68, 44, '#ffffff');
    else {
      fit(c, p.nameJa, CELL / 2, CELL * 0.2, CELL * 0.9, 44, '#ffffff');
      fit(c, p.nameEn, CELL / 2, CELL * 0.85, CELL * 0.86, 22, '#ffffff', 'normal');
    }
  },
  bag(c, p, m) {
    // a puffed bag: its edges curve away, so the words keep to the middle
    c.fillStyle = hex(m.body); c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = hex(m.band); c.fillRect(0, CELL * 0.7, CELL, CELL * 0.3);
    c.fillStyle = hex(m.band); c.beginPath(); c.roundRect(CELL * 0.2, CELL * 0.14, CELL * 0.6, CELL * 0.2, 12); c.fill();
    fit(c, p.nameJa, CELL / 2, CELL * 0.24, CELL * 0.56, 34, '#ffffff');
    fit(c, p.nameEn, CELL / 2, CELL * 0.8, CELL * 0.5, 18, '#ffffff', 'normal');
    // chips spilling in the middle
    for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? '#f6d86a' : '#e8b848'; c.beginPath(); c.ellipse(CELL * (0.3 + (i % 4) * 0.13), CELL * (0.45 + Math.floor(i / 4) * 0.1), 22, 14, i, 0, 7); c.fill(); }
  },
  pudding(c, p, m) {
    c.fillStyle = '#f6e6a8'; c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = '#8a4a2a'; c.fillRect(0, 0, CELL, CELL * 0.22);
    c.fillStyle = '#ffffff'; c.fillRect(0, CELL * 0.4, CELL, CELL * 0.3);
    fit(c, p.nameJa, CELL / 2, CELL * 0.55, CELL * 0.9, 34, '#8a4a2a');
  },
  cupnoodle(c, p, m) {
    PAINT.wrap(c, p, m, { liquid: '#f2f2ea' });
    c.fillStyle = hex(m.band); c.fillRect(0, 0, CELL, CELL * 0.22);
    for (const x of [CELL * 0.25, CELL * 0.75]) fit(c, 'ラーメン', x, CELL * 0.11, CELL * 0.4, 28, '#ffffff');
  },
  melonpan(c, p, m) {
    // the crust from above: the criss-cross, sugar, the bag's sticker
    c.fillStyle = '#f2d890'; c.fillRect(0, 0, CELL, CELL);
    c.strokeStyle = '#d8b060'; c.lineWidth = 6;
    for (let i = -4; i < 8; i++) { c.beginPath(); c.moveTo(i * 40, 0); c.lineTo(i * 40 + CELL, CELL); c.stroke(); c.beginPath(); c.moveTo(i * 40 + CELL, 0); c.lineTo(i * 40, CELL); c.stroke(); }
    c.fillStyle = hex(m.band); c.beginPath(); c.roundRect(CELL * 0.2, CELL * 0.36, CELL * 0.6, CELL * 0.28, 12); c.fill();
    fit(c, p.nameJa, CELL / 2, CELL * 0.5, CELL * 0.54, 34, '#ffffff');
  },
  plainSticker(c, p, m, bg) {
    c.fillStyle = bg; c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = hex(m.band); c.beginPath(); c.roundRect(CELL * 0.12, CELL * 0.34, CELL * 0.76, CELL * 0.32, 14); c.fill();
    fit(c, p.nameJa, CELL / 2, CELL * 0.5, CELL * 0.7, 36, '#ffffff');
  },
};

function paintCell(c, p) {
  const m = p.mesh;
  switch (m.shape) {
    case 'onigiri': return PAINT.onigiri(c, p, m);
    case 'bento': return PAINT.bento(c, p, m);
    case 'sandwich': return PAINT.sandwich(c, p, m);
    case 'pet': return PAINT.wrap(c, p, m);
    case 'codd': return PAINT.wrap(c, p, m, { liquid: '#bde4f2' });
    case 'can': return PAINT.wrap(c, p, m, { liquid: hex(m.body) });
    case 'cup': case 'odencup': case 'coffeecup': return PAINT.wrap(c, p, m, { liquid: hex(m.body) });
    case 'cupnoodle': return PAINT.cupnoodle(c, p, m);
    case 'pudding': return PAINT.pudding(c, p, m);
    case 'bag': return PAINT.bag(c, p, m);
    case 'slimbox': return PAINT.box(c, p, m, { vertical: true });
    case 'carton': case 'smallbox': case 'pouch': case 'tissue': case 'tray': case 'karaagebox': return PAINT.box(c, p, m);
    case 'melonpan': return PAINT.melonpan(c, p, m);
    default: return PAINT.plainSticker(c, p, m, hex(m.body));
  }
}

let atlas = null;
/** The product atlas and each product's cell index. */
export function labelAtlas() {
  if (atlas) return atlas;
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const c = cv.getContext('2d');
  const cellOf = {};
  CATALOG.forEach((p, i) => {
    const x = (i % N) * CELL, y = Math.floor(i / N) * CELL;
    seed = 1000 + i;
    c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, CELL, CELL); c.clip();
    paintCell(c, p);
    c.restore();
    cellOf[p.id] = i;
  });
  c.fillStyle = '#ffffff'; c.fillRect((WHITE % N) * CELL, Math.floor(WHITE / N) * CELL, CELL, CELL);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  atlas = { tex, cellOf };
  return atlas;
}

/** [u0, v0, u1, v1] of a cell (v up), inset so filtering never bleeds. */
export function cellRect(i, inset = 3) {
  const x = (i % N) * CELL, y = Math.floor(i / N) * CELL;
  return [(x + inset) / SIZE, 1 - (y + CELL - inset) / SIZE, (x + CELL - inset) / SIZE, 1 - (y + inset) / SIZE];
}

/* ------------------------------ price tags ------------------------------ */
const TW = 256, TH = 96, TC = 4, TR = 8;
let tags = null;
/** Shelf tags: white, the name small, the price in red, (税込). */
export function tagAtlas() {
  if (tags) return tags;
  const cv = document.createElement('canvas');
  cv.width = TW * TC; cv.height = TH * TR;
  const c = cv.getContext('2d');
  const cellOf = {};
  CATALOG.forEach((p, i) => {
    const x = (i % TC) * TW, y = Math.floor(i / TC) * TH;
    c.fillStyle = '#ffffff'; c.fillRect(x + 2, y + 2, TW - 4, TH - 4);
    c.fillStyle = '#e8453f'; c.fillRect(x + 2, y + 2, 10, TH - 4);
    fit(c, p.nameJa, x + TW / 2 + 5, y + 24, TW - 30, 22, '#333');
    fit(c, '¥' + p.priceYen, x + TW / 2 - 18, y + 62, 120, 44, '#d8342f');
    fit(c, '(税込)', x + TW - 42, y + 68, 60, 16, '#d8342f', 'normal');
    cellOf[p.id] = i;
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tags = { tex, cellOf, rect: (i) => { const x = (i % TC) * TW, y = Math.floor(i / TC) * TH; return [(x + 2) / (TW * TC), 1 - (y + TH - 2) / (TH * TR), (x + TW - 2) / (TW * TC), 1 - (y + 2) / (TH * TR)]; } };
  return tags;
}
