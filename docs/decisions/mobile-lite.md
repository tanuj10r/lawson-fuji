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
  the key art (`./keyart-1280.webp`, `-1920` by srcset) are the same files the desktop uses: no second copy of the
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

## After Tan's iPhones (2026-09-30, second round)
Tan saw: Chrome for iOS (dev build) lost the GPU context ("The town was
put away"), and the production build didn't load in it; Safari on an
iPhone 15 played but looked "a little pixelated"; the paw, map and sun
needed several taps.
- **?diag** (src/mobile/diag.js): the context is made by us and its
  allocating calls wrapped, so every texture, buffer and renderbuffer byte
  is counted (an estimate: drivers pad). The panel shows the stage reached
  (with the JS heap at each stage on Chrome), renderer.info, the GPU
  estimate and peak, heap, DPR and canvas; it sits over the lost card, and
  the last reading is kept in localStorage (stages are written while the
  town builds too), so a load that dies says where on the next ?diag load.
- **Tiers.** light: any iOS browser that isn't Safari (Chrome, Firefox,
  Edge and the in-app ones social links open in), iPhones below the 14 Pro/
  15 screen (the 4 GB ones), Android web views and <= 4 GB, and any device
  that has lost the context here before (remembered). Textures 512 (konbini
  1024), no shadow map, 85 m, canvas at DPR 1 drawn inside at up to 0.7 Mpx.
  full: everything else; renders up to 2x / 2.5 Mpx, stepping down when
  frames run long. `?tier=light|full` overrides.
- **Streaming by distance** (both tiers): batches, moving things (trains,
  Han, the car) and the konbini's goods give their GPU copy back past
  far + stream (and the goods past 45 m from the store) and upload again as
  you come near. The CPU copies are kept for this, which is also what lets
  a restored context (webglcontextrestored) upload everything again and
  carry on: tested with WEBGL_lose_context. What's cut is GPU residency, not
  the build: the town is still built whole at load (its builders are
  monolithic; building per place would mean rewriting them), but its
  painted pages are shrunk as each part is built (the konbini, then the
  town before the atlas packs them), so the desktop-sized pages never all
  exist at once.
- **Programs**: core/toon.js keys every toon program by its shadow tint,
  which is a uniform: sharing one program per style cut 326 to 151 and the
  compile from 3.0 s to 0.2 s. Static batches' normals, colours and tints
  packed (48 -> 27 bytes a vertex).
- **Buttons** act on the finger's lift (pointerup, captured, a pressed
  state, a wider hit area): iOS sends no click for a tap made while another
  finger holds the stick or drags.

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

## The pocket edition (Tan, 2026-09-30, after the iPhone 15 looked "extremely subpar")
The town smaller, what is left at full, desktop quality ("very crisp").
- **Kept, at desktop quality:** the famous view (NIPPON, Fuji, the car
  park), Hachi and his tour, Han's RX-7 show, the zebras and their walk
  signals, the level crossing and the station (plain local trains), the
  shrine and torii, the slow-life bench, ドンペン堂, the sakura round the
  famous view, the lots round the konbini and the zebras. Every place is
  still built, so Hachi's tour and every sound and place cue are the
  desktop's, unmoved (no sound needed a new home).
- **Cut:** the residential filler and the other shops (every lot outside
  `MOBILE.pocket.keep`, and the few inside it in `pocket.cut`, is a kitchen
  garden behind a block wall, flat toon colours, no texture: mobile/core.js);
  the Pokémon train (its 4096 x 1024 wrap); every other parked bicycle,
  crate, cone and capsule bank beyond 40 m of the famous views
  (`pocket.clutter`). Kept shops: five (the zebra corner's, the east
  zebra's two, one behind the store's west corner, the one by the car park);
  the two past the east corner stay because the famous view sees their walls
  over the store's shoulder (checked frame by frame against the uncut town).
- **Textures at the desktop's own sizes**, then each at the size it is seen:
  - The konbini (konbini.js): scripts/_mobile-seen.mjs plays the five
    visits, the famous views, the forecourt and the approach, and renders
    the store in id colours from every pose: the most each label, price tag
    and painted quad is ever drawn at, per kind of pose. The GPU holds one
    **level** at a time, packed from a CPU-only master: the visit playing
    (what it hands you at the whole 192 cell), `near` (outside within 15 m
    of the middle) or `far`. Each level has its own layout; the stock's,
    the tags' and the quads' uvs are rewritten from the master's on a change.
    Before (one scaled copy per distance): 84 MB in the store, 21 at the
    door, 9 at the famous view; now 58, 26, 8 (labels + tags + signs and
    posters), and sharper at the glass and from the famous view (the half
    and quarter copies were below what those poses showed for dozens of
    labels and most of the signs).
  - From inside the konbini, every town page is at most a half
    (texLod.store): the town is seen through the glass, metres off, while
    the visit walks you to a shelf (-48 MB in the store).
  - The painted weather (kit/paint.js wearAtlas, soft grime on every wall):
    1024 instead of 2048 (-16 MB everywhere). Side by side on a wall at 4 m
    the two can't be told apart.
- **Vertices in 16 bits**: the static batches', the trees' trunks' and the
  konbini's stock positions over each mesh's own box (the box's middle and
  size moved into the mesh's transform: 1 mm over a 64 m cell); the stock's
  uvs too. A unit taken off the shelf rewrites its float copy, carried into
  the 16-bit one. -15 to -20 MB of buffers near the store.
- **Streaming**: into the store, the town behind the walls streams out in the
  same frame the visit's pages come (they came a frame early: a 352 MB spike);
  out again eating, the near level with the product in hand whole; at load
  and on any jump (the start again, a famous view) at once, so a new place's
  pages never land on top of the old ones (the load peak fell 286 -> 217).
- **A bug found on the way:** the far tree lines (groveCanopyFar, instanced,
  under 40 m across) were culled as small props at 36 m, so from anywhere
  in the town they stood as bare trunks. They are drawn to the draw distance
  now. Tan's brief said to cut them for a painted backdrop: a flat silhouette
  mass and a coarse flat-colour version were both tried and both read worse
  (slabs from along a line; faceted lollipops); the far groves are one
  shared 512 texture and a few draws, so they stay as the desktop draws them.
- **Tiers.** full (Safari on the 6 GB iPhones): render 2x, draw 100 m.
  light (Chrome and the in-app browsers on iOS, the 4 GB phones): the same
  textures at the sizes its pixels need, render 1.35x (from 1.5), draw 56 m
  (fog 18-52), shadow map 1024: far detail and pixels go before any texture
  near you blurs.
- KTX2/Basis for the konbini's pages: not shipped. The label pages are
  painted at load from code (AGENTS.md: visuals built in code), so a
  compressed page would mean either a transcoder in the bundle (~200 KB of
  wasm) and encoding at runtime (seconds on a phone), or shipping baked
  images (against the rule). With the levels the store's pages are 51 MB at
  their largest; UASTC would make that ~13 MB but blur the small text of
  labels, ETC1S far worse.
