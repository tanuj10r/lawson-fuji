import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Building an animal: smooth parts (lofts along a spine, ellipsoids,
 * thin shapes) baked into one geometry with, per vertex,
 *
 *   color    the painted colour (a number, or a function of where the
 *            vertex lands, for masks, stripes and patches)
 *   aJoint   xyz: the pivot the part turns about; w: the part's id
 *   aMorph   where the vertex goes in the second pose (wings spread,
 *            legs stood up), as an offset; the rig blends it in
 *   aMorph2  a third pose (the guide dog lying down), the same way
 *
 * so the vertex shader (shade.js) can move the parts with no bones.
 * ------------------------------------------------------------------ */

const _c = new THREE.Color();
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _q = new THREE.Vector3();
const _nm = new THREE.Matrix3();

export class Body {
  constructor() {
    this.pos = []; this.nrm = []; this.col = []; this.joint = []; this.morph = []; this.morph2 = []; this.idx = [];
    this.two = false;
  }

  /**
   * @param geo     a BufferGeometry (indexed or not), in the part's own space
   * @param o.matrix   places it in the animal
   * @param o.color    hex, or (p, n, local) => hex
   * @param o.part     the part id the rig moves it by
   * @param o.pivot    [x, y, z] it turns about
   * @param o.morph    a second Matrix4 for the other pose, or (p, local) => [dx, dy, dz]
   * @param o.morph2   a third pose, the same way (aMorph2)
   */
  add(geo, { matrix = null, color = 0xffffff, part = 0, pivot = [0, 0, 0], morph = null, morph2 = null } = {}) {
    const P = geo.attributes.position;
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const N = geo.attributes.normal;
    const base = this.pos.length / 3;
    if (matrix) _nm.getNormalMatrix(matrix);
    const local = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      local.fromBufferAttribute(P, i);
      _p.copy(local);
      _n.fromBufferAttribute(N, i);
      if (matrix) { _p.applyMatrix4(matrix); _n.applyMatrix3(_nm).normalize(); }
      this.pos.push(_p.x, _p.y, _p.z);
      this.nrm.push(_n.x, _n.y, _n.z);
      _c.set(typeof color === 'function' ? color(_p, _n, local) : color);
      this.col.push(_c.r, _c.g, _c.b);
      this.joint.push(pivot[0], pivot[1], pivot[2], part);
      if (morph && morph.isMatrix4) {
        _q.copy(local).applyMatrix4(morph);
        this.morph.push(_q.x - _p.x, _q.y - _p.y, _q.z - _p.z);
      } else if (morph) {
        const d = morph(_p, local);
        this.morph.push(d[0], d[1], d[2]);
      } else this.morph.push(0, 0, 0);
      if (morph2) {
        this.two = true;
        if (morph2.isMatrix4) { _q.copy(local).applyMatrix4(morph2); this.morph2.push(_q.x - _p.x, _q.y - _p.y, _q.z - _p.z); } else { const d = morph2(_p, local); this.morph2.push(d[0], d[1], d[2]); }
      } else this.morph2.push(0, 0, 0);
    }
    if (geo.index) for (const k of geo.index.array) this.idx.push(base + k);
    else for (let i = 0; i < P.count; i++) this.idx.push(base + i);
    return this;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aJoint', new THREE.Float32BufferAttribute(this.joint, 4));
    g.setAttribute('aMorph', new THREE.Float32BufferAttribute(this.morph, 3));
    if (this.two) g.setAttribute('aMorph2', new THREE.Float32BufferAttribute(this.morph2, 3));
    g.setIndex(this.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/**
 * A smooth tube along a spine: sections { p: [x, y, z], rx, ry } (rx across,
 * ry up, relative to `up`), `radial` sides, closed at both ends (a section of
 * radius 0 makes a point).  Normals smooth all round.
 */
export function loft(sections, radial = 10, up = [0, 1, 0], sub = 1) {
  if (sub > 1) sections = subdivide(sections, sub);
  const U = new THREE.Vector3(...up);
  const pos = [], idx = [];
  const n = sections.length;
  const P = sections.map((s) => new THREE.Vector3(...s.p));
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    const dir = b.clone().sub(a).normalize();
    let side = new THREE.Vector3().crossVectors(dir, sections[i].up ? new THREE.Vector3(...sections[i].up) : U);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    const top = new THREE.Vector3().crossVectors(side, dir).normalize();
    const { rx, ry } = sections[i];
    const ox = sections[i].ox ?? 0, oy = sections[i].oy ?? 0;     // a section's centre pushed off the spine
    for (let k = 0; k < radial; k++) {
      const t = (k / radial) * Math.PI * 2;
      const c = Math.cos(t), s = Math.sin(t);
      const q = P[i].clone().addScaledVector(side, c * rx + ox).addScaledVector(top, s * ry + oy);
      pos.push(q.x, q.y, q.z);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < radial; k++) {
      const a = i * radial + k, b = i * radial + ((k + 1) % radial);
      const c = a + radial, d = b + radial;
      idx.push(a, c, b, b, c, d);
    }
  }
  // end caps: a fan to each end's centre
  const cap = (i, flip) => {
    const ci = pos.length / 3;
    const q = P[i];
    pos.push(q.x + 0, q.y, q.z);
    for (let k = 0; k < radial; k++) {
      const a = i * radial + k, b = i * radial + ((k + 1) % radial);
      if (flip) idx.push(ci, a, b); else idx.push(ci, b, a);
    }
  };
  cap(0, true);
  cap(n - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Sections smoothed between (Catmull-Rom through the centres and radii). */
function subdivide(S, sub) {
  const cr = (a, b, c, d, t) => {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  };
  const out = [];
  const n = S.length;
  for (let i = 0; i < n - 1; i++) {
    const a = S[Math.max(0, i - 1)], b = S[i], c = S[i + 1], d = S[Math.min(n - 1, i + 2)];
    for (let j = 0; j < sub; j++) {
      const t = j / sub;
      const sec = { ...b, p: [0, 1, 2].map((k) => cr(a.p[k], b.p[k], c.p[k], d.p[k], t)) };
      for (const key of ['rx', 'ry', 'ox', 'oy']) if (b[key] !== undefined) sec[key] = Math.max(0, cr(a[key] ?? b[key], b[key], c[key] ?? b[key], d[key] ?? c[key] ?? b[key], t));
      // the ends stay points
      if (i === 0 && j === 0) { sec.rx = b.rx; sec.ry = b.ry; }
      out.push(sec);
    }
  }
  out.push(S[n - 1]);
  return out;
}

/**
 * Sections resampled to `n`, evenly along the spine, by monotone cubic
 * (PCHIP) interpolation of every coordinate and radius: no overshoot, so the
 * radius never ripples between control sections and the normals turn evenly
 * (Catmull-Rom `subdivide` ripples, and a cel band flips at every ripple).
 * An end whose radius is 0 is rounded: the last stretch follows a quarter
 * ellipse to the point, so the loft ends in a dome, not a cone.
 */
export function smooth(S, n) {
  const keys = ['rx', 'ry', 'ox', 'oy'];
  const pts = S.map((s) => ({ p: [...s.p], rx: s.rx, ry: s.ry, ox: s.ox ?? 0, oy: s.oy ?? 0 }));
  // the parameter: chord length along the spine
  const x = [0];
  for (let i = 1; i < pts.length; i++) x.push(x[i - 1] + Math.hypot(...pts[i].p.map((v, k) => v - pts[i - 1].p[k])) + 1e-6);
  const pchip = (ys) => {
    const m = ys.length, h = [], d = [], sl = new Array(m).fill(0);
    for (let i = 0; i < m - 1; i++) { h.push(x[i + 1] - x[i]); d.push((ys[i + 1] - ys[i]) / h[i]); }
    for (let i = 1; i < m - 1; i++) {
      if (d[i - 1] * d[i] <= 0) sl[i] = 0;
      else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; sl[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
    }
    sl[0] = d[0]; sl[m - 1] = d[m - 2];
    return (t) => {
      let i = 0;
      while (i < m - 2 && t > x[i + 1]) i++;
      const u = (t - x[i]) / h[i], u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h[i] * sl[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h[i] * sl[i + 1];
    };
  };
  const fp = [0, 1, 2].map((k) => pchip(pts.map((s) => s.p[k])));
  const fr = {};
  for (const k of keys) fr[k] = pchip(pts.map((s) => s[k]));
  const L = x[x.length - 1];
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * L;
    const sec = { p: fp.map((f) => f(t)) };
    for (const k of keys) sec[k] = Math.max(0, fr[k](t));
    out.push(sec);
  }
  // rounded ends: within the last control stretch the radius follows a quarter ellipse to the point
  const dome = (end) => {
    const k0 = end ? pts.length - 1 : 0, k1 = end ? pts.length - 2 : 1;
    if (pts[k0].rx > 1e-6 || pts[k0].ry > 1e-6) return;
    const t0 = x[k0], t1 = x[k1];
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * L;
      const u = (t - t0) / (t1 - t0);                  // 0 at the point .. 1 at the neighbour
      if (u < 0 || u > 1) continue;
      const w = Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)));
      out[i].rx = pts[k1].rx * w; out[i].ry = pts[k1].ry * w;
    }
  };
  dome(false); dome(true);
  // an end that was a point stays one
  if (pts[0].rx <= 1e-6 && pts[0].ry <= 1e-6) out[0].rx = out[0].ry = 0;
  if (pts[pts.length - 1].rx <= 1e-6 && pts[pts.length - 1].ry <= 1e-6) out[n - 1].rx = out[n - 1].ry = 0;
  return out;
}

