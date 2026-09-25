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
 * Two pre-passes (M2b), so signage batches too:
 *   split   a multi-material mesh becomes one mesh per material group
 *   atlas   every non-repeating texture on a plain toon or basic material
 *           (signs, fascias, plates, posters) is packed into shared atlas
 *           pages and its UVs remapped, so meshes batch by style, not by
 *           texture.  `userData.noAtlas` on any ancestor opts out (the
 *           Lawson: the famous view keeps its textures as they are).
 *
 * Detail (`userData.detail` on any ancestor, with `opts.detailCell`): small
 * street props batch in their own small cells, which `cullDetail` hides
 * beyond a range (SPEC section 11: distance-based detail).
 *
 * Left alone: instanced meshes, anything under a node marked
 * `userData.dynamic`, and anything with `userData.keep` (hitboxes,
 * animated parts, things code holds a reference to).
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
  if (opts.atlas) {
    splitMulti(root);
    atlasTextures(root);
  }
  const centre = new THREE.Vector3();
  root.updateMatrixWorld(true);
  // bake relative to the root, so a part that moves as a whole (the train)
  // can be batched inside itself
  const toRoot = root.matrixWorld.clone().invert();
  const rel = new THREE.Matrix4();
  const groups = new Map();
  const victims = [];

  const detailCell = opts.detailCell ?? 0;
  const visit = (o, detail) => {
    if (o.userData.dynamic) return;
    if (o.userData.detail && detailCell) detail = true;
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material)
        && o.visible && !o.userData.keep) {
      let cellKey = '';
      const size = detail ? detailCell : cell;
      if (size) {
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        centre.copy(o.geometry.boundingSphere.center).applyMatrix4(o.matrixWorld);
        cellKey = `${detail ? 'd' : ''}@${Math.floor(centre.x / size)},${Math.floor(centre.z / size)}`;
      }
      const key = matKey(o.material) + cellKey
        + `|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${o.renderOrder}`
        + `|${bakeable(o.material) ? 'pn' : Object.keys(o.geometry.attributes).sort().join(',')}`;
      let g = groups.get(key);
      if (!g) {
        const bake = bakeable(o.material);
        groups.set(key, (g = {
          material: bake ? styleMaterial(o.material) : o.material, bake,
          cast: o.castShadow, receive: o.receiveShadow, order: o.renderOrder, list: [], detail,
        }));
      }
      g.list.push(o);
    }
    for (const c of o.children) visit(c, detail);
  };
  visit(root, false);
  const details = [];

  let merged = 0, removed = 0;
  for (const g of groups.values()) {
    if (g.list.length < 2 && !g.bake && !g.detail) continue;
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
    mesh.name = g.detail ? 'merged-detail' : 'merged';
    root.add(mesh);
    if (g.detail) {
      geo.computeBoundingSphere();
      details.push(mesh);
    }
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
  return {
    merged, removed, details: details.length,
    /** Hide detail batches (small street props) farther than `range` from `p`. */
    cullDetail(p, range) {
      for (const m of details) {
        const c = m.geometry.boundingSphere.center;
        m.visible = Math.hypot(c.x - p.x, c.z - p.z) - m.geometry.boundingSphere.radius < range;
      }
    },
  };
}


/* ------------------------------------------------------------------ *
 * Pre-pass 1: split multi-material meshes, one mesh per group.
 * ------------------------------------------------------------------ */
function skipped(o) {
  for (let a = o; a; a = a.parent) if (a.userData.dynamic) return true;
  return false;
}

function splitMulti(root) {
  const list = [];
  root.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh && Array.isArray(o.material) && !o.userData.keep && o.visible) list.push(o);
  });
  for (const o of list) {
    if (skipped(o) || !o.parent) continue;
    const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const groups = src.groups.length ? src.groups : [{ start: 0, count: src.attributes.position.count, materialIndex: 0 }];
    const parts = [];
    for (const gr of groups) {
      const mat = o.material[gr.materialIndex];
      if (!mat || gr.count === 0) continue;
      const geo = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(src.attributes)) {
        const n = attr.itemSize;
        geo.setAttribute(name, new THREE.BufferAttribute(attr.array.slice(gr.start * n, (gr.start + gr.count) * n), n, attr.normalized));
      }
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(o.position);
      m.quaternion.copy(o.quaternion);
      m.scale.copy(o.scale);
      m.castShadow = o.castShadow;
      m.receiveShadow = o.receiveShadow;
      m.renderOrder = o.renderOrder;
      m.userData = { ...o.userData };
      o.parent.add(m);
      parts.push(m);
    }
    for (const c of [...o.children]) (parts[0] ?? o.parent).add(c);
    o.parent.remove(o);
    if (src !== o.geometry) src.dispose();
  }
}

