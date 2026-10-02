import * as THREE from 'three';
import { flat } from '../../core/toon.js';
import { RYOKAN, KOMINKA } from '../../data/town.js';
import { plant } from '../kit/green.js';
import { buildShrubs } from '../trees.js';
import { makeAircon } from '../props.js';
import { quadGeo } from './geo.js';
import { norenTex, boardSignTex, namePlateTex, YAKISUGI_TILE, PLASTER_TILE } from './tex.js';

/* ------------------------------------------------------------------ *
 * Two traditional buildings by 鏡池 (quality pass; Tan: "some houses
 * still look blank... replicate wooden houses and the ryokan kind"), on
 * the lots that held the two blankest boxes in town, east of the pond
 * where the lane at z 112 arrives:
 *
 *   鏡月旅館   two storeys: a charred-cedar (焼杉) wainscot under aged
 *              plaster with the frame showing (真壁), a tiled hip roof with
 *              its ridge and hip caps, a tiled pent roof (庇) round the
 *              ground floor, an engawa behind shoji on the paddies' side, a
 *              railed gallery on the upper floor, the genkan under its own
 *              roof with a noren and two paper lanterns, a wooden sign
 *              board, a plastered garden wall with a roofed gate, stepping
 *              stones, a stone lantern, a pine and a maple, the bath's ゆ
 *              curtain at the back door, AC units and downpipes
 *   古民家     one storey of 焼杉 boarding under a plaster band and deep
 *              tiled eaves, 格子 lattice windows, a shutter box, the genkan
 *              with its sliding door, a hedge with two gate posts and the
 *              family's nameplate, an AC unit, a downpipe
 *
 * Everything is parts.box / quads in the pond's parts (one mesh per
 * material, drawn once and in the pond's mirror); the textures tile at
 * the size they are seen (128-256 px).  All in the town's frame.
 * ------------------------------------------------------------------ */

const KAWARA = 2.4;                  // kit/tex.js kawaraTex: 8 tiles of 0.3 m per repeat
const X = new THREE.Vector3(1, 0, 0);

/* ------------------------------ helpers ------------------------------ */

/** [p0, p1] along a rect's side, walking so the quad faces outward. */
function side(rect, s) {
  const [x0, x1, z0, z1] = rect;
  return {
    'z+': { p0: [x0, z1], p1: [x1, z1], n: [0, 1] },
    'z-': { p0: [x1, z0], p1: [x0, z0], n: [0, -1] },
    'x+': { p0: [x1, z1], p1: [x1, z0], n: [1, 0] },
    'x-': { p0: [x0, z0], p1: [x0, z1], n: [-1, 0] },
  }[s];
}

/** A vertical wall quad from p0 to p1 (facing outward), tiled in metres. */
function wall(parts, name, { p0, p1 }, y0, y1, [tu, tv], out = 0, n = [0, 0]) {
  const ox = n[0] * out, oz = n[1] * out;
  const along = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const u0 = (p0[0] + p0[1]) / tu, u1 = u0 + along / tu;     // continuous round a corner
  const A = [p0[0] + ox, y0, p0[1] + oz], B = [p1[0] + ox, y0, p1[1] + oz];
  const C = [p1[0] + ox, y1, p1[1] + oz], D = [p0[0] + ox, y1, p0[1] + oz];
  return parts.add(name, quadGeo(A, B, C, D, [u0, y0 / tv, u1, y0 / tv, u1, y1 / tv, u0, y1 / tv]));
}

/** A box along a side of a rect: `off` out from the wall, `w` thick, y0..y1, between a and b along it. */
function along(parts, name, S, a, b, y0, y1, off, w) {
  const { p0, p1, n } = S;
  const dx = Math.sign(p1[0] - p0[0]), dz = Math.sign(p1[1] - p0[1]);
  const pa = [p0[0] + dx * a, p0[1] + dz * a], pb = [p0[0] + dx * b, p0[1] + dz * b];
  // the run along the side, and the thickness out from it
  const t0 = off, t1 = off + w;
  const x0 = n[0] ? Math.min(pa[0] + n[0] * t0, pa[0] + n[0] * t1) : Math.min(pa[0], pb[0]);
  const x1 = n[0] ? Math.max(pa[0] + n[0] * t0, pa[0] + n[0] * t1) : Math.max(pa[0], pb[0]);
  const z0 = n[1] ? Math.min(pa[1] + n[1] * t0, pa[1] + n[1] * t1) : Math.min(pa[1], pb[1]);
  const z1 = n[1] ? Math.max(pa[1] + n[1] * t0, pa[1] + n[1] * t1) : Math.max(pa[1], pb[1]);
  return parts.box(name, x0, x1, y0, y1, z0, z1);
}

/** A bar (box) from a to b, `w` wide and `h` tall. */
function bar(parts, name, a, b, w, h) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const g = new THREE.BoxGeometry(A.distanceTo(B), h, w);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(X, B.clone().sub(A).normalize()));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return parts.add(name, g);
}

/** A hipped kawara roof over rect, eaves at yE overhanging by e, `h` to
 * the ridge: four tiled faces, fascia boards, a ridge cap and hip caps. */
