import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rngKit } from '../../../core/util.js';
import { PAGE, PRODUCTS, prodRegion, prodPage, PROD_WHITE } from './tex.js';

/* ------------------------------------------------------------------ *
 * The goods (ドンペン堂): believable packages, hundreds of them, one mesh.
 *
 * Each of tex.js's PRODUCTS has a body: a bag (a pinched pillow), a box,
 * a PET bottle, a can, a cup, a tube or a tub.  Its printed face comes
 * from the PROD page (the front of a box or bag, wrapped round a bottle,
 * can or cup); every other face reads the page's white cell and shows its
 * body colour.  Shading is baked into vertex colours (top bright, sides
 * darker, the front a touch lighter), as the entrance is unlit paint.
 *
 * `stamp` places one; `fill` lines a shelf with one kind of thing;
 * `heap` jumbles a wagon or a bin.  `build` merges the lot into one mesh:
 * one draw call for every package on the front.
 * ------------------------------------------------------------------ */

const [PW, PH] = PAGE.prod;
const shadeOf = (nx, ny, nz) => (ny > 0.5 ? 1.0 : ny < -0.5 ? 0.62 : 0.8 + 0.16 * Math.max(0, nz) + 0.04 * nx);
const _c = new THREE.Color();

/** UVs of `geo` into a page region by mode: which vertices get the print. */
function print(geo, p, mode) {
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const pos = geo.attributes.position, nor = geo.attributes.normal, src = geo.attributes.uv;
  const n = pos.count;
  const uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  const [cx, cy, cw, ch] = prodRegion(p.cell), [wx, wy, ww, wh] = prodRegion(PROD_WHITE);
  const sx = Math.max(1e-6, bb.max.x - bb.min.x), sy = Math.max(1e-6, bb.max.y - bb.min.y), sz = Math.max(1e-6, bb.max.z - bb.min.z);
  _c.set(p.body);
  for (let i = 0; i < n; i++) {
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    let u = null, v = null;
    if (mode === 'front') {
      if (nz > 0.5) { u = (pos.getX(i) - bb.min.x) / sx; v = (pos.getY(i) - bb.min.y) / sy; }
      else if (nz < -0.5) { u = 1 - (pos.getX(i) - bb.min.x) / sx; v = (pos.getY(i) - bb.min.y) / sy; }
    } else if (mode === 'wrap') {
      if (Math.abs(ny) < 0.6) { u = src.getX(i); v = src.getY(i); }
      else if (ny > 0.5 && p.kind === 'cup') { u = 0.5 + (pos.getX(i) - (bb.min.x + bb.max.x) / 2) / sx; v = 0.5 + (pos.getZ(i) - (bb.min.z + bb.max.z) / 2) / sz; }
    }
    const printed = u !== null;
    const R = printed ? [cx, cy, cw, ch] : [wx, wy, ww, wh];
    if (!printed) { u = 0.5; v = 0.5; }
    uv[i * 2] = (R[0] + 1.5 + u * (R[2] - 3)) / PW;
    uv[i * 2 + 1] = 1 - (R[1] + 1.5 + (1 - v) * (R[3] - 3)) / PH;
    const k = shadeOf(nx, ny, nz);
    if (printed) { col[i * 3] = k; col[i * 3 + 1] = k; col[i * 3 + 2] = k; }
    else { col[i * 3] = _c.r * k; col[i * 3 + 1] = _c.g * k; col[i * 3 + 2] = _c.b * k; }
  }
  const out = new THREE.BufferGeometry();
  out.setIndex(geo.index);
  out.setAttribute('position', pos);
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
/** A plain-coloured part (a cap, a rim): the white cell, shaded. */
const plain = (geo, color) => print(geo, { cell: PROD_WHITE, body: color, kind: '' }, 'none');

const cyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
const lift = (g, y) => g.translate(0, y, 0);
const turned = (g) => g.rotateY(Math.PI);   // the wrap's seam to the back

const templates = new Map();
/** A package's geometry, base at y 0, front +z (cached per product). */
export function bodyOf(p) {
  if (templates.has(p.cell)) return templates.get(p.cell);
  const parts = [];
  switch (p.kind) {
    case 'bag': {
      // a pillow: a box pinched flat at the top and bottom seals
      const g = new THREE.BoxGeometry(p.w, p.h, p.d, 1, 4, 1);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const t = Math.abs(pos.getY(i)) / (p.h / 2);   // 0 middle .. 1 seal
        const k = t > 0.99 ? 0.06 : t > 0.7 ? 0.62 : 1;
        pos.setZ(i, pos.getZ(i) * k);
        pos.setX(i, pos.getX(i) * (t > 0.99 ? 0.94 : 1));
      }
      parts.push(print(lift(g, p.h / 2), p, 'front'));
      break;
    }
    case 'box': case 'tube':
      parts.push(print(lift(new THREE.BoxGeometry(p.w, p.h, p.d), p.h / 2), p, 'front'));
      break;
    case 'pet': {
      const body = p.h * 0.7;
      parts.push(print(turned(lift(cyl(p.r, p.r, body), body / 2)), p, 'wrap'));
      parts.push(plain(lift(cyl(p.r * 0.42, p.r, p.h * 0.17), body + p.h * 0.085), p.body));
      parts.push(plain(lift(cyl(p.r * 0.42, p.r * 0.42, p.h * 0.07), p.h * 0.905), p.body));
      parts.push(plain(lift(cyl(p.r * 0.46, p.r * 0.46, p.h * 0.06, 8), p.h * 0.97), p.cap ?? '#f4f4f4'));
      break;
    }
    case 'can':
      parts.push(print(turned(lift(cyl(p.r, p.r, p.h * 0.94), p.h * 0.47)), p, 'wrap'));
      parts.push(plain(lift(cyl(p.r * 0.9, p.r, p.h * 0.06, 8), p.h * 0.97), '#c8ccd4'));
      break;
    case 'cup':
      parts.push(print(turned(lift(cyl(p.r, p.r * 0.76, p.h), p.h / 2)), p, 'wrap'));
      parts.push(plain(lift(cyl(p.r * 1.04, p.r * 1.04, 0.006, 10), p.h + 0.003), '#f6f6f2'));
      break;
    case 'tub':
      parts.push(print(turned(lift(cyl(p.r, p.r, p.h * 0.8), p.h * 0.4)), p, 'wrap'));
      parts.push(plain(lift(cyl(p.r * 1.02, p.r * 1.02, p.h * 0.2, 10), p.h * 0.9), '#f8f0f4'));
      break;
    default:
      parts.push(plain(lift(new THREE.BoxGeometry(0.1, 0.1, 0.1), 0.05), p.body));
  }
  const geo = parts.length > 1 ? mergeGeometries(parts) : parts[0];
  templates.set(p.cell, geo);
  return geo;
}
export const widthOf = (p) => (p.r !== undefined ? 2 * p.r : p.w);
export const depthOf = (p) => (p.r !== undefined ? 2 * p.r : p.d);

