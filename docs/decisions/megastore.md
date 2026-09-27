# The discount megastore: ドンペン堂 (experiences, 2026-09-28)

- **Where**: the spine's west side, town x -69.3..-55.3, z 58.2..76.0 (the
  old wagashi and soba lots), halfway from the main road to the plaza. It is
  the first thing on your right after the greengrocer as you walk down from
  the main road, and its blade sign reads down the street both ways. The
  rect is exactly the two lots' footprint, so the lanes' lots behind it cut
  as before.
- **Side effect: the spine's other shops change trade.** Trades are dealt
  round-robin from one deck in lot order (kit/buildings.js), so two fewer
  shops shifts every later shop's trade by two (the spine's east side, the
  lanes). Nothing moves or disappears; the signs change. Keeping them needs
  a hook I don't own: town-core cutting lots without the megastore's rect and
  dropping the two lots after the deal (or buildings.js dealing by lot seed).
- **Street wall kept**: the upper floors stand flush with the neighbours'
  fronts; the ground floor is an open, recessed entrance 3.3 m deep under
  them (the "entrance area" you can step into), floored flush with the walk.
  An aisle is seen beyond it but a sale wagon closes its mouth (collider at
  3.4 m). Goods on the walk stay within 0.65 m of the frontage: 1.6 m of the
  2.2 m walk stays clear. The spine pavement check is unchanged (75 blocked
  slices each side before and after: the lane mouths, not the store).
- **Mascot ペンちゃん**, ours: a round royal-blue penguin with a red baseball
  cap (gold button, gold disc on the front), a red bow tie and a gold star on
  a white belly. The real mascot's nightcap and chest badge are not used.
  Sits in a gap left for it in the band and the fascia (tex.js PEN_AT), off
  centre, so neither the name nor MEGA is hidden head-on.
- **Name and words**: ドンペン堂, tagline 爆安の宮殿 (ours), MEGA, the canopy's
  list of what's inside, banners, POP cards: all in data/town.js DONPEN. The
  E prompt reads "Cheer with Pen-chan" (English UI); its minimap name is
  "Donpen-do, the discount palace" (the brief's `name` would have put
  Japanese in the prompt).
- **Paint, not light**: signs, product walls and the entrance goods are unlit
  (flat) paint, so the front and entrance glow at night with no new light;
  night pools on the walk (5, softer than a first try that whited out the
  pavement), and the mascot takes a faint floodlit emissive after dusk.
  Goods on the wagons are one mesh with face shading baked into vertex
  colours: lit cel boxes went muddy in the canopy's shadow.
- **Two pages of paint, noAtlas**: FRONT 2048x512 (the band is seen whole
  from across the spine, about 100 px a metre at 1080p) and MISC 1024x1024.
  Kept out of the town's shared atlas pages (whose packer caps a texture at
  1024 and could open a new 4096 page). 10.7 MB with mips; the town's last
  atlas page shrank by 1.8 MB (the two replaced shops' signs), net about
  +8.9 MB. Could halve MISC if memory is tight, at the entrance close-up's
  expense.
- **Theme**: `donki-theme` zone at the entrance, near 6, far 24, level 0.6;
  E swells it to 1.0 for about 4.5 s and eases back over 2.5 s. The mascot
  idles (a slow rock, a lazy wave) within 60 m only; E adds a hopping dance
  and 56 price-card confetti (one instanced mesh, drawn only while falling).
  Tunables are a const in megastore/index.js (config.js isn't mine).