function hipRoof(parts, rect, yE, h, e) {
  const [x0, x1, z0, z1] = rect;
  const ex0 = x0 - e, ex1 = x1 + e, ez0 = z0 - e, ez1 = z1 + e;
  const w = ex1 - ex0, d = ez1 - ez0, cx = (ex0 + ex1) / 2, cz = (ez0 + ez1) / 2;
  const yR = yE + h;
  // the ridge runs along the longer side
  const alongX = w >= d;
  const half = Math.abs(w - d) / 2;
  const R0 = alongX ? [cx - half, yR, cz] : [cx, yR, cz - half];
  const R1 = alongX ? [cx + half, yR, cz] : [cx, yR, cz + half];
  const slopeZ = Math.hypot(d / 2, h), slopeX = Math.hypot(w / 2, h);
  const T = KAWARA;
  // z+ and z- faces (trapezoids when the ridge runs along x)
  const zp = alongX ? [R1, R0] : [[cx, yR, cz + half], [cx, yR, cz + half]];
  const zm = alongX ? [R0, R1] : [[cx, yR, cz - half], [cx, yR, cz - half]];
  parts.add('kawara', quadGeo([ex0, yE, ez1], [ex1, yE, ez1], zp[0], zp[1], [ex0 / T, 0, ex1 / T, 0, zp[0][0] / T, slopeZ / T, zp[1][0] / T, slopeZ / T]));
  parts.add('kawara', quadGeo([ex1, yE, ez0], [ex0, yE, ez0], zm[0], zm[1], [ex1 / T, 0, ex0 / T, 0, zm[0][0] / T, slopeZ / T, zm[1][0] / T, slopeZ / T]));
  const xp = alongX ? [R1, R1] : [R1, R0];
  const xm = alongX ? [R0, R0] : [R1, R0];       // walking ez0 -> ez1, the ridge end near ez1 comes first
  parts.add('kawara', quadGeo([ex1, yE, ez1], [ex1, yE, ez0], xp[0], xp[1], [ez1 / T, 0, ez0 / T, 0, xp[0][2] / T, slopeX / T, xp[1][2] / T, slopeX / T]));
  parts.add('kawara', quadGeo([ex0, yE, ez0], [ex0, yE, ez1], xm[0], xm[1], [ez0 / T, 0, ez1 / T, 0, xm[0][2] / T, slopeX / T, xm[1][2] / T, slopeX / T]));
  // the eave: a soffit under the tiles, and the fascia board round it
  parts.box('cedar', ex0, ex1, yE - 0.1, yE - 0.02, ez0, ez1);
  parts.box('timber', ex0 - 0.03, ex1 + 0.03, yE - 0.16, yE + 0.06, ez0 - 0.03, ez0 + 0.03);
  parts.box('timber', ex0 - 0.03, ex1 + 0.03, yE - 0.16, yE + 0.06, ez1 - 0.03, ez1 + 0.03);
  parts.box('timber', ex0 - 0.03, ex0 + 0.03, yE - 0.16, yE + 0.06, ez0, ez1);
  parts.box('timber', ex1 - 0.03, ex1 + 0.03, yE - 0.16, yE + 0.06, ez0, ez1);
  // the ridge cap (棟) and the four hip caps (隅棟)
  if (half > 0.01) bar(parts, 'kawaraDark', [R0[0] - 0.1 * (alongX ? 1 : 0), yR + 0.06, R0[2] - 0.1 * (alongX ? 0 : 1)], [R1[0] + 0.1 * (alongX ? 1 : 0), yR + 0.06, R1[2] + 0.1 * (alongX ? 0 : 1)], 0.34, 0.16);
  else parts.box('kawaraDark', cx - 0.2, cx + 0.2, yR - 0.02, yR + 0.14, cz - 0.2, cz + 0.2);
  for (const [c, r] of [[[ex0, yE + 0.04, ez0], alongX ? R0 : R0], [[ex1, yE + 0.04, ez0], alongX ? R1 : R0], [[ex1, yE + 0.04, ez1], alongX ? R1 : R1], [[ex0, yE + 0.04, ez1], alongX ? R0 : R1]]) {
    bar(parts, 'kawaraDark', c, [r[0], r[1] + 0.05, r[2]], 0.2, 0.12);
    // a round end tile (鬼瓦の代わり) at the corner
    parts.box('kawaraDark', c[0] - 0.12, c[0] + 0.12, yE - 0.02, yE + 0.2, c[2] - 0.12, c[2] + 0.12);
  }
}

/** A tiled pent roof (庇) along a side: from the wall at yTop, out `dep`,
 * dropping `drop`, between a and b along the side; fascia on its edge. */
