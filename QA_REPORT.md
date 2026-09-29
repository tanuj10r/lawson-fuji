# Take Me Back to Japan: Launch QA Report

- **Build tested:** `main` at `4b4596e` ("Paused, everything stands still"), branch `qa/launch-readiness`.
- **When and where:** 2026-09-29/30, Apple M2 (8 GB) running macOS 26.6, Google Chrome 154 (Playwright 1.63, `channel: 'chrome'`, Metal), Playwright's Firefox 155 (build 1543) and WebKit 26.6 (build 2359). Scenarios 1-5 and 8-9 ran on the dev server (5180, `qa/vite.qa.config.mjs`). The browser matrix ran on a bundled build with the dev hooks (`NODE_ENV=development vite build --outDir dist-qa`). Load, perf and leak checks ran on the production build (`vite build` then `vite preview`, 5180).
- **How:** Phase 1 read the source. Phases 2 and 3 ran Playwright scenarios in `qa/`. Chrome runs clicked Start for real, so the pointer lock and the AudioContext are the browser's own, and they pressed real keys. Mouse look is a synthetic `mousemove`. Audio is checked with instruments rather than by ear: a spy on every AudioContext, buffer source, oscillator and `<audio>` play, plus an analyser tapped into each context's output. Artifacts are in `qa/artifacts/` (screenshots, `result.json` per scenario, `log.json` with every console line, page error and HTTP status, and a video of scenario 1, `01-first-visit-chromium-1280x720/first-visit-640.webm`).
- **Caveat on frame rates and timings:** other sessions ran browser test suites on the same 8 GB laptop throughout (load average 7-37, swap 11 of 13 GB). Frame rates and load times here are pessimistic and noisy; the production numbers in section 4 are the best available. Functional results (what works, what breaks) don't depend on the load.
- **Report only:** no game code was changed.

## 1. Verdict

**Not ready.** It becomes "ready with fixes" once the 2 Blockers and the 6 High issues are done. Most of those are small (S) code changes plus Tan's rights decisions.

1. **On a desktop, the game works.** In Chrome every experience plays start to finish: the konbini's five choices, Han's drive, the train's announcement, the bench, the view spot, Hachi's tour to its nap. Every sound is local and waits for the first click. A 23-minute session had no errors, no heap growth and no audio build-up. Collisions held across 90 simulated minutes of random walking.
2. **The link will mostly be opened on phones, and a phone gets a broken page** (QA-001, Blocker): a long blank load, a card wider than the screen, and a Start that cannot work (no pointer lock on iOS). SPEC 13's "best on a desktop" card doesn't exist yet.
3. **Rights are unresolved for a public site** (QA-002, Blocker): the Pokémon train, the film's song, the Don Quijote theme, the store music and the chime. The GSI source credit that the Fuji data legally needs is not in the game (QA-008, High).
4. **First impressions and failure states:** a blank page, with a blocked tab, until the town is built (QA-004), and nothing at all without WebGL or after a GPU reset (QA-003, QA-012). Social previews use a WebP image and there is no favicon (QA-005).
5. **Audio and gameplay fixes before launch:** the train announcement stacks (QA-006). The trains drone under the pause card (QA-007). Han's song runs out of step after a pause and starts late the first time (QA-013, QA-014). The bench's ring does nothing when stepped into (QA-009). The train's ring is missing most of the time (QA-010). Debug keys ship in production (QA-011).

## 2. Phase 1 inventory

Every item is ticked `[x]` only where a run verified it. `[~]` means read in code or seen in frames but not driven. Issue IDs refer to section 3.

### 2.1 Things to do (engagements: a glowing ring in town, a diamond on the map)

| # | Item | Where (world x, z) | How it starts | What should happen | Verified |
|---|---|---|---|---|---|
| I-1 | Nippon Mart konbini (store/shop.js) | ring at (-2.3, 2.3), r 1.2 | step onto the ring: the choice card; keys 1-5 | walk in (door opens, chime), take the item, self-checkout (scan beep, IC card, ka-ching), walk out (chime), eat outside; 22-31 s of game time; toast "Delicious..." | [x] works (all 5 items, 03 tests 10-12). Edges: QA-020 (stock runs out), QA-021 (keys shown) |
| I-2 | Strong Nine after-effect | after item 4 | automatic | 10 s blur + sway, toast, Hachi rolls and giggles | [x] works (03 test 11) |
| I-3 | Nippon Mart viewpoint (famous view) | ring at (0, 16.5), r 1.0 | step onto it | 1.3 s glide into the photo framing; minimap hides | [x] works (03 test 50) |
| I-4 | Han and the RX-7 (han/) | glow at (-21.7, 23.5), r 0.85 | step in, or E | song + drive + handbrake 180 + drift + park; view follows the car; player held | [x] works (03 test 20); its ring is reachable from 7 of 8 sides (the car blocks one). Edges: QA-013 (pause desync), QA-014 (song late) |
| I-5 | Train listening spot (line/station.js) | platform 1, by the door nearest the gates | step in while the train stands with doors open | next-stop announcement; station ambience ducks | [x] works; QA-006 (stacking), QA-010 (ring absent 77% of the time) |
| I-6 | Slow-life bench (land/slowlife.js) | ring by the bench, west of the paddies | E while looking at it from outside the ring | sit, mouse looks around, flute up, time slows; a walking key stands you up | [x] works from outside the ring; QA-009 (nothing happens standing in the ring) |

### 2.2 Things to hear (a speaker on the map; no ring, no key)

| # | Item | Trigger | Expected | Verified |
|---|---|---|---|---|
| S-1..S-4 | Walk signals at 4 zebras (walk0 main road = kakko; walk1-3 side streets = piyo) | its walk light green, you within 40 m | loop while green, twin crossings heard as one | [x] all 4 heard (03 test 61) |
| S-5 | ドンペン堂 theme (donki-theme zone) | within 30 m (per zone config) | loop, fades with distance, nothing beyond `far` | [x] (03 test 60) |
| S-6 | Station ambience and announcements (station-ambience zone) | concourse full, plaza at 75% edge, gone by 62 m; ducks in the train spot | loop | [x] (03 test 60) |
| S-7 | Level crossing bells (railway-bells) | crossing closed and you within 45 m | loop while closed | [x] (03 test 62) |
| S-8 | Shrine wind chimes (shrine-chimes zone) | within 26 m | loop | [x] (03 test 60) |
| S-9 | Rural flute at the bench (rural-flute zone) | within 22 m; louder seated | loop | [x] (03 tests 41, 60) |

### 2.3 Every sound (core/sound.js, core/soundBus.js, line/sfx.js; files in public/audio/manifest.json)

| Sound | File (KB) | Trigger | Kind | Spatial / range | Verified |
|---|---|---|---|---|---|
| Door chime | lawson-chime.m4a (38) | shop enter and exit | one-shot, indoor voice | yes, near 3 / far 22, heard through the glass at 0.4 | [x] twice per visit |
| Auto door | auto-door.m4a (13) | store door moves | one-shot | near 4 / far 18 | [x] |
| Store music | store-bgm.m4a (1,370, HE-AAC stream) | inside the store | streamed `<audio>` loop | non-spatial, indoor bus | [x] starts on entering |
| Store hum, cooler compressor | procedural | inside / near the drinks wall | oscillators | indoor bus | [x] (code) |
| Self-checkout scan / pay | kiosk-scan (10), kiosk-pay (17) | checkout timeline | one-shot | near 3 / far 14 | [x] |
| Ka-ching | ka-ching.m4a (10) | card taps the reader | one-shot | near 3 / far 14 | [x] |
| Eating | wrapper, bite, munch, gulp, can-open (5-7 each) | eating outside | one-shot at the listener | non-spatial | [x] |
| Take from shelf | procedural (plastic etc.) | the hand takes the item | one-shot | near 3 / far 10 | [x] |
| Fridge door | fridge-door.m4a (7) | the chu-hi's cooler door | one-shot | near 2.5 / far 9 | [x] (Strong Nine visit) |
| Walk signals | walk-kakko (15), walk-piyo (12) | zebra green | buffer loop | near 14 / far 40 | [x] |
| Crossing bells | railway-bells (23) | crossing closed | buffer loop | near 10 / far 45 | [x] |
| Train door chime | procedural (3 notes) | train `chime` event | one-shot | near 5 / far 28 | [~] code only |
| Train motor, rolling, brake squeal, air | procedural, its own AudioContext (line/sfx.js) | a train moving near | oscillators + noise | near 14 / far 80 | [x] runs; QA-007 (keeps playing under the pause card) |
| Station ambience | station-ambience (309) | zone | buffer loop | core 8/20, edge to 62 | [x] |
| Next-stop announcement | train-nextstop (153) | train spot, doors open | one-shot, follows you | near 4 / far 14 | [x] QA-006 |
| Han's song | han-drift (131) | Han's show | one-shot | near 6 / far 24 | [x] QA-013, QA-014 |
| Han's car door | procedural | door opens/shuts | one-shot | near 3 / far 22 | [~] code only |
| ドンペン堂 theme | donki-theme (90) | zone | buffer loop | per zone | [x] |
| Shrine chimes | shrine-chimes (76) | zone | buffer loop | near 6 / far 26 | [x] |
| Rural flute | rural-flute (289) | zone | buffer loop | near 5 / far 22 | [x] |
| Beds: wind always; birds (morning); night insects (night) | wind (182), birds (63), night-insects (156) | time of day | buffer loops, crossfaded | everywhere | [x] |
| Crows (golden hour) | crows (124), cut on the fly | every 9-20 s at golden hour | one-shot | 55-95 m off, high | [x] |
| Title song (start/pause cards) | theme.m4a (276, HE-AAC stereo stream) | a card is up, after the first gesture | streamed loop | non-spatial | [x] (media play events) |
| Hachi's voice (yip, boof, whine, hmm, pant, shake, snore, awoo, snort, giggle, sneeze) | procedural | the guide's moods | one-shot | near 3 / far per call | [x] yips, pants, giggles logged |
| Whistle | procedural | F | one-shot | near 4 / far 30 | [x] |
| Footsteps | procedural | every other head-bob swing | one-shot | at the listener | [x] |
| door-chime (11), ui-tap (5), stamp (6) | files | **never played** (fallback / dead) | - | - | QA-033 |

