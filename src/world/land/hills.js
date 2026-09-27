import * as THREE from 'three';
import { TOWN } from '../../config.js';
import { rngKit } from '../../core/util.js';

/* ------------------------------------------------------------------ *
 * The far hills: low wooded ridges in a ring round the town's north
 * (behind the paddies, away from Fuji), painted as flat silhouettes the
 * way Fuji is painted: a shape and a colour, three ridges deep, each one
 * flat colour, the farther ones paler and bluer.  No fog, no haze
 * gradient: the colours step.
 *
 * One mesh, vertex-coloured; the colours follow the look through the
 * scene's fog colour (the sky at the horizon), recomputed only when that
 * colour changes.
 * ------------------------------------------------------------------ */

/* base tones (day), and how far each ridge leans toward the horizon sky */
const RIDGES = [
  // near: a chain of small wooded hills, their tops scalloped with crowns
  { r: 0, base: 0x4f7f62, k: 0.2, floor: 10, h: [22, 64], w: [0.1, 0.24], n: 26, crowns: 2.2 },
  // middle: broader hills
  { r: 0.5, base: 0x6a8ca2, k: 0.4, floor: 30, h: [50, 110], w: [0.18, 0.4], n: 14, crowns: 0 },
  // far: long ridges with a peak or two
  { r: 1, base: 0x8aa0bc, k: 0.58, floor: 60, h: [90, 185], w: [0.3, 0.7], n: 8, crowns: 0 },
];

/** A seeded ridge line: rounded hills (each a smooth bump) over a floor,
 * the highest one winning, and on the near ridge a scallop of tree crowns. */
function ridgeLine(seed, R, span) {
  const r = rngKit(seed);
  const hills = Array.from({ length: R.n }, () => ({
    c: r.range(-span, span), w: r.range(...R.w), h: r.range(...R.h),
  }));
  return (t) => {
    let v = R.floor;
    for (const b of hills) {
      const d = (t - b.c) / b.w;
      if (Math.abs(d) < 1) v = Math.max(v, b.h * (1 - d * d) * (1 - d * d) + R.floor * 0.3);
    }
    if (R.crowns) v += Math.abs(Math.sin(t * 260 + seed)) * R.crowns;
    return v;
  };
}

export function buildHills(ctx) {
  const H = TOWN.land.hills;
  const [r0, r1] = H.r;
  const span = H.span;
  const N = 900;
  const pos = [], col = [], idx = [], layer = [];
  const cx = 0, cz = TOWN.land.far[1];         // centred on the tree line's middle
  RIDGES.forEach((R, li) => {
    const rad = r0 + (r1 - r0) * R.r;
    const line = ridgeLine(6101 + li * 17, R, span);
    const base = pos.length / 3;
    for (let i = 0; i <= N; i++) {
      const t = -span + (2 * span * i) / N;
      // north is -z: t = 0 straight out over the tree line
      const x = cx + Math.sin(t) * rad, z = cz - Math.cos(t) * rad;
      // the ends fall away, so the ring never shows a cut edge
      const edge = Math.min(1, (span - Math.abs(t)) / 0.35);
      const h = line(t) * (0.25 + 0.75 * Math.sqrt(Math.max(0, edge)));
      pos.push(x, -2, z, x, h, z);
      layer.push(li, li);
      col.push(0, 0, 0, 0, 0, 0);
      if (i < N) {
        const a = base + i * 2;
        // faces the town (the inside of the ring)
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const colors = new THREE.Float32BufferAttribute(col, 3);
  g.setAttribute('color', colors);
  g.setIndex(idx);
  g.computeBoundingSphere();
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'land-hills';
  mesh.userData.dynamic = true;        // not batched: it recolours with the look
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  ctx.add(mesh);

  /* colours: each ridge's one tone, leaned toward the horizon's colour */
  const fogHex = { v: -1 };
  const c = new THREE.Color(), base = RIDGES.map((R) => new THREE.Color(R.base));
  const recolour = (fogColor) => {
    for (let i = 0; i < layer.length; i += 2) {
      const R = RIDGES[layer[i]];
      c.copy(base[layer[i]]).lerp(fogColor, R.k);
      colors.setXYZ(i, c.r, c.g, c.b);
      colors.setXYZ(i + 1, c.r, c.g, c.b);
    }
    colors.needsUpdate = true;
  };
  recolour(new THREE.Color(0xc8def2));
  ctx.update(() => {
    const fog = ctx.scene.fog;
    if (!fog) return;
    const hex = fog.color.getHex();
    if (hex === fogHex.v) return;
    fogHex.v = hex;
    recolour(fog.color);
  });
  return mesh;
}
