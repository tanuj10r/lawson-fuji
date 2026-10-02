import { makeStock, footprint } from './products.js';
import { tagAtlas, labelAtlas } from './labels.js';
import { CATALOG, GROUP, PRODUCT, FEATURED } from '../../data/catalog.js';
import { seenFor, storeWhole } from './seen.js';

/* ------------------------------------------------------------------ *
 * The planogram (M3b; M3b.2 from how real konbini stock; M3d: a real
 * range, and never more than 18 of anything).
 *
 *   cooler      each door one category (DOOR_SIGNS), six gravity shelves,
 *               the tall bottles low and the cans high; each product a
 *               block of facings with a row behind
 *   chilled     grouped by type in sections along the case (CHILLED_SECTIONS)
 *   gondolas    one category a side (AISLES): bread | instant food,
 *               savoury snacks | chocolate and sweets, medicine |
 *               cosmetics and care, daily goods | wine, sake and otsumami;
 *               the end caps promote their own aisle
 *   ice         the open flat case, a kind per wire basket; the upright
 *               freezer the rest of the ice and the frozen food
 *
 * Every shelf is filled from its section's list in catalogue order, so
 * families stand together.  A product gets a block of a few facings, a row
 * behind where the shelf is deep enough, and at most a second block later;
 * its units in the whole store never pass CAP.  A tag under every block.
 * ------------------------------------------------------------------ */

export const CAP = 18;

export const DOOR_SIGNS = [
  ['お水・炭酸水', 'Water', '#3a8ad0', 'water'], ['お茶', 'Tea', '#3a8a4a', 'tea'], ['スポーツ', 'Sports & energy', '#1e5ab8', 'sports'],
  ['炭酸', 'Soda', '#d8342f', 'soda'], ['コーヒー・紅茶', 'Coffee & tea', '#6a3a22', 'coffee'], ['乳飲料・果汁', 'Milk & juice', '#5a8ac8', 'milk'],
  ['ビール', 'Beer', '#b8862a', 'beer'], ['チューハイ', 'Chu-hi & highball', '#8a4aa8', 'chuhi'],
];

/* The chilled case's sections, front (by the door) to back. */
export const CHILLED_SECTIONS = [
  { jp: 'おにぎり', en: 'Onigiri', col: '#3a8a4a', z0: -4.0, z1: -5.8, groups: ['onigiri'] },
  { jp: 'サンドイッチ', en: 'Sandwiches', col: '#e8a018', z0: -5.9, z1: -7.0, groups: ['sando'] },
  { jp: 'お弁当・麺', en: 'Bento & noodles', col: '#c8342f', z0: -7.1, z1: -8.6, groups: ['bento', 'noodle'] },
  { jp: 'サラダ', en: 'Salads', col: '#5aa870', z0: -8.7, z1: -9.5, groups: ['salad'] },
  { jp: 'スイーツ', en: 'Sweets', col: '#e8456a', z0: -9.6, z1: -10.8, groups: ['dessert'] },
  { jp: '乳製品', en: 'Dairy', col: '#3a8ad0', z0: -10.9, z1: -11.55, groups: ['dairy'] },
];

/* Each gondola's two sides: -1 faces the chilled case, +1 the window. */
export const AISLES = [
  { [-1]: ['bread', 'パン', 'Bread', '#d8a060'], [1]: ['instant', 'カップ麺・食品', 'Instant food', '#e8453f'] },
  { [-1]: ['snacks', 'スナック', 'Snacks', '#e8864a'], [1]: ['sweets', 'チョコ・お菓子', 'Chocolate & sweets', '#8a4a2a'] },
  { [-1]: ['medicine', '医薬品', 'Medicine & health', '#2e8a5a'], [1]: ['cosmetics', 'コスメ', 'Cosmetics & care', '#d86a8a'] },
  { [-1]: ['daily', '日用品', 'Daily goods', '#3a6ec8'], [1]: ['liquor', 'お酒・おつまみ', 'Wine, sake & snacks', '#8a4aa8'] },
];

const TAG_W = 0.1, TAG_H = 0.0375, Q = Math.PI / 2, SLOPE = 0.14;

/* Where the four featured things stand (Tan's konbini): a shelf of their own
 * at a height you reach without stooping, first along their section, so the
 * glow (store/shop.js) marks one clear block.  They stand nowhere else. */
const FEATURE_AT = {
  sando: { zone: 'chilled', section: 'Sandwiches', level: 2, facings: 4 },
  onigiri: { zone: 'chilled', section: 'Onigiri', level: 2, facings: 5 },
  chuhi: { zone: 'drinks', bay: 7, level: 3, facings: 5 },
  ice: { zone: 'icecase', basket: 11 },
};
const FEATURED_IDS = new Set(FEATURED.flatMap((f) => f.ids));

