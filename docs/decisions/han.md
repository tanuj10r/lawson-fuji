# Han and the RX-7 (experiences build, 2026-09-28)

Files: src/world/han/* (rx7, han, index), the one call at the end of
land/index.js `buildLand`, one line (+ import) in land/parking.js, the
`han-*` spots in config.js.

## Where
- **The bay:** the road row's last bay by the bridge road (town frame
  x 22.95, z 4.7, `HAN_BAY`), the car nosed toward the main road. Han leans
  on the driver's side (the car is right-hand drive), which is the side
  that faces the spawn, so turning round at the spawn you see him.
- **parking.js:** its seeded draw had put a kei van (standing sideways,
  3.4 m across a 2.5 m bay) over Han's neighbouring bay and between the
  spawn and Han. The one line skips parking any car in a road-row bay
  within 5.1 m of Han's (the van); the other cars keep their bays, since
  the draw is unchanged.
- **The glow** is on the neighbouring bay, 1.1 m in front of him
  (`HAN_SPOT`, r 0.85), clear of the car's swing out and of the door.

## The show (17.74 s, the length of han-drift)
- 0-2.8 s the nod, he stands, the door opens, he gets in, it shuts; the
  drive 2.8-15.4 s; out and back to the lean by 17.7 s.
- **The drive** is a turtle path of straights and arcs, each with speeds
  at both ends, scaled to fit 12.6 s: out of the bay onto the main road,
  flat out east, a flick round (180 at x 62, R 2.6), back west, a drift
  round through the master junction (180 at x 30, sweeping into the
  bridge road's mouth), then reversed back along the way out into the
  bay. Drift angle and counter-steer are laid on the arcs; smoke comes
  from the rear wheels while it slides (one InstancedMesh of 64 cartoon
  puffs that pop, swell and shrink: no transparency).
- **The clock is the song's**: the show advances on wall time, not the
  game's capped dt, so pausing (10 fps, 1/20 s steps) can't drift it off
  the music.
- **In the way:** it looks 0.1-0.7 s ahead; if the player is within
  0.55 m of where the car will be, it brakes to a stop and waits (the song
  plays on) and goes on when they step aside. No subtitle: UI strings
  aren't mine to add, and a waiting car says it. The car's collider
  follows it (its turned box's AABB); Han's while he stands.
- **No camera takeover.** The player watches from where they are; the
  junction is 10 m from the glow.

## The trigger (Tan's change)
- The song is a sound zone at the glow (near 3 m, far 38 m, level 0.5;
  far 20 since the final QA, to keep it out of the famous view):
  it rises out of nothing as you walk up. Stepping into the glow starts the
  show: the zone is muted and the track restarts as a one-shot from the
  top so the drive lines up with it; at its end the zone comes back.
  Re-arms once you have stepped 0.6 m out of the glow. E does the same.
- Door thunks reuse the engine's `fridge-door` recipe through
  `soundBus.oneShot(..., { recipe })`. Engine and tyre sounds were left
  out: new recipes would mean editing core/sound.js, which isn't mine.

## The car
- One smooth loft (120-odd stations x 55 round the section) with the arch
  cut-outs made by the section itself (the side's lower edge follows the
  arch), so the wheel openings are exact and need no boolean. The cabin
  is a second loft blended up out of the body's top; its glass and the
  driver's door are cut from the same grids (face classification), so the
  edges line up and the door can swing on its hinge.
- Paint is one 1024x300 side-projected Canvas2D map (orange, the black
  sweep, a pinstripe, shut lines, the rear-quarter intake), 1.2 MB.
- Real name, per Tan's exception: the Mazda RX-7 (FD3S) in the VeilSide
  Fortune kit. The plate is invented (富士山 330 は 23-06).

## Han
- Tan asked for the likeness: a stylised rendition built in code (long
  oval face, high cheekbones, narrow eyes under straight brows, goatee and
  a thin moustache, the half-smile), shoulder-length shaggy hair with the
  part on his left and the fringe across to his right, navy jacket open
  over a grey-olive crew-neck, a chain, khaki cargos, dark trainers.
- Parts are batched per joint and kind (skin / everything else), colours
  per vertex: 15 draws. The face is a textured patch over the head.

## The real-car pass (2026-09-28, evening; Tan: "real, realistic, not
## anime"; "Han looks pathetic"; music only with the engagement)
- **The car leaves the cel ramp.** Tan asked for the real car, so this one
  object is physically shaded: MeshPhysical paint (orange under a
  clearcoat, roughness 0.42), gunmetal roof and pillars as on the film
  car, tinted reflective glass over a real interior (buckets, dash,
  wheel), chrome five-split-spoke deep-dish rims, rubber, black trim,
  glossy tail lenses. Everything else in the game stays MeshToon; the
  screen-space ink still draws the car's silhouette, so it sits in the
  frame. No src/core change, no bloom.
- **Reflections need an environment.** There is none in the scene, so
  rx7.js draws a 64 px cube map in code (graded sky, a sun patch, a
  horizon row of pale and dark blocks, sunlit asphalt); three PMREMs it
  once at load (~1 MB, half float). Its intensity follows the scene's
  sun (found once in ctx.scene: the shadow-casting directional), so blue
  hour doesn't mirror a day sky: k = sun.intensity / 2.2, clamped 0.22-1.1.
- **Shape:** broader squared nose, a trapezoid mouth with grille bars,
  headlamps wrapping over the nose edge, two big round tail lamps a side
  in oval wells (my reading of the Fortune's tail; unsure whether the
  real kit has two or three: log it for Tan), the wing's stanchions taller
  and swept, a slight dihedral, 19" wheels (tyre R 0.33, rim 0.262).
- **Cost:** +6 draws where the car is seen (roof, rims split from tyres,
  headlamp and plate as lit materials, grille), ~+25k triangles; paint map
  unchanged (1024x460); + the env cube and its PMREM (~1.1 MB); +4.9 KB
  gzipped source. Frame time at the han spots measured 8.4-10.9 ms after
  vs 10.2-14.2 ms before, but hero-1 (untouched) moved 13.8 -> 9.4 ms in
  the same pair of runs, so that is load noise, not a gain: call it even,
  slightly heavier per pixel on the car (physical BRDF + clearcoat).
- **Han, from the still.** Rebuilt to real proportions (1.78 m, head
  0.157 wide, shoulders 0.4): the lean is the still's diagonal, hips on
  the quarter panel just ahead of the rear wheel (LEAN moved 5 cm in and
  5 cm back), legs out 29 degrees and crossed at the ankle (left over
  right, toes out), pelvis and spine tilted back so the small of his back
  rests on the deck, head forward and a little to his right, arms folded
  low at the belt with the hands tucked (wrist bend worked out in the
  elbow's YXZ frame: toward the body is local -x for the left arm, +x for
  the right). Cloth is displaced tubes: ridges in the jacket and cargos,
  the hems bunched over the shoes, cargo pockets with flaps, a stand
  collar, the jacket open a hand's width over the grey-green top, the
  chain and pendant. Head sculpted (long, cheekbones, jaw to the chin,
  forehead sloping back), a nose mesh, the face map redrawn bolder so it
  reads at 1.5 m; hair is a scalp shell with a broken hairline plus ~60
  tapered strands from a centre part (fringe over the forehead corners,
  sides over the ears, back to the collar). Skin darkened (0xc48e68): at
  sun 2.2 the old tone clipped to paper. Cloth on the 4-band ramp so folds
  show. ~20 draws (was 15), ~+9k triangles.
- **Music only with the show.** The approach zone is gone: nothing plays
  until the player steps into the glow, then han-drift starts from the
  top with the nod as a placed one-shot (near 6, far 24: the famous view
  is 22.8 m off). It ends with the show; walking off fades it by distance
  for its first 8 s (the engine's placed voices follow the listener that
  long), after which it holds its level until the track ends at 17.7 s. A
  true fade on leaving would need a stoppable one-shot in core/sound.js,
  which isn't mine. E still starts it (the spot keeps its prompt); the
  play check now also steps in without E and checks nothing was audible
  on the walk up.
- New shot spot `han-getin` (t = 2.0 s: door open, Han getting in) to
  check the door and the seat pose.

## The portrait pass (2026-09-28, night; Tan: "mimic the exact actor", "as
## long as it doesn't add weight")
- **One head grid, not a sphere plus a patch.** The head is a 96 x 56
  parametric grid (azimuth x polar), warped so three quarters of its
  columns cover the front 180 degrees and its rows crowd from the brow to
  the chin (~4 mm on the face). The features are a height field on the base
  skull (`features()`): brow ridge, sockets, the nose as a bridge widening to
  the tip with wings and an underside, cheekbones and the hollow under them,
  philtrum, the upper lip with its bow, the line, the lower lip, the fold
  below, the chin. The face map (512 x 384 RGBA, 0.75 MB with mips, drawn
  in code) is painted in the same (azimuth, base height) frame, so every
  mark lands on the form it belongs to; its bottom 4 % is a white swatch
  the vertex-coloured parts (eyes, lids, ears, neck, catch lights) point at,
  so the whole head is one draw with one material. CanvasTexture flipY is
  off for both maps (v runs crown to chin, root to tip, as the canvases do).
- **Eyes are meshes.** An eyeball cap per side (sclera shaded under the
  lids and pink at the inner corner, an iris lit from below with a dark
  limbal ring, a pupil, a slight corneal dome) set 10.5 mm back in a socket,
  lid strips on a sphere just over it: the upper thick and heavy (a
  monolid), the lower thin, both running from the lash margin down to the
  socket floor. The lower lid's normals are bent down: at sun 2.2 a lit
  skin strip clips to paper and read as a white crescent (it took a
  vertex-recolour test in the page to see it was the sclera showing below a
  too-short lid, then the lid lit as a shelf). The catch light is a 1 mm
  disc in white vertex colour, lit like the rest, so it dims at blue hour
  (an unlit one glowed at night).
- **Skin shades softly.** The face, neck and hands use a 10-stop ramp
  (136..255) instead of soft3's three bands, with the same violet shadow
  tint: a painted face, not a cel mask; the town keeps its bands.
- **Hair as ribbons.** ~80 flattened, slightly cupped ribbon clumps
  (Catmull-Rom spines over the scalp shell then hanging, 3 quads across,
  tapered), in an inner layer 1.5 mm off the scalp and an outer at 6 mm,
  with a 64 x 256 strip map (strands along the clump, ragged edges and a
  short frayed tip in alpha, alphaTest 0.5, no sorting) and a 4-stop ramp
  with a crisp highlight band. The fringe parts a touch to his left and
  sweeps sideways to the cheekbones; the sides fall past the ears to the
  jaw, the back to the collar. Wide overlapping clumps close to the skull
  were the cure for the "rope" look: the depth ink pass lines every ribbon
  edge, so fewer, wider, closer ribbons read as painted hair, many thin
  lifted ones as a wig of strips.
- **The ends move.** A per-vertex `aHang` (0 on the skull, 1 at the tip)
  and a `uSwing` uniform in the hair shader (wrapped round toon.js's
  shadow-tint onBeforeCompile; no core change): a damped spring in the
  head's frame kicked by the head's turn rate and its own acceleration
  (the car), clamped to 3 cm at the tips, stepped from `apply()` on wall
  time (it's already called once per frame by index.js; no rAF of its own).
  The shadow and ink passes see the unswung hair: a few mm, invisible.
- **Cost, measured (probe in the page, shots --no-density --no-train):**
  Han 22,406 -> 28,400 triangles (+6.0k), 18 -> 17 draws, his textures
  0.33 -> 1.08 MB (+0.75 MB); frame ms at 1440p han-close 11.2 -> 8.7,
  han-face 9.6 -> 8.5, han-head 8.4 -> 7.8, hero-1 10.3 -> 10.2 (noise:
  call it even); download 4.76 -> 4.73 MB after the merge (+~8 KB of code
  here, less elsewhere); hero guard 0.000 % x 3.
- **New spot** `han-head` (0.85 m, day / golden / blue): the portrait check.
- **Left open:** the face is a likeness in the game's painted style, not a
  photograph: the skin is still a little orange under the day sun (the
  grade), the goatee reads as strokes at 40 cm, the eyes don't move
  independently of the head, and the hair ribbons still carry a fine ink
  edge each where the depth pass sees them stacked.
- **Review fixes (the same night):** skin to a light-medium ivory-beige
  (base #cfa68b, the mottle and zones lightened with it, the skin ramp
  topping at 236 so lit planes stop clipping toward paper; reads warm at
  golden, cool at blue, no longer orange by day); the ears in the shade
  tone, set 3 mm back, two locks hung over each (they read as an orange
  blob beside the hair); the eyes smaller (R 11.7 mm) and hooded (aperture
  0.25 / -0.13 rad, sclera a shade darker); the scalp shell 8.5 % fuller at
  the crown and every ribbon's root lifted 9 mm there, settling by the ear
  line; the fringe as four heavy locks a side swung outward so both eyes
  show. Han 28,016 triangles, 17 draws, 1.08 MB of textures; guard, play
  and route checks pass; 4.73 MB.

## The stills pass (2026-09-28/29; Tan: "Han's hairstyle is badly
## designed... try to replicate the face and hair style... he is wearing
## a casual overcoat", with the car-park still of the actor)
- **The part moves to his right.** The old hair was a centre part with
  flat curtains, which is what read as "badly designed". Now ~75 chunky
  ribbon locks from a part at azimuth -0.4 (his right): a fan of ten
  fringe locks whose ends step down a diagonal (th 0.98 over his right
  brow to 1.34 past his left brow, the last four hanging to the
  cheekbone), the right side swept back over the temple with two pieces
  falling at the corner (without them the temple read as receding), the
  sides in two layers over the ears (inner 5 mm off the scalp, outer
  15 mm) flicking out 2-4 cm at the jaw, the back to the collar, fifteen
  short clumps piled at the crown. The scalp shell is 1.09 x the head
  across and 1.08 deep, its crown 18 % taller and more so on his left
  where the sweep piles. Ribbons are narrower (half-width 15-24 mm, was
  up to 28) and cupped harder (0.5) so each reads as a piece; tones sit
  between 0x261e22 and 0x584848 over a 44/82/126/250 ramp: near black
  with a crisp sheen, not the old brown.
- **What the loop taught:** the first pass was a black bowl. Two things
  fixed it: the fringe ends must lie on a diagonal with gaps between
  pointed tips (uniform end heights read as a wig edge whatever the part
  does), and the locks need tonal contrast between neighbours (with one
  tone the ink pass is the only separation and the mass goes flat).
- **The smile is in the form.** `smileLift(fx)` raises the mouth up to
  3.5 mm at the corners in both the height field and the map (the lips,
  the line, the tucked corners), with cheek mounds beside it, a faint
  fold from the nose's wing and the lower lid pushed up 2 deg. The first
  try drew a crease under each eye as a line: it read as a scar across
  the cheekbones; now a soft patch. Brows flatter (+3.5 mm rise, was 7),
  goatee and moustache halved to light stubble, lips lighter.
- **A denim overshirt, not a suit.** The jacket loft keeps its rings but
  gains deeper folds, a hem sag, fronts hanging apart; over it a stand and
  a rolled point collar (opening 0.55 rad; the first collar was twice
  as wide and read as a shawl lapel), plackets in the jacket's own colour
  (dark ones read as trim) with six snaps on his left, flap chest pockets
  with a snap, dropped unpadded shoulders, sleeves rumpled into rings
  above the cuff. The cloth material gets a tiled 256 x 256 weave map
  (twill, wash mottle, whiskers; mean ~0.9, colour from the vertices), so
  the jacket is worn denim, the tee heather, the cargos twill, all in the
  same draw. Tee mid-blue (0x4c6b94) with a rib; cargos, trainers, chain
  kept.
- **Cost, measured:** Han 28,016 -> 29,250 triangles, 17 draws (same),
  textures 1.08 -> 1.42 MB (+0.33 MB cloth map); frame ms at 1440p in
  the same pair of runs: han-close 8.78 -> 9.56, han-face 8.74 -> 9.35,
  han-head 7.77 -> 8.04, hero-1 9.25 -> 8.93 (untouched; the noise
  band), so up to ~0.5 ms at his own spots, nothing elsewhere. Joints,
  POSES, blendPose, apply unchanged; han-getin and han-drift-mid shot.
- **Left open:** the hair still reads as painted ribbons at 40 cm (each
  edge inked); the face is a likeness in the game's style, not the
  actor; the smile is fixed (no expression change); the collar points
  are soft where a real one is crisp.
