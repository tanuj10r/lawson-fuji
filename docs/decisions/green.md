# Sakura & greenery: decisions

- **A second crown builder, not a retune.** kit/canopy.js keeps the M2e
  builder untouched and adds `growLobed` (a look opts in with
  `form.lobes`): a stout trunk, 3-6 limbs in three kinked bends (steep,
  then out, then over), a fork at each bend, and the blossom in lobes on
  the bends and fork ends, the wood running into each lobe from below.
  Each lobe is a half-dome of cushions toned by where the cushion sits on
  its own lobe as well as by height, so every lobe has a lit top and a
  deep underside; lacy sprays hang from the undersides. Same instanced
  sets, same near/far detail and sort as before: no new draws per batch.
- **Darker wood, deeper undersides.** Sakura wood 0x4a3a42 with a darker
  shade tint (was 0x5e4a52), the deep tone a little pinker. The limbs are
  what make it read as a cherry looking up into it.
- **The famous views keep the classic cherry.** `SAKURA_CLASSIC` is the
  pre-pass look. The two frame trees use it (town.js calls
  buildTownSakura without decals; `classic` defaults to that, and town.js
  should pass `{ classic: true }` explicitly when it is next edited). Any
  town cherry the famous views can see is found at build time by rays from
  the three hero eyes (glass does not hide) and kept classic in its own
  small batch: 6 of 46 today, all behind or beside the store. Emitters are
  returned in the original spot order so the town's petal fall is
  unchanged. Cost: that batch's draws (up to ~10) where those 6 are in view.
- **Petals are dropped, not painted.** petals.js `buildFallen`: rays fall
  from each crown; a petal lies where it lands if the surface is flat
  (benches, walls, AC units, walks), is mostly blown off the carriageway,
  and piles at the kerb's foot where one stops it (plus a drift decal now
  and then). One instanced mesh for the town (~16k petals incl. the river),
  three tones as instance colours, cel-shaded so they dim at night, no
  depth write (the ink pass would speckle them).
- **River rafts** strung along the current on TOWN.land.river at
  `river.surface ?? 0.03` (land/index.js's water sheet today). If the land
  builder moves the water, it should set `TOWN.land.river.surface`.
- **A local shower.** `buildShower`: 150 petals leaving the canopies within
  26 m of the player, on ctx.update, idle and hidden otherwise. The M2 and
  M2d fields are untouched (the hero frames' petals come from them).
- **Green:** camphor and zelkova move to the lobed crown (a dense dome; a
  steep vase that hardly bends). Maple, red maple, pine pads and potted
  shrubs keep the M2e builder: they read well at their size. The far tree
  lines (trees.js buildGrove far) were flat-shaded detail-0 icosahedra, low
  poly lollipops behind the station; now detail 1 with round normals, the
  camphor's leaf skin (a clone sharing the same image) and its tones.
- **Spot added:** `close-green-river` (on the levee, looking down at the
  water) to check the rafts.
- **Round bark at arm's length (review fix).** The layered crowns' wood is
  now tapered pieces that start where the last one ended (12/9/5 sides by
  radius), smooth-shaded, with a knot at each bend and limb tips thinning
  to a point. Within 32 m of the player a tree shows that; past it a
  coarse copy (5 sides, no knots or fine twigs). Both live in one
  BatchedMesh per batch, switched per tree in the canopy's own update:
  one draw, and fewer triangles than the merged wood it replaces. Bark is
  a warm grey-brown 0x6e5a53 on the high-key soft3 ramp, takes no shadow
  (under its own blossom it went flat ambient, near black) and keeps a
  little of its brown after dark (night glow 0.12). The kept-classic trees
  still use the M2e faceted wood.
- **Spot added:** `close-green-limb` (under the plaza cherry, looking up
  into its limbs at about 1.5 m; day and blue).
