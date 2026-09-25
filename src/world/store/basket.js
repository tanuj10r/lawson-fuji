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

const BLUE = 0x2f6fb6, DARK = 0x24558e;
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

/** A basket, its origin at the middle of its floor, long side along x. */
export function basketModel(lit) {
  const p = makePainter();
  const { w, d, h } = BASKET;
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2, t = 0.012;
  const shade = [0.8, 0.76, 1, 0.6, 0.86, 0.84];
  // the floor, a little narrower (the sides flare)
  p.box(x0 + 0.02, x1 - 0.02, 0, 0.015, z0 + 0.02, z1 - 0.02, DARK, { shade });
  // the sides: a solid foot and rim, ribs between, a rail at half height
  for (const [a0, a1, b0, b1, along] of [[x0, x1, z0, z0 + t, 'x'], [x0, x1, z1 - t, z1, 'x'], [x0, x0 + t, z0, z1, 'z'], [x1 - t, x1, z0, z1, 'z']]) {
    p.box(a0, a1, 0, 0.05, b0, b1, BLUE, { shade });
    p.box(a0, a1, h - 0.03, h, b0, b1, BLUE, { shade });
    p.box(a0, a1, h * 0.55 - 0.012, h * 0.55 + 0.012, b0, b1, BLUE, { shade });
    const len = along === 'x' ? a1 - a0 : b1 - b0, n = Math.round(len / 0.05);
    for (let k = 1; k < n; k++) {
      const s = (along === 'x' ? a0 : b0) + (k * len) / n;
      if (along === 'x') p.box(s - 0.007, s + 0.007, 0.05, h - 0.03, b0, b1, BLUE, { shade });
      else p.box(a0, a1, 0.05, h - 0.03, s - 0.007, s + 0.007, BLUE, { shade });
    }
  }
  // the two handles, folded down along the long sides
  for (const z of [z0 - 0.012, z1 + 0.012]) {
    p.box(x0 + 0.1, x1 - 0.1, h - 0.035, h - 0.01, z - 0.008, z + 0.008, DARK, { shade });
    for (const x of [x0 + 0.1, x1 - 0.1]) p.box(x - 0.01, x + 0.01, h - 0.07, h - 0.01, z - 0.008, z + 0.008, DARK, { shade });
  }
  const g = new THREE.Group();
  p.build(g, lit, { name: 'basket' });
  return g;
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
