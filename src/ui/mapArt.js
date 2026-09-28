import { TOWN, STREET, LAWSON, WORLD, PLACES, HERO_VIEWS, placeAt } from '../config.js';
import { STRINGS } from '../data/strings.js';
import { SPECIALS } from '../world/town-plan.js';
import { planPaddies, RIDGE } from '../world/land/paddies.js';
import { pondShore } from '../world/land/pond.js';
import { rngKit } from '../core/util.js';
import { M, roofStyle } from './map/style.js';
export { drawIcon, drawGem, ICON } from './map/icons.js';

/* ------------------------------------------------------------------ *
 * The town map, painted once (M2f; map 2.0, 2026-09-28).
 *
 * Drawn from the game's own data, so it is always the town you walk: the
 * kit network's roads, the density registry's building footprints (roofed
 * by what the lot holds), the special lots, the railway and platforms, the
 * paddies' real plots and their earth paths (land/paddies.js planPaddies),
 * 鏡池's shore (land/pond.js pondShore), the river's channel, walks, stairs
 * and bridge, and the trees where their crowns stand.  An illustrated map
 * on paper in the game's pastels: soft ink edges, a drop shadow under
 * every roof, the main road ranked above the shopping street above the
 * lanes.  One canvas, painted once at load; the full map and the corner
 * map only copy it.
 *
 * Everything is drawn in world metres (north, -z, up) through one canvas
 * transform; the town's own frame (built turned) goes through frame.toWorld.
 *
 * Returns { canvas, ppm, toPx(x, z), places, bounds, paintMs }.
 * ------------------------------------------------------------------ */

const PPM = 7;                 // pixels per metre
const PAD = 14;                // metres of margin round the world bounds
export const JP = `'NF Round', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', Meiryo, sans-serif`;