### 2.4 Animation and state

| Item | States | Verified |
|---|---|---|
| Time of day | three fixed looks on 1 2 3 (morning `day`, golden hour `golden` = start, night `blue`), 0.7 s dip to dark; no continuous cycle (by design) | [x] (09 visual, 03 test 72) |
| Store automatic door | opens only for the scene; lets anyone inside out | [x] |
| Cooler doors | swing open for the Strong Nine | [x] |
| Right hand | raise, reach, take, hold, card tap, eat (bites) | [x] frames |
| Self-checkout screen | idle, scan, item+total, pay, tap, paid | [x] frames |
| Han | lean, nod, stand, get in, seated, get out; head follows you within 8 m | [x] frames |
| RX-7 | parked, drive, handbrake 180, drift, smoke, park | [x] |
| Trains (3 liveries in rotation) | approach, braking, opening, dwell 60 s, chime, closing, hold, depart, idle | [x] |
| Level crossing | lamps + bells, arms down/up | [x] |
| Hachi | home, intro (hello + caption), ready, lead, atSpot, linger, wait, come, caught (greet), party (tipsy), hazard (Han's show), gate, nap; idles: zoomies, bow, roll, tail chase, sneeze, trip | [x] states seen in runs; the whole tour to the nap (04); F from 8 places (08); QA-016 (greeting out of view at the start's pitch) |
| Other animals | cat, pigeons (flush), koi (gather), turtles (flee), ducks, heron/egrets (flee, fly), butterflies; frozen beyond 60 m | [~] seen in frames; not individually exercised |
| Sakura petals, water mirrors, highlight ring/ripple/beam/motes | continuous | [x] frames |
| Pause | world time stops (dt 0), title song, 10 fps blurred draw | [x] (03 test 12); QA-007, QA-013 |

### 2.5 The map

| Item | Detail | Verified |
|---|---|---|
| Spawn | (0, 16.5), yaw 0, pitch 0.16 (the famous view, golden hour) | [x] |
| Walkable bounds | x -122..122, z -146.3..69.7 (world), clamped; town edge at the river's far walk and the Deer Park gate | [x] E3; QA-015 (east/west edges open onto empty ground) |
| Landmarks | NIPPON (0,-5), view spot, Han's bay (-24.2, 23), master junction (-30, 8), shopping street (x 50), ドンペン堂 (~56, -41), Inari shrine (~-13, -64), station plaza (~52, -110), station and platforms (~51, -125..-130), level crossing (80, -134), 鏡池 (-75, -100), slow-life bench (-73, -75), paddies, 桜川 river channel (z 34-62), 富士見橋 bridge road (x -30), Deer Park gate (-30, 68.3) | [x] all visited (09 visual) |
| Fuji view point | the famous view (hero guard spot) and the bench (faces Fuji) | [x] |
| Water | river channel walkable at its lower walks (y -2.4), water itself not walkable; 鏡池 not enterable | [x] E6 |

### 2.6 Controls and UI

