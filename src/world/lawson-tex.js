import * as THREE from 'three';
import { FOOD } from './foodart.js';
import { STORE_NAME } from '../config.js';

/* ------------------------------------------------------------------ *
 * Canvas2D signage and painted surfaces for the Lawson (AGENTS.md: all
 * signage is drawn in code).  Lawson branding appears only on the store's
 * own signs here; posters and banners advertise generic, fictional goods.
 *
 * Canvases are sized in pixels per metre so type stays crisp through the
 * hero cameras' telephoto framing.
 * ------------------------------------------------------------------ */

const JP = `'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Yu Gothic UI', Meiryo, 'Noto Sans JP', sans-serif`;
/* The wordmark is a heavy slab serif.  Rockwell and Clarendon where the system
 * has them; Georgia is the everywhere fallback. */
const SLAB = `'Rockwell', 'Rockwell Extra Bold', 'Clarendon', 'Clarendon BT', 'Georgia', serif`;

export const LAWSON_BLUE = '#0068b7';
const BLUE_DEEP = '#00509a';

const cache = new Map();

function make(key, w, h, draw, { srgb = true, repeat = null } = {}) {
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  draw(c, w, h);
  const tex = new THREE.CanvasTexture(cv);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

function fit(c, text, maxW, size, font, weight = 'bold') {
  let s = size;
  do {
    c.font = `${weight} ${s}px ${font}`;
    if (c.measureText(text).width <= maxW) break;
    s -= 1;
  } while (s > 6);
  return s;
}

function text(c, str, x, y, maxW, size, color, { font = JP, weight = 'bold', spacing = 0 } = {}) {
  fit(c, str, maxW - spacing * str.length, size, font, weight);
  c.fillStyle = color;
  c.textBaseline = 'middle';
  if (!spacing) {
    c.textAlign = 'center';
    c.fillText(str, x, y);
    return;
  }
  c.textAlign = 'left';
  const chars = [...str];
  const total = chars.reduce((a, ch) => a + c.measureText(ch).width + spacing, -spacing);
  let cx = x - total / 2;
  for (const ch of chars) {
    c.fillText(ch, cx, y);
    cx += c.measureText(ch).width + spacing;
  }
}

function vertical(c, str, x, y0, step, size, color) {
  c.font = `bold ${size}px ${JP}`;
  c.fillStyle = color;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  [...str].forEach((ch, i) => c.fillText(ch, x, y0 + i * step));
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/**
 * The store's emblem (M3d): a firefly, ホタル, in a ring -- white on
 * whatever is under it, its tail lit yellow-green.  (cx, cy) centre, s = height.
 */
function firefly(c, cx, cy, s, color = '#ffffff') {
  c.save();
  c.translate(cx, cy);
  c.scale(s / 100, s / 100);
  // the ring
  c.strokeStyle = color;
  c.lineWidth = 6;
  c.beginPath(); c.arc(0, 0, 46, 0, Math.PI * 2); c.stroke();
  c.rotate(-0.5);
  // the glow of the tail, then the tail
  const g = c.createRadialGradient(0, 18, 2, 0, 18, 30);
  g.addColorStop(0, 'rgba(236,255,120,0.95)');
  g.addColorStop(0.45, 'rgba(210,250,90,0.45)');
  g.addColorStop(1, 'rgba(210,250,90,0)');
  c.fillStyle = g;
  c.beginPath(); c.arc(0, 18, 30, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f2ff9a';
  c.beginPath(); c.ellipse(0, 17, 9, 13, 0, 0, Math.PI * 2); c.fill();
  // the body and head
  c.fillStyle = color;
  c.beginPath(); c.ellipse(0, -6, 8, 15, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(0, -25, 7, 0, Math.PI * 2); c.fill();
  // wings, open
  c.globalAlpha = 0.9;
  c.beginPath(); c.ellipse(-15, -10, 7, 17, 0.55, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(15, -10, 7, 17, -0.55, 0, Math.PI * 2); c.fill();
  c.globalAlpha = 1;
  // feelers
  c.lineWidth = 3;
  c.beginPath(); c.moveTo(-3, -31); c.quadraticCurveTo(-8, -40, -15, -41); c.stroke();
  c.beginPath(); c.moveTo(3, -31); c.quadraticCurveTo(8, -40, 15, -41); c.stroke();
  c.restore();
}

/**
 * The blue sign band along the whole front.  `widthM` metres wide; panels are
 * placed in metres from the band's left end.
 */
export const signBand = (widthM, heightM, panels) =>
  make('signBand', 4096, Math.round((4096 / widthM) * heightM), (c, w, h) => {
    const ppm = w / widthM;
    const blueEnd = panels.blueEnd * ppm;

    // pale end cap where the band runs out before the tiled wing
    c.fillStyle = '#e4e8ee';
    c.fillRect(0, 0, w, h);

    // the blue band, a little lighter toward the top like a lit acrylic face
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a86d4');
    g.addColorStop(0.22, LAWSON_BLUE);
    g.addColorStop(1, BLUE_DEEP);
    c.fillStyle = g;
    c.fillRect(0, 0, blueEnd, h);

    // the thin white rule along the top and the pale lip below
    c.fillStyle = '#f4f8fc';
    c.fillRect(0, 0, blueEnd, h * 0.07);
    c.fillRect(0, h * 0.93, blueEnd, h * 0.07);

    // the joints between acrylic segments
    c.fillStyle = 'rgba(240,246,252,0.9)';
    for (let x = panels.segment; x < panels.blueEnd; x += panels.segment) {
      c.fillRect(x * ppm - 3, h * 0.07, 6, h * 0.86);
    }

    const panel = (x0, x1) => {
      const px = x0 * ppm, pw = (x1 - x0) * ppm;
      c.fillStyle = '#ffffff';
      c.fillRect(px, h * 0.1, pw, h * 0.8);
      c.strokeStyle = LAWSON_BLUE;
      c.lineWidth = h * 0.03;
      c.strokeRect(px + h * 0.05, h * 0.15, pw - h * 0.1, h * 0.7);
      return { px, pw };
    };

    // the wordmark panel: the store's name (M3d: HOTARU, a generic konbini)
    {
      const { px, pw } = panel(...panels.wordmark);
      text(c, STORE_NAME.mark, px + pw / 2, h * 0.52, pw * 0.9, h * 0.56, LAWSON_BLUE,
        { font: SLAB, weight: '900', spacing: h * 0.05 });
    }
    // two small category panels, as on the real fascia
    const small = (range, dot, label) => {
      const { px, pw } = panel(...range);
      c.fillStyle = dot;
      c.beginPath();
      c.arc(px + pw * 0.2, h * 0.5, h * 0.17, 0, Math.PI * 2);
      c.fill();
      text(c, label, px + pw * 0.6, h * 0.52, pw * 0.62, h * 0.4, LAWSON_BLUE);
    };
    small(panels.yasai, '#3aa25a', '野菜');
    small(panels.kudamono, '#ef7a2a', 'くだもの');
  });

/** Side sign: the band's return round the left end, with the emblem and ホタル. */
export const sideBand = (widthM, heightM) =>
  make('sideBand', 1024, Math.round((1024 / widthM) * heightM), (c, w, h) => {
    c.fillStyle = LAWSON_BLUE;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#f4f8fc';
    c.fillRect(0, 0, w, h * 0.07);
    c.fillRect(0, h * 0.93, w, h * 0.07);
    firefly(c, h * 0.62, h * 0.5, h * 0.66);
    text(c, STORE_NAME.kana, w * 0.55, h * 0.52, w * 0.6, h * 0.5, '#ffffff', { spacing: h * 0.06 });
  });

/** Small square logo plate above the door: the emblem over the wordmark. */
export const logoPlate = () =>
  make('logoPlate', 256, 256, (c, w, h) => {
    c.fillStyle = LAWSON_BLUE;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 6;
    c.strokeRect(10, 10, w - 20, h - 20);
    firefly(c, w / 2, h * 0.4, h * 0.5);
    text(c, STORE_NAME.mark, w / 2, h * 0.82, w * 0.78, 40, '#ffffff', { font: SLAB, weight: '900', spacing: 2 });
  });

/** Window posters (SPEC section 3), generic goods only. */
const POSTERS = {
  onigiri: { bg: '#fff4d6', band: '#e0453f', title: 'おにぎり', sub: '100円セール', art: '#f7f3ea' },
  shinhatsubai: { bg: '#ffe34a', band: '#e0453f', title: '新発売', sub: 'できたて', art: '#fff9d8' },
  coffee: { bg: '#f6efe6', band: '#6b4430', title: 'ホットコーヒー', sub: '100円', art: '#c89266' },
};
export const poster = (kind) =>
  make('poster-' + kind, 384, 512, (c, w, h) => {
    const p = POSTERS[kind];
    c.fillStyle = p.bg;
    c.fillRect(0, 0, w, h);
    c.fillStyle = p.band;
    c.fillRect(0, 0, w, h * 0.2);
    text(c, p.title, w / 2, h * 0.1, w * 0.9, 76, '#ffffff');
    // a flat illustration block: onigiri triangle, star burst or cup
    c.fillStyle = p.art;
    c.beginPath();
    if (kind === 'onigiri') {
      c.moveTo(w * 0.5, h * 0.28); c.lineTo(w * 0.8, h * 0.66); c.lineTo(w * 0.2, h * 0.66);
      c.closePath(); c.fill();
      c.fillStyle = '#2f3640';
      c.fillRect(w * 0.38, h * 0.52, w * 0.24, h * 0.14);
    } else if (kind === 'coffee') {
      roundRect(c, w * 0.3, h * 0.32, w * 0.4, h * 0.34, 18); c.fill();
      c.fillStyle = '#ffffff';
      c.fillRect(w * 0.3, h * 0.4, w * 0.4, h * 0.08);
    } else {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, r = i % 2 ? w * 0.18 : w * 0.3;
        c.lineTo(w * 0.5 + Math.cos(a) * r, h * 0.47 + Math.sin(a) * r);
      }
      c.closePath(); c.fill();
    }
    text(c, p.sub, w / 2, h * 0.82, w * 0.86, 64, p.band);
  });

/** Wide paper banner hung inside the glass over the entrance. */
export const doorBanner = () =>
  make('doorBanner', 1024, 160, (c, w, h) => {
    c.fillStyle = '#ffd23a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#e0453f';
    c.fillRect(0, 0, h, h);
    text(c, '新', h / 2, h / 2, h * 0.8, 110, '#ffffff');
    text(c, 'おにぎり 100円セール', w * 0.57, h * 0.52, w * 0.78, 96, '#3a2a1a');
  });

/** のぼり flags on stands (SPEC: generic goods). */
const NOBORI = [
  { bg: '#ffffff', edge: '#2a78c8', fg: '#2a78c8', t: 'カフェラテ', dot: '#a8744a' },
  { bg: '#ffe23c', edge: '#2a78c8', fg: '#1d4f9a', t: '新発売', dot: '#e0453f' },
  { bg: '#ffffff', edge: '#e0453f', fg: '#c83a34', t: 'ホットコーヒー', dot: '#6b4430' },
  { bg: '#fff3c8', edge: '#3aa25a', fg: '#2f7a46', t: 'おにぎり', dot: '#3aa25a' },
];
export const nobori = (i) =>
  make('nobori-' + i, 160, 640, (c, w, h) => {
    const n = NOBORI[i % NOBORI.length];
    c.fillStyle = n.bg;
    c.fillRect(0, 0, w, h);
    c.fillStyle = n.edge;
    c.fillRect(0, 0, w, 26);
    c.fillRect(0, 0, 14, h);
    c.fillStyle = n.dot;
    c.beginPath();
    c.arc(w * 0.55, h * 0.84, w * 0.26, 0, Math.PI * 2);
    c.fill();
    const chars = [...n.t];
    const step = Math.min(92, (h * 0.66) / chars.length);
    vertical(c, n.t, w * 0.56, 70 + step / 2, step, Math.min(84, step * 0.92), n.fg);
  });

/** Pale blue-white square tiles for the wall at the right end. */
export const tileTex = (repeatX, repeatY) => {
  const t = make('tiles', 128, 128, (c, w, h) => {
    c.fillStyle = '#e3eaf1';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#b9c6d6';
    c.fillRect(0, 0, w, 5);
    c.fillRect(0, 0, 5, h);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  return t;
};

/**
 * The store interior as seen through the glass, painted.  M3 replaces this
 * card with the real interior.  Width `widthM`, height `heightM`.
 */
export const interiorCard = (widthM, heightM) =>
  make('interior', 4096, Math.round((4096 / widthM) * heightM), (c, w, h) => {
    const ppm = w / widthM;
    // back wall: warm white, a cooler ceiling zone with the light rows
    c.fillStyle = '#e4dfd6';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#eef0f4';
    c.fillRect(0, 0, w, h * 0.2);
    c.fillStyle = '#ffffff';
    for (let x = 0.4; x < widthM; x += 2.2) c.fillRect(x * ppm, h * 0.04, 1.6 * ppm, h * 0.035);

    // the drinks wall: lit fridge bays with rows of bottle colours
    const bottle = ['#e0453f', '#3aa25a', '#2a78c8', '#f4c033', '#f7f3ea', '#ef7a2a', '#8f6fb5', '#6ac0d8'];
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let bx = 0.2; bx < widthM - 0.4; bx += 1.3) {
      const x = bx * ppm, bw = 1.2 * ppm;
      c.fillStyle = '#d6e4f0';
      c.fillRect(x, h * 0.24, bw, h * 0.52);
      c.fillStyle = '#c0ccd8';
      c.fillRect(x, h * 0.24, bw, h * 0.012);
      for (let row = 0; row < 5; row++) {
        const y = h * (0.28 + row * 0.095);
        for (let k = 0; k < 9; k++) {
          c.fillStyle = bottle[Math.floor(rnd() * bottle.length)];
          c.fillRect(x + (k + 0.15) * (bw / 9), y, (bw / 9) * 0.7, h * 0.06);
        }
        c.fillStyle = '#b7c0cc';
        c.fillRect(x, y + h * 0.065, bw, h * 0.008);
      }
    }
    // gondola shelves in front of it, cut off at 1.6 m: see over them
    const shelfTop = h * (1 - 1.6 / heightM);
    for (let sx = 0.6; sx < widthM - 1; sx += 3.1) {
      const x = sx * ppm, sw = 2.5 * ppm;
      c.fillStyle = '#c9ced8';
      c.fillRect(x, shelfTop, sw, h - shelfTop);
      for (let row = 0; row < 4; row++) {
        const y = shelfTop + (row + 0.2) * ((h - shelfTop) / 4.3);
        for (let k = 0; k < 12; k++) {
          c.fillStyle = bottle[Math.floor(rnd() * bottle.length)];
          c.globalAlpha = 0.85;
          c.fillRect(x + (k + 0.1) * (sw / 12), y, (sw / 12) * 0.8, (h - shelfTop) / 7);
        }
        c.globalAlpha = 1;
        c.fillStyle = '#9aa4b2';
        c.fillRect(x, y + (h - shelfTop) / 6.4, sw, h * 0.01);
      }
    }
    // a pale floor strip
    c.fillStyle = '#e8e6e0';
    c.fillRect(0, h * 0.97, w, h * 0.03);
  });

/** Ceiling seen through the upper glass: rows of flush light panels. */
export const ceilingTex = (widthM, depthM) =>
  make('ceiling', 1024, 512, (c, w, h) => {
    c.fillStyle = '#d8dce4';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff';
    const ppmX = w / widthM, ppmZ = h / depthM;
    for (let z = 0.8; z < depthM; z += 2.2) {
      for (let x = 0.6; x < widthM - 0.6; x += 2.4) {
        c.fillRect(x * ppmX, z * ppmZ, 1.8 * ppmX, 0.35 * ppmZ);
      }
    }
  });

/** Diagonal shine streaks for the glass: white on transparent. */
export const glassShine = () =>
  make('glassShine', 512, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.55)';
    const streak = (x, wd) => {
      c.beginPath();
      c.moveTo(x, h); c.lineTo(x + wd, h); c.lineTo(x + wd + h * 0.55, 0); c.lineTo(x + h * 0.55, 0);
      c.closePath(); c.fill();
    };
    streak(w * 0.08, 18); streak(w * 0.13, 7);
    streak(w * 0.46, 26); streak(w * 0.53, 9);
    streak(w * 0.8, 14);
  }, { srgb: false });

/** The hard-edged painted pool of window light on the forecourt. */
export const spillTex = (bays) =>
  make('spill', 1024, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#ffffff';
    // one trapezoid per glass bay, fanning out slightly toward the road
    for (const [a, b] of bays) {
      const x0 = a * w, x1 = b * w;
      c.beginPath();
      c.moveTo(x0 + 3, 0); c.lineTo(x1 - 3, 0);
      c.lineTo(x1 + (x1 - w / 2) * 0.08, h); c.lineTo(x0 + (x0 - w / 2) * 0.08, h);
      c.closePath();
      c.fill();
    }
    // fade the far edge so the pool ends softly on the asphalt
    c.globalCompositeOperation = 'destination-out';
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.1)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
  }, { srgb: false });

/** Small red notice on the tiled wall. */
export const redNotice = () =>
  make('redNotice', 128, 256, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#d8342f';
    c.fillRect(0, 0, w, h * 0.42);
    text(c, '24時間', w / 2, h * 0.21, w * 0.86, 36, '#ffffff');
    text(c, '営業中', w / 2, h * 0.62, w * 0.86, 34, '#d8342f');
  });

