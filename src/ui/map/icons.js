/* ------------------------------------------------------------------ *
 * The town map's pictograms (map 2.0): one family, drawn with Canvas2D
 * paths.  A coloured disc with a cream ring and a soft drop, a white glyph
 * on it.  Each glyph is SVG path data in units of a hundredth of the
 * disc's radius, in layers: `w` filled white, `k` filled in the disc's
 * colour (windows, a lens), `s` stroked white; so the same drawing reads
 * at the corner map's 9 px and the full map's 12 px.
 * ------------------------------------------------------------------ */

const WHITE = '#fffdf6';
/** A circle as path data. */
const O = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
/** A star as path data (points, outer and inner radius). */
const star = (x, y, R, r) => 'M' + Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5, d = i % 2 ? r : R;
  return `${(x + Math.cos(a) * d).toFixed(1)} ${(y + Math.sin(a) * d).toFixed(1)}`;
}).join('L') + 'z';

const GLYPH = {
  // a shop front: a flat roof, an awning's zigzag, a door and two windows
  konbini: [['w', 'M-58-52h116v20h-116zM-58-28h116v14l-14.5 10-14.5-10-14.5 10-14.5-10-14.5 10-14.5-10-14.5 10-14.5-10zM-50 8h100v46h-100z'], ['k', 'M-12 20h24v34h-24zM-40 20h18v16h-18zM22 20h18v16h-18z']],
  // a camera, its lens a ring
  view: [['w', 'M-62-30h124v82h-124zM-24-30l10-20h28l10 20z'], ['k', O(0, 12, 30)], ['w', O(0, 12, 17)]],
  // a low sports car in profile, the FD's long bonnet and fastback, its wheels
  car: [['w', 'M-70 8L-66-4Q-50-12-20-16Q-2-42 22-38Q50-30 70-8L72 8z'], ['k', 'M-8-18Q4-33 20-32L42-18z'], ['w', O(-40, 18, 20) + O(42, 18, 20)], ['k', O(-40, 18, 9) + O(42, 18, 9)]],
  // an arcade: a pitched canopy over two shop fronts
  shops: [['w', 'M-66-12L0-56 66-12zM-52-12h104v62h-104z'], ['k', 'M-40 4h30v46h-30zM10 4h30v20h-30z']],
  // a shopping bag with a star: the discount palace
  mega: [['w', 'M-50-24h100l8 80h-116z'], ['s', 'M-24-24a24 24 0 0 1 48 0'], ['k', star(0, 18, 27, 11)]],
  // a torii: two rails over two posts
  shrine: [['w', 'M-70-50Q0-38 70-50L66-34Q0-24-66-34zM-50-16h100v12h-100zM-40-30h14v86h-14zM26-30h14v86h-14z']],
  // a blossom: five petals round a heart
  plaza: [['w', [0, 1, 2, 3, 4].map((i) => O(Math.round(Math.sin(i * 1.2566) * 30), Math.round(-Math.cos(i * 1.2566) * 30), 21)).join('')], ['k', O(0, 0, 10)]],
  // a train's face: windscreen, lamps, the skirt
  station: [['w', 'M-46-60h92v100h-92zM-30 40l-20 22h16l18-22zM30 40l20 22h-16l-18-22z'], ['k', 'M-32-44h64v36h-64z' + O(-24, 16, 8) + O(24, 16, 8)]],
  // the crossbuck (踏切 sign) over its post and two lamps
  crossing: [['s', 'M-50-56L50-4M50-56L-50-4'], ['w', 'M-7-30h14v90h-14zM-30 26h60v8h-60z' + O(-30, 30, 14) + O(30, 30, 14)]],
  // still water: a lotus leaf and two ripples
  pond: [['w', 'M0-26L12-58A34 34 0 1 1-12-58z'], ['s', 'M-62 26Q-31 11 0 26T62 26M-44 52Q-22 41 0 52T44 52']],
  // a river under a bridge's arch
  river: [['s', 'M-66-20Q0-66 66-20M-66-42v30M66-42v30M-66 12Q-33 0 0 12T66 12M-56 42Q-28 32 0 42T56 42']],
  // a deer's head with antlers
  deer: [['w', 'M0-18c14 0 20 20 20 36s-6 36-20 36-20-18-20-36 6-36 20-36zM-18-8l-28-8-6 12 30 8zM18-8l28-8 6 12-30 8z'], ['s', 'M-10-14L-26-44-30-68M-26-44L-50-50M-19-30L-4-50M10-14L26-44 30-68M26-44L50-50M19-30L4-50']],
  // a bench under a leaf: sit a while
  bench: [['w', 'M-62-2h124v14h-124zM-62 22h124v12h-124zM-52 22h12v38h-12zM40 22h12v38h-12zM-20-20Q-14-66 36-62Q34-20-20-20z']],
};
const cache = {};

