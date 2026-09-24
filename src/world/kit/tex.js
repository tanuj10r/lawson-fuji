import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Canvas2D art for the town kit (AGENTS.md: everything drawn in code).
 *
 *   decalAtlas()   one 2048 atlas for everything painted or set flush in
 *                  the ground: markings, manholes, grates, gutter lids,
 *                  patches, cracks, petal drifts, tactile tiles
 *   asphaltTex(), paverTex()   tiling surface textures, world-mapped
 *   plateTex()     sign faces (and grey backs) for kit/signs.js
 *
 * Flat, low-frequency shapes: an anime background, not a photo.
 * ------------------------------------------------------------------ */

export const JP = `'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Yu Gothic', 'Yu Gothic UI', Meiryo, 'Noto Sans JP', sans-serif`;
const cache = new Map();

function canvasTex(key, w, h, draw, { repeat = false, aniso = 8 } = {}) {
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set(key, tex);
  return tex;
}

/** Seeded PRNG local to the art, so textures never shift between loads. */
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

/** Text fitted to a box; `sy` stretches it vertically (road lettering). */
function fit(c, str, x, y, maxW, size, color, { weight = 'bold', sy = 1, align = 'center' } = {}) {
  let s = size;
  do {
    c.font = `${weight} ${s}px ${JP}`;
    if (c.measureText(str).width <= maxW) break;
    s -= 1;
  } while (s > 6);
  c.save();
  c.translate(x, y);
  c.scale(1, sy);
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(str, 0, 0);
  c.restore();
}

/* ------------------------------ surfaces ------------------------------ */

/** Asphalt: a pale grey-violet with soft low-frequency blotches and a light
 * aggregate speckle.  Tiles every `ASPHALT_TILE` metres. */
export const ASPHALT_TILE = 12;
export const asphaltTex = () =>
  canvasTex('asphalt', 512, 512, (c, w, h) => {
    const r = rng(11);
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    // broad tone drift, wrapped so the tile repeats cleanly
    for (let i = 0; i < 26; i++) {
      const x = r() * w, y = r() * h, rad = 40 + r() * 120;
      const dark = r() < 0.55;
      for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
        const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        g.addColorStop(0, dark ? 'rgba(120,112,140,0.10)' : 'rgba(255,255,255,0.12)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
    // aggregate: sparse two-tone flecks, kept faint
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h;
      c.fillStyle = r() < 0.5 ? 'rgba(90,84,110,0.16)' : 'rgba(255,255,255,0.22)';
      c.fillRect(x, y, 1 + (r() < 0.2), 1 + (r() < 0.2));
    }
  }, { repeat: true });

/** Interlocking pavement: 0.2 x 0.1 m blocks in a running bond, two tones. */
export const PAVER_TILE = 2.4;
export const paverTex = () =>
  canvasTex('paver', 512, 512, (c, w, h) => {
    const r = rng(23);
    const bw = w / 12, bh = h / 24;
    for (let row = 0; row < 24; row++) {
      const off = (row % 2) * bw * 0.5;
      for (let col = -1; col < 13; col++) {
        const t = r();
        c.fillStyle = t < 0.08 ? '#d9d2dc' : t < 0.16 ? '#f6f2f4' : '#ece8ee';
        c.fillRect(col * bw + off, row * bh, bw, bh);
      }
    }
    c.strokeStyle = 'rgba(150,140,165,0.55)';
    c.lineWidth = 1.2;
    for (let row = 0; row <= 24; row++) {
      c.beginPath(); c.moveTo(0, row * bh); c.lineTo(w, row * bh); c.stroke();
      const off = (row % 2) * bw * 0.5;
      for (let col = 0; col <= 13; col++) {
        c.beginPath(); c.moveTo(col * bw + off, row * bh); c.lineTo(col * bw + off, row * bh + bh); c.stroke();
      }
    }
  }, { repeat: true });

/** Concrete for gutters and kerbs: flat with a faint joint every metre. */
export const concreteTex = () =>
  canvasTex('kitConcrete', 256, 256, (c, w, h) => {
    const r = rng(5);
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(120,112,140,0.10)' : 'rgba(255,255,255,0.3)';
      c.fillRect(r() * w, r() * h, 2, 2);
    }
    c.fillStyle = 'rgba(110,100,130,0.45)';
    c.fillRect(0, 0, 3, h);
  }, { repeat: true });

