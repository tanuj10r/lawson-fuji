import * as THREE from 'three';
import { PAL } from './palette.js';
import { SHOP_SIGNS, STATION, LANTERN_TEXT } from '../data/town.js';

/* ------------------------------------------------------------------ *
 * Procedural canvas textures.
 *
 * The scene ships with zero binary assets: every sign, poster, price
 * strip and petal mask is drawn with Canvas2D at start-up.  Everything is
 * kept flat and low-frequency on purpose -- crisp shapes and type, never
 * photographic noise.
 * ------------------------------------------------------------------ */

const JP_FONT = `'Yu Gothic', 'Yu Gothic UI', 'Meiryo', 'MS Gothic', 'Hiragino Kaku Gothic ProN', sans-serif`;
const cache = new Map();

function make(w, h, draw, { srgb = true, repeat = null, aniso = 4 } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = true;
  draw(c, w, h);
  const tex = new THREE.CanvasTexture(cv);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.needsUpdate = true;
  return tex;
}

function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

function fitText(c, text, maxW, size, font = JP_FONT, weight = 'bold') {
  let s = size;
  do {
    c.font = `${weight} ${s}px ${font}`;
    if (c.measureText(text).width <= maxW) break;
    s -= 2;
  } while (s > 6);
  return s;
}

function centered(c, text, x, y, maxW, size, color, weight = 'bold', spacing = 0) {
  const s = fitText(c, text, maxW, size, JP_FONT, weight);
  c.fillStyle = color;
  c.textAlign = spacing ? 'left' : 'center';
  c.textBaseline = 'middle';
  if (spacing) {
    const chars = [...text];
    const total = chars.reduce((a, ch) => a + c.measureText(ch).width + spacing, -spacing);
    let cx = x - total / 2;
    for (const ch of chars) {
      c.fillText(ch, cx, y);
      cx += c.measureText(ch).width + spacing;
    }
  } else {
    c.fillText(text, x, y);
  }
  return s;
}

function vertical(c, text, x, y0, step, size, color) {
  c.font = `bold ${size}px ${JP_FONT}`;
  c.fillStyle = color;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  [...text].forEach((ch, i) => c.fillText(ch, x, y0 + i * step));
}

/* ---------------------------------- shop ---------------------------------- */

/** Small paper posters taped to the shop wall. */
export const poster = (variant = 0) =>
  cached('poster' + variant, () =>
    make(320, 448, (c, w, h) => {
      const sets = [
        { bg: '#fdf7e8', bar: PAL.red, t: 'さくら祭', s: '四月五日' },
        { bg: '#eef6fd', bar: PAL.blue, t: '町内会', s: 'そうじ当番' },
        { bg: '#fdeef1', bar: PAL.purple, t: '春の便り', s: '富士川口湖' },
        { bg: '#f4fbef', bar: PAL.leafDeep, t: '野菜市', s: '毎週日曜' },
      ];
      const st = sets[variant % sets.length];
      c.fillStyle = st.bg;
      c.fillRect(0, 0, w, h);
      c.fillStyle = hex(st.bar);
      c.fillRect(0, 0, w, 26);
      c.fillRect(0, h - 20, w, 20);
      centered(c, st.t, w / 2, 120, w - 40, 96, hex(st.bar), 'bold', 6);
      centered(c, st.s, w / 2, 222, w - 60, 52, '#4b4757');
      // abstract flat illustration block
      c.fillStyle = '#e9e3d8';
      c.fillRect(40, 270, w - 80, 120);
      c.fillStyle = hex(PAL.blossomDeep);
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.arc(70 + i * 45, 330 + (i % 2) * 22, 16, 0, Math.PI * 2);
        c.fill();
      }
    })
  );

/* -------------------------------- vending -------------------------------- */

