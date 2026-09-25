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
    [-300, -300, 300, C.z0],                 // the main road and everything north of it
    [-300, 150.5, 300, 300],                 // the railway corridor and beyond
  ];
  const inside = (r) => r[0] >= C.x0 && r[2] <= C.x1 && r[1] >= C.z0 && r[3] <= C.z1;
  // the main road only has a south side in the core
  const sides = (e) => (e.cls === 'hero' ? [1] : [-1, 1]);
  const lots = cutLots(net, reserved, { inside, sides });
  ctx.hedges = [];               // the houses queue hedges; dress builds them in one go

  const built = lots.map((lot) => buildLot(ctx, net, kit, lot));
  for (const s of SPECIALS) buildSpecial(ctx, net, kit, s);
  dressStreets(ctx, net, kit, lots, SPECIALS);
  kit.finish();
  buildCoreEdge(ctx);

  return { kit, net, lots, built, specials: SPECIALS };
}

/** Fences and tree lines round the core: the edge is always something you see. */
function buildCoreEdge(ctx) {
  const C = TOWN.core;
  const zTop = 20.5, zEnd = TOWN.bounds.z1 - 2;
  for (const x of [C.x0, C.x1]) {
    ctx.add(makeTimberFence({ x, z: (zTop + zEnd) / 2, y: 0, len: zEnd - zTop, axis: 'z', h: 1.2 }));
    ctx.collide(x - 0.2, zTop, x + 0.2, zEnd, 1.2);
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
