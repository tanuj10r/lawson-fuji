import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { rngKit } from '../../core/util.js';
import { TOWN } from '../../config.js';
import { POND } from '../../data/town.js';
import { makeBench } from '../props.js';
import { makeHouse } from '../buildings.js';
import { buildShrubs } from '../trees.js';
import { plant } from '../kit/green.js';
import { TILE, markerTex, norenTex, pondWobbleTex } from './tex.js';
import { makeMirror, REFLECT } from './mirror.js';

/* ------------------------------------------------------------------ *
 * 鏡池 (Kagami-ike), the pond beyond the river: Tan's afternoon on a bench
 * by an old pond outside Nara, made our own.  A rounded triangle of calm
 * olive water with a light chop, long side north; a promenade of worn
 * granite slabs right to the edge and a low stone lip at the water; pairs
 * of granite posts on the edge; a string of small white paper lanterns
 * along the north bank; black pines and a weeping willow; a tea house
 * (かがみ茶屋) and low houses behind; the hills beyond.  Lotus and lily pads
 * in the east corner (April: leaves and a few buds).  Benches face the
 * water: from the south you look across to the tea house and the hills,
 * from the north across to the river's cherries, the town and Fuji.
 *
 * The pond's grounds are sunk (ctx.sink) so the ground plane opens over
 * them; this file floors them at y 0 (a platform keeps heightAt there)
 * and lays the water below.  Room is left in the water for koi, turtles
 * and ducks (wave 3).
 * ------------------------------------------------------------------ */

export function pondMats(tex) {
  return {
    slab: cel({ color: 0xffffff, bands: 3, tint: 0x6a6490, map: tex.slab }),
    grass: cel({ color: 0xcfd4b8, bands: 3, tint: 0x5b6f8c, map: tex.grass }),   // a worn park lawn, not a new one
    granite: cel({ color: 0xc9c5bb, bands: 3, tint: 0x6a6490 }),
    graniteDark: cel({ color: 0xa6a298, bands: 3, tint: 0x5f5880 }),
    lipStone: cel({ color: 0xb4b0a6, bands: 3, tint: 0x5e5a78 }),
    plaster: cel({ color: 0xf6efe2, bands: 3, tint: 0xb8a8bc }),
    timber: cel({ color: 0x6e5444, bands: 3, tint: 0x4a3a58 }),
    tile: cel({ color: 0x5d6068, bands: 3, tint: 0x3c3a5a }),
    shoji: cel({ color: 0xffffff, bands: 'soft', tint: 0xc8c0d0, map: tex.shoji }),
    redFelt: cel({ color: 0xc8403a, bands: 3, tint: 0x7a3050 }),
    willow: cel({ color: 0xc2dc8e, bands: 'soft3', tint: 0x7a9a88, side: THREE.DoubleSide }),
    willowDeep: cel({ color: 0x98bc76, bands: 'soft3', tint: 0x6a8a80 }),
    willowWood: cel({ color: 0x5e5048, bands: 3, tint: 0x3e3448 }),
    lanternPaper: flat({ color: 0xfff7ea }),    // paper with the light through it: unlit, always pale
    wire: cel({ color: 0x3c3a40, bands: 3, tint: 0x2c2a3c }),
  };
}

/** The pond's shore: the corners rounded with fillets, the long north side
 * left nearly straight, the others bowed a little.  Counter-clockwise in
 * (x, z), closed. */
