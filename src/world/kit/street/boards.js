import * as THREE from 'three';
import { cel } from '../../../core/toon.js';
import { trs, bake } from '../../../core/util.js';
import { JP, JP_ROUND } from '../tex.js';
import { A_BOARDS, WALK_SIGNS, POLE_TAG } from '../../../data/town.js';

/* ------------------------------------------------------------------ *
 * Lettered street furniture (town quality pass), drawn with Canvas2D at
 * the size it is seen (128-256 px wide).  Plain meshes: the batcher packs
 * their faces into its atlas pages, so they cost no draws of their own.
 *
 *   aBoard(i)        a shop's A-frame board (立て看板), menu both sides
 *   walkPlate(kind)  a plate on a short post: 駐輪禁止, the way to the station
 *   poleTag(n)       電柱番号札: the small plate every pole carries
 * ------------------------------------------------------------------ */

const cache = new Map();
function tex(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

function fit(c, str, x, y, maxW, size, color, { font = JP, weight = 'bold' } = {}) {
  let s = size;
  do {
    c.font = `${weight} ${s}px ${font}`;
    if (c.measureText(str).width <= maxW) break;
    s -= 1;
  } while (s > 6);
  c.fillStyle = color;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(str, x, y);
}

const M = {};
function mats() {
  if (M.frame) return M;
  M.frame = cel({ color: 0x8a6a4e, bands: 3, tint: 0x5a4a6a });
  M.alu = cel({ color: 0xc4c8d2, bands: 3, tint: 0x666090 });
  M.post = cel({ color: 0xc4c8d2, bands: 3, tint: 0x666090 });
  M.base = cel({ color: 0x8b8f9a, bands: 3, tint: 0x5c5680 });
  return M;
}
const faceMat = (map) => cel({ color: 0xffffff, map, bands: 3, tint: 0x6a6288, cache: false });

/* ------------------------------------------------------------ A-boards */

function boardTex(i) {
  const b = A_BOARDS[i % A_BOARDS.length];
  return tex(`aboard|${i % A_BOARDS.length}`, 128, 192, (c, w, h) => {
    c.fillStyle = b.bg; c.fillRect(0, 0, w, h);
    if (b.chalk) {
      // a chalk board: smudged dust, a drawn border, hand-lettered in round
      c.fillStyle = 'rgba(255,255,255,0.06)';
      for (let k = 0; k < 14; k++) c.fillRect((k * 37) % w, (k * 53) % h, 30, 12);
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2; c.setLineDash([6, 4]);
      c.strokeRect(8, 8, w - 16, h - 16); c.setLineDash([]);
      fit(c, b.t, w / 2, 34, w - 24, 20, '#f6d26a', { font: JP_ROUND });
      b.l.forEach((l, k) => fit(c, l, w / 2, 86 + k * 40, w - 24, 18, b.ink, { font: JP_ROUND }));
      c.fillStyle = '#f09ab8';
      for (const [x, y] of [[26, 160], [100, 164], [62, 170]]) { c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); }
    } else {
      // a printed board: a coloured head band and bold lines
      c.fillStyle = b.ink; c.fillRect(0, 0, w, 50);
      fit(c, b.t, w / 2, 26, w - 16, 26, b.bg);
      b.l.forEach((l, k) => fit(c, l, w / 2, 86 + k * 44, w - 18, k ? 30 : 20, b.ink));
      c.fillStyle = b.ink; c.fillRect(0, h - 8, w, 8);
    }
  });
}

/** An A-frame board, feet on the ground at the origin, facing +z. */
export function aBoard(i = 0) {
  const m = mats();
  const g = new THREE.Group();
  const W = 0.5, H = 0.78, open = 0.2;          // half the splay at the foot
  const lean = Math.atan2(open, H);
  const alu = i % 3 === 2;
  const face = faceMat(boardTex(i));
  for (const s of [1, -1]) {
    const side = new THREE.Group();
    side.position.set(0, 0, s * open);
    side.rotation.x = -s * lean;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.06, H - 0.1), face);
    p.position.set(0, H / 2 + 0.02, s * 0.022);
    if (s < 0) p.rotation.y = Math.PI;
    p.castShadow = true;
    side.add(p);
    // the frame round it
    const fr = new THREE.Mesh(bake([
      { geometry: new THREE.BoxGeometry(0.035, H, 0.035), matrix: trs(-W / 2 + 0.017, H / 2, 0) },
      { geometry: new THREE.BoxGeometry(0.035, H, 0.035), matrix: trs(W / 2 - 0.017, H / 2, 0) },
      { geometry: new THREE.BoxGeometry(W, 0.05, 0.035), matrix: trs(0, H - 0.025, 0) },
      { geometry: new THREE.BoxGeometry(W, 0.04, 0.03), matrix: trs(0, 0.06, 0) },
    ]), alu ? m.alu : m.frame);
    fr.castShadow = true;
    side.add(fr);
    g.add(side);
  }
  return g;
}