/* The colour of each kind: the game's accents, a touch deeper than the map's pastels. */
export const ICON = {
  konbini: '#1f6fb8', view: '#e0773a', car: '#3c3f5c', shops: '#c0632e', mega: '#d99a12', shrine: '#c63d2f',
  plaza: '#d4608c', station: '#2f8a55', crossing: '#3a3440', pond: '#3f8fae', river: '#4a7fbf', deer: '#8a7a3a', bench: '#7f9a4a',
};

/** A place's pictogram at (x, y), radius r (canvas px). */
export function drawIcon(c, kind, x, y, r) {
  const col = ICON[kind] ?? ICON.shops;
  c.save();
  c.translate(x, y); c.scale(r / 100, r / 100);
  // a soft drop, the disc, its ring (the level crossing's in its yellow)
  c.fillStyle = 'rgba(40,32,60,0.22)';
  c.beginPath(); c.arc(8, 16, 104, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(0, 0, 100, 0, Math.PI * 2);
  c.fillStyle = col; c.fill();
  c.lineWidth = 16; c.strokeStyle = kind === 'crossing' ? '#f2c53d' : WHITE; c.stroke();
  c.lineWidth = 12; c.lineCap = c.lineJoin = 'round'; c.strokeStyle = WHITE;
  for (const [t, d] of GLYPH[kind] ?? []) {
    const p = (cache[d] ??= new Path2D(d));
    if (t === 's') c.stroke(p); else { c.fillStyle = t === 'w' ? WHITE : col; c.fill(p); }
  }
  c.restore();
}

/** The experiences' diamond (the same soft yellow as their glow in town). */
export function drawGem(c, x, y, r) {
  const d = (dx, dy, s) => { c.beginPath(); c.moveTo(x + dx, y + dy - r * s); c.lineTo(x + dx + r * 0.7 * s, y + dy); c.lineTo(x + dx, y + dy + r * s); c.lineTo(x + dx - r * 0.7 * s, y + dy); c.closePath(); };
  c.save();
  c.fillStyle = 'rgba(40,32,60,0.2)'; d(1, 2, 1); c.fill();
  d(0, 0, 1); c.fillStyle = '#ffd76a'; c.fill();
  c.lineWidth = Math.max(1, r * 0.2); c.strokeStyle = 'rgba(90,64,20,0.85)'; c.stroke();
  c.restore();
}

/** The sound experiences' speaker (Tan, 2026-09-28): a small ink disc with a
 * cream rim, a white speaker and two sound waves; heard, not done. */
export function drawSpeaker(c, x, y, r) {
  c.save();
  c.translate(x, y);
  c.fillStyle = 'rgba(40,32,60,0.2)';
  c.beginPath(); c.arc(r * 0.12, r * 0.22, r, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2);
  c.fillStyle = '#5a4a86'; c.fill();
  c.lineWidth = Math.max(1, r * 0.18); c.strokeStyle = WHITE; c.stroke();
  const u = r / 10;
  c.fillStyle = WHITE;
  c.beginPath();
  c.moveTo(-5.6 * u, -2 * u); c.lineTo(-3.2 * u, -2 * u); c.lineTo(0.2 * u, -5 * u);
  c.lineTo(0.2 * u, 5 * u); c.lineTo(-3.2 * u, 2 * u); c.lineTo(-5.6 * u, 2 * u);
  c.closePath(); c.fill();
  c.strokeStyle = WHITE; c.lineCap = 'round'; c.lineWidth = Math.max(0.8, 1.3 * u);
  for (const k of [3.2, 5.8]) {
    c.beginPath(); c.arc(0.6 * u, 0, k * u, -0.8, 0.8); c.stroke();
  }
  c.restore();
}
