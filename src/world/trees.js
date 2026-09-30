import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { cel, flat } from '../core/toon.js';
import { bake, trs, rngKit } from '../core/util.js';
import { leafTex } from './kit/paint.js';

/* ------------------------------------------------------------------ *
 * Cherry trees.
 *
 * Trunks and branches are merged into a single mesh; the canopy is three
 * instanced meshes, one per blossom tone.  Clusters of faceted blobs read
 * as painted blossom mass far better than any leaf geometry would, and
 * three tones give the canopy internal shape without any texture.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * The green canopy.
 *
 * Blossom cannot carry every tree in the world: the shrine wants deep shade
 * and a towering 御神木, the canal wants scruffy bank growth, and the school
 * wants something dark behind its pale walls.  Same construction as the
 * cherries -- merged wood, instanced blobs -- but taller, denser and in
 * three teal-leaning greens instead of three pinks.
 * ------------------------------------------------------------------ */

/**
 * The grove's three greens, plus a fourth that only the 柳 uses.
 *
 * `PAL.willow` is deliberately the palest, yellowest green in the world: a weeping
 * willow in spring is *lighter* than everything round it, and at a lake that is
 * the entire reason to have one.  Two of the three greens above are darker than
 * the hillside they stand on, so a willow drawn out of them is a dark lump beside
 * water instead of the one pale, moving thing on a shore.
 */
const GREEN_TONES = [0x8cb884, 0x5f9470, PAL.cedar, PAL.willow];
/* The far tree lines' tones: kit/green.js's camphor, lit to deep (sakura pass). */
const FAR_TONES = [0xcfe6ac, 0xa4cc8a, 0x7eae78, PAL.willow];

/**
 * @param spots [{ x, z, y, scale, seed, lean, leanDir, spread, tone }]
 */
/**
 * @param opts.far   distant tree line: fewer, coarser blobs (a background
 *                   mass seen at 50 m and more), no shadows
 */