function pentRoof(parts, S, a, b, yTop, dep, drop) {
  const { p0, p1, n } = S;
  const dx = Math.sign(p1[0] - p0[0]), dz = Math.sign(p1[1] - p0[1]);
  const pa = [p0[0] + dx * a, p0[1] + dz * a], pb = [p0[0] + dx * b, p0[1] + dz * b];
  const oa = [pa[0] + n[0] * dep, pa[1] + n[1] * dep], ob = [pb[0] + n[0] * dep, pb[1] + n[1] * dep];
  const T = KAWARA, slope = Math.hypot(dep, drop);
  const ua = (pa[0] + pa[1]) / T, ub = ua + (b - a) / T;
  parts.add('kawara', quadGeo([oa[0], yTop - drop, oa[1]], [ob[0], yTop - drop, ob[1]], [pb[0], yTop, pb[1]], [pa[0], yTop, pa[1]], [ua, 0, ub, 0, ub, slope / T, ua, slope / T]));
  // its underside and the fascia along the edge
  parts.add('cedar', quadGeo([pa[0], yTop - 0.06, pa[1]], [pb[0], yTop - 0.06, pb[1]], [ob[0], yTop - drop - 0.06, ob[1]], [oa[0], yTop - drop - 0.06, oa[1]]));
  along(parts, 'timber', S, a - 0.03, b + 0.03, yTop - drop - 0.12, yTop - drop + 0.04, dep - 0.02, 0.05);
  // brackets (腕木) holding it up
  const nb = Math.max(2, Math.round((b - a) / 1.6));
  for (let k = 0; k <= nb; k++) along(parts, 'timber', S, a + ((b - a) * k) / nb - 0.04, a + ((b - a) * k) / nb + 0.04, yTop - drop - 0.3, yTop - drop - 0.06, 0, dep - 0.1);
}

/** A 格子 lattice window: frame, shoji behind, vertical slats in front. */
function latticeWindow(parts, S, a, b, y0, y1) {
  along(parts, 'timber', S, a - 0.08, b + 0.08, y0 - 0.08, y0, 0, 0.12);         // sill
  along(parts, 'timber', S, a - 0.08, b + 0.08, y1, y1 + 0.08, 0, 0.1);           // head
  along(parts, 'timber', S, a - 0.08, a, y0, y1, 0, 0.1);
  along(parts, 'timber', S, b, b + 0.08, y0, y1, 0, 0.1);
  along(parts, 'shoji', S, a, b, y0, y1, 0.005, 0.02);
  const n = Math.round((b - a) / 0.13);
  for (let k = 1; k < n; k++) along(parts, 'lattice', S, a + ((b - a) * k) / n - 0.022, a + ((b - a) * k) / n + 0.022, y0, y1, 0.03, 0.05);
}

/** An upper-floor window with a plain timber frame and shoji. */
function shojiWindow(parts, S, a, b, y0, y1) {
  along(parts, 'timber', S, a - 0.07, b + 0.07, y0 - 0.07, y0, 0, 0.1);
  along(parts, 'timber', S, a - 0.07, b + 0.07, y1, y1 + 0.07, 0, 0.08);
  along(parts, 'timber', S, a - 0.07, a, y0, y1, 0, 0.08);
  along(parts, 'timber', S, b, b + 0.07, y0, y1, 0, 0.08);
  along(parts, 'shoji', S, a, b, y0, y1, 0.005, 0.02);
  along(parts, 'timber', S, (a + b) / 2 - 0.02, (a + b) / 2 + 0.02, y0, y1, 0.02, 0.03);   // the meeting stile
}

/** A downpipe (縦樋) down a wall at `at` along the side. */
function downpipe(parts, S, at, h) {
  along(parts, 'lattice', S, at - 0.04, at + 0.04, 0.15, h, 0.06, 0.08);
  for (const y of [0.6, h * 0.5, h - 0.4]) along(parts, 'lattice', S, at - 0.06, at + 0.06, y, y + 0.06, 0, 0.16);
}

/** The frame showing through the plaster (真壁): posts every `every` m, a beam at yBeam. */
function frame(parts, S, len, y0, y1, every, beams = []) {
  const n = Math.max(1, Math.round(len / every));
  for (let k = 0; k <= n; k++) along(parts, 'timber', S, (len * k) / n - 0.07, (len * k) / n + 0.07, y0, y1, 0, 0.06);
  for (const y of beams) along(parts, 'timber', S, -0.07, len + 0.07, y - 0.09, y + 0.09, 0, 0.07);
}

/** A paper lantern on a post (or hung: post = false), lit at night. */
function lantern(ctx, parts, x, z, y, post = true) {
  if (post) parts.box('timber', x - 0.05, x + 0.05, 0.05, y, z - 0.05, z + 0.05);
  parts.box('timber', x - 0.19, x + 0.19, y - 0.04, y, z - 0.19, z + 0.19);
  parts.box('lanternPaper', x - 0.17, x + 0.17, y - 0.5, y - 0.04, z - 0.17, z + 0.17);
  parts.box('timber', x - 0.19, x + 0.19, y - 0.54, y - 0.5, z - 0.19, z + 0.19);
  ctx.night?.pool(x, z, 3.4, { strength: 1.0 });
  if (post) ctx.collide(x - 0.12, z - 0.12, x + 0.12, z + 0.12, y);
}

