import * as THREE from 'three';
import { JP, JP_ROUND } from '../tex.js';
import { STREET_WORDS as W } from '../../../data/town.js';

/* ------------------------------------------------------------------ *
 * The streets' own decal atlas (town quality pass): what the kit's main
 * atlas (kit/tex.js) has no room for, at 1024 x 512 (4 x 2 cells of 256,
 * about 2.8 MB with mips).  kit/decals.js draws it as a second mesh.
 *
 *   mhFuji     the town's coloured design lid: Fuji, sakura, おすい
 *   mhRelief   the same design cast in grey, unpainted, worn bright
 *   tomareOld  止まれ worn half away by tyres
 *   n30Old     30, likewise
 *   gasLid     a small round ガス valve lid (pavements)
 *   valveLid   a small square 制水弁 lid, blue-grey
 *   noBikesPaint  駐輪禁止 stencilled in yellow on a pavement
 *   fireBox    the yellow box painted round a hydrant lid, 消火栓
 * ------------------------------------------------------------------ */

const AW = 1024, AH = 512, S = 256, PAD = 8;
const WHITE = '#f6f4f8', YELLOW = '#f2c23c';

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

function text(c, str, x, y, maxW, size, color, { sy = 1, font = JP } = {}) {
  let s = size;
  do {
    c.font = `bold ${s}px ${font}`;
    if (c.measureText(str).width <= maxW) break;
    s -= 1;
  } while (s > 6);
  c.save();
  c.translate(x, y);
  c.scale(1, sy);
  c.fillStyle = color;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(str, 0, 0);
  c.restore();
}

