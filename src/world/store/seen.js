import { SEEN } from './seen-data.js';

/* ------------------------------------------------------------------ *
 * What of the konbini is ever seen (DECISIONS.md, "The konbini, only
 * what is seen").
 *
 * You stand outside, or one of the five visits walks you through: every
 * pose a player can have is known, and scripts/_store-seen.mjs has looked
 * from all of them (src/dev/store-seen.js) and written seen-data.js:
 *   mask          per stock unit, which of its six sides were ever seen
 *                 (bit 0 front +z, 1 back, 2 +x, 3 -x, 4 top, 5 bottom, in
 *                 the product's own frame); 0: the unit never was
 *   quadsUnseen   painted quads (signs, price tags) never seen
 *   solidsUnseen  solid parts (boxes, cylinders) never seen
 *   labelLevel    per product (a digit each, catalogue order), the sharpest
 *                 mipmap of its label ever sampled from beyond `near`
 *                 metres of the glass (0: the painting itself); the label
 *                 pages are made up by it (store/labels.js, store/pages.js)
 *   tagLevel      the same of each product's price tag, from anywhere;
 *   tagFar        and from beyond `near`
 * It was measured on one store: it is used only on the same one (the same
 * count of products, units, quads and parts).  Change the planogram or the
 * room and everything is built whole, as it was, until the tool is run
 * again:  node scripts/_store-seen.mjs
 *
 * Dev: ?storewhole builds it whole whatever the data says (the tool's own
 * page, and for looking round the store from where no player stands).
 * ------------------------------------------------------------------ */

const WHOLE = !!import.meta.env?.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('storewhole');
export const storeWhole = WHOLE;

/** The data, if it was measured on a store with these counts ({ units, quads, solids, catalog }); else null. */
export function seenFor(counts) {
  if (WHOLE || !SEEN) return null;
  for (const k of ['units', 'quads', 'solids', 'catalog']) if (SEEN[k] !== counts[k]) return null;
  return SEEN;
}

/** Unit `i`'s sides ever seen, as six bits (63: all of it). */
export const sidesOf = (S, i) => (S ? S.mask.charCodeAt(i) - 48 : 63);
