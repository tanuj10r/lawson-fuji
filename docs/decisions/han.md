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