/* ------------------------------ decal atlas ------------------------------ *
 * 8 x 8 cells of 256 px.  A cell may span several slots (`span`).  Each
 * cell is drawn inside an 8 px margin so mipmaps never bleed a neighbour in;
 * `cellUV` insets by the same amount. */

const A = 2048, S = 256, PAD = 8;
const WHITE = '#f6f4f8', YELLOW = '#f2c23c', GREEN = 'rgba(96,176,120,0.92)', BLUE = 'rgba(80,140,210,0.9)';

/** Slight wear: knock random specks out of a painted cell. */
function wear(c, x, y, w, h, seed, amount = 140) {
  const r = rng(seed);
  c.save();
  c.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < amount; i++) {
    c.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.5})`;
    c.fillRect(x + r() * w, y + r() * h, 1 + r() * 3, 1 + r() * 2);
  }
  c.restore();
}

function manhole(c, w, h, { ring = '#7d7788', face = '#8f899a', motif, seed }) {
  const cx = w / 2, cy = h / 2, R = w / 2 - 4;
  c.fillStyle = ring;
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
  c.fillStyle = face;
  c.beginPath(); c.arc(cx, cy, R * 0.88, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(60,54,72,0.55)';
  c.lineWidth = 3;
  c.beginPath(); c.arc(cx, cy, R * 0.88, 0, Math.PI * 2); c.stroke();
  motif(c, cx, cy, R * 0.8);
  wear(c, 0, 0, w, h, seed, 60);
}

const CELLS = {
  // --- paint ---
  white: { at: [0, 0], draw: (c, w, h) => { c.fillStyle = WHITE; c.fillRect(0, 0, w, h); wear(c, 0, 0, w, h, 1, 90); } },
  yellow: { at: [1, 0], draw: (c, w, h) => { c.fillStyle = YELLOW; c.fillRect(0, 0, w, h); wear(c, 0, 0, w, h, 2, 90); } },
  green: { at: [2, 0], draw: (c, w, h) => { c.fillStyle = GREEN; c.fillRect(0, 0, w, h); wear(c, 0, 0, w, h, 3, 200); } },
  blue: { at: [3, 0], draw: (c, w, h) => { c.fillStyle = BLUE; c.fillRect(0, 0, w, h); wear(c, 0, 0, w, h, 4, 200); } },
  tomare: {
    at: [4, 0], draw: (c, w, h) => {
      // three tall glyphs across the lane, stretched ~2.6x along travel
      ['止', 'ま', 'れ'].forEach((g, i) => fit(c, g, w * (i + 0.5) / 3, h / 2, w / 3, 86, WHITE, { sy: 2.8 }));
      wear(c, 0, 0, w, h, 5);
    },
  },
  n30: { at: [5, 0], draw: (c, w, h) => { fit(c, '30', w / 2, h / 2, w, 140, WHITE, { sy: 1.7 }); wear(c, 0, 0, w, h, 6); } },
  n40: { at: [6, 0], draw: (c, w, h) => { fit(c, '40', w / 2, h / 2, w, 140, WHITE, { sy: 1.7 }); wear(c, 0, 0, w, h, 7); } },
  diamond: {
    at: [7, 0], draw: (c, w, h) => {
      c.strokeStyle = WHITE;
      c.lineWidth = 16;
      c.beginPath();
      c.moveTo(w / 2, 12); c.lineTo(w - 22, h / 2); c.lineTo(w / 2, h - 12); c.lineTo(22, h / 2);
      c.closePath(); c.stroke();
      wear(c, 0, 0, w, h, 8);
    },
  },
  school: {
    at: [0, 1], span: [2, 1], draw: (c, w, h) => {
      fit(c, 'スクールゾーン', w / 2, h / 2, w - 10, 90, WHITE, { sy: 2.2 });
      wear(c, 0, 0, w, h, 9, 220);
    },
  },
  pedprio: {
    at: [2, 1], span: [2, 1], draw: (c, w, h) => {
      fit(c, '歩行者優先', w / 2, h / 2, w - 10, 100, WHITE, { sy: 2.2 });
      wear(c, 0, 0, w, h, 10, 220);
    },
  },
  bus: {
    at: [4, 1], draw: (c, w, h) => {
      fit(c, 'バス', w / 2, h / 2, w - 20, 120, YELLOW, { sy: 1.9 });
      wear(c, 0, 0, w, h, 11);
    },
  },
  bike: {
    at: [5, 1], draw: (c, w, h) => {
      // a bicycle seen from above-side, as painted in cycle lanes
      c.strokeStyle = WHITE;
      c.lineWidth = 11;
      c.lineCap = 'round';
      const r = 46, y = h * 0.62;
      c.beginPath(); c.arc(w * 0.27, y, r, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(w * 0.73, y, r, 0, Math.PI * 2); c.stroke();
      c.beginPath();
      c.moveTo(w * 0.27, y); c.lineTo(w * 0.45, y - 62); c.lineTo(w * 0.66, y - 62); c.lineTo(w * 0.73, y);
      c.moveTo(w * 0.27, y); c.lineTo(w * 0.52, y); c.lineTo(w * 0.66, y - 62);
      c.moveTo(w * 0.45, y - 62); c.lineTo(w * 0.42, y - 84); c.lineTo(w * 0.5, y - 84);
      c.moveTo(w * 0.66, y - 62); c.lineTo(w * 0.64, y - 90); c.lineTo(w * 0.72, y - 96);
      c.stroke();
      wear(c, 0, 0, w, h, 12);
    },
  },
  arrow: {
    at: [6, 1], draw: (c, w, h) => {
      // points to the top of the cell (+ along travel)
      c.fillStyle = WHITE;
      c.beginPath();
      c.moveTo(w / 2, 8); c.lineTo(w - 50, 110); c.lineTo(w / 2 + 22, 110); c.lineTo(w / 2 + 22, h - 8);
      c.lineTo(w / 2 - 22, h - 8); c.lineTo(w / 2 - 22, 110); c.lineTo(50, 110);
      c.closePath(); c.fill();
      wear(c, 0, 0, w, h, 13);
    },
  },
  petals: {
    at: [7, 1], draw: (c, w, h) => {
      const r = rng(14);
      for (let i = 0; i < 420; i++) {
        // denser toward the middle, fading out to the edge
        const a = r() * Math.PI * 2, d = Math.pow(r(), 0.7) * w * 0.47;
        const x = w / 2 + Math.cos(a) * d, y = h / 2 + Math.sin(a) * d * 0.6;
        c.fillStyle = ['#f8c8d8', '#f4b4c8', '#fbd8e4', '#eea6bd'][Math.floor(r() * 4)];
        c.beginPath();
        c.ellipse(x, y, 3 + r() * 3, 2 + r() * 2, r() * Math.PI, 0, Math.PI * 2);
        c.fill();
      }
    },
  },
  // --- set into the road ---
  mhSewer: {
    at: [0, 2], draw: (c, w, h) => manhole(c, w, h, {
      seed: 15, motif: (x, cx, cy, R) => {
        x.strokeStyle = 'rgba(70,64,84,0.6)'; x.lineWidth = 4;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          x.beginPath(); x.moveTo(cx + Math.cos(a) * R * 0.25, cy + Math.sin(a) * R * 0.25);
          x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.stroke();
        }
        x.beginPath(); x.arc(cx, cy, R * 0.25, 0, Math.PI * 2); x.stroke();
        x.beginPath(); x.arc(cx, cy, R * 0.62, 0, Math.PI * 2); x.stroke();
      },
    }),
  },
  mhWater: {
    at: [1, 2], draw: (c, w, h) => manhole(c, w, h, {
      seed: 16, face: '#958fa0', motif: (x, cx, cy, R) => {
        x.strokeStyle = 'rgba(70,64,84,0.5)'; x.lineWidth = 3;
        for (let k = -4; k <= 4; k++) {
          const d = (k / 4.6) * R, s = Math.sqrt(Math.max(0, R * R - d * d));
          x.beginPath(); x.moveTo(cx + d, cy - s); x.lineTo(cx + d, cy + s); x.stroke();
          x.beginPath(); x.moveTo(cx - s, cy + d); x.lineTo(cx + s, cy + d); x.stroke();
        }
        x.fillStyle = '#958fa0'; x.fillRect(cx - 44, cy - 22, 88, 44);
        fit(x, '水道', cx, cy, 80, 34, 'rgba(60,54,72,0.8)');
      },
    }),
  },
  mhCity: {
    at: [2, 2], draw: (c, w, h) => manhole(c, w, h, {
      // the town's own design: a five-petal blossom over a mountain line
      seed: 17, face: '#948ea0', motif: (x, cx, cy, R) => {
        x.fillStyle = 'rgba(70,64,84,0.45)';
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          x.beginPath(); x.ellipse(cx + Math.cos(a) * R * 0.3, cy + Math.sin(a) * R * 0.3, R * 0.22, R * 0.14, a, 0, Math.PI * 2); x.fill();
        }
        x.strokeStyle = 'rgba(70,64,84,0.5)'; x.lineWidth = 4;
        x.beginPath(); x.moveTo(cx - R * 0.8, cy + R * 0.55); x.lineTo(cx - R * 0.2, cy + R * 0.2);
        x.lineTo(cx + R * 0.1, cy + R * 0.3); x.lineTo(cx + R * 0.8, cy + R * 0.55); x.stroke();
      },
    }),
  },
  mhFire: {
    at: [3, 2], draw: (c, w, h) => manhole(c, w, h, {
      seed: 18, ring: '#b79a2c', face: '#e8c440', motif: (x, cx, cy, R) => {
        fit(x, '消火栓', cx, cy, R * 1.5, 56, '#8a3024');
      },
    }),
  },
  mhSquare: {
    at: [4, 2], draw: (c, w, h) => {
      c.fillStyle = '#7d7788'; c.fillRect(6, 6, w - 12, h - 12);
      c.fillStyle = '#928c9e'; c.fillRect(20, 20, w - 40, h - 40);
      c.strokeStyle = 'rgba(60,54,72,0.55)'; c.lineWidth = 3;
      for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(20, 20 + i * (h - 40) / 6); c.lineTo(w - 20, 20 + i * (h - 40) / 6); c.stroke(); }
      fit(c, '通信', w / 2, h / 2, 90, 34, 'rgba(60,54,72,0.8)');
      wear(c, 0, 0, w, h, 19, 60);
    },
  },
  grate: {
    at: [5, 2], draw: (c, w, h) => {
      c.fillStyle = '#5d576c'; c.fillRect(10, 30, w - 20, h - 60);
      c.fillStyle = '#8b859a';
      c.fillRect(10, 30, w - 20, 10); c.fillRect(10, h - 40, w - 20, 10);
      for (let x = 22; x < w - 20; x += 20) c.fillRect(x, 30, 8, h - 60);
    },
  },
  lid: {
    at: [6, 2], draw: (c, w, h) => {
      // one concrete gutter lid, joint along its top edge
      c.fillStyle = '#d6d0da'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(120,110,140,0.7)'; c.fillRect(0, 0, w, 6);
      c.fillStyle = 'rgba(120,110,140,0.4)'; c.fillRect(w * 0.15, h * 0.45, w * 0.12, 8); c.fillRect(w * 0.73, h * 0.45, w * 0.12, 8);
      wear(c, 0, 0, w, h, 20, 30);
    },
  },
  lidGrate: {
    at: [7, 2], draw: (c, w, h) => {
      c.fillStyle = '#d6d0da'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(120,110,140,0.7)'; c.fillRect(0, 0, w, 6);
      c.fillStyle = '#4f4a5e'; c.fillRect(w * 0.12, h * 0.2, w * 0.76, h * 0.6);
      c.fillStyle = '#8b859a';
      for (let y = h * 0.2; y < h * 0.8; y += 18) c.fillRect(w * 0.12, y, w * 0.76, 6);
    },
  },
  // --- wear and weather ---
  patchDark: {
    at: [0, 3], draw: (c, w, h) => {
      const r = rng(21);
      c.fillStyle = 'rgba(88,80,112,0.42)';
      c.beginPath();
      for (let i = 0; i <= 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        const k = 0.86 + r() * 0.12;
        const x = w / 2 + Math.cos(a) * (w / 2 - 10) * k, y = h / 2 + Math.sin(a) * (h / 2 - 10) * k;
        // squarish, like a cut-and-filled trench patch
        const sq = Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
        c.lineTo(w / 2 + (x - w / 2) / sq * 0.72, h / 2 + (y - h / 2) / sq * 0.72);
      }
      c.fill();
    },
  },
  patchLight: {
    at: [1, 3], draw: (c, w, h) => {
      const r = rng(22);
      c.fillStyle = 'rgba(255,255,255,0.26)';
      c.beginPath();
      for (let i = 0; i <= 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const k = 0.7 + r() * 0.3;
        c.lineTo(w / 2 + Math.cos(a) * (w / 2 - 10) * k, h / 2 + Math.sin(a) * (h / 2 - 10) * k);
      }
      c.fill();
    },
  },
  crack: {
    at: [2, 3], span: [1, 2], draw: (c, w, h) => {
      const r = rng(24);
      c.strokeStyle = 'rgba(70,62,90,0.55)';
      c.lineCap = 'round';
      const branch = (x, y, a, len, width) => {
        c.lineWidth = width;
        c.beginPath(); c.moveTo(x, y);
        for (let s = 0; s < len; s += 8) {
          a += (r() - 0.5) * 0.6;
          x += Math.sin(a) * 8; y += Math.cos(a) * 8;
          c.lineTo(x, y);
          if (r() < 0.05 && width > 1.5) {
            c.stroke();
            branch(x, y, a + (r() < 0.5 ? 0.9 : -0.9), len * 0.35, width * 0.6);
            c.lineWidth = width; c.beginPath(); c.moveTo(x, y);
          }
        }
        c.stroke();
      };
      branch(w / 2, 14, 0, h - 40, 3.2);
    },
  },
  stain: {
    at: [3, 3], draw: (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2 - 10);
      g.addColorStop(0, 'rgba(70,62,92,0.35)');
      g.addColorStop(0.7, 'rgba(70,62,92,0.16)');
      g.addColorStop(1, 'rgba(70,62,92,0)');
      c.fillStyle = g;
      c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 10, h / 2 - 30, 0.3, 0, Math.PI * 2); c.fill();
    },
  },
  tactileLine: {
    at: [4, 3], draw: (c, w, h) => {
      // one 0.3 m tile, bars along travel
      c.fillStyle = '#f0c238'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#d9a820';
      for (let i = 0; i < 4; i++) c.fillRect(w * (0.12 + i * 0.21), h * 0.08, w * 0.12, h * 0.84);
      c.fillStyle = 'rgba(150,110,20,0.6)'; c.fillRect(0, 0, w, 4); c.fillRect(0, 0, 4, h);
    },
  },
  tactileDot: {
    at: [5, 3], draw: (c, w, h) => {
      c.fillStyle = '#f0c238'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#d9a820';
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
        c.beginPath(); c.arc(w * (0.12 + i * 0.19), h * (0.12 + j * 0.19), w * 0.06, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = 'rgba(150,110,20,0.6)'; c.fillRect(0, 0, w, 4); c.fillRect(0, 0, 4, h);
    },
  },
  leaves: {
    at: [6, 3], draw: (c, w, h) => {
      // grit and a few fallen leaves at the kerb foot
      const r = rng(25);
      for (let i = 0; i < 160; i++) {
        c.fillStyle = r() < 0.7 ? 'rgba(110,100,120,0.35)' : 'rgba(150,130,90,0.6)';
        const y = h * (0.35 + r() * 0.3);
        c.fillRect(r() * w, y, 2 + r() * 4, 2 + r() * 3);
      }
    },
  },
};

let atlas = null;
export function decalAtlas() {
  if (atlas) return atlas;
  const cv = document.createElement('canvas');
  cv.width = A;
  cv.height = A;
  const c = cv.getContext('2d');
  for (const cell of Object.values(CELLS)) {
    const [sx, sy] = cell.span ?? [1, 1];
    const x = cell.at[0] * S + PAD, y = cell.at[1] * S + PAD;
    const w = sx * S - PAD * 2, h = sy * S - PAD * 2;
    c.save();
    c.translate(x, y);
    c.beginPath(); c.rect(0, 0, w, h); c.clip();
    cell.draw(c, w, h);
    c.restore();
  }
  atlas = new THREE.CanvasTexture(cv);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 16;
  return atlas;
}

/** [u0, v0, u1, v1] of a cell; v runs up as in three.js. */
export function cellUV(name) {
  const cell = CELLS[name];
  if (!cell) throw new Error(`no decal cell "${name}"`);
  const [sx, sy] = cell.span ?? [1, 1];
  const inset = PAD + 1;
  const x0 = cell.at[0] * S + inset, x1 = (cell.at[0] + sx) * S - inset;
  const y0 = cell.at[1] * S + inset, y1 = (cell.at[1] + sy) * S - inset;
  return [x0 / A, 1 - y1 / A, x1 / A, 1 - y0 / A];
}

/* ------------------------------ sign plates ------------------------------ *
 * A sign is drawn twice: the printed face, and a grey back of the same
 * silhouette.  Both use alphaTest, so a triangle reads as a triangle. */

function shapePath(c, shape, w, h, inset = 0) {
  const i = inset;
  c.beginPath();
  if (shape === 'circle') c.arc(w / 2, h / 2, Math.min(w, h) / 2 - i, 0, Math.PI * 2);
  else if (shape === 'triangle') { c.moveTo(i * 1.7, i); c.lineTo(w - i * 1.7, i); c.lineTo(w / 2, h - i * 2); c.closePath(); }
  else if (shape === 'diamond') { c.moveTo(w / 2, i); c.lineTo(w - i, h / 2); c.lineTo(w / 2, h - i); c.lineTo(i, h / 2); c.closePath(); }
  else {
    const r = shape === 'round-rect' ? 18 : 6;
    c.roundRect(i, i, w - i * 2, h - i * 2, r);
  }
}

/**
 * Sign art.  `kind` picks the design; `o` carries its words.  Returns
 * { face, back, shape, aspect }.
 */
export function plateTex(kind, o = {}) {
  const key = `plate|${kind}|${JSON.stringify(o)}`;
  const d = PLATES[kind];
  if (!d) throw new Error(`no plate "${kind}"`);
  const [w, h] = d.size(o);
  const face = canvasTex(key, w, h, (c) => {
    c.save();
    shapePath(c, d.shape, w, h);
    c.clip();
    d.draw(c, w, h, o);
    c.restore();
  });
  const back = canvasTex(`back|${d.shape}|${w}x${h}`, w, h, (c) => {
    c.fillStyle = '#a7a3b0';
    shapePath(c, d.shape, w, h);
    c.fill();
  });
  return { face, back, shape: d.shape, aspect: w / h };
}

const RED = '#d8302c', NAVY = '#1f4fa8', SIGN_WHITE = '#fbfaf6';

const PLATES = {
  speed: {
    shape: 'circle', size: () => [256, 256],
    draw: (c, w, h, o) => {
      c.fillStyle = RED; c.fillRect(0, 0, w, h);
      c.fillStyle = SIGN_WHITE; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 30, 0, Math.PI * 2); c.fill();
      fit(c, String(o.n ?? 30), w / 2, h / 2 + 4, w - 90, 130, NAVY, { sy: 1.15 });
    },
  },
  tomare: {
    shape: 'triangle', size: () => [288, 256],
    draw: (c, w, h) => {
      c.fillStyle = RED; c.fillRect(0, 0, w, h);
      c.strokeStyle = SIGN_WHITE; c.lineWidth = 8;
      shapePath(c, 'triangle', w, h, 12); c.stroke();
      fit(c, '止まれ', w / 2, h * 0.34, w * 0.62, 70, SIGN_WHITE);
      fit(c, 'STOP', w / 2, h * 0.55, w * 0.3, 26, SIGN_WHITE);
    },
  },
  schoolZone: {
    shape: 'diamond', size: () => [256, 256],
    draw: (c, w, h) => {
      c.fillStyle = '#f5c53a'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#1b1b24'; c.lineWidth = 7;
      shapePath(c, 'diamond', w, h, 14); c.stroke();
      // two children walking, hand in hand
      c.fillStyle = '#1b1b24';
      const kid = (x, s) => {
        c.beginPath(); c.arc(x, h * 0.36, 13 * s, 0, Math.PI * 2); c.fill();
        c.fillRect(x - 10 * s, h * 0.42, 20 * s, 38 * s);
        c.fillRect(x - 10 * s, h * 0.42 + 38 * s, 7 * s, 30 * s);
        c.fillRect(x + 3 * s, h * 0.42 + 38 * s, 7 * s, 30 * s);
      };
      kid(w * 0.42, 1.1); kid(w * 0.6, 0.85);
      c.fillRect(w * 0.42, h * 0.5, w * 0.18, 6);
    },
  },
  noParking: {
    shape: 'circle', size: () => [256, 256],
    draw: (c, w, h) => {
      c.fillStyle = RED; c.fillRect(0, 0, w, h);
      c.fillStyle = '#2a64c4'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 28, 0, Math.PI * 2); c.fill();
      c.strokeStyle = RED; c.lineWidth = 26;
      c.beginPath(); c.moveTo(w * 0.28, h * 0.28); c.lineTo(w * 0.72, h * 0.72); c.stroke();
    },
  },
  pedCross: {
    shape: 'rect', size: () => [256, 256],
    draw: (c, w, h) => {
      c.fillStyle = '#2a64c4'; c.fillRect(0, 0, w, h);
      c.strokeStyle = SIGN_WHITE; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20);
      c.fillStyle = SIGN_WHITE;
      c.beginPath(); c.moveTo(w / 2, 30); c.lineTo(w - 30, h - 34); c.lineTo(30, h - 34); c.closePath(); c.fill();
      c.fillStyle = '#1b1b24';
      c.beginPath(); c.arc(w * 0.52, h * 0.4, 12, 0, Math.PI * 2); c.fill();
      c.lineWidth = 11; c.strokeStyle = '#1b1b24'; c.lineCap = 'round';
      c.beginPath(); c.moveTo(w * 0.5, h * 0.47); c.lineTo(w * 0.46, h * 0.64);
      c.lineTo(w * 0.4, h * 0.76); c.moveTo(w * 0.46, h * 0.64); c.lineTo(w * 0.56, h * 0.76);
      c.moveTo(w * 0.42, h * 0.54); c.lineTo(w * 0.58, h * 0.56); c.stroke();
      for (let i = 0; i < 5; i++) { c.fillStyle = '#1b1b24'; c.fillRect(w * (0.28 + i * 0.1), h * 0.8, w * 0.05, 8); }
    },
  },
  direction: {
    shape: 'rect', size: () => [512, 320],
    draw: (c, w, h, o) => {
      c.fillStyle = '#2458b8'; c.fillRect(0, 0, w, h);
      c.strokeStyle = SIGN_WHITE; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20);
      c.fillStyle = SIGN_WHITE;
      // ahead arrow with a left and a right branch
      c.fillRect(w / 2 - 14, h * 0.34, 28, h * 0.56);
      c.beginPath(); c.moveTo(w / 2, h * 0.2); c.lineTo(w / 2 + 34, h * 0.36); c.lineTo(w / 2 - 34, h * 0.36); c.fill();
      c.fillRect(w * 0.24, h * 0.62, w * 0.52, 26);
      c.beginPath(); c.moveTo(w * 0.17, h * 0.62 + 13); c.lineTo(w * 0.26, h * 0.54); c.lineTo(w * 0.26, h * 0.76); c.fill();
      c.beginPath(); c.moveTo(w * 0.83, h * 0.62 + 13); c.lineTo(w * 0.74, h * 0.54); c.lineTo(w * 0.74, h * 0.76); c.fill();
      const [left, ahead, right] = o.to ?? ['', '', ''];
      fit(c, ahead, w / 2, h * 0.12, w * 0.5, 44, SIGN_WHITE);
      fit(c, left, w * 0.13, h * 0.45, w * 0.24, 38, SIGN_WHITE);
      fit(c, right, w * 0.87, h * 0.45, w * 0.24, 38, SIGN_WHITE);
      fit(c, o.route ?? '', w / 2, h * 0.86, w * 0.4, 24, SIGN_WHITE);
    },
  },
  hydrant: {
    shape: 'rect', size: () => [160, 384],
    draw: (c, w, h) => {
      c.fillStyle = RED; c.fillRect(0, 0, w, h);
      c.fillStyle = SIGN_WHITE;
      ['消', '火', '栓'].forEach((g, i) => fit(c, g, w / 2, h * (0.22 + i * 0.25), w * 0.8, 96, SIGN_WHITE));
    },
  },
  poleAd: {
    shape: 'rect', size: () => [160, 560],
    draw: (c, w, h, o) => {
      c.fillStyle = o.bg ?? SIGN_WHITE; c.fillRect(0, 0, w, h);
      c.fillStyle = o.bar ?? NAVY; c.fillRect(0, 0, w, 60); c.fillRect(0, h - 90, w, 90);
      fit(c, o.kind ?? '', w / 2, 30, w - 16, 34, SIGN_WHITE);
      const t = [...(o.t ?? '')];
      const step = Math.min(64, (h - 190) / Math.max(1, t.length));
      t.forEach((g, i) => fit(c, g, w / 2, 90 + step * (i + 0.5), w - 20, step * 0.95, o.fg ?? '#20243a'));
      fit(c, o.s ?? '', w / 2, h - 60, w - 14, 30, SIGN_WHITE);
      fit(c, o.tel ?? '', w / 2, h - 24, w - 14, 22, SIGN_WHITE, { weight: 'normal' });
    },
  },
  address: {
    shape: 'rect', size: () => [128, 320],
    draw: (c, w, h, o) => {
      c.fillStyle = '#2d5bb2'; c.fillRect(0, 0, w, h);
      c.fillStyle = SIGN_WHITE;
      const t = [...(o.t ?? '')];
      const step = (h - 40) / Math.max(1, t.length);
      t.forEach((g, i) => fit(c, g, w / 2, 20 + step * (i + 0.5), w - 22, Math.min(step * 0.9, 80), SIGN_WHITE));
    },
  },
  busStop: {
    shape: 'circle', size: () => [256, 256],
    draw: (c, w, h, o) => {
      c.fillStyle = SIGN_WHITE; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1d8a5c'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 14, 0, Math.PI * 2); c.fill();
      c.fillStyle = SIGN_WHITE; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 34, 0, Math.PI * 2); c.fill();
      fit(c, 'バス', w / 2, h * 0.36, w * 0.5, 50, '#1d8a5c');
      fit(c, o.t ?? '', w / 2, h * 0.6, w * 0.64, 36, '#20243a');
    },
  },
  timetable: {
    shape: 'rect', size: () => [256, 384],
    draw: (c, w, h, o) => {
      c.fillStyle = SIGN_WHITE; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1d8a5c'; c.fillRect(0, 0, w, 58);
      fit(c, o.t ?? '', w / 2, 30, w - 20, 34, SIGN_WHITE);
      c.fillStyle = '#20243a';
      for (let hr = 6; hr <= 21; hr++) {
        const y = 70 + (hr - 6) * 19;
        fit(c, String(hr), 22, y + 8, 30, 15, '#20243a', { align: 'center' });
        c.fillStyle = 'rgba(30,30,50,0.25)'; c.fillRect(40, y + 17, w - 50, 1);
        const n = hr < 7 || hr > 19 ? 1 : 3;
        for (let k = 0; k < n; k++) fit(c, String(((hr * 7 + k * 20) % 60)).padStart(2, '0'), 64 + k * 40, y + 8, 30, 14, '#20243a', { weight: 'normal' });
      }
    },
  },
  guard: {
    shape: 'rect', size: () => [256, 128],
    draw: (c, w, h) => {
      // yellow-and-black pole guard, wrapped round the pole foot
      c.fillStyle = '#f2c230'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#23222c';
      for (let x = -h; x < w + h; x += 48) {
        c.beginPath(); c.moveTo(x, h); c.lineTo(x + 24, h); c.lineTo(x + 24 + h, 0); c.lineTo(x + h, 0); c.fill();
      }
    },
  },
};
