import { TOWN, STREET, LAWSON, WORLD, PLACES, placeAt } from '../config.js';
import { SPECIALS } from '../world/town-plan.js';

/* ------------------------------------------------------------------ *
 * The town map, painted once (M2f).
 *
 * Drawn from the game's own data, so it is always the town you walk:
 * the kit network's roads, the density registry's building footprints,
 * the special lots, the railway and platforms, the old town, and the
 * Lawson.  Most of that lives in the town's own frame (built turned,
 * world/ctx.js); `frame.toWorld` puts it in the world.  Flat and painted:
 * a pale paper ground, soft ink edges, the game's palette.
 *
 * Returns { canvas, ppm, toPx(x, z) } -- north (-z) is up.
 * ------------------------------------------------------------------ */

const PPM = 7;                 // pixels per metre
const PAD = 14;                // metres of margin round the world bounds

const C = {
  paper: '#ece6d6', ink: 'rgba(70,62,86,0.55)',
  road: '#8a8698', walk: '#c8c2cc', main: '#7a7690',
  building: '#d8cdbd', buildingEdge: '#a89c8e',
  park: '#b8d4a0', shrine: '#e8b8a8', plaza: '#f0d8dc', parking: '#cfcbd4',
  vacant: '#d8d0a8', station: '#c8d8c4', rail: '#8e8698', platform: '#ddd6d0',
  field: '#d0d8a8', paddy: '#bcd4c8', river: '#8fb8cc', levee: '#a8c890', track: '#d6c8a8', lawson: '#0068b7', forecourt: '#b8b4c0',
};

