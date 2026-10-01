import * as THREE from 'three';
import { bake, trs } from '../../core/util.js';
import { PRODUCT } from '../../data/catalog.js';
import { labelAtlas } from './labels.js';
import { sidesOf } from './seen.js';

/* ------------------------------------------------------------------ *
 * Products from their mesh recipes (SPEC 7; M3b).
 *
 * Each product is one geometry: its parts merged, each part hand-shaded
 * through vertex colours like the room (store/painter.js), and its label
 * mapped from the atlas (store/labels.js) onto the front, round the
 * sides (bottles, cups), or on top (bento, trays, bread).  Everything
 * else reads the atlas's white cell, so its vertex colour shows.
 *
 * Front is +z, the base sits at y 0.  The whole store's stock is a few
 * meshes, one a label page (makeStock).
 * ------------------------------------------------------------------ */

const col = new THREE.Color();
const shadeOf = (nx, ny, nz) => (ny > 0.5 ? 1.0 : ny < -0.5 ? 0.72 : 0.84 + 0.12 * Math.max(0, nz) + 0.04 * nx);

/** Paint a part: vertex colours by normal, and UVs into `cell` by `mode`
 *  ('front', 'wrap', 'top', or null for none). */
function paint(geo, color, mode, L, W) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const n = pos.count;
  const src = geo.attributes.uv;
  const uv = new Float32Array(n * 2), cc = new Float32Array(n * 3);
  const sx = Math.max(1e-6, bb.max.x - bb.min.x), sy = Math.max(1e-6, bb.max.y - bb.min.y), sz = Math.max(1e-6, bb.max.z - bb.min.z);
  for (let i = 0; i < n; i++) {
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    let u = null, v = null;
    if (mode === 'front' && nz > 0.35) { u = (pos.getX(i) - bb.min.x) / sx; v = (pos.getY(i) - bb.min.y) / sy; }
    else if (mode === 'top' && ny > 0.5) { u = (pos.getX(i) - bb.min.x) / sx; v = 1 - (pos.getZ(i) - bb.min.z) / sz; }
    else if (mode === 'wrap' && Math.abs(ny) < 0.6 && src) { u = src.getX(i); v = src.getY(i); }
    const labelled = u !== null, R = labelled ? L : W;
    if (u === null) { u = 0.5; v = 0.5; }
    uv[i * 2] = R[0] + u * (R[2] - R[0]);
    uv[i * 2 + 1] = R[1] + v * (R[3] - R[1]);
    col.set(labelled ? 0xffffff : color);
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

/* (the product being built: its label's cell and its page's white cell, set by productGeometry) */
let LABEL = null, BLANK = null;
const part = (geo, matrix, color, mode = null, cell = null) => ({ geometry: paint(geo, color, mode, cell === null ? BLANK : LABEL, BLANK), matrix });
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
  const p = PRODUCT[id], m = p.mesh, cell = 1;       // (any part given `cell` wears the label)
  LABEL = labelAtlas().rect(id); BLANK = labelAtlas().white(id);
  const P = [];
  const body = m.body, band = m.band;
  switch (m.shape) {
    case 'onigiri':
      P.push(part(prism(tri(0.1, 0.092), 0.036), null, body, 'front', cell)); break;
    case 'sandwich': case 'fruitsando': {
      /* every sando (Tan's photos): a wedge.  From the side a right
       * triangle (the back upright, the base flat), from the front the tall
       * slanted cut face, fruit set in cream between the two slices, two
       * halves side by side in the pack.  The front picture is labels.js. */
      const d = 0.075, h = 0.12, w = 0.106;
      const side = new THREE.Shape();
      side.moveTo(-d / 2, 0); side.lineTo(d / 2, 0); side.lineTo(-d / 2, h); side.closePath();
      const g = prism(side, w, 0.003);
      g.rotateY(-Q);                          // the profile's depth runs to the front (+z), the halves across (x)
      P.push(part(g, null, 0xf4ecda, 'front', cell));
      break;
    }
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
    case 'bag': {
      const k = m.big ? 1.35 : 1;          // a party-size or multi-pack bag
      P.push(part(ball(0.16 * k, 0.2 * k, 0.06 * k, 14, 10), trs(0, 0.105 * k, 0), body, 'front', cell));
      for (const y of [0.01, 0.2]) P.push(part(new THREE.BoxGeometry(0.15 * k, 0.018, 0.012 * k), trs(0, y * k, 0), band)); break;
    }
    case 'slimbox':
      P.push(part(new THREE.BoxGeometry(0.065, 0.16, 0.022), trs(0, 0.08, 0), body, 'front', cell)); break;
    case 'smallbox': {
      const [w, h, d] = [m.w ?? 0.1, m.h ?? 0.075, m.d ?? 0.05];
      P.push(part(new THREE.BoxGeometry(w, h, d), trs(0, h / 2, 0), body, 'front', cell)); break;
    }
    case 'pouch':
      P.push(part(new THREE.BoxGeometry(0.1, 0.14, 0.018), trs(0, 0.07, 0), body, 'front', cell));
      P.push(part(new THREE.BoxGeometry(0.1, 0.012, 0.02), trs(0, 0.146, 0), band)); break;
    case 'cupnoodle': {
      const k = m.small ? 0.72 : 1;
      P.push(part(cylG(0.055 * k, 0.044 * k, 0.1 * k), trs(0, 0.05 * k, 0), body, 'wrap', cell));
      P.push(part(cylG(0.057 * k, 0.057 * k, 0.004), trs(0, 0.1 * k + 0.002, 0), 0xe8e2d0)); break;
    }
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
      if (m.big) P.push(part(new THREE.BoxGeometry(0.24, 0.09, 0.12), trs(0, 0.045, 0), body, 'front', cell));
      else P.push(part(new THREE.BoxGeometry(0.1, 0.05, 0.06), trs(0, 0.025, 0), body, 'front', cell));
      break;
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
    case 'wafer':
      // the wafer-sandwich ice in its wrapper: a flat slab, long side across, crimped at both ends
      P.push(part(new THREE.BoxGeometry(0.124, 0.068, 0.028), trs(0, 0.036, 0), body, 'front', cell));
      for (const x of [-0.066, 0.066]) P.push(part(new THREE.BoxGeometry(0.01, 0.072, 0.01), trs(x, 0.036, 0), band));
      break;
    case 'multipack':
      P.push(part(new THREE.BoxGeometry(0.2, 0.06, 0.14), trs(0, 0.03, 0), body, 'front', cell)); break;
    case 'icebag':
      P.push(part(ball(0.16, 0.06, 0.22, 12, 8), trs(0, 0.03, 0), 0xe8f4fa, 'top', cell)); break;
    case 'fruitcup':
      P.push(part(cylG(0.045, 0.036, 0.1), trs(0, 0.05, 0), 0xe8f0f4, 'wrap', cell));
      P.push(part(cylG(0.047, 0.047, 0.006), trs(0, 0.103, 0), 0xf2f2f2)); break;
    /* ---- M3d ---- */
    case 'box':
      P.push(part(new THREE.BoxGeometry(m.w, m.h, m.d), trs(0, m.h / 2, 0), body, 'front', cell)); break;
    case 'bar':
      P.push(part(new THREE.BoxGeometry(0.085, 0.16, 0.012), trs(0, 0.08, 0), body, 'front', cell)); break;
    case 'tin':
      P.push(part(cylG(0.042, 0.042, 0.045), trs(0, 0.0225, 0), 0xd8dce4, 'wrap', cell));
      P.push(part(cylG(0.04, 0.042, 0.004), trs(0, 0.047, 0), 0xc8ccd4)); break;
    case 'minibottle':
      P.push(part(cylG(0.022, 0.022, 0.075), trs(0, 0.0375, 0), body, 'wrap', cell));
      P.push(part(cylG(0.011, 0.022, 0.02, 10), trs(0, 0.085, 0), body));
      P.push(part(cylG(0.012, 0.012, 0.016, 10), trs(0, 0.103, 0), 0xd8a830)); break;
    case 'card':
      // a hanging card, its goods in a clear bubble on the front
      P.push(part(new THREE.BoxGeometry(0.1, 0.16, 0.004), trs(0, 0.08, 0), 0xffffff, 'front', cell));
      P.push(part(new THREE.BoxGeometry(0.06, 0.06, 0.016), trs(0, 0.07, 0.01), 0xdce8f0)); break;
    case 'tube':
      // stood on its cap, flat, the label on the front
      P.push(part(cylG(0.016, 0.016, 0.02, 10), trs(0, 0.01, 0), band));
      P.push(part(cylG(0.026, 0.026, 0.15, 14), trs(0, 0.095, 0, 0, 0, 0, 1, 1, 0.5), body, 'front', cell)); break;
    case 'pump': {
      const k = m.small ? 0.68 : 1;
      P.push(part(cylG(0.032 * k, 0.032 * k, 0.13 * k), trs(0, 0.065 * k, 0), body, 'front', cell));
      P.push(part(cylG(0.012 * k, 0.03 * k, 0.02 * k, 12), trs(0, 0.14 * k, 0), body));
      P.push(part(cylG(0.009 * k, 0.009 * k, 0.03 * k, 10), trs(0, 0.165 * k, 0), band));
      P.push(part(new THREE.BoxGeometry(0.04 * k, 0.012 * k, 0.014 * k), trs(0.014 * k, 0.183 * k, 0), band)); break;
    }
    case 'compact':
      P.push(part(new THREE.BoxGeometry(0.08, 0.1, 0.028), trs(0, 0.05, 0), body, 'front', cell)); break;
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

/* ------------------------------------------------------------------ *
 * The stock, batched (M3d).
 *
 * About 370 products as an InstancedMesh each would be about 370 draws,
 * and the store is seen through the glass from the famous views.  So every
 * unit is baked into one mesh per label page (a few draws for the whole
 * store), and each keeps its own vertex range: hiding a unit, or sliding
 * the next one forward, rewrites just that range.
 * ------------------------------------------------------------------ */

const _o = new THREE.Object3D(), _fwd = new THREE.Vector3(), _v = new THREE.Vector3();
/** A unit's matrix in the interior's frame: at its place, or `slide` metres back along its depth. */
export function unitMatrix(u, out = new THREE.Matrix4(), slide = 0) {
  _o.position.set(u.x, u.y, u.z);
  _o.rotation.set(u.rx ?? 0, u.ry, 0, 'YXZ');
  if (slide) _o.position.addScaledVector(_fwd.set(Math.sin(u.ry), 0, Math.cos(u.ry)), -slide);
  _o.scale.setScalar(1);
  _o.updateMatrix();
  return out.copy(_o.matrix);
}
const _m4 = new THREE.Matrix4();
/**
 * Draw a unit at its place, `slide` metres back along its own depth (the
 * next one coming forward, M3c), or hidden (its vertices folded to a point).
 */
export function placeUnit(u, slide = 0, hidden = false) {
  const src = productGeometry(u.id).attributes.position, dst = u.pos, a = dst.array;
  unitMatrix(u, _m4, slide);
  for (let i = 0; i < u.n; i++) {
    if (hidden) _v.set(u.x, u.y, u.z); else _v.fromBufferAttribute(src, i).applyMatrix4(_m4);
    const k = (u.start + i) * 3;
    a[k] = _v.x; a[k + 1] = _v.y; a[k + 2] = _v.z;
  }
  dst.addUpdateRange(u.start * 3, u.n * 3);
  dst.needsUpdate = true;
}

/**
 * The store's stock: `add(id, x, y, z, ry, count)` places a unit (the one on
 * show; `count` behind it); `build(group, lit)` bakes the pages.  Returns the
 * units, each { id, x, y, z, ry, rx, count, slot, backs, page, start, n, pos, mat }.
 */
export function makeStock() {
  const units = [];
  let front = null;
  return {
    units,
    /** The shelf run being filled (planogram.js sets it): recorded on each unit. */
    slot: null,
    /** The featured spot being filled (Tan's konbini), or null: recorded on each unit. */
    feature: null,
    add(id, x, y, z, ry = 0, count = 1, rx = 0) {
      const u = { id, x, y, z, ry, rx, count, slot: this.slot, backs: [], feature: this.feature ?? null };
      // a unit with no count of its own is drawn behind the last one that has
      // one (the rows receding, the layer piled on top): it belongs to it
      if (count === 0 && front?.id === id) { front.backs.push(u); u.front = front; } else front = u;
      units.push(u);
      return u;
    },
    /**
     * `S`: what was ever seen (store/seen.js), or null for everything.  `ids` (dev, the seen tool):
     * every mesh keeps, per vertex, its unit and its side (userData.ids), unindexed.
     */
    build(group, lit, S = null, { ids = false } = {}) {
      const A = labelAtlas();
      const pages = A.pages.map((page) => {
        const mat = page.adopt(new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }));
        lit.push(mat);
        return { page, mat, live: [], still: [] };
      });
      units.forEach((u, i) => {
        const pg = pages[A.cellOf[u.id].page];
        u.mat = pg.mat; u.page = pg.page;
        u.sides = u.feature ? 63 : sidesOf(S, i);
        if (u.sides) (u.feature ? pg.live : pg.still).push(u);
      });
      const add = (geo, mat, name) => {
        geo.computeBoundingSphere();
        geo.computeBoundingBox();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = name;
        mesh.castShadow = mesh.receiveShadow = false;
        group.add(mesh);
        return mesh;
      };
      pages.forEach((pg, i) => {
        /* what can be taken (the featured things and what stands behind them): whole, its vertices
         * its own, rewritten when one is taken or slides forward (placeUnit) */
        if (pg.live.length) {
          let n = 0;
          for (const u of pg.live) { u.n = productGeometry(u.id).attributes.position.count; u.start = n; n += u.n; }
          const pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
          pos.setUsage(THREE.DynamicDrawUsage);
          const uv = new Float32Array(n * 2), col = new Uint8Array(n * 3);
          const unit = ids ? new Uint32Array(n) : null, cls = ids ? new Uint8Array(n) : null;
          for (const u of pg.live) {
            const g = productGeometry(u.id), su = g.attributes.uv.array, sc = g.attributes.color.array;
            uv.set(su, u.start * 2);
            for (let k = 0; k < u.n * 3; k++) col[u.start * 3 + k] = Math.round(Math.min(1, sc[k]) * 255);
            if (ids) { const side = sideOfTriangles(u.id), k = units.indexOf(u); for (let v = 0; v < u.n; v++) { unit[u.start + v] = k; cls[u.start + v] = side[(v / 3) | 0]; } }
            u.pos = pos;
            placeUnit(u);
          }
          pos.clearUpdateRanges();
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', pos);
          geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
          geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
          const mesh = add(geo, pg.mat, 'stock-live-' + i);
          mesh.userData.dynamic = true;
          if (ids) mesh.userData.ids = { unit, cls };
        }
        /* the rest stands where it is for good: only the sides ever seen, each vertex once, and the
         * arrays let go once the GPU has them */
        if (pg.still.length) {
          let n = 0, ni = 0;
          for (const u of pg.still) { const s = shapeOf(u.id, u.sides, !ids); n += s.n; ni += s.idx ? s.idx.length : 0; }
          const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Uint8Array(n * 3);
          const idx = ids ? null : new Uint32Array(ni);
          const unit = ids ? new Uint32Array(n) : null, cls = ids ? new Uint8Array(n) : null;
          let v0 = 0, i0 = 0;
          units.forEach((u, k) => {
            if (u.feature || !u.sides || u.page !== pg.page) return;
            const s = shapeOf(u.id, u.sides, !ids);
            unitMatrix(u, _m4);
            for (let v = 0; v < s.n; v++) {
              _v.fromArray(s.pos, v * 3).applyMatrix4(_m4);
              pos[(v0 + v) * 3] = _v.x; pos[(v0 + v) * 3 + 1] = _v.y; pos[(v0 + v) * 3 + 2] = _v.z;
            }
            uv.set(s.uv, v0 * 2); col.set(s.col, v0 * 3);
            if (idx) { for (let j = 0; j < s.idx.length; j++) idx[i0 + j] = v0 + s.idx[j]; i0 += s.idx.length; }
            if (ids) { unit.fill(k, v0, v0 + s.n); cls.set(s.cls, v0); }
            v0 += s.n;
          });
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
          geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
          geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
          if (idx) geo.setIndex(new THREE.BufferAttribute(idx, 1));
          const mesh = add(geo, pg.mat, 'stock-page-' + i);
          mesh.userData.keep = true;                 // (never re-baked by the town's static batching)
          if (ids) mesh.userData.ids = { unit, cls };
          else for (const a of [...Object.values(geo.attributes), geo.index]) a.onUpload(letGo);
        }
      });
      shapes.clear();
      return units;
    },
  };
}

