import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { decalAtlas, cellUV } from './tex.js';

/* ------------------------------------------------------------------ *
 * Flat decals from the kit atlas: every marking, manhole, grate, lid,
 * patch, crack and petal drift in the town ends up in one static mesh and
 * one draw.  Quads are sorted by layer, so wear lies under paint.
 *
 * A quad is placed by its centre, its size `across` x `along`, and the unit
 * direction `f` its art's top edge points to (the way a reader faces).
 * Decals write no depth, so the ink pass never outlines paint.
 * ------------------------------------------------------------------ */

export const LAYER = { wear: 0, lid: 1, paint: 2, symbol: 3, petals: 4 };

export function makeDecals() {
  const quads = [];
  return {
    quads,
    /**
     * @param cell   atlas cell name
     * @param x,z    centre
     * @param across width across `f`
     * @param along  length along `f`
     * @param f      { x, z } unit direction of the art's top
     * @param y      surface height
     */
    add(cell, x, z, across, along, f = { x: 0, z: -1 }, y = 0.02, layer = LAYER.paint) {
      quads.push({ cell, x, z, across, along, fx: f.x, fz: f.z, y, layer });
    },
    /** Build the mesh (call once, after everything is added). */
    build(name = 'decals') {
      quads.sort((a, b) => a.layer - b.layer);
      const n = quads.length;
      const pos = new Float32Array(n * 4 * 3);
      const uv = new Float32Array(n * 4 * 2);
      const nor = new Float32Array(n * 4 * 3);
      const idx = new Uint32Array(n * 6);
      quads.forEach((q, i) => {
        const [u0, v0, u1, v1] = cellUV(q.cell);
        const rx = -q.fz, rz = q.fx;          // reader's right
        const hl = q.along / 2, hw = q.across / 2;
        // a hair above the surface, a little more per layer
        const y = q.y + 0.004 + q.layer * 0.0008;
        const corners = [
          [-hw, -hl, u0, v0], [hw, -hl, u1, v0], [hw, hl, u1, v1], [-hw, hl, u0, v1],
        ];
        corners.forEach(([a, l, u, v], k) => {
          const o = (i * 4 + k);
          pos[o * 3] = q.x + rx * a + q.fx * l;
          pos[o * 3 + 1] = y;
          pos[o * 3 + 2] = q.z + rz * a + q.fz * l;
          nor[o * 3 + 1] = 1;
          uv[o * 2] = u;
          uv[o * 2 + 1] = v;
        });
        const b = i * 4;
        idx.set([b, b + 1, b + 2, b, b + 2, b + 3], i * 6);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.computeBoundingSphere();
      const mat = cel({
        color: 0xffffff, map: decalAtlas(), bands: 3, tint: 0x6a608f,
        transparent: true, depthWrite: false, cache: false,
      });
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -2;
      mat.polygonOffsetUnits = -4;
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = name;
      mesh.receiveShadow = true;
      mesh.renderOrder = 1;
      mesh.userData.noOutline = true;
      // one mesh already; keep the batcher from re-sorting its quads
      mesh.userData.keep = true;
      return mesh;
    },
  };
}
