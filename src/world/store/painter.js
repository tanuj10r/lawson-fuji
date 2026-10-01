import * as THREE from 'three';
import { bake } from '../../core/util.js';

/* ------------------------------------------------------------------ *
 * Painting the store's interior (M3a).
 *
 * A konbini is lit evenly by a ceiling full of lights, so the room is
 * painted, not sun-lit: unlit materials, with each box's faces shaded by
 * hand (top brightest, sides a step down, undersides darker) through
 * vertex colours.  The ink pass still draws every edge from depth, which
 * is what gives it the anime line.  Everything solid merges into one mesh;
 * textured quads (signs, labels, floor, ceiling) batch per texture.
 *
 * All materials are white-based and joined to the store's `lit` list, so
 * the look scales the whole room's brightness (lawson.js setLook).
 *
 * Every solid part and every quad has a number, in the order it was
 * painted: `build` leaves out the ones in `drop` (what no player ever
 * sees: store/seen.js).
 * ------------------------------------------------------------------ */

const FACE = [0.88, 0.84, 1.0, 0.7, 0.95, 0.93];   // +x -x +y -y +z -z (BoxGeometry face order)

export function makePainter() {
  const solid = [];
  const quads = new Map();          // texture (or page: store/pages.js) -> parts
  const col = new THREE.Color();
  let nQuad = 0;

  /** A box from min/max corners, `color` hex, faces shaded. `ry` turns it about its centre. */
  function box(x0, x1, y0, y1, z0, z1, color, { ry = 0, rx = 0, rz = 0, shade = FACE } = {}) {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    col.set(color);
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    // 4 vertices per face, 6 faces
    for (let f = 0; f < 6; f++) {
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        c[i * 3] = col.r * shade[f]; c[i * 3 + 1] = col.g * shade[f]; c[i * 3 + 2] = col.b * shade[f];
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).setPosition((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    solid.push({ geometry: g, matrix: m, id: solid.length });
  }
  /** A cylinder standing at (x, y0, z), radius r, height h. */
  function cyl(x, y0, z, r, h, color, seg = 10, shade = 0.92) {
    const g = new THREE.CylinderGeometry(r, r, h, seg);
    col.set(color);
    const n = g.attributes.position.count, nr = g.attributes.normal, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const up = nr.getY(i) > 0.5, down = nr.getY(i) < -0.5;
      const k = up ? 1.0 : down ? 0.7 : shade * (0.9 + 0.1 * nr.getX(i));
      c[i * 3] = col.r * k; c[i * 3 + 1] = col.g * k; c[i * 3 + 2] = col.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    solid.push({ geometry: g, matrix: new THREE.Matrix4().setPosition(x, y0 + h / 2, z), id: solid.length });
  }
  /** A textured quad: centre, size, facing +z turned by ry (and tilted by rx).  Returns its number. */
  function quad(tex, x, y, z, w, h, { ry = 0, rx = 0, uv = null } = {}) {
    const g = new THREE.PlaneGeometry(w, h);
    if (uv) {
      const a = g.attributes.uv;
      for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[2] - uv[0]), uv[1] + a.getY(i) * (uv[3] - uv[1]));
    }
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')).setPosition(x, y, z);
    (quads.get(tex) ?? quads.set(tex, []).get(tex)).push({ geometry: g, matrix: m, id: nQuad });
    return nQuad++;
  }

  /** Build into `group`; every material goes on `lit`.  `drop`: { solid, quad } sets of numbers left out. */
  function build(group, lit, { name = 'store', drop = null } = {}) {
    const dev = !!import.meta.env?.DEV;
    const parts = drop ? solid.filter((s) => !drop.solid.has(s.id)) : solid;
    if (parts.length) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
      lit.push(mat);
      const mesh = new THREE.Mesh(bake(parts), mat);
      mesh.name = name + '-solid';
      // (dev, the seen tool: which vertices are which part)
      if (dev) mesh.userData.parts = parts.map((s) => ({ id: s.id, verts: s.geometry.attributes.position.count }));
      group.add(mesh);
    }
    for (const [tex, all] of quads) {
      const list = drop ? all.filter((q) => !drop.quad.has(q.id)) : all;
      if (!list.length) continue;
      const page = tex.adopt ? tex : null, map = page ? page.tex : tex;
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, map, transparent: map.userData.alpha ?? false, alphaTest: map.userData.alpha ? 0.4 : 0 });
      page?.adopt(mat);
      lit.push(mat);
      const mesh = new THREE.Mesh(bake(list), mat);
      mesh.name = name + '-quads';
      mesh.userData.noOutline = true;
      if (dev) mesh.userData.quads = list.map((q) => q.id);
      group.add(mesh);
    }
    group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  }
  return { box, cyl, quad, build, counts: () => ({ quads: nQuad, solids: solid.length }) };
}
