import * as THREE from 'three';
import { SHOTENGAI, ROAD_CLOSED } from '../data/town.js';

/* ------------------------------------------------------------------ *
 * Canvas2D signage for the town (AGENTS.md: signs are drawn in code).
 * Names come from src/data/town.js.
 * ------------------------------------------------------------------ */

const JP = `'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Yu Gothic UI', Meiryo, 'Noto Sans JP', sans-serif`;
const cache = new Map();

function make(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

function text(c, str, x, y, maxW, size, color, weight = 'bold') {
  let s = size;
  do {
    c.font = `${weight} ${s}px ${JP}`;
    if (c.measureText(str).width <= maxW) break;
    s -= 1;
  } while (s > 6);
  c.fillStyle = color;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(str, x, y);
}

/** The arch board over the shopping street's entrance. */
export const archBoard = () =>
  make('arch', 1536, 256, (c, w, h) => {
    c.fillStyle = '#f7f1e2';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#b5322f';
    c.fillRect(0, 0, w, 18);
    c.fillRect(0, h - 18, w, 18);
    // a small painted Fuji either side of the name
    for (const x of [w * 0.08, w * 0.92]) {
      c.fillStyle = '#5169b8';
      c.beginPath();
      c.moveTo(x - 70, h * 0.72); c.lineTo(x, h * 0.26); c.lineTo(x + 70, h * 0.72);
      c.closePath(); c.fill();
      c.fillStyle = '#f7f8ff';
      c.beginPath();
      c.moveTo(x - 24, h * 0.42); c.lineTo(x, h * 0.26); c.lineTo(x + 24, h * 0.42);
      c.closePath(); c.fill();
    }
    text(c, SHOTENGAI.jp, w / 2, h * 0.44, w * 0.72, 130, '#2b3346');
    text(c, SHOTENGAI.en, w / 2, h * 0.8, w * 0.5, 40, '#8a8696', '600');
  });

/** Road-closed board on the barricades where the main road leaves town. */
export const closedBoard = () =>
  make('closed', 512, 256, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d8342f';
    c.lineWidth = 18;
    c.strokeRect(9, 9, w - 18, h - 18);
    text(c, ROAD_CLOSED, w / 2, h * 0.42, w - 80, 120, '#d8342f');
    text(c, 'この先 工事中', w / 2, h * 0.76, w - 120, 44, '#3a3350', '600');
  });

/** Sorting labels for the Lawson's bin station (SPEC section 3). */
const BIN = [
  { t: '燃える', s: 'ごみ', bg: '#d8453f' },
  { t: '缶・ペット', s: 'びん', bg: '#2a78c8' },
  { t: 'プラ', s: 'スチック', bg: '#3aa25a' },
];
export const binLabel = (i) =>
  make('bin' + i, 256, 256, (c, w, h) => {
    const b = BIN[i % BIN.length];
    c.fillStyle = '#f6f7f8';
    c.fillRect(0, 0, w, h);
    c.fillStyle = b.bg;
    c.fillRect(0, 0, w, h * 0.46);
    text(c, b.t, w / 2, h * 0.24, w - 30, 64, '#ffffff');
    text(c, b.s, w / 2, h * 0.7, w - 40, 48, '#3a3350', '600');
  });

/** 線路内立入禁止: where the line leaves town into its cutting. */
export const noEntryPlate = () =>
  make('noEntry', 256, 512, (c, w, h) => {
    c.fillStyle = '#fdf8f0';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#d8342f';
    c.fillRect(0, 0, w, 90);
    text(c, '危険', w / 2, 45, w - 40, 64, '#ffffff');
    c.font = `bold 60px ${JP}`;
    c.fillStyle = '#2b3346';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    [...'線路内立入禁止'].forEach((ch, i) => c.fillText(ch, w / 2, 140 + i * 52));
  });

/** 畑: a vegetable field seen from the lane -- dark soil ridges, green rows. */
export const fieldTex = (variant = 0) => {
  const t = make('field' + variant, 256, 256, (c, w, h) => {
    c.fillStyle = variant ? '#8f7a5e' : '#9a8266';
    c.fillRect(0, 0, w, h);
    const rows = 8;
    for (let i = 0; i < rows; i++) {
      const y = (i + 0.5) * (h / rows);
      c.fillStyle = '#7a654c';
      c.fillRect(0, y - 9, w, 18);
      c.fillStyle = variant ? '#6f9f5c' : '#5f9a64';
      for (let x = 6; x < w; x += 16) {
        c.beginPath();
        c.ellipse(x + (i % 2) * 8, y, 7, 6, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
