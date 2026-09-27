import * as THREE from 'three';
import { boxG, cylG, ext, latheG, taperTube, tubeG, xf } from './geo.js';
import { shideG, shimenawaSpan } from './torii.js';
import { emaCell, EMA_CELLS } from './tex.js';
import { rngKit } from '../../../core/util.js';

/* ------------------------------------------------------------------ *
 * The shrine's furniture, in its frame (x across, z back, y up), into
 * `parts` (one mesh per material in the end).  Each takes a placement
 * { x, z, ry } and builds facing +z before turning.
 * ------------------------------------------------------------------ */

/** An adder that places local geometry at { x, y, z, ry }. */
const at = (parts, o) => ({ add: (name, g) => parts.add(name, xf(g, { x: o.x, y: o.y ?? 0, z: o.z, ry: o.ry ?? 0 })) });

/* --------------------------------------------------------------- kitsune
 * A seated stone fox (狐) on a two-tier pedestal, smooth-carved: haunches
 * tucked, a slim upright chest, a long neck, the narrow pointed muzzle,
 * tall ears, and the big brush of a tail swept up behind like a flame.
 * Red bib (前掛け), red-painted eyes.  `holds`: 'key' (鍵) or 'jewel' (宝珠).
 * The stone is smooth-shaded ('foxStone', 'bibCloth'); the pedestal is cut. */
