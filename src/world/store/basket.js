import * as THREE from 'three';
import { makePainter } from './painter.js';
import { productGeometry } from './products.js';

/* ------------------------------------------------------------------ *
 * The shopping basket (M3c): the one on top of the stack by the door, and
 * the one you carry, low in the left of the view with what you picked
 * stacking up inside it.
 *
 * What you carry is drawn "on top": its depth is squeezed into the nearest
 * sliver of the depth range, so it never sinks into a shelf you stand
 * against, yet it still writes depth and the ink pass still outlines it.
 * ------------------------------------------------------------------ */

const BLUE = 0x2f6fb6, DARK = 0x24558e, RIM = 0x5a92d6;
export const BASKET = { w: 0.46, d: 0.32, h: 0.26 };

/** Make a material draw over the world (see above); returns it. */
export function onTop(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include project_vertex',
      '#include project_vertex\n  gl_Position.z = mix(-gl_Position.w, gl_Position.z, 0.02);');
  };
  mat.customProgramCacheKey = () => 'onTop';
  return mat;
}

/**
 * Paint a basket into painter `p`, the middle of its floor at (ox, oy, oz),
 * long side along x.  Its sides flare out toward the rim, as a real one's
 * do, which is what lets a stack nest and show every rim.
 */
const FLARE = 0.035;
export function paintBasket(p, ox = 0, oy = 0, oz = 0) {
  const { w, d, h } = BASKET;
  const shade = [0.8, 0.76, 1, 0.6, 0.86, 0.84], t = 0.012, a = Math.atan2(FLARE, h);
  // the floor, the size of the sides' foot
  p.box(ox - w / 2 + FLARE, ox + w / 2 - FLARE, oy, oy + 0.015, oz - d / 2 + FLARE, oz + d / 2 - FLARE, DARK, { shade });
  /* each side, in its own terms: `u` along it, `v` up it; a piece from
   * (u0, v0) to (u1, v1) is placed on the leaning side */
  const sides = [
    { n: [0, 1], along: [1, 0], half: w / 2, reach: d / 2, rot: { rx: a } },
    { n: [0, -1], along: [1, 0], half: w / 2, reach: d / 2, rot: { rx: -a } },
    { n: [1, 0], along: [0, 1], half: d / 2, reach: w / 2, rot: { rz: -a } },
    { n: [-1, 0], along: [0, 1], half: d / 2, reach: w / 2, rot: { rz: a } },
  ];
  for (const sd of sides) {
    const piece = (u0, u1, v0, v1, color) => {
      const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2, out = sd.reach - FLARE + (FLARE * vc) / h - t / 2;
      const cx = ox + sd.along[0] * uc + sd.n[0] * out, cz = oz + sd.along[1] * uc + sd.n[1] * out;
      const hu = (u1 - u0) / 2, hv = (v1 - v0) / 2;
      const [hx, hz] = sd.along[0] ? [hu, t / 2] : [t / 2, hu];
      p.box(cx - hx, cx + hx, oy + vc - hv, oy + vc + hv, cz - hz, cz + hz, color, { shade, ...sd.rot });
    };
    const L = sd.half - FLARE * 0.5;
    piece(-L, L, 0, 0.05, BLUE);                                // the foot
    piece(-sd.half, sd.half, h - 0.035, h, RIM);                // the rim, a lighter blue
    piece(-L, L, h * 0.55 - 0.012, h * 0.55 + 0.012, BLUE);     // the rail
    const n = Math.round((2 * L) / 0.05);
    for (let k = 1; k < n; k++) { const u = -L + (k * 2 * L) / n; piece(u - 0.007, u + 0.007, 0.05, h - 0.035, BLUE); }
  }
  // the two handles, folded down over the long sides' rims
  for (const sz of [-1, 1]) {
    const z = oz + sz * (d / 2 + 0.01);
    p.box(ox - w / 2 + 0.1, ox + w / 2 - 0.1, oy + h - 0.03, oy + h - 0.005, z - 0.008, z + 0.008, DARK, { shade });
    for (const x of [ox - w / 2 + 0.1, ox + w / 2 - 0.1]) p.box(x - 0.012, x + 0.012, oy + h - 0.04, oy + h - 0.005, z - 0.01, z + 0.01, DARK, { shade });
  }
}

