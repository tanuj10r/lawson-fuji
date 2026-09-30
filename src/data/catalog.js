/* ------------------------------------------------------------------ *
 * The store's range (SPEC 7; rebuilt in M3d from research on all three
 * big chains: reference/konbini-details.md, section 9).
 *
 * Every name and package is ours and generic (AGENTS.md): products may
 * evoke what 7-Eleven, FamilyMart and Lawson sell, never copy it.
 *
 * Product: { id, nameJa, nameEn, priceYen, zone, group, mesh, sound }
 *   zone   where it lives (drinks, chilled, gondola, frozen, ...)
 *   group  its section: a cooler door's category, a chilled-case section,
 *          a gondola side's category (store/planogram.js fills from these)
 *   mesh   { shape, body, band, style?, ... }  colours as hex; the builder
 *          is world/store/products.js, the label world/store/labels.js.
 *
 * Families are written as tables: one row per variety.  At most 18 of any
 * product stand in the store (planogram.js), so the range is wide.
 * ------------------------------------------------------------------ */

const P = (id, nameJa, nameEn, priceYen, zone, group, mesh, sound, extra = {}) => ({
  id, nameJa, nameEn, priceYen, zone, group, mesh, sound, ...extra,
});
/** A family: shared zone, group, shape and sound; rows [id, ja, en, price, body, band, mesh extras?, extras?]. */
const F = (zone, group, shape, sound, rows, meshBase = {}, base = {}) =>
  rows.map(([id, ja, en, price, body, band, m = {}, x = {}]) =>
    P(id, ja, en, price, zone, group, { shape, body, band, ...meshBase, ...m }, sound, { ...base, ...x }));

