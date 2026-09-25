import { makeStock, footprint } from './products.js';
import { tagAtlas } from './labels.js';

/* ------------------------------------------------------------------ *
 * The planogram (M3b; rebuilt in M3b.2 from how real konbini stock).
 *
 *   cooler      each door one category, a sign on its header; six gravity
 *               shelves: small cans on top, 500 ml in the middle, 2 L and
 *               6-packs at the bottom; each product a vertical block of
 *               facings, rows receding behind the front unit
 *   chilled     grouped by type in vertical sections along the case, not
 *               by deck: onigiri, sandwiches, bento and noodles, salads,
 *               sweets (fruit sando among them), dairy
 *   gondolas    snacks, noodles, bread, and the alcohol shelf (sake, whisky,
 *               wine, おつまみ) over the daily goods
 *   ice         the open flat case: a kind per wire basket, lying in rows
 *   and the upright freezer, the smoothie freezer, the hot case, coffee
 * Beer and chu-hi are cold in the cooler; sake, whisky and wine are on the
 * shelf, as in a real store.  A tag on the rail under every block.
 * ------------------------------------------------------------------ */

export const DOOR_SIGNS = [
  ['水・お茶', 'Water & tea', '#3a8ad0'], ['お茶', 'Tea', '#3a8a4a'], ['スポーツ', 'Sports', '#1e5ab8'],
  ['炭酸', 'Soda', '#d8342f'], ['コーヒー・紅茶', 'Coffee & tea', '#6a3a22'], ['乳飲料', 'Milk drinks', '#5a8ac8'],
  ['ビール', 'Beer', '#b8862a'], ['チューハイ', 'Chu-hi & highball', '#8a4aa8'],
];
/* Each door's six shelves, bottom to top. */
const DOORS = [
  [['water_2l'], ['tea_2l'], ['water_500'], ['water_500', 'green_tea'], ['green_tea_take', 'green_tea'], ['jasmine', 'oolong']],
  [['tea_2l'], ['barley_tea', 'oolong'], ['green_tea', 'green_tea_take'], ['jasmine', 'barley_tea'], ['oolong', 'green_tea_take'], ['green_tea']],
  [['ion_water_2l'], ['ion_water'], ['ion_water', 'sports_drink'], ['sports_drink'], ['energy'], ['energy', 'ion_water']],
  [['cola', 'cider'], ['cola'], ['cider', 'vitamin_lemon'], ['vitamin_lemon', 'ramune'], ['ramune', 'milky_soda'], ['cola_can']],
  [['pet_coffee'], ['cafe_latte'], ['milk_tea'], ['pet_coffee', 'cafe_latte'], ['can_coffee'], ['can_coffee']],
  [['milk_1l'], ['yogurt_drink', 'strawberry_milk'], ['strawberry_milk'], ['yogurt_drink'], ['milky_soda'], ['milk_tea']],
  [['beer_6pack'], ['beer_gold_500'], ['beer_gold', 'beer_dry'], ['beer_premium', 'beer_dry'], ['beer_gold'], ['beer_premium']],
  [['chuhi_lemon'], ['chuhi_lemon'], ['chuhi_peach', 'chuhi_grape'], ['highball'], ['highball', 'chuhi_lemon'], ['chuhi_peach']],
];

/* The chilled case's sections, front (by the door) to back, with each
 * deck's products bottom to top. */
