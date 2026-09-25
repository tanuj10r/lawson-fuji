/* ------------------------------------------------------------------ *
 * The store's 30 products (SPEC section 7).  Every name and package is
 * ours and generic (AGENTS.md): nothing copies a real product.
 *
 * Product: { id, nameJa, nameEn, priceYen, zone, mesh, sound, heatable?,
 *            needsChopsticks?, cold?, unitsPerSlot }
 * mesh: { shape, body, band, label? }  -- colours as hex; the builder is
 *       world/store/products.js, the painted label world/store/labels.js.
 * ------------------------------------------------------------------ */

const P = (id, nameJa, nameEn, priceYen, zone, mesh, sound, extra = {}) => ({
  id, nameJa, nameEn, priceYen, zone, mesh, sound, unitsPerSlot: 4, ...extra,
});

export const CATALOG = [
  // chilled
  P('onigiri_salmon', '鮭おにぎり', 'Salmon onigiri', 160, 'chilled', { shape: 'onigiri', body: 0xf6f4ec, band: 0xe87a8a, filling: 0xe8795a }, 'plastic'),
  P('onigiri_tuna', 'ツナマヨおにぎり', 'Tuna-mayo onigiri', 150, 'chilled', { shape: 'onigiri', body: 0xf6f4ec, band: 0x3a78c8, filling: 0xe8dcb0 }, 'plastic'),
  P('onigiri_ume', '梅おにぎり', 'Umeboshi onigiri', 140, 'chilled', { shape: 'onigiri', body: 0xf6f4ec, band: 0xd8342f, filling: 0xc8283a }, 'plastic'),
  P('bento_makunouchi', '幕の内弁当', 'Makunouchi bento', 580, 'chilled', { shape: 'bento', body: 0x2a2a30, band: 0xc8342f }, 'plastic', { heatable: true, needsChopsticks: true, unitsPerSlot: 3 }),
  P('bento_karaage', '唐揚げ弁当', 'Karaage bento', 520, 'chilled', { shape: 'bento', body: 0x2a2a30, band: 0xe8864a }, 'plastic', { heatable: true, needsChopsticks: true, unitsPerSlot: 3 }),
  P('sando_egg', 'たまごサンド', 'Egg sandwich', 280, 'chilled', { shape: 'sandwich', body: 0xf7ecd2, band: 0xf2c23c }, 'plastic'),
  P('potato_salad', 'ポテトサラダ', 'Potato salad', 230, 'chilled', { shape: 'cup', body: 0xf4ecc8, band: 0x6fb86a, r: 0.05, h: 0.06 }, 'plastic'),
  P('pudding', 'なめらかプリン', 'Custard pudding', 200, 'chilled', { shape: 'pudding', body: 0xf2d48a, band: 0x8a4a2a }, 'plastic'),
  // drinks
  P('green_tea', 'やすらぎ緑茶', 'Green tea', 160, 'drinks', { shape: 'pet', body: 0xc8d8a0, band: 0x3a8a4a }, 'bottle', { unitsPerSlot: 6 }),
  P('barley_tea', 'こうばし麦茶', 'Barley tea', 140, 'drinks', { shape: 'pet', body: 0xc8905a, band: 0x8a5a2a }, 'bottle', { unitsPerSlot: 6 }),
  P('can_coffee', 'あさの微糖', 'Canned coffee', 130, 'drinks', { shape: 'can', body: 0x1e3a6a, band: 0xd8b070 }, 'can', { unitsPerSlot: 6 }),
  P('milky_soda', 'ミルキーソーダ', 'Milky soda', 150, 'drinks', { shape: 'pet', body: 0xf2f2f6, band: 0x3a6ec8 }, 'bottle', { unitsPerSlot: 6 }),
  P('ramune', 'ラムネ', 'Ramune', 180, 'drinks', { shape: 'codd', body: 0xa8d8ec, band: 0x3a8ad0 }, 'bottle', { unitsPerSlot: 5 }),
  P('strawberry_milk', 'いちごミルク', 'Strawberry milk', 170, 'drinks', { shape: 'carton', body: 0xf8c8d8, band: 0xe8456a }, 'paper', { unitsPerSlot: 5 }),
  // snacks
  P('potato_chips', 'うすしおポテト', 'Potato chips', 160, 'snacks', { shape: 'bag', body: 0xf2c23c, band: 0xd8342f }, 'soft'),
  P('choco_sticks', 'チョコスティック', 'Choco sticks', 180, 'snacks', { shape: 'slimbox', body: 0xc83a3a, band: 0x5a2a1a }, 'box'),
  P('choco_mushrooms', 'きのこチョコ', 'Choco mushrooms', 230, 'snacks', { shape: 'smallbox', body: 0x5aa870, band: 0x6a3a1a }, 'box'),
  P('gummies', 'くだものグミ', 'Fruit gummies', 140, 'snacks', { shape: 'pouch', body: 0xc070b0, band: 0xf2c23c }, 'soft'),
  // noodles
  P('cup_ramen', 'しょうゆカップ麺', 'Cup ramen', 220, 'noodles', { shape: 'cupnoodle', body: 0xf2f2ea, band: 0xd8342f }, 'paper', { needsChopsticks: true }),
  P('yakisoba', 'ソース焼きそば', 'Yakisoba cup', 240, 'noodles', { shape: 'tray', body: 0xf2f2ea, band: 0x2a2a30 }, 'paper', { needsChopsticks: true }),
  // bread
  P('melon_pan', 'メロンパン', 'Melon pan', 150, 'bread', { shape: 'melonpan', body: 0xf2d890, band: 0x6fb86a }, 'soft'),
  P('curry_pan', 'カレーパン', 'Curry bread', 170, 'bread', { shape: 'currypan', body: 0xd89048, band: 0xe8864a }, 'soft'),
  // frozen
  P('soft_cream', 'ソフトクリーム', 'Soft-serve cone', 240, 'frozen', { shape: 'cone', body: 0xfaf6ee, band: 0x3a8ad0 }, 'plastic', { cold: true }),
  P('kakigori', 'かき氷アイス', 'Shaved-ice cup', 180, 'frozen', { shape: 'cup', body: 0xe8453f, band: 0x3a8ad0, r: 0.045, h: 0.07 }, 'plastic', { cold: true }),
  // daily
  P('umbrella', 'ビニール傘', 'Clear umbrella', 650, 'daily', { shape: 'umbrella', body: 0xe8f2f8, band: 0x2a2a30 }, 'plastic', { unitsPerSlot: 6 }),
  P('tissues', 'ポケットティッシュ', 'Pocket tissues', 100, 'daily', { shape: 'tissue', body: 0xf2f2f6, band: 0x6ab8e8 }, 'soft', { unitsPerSlot: 6 }),
  // hot (ask the clerk, M5)
  P('karaage', 'からあげ（5個）', 'Karaage (5 pc)', 238, 'hot', { shape: 'karaagebox', body: 0xe8453f, band: 0xf2c23c }, 'paper'),
  P('nikuman', '肉まん', 'Nikuman', 180, 'hot', { shape: 'bun', body: 0xfbf7ee, band: 0xd8342f }, 'soft'),
  P('oden', 'おでんセット', 'Oden set', 320, 'hot', { shape: 'odencup', body: 0xf6f2ea, band: 0x8a5a2a }, 'paper', { needsChopsticks: true }),
  // coffee
  P('hot_coffee', 'ホットコーヒー（R）', 'Hot coffee (R)', 120, 'coffee', { shape: 'coffeecup', body: 0xfbf8f2, band: 0x6a3a22 }, 'paper'),
];

export const PRODUCT = Object.fromEntries(CATALOG.map((p) => [p.id, p]));
