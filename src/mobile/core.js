import * as THREE from 'three';
import { TOWN, ROADS, MOBILE } from '../config.js';
import { cel } from '../core/toon.js';
import { buildKit } from '../world/kit/index.js';
import { cutLots, lotFrame } from '../world/kit/lots.js';
import { buildHouse } from '../world/kit/houses.js';
import { buildShop, TRADE_KEYS } from '../world/kit/shopfronts.js';
import { buildSpecial } from '../world/kit/specials.js';
import { dressStreets } from '../world/kit/dress.js';
import { planNetwork, SPECIALS } from '../world/town-plan.js';
import { makeTimberFence } from '../world/buildings.js';
import { makeGuardrail } from '../world/props.js';
import { buildGrove } from '../world/trees.js';
import { buildLine } from '../world/line/index.js';
import { FENCE_OFF } from '../world/line/track.js';
import { buildTownSakura } from '../world/kit/sakura.js';
import { makeNight } from '../world/kit/night.js';
import { buildLife } from '../world/kit/life.js';
import { plant, buildGreen, buildWeeds } from '../world/kit/green.js';
import { LAYER } from '../world/kit/decals.js';
import { rngKit } from '../core/util.js';

/* ------------------------------------------------------------------ *
 * The phone build's town core: world/town-core.js, the same plan, kit,
 * lots and dressing, but for what the pocket edition cuts (marked POCKET;
 * docs/decisions/mobile-lite.md).  Keep it in step with town-core.js.
 *
 *   lots    every lot is cut as on the desktop (the same rectangles, the
 *           same seeds, the same trades dealt), but only those in
 *           MOBILE.pocket.keep are built: round the konbini, what the
 *           famous views and the car park see, the zebra's shops.  The rest are
 *           the town's quiet ground: a kitchen garden (畑) behind a low
 *           block wall, drawn from flat colours (fillLot).
 * ------------------------------------------------------------------ */

/* world/kit/buildings.js, word for word: the famous views' sightline, and the trades dealt round-robin */
const HERO = { z: 30.4, eye: 1.6, rise: (4.0 - 1.6) / 30.4, spread: 0.4, margin: 4 };
function envelopeFloors(w) {
  const [x0, z0, x1, z1] = w;
  if (z0 > 0) return 3;
  const zNear = Math.min(z1, 0);
  const half = (HERO.z - zNear) * HERO.spread + HERO.margin;
  if (x1 < -half || x0 > half) return 3;
  const h = HERO.eye + (HERO.z - zNear) * HERO.rise;
  return Math.max(1, Math.min(3, Math.floor((h - 1.3) / 2.72)));
}
const deck = [];
let dealt = 0;
function nextTrade(r) {
  if (!deck.length) {
    const keys = [...TRADE_KEYS];
    for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; }
    deck.push(...keys);
  }
  return deck[dealt++ % deck.length];
}

/** POCKET: world/kit/buildings.js buildLot, but a lot not kept is dealt its trade (so the kept shops keep theirs) and left as a garden. */
function buildLotPocket(ctx, net, kit, lot, keep) {
  const r = rngKit(lot.seed);
  const F = lotFrame(net, lot);
  const busy = lot.e.cls !== 'lane';
  const shop = busy ? r.chance(0.7) : r.chance(lot.corner ? 0.5 : 0.12);
  const c0 = ctx.toWorld({ x: lot.rect[0], z: lot.rect[1] }), c1 = ctx.toWorld({ x: lot.rect[2], z: lot.rect[3] });
  const maxFloors = envelopeFloors([Math.min(c0.x, c1.x), Math.min(c0.z, c1.z), Math.max(c0.x, c1.x), Math.max(c0.z, c1.z)]);
  lot.kind = shop ? 'shop' : 'house';
  const trade = shop ? nextTrade(r) : null;
  if (!keep) { lot.kind = 'garden'; return fillLot(ctx, lot, F); }
  if (shop) return buildShop(ctx, net, kit, lot, F, trade, { maxFloors });
  return buildHouse(ctx, net, kit, lot, F, { maxFloors });
}

/* ---------------------------------------------------------------- gardens
 * A lot the pocket town leaves unbuilt: a kitchen garden, as the quieter
 * streets of a Fuji Five Lakes town have between the houses.  Tilled earth
 * in ridges with rows of greens, a strip of grass at the front, and a low
 * block wall (ブロック塀) along the street with a gap for the gate.  Flat
 * toon colours only, merged into a few meshes: no texture, a few KB. */
