/* ------------------------------------------------------------------ *
 * Canvas2D character art for the Pokémon train (AGENTS.md: drawn in
 * code, no downloaded images).  Pure functions on a 2D context: Pikachu
 * in a few poses, Poké Balls, lightning bolts, and silhouettes.  Tan
 * allows the real likeness (2026-09-29); everything here is our own
 * vector drawing of it.
 *
 * Every figure is drawn about (x, y) with `s` its height, feet at y,
 * facing the viewer (turned a little to `dir`: +1 faces right).
 * ------------------------------------------------------------------ */

export const PIKA = {
  // the yellow is brighter than the car's, so a figure stands off the body
  yellow: '#ffe14a', yellowLo: '#f2c22e', cheek: '#e8402a', brown: '#8a4a1c', ink: '#2a1a0e',
  eye: '#1c1410', white: '#ffffff', mouth: '#7a2a1a', tongue: '#e0605a',
};

/** A closed smooth blob through control points [[x, y], ...] (quadratic through midpoints). */
function blob(c, pts) {
  const n = pts.length;
  c.beginPath();
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let m = mid(pts[n - 1], pts[0]);
  c.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    m = mid(p, q);
    c.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  c.closePath();
}
function fillStroke(c, fill, stroke, lw) {
  c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); }
}

/**
 * Pikachu.  pose: 'wave' (standing, one arm up), 'stand' (arms down),
 * 'sit' (sitting, arms forward), 'cheer' (both arms up), 'peek' (head and
 * shoulders only).  `silhouette` fills the whole figure in one colour.
 */
