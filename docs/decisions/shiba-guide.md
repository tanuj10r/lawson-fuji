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
