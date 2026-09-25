import { makeNetwork } from './network.js';
import { makeDecals } from './decals.js';
import { buildRoads } from './roads.js';
import { paintMarkings } from './markings.js';
import { buildPoles, lampMaterial } from './poles.js';
import { placeSigns } from './signs.js';

/* ------------------------------------------------------------------ *
 * The town kit (SPEC section 3, M2a).  Give it a road network; it lays
 * the roads, paints them, plants poles and signs, and strings the wires.
 *
 *   const kit = buildKit(ctx, def);
 *   ... build lots, calling kit.serviceDrop(point) for each facade ...
 *   kit.finish();                     // wires and decals
 * ------------------------------------------------------------------ */

export function buildKit(ctx, def) {
  const net = makeNetwork(def);
  const decals = makeDecals();
  const roads = buildRoads(ctx, net, decals);
  const features = paintMarkings(net, decals);
  const poles = buildPoles(ctx, net, decals);
  const signs = placeSigns(ctx, net, features);
  let done = false;
  return {
    net, roads, features, poles: poles.list, signs, decals,
    serviceDrop: poles.serviceDrop,
    lamps: poles.lamps,
    wireRuns: poles.runs,
    standPole: poles.standPole,
    lampPost: poles.lampPost,
    finish() {
      if (done) return;
      done = true;
      poles.finish();
      ctx.add(decals.build('kit-decals'));
    },
    /** Lamps glow from dusk (the look's store sign level stands in for it). */
    setLook(look) {
      const night = look.store.spill > 0.2;
      lampMaterial().color.set(night ? 0xfff0c0 : 0xe8e6ea);
    },
  };
}