| Item | Detail | Verified |
|---|---|---|
| Keys on the card | arrows (WASD unadvertised), Mouse, Shift run, E, 1 2 3, R, F, M, N, Space | [x] each pressed (01, 03) |
| Konbini choice | 1-5 while the card shows | [x] |
| Esc | releases the pointer (browser), pause card | [ ] not testable headless (manual check M-2) |
| Unadvertised keys | C coordinates readout, Shift+C copy, O ink off, G grade off (all in production); ` reference overlay (dev only); Tab swallowed | [x] QA-011 |
| Start card | key art, title, tagline, all keys, Start, credit line | [x] |
| Pause card | PAUSED chip, volume (5 steps, saved), Resume | [x] |
| Corner controls panel | only the keys that apply here; hidden on the famous view except Move and Time of day | [x] |
| Prompt pill | "E · Sit a while", "E · Han's RX-7" | [x] |
| Toasts | Sound on/off, Delicious..., Strong Nine, coordinates on/off | [x] |
| Hachi's caption | "Hi, I'm Hachi!" + follow / F line, 7 s | [x] |
| Minimap / full map (M) | diamonds for things to do, speakers for things to hear | [x] |
| Loading screen | none: a blank page until the town is built | [x] QA-004 |
| Settings | volume only (no sensitivity, invert, FOV) | [x] noted QA-024 |

## 3. Issues

### 3.1 Index

Severity counts: **35 issues: 2 Blocker, 6 High, 11 Medium, 10 Low, 6 Polish.** "Mobile" is Yes where the fix would change if (or when) a mobile version is built.

| ID | Title | Severity | Category | Effort | Mobile |
|---|---|---|---|---|---|
| QA-001 | A phone gets a broken page: a card cut off, a Start that does nothing, no "best on a desktop" card | Blocker | Launch / mobile | M | Yes |
| QA-002 | Rights review not done for a public site (Pokémon train, the film song, the Don Quijote theme, the store music, the chime, the Suno song) | Blocker | Licensing | M-L | No |
| QA-003 | No WebGL: a blank page and an uncaught error | High | Launch / errors | S | Yes |
| QA-004 | No loading screen: a blank page (and a frozen tab) until the whole town is built | High | Launch / first load | M | Yes |
| QA-005 | The share image is WebP only; no favicon or touch icon | High | Launch / social | S | Yes |
| QA-006 | The train's next-stop announcement stacks: each step into the ring starts another copy | High | Audio | S | No |
| QA-007 | The trains' sound runs on its own AudioContext: it drones on under the pause card, reads its volume from the debug global, and is outside the engine's mix | Medium | Audio | M | No |
| QA-008 | Credits: the GSI source credit the elevation data requires is not in the game; the MIT notice is not shipped | High | Licensing | S | No |
| QA-009 | The bench's ring does nothing when you step into it (E works only from outside), and Hachi counts it done anyway | Medium | Gameplay / UX | S | Yes |
| QA-010 | The train's ring is missing 77% of the time (up to 196 s) with no hint; Hachi waits there | Medium | Gameplay / UX | S | No |
| QA-011 | Debug keys and globals ship in production: C shows a coordinate readout, O and G turn off the ink and the grade, `window.__scene` | Medium | Launch / polish | S | No |
| QA-012 | GPU context lost: a white page, no message; after a restore the frame is washed out | High | Errors | S-M | Yes |
| QA-013 | Pause during Han's show: the car stops, the song plays on, so after resume they are out of step | Medium | Audio / gameplay | S | No |
| QA-014 | Han's song is never preloaded: the first show starts silent and the song comes in late | Medium | Audio | S | No |
| QA-015 | The town's east and west edges open onto an empty plain you can walk up to | Medium | World / visual | M | No |
| QA-016 | After F, Hachi's greeting happens under the bottom of the view at the start's upward pitch (0 of 18 greeting frames on screen) | Medium | Hachi / camera | S | No |
| QA-017 | Memory over the 300 MB budget | Medium | Performance | L | Yes |
| QA-018 | Hosting not prepared: no `_headers` (cache, CSP, `.m4a` type), no 404 page, no robots.txt | Medium | Launch / hosting | S | No |
| QA-019 | README is stale and a credit is wrong ("heat a bento, chat with the clerk"; the film song listed as Tan's recording; F missing) | Low | Docs / licensing | S | No |
| QA-020 | Konbini stock runs out silently within a session (8-16 per choice): the key then does nothing | Low | Gameplay | S | No |
| QA-021 | On the konbini ring the corner shows both "1–5 Choose" and "1 2 3 Time of day" | Low | UI | S | No |
| QA-022 | 1 2 3 pressed during the 0.7 s dip are dropped; the last key can be ignored | Low | UI | S | No |
| QA-023 | The start/pause card is 760 px minimum: cut off, with Start off-screen, in windows under 760 px | Low | UI | S | Yes |
| QA-024 | Accessibility and comfort: no volume on the start card, no reduced-motion for the Strong Nine sway, fixed mouse sensitivity and FOV, an aria-hidden focus warning | Low | Accessibility | M | Yes |
| QA-025 | The walker can end a few cm inside a collider after sliding into corners | Low | Collision | S | No |
| QA-026 | About 97 small props (pot plants, shrubs at house gates) have no collider: you walk through them | Low | Collision | S | No |
| QA-027 | Resume right after Esc can be refused silently (Chrome's pointer-lock cooldown) | Low | Input | S | No |
| QA-028 | Dead code in the store references missing strings (`S.handsFull`, `S.noMoney`) and would throw if reached | Polish | Code | S | No |
| QA-029 | Input nits: fast M presses drop one; numpad digits don't work for 1-5 or 1 2 3 | Polish | Input | S | No |
| QA-030 | Console noise: a three.js warning on every load; favicon 404 | Polish | Launch / polish | S | No |
| QA-031 | The C coordinate readout sits under the minimap | Polish | UI | S | No |
| QA-032 | Sakura Crossing's screenshots are still in `docs/` | Polish | Repo | S | No |
| QA-033 | Three audio files are fetched or shipped but never played (door-chime, ui-tap, stamp) | Polish | Download | S | No |
| QA-034 | Pigeons read as drones up close; a flushed one flies through the camera | Low | Visual / animals | S | No |
| QA-035 | Frame rate under 60 fps at 1080p in busy spots on an M2; up to 1,970 draw calls and 7.5 M triangles a frame | Medium | Performance | L | Yes |

### 3.2 Details

Each entry gives the repro, expected against actual, the evidence (under `qa/artifacts/`), the suspected cause with file:line, and a proposed fix.

**QA-001 · Blocker · A phone gets a broken page**
- *Repro:* open the site on a phone. Emulated here as an iPhone 13 (WebKit, 390x664, touch) and a Pixel 7 (Chrome, 412x839, touch): `node qa/05-chaos.mjs --only phone-iphone,phone-android`.
- *Expected:* SPEC 13 A4 ("needed for launch"): a friendly "best played on a desktop browser" card with the key art and the URL.
- *Actual:* the whole game downloads and builds first, then the card appears (22 s on the emulated iPhone, 17.8 s on the Pixel, both over localhost). The card is 760 px wide on a 390-412 px screen, cut off on the right, with Start off-screen (`05-chaos-phone-iphone/card.jpg`). A tap on Start fails. iOS has no Pointer Lock API (`requestPointerLock` is undefined), so even a reachable Start could never begin the game. The emulated Android page already holds 490 MB of JS heap (`performance.memory`, desktop Chrome emulating the phone) before Start, enough to crash an in-app browser on a mid-range phone. The owner expects most visitors to arrive this way, from X, Instagram and LinkedIn in-app browsers.
- *Cause:* no touch or small-screen check anywhere (`grep` finds no `pointer: coarse`, `maxTouchPoints` or `ontouchstart`). `index.html:131` sets `.menu { min-width: 760px }`. `src/core/player.js:188` depends on `requestPointerLock`. `index.html` loads `src/main.js`, which builds the whole town unconditionally.
- *Fix:* add an inline script in `index.html`, before the module script, that detects a touch-only device (`matchMedia('(pointer: coarse)')` and not `(any-pointer: fine)`, or no `requestPointerLock`) or a viewport under about 700 px. On such a device, show a static card (key art, title, "Best played on a desktop browser", the URL, a Copy link button) and never import `main.js`. The download is then about 160 KB instead of 5 MB. For desktop keep today's card, but let it shrink (see QA-023).

**QA-002 · Blocker · Rights review not done**
- *What:* SPEC 13 A5 lists the calls to make before the site is public; none is recorded as made. Section 6 gives the list and a risk for each. The highest are: the Pokémon train (Pikachu, Eevee, Piplup, Bulbasaur, the Poké Ball); `han-drift`, whose source file is `Han-tokyodrift-sixdays.mp3` (the film's "Six Days" by its name); the Don Quijote theme; the store music (permission not confirmed); the entrance chime (in copyright); the Suno song (depends on the plan it was made on).
- *Why it blocks:* every audio file is publicly downloadable from `/audio/`, and the Pokémon art is on screen at the station. Once the link is shared, a takedown or a cease-and-desist is a real possibility.
- *Fix:* Tan's calls, for each item: keep, replace (for the songs, commission or license a replacement; `npm run audio` takes a new file with no code change), or keep with a takedown contact on the site.

**QA-003 · High · No WebGL: a blank page**
- *Repro:* launch Chrome with `--disable-webgl --disable-webgl2 --disable-3d-apis` (`05-chaos --only nowebgl`).
- *Expected:* a clear message (SPEC 13 A4).
- *Actual:* a blank page and an uncaught `Error: Error creating WebGL context` at `main.js:37`. No card, no text (`05-chaos-nowebgl/no-webgl.jpg`).
- *Cause:* `src/main.js:37`, `new THREE.WebGLRenderer(...)` with no check and no try/catch.
- *Fix:* before importing three.js, test `document.createElement('canvas').getContext('webgl2')`. On failure, show a static card: "Your browser or GPU can't run this game (WebGL 2 is off). Try Chrome, Edge, Firefox or Safari on a computer." Also wrap the renderer creation in a try/catch that shows the same card.

**QA-004 · High · No loading screen**
- *Repro:* a cold load with the cache off (`07-prod --only load`).
- *Actual:* the production build over localhost with the cache off: a blank pale-blue page at 0.1 s (first paint), and nothing else until the card at 8.0 s. The card is the first contentful paint, at 7.8 s. With Chrome's Fast 4G profile and a 4x slower CPU (a budget laptop), the page stays blank for **42.7 s**; with Slow 4G, 36.0 s (`07-prod/result.json`, load-*). The main thread is blocked for most of that. A screenshot requested 2.5 s into a load could not be taken until the card was up (`01-first-visit-chromium-1280x720/00-loading-700ms.jpg` is the blank page). SPEC 11 says "about 4 s" (measured on a quiet M2); this laptop was under load, but the shape is the same: nothing, then everything. The main chunk is 1,782 KB minified (585 KB gzip), above SPEC's 1.2 MB figure and Vite's own 1,200 KB warning.
- *Cause:* `index.html` has only `<canvas id="view">`. The card is made by `createHud()` in `src/main.js:142`, which runs after the top-level await on fonts (`src/core/fonts.js`) and after `buildTown()` (`main.js:99`), a single long synchronous task.
- *Fix:* put a static card in `index.html` (the key art is already preloaded there, `index.html:23`): title, key art, a "Loading the town…" line or progress bar. Replace it when the game's card is ready. Yield to the browser between build phases (`await new Promise(requestAnimationFrame)` between town, land, animals and line) so the tab stays responsive and a progress bar can move.

**QA-005 · High · The share image is WebP only; no favicon**
- *Actual:* `og:image` and `twitter:image` point to `keyart.webp` (`index.html:17,22`). X renders WebP, but support elsewhere is uneven: LinkedIn, Facebook and Instagram link previews, WhatsApp, iMessage and older Slack clients may show no image. This is not verified here; M-6 lists the debuggers to check. There is no favicon (`/favicon.ico` 404 on every load, QA-030), no `apple-touch-icon`, no `twitter:description`, no `theme-color`.
- *Fix:* add a 1200x630 JPG (`keyart-share.jpg`, rendered by `scripts/keyart.mjs`), with `og:image:type`, width, height and `og:image:alt`. Add a favicon (an ICO or PNG of the NIPPON sign or Fuji) and a 180 px apple-touch-icon. Check with each platform's debugger after deploy (M-6).

**QA-006 · High · The next-stop announcement stacks**
- *Repro:* with a train standing at platform 1 with its doors open, step in and out of the listening ring six times, a second apart (`03 30-train-spot-stacking`).
- *Expected:* one announcement at a time.
- *Actual:* 7 plays, 6 audible at once (`sound.debug.voiceLevels()` > 0.05). Each copy is 25 s long, so a player nudging at the ring's edge gets a canon of overlapping announcements.
- *Cause:* `src/world/line/station.js:662-667`. `inside && !inSpot` fires `soundBus.oneShot('train-nextstop', ...)` on every entry, with no check that one is already playing.
- *Fix:* keep a handle or timestamp. Do not start again while the last one is still playing (25.3 s), or re-arm only after the train leaves (once per dwell).

**QA-007 · Medium · The trains' sound has its own AudioContext**
- *Actual:* `src/world/line/sfx.js:38` makes a second AudioContext for the motor, rolling, squeal and air sounds (the spy saw two contexts after every Start, `03 00-start`). That graph:
  - is not under the engine's `world` bus. When paused, the title song plays and the game should be silent (SPEC 5, DECISIONS "Paused, everything stands still"), but this context follows only the volume (`sfx.js:31` `host()`). Measured (`08-diag trainpause`): with a train pulling away beside the platform, the trains' context put out rms 0.0234 (the main context 0.0061). Paused, with the world frozen, the trains' context still put out rms 0.0055, a steady drone at the frozen speed, under the title song.
  - is not muffled inside the store (the engine's `outLow` doesn't reach it). There is no audible case today (the line is over 120 m from the store), but it is a trap for later.
  - reads its volume from `window.__scene.sound` (`sfx.js:32`), the global that QA-011 wants removed from production. Removing it silences the trains.
  - is created on a frame update, not on a click. In Playwright's headless WebKit and Firefox it did run (`06-browsers` trainCtx: "1:running"; Chrome and Firefox measured output rms 0.020-0.023). Real Safari is stricter about contexts started outside a gesture, so that needs a manual check (M-7).
- *Fix:* the file itself asks for this (`sfx.js` header: "HOOK WANTED: a soundBus.graph()"). Expose the engine's context and its outdoor bus through `soundBus`, build the train voices on it, and delete the second context.

**QA-008 · High · Credits and required attribution**
- *Actual:* the only credit in the game is "Built on Sakura Crossing (MIT)" on the card (`src/data/strings.js` `credit`).
  - The GSI elevation data needs a source credit (出典) wherever it is used. It is in the README, not on the site.
  - The MIT notices for Sakura Crossing and three.js must go with copies of the software. The site is such a copy, and `dist/` has no LICENSE or credits file. (`qa/10-dist.mjs`: the minified bundle keeps three.js's `@license` header; nothing else.)
  - The fonts (OFL), 効果音ラボ, the music sources and the disclaimer are also not in the game (SPEC 13 A6).
- *Fix:* add a Credits link on the start card, opening a small panel or `credits.html`: Sakura Crossing (MIT, with the notice), three.js (MIT), 出典：国土地理院 (標高タイルを加工して作成), the fonts (OFL), 効果音ラボ, each music source, the disclaimer, and a contact address for takedown requests. Copy LICENSE into `public/` so it ships.

**QA-009 · Medium · The bench's ring does nothing when you step into it**
- *Repro:* walk into the bench's glowing ring and look around; press E (`03 40-bench-step-in`).
- *Expected:* like the other rings (konbini, view, Han, train), stepping in does the thing, or at least the E prompt shows.
- *Actual:* no prompt in any of 8 directions, and E does nothing (`03-completionist/40-bench-in-ring.jpg`). From 2 m outside, looking at it, "E · Sit a while" shows and works (`03 41`). Hachi's tour marks the bench as done as soon as you stand in its ring (`src/world/animals/guide.js:1023`), so a player who follows the pup gets walked on without ever sitting.
- *Cause:* the E target is an invisible 2.2 x 1.0 x 2.2 m box around the ring (`src/world/experiences.js:113-118`, h = 1.0 for the bench, `src/world/land/slowlife.js:267-270`). From inside the box, eye height 1.6 m is above it, and a ray from inside a box meets only back faces, which are culled.
- *Fix:* make the bench a step-in spot like the others: sit when the player enters the ring (`interact: false`), with the E prompt as a fallback. Or pick the hitbox by distance to the ring rather than by ray. And have the guide count the bench done only when `used` is set.

**QA-010 · Medium · The train's ring is missing most of the time**
- *Actual:* the ring shows only while platform 1's train stands with its doors open: 23% of the service cycle, with gaps of up to 196 s (`03 31`, simulated over 20 minutes of service). Nothing says a train is coming. Hachi's tour stops at platform 1 and waits beside an empty spot (`guide.js`, atSpot), so a player can stand there for more than three minutes wondering what to do.
- *Cause:* `src/world/line/station.js:657-660` (by design, DECISIONS 2026-09-29). Trains alternate tracks, so platform 1 is served every other run, and each dwell is 60 s (`src/world/line/service.js:25-31`).
- *Fix:* show the ring dimmed with a label ("next train in 1:40"; the departure boards already know, `service.boardRows()`), or time Hachi's arrival to the next platform-1 dwell. Or shorten the headway while the player is on the platform.

**QA-011 · Medium · Debug keys and globals in production**
- *Repro:* in play, press C, O or G (`03 74-debug-keys-in-play`; `07-prod --only leak` for the build).
- *Actual:* C opens a monospace coordinate readout with a toast "coordinates on" in lower case (`03-completionist/74-C-coords.jpg`). O and G turn off the ink lines and the colour grade, and the town turns flat and washed-out, with no hint how to undo it (`05-chaos/mash-round0.jpg`: a player mashing keys left all three on). In the production build the globals `__THREE__`, `__scene` (renderer, scene, player, sound) and `__setOutlineRes` are there; C still opens the readout (`07-prod/leak/prod-C-coordinates.jpg`), and G still switches off the grade (`prod-G-grade-off.jpg`).
- *Cause:* `src/core/hud.js:223-231` (C), `src/main.js:584-585` (O, G), `src/main.js:718-722` (globals). None is behind `import.meta.env.DEV`.
- *Fix:* put all three keys and the globals behind `import.meta.env.DEV`. Pass the sound engine to `line/sfx.js` directly (QA-007).

**QA-012 · High · GPU context lost: a white page**
- *Repro:* in play, `renderer.getContext().getExtension('WEBGL_lose_context').loseContext()` (`05-chaos --only ctxlost`). A real driver reset, the GPU switching on a dual-GPU laptop, or waking from sleep does the same.
- *Actual:* the canvas goes white, the HUD floats over nothing, and there is no message (`05-chaos/ctx-lost.jpg`). After `restoreContext()` the frame comes back, but paler and washed-out compared with before (`05-chaos/ctx-restored.jpg` against `01-first-visit-chromium-1280x720/05-konbini-menu.jpg`).
- *Cause:* no `webglcontextlost` or `webglcontextrestored` handler anywhere in `src/`. Render targets, canvas textures and the shadow map are not rebuilt.
- *Fix:* on `webglcontextlost`, `preventDefault()`, stop the loop and show "The graphics card reset. Click to reload." On `webglcontextrestored`, reload the page. A full rebuild isn't worth it for a rare event.

**QA-013 · Medium · Pause during Han's show puts the song out of step**
- *Repro:* step into Han's glow, wait 3 s, pause 6 s, resume (`03 21-han-pause-desync`).
- *Actual:* the show's clock moved 0.13 s during the pause, and the audio clock moved 6.12 s. The song is a one-shot AudioBufferSource that keeps playing, silently under the pause card's duck, so after resume it is about 6 s ahead of the car. The drift no longer lands on the music. A pause over 17 s means the car finishes its drive with no song at all. The konbini's checkout recordings (up to 3.95 s) and the next-stop announcement (25 s) behave the same.
- *Cause:* `src/world/han/index.js:303`, a one-shot through `soundBus.oneShot`. The pause (`src/main.js:637-641`) sets the game's dt to 0 but leaves playing buffers running.
- *Fix:* suspend the whole AudioContext while paused and play the title song on its own context or `<audio>` element. Or give long one-shots a handle so pause can stop them and resume can restart them at the right offset.

**QA-014 · Medium · Han's song starts late on the first show**
- *Repro:* a fresh load, step into Han's glow (`03 23-han-song-latency`).
- *Actual:* 3.52 s from stepping into the glow until the song's buffer started, on localhost with nothing cached (`03 23`; `result-extra.json`). On a real connection, add the download. The car starts at once. The song is fetched (131 KB) and decoded only when the show starts, so the first seconds of the drive are silent. The log marks the play `file-late` (`03 20-han-show`).
- *Cause:* `han-drift` is never preloaded, while the konbini's sounds are (`src/world/store/shop.js:217-222`) and the train's announcement is warmed at 80 m (`station.js:648-651`).
- *Fix:* `soundBus.preload(['han-drift'])` when the player comes within about 40 m of the car. Also hold the show's start until the buffer is ready: the show "keeps the song's time", so start both together.

**QA-015 · Medium · The east and west edges open onto an empty plain**
- *Repro:* walk east or west past the last houses (for example along world z −38 to x ±122). `02 E3`: 49 of 54 samples along each of x = ±122 are standable right up to the invisible clamp.
- *Actual:* a flat, empty ground plane to the horizon, painted hills far off (`02-explorer/E3-edge-east.jpg`, `E3-edge-west.jpg`). The south edge (river bank) and the north edge (houses behind the railway) are closed.
- *Cause:* `TOWN.bounds` / `WORLD.bounds` (`src/config.js:239`, `358`) reach past the built blocks on the east and west. The player is clamped by `src/core/player.js` (bounds), not by anything visible.
- *Fix:* add a fence, hedge or row of backs of houses along x = ±118 (the town kit's `buildOldTown` edge pieces), or pull the bounds in to the last lots and set a visible barrier at the ends of the lanes.

**QA-016 · Medium · After F, Hachi's greeting is under the bottom of the view**
- *Repro:* keep the start's view pitch (0.16 rad, looking up at Fuji), which you keep unless you move the mouse up or down. Walk into a street and press F (`08-diag whistle`, "lane-pitch-0.16" against "lane-level": same street, same yaw).
- *Expected:* DECISIONS 2026-09-29: "you always see him come ... he greets you 4 m in front".
- *Actual:* level (pitch 0), 14 of 14 greeting frames on screen, and so in every other place tested. At pitch 0.16, **0 of 18**. The gallop in is seen; the skid, spin, hops, sit and head tilt all happen under the bottom of the frame (`08-diag/whistle-lane-pitch-0.16.jpg`). The same happens at any upward pitch over about 0.05 rad.
- *Cause:* `A.whistle.near` (4.2 m, `src/config.js`) was chosen for a level view (DECISIONS: "a 24 cm pup nearer than ~4 m is under the bottom of the view"). The hello eases the view down to the pup (`main.js watchPup`), but the whistle's greeting doesn't.
- *Fix:* reuse `watchPup`'s ease-down for the greeting (it is one condition: `GUIDE.greeting()` also answering in the `caught` state), or set the greeting's distance from the current pitch.

**Also checked and cleared:** Hachi answers F from every place tried. From the forecourt, car park, bridge road, shopping street, plaza, shrine lane and pond it came and greeted in 2.1-9.1 s, every greeting frame on screen at a level view. Every ring can be walked into from its open sides (`08-diag reach`: the view 8 of 8 directions, Han 7 of 8, the car blocking one; the konbini 5, the bench 6, the train 3, the rest blocked by walls or the train).

**QA-017 · Medium · Memory over budget**
- *Actual:* the production build at the famous view, after a forced GC:
  - `performance.memory.usedJSHeapSize` is 391-394 MB (the figure SPEC 11 quotes as "about 390 MB"). CDP's `JSHeapUsedSize` is 95-97 MB; the rest is typed arrays and canvases outside the V8 heap.
  - The GPU textures come to an estimated **426 MB** across 199 textures (RGBA8 with mipmaps, `07-prod` perf `texMB`). The biggest (`qa/11-textures.mjs`): a 4096² atlas shared by shrine name plates, ema, vending machines and merged props (85 MB); the store's quads page, 2048x5472 (57 MB); two 3072² product-label pages, `stock-page-0/1`, seen only through the glass or during the 30 s scene (48 MB each); a 4096x1488 page for vending and the station (31 MB).
  - three.js geometries, textures and programs grow as places are first seen (736→1,049, 155→191, 163→210 over the 23-minute tour) and never drop when you leave. AGENTS.md: "a place loads when approached, frees when left".
- *Cause:* known (SPEC 11): static geometry keeps its CPU copy, all three trains are always loaded, and the 4096 px Pokémon livery page.
- *Fix:* as SPEC 13 B: free the geometry's CPU arrays after upload (`BufferAttribute.onUpload(() => { attr.array = null })` for static meshes), load the trains near the railway only, and use a 3072 px livery page. Also size the stock-label pages to what the scene shows: they are seen at a few hundred pixels, so 1536² or smaller would do. Split the 4096² prop atlas by place so a place's page loads with the place. It matters most for phones and in-app browsers once a mobile version exists.

**QA-018 · Medium · Hosting not prepared**
- *Actual:* `dist/` has no `_headers`, `_redirects`, `404.html` or `robots.txt` (`qa/10-dist.mjs`). `vite preview` answers any unknown path with the game itself (`07-prod --only leak`: `/some/missing/page` answers 200 with the full game). SPEC 13 A8 specifies the cache headers, CSP and `.m4a` type.
- *Fix:* add `public/_headers` exactly as SPEC 13 A8 describes (hashed assets immutable for a year; audio and key art for a day; `index.html` no-cache; `Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'`; `.m4a` as `audio/mp4`). Add a small `404.html` linking home, and a `robots.txt`.

