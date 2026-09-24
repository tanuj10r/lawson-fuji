/* Every name painted on a sign in the town (SPEC sections 1 and 3).
 *
 * Our own, fictional names: nothing here may be a Sakura Crossing place or
 * shop name.  Shop entries are read by the shared sign textures in
 * core/textures.js (fascia, blade), keyed by `kind`. */

export const STATION = { jp: 'さくら富士', en: 'SAKURA-FUJI' };

/** Destination board on the front of the train. */
export const TRAIN_DEST = { kind: '各停', jp: '河口湖' };

/** Paper lanterns strung down the shopping street. */
export const LANTERN_TEXT = ['富士見', '商店街', '桜まつり', '祭', '奉納'];

/** The shopping street's arch and its name. */
export const SHOTENGAI = { jp: '富士見通り商店街', en: 'FUJIMI-DORI' };

/** Shop fascias: ground `bg`, bar colour `bar`, lettering `fg`, name `t`,
 * strapline `s`, romanisation `en`. */
export const SHOP_SIGNS = {
  soba: { bg: '#f4efe2', bar: 0x2f5540, fg: '#2f5540', t: 'そば処 ふじみ', s: 'てうち ・ ざる かけ', en: 'FUJIMI' },
  books: { bg: '#eae3d0', bar: 0x6b585c, fg: '#5b4335', t: '月見堂書店', s: 'ほん ・ ざっし', en: 'TSUKIMIDO' },
  bakery: { bg: '#fdf1dc', bar: 0xd8a03c, fg: '#8a5a20', t: 'パン工房 こむぎ', s: 'やきたて まいあさ', en: 'KOMUGI' },
  florist: { bg: '#f2f7ee', bar: 0x3f7f60, fg: '#37684b', t: '花屋 はなもり', s: 'きりばな はちうえ', en: 'HANAMORI' },
  greengrocer: { bg: '#fdf6e4', bar: 0xef8a3c, fg: '#a3531c', t: '八百屋 まるやま', s: 'やさい くだもの', en: 'MARUYAMA' },
  cafe: { bg: '#f6f1ea', bar: 0x6b4430, fg: '#6b4430', t: '喫茶 あさぎり', s: 'コーヒー ・ ナポリタン', en: 'ASAGIRI' },
  hardware: { bg: '#eef2f5', bar: 0x3d6ec4, fg: '#2a4f97', t: '金物 やまだ', s: 'だいどころ ・ どうぐ', en: 'YAMADA' },
};

/** The barricades where the main road leaves town. */
export const ROAD_CLOSED = '通行止め';
