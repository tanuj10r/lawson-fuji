import * as THREE from 'three';
import { TOWN, STREET, LAWSON, HERO_VIEWS, SLOWLIFE, ANIMALS } from '../../config.js';
import { pondShore } from '../land/pond.js';
import { HAN_BAY, HAN_SHOW } from '../han/index.js';
import { buildDrive, driveAt, T_DRIVE } from '../han/drive.js';
import { shibaGeometry, RIG, SHADOW } from './shiba.js';
import { animalMaterial, Herd, ease, turn } from './shade.js';

/* ------------------------------------------------------------------ *
 * The guide (Tan, 2026-09-28): a shiba that leads you to the town's
 * engagements one at a time, instead of a dog trailing behind where you
 * would never see it.
 *
 * It waits on the far pavement behind the famous view (out of every hero
 * frame) and comes trotting when you walk off.  It leads to the nearest
 * engagement you have not done, three to six metres ahead along the way,
 * stops to look back over its shoulder, sits and tilts its head if you
 * lag or turn away, and goes on when you follow.  At the spot it sits
 * beside the ring until you step in, then leads to the next.  If you
 * wander off it follows at a distance and tries again later.  When every
 * engagement is done it naps beside the slow-life bench.
 *
 * The way: a coarse walkable grid of the town (world frame) built from the
 * colliders, the ground's height (the river's channel is sunk), the pond's
 * shore and the road layout, with pavements cheap, asphalt dear and the
 * zebras cheap again, so it keeps to the pavements and crosses at the
 * crossings.  For each goal one distance field (Dijkstra, spread over
 * frames) is grown from the goal; the dog descends it, and the field tells
 * how far ahead of you it is along the way, not as the crow flies.
 *
 * One instanced draw, no collider (it steps aside from you instead), and
 * it keeps off the RX-7's route while Han's show runs.
 * ------------------------------------------------------------------ */

const A = ANIMALS.guide;
const INF = Infinity;
const ENGAGE = A.engage;

/* ------------------------------ the grid ------------------------------ */
class Walk {
  constructor(ctx, core) {
    this.ctx = ctx; this.core = core; this.built = false;
  }
  build() {
    const t0 = performance.now();
    const ctx = this.ctx, C = A.cell;
    // the town's bounds are in its own (turned) frame: in the world's
    const b0 = ctx.toWorld({ x: TOWN.bounds.x0, z: TOWN.bounds.z0 }), b1 = ctx.toWorld({ x: TOWN.bounds.x1, z: TOWN.bounds.z1 });
    const B = { x0: Math.min(b0.x, b1.x), x1: Math.max(b0.x, b1.x), z0: Math.min(b0.z, b1.z), z1: Math.max(b0.z, b1.z) };
    const X0 = this.X0 = B.x0, Z0 = this.Z0 = B.z0;
    const nx = this.nx = Math.ceil((B.x1 - B.x0) / C), nz = this.nz = Math.ceil((B.z1 - B.z0) / C);
    const N = this.N = nx * nz;
    const K = A.costs;
    const cost = this.cost = new Uint8Array(N).fill(K.ground);
    const h = this.h = new Int16Array(N);
    this.haz = new Uint8Array(N);
    this.C = C;
    const rect = (x0, z0, x1, z1, fn) => {
      const ix0 = Math.max(0, Math.floor((Math.min(x0, x1) - X0) / C)), ix1 = Math.min(nx - 1, Math.floor((Math.max(x0, x1) - X0) / C));
      const iz0 = Math.max(0, Math.floor((Math.min(z0, z1) - Z0) / C)), iz1 = Math.min(nz - 1, Math.floor((Math.max(z0, z1) - Z0) / C));
      for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) fn(iz * nx + ix);
    };
    const paint = (v) => (i) => { if (cost[i]) cost[i] = v; };
    const W = (p) => ctx.toWorld(p);
    const wrect = (x0, z0, x1, z1, v) => { const a = W({ x: x0, z: z0 }), b = W({ x: x1, z: z1 }); rect(a.x, a.z, b.x, b.z, paint(v)); };

