# Streets & poles: decisions

- **A second decal atlas, 1024 x 512.** kit/tex.js is not ours and its
  2048 atlas is full, so new ground art (the coloured Fuji lid, the grey
  relief lid, worn 止まれ and 30, ガス and 制水弁 lids, 駐輪禁止 paint, the
  hydrant box) lives in kit/street/atlas.js, about 2.8 MB with mips, drawn
  as a second decal mesh (+1 draw) after the first, so a patch never paints
  over a lid.
- **Clutter is instanced, one mesh per kind for the town.** Bicycles (the
  shared props.js bicycle, 4 meshes), gashapon banks, crates, bollards,
  stay guards, pole steps, pole boxes, cones: vertex-coloured, instance
  colour where copies differ. About 11 draws in all, whichever spot. Not
  distance-culled: each kind is one draw anyway.
- **Lettered things are plain meshes** (A-boards, 駐輪禁止 and station
  plates, pole number tags): the batcher already packs textured plates into
  its atlas pages, so they cost no draws. Canvases 64-256 px wide.
- **Kerb line, not the building line.** The facades builder owns what
  stands at the shop fronts, so walk clutter goes on the kerb side between
  the poles (clear of zebras, bus stops and the famous views), in lot gaps,
  and on lane gutters at corners. The tactile guide line runs down the
  middle of the spine's walks with the passage kept clear either side.
- **Bicycles thicken toward the station**, under a 駐輪禁止 plate and paint,
  as they do at every real station.
- **Stays (支線) only at run ends**, anchored on the kerb line along the
  street: the lot walls leave no room behind the poles.
- **Worn road words on lanes only** (two in five); the spine is repainted.
- **Main road far ends only**: kerb clutter on the Lawson's road stays west
  of core x -62 and east of 40, out of the famous views (hero guard passes).
- **Close-up spots added**: close-street-spine, close-street-pole,
  close-street-kerb (config.js SHOT_SPOTS).
