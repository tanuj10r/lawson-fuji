import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cel } from '../../../core/toon.js';
import { rngKit } from '../../../core/util.js';
import { boxG, cylG, bentBeam, tubeG, taperTube, xf } from './geo.js';
import { inscriptionAtlas, inscriptionCell, gakuTex } from './tex.js';
import { SHRINE_TEXT } from '../../../data/town.js';

/* ------------------------------------------------------------------ *
 * Torii (鳥居).
 *
 *   tunnel     the 千本鳥居: donated torii set close, one InstancedMesh for
 *              the vermilion (pillars, nuki, shimaki, gakuzuka) and one for
 *              the black (根巻 bases and the curved kasagi); the donors'
 *              names brushed down the pillars' backs, one merged mesh
 *   mainTorii  the big Inari torii (稲荷鳥居) at the lane: the ring (台輪)
 *              at each pillar head, the plaque, a shimenawa with shide
 * ------------------------------------------------------------------ */

/** Plain geometry, ready to merge: non-indexed, position/normal/uv only. */
function clean(g) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
  if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
  return n;
}
const merge = (list) => mergeGeometries(list.map(clean), false);

/* One small torii of the tunnel: pillar centres ±A, top of kasagi ~2.5 m. */
const A = 0.8, PR = [0.082, 0.094], PH = 2.3;
function smallRed() {
  return merge([
    ...[-1, 1].map((s) => cylG(PR[0], PR[1], PH - 0.3, 10, { x: s * A, y: 0.3 + (PH - 0.3) / 2 })),
    boxG(2 * A + 0.34, 0.1, 0.07, { y: 1.95 }),                // nuki, through the pillars
    boxG(2 * A + 0.52, 0.1, 0.12, { y: PH - 0.02 }),           // shimaki under the kasagi
    boxG(0.07, 0.24, 0.06, { y: 2.12 }),                       // gakuzuka, the short king post
  ]);
}
function smallBlack() {
  const k = bentBeam(2 * A + 0.86, 0.11, 0.17, 0.09);
  xf(k, { y: PH + 0.1 });
  return merge([...[-1, 1].map((s) => cylG(0.104, 0.108, 0.3, 10, { x: s * A, y: 0.15 })), k]);
}

/**
 * The tunnel: `n` torii from z0 to z1 along x = 0 (the shrine's frame).
 * Returns the meshes to add and the colliders' rects (the pillar rows
 * are walls: in and out only at the ends).
 */
export function toriiTunnel(M, z0, z1, n, seed = 3101) {
  const r = rngKit(seed);
  const red = new THREE.InstancedMesh(smallRed(), M.red, n);
  const black = new THREE.InstancedMesh(smallBlack(), M.black, n);
  const decals = [];
  const atlas = inscriptionAtlas();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const donors = SHRINE_TEXT.donors.length;
  for (let i = 0; i < n; i++) {
    const z = z0 + ((z1 - z0) * i) / Math.max(1, n - 1);
    // donated in different years, to slightly different sizes
    const sy = 0.95 + r.next() * 0.1, sx = 1 + (sy - 1) * 0.4;
    q.setFromAxisAngle(up, (r.next() - 0.5) * 0.02);
    p.set((r.next() - 0.5) * 0.02, 0, z);
    s.set(sx, sy, 1);
    m.compose(p, q, s);
    red.setMatrixAt(i, m);
    black.setMatrixAt(i, m);
    // inscriptions down the pillars' backs (the side toward the hall, read walking out)
    for (const side of [-1, 1]) {
      const cell = side < 0 ? (i * 5) % donors : donors + (i % (SHRINE_TEXT.dates.length));
      const [u0, u1] = inscriptionCell(cell);
      // an open arc on the pillar's tapered skin, 0.55..1.85 m up
      const rAt = (y) => PR[1] - (PR[1] - PR[0]) * (y - 0.3) / (PH - 0.3) + 0.004;
      const g = new THREE.CylinderGeometry(rAt(1.85), rAt(0.55), 1.3, 6, 1, true, -0.62, 1.24);
      // flip u (seen from +z, theta runs right to left) into the cell
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setX(k, u1 - uv.getX(k) * (u1 - u0));
      g.translate(side * A, 1.2, 0);
      g.applyMatrix4(m);
      decals.push(clean(g));
    }
  }
  red.instanceMatrix.needsUpdate = black.instanceMatrix.needsUpdate = true;
  for (const im of [red, black]) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere?.();
    im.userData.keep = true;
  }
  red.name = 'shrine-torii-red';
  black.name = 'shrine-torii-black';
  const ink = new THREE.Mesh(mergeGeometries(decals, false), cel({ color: 0xffffff, map: atlas, bands: 3, tint: 0x7a4060, alphaTest: 0.5, cache: false }));
  ink.name = 'shrine-torii-ink';
  ink.receiveShadow = true;
  ink.userData.noAtlas = true;
  ink.userData.noOutline = true;
  return { meshes: [red, black, ink], halfSpan: A, pillarR: PR[1] };
}

