import * as THREE from 'three';
import { buildCanopyTrees } from './canopy.js';
import { floretTex, blossomCardTex } from './paint.js';
import { buildFallen, buildShower } from '../petals.js';
import { TOWN } from '../../config.js';

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

/* The look the town's sakura had before the sakura pass (M2e).  The two
 * cherries framing the famous views keep it: the hero frames are guarded
 * to the pixel, and their look is Tan's call. */
export const SAKURA_CLASSIC = {
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

/* The layered cherry (sakura pass; reference/density 05, 11, 12): a stout
 * trunk splitting low into heavy dark limbs that rise, bend out and droop,
 * the blossom in big lobes on their ends, each lit on top and deep below,
 * lacy sprays hanging from the undersides.  Built by kit/canopy.js growLobed. */
export const SAKURA = {
  ...SAKURA_CLASSIC,
  tones: [0xfff4f7, 0xfbdbe7, 0xefbfd3],
  tints: [0xe6d2e2, 0xd8c0dc, 0xc4a8cc],
  wood: 0x6e5a53,
  woodBands: 'soft3',            // bark keeps a lit and a shaded flank even from below
  woodTint: 0x5a4c6a,
  woodGlow: 0.12,                   // at blue hour the limbs stay brown, not black
  fallen: true,                     // petals lie round it (world/petals.js)
  form: {
    lobes: true,
    trunkH: 2.0, lean: 0.3, girth: 0.26,
    limbs: [3, 4], heroLimbs: [4, 6],
    tilt: [0.35, 0.6], heroTilt: [0.6, 0.85],
    len: 3.3, heroLen: 3.9,
    fineTwigs: 2, fineLen: 0.6,
    lobeR: 1.15, perLobe: 8, cushion: 0.55,
    droop: 0.8, flatten: [0.6, 0.75], wide: 1.1, rimFrom: 0.7,
  },
};

/**
 * Build a batch of the town's cherries.  `classic`: the pre-pass look, for
 * the two framing the famous views (town.js builds those without decals,
 * so that is the default there until it passes the option itself).
 *
 * Any town cherry the famous views can see (over the store's roof, past its
 * sides, through its glass) keeps the classic look too, so the guarded hero
 * frames stay as they are; the rest take the layered look.
 */
export function buildTownSakura(ctx, spots, { decals, classic = !decals } = {}) {
  if (classic || !spots.length) return buildCanopyTrees(ctx, spots, SAKURA_CLASSIC, { decals });
  const seen = seenFromFamousViews(ctx, spots);
  const keep = spots.filter((_, i) => seen[i]);
  const grow = spots.filter((_, i) => !seen[i]);
  const kept = keep.length ? buildCanopyTrees(ctx, keep, SAKURA_CLASSIC, { decals, name: 'townSakuraKept' }) : null;
  const trees = grow.length ? buildCanopyTrees(ctx, grow, SAKURA, { decals }) : null;
  // emitters in the spots' own order: the town's petal fall draws from them
  // by index, and the famous views' petals must fall as they did
  const emitters = [];
  let ik = 0, ig = 0;
  for (let i = 0; i < spots.length; i++) if (!spots[i].drop) emitters.push(seen[i] ? kept.emitters[ik++] : trees.emitters[ig++]);   // (a tree with no room isn't planted: kit/canopy.js)
  let shower = null;
  if (trees) {
    // the river's surface: land/ lays its water at TOWN.land.river.water
    const R = TOWN.land?.river;
    const river = R && { z0: R.z0, z1: R.z1, y: (R.water ?? R.surface ?? 0.03) + 0.01 };   // just on the water (config TOWN.land.river.water)
    buildFallen(ctx, trees.fallen, { decals, river });
    shower = buildShower(ctx, trees.emitters);
  }
  return {
    wood: trees?.wood ?? kept.wood,
    emitters,
    blobs: (trees?.blobs ?? 0) + (kept?.blobs ?? 0),
    kept: keep.length,
    update(cam) {
      kept?.update(cam);
      trees?.update(cam);
      shower?.follow(cam);
    },
  };
}

/* Where the famous views are taken from (config.js HERO_VIEWS: the photo
 * cameras and the spot the player stands on), in the world's frame. */
const EYES = [[0, 1.6, 30.4], [-3.36, 1.6, 23.4], [0, 1.6, 16.5]];

/** For each spot (in ctx's frame): could a famous view see any of its crown?
 *  A ray from each eye to points round a generous crown; glass and other
 *  see-through things do not hide it. */
function seenFromFamousViews(ctx, spots) {
  const world = ctx.root.parent ?? ctx.root;
  world.updateMatrixWorld(true);
  const toW = ctx.toWorld ?? ((p) => p);
  const ray = new THREE.Raycaster();
  const from = new THREE.Vector3(), to = new THREE.Vector3(), dir = new THREE.Vector3();
  // what hides a tree: opaque meshes (not glass, cut-outs, lines or sprites)
  // (boxes in the world's frame, so a ray tests a box before any triangle)
  const occluders = [];
  world.traverse((o) => {
    const m = o.material;
    if (!o.isMesh || o.isInstancedMesh || !o.visible || Array.isArray(m) || m.transparent || m.alphaTest > 0 || m.opacity < 1) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    occluders.push({ o, box: o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld) });
  });
  const hits = [], hitAt = new THREE.Vector3(), span = new THREE.Box3();
  const blocked = (list, d) => {
    for (const { o, box } of list) {
      if (!ray.ray.intersectBox(box, hitAt) || hitAt.distanceTo(from) > d) continue;
      hits.length = 0;
      o.raycast(ray, hits);
      if (hits.some((h) => h.distance < d)) return true;
    }
    return false;
  };
  return spots.map((sp) => {
    const S = sp.scale ?? 1;
    const w = toW({ x: sp.x, z: sp.z });
    const y0 = sp.y ?? 0;
    const reach = 3.3 * S + 1.5;
    const pts = [[0, 5.5 * S, 0]];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      for (const h of [1.8 * S, 3.5 * S, 5.5 * S]) pts.push([Math.cos(a) * reach, h, Math.sin(a) * reach]);
    }
    for (const e of EYES) {
      from.set(...e);
      // only what lies ahead of the views (they look toward -z)
      const dx = w.x - e[0], dz = w.z - e[2];
      if (dz > reach || Math.abs(Math.atan2(dx, -dz)) > 0.8 + Math.atan2(reach, Math.max(1, -dz))) continue;
      // only what stands between this eye and this crown can hide it
      span.makeEmpty().expandByPoint(from);
      span.expandByPoint(to.set(w.x - reach, y0, w.z - reach));
      span.expandByPoint(to.set(w.x + reach, y0 + 6 * S, w.z + reach));
      const between = occluders.filter((q) => q.box.intersectsBox(span));
      for (const [px, py, pz] of pts) {
        to.set(w.x + px, y0 + py, w.z + pz);
        const d = dir.subVectors(to, from).length();
        ray.set(from, dir.normalize());
        ray.far = d;
        if (!blocked(between, d)) return true;
      }
    }
    return false;
  });
}
