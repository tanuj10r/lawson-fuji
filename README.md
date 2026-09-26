# Nippon Fuji (ニッポン 富士)

A cozy first-person browser game set in a small Japanese town at the foot of
Mt. Fuji. Walk into NIPPON, a konbini in the famous view under the
mountain, browse the shelves, heat a bento, chat with the clerk, pay, and
step back out.

## Run it
```bash
npm install
npm run audio   # optional: encode assets/audio/ for the web (see Audio)
npm run dev
npm run size    # what a first visit downloads
```

Desktop browsers only.

## Controls
The keys that do something where you are standing are always listed in the
corner of the screen, so this table is only for reference.

| Action | Input |
| --- | --- |
| Move | W A S D |
| Run (outdoors) | Shift |
| Look | Mouse (pointer lock; Esc to release) |
| Interact (take, open a fridge, take a basket) | E |
| Your basket (W/S choose, X put back) | Tab |
| Famous views: morning, golden hour, night | 1 2 3 |
| Town map | M |
| Sound on/off | N |
| Pause / resume | Space (Esc also pauses) |

## Audio
Sound files are not included in this repository and are not covered by the
MIT licence. SPEC.md section 9 lists each one and where to get it; save
them into `assets/audio/`, then run `npm run audio`. It cuts, loops,
levels and encodes them as AAC into `public/audio/` (about 2.3 MB, also
never committed), using macOS's built-in `afconvert`. The game falls back
to generated sounds for any file that is missing.

The door chime is the well-known konbini entrance melody, "Melody Chime
No.1 in D major, Op.17 大盛況" by Yasushi Inada (1978, for a Panasonic
doorbell). It is still under copyright and is not ours; the project owner
chose to use it (DECISIONS.md, M3d).

## Credits
- Built on Sakura Crossing by Kenton Wang (MIT):
  https://github.com/Kenton-GMI/sakura-crossing
- Mt. Fuji elevation data: 出典 国土地理院 (Geospatial Information
  Authority of Japan), elevation tiles
- Sound effects: 効果音ラボ (soundeffect-lab.info)
- Door chime melody: Yasushi Inada, "Melody Chime No.1 大盛況"
- In-store music: from "Sounds of Japanese Lawson" by Joonas
  (https://www.youtube.com/@JoonasGebhard,
  https://www.youtube.com/watch?v=9Lott0KfVLg), used with credit
- Clerk voice: VOICEVOX:<character name>
- three.js and Vite (MIT)

## Disclaimer
Unofficial fan project. The store, NIPPON, is fictional; its look nods to
Japan's convenience stores, and it is not affiliated with or endorsed by
Lawson, FamilyMart, Seven-Eleven or any other chain. All products in the
game are fictional.
