import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { box, cyl, bake, trs } from '../../core/util.js';
import { makeBench, makePlanter, makeVendBin } from '../props.js';
import { makeBusStop } from '../vehicles.js';
import { addVending } from '../vending.js';
import { LAYER } from '../kit/decals.js';
import { lampMaterial } from '../kit/poles.js';
import { potCrowd } from '../kit/green.js';
import { PAL } from '../../core/palette.js';
import { busSignTex, busBayPlateTex, busRouteTex, posterTex } from './tex.js';

/* ------------------------------------------------------------------ *
 * The plaza's bus stop (Tan, 2026-10-02: the slab on two posts "looks
 * pathetic; redo that area").  A country bus shelter of the kind every
 * small station has: a timber frame under a little gabled roof with a
 * gutter and a downpipe, boarded to the waist, a window in the back and
 * the ends, a slat bench with a backrest, the route map and a poster
 * inside, a lamp under the ridge.  Round it: the stop pole with its
 * のりば plate, a vending machine and its bin, planters, a clipped hedge
 * behind, pots and posters on the police box's blank wall, and on the
 * paving the bus bay (yellow box, バス) with a tactile path to the door.
 *
 * Town frame.  The shelter opens east (+x), onto the bay.  Everything
 * static is baked to one mesh a material (the town's merge takes them).
 * ------------------------------------------------------------------ */

const L = 4.2, D = 1.7;          // along z, across x
const BEAM = 2.3, PITCH = 0.42;  // the wall plate's height; the roof's slope

let M = null;
const mats = () => (M ??= {
  timber: cel({ color: 0x8a6444, bands: 3, tint: 0x5c5680 }),
  board: cel({ color: 0xefe6d2, bands: 3, tint: 0x6f6790 }),
  roof: cel({ color: 0x4a6a78, bands: 3, tint: 0x4a4468 }),
  steel: cel({ color: 0x5a6068, bands: 3, tint: 0x4b4560 }),
  dark: cel({ color: 0x3c3a48, bands: 2, tint: 0x4b4560 }),
  glass: flat({ color: 0xa8c4e0, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }),
});

/** A picture facing `ry` (PlaneGeometry looks +z), on a thin dark frame. */
function picture(g, map, w, h, x, y, z, ry) {
  const f = box(w + 0.07, h + 0.07, 0.03, mats().dark, x, y, z);
  f.rotation.y = ry;
  g.add(f);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), flat({ color: 0xffffff, map, cache: false }));
  p.position.set(x + Math.sin(ry) * 0.02, y, z + Math.cos(ry) * 0.02);
  p.rotation.y = ry;
  p.userData.noOutline = true;
  g.add(p);
}

