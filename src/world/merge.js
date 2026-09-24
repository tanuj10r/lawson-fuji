import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cel } from '../core/toon.js';

/* ------------------------------------------------------------------ *
 * Static batching (SPEC section 11: merge static geometry per material).
 *
 * Every plain mesh under `root` is baked into world space and merged with
 * the others that share its material and shadow flags, so a town of a few
 * thousand little meshes draws in a few hundred calls.  Outline hulls
 * (one ShaderMaterial each, but identical in all but name) are grouped by
 * their uniforms and share one material.
 *
 * Plain-coloured toon and basic materials (no texture) are folded further:
 * their colour goes into a vertex colour and they share one material per
 * lighting style, which is what collapses Sakura Crossing's one-material-
 * per-colour parts into a handful of batches.  A material whose colour
 * changes at runtime is tagged `userData.live` and keeps its own batch.
 *
 * Left alone: instanced meshes, multi-material meshes, anything under a
 * node marked `userData.dynamic`, and anything with `userData.keep`
 * (hitboxes, animated parts, things code holds a reference to).
 * ------------------------------------------------------------------ */

function hullKey(m) {
  const u = m.uniforms;
  return `hull|${u.uThickness.value}|${u.uColor.value.getHexString()}|${u.uOpacity.value}`;
}

/* Two material objects that would draw identically share a batch: the same
 * texture on two shopfronts, the same plate on two posts.  Only the basic and
 * toon materials the town is built from are compared this way; anything else
 * batches by identity. */
/** Can this material's colour be baked into vertex colours? */
function bakeable(m) {
  if (m.userData.live || m.map || m.alphaMap || m.vertexColors) return false;
  return m.isMeshToonMaterial || m.isMeshBasicMaterial;
}

function styleKey(m) {
  return [
    // toon tint travels per vertex (aTint), so it does not split batches
    'vc', m.type, m.gradientMap?.uuid ?? '-',
    m.transparent, m.opacity, m.side, m.alphaTest, m.depthWrite, m.fog, m.flatShading,
    m.emissive?.getHexString() ?? '-', m.emissiveIntensity ?? 0,
  ].join('|');
}

const styleCache = new Map();
const DEFAULT_TINT = new THREE.Color(0x6c5f8c);
/** The shared, white, vertex-coloured material standing in for a style. */
function styleMaterial(m) {
  const key = styleKey(m);
  if (styleCache.has(key)) return styleCache.get(key);
  let out;
  if (m.isMeshToonMaterial) {
    out = cel({
      color: 0xffffff, bands: m.gradientMap?.userData.bands ?? 3, tintAttr: true,
      flat: m.flatShading, transparent: m.transparent, opacity: m.opacity, side: m.side,
      alphaTest: m.alphaTest, depthWrite: m.depthWrite, fog: m.fog, vertexColors: true,
      emissive: m.emissive?.getHex() ?? null, emissiveIntensity: m.emissiveIntensity, cache: false,
    });
  } else {
    out = new THREE.MeshBasicMaterial({
      color: 0xffffff, vertexColors: true, transparent: m.transparent, opacity: m.opacity,
      side: m.side, alphaTest: m.alphaTest, fog: m.fog, toneMapped: m.toneMapped,
    });
    out.depthWrite = m.depthWrite;
  }
  styleCache.set(key, out);
  return out;
}

function matKey(m) {
  if (m.userData.live) return m.uuid;   // driven at runtime: its own batch, same object
  if (bakeable(m)) return styleKey(m);
  if (m.isShaderMaterial && m.uniforms?.uThickness) return hullKey(m);
  if (!(m.isMeshBasicMaterial || m.isMeshToonMaterial)) return m.uuid;
  return [
    m.type, m.color.getHexString(), m.map?.uuid ?? '-', m.gradientMap?.uuid ?? '-',
    m.userData.shadowTint?.value.getHexString() ?? '-', m.transparent, m.opacity, m.side,
    m.alphaTest, m.depthWrite, m.fog, m.vertexColors,
    m.emissive?.getHexString() ?? '-', m.emissiveIntensity ?? 0,
  ].join('|');
}

