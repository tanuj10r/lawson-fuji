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