function shelter() {
  const m = mats();
  const g = new THREE.Group();
  const parts = { timber: [], board: [], roof: [], steel: [] };
  const put = (k, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) =>
    parts[k].push({ geometry: new THREE.BoxGeometry(w, h, d), matrix: trs(x, y, z, rx, ry, rz) });
  const hx = D / 2 - 0.05, hz = L / 2 - 0.05;       // the posts' centres

  // posts: four corners, one mid-back, and a short one ending each side wall
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) put('timber', 0.11, BEAM, 0.11, sx * hx, BEAM / 2, sz * hz);
  put('timber', 0.11, BEAM, 0.11, -hx, BEAM / 2, 0);
  const sideX = 0.1;                                 // the side walls stop here: the front half is open
  for (const sz of [-1, 1]) put('timber', 0.08, BEAM, 0.08, sideX, BEAM / 2, sz * hz);
  // stone feet under the posts
  for (const sz of [-1, 0, 1]) for (const sx of [-1, 1]) if (sz || sx < 0) put('steel', 0.2, 0.08, 0.2, sx * hx, 0.04, sz * hz);
  // wall plates along the eaves, tie beams across the ends, braces at the front posts
  for (const sx of [-1, 1]) put('timber', 0.12, 0.14, L + 0.3, sx * hx, BEAM + 0.07, 0);
  for (const sz of [-1, 1]) put('timber', D, 0.12, 0.1, 0, BEAM + 0.06, sz * hz);
  for (const sz of [-1, 1]) put('timber', 0.07, 0.07, 0.62, hx, BEAM - 0.2, sz * (hz - 0.24), sz * Math.PI / 4);
  // rails: sill, waist and head, round the back and the two half sides
  for (const y of [0.1, 0.98, 2.0]) {
    put('timber', 0.07, 0.07, L - 0.2, -hx, y, 0);
    for (const sz of [-1, 1]) put('timber', hx + sideX, 0.07, 0.07, (sideX - hx) / 2, y, sz * hz);
  }
  // boarded to the waist (a batten every 0.35 m), and the back's north bay boarded to the head: the map hangs there
  put('board', 0.035, 0.84, L - 0.2, -hx, 0.54, 0);
  put('board', 0.035, 0.98, hz - 0.1, -hx, 1.49, -hz / 2);
  for (const sz of [-1, 1]) put('board', hx + sideX - 0.1, 0.84, 0.035, (sideX - hx) / 2, 0.54, sz * hz);
  for (let z = -hz + 0.35; z < hz - 0.1; z += 0.35) put('timber', 0.02, 0.84, 0.03, -hx + 0.028, 0.54, z);
  // the windows' glazing bars
  put('timber', 0.04, 0.98, 0.04, -hx, 1.49, hz / 2);
  put('timber', 0.04, 0.04, hz - 0.1, -hx, 1.49, hz / 2);
  for (const sz of [-1, 1]) put('timber', 0.04, 0.98, 0.04, (sideX - hx) / 2, 1.49, sz * hz);

  // the roof: two slopes, standing seams, a ridge cap, bargeboards, gutters and a downpipe
  const over = 0.42, run = hx + over, slope = run / Math.cos(PITCH), rise = hx * Math.tan(PITCH);
  const ridge = BEAM + 0.14 + rise;
  const LR = L + 0.7;
  for (const s of [-1, 1]) {
    const cx = s * run / 2, cy = ridge + 0.03 - (run / 2) * Math.tan(PITCH);
    put('roof', slope + 0.04, 0.05, LR, cx, cy, 0, 0, 0, -s * PITCH);
    for (let z = -LR / 2 + 0.25; z < LR / 2; z += 0.44) put('roof', slope, 0.035, 0.035, cx, cy + 0.04, z, 0, 0, -s * PITCH);
    for (const sz of [-1, 1]) put('timber', slope + 0.02, 0.13, 0.04, cx, cy - 0.06, sz * (LR / 2 - 0.02), 0, 0, -s * PITCH);
    const ex = s * (run + 0.03), ey = ridge - run * Math.tan(PITCH) - 0.03;
    put('steel', 0.1, 0.07, LR + 0.06, ex, ey, 0);
  }
  put('roof', 0.2, 0.07, LR + 0.06, 0, ridge + 0.05, 0);
  {
    // the downpipe: off the back gutter's north end, in to the corner post, down it to a shoe
    const gx = -(run + 0.03), gy = ridge - run * Math.tan(PITCH) - 0.07, px = -hx - 0.1, z = -hz;
    const dx = px - gx, len = Math.hypot(dx, 0.3);
    parts.steel.push({ geometry: new THREE.CylinderGeometry(0.028, 0.028, len, 8), matrix: trs((gx + px) / 2, gy - 0.15, z, 0, 0, Math.atan2(dx, 0.3)) });
    parts.steel.push({ geometry: new THREE.CylinderGeometry(0.028, 0.028, gy - 0.4, 8), matrix: trs(px, (gy - 0.3) / 2 + 0.1, z) });
    put('steel', 0.09, 0.03, 0.05, px + 0.03, 1.2, z);
  }
  // the gables, boarded
  for (const sz of [-1, 1]) {
    const sh = new THREE.Shape();
    sh.moveTo(-hx, 0); sh.lineTo(hx, 0); sh.lineTo(0, rise); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false });
    parts.board.push({ geometry: geo, matrix: trs(0, BEAM + 0.12, sz * hz - 0.015) });
    put('timber', 0.05, rise, 0.05, 0, BEAM + 0.12 + rise / 2, sz * hz);
  }
  for (const [k, list] of Object.entries(parts)) {
    const mesh = new THREE.Mesh(bake(list), m[k]);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  }

  // glass: the back's south bay, and the two half sides
  const pane = (w, h, x, y, z, ry) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m.glass);
    p.position.set(x, y, z);
    p.rotation.y = ry;
    p.userData.noOutline = true;
    g.add(p);
  };
  pane(hz - 0.1, 0.98, -hx, 1.49, hz / 2, Math.PI / 2);
  for (const sz of [-1, 1]) pane(hx + sideX - 0.1, 0.98, (sideX - hx) / 2, 1.49, sz * hz, 0);

  // the bench along the back, the route map and a poster over it
  const bench = makeBench({ x: -hx + 0.36, y: 0, z: 0.25, ry: Math.PI / 2, len: 2.7, wood: 0xb08a62 });
  g.add(bench);
  // (side by side with a gap: their edges overlapped by 2 cm in one plane and flickered, scripts/_zfight.mjs)
  picture(g, busRouteTex(), 1.2, 0.75, -hx + 0.04, 1.5, -hz / 2 - 0.32, Math.PI / 2);
  picture(g, posterTex(1), 0.5, 0.7, -hx + 0.04, 1.5, -0.36, Math.PI / 2);
  // のりば, hung under the front plate (one board, read from the plaza)
  picture(g, busSignTex(), 2.2, 0.275, hx + 0.02, BEAM - 0.17, 0, Math.PI / 2);
  // a lamp under the ridge: an enamel shade, a bulb that lights with the street's
  const cord = ridge - 2.14;
  g.add(cyl(0.012, 0.012, cord, 6, m.dark, 0, ridge - cord / 2, 0));
  g.add(cyl(0.05, 0.17, 0.1, 12, m.dark, 0, 2.1, 0));
  g.add(cyl(0.06, 0.06, 0.07, 10, lampMaterial(), 0, 2.03, 0));
  return g;
}

