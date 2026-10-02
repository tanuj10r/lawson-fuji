import * as THREE from 'three';
import { figureMaterial, parts, ellipsoid, easeBack, ease, clamp01 } from './figure.js';

/* ------------------------------------------------------------------ *
 * Your hand (Tan's konbini): a cartoon right hand that rises from the
 * bottom of the view to take the thing you chose, pay and eat.
 *
 * Painted in store/figure.js's style, drawn on top of the world
 * and near-clamped.  It lives in the camera's frame: `view` (shop.js)
 * follows the camera, and the hand is a pivot at the wrist whose offset
 * and turn the choreography (rise, pay, eat) drives.  It closes round
 * what it holds (the grips, below): what you carry is drawn in the same
 * near sliver of depth, so it really is between the thumb and the fingers.
 *
 * Hand frame: the palm at the origin, fingers +y, palm facing +z, a right
 * hand's thumb on +x.
 * ------------------------------------------------------------------ */

const SKIN = 0xf8d3b8, NAIL = 0xfbe4da, SLEEVE = 0x4b5d95, CUFF = 0xeae6de, BUTTON = 0xd8d2c4;
const v = (x, y, z) => new THREE.Vector3(x, y, z);

/* ------------------------- the hand's anatomy ------------------------- *
 * Built to a real hand's proportions (a palm about 8.5 cm across and 10 cm
 * long, the middle finger 8 cm, three phalanges in 4:3:2, the thumb from
 * the heel of the hand): a lofted palm with the metacarpal ridges rising
 * to the knuckles, fingers that taper joint by joint with nails on their
 * backs, the thenar and hypothenar pads, the web of the thumb, an oval
 * wrist with the ulnar bump, and the shirt cuff at the wrist where it is
 * seen.  Cel-shaded like everything else; the form does the work.
 * ---------------------------------------------------------------------- */

/** A ring of `n` points round a superellipse (half-axes a along x, b along z, exponent e) at height y. */
function ring(n, a, b, y, e = 2, cx = 0, cz = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    pts.push(v(cx + a * Math.sign(c) * Math.abs(c) ** (2 / e), y, cz + b * Math.sign(s) * Math.abs(s) ** (2 / e)));
  }
  return pts;
}