export function pondShore() {
  const C = TOWN.land.pond.corners.map(([x, z]) => new THREE.Vector2(x, z));
  const rc = [13, 11, 12];               // fillet radius at each corner
  const out = [];
  const n = C.length;
  for (let i = 0; i < n; i++) {
    const P = C[i], A = C[(i + n - 1) % n], B = C[(i + 1) % n];
    const da = A.clone().sub(P).normalize(), db = B.clone().sub(P).normalize();
    const half = Math.acos(THREE.MathUtils.clamp(da.dot(db), -1, 1)) / 2;
    const t = rc[i] / Math.tan(half);                          // tangent distance from the corner
    const T1 = P.clone().addScaledVector(da, t), T2 = P.clone().addScaledVector(db, t);
    const bis = da.clone().add(db).normalize();
    const O = P.clone().addScaledVector(bis, rc[i] / Math.sin(half));   // the fillet's centre
    let a1 = Math.atan2(T1.y - O.y, T1.x - O.x), a2 = Math.atan2(T2.y - O.y, T2.x - O.x);
    // the short way round
    let d = a2 - a1;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const k = 10;
    for (let j = 0; j <= k; j++) {
      const a = a1 + (d * j) / k;
      out.push(new THREE.Vector2(O.x + Math.cos(a) * rc[i], O.y + Math.sin(a) * rc[i]));
    }
    // the straight to the next corner, bowed out a little (not the north side)
    const next = C[(i + 1) % n], after = C[(i + 2) % n];
    const dn = after.clone().sub(next).normalize();
    const hn = Math.acos(THREE.MathUtils.clamp(next.clone().sub(P).normalize().negate().dot(dn), -1, 1)) / 2;
    const S2 = next.clone().addScaledVector(next.clone().sub(P).normalize().negate(), rc[(i + 1) % n] / Math.tan(hn));
    const north = Math.abs(P.y - next.y) < 3;
    const seg = 8;
    for (let j = 1; j < seg; j++) {
      const q = T2.clone().lerp(S2, j / seg);
      const nrm = new THREE.Vector2(S2.y - T2.y, -(S2.x - T2.x)).normalize();
      const bow = (north ? 0.8 : 2.6) * Math.sin((Math.PI * j) / seg) + 0.5 * Math.sin(j * 1.7 + i);
      out.push(q.addScaledVector(nrm, bow));
    }
  }
  // counter-clockwise: positive area
  let area = 0;
  for (let i = 0; i < out.length; i++) { const a = out[i], b = out[(i + 1) % out.length]; area += a.x * b.y - b.x * a.y; }
  if (area < 0) out.reverse();
  // a made pond, stone-edged, but laid by hand: a gentle wander round the
  // shore (a metre at most) so it isn't a drawn figure
  const cx = out.reduce((a, p) => a + p.x, 0) / out.length, cz = out.reduce((a, p) => a + p.y, 0) / out.length;
  for (const p of out) {
    const a = Math.atan2(p.y - cz, p.x - cx);
    const d = 0.7 * Math.sin(a * 3 + 0.7) + 0.4 * Math.sin(a * 5 + 2.1) + 0.2 * Math.sin(a * 11 + 0.4);
    const len = Math.hypot(p.x - cx, p.y - cz);
    p.x += ((p.x - cx) / len) * d;
    p.y += ((p.y - cz) / len) * d;
  }
  return out;
}

/** The shore pushed out by d (outward normals): the promenade's outer edge. */
function offset(pts, d) {
  const n = pts.length;
  // the polygon's winding decides which side is out
  let area = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a.x * b.y - b.x * a.y; }
  const s = area > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const t = b.clone().sub(a).normalize();
    return p.clone().add(new THREE.Vector2(t.y, -t.x).multiplyScalar(d * s));
  });
}
/** Is a point inside the polygon? */
function inside(pts, x, z) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > z) !== (b.y > z) && x < ((b.x - a.x) * (z - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
/** The polygon's x-span at z (its crossings, sorted). */
function span(pts, z) {
  const xs = [];
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > z) !== (b.y > z)) xs.push(a.x + ((b.x - a.x) * (z - a.y)) / (b.y - a.y));
  }
  xs.sort((p, q) => p - q);
  return xs.length >= 2 ? [xs[0], xs[xs.length - 1]] : null;
}
/** A flat shape (x, z) at height y, world-mapped UVs, facing up. */
function flatShape(shape, y, tile) {
  const g = new THREE.ShapeGeometry(shape, 1);
  // shape (x, y) is (x, z): lay it down so y becomes z
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getY(i);
    p.setXYZ(i, x, y, z);
    uv.setXY(i, x / tile, z / tile);
  }
  g.computeVertexNormals();
  const n = g.attributes.normal;
  if (n.getY(0) < 0) {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    g.computeVertexNormals();
  }
  return g;
}
/** The pond's water: flat bands in vertex colours, darker along the shore
 * (the banks' reflection), lightest in the open water; world-mapped UVs. */