    /* the ground: its height, and nothing below street level (the channel) */
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const i = iz * nx + ix;
      const p = ctx.toLocal({ x: X0 + (ix + 0.5) * C, z: Z0 + (iz + 0.5) * C });
      const y = ctx.groundAt(p.x, p.z);
      h[i] = Math.round(y * 100);
      if (y < -0.05) cost[i] = 0;
    }
    /* the roads: pavements cheap, asphalt dear, the zebras cheap again */
    const net = this.core?.kit?.net, feats = this.core?.kit?.features;
    if (net) {
      const r4 = (e, s0, s1, o0, o1, v) => (e.axis === 'x' ? wrect(s0, e.c + o0, s1, e.c + o1, v) : wrect(e.c + o0, s0, e.c + o1, s1, v));
      for (const e of net.edges) {
        if (e.opts.surface === false) continue;
        if (e.spec.walk > 0) { r4(e, e.s0, e.s1, e.a, e.t, K.pavement); r4(e, e.s0, e.s1, -e.t, -e.a, K.pavement); }
      }
      for (const e of net.edges) if (e.opts.surface !== false) r4(e, e.a0, e.a1, -e.a, e.a, e.spec.walk > 0 ? K.asphalt : K.lane);
      for (const n of Object.values(net.nodes)) if (!n.external && n.ax > 0 && n.az > 0) wrect(n.x - n.ax, n.z - n.az, n.x + n.ax, n.z + n.az, n.edges.some((e) => e.spec.walk > 0) ? K.asphalt : K.lane);
      for (const c of feats?.crossings ?? []) r4(c.e, c.s - c.L / 2, c.s + c.L / 2, -c.e.a, c.e.a, K.pavement);
    }
    // the main road and what borders it (world frame): the store's forecourt,
    // the far pavement, the signalled zebra; the bridge road and the car park
    rect(STREET.roadX0, STREET.forecourtZ, STREET.roadX1, STREET.roadZ, paint(K.asphalt));
    rect(STREET.roadX0, STREET.roadZ, STREET.roadX1, STREET.sidewalkZ, paint(K.pavement));
    rect(STREET.x0, LAWSON.frontZ, STREET.x1, STREET.forecourtZ, paint(K.lot));
    rect(TOWN.crosswalk.x - TOWN.crosswalk.width / 2, STREET.forecourtZ, TOWN.crosswalk.x + TOWN.crosswalk.width / 2, STREET.roadZ, paint(K.pavement));
    // the road in front of the store's forecourt has no kerb (cars turn in off it): crossed there, as everyone does
    rect(STREET.bayX0, STREET.forecourtZ, STREET.bayX1, STREET.roadZ, paint(K.lot));
    { const t = TOWN.land.track; wrect(t.x - t.w / 2, t.z0, t.x + t.w / 2, t.z1, K.lane); }
    { const [x0, z0, x1, z1] = TOWN.land.parking; wrect(x0, z0, x1, z1, K.lot); }
    /* solid things: every collider a dog can't step over, with clearance */
    const R = A.radius;
    for (const c of ctx.colliders) {
      if ((c.bottom ?? 0) >= 0.8 || (c.top ?? 9) <= 0.3 || c.x1 - c.x0 < 0.01 || c.z1 - c.z0 < 0.01) continue;
      rect(c.x0 - R, c.z0 - R, c.x1 + R, c.z1 + R, (i) => { cost[i] = 0; });
    }
    // the store itself (its door opens for you, not for a dog) and Han's bay
    rect(-LAWSON.width / 2 - 0.4, -LAWSON.depth - 0.4, LAWSON.width / 2 + LAWSON.wingWidth + 0.4, LAWSON.frontZ + 0.35, (i) => { cost[i] = 0; });
    wrect(HAN_BAY.x - 1.3, HAN_BAY.z - 2.6, HAN_BAY.x + 1.3, HAN_BAY.z + 2.6, 0);
    /* the pond's water, with a margin */
    {
      const poly = pondShore().map((p) => W({ x: p.x, z: p.y }));
      let x0 = INF, z0 = INF, x1 = -INF, z1 = -INF;
      for (const p of poly) { x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x); z1 = Math.max(z1, p.z); }
      const m = 0.5;
      const inside = (x, z) => {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const a = poly[i], b = poly[j];
          if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
        }
        return c;
      };
      rect(x0 - m, z0 - m, x1 + m, z1 + m, (i) => {
        const x = X0 + ((i % nx) + 0.5) * C, z = Z0 + (((i / nx) | 0) + 0.5) * C;
        if (inside(x, z) || inside(x + m, z) || inside(x - m, z) || inside(x, z + m) || inside(x, z - m)) cost[i] = 0;
      });
    }
    /* the RX-7's way (han/drive.js), in the town frame: kept off while the show runs */
    {
      const D = buildDrive(HAN_BAY), p = {};
      for (let t = 0; t <= T_DRIVE; t += 0.08) {
        driveAt(D, t, p);
        const w = W({ x: p.x, z: p.z });
        rect(w.x - 2.2, w.z - 2.2, w.x + 2.2, w.z + 2.2, (i) => { this.haz[i] = 1; });
      }
    }
    this.built = true;
    this.ms = performance.now() - t0;
  }
  cell(x, z) {
    const ix = Math.floor((x - this.X0) / this.C), iz = Math.floor((z - this.Z0) / this.C);
    return ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz ? -1 : iz * this.nx + ix;
  }
  at(i) { return { x: this.X0 + ((i % this.nx) + 0.5) * this.C, z: this.Z0 + (((i / this.nx) | 0) + 0.5) * this.C }; }
  free(x, z) { const i = this.cell(x, z); return i >= 0 && this.cost[i] > 0; }
  /** The free cell nearest (x, z), within `r` metres; -1 if none. */
  nearest(x, z, r = 3, ok = null) {
    const c0 = this.cell(x, z);
    if (c0 < 0) return -1;
    const cx = c0 % this.nx, cz = (c0 / this.nx) | 0, R = Math.ceil(r / this.C);
    let best = -1, bd = INF;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const ix = cx + dx, iz = cz + dz;
      if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) continue;
      const i = iz * this.nx + ix;
      if (!this.cost[i] || (ok && !ok(i))) continue;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  /** Nothing solid on a straight line from a to b, nor a hand's width either side of it (no grazing a corner). */
  sight(ax, az, bx, bz) {
    const L = Math.hypot(bx - ax, bz - az) || 1, n = Math.ceil(L / (this.C * 0.4));
    const px = (-(bz - az) / L) * 0.14, pz = ((bx - ax) / L) * 0.14;
    for (let k = 1; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (!this.free(x, z) || !this.free(x + px, z + pz) || !this.free(x - px, z - pz)) return false;
    }
    return true;
  }
}