export const CHILLED_SECTIONS = [
  { jp: 'おにぎり', en: 'Onigiri', col: '#3a8a4a', z0: -4.0, z1: -5.8,
    decks: [['onigiri_salmon', 'onigiri_tuna'], ['onigiri_ume', 'onigiri_salmon'], ['onigiri_tuna', 'onigiri_ume'], ['onigiri_salmon', 'onigiri_tuna', 'onigiri_ume'], ['onigiri_tuna', 'onigiri_salmon']] },
  { jp: 'サンドイッチ', en: 'Sandwiches', col: '#e8a018', z0: -5.9, z1: -7.0,
    decks: [['sando_egg'], ['ham_sando'], ['sando_egg', 'ham_sando'], ['ham_sando'], ['sando_egg']] },
  { jp: 'お弁当・麺', en: 'Bento & noodles', col: '#c8342f', z0: -7.1, z1: -8.6,
    decks: [['bento_makunouchi'], ['bento_karaage'], ['cold_soba'], ['bento_makunouchi', 'bento_karaage'], ['cold_soba']] },
  { jp: 'サラダ', en: 'Salads', col: '#5aa870', z0: -8.7, z1: -9.5,
    decks: [['green_salad'], ['pasta_salad'], ['potato_salad'], ['green_salad'], ['pasta_salad']] },
  { jp: 'スイーツ', en: 'Sweets', col: '#e8456a', z0: -9.6, z1: -10.8,
    decks: [['fruit_sando'], ['roll_cake', 'cream_puff'], ['pudding', 'cheesecake'], ['fruit_sando', 'roll_cake'], ['cream_puff', 'pudding']] },
  { jp: '乳製品', en: 'Dairy', col: '#3a8ad0', z0: -10.9, z1: -11.55,
    decks: [['yogurt'], ['yogurt'], ['pudding'], ['yogurt'], ['yogurt']] },
];

/* Gondola shelves, bottom to top, per run and side. */
const SNACKS = ['potato_chips', 'choco_sticks', 'gummies', 'choco_mushrooms'];
const GONDOLA = [
  { [-1]: [SNACKS, SNACKS, SNACKS, SNACKS, SNACKS], [1]: [SNACKS, SNACKS, SNACKS, SNACKS, SNACKS] },
  { [-1]: [SNACKS, SNACKS, SNACKS, SNACKS, SNACKS], [1]: [['cup_ramen'], ['cup_ramen', 'yakisoba'], ['yakisoba'], ['cup_ramen'], ['yakisoba', 'cup_ramen']] },
  { [-1]: [['yakisoba'], ['cup_ramen'], ['cup_ramen', 'yakisoba'], ['yakisoba'], ['cup_ramen']], [1]: [['curry_pan'], ['melon_pan'], ['melon_pan', 'curry_pan'], ['curry_pan'], ['melon_pan']] },
  { [-1]: [['melon_pan'], ['curry_pan', 'melon_pan'], ['melon_pan'], ['curry_pan'], ['melon_pan']], [1]: [['tissues'], ['tissues', 'otsumami'], ['sake_cup', 'otsumami'], ['whisky', 'sake_cup'], ['wine_red']] },
];
const ENDCAP = ['potato_chips', 'choco_mushrooms', 'cup_ramen', 'otsumami'];
const ICE_BASKETS = ['ice_vanilla', 'ice_choco', 'ice_soda_bar', 'ice_choco_bar', 'ice_mochi', 'soft_cream',
  'ice_choco', 'ice_vanilla', 'kakigori', 'ice_multipack', 'ice_soda_bar', 'ice_mochi'];
const SELF = [['ice_cup'], ['smoothie_green'], ['smoothie_berry'], ['smoothie_mango']];

const TAG_W = 0.1, TAG_H = 0.0375, Q = Math.PI / 2, SLOPE = 0.14;