/**
 * @param opts.cell  batch per square cell of this size (metres), by where each
 *                   mesh stands, so batches can still be frustum-culled
 */
export function mergeStatic(root, opts = {}) {
  const cell = opts.cell ?? 0;
  const centre = new THREE.Vector3();
  root.updateMatrixWorld(true);
  // bake relative to the root, so a part that moves as a whole (the train)
  // can be batched inside itself
  const toRoot = root.matrixWorld.clone().invert();
  const rel = new THREE.Matrix4();
  const groups = new Map();
  const victims = [];

  const visit = (o) => {
    if (o.userData.dynamic) return;
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material)
        && o.visible && !o.userData.keep) {
      let cellKey = '';
      if (cell) {
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        centre.copy(o.geometry.boundingSphere.center).applyMatrix4(o.matrixWorld);
        cellKey = `@${Math.floor(centre.x / cell)},${Math.floor(centre.z / cell)}`;
      }
      const key = matKey(o.material) + cellKey
        + `|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${o.renderOrder}`
        + `|${bakeable(o.material) ? 'pn' : Object.keys(o.geometry.attributes).sort().join(',')}`;
      let g = groups.get(key);
      if (!g) {
        const bake = bakeable(o.material);
        groups.set(key, (g = {
          material: bake ? styleMaterial(o.material) : o.material, bake,
          cast: o.castShadow, receive: o.receiveShadow, order: o.renderOrder, list: [],
        }));
      }
      g.list.push(o);
    }
    for (const c of o.children) visit(c);
  };
  visit(root);

  let merged = 0, removed = 0;
  for (const g of groups.values()) {
    if (g.list.length < 2 && !g.bake) continue;
    // mixed indexed / non-indexed batches cannot merge, so flatten all
    const geos = g.list.map((m) => {
      const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      geo.applyMatrix4(rel.multiplyMatrices(toRoot, m.matrixWorld));
      if (g.bake) {
        // plain colour needs position and normal only; then the material's
        // (linear) colour and, for toon, its shadow tint, per vertex
        for (const name of Object.keys(geo.attributes)) {
          if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
        }
        if (!geo.attributes.normal) geo.computeVertexNormals();
        const n = geo.attributes.position.count;
        const fill = (c) => {
          const arr = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
          return new THREE.BufferAttribute(arr, 3);
        };
        geo.setAttribute('color', fill(m.material.color));
        if (m.material.isMeshToonMaterial) {
          geo.setAttribute('aTint', fill(m.material.userData.shadowTint?.value ?? DEFAULT_TINT));
        }
      }
      return geo;
    });
    const geo = mergeGeometries(geos, false);
    geos.forEach((x) => x.dispose());
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, g.material);
    mesh.castShadow = g.cast;
    mesh.receiveShadow = g.receive;
    mesh.renderOrder = g.order;
    mesh.matrixAutoUpdate = false;
    mesh.name = 'merged';
    root.add(mesh);
    merged++;
    for (const m of g.list) victims.push(m);
  }
  // children that were not merged themselves (a one-off hull, a decal)
  // survive their parent: re-hang them on the root, same world transform
  const gone = new Set(victims);
  for (const m of victims) {
    for (const c of [...m.children]) if (!gone.has(c)) root.attach(c);
    m.parent?.remove(m);
    removed++;
  }
  // freeze what is left below the root (the root itself may move), except
  // dynamic subtrees
  const freeze = (o) => {
    if (o.userData.dynamic) return;
    o.updateMatrix();
    o.matrixAutoUpdate = false;
    for (const c of o.children) freeze(c);
  };
  for (const c of root.children) freeze(c);
  return { merged, removed };
}