export function paintMap(world) {
  const t0 = performance.now();
  const B = WORLD.bounds;
  const x0 = B.x0 - PAD, x1 = B.x1 + PAD, z0 = B.z0 - PAD, z1 = B.z1 + PAD;
  const W = Math.round((x1 - x0) * PPM), H = Math.round((z1 - z0) * PPM);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const F = world.frame;
  const toPx = (x, z) => [(x - x0) * PPM, (z - z0) * PPM];
  const r = rngKit(2610);

  /* ---- helpers, all in world metres ---- */
  const tw = (x, z) => { const p = F.toWorld({ x, z }); return [p.x, p.z]; };
  /** A town-frame rect [x0, z0, x1, z1] as a world one. */
  const trect = (q) => { const [ax, az] = tw(q[0], q[1]), [bx, bz] = tw(q[2], q[3]); return [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)]; };
  const box = (q, fill, rad = 0) => {
    c.fillStyle = fill;
    if (rad) { c.beginPath(); c.roundRect(q[0], q[1], q[2] - q[0], q[3] - q[1], rad); c.fill(); } else c.fillRect(q[0], q[1], q[2] - q[0], q[3] - q[1]);
  };
  const edge = (q, stroke, w, rad = 0) => {
    c.strokeStyle = stroke; c.lineWidth = w;
    c.beginPath(); c.roundRect(q[0] + w / 2, q[1] + w / 2, q[2] - q[0] - w, q[3] - q[1] - w, rad); c.stroke();
  };
  const poly = (pts) => { c.beginPath(); pts.forEach(([x, z], i) => (i ? c.lineTo(x, z) : c.moveTo(x, z))); c.closePath(); };
  const line = (ax, az, bx, bz) => { c.beginPath(); c.moveTo(ax, az); c.lineTo(bx, bz); c.stroke(); };
  /** Little grass marks (the map sign for meadow), scattered in a world rect. */
  const tufts = (q, n, col) => {
    c.strokeStyle = col; c.lineWidth = 0.22; c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const x = r.range(q[0] + 1, q[2] - 1), z = r.range(q[1] + 1, q[3] - 1);
      c.moveTo(x - 0.55, z - 0.5); c.lineTo(x - 0.25, z + 0.2); c.lineTo(x, z - 0.7); c.lineTo(x + 0.25, z + 0.2); c.lineTo(x + 0.55, z - 0.5);
    }
    c.stroke(); c.lineCap = 'butt';
  };
  /** Parking bays: rows of white ticks along both long sides of a world rect. */
  const bays = (q, depth = 5, width = 2.5) => {
    c.strokeStyle = M.bayLine; c.lineWidth = 0.18;
    const along = q[2] - q[0] >= q[3] - q[1];
    if (along) {
      for (let x = q[0] + 1.5; x <= q[2] - 1.5; x += width) { line(x, q[1] + 0.5, x, q[1] + depth); line(x, q[3] - depth, x, q[3] - 0.5); }
    } else {
      for (let z = q[1] + 1.5; z <= q[3] - 1.5; z += width) { line(q[0] + 0.5, z, q[0] + depth, z); line(q[2] - depth, z, q[2] - 0.5, z); }
    }
  };

  /* ---- paper, with a faint, even grain ---- */
  c.fillStyle = M.paper; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    c.fillStyle = i % 3 ? 'rgba(255,255,255,0.22)' : 'rgba(140,124,100,0.07)';
    c.fillRect(r.next() * W, r.next() * H, 1.5, 1.5);
  }
  c.setTransform(PPM, 0, 0, PPM, -x0 * PPM, -z0 * PPM);

  const L = TOWN.land;
  /* ---- beyond the river: the far verge, the tree line, and the Deer Park's meadow ---- */
  {
    const far = trect(L.far);
    const g = c.createLinearGradient(0, far[3], 0, z1);
    g.addColorStop(0, M.meadow); g.addColorStop(1, M.meadowFade);
    c.fillStyle = g; c.fillRect(far[0], far[1], far[2] - far[0], z1 - far[1]);
    tufts([far[0], far[3] + 2, far[2], z1 - 2], 70, M.tuft);
  }

  /* ---- the town's ground: every lot a pale garden or yard, the core's edge a hairline ---- */
  {
    const core = trect([TOWN.core.x0, TOWN.core.z0, TOWN.core.x1, TOWN.core.z1]);
    box(core, M.ground);
  }
  const lots = world.core?.lots ?? [];
  const built = world.core?.built ?? [];
  for (const lot of lots) box(trect(lot.rect), lot.kind === 'shop' ? M.yard : M.garden);

  /* ---- the special lots ---- */
  const spec = (k) => SPECIALS.find((s) => s.kind === k);
  const sRect = (s) => trect([s.x0, s.z0, s.x1, s.z1]);
  if (spec('park')) {
    const q = sRect(spec('park'));
    box(q, M.park, 0.8); edge(q, M.parkEdge, 0.25, 0.8);
    // the sandpit and a path round
    const cx = (q[0] + q[2]) / 2, cz = (q[1] + q[3]) / 2;
    c.fillStyle = M.sand; c.beginPath(); c.ellipse(cx + 3, cz + 2, 2.4, 1.8, 0, 0, Math.PI * 2); c.fill();
  }
  if (spec('vacant')) { const q = sRect(spec('vacant')); box(q, M.vacant); tufts(q, 16, M.tuftDry); }
  if (spec('shrine')) {
    const q = sRect(spec('shrine'));
    box(q, M.gravel, 0.6);
    // the approach (参道): a stone path from the lane to the halls, under the torii
    const s = spec('shrine');
    const [ax, az] = tw((s.x0 + s.x1) / 2, s.z0), [bx, bz] = tw((s.x0 + s.x1) / 2, s.z1 - 6);
    c.strokeStyle = M.sando; c.lineWidth = 1.6; line(ax, az, bx, bz);
    c.strokeStyle = M.torii; c.lineWidth = 0.35;
    for (let t = 0.12; t < 0.8; t += 0.07) { const z = az + (bz - az) * t; line(ax - 1.2, z, ax + 1.2, z); }
  }
  if (spec('plaza')) {
    const q = sRect(spec('plaza'));
    box(q, M.plaza);
    c.strokeStyle = M.plazaGrid; c.lineWidth = 0.08;
    for (let x = Math.ceil(q[0] / 3) * 3; x < q[2]; x += 3) line(x, q[1], x, q[3]);
    for (let z = Math.ceil(q[1] / 3) * 3; z < q[3]; z += 3) line(q[0], z, q[2], z);
  }
  if (spec('coinParking')) { const q = sRect(spec('coinParking')); box(q, M.lot); bays(q); }

  /* ---- the river (桜川): banks, walks, water, stairs, stepping stones, the bridge ---- */
  {
    const X0 = x0 - 2, X1 = x1 + 2;
    const band = (za, zb, fill) => { const q = trect([0, za, 1, zb]); c.fillStyle = fill; c.fillRect(X0, q[1], X1 - X0, q[3] - q[1]); return q; };
    band(L.farTop.z0, L.farTop.z1, M.walk);
    band(L.top.z0, L.top.z1, M.walk);
    // the stone revetments: hatched as a map draws a bank
    for (const [za, zb, down] of [[L.walks.town[1], L.sunk.z1, -1], [L.sunk.z0, L.walks.far[0], 1]]) {
      const q = band(za, zb, M.revet);
      c.strokeStyle = M.revetHatch; c.lineWidth = 0.14;
      c.beginPath();
      for (let x = X0; x < X1; x += 0.9) {
        const long = (Math.round(x / 0.9) % 2) === 0;
        const top = down < 0 ? q[1] : q[3], d = (q[3] - q[1]) * (long ? 0.85 : 0.5) * (down < 0 ? 1 : -1);
        c.moveTo(x, top); c.lineTo(x, top + d);
      }
      c.stroke();
    }
    const tw1 = band(L.walks.town[0], L.walks.town[1], M.lowWalk);
    const tw2 = band(L.walks.far[0], L.walks.far[1], M.lowWalk);
    // a strip of grass along each lower walk, on the water's side
    c.fillStyle = M.bankGrass;
    c.fillRect(X0, tw1[1], X1 - X0, 1.0); c.fillRect(X0, tw2[3] - 1.0, X1 - X0, 1.0);
    const wq = band(L.river.z0, L.river.z1, M.water);
    const g = c.createLinearGradient(0, wq[1], 0, wq[3]);
    g.addColorStop(0, M.waterDeep); g.addColorStop(0.18, M.water); g.addColorStop(0.82, M.water); g.addColorStop(1, M.waterDeep);
    c.fillStyle = g; c.fillRect(X0, wq[1], X1 - X0, wq[3] - wq[1]);
    c.strokeStyle = M.waterEdge; c.lineWidth = 0.3;
    line(X0, wq[1] + 0.15, X1, wq[1] + 0.15); line(X0, wq[3] - 0.15, X1, wq[3] - 0.15);
    // a few gentle current marks
    c.strokeStyle = M.waterLine; c.lineWidth = 0.22; c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < 46; i++) {
      const x = r.range(X0, X1), z = r.range(wq[1] + 2.2, wq[3] - 2.2), w = r.range(2.2, 4.2);
      c.moveTo(x - w, z); c.quadraticCurveTo(x - w / 2, z - 0.5, x, z); c.quadraticCurveTo(x + w / 2, z + 0.5, x + w, z);
    }
    c.stroke(); c.lineCap = 'butt';
    // the railings along the top walks
    c.strokeStyle = M.rail2; c.lineWidth = 0.14;
    const [, rz1] = tw(0, L.top.z0), [, rz2] = tw(0, L.farTop.z1);
    line(X0, rz1, X1, rz1); line(X0, rz2, X1, rz2);
    // the stone stairs down to the lower walks
    for (const s of L.stairs) {
      const [za, zb] = s.side === 'town' ? [L.walks.town[1], L.top.z0] : [L.farTop.z1, L.walks.far[0]];
      const q = trect([s.x - s.w / 2, za, s.x + s.w / 2, zb]);
      box(q, M.stair);
      c.strokeStyle = M.stairLine; c.lineWidth = 0.08;
      for (let z = q[1] + 0.3; z < q[3]; z += 0.32) line(q[0], z, q[2], z);
      edge(q, M.stairLine, 0.12);
    }
    // 飛び石: the stepping stones across the water
    c.fillStyle = M.stone; c.strokeStyle = M.stoneEdge; c.lineWidth = 0.1;
    const [sx] = tw(L.stones.x, 0);
    for (let z = wq[1] + 0.9, i = 0; z < wq[3] - 0.5; z += 1.35, i++) {
      c.beginPath(); c.ellipse(sx + (i % 2 ? 0.35 : -0.35), z, 0.62, 0.45, 0.3 * (i % 2 ? 1 : -1), 0, Math.PI * 2); c.fill(); c.stroke();
    }
    // the bridge's shadow on the channel (the deck itself is the bridge road, drawn with the roads)
    const bq = trect([L.bridge.x - L.bridge.w / 2, L.bridge.z0, L.bridge.x + L.bridge.w / 2, L.bridge.z1]);
    c.fillStyle = M.shadow; c.fillRect(bq[0] + 0.9, bq[1], bq[2] - bq[0], bq[3] - bq[1]);
  }

  /* ---- the photographers' lot (a car park now) and the bridge road ---- */
  { const q = trect(L.parking); box(q, M.lot); bays(q); edge(q, M.lotEdge, 0.2); }

  /* ---- the paddies (田んぼ): each plot as planned, its earth paths between ---- */
  {
    const plan = planPaddies();
    const pb = trect(L.paddies.box);
    box(pb, M.levee);
    // a plot's outline, in the town's frame: along its south curve, back along its north
    const outline = (p) => {
      const pts = [];
      const n = 8;
      for (let i = 0; i <= n; i++) { const x = p.sw + ((p.se - p.sw) * i) / n; pts.push(tw(x, p.S(x))); }
      for (let i = 0; i <= n; i++) { const x = p.ne + ((p.nw - p.ne) * i) / n; pts.push(tw(x, p.N(x))); }
      return pts;
    };
    for (const p of plan.plots) {
      const pts = outline(p);
      const k = M.plot[p.kind] ?? M.plot.fallow;
      c.save();
      poly(pts); c.fillStyle = k.fill; c.fill(); c.clip();
      let bx0 = Infinity, bz0 = Infinity, bx1 = -Infinity, bz1 = -Infinity;
      for (const [x, z] of pts) { bx0 = Math.min(bx0, x); bz0 = Math.min(bz0, z); bx1 = Math.max(bx1, x); bz1 = Math.max(bz1, z); }
      if (p.kind === 'flood' || p.kind === 'seed') {
        // the sky in the water: a soft light band across it
        const g = c.createLinearGradient(bx0, bz0, bx1, bz1);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,255,255,0.38)'); g.addColorStop(0.6, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(bx0, bz0, bx1 - bx0, bz1 - bz0);
      }
      if (p.kind === 'seed') {
        // rows of new seedlings
        c.fillStyle = k.mark;
        for (let x = bx0 + 0.6; x < bx1; x += 1.1) for (let z = bz0 + 0.5; z < bz1; z += 0.8) c.fillRect(x - 0.12, z - 0.12, 0.24, 0.24);
      } else if (p.kind === 'plough') {
        // furrows
        c.strokeStyle = k.mark; c.lineWidth = 0.18;
        c.beginPath();
        for (let x = bx0 + 0.4; x < bx1; x += 0.75) { c.moveTo(x, bz0); c.lineTo(x, bz1); }
        c.stroke();
      } else if (p.kind === 'renge') {
        // green manure in flower
        for (let i = 0; i < (bx1 - bx0) * (bz1 - bz0) * 0.5; i++) {
          c.fillStyle = i % 3 ? k.mark : M.rengeLeaf;
          c.beginPath(); c.arc(r.range(bx0, bx1), r.range(bz0, bz1), 0.2, 0, Math.PI * 2); c.fill();
        }
      } else if (p.kind === 'fallow') {
        c.restore(); c.save(); poly(pts); c.clip();
        tufts([bx0, bz0, bx1, bz1], 10, M.tuft);
      }
      c.restore();
      poly(pts); c.strokeStyle = k.edge; c.lineWidth = 0.14; c.stroke();
    }
    // the earth paths (畦道): a grass shoulder and a trodden top
    const path = (w, col) => {
      c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      for (const l of plan.lines) {
        if (l.kind === 'curve') {
          for (let i = 0; i <= 16; i++) { const x = l.x0 + ((l.x1 - l.x0) * i) / 16; const [wx, wz] = tw(x, l.f(x)); i ? c.lineTo(wx, wz) : c.moveTo(wx, wz); }
        } else { const [ax, az] = tw(...l.a), [bx, bz] = tw(...l.b); c.moveTo(ax, az); c.lineTo(bx, bz); }
      }
      c.stroke(); c.lineCap = 'butt';
    };
    path(RIDGE.w, M.ridge);
    path(RIDGE.path, M.ridgeTop);
    // the feeder channel (用水路) down the lane side, and the pump shed's apron
    for (const ch of plan.channels) { const q = trect([ch.x0, ch.z0, ch.x1, ch.z1]); box(q, M.waterDeep); edge(q, M.concreteEdge, 0.12); }
    if (plan.apron) box(trect(plan.apron), M.concrete, 0.3);
  }

  /* ---- 鏡池: its grounds, the granite promenade, the water with its lilies ---- */
  {
    const P = L.pond;
    const gq = trect(P.box);
    box(gq, M.lawn, 1.2);
    const shore = pondShore().map((v) => tw(v.x, v.y));
    const n = shore.length;
    let area = 0;
    for (let i = 0; i < n; i++) { const a = shore[i], b = shore[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    const s = area > 0 ? 1 : -1;
    const off = (d) => shore.map((p, i) => {
      const a = shore[(i + n - 1) % n], b = shore[(i + 1) % n];
      const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1;
      return [p[0] + (tz / l) * d * s, p[1] - (tx / l) * d * s];
    });
    // the promenade: the shore stroked wide with round joins, so its outer edge stays smooth
    const pw = Math.min(3.2, P.promenade);
    c.lineJoin = 'round';
    poly(shore); c.strokeStyle = M.promEdge; c.lineWidth = pw * 2 + 0.4; c.stroke();
    poly(shore); c.strokeStyle = M.promenade; c.lineWidth = pw * 2; c.stroke();
    c.lineJoin = 'miter';
    // the water: deeper at the stone lip, light in the middle
    let cx = 0, cz = 0; for (const [x, z] of shore) { cx += x; cz += z; } cx /= n; cz /= n;
    const g = c.createRadialGradient(cx, cz - 3, 2, cx, cz, 22);
    g.addColorStop(0, M.pondLight); g.addColorStop(1, M.pond);
    poly(shore); c.fillStyle = g; c.fill();
    c.save(); poly(shore); c.clip();
    poly(off(-1.1)); c.strokeStyle = M.pondRing; c.lineWidth = 0.25; c.stroke();
    c.restore();
    poly(shore); c.strokeStyle = M.waterEdge; c.lineWidth = 0.35; c.stroke();
  }

  /* ---- the railway: ballast, sleepers, two tracks; the platforms ---- */
  {
    const R = TOWN.rail, S = TOWN.station.platforms;
    const bq = trect([-200, R.z - R.spacing / 2 - 1.7, 200, R.z + R.spacing / 2 + 1.7]);
    bq[0] = x0 - 2; bq[2] = x1 + 2;
    box(bq, M.ballast);
    c.strokeStyle = M.ballastEdge; c.lineWidth = 0.15; line(bq[0], bq[1], bq[2], bq[1]); line(bq[0], bq[3], bq[2], bq[3]);
    for (const tz of [R.z - R.spacing / 2, R.z + R.spacing / 2]) {
      const [, z] = tw(0, tz);
      c.strokeStyle = M.sleeper; c.lineWidth = 0.24;
      c.beginPath();
      for (let x = bq[0]; x < bq[2]; x += 0.65) { c.moveTo(x, z - 1.05); c.lineTo(x, z + 1.05); }
      c.stroke();
      c.strokeStyle = M.railSteel; c.lineWidth = 0.16;
      line(bq[0], z - R.gauge / 2, bq[2], z - R.gauge / 2); line(bq[0], z + R.gauge / 2, bq[2], z + R.gauge / 2);
    }
    for (const q of [
      trect([S.x0, TOWN.station.building.z1, S.x1, TOWN.station.building.z1 + S.depth]),
      trect([S.x0, R.z + R.spacing / 2 + 1.0, S.x1, R.z + R.spacing / 2 + 1.0 + S.depth]),
    ]) {
      box(q, M.platform, 0.3); edge(q, M.platformEdge, 0.14, 0.3);
      // the yellow tactile line along the track edge
      const trackSide = Math.abs(q[1] - tw(0, R.z)[1]) < Math.abs(q[3] - tw(0, R.z)[1]) ? q[1] + 0.6 : q[3] - 0.6;
      c.strokeStyle = M.tactile; c.lineWidth = 0.28; line(q[0] + 0.5, trackSide, q[2] - 0.5, trackSide);
    }
  }

  /* ---- roads: kerbs, pavements, asphalt, ranked main > shopping > lane ---- */
  const net = world.core?.kit?.net ?? world.core?.net;
  const segs = [];
  if (net) {
    for (const e of net.edges) {
      if (e.cls === 'hero') continue;
      const [ax, az] = tw(net.at(e, e.s0, 0).x, net.at(e, e.s0, 0).z), [bx, bz] = tw(net.at(e, e.s1, 0).x, net.at(e, e.s1, 0).z);
      segs.push({ ax, az, bx, bz, a: e.a, t: e.t, cls: e.cls });
    }
  }
  // the bridge road, from the master junction to the gate
  { const [ax, az] = tw(L.track.x, L.track.z0), [bx, bz] = tw(L.track.x, L.track.z1); segs.push({ ax, az, bx, bz, a: L.track.w / 2, t: L.track.w / 2, cls: 'lane' }); }
  // the main road, the width of the town (world frame): its far walk to the lot, its near walk to the forecourt
  const mainA = (STREET.roadZ - STREET.forecourtZ) / 2, mainZ = (STREET.roadZ + STREET.forecourtZ) / 2;
  segs.push({ ax: STREET.roadX0, az: mainZ, bx: STREET.roadX1, bz: mainZ, a: mainA, t: mainA + (STREET.sidewalkZ - STREET.roadZ), cls: 'main' });
  const stroke = (s, w, col, cap = 'square') => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = cap; line(s.ax, s.az, s.bx, s.bz); };
  for (const s of segs) if (s.t > s.a) stroke(s, s.t * 2 + 0.5, M.kerb);
  for (const s of segs) if (s.t > s.a) stroke(s, s.t * 2, M.pavement);
  for (const s of segs) stroke(s, s.a * 2 + 0.45, M.roadCase[s.cls] ?? M.roadCase.lane);
  for (const rank of ['lane', 'shopping', 'main']) for (const s of segs) if (s.cls === rank) stroke(s, s.a * 2, M.roadFill[rank]);
  c.lineCap = 'butt';
  // the main road's centre line
  c.strokeStyle = M.centre; c.lineWidth = 0.18; c.setLineDash([3, 3]);
  line(STREET.roadX0, mainZ, STREET.roadX1, mainZ);
  c.setLineDash([]);

  /* ---- the zebras: their own bars, as on the road ---- */
  const zebra = (ax, az, bx, bz, width) => {
    const len = Math.hypot(bx - ax, bz - az);
    c.save();
    c.translate(ax, az); c.rotate(Math.atan2(bz - az, bx - ax));
    c.fillStyle = M.zebraBack; c.fillRect(0, -width / 2, len, width);
    c.fillStyle = M.zebraBar;
    for (let t = 0.25; t < len - 0.3; t += 0.9) c.fillRect(t, -width / 2 + 0.15, 0.45, width - 0.3);
    c.restore();
  };
  if (net) {
    const cw = TOWN.crosswalk;
    zebra(-cw.x, STREET.forecourtZ, -cw.x, STREET.roadZ, cw.width);
    for (const cr of world.core?.kit?.features?.crossings ?? []) {
      const a = net.at(cr.e, cr.s, -cr.e.a), b = net.at(cr.e, cr.s, cr.e.a);
      zebra(...tw(a.x, a.z), ...tw(b.x, b.z), cr.L);
    }
  }
  // the level crossing: the barriers' black and yellow either side of the tracks
  {
    const R = TOWN.rail;
    const [lx] = tw(R.crossX, 0);
    for (const tz of [R.z - R.spacing / 2 - 2.3, R.z + R.spacing / 2 + 2.3]) {
      const [, z] = tw(0, tz);
      for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? M.gateBlack : M.gateYellow; c.fillRect(lx - 2.4 + i * 0.8, z - 0.25, 0.8, 0.5); }
    }
    // the rails run on across the road's boards
    c.strokeStyle = M.railSteel; c.lineWidth = 0.16;
    for (const tz of [R.z - R.spacing / 2, R.z + R.spacing / 2]) {
      const [, z] = tw(0, tz);
      line(lx - 2.6, z - R.gauge / 2, lx + 2.6, z - R.gauge / 2); line(lx - 2.6, z + R.gauge / 2, lx + 2.6, z + R.gauge / 2);
    }
  }
  // the bridge: its parapets over the channel
  {
    const q = trect([L.bridge.x - L.bridge.w / 2, L.bridge.z0, L.bridge.x + L.bridge.w / 2, L.bridge.z1]);
    c.strokeStyle = M.parapet; c.lineWidth = 0.35;
    line(q[0] + 0.18, q[1], q[0] + 0.18, q[3]); line(q[2] - 0.18, q[1], q[2] - 0.18, q[3]);
  }

  /* ---- the Nippon's forecourt: paving and its painted bays ---- */
  {
    const q = [STREET.x0, 0, STREET.x1, STREET.forecourtZ];
    box(q, M.forecourt);
    c.strokeStyle = M.bayLine; c.lineWidth = 0.14;
    for (let x = STREET.bayFirstX; x <= STREET.bayX1; x += STREET.bayWidth) line(x, STREET.bayZ0, x, STREET.bayZ1);
    for (let x = STREET.bayFirstX - STREET.bayWidth; x >= STREET.bayX0; x -= STREET.bayWidth) line(x, STREET.bayZ0, x, STREET.bayZ1);
  }

  /* ---- buildings: every footprint roofed by what it is ---- */
  const inRect = (x, z, q) => x >= q[0] && x <= q[2] && z >= q[1] && z <= q[3];
  const lawsonW = [-LAWSON.width / 2, -LAWSON.depth, LAWSON.width / 2 + LAWSON.wingWidth, 0];
  const megaT = spec('megastore'), stationB = TOWN.station.building;
  const roofs = [];
  for (const g of world.registry ?? []) {
    if (g.kind !== 'building' || !g.rect) continue;
    const q = trect(g.rect);
    const cx = (q[0] + q[2]) / 2, cz = (q[1] + q[3]) / 2;
    if (inRect(cx, cz, lawsonW)) continue;
    const mx = (g.rect[0] + g.rect[2]) / 2, mz = (g.rect[1] + g.rect[3]) / 2;
    if (megaT && inRect(mx, mz, [megaT.x0, megaT.z0, megaT.x1, megaT.z1])) continue;
    if (inRect(mx, mz, [stationB.x0, stationB.z0, stationB.x1, stationB.z1])) continue;
    const i = lots.findIndex((l) => inRect(mx, mz, l.rect));
    const sp = SPECIALS.find((s) => inRect(mx, mz, [s.x0, s.z0, s.x1, s.z1]));
    let kind = 'house', lot = null;
    if (i >= 0) { lot = lots[i]; kind = lot.kind === 'shop' ? 'shop' : (built[i]?.type ?? 'house'); } else if (sp) kind = sp.kind === 'apartment' ? 'apartment' : sp.kind === 'shrine' ? 'hall' : 'house';
    // the frontage a shop's awning faces, in the world
    let face = null;
    if (lot?.face) { const f = lot.face; face = [-f.x, -f.z]; }
    roofs.push({ q, kind, seed: lot?.seed ?? Math.round(cx * 13 + cz * 7), face });
  }
  // buildings the land builds without a registry entry (the pond's tea house and houses)
  const reg = roofs.map((b) => b.q);
  const pondW = trect(L.pond.box);
  for (const k of world.colliders ?? []) {
    if (k.top < 2.5 || k.x1 - k.x0 < 3 || k.z1 - k.z0 < 3) continue;
    const cx = (k.x0 + k.x1) / 2, cz = (k.z0 + k.z1) / 2;
    if (!inRect(cx, cz, pondW)) continue;
    if (reg.some((q) => inRect(cx, cz, q))) continue;
    roofs.push({ q: [k.x0, k.z0, k.x1, k.z1], kind: 'old', seed: Math.round(cx * 31), face: null });
  }
  if (megaT) roofs.push({ q: sRect(megaT), kind: 'mega', seed: 1, face: [1, 0] });
  roofs.push({ q: trect([stationB.x0, stationB.z0, stationB.x1, stationB.z1]), kind: 'station', seed: 2, face: null });
  roofs.push({ q: lawsonW, kind: 'konbini', seed: 3, face: [0, 1] });
  // shadows first, all together, so no roof's shadow falls on its neighbour's roof
  c.fillStyle = M.shadow;
  for (const b of roofs) { const q = b.q; c.beginPath(); c.roundRect(q[0] + 0.7, q[1] + 0.9, q[2] - q[0], q[3] - q[1], 0.6); c.fill(); }
  for (const b of roofs) roof(c, b);

  /* ---- trees, where their crowns stand: each crown's cushions as dots ---- */
  paintTrees(c, world);

  // the edge of the sheet: a soft warm vignette
  c.setTransform(1, 0, 0, 1, 0, 0);
  const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(150,130,100,0.2)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  /* ---- the places, and where each stands ---- */
  const hv = HERO_VIEWS.morning.play.pos;
  const places = PLACES.map((p) => {
    let w = placeAt(p);
    if (p.id === 'start') w = { x: hv[0], z: hv[2] };
    const label = STRINGS.map.places[p.id] ?? { en: p.id, jp: '' };
    return { ...p, ...label, w };
  });

  return { canvas: cv, ppm: PPM, toPx, places, bounds: { x0, x1, z0, z1 }, paintMs: +(performance.now() - t0).toFixed(1) };
}