export function fox(parts, o, holds) {
  const P = at(parts, o);
  // the pedestal: base, dado, cap
  P.add('stoneDark', boxG(0.78, 0.22, 0.78, { y: 0.11 }));
  P.add('stone', boxG(0.58, 0.62, 0.58, { y: 0.53 }));
  P.add('stone', boxG(0.7, 0.1, 0.7, { y: 0.89 }));
  P.add('stoneDark', boxG(0.62, 0.05, 0.62, { y: 0.965 }));
  const y0 = 0.99;
  const F = (g, t) => P.add('foxStone', xf(g, { ...t, y: (t.y ?? 0) + y0 }));
  // the base it sits on, carved with the fox
  F(latheG([[0.001, 0], [0.2, 0], [0.21, 0.03], [0.19, 0.05], [0.001, 0.05]], 28), { sx: 1.0, sz: 1.2 });
  // haunches, tucked under and to the sides
  for (const s of [-1, 1]) F(new THREE.SphereGeometry(0.1, 20, 14), { x: s * 0.075, y: 0.13, z: -0.05, sx: 0.8, sy: 0.9, sz: 1.35 });
  // the body: one smooth rise from the haunches through a slim chest to a long neck
  F(latheG([
    [0.001, 0.0], [0.12, 0.03], [0.14, 0.1], [0.125, 0.18], [0.1, 0.26], [0.08, 0.33],
    [0.062, 0.4], [0.05, 0.47], [0.045, 0.53], [0.05, 0.58], [0.001, 0.61],
  ], 24), { y: 0.03, z: 0.0, sx: 0.95, sz: 0.85, rx: 0.13 });
  // the chest pushed forward, a soft keel under the neck
  F(new THREE.SphereGeometry(0.068, 20, 14), { y: 0.3, z: 0.06, sx: 0.9, sy: 1.6, sz: 0.75 });
  // the head: a small skull, the narrow muzzle, tall ears laid a little back
  const hy = 0.66, hz = 0.1;
  F(new THREE.SphereGeometry(0.066, 22, 16), { y: hy, z: hz, sx: 0.92, sy: 0.82, sz: 1.08 });
  for (const s of [-1, 1]) F(new THREE.SphereGeometry(0.03, 12, 9), { x: s * 0.038, y: hy - 0.02, z: hz + 0.02 });   // cheeks
  const muzzle = latheG([[0.001, 0], [0.045, 0.015], [0.042, 0.05], [0.032, 0.1], [0.02, 0.15], [0.009, 0.185], [0.001, 0.2]], 18);
  F(muzzle, { y: hy - 0.015, z: hz + 0.03, rx: Math.PI / 2 + 0.18, sx: 0.8 });
  for (const s of [-1, 1]) {
    const ear = latheG([[0.001, 0], [0.03, 0.005], [0.028, 0.05], [0.018, 0.11], [0.006, 0.155], [0.001, 0.17]], 12);
    F(ear, { x: s * 0.036, y: hy + 0.035, z: hz - 0.01, rz: -s * 0.2, rx: -0.2, sz: 0.55 });
    // the eyes, painted red and slanted up toward the ears
    P.add('bib', boxG(0.03, 0.008, 0.006, { x: s * 0.034, y: y0 + hy + 0.012, z: hz + 0.062, rz: s * 0.4, ry: s * 0.55 }));
    // slim forelegs straight down, paws together
    F(latheG([[0.001, 0], [0.022, 0.01], [0.02, 0.1], [0.022, 0.2], [0.026, 0.3], [0.02, 0.34], [0.001, 0.35]], 14), { x: s * 0.042, y: 0.03, z: 0.1 });
    F(new THREE.SphereGeometry(0.03, 14, 10), { x: s * 0.044, y: 0.045, z: 0.12, sy: 0.55, sz: 1.35 });
    // hind feet, flat to the base beside the haunches
    F(new THREE.SphereGeometry(0.05, 14, 10), { x: s * 0.13, y: 0.06, z: 0.03, sy: 0.5, sz: 1.6 });
  }
  // the tail: from under the haunches, up the back and higher than the head,
  // fat and bushy, drawn out into a flame-like tip that flicks forward
  const tail = [[0.04, 0.08, -0.14], [0.12, 0.17, -0.24], [0.155, 0.32, -0.29], [0.14, 0.48, -0.28], [0.1, 0.62, -0.23], [0.065, 0.72, -0.15], [0.06, 0.77, -0.07]];
  const bushy = (t) => (t < 0.1 ? 0.5 + 5 * t : t < 0.66 ? 1.0 + 0.12 * Math.sin(Math.PI * (t - 0.1) / 0.56) : Math.max(0.05, 1 - Math.pow((t - 0.66) / 0.34, 1.5)));
  F(taperTube(tail, 0.092, bushy, 56, 18), {});
  // licks of flame off the brush, as carved foxes have them
  F(taperTube([[0.13, 0.5, -0.29], [0.2, 0.56, -0.28], [0.23, 0.63, -0.25]], 0.035, (t) => Math.max(0.05, 1 - t), 16, 10), {});
  F(taperTube([[0.06, 0.66, -0.22], [0.02, 0.74, -0.24], [0.0, 0.8, -0.21]], 0.03, (t) => Math.max(0.05, 1 - t), 16, 10), {});
  // the bib: a red cloth tied round the neck, hanging over the chest
  const bib = new THREE.CylinderGeometry(0.058, 0.115, 0.17, 24, 1, true, -1.3, 2.6);
  P.add('bibCloth', xf(bib, { y: y0 + 0.47, z: 0.045, rx: 0.14 }));
  P.add('bibCloth', xf(new THREE.TorusGeometry(0.05, 0.012, 8, 20), { y: y0 + 0.555, z: 0.035, rx: Math.PI / 2 + 0.14 }));
  // what it holds in its mouth
  const my = y0 + hy - 0.045, mz = hz + 0.13;
  if (holds === 'key') {
    P.add('gold', xf(cylG(0.01, 0.01, 0.2, 10, {}), { y: my, z: mz, rz: Math.PI / 2 }));
    P.add('gold', xf(new THREE.TorusGeometry(0.028, 0.008, 8, 16), { x: -0.12, y: my, z: mz, ry: Math.PI / 2 }));
    P.add('gold', boxG(0.018, 0.045, 0.01, { x: 0.09, y: my - 0.022, z: mz }));
  } else {
    const jewel = latheG([[0.001, -0.04], [0.035, -0.028], [0.04, 0.0], [0.028, 0.028], [0.011, 0.05], [0.001, 0.07]], 16);
    P.add('gold', xf(jewel, { y: my - 0.01, z: mz + 0.01 }));
  }
}

