/* ------------------------------------------------------------------ *
 * The town map's colours (map 2.0): the game's pastels on warm paper,
 * soft lilac-grey ink for every edge (core/palette.js ink, lightened), no
 * pure black or white.  One place, so the map is one palette.
 * ------------------------------------------------------------------ */

export const M = {
  paper: '#f1ebdd',
  ground: '#ebe4d3',
  garden: '#e6e5cf',          // a house's lot: garden and yard
  yard: '#ece5d8',            // a shop's lot: paved
  shadow: 'rgba(72,60,96,0.2)',

  // green
  meadow: '#dde5c4', meadowFade: 'rgba(221,229,196,0.15)',
  tuft: 'rgba(110,140,90,0.55)', tuftDry: 'rgba(150,140,90,0.6)',
  park: '#cfe0b4', parkEdge: '#a9c190', sand: '#eadcb4',
  vacant: '#e3dcb8',
  lawn: '#d4e2b8',
  promenade: '#e9e3d8', promEdge: 'rgba(120,110,130,0.5)',

  // water
  water: '#a9cfe0', waterDeep: '#8fbcd3', waterEdge: '#6f9fbe', waterLine: 'rgba(255,255,255,0.55)',
  pond: '#8fbfd0', pondLight: '#bcdce6', pondRing: 'rgba(255,255,255,0.5)',

  // the river's channel
  walk: '#e4dcd6', lowWalk: '#e7dfcf', bankGrass: '#cddcaf',
  revet: '#d3cbcb', revetHatch: 'rgba(110,98,120,0.45)', rail2: 'rgba(90,80,110,0.55)',
  stair: '#e9e3dc', stairLine: 'rgba(110,98,120,0.6)',
  stone: '#d8d2ca', stoneEdge: 'rgba(90,80,110,0.5)',

  // paved places
  lot: '#dcd8e0', lotEdge: 'rgba(110,100,130,0.35)', bayLine: 'rgba(255,255,255,0.9)',
  plaza: '#f3dfe1', plazaGrid: 'rgba(200,150,165,0.35)',
  gravel: '#efe7d6', sando: '#ddd3c2', torii: '#d9573f',
  forecourt: '#e2dee6',
  concrete: '#dcd8d6', concreteEdge: 'rgba(110,100,130,0.45)',

  // the paddies: each kind of plot, its paths
  levee: '#c9b38f', ridge: '#bfa983', ridgeTop: '#e2d2ae',
  rengeLeaf: '#a9c28a',
  plot: {
    flood: { fill: '#b6d6e0', edge: 'rgba(90,130,150,0.35)' },
    seed: { fill: '#bcdad0', edge: 'rgba(90,130,120,0.35)', mark: '#7fae7a' },
    plough: { fill: '#d6bea0', edge: 'rgba(130,100,70,0.35)', mark: 'rgba(150,115,80,0.45)' },
    renge: { fill: '#e2cde0', edge: 'rgba(140,100,140,0.35)', mark: '#c996c6' },
    fallow: { fill: '#d3dcb0', edge: 'rgba(120,140,90,0.35)' },
  },

  // the railway
  ballast: '#dcd6dc', ballastEdge: 'rgba(100,90,120,0.4)', sleeper: '#b9b1be', railSteel: '#6b6477',
  platform: '#efe9e3', platformEdge: 'rgba(100,90,120,0.5)', tactile: '#f0c341',
  gateYellow: '#f2c53d', gateBlack: '#3a3448',

  // roads: the main road ranked warm, the shopping street rose, lanes paper-white
  kerb: '#b9b0c3', pavement: '#e5e0e7',
  roadCase: { main: '#b49e7c', shopping: '#c9a7ae', lane: '#c3bccb' },
  roadFill: { main: '#f6e4ad', shopping: '#f7e0e1', lane: '#fbf9f3' },
  centre: 'rgba(255,255,255,0.95)',
  zebraBack: '#8a849c', zebraBar: '#fbf9f3',
  parapet: 'rgba(80,70,100,0.6)',

  // trees: fill, and the lit side of each cushion
  treeShadow: 'rgba(70,70,100,0.16)',
  tree: {
    sakura: { fill: '#f3bcd0', lit: '#fde3ec' },
    zelkova: { fill: '#b7d69a', lit: '#dcecc4' },
    camphor: { fill: '#9fc38c', lit: '#c9e0b3' },
    maple: { fill: '#b9d890', lit: '#e0efc2' },
    mapleRed: { fill: '#e0957c', lit: '#f5c6b2' },
    pine: { fill: '#8fb09a', lit: '#bcd4c0' },
    grove: { fill: '#a8c794', lit: '#d0e4bd' },
    pad: { fill: '#a6c893' },
  },
};

/* Roofs by what the building is.  Houses in the town's own muted tile and
 * sheet colours (palette.js roofSlate, roofBlue, roofBrown, roofTeal,
 * lifted to a map's pastel), each a little different; shops flat and pale
 * with their awning's colour along the street. */
const HOUSE = ['#a9aec2', '#9fb0c4', '#b9a9ab', '#a3b8b6', '#b3b0bf', '#c0aea0'];
const AWNING = ['#e39a8c', '#8fb3d3', '#e8c070', '#9cc3a2', '#d3a3c4', '#e7a86f'];

const mix = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(Math.max(0, Math.min(255, v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

export function roofStyle(kind, seed = 0) {
  const s = Math.abs(Math.round(seed)) || 1;
  switch (kind) {
    case 'konbini': return { fill: '#2f7cc2', edge: '#1d5a94', ridge: 'rgba(255,255,255,0.5)', front: '#f4f6fb', frontT: 0.8 };
    case 'mega': return { fill: '#f4d36a', edge: '#b8902c', ridge: 'rgba(160,110,20,0.45)', front: '#e0574a', frontT: 1.4 };
    case 'station': return { fill: '#b7cdb9', edge: '#7f9a86', ridge: 'rgba(80,110,90,0.5)', front: null };
    case 'apartment': return { fill: '#d6dbe4', edge: '#98a0b2', ridge: 'rgba(110,118,140,0.55)', shade: 'rgba(110,118,140,0.35)', stripes: true };
    case 'hall': return { fill: '#8e96a8', shade: '#7d8598', edge: '#646b80', ridge: '#c9ccd6', pitched: true, hip: true };
    case 'shop': {
      const base = ['#efe3cf', '#ebe0d8', '#e9e2d2'][s % 3];
      return { fill: base, edge: mix('#b9ab98', 1), ridge: 'rgba(150,135,120,0.45)', front: AWNING[s % AWNING.length], frontT: 1.0 };
    }
    case 'modern': return { fill: '#e2e0e6', edge: '#a8a3b3', ridge: 'rgba(130,125,145,0.5)' };
    case 'old': {
      const f = ['#9aa0b4', '#8f97aa'][s % 2];
      return { fill: f, shade: mix(f, 0.9), edge: mix(f, 0.72), ridge: mix(f, 1.18), pitched: true, hip: true };
    }
    default: {
      const f = HOUSE[s % HOUSE.length];
      return { fill: f, shade: mix(f, 0.9), edge: mix(f, 0.74), ridge: mix(f, 1.16), pitched: true, hip: kind === 'mortar' || kind === 'terrace' };
    }
  }
}
