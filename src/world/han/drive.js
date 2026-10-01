import { HAN_DRIVE as C } from '../../config.js';

/* ------------------------------------------------------------------ *
 * Han's drive (Tan, 2026-09-28: "How can somebody drive a car over the
 * footpath like that?"; 2026-10-02: "The drift feels very fake").  The
 * route keeps to the roads, in the town frame (the main road is +z of the
 * car park):
 *
 *   backs out of the bay into the car park's aisle, nose to the east;
 *   wheelspin along the aisle, out of its east mouth onto the bridge road;
 *   north into the master junction, braking;
 *   a feint to the east, the handbrake, and the tail steps out: one long
 *   slide round to the west over the mouth of NIPPON's forecourt (which
 *   meets the road with no kerb), three quarters of a circle and more,
 *   back across its own line;
 *   the tail thrown the other way (the transition) into the bridge road,
 *   caught with a wobble, south;
 *   into the car park's mouth, and nose first into the bay.
 *
 * The old route (a run west past the store, a 180, a run back, a second
 * slide) was 115 m in 12.6 s: its slides lasted 0.6 and 0.3 s at speeds no
 * car corners at.  This one is 80 m, and what moves it is a car's limits,
 * not a stopwatch: the path's curvature is eased, the speed along it is
 * the most that grip, the brakes and the engine allow (so it brakes before
 * a turn, turns, and powers out), and only then is the whole thing scaled
 * (a few per cent) to the song.
 *
 * On top of the path, a little dynamics, stepped once at build (120 Hz)
 * so any moment can be asked for: the slip angle is a damped spring
 * chasing each slide's angle (so the tail steps out, holds, swaps sides and
 * is caught with an overshoot), the front wheels steer into a turn while
 * the car grips and against the slip while it slides, the body rolls
 * outward and pitches with the brakes and the throttle, the rear wheels
 * lock under the handbrake and then spin faster than the road.
 *
 * Signs: heading th, forward = (cos th, sin th); +th turns toward the
 * car's right (its +z).  Steer, slip and turn are all positive that way.
 *
 * scripts/_han-route.mjs checks that the car's four corners never leave
 * the roads, and that the wheels steer the right way: run it after any
 * change here.  No DOM, no three: node imports this file.
 * ------------------------------------------------------------------ */

export const T_DRIVE = 12.6;   // the drive, out and back to the bay (fitted to the song)
const Q = Math.PI / 2;
const WHEELBASE = 2.43;        // rx7.js RX7.axle (f - r)
const DS = 0.05;               // the path's sampling (m)
const HZ = 120;                // the dynamics' step

/* The teardrop in the junction, worked out so it closes: north on the bridge
 * road at x `xIn`, a feint east (radius rf, angle a), the slide west round
 * (radius r, 270 deg + a), the transition (radius re, 90 deg) onto the bridge
 * road south at x `xOut`. */
const T = C.teardrop;
const xa = T.xIn + T.rf * (1 - Math.cos(T.a));
const xc = xa - T.r * Math.cos(T.a);
const xOut = xc + T.re;
const zc = T.z + T.rf * Math.sin(T.a) + T.r * Math.sin(T.a);
const zOut = zc - T.r - T.re;

/* The route, as a turtle: straights and arcs, forward or in reverse.  `v`
 * caps the speed (m/s, before the fit to the song), `slip` is the slide's
 * angle (rad, tail out of the turn), `handbrake` locks the rear wheels as it
 * starts, `launch` spins them from rest. */
