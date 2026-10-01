import { renderHachi, bounds, cut } from './hachiSprite.js';
import { compose, POL } from '../ui/postcardSelfie.js';

/* Dev only (scripts/hachi-options.mjs): three Hachis for the selfie
 * postcard, for Tan to choose from (2026-10-01: "something adorable and
 * in hi res; generate 2-3 images first").  Each is the game's pup with
 * chibi proportions, big eyes, rosy cheeks, a closed smile (a tiny blep
 * at most), rendered large with alpha; shown alone and on the polaroid
 * in the saved picture.  Nothing here is wired into the game.
 *
 *   A  peeking over the polaroid's top edge: two paws, a head tilt, a blep
 *   B  round the polaroid's top left corner: paws on it, leaning in, a wink
 *   C  sitting on top of it: tail curled, a hachimaki, a petal on his nose
 */
const BASE = { size: 1900, inkPx: 7, fov: 15, face: [0, 0, 0, 1], body: [0, 0, 0, 0], blush: 0.55 };
export const OPTIONS = {
  A: { ...BASE, posture: 0, more: [0, 0, 1, 0], tilt: 0.3, nod: -0.04, ears: 1.13, face: [0, 0.2, 0, 1], headK: 1.2, bodyK: 0.9, cam: [0.04, 0.3, 1.6], at: [0, 0.215, 0.12] },
  B: { ...BASE, posture: 0, more: [0, 0, 1, 0], tilt: 0.36, nod: 0.02, look: 0.12, ears: 1, face: [0, 0.45, 0, 1], wink: -1, blush: 0.65, headK: 1.2, bodyK: 0.9, cam: [0.1, 0.3, 1.6], at: [0, 0.215, 0.12] },
  C: { ...BASE, posture: 1, more: [0, 0, 0, 0], yaw: -0.62, look: 0.5, tilt: 0.16, nod: -0.02, ears: 1.1, wag: 0.25, band: true, headK: 1.22, bodyK: 0.94, cam: [0, 0.27, 1.9], at: [0, 0.2, 0.02], fov: 16.5 },
};

/** All of him and his forelegs, cut to one frame; where his forelegs are down it; a point of his head in it. */
function pair(o) {
  const all = renderHachi(o), legs = renderHachi({ ...o, only: 'paws' });
  const a = bounds(all), l = bounds(legs), pad = 10;
  const r = { x0: Math.max(0, a.x0 - pad), y0: Math.max(0, a.y0 - pad), x1: Math.min(all.width - 1, a.x1 + pad), y1: Math.min(all.height - 1, a.y1 + pad) };
  const A = cut(all, r), L = cut(legs, r), h = A.height;
  return { all: A, paws: L, pawsTop: (l.y0 - r.y0) / h, pawsBottom: (l.y1 - r.y0) / h, at: (p) => { const q = all.headPoint(p); return [q[0] - r.x0, q[1] - r.y0]; } };
}

/** A sakura petal, its stem end at (x, y), `len` long, turned `rot`, inked like him. */
function petal(c, x, y, len, rot, ink) {
  c.save();
  c.translate(x, y); c.rotate(rot);
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(len * 0.55, -len * 0.25, len * 0.62, -len * 0.85, len * 0.16, -len);
  c.lineTo(0, -len * 0.86);
  c.lineTo(-len * 0.16, -len);
  c.bezierCurveTo(-len * 0.62, -len * 0.85, -len * 0.55, -len * 0.25, 0, 0);
  c.closePath();
  c.lineJoin = 'round'; c.lineWidth = ink * 2; c.strokeStyle = '#3a2a3c'; c.stroke();
  const g = c.createLinearGradient(0, 0, 0, -len);
  g.addColorStop(0, '#f39ab4'); g.addColorStop(1, '#ffdbe6');
  c.fillStyle = g; c.fill();
  c.restore();
}

const NEUTRAL = '#ece6df';
/** A stand-in for the photo: nobody in particular. */
function standIn() {
  const c = document.createElement('canvas');
  c.width = 904; c.height = 944;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, '#cfc7dc'); g.addColorStop(1, '#e9d6cf');
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#a79bb8';
  x.beginPath(); x.arc(452, 400, 170, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(452, 960, 360, 330, 0, 0, Math.PI * 2); x.fill();
  return c;
}
const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });

/** How each is put on the polaroid (its frame: the middle of the paper at 0,0; the paper's top at -POL.h/2). */
const STAGE = {
  A: (s) => {
    const w = 290, h = w * s.all.height / s.all.width, edge = s.pawsTop + 0.6 * (s.pawsBottom - s.pawsTop), top = -POL.h / 2;
    const put = (x, img) => { x.translate(-96, top); x.rotate(-0.04); x.drawImage(img, -w / 2, -h * edge, w, h); };
    return {
      under: (x) => put(x, s.all),
      over: (x) => { x.beginPath(); x.rect(-POL.w, top + 1, POL.w * 2, POL.h); x.clip(); x.shadowColor = 'rgba(30,16,50,.35)'; x.shadowBlur = 8; x.shadowOffsetY = 4; put(x, s.paws); },
    };
  },
  B: (s) => {
    const w = 300, h = w * s.all.height / s.all.width, edge = s.pawsTop + 0.55 * (s.pawsBottom - s.pawsTop), top = -POL.h / 2;
    const put = (x, img) => { x.translate(-POL.w / 2 + 34, top + 34); x.rotate(-0.68); x.drawImage(img, -w / 2, -h * edge, w, h); };
    return {
      under: (x) => put(x, s.all),
      over: (x) => { x.beginPath(); x.rect(-POL.w / 2, top, POL.w, POL.h); x.clip(); x.shadowColor = 'rgba(30,16,50,.35)'; x.shadowBlur = 8; x.shadowOffsetY = 4; put(x, s.paws); },
    };
  },
  C: (s) => {
    const w = 300, h = w * s.all.height / s.all.width, top = -POL.h / 2;
    return {
      under: () => {},
      over: (x) => { x.shadowColor = 'rgba(30,16,50,.4)'; x.shadowBlur = 14; x.shadowOffsetY = 6; x.translate(70, top + 20); x.rotate(0.02); x.drawImage(s.all, -w / 2, -h, w, h); },
    };
  },
};

/** The three: each alone (alpha), alone on a neutral ground, in the saved picture; and one sheet of them all. */
export async function hachiOptions(only = null) {
  const bg = await loadImg('/keyart-1920.webp'), photo = standIn();
  const out = {}, cells = [];
  for (const k of Object.keys(OPTIONS)) {
    if (only && !only.includes(k)) continue;
    const o = OPTIONS[k], s = pair(o);
    if (k === 'C') {
      // a petal come to rest on his nose
      const x = s.all.getContext('2d'), a = s.at([-0.05, 0.278, 0.255]), b = s.at([0.05, 0.278, 0.255]), m = Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1, n = s.at([0.004, 0.279, 0.262]);
      petal(x, n[0] - 0.006 * m, n[1] + 0.006 * m, 0.021 * m, 1.05, o.inkPx * 0.7);
    }
    const alone = document.createElement('canvas');
    alone.width = s.all.width + 240; alone.height = s.all.height + 240;
    const ax = alone.getContext('2d');
    ax.fillStyle = NEUTRAL; ax.fillRect(0, 0, alone.width, alone.height);
    ax.drawImage(s.all, 120, 120);
    const card = document.createElement('canvas');
    compose(card, { bg, dog: null, paws: null, photo: { src: photo, w: photo.width, h: photo.height, mirror: false }, brand: true, stage: STAGE[k](s) });
    out[k] = { w: s.all.width, h: s.all.height, alpha: s.all.toDataURL('image/png'), alone: alone.toDataURL('image/png'), postcard: card.toDataURL('image/jpeg', 0.92) };
    cells.push({ k, alone, card });
  }
  // the sheet: each alone over its postcard, lettered
  const CW = 640, GAP = 30, sheet = document.createElement('canvas');
  sheet.width = GAP + cells.length * (CW + GAP); sheet.height = 1230;
  const x = sheet.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.fillStyle = '#f7f3ee'; x.fillRect(0, 0, sheet.width, sheet.height);
  cells.forEach(({ k, alone, card }, i) => {
    const x0 = GAP + i * (CW + GAP);
    x.fillStyle = NEUTRAL; x.fillRect(x0, 90, CW, 700);
    const sc = Math.min(CW / alone.width, 700 / alone.height);
    x.drawImage(alone, x0 + (CW - alone.width * sc) / 2, 90 + (700 - alone.height * sc) / 2, alone.width * sc, alone.height * sc);
    x.drawImage(card, x0, 810, CW, CW * card.height / card.width);
    x.fillStyle = '#2a2140'; x.font = "700 54px -apple-system, 'Segoe UI', system-ui, sans-serif"; x.textBaseline = 'middle';
    x.fillText(k, x0 + 6, 46);
    x.font = "500 24px -apple-system, 'Segoe UI', system-ui, sans-serif"; x.fillStyle = '#6c6482';
    x.fillText({ A: 'peeking over the top, a blep', B: 'round the corner, a wink', C: 'sitting on top, hachimaki, a petal' }[k], x0 + 60, 48);
  });
  out.sheet = sheet.toDataURL('image/jpeg', 0.9);
  return out;
}