function pondWaterGeo(shore, y) {
  const insets = [0, 2.2, 6.5];
  const shades = [0.8, 0.9, 1.0];
  const rings = insets.map((d) => (d ? offset(shore, -d) : shore));
  const pos = [], col = [], uv = [], idx = [];
  const put = (p, k) => { pos.push(p.x, y, p.y); col.push(k, k, k); uv.push(p.x / 8, p.y / 8); return pos.length / 3 - 1; };
  for (let r = 0; r < rings.length - 1; r++) {
    const A = rings[r], B = rings[r + 1], n = A.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = put(A[i], shades[r]), b = put(A[j], shades[r]), c = put(B[j], shades[r]), d = put(B[i], shades[r]);
      idx.push(a, b, c, a, c, d);
    }
  }
  // the open water: the innermost ring, filled
  const inner = new THREE.ShapeGeometry(new THREE.Shape(rings[rings.length - 1].map((p) => p.clone())), 1);
  const base = pos.length / 3;
  const ip = inner.attributes.position;
  for (let i = 0; i < ip.count; i++) put(new THREE.Vector2(ip.getX(i), ip.getY(i)), shades[shades.length - 1]);
  const ii = inner.index.array;
  for (let i = 0; i < ii.length; i++) idx.push(ii[i] + base);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // every face up (the rings' winding follows the shore's)
  g.computeVertexNormals();
  const ix = g.index.array, P = g.attributes.position;
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), v0 = new THREE.Vector3();
  for (let i = 0; i < ix.length; i += 3) {
    v0.fromBufferAttribute(P, ix[i]);
    e1.fromBufferAttribute(P, ix[i + 1]).sub(v0);
    e2.fromBufferAttribute(P, ix[i + 2]).sub(v0);
    if (e1.cross(e2).y < 0) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  }
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
}

/** A band along a closed line: boxes laid end to end. */
function band(parts, name, pts, w, y0, y1, shift = 0) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const len = a.distanceTo(b) + 0.06;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const g = new THREE.BoxGeometry(len, y1 - y0, w);
    g.translate(0, 0, shift);
    g.rotateY(-ang);
    g.translate((a.x + b.x) / 2, (y0 + y1) / 2, (a.y + b.y) / 2);
    parts.add(name, g);
  }
}

