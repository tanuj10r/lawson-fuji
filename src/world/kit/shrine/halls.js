import { boxG, cylG, ext, gableFill, nagareRoof, xf } from './geo.js';
import { shimenawaSpan } from './torii.js';

/* ------------------------------------------------------------------ *
 * The halls, in the shrine's frame (x across, z back, y up).
 *
 *   haiden   拝殿, the worship hall: a stone base, vermilion posts, white
 *            walls, lattice doors, a veranda with its rail and steps, and
 *            the nagare-zukuri roof, its front slope sweeping on over the
 *            steps to the two front posts (向拝) where the bell hangs
 *   honden   本殿, the small sanctuary behind, raised, doors shut, inside
 *            its own vermilion fence (瑞垣)
 * ------------------------------------------------------------------ */

/** A roof into an adder: copper top, vermilion underside, bargeboards, ridge. */
export function roof(P, o) {
  const R = nagareRoof(o);
  P.add('roof', R.top);
  for (const g of R.under) P.add('under', g);
  for (const g of R.hafu) P.add(o.hafu ?? 'hafu', g);
  const rw = 2 * o.hw + 0.12, k = Math.min(1, o.t / 0.14);
  P.add('roofDark', boxG(rw, 0.13 * k, 0.2 * k, { y: o.yr + 0.05 * k, z: o.zr }));
  P.add('roofDark', boxG(rw + 0.04, 0.05 * k, 0.26 * k, { y: o.yr + 0.13 * k, z: o.zr }));
  // gilt caps where the ridge ends (the halls only)
  if (o.hw > 1.2) for (const s of [-1, 1]) P.add('gold', boxG(0.06, 0.2 * k, 0.24 * k, { x: s * (rw / 2 + 0.02), y: o.yr + 0.06 * k, z: o.zr }));
  return R;
}

/** A lattice (格子) between x0 and x1, y0 and y1, at z: bars over a dark back. */
function lattice(P, x0, x1, y0, y1, z, step = 0.11) {
  P.add('shadow', ext(x0, x1, y0, y1, z + 0.03, z + 0.05));
  for (let x = x0 + step / 2; x < x1; x += step) P.add('red', ext(x - 0.018, x + 0.018, y0, y1, z - 0.01, z + 0.02));
  for (let y = y0 + 0.16; y < y1; y += 0.32) P.add('red', ext(x0, x1, y - 0.015, y + 0.015, z - 0.02, z + 0.01));
  P.add('red', ext(x0, x1, y0 - 0.04, y0, z - 0.03, z + 0.03));
}

/**
 * The haiden, body z from zF to zB.  Returns the places the rest of the
 * shrine hangs things from: the bell beam, the veranda, the eave corners.
 */