/** A roof, drawn by kind: pitched ones light and shade either side of the
 * ridge, flat ones with a parapet line, shops with their awning's colour
 * along the frontage.  `q` is a world rect. */
function roof(c, { q, kind, seed, face }) {
  const S = roofStyle(kind, seed);
  const w = q[2] - q[0], d = q[3] - q[1];
  const rad = Math.min(0.6, w / 6, d / 6);
  c.beginPath(); c.roundRect(q[0], q[1], w, d, rad);
  c.fillStyle = S.fill; c.fill();
  if (S.pitched) {
    // the shaded slope: the half away from the light (south or east)
    c.save(); c.clip();
    c.fillStyle = S.shade;
    if (w >= d) c.fillRect(q[0], q[1] + d / 2, w, d / 2); else c.fillRect(q[0] + w / 2, q[1], w / 2, d);
    c.strokeStyle = S.ridge; c.lineWidth = 0.22;
    c.beginPath();
    if (w >= d) { c.moveTo(q[0] + Math.min(d / 2, w / 3), q[1] + d / 2); c.lineTo(q[2] - Math.min(d / 2, w / 3), q[1] + d / 2); } else { c.moveTo(q[0] + w / 2, q[1] + Math.min(w / 2, d / 3)); c.lineTo(q[0] + w / 2, q[3] - Math.min(w / 2, d / 3)); }
    // the hips
    if (S.hip) {
      const h = w >= d ? Math.min(d / 2, w / 3) : Math.min(w / 2, d / 3);
      if (w >= d) {
        c.moveTo(q[0], q[1]); c.lineTo(q[0] + h, q[1] + d / 2); c.lineTo(q[0], q[3]);
        c.moveTo(q[2], q[1]); c.lineTo(q[2] - h, q[1] + d / 2); c.lineTo(q[2], q[3]);
      } else {
        c.moveTo(q[0], q[1]); c.lineTo(q[0] + w / 2, q[1] + h); c.lineTo(q[2], q[1]);
        c.moveTo(q[0], q[3]); c.lineTo(q[0] + w / 2, q[3] - h); c.lineTo(q[2], q[3]);
      }
    }
    c.stroke();
    c.restore();
  } else {
    // a flat roof's parapet, and what stands on it
    const i = Math.min(0.7, w / 6, d / 6);
    c.strokeStyle = S.ridge; c.lineWidth = 0.14;
    c.beginPath(); c.roundRect(q[0] + i, q[1] + i, w - 2 * i, d - 2 * i, rad * 0.5); c.stroke();
    if (S.stripes) {
      c.strokeStyle = S.shade; c.lineWidth = 0.12; c.beginPath();
      if (w >= d) for (let z = q[1] + 1.6; z < q[3] - 1; z += 1.6) { c.moveTo(q[0] + i + 0.3, z); c.lineTo(q[2] - i - 0.3, z); }
      else for (let x = q[0] + 1.6; x < q[2] - 1; x += 1.6) { c.moveTo(x, q[1] + i + 0.3); c.lineTo(x, q[3] - i - 0.3); }
      c.stroke();
    }
  }
  // the frontage: an awning, a sign band
  if (S.front && face) {
    c.fillStyle = S.front;
    const t = S.frontT ?? 0.9;
    const [fx, fz] = face;
    c.save(); c.beginPath(); c.roundRect(q[0], q[1], w, d, rad); c.clip();
    if (fz > 0.5) c.fillRect(q[0], q[3] - t, w, t);
    else if (fz < -0.5) c.fillRect(q[0], q[1], w, t);
    else if (fx > 0.5) c.fillRect(q[2] - t, q[1], t, d);
    else c.fillRect(q[0], q[1], t, d);
    c.restore();
  }
  c.beginPath(); c.roundRect(q[0], q[1], w, d, rad);
  c.strokeStyle = S.edge; c.lineWidth = 0.2; c.stroke();
}

