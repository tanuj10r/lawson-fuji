# The Nippon Konbini (experiences build, 2026-09-28)

Files: src/world/store/{shop, hands, cashier, eat, figure}.js (shop.js
rewritten; hands, cashier, eat, figure new), store/{planogram, products,
labels, interior}.js, src/world/lawson.js (the door hook and the spot),
src/ui/hands.js (replaces ui/basketPanel.js, deleted), src/data/{catalog,
strings}.js, config.js `STORE`, main.js (the wiring), scripts/{gen-voices,
gen-sfx, _konbini}.mjs, scripts/audio-cuts.json (30 cuts).

## The loop, as Tan asked for it
- **No basket, no panel.** ¥1,000 a visit, two hands, up to two things.
  The four featured spots are the only things you can take; everything
  else on the shelves is scenery and aiming at it shows nothing. The
  basket stacks stay as scenery by the door and the counter.
- **Prices** as Tan suggested: egg sando ¥298, fruit sando ¥398, tuna-mayo
  onigiri ¥150, Strong Nine ¥198, Choco Wafer Jumbo ¥190. Any two come to
  at most ¥796, so the wallet never refuses; the check stays in the code.
- **Two in each hand, not two in one.** The right hand takes the first,
  the left the second, with the folded note tucked under its thumb. Two
  full hands say "that's your two" without a word. X puts the last one
  back (the other moves to the right hand, so the right is always first).
- **You can't walk out with anything unpaid:** the automatic door stays
  shut on you and a toast says "Pay at the till first: the counter on the
  right". (A famous-view key taking you out mid-shop puts it all back.)
- **A fresh ¥1,000 every visit**, not the change: every visit is the whole
  experience again. The change sits in your left palm as coins until
  you've eaten.
- **Minimal checkout** (Tan's choice), about 6.5 s for two things: her
  "o-azukari shimasu", each thing into her hand, over the scanner, beep,
  the total spoken ("348円になります") and on the customer display, your
  left hand puts the note on the tray, the drawer, the change into your
  palm, your things back, "arigatou gozaimasu" and a bow. You are held
  still and turned to the till while it runs.
- **"Arigatou gozaimashita" as you leave** with what you paid for, then you
  eat each thing in turn outside, about 3.5 s each: unwrap (a can pops),
  two bites that leave scalloped bites (the filling shows), a gobble; the
  can is tipped right up for two gulps and goes down out of sight.
- **Voices are placed at her**, heard from the door (6 m full, 20 m gone);
  the till's beep, drawer and coins within 14 m; eating sounds are at you.

## Judgement calls
- **The cashier stands at the inner register** (z -4.5), not the one by the
  steamer, so the famous views see as little of her as possible.
- **Painted figures** (store/figure.js): the hands and the cashier use an
  unlit material with two cel bands from a key light of their own, the
  shadow band tinted violet like core/toon.js. A sun-lit toon material
  would go dark in the bright store at blue hour and pick up the roof's
  shadow; this reads the same everywhere and joins the store's `lit`
  brightness. Nothing in src/core changed.
- **Drawn on top, near-clamped.** The camera's near plane is 0.25 m; food
  brought to your mouth is closer. The hands' depth is squeezed into the
  front of the range (M3c's `onTop`) and clamped there, so nothing is cut.
- **Eating turns the grip.** Held from behind, the back of your hand hides
  what you hold; to eat, the hand turns palm-toward-you with the food in
  front of it, and turns back after.
- **Voices by macOS Kyoko** (scripts/gen-voices.mjs), one line per total
  two featured things can come to (19) and a general one, 32 kbps. Small
  sounds are synthesised (scripts/gen-sfx.mjs), seeded. Neither is
  committed. Without the files the engine plays its nearest recipe
  (store/shop.js says which) and the subtitles still show.
- **Sounds are asked for quietly as you near the store** (within 30 m): the
  engine plays a recipe until a file is decoded, and the greeting would
  otherwise be a blip the first time.
- **The spot outside** (ニッポン · The konbini) is made in lawson.js with the
  shared experiences.js in the store's frame (the world's). It hides while
  you stand on a famous view: they are the opening shot and must not
  change. Its E says what's inside.

## Fixed inside the store
- **Ice poking out of the ice case:** bars, cones, packs and the wafer lie
  flat in the baskets, and were offset by half their length the wrong way
  (planogram.js, `-fp.h / 2` where it meant `+`), so every flat one stuck
  out of its basket toward the back, through the case's wall.
- **Tall bottles through the gondola tops:** the full-width top board sat
  5 cm below the tallest bottles on each top shelf. The top is now a cap
  on the spine and a rail on each edge, the top shelf open above, as a
  real gondola's is.
- **A check that stays:** scripts/_konbini.mjs tests every unit on show
  against its fixture (basket, case, shelf above); 0 of 5,950 poke out.
- **The bicycle in the onigiri section is not the store's:** it comes from
  the bike rack in src/world/town-edge.js (the Lawson section, `makeBikeRack
  ({ x: -hw - 1.2, z: -8.2, ry: Math.PI / 2 })`). That rack lays its 8 bikes
  along x, ±2.2 m about its centre, so the two nearest the store stand
  inside its left wall (x -8.0 and -7.5; the wall is at -8.5), in the
  chilled case. Handed to the streets builder: turning the rack to run
  along z (ry 0) keeps it against the wall.