**QA-019 · Low · README stale, a credit wrong**
- *Actual:* README says "browse the shelves, heat a bento, chat with the clerk, pay". It credits "Clerk voice: macOS text-to-speech (Kyoko), generated by scripts/gen-voices.mjs", but there is no clerk and no such script. It calls "Han's theme, the megastore theme, station and train announcements ... Tan's recordings", though the Han track's source is the film's song by its file name. Its controls table has no F (whistle).
- *Fix:* rewrite the intro to the game as it is (SPEC 1), fix the credits (section 6), add F.

**QA-020 · Low · Konbini stock runs out silently**
- *Actual:* each choice has 8-16 units in a session (egg sando 8, fruit sando 8, onigiri 10, Strong Nine 10, Choco Wafer Jumbo 16, from `05-chaos refresh`). Eaten units never come back (`src/world/store/shop.js:265`, `u.count--`), so the choice stays on the card and the key then does nothing, with no message. Checked (`03 15-konbini-stock-out`): with the Choco Wafer Jumbo emptied, pressing 5 on the ring left the card up, started nothing and showed no toast (`03-completionist/15-stock-out-menu.jpg`). The toast "Step back onto the highlight for another" invites the repeat.
- *Cause:* `src/world/store/shop.js:550-553` (`api.play` returns false when no facing has stock) and `src/main.js:554-556` (nothing on false).
- *Fix:* restock a unit when the visit ends (`u.count++` in `finishEating`), or pick the fullest facing. At least toast "Sold out" when `play()` returns false.

