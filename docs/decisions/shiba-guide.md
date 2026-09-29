# The guide shiba (Tan, 2026-09-28)

Tan: "Instead of the dog following the player, which won't be visible on
the screen anyway, can we make a very cute dog, a Shiba Inu, which leads
players to all the engagement areas one at a time? The dog is supposed to
look extremely cute."

Files: src/world/animals/guide.js (the brain: the town grid, the distance
fields, the leading), src/world/animals/shiba.js (the model and its rig; the
kennel), src/world/animals/shapes.js (a second morph target),
config.js `ANIMALS.guide` and the `guide-*` shot spots, scripts/_guide.mjs.
Hooks taken in files I don't own, one line each, flagged in the report:
town.js hands the animals the experiences' lists and the lens direction;
han/index.js exports `HAN_SHOW` (is the show running, where is the car);
main.js `__shot` stages the dog for a spot's `guide:` pose; shots.mjs passes it.

## Judgement calls
- **One shiba in town.** The yard shiba became the guide; its kennel and
  bowl stay in the yard, empty (the dog is out, with you). The lying-dog
  model is gone (the standing one has sit and lie as morphs).
- **The look.** The breed's real proportions with the head and eyes a
  little bigger: skull with full cheeks, a short wedge muzzle, black
  nose, dark almond eyes each with a white shine, pale brow spots, small
  thick ears tipped forward and cream inside, the curled tail cream
  beneath, cream 裏白 on cheeks, throat, chest, belly and the inner and
  lower legs. Red 0xd0894a with a deeper saddle; the town's cel material.
- **Bone-free rig.** Legs swing about shoulder/hip with a lift of the
  lower leg (diagonal pairs together: a trot); sitting tilts the body about
  the shoulders and folds the hind legs by morph; lying drops the body
  and lays the head on the outstretched forepaws (second morph). Head
  yaw/pitch/roll, ear perk, tail wag are per-instance floats. One draw.
- **Which spots, and done = stepping into the ring.** The lists now carry
  `kind`; the dog leads only to `engage` spots (konbini, han, slowlife,
  train; `view` is done at the start, you stand on it). experiences.js
  keeps `done` and `r` private, so it counts an engagement done when you
  stand in its ring (a per-id radius in config `guide.engage`, + 0.25 m).
  Hook I would want: the lists' entries carrying `r` and `done`.
- **The way is a grid, not the colliders.** 0.5 m cells over the town
  bounds, built once on the first frame (~210k cells): colliders taller
  than 0.3 m inflated by 0.38 m (at least the player's radius, so you can
  follow wherever it goes), ground below street level (the channel), the
  pond's water with a margin, the store's footprint, Han's bay. Costs:
  pavement 1, other ground 1.5, asphalt 5, car park 2, zebras 1, and no
  step over 0.45 m between neighbours (kerbs yes, the channel edge no).
  One Dijkstra field per goal, grown a few ms a frame (the dog "thinks"
  for a moment when it picks a new place), descended by the dog; the same
  field says how far ahead of you it is along the way.
- **Out of the famous views.** Home is the far pavement behind the view
  (world 4.6, 19.3): behind the lens in all three frames. Keys 1-3 (a
  jump onto a view) put it home at once; walking onto a view with the dog
  in the 60° cone sends it trotting home. It comes back when you walk off.
- **Han's show.** The RX-7's route (han/drive.js) is baked into the grid
  as a hazard band 2.2 m either side; while `HAN_SHOW.running()` the dog
  gets off it to the nearest clear cell, sits and watches the car go by.
- **No sound.** core/sound.js has no bark or whine recipe and I don't
  edit src/core; the brief said "maybe", so the dog is silent. Hook I would
  want: a `shiba-whine` recipe (or a short file) for the look-back after a
  long wait, played very rarely, local.
- **No collider.** It bends its way round you when you are on its line and
  never blocks you.
- **Second pass (the review: "not extremely cute yet").** Plush, not
  lean: the barrel and chest deeper and rounder, thick ruff, "pants" on
  the haunches, thicker neck; legs shorter and sturdier with cream socks
  and bigger paws; the skull rounder with big cream cheek fluff, a shorter
  blunter muzzle, ears smaller and set wider, eyes bigger and darker with
  a clear shine; a tight fluffy tail. The mouth opens with a pink tongue
  at a trot and when it is excited (you near, tail going), the shiba
  smile: the rig reads the ears channel past 1 as "excited", so no ninth
  float was needed. Smoother tessellation: 9.4k triangles, still one
  draw. Motion: a higher bob on the trot, the wag quickening to 17 rad/s
  on the look back over the shoulder, a shake-off when it arrives beside a
  ring. The goal fields are now grown ahead of need (every engagement's,
  the nap's, 2.5 ms a frame while nothing is wanted; ~10 MB of Float32
  for the town), so a new goal never leaves it standing blank.
