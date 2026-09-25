import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * The store's painted surfaces (M3a): floor, ceiling, signs, POP, the
 * faces of machines.  Crisp painted shapes, no photographic noise.
 * Every name and logo here is generic (AGENTS.md branding rule).
 * ------------------------------------------------------------------ */

const JP = `'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Yu Gothic', Meiryo, sans-serif`;
const cache = new Map();

function tex(key, w, h, draw, { repeat = false, alpha = false } = {}) {
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.userData.alpha = alpha;
  cache.set(key, t);
  return t;
}

function fit(c, str, x, y, maxW, size, color, weight = 'bold') {
  let s = size;
  do { c.font = `${weight} ${s}px ${JP}`; if (c.measureText(str).width <= maxW) break; s -= 1; } while (s > 8);
  c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(str, x, y);
}

/** Floor: large pale grey tiles, 0.6 m, one tile per texel square; a sheen
 *  where the ceiling lights catch it.  Tiles `n` x `n` per texture. */
export const floorTex = () =>
  tex('floor', 512, 512, (c, w, h) => {
    const n = 4, s = w / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      c.fillStyle = (i + j) % 3 === 0 ? '#dcdad6' : (i * 7 + j * 3) % 5 === 0 ? '#d4d2ce' : '#d8d6d2';
      c.fillRect(i * s, j * s, s, s);
    }
    c.strokeStyle = '#bab6b4'; c.lineWidth = 2;
    for (let k = 0; k <= n; k++) {
      c.beginPath(); c.moveTo(k * s, 0); c.lineTo(k * s, h); c.stroke();
      c.beginPath(); c.moveTo(0, k * s); c.lineTo(w, k * s); c.stroke();
    }
    // the light's sheen: soft pale streaks
    for (let k = 0; k < 2; k++) {
      const g = c.createLinearGradient(0, h * (0.2 + k * 0.5), 0, h * (0.3 + k * 0.5));
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, h * (0.2 + k * 0.5), w, h * 0.1);
    }
  }, { repeat: true });
export const FLOOR_TILE = 2.4;                 // metres per texture repeat (4 tiles of 0.6)

/** Ceiling: white lay-in panels, 0.6 m, and a vent now and then. */
export const ceilingTex = () =>
  tex('ceiling', 256, 256, (c, w, h) => {
    c.fillStyle = '#f2f2f0'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c8c8cc'; c.lineWidth = 3;
    for (let k = 0; k <= 2; k++) {
      c.beginPath(); c.moveTo(k * w / 2, 0); c.lineTo(k * w / 2, h); c.stroke();
      c.beginPath(); c.moveTo(0, k * h / 2); c.lineTo(w, k * h / 2); c.stroke();
    }
    c.fillStyle = 'rgba(160,160,170,0.35)';
    for (let i = 0; i < 16; i++) c.fillRect(w / 2 + 14 + (i % 4) * 26, h / 2 + 14 + Math.floor(i / 4) * 26, 18, 18);
  }, { repeat: true });
export const CEIL_TILE = 1.2;

/** A category sign hung from the ceiling: white board, a coloured band. */
export const hangingSign = (jp, en, band) =>
  tex('hang-' + jp, 512, 160, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
    c.fillStyle = band; c.fillRect(0, 0, 26, h); c.fillRect(w - 26, 0, 26, h);
    fit(c, jp, w / 2, h * 0.42, w - 90, 76, '#2a2e3a');
    fit(c, en, w / 2, h * 0.8, w - 90, 26, '#6a6e7a', 'normal');
  });

/** POP cards on the end caps. */
export const popCard = (kind) =>
  tex('pop-' + kind, 256, 192, (c, w, h) => {
    const P = {
      new: ['#e8453f', '#ffffff', '新商品', 'NEW'],
      rec: ['#f2c23c', '#3a2a1a', 'おすすめ', 'RECOMMENDED'],
      limited: ['#3a6ec8', '#ffffff', '期間限定', 'LIMITED'],
      sale: ['#e8453f', '#ffe24a', 'お買い得', 'VALUE'],
    }[kind];
    c.fillStyle = P[0]; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 18); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.stroke();
    fit(c, P[2], w / 2, h * 0.44, w - 36, 64, P[1]);
    fit(c, P[3], w / 2, h * 0.78, w - 60, 22, P[1], 'normal');
  });