export function buildGrove(ctx, spots, opts = {}) {
  if (!spots.length) return null;
  const far = opts.far ?? false;
  const woodParts = [];
  const blobs = [[], [], [], []];
  const trunkGeo = new THREE.CylinderGeometry(0.62, 1.0, 1, 7, 1);
  const branchGeo = new THREE.CylinderGeometry(0.28, 0.6, 1, 5, 1);

  for (const spot of spots) {
    const rng = rngKit(spot.seed ?? 1);
    const S = spot.scale ?? 1;
    const { x, z } = spot;
    const y = spot.y ?? 0;
    const lean = spot.lean ?? 0;
    const leanDir = spot.leanDir ?? rng.range(0, Math.PI * 2);
    const spread = spot.spread ?? 1;

    /**
     * 柳 -- the weeping willow, and it is the same generator with three numbers
     * changed rather than a fourth tree species.
     *
     * That is a deliberate limit.  `buildCedar` earned its own file's worth of
     * geometry because a 杉林 is a *mass* seen at fifty metres and needed a
     * different silhouette to be one.  A willow is only ever seen close, standing
     * alone on a bank, and what makes it a willow is three things a blob canopy
     * can already do: a taller thinner stem, limbs that go **out** rather than up,
     * and the canopy hanging *below* the limb ends instead of piled above them.
     *
     * The last one is the whole trick.  Every canopy in this world is placed at
     * `c.y + range(-0.7, 1.5)·S`, i.e. biased upward, because that is what a shade
     * tree does.  Inverting that bias and stretching each blob vertically gives a
     * curtain, and a pale curtain over water at four metres reads as a 柳 without
     * a single new vertex format.
     */
    const willow = spot.willow === true;
    const trunkH = (willow ? 4.3 : 3.6) * S * rng.range(0.9, 1.15);
    const trunkR = (willow ? 0.185 : 0.24) * S;
    woodParts.push({
      geometry: trunkGeo,
      matrix: trs(x, y + trunkH / 2, z, lean * Math.sin(leanDir), 0, -lean * Math.cos(leanDir),
        trunkR, trunkH, trunkR),
    });
    woodParts.push({
      geometry: trunkGeo,
      matrix: trs(x, y + 0.2 * S, z, 0, 0, 0, trunkR * 1.55, 0.42 * S, trunkR * 1.55),
    });

    /* Where the trunk actually ends.
     *
     * The trunk is a cylinder rotated about its own *centre* by the Euler
     * (lean·sin d, 0, -lean·cos d) above, so its tip is the centre plus that
     * rotation applied to (0, trunkH/2, 0) -- and the small-angle form of that
     * is (h·lean·cos d, h, h·lean·sin d), not (0.9·trunkH·lean·sin d, …,
     * -0.9·trunkH·lean·cos d).  The old expression had sin and cos swapped and
     * used 0.9·trunkH where the half-height belongs, so the limbs and the whole
     * blossom mass were planted about 0.4 m away from a trunk top 0.17 m
     * across, at ninety degrees to the lean.  Every tree in the world was
     * detached from its own canopy, in a different direction each time.
     *
     * Applied exactly rather than approximated, so it stays right if anything
     * ever leans hard. */
    const tip = new THREE.Vector3(0, trunkH / 2, 0)
      .applyEuler(new THREE.Euler(lean * Math.sin(leanDir), 0, -lean * Math.cos(leanDir)));
    const topX = x + tip.x;
    const topZ = z + tip.z;
    const topY = y + trunkH / 2 + tip.y;

    const limbs = (willow ? 5 : 3) + Math.floor(rng.next() * 3);
    const centers = [];
    for (let i = 0; i < limbs; i++) {
      const a = (i / limbs) * Math.PI * 2 + rng.range(-0.4, 0.4);
      /* **1.35, not 2.1.**  At 2.1·S the limbs reach 2.6 m out and the fronds hang
       * *inside* them, so what the frame showed was five bare dark poles radiating
       * from the trunk with foliage beyond -- spokes, not a willow.  A weeping
       * canopy's limbs are shorter than its curtain by definition; the reach comes
       * from the fronds. */
      const len = (willow ? 1.35 : 1.5) * S * rng.range(0.8, 1.25);
      // out, not up: a willow's limbs are near horizontal before they fall
      const tilt = willow ? rng.range(1.02, 1.42) : rng.range(0.35, 0.7);
      const ex = topX + Math.cos(a) * Math.sin(tilt) * len * spread;
      const ez = topZ + Math.sin(a) * Math.sin(tilt) * len * spread;
      const ey = topY + Math.cos(tilt) * len;
      const dir = new THREE.Vector3(ex - topX, ey - topY, ez - topZ);
      const l = dir.length();
      const q = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      woodParts.push({
        geometry: branchGeo,
        matrix: new THREE.Matrix4().compose(
          new THREE.Vector3((topX + ex) / 2, (topY + ey) / 2, (topZ + ez) / 2),
          q, new THREE.Vector3(0.15 * S, l, 0.15 * S)),
      });
      centers.push(new THREE.Vector3(ex, ey, ez));
    }

    /* Denser and rounder than blossom: a shade tree is a single mass with a
     * lit crown, not a cloud of separate puffs. */
    /**
     * **A willow needs three times the blobs at a third of the size, and the first
     * version proved it.**
     *
     * Written with 40 blobs at `0.5·S` -- the same order as the grove's -- it came
     * out as six pale lozenges a metre across hanging in the air: at that size a
     * blob is a *canopy*, so a curtain of them is a cloud, and in `PAL.willow` (the
     * palest green in the world) it was the loudest thing in the park.
     *
     * A frond has to be small enough that the eye reads the mass rather than the
     * unit, which at four metres is about 0.3 m -- and to fill the same volume with
     * 0.3 m units instead of 0.9 m ones takes an order of magnitude more of them.
     * 120 is what it takes; it costs nothing, because every one of them is an
     * instance in a mesh that already exists.
     */
    const count = far ? 14 + Math.floor(rng.next() * 5) : (willow ? 120 : 30) + Math.floor(rng.next() * 12);
    let yMin = Infinity, yMax = -Infinity;
    for (const c of centers) {
      yMin = Math.min(yMin, c.y);
      yMax = Math.max(yMax, c.y);
    }
    for (let i = 0; i < count; i++) {
      const c = centers[Math.floor(rng.next() * centers.length)];
      if (willow) {
        /* The curtain: hung from a limb end, falling toward the ground and never
         * through it.  Each frond is a blob stretched to 1.7 : 1 vertically, which
         * at this blob count is what turns a cloud into hanging foliage.
         *
         * `Math.max(y + 0.5·S, …)` is the one guard that matters: a willow leans,
         * its limbs reach 2.6 m out, and unclamped the lowest fronds on the
         * downhill side end up *inside* the bank -- which on a shore means inside
         * the water, where they read as a green stain on the surface. */
        const r = 0.185 * S * rng.range(0.7, 1.25);
        const fall = rng.range(0.05, 1.0);
        const px = c.x + rng.range(-1.05, 1.05) * S * spread;
        const pz = c.z + rng.range(-1.05, 1.05) * S * spread;
        const py = Math.max(y + 0.55 * S, c.y + 0.42 * S - fall * (c.y - y) * 0.95);
        /* 62 / 38 rather than 74 / 26.  The pale tone is what makes it a willow and
         * the mid green is what stops it being a cloud of it; at three quarters pale
         * the whole tree read as one flat area of `PAL.willow`, which is the
         * brightest thing in the palette. */
        const tone = rng.next() < 0.62 ? 3 : 1;
        blobs[tone].push(trs(px, py, pz,
          0, rng.range(0, 3), rng.range(-0.25, 0.25),
          r, r * rng.range(1.7, 2.6), r * rng.range(0.85, 1.05)));
        continue;
      }
      const r = 0.72 * S * rng.range(0.7, 1.25);
      const px = c.x + rng.range(-1.25, 1.25) * S * spread;
      const py = c.y + rng.range(-0.7, 1.5) * S;
      const pz = c.z + rng.range(-1.25, 1.25) * S * spread;
      let tone;
      if (spot.tone !== undefined) tone = spot.tone;
      else {
        const hi = (py - yMin) / Math.max(0.5, yMax + 1.6 * S - yMin);
        tone = hi > 0.66 ? 0 : hi < 0.3 ? 2 : 1;
        if (rng.next() < 0.2) tone = (tone + 1) % 3;
      }
      blobs[tone].push(trs(px, py, pz,
        rng.range(0, 3), rng.range(0, 3), rng.range(0, 3),
        r, r * rng.range(0.7, 0.92), r));
    }
    if (spot.collide !== false) {
      ctx.collide(x - trunkR * 1.7, z - trunkR * 1.7, x + trunkR * 1.7, z + trunkR * 1.7, y + trunkH);
    }
  }

  const wood = new THREE.Mesh(bake(woodParts), cel({ color: PAL.trunkDark, bands: 3, tint: 0x6f5a80 }));
  wood.castShadow = !far;
  wood.receiveShadow = true;
  wood.name = 'groveWood';
  ctx.add(wood);

  const blobGeo = new THREE.IcosahedronGeometry(1, 1);
  if (far) {
    /* A far tree line is one draw: the three tones ride as instance colours
     * on a white material rather than as three meshes.
     *
     * Painted like the town's own green (kit/green.js, sakura pass): round
     * shading (radial normals, no facets -- at detail 0 with flat shading it
     * read as low-poly lollipops behind the station), the camphor's leaf
     * skin, and the camphor's pale spring tones with a blue-violet shade. */
    const p = blobGeo.attributes.position, nr = blobGeo.attributes.normal, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); nr.setXYZ(i, v.x, v.y, v.z); }
    const skin = leafTex('glossy').clone();
    skin.repeat.set(2, 1);
    skin.needsUpdate = true;
    const all = blobs.flatMap((list, i) => list.map((mx) => [mx, i]));
    const inst = new THREE.InstancedMesh(blobGeo, cel({ color: 0xffffff, map: skin, flat: false, bands: 3, tint: 0x6a7e9c }), all.length);
    const col = new THREE.Color();
    all.forEach(([mx, i], k) => {
      inst.setMatrixAt(k, mx);
      inst.setColorAt(k, col.set(FAR_TONES[i]));
    });
    inst.castShadow = false;
    inst.receiveShadow = false;
    inst.name = 'groveCanopyFar';
    inst.computeBoundingSphere();
    ctx.add(inst);
    [trunkGeo, branchGeo].forEach((g) => g.dispose());
    return null;
  }
  blobs.forEach((list, i) => {
    if (!list.length) return;
    const inst = new THREE.InstancedMesh(
      blobGeo, cel({ color: GREEN_TONES[i], bands: 3, tint: 0x5b6f8c }), list.length);
    list.forEach((mx, k) => inst.setMatrixAt(k, mx));
    inst.castShadow = !far;
    /* Green canopies do not receive shadow either -- and this is the one that
     * was actually causing the black circles in the sky.
     *
     * The note on the blossom canopy above explains the mechanism: a ramp only
     * shapes *direct* light, so once the shadow map zeroes the sun a blob falls
     * back to ambient.  On blossom that produced a dark violet lump, which is
     * why receive was turned off there.  On these it is far worse, because the
     * deepest green tone starts at #3f6b52 -- ambient on top of that with a
     * violet tint is very nearly black.  A big tree self-shadows heavily, so
     * what you got was a handful of *isolated* blobs on one canopy going black
     * while the rest of the tree looked fine: round dark circles hanging in the
     * sky, which is exactly how they were reported.  Worst against clear sky,
     * and the district has grove rings east of the bridge, behind the school
     * and along the canal that are all seen that way.
     *
     * The fix had been applied to the blossom and never to the green. */
    inst.receiveShadow = false;
    inst.name = 'groveCanopy' + i;
    ctx.add(inst);
  });

  [trunkGeo, branchGeo].forEach((g) => g.dispose());
  return wood;
}

