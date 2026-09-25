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

  /* ---- M3b.2: a konbini's full range (Tan: the drinks, alcohol, sweets and
   * ice people remember).  Evocations, never copies: each borrows only the
   * colour language of its kind, with its own name and design. ---- */
  // water and tea
  P('water_500', 'ふじの湧水', 'Fuji spring water', 110, 'drinks', { shape: 'pet', body: 0xe8f4fa, band: 0x3a8ad0 }, 'bottle', { unitsPerSlot: 6 }),
  P('water_2l', 'ふじの湧水 2L', 'Fuji spring water 2L', 190, 'drinks', { shape: 'pet2l', body: 0xe8f4fa, band: 0x3a8ad0 }, 'bottle', { unitsPerSlot: 3 }),
  P('green_tea_take', '竹林の緑茶', 'Bamboo green tea', 160, 'drinks', { shape: 'pet', body: 0xb8d088, band: 0x2e6a3a }, 'bottle', { unitsPerSlot: 6 }),
  P('oolong', 'まろやか烏龍茶', 'Oolong tea', 160, 'drinks', { shape: 'pet', body: 0xb07040, band: 0xc8342f }, 'bottle', { unitsPerSlot: 6 }),
  P('jasmine', 'ジャスミン茶', 'Jasmine tea', 160, 'drinks', { shape: 'pet', body: 0xe8d890, band: 0x5aa870 }, 'bottle', { unitsPerSlot: 6 }),
  P('tea_2l', 'やすらぎ緑茶 2L', 'Green tea 2L', 230, 'drinks', { shape: 'pet2l', body: 0xc8d8a0, band: 0x3a8a4a }, 'bottle', { unitsPerSlot: 3 }),
  // sports and energy
  P('ion_water', 'ブルーイオン', 'Blue ion water', 170, 'drinks', { shape: 'pet', body: 0xf2f6fa, band: 0x1e5ab8, wave: true }, 'bottle', { unitsPerSlot: 6 }),
  P('ion_water_2l', 'ブルーイオン 2L', 'Blue ion water 2L', 320, 'drinks', { shape: 'pet2l', body: 0xf2f6fa, band: 0x1e5ab8, wave: true }, 'bottle', { unitsPerSlot: 3 }),
  P('sports_drink', 'アクティブチャージ', 'Active charge', 160, 'drinks', { shape: 'pet', body: 0xf2f6fa, band: 0x2aa8c8 }, 'bottle', { unitsPerSlot: 6 }),
  P('energy', 'ビッグパワーZ', 'Big Power Z', 230, 'drinks', { shape: 'slimcan', body: 0xf2d02a, band: 0x2a2a30 }, 'can', { unitsPerSlot: 6 }),
  // soda
  P('cola', 'コーラ', 'Cola', 170, 'drinks', { shape: 'pet', body: 0x3a1e18, band: 0xd8282a }, 'bottle', { unitsPerSlot: 6 }),
  P('cider', 'すっきりサイダー', 'Clear cider', 160, 'drinks', { shape: 'pet', body: 0xe8f6ee, band: 0x2a8a5a }, 'bottle', { unitsPerSlot: 6 }),
  P('vitamin_lemon', 'ビタミンレモン', 'Vitamin lemon', 160, 'drinks', { shape: 'pet', body: 0xf6e04a, band: 0xe8a018 }, 'bottle', { unitsPerSlot: 6 }),
  P('cola_can', 'コーラ 350ml', 'Cola can', 130, 'drinks', { shape: 'can', body: 0xd8282a, band: 0xffffff }, 'can', { unitsPerSlot: 6 }),
  // coffee and tea with milk
  P('pet_coffee', 'クリアブラック', 'Clear black coffee', 170, 'drinks', { shape: 'pet', body: 0x3a2418, band: 0x1a1a20 }, 'bottle', { unitsPerSlot: 6 }),
  P('cafe_latte', 'カフェラテ', 'Cafe latte', 170, 'drinks', { shape: 'pet', body: 0xd8b890, band: 0x6a3a22 }, 'bottle', { unitsPerSlot: 6 }),
  P('milk_tea', 'ロイヤルミルクティー', 'Royal milk tea', 160, 'drinks', { shape: 'pet', body: 0xe8c8a0, band: 0xb8342f }, 'bottle', { unitsPerSlot: 6 }),
  // dairy
  P('milk_1l', '牛乳 1000ml', 'Milk 1L', 250, 'drinks', { shape: 'milk1l', body: 0xfafafa, band: 0x2a6ac8 }, 'paper', { unitsPerSlot: 3 }),
  P('yogurt_drink', 'のむヨーグルト', 'Drinking yogurt', 150, 'drinks', { shape: 'carton', body: 0xf6f6fa, band: 0x3a8ad0 }, 'paper', { unitsPerSlot: 5 }),
  // alcohol (in the cooler)
  P('beer_gold', '黄金麦 生', 'Golden malt draft', 230, 'drinks', { shape: 'can', body: 0xd8a830, band: 0xffffff }, 'can', { unitsPerSlot: 6, alcohol: true }),
  P('beer_gold_500', '黄金麦 生 500ml', 'Golden malt 500', 300, 'drinks', { shape: 'tallcan', body: 0xd8a830, band: 0xffffff }, 'can', { unitsPerSlot: 6, alcohol: true }),
  P('beer_dry', '銀河ドライ', 'Galaxy dry', 230, 'drinks', { shape: 'can', body: 0xc8ccd4, band: 0x1a1a24 }, 'can', { unitsPerSlot: 6, alcohol: true }),
  P('beer_premium', '夜空プレミアム', 'Night sky premium', 250, 'drinks', { shape: 'can', body: 0x1e3a78, band: 0xd8b070 }, 'can', { unitsPerSlot: 6, alcohol: true }),
  P('beer_6pack', '黄金麦 生 6缶', 'Golden malt 6-pack', 1300, 'drinks', { shape: 'sixpack', body: 0xd8a830, band: 0xffffff }, 'box', { unitsPerSlot: 2, alcohol: true }),
  P('chuhi_lemon', 'キリッと強レモン 9%', 'Sharp lemon 9%', 170, 'drinks', { shape: 'tallcan', body: 0xd8dce4, band: 0xf2d02a, strong: true }, 'can', { unitsPerSlot: 6, alcohol: true }),
  P('chuhi_peach', 'もも果汁サワー', 'Peach sour', 160, 'drinks', { shape: 'can', body: 0xf6c0c8, band: 0xe8456a }, 'can', { unitsPerSlot: 6, alcohol: true }),
  P('chuhi_grape', 'ぶどう果汁サワー', 'Grape sour', 160, 'drinks', { shape: 'can', body: 0x8a4aa8, band: 0xf2f2f2 }, 'can', { unitsPerSlot: 6, alcohol: true }),
  P('highball', '琥珀ハイボール', 'Amber highball', 200, 'drinks', { shape: 'can', body: 0xc88030, band: 0x2a1a10 }, 'can', { unitsPerSlot: 6, alcohol: true }),
  // alcohol (on the shelf)
  P('sake_cup', 'ワンカップ富士', 'One-cup sake', 250, 'alcohol', { shape: 'sakecup', body: 0xe8f0f4, band: 0x1e3a78 }, 'bottle', { alcohol: true }),
  P('whisky', 'こはく 180ml', 'Kohaku whisky', 520, 'alcohol', { shape: 'whisky', body: 0xb8702a, band: 0x1a1a20 }, 'bottle', { alcohol: true }),
  P('wine_red', 'ぶどう畑の赤', 'Vineyard red', 680, 'alcohol', { shape: 'wine', body: 0x3a1a24, band: 0xf2ecd8 }, 'bottle', { alcohol: true, unitsPerSlot: 3 }),
  P('otsumami', 'さきいか', 'Dried squid snack', 280, 'alcohol', { shape: 'pouch', body: 0xf2ecd8, band: 0xc83a3a }, 'soft'),
  // chilled
  P('fruit_sando', 'フルーツサンド', 'Fruit sando', 380, 'chilled', { shape: 'fruitsando', body: 0xfbf6ec, band: 0xe8456a }, 'plastic', { unitsPerSlot: 3 }),
  P('ham_sando', 'ハムレタスサンド', 'Ham & lettuce sando', 290, 'chilled', { shape: 'sandwich', body: 0xf7ecd2, band: 0x6fb86a, filling: 'ham' }, 'plastic'),
  P('cold_soba', 'ざるそば', 'Cold soba', 420, 'chilled', { shape: 'tray', body: 0x2a2a30, band: 0x5a4a8a }, 'plastic', { needsChopsticks: true, unitsPerSlot: 3 }),
  P('pasta_salad', 'パスタサラダ', 'Pasta salad', 320, 'chilled', { shape: 'cup', body: 0xf2e6c0, band: 0xe8864a, r: 0.055, h: 0.06 }, 'plastic'),
  P('green_salad', 'グリーンサラダ', 'Green salad', 280, 'chilled', { shape: 'cup', body: 0xb8d890, band: 0x3a8a4a, r: 0.055, h: 0.06 }, 'plastic'),
  P('yogurt', 'なめらかヨーグルト', 'Yogurt', 150, 'chilled', { shape: 'cup', body: 0xfafafa, band: 0x3a8ad0, r: 0.04, h: 0.06 }, 'plastic'),
  // sweets
  P('roll_cake', 'プレミアムロールケーキ', 'Premium roll cake', 190, 'chilled', { shape: 'rollcake', body: 0xf2e0b0, band: 0x6a3a22 }, 'plastic'),
  P('cream_puff', 'ダブルシュー', 'Double cream puff', 160, 'chilled', { shape: 'creampuff', body: 0xe8c078, band: 0x3a6ec8 }, 'plastic'),
  P('cheesecake', 'ベイクドチーズケーキ', 'Baked cheesecake', 260, 'chilled', { shape: 'cakewedge', body: 0xf2d890, band: 0x3a3a48 }, 'plastic'),
  // ice (the flat case)
  P('ice_vanilla', 'ミルクバニラ', 'Milk vanilla', 300, 'frozen', { shape: 'icecup', body: 0xf6ecd0, band: 0x8a1a2a }, 'plastic', { cold: true }),
  P('ice_choco', 'ショコラ濃厚', 'Rich chocolate', 300, 'frozen', { shape: 'icecup', body: 0x5a3020, band: 0x2a1a14 }, 'plastic', { cold: true }),
  P('ice_soda_bar', 'ソーダバー', 'Soda ice bar', 90, 'frozen', { shape: 'icebar', body: 0x6ac8ec, band: 0x1e5ab8 }, 'plastic', { cold: true }),
  P('ice_choco_bar', 'チョコモナカバー', 'Choco monaka bar', 160, 'frozen', { shape: 'icebar', body: 0x5a3020, band: 0xd8a830 }, 'plastic', { cold: true }),
  P('ice_mochi', 'もちもちアイス', 'Mochi ice pair', 160, 'frozen', { shape: 'mochi', body: 0xf2f2ea, band: 0xd8342f }, 'plastic', { cold: true }),
  P('ice_multipack', 'ファミリーパック', 'Family pack', 450, 'frozen', { shape: 'multipack', body: 0x3a8ad0, band: 0xf2c23c }, 'box', { cold: true, unitsPerSlot: 2 }),
  P('ice_bag', 'かち割り氷', 'Bag of ice', 200, 'frozen', { shape: 'icebag', body: 0xe8f4fa, band: 0x3a8ad0 }, 'plastic', { cold: true, unitsPerSlot: 4 }),
  // make your own (the smoothie freezer)
  P('smoothie_mango', 'マンゴースムージー', 'Mango smoothie cup', 350, 'selfserve', { shape: 'fruitcup', body: 0xf2b830, band: 0xe8864a }, 'plastic', { cold: true }),
  P('smoothie_berry', 'ベリースムージー', 'Berry smoothie cup', 350, 'selfserve', { shape: 'fruitcup', body: 0xc8305a, band: 0x8a2a5a }, 'plastic', { cold: true }),
  P('smoothie_green', 'グリーンスムージー', 'Green smoothie cup', 350, 'selfserve', { shape: 'fruitcup', body: 0x8ac848, band: 0x3a8a4a }, 'plastic', { cold: true }),
  P('ice_cup', 'アイスコーヒー用カップ', 'Iced-coffee ice cup', 110, 'selfserve', { shape: 'fruitcup', body: 0xe8f4fa, band: 0x6a3a22 }, 'plastic', { cold: true }),
];

export const PRODUCT = Object.fromEntries(CATALOG.map((p) => [p.id, p]));