**QA-021 · Low · Two meanings for 1-3 on the konbini ring**
- *Actual:* on the ring, the corner panel lists "1–5 Choose" and "1 2 3 Time of day" together (`01-first-visit-chromium-1280x720/05-konbini-menu.jpg`), but 1-3 then choose, not the time.
- *Cause:* `src/main.js:611-614` (`controlRows`) keeps `C('views')` while `handsHud.open`.
- *Fix:* drop the Time of day row while the choice card is up.

**QA-022 · Low · 1 2 3 dropped during the dip**
- *Actual:* `setTime` returns while a 0.7 s fade runs (`src/main.js:322-323`). A quick "3 then 1" ends on night. `03 72` mashed 12 keys and landed on a look that was not the last key pressed.
- *Fix:* queue the latest request and apply it when the fade ends.

**QA-023 · Low · The card is 760 px minimum**
- *Actual:* at 640x480 the card overflows (left 0, right 760, top −52) and Start is off-screen (`05-chaos/resize-card-640x480.jpg`). 800x600 and up are fine. It also affects desktop users at 200% zoom or in a narrow side-by-side window.
- *Cause:* `index.html:131` `min-width: 760px`.
- *Fix:* drop the min-width below about 780 px of window and stack the card's body (keys over Start) with a media query. Space and Enter already work, but nothing says so.

**QA-024 · Low · Accessibility and comfort**
- *Actual:*
  - No volume on the start card (N is listed). The song starts on the first click, so a visitor in a quiet room gets music before they find N.
  - The Strong Nine blur and sway run for 10 s with no reduced-motion check. `prefers-reduced-motion` is honoured only for the card's CSS transitions.
  - Mouse sensitivity is fixed (`src/core/player.js` `0.0022`), and there is no invert-Y or FOV setting (SPEC 12: open).
  - The console warns "Blocked aria-hidden on an element because its descendant retained focus" when the card hides with Start focused (`src/core/hud.js:141-148`).
  - The konbini card and the controls panel should overlap below about 800 px wide. This is read from the CSS (`src/ui/hands.js:20`, 400 px centred; `src/ui/controls.js`, 290 px at the left) and was not captured.
- *Fix:* show the volume slider on the start card too. Skip or soften the sway under `prefers-reduced-motion`. Add a sensitivity step to the pause card. Blur the button (or use `inert`) before setting `aria-hidden`.

**QA-025 · Low · Small collider overlaps**
- *Actual:* In 4,965 sprints into tall colliders from 8 sides (`08-diag pen`), 4 ended inside a box, the deepest by 6.8 cm (a post at world (55.0, −68.0)); none deeper than 10 cm. Harmless for play; at 6.8 cm the near plane (0.25 m) can just show the inside of a thin post.
- *Cause:* `src/core/player.js` `_resolve` pushes out of one box at a time, so resolving one can push into a neighbour.
- *Fix:* iterate `_resolve` until nothing overlaps (two or three passes), or merge touching boxes.

**QA-026 · Low · Small props without colliders**
- *Actual:* 97 of the density registry's 1,372 props, signs and poles have no collider within 15 cm (`02 E1`). Sampled: pot plants in house gateways and shrubs along house fronts (`08-diag/prop-0.jpg`, `prop-2.jpg`, `prop-6.jpg`). Walking at them goes straight through. SPEC 3: "Nothing can be walked through." Poles (93) and bike racks all have colliders.
- *Fix:* give the kit's pot and shrub dressing a small collider (`ctx.collide`), as the park planter got in the final QA (docs/decisions/final-qa.md item 3).

**QA-027 · Low · Resume right after Esc can be refused**
- *Actual:* Chrome refuses `requestPointerLock` for about a second after the user leaves the lock with Esc. In `05-chaos unlock`, Enter on the focused Resume 0.7 s after leaving the lock did not resume, and `player.lock()` swallows the rejection (`src/core/player.js:186-190`), so nothing happens and nothing says why. A click a second later works. Needs a manual check (M-2).
- *Fix:* on a rejected lock, retry once after 1 s, or show "Click to resume" until it succeeds.

**QA-028 · Polish · Dead store code references missing strings**
- `src/world/store/shop.js:258,260` call `S.handsFull` and `S.noMoney(...)`, which don't exist in `STRINGS.store`. The second would throw a TypeError. Neither is reachable in today's one-item scene. Remove them with the rest of the wallet and basket leftovers (`api.hud`, `wallet`, `change`).

