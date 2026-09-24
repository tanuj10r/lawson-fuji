import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { cyl } from '../../core/util.js';
import { hullOutline } from '../../core/outline.js';
import { makeMirror } from '../props.js';
import { ROADS } from '../../config.js';
import { DIRECTIONS, BUS_STOP } from '../../data/town.js';
import { plateTex } from './tex.js';

/* ------------------------------------------------------------------ *
 * Street signs by rule (SPEC section 3), from the features markings.js
 * found:
 *
 *   minor approach     止まれ triangle at the stop line; a convex mirror on
 *                      the far corner where lanes meet
 *   entering a street  speed limit (+ no parking on shopping streets,
 *                      school-zone diamond on school lanes)
 *   zebra              pedestrian-crossing signs at both ends
 *   main-road junction a blue direction board ahead of it
 *   bus stop           the stop pole with its timetable
 *
 * Every sign stands on the driver's left, facing the traffic it is for.
 * ------------------------------------------------------------------ */

const WY = ROADS.asphaltY + ROADS.kerbH;

let M = null;
function mats() {
  if (M) return M;
  M = {
    post: cel({ color: 0xc4c8d2, bands: 3, tint: 0x666090 }),
    base: cel({ color: 0xb4afbc, bands: 3, tint: 0x6a6288 }),
  };
  return M;
}

/** Facing angle for a plate read by traffic heading `f`. */
const faceFor = (f) => Math.atan2(-f.x, -f.z);

/**
 * A post with plates stacked on it.  plates: [{ kind, o, w, y, double }].
 */
export function signPost(ctx, { x, z, y = 0, ry = 0, h = 2.9, plates = [], name = 'sign' }) {
  const m = mats();
  const g = new THREE.Group();
  g.name = name;
  const post = cyl(0.038, 0.042, h, 8, m.post, 0, h / 2, 0);
  post.castShadow = true;
  g.add(post);
  hullOutline(post, { thickness: 0.0026 });
  g.add(cyl(0.08, 0.09, 0.08, 8, m.base, 0, 0.04, 0));
  for (const p of plates) {
    const t = plateTex(p.kind, p.o ?? {});
    const w = p.w ?? 0.6, ph = w / t.aspect;
    const geo = new THREE.PlaneGeometry(w, ph);
    // lit, so a sign is a painted plate and not a lamp after dark
    const front = new THREE.Mesh(geo, cel({
      color: 0xffffff, map: t.face, alphaTest: 0.5, bands: 3, tint: 0x6a6288, cache: false,
    }));
    front.position.set(0, p.y ?? h - ph / 2, 0.055);
    front.castShadow = true;
    g.add(front);
    const back = new THREE.Mesh(geo, cel({
      color: 0xffffff, map: p.double ? t.face : t.back, alphaTest: 0.5, bands: 3, tint: 0x666090, cache: false,
    }));
    back.position.set(0, front.position.y, 0.045);
    back.rotation.y = Math.PI;
    back.castShadow = true;
    g.add(back);
  }
  g.position.set(x, y, z);
  g.rotation.y = ry;
  ctx.add(g);
  ctx.collide(x - 0.12, z - 0.12, x + 0.12, z + 0.12, y + h);
  return g;
}

export function placeSigns(ctx, net, features) {
  const out = [];
  /** A roadside spot on the `side` of edge `e` at `s`: on the pavement, or just off a lane. */
  const roadside = (e, s, side) => {
    const walk = e.spec.walk > 0;
    const p = net.at(e, s, side * (e.a + (walk ? 0.55 : 0.3)));
    return { ...p, y: walk ? WY : 0 };
  };

  /* ---- 止まれ and mirrors ---- */
  for (const st of features.stops) {
    const { e, dir, s, side, node } = st;
    const f = net.along(e, dir);
    const p = roadside(e, s - dir * 0.6, side);
    out.push(signPost(ctx, { ...p, ry: faceFor(f), h: 2.6, plates: [{ kind: 'tomare', w: 0.8 }], name: 'sign-tomare' }));
    if (e.cls === 'lane') {
      // the mirror stands on the far corner, turned back toward the driver
      const trim = e.axis === 'x' ? node.ax : node.az;
      const rx = -f.z, rz = f.x;             // driver's right
      const ahead = trim + 0.6, right = e.a + 0.6;
      const pos = (e.axis === 'x' ? node.x : node.z) + dir * ahead;
      const x = e.axis === 'x' ? pos + rx * right : node.x + rx * right;
      const z = e.axis === 'x' ? node.z + rz * right : pos + rz * right;
      const mirror = makeMirror({ x, z, ry: faceFor(f) });
      mirror.name = 'mirror';
      ctx.add(mirror);
      ctx.collide(x - 0.15, z - 0.15, x + 0.15, z + 0.15, 2.6);
    }
  }

  /* ---- entering a street ---- */
  for (const st of features.starts) {
    const { e, s, dir, side, speed, school } = st;
    if (e.len < 30) continue;
    const f = net.along(e, dir);
    const plates = [{ kind: 'speed', o: { n: speed }, w: 0.6, y: 2.45 }];
    if (e.cls === 'shopping') plates.push({ kind: 'noParking', w: 0.6, y: 1.78 });
    const p = roadside(e, s + dir * 5, side);
    out.push(signPost(ctx, { ...p, ry: faceFor(f), plates, name: 'sign-speed' }));
    if (school) {
      const q = roadside(e, s + dir * 14, side);
      out.push(signPost(ctx, { ...q, ry: faceFor(f), plates: [{ kind: 'schoolZone', w: 0.75 }], name: 'sign-school' }));
    }
  }

  /* ---- zebras ---- */
  for (const c of features.crossings) {
    for (const side of [-1, 1]) {
      const p = roadside(c.e, c.s + side * (c.L / 2 + 0.5), side);
      const f = net.along(c.e, c.e.axis === 'x' ? -side : side);
      out.push(signPost(ctx, {
        ...p, ry: faceFor(f), h: 3.1, plates: [{ kind: 'pedCross', w: 0.6, double: true }], name: 'sign-crossing',
      }));
    }
  }

  /* ---- direction boards ahead of main-road junctions ---- */
  let di = 0;
  for (const n of Object.values(net.nodes)) {
    if (n.degree < 3 || n.rank < 2) continue;
    for (const e of n.edges) {
      if (e.cls !== 'main' || e.len < 40) continue;
      const dir = e.hi === n ? 1 : -1;
      const side = e.axis === 'x' ? -dir : dir;
      const s = (dir > 0 ? e.a1 : e.a0) - dir * 28;
      const p = roadside(e, s, side);
      const d = DIRECTIONS[di++ % DIRECTIONS.length];
      out.push(signPost(ctx, {
        ...p, ry: faceFor(net.along(e, dir)), h: 4.4,
        plates: [{ kind: 'direction', o: d, w: 2.2, y: 3.7 }], name: 'sign-direction',
      }));
    }
  }

  /* ---- bus stops ---- */
  for (const b of features.busStops) {
    const p = roadside(b.e, b.at + b.dir * 5, b.side);
    const f = net.along(b.e, b.dir);
    out.push(signPost(ctx, {
      ...p, ry: faceFor(f), h: 2.6,
      plates: [
        { kind: 'busStop', o: { t: BUS_STOP }, w: 0.55, y: 2.3, double: true },
        { kind: 'timetable', o: { t: BUS_STOP }, w: 0.36, y: 1.35, double: true },
      ],
      name: 'sign-bus',
    }));
  }
  return out;
}
