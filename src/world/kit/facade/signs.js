import * as THREE from 'three';
import { JP, JP_ROUND, JP_BRUSH } from '../tex.js';
import { SHOP_SIGNS, MENU_TAGS, SHOP_LETTERING, SWEET_TAGS } from '../../../data/town.js';

/* ------------------------------------------------------------------ *
 * Shopfront lettering and the painted rooms behind the glass
 * (town quality pass, facades).
 *
 *   fasciaTex(kind, aspect)     the board over the shop, in the trade's hand:
 *                               brush on a dark timber board for the old
 *                               trades, the rounded face on a white panel with
 *                               a round mark for the modern ones
 *   bladeTex(kind)              the vertical board bolted out over the walk
 *   valanceTex(kind, colour, aspect)   the name along an awning's drop
 *   roomTex(trade, inside), counterTex(trade, inside, aspect)
 *                               the room behind the glass as two painted
 *                               cards: its back wall, and a cut-out of what
 *                               stands in front of it (counter, shelf ends,
 *                               chairs).  Two cards a metre apart give the
 *                               glass real depth, with no furniture geometry.
 *
 * Every canvas is the size it is seen at: a fascia 768 x 96, a blade 96 x 352,
 * a card 256 x 128.  Boards of different proportions draw their text in a
 * virtual canvas as wide as the board, so letters never stretch.  The
 * merge pass packs all of them into the shared atlas pages.
 * ------------------------------------------------------------------ */

