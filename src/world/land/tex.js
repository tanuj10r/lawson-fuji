import * as THREE from 'three';
import { JP, JP_ROUND, JP_BRUSH } from '../kit/tex.js';
import { rng } from '../kit/paint.js';

/* ------------------------------------------------------------------ *
 * Canvas2D art for the land (AGENTS.md: everything drawn in code).
 * Flat, low-frequency shapes in the town's painted manner; each texture
 * the size it is seen at (the surfaces tile, the plates are small).
 * ------------------------------------------------------------------ */

const cache = new Map();

function canvasTex(key, w, h, draw, { repeat = false, aniso = 8, srgb = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(key, t);
  return t;
}

/** Draw a stroke on a tiling canvas, wrapped at the edges. */
function wrapped(c, w, h, fn) {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { c.save(); c.translate(dx, dy); fn(); c.restore(); }
}

/* ------------------------------ surfaces ------------------------------ */

/** Tile sizes (metres) of the surfaces below, for world-mapped UVs. */
export const TILE = { water: 11, plough: 6, renge: 5, track: 3.2, masonry: 3.2, grass: 5 };

/** Still paddy water: a sky mirror.  Multiplied by the sky's colour at
 * runtime: a mid tone, clouds as long flat streaks (a reflection is
 * stretched toward you), and fine wind lines. */
export const paddyWaterTex = () =>
  canvasTex('landPaddyWater', 256, 256, (c, w, h) => {
    const r = rng(701);
    c.fillStyle = '#d2dbe8'; c.fillRect(0, 0, w, h);
    // cloud reflections: long, flat, two tones
    for (let i = 0; i < 7; i++) {
      const x = r() * w, y = r() * h, rx = 34 + r() * 60, ry = 3 + r() * 5;
      wrapped(c, w, h, () => {
        c.fillStyle = '#eef2f8';
        c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath(); c.ellipse(x - rx * 0.2, y - ry * 0.25, rx * 0.5, ry * 0.45, 0, 0, Math.PI * 2); c.fill();
      });
    }
    // wind lines: short strokes, a light one over a darker one
    for (let i = 0; i < 40; i++) {
      const x = r() * w, y = r() * h, len = 6 + r() * 20;
      wrapped(c, w, h, () => {
        c.fillStyle = 'rgba(150,164,196,0.3)'; c.fillRect(x + 2, y + 1.5, len * 0.8, 1.2);
        c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillRect(x, y, len, 1.2);
      });
    }
  }, { repeat: true });

/** Painted grass for the banks: two tones in soft patches, grass strokes,
 * and the odd white and yellow flower. */
export const bankGrassTex = () =>
  canvasTex('landBankGrass', 256, 256, (c, w, h) => {
    const r = rng(761);
    c.fillStyle = '#a4c888'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = r() * w, y = r() * h, rx = 14 + r() * 30, ry = 8 + r() * 16, a = r() * 3;
      const col = r() < 0.55 ? '#94bb7a' : '#b2d294';
      wrapped(c, w, h, () => {
        c.fillStyle = col;
        c.beginPath(); c.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); c.fill();
      });
    }
    for (let i = 0; i < 420; i++) {
      const x = r() * w, y = r() * h;
      c.strokeStyle = r() < 0.5 ? 'rgba(110,150,90,0.55)' : 'rgba(196,222,160,0.6)';
      c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 4); c.stroke();
    }
    for (let i = 0; i < 70; i++) {
      const x = r() * w, y = r() * h, t = r();
      c.fillStyle = t < 0.5 ? '#fbfaf2' : t < 0.8 ? '#f6d23c' : '#b48ad0';
      c.beginPath(); c.arc(x, y, 1.6 + r() * 1.2, 0, Math.PI * 2); c.fill();
    }
  }, { repeat: true });

/** The river's moving lines: pale ripple strokes and glints over a mid
 * tone; multiplied over the river's flat bands, and slid downstream. */
