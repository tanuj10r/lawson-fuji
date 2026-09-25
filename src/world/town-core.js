import { TOWN } from '../config.js';
import { buildKit } from './kit/index.js';
import { cutLots } from './kit/lots.js';
import { buildLot } from './kit/buildings.js';
import { buildSpecial } from './kit/specials.js';
import { dressStreets } from './kit/dress.js';
import { planNetwork, SPECIALS } from './town-plan.js';
import { makeTimberFence } from './buildings.js';
import { makeGuardrail } from './props.js';
import { buildGrove } from './trees.js';
import { buildLine } from './line/index.js';
import { FENCE_OFF } from './line/track.js';
import { buildTownSakura } from './kit/sakura.js';
import { makeNight } from './kit/night.js';
import { buildLife } from './kit/life.js';
import { plant, buildGreen, buildWeeds } from './kit/green.js';
import { LAYER } from './kit/decals.js';
import { rngKit } from '../core/util.js';
import { ROADS } from '../config.js';

/* ------------------------------------------------------------------ *
 * The dense core south of the main road (SPEC section 3, M2b).
 *
 *   plan     world/town-plan.js: the grid as a kit network, special lots
 *   kit      roads, markings, poles, wires, signs (M2a)
 *   lots     every street side cut into frontage lots, back to back
 *   build    a shop-house or a house on each lot, by the mixing rules
 *   dress    the scatter that keeps every 8 m of street occupied
 *   edge     fences and tree lines round the core
 * ------------------------------------------------------------------ */

export function buildCore(ctx) {
  const def = planNetwork();
  const kit = buildKit(ctx, def);
  const net = kit.net;
  const C = TOWN.core;

  const reserved = [
    ...SPECIALS.map((s) => [s.x0, s.z0, s.x1, s.z1]),
    [-300, -300, 300, TOWN.frontRow.z0],     // beyond the main road's far-side row (the old town)
    [-300, 154, 300, 300],                   // the railway corridor and beyond
    ...TOWN.lawsonReserve,                   // the Lawson's forecourt and store (the town is built turned)
    TOWN.photoLot,                           // the photographers' lot, where the famous views are taken
  ];
  // the core, and (M2e) the main road's far side: a frontage row of shops
  // and houses facing the store across the road, where the old town's
  // fields left it bare
  const inside = (r) => r[0] >= C.x0 && r[2] <= C.x1
    && ((r[1] >= C.z0 && r[3] <= C.z1) || (r[1] >= TOWN.frontRow.z0 && r[3] <= TOWN.frontRow.z1));
  const sides = () => [-1, 1];
  const lots = cutLots(net, reserved, { inside, sides });
  ctx.hedges = [];               // the houses queue hedges; dress builds them in one go
  ctx.sakura ??= [];             // every town sakura (the old town's too), built in one batch below
  ctx.night = makeNight(ctx);    // window glass and pools of light, after dark
  ctx.cats = [];                 // the dressing's cats, whose tails life.js swishes
  ctx.green ??= {};              // painted trees and potted plants by species (kit/green.js), built in one batch each

  const built = lots.map((lot) => buildLot(ctx, net, kit, lot));
  for (const s of SPECIALS) buildSpecial(ctx, net, kit, s);
  dressStreets(ctx, net, kit, lots, SPECIALS);
  const line = buildLine(ctx, { kit });
  streetTrees(ctx, kit);
  const sakura = buildTownSakura(ctx, ctx.sakura, { decals: kit.decals });
  const green = buildGreen(ctx, { decals: kit.decals });
  buildWeeds(ctx, weedSpots(ctx, net));
  for (const l of kit.lamps) ctx.night.pool(l.x, l.z, 5.0, { strength: 1.2 });
  ctx.night.finish();
  // birds on the wires, sparrows pecking in the open places, the cats
  const at = (kind) => SPECIALS.find((s) => s.kind === kind);
  const mid = (s, y = 0, n = 5) => ({ x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2 + 2, y, n });
  const life = buildLife(ctx, {
    wireRuns: kit.wireRuns, cats: ctx.cats,
    flocks: [mid(at('park'), 0.04), { ...mid(at('plaza'), 0.17, 6), x: at('plaza').x0 + 12 }, mid(at('shrine'), 0.04, 4), mid(at('vacant'), 0.03, 3)],
  });
  // anyone else with marks for the town's decal mesh (the Lawson's lot, M2e)
  ctx.onDecals?.(kit.decals);
  kit.finish();
  buildCoreEdge(ctx);

  return { kit, net, lots, built, specials: SPECIALS, line, sakura, green, night: ctx.night, life };
}