/** A stone lantern (石灯籠): base, shaft, fire box, roof, jewel. */
function stoneLantern(ctx, parts, x, z) {
  parts.box('graniteDark', x - 0.34, x + 0.34, 0, 0.16, z - 0.34, z + 0.34);
  parts.box('granite', x - 0.11, x + 0.11, 0.16, 1.05, z - 0.11, z + 0.11);
  parts.box('granite', x - 0.26, x + 0.26, 1.05, 1.15, z - 0.26, z + 0.26);
  parts.box('graniteDark', x - 0.2, x + 0.2, 1.15, 1.48, z - 0.2, z + 0.2);
  parts.box('lanternPaper', x - 0.09, x + 0.09, 1.22, 1.4, z - 0.21, z + 0.21);   // the fire box's windows
  parts.box('lanternPaper', x - 0.21, x + 0.21, 1.22, 1.4, z - 0.09, z + 0.09);
  const cap = new THREE.ConeGeometry(0.5, 0.3, 4, 1);
  cap.rotateY(Math.PI / 4);
  cap.translate(x, 1.63, z);
  parts.add('granite', cap);
  parts.box('granite', x - 0.06, x + 0.06, 1.76, 1.9, z - 0.06, z + 0.06);
  ctx.collide(x - 0.34, z - 0.34, x + 0.34, z + 0.34, 1.9);
  ctx.night?.pool(x, z, 2.2, { strength: 0.6 });
}

/** A plastered garden wall on a stone base with a tiled cap, with openings. */
function gardenWall(ctx, parts, rect, gaps = []) {
  const H = 1.25;
  for (const s of ['x-', 'x+', 'z-', 'z+']) {
    const S = side(rect, s);
    const len = Math.hypot(S.p1[0] - S.p0[0], S.p1[1] - S.p0[1]);
    const runs = [];
    let a = 0;
    for (const g of gaps.filter((g) => g.side === s).sort((p, q) => p.a - q.a)) { if (g.a > a) runs.push([a, g.a]); a = g.b; }
    if (a < len) runs.push([a, len]);
    for (const [u, v] of runs) {
      along(parts, 'graniteDark', S, u - 0.1, v + 0.1, 0, 0.3, -0.16, 0.32);
      along(parts, 'plasterOld', S, u, v, 0.3, H - 0.1, -0.12, 0.24);
      along(parts, 'kawara', S, u - 0.06, v + 0.06, H - 0.1, H + 0.04, -0.2, 0.4);
      along(parts, 'kawaraDark', S, u - 0.06, v + 0.06, H + 0.04, H + 0.12, -0.08, 0.16);
      const dx = Math.sign(S.p1[0] - S.p0[0]), dz = Math.sign(S.p1[1] - S.p0[1]);
      const xa = S.p0[0] + dx * u, xb = S.p0[0] + dx * v, za = S.p0[1] + dz * u, zb = S.p0[1] + dz * v;
      ctx.collide(Math.min(xa, xb) - 0.2, Math.min(za, zb) - 0.2, Math.max(xa, xb) + 0.2, Math.max(za, zb) + 0.2, H + 0.2);
    }
  }
}

/* ------------------------------ 鏡月旅館 ------------------------------ */