const cache = new Map();
function canvasTex(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

/** Seeded PRNG for the art, so a card never changes between loads. */
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
const hex = (c) => (typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c);
const INK = '#3a3346';

/** Text fitted into maxW at up to `size`, centred on (x, y) unless align says. */
function fit(c, str, x, y, maxW, size, color, face, { weight = 'bold', align = 'center', stroke = null, sw = 0 } = {}) {
  let s = size;
  for (; s > 6; s--) {
    c.font = `${weight} ${s}px ${face}`;
    if (c.measureText(str).width <= maxW) break;
  }
  c.textAlign = align;
  c.textBaseline = 'middle';
  if (stroke) { c.lineJoin = 'round'; c.lineWidth = sw; c.strokeStyle = stroke; c.strokeText(str, x, y); }
  c.fillStyle = color;
  c.fillText(str, x, y);
  return s;
}
/** Characters one under another, fitted to a column. */
function column(c, str, x, y0, y1, maxSize, color, face) {
  const ch = [...str.replace(/\s/g, '')];
  const step = Math.min(maxSize * 1.05, (y1 - y0) / Math.max(1, ch.length));
  const size = Math.floor(step * 0.94);
  c.font = `bold ${size}px ${face}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = color;
  const top = y0 + ((y1 - y0) - step * ch.length) / 2;
  ch.forEach((g, i) => {
    // long-vowel bars and dashes stand upright in a column
    if (g === 'ー' || g === '-') { c.fillRect(x - size * 0.06, top + step * i + step * 0.15, size * 0.12, step * 0.7); return; }
    c.fillText(g, x, top + step * (i + 0.5));
  });
}

/** How each trade letters itself (data/town.js SHOP_LETTERING): hand and board. */
const hand = (kind) => SHOP_LETTERING[kind] ?? { face: 'brush', board: 'panel' };
const faceOf = (kind) => (hand(kind).face === 'round' ? JP_ROUND : JP_BRUSH);
/** Board proportions round to a few buckets, so a street shares its signs. */
export const bucket = (a, steps = [7, 9.5, 12, 15]) => steps.reduce((b, s) => (Math.abs(s - a) < Math.abs(b - a) ? s : b), steps[0]);

/* ------------------------------ the fascia ------------------------------ */

export function fasciaTex(kind, aspect = 9.5) {
  const a = bucket(aspect);
  return canvasTex(`fascia:${kind}:${a}`, 768, 96, (c, W, H) => {
    const st = SHOP_SIGNS[kind] ?? SHOP_SIGNS.soba;
    const L = hand(kind);
    const face = faceOf(kind);
    const w = H * a;                           // the board's own width, in canvas units
    c.save();
    c.scale(W / w, 1);
    const r = rng(kind.length * 97 + a * 13);
    if (L.board === 'wood') {
      // a dark timber board: planks, a gilt-cream rule inset, brush lettering
      c.fillStyle = '#4e3a2c'; c.fillRect(0, 0, w, H);
      for (let i = 0; i < 9; i++) {
        c.fillStyle = `rgba(${r() < 0.5 ? '255,235,200' : '20,10,5'},${0.05 + r() * 0.06})`;
        c.fillRect(0, r() * H, w, 1 + r() * 3);
      }
      c.fillStyle = '#2c2019'; c.fillRect(0, H / 2 - 1, w, 2);          // the seam between two planks
      c.strokeStyle = '#d9c28e'; c.lineWidth = 3; c.strokeRect(7, 7, w - 14, H - 14);
      const size = fit(c, st.t, w * 0.5, H * 0.53, w * 0.72, 70, '#f4e8cc', face, { stroke: '#2a1d15', sw: 5 });
      // the maker's red seal after the name
      c.font = `bold ${size}px ${face}`;
      const tw = c.measureText(st.t).width;
      const sx = w * 0.5 + tw / 2 + 22;
      if (sx + 34 < w - 12) {
        c.fillStyle = '#c23a2e'; c.fillRect(sx, H / 2 - 17, 34, 34);
        fit(c, [...st.t][0], sx + 17, H / 2 + 1, 28, 26, '#f8eee0', JP_BRUSH);
      }
    } else if (L.board === 'round') {
      // a white panel, a coloured round mark, the name in the rounded face
      c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, H);
      c.fillStyle = hex(st.bar); c.fillRect(0, H - 12, w, 12);
      c.fillStyle = hex(st.bar); c.globalAlpha = 0.35; c.fillRect(0, 0, w, 4); c.globalAlpha = 1;
      const cx = w * 0.1 + 30;
      c.fillStyle = hex(st.bar);
      c.beginPath(); c.arc(cx, H * 0.45, 30, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = 3;
      c.beginPath(); c.arc(cx, H * 0.45, 24, 0, Math.PI * 2); c.stroke();
      const name = st.t.split(' ').pop();
      fit(c, [...name][0], cx, H * 0.47, 34, 32, '#ffffff', face);
      const size = fit(c, st.t, cx + 46, H * 0.42, w * 0.55, 58, st.fg, face, { align: 'left' });
      c.font = `bold ${size}px ${face}`;
      const tw = c.measureText(st.t).width;
      c.globalAlpha = 0.8;
      fit(c, st.en, cx + 46 + tw + 26, H * 0.34, w - (cx + tw + 90), 22, st.fg, JP, { align: 'left' });
      fit(c, st.s, cx + 46 + tw + 26, H * 0.62, w - (cx + tw + 90), 18, st.fg, JP, { align: 'left', weight: 500 });
      c.globalAlpha = 1;
    } else {
      // a painted panel with the trade's colour top and bottom
      c.fillStyle = st.bg; c.fillRect(0, 0, w, H);
      c.fillStyle = hex(st.bar); c.fillRect(0, 0, w, 7); c.fillRect(0, H - 14, w, 14);
      const size = fit(c, st.t, w * 0.42, H * 0.47, w * 0.6, 64, st.fg, face);
      c.font = `bold ${size}px ${face}`;
      const x = w * 0.42 + c.measureText(st.t).width / 2 + 30;
      c.globalAlpha = 0.75;
      fit(c, st.s, x, H * 0.47, w - x - 16, 20, st.fg, JP, { align: 'left', weight: 600 });
      c.globalAlpha = 1;
    }
    c.restore();
  });
}

/* --------------------------- the blade sign --------------------------- */

export function bladeTex(kind) {
  return canvasTex(`blade:${kind}`, 96, 352, (c, w, h) => {
    const st = SHOP_SIGNS[kind] ?? SHOP_SIGNS.soba;
    const L = hand(kind);
    const face = faceOf(kind);
    const name = st.t.split(' ').pop();
    if (L.board === 'wood') {
      c.fillStyle = '#f4ecda'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#4e3a2c'; c.fillRect(0, 0, w, 26); c.fillRect(0, h - 18, w, 18);
      column(c, name, w / 2, 36, h - 26, 70, st.fg, face);
    } else {
      // coloured ground, white letters, a white cap (the lit box kind)
      c.fillStyle = hex(st.bar); c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, 20);
      c.fillStyle = hex(st.bar); c.beginPath(); c.arc(w / 2, 10, 6, 0, Math.PI * 2); c.fill();
      column(c, name, w / 2, 30, h - 12, 70, '#ffffff', face);
    }
  });
}

/* ---------------------------- awning valance ---------------------------- */

export function valanceTex(kind, color, aspect) {
  const a = bucket(aspect, [20, 26, 32, 40]);
  return canvasTex(`valance:${kind}:${color}:${a}`, 1024, 40, (c, W, H) => {
    const st = SHOP_SIGNS[kind] ?? SHOP_SIGNS.soba;
    const w = H * a;
    c.save();
    c.scale(W / w, 1);
    c.fillStyle = hex(color); c.fillRect(0, 0, w, H);
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(0, 2, w, 2);
    const face = faceOf(kind);
    // on a pale canvas the lettering takes the trade's colour, not white
    const cc = new THREE.Color(color);
    const ink = cc.r * 0.3 + cc.g * 0.59 + cc.b * 0.11 > 0.7 ? st.fg : '#fbf7ee';
    const size = fit(c, st.t, w / 2, H * 0.55, w * 0.4, 28, ink, face);
    c.font = `bold ${size}px ${face}`;
    const tw = c.measureText(st.t).width;
    // the strapline on both sides of the name, as painted canvas always has
    for (const s of [-1, 1]) {
      fit(c, st.s, w / 2 + s * (tw / 2 + w * 0.14), H * 0.55, w * 0.22, 18, ink, JP, { weight: 600 });
    }
    c.restore();
  });
}

/* ------------------------- the room behind the glass ------------------------- */

const GOODS = {
  general: ['#d8504a', '#f2c23c', '#4f8fd0', '#6fb86a', '#f4f2ea', '#e8864a'],
  bakery: ['#d8a060', '#c07a3a', '#f0d09a', '#e8b878'],
  florist: ['#f28cb0', '#f2d24a', '#e85a5a', '#9fd07a', '#c090e0'],
  books: ['#4a6fa8', '#c84a4a', '#e8d8b0', '#5a8a5a', '#8a6aa0', '#f2f2ea'],
  hardware: ['#c84a4a', '#5a6a7a', '#f2c23c', '#4a8ac8', '#8a8a8a'],
  greengrocer: ['#6fb86a', '#e8453f', '#f2a03c', '#f2d24a', '#8a5a9a'],
  wagashi: ['#f4d8e0', '#9fc07a', '#f2f2ea', '#8a5a4a'],
};
const goodsOf = (trade) => GOODS[trade] ?? GOODS.general;

/** Rows of packets along a shelf line: the shop's stock at a glance. */
function stockRow(c, r, x0, x1, y, hMax, cols) {
  for (let x = x0; x < x1 - 4;) {
    const bw = 4 + r() * 9, bh = hMax * (0.45 + r() * 0.55);
    c.fillStyle = cols[Math.floor(r() * cols.length)];
    c.fillRect(x, y - bh, bw, bh);
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x, y - bh, 1.5, bh);
    x += bw + 1;
  }
  c.fillStyle = '#b8ab98'; c.fillRect(x0, y, x1 - x0, 3);
  for (let x = x0 + 6 + r() * 10; x < x1 - 8; x += 18 + r() * 20) {
    c.fillStyle = r() < 0.3 ? '#e8453f' : '#fff6c8'; c.fillRect(x, y + 1, 6, 4);
  }
}
/** A ceiling strip of fluorescent light, and its lit wash on the wall. */
function ceiling(c, w, h, tone = '#d9d2c6') {
  c.fillStyle = tone; c.fillRect(0, 0, w, 14);
  for (let x = w * 0.12; x < w - 20; x += w * 0.3) {
    c.fillStyle = '#fffbee'; c.fillRect(x, 4, w * 0.16, 5);
  }
  const g = c.createLinearGradient(0, 14, 0, 50);
  g.addColorStop(0, 'rgba(255,250,235,0.55)'); g.addColorStop(1, 'rgba(255,250,235,0)');
  c.fillStyle = g; c.fillRect(0, 14, w, 36);
}

/** The back wall, by what the shop keeps there. */
export function roomTex(trade, inside) {
  return canvasTex(`room:${trade}:${inside}`, 256, 128, (c, w, h) => {
    const r = rng(trade.length * 131 + inside.length * 7);
    const cols = goodsOf(trade);
    const floorY = h - 14;
    const wall = { chairs: '#e6eef0', machines: '#e4ecf2', tables: '#efe2cc', counter: '#efe4d0' }[inside] ?? '#f0e9dc';
    c.fillStyle = trade === 'dentist' ? '#e6f2ee' : wall; c.fillRect(0, 0, w, h);
    ceiling(c, w, h);
    c.fillStyle = '#c9bfae'; c.fillRect(0, floorY, w, h - floorY);           // the floor
    c.fillStyle = 'rgba(80,70,90,0.25)'; c.fillRect(0, floorY, w, 2);
    c.strokeStyle = INK; c.lineWidth = 1.5;
    if (inside === 'shelves') {
      // wall shelving floor to near ceiling, five rows of stock
      c.fillStyle = '#ddd3c2'; c.fillRect(4, 20, w - 8, floorY - 20);
      c.strokeRect(4, 20, w - 8, floorY - 20);
      for (let k = 0; k < 5; k++) stockRow(c, r, 8, w - 8, 38 + k * 18, 14, cols);
      // a hanging POP banner and a price card or two
      c.fillStyle = r() < 0.5 ? '#e8453f' : '#f2c23c'; c.fillRect(w * 0.32, 14, w * 0.36, 12);
      c.fillStyle = '#ffffff'; c.fillRect(w * 0.35, 18, w * 0.3, 3);
    } else if (inside === 'counter' && trade === 'dentist') {
      // a clinic: pale wall, a framed notice, a door through, a bench
      c.fillStyle = '#f7fbfa'; c.fillRect(w * 0.08, 30, 44, 34); c.strokeRect(w * 0.08, 30, 44, 34);
      c.fillStyle = '#2e9a78'; c.fillRect(w * 0.08 + 6, 36, 32, 5);
      c.fillStyle = '#b8c8c4'; c.fillRect(w * 0.62, 26, 40, floorY - 26); c.strokeRect(w * 0.62, 26, 40, floorY - 26);
      c.fillStyle = '#6a7a78'; c.fillRect(w * 0.62 + 32, 70, 3, 10);
      c.fillStyle = '#f4d86a'; c.fillRect(w * 0.36, 34, 26, 36); c.strokeRect(w * 0.36, 34, 26, 36);
    } else if (inside === 'counter') {
      // a noodle bar or a sweet shop: menu tags along the top, the kitchen shelf, a doorway
      c.fillStyle = '#6a4a34'; c.fillRect(0, 14, w, 30);
      const n = Math.min(MENU_TAGS.length, 8);
      for (let i = 0; i < n; i++) {
        const x = 8 + i * ((w - 16) / n);
        c.fillStyle = '#f2e6c8'; c.fillRect(x, 16, 20, 26);
        const tag = (trade === 'wagashi' ? SWEET_TAGS : MENU_TAGS)[i];
        column(c, (tag ?? '').slice(0, 3), x + 10, 18, 41, 8, '#2a1e18', JP);
      }
      c.fillStyle = '#9a7a58'; c.fillRect(8, 62, w * 0.6, 4);
      for (let x = 12; x < w * 0.6; x += 16) {
        c.fillStyle = cols[Math.floor(r() * cols.length)] ?? '#f2f2ea';
        c.beginPath(); c.ellipse(x + 6, 58, 7, 4, 0, 0, Math.PI * 2); c.fill();
      }
      // the doorway to the kitchen, its short noren
      c.fillStyle = '#3a3040'; c.fillRect(w * 0.7, 46, 46, floorY - 46);
      c.fillStyle = trade === 'wagashi' ? '#7a4a5a' : '#2f4a6a'; c.fillRect(w * 0.7 - 2, 46, 50, 18);
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(w * 0.7 + 15, 50, 2, 14); c.fillRect(w * 0.7 + 31, 50, 2, 14);
    } else if (inside === 'tables') {
      // a coffee shop: the back counter with its machine, shelves of cups, a picture, lamps
      c.fillStyle = '#6b4a34'; c.fillRect(0, 70, w, floorY - 70);
      c.fillStyle = '#8a6a4c'; c.fillRect(0, 68, w, 5);
      c.fillStyle = '#3c3a48'; c.fillRect(w * 0.55, 48, 24, 22);
      c.fillStyle = '#c8c0b0'; c.fillRect(w * 0.55 + 4, 52, 16, 6);
      for (let x = 12; x < w * 0.45; x += 12) { c.fillStyle = '#f6f2ea'; c.fillRect(x, 50, 8, 8); }
      c.fillStyle = '#9a7a58'; c.fillRect(8, 58, w * 0.42, 3);
      c.fillStyle = '#c8a070'; c.fillRect(w * 0.72, 26, 46, 30); c.strokeRect(w * 0.72, 26, 46, 30);
      c.fillStyle = '#7fa0c8'; c.fillRect(w * 0.72 + 4, 30, 38, 22);
      c.fillStyle = '#9fc07a'; c.beginPath(); c.moveTo(w * 0.72 + 4, 52); c.lineTo(w * 0.72 + 24, 36); c.lineTo(w * 0.72 + 42, 52); c.fill();
      for (const x of [w * 0.2, w * 0.45]) {
        c.fillStyle = '#3c3a48'; c.fillRect(x, 14, 1, 14);
        c.fillStyle = '#f2c86a'; c.beginPath(); c.arc(x, 32, 7, Math.PI, 0); c.fill();
      }
    } else if (inside === 'machines') {
      // stacked washers and dryers, their round doors
      const n = Math.max(4, Math.floor(w / 36));
      for (let i = 0; i < n; i++) {
        const x = 6 + i * ((w - 12) / n), bw = (w - 12) / n - 4;
        for (const [y0, y1] of [[24, 62], [64, floorY]]) {
          c.fillStyle = '#f6f8fa'; c.fillRect(x, y0, bw, y1 - y0 - 2); c.strokeRect(x, y0, bw, y1 - y0 - 2);
          c.fillStyle = '#4a5a6e'; c.beginPath(); c.arc(x + bw / 2, (y0 + y1) / 2, Math.min(bw, y1 - y0) * 0.3, 0, Math.PI * 2); c.fill();
          c.fillStyle = 'rgba(200,225,245,0.6)'; c.beginPath(); c.arc(x + bw / 2 - 2, (y0 + y1) / 2 - 2, Math.min(bw, y1 - y0) * 0.14, 0, Math.PI * 2); c.fill();
        }
      }
    } else if (inside === 'chairs') {
      // a barber's: mirrors in white frames, the shelf of bottles under them
      for (const x of [w * 0.12, w * 0.58]) {
        c.fillStyle = '#ffffff'; c.fillRect(x, 24, 76, 52); c.strokeRect(x, 24, 76, 52);
        c.fillStyle = '#b8d0e0'; c.fillRect(x + 5, 29, 66, 42);
        c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.moveTo(x + 12, 71); c.lineTo(x + 34, 29); c.lineTo(x + 42, 29); c.lineTo(x + 20, 71); c.fill();
        c.fillStyle = '#d8cfbe'; c.fillRect(x - 4, 78, 84, 5);
        for (let k = 0; k < 6; k++) { c.fillStyle = ['#4a8ac8', '#e8453f', '#f2c23c', '#f4f2ea'][k % 4]; c.fillRect(x + 4 + k * 12, 70, 6, 8); }
      }
    }
  });
}

/** What stands a metre behind the glass, cut out (alpha) against the room. */
export function counterTex(trade, inside, aspect) {
  const a = bucket(aspect, [2.5, 3.5, 4.5, 6]);
  return canvasTex(`counter:${trade}:${inside}:${a}`, 256, 96, (c, W, H) => {
    const r = rng(trade.length * 71 + a * 5);
    const cols = goodsOf(trade);
    const w = H * a;
    c.save();
    c.scale(W / w, 1);
    c.clearRect(0, 0, w, H);
    c.strokeStyle = INK; c.lineWidth = 2.5;
    const box = (x, y, bw, bh, fill) => { c.fillStyle = fill; c.fillRect(x, y, bw, bh); c.strokeRect(x, y, bw, bh); };
    if (inside === 'shelves') {
      // the ends of two island shelves and the till counter by the door
      for (const t of [0.22, 0.52]) {
        const x = w * t, bw = Math.min(70, w * 0.16);
        box(x, H * 0.18, bw, H * 0.82, '#e4dccd');
        for (let k = 0; k < 4; k++) {
          const y = H * 0.35 + k * H * 0.16;
          for (let xx = x + 4; xx < x + bw - 6;) { const gw = 5 + r() * 7; c.fillStyle = cols[Math.floor(r() * cols.length)]; c.fillRect(xx, y - 9 - r() * 3, gw, 9); xx += gw + 1; }
          c.fillStyle = '#b8ab98'; c.fillRect(x + 2, y, bw - 4, 2);
        }
        box(x + bw * 0.15, H * 0.05, bw * 0.7, H * 0.13, r() < 0.5 ? '#e8453f' : '#f2c23c');   // the aisle's POP card
      }
      box(w * 0.8, H * 0.45, w * 0.17, H * 0.55, '#d8cfc0');
      box(w * 0.84, H * 0.3, 20, 14, '#3c3a48');
    } else if (inside === 'counter' && trade === 'dentist') {
      box(w * 0.55, H * 0.4, w * 0.35, H * 0.6, '#f4faf6');
      c.fillStyle = '#2e9a78'; c.fillRect(w * 0.55, H * 0.48, w * 0.35, 5);
      box(w * 0.1, H * 0.62, w * 0.25, H * 0.16, '#6a9ab8');                       // the waiting bench
      c.fillStyle = '#6fa060'; c.beginPath(); c.arc(w * 0.44, H * 0.5, 14, 0, Math.PI * 2); c.fill(); c.stroke();
      box(w * 0.44 - 8, H * 0.62, 16, H * 0.38, '#b0703a');
    } else if (inside === 'counter') {
      // the long counter and a row of stools
      box(w * 0.06, H * 0.42, w * 0.88, H * 0.58, '#a88460');
      c.fillStyle = '#c8a47c'; c.fillRect(w * 0.05, H * 0.38, w * 0.9, 7); c.strokeRect(w * 0.05, H * 0.38, w * 0.9, 7);
      for (let x = w * 0.12; x < w * 0.9; x += w * 0.15) {
        c.fillStyle = '#7a4a4a'; c.beginPath(); c.ellipse(x, H * 0.7, 13, 5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = '#3c3a48'; c.fillRect(x - 2, H * 0.7, 4, H * 0.3);
      }
      if (trade === 'wagashi') {
        // the glass case of sweets on the counter
        box(w * 0.2, H * 0.14, w * 0.6, H * 0.24, 'rgba(220,235,245,0.9)');
        for (let x = w * 0.23; x < w * 0.78; x += 14) { c.fillStyle = cols[Math.floor(r() * cols.length)]; c.beginPath(); c.arc(x, H * 0.3, 5, 0, Math.PI * 2); c.fill(); }
      }
    } else if (inside === 'tables') {
      for (const t of [0.2, 0.5, 0.8]) {
        const x = w * t;
        c.fillStyle = '#8a6a4c'; c.fillRect(x - 26, H * 0.55, 52, 5); c.strokeRect(x - 26, H * 0.55, 52, 5);
        c.fillStyle = '#3c3a48'; c.fillRect(x - 2, H * 0.58, 4, H * 0.42);
        for (const s of [-1, 1]) box(x + s * 36 - 9, H * 0.42, 18, H * 0.58, '#7a4a4a');
        c.fillStyle = '#f6f2ea'; c.fillRect(x - 6, H * 0.49, 8, 6);
      }
    } else if (inside === 'machines') {
      box(w * 0.3, H * 0.55, w * 0.4, 7, '#a88460');
      c.fillStyle = '#3c3a48'; c.fillRect(w * 0.32, H * 0.6, 4, H * 0.4); c.fillRect(w * 0.68 - 4, H * 0.6, 4, H * 0.4);
      box(w * 0.05, H * 0.72, w * 0.2, H * 0.12, '#4a7aa8');
      c.fillStyle = '#e8e2d4'; c.fillRect(w * 0.4, H * 0.44, 22, 11);                  // a basket of washing
    } else if (inside === 'chairs') {
      for (const t of [0.26, 0.72]) {
        const x = w * t;
        box(x - 18, H * 0.2, 36, H * 0.3, '#7a4a4a');      // the chair's back
        box(x - 22, H * 0.5, 44, H * 0.14, '#7a4a4a');
        c.fillStyle = '#9aa0ac'; c.fillRect(x - 3, H * 0.64, 6, H * 0.3); c.fillRect(x - 16, H * 0.94, 32, H * 0.06);
      }
    }
    c.restore();
  });
}
