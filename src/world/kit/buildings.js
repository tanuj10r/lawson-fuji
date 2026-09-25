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

/* Buildings here would throw golden-hour shadows (sun low in the east) into
 * the famous view: next to the photographers' lot, one storey; further
 * east, two. */
const LOW_ZONE = [4, 17, 28, 44];
const SHADOW_ZONE = [28, 17, 62, 44];
const inZone = (rect, z) => rect[0] < z[2] && rect[2] > z[0] && rect[1] < z[3] && rect[3] > z[1];

export function buildLot(ctx, net, kit, lot) {
  const r = rngKit(lot.seed);
  const F = lotFrame(net, lot);
  const busy = lot.e.cls !== 'lane';
  const shop = busy ? r.chance(0.7) : r.chance(lot.corner ? 0.5 : 0.12);
  const maxFloors = inZone(lot.rect, LOW_ZONE) ? 1 : inZone(lot.rect, SHADOW_ZONE) ? 2 : 3;
  lot.kind = shop ? 'shop' : 'house';
  if (shop) return buildShop(ctx, net, kit, lot, F, nextTrade(r), { maxFloors });
  return buildHouse(ctx, net, kit, lot, F, { maxFloors });
}
