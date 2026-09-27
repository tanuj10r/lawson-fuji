import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Geometry for the shrine, in its own frame: x across the frontage (u),
 * z back from it (v), y up.  Parts are gathered per material (land/geo.js
 * makeParts) and baked into one mesh each.
 * ------------------------------------------------------------------ */

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

/** Move, turn and scale a geometry in place ({x,y,z,rx,ry,rz,sx,sy,sz}). */
export function xf(geo, o = {}) {
  _e.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0, o.order ?? 'XYZ');
  _q.setFromEuler(_e);
  _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
  _p.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  geo.applyMatrix4(_m.compose(_p, _q, _s));
  return geo;
}

export const boxG = (w, h, d, o) => xf(new THREE.BoxGeometry(w, h, d), o);
export const cylG = (rt, rb, h, seg, o) => xf(new THREE.CylinderGeometry(rt, rb, h, seg), o);
/** A box from its extents. */
export const ext = (x0, x1, y0, y1, z0, z1) => boxG(x1 - x0, y1 - y0, z1 - z0, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 });

/** A tube along points (ropes, the fox's tail). */
export function tubeG(pts, r, seg = 20, rad = 6) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, rad, false);
}

/** A tube whose radius follows `f(t)` (0..1 along it): a shimenawa, fat
 * in the middle and thin where it is tied. */
export function taperTube(pts, r, f, seg = 32, rad = 8) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, seg, r, rad, false);
  const p = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, c);
    const k = f(i / seg);
    for (let j = 0; j <= rad; j++) {
      const n = i * (rad + 1) + j;
      v.fromBufferAttribute(p, n).sub(c).multiplyScalar(k).add(c);
      p.setXYZ(n, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** A grid surface from a function (i across, j along) -> [x, y, z]. */
function gridG(ni, nj, fn, flip = false) {
  const pos = [], idx = [];
  for (let i = 0; i <= ni; i++) for (let j = 0; j <= nj; j++) pos.push(...fn(i / ni, j / nj));
  const at = (i, j) => i * (nj + 1) + j;
  for (let i = 0; i < ni; i++) {
    for (let j = 0; j < nj; j++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      if (flip) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A nagare-zukuri roof (流造): a gable whose front slope runs on, long and
 * concave, over the steps, and whose eaves lift a little at the corners.
 * Ridge along x.  Returns { top, under, hafu } geometries and `yAt(z)`, the
 * underside height at z (for the walls that meet it).
 *
 *   hw     half width (x)          zf, yf  front eave     zr, yr  ridge
 *   zb, yb back eave               t       thickness      sori    corner lift
 */
export function nagareRoof({ hw, zf, yf, zr, yr, zb, yb, t = 0.14, sori = 0.18, lip = 0.07 }) {
  const NP = 26, NU = 12;
  // the profile, front eave (s 0) to back eave (s 1): concave both sides
  const prof = (s) => {
    if (s <= 0.5) {
      const k = s / 0.5;
      return { z: zf + (zr - zf) * k, y: yf + (yr - yf) * Math.pow(k, 1.8) + lip * Math.pow(1 - k, 8), w: 1 - k };
    }
    const k = (s - 0.5) / 0.5;
    return { z: zr + (zb - zr) * k, y: yr - (yr - yb) * (1 - Math.pow(1 - k, 1.5)) + lip * Math.pow(k, 8), w: k };
  };
  const lift = (u, w) => sori * Math.pow(Math.abs(u), 3) * w;
  const pt = (u, s, dy) => {
    const p = prof(s);
    return [u * hw, p.y + lift(u, p.w) + dy, p.z];
  };
  const top = gridG(NU, NP, (a, s) => pt(a * 2 - 1, s, 0), false);
  const under = gridG(NU, NP, (a, s) => pt(a * 2 - 1, s, -t), true);
  // the eave edges, front and back
  const edges = [];
  for (const s of [0, 1]) edges.push(gridG(NU, 1, (a, b) => pt(a * 2 - 1, s, -t * b), s === 0));
  // the bargeboards (破風) at both gable ends: deeper than the roof
  const hafu = [];
  for (const u of [-1, 1]) {
    const pts = [];
    for (let j = 0; j <= NP; j++) pts.push(pt(u, j / NP, 0));
    const pos = [], idx = [];
    const d = t * 0.75 + 0.05, th = 0.015 + t * 0.22;
    pts.forEach(([x, y, z]) => {
      const xo = x + u * 0.02;
      pos.push(xo - th, y + 0.02, z, xo + th, y + 0.02, z, xo - th, y - d, z, xo + th, y - d, z);
    });
    for (let j = 0; j < NP; j++) {
      const a = j * 4, b = (j + 1) * 4;
      // outer face, inner face, bottom
      idx.push(a + 1, b + 1, b + 3, a + 1, b + 3, a + 3);
      idx.push(a, a + 2, b + 2, a, b + 2, b);
      idx.push(a + 2, a + 3, b + 3, a + 2, b + 3, b + 2);
      idx.push(a, b, b + 1, a, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    hafu.push(g);
  }
  const yAt = (z) => {
    // underside height at z (no corner lift: the walls stand inboard)
    let best = null;
    for (let j = 0; j <= 200; j++) {
      const p = prof(j / 200);
      if (!best || Math.abs(p.z - z) < Math.abs(best.z - z)) best = p;
    }
    return best.y - t;
  };
  return { top, under: [under, ...edges], hafu, yAt, ridge: { y: yr, z: zr } };
}

/** A gable-end infill (妻壁) at x, from the wall top y0 up to the roof's
 * underside, between z0 and z1. */
export function gableFill(x, z0, z1, y0, yAt) {
  const s = new THREE.Shape();
  s.moveTo(z0, y0);
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const z = z0 + (z1 - z0) * (i / n);
    s.lineTo(z, Math.max(y0, yAt(z) - 0.01));
  }
  s.lineTo(z1, y0);
  s.closePath();
  const g = new THREE.ShapeGeometry(s);
  g.rotateY(-Math.PI / 2);       // shape x -> +z
  g.translate(x, 0, 0);
  return g;
}

/** A kasagi-like beam (笠木): a box bent up at its ends (反り). */
export function bentBeam(len, h, d, rise, taper = 0.85) {
  const g = new THREE.BoxGeometry(len, h, d, 16, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), k = (2 * x) / len;
    p.setY(i, p.getY(i) * (1 - (1 - taper) * Math.abs(k)) + rise * k * k * k * k * 0.6 + rise * k * k * 0.4);
  }
  g.computeVertexNormals();
  return g;
}

/** A lathe from a profile of [r, y] pairs. */
export function latheG(profile, seg = 12) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}