/* ------------------------------------------------------------ 石灯籠
 * A Kasuga stone lantern: hexagonal base, shaft, platform, fire box (its
 * windows lit at night), a roof with curled corners and the jewel on top. */
export function stoneLantern(parts, o, s = 1) {
  const P = at(parts, o);
  const S = (g) => xf(g, { s });
  P.add('stoneDark', S(cylG(0.3, 0.34, 0.16, 6, { y: 0.08 })));
  P.add('stone', S(cylG(0.2, 0.26, 0.1, 6, { y: 0.21 })));
  P.add('stone', S(cylG(0.085, 0.1, 0.72, 10, { y: 0.62 })));
  P.add('stone', S(xf(new THREE.TorusGeometry(0.1, 0.02, 5, 10), { y: 0.62, rx: Math.PI / 2 })));
  P.add('stone', S(cylG(0.26, 0.14, 0.14, 6, { y: 1.05 })));
  // fire box: posts round a lit core
  P.add('lamp', S(cylG(0.15, 0.15, 0.3, 6, { y: 1.28 })));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    P.add('stone', S(boxG(0.07, 0.32, 0.07, { x: Math.sin(a) * 0.17, y: 1.28, z: Math.cos(a) * 0.17, ry: a })));
  }
  P.add('stone', S(cylG(0.22, 0.22, 0.05, 6, { y: 1.12 })));
  // the roof, curling up at its six corners
  const roof = new THREE.ConeGeometry(0.42, 0.26, 6, 2);
  const p = roof.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getZ(i));
    if (r > 0.38) p.setY(i, p.getY(i) + 0.06);
  }
  roof.computeVertexNormals();
  P.add('stoneDark', S(xf(roof, { y: 1.56 })));
  P.add('stone', S(cylG(0.07, 0.1, 0.06, 8, { y: 1.71 })));
  P.add('stoneDark', S(latheG([[0.001, 0], [0.06, 0.02], [0.065, 0.06], [0.03, 0.11], [0.001, 0.15]], 8)).translate(0, 1.73 * s, 0));
}

/* ------------------------------------------------------------ 手水舎
 * The purification pavilion: four posts, a little gabled roof, a stone
 * basin, the bamboo spout and the ladles laid on their rack.  Returns
 * where the water falls (for the trickle). */
export function temizuya(parts, o, roofFn) {
  const P = at(parts, o);
  const w = 1.7, d = 1.2, H = 2.05;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    P.add('stone', boxG(0.24, 0.12, 0.24, { x: sx * w / 2, y: 0.06, z: sz * d / 2 }));
    P.add('red', cylG(0.065, 0.07, H, 8, { x: sx * w / 2, y: H / 2 + 0.1, z: sz * d / 2 }));
  }
  for (const sz of [-1, 1]) P.add('red', boxG(w + 0.3, 0.12, 0.1, { y: H + 0.02, z: sz * d / 2 }));
  for (const sx of [-1, 1]) P.add('red', boxG(0.1, 0.12, d + 0.2, { x: sx * w / 2, y: H + 0.02, z: 0 }));
  roofFn(P, { hw: w / 2 + 0.45, zf: -d / 2 - 0.55, yf: H + 0.02, zr: 0, yr: H + 0.72, zb: d / 2 + 0.55, yb: H + 0.02, t: 0.09, sori: 0.1, lip: 0.05, hafu: 'under' });
  // the basin: a long block of granite, hollowed
  P.add('stone', ext(-0.62, 0.62, 0, 0.62, -0.3, 0.3));
  P.add('stoneDark', ext(-0.56, 0.56, 0.6, 0.64, -0.24, 0.24));
  P.add('water', ext(-0.54, 0.54, 0.605, 0.625, -0.22, 0.22));
  // the ladle rack across it, and the ladles (柄杓) laid face down
  P.add('bamboo', cylG(0.018, 0.018, 1.3, 6, { y: 0.7, z: 0.2, rz: Math.PI / 2 }));
  P.add('bamboo', cylG(0.018, 0.018, 1.3, 6, { y: 0.7, z: -0.02, rz: Math.PI / 2 }));
  for (let k = 0; k < 5; k++) {
    const x = -0.45 + k * 0.22;
    P.add('bamboo', cylG(0.009, 0.009, 0.36, 5, { x, y: 0.74, z: -0.1, rx: Math.PI / 2 + 0.25 }));
    P.add('bamboo', cylG(0.045, 0.04, 0.07, 9, { x, y: 0.77, z: 0.2, rx: 0.25 }));
  }
  // the bamboo spout, from a stone at the back, over the basin's end
  P.add('stoneDark', boxG(0.2, 0.9, 0.2, { x: 0.52, y: 0.45, z: 0.42 }));
  P.add('bamboo', cylG(0.028, 0.028, 0.5, 8, { x: 0.52, y: 0.9, z: 0.24, rx: Math.PI / 2 + 0.3 }));
  return { x: 0.52, y: 0.84, z: 0.03, bottom: 0.62 };
}

