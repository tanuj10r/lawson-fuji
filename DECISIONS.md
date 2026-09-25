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