/**
 * Build the stop on the plaza's west side.  `P` the plaza, `y` its paving, `kobanZ` the police box's north wall
 * and `kobanX` its middle (blank: it gets posters and pots), `pathX` where the station's tactile path runs north-south.
 */
export function buildBusStop(ctx, g, kit, { P, y, kobanZ, kobanX, pathX }) {
  const reg = (kind, x, z) => ctx.registry?.push({ kind, x, z });
  const sx = P.x0 + 1.55, sz = P.z0 + 7.6;
  const hx = D / 2, hz = L / 2;

  const sh = shelter();
  sh.position.set(sx, y, sz);
  g.add(sh);
  ctx.collide(sx - hx - 0.05, sz - hz, sx - hx + 0.1, sz + hz, y + 2.4);                       // the back
  for (const s of [-1, 1]) ctx.collide(sx - hx, sz + s * hz - 0.08, sx + 0.18, sz + s * hz + 0.08, y + 2.4);   // the half sides
  for (const s of [-1, 1]) ctx.collide(sx + hx - 0.14, sz + s * (hz - 0.05) - 0.09, sx + hx + 0.04, sz + s * (hz - 0.05) + 0.09, y + 2.4);
  ctx.collide(sx - hx + 0.1, sz - 1.1, sx - hx + 0.6, sz + 1.6, y + 0.5);                      // the bench
  reg('prop', sx, sz);
  ctx.night?.pool(sx + 0.5, sz, 3.4, { y, strength: 1.0 });
  ctx.night?.glow(g, L - 0.3, 1.9, sx - hx + 0.09, y + 1.08, sz, Math.PI / 2);      // the lamp on the boards behind the bench

  // the stop pole at the kerb, its のりば plate under the round head
  const px = sx + hx + 0.3, pz = sz - hz - 0.25;
  const stop = makeBusStop({ x: px, y, z: pz, ry: Math.PI / 2 });
  const plate = flat({ color: 0xffffff, map: busBayPlateTex(), cache: false });
  const side = mats().steel;
  const pl = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.13, 0.03), [side, side, side, side, plate, plate]);
  pl.position.set(0, 1.81, 0);
  stop.add(pl);
  g.add(stop);
  ctx.collide(px - 0.15, pz - 0.15, px + 0.15, pz + 0.15, y + 2.5);

  // a vending machine and its bin, north of the shelter; planters at its ends
  const vz = sz - hz - 1.25;
  addVending(ctx, { detail: true, x: sx - 0.25, y, z: vz, ry: Math.PI / 2, variant: 1, seed: 8861 });
  const bin = makeVendBin({ x: sx - 0.3, y, z: vz - 1.0, ry: Math.PI / 2 });
  bin.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  g.add(bin);
  ctx.collide(sx - 0.58, vz - 1.28, sx - 0.02, vz - 0.72, y + 0.95);
  reg('prop', sx - 0.3, vz);
  for (const [qx, qz, seed] of [[sx - 0.35, sz + hz + 0.5, 8863], [sx + hx - 0.3, sz + hz + 0.5, 8864]]) {
    g.add(makePlanter({ x: qx, y, z: qz, r: 0.3, flower: true, seed, n: 7 }));
    ctx.collide(qx - 0.33, qz - 0.33, qx + 0.33, qz + 0.33, y + 0.8);
  }

  // a clipped hedge along the plaza's edge behind it all (生垣: boxes with a lumpy top, two greens, baked)
  {
    const hedgeX = P.x0 + 0.26, z0 = P.z0 + 2.4, z1 = kobanZ - 0.25, n = Math.round((z1 - z0) / 0.85), step = (z1 - z0) / n;
    const tones = [[], []], lump = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < n; i++) {
      const z = z0 + (i + 0.5) * step, h = 0.92 + ((i * 7) % 5) * 0.025, w = 0.4 + ((i * 3) % 4) * 0.012;
      tones[i % 2].push({ geometry: new THREE.BoxGeometry(w, h, step + 0.02), matrix: trs(hedgeX, h / 2, z) });
      for (const dz of [-0.22, 0.2]) tones[(i + (dz > 0 ? 1 : 0)) % 2].push({ geometry: lump, matrix: trs(hedgeX + (dz > 0 ? 0.03 : -0.03), h - 0.02, z + dz, 0, i * 1.3, 0, 0.21, 0.13, 0.3) });
    }
    [PAL.leafDeep, PAL.leaf].forEach((color, k) => {
      const mesh = new THREE.Mesh(bake(tones[k]), cel({ color, bands: 3, tint: 0x5b6f8c }));
      mesh.position.y = y;
      mesh.castShadow = mesh.receiveShadow = true;
      g.add(mesh);
    });
    ctx.collide(hedgeX - 0.25, z0, hedgeX + 0.25, z1, y + 1.0);
  }

  // the police box's blank north wall: two posters, a crowd of pots at its foot
  const wallZ = kobanZ - 0.03;
  picture(g, posterTex(0), 0.56, 0.78, kobanX + 1.2, y + 1.5, wallZ, Math.PI);
  picture(g, posterTex(2), 0.56, 0.78, kobanX - 1.1, y + 1.5, wallZ, Math.PI);
  const pc = { x: kobanX + 0.5, y, z: kobanZ - 0.3 };
  const half = potCrowd(ctx, pc, { x: 1, z: 0 }, { n: 5, seed: 8867 });
  ctx.collide(pc.x - half - 0.2, pc.z - 0.3, pc.x + half + 0.6, pc.z + 0.3, y + 0.6);

  /* On the paving: the bus bay (a yellow box, バス), the boarding edge, and the tactile path: west along the plaza's
   * north side from the station's path, round the bay's end, down to a pad of warning blocks at the door. */
  const tz = y, Z = { x: 0, z: 1 }, X = { x: 1, z: 0 };      // a decal's height is the surface's own (kit/decals.js adds its hair)
  const bx0 = sx + hx + 1.5, bx1 = bx0 + 2.8, bz0 = sz - hz - 2.6, bz1 = bz0 + 8.0;
  const bmx = (bx0 + bx1) / 2, bmz = (bz0 + bz1) / 2;
  for (const x of [bx0, bx1]) kit.decals.add('yellow', x, bmz, 0.15, bz1 - bz0 - 0.15, Z, tz, LAYER.paint);     // (between the end lines: no paint lies twice)
  for (const z of [bz0, bz1]) kit.decals.add('yellow', bmx, z, bx1 - bx0 + 0.15, 0.15, Z, tz, LAYER.paint);
  kit.decals.add('bus', bmx, bmz, 1.8, 2.6, Z, tz, LAYER.symbol);
  kit.decals.add('white', bx0 - 0.45, bmz, 0.12, bz1 - bz0, Z, tz, LAYER.paint);
  const tx = bx0 - 0.9, tzN = bz0 - 0.6;
  for (let x = tx + 0.3; x < pathX - 0.3; x += 0.3) kit.decals.add('tactileLine', x, tzN, 0.3, 0.3, X, tz, LAYER.paint);
  for (let z = tzN; z < sz - 0.66; z += 0.3) kit.decals.add('tactileLine', tx, z, 0.3, 0.3, Z, tz, LAYER.paint);
  for (const dx of [-0.3, 0, 0.3]) for (const dz of [0, 0.3]) kit.decals.add('tactileDot', tx + dx, sz - 0.35 + dz, 0.3, 0.3, Z, tz, LAYER.paint);
}