/** The stock of one place: stamp packages, then build them into one mesh. */
export function makeStock(seed = 4242) {
  const q = rngKit(seed);
  const list = [];
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1);
  const byCat = new Map();
  const pool = (cat) => {
    const k = Array.isArray(cat) ? cat.join(',') : cat;
    if (!byCat.has(k)) byCat.set(k, PRODUCTS.filter((p) => (Array.isArray(cat) ? cat.includes(p.cat) : p.cat === cat)));
    return byCat.get(k);
  };

  /** One package at (x, y, z), its base there, turned `ry`; `rx`/`rz` tip it. */
  function stamp(p, x, y, z, ry = 0, rx = 0, rz = 0) {
    const g = bodyOf(p).clone();
    _e.set(rx, ry, rz, 'YXZ');
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s);
    g.applyMatrix4(_m);
    list.push(g);
  }

  /** Line a shelf from its front-left corner (x, z) as seen from the front,
   * `len` long, whose front normal is (nx, nz): one kind of thing,
   * shoulder to shoulder, pushed back by its depth.  Returns the count. */
  function fill(cat, x, y, z, len, nx, nz, { gap = 0.012, jitter = 0.02, back = 0.02, rows = 1, pitch = 0 } = {}) {
    const yaw = Math.atan2(nx, nz);
    const dx = nz, dz = -nx;
    const P = pool(cat);
    let n = 0;
    for (let row = 0; row < rows; row++) {
      let t = q.range(0, gap);
      const p0 = q.pick(P);                  // a run of one thing, then another
      let run = q.int(2, 6), p = p0;
      while (true) {
        if (run-- <= 0) { p = q.pick(P); run = q.int(2, 6); }
        const w = widthOf(p);
        if (t + w > len) break;
        const cx = t + w / 2;
        const d = back + depthOf(p) / 2 + row * (pitch || depthOf(p) + 0.01) + q.range(0, jitter);
        stamp(p, x + dx * cx - nx * d, y, z + dz * cx - nz * d, yaw + q.range(-0.06, 0.06));
        t += w + gap;
        n++;
      }
    }
    return n;
  }

  /** Jumble `n` things over a top w x d from its corner (x0, z0): bags lie
   * and lean, boxes stand askew, a second layer here and there. */
  function heap(cat, x0, y, z0, w, d, n, { lay = 0.5, layers = 2 } = {}) {
    const P = pool(cat);
    for (let i = 0; i < n; i++) {
      const p = q.pick(P);
      const pw = widthOf(p), pd = depthOf(p);
      const x = x0 + q.range(pw / 2, Math.max(pw / 2, w - pw / 2));
      const z = z0 + q.range(pd / 2, Math.max(pd / 2, d - pd / 2));
      const layer = q.next() < 0.35 && layers > 1 ? 1 : 0;
      if (p.kind === 'bag' && q.next() < lay) {
        // lying on its back, tipped up a little, its face up
        stamp(p, x, y + layer * 0.07 + p.d * 0.5, z + p.h * 0.45, q.range(-0.5, 0.5), -Math.PI / 2 + q.range(0.15, 0.5));
      } else {
        stamp(p, x, y + layer * (p.kind === 'bag' ? 0.05 : 0.1), z, q.range(-0.6, 0.6), 0, q.range(-0.08, 0.08));
      }
    }
  }

  /** The mesh of everything stamped so far (one draw call). */
  function build() {
    if (!list.length) return null;
    const mat = new THREE.MeshBasicMaterial({ map: prodPage(), vertexColors: true });
    const mesh = new THREE.Mesh(mergeGeometries(list), mat);
    mesh.userData.detail = true;
    mesh.userData.noOutline = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  return { stamp, fill, heap, build, pool, q, count: () => list.length };
}
