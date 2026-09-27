# Final QA: the merged game, played end to end (2026-09-28, launch eve)

How it was played: `scripts/_play.mjs` (new) runs the real loop headless
(not the frozen shots mode), marks the player as locked, stands by each
experience facing it, reads the prompt, presses E through the game's own
key handler and checks what follows; it also audits the sound zones on a
2 m grid over the whole town, frames every glow ring from 4.5 m, tries the
cross-experience key clashes, and reads both maps. Then the konbini test,
the audio test, the walk check, the hero guard, build and size, and frame
times at the heaviest views. Coordinates: `world` unless marked `town`.

Counts: **20 found, 14 fixed, 6 left** (4 on purpose or pre-existing, 2
noted). quality.md's open items 7, 13, 14 and 18 stand as that pass left
them and are not counted again.

## Fixed

1. **Koban bicycle** (handed over, line/station.js): stood across the
   police box's front, 0.1 m into its wall. Now `ry: π/2` at
   `x: P.x0 + 5.0`, along the front; collider moved with it. The notice
   board keeps its place. Checked in a frame.
2. **Coin parking colliders** (handed over, kit/specials.js): 2.6 m
   squares for cars 3.4-4.3 m long. Now the car's own size, turned, 6 cm in
   from the paint (as `parkVehicle` does). Same draws, so nothing else moves.
3. **Park planter** at town (16.2, 115.5) (handed over): collider added.
   No registry entry, so the dressing's draws are unchanged.
4. **Maps: diamonds hidden** (ui/minimap.js). On the M map the shrine's,
   the megastore's and the slow-life diamonds sat under icons or label
   boxes; the station's and the train's under the station icon. On the
   corner map the station's diamond sat on the plaza icon. Diamonds now
   draw last, on top; one that would sit under an icon becomes a badge on
   that icon's corner; two that land together draw once; labels are kept
   off them.
5. **Maps: label fallback** (same file). With every place taken, a label
   fell back to its first try and could cover an icon (the apartment label
   over the shrine icon, once the diamonds reserved their room). The
   fallback now takes the place that covers least.
6. **Pale beams across the sky, seated on the slow-life bench**
   (experiences.js). Seated, your eye is 0.26 m from the spot's floating
   diamond; its faces, seen from right under, filled the top of the view
   as two pale beams. Found with a live pixel probe. A spot's diamond now
   fades out from 3 m to 1.2 m (all spots: it also hung over the prayer
   and the till). The ring stays.
7. **Station spot** (line/station.js): its glow ran under the gate
   cabinets and its diamond floated into the 改札 sign. Moved to
   `gz - 1.9`, `r 1.0`, `h 1.1`: in the concourse, under the sign.
8. **Japanese in the prayer's toasts** (data/town.js SHRINE_PRAYER):
   "Two deep bows · 二礼" and the rest. UI text is English only; the
   Japanese stays on the shrine's signs.
9. **Train prompt** read "E · Ride... (board the train)". Now "Ride the
   train (next one due shortly)"; "Board the train" while the doors are
   open (unchanged).
10. **Han's song at the famous view** (han/index.js). The `han-drift` zone
    (far 38) reached the famous view at 22.8 m (about 0.2 gain, under the
    opening shot) and the store's door at 29.7 m. Far is now 20: it still
    rises as you cross to him, and the opening shot keeps its own sound.
    Sound audit after: no two music zones (han-drift, donki-theme,
    rural-flute) overlap anywhere; the famous view, the door and the
    counter hear no zone.
