import { buildCanopyTrees } from './canopy.js';
import { floretTex, blossomCardTex } from './paint.js';

/* ------------------------------------------------------------------ *
 * The town's sakura (SPEC section 3, trees; M2d, painted in M2e Phase 3).
 *
 *   limbs     4-8 bending limbs, each forking, fine twigs past the blossom
 *   blossom   flattened cushions painted with florets (floretTex), three
 *             pale tones by height, lacy alpha-cut sprays at the rim
 *   hero      the big old trees (scale >= 1.4) spread lower and wider
 *   ground    a pink carpet under each tree, and drifts
 *
 * The builder is kit/canopy.js; this is the cherry's look.  Generators
 * queue their trees in ctx.sakura; town-core builds them in one batch.
 * ------------------------------------------------------------------ */

export const SAKURA = {
  name: 'townSakura',
  /* Pale, as the reference paints them: the florets bring the pink, the
   * tones only lift or deepen it by height, the shade side is soft lilac. */
  tones: [0xfff6f8, 0xfde4ec, 0xf6cfdd],
  tints: [0xe8d8e6, 0xdfcbe0, 0xd2bcd8],
  bands: 'blossom',
  skin: floretTex,
  skinRepeat: [2, 1],
  card: blossomCardTex,
  glow: 0.28,                       // after dark the blossom keeps some of its pink
  emit: true,                       // petals fall from it (world/petals.js)
  wood: 0x5e4a52,
  ground: { carpet: 'petalCarpet', drift: 'petals' },
  form: {
    trunkH: 2.1, lean: 0.25, girth: 0.24,
    limbs: [4, 6], heroLimbs: [6, 8],
    tilt: [0.85, 1.25], heroTilt: [1.0, 1.35],      // an umbrella, not a vase
    len: 2.3, heroLen: 2.7, rise: 1,
    forks: 2, fineTwigs: 3, fineLen: 1,
    perTree: [95, 200], cushion: 0.5, spread: 1, droop: 1.3,
    flatten: [0.55, 0.7], wide: 1.15, rimFrom: 0.55,
  },
};

export function buildTownSakura(ctx, spots, { decals } = {}) {
  return buildCanopyTrees(ctx, spots, SAKURA, { decals });
}
