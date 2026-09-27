import * as THREE from 'three';
import { cel } from '../../../core/toon.js';
import { bake, trs, rngKit } from '../../../core/util.js';

/* ------------------------------------------------------------------ *
 * Small things on a facade (town quality pass): a window box of flowers.
 * Plain colours only, so the merge pass folds them into vertex colours
 * and they cost no draw of their own.  Authored facing +z, centred on the
 * box's foot.
 * ------------------------------------------------------------------ */

let M = null;
function mats() {
  M ??= {
    box: cel({ color: 0xb0764a, bands: 3, tint: 0x5c5680 }),
    leaf: cel({ color: 0x6fa860, bands: 3, tint: 0x4a6068 }),
    bloom: [0xf28cb0, 0xf2d24a, 0xe85a5a, 0xf4f2ea, 0xc090e0].map((c) => cel({ color: c, bands: 2, tint: 0x7a6a88 })),
  };
  return M;
}
const leafGeo = new THREE.IcosahedronGeometry(0.11, 0);
const bloomGeo = new THREE.IcosahedronGeometry(0.045, 0);

/** A planter box on a sill, `len` long, leaves and a few flowers in it. */
export function flowerBox(len, seed) {
  const m = mats();
  const r = rngKit(seed);
  const g = new THREE.Group();
  const boxM = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 0.18), m.box);
  boxM.position.y = 0.08;
  g.add(boxM);
  const leaves = [];
  const n = Math.max(3, Math.round(len / 0.16));
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.08 + ((len - 0.16) * i) / (n - 1);
    const s = r.range(0.8, 1.25);
    leaves.push({ geometry: leafGeo, matrix: trs(x, 0.2 + r.range(0, 0.05), r.range(-0.03, 0.03), r.range(0, 3), r.range(0, 3), 0, s, s * 0.85, s) });
  }
  g.add(new THREE.Mesh(bake(leaves), m.leaf));
  const col = m.bloom[r.int(0, m.bloom.length - 1)];
  const blooms = [];
  for (let i = 0; i < n; i++) {
    if (r.chance(0.35)) continue;
    blooms.push({ geometry: bloomGeo, matrix: trs(-len / 2 + r.range(0.08, len - 0.08), r.range(0.26, 0.32), r.range(0.02, 0.08)) });
  }
  if (blooms.length) g.add(new THREE.Mesh(bake(blooms), col));
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  g.userData.detail = true;
  return g;
}
