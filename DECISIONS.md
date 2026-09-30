# Decisions

Judgement calls, newest milestone last.

## M0: Fork and strip

- **Planet removed, not disabled.** `planet.js` is deleted. The world was already
  authored flat and only projected onto the sphere at the end, so the
  projection, the player's spherical camera frame, the x-wrap and the P orbit
  view went with it. The lights now use fixed world-space directions, and the
  shadow camera follows the player.
- **Flat outer ground.** A large plane (±1200 m) sits 65 mm under the street's
  320 m terrain grid and follows the same `groundY` profile. It replaces the
  sphere as the ground beyond the grid. The fog hides where it ends.
- **Ink pass fix (`src/core/post.js`).** The ink edge test now uses the second
  difference of reciprocal depth instead of linear depth. Linear depth is not
  flat across a plane in screen space, and on a flat world the ground 40–100 m
  out, near the horizon, inked as a solid dark band. The planet hid this by
  curving the ground out of sight within about 30 m. For small depth steps the
  new term equals the old one, so silhouettes and creases ink as before
  (hero view compared before and after).
- **Train on a straight line.** The track is ±400 m. The train runs off one end
  in the fog and re-enters at the other (about a 30 s cycle). The crossing
  still triggers on the train's distance, not on a timer. It now starts at the
  far end, so the first thing seen is a full approach. The 3-minute interval
  and the tree-lined cuttings are M2.
- **Districts deleted.** Every named district, plus hills, tunnel, lake, canal,
  landform, planet, traffic, the housing sweep (`district.js`) and the e-bike,
  is deleted from the tree (history: commit de01898). The parts SPEC section 2
  lists as reusable are kept but unused for now (vehicles, streetprops,
  housing, shotengai, shops, details), together with the files they import
  (ground, showa).
- **Kept in the build:** the street, the railway with its crossing and station,
  the train, the corner shop, and the houses, poles, wires, sakura, props and
  cat around the crossing.
- **Deferred to M2:** the shop fascia (青空商店) and the station and poster
  signs (ひばり台) still show Sakura Crossing names. M2's acceptance list
  covers renaming them.
- **Title card:** renamed to Lawson Fuji with minimal text, and the Chinese
  description replaced. UI strings are still inline in `hud.js`. They move to
  `src/data/strings.js` when the title screen is built (M7).
- **Audio:** the stock track is deleted and the playlist is empty. The game
  runs silently until M4. `public/audio/` and `assets/audio/` are git-ignored.
- **Known, not fixed:** a three.js warning that `flatShading` is not a property
  of `MeshToonMaterial` (from `toon.js`, inherited), and a 404 for
  `/favicon.ico`, which the page does not declare.

## M0 correction (Tan): nothing of Sakura Crossing's world may show

- **Empty world.** `main.js` now builds the world from our own `src/world/town.js`,
  which places only a flat ground plane (±1200 m) under the sky. Nothing from
  Sakura Crossing is placed: no crossing, train, street, houses, poles, trees,
  petals or props. SPEC M0's acceptance list and AGENTS.md were updated to
  match.
- **Parts library.** Sakura Crossing's remaining modules in `src/world` (street,
  railway, train, shop, buildings, trees, petals, props, vending, vehicles,
  streetprops, housing, shotengai, shops, details, ground, showa) stay in the
  tree unimported. `index.js`, their world assembly, is kept for reference,
  marked "not imported". The district modules already deleted in M0 stay
  deleted; they are in git history (de01898).
- **Spawn at the hero spot.** `src/config.js` sets the storefront centred on
  x = 0 with its glass at z = 0, facing +Z, and the hero spot 40 m straight
  back at (0, 0, 40), eye 1.6 m, yaw 0 (looking −Z, where the Lawson and Fuji
  will stand). 40 m is the middle of SPEC's 35–45 m range; M1 tunes it.
- **Sakura UI removed:** the fading hint line (which listed "R opening view"),
  the R reset-to-opening-view key, the H hint toggle, and the start card's art
  panel (level-crossing icon, "Nihonmachi · 05:42 PM", 春の日本街, 桜の季節,
  进入日本街, "3D scene · 2D animation spirit") with all its styling. The start
  card is now a plain placeholder until M7. Its text lives in
  `src/data/strings.js`.
- **Checked:** the production bundle contains none of 青空商店, ひばり, 踏切,
  Sakura, Nihonmachi, 日本街, 桜の季節, さかえ or "opening view". At runtime the
  scene holds only the sky dome, its cloud billboards and the ground.

## M1: Look-dev, the hero view

- **Hero cameras reconstructed from the photos.** The store is 4 m tall, so
  its pixel height in each photo gives a scale, and the eye height (1.6 m)
  gives the horizon. The real peak sits 10.3° up from the real Lawson (from the
  baked DEM), and that fixes the focal length. Day: 30.4 m back, vertical
  FOV 24.1° (35.8° across the photo's width, just over SPEC's 30–35° lens, and
  30 m back, not SPEC's 35–45 m). Blue hour: 23.4 m back, vertical FOV
  42.6°, a closer, wider shot. The photos win. The overlays confirm both.
- **Lens shift, not tilt.** Both photos keep verticals straight with the
  horizon well below centre, so the hero camera stays level and its projection
  is shifted (`HERO_VIEWS.shift`). The frame is matched on its height, so the
  composition holds at any aspect ratio. The R overlay fits the photo by
  height the same way.
- **The blue-hour photo is a different shot.** Its storefront is also square
  and centred, but its peak sits 1.5° right of centre, not 9.8°. So the
  photographer stood about 3.4 m further left, with the frame shifted back
  over the store. Hero 3 reproduces exactly that: x = −3.36 plus a horizontal
  lens shift. The storefront stays straight-on.
- **Golden hour uses hero 1's framing** (SPEC: the game opens on hero camera 1
  at golden hour). There is no golden-hour photo, so R shows real-day.png for
  composition.
- **Store size from the photos, not SPEC's 14 m.** The real store is 17 m
  wide and 4 m tall, plus a 2.6 m tiled section at the right end. The sign
  band is 0.62 m under a 0.42 m cap (SPEC: 1.2 m band). The entrance is
  2.3 m left of centre, behind the zebra walk, as in both photos. The
  wordmark is blue on a white panel, as photographed (SPEC: white wordmark).
  The milk-can logo is on the plate above the door and on the side band with
  ローソン. Depth stays 10 m for M3.
- **Street plan from the photos:** a 10.5 m forecourt (bays 2.7 m), a 6.7 m
  road, and the far kerb with its tactile strip at z = 17.2. Beyond that, a
  sidewalk and a paved lot where the photographers stand. M2 can dress the lot.
- **Fuji at "infinity".** The DEM (GSI dem_png z12, 384² grid, ±11.5 km,
  60 m cells, cropped to an 11 km disc whose edge is buried below the
  horizon) is rotated so the real Lawson→summit line points 9.8° right of −Z,
  and scaled so its angles are the real ones. It is drawn 1.4 km out and rides
  with the camera like the sky. At 16 km the real mountain does not move as
  you cross a 250 m town. Scale is true (`FUJI.exaggeration` = 1). The camera
  far plane is now 3.2 km and the sky dome radius 2.9 km.
- **Fuji shading** is its own shader in the toon idiom: two hard light bands,
  a posterised snow line (2,450 m, jagged, pushed down gullies using DEM
  curvature), faint painted ridge strokes where the bands meet on the snow,
  alpenglow and base haze. No outline and no ink-pass lines, as SPEC section 4
  says for Fuji (the ink pass fades out long before 1.4 km anyway).
- **Looks, not a cycle.** `LOOKS` in config.js holds day, golden and blue:
  sky, clouds, fog, lights, grade, Fuji colours and store glow. M6 blends
  these keyframes. Blue hour has no clouds (the photo is clear).
- **Sky.** The dome takes look colours plus a low glow band toward a bearing.
  Clouds use the same seeded ring pushed out behind Fuji (so it occludes
  them), at 0.55× angular size (at full size, a cloud filled the telephoto
  frame as one band), and lifted clear of the low sky around Fuji's bearing.
- **Gameplay FOV is 70° measured across 16:9** (about 43° vertical, held at
  every aspect). M1 first applied SPEC's 70° vertically, about 102° across,
  and leaving a hero view zoomed out about 3×. Tan flagged it. Now it is
  about 1.8×, eased over 1.6 s.
- **Fuji keeps its famous-view size in play** (Tan). In the gameplay lens the
  mountain is magnified across and up the line of sight (not brought closer),
  and its bearing spreads the same way (tan b × k). So Fuji sits exactly as
  large, and where, the day photo puts it on screen, wherever you walk
  (`FUJI.gameplaySize`, 1.0 = photo size).