/* ------------------------------------------------------------------ *
 * Food posters (M2e).  The real store's glass is papered with food:
 * glossy illustrations, a price in a burst, a slogan.  Ours are painted
 * (world/foodart.js) and every item is generic.
 * ------------------------------------------------------------------ */

const FOOD_POSTERS = {
  onigiri: { bg: ['#fff6e2', '#ffe9c4'], band: '#d8342f', title: 'おにぎり', sub: 'ふっくら炊きたて', price: '¥128', art: 'onigiri2' },
  latte: { bg: ['#f7efe4', '#e9d6bf'], band: '#6b4a34', title: 'カフェラテ', sub: 'ミルクたっぷり', price: 'S ¥150', art: 'latte' },
  karaage: { bg: ['#fff4c4', '#ffe38a'], band: '#e0453f', title: 'からあげ', sub: '揚げたて', price: '¥238', art: 'karaage' },
  sandwich: { bg: ['#f0f7e6', '#dcefcc'], band: '#3f8f4a', title: 'たまごサンド', sub: 'ふんわり', price: '¥298', art: 'sandwich' },
  bento: { bg: ['#fff0ea', '#ffd9cc'], band: '#c43a3a', title: 'のり弁当', sub: 'あたためできます', price: '¥450', art: 'bento' },
  nikuman: { bg: ['#fdf3ea', '#f5e1cc'], band: '#b6413a', title: '肉まん', sub: 'ほかほか', price: '¥160', art: 'nikuman' },
};