/** Knock specks out (paint wear); `band` concentrates it in wheel tracks. */
function wear(c, w, h, seed, amount, band = null) {
  const r = rng(seed);
  c.save();
  c.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < amount; i++) {
    let x = r() * w;
    if (band && r() < 0.7) x = band[Math.floor(r() * band.length)] * w + (r() - 0.5) * w * 0.28;
    c.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.6})`;
    c.fillRect(x, r() * h, 2 + r() * 7, 1 + r() * 4);
  }
  c.restore();
}

/** The lid's cast frame: a darker ring with a chequer of anti-slip studs. */
function lidFrame(c, w, h, face) {
  const cx = w / 2, cy = h / 2, R = w / 2 - 4;
  c.fillStyle = '#6f6a7c';
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#8b8698';
  c.beginPath(); c.arc(cx, cy, R * 0.93, 0, Math.PI * 2); c.fill();
  // the studded rim band
  c.fillStyle = 'rgba(70,64,86,0.55)';
  for (let k = 0; k < 44; k++) {
    const a = (k / 44) * Math.PI * 2;
    for (const f of [0.8, 0.87]) {
      const x = cx + Math.cos(a + (f > 0.83 ? 0.07 : 0)) * R * f, y = cy + Math.sin(a + (f > 0.83 ? 0.07 : 0)) * R * f;
      c.fillRect(x - 2, y - 2, 4, 4);
    }
  }
  c.fillStyle = face;
  c.beginPath(); c.arc(cx, cy, R * 0.74, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(50,46,64,0.7)'; c.lineWidth = 3;
  c.beginPath(); c.arc(cx, cy, R * 0.74, 0, Math.PI * 2); c.stroke();
  return { cx, cy, r: R * 0.74 };
}

/** The design: Fuji over the town's roofs, sakura sprays either side. */
function design(c, cx, cy, r, painted) {
  c.save();
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
  const sky = painted ? '#6aa6d8' : '#9c97a8';
  const snow = painted ? '#fbfbff' : '#c4bfcc';
  const hill = painted ? '#4f78b8' : '#837d92';
  const pink = painted ? '#f09ab8' : '#aca6b8';
  const green = painted ? '#5f9a64' : '#7a748a';
  c.fillStyle = sky; c.fillRect(cx - r, cy - r, r * 2, r * 2);
  // Fuji
  c.fillStyle = hill;
  c.beginPath(); c.moveTo(cx - r, cy + r * 0.35); c.lineTo(cx - r * 0.2, cy - r * 0.45); c.lineTo(cx + r * 0.2, cy - r * 0.45); c.lineTo(cx + r, cy + r * 0.35); c.closePath(); c.fill();
  c.fillStyle = snow;
  c.beginPath(); c.moveTo(cx - r * 0.47, cy - r * 0.14);
  for (let i = 0; i <= 6; i++) c.lineTo(cx - r * 0.47 + (i / 6) * r * 0.94, cy - r * (i % 2 ? 0.02 : 0.14));
  c.lineTo(cx + r * 0.2, cy - r * 0.45); c.lineTo(cx - r * 0.2, cy - r * 0.45); c.closePath(); c.fill();
  // the foot: a green band and the word
  c.fillStyle = green; c.fillRect(cx - r, cy + r * 0.3, r * 2, r);
  // sakura sprays
  const rr = rng(painted ? 91 : 92);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const px = cx + side * r * (0.55 + rr() * 0.35), py = cy - r * (0.55 - i * 0.15) + rr() * 8;
      c.fillStyle = pink;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        c.beginPath(); c.ellipse(px + Math.cos(a) * 6, py + Math.sin(a) * 6, 5.5, 3.6, a, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = painted ? '#f8e070' : '#8b8698';
      c.beginPath(); c.arc(px, py, 2.4, 0, Math.PI * 2); c.fill();
    }
  }
  text(c, W.sewer, cx, cy + r * 0.62, r * 1.1, 30, painted ? '#ffffff' : '#5c576a', { font: JP_ROUND });
  // cast relief lines read as ink even on the painted lid
  c.strokeStyle = 'rgba(40,36,56,0.55)'; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(cx - r, cy + r * 0.35); c.lineTo(cx - r * 0.2, cy - r * 0.45); c.lineTo(cx + r * 0.2, cy - r * 0.45); c.lineTo(cx + r, cy + r * 0.35); c.stroke();
  c.beginPath(); c.moveTo(cx - r, cy + r * 0.3); c.lineTo(cx + r, cy + r * 0.3); c.stroke();
  c.restore();
  text(c, W.town, cx, cy - r * 1.14, r * 0.8, 20, 'rgba(50,46,64,0.8)', { font: JP_ROUND });
}

const CELLS = {
  mhFuji: {
    at: [0, 0], draw: (c, w, h) => {
      const f = lidFrame(c, w, h, '#8b8698');
      design(c, f.cx, f.cy, f.r, true);
      // paint scuffed off where wheels cross it
      wear(c, w, h, 31, 90);
    },
  },
  mhRelief: {
    at: [1, 0], draw: (c, w, h) => {
      const f = lidFrame(c, w, h, '#8f8a9c');
      design(c, f.cx, f.cy, f.r, false);
      // the raised parts polished pale by tyres
      const r = rng(33);
      c.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i = 0; i < 160; i++) c.fillRect(r() * w, r() * h, 3, 2);
    },
  },
  tomareOld: {
    at: [2, 0], draw: (c, w, h) => {
      [...W.tomare].forEach((g, i) => text(c, g, w * (i + 0.5) / 3, h / 2, w / 3, 86, WHITE, { sy: 2.8 }));
      wear(c, w, h, 35, 1400, [0.28, 0.72]);
    },
  },
  n30Old: {
    at: [3, 0], draw: (c, w, h) => {
      text(c, '30', w / 2, h / 2, w, 140, WHITE, { sy: 1.7 });
      wear(c, w, h, 36, 1100, [0.3, 0.7]);
    },
  },
  gasLid: {
    at: [0, 1], draw: (c, w, h) => {
      const cx = w / 2, cy = h / 2, R = w / 2 - 6;
      c.fillStyle = '#6f6a7c'; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#9a95a6'; c.beginPath(); c.arc(cx, cy, R * 0.86, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(60,54,76,0.6)'; c.lineWidth = 4;
      for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(cx - R * 0.7, cy + k * 16); c.lineTo(cx + R * 0.7, cy + k * 16); c.stroke(); }
      c.fillStyle = '#e8c040'; c.fillRect(cx - 52, cy - 26, 104, 52);
      text(c, W.gas, cx, cy, 90, 44, '#3a3448');
      wear(c, w, h, 37, 60);
    },
  },
  valveLid: {
    at: [1, 1], draw: (c, w, h) => {
      c.fillStyle = '#5f6a86'; c.fillRect(8, 8, w - 16, h - 16);
      c.fillStyle = '#7d88a4'; c.fillRect(22, 22, w - 44, h - 44);
      c.fillStyle = 'rgba(40,44,70,0.45)';
      for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) if ((i + j) % 2) c.fillRect(30 + i * 28, 30 + j * 28, 12, 12);
      c.fillStyle = '#7d88a4'; c.fillRect(w / 2 - 70, h / 2 - 26, 140, 52);
      text(c, W.valve, w / 2, h / 2, 128, 40, '#f4f6fa');
      wear(c, w, h, 38, 80);
    },
  },
  noBikesPaint: {
    at: [2, 1], draw: (c, w, h) => {
      // 駐輪禁止 stencilled on the pavement in yellow, in a box
      c.strokeStyle = YELLOW; c.lineWidth = 8;
      c.strokeRect(10, 40, w - 20, h - 80);
      [...W.noBikes].forEach((g, i) => text(c, g, w * (i + 0.5) / 4, h / 2, w / 4 - 6, 56, YELLOW, { sy: 1.6 }));
      wear(c, w, h, 39, 420);
    },
  },
  fireBox: {
    at: [3, 1], draw: (c, w, h) => {
      c.strokeStyle = YELLOW; c.lineWidth = 12;
      c.strokeRect(14, 14, w - 28, h - 28);
      text(c, W.hydrant, w / 2, h * 0.17, w - 70, 36, YELLOW);
      wear(c, w, h, 40, 260);
    },
  },
};

let atlas = null;
export function streetAtlas() {
  if (atlas) return atlas;
  const cv = document.createElement('canvas');
  cv.width = AW;
  cv.height = AH;
  const c = cv.getContext('2d');
  for (const cell of Object.values(CELLS)) {
    const x = cell.at[0] * S + PAD, y = cell.at[1] * S + PAD;
    const w = S - PAD * 2, h = S - PAD * 2;
    c.save();
    c.translate(x, y);
    c.beginPath(); c.rect(0, 0, w, h); c.clip();
    cell.draw(c, w, h);
    c.restore();
  }
  atlas = new THREE.CanvasTexture(cv);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 8;
  return atlas;
}

export const isStreetCell = (name) => name in CELLS;

export function streetUV(name) {
  const cell = CELLS[name];
  const inset = PAD + 1;
  const x0 = cell.at[0] * S + inset, x1 = (cell.at[0] + 1) * S - inset;
  const y0 = cell.at[1] * S + inset, y1 = (cell.at[1] + 1) * S - inset;
  return [x0 / AW, 1 - y1 / AH, x1 / AW, 1 - y0 / AH];
}
