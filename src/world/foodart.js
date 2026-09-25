/* ------------------------------------------------------------------ *
 * Food, painted (M2e; M3 reuses it for packaging).
 *
 * Konbini windows are covered in food: glossy onigiri, a latte with its
 * foam, fried chicken, a sandwich cut to show its filling.  These are
 * anime food illustrations drawn with Canvas2D: a base shape, a shade
 * shape, highlights, and a warm ink outline.  Every item is generic: no
 * real product, package or brand.
 *
 * Each painter draws an item centred at (x, y), `s` pixels across.
 * ------------------------------------------------------------------ */

const INK = '#4a3230';

function outline(c, w = 3) {
  c.lineJoin = 'round';
  c.lineWidth = w;
  c.strokeStyle = INK;
  c.stroke();
}

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A rounded triangle path, point up. */
function tri(c, x, y, s) {
  const h = s * 0.9, r = s * 0.16;
  const p = [[x, y - h / 2], [x + s / 2, y + h / 2], [x - s / 2, y + h / 2]];
  c.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = p[i], b = p[(i + 1) % 3];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (i === 0) c.moveTo(mx, my);
    c.arcTo(b[0], b[1], (b[0] + p[(i + 2) % 3][0]) / 2, (b[1] + p[(i + 2) % 3][1]) / 2, r);
  }
  c.closePath();
}

/** Onigiri: white rice with grain, a nori band, a glint; `filling` peeks out. */
export function onigiri(c, x, y, s, { filling = '#e8795a', seed = 3 } = {}) {
  const r = seeded(seed);
  tri(c, x, y, s);
  c.fillStyle = '#fbfaf4'; c.fill();
  // shade on the lower right
  c.save(); c.clip();
  c.fillStyle = '#e4e0d6';
  c.beginPath(); c.ellipse(x + s * 0.3, y + s * 0.35, s * 0.45, s * 0.35, -0.5, 0, Math.PI * 2); c.fill();
  // grains
  for (let i = 0; i < 70; i++) {
    const gx = x + (r() - 0.5) * s, gy = y + (r() - 0.5) * s * 0.9;
    c.fillStyle = r() < 0.5 ? 'rgba(200,194,180,0.7)' : 'rgba(255,255,255,0.9)';
    c.beginPath(); c.ellipse(gx, gy, s * 0.028, s * 0.016, r() * 3, 0, Math.PI * 2); c.fill();
  }
  // the filling showing at the top of a bitten corner
  c.fillStyle = filling;
  c.beginPath(); c.ellipse(x, y - s * 0.02, s * 0.12, s * 0.08, 0, 0, Math.PI * 2); c.fill();
  // nori band
  c.fillStyle = '#2d3b36';
  c.fillRect(x - s * 0.2, y + s * 0.12, s * 0.4, s * 0.4);
  c.fillStyle = '#3f5049';
  c.fillRect(x - s * 0.2, y + s * 0.12, s * 0.12, s * 0.4);
  c.restore();
  tri(c, x, y, s); outline(c, Math.max(2, s * 0.02));
  // glint
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.beginPath(); c.ellipse(x - s * 0.14, y - s * 0.2, s * 0.05, s * 0.025, -0.9, 0, Math.PI * 2); c.fill();
}

/** A hot latte in a paper cup: lid, sleeve, and a curl of steam. */
export function latte(c, x, y, s, { sleeve = '#8a5a3c' } = {}) {
  const w0 = s * 0.46, w1 = s * 0.34, h = s * 0.62, top = y - h / 2;
  c.beginPath();
  c.moveTo(x - w0 / 2, top); c.lineTo(x + w0 / 2, top);
  c.lineTo(x + w1 / 2, top + h); c.lineTo(x - w1 / 2, top + h); c.closePath();
  c.fillStyle = '#fbf8f2'; c.fill();
  c.save(); c.clip();
  c.fillStyle = '#e6e0d6'; c.fillRect(x + w1 * 0.15, top, w0, h);
  c.fillStyle = sleeve; c.fillRect(x - w0, top + h * 0.34, w0 * 2, h * 0.32);
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x - w0, top + h * 0.34, w0 * 0.5, h * 0.32);
  c.restore();
  c.beginPath();
  c.moveTo(x - w0 / 2, top); c.lineTo(x + w0 / 2, top);
  c.lineTo(x + w1 / 2, top + h); c.lineTo(x - w1 / 2, top + h); c.closePath();
  outline(c, Math.max(2, s * 0.018));
  // the lid
  c.beginPath(); c.roundRect(x - w0 * 0.56, top - s * 0.07, w0 * 1.12, s * 0.08, s * 0.03);
  c.fillStyle = '#f4f1ea'; c.fill(); outline(c, Math.max(2, s * 0.016));
  // steam
  c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = s * 0.035; c.lineCap = 'round';
  for (const dx of [-0.08, 0.08]) {
    c.beginPath();
    c.moveTo(x + dx * s, top - s * 0.1);
    c.bezierCurveTo(x + (dx - 0.08) * s, top - s * 0.2, x + (dx + 0.08) * s, top - s * 0.28, x + dx * s, top - s * 0.38);
    c.stroke();
  }
}

