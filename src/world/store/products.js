import * as THREE from 'three';
import { bake, trs } from '../../core/util.js';
import { PRODUCT } from '../../data/catalog.js';
import { labelAtlas, cellRect, WHITE } from './labels.js';

/* ------------------------------------------------------------------ *
 * Products from their mesh recipes (SPEC 7; M3b).
 *
 * Each product is one geometry: its parts merged, each part hand-shaded
 * through vertex colours like the room (store/painter.js), and its label
 * mapped from the atlas (store/labels.js) onto the front, round the
 * sides (bottles, cups), or on top (bento, trays, bread).  Everything
 * else reads the atlas's white cell, so its vertex colour shows.
 *
 * Front is +z, the base sits at y 0.  One InstancedMesh per product for
 * the whole store (makeStock), all sharing one material.
 * ------------------------------------------------------------------ */

const col = new THREE.Color();
const shadeOf = (nx, ny, nz) => (ny > 0.5 ? 1.0 : ny < -0.5 ? 0.72 : 0.84 + 0.12 * Math.max(0, nz) + 0.04 * nx);

/** Paint a part: vertex colours by normal, and UVs into `cell` by `mode`
 *  ('front', 'wrap', 'top', or null for none). */
function paint(geo, color, mode, cell) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const n = pos.count;
  const src = geo.attributes.uv;
  const uv = new Float32Array(n * 2), cc = new Float32Array(n * 3);
  const L = cellRect(cell ?? WHITE), W = cellRect(WHITE);
  const sx = Math.max(1e-6, bb.max.x - bb.min.x), sy = Math.max(1e-6, bb.max.y - bb.min.y), sz = Math.max(1e-6, bb.max.z - bb.min.z);
  for (let i = 0; i < n; i++) {
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    let u = null, v = null;
    if (mode === 'front' && nz > 0.35) { u = (pos.getX(i) - bb.min.x) / sx; v = (pos.getY(i) - bb.min.y) / sy; }
    else if (mode === 'top' && ny > 0.5) { u = (pos.getX(i) - bb.min.x) / sx; v = 1 - (pos.getZ(i) - bb.min.z) / sz; }
    else if (mode === 'wrap' && Math.abs(ny) < 0.6 && src) { u = src.getX(i); v = src.getY(i); }
    const R = u === null ? W : L;
    if (u === null) { u = 0.5; v = 0.5; }
    uv[i * 2] = R[0] + u * (R[2] - R[0]);
    uv[i * 2 + 1] = R[1] + v * (R[3] - R[1]);
    col.set(u !== null && R === L ? 0xffffff : color);
    const k = shadeOf(nx, ny, nz);
    cc[i * 3] = col.r * k; cc[i * 3 + 1] = col.g * k; cc[i * 3 + 2] = col.b * k;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', pos);
  out.setAttribute('normal', nor);
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  return out;
}

const part = (geo, matrix, color, mode = null, cell = null) => ({ geometry: paint(geo, color, mode, cell), matrix });
/** A shape extruded from a 2D outline, `d` deep, centred on z, base at y 0. */
function prism(shape, d, bevel = 0.004) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: d - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -(d - bevel * 2) / 2);
  return g;
}
const tri = (w, h, r = 0.012) => {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, 0); s.lineTo(w / 2 - r, 0); s.quadraticCurveTo(w / 2, 0, w / 2 - r * 0.6, r * 0.9);
  s.lineTo(r * 0.6, h - r * 0.9); s.quadraticCurveTo(0, h, -r * 0.6, h - r * 0.9);
  s.lineTo(-w / 2 + r * 0.6, r * 0.9); s.quadraticCurveTo(-w / 2, 0, -w / 2 + r, 0);
  return s;
};
const ball = (sx, sy, sz, ws = 12, hs = 9) => { const g = new THREE.SphereGeometry(0.5, ws, hs); g.scale(sx, sy, sz); return g; };
const cylG = (rt, rb, h, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg);
const Q = Math.PI / 2;