- **No lens change in play** (Tan: no zoom-out on moving). Keys 1, 2, 3 and
  the spawn stand you on `HERO_VIEWS[].play` in the ordinary 70° lens, at the
  spot where the store fills the frame as in the photo. That is 16.5 m out
  (30.4 ÷ 1.85, in the road's far lane, by the kerb) for day and golden, and
  23.4 m for blue hour, whose photo lens is already about 43°. A slight
  upward look (0.16 / 0.09 rad) puts the horizon where the photos have it.
  With the magnified Fuji, the day view matches real-day.png almost exactly
  under the overlay. Moving never changes the lens.
- **One framing, three times of day** (Tan). The views are named morning (1),
  golden hour (2) and night (3), and all three stand on the same spot with the
  same framing. They differ only in look (day, golden and blue presets).
  Night no longer copies the blue-hour photo's closer, wider shot, and may
  differ from it.
- **The exact photo cameras stay, for look-dev only.** The dev R overlay
  switches to the exact photo lens (narrow, shifted, true-size Fuji) at the
  photographer's spot, and switches back when R is pressed again.
  `?lookdev` saves both: `hero-*.jpg` (what keys 1–3 show) and
  `hero-*-photo-lens.jpg` (the exact reconstruction).
- **Shadow map 4096, ±40 m,** centred 16 m ahead of the player, so the
  storefront 30 m from a hero camera is inside it.
- **Interior is a painted card** (back wall, gondolas under 1.6 m, drinks
  wall, ceiling light rows) behind real glass with shine streaks. M3 replaces
  it. Window spill on the forecourt is a hard-edged painted pool, on at golden
  and blue hour.
- **Screenshots:** `?lookdev` (dev only) frames each hero camera and writes
  `reference/lookdev/hero-{day,golden,blue}.jpg`. It also writes copies with
  the reference photo overlaid to `.shots/`. Those contain third-party photos,
  so they stay local.
- **Deferred:** parked kei cars, vending machines, bins, ashtray, bike rack,
  umbrella stand and the roadside pole sign (M2, with the town's props and
  colliders). The lone shopper (figures come with the clerk, M5). The kei van,
  the sign flicker and the wet road (M6). Sakura at the frame edges (M2).
  Nothing in M1 blocks Fuji or the sign.

## M2: Compact town

- **The famous views are protected by placement.** Tan approved low town at
  the frame edges. Nothing new stands in front of the storefront, the sign or
  Fuji's cone. Poles and wires stay out of the 70° frame or pass above it.
  The Lawson's vending machines and bins stand on its left side wall, hidden
  behind the front corner. Its parked cars use the outer bays. One wheel stop
  that would have edged into the bottom-left corner is left out. The two
  houses behind the store are single-storey, so they stay below its roofline.
  Pixel comparison against the approved M1 frames: mean difference 0.2/255
  over the storefront and 0.03/255 over Fuji (falling petals and the edges).
- **No poles along the Lawson frontage.** At golden hour the low sun laid the
  nearest pair's shadow across the sign. The real store has no overhead lines
  in front of it, so the main-road line runs from x ±44 outward.
- **Layout (config.js TOWN).**
  - Residential lane behind-left of the store, reached by a side lane.
  - Park behind-right.
  - Main road the full width of town, barricaded 通行止め at x ±118.
  - Shopping street 富士見通り商店街 west of the photographers' lot.
  - Side road at x 30 to the level crossing, with the station east of it.
  - Railway at z = 60.
  - Vegetable fields fill the open ground between zones.
  - Tree lines and a low fence all round. The player clamp sits on that
    fence, and roads end at visible barricades and guardrails.
- **Parts reused, re-signed.** Houses, shopfronts, poles, wires, sakura,
  groves, shrubs, vending, cars, props, the railway, crossing, station and
  train come from the parts library. Every sign name lives in
  `src/data/town.js`. The shared textures that carried Sakura Crossing names
  (shop fascia table, station board, train destination, lanterns, a poster
  strapline) now read from it. The bundle contains none of ひばり, 青空商店,
  さかえ, 桜坂 or any other Sakura Crossing shop or place name.
- **Railway placed whole.** Sakura Crossing's line is authored round its
  crossing, so it is placed as one part at (30, 60) through an offset context
  (`world/ctx.js`). The train is two cars, green and cream (a `livery` option
  on the part), and waits off-scene between passes: one every 180 s. Gates
  and lamps still follow the train's distance. The line leaves town between
  planted earth banks (the cutting), with fences and 線路内立入禁止 plates
  across the right-of-way.
- **Our own traffic signals** (`world/signals.js`). The library has none.
  They are Japanese horizontal heads with a glowing blue-green, plus
  pedestrian heads, at a zebra at x = -35.
- **Performance: static batching** (`world/merge.js`, SPEC section 11).
  - Static meshes are merged per material, per 128 m cell, so the camera and
    the shadow map can still cull.
  - Plain-colour toon and basic materials are folded into vertex colours,
    one shared material per lighting style. The toon shadow tint moved to a
    per-vertex attribute (`cel({ tintAttr })` in core/toon.js) so it doesn't
    split batches. The look is unchanged.
  - Materials changed at runtime are tagged `userData.live` and never
    folded: the store glass, lit interior and sign, signal and crossing
    lamps, and the ground.
  - The train batches inside itself, and the cloud ring into two draws.
  - Far tree lines are one instanced draw each, with coarser blobs and no
    shadows.
  - Before: about 2,000 calls and 5–7M triangles. After: 83–294 calls and
    0.61–0.73M triangles in every first-person view. The dev overview shots
    from 95 m up reach 322.
- **Petals follow the player:** 150 in a 48 m box (SPEC: 150 on High),
  instead of Sakura Crossing's 980 along its street.
- **Measured (dev `?m2check`, headless Chrome, Apple M2).**
  - Straight end-to-end routes: 91–96 s at walking pace. A loop through
    every zone: 322 s. Nothing got stuck.
  - Fuji's peak is in line of sight from 87% of walkable sample points.
  - Frame time at 2560×1440: 6.7–7.1 ms.
- **Open question for Tan: walking time.** SPEC asks for a town of about
  250 × 200 m that takes about 3 minutes to cross. At Sakura Crossing's walk
  speed (2.55 m/s), 250 m takes about 100 s, so the two numbers don't agree.
  The town follows the size; crossing it takes about 1.5 minutes.
- **Deferred.** Crossing bells and all other sound (M4). The kei van, sign
  flicker and wet road (M6). The Lawson's ashtray and umbrella stand; the
  umbrella stand belongs by the door, which is in the famous frame.
  Pedestrians.
- **Status:** built and checked, pending Tan's sign-off. Tan's first read:
  "kind of okay". Needs a review pass before M3.

## M2a: Town kit and screenshot script

- **Render-check loop** (`scripts/shots.mjs`, `npm run shots`).
  - Runs the Vite dev server through its API and drives headless system
    Chrome (`channel: 'chrome'`, Metal). It uses the system Chrome because
    the cached Playwright Chromium didn't match Playwright 1.63, and this
    way nothing is downloaded.
  - `?shots` freezes game time (dt = 0), so frames repeat exactly. Two runs
    of the heroes diff at 0.000%.
  - Heroes 1/2/3 are diffed against `screenshots/baseline/` (taken before
    any kit code landed). Over 0.5% of pixels changed is a FAIL.
  - Frame time: 30 frames at 2560×1440, render scale 1.5, with readPixels
    fencing, the same method as M2's `?m2check`.
  - The old `?screenshots` mode is gone; `?tour` and `?m2check` stay.
- **Reference frames renamed** to `reference/density/NN-what-it-shows.png`
  so spots in `SHOT_SPOTS` can name them. Still untracked, like every
  third-party reference image.
- **Kit shown on a dev-only test street (`?kit`)**, not in the town. M2a is
  the kit; M2b replaces the town plan, and a kit applied to today's zoned
  town would be thrown away. `kit-test.js` is tree-shaken out of the build.
- **Network model.** Axis-aligned edges on a grid (SPEC asks for a tight
  grid). Junction rules: x roads carry their pavement round a corner, z
  roads butt against it, and a lane mouth cuts through a pavement. So
  slabs never overlap and corners are never bare.
- **Road classes (config.js ROADS).**
  - Lane: 4.6 m, 0.36 m gutters with lids.
  - Shopping street: 6 m, 1.6 m pavements.
  - Main road: 7 m carriageway, 1.5 m green cycle lanes inside the kerb,
    2 m pavements.
- **Decals.** Everything flush with the ground comes from one Canvas2D atlas
  in one static mesh: paint, manholes (sewer, water, fire, telecom, and
  the town's own sakura-over-mountain lid), grates, gutter lids, patches,
  cracks, stains, grit, petal drifts and tactile tiles. Decals write no
  depth, so the ink pass never outlines paint.
- **Marking rules.**
  - At a junction, the lower-rank road stops; between equal ranks, the z
    road stops.
  - 止まれ is skipped where a zebra already fills the approach.
  - ◇ is painted 30 m and 50 m before a zebra.
  - Speed numerals: 40 on the main road, 30 elsewhere.
  - About half the lanes are school zones (with green side strips) or
    歩行者優先.
- **Poles.**
  - One side per street, every 20–30 m.
  - A transformer on every 3rd pole, a lamp on every 2nd, a 消火栓 plate
    (with a yellow lid in the road) on every 3rd, an address plate on
    every 2nd, and ads on about 45% of the rest.
  - Guards on every pole: the reference frames show nearly all poles
    guarded.
  - Wires: 5 power and 2 telecom lines per street (SPEC: 4–8). Straight
    on, all of them span a junction; round a corner, three power lines
    and one telecom line do. Service drops go to every facade.
  - `makePole` gained options (plates, guard, telecom, anchors, lit
    plates). Its defaults are unchanged, so the M2 town and the hero view
    are byte-identical.
- **Lit plates.** Kit signs and pole plates use toon materials, not unlit
  ones, so they go dark at blue hour like everything else. Only lamps glow.
- **Names.** Ads, the address (富士見町), direction boards and the bus stop
  are ours, in `src/data/town.js`.
- **Measured.**
  - Kit spots: 103–203 calls, ~280k triangles, 5.0–5.9 ms per frame at
    1440p on an Apple M2.
  - Heroes: unchanged (0.000%), 5.6–5.8 ms.

## M2b: Dense town

- **Plan (config.js TOWN.grid, world/town-plan.js).**
  - South of the main road, a grid about 190 × 135 m.
  - The shopping spine runs at x −50 from the main road to the station
    plaza; lanes run every 25–35 m; the railway moved to the south edge
    (z 158), with its level crossing on lane x −80.
  - The grid lines become a kit network (every crossing is a node), so
    the M2a kit lays and dresses every street.
- **The north side is M2's, unchanged (world/town-edge.js).** It is what
  shows at the edges of the famous views, so it moved out of
  town-blocks.js as it was. Everything south of the main road sits behind
  the hero cameras' image plane (z > 16.5) and was rebuilt freely.
- **The main road keeps the photo's cross-section** (6.7 m, lawson.js).
  - It is a network edge the kit dresses but doesn't pave (`surface:
    false`).
  - Its cycle lanes are blue 自転車ナビライン arrows with bike symbols
    (SPEC allows green or blue).
  - The south walk breaks for every road that meets it
    (`mainRoadGaps()`).
- **Golden-hour shadows set the rules near the hero view.** The sun is 14°
  up, from the east.
  - No poles or signs from x −30 to 55 on the main road (quiet zone);
    a pole there throws a 35 m shadow across the forecourt.
  - Lots from x 4 to 28 are one storey; from x 28 to 62, two.
  - Hero 2 differs from the M2 baseline by 0.357%: M2's two south-frontage
    poles (x −10, 20) are gone, and so are their shadows on the forecourt.
    M1 had neither. Heroes 1 and 3 are identical.
- **Lots and mixing (kit/lots.js, kit/buildings.js).**
  - Lots are 7–12 m wide with 0.5–1.5 m gaps, up to 14 m deep, so they
    meet back to back. Busier streets are cut first.
  - Spine and main road: 70% shop-houses. Lanes: 12% shops, 50% on
    corners. Trades are dealt from a shuffled deck.
- **Generators.**
  - Houses (kit/houses.js) have four styles on the library house:
    siding, mortar, old/kawara and modern. Attic houses, terraces and
    walk-ups add variety. Fronts are dressed by yard depth, and side walls
    get windows.
  - Shopfronts (kit/shopfronts.js) have 14 trades on the library shop
    unit. The recess is 1.9 m deep, with shelves, counter, washers or
    chairs and a lit ceiling panel. Clutter is chosen per trade.
  - All new names are in src/data/town.js.
- **Special lots (kit/specials.js).**
  - Inari shrine (富士見稲荷神社): two torii, foxes, lanterns, nobori and
    a small hall.
  - Coin parking (ふじみパーク): a corner plot, shrunk so a building and a
    pole stand within 25 m of its middle. The photographers' strip round
    x = 0 stays clear.
  - Apartment (ふもと荘): 2 floors, on the library walk-up.
  - Vacant lot (売地, 富士見不動産) and tiny park (ふじみ ちびっこ広場).
  - The plaza is paving, a big sakura, a ring of benches and bike racks;
    M2c brings the station.
- **Density check (kit/density.js; `npm run shots` prints it).**
  - It works from a registry the generators fill, because batching
    merges the scene away.
  - A building counts if any point round its footprint is inside the view
    cone within 25 m; there is no occlusion test.
  - "Bare" is measured along both frontages and down the asphalt of
    every kit street. Special lots, and quiet zones (the hero window, the
    railway), count as covered.
- **Walkability.**
  - The shopping pavement is 2.2 m, not 1.6 m, so a pole and a shop's
    clutter never meet across it. Poles stand at the kerb; pavement
    clutter has colliders of at most 0.3 m.
  - `?m2check` scans both spine pavements for a gap the player (0.34 m)
    fits through at every 0.25 m. Its walker now uses the carriageway,
    because it steers straight at waypoints.
- **Performance.**
  - A texture atlas at batch time (merge.js): multi-material meshes are
    split per group, and every non-repeating texture is packed into
    4096² pages with remapped UVs. Signage then batches by style.
    Street-level draw calls fell from 1,100–1,360 to 250–450, and frame
    time from 10.7 to about 7 ms. The Lawson opts out (`noAtlas`) so the
    famous view keeps its textures.
  - Kit wires use 8 × 3 tubes (M2's keep 14 × 4).
  - A distance-culled "detail" layer (small props in 32/64 m cells) was
    tried. It cut triangles by about 0.25M but added calls and time, so
    it is off. The hook (`userData.detail`, `detailCell`, `cullDetail`)
    stays for M2d.
  - Measured (headless Chrome, Apple M2, 2560×1440): 5.7–8.9 ms at
    every spot. Draw calls are 160–450 at street level and 550 from the
    overview. Triangles are 1.5–2.0M per frame, shadow pass included.
    **Over SPEC 11's budgets (< 300 calls, < 1M triangles)**: M2d's
    performance pass, with distance-based detail for far buildings.
- **Bug fixed in the parts library:** `makeWall` made NaN geometry for any
  run under 0.9 m (n = 0). This was behind the console's NaN warnings,
  including M2's.
- **Sakura Crossing names.** The walk-up's block plates carried ひばり台
  and さくら坂 names; they are ours now. `npm run check:names` builds and
  searches the bundle for 15 names: none.
- **Measured (`?m2check`).**
  - Walk routes: 0 stuck points on all four.
  - Fuji's peak is in line of sight from 67% of walkable points (M2:
    87%; the bar is "most").

## M2c: Station and trains

- **Layout (config.js TOWN.rail, TOWN.station).**
  - The line runs along the south edge: double track at z 160.1 (track 1,
    eastbound) and z 163.9 (track 2, westbound). Trains keep left.
  - The station building (x −64..−38, z 148–155) closes the plaza at the
    end of the spine. Its concourse is at platform height, up six steps
    from the plaza, and platform 1 is through its ticket gates.
  - Platform 2 is reached by an in-station crossing (構内踏切) at the east
    end, not a footbridge (SPEC allows either). It is lighter and can be
    walked end to end.
  - The public level crossing is on lane x −80, 6 m west of the platform
    ends.
  - Lane z 146 moved to 144, so the lots south of it stay 7 m deep.
- **Our own line, not Sakura Crossing's.** Its railway is single-track and
  built round its own street constants; `line/track.js` and
  `line/crossing.js` are new. `railway.js` and `train.js` stay in the parts
  library, and `town-rail.js` (M2's placement of them) is gone.
- **Our own train (`line/emu.js`).** It keeps the library EMU's
  proportions, but every car is a shell:
  - side walls are built between the door and window openings, with a
    cream lining inside;
  - the interior is real: long bench seats, poles, racks, straps, lit
    ceiling strips;
  - door leaves slide into the wall pocket;
  - at night the interior glows (`setNight`, driven by the look).
  - **Passengers:** a few dark silhouettes, seated and standing. SPEC asks
    for them. The library train's "no people" note was Sakura Crossing's
    own rule.
- **Two sets, one per track.** One set can't manage the SPEC headway: it
  needs about 30 s to run out and 30 s to run back in, so the next arrival
  60 s after a departure has to be the other set. Each set runs out into
  the fog and waits there for its next turn.
- **Service timings (line/service.js SERVICE).**
  - Cruise 22 m/s; brake 1.0 m/s²; accelerate 0.9 m/s².
  - Doors open over 1.6 s; dwell 60 s; chime 1.4 s; doors close over 2.2 s.
  - The set holds 3 s, then departs.
  - The next arrival is timed for 60 s after the departure.
- **Crossing logic.**
  - For each set, the service steps a copy of its motion forward (0.25 s
    steps, 25 s horizon) to predict when the front will be within 4 m of
    the crossing. That covers cruising, braking to a stop short of it, and
    sitting at the platform about to depart over it.
  - The crossing closes under 25 s and stays closed while any part of a
    train is within 4 m.
  - Lamps and bells come first; the arms follow 5 s later, lower over 6 s
    and rise over 5 s. The direction arrows show which way the train is
    going.
  - Westbound trains stop 10 m short of the crossing, so the gates come
    down about 20 s before they leave: what real stations beside a crossing
    do.
- **Checked by `?traincheck`** (in `npm run shots`): 20 min of service in
  1/20 s steps.
  - Dwell 60.0–60.1 s; the chime always comes before the doors close.
  - Headway 59.6–59.7 s; tracks and directions alternate.
  - The crossing was open with a train within 4 m at 0 of 24,001 steps;
    lamps were off while the arms were down at 0 steps.
- **Sound, minimal until M4 (`core/sfx.js`).**
  - Crossing bells: positional, from assets/audio/crossing-bells.mp3 when
    it loads, else SPEC 9's procedural FM bell.
  - Door chime: an original three-note phrase.
  - Started by the same click as the music. M4 folds this into its
    engine.
- **Density at the station.**
  - Catenary masts register as poles (they are poles with wires). They
    stand every 20 m, skipping the level crossing and the ticket-gate
    aisles, plus one at x −42.
  - Added, as real stations have: a waiting room on platform 2, a toilet
    annex, a kiosk beside the entrance, a police box and a café on the
    plaza, a light by the steps.
  - A row of houses beyond the line, out of bounds, faces the tracks,
    like the reference frames.
  - `town-crossing` is retired: it was M2b's placeholder view of the same
    crossing, which `crossing-train` now covers from 12 m closer.
  - Several spots were re-aimed. The 25 m / 70° cone is strict at the
    edge of an open plaza, so each spot looks the way its reference frame
    looks.
- **Names.** Station 「さくら富士」 (M2); the line 富士見線; the stations in
  between (ふじみ台, こもれび野, 富士山麓) are ours, and the termini (大月,
  河口湖) are real towns. Also ours: ふじみ売店, 富士見交通 and the
  community bus plate. The parts library's bus-stop plate said ひばり台;
  it doesn't now.
- **Measured.**
  - Heroes unchanged (1 and 3: 0.000%; 2: 0.356%, as M2b).
  - Frame time 6.0–8.1 ms at 1440p at every spot.
  - Draw calls rise to 500–650 where a train stands at the platform: the
    two sets, their glass and doors. Still M2d's performance pass.

## Local sounds (Tan, after M2c)

- **Rule, town-wide:** a place's sounds and interactive cues are heard only
  as the player nears that place, never across town. It is in SPEC
  section 9 and AGENTS.md, and M4 builds every positional sound on it.
- **Why:** the crossing bells faded out only at 180 m, so they carried to
  the Lawson (176 m away) and ticked through the famous view.
- **How:** config.js `SOUND` gives each sound a `near` (full volume) and a
  `far` (silent) range, with an eased fade between (`falloff` in
  core/sfx.js). Beyond `far` a sound is not playing at all.
  - Crossing bells: near 10 m, far 45 m. They carry to the plaza's south
    edge (23% at 34 m) and fade out by the middle of the plaza.
  - Door chime: near 5 m, far 28 m (the platforms and the ticket gates).

## M2d: town polish

- **Sakura.** The town south of the main road gets its own cherry
  (kit/sakura.js); M2's north side keeps the library tree, since it frames
  the famous views.
  - 4–7 limbs, each forking. Blossom clumps number 85 per tree (150 on
    hero trees), in three tones by height, with drooping outer clumps.
  - Hero trees (scale 1.5–1.9) stand at the plaza, shrine and park.
  - Every town tree is one wood mesh plus instanced blossom.
  - A clump is six small round balls merged: one sphere reads as a
    balloon, and a low-poly sphere reads as a gem. Beyond 40 m a clump is
    one ball.
  - Petal drifts are decals in a ring under each tree.
- **Petals.** The air field (150) is unchanged, so the hero frames are
  unchanged. A second field (250) falls only from canopies near the
  player: it respawns at a tree and never wraps around the camera.
- **Night** (kit/night.js, driven by the look's shop spill).
  - House windows: 55% lit warm (#ffd9a0), the rest dim violet.
  - Warm glow behind shop glass and station doors.
  - One additive mesh of light pools under lamps, shopfronts, vending
    machines, canopies and the station entrance.
  - The blossom keeps a little pink after dark.
- **Life** (kit/life.js).
  - 60 sparrows on the power lines and 4 crows.
  - Ground flocks in the park, plaza, shrine and vacant lot. They hop and
    peck, fly up to a wire within 3.2 m, and come back once the player
    has gone 8 m away.
  - Cats swish their tails.
  - Only birds within 32 m are animated.
- **Clutter.**
  - Shops: AC units and gas meters on their flanks.
  - Station front: downpipes, posters and vending machines.
  - Walk-road props sit on the kerb edge, with colliders no deeper than
    0.3 m, so every pavement stays walkable.
  - Idle people (optional) are not added: the triangle budget below does
    not pass.
- **Performance.** No visible quality cut, as AGENTS.md requires. Lossless
  changes only:
  - Train doors: only the platform side opens, so each car has two
    sliding groups (baked per material), and the far side's leaves batch
    with the body. This removes about 220 meshes.
  - Fences share one chain-link texture, with the tiling baked into UVs.
    The batcher now does the same for any texture clone that differs only
    in repeat or offset (merge.js `mapKey`/`uvBaked`).
  - Glow panels are no longer `keep`, so they batch.
  - Small props (the kit's `detail` tag) receive shadows but cast none.
  - Blossom: clumps outside the view cone (plus a 0.45 rad margin) are
    not drawn. They are re-sorted after a 2 m move or a 0.15 rad turn.
  - Blossom shadows come from stand-ins drawn only into the shadow map
    (`userData.shadowOnly`, main.js wraps `shadowMap.render`): the full
    clump within 30 m, one round ball beyond. Only those that can fall in
    the sun's shadow box are included.
  - A single ball (icosa 0) was tried as the shadow stand-in and dropped:
    its shadows showed as hexagons on the park grass.
  - 64 m cells were tried: 20–30% fewer triangles, but 40–50% more
    calls. Kept 128 m.
- **Measured** (shots, 1440p, Apple M2).
  - Frame time 6–12 ms at every spot: 60 fps passes with room.
  - SPEC 11 budgets do **not** pass at street spots:
    - calls 200–490 (overview 609);
    - triangles 1.1–2.5M, all passes;
    - main pass alone 0.75–1.54M.
  - Before M2d's performance pass, the lane view was 695 calls and
    2.92M triangles; it is now 492 calls and 2.27M.
  - The remaining calls are real material differences: toon band ramps,
    tints, live night materials, hulls.
  - The remaining triangles are the dense town inside 128 m cells, drawn
    in both passes, plus Fuji (209k).
  - Closing the gap needs far-building LOD proxies and a shared toon
    material. Neither is polish; both are proposed for a later milestone.
- **Heroes:** 0.000 / 0.356 / 0.000%. Density 27 of 27 and bare stretches
  pass; traincheck passes; no Sakura Crossing names.

## M2e.3: the town moves between the Lawson and Fuji (Tan)

- **Why:** the game opens on the famous views, but the town lay behind the
  player, south of the main road. Tan wanted to walk *ahead* past the
  store into the town, toward Fuji.
- **How: a rigid half-turn, not a rebuild.** Everything that makes up the
  town is built as before, in its own tested frame, inside a context
  turned 180° about the main road's centreline
  (world/ctx.js `turned`: local (x, z) → world (−x, 27.7 − z)).
  - It is a rotation, not a mirror, so signs, text, stairs, the trains, the
    crossing's timing, lots and density all keep working as tested.
  - M2's old north side (the residential lane, park and fields) turns with
    it and now lies south, behind the start.
- **What stays in world coordinates.** The Lawson, its forecourt, the main
  road's walks, ends, signals and crosswalk, the Lawson's own dressing and
  the two sakura framing the view (town-edge.js `buildFrame`).
- **What crosses the boundary.** The only places the two frames meet:
  - colliders and platforms (ctx converts them);
  - the line's crossing and events, and train gusts (a facade in town.js);
  - the sakura and bird cameras (a turned camera proxy);
  - petal emitters, the Lawson's lot decals, and the density registry
    (kept in the town's frame);
  - shot spots (`frame: 'core'`, turned by `__shot`);
  - `PLACES` (`placeAt`).
- **A frame bug found and fixed.** The kit read positions with
  `matrixWorld`. Under the turn, the wire anchors, service drops, lamp
  pools and one registry point were turned twice, and the wires tangled
  across the sky. They now use positions in the builder's own frame.
- **The famous views' sightline.** From the hero camera the store's
  roofline is about 4.5° up, so behind the store, inside the frame:
  - buildings take a height envelope (floors from the sightline over each
    lot's nearest edge);
  - a 10 m pole would show until about 80 m back, so poles there are
    replaced by 4.5 m lamp posts (防犯灯) with no overhead lines, and houses
    there take no service drop (TOWN.lowPoles);
  - the apartment block lights its entrance with one.
- **The Lawson's ground is reserved** in the town's frame (TOWN.lawsonReserve).
  - The x −25 lane starts at the back of the forecourt instead of crossing it.
  - The coin parking moved west of the forecourt.
  - M2's two low houses behind the store went, because the town's own lots
    stand there now.
- **The famous views moved by 1.2–1.7%**, all at the frame edges beside the
  store (the town's houses behind its corners). Re-baselined, on Tan's
  standing OK for view changes during M2e.
- **Checks.** Density 27 of 27, bare stretches and traincheck pass; frame
  time 6–9.5 ms at 1440p.
- **Contention in timings.** Timings taken while the in-app browser pane
  was running the game read 2–4× slower. The pane is blanked for
  measurements now.
- **Next.** M2f (added to SPEC) draws the minimap from config.js PLACES.

## M2e Phase 3: the sakura, painted

- **What the reference does.** Its canopies are still faceted clumps; the
  difference is the paint. Florets over each clump, pink shading to lilac
  underneath, lacy rims with sky between, many thin twigs, and the ground
  washed pink under each tree.
- **Florets** (kit/paint.js `floretTex`). A tiling skin of about 900
  five-petalled florets with pale centres, over soft cluster blotches. The
  tones (light, mid, deep by height) are now pale; the florets bring the
  pink. The shade side is a soft lilac, and the new `blossom` ramp
  (202/230/255) turns a clump gently instead of in a hard band.
- **Cushions, not balls.** Clumps are flattened (y 0.55–0.7) and widened.
  Hero trees carry 200 of them, others 95.
- **Lacy rim** (`blossomCardTex`). Alpha-cut sprays of florets on twigs
  stand out past the outer clumps. They are instanced per tone, culled with
  the view like the clumps, and their normals face up and out, so both
  sides shade alike.
- **Wood.** Limbs bend: they rise to a knee, then reach out. Hero trees
  have 6–8 limbs spreading lower and wider. Three fine twigs fan out from
  every branch end, past the blossom.
- **Petal carpet** (decal `petalCarpet`, 2 × 2 cells). A pink wash, then
  9000 fine petals with a ragged edge, 6 m across under an ordinary tree
  and 8.4 m under a hero tree (× its scale), on top of the old drifts.
- **Every cherry is the painted one now.** The old park's trees join the
  town's batch. The two framing the famous view get their own small batch
  in the world's frame (town.js). The famous views changed 1.6–2.0% at
  their left and right edges; re-baselined.
- **Checks.** Density 27 of 27, bare stretches, traincheck; 5.5–9.7 ms at
  1440p.

## M2e Phase 4: greenery

- **One tree builder, many species.** The painted cherry's builder became
  kit/canopy.js, parameterised by a *look* (form, tones, skin, rim cards,
  ground). The sakura is one look (kit/sakura.js), and the refactor is
  pixel-exact: the heroes stayed at 0.000%.
- **Species** (kit/green.js), all painted with leaf skins and rim sprays
  (kit/paint.js `leafTex`, `leafCardTex`, `needleTex`):
  - zelkova, the street tree: a vase of upward limbs, fresh spring green;
  - camphor, the shrine's and the parks': round, dense, glossy;
  - maple, green or red: small, layered;
  - pine, the clipped garden pine: flat pads only, on a leaning trunk;
  - shrub: the plant in a pot.
  - Green's shade side is blue-violet, never grey-green, in the palette's
    shadow family.
- **Where they grow:**
  - zelkovas in grated pits along the main road's north walk. West of the
    Lawson only from the coin parking on, east only past 70 m, because the
    golden-hour sun would lay a nearer tree's shadow over the famous
    views' forecourt;
  - a camphor and a zelkova in the park and in the old park, two zelkovas
    at the plaza's road corners;
  - the shrine's sacred camphor (神木), girdled with a shimenawa and its
    shide;
  - garden trees behind 45% of lane walls with a yard (pine most often).
- **Pots** (`potCrowd`). Clay, glazed and plastic pots of every size, and
  styrofoam boxes of seedlings, each with a painted plant. They crowd 70%
  of doorsteps with a yard, and the street edge of 45% of houses without
  one (Tan's Yotsugi photo).
- **The library's planters and pot shelves.** Their shared leaf materials
  now carry the painted leaf skin, and their foliage is round and
  smooth-shaded, so they match the new trees.
- **Weeds.** Crossed-quad tufts in one instanced draw: at lane wall feet
  and gutters, round poles, and a field of them in the vacant lot.
- **Ivy** on 30% of block and timber walls.
- **Cost.** Empty instanced sets are hidden, and so are empty shadow
  stand-ins. About 50 more calls at the famous view; 4.3–8.6 ms at 1440p.
- **Checks.** Density 27 of 27, bare stretches, traincheck; heroes 0.000%.

## M2e Phase 5: buildings

- **Behind the glass.** One painted atlas of 8 window interiors
  (kit/paint.js `windowAtlas`): lace curtain, drawn curtains, venetian
  blind, frosted bathroom glass with bottles, a dark room with the sky's
  sheen, a plant on the sill, shoji, a roller blind. Every pane picks a
  cell (`windowCell`). Frosted glass is likelier low down; shoji go on old
  hip-roofed houses.
- **The same atlas lights the night.** It is the night glass's emissive
  map, so a lit window glows through its curtains or blind instead of as
  a flat panel.
- **Sashes.** Aluminium in silver, bronze or grey per house, with the two
  leaves' meeting rails. 40% of houses have 面格子 grilles on their
  ground-floor windows.
- **Sill streaks.** A soft painted streak under every window, front and
  side (`sillStreakTex`), darkest under the sill's ends. The wear atlas
  dropped its guessed sill streaks; these sit under real windows.
- **Downpipes.** PVC in grey, beige, brown or white per house, with wall
  brackets and a shoe at the foot.
- **Steel stairs.** The walk-up's stair is now painted steel (maroon,
  brown or grey) on stringers, with rust showing through (Tan's photo 1).
- **Storage sheds** (物置). A steel garden shed with sliding doors and a
  sloped lid in 30% of lane gardens with room; half of them rusting.
- **The famous views moved 0.10–0.12%** (window detail at their edges), well
  within the guard, so no re-baseline was needed.
- **Checks.** Density 27 of 27, bare stretches, traincheck; 4.4–9.1 ms at
  1440p.

## M2e Phase 6: shopfronts and ground

- **Paper on the glass.** 80% of open shops have one or two notices taped
  inside the glass: hand-lettered, sun-faded at the top, tape at the
  corners (kit/paint.js `noticeTex`). The wording lives in
  data/town.js `SHOP_NOTICES`: staff wanted, today's special, hours, a
  closing notice, a cashless sticker, the cherry festival.
- **The closed shop** carries the estate agent's 貸店舗 board on its shutter
  (`FOR_RENT`).
- **Worn shutters** (`wornShutterTex`), on every shop that has one: grime
  rising from the ground, rust running from the slat joints and along the
  bottom rail, the scuff where it is pushed up, an old sticker.
- **Interiors.** Packets on the shelves have label bands and a shine, with
  price cards along the shelf edges (a third are red sale cards). Most
  shelved shops hang a POP banner. The ramen, soba and wagashi shops have
  the row of wooden menu tags (品書き) along the top of the back wall
  (`MENU_TAGS`).
- **Red paving** (カラー舗装, decal cell `red`). The lane in front of the
  shrine is surfaced red-brown between its two junctions, worn pale in the
  wheel tracks.
- **Timings under load.** A full run read 19 ms at one spot while the
  machine sat at load 7. Back to back under the same load, Phase 5 and
  Phase 6 read 8.8 and 9.6 ms at that spot: the cost is under 1 ms.
- **Checks.** Density 27 of 27, bare stretches, traincheck; heroes
  0.10–0.12%.

## M2e Phase 7: review against the references

Every fixed spot was compared side by side with its `reference/density/`
frame (screenshots/<date>/*-vs-ref.jpg), using japan-details.md as the
checklist.

**Close to the reference**
- **Shopping street (spine-north).** Fuji now closes the view. Shop
  fascias, poles, wires and the zebra match. Missing: the petal carpet on
  the road and the crates and banners crowding the fronts.
- **Lanes (lane-houses, lane-junction).** Green school strips, 止まれ, pots,
  garden trees, block walls, windows with curtains and the steel stair all
  read as a real lane. Missing: a shop or shrine on the corner, as the
  reference has.
- **Station plaza.** The big cherry, benches, the petal carpet, the clock
  and the kiosk. Missing: people, a post box, bollards and a paved grid.
- **Sakura close-up.** Florets, lacy rims and twigs, near the reference's
  canopy.

**Short of the reference**
- **Shop interiors (spine-shops).** Ours read as a painted back wall. The
  reference's are deep rooms, with counters, freezers and lit shelves, seen
  through the glass.
- **The main road (main-west, main-east).** Since the town moved, the
  road's south side is the old town's fields. The reference has houses on
  both sides. The frontage behind the start needs building up.
- **The shrine.** Ours is an open gravel lot behind a fence. The
  reference's sits tight among a ramen shop and houses, with lanterns, a
  notice board and a 手水舎.
- **The park spot.** It is badly aimed: a fence fills the frame.
- **The station inside (gates, to-platform).** Ours shows plain gates in
  front of a train's side. The reference has a ticket window, clock, fare
  board, 有人改札, a ceiling with lights, and posters. Two spots also stare
  into the train at close range; they need re-aiming.
- **Platforms and the line (departures, train-at-platform, canopy,
  crossing).** Ours has no ballast (the track bed is flat grey), no
  sakura along the line, and plain fences. The reference lines the tracks
  with cherries, gravel, the platform clock and people.

**Measurements** (load 13–15 on this machine; the unchanged kit street,
normally 5.9 ms, read 10.8 ms, so figures are about 1.8× high)
- **Frame time.** 10.7–18.7 ms measured, about 6–10.5 ms idle
  (estimated): 60 fps at 1440p.
- **SPEC 11 budgets.** Not met: 300–780 calls, 1.9–3.5M triangles (all
  passes).
- **Other checks.** Heroes 0.10–0.12%; density 27 of 27; bare stretches
  pass; traincheck passes; no Sakura Crossing names.

## M2e round 2: closing the gaps the review found

- **The main road's far side.** The lot cutter builds a frontage row of
  shops and houses facing the store across the road (TOWN.frontRow),
  except on the photographers' lot where the famous views stand
  (TOWN.photoLot). The old town's fields pulled back behind it.
- **Shop rooms.** Recesses are now 3.4 m deep rooms furnished by trade
  (shopfronts.js `furnish`), goods baked per colour:
  - general stores and grocers: stocked wall shelving, low islands you
    can see over, a counter and register, a lit drinks fridge;
  - ramen, soba and wagashi: a counter with stools and a kitchen shelf;
  - cafés: tables and chairs, and a coffee machine;
  - laundromats: stacked machines; barbers: chairs and mirrors;
  - fluorescent strips on every ceiling.
  - The fittings take a little warm light (emissive 0.3–0.45), so a lit
    shop reads brighter than the shade under its awning.
- **The shrine.** A 手水舎 water pavilion with ladles, an 絵馬 rack, the
  prayer-notice board, an offering box with the bell rope, and paper
  lanterns strung along the approach.
- **The line.** The track bed is painted gravel (`gravelTex`). A row of
  cherries runs between the south fence and the houses beyond, clear of
  the level crossing.
- **Re-aimed spots.** train-at-platform stands along platform 2;
  station-gates takes the window, clock, gates and board at an angle;
  station-to-platform is on the gate line; the park looks down its
  cherry-lined street. The two concourse spots are `indoor`: the density
  check skips its building count there, since the room is the one
  building in view. Every other count still applies.
- **Checks.** Density 27 of 27; bare stretches; traincheck; heroes
  0.10–0.12%; no Sakura Crossing names. Measured near idle (the kit street
  read 6.15 ms against its usual 5.9): 5–13 ms at every town spot, so
  60 fps at 1440p passes.
- **Still open.** SPEC 11's draw budgets (300–780 calls, 1.9–3.5M
  triangles, against 300 and 1M); a ticket window with a staff member;
  people.

## M2f: the minimap

- **Keys.** M opens the full map; sound moved to N (Tan). The pause
  screen lists both.
- **One painted map, drawn once** (src/ui/mapArt.js), from the game's own
  data turned into the world:
  - the kit network's roads (pavements under the asphalt, the shopping
    street darker), the Lawson's road and forecourt;
  - building footprints from the density registry, the special lots in
    their colours, the railway with both tracks, the platforms;
  - the old town's lane, park and fields, and the Lawson in its blue.
  - It cannot drift from the town: move a lot and the map moves with it.
- **The corner map** (src/ui/minimap.js). 196 px, 60 m to the rim, turned
  so you face up; a compass ring with 北 in red; place icons upright (a
  glyph in a coloured disc). The Lawson is always on it, pinned to the rim
  and pointing home when it is out of range. It is redrawn only when you
  move or turn, as a single drawImage: no measurable frame cost (vsync
  held at 16.7 ms while turning).
- **The full map.** North up, every place in Japanese over English, the
  labels placed clear of one another, 現在地 over your arrow. While it is
  open you neither walk nor look; Esc (leaving pointer lock) closes it.
- **Kept off the famous views.** Hidden while you stand on a famous view
  (the game opens on one) until you walk 1.5 m off it; hidden on the start
  and pause screens, with the reference overlay, and in dev captures.

## M3a: the store interior

- **Research first.** reference/konbini-details.md records a Lawson's
  plan, fixtures, the counter and the room, and is the checklist for every
  interior spot: 29 of 30 details are in (the charity box and small goods
  at the register wait for M5).
- **Painted, not lit.** A konbini is lit evenly from a ceiling full of
  lights. So the room uses unlit, vertex-coloured materials with each
  face shaded by hand (store/painter.js), and the ink pass draws every
  edge. The sun's shadow through the roof would otherwise darken the
  room, and the cost stays low. Every material is white-based and joins
  the store's `lit` list, so the look scales the room's brightness.
- **The plan** (store/interior.js). Looking in from the door, which is
  left of centre:
  - **left wall:** the ticket kiosk (red, generic), copier and ATM, then
    the open chilled case;
  - **back wall:** an 8-bay walk-in cooler with bottles in columns and a
    price rail on every shelf;
  - **the floor:** four 1.5 m gondolas, below eye height so you see over
    them to the drinks, with end caps and POP cards (新商品, おすすめ,
    期間限定, お買い得);
  - **front:** the magazine rack along the glass, behind the pale-blue
    film;
  - **right:** the counter, with the hot showcase, steamer, two
    registers, oden and the self-serve coffee at its end; behind it the
    numbered cigarette wall, microwaves, the back counter and the staff
    door;
  - **back right:** the toilet door;
  - hanging category signs, LED troffer rows, a tiled floor with a
    sheen, a mirror and dome cameras.
  - Aisles are 1.4 m.
- **The door.** Two sliding leaves in the store's glass. They open within
  1.8 m, close 2 s after you are clear, and are solid until mostly open.
  The store's solid collider became walls, fixtures and the glass either
  side of the door. Walked in and out headless: the door opened and
  closed, the aisles were walkable, the cooler and glass were solid.
- **Slots.** Every shelf run is recorded (zone, position, facing) for
  M3b's products. The painted blocks on the shelves are filler until then.
- **The famous views changed 4.5–5.8%**: the real room shows through the
  glass instead of the painted card. They await Tan's OK before
  re-baselining.
- **Cost.** Hero-1 is 9.5 ms at 1440p; with the interior hidden, 9.7 ms.
  No measurable cost.

## M3b: the products

- **The catalogue** (data/catalog.js): SPEC 7's 30 products in its Product
  shape. The names are ours (やすらぎ緑茶, あさの微糖, うすしおポテト, きのこチョコ
  and so on) and every package is generic.
- **Painted packaging** (store/labels.js). One 2048 atlas with a 256 px
  cell per product, each designed by shape:
  - an onigiri's clear wrapper with grains, nori and its name strip;
  - a bento seen through its lid; a sandwich cut to show its filling;
  - a bottle's wrap label (the name twice round, so it reads from any
    side); boxes, bags and pouches with bands and names;
  - melon pan's crust.
  - A second atlas holds the shelf tags: name, ¥price, (税込).
  - Labels are seeded, so they are the same on every load.
- **Shaped meshes** (store/products.js). Rounded onigiri and sandwich
  prisms, PET bottles with shoulder and cap, cans, a codd bottle with its
  marble, gable-topped cartons, puffed chip bags, cups with lids, bento
  with lids, melon pan domes, umbrellas, and the hot items. Each is hand-
  shaded like the room, with the label mapped front, wrap or top.
- **One unit drawn per facing.** A slot's stock (3–6) is a count behind it,
  so the stock is 2,450 facings (11,212 units) in 31 instanced draws, about
  265k triangles. Drawing every unit would have been over 600k.
- **The planogram** (store/planogram.js) fills every recorded slot in
  blocks of facings, with a price tag under each block, and no filler:
  - chilled case: onigiri on the lowest decks, then sandwiches and salad,
    bento, pudding;
  - cooler: the six drinks in blocks of two;
  - gondolas by aisle, each end cap with a featured product;
  - karaage and nikuman in the hot case and steamer, oden, coffee cups;
  - ice under the freezer lids (the tinted lid became an open top with a
    rail), and umbrellas in a stand by the counter.
  - Every unit is recorded { id, mesh, index, position, count } for M3c.
- **Cost.** The famous view is 9.3 ms at 1440p with the stock (9.7 ms with
  the interior hidden).
- **The famous views changed about 1%:** real products through the glass.
  This awaits Tan's OK before re-baselining.

## M3b.2: a konbini's stock (Tan: "okay but not impressive")

- **Research first** (reference/konbini-details.md, section 8). The key
  finding: real konbini are organised by category in *vertical* blocks,
  both door by door in the cooler and section by section in the chilled
  case. M3b's deck-by-deck rows are what made it look fake.
- **The store is 13 m deep, not 10.** It grew backwards, behind the
  famous facade, which is unchanged.
- **82 products.** The 30 are kept (SPEC 7: adding items is data-only),
  and the new ones cover the range people remember. Every one is an
  evocation with an original name. Real brands are refused by
  check-names, which now lists 44 real brand names alongside the Sakura
  Crossing ones.
- **The cooler.** 8 doors by category with header signs, 6 gravity shelves
  sloped 8° toward you, blocks of facings two deep, 冷えてます stickers.
- **The chilled case.** Onigiri (leaning back on sloped decks),
  sandwiches, bento and noodles, salads, sweets (fruit sando, roll cake,
  cream puff, cheesecake, pudding), dairy. Each section has a canopy strip.
- **Ice.** An open flat case (冷凍平台) of 12 wire baskets piled two deep:
  premium cups, mochi ice, soda and chocolate bars, cones, family packs,
  kakigori. Plus an upright freezer for bags of ice and frozen food.
- **Tan's additions:**
  - the self-serve smoothie corner: a fruit-cup freezer and two blenders;
    the drinks are made in M5 and M6;
  - an eat-in counter at the right-hand window, with stools, two
    self-serve microwaves and a sanitiser;
  - a generic battery-rental kiosk by the ATM;
  - an alcohol shelf (one-cup sake, whisky, wine, otsumami).
- **Bugs caught on the way.** The two new freezers and the ice case were
  first built as solid boxes, which hid their stock; they are now hollow.
  The ice case's well was too deep to see into from standing height; its
  floor was raised and the stock piled.
- **Cost.** 82 instanced draws, 4,744 facings on show and 15,715 units.
  The famous view is 10.3 ms at 1440p.
- **The famous views changed 2.0–2.3%** (the eat-in at the window, the new
  stock). They await Tan's OK.

## M3c: picking up and the basket

- **Aiming is boxes, not meshes.** One box per shelf facing (the front unit
  unioned with the rows drawn behind it), plus the fridge doors and the basket
  stack, tested in the interior's frame. 3,580 facings take 0.03 ms a frame,
  and the test only runs inside the store. Shelf boards don't block the ray; at
  worst you can reach a facing just past a board's edge.
- **Facings keep their stock count** (the planogram's `unitsPerSlot`). Taking
  one lowers it; the next unit slides forward 0.25 s later, which is the
  gravity shelf; the drawn rows behind thin out as the count falls below them;
  the last one leaves a gap. The ice case's piles have no slide: the top layer
  goes first.
- **What you carry is drawn over the world, not in a separate pass.** The
  plan said an overlay pass in post.js, but clearing depth for it would have
  cost the ink pass the world's depth. Instead the basket's and held items'
  materials squeeze their depth into the nearest 2% of the range
  (`onTop`, store/basket.js). They never sink into a shelf you stand against,
  they still write depth, and the ink still outlines them.
- **The basket is blue, not red** (SPEC 5 says red). The store's own stack
  is blue, as Lawson's baskets are, and the one you carry is one of those. It
  has no logo: the basket isn't on AGENTS.md's branding list.
- **Fridge doors** replace the single glass sheets: 8 cooler doors, 2 on the
  upright freezer, 2 on the smoothie freezer (it has a middle post). Each
  door is a pivot with its frame, handle and pane; the 冷えてます stickers
  moved onto the leaves. They don't block walking; you step round them. The
  famous views moved 0.14–0.16% (the pane now stops at each post), inside
  the guard; that costs 25 more draw calls.
- **The panel is keyboard-driven** (W/S, X, Tab): the pointer stays locked,
  as with the full map.
- **Deferred:**
  - the sounds of taking, the doors and the basket (hooks are in place for M4);
  - the hot case (asked for at the counter), the coffee station and the blenders (M5/M6);
  - the wallet in the HUD (M5).
- **The code:** store/shop.js (aiming, taking, flights), store/doors.js,
  store/basket.js, ui/basketPanel.js. The test trip is scripts/_m3c.mjs.

## M3d: Tan's store feedback: ホタル, English UI, a real range

- **The store is ホタル / HOTARU.** Tan made the store generic and kept the
  Lawson look. The name is a firefly: a small light at dusk below Fuji. It
  is six letters, the same as LAWSON, so the wordmark panel is unchanged.
  The milk can is Lawson's trademark, so our own emblem replaces it: a
  firefly with a lit tail in a ring. The blue, the white panels and 野菜 /
  くだもの stay. The name lives in config.js `STORE_NAME`. check-names now
  refuses LAWSON / Lawson / ローソン in the bundle. The code keeps its
  lawson.js file names (the identifiers aren't seen by players).
- **The game's title is "Hotaru Fuji".** It follows the store; one string.
- **Instructions are English only** (strings.js; SPEC 10 rewritten). Product
  and place names show their Japanese as small secondary text.
- **The ¥1,000 wallet refuses, it doesn't warn.** What would take the basket
  over ¥1,000 stays on the shelf: the rim goes red and shakes, and a red
  toast says how much is left and what the item costs.
- **The shopping card** (top left) appears when you take a basket or pick
  something up by hand. It shows the wallet, the basket and what's left,
  and only the keys that work in the store, each lit when it applies. The
  door line shows only near a fridge. "Pay at the counter" stays greyed
  until M5. On walking in with nothing, a hint says where the baskets are
  and what you have.
- **Fridge doors stay open while you're at them.** They shut when you walk
  2.5 m away, or when you aim at the open leaf ("Close the door") and press E.
- **Petals:** both petal fields take an `exclude` rect, the store's
  footprint under its roof. A petal that drifts in is respawned. Over 600
  frames by the storefront, 0 of 24,000 samples were inside.
- **Baskets:** the sides now flare, so a stack nests and shows every rim.
  There are two stacks of six on grey dollies with an お買い物かご / BASKETS
  card, one by the door and one at the counter's end.
- **The range: 446 products in 27 sections**, written as family tables in
  catalog.js (reference/konbini-details.md, section 9). Each product
  appears once, with at most a second block, and never more than 18 units
  (the STOCK check in shots.mjs). A facing's count is what you can see, the
  front and the row behind. Shelves fill in catalogue order, so families
  stand together, with tall things wherever they fit. The four gondolas
  are bread | instant, snacks | chocolate and sweets, medicine | cosmetics,
  daily goods | wine, sake and otsumami. Each side has category strips on
  its top edge, and the hanging signs name the aisles. One ice multipack
  doesn't fit.
- **Stock batching.** 446 InstancedMeshes would have been about 440 draws
  seen through the glass. Instead, all about 6,400 units bake into one mesh
  per label page (2 draws). Each unit keeps its vertex range; hiding or
  sliding one rewrites that range (`addUpdateRange`).
- **Labels** are 192 px cells on 3072 px pages (255 a page), drawn in the
  old 256 box scaled down, so the painters didn't change. That makes 2
  pages of about 36 MB each on the GPU, and the JS heap is 457 MB (it was
  400). Both are M7 work.
- **The famous views move** (the wordmark, the emblem, the new stock
  through the glass). They await Tan's OK.

### M3d, round 2 (Tan)

- **NIPPON, not HOTARU.** Tan didn't like the firefly. The store is NIPPON
  / ニッポン, with a mark from Tan's sketch: a red rising-sun disc behind 日本
  in heavy black type with a white keyline, on a white round plate so it
  reads on the blue. It's drawn in Canvas2D, not taken from the image. The
  wordmark panel reads NIPPON (six letters, like LAWSON), and the side sign
  reads ニッポン. The title is "Nippon Fuji".
- **The door chime is the FamilyMart melody, by Tan's choice (option a).**
  Tan was told: the melody is Yasushi Inada's "Melody Chime No.1 '大盛況'"
  (1978, written for a Panasonic doorbell) and is still under copyright;
  the recording may have its own owner; serving it from a public site
  carries a small risk of a takedown. Tan chose to use their file
  (assets/audio/lawson-chime.mp3, never committed). AGENTS.md and SPEC M4
  are updated. If it's ever taken down, the procedural chime is the
  fallback.

## M4: audio

- **Encoding needs nothing installed.** There's no ffmpeg on the machine,
  so `npm run audio` uses macOS's `afconvert` for decoding and AAC
  encoding. Node does the cutting, loop crossfades, fades and levels,
  following scripts/audio-cuts.json. The output goes to public/audio/
  (git-ignored, so Vite ships it in dist/) with a manifest. The set is
  **2.28 MB** in 15 files (the store music alone is 1.68 MB, the whole 5.6
  minutes at 40 kbps). Chrome decodes each file to exactly its cut length,
  so the loops are seamless.
- **Everything is mono.** Konbini sound comes from a place or a ceiling
  speaker; positional sounds are panned in the engine (HRTF).
- **What was cut from the packs:**
  - one stamp of the seventeen;
  - a whole number of bell periods (4 s) from the middle of the 145 s
    crossing recording;
  - the chime's full phrase (5.9 s of 7.7 s). It was very quiet, so it is
    normalised.
- **`scan-beep.mp3` isn't used.** It is 107 s of continuous low-level sound,
  not a single beep. M5 uses the procedural beep until a single-beep file
  is chosen.
- **One engine, `core/sound.js`**, replacing Sakura Crossing's playlist
  (audio.js) and the M2c sfx.js:
  - the buses of SPEC 9: sfx with a reverb made in code, outdoor through a
    lowpass, indoor, music, then a compressor;
  - every placed sound uses the local-sound falloff and doesn't play at all
    beyond its `far`;
  - the procedural recipes remain as fallbacks for every file.
- **The mix:**
  - stepping in: the town's lowpass reaches 930 Hz in under a second
    (measured), the store hum and the music come up over 1.5 s, and the
    reverb goes wetter;
  - the beds are chosen by the look: birds in the morning, crows at golden
    hour, insects at night, and wind always, low.
- **No cicadas.** They're summer insects, and this is sakura season.
- **The door chime** plays when you cross the door line, in or out, not on
  proximity, so it's exactly once each way. The automatic door now starts
  shut instead of opening for its first 2 s after load, which you'd have
  heard from the famous view. The famous views didn't move.
- **Sounds hooked up:**
  - the automatic door, the fridge doors (a softer, lower close) and the
    cooler's cycling compressor;
  - taking and putting back, by each product's material;
  - the basket, a refused take, the Tab panel;
  - footsteps, one per stride, grittier outdoors;
  - scan, drawer, coins, microwave and stamp are encoded but unplayed until
    M5 and M6 (there is no soundboard).
- **Not yet verified in Safari or Firefox.** Playwright has only Chromium
  here; their browsers are about 250 MB to install, which needs Tan's OK.
  The M4 item stays open.
- **The store music's source is unknown**, so its licence to be served
  publicly is still open (README, SPEC 9).

### M4, round 2 (Tan's review)

- **The exit chime fades behind you.** The chime now comes from a speaker
  in the ceiling just inside the door. A placed sound that is still playing
  follows the listener every frame, so walking out it drops away (0.22 at
  the door, 0.10 at 12 m, silent by 22 m). From outside it comes through
  the glass: lowpassed to 1.4 kHz at 40%.
- **The beds are 12% quieter.**
- **Footsteps come half as often**, one every other head-bob swing, so
  walking no longer sounds like running.
- **Zebra crossings have a walk-signal sound.** Tan says crossing-bells.mp3
  is the pedestrian signal (piyo-piyo and kakko). Every zebra plays it (a
  16 s loop) while its walk light is green, heard only within 34 m. The
  town has three zebras: the signalled one on the main road, and two on
  the shopping spine, which had only crossing signs. Those two now have
  walk-signal posts at both ends (buildWalkSignal, signals.js), each on
  its own offset cycle.
- **The level crossing** uses Tan's new railway-crossing-bells.mp3, 3.8 s
  looped on the bell period (23 KB).
- **The store music's credit:** "Sounds of Japanese Lawson" by Joonas on
  YouTube, in the README. Crediting isn't a licence. The recording is made
  inside a Lawson, so it probably carries the chain's own in-store music,
  and permission to serve it is not confirmed. That's the same kind of
  decision as the chime; Tan knows.
- **Browsers:** Playwright's WebKit (Safari's engine) and Firefox are
  installed (about 590 MB in the cache, not in the project). Every audio
  check passes in Chrome, WebKit 26.6 and Firefox 155. A refused pointer
  lock (the window not focused) is now caught, not an unhandled rejection.
- **Size (`npm run size`):** 3.00 MB in all. 0.64 MB loads before the
  first click (code 0.36 MB gzip, Fuji 0.28 MB) and the audio's 2.36 MB
  after it. The SPEC 7 budget is 5 MB. Not counted in download: start-up is
  6–9 s and the JS heap about 457 MB (M7 targets 5 s and 300 MB).

### M4, round 3 (Tan's review)

- **The shelves were running out, not the stock.** The filler gave each
  product at most two blocks, so an aisle whose section is short on range
  (bread 22, medicine 28, liquor 31) trailed off into bare shelf at the
  front, which is what Tan saw. Two fixes, no fixture changes:
  - once every product in a section has its block, the filler goes round
    again and gives the ones with stock left another, so a run fills to
    its end;
  - how deep a side is stocked now follows its range: a section with
    enough products to fill its five shelves twice over is faced two
    deep, as a real gondola is, and a shorter one is faced one deep.
    Nobody can see the row behind, and it frees that product's stock to
    cover more shelf.
  Every gondola run is now 82-93% full and none is empty (it was 16-93%
  with two bare). Total units fell from 6,403 to 5,950 (less hidden
  depth), so this also costs less memory. Three products still find no
  shelf: two tall bottles and an ice multipack.
- **Five sound settings, not a slider** (Tan): 0, 25, 50, 75, 100%,
  playing at 0, 0.15, 0.30, 0.45 and 0.60 of full scale, so 100% is the
  old free slider's 60%. The default is 50%, the 0.30 Tan liked. A value
  between settings snaps to the nearest.
- **A real bug this found:** with nothing saved in the browser,
  `Number(null)` is 0, which is a valid setting, so a first-time player
  started the game silent. Only a setting that was really saved is used now.
- **The zebras' signal, tuned.** It was there but easy to miss: green 16 s
  of every 47, at 0.5 level within 34 m. Now:
  - the junction's cycle is 36 s with 12 s of walk, and the side-street
    signals 36 s with 11 s;
  - the crossings on one street run nearly in step, as coordinated signals
    do, so the town is quiet between greens instead of one always calling;
  - it carries 62 m instead of 34, at 0.8, so it reaches you as you come
    up the street rather than only on top of it.
  Measured standing in the shopping street and at the famous view: heard
  42-43% of the time, in long stretches with quiet between.
- **The audio checks were flaky, in two ways worth naming.** One raced the
  green light; the other read an audio value that Firefox does not update
  while it ramps, so a real fade looked like a failure. The check now
  asserts what the engine asked for and that the measured value is well
  muffled. All three browsers pass.

### M4, round 4 (Tan's review)

- **The gondolas are closed at the back, as Tan asked.** Seen end-on from
  the back of the store, a gondola showed a long run of half-bare shelf:
  goods are faced at the aisle edge, and the rest of a 0.45 m board is
  empty, with nothing closing the end. Now:
  - a solid panel closes each gondola's back end, carrying the two aisle
    names and a POP card, the way a real gondola end does;
  - the shelf board reaches 0.3 m back instead of 0.45, so what you see
    end-on is stock rather than board.
  No products were added and nothing grew: the store is still 439 products
  and 5,950 units.
- **The walk signal was playing but too quiet to notice.** Measuring the
  master output (a new dev-only `sound.debug.level()`) at Tan's 25%
  setting settled it: the cut I took from his recording was from one of
  its quietest stretches (RMS 0.061 against 0.136 in the loudest). The
  encoder can now level a sound by loudness rather than by its loudest
  transient (`rms` in audio-cuts.json), and the walk signal is cut from
  the loudest 14 s. With the level raised to 1.1 and the range widened to
  20 m / 70 m, at 25% volume it measures 0.014 at 30 m, 0.022 at 12 m and
  0.031 at 3 m, against 0.0027 for the ambience bed: five to fourteen
  times the bed, where before it was under it.
- **The walk signal is Tan's zebracrossing.mp3** (round 5). Tan replaced
  the recording: the old one was a railway bell, not a pedestrian signal.
  The new one calls on a 4.39 s cycle, so the loop is exactly one cycle,
  which is also a third of the size (30 KB, was 88 KB). Its chirps peak
  far above their body, so the peak limit binds before the loudness
  target; the in-game level is 1.6 to make up for it. Measured at the 25%
  setting: 3.3 times the ambience bed in loudness and 5.5 times in peak,
  at full strength from 25 m in.
- **The town has three zebra crossings**: one on the main road by the
  store and two on the shopping spine toward the station. All three are
  now drawn on the map as their own black-and-white bars (mapArt.js), no
  label.
- **Memory, asked and answered.** 501 MB of JS heap and about 432 MB of
  textures. It is all on the player's own machine: the server sends 3 MB
  of static files, so a hundred thousand players cost bandwidth, not
  memory. It is still more than the M7 budget of 300 MB, and the
  breakdown is now recorded in SPEC M7 so the cut is a known job.

### M4, round 6 (Tan's review)

- **Two voices, one per direction.** Japan's crossings call with two
  different sounds so you can tell which way you are crossing: the cuckoo
  (カッコー) and the chick (ピヨピヨ). Which is which varies by
  prefecture; the common pairing is the cuckoo on the main road, walked
  one way, and the chick on the side streets, walked across it. Tan's
  recording is of a junction calling to itself, so it holds both: the
  chick's falling chirps (2,580 → 1,900 Hz) at 0.1, 1.15 and 1.45 s, and
  the cuckoo's two notes (1,200 then 960 Hz) at 2.3 and 3.35 s, over one
  4.39 s cycle.
  `npm run audio` now takes a `keep` list of stretches and silences the
  rest, so the one recording makes both loops, each keeping the original
  cycle and therefore its real rhythm: `walk-kakko` (15 KB) and
  `walk-piyo` (12 KB). Which one a crossing calls with follows the road it
  crosses: over an east-west road it is walked north-south, so the cuckoo;
  over the north-south shopping spine, the chick. Our main-road crossing
  is the cuckoo, the two spine crossings the chick.
- **The ranges no longer overlap.** From where the game starts you stood
  33 m from the main road's crossing and 57 m from the shopping street's,
  and the 70 m range meant both called at once. The call now carries
  14 m at full and fades out by 40 m, which is the street it is on and no
  further: measured at the spawn point, only the cuckoo is ever heard, and
  never two crossings at a time.

### M4, round 7: the audio method, and a 65 MB waste found

Tan asked whether we use three.js's positional audio, with more places
(a deer park, a village) in mind.

- **We use the Web Audio API directly, not `THREE.PositionalAudio`,** and
  that is the right call here. three.js's wrapper hangs an Object3D on
  each emitter and leans on Web Audio's physical distance models, which
  taper but never reach zero, so every emitter in the world keeps a live,
  processing voice. Ours does the thing game audio actually wants: each
  place's sound has a `near` and a `far` (config.js SOUND), the level is
  our own smoothstep between them, and **beyond `far` no source exists at
  all** -- we stop it and free the nodes. The panner is used only for
  direction (HRTF), with its own rolloff switched off. That is what lets
  the town hold many sound sources while only a handful are ever running:
  measured at eight at once while grabbing things off the shelves as fast
  as the code allows, and one or two while walking.
- **The listener** is driven from the camera each frame (position and
  forward), so what three.js's wrapper would have given us for free costs
  six parameter writes.
- **The waste this turned up: the in-store music was being decoded whole.**
  A 5.6-minute track is 1.7 MB as a file and **64.7 MB as raw audio in
  memory** -- four fifths of all the audio memory we held. It now streams
  through an `<audio>` element into the same graph, so the browser keeps
  only a little of it. Decoded audio fell from **80.6 MB to 15.9 MB**.
  The short sounds and the ambience beds stay decoded, because a buffer
  loops seamlessly and a media element does not; that matters for a
  continuous bed and not for a five-minute track.
  Worth being precise: this memory sits outside the JS heap, so the heap
  figure Tan asked about does not move. It is still 65 MB less for the
  browser to hold.
- **What this means for more places.** The shape already fits: sounds are
  named in one manifest, loaded on first need, shared by every user of
  them, culled by distance, and answer to one master. What a deer park or
  a village would need next is a way to *release* what a place holds once
  you are far from it; buffers are never freed today. At 16 MB that is not
  yet a problem, and it is a small addition when it is.

### M4, round 8: the keys on screen, and Space

- **Space pauses and plays** (Tan). Pausing is letting the pointer go,
  which raises the same card Esc does, so both work and neither fights the
  browser (Esc is the browser's own way out of a pointer lock and cannot
  be taken away).
- **The keys that do something where you are, in the bottom-left corner**
  (`src/ui/controls.js`), changing with the place:
  - walking the town: move, look, run, the map, sound, pause;
  - inside the store: move, look, E, the basket panel, sound, pause -- no
    run (SPEC 5: no running indoors) and no map;
  - with the basket panel open: choose, put one back, close;
  - standing on a famous view: only how to take the camera back, so the
    shot stays clean, as the minimap already does there;
  - paused, or in a screenshot run: nothing.
  A key that belongs to the place but cannot be used this second -- E with
  nothing under the crosshair, or the basket before you have one -- is
  dimmed rather than removed, so the list does not jump about.
- **Where the name of a thing appears.** The list names the key and what it
  does in general ("E: take / open"); the prompt under the crosshair still
  names the thing itself ("E · Take Matcha sticks"), so the two do not say
  the same words twice. The shopping card keeps the money and gave its key
  rows to the list.
- **E stays the one interact key.** Tan's note sketched X for taking a
  basket; asked, he chose to keep E for taking a basket, opening a fridge
  and taking an item, with X still putting one back from the panel.

### M4, round 9: why the laptop slowed down (Tan)

Tan: the whole laptop slows while the game is open, and recovers when it
is closed. Measured rather than guessed:

- **The machine was out of memory.** 9.6 GB of a 10 GB swap in use, 23%
  free, later 10.9 GB of swap. Everything slows when a machine pages, and
  the game was one of its largest single tabs: about 500 MB of JS heap and
  430 MB of textures. That is the root cause, and the budget of SPEC 11
  (300 MB) is now a rule in AGENTS.md, not an M7 wish.
- **It drew when nobody was looking.** The loop rendered every display
  frame whether playing, paused behind the card, in a window behind
  another, or in a hidden tab. SPEC 11 asked for a pause on a hidden tab;
  it had never been built. Now the loop draws nothing while hidden (and
  suspends the audio), 10 frames a second while paused or unfocused, and
  every frame only while playing. Measured in a real window: 230 drawn a
  second playing, 10 paused, 0 hidden.
- **The shadow map redrew every frame, and followed the mouse.** The
  code's own comment said the shadow camera sat on a snapped grid; it did
  not, so every turn of the head moved it and forced a full shadow pass
  (and made shadows crawl). It now snaps to 4 m and redraws only on a new
  square, plus four times a second for the train and the doors: GPU time
  per frame 4.86 ms to 3.14 ms (35% less).
- **The shadow map is 2048, not SPEC's 4096.** That is a quality trade,
  so it is Tan's to keep or reverse: it frees about 50 MB of GPU memory,
  and the famous views move 0.14-0.24% (inside the guard). One line in
  main.js puts it back.
- **The town atlas allocated a full page it did not fill.** Its second
  4096 page was 41% used; pages are now packed first and the last trimmed
  to what landed on it (4096 x 1664): textures 432 MB to 379 MB, signs
  checked on the famous view.
- **My test tools were adding to it.** Killing a screenshot run left its
  own dev server and headless Chrome behind; two dev servers from
  sessions a day old were still running too. All cleared, and the
  harness now allows a slow cold start instead of timing out and being
  retried. Worth being blunt: the full screenshot suite could not finish
  this round because the machine was out of memory. What was verified:
  the famous views (0.14% and 0.24%), the train service, the atlas signs,
  and the frame rates above. The rest are rendering-only changes that do
  not touch the stock, the density or the sound.

## Fix: the frame loop scheduled itself twice (2026-09-27)
- M4.9 moved `requestAnimationFrame(frame)` to the top of `frame` (so the
  throttle could return early) but left the old call at the bottom. Every
  fully drawn frame scheduled two more: while playing, the renders per
  screen refresh kept multiplying. The "230 drawn a second" above was
  this bug, not a frame rate. Removed the second call. Measured in a real
  window: 60 drawn a second while playing (the display's rate), 9.3 while
  paused.
- The same bug is why the screenshot runs hung for hours: `?shots` never
  throttles, so the page drowned in renders after the first capture. The
  full run of 12 frames now takes 8 s.
- `__shot` also left `shadowMap.autoUpdate` on after each capture (pre-M4.9
  code); it now stays off, as the game sets it.
- shots.mjs: dropped `--enable-gpu-rasterization`; added `--quick` (frames
  and the hero guard only), `--no-density`, `--no-train`, `--scale`, and
  `--verbose`; a lock so parallel agents take turns; closing Chrome and the
  dev server when stopped. New spot `land-overview`; `town-overview-east`
  moved to see the town.

## Town pass, phase 0: the smaller town and the land (2026-09-27)
- **Tan's calls** (2026-09-26/27): the town may shrink; a river and
  paddies where the old residential lane, fields and park stood (they had
  no purpose left); animals yes, people not yet; keep today's cartoon look
  (no film effects); a "Deer Park, coming soon" spot for a later place;
  budgets are guides, seamless play is the test.
- **The shrink.** The core's two east lanes (town x 62 and 92) went, and
  the east-west lanes stop at x 52 with a guardrail. The main road keeps
  its shops the whole length (lots ending before z 36 may run to x 97);
  behind them, east of x 52, paddies. The shrine, small park, apartment,
  vacant lot, spine, plaza and station are all kept.
- **Seeds kept.** network.js seeds each edge by its list position, so
  removing lanes re-drew every house in town, including the ones at the
  famous views' edges (guard 1.4%). town-plan.js now gives every edge the
  seed it had in the pre-pass grid (LEGACY): the houses are the ones they
  were. Guard after: 0.248 / 0.348 / 0.143%.
- **The land** (TOWN.land, town frame, north is -z): paddies from the far-
  side row to the levee (z -9.5 to -40), the levee (1.4 m) and river
  (z -46 to -62, 16 m), a far bank, paddies to the tree line, a farm track
  from the main road's zebra (town x 35 = world x -35) over a bridge to the
  Deer Park gate at the north fence. Named 桜川 (Sakuragawa: a common river
  name, not Sakura Crossing's). Phase 0 builds it as flat placeholders with
  final colliders; the river & paddies builder replaces the look.
- **The gate's board** carries an English line ("Deer Park · coming soon")
  under 鹿公園 近日公開. An exception to Japanese-only world text: it is a
  message to players about the game, like a title card.
- **Sign fonts.** M PLUS Rounded 1c Bold (every character in src/, 155 KB)
  and Yuji Syuku (only src/data/town.js, 290 KB: a brush glyph costs about
  0.6 KB, so the whole source would be 580 KB), both SIL OFL 1.1, subset
  by `npm run fonts` from full fonts kept out of git in assets/fonts/.
  Loaded by core/fonts.js with a top-level await before the town paints
  its signs (build target es2022; desktop browsers only). Download 2.95 ->
  3.38 MB (1.08 MB before the first click); ready time unchanged (4 s).
- **A pole in the zebra.** The kit's main-road poles never knew about the
  main road's own zebra (signals.js builds it in the world frame), and one
  stood in its landing on the store side, 80 degrees off the famous views.
  poles.js now keeps the hero edge clear of it; the walk to the gate needed
  it.
- **The walk test was stale.** ?m2check's town routes were still in the
  pre-M2e.3 (unturned) coordinates and walked into walls; they go through
  the town's frame now. All pass: spine to plaza 152 m, lanes loop 382 m,
  road end to end 231 m, and the new one, store to the Deer Park gate over
  the zebra, the track and the bridge, 114 m, never stuck.
- **Cost of phase 0** (before -> after, famous view, headless Chrome on
  Tan's M2): JS heap 482 -> 399 MB; textures 363 -> 366 MB (the gate
  board); draw calls 756 -> 737; triangles 3.40 -> 2.83 M; ready 4.0 ->
  3.1 s. Town overview: 870 -> 806 calls, 3.34 -> 2.50 M triangles.

## Town pass, wave 1: streets & poles, facades & shopfronts (2026-09-27)
Two specialist builders (docs/BUILDERS.md); their own judgement calls are
in docs/decisions/streets.md and facades.md. Mine, at review and merge:
- **Sent back: "mirrored" shop names.** The fascias read backwards in the
  facades frames. Not a flipped texture: balconies stood in front of the
  boards' top halves. Balconies over a fascia now sit higher; noren hang
  below the new transom; a corner sign stood out of its case.
- **Not fixed: stepped shadow edges on house walls at 1-3 m.** Present on
  main before the pass: the 2048 shadow map spans 80 m (about 3.9 cm a
  texel) and the toon bands turn its soft edge into steps. A tighter
  shadow area round the player would halve it at no memory cost, but it
  touches the famous views' shadows: left for a later pass, with Tan.
- **A real brand** on a shop notice (PayPay) is now 「QR決済 使えます」.
- **Bikes in a lane's mouth.** The kerb bike rows didn't skip junctions;
  one row blocked lane z 112 at the spine (the lanes walk got stuck).
  Street clutter now keeps 1 m clear of every junction. All four walks
  pass, stuck 0.
- **Fonts** re-cut for the new sign text: 468 KB; the guide goes 450 ->
  520 KB rather than splitting the brush face further for 18 KB.
- **Cost of wave 1** (headless Chrome, Tan's M2, famous view): frame 7.19
  -> 7.41 ms at 1440p; draw calls 737 -> 751; triangles 2.83 -> 2.95 M;
  JS heap 399 -> 388 MB; textures 366 -> 355 MB (the painted rooms behind
  shop glass replaced furniture geometry, and the atlas shrank). Download
  3.38 -> 3.42 MB. Hero guard 0.258 / 0.353 / 0.148%; stock pass.
- **The bicycles** are most of the new triangles and draw town-wide (one
  instanced mesh). If the final frame check shows a cost, split per area.

## Town pass, wave 2a: sakura & greenery (2026-09-27)
The builder's calls are in docs/decisions/green.md. Mine:
- **Sent back: limbs like black paper at 1-3 m.** Now round, smooth-shaded
  wood with knots (12/9/5 sides by thickness) inside 32 m, a coarse copy
  beyond, in one batch; bark 0x6e5a53 with two bands in daylight, a
  slight glow at blue hour so it never goes black.
- **The famous views keep their trees.** Cherries the hero cameras can
  see (6 of 46, found by rays at build time) and the two frame trees keep
  the old look; town.js now asks for `classic` on the frame trees
  explicitly. A hero re-baseline, letting them take the new look, is
  Tan's call for later.
- **Cost** (famous view, 1440p): 7.25 ms (7.41 before; within noise);
  calls 751 -> 764; triangles 2.95 -> 3.02 M; heap 388 -> 379 MB. My
  texture estimate went 355 -> 371 MB, but it counts clones that share an
  image (the far trees reuse the camphor skin) twice; three.js uploads a
  shared image once, and the builder added no textures. Town park: +3
  calls, 2.06 M main-pass triangles.
- Walks all stuck 0; guard 0.258 / 0.353 / 0.148%; stock pass.

## Town pass, wave 2b: river & paddies (2026-09-27)
The builder's calls are in docs/decisions/land.md (the levee widened to a
6 m crest, the river z -49 to -65, 21 sakura on the levee and at the
gate, painted hill rings, the bridge 富士見橋). Mine, at merge:
- **The edge fences crossed the river.** The east and west boundary
  fences and tree rows now open between the far bank and the levee; the
  river runs out to the hills.
- **Night before the land.** town.js makes the night (kit/night.js)
  before buildLand, so the gate's lantern lights the gravel after dark;
  buildCore reuses it.
- **River petals under the water.** The sakura builder floated them at
  `river.surface ?? 0.03`; the land builder named it `river.water` (0.06).
  They now float just on it.
- **Load time.** The merged build took 9.5 s to be ready (about 4 s
  before): the fallen petals raycast every mesh under a crown, and the
  land's sheets span the whole land, so each levee cherry's rays tested
  thousands of triangles. Land surfaces over 60 m across are tagged
  `ground` and skipped: their height comes from groundAt (the platforms).
  Petals 5.0 -> 0.8 s; ready 4.8-5.4 s.
- **Cost** (1440p): famous view 7.43 ms, 779 calls, 3.17 M triangles; the
  new view back from the levee 7.57 ms; along the river 4-5 ms. Heap 378
  MB; textures (estimate) 377 MB. Download 3.44 MB (fonts 474 KB).
- Not done, noted: the north fence's plinth reads as a long low wall
  behind the far paddies; the land is built once (no load-by-distance).
- Walks all stuck 0; guard 0.258 / 0.353 / 0.148%; stock pass.

## Town pass, wave 2c: Tan's layout, the sunken river and 鏡池 (2026-09-27)
- **Tan's layout:** turn round at the spawn and the river is right there,
  in a sunken channel (河川敷): stone stairs down behind the spawn, lower
  walks on both banks, stepping stones (飛び石) across, stairs up the far
  side to the paddies, the pond and the Deer Park gate. The raised levee
  and far bank went. The track's bridge spans the channel at street level
  and can be walked under.
- **鏡池 (Kagami-ike)** replaces the regimented paddies west of the track:
  Tan's afternoon on a bench by Sarusawa-ike in Nara, made our own (no
  real names or buildings). A rounded-triangle pond of olive water, a
  granite promenade to the edge, post pairs, a white lantern string, black
  pines and a weeping willow, a lotus patch, かがみ茶屋 and low houses
  behind, benches facing the water (M6's sit-and-eat will use them).
- **Engine:** ctx.sink lowers the base ground over a rect; town.js builds
  the ground plane last with a hole over each sink. Tan asked that walking
  below ground not cost weight or smoothness: measured, it costs nothing
  (one rect test per height lookup; the channel replaces the levee's
  geometry).
- **The builder was stopped by a usage limit** mid-task; I finished its
  work: the noren's name fits its cloth (かがみ茶屋 was cut to いがみ茶屋),
  shoji lattice, a denser lotus patch, and a spawn-to-pond route in
  ?m2check (down the stairs' left lane: a handrail runs down the middle).
- **Honest limit:** from the spawn, turned round, the channel's far rail
  and cherries show across the road, not the water; the water shows as you
  reach the edge. That is what sunken means.
- **Cost** (1440p): famous view 7.49 ms (7.43), 781 calls; spawn turned
  round 5.3 ms; stepping stones 4.4 ms; pond bench 3.4 ms. Heap 400 MB
  (378); textures (estimate) 381 MB; ready 4.0 s. Download 3.45 MB (fonts
  477 KB). Guard 0.258 / 0.353 / 0.148%; all five walks stuck 0.

## 鏡池, second pass: Tan found it fake (2026-09-27)
What made it fake, against Tan's photo: flat olive water with printed
dashes (real still water is mostly what it reflects), a row of identical
boxes on a lurid lawn, a drawn shoreline.
- **A real mirror near the pond** (land/mirror.js, three's Reflector):
  one extra render of the scene from a mirrored camera into a 768 px
  target, only while the pond is drawn and within 140 m (beyond, the
  painted water). Tinted olive, stronger at a glancing angle, shaken by a
  wobble map, stepped into a few tones so it stays painted, and dimmed
  with the look (blue hour).
- **It renders only a layer** (REFLECT): meshes within 40 m of the pond,
  the view-sorted crowns, and everything outside the town (sky, clouds,
  Fuji, lights). Without it the mirror drew the whole town again (+750
  calls); with it about +40. Fuji is tagged again once its elevation
  loads, so it stands in the water.
- **Found on the way:** the mirror's oblique clip lost the sky looking
  steeply down (it clears to the look's sky colour now), and a deep blue
  zenith through olive water went black (the body and reflection are
  lifted).
- **Round the pond:** the town's own houses (kit, with the facades pass's
  detail) of one to three storeys, set back unevenly, an inn standing over
  them, hedges, a camphor and maples; the old townhouse and the tea house
  stay. The lawn toned down; the shore wanders by up to a metre.
- **Cost** (1440p): pond bench 3.4 -> 5.8 ms; the far bank looking back at
  the town and Fuji 9.2 ms (the game's highest spot now; the town and the
  mirror both in view); spawn turned round 7.1 ms; famous view 7.38 ms.
  Heap 412 MB; ready 4.0 s. Guard unchanged; walks stuck 0.

## Tan's layout: the town in a square (2026-09-28)
Tan drew the town's scope on the map and asked for it first:
- **Behind the spawn:** the photographers' lot is a monthly car park (bays,
  wheel stops, a walkway kept clear to the stairs, a few cars, its board),
  and the river channel starts right behind it and the shop row (about
  7 m nearer). Everything beyond the river went: the far paddies, the old
  pond, the far land. The far walk is the town's edge; the bridge road
  from the master junction ends at the Deer Park gate.
- **The master junction:** Tan found four zebras cluttered. It is the
  main road's original zebra (kakko) and one across lane x 30 (piyo), side
  by side, so both tunes are heard at one corner; the lane's walk light
  runs 19 s off the main road's, inside its car green, so they take turns
  (the audio test's "only one crossing heard from the spawn" holds). The
  engine also merges same-tune crossings within 15 m into one voice.
- **鏡池 moved** to the corner by the railway (town x 54-97, z 100-152):
  its long side and lanterns along the railway, benches on the two town
  banks facing north (Fuji beyond the railway), the tea house and houses
  at its point, where lanes z 112 and 144 open into its grounds (no
  guardrails there). Smaller pond, smaller corner roundings, a smaller
  lotus patch; turtles, ducks and benches moved with it.
- **The paddies Tan kept** (I had built houses there first; Tan wanted the
  paddies): the block between the main road's shops and the pond, lanes z
  45 and 80 ending at them. Better than before: the flooded plots are a
  mirror too (512 px, within 55 m), a hand-set April mix (flooded,
  seedlings, two ploughed, renge, the pump shed's corner), a feeder
  channel with sluices, the scarecrow in the renge; egrets back in them,
  butterflies over the renge.
- **Mirrors cost:** with the pond inside the town, its mirror redrew whole
  cells of it (+250 calls at the famous view). The reflection layer now
  takes only trees, the land's own pieces, the water's animals, and town
  meshes wholly by the water; the pond's pieces stay out of the static
  cells so they can be taken; the pond's mirror wakes within 70 m.
- **Cost** (1440p, measured back to back with the commit before): famous
  view 7.61 -> 8.22 ms, 813 calls; pond bench 7.7 ms; railway bank 9.6
  ms; paddies from the lane end 10.9 ms; junction 10.4 ms. Heap about 410-
  430 MB; download 3.48 MB. Guard 0.258 / 0.353 / 0.148% (as before);
  six walks stuck 0; audio all pass.

## The master junction, designed for traffic (2026-09-28)
Tan: cluttered, roads of different kinds, ground patterns that don't carry
on; account for cars and walkers. What was wrong, and what it is now:
- **Three road styles met there:** the main road, lane x 30 north, and the
  land's own asphalt "bridge road" with grass verges south. Lane x 30 now
  runs on through the junction as the bridge road (z0 -11), one kit lane
  with one asphalt, edge lines, kerbed walks, its own stop line at the
  main road. The legacy seed grid keeps lane x 30's old start, so no house
  re-rolled (guard 0.269 / 0.365 / 0.158%).
- **The far pavement ran across the bridge road's mouth**, raised: a car
  couldn't turn in. lawson.js now breaks it (and its tactile strip) for any
  lane that crosses the main road.
- **The main road's zebra was signals.js's**, so the kit didn't know it:
  no stop lines, a "40" and the bus box painted beside it. It is a kit
  crossing now (stop lines, diamonds, tactile pads, like every crossing),
  flagged `signalised`; signals.js keeps its signal posts and walk light
  (`zebra: false`; the kit adds no second walk light). A stop line that
  would fall inside the junction moves to its near side, so westbound
  traffic stops before the junction. Speed numerals keep 10 m clear of
  zebras; the bus stop moved 12 m east.
- **A signalled junction** (nodes within 12 m of a signalised zebra): no
  止まれ signs or words, no convex mirror, no second stop bar where the
  zebra's own stop line serves, no utility poles within 8 m, no lane trees
  within 11 m of its zebras.
- Walks all stuck 0; audio all pass (four walk lights; at the spawn one at
  a time).
- **The main road's own paint** (lawson.js, 2026-09-28, Tan: the centre
  line bothered them): its dashed centre line stops between the master
  junction's stop lines (eastbound before the zebra, westbound past the
  junction), and the store-side edge line now breaks at every lane's
  mouth, as the far-side one does. At the minor T-junctions the centre
  line carries on (the main road has priority there).

## The experiences, built overnight (2026-09-28)
Tan turned the game into seven experiences and two teasers in the compact
town (docs/EXPERIENCES.md is the brief). Built by seven specialist builders
in parallel worktrees; each report reviewed against its frames, sent back
where below the bar, merged; builders' own calls in docs/decisions/*.md.
- **Groundwork (mine):** experience spots (world/experiences.js: a soft
  yellow ground glow and a floating diamond, E to use, dims when done),
  sound zones and one-shots (core/sound.js, core/soundBus.js), Tan's six
  recordings encoded; the minimap and town map show the spots as yellow
  diamonds. A file asked for before it loads now plays when loaded, not as
  a tap (the first いらっしゃいませ was a tap).
- **Sent back at review:** the shrine's foxes (faceted) and a clipped
  nobori (正一位 cut off); Han's RX-7 silhouette (read as a generic
  supercar: the FD's bubble cabin and Fortune hips pushed); the kit.
- **Tan's calls tonight:** close homages for brands, but the real Mazda
  RX-7 from the film and Han modelled on the actor as Han; Han triggered by
  proximity (the song fades in as you walk up; step into the glow and he
  drives), no E; the minimal checkout; no people but the four.
- **At merge:** Han's bay moved to the one the quality pass reserved (its
  re-marked lot shifted the bays 1.2 m); fonts re-cut each merge (556 KB,
  guide raised 520 -> 600); audio 3.67 MB (the clerk's lines are Kyoko,
  generated); the audio test's keys check follows the new store keys.
- **Famous views:** hero-2 is at 0.487% (limit 0.5%), from fixing the
  forecourt cars (nosed into their bays: their golden-hour shadows moved)
  and the store's changes. A re-baseline with Tan's OK is recommended so
  the guard has room again.
- **Checks on main after all merges:** konbini loop 15/15, audio all pass,
  walks all stuck 0, STOCK pass, train timing pass, guard pass.

## Time of day, the view spot, the highlight, the konbini scene (2026-09-28, Tan's review)
- 1 2 3 change the time of day wherever you are (a 0.7 s dip to dark hides the switch); they no longer jump to the famous view.
- The Nippon Fuji view is an experience: its highlight at the photo spot (HERO_VIEWS.*.play); stepping on it glides the camera into the framing (1.3 s) and hands it back as you walk off.
- The highlight (experiences.js): Tan found the first ring and diamond lame and the paper lanterns not evident. Now a crisp painted ring with a gold edge, a ripple running out from its middle, a column of warm light (the finder from afar, gone as you step in) and rising motes. 4 draws a spot when near, 2 far; no download.
- Nippon Mart is a scene, not a store to roam: stand on its spot, pick one of five (egg sando, fruit sando, onigiri, Strong Nine, Choco Wafer Jumbo) with 1-5; the walk in, the take, the till, the walk out and eating play by themselves, no skipping (Tan). The walk is planned on the store's colliders (a grid search, pulled taut, corners rounded), so it follows any planogram. The door opens only for the scene; anyone inside is let out. Gone: the wallet card, the shelf glows, X to put back, E at the shelves. About 45-49 s a visit.
- The Strong Nine: ten seconds of a CSS blur on the canvas and a slow sway after you drink it (Tan's add-on); nothing is left running after.

## Konbini, second pass (2026-09-28, Tan's review)
- Hands: no note, no wallet, no left hand. The right hand comes up only to take the item (a short reach toward the shelf), drops while the item is on the counter, and comes back with it.
- The walk: A* on a 10 cm grid of the store's colliders, planned with 0.55 m clearance (0.38 m where an aisle is narrower), pulled taut, corners rounded only where the curve stays clear. The old pass cut corners through the gondolas. `node scripts/_konbini.mjs --paths` prints the floor and each walk.
- The checkout: Tan's cashier-checkout recording (a self-checkout, 7.2 s cut from 3.3 s, 32 kbps) plays at the till under the cashier's lines; paying happens out of view (the drawer, the display). The store's bed, music and hum are up 15% (SOUND.storeInside).
- Sandos: a clear rectangular pack standing upright, two crustless halves with their cut faces to the front, a label band (Tan's photo); eaten as a rectangular half, not a triangle.
- The cooler's glass leaves: 0.08 opacity, barely tinted (the milky film at 0.18 read as glare).
- The choice card: a red "Recommended" stamp on the Strong Nine, "Lemon beer · 9%" beside it (Tan).
- Open: hero-2 is 0.510% against its baseline (the sando packs, seen through the glass, shift ink edges; it was already 0.487%); the download is 5.03 MB. Both are Tan's calls (re-baseline; budget).
- Sandos, corrected (Tan's photos, same day): every sando is a wedge, a square cut corner to corner. On the shelf a right-triangle pack (back upright, base flat), the slanted cut face to the front showing the filling between the two slices, the label band at its foot; eaten as the same wedge, turned so the cut face shows, bitten from the top corner.

## Self-checkout, no cashier (2026-09-28, Tan)
- Tan removed the cashier ("the conversation during checkout seems very fake"): the counter's two registers are now self-checkouts (セルフレジ), each a white terminal with a leaned-back touchscreen (drawn by shop.js, redrawn only on change), the scanner glass, a lit IC reader, a receipt slot and a bagging shelf; a hanging セルフレジ sign.
- The checkout plays Tan's self-checkout recording in two cuts (kiosk-scan 3.3-10.9 s, kiosk-pay 24.0-29.2 s of cashier-checkout.mp3; STORE.kiosk says where their beeps fall): the item goes onto the scanner on the first beep, the screen shows it and the total, then the right hand brings up the IC card and touches the reader on the second. The hand homes in on the pad each frame, so the card lands on it whatever the stance.
- The card is ours: "Fujica" (フジカ), a mint-green transit IC card with Fuji on it (Tan asked for Suica; a real brand, so a homage).
- Gone: the cashier (store/cashier.js), her voice clips (scripts/gen-voices.mjs, 24 v-* cuts), the till beep and drawer cuts, the entering "irasshaimase" and every subtitle. Download 5.03 -> 4.75 MB.
- Visits run 46-54 s (the kiosk keeps the recording's own pace).
- Famous views re-baselined (Tan's OK, 2026-09-28): hero-1/2/3 had drifted to 0.374/0.570/0.272% from the town's growth and the store's new inside (no cashier, self-checkouts, wedge sandos) seen through the glass. All three checked by eye first; the guard now reads 0.000%. The baseline lives in screenshots/baseline/ (not committed); the old one is kept outside the repo.

## Han's drive keeps to the roads (2026-09-28, Tan: "How can somebody drive a car over the footpath like that?")
- The old drive left the bay nose first straight over the far footpath and kerb, and came back the same way. The route (han/drive.js) now: backs out into the car park's aisle, out of its east mouth onto the bridge road, north to the master junction, across into the westbound lane (Japan drives on the left), west past the store, a handbrake 180 on NIPPON's forecourt (it meets the road with no kerb; clear of the wheel stops and the parked keis), back into the eastbound lane, a drift through the master junction onto the bridge road (drift 0.55: the lane is 4.6 m), into the car park's mouth and nose first into the bay.
- The guard: `node scripts/_han-route.mjs` samples the drive at 120 Hz and fails if any corner of the car (its body as drawn, drift included) leaves the car park, its mouth, the bridge road, the main road or the forecourt, or touches a parked car, or if it doesn't end in the bay. Run it after any change to the route or the town's layout there.
- The smoke is soft translucent puffs (one Points draw) instead of solid white balls.
- A player standing in the glow is clear of the car (1.25 m at the closest); one standing in its path makes it wait, as before.

## After the rename merge (2026-09-28)
- The line's next station was 河口湖 / Kawaguchiko, a real town a letter away from our own name: it is 富士山 / Fujisan now (train destinations, the fare map, the bus's stops); the onsen ad reads 西湖 温泉.
- The train's listening spot moved 0.35 m back from the platform edge: its light column had cut into the train's side.
- The station entrance board, the map title and the signs read Fujikawaguchikko / 富士川口湖; 富士見 stays where it names the view (Fujimi Line, 富士見通り, 富士見稲荷神社), not the town.

## H: back to the Nippon view; the counter laid out (2026-09-28)
- H puts the player back on the Nippon Fuji view from anywhere, at the time of day they're in (Tan: "I'm finding it difficult to get back to the Nippon store" since 1 2 3 only change the light). Not during the konbini's scene, the map or the glide onto the view; it ends Han's watch and a seat like any move. _play step 29-home.
- The counter: the second self-checkout sat inside the bun steamer and the first's bagging shelf ran into the oden pot; the second now stands at z -3.62 (its reader and printer on its far side, no shelf of its own), the oden pot moved to -5.62..-5.12, its cups on the lid.

## The Shiba's voice (2026-09-28, Tan: "Don't you add very cute, adorable sounds?")
- Made in code (core/sound.js `voice`: a sawtooth glide through two bandpass formants with a breath of noise; no files): a happy double yip when you arrive at a spot (always plays), a cheek-puffed little "boof" on some look-backs, a curious "hm?" with some head tilts, a soft rising whine once if you've kept it waiting 9 s, quick panting at a trot every few seconds, the collar tag jingling as it shakes off, snuffly breaths asleep. Placed at the dog (near 3 m, far 18 m), never two within 1.2 s. scripts/_guide.mjs checks each is really heard and that the dog uses them on a walk.
- toon.js no longer passes flatShading to MeshToonMaterial (r180 has none; it only logged a warning per material at load; nothing on screen changed).
- Han's watch keeps up on slow frames: the car keeps the song's real time, but the head turned by the capped frame time (1/20 s), so on a slow machine the car left the frame (the test's worst angle reached 90°). The turn now uses real elapsed time and turns quicker while it's well behind: worst 20-22° over three loaded runs.

## Placed sounds follow you for as long as they play (2026-09-28, Tan: the next-stop announcement stayed loud as he ran off)
- core/sound.js followed a placed one-shot's level for a fixed 8 s; a longer one (the train's announcement, Han's song) then froze at that level wherever the player went. It is now followed until its source ends (recipes: 4 s), and a not-yet-decoded placeholder no longer lingers in the list. _play step 25-announce-fades: full in the ring after 9 s, silent 40 m off.

## No tree through a building (2026-09-28, Tan found one by the shrine)
- An audit found 40 trees whose crowns cut into buildings (sakura, pine, maple, camphor, zelkova). kit/canopy.js now grows each tree dry first (a tree is its seed's alone, so the dry crown is the real one), tests its cushions against every building-sized collider, and slides it away from what it hits (up to ~9 m), or makes it smaller if there's no room. After: 0. _play step 03-trees-clear keeps it so.
- Moving the famous views' framing sakura changes hero-1 to 0.61% (hero-2 0.36, hero-3 0.32): to be looked at and re-baselined.
- Re-baselined the famous views after the tree fix (the framing sakura on hero-1's left had cut into the house behind it and now stands clear; checked by eye): guard 0.000%.

## Shadows that don't pixelate; the bench looks around (2026-09-29, Tan)
- "Some places pixelate a lot ... this staircase near the river ... when I walk past, it pixelates and acts up": the sun's shadow map (2048 over 80 m, ~4 cm a texel) drew a low sun's shadows (handrail posts, a tree) as blocks on the steps, and the shadow camera moved in 4 m steps, which are 102.4 texels: every step re-sampled every shadow edge (the crawl). Now PCFSoftShadowMap (filtered edges) and the camera snapped to whole texels in the sun's own frame. Frames qa-stairs-a/b (half a metre apart) show no blocks and no change between them; hero-1 9.5 ms @1440p (unchanged within noise); famous views 0.002%.
- The slow-life bench: seated, the mouse looks around (±1.9 rad, up and down); only a walking key (arrows/WASD) stands you up, and you rise facing where you looked; 1 2 3, N and Space still work there. _play 40-seated-key checks it.

## Hachi's whistle, seen coming; tipsy with you (2026-09-29, Tan)
Tan: "whenever or wherever I whistle from, the pup magically appears next to me ... Sometimes it walks from behind and from the side"; the run should be seen, and cute. And after the Strong Nine: "I want the puppy to giggle, roll on the floor, and enjoy that moment."
- **Where it comes from.** If you can see it (within 40 m, 30 degrees of the lens, nothing between) it runs from where it is. Otherwise it is set where you'll see it come, never popping up in view: a street 10-18 m ahead that is hidden right now (behind a building's corner, a car, a machine: the walk grid now marks colliders over 1.1 m and the store as `tall`) and whose way to you comes out into the middle of the view within 5 m. Fallbacks, in order: hidden to a side and out into view within 10 m; round a corner at the view's edge; far and small in plain view (24-40 m); the old corner out of view. It is set facing down its way, already running.
- **The run.** A bounding gallop (4.4 m/s; a bounce a stride, rocking nose-up nose-down), ears half back, tongue out, tail going hard, a yip as it closes. It runs for a spot that slides in from 7 m out in front of you to 4.2 m, so it swings across the middle of the view, not along its edge. The answering yip comes from where it is placed (it used to sound at the old spot, out of earshot).
- **The greeting** (act `greet`, 3.8 s): a skid, a spin on the spot with a giggle, two little bounces up on the hind legs with a yip, then a sit looking up, tongue out, a head tilt and a "hm?". Already just in front of you, it greets you there; beside or behind you, it bounds out to the spot first.
- **Why 4.2 m:** at eye height 1.6 m and a 70 degree lens, a 24 cm pup nearer than ~4 m is under the bottom of the view. The old greeting (a hop at 2.2 m) was mostly unseen for that reason.
- **The facing-the-store case** (the start): everything within 28 degrees beyond 11 m is the store, so it comes round the store's corner at the edge of the view and swings in (on screen about a third of the run, then the whole greeting). Facing anywhere else, most of the run is seen (car park: out from behind a parked car).
- **Tipsy** (`GUIDE.tipsy`, from main.js's onTipsy): Hachi comes flat out (5.4 m/s) to 4 m in front of you, the same way, then for the ten seconds rolls onto its back side-on to you, tipped your way so you see the belly and paws going, giggling (a new `dog-giggle`: quick breathy huffs with tiny squeaks), a play bow, a tail chase, more rolls. Then back to the tour.
- **Cost:** the way to you is grown over the whistle's 0.85 s (3 ms a frame) and other ways pause meanwhile (two fields grown in turn undo each other's work: a 150 ms stall before); the spot search is 1-4 ms once, about 35 ms the first time after load (compiling). No new draws or textures; download unchanged (4.90 MB).
- **Checks:** `_guide` whistle (five cases: facing the store, facing the car park, the pup behind the store, in view 22 m off, beside you) wants no pop-up in view, the greeting, the timing, and the run on screen (most of it; a quarter facing the store); `_guide` tipsy wants it there within 4 s, two rolls or more, three giggles or more, in the lens 85% of the time. All `_guide`, `_play`, `_konbini` pass; hero guard 0.002 / 0.001 / 0.000%.

## Hachi guides and doesn't follow; the station over the plaza; vending machines quiet (2026-09-29, Tan)
- **A jog** (Tan: "a little annoying to slowly follow the dog"): it leads at 3.6 m/s (your walk is 2.55), 4-9 m ahead along the way, bounding a little; past 9 m it stops and looks back; you running, it runs (up to 5.4). The tour's own time is set by the walker (the test's walker, 2.3 m/s, takes 425 s), but you no longer walk at the dog's pace.
- **A guide, not a follower** (Tan: "very difficult to guess whether it wants to follow me or I need to follow it"). Gone: bounding after you, keeping you company, invitations, the lap round your legs. Now: walk away (off its way for 1.7 s, the spot receding while it waits, or 16 m off: raised from 10, as it now leads from up to 9 m) and it stops where it is, tilts its head, and waits, playing a little. Walk back to within 4 m and it carries on the tour where it left off. Whistle (F) and it comes (seen, as before), greets you, and rushes you to the nearest place you haven't been (by the way; one you walked away from counts 30 m further), the tour going on from there.
- **The hello** now says F: "Follow me, I'll show you around town. Wander off whenever you like: press F to whistle and I'll come running." (7 s on screen.)
- **The station over the plaza** (Tan: "I don't hear the station announcements in the station plaza"): the plaza runs 6-36 m from the zone's middle, where the old edge (a third, gone by 42 m) left it at 0.15 under the plaza's own sounds. Now edge 0.75, near 20, far 62: the plaza's middle 0.34 (the concourse 0.45), its far corners 0.20. In the train's listening spot the station dims to 30% (full dim within 1.5 m of it, back by 6 m) under the next-stop announcement.
- **Vending machines** have no prompt or E (they aren't for sale yet); the dispense animation stays in vending.js for later.
- **Tests:** `_guide` turnaway (it waits and doesn't follow; walk back and it goes on; F: it comes, greets, and rushes you to the nearest place, jogging 3.6) and wander (a minute wandering: it stays within 3.5 m of where it stopped) are rewritten; the tour's walker follows the dog's trail (a player does not beeline at a dog 9 m ahead round a corner) and wants its mean moving speed over 2.7 m/s (2.83). `_play` 23-station wants the plaza at 0.25 or more, its corners 0.12, and the dim in the listening spot. All `_guide`, `_play`, `_audio` pass; hero guard 0.002%; download 4.90 MB.

## Hachi's hello, every start (2026-09-29, Tan: "Why don't we do this when the game begins, not just once for every user?")
- **Every start, nothing remembered.** The hello no longer waits for you to happen to look at the pup off the famous view, and no longer writes localStorage (the `hachi-intro` key and `?fresh` are gone). 0.6 s into play it runs out from its spot behind you (the bounding gallop) to 3.2 m in front, turns to face you, sits, yips, and the caption shows (same words, with F). It then sits there (`ready`), watching you, a tilt or a play bow now and then, until you walk off the view; then the tour.
- **The view eases down to it.** The start view looks up at Fuji (pitch 0.16): a pup 3.2 m in front is under the frame's bottom (at 6 m only its ears showed). While it runs in and says hello, main.js `watchPup` eases the view down to it, aiming 0.18 rad above it so it sits in the lower third with the store behind (pitch about -0.28), then eases back to where you were. Nothing holds you: move the mouse or take a step and the view is yours at once. The caption moved up to 36% from the bottom, just above the pup, so it doesn't cover it.
- **The famous-view rule** (the pup goes home when it would be in the picture) doesn't apply during the hello and the wait after it; R (a jump back to the view) still sends it home. The hero guard runs frozen (no time passes, so no hello): 0.002 / 0.001 / 0.000%.
- **Checks:** `_guide` intro (fires 0.6 s in, sits 2-4.5 m in front within 5 s, faces you within 25 degrees, the caption says F, waits in `ready` on the view, leads when you walk off, nothing stored); `_play` 45-hachi-hello, in the real loop (the view dips to -0.29 and comes back to 0.16 within 0.05, the pup on screen every sample while it sits, the caption shown). All `_guide`, `_play`, `_konbini`, `_audio` pass; download 4.90 MB.
- **4 s later** (Tan, same day: "I would want the players to first take a look at the view before engaging with Hachi"): the hello starts 4 s into play (play time: the pause card stops the clock). Walk off the view sooner and it comes then instead; the pup never starts the tour before it has said hello. `_guide` intro checks both (4.0 s; 0.7 s after walking off).

## Tan's song on the start and pause cards (2026-09-29)
- **The song:** "Nippon Let's Go", made by Tan with Suno, their own lyrics. It loops while the start card or the pause card is up; the game's own sound steps down to 15% under it (a new `world` bus in core/sound.js; the song goes straight to the master); pressing Start or resuming fades it out (1.5 s) and the game back in; pausing again picks the song up where it left off. Streamed (an `<audio>` element), fetched only when a card first plays it.
- **The file** is Tan's to download from Suno (its CDN answers 403 to a direct fetch, and the game makes no requests to other domains): `assets/audio/nippon-lets-go.mp3`, then `npm run audio`. A `song` entry in audio-cuts.json keeps it whole and in stereo (96 kbps AAC; everything else is mono and cut). Until it is there, the cards are silent as before.
- **The browser's rule:** no sound before the visitor's first click or key. The first click or key anywhere now starts the sound, so the song plays on the start card if the visitor touches anything on it (the volume, the card) before Start; most will press Start at once and first hear the song on pausing. A "click to begin" step before the card would guarantee it; not added (Tan's call).
- **Checks:** `_audio` "Tan's song loops on the start and pause cards" (tested with a stand-in file, not committed): on a card it plays and the game is at 0.15; in play it is paused and the game at 1; paused again it resumes later in the track, not from the top. Skipped while the file is missing. All `_audio`, `_play` pass; download unchanged until the file is added.
- Also: `_guide --only x` no longer writes its trail map into a folder named after the scenario list.
- **The file arrived** as `assets/audio/title bgm.mp3` (172 s, stereo, 256 kbps MP3, 5.5 MB). Encoded HE-AAC (`aach`) 48 kbps stereo: 1.03 MB (plain AAC 96 kbps was 2.1 MB, 64 kbps 1.4 MB); plays and loops in Chrome, WebKit and Firefox (`_audio` in all three, all pass). It is mastered loud (rms 0.22 against the store music's 0.05, its first 5 s quieter), so its level is 0.3, not 0.55: the lead on the cards without a jump when play comes back.
- **Over budget:** `npm run size` 4.90 -> 5.91 MB (budget 5 MB: FAIL); the audio set 4.37 of its 4.5 MB. The song is fetched only when a card first plays it (streamed, `preload: none`), so a visitor who never touches the start card and never pauses never downloads it; one who does downloads about 1 MB more. Left for Tan: raise the budget, count the streamed song apart, or loop a shorter part of it.
- **Tan's call: the first 45 s, looped.** Cut in stereo (0-45 s), the last 2.5 s faded out so it comes round to the opening cleanly: 276 KB (HE-AAC 48 kbps). Still 0.17 MB over with it (5.17 MB), so the store music moved to HE-AAC 32 kbps mono (1.72 -> 1.37 MB; its level in play unchanged, rms 0.012). `npm run size` 4.87 MB (budget 5 MB: pass; 4.90 before the song). `_audio` passes in Chrome, WebKit and Firefox, and checks the 45 s loop wraps to its start still playing.

## Tan's play-through: Deer Park last, the track walkable, trees off the road, the train's ring (2026-09-29)
- **Deer Park last.** The tour went konbini, Han, then out over 富士見橋 to the gate and back. Now it goes konbini, Han, the shopping street, the station and the train, the crossing, the shrine, the bench, then back down lane x 30, over the master junction and the bridge to the gate, where it naps (A.nap moved from the bench to beside the gate). With everything done out of order (whistles), the last thing it takes you to is still the gate. Tour 475 s for the test's walker; every sound place still passed near.
- **Sunk at the gate.** The farm track from the bridge's end to the gate is drawn 12 cm up (TOWN.land.track.top) and was never a platform: Hachi stood at 0 in it (you, at 1.6 m, never saw the 12 cm). It is walkable now. New `_guide` check `ground`: along the whole tour, every half metre, nothing drawn more than 6 cm over the ground Hachi stands on (1,558 samples, 0 now; night-light pools and decals aside).
- **Trees on the road.** The fix that slid trees clear of buildings (2026-09-28) slid 8 into lanes (up to 4.7 m; two by the small park, Tan's photo). A slide may no longer end on a carriageway (town-core's new `ctx.onRoad`, the kit network's carriageways and junctions plus 0.6 m); it tries straight away from the building, then along the street either way; with no room anywhere the tree is left out (7 of 350: town x 7.5/14.8/22.1 by lanes z 45, 80 and 112, x 26.5 z 93.5). `_play` 03-trees-clear now also wants no trunk on a road and at most 8 left out. One of them showed at the left edge of the famous morning view, behind the store (the house behind it shows instead): hero-1 0.335% (guard 0.5%), hero-2 0.128%, hero-3 0.088%; not re-baselined, Tan to look.
- **The train's listening ring** shows only while platform 1's train stands with its doors open (`opening` past 90%, or `dwell`), and the next-stop announcement plays only then (experiences `show(on)`: no ring, no column, no E; `_play` 24-train checks both states).
- **Hachi took Tan back to the bench** they had sat on: the pup counted a place done only when you stood in its ring, and the bench seats you off its ring. Experiences now carry `used` (their own done(): the seat, Han's show, the konbini, the announcement) and `hidden`; the pup counts either. `_play` 26-slowlife checks sitting marks it done for Hachi. Also found: at a spot reached within a second of setting out (the konbini) its clock never ran, so it never let you walk away (`atSpot` now counts time).
- All `_guide` (8), `_play` pass; walks stuck 0; download 4.87 MB.

## Paused, everything stands still (2026-09-29, Tan: Hachi said hello behind the pause card)
- The game loop kept drawing at 10 fps behind a card and gave the world its time step, so the pup's clock ran on, its hello fired and its caption showed over the pause card. Now while a card is up (the start or pause card) the world's time step is 0: Hachi, its hello, the trains and the crossing, Han's show, the konbini's scene, the petals all hold; the clock is still read so play resumes without a jump. The scene is still drawn, blurred. Hachi's caption hides under a card (`body.game-paused`) and comes back where it was on resume. Under the song the game is now silent (duck 0, was 0.15).
- `_play` 46-pause-holds: the hello shown, pause 3 s: the pup's clock, the trains and the pup don't move, the caption hidden; resume: time runs, the caption shows. `_guide` turnaway now walks away from where the pup is leading (walking "away from the pup" could run past the place it was leading to, and it rightly kept leading).

## Launch: phones, loading, no WebGL, GPU reset, small windows (2026-09-30, QA-001/003/004/011/012/023)
- **Desktop only, said kindly.** A head script in index.html decides before anything loads: a coarse pointer with no fine one, or a touch screen under 600 px, or touch without pointer lock, is a phone or tablet. It gets a static card (the key art, the name, "Made for a computer", Copy link and, where the browser has it, Share) and the game's code is never imported: a phone downloads the page, the key art and a 2 KB loader (~170 KB) instead of ~1.5 MB of code, fonts and Fuji. A touch laptop with a trackpad plays.
- **No WebGL 2** (three r180 needs it): the head script tests a context (and gives it back); main.js also catches the renderer failing. Same card, its own words; nothing else loads.
- **Loading card**: the start card's art and name with a line and a bar, static HTML, painted at first paint (~0.13 s) instead of after the build (8 s here). The bar's glint runs on the compositor, so it moves while the build blocks the thread; main.js steps the line and bar and gives the page a frame before and after buildTown. The game's own card takes over in the same place.
- **GPU reset**: `webglcontextlost` is prevented, the loop stops, the sound suspends, the card says "The graphics card reset" with Reload. No rebuild: not worth it for a rare event.
- **Small windows** (under 800 px wide or 560 px tall): the card takes the window's width, the art crops to 42vh (Fuji's peak kept), the keys wrap over a full-width Start, and if it still doesn't fit the card scrolls. Normal windows unchanged.
- **Debug keys** C, O, G and `window.__scene` / `__setOutlineRes` are dev only. line/sfx.js read the volume off `window.__scene.sound`; it now reads `soundBus.level`.
- The cards' words live in strings.js (`boot`, `gate`); vite.config.js writes them into index.html (`%S:key%`), failing the build on an unknown key.
