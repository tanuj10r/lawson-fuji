import * as THREE from 'three';
import { JP_BRUSH } from '../tex.js';
import { SHRINE_TEXT } from '../../../data/town.js';

/* ------------------------------------------------------------------ *
 * Canvas2D art for the Inari shrine (AGENTS.md: everything drawn in code).
 * Each is the size it is seen at: the pillars' inscriptions are one small
 * atlas of brush columns, the ema one atlas of plaques.
 * ------------------------------------------------------------------ */

const cache = new Map();
function canvasTex(key, w, h, draw, { repeat = false } = {}) {
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(key, t);
  return t;
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

/** Characters stacked top to bottom in a column, each fitted to `size`. */
function column(c, str, x, y0, y1, size, color, { gap = 0.04 } = {}) {
  const chars = [...str].filter((ch) => ch !== ' ');
  const spaces = [...str].length - chars.length;
  const step = Math.min(size * (1 + gap), (y1 - y0) / Math.max(1, chars.length + spaces * 0.6));
  const s = Math.floor(step / (1 + gap));
  c.font = `${s}px ${JP_BRUSH}`;
  c.fillStyle = color;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  let y = y0 + step / 2;
  for (const ch of [...str]) {
    if (ch === ' ') { y += step * 0.6; continue; }
    c.fillText(ch, x, y);
    y += step;
  }
}

/* The tunnel pillars' inscriptions: one cell per text, black brush on
 * transparent, laid down the pillar's back.  Donors, then dates. */
export const INSCRIPTION_CELLS = SHRINE_TEXT.donors.length + SHRINE_TEXT.dates.length;
export const inscriptionAtlas = () =>
  canvasTex('shrine-inscriptions', 32 * INSCRIPTION_CELLS, 448, (c, w, h) => {
    const all = [...SHRINE_TEXT.donors, ...SHRINE_TEXT.dates];
    all.forEach((t, i) => column(c, t, i * 32 + 16, 8, h - 8, 27, 'rgba(24,18,22,0.92)'));
  });
/** The UV rect of inscription cell i: [u0, u1]. */
export const inscriptionCell = (i) => [i / INSCRIPTION_CELLS, (i + 1) / INSCRIPTION_CELLS];

/** The main torii's plaque (額): black board, gilt edge and letters. */
export const gakuTex = () =>
  canvasTex('shrine-gaku', 96, 224, (c, w, h) => {
    c.fillStyle = '#1e1a22'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c9a24a'; c.lineWidth = 7; c.strokeRect(5, 5, w - 10, h - 10);
    c.lineWidth = 2; c.strokeRect(14, 14, w - 28, h - 28);
    column(c, SHRINE_TEXT.gaku, w / 2, 22, h - 22, 40, '#e6c66a');
  });

/** The name pillar (社号標): pale granite, the name cut in and inked. */
export const stoneNameTex = () =>
  canvasTex('shrine-stone', 64, 448, (c, w, h) => {
    const r = rng(41);
    c.fillStyle = '#c9c4ba'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(90,86,100,0.10)' : 'rgba(255,255,255,0.12)';
      c.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    column(c, SHRINE_TEXT.stone, w / 2 + 1, 26, h - 30, 44, 'rgba(255,255,255,0.35)');
    column(c, SHRINE_TEXT.stone, w / 2, 24, h - 32, 44, '#3a3440');
  });

/** Hanging paper lantern (提灯): white paper, red 奉納, black bands. */
export const chochinTex = () =>
  canvasTex('shrine-chochin', 128, 128, (c, w, h) => {
    c.fillStyle = '#fbf3e2'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(160,120,90,0.25)';
    for (let y = 8; y < h; y += 9) c.fillRect(0, y, w, 1);
    c.fillStyle = '#1e1a22'; c.fillRect(0, 0, w, 10); c.fillRect(0, h - 10, w, 10);
    for (const x of [w * 0.25, w * 0.75]) column(c, SHRINE_TEXT.lantern, x, 18, h - 18, 44, '#c23a26');
  });

/* The ema: wooden pentagons (and fox faces, as Inari shrines have them),
 * each with a printed motif and a wish written over it.  8 cells, 4 x 2. */
export const EMA_CELLS = 8;
export const emaAtlas = () =>
  canvasTex('shrine-ema', 512, 256, (c) => {
    const r = rng(77);
    for (let i = 0; i < EMA_CELLS; i++) {
      const x0 = (i % 4) * 128, y0 = Math.floor(i / 4) * 128;
      c.save();
      c.translate(x0, y0);
      if (i === 3 || i === 6) {
        // a fox-face ema: white face, red markings, a face drawn in by the visitor
        c.fillStyle = '#f6f1e6';
        c.beginPath();
        c.moveTo(18, 14); c.lineTo(48, 40); c.lineTo(80, 40); c.lineTo(110, 14);
        c.lineTo(104, 70); c.lineTo(64, 118); c.lineTo(24, 70); c.closePath(); c.fill();
        c.fillStyle = '#d0402c';
        c.beginPath(); c.moveTo(26, 24); c.lineTo(44, 42); c.lineTo(30, 52); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(102, 24); c.lineTo(84, 42); c.lineTo(98, 52); c.closePath(); c.fill();
        c.strokeStyle = '#2a2230'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(40, 66); c.quadraticCurveTo(50, 58, 58, 68); c.stroke();
        c.beginPath(); c.moveTo(70, 68); c.quadraticCurveTo(78, 58, 88, 66); c.stroke();
        c.fillStyle = '#2a2230'; c.beginPath(); c.arc(64, 104, 4, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#e07a8a'; c.globalAlpha = 0.6;
        c.beginPath(); c.arc(40, 82, 7, 0, Math.PI * 2); c.arc(88, 82, 7, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
      } else {
        // a pentagon of pale wood, a red band, the motif and the wish
        c.fillStyle = ['#e6cfa0', '#dcc293', '#e9d6ac'][i % 3];
        c.beginPath();
        c.moveTo(4, 36); c.lineTo(64, 4); c.lineTo(124, 36); c.lineTo(124, 124); c.lineTo(4, 124); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(120,90,60,0.35)'; c.lineWidth = 1;
        for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(6, 44 + k * 14 + r() * 4); c.lineTo(122, 42 + k * 14 + r() * 4); c.stroke(); }
        if (i % 2 === 0) {
          // a red torii
          c.fillStyle = '#c8402a';
          c.fillRect(34, 36, 60, 7); c.fillRect(40, 48, 48, 5); c.fillRect(46, 40, 6, 44); c.fillRect(76, 40, 6, 44);
          c.fillStyle = '#2a2230'; c.fillRect(30, 32, 68, 5);
        } else {
          // a white fox, sitting
          c.fillStyle = '#fbf8f0';
          c.beginPath(); c.ellipse(64, 70, 16, 22, 0, 0, Math.PI * 2); c.fill();
          c.beginPath(); c.moveTo(52, 50); c.lineTo(56, 30); c.lineTo(62, 46); c.lineTo(68, 46); c.lineTo(74, 30); c.lineTo(78, 50); c.closePath(); c.fill();
          c.strokeStyle = '#c8402a'; c.lineWidth = 3; c.beginPath(); c.moveTo(56, 60); c.lineTo(72, 60); c.stroke();
        }
        // the wish, in a visitor's hand
        const wish = SHRINE_TEXT.ema[i % SHRINE_TEXT.ema.length];
        column(c, wish, 102, 44, 118, 17, '#2a2230');
        c.strokeStyle = 'rgba(40,34,48,0.8)'; c.lineWidth = 1.6;
        for (let k = 0; k < 3; k++) {
          const x = 22 + k * 12;
          c.beginPath(); c.moveTo(x, 92);
          for (let y = 92; y < 120; y += 4) c.lineTo(x + (r() - 0.5) * 5, y);
          c.stroke();
        }
      }
      c.restore();
    }
  });
/** The UV rect of ema cell i: [u0, v0, u1, v1] (v up, as three.js flips). */
export const emaCell = (i) => {
  const cx = i % 4, cy = Math.floor(i / 4);
  return [cx / 4, 1 - (cy + 1) / 2, (cx + 1) / 4, 1 - cy / 2];
};

/** The trickle from the basin's bamboo spout: bright streaks that scroll. */
export const trickleTex = () =>
  canvasTex('shrine-trickle', 16, 64, (c, w, h) => {
    const r = rng(5);
    c.fillStyle = 'rgba(190,225,245,0.55)'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      c.fillStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`;
      c.fillRect(r() * w, r() * h, 2 + r() * 3, 6 + r() * 12);
    }
  }, { repeat: true });
