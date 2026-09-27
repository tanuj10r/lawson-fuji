# River & paddies: decisions

- **The layout moved a little (config.js TOWN.land).** The levee is 13 m
  deep, not 6 (z -36 to -49): a 4 m grass slope, a 6 m crest (a strip for
  the sakura, then a paved path), a 3 m concrete-block face. A narrower
  crest put the petal carpets under the trees (kit/canopy.js, flat at the
  tree's foot) out over the slope. The river keeps its 16 m (z -49 to -65);
  the far bank is 1.4 m high (z -65 to -71); the far paddies start at -71.
  The bridge (富士見橋) spans z -46 to -67 at crest height (2.2 m); the
  track ramps up from z -24 and down to -81. Gate unchanged.
- **Water sits on the ground plane.** The town's ground is one plane at
  y 0, so nothing can sink below it: the river's surface is at 0.06 and the
  banks stand up round it (the levee 2.2 m, the far bank 1.4 m).
- **Water is the sky's colour, not a reflection.** Paddies and river take
  the fog colour (the horizon sky, which every look already sets) each
  frame: a copy, no redraw, no new pass. The river leans a teal of its own
  toward it. The river's ripple texture slides only while it is drawn and
  the camera is within 60 m.
- **Grass and flowers carry no ink.** Seedlings, weeds, renge and nanohana
  are drawn after the opaque world without writing depth, so the depth-ink
  pass draws no line round every blade (it read as scribble). Normals up:
  lit like the ground. Reeds and stones keep their ink.
- **Plots you can and cannot walk in.** Flooded plots (and seedling plots)
  are shut (a collider inset 0.3 m); ploughed and renge plots are open; the
  earth paths are low enough (0.15 m) to need no platforms. Every slope you
  can walk (the levee's town side, the far bank's back) is a stair of thin
  platforms; faces, water and the ramps' grass banks are colliders whose
  tops follow the ground. The river steps (x -12) go down to a landing.
- **Early April, not May.** Most plots are flooded but bare, some ploughed,
  some green manure in flower (renge); only two in the plan have
  seedlings, planted part way. Nanohana on the levee under the sakura.
- **The hills are one mesh of flat bands.** Three rings of rounded hills
  620-900 m out round the town's north, each one flat colour leaned toward
  the horizon's colour (recoloured only when the look changes), fog off.
- **Signs.** 一級河川 桜川 (blue river plate), the bridge's four cast plates
  (富士見橋, 桜川, ふじみばし, さくらがわ; the year on the inside of the
  first), 田んぼに入らないでください, 揚水機場. Text in data/town.js.
- **Cost** (main pass at the spots, placeholder -> now): land-track 58 ->
  86 calls, 0.75 -> 1.01 M tris; land-river 70 -> 95, 0.43 -> 0.93 M;
  land-gate 40 -> 62, 0.38 -> 0.90 M. The land itself is about 13 draws
  (5 painted surfaces, paddy water, river, hills, 4 instanced kinds) plus a
  couple of style batches; the rest is the town's sakura batch (9 draws)
  coming into view with the 21 new trees, which also carry most of the
  triangles. Textures about 4 MB (six 256 px tiles, the track at 256 x 512,
  plates).

## ひと休み, the slow-life spot (experiences, 2026-09-28)
- Place: the pond's lawn just south of the paddies' edge (town 73, 102.2),
  facing 鏡池 and Fuji (seated yaw 3.13, town frame). The pond's water sits
  0.4 m below the promenade, so from a seated eye only a band of it shows;
  the view is the lawn, the pond's point, the railway cherries and Fuji.
  The paddies are behind you (they are what you see walking up from lane
  z 80's end: slowlife-wide).
- The tree is a town sakura (T.sakura, scale 1.55), set ahead-left of the
  bench rather than straight over it, so that seated its crown frames the
  top-left of the view; standing, the bench is still under its edge. Its
  petal fall, fallen carpet and batch come from kit/sakura.js as for every
  town tree.
- Jizo, not a hokora: one small stone figure (lathe robe, round head, red
  bib and knitted cap, an offering cup, wildflowers) reads at 4 m; a hokora
  would add a roof and a second read.
- "Time slows": only what this spot owns slows (its own 36 drifting petals,
  two cabbage whites, the water's glints) to 0.35 pace while seated; the
  town's petal shower (petals.js) is not ours and keeps its pace. April, so
  butterflies, not dragonflies.
- Sitting is core/player.js sit()/stand(): any key or a deliberate mouse
  move (> 90 px once settled) stands you up; seated, main.js hides the E
  prompt and shows "Any key: Stand up". Actions get ({ player, hud }).
