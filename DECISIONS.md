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
