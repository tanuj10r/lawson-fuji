import * as THREE from 'three';
import { cel, flat } from '../core/toon.js';
import { bake, trs } from '../core/util.js';
import { LAWSON, STREET } from '../config.js';
import { binLabels, atmSign } from './lawson-tex.js';
import { rng } from './kit/paint.js';
import { applyWear, wornMat, wearBuilding, WEAR } from './kit/wear.js';
import { makeAircon } from './props.js';
import { LAYER } from './kit/decals.js';

/* ------------------------------------------------------------------ *
 * The Lawson, lived in (M2e; reference/japan-details.md section 1).
 *
 * What the real store has and M1's clean model did not:
 *   shell     a darker roof lip over the cap, grey downpipes at the ends,
 *             a camera and an ATM sign on the tiled wing, the pale-blue
 *             film along the bottom of the glass
 *   delivery  a roll cage cart and stacks of blue folding crates beside
 *             the left wall, where the morning delivery was left
 *   front     the recycling station, an ashtray stand, an umbrella stand
 *   ground    (dressLawsonGround) oil where cars stand, tyre scuffs at the
 *             bay mouths, repair patches, cracks, the drain grate along the
 *             apron, grit at the kerb
 * ------------------------------------------------------------------ */

const L = LAWSON;

/** A box from min/max corners, as geometry + matrix for baking. */
const part = (x0, x1, y0, y1, z0, z1) => ({
  geometry: new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0),
  matrix: trs((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
});

let crateTexture = null;
/** A folding crate's side: blue plastic, a grid of vents, a hand hole. */
function crateTex() {
  if (crateTexture) return crateTexture;
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 160;
  const c = cv.getContext('2d');
  c.fillStyle = '#2f6fb6'; c.fillRect(0, 0, 256, 160);
  c.fillStyle = '#255c99';
  for (let j = 0; j < 3; j++) for (let i = 0; i < 9; i++) c.fillRect(14 + i * 26, 48 + j * 30, 16, 20);
  c.fillStyle = '#1b3f6a';
  c.beginPath(); c.roundRect(96, 14, 64, 20, 10); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, 0, 256, 6);
  crateTexture = new THREE.CanvasTexture(cv);
  crateTexture.colorSpace = THREE.SRGBColorSpace;
  return crateTexture;
}

/**
 * Dress the store.  `root` is the Lawson's group (x from the store centre,
 * z from the glass line, +z toward the road); `lit` collects materials the
 * look brightens at night; `colliders` gets the new props' footprints.
 */