export function stockStore(p, slots, group, lit) {
  const stock = makeStock();
  const tags = tagAtlas();
  const tag = (id, x, y, z, ry, rx = 0) => p.quad(tags.tex, x, y, z, TAG_W, TAG_H, { ry, rx, uv: tags.rect(tags.cellOf[id]) });

  /** Fill from..to with blocks of `block` facings of each product in `list`
   *  (starting at `offset`), `place(id, t, fp)` per facing, `tagAt(id, t)`
   *  once per block. */
  const run = (from, to, list, block, offset, place, tagAt) => {
    let t = from, b = 0;
    while (t < to) {
      const id = list[(b + offset) % list.length];
      const fp = footprint(id);
      const fw = fp.w + 0.01;
      if (t + fw > to) break;
      const n = Math.max(1, Math.min(block, Math.floor((to - t) / fw)));
      tagAt?.(id, t + (n * fw) / 2);
      for (let i = 0; i < n; i++) { place(id, t + fw / 2, fp); t += fw; }
      t += 0.008; b++;
    }
  };
  /** Split a run evenly among the products listed, each a solid block. */
  const blocks = (from, to, list, place, tagAt) => {
    const w = (to - from) / list.length;
    list.forEach((id, i) => run(from + i * w, from + (i + 1) * w, [id], 99, 0, place, tagAt));
  };

  for (const s of slots) {
    switch (s.zone) {
      case 'drinks': {
        // one door, one category; its shelf's products in solid blocks; the
        // front unit and one behind it, on a shelf that falls toward you
        const list = DOORS[s.bay][s.level];
        blocks(s.x0, s.x1, list, (id, x, fp) => {
          for (let r = 0; r < 2; r++) {
            const dz = r * (fp.d + 0.012);
            stock.add(id, x, s.y + dz * Math.tan(SLOPE), s.z - dz, 0, r ? 0 : undefined, SLOPE);
          }
        }, (id, x) => tag(id, x, s.y - 0.04, s.rail, 0));
        break;
      }
      case 'chilled': {
        for (const sec of CHILLED_SECTIONS) {
          const list = sec.decks[s.level];
          const z1 = Math.max(sec.z0, sec.z1), z0 = Math.min(sec.z0, sec.z1);
          // onigiri stand leaning back on sloped decks, in rows
          const lean = list[0].startsWith('onigiri') ? -0.22 : 0;
          blocks(z0 + 0.02, z1 - 0.02, list, (id, z, fp) => {
            const rows = Math.max(1, Math.min(2, Math.floor((s.depth - 0.18) / (fp.d + 0.02))));
            for (let r = 0; r < rows; r++) stock.add(id, s.rail - 0.03 - fp.d / 2 - r * (fp.d + 0.015), s.y, z, Q, r ? 0 : undefined, lean);
          }, (id, z) => tag(id, s.rail + 0.002, s.y - 0.03, z, Q));
        }
        break;
      }
      case 'gondola': {
        const list = GONDOLA[s.gi][s.side][s.level];
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
      case 'icecase': {
        // a kind per basket, lying in rows (bars and boxes face up), or
        // standing (cups, their lids up)
        const id = ICE_BASKETS[s.basket % ICE_BASKETS.length];
        const fp = footprint(id);
        const flat = /bar|multipack|soft_cream/.test(id);
        const w = fp.w + 0.01, l = (flat ? fp.h : fp.d) + 0.01;
        for (let x = s.x0 + w / 2; x <= s.x1 - w / 2; x += w) {
          for (let z = s.z0 + l / 2; z <= s.z1 - l / 2; z += l) {
            // two layers, as a well-stocked case is piled
            for (let k = 0; k < 2; k++) {
              const y = s.y + k * ((flat ? fp.d : fp.h) + 0.004);
              stock.add(id, x + k * 0.012, y + (flat ? fp.d / 2 : 0), z + (flat ? -fp.h / 2 : 0) + k * 0.01, 0, k ? 0 : undefined, flat ? -Q : 0);
            }
          }
        }
        tag(id, s.tagX + s.side * 0.004, s.tagY, (s.z0 + s.z1) / 2, s.side > 0 ? Q : -Q);
        break;
      }
      case 'freezer': {
        const list = [['ice_bag'], ['ice_multipack'], ['ice_bag'], ['ice_multipack']][s.level];
        blocks(s.x0, s.x1, list, (id, x) => stock.add(id, x, s.y, s.z, 0));
        break;
      }
      case 'selfserve': {
        blocks(s.z0 + 0.02, s.z1 - 0.02, SELF[s.level], (id, z) => {
          for (let r = 0; r < 2; r++) stock.add(id, s.x + r * 0.1, s.y, z, -Q, r ? 0 : undefined);
        });
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