export function buildPond(ctx, parts, scatter, water) {
  const L = TOWN.land, PD = L.pond;
  const [bx0, bz0, bx1, bz1] = PD.box;
  const r = rngKit(6101);
  const shore = pondShore();
  const outer = offset(shore, PD.promenade);

  /* ---- the grounds: sunk (so the plane opens), floored here at y 0 ---- */
  ctx.sink(bx0, bz0, bx1, bz1, -1.2);
  ctx.platform({ x0: bx0, x1: bx1, z0: bz0, z1: bz1, top: 0 });
  {
    const s = new THREE.Shape([new THREE.Vector2(bx0, bz0), new THREE.Vector2(bx1, bz0), new THREE.Vector2(bx1, bz1), new THREE.Vector2(bx0, bz1)]);
    s.holes.push(new THREE.Path(outer.map((p) => p.clone())));
    parts.add('grass', flatShape(s, 0.0, TILE.grass));
    const prom = new THREE.Shape(outer.map((p) => p.clone()));
    prom.holes.push(new THREE.Path(shore.map((p) => p.clone())));
    parts.add('slab', flatShape(prom, 0.012, 4));
  }

  /* ---- the water, its walls and the low stone lip ---- */
  {
    const m = new THREE.Mesh(pondWaterGeo(shore, PD.water), water.pond);
    m.name = 'land-pond';
    m.userData.dynamic = true;
    m.userData.ground = true;
    ctx.add(m);
    water.watch(m, [bx0, bz0, bx1, bz1], 'pond', 70);
    // near the pond, a true mirror in its place (mirror.js); the painted
    // water above stays for the distance, where a reflection isn't seen
    const wobble = pondWobbleTex();
    const mirror = makeMirror(m.geometry, PD.water, wobble);
    mirror.camera.layers.set(REFLECT);   // only what stands round the pond (tagged by town.js)
    mirror.visible = false;
    ctx.add(mirror);
    const NEAR = 140;
    let t = 0;
    ctx.update((dt, cam) => {
      if (!cam) return;
      const p = ctx.toLocal({ x: cam.x, z: cam.z });
      const d = Math.hypot(Math.max(bx0 - p.x, 0, p.x - bx1), Math.max(bz0 - p.z, 0, p.z - bz1));
      mirror.visible = d < NEAR;
      m.visible = !mirror.visible;
      if (mirror.visible) {
        t += dt;
        // the water's own colour dims with the look (blue hour is dark)
        const fog = ctx.scene.fog;
        if (fog) mirror.material.uniforms.light.value = THREE.MathUtils.clamp((fog.color.r * 0.3 + fog.color.g * 0.55 + fog.color.b * 0.15) * 1.7, 0.22, 1);
        mirror.material.uniforms.chopOff.value.set(Math.sin(t * 0.17) * 0.02 + t * 0.004, t * 0.003);
      }
    });
    // the stone wall from the promenade down into the water, and the lip on top
    band(parts, 'lipStone', shore, 0.3, PD.water - 0.3, 0.0, 0.15);
    band(parts, 'granite', shore, 0.36, 0.0, 0.1, 0.14);
    // shut to walkers: strips across the water, a hand inside the lip
    const zs = shore.map((p) => p.y);
    const za = Math.min(...zs), zb = Math.max(...zs);
    for (let z = za; z < zb; z += 1.5) {
      const s0 = span(shore, z + 0.02), s1 = span(shore, Math.min(zb, z + 1.5) - 0.02);
      if (!s0 || !s1) continue;
      const x0 = Math.max(s0[0], s1[0]) + 0.3, x1 = Math.min(s0[1], s1[1]) - 0.3;
      if (x1 > x0) ctx.collide(x0, z, x1, Math.min(zb, z + 1.5), 1.0);
    }
    // the rounded ends of each strip, where the shore slants: smaller strips
    for (let z = za; z < zb; z += 0.5) {
      const s0 = span(shore, z + 0.02), s1 = span(shore, Math.min(zb, z + 0.5) - 0.02);
      if (!s0 || !s1) continue;
      const x0 = Math.max(s0[0], s1[0]) + 0.3, x1 = Math.min(s0[1], s1[1]) - 0.3;
      if (x1 > x0) { ctx.collide(x0, z, Math.min(x1, x0 + 3), z + 0.5, 1.0); ctx.collide(Math.max(x0, x1 - 3), z, x1, z + 0.5, 1.0); }
    }
  }

  /* ---- walking the shore: where along it, and which way is the water ---- */
  const along = (pts) => {
    const segs = [];
    let total = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      segs.push({ a, b, s: total, len: a.distanceTo(b) });
      total += a.distanceTo(b);
    }
    return { total, at: (s) => {
      s = ((s % total) + total) % total;
      const g = segs.find((q) => s >= q.s && s <= q.s + q.len) ?? segs[segs.length - 1];
      const p = g.a.clone().lerp(g.b, (s - g.s) / (g.len || 1));
      const t = g.b.clone().sub(g.a).normalize();
      return { p, t, inward: new THREE.Vector2(-t.y, t.x) };     // counter-clockwise: the water is to the left
    } };
  };
  const walk = along(shore);
  const onShore = (x, z) => {
    // the nearest point of the shore to (x, z)
    let best = null, bd = Infinity;
    for (let s = 0; s < walk.total; s += 0.5) {
      const q = walk.at(s);
      const d = q.p.distanceTo(new THREE.Vector2(x, z));
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  };
  const face = (dx, dz) => Math.atan2(dx, dz);        // a bench's ry to look along (dx, dz)

  /* ---- benches facing the water ---- */
  const benches = [
    // south: across the water to the tea house, the lanterns and the hills
    [-56, -52], [-44, -57.5],
    // north: across to the river's cherries, the town and Fuji
    [-78, -84], [-58, -84],
  ];
  const seats = [];
  for (const [x, z] of benches) {
    const q = onShore(x, z);
    const out = q.inward.clone().negate();
    const pos = q.p.clone().addScaledVector(out, 2.3);
    const ry = face(q.inward.x, q.inward.y);
    ctx.add(makeBench({ x: pos.x, z: pos.y, y: 0, ry, len: 1.8, wood: 0xb8946a }));
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
    const hx = (c * 1.8 + s * 0.5) / 2, hz = (s * 1.8 + c * 0.5) / 2;
    ctx.collide(pos.x - hx, pos.y - hz, pos.x + hx, pos.y + hz, 0.9);
    seats.push({ x: pos.x, z: pos.y, ry });
  }

  /* ---- granite post pairs on the edge, along the promenade (and one
   * just off each south bench's knee, as at Tan's bench) ---- */
  const byBench = seats.filter((b) => b.z > -70).map((b) => {
    const q = onShore(b.x, b.z);
    let best = 0, bd = Infinity;
    for (let s = 0; s < walk.total; s += 0.5) { const d = walk.at(s).p.distanceTo(q.p); if (d < bd) { bd = d; best = s; } }
    return best - 1.4;
  });
  for (const s of [...byBench, ...Array.from({ length: Math.floor(walk.total / 13) }, (_, i) => 6 + i * 13)]) {
    const q = walk.at(s);
    const mine = byBench.includes(s);
    if (q.p.y < -82) continue;                    // the lantern bank has its own posts
    if (!mine && seats.some((b) => Math.hypot(b.x - q.p.x, b.z - q.p.y) < 4)) continue;
    const base = q.p.clone().addScaledVector(q.inward, -0.55);
    for (const k of [-0.2, 0.2]) {
      const c = base.clone().addScaledVector(q.t, k);
      const g = new THREE.BoxGeometry(0.28, 0.62, 0.3);
      g.rotateY(-Math.atan2(q.t.y, q.t.x));
      g.translate(c.x, 0.33, c.y);
      parts.add('granite', g);
    }
    const g = new THREE.BoxGeometry(1.0, 0.06, 0.62);
    g.rotateY(-Math.atan2(q.t.y, q.t.x));
    g.translate(base.x, 0.03, base.y);
    parts.add('graniteDark', g);
    ctx.collide(base.x - 0.4, base.y - 0.4, base.x + 0.4, base.y + 0.4, 0.7);
  }

  /* ---- the lantern string along the north bank ---- */
  {
    const posts = [];
    for (let s = 0; s < walk.total; s += 3.6) {
      const q = walk.at(s);
      if (q.p.y > -82.5) continue;
      const p = q.p.clone().addScaledVector(q.inward, -0.35);
      if (seats.some((b) => Math.hypot(b.x - p.x, b.z - p.y) < 4.5)) continue;     // not in a bench's view
      posts.push(p);
      parts.box('timber', p.x - 0.05, p.x + 0.05, 0.08, 1.2, p.y - 0.05, p.y + 0.05);
      parts.box('lanternPaper', p.x - 0.17, p.x + 0.17, 1.2, 1.62, p.y - 0.17, p.y + 0.17);
      parts.box('timber', p.x - 0.19, p.x + 0.19, 1.62, 1.68, p.y - 0.19, p.y + 0.19);
      parts.box('timber', p.x - 0.19, p.x + 0.19, 1.16, 1.2, p.y - 0.19, p.y + 0.19);
      ctx.collide(p.x - 0.12, p.y - 0.12, p.x + 0.12, p.y + 0.12, 1.6);
    }
    posts.sort((a, b) => a.x - b.x);
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i], b = posts[i + 1];
      const len = a.distanceTo(b);
      const g = new THREE.BoxGeometry(len, 0.012, 0.012);
      g.rotateY(-Math.atan2(b.y - a.y, b.x - a.x));
      g.translate((a.x + b.x) / 2, 1.5, (a.y + b.y) / 2);
      parts.add('wire', g);
    }
    for (let i = 0; i < posts.length; i += 4) ctx.night?.pool(posts[i].x, posts[i].y, 3.6, { strength: 0.8 });
  }

  /* ---- 鏡池's name stone, by the south benches ---- */
  {
    const q = onShore(-50, -54);
    const p = q.p.clone().addScaledVector(q.inward, -3.4);
    const ry = face(-q.inward.x, -q.inward.y) ;       // its face to the promenade and the far walk
    const stele = new THREE.BoxGeometry(0.42, 1.15, 0.26);
    stele.translate(0, 0.72, 0);
    stele.rotateY(ry);
    stele.translate(p.x, 0, p.y);
    parts.add('granite', stele);
    const base = new THREE.BoxGeometry(0.8, 0.16, 0.6);
    base.rotateY(ry);
    base.translate(p.x, 0.08, p.y);
    parts.add('graniteDark', base);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.9), flat({ map: markerTex(POND.jp, 'pond') }));
    plate.position.set(p.x, 0.78, p.y);
    plate.rotation.y = ry;
    plate.translateZ(0.132);
    plate.userData.detail = true;
    ctx.add(plate);
    ctx.collide(p.x - 0.4, p.y - 0.4, p.x + 0.4, p.y + 0.4, 1.3);
  }

  /* ---- lotus and lily pads in the east corner; a few buds ---- */
  {
    const C = TOWN.land.pond.corners[1];
    const cx = C[0] - 11, cz = C[1] + 9;
    // a real patch, as Tan remembers it: dense in the corner, thinning out
    for (let i = 0; i < 460; i++) {
      const a = r.range(0, Math.PI * 2), d = Math.pow(r.next(), 0.65) * 13;
      const x = cx + Math.cos(a) * d * 1.2, z = cz + Math.sin(a) * d * 0.9;
      if (!inside(shore, x, z)) continue;
      const s = r.range(0.3, 0.72) * (1 - d / 30);
      scatter.put('pad', x, PD.water + 0.012 + (i % 3) * 0.002, z, s, 1, s, r.range(0, 6.3), r.pick([0x6f9a5a, 0x7caa62, 0x5f8a52, 0x88b06a]));
      if (i % 5 === 0) {
        // a lotus leaf held up out of the water, and now and then a bud
        const h = r.range(0.25, 0.6);
        scatter.put('tuft', x + 0.1, PD.water, z, 0.08, h, 0.08, r.range(0, 6.3), 0x6f9a5a);
        scatter.put('pad', x + 0.1, PD.water + h, z, s * 1.2, 1, s * 1.2, r.range(0, 6.3), 0x8ab86e, 0.25);
      }
      if (i % 13 === 5) scatter.put('head', x - 0.1, PD.water + 0.3, z, 0.07, 0.13, 0.07, 0, 0xe79ab8);
    }
  }

  /* ---- black pines, and the weeping willow by the lotus ---- */
  for (const [x, z, s] of [[-114, -70, 1.9], [-98, -94.8, 1.7], [-47, -95, 1.8], [-16, -70, 1.7], [-16, -52, 1.5], [-84, -48, 1.7], [-112, -52, 1.5],
    [-94, -90.3, 1.6], [-44, -90.4, 1.5], [-73, -90.6, 1.3]]) {
    plant(ctx, 'pine', { x, z, y: 0, scale: s, seed: 6200 + Math.round(-x * 3 - z) });
  }
  willow(ctx, parts, r, TOWN.land.pond.corners[1][0] + 3, TOWN.land.pond.corners[1][1] + 2.5);

  /* ---- the tea house and the low houses behind the north bank ---- */
  teahouse(ctx, parts, -60, -96.6);
  // behind the north bank, as round the old pond in Nara: an old townhouse,
  // family houses of every age, and a three-storey inn standing over them,
  // set back unevenly, with hedges and trees between (not a row of boxes)
  house(ctx, parts, -106, -95.4, 10, 5.2, 7201);
  const home = (x, zFront, w, d, floors, roofKind, seed, wall) => {
    const z = zFront - d / 2;
    ctx.add(makeHouse({ x, z, y: 0, w, d, face: 'z+', floors, seed, roofKind, wall, flowers: true }));
    ctx.collide(x - w / 2 - 0.1, z - d / 2 - 0.1, x + w / 2 + 0.1, z + d / 2 + 0.1, 2.72 * floors + 1);
  };
  home(-89, -89.8, 8.5, 6.8, 2, 'hip', 7202, 1);
  home(-78, -90.6, 6.4, 6.0, 1, 'gable', 7204, 4);
  home(-41, -89.4, 8.0, 7.0, 2, 'gable', 7203, 6);
  home(-24, -88.2, 13.0, 8.4, 3, 'flat', 7205, 2);          // the inn
  buildShrubs(ctx, [
    { x: -97, z: -88.5, r: 0.7, count: 6, spread: 3.2, seed: 7301, y: 0 },
    { x: -70, z: -89.2, r: 0.6, count: 5, spread: 2.6, seed: 7302, y: 0 },
    { x: -50, z: -88.6, r: 0.7, count: 6, spread: 3.0, seed: 7303, y: 0 },
    { x: -32, z: -86.8, r: 0.6, count: 5, spread: 2.4, seed: 7304, y: 0 },
    { x: -113, z: -60, r: 0.8, count: 7, spread: 4.0, seed: 7305, y: 0 },
    { x: -18, z: -62, r: 0.8, count: 7, spread: 4.0, seed: 7306, y: 0 },
  ]);
  plant(ctx, 'camphor', { x: -94, z: -91.5, y: 0, scale: 1.25, seed: 7401 });
  plant(ctx, 'maple', { x: -73, z: -86.5, y: 0, scale: 0.9, seed: 7402 });
  plant(ctx, 'camphor', { x: -47, z: -93.5, y: 0, scale: 1.1, seed: 7403 });
  plant(ctx, 'mapleRed', { x: -33, z: -83.5, y: 0, scale: 0.8, seed: 7404 });

  return { shore, seats };
}