export function dressLawson(root, { lit, colliders }) {
  const hw = L.width / 2;
  const glassTop = L.height - L.coping - L.signBand;
  const wingX1 = hw + L.wingWidth;
  const g = new THREE.Group();
  g.name = 'lawson-dress';
  root.add(g);
  const add = (mesh, { shadow = true, outline = true } = {}) => {
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    if (!outline) mesh.userData.noOutline = true;
    g.add(mesh);
    return mesh;
  };

  /* ---- the shell ---- */
  {
    // roof lip: the darker edge flashing along the top of the cap
    const lip = cel({ color: 0xaab0bc, bands: 3, tint: 0x6a6690 });
    add(new THREE.Mesh(bake([
      part(-hw - 0.12, hw + 0.04, L.height - 0.06, L.height + 0.02, 0.3, 0.38),
      part(-hw - 0.14, -hw - 0.08, L.height - 0.06, L.height + 0.02, -L.depth + 0.2, 0.38),
    ]), lip));
    // downpipes: grey PVC from the gutter to the ground, with brackets
    const pvc = cel({ color: 0xb9bec8, bands: 3, tint: 0x6a6690 });
    const pipes = [];
    for (const [x, z] of [[-hw - 0.12, -0.7], [wingX1 + 0.08, -0.8], [wingX1 + 0.08, -L.depth + 0.6]]) {
      const pipe = new THREE.CylinderGeometry(0.05, 0.05, L.height - 0.25, 10);
      pipes.push({ geometry: pipe, matrix: trs(x, (L.height - 0.25) / 2 + 0.05, z) });
      pipes.push({ geometry: new THREE.CylinderGeometry(0.05, 0.05, 0.28, 10), matrix: trs(x + Math.sign(x) * 0.1, 0.12, z, 0, 0, Math.sign(x) * 1.0) });
      for (const y of [0.9, 2.1, 3.3]) pipes.push(part(x - 0.07, x + 0.07, y, y + 0.04, z - 0.07, z + 0.07));
      // the hopper under the gutter
      pipes.push({ geometry: new THREE.CylinderGeometry(0.1, 0.05, 0.18, 10), matrix: trs(x, L.height - 0.2, z) });
    }
    add(new THREE.Mesh(bake(pipes), pvc));
    // a camera on the wing, looking down the forecourt
    const camMat = cel({ color: 0xf0f1f4, bands: 3 });
    add(new THREE.Mesh(bake([
      part(hw + 0.3, hw + 0.42, 3.15, 3.25, 0.1, 0.22),
      { geometry: new THREE.BoxGeometry(0.12, 0.1, 0.24), matrix: trs(hw + 0.36, 3.1, 0.32, -0.35, 0, 0) },
    ]), camMat));
    // the red ATM sign up on the wing's face
    const atm = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.4), cel({ map: atmSign(), bands: 3, cache: false }));
    atm.position.set(hw + 1.55, 2.35, 0.135);
    add(atm, { shadow: false, outline: false });
    // lights under the cap over the forecourt
    const lamp = flat({ color: 0xfff6e0, cache: false });
    lamp.userData.live = true;          // the look brightens it (lawson.js setLook)
    lit.push(lamp);
    for (const x of [-6.2, -2.3, 1.8, 5.8]) {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.16), camMat);
      housing.position.set(x, glassTop - 0.02, 0.2);
      add(housing, { outline: false });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.12), lamp);
      face.rotation.x = Math.PI / 2;
      face.position.set(x, glassTop - 0.065, 0.2);
      add(face, { shadow: false, outline: false });
    }
  }

  /* ---- the pale-blue film along the bottom of the glass, and its blue line ---- */
  {
    const d0 = L.doorX - L.doorWidth / 2, d1 = L.doorX + L.doorWidth / 2;
    const film = flat({ color: 0xdce8f3, cache: false });
    const line = flat({ color: 0x3f7fc4, cache: false });
    const runs = [[-hw + 0.45, d0], [d1, hw - 0.45]];
    const fp = [], lp = [];
    for (const [x0, x1] of runs) {
      fp.push({ geometry: new THREE.PlaneGeometry(x1 - x0, 0.72), matrix: trs((x0 + x1) / 2, 0.1 + 0.36, -0.035) });
      lp.push({ geometry: new THREE.PlaneGeometry(x1 - x0, 0.05), matrix: trs((x0 + x1) / 2, 0.85, -0.034) });
    }
    add(new THREE.Mesh(bake(fp), film), { shadow: false, outline: false });
    add(new THREE.Mesh(bake(lp), line), { shadow: false, outline: false });
  }

  /* ---- the delivery corner: a roll cage cart and blue crates ---- */
  {
    const steel = cel({ color: 0xc7ccd6, bands: 3, tint: 0x6a6690 });
    const cx = -hw - 1.15, cz = -1.2;
    const W = 0.8, D = 0.62, H = 1.7;
    const bars = [];
    // base frame and casters
    bars.push(part(cx - W / 2, cx + W / 2, 0.14, 0.2, cz - D / 2, cz + D / 2));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      bars.push(part(cx + sx * (W / 2 - 0.06) - 0.035, cx + sx * (W / 2 - 0.06) + 0.035, 0, 0.14, cz + sz * (D / 2 - 0.06) - 0.035, cz + sz * (D / 2 - 0.06) + 0.035));
      bars.push(part(cx + sx * W / 2 - 0.015, cx + sx * W / 2 + 0.015, 0.2, H, cz + sz * D / 2 - 0.015, cz + sz * D / 2 + 0.015));
    }
    // mesh sides: rails every 0.14 m on the back and both ends (the front is open)
    for (let y = 0.34; y < H; y += 0.14) {
      bars.push(part(cx - W / 2, cx + W / 2, y, y + 0.012, cz - D / 2 - 0.006, cz - D / 2 + 0.006));
      for (const sx of [-1, 1]) bars.push(part(cx + sx * W / 2 - 0.006, cx + sx * W / 2 + 0.006, y, y + 0.012, cz - D / 2, cz + D / 2));
    }
    for (let x = -W / 2 + 0.1; x < W / 2; x += 0.1) bars.push(part(cx + x - 0.006, cx + x + 0.006, 0.2, H, cz - D / 2 - 0.006, cz - D / 2 + 0.006));
    for (const sx of [-1, 1]) for (let z = -D / 2 + 0.1; z < D / 2; z += 0.1) bars.push(part(cx + sx * W / 2 - 0.006, cx + sx * W / 2 + 0.006, 0.2, H, cz + z - 0.006, cz + z + 0.006));
    // a shelf halfway, and a pair of empty crates still in it
    bars.push(part(cx - W / 2, cx + W / 2, 0.9, 0.92, cz - D / 2, cz + D / 2));
    add(new THREE.Mesh(bake(bars), steel));
    colliders.push({ x0: cx - W / 2, x1: cx + W / 2, z0: cz - D / 2, z1: cz + D / 2 });

    const crate = cel({ map: crateTex(), bands: 3, tint: 0x3a4a80, cache: false });
    const crates = [];
    const r = rng(318);
    const stack = (x, z, n, ry) => {
      for (let i = 0; i < n; i++) {
        crates.push({
          geometry: new THREE.BoxGeometry(0.53, 0.3, 0.36),
          matrix: trs(x + (r() - 0.5) * 0.03, 0.15 + i * 0.3, z + (r() - 0.5) * 0.03, 0, ry + (r() - 0.5) * 0.06, 0),
        });
      }
    };
    stack(-hw - 1.1, -0.35, 4, 0.05);
    stack(-hw - 0.55, -0.4, 3, -0.08);
    stack(cx, cz, 2, 0.02);            // two left in the cage, on its floor
    add(new THREE.Mesh(bake(crates), crate));
    colliders.push({ x0: -hw - 1.4, x1: -hw - 0.25, z0: -0.6, z1: -0.15 });
  }

  /* ---- the service side: the wing's flank, where the plant lives ---- */
  {
    const X = wingX1;                      // the flank's face, looking +x
    const back = -L.depth;
    // the flank itself, weathered (the wing box is multi-material: a skin over it)
    const white = cel({ color: 0xf2f3f6, bands: 3, tint: 0x8a86b0 });
    const skin = new THREE.Mesh(new THREE.PlaneGeometry(L.depth - 0.3, L.height - 0.05), wornMat(white));
    skin.rotation.y = Math.PI / 2;
    skin.position.set(X + 0.006, (L.height - 0.05) / 2, back / 2 + 0.12);
    applyWear(skin, WEAR.mortar, 6, 0.85);    // a service wall: streaked under the parapet
    add(skin, { shadow: false, outline: false });
    // a concrete skirt along the foot
    const conc = cel({ color: 0xb8bac4, bands: 3, tint: 0x6a6690 });
    add(new THREE.Mesh(bake([part(X, X + 0.05, 0, 0.32, back + 0.2, 0.1)]), conc), { outline: false });
    // commercial AC units in a row on their pad, and their pipe ducts up the wall
    const duct = cel({ color: 0xe6dccb, bands: 3, tint: 0x6a6690 });
    const ducts = [part(X, X + 0.4, 0, 0.1, -6.3, -2.6)];
    for (const z of [-3.2, -4.45, -5.7]) {
      const ac = makeAircon({ w: 1.0, h: 1.25, d: 0.42, color: 0xe4e2e6 });
      ac.rotation.y = Math.PI / 2;
      ac.position.set(X + 0.36, 0.24, z);
      ac.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.add(ac);
      ducts.push(part(X + 0.02, X + 0.12, 0.45, 2.1, z + 0.34, z + 0.44));
      // the elbow where the pipes turn into the wall
      ducts.push(part(X, X + 0.14, 2.1, 2.24, z + 0.32, z + 0.46));
    }
    add(new THREE.Mesh(bake(ducts), duct));
    colliders.push({ x0: X, x1: X + 0.62, z0: -6.3, z1: -2.6 });
    // the meter panel and its conduit
    const grey = cel({ color: 0xa7adb9, bands: 3, tint: 0x5c5680 });
    add(new THREE.Mesh(bake([
      part(X, X + 0.14, 1.0, 1.75, -1.95, -1.4),
      part(X, X + 0.05, 1.75, 3.6, -1.72, -1.64),
      part(X, X + 0.1, 0.55, 0.9, -2.3, -2.05),
    ]), grey));
    // a louvred vent high up
    const vent = [part(X, X + 0.03, 2.6, 3.05, -7.25, -6.75)];
    for (let y = 2.64; y < 3.02; y += 0.06) vent.push(part(X + 0.02, X + 0.06, y, y + 0.025, -7.22, -6.78));
    add(new THREE.Mesh(bake(vent), cel({ color: 0xd4d7de, bands: 3 })), { outline: false });
    // the back door: steel, a lamp over it, a concrete step
    const door = cel({ color: 0x8e96a6, bands: 3, tint: 0x5c5680 });
    add(new THREE.Mesh(bake([
      part(X, X + 0.04, 0.3, 2.35, -8.95, -8.0),
      part(X + 0.03, X + 0.07, 1.05, 1.1, -8.12, -8.05),
    ]), door));
    add(new THREE.Mesh(bake([part(X, X + 0.06, 2.35, 2.45, -9.0, -7.95), part(X, X + 0.06, 0.3, 2.45, -9.0, -8.95), part(X, X + 0.06, 0.3, 2.45, -8.0, -7.95)]), grey));
    add(new THREE.Mesh(bake([part(X, X + 0.55, 0, 0.3, -9.1, -7.85)]), conc));
    add(new THREE.Mesh(bake([part(X, X + 0.16, 2.55, 2.7, -8.55, -8.4)]), cel({ color: 0xf0f1f4, bands: 3 })));
    colliders.push({ x0: X, x1: X + 0.55, z0: -9.1, z1: -7.85 });
  }

  /* ---- the front: recycling station, ashtray, umbrella stand ---- */
  {
    const bx = 4.35, bz = 0.42;
    const cab = cel({ color: 0xe9ebef, bands: 3, tint: 0x6a6690 });
    const top = cel({ color: 0x9aa1ae, bands: 3 });
    add(new THREE.Mesh(bake([part(bx - 0.7, bx + 0.7, 0, 0.95, bz - 0.24, bz + 0.24)]), cab));
    add(new THREE.Mesh(bake([part(bx - 0.72, bx + 0.72, 0.95, 1.0, bz - 0.26, bz + 0.26)]), top));
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.34), cel({ map: binLabels(), bands: 3, cache: false }));
    lab.position.set(bx, 0.72, bz + 0.245);
    add(lab, { shadow: false, outline: false });
    colliders.push({ x0: bx - 0.72, x1: bx + 0.72, z0: bz - 0.26, z1: bz + 0.26 });

    const stainless = cel({ color: 0xd9dde4, bands: 3, tint: 0x6a6690 });
    const ash = [
      { geometry: new THREE.CylinderGeometry(0.16, 0.18, 0.86, 16), matrix: trs(5.55, 0.43, 0.4) },
      { geometry: new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), matrix: trs(5.55, 0.88, 0.4) },
    ];
    add(new THREE.Mesh(bake(ash), stainless));
    colliders.push({ x0: 5.35, x1: 5.75, z0: 0.2, z1: 0.6 });

    // umbrella stand by the door, two umbrellas left in it
    const ux = L.doorX - L.doorWidth / 2 - 0.5, uz = 0.35;
    add(new THREE.Mesh(bake([part(ux - 0.2, ux + 0.2, 0, 0.5, uz - 0.12, uz + 0.12)]), stainless));
    const brolly = [
      { geometry: new THREE.CylinderGeometry(0.035, 0.012, 0.8, 8), matrix: trs(ux - 0.08, 0.62, uz, 0.1, 0, 0.08) },
      { geometry: new THREE.CylinderGeometry(0.03, 0.01, 0.78, 8), matrix: trs(ux + 0.07, 0.6, uz, -0.05, 0, -0.1) },
    ];
    add(new THREE.Mesh(bake(brolly), cel({ color: 0x3b4466, bands: 3 })));
    colliders.push({ x0: ux - 0.2, x1: ux + 0.2, z0: uz - 0.12, z1: uz + 0.12 });
  }
  return g;
}

