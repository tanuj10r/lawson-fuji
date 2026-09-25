import { LAYER } from './decals.js';

/* ------------------------------------------------------------------ *
 * The density budget (SPEC section 3), measured.
 *
 *   atSpot   from a camera spot, what stands within 25 m inside the view:
 *            detailed buildings >= 2, poles >= 1, small props >= 5 (props
 *            and signs), road markings >= 1.  Visibility is the view cone
 *            only -- no occlusion -- so it counts what is in front of you.
 *   bare     town-wide: along every side of every street the kit paved,
 *            the longest run of frontage and of asphalt with nothing on it
 *            (a building front, a prop, a pole, a sign, a marking, a lid).
 *            The budget is about 8 m.
 *
 * Both read the registry the generators fill (ctx.registry) and the kit's
 * decal list, because batching has merged the scene itself away.
 * ------------------------------------------------------------------ */

export const BUDGET = { building: 2, pole: 1, prop: 5, marking: 1, range: 25, bare: 8 };

const PAINT = new Set([LAYER.paint, LAYER.symbol, LAYER.lid]);

/**
 * @param spot  { x, z, yaw } (yaw as the player's: facing (-sin, -cos))
 * @param hfov  horizontal field of view, degrees
 */
export function atSpot(registry, decals, spot, hfov = 70) {
  const fx = -Math.sin(spot.yaw), fz = -Math.cos(spot.yaw);
  const half = (hfov / 2) * (Math.PI / 180);
  const inView = (x, z) => {
    const dx = x - spot.x, dz = z - spot.z;
    const d = Math.hypot(dx, dz);
    if (d > BUDGET.range || d < 0.3) return false;
    return Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d))) <= half;
  };
  const n = { building: 0, pole: 0, prop: 0, marking: 0 };
  /** A building counts if any point round its footprint is in view. */
  const buildingInView = (r) => {
    if (!r.rect) return inView(r.x, r.z);
    const [x0, z0, x1, z1] = r.rect;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      if (inView(x0 + (x1 - x0) * t, z0) || inView(x0 + (x1 - x0) * t, z1)
        || inView(x0, z0 + (z1 - z0) * t) || inView(x1, z0 + (z1 - z0) * t)) return true;
    }
    return false;
  };
  for (const r of registry) {
    if (r.kind === 'building') { if (buildingInView(r)) n.building++; continue; }
    if (!inView(r.x, r.z)) continue;
    if (r.kind === 'pole') n.pole++;
    else n.prop++;                                  // props and signs
  }
  for (const q of decals.quads) if (PAINT.has(q.layer) && inView(q.x, q.z)) n.marking++;
  // indoors (the station concourse) the room is the one building in view:
  // the building count does not apply, everything else does
  const fail = Object.keys(n).filter((k) => !(spot.indoor && k === 'building') && n[k] < BUDGET[k]);
  return { ...n, pass: fail.length === 0, fail };
}

/** Longest bare runs along each street side: frontage and asphalt. */
export function bareStretches(net, lots, registry, decals, specials = []) {
  const worst = { frontage: { len: 0 }, asphalt: { len: 0 } };
  const longestGap = (s0, s1, covered) => {
    // only what lies along this edge counts (the same grid line runs on)
    covered = covered.filter(([a, b]) => b > s0 && a < s1).map(([a, b]) => [Math.max(a, s0), Math.min(b, s1)]);
    covered.sort((a, b) => a[0] - b[0]);
    let at = s0, best = { len: 0, s: s0 };
    for (const [a, b] of covered) {
      if (a > at && a - at > best.len) best = { len: a - at, s: at };
      at = Math.max(at, b);
    }
    if (s1 - at > best.len) best = { len: s1 - at, s: at };
    return best;
  };
  const proj = (e, x, z) => (e.axis === 'x' ? [x, z - e.c] : [z, x - e.c]);

  for (const e of net.edges) {
    if (e.opts.surface === false || e.len < 8) continue;
    const s0 = e.a0, s1 = e.a1;
    for (const side of [-1, 1]) {
      // frontage: building fronts cover their lot span; anything within the
      // strip between the kerb line and 4 m into the lots covers +-1 m
      const cov = [];
      for (const l of lots) if (l.e === e && l.side === side) cov.push([l.s0, l.s1]);
      // a special lot is its own dressing; a quiet zone (hero window, railway) is out of scope
      for (let s = s0; s < s1; s += 0.5) {
        const p = net.at(e, s, side * (e.t + 1));
        if (net.quiet(p.x, p.z) || specials.some((q) => p.x > q.x0 - 3 && p.x < q.x1 + 3 && p.z > q.z0 - 3 && p.z < q.z1 + 3)) cov.push([s - 0.3, s + 0.3]);
      }
      for (const r of registry) {
        const [s, off] = proj(e, r.x, r.z);
        const o = off * side;
        if (o > e.a - 1 && o < e.t + 5) cov.push([s - 1, s + 1]);
      }
      const g = longestGap(s0, s1, cov);
      if (g.len > worst.frontage.len) worst.frontage = { ...g, edge: e.i, side, cls: e.cls, at: net.at(e, g.s + g.len / 2, side * e.t) };
    }
    // asphalt: every decal on it (paint, lids, wear, petals) covers +-1 m
    const cov = [];
    for (const q of decals.quads) {
      const [s, off] = proj(e, q.x, q.z);
      if (Math.abs(off) <= e.a) cov.push([s - 1, s + 1]);
    }
    const g = longestGap(s0, s1, cov);
    if (g.len > worst.asphalt.len) worst.asphalt = { ...g, edge: e.i, cls: e.cls, at: net.at(e, g.s + g.len / 2, 0) };
  }
  const round = (w) => ({ ...w, len: +w.len.toFixed(1), at: w.at && { x: +w.at.x.toFixed(1), z: +w.at.z.toFixed(1) } });
  return {
    frontage: round(worst.frontage), asphalt: round(worst.asphalt),
    pass: worst.frontage.len <= BUDGET.bare && worst.asphalt.len <= BUDGET.bare,
  };
}