/* ---------------------- a distance field, grown over frames ---------------------- */
class Field {
  constructor(W) { this.W = W; this.d = new Float32Array(W.N); this.m = new Float32Array(W.N); this.heap = []; this.ready = false; this.limit = INF; }
  /** Grow from `cells` (distance 0), no farther than `limit` metres. */
  start(cells, limit = INF) {
    this.d.fill(INF); this.m.fill(INF); this.heap.length = 0; this.ready = false; this.limit = limit; this.fresh = true;
    for (const c of cells) if (c >= 0 && this.W.cost[c]) { this.d[c] = 0; this.m[c] = 0; this.push(c); }
    if (!this.heap.length) this.ready = true;
  }
  push(c) {
    const h = this.heap, d = this.d;
    h.push(c);
    let i = h.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (d[h[p]] <= d[h[i]]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; }
  }
  pop() {
    const h = this.heap, d = this.d, top = h[0], last = h.pop();
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < h.length && d[h[l]] < d[h[m]]) m = l;
        if (r < h.length && d[h[r]] < d[h[m]]) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]]; i = m;
      }
    }
    return top;
  }
  /** Some work, within `ms`. */
  work(ms) {
    if (this.ready) return;
    const W = this.W, d = this.d, m = this.m, cost = W.cost, h = W.h, nx = W.nx, nz = W.nz, C = W.C, step = Math.round(A.step * 100);
    const shut = (W.shut ??= new Uint8Array(W.N));
    if (this.fresh !== false || W.shutOf !== this) { shut.fill(0); this.fresh = false; W.shutOf = this; }
    const t0 = performance.now();
    let n = 0;
    while (this.heap.length) {
      const c = this.pop();
      if (shut[c]) continue;
      shut[c] = 1;
      if (d[c] > this.limit) { this.heap.length = 0; break; }
      const cx = c % nx, cz = (c / nx) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const ix = cx + dx, iz = cz + dz;
        if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) continue;
        const q = iz * nx + ix;
        if (!cost[q] || shut[q] || Math.abs(h[q] - h[c]) > step) continue;
        if (dx && dz && (!cost[cz * nx + ix] || !cost[iz * nx + cx])) continue;     // no corner cutting
        const len = (dx && dz ? Math.SQRT2 : 1) * C;
        const nd = d[c] + len * (cost[c] + cost[q]) / (2 * A.costs.pavement);
        if (nd < d[q]) { d[q] = nd; m[q] = m[c] + len; this.push(q); }
      }
      if ((++n & 255) === 0 && performance.now() - t0 > ms) return;
    }
    this.ready = true;
    this.fresh = true;
  }
  /** Metres along the cheapest way from (x, z) to the goal (the cost picks the way; this is its length). */
  at(x, z) { const c = this.W.cell(x, z); return c < 0 ? INF : this.m[c]; }
  /** The distance at (x, z), or the best near it (you may stand where a dog can't). */
  near(x, z) {
    let best = INF;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) best = Math.min(best, this.at(x + dx * this.W.C, z + dz * this.W.C));
    return best;
  }
  /** The next cell downhill from c; -1 at the goal (or off the field). */
  next(c) {
    const W = this.W, d = this.d, nx = W.nx, nz = W.nz;
    const cx = c % nx, cz = (c / nx) | 0;
    let best = -1, bd = d[c];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const ix = cx + dx, iz = cz + dz;
      if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) continue;
      const q = iz * nx + ix;
      if (dx && dz && (!W.cost[cz * nx + ix] || !W.cost[iz * nx + cx])) continue;
      if (d[q] < bd) { bd = d[q]; best = q; }
    }
    return best;
  }
}

