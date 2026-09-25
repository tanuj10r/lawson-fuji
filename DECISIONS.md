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