export function stockStore(p, slots, group, lit) {
  const stock = makeStock();
  const tags = tagAtlas();
  const tagQuads = {};                  // (dev, the seen tool: which painted quads are price tags)
  const tag = (id, x, y, z, ry, rx = 0) => { tagQuads[p.quad(tags.pageOf(id), x, y, z, TAG_W, TAG_H, { ry, rx, uv: tags.rect(id) })] = id; };

  /* ---- what has been placed, product by product ---- */
  const used = new Map(), blocks = new Map();
  const left = (id) => CAP - (used.get(id) ?? 0);

  /**
   * A section's list, handed out a block at a time: `next(width, maxH,
   * rowsFor)` gives the next product that fits (a block of `n` facings,
   * `rows` deep) or null.  The first pass gives each product up to `maxF`
   * facings; later passes place what is left of its CAP, once more.
   */
  const fillers = new Map();
  function filler(key, ids, maxF = 6, maxF2 = maxF) {
    if (fillers.has(key)) return fillers.get(key);
    let i = 0, pass = 0;
    const try1 = (id, width, maxH, rowsFor) => {
      const fp = footprint(id), fw = fp.w + 0.01;
      if (fp.h > maxH || fw > width || left(id) <= 0) return null;
      // the first pass gives every product a block before any gets a second
      if (pass === 0 && blocks.get(id)) return null;
      const rows = Math.max(1, Math.min(rowsFor(fp), left(id)));
      const n = Math.min(pass === 0 ? maxF : maxF2, Math.floor(left(id) / rows), Math.floor(width / fw));
      return n < 1 ? null : { id, n, rows, fp, fw };
    };
    const f = {
      /* The next product in order that fits.  One that does not fit here keeps
       * its turn (the cursor moves only past what was placed), and when every
       * product has had a block the section goes round again, so a shelf is
       * filled to its end rather than stopping when the list runs out. */
      next(width, maxH, rowsFor) {
        // on a tall shelf, what only fits there goes up first (bottles, 2 L)
        const order = maxH > 0.3
          ? [...ids.keys()].sort((a, b) => (footprint(ids[b]).h > 0.245) - (footprint(ids[a]).h > 0.245))
          : [...ids.keys()];
        for (let again = 0; again < 3; again++) {
          for (let t = 0; t < order.length; t++) {
            const j = order[(order.indexOf(i % ids.length) + t) % order.length];
            const b = try1(ids[j], width, maxH, rowsFor);
            if (!b) continue;
            used.set(b.id, (used.get(b.id) ?? 0) + b.n * b.rows);
            blocks.set(b.id, (blocks.get(b.id) ?? 0) + 1);
            i = (j + 1) % ids.length;
            return b;
          }
          // nothing fits: once every product has had its block, go round again
          // and give the ones with stock left another, so the shelf fills to its end
          if (pass === 0 && ids.every((id) => blocks.get(id) || left(id) <= 0 || footprint(id).h > maxH)) pass = 1;
          else break;
        }
        return null;
      },
    };
    fillers.set(key, f);
    return f;
  }
  /** Fill a run from..to with blocks from `fill`; `place(id, t, fp, row)` per unit, `tagAt(id, t)` per block. */
  function run(from, to, fill, maxH, rowsFor, place, tagAt) {
    let t = from;
    for (;;) {
      const b = fill.next(to - t, maxH, rowsFor);
      if (!b) break;
      tagAt?.(b.id, t + (b.n * b.fw) / 2);
      for (let k = 0; k < b.n; k++) {
        for (let r = 0; r < b.rows; r++) place(b.id, t + b.fw / 2, b.fp, r, r ? 0 : b.rows);
        t += b.fw;
      }
      t += 0.012;
    }
    return t;
  }
  /** A filler that hands out just the featured `ids`, `facings` wide each, once. */
  const featureFill = (ids, facings) => {
    let i = 0;
    return {
      next(width, maxH, rowsFor) {
        while (i < ids.length) {
          const id = ids[i++], fp = footprint(id), fw = fp.w + 0.01;
          if (fp.h > maxH) continue;
          const rows = Math.max(1, rowsFor(fp));
          const n = Math.min(facings, Math.floor(width / fw), Math.floor(CAP / rows));
          if (n < 1) continue;
          used.set(id, (used.get(id) ?? 0) + n * rows);
          return { id, n, rows, fp, fw };
        }
        return null;
      },
    };
  };
  /** Fill the featured block first when this run is its place; returns where the rest starts. */
  const featureKeyOf = (s, sec) => Object.entries(FEATURE_AT).find(([, f]) => f.zone === s.zone && f.level === s.level
    && (f.section === undefined || f.section === sec?.en) && (f.bay === undefined || f.bay === s.bay))?.[0];
  const featureIds = (key) => FEATURED.find((f) => f.key === key).ids;
  // tall things first on a gondola side (they need the top shelf or the
  // bottom), the rest in catalogue order so families stand together
  const pool = (...groups) => groups.flatMap((g) => GROUP[g] ?? []).filter((id) => !FEATURED_IDS.has(id));

  const coolerDoors = DOOR_SIGNS.map(([, , , cat]) => [...pool(cat)].sort((a, b) => footprint(b).h - footprint(a).h));
  const COOLER_GAP = [0.35, 0.31, 0.29, 0.29, 0.29, 0.39];
  const ice = pool('ice'), iceInCase = ice.slice(0, 11);        // the twelfth basket is the featured ice's

  for (const s of slots) {
    stock.slot = s;
    switch (s.zone) {
      case 'drinks': {
        // one door, one category, big bottles low; a row behind each front unit
        const fill = filler('door' + s.bay, coolerDoors[s.bay], 4, 6);
        const place = (id, x, fp, r, count) => {
          const dz = r * (fp.d + 0.012);
          stock.add(id, x, s.y + dz * Math.tan(SLOPE), s.z - dz, 0, count, SLOPE);
        };
        const tagAt = (id, x) => tag(id, x, s.y - 0.04, s.rail, 0);
        let from = s.x0;
        const key = featureKeyOf(s);
        if (key) {
          stock.feature = key;
          from = run(s.x0, s.x1, featureFill(featureIds(key), FEATURE_AT[key].facings), COOLER_GAP[s.level], () => 2, place, tagAt);
          stock.feature = null;
        }
        run(from, s.x1, fill, COOLER_GAP[s.level], () => 2, place, tagAt);
        break;
      }
      case 'chilled': {
        for (const sec of CHILLED_SECTIONS) {
          const z1 = Math.max(sec.z0, sec.z1), z0 = Math.min(sec.z0, sec.z1);
          const fill = filler('chilled-' + sec.en, pool(...sec.groups), 3);
          const rowsFor = (fp) => Math.max(1, Math.min(2, Math.floor((s.depth - 0.18) / (fp.d + 0.02))));
          const place = (id, z, fp, r, count) => {
            const lean = PRODUCT[id].mesh.shape === 'onigiri' ? -0.22 : 0;   // onigiri lean back on sloped decks
            stock.add(id, s.rail - 0.03 - fp.d / 2 - r * (fp.d + 0.015), s.y, z, Q, count, lean);
          };
          const tagAt = (id, z) => tag(id, s.rail + 0.002, s.y - 0.03, z, Q);
          let from = z0 + 0.02;
          const key = featureKeyOf(s, sec);
          if (key) {
            stock.feature = key;
            from = run(from, z1 - 0.02, featureFill(featureIds(key), FEATURE_AT[key].facings), 0.26, rowsFor, place, tagAt);
            stock.feature = null;
          }
          run(from, z1 - 0.02, fill, 0.26, rowsFor, place, tagAt);
        }
        break;
      }
      case 'gondola': {
        const [cat] = AISLES[s.gi][s.side];
        const ry = s.side > 0 ? Q : -Q;
        const fill = filler('g' + s.gi + s.side, pool(cat), 5, 4);
        /* How deep to stock: a side is 5 shelves of 7.2 m, and CAP units of a
         * product make about a metre of facings per row.  A section with the
         * range to fill it twice over is stocked two deep, as a real gondola
         * is; a shorter section is faced one deep instead, so its shelves
         * still run to the end rather than trailing off empty. */
        const deep = pool(cat).length * CAP * 0.11 >= 2 * 5 * Math.abs(s.z1 - s.z0);
        const depth = 0.27;                       // the shelf board, less its lip
        run(s.z0, s.z1, fill, s.level === 4 ? 0.5 : 0.245, (fp) => (deep ? Math.max(1, Math.min(2, Math.floor(depth / (fp.d + 0.012)))) : 1), (id, z, fp, r, count) =>
          stock.add(id, s.x - s.side * (fp.d / 2 + 0.03 + r * (fp.d + 0.012)), s.y, z, ry, count),
        (id, z) => tag(id, s.x + s.side * 0.012, s.y - 0.03, z, ry));
        break;
      }
      case 'endcap': {
        // the aisle's own promotion: what is left of its two sides
        const cats = [AISLES[s.gi][-1][0], AISLES[s.gi][1][0]];
        const fill = filler('end' + s.gi, pool(...cats), 4);
        run(s.x0, s.x1, fill, s.level === 3 ? 0.5 : 0.3, () => 1, (id, x, fp) => stock.add(id, x, s.y, s.rail - 0.03 - fp.d / 2, 0, 1),
          (id, x) => tag(id, x, s.y - 0.03, s.rail + 0.004, 0));
        break;
      }
      case 'icecase': {
        // a kind per basket, standing in rows (bars and boxes lie flat); a
        // second layer only for what the first could not hold
        // the featured ice has a basket of its own, at the front by the till
        const fkey = Object.entries(FEATURE_AT).find(([, f]) => f.zone === 'icecase' && f.basket === s.basket)?.[0];
        const id = fkey ? featureIds(fkey)[0] : iceInCase[(s.basket - (s.basket > FEATURE_AT.ice.basket ? 1 : 0)) % iceInCase.length];
        stock.feature = fkey ?? null;
        const fp = footprint(id);
        const flat = /icebar|multipack|cone|wafer/.test(PRODUCT[id].mesh.shape);
        const w = fp.w + 0.01, l = (flat ? fp.h : fp.d) + 0.01;
        for (let k = 0; k < 2 && left(id) > 0; k++) {
          for (let x = s.x0 + w / 2; x <= s.x1 - w / 2 && left(id) > 0; x += w) {
            for (let z = s.z0 + l / 2; z <= s.z1 - l / 2 && left(id) > 0; z += l) {
              const y = s.y + k * ((flat ? fp.d : fp.h) + 0.004);
              stock.add(id, x + k * 0.012, y + (flat ? fp.d / 2 : 0), z + (flat ? fp.h / 2 : 0) + k * 0.01, 0, 1, flat ? -Q : 0);
              used.set(id, (used.get(id) ?? 0) + 1);
            }
          }
        }
        stock.feature = null;
        tag(id, s.tagX + s.side * 0.004, s.tagY, (s.z0 + s.z1) / 2, s.side > 0 ? Q : -Q);
        break;
      }
      case 'freezer': {
        const fill = filler('freezer', [...pool('frozen'), ...ice.slice(11)], 4);
        run(s.x0, s.x1, fill, 0.42, () => 2, (id, x, fp, r, count) => stock.add(id, x, s.y, s.z - r * (fp.d + 0.012), 0, count));
        break;
      }
      case 'selfserve': {
        const fill = filler('self', pool('selfserve'), 5);
        run(s.z0 + 0.02, s.z1 - 0.02, fill, 0.4, () => 2, (id, z, fp, r, count) => stock.add(id, s.x + r * 0.1, s.y, z, -Q, count));
        break;
      }
      // the counter's own stock (served, not picked): as before
      case 'hot': {
        const fw = footprint(s.id).w + 0.01;
        for (let z = s.z0 + fw / 2; z <= s.z1 - fw / 2; z += fw) stock.add(s.id, s.x, s.y, z, -Q, 1);
        break;
      }
      case 'coffee': {
        for (let k = 0; k < 3; k++) stock.add('hot_coffee', s.x, s.y + k * 0.012, (s.z0 + s.z1) / 2, -Q, 1);
        break;
      }
      case 'umbrella': {
        for (let k = 0; k < 6; k++) stock.add('umbrella', s.x - 0.12 + (k % 3) * 0.12, s.y, s.z - 0.05 + Math.floor(k / 3) * 0.1, k * 1.1, 1);
        break;
      }
      default: break;
    }
  }
  /* Only what is ever seen is built, and the painted pages are held at the size they are seen at
   * (store/seen.js), if this is the store that was measured: the same counts. */
  const counts = { units: stock.units.length, ...p.counts(), catalog: CATALOG.length };
  const S = seenFor(counts);
  const units = stock.build(group, lit, S, { ids: storeWhole });
  if (S) {
    for (const pg of labelAtlas().pages) pg.levels(pg.want, pg.wantNear ?? 0);
    for (const pg of tags.pages) pg.levels(pg.wantFar, pg.want);
  }
  group.userData.seen = S;
  if (import.meta.env?.DEV) { group.userData.counts = counts; group.userData.tagQuads = tagQuads; }

  // what the shelves hold, for the STOCK check (scripts/shots.mjs; dev only)
  if (import.meta.env?.DEV) {
    const per = new Map();
    const counter = (id) => ['hot', 'coffee', 'umbrella'].includes(PRODUCT[id].group);
    for (const u of units) if (!counter(u.id)) per.set(u.id, (per.get(u.id) ?? 0) + 1);
    const [maxId, max] = [...per].reduce((a, b) => (b[1] > a[1] ? b : a), ['', 0]);
    const shelved = new Set(per.keys());
    group.userData.stockStats = {
      products: per.size, units: [...per.values()].reduce((a, b) => a + b, 0), max, maxId,
      unplaced: Object.keys(PRODUCT).filter((id) => !shelved.has(id) && !counter(id)),
    };
  }
  return units;
}