/** Fried chicken: a few craggy golden pieces in a paper boat. */
export function karaage(c, x, y, s, { seed = 5 } = {}) {
  const r = seeded(seed);
  // the boat
  c.beginPath();
  c.moveTo(x - s * 0.45, y); c.lineTo(x + s * 0.45, y);
  c.lineTo(x + s * 0.36, y + s * 0.28); c.lineTo(x - s * 0.36, y + s * 0.28); c.closePath();
  c.fillStyle = '#f2e6c8'; c.fill(); outline(c, Math.max(2, s * 0.016));
  const pieces = [[-0.2, -0.05, 0.26], [0.12, -0.08, 0.28], [-0.02, -0.22, 0.24], [0.26, -0.18, 0.2]];
  for (const [dx, dy, rr] of pieces) {
    const cx = x + dx * s, cy = y + dy * s, R = rr * s / 2;
    c.beginPath();
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, k = 0.82 + r() * 0.22;
      c.lineTo(cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k * 0.85);
    }
    c.closePath();
    c.fillStyle = '#d58a3a'; c.fill();
    c.save(); c.clip();
    c.fillStyle = '#b8682a';
    c.beginPath(); c.ellipse(cx + R * 0.35, cy + R * 0.4, R * 0.8, R * 0.6, 0, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 9; i++) {
      c.fillStyle = r() < 0.5 ? '#f0b458' : '#9c5424';
      c.beginPath(); c.ellipse(cx + (r() - 0.5) * R * 1.6, cy + (r() - 0.5) * R * 1.4, R * 0.14, R * 0.09, r() * 3, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      c.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.8);
    }
    outline(c, Math.max(1.5, s * 0.012));
    c.fillStyle = 'rgba(255,240,200,0.9)';
    c.beginPath(); c.ellipse(cx - R * 0.35, cy - R * 0.35, R * 0.18, R * 0.09, -0.6, 0, Math.PI * 2); c.fill();
  }
}

/** A sandwich half, cut side out: bread, egg, lettuce, ham. */
export function sandwich(c, x, y, s) {
  const w = s * 0.8, h = s * 0.6;
  const path = () => { c.beginPath(); c.moveTo(x - w / 2, y + h / 2); c.lineTo(x + w / 2, y + h / 2); c.lineTo(x, y - h / 2); c.closePath(); };
  path(); c.fillStyle = '#f7ecd2'; c.fill();
  c.save(); path(); c.clip();
  const layers = [['#f6d85a', 0.1], ['#8cc063', 0.26], ['#f2a6a0', 0.42], ['#f6d85a', 0.58]];
  for (const [col, t] of layers) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x - w, y - h / 2 + h * t);
    for (let i = 0; i <= 10; i++) c.lineTo(x - w / 2 + (i / 10) * w, y - h / 2 + h * t + (i % 2 ? 4 : -4) * s / 200);
    c.lineTo(x + w, y - h / 2 + h * (t + 0.12));
    c.lineTo(x - w, y - h / 2 + h * (t + 0.12));
    c.fill();
  }
  c.restore();
  path(); outline(c, Math.max(2, s * 0.018));
  // crust
  c.strokeStyle = '#d7a868'; c.lineWidth = s * 0.03;
  c.beginPath(); c.moveTo(x - w / 2 + s * 0.02, y + h / 2 - s * 0.015); c.lineTo(x + w / 2 - s * 0.02, y + h / 2 - s * 0.015); c.stroke();
}

/** A bento seen from above: rice with an umeboshi, fried things, greens. */
export function bento(c, x, y, s) {
  const w = s * 0.9, h = s * 0.62;
  c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, s * 0.06);
  c.fillStyle = '#2b2b33'; c.fill(); outline(c, Math.max(2, s * 0.016));
  // rice half
  c.fillStyle = '#fbfaf4';
  c.beginPath(); c.roundRect(x - w / 2 + s * 0.04, y - h / 2 + s * 0.04, w * 0.46, h - s * 0.08, s * 0.03); c.fill();
  c.fillStyle = '#d8384a';
  c.beginPath(); c.arc(x - w * 0.27, y, s * 0.05, 0, Math.PI * 2); c.fill();
  // mains
  c.fillStyle = '#d58a3a';
  c.beginPath(); c.ellipse(x + w * 0.12, y - h * 0.12, s * 0.12, s * 0.08, 0.3, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f2c94a';
  c.beginPath(); c.roundRect(x + w * 0.08, y + h * 0.08, s * 0.14, s * 0.1, s * 0.02); c.fill();
  c.fillStyle = '#6fae52';
  c.beginPath(); c.ellipse(x + w * 0.33, y + h * 0.12, s * 0.07, s * 0.06, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#e46a4a';
  c.beginPath(); c.ellipse(x + w * 0.33, y - h * 0.17, s * 0.06, s * 0.04, 0.4, 0, Math.PI * 2); c.fill();
}

/** A steamed bun (nikuman), soft white with a twisted top. */
export function nikuman(c, x, y, s) {
  c.beginPath();
  c.ellipse(x, y, s * 0.4, s * 0.3, 0, 0, Math.PI * 2);
  c.fillStyle = '#fbf7ee'; c.fill();
  c.save(); c.clip();
  c.fillStyle = '#e9e2d4';
  c.beginPath(); c.ellipse(x + s * 0.12, y + s * 0.14, s * 0.4, s * 0.25, 0, 0, Math.PI * 2); c.fill();
  c.restore();
  c.beginPath(); c.ellipse(x, y, s * 0.4, s * 0.3, 0, 0, Math.PI * 2); outline(c, Math.max(2, s * 0.016));
  c.strokeStyle = 'rgba(160,140,120,0.7)'; c.lineWidth = s * 0.012;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.28;
    c.beginPath(); c.moveTo(x, y - s * 0.22);
    c.quadraticCurveTo(x + Math.cos(a) * s * 0.12, y - s * 0.2 + Math.sin(a) * s * 0.05, x + Math.cos(a) * s * 0.2, y - s * 0.1);
    c.stroke();
  }
}

export const FOOD = { onigiri, latte, karaage, sandwich, bento, nikuman };
