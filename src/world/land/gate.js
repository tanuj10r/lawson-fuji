import * as THREE from 'three';
import { flat } from '../../core/toon.js';
import { TOWN } from '../../config.js';
import { DEER_PARK } from '../../data/town.js';
import { sheetGeo } from './geo.js';
import { gateBoardTex } from './tex.js';

/* ------------------------------------------------------------------ *
 * The Deer Park gate (鹿公園), at the tree line where the track ends: a
 * small roofed timber gate (冠木門), shut, its board hung on the doors
 * (鹿公園 / 近日公開 / "Deer Park · coming soon", with a deer), a rope
 * across in front, a paper lantern on a post and a sakura either side.
 * A later place joins here.
 * ------------------------------------------------------------------ */

export function buildGate(ctx, parts) {
  const g = TOWN.land.deerGate;
  const x = g.x, z = g.z;
  const P = 2.1;              // half the span between the posts
  const H = 3.0;              // post height

  // the forecourt: fine gravel, a little wider than the track
  parts.add('gravel', sheetGeo(x - 6.5, x + 6.5, z - 1.5, z + 6.2, 0.025));

  // posts, on stone footings
  for (const s of [-1, 1]) {
    const px = x + s * P;
    parts.box('stone', px - 0.26, px + 0.26, 0, 0.24, z - 0.26, z + 0.26);
    parts.box('gateWood', px - 0.15, px + 0.15, 0.24, H, z - 0.15, z + 0.15);
  }
  // the head beam (冠木), and a tie beam lower down
  parts.box('gateWood', x - P - 0.55, x + P + 0.55, H - 0.4, H - 0.14, z - 0.13, z + 0.13);
  parts.box('gateWood', x - P, x + P, 2.32, 2.44, z - 0.1, z + 0.1);
  // a small gabled roof of dark shingle, with a ridge
  const roofW = 2 * P + 1.7, eave = 0.95, rise = 0.5, y0 = H - 0.08;
  for (const s of [-1, 1]) {
    const len = Math.hypot(eave, rise);
    const b = new THREE.BoxGeometry(roofW, 0.09, len + 0.05);
    b.rotateX(s * Math.atan2(rise, eave));
    b.translate(x, y0 + rise / 2 + 0.03, z + s * eave / 2);
    parts.add('roof', b);
  }
  parts.box('roofDark', x - roofW / 2 - 0.05, x + roofW / 2 + 0.05, y0 + rise - 0.02, y0 + rise + 0.12, z - 0.1, z + 0.1);
  // rafters' ends peeking under the eaves
  for (let k = -4; k <= 4; k++) {
    for (const s of [-1, 1]) parts.box('gateWood', x + k * 0.6 - 0.04, x + k * 0.6 + 0.04, y0 - 0.02, y0 + 0.06, z + s * 0.85 - 0.3, z + s * 0.85 + 0.3);
  }

  // the two leaves, shut: vertical boards, three battens
  for (const s of [-1, 1]) {
    const a = s < 0 ? x - P + 0.15 : x + 0.01, b = s < 0 ? x - 0.01 : x + P - 0.15;
    parts.box('door', a, b, 0.08, 2.3, z - 0.05, z + 0.05);
    for (let k = 1; k < 7; k++) {
      const bx = a + ((b - a) * k) / 7;
      parts.box('gateWood', bx - 0.012, bx + 0.012, 0.1, 2.28, z + 0.05, z + 0.058);
    }
    for (const y of [0.35, 1.2, 2.05]) parts.box('gateWood', a + 0.06, b - 0.06, y - 0.06, y + 0.06, z + 0.05, z + 0.09);
    // iron ring handles
    const ring = new THREE.TorusGeometry(0.07, 0.012, 4, 10);
    ring.translate(x + s * 0.2, 1.05, z + 0.11);
    parts.add('iron', ring);
  }
  // low board wings either side, back to the town's fence
  for (const s of [-1, 1]) {
    const a = x + s * (P + 0.15), b = x + s * (P + 2.6);
    parts.box('gateWood', Math.min(a, b), Math.max(a, b), 0, 1.7, z - 0.06, z + 0.06);
    parts.box('roofDark', Math.min(a, b) - 0.05, Math.max(a, b) + 0.05, 1.7, 1.8, z - 0.14, z + 0.14);
    parts.box('gateWood', b - 0.09, b + 0.09, 0, 1.85, z - 0.09, z + 0.09);
    parts.box('gateWood', b - 0.06, b + 0.06, 0, 1.2, z - 1.5, z - 0.05);
  }
  ctx.collide(x - P - 2.8, z - 0.3, x + P + 2.8, z + 0.3, H + 0.5);

  // the board, hung on the doors
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.84, 1.15), flat({ map: gateBoardTex(DEER_PARK) }));
  board.position.set(x, 1.52, z + 0.125);
  ctx.add(board);
  parts.box('gateWood', x - 0.96, x + 0.96, 0.9, 2.14, z + 0.07, z + 0.115);
  // its two cords up to the head beam
  for (const s of [-1, 1]) parts.box('rope', x + s * 0.7 - 0.01, x + s * 0.7 + 0.01, 2.1, H - 0.4, z + 0.1, z + 0.12);

  // a rope across in front, between two short posts
  const rz = z + 1.25;
  for (const s of [-1, 1]) {
    const px = x + s * 2.5;
    parts.box('gateWood', px - 0.06, px + 0.06, 0, 0.9, rz - 0.06, rz + 0.06);
    const cap = new THREE.ConeGeometry(0.09, 0.1, 4);
    cap.rotateY(Math.PI / 4);
    cap.translate(px, 0.95, rz);
    parts.add('gateWood', cap);
  }
  {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      pts.push(new THREE.Vector3(x - 2.5 + 5 * t, 0.82 - 0.22 * Math.sin(Math.PI * t), rz));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.025, 5, false);
    parts.add('rope', tube);
  }
  ctx.collide(x - 2.6, rz - 0.12, x + 2.6, rz + 0.12, 1.0);

  // a paper lantern (行灯) on a post, beside the gate
  {
    const lx = x + P + 1.6, lz = z + 1.4;
    parts.box('gateWood', lx - 0.06, lx + 0.06, 0, 1.2, lz - 0.06, lz + 0.06);
    parts.box('gateWood', lx - 0.24, lx + 0.24, 1.18, 1.24, lz - 0.24, lz + 0.24);
    parts.box('paper', lx - 0.19, lx + 0.19, 1.24, 1.74, lz - 0.19, lz + 0.19);
    for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      parts.box('gateWood', lx + dx * 0.2 - 0.025, lx + dx * 0.2 + 0.025, 1.22, 1.78, lz + dz * 0.2 - 0.025, lz + dz * 0.2 + 0.025);
    }
    const cap = new THREE.ConeGeometry(0.36, 0.2, 4);
    cap.rotateY(Math.PI / 4);
    cap.translate(lx, 1.88, lz);
    parts.add('roof', cap);
    ctx.collide(lx - 0.25, lz - 0.25, lx + 0.25, lz + 0.25, 2);
  }

  // a sakura either side of the forecourt
  ctx.sakura.push({ x: x - 5.4, z: z + 2.4, y: 0, scale: 1.05, seed: 5201, lean: 0.12, leanDir: 2.6 });
  ctx.sakura.push({ x: x + 5.8, z: z + 3.0, y: 0, scale: 0.95, seed: 5202, lean: 0.1, leanDir: 0.4 });
}