export function buildRyokan(ctx, parts, o) {
  const { x0, x1, z0, z1 } = o;                    // the building's footprint
  const rect = [x0, x1, z0, z1];
  const GF = 2.9, FF = 2.6, H = GF + FF;            // floors; the eave
  const W = x1 - x0, D = z1 - z0;
  const cz = (z0 + z1) / 2;
  const S = { W: side(rect, 'x-'), E: side(rect, 'x+'), N: side(rect, 'z-'), Sd: side(rect, 'z+') };
  const len = { W: D, E: D, N: W, Sd: W };

  /* the body: a stone plinth, the 焼杉 wainscot, plaster above (textured
   * quads so the walls are not flat colour), the frame in the plaster */
  parts.box('graniteDark', x0 - 0.05, x1 + 0.05, 0, 0.22, z0 - 0.05, z1 + 0.05);
  parts.box('plasterOld', x0, x1, 0.2, H, z0, z1);                      // the core (its faces are re-skinned below)
  for (const k of ['W', 'E', 'N', 'Sd']) {
    wall(parts, 'yakisugi', S[k], 0.22, 1.0, YAKISUGI_TILE, 0.012, S[k].n);
    wall(parts, 'plasterOld', S[k], 1.0, H, [PLASTER_TILE, PLASTER_TILE], 0.006, S[k].n);
    frame(parts, S[k], len[k], 1.0, H, 1.9, [GF, H - 0.12]);
    along(parts, 'timber', S[k], -0.07, len[k] + 0.07, 0.96, 1.06, 0, 0.05);   // the rail over the wainscot
  }
  // the roofs: the big hip, and the pent roof round the ground floor
  hipRoof(parts, rect, H, 2.3, 1.05);
  for (const k of ['W', 'N', 'Sd', 'E']) pentRoof(parts, S[k], -0.3, len[k] + 0.3, GF - 0.12, 0.95, 0.38);

  /* ---- the genkan, on the west face toward the lane and the pond ---- */
  const gz = o.door ?? cz;                          // the door's z on the west wall
  {
    const a = gz - z0 - 1.1, b = gz - z0 + 1.1;
    // the opening: a dark recess with the sliding doors set back
    parts.box('cedar', x0 - 0.02, x0 + 0.7, 0.22, 2.35, gz - 1.1, gz + 1.1);       // the recess: cedar-lined walls and ceiling
    parts.box('slab', x0 - 0.5, x0 + 0.7, 0.2, 0.26, gz - 1.25, gz + 1.25);      // the step (式台)
    parts.box('graniteDark', x0 - 1.2, x0 - 0.5, 0, 0.14, gz - 1.0, gz + 1.0);   // the stone step outside
    // the sliding doors: timber frames with shoji, one a hand open
    for (const [da, db, off] of [[gz - 1.0, gz - 0.02, 0.62], [gz + 0.2, gz + 1.0, 0.66]]) {
      parts.box('timber', x0 + off, x0 + off + 0.05, 0.26, 2.3, da, db);
      parts.box('shoji', x0 + off - 0.03, x0 + off - 0.005, 0.5, 2.1, da + 0.06, db - 0.06);   // the pane proud of the door's frame, toward the street
      parts.box('lattice', x0 + off - 0.01, x0 + off + 0.06, 0.26, 0.5, da, db);
    }
    // the frame round the opening and the porch roof over it
    along(parts, 'timber', S.W, a - 0.12, a, 0.22, 2.5, 0, 0.14);
    along(parts, 'timber', S.W, b, b + 0.12, 0.22, 2.5, 0, 0.14);
    along(parts, 'timber', S.W, a - 0.12, b + 0.12, 2.35, 2.5, 0, 0.14);
    pentRoof(parts, S.W, a - 0.6, b + 0.6, GF + 0.2, 1.6, 0.5);
    for (const zz of [gz - 1.5, gz + 1.5]) { parts.box('timber', x0 - 1.5, x0 - 1.36, 0, GF - 0.35, zz - 0.07, zz + 0.07); ctx.collide(x0 - 1.55, zz - 0.1, x0 - 1.3, zz + 0.1, 3); }
    // the noren under the porch roof, and the lanterns either side of the path
    const noren = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.75), flat({ map: norenTex(RYOKAN.noren, 'ryokan'), side: THREE.DoubleSide }));
    noren.position.set(x0 - 0.2, 2.02, gz);
    noren.rotation.y = -Math.PI / 2;
    noren.userData.detail = true;
    ctx.add(noren);
    lantern(ctx, parts, x0 - 2.4, gz - 1.7, 1.75);
    lantern(ctx, parts, x0 - 2.4, gz + 1.7, 1.75);
    // the sign board beside the door
    parts.box('timber', x0 - 0.1, x0, 1.05, 2.55, gz + 1.45, gz + 1.85);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 1.44), flat({ map: boardSignTex(RYOKAN.jp, 'ryokan') }));
    board.position.set(x0 - 0.105, 1.8, gz + 1.65);
    board.rotation.y = -Math.PI / 2;
    board.userData.detail = true;
    ctx.add(board);
    ctx.night?.pool(x0 - 0.8, gz, 3.2, { strength: 0.9 });
    // stepping stones from the gate to the step
    for (let k = 0; k < 4; k++) {
      const sx = x0 - 1.8 - k * 1.05, sz = gz + Math.sin(k * 1.7) * 0.18;
      const g = new THREE.CylinderGeometry(0.34 + (k % 2) * 0.05, 0.36 + (k % 2) * 0.05, 0.08, 9);
      g.rotateY(k * 0.8);
      g.translate(sx, 0.04, sz);
      parts.add('graniteDark', g);
    }
  }
  // 格子 windows either side of the genkan; upper windows and the gallery rail on the west
  latticeWindow(parts, S.W, 0.7, 2.3, 1.15, 2.3);
  latticeWindow(parts, S.W, D - 2.3, D - 0.7, 1.15, 2.3);

  /* ---- the paddies' side (north, z-): the engawa behind full shoji ---- */
  {
    const sN = S.N;
    parts.box('cedar', x0 - 0.1, x1 + 0.1, 0.42, 0.5, z0 - 0.95, z0 + 0.02);       // the deck
    for (const xx of [x0 + 0.1, x0 + W / 3, x0 + (2 * W) / 3, x1 - 0.1]) parts.box('timber', xx - 0.06, xx + 0.06, 0, 0.42, z0 - 0.9, z0 - 0.78);
    parts.box('timber', x0 - 0.1, x1 + 0.1, 0.5, 0.56, z0 - 0.95, z0 - 0.88);     // the edge board
    // shoji panels full height between posts, under the pent roof
    const n = 5;
    for (let k = 0; k < n; k++) {
      const a = (W * k) / n + 0.1, b = (W * (k + 1)) / n - 0.1;
      along(parts, 'shoji', sN, a, b, 0.56, GF - 0.35, 0.02, 0.02);
      along(parts, 'timber', sN, a - 0.1, a, 0.5, GF - 0.3, 0, 0.09);
    }
    along(parts, 'timber', sN, W - 0.1, W, 0.5, GF - 0.3, 0, 0.09);
    along(parts, 'timber', sN, -0.1, W + 0.1, GF - 0.38, GF - 0.28, 0, 0.09);
    ctx.night?.pool(x0 + W / 2, z0 - 1.6, 5.5, { strength: 0.55 });
    ctx.collide(x0 - 0.15, z0 - 1.0, x1 + 0.15, z0, 0.6);
  }

  /* ---- the upper floor: windows all round and a railed gallery (欄干)
   * on the west and north ---- */
  const wy0 = GF + 0.75, wy1 = GF + 2.05;
  for (const [k, spots] of [['W', [1.2, D / 2, D - 1.2]], ['N', [1.1, W / 2, W - 1.1]], ['Sd', [1.1, W - 1.1]], ['E', [1.4, D / 2, D - 1.4]]]) {
    for (const c of spots) shojiWindow(parts, S[k], c - 0.7, c + 0.7, wy0, wy1);
  }
  for (const k of ['W', 'N']) {
    const L = len[k];
    along(parts, 'railWood', S[k], -0.1, L + 0.1, GF + 0.56, GF + 0.64, 0.3, 0.08);
    along(parts, 'railWood', S[k], -0.1, L + 0.1, GF + 0.22, GF + 0.27, 0.3, 0.06);
    const nb = Math.round(L / 0.45);
    // (the balusters pass through the lower rail, 5 mm inside its outer face: flush, the two were one plane at every baluster)
    for (let j = 0; j <= nb; j++) along(parts, 'lattice', S[k], (L * j) / nb - 0.02, (L * j) / nb + 0.02, GF + 0.08, GF + 0.56, 0.32, 0.035);
  }
  // AC units, meters and downpipes at the back and the east side
  const AC = ctx.addStatic ?? ctx.add;
  for (const [xx, zz, ry] of [[x0 + 1.4, z1 + 0.45, 0], [x0 + 3.0, z1 + 0.45, 0], [x1 + 0.45, z0 + 2.2, Math.PI / 2]]) {
    const u = makeAircon({ x: xx, z: zz, y: 0.14, ry });
    u.traverse((m) => { if (m.isMesh) m.userData.detail = true; });
    AC(u);
  }
  downpipe(parts, S.E, 0.25, H - 0.2);
  downpipe(parts, S.E, D - 0.25, H - 0.2);
  downpipe(parts, S.Sd, 0.3, H - 0.2);
  // the back door with the bath's ゆ curtain
  {
    const a = W / 2 - 0.55, b = W / 2 + 0.55;
    along(parts, 'lattice', S.Sd, a, b, 0.22, 2.1, 0.0, 0.03);
    along(parts, 'timber', S.Sd, a - 0.1, b + 0.1, 2.1, 2.22, 0, 0.1);
    along(parts, 'timber', S.Sd, a - 0.1, a, 0.22, 2.1, 0, 0.1);
    along(parts, 'timber', S.Sd, b, b + 0.1, 0.22, 2.1, 0, 0.1);
    const yu = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), flat({ map: norenTex(RYOKAN.bath, 'yu'), side: THREE.DoubleSide }));
    yu.position.set((x0 + x1) / 2, 1.85, z1 + 0.12);
    yu.userData.detail = true;
    ctx.add(yu);
    latticeWindow(parts, S.Sd, W - 2.6, W - 1.2, 1.3, 2.2);
  }
  latticeWindow(parts, S.E, D / 2 - 0.8, D / 2 + 0.8, 1.2, 2.3);

  /* ---- the grounds: the wall with its roofed gate, the garden ---- */
  const g = o.grounds;
  const gateZ = gz;
  gardenWall(ctx, parts, g, [{ side: 'x-', a: gateZ - g[2] - 1.3, b: gateZ - g[2] + 1.3 }]);
  {
    // the gate (門): two posts, a beam, a little tiled roof, the doors left open
    const gx = g[0];
    for (const zz of [gateZ - 1.3, gateZ + 1.3]) { parts.box('timber', gx - 0.14, gx + 0.14, 0, 2.5, zz - 0.14, zz + 0.14); ctx.collide(gx - 0.2, zz - 0.2, gx + 0.2, zz + 0.2, 2.6); }
    parts.box('timber', gx - 0.18, gx + 0.18, 2.35, 2.55, gateZ - 1.5, gateZ + 1.5);
    const roofRect = [gx - 0.55, gx + 0.55, gateZ - 1.6, gateZ + 1.6];
    hipRoof(parts, roofRect, 2.62, 0.55, 0.3);
    // the doors, folded back against the inside of the wall
    for (const s of [-1, 1]) parts.box('lattice', gx + 0.14, gx + 1.1, 0.1, 1.9, gateZ + s * 1.16 - 0.03, gateZ + s * 1.16 + 0.03);
  }
  plant(ctx, 'pine', { x: g[0] + 1.6, z: z1 - 0.4, y: 0, scale: 0.9, seed: 7511 });
  plant(ctx, 'maple', { x: g[0] + 1.5, z: z0 + 1.0, y: 0, scale: 0.8, seed: 7512 });
  stoneLantern(ctx, parts, g[0] + 1.6, gz - 3.3);
  buildShrubs(ctx, [
    { x: g[0] + 1.2, z: gz + 3.4, r: 0.55, count: 5, spread: 2.0, seed: 7521, y: 0 },
    { x: x0 + 1.5, z: z1 + 1.2, r: 0.5, count: 4, spread: 1.8, seed: 7522, y: 0 },
  ]);
  // a few garden stones by the maple
  for (const [sx, sz, s] of [[g[0] + 2.6, z0 + 0.9, 0.5], [g[0] + 3.2, z0 + 1.5, 0.35], [g[0] + 1.0, gz - 1.9, 0.4]]) {
    const st = new THREE.DodecahedronGeometry(s, 0);
    st.scale(1.2, 0.7, 1);
    st.translate(sx, s * 0.35, sz);
    parts.add('graniteDark', st);
  }

  ctx.collide(x0 - 0.1, z0 - 0.1, x1 + 0.1, z1 + 0.1, H + 2.5);
  ctx.registry?.push({ kind: 'building', x: (x0 + x1) / 2, z: cz, rect: [x0, z0, x1, z1] });
}

