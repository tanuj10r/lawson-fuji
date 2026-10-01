import * as THREE from 'three';
import { JP, JP_BRUSH, JP_ROUND } from '../kit/tex.js';
import { PETTAN } from '../../data/town.js';

/* ------------------------------------------------------------------ *
 * ぺったん堂's signs, drawn with Canvas2D (AGENTS.md), each the size it is
 * seen at: the roof board 384 x 96, the noren 384 x 96, a flag 64 x 256,
 * the price card 128 x 96.  The static ones are packed into the town's
 * atlas by the merge pass; about 0.2 MB of pixels in all.
 *
 * The crest is ours: a white moon, in it a rabbit with a mallet over a
 * mortar (月の兎), drawn from circles and a few strokes so it reads at 30 px.
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

export const INDIGO = '#2a3f7c', CREAM = '#f6efde', RED = '#c8322c', INKW = '#3a2a22';

function fit(c, str, x, y, maxW, size, color, face, { weight = 'bold', stroke = null, sw = 0 } = {}) {
  let s = size;
  for (; s > 6; s--) { c.font = `${weight} ${s}px ${face}`; if (c.measureText(str).width <= maxW) break; }
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (stroke) { c.lineJoin = 'round'; c.lineWidth = sw; c.strokeStyle = stroke; c.strokeText(str, x, y); }
  c.fillStyle = color; c.fillText(str, x, y);
  return s;
}
function column(c, str, x, y0, y1, maxSize, color, face) {
  const ch = [...str];
  const step = Math.min(maxSize * 1.04, (y1 - y0) / Math.max(1, ch.length));
  const size = Math.floor(step * 0.94);
  c.font = `bold ${size}px ${face}`;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color;
  const top = y0 + ((y1 - y0) - step * ch.length) / 2;
  ch.forEach((g, i) => {
    const small = 'っゃゅょ'.includes(g);          // the small kana sit up and to the right in a column
    c.fillText(g, x + (small ? size * 0.12 : 0), top + step * (i + 0.5) - (small ? size * 0.1 : 0));
  });
}

/** The crest at (x, y), radius r: `fg` on `bg` (a moon, the rabbit and its mortar cut out of it). */
export function crest(c, x, y, r, fg, bg) {
  c.save();
  c.translate(x, y); c.scale(r / 50, r / 50);
  c.fillStyle = fg; c.beginPath(); c.arc(0, 0, 50, 0, Math.PI * 2); c.fill();
  c.fillStyle = bg; c.strokeStyle = bg; c.lineCap = 'round'; c.lineJoin = 'round';
  // the mortar: a tapered tub on the right
  c.beginPath(); c.moveTo(4, 8); c.lineTo(36, 8); c.lineTo(31, 34); c.lineTo(9, 34); c.closePath(); c.fill();
  // the rabbit: body, head, two long ears, a round tail
  c.beginPath(); c.ellipse(-20, 20, 13, 15, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(-15, -3, 10.5, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(-22, -24, 4.4, 13, -0.22, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(-11, -26, 4.4, 13, 0.16, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(-34, 27, 5, 0, Math.PI * 2); c.fill();
  // its mallet: the handle from its paws up over the mortar, the head at the end
  c.lineWidth = 4.5; c.beginPath(); c.moveTo(-8, 12); c.lineTo(22, -14); c.stroke();
  c.save(); c.translate(22, -14); c.rotate(-0.72); c.fillRect(-6.5, -13, 13, 26); c.restore();
  c.restore();
}

/** Timber: dark planks with a little grain. */
function wood(c, w, h, base = '#4a372a') {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  let a = 7;
  const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  for (let i = 0; i < 14; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,232,196' : '18,8,4'},${0.04 + r() * 0.06})`; c.fillRect(0, r() * h, w, 1 + r() * 2.5); }
}

/** The board on the roof: the name in brush on dark timber, the crest, the maker's red seal. */
export const boardTex = () => canvasTex('pettan:board', 384, 96, (c, w, h) => {
  wood(c, w, h);
  c.strokeStyle = '#d9c28e'; c.lineWidth = 3; c.strokeRect(6, 6, w - 12, h - 12);
  crest(c, 52, h / 2, 29, '#f4e8cc', '#4a372a');
  const s = fit(c, PETTAN.name, w * 0.53, h * 0.54, w * 0.56, 66, '#f6ead0', JP_BRUSH, { stroke: '#22160f', sw: 5 });
  c.font = `bold ${s}px ${JP_BRUSH}`;
  const x = Math.min(w - 42, w * 0.53 + c.measureText(PETTAN.name).width / 2 + 12);
  c.fillStyle = RED; c.fillRect(x, h / 2 - 15, 30, 30);
  fit(c, PETTAN.seal, x + 15, h / 2 + 1, 24, 23, '#f8eee0', JP_BRUSH);
});

/** The noren: indigo, five panels, the name across the middle three, a crest on each end; the slits cut out. */
export const norenTex = () => canvasTex('pettan:noren', 384, 96, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  const n = 5, pw = w / n, gap = 3;
  for (let i = 0; i < n; i++) {
    c.fillStyle = INDIGO;
    c.beginPath(); c.roundRect(i * pw + (i ? gap / 2 : 0), 0, pw - (i && i < n - 1 ? gap : gap / 2), h - 2, [0, 0, 5, 5]); c.fill();
    c.fillStyle = 'rgba(12,20,60,0.25)'; c.fillRect(i * pw, 0, pw, 9);          // the rod's sleeve
  }
  // joined along the top, as a noren is
  c.fillStyle = INDIGO; c.fillRect(0, 0, w, 26);
  c.fillStyle = 'rgba(12,20,60,0.3)'; c.fillRect(0, 0, w, 8);
  crest(c, pw * 0.5, h * 0.56, 27, CREAM, INDIGO);
  crest(c, w - pw * 0.5, h * 0.56, 27, CREAM, INDIGO);
  const ch = [...PETTAN.name], cw = (pw * 3) / ch.length;
  c.font = `bold 50px ${JP_BRUSH}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = CREAM;
  ch.forEach((g, i) => c.fillText(g, pw + cw * (i + 0.5), h * 0.57 + ('っ'.includes(g) ? 5 : 0)));
});

/** A nobori: red, a pale band and the crest at the top, the words down it in white. */
export const flagTex = (text) => canvasTex('pettan:flag:' + text, 64, 256, (c, w, h) => {
  c.fillStyle = RED; c.fillRect(0, 0, w, h);
  c.fillStyle = CREAM; c.fillRect(0, 0, w, 12);
  c.fillStyle = 'rgba(90,10,10,0.25)'; c.fillRect(0, h - 5, w, 5);
  crest(c, w / 2, 36, 17, CREAM, RED);
  column(c, text, w / 2, 60, h - 12, 46, '#fdf6e8', JP_BRUSH);
});

/** The paper price card. */
export const cardTex = () => canvasTex('pettan:card', 128, 96, (c, w, h) => {
  c.fillStyle = '#fbf6ea'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#c8322c'; c.lineWidth = 3; c.strokeRect(4, 4, w - 8, h - 8);
  fit(c, PETTAN.item, w / 2, 27, w - 18, 21, INKW, JP_BRUSH);
  // a little strawberry on a green mochi
  c.fillStyle = '#a9c468'; c.beginPath(); c.ellipse(27, 66, 15, 10, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#dc2238'; c.beginPath(); c.moveTo(27, 62); c.quadraticCurveTo(15, 46, 27, 44); c.quadraticCurveTo(39, 46, 27, 62); c.fill();
  c.fillStyle = '#4f9a3e'; c.fillRect(23, 42, 8, 3);
  fit(c, PETTAN.price, 82, 62, 70, 34, '#c8322c', JP_ROUND);
  fit(c, PETTAN.card, 84, 84, 60, 11, '#6a5a50', JP, { weight: 600 });
});

/** The board on the flank, for the car park: the crest, the name down it, a red tag. */
export const sideTex = () => canvasTex('pettan:side', 64, 256, (c, w, h) => {
  wood(c, w, h, '#f1e7d0');
  c.fillStyle = '#4a372a'; c.fillRect(0, 0, w, 10); c.fillRect(0, h - 8, w, 8);
  crest(c, w / 2, 40, 21, INDIGO, '#f1e7d0');
  column(c, PETTAN.name, w / 2, 68, h - 62, 40, INKW, JP_BRUSH);
  c.fillStyle = RED; c.fillRect(8, h - 56, w - 16, 44);
  fit(c, PETTAN.side[0], w / 2, h - 44, w - 22, 15, '#fdf6e8', JP_BRUSH);
  fit(c, PETTAN.side[1], w / 2, h - 25, w - 22, 16, '#fdf6e8', JP_BRUSH);
});

/** The jar's label: for dogs. */
export const jarTex = () => canvasTex('pettan:jar', 64, 64, (c, w, h) => {
  c.fillStyle = '#fbf3df'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#8a5a2a'; c.lineWidth = 2.5; c.strokeRect(3, 3, w - 6, h - 6);
  fit(c, PETTAN.dog, w / 2, 24, w - 12, 17, '#6a3a1e', JP_ROUND);
  fit(c, PETTAN.dogSub, w / 2, 46, w - 14, 12, '#8a5a2a', JP_ROUND);
});

/** The stand's cloth: indigo, the crest in the middle, a pale hem. */
export const clothTex = () => canvasTex('pettan:cloth', 128, 96, (c, w, h) => {
  c.fillStyle = INDIGO; c.fillRect(0, 0, w, h);
  c.fillStyle = CREAM; c.fillRect(0, h - 7, w, 3);
  crest(c, w / 2, h * 0.47, 30, CREAM, INDIGO);
});
