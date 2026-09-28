# Quality pass (2026-09-28): Tan's "black layer", blank houses, on-screen text

Judgement calls, short. Tan's brief: "not cartoony, upscale so it looks
real"; first priority no mistakes like the black layer at the river.

## The river's black layer
- Root cause was not the mirror, fog or a shadow: lawson.js lays the paved
  lot (STREET.lotZ 42.5) 3.8 m past the channel's edge (world z 38.7) at
  y 0, capping the town-side revetment, stairs and lower walk from above.
  The ground plane had its hole (town.js) but no other ground did.
- Fixed as a class, not a case: sinkcut.js cuts every flat, lit,
  street-level quad under the town root back to the sinks' edges after the
  land is built (same UV map, so world-mapped asphalt stays put).  Only
  opaque lit quads count (markers, glows and rings share geometry and are
  not ground); the land marks itself `ownsSinks` because it floors its own
  sinks; any other flat capper is warned about in dev so the next one is
  caught at once.  lawson.js untouched (the coordinator's file).
- The lower walks' bands were authored for a 5.6 m walk and ran 1.1 m over
  the water (a slab band, then a reversed grass band); now they fit 3.2 m.
- Stair nosings 0.11 m deep and darker.  From the head of the flight the
  treads still collapse to a line (the flight's slope equals the eye's
  angle down; geometry is fine) - checked by raycast, not guessed.

## Other stairs, underpasses, slopes (walked, no defects found)
- Under the bridge, the far stair, the pond promenade, the shrine steps and
  tunnel, the station concourse to platform, the crossing path, the train
  door: no black planes, holes, floating or buried pieces.  The shrine's
  torii undersides are dark by design (cel shadow side).

## Blank buildings
- The blankest boxes in town were by 鏡池: a plain two-storey house and the
  old house's back wall to the paddies, and the tea house's 12 m back wall
  of bare plaster facing the paddies' path (what the slow-life area sees).
- Replaced the two houses with 鏡月旅館 (a name echoing 鏡池 and 月見堂,
  no real inn) and an old wooden house (nameplate 小林, a common name, no
  one in particular).  Both face the lane that comes in at z 112, so they
  are read on arrival, from the promenade and from the paddies.
- Built from boxes and quads in the pond's parts (one mesh per material),
  so the pond's mirror shows them; new textures at the size seen: 焼杉
  128x256, aged plaster 128x128, the sign 96x384, the nameplate 64x128.
  The hip roofs are four tiled quads with ridge and hip caps (the kit's
  kawara tile), not the cone the old houses used, so tiles run true.
- The tea house's back got the same treatment (frame in the plaster,
  wainscot, back door under a small roof, high windows, AC, downpipes)
  rather than a rebuild: its front was fine.
- New sign text (旅館, 小林, ゆ, 月 in the brush face) goes in
  src/data/town.js; the brush font needs re-cutting at merge (npm run
  fonts), until then those glyphs draw in the system gothic.

## On-screen text (Tan: instructions only where required; "comm off")
- "comm off" was not a string: the toast is 13 px and sat *under* the pause
  card's backdrop blur, so "Sound off" pressed while paused (or seen
  through the card) read as a smear.  Toast now 15 px and z-index above
  the card.  Verified live: N gives "Sound off" / "Sound on" exactly.
- Cut: the 1/2/3 time-of-day toast (the sky says it), the station master's
  greeting subtitle (his bow is the greeting; same class as the cashier's
  "Welcome!" Tan cut), the bench's narration line.  Shortened: the no-train
  line.  Kept: Sound on/off (the only feedback the key has), doors-closing
  (the player is being moved), the prayer captions (they explain the
  ritual as it happens; part of the experience), the prompts and the
  controls panel (they are the instructions).  Dev-only toasts (C
  coordinates, Shift+C copied, R reference) left as they are.
- strings.js keeps `heroViews` and `slowlife.sit` (now unused) so the
  coordinator's parallel strings.js edits merge cleanly; remove at merge.
