# Mobile lite (the pocket edition)

Tan, 2026-09-30: "Spin up a light version of the whole game, suitable for
mobile ... Remove any part of the game that is overkill ... Don't compromise
on the sound ... Don't disturb or change the desktop build."  AGENTS.md's
"desktop only" rule is lifted for this separate build only.

## Shape
- **A second page, a second build.** `m.html` + `src/mobile/*`, built by
  `vite build --mode mobile` into `dist/m.html` and `dist/m/assets/`
  (`npm run build` runs both passes). A separate pass rather than a second
  Rollup input: a shared input would have split the desktop bundle into
  shared chunks. Checked: `dist/assets/main-CSJqjHw2.js` and every other
  desktop asset are byte-identical to `main` (31ef8db); `npm run size`
  unchanged (4.82 MB, 1.51 MB before the first click).
- The page sits beside index.html (not in `m/`), so `./audio/` and
  `./keyart.webp` are the same files the desktop uses: no second copy of the
  sound, and sound.js's `BASE_URL + 'audio/'` needs no change.
- **Routing:** `config.js MOBILE.route` (false). index.html's head script
  already tells phones apart; with the switch on it sends them to `m.html`
  (vite writes `%S:mobile.route%` into the page). Off, today's card.
- **Shared files:** only additive and tree-shaken: `MOBILE` in config.js,
  `MOBILE_STRINGS` in strings.js, the route snippet in index.html, the build
  mode in vite.config.js, two npm scripts, a `_headers` block. No shared
  module's code changed; everything else is done from `src/mobile/`
  (subclassing the player, wrapping `<audio>`, config set before the build).
- `src/mobile/town.js` is world/town.js with three LITE changes (marked).
  Keep it in step when the town changes; `src/mobile/main.js` likewise
  mirrors src/main.js (hero views, time, Han's watch, Hachi's hello, the
  konbini, the view spot, tipsy) without the dev tools.

## What's in, what's cut
- **In, all of it:** the whole town and layout (Hachi's tour needs the
  whole town: the station and the crossing are 140 m from the konbini), the
  famous view at golden hour, Hachi, the konbini's scene, Han's RX-7 show,
  the trains and level crossing, walk signals, shrine, bench, pond, river,
  Deer Park gate, the map, three times of day, animals, petals.
- **Sound: untouched.** Same engine (core/sound.js), same files, same local
  places and mix. Around it (src/mobile/audio.js): the context is made in the
  start tap; `navigator.audioSession.type = 'playback'` before it (iPhone's
  silent switch); the engine's streamed `<audio>` (title song, store music)
  are made after an await, outside the gesture, so every later tap retries
  any that iOS refused and unlocks the rest; `touchend`/`click` resume the
  context after a call or the lock screen, and if the phone won't resume on
  return a "Tap to bring the sound back" pill asks. The trains already share
  the one context (QA-007).
- **Cut or lightened (lite.js):**
  - Mirrors (pond, river, paddies) off: each redrew the scene. The painted
    water under them (the desktop's own distance fallback) always shows.
  - Inverted-hull outlines (134) removed: the ink pass still draws every line.
  - No FXAA pass; ink + grade kept (they are the look). Internal size capped
    at 1.0 Mpx, supersampling up to 1.5x, stepping down to 0.85x when frames
    run under 26 fps and back up over 53.
  - Shadows: 1024 map over ±34 m (desktop 2048 over ±40), plain PCF,
    redrawn on a new 4 m square or every 2 s (desktop 4 Hz).
  - Draw distance 110 m, fog 30-105 m (desktop fog 60-300): the far edge
    is never seen. Static batches in 128 m cells culled by box; anything that
    moves by its sphere; small instanced kinds and detail cells at 36 m. The
    culler wraps `visible` so the game's own show/hide still works.
  - Petals 70 in the air, 110 from the trees (desktop 150 + 250); Hachi keeps
    3 distance fields (6).
  - Fuji at half its elevation grid (209 K -> 52 K triangles, same vertices).
  - Textures redrawn smaller before upload: 1024 px for the town, 2048 for
    the konbini (its labels are read up close); big static canvases and the
    static batches' vertex arrays freed once on the GPU.
  - The konbini's ~55 painted quads packed onto one 2048 page (one draw).
  - Batch shadow flags normalised (a basic material shows no shadow; a toon
    one receives): fewer batches per cell.
- **A leak found on the way:** `mergeStatic`'s returned `cullDetail` closure
  keeps its whole scope alive, including every mesh it merged away (~90 MB
  of geometry). The lite build drops `world.batching`; the desktop has the
  same leak (worth fixing there too: see the report).

## Controls
- Left 40% of the screen (lower 75%): a joystick where the thumb lands;
  the push is the pace, past 92% it runs. Anywhere else: drag to look
  (0.0052 rad/px). Mouse drag and WASD/arrows/E/F/M/R/N/1-3/Space also work,
  so the page can be tried on a computer.
- Buttons: paw (whistle), time of day (cycles golden -> night -> morning),
  map (tap it to close), pause. The hand appears bottom right only when
  something is there to do, with its name; a thumb aims loosely, so with
  nothing under the crosshair the nearest thing within 2.8 m and 34° ahead
  (or whose ring you stand in) counts.
- The konbini's choice: chips on its spot, tap one.
- Portrait works: the lens widens to keep ~42° across (vfov up to 80°), and a
  toast suggests turning the phone; landscape is the intended view.
- No pinch, double-tap zoom, scroll, selection or callouts; safe areas
  respected; hidden page pauses the game and the sound.

## Cards
- m.html paints the desktop card's look (art, name, sakura rule) at once as
  the loading card; when the town is built, compiled and drawn once, it
  becomes the start card: "Tap to start" starts the town and its sound in the
  same tap. The pause card: volume (the five steps), Resume, Back to the
  start, what does what, credits. No WebGL 2 or a lost context: a card
  (context loss is how phones take memory back: "Reload to walk on").
- Phones that report little memory (`deviceMemory <= 3`, Android) draw
  90 m, textures 512/1024.

## Judgement calls
- Draw calls: the target was ~250. Measured 434 at the famous view, 375 in
  the konbini, 172-386 elsewhere. The rest is the town's material variety per
  128 m cell (each style and texture a batch); going below would mean
  re-authoring the batching (untextured far LODs) or cutting the town. At 4x
  CPU throttling the frame's CPU side still ran well over 60 fps in
  emulation, so the calls were left there; real-device numbers decide.
- Triangles in view ~1.0-2.1 M (target 0.8 M): the konbini's stock (520 K,
  drawn through the glass at the famous view) and the town batches. Kept:
  an empty-shelved store would break the famous view.
- Load: ~3.6 s of town building at 1x on the M2 (15 s at 4x CPU). The card
  shows from 0.35 s; the bar's glint runs on the compositor while it builds.
- Portrait kept playable rather than blocked (people open links upright).