/* ------------------------------------------------------------ 絵馬掛
 * The ema rack: two posts, a little roof, three rails hung thick with
 * plaques (some fox-faced), each on its red cord. */
export function emaRack(parts, o, roofFn) {
  const P = at(parts, o);
  const w = 1.8;
  for (const sx of [-1, 1]) P.add('wood', boxG(0.09, 1.75, 0.09, { x: sx * w / 2, y: 0.875 }));
  roofFn(P, { hw: w / 2 + 0.2, zf: -0.32, yf: 1.72, zr: 0, yr: 1.92, zb: 0.32, yb: 1.72, t: 0.05, sori: 0.05, lip: 0.02, hafu: 'woodDark' });
  const r = rngKit(5151);
  for (const [row, y] of [[0, 1.52], [1, 1.2], [2, 0.88]]) {
    P.add('wood', boxG(w, 0.04, 0.04, { y }));
    for (const face of [-1, 1]) {
      let x = -w / 2 + 0.1;
      while (x < w / 2 - 0.1) {
        const cell = r.int(0, EMA_CELLS - 1);
        const fox = cell === 3 || cell === 6;
        const ew = fox ? 0.13 : 0.15, eh = fox ? 0.13 : 0.1;
        const g = new THREE.PlaneGeometry(ew, eh);
        const [u0, v0, u1, v1] = emaCell(cell);
        const uv = g.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0));
        const lean = face * (0.03 + r.next() * 0.03);
        P.add('ema', xf(g, { x: x + ew / 2, y: y - 0.02 - eh / 2 - row * 0.002, z: face * (0.03 + r.next() * 0.02), ry: face < 0 ? Math.PI : 0, rx: lean, rz: (r.next() - 0.5) * 0.12 }));
        P.add('bib', boxG(0.006, 0.03, 0.006, { x: x + ew / 2, y: y - 0.02, z: face * 0.028 }));
        x += ew + 0.005 + r.next() * 0.02;
      }
    }
  }
}

/* ---------------------------------------------------------- おみくじ掛
 * The omikuji rack: a frame with lines strung across, knotted thick with
 * white paper fortunes. */
