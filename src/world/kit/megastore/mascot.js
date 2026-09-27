import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cel } from '../../../core/toon.js';
import { hullOutline } from '../../../core/outline.js';

/* ------------------------------------------------------------------ *
 * ペンちゃん, ドンペン堂's own mascot: a chubby round penguin in a red
 * baseball cap (a gold button and a gold disc on its front), a red bow tie
 * and a gold star pinned to a white belly, sitting on the entrance canopy
 * with one flipper up.  Ours, not anyone's: the cap, the bow tie and the
 * star are its marks.
 *
 * One vertex-coloured mesh (one draw) plus the waving flipper (its own
 * mesh, same material, so it can wave), each with an ink hull.  Authored
 * facing +z, sitting on y = 0, about 2.4 m tall.
 * ------------------------------------------------------------------ */

const C = {
  navy: 0x2c49a0, white: 0xfbfaf4, orange: 0xff9a1e, red: 0xe0141c, gold: 0xf5c21b,
  black: 0x17131e, pink: 0xff9ab8,
};

/** A part: its geometry placed, flattened to non-indexed, painted one colour. */
function part(geo, color, { p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0] } = {}) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
    new THREE.Vector3(...s),
  );
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(m);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const col = new THREE.Color(color);   // working (linear) space, as merge.js bakes colours
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

const sphere = (r, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);

function starGeo(R0, r0, depth) {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r0 : R0;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
  }
  sh.closePath();
  return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
}

let MAT = null;
function mat() {
  MAT ??= cel({ color: 0xffffff, vertexColors: true, bands: 3, tint: 0x5b5a8c, flat: false, cache: false });
  return MAT;
}

/**
 * The mascot.  Returns { group, body, flipper, mat }: `group` is the whole
 * (rock it, bob it), `flipper` the raised right flipper's pivot (wave it).
 */
export function makePenguin() {
  const parts = [
    // the round body, and the head sunk into it
    part(sphere(0.86, 28, 20), C.navy, { p: [0, 0.86, 0], s: [1, 1, 0.9] }),
    part(sphere(0.64, 28, 20), C.navy, { p: [0, 1.66, 0.02], s: [1.06, 0.95, 0.96] }),
    // the white belly, and the white mask of the face (two lobes and a chin)
    part(sphere(0.66, 24, 16), C.white, { p: [0, 0.8, 0.36], s: [0.98, 1.1, 0.58] }),
    part(sphere(0.3, 20, 14), C.white, { p: [-0.2, 1.64, 0.5], s: [1, 1.12, 0.62] }),
    part(sphere(0.3, 20, 14), C.white, { p: [0.2, 1.64, 0.5], s: [1, 1.12, 0.62] }),
    part(sphere(0.34, 20, 14), C.white, { p: [0, 1.46, 0.47], s: [1.25, 0.7, 0.62] }),
    // eyes, their shine, the cheeks
    part(sphere(0.085, 14, 10), C.black, { p: [-0.18, 1.66, 0.665], s: [1, 1.25, 0.6] }),
    part(sphere(0.085, 14, 10), C.black, { p: [0.18, 1.66, 0.665], s: [1, 1.25, 0.6] }),
    part(sphere(0.03, 8, 6), C.white, { p: [-0.16, 1.71, 0.715] }),
    part(sphere(0.03, 8, 6), C.white, { p: [0.2, 1.71, 0.715] }),
    part(sphere(0.075, 12, 8), C.pink, { p: [-0.36, 1.5, 0.62], s: [1.2, 0.8, 0.5] }),
    part(sphere(0.075, 12, 8), C.pink, { p: [0.36, 1.5, 0.62], s: [1.2, 0.8, 0.5] }),
    // the beak, short and wide
    part(new THREE.ConeGeometry(0.13, 0.24, 14), C.orange, { p: [0, 1.52, 0.78], r: [Math.PI / 2, 0, 0], s: [1.25, 1, 0.7] }),
    // the feet, poking out in front
    part(sphere(0.2, 16, 10), C.orange, { p: [-0.32, 0.07, 0.52], s: [1, 0.36, 1.35] }),
    part(sphere(0.2, 16, 10), C.orange, { p: [0.32, 0.07, 0.52], s: [1, 0.36, 1.35] }),
    // the left flipper, down at its side
    part(sphere(0.38, 16, 12), C.navy, { p: [-0.84, 0.86, 0.05], s: [0.28, 1, 0.55], r: [0, 0, -0.45] }),
    // the cap: a red crown, its peak forward, a gold button, a gold disc on the front
    part(new THREE.SphereGeometry(0.64, 26, 10, 0, Math.PI * 2, 0, Math.PI / 2), C.red, { p: [0, 1.86, 0.0], s: [1.04, 0.72, 1.02] }),
    part(new THREE.CylinderGeometry(0.4, 0.4, 0.045, 24, 1, false, -Math.PI / 2, Math.PI), C.red, { p: [0, 1.88, 0.46], s: [1.1, 1, 0.95], r: [0.12, 0, 0] }),
    part(new THREE.CylinderGeometry(0.66, 0.66, 0.07, 28), C.red, { p: [0, 1.87, 0] , s: [1.04, 1, 1.02] }),
    part(sphere(0.07, 10, 8), C.gold, { p: [0, 2.33, 0] }),
    part(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 20), C.gold, { p: [0, 2.08, 0.6], r: [Math.PI / 2 - 0.55, 0, 0] }),
    // the red bow tie at the neck, and the gold star on the belly
    part(new THREE.ConeGeometry(0.12, 0.2, 10), C.red, { p: [-0.1, 1.24, 0.72], r: [0, 0, Math.PI / 2] }),
    part(new THREE.ConeGeometry(0.12, 0.2, 10), C.red, { p: [0.1, 1.24, 0.72], r: [0, 0, -Math.PI / 2] }),
    part(sphere(0.055, 10, 8), C.red, { p: [0, 1.24, 0.76] }),
    part(starGeo(0.22, 0.1, 0.05), C.gold, { p: [0, 0.95, 0.69] }),
  ];
  const geo = mergeGeometries(parts);
  const body = new THREE.Mesh(geo, mat());
  body.castShadow = true;
  body.name = 'donpen-mascot';
  hullOutline(body, { thickness: 0.0034 });

  // the right flipper, raised in a wave, on its own pivot at the shoulder
  const fl = new THREE.Mesh(mergeGeometries([
    part(sphere(0.38, 16, 12), C.navy, { p: [0, 0.34, 0], s: [0.28, 1, 0.55] }),
  ]), mat());
  fl.castShadow = true;
  hullOutline(fl, { thickness: 0.0034 });
  const flipper = new THREE.Group();
  flipper.position.set(0.72, 1.1, 0.05);
  flipper.rotation.z = -1.05;
  flipper.add(fl);

  const group = new THREE.Group();
  group.add(body, flipper);
  return { group, body, flipper, mat: mat() };
}
