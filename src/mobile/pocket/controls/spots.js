import { TUNE } from './tune.js';

/* ------------------------------------------------------------------ *
 * The places' usable spots (docs/pocket-diorama.md, the place contract:
 * spots [{ id, x, z, r, label, use(P) }]) for the one context button and
 * for tapping the thing itself.
 *
 *   spotHere   the spot you stand in (within its r), the nearest first;
 *              ahead of you wins a tie (within 0.5 m)
 *   spotTapped a tap at screen (x, y): the spot whose place (at `y` m,
 *              default 1 m up) is nearest the tap on screen, within
 *              TUNE.tap.radius px, in front of the camera and within
 *              TUNE.tap.reach m; only a handful of spots, so projecting
 *              each is cheap (no raycast, no meshes needed)
 * ------------------------------------------------------------------ */

export function spotHere(spots, pos, yaw = 0) {
  let best = null, bestD = Infinity;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  for (const s of spots) {
    if (s.enabled === false) continue;
    const dx = s.x - pos.x, dz = s.z - pos.z, d = Math.hypot(dx, dz);
    if (d > (s.r ?? 1.5)) continue;
    const ahead = d > 1e-3 ? (dx * fx + dz * fz) / d : 1;
    const score = d - 0.5 * Math.max(0, ahead);
    if (score < bestD) { best = s; bestD = score; }
  }
  return best;
}

export function spotTapped(spots, camera, x, y, { width = window.innerWidth, height = window.innerHeight } = {}) {
  const T = TUNE.tap;
  let best = null, bestD = T.radius;
  const c = camera.position, e = camera.matrixWorldInverse.elements, p = camera.projectionMatrix.elements;
  for (const s of spots) {
    if (s.enabled === false) continue;
    const sy = s.y ?? 1;
    if (Math.hypot(s.x - c.x, s.z - c.z) > Math.max(T.reach, s.r ?? 0)) continue;
    // world -> view -> clip (column-major matrices), by hand: no allocations
    const vx = e[0] * s.x + e[4] * sy + e[8] * s.z + e[12];
    const vy = e[1] * s.x + e[5] * sy + e[9] * s.z + e[13];
    const vz = e[2] * s.x + e[6] * sy + e[10] * s.z + e[14];
    if (vz > -0.2) continue;                                   // behind (or at) the eye
    const cx = p[0] * vx + p[4] * vy + p[8] * vz + p[12];
    const cy = p[1] * vx + p[5] * vy + p[9] * vz + p[13];
    const cw = p[3] * vx + p[7] * vy + p[11] * vz + p[15];
    const sx = (cx / cw * 0.5 + 0.5) * width, syPx = (0.5 - cy / cw * 0.5) * height;
    const d = Math.hypot(sx - x, syPx - y);
    if (d < bestD) { best = s; bestD = d; }
  }
  return best;
}