/* ------------------------------ the tea house's back ------------------------------ */

/**
 * Dress the blank sides of a plain plastered box (the tea house: its back
 * is 12 m of bare plaster to the paddies' path): the frame in the plaster,
 * a charred-cedar wainscot over the timber base, a back door, high
 * windows, a lattice window on each end, an AC unit, downpipes.
 * `rect` is the footprint, `base` the timber base's top, `h` the eave.
 */
export function dressPlainBox(ctx, parts, rect, base, h, { back = 'z-', ends = ['x-', 'x+'] } = {}) {
  const [x0, x1, z0, z1] = rect;
  const W = x1 - x0, D = z1 - z0;
  const L = (s) => (s[0] === 'x' ? D : W);
  for (const s of [back, ...ends]) {
    const S = side(rect, s);
    wall(parts, 'yakisugi', S, base, 1.0, YAKISUGI_TILE, 0.012, S.n);
    wall(parts, 'plasterOld', S, 1.0, h, [PLASTER_TILE, PLASTER_TILE], 0.006, S.n);
    frame(parts, S, L(s), base, h, 1.8, [h - 0.18]);
    along(parts, 'timber', S, -0.07, L(s) + 0.07, 0.96, 1.06, 0, 0.05);
  }
  const B = side(rect, back), LB = L(back);
  // the back door and two high windows (欄間) along the back
  along(parts, 'timber', B, LB / 2 - 0.55, LB / 2 + 0.55, base, 2.05, 0.005, 0.03);
  along(parts, 'lattice', B, LB / 2 - 0.5, LB / 2 - 0.05, 1.05, 1.95, 0.02, 0.02);
  along(parts, 'lattice', B, LB / 2 + 0.05, LB / 2 + 0.5, 1.05, 1.95, 0.02, 0.02);
  along(parts, 'timber', B, LB / 2 - 0.62, LB / 2 + 0.62, 2.05, 2.15, 0, 0.1);
  pentRoof(parts, B, LB / 2 - 0.9, LB / 2 + 0.9, 2.35, 0.7, 0.25);
  for (const c of [LB * 0.25, LB * 0.75]) shojiWindow(parts, B, c - 0.7, c + 0.7, h - 0.95, h - 0.4);
  for (const s of ends) latticeWindow(parts, side(rect, s), L(s) / 2 - 0.7, L(s) / 2 + 0.7, 1.1, 2.1);
  downpipe(parts, B, 0.3, h - 0.15);
  downpipe(parts, B, LB - 0.3, h - 0.15);
  {
    const u = makeAircon({ x: B.p0[0] + (B.p1[0] - B.p0[0]) * 0.2 + B.n[0] * 0.42, z: B.p0[1] + (B.p1[1] - B.p0[1]) * 0.2 + B.n[1] * 0.42, y: 0.14, ry: Math.atan2(B.n[0], B.n[1]) });
    u.traverse((m) => { if (m.isMesh) m.userData.detail = true; });
    (ctx.addStatic ?? ctx.add)(u);
  }
}

