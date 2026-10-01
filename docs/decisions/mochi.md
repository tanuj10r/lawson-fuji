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

## Numbers
See the commit messages and the report (measured at the end).
