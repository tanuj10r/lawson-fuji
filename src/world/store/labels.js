import { CATALOG } from '../../data/catalog.js';
import { FOOD } from '../foodart.js';
import { makePage } from './pages.js';
import { SEEN } from './seen-data.js';
import { storeWhole } from './seen.js';

/* ------------------------------------------------------------------ *
 * Packaging, painted (SPEC 7; M3b).
 *
 * Atlas pages of 16 x 16 cells: a cell per product (its front, or its
 * wrap for bottles and cups), and one plain white on each page for every
 * unlabelled part (their colour comes from the vertex colours).  A
 * further page holds the shelf price tags.  All generic and ours.  The
 * pages are held at the size they are seen at (store/pages.js).
 * ------------------------------------------------------------------ */

const JP = `'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Yu Gothic', Meiryo, sans-serif`;
/* M3d: about 370 products, so the cells are 192 px on 3072 pages (255 a
 * page and a white cell); the painters still draw in a 256 box, scaled. */
const N = 16, PX = 192, SIZE = N * PX, CELL = 256;
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
/* What each sando's cut face shows: the filling's colour and what is set in it (x, y, r across the filling column; `cut` halves shine). */
const SANDO_FILL = {
  sando_egg: { base: '#f5d24a', bits: [[0.3, 0.25, 0.22, '#fbf3d8'], [0.7, 0.5, 0.2, '#fbf3d8'], [0.35, 0.72, 0.2, '#fbf3d8']] },
  fruit_sando: { base: '#fffdf6', cut: true, bits: [[0.5, 0.2, 0.4, '#e8455a'], [0.5, 0.44, 0.38, '#f2a030'], [0.5, 0.66, 0.38, '#8cc84a']] },
  fruit_sando_ichigo: { base: '#fffdf6', cut: true, bits: [[0.5, 0.2, 0.4, '#e8455a'], [0.5, 0.44, 0.4, '#e8455a'], [0.5, 0.68, 0.4, '#e8455a']] },
  ham_sando: { base: '#f0a0a0', bits: [[0.5, 0.3, 0.35, '#7ac04a'], [0.5, 0.65, 0.3, '#fbf3d8']] },
  sando_katsu: { base: '#b8743a', bits: [[0.5, 0.5, 0.35, '#8a4a2a']] },
  sando_tuna: { base: '#efe2c4', bits: [[0.4, 0.35, 0.2, '#d8c49a'], [0.6, 0.65, 0.2, '#d8c49a']] },
  sando_mix: { base: '#f5d24a', bits: [[0.5, 0.3, 0.35, '#f0a0a0'], [0.5, 0.7, 0.3, '#7ac04a']] },
  sando_blt: { base: '#f0a0a0', bits: [[0.5, 0.3, 0.35, '#d8342f'], [0.5, 0.68, 0.32, '#7ac04a']] },
  default: { base: '#efe2c4', bits: [] },
};
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
  sandwich(c, p, m) { PAINT.sandoPack(c, p, m); },
  /* The sando pack's front (Tan's photo of the real thing): through the
   * clear film, two crustless halves standing side by side, each cut face
   * a column of filling between two white slices; the shop's label band
   * across the lower half; a highlight down the film. */
  sandoPack(c, p, m) {
    c.fillStyle = '#e9eef3'; c.fillRect(0, 0, CELL, CELL);
    const F = SANDO_FILL[p.id] ?? SANDO_FILL.default;
    const pad = CELL * 0.05, gap = CELL * 0.03, w = (CELL - pad * 2 - gap) / 2, top = CELL * 0.07, h = CELL * 0.88;
    for (let k = 0; k < 2; k++) {
      const x = pad + k * (w + gap);
      // the two slices: soft white bread, a faint crumb
      c.fillStyle = '#fbf6ea'; c.beginPath(); c.roundRect(x, top, w, h, 10); c.fill();
      c.fillStyle = 'rgba(214,190,150,0.35)';
      for (let i = 0; i < 40; i++) { c.fillRect(x + ((i * 37) % 97) / 97 * w, top + ((i * 53) % 89) / 89 * h, 2, 2); }
      // the filling between them
      const fx = x + w * 0.3, fw = w * 0.4;
      c.fillStyle = F.base; c.beginPath(); c.roundRect(fx, top + 6, fw, h - 12, 8); c.fill();
      for (const [dx, dy, r, col] of F.bits) {
        const cx = fx + fw * dx, cy = top + h * dy, R = fw * r;
        if (F.cut && col === '#e8455a') {
          // a strawberry halved lengthwise: a heart of red, its pale core, the seeds' dots
          c.fillStyle = col;
          c.beginPath(); c.moveTo(cx, cy + R * 1.05);
          c.bezierCurveTo(cx - R * 1.25, cy + R * 0.2, cx - R * 0.9, cy - R * 1.0, cx, cy - R * 0.8);
          c.bezierCurveTo(cx + R * 0.9, cy - R * 1.0, cx + R * 1.25, cy + R * 0.2, cx, cy + R * 1.05); c.fill();
          c.fillStyle = '#fbd4d8'; c.beginPath(); c.ellipse(cx, cy - R * 0.05, R * 0.38, R * 0.6, 0, 0, 7); c.fill();
          c.fillStyle = '#b82a3c'; for (const [sx, sy] of [[-0.7, -0.2], [0.7, -0.2], [-0.5, 0.45], [0.5, 0.45]]) c.fillRect(cx + R * sx - 1, cy + R * sy - 1, 2, 2);
        } else {
          c.fillStyle = col; c.beginPath(); c.ellipse(cx, cy, R, R * 0.85, 0, 0, 7); c.fill();
          if (F.cut) { c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(cx, cy, R * 0.35, R * 0.3, 0, 0, 7); c.fill(); }
        }
      }
    }
    // the label band across the lower half: the name, the price
    const by = CELL * 0.8, bh = CELL * 0.18;          // the band at the foot: the cut face stays clear
    c.fillStyle = hex(m.band); c.fillRect(0, by, CELL, bh);
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(0, by + bh - 6, CELL, 3);
    fit(c, p.nameJa, CELL / 2, by + bh * 0.42, CELL * 0.86, 36, '#ffffff');
    fit(c, '¥' + p.priceYen, CELL / 2, by + bh * 0.8, CELL * 0.4, 20, '#ffffff');
    // the film: a soft highlight down one side, and its crimped edge at the top
    const g = c.createLinearGradient(0, 0, CELL, 0);
    g.addColorStop(0.08, 'rgba(255,255,255,0)'); g.addColorStop(0.14, 'rgba(255,255,255,0.45)'); g.addColorStop(0.22, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = 'rgba(200,212,224,0.8)'; c.fillRect(0, 0, CELL, CELL * 0.04);
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
    for (const x of [CELL * 0.25, CELL * 0.75]) fit(c, m.word ?? 'ラーメン', x, CELL * 0.11, CELL * 0.4, 28, '#ffffff');
  },
  melonpan(c, p, m) {
    // the crust from above: the criss-cross, sugar, the bag's sticker
    c.fillStyle = '#f2d890'; c.fillRect(0, 0, CELL, CELL);
    c.strokeStyle = '#d8b060'; c.lineWidth = 6;
    for (let i = -4; i < 8; i++) { c.beginPath(); c.moveTo(i * 40, 0); c.lineTo(i * 40 + CELL, CELL); c.stroke(); c.beginPath(); c.moveTo(i * 40 + CELL, 0); c.lineTo(i * 40, CELL); c.stroke(); }
    c.fillStyle = hex(m.band); c.beginPath(); c.roundRect(CELL * 0.2, CELL * 0.36, CELL * 0.6, CELL * 0.28, 12); c.fill();
    fit(c, p.nameJa, CELL / 2, CELL * 0.5, CELL * 0.54, 34, '#ffffff');
  },
  /* ---- M3b.2 ---- */
  ion(c, p, m) {
    // white, a deep-blue wave across it, the name in blue: the colour language
    // of an ion drink, never its design
    c.fillStyle = '#f6f9fc'; c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = hex(m.band);
    c.beginPath(); c.moveTo(0, CELL * 0.62);
    for (let x = 0; x <= CELL; x += 8) c.lineTo(x, CELL * 0.62 + Math.sin(x / CELL * Math.PI * 4) * 12);
    c.lineTo(CELL, CELL); c.lineTo(0, CELL); c.fill();
    for (const x of [CELL * 0.25, CELL * 0.75]) {
      fit(c, p.nameJa, x, CELL * 0.42, CELL * 0.46, 30, hex(m.band));
      fit(c, 'ION WATER', x, CELL * 0.82, CELL * 0.4, 16, '#ffffff', 'normal');
    }
  },
  strong(c, p, m) {
    // a silver can, a big lemon, the strength in a bold number
    c.fillStyle = '#d8dce4'; c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(CELL * 0.1, 0, CELL * 0.06, CELL);
    for (const x of [CELL * 0.25, CELL * 0.75]) {
      c.fillStyle = m.fruit ?? '#f2d02a'; c.beginPath(); c.ellipse(x, CELL * 0.36, 34, 26, 0, 0, 7); c.fill();
      c.strokeStyle = '#6a8a2a'; c.lineWidth = 3; c.stroke();
      fit(c, m.abv ?? '9%', x, CELL * 0.62, CELL * 0.44, 50, '#1a1a24');
      fit(c, p.nameJa.replace(/ ?\d+%$/, ''), x, CELL * 0.8, CELL * 0.46, 20, '#1a1a24');
    }
  },
  nine(c, p, m) {
    // Strong Nine: a brushed-silver can, a big lemon cut open, the 9 huge in
    // the store's own colours, STRONG NINE running up the side (twice round)
    const g = c.createLinearGradient(0, 0, CELL, 0);
    for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, i % 2 ? '#f4f6fa' : '#b8bec8');
    c.fillStyle = g; c.fillRect(0, 0, CELL, CELL);
    for (const x of [CELL * 0.25, CELL * 0.75]) {
      // the lemon, halved: rind, pith, segments
      c.fillStyle = '#f2d02a'; c.beginPath(); c.arc(x, CELL * 0.3, 34, 0, 7); c.fill();
      c.fillStyle = '#fbf2b0'; c.beginPath(); c.arc(x, CELL * 0.3, 27, 0, 7); c.fill();
      c.strokeStyle = '#f2d02a'; c.lineWidth = 3;
      for (let k = 0; k < 8; k++) { c.beginPath(); c.moveTo(x, CELL * 0.3); c.lineTo(x + Math.cos(k * 0.785) * 26, CELL * 0.3 + Math.sin(k * 0.785) * 26); c.stroke(); }
      // the number, in a deep blue with a lemon keyline
      c.font = `900 118px ${JP}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 8; c.strokeStyle = '#f2d02a'; c.strokeText('9', x - 8, CELL * 0.66);
      c.fillStyle = '#1e3a8a'; c.fillText('9', x - 8, CELL * 0.66);
      fit(c, '%', x + 38, CELL * 0.74, 30, 34, '#1e3a8a');
      fit(c, 'STRONG NINE', x, CELL * 0.9, CELL * 0.46, 22, '#1a1a24');
    }
    c.fillStyle = '#1e3a8a'; c.fillRect(0, 0, CELL, CELL * 0.07);
  },
  wafer(c, p, m) {
    // Choco Wafer Jumbo's wrapper: chocolate brown, the wafer's grid in a
    // window, a gold band with JUMBO.  The face is 1.8 times wider than tall,
    // so it is drawn in a squeezed frame (VW wide) and comes out true.
    c.fillStyle = hex(m.body); c.fillRect(0, 0, CELL, CELL);
    const k = 0.068 / 0.124, VW = CELL / k;
    c.save(); c.scale(k, 1);
    c.fillStyle = '#c89048'; c.beginPath(); c.roundRect(VW * 0.06, CELL * 0.26, VW * 0.42, CELL * 0.5, 18); c.fill();
    c.strokeStyle = '#a06a30'; c.lineWidth = 5;
    for (let i = 1; i < 6; i++) { const x = VW * (0.06 + i * 0.42 / 6); c.beginPath(); c.moveTo(x, CELL * 0.26); c.lineTo(x, CELL * 0.76); c.stroke(); }
    for (let i = 1; i < 4; i++) { const y = CELL * (0.26 + i * 0.125); c.beginPath(); c.moveTo(VW * 0.06, y); c.lineTo(VW * 0.48, y); c.stroke(); }
    c.fillStyle = '#f6ecd6'; c.fillRect(VW * 0.06, CELL * 0.49, VW * 0.42, CELL * 0.05);      // the ice between the wafers
    fit(c, 'チョコ', VW * 0.74, CELL * 0.3, VW * 0.4, 58, '#f6ecd6');
    fit(c, 'ウエハース', VW * 0.74, CELL * 0.5, VW * 0.44, 50, '#f6ecd6');
    c.fillStyle = hex(m.band); c.beginPath(); c.roundRect(VW * 0.54, CELL * 0.64, VW * 0.4, CELL * 0.22, 12); c.fill();
    fit(c, 'JUMBO', VW * 0.74, CELL * 0.76, VW * 0.36, 52, '#4a2a1c');
    c.restore();
    c.fillStyle = hex(m.band); c.fillRect(0, 0, CELL, CELL * 0.08); c.fillRect(0, CELL * 0.92, CELL, CELL * 0.08);
  },
  fruitsando(c, p, m) { PAINT.sandoPack(c, p, m); },
  sweets(c, p, m) {
    // a clear lid over the cake, a gold band with the name
    c.fillStyle = hex(m.body); c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(0, 0, CELL * 0.2, CELL);
    c.fillStyle = hex(m.band); c.fillRect(0, CELL * 0.68, CELL, CELL * 0.32);
    fit(c, p.nameJa, CELL / 2, CELL * 0.8, CELL * 0.92, 30, '#f2e0a0');
    fit(c, '¥' + p.priceYen, CELL / 2, CELL * 0.93, CELL * 0.5, 16, '#ffffff', 'normal');
  },
  icelid(c, p, m) {
    // a premium cup's lid from above: a deep colour, a gold ring, the name
    c.fillStyle = hex(m.band); c.fillRect(0, 0, CELL, CELL);
    c.strokeStyle = '#d8b060'; c.lineWidth = 6; c.beginPath(); c.arc(CELL / 2, CELL / 2, CELL * 0.4, 0, 7); c.stroke();
    fit(c, p.nameJa, CELL / 2, CELL * 0.46, CELL * 0.7, 36, '#f6ecd0');
    fit(c, 'PREMIUM', CELL / 2, CELL * 0.62, CELL * 0.5, 18, '#d8b060', 'normal');
  },
  wrapper(c, p, m) {
    // an ice bar's wrapper, lying flat: bold colour, the name large
    c.fillStyle = hex(m.band); c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = hex(m.body); c.beginPath(); c.roundRect(CELL * 0.2, CELL * 0.14, CELL * 0.6, CELL * 0.72, 30); c.fill();
    vfit(c, p.nameJa, CELL / 2, CELL * 0.18, CELL * 0.82, 40, '#ffffff');
  },
  fruitcup(c, p, m) {
    // a clear cup of cut frozen fruit, the name on a band
    c.fillStyle = '#e8f0f4'; c.fillRect(0, 0, CELL, CELL);
    for (let i = 0; i < 28; i++) { c.fillStyle = hex(m.body); c.globalAlpha = 0.8; c.fillRect(rnd() * CELL, CELL * 0.4 + rnd() * CELL * 0.55, 26, 22); }
    c.globalAlpha = 1;
    c.fillStyle = hex(m.band); c.fillRect(0, CELL * 0.14, CELL, CELL * 0.22);
    for (const x of [CELL * 0.25, CELL * 0.75]) fit(c, p.nameJa.replace('スムージー', '').replace('アイスコーヒー用', 'ICE'), x, CELL * 0.25, CELL * 0.44, 28, '#ffffff');
  },
  bottleFront(c, p, m) {
    // a paper label on a glass bottle, cream, the name set like calligraphy
    c.fillStyle = hex(m.body); c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = hex(m.band); c.fillRect(CELL * 0.14, CELL * 0.3, CELL * 0.72, CELL * 0.5);
    vfit(c, p.nameJa.split(' ')[0], CELL / 2, CELL * 0.33, CELL * 0.77, 38, hex(m.body) === '#3a1a24' ? '#3a1a24' : '#1a1a20');
  },
  /* ---- M3d: medicine, cosmetics, daily goods, more snacks ---- */
  medicine(c, p, m) {
    // a pharmacy box: white, a coloured band, the name, the class of drug
    c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = hex(m.band); c.fillRect(0, 0, CELL, CELL * 0.28);
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(CELL * 0.82, CELL * 0.14, 22, 0, 7); c.fill();
    c.fillStyle = hex(m.band); c.fillRect(CELL * 0.82 - 5, CELL * 0.14 - 14, 10, 28); c.fillRect(CELL * 0.82 - 14, CELL * 0.14 - 5, 28, 10);
    fit(c, p.nameJa, CELL / 2, CELL * 0.46, CELL * 0.9, 38, '#1a1a24');
    fit(c, p.nameEn, CELL / 2, CELL * 0.62, CELL * 0.88, 18, '#555', 'normal');
    if (m.cls) {
      c.strokeStyle = '#d8342f'; c.lineWidth = 3; c.strokeRect(CELL * 0.12, CELL * 0.76, CELL * 0.76, CELL * 0.16);
      fit(c, `第${m.cls}類医薬品`, CELL / 2, CELL * 0.84, CELL * 0.7, 22, '#d8342f');
    } else fit(c, 'SUPPLEMENT', CELL / 2, CELL * 0.84, CELL * 0.7, 20, hex(m.band), 'normal');
  },
  cosme(c, p, m) {
    // soft and minimal: a pale ground, a fine rule, thin type, a small mark
    c.fillStyle = hex(m.body); c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = hex(m.band); c.globalAlpha = 0.25; c.fillRect(0, CELL * 0.72, CELL, CELL * 0.28); c.globalAlpha = 1;
    c.strokeStyle = hex(m.band); c.lineWidth = 2; c.beginPath(); c.moveTo(CELL * 0.2, CELL * 0.3); c.lineTo(CELL * 0.8, CELL * 0.3); c.stroke();
    c.beginPath(); c.arc(CELL / 2, CELL * 0.17, 14, 0, 7); c.stroke();
    const dark = (m.body >> 16) < 0x60;
    fit(c, p.nameJa, CELL / 2, CELL * 0.46, CELL * 0.86, 30, dark ? '#f2f2f6' : '#3a3350', '500');
    fit(c, p.nameEn.toUpperCase(), CELL / 2, CELL * 0.6, CELL * 0.84, 14, hex(m.band), 'normal');
  },
  card(c, p, m) {
    // a hanging card: a coloured header with its peg hole, the goods in a clear bubble
    const tech = m.style === 'tech';
    c.fillStyle = tech ? '#f6f6f2' : '#ffffff'; c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = hex(m.band); c.fillRect(0, 0, CELL, CELL * 0.3);
    c.fillStyle = '#2a2a30'; c.beginPath(); c.ellipse(CELL / 2, CELL * 0.08, 16, 7, 0, 0, 7); c.fill();
    fit(c, p.nameJa, CELL / 2, CELL * 0.21, CELL * 0.9, 26, '#ffffff');
    c.fillStyle = 'rgba(200,220,235,0.55)'; c.beginPath(); c.roundRect(CELL * 0.2, CELL * 0.38, CELL * 0.6, CELL * 0.42, 18); c.fill();
    c.fillStyle = hex(m.body === 0xf6f6f2 ? m.band : m.body); c.beginPath(); c.roundRect(CELL * 0.3, CELL * 0.46, CELL * 0.4, CELL * 0.26, 10); c.fill();
    fit(c, p.nameEn, CELL / 2, CELL * 0.9, CELL * 0.88, 16, '#333', 'normal');
  },
  wear(c, p, m) {
    // clothes in a card sleeve: the colour of the goods, a band with the name
    c.fillStyle = hex(m.body); c.fillRect(0, 0, CELL, CELL);
    for (let y = 0; y < CELL; y += 14) { c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(0, y, CELL, 6); }
    c.fillStyle = '#fbfbf8'; c.fillRect(0, CELL * 0.1, CELL, CELL * 0.3);
    c.fillStyle = hex(m.band); c.fillRect(0, CELL * 0.1, CELL * 0.06, CELL * 0.3);
    fit(c, p.nameJa, CELL / 2, CELL * 0.22, CELL * 0.84, 32, '#2a2a30');
    fit(c, p.nameEn.toUpperCase(), CELL / 2, CELL * 0.34, CELL * 0.8, 14, '#555', 'normal');
  },
  bread(c, p, m) {
    // a clear bag: the bread's colour, a sticker with the name
    c.fillStyle = '#f2f4f6'; c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = hex(m.body); c.beginPath(); c.ellipse(CELL / 2, CELL * 0.58, CELL * 0.42, CELL * 0.3, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.ellipse(CELL * 0.4, CELL * 0.5, CELL * 0.2, CELL * 0.08, -0.3, 0, 7); c.fill();
    c.fillStyle = hex(m.band); c.beginPath(); c.roundRect(CELL * 0.1, CELL * 0.08, CELL * 0.8, CELL * 0.22, 14); c.fill();
    fit(c, p.nameJa, CELL / 2, CELL * 0.19, CELL * 0.74, 32, '#ffffff');
  },
  senbei(c, p, m) {
    // a tall bag of crackers: the crackers stacked in a window, the name down the side
    c.fillStyle = hex(m.band); c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = hex(m.body); c.fillRect(CELL * 0.3, CELL * 0.08, CELL * 0.62, CELL * 0.84);
    for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#c89048' : '#b87838'; c.beginPath(); c.ellipse(CELL * 0.61, CELL * (0.22 + i * 0.19), 52, 22, 0, 0, 7); c.fill(); }
    vfit(c, p.nameJa, CELL * 0.15, CELL * 0.06, CELL * 0.94, 34, '#ffffff');
  },
  bar(c, p, m) {
    // a chocolate bar's wrapper: its colour, a stripe, the name large
    c.fillStyle = hex(m.body); c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = hex(m.band); c.fillRect(0, CELL * 0.62, CELL, CELL * 0.14);
    fit(c, p.nameJa, CELL / 2, CELL * 0.36, CELL * 0.9, 40, hex(m.band));
    fit(c, p.nameEn, CELL / 2, CELL * 0.86, CELL * 0.86, 18, '#ffffff', 'normal');
  },
  plainSticker(c, p, m, bg) {
    c.fillStyle = bg; c.fillRect(0, 0, CELL, CELL);
    c.fillStyle = hex(m.band); c.beginPath(); c.roundRect(CELL * 0.12, CELL * 0.34, CELL * 0.76, CELL * 0.32, 14); c.fill();
    fit(c, p.nameJa, CELL / 2, CELL * 0.5, CELL * 0.7, 36, '#ffffff');
  },
};

function paintCell(c, p) {
  const m = p.mesh;
  if (m.style === 'medicine') return PAINT.medicine(c, p, m);
  if (m.style === 'cosme' && m.shape !== 'card') return PAINT.cosme(c, p, m);
  if (m.style === 'wear') return PAINT.wear(c, p, m);
  if (m.style === 'bread') return PAINT.bread(c, p, m);
  if (m.style === 'senbei') return PAINT.senbei(c, p, m);
  switch (m.shape) {
    case 'card': return PAINT.card(c, p, m);
    case 'bar': return PAINT.bar(c, p, m);
    case 'box': return PAINT.box(c, p, m, { vertical: m.h > m.w * 1.8 });
    case 'tin': return PAINT.wrap(c, p, m, { liquid: '#d8dce4' });
    case 'minibottle': return PAINT.wrap(c, p, m, { liquid: hex(m.body) });
    case 'tube': case 'pump': case 'compact': return PAINT.cosme(c, p, m);
    case 'onigiri': return PAINT.onigiri(c, p, m);
    case 'bento': return PAINT.bento(c, p, m);
    case 'sandwich': return PAINT.sandwich(c, p, m);
    case 'pet': case 'pet2l': return m.wave ? PAINT.ion(c, p, m) : PAINT.wrap(c, p, m);
    case 'tallcan': case 'slimcan': return m.nine ? PAINT.nine(c, p, m) : m.strong ? PAINT.strong(c, p, m) : PAINT.wrap(c, p, m, { liquid: hex(m.body) });
    case 'wafer': return PAINT.wafer(c, p, m);
    case 'sakecup': return PAINT.wrap(c, p, m, { liquid: '#e8f0f4' });
    case 'whisky': case 'wine': return PAINT.bottleFront(c, p, m);
    case 'fruitsando': return PAINT.fruitsando(c, p, m);
    case 'rollcake': case 'creampuff': case 'cakewedge': return PAINT.sweets(c, p, m);
    case 'icecup': return PAINT.icelid(c, p, m);
    case 'icebar': case 'mochi': return PAINT.wrapper(c, p, m);
    case 'fruitcup': return PAINT.fruitcup(c, p, m);
    case 'sixpack': case 'multipack': case 'milk1l': case 'icebag': return PAINT.box(c, p, m);
    case 'codd': return PAINT.wrap(c, p, m, { liquid: '#bde4f2' });
    case 'can': return PAINT.wrap(c, p, m, { liquid: hex(m.body) });
    case 'cup': case 'odencup': case 'coffeecup': return PAINT.wrap(c, p, m, { liquid: hex(m.body) });
    case 'cupnoodle': return PAINT.cupnoodle(c, p, m);
    case 'pudding': return PAINT.pudding(c, p, m);
    case 'bag': return PAINT.bag(c, p, m);
    case 'slimbox': return PAINT.box(c, p, m, { vertical: true });
    case 'smallbox': return PAINT.box(c, p, m, { vertical: (m.h ?? 0.075) > (m.w ?? 0.1) * 1.8 });
    case 'carton': case 'pouch': case 'tissue': case 'tray': case 'karaagebox': return PAINT.box(c, p, m);
    case 'melonpan': return PAINT.melonpan(c, p, m);
    default: return PAINT.plainSticker(c, p, m, hex(m.body));
  }
}

/**
 * The catalogue in pages: [{ list, level }].  With no measurement, in order, `per` a page.  With one
 * (store/seen.js), the products are grouped by the smallest mipmap their page can be from afar (`levels`:
 * a digit a product, in catalogue order; 2 and up share a page), so a few things seen large from the
 * street do not keep every label large.  How the pages are laid out never changes what is drawn; the
 * levels themselves are only used on the store they were measured on (store/planogram.js).
 */
function inPages(levels, per, nears = null) {
  const ok = !storeWhole && SEEN && SEEN.catalog === CATALOG.length && levels?.length === CATALOG.length;
  /* `nears` (the labels: seen-data labelNear): the level a product's page can be at the store itself, now that
   * the view is the visit's until you are outside (Tan, 2026-10-02) and most labels are never come close to.
   * Grouped by both, the near level first: a page is { near, level (from afar, never sharper than near) }. */
  const both = ok && nears?.length === CATALOG.length;
  const key = (i) => { const n = both ? Math.min(2, +nears[i]) : 0; return [n, Math.max(n, Math.min(2, +levels[i]))]; };
  const groups = [];
  if (ok) for (const n of both ? [0, 1, 2] : [0]) for (const L of [0, 1, 2]) {
    if (L < n) continue;
    groups.push({ level: L, near: n, list: CATALOG.filter((p, i) => { const k = key(i); return k[0] === n && k[1] === L; }) });
  } else groups.push({ level: 0, near: 0, list: CATALOG });
  const out = [];
  for (const g of groups) for (let i = 0; i < g.list.length; i += per) out.push({ level: g.level, near: g.near, list: g.list.slice(i, i + per) });
  return out;
}
const INDEX = Object.fromEntries(CATALOG.map((p, i) => [p.id, i]));

let atlas = null;
/**
 * The product atlas: pages 16 cells across, a white cell after the last product of each, only as tall
 * as its rows (store/pages.js holds each at the size it is seen at; `page.want` is the level it can be
 * from afar, `page.wantNear` at the store).  `cellOf[id]` is { page, cell }, `rect(id)` its cell and `white(id)` the white cell of
 * its page, as [u0, v0, u1, v1].
 */
export function labelAtlas() {
  if (atlas) return atlas;
  const pages = [], cellOf = {};
  const k = PX / CELL;
  // a page is at most 11 rows (3072 x 2112: its upload is one frame's hitch as you walk up, so it is kept
  // short); with no measurement, 255 products a page as it always was
  inPages(SEEN?.labelLevel, SEEN?.labelLevel ? 11 * N - 1 : N * N - 1, SEEN?.labelNear).forEach(({ list, level, near }, pg) => {
    list.forEach((p, i) => { cellOf[p.id] = { page: pg, cell: i }; });
    const page = makePage({
      name: 'labels-' + pg, w: SIZE, h: Math.ceil((list.length + 1) / N) * PX, steps: list.length + 1,
      // cells `from` to `to`; the one after the last product is the white cell
      paint(c, from, to) {
        for (let i = from; i < to; i++) {
          const x = (i % N) * PX, y = Math.floor(i / N) * PX;
          if (i === list.length) { c.fillStyle = '#ffffff'; c.fillRect(x, y, PX, PX); continue; }
          seed = 1000 + INDEX[list[i].id];
          c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, PX, PX); c.clip();
          c.scale(k, k);
          paintCell(c, list[i]);
          c.restore();
        }
      },
    });
    page.white = list.length;
    page.want = level;
    page.wantNear = near;
    pages.push(page);
  });
  /** [u0, v0, u1, v1] of a cell (v up), inset so filtering never bleeds. */
  const rectOf = (pg, i, inset = 3) => {
    const x = (i % N) * PX, y = Math.floor(i / N) * PX, h = pages[pg].h;
    return [(x + inset) / SIZE, 1 - (y + PX - inset) / h, (x + PX - inset) / SIZE, 1 - (y + inset) / h];
  };
  atlas = {
    pages, cellOf,
    rect: (id, inset) => rectOf(cellOf[id].page, cellOf[id].cell, inset),
    white: (id, inset) => rectOf(cellOf[id].page, pages[cellOf[id].page].white, inset),
  };
  return atlas;
}

/* ------------------------------ price tags ------------------------------ */
const TW = 256, TH = 96, TC = 8;
/** A price tag's texels a metre (256 across its 0.1 m: store/planogram.js TAG_W). */
export const TAG_TPM = TW / 0.1;
let tags = null;
/**
 * Shelf tags: white, the name small, the price in red, (税込).  `pageOf(id)` is the page a product's
 * tag is on (what its material reads) and `rect(id)` its place there.  A tag is ten centimetres: only
 * the few you pass close to are ever seen at their whole 256 texels, and those have a page of their own.
 */
export function tagAtlas() {
  if (tags) return tags;
  const at = {};
  // (160 tags a page at most: a page's upload is one frame's hitch as you walk up)
  const pages = inPages(SEEN?.tagLevel, SEEN?.tagLevel ? 160 : Infinity).filter((g) => g.list.length).map(({ list, level }, pg) => {
    const rows = Math.ceil(list.length / TC);
    list.forEach((p, i) => { at[p.id] = { pg, i, rows }; });
    const page = makePage({
      name: 'tags-' + pg, w: TW * TC, h: TH * rows, steps: list.length,
      paint(c, from, to) {
        list.slice(from, to).forEach((p, k) => {
          const i = from + k;
          const x = (i % TC) * TW, y = Math.floor(i / TC) * TH;
          c.fillStyle = '#ffffff'; c.fillRect(x + 2, y + 2, TW - 4, TH - 4);
          c.fillStyle = '#e8453f'; c.fillRect(x + 2, y + 2, 10, TH - 4);
          fit(c, p.nameJa, x + TW / 2 + 5, y + 24, TW - 30, 22, '#333');
          fit(c, '¥' + p.priceYen, x + TW / 2 - 18, y + 62, 120, 44, '#d8342f');
          fit(c, '(税込)', x + TW - 42, y + 68, 60, 16, '#d8342f', 'normal');
        });
      },
    });
    page.want = level;
    // from afar: the sharpest any of its tags is ever sampled at (seen-data tagFar), never under its near level
    page.wantFar = SEEN?.tagFar?.length === CATALOG.length ? Math.max(level, Math.min(...list.map((p) => +SEEN.tagFar[INDEX[p.id]]))) : level;
    return page;
  });
  tags = {
    pages,
    pageOf: (id) => pages[at[id].pg],
    rect: (id) => { const { i, rows } = at[id], x = (i % TC) * TW, y = Math.floor(i / TC) * TH; return [(x + 2) / (TW * TC), 1 - (y + TH - 2) / (TH * rows), (x + TW - 2) / (TW * TC), 1 - (y + 2) / (TH * rows)]; },
  };
  return tags;
}