export function omikujiRack(parts, o) {
  const P = at(parts, o);
  const w = 1.5;
  for (const sx of [-1, 1]) P.add('wood', boxG(0.08, 1.45, 0.08, { x: sx * w / 2, y: 0.725 }));
  P.add('wood', boxG(w + 0.2, 0.08, 0.1, { y: 1.47 }));
  const r = rngKit(6161);
  for (const y of [1.28, 1.02, 0.76]) {
    P.add('iron', cylG(0.006, 0.006, w, 4, { y, rz: Math.PI / 2 }));
    for (let x = -w / 2 + 0.06; x < w / 2 - 0.05; x += 0.035 + r.next() * 0.03) {
      if (r.chance(0.12)) continue;
      // a knot, and its two ends
      P.add('omikuji', boxG(0.018, 0.028, 0.02, { x, y, z: 0 }));
      P.add('omikuji', boxG(0.012, 0.05 + r.next() * 0.03, 0.004, { x: x + 0.004, y: y - 0.035, z: 0.006, rz: (r.next() - 0.5) * 0.5 }));
      if (r.chance(0.5)) P.add('omikuji', boxG(0.012, 0.04, 0.004, { x: x - 0.004, y: y + 0.03, z: -0.006, rz: (r.next() - 0.5) * 0.6 }));
    }
  }
}

/* ------------------------------------------------------------ 賽銭箱
 * The offering box: a slatted top that slopes into it, the character 奉納
 * left to the sign, iron corners. */
export function saisenBox(parts, o) {
  const P = at(parts, o);
  const w = 1.05, d = 0.55, h = 0.62;
  P.add('woodDark', boxG(w, h - 0.08, d, { y: (h - 0.08) / 2 }));
  P.add('woodDark', boxG(w + 0.08, 0.06, d + 0.08, { y: h - 0.05 }));
  for (let k = 0; k < 7; k++) {
    const z = -d / 2 + 0.06 + k * ((d - 0.12) / 6);
    P.add('wood', boxG(w - 0.08, 0.035, 0.05, { y: h - 0.02 - Math.abs(z) * 0.1, z, rx: 0.5 * Math.sign(-z) }));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.add('iron', boxG(0.07, h - 0.1, 0.07, { x: sx * (w / 2 - 0.02), y: (h - 0.1) / 2 + 0.02, z: sz * (d / 2 - 0.02) }));
  P.add('gold', boxG(0.5, 0.05, 0.01, { y: h * 0.55, z: -d / 2 - 0.006 }));
}

/* -------------------------------------------------------------- 社号標
 * The name pillar by the gate: a tall granite post on a plinth. */
export function namePillar(parts, o) {
  const P = at(parts, o);
  P.add('stoneDark', boxG(0.62, 0.2, 0.62, { y: 0.1 }));
  P.add('stoneName', boxG(0.34, 2.0, 0.34, { y: 1.2 }));
  P.add('stone', xf(new THREE.ConeGeometry(0.24, 0.12, 4), { y: 2.26, ry: Math.PI / 4 }));
}

/* ------------------------------------------------------ 神木, 榊
 * The rope round the sacred tree, its shide hanging. */
export function treeRope(parts, x, z, r, y) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    pts.push([x + Math.sin(a) * r, y + Math.sin(a * 2) * 0.02, z + Math.cos(a) * r]);
  }
  parts.add('straw', tubeG(pts, 0.05, 36, 6));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const g = shideG(0, 0, 0, 1);
    parts.add('paper', xf(g, { x: x + Math.sin(a) * (r + 0.05), y: y - 0.03, z: z + Math.cos(a) * (r + 0.05), ry: a }));
  }
}

/** 玉垣: a low stone fence, posts and two rails, along x from x0 to x1 at z. */
export function fenceStone(parts, x0, x1, z, h = 0.85) {
  const n = Math.max(2, Math.round((x1 - x0) / 1.1));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    parts.add('stone', boxG(0.17, h, 0.17, { x, y: h / 2, z }));
    parts.add('stone', xf(new THREE.ConeGeometry(0.13, 0.1, 4), { x, y: h + 0.05, z, ry: Math.PI / 4 }));
  }
  parts.add('stone', ext(x0, x1, h - 0.2, h - 0.1, z - 0.06, z + 0.06));
  parts.add('stone', ext(x0, x1, 0.22, 0.32, z - 0.06, z + 0.06));
  parts.add('stoneDark', ext(x0 - 0.1, x1 + 0.1, 0, 0.12, z - 0.14, z + 0.14));
}

export { shimenawaSpan };
