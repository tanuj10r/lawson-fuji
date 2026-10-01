import * as THREE from 'three';
import { TOWN } from '../../config.js';
import { cel, flat } from '../../core/toon.js';
import { rngKit } from '../../core/util.js';
import { JP_ROUND } from '../kit/tex.js';
import { Body, blob, limb, at } from './shapes.js';
import { painted } from './shade.js';
import { buildKennel } from './shiba.js';

/* ------------------------------------------------------------------ *
 * ハチのおうち: Hachi's own home (Tan, 2026-10-01).
 *
 * Across the level crossing the lane ended at a guardrail and a house you
 * could not get past.  The house is gone (line/index.js leaves its lot
 * out) and the lot is his: a gate in the south fence with his name over
 * it, a lawn with stepping stones, his kennel (the one that stood in a
 * lane yard: shiba.js buildKennel) with a name plate, his blanket, a
 * water bowl and a food bowl, his toys (a ball, a chew bone, a rope, a
 * squeaky duck, a frisbee), flower beds and a low white picket fence, a
 * hedge behind, a paper lamp that glows after dark, a cherry (his: built
 * with the town's, line/index.js).
 *
 * Everything is in the town's (turned) frame: the gate is on the north
 * side (-z), on the lane.  One painted mesh (vertex colours, the animals'
 * shared material), the kennel, one little sign page (256x128: the gate
 * board and the kennel's plate), the lamp's paper, and the ball, which
 * rolls when he noses it (`HACHI_HOME.nudge`) and so is its own mesh.
 * ------------------------------------------------------------------ */

const H = TOWN.hachiHome;
const SEE = 130;      // m: from the plaza's far side the gate is a speck; beyond, nothing of the garden is drawn

/** For the guide (animals/guide.js): the ball he noses along, in the town's frame. */
export const HACHI_HOME = { ball: { x: H.ball[0], z: H.ball[1] }, nudge: () => {} };

const WOOD = 0xa4845e, WOOD_DARK = 0x7a5c40, WHITE = 0xf4f1ea, LAWN = 0x9fca8c, LAWN2 = 0x8dbb7c, SOIL = 0x7a5a48;
const BRICK = [0xc0705a, 0xb2634f, 0xcb8068], STONE = [0xcfc9bf, 0xc2bcb4];
const BLOOM = [0xf48fb1, 0xffd54f, 0xfdfdf6, 0xe8554e, 0xb39ddb, 0xff9e80];

/** The sign page: the gate's board (top, 256x72) and the kennel's plate (bottom left, 112x56). */
let signs = null;
function signTex() {
  if (signs) return signs;
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const c = cv.getContext('2d');
  const paw = (x, y, s, col) => {
    c.fillStyle = col;
    c.beginPath(); c.ellipse(x, y + s * 0.35, s * 0.62, s * 0.5, 0, 0, Math.PI * 2); c.fill();
    for (const [dx, dy] of [[-0.72, -0.25], [-0.26, -0.72], [0.26, -0.72], [0.72, -0.25]]) { c.beginPath(); c.ellipse(x + dx * s, y + dy * s, s * 0.24, s * 0.3, dx * 0.4, 0, Math.PI * 2); c.fill(); }
  };
  // the gate's board: cream, a brown line round it, his name between two paw prints
  c.fillStyle = '#f6ecd6'; c.fillRect(0, 0, 256, 72);
  c.strokeStyle = '#8a5a3a'; c.lineWidth = 4; c.strokeRect(4, 4, 248, 64);
  c.fillStyle = '#5a3a26'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `bold 33px ${JP_ROUND}`;
  c.fillText('ハチのおうち', 128, 38);
  paw(24, 34, 11, '#d9825a'); paw(232, 34, 11, '#d9825a');
  // the kennel's plate: white enamel, his name in red
  c.fillStyle = '#fbf8f0'; c.fillRect(0, 72, 112, 56);
  c.strokeStyle = '#c63d2f'; c.lineWidth = 4; c.strokeRect(4, 76, 104, 48);
  c.fillStyle = '#c63d2f'; c.font = `bold 34px ${JP_ROUND}`;
  c.fillText('ハチ', 56, 102);
  // (spare: a paw, for the blanket's corner)
  c.fillStyle = '#f6ecd6'; c.fillRect(112, 72, 144, 56);
  paw(184, 98, 18, '#d9825a');
  signs = new THREE.CanvasTexture(cv);
  signs.colorSpace = THREE.SRGBColorSpace;
  signs.anisotropy = 8;
  return signs;
}
/** A plane w x h showing the page's rect [u0, v0, u1, v1] (pixels, y down). */
function signPlane(w, h, [u0, v0, u1, v1]) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (u0 + uv.getX(i) * (u1 - u0)) / 256, 1 - (v0 + (1 - uv.getY(i)) * (v1 - v0)) / 128);
  return g;
}