export const CATALOG = [
  /* ================================ chilled ================================ */
  ...F('chilled', 'onigiri', 'onigiri', 'plastic', [
    ['onigiri_salmon', '鮭おにぎり', 'Salmon onigiri', 160, 0xf6f4ec, 0xe87a8a, { filling: 0xe8795a }],
    ['onigiri_tuna', 'ツナマヨおにぎり', 'Tuna-mayo onigiri', 150, 0xf6f4ec, 0x3a78c8, { filling: 0xe8dcb0 }],
    ['onigiri_ume', '梅おにぎり', 'Umeboshi onigiri', 140, 0xf6f4ec, 0xd8342f, { filling: 0xc8283a }],
    ['onigiri_kombu', '昆布おにぎり', 'Kombu onigiri', 140, 0xf6f4ec, 0x2e5a3a, { filling: 0x3a3020 }],
    ['onigiri_mentai', '明太子おにぎり', 'Mentaiko onigiri', 180, 0xf6f4ec, 0xe8456a, { filling: 0xe86a5a }],
    ['onigiri_okaka', 'おかかおにぎり', 'Bonito onigiri', 140, 0xf6f4ec, 0x8a5a2a, { filling: 0x9a6a3a }],
    ['onigiri_shrimp', '天むすおにぎり', 'Tempura onigiri', 190, 0xf6f4ec, 0xe8a018, { filling: 0xf2c878 }],
    ['onigiri_egg', '煮たまごおにぎり', 'Soy egg onigiri', 200, 0xf6f4ec, 0xf2c23c, { filling: 0xf2d890 }],
    ['onigiri_chahan', '焼きめしおにぎり', 'Fried-rice onigiri', 170, 0xe8c888, 0xc8342f, { filling: 0xd89048 }],
    ['onigiri_sekihan', '赤飯おにぎり', 'Red-bean rice ball', 160, 0xd8a0a0, 0x8a2a3a, { filling: 0x8a3040 }],
  ]),
  ...F('chilled', 'sando', 'sandwich', 'plastic', [
    ['sando_egg', 'たまごサンド', 'Egg sando', 298, 0xf7ecd2, 0xf2c23c],
    ['ham_sando', 'ハムレタスサンド', 'Ham & lettuce sando', 290, 0xf7ecd2, 0x6fb86a, { filling: 'ham' }],
    ['sando_katsu', 'ロースカツサンド', 'Pork cutlet sando', 380, 0xf7ecd2, 0x8a4a2a],
    ['sando_tuna', 'ツナサンド', 'Tuna sando', 270, 0xf7ecd2, 0x3a78c8],
    ['sando_mix', 'ミックスサンド', 'Mixed sando', 330, 0xf7ecd2, 0xe8864a],
    ['sando_blt', 'BLTサンド', 'BLT sando', 350, 0xf7ecd2, 0xd8342f],
  ]),
  ...F('chilled', 'sando', 'fruitsando', 'plastic', [
    ['fruit_sando', 'フルーツサンド', 'Fruit sando', 398, 0xfbf6ec, 0xe8456a],
    ['fruit_sando_ichigo', 'いちごサンド', 'Strawberry sando', 420, 0xfbf6ec, 0xd8284a],
  ]),
  ...F('chilled', 'bento', 'bento', 'plastic', [
    ['bento_makunouchi', '幕の内弁当', 'Makunouchi bento', 580, 0x2a2a30, 0xc8342f],
    ['bento_karaage', '唐揚げ弁当', 'Karaage bento', 520, 0x2a2a30, 0xe8864a],
    ['bento_nori', 'のり弁当', 'Nori bento', 430, 0x2a2a30, 0x2e5a3a],
    ['bento_hamburg', 'ハンバーグ弁当', 'Hamburg steak bento', 550, 0x2a2a30, 0x8a4a2a],
    ['bento_salmon', '焼鮭弁当', 'Grilled salmon bento', 560, 0x2a2a30, 0xe87a8a],
    ['bento_curry', 'ビーフカレー', 'Beef curry rice', 540, 0x2a2a30, 0xd89048],
    ['bento_gyudon', '牛丼', 'Beef bowl', 520, 0x2a2a30, 0xe8a018],
    ['bento_omurice', 'オムライス', 'Omurice', 500, 0x2a2a30, 0xf2c23c],
  ]),
  ...F('chilled', 'noodle', 'tray', 'plastic', [
    ['cold_soba', 'ざるそば', 'Cold soba', 420, 0x2a2a30, 0x5a4a8a],
    ['hiyashi_chuka', '冷やし中華', 'Chilled ramen', 480, 0x2a2a30, 0xf2c23c],
    ['cold_udon', 'ぶっかけうどん', 'Cold udon', 400, 0x2a2a30, 0x3a8ad0],
    ['pasta_napolitan', 'ナポリタン', 'Napolitan pasta', 450, 0x2a2a30, 0xd8342f],
    ['pasta_carbonara', 'カルボナーラ', 'Carbonara', 480, 0x2a2a30, 0xf2e6c0],
  ]),
  ...F('chilled', 'salad', 'cup', 'plastic', [
    ['potato_salad', 'ポテトサラダ', 'Potato salad', 230, 0xf4ecc8, 0x6fb86a, { r: 0.05, h: 0.06 }],
    ['pasta_salad', 'パスタサラダ', 'Pasta salad', 320, 0xf2e6c0, 0xe8864a, { r: 0.055, h: 0.06 }],
    ['green_salad', 'グリーンサラダ', 'Green salad', 280, 0xb8d890, 0x3a8a4a, { r: 0.055, h: 0.06 }],
    ['salad_chicken', 'サラダチキン', 'Salad chicken', 250, 0xf2ecd8, 0xe8a018, { r: 0.05, h: 0.035 }],
    ['salad_tofu', '豆腐サラダ', 'Tofu salad', 300, 0xf6f6ee, 0x2e6a3a, { r: 0.055, h: 0.06 }],
    ['salad_goma', 'ごまドレ春雨', 'Sesame noodle salad', 260, 0xe8d8b0, 0x6a4a2a, { r: 0.05, h: 0.06 }],
  ]),
  ...F('chilled', 'dessert', 'pudding', 'plastic', [
    ['pudding', 'なめらかプリン', 'Custard pudding', 200, 0xf2d48a, 0x8a4a2a],
    ['pudding_matcha', '抹茶プリン', 'Matcha pudding', 220, 0x9ac070, 0x2e5a3a],
  ]),
  ...F('chilled', 'dessert', 'rollcake', 'plastic', [
    ['roll_cake', 'プレミアムロールケーキ', 'Premium roll cake', 190, 0xf2e0b0, 0x6a3a22],
    ['roll_matcha', '抹茶ロール', 'Matcha roll cake', 220, 0xa8c880, 0x2e5a3a],
  ]),
  ...F('chilled', 'dessert', 'creampuff', 'plastic', [
    ['cream_puff', 'ダブルシュー', 'Double cream puff', 160, 0xe8c078, 0x3a6ec8],
    ['eclair', 'チョコエクレア', 'Chocolate eclair', 180, 0x6a3a22, 0xd8a830],
  ]),
  ...F('chilled', 'dessert', 'cakewedge', 'plastic', [
    ['cheesecake', 'ベイクドチーズケーキ', 'Baked cheesecake', 260, 0xf2d890, 0x3a3a48],
    ['shortcake', 'いちごショート', 'Strawberry shortcake', 350, 0xfbf6ec, 0xe8456a],
    ['tiramisu', 'ティラミス', 'Tiramisu', 300, 0x8a5a3a, 0x3a2418],
  ]),
  ...F('chilled', 'dessert', 'mochi', 'plastic', [
    ['daifuku', 'いちご大福', 'Strawberry daifuku', 220, 0xf6ecec, 0xe8456a],
    ['dango', 'みたらし団子', 'Mitarashi dango', 150, 0xf2e6c8, 0x8a5a2a],
  ]),
  ...F('chilled', 'dairy', 'cup', 'plastic', [
    ['yogurt', 'なめらかヨーグルト', 'Yogurt', 150, 0xfafafa, 0x3a8ad0, { r: 0.04, h: 0.06 }],
    ['yogurt_aloe', 'アロエヨーグルト', 'Aloe yogurt', 160, 0xeef6e6, 0x5aa870, { r: 0.04, h: 0.06 }],
    ['yogurt_greek', 'ギリシャヨーグルト', 'Greek yogurt', 170, 0xfafafa, 0x1e3a78, { r: 0.04, h: 0.05 }],
  ]),
  ...F('chilled', 'dairy', 'carton', 'paper', [
    ['coffee_milk', 'コーヒー牛乳', 'Coffee milk', 150, 0xd8b890, 0x6a3a22],
    ['fruit_milk', 'フルーツ牛乳', 'Fruit milk', 150, 0xf6e0a8, 0xe8864a],
  ]),

  /* ============================ the cooler: drinks ============================ */
  ...F('drinks', 'water', 'pet', 'bottle', [
    ['water_500', 'ふじの湧水', 'Fuji spring water', 110, 0xe8f4fa, 0x3a8ad0],
    ['water_alps', '南アルプスの水', 'Mountain water', 110, 0xe8f6f2, 0x2a8a6a],
    ['water_sparkling', '強炭酸水', 'Sparkling water', 120, 0xeef4f8, 0x1a1a24],
    ['water_lemon', '炭酸水レモン', 'Lemon sparkling water', 120, 0xf6f8e6, 0xe8c018],
    ['water_peach', 'ももの天然水', 'Peach-scent water', 150, 0xfaeef0, 0xe89aa8],
    ['water_hard', '硬水ミネラル', 'Hard mineral water', 150, 0xeef2fa, 0x6a4aa8],
    ['water_alkaline', 'アルカリイオンの水', 'Alkaline water', 120, 0xeaf6fa, 0x2aa8c8],
    ['water_vitamin', 'ビタミンウォーター', 'Vitamin water', 160, 0xf6f2e6, 0xe8a018],
    ['sparkling_grapefruit', '炭酸水 グレフル', 'Grapefruit sparkling water', 120, 0xfaf0ee, 0xe8456a],
    ['sparkling_muscat', '炭酸水 マスカット', 'Muscat sparkling water', 120, 0xf2faee, 0x7ac04a],
    ['jelly_drink', 'ゼリー飲料 エネルギー', 'Energy jelly drink', 200, 0xf2f6fa, 0x1e5ab8],
  ]),
  ...F('drinks', 'water', 'pet2l', 'bottle', [
    ['water_2l', 'ふじの湧水 2L', 'Fuji spring water 2L', 190, 0xe8f4fa, 0x3a8ad0],
    ['water_sparkling_1l', '強炭酸水 1L', 'Sparkling water 1L', 200, 0xeef4f8, 0x1a1a24],
  ]),
  ...F('drinks', 'tea', 'pet', 'bottle', [
    ['green_tea', 'やすらぎ緑茶', 'Green tea', 160, 0xc8d8a0, 0x3a8a4a],
    ['green_tea_take', '竹林の緑茶', 'Bamboo green tea', 160, 0xb8d088, 0x2e6a3a],
    ['green_tea_koi', '濃いめ緑茶', 'Strong green tea', 170, 0xa8c078, 0x1e4a2a],
    ['barley_tea', 'こうばし麦茶', 'Barley tea', 140, 0xc8905a, 0x8a5a2a],
    ['oolong', 'まろやか烏龍茶', 'Oolong tea', 160, 0xb07040, 0xc8342f],
    ['jasmine', 'ジャスミン茶', 'Jasmine tea', 160, 0xe8d890, 0x5aa870],
    ['hojicha', 'ほうじ茶', 'Roasted hojicha', 160, 0xb88050, 0x6a3a22],
    ['black_tea', '無糖紅茶', 'Unsweetened black tea', 160, 0xc87040, 0x8a1a2a],
    ['lemon_tea', 'レモンティー', 'Lemon tea', 150, 0xe8b050, 0xf2d02a],
    ['blend_tea', '十六茶ブレンド', 'Sixteen-grain tea', 160, 0xd8b070, 0x8a6a2a],
  ]),
  ...F('drinks', 'tea', 'pet2l', 'bottle', [
    ['tea_2l', 'やすらぎ緑茶 2L', 'Green tea 2L', 230, 0xc8d8a0, 0x3a8a4a],
    ['barley_2l', 'こうばし麦茶 2L', 'Barley tea 2L', 210, 0xc8905a, 0x8a5a2a],
    ['oolong_2l', 'まろやか烏龍茶 2L', 'Oolong tea 2L', 230, 0xb07040, 0xc8342f],
  ]),
  ...F('drinks', 'sports', 'pet', 'bottle', [
    ['ion_water', 'ブルーイオン', 'Blue ion water', 170, 0xf2f6fa, 0x1e5ab8, { wave: true }],
    ['ion_light', 'ブルーイオン ライト', 'Blue ion light', 170, 0xf2f6fa, 0x6aa8e8, { wave: true }],
    ['sports_drink', 'アクティブチャージ', 'Active charge', 160, 0xf2f6fa, 0x2aa8c8],
    ['amino_water', 'アミノウォーター', 'Amino water', 180, 0xf6f6ee, 0xe8864a],
    ['vitamin_lemon', 'ビタミンレモン', 'Vitamin lemon', 160, 0xf6e04a, 0xe8a018],
    ['protein_drink', 'プロテインドリンク', 'Protein drink', 200, 0xf2eee6, 0x3a3a48],
    ['sports_zero', 'アクティブチャージ ゼロ', 'Active charge zero', 160, 0xf2f6fa, 0x6ac8d8],
    ['collagen_drink', 'コラーゲンウォーター', 'Collagen water', 180, 0xfaf0f2, 0xe89aa8],
  ]),
  ...F('drinks', 'sports', 'pet2l', 'bottle', [
    ['sports_2l', 'アクティブチャージ 2L', 'Active charge 2L', 300, 0xf2f6fa, 0x2aa8c8],
  ]),
  ...F('drinks', 'sports', 'pet2l', 'bottle', [
    ['ion_water_2l', 'ブルーイオン 2L', 'Blue ion water 2L', 320, 0xf2f6fa, 0x1e5ab8, { wave: true }],
  ]),
  ...F('drinks', 'sports', 'slimcan', 'can', [
    ['energy', 'ビッグパワーZ', 'Big Power Z', 230, 0xf2d02a, 0x2a2a30],
    ['energy_blue', 'ブルーボルト', 'Blue bolt energy', 230, 0x1e3a78, 0xd8dce4],
    ['energy_zero', 'ビッグパワーZ ゼロ', 'Big Power Z zero', 230, 0xf2f2f2, 0x2a2a30],
  ]),
  ...F('drinks', 'soda', 'pet', 'bottle', [
    ['cola', 'コーラ', 'Cola', 170, 0x3a1e18, 0xd8282a],
    ['cola_zero', 'コーラ ゼロ', 'Cola zero', 170, 0x1a1a1e, 0x1a1a1e],
    ['cider', 'すっきりサイダー', 'Clear cider', 160, 0xe8f6ee, 0x2a8a5a],
    ['milky_soda', 'ミルキーソーダ', 'Milky soda', 150, 0xf2f2f6, 0x3a6ec8],
    ['ginger_ale', 'ジンジャーエール', 'Ginger ale', 160, 0xe8d090, 0x2a6a3a],
    ['orange_soda', 'オレンジソーダ', 'Orange soda', 160, 0xf2a030, 0xe8642a],
    ['melon_soda', 'メロンソーダ', 'Melon soda', 160, 0x6ad86a, 0x2a8a3a],
    ['grape_soda', 'グレープソーダ', 'Grape soda', 160, 0x8a4aa8, 0x4a2a6a],
  ]),
  ...F('drinks', 'soda', 'codd', 'bottle', [
    ['ramune', 'ラムネ', 'Ramune', 180, 0xa8d8ec, 0x3a8ad0],
  ]),
  ...F('drinks', 'soda', 'can', 'can', [
    ['cola_can', 'コーラ 350ml', 'Cola can', 130, 0xd8282a, 0xffffff],
    ['cider_can', 'サイダー 350ml', 'Cider can', 120, 0x2a8a5a, 0xffffff],
    ['orange_juice_can', 'つぶつぶオレンジ', 'Pulpy orange', 130, 0xf2a030, 0xffffff],
  ]),
  ...F('drinks', 'coffee', 'pet', 'bottle', [
    ['pet_coffee', 'クリアブラック', 'Clear black coffee', 170, 0x3a2418, 0x1a1a20],
    ['cafe_latte', 'カフェラテ', 'Cafe latte', 170, 0xd8b890, 0x6a3a22],
    ['milk_tea', 'ロイヤルミルクティー', 'Royal milk tea', 160, 0xe8c8a0, 0xb8342f],
    ['matcha_latte', '抹茶ラテ', 'Matcha latte', 180, 0xb8d098, 0x2e5a3a],
    ['caramel_latte', 'キャラメルラテ', 'Caramel latte', 180, 0xd8a870, 0x8a4a1a],
  ]),
  ...F('drinks', 'coffee', 'can', 'can', [
    ['can_coffee', 'あさの微糖', 'Canned coffee', 130, 0x1e3a6a, 0xd8b070],
    ['can_coffee_black', 'あさのブラック', 'Canned black coffee', 130, 0x1a1a20, 0xd8b070],
    ['can_coffee_milk', 'あさのカフェオレ', 'Canned cafe au lait', 130, 0xc89a60, 0x6a3a22],
    ['can_coffee_gold', '極 深煎り', 'Dark roast coffee', 140, 0x2a1a10, 0xd8a830],
  ]),
  ...F('drinks', 'milk', 'carton', 'paper', [
    ['strawberry_milk', 'いちごミルク', 'Strawberry milk', 170, 0xf8c8d8, 0xe8456a],
    ['yogurt_drink', 'のむヨーグルト', 'Drinking yogurt', 150, 0xf6f6fa, 0x3a8ad0],
    ['soy_milk', '調製豆乳', 'Soy milk', 130, 0xf2ecd8, 0x2e6a3a],
    ['banana_milk', 'バナナオレ', 'Banana milk', 150, 0xf6e48a, 0xe8a018],
    ['choco_milk', 'チョコミルク', 'Chocolate milk', 150, 0x8a5a3a, 0x4a2a1a],
    ['lactic_drink', '乳酸菌ドリンク', 'Lactic drink', 130, 0xf2f6fa, 0xe8456a],
  ]),
  ...F('drinks', 'milk', 'milk1l', 'paper', [
    ['milk_1l', '牛乳 1000ml', 'Milk 1L', 250, 0xfafafa, 0x2a6ac8],
    ['milk_low', '低脂肪乳 1000ml', 'Low-fat milk 1L', 230, 0xfafafa, 0x6ab8e8],
    ['orange_juice_1l', 'オレンジ100% 1L', 'Orange juice 1L', 300, 0xf6b030, 0xe8642a],
    ['apple_juice_1l', 'りんご100% 1L', 'Apple juice 1L', 300, 0xf2e6a0, 0xd8342f],
  ]),
  ...F('drinks', 'beer', 'can', 'can', [
    ['beer_gold', '黄金麦 生', 'Golden malt draft', 230, 0xd8a830, 0xffffff],
    ['beer_dry', '銀河ドライ', 'Galaxy dry', 230, 0xc8ccd4, 0x1a1a24],
    ['beer_premium', '夜空プレミアム', 'Night sky premium', 250, 0x1e3a78, 0xd8b070],
    ['beer_lager', 'クラシック ラガー', 'Classic lager', 230, 0x8a1a2a, 0xd8b070],
    ['happoshu', 'すっきり麦', 'Light malt', 170, 0x3a8ad0, 0xffffff],
    ['nonalc_beer', 'ノンアル 麦ゼロ', 'Alcohol-free malt', 150, 0x1e5a3a, 0xffffff],
  ]),
  ...F('drinks', 'beer', 'tallcan', 'can', [
    ['beer_gold_500', '黄金麦 生 500ml', 'Golden malt 500', 300, 0xd8a830, 0xffffff],
    ['beer_dry_500', '銀河ドライ 500ml', 'Galaxy dry 500', 300, 0xc8ccd4, 0x1a1a24],
  ]),
  ...F('drinks', 'beer', 'sixpack', 'box', [
    ['beer_6pack', '黄金麦 生 6缶', 'Golden malt 6-pack', 1300, 0xd8a830, 0xffffff],
  ]),
  ...F('drinks', 'chuhi', 'tallcan', 'can', [
    // Strong Nine (Tan's experience): a homage to the famous 9% lemon chu-hi, never its design
    ['strong_nine', 'ストロングナイン レモン', 'Strong Nine lemon', 198, 0xd8dce4, 0xf2d02a, { strong: true, nine: true, abv: '9%' }],
    ['chuhi_grapefruit', 'キリッと強グレフル 9%', 'Sharp grapefruit 9%', 170, 0xf2c8c0, 0xe8456a, { strong: true, fruit: '#f28a7a', abv: '9%' }],
  ]),
  ...F('drinks', 'chuhi', 'can', 'can', [
    ['chuhi_peach', 'もも果汁サワー', 'Peach sour', 160, 0xf6c0c8, 0xe8456a],
    ['chuhi_grape', 'ぶどう果汁サワー', 'Grape sour', 160, 0x8a4aa8, 0xf2f2f2],
    ['chuhi_lemon_sour', 'レモンサワーの素', 'Classic lemon sour', 160, 0xf6e880, 0x2a6a3a],
    ['chuhi_ume', 'うめサワー', 'Plum sour', 160, 0xe8c0c8, 0x8a2a3a],
    ['chuhi_yuzu', 'ゆずサワー', 'Yuzu sour', 160, 0xf2e070, 0x3a8a4a],
    ['highball', '琥珀ハイボール', 'Amber highball', 200, 0xc88030, 0x2a1a10],
    ['highball_lemon', '琥珀ハイボール レモン', 'Amber highball lemon', 200, 0xd8a040, 0xf2d02a],
    ['umeshu_soda', '梅酒ソーダ', 'Plum wine soda', 180, 0xd8b050, 0x8a2a3a],
  ]),

  /* ============================= the gondolas ============================= */
  // G0, the chilled-case side: bread and pastries
  ...F('gondola', 'bread', 'melonpan', 'soft', [
    ['melon_pan', 'メロンパン', 'Melon pan', 150, 0xf2d890, 0x6fb86a],
    ['melon_pan_choco', 'チョコチップメロンパン', 'Choco-chip melon pan', 160, 0xe8c880, 0x6a3a22],
    ['anpan', 'つぶあんぱん', 'Red-bean bun', 140, 0xd8904a, 0x8a2a3a],
    ['cream_pan', 'クリームパン', 'Custard bun', 150, 0xe8b060, 0xf2c23c],
  ]),
  ...F('gondola', 'bread', 'currypan', 'soft', [
    ['curry_pan', 'カレーパン', 'Curry bread', 170, 0xd89048, 0xe8864a],
    ['yakisoba_pan', '焼きそばパン', 'Yakisoba bun', 180, 0xe8c888, 0x2a2a30],
    ['sausage_roll', 'ソーセージロール', 'Sausage roll', 170, 0xd8a060, 0xd8342f],
    ['choco_cornet', 'チョココロネ', 'Choco cornet', 150, 0xc88a48, 0x6a3a22],
    ['cheese_bread', 'チーズ蒸しパン', 'Steamed cheese cake', 140, 0xf2d870, 0xf2a030],
    ['donut_sugar', 'シュガードーナツ', 'Sugar donut', 130, 0xe8b070, 0xe8456a],
    ['ham_cheese_pan', 'ハムチーズパン', 'Ham & cheese bun', 170, 0xe8c070, 0xe8864a],
    ['jam_pan', 'いちごジャムパン', 'Strawberry jam bun', 140, 0xe8b868, 0xd8284a],
    ['choco_mushipan', 'チョコ蒸しパン', 'Steamed choco cake', 140, 0x6a3a22, 0xf2c23c],
  ]),
  ...F('gondola', 'bread', 'box', 'soft', [
    ['shokupan', '食パン 6枚切', 'Sliced bread (6)', 190, 0xf6f0e0, 0x3a6ec8, { w: 0.13, h: 0.12, d: 0.2, style: 'bread' }],
    ['butter_roll', 'バターロール 6個', 'Butter rolls (6)', 200, 0xe8b868, 0xd8342f, { w: 0.2, h: 0.08, d: 0.14, style: 'bread' }],
    ['french_toast', 'フレンチトースト', 'French toast', 160, 0xf2d890, 0x6a3a22, { w: 0.12, h: 0.04, d: 0.12, style: 'bread' }],
    ['bagel', 'プレーンベーグル', 'Plain bagel', 150, 0xd8a060, 0x3a6ec8, { w: 0.11, h: 0.05, d: 0.11, style: 'bread' }],
    ['cinnamon_roll', 'シナモンロール', 'Cinnamon roll', 180, 0xc88048, 0x8a4a1a, { w: 0.11, h: 0.05, d: 0.11, style: 'bread' }],
    ['castella', 'はちみつカステラ', 'Honey castella', 200, 0xf2c860, 0x8a4a1a, { w: 0.14, h: 0.05, d: 0.08, style: 'bread' }],
    ['lunch_pack', 'ふわふわサンド ピーナッツ', 'Soft sandwich, peanut', 160, 0xf6f0e0, 0xe8a018, { w: 0.12, h: 0.035, d: 0.13, style: 'bread' }],
    ['lunch_pack_egg', 'ふわふわサンド たまご', 'Soft sandwich, egg', 170, 0xf6f0e0, 0xf2c23c, { w: 0.12, h: 0.035, d: 0.13, style: 'bread' }],
    ['croissant_mini', 'ミニクロワッサン 5個', 'Mini croissants (5)', 230, 0xe8a850, 0x3a6ec8, { w: 0.18, h: 0.07, d: 0.12, style: 'bread' }],
  ]),
  // G0, the other side: instant food
  ...F('gondola', 'instant', 'cupnoodle', 'paper', [
    ['cup_ramen', 'しょうゆカップ麺', 'Cup ramen', 220, 0xf2f2ea, 0xd8342f, { word: 'しょうゆ' }],
    ['cup_miso', 'みそカップ麺', 'Miso cup ramen', 230, 0xf2f2ea, 0xc8742a, { word: 'みそ' }],
    ['cup_shio', 'しおカップ麺', 'Salt cup ramen', 220, 0xf2f2ea, 0x3a8ad0, { word: 'しお' }],
    ['cup_tonkotsu', 'とんこつカップ麺', 'Tonkotsu cup ramen', 240, 0xf2f2ea, 0x2a2a30, { word: 'とんこつ' }],
    ['cup_seafood', 'シーフードヌードル', 'Seafood cup noodle', 230, 0xf2f2ea, 0x2aa8c8, { word: 'シーフード' }],
    ['cup_curry', 'カレーヌードル', 'Curry cup noodle', 230, 0xf2f2ea, 0xe8a018, { word: 'カレー' }],
    ['cup_spicy', '激辛カップ麺', 'Extra-spicy cup noodle', 250, 0xf2f2ea, 0xa8141a, { word: '激辛' }],
    ['cup_udon', 'きつねうどん', 'Kitsune udon cup', 220, 0xf2f2ea, 0xe8864a, { word: 'うどん' }],
    ['cup_soba', 'たぬきそば', 'Tanuki soba cup', 220, 0xf2f2ea, 0x5a4a8a, { word: 'そば' }],
    ['cup_mini', 'ミニ しょうゆ', 'Mini cup ramen', 130, 0xf2f2ea, 0xd8342f, { word: 'ミニ', small: true }],
    ['cup_mini_curry', 'ミニ カレー', 'Mini curry cup', 130, 0xf2f2ea, 0xe8a018, { word: 'ミニ', small: true }],
    ['cup_pho', 'フォー', 'Pho cup', 230, 0xf2f2ea, 0x3a8a4a, { word: 'フォー' }],
    ['cup_wantan', 'わんたん', 'Wonton soup cup', 150, 0xf2f2ea, 0xe8864a, { word: 'わんたん', small: true }],
  ]),
  ...F('gondola', 'instant', 'tray', 'paper', [
    ['yakisoba', 'ソース焼きそば', 'Yakisoba cup', 240, 0xf2f2ea, 0x2a2a30],
    ['yakisoba_shio', '塩焼きそば', 'Salt yakisoba cup', 240, 0xf2f2ea, 0x3a8ad0],
    ['abura_soba', '汁なし油そば', 'Soupless oil noodles', 260, 0xf2f2ea, 0xe8a018],
  ]),
  ...F('gondola', 'instant', 'cup', 'paper', [
    ['miso_soup', 'しじみ味噌汁', 'Clam miso soup', 160, 0xf2ecd8, 0x8a5a2a, { r: 0.045, h: 0.06 }],
    ['corn_soup', 'コーンスープ', 'Corn soup', 160, 0xf6e080, 0xe8a018, { r: 0.045, h: 0.06 }],
    ['wakame_soup', 'わかめスープ', 'Seaweed soup', 150, 0xe8f0e0, 0x2e6a3a, { r: 0.045, h: 0.06 }],
  ]),
  ...F('gondola', 'instant', 'box', 'box', [
    ['rice_pack', 'ごはん 200g', 'Microwave rice', 160, 0xfafafa, 0x3a8a4a, { w: 0.13, h: 0.04, d: 0.12 }],
    ['curry_retort', 'レトルトカレー 中辛', 'Pouch curry (medium)', 280, 0xd89048, 0x8a2a1a, { w: 0.14, h: 0.18, d: 0.03 }],
    ['curry_retort_hot', 'レトルトカレー 辛口', 'Pouch curry (hot)', 280, 0xa8341a, 0x2a1a10, { w: 0.14, h: 0.18, d: 0.03 }],
    ['hayashi', 'ハヤシライス', 'Hayashi rice pouch', 280, 0x8a3a2a, 0xd8b070, { w: 0.14, h: 0.18, d: 0.03 }],
    ['oatmeal', 'オートミール', 'Oatmeal', 380, 0xf2e6c8, 0x6a8a3a, { w: 0.12, h: 0.18, d: 0.05 }],
    ['miso_10', 'インスタント味噌汁 10食', 'Instant miso soup (10)', 380, 0xf2ecd8, 0xc8742a, { w: 0.16, h: 0.14, d: 0.05 }],
    ['furikake', 'のりたまふりかけ', 'Rice seasoning', 180, 0xf2d02a, 0x2e5a3a, { w: 0.09, h: 0.13, d: 0.02 }],
    ['pasta_sauce', 'たらこパスタソース', 'Pasta sauce, cod roe', 250, 0xe86a7a, 0xf2f2f2, { w: 0.13, h: 0.17, d: 0.03 }],
    ['okayu', 'たまごがゆ', 'Egg rice porridge', 250, 0xf6e8b0, 0xe8a018, { w: 0.12, h: 0.16, d: 0.03 }],
  ]),
  ...F('gondola', 'instant', 'tin', 'can', [
    ['tin_saba', 'さば味噌煮缶', 'Mackerel in miso (tin)', 280, 0xd8dce4, 0x1e3a78],
    ['tin_tuna', 'ツナ缶', 'Tuna (tin)', 220, 0xd8dce4, 0x3a78c8],
    ['tin_yakitori', 'やきとり缶', 'Yakitori (tin)', 200, 0xd8dce4, 0xd8342f],
    ['tin_corn', 'スイートコーン缶', 'Sweetcorn (tin)', 180, 0xd8dce4, 0xe8b018],
  ]),
  // G1, the chilled-case side: savoury snacks
  ...F('gondola', 'snacks', 'bag', 'soft', [
    ['potato_chips', 'うすしおポテト', 'Potato chips, salted', 160, 0xf2c23c, 0xd8342f],
    ['chips_nori', 'のりしおポテト', 'Potato chips, nori', 160, 0x3a8a4a, 0xf2c23c],
    ['chips_consomme', 'コンソメポテト', 'Potato chips, consommé', 160, 0xd8342f, 0xf2c23c],
    ['chips_pepper', 'ブラックペッパー', 'Potato chips, black pepper', 170, 0x2a2a30, 0xe8a018],
    ['chips_sourcream', 'サワークリーム', 'Potato chips, sour cream', 170, 0x6ab8e8, 0xf2f2f2],
    ['chips_wasabi', 'わさびポテト', 'Potato chips, wasabi', 170, 0x9ad060, 0x2e5a3a],
    ['chips_ume', '梅ポテト', 'Potato chips, plum', 170, 0xe8a0b0, 0x8a2a3a],
    ['chips_butter', 'バターしょうゆ', 'Potato chips, butter soy', 170, 0xf2d870, 0x8a4a1a],
    ['chips_thick', '厚切りポテト', 'Thick-cut chips', 180, 0xe8864a, 0x2a2a30],
    ['corn_snack', 'コーンポタージュ味', 'Corn puffs', 120, 0xf2d02a, 0x3a8ad0],
    ['corn_snack_cheese', 'チーズコーン', 'Cheese corn puffs', 120, 0xf2a030, 0xd8342f],
    ['shrimp_crackers', 'えびせん', 'Shrimp crackers', 150, 0xf2ecd8, 0xe8642a],
    ['popcorn_butter', 'バターポップコーン', 'Butter popcorn', 150, 0xf6e6a0, 0xd8342f],
    ['popcorn_caramel', 'キャラメルコーン', 'Caramel corn', 150, 0xe8a850, 0xd8342f],
    ['kaki_no_tane', '柿の種', 'Rice crackers & peanuts', 200, 0xe8864a, 0x2a2a30],
    ['arare', 'ぼんち揚', 'Fried rice crackers', 180, 0xd8a060, 0x8a2a1a],
  ]),
  ...F('gondola', 'snacks', 'box', 'box', [
    ['senbei_shoyu', 'しょうゆせんべい', 'Soy rice crackers', 220, 0x8a5a2a, 0xd8342f, { w: 0.14, h: 0.2, d: 0.05, style: 'senbei' }],
    ['senbei_salad', 'サラダせんべい', 'Salted rice crackers', 220, 0xf2ecd8, 0x3a8a4a, { w: 0.14, h: 0.2, d: 0.05, style: 'senbei' }],
    ['senbei_premium', '手焼き 黒胡椒', 'Hand-baked pepper crackers', 320, 0x2a2a30, 0xd8a830, { w: 0.14, h: 0.2, d: 0.05, style: 'senbei' }],
    ['pretzel', 'プリッツ風 サラダ', 'Pretzel sticks', 150, 0xf2ecd8, 0xd8342f, { w: 0.065, h: 0.16, d: 0.022 }],
    ['pretzel_tomato', 'プリッツ風 トマト', 'Pretzel sticks, tomato', 150, 0xd8342f, 0xf2ecd8, { w: 0.065, h: 0.16, d: 0.022 }],
    ['crackers', 'チーズクラッカー', 'Cheese crackers', 180, 0xf2c23c, 0x1e3a78, { w: 0.14, h: 0.1, d: 0.05 }],
  ]),
  ...F('gondola', 'snacks', 'pouch', 'soft', [
    ['nuts_mixed', 'ミックスナッツ', 'Mixed nuts', 300, 0x8a5a2a, 0xf2c23c],
    ['nuts_almond', '素焼きアーモンド', 'Roasted almonds', 320, 0xc88a4a, 0x2e5a3a],
    ['nuts_cashew', 'カシューナッツ', 'Cashew nuts', 320, 0xf2e0b0, 0x8a4a1a],
    ['nuts_pistachio', 'ピスタチオ', 'Pistachios', 380, 0x9ac060, 0x6a3a22],
    ['peanuts', 'バターピーナッツ', 'Butter peanuts', 200, 0xe8b868, 0xd8342f],
    ['dried_mango', 'ドライマンゴー', 'Dried mango', 350, 0xf2a830, 0xe8642a],
    ['edamame_snack', '枝豆スナック', 'Edamame crisps', 180, 0x9ad060, 0x2e5a3a],
    ['green_peas', 'えんどう豆スナック', 'Green-pea crisps', 150, 0x7ac04a, 0x2e5a3a],
    ['karinto', '黒糖かりんとう', 'Brown-sugar karintō', 200, 0x4a2a1a, 0xd8a830],
    ['veggie_chips', 'やさいチップス', 'Vegetable chips', 200, 0xe8864a, 0x3a8a4a],
    ['tortilla', 'トルティーヤチップス', 'Tortilla chips', 180, 0xf2c23c, 0x1e3a78],
    ['chips_party', 'うすしお パーティーサイズ', 'Potato chips, party size', 380, 0xf2c23c, 0xd8342f, { big: true }],
    ['instant_ramen_5', 'しょうゆラーメン 5食', 'Instant ramen (5 pack)', 480, 0xf2ecd8, 0xd8342f, { big: true }, { group: 'instant' }],
    ['instant_ramen_miso5', 'みそラーメン 5食', 'Miso ramen (5 pack)', 480, 0xf2ecd8, 0xc8742a, { big: true }, { group: 'instant' }],
  ]),
  ...F('gondola', 'snacks', 'cup', 'box', [
    ['jaga_stick', 'じゃがスティック サラダ', 'Potato sticks cup, salad', 150, 0x3a8a4a, 0xf2c23c, { r: 0.042, h: 0.1 }],
    ['jaga_stick_cheese', 'じゃがスティック チーズ', 'Potato sticks cup, cheese', 150, 0xe8a018, 0xd8342f, { r: 0.042, h: 0.1 }],
    ['jaga_stick_jaga', 'じゃがスティック バター', 'Potato sticks cup, butter', 150, 0xf2d870, 0x3a6ec8, { r: 0.042, h: 0.1 }],
  ]),
  // G1, the other side: chocolate, gummies, candy, biscuits
  ...F('gondola', 'sweets', 'slimbox', 'box', [
    ['choco_sticks', 'チョコスティック', 'Choco sticks', 180, 0xc83a3a, 0x5a2a1a],
    ['choco_sticks_ichigo', 'いちごスティック', 'Strawberry sticks', 180, 0xf2a0b8, 0xd8284a],
    ['choco_sticks_matcha', '抹茶スティック', 'Matcha sticks', 200, 0x6aa050, 0x2e5a3a],
    ['choco_sticks_almond', 'アーモンドクラッシュ', 'Almond crush sticks', 200, 0x3a2418, 0xd8a830],
  ]),
  ...F('gondola', 'sweets', 'smallbox', 'box', [
    ['choco_mushrooms', 'きのこチョコ', 'Choco mushrooms', 230, 0x5aa870, 0x6a3a22],
    ['choco_bamboo', 'たけのこチョコ', 'Choco bamboo shoots', 230, 0xd8342f, 0x6a3a22],
    ['choco_cubes', 'ひとくちチョコ', 'Bite-size chocolates', 150, 0x6a3a22, 0xd8a830],
    ['choco_ball', 'ピーナッツチョコボール', 'Choco balls', 130, 0xd8342f, 0xf2c23c],
    ['koala_biscuits', 'くまさんビスケット', 'Bear biscuits', 140, 0xf2c23c, 0x6a3a22],
    ['cookies_choco', 'チョコチップクッキー', 'Choco-chip cookies', 200, 0x3a6ec8, 0x6a3a22],
    ['butter_cookies', 'バタークッキー', 'Butter cookies', 220, 0xf2e0a0, 0x1e3a78],
    ['baumkuchen', 'ミニバウムクーヘン', 'Mini baumkuchen', 180, 0xe8b868, 0x6a3a22],
    ['wafers', 'ウエハース', 'Cream wafers', 150, 0xf2d8a0, 0xe8456a],
    ['mints', 'ミントタブレット', 'Mint tablets', 150, 0x6ac8d8, 0x1e3a78, { w: 0.05, h: 0.08, d: 0.02 }],
    ['gum', 'すっきりガム', 'Chewing gum', 150, 0x5aa870, 0xf2f2f2, { w: 0.07, h: 0.1, d: 0.02 }],
    ['chewy_grape', 'ソフトキャンディ ぶどう', 'Chewy candy, grape', 130, 0x8a4aa8, 0xf2f2f2, { w: 0.03, h: 0.12, d: 0.02 }],
    ['chewy_strawberry', 'ソフトキャンディ いちご', 'Chewy candy, strawberry', 130, 0xe8456a, 0xf2f2f2, { w: 0.03, h: 0.12, d: 0.02 }],
    ['chewy_apple', 'ソフトキャンディ りんご', 'Chewy candy, apple', 130, 0x7ac04a, 0xf2f2f2, { w: 0.03, h: 0.12, d: 0.02 }],
    ['caramel', 'ミルクキャラメル', 'Milk caramels', 120, 0xf2e0a0, 0x1e3a78, { w: 0.07, h: 0.035, d: 0.03 }],
    ['choco_pie', 'チョコパイ 6個', 'Choco pies (6)', 300, 0xd8342f, 0x6a3a22, { w: 0.2, h: 0.06, d: 0.1 }],
    ['marie', 'マリービスケット', 'Marie biscuits', 200, 0xe8b868, 0x1e3a78, { w: 0.14, h: 0.06, d: 0.05 }],
    ['baked_choco', '焼きチョコ', 'Baked chocolate bites', 230, 0x3a2418, 0xe8864a],
    ['matcha_cookie', '抹茶ラングドシャ', 'Matcha langue de chat', 280, 0x8ab060, 0xf2f2f2],
  ]),
  ...F('gondola', 'sweets', 'bar', 'soft', [
    ['choco_bar_milk', 'ミルクチョコレート', 'Milk chocolate bar', 130, 0x6a3a22, 0xd8342f],
    ['choco_bar_dark', 'カカオ72%', 'Dark chocolate 72%', 220, 0x2a1a10, 0xd8a830],
    ['choco_bar_white', 'ホワイトチョコ', 'White chocolate bar', 130, 0xf6f0e0, 0x3a6ec8],
    ['choco_bar_crunch', 'ブラックサンダー風バー', 'Choco crunch bar', 50, 0x1a1a20, 0xf2c23c],
    ['choco_bar_matcha', '抹茶チョコ', 'Matcha chocolate', 180, 0x8ab060, 0x2e5a3a],
    ['protein_bar', 'プロテインバー', 'Protein bar', 180, 0x3a3a48, 0xe8642a],
    ['choco_bar_strawberry', 'いちごチョコ', 'Strawberry chocolate', 150, 0xf2a0b8, 0xd8284a],
    ['choco_bar_almond', 'アーモンドチョコ', 'Almond chocolate', 200, 0x3a2418, 0xe8a018],
    ['corn_stick', 'コーンスティック めんたい', 'Corn stick, mentaiko', 20, 0xe8456a, 0xf2c23c],
    ['corn_stick_cheese', 'コーンスティック チーズ', 'Corn stick, cheese', 20, 0xf2c23c, 0x3a6ec8],
  ]),
  ...F('gondola', 'sweets', 'pouch', 'soft', [
    ['gummies', 'くだものグミ', 'Fruit gummies', 140, 0xc070b0, 0xf2c23c],
    ['gummies_grape', 'ぶどうグミ', 'Grape gummies', 140, 0x8a4aa8, 0xf2f2f2],
    ['gummies_cola', 'コーラグミ', 'Cola gummies', 140, 0x3a1e18, 0xd8282a],
    ['gummies_sour', 'すっぱいグミ', 'Sour gummies', 150, 0xf2e04a, 0x3a8a4a],
    ['gummies_peach', 'もものグミ', 'Peach gummies', 150, 0xf6c0c8, 0xe8456a],
    ['candy_milk', 'ミルクキャンディ', 'Milk candy', 180, 0xf6f6ee, 0x3a6ec8],
    ['candy_fruit', 'フルーツドロップ', 'Fruit drops', 180, 0xe8456a, 0xf2c23c],
    ['candy_nodo', 'のどあめ', 'Throat candy', 200, 0x3a8a4a, 0xf2f2f2],
    ['choco_bag_mini', 'ミニチョコ ファミリー', 'Mini chocolates bag', 350, 0x6a3a22, 0xe8456a],
  ]),
  // G2, the chilled-case side: medicine and health (医薬品)
  ...F('gondola', 'medicine', 'box', 'box', [
    ['med_stomach', '胃腸薬 顆粒', 'Stomach relief granules', 980, 0xf6f6f2, 0x2e8a5a, { w: 0.1, h: 0.13, d: 0.03, style: 'medicine', cls: 3 }],
    ['med_digest', '消化薬', 'Digestive tablets', 880, 0xf6f6f2, 0xe8864a, { w: 0.09, h: 0.12, d: 0.03, style: 'medicine', cls: 3 }],
    ['med_diarrhea', '整腸薬', 'Intestinal tablets', 780, 0xf6f6f2, 0x3a8ad0, { w: 0.09, h: 0.12, d: 0.03, style: 'medicine', cls: 3 }],
    ['med_cold', 'かぜ薬 錠剤', 'Cold tablets', 1280, 0xf6f6f2, 0xd8342f, { w: 0.1, h: 0.13, d: 0.03, style: 'medicine', cls: 2 }],
    ['med_fever', '解熱鎮痛薬', 'Fever & pain tablets', 980, 0xf6f6f2, 0x1e3a78, { w: 0.09, h: 0.12, d: 0.025, style: 'medicine', cls: 2 }],
    ['med_headache', '頭痛薬', 'Headache tablets', 880, 0xf6f6f2, 0x8a4aa8, { w: 0.09, h: 0.12, d: 0.025, style: 'medicine', cls: 2 }],
    ['med_kanpo', '漢方 葛根湯', 'Kakkonto (kanpō)', 1080, 0xf2ecd8, 0x8a2a1a, { w: 0.1, h: 0.13, d: 0.035, style: 'medicine', cls: 2 }],
    ['med_hangover', '二日酔いの友', 'Hangover granules', 680, 0xf6f6f2, 0xe8a018, { w: 0.08, h: 0.11, d: 0.025, style: 'medicine', cls: 3 }],
    ['vit_c', 'ビタミンC 30日分', 'Vitamin C (30 days)', 500, 0xf6f6f2, 0xf2c23c, { w: 0.08, h: 0.12, d: 0.02, style: 'medicine' }],
    ['vit_multi', 'マルチビタミン', 'Multivitamins', 600, 0xf6f6f2, 0xe8642a, { w: 0.08, h: 0.12, d: 0.02, style: 'medicine' }],
    ['vit_iron', '鉄分サプリ', 'Iron supplement', 500, 0xf6f6f2, 0xc8284a, { w: 0.08, h: 0.12, d: 0.02, style: 'medicine' }],
    ['eye_drops', 'すっきり目薬', 'Cooling eye drops', 680, 0xeaf4fa, 0x1e5ab8, { w: 0.05, h: 0.1, d: 0.025, style: 'medicine', cls: 3 }],
    ['eye_drops_dry', 'うるおい目薬', 'Dry-eye drops', 780, 0xeaf4fa, 0x6ab8e8, { w: 0.05, h: 0.1, d: 0.025, style: 'medicine', cls: 3 }],
    ['cooling_sheet', '冷却シート', 'Cooling gel sheets', 480, 0xeaf4fa, 0x2aa8c8, { w: 0.12, h: 0.16, d: 0.02, style: 'medicine' }],
    ['heat_pad', 'カイロ 10個', 'Hand warmers (10)', 480, 0xf6f0e8, 0xe8642a, { w: 0.14, h: 0.18, d: 0.04, style: 'medicine' }],
    ['masks', '不織布マスク 7枚', 'Face masks (7)', 350, 0xfafafa, 0x3a8ad0, { w: 0.13, h: 0.16, d: 0.03, style: 'medicine' }],
    ['masks_kids', '小さめマスク 7枚', 'Small face masks (7)', 350, 0xfafafa, 0xf2a0b8, { w: 0.12, h: 0.15, d: 0.03, style: 'medicine' }],
    ['muscle_patch', '温感湿布', 'Warming muscle patches', 780, 0xf6f6f2, 0xe8642a, { w: 0.14, h: 0.1, d: 0.02, style: 'medicine', cls: 3 }],
    ['itch_cream', 'かゆみ止めクリーム', 'Anti-itch cream', 680, 0xf6f6f2, 0x5aa870, { w: 0.05, h: 0.12, d: 0.03, style: 'medicine', cls: 3 }],
    ['antacid', '胃酸にチュアブル', 'Antacid chewables', 580, 0xf6f6f2, 0x6ab8e8, { w: 0.08, h: 0.1, d: 0.025, style: 'medicine', cls: 3 }],
    ['motion_sick', '酔い止め', 'Motion-sickness tablets', 780, 0xf6f6f2, 0x2aa8c8, { w: 0.08, h: 0.1, d: 0.025, style: 'medicine', cls: 2 }],
  ]),
  ...F('gondola', 'medicine', 'minibottle', 'bottle', [
    ['energy_shot', '滋養ドリンク', 'Tonic drink', 300, 0x6a3a1a, 0xf2c23c],
    ['energy_shot_gold', '滋養ドリンク ゴールド', 'Tonic drink gold', 600, 0x6a3a1a, 0xd8a830],
    ['liver_shot', 'ウコンの力水', 'Turmeric shot', 250, 0xd8a018, 0x1e3a78],
  ]),
  ...F('gondola', 'medicine', 'card', 'soft', [
    ['plasters', 'ばんそうこう 20枚', 'Plasters (20)', 380, 0xf2e0c8, 0xd8342f],
    ['plasters_clear', '透明ばんそうこう', 'Clear plasters', 420, 0xeaf4fa, 0x3a8ad0],
    ['lozenges', 'のどトローチ', 'Throat lozenges', 580, 0xeaf4fa, 0x2e8a5a],
    ['sanitizer', 'ハンドジェル', 'Hand sanitiser gel', 380, 0xeaf4fa, 0x6ab8e8],
  ]),
  // G2, the other side: cosmetics and personal care
  ...F('gondola', 'cosmetics', 'tube', 'soft', [
    ['face_wash', 'うるおい洗顔フォーム', 'Moist face wash', 480, 0xf6f6fa, 0x6ab8e8, { style: 'cosme' }],
    ['face_wash_clear', '毛穴すっきり洗顔', 'Pore-clear face wash', 480, 0xf6f6fa, 0x2e8a5a, { style: 'cosme' }],
    ['face_wash_men', 'メンズ洗顔', 'Men\'s face wash', 450, 0x2a2a30, 0x6ab8e8, { style: 'cosme' }],
    ['toothpaste', 'しろい歯みがき', 'Whitening toothpaste', 300, 0xf6f6fa, 0x3a8ad0, { style: 'cosme' }],
    ['toothpaste_mint', 'クールミント歯みがき', 'Cool-mint toothpaste', 280, 0xeaf6f2, 0x2aa8a0, { style: 'cosme' }],
    ['sunscreen', 'UVミルク SPF50', 'Sunscreen milk SPF50', 880, 0xf6f6ee, 0xf2a030, { style: 'cosme' }],
    ['hand_cream', 'ハンドクリーム', 'Hand cream', 480, 0xf6eef2, 0xe89aa8, { style: 'cosme' }],
  ]),
  ...F('gondola', 'cosmetics', 'pump', 'bottle', [
    ['lotion', 'しっとり化粧水', 'Hydrating lotion', 880, 0xf2f6fa, 0x6ab8e8, { style: 'cosme' }],
    ['lotion_light', 'さっぱり化粧水', 'Light lotion', 880, 0xf2faf6, 0x2e8a5a, { style: 'cosme' }],
    ['milk_emulsion', 'うるおい乳液', 'Moisturising milk', 980, 0xfaf6f0, 0xd8a870, { style: 'cosme' }],
    ['cleansing_oil', 'クレンジングオイル', 'Cleansing oil', 980, 0xfaf2d8, 0xd8a830, { style: 'cosme' }],
    ['cleansing_milk', 'ミルククレンジング', 'Cleansing milk', 880, 0xfaf6f2, 0xe89aa8, { style: 'cosme' }],
    ['body_lotion', 'ボディミルク', 'Body milk', 780, 0xf6f2fa, 0xa88ad0, { style: 'cosme' }],
    ['shampoo_travel', 'シャンプー トラベル', 'Travel shampoo', 380, 0xf6f6fa, 0x1e3a78, { style: 'cosme', small: true }],
    ['conditioner_travel', 'コンディショナー トラベル', 'Travel conditioner', 380, 0xf6f2ee, 0xd8342f, { style: 'cosme', small: true }],
    ['body_wash_travel', 'ボディソープ トラベル', 'Travel body wash', 380, 0xf2faf6, 0x2e8a5a, { style: 'cosme', small: true }],
    ['hair_spray', 'ヘアスプレー', 'Hair spray', 680, 0xf2f2f6, 0x6a4aa8, { style: 'cosme' }],
    ['perfume_mini', 'ミニフレグランス', 'Mini fragrance', 1320, 0xfaeef2, 0xc8284a, { style: 'cosme', small: true }],
    ['nail_remover', 'ネイルリムーバー', 'Nail polish remover', 480, 0xf6f6fa, 0xe8456a, { style: 'cosme', small: true }],
  ]),
  ...F('gondola', 'cosmetics', 'box', 'soft', [
    ['sheet_mask', 'うるおいシートマスク', 'Hydrating sheet mask', 380, 0xf2f6fa, 0x6ab8e8, { w: 0.12, h: 0.17, d: 0.008, style: 'cosme' }],
    ['sheet_mask_vc', 'ビタミンC シートマスク', 'Vitamin C sheet mask', 380, 0xfaf6e6, 0xf2a030, { w: 0.12, h: 0.17, d: 0.008, style: 'cosme' }],
    ['sheet_mask_cica', 'シカ シートマスク', 'Cica sheet mask', 380, 0xf2faf2, 0x5aa870, { w: 0.12, h: 0.17, d: 0.008, style: 'cosme' }],
    ['makeup_wipes', 'メイク落としシート', 'Make-up wipes', 450, 0xf6f6fa, 0xe8456a, { w: 0.14, h: 0.08, d: 0.04, style: 'cosme' }],
    ['deo_sheets', 'さらさらボディシート', 'Body-wipe sheets', 380, 0xeaf4fa, 0x2aa8c8, { w: 0.14, h: 0.08, d: 0.04, style: 'cosme' }],
    ['cotton_pads', 'コットン 80枚', 'Cotton pads (80)', 280, 0xfafafa, 0xe89aa8, { w: 0.1, h: 0.08, d: 0.06, style: 'cosme' }],
    ['cotton_swabs', '綿棒 200本', 'Cotton swabs (200)', 200, 0xfafafa, 0x6ab8e8, { w: 0.08, h: 0.08, d: 0.08, style: 'cosme' }],
    ['toothbrush', '歯ブラシ ふつう', 'Toothbrush (medium)', 250, 0xf6f6fa, 0x3a8ad0, { w: 0.05, h: 0.2, d: 0.02, style: 'cosme' }],
    ['toothbrush_travel', 'トラベル歯ブラシセット', 'Travel toothbrush set', 350, 0xf6f6fa, 0x2e8a5a, { w: 0.06, h: 0.18, d: 0.03, style: 'cosme' }],
    ['razor', 'T字カミソリ 3本', 'Razors (3)', 480, 0xeaf4fa, 0x1e3a78, { w: 0.08, h: 0.18, d: 0.03, style: 'cosme' }],
    ['steam_eye_mask', 'ホットアイマスク', 'Warm eye masks', 480, 0xf6eef2, 0xa88ad0, { w: 0.13, h: 0.15, d: 0.03, style: 'cosme' }],
    ['foot_sheet', 'あしリフレシート', 'Foot cooling sheets', 450, 0xeaf4fa, 0x2aa8a0, { w: 0.13, h: 0.15, d: 0.03, style: 'cosme' }],
  ]),
  ...F('gondola', 'cosmetics', 'card', 'soft', [
    ['lip_balm', '薬用リップ', 'Medicated lip balm', 380, 0xf6f6fa, 0x3a8ad0, { style: 'cosme' }],
    ['lip_balm_tint', '色つきリップ', 'Tinted lip balm', 550, 0xfaf0f2, 0xe8456a, { style: 'cosme' }],
    ['lip_tint_rose', 'リップティント ローズ', 'Lip tint, rose', 1100, 0xfaf0f2, 0xc8284a, { style: 'cosme' }],
    ['lip_tint_coral', 'リップティント コーラル', 'Lip tint, coral', 1100, 0xfaf2ee, 0xf28a6a, { style: 'cosme' }],
    ['lip_tint_berry', 'リップティント ベリー', 'Lip tint, berry', 1100, 0xf6eef4, 0x8a2a5a, { style: 'cosme' }],
    ['eyeliner', 'リキッドアイライナー', 'Liquid eyeliner', 990, 0xf2f2f6, 0x1a1a20, { style: 'cosme' }],
    ['mascara', 'ロングマスカラ', 'Lengthening mascara', 990, 0xf2f2f6, 0x3a2a4a, { style: 'cosme' }],
    ['brow_pencil', 'アイブロウペンシル', 'Eyebrow pencil', 880, 0xf6f2ee, 0x6a4a2a, { style: 'cosme' }],
    ['hair_ties', 'ヘアゴム 10本', 'Hair ties (10)', 300, 0xf6f6fa, 0x2a2a30, { style: 'cosme' }],
    ['nail_polish', 'ネイルカラー', 'Nail colour', 550, 0xfaf0f2, 0xd8284a, { style: 'cosme' }],
    ['hair_clips', 'ヘアピン', 'Hair pins', 300, 0xf6f6fa, 0xd8a830, { style: 'cosme' }],
  ]),
  ...F('gondola', 'cosmetics', 'compact', 'box', [
    ['bb_cream', 'BBクリーム', 'BB cream', 1100, 0xf2e6d8, 0xd8a870, { style: 'cosme' }],
    ['powder', 'フェイスパウダー', 'Face powder', 1100, 0xfaf2ea, 0xe8c0a0, { style: 'cosme' }],
    ['eye_palette', 'アイパレット', 'Eye palette', 1320, 0xf6eee8, 0xa8646a, { style: 'cosme' }],
    ['concealer', 'コンシーラー', 'Concealer', 990, 0xf6ece0, 0xc89a70, { style: 'cosme' }],
    ['hair_wax', 'ヘアワックス', 'Hair wax', 880, 0xf2f2f6, 0x1a1a20, { style: 'cosme' }],
    ['cheek', 'チーク ピーチ', 'Blush, peach', 990, 0xfaeeea, 0xf2a0a0, { style: 'cosme' }],
  ]),
  // G3, the chilled-case side: daily goods
  ...F('gondola', 'daily', 'tissue', 'soft', [
    ['tissues', 'ポケットティッシュ', 'Pocket tissues', 100, 0xf2f2f6, 0x6ab8e8],
    ['tissues_box', 'ボックスティッシュ', 'Box tissues', 250, 0xf2f2f6, 0x3a8a4a, { big: true }],
    ['wet_tissues', 'ウェットティッシュ', 'Wet wipes', 200, 0xeaf4fa, 0x2aa8c8],
    ['wet_tissues_alc', 'アルコール除菌シート', 'Alcohol wipes', 250, 0xeaf4fa, 0x1e5ab8],
  ]),
  ...F('gondola', 'daily', 'box', 'soft', [
    ['socks_black', 'ソックス 黒', 'Socks, black', 590, 0x2a2a30, 0x6ab8e8, { w: 0.1, h: 0.22, d: 0.02, style: 'wear' }],
    ['socks_white', 'ソックス 白', 'Socks, white', 590, 0xf6f6f2, 0x2a2a30, { w: 0.1, h: 0.22, d: 0.02, style: 'wear' }],
    ['socks_navy', 'ソックス 紺', 'Socks, navy', 590, 0x1e2a48, 0xf2f2f2, { w: 0.1, h: 0.22, d: 0.02, style: 'wear' }],
    ['tshirt', '綿Tシャツ', 'Cotton T-shirt', 990, 0xf6f6f2, 0x1e3a78, { w: 0.18, h: 0.24, d: 0.03, style: 'wear' }],
    ['boxers', 'ボクサーパンツ', 'Boxer briefs', 990, 0x2a2a30, 0x3a8ad0, { w: 0.16, h: 0.2, d: 0.03, style: 'wear' }],
    ['towel', 'フェイスタオル', 'Face towel', 550, 0xf6f6f2, 0x6ab8e8, { w: 0.16, h: 0.2, d: 0.04, style: 'wear' }],
    ['trash_bags', 'ゴミ袋 45L', 'Rubbish bags 45L', 280, 0xeaf4fa, 0x2a2a30, { w: 0.14, h: 0.18, d: 0.04 }],
    ['detergent_mini', '洗濯洗剤 ミニ', 'Laundry detergent, mini', 250, 0xeaf4fa, 0x1e5ab8, { w: 0.08, h: 0.14, d: 0.05 }],
    ['notebook', 'キャンパスノート風', 'Notebook A5', 180, 0xf6f6f2, 0x3a6ec8, { w: 0.15, h: 0.21, d: 0.008 }],
    ['envelopes', '封筒 10枚', 'Envelopes (10)', 150, 0xf2e6c8, 0x8a4a1a, { w: 0.12, h: 0.23, d: 0.01 }],
    ['lighter', '使い捨てライター', 'Disposable lighter', 150, 0xe8456a, 0x2a2a30, { w: 0.025, h: 0.08, d: 0.012 }],
    ['toilet_paper', 'トイレットペーパー 4ロール', 'Toilet paper (4 rolls)', 450, 0xf6f6fa, 0x6ab8e8, { w: 0.24, h: 0.12, d: 0.12 }],
    ['kitchen_paper', 'キッチンペーパー 2ロール', 'Kitchen paper (2 rolls)', 350, 0xf6f6fa, 0x3a8a4a, { w: 0.24, h: 0.12, d: 0.12 }],
    ['cling_wrap', '食品用ラップ', 'Cling film', 300, 0xf6f6fa, 0x1e5ab8, { w: 0.24, h: 0.05, d: 0.05 }],
    ['alu_foil', 'アルミホイル', 'Aluminium foil', 300, 0xd8dce4, 0xd8342f, { w: 0.24, h: 0.05, d: 0.05 }],
    ['zip_bags', 'ジッパー付き袋', 'Zip bags', 250, 0xeaf4fa, 0x1e5ab8, { w: 0.13, h: 0.17, d: 0.02 }],
    ['sponge', 'キッチンスポンジ', 'Kitchen sponge', 150, 0xf2e04a, 0x3a8a4a, { w: 0.08, h: 0.12, d: 0.04 }],
    ['slippers', '使い捨てスリッパ', 'Disposable slippers', 300, 0xf6f6f2, 0x6a4a2a, { w: 0.12, h: 0.26, d: 0.02, style: 'wear' }],
    ['stockings', 'ストッキング', 'Stockings', 450, 0xd8b8a0, 0x2a2a30, { w: 0.14, h: 0.2, d: 0.02, style: 'wear' }],
  ]),
  ...F('gondola', 'daily', 'card', 'soft', [
    ['batteries_aa', '乾電池 単3 4本', 'AA batteries (4)', 450, 0x2a2a30, 0xf2c23c, { style: 'tech' }],
    ['batteries_aaa', '乾電池 単4 4本', 'AAA batteries (4)', 450, 0x2a2a30, 0xe8642a, { style: 'tech' }],
    ['cable_c', 'USB-C ケーブル 1m', 'USB-C cable 1m', 1500, 0xf6f6f2, 0x1e3a78, { style: 'tech' }],
    ['cable_light', '充電ケーブル 1m', 'Phone cable 1m', 1500, 0xf6f6f2, 0x2a2a30, { style: 'tech' }],
    ['charger', 'USB充電器', 'USB charger', 1980, 0xf6f6f2, 0x3a8ad0, { style: 'tech' }],
    ['earphones', 'イヤホン', 'Earphones', 1100, 0xf6f6f2, 0x6a4aa8, { style: 'tech' }],
    ['pen_black', 'ボールペン 黒', 'Ballpoint pen, black', 150, 0xf6f6f2, 0x1a1a20, { style: 'tech' }],
    ['pen_red', 'ボールペン 赤', 'Ballpoint pen, red', 150, 0xf6f6f2, 0xd8342f, { style: 'tech' }],
    ['tape', 'セロハンテープ', 'Sticky tape', 200, 0xf6f6f2, 0xe8a018, { style: 'tech' }],
    ['glue', 'スティックのり', 'Glue stick', 180, 0xf6f6f2, 0x3a8a4a, { style: 'tech' }],
    ['sticky_notes', 'ふせん', 'Sticky notes', 250, 0xf6f6f2, 0xf2d02a, { style: 'tech' }],
    ['scissors', 'はさみ', 'Scissors', 400, 0xf6f6f2, 0xd8342f, { style: 'tech' }],
    ['masking_tape', 'マスキングテープ', 'Masking tape', 200, 0xf6f6f2, 0xe89aa8, { style: 'tech' }],
    ['sewing_kit', 'ソーイングセット', 'Sewing kit', 450, 0xf6f6f2, 0x8a4aa8, { style: 'tech' }],
    ['phone_stand', 'スマホスタンド', 'Phone stand', 800, 0xf6f6f2, 0x2a2a30, { style: 'tech' }],
  ]),
  // G3, the other side: wine, sake, spirits, and what goes with them
  ...F('gondola', 'liquor', 'pouch', 'soft', [
    ['otsumami', 'さきいか', 'Dried squid snack', 280, 0xf2ecd8, 0xc83a3a],
    ['jerky', 'ビーフジャーキー', 'Beef jerky', 400, 0x6a2a1a, 0xd8a830],
    ['cheese_kama', 'チーズかまぼこ', 'Cheese fish sticks', 250, 0xf2d870, 0xd8342f],
    ['surume', 'あたりめ', 'Grilled squid', 380, 0xe8dcc0, 0x1e3a78],
    ['smoked_nuts', '燻製ナッツ', 'Smoked nuts', 350, 0x5a3a2a, 0xe8864a],
    ['kaki_peanut_big', '柿ピー 大袋', 'Crackers & peanuts, big', 380, 0xe8864a, 0x2a2a30],
    ['iburi_cheese', 'いぶりがっこチーズ', 'Smoked pickle & cheese', 400, 0xf2e6a0, 0x6a3a22],
  ]),
  ...F('gondola', 'liquor', 'milk1l', 'paper', [
    ['sake_pack', '清酒 パック 900ml', 'Sake carton 900ml', 780, 0xf6f2e6, 0x1e3a78],
    ['sake_pack_dry', '辛口 パック 900ml', 'Dry sake carton 900ml', 780, 0xf6f2e6, 0x2a2a30],
    ['shochu_pack', '麦焼酎 パック 900ml', 'Barley shochu carton', 980, 0xf2ecd8, 0x8a5a2a],
    ['mirin_pack', '本みりん 500ml', 'Mirin 500ml', 450, 0xf2e6c0, 0xd8a830],
  ]),
  ...F('gondola', 'liquor', 'pet', 'bottle', [
    ['tonic_water', 'トニックウォーター', 'Tonic water', 150, 0xeef4f8, 0x1e5a8a],
    ['soda_water_amb', '割り材 炭酸水', 'Mixer soda water', 120, 0xeef4f8, 0x2a8a5a],
    ['lemon_sour_base', 'レモンサワーの素', 'Lemon sour base', 580, 0xf6e880, 0x2a6a3a],
    ['ume_liqueur', '梅酒 500ml', 'Plum wine 500ml', 680, 0xd8b050, 0x8a2a3a],
  ]),
  ...F('gondola', 'liquor', 'pet2l', 'bottle', [
    ['shochu_big', '甲類焼酎 1.8L', 'Shochu 1.8L', 1680, 0xeef4f8, 0x1e3a78],
    ['whisky_big', 'こはく 1.92L', 'Kohaku whisky 1.92L', 2980, 0xb8702a, 0x1a1a20],
  ]),
  ...F('gondola', 'liquor', 'sakecup', 'bottle', [
    ['sake_cup', 'ワンカップ富士', 'One-cup sake', 250, 0xe8f0f4, 0x1e3a78],
    ['sake_cup_dry', 'ワンカップ 辛口', 'One-cup sake, dry', 250, 0xe8f0f4, 0x2a2a30],
    ['shochu_cup', '麦焼酎カップ', 'Barley shochu cup', 280, 0xe8f0f4, 0x8a5a2a],
  ]),
  ...F('gondola', 'liquor', 'whisky', 'bottle', [
    ['whisky', 'こはく 180ml', 'Kohaku whisky', 520, 0xb8702a, 0x1a1a20],
    ['whisky_black', 'こはく ブラック', 'Kohaku black', 680, 0x8a4a1a, 0x1a1a20],
    ['gin_small', 'ジン 180ml', 'Craft gin 180ml', 780, 0xe8f0f4, 0x1e5a8a],
  ]),
  ...F('gondola', 'liquor', 'wine', 'bottle', [
    ['wine_red', 'ぶどう畑の赤', 'Vineyard red', 680, 0x3a1a24, 0xf2ecd8],
    ['wine_rose', 'ぶどう畑のロゼ', 'Vineyard rosé', 680, 0xd87a8a, 0xf2ecd8],
    ['wine_chile', 'チリの赤', 'Chilean red', 580, 0x2a1018, 0xd8a830],
    ['wine_italy', 'イタリアの白', 'Italian white', 780, 0xc8c880, 0x1e3a78],
    ['wine_white', 'ぶどう畑の白', 'Vineyard white', 680, 0xd8d8a0, 0xf2ecd8],
    ['wine_sparkling', 'スパークリング', 'Sparkling wine', 880, 0x2a4a2a, 0xd8b070],
    ['sake_bottle', '純米酒 富士', 'Junmai sake', 980, 0x2a4a3a, 0xf2ecd8],
    ['umeshu_bottle', 'とろり梅酒', 'Plum wine', 780, 0xc89040, 0xf2ecd8],
  ]),

  /* ============================ ice and frozen ============================ */
  ...F('frozen', 'ice', 'icecup', 'plastic', [
    ['ice_vanilla', 'ミルクバニラ', 'Milk vanilla', 300, 0xf6ecd0, 0x8a1a2a],
    ['ice_choco', 'ショコラ濃厚', 'Rich chocolate', 300, 0x5a3020, 0x2a1a14],
    ['ice_matcha', '濃い抹茶', 'Rich matcha', 300, 0x9ac070, 0x1e4a2a],
    ['ice_strawberry', 'とろける苺', 'Melting strawberry', 300, 0xf2b0c0, 0xa8142a],
    ['ice_cookie', 'クッキー&クリーム', 'Cookies & cream', 300, 0xe8e0d0, 0x2a2a30],
  ]),
  ...F('frozen', 'ice', 'icebar', 'plastic', [
    ['ice_soda_bar', 'ソーダバー', 'Soda ice bar', 90, 0x6ac8ec, 0x1e5ab8],
        ['ice_milk_bar', 'ミルクバー', 'Milk ice bar', 90, 0xf6f6ee, 0x3a8ad0],
    ['ice_azuki_bar', 'あずきバー', 'Red-bean ice bar', 90, 0x8a2a3a, 0xf2ecd8],
    ['ice_grape_bar', 'ぶどうバー', 'Grape ice bar', 90, 0x8a4aa8, 0xf2f2f2],
  ]),
  // Choco Wafer Jumbo (Tan's experience): the wafer-sandwich ice in its wrapper, a homage
  ...F('frozen', 'ice', 'wafer', 'plastic', [
    ['choco_wafer_jumbo', 'チョコウエハース ジャンボ', 'Choco Wafer Jumbo', 190, 0x4a2a1c, 0xe89a1a],
  ]),
  ...F('frozen', 'ice', 'mochi', 'plastic', [
    ['ice_mochi', 'もちもちアイス', 'Mochi ice pair', 160, 0xf2f2ea, 0xd8342f],
    ['ice_monaka', 'あんこモナカ', 'Monaka ice', 180, 0xd8a060, 0x8a2a3a],
  ]),
  ...F('frozen', 'ice', 'cone', 'plastic', [
    ['soft_cream', 'ソフトクリーム', 'Soft-serve cone', 240, 0xfaf6ee, 0x3a8ad0],
    ['cone_choco', 'チョコクランチコーン', 'Choco crunch cone', 180, 0x6a3a22, 0xd8342f],
  ]),
  ...F('frozen', 'ice', 'cup', 'plastic', [
    ['kakigori', 'かき氷アイス', 'Shaved-ice cup', 180, 0xe8453f, 0x3a8ad0, { r: 0.045, h: 0.07 }],
    ['kakigori_melon', 'かき氷 メロン', 'Shaved ice, melon', 180, 0x6ad86a, 0x2a8a3a, { r: 0.045, h: 0.07 }],
  ]),
  ...F('frozen', 'ice', 'multipack', 'box', [
    ['ice_multipack', 'ファミリーパック', 'Family pack', 450, 0x3a8ad0, 0xf2c23c],
    ['ice_multipack_choco', 'チョコバー 6本', 'Choco bars (6)', 450, 0x5a3020, 0xd8a830],
  ]),
  ...F('frozen', 'frozen', 'icebag', 'plastic', [
    ['ice_bag', 'かち割り氷', 'Bag of ice', 200, 0xe8f4fa, 0x3a8ad0],
  ]),
  ...F('frozen', 'frozen', 'box', 'box', [
    ['frozen_gyoza', '冷凍 焼き餃子', 'Frozen gyoza', 380, 0xf2ecd8, 0xd8342f, { w: 0.2, h: 0.04, d: 0.14 }],
    ['frozen_fried_rice', '冷凍 チャーハン', 'Frozen fried rice', 350, 0xe8c888, 0xc8342f, { w: 0.18, h: 0.05, d: 0.14 }],
    ['frozen_udon', '冷凍 さぬきうどん', 'Frozen udon', 300, 0xf6f6ee, 0x3a8ad0, { w: 0.18, h: 0.04, d: 0.16 }],
    ['frozen_karaage', '冷凍 唐揚げ', 'Frozen karaage', 400, 0xe8a850, 0xe8642a, { w: 0.2, h: 0.05, d: 0.14 }],
    ['frozen_edamame', '冷凍 枝豆', 'Frozen edamame', 300, 0x9ad060, 0x2e5a3a, { w: 0.18, h: 0.04, d: 0.14 }],
  ]),

  /* ============================ the counter, and more ============================ */
  // hot (ask the clerk, M5)
  P('karaage', 'からあげ（5個）', 'Karaage (5 pc)', 238, 'hot', 'hot', { shape: 'karaagebox', body: 0xe8453f, band: 0xf2c23c }, 'paper'),
  P('nikuman', '肉まん', 'Nikuman', 180, 'hot', 'hot', { shape: 'bun', body: 0xfbf7ee, band: 0xd8342f }, 'soft'),
  P('oden', 'おでんセット', 'Oden set', 320, 'hot', 'hot', { shape: 'odencup', body: 0xf6f2ea, band: 0x8a5a2a }, 'paper'),
  P('hot_coffee', 'ホットコーヒー（R）', 'Hot coffee (R)', 120, 'coffee', 'coffee', { shape: 'coffeecup', body: 0xfbf8f2, band: 0x6a3a22 }, 'paper'),
  P('umbrella', 'ビニール傘', 'Clear umbrella', 650, 'daily', 'umbrella', { shape: 'umbrella', body: 0xe8f2f8, band: 0x2a2a30 }, 'plastic'),
  // make your own (the smoothie freezer)
  ...F('selfserve', 'selfserve', 'fruitcup', 'plastic', [
    ['smoothie_mango', 'マンゴースムージー', 'Mango smoothie cup', 350, 0xf2b830, 0xe8864a],
    ['smoothie_berry', 'ベリースムージー', 'Berry smoothie cup', 350, 0xc8305a, 0x8a2a5a],
    ['smoothie_green', 'グリーンスムージー', 'Green smoothie cup', 350, 0x8ac848, 0x3a8a4a],
    ['smoothie_banana', 'バナナスムージー', 'Banana smoothie cup', 350, 0xf2e070, 0xe8a018],
    ['ice_cup', 'アイスコーヒー用カップ', 'Iced-coffee ice cup', 110, 0xe8f4fa, 0x6a3a22],
  ]),
];

/* The things to choose (Tan's konbini: keys 1-5 at the door), the rest of
 * the range scenery.  `ids` what that place offers (the sando case offers
 * two, side by side); world/store/planogram.js gives them a shelf of their
 * own at eye level, and store/shop.js lists and plays them. */
export const FEATURED = [
  { key: 'sando', ids: ['sando_egg', 'fruit_sando'] },
  { key: 'onigiri', ids: ['onigiri_tuna'] },
  { key: 'chuhi', ids: ['strong_nine'] },
  { key: 'ice', ids: ['choco_wafer_jumbo'] },
];

export const PRODUCT = Object.fromEntries(CATALOG.map((p) => [p.id, p]));
/** Products by group, in catalogue order (the planogram fills from these). */
export const GROUP = CATALOG.reduce((m, p) => ((m[p.group] ??= []).push(p.id), m), {});