/** A basket on its own, its origin at the middle of its floor. */
export function basketModel(lit) {
  const p = makePainter();
  paintBasket(p);
  const g = new THREE.Group();
  p.build(g, lit, { name: 'basket' });
  return g;
}

/**
 * A stack of baskets on its dolly (M3d): nested, each a few centimetres
 * higher and a touch off line, so every rim and handle shows -- the way a
 * konbini's stack by the door reads at a glance.  Paints `n` into `p`; returns
 * where the next (the one you take, drawn on its own) sits.
 */
export const NEST = 0.06;
export function paintBasketStack(p, x, z, n, sign) {
  // the dolly: a low grey tray on four castors
  p.box(x - 0.27, x + 0.27, 0.05, 0.075, z - 0.2, z + 0.2, 0x8a8e98);
  p.box(x - 0.27, x + 0.27, 0.075, 0.1, z - 0.2, z - 0.18, 0x6a6e78);
  p.box(x - 0.27, x + 0.27, 0.075, 0.1, z + 0.18, z + 0.2, 0x6a6e78);
  for (const [dx, dz] of [[-0.22, -0.15], [0.22, -0.15], [-0.22, 0.15], [0.22, 0.15]]) p.cyl(x + dx, 0.0, z + dz, 0.025, 0.05, 0x2a2a30, 8);
  for (let k = 0; k < n; k++) paintBasket(p, x + (k % 2 ? 0.008 : -0.004), 0.1 + k * NEST, z + (k % 2 ? -0.004 : 0.004));
  // a POP card on a stalk: お買い物かご / BASKETS
  if (sign) {
    // at the dolly's corner, the card read from the door and from the shop
    p.box(x + 0.255, x + 0.27, 0.075, 0.92, z - 0.2, z - 0.185, 0xc8ccd4);
    p.quad(sign, x + 0.262, 0.99, z - 0.18, 0.3, 0.15);
    p.quad(sign, x + 0.262, 0.99, z - 0.205, 0.3, 0.15, { ry: Math.PI });
  }
  return { x: x + (n % 2 ? 0.008 : -0.004), y: 0.1 + n * NEST, z: z + (n % 2 ? -0.004 : 0.004) };
}

/**
 * Lay `ids` into the basket: rows along its length, layers upward; tall
 * things lie down.  Returns a local matrix per item (at most `max`).
 */
const _bb = new THREE.Box3(), _m = new THREE.Matrix4(), _c = new THREE.Vector3();
export function packBasket(ids, max) {
  const out = [];
  const inner = { x0: -BASKET.w / 2 + 0.03, x1: BASKET.w / 2 - 0.03, z0: -BASKET.d / 2 + 0.03, z1: BASKET.d / 2 - 0.03 };
  let x = inner.x0, z = inner.z0, y = 0.016, rowD = 0, layerH = 0;
  for (const id of ids.slice(0, max)) {
    const g = productGeometry(id);
    const bb = g.boundingBox;
    const size = bb.getSize(_c);
    const lie = size.y > 0.14;
    _m.makeRotationZ(lie ? Math.PI / 2 : 0);
    _bb.copy(bb).applyMatrix4(_m);
    const sx = _bb.max.x - _bb.min.x, sz = _bb.max.z - _bb.min.z, sy = _bb.max.y - _bb.min.y;
    if (x + sx > inner.x1 + 0.01) { x = inner.x0; z += rowD + 0.01; rowD = 0; }
    if (z + sz > inner.z1 + 0.02) { z = inner.z0; x = inner.x0; y += layerH + 0.004; layerH = 0; }
    const cx = x + sx / 2, cz = z + sz / 2;
    const m = _m.clone();
    m.setPosition(cx - (_bb.min.x + _bb.max.x) / 2, y - _bb.min.y, cz - (_bb.min.z + _bb.max.z) / 2);
    out.push(m);
    x += sx + 0.008; rowD = Math.max(rowD, sz); layerH = Math.max(layerH, sy);
  }
  return out;
}