/* Street trees (M2e): zelkova in iron-grated pits along the main road's
 * walk, the town's side.  West of the Lawson only from the coin parking on,
 * and east of it only past 70 m: the golden-hour sun, low in the east,
 * would lay a nearer tree's shadow across the famous views' forecourt. */
function streetTrees(ctx, kit) {
  const r = rngKit(1717);
  const z = TOWN.grid.main + ROADS.hero.asphalt / 2 + 0.9;
  const mouths = TOWN.grid.ns.filter((g) => g.z0 === undefined).map((g) => g.x);
  const poles = (ctx.registry ?? []).filter((e) => e.kind === 'pole');
  const runs = [[48, 116], [-116, -70]];
  for (const [x0, x1] of runs) {
    for (let x = x0; x <= x1; x += 13) {
      if (mouths.some((m) => Math.abs(m - x) < 5)) continue;
      if (x > 40 && x < 60 && Math.abs(x - 50) < 8) continue;          // the bus stop
      if (poles.some((p) => Math.hypot(p.x - x, p.z - z) < 3)) continue;
      plant(ctx, 'zelkova', { x, z, y: ROADS.kerbH, scale: r.range(0.85, 1.05), seed: 4000 + x });
      kit.decals.add('grate', x, z, 1.1, 1.1, { x: 0, z: -1 }, ROADS.kerbH, LAYER.lid);
    }
  }
}

/* Weeds (M2e): tufts at the foot of every lane's walls and gutters, round
 * poles, and a field of them in the vacant lot. */
function weedSpots(ctx, net) {
  const r = rngKit(2929);
  const out = [];
  for (const e of net.edges) {
    if (e.cls === 'hero') continue;
    const off = e.a + (e.spec.walk > 0 ? e.spec.walk + 0.1 : 0.45);
    for (const side of [-1, 1]) {
      for (let s = e.a0 + r.range(0, 3); s < e.a1; s += r.range(1.5, 6)) {
        if (r.next() < 0.45) continue;
        const p = net.at(e, s, side * off);
        if (net.quiet(p.x, p.z)) continue;
        out.push({ x: p.x, z: p.z, y: e.spec.walk > 0 ? ROADS.kerbH : 0 });
        if (r.next() < 0.3) out.push({ x: p.x + r.range(-0.3, 0.3), z: p.z + r.range(-0.3, 0.3), y: e.spec.walk > 0 ? ROADS.kerbH : 0, s: r.range(0.15, 0.3) });
      }
    }
  }
  for (const p of ctx.registry ?? []) {
    if (p.kind === 'pole' && r.next() < 0.6) out.push({ x: p.x + r.range(-0.3, 0.3), z: p.z + r.range(-0.3, 0.3), y: 0, s: r.range(0.2, 0.4) });
  }
  const v = SPECIALS.find((q) => q.kind === 'vacant');
  if (v) for (let i = 0; i < 90; i++) out.push({ x: r.range(v.x0 + 0.5, v.x1 - 0.5), z: r.range(v.z0 + 0.5, v.z1 - 0.5), y: 0.03, s: r.range(0.35, 0.75) });
  return out;
}

/** Fences and tree lines round the core: the edge is always something you see. */
function buildCoreEdge(ctx) {
  const C = TOWN.core;
  const zTop = 20.5, zEnd = TOWN.bounds.z1 - 2;
  // the line leaves town through its own right-of-way (line/track.js closes it)
  const rw = [TOWN.rail.z - FENCE_OFF, TOWN.rail.z + FENCE_OFF];
  for (const x of [C.x0, C.x1]) {
    for (const [a, b] of [[zTop, rw[0]], [rw[1], zEnd]]) {
      ctx.add(makeTimberFence({ x, z: (a + b) / 2, y: 0, len: b - a, axis: 'z', h: 1.2 }));
      ctx.collide(x - 0.2, a, x + 0.2, b, 1.2);
    }
    const spots = [];
    for (let z = zTop + 4, i = 0; z < zEnd; z += 11, i++) {
      spots.push({ x: x + Math.sign(x) * (4 + (i % 3)), z, y: 0, scale: 1.25 + (i % 5) / 8, seed: 4100 + i + (x > 0 ? 50 : 0) });
    }
    buildGrove(ctx, spots, { far: true });
  }
  // along the south, behind the railway: the cutting's own banks close the line
  ctx.add(makeTimberFence({ x: 0, z: zEnd, y: 0, len: C.x1 - C.x0, axis: 'x', h: 1.2 }));
  ctx.collide(C.x0, zEnd - 0.2, C.x1, zEnd + 0.2, 1.2);
  // the lane over the level crossing ends at a guardrail
  ctx.add(makeGuardrail({ x: -80, z: zEnd - 1.5, y: 0, ry: 0, len: 5.6 }));
}
