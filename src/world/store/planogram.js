import { makeStock, footprint } from './products.js';
import { tagAtlas } from './labels.js';

/* ------------------------------------------------------------------ *
 * The planogram (M3b): which product stands where, and its price tag.
 *
 * A konbini faces every product several times, so every shelf the room
 * recorded (store/interior.js slots) is filled with real products in
 * blocks of facings, a tag on the rail under each block:
 *   chilled case  onigiri on the lowest decks, sandwiches and salad, bento,
 *                 pudding at the top
 *   cooler        the six drinks, in blocks of two, bay by bay
 *   gondolas      snacks / snacks + noodles / noodles + bread / bread +
 *                 daily, with a featured product on each end cap
 *   freezer, hot case, steamer, oden, coffee, the umbrella stand
 * One unit is drawn per facing; the stock behind it is its `count`.
 * ------------------------------------------------------------------ */

const GONDOLA = [
  { [-1]: ['potato_chips', 'choco_sticks', 'gummies', 'choco_mushrooms'], [1]: ['choco_mushrooms', 'potato_chips', 'gummies', 'choco_sticks'] },
  { [-1]: ['gummies', 'potato_chips', 'choco_sticks'], [1]: ['cup_ramen', 'yakisoba'] },
  { [-1]: ['yakisoba', 'cup_ramen'], [1]: ['melon_pan', 'curry_pan'] },
  { [-1]: ['curry_pan', 'melon_pan'], [1]: ['tissues'] },
];
const ENDCAP = ['potato_chips', 'choco_mushrooms', 'cup_ramen', 'melon_pan'];
const CHILLED = [
  ['onigiri_salmon', 'onigiri_tuna', 'onigiri_ume'],
  ['onigiri_tuna', 'onigiri_ume', 'onigiri_salmon'],
  ['sando_egg', 'potato_salad'],
  ['bento_makunouchi', 'bento_karaage'],
  ['pudding', 'sando_egg'],
];
const DRINKS = ['green_tea', 'barley_tea', 'can_coffee', 'milky_soda', 'ramune', 'strawberry_milk'];

const TAG_W = 0.1, TAG_H = 0.0375;
const Q = Math.PI / 2;

export function stockStore(p, slots, group, lit) {
  const stock = makeStock();
  const tags = tagAtlas();
  const tag = (id, x, y, z, ry) => p.quad(tags.tex, x, y, z, TAG_W, TAG_H, { ry, uv: tags.rect(tags.cellOf[id]) });

  /** Fill a run with blocks of facings.  `along(t)` gives the position for
   *  a distance t along the run; `place(id, pos, fp)` adds one unit. */
  const run = (from, to, list, block, offset, place, tagAt) => {
    let t = from, b = 0;
    while (t < to) {
      const id = list[(b + offset) % list.length];
      const fp = footprint(id);
      const fw = fp.w + 0.012;
      if (t + fw > to) break;
      tagAt?.(id, t + Math.min(block, Math.floor((to - t) / fw)) * fw / 2);
      for (let i = 0; i < block && t + fw <= to; i++) { place(id, t + fw / 2, fp); t += fw; }
      t += 0.01; b++;
    }
  };

  for (const s of slots) {
    switch (s.zone) {
      case 'gondola': {
        const list = GONDOLA[s.gi][s.side];
        const ry = s.side > 0 ? Q : -Q;
        run(s.z0, s.z1, list, 3, s.level, (id, z, fp) => stock.add(id, s.x - s.side * (fp.d / 2 + 0.03), s.y, z, ry),
          (id, z) => tag(id, s.x + s.side * 0.012, s.y - 0.03, z, ry));
        break;
      }
      case 'endcap': {
        const id = ENDCAP[s.gi];
        run(s.x0, s.x1, [id], 9, 0, (i, x, fp) => stock.add(i, x, s.y, s.rail - 0.03 - fp.d / 2, 0),
          (i, x) => tag(i, x, s.y - 0.03, s.rail + 0.004, 0));
        break;
      }
      case 'chilled': {
        const list = CHILLED[s.level];
        run(s.z0, s.z1, list, 4, 0, (id, z, fp) => stock.add(id, s.rail - 0.03 - fp.d / 2, s.y, z, Q),
          (id, z) => tag(id, s.rail + 0.002, s.y - 0.03, z, Q));
        break;
      }
      case 'drinks': {
        run(s.x0, s.x1, DRINKS, 2, s.bay + s.level * 2, (id, x) => stock.add(id, x, s.y, s.z, 0),
          (id, x) => tag(id, x, s.y - 0.035, s.rail, 0));
        break;
      }
      case 'frozen': {
        const ids = ['soft_cream', 'kakigori'];
        let k = 0;
        for (let x = s.x0 + 0.06; x < s.x1 - 0.04; x += 0.12) {
          for (let z = s.z0 + 0.06; z < s.z1 - 0.04; z += 0.12) stock.add(ids[k++ % 2], x, s.y, z, 0);
        }
        break;
      }
      case 'hot': {
        run(s.z0, s.z1, [s.id], 20, 0, (id, z) => stock.add(id, s.x, s.y, z, -Q));
        break;
      }
      case 'coffee': {
        for (let k = 0; k < 3; k++) stock.add('hot_coffee', s.x, s.y + k * 0.012, (s.z0 + s.z1) / 2, -Q);
        break;
      }
      case 'umbrella': {
        for (let k = 0; k < 6; k++) stock.add('umbrella', s.x - 0.12 + (k % 3) * 0.12, s.y, s.z - 0.05 + Math.floor(k / 3) * 0.1, k * 1.1);
        break;
      }
      default: break;
    }
  }
  return stock.build(group, lit);
}