- **Third pass: the view from behind and above** (following it at eye
  height, 3-6 m, is what a player mostly sees). The tail curl sits back
  over the base of the spine and a little smaller, so the back line, the
  saddle and the shoulders show; the whole body is carried 2.5 cm higher
  (a post-build lift above the knee: longer legs, a longer level back);
  the head is carried higher and forward at a trot with the neck
  stretching from its root; ears a touch taller and more upright with
  deeper red edges and backs; the bob 4 cm at two beats a stride. The
  respawn (H: enterHero, a jump onto the view) was already the jump rule:
  the dog is home, out of the frame, the same frame; _guide.mjs checks it.

## The pup (Tan, 2026-09-28 evening: "this dog is everything but cute"; "if I walk away, the dog should prioritise my interest")
- **Started over as a puppy, not a fourth pass.** Three passes had left a
  lean faceted adult. The new model is a 3-4-month pup at ~24 cm at the
  shoulder (about 70% of the old dog): head near half the body's length,
  very full cream cheeks, a button muzzle, big dark eyes with two
  catch-lights each, brow dots, small soft ears leaning forward, a round
  barrel, short sturdy legs with big cream paws, a fluffy tail curl. 11.6k
  triangles (from 9.4k), still one draw, 4 cel bands (the softer ramp reads
  as fur; 3 read as armour).
- **The "faceting" was a maths bug, not a segment count.** `subdivide` in
  shapes.js ran Catmull-Rom through the section radii, which overshoots:
  the radius rippled ring to ring, the normals wobbled (0.76, 0.75, 0.85,
  0.91, 0.74 along one spine) and a cel band flipped at every ripple, so
  every loft wore stripes. shapes.js now has `smooth()`: monotone PCHIP
  resampling, evenly along the spine, with a quarter-ellipse dome at any
  end whose radius is 0. Only the pup uses it; the other animals still use
  `subdivide` (their lofts are short and shaded darker), left alone.
- **The tail's cream is by position, not by normal.** The underside test
  `n.y > 0.25` striped the curl from above (the same wobble); it is now
  "inside the curl's circle, or below the base".
- **Player-led guiding.** The pup *suggests*: it proposes the nearest
  engagement not done and trots 2.5-5 m ahead. "Not interested" is any of:
  your heading > 100° off its way (the field's downhill from where you
  stand) for 1.7 s, your distance to the spot grown > 6 m while it waits,
  or you > 10 m off. The proposal is *skipped* (not done; skipped spots
  come back after the others). Then a chase: a gallop after you (yip, an
  "awoo" if you are far), once round your legs at 0.9 m when it catches
  up, and a re-plan from your heading (your walk, or the lens when you
  stand): the nearest spot within 80° of it by path metres + 12 m × (1 −
  cos angle), skipped ones last; none that way → company: it stays 2-4 m
  off, plays, and every ≥ 20 s invites toward the nearest one (a play bow
  + yip + 3 m that way, 3 s of waiting) without insisting. Two walk-aways
  in a row and it stops re-planning at once: the next suggestion waits for
  the 20 s timer (else a random wanderer would be chased every 5 s); the
  count resets after you follow for 8 s or at the next invitation.
- **The store, the views and Han's show** keep their rules: in the store
  nothing is dropped and it waits outside by the door; on a famous view it
  goes home out of the frame (that overrides even a whistle: it comes and
  waits behind you); on the RX-7's route during the show it sits aside.
