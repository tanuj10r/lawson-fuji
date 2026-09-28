import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Sunken ground (ctx.sink: the river's channel) is a hole in the ground
 * plane, but the town has other ground: the Lawson's lot, walks, aprons,
 * each a flat quad laid at street level by a builder that knows nothing of
 * the channel.  One of them reaching over the sink caps it (quality pass,
 * Tan: "a black layer hiding the entire river view"), so after everything
 * is built, every flat street-level quad that overlaps a sink is cut back
 * to the sink's edge: the quad's rect minus the sink, as up to four quads,
 * with the same UV mapping (affine over the quad, so world-mapped tiles
 * stay put) and the same material and shadows.
 *
 * Flat, thin meshes that overlap a sink but are not one quad are reported
 * in dev, so the next capper is caught at once rather than found by Tan.
 * ------------------------------------------------------------------ */

const EPS = 1e-3;

/** rect [x0, z0, x1, z1] minus another: the pieces that stay (0..4). */
function subtract([x0, z0, x1, z1], [sx0, sz0, sx1, sz1]) {
  if (sx1 <= x0 + EPS || sx0 >= x1 - EPS || sz1 <= z0 + EPS || sz0 >= z1 - EPS) return [[x0, z0, x1, z1]];
  const out = [];
  if (sz0 > z0 + EPS) out.push([x0, z0, x1, sz0]);                                   // the strip before it
  if (sz1 < z1 - EPS) out.push([x0, sz1, x1, z1]);                                   // the strip past it
  const a = Math.max(z0, sz0), b = Math.min(z1, sz1);
  if (sx0 > x0 + EPS) out.push([x0, a, sx0, b]);                                     // beside it
  if (sx1 < x1 - EPS) out.push([sx1, a, x1, b]);
  return out;
}

/**
 * Cut every sink out of the flat quads under `root`.  `sinks`: world rects
 * {x0, z0, x1, z1, y}.  Returns what it did, for the log.
 */
export function cutSinks(root, sinks, { maxY = 0.35, log = true } = {}) {
  if (!sinks.length) return { cut: [], odd: [] };
  const cut = [], odd = [];
  const box = new THREE.Box3(), v = new THREE.Vector3(), inv = new THREE.Matrix4();
  const touches = (b) => sinks.filter((k) => b.max.x > k.x0 + EPS && b.min.x < k.x1 - EPS && b.max.z > k.z0 + EPS && b.min.z < k.z1 - EPS);
  const meshes = [];
  root.updateWorldMatrix(true, true);
  root.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.geometry?.attributes?.position) meshes.push(o); });
  for (const m of meshes) {
    const g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    box.copy(g.boundingBox).applyMatrix4(m.matrixWorld);
    if (box.max.y > maxY || box.min.y < -0.05 || box.max.y - box.min.y > 0.05) continue;   // not street-level flat ground
    const hit = touches(box);
    if (!hit.length) continue;
    const name = `${meshName(m)} [x ${box.min.x.toFixed(1)}..${box.max.x.toFixed(1)} z ${box.min.z.toFixed(1)}..${box.max.z.toFixed(1)}]`;
    // only real ground: opaque and lit.  Markers, glows and rings (unlit,
    // blended) are not ground and may share one geometry; a builder that
    // floors its own sink says so with userData.ownsSinks on an ancestor.
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    if (!mat || mat.transparent || mat.blending !== THREE.NormalBlending || !mat.isMeshToonMaterial && !mat.isMeshLambertMaterial && !mat.isMeshStandardMaterial) continue;
    if (owned(m)) continue;
    const pos = g.attributes.position, uv = g.attributes.uv;
    const isQuad = pos.count === 4 && g.index && g.index.count === 6 && uv;
    if (!isQuad) { odd.push(name); continue; }
    // the four corners in the world, and the affine uv map over them
    const W = [];
    for (let i = 0; i < 4; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); W.push({ x: v.x, z: v.z, u: uv.getX(i), v: uv.getY(i) }); }
    const xs = [...new Set(W.map((c) => +c.x.toFixed(3)))], zs = [...new Set(W.map((c) => +c.z.toFixed(3)))];
    if (xs.length !== 2 || zs.length !== 2) { odd.push(name); continue; }
    const rect = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
    const c00 = W.find((c) => near(c.x, rect[0]) && near(c.z, rect[1]));
    const c10 = W.find((c) => near(c.x, rect[2]) && near(c.z, rect[1]));
    const c01 = W.find((c) => near(c.x, rect[0]) && near(c.z, rect[3]));
    if (!c00 || !c10 || !c01) { odd.push(name); continue; }
    const uvAt = (x, z) => {
      const fx = (x - rect[0]) / (rect[2] - rect[0]), fz = (z - rect[1]) / (rect[3] - rect[1]);
      return [c00.u + fx * (c10.u - c00.u) + fz * (c01.u - c00.u), c00.v + fx * (c10.v - c00.v) + fz * (c01.v - c00.v)];
    };
    let pieces = [rect];
    for (const k of hit) pieces = pieces.flatMap((r) => subtract(r, [k.x0, k.z0, k.x1, k.z1]));
    const y = box.min.y;
    // the facing: keep the original winding (it faces up)
    const P = [], UV = [], N = [], I = [];
    inv.copy(m.matrixWorld).invert();
    const nrm = new THREE.Vector3(0, 1, 0);
    const nl = nrm.clone().transformDirection(inv).normalize();
    for (const [x0, z0, x1, z1] of pieces) {
      const base = P.length / 3;
      for (const [x, z] of [[x0, z1], [x1, z1], [x1, z0], [x0, z0]]) {
        v.set(x, y, z).applyMatrix4(inv);
        P.push(v.x, v.y, v.z);
        UV.push(...uvAt(x, z));
        N.push(nl.x, nl.y, nl.z);
      }
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    ng.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    ng.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    ng.setIndex(I);
    // does the original face up?  (its own normal, in the world)
    if (g.attributes.normal) {
      v.fromBufferAttribute(g.attributes.normal, 0).transformDirection(m.matrixWorld);
      if (v.y < 0) { const idx = ng.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } }
    }
    ng.computeBoundingBox();
    ng.computeBoundingSphere();
    m.geometry = ng;                 // the old geometry may be shared: not disposed
    cut.push(`${name} (${pieces.length} piece${pieces.length === 1 ? '' : 's'})`);
  }
  if (log && (cut.length || odd.length) && import.meta.env?.DEV) {
    if (cut.length) console.info(`sinkcut: cut ${cut.join(', ')}`);
    if (odd.length) console.warn(`sinkcut: flat ground over a sink that is not one quad, left as it is: ${odd.join(', ')}`);
  }
  return { cut, odd };
}

function near(a, b) { return Math.abs(a - b) < 2e-3; }
function owned(m) { for (let o = m; o; o = o.parent) if (o.userData?.ownsSinks) return true; return false; }
function meshName(m) {
  const chain = [];
  let o = m;
  while (o && chain.length < 3) { if (o.name) chain.unshift(o.name); o = o.parent; }
  return chain.join('/') || m.material?.name || 'mesh';
}