/** (BufferAttribute.onUpload) The GPU has it: the copy here is let go.  `bytes` remembers its size (dev). */
function letGo() { this.bytes = this.array.byteLength; this.array = null; }

/** Each triangle of a product's geometry, by the way it faces in the product's own frame:
 *  0 front (+z), 1 back, 2 +x, 3 -x, 4 top, 5 bottom (store/seen.js: a unit's sides ever seen). */
const sideCache = new Map();
function sideOfTriangles(id) {
  if (sideCache.has(id)) return sideCache.get(id);
  const P = productGeometry(id).attributes.position.array, n = P.length / 9, out = new Uint8Array(n);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < n; t++) {
    a.fromArray(P, t * 9); b.fromArray(P, t * 9 + 3).sub(a); c.fromArray(P, t * 9 + 6).sub(a);
    b.cross(c);                                  // (front faces wind counter-clockwise: this points out)
    const ax = Math.abs(b.x), ay = Math.abs(b.y), az = Math.abs(b.z);
    out[t] = az >= ax && az >= ay ? (b.z >= 0 ? 0 : 1) : ax >= ay ? (b.x >= 0 ? 2 : 3) : (b.y >= 0 ? 4 : 5);
  }
  sideCache.set(id, out);
  return out;
}

/** A product's triangles on the sides in `mask`, in its own frame: { n, pos, uv, col } and, `indexed`,
 *  each distinct vertex once with `idx`; otherwise `cls`, each vertex's side. */
