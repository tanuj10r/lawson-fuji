import * as THREE from 'three';
import { cel, setWearTexture } from '../../core/toon.js';
import { wearCell, wearAtlas, WEAR } from './paint.js';

/* ------------------------------------------------------------------ *
 * Putting weather on a building (M2e).
 *
 * `applyWear(mesh, kind, variant, strength)` gives every vertical face of
 * a mesh one whole cell of the wear atlas (kit/paint.js): the cell's
 * bottom at the mesh's foot, its top at the eaves, stretched along the
 * face.  Faces are found by their normals and projected on the mesh's own
 * bounds, so any shape works (boxes, gables, panels).  Up- and down-facing
 * faces get none.  The mesh's material must be worn (`wornMat`).
 *
 * Strength is the building's age: 0.25 for a house finished last year, 1
 * for one that has stood through fifty rainy seasons.
 * ------------------------------------------------------------------ */

export { WEAR };

/** Stamp aWear on the mesh's geometry (which must be its own, not shared). */
export function applyWear(mesh, kind, variant, strength, { top = null, bottom = null, tile = 0 } = {}) {
  const geo = mesh.geometry;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const y0 = bottom ?? bb.min.y, y1 = top ?? bb.max.y;
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const out = new Float32Array(pos.count * 3);
  const cell = wearCell(kind, variant);
  const spanX = Math.max(1e-3, bb.max.x - bb.min.x), spanZ = Math.max(1e-3, bb.max.z - bb.min.z);
  // a skin tiled in metres (tile > 0): its UVs laid out along each face too
  const uv = tile > 0 ? geo.attributes.uv : null;
  for (let i = 0; i < pos.count; i++) {
    const ny = nor ? nor.getY(i) : 0;
    if (uv) {
      const vx = nor ? Math.abs(nor.getX(i)) : 0, vz = nor ? Math.abs(nor.getZ(i)) : 1;
      const along = Math.abs(ny) > 0.5 ? pos.getX(i) : vz >= vx ? pos.getX(i) : pos.getZ(i);
      uv.setXY(i, along / tile, (Math.abs(ny) > 0.5 ? pos.getZ(i) : pos.getY(i)) / tile);
    }
    if (Math.abs(ny) > 0.5) continue;                     // roofs, soffits, tops: no streaks
    const nx = nor ? nor.getX(i) : 0, nz = nor ? nor.getZ(i) : 1;
    // along the face: x for faces looking along z, z for faces looking along x;
    // mirrored on the far faces so the cell reads left to right from outside
    // (mirrored as 1 - t, never wrapped: a wrap would fold the far edge's
    // u = 1 back onto 0 and smear one column of the cell across the face)
    const alongX = Math.abs(nz) >= Math.abs(nx);
    const t = alongX ? (pos.getX(i) - bb.min.x) / spanX : (pos.getZ(i) - bb.min.z) / spanZ;
    const u = (alongX ? nz >= 0 : nx < 0) ? t : 1 - t;
    const v = Math.min(0.999, Math.max(0, (pos.getY(i) - y0) / Math.max(1e-3, y1 - y0)));
    out[i * 3] = cell.u0 + u * cell.du;
    out[i * 3 + 1] = cell.v0 + v * cell.dv;
    out[i * 3 + 2] = strength;
  }
  geo.setAttribute('aWear', new THREE.BufferAttribute(out, 3));
  if (uv) uv.needsUpdate = true;
  return mesh;
}

const worn = new Map();
/** The worn twin of a plain or textured toon material (cached per source). */
export function wornMat(src) {
  if (!worn.size) setWearTexture(wearAtlas());      // the first worn surface brings the atlas
  if (src.userData.wear) return src;
  if (worn.has(src)) return worn.get(src);
  const m = cel({
    color: src.color.getHex(), map: src.map, bands: src.gradientMap?.userData.bands ?? 3,
    tint: src.userData.shadowTint?.value.getHex() ?? 0x6c5f8c, side: src.side,
    transparent: src.transparent, opacity: src.opacity, alphaTest: src.alphaTest,
    wear: true, cache: false,
  });
  worn.set(src, m);
  return m;
}

const skins = new Map();
/** A plain toon material with a skin texture laid over its colour. */
function skinMat(src, tex) {
  const key = src.uuid + tex.uuid;
  if (!skins.has(key)) {
    skins.set(key, cel({
      color: src.color.getHex(), map: tex, bands: src.gradientMap?.userData.bands ?? 3,
      tint: src.userData.shadowTint?.value.getHex() ?? 0x6c5f8c, cache: false,
    }));
  }
  return skins.get(key);
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();
/** Share of a geometry's surface area that faces sideways (walls, not roofs). */
function verticalShare(geo) {
  const pos = geo.attributes.position, idx = geo.index;
  const tri = idx ? idx.count / 3 : pos.count / 3;
  let side = 0, all = 0;
  for (let t = 0; t < tri; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    _a.fromBufferAttribute(pos, i0); _b.fromBufferAttribute(pos, i1); _c.fromBufferAttribute(pos, i2);
    _n.subVectors(_b, _a).cross(_c.sub(_a));
    const area = _n.length() / 2;
    all += area;
    if (area > 0 && Math.abs(_n.y) / (area * 2) < 0.5) side += area;
  }
  return all > 0 ? side / all : 0;
}

/**
 * Weather a whole building: its walls (tall, mostly upright, plain or
 * panel-textured toon surfaces) take a wear cell each; roofs, trim, glass,
 * signs and anything live are left alone.  `age` 0..1.
 */
export function wearBuilding(g, kind, variant, age, { minH = 1.6, skin = null } = {}) {
  g.updateMatrixWorld(true);
  const strength = 0.3 + 0.7 * Math.max(0, Math.min(1, age));
  g.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.dynamic || o.userData.noWear) return;
    const m = o.material;
    if (Array.isArray(m) || !m.isMeshToonMaterial || m.userData.live || m.transparent) return;
    const geo = o.geometry;
    if (!geo.attributes.normal) return;
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const h = (bb.max.y - bb.min.y) * o.scale.y;
    const wide = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
    if (h < minH || wide < 1.2) return;                    // pipes, posts, small parts
    if (verticalShare(geo) < 0.55) return;                 // roofs and slabs
    // the geometry may be shared with another building: stamp a copy
    if (geo.userData.wearShared !== false) { o.geometry = geo.clone(); o.geometry.userData.wearShared = false; }
    // a skin (mortar, sheet metal) goes on plain walls only, tiled in metres
    const skinned = skin && !m.map && geo.attributes.uv;
    o.material = wornMat(skinned ? skinMat(m, skin.tex) : m);
    applyWear(o, kind, variant, strength, { tile: skinned ? skin.tile : 0 });
  });
}
