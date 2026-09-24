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

/* ---- town kit (M2a): poles, signs ---- */

/** The town's address: 富士見町 一丁目 ... 四丁目. */
export const AREA = { name: '富士見町', chome: ['一丁目', '二丁目', '三丁目', '四丁目'] };

/** Pole advertisements: fictional clinics, an estate agent, a driving school. */
export const POLE_ADS = [
  { kind: '内科', t: 'ふもと内科', s: 'この先 80m', tel: '0555-21-4410', bar: 0x2a6fb8 },
  { kind: '歯科', t: 'こだま歯科', s: '左折 30m', tel: '0555-22-8148', bar: 0x2e9a78 },
  { kind: '不動産', t: '富士見不動産', s: '賃貸・売買', tel: '0555-23-0770', bar: 0xd0602a },
  { kind: '整骨院', t: 'すずかけ整骨院', s: '駅前通り', tel: '0555-24-5151', bar: 0x7a4fb0 },
  { kind: '眼科', t: 'あおば眼科', s: '右折 50m', tel: '0555-25-1033', bar: 0x2a8ab8 },
  { kind: '教習所', t: '富士見自動車学校', s: '送迎あり', tel: '0555-26-3300', bar: 0xc8342c },
].map((a) => ({ ...a, bar: '#' + a.bar.toString(16).padStart(6, '0') }));

/** Blue direction boards: [left, ahead, right] and the route line. */
export const DIRECTIONS = [
  { to: ['駅', '河口湖', '富士吉田'], route: '富士見通り' },
  { to: ['富士吉田', '駅', '河口湖'], route: '富士見通り' },
];

/** The bus stop in the town. */
export const BUS_STOP = '富士見町';