**QA-029 · Polish · Input nits**
- Nine fast M presses (90 ms apart) ended closed; one press was dropped (`03 73`).
- `Numpad1`-`Numpad5` do nothing on the konbini card or for the time of day (`src/main.js:554`, `588` match only `Digit*`).

**QA-030 · Polish · Console noise**
- Every load: `THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed.` (a warning) and `Failed to load resource: 404` for `/favicon.ico` (QA-005). The production console holds exactly these two lines (`07-prod leak`). Firefox adds "WEBGL_multi_draw extension not supported" and repeated "Output of vertex shader ... not read by fragment shader" program warnings (`06-browsers/firefox-*/log.json`).

**QA-031 · Polish · The coordinate readout sits under the minimap**
- Both are pinned bottom-right (`index.html:79-80`; `src/ui/minimap.js:35`). Moot if C goes (QA-011).

**QA-032 · Polish · Upstream screenshots in docs/**
- `docs/hero-1-crossing.jpg` … `hero-4-shrine.jpg` come from Sakura Crossing's first commit (de01898) and are referenced nowhere. Remove them before the repo goes public.

**QA-033 · Polish · Unused audio**
- `door-chime.m4a` (11 KB) is prefetched on the first click (`src/core/sound.js:460`) but never plays while `lawson-chime` exists (`sound.js:556`). `ui-tap.m4a` (5 KB) is prefetched, and nothing calls `sound.ui()`. `stamp.m4a` (6 KB) ships and nothing plays it. SPEC 9 still lists ui-tap and stamp as "in use". Together about 22 KB of the 5 MB budget.

**QA-034 · Low · Pigeons read as drones up close**
- *Actual:* at the station plaza the pigeons flush as you arrive. In flight they are dark rounded bodies with long, straight, flat wings, and some sit mid-air at the cherry tree's branch tips. One flew through the camera and covered the station sign in a dark, faceted shape (`09-visual/station-plaza-night.jpg`, `station-plaza-morning.jpg`). SPEC 4: animals "should read as figures in a painted anime background, never as robots or toys".
- *Fix:* keep flushed pigeons out of a near sphere round the camera (about 1.5 m), soften the wing silhouette (a bend and taper), and check where they perch on the tree.

**QA-035 · Medium · Frame rate under 60 in busy spots**
- *Actual:* the production build in Chrome, 15 places a player stands, the real frame loop (`07-prod perf`, section 4). At 1920x1080: the famous view 26 fps (1,462 draw calls, 4.9 M triangles), Han's car park 23.7 fps, the shrine and the pond bench 24.7 fps, the far bank 17.9 fps (1,970 draw calls, 7.5 M triangles). Quiet spots reach 55-59 fps (the Deer Park gate: 188 calls). At 2560x1440, measured a few minutes later under lighter load: 21.8-60 fps, with Han's car park worst at 46 ms a frame. The laptop was shared and loaded, so these are pessimistic. But SPEC 11's 9-11 ms is the render-only loop, not the frame a player gets, and "smooth on a normal laptop" with integrated graphics is not shown by any measurement here.
- *Cause:* triangle and draw counts that include the shadow pass, the mirror passes (鏡池, paddies, river) and the ink pass. Far views (the far bank, the car park looking over the river) draw most of the town.
- *Fix:* measure on a quiet machine and a Windows laptop with integrated graphics first (M-7). If it holds up, cull merged cells by distance and frustum, drop far trees to impostors, draw the mirrors' reflection layer at half resolution, and skip the shadow pass for small far meshes.

## 4. Performance

**How it was measured.** Download and load come from the production build (`npx vite build`) under `vite preview`, cache off, Chrome's own network emulation (`07-prod load`). Frame times use the real frame loop (rAF intervals over 3 s at each spot, `07-prod perf`), not the `__shot` render-only loop that SPEC 11 quotes. Memory is Chrome's JS heap (CDP `JSHeapUsedSize`, after a forced GC where it says so). **The laptop was shared with other sessions' test browsers throughout (load average 7-37, swap at 11 of 13 GB), so frame rates are pessimistic, and they swung by 2-3x from minute to minute (see the lingerer).** Treat them as lower bounds, and re-measure on a quiet machine before quoting them.

| Measure | Target (SPEC 11 / AGENTS.md) | Measured | Notes |
|---|---|---|---|
| First-visit download (`npm run size`) | < 5 MB | **4.87 MB** (brotli 4.76 MB), of which 1.53 MB before the first click | Pass, 0.13 MB of headroom. `qa/10-dist.mjs` agrees |
| Main JS chunk | none set | 1,782 KB minified, 585 KB gzip | SPEC's "1.2 MB / 527 KB" is out of date; over Vite's 1,200 KB warning |
| Largest downloads | - | JS 572 KB gz · store-bgm 1,370 KB (streamed, inside the store only) · brush font 377 KB · station ambience 309 KB · rural flute 289 KB · Fuji DEM 288 KB · title song 276 KB · wind 182 KB · round font 176 KB · key art 154 KB | Nothing uncompressed or oversized for what it is; the fonts are subset |
| Requests on a first visit | - | 27-28 (1 HTML, 1 JS, 2 fonts, DEM, key art, manifest, audio) | No request to another domain (`qa/10-dist.mjs`: only the SVG namespace string) |
| Time to the card, localhost, cache off | about 4 s | **8.0 s**: first paint 0.1 s is an empty page; the card is the first content, at 7.8 s | Loaded machine (QA-004) |
| Same, "Fast 4G" + 4x slower CPU | - | **42.7 s** blank | QA-004 |
| Same, "Slow 4G" + 4x slower CPU | - | **36.0 s** blank | CPU-bound: the build, not the network |
| Fuji after Start | - | < 0.15 s | Built before the card |
| Frame rate, 1920x1080, real loop | 60 fps on a mid-range GPU at 1440p | 17.9-59 fps across 15 spots. The famous view 26 fps; the worst: the far bank 17.9 (56 ms), Han's car park 23.7, the shrine 24.7, the pond bench 24.7 | QA-035. Loaded machine |
| Frame rate, 2560x1440, real loop | 60 fps | 21.8-60 fps. The famous view 31; the worst: Han's car park 21.8 (46 ms), the far bank 32.7 | Run under lighter load than the 1080p pass |
| Draw calls a frame | - | 188 (Deer Park gate) to 1,970 (far bank); the famous view 1,462 | All passes |
| Triangles a frame | - | 2.2 M to 7.5 M; the famous view 4.9 M | All passes (shadows, mirrors) |
| JS heap after GC (CDP) | 300 MB whole game | 95-97 MB | |
| `performance.memory` used | 300 MB | **391-394 MB** | SPEC's "about 390 MB"; QA-017 |
| GPU textures (estimate) | "textures are most of the memory" | **about 426 MB** in 199 textures | The biggest are 85, 57, 48, 48 and 31 MB (QA-017) |
| Caching | long-lived for hashed assets (SPEC 13 A8) | `no-cache` on everything under `vite preview`; no `_headers` | QA-018 |

**The 23-minute session (`04-lingerer`, dev build, 1280x720).** It followed Hachi's whole tour: the konbini, Han, the bench, the gate, the train, then Hachi's nap. The time of day changed every 2 min, with an 8 s pause every 5 min, and a sample every 30 s (41 samples).

| Measure | Start | Min / max during | End (after 60 s idle, then GC) | Reading |
|---|---|---|---|---|
| JS heap (CDP) | 159 MB | 110 / 178 MB | 111 MB after GC | Flat. The first half averages 131 MB, the second 122 MB. No leak |
| DOM nodes | 692 | 692 / 1,082 | 809 | Flat (a spike to 3,145 in an earlier run was collected) |
| three.js geometries / textures / programs | 736 / 155 / 163 | grow as places are first seen | 1,049 / 191 / 210 | Grow as places load; **never drop when you leave**, against AGENTS.md "a place frees when left" (QA-017) |
| Live buffer sources / oscillators | 2 / 4 | peak 17 / 18 | 4 / 4 | No stacking in normal play (QA-006 needs stepping in and out on purpose) |
| Console errors, HTTP errors | 0 | 0 | 0 | |
| Frame rate at 1280x720 | 54 fps | 17-60 fps | 60 fps idle | Tracks the machine's load, not the session: the second half averaged **faster** (41.8) than the first (31.1). No decay |
| Paused (8 s, 4 times) | - | main context rms 0.005-0.022 (the song), trains context 0 | - | Silent under the song except for the trains (QA-007) |

The tour, as the follower bot played it: konbini (71 s), Han (319 s), bench (595 s, E from outside the ring), gate, train (1,004 s, after waiting at an empty ring: QA-010), nap (about 1,250 s). The bot stalled three times, and each stall was the bot's own limit, not a hang. It walked straight at Han's glow into the car; it did not know to press E at the bench; the train ring was absent. A person does this in about 8 minutes (SPEC: 7.4).

## 5. Browsers and screens

`qa/06-browsers.mjs` ran the core scenario: load, card, Start, the famous view, frame rate, decoding every sound file, the two streamed tracks, the trains' AudioContext, and at 1366x768 a full konbini visit through eating. It ran on the bundled build (`NODE_ENV=development vite build`, so the QA hooks exist), served by `vite preview`. The dev server was too slow for Firefox: its `load` event didn't fire in 180 s with hundreds of modules, on a loaded machine. Chrome also ran earlier on the dev server, with the same results (`06-browsers/result-dev-chrome.json`).

| Engine | Size | Card | Card fits | Pointer lock on Start | AudioContext | 23 sound files decode | Store music, title song stream | Trains' 2nd context | Konbini visit | fps* | Errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Chrome 154 | 1366x768 | 20.3 s | yes | yes | running | all 23 | both play | running | 21.8 s, scan / pay / ka-ching | 29 | 0 |
| Chrome 154 | 1920x1080 | 34.3 s | yes | yes | running | all | both play | running | - | 27 | 0 |
| Chrome 154 | 2560x1440 | 16.1 s | yes | yes | running | all | both play | running | - | 31 | 0 |
| Firefox 155 (Playwright) | 1366x768 | 24.2 s | yes | yes | running | all | both play | running | 21.8 s, all three | 31 | 0 |
| Firefox 155 | 1920x1080 | 29.9 s | yes | yes | running | all | both play | running | - | 16 | 0 |
| Firefox 155 | 2560x1440 | 52.0 s | yes | yes | running | all | both play | running | - | 13 | 0 |
| WebKit 26.6 (Playwright) | 1366x768 | 86.0 s | yes | **no** (headless WebKit has no pointer lock; faked for the run) | running | all | both play | running | 21.9 s, all three | 1.4 | 0 |
| WebKit 26.6 | 1920x1080 | 132.5 s | yes | no | running | all | both play | running | - | 5.5 | 0 |
| WebKit 26.6 | 2560x1440 | 19.4 s | yes | no | running | all | both play | running | - | 36 | 0 |

\* The frame rates and card times were taken on the loaded laptop, and headless Firefox and WebKit render in software. They show the game working, not how fast it runs. The famous view renders the same in all three engines (`06-browsers/sheet-views.jpg`); the cards too (`sheet-cards.jpg`).

**Summary:** functionally identical in all three engines at all three sizes. Every audio file (AAC and HE-AAC) decodes, both streams play, the konbini scene completes, and there are no page errors. Firefox adds shader-log console warnings (QA-030). Not tested: real Safari (Playwright's WebKit is close but not Safari's media or autoplay policy), Edge, Windows, and a machine with integrated graphics (M-7).

**Would block a future mobile version** (for the Phase 5 plan, and for Agent 2's feasibility work):
- **Input:** first person needs pointer lock (none on iOS) and a keyboard (arrows, E, F, M, N, R, 1-5). There are no touch controls.
- **Load:** the whole town builds in one blocking task (36-43 s on a 4x slower CPU). About 390 MB of JS-side memory plus about 426 MB of textures is well over what an iOS in-app browser allows.
- **UI:** the card's 760 px minimum; the controls panel, prompt and choice card all assume a wide screen.
- **Performance:** 1,000-2,000 draw calls a frame is far beyond a phone GPU's budget.

## 6. Licences and credits

Checked against the repo, the shipped bundle (`qa/10-dist.mjs`), README, SPEC 12-13 and DECISIONS. I am not a lawyer. "Risk" below means the chance of a takedown or claim once the site is public, not a legal opinion.

**Code and data**

| Item | Licence / terms | In the repo | In the game (what a visitor sees) | Finding |
|---|---|---|---|---|
| Sakura Crossing (Kenton Wang) | MIT | LICENSE keeps "Copyright (c) 2026 Kenton Wang" with the full notice; README credits it with a link | Start card: "Built on Sakura Crossing (MIT)" | OK in the repo. MIT asks for the notice in "all copies or substantial portions". The built bundle at takemebacktojapan.com is such a copy, but the notice is not shipped with it (no LICENSE or credits file in `dist/`). Add the notice to a credits page or file. QA-008 |
| three.js | MIT | npm dependency | not credited in the game; README credits it | The minified bundle keeps three's `@license` header (`qa/10-dist.mjs`), so its notice does ship. Credit it on the Credits page anyway |
| Vite | MIT (build tool, not shipped) | - | - | nothing needed |
| Mt. Fuji elevation, 国土地理院 tiles (`src/data/fuji-dem.bin`) | GSI Content Terms of Use: a source credit (出典) is required wherever the data is used, and processed data should say it was processed (e.g. "国土地理院の標高タイルを加工して作成") | README credits it | **not credited in the game** | Required attribution missing from the site. QA-008 |
| Sign fonts: M PLUS Rounded 1c, Yuji Syuku (subset woff2) | SIL OFL 1.1 | `src/assets/fonts/OFL.txt` with both copyright lines | not credited in the game; OFL.txt is not in `dist/` | Low risk. OFL allows embedding; best practice is to ship the licence or credit it. QA-008 |
| Key art `public/keyart.webp` | the game's own render | tracked | start card, og:image | OK |
| `docs/hero-*.jpg` | Sakura Crossing's own screenshots (MIT, upstream commit de01898) | tracked, unused | - | Remove before the repo goes public, or it shows another game. QA-032 |

**Audio.** None of these files is committed, but every one is **publicly downloadable** from `/audio/*.m4a` once the site is live.

| File (source in `assets/audio/`) | What it is | Credit today | Risk | Note |
|---|---|---|---|---|
| lawson-chime (`lawson-chime.mp3`) | Panasonic "Melody Chime No.1 大盛況" by Yasushi Inada (1978), the FamilyMart entrance tune | README, DECISIONS M3d (Tan's call) | Medium-High | Known and accepted. It is still in copyright. JASRAC-managed works need a licence for public web use |
| store-bgm (`store-bgm.mp3`, 5.6 min) | "Sounds of Japanese Lawson" by Joonas (YouTube) | README | High | SPEC 13: permission not confirmed. A recording of in-store music is someone else's work twice over |
| han-drift (`Han-tokyodrift-sixdays.mp3`) | By its file name, "Six Days" (DJ Shadow, the Tokyo Drift soundtrack) | README says it is one of "Tan's recordings" | **High** | A commercial recording, and the README credit is wrong. The one sound most likely to draw a takedown. Needs Tan's call (SPEC 13 A5) |
| donki-theme (`donquijote.mp3`) | Presumably Don Quijote's in-store theme ("Miracle Shopping") | "Tan's recordings" | High | A commercial jingle. Same call |
| station-ambience (`railway-station-announcement(.mp3`), train-nextstop (`nextstop-shibuya(play inside train).mp3`) | Recordings of real station and in-train announcements (the in-train one says Shibuya) | "Tan's recordings" | Medium | The announcer's voice and the railway's recording. Confirm the source |
| theme (`title bgm.mp3`) | "Nippon Let's Go", made by Tan with Suno | not credited in README | Medium | Suno's terms: songs made on the free plan belong to Suno and are non-commercial with attribution; paid plans give ownership. Confirm the plan and credit it |
| rural-flute, shrine-chimes | "Tan's recordings" | README | Low-Medium | Confirm they really are Tan's recordings (see the Six Days case) |
| walk-kakko / walk-piyo (`zebracrossing.mp3`), railway-bells, auto-door, birds, crows, wind, night-insects, bite/munch/gulp/can-open/wrapper, ka-ching, kiosk (Tan's self-checkout recording) | 効果音ラボ and Tan's own recordings | README credits 効果音ラボ | Low | 効果音ラボ allows commercial use with no credit, but forbids redistributing the files as material. Serving them inside a game is normal use; do not add any listing or download page (AGENTS.md already bans a soundboard) |
| v-*.aiff (clerk voices, macOS Kyoko) | macOS TTS | README still credits "Clerk voice ... scripts/gen-voices.mjs" | none (unused) | Stale credit: the clerk and the script are gone. QA-019 |

**Visual IP (Tan's calls, SPEC 13 A5)**

| Item | Risk | Note |
|---|---|---|
| Pokémon train: Pikachu, Eevee, Piplup, Bulbasaur, the Poké Ball, "POKÉMON with YOU" | **High** | Nintendo, Creatures and Game Freak (The Pokémon Company) actively take down fan games. Seen in-game (`qa/artifacts/03-completionist/30-train-spot.jpg`) |
| Mazda RX-7 FD with the VeilSide Fortune kit, and Han as a likeness of the film's character | Medium | Trade dress, and the film character (Universal). The README disclaimer does not cover the film |
| NIPPON store in the Lawson-style blue band | Low | Generic name; `npm run check:names` passes |
| ドンペン堂 (Donpen-do), a MEGA Don Quijote homage with a penguin mascot | Low-Medium | Homage; the mascot resembles Donpen |

**Credits in the game.** The start card credits only Sakura Crossing. SPEC 13 A6 lists what a Credits link needs. Add GSI (required), 効果音ラボ, the fonts (OFL), the music sources, three.js, the README's disclaimer, and a contact line for takedown requests. QA-008.

## 7. Things that work well (keep them working)

Each of these was seen working in a run. A fix nearby should keep it working.

- **The famous view and the start.** A cold load lands on the photo's framing at golden hour, and the minimap and highlights stay out of it. Start takes a real pointer lock in Chrome. The keys on the card match what the game does. Hachi's hello comes 4 s in and the caption reads well (`01-first-visit-chromium-1280x720/04-hachi-sits.jpg`).
- **Autoplay done right.** No AudioContext and no audio request exist before the first click or key. The context is made on that gesture and runs at once (`03 00-start`: gesture at 9.30 s, context at 10.51 s; `01 beforeGesture`: no audio fetched).
- **The konbini scene.** All five choices play start to finish in 21.7-30.3 s of game time. Every recording plays as a decoded file, never a stand-in recipe, and the chime sounds once in and once out. The path through the aisles is clean, and the phase resets to `out` with nothing held and the player free. Keys mashed mid-scene (R, M, F, E, arrows, Tab) do nothing. Pause freezes the scene at exactly 0 s of game time and Resume continues it (`03` tests 10-12). The Strong Nine blur fades out cleanly after 10 s, and Hachi throws its party.
- **Local sound.** Every zone (flute, shrine, ドンペン堂, station) plays near its place and fully stops beyond `far`: no source node, gain under 0.003. All four walk signals play their tune while green, and the crossing bells ring while it is closed (`03` tests 60-62). No two music zones overlap anywhere.
- **Pause.** World time stops. Hachi's caption hides under the card. Space pauses and resumes. The pause card's volume steps are saved to `localStorage`.
- **Han's show.** It runs start to finish and the view follows the car. R mid-show hands the player back at once. Spamming E during the show does not start a second song (`03` tests 20, 22).
- **Collisions.** 60 random walkers over 90 simulated minutes never got stuck. Sprinting into 930 tall colliders from 3,409 starts ended inside only 4 (a few cm; see QA-025). You cannot walk into 鏡池 or onto the river's water, and the channel's lower walks work. Stairs have no false cliffs (`02-explorer` E2-E6).
- **Robustness.** Mashing 750 random keys threw no errors. Rapid resizes from 640x480 to 3440x1440 kept the canvas and aspect exact. A reload mid-scene came back clean. The konbini spot's menu toggled correctly across 10 fast on/off steps, and mashing 1-5 started exactly one visit (`05-chaos`, `03` test 13).
- **Download discipline.** Audio waits for the first gesture. The store music (1.37 MB) and the title song stream through `<audio>`. The key art is 154 KB. Section 4 has the numbers.
- **No console errors** in any normal-play scenario, in any engine. The only noise is a three.js warning and the favicon 404 (QA-030).

## 8. Needs a manual check (Tan)

Things a headless run cannot judge: ears, a real phone, real Safari, Windows, and anything that needs a person's eyes on the whole experience.

| # | What | Exact steps | What to look / listen for |
|---|---|---|---|
| M-1 | Every sound by ear | Chrome, headphones, volume 50%. Start, stay 10 s on the view (wind, crows), walk to the konbini ring, press 1 and listen through the scene. Then walk to each speaker on the map (M). | The chime twice, the door, the store music inside and muffled outside, scan/pay/ka-ching in time with the hand, eating sounds. Each place's sound fading in and out as you pass. Nothing clipping, no sudden loud sound. |
| M-2 | Esc and the pointer lock | Chrome, Safari, Firefox: press Esc in play, then click Resume **at once**, then again after 2 s. | Chrome refuses a pointer-lock request within about 1 s of Esc. Does the first click do nothing, with no feedback? (QA-027) |
| M-3 | The train drone under the pause card | Stand on platform 1 as a train pulls out. Press Space while it is still close. | Whether the motor and rolling sound keep going under the paused title song (QA-007). |
| M-4 | Han's song after a pause | Step into Han's glow. When the car turns onto the main road, pause for 5 s, then resume. | The drift should land on the song's beat. Expect the music to be about 5 s ahead of the car (QA-013). |
| M-5 | A real phone from a social link | Open takemebacktojapan.com from an X post and an Instagram DM on an iPhone and an Android phone, in the in-app browser and in Safari/Chrome. | Today: a blank page, then a card too wide for the screen, and Start does nothing (QA-001). After the fix: the "best on a desktop" card. |
| M-6 | Share previews | Paste the live URL into X, LinkedIn Post Inspector, the Facebook Sharing Debugger, iMessage, WhatsApp and Slack. | Which show the key art. Several do not render WebP og:images (QA-005). |
| M-7 | Safari on macOS, and Windows | Safari: play through the konbini and stand by a moving train. Windows: Chrome and Edge on a laptop with integrated graphics; Firefox once. | Audio starts after Start; the trains are audible in Safari (QA-007: a second AudioContext made outside a click); the frame rate; the fonts on the card (Yu Gothic UI fallback). |
| M-8 | The whole tour with Hachi | A fresh start, following Hachi only, all the way to the Deer Park gate. | Stops where the pup waits and you don't know why (the train ring missing: QA-010; the bench: QA-009). Whether you see Hachi greet you after F without moving the mouse up or down (QA-016). Time it (SPEC says about 7.4 min). |
| M-9 | Rights decisions | SPEC 13 A5 and section 6 here. | Keep, replace, or keep with a takedown contact, for each High item. |
| M-10 | Visual pass | Look through `qa/artifacts/09-visual/` (17 places × 3 times of day). | Anything off-model to your eye; the empty plain at the east and west ends (QA-015). |
| M-11 | Motion comfort | Drink the Strong Nine and watch the 10 s sway. | Whether it needs an off switch or a gentler setting (QA-024). |

## Appendix: the QA tooling

Everything lives in `qa/`, and every script writes to `qa/artifacts/<scenario>/` (`result.json`, `log.json` with the console, page errors and HTTP statuses, plus screenshots). Each script opens one browser and closes it however the run ends.

| Script | What it does | Time |
|---|---|---|
| `qa/vite.qa.config.mjs` | The project's Vite config on port 5180, with its own dep cache (`.qa-vite-cache`), so it doesn't touch the main checkout's server on 5178 through the shared `node_modules` | - |
| `qa/lib.mjs` | `open()` (browser, context, page, logs, screenshots), `harness()` (in-page helpers), `audioSpy()` (every AudioContext, source, oscillator and `<audio>` play, with a per-context output analyser), `fps()` | - |
| `qa/01-first-visit.mjs` | Scenario 1: cold load, card, real Start, Hachi, arrow-key walk to the konbini, choose, the scene, the view spot, M, 1 2 3, N, F, Esc/Space. Video. `--engine`, `--size`, `--item` | 4 min |
| `qa/02-explorer.mjs` | Scenario 2: props without colliders, sprinting into 930 walls, the edges, 60 random walkers, cliffs, water, pressed against walls | 1 min |
| `qa/03-completionist.mjs` | Scenario 3: every experience and every sound place, then repeats and spam. `--only id,id` | 12 min |
| `qa/04-lingerer.mjs` | Scenario 4: 22 min following Hachi, time of day every 2 min, pauses; heap, DOM, GL and audio every 30 s. `--minutes` | 24 min |
| `qa/05-chaos.mjs` | Scenario 5: key mash, resizes, focus, pointer lock lost, context lost, reload mid-scene, two tabs, no WebGL, two phones. `--only` | 6 min |
| `qa/06-browsers.mjs` | Chrome, Firefox and WebKit × 1366x768, 1920x1080, 2560x1440 | 15 min |
| `qa/07-prod.mjs` | The production build under `vite preview`: cold loads (plain, Fast 4G, Slow 4G with a 4x CPU), perf at 15 spots at 1080p and 1440p, what leaks into a production page | 10 min |
| `qa/08-diag.mjs` | Diagnostics: the whistle from eight places plus the same street at the start's pitch, collider overlaps, ring reachability, props without colliders, the train sound under pause. `--only` | 5 min |
| `qa/09-visual.mjs` | 17 places × 3 times of day (real keys 1 2 3), and the time-of-day transition | 4 min |
| `qa/10-dist.mjs` | Static checks on `dist/`: sizes (gzip, brotli), leftovers, meta tags, hosting files | 1 s |
| `qa/11-textures.mjs` | Which meshes use the biggest textures (production build) | 1 min |
| `qa/summarize-lingerer.mjs`, `qa/contact-sheet.mjs`, `qa/shrink.mjs`, `qa/probe.mjs`, `qa/watch.mjs` | Summarise the 23-minute run; labelled contact sheets of a folder's frames; shrink screenshots before committing; a pointer-lock probe; follow a scenario's output | - |

To run them: `npx vite --config qa/vite.qa.config.mjs` (dev on 5180), then `node qa/0N-*.mjs`. For production, run `npx vite build`, then `npx vite preview --config qa/vite.qa.config.mjs`, then `node qa/07-prod.mjs` and `node qa/10-dist.mjs`. Symlink `node_modules`, `assets/audio`, `assets/fonts` and `public/audio` from the main checkout first (`public/audio` is what the game plays).