/* ------------------------------------------------------------------ *
 * 杉 -- the cedar plantation.
 *
 * The second tree species on the hills, and it exists because of a measurement
 * rather than because a range wants variety.  Everything green on ひばり山 came
 * out of `buildGrove`, which has exactly **one** canopy form: a cloud of
 * icosahedral blobs round a short trunk, in three tones.  Vary the scale, the
 * spread and the lean of that as much as you like and every tree in the world is
 * still the same rounded lump, so a hundred and fifty metres of hillside is a
 * field of identical bubbles with a smooth green arc for a skyline.
 *
 * A Japanese 里山 is *read* as Japanese by its 杉林: tall, narrow, dark, conical,
 * clean-trunked, planted in blocks with a hard straight edge against the
 * broadleaf.  Adding it fixes three separate things at once and that is why it
 * is worth a second generator rather than another set of tones:
 *
 *   - **scale.**  A faceted hillside has nothing on it of known size (the same
 *     argument `buildOutcrops` is there for, one order up).  An 11 m tree with a
 *     3.4 m crown standing on a 14 m hill says how big the hill is; a 6 m blob
 *     does not, because a blob could be a bush two metres away.
 *   - **the skyline.**  The ridge lines were a smooth green arc, because the
 *     blob canopy's silhouette is a circle and a row of circles is a scallop.  A
 *     row of narrow cones is a saw, which is what a wooded ridge looks like
 *     against the sky and what the ink pass has been wanting something to draw.
 *   - **vertical.**  Nothing on the range stood up.  The cel ramp cannot shade a
 *     gentle slope here (see the note by `hillGrassSun` in the palette), so the
 *     only way a slope reads as a slope is for something on it to be *plumb* and
 *     for the eye to compare the two.  A cedar is the most plumb thing there is.
 *
 * **The construction is a stack of cones, and it must not be blobs.**  The whole
 * value of the species is that its silhouette differs; drawing it out of the same
 * `IcosahedronGeometry` in darker greens gives a dark bubble, which is worse than
 * nothing because it reads as the grove in shadow.  Seven overlapping 7-sided
 * cones of decreasing radius, each turned a random amount about its own axis, is
 * one instanced draw call per tone and comes out as a narrow ragged wedge.
 *
 * **The trunk carries the base of the tree on its own.**  A plantation is pruned,
 * so the bottom third to two fifths of the stem is bare -- and a stand of bare
 * vertical stems under a dark canopy is the single most recognisable thing about
 * a 杉林 from inside it.  So the crown starts at 0.30-0.42 of the height, not at
 * the ground, and the trunk is a redder wood than the broadleaf's.
 *
 * Two things are deliberate and easy to undo:
 *
 *   - **the lean is almost nothing** (0-0.045 against the grove's 0.02-0.14).
 *     Planted sugi are dead straight, and the straightness is the tell.  It is
 *     also arithmetic: the trunk here is placed by its **base** rather than by its
 *     centre, because at 11 m a lean of 0.06 applied about the centre walks the
 *     foot of the tree a third of a metre away from its own collider.
 *   - **no canopy receives shadow**, blossom or green or needle.  A ramp only
 *     shapes direct light, so a blob the shadow map has zeroed falls back to
 *     ambient -- and at `cedarDeep` (0x2f5540) ambient under a violet tint is
 *     very nearly black.  This is the failure that hung round dark circles in the
 *     sky off the grove canopies for several rounds; see the long note there.
 * ------------------------------------------------------------------ */

/** Rounded low-poly shrubs, in a slightly teal green. */
export function buildShrubs(ctx, spots) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const tones = [PAL.leaf, PAL.leafDeep, PAL.leafPale];
  const lists = [[], [], []];
  for (const s of spots) {
    const rng = rngKit(s.seed ?? 11);
    const n = s.count ?? 3;
    for (let i = 0; i < n; i++) {
      const r = (s.r ?? 0.55) * rng.range(0.75, 1.2);
      lists[i % 3].push(trs(
        s.x + rng.range(-0.5, 0.5) * (s.spread ?? 1),
        (s.y ?? 0) + r * 0.72,
        s.z + rng.range(-0.5, 0.5) * (s.spread ?? 1),
        rng.range(0, 3), rng.range(0, 3), rng.range(0, 3),
        r, r * 0.8, r
      ));
    }
  }
  lists.forEach((list, i) => {
    if (!list.length) return;
    const inst = new THREE.InstancedMesh(geo, cel({ color: tones[i], bands: 3, tint: 0x5b6f8c }), list.length);
    list.forEach((m, k) => inst.setMatrixAt(k, m));
    inst.castShadow = true;
    inst.receiveShadow = true;
    ctx.add(inst);
  });
}

