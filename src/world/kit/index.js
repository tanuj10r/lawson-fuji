import { makeNetwork } from './network.js';
import { makeDecals } from './decals.js';
import { buildRoads } from './roads.js';
import { paintMarkings } from './markings.js';
import { buildPoles, lampMaterial } from './poles.js';
import { placeSigns } from './signs.js';
import { makeClutter } from './street/clutter.js';
import { buildWalkSignal } from '../signals.js';

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
  const clutter = makeClutter(ctx);        // street clutter, one instanced mesh per kind
  const poles = buildPoles(ctx, net, decals, clutter);
  const signs = placeSigns(ctx, net, features);
  // a walk signal at each end of every zebra (M4): its green has a sound
  features.crossings.forEach((c, i) => {
    const s = c.s + c.L / 2 + 1.2;
    const ends = [-1, 1].map((side) => net.at(c.e, s, side * (c.e.a + 0.35)));
    // the crossings on one street are nearly in step, as coordinated signals
    // are, so the town is quiet between greens instead of one always calling
    // a crossing over an east-west road is walked north-south: the cuckoo.
    // Over a north-south road (the shopping spine) it is the chick.
    buildWalkSignal(ctx, { ends, offset: c.offset ?? 6 + i * 3, sound: c.e.axis === 'x' ? 'kakko' : 'piyo' });
  });
  let done = false;
  return {
    net, roads, features, poles: poles.list, signs, decals, clutter,
    serviceDrop: poles.serviceDrop,
    lamps: poles.lamps,
    wireRuns: poles.runs,
    standPole: poles.standPole,
    lampPost: poles.lampPost,
    finish() {
      if (done) return;
      done = true;
      poles.finish();
      clutter.finish();
      ctx.add(decals.build('kit-decals'));
    },
    /** Lamps glow from dusk (the look's store sign level stands in for it). */
    setLook(look) {
      const night = look.store.spill > 0.2;
      lampMaterial().color.set(night ? 0xfff0c0 : 0xe8e6ea);
    },
  };
}