export const riverRippleTex = () =>
  canvasTex('landRiverRipple', 256, 256, (c, w, h) => {
    const r = rng(733);
    c.fillStyle = '#d4dade'; c.fillRect(0, 0, w, h);
    // ripple lines: thin wavy strokes, each a crest and a trough
    for (let i = 0; i < 60; i++) {
      const x = r() * w, y = r() * h, len = 12 + r() * 30, a = 0.3 + r() * 0.4, lw = 1 + r() * 0.8;
      wrapped(c, w, h, () => {
        c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = lw; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, y);
        c.bezierCurveTo(x + len * 0.3, y - 3, x + len * 0.6, y + 3, x + len, y - 1);
        c.stroke();
      });
    }
    // glints: a few bright dashes
    for (let i = 0; i < 8; i++) {
      const x = r() * w, y = r() * h, l = 5 + r() * 6;
      wrapped(c, w, h, () => {
        c.fillStyle = 'rgba(255,255,250,0.95)'; c.fillRect(x, y, l, 2);
      });
    }
  }, { repeat: true });

/** Freshly ploughed earth: furrows along v, clods, and a few wet puddles
 * holding the sky. */
export const ploughTex = () =>
  canvasTex('landPlough', 256, 256, (c, w, h) => {
    const r = rng(717);
    c.fillStyle = '#8c7156'; c.fillRect(0, 0, w, h);
    const n = 16;
    for (let i = 0; i < n; i++) {
      const x = (i * w) / n;
      c.fillStyle = '#6f5641'; c.fillRect(x, 0, w / n * 0.42, h);
      c.fillStyle = '#9e8466'; c.fillRect(x + w / n * 0.55, 0, w / n * 0.18, h);
    }
    for (let i = 0; i < 90; i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(90,68,52,0.7)' : 'rgba(170,146,118,0.55)';
      const x = r() * w, y = r() * h;
      c.beginPath(); c.ellipse(x, y, 2 + r() * 4, 1.5 + r() * 2.5, 0, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 5; i++) {
      const x = r() * w, y = r() * h, rx = 5 + r() * 9, ry = 14 + r() * 26;
      wrapped(c, w, h, () => {
        c.fillStyle = '#a9bfd2';
        c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(x - 2, y - 6, 3, 8);
      });
    }
    // a little green stubble coming back
    for (let i = 0; i < 70; i++) {
      c.fillStyle = 'rgba(128,150,84,0.75)';
      c.fillRect(r() * w, r() * h, 2, 3);
    }
  }, { repeat: true });

/** Renge (Chinese milk vetch), the April green manure: fresh green with
 * clusters of pink-violet flowers. */
export const rengeTex = () =>
  canvasTex('landRenge', 256, 256, (c, w, h) => {
    const r = rng(727);
    c.fillStyle = '#86ad62'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const x = r() * w, y = r() * h, rx = 10 + r() * 18, ry = 6 + r() * 10, a = r() * 3;
      wrapped(c, w, h, () => {
        c.fillStyle = 'rgba(104,140,76,0.7)';
        c.beginPath(); c.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); c.fill();
      });
    }
    for (let i = 0; i < 460; i++) {
      const x = r() * w, y = r() * h, s = 1.6 + r() * 2.4;
      const t = r();
      c.fillStyle = t < 0.5 ? '#d884c4' : t < 0.8 ? '#c774b8' : '#f2c6e4';
      c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill();
    }
  }, { repeat: true });

/** The farm track: packed earth, two tyre ruts, a grass crown.  u across
 * the track (one tile is its whole width), v along it. */
export const trackTex = () =>
  canvasTex('landTrack', 256, 512, (c, W, H) => {
    c.scale(2, 2);
    const w = W / 2, h = H / 2;
    const r = rng(739);
    c.fillStyle = '#c2ad8a'; c.fillRect(0, 0, w, h);
    // the ruts: a shade darker, worn smooth
    for (const u of [0.26, 0.74]) {
      c.fillStyle = '#ab9474'; c.fillRect(u * w - 11, 0, 22, h);
      c.fillStyle = 'rgba(214,196,164,0.8)'; c.fillRect(u * w - 11, 0, 3, h);
    }
    // the crown: tufts of grass
    for (let i = 0; i < 46; i++) {
      c.fillStyle = r() < 0.6 ? '#a3bb78' : '#b2c486';
      c.beginPath(); c.ellipse(w / 2 + (r() - 0.5) * 14, r() * h, 2 + r() * 3.5, 3 + r() * 6, 0, 0, Math.PI * 2); c.fill();
    }
    // grass creeping in at the edges
    for (let i = 0; i < 50; i++) {
      c.fillStyle = '#93b068';
      const x = r() < 0.5 ? r() * 10 : w - r() * 10;
      c.beginPath(); c.ellipse(x, r() * h, 3 + r() * 5, 5 + r() * 9, 0, 0, Math.PI * 2); c.fill();
    }
    // gravel
    for (let i = 0; i < 260; i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(236,226,206,0.7)' : 'rgba(140,122,98,0.5)';
      c.fillRect(r() * w, r() * h, 2, 2);
    }
  }, { repeat: true });

