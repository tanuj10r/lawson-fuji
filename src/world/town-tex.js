import * as THREE from 'three';
import { ROAD_CLOSED } from '../data/town.js';

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