/** Weather the store's plain walls (the side and back) after it is built. */
export function wearLawson(shell) {
  wearBuilding(shell, WEAR.newer, 5, 0.6);
}

/** Oil, scuffs, patches, cracks, the apron drain and kerb grit on the lot. */
export function dressLawsonGround(decals) {
  const S = STREET;
  const r = rng(906);
  const up = { x: 0, z: -1 };
  const y = 0.012;
  // bays: oil where engines stand, scuffs where tyres turn in
  const firstBay = S.bayFirstX - Math.floor((S.bayFirstX - S.bayX0) / S.bayWidth) * S.bayWidth;
  for (let x = firstBay; x + S.bayWidth <= S.bayX1 + 0.01; x += S.bayWidth) {
    const cx = x + S.bayWidth / 2;
    if (Math.abs(cx - L.doorX) < 1.0) continue;
    if (r() < 0.8) decals.add('oil', cx + (r() - 0.5) * 0.5, S.stopZ + 1.2 + r() * 0.6, 0.8 + r() * 0.5, 0.7 + r() * 0.5, up, y, LAYER.wear);
    if (r() < 0.35) decals.add('oil', cx + (r() - 0.5) * 0.8, S.stopZ + 3.2 + r(), 0.5, 0.45, up, y, LAYER.wear);
    if (r() < 0.6) decals.add('tyre', cx + (r() - 0.5) * 0.4, S.bayZ1 + 0.4, 1.8, 1.6, { x: (r() - 0.5) * 0.4, z: -1 }, y, LAYER.wear);
  }
  // the lane in front of the bays: repairs, cracks and scuffs
  for (let i = 0; i < 10; i++) {
    const x = S.bayX0 + r() * (S.bayX1 - S.bayX0);
    const k = r();
    if (k < 0.4) decals.add('patchDark', x, S.bayZ1 + 0.4 + r() * 1.6, 1.2 + r() * 1.4, 0.9 + r() * 1.2, up, y, LAYER.wear);
    else if (k < 0.7) decals.add('crack', x, S.bayZ1 + r() * 2, 0.5, 1.6 + r(), { x: r() - 0.5, z: -1 }, y, LAYER.wear);
    else decals.add('stain', x, S.bayZ1 + r() * 2, 1 + r(), 0.8 + r(), up, y, LAYER.wear);
  }
  // the drain grate along the front of the apron, in 1 m lids
  for (let x = -L.width / 2 - 0.4; x < L.width / 2 + L.wingWidth; x += 1.0) {
    decals.add('grate', x + 0.5, S.apron + 0.14, 0.26, 0.98, { x: 1, z: 0 }, 0.012, LAYER.lid);
  }
  // grit and a few leaves where the forecourt meets the road
  for (let x = S.x0 + 2; x < S.x1 - 2; x += 3 + r() * 5) decals.add('leaves', x, S.forecourtZ - 0.2, 0.5, 1.6, { x: 1, z: 0 }, y, LAYER.wear);
}
