import * as THREE from 'three';
import { TOWN, STREET, LAWSON, HERO_VIEWS, SLOWLIFE, ANIMALS } from '../../config.js';
import { pondShore } from '../land/pond.js';
import { planPaddies } from '../land/paddies.js';
import { SPECIALS } from '../town-plan.js';
import { HAN_BAY, HAN_SHOW } from '../han/index.js';
import { buildDrive, driveAt, T_DRIVE } from '../han/drive.js';
import { shibaGeometry, RIG, SHADOW, BODY_R } from './shiba.js';
import { animalMaterial, Herd, ease, turn } from './shade.js';
import { soundBus } from '../../core/soundBus.js';
import { STRINGS } from '../../data/strings.js';

/* ------------------------------------------------------------------ *
 * The guide (Tan, 2026-09-28): a shiba that leads you to the town's
 * engagements one at a time, instead of a dog trailing behind where you
 * would never see it.
 *
 * The pup suggests, you decide; it guides, it doesn't follow (Tan,
 * 2026-09-29: "it's very difficult to guess whether it wants to follow me or
 * I need to follow it").  It waits on the far pavement behind the famous
 * view (out of every hero frame) and comes when you walk off.  It leads along
 * the town tour at a jog, a few metres ahead, stopping to look back when you
 * fall behind; at a spot it waits beside the ring until you step in.  Not
 * interested (you heading off its way, your distance to the spot growing
 * while it waits, or you 16 m off): it stops where it is and waits, watching
 * you go.  Walk back to it and it takes you on; whistle (F) and it comes
 * running wherever you are, greets you, and rushes you to the nearest place
 * you haven't been.  When every engagement is done it naps beside the
 * Deer Park gate, the tour's last stop.
 *
 * Between times it is a puppy: a bouncy trot, zoomies, play bows, hops,
 * rolling over belly-up, chasing its tail, a sneeze, a head tilt, the odd
 * trip over its own paws; picked by an energy/nearness mood, never the
 * same twice running.
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
/** The pup, for main.js: `whistle()` (F) calls it to you from anywhere; set once it is built. */
export const GUIDE = { whistle: () => false, tipsy: () => {}, greeting: () => null };
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
    // everything is an alley until a street, a plaza, the land's paths or a lot says otherwise
    const cost = this.cost = new Uint8Array(N).fill(K.alley);
    const h = this.h = new Int16Array(N);
    this.haz = new Uint8Array(N);
    this.tall = new Uint8Array(N);       // something that hides a pup from you (a wall, a car, a machine): the whistle's corners
    this.stair = new Uint8Array(N);      // 1: a flight climbing along x, 2: along z (entered only along that axis)
    this.water = new Uint8Array(N);      // for the checks: cells that are water (all blocked)
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
    /* open ground you may cross: the land north of the main road (the car park, the river walks, the bridge
     * road's verges), the paddies' paths and the pond's grounds; the plaza and the station's strip */
    wrect(TOWN.bounds.x0, TOWN.bounds.z0, TOWN.bounds.x1, TOWN.grid.main - 2.5, K.ground);
    { const [x0, z0, x1, z1] = TOWN.land.paddies.box; wrect(x0 - 1.5, z0 - 1.5, x1 + 1.5, z1 + 1.5, K.ground); }
    { const [x0, z0, x1, z1] = TOWN.land.pond.box; wrect(x0 - 1.5, z0 - 1.5, x1 + 1.5, z1 + 1.5, K.ground); }
    for (const s of SPECIALS) if (s.kind === 'plaza' || s.kind === 'station') wrect(s.x0, s.z0, s.x1, s.z1, K.plaza);
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
      if ((c.top ?? 9) >= 1.1) rect(c.x0, c.z0, c.x1, c.z1, (i) => { this.tall[i] = 1; });
    }
    // the store itself (its door opens for you, not for a dog) and Han's bay
    rect(-LAWSON.width / 2 - 0.4, -LAWSON.depth - 0.4, LAWSON.width / 2 + LAWSON.wingWidth + 0.4, LAWSON.frontZ + 0.35, (i) => { cost[i] = 0; });
    rect(-LAWSON.width / 2, -LAWSON.depth, LAWSON.width / 2 + LAWSON.wingWidth, LAWSON.frontZ, (i) => { this.tall[i] = 1; });
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
        if (inside(x, z) || inside(x + m, z) || inside(x - m, z) || inside(x, z + m) || inside(x, z - m)) { cost[i] = 0; this.water[i] = 1; }
      });
    }
    /* the paddies: the plots themselves are dear (the paths between them are the way), the flooded ones and the
     * feeder channel are water: blocked, with a margin (Tan saw the pup half under in the channel) */
    {
      const plan = planPaddies();
      const inPlot = (p, x, z) => x >= p.sw - 0.2 && x <= p.se + 0.2 && z >= p.S(x) - 0.2 && z <= p.N(x) + 0.2;
      const [bx0, bz0, bx1, bz1] = TOWN.land.paddies.box;
      const a = W({ x: bx0 - 1, z: bz0 - 1 }), b = W({ x: bx1 + 1, z: bz1 + 1 });
      rect(a.x, a.z, b.x, b.z, (i) => {
        const p = ctx.toLocal({ x: X0 + ((i % nx) + 0.5) * C, z: Z0 + (((i / nx) | 0) + 0.5) * C });
        for (const q of plan.plots) {
          if (!inPlot(q, p.x, p.z)) continue;
          if (q.kind === 'flood') { cost[i] = 0; this.water[i] = 1; } else if (cost[i]) cost[i] = K.plot;
          break;
        }
      });
      for (const c of plan.channels) {
        const m = 0.45;
        const a = W({ x: c.x0 - m, z: c.z0 - m }), b = W({ x: c.x1 + m, z: c.z1 + m });
        rect(a.x, a.z, b.x, b.z, (i) => { cost[i] = 0; this.water[i] = 1; });
      }
    }
    // the river's water (the sunken walks are blocked already, being below street level)
    for (let i = 0; i < N; i++) if (h[i] < -250) this.water[i] = 1;
    /* stairs: a run of three or more risers (8-45 cm each) along one axis is a flight; its cells are entered
     * only along that axis (from the foot or the head, as a person does), and the cells beside a flight at
     * another level are shut, so it cannot be climbed from the side or walked into (Tan: the station's steps) */
    {
      const stair = this.stair, step = Math.round(A.step * 100);
      const riser = (d) => Math.abs(d) >= 8 && Math.abs(d) <= step;
      for (const [axis, di, len] of [[1, 1, nx], [2, nx, nz]]) {
        const other = axis === 1 ? nz : nx;
        for (let k = 0; k < other; k++) {
          const base = axis === 1 ? k * nx : k;
          let j = 1;
          while (j < len) {
            // a maximal run of risers of one sign, starting at cell j-1
            const start = j - 1;
            let run = 0, sign = 0;
            while (j < len) {
              const c = base + j * di, d = h[c] - h[c - di];
              if (!(cost[c] && cost[c - di] && riser(d) && (sign === 0 || Math.sign(d) === sign))) break;
              sign = Math.sign(d); run++; j++;
            }
            if (run >= 3) for (let m = 0; m <= run; m++) stair[base + (start + m) * di] = axis;
            if (run === 0) j++;
          }
        }
      }
      // the sides: a non-stair neighbour across the axis at another level is shut
      const side = [];
      for (let i = 0; i < N; i++) {
        if (!stair[i]) continue;
        const cx = i % nx, cz = (i / nx) | 0;
        const nb = stair[i] === 1 ? [i - nx, i + nx] : [i - 1, i + 1];
        const on = stair[i] === 1 ? [cz > 0, cz < nz - 1] : [cx > 0, cx < nx - 1];
        nb.forEach((q, k) => { if (on[k] && !stair[q] && cost[q] && Math.abs(h[q] - h[i]) > 6) side.push(q); });
      }
      for (const q of side) cost[q] = 0;
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
  /** May a step go from cell c to its neighbour q (offset dx, dz)?  Stairs only along their axis. */
  can(c, q, dx, dz) {
    const s = this.stair[c] || this.stair[q];
    if (!s) return true;
    return s === 1 ? dz === 0 : dx === 0;
  }
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
  /** Is a pup at a hidden from an eye at b (something tall on the line between, short of the pup's own half-metre)? */
  hidden(ax, az, bx, bz) {
    const L = Math.hypot(bx - ax, bz - az) || 1, n = Math.ceil(L / (this.C * 0.5));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      if (t * L < 0.5) continue;
      const c = this.cell(ax + (bx - ax) * t, az + (bz - az) * t);
      if (c >= 0 && this.tall[c]) return true;
    }
    return false;
  }
  /** Nothing solid on a straight line from a to b, nor a hand's width either side of it (no grazing a corner). */
  sight(ax, az, bx, bz) {
    const L = Math.hypot(bx - ax, bz - az) || 1, n = Math.ceil(L / (this.C * 0.4));
    const px = (-(bz - az) / L) * 0.14, pz = ((bx - ax) / L) * 0.14;
    // a line that touches a flight must run along the flight's axis (within ~15 degrees), and never up a big step
    const ux = Math.abs(bx - ax) / L, uz = Math.abs(bz - az) / L;
    let last = this.cell(ax, az);
    for (let k = 1; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (!this.free(x, z) || !this.free(x + px, z + pz) || !this.free(x - px, z - pz)) return false;
      const c = this.cell(x, z);
      const s = this.stair[c];
      if (s && (s === 1 ? uz > 0.26 : ux > 0.26)) return false;
      if (c !== last) { if (last >= 0 && Math.abs(this.h[c] - this.h[last]) > A.step * 100) return false; last = c; }
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
        if (!cost[q] || shut[q] || Math.abs(h[q] - h[c]) > step || !W.can(c, q, dx, dz)) continue;
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
      if (!W.can(c, q, dx, dz) || Math.abs(W.h[q] - W.h[c]) > A.step * 100) continue;
      if (d[q] < bd) { bd = d[q]; best = q; }
    }
    return best;
  }
}