export const ROUTE = [
  { len: 0.9, rev: true, v: 3.6 },                                         // back out of the bay
  { len: 3.3 * Q, R: 3.3, turn: -1, rev: true, v: 3.6 },                   // swinging the nose round to the east
  { len: 0.7, rev: true, v: 3.6 },                                         // the wheel straightened as it stops
  { hold: 0.3 },                                                           // into first
  { len: T.xIn - 3.5 - 20.15, v: 9, launch: true },                        // along the aisle, out of its mouth
  { len: 3.5 * Q, R: 3.5, turn: 1, v: 9 },                                 // onto the bridge road
  { len: T.z - 4.0, v: 11 },                                               // north into the master junction
  { len: T.rf * T.a, R: T.rf, turn: -1, v: T.v + 1, slip: T.feint },       // the feint: a flick to the east
  { len: T.r * (3 * Q + T.a), R: T.r, turn: 1, v: T.v, slip: T.slip, handbrake: true },   // the slide, round to the west and back across its own line
  { len: T.re * Q, R: T.re, turn: -1, v: T.v, slip: T.slipOut },           // the transition: the tail thrown the other way, into the bridge road
  { len: zOut - 1.7, v: 8 },                                               // south, caught
  { len: 2 * Q, R: 2, turn: -1, v: 5 },                                    // into the car park's mouth
  { len: xOut - 2 - 26.55, v: 5 },
  { len: 2.4 * Q, R: 2.4, turn: -1, v: 4.2 },                              // nose first into the bay
  { len: 2.6, v: 4 },
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const u = clamp((v - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };

/** The drive from the bay `start` ({ x, z }, nose to the main road). */
export function buildDrive(start, route = ROUTE) {
  /* 1. the turtle, in runs (a run ends where the car stops: a hold, a change of direction) */
  const runs = [];
  let x = start.x, z = start.z, th = Math.PI / 2, run = null;
  route.forEach((o, k) => {
    const { len = 0, R = 0, turn = 0, rev = false, hold = 0 } = o;
    if (hold) { runs.push({ hold }); run = null; return; }
    if (!run || run.rev !== rev) { run = { rev, pts: [{ x, z, th, k }] }; runs.push(run); }
    const n = Math.max(1, Math.round(len / DS)), ds = len / n, dir = rev ? -1 : 1;
    for (let i = 1; i <= n; i++) {
      const dth = R ? turn * ds / R : 0, mid = th + dth / 2;
      x += dir * Math.cos(mid) * ds; z += dir * Math.sin(mid) * ds; th += dth;
      run.pts.push({ x, z, th, k });
    }
  });

  /* 2. ease the curvature (a wheel is turned, not snapped): each point the mean of its neighbours over `ease` m,
   * the window closing toward a run's ends so they stay put; then the heading and curvature of what is left;
   * 3. the speed: the most the grip (v^2 k), the segment's cap, the engine and the brakes allow */
  let total = 0;
  for (const r of runs) {
    if (r.hold) { total += r.hold; continue; }
    const P = r.pts, n = P.length, W = Math.round(C.ease / DS), dir = r.rev ? -1 : 1;
    const S = P.map((p, i) => {
      const w = Math.min(W, i, n - 1 - i);
      let sx = 0, sz = 0;
      for (let j = i - w; j <= i + w; j++) { sx += P[j].x; sz += P[j].z; }
      return { x: sx / (2 * w + 1), z: sz / (2 * w + 1), k: p.k, th: p.th };
    });
    let s = 0;
    for (let i = 0; i < n; i++) {
      const a = S[Math.max(0, i - 1)], b = S[Math.min(n - 1, i + 1)];
      let h = Math.atan2(dir * (b.z - a.z), dir * (b.x - a.x));
      h += Math.round((P[i].th - h) / (2 * Math.PI)) * 2 * Math.PI;         // unwrapped, by the turtle's own heading
      S[i].th = h;
      if (i) s += Math.hypot(S[i].x - S[i - 1].x, S[i].z - S[i - 1].z);
      S[i].s = s;
    }
    for (let i = 0; i < n; i++) {
      const a = S[Math.max(0, i - 1)], b = S[Math.min(n - 1, i + 1)];
      S[i].kap = (b.th - a.th) / Math.max(1e-6, b.s - a.s);                // dth per metre travelled
    }
    const acc = r.rev ? C.accRev : C.acc, brk = r.rev ? C.accRev : C.brake;
    for (let i = 0; i < n; i++) {
      const o = route[S[i].k];
      S[i].v = Math.min(o.v ?? 6, Math.sqrt((o.slip ? C.latSlide : C.lat) / Math.max(1e-4, Math.abs(S[i].kap))));
    }
    S[0].v = S[n - 1].v = 0;
    for (let i = 1; i < n; i++) S[i].v = Math.min(S[i].v, Math.sqrt(S[i - 1].v ** 2 + 2 * acc * (S[i].s - S[i - 1].s)));
    for (let i = n - 2; i >= 0; i--) S[i].v = Math.min(S[i].v, Math.sqrt(S[i + 1].v ** 2 + 2 * brk * (S[i + 1].s - S[i].s)));
    S[0].t = 0;
    for (let i = 1; i < n; i++) S[i].t = S[i - 1].t + 2 * (S[i].s - S[i - 1].s) / (S[i].v + S[i - 1].v);
    r.S = S; r.T = S[n - 1].t;
    total += r.T;
  }

  /* 4. fitted to the music (every time scaled alike), and laid out on one clock at HZ */
  const fit = T_DRIVE / total;
  const N = Math.round(T_DRIVE * HZ) + 1;
  const A = {};
  for (const key of ['px', 'pz', 'th', 'v', 'kap', 'x', 'z', 'slip', 'steer', 'roll', 'pitch', 'front', 'rear', 'slide']) A[key] = new Float32Array(N);
  const seg = new Uint8Array(N), rev = new Uint8Array(N);
  {
    let t0 = 0, ri = 0, i = 0;
    let last = { x: start.x, z: start.z, th: Math.PI / 2, k: 0 };
    for (let n = 0; n < N; n++) {
      const t = Math.min(T_DRIVE - 1e-6, n / HZ);
      while (ri < runs.length - 1 && t >= t0 + (runs[ri].hold ?? runs[ri].T) * fit) { t0 += (runs[ri].hold ?? runs[ri].T) * fit; ri++; i = 0; }
      const r = runs[ri];
      if (r.hold) { A.px[n] = last.x; A.pz[n] = last.z; A.th[n] = last.th; seg[n] = last.k; continue; }
      const S = r.S, u = (t - t0) / fit;
      while (i < S.length - 2 && S[i + 1].t <= u) i++;
      const a = S[i], b = S[i + 1], w = clamp((u - a.t) / Math.max(1e-9, b.t - a.t), 0, 1);
      // within a step the speed runs linearly in time: the distance is its integral
      const f = a.v + b.v > 0 ? (a.v * w + (b.v - a.v) * w * w / 2) / ((a.v + b.v) / 2) : w;
      A.px[n] = a.x + (b.x - a.x) * f; A.pz[n] = a.z + (b.z - a.z) * f;
      A.th[n] = a.th + (b.th - a.th) * f; A.kap[n] = a.kap + (b.kap - a.kap) * f;
      A.v[n] = (r.rev ? -1 : 1) * (a.v + (b.v - a.v) * w) / fit;
      seg[n] = a.k; rev[n] = r.rev ? 1 : 0;
      last = { x: A.px[n], z: A.pz[n], th: A.th[n], k: a.k };
    }
    const e = runs[runs.length - 1].S.at(-1);
    A.px[N - 1] = e.x; A.pz[N - 1] = e.z; A.th[N - 1] = e.th; A.v[N - 1] = 0;
  }

  /* 5. the dynamics, stepped along it */
  const dt = 1 / HZ, lead = Math.round(C.lead * HZ);
  let slip = 0, slipV = 0, steer = 0, roll = 0, rollV = 0, pitch = 0, pitchV = 0, front = 0, rear = 0, held = 0, hot = 0;
  for (let n = 0; n < N; n++) {
    const v = A.v[n], sp = Math.abs(v), t = n / HZ;
    // the slide's angle: what the segment a moment ahead asks for (the hands lead the car), the throttle wavering
    const o = route[seg[Math.min(N - 1, n + lead)]], here = route[seg[n]];
    const want = (o.slip ?? 0) * (o.turn ?? 0) * (Math.abs(o.slip ?? 0) > 0.3 ? 1 + C.waver * Math.sin(t * C.waverHz * 2 * Math.PI) : 1);
    slipV += (C.spring ** 2 * (want - slip) - 2 * C.damp * C.spring * slipV) * dt;
    slip += slipV * dt;
    if (sp < 0.5) { slip *= sp / 0.5; slipV *= sp / 0.5; }
    A.slip[n] = slip;
    // the handbrake: the rear wheels locked as the slide starts
    held = o.handbrake && !route[seg[Math.max(0, n + lead - Math.round(C.handbrake * HZ))]].handbrake ? 1 : 0;
    // the front wheels: into the turn while it grips; against the slip while it slides
    const grip = Math.atan(WHEELBASE * A.kap[n]) * (rev[n] ? -1 : 1);
    // (thrown from one side to the other the slip passes through nothing: the hands go across with it, they
    // don't steer back into the turn on the way)
    hot = Math.abs(slip) > 0.3 ? 0.4 : hot - dt;
    const w = smooth(0.05, 0.22, Math.max(Math.abs(slip), hot > 0 ? Math.abs(slipV) * 0.12 : 0));
    const aim = clamp(grip * (1 - w) + (C.counter * -slip + C.counterTurn * grip) * w, -C.lock, C.lock);
    steer += (aim - steer) * Math.min(1, dt / C.hands);
    A.steer[n] = steer;
    // how hard the rear tyres are sliding (smoke, marks, squeal): the slide, the locked wheels, the launch
    const m = n > 0 ? n - 1 : 0, p = n < N - 1 ? n + 1 : n;
    const along = (A.v[p] - A.v[m]) * HZ / Math.max(1, p - m);
    const launch = here.launch && v > 0.2 && v < C.launchV ? 1 - v / C.launchV : 0;
    const slide = clamp(Math.max(smooth(0.14, 0.4, Math.abs(slip)), held, launch * 0.7) * smooth(0.8, 2.5, sp + launch * 3), 0, 1);
    A.slide[n] = slide;
    // the wheels: the fronts roll with the road, the rears lock, then spin past it
    front += v * dt;
    rear += held ? 0 : (v + (v >= 0 ? 1 : -1) * (sp * C.spin * smooth(0.14, 0.4, Math.abs(slip)) + launch * C.launchSpin)) * dt;
    A.front[n] = front; A.rear[n] = rear;
    // the body: rolls out of the turn, squats on the throttle, dives on the brakes
    const side = v * (A.th[p] - A.th[m]) * HZ / Math.max(1, p - m);          // toward the car's right
    const wantR = -C.roll * Math.tanh(side / C.rollAt);
    rollV += (C.body ** 2 * (wantR - roll) - 2 * C.bodyDamp * C.body * rollV) * dt; roll += rollV * dt;
    const wantP = C.pitch * Math.tanh(along / C.pitchAt) + C.squat * slide;
    pitchV += (C.body ** 2 * (wantP - pitch) - 2 * C.bodyDamp * C.body * pitchV) * dt; pitch += pitchV * dt;
    A.roll[n] = roll; A.pitch[n] = pitch;
    // the body's middle: the nose keeps the line, the tail swings (it turns about a point ahead of its middle)
    const h = A.th[n], psi = h + slip;
    A.x[n] = A.px[n] + C.pivot * (Math.cos(h) - Math.cos(psi));
    A.z[n] = A.pz[n] + C.pivot * (Math.sin(h) - Math.sin(psi));
  }
  // home: square in the bay, the wheels straight
  const e = N - 1;
  A.x[e] = A.px[e]; A.z[e] = A.pz[e]; A.slip[e] = 0; A.roll[e] = 0; A.pitch[e] = 0;
  const dist = runs.reduce((a, r) => a + (r.S ? r.S.at(-1).s : 0), 0);
  return { A, seg, rev, N, total: T_DRIVE, dist, fit, route, teardrop: { xc, zc, xOut, zOut } };
}

/** Where the car is at drive time t: its middle (x, z), the path's heading `th` and the body's `psi` (= th + drift),
 * the steer angle, roll and pitch, the distance its front and rear wheels have turned through, how hard it slides. */
export function driveAt(D, t, out = {}) {
  const A = D.A, f = clamp(t, 0, D.total) * HZ, i = Math.min(D.N - 2, Math.floor(f)), w = f - i;
  const L = (a) => a[i] + (a[i + 1] - a[i]) * w;
  out.x = L(A.x); out.z = L(A.z);
  out.px = L(A.px); out.pz = L(A.pz);
  out.th = L(A.th);
  out.drift = L(A.slip);
  out.psi = out.th + out.drift;
  out.v = L(A.v);
  out.speed = Math.abs(out.v);
  out.kap = L(A.kap);
  out.steer = L(A.steer);
  out.roll = L(A.roll); out.pitch = L(A.pitch);
  out.dist = L(A.front); out.rear = L(A.rear);
  out.slide = L(A.slide);
  out.sliding = out.slide > 0.25;
  out.rev = !!D.rev[i];
  out.seg = D.seg[i];
  return out;
}