/** A weeping willow (枝垂れ柳): a leaning trunk, a loose crown, and long
 * strands hanging to the water. */
function willow(ctx, parts, r, x, z) {
  const trunk = new THREE.CylinderGeometry(0.16, 0.26, 3.6, 7);
  trunk.rotateZ(0.12);
  trunk.translate(x - 0.2, 1.8, z);
  parts.add('willowWood', trunk);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const g = new THREE.CylinderGeometry(0.05, 0.1, 2.0, 5);
    g.rotateZ(0.9);
    g.rotateY(a);
    g.translate(x - 0.4 + Math.cos(a) * 0.6, 3.9, z + Math.sin(a) * 0.6);
    parts.add('willowWood', g);
  }
  const crown = new THREE.IcosahedronGeometry(1, 1);
  crown.scale(2.3, 1.1, 2.3);
  crown.translate(x - 0.4, 4.6, z);
  parts.add('willowDeep', crown);
  // the strands: long thin ribbons, hanging from the crown's rim
  for (let i = 0; i < 90; i++) {
    const a = r.range(0, Math.PI * 2), d = r.range(0.6, 2.6);
    const sx = x - 0.4 + Math.cos(a) * d, sz = z + Math.sin(a) * d, sy = 4.4 + r.range(-0.2, 0.6) - d * 0.25;
    const len = r.range(2.2, 3.9);
    const out = r.range(0.2, 0.6);
    const pts = [];
    for (let k = 0; k <= 3; k++) {
      const t = k / 3;
      pts.push([sx + Math.cos(a) * out * Math.sin(t * 1.4), sy - len * t, sz + Math.sin(a) * out * Math.sin(t * 1.4)]);
    }
    const w0 = 0.12, w1 = 0.03;
    const px = -Math.sin(a), pz = Math.cos(a);
    const pos = [];
    for (let k = 0; k < 3; k++) {
      const [ax, ay, az] = pts[k], [bx, by, bz] = pts[k + 1];
      const wa = w0 + (w1 - w0) * (k / 3), wb = w0 + (w1 - w0) * ((k + 1) / 3);
      pos.push(ax - px * wa, ay, az - pz * wa, ax + px * wa, ay, az + pz * wa, bx + px * wb, by, bz + pz * wb);
      pos.push(ax - px * wa, ay, az - pz * wa, bx + px * wb, by, bz + pz * wb, bx - px * wb, by, bz - pz * wb);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    parts.add('willow', g);
  }
  ctx.collide(x - 0.5, z - 0.4, x + 0.1, z + 0.4, 3);
}