/* --------------------------------- the dog --------------------------------- */
export function buildGuide(ctx, { spots, shadows, core, facing }) {
  const W = new Walk(ctx, core);
  const geo = shibaGeometry();
  const mat = animalMaterial({ key: 'shibaGuide', rig: RIG, tint: 0x7a6488 });
  const herd = new Herd(ctx, geo, mat, 1, 'shiba');
  herd.mesh.frustumCulled = false;
  const shadow = shadows.slot();
  const turned = ctx.turnedFrame ? Math.PI : 0;
  const HOME = { x: A.home[0], z: A.home[1] };
  const NAP = ctx.toWorld({ x: A.nap[0], z: A.nap[1] });
  const VIEW = { x: HERO_VIEWS.golden.play.pos[0], z: HERO_VIEWS.golden.play.pos[2] };
  const heroes = Object.values(HERO_VIEWS).map((v) => ({ x: v.play.pos[0], z: v.play.pos[2] }));
  const storeRect = { x0: -LAWSON.width / 2 - 1, x1: LAWSON.width / 2 + LAWSON.wingWidth + 1, z0: -LAWSON.depth - 1, z1: LAWSON.frontZ + 0.3 };
  const inStore = (p) => p.x > storeRect.x0 && p.x < storeRect.x1 && p.z > storeRect.z0 && p.z < storeRect.z1;

  /* the dog: where it is, how it stands, what it is doing */
  const G = {
    x: HOME.x, z: HOME.z, y: 0, yaw: Math.PI, speed: 0, roll: 0,
    ph: 0, amp: 0, look: 0, nod: 0, tilt: 0, wag: 0, wagA: 0, wagPh: 0, posture: 0, perk: 1, hop: 0, hopT: -1, shakeT: -1,
    state: 'home', target: null, done: new Set(['view']), t: 0, waitT: 0, sat: 0, lookT: 0, glance: 0, tiltT: -1, tiltNext: 3,
    lostT: 0, awayT: 0, hopped: null, field: null, goal: null, since: 0, resume: null, aside: null, moved: 0, thinkT: 0,
  };
  const P = { x: VIEW.x, z: VIEW.z, y: 1.6, vx: 0, vz: 0, speed: 0, first: true };
  let list = [], listT = 0;
  const fields = { follow: null };
  const ready = new Map();            // goal key -> a finished Field (every engagement's, grown ahead of need)
  const queue = [];                   // keys still to grow while nothing else is wanted
  const dbg = { paths: 0 };

  const rOf = (e) => e.r ?? ENGAGE[e.id] ?? 1.2;
  const isEngage = (e) => (e.kind ? e.kind === 'engage' : ENGAGE[e.id] !== undefined);
  const refresh = () => { list = (spots?.() ?? []).filter(isEngage); };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  /** Grow a field from a disc round (x, z); the dog thinks until it is ready (unless it was grown ahead). */
  const aim = (which, x, z, r, limit = INF) => {
    if (which !== 'follow') {
      const key = `${x.toFixed(1)},${z.toFixed(1)}`;
      if (ready.has(key)) return ready.get(key);
      const f = new Field(W);
      ready.set(key, f);
      grow(f, x, z, r, limit);
      dbg.paths++;
      return f;
    }
    const f = (fields[which] ??= new Field(W));
    grow(f, x, z, r, limit);
    dbg.paths++;
    return f;
  };
  const grow = (f, x, z, r, limit) => {
    const cells = [];
    const n = Math.max(1, Math.round(r / W.C));
    for (let dz = -n; dz <= n; dz++) for (let dx = -n; dx <= n; dx++) {
      if (dx * dx + dz * dz > n * n + 0.5) continue;
      const c = W.cell(x + dx * W.C, z + dz * W.C);
      if (c >= 0 && W.cost[c]) cells.push(c);
    }
    if (!cells.length) { const c = W.nearest(x, z, 4); if (c >= 0) cells.push(c); }
    f.start(cells, limit);
    f.goalAt = { x, z };
    return f;
  };
  /** Ahead of need: every engagement's field, home's and the nap's, one at a time while the dog isn't waiting on one. */
  const prefetch = () => {
    refresh();
    for (const e of list) if (!G.done.has(e.id)) queue.push(() => aim('goal', e.x, e.z, rOf(e) * 0.7));
    queue.push(() => aim('goal', NAP.x, NAP.z, 0.3));
  };
  let growing = null;
  const pickTarget = () => {
    refresh();
    let best = null, bd = INF;
    for (const e of list) {
      if (G.done.has(e.id)) continue;
      const d = dist(P, e);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };
  const lead = (e) => {
    G.target = e; G.state = 'lead'; G.hopped = null; G.aside = null; G.since = 0; G.lostT = 0; G.awayT = 0;
    G.field = aim('goal', e.x, e.z, rOf(e) * 0.7);
  };
  const goTo = (state, p, r = 0.3) => { G.state = state; G.goal = p; G.field = aim('goal', p.x, p.z, r); G.since = 0; };
  /** The goal is cut off from here: aim instead at the reachable cell nearest it. */
  const nearestReach = (goal) => {
    const f = aim('follow', G.x, G.z, 0.3, 400);
    while (!f.ready) f.work(50);
    let best = -1, bd = INF;
    for (let i = 0; i < W.N; i++) {
      if (f.m[i] === INF) continue;
      const q = W.at(i), d = (q.x - goal.x) ** 2 + (q.z - goal.z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) return null;
    const q = W.at(best);
    G.field = aim('goal', q.x, q.z, 0.3);
    return q;
  };
  const nextOrNap = () => { const e = pickTarget(); if (e) lead(e); else goTo('nap', NAP, 0.3); };
  /** Somewhere free beside the ring, off the line you come in on. */
  const beside = (e) => {
    const r = rOf(e) + 0.9;
    let best = null, bd = INF;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const q = { x: e.x + Math.sin(a) * r, z: e.z + Math.cos(a) * r };
      if (!W.free(q.x, q.z) || !W.sight(e.x, e.z, q.x, q.z)) continue;
      // not between you and the spot: keep at least a metre off the line you come in on
      const ux = P.x - e.x, uz = P.z - e.z, L = Math.hypot(ux, uz) || 1;
      const along = ((q.x - e.x) * ux + (q.z - e.z) * uz) / L;
      const off = Math.abs((q.x - e.x) * uz - (q.z - e.z) * ux) / L;
      if (along > 0 && off < 1.2) continue;
      const d = dist(q, G) + (along > 0 ? 1 : 0);
      if (d < bd) { bd = d; best = q; }
    }
    return best ?? { x: e.x, z: e.z };
  };
  /** Player on a famous view, and is the dog in the picture? */
  const onView = () => heroes.some((h) => dist(P, h) < 1.4);
  const inFrame = () => {
    const f = facing?.();
    if (!f || f.lengthSq() < 0.5) return true;
    const dx = G.x - P.x, dz = G.z - P.z, d = Math.hypot(dx, dz) || 1;
    return (dx * f.x + dz * f.z) / d > Math.cos(1.05);      // 60 degrees either side of the lens
  };
  const facingAway = () => {
    const f = facing?.();
    if (!f) return false;
    const dx = G.x - P.x, dz = G.z - P.z, d = Math.hypot(dx, dz) || 1;
    return (dx * f.x + dz * f.z) / d < -0.2;
  };

  /* ---- placing ---- */
  const place = () => {
    const l = ctx.toLocal({ x: G.x, z: G.z });
    const yaw = G.yaw + turned;
    herd.set(0, l.x, G.y, l.z, yaw, 0, G.roll, A.size);
    herd.setPose(0, G.ph, G.amp, G.look, G.nod);
    herd.setPose2(0, G.posture, G.wag, G.perk, G.tilt);
    herd.flush();
    const sit = Math.min(1, G.posture), lie = Math.max(0, G.posture - 1);
    shadows.set(shadow, l.x + Math.sin(yaw) * 0.02, G.y - G.hop, l.z + Math.cos(yaw) * 0.02, SHADOW[0] * (1 + 0.5 * lie) * A.size, SHADOW[1] * (1 - 0.25 * sit + 0.2 * lie) * A.size, yaw);
  };
  const ground = (x, z) => { const p = ctx.toLocal({ x, z }); return ctx.groundAt(p.x, p.z); };

  /* ---- moving along a field ---- */
  const steer = (dt, wantSpeed) => {
    const f = G.field;
    if (!f || !f.ready) { G.speed = 0; return 'thinking'; }
    const c = W.cell(G.x, G.z);
    if (c < 0 || !W.cost[c] || f.m[c] === INF) {
      // off the field: to the nearest cell that is on it
      const n = W.nearest(G.x, G.z, 3, (i) => f.m[i] < INF);
      if (n < 0) { G.speed = 0; return 'lost'; }
      const q = W.at(n);
      if (dist(q, G) > 0.2) return move(dt, q, Math.min(wantSpeed, A.trot));
      return 'ok';
    }
    if (f.m[c] < W.C * 0.9) { G.speed = 0; return 'there'; }
    // the way down: as far along it as is in plain sight, up to a few metres
    let cur = c, way = W.at(c), steps = 0;
    for (;;) {
      const n = f.next(cur);
      if (n < 0 || ++steps > 12) break;
      const q = W.at(n);
      if (!W.sight(G.x, G.z, q.x, q.z)) break;
      way = q; cur = n;
      if (dist(q, G) > 2.5) break;
    }
    // never through you: bend round when you are close to the line
    const dxp = P.x - G.x, dzp = P.z - G.z, dp = Math.hypot(dxp, dzp);
    if (dp < 1.6 && dp > 0.01) {
      const wx = way.x - G.x, wz = way.z - G.z, wl = Math.hypot(wx, wz) || 1;
      const side = (wx * dzp - wz * dxp) / (wl * dp);
      if (Math.abs(side) < 0.6 && (wx * dxp + wz * dzp) > 0) {
        const s = side >= 0 ? -1 : 1;
        const q = { x: way.x + (-wz / wl) * s * 1.0, z: way.z + (wx / wl) * s * 1.0 };
        if (W.free(q.x, q.z) && W.sight(G.x, G.z, q.x, q.z)) way = q;
      }
    }
    return move(dt, way, wantSpeed);
  };
  const move = (dt, to, wantSpeed) => {
    const dx = to.x - G.x, dz = to.z - G.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { G.speed = 0; return 'there'; }
    const want = Math.atan2(dx, dz);
    const dyaw = turn(G.yaw, want);
    const rate = 5 * dt;
    G.yaw += Math.abs(dyaw) < rate ? dyaw : Math.sign(dyaw) * rate;
    // a sharp turn is made on the spot; then on, slowing to arrive
    if (Math.abs(dyaw) > 1.0) { G.speed *= Math.max(0, 1 - dt * 8); return 'moving'; }
    const v = Math.min(wantSpeed * (Math.abs(dyaw) > 0.5 ? 0.5 : 1), Math.max(0.6, d * 2.5));
    G.speed += (v - G.speed) * Math.min(1, dt * 5);
    const s = G.speed * dt;
    let nx = G.x + Math.sin(G.yaw) * s, nz = G.z + Math.cos(G.yaw) * s;
    if (!W.free(nx, nz)) { nx = G.x + (dx / d) * s; nz = G.z + (dz / d) * s; }      // straight at it, then
    if (W.free(nx, nz)) { G.moved += Math.hypot(nx - G.x, nz - G.z); G.x = nx; G.z = nz; G.stall = 0; }
    else {
      G.speed = 0;
      // held against something for a while: back to the middle of its own cell
      if ((G.stall = (G.stall ?? 0) + dt) > 1.5) { const c = W.cell(G.x, G.z); if (c >= 0 && W.cost[c]) { const q = W.at(c); G.x = q.x; G.z = q.z; } G.stall = 0; }
    }
    return 'moving';
  };

  /* ---- what it does ---- */
  function update(dt, cam) {
    if (!W.built) { W.build(); const c = W.nearest(HOME.x, HOME.z, 3); if (c >= 0) { const q = W.at(c); G.x = q.x; G.z = q.z; } G.y = ground(G.x, G.z); prefetch(); }
    G.t += dt;
    // you
    const jumped = !P.first && Math.hypot(cam.x - P.x, cam.z - P.z) > 3;
    if (dt > 0 && !P.first) {
      const vx = (cam.x - P.x) / dt, vz = (cam.z - P.z) / dt, k = Math.min(1, dt * 6);
      P.vx += (vx - P.vx) * k; P.vz += (vz - P.vz) * k;
      P.speed = Math.min(6, Math.hypot(P.vx, P.vz));
    }
    P.x = cam.x; P.z = cam.z; P.y = cam.y; P.first = false;
    if ((listT += dt) > 2 || !list.length) { listT = 0; refresh(); }
    // stepping into a ring is the engagement: done
    for (const e of list) if (!G.done.has(e.id) && dist(P, e) < rOf(e) + 0.25) { G.done.add(e.id); if (G.target?.id === e.id && (G.state === 'lead' || G.state === 'atSpot')) { G.state = 'linger'; G.since = 0; } }
    // the famous views: never in the picture while you stand on one (keys 1-3
    // put you there in a jump: it is home at once; walking on, it trots out)
    const view = onView() && (P.speed < 0.6 || jumped);
    if (view && jumped) { const c = W.nearest(HOME.x, HOME.z, 3); const q = c >= 0 ? W.at(c) : HOME; G.x = q.x; G.z = q.z; G.speed = 0; G.state = 'home'; G.field = null; G.yaw = Math.atan2(P.x - G.x, P.z - G.z); }
    else if (view && G.state !== 'home' && G.state !== 'nap' && inFrame()) { G.resume = G.state === 'lead' || G.state === 'atSpot' ? G.target : null; goTo('home', HOME); }
    // Han's show: off the car's way, sitting, watching it go by
    const show = HAN_SHOW.running();
    if (show && G.state !== 'hazard') {
      const c = W.cell(G.x, G.z);
      if (c >= 0 && W.haz[c]) { G.resume = G.state === 'lead' || G.state === 'atSpot' ? G.target : G.resume; const n = W.nearest(G.x, G.z, 8, (i) => !W.haz[i]); G.state = 'hazard'; G.aside = n >= 0 ? W.at(n) : null; G.field = null; G.waitT = 0; }
    }
    if (!show && G.state === 'hazard') { G.state = 'home'; if (G.resume) lead(G.resume); else nextOrNap(); }

    // the field grows a little each frame while it is wanted; the others are grown ahead, one at a time
    if (G.field && !G.field.ready) G.field.work(dt > 0 ? 4 : 40);
    else if (dt > 0) {
      if (growing && growing.ready) growing = null;
      if (!growing && queue.length) growing = queue.shift()();
      if (growing && !growing.ready) growing.work(2.5);
    }

    let wantSpeed = 0, lookAt = 'player', wagTo = 0.15, perkTo = 1, postureTo = 0;
    const dP = dist(P, G);
    // how far ahead of you it is: along the way, or as the crow flies when you are right here (off the way, your path metres run long)
    const gap = () => (G.field?.ready ? Math.min(G.field.near(P.x, P.z) - G.field.at(G.x, G.z), dP) : 0);
    let r = 'still';
    switch (G.state) {
      case 'home': {
        if (!G.field) goTo('home', HOME);
        const there = dist(G, HOME) < 0.6;
        if (!there) { r = steer(dt, A.trot); lookAt = 'way'; } else G.waitT += dt;
        wagTo = dP < 6 ? 0.5 : 0.2;
        postureTo = there && G.waitT > A.waitSit ? 1 : 0;
        // you walk off the view: it comes and leads
        if (!view && dist(P, VIEW) > 1.5 && !inStore(P)) { const e = G.resume && !G.done.has(G.resume.id) ? G.resume : pickTarget(); G.resume = null; if (e) lead(e); else goTo('nap', NAP, 0.3); }
        break;
      }
      case 'lead': {
        G.since += dt;
        const g = gap();
        const [lo, hi] = A.lead;
        if (G.field?.ready && G.field.at(G.x, G.z) < 1.2 && G.field.at(G.x, G.z) !== INF) { G.state = 'atSpot'; G.aside = beside(G.target); G.waitT = 0; break; }
        // ahead of you by less than the lead: on, quicker the closer you are; at the lead: wait
        if (g < lo) wantSpeed = Math.min(A.run, Math.max(A.trot, P.speed + 1.2));
        else if (g < hi) wantSpeed = Math.max(1.4, P.speed);
        else wantSpeed = 0;
        // you're not coming: wait, then sit; lost or turned away for a while: go back to you
        if (wantSpeed > 0) { r = steer(dt, wantSpeed); lookAt = 'way'; G.waitT = 0; } else { G.waitT += dt; }
        if (r === 'lost' || r === 'thinking') { G.waitT += dt; lookAt = 'player'; }
        if (r === 'lost' && G.field?.ready) { G.lostFor = (G.lostFor ?? 0) + dt; if (G.lostFor > 1.5) { G.lostFor = 0; const q = nearestReach(G.target); if (q) G.near = q; } } else G.lostFor = 0;
        postureTo = G.waitT > A.waitSit && G.speed < 0.1 ? 1 : 0;
        wagTo = G.speed > 0.5 ? 0.3 : G.waitT > 6 ? 0.1 : 0.45;
        G.lostT = dP > A.lost || (facingAway() && dP > 8) ? G.lostT + dt : 0;
        // near, but off its way and not coming (a wall between, or your own idea): the same
        G.awayT = g > hi + 4 && P.speed > 0.3 ? G.awayT + dt : 0;
        if ((G.lostT > 4 || G.awayT > 12) && !inStore(P)) { G.state = 'follow'; G.field = null; G.since = 0; G.waitT = 0; }
        break;
      }
      case 'atSpot': {
        const q = G.aside ?? G.target;
        if (dist(G, q) > 0.25 && !G.done.has(G.target.id)) { r = move(dt, q, A.trot * 0.8); lookAt = 'way'; G.waitT = 0; } else G.waitT += dt;
        // arrived: a quick shake-off; you arrive: a little hop
        if (G.shook !== G.target.id && dist(G, q) <= 0.25) { G.shook = G.target.id; G.shakeT = 0; }
        if (G.hopped !== G.target.id && dist(P, G.target) < 3.5 && G.speed < 0.2) { G.hopped = G.target.id; G.hopT = 0; G.waitT = 0; }
        postureTo = G.waitT > A.waitSit + 1 ? 1 : 0;
        wagTo = dP < 6 ? 0.55 : 0.2;
        G.lostT = dP > A.lost ? G.lostT + dt : 0;
        if (G.lostT > 6 && !inStore(P)) { G.state = 'follow'; G.field = null; G.since = 0; }
        break;
      }
      case 'linger': {
        // you're having the experience: it sits by and waits until you come away
        G.since += dt; G.waitT += dt;
        postureTo = G.waitT > A.waitSit ? 1 : 0;
        wagTo = dP < 5 ? 0.5 : 0.15;
        if (G.since > 1.5 && dist(P, G.target) > 4 && !inStore(P) && !view) nextOrNap();
        break;
      }
      case 'follow': {
        // you went your own way: it comes after you at a distance, then tries again
        G.since += dt;
        const f = fields.follow;
        const stale = !f || !f.goalAt || dist(f.goalAt, P) > 3 || (G.since - (G.thinkT ?? 0) > 3);
        if (stale && !inStore(P)) { G.field = aim('follow', P.x, P.z, 0.6, 60); G.thinkT = G.since; }
        if (dP > 5) { r = steer(dt, P.speed > 3 ? A.run : A.trot); lookAt = 'way'; G.waitT = 0; } else { G.waitT += dt; G.speed = 0; }
        wagTo = 0.3;
        postureTo = G.waitT > A.waitSit + 2 ? 1 : 0;
        // close, and you have paused or turned to it: lead again, but only once you have moved on a little
        if (dP < 5 && G.waitT > 2 && (P.speed > 0.4 || !facingAway())) { const e = pickTarget(); if (e) lead(e); else goTo('nap', NAP, 0.3); }
        break;
      }
      case 'hazard': {
        if (G.aside && dist(G, G.aside) > 0.25) { r = move(dt, G.aside, A.run); lookAt = 'way'; } else G.waitT += dt;
        postureTo = G.waitT > 1.5 ? 1 : 0;
        lookAt = 'car'; wagTo = 0.2;
        break;
      }
      case 'nap': {
        const there = G.field?.ready && G.field.at(G.x, G.z) < W.C;
        if (!there) { r = steer(dt, A.trot); lookAt = 'way'; G.waitT = 0; } else G.waitT += dt;
        const awake = dP < 3;
        postureTo = there ? (G.waitT > 1.5 ? 2 : 1) : 0;
        perkTo = there ? (awake ? 1 : 0.35) : 1;
        wagTo = awake ? 0.4 : 0;
        lookAt = there && !awake ? 'sleep' : 'player';
        break;
      }
    }
    G.r = r;
    if (r !== 'moving') G.speed += (0 - G.speed) * Math.min(1, dt * 6);
    if (G.speed < 0.05) G.speed = 0;

    /* ---- the body ---- */
    const k3 = Math.min(1, dt * 3);
    G.amp += (Math.min(1, G.speed / A.trot) - G.amp) * Math.min(1, dt * 6);
    G.ph += dt * G.speed * 5.5;
    // posture: stands up before it walks; the shake after a long sit
    const wasSitting = G.posture > 0.6;
    if (G.speed > 0.2) postureTo = 0;
    G.posture += Math.sign(postureTo - G.posture) * Math.min(Math.abs(postureTo - G.posture), dt * 1.3);
    if (wasSitting && G.posture <= 0.6 && G.sat > 8 && G.shakeT < 0) G.shakeT = 0;
    G.sat = G.posture > 0.6 ? G.sat + dt : 0;
    // the head: at you, along the way with a glance back over the shoulder, or down asleep
    const dxp = P.x - G.x, dzp = P.z - G.z;
    const toYou = THREE.MathUtils.clamp(turn(G.yaw, Math.atan2(dxp, dzp)), -1.4, 1.4);
    const headY = G.y + 0.45 * (1 - 0.3 * Math.max(0, G.posture - 1));
    const nodYou = THREE.MathUtils.clamp(-Math.atan2(P.y - headY, Math.max(0.6, dP)) * 0.8, -0.55, 0.35);
    let lookTo = 0, nodTo = 0.1;
    if (lookAt === 'player') { lookTo = toYou; nodTo = nodYou; }
    else if (lookAt === 'way') {
      // trotting: every few seconds a look back over the shoulder
      G.glance += dt;
      if (G.glance > 3.6) G.glance = -1.3;
      if (G.glance < 0) { lookTo = toYou; nodTo = nodYou * 0.6; } else { lookTo = Math.sin(G.t * 1.3) * 0.12; nodTo = 0.12; }
    } else if (lookAt === 'car') {
      const c = HAN_SHOW.car();
      if (c) { lookTo = THREE.MathUtils.clamp(turn(G.yaw, Math.atan2(c.x - G.x, c.z - G.z)), -1.4, 1.4); nodTo = 0.15; }
    } else if (lookAt === 'sleep') { lookTo = 0.9; nodTo = 0.2; }
    G.look += (lookTo - G.look) * k3;
    G.nod += (nodTo - G.nod) * k3;
    // sitting and waiting: a head tilt now and then
    if (G.posture > 0.8 && G.speed < 0.1 && G.state !== 'nap') {
      if (G.tiltT < 0) { G.tiltNext -= dt; if (G.tiltNext <= 0) { G.tiltT = 0; G.tiltNext = 3 + Math.random() * 4; G.tiltSide = Math.random() < 0.5 ? -1 : 1; } }
    }
    let tiltTo = 0;
    if (G.tiltT >= 0) { G.tiltT += dt; const u = G.tiltT / 1.6; tiltTo = G.tiltSide * 0.38 * Math.sin(Math.PI * Math.min(1, u)); if (u >= 1) G.tiltT = -1; }
    G.tilt += (tiltTo - G.tilt) * Math.min(1, dt * 5);
    // the tail
    const glancing = lookAt === 'way' && G.glance < 0;
    if (glancing) wagTo = Math.max(wagTo, 0.55);
    G.wagA += (wagTo - G.wagA) * k3;
    G.wagPh += dt * (glancing ? 17 : G.wagA > 0.4 ? 13 : 8);
    G.wag = Math.sin(G.wagPh) * G.wagA + G.amp * 0.08 * Math.sin(2 * G.ph);
    // ears: pricked when alert, back for the hop and the nap
    // excited (you close and it wagging hard): the tongue comes out (the rig reads ears past 1)
    let perk = perkTo;
    if (perkTo >= 1 && G.wagA > 0.42 && dP < 7 && G.state !== 'nap') perk = 1.3;
    if (G.hopT >= 0) perk = 0.55;
    G.perk += (perk - G.perk) * Math.min(1, dt * 5);
    // the little hop, and the shake
    G.hop = 0; G.roll = 0;
    if (G.hopT >= 0) { G.hopT += dt; const u = G.hopT / 0.5; G.hop = 0.2 * Math.sin(Math.PI * Math.min(1, u)); if (u >= 1) G.hopT = -1; }
    if (G.shakeT >= 0) { G.shakeT += dt; const u = G.shakeT / 0.7; G.roll = 0.16 * Math.sin(G.shakeT * 70) * (1 - u); G.tilt += 0.3 * Math.sin(G.shakeT * 70 + 1) * (1 - u); if (u >= 1) G.shakeT = -1; }
    G.y = ground(G.x, G.z) + G.amp * 0.042 * (0.5 + 0.5 * Math.sin(2 * G.ph + 1)) + G.hop;
    place();
  }

  // it starts at home, facing the view (the grid is built on the first update,
  // once every builder has placed its colliders; the dog then snaps to free ground)
  G.yaw = Math.atan2(VIEW.x - G.x, VIEW.z - G.z);
  place();

  /* dev: state, staged poses for the screenshots, and a headless run */
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    window.__guide = {
      state: () => ({ state: G.state, target: G.target?.id ?? null, done: [...G.done], x: +G.x.toFixed(2), z: +G.z.toFixed(2), yaw: +G.yaw.toFixed(2), speed: +G.speed.toFixed(2), posture: +G.posture.toFixed(2), gridMs: +W.ms.toFixed(0), cells: W.N, paths: dbg.paths, ready: !!G.field?.ready }),
      walk: W, G, P,
      /** Stand the dog in a pose `d` metres in front of a player { pos, yaw } for a frame: trot | look | sit | tilt | nap | hop */
      stage(kind, player, d = 2.0) {
        const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
        const px = player.pos.x + fx * d, pz = player.pos.z + fz * d;
        const c = W.nearest(px, pz, 2);
        const q = c >= 0 ? W.at(c) : { x: px, z: pz };
        Object.assign(G, { x: q.x, z: q.z, speed: 0, amp: 0, ph: 0, look: 0, nod: 0.1, tilt: 0, wag: 0, posture: 0, perk: 1, hop: 0, roll: 0, state: 'staged' });
        const toCam = Math.atan2(player.pos.x - q.x, player.pos.z - q.z);
        if (kind === 'trot') Object.assign(G, { yaw: toCam + 2.1, amp: 1, ph: 1.1, wag: 0.25, nod: 0.12 });
        else if (kind === 'look') Object.assign(G, { yaw: toCam + Math.PI - 0.5, look: -1.25, nod: 0.05, wag: 0.4 });
        else if (kind === 'sit') Object.assign(G, { yaw: toCam + 0.25, posture: 1, nod: -0.1, wag: 0.35, perk: 1.3 });
        else if (kind === 'side') Object.assign(G, { yaw: toCam + Math.PI / 2, amp: 1, ph: 4.2, wag: 0.3, nod: 0.1 });
        else if (kind === 'behind') Object.assign(G, { yaw: toCam + Math.PI, amp: 1, ph: 1.1, wag: -0.3, nod: 0.12, look: 0 });
        else if (kind === 'tilt') Object.assign(G, { yaw: toCam, posture: 1, tilt: 0.38, nod: -0.12, wag: 0.3 });
        else if (kind === 'nap') Object.assign(G, { yaw: toCam + 1.9, posture: 2, look: 0.9, nod: 0.2, perk: 0.35 });
        else if (kind === 'hop') Object.assign(G, { yaw: toCam + 0.3, hop: 0.16, perk: 0.55, wag: 0.5, nod: -0.15 });
        else if (kind === 'stand') Object.assign(G, { yaw: toCam + 0.6, wag: 0.3 });
        G.y = ground(G.x, G.z) + G.hop + G.amp * 0.012;
        place();
      },
      /** Step the dog by `dt` with the player at `p` (the headless run drives it). */
      step(dt, p) { update(dt, p); },
      reset() { Object.assign(G, { state: 'home', target: null, field: null, resume: null, speed: 0, posture: 0, moved: 0, shook: null, hopped: null }); G.done = new Set(['view']); ready.clear(); queue.length = 0; growing = null; prefetch(); P.first = true; const c = W.nearest(HOME.x, HOME.z, 3); const q = c >= 0 ? W.at(c) : HOME; G.x = q.x; G.z = q.z; G.y = ground(G.x, G.z); place(); },
    };
  }
  return { update, herd, G };
}