export function pikachu(c, x, y, s, { pose = 'wave', dir = 1, silhouette = null, outline = true } = {}) {
  c.save();
  c.translate(x, y);
  c.scale(dir * s / 1.5, s / 1.5);
  const K = PIKA;
  const lw = 0.03;
  const ink = silhouette ?? K.ink;
  const Y = silhouette ?? K.yellow, B = silhouette ?? K.brown, W = silhouette ?? K.white, R = silhouette ?? K.cheek;
  const st = outline && !silhouette ? K.ink : silhouette;
  const sit = pose === 'sit', peek = pose === 'peek';
  // the head sits higher when standing; the body squashes when sitting
  const hy = peek ? -0.52 : sit ? -0.56 : -0.62;       // head centre
  const by = sit ? -0.24 : -0.27;                        // body centre

  /* ---- the tail: a lightning bolt off the back, brown at the root ---- */
  if (!peek) {
    c.save();
    c.translate(-0.2, by + 0.04); c.scale(0.68, 0.68);
    const tx = 0, ty = 0;
    // the stem zigzags up and back; the head is a broad wedge cut square
    const stem = () => {
      c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx - 0.15, ty - 0.15); c.lineTo(tx - 0.06, ty - 0.25);
      c.lineTo(tx - 0.27, ty - 0.45); c.lineTo(tx - 0.17, ty - 0.53); c.lineTo(tx - 0.34, ty - 0.7);
    };
    const head = () => {
      c.beginPath(); c.moveTo(tx - 0.2, ty - 0.6); c.lineTo(tx - 0.5, ty - 0.92); c.lineTo(tx - 0.66, ty - 0.78); c.lineTo(tx - 0.34, ty - 0.48); c.closePath();
    };
    c.lineJoin = 'miter'; c.lineCap = 'butt';
    const sw = 0.085, olw = lw * 2 / 0.68;
    if (st) {
      c.strokeStyle = st; c.lineWidth = sw + olw; stem(); c.stroke();
      head(); c.fillStyle = st; c.fill(); c.lineWidth = olw; c.stroke();
    }
    c.strokeStyle = Y; c.lineWidth = sw; stem(); c.stroke();
    head(); c.fillStyle = Y; c.fill();
    if (!silhouette) {
      c.fillStyle = B;
      c.beginPath(); c.ellipse(tx - 0.05, ty - 0.07, 0.1, 0.075, -0.75, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  /* ---- the ears: long, leaning out, black tips ---- */
  const ear = (side, lean) => {
    const bx = side * 0.18, byy = hy - 0.2;
    const tipx = side * (0.4 + lean), tipy = hy - 0.86;
    c.beginPath();
    c.moveTo(bx - side * 0.12, byy + 0.03);
    c.quadraticCurveTo(side * 0.17 + side * lean * 0.3, hy - 0.52, tipx, tipy);
    c.quadraticCurveTo(side * 0.36 + side * lean * 0.6, hy - 0.5, bx + side * 0.13, byy + 0.08);
    c.closePath();
    fillStroke(c, Y, st, lw);
    if (!silhouette) {
      c.save(); c.clip();
      c.fillStyle = ink;
      c.beginPath(); c.ellipse(tipx - side * 0.03, tipy + 0.12, 0.14, 0.22, side * 0.45, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  };
  ear(-1, 0.02); ear(1, 0.06);

  /* ---- the body: a pear, with the two brown stripes on the back edge ---- */
  if (!peek) {
    const bw = sit ? 0.3 : 0.26, bh = sit ? 0.27 : 0.32;
    blob(c, [[0, by - bh], [bw * 0.8, by - bh * 0.6], [bw, by + bh * 0.3], [bw * 0.7, by + bh], [-bw * 0.7, by + bh], [-bw, by + bh * 0.3], [-bw * 0.8, by - bh * 0.6]]);
    fillStroke(c, Y, st, lw);
    if (!silhouette) {
      c.save(); c.clip();
      c.fillStyle = B;
      for (const k of [0, 1]) { c.beginPath(); c.ellipse(-bw + 0.02, by - 0.02 + k * 0.14, 0.09, 0.035, 0.3, 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
    // feet
    for (const side of [-1, 1]) {
      c.beginPath(); c.ellipse(side * (sit ? 0.2 : 0.14), sit ? -0.03 : -0.02, sit ? 0.12 : 0.1, 0.05, 0, 0, Math.PI * 2);
      fillStroke(c, Y, st, lw);
    }
    // arms
    const arm = (side, up) => {
      c.beginPath();
      if (up) {
        c.moveTo(side * (bw - 0.06), by - 0.14);
        c.quadraticCurveTo(side * (bw + 0.16), by - 0.16, side * (bw + 0.12), by - 0.42);
        c.quadraticCurveTo(side * (bw + 0.02), by - 0.36, side * (bw - 0.1), by - 0.2);
      } else if (sit) {
        c.moveTo(side * (bw - 0.1), by);
        c.quadraticCurveTo(side * (bw + 0.02), by + 0.14, side * (bw - 0.06), by + 0.2);
        c.quadraticCurveTo(side * (bw - 0.16), by + 0.14, side * (bw - 0.16), by + 0.02);
      } else {
        c.moveTo(side * (bw - 0.06), by - 0.08);
        c.quadraticCurveTo(side * (bw + 0.1), by + 0.02, side * (bw + 0.04), by + 0.16);
        c.quadraticCurveTo(side * (bw - 0.08), by + 0.1, side * (bw - 0.12), by);
      }
      c.closePath();
      fillStroke(c, Y, st, lw);
    };
    arm(-1, pose === 'cheer');
    arm(1, pose === 'wave' || pose === 'cheer');
  }

  /* ---- the head: wide, a little flat, the cheeks out at the sides ---- */
  blob(c, [[0, hy - 0.27], [0.24, hy - 0.22], [0.33, hy - 0.02], [0.24, hy + 0.2], [0, hy + 0.26], [-0.24, hy + 0.2], [-0.33, hy - 0.02], [-0.24, hy - 0.22]]);
  fillStroke(c, Y, st, lw);
  if (silhouette) { c.restore(); return; }

  /* ---- the face ---- */
  // cheeks
  for (const side of [-1, 1]) {
    c.beginPath(); c.arc(side * 0.245, hy + 0.06, 0.075, 0, Math.PI * 2);
    fillStroke(c, R, st, lw * 0.8);
  }
  // eyes, with the highlight
  for (const side of [-1, 1]) {
    c.fillStyle = K.eye;
    c.beginPath(); c.ellipse(side * 0.115, hy - 0.04, 0.055, 0.062, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = W;
    c.beginPath(); c.arc(side * 0.115 - 0.016, hy - 0.06, 0.02, 0, Math.PI * 2); c.fill();
  }
  // the nose
  c.fillStyle = K.eye;
  c.beginPath(); c.ellipse(0, hy + 0.035, 0.014, 0.01, 0, 0, Math.PI * 2); c.fill();
  // the mouth: a wide open smile with the little "w" top
  c.beginPath();
  c.moveTo(-0.1, hy + 0.08);
  c.quadraticCurveTo(-0.05, hy + 0.12, 0, hy + 0.085);
  c.quadraticCurveTo(0.05, hy + 0.12, 0.1, hy + 0.08);
  c.quadraticCurveTo(0.06, hy + 0.2, 0, hy + 0.2);
  c.quadraticCurveTo(-0.06, hy + 0.2, -0.1, hy + 0.08);
  c.closePath();
  c.fillStyle = K.mouth; c.fill();
  c.save(); c.clip();
  c.fillStyle = K.tongue; c.beginPath(); c.ellipse(0, hy + 0.2, 0.06, 0.04, 0, 0, Math.PI * 2); c.fill();
  c.restore();
  c.strokeStyle = K.ink; c.lineWidth = lw * 0.8; c.stroke();
  c.restore();
}

/** A Poké Ball, radius r. */
export function pokeball(c, x, y, r, { top = '#e8362a', ink = '#1e1a1a', silhouette = null } = {}) {
  c.save();
  c.translate(x, y);
  if (silhouette) {
    c.fillStyle = silhouette;
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.globalCompositeOperation = 'destination-out';
    c.fillRect(-r, -r * 0.09, r * 2, r * 0.18);
    c.beginPath(); c.arc(0, 0, r * 0.3, 0, Math.PI * 2); c.fill();
    c.globalCompositeOperation = 'source-over';
    c.beginPath(); c.arc(0, 0, r * 0.16, 0, Math.PI * 2); c.fill();
    c.restore();
    return;
  }
  c.fillStyle = top; c.beginPath(); c.arc(0, 0, r, Math.PI, 0); c.fill();
  c.fillStyle = '#f6f4ee'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI); c.fill();
  c.fillStyle = ink; c.fillRect(-r, -r * 0.09, r * 2, r * 0.18);
  c.beginPath(); c.arc(0, 0, r * 0.3, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f6f4ee'; c.beginPath(); c.arc(0, 0, r * 0.19, 0, Math.PI * 2); c.fill();
  c.strokeStyle = ink; c.lineWidth = r * 0.09;
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.arc(0, 0, r * 0.19, 0, Math.PI * 2); c.stroke();
  // a glint
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(-r * 0.4, -r * 0.5, r * 0.18, r * 0.1, -0.7, 0, Math.PI * 2); c.fill();
  c.restore();
}

/** A lightning bolt, height h, pointing down, in `color`. */
export function bolt(c, x, y, h, color, rot = 0) {
  c.save();
  c.translate(x, y); c.rotate(rot); c.scale(h, h);
  c.beginPath();
  c.moveTo(0.05, -0.5); c.lineTo(-0.22, 0.06); c.lineTo(-0.02, 0.06); c.lineTo(-0.1, 0.5);
  c.lineTo(0.22, -0.1); c.lineTo(0.02, -0.1); c.closePath();
  c.fillStyle = color; c.fill();
  c.restore();
}

/** A round paw print (Pikachu's), radius r. */
export function pawprint(c, x, y, r, color) {
  c.fillStyle = color;
  c.beginPath(); c.ellipse(x, y + r * 0.25, r * 0.7, r * 0.55, 0, 0, Math.PI * 2); c.fill();
  for (const [dx, dy] of [[-0.62, -0.35], [-0.2, -0.65], [0.25, -0.65], [0.65, -0.35]]) {
    c.beginPath(); c.arc(x + dx * r, y + dy * r, r * 0.22, 0, Math.PI * 2); c.fill();
  }
}

/** A soft cloud / panel shape, w wide and h tall about (x, y): the pastel plate behind a figure. */
export function cloud(c, x, y, w, h, color) {
  c.save();
  c.translate(x, y);
  c.fillStyle = color;
  const lobes = [[-0.32, -0.12, 0.26], [0, -0.26, 0.3], [0.32, -0.12, 0.26], [-0.2, 0.22, 0.28], [0.2, 0.22, 0.28], [-0.42, 0.14, 0.2], [0.42, 0.14, 0.2]];
  for (const [lx, ly, r] of lobes) { c.beginPath(); c.ellipse(lx * w, ly * h, r * w * 0.7, r * h, 0, 0, Math.PI * 2); c.fill(); }
  c.beginPath(); c.roundRect(-w * 0.44, -h * 0.28, w * 0.88, h * 0.68, h * 0.12); c.fill();
  c.restore();
}

/**
 * Eevee: the brown fox with the cream ruff and the cream-tipped bushy tail,
 * big ears, big dark eyes.  Height s, feet at y, facing `dir`.
 */
export function eevee(c, x, y, s, { dir = 1 } = {}) {
  c.save(); c.translate(x, y); c.scale(dir * s, s);
  const BR = '#b0703a', CR = '#f4e6c6', INK = '#3a2214', lw = 0.02;
  const fs = (fill) => { c.fillStyle = fill; c.fill(); c.strokeStyle = INK; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); };
  // the tail: a big bushy sweep behind, cream at the tip
  const tail = [[-0.2, -0.4], [-0.36, -0.62], [-0.6, -0.72], [-0.7, -0.5], [-0.54, -0.26], [-0.3, -0.18]];
  blob(c, tail); fs(BR);
  c.save(); blob(c, tail); c.clip();
  c.fillStyle = CR; c.beginPath(); c.ellipse(-0.62, -0.62, 0.16, 0.2, 0.6, 0, Math.PI * 2); c.fill(); c.restore();
  // the body and legs
  blob(c, [[-0.3, -0.2], [-0.3, -0.5], [0.05, -0.56], [0.28, -0.4], [0.3, -0.12], [0.1, -0.02], [-0.2, -0.02]]); fs(BR);
  for (const lx of [-0.2, -0.05, 0.12, 0.26]) { c.beginPath(); c.roundRect(lx - 0.06, -0.2, 0.12, 0.2, 0.04); fs(BR); }
  // the ruff
  blob(c, [[-0.05, -0.5], [0.22, -0.62], [0.4, -0.5], [0.36, -0.3], [0.14, -0.22], [-0.08, -0.32]]); fs(CR);
  // the ears, long and pointed, dark inside
  for (const [ex, lean] of [[0.12, -0.1], [0.34, 0.1]]) {
    c.beginPath(); c.moveTo(ex - 0.1, -0.7); c.quadraticCurveTo(ex + lean - 0.02, -0.95, ex + lean + 0.02, -1.08); c.quadraticCurveTo(ex + lean + 0.12, -0.9, ex + 0.14, -0.7); c.closePath(); fs(BR);
    c.fillStyle = '#6b3d22'; c.beginPath(); c.moveTo(ex - 0.03, -0.74); c.lineTo(ex + lean + 0.01, -1.0); c.lineTo(ex + 0.08, -0.74); c.closePath(); c.fill();
  }
  // the head, the tuft, the face
  blob(c, [[0.02, -0.74], [0.28, -0.86], [0.52, -0.72], [0.56, -0.48], [0.36, -0.36], [0.08, -0.44]]); fs(BR);
  blob(c, [[0.14, -0.84], [0.24, -0.94], [0.36, -0.88], [0.3, -0.8]]); fs(BR);
  for (const ex of [0.24, 0.42]) {
    c.fillStyle = INK; c.beginPath(); c.ellipse(ex, -0.6, 0.05, 0.065, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(ex - 0.015, -0.625, 0.018, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = INK; c.beginPath(); c.ellipse(0.5, -0.5, 0.02, 0.014, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = INK; c.lineWidth = lw; c.beginPath(); c.moveTo(0.44, -0.46); c.quadraticCurveTo(0.47, -0.42, 0.5, -0.45); c.stroke();
  c.restore();
}

/**
 * Piplup: the little blue penguin, dark blue head and cape, white face and
 * bib with its two spots, yellow beak and feet.  Height s, feet at y.
 */
export function piplup(c, x, y, s, { dir = 1 } = {}) {
  c.save(); c.translate(x, y); c.scale(dir * s, s);
  const LB = '#7ec8f0', DB = '#2e5fa8', W = '#f6f8ff', YL = '#f6c83a', INK = '#1e2a4a', lw = 0.02;
  const fs = (fill) => { c.fillStyle = fill; c.fill(); c.strokeStyle = INK; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); };
  // feet
  for (const fx of [-0.14, 0.14]) { c.beginPath(); c.ellipse(fx, -0.02, 0.12, 0.05, 0, 0, Math.PI * 2); fs(YL); }
  // the body
  blob(c, [[0, -0.62], [0.3, -0.5], [0.34, -0.2], [0.2, -0.02], [-0.2, -0.02], [-0.34, -0.2], [-0.3, -0.5]]); fs(LB);
  // the flippers
  for (const side of [-1, 1]) { blob(c, [[side * 0.28, -0.5], [side * 0.46, -0.36], [side * 0.4, -0.16], [side * 0.28, -0.24]]); fs(DB); }
  // the bib: white with two round spots
  blob(c, [[0, -0.5], [0.2, -0.42], [0.22, -0.18], [0, -0.08], [-0.22, -0.18], [-0.2, -0.42]]); c.fillStyle = W; c.fill();
  c.strokeStyle = INK; c.lineWidth = lw * 0.8;
  for (const side of [-1, 1]) { c.beginPath(); c.arc(side * 0.1, -0.36, 0.06, 0, Math.PI * 2); c.stroke(); }
  // the head: dark blue cap, white face
  blob(c, [[0, -1.0], [0.3, -0.92], [0.4, -0.7], [0.3, -0.52], [0, -0.48], [-0.3, -0.52], [-0.4, -0.7], [-0.3, -0.92]]); fs(DB);
  // the two little crest tufts
  for (const side of [-1, 1]) { c.beginPath(); c.moveTo(side * 0.16, -0.98); c.lineTo(side * 0.24, -1.1); c.lineTo(side * 0.3, -0.94); c.closePath(); fs(DB); }
  // the beak, the eyes
  c.beginPath(); c.moveTo(-0.1, -0.66); c.lineTo(0.1, -0.66); c.lineTo(0, -0.54); c.closePath(); fs(YL);
  for (const side of [-1, 1]) {
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(side * 0.17, -0.72, 0.075, 0.085, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = INK; c.beginPath(); c.ellipse(side * 0.16, -0.71, 0.048, 0.062, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(side * 0.16 - 0.014, -0.735, 0.018, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

/**
 * Bulbasaur: the teal seed Pokémon with the darker patches, the green bulb
 * on its back, red eyes.  Height s (to the bulb's top), feet at y.
 */
export function bulbasaur(c, x, y, s, { dir = 1 } = {}) {
  c.save(); c.translate(x, y); c.scale(dir * s, s);
  const TL = '#78c8b0', DK = '#3f8f78', GR = '#5aa85a', INK = '#1e3a30', lw = 0.02;
  const fs = (fill) => { c.fillStyle = fill; c.fill(); c.strokeStyle = INK; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); };
  // the bulb, leaves out at the sides
  for (const side of [-1, 1]) { blob(c, [[-0.25, -0.62], [-0.25 + side * 0.34, -0.72], [-0.25 + side * 0.4, -0.58], [-0.25 + side * 0.2, -0.52]]); fs(GR); }
  blob(c, [[-0.25, -1.0], [-0.02, -0.9], [0.06, -0.66], [-0.25, -0.56], [-0.56, -0.66], [-0.48, -0.9]]); fs(GR);
  c.strokeStyle = INK; c.lineWidth = lw; c.beginPath(); c.moveTo(-0.25, -0.98); c.lineTo(-0.25, -0.62); c.stroke();
  // the body, the legs
  blob(c, [[-0.5, -0.5], [-0.2, -0.6], [0.2, -0.56], [0.36, -0.36], [0.3, -0.12], [-0.4, -0.12], [-0.54, -0.3]]); fs(TL);
  for (const lx of [-0.42, -0.2, 0.06, 0.26]) { c.beginPath(); c.roundRect(lx - 0.08, -0.16, 0.16, 0.16, 0.04); fs(TL); }
  // the head, ears
  for (const ex of [0.22, 0.46]) { c.beginPath(); c.moveTo(ex - 0.1, -0.62); c.lineTo(ex, -0.82); c.lineTo(ex + 0.1, -0.6); c.closePath(); fs(TL); }
  blob(c, [[0.14, -0.64], [0.4, -0.68], [0.6, -0.5], [0.58, -0.28], [0.36, -0.16], [0.12, -0.3]]); fs(TL);
  // the patches
  c.fillStyle = DK;
  for (const [px, py, r] of [[-0.3, -0.42, 0.06], [0.0, -0.36, 0.05], [0.3, -0.62, 0.035], [-0.1, -0.2, 0.04]]) { c.beginPath(); c.ellipse(px, py, r * 1.2, r, 0.4, 0, Math.PI * 2); c.fill(); }
  // the red eyes, the mouth
  for (const ex of [0.3, 0.5]) {
    c.fillStyle = '#d83a3a'; c.beginPath(); c.ellipse(ex, -0.48, 0.05, 0.06, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = INK; c.beginPath(); c.ellipse(ex, -0.48, 0.025, 0.045, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(ex - 0.012, -0.5, 0.014, 0, Math.PI * 2); c.fill();
  }
  c.strokeStyle = INK; c.lineWidth = lw; c.beginPath(); c.moveTo(0.3, -0.3); c.quadraticCurveTo(0.44, -0.22, 0.58, -0.32); c.stroke();
  c.restore();
}