/* ------------------------------ plates ------------------------------ */

/** A deer, side on, walking left: the board's small mark. */
function deer(c, x, y, s, col) {
  c.save();
  c.translate(x, y); c.scale(s, s);
  c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
  // body
  c.beginPath(); c.ellipse(0, 0, 30, 13, -0.05, 0, Math.PI * 2); c.fill();
  // neck and head
  c.beginPath();
  c.moveTo(-20, -6); c.lineTo(-30, -30); c.lineTo(-22, -34); c.lineTo(-12, -8); c.closePath(); c.fill();
  c.beginPath(); c.ellipse(-31, -33, 9, 5.5, -0.35, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(-38, -32); c.lineTo(-44, -29); c.lineTo(-37, -28); c.fill();  // muzzle
  // ear
  c.beginPath(); c.ellipse(-22, -40, 3, 7, 0.9, 0, Math.PI * 2); c.fill();
  // antlers
  c.lineWidth = 2.6;
  c.beginPath();
  c.moveTo(-27, -38); c.lineTo(-24, -54); c.lineTo(-18, -64);
  c.moveTo(-24, -54); c.lineTo(-32, -60);
  c.moveTo(-22, -46); c.lineTo(-14, -52);
  c.stroke();
  // legs, one lifted
  c.lineWidth = 4.2;
  c.beginPath();
  c.moveTo(-20, 6); c.lineTo(-24, 34);
  c.moveTo(-12, 8); c.lineTo(-8, 22); c.lineTo(-12, 33);
  c.moveTo(18, 6); c.lineTo(22, 34);
  c.moveTo(24, 5); c.lineTo(30, 33);
  c.stroke();
  // tail
  c.beginPath(); c.ellipse(30, -6, 5, 3, 0.6, 0, Math.PI * 2); c.fill();
  c.restore();
}

/** The Deer Park gate's board: 鹿公園 近日公開, the English line, a deer. */
export function gateBoardTex(board) {
  return canvasTex('landGateBoard', 512, 320, (c, w, h) => {
    const r = rng(751);
    // weathered cedar planks
    const n = 5;
    for (let i = 0; i < n; i++) {
      c.fillStyle = i % 2 ? '#e8d6b4' : '#efdfc0';
      c.fillRect(0, (i * h) / n, w, h / n);
      c.fillStyle = 'rgba(120,86,60,0.35)'; c.fillRect(0, ((i + 1) * h) / n - 2, w, 2);
    }
    for (let i = 0; i < 40; i++) {
      c.fillStyle = 'rgba(150,110,80,0.14)';
      c.fillRect(r() * w, r() * h, 20 + r() * 80, 1.5);
    }
    // a painted frame
    c.strokeStyle = '#5e3f2c'; c.lineWidth = 12; c.strokeRect(6, 6, w - 12, h - 12);
    c.strokeStyle = '#b8402e'; c.lineWidth = 3; c.strokeRect(20, 20, w - 40, h - 40);
    // the deer, left of the title
    deer(c, 104, 118, 1.2, '#7a4a30');
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#3a2418';
    c.font = `96px ${JP_BRUSH}`;
    c.fillText(board.jp, 318, 106);
    // 近日公開 on a red band
    c.fillStyle = '#b8402e';
    c.beginPath(); c.roundRect(150, 172, 336, 64, 10); c.fill();
    c.fillStyle = '#fff8ea';
    c.font = `bold 46px ${JP_ROUND}`;
    c.fillText(board.soon, 318, 206);
    c.fillStyle = '#3a2418';
    c.font = `bold 30px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
    c.fillText(board.en, w / 2, 272);
  });
}

/** A bridge post's cast plate (親柱): vertical text, bronze on dark. */
export function postPlateTex(text, key) {
  return canvasTex('landPost' + key, 96, 256, (c, w, h) => {
    c.fillStyle = '#4c4a44'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#8a8270'; c.lineWidth = 5; c.strokeRect(5, 5, w - 10, h - 10);
    c.fillStyle = '#d8cfae';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const chars = [...text];
    const step = Math.min(58, (h - 30) / chars.length);
    c.font = `${Math.round(step * 0.92)}px ${JP_BRUSH}`;
    chars.forEach((ch, i) => c.fillText(ch, w / 2, 15 + step * (i + 0.5)));
  }, { aniso: 4 });
}

/** A white plate with dark lettering, fitted: farm notices, the shed. */
export function noticeTex(key, lines, { w = 256, h = 128, bg = '#f6f4ec', fg = '#26303a', edge = '#26303a', red = null } = {}) {
  return canvasTex('landNotice' + key, w, h, (c) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.strokeStyle = edge; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((ln, i) => {
      let s = Math.floor((h - 20) / n * 0.78);
      do { c.font = `bold ${s}px ${JP_ROUND}`; s -= 1; } while (c.measureText(ln).width > w - 24 && s > 8);
      c.fillStyle = red && i === red.line ? red.color : fg;
      c.fillText(ln, w / 2, 10 + ((h - 20) / n) * (i + 0.5));
    });
  }, { aniso: 4 });
}

/** The river's name sign on the levee: 一級河川 桜川, white on blue. */
export function riverSignTex(river) {
  return canvasTex('landRiverSign', 384, 128, (c, w, h) => {
    c.fillStyle = '#1f4f9c'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#f4f6fa'; c.lineWidth = 5; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#f4f6fa'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `bold 30px ${JP}`;
    c.fillText(river.grade, 78, h / 2);
    c.font = `bold 64px ${JP}`;
    c.fillText(river.jp, 250, h / 2 - 8);
    c.font = `bold 20px ${JP}`;
    c.fillText(river.kana, 250, h / 2 + 38);
  }, { aniso: 4 });
}

/* ------------------------------ wave 2c: the channel and the pond ------------------------------ */

/** Masonry for the channel's revetments (間知石 laid in courses): grey
 * granite blocks, staggered, dark joints, damp low down.  u along the
 * wall, v up it (v = 0 at the foot). */
export const masonryTex = () =>
  canvasTex('landMasonry', 256, 256, (c, w, h) => {
    const r = rng(811);
    c.fillStyle = '#7e7a74'; c.fillRect(0, 0, w, h);
    const rows = 6, rh = h / rows;
    for (let j = 0; j < rows; j++) {
      let x = j % 2 ? -rh * 0.6 : 0;
      while (x < w) {
        const bw = rh * (1.1 + r() * 0.8);
        const t = r();
        const col = t < 0.3 ? '#b9b4aa' : t < 0.6 ? '#c6c1b6' : t < 0.85 ? '#aca79e' : '#cfcabe';
        const x0 = x;
        wrapped(c, w, h, () => {
          c.fillStyle = col;
          c.beginPath(); c.roundRect(x0 + 2.5, j * rh + 2.5, bw - 5, rh - 5, 5); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x0 + 5, j * rh + 4, bw - 12, 3);
        });
        x += bw;
      }
    }
    const g = c.createLinearGradient(0, h, 0, h * 0.55);
    g.addColorStop(0, 'rgba(96,112,92,0.55)'); g.addColorStop(1, 'rgba(96,112,92,0)');
    c.fillStyle = g; c.fillRect(0, h * 0.55, w, h * 0.45);
    for (let i = 0; i < 30; i++) {
      c.fillStyle = 'rgba(120,150,96,0.55)';
      c.fillRect(r() * w, r() * h, 2 + r() * 5, 2 + r() * 3);
    }
  }, { repeat: true });

/** Worn granite slabs (the promenades, the river walks): rectangles of a
 * few sizes, speckled, grass and moss in the joints. */
export const slabTex = () =>
  canvasTex('landSlab', 256, 256, (c, w, h) => {
    const r = rng(823);
    c.fillStyle = '#8f8c86'; c.fillRect(0, 0, w, h);
    const rows = 4, rh = h / rows;
    for (let j = 0; j < rows; j++) {
      let x = ((j * 37) % 50) - 50;
      while (x < w) {
        const bw = rh * (0.9 + r() * 1.3);
        const t = r();
        const col = t < 0.35 ? '#c4c0b8' : t < 0.7 ? '#b8b4ac' : '#ccc8bf';
        const x0 = x;
        wrapped(c, w, h, () => { c.fillStyle = col; c.fillRect(x0 + 1.5, j * rh + 1.5, bw - 3, rh - 3); });
        x += bw;
      }
    }
    for (let i = 0; i < 1600; i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(90,86,82,0.25)' : 'rgba(255,255,255,0.28)';
      c.fillRect(r() * w, r() * h, 1.5, 1.5);
    }
    for (let i = 0; i < 10; i++) {
      const x = r() * w, y = r() * h, rx = 10 + r() * 22, ry = 6 + r() * 12;
      wrapped(c, w, h, () => { c.fillStyle = 'rgba(110,104,96,0.14)'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); });
    }
    for (let i = 0; i < 26; i++) {
      c.fillStyle = 'rgba(112,150,86,0.7)';
      c.fillRect(r() * w, Math.floor(r() * rows) * rh - 1, 4 + r() * 8, 2.5);
    }
  }, { repeat: true });

/** The pond's water: calm, a light chop of short strokes, a few long sky
 * lights.  Multiplied by the pond's olive at runtime. */
export const pondTex = () =>
  canvasTex('landPond', 256, 256, (c, w, h) => {
    const r = rng(839);
    c.fillStyle = '#d6d8c8'; c.fillRect(0, 0, w, h);
    // a light chop: short pale crests, thin and wavy
    for (let i = 0; i < 130; i++) {
      const x = r() * w, y = r() * h, len = 6 + r() * 16, a = 0.45 + r() * 0.45;
      wrapped(c, w, h, () => {
        c.strokeStyle = `rgba(255,255,248,${a})`; c.lineWidth = 1.1; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + len / 2, y - 1.8, x + len, y); c.stroke();
      });
    }
    // long, flat sky lights
    for (let i = 0; i < 5; i++) {
      const x = r() * w, y = r() * h, rx = 30 + r() * 50;
      wrapped(c, w, h, () => { c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.ellipse(x, y, rx, 2.5, 0, 0, Math.PI * 2); c.fill(); });
    }
  }, { repeat: true });

/** A stone marker's carved face: vertical text, dark in grey granite. */
export function markerTex(text, key) {
  return canvasTex('landMarker' + key, 96, 256, (c, w, h) => {
    c.fillStyle = '#c4bfb4'; c.fillRect(0, 0, w, h);
    const r = rng(857);
    for (let i = 0; i < 300; i++) { c.fillStyle = r() < 0.5 ? 'rgba(80,76,70,0.2)' : 'rgba(255,255,255,0.25)'; c.fillRect(r() * w, r() * h, 1.5, 1.5); }
    c.fillStyle = '#34322f';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const chars = [...text];
    const step = Math.min(72, (h - 30) / chars.length);
    c.font = `${Math.round(step * 0.9)}px ${JP_BRUSH}`;
    chars.forEach((ch, i) => c.fillText(ch, w / 2, 16 + step * (i + 0.5)));
  }, { aniso: 4 });
}

/** A shop curtain (暖簾): white letters on indigo, split in three. */
export function norenTex(text, key) {
  return canvasTex('landNoren' + key, 256, 128, (c, w, h) => {
    c.fillStyle = '#2f3f6a'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 1; i < 3; i++) c.fillRect((i * w) / 3 - 1.5, h * 0.3, 3, h);
    c.fillStyle = '#f4efe2'; c.textAlign = 'center'; c.textBaseline = 'middle';
    // as large as fits: the name must never run off the cloth
    let px = Math.round(h * 0.44);
    do { c.font = `${px}px ${JP_BRUSH}`; px -= 2; } while (c.measureText(text).width > w * 0.88 && px > 12);
    c.fillText(text, w / 2, h * 0.5);
  }, { aniso: 4 });
}

/** Shoji paper in its kumiko lattice (one panel per box face). */
export const shojiTex = () =>
  canvasTex('landShoji', 128, 128, (c, w, h) => {
    c.fillStyle = '#f7f1e2'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(210,196,170,0.35)'; c.fillRect(0, h * 0.72, w, h * 0.28);   // a warmer lower band, where hands touch
    c.fillStyle = '#6e5444';
    for (let i = 0; i <= 3; i++) c.fillRect(Math.round((i * (w - 6)) / 3), 0, 6, h);
    for (let j = 0; j <= 4; j++) c.fillRect(0, Math.round((j * (h - 5)) / 4), w, 5);
  }, { aniso: 4 });
