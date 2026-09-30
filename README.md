# Take Me Back to Japan (日本へ、もう一度)

Play it at [takemebacktojapan.com](https://takemebacktojapan.com).

A cozy first-person browser game set in Fujikawaguchikko (富士川口湖町), a
small Japanese town at the foot of Mt. Fuji. It opens on the famous view:
NIPPON, a konbini with Fuji rising over its roof. Step onto the glowing ring
by the door, pick something, pay at the self-checkout and eat it outside.
Then walk the town with Hachi, a shiba pup: things to do (the diamonds on
the map) and things to hear (the speakers).

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
| Move | Arrow keys (W A S D also work) |
| Run (outdoors) | Shift |
| Look | Mouse (pointer lock; Esc to release) |
| Interact | E |
| Time of day: morning, golden hour, night | 1 2 3 |
| Back to the start (the famous view, same time of day) | R |
| Whistle for Hachi | F |
| Town map | M |
| Sound on/off | N |
| Pause / resume | Space (Esc also pauses) |

## Audio
Sound files are not included in this repository and are not covered by the
MIT licence. SPEC.md section 9 lists each one and where to get it; save
them into `assets/audio/`, then run `npm run audio`. It cuts, loops,
levels and encodes them as AAC into `public/audio/` (about 3.3 MB, also
never committed), using macOS's built-in `afconvert`. The game falls back
to generated sounds for any file that is missing.

Some of those files are third-party recordings, such as the door chime
(Yasushi Inada's "Melody Chime No.1 大盛況", 1978, still in copyright).
They are not ours, not original to this project and not covered by the MIT
licence; using them is the project owner's call (DECISIONS.md, M3d).

## Credits
Also on the site: [credits.html](public/credits.html), linked from the start card.

- Made by Tan (Tanuj R)
- Built on Sakura Crossing by Kenton Wang (MIT):
  https://github.com/Kenton-GMI/sakura-crossing
- Mt. Fuji elevation data: 出典：国土地理院. 「標高タイル」（国土地理院）
  （https://maps.gsi.go.jp/development/demtile.html）を加工して作成
- Title song "Nippon Let's Go": by Tan, made with Suno
- Sound effects: 効果音ラボ (soundeffect-lab.info)
- Sign fonts (SIL Open Font License 1.1, subset): M PLUS Rounded 1c by
  the Rounded M+ Project Authors; Yuji Syuku by the Yuji Project Authors
  (Kinuta Font Factory)
- three.js (MIT); built with Vite (MIT)

## Disclaimer
Unofficial fan project. The store, NIPPON, is fictional; its look nods to
Japan's convenience stores, and it is not affiliated with or endorsed by
Lawson, FamilyMart, Seven-Eleven or any other chain. All products in the
game are fictional.