export function paintMap(world) {
  const B = WORLD.bounds;
  const x0 = B.x0 - PAD, x1 = B.x1 + PAD, z0 = B.z0 - PAD, z1 = B.z1 + PAD;
  const W = Math.round((x1 - x0) * PPM), H = Math.round((z1 - z0) * PPM);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const F = world.frame;
  const toPx = (x, z) => [(x - x0) * PPM, (z - z0) * PPM];
  /** A rectangle given in the town's frame (or the world's, `w` true). */
  const rect = (r, fill, { w = false, edge = null } = {}) => {
    const a = w ? { x: r[0], z: r[1] } : F.toWorld({ x: r[0], z: r[1] });
    const b = w ? { x: r[2], z: r[3] } : F.toWorld({ x: r[2], z: r[3] });
    const [px, pz] = toPx(Math.min(a.x, b.x), Math.min(a.z, b.z));
    const pw = Math.abs(b.x - a.x) * PPM, ph = Math.abs(b.z - a.z) * PPM;
    c.fillStyle = fill; c.fillRect(px, pz, pw, ph);
    if (edge) { c.strokeStyle = edge; c.lineWidth = 1.5; c.strokeRect(px + 0.75, pz + 0.75, pw - 1.5, ph - 1.5); }
  };

  // paper, with a faint grain
  c.fillStyle = C.paper; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 6000; i++) {
    c.fillStyle = i % 2 ? 'rgba(255,255,255,0.25)' : 'rgba(150,140,120,0.08)';
    c.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }

  /* ---- the land north of the road (town pass; turned frame) ---- */
  {
    const L = TOWN.land;
    for (const r of [L.near, L.far, L.east]) rect(r, C.paddy);
    rect([-118, L.levee.z0, 118, L.levee.z1], C.levee);
    rect([-118, L.farBank.z0, 118, L.farBank.z1], C.levee);
    rect([-118, L.river.z0, 118, L.river.z1], C.river);
    rect([L.track.x - L.track.w / 2, L.track.z0, L.track.x + L.track.w / 2, L.track.z1], C.track);
    rect([L.bridge.x - L.bridge.w / 2, L.river.z0, L.bridge.x + L.bridge.w / 2, L.river.z1], C.walk);
  }

  /* ---- the special lots ---- */
  const lotFill = { park: C.park, shrine: C.shrine, plaza: C.plaza, coinParking: C.parking, vacant: C.vacant, station: C.station, apartment: C.building };
  for (const s of SPECIALS) if (lotFill[s.kind]) rect([s.x0, s.z0, s.x1, s.z1], lotFill[s.kind]);

  /* ---- the railway and its platforms ---- */
  {
    const R = TOWN.rail, S = TOWN.station.platforms;
    rect([-200, R.z - R.spacing / 2 - 1.7, 200, R.z + R.spacing / 2 + 1.7], C.rail);
    c.save();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.setLineDash([6, 6]); c.lineWidth = 2;
    for (const tz of [R.z - R.spacing / 2, R.z + R.spacing / 2]) {
      const a = F.toWorld({ x: -200, z: tz }), b = F.toWorld({ x: 200, z: tz });
      c.beginPath(); c.moveTo(...toPx(a.x, a.z)); c.lineTo(...toPx(b.x, b.z)); c.stroke();
    }
    c.restore();
    rect([S.x0, TOWN.station.building.z1, S.x1, TOWN.station.building.z1 + S.depth], C.platform);
    rect([S.x0, R.z + R.spacing / 2 + 1.0, S.x1, R.z + R.spacing / 2 + 1.0 + S.depth], C.platform);
  }

  /* ---- the Lawson's own road, forecourt and store (world frame) ---- */
  rect([STREET.roadX0, STREET.forecourtZ - 1.8, STREET.roadX1, STREET.sidewalkZ], C.walk, { w: true });
  rect([STREET.roadX0, STREET.forecourtZ, STREET.roadX1, STREET.roadZ], C.main, { w: true });
  rect([STREET.x0, 0, STREET.x1, STREET.forecourtZ], C.forecourt, { w: true });

  /* ---- the town's roads (kit network, town frame) ---- */
  const net = world.core?.kit?.net ?? world.core?.net;
  if (net) {
    for (const pass of ['walk', 'road']) {
      for (const e of net.edges) {
        if (e.cls === 'hero') continue;             // the Lawson's road, drawn above
        const half = pass === 'walk' ? e.t : e.a;
        const a = F.toWorld(net.at(e, e.s0, 0)), b = F.toWorld(net.at(e, e.s1, 0));
        c.strokeStyle = pass === 'walk' ? C.walk : (e.cls === 'shopping' ? C.main : C.road);
        c.lineWidth = Math.max(2, half * 2 * PPM);
        c.lineCap = 'square';
        c.beginPath(); c.moveTo(...toPx(a.x, a.z)); c.lineTo(...toPx(b.x, b.z)); c.stroke();
      }
    }
  }

  /* ---- the zebra crossings: their own bars, as on the road ---- */
  const zebra = (ax, az, bx, bz, width) => {
    const [px0, pz0] = toPx(ax, az), [px1, pz1] = toPx(bx, bz);
    const len = Math.hypot(px1 - px0, pz1 - pz0);
    c.save();
    c.translate(px0, pz0);
    c.rotate(Math.atan2(pz1 - pz0, px1 - px0));
    const w = Math.max(3, width * PPM), bar = Math.max(1.6, 0.45 * PPM), gap = bar;
    c.fillStyle = '#3a3448';
    c.fillRect(0, -w / 2, len, w);
    c.fillStyle = '#f4f2ee';
    for (let t = bar / 2; t < len - bar / 2; t += bar + gap) c.fillRect(t, -w / 2, bar, w);
    c.restore();
  };
  // the one on the main road by the store (world frame), then the kit's
  if (net) {
    const cw = TOWN.crosswalk;
    zebra(cw.x, STREET.forecourtZ, cw.x, STREET.roadZ, cw.width);
    for (const cr of world.core?.kit?.features?.crossings ?? []) {
      const a = F.toWorld(net.at(cr.e, cr.s, -cr.e.a)), b = F.toWorld(net.at(cr.e, cr.s, cr.e.a));
      zebra(a.x, a.z, b.x, b.z, cr.L);
    }
  }

  /* ---- buildings (the density registry: footprints) ---- */
  for (const r of world.registry ?? []) {
    if (r.kind !== 'building' || !r.rect) continue;
    rect(r.rect, C.building, { edge: C.buildingEdge });
  }
  // the Lawson on top, in its blue
  rect([-LAWSON.width / 2, -LAWSON.depth, LAWSON.width / 2 + LAWSON.wingWidth, 0], C.lawson, { w: true });

  // a soft ink vignette at the edge of the map
  const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(120,108,90,0.25)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  return {
    canvas: cv, ppm: PPM, toPx,
    places: PLACES.map((p) => ({ ...p, w: placeAt(p) })),
    bounds: { x0, x1, z0, z1 },
  };
}

/* The places' icons: a coloured disc with a glyph, drawn upright. */
export const ICON = {
  konbini: { col: '#0068b7', g: 'L' },
  view: { col: '#e07a3a', g: '富' },
  station: { col: '#2f7a4a', g: '駅' },
  shrine: { col: '#c0392b', g: '⛩' },
  park: { col: '#4f9a4a', g: '園' },
  plaza: { col: '#c2336b', g: '広' },
  shops: { col: '#b45a14', g: '店' },
  home: { col: '#7a6a4a', g: '家' },
  lot: { col: '#8a8a5a', g: '空' },
  crossing: { col: '#6a5a2a', g: '踏' },
  parking: { col: '#3050a0', g: 'P' },
};

const JP = `'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', Meiryo, sans-serif`;
export function drawIcon(c, kind, x, y, r) {
  const I = ICON[kind] ?? ICON.home;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = I.col; c.fill();
  c.lineWidth = Math.max(1.5, r * 0.18); c.strokeStyle = '#fffaf0'; c.stroke();
  c.fillStyle = '#ffffff';
  c.font = `bold ${Math.round(r * 1.15)}px ${JP}`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(I.g, x, y + r * 0.06);
}
export { JP };