const shapes = new Map();
function shapeOf(id, mask, indexed) {
  const key = `${id}|${mask}|${indexed}`;
  if (shapes.has(key)) return shapes.get(key);
  const g = productGeometry(id), P = g.attributes.position.array, U = g.attributes.uv.array, C = g.attributes.color.array;
  const side = sideOfTriangles(id);
  const pos = [], uv = [], col = [], idx = [], cls = [];
  const at = new Map();
  for (let t = 0; t < side.length; t++) {
    if (!(mask & (1 << side[t]))) continue;
    for (let j = 0; j < 3; j++) {
      const v = t * 3 + j;
      const c = [0, 1, 2].map((k) => Math.round(Math.min(1, C[v * 3 + k]) * 255));
      const k2 = indexed ? `${P[v * 3]},${P[v * 3 + 1]},${P[v * 3 + 2]},${U[v * 2]},${U[v * 2 + 1]},${c}` : null;
      let w = indexed ? at.get(k2) : undefined;
      if (w === undefined) {
        w = pos.length / 3;
        if (indexed) at.set(k2, w);
        pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); uv.push(U[v * 2], U[v * 2 + 1]); col.push(c[0], c[1], c[2]);
        cls.push(side[t]);
      }
      idx.push(w);
    }
  }
  const s = { n: pos.length / 3, pos: new Float32Array(pos), uv: new Float32Array(uv), col: new Uint8Array(col), idx: indexed ? new Uint32Array(idx) : null, cls: indexed ? null : new Uint8Array(cls) };
  shapes.set(key, s);
  return s;
}
