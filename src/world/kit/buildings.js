import { rngKit } from '../../core/util.js';
import { lotFrame } from './lots.js';
import { buildHouse } from './houses.js';
import { buildShop, TRADE_KEYS } from './shopfronts.js';

/* ------------------------------------------------------------------ *
 * What goes on each lot: the mixing rules (SPEC section 3).
 *
 *   main road, spine   ~70% shop-houses, the rest houses
 *   lanes              ~12% shops, ~50% on a corner, houses otherwise
 *
 * Trades are dealt round-robin from a shuffled deck, so every street gets
 * a spread and no trade repeats next door.  Lots in the golden-hour shadow
 * zone east of the hero window stay at two storeys (see config.js quiet).
 * ------------------------------------------------------------------ */

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

/* The famous views' sightline (M2e.3: the town stands behind the store).
 * From the hero camera (world z 30.4, eye 1.6 m) the Lawson's roofline is
 * about 4.5° up; behind the store, inside the frame, a building must stay
 * under that line or it shows over the roof and cuts into Fuji.  The frame
 * widens with distance (hfov about 41° plus a margin).  Returns the most
 * floors a lot may have, from its rectangle in world coordinates. */
const HERO = { z: 30.4, eye: 1.6, rise: (4.0 - 1.6) / 30.4, spread: 0.4, margin: 4 };
function envelopeFloors(w) {
  const [x0, z0, x1, z1] = w;
  if (z0 > 0) return 3;                                   // south of the glass line: not behind the store
  const zNear = Math.min(z1, 0);                          // the lot's edge nearest the camera
  const half = (HERO.z - zNear) * HERO.spread + HERO.margin;
  if (x1 < -half || x0 > half) return 3;                  // outside the frame
  const h = HERO.eye + (HERO.z - zNear) * HERO.rise;      // sightline height over that edge
  return Math.max(1, Math.min(3, Math.floor((h - 1.3) / 2.72)));
}

export function buildLot(ctx, net, kit, lot) {
  const r = rngKit(lot.seed);
  const F = lotFrame(net, lot);
  const busy = lot.e.cls !== 'lane';
  const shop = busy ? r.chance(0.7) : r.chance(lot.corner ? 0.5 : 0.12);
  const c0 = ctx.toWorld({ x: lot.rect[0], z: lot.rect[1] }), c1 = ctx.toWorld({ x: lot.rect[2], z: lot.rect[3] });
  const maxFloors = envelopeFloors([Math.min(c0.x, c1.x), Math.min(c0.z, c1.z), Math.max(c0.x, c1.x), Math.max(c0.z, c1.z)]);
  lot.kind = shop ? 'shop' : 'house';
  if (shop) return buildShop(ctx, net, kit, lot, F, nextTrade(r), { maxFloors });
  return buildHouse(ctx, net, kit, lot, F, { maxFloors });
}
