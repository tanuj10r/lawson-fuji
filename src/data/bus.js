/* The community bus and its stop on the station plaza (world/line/busstop.js): our own line, round the town.
 * Kept out of data/town.js on purpose: the brush font is cut from that file alone (scripts/subset-fonts.mjs),
 * and nothing here is brushed. */
export const BUS = {
  line: 'ふじみ号', kind: 'コミュニティバス', stop: '富士川口湖駅前', bay: '1',
  loop: ['駅前', '商店街', 'ニッポン前', '湖畔公園', 'ふじみ稲荷', '役場前'],
  fare: 'おとな 100円 ・ こども 50円',
};
