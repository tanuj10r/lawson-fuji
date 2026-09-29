# Take Me Back to Japan on phones: feasibility study

Study date 2026-09-29/30. Branch `qa/mobile-feasibility`, from `da0342b`. Nothing in
the game was changed: every measurement drives the production build (`dist/`)
from outside. The tooling is in `qa/mobile/` and the screenshots and raw
numbers are in `qa/mobile/artifacts/`. Appendix A says how to rerun it.

---

## 1. Verdict: **Feasible with major work, for recent phones only. Not recommended for launch.**

1. **Today the game does not work on any phone.** The start card is wider than the
   screen, so Start is off-screen. Tapping the card fires Start and can start the sound,
   but the game waits for pointer lock, which phones don't have. The card never goes away.
   Even if it did, there are no touch controls.
2. **The town is built for a desktop GPU.** The busiest views issue ~900 draw calls,
   3.5-4.3 M triangles, and roughly 400 MB of runtime-painted textures, on a JS heap of
   ~400 MB. Even the best phones would be at or near their memory limits, and mid-range
   phones would manage about 30-35 fps at best in the busiest views before heat
   throttling (projected; section 3.3).
3. **Loading is long and blank.** The first frame is 6 s on a quiet M2. At 4x CPU it
   is 18 s before any network time. The whole build runs as one blocked main thread
   with nothing on screen (no card, no progress).
4. **Sound, the heart of the game, is fragile on iPhone.** The silent switch mutes Web
   Audio. The audio unlock depends on a `pointerdown` that doesn't count as a gesture on
   touch screens, and the train sounds use a second AudioContext created outside any gesture.
5. **Recommendation:** launch on desktop with a strong phone landing card, and build the
   phone-ready groundwork now (memory, loading, input and audio plumbing that also helps
   desktop). Then ship a recent-phones beta as a fast follow once Tan has measured it on
   real phones (Option B, section 5).

---

## 2. Audit findings (Phase 1)

### 2.1 Rendering stack

| Item | What the code does | Mobile impact |
| --- | --- | --- |
| Engine | three.js r180 (WebGL2 only; r163 dropped WebGL1), Vite 6, ES2022 with top-level await | WebGL2 needs iOS 15+ or a current Android Chrome; fine |
| Renderer | `antialias: false`, `powerPreference: 'high-performance'`, `stencil: false`, `setPixelRatio(1)` (main.js:37-49) | The canvas is drawn at CSS pixels, so on a DPR-3 phone the final image is upscaled 3x: soft, but cheap |
| Internal resolution | post.js `setSize`: scale is 1.5 when DPR < 1.5, else min(DPR, 2), capped at `pixelBudget` 4.6 Mpx. Every phone gets scale 2: iPhone 13 portrait renders 780x1328, Pixel 7 824x1678 | 2x supersampling on every phone (4x the pixels of scale 1) |
| Post-processing | 3 full-screen passes every frame: ink (5 depth taps), grade, FXAA (9 taps). The scene target is RGBA **half-float** plus a depth texture (post.js:214-238) | Needs `EXT_color_buffer_half_float`, present in both emulated engines (verify on Mali/Adreno). Extra full-screen passes are costly on tile-based mobile GPUs |
| Shadows | One `DirectionalLight` casts, `PCFSoftShadowMap`, 2048^2 over 80 x 80 m, snapped to a 4 m grid, redrawn on a new cell **and 4 times a second** for trains and doors (main.js:512-535) | The 4 Hz full shadow pass is a periodic spike: a whole extra scene draw every 15th frame at 60 fps |
| Lights | 3 directional (sun, fill, bounce) + 1 hemisphere; no point or spot lights; the night glow is emissive | Good for mobile: few lights, fixed count |
| Materials | `MeshToonMaterial` with a patched BRDF (toon.js); 597 materials, **163 shader programs**, compiled in the first render (no `compileAsync`) | One long blocking first frame. Shader compiles are slower on iOS (ANGLE on Metal) and Mali/Adreno drivers than on the M2 |
| Mirrors | three's `Reflector` on the pond (768^2), river and paddies (512^2): one full extra scene render each while within `near` (land/mirror.js) | One extra scene pass per visible mirror; the painted water fallback already exists |
| Day/night | Three fixed looks (config.js LOOKS), switched with a dip to dark; a gradient sky-dome shader; fog far 260-320 m | Cheap; nothing to change |
| Draw distance | Camera far 3200 m (for Fuji); only frustum culling. From the famous view the whole town in front of you is drawn at full detail | No distance culling or LOD |
| Texture upload | Every painted texture is a Canvas2D canvas that stays alive after upload (nothing frees `texture.image`) | A CPU/IOSurface copy of every texture stays resident: on iOS it counts against the tab |
| Context loss | No `webglcontextlost` / `restored` handler | Phones drop WebGL contexts under memory pressure or after backgrounding. The game would freeze with no message. Emulated WebKit lost its context twice in this study (engine probe) |

### 2.2 Asset weight

Download (`npm run size` on a fresh build: 4.87 MB in all, 1.53 MB before the first click):

| Asset | Raw | On the wire | When |
| --- | --- | --- | --- |
| JS bundle (game + three.js, one chunk) | 1.74 MB | 571 KB gzip (460 KB brotli) | first |
| Key art `keyart.webp` (1600x900) | 154 KB | 154 KB | first (preloaded) |
| Sign fonts `brush.woff2` 377 KB + `round.woff2` 176 KB (subset) | 553 KB | 553 KB | **after** the JS runs (core/fonts.js top-level await), before the town builds |
| Fuji elevation `fuji-dem.bin` | 288 KB | 288 KB (263 KB gzip / 208 KB brotli if the host compresses it) | during the build |
| index.html | 10 KB | 3.5 KB | first |
| **Before the first tap** | | **1.53 MB** | |
| Audio, 29 files | 3.34 MB | 3.34 MB | from the first tap; most files on demand near their place (up to ~775 KB in the first 4 s after the tap, measured) |

**Models: none are downloaded.** All geometry is built in JS at load: 1,059 geometries
and ~205 MB of vertex and index arrays. three.js keeps a CPU copy of each and the GPU
holds another. **Textures: none are downloaded.** 178 textures are painted with Canvas2D
at load, **~411 MB estimated on the GPU** (w x h x 4, x 4/3 for mips). **KTX2/Basis,
Draco and Meshopt don't apply:** they compress downloaded files, and this game downloads
none. The equivalent levers are the resolution the code paints at, what it keeps after
upload, and how much it builds.

Largest textures, measured in the running scene (`qa/mobile/census.mjs`):

| Texture (users) | Size | Est. GPU MB |
| --- | --- | --- |
| Town atlas page 1 (town, shrine boards, ema) | 4096 x 4096 | 85.3 |
| Store quads (interior walls, fixtures) | 2048 x 5472 | 57.0 |
| Store stock page 0 (product faces) | 3072 x 3072 | 48.0 |
| Store stock page 1 | 3072 x 3072 | 48.0 |
| Town atlas page 2 (trimmed; vending, station) | 4096 x 1488 | 31.0 |
| Street decals / parking paint | 2048 x 2048 | 21.3 |
| Train livery (Pokémon) | 4096 x 1024 | 21.3 |
| Megastore front | 2048 x 512 | 5.3 |
| Pond mirror target | 768 x 768 | 4.5 |
| Everything else (169 textures) | <= 1024 mostly | ~89 |
| **All 178** | | **~411** |