/** A price in a jagged burst. */
function burst(c, x, y, r, str) {
  c.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, k = i % 2 ? 0.78 : 1;
    c.lineTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k);
  }
  c.closePath();
  c.fillStyle = '#ffd23a'; c.fill();
  c.lineWidth = 4; c.strokeStyle = '#d8342f'; c.stroke();
  text(c, str, x, y + 2, r * 1.5, r * 0.62, '#d8342f');
}

/** A food poster: `kind` from FOOD_POSTERS. */
export const foodPoster = (kind) =>
  make('foodPoster-' + kind, 512, 704, (c, w, h) => {
    const p = FOOD_POSTERS[kind];
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, p.bg[0]); g.addColorStop(1, p.bg[1]);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // soft rays behind the food
    c.save();
    c.translate(w / 2, h * 0.5);
    c.fillStyle = 'rgba(255,255,255,0.45)';
    for (let i = 0; i < 12; i++) {
      c.rotate(Math.PI / 6);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-w * 0.08, -w); c.lineTo(w * 0.08, -w); c.closePath(); c.fill();
    }
    c.restore();
    c.fillStyle = p.band; c.fillRect(0, 0, w, h * 0.17);
    text(c, p.title, w / 2, h * 0.087, w * 0.88, 96, '#ffffff');
    const s = w * 0.62, cy = h * 0.5;
    if (p.art === 'onigiri2') {
      FOOD.onigiri(c, w * 0.36, cy + s * 0.05, s * 0.72, { filling: '#e8795a', seed: 3 });
      FOOD.onigiri(c, w * 0.66, cy - s * 0.02, s * 0.66, { filling: '#3a2f2a', seed: 9 });
    } else {
      FOOD[p.art](c, w / 2, cy, s);
    }
    burst(c, w * 0.8, h * 0.72, w * 0.14, p.price);
    text(c, p.sub, w / 2, h * 0.9, w * 0.86, 64, p.band);
  });

