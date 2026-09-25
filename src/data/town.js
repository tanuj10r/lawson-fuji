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
  // M2b: the rest of the town's trades
  ramen: { bg: '#f7efe0', bar: 0xc0392b, fg: '#9a2a1e', t: 'らーめん 雲海', s: 'しょうゆ ・ みそ', en: 'UNKAI' },
  wagashi: { bg: '#f6f0e6', bar: 0x7a4a5a, fg: '#6a3a4a', t: '菓子処 ゆきみ', s: 'だんご ・ さくらもち', en: 'YUKIMI' },
  general: { bg: '#fbf6e8', bar: 0x2f7a4a, fg: '#24603a', t: 'よろず屋 たかね', s: 'たばこ ・ 食料品 ・ 日用品', en: 'TAKANE' },
  barber: { bg: '#f2f6fa', bar: 0x2a5aa8, fg: '#24488a', t: 'ヘアーサロン かざぐるま', s: 'カット ・ 顔そり', en: 'KAZAGURUMA' },
  laundry: { bg: '#f0f6fa', bar: 0x3aa0c8, fg: '#1e6a8a', t: 'コインランドリー しらゆき', s: '24時間 ・ 乾燥機', en: 'SHIRAYUKI' },
  dentist: { bg: '#f4faf6', bar: 0x2e9a78, fg: '#1f6e56', t: 'こだま歯科医院', s: '予約優先 ・ 土曜診療', en: 'KODAMA DENTAL' },
  closed: { bg: '#e6e2d6', bar: 0x8a8274, fg: '#6a645a', t: '洋品店 まつや', s: 'ながらくの ご愛顧を', en: 'MATSUYA' },
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

/* ---- special lots (M2b) ---- */
export const COIN_PARKING = { t: 'ふじみパーク', s: '20分 100円', foot: '最大料金 600円' };
export const SHRINE = { name: '富士見稲荷神社', nobori: '正一位稲荷大明神' };
export const FOR_SALE = { t: '富士見不動産', tel: '0555-23-0770' };
export const PARK_NAME = 'ふじみ ちびっこ広場';

/* ---- the line (M2c) ----
 * West to east.  The termini are real towns (a local line under Fuji
 * would run there); every station in between is ours. */
export const LINE = {
  name: '富士見線',
  stations: [
    { jp: '大月', en: 'OTSUKI', fare: 520 },
    { jp: 'ふじみ台', en: 'FUJIMIDAI', fare: 180 },
    { jp: 'さくら富士', en: 'SAKURA-FUJI', fare: 0 },
    { jp: 'こもれび野', en: 'KOMOREBINO', fare: 160 },
    { jp: '富士山麓', en: 'FUJISANROKU', fare: 230 },
    { jp: '河口湖', en: 'KAWAGUCHIKO', fare: 310 },
  ],
  /** by direction of travel: +x (track 1) runs east to 河口湖 */
  dest: { east: { kind: '各停', jp: '河口湖', en: 'Kawaguchiko' }, west: { kind: '各停', jp: '大月', en: 'Otsuki' } },
};
export const TAXI = '富士見交通';

/* Hand-written and printed notices taped to shop glass (M2e Phase 6). */
export const SHOP_NOTICES = [
  { t: 'アルバイト募集', s: '時給 1,100円〜 詳しくは店内で', paper: '#fffdf4', ink: '#d8342f' },
  { t: '本日のおすすめ', s: '季節の和菓子 あります', paper: '#fdf6e0', ink: '#2e3a6a' },
  { t: '営業時間', s: '10:00〜19:00 水曜定休', paper: '#ffffff', ink: '#222222' },
  { t: '臨時休業のお知らせ', s: '4月12日（金）は お休みします', paper: '#fffef8', ink: '#222222' },
  { t: 'PayPay 使えます', s: 'キャッシュレス対応', paper: '#ffffff', ink: '#d8342f' },
  { t: '桜まつり', s: '4月6日・7日 商店街にて', paper: '#fde8ef', ink: '#b6413a' },
];
export const FOR_RENT = { t: '貸店舗', s: '富士見不動産', tel: '0555-23-0770' };
export const MENU_TAGS = ['ラーメン', '醤油', '味噌', '塩', '餃子', 'チャーハン', '大盛', 'ビール'];