Render targets add ~20-30 MB at a phone's scale-2 size, plus 16 MB for the shadow map
and ~8 MB for the mirrors. The 4096 x 4096 atlas is exactly iOS WebKit's historical
per-canvas area ceiling (16.7 Mpx), so it needs checking on a device.

Audio: all AAC in `.m4a`, mono except the title song. `store-bgm` and `theme` are HE-AAC
(afinfo reports their half-rate core). 29 files, 712 s, 3.34 MB. The ten largest are
below; the full table is `qa/mobile/artifacts/audio-table.md`.

| File | Codec | Ch | kbps | s | KB | Played how |
|---|---|---|---|---|---|---|
| store-bgm | HE-AAC (22.05 kHz core) | 1 | 32 | 337.0 | 1370 | streamed `<audio>` |
| station-ambience | AAC 32 kHz | 1 | 40 | 61.4 | 309 | decoded |
| rural-flute | AAC 32 kHz | 1 | 39 | 57.5 | 289 | decoded |
| theme (title song) | HE-AAC (22.05 kHz core) | 2 | 49 | 45.0 | 276 | streamed `<audio>` |
| wind | AAC 32 kHz | 1 | 40 | 36.1 | 182 | decoded bed |
| night-insects | AAC 32 kHz | 1 | 36 | 33.8 | 156 | decoded bed |
| train-nextstop | AAC 44.1 kHz | 1 | 47 | 25.3 | 153 | decoded |
| han-drift | AAC 44.1 kHz | 1 | 56 | 17.7 | 131 | decoded |
| crows | AAC 32 kHz | 1 | 40 | 24.0 | 124 | decoded |
| donki-theme | AAC 44.1 kHz | 1 | 47 | 14.1 | 90 | decoded |

Audio compression is already right for phones. AAC/HE-AAC plays natively on iOS and
Android, and Opus would not help Safari. Long tracks stream and short ones decode
(~16 MB of PCM in all, DECISIONS M4 round 7).

### 2.3 Scene cost in the busiest views

Measured with the game's own `__shot` hook (dev server, headless Chrome on the M2).
"All" counts every pass including the shadow map; "main" leaves the shadow pass out.
The frame time is the M2's, with GPU work included.

| View | Draw calls all / main | Triangles all / main | M2 ms at a phone's size (1688x780) | M2 ms at 1440p |
| --- | --- | --- | --- | --- |
| Famous view (hero-1) | **903** / 769 | 3.51 M / 2.52 M | 10.1 | 10.0 |
| Shopping street (town-spine-north) | 291 / 200 | 3.50 M / 2.45 M | 4.5 | 7.0 |
| Inside the konbini (store-aisle) | **913** / 770 | **4.32 M** / 3.38 M | 11.1 | 10.3 |
| Paddies from the lane end (mirror; a known worst) | 382 / 241 | 3.01 M / 1.94 M | 5.0 | 7.8 |
| Platform, train in | 147 / 132 | 1.39 M / 0.97 M | 2.5 | 4.5 |

The whole scene has 1,153 meshes (1,066 visible), 199 instanced meshes holding 52,517
instances, 597 materials, 163 programs and 4 lights. The JS heap is 380-480 MB (dev and
production builds, varying with GC), against SPEC 11's "about 390 MB".

**What this means:** the famous view and the konbini take ~10 ms on the M2 at **both**
1440p and a phone's size. They are bound by draw calls and vertices, not pixels, so
lowering the resolution alone won't rescue a phone. The ~770 main-pass calls and 2.5-3.4 M
triangles have to come down. A common rule of thumb for WebGL on mid-range phones is
roughly 100-300 draw calls and under 1 M triangles for 30 fps.

### 2.4 Input: every control that assumes a desktop

| Control | Code | Touch equivalent needed |
| --- | --- | --- |
| Start / Resume: click the card or its button; Space | hud.js 205-213, main.js 540-546 | Tap (a tap anywhere on the card fires Start today) |
| Look: mouse under **pointer lock** (`movementX/Y`, 0.0022 rad/px) | player.js 60-89, `lock()` 186 | Drag on the right half of the screen. Pointer lock doesn't exist on iPhone Safari or Android Chrome (confirmed absent in emulated WebKit) |
| "Playing" state is `player.locked`, i.e. pointer lock is held | main.js (26 uses), player.js | A `playing` flag that touch can set without pointer lock |
| Move: arrow keys / WASD | player.js 220-225 | Virtual joystick (left thumb) |
| Run: Shift | player.js 216 | Joystick pushed to the rim |
| Interact: E on what the crosshair aims at (3 m raycast): Han's RX-7, the slow-life bench | player.js 107, 278-290; han/index.js 169; land/slowlife.js 267 | A contextual button, or tap the object |
| Konbini: stand on the spot, choose 1-5 | main.js 554-558, ui/hands.js | Tappable menu rows |
| Walk-in spots: the Nippon Fuji view, the train's listening spot | main.js `viewSpot`; line/station.js 639 | Nothing extra |
| Seated: the mouse looks, a walking key stands you up | player.js 72-80, 99-103 | Drag looks; the joystick stands you up |
| Time of day 1 2 3, back to start R, whistle F, map M (closed only by M), sound N, pause Space/Esc | main.js 560-589 | Buttons; the full map needs a close button |
| Volume: a 5-step range slider on the pause card | hud.js 57-62 | Works; thin native hit target |
| Dev keys live in production: C / Shift+C coordinates, O ink, G grade | hud.js 222-232, main.js 584-585 | Harmless on touch (unreachable) |
| Hover | Only `.menu-action:hover` styling. "hovered" in the code means crosshair aim, not the mouse | No hover-only function to replace |
| Audio start on the first `pointerdown`/`keydown` | main.js 200-201 | On touch, `pointerdown` is **not** a user-activation event (the HTML spec counts `pointerup`, `touchend`, `click`), so the AudioContext made there starts suspended and relies on the later `click` to resume it |

### 2.5 Audio

- **Library:** Web Audio API directly (core/sound.js). One AudioContext, a compressor,
  a code-made convolver reverb, and buses for outdoor (low-passed indoors), indoor and
  music. Placed sounds have near/far ranges and **HRTF** PannerNodes, with procedural
  recipes as the fallback. Long tracks (store music, title song) stream through
  `new Audio()` + `createMediaElementSource`.
- **A second AudioContext** for the trains (world/line/sfx.js) is made lazily when a train
  first comes in range, i.e. **outside any user gesture**.
- **Unlock sequence:** the first `pointerdown`/`keydown` calls `sound.start()`. That makes
  the context, `await`s the manifest fetch, then arms the `<audio>` elements and calls
  `play()` on the title song. Everything after the `await` runs outside the gesture.
- **Simultaneous sounds:** up to 8 measured (M4 round 7) while taking items fast, 1-2
  while walking, plus the ambience beds.