/** Skin a stack of rings (equal counts) into one smooth closed surface, the ends fanned shut. */
function loft(rings) {
  const n = rings[0].length, m = rings.length;
  const pos = [], idx = [];
  for (const r of rings) for (const p of r) pos.push(p.x, p.y, p.z);
  for (let i = 0; i < m - 1; i++) for (let j = 0; j < n; j++) {
    const j1 = (j + 1) % n, a = i * n + j, b = (i + 1) * n + j, c = (i + 1) * n + j1, d = i * n + j1;
    idx.push(a, b, d, b, c, d);
  }
  for (const [i, flip] of [[0, true], [m - 1, false]]) {
    const ci = pos.length / 3;
    let cx = 0, cy = 0, cz = 0;
    for (const p of rings[i]) { cx += p.x; cy += p.y; cz += p.z; }
    pos.push(cx / n, cy / n, cz / n);
    for (let j = 0; j < n; j++) { const j1 = (j + 1) % n; idx.push(ci, flip ? i * n + j : i * n + j1, flip ? i * n + j1 : i * n + j); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A tapering segment from a to b: radius r0 at a, r1 at b, open-ended (the joints cover the ends). */
function taper(a, b, r0, r1, seg = 12) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

/** A matrix placing a part at p in the frame (x across, y along, z toward the palm). */
const frameAt = (x, y, z, p) => new THREE.Matrix4().makeBasis(x, y, z).setPosition(p);

/** How far (0 .. `max` rad) a segment from P along `dir` may bend toward the palm and stay clear of a cylinder lying
 * across the palm (its axis along x through y, z; radius r): what makes a finger close ROUND what it holds. */
function wrapCurl(P, dir, ax, len, rad, round, max) {
  const q = new THREE.Quaternion(), d = new THREE.Vector3(), need = round.r + rad + 0.0012;
  if (round.slab) {
    /* a slab lying on the palm (a pack `t` thick, its back `zb` off the hand's plane, its far edge at `y`, its
     * corners rounded by `r`): the finger lies behind it, bends up its edge and over onto its face */
    const hz = round.t / 2 - round.r, cz = round.zb + round.t / 2, clear = rad + 0.001;
    const out = (y, z) => {
      const qy = y - (round.y - round.r), qz = Math.abs(z - cz) - hz;
      return Math.hypot(Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qy, qz), 0) - round.r;
    };
    for (let c = max; c > 0; c -= 0.02) {
      d.copy(dir).applyQuaternion(q.setFromAxisAngle(ax, c));
      let ok = true;
      for (let k = 1; k <= 8 && ok; k++) ok = out(P.y + d.y * len * k / 8, P.z + d.z * len * k / 8) >= clear;
      if (ok) return c;
    }
    return 0;
  }
  for (let c = max; c > 0; c -= 0.02) {
    d.copy(dir).applyQuaternion(q.setFromAxisAngle(ax, c));
    // the nearest point of the segment to the axis, in the plane across it
    const fy = P.y - round.y, fz = P.z - round.z, dd = d.y * d.y + d.z * d.z;
    const s = Math.max(0, Math.min(len, -(fy * d.y + fz * d.z) / (dd || 1)));
    if (Math.hypot(fy + d.y * s, fz + d.z * s) >= need) return c;
  }
  return 0;
}

/**
 * One finger: three phalanges from the knuckle B, fanned by `fan` about the
 * palm's normal, curling toward the palm (+z) by `curl` at each joint; with
 * `round` (a cylinder across the palm) each joint bends as far as `curl`
 * allows and the cylinder lets it, so the finger lies round it.  The joints
 * are the finger's own width (no knobs: they read as lumps under two-tone
 * shading); the tip is rounded, the nail on the back of the last segment.
 */
function finger(p, B, fan, L, R, curl, round = null) {
  const ax = v(Math.cos(fan), -Math.sin(fan), 0);        // the knuckle axis, fanned with the finger
  const dir = v(Math.sin(fan), Math.cos(fan), 0);
  const q = new THREE.Quaternion();
  let P = B.clone();
  const pd = () => ax.clone().cross(dir).normalize();
  // the knuckle: a soft rise on the back of the hand
  p.add(ellipsoid(R[0] * 1.03, R[0] * 1.0, R[0] * 0.98, 12, 9), SKIN, frameAt(ax, dir, pd(), P.clone().addScaledVector(pd(), -R[0] * 0.06)));
  for (let k = 0; k < 3; k++) {
    const c = round ? wrapCurl(P, dir, ax, L[k], Math.max(R[k], R[k + 1]), round, curl[k]) : curl[k];
    dir.applyQuaternion(q.setFromAxisAngle(ax, c)).normalize();
    const Q = P.clone().addScaledVector(dir, L[k]);
    p.add(taper(P, Q, R[k], R[k + 1]), SKIN);
    const palm = pd();
    if (k < 2) {
      p.add(ellipsoid(R[k + 1], R[k + 1], R[k + 1], 12, 9), SKIN, frameAt(ax, dir, palm, Q));
    } else {
      // the tip: rounded, a little fuller toward the palm; the nail on its back
      p.add(ellipsoid(R[3], R[3] * 1.2, R[3], 12, 9), SKIN, frameAt(ax, dir, palm, Q.clone().addScaledVector(dir, -R[3] * 0.2)));
      const nailAt = P.clone().addScaledVector(dir, L[2] * 0.62).addScaledVector(palm, -R[3] * 0.82);
      const tilt = new THREE.Quaternion().setFromAxisAngle(ax, 0.22);
      const nd = dir.clone().applyQuaternion(tilt), npd = palm.clone().applyQuaternion(tilt);
      p.add(ellipsoid(R[3] * 0.72, L[2] * 0.4, R[3] * 0.3, 12, 8), NAIL, frameAt(ax, nd, npd, nailAt));
    }
    P = Q;
  }
  return P;
}

/* The fingers' own measures: knuckle, fan, the three phalanges, the radii joint by joint.  The middle finger is the
 * longest, the knuckle line a gentle arc. */
const FINGERS = [
  { B: [0.0285, 0.0445, 0.002], fan: 0.07, L: [0.031, 0.021, 0.0175], R: [0.0091, 0.0084, 0.0077, 0.0068] },
  { B: [0.0098, 0.049, 0.001], fan: 0.015, L: [0.034, 0.024, 0.0185], R: [0.0093, 0.0086, 0.0079, 0.0069] },
  { B: [-0.0092, 0.0472, 0.001], fan: -0.045, L: [0.032, 0.022, 0.0175], R: [0.0088, 0.0082, 0.0075, 0.0066] },
  { B: [-0.0275, 0.0405, 0.0025], fan: -0.12, L: [0.025, 0.017, 0.0145], R: [0.0078, 0.0072, 0.0066, 0.0059] },
];

/**
 * A right hand closed in a grip, and its sleeve.
 *   curls   [index, middle, ring, little] x [knuckle, middle joint, last joint] (rad)
 *   round   { y, z, r }: a cylinder across the palm the fingers close round (curls are then how far each may bend)
 *   thumb   [cmc, mcp, ip, tip]: the thumb's joints, from the heel of the hand
 *   hold    a point inside what is held: the thumb's nail faces away from it
 *   wrist   { dev, flex }: the forearm turned at the wrist, toward the little-finger side and toward the palm (rad)
 */
function rightHandGeometry({ curls, round = null, thumb, hold, wrist = {} }) {
  const p = parts();
  const N = 28;

  /* the palm: from the wrist to the knuckle line, flatter on the back,
   * fuller toward the fingers; the metacarpals only just show on its back */
  {
    const st = [[-0.06, 0.0265, 0.0145, 2.2], [-0.048, 0.03, 0.0155, 2.3], [-0.034, 0.0345, 0.0162, 2.4], [-0.018, 0.0385, 0.016, 2.5],
      [0.002, 0.041, 0.0152, 2.6], [0.02, 0.042, 0.0142, 2.7], [0.034, 0.041, 0.0128, 2.7], [0.044, 0.037, 0.0108, 2.6], [0.05, 0.03, 0.008, 2.4]];
    const rings = st.map(([y, a, b, e]) => ring(N, a, b, y, e, 0.001, 0.001));
    const g = loft(rings);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (z < -0.003 && y > -0.012) {
        const k = clamp01((y + 0.012) / 0.05);
        let bump = 0;
        for (const f of FINGERS) bump += Math.exp(-(((x - f.B[0]) / 0.0075) ** 2));
        pos.setZ(i, z - 0.001 * k * k * bump);
      } else if (z > 0.004 && y > -0.02 && y < 0.03) {
        pos.setZ(i, z - 0.002 * Math.exp(-((x / 0.02) ** 2)));      // the hollow of the palm
      }
    }
    g.computeVertexNormals();
    p.add(g, SKIN);
    // the pads: the thenar under the thumb (low on the palm, where the thumb starts), the hypothenar along the little-finger side
    p.add(ellipsoid(0.0185, 0.03, 0.0125, 14, 10), SKIN, new THREE.Matrix4().makeRotationZ(-0.6).setPosition(0.0235, -0.026, 0.0105));
    p.add(ellipsoid(0.012, 0.03, 0.0098, 12, 9), SKIN, new THREE.Matrix4().makeRotationZ(0.12).setPosition(-0.027, -0.018, 0.009));
  }

  /* the fingers */
  FINGERS.forEach((f, i) => finger(p, v(...f.B), f.fan, f.L, f.R, curls[i], round));

  /* the thumb: from the heel of the hand, low on the palm and angled out, one taper to its rounded tip; its nail
   * turned away from what it holds; the web of skin to the index finger */
  {
    const [cmc, mcp, ip, tip] = thumb.map((a) => v(...a));
    p.add(ellipsoid(0.0138, 0.0138, 0.0138, 12, 9), SKIN, new THREE.Matrix4().makeTranslation(cmc.x, cmc.y, cmc.z));
    p.add(taper(cmc, mcp, 0.0138, 0.0118), SKIN);
    p.add(ellipsoid(0.0118, 0.0118, 0.0118, 12, 9), SKIN, new THREE.Matrix4().makeTranslation(mcp.x, mcp.y, mcp.z));
    p.add(taper(mcp, ip, 0.0118, 0.0102), SKIN);
    p.add(ellipsoid(0.0102, 0.0102, 0.0102, 12, 9), SKIN, new THREE.Matrix4().makeTranslation(ip.x, ip.y, ip.z));
    p.add(taper(ip, tip, 0.0102, 0.0088), SKIN);
    const d = tip.clone().sub(ip).normalize();
    const side = v(1, 0, 0).cross(d).normalize();
    p.add(ellipsoid(0.0088, 0.0104, 0.0088, 12, 9), SKIN, frameAt(side, d, d.clone().cross(side), tip.clone().addScaledVector(d, -0.0016)));
    const mid = ip.clone().lerp(tip, 0.62), away = mid.clone().sub(v(...hold));
    away.addScaledVector(d, -away.dot(d)).normalize();
    const across = d.clone().cross(away).normalize();
    p.add(ellipsoid(0.0064, 0.0092, 0.0028, 12, 8), NAIL, frameAt(across, d, away.clone().negate(), mid.clone().addScaledVector(away, 0.0074)));
    // the web: from the thumb's first joint toward the index knuckle
    const wb = mcp.clone().lerp(v(0.03, 0.03, 0.006), 0.5);
    p.add(ellipsoid(0.016, 0.019, 0.0055, 12, 9), SKIN, new THREE.Matrix4().makeRotationZ(-0.9).setPosition(wb.x, wb.y, Math.min(wb.z, 0.012)));
  }

  /* the wrist, the forearm, the shirt cuff and the jacket sleeve: one piece, turned at the wrist */
  {
    const W = v(0.001, -0.06, 0.001);
    const M = new THREE.Matrix4().makeTranslation(W.x, W.y, W.z)
      .multiply(new THREE.Matrix4().makeRotationZ(-(wrist.dev ?? 0)))
      .multiply(new THREE.Matrix4().makeRotationX(-(wrist.flex ?? 0)))
      .multiply(new THREE.Matrix4().makeTranslation(-W.x, -W.y, -W.z));
    const at = (m) => M.clone().multiply(m);
    // the wrist itself: a smooth oval where the hand turns on the forearm
    p.add(ellipsoid(0.0264, 0.017, 0.0152, 16, 10), SKIN, new THREE.Matrix4().makeTranslation(W.x, W.y, W.z));
    const st = [[-0.06, 0.0262, 0.0145], [-0.075, 0.0265, 0.0165], [-0.1, 0.028, 0.019], [-0.16, 0.033, 0.026], [-0.3, 0.04, 0.034]];
    p.add(loft(st.map(([y, a, b]) => ring(N, a, b, y, 2, 0.001 - 0.02 * (y + 0.06), 0.09 * (y + 0.06)))), SKIN, M);
    const lean = (y) => 0.09 * (y + 0.06), sway = (y) => 0.001 - 0.02 * (y + 0.06);
    p.add(loft([[-0.08, 0.0305, 0.021], [-0.084, 0.0315, 0.022], [-0.118, 0.032, 0.0225]].map(([y, a, b]) => ring(N, a, b, y, 2.2, sway(y), lean(y)))), CUFF, M);
    p.add(new THREE.CylinderGeometry(0.0046, 0.0046, 0.0024, 12).rotateX(Math.PI / 2), BUTTON, at(new THREE.Matrix4().makeTranslation(-0.019, -0.099, lean(-0.099) - 0.021)));
    p.add(loft([[-0.106, 0.0365, 0.028], [-0.11, 0.0385, 0.03], [-0.118, 0.037, 0.0285], [-0.2, 0.041, 0.033], [-0.42, 0.05, 0.042]].map(([y, a, b]) => ring(N, a, b, y, 2.2, sway(y), lean(y)))), SLEEVE, M);
  }
  return p.build();
}

/* ------------------------------ the grips ------------------------------ *
 * The hand closes ROUND what it holds (Tan, 2026-10-02: "the hand should grab objects around them, not ahead of
 * them"): the palm behind or under it, the fingers round its far side, the thumb on the near side.  What is held
 * faces you (the anchor), so each grip is laid out in the held thing's own frame (x right, y up, z toward you) and
 * the hand is turned to it.  Each returns the hand's geometry (cached), `q` (the hand's frame in the thing's) and
 * `A` (the thing's centre in the hand's frame).
 *
 *   round   a can: across the palm, the fingers wrapped round the back of it, the thumb round the front
 *   pinch   a flat thing `t` thick (an onigiri, a wafer, a sando half, a card): the fingers flat behind it, the
 *           thumb's pad on its face at `hold` (from its centre, in its own frame), the hand rolled by `roll`
 *   under   a thing that stands on the hand (a sando pack, the mochi in its paper cup): the palm up under it, the
 *           fingers cupped a little, the thumb up against its near side; `bottom` its underside, from its centre
 * ----------------------------------------------------------------------- */
const CASCADE = [0, 0.02, 0.05, 0.09];        // each finger a little more curled than the last
const geos = new Map();
const cached = (key, make) => { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); };
const basis = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(v(...x), v(...y), v(...z)));
export const GRIP = {
  round({ r = 0.03 }) {
    const C = { y: 0.026, z: 0.018 + r, r };
    const on = (deg, rho, x) => [x, C.y + rho * Math.cos(deg * Math.PI / 180), C.z + rho * Math.sin(deg * Math.PI / 180)];
    return {
      geometry: cached(`round:${r}`, () => rightHandGeometry({
        curls: CASCADE.map(() => [1.25, 1.3, 1.0]), round: C,
        thumb: [[0.03, -0.04, 0.01], on(-178, r + 0.017, 0.05), on(142, r + 0.0145, 0.046), on(106, r + 0.012, 0.038)],
        hold: [0.02, C.y, C.z], wrist: { dev: 0.5, flex: 0.1 },
      })),
      // the can upright: the knuckle line up it, seen from the thumb's side, the fingers gone round the back
      q: basis([0, 1, 0], [-0.57, 0, -0.82], [-0.82, 0, 0.57]),
      A: v(0.004, C.y, C.z),
    };
  },
  pinch({ t = 0.03, hold = [0.02, -0.02], roll = 0.45 }) {
    const ZB = 0.026, zf = ZB + t, u = clamp01(t / 0.044);
    const T = [0.017 + 0.017 * u, 0.027 - 0.013 * u];      // where the thumb's pad presses (a thick thing is held nearer the thumb's root)
    const c = Math.cos(roll), s = Math.sin(roll);
    return {
      geometry: cached(`pinch:${t}`, () => rightHandGeometry({
        curls: CASCADE.map((k) => [0.08 + k, 0.1 + k, 0.08 + k]),
        thumb: [[0.03, -0.04, 0.01], [0.056, -0.013 - 0.003 * u, 0.021 + 0.5 * t], [T[0] + 0.024 - 0.008 * u, T[1] - 0.015, zf + 0.0125], [T[0], T[1], zf + 0.0098]],
        hold: [T[0], T[1], ZB + t / 2], wrist: { dev: 0.1, flex: 0.45 },
      })),
      q: basis([c, s, 0], [-s, c, 0], [0, 0, 1]),
      // the thing's centre: from the thumb's pad, back along `hold` (its frame turned into the hand's)
      A: v(T[0] - (c * hold[0] + s * hold[1]), T[1] - (-s * hold[0] + c * hold[1]), ZB + t / 2),
    };
  },
  /* (Tan, 2026-10-02: "fingers are supposed to wrap around products") a pack held in the hand: the palm behind it,
   * the fingers over its `edge` (a point on it, from its centre, in its own frame; the fingers run `roll` rad left of
   * up, square to that edge) and bent onto its face, the thumb's pad on the face too */
  clasp({ t = 0.03, edge = [0, 0.04], roll = 0, reach = 0.071, x = 0.002, face = t, back = t / 2 }) {
    // (`face`: how thick it is under the thumb; `back`: its centre from its back, where it is not a plain slab)
    const ZB = 0.022, zf = ZB + face, u = clamp01(face / 0.044);
    const T = [0.02 + 0.014 * u, 0.024 - 0.012 * u];
    const c = Math.cos(roll), s = Math.sin(roll);
    return {
      geometry: cached(`clasp:${t}:${reach}:${face}`, () => rightHandGeometry({
        curls: CASCADE.map((k) => [0.5, 1.75, 1.35 + k]), round: { slab: true, y: reach, zb: ZB, t, r: Math.min(0.007, t / 2) },
        thumb: [[0.03, -0.04, 0.01], [0.056, -0.013 - 0.003 * u, 0.021 + 0.5 * t], [T[0] + 0.024 - 0.008 * u, T[1] - 0.015, zf + 0.0125], [T[0], T[1], zf + 0.0098]],
        hold: [T[0], T[1], ZB + face / 2], wrist: { dev: 0.1, flex: 0.4 },
      })),
      q: basis([c, s, 0], [-s, c, 0], [0, 0, 1]),
      // the thing's centre: its `edge` under the fingers' bend
      A: v(x - (c * edge[0] + s * edge[1]), reach - (-s * edge[0] + c * edge[1]), ZB + back),
    };
  },
  /* (Tan, 2026-10-02: "during Suica card payments, palms are facing the wrong direction") a card held to tap: the
   * hand on its thumb side, the back of the hand to the right, the fingers curled in; the card flat between the
   * thumb's pad (on its face) and the side of the first finger (under it), sticking out ahead of the hand.  You see
   * the thumb and the knuckles, never the palm. */
  key({ swing = 0.9, at = [0.024, -0.01] }) {
    const X = 0.0395;                                        // the card's plane: on the first finger's side
    const pad = [0.04, 0.022];                               // the thumb's pad (the hand's y, z)
    // the fingers run up and to the left of the card (`swing` rad from its long side), so the forearm comes in from
    // the lower right, yours; the pad presses the card `at` (from its centre: toward its near right corner)
    const c = Math.cos(swing), sn = Math.sin(swing);
    return {
      geometry: cached('key', () => rightHandGeometry({
        curls: CASCADE.map((k) => [1.15 + k, 1.45, 1.0]),
        thumb: [[0.03, -0.04, 0.01], [0.046, -0.012, 0.014], [0.0505, 0.016, 0.019], [0.0495, pad[0], pad[1] + 0.001]],
        hold: [X, pad[0], pad[1]], wrist: { dev: 0.05, flex: 0.1 },
      })),
      // the card's face is the hand's thumb side; the palm faces away down its length
      q: basis([0, 0, 1], [-c, sn, 0], [-sn, -c, 0]),
      A: v(X, pad[0] - (-c * at[0] + sn * at[1]), pad[1] - (-sn * at[0] - c * at[1])),
    };
  },
  under({ bottom = -0.03, yaw = 0.2, x = 0 }) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return {
      geometry: cached('under', () => rightHandGeometry({
        curls: CASCADE.map((k) => [0.1 + k * 0.5, 0.14 + k * 0.5, 0.14 + k * 0.5]),
        thumb: [[0.03, -0.04, 0.01], [0.057, -0.02, 0.024], [0.0625, 0.006, 0.042], [0.057, 0.03, 0.054]],
        hold: [0, 0.035, 0.05], wrist: { dev: 0, flex: -0.4 },
      })),
      q: basis([c, 0, -s], [-s, 0, -c], [0, 1, 0]),
      A: v(x, 0.036, 0.0205 - bottom),
    };
  },
};
/** How each thing is held: carried in its pack, and (`eat:`) out of it. */
export const HOLDS = {
  can: ['round', { r: 0.033 }],
  onigiri: ['clasp', { t: 0.036, edge: [-0.025, 0], roll: 1.07, x: 0.026 }],             // over its left slope
  wafer: ['clasp', { t: 0.028, edge: [0.022, 0.034], roll: 0.12 }],            // over its top edge, toward its right end
  sando: ['clasp', { t: 0.014, edge: [0.012, 0.06], roll: 0.2, x: 0.024, face: 0.03, back: 0.0375 }],   // a wedge: over its ridge from behind, the thumb on its slope
  card: ['key', {}],
  'eat:onigiri': ['clasp', { t: 0.039, edge: [-0.027, -0.012], roll: 1.07, x: 0.026 }],     // as it was carried, a little lower: the top is yours to bite
  'eat:sando': ['clasp', { t: 0.03, edge: [-0.03, -0.02], roll: 1.25, x: 0.02 }],
  'eat:wafer': ['clasp', { t: 0.034, edge: [-0.03, 0.036], roll: 0.12 }],                   // by its wrapper, the bitten end free
  mochi: ['under', { bottom: -0.02, yaw: 0.3 }],
};
/** The hold for a product of this shape (products.js), carried or eaten. */
export function holdFor(shape, eating = false) {
  const k = /can$/.test(shape) || shape === 'pet' || shape === 'codd' ? 'can' : /sand/.test(shape) ? 'sando' : shape;
  return (eating && HOLDS[`eat:${k}`] ? `eat:${k}` : HOLDS[k] ? k : 'onigiri');
}
/* where what you hold sits in the camera's frame (as it always has: flights into the hand land here) */
const ITEM_AT = v(0.1546, -0.0953, -0.53);