/** The long campaign banner across the top of the glass. */
export const campaignBanner = () =>
  make('campaignBanner', 1280, 200, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#fff3c0'); g.addColorStop(1, '#ffe07a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#d8342f';
    c.beginPath(); c.arc(h * 0.62, h / 2, h * 0.4, 0, Math.PI * 2); c.fill();
    text(c, '新', h * 0.62, h / 2 + 3, h * 0.6, 104, '#ffffff');
    text(c, 'ふっくらおにぎり 始まる', w * 0.54, h * 0.52, w * 0.66, 112, '#3a2a1a');
    FOOD.onigiri(c, w * 0.93, h * 0.52, h * 0.78, { seed: 4 });
    c.fillStyle = 'rgba(58,42,26,0.25)'; c.fillRect(0, h - 6, w, 6);
  });

/** Konbini recycling labels: 燃えるゴミ / かん・びん / ペットボトル, one strip. */
export const binLabels = () =>
  make('binLabels', 768, 192, (c, w, h) => {
    const cols = [['燃えるゴミ', '#d8342f'], ['かん・びん', '#2f6fb6'], ['ペットボトル', '#3f8f4a']];
    cols.forEach(([t, col], i) => {
      const x = (i * w) / 3;
      c.fillStyle = '#ffffff'; c.fillRect(x + 6, 6, w / 3 - 12, h - 12);
      c.fillStyle = col; c.fillRect(x + 6, 6, w / 3 - 12, h * 0.34);
      text(c, t, x + w / 6, h * 0.2, w / 3 - 30, 40, '#ffffff');
      // the slot
      c.fillStyle = '#2a2a33';
      c.beginPath(); c.roundRect(x + w / 6 - 50, h * 0.5, 100, i === 2 ? 70 : 34, 16); c.fill();
    });
  });

/** A small red ATM sign for the side wall. */
export const atmSign = () =>
  make('atmSign', 256, 160, (c, w, h) => {
    c.fillStyle = '#d8342f'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff'; c.fillRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#d8342f'; c.fillRect(14, 14, w - 28, h * 0.5);
    text(c, 'ATM', w / 2, h * 0.34, w * 0.8, 70, '#ffffff', { font: SLAB });
    text(c, '24時間', w / 2, h * 0.78, w * 0.8, 36, '#d8342f');
  });