/** Cigarette wall behind the counter: rows of packs with numbered slots. */
export const cigaretteTex = () =>
  tex('cig', 512, 512, (c, w, h) => {
    c.fillStyle = '#3a3e4a'; c.fillRect(0, 0, w, h);
    const cols = 10, rows = 8, cw = w / cols, rh = h / rows;
    const packs = ['#f2f2f2', '#3a5aa8', '#c83a3a', '#e8e0c8', '#2a2a2a', '#5aa870', '#e8b83a', '#a8a8b0'];
    let n = 1;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = i * cw, y = j * rh;
      c.fillStyle = packs[(i * 3 + j * 5) % packs.length];
      c.fillRect(x + 6, y + 6, cw - 12, rh - 26);
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x + 6, y + 6, 5, rh - 26);
      c.fillStyle = '#ffffff'; c.fillRect(x + 8, y + rh - 18, cw - 16, 14);
      c.fillStyle = '#222'; c.font = `bold 11px ${JP}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(n++), x + cw / 2, y + rh - 11);
    }
  });

/** Magazines on the rack by the window: covers in a row (generic). */
export const magazineTex = () =>
  tex('mags', 512, 256, (c, w, h) => {
    const covers = [['#e8453f', '週刊まんが'], ['#3a6ec8', 'くるま'], ['#f2a8c0', 'ファッション'], ['#5aa870', 'りょこう'], ['#f2c23c', 'ゲーム'], ['#8a5ac8', 'ごはん'], ['#2a2a3a', 'つり'], ['#e87a3a', 'スポーツ']];
    const cw = w / 8;
    covers.forEach(([col, t], i) => {
      const x = i * cw;
      c.fillStyle = '#fafaf6'; c.fillRect(x + 3, 0, cw - 6, h);
      c.fillStyle = col; c.fillRect(x + 3, 0, cw - 6, h * 0.28);
      fit(c, t, x + cw / 2, h * 0.14, cw - 14, 20, '#ffffff');
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x + 10, h * 0.36, cw - 20, h * 0.44);
      c.fillStyle = col; c.globalAlpha = 0.5; c.beginPath(); c.arc(x + cw / 2, h * 0.58, cw * 0.28, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
      c.fillStyle = '#222'; c.font = `bold 11px ${JP}`; c.textAlign = 'center'; c.fillText('¥' + (380 + i * 50), x + cw / 2, h * 0.9);
    });
  });

/** A machine's face: ATM, copier, ticket kiosk (all generic). */
export const machineFace = (kind) =>
  tex('mach-' + kind, 256, 512, (c, w, h) => {
    const K = {
      atm: ['#e8eaee', '#1e5a9a', 'ATM', '24時間 ご利用いただけます'],
      copy: ['#f2f2f0', '#3a3e4a', 'マルチコピー', 'コピー・プリント・FAX'],
      kiosk: ['#d8342f', '#ffffff', 'チケット', 'チケット・各種お支払い'],
    }[kind];
    c.fillStyle = K[0]; c.fillRect(0, 0, w, h);
    c.fillStyle = K[1]; c.fillRect(0, 0, w, h * 0.16);
    fit(c, K[2], w / 2, h * 0.08, w - 30, 40, kind === 'kiosk' ? '#d8342f' : '#ffffff');
    if (kind === 'kiosk') { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h * 0.16); fit(c, K[2], w / 2, h * 0.08, w - 30, 40, '#d8342f'); }
    // the screen
    c.fillStyle = '#2a3a5a'; c.fillRect(w * 0.14, h * 0.24, w * 0.72, h * 0.28);
    c.fillStyle = '#8ab8e8'; c.fillRect(w * 0.18, h * 0.28, w * 0.64, h * 0.05);
    for (let i = 0; i < 3; i++) { c.fillStyle = '#5a88c8'; c.fillRect(w * 0.18, h * (0.36 + i * 0.05), w * 0.3, h * 0.035); c.fillRect(w * 0.52, h * (0.36 + i * 0.05), w * 0.3, h * 0.035); }
    fit(c, K[3], w / 2, h * 0.6, w - 24, 20, kind === 'kiosk' ? '#ffffff' : '#3a3e4a', 'normal');
    // slots
    c.fillStyle = '#2a2a30'; c.fillRect(w * 0.3, h * 0.7, w * 0.4, 8); c.fillRect(w * 0.3, h * 0.78, w * 0.4, 8);
  });

/** Door signs: お手洗い, the staff door, AUTO DOOR. */
export const doorSign = (kind) =>
  tex('door-' + kind, 256, 128, (c, w, h) => {
    const K = {
      toilet: ['#ffffff', '#2a2e3a', 'お手洗い', 'Toilet'],
      staff: ['#f2f2f0', '#d8342f', '関係者以外立入禁止', 'Staff only'],
      auto: ['#ffffff', '#1e5a9a', '自動ドア', 'AUTO DOOR'],
    }[kind];
    c.fillStyle = K[0]; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 12); c.fill();
    c.strokeStyle = K[1]; c.lineWidth = 4; c.stroke();
    fit(c, K[2], w / 2, h * 0.4, w - 24, 40, K[1]);
    fit(c, K[3], w / 2, h * 0.76, w - 40, 20, K[1], 'normal');
  });

/** The customer display on a register: green seven-segment on black. */
export const registerScreen = () =>
  tex('regscreen', 128, 64, (c, w, h) => {
    c.fillStyle = '#10141a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#58f08a'; c.font = `bold 30px monospace`; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillText('0', w - 12, h / 2);
    c.font = `bold 13px ${JP}`; c.textAlign = 'left'; c.fillText('合計', 8, h / 2);
  });

/** Small labels on the counter's kit: ホットスナック, 中華まん, おでん, the coffee menu. */
export const counterLabel = (kind) =>
  tex('cl-' + kind, 256, 96, (c, w, h) => {
    const K = {
      hot: ['#e8453f', '#ffffff', 'ホットスナック', 'HOT SNACKS'],
      steam: ['#ffffff', '#c8342f', '中華まん', 'STEAMED BUNS'],
      oden: ['#f2e6c8', '#6a3a1a', 'おでん', 'ODEN'],
      coffee: ['#4a2e22', '#f2e6c8', 'セルフコーヒー', 'SELF COFFEE'],
      counter: ['#f2f0ea', '#2a4a8a', 'お会計', 'CHECKOUT'],
    }[kind];
    c.fillStyle = K[0]; c.fillRect(0, 0, w, h);
    fit(c, K[2], w / 2, h * 0.42, w - 20, 40, K[1]);
    fit(c, K[3], w / 2, h * 0.8, w - 40, 16, K[1], 'normal');
  });

/** The phone-battery rental kiosk's face: a slim screen, rows of batteries
 *  charging (lit green), generic. */
export const batteryFace = () =>
  tex('battery', 128, 512, (c, w, h) => {
    c.fillStyle = '#f2f2f0'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#2aa870'; c.fillRect(0, 0, w, 60);
    fit(c, 'モバイル', w / 2, 20, w - 12, 22, '#ffffff'); fit(c, 'バッテリー', w / 2, 44, w - 12, 20, '#ffffff');
    c.fillStyle = '#1a2a3a'; c.fillRect(12, 72, w - 24, 110);
    fit(c, 'かしだし', w / 2, 110, w - 30, 20, '#8ae8b8'); fit(c, 'Rent a charger', w / 2, 140, w - 30, 12, '#8ae8b8', 'normal');
    for (let i = 0; i < 8; i++) {
      c.fillStyle = '#3a3e4a'; c.fillRect(22, 200 + i * 36, w - 44, 28);
      c.fillStyle = '#58e08a'; c.fillRect(w - 38, 208 + i * 36, 8, 12);
    }
  });

/** A section strip for the chilled case's canopy, or a cooler door's header. */
export const stripSign = (jp, en, bg, fg = '#ffffff') =>
  tex('strip-' + jp, 512, 96, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    fit(c, jp, w * 0.42, h * 0.52, w * 0.62, 56, fg);
    fit(c, en, w * 0.83, h * 0.55, w * 0.28, 20, fg, 'normal');
  });

/** Stickers on the cooler doors, the smoothie corner's sign. */
export const smallSign = (kind) =>
  tex('ss-' + kind, 256, 128, (c, w, h) => {
    const K = {
      cold: ['#1e5ab8', '#ffffff', '冷えてます', 'ICE COLD'],
      smoothie: ['#e8864a', '#ffffff', 'セルフスムージー', 'MAKE YOUR OWN'],
      microwave: ['#f2f0ea', '#2a4a8a', 'ご自由にお使いください', 'Microwave: self-serve'],
      eatin: ['#6a3a22', '#f2e6c8', 'イートイン', 'EAT-IN'],
      ice: ['#3a8ad0', '#ffffff', 'アイスクリーム', 'ICE CREAM'],
    }[kind];
    c.fillStyle = K[0]; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 14); c.fill();
    fit(c, K[2], w / 2, h * 0.42, w - 24, 44, K[1]);
    fit(c, K[3], w / 2, h * 0.78, w - 40, 18, K[1], 'normal');
  });