- **Acts, by mood.** `energy` (0-1: back at 0.02/s at rest, spent by the
  acts) and nearness pick an idle act every 2-6 s while it waits or keeps
  you company, never the same twice running: play bow (posture −1 in the
  rig: the body tips 0.5 rad about the hips, forelegs stretched flat),
  roll over (lie morph + the instance rolled π about a centre at the
  body's height, paws wiggling by the gait channel, happy snorts),
  chasing its tail (a 0.11 m circle, head round), zoomies (a 1.5 m circle
  at 4.6 m/s where there is room for one, leaning in, ears back, tongue
  out, a skid and a shake; also round you when you arrive at a spot), a
  hop/pounce (nose down at the top), a sneeze (head back, snap, shake), a
  head tilt with the upper ear perked and the lower drooping (the rig
  reads the tilt's sign), lying chin on paws, and a trip over its paws
  about once in 45 s at a trot. No new pose channel was needed: the bow
  is the posture channel below 0; the roll is the instance.
- **The whistle (F).** A two-note human whistle at you (procedural,
  near 4 far 30). The pup yips where it is (local: you hear it only if
  it is near) and gallops to you; from > 80 m it turns up from a street
  cell 25-40 m off that is not in front of the lens, rather than crossing
  the whole town. Arrived (2.2 m): a hop and it guides on from where you
  are, player-led. Not while the konbini's scene plays (main.js gates it).
- **Pursuit never "thinks".** Chase, come and company used to re-grow the
  follow field every 2 s or 2 m and a field of 80 m never finished while
  you walked, so the pup stood blank (catch-up 10.9 s). `pursue()` goes
  straight at you when you are in plain sight within 14 m, and otherwise
  re-grows only once the last field is ready (limit 2 × distance + 20 m).
  Catch-up 2.3 s.
- **Voice.** The dog-* recipes pitched up and softened for a puppy; new
  dog-awoo (zoomies), dog-snort (the roll), dog-sneeze, and the whistle.
  All procedural, all local, none more often than 1.2 s apart.
- **Checks** (scripts/_guide.mjs): voice (11 recipes audible), follow (4/4
  engagements, 188 s, stuck 0, viol 0, wall 0), turn-away (drop 1.5 s,
  catch-up 2.3 s, next suggestion 75° off the heading), wander (max 10 m
  off after catching up, invite gaps 20/20 s), whistle (from the bench
  115 m away: appears 22 m off at 99° from the lens, reaches you in 4.2 s;
  from 35 m up the road: runs it in 10.6 s). Cost: 0.06-0.75 ms a step
  headless (the field growth), hero-1 733 calls / 9.0 ms unchanged.

## Hachi, and the town tour (Tan, 2026-09-29)
- **The name.** ハチ / Hachi: only in the controls ("Whistle for Hachi"),
  the hello, the docs. Nothing else on screen.
- **A tour, not the shortest way.** `ANIMALS.guide.tour` (config.js,
  world frame) is an ordered chain of 30 street waypoints: the konbini,
  the main road's zebra (kakko), Han in the car park, up the bridge road
  over 富士見橋 to the Deer Park gate (it waits there until you are 7 m
  off, then turns back), the master junction's lane zebra (piyo), east
  along the far pavement behind the famous view, down the shopping street
  (its first zebra, ドンペン堂's theme, the halfway zebra) to the plaza and
  the station's announcements, up the front steps to the train's listening
  spot and back down, the plaza's east end and down lane x 80 to the level
  crossing's bells, back up to lane z 112 and west past the park, north to
  lane z 80 and the shrine's front (its chimes), back west and down to the
  pond's gate, and the slow-life bench; then the nap. `hear` gives each
  sound place and how near the tour must pass (walk signals 14 m of their
  40, ドンペン堂 12 of 24, the station 14 of 42, the crossing 10 of 45, the
  shrine 14 of 26). Legs are routed on the walk grid between waypoints;
  engagements are stops (done = you step into the ring), everything else
  is passed with a glance back where there is something to hear. Measured
  with a follower at walking pace: 823 m, 7.4 minutes including the four
  stops and the nap; the walk itself is about 5.5 minutes. The old
  "nearest engagement" logic survives only for leftovers (spots skipped on
  the way come back at the end, before the nap).
- **Player-led, still.** A walk-away drops the *leg* (an engagement is
  skipped; a waypoint just forgotten), the chase and the lap round your
  legs are as before, and the re-plan picks the tour up at the nearest
  leg within 80° of your heading (path metres + the angle penalty, + 6 m
  against going back over old ground); none that way → company, whose
  invitations now point at the nearest tour leg.
- **Alleys were a cost bug.** Plain ground cost 15 a metre and a lane 30,
  so the grid preferred the gaps between houses to the street beside them
  (Tan's screenshot 19). Every cell is now an alley (400: forty pavements)
  unless it is a street, a zebra, the plaza and the station's strip (12),
  a lot, or the land's open ground (the car park, the river walks' top, the
  paddies' paths, the pond's grounds: 15). Paddy plots cost 120 (the
  paths between them are the way). The tour check counts alley and plot
  cells under the pup: 0 and 0.
- **Water is blocked, not dear.** The flooded plots and the feeder channel
  by the paddies (with a 0.45 m margin; Tan's screenshot 16 had the pup
  half under in it), the pond (as before, 0.5 m margin) and the river.
  `W.water` marks them so the check can count cells on water: 0.
- **Stairs like a person.** A run of three or more risers of 8-45 cm along
  one axis is a flight (found from the grid's own heights, since the
  animals' context has no platform list); its cells are entered only along
  that axis (`Walk.can`, used by the field, the descent and the line of
  sight), and the cells beside a flight at another level are shut, so the
  pup neither climbs a flight from the side nor walks into its side. The
  station's front steps and the concourse are climbed from the plaza, as
  you do. Its feet stay on `heightAt`; the check compares every frame
  (worst 0.000 m below).
- **The whistle answers after the whistle.** F sounds the two notes at you
  (0.52 s); Hachi's ears go up and the answer (the yip, then the run or,
  already beside you, a hop and a wag) comes 0.85 s after the press, on
  the main loop. A second press while one is pending, or within a second,
  does nothing: one whistle, one yip (Tan heard them overlap).
- **The hello.** The first time Hachi is within 25° of the middle of your
  view and 8 m, off the famous view (never on it: that is the opening
  shot), it comes to 2 m in front of you, sits, looks up, a double yip, a
  wag and a head tilt, and a two-line caption near the bottom of the
  screen (strings.js `hachi`; 4.5 s, fades by itself). Once per visit,
  remembered in localStorage (`hachi-intro`, in try/catch) so a returning
  player is not told again. The card is a small DOM element of the
  guide's own (src/core/hud.js is not mine and has only a one-line toast).
- **Memory.** Distance fields are 2.6 MB each; the tour would have kept
  30. `ready` keeps the last six (the current leg's, the next one's, the
  nap's and a few recent), and re-plan scoring never grows a field (a
  grown one's metres, else the crow's and a third).