- **Flags for iOS Safari and in-app WebKit:**
  1. **Silent switch.** On iPhone, Web Audio follows the Ring/Silent switch, and here
     *everything*, including the streamed songs, goes through the AudioContext. Many
     people keep the switch on silent, so they would hear nothing. The documented way to
     play through the switch is to set `navigator.audioSession.type = 'playback'` before
     starting; the API is present in the emulated WebKit 26. The game doesn't do this today.
  2. **Title song `play()` after an `await`.** iOS may refuse it, and `theme.set` never
     retries. In emulated WebKit the song's `play()` was still pending 4 s after the tap
     in one run and never called in the other.
  3. **Unlock is timing-dependent.** In emulated WebKit, one tap left both contexts
     `running`. In a second run, the same tap left the only context `suspended` and no
     audio was fetched (section 3.1).
  4. **Train context made outside a gesture.** It stays `suspended` on iOS, and its
     `resume()` calls outside gestures do nothing, so trains would be silent until a
     later tap.
  5. **`interrupted` state** (a call, Siri, backgrounding). The code resumes on
     `visibilitychange` without a gesture, which iOS may refuse.
  6. **HRTF** panners cost CPU on low-end Android; `equalpower` is the cheap mode.

### 2.6 UI

| Element | Fixed sizes / assumptions | On a phone (screenshots in 3.5) |
| --- | --- | --- |
| Start / pause card (index.html `.menu`) | `min-width: 760px`; width from `100vh - 236px`; a 4-column list of key caps | In portrait it is 760 px wide on a 360-412 px screen: the title and Start are cut off. In landscape it is 576 px tall on a 342-390 px screen: Start is below the fold. **Start is off-screen in both orientations on every profile** |
| Loading | The card is built by JS **after** the whole town is built | A blank lavender page until the first frame: ~6 s on a quiet M2, ~21-40 s modelled for Android phones, 27-246 s measured under emulation on a loaded host (section 3.2) |
| Key caps everywhere (card, corner panel, Hachi's caption "press F", map "M to close", konbini "Press a number") | Keyboard vocabulary | Meaningless on touch |
| Corner panel `.controls` | 290 px max, 13 px text, bottom-left | In portrait it covers half the screen and overlaps the minimap and konbini menu |
| Konbini menu `.kmenu` | `width: 400px` | Wider than 360-393 px phones: prices and names cut; the rows are not tappable |
| Minimap | 196 px circle, bottom-right | Almost 60% of a landscape phone's height |
| Hachi's hello caption | 16-18 px, `max-width: min(560px, 86vw)`, at 36% from the bottom | Fits, but overlaps the konbini menu |
| Full map | Canvas fitted to 92vw x 92vh; closes only with M or Esc | No way to close it without a keyboard |
| Field of view | Fixed vertical FOV | In portrait the view is a narrow slit: **the famous view loses Fuji's peak off the side** (iphone13-play-famous-portrait.jpg). Landscape is required |
| Viewport and safe areas | `width=device-width, initial-scale=1`; no `viewport-fit=cover`; canvas `100vw x 100vh` | `100vh` is taller than the visible area when Safari's toolbar shows; no safe-area insets for notch or home bar |
| Gestures | No `touch-action`, `overscroll-behavior` or `user-select` rules | Pinch zoom, double-tap zoom, text selection and pull-to-refresh are all live over the game |
| Orientation / fullscreen | Nothing | No rotate prompt, no fullscreen; iPhone Safari has no element fullscreen at all (`requestFullscreen` is undefined in emulated WebKit) |

### 2.7 Upstream constraints (Sakura Crossing)

- Upstream (`de01898`, "initial public release") has **no mobile or touch support** to
  reuse: its player was already pointer lock + WASD and its HUD desktop-sized.
- Its technique is desktop-first by design: every sign painted with Canvas2D at runtime
  into big atlases, a supersampled half-float target with an ink pass, PCF soft shadows,
  and dense instanced detail. AGENTS.md makes that technique win ("Reuse src/core ... for
  all rendering"). A mobile tier means changing `src/core` (post.js, player.js, hud.js,
  textures.js).
- **Owner policy is the biggest constraint.** AGENTS.md says "Desktop only. No touch or
  mobile fallbacks. Never lower visual quality for weak devices." SPEC 1 says "No mobile
  or touch play, and nothing is compromised for them." Every mobile option below means
  changing those rules first. At minimum, a phone tier has to be allowed to look worse
  than the desktop one.

---

## 3. Emulated measurements (Phase 2)

### 3.0 Method, and what to trust

- **Tooling:** Playwright 1.63 device emulation (touch on, mobile viewport, DPR, UA).
  WebKit 26.6 for the iPhones and Chrome 154 (Metal) for the Androids, against the
  production build.
- **Network:** `qa/mobile/throttle-server.mjs`, one shared link using DevTools' own presets
  so both engines load the same way. **Fast 3G** is 1.44 Mbit/s with a 562.5 ms round trip;
  **4G** is 8.1 Mbit/s with 165 ms. Each new socket pays 2 extra round trips for TCP and TLS.
  Text is served gzip.
- **CPU:** Chrome's CDP throttling, 4x for the Pixel 7 and 6x for the low-end profile.
  **WebKit can't be CPU-throttled in Playwright**, so the iPhones ran at the host's speed.
  For reference, an A15/A16's single-core speed is close to the M2's; the phones' GPUs are not.
- **Phone API surface:** in the second load of each run, `requestPointerLock` was removed
  (the instrument does it, not the game) because it is absent on phones. Emulated WebKit
  already lacks it.
- **The game was started from outside** (`player.locked = true`, as touch controls would)
  to measure play, and held still at each view.
- **This Mac was not quiet.** Two other sessions ran headless Chrome throughout; load
  averages were 8-45 and swap was 9-11 GB of 10-13 GB. Every row below records the host's
  1-minute load. Timings under that load run 3-9x slower than the same code on a quiet host
  (compare the calibration rows). **Absolute frame rates and load times from emulation are
  not phone numbers.** They are worst-case, CPU-side evidence. Bytes, memory, draw calls,
  API behaviour and layout do not depend on host load, and those are the findings to rely on.

### 3.1 Does the game even start?

| Profile | Start button on screen? (portrait / landscape) | A tap on the card | Game starts? | Sound after the tap |
| --- | --- | --- | --- | --- |
| iPhone 13 (WebKit, 390x664 @3x) | No (x 594 in a 390 px screen) / No (y 374 in 342 px) | Fires Start; no pointer lock API | **No**, the card stays | Run 1: 2 contexts `suspended -> running`, song `play()` pending. Run 2: context stayed `suspended`, 1 KB of audio fetched |
| iPhone 15 (WebKit, 393x659 @3x) | No (x 594 in a 393 px screen) / No (y 374 in 343 px) | Fires Start; no pointer lock API | **No** | Both runs: 2 contexts `suspended -> running`; the song not playing 4 s later (not yet asked for in one run, pending in the other) |
| Pixel 7 (Chrome, 412x839 @2.625) | No (x 594 in 412 px) / No (y 383 in 360 px) | With the desktop engine's pointer lock: game starts. Without it (as on a phone): nothing | **No** on a real phone | Contexts `running`, title song playing (Chrome allows it after the tap) |
| Low-end Android (Moto G4 profile, 360x640 @3x, 6x CPU) | No (x 594 in 360 px) / No (y 383 in 360 px) | As the Pixel 7: starts only with the desktop engine's pointer lock | **No** | Contexts `running`; the title song playing in run 2 |

A real phone today shows the start card (after a long blank page), plays the title song
at best, and goes no further.

### 3.2 Load: time to the first interactive frame

"Card + first frame" is when the start card and the town behind it first paint. The card
is built inside the same blocked main-thread task as the town, so nothing shows before
this. "Fuji" is the first frame with the mountain in it. Before the first tap, every
profile downloaded 1,569 KB.

| Profile | Link | Host load | JS arrived (DCL) | Card + first frame | Fuji in frame | Longest main-thread block |
| --- | --- | --- | --- | --- | --- | --- |
| Pixel 7, 4x CPU | Fast 3G | 12-16 | 7.9 s | 141 s | 146 s | 103 s |
| Pixel 7, 4x CPU | 4G | 16 | 2.3 s | 170 s | 172 s | 137 s |
| iPhone 13 (host CPU) | Fast 3G | 26 | 8.7 s | 49 s | 55 s | (no long-task API in WebKit) |
| iPhone 13 (host CPU) | 4G | 26 | 2.3 s | 44 s | 45 s | |
| iPhone 15 (host CPU) | Fast 3G | 13 | 7.0 s | 27 s | 28 s | |
| iPhone 15 (host CPU) | 4G | 17 | 1.9 s | 54 s | 55 s | |
| Low-end, 6x CPU | Fast 3G | 11 | 8.1 s | 246 s | 247 s | 209 s |
| Low-end, 6x CPU | 4G | 9 | 2.2 s | 189 s | 192 s | 139 s |

**Calibration** (no network throttle; the Pixel 7 rows at host load 3-4, the quietest
moment of the study):

| Profile | Card + first frame | Fuji | Longest block | JS heap |
| --- | --- | --- | --- | --- |
| Desktop 1280x720, 1x (load 8) | 7.3 s | 7.4 s | 4.8 s | 482 MB |
| Pixel 7 profile, 1x | 5.8 s | 6.1 s | 4.1 s | 384 MB |
| Pixel 7 profile, 4x | 18.0 s | 18.5 s | 13.9 s | 405 MB |
| *(for contrast)* Low-end profile, 6x, at host load 20 | 220 s | 226 s | 172 s | 377 MB |

**Model for a quiet phone** = network before the build + the build itself. The network
part is deterministic: DCL, then the fonts, which only start once the JS has run. That is
~11.5 s on Fast 3G and ~2.6 s on 4G. The build part is the calibration row.

| | Fast 3G | 4G |
| --- | --- | --- |
| Pixel 7 class (4x) | **~30 s** to the first frame, blank until then | **~21 s** |
| Low-end (6x, build scaled 1.5x from 4x) | **~38-40 s** | **~30 s** |
| iPhone 13/15 (CPU about the M2's) | **~18 s**, plus slower shader compiles and texture uploads on the phone's GPU | **~9 s** plus the same |

SPEC 11's target is "ready in about 4 s on desktop broadband". No phone profile gets near
that, and all of that time is a blank page.

### 3.3 Frame rate (emulated, contended host: directional only)

The live game loop's rAF rate, standing still at each view. Chrome's throttling slows only
the page's main thread; the M2's GPU still does the drawing. The WebKit runs are unthrottled.

Best / median of three 4-second windows (four for the scripted visit), landscape, standing
still. The **desktop reference** is the same game at 1280x720 on the same contended host,
measured the same way. On a quiet M2 it holds 60 fps (SPEC 11: 9.5 ms at 1440p), so it
shows how much the host itself was dragging every run down.

| View | Desktop reference 1280x720 | iPhone 13 (WebKit, host CPU) | iPhone 15 (WebKit, host CPU) | Pixel 7 (Chrome, 4x CPU) | Low-end (Chrome, 6x CPU) |
| --- | --- | --- | --- | --- | --- |
| Famous view | 38 / 30 | 25 / 19 | 47 / 33 | **8 / 4** | **4 / 4** |
| Shopping street | 58 / 57 | 31 / 27 | 49 / 40 | 11 / 10 | 2 / 1 |
| Inside the konbini | 39 / 39 | 11 / 8 | 41 / 39 | 13 / 1 | 3 / 3 |
| Paddies (mirror) | 54 / 50 | 11 / 8 | 55 / 40 | 31 / 26 | 11 / 4 |
| Platform, train in | 35 / 32 | 13 / 9 | 46 / 32 | 19 / 19 | 13 / 8 |
| Konbini scene (scripted) | 46 / 22 | 14 / 6 | 43 / 21 | 11 / 7 | 5 / 4 |
| Host load during the run | 10-39 | 22-31 | 15-31 | 11-15 | 9-34 |
| Internal render size | 1920x1080 | 1500x684 | 1468x686 | 1726x720 | 1280x720 |

How to read it:

- With the CPU slowed 4-6x, the Android profiles fall to 2-31 fps. The game's main-thread
  work per frame (world update, animals, trains, sound, and WebGL command submission for
  ~800 draws) doesn't fit a slower CPU. The famous view and the konbini are the worst, as
  the draw counts in 2.3 predict. 4x is pessimistic for a real Pixel 7, whose CPU is closer
  to ~2x slower than the M2's; 6x is about right for a low-end phone.
- The iPhone profiles aren't CPU-throttled and were drawn by the M2's GPU. They only show
  that WebKit can drive the game when both run at M2 speed. The two iPhone runs differ
  2-4x because of host load, not the profile.
- Earlier runs of `run-device.mjs` (same views, portrait, host load 12-45) are in
  `qa/mobile/artifacts/run-*.json` and agree in direction.

**Projection to real phone GPUs (estimates, not measurements).** These take the M2's
measured frame time at a phone's render size (section 2.3) and divide it by each GPU's
rough throughput relative to the M2, from public benchmark ratios (3DMark Wild Life
Extreme class, ±30%). Mobile browsers' per-draw-call CPU cost is higher than the M2's,
and phones throttle by 30-40% when warm, so read these as **best cases**:

| View (M2 ms) | iPhone 15, A16 (~0.45x) | iPhone 13 / Pixel 7 (~0.35x) | Low-end, Mali-G52 class (~0.05x) |
| --- | --- | --- | --- |
| Famous view (10.1) | ~22 ms, ~45 fps | ~29 ms, ~34 fps | ~200 ms, ~5 fps |
| Inside the konbini (11.1) | ~25 ms, ~40 fps | ~32 ms, ~31 fps | ~220 ms, ~4-5 fps |
| Shopping street (4.5) | ~10 ms, 60 fps | ~13 ms, 60 fps | ~90 ms, ~11 fps |
| Paddies, mirror (5.0) | ~11 ms, 60 fps | ~14 ms, 60 fps | ~100 ms, ~10 fps |

Below 20 fps the game also runs in **slow motion**. `dt` is capped at 1/20 s (main.js
`frame`), so the 45 s konbini visit took over 2 minutes in the slowest emulated runs.

### 3.4 Memory over five minutes

A tour of 15 places across the town, about 20 s each (the station, the crossing, the
shrine, the paddies with their mirror, the Deer Park gate, the konbini), sampled at each stop:

| Profile | Measure | Min | Max | Trend |
| --- | --- | --- | --- | --- |
| Pixel 7 (Chrome) | JS heap (`performance.memory`) | 389 MB | 408 MB | Flat: no leak, GC swings of ~20 MB |
| Low-end (Chrome, 6x) | JS heap | 387 MB | 404 MB | Flat. Rendering **stalled (0 frames)** for the last ~80 s of the tour with no error logged (host load 15-24); cause not determined |
| iPhone 13 (WebKit) | WebContent RSS (WebKit has no heap API) | 243 MB | 297 MB | Flat. **Undercounts**: on a swapping Mac, RSS leaves out swapped and compressed pages, and GPU memory isn't in RSS at all |

**Estimated phone footprint** = JS heap ~400 MB + GPU textures ~411 MB + geometry
~205 MB on the GPU + retained Canvas2D backing stores (up to ~300 MB, IOSurfaces on iOS)
+ render targets ~50 MB + decoded audio ~16 MB. That is **roughly 1.1-1.4 GB for one tab.**
iOS kills a tab's WebContent process when it passes a limit that scales with the phone's
RAM (4 GB phones like the iPhone 13 are the tight ones; in-app browsers share memory with
their host app). Low-end Android with 3-4 GB can't hold it. **Memory, not frame rate, is
the first wall**, and it must be verified on a device (section 6). The desktop target of
300 MB (AGENTS.md, SPEC 13 B) is also the prerequisite for any phone.

### 3.5 Screenshots

All are in `qa/mobile/artifacts/`, at CSS size. The Pixel 7's two portrait play shots
were taken before the tools held the player still, so Hachi's hello has turned the view
toward the pup (down to the asphalt, or at a wall). That is real first-minute behaviour,
not the view named.

| What | iPhone 13 | Pixel 7 | Low-end | iPhone 15 |
| --- | --- | --- | --- | --- |
| Start card, portrait (Start off-screen) | [iphone13-start-portrait](qa/mobile/artifacts/iphone13-start-portrait.jpg) | [pixel7-start-portrait](qa/mobile/artifacts/pixel7-start-portrait.jpg) | [lowend-start-portrait](qa/mobile/artifacts/lowend-start-portrait.jpg) | [iphone15-start-portrait](qa/mobile/artifacts/iphone15-start-portrait.jpg) |
| Start card, landscape (Start below the fold) | [iphone13-start-landscape](qa/mobile/artifacts/iphone13-start-landscape.jpg) | [pixel7-start-landscape](qa/mobile/artifacts/pixel7-start-landscape.jpg) | [lowend-start-landscape](qa/mobile/artifacts/lowend-start-landscape.jpg) | [iphone15-start-landscape](qa/mobile/artifacts/iphone15-start-landscape.jpg) |
| After tapping (phone API surface): still the card | [iphone13-after-tap-portrait](qa/mobile/artifacts/iphone13-after-tap-portrait.jpg) | [pixel7-after-tap-portrait](qa/mobile/artifacts/pixel7-after-tap-portrait.jpg) | [lowend-after-tap-portrait](qa/mobile/artifacts/lowend-after-tap-portrait.jpg) | [iphone15-after-tap-portrait](qa/mobile/artifacts/iphone15-after-tap-portrait.jpg) |
| Play, famous view, portrait (Fuji cut off; key panel) | [iphone13-play-famous-portrait](qa/mobile/artifacts/iphone13-play-famous-portrait.jpg) | [pixel7-play-famous-portrait](qa/mobile/artifacts/pixel7-play-famous-portrait.jpg) | [lowend-play-famous-portrait](qa/mobile/artifacts/lowend-play-famous-portrait.jpg) | [iphone15-play-famous-portrait](qa/mobile/artifacts/iphone15-play-famous-portrait.jpg) |
| Play, street, portrait (key panel over minimap) | [iphone13-play-street-portrait](qa/mobile/artifacts/iphone13-play-street-portrait.jpg) | [pixel7-play-street-portrait](qa/mobile/artifacts/pixel7-play-street-portrait.jpg) | [lowend-play-street-portrait](qa/mobile/artifacts/lowend-play-street-portrait.jpg) | [iphone15-play-street-portrait](qa/mobile/artifacts/iphone15-play-street-portrait.jpg) |
| Konbini menu, portrait (400 px card cut; overlaps) | [iphone13-konbini-menu-portrait](qa/mobile/artifacts/iphone13-konbini-menu-portrait.jpg) | [pixel7-konbini-menu-portrait](qa/mobile/artifacts/pixel7-konbini-menu-portrait.jpg) | [lowend-konbini-menu-portrait](qa/mobile/artifacts/lowend-konbini-menu-portrait.jpg) | [iphone15-konbini-menu-portrait](qa/mobile/artifacts/iphone15-konbini-menu-portrait.jpg) |
| Play, landscape, 20 s after the konbini scene began (iPhone 15: done, back on the street, key panel over half the screen; the others: still in the scene, because slow frames run it in slow motion) | [iphone13-play-street-landscape](qa/mobile/artifacts/iphone13-play-street-landscape.jpg) | [pixel7-play-street-landscape](qa/mobile/artifacts/pixel7-play-street-landscape.jpg) | [lowend-play-street-landscape](qa/mobile/artifacts/lowend-play-street-landscape.jpg) | [iphone15-play-street-landscape](qa/mobile/artifacts/iphone15-play-street-landscape.jpg) |
| Landscape at the frame-rate views (famous view: Fuji over the roof, as it should be) | [famous view](qa/mobile/artifacts/fps-iphone13-famous-view.jpg), [konbini](qa/mobile/artifacts/fps-iphone13-inside-the-konbini.jpg) | [famous view](qa/mobile/artifacts/fps-pixel7-famous-view.jpg), [konbini](qa/mobile/artifacts/fps-pixel7-inside-the-konbini.jpg) | [famous view](qa/mobile/artifacts/fps-lowend-famous-view.jpg), [konbini](qa/mobile/artifacts/fps-lowend-inside-the-konbini.jpg) | [famous view](qa/mobile/artifacts/fps-iphone15-famous-view.jpg), [konbini](qa/mobile/artifacts/fps-iphone15-inside-the-konbini.jpg) |

What the screenshots show beyond the tables: the game *looks right* on a phone once it
runs. The konbini in landscape (the hand, the self-checkout, the window onto the street)
is lovely at 750x342. What fails is everything around it: the card, the keys, the panels.

### 3.6 What emulation cannot tell us

- **GPU speed, thermals and battery:** every frame here was drawn by the M2's GPU.
- **Memory limits:** a Mac never kills a 1.3 GB tab; iOS and Android do.
- **Driver behaviour:** half-float render targets, 163 shader compiles, 4096 x 4096 canvases
  and textures, and context loss on Mali, Adreno and Apple mobile GPUs.
- **Real audio policy:** the ring/silent switch, AVAudioSession, `interrupted` states, and
  the gesture rules of in-app browsers. Playwright's engines do not model them faithfully.
- **Touch feel:** joystick size, look sensitivity, and accidental back-swipes.
- **Real networks:** radio wake-up, packet loss, and CDN distance.

---

## 4. What mobile support requires (Phase 3)

Effort: **S** is under a day, **M** 1-3 days, **L** 3+ days of Claude Code work with Tan's
review. Tan's own device testing is listed separately.

### 4.1 Touch controls: **L (4-6 days)**

| Work | Files | Effort |
| --- | --- | --- |
| A `playing` state separate from pointer lock. Today "playing" *is* `player.locked` (26 uses in main.js, plus player.js, hud.js, the minimap, the hands HUD, Han's watch, Hachi's hello). Phones never get pointer lock | main.js, core/player.js, core/hud.js, ui/minimap.js, ui/hands.js | M |
| An action table: every key (R, F, M, N, 1-3, 1-5, E, Space) calls a named action, so a button can call the same thing | main.js, core/player.js | S |
| Virtual joystick for the left thumb, analog (walking speed scales with the push; the rim runs), with a dead zone. It appears where the thumb lands in the left 40% of the screen | new ui/touch.js, core/player.js (analog input), config.js | M |
| Drag to look on the right side, with sensitivity in config (start near 0.005 rad/px, so a 60% screen-width swipe turns ~180°). The pitch clamp, `holdLook` and seated rules stay | ui/touch.js, core/player.js | S |
| Interact: a contextual button ("Sit", "Watch Han") when the crosshair's raycast hits something (the same `hovered` the E prompt uses) | ui/touch.js, main.js, core/hud.js | S |
| Konbini: tappable menu rows, 44 px tall | ui/hands.js, main.js | S |
| Buttons: pause, map (plus a close button on the full map), Hachi, time of day (a small sheet), back to start, sound | ui/touch.js, ui/minimap.js, data/strings.js | S |
| Browser gestures: `touch-action: none` and `overscroll-behavior: none` on the game; non-passive `touchmove` `preventDefault`; iOS `gesturestart`/`gesturechange` `preventDefault` (iOS ignores `user-scalable=no`); no controls within ~24 px of the left edge (iOS back swipe); `-webkit-user-select: none` and `-webkit-touch-callout: none` | index.html, ui/touch.js | S |
| Touch wording in the corner panel, prompt, Hachi's caption, map and konbini card | data/strings.js, ui/controls.js | S |

### 4.2 Performance: **L (10-18 days)**, the hard part

Proposed budget for the phone tier:

| Measure | Target on a mid-range phone (iPhone 13, Pixel 7) | Today at the famous view |
| --- | --- | --- |
| Frame rate | 30 fps sustained after 10 minutes in the busiest views | ~30-45 fps best case projected, before heat |
| Draw calls (all passes) | <= 250 | 903 |
| Triangles (all passes) | <= 0.8 M | 3.5 M |
| Internal render size | <= 1.0 Mpx (scale 1) | 1.0-1.4 Mpx (scale 2) |
| Textures on the GPU | <= 120 MB | ~411 MB |
| JS heap | <= 200 MB | 380-480 MB |
| Whole tab | <= 600 MB | ~1.1-1.4 GB estimated |
| Download before the first frame | <= 2 MB | 1.53 MB (fine) |
| Something on screen (card and progress) | <= 2 s on 4G | only at the first frame |
| First frame of the town | <= 10 s on 4G | ~21 s modelled (Pixel 7 class) |

| Work | Files | Effort |
| --- | --- | --- |
| Quality tiers (low / medium / high, where high is today) in config.js, picked once at load. Inputs: touch, screen size, `navigator.deviceMemory` (Android only), the WebGL renderer string (Android only: iOS reports "Apple GPU"), and a 1-second warm-up benchmark. A manual override on the pause card | config.js, main.js, core/hud.js | M |
| Adaptive resolution: step `pipeline.forceScale` 2 -> 1 -> 0.75 when frames run long, back up when they're short (post.js supports `forceScale` already) | main.js, core/post.js | S |
| Texture scale: every Canvas2D page takes a tier factor (0.5 on phones turns 4096^2's 85 MB into 21 MB). Signs are laid out in pixels in places, so each painter needs a legibility check | core/textures.js (4,340 lines), world/merge.js, world/lawson-tex.js, world/kit/tex.js, world/kit/megastore/tex.js, world/line/tex.js, world/store/labels.js, world/store/tex.js | M-L |
| Free what has been uploaded: drop each canvas after upload (keeping a repaint function for context restore) and free geometry CPU copies (SPEC 13 B asks for this already) | core/textures.js, world/merge.js, main.js | M |
| Shadows by tier: 1024 PCF, not soft, and no 4 Hz refresh on medium; no shadow map on low (the toon ramp carries the form) | main.js | S |
| Mirrors off below high (the painted water exists) | world/land/mirror.js, pond.js, paddies.js, channel.js | S |
| Post by tier: keep the ink pass (it *is* the look) at scale 1, and fold the grade into it to save a full-screen pass | core/post.js | S-M |
| Distance culling and LOD: per-district visibility ("a place loads when approached": AGENTS.md already asks for it), fog far 320 -> ~150 m on phones, fewer blossom clumps and instanced details, simpler distant trees, trains only near the railway | world/town.js, world/trees.js, world/details.js, world/streetprops.js, world/line/*, world/kit/* | L |
| The konbini interior (913 calls, 4.3 M triangles from inside): replace the town beyond the windows with a backdrop and merge the stock's 82 instanced draws per shelf run | world/store/*, world/lawson.js | M |
| Shader warm-up with `renderer.compileAsync` (parallel compile) behind the card | main.js | S |
| A 30 fps cap on phones (render every other rAF) for heat and battery | main.js | S |

Honest note: getting to 250 calls and 0.8 M triangles is a real rework of how the town is
drawn. Each step makes the town look simpler on phones than on desktop, which goes against
today's "never lower visual quality" rule and the 鏡池 fidelity bar. Without that work, only
top phones will hold a playable frame rate, and memory could still close the tab on them.

### 4.3 Loading: **M (2-3 days)**

| Work | Files | Effort |
| --- | --- | --- |
| The start card as static HTML in index.html (key art, title, a progress bar), visible before any JS runs | index.html, core/hud.js | S |
| Build in steps that yield to the browser, so the progress bar moves and the OS never sees a hung page; `<link rel=preload>` for the fonts and DEM so they download alongside the JS, not after it (saves ~3.6 s on Fast 3G) | main.js, world/town.js, core/fonts.js, world/fuji.js, index.html | M |
| Code-split the map, Han, the trains and the store's stock to load after the first frame (SPEC 13 B) | main.js, vite.config.js | M |
| Caching: long-lived immutable `/assets/*` (planned in SPEC 13) and brotli for the `.bin`. A service worker is optional, since repeat visits already hit the HTTP cache | public/_headers | S |

### 4.4 Audio: **M (2-3 days)**

| Work | Files | Effort |
| --- | --- | --- |
| Start everything inside one real gesture (`click`/`touchend`, not `pointerdown`): make the AudioContext, `resume()`, and `play()` the title song's element synchronously in that handler. Move the trains onto the main context (the `soundBus.graph()` hook its author asked for) | core/sound.js, main.js, world/line/sfx.js | S-M |
| iOS silent switch: `navigator.audioSession.type = 'playback'` before starting, plus a one-line note on iPhone ("No sound? Check the silent switch"), because the switch can't be read | core/sound.js, core/hud.js, data/strings.js | S |
| After an interruption (a call, Siri, the tab coming back): "Tap to bring the sound back" on the next touch; never `resume()` without a gesture | core/sound.js | S |
| Low tier: `equalpower` panners instead of HRTF, and a cap on simultaneous voices (e.g. 6). AAC/HE-AAC already fit | core/sound.js, config.js | S |

### 4.5 UI and layout: **M (3-4 days)**

| Work | Files | Effort |
| --- | --- | --- |
| A phone layout for the start/pause card: key art on top, a 48 px Start in the thumb zone, touch hints instead of key caps, no `min-width: 760px` | index.html, core/hud.js | M |
| Landscape only, with a "turn your phone sideways" card in portrait (the fixed vertical FOV makes portrait a slit that cuts off Fuji). `screen.orientation.lock` works only in fullscreen on Android and not at all on iPhone | index.html, core/hud.js | S |
| Safe areas: `viewport-fit=cover` and `env(safe-area-inset-*)` on every corner element; size from `visualViewport` / `100dvh` instead of `100vh` | index.html, main.js, ui/* | S |
| Tap targets of 44 px or more. Scale the corner panel, minimap (196 -> ~110 px) and konbini card to the screen | ui/controls.js, ui/minimap.js, ui/hands.js, world/animals/guide.js (caption) | S |
| Fullscreen: `requestFullscreen()` on Start in Android Chrome. iPhone can't do it; the only full-screen route there is "Add to Home Screen" with a manifest (`display: fullscreen`) | index.html, public/manifest.webmanifest, core/hud.js | S |

### 4.6 Browser coverage: **M (2 days of code; testing is extra)**

| Browser | WebGL | Audio | Other | Work |
| --- | --- | --- | --- | --- |
| iOS Safari (17-26) | WebGL2 via ANGLE on Metal. The tab is killed above a memory limit that scales with RAM; contexts are lost under memory pressure or long backgrounding | Silent switch mutes Web Audio unless `audioSession` is set; strict gesture rules; `interrupted` state | No pointer lock, no element fullscreen; `100vh` vs the toolbar; Low Power Mode caps rAF at 30 fps | Context-loss card, audio session, memory tier |
| Android Chrome | WebGL2 via ANGLE/GLES on Adreno/Mali; drivers vary most here. The renderer string is readable, which helps tiering | Looser after the first activation | Fullscreen and orientation lock available; `navigator.deviceMemory` | A tier table per GPU family |
| Instagram, Facebook (in-app) | iOS: the app's own WKWebView (WebKit's limits, plus the app's memory). Android: Android System WebView (Chromium) | Hosts usually require a gesture for all media; the silent-switch behaviour follows the host app's audio session (verify) | Extra toolbars shrink the viewport; no fullscreen; iOS links can't force Safari open | Detect the UA (`Instagram`, `FBAN`/`FBAV`) and show "Open in Safari/Chrome for sound and speed" with a copy-link button; Android can offer an `intent://` link to Chrome |
| X / Twitter | iOS: usually SFSafariViewController (Safari's engine). Android: usually Chrome Custom Tabs | As Safari / Chrome | Fine | Nothing extra |
| LinkedIn | iOS: in-app WKWebView. Android: WebView | As Instagram | As Instagram | As Instagram |

### 4.7 Device floor: **S-M (1-2 days)**

- **Recommended floor:** iPhone 12/13 class (A14-A15, 4 GB) and newer, where the 4 GB
  models must pass the memory check on a device. On Android, flagships and upper
  mid-range from 2021 on (Snapdragon 778G+/8-series, Tensor, Dimensity 8000+, 6 GB+).
  The iPhone 13 and Pixel 7 are the "medium tier" target.
- **Below the floor:** older iPhones, 3-4 GB Android with Mali-G52/G57-class GPUs, and any
  browser that fails the checks. Don't try to run the town there. Show the friendly card
  SPEC 13 A4 already plans: the key art, one line about the place, "Best on a computer",
  and **copy link / share to yourself** buttons (`navigator.share`). If Tan wants it, add a
  20-30 s loop of the famous view. That needs a rights check: a clip carrying 効果音ラボ
  sounds must not turn into a sound gallery, and the music tracks have open questions
  (SPEC 13 A5).
- **Routing to the card:** WebGL2 missing, `navigator.deviceMemory < 4` (Android), a
  failed warm-up benchmark, or a context loss before the first frame.

### 4.8 Totals

| Area | Effort | Days |
| --- | --- | --- |
| 4.1 Touch controls | L | 4-6 |
| 4.2 Performance and memory | L | 10-18 |
| 4.3 Loading | M | 2-3 |
| 4.4 Audio | M | 2-3 |
| 4.5 UI and layout | M | 3-4 |
| 4.6 Browser coverage | M | 2 |
| 4.7 Device floor and fallback card | S-M | 1-2 |
| Fix rounds after Tan's device tests | M-L | 3-5 |
| **Total** | | **27-43 days** (about 6-9 weeks of the build-and-review loop), plus Tan's device testing |

---

## 5. Options and recommendation (Phase 4)

### A. Full mobile support at launch

- **Effort:** everything in section 4, **27-43 days** before launch.
- **Player experience:** on recent phones, the whole town in landscape with a joystick and
  drag-to-look, at a lower tier (simpler distance, fewer details, no mirrors, lighter
  shadows) and ~30 fps. Older phones get the card.
- **Risks:** launch slips about two months. The phone tier visibly lowers quality, against
  the owner's own rule and fidelity bar. Memory limits on 4 GB iPhones and in-app browsers
  are unknown until tested on devices and could force deeper cuts. And there are two tiers
  to keep in step for every future change (Deer Park, Osaka).

### B. Desktop launch now, mobile as a fast follow (recommended)

- **Build now (5-8 days), none of it wasted:**
  1. The phone card (SPEC 13 A4) done well: key art, "Best on a computer", share / copy
     link, a hint to open in-app links in Safari or Chrome, and the WebGL2-missing and
     context-lost messages. (S-M)
  2. The static HTML start card with a progress bar, and fonts/DEM preloaded. This removes
     desktop's 5-7 s blank page too. (S-M)
  3. Memory toward 300 MB: free geometry CPU copies and canvases after upload, trains only
     near the railway. SPEC 13 B wants this anyway, and every phone needs it. (M)
  4. `playing` decoupled from pointer lock, plus the action table. No desktop change. (M)
  5. Audio unlock inside the click, the train context joined to the main graph, and
     `audioSession` set. This also hardens Safari on macOS. (S-M)
  6. Tier plumbing in config.js (a texture-scale factor, shadow/mirror/post switches),
     defaulting to today's quality, plus `compileAsync` warm-up. (S-M)
- **Fast follow (22-35 days after launch):** touch controls, the medium tier's culling
  and LOD, phone UI, and device QA on Tan's phones. Ship it as a "recent phones" beta
  behind the device checks.
- **Player experience at launch:** phone visitors from social links see a good-looking
  card instead of a broken one and can send the link to themselves. Desktop players get a
  faster, lighter game.
- **Risks:** most social-link visitors can't play for the first weeks, so the card has to
  do the converting (measure it with the planned server-side analytics). The fast follow
  could slip.

### C. Mobile lite mode beside the full desktop version

- **Scope:** a separate phone build of a small area: the famous view, the konbini scene,
  the shopping street to the station, and the level crossing. Low tier only; Hachi-guided,
  with tap-to-go and drag-to-look instead of a joystick.
- **Effort:** **18-28 days.** Simplified controls M (~3); a lite world assembly and low
  tier L (6-10); loading M (2); audio M (2-3); UI M (2-3); browser and floor M (2); QA M (2-3).
- **Player experience:** a short, guided, prettier-than-it-sounds postcard of the town
  that loads fast, but visibly less than the desktop game, and not the free walk.
- **Risks:** two products to maintain, drifting apart with every change. It still needs
  most of the memory and texture work: the konbini alone is ~150 MB of textures and 913
  draw calls. It is a lower-quality version by definition, the plainest conflict with
  today's rules. Effort is close to A's lower bound for less game.

### Recommendation

**B.** The game can't start on any phone today, and making the whole town run well there
is 6-9 weeks of work plus unknown memory limits that only real devices will reveal. Launch
on desktop with a phone card that converts visitors into "send me the link", and spend
5-8 days now on groundwork that desktop also needs (memory, loading, audio, input plumbing).
Then decide on the phone beta after Tan's own phones pass the memory and sound checks in
section 6. That keeps the 5 MB and fidelity promises and wastes nothing.

---

## 6. Must verify on a real device

Emulation can't answer these. The steps assume a build reachable from the phone over HTTPS:
a Cloudflare Pages preview of `dist/` (SPEC 13 A8) is best. For a quick local check,
`npx vite preview --host 0.0.0.0 --port 5181` on the Mac, then open `http://<mac-ip>:5181`
on the same Wi-Fi (plain HTTP hides `navigator.deviceMemory` and may change audio behaviour).

**Set up the inspectors once.** On the iPhone: Settings > Apps > Safari > Advanced > Web
Inspector on; plug it into the Mac; Mac Safari > Develop > [the iPhone] > the page. On
Android: Developer options > USB debugging on; plug it in; Mac Chrome > `chrome://inspect`
> inspect the page.

**The play snippet.** The game can't start on a phone yet, so paste this into the
inspector's console once the start card shows. It starts play from outside (as touch
controls would) and measures the frame rate at each busy view:

```js
(async () => {
  const s = __scene, P = s.player;
  P.locked = true; s.hud.setLocked(true);
  const fps = (sec = 10) => new Promise((ok) => { let n = 0; const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < sec * 1000) requestAnimationFrame(f); else ok(+(n / sec).toFixed(1)); };
    requestAnimationFrame(f); });
  const at = (x, z, yaw, pitch = 0) => { s.enterHero('morning'); P.pos.set(x, s.world.heightAt(x, z), z); P.yaw = yaw; P.pitch = pitch; P.suspended = true; };
  s.enterHero('morning'); P.suspended = true; await fps(3); console.log('famous view', await fps());
  at(-46.2, 23.5, 3.1416, 0.03); await fps(3); console.log('shopping street', await fps());
  at(-2.1, -3.0, 0, -0.12); await fps(3); console.log('inside the konbini', await fps());
  at(49, 45, -1.5708, -0.04); await fps(3); console.log('paddies (mirror)', await fps());
})();
```

Checklist (write down pass/fail and the numbers):

1. **Does it load, or does the tab die?** Close other tabs. Open the URL in Safari. Start a
   stopwatch and note (a) when the start card appears and (b) whether the page reloads or
   shows "A problem repeatedly occurred". Repeat 3 times. Then do the same in Chrome on Android.
2. **Memory.** iPhone: Web Inspector > Timelines > turn on Memory > reload > stop after the
   card shows > note the peak. Android: in the DevTools console run
   `performance.memory.usedJSHeapSize / 1e6` for the JS heap. For the whole browser, run
   `adb shell dumpsys meminfo | grep -i chrome` on the Mac and note the largest renderer
   (sandboxed_process) and the GPU process.
3. **Frame rate.** Run the play snippet in landscape. Note the four numbers. Also watch it:
   stutter every quarter second means the shadow refresh.
4. **Heat.** Leave it at the famous view for 10 minutes (snippet, then do nothing), then run
   the snippet again. Note the drop and whether the phone is hot.
5. **Sound with the silent switch ON (iPhone), in order:** reload; tap the card once. Does
   the title song play? Paste the snippet, then walk to the konbini's spot with
   `__scene.player.pos.set(-2.3, 0, 2.3)` and run
   `__scene.world.lawson.shop.play(__scene.world.lawson.shop.menu[0])`. Is the door chime
   heard? Then flip the switch OFF and repeat. Then reload, paste
   `navigator.audioSession.type = 'playback'` *before* the first tap, and repeat with the
   switch ON. Does sound now play?
6. **Trains.** After the tap, teleport to the platform
   (`__scene.player.pos.set(-49, 0, 155.2)`) and wait up to 2 minutes for a train. Are the
   motor and brakes heard, or only the bells and announcements? (The trains use their own
   AudioContext.)
7. **Interruptions.** During play: lock the phone for 30 s and unlock; switch to another
   app and back; trigger Siri. After each: is there sound, and is the picture there or
   black/frozen (context lost)?
8. **Looks.** In the famous view and the konbini, check that all signs are painted (not
   blank or black: the 4096 x 4096 canvas limit), shadows show, ink lines look right, and
   the screen isn't black (the half-float target).
9. **Layout.** Portrait and landscape: is Start reachable? Does the notch cover anything?
   Does Safari's toolbar hide the bottom? Does a pinch zoom the page?
10. **In-app browsers.** Send the link to yourself in an Instagram DM, a LinkedIn message
    and an X DM; open each from the phone. Repeat items 1, 5 (switch ON and OFF) and 9 in
    each.
11. **Low Power Mode (iPhone)** on: run the snippet; expect a cap near 30 fps.
12. **Record the phones:** model, iOS/Android version, RAM. Test one 4 GB iPhone (12/13/14)
    and one recent Android if possible; a 3-4 GB Android shows where the floor really is.

---

## Appendix A: tooling (qa/mobile/)

| File | What it does |
| --- | --- |
| `throttle-server.mjs` | Static server for `dist/` with one shared throttled link (Fast 3G, 4G, none), handshake round trips, and gzip text |
| `instrument.js` | Init script: watches AudioContexts, `<audio>.play()`, long tasks and load marks; removes `requestPointerLock` when asked. Changes nothing in the game |
| `run-device.mjs <iphone13\|iphone15\|pixel7\|lowend>` | The full run: Fast 3G and 4G loads, start card screenshots in both orientations, the tap test, views, the konbini visit, the 5-minute town tour. `--load-only <net>`, `--cpu N`, `--no-heap` |
| `fps-views.mjs <device\|desktop>` | Landscape frame rate at five views and in the konbini scene, best and median of 3 windows each |
| `census.mjs` | Textures, geometry, lights and draw calls at the busiest views (needs a dev server; `__shot` is dev-only) |
| `probe-engines.mjs` | What each emulated engine offers: WebGL2 extensions, pointer lock, fullscreen, audio session |
| `baseline.mjs` | Desktop load baseline, measured the same way |
| `audio-table.mjs` | The audio inventory (macOS `afinfo`) |

Rerun: `npm run build`, then `node qa/mobile/run-device.mjs pixel7` (one browser at a time;
each run starts and stops its own server on port 5181 and closes its browser on exit or
Ctrl+C). Raw results are in `qa/mobile/artifacts/*.json` and `log-*.txt`.