export function makeHands(lit) {
  const view = new THREE.Group();
  view.name = 'hands';
  const skinMat = figureMaterial({ onTop: true });
  lit.push(skinMat);

  /* where the hand rests in the camera's frame, and how it is turned (both set by its grip) */
  const rest = { pos: v(0.2, -0.108, -0.49), rot: new THREE.Euler(0.42, -2.3, 0.15, 'YXZ') };
  const pivot = new THREE.Group();
  pivot.name = 'hand-R';
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), skinMat);
  mesh.frustumCulled = false; mesh.renderOrder = 10;
  pivot.add(mesh);
  // where a held thing sits, turned to face you whatever the hand's turn
  const anchor = new THREE.Group();
  pivot.add(anchor);
  view.add(pivot);
  const R = { pivot, mesh, anchor, rest, off: v(0, 0, 0), turn: new THREE.Euler(0, 0, 0, 'XYZ'), eat: 0 };

  /* ------------------------------ state ------------------------------ */
  let up = 0, want = 0;          // 0 down out of view .. 1 raised
  let t = 0, hold = null;
  const api = {
    view, R, skinMat,
    /** Where what you hold sits. */
    anchor,
    get up() { return up; },
    get hold() { return hold; },
    /** Raise (true) or lower (false) the hand. */
    raise(on) { want = on ? 1 : 0; },
    /** Put it straight up or down (dev shots). */
    snap(on) { want = up = on ? 1 : 0; },
    /**
     * Close the hand on a thing: `kind` one of HOLDS (holdFor gives a product's); `rot` the thing's own turn in the
     * anchor's frame and `at` its centre there (the anchor faces you).  The hand is turned and placed to it, so the
     * thing itself stays exactly where it was.
     */
    setHold(kind, { rot = null, at = null } = {}) {
      const [name, o] = HOLDS[kind] ?? HOLDS.onigiri;
      const g = GRIP[name](o);
      hold = kind;
      mesh.geometry = g.geometry;
      _qh.copy(_face);
      if (rot) _qh.multiply(_qi.setFromEuler(_te.set(rot[0], rot[1], rot[2], 'XYZ')));
      _qh.multiply(g.q);                                    // the hand's frame in the camera's
      rest.rot.setFromQuaternion(_qh, 'YXZ');
      anchor.position.copy(g.A);
      if (at) anchor.position.sub(_va.set(at[0], at[1], at[2]).applyQuaternion(_face).applyQuaternion(_qi.copy(_qh).invert()));
      rest.pos.copy(ITEM_AT).sub(_va.copy(anchor.position).applyQuaternion(_qh));
    },
    /** The hand's grip turn (its rest: each hold turns the hand to what it holds, eaten or carried). */
    grip(h, out) { return out.setFromEuler(h.rest.rot); },
    update(dt, bob = 0, camera = null) {
      t += dt;
      // rising pops up with a little overshoot; lowering is quicker and plain
      if (want > up) up = Math.min(1, up + dt / 0.55); else if (want < up) up = Math.max(0, up - dt / 0.4);
      const k = want ? easeBack(clamp01(up)) : ease(clamp01(up));
      pivot.position.copy(rest.pos).add(R.off);
      pivot.position.y += (1 - k) * -0.42 + Math.sin(bob) * 0.006 + Math.sin(t * 1.3 + 1) * 0.0025;
      pivot.position.x += Math.cos(bob * 0.5) * 0.004;
      // its grip, then `turn` in the camera's own terms (x tips the top toward you)
      api.grip(R, _qr);
      pivot.quaternion.setFromEuler(_te.set(R.turn.x, R.turn.y, R.turn.z, 'XYZ')).multiply(_qr);
      pivot.visible = up > 0.001;
      // what the hand holds faces you, turned only by `turn`
      anchor.quaternion.copy(_qr).invert().multiply(_face);
      // the key light for the painted hand stays over your shoulder as you turn
      if (camera) skinMat.uniforms.uLight.value.copy(_key).applyQuaternion(camera.quaternion).normalize();
    },
  };
  api.setHold('onigiri');
  return api;
}
const _face = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, 0));
const _key = new THREE.Vector3(-0.45, 0.75, 0.55);
const _qr = new THREE.Quaternion(), _qh = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _te = new THREE.Euler(), _va = new THREE.Vector3();