/** An ellipsoid (rx, ry, rz) at the origin. */
export function blob(rx, ry, rz, w = 10, h = 7) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  return g;
}

/**
 * A flat shape with a little thickness, lying in (x, z) at y 0 (both faces
 * drawn, as for a wing or a fin).  `pts`: [[x, z], ...] round its outline.
 */
export function sheet(pts, thick = 0.004) {
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(shape, 2);
  g.rotateX(-Math.PI / 2);              // (x, -z) -> lying down, y up
  const P = g.attributes.position;
  const n = P.count;
  const pos = [], nrm = [], idx = [];
  for (let i = 0; i < n; i++) { pos.push(P.getX(i), thick / 2, P.getZ(i)); nrm.push(0, 1, 0); }
  for (let i = 0; i < n; i++) { pos.push(P.getX(i), -thick / 2, P.getZ(i)); nrm.push(0, -1, 0); }
  const ix = g.index.array;
  // top faces up, bottom faces down
  const up = (() => {
    const a = ix[0], b = ix[1], c = ix[2];
    const e1 = [P.getX(b) - P.getX(a), P.getZ(b) - P.getZ(a)], e2 = [P.getX(c) - P.getX(a), P.getZ(c) - P.getZ(a)];
    return e1[1] * e2[0] - e1[0] * e2[1] > 0;          // y of e1 x e2
  })();
  for (let i = 0; i < ix.length; i += 3) {
    const [a, b, c] = [ix[i], ix[i + 1], ix[i + 2]];
    if (up) { idx.push(a, b, c); idx.push(n + a, n + c, n + b); } else { idx.push(a, c, b); idx.push(n + a, n + b, n + c); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  out.setIndex(idx);
  return out;
}

/** A thin limb from a to b (radii ra, rb), `radial` sides. */
export function limb(a, b, ra, rb = ra, radial = 5) {
  const mid = a.map((v, i) => (v + b[i]) / 2);
  return loft([
    { p: a, rx: ra * 0.4, ry: ra * 0.4 },
    { p: a.map((v, i) => v + (b[i] - v) * 0.02), rx: ra, ry: ra },
    { p: mid, rx: (ra + rb) / 2, ry: (ra + rb) / 2 },
    { p: b.map((v, i) => v + (a[i] - v) * 0.02), rx: rb, ry: rb },
    { p: b, rx: rb * 0.4, ry: rb * 0.4 },
  ], radial, Math.abs(b[1] - a[1]) > 0.9 * Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) ? [0, 0, 1] : [0, 1, 0]);
}

/** A matrix from position, Euler angles (XYZ) and scale. */
export function at(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s));
  return m;
}

/** Catmull-Rom through points, sampled `n` times: a spine for a loft. */
export function spine(points, n) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return Array.from({ length: n }, (_, i) => c.getPoint(i / (n - 1)).toArray());
}