/** A low roof: a hip roof over a w x d plan, eaves out by `e`. */
function hipRoof(parts, x, z, w, d, y, h, e = 0.7) {
  const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
  g.rotateY(Math.PI / 4);
  g.scale(w + 2 * e, h, d + 2 * e);
  g.translate(x, y + h / 2, z);
  parts.add('tile', g);
  parts.box('tile', x - w / 2 - e, x + w / 2 + e, y - 0.08, y + 0.02, z - d / 2 - e, z + d / 2 + e);
}

/** かがみ茶屋: a single-storey tea house facing the pond, its front open
 * behind shoji, a noren over the door, a red bench and a red parasol. */
function teahouse(ctx, parts, x, zBack) {
  const w = 12, d = 5.4, h = 2.7;
  const z = zBack + d / 2;             // the centre; the front faces +z (the pond)
  const zf = zBack + d;
  parts.box('timber', x - w / 2, x + w / 2, 0, 0.45, zBack, zf);
  parts.box('plaster', x - w / 2 + 0.1, x + w / 2 - 0.1, 0.45, h, zBack + 0.1, zf - 0.1);
  // posts and a lintel across the front, shoji between
  for (let i = 0; i <= 6; i++) {
    const px = x - w / 2 + (w * i) / 6;
    parts.box('timber', px - 0.09, px + 0.09, 0, h, zf - 0.12, zf + 0.06);
  }
  parts.box('timber', x - w / 2, x + w / 2, h - 0.3, h, zf - 0.1, zf + 0.08);
  for (let i = 0; i < 6; i++) {
    if (i === 2) continue;               // the door stands open under the noren
    const px = x - w / 2 + (w * (i + 0.5)) / 6;
    parts.box('shoji', px - w / 12 + 0.1, px + w / 12 - 0.1, 0.5, h - 0.32, zf - 0.02, zf + 0.01);
  }
  hipRoof(parts, x, z, w, d, h, 1.6, 0.9);
  // the noren over the open door
  const dx = x - w / 2 + (w * 2.5) / 6;
  const noren = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), flat({ map: norenTex(POND.teahouse, 'tea'), side: THREE.DoubleSide }));
  noren.position.set(dx, h - 0.72, zf + 0.12);
  noren.userData.detail = true;
  ctx.add(noren);
  // a red bench (縁台) and a parasol (野点傘) out front
  const bx = x + 2.4, bz = zf + 1.6;
  parts.box('redFelt', bx - 1.0, bx + 1.0, 0.4, 0.46, bz - 0.35, bz + 0.35);
  for (const sx of [-0.85, 0.85]) for (const sz of [-0.28, 0.28]) parts.box('timber', bx + sx - 0.04, bx + sx + 0.04, 0, 0.4, bz + sz - 0.04, bz + sz + 0.04);
  const pole = new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6);
  pole.translate(bx + 1.3, 1.15, bz);
  parts.add('timber', pole);
  const shade = new THREE.ConeGeometry(1.5, 0.5, 16, 1, true);
  shade.translate(bx + 1.3, 2.3, bz);
  parts.add('redFelt', shade);
  ctx.collide(x - w / 2 - 0.1, zBack, x + w / 2 + 0.1, zf + 0.1, h);
  ctx.collide(bx - 1.05, bz - 0.4, bx + 1.05, bz + 0.4, 0.5);
  ctx.night?.pool(dx, zf + 1.2, 4, { strength: 0.9 });
}