/** The trees: read where the town's canopies put their cushions (each
 * species' instanced crowns, as built: every tree in view at load), drawn
 * as small clustered dots with a shadow and a lit side. */
function paintTrees(c, world) {
  const root = world.root;
  if (!root) return;
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isInstancedMesh || !o.count) return;
    const nm = o.name || '';
    let sp = null;
    if (/^townSakura(Kept)?(Near|Far)\d$/.test(nm)) sp = 'sakura';
    else if (/^(zelkova|camphor|maple|pine)(Near|Far)\d$/.test(nm)) sp = nm.replace(/(Near|Far)\d$/, '');
    else if (/^mapleRed(Near|Far)\d$/.test(nm)) sp = 'mapleRed';
    else if (/^grove.*(Near|Far)/i.test(nm)) sp = 'grove';
    else if (nm === 'land-pad') sp = 'pad';
    if (!sp) return;
    o.updateWorldMatrix(true, false);
    const W = o.matrixWorld.elements;
    const arr = buckets.get(sp) ?? [];
    const A = o.instanceMatrix.array, ws = Math.hypot(W[0], W[1], W[2]);
    for (let i = 0; i < o.count; i++) {
      const b = i * 16, lx = A[b + 12], ly = A[b + 13], lz = A[b + 14];
      const x = W[0] * lx + W[4] * ly + W[8] * lz + W[12];
      const z = W[2] * lx + W[6] * ly + W[10] * lz + W[14];
      arr.push(x, z, Math.hypot(A[b], A[b + 1], A[b + 2]) * ws);
    }
    buckets.set(sp, arr);
  });
  const draw = (arr, rad, dx, dz, col) => {
    c.fillStyle = col; c.beginPath();
    for (let i = 0; i < arr.length; i += 3) {
      const rr = rad(arr[i + 2]);
      c.moveTo(arr[i] + dx + rr, arr[i + 1] + dz);
      c.arc(arr[i] + dx, arr[i + 1] + dz, rr, 0, Math.PI * 2);
    }
    c.fill();
  };
  // each cushion a circle; together (one path) they merge into a crown's scalloped outline
  const crown = (s) => Math.max(0.7, Math.min(1.7, s * 1.25));
  // shadows under every crown, then each species' crowns, then their lit tops
  for (const [sp, arr] of buckets) if (sp !== 'pad') draw(arr, crown, 0.55, 0.7, M.treeShadow);
  for (const [sp, arr] of buckets) {
    const T = M.tree[sp];
    if (!T) continue;
    if (sp === 'pad') { draw(arr, (s) => Math.max(0.25, Math.min(0.5, s * 0.45)), 0, 0, T.fill); continue; }
    draw(arr, crown, 0, 0, T.fill);
    draw(arr, (s) => crown(s) * 0.62, -0.32, -0.4, T.lit);
  }
}
