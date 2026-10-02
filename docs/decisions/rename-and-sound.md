# The town's name, and things to hear (2026-09-28)

Tan: the town is Fujikawaguchiko with one typo, **Fujikawaguchikko**; the
experiences split into things to do (a highlight, a diamond) and things to
hear (no highlight, a speaker on the map). Later the same day: nobody boards
the train, and the station master goes.

## The name
- **Fujikawaguchikko / 富士川口湖町.** The English carries Tan's extra k.
  The Japanese is the real 富士河口湖町 with one character of our own
  (川 for 河), so neither is the real place's exact name. The kana on the
  name board is ふじかわぐちこ (kana have no typo to make). It lives once, in
  `data/town.js` `TOWN_NAME` and `STATION`.
- **Renamed** (the town and its station, wherever they stood for the town):
  the station さくら富士 / SAKURA-FUJI / Sakura-Fuji (entrance board, name
  board, fare map, timetable, area map, posters, the walk plate, the in-car
  ad, the map's label) to 富士川口湖(駅) / FUJIKAWAGUCHIKKO / Fujikawaguchikko;
  the town 富士見町 (address plates, bus stop, bus-stop plate, the map's
  cartouche, the merchants' association on a torii) to 富士川口湖町; the
  community bus 富士見コミュニティバス to 富士川口湖町 コミュニティバス; the
  festival poster 富士見 桜まつり to 富士川口湖 桜まつり; the manhole lids'
  town word ふじみ to かわぐちこ; the map title "Town map" to
  "Fujikawaguchikko"; package.json and .claude/launch.json `fujikawaguchikko`.
- **Kept on purpose.** 富士見 means "Fuji view" and is an everyday name for a
  thing that looks at Fuji (the real town is full of them), so things named
  for the view, not the town, keep it: the line 富士見線 (Fujimi Line), the
  street 富士見通り商店街, the shrine 富士見稲荷神社, the bridge 富士見橋, the
  next station ふじみ台 (a different place), the shops and firms
  (富士見不動産, 富士見自動車学校, 富士見交通, 富士見酒造, 富士見建設, ふじみ食堂,
  ふじみ売店, ふじみパーク, ふじみ ちびっこ広場, ふじみ英会話, コーポ ふじみ,
  そば処 ふじみ), the pole-line tag 富士見幹. Also kept: the river 桜川, the
  ticket office さくらの窓口 (a play on みどりの窓口), さくら湯, さくら餅,
  さくらおにぎり. Each is one string in `data/town.js` if Tan wants them too.
- **The licence credit stays**: LICENSE, README's credits, SPEC, AGENTS.
  There is no in-game credits
  screen yet (SPEC M7), so nothing to change there.
- **Audio.** The station's recording (station-ambience) is Tan's file; I
  can't hear what station it names. If it says a real station's name that
  is the recording, not a string: flagged for Tan.
- **The entrance board.** The longer name overran its romaji and the
  canopy's roof hid the board's lower half (it did already with さくら富士駅);
  the name moved left, the romaji and the line right, the board up 0.4 m.

## Two kinds of experience
- `experiences.add({ kind: 'sound', id, name, jp, x, z })` puts a thing to
  hear in `experiences.list` (the map's one source) and nothing in town.
  Engagements are `kind: 'engage'` (the default) as before.
- **Things to do** (ring, diamond): the konbini, the Nippon Fuji view, Han's
  RX-7, the train's listening spot, the slow-life bench.
- **Things to hear** (speaker): each zebra that plays a tune (four: the main
  road's kakko, the master junction's piyo, the spine's two; one speaker per
  crossing, at the crossing), ドンペン堂's theme, the station, the level
  crossing's bells, the shrine's chimes.
- **The map.** A speaker is a small violet disc with a white speaker and
  two waves (violet: clear of every place colour and of the yellow
  diamond). On a place's icon a diamond sits top right and a speaker top
  left, so the station wears both (its sound, and the train's spot). The
  key moved to its own chip bottom right, "Things to do / Things to hear":
  one long foot chip covered the Deer Park's icon.
- **Removed:** the shrine's prayer (kit/shrine/prayer.js, SHRINE_PRAYER, the
  bell's swing, the shrine-bell and shrine-clap cuts and
  scripts/make-shrine-sounds.mjs; the coins cut, only the prayer used it),
  ドンペン堂's E, dance and confetti (the mascot keeps its idle rock), the
  station's E. The generated shrine-*.wav files are still in
  assets/audio (not in git); they can be deleted by hand.

## The train and the station (Tan's second note)
- **Nobody boards.** line/boarding.js is gone (the open platform edge, the
  car colliders, the step-off veil, the door-closing subtitles, emu.js
  carColliders). Platform 1's edge is solid like platform 2's. The spot by
  the door nearest the gates keeps its ring: stepping into it plays
  train-nextstop there (config SOUND.trainListen, 4 to 14 m), once each
  time you step in, no E, no text. It plays whether a train stands there
  or not, so nobody waits at a silent ring; the map keeps its diamond (you
  go there to do something: stand in it).
- **The station's announcements outside.** A zone may now have a loud
  `core` and a mild `edge` (core/sound.js, three lines): station-ambience is
  full within 8 to 20 m (concourse, gates, platforms), then about a third
  over the plaza and the approach, gone by 42 m (config SOUND.station).
  The check measures 0.45 in the concourse, 0.15 in the plaza.
- **No station master.** line/master.js, his whistle (sfx.js), his badge
  strings and the `station-master` shot spot are gone (a `train-listen`
  spot instead). People: the player's hand and Han, and the animals.