/** A low old house: plaster over a timber base, a hip roof of grey tile. */
function house(ctx, parts, x, zBack, w, d, seed) {
  const r = rngKit(seed);
  const h = r.range(2.8, 3.3);
  const zf = zBack + d;
  parts.box('timber', x - w / 2, x + w / 2, 0, 0.9, zBack, zf);
  parts.box('plaster', x - w / 2 + 0.06, x + w / 2 - 0.06, 0.9, h, zBack + 0.06, zf - 0.06);
  // the frame shows through the plaster (真壁): posts and a beam
  for (let px = x - w / 2 + 0.08; px <= x + w / 2; px += w / Math.round(w / 1.8)) parts.box('timber', px - 0.07, px + 0.07, 0.9, h, zf - 0.04, zf + 0.03);
  parts.box('timber', x - w / 2, x + w / 2, h - 0.28, h - 0.1, zf - 0.04, zf + 0.035);
  // lattice windows (格子) on the front
  for (let i = 0; i < 2; i++) {
    const px = x - w / 4 + (i * w) / 2;
    parts.box('timber', px - 1.1, px + 1.1, 1.1, 2.2, zf - 0.04, zf + 0.02);
    for (let k = 0; k < 9; k++) parts.box('shoji', px - 1.0 + k * 0.25, px - 0.94 + k * 0.25, 1.16, 2.14, zf + 0.02, zf + 0.05);
  }
  hipRoof(parts, x, zBack + d / 2, w, d, h, r.range(1.4, 1.8), 0.6);
  ctx.collide(x - w / 2, zBack, x + w / 2, zf, h);
}