export function haiden(parts, { zF = 12.6, zB = 15.0 } = {}) {
  const P = parts;
  const hx = 2.1, floor = 0.62, top = 2.75;
  const zK = 11.45;                           // the front posts (向拝柱)
  // the stone base (基壇) and its step
  P.add('stone', ext(-2.75, 2.75, 0, 0.3, zF - 0.55, zB + 0.45));
  P.add('stoneDark', ext(-2.8, 2.8, 0, 0.06, zF - 0.6, zB + 0.5));
  // the floor and the veranda (縁) round the front and sides
  P.add('wood', ext(-2.45, 2.45, 0.3, floor, zF - 0.45, zB + 0.25));
  P.add('woodDark', ext(-2.4, 2.4, 0.3, floor - 0.06, zF - 0.4, zB + 0.2));
  // the posts
  const posts = [];
  for (const x of [-hx, -0.7, 0.7, hx]) posts.push([x, zF], [x, zB]);
  for (const x of [-hx, hx]) posts.push([x, (zF + zB) / 2]);
  for (const [x, z] of posts) P.add('red', cylG(0.1, 0.105, top - floor, 10, { x, y: (floor + top) / 2, z }));
  // head beams (頭貫) and the rails (長押) all round
  for (const [y, h] of [[top - 0.08, 0.16], [2.2, 0.1], [0.92, 0.1]]) {
    P.add('red', ext(-hx - 0.14, hx + 0.14, y - h / 2, y + h / 2, zF - 0.07, zF + 0.07));
    P.add('red', ext(-hx - 0.14, hx + 0.14, y - h / 2, y + h / 2, zB - 0.07, zB + 0.07));
    for (const s of [-1, 1]) P.add('red', ext(s * hx - 0.07, s * hx + 0.07, y - h / 2, y + h / 2, zF - 0.14, zB + 0.14));
  }
  // white walls: the sides and back, and the band over the doors
  for (const s of [-1, 1]) P.add('white', ext(s * hx - 0.04, s * hx + 0.04, floor, top - 0.16, zF + 0.1, zB - 0.1));
  P.add('white', ext(-hx + 0.1, hx - 0.1, floor, top - 0.16, zB - 0.04, zB + 0.04));
  P.add('white', ext(-hx + 0.1, hx - 0.1, 2.25, top - 0.16, zF - 0.03, zF + 0.03));
  // the front: three bays of lattice doors, the middle one opened a little
  lattice(P, -hx + 0.1, -0.8, 0.97, 2.15, zF);
  lattice(P, 0.8, hx - 0.1, 0.97, 2.15, zF);
  lattice(P, -0.6, -0.1, 0.97, 2.15, zF);
  lattice(P, 0.1, 0.6, 0.97, 2.15, zF);
  P.add('shadow', ext(-0.1, 0.1, 0.97, 2.15, zF + 0.1, zF + 0.12));
  // the veranda's rail (高欄), each side of the steps
  for (const s of [-1, 1]) {
    const x0 = s * 0.95, x1 = s * 2.45, z = zF - 0.4;
    for (const x of [x0, (x0 + x1) / 2, x1]) P.add('red', ext(x - 0.04, x + 0.04, floor, floor + 0.55, z - 0.04, z + 0.04));
    P.add('red', ext(Math.min(x0, x1), Math.max(x0, x1), floor + 0.5, floor + 0.56, z - 0.05, z + 0.05));
    P.add('red', ext(Math.min(x0, x1), Math.max(x0, x1), floor + 0.22, floor + 0.26, z - 0.03, z + 0.03));
    P.add('gold', cylG(0.045, 0.05, 0.1, 8, { x: x0, y: floor + 0.6, z }));
    for (const zz of [zF - 0.4 + 0.5, zB]) P.add('red', ext(s * 2.41, s * 2.49, floor, floor + 0.55, zz - 0.04, zz + 0.04));
    P.add('red', ext(s * 2.41, s * 2.49, floor + 0.5, floor + 0.56, zF - 0.45, zB + 0.1));
  }
  // the steps, wood with vermilion stringers
  const nSteps = 3, run = 0.24;
  for (let i = 0; i < nSteps; i++) {
    const z1 = zF - 0.45 - i * run, y = floor - (i + 1) * (floor / (nSteps + 0.2));
    P.add('wood', ext(-0.85, 0.85, 0, y + 0.05, z1 - run, z1));
  }
  for (const s of [-1, 1]) P.add('red', ext(s * 0.9 - 0.05, s * 0.9 + 0.05, 0, floor, zF - 0.45 - nSteps * run, zF - 0.45));
  // the front posts (向拝柱) on their stones, their beam, and the tie beams back to the hall
  for (const s of [-1, 1]) {
    P.add('stone', boxG(0.34, 0.16, 0.34, { x: s * 1.5, y: 0.08, z: zK }));
    P.add('red', boxG(0.17, 2.45, 0.17, { x: s * 1.5, y: 0.16 + 1.225, z: zK }));
    P.add('black', boxG(0.2, 0.12, 0.2, { x: s * 1.5, y: 0.22, z: zK }));
    P.add('red', ext(s * 1.5 - 0.06, s * 1.5 + 0.06, 2.34, 2.5, zK, zF));       // 海老虹梁, straightened
    P.add('gold', boxG(0.2, 0.05, 0.2, { x: s * 1.5, y: 2.62, z: zK }));
  }
  P.add('red', ext(-1.85, 1.85, 2.5, 2.68, zK - 0.08, zK + 0.08));             // the front beam, where the bell hangs
  // the roof: long, concave front slope over the steps to the front beam
  const R = roof(P, { hw: 2.95, zf: zK - 0.55, yf: 2.72, zr: (zF + zB) / 2 + 0.1, yr: 4.4, zb: zB + 0.95, yb: 3.05, t: 0.16, sori: 0.26, lip: 0.08 });
  // the gable ends (妻), white with their beams
  for (const s of [-1, 1]) {
    P.add('white', gableFill(s * (hx + 0.02), zF - 0.05, zB + 0.05, top - 0.02, R.yAt));
    P.add('red', xf(boxG(0.1, 0.14, zB - zF + 0.3, {}), { x: s * (hx + 0.05), y: top + 0.25, z: (zF + zB) / 2 }));
    P.add('red', xf(boxG(0.1, Math.max(0.2, R.yAt((zF + zB) / 2) - top - 0.3), 0.14, {}), { x: s * (hx + 0.05), y: top + 0.35 + Math.max(0.2, R.yAt((zF + zB) / 2) - top - 0.3) / 2, z: (zF + zB) / 2 }));
  }
  // rafters under the front eave, vermilion with white ends
  for (let x = -2.8; x <= 2.81; x += 0.2) {
    const z0 = zK - 0.45, z1 = zF - 0.1;
    const y0 = R.yAt(z0) - 0.04, y1 = R.yAt(z1) - 0.04;
    const len = Math.hypot(z1 - z0, y1 - y0);
    const g = boxG(0.06, 0.07, len, {});
    P.add('under', xf(g, { x, y: (y0 + y1) / 2, z: (z0 + z1) / 2, rx: -Math.atan2(y1 - y0, z1 - z0) }));
    P.add('white', boxG(0.062, 0.072, 0.02, { x, y: y0, z: z0 - 0.01 }));
  }
  // the shimenawa across the hall's front
  shimenawaSpan(P, -1.95, 1.95, 2.44, zF - 0.14, 0.14, 0.09);
  return { zK, zF, zB, floor, bellAt: { x: 0, y: 2.5, z: zK }, eave: { y: R.yAt(zK - 0.4), z: zK - 0.4, hw: 2.9 } };
}