export function buildHachiHome(town) {
  // his things in one group: drawn only while you are within `SEE` m (nothing of it shows from the famous views)
  const group = new THREE.Group();
  group.name = 'hachi-home';
  group.userData.dynamic = true;                 // (kept out of the town's static batches: it is shown and hidden)
  town.add(group);
  const ctx = { ...town, add: (o) => { group.add(o); return o; } };
  const r = rngKit(8808);
  const b = new Body();
  const y0 = ctx.groundAt((H.x0 + H.x1) / 2, (H.z0 + H.z1) / 2);
  const box = (w, h, d, x, y, z, color, ry = 0, rx = 0, rz = 0) => b.add(new THREE.BoxGeometry(w, h, d), { matrix: at(x, y0 + y, z, rx, ry, rz), color });
  const zF = TOWN.bounds.z1 - 2;                 // the south fence's line (town-core.js)

  /* ---- the lawn, a mown stripe or two, the stepping stones from the gate to his door ---- */
  box(H.x1 - H.x0, 0.03, H.z1 - zF - 0.15, (H.x0 + H.x1) / 2, 0.015, (zF + 0.15 + H.z1) / 2, LAWN);
  for (let x = H.x0 + 1.0; x < H.x1 - 0.6; x += 1.9) box(0.95, 0.032, H.z1 - zF - 0.9, x, 0.016, (zF + H.z1) / 2 + 0.2, LAWN2);
  // the gate's threshold, between the lane and the lawn
  box(H.gate.w - 0.3, 0.05, 0.55, H.gate.x, 0.025, zF, STONE[0]);
  const stones = [[-80, 172.9], [-79.75, 173.75], [-79.4, 174.6], [-79.05, 175.45], [-78.8, 176.3], [-78.65, 177.05]];
  stones.forEach(([x, z], i) => b.add(new THREE.CylinderGeometry(0.3, 0.33, 0.05, 9), { matrix: at(x, y0 + 0.04, z, 0, i * 1.3, 0, [1, 1, 0.82]), color: STONE[i % 2] }));

  /* ---- the picket fence, low and white: the sides and the back ---- */
  const picket = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 0.21), ry = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, post = i % 8 === 0;
      const h = post ? 0.62 : 0.5, w = post ? 0.1 : 0.085;
      box(w, h, post ? 0.1 : 0.025, x, h / 2 + 0.03, z, WHITE, ry);
      b.add(post ? blob(0.06, 0.06, 0.06, 6, 4) : new THREE.ConeGeometry(0.06, 0.07, 4), { matrix: at(x, y0 + h + (post ? 0.07 : 0.065), z, 0, ry + (post ? 0 : Math.PI / 4), 0, post ? 1 : [1, 1, 0.3]), color: WHITE });
    }
    for (const y of [0.17, 0.4]) box(len, 0.05, 0.03, (ax + bx) / 2, y, (az + bz) / 2, WHITE, ry);
  };
  picket(H.x0, zF + 0.3, H.x0, H.z1);
  picket(H.x1, zF + 0.3, H.x1, H.z1);
  picket(H.x0, H.z1, H.x1, H.z1);
  ctx.collide(H.x0 - 0.12, zF, H.x0 + 0.12, H.z1 + 0.12, 0.9);
  ctx.collide(H.x1 - 0.12, zF, H.x1 + 0.12, H.z1 + 0.12, 0.9);
  ctx.collide(H.x0 - 0.12, H.z1 - 0.12, H.x1 + 0.12, H.z1 + 0.12, 0.9);

  /* ---- the hedge behind the back fence: the garden's own backdrop ---- */
  for (let x = H.x0 - 0.2, i = 0; x < H.x1 + 0.6; x += 1.15, i++) {
    const s = 0.85 + r.next() * 0.3;
    b.add(blob(0.8 * s, 0.75 * s, 0.6, 14, 9), { matrix: at(x + r.range(-0.1, 0.1), y0 + 0.62 * s, H.z1 + 0.75), color: (p, n) => (n.y > 0.45 ? 0x86b06a : 0x6f9a5c) });
  }

  /* ---- flower beds along the fences: soil, a brick edge, flowers ---- */
  const bed = (x0, z0, x1, z1) => {
    box(x1 - x0, 0.07, z1 - z0, (x0 + x1) / 2, 0.05, (z0 + z1) / 2, SOIL);
    const alongX = x1 - x0 > z1 - z0;
    // the brick edge on the lawn's side(s)
    const run = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 0.23));
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; box(0.2, 0.1, 0.09, ax + (bx - ax) * t, 0.06, az + (bz - az) * t, r.pick(BRICK), Math.atan2(bx - ax, bz - az) + Math.PI / 2, 0, r.range(-0.06, 0.06)); }
    };
    if (alongX) { run(x0, z0, x1, z0); run(x0, z1, x1, z1); } else { run(x0, z0, x0, z1); run(x1, z0, x1, z1); }
    const n = Math.round((alongX ? x1 - x0 : z1 - z0) / 0.3);
    for (let i = 0; i < n; i++) {
      const x = r.range(x0 + 0.12, x1 - 0.12), z = r.range(z0 + 0.12, z1 - 0.12), h = r.range(0.16, 0.34), col = r.pick(BLOOM);
      box(0.014, h, 0.014, x, 0.08 + h / 2, z, 0x5f9150);
      b.add(blob(0.07, 0.035, 0.045, 6, 4), { matrix: at(x + 0.04, y0 + 0.1 + h * 0.4, z, 0, r.range(0, 6.28), 0.5), color: 0x6fa35c });
      b.add(blob(0.05, 0.036, 0.05, 7, 5), { matrix: at(x, y0 + 0.09 + h, z), color: col });
      b.add(blob(0.02, 0.018, 0.02, 5, 4), { matrix: at(x, y0 + 0.115 + h, z), color: col === 0xffd54f ? 0xf08a3c : 0xffe082 });
    }
  };
  bed(H.x0 + 0.18, zF + 0.9, H.x0 + 0.72, H.z1 - 0.8);                  // the west fence
  bed(H.x0 + 0.18, H.z1 - 0.72, H.x1 - 3.0, H.z1 - 0.18);              // the back, as far as the cherry
  bed(H.gate.x + H.gate.w / 2 + 0.5, zF + 0.3, H.x1 - 0.3, zF + 0.84);  // inside the front fence, east of the gate

  /* ---- his blanket in front of the kennel: a red check, a cream hem ---- */
  {
    const [mx, mz] = H.mat, W = 0.92, D = 0.66, nx = 7, nz = 5;
    box(W + 0.07, 0.016, D + 0.07, mx, 0.038, mz, 0xf3e7cf, 0.12);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const lx = (i + 0.5) / nx * W - W / 2, lz = (j + 0.5) / nz * D - D / 2, c0 = Math.cos(0.12), s0 = Math.sin(0.12);
      box(W / nx, 0.012, D / nz, mx + lx * c0 + lz * s0, 0.05, mz - lx * s0 + lz * c0, (i + j) % 2 ? 0xd9534a : (i % 2 ? 0xf0b8a8 : 0xfaf0e0), 0.12);
    }
  }

  /* ---- the food bowl beside the water (the water bowl is the kennel's own) ---- */
  {
    const [kx, kz] = H.kennel, fx = kx + 1.12, fz = kz - 0.62;
    b.add(new THREE.CylinderGeometry(0.105, 0.085, 0.06, 14), { matrix: at(fx, y0 + 0.06, fz), color: 0xd9534a });
    b.add(new THREE.CylinderGeometry(0.088, 0.088, 0.012, 14), { matrix: at(fx, y0 + 0.088, fz), color: 0x8a5a3c });
    for (let i = 0; i < 9; i++) { const a = i * 2.4, d = 0.02 + (i % 3) * 0.022; b.add(blob(0.017, 0.012, 0.017, 5, 4), { matrix: at(fx + Math.cos(a) * d, y0 + 0.098, fz + Math.sin(a) * d), color: i % 2 ? 0xb07a4c : 0x9a6a40 }); }
    // a little wooden tray under the two bowls
    box(0.66, 0.02, 0.3, kx + 0.94, 0.04, kz - 0.62, WOOD);
  }

  /* ---- his toys ---- */
  // the chew bone, on the blanket
  {
    const [mx, mz] = H.mat, m = at(mx - 0.2, y0 + 0.085, mz + 0.08, 0, 0.7, 0);
    b.add(limb([-0.085, 0, 0], [0.085, 0, 0], 0.022, 0.022, 7), { matrix: m, color: 0xfaf4e6 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(blob(0.03, 0.028, 0.03, 7, 5), { matrix: m.clone().multiply(at(sx * 0.095, 0, sz * 0.022)), color: 0xfaf4e6 });
  }
  // the rope toy: a twist of blue and white with a knot at each end
  {
    const m = at(-77.25, y0 + 0.07, 176.6, 0, -0.5, 0);
    for (let i = 0; i < 9; i++) b.add(blob(0.03, 0.03, 0.024, 7, 5), { matrix: m.clone().multiply(at((i - 4) * 0.036, 0.008 * Math.sin(i * 1.6), 0.012 * Math.cos(i * 1.6))), color: i % 2 ? 0x4a86c8 : 0xf6f2ea });
    for (const s of [-1, 1]) {
      b.add(blob(0.05, 0.046, 0.05, 8, 6), { matrix: m.clone().multiply(at(s * 0.2, 0.012, 0)), color: 0x4a86c8 });
      for (const k of [-1, 0, 1]) b.add(limb([s * 0.23, 0.01, 0], [s * 0.31, -0.02 + 0.01 * k, k * 0.035], 0.014, 0.01, 5), { matrix: m, color: 0xf6f2ea });
    }
  }
  // the squeaky duck
  {
    const m = at(-80.9, y0 + 0.04, 177.6, 0, 2.3, 0);
    b.add(blob(0.085, 0.07, 0.11, 10, 7), { matrix: m.clone().multiply(at(0, 0.07, 0)), color: 0xffd23c });
    b.add(blob(0.04, 0.045, 0.05, 7, 5), { matrix: m.clone().multiply(at(0, 0.11, -0.1, -0.5)), color: 0xffd23c });      // the tail, cocked
    for (const s of [-1, 1]) b.add(blob(0.022, 0.045, 0.065, 7, 5), { matrix: m.clone().multiply(at(s * 0.078, 0.078, -0.005, 0, 0, s * 0.2)), color: 0xf8c22c });
    b.add(blob(0.062, 0.06, 0.062, 10, 7), { matrix: m.clone().multiply(at(0, 0.165, 0.065)), color: 0xffd84a });
    b.add(blob(0.034, 0.014, 0.042, 8, 5), { matrix: m.clone().multiply(at(0, 0.152, 0.128)), color: 0xf08a3c });
    for (const s of [-1, 1]) b.add(blob(0.011, 0.013, 0.008, 6, 4), { matrix: m.clone().multiply(at(s * 0.031, 0.183, 0.117)), color: 0x2a221e });
  }
  // the frisbee, lying on the lawn, one edge up
  {
    const m = at(-76.55, y0 + 0.05, 176.9, 0.16, 0.4, 0);
    b.add(new THREE.CylinderGeometry(0.135, 0.15, 0.022, 18), { matrix: m, color: 0xff8a3c });
    b.add(new THREE.TorusGeometry(0.143, 0.014, 5, 18), { matrix: m.clone().multiply(at(0, -0.006, 0, Math.PI / 2)), color: 0xf2702a });
    b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.024, 12), { matrix: m.clone().multiply(at(0, 0.002, 0)), color: 0xffb37a });
  }

  /* ---- the gate: two posts, a beam, his name hung under it ---- */
  const gx = H.gate.x, gw = H.gate.w / 2 + 0.02;
  for (const s of [-1, 1]) {
    box(0.17, 2.42, 0.17, gx + s * gw, 1.21, zF, WOOD_DARK);
    box(0.25, 0.06, 0.25, gx + s * gw, 2.45, zF, WOOD);
    ctx.collide(gx + s * gw - 0.12, zF - 0.12, gx + s * gw + 0.12, zF + 0.12, 2.5);
  }
  box(gw * 2 + 0.5, 0.13, 0.15, gx, 2.3, zF, WOOD_DARK);
  box(gw * 2 + 0.8, 0.05, 0.42, gx, 2.4, zF, 0x8e3a30, 0, 0.0);      // a little red roof board, the kennel's colour
  box(1.54, 0.5, 0.05, gx, 1.93, zF, WOOD);
  for (const s of [-1, 1]) box(0.025, 0.14, 0.025, gx + s * 0.6, 2.2, zF, 0x4a3a30);

  const garden = new THREE.Mesh(b.build(), painted());
  garden.name = 'hachi-home-garden';
  garden.castShadow = garden.receiveShadow = true;
  ctx.add(garden);

  /* ---- the signs: the gate's board (both faces) and the kennel's plate, one small page ---- */
  const [kx, kz] = H.kennel;
  {
    const parts = [];
    const front = signPlane(1.44, 0.405, [0, 0, 256, 72]);
    parts.push(front.clone().applyMatrix4(at(gx, y0 + 1.93, zF - 0.027, 0, Math.PI, 0)));       // to the lane (-z)
    parts.push(front.clone().applyMatrix4(at(gx, y0 + 1.93, zF + 0.027)));                       // and into the garden
    parts.push(signPlane(0.2, 0.1, [0, 72, 112, 128]).applyMatrix4(at(kx, y0 + 0.605, kz - 0.364, 0, Math.PI, 0)));   // over his door
    const g = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) g.setAttribute(name, new THREE.Float32BufferAttribute(parts.flatMap((p) => [...p.attributes[name].array]), name === 'uv' ? 2 : 3));
    g.setIndex(parts.flatMap((p, i) => [...p.index.array].map((k) => k + i * 4)));
    const m = new THREE.Mesh(g, flat({ color: 0xffffff, map: signTex(), cache: false }));
    m.name = 'hachi-home-signs';
    m.userData.noAtlas = true;
    ctx.add(m);
  }

  /* ---- his kennel (door to the gate) and its water bowl ---- */
  buildKennel(ctx, { x: kx, z: kz, y: y0 + 0.03, yaw: Math.PI, kennel: { x: kx, z: kz }, kennelYaw: Math.PI, bowl: { x: kx + 0.76, z: kz - 0.62 } });

  /* ---- a paper lamp by the kennel: lit after dark (kit/night.js) ---- */
  {
    const lx = kx - 0.95, lz = kz - 0.15;
    const paper = cel({ color: 0xfff4dc, bands: 2, tint: 0x8a7a9a, emissive: 0xffc98a, emissiveIntensity: 0, cache: false });
    ctx.night?.glowing(paper, 0xffc98a, 1.1);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), paper);
    lamp.position.set(lx, y0 + 0.5, lz);
    lamp.name = 'hachi-home-lamp';
    ctx.add(lamp);
    const fb = new Body();
    const fbox = (w, h, d, x, y, z, color) => fb.add(new THREE.BoxGeometry(w, h, d), { matrix: at(x, y0 + y, z), color });
    fbox(0.05, 0.36, 0.05, lx, 0.21, lz, WOOD_DARK);
    fbox(0.26, 0.03, 0.26, lx, 0.375, lz, WOOD_DARK);
    fbox(0.3, 0.035, 0.3, lx, 0.645, lz, WOOD_DARK);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) fbox(0.022, 0.26, 0.022, lx + sx * 0.1, 0.5, lz + sz * 0.1, WOOD_DARK);
    const frame = new THREE.Mesh(fb.build(), painted());
    frame.castShadow = true;
    ctx.add(frame);
    ctx.collide(lx - 0.16, lz - 0.16, lx + 0.16, lz + 0.16, y0 + 0.7);
  }

  /* ---- the ball: red with a white band; it rolls when he noses it, and comes to rest ---- */
  const R = 0.075;
  const bb = new Body();
  bb.add(blob(R, R, R, 14, 10), { color: (p) => (Math.abs(p.y) < R * 0.3 ? 0xfaf6ee : 0xe2483e) });
  const ball = new THREE.Mesh(bb.build(), painted());
  ball.name = 'hachi-home-ball';
  ball.castShadow = true;
  ball.userData.dynamic = true;
  ball.rotation.set(0.5, 0, 0.6);
  const B = { x: H.ball[0], z: H.ball[1], vx: 0, vz: 0 };
  ball.position.set(B.x, y0 + 0.03 + R, B.z);
  ctx.add(ball);
  const axis = new THREE.Vector3();
  // (kept on the open lawn: off the beds, the kennel, the mat and the fences)
  const inX = [H.x0 + 1.1, H.x1 - 0.5], inZ = [zF + 1.2, H.kennel[1] - 1.5];
  HACHI_HOME.nudge = (dx, dz, v = 1.5) => { const l = Math.hypot(dx, dz) || 1; B.vx = (dx / l) * v; B.vz = (dz / l) * v; };
  const mid = town.toWorld({ x: (H.x0 + H.x1) / 2, z: (H.z0 + H.z1) / 2 });
  ctx.update((dt, cam) => {
    if (cam) group.visible = Math.hypot(cam.x - mid.x, cam.z - mid.z) < SEE;
    const v = Math.hypot(B.vx, B.vz);
    if (v < 0.02 || !(dt > 0)) return;
    B.x += B.vx * dt; B.z += B.vz * dt;
    if (B.x < inX[0] || B.x > inX[1]) { B.vx = -B.vx * 0.5; B.x = Math.max(inX[0], Math.min(inX[1], B.x)); }
    if (B.z < inZ[0] || B.z > inZ[1]) { B.vz = -B.vz * 0.5; B.z = Math.max(inZ[0], Math.min(inZ[1], B.z)); }
    const k = Math.max(0, 1 - dt * 1.4);
    B.vx *= k; B.vz *= k;
    ball.position.set(B.x, y0 + 0.03 + R, B.z);
    ball.rotateOnWorldAxis(axis.set(B.vz, 0, -B.vx).normalize(), (v * dt) / R);
    HACHI_HOME.ball.x = B.x; HACHI_HOME.ball.z = B.z;
  });
  return { garden, ball };
}