/**
 * The main torii (稲荷鳥居) at the lane, in the shrine's frame at z, into
 * `parts`.  Faces -z (the lane).  Returns the pillar positions.
 */
export function mainTorii(parts, z, { a = 1.55, gakuMat } = {}) {
  const H = 3.95;                      // top of the pillars (under the ring and shimaki)
  for (const s of [-1, 1]) {
    const x = s * a;
    parts.add('stone', boxG(0.7, 0.14, 0.7, { x, y: 0.07, z }));                        // the footing
    parts.add('black', cylG(0.25, 0.26, 0.55, 14, { x, y: 0.14 + 0.275, z }));            // 根巻
    parts.add('red', cylG(0.2, 0.225, H - 0.69, 14, { x, y: 0.69 + (H - 0.69) / 2, z }));
    parts.add('black', cylG(0.27, 0.27, 0.13, 14, { x, y: H - 0.2, z }));                 // 台輪, the Inari ring
    parts.add('red', cylG(0.21, 0.21, 0.07, 14, { x, y: H - 0.1, z }));
  }
  parts.add('red', boxG(2 * a + 1.0, 0.24, 0.15, { y: 3.25, z }));                        // 貫
  for (const s of [-1, 1]) parts.add('black', boxG(0.08, 0.26, 0.17, { x: s * (a + 0.5), y: 3.25, z }));   // the wedges (楔)
  parts.add('red', boxG(2 * a + 1.55, 0.24, 0.3, { y: H + 0.08, z }));                    // 島木
  const k = bentBeam(2 * a + 2.5, 0.27, 0.38, 0.34);
  parts.add('black', xf(k, { y: H + 0.34, z }));                                          // 笠木
  parts.add('red', boxG(0.14, 0.5, 0.12, { y: 3.62, z }));                                // 額束
  // the plaque, on the lane side
  // the plaque, on the lane side: between the nuki and the shimaki, clear of both
  parts.add('black', boxG(0.36, 0.66, 0.06, { y: 3.6, z: z - 0.14 }));
  if (gakuMat) {
    const g = new THREE.PlaneGeometry(0.32, 0.62);
    xf(g, { y: 3.6, z: z - 0.172, ry: Math.PI });
    parts.add('gaku', g);
  }
  // the shimenawa across under the nuki, with its shide and tassels
  shimenawaSpan(parts, -a + 0.2, a - 0.2, 3.02, z + 0.02, 0.22);
  return [-a, a];
}

/** A shimenawa hung between two points (x0..x1 at height y, sagging `sag`). */
export function shimenawaSpan(parts, x0, x1, y, z, sag, r = 0.075) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push([x0 + (x1 - x0) * t, y - sag * Math.sin(Math.PI * t) - r * 0.4 * Math.sin(Math.PI * t * 2) * 0, z]);
  }
  // fat in the middle, thin at the ends: two twisted strands
  const fat = (t) => 0.4 + 0.6 * Math.sin(Math.PI * t);
  parts.add('straw', taperTube(pts, r, fat, 28, 8));
  // the twist: a thinner strand wound round it, and the tied ends
  const tw = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48, x = x0 + (x1 - x0) * t, yy = y - sag * Math.sin(Math.PI * t), a = t * 26;
    tw.push([x, yy + Math.sin(a) * r * 0.75 * fat(t), z + Math.cos(a) * r * 0.75 * fat(t)]);
  }
  parts.add('strawDark', taperTube(tw, r * 0.42, fat, 96, 5));
  // shide, the zigzag paper, and the straw tassels between
  const n = 4;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = x0 + (x1 - x0) * t, yy = y - sag * Math.sin(Math.PI * t) - r;
    parts.add('paper', shideG(x, yy, z, 1));
  }
  for (let i = 0; i < 3; i++) {
    const t = (i + 1) / 4;
    const x = x0 + (x1 - x0) * t, yy = y - sag * Math.sin(Math.PI * t) - r;
    parts.add('straw', cylG(0.018, 0.045, 0.3, 6, { x, y: yy - 0.15, z }));
  }
}

/** A shide (紙垂): a strip of paper cut and folded into a zigzag, four
 * steps stepping down and out, hanging from (x, y, z); `s` scale. */
export function shideG(x, y, z, s = 1) {
  const w = 0.042 * s, h = 0.085 * s;
  const quads = [];
  // each step: a panel, then the fold hangs the next one off its corner
  const steps = [[0, 0], [w * 0.75, -h * 0.82], [0, -h * 1.64], [w * 0.75, -h * 2.46]];
  steps.forEach(([dx, dy], k) => {
    const g = new THREE.PlaneGeometry(w, h * (k === 3 ? 1.25 : 1));
    g.translate(x + dx, y + dy - h * (k === 3 ? 0.62 : 0.5), z + (k % 2) * 0.004);
    quads.push(g);
  });
  return mergeGeometries(quads.map(clean), false);
}
