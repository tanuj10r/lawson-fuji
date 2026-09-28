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