/** Build one product's geometry (cached). */
const cache = new Map();
export function productGeometry(id) {
  if (cache.has(id)) return cache.get(id);
  const p = PRODUCT[id], m = p.mesh, cell = labelAtlas().cellOf[id].cell;
  const P = [];
  const body = m.body, band = m.band;
  switch (m.shape) {
    case 'onigiri':
      P.push(part(prism(tri(0.1, 0.092), 0.036), null, body, 'front', cell)); break;
    case 'sandwich':
      P.push(part(prism(tri(0.125, 0.105, 0.01), 0.055), null, 0xf7ecd2, 'front', cell)); break;
    case 'bento':
      P.push(part(new THREE.BoxGeometry(0.2, 0.035, 0.15), trs(0, 0.0175, 0), body));
      P.push(part(new THREE.BoxGeometry(0.196, 0.018, 0.146), trs(0, 0.044, 0), 0xffffff, 'top', cell)); break;
    case 'cup':
      P.push(part(cylG(m.r, m.r * 0.85, m.h), trs(0, m.h / 2, 0), body, 'wrap', cell));
      P.push(part(cylG(m.r * 1.04, m.r * 1.04, 0.006), trs(0, m.h + 0.003, 0), 0xf6f6f2)); break;
    case 'pudding':
      P.push(part(cylG(0.03, 0.042, 0.06), trs(0, 0.03, 0), body, 'wrap', cell));
      P.push(part(cylG(0.043, 0.043, 0.005), trs(0, 0.062, 0), 0x8a4a2a)); break;
    case 'pet':
      P.push(part(cylG(0.033, 0.033, 0.16), trs(0, 0.08, 0), body, 'wrap', cell));
      P.push(part(cylG(0.013, 0.033, 0.04), trs(0, 0.18, 0), body));
      P.push(part(cylG(0.014, 0.014, 0.02), trs(0, 0.21, 0), band)); break;
    case 'can':
      P.push(part(cylG(0.03, 0.03, 0.11), trs(0, 0.055, 0), body, 'wrap', cell));
      P.push(part(cylG(0.026, 0.03, 0.01), trs(0, 0.115, 0), 0xc8ccd4)); break;
    case 'codd':
      P.push(part(cylG(0.028, 0.028, 0.12), trs(0, 0.06, 0), body, 'wrap', cell));
      P.push(part(cylG(0.018, 0.028, 0.04), trs(0, 0.14, 0), 0xbde4f2));
      P.push(part(ball(0.024, 0.024, 0.024, 8, 6), trs(0, 0.165, 0), 0x6ab8d8));
      P.push(part(cylG(0.016, 0.018, 0.03), trs(0, 0.19, 0), band)); break;
    case 'carton':
      P.push(part(new THREE.BoxGeometry(0.06, 0.11, 0.06), trs(0, 0.055, 0), body, 'front', cell));
      for (const s of [-1, 1]) P.push(part(new THREE.BoxGeometry(0.06, 0.004, 0.043), trs(0, 0.125, s * 0.015, s * 0.78, 0, 0), body));
      P.push(part(new THREE.BoxGeometry(0.06, 0.012, 0.004), trs(0, 0.14, 0), body)); break;
    case 'bag':
      P.push(part(ball(0.16, 0.2, 0.06, 14, 10), trs(0, 0.105, 0), body, 'front', cell));
      for (const y of [0.01, 0.2]) P.push(part(new THREE.BoxGeometry(0.15, 0.018, 0.012), trs(0, y, 0), band)); break;
    case 'slimbox':
      P.push(part(new THREE.BoxGeometry(0.065, 0.16, 0.022), trs(0, 0.08, 0), body, 'front', cell)); break;
    case 'smallbox':
      P.push(part(new THREE.BoxGeometry(0.1, 0.075, 0.05), trs(0, 0.0375, 0), body, 'front', cell)); break;
    case 'pouch':
      P.push(part(new THREE.BoxGeometry(0.1, 0.14, 0.018), trs(0, 0.07, 0), body, 'front', cell));
      P.push(part(new THREE.BoxGeometry(0.1, 0.012, 0.02), trs(0, 0.146, 0), band)); break;
    case 'cupnoodle':
      P.push(part(cylG(0.055, 0.044, 0.1), trs(0, 0.05, 0), body, 'wrap', cell));
      P.push(part(cylG(0.057, 0.057, 0.004), trs(0, 0.102, 0), 0xe8e2d0)); break;
    case 'tray':
      P.push(part(new THREE.BoxGeometry(0.15, 0.055, 0.13), trs(0, 0.0275, 0), body, 'top', cell)); break;
    case 'melonpan':
      P.push(part(ball(0.11, 0.07, 0.11, 14, 8), trs(0, 0.02, 0), body, 'top', cell)); break;
    case 'currypan':
      P.push(part(ball(0.13, 0.055, 0.085, 14, 8), trs(0, 0.027, 0), body, 'front', cell)); break;
    case 'cone':
      P.push(part(cylG(0.032, 0.006, 0.09, 12), trs(0, 0.045, 0), 0xd8a060, 'wrap', cell));
      P.push(part(ball(0.06, 0.06, 0.06, 10, 8), trs(0, 0.1, 0), body)); break;
    case 'umbrella':
      P.push(part(cylG(0.004, 0.035, 0.6, 10), trs(0, 0.4, 0), 0xe0ecf2));
      P.push(part(cylG(0.006, 0.006, 0.12), trs(0, 0.06, 0), band));
      P.push(part(new THREE.BoxGeometry(0.06, 0.012, 0.012), trs(0.025, 0.005, 0), band)); break;
    case 'tissue':
      P.push(part(new THREE.BoxGeometry(0.1, 0.05, 0.06), trs(0, 0.025, 0), body, 'front', cell)); break;
    case 'karaagebox':
      P.push(part(new THREE.BoxGeometry(0.09, 0.06, 0.05), trs(0, 0.03, 0), body, 'front', cell));
      for (let i = 0; i < 3; i++) P.push(part(ball(0.03, 0.022, 0.03, 8, 6), trs(-0.025 + i * 0.025, 0.066, 0), 0xd58a3a)); break;
    case 'bun':
      P.push(part(ball(0.09, 0.065, 0.09, 12, 8), trs(0, 0.025, 0), body)); break;
    case 'odencup':
      P.push(part(cylG(0.05, 0.042, 0.06), trs(0, 0.03, 0), body, 'wrap', cell));
      P.push(part(ball(0.035, 0.03, 0.03, 8, 6), trs(-0.015, 0.064, 0), 0xf6f2e0));
      P.push(part(cylG(0.02, 0.02, 0.018, 8), trs(0.018, 0.065, 0.008), 0xe8d8a8)); break;
    case 'coffeecup':
      P.push(part(cylG(0.04, 0.03, 0.11), trs(0, 0.055, 0), body, 'wrap', cell));
      P.push(part(cylG(0.042, 0.042, 0.012), trs(0, 0.114, 0), 0xf2f0ea)); break;
    /* ---- M3b.2 ---- */
    case 'pet2l':
      P.push(part(new THREE.BoxGeometry(0.1, 0.24, 0.1), trs(0, 0.12, 0), body, 'front', cell));
      P.push(part(cylG(0.016, 0.05, 0.05, 12), trs(0, 0.265, 0), body));
      P.push(part(cylG(0.017, 0.017, 0.022), trs(0, 0.3, 0), band)); break;
    case 'tallcan':
      P.push(part(cylG(0.033, 0.033, 0.16), trs(0, 0.08, 0), body, 'wrap', cell));
      P.push(part(cylG(0.028, 0.033, 0.012), trs(0, 0.166, 0), 0xc8ccd4)); break;
    case 'slimcan':
      P.push(part(cylG(0.026, 0.026, 0.14), trs(0, 0.07, 0), body, 'wrap', cell));
      P.push(part(cylG(0.022, 0.026, 0.01), trs(0, 0.145, 0), 0xc8ccd4)); break;
    case 'sixpack':
      P.push(part(new THREE.BoxGeometry(0.2, 0.125, 0.135), trs(0, 0.0625, 0), body, 'front', cell));
      for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) P.push(part(cylG(0.026, 0.03, 0.008, 10), trs(-0.066 + i * 0.066, 0.129, -0.033 + k * 0.066), 0xc8ccd4)); break;
    case 'milk1l':
      P.push(part(new THREE.BoxGeometry(0.07, 0.19, 0.07), trs(0, 0.095, 0), body, 'front', cell));
      for (const s2 of [-1, 1]) P.push(part(new THREE.BoxGeometry(0.07, 0.004, 0.05), trs(0, 0.205, s2 * 0.017, s2 * 0.78, 0, 0), body)); break;
    case 'sakecup':
      P.push(part(cylG(0.034, 0.031, 0.1), trs(0, 0.05, 0), body, 'wrap', cell));
      P.push(part(cylG(0.035, 0.035, 0.008), trs(0, 0.104, 0), 0xc8a040)); break;
    case 'whisky':
      P.push(part(new THREE.BoxGeometry(0.075, 0.12, 0.045), trs(0, 0.06, 0), body, 'front', cell));
      P.push(part(cylG(0.014, 0.03, 0.03), trs(0, 0.135, 0), body));
      P.push(part(cylG(0.015, 0.015, 0.03), trs(0, 0.165, 0), band)); break;
    case 'wine':
      P.push(part(cylG(0.037, 0.037, 0.2), trs(0, 0.1, 0), body, 'front', cell));
      P.push(part(cylG(0.014, 0.037, 0.05), trs(0, 0.225, 0), body));
      P.push(part(cylG(0.014, 0.014, 0.07), trs(0, 0.285, 0), 0x8a1a2a)); break;
    case 'fruitsando':
      P.push(part(prism(tri(0.12, 0.1, 0.01), 0.06), null, 0xfbf6ec, 'front', cell)); break;
    case 'rollcake':
      P.push(part(new THREE.BoxGeometry(0.09, 0.06, 0.09), trs(0, 0.03, 0), 0xf6f2ea, 'front', cell));
      P.push(part(cylG(0.035, 0.035, 0.07, 14), trs(0, 0.035, 0.005, 0, 0, Q), body)); break;
    case 'creampuff':
      P.push(part(new THREE.BoxGeometry(0.1, 0.03, 0.1), trs(0, 0.015, 0), 0xf6f2ea, 'front', cell));
      P.push(part(ball(0.085, 0.06, 0.085, 12, 8), trs(0, 0.05, 0), body)); break;
    case 'cakewedge':
      P.push(part(prism(tri(0.09, 0.05, 0.006), 0.07, 0.002), trs(0, 0, 0, -Q, 0, 0), body));
      P.push(part(new THREE.BoxGeometry(0.1, 0.012, 0.08), trs(0, 0.006, 0), 0xf6f2ea, 'front', cell)); break;
    case 'icecup':
      P.push(part(cylG(0.043, 0.038, 0.05), trs(0, 0.025, 0), 0xf6ecd0));
      P.push(part(cylG(0.045, 0.045, 0.008), trs(0, 0.054, 0), body, 'top', cell)); break;
    case 'icebar':
      P.push(part(new THREE.BoxGeometry(0.07, 0.16, 0.022), trs(0, 0.08, 0), body, 'front', cell)); break;
    case 'mochi':
      P.push(part(new THREE.BoxGeometry(0.11, 0.045, 0.07), trs(0, 0.0225, 0), body, 'top', cell)); break;
    case 'multipack':
      P.push(part(new THREE.BoxGeometry(0.2, 0.06, 0.14), trs(0, 0.03, 0), body, 'front', cell)); break;
    case 'icebag':
      P.push(part(ball(0.16, 0.06, 0.22, 12, 8), trs(0, 0.03, 0), 0xe8f4fa, 'top', cell)); break;
    case 'fruitcup':
      P.push(part(cylG(0.045, 0.036, 0.1), trs(0, 0.05, 0), 0xe8f0f4, 'wrap', cell));
      P.push(part(cylG(0.047, 0.047, 0.006), trs(0, 0.103, 0), 0xf2f2f2)); break;
    default:
      P.push(part(new THREE.BoxGeometry(0.08, 0.08, 0.08), trs(0, 0.04, 0), body, 'front', cell));
  }
  const g = bake(P.map((q) => ({ geometry: q.geometry, matrix: q.matrix ?? null })));
  g.computeBoundingBox();
  cache.set(id, g);
  return g;
}

