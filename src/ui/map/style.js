/* ------------------------------------------------------------------ *
 * The town map's colours (map 2.0): the game's pastels on warm paper,
 * soft lilac-grey ink for every edge (core/palette.js ink, lightened), no
 * pure black or white.  One place, so the map is one palette.
 * ------------------------------------------------------------------ */

/** The map's ink (palette.js inkSoft, warmed) at an opacity. */
const ink = (a) => `rgba(90,80,110,${a})`;

export const M = {
  paper: '#f1ebdd',
  ground: '#ebe4d3',
  garden: '#e6e5cf',          // a house's lot: garden and yard
  yard: '#ece5d8',            // a shop's lot: paved
  shadow: 'rgba(72,60,96,0.2)',
  clear: 'rgba(255,255,255,0)', sky: 'rgba(255,255,255,0.38)', vignette: 'rgba(150,130,100,0.2)',

  // green
  meadow: '#dde5c4', meadowFade: 'rgba(221,229,196,0.15)',
  tuft: 'rgba(110,140,90,0.55)', tuftDry: 'rgba(150,140,90,0.6)',
  park: '#cfe0b4', parkEdge: '#a9c190',
  vacant: '#e3dcb8',
  lawn: '#d4e2b8',
  promenade: '#e9e3d8', promEdge: ink(0.5),

  // water
  water: '#a9cfe0', waterDeep: '#8fbcd3', waterEdge: '#6f9fbe', waterLine: 'rgba(255,255,255,0.55)',
  pond: '#8fbfd0', pondLight: '#bcdce6',

  // the river's channel
  walk: '#e4dcd6', lowWalk: '#e7dfcf', bankGrass: '#cddcaf',
  revet: '#d3cbcb', revetHatch: ink(0.4), rail2: ink(0.55), parapet: ink(0.65),
  stair: '#e9e3dc', stairLine: ink(0.6),
  stone: '#d8d2ca', stoneEdge: ink(0.5),

  // paved places
  lot: '#dcd8e0', lotEdge: ink(0.35), bayLine: 'rgba(255,255,255,0.9)',
  plaza: '#f3dfe1', plazaGrid: 'rgba(200,150,165,0.35)',
  gravel: '#efe7d6', sando: '#ddd3c2', torii: '#d9573f',
  forecourt: '#e2dee6',
  concrete: '#dcd8d6', concreteEdge: ink(0.45),

  // the paddies: each kind of plot (`rows`: mark spacing across, along, and its size), its paths
  levee: '#c9b38f', ridge: '#bfa983', ridgeTop: '#e2d2ae',
  plot: {
    flood: { fill: '#b6d6e0', sky: 1 },
    seed: { fill: '#bcdad0', sky: 1, mark: '#7fae7a', rows: [1.1, 0.8, 0.24, 0.24] },
    plough: { fill: '#d6bea0', mark: 'rgba(150,115,80,0.45)', rows: [0.75, 99, 0.18, 99] },
    renge: { fill: '#e2cde0', mark: '#c996c6', rows: [0.7, 0.7, 0.3, 0.3] },
    fallow: { fill: '#d3dcb0' },
  },

  // the railway
  ballast: '#dcd6dc', ballastEdge: ink(0.4), sleeper: '#b9b1be', railSteel: '#6b6477',
  platform: '#efe9e3', platformEdge: ink(0.5), tactile: '#f0c341',
  gateYellow: '#f2c53d', gateBlack: '#3a3448',

  // roads: the main road ranked warm, the shopping street rose, lanes paper-white
  kerb: '#b9b0c3', pavement: '#e5e0e7',
  roadCase: { main: '#b49e7c', shopping: '#c9a7ae', lane: '#c3bccb' },
  roadFill: { main: '#f6e4ad', shopping: '#f7e0e1', lane: '#fbf9f3' },
  centre: 'rgba(255,255,255,0.95)',
  zebraBack: '#8a849c', zebraBar: '#fbf9f3',

  // trees: each crown's colour and its lit side
  treeShadow: 'rgba(70,70,100,0.16)',
  tree: {
    sakura: ['#f3bcd0', '#fde3ec'],
    zelkova: ['#b7d69a', '#dcecc4'],
    camphor: ['#9fc38c', '#c9e0b3'],
    maple: ['#b9d890', '#e0efc2'],
    mapleRed: ['#e0957c', '#f5c6b2'],
    pine: ['#8fb09a', '#bcd4c0'],
    grove: ['#a8c794', '#d0e4bd'],
    pad: ['#a6c893'],
  },
};

/* Roofs by what the building is.  Houses in the town's own muted tile and
 * sheet colours (palette.js roofSlate, roofBlue, roofBrown, roofTeal,
 * lifted to a map's pastel), each a little different; shops flat and pale
 * with their awning's colour along the street. */
const HOUSE = ['#a9aec2', '#9fb0c4', '#b9a9ab', '#a3b8b6', '#b3b0bf', '#c0aea0'];
const AWNING = ['#e39a8c', '#8fb3d3', '#e8c070', '#9cc3a2', '#d3a3c4', '#e7a86f'];
const SHOP = ['#efe3cf', '#ebe0d8', '#e9e2d2'];

/** A colour darkened (k < 1) or lightened (k > 1). */
const mix = (hex, k) => `rgb(${[16, 8, 0].map((s) => Math.round(Math.min(255, ((parseInt(hex.slice(1), 16) >> s) & 255) * k)))})`;
/** A pitched roof in one colour: its shaded slope, its eaves, its ridge. */
const pitched = (f, hip) => ({ fill: f, shade: mix(f, 0.9), edge: mix(f, 0.74), ridge: mix(f, 1.16), pitched: 1, hip });

export function roofStyle(kind, seed) {
  const s = Math.abs(Math.round(seed)) || 1;
  return {
    konbini: { fill: '#2f7cc2', edge: '#1d5a94', ridge: 'rgba(255,255,255,0.5)', front: '#f4f6fb', frontT: 0.8 },
    mega: { fill: '#f4d36a', edge: '#b8902c', ridge: 'rgba(160,110,20,0.45)', front: '#e0574a', frontT: 1.4 },
    station: { fill: '#b7cdb9', edge: '#7f9a86', ridge: 'rgba(80,110,90,0.5)' },
    apartment: { fill: '#d6dbe4', edge: '#98a0b2', ridge: ink(0.5), shade: ink(0.3), stripes: 1 },
    modern: { fill: '#e2e0e6', edge: '#a8a3b3', ridge: ink(0.45) },
    shop: { fill: SHOP[s % 3], edge: '#b9ab98', ridge: 'rgba(150,135,120,0.45)', front: AWNING[s % 6], frontT: 1.0 },
    hall: pitched('#8e96a8', 1),
    old: pitched(['#9aa0b4', '#8f97aa'][s % 2], 1),
  }[kind] ?? pitched(HOUSE[s % 6], kind === 'mortar' || kind === 'terrace');
}