/** Lit header panel with a fictional brand mark. */
export const vendHeader = (variant = 0) =>
  cached('vendHeader' + variant, () =>
    make(512, 160, (c, w, h) => {
      const sets = [
        { bg: '#ffffff', fg: PAL.red, t: 'そら茶' },
        { bg: '#e0453f', fg: 0xffffff, t: 'ハレ水' },
        { bg: '#2e9a98', fg: 0xffffff, t: 'なごみ' },
      ];
      const st = sets[variant % sets.length];
      c.fillStyle = st.bg;
      c.fillRect(0, 0, w, h);
      centered(c, st.t, w * 0.36, h / 2, w * 0.5, 106, hex(st.fg), 'bold', 8);
      c.fillStyle = hex(st.fg);
      c.globalAlpha = 0.85;
      c.beginPath();
      c.arc(w * 0.78, h / 2, 44, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
      c.fillStyle = st.bg;
      c.beginPath();
      c.arc(w * 0.78, h / 2, 26, 0, Math.PI * 2);
      c.fill();
    })
  );

/** Hot / cold strip and price row under the shelves. */
export const vendPrice = () =>
  cached('vendPrice', () =>
    make(512, 96, (c, w, h) => {
      c.fillStyle = '#f6f3ee';
      c.fillRect(0, 0, w, h);
      const n = 6;
      for (let i = 0; i < n; i++) {
        const x = (i * w) / n;
        c.fillStyle = i % 3 === 0 ? '#e0453f' : '#2f6fc4';
        c.fillRect(x + 6, 14, w / n - 12, 44);
        c.fillStyle = '#ffffff';
        c.font = `bold 30px ${JP_FONT}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('150', x + w / n / 2, 38);
        c.fillStyle = '#8b8696';
        c.fillRect(x + 18, 68, w / n - 36, 8);
      }
    })
  );

export const vendCold = (hot = false) =>
  cached('vendCold' + hot, () =>
    make(256, 96, (c, w, h) => {
      c.fillStyle = hot ? '#d8453f' : '#2f6fc4';
      c.fillRect(0, 0, w, h);
      centered(c, hot ? 'あたたかい' : 'つめたい', w / 2, h / 2, w - 24, 58, '#ffffff', 'bold', 2);
    })
  );

/**
 * The 取出口 flap.
 *
 * This used to be the delivery *panel* -- a printed plate, 2:1, standing where
 * the opening should have been, with a painted black bar for the slot.  There
 * is a real opening in the body now and this is the face of the flap that
 * hangs over it, so it is 4:1 to match a 0.58 x 0.15 m flap and dark, because
 * a flap is smoked plastic and the plate around it was the machine's own
 * colour.
 */
export const vendSlot = () =>
  cached('vendSlot', () =>
    make(256, 64, (c, w, h) => {
      c.fillStyle = '#33313c';
      c.fillRect(0, 0, w, h);
      // the moulded lip along the hinge, which is what catches the light
      c.fillStyle = '#4b4856';
      c.fillRect(0, 0, w, 8);
      /* High on the plate, not centred: textures flip in y, so the canvas's
       * upper third is the flap's upper third -- and the can lands in the
       * bottom half of the opening, where lettering across it makes the drink
       * read as broken type rather than as a drink. */
      centered(c, '取出口', w / 2, h * 0.32, w - 80, 22, '#cbc5bb');
    })
  );

/* -------------------------------- railway -------------------------------- */

export const crossingSign = () =>
  cached('crossingSign', () =>
    make(512, 256, (c, w, h) => {
      c.fillStyle = '#fbf8f2';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = hex(PAL.black);
      c.lineWidth = 12;
      c.strokeRect(6, 6, w - 12, h - 12);
      centered(c, '踏切注意', w / 2, h * 0.36, w - 60, 96, hex(PAL.redDeep), 'bold', 6);
      centered(c, 'とまれ  みよ  きけ', w / 2, h * 0.74, w - 80, 46, hex(PAL.black), 'bold', 2);
    })
  );

export const stationSign = () =>
  cached('stationSign', () =>
    make(768, 192, (c, w, h) => {
      c.fillStyle = '#fbfaf6';
      c.fillRect(0, 0, w, h);
      c.fillStyle = hex(PAL.teal);
      c.fillRect(0, h - 22, w, 22);
      centered(c, STATION.jp, w / 2, h * 0.42, w * 0.7, 104, '#2b3346', 'bold', 12);
      c.font = `600 34px ${JP_FONT}`;
      c.fillStyle = '#8a8fa0';
      c.textAlign = 'center';
      c.fillText(STATION.en, w / 2, h * 0.82);
    })
  );

export const warningPlate = (variant = 0) =>
  cached('warnPlate' + variant, () =>
    make(256, 512, (c, w, h) => {
      const sets = [
        { bg: PAL.yellow, fg: PAL.black, t: '防犯カメラ' },
        { bg: PAL.red, fg: 0xfdf8f0, t: '立入禁止' },
        { bg: 0xfdf8f0, fg: PAL.blueDeep, t: '徐行' },
        /* Appended with ひばり台六丁目: the plate that explains a fifteen-metre
         * circle of asphalt with nothing parked on it.  A 転回場 is not a car
         * park and the sign at its mouth is the only thing that says so. */
        { bg: 0xfdf8f0, fg: PAL.redDeep, t: '転回場' },
      ];
      const st = sets[variant % sets.length];
      c.fillStyle = hex(st.bg);
      c.fillRect(0, 0, w, h);
      c.fillStyle = hex(st.fg);
      c.fillRect(12, 12, w - 24, 6);
      c.fillRect(12, h - 18, w - 24, 6);
      vertical(c, st.t, w / 2, 90, 88, 74, hex(st.fg));
    })
  );

/* --------------------------------- street --------------------------------- */

/** Yellow tactile paving (点字ブロック) -- dots, tiling along its length. */
export const tactileTex = (bars = false) =>
  cached('tactile' + bars, () =>
    make(128, 128, (c, w, h) => {
      c.fillStyle = hex(PAL.tactile);
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#d9a91f';
      if (bars) {
        for (let i = 0; i < 4; i++) c.fillRect(10, 12 + i * 30, w - 20, 16);
      } else {
        for (let y = 0; y < 4; y++)
          for (let x = 0; x < 4; x++) {
            c.beginPath();
            c.arc(20 + x * 29, 20 + y * 29, 9, 0, Math.PI * 2);
            c.fill();
          }
      }
    }, { repeat: [1, 1] })
  );

export const platePlate = () =>
  cached('platePlate', () =>
    make(256, 128, (c, w, h) => {
      c.fillStyle = '#f6f4f0';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#4f5a72';
      c.lineWidth = 8;
      c.strokeRect(8, 8, w - 16, h - 16);
      centered(c, 'さ 21-08', w / 2, h / 2, w - 40, 56, '#2f3646');
    })
  );

export const noParking = () =>
  cached('noParking', () =>
    make(256, 256, (c, w, h) => {
      c.fillStyle = '#fbfaf6';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = hex(PAL.blue);
      c.lineWidth = 22;
      c.beginPath();
      c.arc(w / 2, h / 2, 96, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = hex(PAL.red);
      c.lineWidth = 20;
      c.beginPath();
      c.moveTo(48, 208);
      c.lineTo(208, 48);
      c.stroke();
    })
  );

/* --------------------------------- nature --------------------------------- */

/** Soft five-lobed petal silhouette used as an alpha mask. */
export const petalTex = () =>
  cached('petalTex', () =>
    make(128, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.translate(w / 2, h / 2);
      c.fillStyle = '#ffffff';
      c.beginPath();
      // a single rounded petal, wider at the tip with a small notch
      c.moveTo(0, 52);
      c.bezierCurveTo(38, 34, 46, -14, 14, -48);
      c.bezierCurveTo(6, -38, 2, -34, 0, -30);
      c.bezierCurveTo(-2, -34, -6, -38, -14, -48);
      c.bezierCurveTo(-46, -14, -38, 34, 0, 52);
      c.closePath();
      c.fill();
    }, { srgb: false })
  );

/** Soft round blob used for the flat anime clouds. */
export const cloudTex = () =>
  cached('cloudTex', () =>
    make(512, 256, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      const puffs = [
        [0.22, 0.62, 0.15], [0.36, 0.46, 0.2], [0.52, 0.4, 0.24],
        [0.68, 0.5, 0.19], [0.82, 0.63, 0.14], [0.45, 0.66, 0.2], [0.6, 0.68, 0.17],
      ];
      c.fillStyle = '#ffffff';
      for (const [x, y, r] of puffs) {
        c.beginPath();
        c.ellipse(x * w, y * h, r * w * 0.55, r * h * 1.1, 0, 0, Math.PI * 2);
        c.fill();
      }
      // trim the bottom flat, the way cel-painted clouds sit on a line
      c.globalCompositeOperation = 'destination-out';
      c.fillRect(0, h * 0.78, w, h * 0.22);
      c.globalCompositeOperation = 'source-over';
    }, { srgb: false })
  );

/* ------------------------------ misc surfaces ------------------------------ */

export const meterBox = () =>
  cached('meterBox', () =>
    make(256, 256, (c, w, h) => {
      c.fillStyle = '#eceaf0';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#cfccd6';
      c.fillRect(20, 20, w - 40, 90);
      c.fillStyle = '#3a3744';
      c.fillRect(40, 40, w - 80, 50);
      c.fillStyle = '#8b8696';
      c.fillRect(20, 140, w - 40, 12);
      c.fillRect(20, 172, w - 90, 12);
    })
  );

/* ================================================================== *
 * The wider district.
 *
 * Signage for the school, the shrine, the shopping street, the canal and
 * the new housing.  Same rules as everything above: flat colour, crisp
 * type, no photographic detail, and every string invented -- no real
 * brands, no real places, and no depictions of people anywhere.
 * ================================================================== */

/** Accept either a PAL number or a css string. */
const col = (v) => (typeof v === 'number' ? hex(v) : v);

/** A thin rule, the workhorse of Japanese signage layout. */
function rule(c, x, y, w, h, color) {
  c.fillStyle = col(color);
  c.fillRect(x, y, w, h);
}

/**
 * Chain-link mesh, as a diagonal lattice with genuinely transparent gaps.
 *
 * A flat translucent panel reads as tinted glass, which is exactly wrong for
 * a school fence.  Drawing the lattice and letting the gaps be empty is what
 * makes it read as mesh, and mipmapping softens it to a pale wash in the
 * distance instead of aliasing into moire.
 */
export const chainLinkTex = () =>
  cached('chainLink', () =>
    make(128, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.strokeStyle = 'rgba(255,255,255,0.92)';
      c.lineWidth = 7;
      c.lineCap = 'square';
      for (let i = -1; i <= 2; i++) {
        c.beginPath();
        c.moveTo(i * w, 0);
        c.lineTo(i * w + w, h);
        c.stroke();
        c.beginPath();
        c.moveTo(i * w, h);
        c.lineTo(i * w + w, 0);
        c.stroke();
      }
    }, { srgb: false })
  );

/* ---------------------------------- school ---------------------------------- */

/** Cork notice board backing, so the posters read as pinned to something. */
export const corkBoard = () =>
  cached('corkBoard', () =>
    make(512, 256, (c, w, h) => {
      c.fillStyle = '#c3a279';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#b8946b';
      for (let i = 0; i < 90; i++) {
        const x = ((i * 137) % w) | 0;
        const y = ((i * 89) % h) | 0;
        c.fillRect(x, y, 7, 4);
      }
      c.strokeStyle = '#7d6348';
      c.lineWidth = 10;
      c.strokeRect(5, 5, w - 10, h - 10);
    })
  );

/* --------------------------------- shop fronts --------------------------------- */

/* Take Me Back to Japan: the tenants and their names live in src/data/town.js (our own
 * names). */
const SHOPS = SHOP_SIGNS;

/** Horizontal shop fascia. One layout, nine tenants. */
export const shopFascia = (kind = 'conbini') =>
  cached('fascia' + kind, () =>
    make(1024, 224, (c, w, h) => {
      const st = SHOPS[kind] ?? SHOPS.soba;
      c.fillStyle = st.bg;
      c.fillRect(0, 0, w, h);
      rule(c, 0, h - 16, w, 16, st.bar);
      rule(c, 0, 0, w, 8, st.bar);
      centered(c, st.t, w * 0.4, h * 0.46, w * 0.62, 118, st.fg, 'bold', 10);
      c.font = `600 34px ${JP_FONT}`;
      c.fillStyle = st.fg;
      c.globalAlpha = 0.72;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(st.en, w * 0.76, h * 0.36);
      c.font = `500 28px ${JP_FONT}`;
      c.globalAlpha = 0.55;
      c.fillText(st.s, w * 0.76, h * 0.66);
      c.globalAlpha = 1;
    })
  );

/** Tall projecting sign, the kind bolted out over a narrow street. */
export const shopBlade = (kind = 'ramen') =>
  cached('blade' + kind, () =>
    make(192, 768, (c, w, h) => {
      const st = SHOPS[kind] ?? SHOPS.soba;
      c.fillStyle = st.bg;
      c.fillRect(0, 0, w, h);
      rule(c, 0, 0, w, 12, st.bar);
      rule(c, 0, h - 12, w, 12, st.bar);
      const label = st.t.split(' ').pop();
      vertical(c, label, w / 2, 110, 108, 88, st.fg);
    })
  );

/** Cloth noren hung in a doorway. */
export const norenTex = (kind = 'ramen') =>
  cached('noren' + kind, () =>
    make(512, 256, (c, w, h) => {
      const sets = {
        ramen: { bg: PAL.norenRed, fg: '#f6ecdc', t: 'らーめん' },
        sento: { bg: PAL.noren, fg: '#f6ecdc', t: 'ゆ' },
        wagashi: { bg: PAL.norenCream, fg: '#8a4a62', t: '和菓子' },
        soba: { bg: 0x2f5540, fg: '#eef3e6', t: 'そば' },
        record: { bg: 0x3f4a68, fg: '#eee2c8', t: 'レコード' },
        // appended with ひばり台六丁目, for the 弁当屋 at the turnaround
        bento: { bg: 0xb8763a, fg: '#fdf4e4', t: 'お弁当' },
      };
      const st = sets[kind] ?? sets.ramen;
      c.fillStyle = col(st.bg);
      c.fillRect(0, 0, w, h);
      /* A noren is split into hanging panels, and the slits go through
       * whatever is printed on it.  Long labels can be sliced -- real ones
       * are -- but a single character has to sit inside one panel or it just
       * reads as broken marks. */
      const chars = [...st.t];
      if (chars.length === 1) {
        centered(c, st.t, w / 2, h * 0.46, w / 3 - 20, 130, st.fg, 'bold');
      } else {
        centered(c, st.t, w / 2, h * 0.46, w - 90, 118, st.fg, 'bold', 10);
      }
      c.globalCompositeOperation = 'destination-out';
      for (const x of [w * 0.33, w * 0.66]) c.fillRect(x - 4, h * 0.3, 8, h);
      c.globalCompositeOperation = 'source-over';
    }, { srgb: true })
  );

/** Chalked menu board leaned against a shopfront. */
export const menuBoard = () =>
  cached('menuBoard', () =>
    make(384, 512, (c, w, h) => {
      c.fillStyle = '#3a4148';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#a8845c';
      c.lineWidth = 20;
      c.strokeRect(10, 10, w - 20, h - 20);
      centered(c, '本日の', w / 2, 84, w - 90, 52, '#f0e6cc');
      centered(c, 'おすすめ', w / 2, 142, w - 80, 60, '#f4c033');
      const rows = [['しおらーめん', '七二〇'], ['みそらーめん', '七八〇'], ['ぎょうざ', '三六〇'], ['めんま', '一八〇']];
      c.textBaseline = 'middle';
      rows.forEach(([a, b], i) => {
        c.font = `600 38px ${JP_FONT}`;
        c.fillStyle = '#e8e2d2';
        c.textAlign = 'left';
        c.fillText(a, 46, 232 + i * 62);
        c.textAlign = 'right';
        c.fillText(b, w - 46, 232 + i * 62);
        c.globalAlpha = 0.35;
        rule(c, 46, 258 + i * 62, w - 92, 2, '#cfc8b6');
        c.globalAlpha = 1;
      });
    })
  );

/** Paper lantern, hung in a row down the shopping street. */
export const lanternTex = (variant = 0) =>
  cached('lantern' + variant, () =>
    make(256, 256, (c, w, h) => {
      c.fillStyle = variant === 1 ? '#f2ddb8' : '#f8ecd6';
      c.fillRect(0, 0, w, h);
      // ribs
      c.fillStyle = 'rgba(180,160,124,0.5)';
      for (let i = 0; i < 9; i++) c.fillRect(0, 12 + i * 28, w, 3);
      const t = LANTERN_TEXT[variant % LANTERN_TEXT.length];
      centered(c, t, w / 2, h / 2, w - 70, variant >= 3 ? 128 : 92,
        variant === 2 ? '#20509e' : '#b5322f', 'bold', 6);
    })
  );

/** Small promotional flag clipped to a shopfront rail. */
export const flagTex = (variant = 0) =>
  cached('flag' + variant, () =>
    make(256, 384, (c, w, h) => {
      const sets = [
        { bg: PAL.red, fg: '#fdf6ec', t: 'アイス' },
        { bg: PAL.blue, fg: '#fdf6ec', t: 'つめたい' },
        { bg: PAL.yellow, fg: '#3c3a46', t: 'しんはつばい' },
        { bg: PAL.teal, fg: '#fdf6ec', t: 'おべんとう' },
      ];
      const st = sets[variant % sets.length];
      c.fillStyle = col(st.bg);
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#fdf8f0';
      c.fillRect(10, 10, w - 20, h - 20);
      c.fillStyle = col(st.bg);
      c.fillRect(10, 10, w - 20, 70);
      vertical(c, st.t, w / 2, 140, 62, 52, col(st.fg === '#3c3a46' ? '#3c3a46' : st.bg));
    })
  );

/* ------------------------------- overbridge ------------------------------- */

/* -------------------------------- bathhouse -------------------------------- */

/* ---------------------------------- shrine ---------------------------------- */

/** Board over the shrine offertory. */
export const shrineName = () =>
  cached('shrineName', () =>
    make(256, 768, (c, w, h) => {
      c.fillStyle = '#e6dcc4';
      c.fillRect(0, 0, w, h);
      rule(c, 16, 16, w - 32, 6, 0x8a7350);
      rule(c, 16, h - 22, w - 32, 6, 0x8a7350);
      vertical(c, '桜守神社', w / 2, 140, 150, 122, '#4a4034');
    })
  );

/** How-to-worship notice at the foot of the steps. */
export const sanpaiNotice = () =>
  cached('sanpaiNotice', () =>
    make(384, 512, (c, w, h) => {
      c.fillStyle = '#f6f2e6';
      c.fillRect(0, 0, w, h);
      rule(c, 0, 0, w, 24, 0xb5322f);
      centered(c, '参拝のしかた', w / 2, 84, w - 60, 62, '#4a4034', 'bold', 4);
      const lines = ['一、手水で きよめる', '二、二礼', '三、二拍手', '四、一礼', '', '氏子会'];
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      lines.forEach((t, i) => {
        if (!t) return;
        c.font = `600 ${i === 5 ? 28 : 36}px ${JP_FONT}`;
        c.fillStyle = i === 5 ? '#8a8172' : '#4b4436';
        c.fillText(t, 46, 176 + i * 54);
      });
    })
  );

/* ------------------------------ canal and park ------------------------------ */

/* ------------------------------ the community bus ------------------------------ *
 * Added with the motor vehicles.  ひばり台ふれあい号 is the invented council
 * minibus; the only stop that exists is the one outside the library, which is
 * where the route would obviously turn.  Both plates are drawn to the aspect of
 * the geometry they land on -- a 1:1 disc and a 2:3 case -- because a map at the
 * wrong ratio renders as an unreadable smear rather than as an error. */

/**
 * The round stop head: operator over the stop name, a rule, then the route.
 *
 * Variant 0 is 図書館前 and is exactly as it was drawn, because a stop head is
 * an index like every other plate art in this file; variant 1 is the terminus
 * up at the turnaround in ひばり台六丁目, and the only difference that matters
 * is the 終点 line -- a stop that is the end of the route says so, and that one
 * word is what makes a circle of asphalt read as somewhere a bus turns round.
 */
export const busStopPlate = (variant = 0) =>
  cached('busStopPlate' + variant, () =>
    make(384, 384, (c, w) => {
      /* Take Me Back to Japan: our own stops and service. */
      const sets = [
        { t: '富士川口湖駅', foot: '１日 ２０便' },
        { t: '富士川口湖町', foot: '終点  ・  ここで折返し' },
      ];
      const st = sets[variant % sets.length];
      c.fillStyle = '#fbfaf6';
      c.beginPath();
      c.arc(w / 2, w / 2, w / 2 - 6, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = hex(PAL.blueDeep);
      c.lineWidth = 14;
      c.stroke();
      centered(c, '富士川口湖町', w / 2, 92, w - 130, 40, hex(PAL.blueDeep), '600');
      centered(c, st.t, w / 2, 168, w - 90, 62, '#3b3846', 'bold', 2);
      c.globalAlpha = 0.45;
      rule(c, 96, 226, w - 192, 3, '#8a84a0');
      c.globalAlpha = 1;
      centered(c, '富士川口湖町 コミュニティバス', w / 2, 268, w - 120, 34, hex(PAL.teal), '600');
      centered(c, st.foot, w / 2, 316, w - 130, 26, '#6f6a80', '600');
    })
  );

/** The timetable case under it: two columns of departure times. */
export const busTimetable = () =>
  cached('busTimetable', () =>
    make(320, 480, (c, w, h) => {
      c.fillStyle = '#fdfbf6';
      c.fillRect(0, 0, w, h);
      rule(c, 0, 0, w, 56, PAL.blueDeep);
      centered(c, '時刻表', w / 2, 28, w - 40, 32, '#fdf8f0', 'bold', 2);
      const cols = [['右まわり', ['7:40', '10:20', '13:50', '16:30']],
        ['左まわり', ['8:15', '11:05', '14:35', '17:10']]];
      cols.forEach(([head, times], i) => {
        const x = w * (i ? 0.74 : 0.26);
        centered(c, head, x, 96, w * 0.44, 24, hex(PAL.teal), '600');
        c.globalAlpha = 0.4;
        rule(c, x - w * 0.2, 122, w * 0.4, 2, '#9a94a6');
        c.globalAlpha = 1;
        times.forEach((t, j) => centered(c, t, x, 164 + j * 62, w * 0.4, 34, '#4b4757', '600'));
      });
      centered(c, '日祝は運休', w / 2, 436, w - 60, 22, '#8a8696', '600');
    })
  );

/* -------------------------------- the library -------------------------------- */

/* --------------------------- the corner and its booth --------------------------- */

/** The light box on top of a public telephone box. */
export const phoneBoxSign = () =>
  cached('phoneBoxSign', () =>
    make(512, 160, (c, w, h) => {
      c.fillStyle = '#f4f2ea';
      c.fillRect(0, 0, w, h);
      rule(c, 0, 0, w, 10, 0x2f6b52);
      rule(c, 0, h - 10, w, 10, 0x2f6b52);
      centered(c, '公衆電話', w * 0.46, h * 0.44, w * 0.6, 82, '#245a44', 'bold', 8);
      c.font = `600 22px ${JP_FONT}`;
      c.fillStyle = '#7f8f84';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('TELEPHONE', w * 0.46, h * 0.78);
      /* the receiver glyph: a bar with a rounded cup at each end, which is the
       * whole of what a telephone mark is -- and involves nobody */
      c.strokeStyle = '#245a44';
      c.lineWidth = 13;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(w * 0.83, h * 0.32);
      c.lineTo(w * 0.9, h * 0.68);
      c.stroke();
      c.lineWidth = 24;
      c.beginPath();
      c.moveTo(w * 0.805, h * 0.28);
      c.lineTo(w * 0.855, h * 0.28);
      c.stroke();
      c.beginPath();
      c.moveTo(w * 0.875, h * 0.72);
      c.lineTo(w * 0.925, h * 0.72);
      c.stroke();
    })
  );

/** The small notice stuck inside the glass of a phone box. */
export const phoneNotice = (variant = 0) =>
  cached('phoneNotice' + variant, () =>
    make(256, 352, (c, w, h) => {
      const sets = [
        { bar: PAL.redDeep, t: '緊急通報', l: ['１１０ ・ １１９', 'は 無料です', '', '受話器を上げて', 'ボタンを押す'] },
        { bar: PAL.blue, t: 'ご案内', l: ['１０円 ・ ５０円', 'テレホンカード', '', 'つり銭は', 'でません'] },
      ];
      const st = sets[variant % sets.length];
      c.fillStyle = '#fbfaf4';
      c.fillRect(0, 0, w, h);
      rule(c, 0, 0, w, 18, st.bar);
      centered(c, st.t, w / 2, 56, w - 40, 44, col(st.bar), 'bold', 4);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      st.l.forEach((t, i) => {
        if (!t) return;
        c.font = `600 ${i === 0 ? 28 : 24}px ${JP_FONT}`;
        c.fillStyle = i === 0 ? '#4b4757' : '#6a6577';
        c.fillText(t, w / 2, 112 + i * 44);
      });
    })
  );

/* ------------------------------ the Showa units ------------------------------ */

/** Block name plate for a walk-up. */
export const blockPlate = (variant = 0) =>
  cached('blockPlate' + variant, () =>
    make(512, 152, (c, w, h) => {
      /* Appended, never reordered: `plate:` on a walk-up is an index into this
       * array, so inserting a name would rechristen a block that is already
       * standing. */
      /* Take Me Back to Japan: our own names, same count. */
      const names = [['コーポ ふじみ', 'CORP  FUJIMI'], ['メゾン こもれび', 'MAISON  KOMOREBI'],
        ['ハイツ あおば', 'HEIGHTS  AOBA'], ['コーポ みなみ', 'CORP  MINAMI'],
        ['グリーンハイツ', 'GREEN  HEIGHTS'], ['すずらん荘', 'SUZURAN  SO'],
        ['コーポ ひがし', 'CORP  HIGASHI'], ['ハイツ みのり', 'HEIGHTS  MINORI'],
        ['ふもと荘', 'FUMOTO  SO'], ['コーポ あけぼの', 'CORP  AKEBONO']];
      const st = names[variant % names.length];
      c.fillStyle = '#f4f2ea';
      c.fillRect(0, 0, w, h);
      rule(c, 0, h - 13, w, 13, PAL.trim);
      /* The romanisation is **stacked under** the name, centred, rather than set
       * beside it -- which is how `hallPlate` does it and why that one is legible.
       * Side by side it does not fit: the name was centred at 0.4 w with 0.56 w
       * of room, so a seven-character name reaches x = 363 while the roman line
       * started at 358, and 15 Latin characters then ran off the 512 px plate as
       * well.  Both plates already standing in the world were clipped -- ひばり台
       * コーポ read 'HIBARIDAI CO' with the last letters underneath the 台 -- and
       * no romanisation short enough to fix it would have been worth reading.
       * Stacked, any name up to eight characters fits with either line intact. */
      centered(c, st[0], w / 2, h * 0.38, w - 60, 66, '#4b4757', 'bold', 6);
      centered(c, st[1], w / 2, h * 0.76, w - 90, 24, '#8f8a9c', '600', 5);
    })
  );

/* ------------------------------- the summer festival ------------------------------- */

/* ------------------------------ housing details ------------------------------ */

/** Door nameplate. Fictional surnames; nobody appears in the world. */
export const namePlate = (variant = 0) =>
  cached('namePlate' + variant, () =>
    make(256, 128, (c, w, h) => {
      /* Appended, never reordered: a plate's variant is a bare index, so
       * inserting a surname would move somebody else's front door.  Six was
       * enough for one lane and is not enough for thirty. */
      const names = ['森田', '白石', '東', '小谷', '中根', '若宮',
        '瀬川', '大野', '朝倉', '柏木', '津田', '室井'];
      c.fillStyle = ['#f2ece0', '#e4e8ee', '#efe6e6'][variant % 3];
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#a49eae';
      c.lineWidth = 5;
      c.strokeRect(8, 8, w - 16, h - 16);
      centered(c, names[variant % names.length], w / 2, h / 2, w - 50, 62, '#43404f', 'bold', 8);
    })
  );

/* -------------------------------- interiors -------------------------------- */

/**
 * The inside of a small shop, seen from the pavement through a recessed
 * glazed front: shelving, a chiller run, a counter.  Flat and low contrast --
 * it is depth behind glass, not a room the player will ever be in.
 */
export const shopInterior = (variant = 0) =>
  cached('shopInterior' + variant, () =>
    make(512, 320, (c, w, h) => {
      const v = variant % 4;
      c.fillStyle = ['#e2ddd2', '#e6dcc8', '#dcd8d0', '#e8ded0'][v];
      c.fillRect(0, 0, w, h);
      rule(c, 0, 0, w, 40, 0xf2eee4);        // ceiling, lit
      rule(c, 0, h - 60, w, 60, 0xbfb6a6);   // floor
      if (v === 3) {
        /* The bathhouse entrance hall.  The 下足箱 themselves are real
         * geometry standing in the recess (see `shotengai.js`) -- what this
         * has to supply is the thing behind them, which is the pair of
         * curtained doorways.  Two of them, side by side, is the whole
         * grammar of the building. */
        rule(c, 0, h - 60, w, 14, 0xa89a86);           // the 上がり框, one step up
        rule(c, 24, 96, 150, h - 168, 0xcfc0a8);       // more lockers, half seen
        c.fillStyle = '#b6a68c';
        for (let r = 0; r < 4; r++) c.fillRect(30, 108 + r * 42, 138, 6);
        // the counter side, between the lockers and the doorways
        rule(c, 182, 118, 42, h - 190, 0xb99a72);
        for (const [x0, label, tone] of [[236, '男湯', '#2f4a72'], [376, '女湯', '#8a3f56']]) {
          rule(c, x0, 74, 118, h - 148, 0x6f6656);     // the opening, in shadow
          rule(c, x0, 74, 118, 74, tone);              // the noren over it
          c.fillStyle = 'rgba(232,238,246,0.92)';
          c.font = `bold 30px ${JP_FONT}`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          [...label].forEach((ch, i) => c.fillText(ch, x0 + 34 + i * 50, 112));
          // the slit, so it reads as cloth and not a painted board
          c.fillStyle = '#6f6656';
          c.fillRect(x0 + 57, 104, 5, 44);
        }
      } else if (v === 0) {
        // convenience store: a chiller run, then gondola shelving
        c.fillStyle = '#c6d8e0';
        c.fillRect(20, 56, 190, 200);
        c.fillStyle = '#eaf2f6';
        for (let r = 0; r < 4; r++) c.fillRect(28, 68 + r * 48, 174, 8);
        const cols = ['#e0453f', '#f4c033', '#3d6ec4', '#2f9c9a', '#ef8a3c', '#8fbf4a'];
        for (let r = 0; r < 4; r++) {
          for (let i = 0; i < 9; i++) {
            c.fillStyle = cols[(r * 3 + i) % cols.length];
            c.fillRect(32 + i * 19, 76 + r * 48, 13, 30);
          }
        }
        c.fillStyle = '#d8d2c4';
        c.fillRect(238, 120, 250, 20);
        c.fillRect(238, 176, 250, 20);
        c.fillStyle = '#b6ad9c';
        for (let i = 0; i < 8; i++) c.fillRect(246 + i * 30, 96, 22, 24);
        for (let i = 0; i < 8; i++) c.fillRect(246 + i * 30, 150, 22, 26);
      } else if (v === 1) {
        // counter shop: a long counter, stools, a curtain to the back
        c.fillStyle = '#a8825c';
        c.fillRect(0, 168, w, 30);
        c.fillStyle = '#8e6a48';
        c.fillRect(0, 198, w, 62);
        c.fillStyle = '#b5322f';
        c.fillRect(0, 40, w, 44);
        c.fillStyle = '#f2e8d6';
        for (let i = 0; i < 6; i++) c.fillRect(28 + i * 82, 50, 44, 24);
        c.fillStyle = '#6a6153';
        for (let i = 0; i < 6; i++) c.fillRect(40 + i * 82, 200, 34, 12);
      } else {
        // general goods: tall shelving, boxes, a step ladder shape
        c.fillStyle = '#cdc3b0';
        for (let i = 0; i < 4; i++) c.fillRect(24 + i * 124, 52, 100, 210);
        c.fillStyle = '#b3a894';
        for (let i = 0; i < 4; i++) {
          for (let r = 0; r < 4; r++) c.fillRect(24 + i * 124, 52 + r * 52, 100, 8);
        }
        const cols = ['#efe0c4', '#dcc9a8', '#e8d4b6', '#cbb894'];
        for (let i = 0; i < 4; i++) {
          for (let r = 0; r < 4; r++) {
            c.fillStyle = cols[(i + r) % 4];
            c.fillRect(32 + i * 124, 62 + r * 52, 84, 38);
          }
        }
      }
      // the flat wash a shop window puts over everything behind it
      c.fillStyle = 'rgba(120,116,140,0.16)';
      c.fillRect(0, 0, w, h);
    })
  );

/** Frosted / net curtain, half drawn. */
export const curtainTex = (variant = 0) =>
  cached('curtainTex' + variant, () =>
    make(256, 256, (c, w, h) => {
      c.fillStyle = variant ? '#eef2f6' : hex(PAL.curtain);
      c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(150,144,164,0.28)';
      for (let i = 0; i < 12; i++) {
        const x = i * 21 + ((i % 3) * 3);
        c.fillRect(x, 0, 7, h);
      }
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillRect(0, 0, w, 18);
    })
  );

/** Warm window glow with a hint of what is behind it -- no figures. */
export const litWindowTex = (variant = 0) =>
  cached('litWindow' + variant, () =>
    make(256, 256, (c, w, h) => {
      c.fillStyle = ['#f7e2b8', '#f2dcc0', '#f6e6c8'][variant % 3];
      c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(160,124,86,0.3)';
      if (variant % 3 === 0) {
        c.fillRect(24, 150, 208, 14);        // a shelf
        c.fillRect(40, 96, 34, 54);          // things on it
        c.fillRect(88, 110, 26, 40);
      } else if (variant % 3 === 1) {
        c.fillRect(0, 176, w, 80);           // a low cabinet
        c.fillRect(150, 60, 70, 116);        // a tall lamp shape
      } else {
        c.fillRect(30, 40, 90, 12);
        c.fillRect(30, 70, 60, 12);
        c.fillRect(0, 200, w, 56);
      }
      // the pale wash a paper screen gives
      c.fillStyle = 'rgba(255,246,224,0.4)';
      c.fillRect(0, 0, w, h);
    })
  );

/* ------------------------------------------------------------------ *
 * 湯の坂 -- the onsen street.
 *
 * Same rules as everything above -- flat shapes, one accent per sign, no
 * photographic detail -- but the palette runs older and warmer than the
 * shopping street's: indigo and bare timber instead of enamel and plastic, so
 * the two streets read as different decades rather than as different colour
 * schemes.  Every name here is invented.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * The neighbourhood services.
 *
 * A clinic, a chemist, a laundry and a letting agent, plus the community
 * hall and the street furniture that comes with a block of housing.  The
 * four interiors here are all 512 x 256 -- shorter than `shopInterior`'s
 * 320, because these sit behind wide low windows rather than a full-height
 * shopfront -- and all four are drawn *dark* with a violet wash over the
 * top.  That wash is the whole reason the glass in front reads as glass:
 * an interior painted at street brightness makes the pane vanish and the
 * building end up looking like a hole.  Nobody is in any of them; a waiting
 * room at four in the afternoon is empty, which is the point.
 * ------------------------------------------------------------------ */

/* ================================================================== *
 * ひばり台七丁目 -- スーパー さかえ and its roof car park.
 *
 * A local supermarket is the one building in a Japanese suburb whose whole
 * elevation is *print*: the fascia, the hours, the banner over the doors, the
 * price sheets taped inside the glass and the A-board on the pavement.  So the
 * district needs more new art than any other has, and all of it is appended --
 * every `variant:` already standing in the world is a bare index.
 *
 * Two rules held throughout.  **Nobody is on any of it**, which for a
 * supermarket means the produce posters are produce and the parking guide is a
 * diagram.  And the ground is always near-white with one saturated bar: this
 * building is twice the footprint of anything else in the district, and if its
 * signage were as loud as its mass it would be the only thing in every frame it
 * appears in.
 * ================================================================== */

/* ------------------------------------------------------------------ *
 * ひばり山 -- the back hills and the railway tunnel through them.
 *
 * Appended, like everything before it: every `variant:`, `kind:` and `plate:`
 * index in the world is a position in one of these tables, so nothing may be
 * inserted above.
 *
 * The range is ひばり山, the tunnel ひばり山トンネル, the viewing deck
 * ひばり山 展望台 and the stone shrine on the path 山ノ神.  The bearings on the
 * view panel are the real ones, measured off the world -- a 展望案内板 whose
 * arrows point at nothing is the fastest way to give a hilltop away as a set.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * 東山トンネル -- the second bore, through the east shoulder's col, and the
 * plates that only exist because a player can now walk into a tunnel.
 *
 * Appended, like everything before it.  The bore's own signage is a different
 * problem from the lineside's: at the mouth you read a plate from twenty metres
 * and it has to be a shape, but on the lining you read one from two, so these
 * carry real text at real sizes and are the first plates in the world sized for
 * that distance.
 * ------------------------------------------------------------------ */

/**
 * The maintenance gate's plate, on the leaf itself.
 *
 * This is the one sign in the world whose job is to explain a *route*: the gate
 * is the only reason a player standing on the lineside believes they are allowed
 * to walk into a railway tunnel, so it says who may and what the path is, rather
 * than only saying keep out.
 */
/* ------------------------------------------------------------------ *
 * ひばり湖 -- the lake district.
 *
 * Appended, like every other table in this file, because `variant:` indices are
 * baked into geometry all over the world.  Nine generators for twenty-six
 * different pieces of signage, which is the ratio this file has settled at: one
 * variant list per *kind* of sign, because a lake's plates all look alike and
 * differ only in what they say.
 * ------------------------------------------------------------------ */