/* ------------------------------ the old house ------------------------------ */

export function buildKominka(ctx, parts, o) {
  const { x0, x1, z0, z1 } = o;
  const rect = [x0, x1, z0, z1];
  const H = 2.8, W = x1 - x0, D = z1 - z0;
  const cz = (z0 + z1) / 2;
  const S = { W: side(rect, 'x-'), E: side(rect, 'x+'), N: side(rect, 'z-'), Sd: side(rect, 'z+') };
  const len = { W: D, E: D, N: W, Sd: W };
  parts.box('graniteDark', x0 - 0.05, x1 + 0.05, 0, 0.3, z0 - 0.05, z1 + 0.05);
  parts.box('plasterOld', x0, x1, 0.28, H, z0, z1);
  for (const k of ['W', 'E', 'N', 'Sd']) {
    wall(parts, 'yakisugi', S[k], 0.3, 2.05, YAKISUGI_TILE, 0.012, S[k].n);
    wall(parts, 'plasterOld', S[k], 2.05, H, [PLASTER_TILE, PLASTER_TILE], 0.006, S[k].n);
    frame(parts, S[k], len[k], 2.0, H, 1.75, [2.05, H - 0.1]);
    // corner posts down the boarding
  }
  for (const [xx, zz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) parts.box('timber', xx - 0.08, xx + 0.08, 0.28, H, zz - 0.08, zz + 0.08);
  hipRoof(parts, rect, H, 2.05, 0.95);

  // the genkan on the west: a recess, sliding door, a small roof, a step
  const gz = o.door ?? cz;
  {
    const a = gz - z0 - 0.9, b = gz - z0 + 0.9;
    parts.box('cedar', x0 - 0.02, x0 + 0.5, 0.3, 2.15, gz - 0.9, gz + 0.9);
    parts.box('slab', x0 - 0.4, x0 + 0.5, 0.28, 0.32, gz - 1.0, gz + 1.0);
    parts.box('graniteDark', x0 - 1.0, x0 - 0.4, 0, 0.16, gz - 0.8, gz + 0.8);
    for (const [da, db, off] of [[gz - 0.85, gz - 0.02, 0.42], [gz + 0.12, gz + 0.85, 0.46]]) {
      parts.box('timber', x0 + off, x0 + off + 0.05, 0.32, 2.1, da, db);
      parts.box('shoji', x0 + off - 0.03, x0 + off - 0.005, 0.9, 1.95, da + 0.06, db - 0.06);
      parts.box('lattice', x0 + off - 0.01, x0 + off + 0.06, 0.32, 0.9, da, db);
    }
    along(parts, 'timber', S.W, a - 0.1, a, 0.3, 2.28, 0, 0.12);
    along(parts, 'timber', S.W, b, b + 0.1, 0.3, 2.28, 0, 0.12);
    along(parts, 'timber', S.W, a - 0.1, b + 0.1, 2.15, 2.28, 0, 0.12);
    pentRoof(parts, S.W, a - 0.45, b + 0.45, 2.55, 1.1, 0.35);
    ctx.night?.pool(x0 - 0.6, gz, 2.6, { strength: 0.6 });
  }
  latticeWindow(parts, S.W, D - 2.4, D - 0.9, 1.0, 1.95);
  latticeWindow(parts, S.N, 0.8, 2.4, 1.0, 1.95);
  latticeWindow(parts, S.N, W - 2.6, W - 1.0, 1.0, 1.95);
  along(parts, 'yakisugi', S.N, W - 0.95, W - 0.3, 0.9, 2.05, 0.02, 0.22);      // the shutter box (戸袋)
  latticeWindow(parts, S.Sd, 1.0, 2.6, 1.0, 1.95);
  latticeWindow(parts, S.E, D / 2 - 0.8, D / 2 + 0.8, 1.0, 1.95);
  downpipe(parts, S.E, 0.3, H - 0.15);
  downpipe(parts, S.Sd, W - 0.3, H - 0.15);
  {
    const u = makeAircon({ x: x1 + 0.42, z: z1 - 1.2, y: 0.14, ry: Math.PI / 2 });
    u.traverse((m) => { if (m.isMesh) m.userData.detail = true; });
    (ctx.addStatic ?? ctx.add)(u);
  }
  // the hedge along the lane side, gate posts and the nameplate
  const hx = o.hedgeX ?? x0 - 2.6;
  const spots = [];
  for (let zz = z0 - 1.2; zz <= z1 + 1.2; zz += 1.1) if (Math.abs(zz - gz) > 1.15) spots.push({ x: hx, z: zz, r: 0.6, count: 3, spread: 0.9, seed: 7600 + Math.round(zz * 7), y: 0 });
  buildShrubs(ctx, spots);
  ctx.collide(hx - 0.5, z0 - 1.6, hx + 0.5, gz - 1.0, 1.0);
  ctx.collide(hx - 0.5, gz + 1.0, hx + 0.5, z1 + 1.6, 1.0);
  for (const zz of [gz - 1.0, gz + 1.0]) { parts.box('graniteDark', hx - 0.16, hx + 0.16, 0, 1.15, zz - 0.16, zz + 0.16); parts.box('granite', hx - 0.19, hx + 0.19, 1.15, 1.22, zz - 0.19, zz + 0.19); ctx.collide(hx - 0.2, zz - 0.2, hx + 0.2, zz + 0.2, 1.3); }
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.28), flat({ map: namePlateTex(KOMINKA.plate, 'kominka') }));
  plate.position.set(hx - 0.165, 0.95, gz + 1.0);
  plate.rotation.y = -Math.PI / 2;
  plate.userData.detail = true;
  ctx.add(plate);
  // a path of stones to the door
  for (let k = 0; k < 3; k++) {
    const g = new THREE.CylinderGeometry(0.3, 0.32, 0.07, 8);
    g.rotateY(k * 0.9);
    g.translate(x0 - 1.3 - k * 0.6, 0.035, gz + Math.sin(k * 2.1) * 0.12);
    parts.add('graniteDark', g);
  }
  ctx.collide(x0 - 0.1, z0 - 0.1, x1 + 0.1, z1 + 0.1, H + 2.2);
  ctx.registry?.push({ kind: 'building', x: (x0 + x1) / 2, z: cz, rect: [x0, z0, x1, z1] });
}