/** A product's footprint on the shelf: width along the shelf, depth, height. */
export function footprint(id) {
  const bb = productGeometry(id).boundingBox;
  return { w: bb.max.x - bb.min.x, d: bb.max.z - bb.min.z, h: bb.max.y - bb.min.y };
}

/**
 * The store's stock: `add(id, x, y, z, ry, count)` places a unit (the one on
 * show; `count` behind it); `build(group, lit)` makes one InstancedMesh per
 * product.  Returns the units, each { id, mesh, index, x, y, z, count }.
 */
export function makeStock() {
  const units = [];
  const byId = new Map();
  const d = new THREE.Object3D();
  return {
    units,
    add(id, x, y, z, ry = 0, count = PRODUCT[id].unitsPerSlot, rx = 0) {
      const u = { id, x, y, z, ry, rx, count };
      units.push(u);
      (byId.get(id) ?? byId.set(id, []).get(id)).push(u);
      return u;
    },
    build(group, lit) {
      const A = labelAtlas();
      const mats = A.pages.map((tex) => {
        const m = new THREE.MeshBasicMaterial({ color: 0xffffff, map: tex, vertexColors: true });
        lit.push(m);
        return m;
      });
      for (const [id, list] of byId) {
        const inst = new THREE.InstancedMesh(productGeometry(id), mats[A.cellOf[id].page], list.length);
        list.forEach((u, i) => {
          d.position.set(u.x, u.y, u.z); d.rotation.set(u.rx ?? 0, u.ry, 0, 'YXZ'); d.updateMatrix();
          inst.setMatrixAt(i, d.matrix);
          u.mesh = inst; u.index = i;
        });
        inst.computeBoundingSphere();
        inst.name = 'stock-' + id;
        inst.castShadow = inst.receiveShadow = false;
        inst.userData.productId = id;
        group.add(inst);
      }
      return units;
    },
  };
}