/** The honden: a small raised sanctuary behind, in its own fence. */
export function honden(parts, { z0 = 16.5, z1 = 17.7 } = {}) {
  const P = parts;
  const hx = 0.8, floor = 0.95, top = 2.05;
  P.add('stone', ext(-1.45, 1.45, 0, 0.36, z0 - 0.55, z1 + 0.5));
  // raised on short posts, a floor, the body
  for (const x of [-hx, 0, hx]) for (const z of [z0, z1]) P.add('red', cylG(0.075, 0.075, floor - 0.36, 8, { x, y: (floor + 0.36) / 2, z }));
  P.add('wood', ext(-hx - 0.3, hx + 0.3, floor - 0.08, floor, z0 - 0.3, z1 + 0.15));
  for (const x of [-hx, hx]) for (const z of [z0, z1]) P.add('red', cylG(0.075, 0.075, top - floor, 8, { x, y: (floor + top) / 2, z }));
  for (const s of [-1, 1]) P.add('white', ext(s * hx - 0.03, s * hx + 0.03, floor, top - 0.1, z0 + 0.07, z1 - 0.07));
  P.add('white', ext(-hx, hx, floor, top - 0.1, z1 - 0.03, z1 + 0.03));
  // the doors, shut, with their gilt fittings
  P.add('under', ext(-hx + 0.08, hx - 0.08, floor + 0.05, top - 0.15, z0 - 0.03, z0 + 0.03));
  P.add('red', ext(-0.01, 0.01, floor + 0.05, top - 0.15, z0 - 0.04, z0 - 0.03));
  for (const y of [floor + 0.2, top - 0.35]) P.add('gold', ext(-hx + 0.1, hx - 0.1, y - 0.02, y + 0.02, z0 - 0.05, z0 - 0.03));
  P.add('red', ext(-hx - 0.1, hx + 0.1, top - 0.12, top, z0 - 0.06, z1 + 0.06));
  // its steps
  for (let i = 0; i < 3; i++) P.add('wood', ext(-0.45, 0.45, 0.36, floor - 0.1 - i * 0.18, z0 - 0.35 - (i + 1) * 0.2, z0 - 0.35 - i * 0.2));
  const R = roof(P, { hw: 1.3, zf: z0 - 0.95, yf: top - 0.05, zr: (z0 + z1) / 2 + 0.05, yr: 3.0, zb: z1 + 0.55, yb: 2.25, t: 0.11, sori: 0.15, lip: 0.05 });
  for (const s of [-1, 1]) P.add('white', gableFill(s * (hx + 0.02), z0 - 0.05, z1 + 0.05, top - 0.02, R.yAt));
  // the fence (瑞垣): vermilion posts and rails, open at the front
  const fx = 1.7, fz0 = z0 - 1.05, fz1 = z1 + 0.75, fh = 0.95;
  const run = (ax, az, bx, bz) => {
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, bz - az) / 0.45));
    for (let i = 0; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n;
      P.add('red', boxG(0.07, fh, 0.07, { x, y: fh / 2, z }));
    }
    for (const y of [fh - 0.08, 0.3]) {
      const g = boxG(Math.hypot(bx - ax, bz - az), 0.06, 0.05, {});
      P.add('red', xf(g, { x: (ax + bx) / 2, y, z: (az + bz) / 2, ry: -Math.atan2(bz - az, bx - ax) }));
    }
  };
  run(-fx, fz0, -fx, fz1);
  run(fx, fz0, fx, fz1);
  run(-fx, fz1, fx, fz1);
  run(-fx, fz0, -0.6, fz0);
  run(0.6, fz0, fx, fz0);
  return { fx, fz0, fz1 };
}