11. **A famous-view key while seated** changed the time of day but left
    you at the bench (the seat's ease pulled you back). The player's own
    rule is "seated, any key stands you up and does nothing else": main.js
    now returns early while seated.
12. **A famous-view key mid-prayer**: the prayer went on bowing the camera
    at the famous view for up to 9 s. It now lets go the moment you are
    more than 6 m from the offering box.
13. **M mid-prayer** opened the map, and closing it unfroze you mid-bow.
    The map doesn't open while something else holds the player.
14. **Download at the limit**: 5.00 MB, 4.4 KB under the 5 MB budget, and
    `microwave-ding` (9 KB) shipped with nothing playing it (tonight's loop
    has no microwave). The cut is gone: 4.99 MB, 13.7 KB under.

## Left

15. (on purpose) While Han's show runs, the song is a one-shot heard to
    90 m, full to 30 m, so it follows the car along the main road. Walk
    into the store mid-show and you hear it muffled over the store music
    for the rest of its 17 s. It's the show, so I left it.
16. (pre-existing) JS heap 379 MB after a full collection, over SPEC's
    300 MB. The same figure DECISIONS.md last recorded (388 → 379), so
    tonight didn't add to it. Textures: 158, geometries: 854.
17. (noted) hero-1 renders in 11.9 ms at 1440p, just under the ~12 ms line.
    Cutting it would move the famous view (hero-2 is at 0.487% of 0.5%).
18. (noted) From close and to the side, Pen-chan's body covers the lower
    part of 堂 on the band sign (parallax; head-on it's clear, as
    megastore.md meant).
19. (on purpose) The konbini's spot isn't in the maps' diamond list: its
    place is the konbini icon, which is always drawn (on the rim when far).
20. (noted) Build: one warning, the main chunk is over 1,200 kB minified
    (527 kB gzip). It was there before tonight; splitting is not a
    launch-eve change.

## Checked and fine
- All seven spots: the prompt is English ("E · The konbini", "Han's RX-7",
  "Pray at the shrine", "The station", "Ride the train…", "Cheer with
  Pen-chan", "Sit a while"), E does its thing, and no runtime errors
  show across the whole run.
- Han: E starts the show; the car leaves the bay (40 m out by 7 s) and
  parks back to the millimetre at 17.7 s; re-arms.
- Shrine: the prayer runs, the view is handed back (pitch 0.1).
- Station: the master's welcome. Train: "no train" note, then boarded
  when it dwells, then put back on the platform at the chime.
- Megastore burst, slow-life sit and stand, the Osaka posters (station
  platform 1, the Deer Park gate), every glow ring from 4.5 m, blue hour.
- Famous views: nothing of tonight's is visible; the konbini's spot hides.

## Checks
- Hero guard: hero-1 0.291%, hero-2 0.487%, hero-3 0.180% (unchanged).
- Walk: stuck 0 on all six routes.
- Audio (`_audio.mjs` on its own dev server, main's owns 5178): all pass.
- Konbini: 15/15, stock check 0 of 5,942 out of place.
- Build clean (the old chunk-size warning only); size 4.99 MB, 1.33 MB
  before the first click.

## Frame time, 2560x1440 (scale 1.5), day, M2
| View | calls (main) | tris (main) | ms |
| --- | --- | --- | --- |
| hero-1 (the famous view) | 870 (738) | 3.54M (2.54M) | 11.90 |
| pond-fuji | 512 (401) | 3.21M (2.33M) | 9.69 |
| pond-overview | 534 (440) | 3.28M (2.49M) | 8.06 |
| han-drift-mid | 613 (495) | 3.22M (2.15M) | 8.11 |
| donki-street (the spine) | 680 (533) | 2.91M (1.96M) | 7.83 |
| slowlife-seated | 516 (405) | 3.29M (2.40M) | 7.78 |
| town-plaza | 419 (279) | 2.54M (1.44M) | 7.50 |
| store-counter | 537 (413) | 2.97M (1.95M) | 7.19 |
| station-entrance | 388 (258) | 2.65M (1.69M) | 7.03 |
| han-car | 314 (207) | 2.48M (1.49M) | 6.77 |
| donki-front | 535 (394) | 2.59M (1.64M) | 6.74 |
| han-wide (golden) | 388 (263) | 2.51M (1.53M) | 6.48 |
| station-gates | 408 (286) | 2.66M (1.45M) | 6.22 |
