import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Han's drive (Tan, 2026-09-28: "How can somebody drive a car over the
 * footpath like that?").  The route keeps to the roads, driving on the
 * left as in Japan, in the town frame (the main road is +z of the car
 * park; its eastbound lane on the car park's side):
 *
 *   backs out of the bay into the car park's aisle, nose to the east;
 *   along the aisle and out of its east mouth onto the bridge road;
 *   north to the master junction, across into the westbound lane;
 *   flat out west past the store, brakes, and flicks the car round
 *   (a handbrake 180) on NIPPON's empty forecourt, which meets the road
 *   with no kerb; back out into the eastbound lane, and drifts through
 *   the master junction onto the bridge road, south; into the car park's
 *   mouth, and nose first into the bay.
 *
 * scripts/_han-route.mjs checks that the car's four corners never leave
 * the roads, the car park and its mouth: run it after any change here.
 * No DOM: node imports this file.
 * ------------------------------------------------------------------ */

export const T_DRIVE = 12.6;   // the drive, out and back to the bay (fitted to the song)
const Q = Math.PI / 2;

/* The route, as a turtle: straights and arcs, forward or in reverse, each
 * with a speed at its start and end (so its time follows), a drift angle
 * for the slides, and `launch` for the wheelspin smoke.  Heading th:
 * forward = (cos, sin). */
export const ROUTE = [
  { len: 0.9, rev: true, v0: 0, v1: 2 },                                   // back out of the bay
  { len: 3.3 * Q, R: 3.3, turn: -1, rev: true, v0: 2, v1: 2 },             // swinging the nose round to the east
  { hold: 0.3 },                                                           // into first
  { len: 5.65, v0: 0, v1: 5 },                                             // along the aisle, out of its mouth
  { len: 3.5 * Q, R: 3.5, turn: 1, v0: 5, v1: 5 },                         // onto the bridge road (one lane: its middle)
  { len: 7.6, v0: 5, v1: 6 },                                              // north to the master junction
  { len: 4.5 * Q, R: 4.5, turn: 1, v0: 6, v1: 7 },                         // across into the westbound lane
  { len: 14.5, v0: 7, v1: 18, launch: true },                              // flat out, west past the store
  { len: 6, v0: 18, v1: 10 },                                              // brake
  { len: 3.0 * Math.PI, R: 3.0, turn: -1, v0: 10, v1: 7, drift: -0.62 },   // flick it round on the store's empty forecourt
  { len: 2.8 * Q, R: 2.8, turn: -1, v0: 7, v1: 7 },                        // and back out onto the road ...
  { len: 4.1, v0: 7, v1: 8 },
  { len: 2.8 * Q, R: 2.8, turn: 1, v0: 8, v1: 9 },                         // ... into the eastbound lane
  { len: 10.5, v0: 9, v1: 16 },                                            // east
  { len: 5.7, v0: 16, v1: 11 },
  { len: 3.2 * Q, R: 3.2, turn: -1, v0: 11, v1: 6, drift: -0.55 },         // drift through the master junction onto the bridge road (a 4.6 m lane: the tail kept in)
  { len: 7.5, v0: 6, v1: 5 },                                              // south
  { len: 2 * Q, R: 2, turn: -1, v0: 4, v1: 3 },                            // into the car park's mouth
  { len: 1.45, v0: 3, v1: 3 },
  { len: 2.4 * Q, R: 2.4, turn: -1, v0: 3, v1: 2 },                        // nose first into the bay
  { len: 2.6, v0: 2, v1: 0 },
];

/** The drive from the bay `start` ({ x, z }, nose to the main road). */
export function buildDrive(start, route = ROUTE) {
  const segs = [];
  let x = start.x, z = start.z, th = Math.PI / 2;
  for (const o of route) {
    const { len = 0, R = 0, turn = 0, rev = false, v0 = 0, v1 = 0, hold = 0, drift = 0, launch = false } = o;
    const pts = [{ s: 0, x, z, th }];
    const n = Math.max(1, Math.ceil(len / 0.02));
    const ds = len / n;
    for (let i = 1; i <= n && len > 0; i++) {
      const dir = rev ? -1 : 1;
      if (R) {
        const dth = turn * ds / R;
        const mid = th + dth / 2;
        x += dir * Math.cos(mid) * ds; z += dir * Math.sin(mid) * ds;
        th += dth;
      } else {
        x += dir * Math.cos(th) * ds; z += dir * Math.sin(th) * ds;
      }
      pts.push({ s: i * ds, x, z, th });
    }
    const T = hold || (2 * len) / Math.max(0.01, v0 + v1);
    segs.push({ len, R, turn, rev, v0, v1, T, drift, launch, pts });
  }
  // fit it to the music: every segment's time scaled alike
  const total = segs.reduce((a, s) => a + s.T, 0);
  let t = 0, dist = 0;
  for (const s of segs) { s.T *= T_DRIVE / total; s.t0 = t; t += s.T; s.d0 = dist; dist += s.len; }
  return { segs, total: T_DRIVE, dist };
}

/** Where the car is at drive time t: position, heading, drift, distance run. */
export function driveAt(D, t, out = {}) {
  t = THREE.MathUtils.clamp(t, 0, D.total);
  let seg = D.segs[D.segs.length - 1];
  for (const s of D.segs) if (t <= s.t0 + s.T) { seg = s; break; }
  const u = seg.T > 0 ? (t - seg.t0) / seg.T : 1;
  // distance along the segment with speed going linearly v0 -> v1
  const k = seg.v0 + seg.v1 > 0 ? (seg.v0 * u + (seg.v1 - seg.v0) * u * u / 2) / ((seg.v0 + seg.v1) / 2) : 0;
  const sd = seg.len * k;
  const pts = seg.pts;
  const f = pts.length > 1 ? Math.min(pts.length - 1.001, (sd / Math.max(seg.len, 1e-6)) * (pts.length - 1)) : 0;
  const i = Math.floor(f), a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)], w = f - i;
  out.x = a.x + (b.x - a.x) * w;
  out.z = a.z + (b.z - a.z) * w;
  out.th = a.th + (b.th - a.th) * w;
  out.dist = seg.d0 + sd;
  out.speed = seg.v0 + (seg.v1 - seg.v0) * u;
  out.rev = seg.rev;
  // the slides: tail out through each drifting arc, eased in and caught after
  let drift = 0;
  for (const s of D.segs) {
    if (!s.drift) continue;
    const mid = s.t0 + s.T / 2, half = s.T / 2 + 0.45;
    const q = (t - mid) / half;
    if (Math.abs(q) < 1) drift += s.turn * s.drift * Math.cos(q * Math.PI / 2) ** 1.5 * (q > 0 ? 1 - 0.3 * q : 1);
  }
  out.drift = drift;
  out.steer = seg.R ? THREE.MathUtils.clamp(seg.turn * Math.atan(2.43 / seg.R) * (seg.rev ? -1 : 1), -0.6, 0.6) : 0;
  if (drift) out.steer = THREE.MathUtils.clamp(out.steer - drift * 1.1, -0.6, 0.6);   // counter-steer
  out.sliding = Math.abs(drift) > 0.18;
  out.launch = seg.launch && u < 0.25;
  return out;
}
