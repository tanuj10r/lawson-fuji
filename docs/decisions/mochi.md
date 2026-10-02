# ぺったん堂 / PETTAN-DO, the mochi-pounding shop (Tan, 2026-10-01)

A homage to Kyoto's viral high-speed mochi pounders (one pounder, one turner,
a stone mortar, the chant, matcha-strawberry mochi), with nobody in it and
nothing of the real shop's: our name, our crest (a rabbit with a mallet over
a mortar, in a moon), three moon rabbits. Desktop only for now (the phone
build waits for Tan's test).

Files: src/world/mochi/ (index.js the show, the buying and the frame;
rabbits.js the model and its rig; shop.js the house and the stage; tex.js the
signs; food.js the mochi and Hachi's treat), config.js `MOCHI`, `SOUND.mochi`,
the tour stop and `PLACES`; core/sound.js (the one-shot's `pos()`, the
`mochi-pound` recipe); scripts/_mochi.mjs. Hooks in files that are not the
shop's, each small: town-core.js swaps the builder for the one lot;
animals/guide.js `GUIDE.watchShow / showCue / where` (one block, one branch
in update); store/eat.js `RECIPE.mochi` and the stretchy first bite; main.js
hands the shop your hand (`PETTAN.attach`); ui/map/icons.js the pictogram.

## Judgement calls
- **The lot** is the generated house's, matched by its rect after `cutLots`
  (config `MOCHI.lot`), not a special: nothing else is re-cut. It stays a
  `house` to the street dressing and the map's ground (so the dressing's
  cats and every other lot are exactly where they were). The old house was a
  two-storey box, 5.4 m; the shop's ridge is 4.9 m, its eave 2.5 m. Hero
  guard: 0.335 / 0.128 / 0.088 % (limit 0.5).
- **The stage** is paved level with the pavement (a 17 cm platform), so you
  walk on from the kerb. The mortar, the pounders' steps, the stand, the
  steamer, the bench and the flags are solid; the middle of the stage is
  theirs.
- **The rabbits** are 1.07 m to the top of the head (ears to 1.45 m), heads
  near half their height. With a head that big no paw reaches over it, so
  the mallet never goes straight overhead: it swings between about 50
  degrees up in front and the dough, the body leaning back and stretching
  into the wind-up. Between its own blows a pounder turns a little aside so
  its mallet is clear of the turner. One instanced mesh, 2,816 triangles
  each, twelve pose numbers a rabbit, no bones.
- **The cue table** (`MOCHI.cues`) is keyed by hand from an offline analysis
  of Tan's recording (afconvert to WAV, band envelopes and a spectrogram):
  the mallet is a broadband crack with a 35-110 Hz body, every 1.6 s
  (8 in the 13 s); between blows the chant runs on a 0.4 s pulse. So one
  heavy blow a bar, the two pounders taking turns, and the turner's paw in on
  the pulses between; the brief's "about 18 thuds in four bursts" did not
  hold up in the low band (the other low events are far weaker and sit on
  the voices). Kinds: 8 `hit`, 13 `turn`, 9 `shout`, 1 `big` (the long cheer
  at 10.9 s). Which pulse is the turner's slap and which only a call cannot
  be told from the sound alone: `turn` and `shout` alternate. That, and the
  `big`, want Tan's ear.
- **The audio clock.** The show's time is the one-shot's own position in the
  file (`handle.pos()`, added to core/sound.js: it stands still while a card
  holds the sound), plus `MOCHI.sync` (30 ms, for the output's latency). The
  pose is a pure function of that time and the table, so a slow frame cannot
  drift it. Muted or before the first click the same show runs on the frame
  clock; with no file the engine's recipe (woody thuds, wet slaps, squeaks)
  plays from the same table.
- **Rights.** `assets/audio/mochimochi.mp3` is Tan's file, a recording of the
  real shop's pounding and chant; Tan approved using it (as with the door
  chime, DECISIONS.md M3d). It is never committed; if it has to go, the
  recipe takes over with no other change.
- **Buying** glides you a step to the serving stand (as the konbini walks
  you), because a hand cannot take a mochi from 2 m. The card and the
  ka-ching are the konbini's own; there is no wallet on screen in the game,
  so nothing shows a deduction. The stand has a small reader for the card.
- **The mochi** is painted like what you hold (store/figure.js), not lit by
  the town's sun: the stage is in the eave's shade all day and it must look
  good there. Kept out of `CATALOG`/`PRODUCT` (`STREET` in catalog.js) so the
  store's shelves, labels and stock check never see it.
- **Hachi** pauses his tour to watch (the tour's stop is done when you step
  into the ring, as everywhere). His seat is the stage's edge before the
  mortar, where he is in your frame. The treat is thrown from the stand.
- **Pigeons**: skipped. The flock lives in one culling sphere round the
  plaza and needs perches; a second flock here was not cheap.
- **Brush font**: the new sign text is in data/town.js `PETTAN`; the brush
  face needs re-cutting (`npm run fonts`: pyftsubset is not on this machine)
  for 速, 抹, 茶, 兎 and any other new kanji. Until then those draw in the
  system gothic.

## Phase 2: the hand (store/hands.js only)
Tan: the konbini's hand "looks very fake". What read as fake was the eating: the fingers stood stiff behind the food
and the thumb touched nothing. The hand is rebuilt in its own module, same API (shop.js, eat.js and the mochi shop
call it as before):
- a thumb and four fingers, three joints each, bent in the vertex shader (each vertex knows its digit and segment);
- every frame each digit closes until it lies on what is in the anchor (its bounding box, or the cylinder in it if
  it is round), so eating, the food is pinched between the thumb in front and the fingers behind, and the fingers
  follow it as it is bitten away; nothing is posed by hand;
- carrying, the rest pose is the old one (back of the hand to you). The carried product is drawn under the hand
  whatever its depth (store/figure.js `onTopClamped` looks for `#include project_vertex` without its angle brackets,
  so the product is never clamped on top; not mine to change), so there the fingers keep at least their easy curl
  across the thing's front, as the old hand did;
- soft toon paint of its own: a warm (rose) shade instead of violet, a blush on the terminator, a pale rim; nails
  with a free edge, knuckle and finger creases, the palm's lines, wrist cords; the cuff and sleeve as before;
- the digits ease to their touch and breathe; the wrist sways.
Honest read: clearly better eating and with the mochi; carrying a product looks about as before (same pose, nicer
paint). Before/after frames: the report.

## Numbers (dev build, 1280x720, on the ring, the show on)
- the show: 4 draw calls, 9,516 triangles (three rabbits 8,448; dough, steam, shadows, the tray's two mochi 1,120);
  the house and stage 2,472 triangles, static, batched with the town; the mochi in your hand 2,048 while you hold it
- draw calls in the main pass: on the ring 153; from the street's mouth 361 (the old house: 372); the car park 245 (278)
- textures: the signs are about 0.2 MB of canvas, packed in the town's atlas; its pages are unchanged
  (4096x4096 + 4096x1520); renderer textures 175 -> 181 after merging main
- heap after start 451-540 MB in the dev build across runs (577 before, same build: no measurable change)
- frame 3.6-4.0 ms on the ring with the show on (M-series, headless)
- download: 5.03 MB in all (budget raised to 5.25 MB; mochi-pound.m4a is 73 KB), 1.64 MB before the first click
- checks: _mochi all pass; hero guard 0.336 / 0.130 / 0.094 %; _play 20 pass; _audio all pass; _guide 10 pass;
  _konbini 9 pass

## After merging main's reactions (02a78ca), same day
- **The show and his own bits.** `showStep` runs after the shut-crossing guard and before `own()` (reactions, pigeons,
  the konbini bits, after-the-tour): while he sits at the show those wait. The cues use the reactions layer: a seated
  `startle` at the cheer (never over his sneeze), `happyWiggle` at the bow, `sneeze` for the kinako; a reaction that
  holds him keeps the show's own steering off him.
- **`onTopClamped` fixed** (store/figure.js: `#include <project_vertex>`): what you carry is now clamped on top like the
  hand, so it is no longer cut by shelves and takes its true place among the fingers (the can hides the fingers behind
  it). Frames: hand-after-clamp/.
- Checks: _mochi all pass; _guide 13; _hachi 12 (one run: "after the tour ... on offer" failed while he was mid-zoomie,
  passed on the rerun); _konbini 9; _play 20; _audio all; _maker 37; _selfie 23; hero guard 0.336 / 0.130 / 0.094 %;
  build; size 5.06 MB (budget 5.25), 1.65 MB before the first click.

## The rework after Tan's play-test (2026-10-02)
Tan: the new hand looked diseased, walking up started the rabbits and the music by itself, the purchase was a mess,
"the mochi looks like shit; eating it looks worse", and Hachi's treat was hidden.  What above this line says about the
show playing while you are near, the serving stand's reader and plate, the thrown treat, the phase-2 hand and the
`onTopClamped` fix is superseded by this section.

- **The hand is the old one again**, byte for byte (`store/hands.js` = d64e1aa^'s; the API was already the same).  No
  new procedural hand: Tan is choosing a model separately.  `store/figure.js` `onTopClamped` is back as it was at
  f119d6f (its replace never matched, so what you carry is not clamped on top and the fingers lie over it): with the
  fix the can hid the fingers, and the brief was that the konbini's frames match those before the mochi merge.  They
  do (pair sheets, five items, carried / paying / eating).
- **Quiet until you order.**  Nothing plays or sounds on approach.  The rabbits wait behind the shop's counter, ducked
  so only their ears show; within `MOCHI.near` one at a time peeks at you.  The two mallets rest in the mortar (one
  instanced mesh, each lying exactly where its pounder's own would at the blow, so taking it up is one hand-over: the
  rig's role became a pose number).  The sound label shows when the recording starts (the one-shot is only ever
  started by an order), never on approach; the check asserts both.
- **The order** (E on the ring, "Order a mochi  ¥200"; `MOCHI.order`): pay, enter, show, after, bye.  You are walked
  the step to the order stand (at most 1.4 s, eased) and held for the order as the konbini holds you (about 35 s; your
  eyes are eased from one thing to the next, never cut).  You are free again as they wave; the ring returns
  `MOCHI.rest` s after the last one is back in.
- **The order stand** is new: a slim cabinet at the stage's edge by the ring, with the reader (tipped to you) and the
  plate, and a step behind it for the turner (a rabbit is a metre tall).  The old low table is now only the display
  (tray, price card, the dogs' jar) and moved left out of the rabbits' way.  A hand cannot reach a low table 2 m off,
  which is what made the old purchase a glide and a lunge.
- **The card** is our own plane and material in the mochi module (320 x 200, the konbini's Fujica drawn larger), held
  above the fingertips where it is read, clamped on top like the hand so the two sort.  Up, held still 0.6 s, onto the
  reader (the konbini's ka-ching, the reader's ring green, "Paid ¥200"), away.
- **The entrance**: out by the counter's end one by one (the right pounder, the left, the turner), a hop a leg, a bow
  each to you; then the pounders take up the mallets and the recording starts.  The show itself (the cue table, the
  audio clock) is unchanged.
- **Hachi's treat in view.**  He sits before the mortar on your right (`MOCHI.hachi`), and after the finale the right
  pounder lays its mallet down, hops to his far side with the dried sweet potato in its paw and holds it out; your
  eyes are eased down to the two of them for that beat (2 s) and on to the stand as the turner arrives.  Nothing is
  thrown.  The slice is twice the size it was, to read.  Only the existing hooks: `watchShow` (its `at` is the rabbit
  while he is fed, so he turns to it), `showCue('treat' / 'catch')`, `where`.
- **The serving**: the turner's fresh white lump becomes yours in a puff (a dressed mochi in its paper cup), it hops
  round the left pounder to the step behind the stand, sets it on the plate, bows, and watches you eat.
- **The mochi** (food.js, remade): form in geometry (7,400 triangles: a soft superellipsoid with an uneven outline and
  a sag over its paper cup, a lofted strawberry pressed in tip-down and leaning to you, seven calyx leaves and the
  stem, a ruff of cream, the pleated cup), fine things in its own fragment shader so they are crisp at any size (the
  dusting's speckle, the seeds in their dimples, the highlight and sheen, the leaves' veins, the cup's line, what a
  bite shows).  The highlight is painted, not measured: the strawberry leans to you, so a true one hides under its
  leaves; its light is brought down and toward you.
- **Bites are clean cuts**: every surface is clipped against the bite's balls (two or three a bite, for a scalloped
  edge) and the balls' own surface inside the food is the cut face, coloured from how deep it is in what: the mochi's
  pale skin, white bean paste, cream, the strawberry's rind, flesh and heart.  The first bite draws a ribbon of mochi
  from the bite's rim down toward your mouth (off the bottom of the frame): it thins, sags, snaps, and the food's end
  springs back.  A few flecks of the dusting fall at each bite.
- **store/eat.js** gained only what the mochi's recipe asks: `seat`, `turn`, `bites`, `win`, `per`, `wrapped`, `fx`
  (the food's own extras: `frame`, `puff`, `end`); the konbini's four foods pass none and eat as before.
- **The paper cup** is not bitten (you eat down to it; it goes with the last of it, as the wafer's wrapper does).
- Still plain: the turner's finale lump is the rig's white ball, small in the frame; Hachi does not turn his body to
  the rabbit until it arrives; the stage is in the eave's shade by day, so the white rabbits read lavender there.

### Numbers after the rework (dev build, 1280x720, at the order stand)