/* --------------------------------- the pup --------------------------------- */
export function buildGuide(ctx, { spots, shadows, core, facing }) {
  const W = new Walk(ctx, core);
  const geo = shibaGeometry();
  const mat = animalMaterial({ key: 'shibaGuide', rig: RIG, tint: 0x7a6488, bands: 4 });
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
  const D = A.drop;

  /* the pup: where it is, how it stands, what it is doing */
  const G = {
    x: HOME.x, z: HOME.z, y: 0, yaw: Math.PI, speed: 0, roll: 0, pitch: 0, ox: 0, oy: 0,
    ph: 0, amp: 0, look: 0, nod: 0, tilt: 0, wag: 0, wagA: 0, wagPh: 0, posture: 0, perk: 1, hop: 0, hopT: -1, shakeT: -1,
    state: 'home', target: null, done: new Set(['view']), skipped: new Set(), t: 0, waitT: 0, sat: 0, glance: 0, tiltT: -1, tiltNext: 3,
    lostT: 0, offT: 0, waitD0: null, minD: INF, hopped: null, field: null, goal: null, since: 0, resume: null, aside: null, moved: 0, thinkT: 0,
    drops: 0, act: null, leg: 0, resumeK: null, whistleAt: null, lastWhistle: -9, intro: 0, introT: 0, last: '', idleT: 0, energy: 0.7, stillT: 0, chaseT: 0, circ: null, inviteE: null,
  };
  const P = { x: VIEW.x, z: VIEW.z, y: 1.6, vx: 0, vz: 0, speed: 0, first: true, hx: 0, hz: -1 };
  /* Its voice (Tan: "very cute, adorable sounds"; core/sound.js dog-* recipes):
   * soft, heard only near it, never two within 1.2 s. */
  let lastSay = -9, pantT = 0, whined = false, snoreT = 0;
  const say = (name, gain = 0.7, must = false, far = 16) => {
    if (!must && G.t - lastSay < 1.2) return;
    lastSay = G.t;
    soundBus.oneShot(name, { x: G.x, z: G.z, y: 0.3, near: 3, far, gain, recipe: name });
  };
  let list = [], listT = 0;
  const fields = { follow: null, whistle: null };
  const ready = new Map();            // goal key -> a Field; the last few kept (each is 2.6 MB of Float32 for the town)
  const queue = [];                   // fields to grow ahead while nothing else is wanted
  const dbg = { paths: 0 };
  const TOUR = A.tour;

  const rOf = (e) => e.r ?? ENGAGE[e.id] ?? 1.2;
  const isEngage = (e) => (e.kind ? e.kind === 'engage' : ENGAGE[e.id] !== undefined);
  const refresh = () => { list = (spots?.() ?? []).filter(isEngage); };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const keyOf = (x, z) => `${x.toFixed(1)},${z.toFixed(1)}`;

  /** Grow a field from a disc round (x, z); the pup thinks until it is ready (unless it was grown ahead). */
  const aim = (which, x, z, r, limit = INF) => {
    if (which !== 'follow') {
      const key = keyOf(x, z);
      if (ready.has(key)) { const f = ready.get(key); ready.delete(key); ready.set(key, f); return f; }   // freshest last
      const f = new Field(W);
      ready.set(key, f);
      while (ready.size > A.fields) { const [k0, f0] = ready.entries().next().value; if (f0 === G.field) { ready.delete(k0); ready.set(k0, f0); } else ready.delete(k0); }
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
  const fieldOf = (e) => aim('goal', e.x, e.z, e.leg && !isStop(e) ? 0.6 : rOf(e) * 0.7);
  /** A field already grown for e, if any (scoring never grows one). */
  const fieldIf = (e) => ready.get(keyOf(e.x, e.z));

  /* ---- the tour: an ordered chain of street waypoints (config.js ANIMALS.guide.tour); engagements are stops ---- */
  const isStop = (t) => !!(t?.leg?.id && t.leg.id !== 'gate');
  /** The leg's target: the engagement's own entry (its ring) for a stop, else the waypoint. */
  const legTarget = (k) => {
    const L = TOUR[k];
    if (!L) return null;
    if (L.id && L.id !== 'gate') { refresh(); const e = list.find((q) => q.id === L.id); return e ? { ...e, k, leg: L } : null; }
    return { x: L.x, z: L.z, id: L.id ?? null, k, leg: L };
  };
  const legDone = (k) => { const L = TOUR[k]; return !L || (!!L.id && L.id !== 'gate' && (G.done.has(L.id) || !legTarget(k))); };
  /** The first leg from `from` on that still wants doing. */
  const nextLeg = (from) => { let k = from; while (k < TOUR.length && legDone(k)) k++; return k; };
  /** Ahead of need: this leg's field and the next one's, one at a time while the pup isn't waiting on one. */
  const prefetch = () => {
    const k = nextLeg(G.leg ?? 0);
    for (const j of [k, nextLeg(k + 1)]) { const t = legTarget(j); if (t) queue.push(() => fieldOf(t)); }
    queue.push(() => aim('goal', NAP.x, NAP.z, 0.3));
  };
  let growing = null;
  /** How far you are from e along the way (a grown field's metres, else the crow's and a bit). */
  const wayTo = (e) => { const f = fieldIf(e); const m = f?.ready ? f.near(P.x, P.z) : INF; return m === INF ? dist(P, e) * 1.3 : m; };
  /** Which way you mean to go: your walk, or where you look when you stand. */
  const intent = () => {
    if (P.speed > 0.5) { const l = Math.hypot(P.vx, P.vz) || 1; return { x: P.vx / l, z: P.vz / l }; }
    const f = facing?.();
    return f && f.lengthSq() > 0.5 ? { x: f.x, z: f.z } : { x: P.hx, z: P.hz };
  };
  const angleOff = (dir, e) => { const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz) || 1; return Math.acos(THREE.MathUtils.clamp((dx * dir.x + dz * dir.z) / d, -1, 1)); };
  /** The nearest engagement not done, by the way from you (one you walked away from counts `D.skipped` m further). */
  const pickTarget = () => {
    refresh();
    let best = null, bd = INF;
    for (const e of list) {
      if (G.done.has(e.id)) continue;
      const d = wayTo(e) + (G.skipped.has(e.id) ? D.skipped : 0);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };
  const startLead = (t) => {
    G.target = t; G.state = 'lead'; G.hopped = null; G.aside = null; G.since = 0; G.lostT = 0; G.offT = 0; G.waitD0 = null; G.minD = INF;
    if (t.id) G.skipped.delete(t.id);
    G.field = fieldOf(t);
  };
  /** Lead along the tour from leg k (skipping what is done). */
  const lead = (k) => {
    k = nextLeg(k);
    if (k >= TOUR.length) { leftovers(); return; }
    G.leg = k;
    startLead(legTarget(k));
    const n = legTarget(nextLeg(k + 1));
    if (n) queue.push(() => fieldOf(n));
  };
  /** After the tour: any engagement still not done (a skipped one), else the nap. */
  const leftovers = () => { G.leg = TOUR.length; const e = pickTarget(); if (e) startLead({ ...e, k: TOUR.length, leg: { id: e.id } }); else toGateOrNap(); };
  /** Everything done: the Deer Park gate last (Tan), if you haven't been; then the nap beside it. */
  const toGateOrNap = () => {
    const kg = TOUR.findIndex((L) => L.id === 'gate');
    if (kg >= 0 && !G.gateDone) { G.leg = kg; startLead(legTarget(kg)); return; }
    goTo('nap', NAP, 0.3);
  };
  const advance = () => lead((G.leg ?? 0) + 1);
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
  const allDone = () => { refresh(); return list.every((e) => G.done.has(e.id)); };
  /** After a stop: the tour goes on; after the tour, the leftovers, then the nap. */
  const nextOrNap = () => advance();
  /** Whistled (or you walked back to it): to the nearest place you haven't been, at a run (Tan: "rush me to the next
   * spot I haven't covered"); the tour goes on from there. */
  const rushNext = () => {
    G.drops = 0;
    const e = pickTarget();
    if (!e) { toGateOrNap(); return; }
    const k = TOUR.findIndex((L) => L.id === e.id);
    if (k >= 0) { G.leg = k; startLead(legTarget(k) ?? { ...e, k, leg: TOUR[k] }); }
    else { G.leg = TOUR.length; startLead({ ...e, k: TOUR.length, leg: { id: e.id } }); }
  };
  /** Your whistle (F): the two notes sound at you; Hachi answers once they are over (ears up meanwhile): a yip, and
   * it comes at a gallop, or, already beside you, a happy hop.  From very far it appears from the nearest corner
   * out of view.  A second press while one is pending, or within a second, does nothing (no stacked whistles or yips). */
  const whistle = () => {
    if (!W.built || G.whistleAt !== null || G.t - G.lastWhistle < 1.0) return false;
    soundBus.oneShot('whistle', { x: P.x, z: P.z, y: P.y, near: 4, far: 30, gain: 0.8, recipe: 'whistle' });
    G.lastWhistle = G.t; G.whistleAt = G.t + A.whistle.answer;
    // the way to you, grown over the notes (a frame's worth at a time), so the answer doesn't stall a frame
    const f = (fields.whistle ??= new Field(W));
    grow(f, P.x, P.z, 0.6, A.whistle.far * 1.5);
    return true;
  };
  /** Where to come from so you see it come (Tan: no popping up, no coming from behind): a street `from` [min, max] m
   * ahead of you, within `cone` degrees of the lens, hidden from you right now (behind a building's corner, a car, a
   * machine), whose way to you comes out into plain view within a few metres and runs at you from there (a way not
   * much longer than the straight line).  `f` is a field grown from you.  The middle of the view and of the range win.
   * With `hide` false it may be in plain view already (only as a far fallback: small and far, it reads as arriving). */
  const spotInView = (f, [d0, d1], cone, hide = true, mid = null, exitCone = 28, within = 5) => {
    const fc = facing?.();
    if (!fc || fc.lengthSq() < 0.5) return null;
    const cosC = Math.cos(cone * Math.PI / 180), cosE = Math.cos(exitCone * Math.PI / 180), dm = mid ?? (d0 + d1) / 2;
    let best = -1, bs = INF;
    for (let i = 0; i < W.N; i += 2) {
      const m = f.m[i];
      if (m > d1 * 1.5 + 4) continue;
      const q = W.at(i), dx = q.x - P.x, dz = q.z - P.z, d = Math.hypot(dx, dz);
      if (d < d0 || d > d1 || m > d * 1.5 + 4) continue;
      const c = (dx * fc.x + dz * fc.z) / d;
      if (c < cosC) continue;
      const sc = Math.abs(d - dm) / dm + 3 * (1 - c) + 0.3 * (m / d - 1);
      if (sc >= bs || !W.free(q.x, q.z)) continue;
      if (!hide) { if (!W.hidden(q.x, q.z, P.x, P.z)) { bs = sc; best = i; } continue; }
      if (!W.hidden(q.x, q.z, P.x, P.z)) continue;
      // out into view within 4 m of its way, then a clear run at you
      let k = i, walked = 0, out = false;
      for (let s2 = 0; s2 < 24 && walked < within; s2++) {
        const n = f.next(k);
        if (n < 0) break;
        const a = W.at(k), b = W.at(n);
        walked += Math.hypot(b.x - a.x, b.z - a.z); k = n;
        const ex = b.x - P.x, ez = b.z - P.z, e = Math.hypot(ex, ez) || 1;
        if ((ex * fc.x + ez * fc.z) / e > cosE && !W.hidden(b.x, b.z, P.x, P.z)) { out = true; break; }
      }
      if (out) { bs = sc; best = i; }
    }
    return best >= 0 ? W.at(best) : null;
  };
  /** Set it where you will see it come from (see spotInView); false if there is nowhere. */
  const enterView = (f, near, cone) => {
    const m = (near[0] + near[1]) / 2;
    const q = spotInView(f, near, cone)                         // hidden ahead, out into the middle of the view at once
      ?? spotInView(f, [5, 30], 70, true, m, 28, 10)            // hidden to a side, out into the middle within 10 m
      ?? spotInView(f, [5, 30], 70, true, m, 46, 12)            // round a corner at the edge of the view (its run swings in across it)
      ?? spotInView(f, [24, 40], 28, false)                     // far off and small, in plain view
      ?? offView(f);                                            // nowhere to be seen coming from: round a corner behind you
    if (!q) return false;
    setAt(q);
    // facing down its way already, and off at a run: no turning on the spot where it comes out
    const c = W.cell(q.x, q.z), n = c >= 0 ? f.next(c) : -1;
    if (n >= 0) { const b = W.at(n); G.yaw = Math.atan2(b.x - q.x, b.z - q.z); }
    G.speed = A.whistle.gallop * 0.8;
    return true;
  };
  /** The spot `d` m in front of you (where you look), on free ground: where it greets you and plays. */
  const frontSpot = (d) => {
    const fc = facing?.();
    const fx = fc && fc.lengthSq() > 0.5 ? fc.x : P.hx, fz = fc && fc.lengthSq() > 0.5 ? fc.z : P.hz;
    const c = W.nearest(P.x + fx * d, P.z + fz * d, 1.6);
    return c >= 0 ? W.at(c) : null;
  };
  /** Last resort: a street 12-30 m off by the way, out of your view (the old whistle's corner). */
  const offView = (f) => {
    const fc = facing?.();
    let best = -1, bd = INF;
    for (let i = 0; i < W.N; i++) {
      const mm = f.m[i];
      if (mm < 12 || mm > 30) continue;
      const q = W.at(i), dx = q.x - P.x, dz = q.z - P.z, d = Math.hypot(dx, dz) || 1;
      if (fc && (dx * fc.x + dz * fc.z) / d > 0.2 && !W.hidden(q.x, q.z, P.x, P.z)) continue;
      if (mm < bd) { bd = mm; best = i; }
    }
    return best >= 0 ? W.at(best) : null;
  };
  /** Can you see it now: near enough, in the lens, nothing between? */
  const inSight = (see, cone) => dist(P, G) <= see && inCone(cone) && W.sight(G.x, G.z, P.x, P.z);
  const setAt = (q) => { G.x = q.x; G.z = q.z; G.y = ground(G.x, G.z); G.speed = 0; G.yaw = Math.atan2(P.x - G.x, P.z - G.z); };
  const answer = () => {
    // the yip comes from where you'll see it (placed first when it was out of view: heard from far off, it is not at all)
    const dP = dist(P, G);
    if (dP <= 5 || inSight(A.whistle.see, A.whistle.cone)) say('dog-yip', 0.9, true, 30);   // (the answer carries: you called it)
    else G.yipDue = true;
    G.act = null; G.roll = G.pitch = 0;
    // already just in front of you: the greeting there; beside or behind you (under or out of your view), it bounds
    // out to the spot in front and greets you from there
    const fs0 = frontSpot(A.whistle.near);
    if (fs0 && dist(G, fs0) < 1.2 && G.state !== 'nap' && G.state !== 'home') { greet(); return; }
    G.target = null; G.resume = null; G.drops = 0;
    G.state = 'come'; G.since = 0; G.thinkT = -9; G.waitT = 0; G.cameYip = false;
    const pre = fields.whistle;
    G.field = pre && pre.goalAt && dist(pre.goalAt, P) < 3 ? pre : aim('follow', P.x, P.z, 0.6, A.whistle.far * 1.5); G.thinkT = 0;
    const W_ = A.whistle;
    if (inSight(W_.see, W_.cone)) return;               // you can see it: it runs from where it is
    // out of your view (behind you, round a corner, far off): it is set on a street ahead of you, in view, and runs in
    const f = G.field;
    while (!f.ready) f.work(50);          // (grown over the notes already: this finishes it, if anything)
    enterView(f, W_.from, W_.cone);        // 1-4 ms
    sayDue();
  };
  const sayDue = () => { if (G.yipDue) { G.yipDue = false; say('dog-yip', 0.9, true, 30); } };
  /** Arrived at your whistle (or already beside you): the greeting. */
  const greet = () => {
    G.state = 'caught'; G.since = 0;
    play('greet', { yaw0: Math.atan2(P.x - G.x, P.z - G.z), s: Math.random() < 0.5 ? 1 : -1 });
  };
  /** The Strong Nine (main.js, when it kicks in): the pup comes to just in front of you and giggles and rolls about for
   * `dur` seconds.  Not during Han's show, and not when it is asleep for the day and far off. */
  const tipsy = (dur = 10) => {
    if (!W.built || HAN_SHOW.running() || G.state === 'staged') return;
    G.resumeK = G.state === 'lead' || G.state === 'atSpot' || G.state === 'gate' ? G.leg : G.resumeK;
    G.state = 'party'; G.partyT = dur; G.partyK = 0; G.since = 0; G.act = null; G.roll = G.pitch = 0; G.target = null; G.whistleAt = null;
    G.field = aim('follow', P.x, P.z, 0.6, 120);
    if (inSight(24, 40)) return;
    const f = G.field;
    while (!f.ready) f.work(50);
    enterView(f, A.party.from, 30);
  };
  GUIDE.tipsy = tipsy;
  /** Its hello, for main.js's view: where its head is while it runs in front of you and says hello, else null. */
  const _head = { x: 0, y: 0, z: 0 };
  GUIDE.greeting = () => {
    if (G.state !== 'intro' || !(G.introSaid || (inCone(40) && dist(P, G) < 12))) return null;
    _head.x = G.x; _head.z = G.z; _head.y = G.y + 0.3;
    return _head;
  };
  GUIDE.whistle = whistle;
  /** "Not interested": it stops and waits where it is (the leg counts as skipped); a tilt of the head, "okay". */
  const drop = () => {
    if (G.target?.id && G.target.id !== 'gate') G.skipped.add(G.target.id);
    G.drops++; G.dropT = G.t;
    G.state = 'wait'; G.field = null; G.since = 0; G.waitT = 0; G.act = null; G.speed = 0;
    play('tilt');
  };
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
  /** Player on a famous view, and is the pup in the picture? */
  const onView = () => heroes.some((h) => dist(P, h) < 1.4);
  /** Is Hachi within `deg` of the middle of your view? */
  const inCone = (deg) => {
    const f = facing?.();
    if (!f || f.lengthSq() < 0.5) return false;
    const dx = G.x - P.x, dz = G.z - P.z, d = Math.hypot(dx, dz) || 1;
    return (dx * f.x + dz * f.z) / d > Math.cos(deg * Math.PI / 180);
  };
  /* the introduction's caption: a small card just above where it sits in your view (the view eases down to it, so it
   * sits in the lower third: a card lower would cover it), two lines, fades by itself */
  let cardEl = null, cardT = -1;
  const showCard = () => {
    if (typeof document === 'undefined') return;
    if (!cardEl) {
      cardEl = document.createElement('div');
      cardEl.id = 'hachi-card';
      cardEl.setAttribute('aria-live', 'polite');
      cardEl.style.cssText = 'position:fixed;left:50%;bottom:36%;transform:translateX(-50%) translateY(6px);z-index:7;pointer-events:none;'
        + 'max-width:min(560px,86vw);padding:11px 20px 12px;border-radius:14px;background:rgba(24,20,34,.74);color:#fff6e6;'
        + 'font:500 16px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;text-align:center;'
        + 'box-shadow:0 6px 24px rgba(0,0,0,.25);opacity:0;transition:opacity .45s ease,transform .45s ease;';
      const a = document.createElement('div'); a.style.cssText = 'font-weight:700;font-size:18px;margin-bottom:2px;'; a.textContent = STRINGS.hachi.hi;
      const b = document.createElement('div'); b.style.cssText = 'opacity:.92;'; b.textContent = STRINGS.hachi.line;
      cardEl.append(a, b);
      document.body.appendChild(cardEl);
    }
    requestAnimationFrame(() => { cardEl.style.opacity = '1'; cardEl.style.transform = 'translateX(-50%)'; });
    cardT = 0;
  };
  const tickCard = (dt) => {
    if (cardT < 0 || !cardEl) return;
    cardT += dt;
    if (cardT > A.introCard) { cardEl.style.opacity = '0'; cardEl.style.transform = 'translateX(-50%) translateY(6px)'; cardT = -1; }
  };
  const inFrame = () => {
    const f = facing?.();
    if (!f || f.lengthSq() < 0.5) return true;
    const dx = G.x - P.x, dz = G.z - P.z, d = Math.hypot(dx, dz) || 1;
    return (dx * f.x + dz * f.z) / d > Math.cos(1.05);      // 60 degrees either side of the lens
  };

  /* ---- placing ---- */
  const place = () => {
    const l = ctx.toLocal({ x: G.x, z: G.z });
    const yaw = G.yaw + turned;
    // rolled on its back: turned about a centre at the body's height, not about its feet
    const cy = G.roll !== 0 && Math.abs(G.roll) > 0.5 ? BODY_R : 0;
    const ox = Math.sin(G.roll) * cy, oy = cy - Math.cos(G.roll) * cy;
    herd.set(0, l.x + ox * Math.cos(yaw), G.y + oy, l.z - ox * Math.sin(yaw), yaw, G.pitch + (G.bpitch ?? 0), G.roll, A.size);
    herd.setPose(0, G.ph, G.amp, G.look, G.nod);
    herd.setPose2(0, G.posture, G.wag, G.perk, G.tilt);
    herd.flush();
    const sit = Math.max(0, Math.min(1, G.posture)), lie = Math.max(0, G.posture - 1), bow = Math.max(0, -G.posture);
    shadows.set(shadow, l.x + Math.sin(yaw) * 0.02, G.y - G.hop, l.z + Math.cos(yaw) * 0.02, SHADOW[0] * (1 + 0.5 * lie + 0.1 * (cy > 0 ? 1 : 0)) * A.size, SHADOW[1] * (1 - 0.25 * sit + 0.2 * lie + 0.15 * bow) * A.size, yaw);
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
  const move = (dt, to, wantSpeed, turnRate = 5) => {
    const dx = to.x - G.x, dz = to.z - G.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { G.speed = 0; return 'there'; }
    const want = Math.atan2(dx, dz);
    const dyaw = turn(G.yaw, want);
    const rate = turnRate * dt;
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
  /** After you: straight at you when you are in plain sight, else down a field grown from where you are
   * (re-grown only once the last one is ready and you have moved on, so it never stands "thinking" while you walk). */
  const pursue = (dt, speed) => {
    const dP = dist(P, G);
    if (dP < 14 && W.sight(G.x, G.z, P.x, P.z)) { G.field = null; return move(dt, P, speed); }
    const f = fields.follow;
    const stale = !f || !f.goalAt || (f.ready && (dist(f.goalAt, P) > 3 || G.since - G.thinkT > 2.5)) || dist(f.goalAt, P) > 12;
    if (stale) { G.field = aim('follow', P.x, P.z, 0.6, Math.min(90, dP * 2 + 20)); G.thinkT = G.since; }
    else G.field = f;
    return steer(dt, speed);
  };
  /** A step of `s` metres along `yaw`, only onto free ground. */
  const stepAlong = (yaw, s) => {
    const nx = G.x + Math.sin(yaw) * s, nz = G.z + Math.cos(yaw) * s;
    if (!W.free(nx, nz)) return false;
    G.moved += s; G.x = nx; G.z = nz; return true;
  };
  /** Room for a circle of radius r about (cx, cz)? */
  const roomFor = (cx, cz, r) => { for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; if (!W.free(cx + Math.sin(a) * r, cz + Math.cos(a) * r)) return false; } return true; };

  /* ---- the acts: the pup's little performances (Tan: "roll on the floor, jump around, and so on") ----
   * Each runs for `dur` seconds and shapes the pose that frame; the moving
   * ones (zoomies, chasing its tail, the circle round your legs) move it too.
   * Which one, and when, comes from its energy and how near you are. */
  const ACTS = {
    bow: 2.2, roll: 4.2, tail: 2.8, zoom: 3.4, hop: 0.6, sneeze: 1.1, shake: 0.7, tilt: 1.6, trip: 0.8, greet: 3.8,
  };
  const play = (name, extra = {}) => {
    if (G.act && G.act.name === name) return false;
    G.act = { name, t: 0, dur: ACTS[name], ...extra };
    G.last = name;
    G.idleT = 0;
    if (name === 'bow') { say('dog-yip', 0.8); G.energy -= 0.05; }
    else if (name === 'roll') { G.energy -= 0.12; }
    else if (name === 'tail') { say('dog-yip', 0.7); G.energy -= 0.3; }
    else if (name === 'zoom') { say('dog-awoo', 0.8, true); G.energy -= 0.45; }
    else if (name === 'hop') { G.hopT = 0; G.energy -= 0.04; if (Math.random() < 0.5) say('dog-yip', 0.7); }
    else if (name === 'sneeze') {}
    else if (name === 'shake') { G.shakeT = 0; say('dog-shake', 0.7); }
    else if (name === 'tilt') { G.tiltT = 0; G.tiltSide = Math.random() < 0.5 ? -1 : 1; if (Math.random() < 0.5) say('dog-hmm', 0.7); }
    else if (name === 'trip') { G.energy -= 0.02; }
    return true;
  };
  /** An idle act, chosen by mood: playful near you, restful when tired, never the same twice running. */
  const idle = (dP, resting) => {
    const near = THREE.MathUtils.clamp(1.5 - dP / 5, 0, 1), E = G.energy;
    const w = {
      roll: dP < 4 ? 1.1 * near + 0.2 : 0,
      tail: E > 0.55 ? 0.7 * E : 0,
      zoom: E > 0.7 && dP > 1.8 ? 0.6 * (E - 0.4) * (0.5 + near) : 0,
      bow: dP < 6 ? 0.8 * near : 0,
      hop: 0.6 * near * E,
      sneeze: 0.22,
      shake: 0.18,
      tilt: G.posture > 0.6 && dP < 8 ? 1.0 : 0.3,
      none: resting ? 1.6 : 0.8,
    };
    if (G.last && w[G.last]) w[G.last] = 0;
    let sum = 0;
    for (const k in w) sum += w[k];
    let r = Math.random() * sum;
    for (const k in w) { if ((r -= w[k]) <= 0) { if (k === 'none') { G.last = 'none'; return; } if (k === 'zoom') { zoomies(); return; } play(k); return; } }
  };
  /** Zoomies: a happy tearing circle, where there is room. */
  const zoomies = () => {
    for (const s of [1, -1]) {
      const R = A.zoom.r, cx = G.x + Math.cos(G.yaw) * -s * R, cz = G.z + Math.sin(G.yaw) * s * R;   // the centre off to one side
      if (roomFor(cx, cz, R)) { play('zoom', { cx, cz, R, s, a: Math.atan2(G.x - cx, G.z - cz) }); return true; }
    }
    G.last = 'zoom';
    return false;
  };
  /** Zoomies with you at the centre (you've just arrived): a lap round you, if there is room. */
  const zoomRound = () => {
    const R = A.zoom.r;
    if (!roomFor(P.x, P.z, R)) return zoomies();
    const a = Math.atan2(G.x - P.x, G.z - P.z);
    play('zoom', { cx: P.x, cz: P.z, R, s: Math.random() < 0.5 ? 1 : -1, a, you: true });
    return true;
  };
  /** The act's frame: returns true while it owns the pup's movement. */
  const act = (dt, pose) => {
    const a = G.act;
    if (!a) return false;
    a.t += dt;
    const u = a.t / a.dur;
    if (u >= 1) { G.act = null; G.roll = 0; G.pitch = 0; return false; }
    switch (a.name) {
      case 'bow':
        pose.posture = -1; pose.wag = 0.7; pose.perk = 1.3; pose.look = pose.toYou; pose.nod = -0.15;
        // the rump wiggles a touch
        G.rollTo = 0.04 * Math.sin(a.t * 14);
        return true;
      case 'roll': {
        // down, over onto the back, a wiggle with the paws in the air, and up again
        const over = ease((u - 0.18) / 0.2) * (1 - ease((u - 0.8) / 0.16));
        pose.posture = 2 * Math.min(1, ease(u / 0.18) + over) * (u < 0.85 ? 1 : 1 - ease((u - 0.85) / 0.15));
        pose.posture = Math.max(pose.posture, 2 * over);
        const wig = over * Math.sin(a.t * 9) * 0.35;
        G.rollTo = (Math.PI + wig) * over + (u < 0.18 ? 0 : 0);
        pose.amp = over * 0.7; pose.phRate = 13 * over;
        pose.wag = 0.6; pose.perk = 0.4 + 0.5 * (1 - over); pose.look = over > 0.5 ? 0.6 * Math.sin(a.t * 3) : pose.toYou; pose.nod = -0.2 * over;
        if (G.state === 'party') {
          // tipsy with you: giggling on its back, paws going, a wriggle side to side
          if (!a.g1 && u > 0.2) { a.g1 = true; say('dog-giggle', 0.85, true); }
          if (!a.g2 && u > 0.55) { a.g2 = true; say('dog-giggle', 0.8, true); }
          pose.amp = over; pose.phRate = 17 * over;
          G.rollTo += over * (A.party.lean + 0.12 * Math.sin(a.t * 5.5));   // tipped a little your way: the belly, not the flank
        } else if (!a.said && u > 0.32) { a.said = true; say('dog-snort', 0.7, true); }
        return true;
      }
      case 'tail': {
        // round and round after its own tail, on a tight circle
        const s = a.s ?? (a.s = Math.random() < 0.5 ? 1 : -1);
        G.yaw += s * 5.2 * dt;
        stepAlong(G.yaw, 0.55 * dt);
        pose.amp = 0.9; pose.phRate = 14; pose.look = -s * 1.35; pose.nod = 0.25; pose.wag = 0.5; pose.perk = 1.3;
        G.pitchTo = 0.08;
        return true;
      }
      case 'zoom': {
        // a fast lap on a circle about (cx, cz), leaning in, ears back, tongue out; skid at the end
        const v = A.zoom.speed, w = v / a.R;
        if (u < 0.86) {
          a.a += a.s * w * dt;
          const nx = a.cx + Math.sin(a.a) * a.R, nz = a.cz + Math.cos(a.a) * a.R;
          if (W.free(nx, nz)) { G.moved += dist({ x: nx, z: nz }, G); G.x = nx; G.z = nz; }
          G.yaw = a.a + a.s * Math.PI / 2;
          G.speed = v;
          pose.amp = 1; pose.phRate = 16; pose.perk = 0.25; pose.wag = 0.3; pose.look = -a.s * 0.5; pose.nod = 0.1;
          G.rollTo = a.s * 0.18; G.pitchTo = 0.04;
        } else {
          // the skid: sits back on its haunches, then a shake
          G.speed *= Math.max(0, 1 - dt * 10);
          pose.amp = 0; pose.posture = 0.5; pose.perk = 1.3; pose.look = pose.toYou; pose.wag = 0.7;
          G.pitchTo = -0.12; G.rollTo = 0;
          if (!a.shook) { a.shook = true; G.shakeT = 0; }
        }
        return true;
      }
      case 'greet': {
        // at your whistle, arrived: a skid, a happy spin on the spot, two little bounces up at you, then a sit looking up,
        // head tilted, tongue out, tail going
        G.speed *= Math.max(0, 1 - dt * 10);
        const toP = Math.atan2(P.x - G.x, P.z - G.z);
        pose.perk = 1.3; pose.wag = 1;
        if (u < 0.1) { pose.posture = 0.35; G.pitchTo = -0.14; pose.look = pose.toYou; pose.nod = pose.nodYou; }
        else if (u < 0.4) {
          const k = ease((u - 0.1) / 0.3);
          G.yaw = a.yaw0 + a.s * Math.PI * 2 * k;
          pose.amp = 0.85; pose.phRate = 17; pose.look = -a.s * 0.55; pose.nod = 0.05; G.rollTo = a.s * 0.12;
          if (!a.said) { a.said = true; say('dog-giggle', 0.7, true); }
        } else if (u < 0.68) {
          G.yaw += turn(G.yaw, toP) * Math.min(1, dt * 10);
          if (!a.h1) { a.h1 = true; G.hopT = 0; }
          if (!a.h2 && u > 0.54) { a.h2 = true; G.hopT = 0; say('dog-yip', 0.75, true); }
          G.pitchTo = -0.22 * Math.sin(Math.PI * ((u - 0.4) / 0.14 % 1));
          pose.look = pose.toYou; pose.nod = pose.nodYou;
        } else {
          G.yaw += turn(G.yaw, toP) * Math.min(1, dt * 6);
          pose.posture = 1; pose.look = pose.toYou; pose.nod = pose.nodYou - 0.05;
          if (!a.tilted && u > 0.74) { a.tilted = true; G.tiltT = 0; G.tiltSide = a.s; say('dog-hmm', 0.7, true); }
        }
        return true;
      }
      case 'hop':
        // a little pounce: up, nose down at the top, landing on the forepaws
        G.pitchTo = 0.35 * Math.sin(Math.PI * u);
        pose.perk = 0.55; pose.wag = 0.6; pose.look = pose.toYou;
        return true;
      case 'sneeze':
        // the head goes back... and snaps down; then a shake of the whole pup
        pose.nod = u < 0.45 ? -0.4 * ease(u / 0.45) : 0.55 * (1 - ease((u - 0.5) / 0.5));
        pose.perk = u < 0.45 ? 0.5 : 0.9;
        if (!a.said && u >= 0.45) { a.said = true; say('dog-sneeze', 0.8, true); G.shakeT = 0; }
        return false;
      case 'shake': return false;
      case 'tilt': pose.look = pose.toYou; pose.nod = pose.nodYou - 0.05; return false;
      case 'trip':
        // a paw catches: a stumble forward, a dip, and on as if nothing happened
        G.pitchTo = 0.28 * Math.sin(Math.PI * Math.min(1, u * 1.4));
        G.dip = -0.03 * Math.sin(Math.PI * u);
        pose.speedK = 0.45; pose.perk = 0.6; pose.nod = 0.3 * Math.sin(Math.PI * u);
        return false;
    }
    return false;
  };

  /* ---- what it does ---- */
  function update(dt, cam) {
    if (!W.built) { W.build(); const c = W.nearest(HOME.x, HOME.z, 3); if (c >= 0) { const q = W.at(c); G.x = q.x; G.z = q.z; } G.y = ground(G.x, G.z); prefetch(); }
    G.t += dt;
    // you: where, how fast, which way
    const jumped = !P.first && Math.hypot(cam.x - P.x, cam.z - P.z) > 3;
    if (dt > 0 && !P.first) {
      const vx = (cam.x - P.x) / dt, vz = (cam.z - P.z) / dt, k = Math.min(1, dt * 6);
      P.vx += (vx - P.vx) * k; P.vz += (vz - P.vz) * k;
      P.speed = Math.min(6, Math.hypot(P.vx, P.vz));
      if (P.speed > 0.5) { P.hx = P.vx / P.speed; P.hz = P.vz / P.speed; }
    }
    P.x = cam.x; P.z = cam.z; P.y = cam.y; P.first = false;
    if ((listT += dt) > 2 || !list.length) { listT = 0; refresh(); }
    /* waiting with you for the train (QA-010): the train's spot is not on offer until it stands there with its doors
     * open (`hidden`), and while it is coming its entry says so (`wait`: which way it comes from, whether it can be
     * heard yet).  The doors opening, having waited: a happy wag */
    const trainE = G.target?.id === 'train' ? list.find((e) => e.id === 'train') : null;
    if (G.trainWas && trainE && !trainE.hidden && (G.state === 'atSpot' || G.state === 'linger')) G.cheerT = A.trainCheer;
    G.trainWas = !!(trainE?.hidden && trainE.wait) && G.state === 'atSpot';
    // stepping into a ring is the engagement: done
    // done: its own code says it was had (the bench's seat, Han's show, the konbini, the train's announcement), or you
    // stepped into its ring while it was on offer
    for (const e of list) if (!G.done.has(e.id) && (e.used || (!e.hidden && dist(P, e) < rOf(e) + 0.25))) { G.done.add(e.id); G.skipped.delete(e.id); if (G.target?.id === e.id && (G.state === 'lead' || G.state === 'atSpot')) { G.state = 'linger'; G.since = 0; G.act = null; G.drops = 0; } }
    // the famous views: never in the picture while you stand on one (keys 1-3
    // put you there in a jump: it is home at once; walking on, it trots out)
    const view = onView() && (P.speed < 0.6 || jumped);
    if (view && jumped) { const c = W.nearest(HOME.x, HOME.z, 3); const q = c >= 0 ? W.at(c) : HOME; G.x = q.x; G.z = q.z; G.speed = 0; G.state = 'home'; G.field = null; G.act = null; G.roll = G.pitch = 0; G.yaw = Math.atan2(P.x - G.x, P.z - G.z); }
    else if (view && G.state !== 'home' && G.state !== 'nap' && G.state !== 'intro' && G.state !== 'ready' && inFrame()) { G.resumeK = G.state === 'lead' || G.state === 'atSpot' || G.state === 'gate' ? G.leg : null; G.act = null; goTo('home', HOME); }
    // Han's show: off the car's way, sitting, watching it go by
    const show = HAN_SHOW.running();
    if (show && G.state !== 'hazard') {
      const c = W.cell(G.x, G.z);
      if (c >= 0 && W.haz[c]) { G.resumeK = G.state === 'lead' || G.state === 'atSpot' || G.state === 'gate' ? G.leg : G.resumeK; const n = W.nearest(G.x, G.z, 8, (i) => !W.haz[i]); G.state = 'hazard'; G.aside = n >= 0 ? W.at(n) : null; G.field = null; G.waitT = 0; G.act = null; }
    }
    if (!show && G.state === 'hazard') { G.state = 'home'; if (G.resumeK !== null) { const k = G.resumeK; G.resumeK = null; lead(k); } else nextOrNap(); }

    /* the introduction (Tan, 2026-09-29: every time the game begins, nothing remembered): a moment after you press
     * Start it runs out from behind you to `A.intro.d` m in front (nearer, it is under the start view's frame: the lens
     * looks up at Fuji), turns to face you, sits and says hello (a caption); then it waits there until you walk off */
    if (!G.intro && (G.t > A.intro.after || dist(P, VIEW) > 1.5) && !show && !inStore(P) && ['home', 'nap'].includes(G.state)) {   // (walk off the view sooner: the hello comes then)
      const fs = frontSpot(A.intro.d);
      G.introSpot = fs ?? { x: G.x, z: G.z };
      G.intro = 1; G.introT = 0; G.introSaid = false;
      G.state = 'intro'; G.field = aim('goal', G.introSpot.x, G.introSpot.z, 0.3); G.act = null;
    }
    // the field grows a little each frame while it is wanted; the others are grown ahead, one at a time
    // (not while a whistle is pending: its own way is growing, and two fields grown in turn undo each other's work)
    if (G.whistleAt !== null) {}
    else if (G.field && !G.field.ready) G.field.work(dt > 0 ? 4 : 40);
    else if (dt > 0) {
      if (growing && growing.ready) growing = null;
      if (!growing && queue.length) growing = queue.shift()();
      if (growing && !growing.ready) growing.work(2.5);
    }

    const dP = dist(P, G);
    const dxp = P.x - G.x, dzp = P.z - G.z;
    const toYou = THREE.MathUtils.clamp(turn(G.yaw, Math.atan2(dxp, dzp)), -1.4, 1.4);
    const headY = G.y + 0.27 * (1 - 0.3 * Math.max(0, G.posture - 1));
    const nodYou = THREE.MathUtils.clamp(-Math.atan2(P.y - headY, Math.max(0.5, dP)) * 0.8, -0.6, 0.35);
    const pose = { posture: 0, wag: 0.15, perk: 1, look: null, nod: null, amp: null, phRate: 0, speedK: 1, bound: 0, toYou, nodYou };
    let wantSpeed = 0, lookAt = 'player';
    G.rollTo = 0; G.pitchTo = 0; G.dip = 0;
    // how far ahead of you it is: along the way, or as the crow flies when you are right here (off the way, your path metres run long)
    const gap = () => (G.field?.ready ? Math.min(G.field.near(P.x, P.z) - G.field.at(G.x, G.z), dP) : 0);
    /* "not interested" (Tan: if I walk away, the pup should follow me, not insist) */
    const notInterested = (waiting) => {
      if (inStore(P) || !G.target) return false;
      if (dP > D.away) return true;
      // your heading against the way: the field's downhill from where you stand
      if (P.speed > 0.6 && G.field?.ready) {
        const c = W.nearest(P.x, P.z, 1.2, (i) => G.field.m[i] < INF);
        const n = c >= 0 ? G.field.next(c) : -1;
        let wx, wz;
        if (n >= 0) { const q = W.at(n), o = W.at(c); wx = q.x - o.x; wz = q.z - o.z; } else { wx = G.target.x - P.x; wz = G.target.z - P.z; }
        const l = Math.hypot(wx, wz) || 1;
        const cos = (P.vx * wx + P.vz * wz) / (P.speed * l);
        G.offT = cos < Math.cos(D.angle * Math.PI / 180) ? G.offT + dt : Math.max(0, G.offT - 2 * dt);
        if (G.offT > D.angleT) return true;
      }
      // while it waits, your distance to the spot grows
      const d = G.field?.ready ? G.field.near(P.x, P.z) : dist(P, G.target) * 1.3;
      if (waiting) { if (G.waitD0 === null || d < G.waitD0) G.waitD0 = d; if (d - G.waitD0 > D.grow) return true; } else G.waitD0 = null;
      return false;
    };
    let r = 'still';
    switch (G.state) {
      case 'home': {
        if (!G.field) goTo('home', HOME);
        const there = dist(G, HOME) < 0.6;
        if (!there) { r = steer(dt, A.trot); lookAt = 'way'; } else G.waitT += dt;
        pose.wag = dP < 6 ? 0.5 : 0.2;
        pose.posture = there && G.waitT > A.waitSit ? 1 : 0;
        // you walk off the view: it comes and suggests the first place
        if (!view && dist(P, VIEW) > 1.5 && !inStore(P) && G.intro !== 0) { const k = G.resumeK ?? G.leg ?? 0; G.resumeK = null; lead(k); }   // (the hello first)
        break;
      }
      case 'lead': {
        // a suggestion: it trots ahead along the way and looks back; you decide
        G.since += dt;
        const g = gap();
        const [lo, hi] = A.lead;
        if (G.field?.ready && G.field.at(G.x, G.z) < 1.2 && G.field.at(G.x, G.z) !== INF) {
          if (isStop(G.target) || G.leg >= TOUR.length) { G.state = 'atSpot'; G.aside = beside(G.target); G.waitT = 0; G.minD = INF; break; }
          if (G.target.leg?.wait) { G.state = 'gate'; G.waitT = 0; G.since = 0; break; }
          // a waypoint passed: a glance back where there is something to hear, and on
          if (G.target.leg?.hear) { G.glance = -1.3; if (Math.random() < 0.5) say('dog-boof', 0.6); }
          advance(); break;
        }
        // a jog, quicker than your walk (Tan: slowly following it was annoying); you close, it picks up; you run, it runs;
        // too far ahead, it stops and looks back
        if (g < lo) wantSpeed = Math.min(A.run, Math.max(A.jog, P.speed + 1.5));
        else if (g < hi) wantSpeed = Math.min(A.run, Math.max(A.jog, P.speed + 0.5));
        else wantSpeed = 0;
        if (wantSpeed > 0) { r = steer(dt, wantSpeed); lookAt = 'way'; G.waitT = 0; pose.bound = 0.45; } else { G.waitT += dt; lookAt = 'player'; }
        if (r === 'lost' || r === 'thinking') { G.waitT += dt; lookAt = 'player'; }
        if (r === 'lost' && G.field?.ready) { G.lostFor = (G.lostFor ?? 0) + dt; if (G.lostFor > 1.5) { G.lostFor = 0; const q = nearestReach(G.target); if (q) G.near = q; } } else G.lostFor = 0;
        pose.posture = G.waitT > A.waitSit && G.speed < 0.1 ? 1 : 0;
        pose.wag = G.speed > 0.5 ? 0.3 : G.waitT > 6 ? 0.1 : 0.45;
        if (G.since > 1.0 && notInterested(wantSpeed === 0)) { drop(); break; }
        if (G.since > 8) G.drops = 0;                   // you came along a while: a fresh count of walk-aways

        // waiting a while: a little something to pass the time
        if (G.waitT > 2 && G.speed < 0.1 && !G.act && (G.idleT += dt) > 3 + Math.random() * 3) idle(dP, true);
        break;
      }
      case 'atSpot': {
        // beside the ring, waiting for you to step in; playful when you come close
        G.since += dt;                       // (its clock runs here too: arrived within a second, it never let you go)
        const q = G.aside ?? G.target;
        if (dist(G, q) > 0.25 && !G.done.has(G.target.id) && !G.act) { r = move(dt, q, A.trot * 0.8); lookAt = 'way'; G.waitT = 0; } else G.waitT += dt;
        if (G.shook !== G.target.id && dist(G, q) <= 0.25) { G.shook = G.target.id; play('shake'); }
        if (G.hopped !== G.target.id && dist(P, G.target) < 3.5 && G.speed < 0.2) { G.hopped = G.target.id; G.waitT = 0; if (G.energy > 0.6 && Math.random() < 0.5) zoomRound(); else play('hop'); }
        pose.posture = G.waitT > A.waitSit + 1 ? 1 : 0;
        pose.wag = dP < 6 ? 0.55 : 0.2;
        if (G.since > 1.0 && notInterested(true)) { drop(); break; }
        const tw = G.trainWas ? trainE.wait : null;
        if (tw && dist(G, q) <= 0.25 && !G.act) {
          /* the train isn't in (QA-010): it sits by the spot facing down the line, the way it will come; its sound
           * coming up, ears up and a small boof, once a train */
          const want = Math.atan2(tw.from.x, tw.from.z), dy = turn(G.yaw, want);
          G.yaw += THREE.MathUtils.clamp(dy, -dt * 2.5, dt * 2.5);
          pose.posture = Math.abs(dy) < 0.6 ? 1 : 0;
          pose.wag = tw.near ? 0.5 : 0.2;
          pose.perk = tw.near ? 1.3 : 1;
          lookAt = tw.near ? 'line-alert' : 'line';
          if (tw.near && !G.heardTrain) { G.heardTrain = true; say('dog-boof', 0.75, true); }
        }
        if (!tw?.near) G.heardTrain = false;
        if (!tw && !G.act && G.speed < 0.1 && (G.idleT += dt) > 2.5 + Math.random() * 3) idle(dP, G.waitT > 10);
        break;
      }
      case 'gate': {
        // the Deer Park gate: it waits for you to come up (a hop when you do), then turns back with you
        G.since += dt; G.waitT += dt;
        pose.wag = dP < 6 ? 0.55 : 0.25;
        pose.posture = G.waitT > A.waitSit + 1 ? 1 : 0;
        if (dist(P, G.target) < (G.target.leg.wait ?? 6)) { G.gateDone = true; play('hop'); advance(); break; }
        if (G.since > 1.0 && notInterested(true)) { drop(); break; }
        if (!G.act && G.speed < 0.1 && (G.idleT += dt) > 2.5 + Math.random() * 3) idle(dP, G.waitT > 10);
        break;
      }
      case 'intro': {
        // "Hi, I'm Hachi": a happy bounding run out in front of you, a turn to face you, sit, look up, a double yip, the
        // caption, a wag and a head tilt
        G.introT += dt;
        const spot = G.introSpot;
        const there = dist(G, spot) < 0.4 || G.introT > 8;
        if (!there) { r = G.field?.ready ? steer(dt, A.whistle.gallop) : 'thinking'; if (r === 'there' || r === 'lost') r = move(dt, spot, A.whistle.gallop); lookAt = 'way'; pose.bound = 1; pose.perk = 0.6; pose.wag = 0.9; break; }
        G.yaw += turn(G.yaw, Math.atan2(P.x - G.x, P.z - G.z)) * Math.min(1, dt * 6);
        if (!G.introSaid) { G.introSaid = true; G.introAt = G.introT; say('dog-yip', 0.9, true, 30); G.tiltNext = 0.8; showCard(); }
        pose.posture = 1; pose.wag = 0.8; pose.perk = 1.3; pose.look = toYou; pose.nod = nodYou;
        const shown = G.introT - G.introAt;
        if (shown > A.intro.hold) { G.intro = 2; G.state = 'ready'; G.waitT = 0; G.field = null; }
        break;
      }
      case 'ready': {
        // introduced: sitting where it said hello, watching you, until you walk off; then the tour
        G.waitT += dt;
        G.yaw += turn(G.yaw, Math.atan2(P.x - G.x, P.z - G.z)) * Math.min(1, dt * 3);
        pose.posture = 1; pose.wag = dP < 9 ? 0.5 : 0.25; pose.look = toYou; pose.nod = nodYou;
        if (!G.act && (G.idleT += dt) > 4 + Math.random() * 3) { const k = ['tilt', 'sneeze', 'bow'][Math.floor(Math.random() * 3)]; play(k); }
        if (dist(P, VIEW) > 1.5 && !view) { G.act = null; lead(G.leg ?? 0); }
        break;
      }
      case 'linger': {
        // you're having the experience: it waits by, then plays a little, until you come away
        G.since += dt; G.waitT += dt;
        pose.posture = G.waitT > A.waitSit ? 1 : 0;
        pose.wag = dP < 5 ? 0.5 : 0.15;
        if (!G.act && (G.idleT += dt) > 3 + Math.random() * 3) idle(dP, G.waitT > 15);
        if (G.since > 1.5 && dist(P, G.target) > 4 && !inStore(P) && !view) { G.act = null; nextOrNap(); }
        break;
      }
      case 'wait': {
        // you went your own way: it stays put (a guide, not a follower), watching you go, playing a little; walk
        // back to it and it takes you on where it left off, or whistle (F) and it comes
        G.since += dt; G.waitT += dt;
        pose.posture = G.waitT > A.waitSit ? 1 : 0;
        pose.wag = dP < 6 ? 0.5 : 0.15;
        if (!G.act && G.speed < 0.1 && (G.idleT += dt) > 3 + Math.random() * 3) idle(dP, G.waitT > 12);
        if (G.since > 3 && dP < D.rejoin && !inStore(P) && !view) { G.act = null; play('hop'); lead(G.leg ?? 0); }   // on with the tour where it left off
        break;
      }
      case 'caught': {
        // the greeting (or the party) plays out; then off to the nearest place you haven't been
        pose.wag = 0.7; pose.perk = 1.3;
        if (!G.act) rushNext();
        break;
      }
      case 'come': {
        // whistled: a bounding puppy gallop to just in front of you (across your view, not at your feet), ears flopping,
        // tongue out, tail going; there, the greeting
        G.since += dt;
        // the spot it runs for slides in as it comes: far off it aims well out in front of you, so the run swings across
        // the middle of your view instead of along its edge; close, it is the greeting spot
        const lead = THREE.MathUtils.clamp(0.5 * dP, A.whistle.near, 7);
        const fs = frontSpot(lead) ?? frontSpot(A.whistle.near);
        const dF = fs ? dist(G, fs) : dP;
        if ((dF > 0.45 || lead > A.whistle.near + 0.3) && dP > 1.1) {
          r = fs && dF < 24 && W.sight(G.x, G.z, fs.x, fs.z) ? move(dt, fs, A.whistle.gallop) : pursue(dt, A.whistle.gallop);
          lookAt = 'player'; pose.bound = 1;
          // no way to you from where it is (a pocket of the grid): it comes in from where you'll see it, else to your side
          if (r === 'lost' && G.since > 4) { const f = aim('follow', P.x, P.z, 0.6, 120); while (!f.ready) f.work(50); G.since = 0; if (!enterView(f, A.whistle.from, A.whistle.cone)) { const n = W.nearest(P.x, P.z, 4); if (n >= 0) setAt(W.at(n)); } }
          if (!G.cameYip && dP < 7) { G.cameYip = true; say('dog-yip', 0.8); }
        } else greet();
        pose.perk = 0.6; pose.wag = 0.95; pose.nod = 0.02;
        break;
      }
      case 'party': {
        // the Strong Nine: to just in front of you, then rolling about on its back, giggling, a play bow, round after its tail
        G.since += dt; G.partyT -= dt;
        const spot = frontSpot(A.party.d) ?? { x: G.x, z: G.z };
        if (!G.act) {
          const off = dist(G, spot);
          if (off > 0.6 && G.partyT > 1) { r = off < 24 && W.sight(G.x, G.z, spot.x, spot.z) ? move(dt, spot, off > 3 ? A.run : A.trot) : pursue(dt, A.run); lookAt = 'player'; pose.bound = off > 3 ? 1 : 0; pose.wag = 0.95; }   // (flat out: the fun lasts ten seconds)
          else if (G.partyT > 1.2) {
            const seq = ['roll', 'roll', 'bow', 'roll', 'tail', 'roll'];
            const next = seq[G.partyK++ % seq.length];
            // rolls side-on to you, belly and paws your way; quicker than an idle roll, one after another
            if (next === 'roll') G.yaw = Math.atan2(P.x - G.x, P.z - G.z) - 1.4;   // (this side on, the belly and paws face you; the other way you see its back)
            play(next, next === 'roll' ? { dur: 3.0 } : next === 'bow' ? { dur: 1.6 } : {});
          }
        }
        pose.perk = 1.3; pose.wag = Math.max(pose.wag, 0.9);
        if (G.partyT <= 0 && !G.act) { G.state = 'caught'; G.since = 0; }
        break;
      }
      case 'hazard': {
        if (G.aside && dist(G, G.aside) > 0.25) { r = move(dt, G.aside, A.run); lookAt = 'way'; } else G.waitT += dt;
        pose.posture = G.waitT > 1.5 ? 1 : 0;
        lookAt = 'car'; pose.wag = 0.2;
        break;
      }
      case 'nap': {
        const there = G.field?.ready && G.field.at(G.x, G.z) < W.C;
        if (!there) { r = steer(dt, A.trot); lookAt = 'way'; G.waitT = 0; } else G.waitT += dt;
        const awake = dP < 3;
        pose.posture = there ? (G.waitT > 1.5 ? 2 : 1) : 0;
        pose.perk = there ? (awake ? 1 : 0.35) : 1;
        pose.wag = awake ? 0.4 : 0;
        lookAt = there && !awake ? 'sleep' : 'player';
        break;
      }
    }
    G.r = r;
    // the train's doors opened after you waited together (QA-010): a happy wag, ears up
    if (G.cheerT > 0) { G.cheerT -= dt; pose.wag = 1; pose.perk = 1.3; }
    // your whistle: ears up until the notes are over (whatever it was doing), then the answer
    if (G.whistleAt !== null) { pose.perk = 1.2; if (fields.whistle && !fields.whistle.ready) fields.whistle.work(dt > 0 ? 3 : 40); if (G.t >= G.whistleAt) { G.whistleAt = null; answer(); } }
    // the acts shape the pose (and some of them move it)
    const acting = act(dt, pose);
    if (!acting && r !== 'moving') G.speed += (0 - G.speed) * Math.min(1, dt * 6);
    if (G.speed < 0.05) G.speed = 0;
    // tripping over its own paws, once in a while at a trot
    if (r === 'moving' && G.speed > 1.5 && !G.act && Math.random() < dt / A.tripEvery) play('trip');
    // energy: back while it rests, spent by the acts
    G.energy = THREE.MathUtils.clamp(G.energy + dt * (G.speed < 0.2 ? 0.02 : -0.004), 0, 1);

    /* ---- the body ---- */
    const k3 = Math.min(1, dt * 3);
    const ampTo = pose.amp ?? Math.min(1, G.speed / A.trot);
    G.amp += (ampTo - G.amp) * Math.min(1, dt * 6);
    G.ph += dt * (pose.phRate || G.speed * 6.5 * pose.speedK);
    // posture: stands up before it walks; the shake after a long sit
    let postureTo = pose.posture;
    const wasSitting = G.posture > 0.6;
    if (G.speed > 0.2 && postureTo > 0) postureTo = 0;
    G.posture += Math.sign(postureTo - G.posture) * Math.min(Math.abs(postureTo - G.posture), dt * (postureTo < 0 || G.posture < 0 ? 3 : 1.5));
    if (wasSitting && G.posture <= 0.6 && G.sat > 8 && G.shakeT < 0 && !G.act) play('shake');
    // panting at a trot, now and then; a whine once when you've kept it waiting; snuffly breaths asleep
    if (G.speed > 0.6) { pantT += dt; if (pantT > 3.2) { pantT = -Math.random() * 2.5; say('dog-pant', 0.55); } } else pantT = Math.min(pantT, 1.5);
    if ((G.state === 'lead' || G.state === 'atSpot') && G.waitT > 12 && !whined && !G.trainWas) { whined = true; say('dog-whine', 0.6); }
    if (G.waitT < 1) whined = false;
    if (G.state === 'nap' && G.posture > 1.8) { snoreT += dt; if (snoreT > 3.4) { snoreT = 0; say('dog-snore', 0.6); } }
    G.sat = G.posture > 0.6 ? G.sat + dt : 0;
    // the head: at you, along the way with a glance back over the shoulder, or down asleep
    let lookTo = 0, nodTo = 0.1;
    if (lookAt === 'player') { lookTo = toYou; nodTo = nodYou; }
    else if (lookAt === 'way') {
      // trotting: every few seconds a look back over the shoulder
      G.glance += dt;
      if (G.glance > 3.4) { G.glance = -1.3; if (Math.random() < 0.3) say('dog-boof', 0.6); }
      if (G.glance < 0) { lookTo = toYou; nodTo = nodYou * 0.6; } else { lookTo = Math.sin(G.t * 1.3) * 0.12; nodTo = 0.12; }
    } else if (lookAt === 'car') {
      const c = HAN_SHOW.car();
      if (c) { lookTo = THREE.MathUtils.clamp(turn(G.yaw, Math.atan2(c.x - G.x, c.z - G.z)), -1.4, 1.4); nodTo = 0.15; }
    } else if (lookAt === 'sleep') { lookTo = 0.9; nodTo = 0.2; }
    else if (lookAt === 'line') { lookTo = 0.15 * Math.sin(G.t * 0.6); nodTo = 0.05; }       // down the line, idly
    else if (lookAt === 'line-alert') { lookTo = 0; nodTo = -0.08; }                          // there it comes
    if (pose.look !== null) lookTo = pose.look;
    if (pose.nod !== null) nodTo = pose.nod;
    G.look += (lookTo - G.look) * (acting ? Math.min(1, dt * 6) : k3);
    G.nod += (nodTo - G.nod) * (acting ? Math.min(1, dt * 6) : k3);
    // sitting and waiting: a head tilt now and then, one ear up
    if (G.posture > 0.8 && G.speed < 0.1 && G.state !== 'nap' && !G.act) {
      if (G.tiltT < 0) { G.tiltNext -= dt; if (G.tiltNext <= 0) { play('tilt'); G.tiltNext = 4 + Math.random() * 5; } }
    }
    let tiltTo = 0;
    if (G.tiltT >= 0) { G.tiltT += dt; const u = G.tiltT / 1.6; tiltTo = G.tiltSide * 0.4 * Math.sin(Math.PI * Math.min(1, u)); if (u >= 1) G.tiltT = -1; }
    G.tilt += (tiltTo - G.tilt) * Math.min(1, dt * 5);
    // the tail
    const glancing = lookAt === 'way' && G.glance < 0;
    let wagTo = pose.wag;
    if (glancing) wagTo = Math.max(wagTo, 0.55);
    G.wagA += (wagTo - G.wagA) * k3;
    G.wagPh += dt * (glancing || G.wagA > 0.6 ? 18 : G.wagA > 0.4 ? 13 : 8);
    G.wag = Math.sin(G.wagPh) * G.wagA + G.amp * 0.08 * Math.sin(2 * G.ph);
    // ears: pricked when alert, back for the hop, the chase and the nap
    // excited (you close and it wagging hard): the tongue comes out (the rig reads ears past 1)
    let perk = pose.perk;
    if (perk >= 1 && G.wagA > 0.42 && dP < 7 && G.state !== 'nap') perk = 1.3;
    if (G.hopT >= 0) perk = Math.min(perk, 0.55);
    G.perk += (perk - G.perk) * Math.min(1, dt * 5);
    // the little hop, the shake, the lean and the roll
    G.hop = 0;
    if (G.hopT >= 0) { G.hopT += dt; const u = G.hopT / 0.5; G.hop = 0.14 * Math.sin(Math.PI * Math.min(1, u)); if (u >= 1) G.hopT = -1; }
    let shakeRoll = 0;
    if (G.shakeT >= 0) { G.shakeT += dt; const u = G.shakeT / 0.7; shakeRoll = 0.16 * Math.sin(G.shakeT * 70) * (1 - u); G.tilt += 0.3 * Math.sin(G.shakeT * 70 + 1) * (1 - u); if (u >= 1) G.shakeT = -1; }
    G.roll += (G.rollTo - G.roll) * Math.min(1, dt * 7);
    if (Math.abs(G.roll) < 0.002) G.roll = 0;
    G.roll += shakeRoll;
    G.pitch += (G.pitchTo - G.pitch) * Math.min(1, dt * 8);
    // the bouncy puppy trot: a high bob at two beats a stride
    // the whistle's gallop: a bound a stride, rocking nose-up, nose-down (the pitch is added at placing, too quick to ease)
    G.boundA = (G.boundA ?? 0) + ((G.speed > 1 ? pose.bound : 0) - (G.boundA ?? 0)) * Math.min(1, dt * 5);
    G.bpitch = G.boundA * 0.1 * Math.cos(G.ph);
    G.y = ground(G.x, G.z) + G.amp * 0.036 * (0.5 + 0.5 * Math.sin(2 * G.ph + 1)) + G.boundA * 0.055 * Math.abs(Math.sin(G.ph)) + G.hop + G.dip;
    tickCard(dt);
    place();
  }

  // it starts at home, facing the view (the grid is built on the first update,
  // once every builder has placed its colliders; the pup then snaps to free ground)
  G.yaw = Math.atan2(VIEW.x - G.x, VIEW.z - G.z);
  place();

  /* dev: state, staged poses for the screenshots, and a headless run */
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    window.__guide = {
      state: () => ({ state: G.state, leg: G.leg, target: G.target?.id ?? null, done: [...G.done], skipped: [...G.skipped], act: G.act?.name ?? null, x: +G.x.toFixed(2), z: +G.z.toFixed(2), yaw: +G.yaw.toFixed(2), speed: +G.speed.toFixed(2), posture: +G.posture.toFixed(2), energy: +G.energy.toFixed(2), gridMs: +W.ms.toFixed(0), cells: W.N, paths: dbg.paths, ready: !!G.field?.ready }),
      walk: W, G, P, A,
      /** Stand the pup in a pose `d` metres in front of a player { pos, yaw } for a frame: `kind` or `kind@d`:
       *  trot | look | sit | tilt | nap | hop | stand | side | behind | bow | roll | lie | zoom | chase | tail */
      stage(spec, player, d = 1.6) {
        const [kind, dd] = String(spec).split('@');
        if (dd) d = +dd;
        const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
        const px = player.pos.x + fx * d, pz = player.pos.z + fz * d;
        const c = W.nearest(px, pz, 2);
        const q = c >= 0 ? W.at(c) : { x: px, z: pz };
        Object.assign(G, { x: q.x, z: q.z, speed: 0, amp: 0, ph: 0, look: 0, nod: 0.1, tilt: 0, wag: 0, posture: 0, perk: 1, hop: 0, roll: 0, pitch: 0, dip: 0, state: 'staged', act: null });
        const toCam = Math.atan2(player.pos.x - q.x, player.pos.z - q.z);
        if (kind === 'trot') Object.assign(G, { yaw: toCam + 2.1, amp: 1, ph: 1.1, wag: 0.25, nod: 0.12 });
        else if (kind === 'look') Object.assign(G, { yaw: toCam + Math.PI - 0.5, look: -1.25, nod: 0.05, wag: 0.4 });
        else if (kind === 'sit') Object.assign(G, { yaw: toCam + 0.25, posture: 1, nod: -0.1, wag: 0.35, perk: 1.3 });
        else if (kind === 'side') Object.assign(G, { yaw: toCam + Math.PI / 2, amp: 1, ph: 4.2, wag: 0.3, nod: 0.1 });
        else if (kind === 'behind') Object.assign(G, { yaw: toCam + Math.PI, amp: 1, ph: 1.1, wag: -0.3, nod: 0.12, look: 0 });
        else if (kind === 'tilt') Object.assign(G, { yaw: toCam, posture: 1, tilt: 0.4, nod: -0.12, wag: 0.3 });
        else if (kind === 'nap' || kind === 'lie') Object.assign(G, { yaw: toCam + (kind === 'nap' ? 1.9 : 0.5), posture: 2, look: kind === 'nap' ? 0.9 : 0, nod: kind === 'nap' ? 0.2 : -0.05, perk: kind === 'nap' ? 0.35 : 1 });
        else if (kind === 'hop') Object.assign(G, { yaw: toCam + 0.3, hop: 0.12, perk: 0.55, wag: 0.5, nod: -0.15, pitch: 0.3 });
        else if (kind === 'stand') Object.assign(G, { yaw: toCam + 0.6, wag: 0.3 });
        else if (kind === 'bow') Object.assign(G, { yaw: toCam + 0.35, posture: -1, wag: 0.7, perk: 1.3, nod: -0.15 });
        else if (kind === 'roll') Object.assign(G, { yaw: toCam + 1.3, posture: 2, roll: Math.PI + 0.25, amp: 0.7, ph: 2.0, wag: 0.5, perk: 0.5, nod: -0.2, look: 0.5 });
        else if (kind === 'zoom') Object.assign(G, { yaw: toCam + 1.2, amp: 1, ph: 2.6, wag: 0.3, perk: 0.25, roll: 0.18, pitch: 0.04, look: -0.5 });
        else if (kind === 'chase') Object.assign(G, { yaw: toCam, amp: 1, ph: 0.6, wag: 0.4, perk: 0.3, pitch: 0.05, nod: 0.05 });
        else if (kind === 'tail') Object.assign(G, { yaw: toCam + 0.9, amp: 0.9, ph: 3.1, wag: 0.5, perk: 1.3, look: -1.35, nod: 0.25, pitch: 0.08 });
        G.y = ground(G.x, G.z) + G.hop + G.amp * 0.012;
        place();
      },
      /** Step the pup by `dt` with the player at `p` (the headless run drives it). */
      step(dt, p) { update(dt, p); },
      whistle,
      tipsy,
      /** the introduction: 0 not yet, 1 running, 2 done (reset() counts it done; introReset() makes it due again) */
      intro: () => G.intro,
      introReset() { G.intro = 0; },
      introMark() { G.intro = 2; },
      reset() { Object.assign(G, { state: 'home', target: null, field: null, resume: null, speed: 0, posture: 0, moved: 0, shook: null, hopped: null, act: null, roll: 0, pitch: 0, drops: 0, energy: 0.7, leg: 0, resumeK: null, whistleAt: null, lastWhistle: -9, intro: 2, introT: 0, t: 0, gateDone: false }); G.done = new Set(['view']); G.skipped = new Set(); ready.clear(); queue.length = 0; growing = null; prefetch(); P.first = true; const c = W.nearest(HOME.x, HOME.z, 3); const q = c >= 0 ? W.at(c) : HOME; G.x = q.x; G.z = q.z; G.y = ground(G.x, G.z); place(); },
    };
  }
  return { update, herd, G };
}