/* ------------------------------------------------------------------ *
 * Pre-pass 2: pack non-repeating textures into atlas pages.
 * ------------------------------------------------------------------ */
const PAGE = 4096;
const MAX_SIDE = 1024;
const PAD = 8;

function atlasable(o) {
  if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.userData.keep || !o.visible) return false;
  const m = o.material;
  if (!(m.isMeshBasicMaterial || m.isMeshToonMaterial) || !m.map || m.userData.live || m.alphaMap) return false;
  const t = m.map;
  const img = t.image;
  if (!img || !(img.width > 0) || t.wrapS !== THREE.ClampToEdgeWrapping || t.wrapT !== THREE.ClampToEdgeWrapping) return false;
  if (t.repeat.x !== 1 || t.repeat.y !== 1 || t.offset.x !== 0 || t.offset.y !== 0 || t.rotation !== 0 || !t.flipY) return false;
  const uv = o.geometry.attributes.uv;
  if (!uv) return false;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    if (u < -0.001 || u > 1.001 || v < -0.001 || v > 1.001) return false;
  }
  return true;
}

function atlasTextures(root) {
  const meshes = [];
  const visit = (o, off) => {
    if (o.userData.dynamic || o.userData.noAtlas) off = true;
    if (!off && atlasable(o)) meshes.push(o);
    for (const c of o.children) visit(c, off);
  };
  visit(root, false);
  if (!meshes.length) return;

  // every distinct texture, and where it goes
  const slots = new Map();   // texture -> { w, h, page, x, y }
  for (const o of meshes) {
    const t = o.material.map;
    if (slots.has(t)) continue;
    const k = Math.min(1, MAX_SIDE / Math.max(t.image.width, t.image.height));
    slots.set(t, { w: Math.max(4, Math.round(t.image.width * k)), h: Math.max(4, Math.round(t.image.height * k)) });
  }
  // shelf packing, tallest first
  const order = [...slots.entries()].sort((a, b) => b[1].h - a[1].h);
  const pages = [];
  let page = -1, x = PAGE, y = 0, shelf = 0;
  for (const [, s] of order) {
    if (x + s.w + PAD * 2 > PAGE) { x = 0; y += shelf; shelf = 0; }
    if (page < 0 || y + s.h + PAD * 2 > PAGE) {
      page++; x = 0; y = 0; shelf = 0;
      const cv = document.createElement('canvas');
      cv.width = PAGE; cv.height = PAGE;
      pages.push(cv);
    }
    s.page = page; s.x = x + PAD; s.y = y + PAD;
    x += s.w + PAD * 2;
    shelf = Math.max(shelf, s.h + PAD * 2);
  }
  // paint: the texture stretched over its padding first, so mips bleed its own edge
  const ctxs = pages.map((cv) => cv.getContext('2d'));
  for (const [t, s] of slots) {
    const c = ctxs[s.page];
    c.drawImage(t.image, s.x - PAD, s.y - PAD, s.w + PAD * 2, s.h + PAD * 2);
    c.clearRect(s.x, s.y, s.w, s.h);
    c.drawImage(t.image, s.x, s.y, s.w, s.h);
  }
  const pageTex = pages.map((cv) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  });

  // one material per (original style, page): the original with its map swapped
  const mats = new Map();
  const matFor = (m, s) => {
    const key = [matKeyNoMap(m), s.page, m.map.colorSpace].join('|');
    if (!mats.has(key)) {
      const c = m.clone();
      // clone() deep-copies userData through JSON, which turns the toon shadow
      // tint uniform into a plain object: share the original's instead
      c.userData = m.userData;
      c.map = pageTex[s.page];
      mats.set(key, c);
    }
    return mats.get(key);
  };
  for (const o of meshes) {
    const s = slots.get(o.material.map);
    const geo = o.geometry.clone();
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      uv.setXY(i, (s.x + u * s.w) / PAGE, 1 - (s.y + (1 - v) * s.h) / PAGE);
    }
    o.geometry = geo;
    o.material = matFor(o.material, s);
  }
}

function tintKey(m) {
  const v = m.userData.shadowTint?.value;
  return v?.getHexString?.() ?? (v === undefined ? '-' : JSON.stringify(v));
}

function matKeyNoMap(m) {
  return [
    m.type, m.color.getHexString(), m.gradientMap?.uuid ?? '-',
    tintKey(m), m.transparent, m.opacity, m.side,
    m.alphaTest, m.depthWrite, m.fog, m.vertexColors,
    m.emissive?.getHexString() ?? '-', m.emissiveIntensity ?? 0,
  ].join('|');
}