/* ------------------------------------------------------------ walk plates */

const PLATE = {
  noBikes: {
    size: [128, 224], draw: (c, w, h) => {
      c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#d8302c'; c.fillRect(0, 0, w, 58);
      fit(c, WALK_SIGNS.noBikes, w / 2, 30, w - 12, 30, '#fbfaf6');
      // a bicycle, struck out
      c.strokeStyle = '#20243a'; c.lineWidth = 5;
      for (const x of [40, 88]) { c.beginPath(); c.arc(x, 110, 18, 0, Math.PI * 2); c.stroke(); }
      c.beginPath(); c.moveTo(40, 110); c.lineTo(58, 86); c.lineTo(80, 86); c.lineTo(88, 110); c.moveTo(40, 110); c.lineTo(66, 110); c.lineTo(80, 86); c.stroke();
      c.strokeStyle = '#d8302c'; c.lineWidth = 7;
      c.beginPath(); c.arc(64, 104, 38, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(38, 78); c.lineTo(90, 130); c.stroke();
      const t = WALK_SIGNS.removal;
      fit(c, t.slice(0, 5), w / 2, 168, w - 14, 18, '#20243a');
      fit(c, t.slice(5), w / 2, 194, w - 14, 18, '#20243a');
    },
  },
  station: {
    size: [256, 96], draw: (c, w, h) => {
      c.fillStyle = '#2458b8'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#fbfaf6'; c.lineWidth = 4; c.strokeRect(6, 6, w - 12, h - 12);
      fit(c, WALK_SIGNS.station, w * 0.42, h * 0.4, w * 0.62, 34, '#fbfaf6');
      fit(c, WALK_SIGNS.thisWay, w * 0.42, h * 0.76, w * 0.4, 18, '#fbfaf6', { weight: 'normal' });
      // the arrow points along the plate's +x (turned by the placement)
      c.fillStyle = '#fbfaf6';
      c.beginPath(); c.moveTo(w - 18, h / 2); c.lineTo(w - 58, h / 2 - 26); c.lineTo(w - 58, h / 2 - 10);
      c.lineTo(w - 86, h / 2 - 10); c.lineTo(w - 86, h / 2 + 10); c.lineTo(w - 58, h / 2 + 10); c.lineTo(w - 58, h / 2 + 26); c.fill();
    },
  },
};

/** A plate of `kind` on a short post (feet at the origin, facing +z). */
export function walkPlate(kind) {
  const m = mats();
  const d = PLATE[kind];
  const [w, h] = d.size;
  const map = tex(`walk|${kind}`, w, h, d.draw);
  const g = new THREE.Group();
  const pw = kind === 'station' ? 0.9 : 0.34, ph = pw * h / w;
  const top = kind === 'station' ? 2.3 : 1.55;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, top, 8), m.post);
  post.position.y = top / 2;
  post.castShadow = true;
  g.add(post);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.06, 8), m.base);
  base.position.y = 0.03;
  g.add(base);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), faceMat(map));
  face.position.set(0, top - ph / 2, 0.04);
  face.castShadow = true;
  g.add(face);
  const back = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, 0.012), m.post);
  back.position.set(0, top - ph / 2, 0.03);
  g.add(back);
  return g;
}

/* ------------------------------------------------------------ pole tags */

/** 電柱番号札 for pole `n`: aluminium, the line name, a number. */
export function poleTagTex(n) {
  const v = n % 8;
  return tex(`poletag|${v}`, 64, 160, (c, w, h) => {
    c.fillStyle = '#e8eaee'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#20243a'; c.fillRect(0, 0, w, 4); c.fillRect(0, h - 4, w, 4);
    [...POLE_TAG.line].forEach((g, i) => fit(c, g, w / 2, 18 + i * 22, w - 10, 18, '#20243a'));
    fit(c, String(12 + v * 7), w / 2, 112, w - 8, 24, '#20243a');
    fit(c, POLE_TAG.branch[v % 2] + (1 + (v % 3)), w / 2, 140, w - 10, 16, '#20243a');
  });
}
