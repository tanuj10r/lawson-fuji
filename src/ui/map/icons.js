/* ------------------------------------------------------------------ *
 * The town map's pictograms (map 2.0): one family, drawn with Canvas2D
 * paths.  A coloured disc with a cream ring and a soft drop, a white glyph
 * on it, all in units of the disc's radius so the same drawing reads at
 * the corner map's 9 px and the full map's 14 px.
 * ------------------------------------------------------------------ */

const WHITE = '#fffdf6';

/** Each glyph draws in a unit box (the disc is radius 1), white on the colour. */
const GLYPH = {
  // a shop front: a flat roof bar over an awning's scallops and a door
  konbini(c, col) {
    c.fillRect(-0.58, -0.52, 1.16, 0.2);
    c.beginPath();
    c.moveTo(-0.58, -0.3); c.lineTo(0.58, -0.3); c.lineTo(0.58, -0.12);
    for (let i = 3; i >= 0; i--) c.arc(-0.435 + i * 0.29, -0.12, 0.145, 0, Math.PI);
    c.closePath(); c.fill();
    c.fillRect(-0.5, 0.08, 1.0, 0.46);
    c.fillStyle = col; c.fillRect(-0.12, 0.2, 0.24, 0.34); c.fillRect(-0.4, 0.2, 0.18, 0.16); c.fillRect(0.22, 0.2, 0.18, 0.16);
  },
  // a camera, its lens a ring
  view(c, col) {
    c.beginPath(); c.roundRect(-0.62, -0.3, 1.24, 0.82, 0.14); c.fill();
    c.beginPath(); c.moveTo(-0.24, -0.3); c.lineTo(-0.14, -0.5); c.lineTo(0.14, -0.5); c.lineTo(0.24, -0.3); c.closePath(); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(0, 0.12, 0.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = WHITE; c.beginPath(); c.arc(0, 0.12, 0.17, 0, Math.PI * 2); c.fill();
  },
  // a low sports car in profile: the FD's long bonnet and fastback
  car(c, col) {
    c.beginPath();
    c.moveTo(-0.7, 0.2); c.lineTo(-0.66, -0.02); c.quadraticCurveTo(-0.5, -0.1, -0.2, -0.14);
    c.quadraticCurveTo(-0.02, -0.4, 0.22, -0.36); c.quadraticCurveTo(0.5, -0.28, 0.7, -0.06);
    c.lineTo(0.72, 0.2); c.closePath(); c.fill();
    c.fillStyle = col;
    c.beginPath(); c.moveTo(-0.08, -0.16); c.quadraticCurveTo(0.04, -0.31, 0.2, -0.3); c.lineTo(0.42, -0.16); c.closePath(); c.fill();
    for (const x of [-0.4, 0.42]) { c.beginPath(); c.arc(x, 0.22, 0.2, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = WHITE;
    for (const x of [-0.4, 0.42]) { c.beginPath(); c.arc(x, 0.22, 0.1, 0, Math.PI * 2); c.fill(); }
  },
  // an arcade: a pitched canopy over two shop fronts
  shops(c, col) {
    c.beginPath(); c.moveTo(-0.66, -0.12); c.lineTo(0, -0.56); c.lineTo(0.66, -0.12); c.closePath(); c.fill();
    c.fillRect(-0.52, -0.12, 1.04, 0.62);
    c.fillStyle = col;
    c.fillRect(-0.4, 0.04, 0.3, 0.46); c.fillRect(0.1, 0.04, 0.3, 0.2);
    c.fillRect(-0.66, -0.16, 1.32, 0.07);
  },
  // a shopping bag with a star: the discount palace
  mega(c, col) {
    c.beginPath(); c.moveTo(-0.5, -0.24); c.lineTo(0.5, -0.24); c.lineTo(0.58, 0.56); c.lineTo(-0.58, 0.56); c.closePath(); c.fill();
    c.lineWidth = 0.12; c.strokeStyle = WHITE;
    c.beginPath(); c.arc(0, -0.24, 0.24, Math.PI, 0); c.stroke();
    c.fillStyle = col; star(c, 0, 0.18, 0.27, 0.11);
  },
  // a torii: two rails over two posts
  shrine(c) {
    c.beginPath();
    c.moveTo(-0.7, -0.5); c.quadraticCurveTo(0, -0.38, 0.7, -0.5); c.lineTo(0.66, -0.34); c.quadraticCurveTo(0, -0.24, -0.66, -0.34); c.closePath(); c.fill();
    c.fillRect(-0.5, -0.16, 1.0, 0.12);
    c.fillRect(-0.4, -0.3, 0.14, 0.86); c.fillRect(0.26, -0.3, 0.14, 0.86);
  },
  // a blossom: five petals round a heart
  plaza(c, col) {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      c.save(); c.rotate(a);
      c.beginPath(); c.ellipse(0.32, 0, 0.26, 0.19, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, 0.1, 0, Math.PI * 2); c.fill();
  },
  // a train's face: windscreen, lamps, the skirt
  station(c, col) {
    c.beginPath(); c.roundRect(-0.46, -0.6, 0.92, 1.0, 0.24); c.fill();
    c.fillStyle = col;
    c.beginPath(); c.roundRect(-0.32, -0.44, 0.64, 0.36, 0.08); c.fill();
    c.beginPath(); c.arc(-0.24, 0.16, 0.08, 0, Math.PI * 2); c.arc(0.24, 0.16, 0.08, 0, Math.PI * 2); c.fill();
    c.fillStyle = WHITE;
    c.beginPath(); c.moveTo(-0.3, 0.4); c.lineTo(-0.5, 0.62); c.lineTo(-0.34, 0.62); c.lineTo(-0.16, 0.4); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0.3, 0.4); c.lineTo(0.5, 0.62); c.lineTo(0.34, 0.62); c.lineTo(0.16, 0.4); c.closePath(); c.fill();
  },
  // the crossbuck (踏切 sign): a black-and-yellow X over two lamps
  crossing(c) {
    c.save(); c.lineCap = 'round'; c.lineWidth = 0.22; c.strokeStyle = WHITE;
    c.beginPath(); c.moveTo(-0.52, -0.56); c.lineTo(0.52, -0.02); c.moveTo(0.52, -0.56); c.lineTo(-0.52, -0.02); c.stroke();
    c.restore();
    c.fillRect(-0.07, -0.3, 0.14, 0.9);
    c.beginPath(); c.arc(-0.3, 0.3, 0.14, 0, Math.PI * 2); c.arc(0.3, 0.3, 0.14, 0, Math.PI * 2); c.fill();
    c.fillRect(-0.3, 0.26, 0.6, 0.08);
  },
  // still water: a lotus leaf and two ripples
  pond(c) {
    wave(c, -0.02, 0.62, 0.3);
    wave(c, 0.3, 0.52, 0.22);
    c.beginPath(); c.moveTo(0, -0.26); c.arc(0, -0.26, 0.34, -Math.PI / 2 + 0.35, Math.PI * 1.5 - 0.35); c.closePath(); c.fill();
  },
  // a river under a bridge's arch
  river(c) {
    c.save(); c.lineWidth = 0.14; c.strokeStyle = WHITE;
    c.beginPath(); c.moveTo(-0.66, -0.2); c.quadraticCurveTo(0, -0.66, 0.66, -0.2); c.stroke();
    c.beginPath(); c.moveTo(-0.66, -0.42); c.lineTo(-0.66, -0.12); c.moveTo(0.66, -0.42); c.lineTo(0.66, -0.12); c.stroke();
    c.restore();
    wave(c, 0.12, 0.66, 0.24);
    wave(c, 0.42, 0.56, 0.2);
  },
  // a deer's head with antlers
  deer(c) {
    c.beginPath(); c.ellipse(0, 0.18, 0.2, 0.36, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(-0.3, -0.04, 0.16, 0.08, -0.5, 0, Math.PI * 2); c.ellipse(0.3, -0.04, 0.16, 0.08, 0.5, 0, Math.PI * 2); c.fill();
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 0.1; c.strokeStyle = WHITE;
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(s * 0.1, -0.14); c.lineTo(s * 0.26, -0.44); c.lineTo(s * 0.3, -0.68);
      c.moveTo(s * 0.26, -0.44); c.lineTo(s * 0.5, -0.5); c.moveTo(s * 0.19, -0.3); c.lineTo(s * 0.04, -0.5); c.stroke();
    }
    c.restore();
  },
  // a bench under a leaf: sit a while
  bench(c) {
    c.fillRect(-0.62, -0.02, 1.24, 0.14);
    c.fillRect(-0.62, 0.22, 1.24, 0.12);
    c.fillRect(-0.52, 0.22, 0.12, 0.38); c.fillRect(0.4, 0.22, 0.12, 0.38);
    c.beginPath(); c.moveTo(-0.2, -0.2); c.quadraticCurveTo(-0.14, -0.66, 0.36, -0.62); c.quadraticCurveTo(0.34, -0.2, -0.2, -0.2); c.fill();
  },
};

function star(c, x, y, R, r) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, d = i % 2 ? r : R;
    c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  c.closePath(); c.fill();
}
function wave(c, y, w, h) {
  c.save(); c.lineWidth = 0.12; c.lineCap = 'round'; c.strokeStyle = WHITE;
  c.beginPath();
  c.moveTo(-w, y);
  c.quadraticCurveTo(-w / 2, y - h / 2, 0, y); c.quadraticCurveTo(w / 2, y + h / 2, w, y);
  c.stroke(); c.restore();
}

/* The colour of each kind: the game's accents, a touch deeper than the map's pastels. */
export const ICON = {
  konbini: { col: '#1f6fb8' },
  view: { col: '#e0773a' },
  car: { col: '#3c3f5c' },
  shops: { col: '#c0632e' },
  mega: { col: '#d99a12' },
  shrine: { col: '#c63d2f' },
  plaza: { col: '#d4608c' },
  station: { col: '#2f8a55' },
  crossing: { col: '#3a3440', ring: '#f2c53d' },
  pond: { col: '#3f8fae' },
  river: { col: '#4a7fbf' },
  deer: { col: '#8a7a3a' },
  bench: { col: '#7f9a4a' },
};

/** A place's pictogram at (x, y), radius r (canvas px). */
export function drawIcon(c, kind, x, y, r) {
  const I = ICON[kind] ?? ICON.shops;
  c.save();
  // a soft drop under the disc
  c.fillStyle = 'rgba(40,32,60,0.22)';
  c.beginPath(); c.arc(x + r * 0.08, y + r * 0.16, r * 1.04, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = I.col; c.fill();
  c.lineWidth = Math.max(1.2, r * 0.16); c.strokeStyle = I.ring ?? WHITE; c.stroke();
  c.translate(x, y);
  c.scale(r, r);
  c.fillStyle = WHITE;
  GLYPH[kind]?.(c, I.col);
  c.restore();
}

/** The experiences' diamond (the same soft yellow as their glow in town). */
export function drawGem(c, x, y, r) {
  c.save();
  c.fillStyle = 'rgba(40,32,60,0.2)';
  c.beginPath(); c.moveTo(x + 1, y - r + 2); c.lineTo(x + r * 0.7 + 1, y + 2); c.lineTo(x + 1, y + r + 2); c.lineTo(x - r * 0.7 + 1, y + 2); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.7, y); c.lineTo(x, y + r); c.lineTo(x - r * 0.7, y); c.closePath();
  c.fillStyle = '#ffd76a'; c.fill();
  c.lineWidth = Math.max(1, r * 0.2); c.strokeStyle = 'rgba(90,64,20,0.85)'; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.beginPath(); c.moveTo(x, y - r * 0.62); c.lineTo(x + r * 0.26, y - r * 0.1); c.lineTo(x, y); c.closePath(); c.fill();
  c.restore();
}