let GM = null;
function gardenMats() {
  GM ??= {
    earth: cel({ color: 0xa88f72, bands: 3, tint: 0x6f5a80 }),
    ridge: cel({ color: 0x9a7f62, bands: 3, tint: 0x66527a }),
    greens: [cel({ color: 0x7fae5e, bands: 3, tint: 0x4f6a80 }), cel({ color: 0x96c06a, bands: 3, tint: 0x55708a }), cel({ color: 0x6a9a58, bands: 3, tint: 0x4a6280 })],
    grass: cel({ color: 0x9cc48f, bands: 3, tint: 0x5b6f8c }),
    block: cel({ color: 0xc9c4bc, bands: 3, tint: 0x6a6388 }),
    cap: cel({ color: 0xb3ada6, bands: 3, tint: 0x655d80 }),
    post: cel({ color: 0x8a7a66, bands: 3, tint: 0x5c5680 }),
  };
  return GM;
}
function fillLot(ctx, lot, F) {
  const m = gardenMats(), r = rngKit(lot.seed + 77);
  const [x0, z0, x1, z1] = lot.rect;
  const parts = new Map();                         // material -> [geometry]
  const put = (mat, w, h, d, u, v, y, ry = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const p = F.at(u, v);
    g.rotateY(F.ry + ry);
    g.translate(p.x, y + h / 2, p.z);
    (parts.get(mat) ?? parts.set(mat, []).get(mat)).push(g);
  };
  const W = Math.abs(F.along.x) > 0.5 ? x1 - x0 : z1 - z0;     // frontage
  const D = Math.abs(F.along.x) > 0.5 ? z1 - z0 : x1 - x0;     // depth
  const grassD = 1.4;
  // the plot: grass at the front, tilled earth behind
  put(m.grass, W - 0.2, 0.03, grassD, 0, grassD / 2 + 0.05, 0);
  put(m.earth, W - 0.2, 0.05, D - grassD - 0.3, 0, grassD + (D - grassD - 0.3) / 2 + 0.05, 0);
  // ridges across the depth, every other one planted
  const rows = Math.max(2, Math.floor((W - 1.2) / 0.9));
  const green = r.pick(m.greens);
  for (let i = 0; i < rows; i++) {
    const u = -W / 2 + 0.6 + (i + 0.5) * ((W - 1.2) / rows);
    const len = D - grassD - 1.2;
    put(m.ridge, 0.5, 0.14, len, u, grassD + 0.6 + len / 2, 0.05);
    if (i % 3 === 2) continue;                      // a row lying fallow
    const n = Math.floor(len / 0.45);
    const g2 = r.chance(0.3) ? r.pick(m.greens) : green;
    for (let k = 0; k < n; k++) {
      const s = r.range(0.22, 0.34);
      put(g2, s, s * r.range(0.8, 1.3), s, u + r.range(-0.05, 0.05), grassD + 0.8 + k * 0.45, 0.19, r.range(0, 1.5));
    }
  }
  // stakes for the climbing beans, now and then
  if (r.chance(0.5)) {
    const u = -W / 2 + 0.6 + 0.5 * ((W - 1.2) / rows);
    for (let k = 0; k < 6; k++) put(m.post, 0.035, 1.3, 0.035, u + (k % 2 ? 0.18 : -0.18), grassD + 1.0 + Math.floor(k / 2) * 0.9, 0.19);
  }
  // the block wall along the street, a gap for the gate
  const gate = r.range(-W / 2 + 1.5, W / 2 - 2.5);
  for (const [a, b] of [[-W / 2 + 0.1, gate], [gate + 1.2, W / 2 - 0.1]]) {
    if (b - a < 0.3) continue;
    put(m.block, b - a, 0.8, 0.12, (a + b) / 2, 0.12, 0);
    put(m.cap, b - a, 0.05, 0.16, (a + b) / 2, 0.12, 0.8);
    const p0 = F.at(a, 0.12), p1 = F.at(b, 0.12);
    ctx.collide(Math.min(p0.x, p1.x) - 0.1, Math.min(p0.z, p1.z) - 0.1, Math.max(p0.x, p1.x) + 0.1, Math.max(p0.z, p1.z) + 0.1, 0.85);
  }
  const group = new THREE.Group();
  group.name = 'pocket-garden';
  for (const [mat, geos] of parts) {
    const g = mergeBoxes(geos);
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = mat === m.block || mat === m.post;
    group.add(mesh);
  }
  ctx.add(group);
  // (a building to the dressing, as the house it stands for was: the kept streets dress the same; a garden again after)
  const entry = { kind: 'building', garden: true, x: (x0 + x1) / 2, z: (z0 + z1) / 2, rect: [x0, z0, x1, z1] };
  ctx.registry?.push(entry);
  return group;
}
function mergeBoxes(geos) {
  let n = 0;
  for (const g of geos) n += g.index.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let k = 0;
  for (const g of geos) {
    const p = g.attributes.position, q = g.attributes.normal, idx = g.index;
    for (let i = 0; i < idx.count; i++, k++) {
      const j = idx.getX(i);
      pos[k * 3] = p.getX(j); pos[k * 3 + 1] = p.getY(j); pos[k * 3 + 2] = p.getZ(j);
      nor[k * 3] = q.getX(j); nor[k * 3 + 1] = q.getY(j); nor[k * 3 + 2] = q.getZ(j);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

export function buildCore(ctx) {
  const def = planNetwork();
  const kit = buildKit(ctx, def);
  const net = kit.net;
  /* POCKET: about half the street clutter (Tan): every other parked bicycle, crate, cone and capsule
   * bank the dressing puts down, except within MOBILE.pocket.clutter.keep of the famous views (their
   * frame is the desktop's) */
  const CL = MOBILE.pocket?.clutter;
  if (kit.clutter && CL) {
    const put = kit.clutter.put, n = {};
    kit.clutter.put = (kind, x, y, z, ry, o) => {
      if (CL.kinds.includes(kind)) {
        const w = ctx.toWorld({ x, z });
        if (Math.hypot(w.x - CL.keep[0], w.z - CL.keep[1]) > CL.keep[2] && (n[kind] = (n[kind] ?? 0) + 1) % 2 === 0) return;
      }
      put(kind, x, y, z, ry, o);
    };
  }
  const C = TOWN.core;
  ctx.onRoad = (x, z, pad = 0.6) => {
    for (const e of net.edges) {
      if (e.opts.surface === false) continue;
      const s = e.axis === 'x' ? x : z, o = e.axis === 'x' ? z : x;
      if (s > e.a0 - pad && s < e.a1 + pad && Math.abs(o - e.c) < e.a + pad) return true;
    }
    for (const n of Object.values(net.nodes)) if (!n.external && n.ax > 0 && Math.abs(x - n.x) < n.ax + pad && Math.abs(z - n.z) < n.az + pad) return true;
    return false;
  };

  const reserved = [
    ...SPECIALS.map((s) => [s.x0, s.z0, s.x1, s.z1]),
    [-300, -300, 300, TOWN.frontRow.z0],
    [-300, 154, 300, 300],
    ...TOWN.lawsonReserve,
    TOWN.photoLot,
    [TOWN.land.track.x - TOWN.land.track.w / 2 - 0.5, TOWN.frontRow.z0 - 2, TOWN.land.track.x + TOWN.land.track.w / 2 + 0.5, TOWN.frontRow.z1],
    TOWN.land.pond.box,
  ];
  const inside = (r) => r[0] >= C.x0 && r[2] <= (r[3] <= C.frontZ ? C.x1 : C.buildX1)
    && ((r[1] >= C.z0 && r[3] <= C.z1) || (r[1] >= TOWN.frontRow.z0 && r[3] <= TOWN.frontRow.z1));
  const sides = () => [-1, 1];
  const lots = cutLots(net, reserved, { inside, sides });
  ctx.hedges = [];
  ctx.sakura ??= [];
  ctx.night ??= makeNight(ctx);
  ctx.cats = [];
  ctx.green ??= {};

  // POCKET: only the lots whose middle lies in MOBILE.pocket.keep (world rects) are built
  const kept = (lot) => {
    const a = ctx.toWorld({ x: (lot.rect[0] + lot.rect[2]) / 2, z: (lot.rect[1] + lot.rect[3]) / 2 });
    if (MOBILE.pocket?.cut?.some(([x, z]) => Math.abs(a.x - x) < 1.5 && Math.abs(a.z - z) < 1.5)) return false;
    return !MOBILE.pocket || MOBILE.pocket.keep.some(([x0, z0, x1, z1]) => a.x >= x0 && a.x <= x1 && a.z >= z0 && a.z <= z1);
  };
  const built = lots.map((lot, i) => {
    const n0 = ctx.root?.children?.length;
    const b = buildLotPocket(ctx, net, kit, lot, kept(lot));
    if (import.meta.env?.DEV && ctx.root) for (let k = n0; k < ctx.root.children.length; k++) ctx.root.children[k].userData.lot = i;
    return b;
  });
  const specials = SPECIALS.filter((s) => !MOBILE.pocket?.cutSpecials?.includes(s.kind));
  for (const s of specials) buildSpecial(ctx, net, kit, s);
  streetTrees(ctx, kit);
  // (the dressing reads every lot, built or a garden, as on the desktop, so the kept streets dress the same)
  dressStreets(ctx, net, kit, lots, SPECIALS);
  if (Array.isArray(ctx.registry)) for (const e of ctx.registry) if (e.garden) e.kind = 'garden';   // (the map roofs buildings only)
  if (Array.isArray(ctx.registry)) for (let i = ctx.registry.length - 1; i >= 0; i--) if (ctx.registry[i].kind === 'tree') ctx.registry.splice(i, 1);
  const line = buildLine(ctx, { kit });
  const sakura = buildTownSakura(ctx, ctx.sakura, { decals: kit.decals });
  const green = buildGreen(ctx, { decals: kit.decals });
  buildWeeds(ctx, weedSpots(ctx, net));
  for (const l of kit.lamps) ctx.night.pool(l.x, l.z, 5.0, { strength: 1.2 });
  ctx.night.finish();
  const at = (kind) => SPECIALS.find((s) => s.kind === kind);
  const mid = (s, y = 0, n = 5) => ({ x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2 + 2, y, n });
  const life = buildLife(ctx, {
    wireRuns: kit.wireRuns, cats: ctx.cats,
    flocks: [mid(at('park'), 0.04), { ...mid(at('plaza'), 0.17, 6), x: at('plaza').x0 + 12 }, mid(at('shrine'), 0.04, 4), mid(at('vacant'), 0.03, 3)],
  });
  ctx.onDecals?.(kit.decals);
  kit.finish();
  buildCoreEdge(ctx);

  return { kit, net, lots, built, specials: SPECIALS, line, sakura, green, night: ctx.night, life };
}

function streetTrees(ctx, kit) {
  const r = rngKit(1717);
  const z = TOWN.grid.main + ROADS.hero.asphalt / 2 + 0.9;
  const mouths = TOWN.grid.ns.filter((g) => g.z0 === undefined).map((g) => g.x);
  const poles = (ctx.registry ?? []).filter((e) => e.kind === 'pole');
  const runs = [[48, 116], [-116, -70]];
  for (const [x0, x1] of runs) {
    for (let x = x0; x <= x1; x += 13) {
      if (mouths.some((m) => Math.abs(m - x) < 5)) continue;
      if (Math.abs(x - 62) < 8) continue;
      if (poles.some((p) => Math.hypot(p.x - x, p.z - z) < 3)) continue;
      plant(ctx, 'zelkova', { x, z, y: ROADS.kerbH, scale: r.range(0.85, 1.05), seed: 4000 + x });
      ctx.registry?.push({ kind: 'tree', x, z });
      kit.decals.add('grate', x, z, 1.1, 1.1, { x: 0, z: -1 }, ROADS.kerbH, LAYER.lid);
    }
  }
}

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
  ctx.add(makeTimberFence({ x: 0, z: zEnd, y: 0, len: C.x1 - C.x0, axis: 'x', h: 1.2 }));
  ctx.collide(C.x0, zEnd - 0.2, C.x1, zEnd + 0.2, 1.2);
  ctx.add(makeGuardrail({ x: -80, z: zEnd - 1.5, y: 0, ry: 0, len: 5.6 }));
  const P = TOWN.land.pond;
  for (const r of TOWN.grid.ew) {
    if (r.x1 >= C.x1 - 6 || P.gates.includes(r.z)) continue;
    const x = r.x1 + 0.6;
    ctx.add(makeGuardrail({ x, z: r.z, y: 0, ry: Math.PI / 2, len: 5.6 }));
    ctx.collide(x - 0.2, r.z - 2.9, x + 0.2, r.z + 2.9, 0.9);
  }
}
