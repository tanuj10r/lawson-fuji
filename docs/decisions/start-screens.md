# The start and pause cards, the keys and the name (2026-09-28)

Tan: overhaul the start and pause screens; arrow keys to move, R instead of H;
revisit the name now the town is Fujikawaguchikko and the game lives at
takemebacktojapan.com; one image of the whole vibe on both cards.

## Why Tan's start card said "Nippon Fuji", "one two three" and "Duact"
`<html lang="ja">`: Chrome took the page for Japanese and machine-translated
the English UI (ニッポン富士 became "Nippon Fuji", 1 2 3 became "one two
three", Interact became "Duact"). Our strings were right. Fixed at the
cause: `<html lang="en" translate="no">`, `<meta name="google"
content="notranslate">`, `class="notranslate"` on the body, and the Japanese
on the cards marked `lang="ja"`. scripts/_cards.mjs checks it.

## The name
- **Title: Take Me Back to Japan**, the domain's own words, so the name and
  the address are one thing to remember. It replaces "Nippon Fuji", which
  had become the store's name plus the mountain and no longer the town's.
- **Japanese line: 日本へ、もう一度** ("to Japan, once more"): the same
  wish, quieter; a line under the title, not a translation of it. Every
  character is already in the rounded sign font's subset.
- **Place line: Fujikawaguchikko · 富士川口湖町**, straight from
  data/town.js TOWN_NAME, so a later rename follows.
- **The URL** is on both cards (small, under Start/Resume), in the document
  title's twin (`<title>`), the canonical link, og/twitter tags (og:image is
  the key art), package.json's description and the README heading. It is
  not written in the world: the town has no reason to know its own website.
- **The store stays NIPPON.** Untouched.
- **Credit.** AGENTS.md asks for Sakura Crossing to be credited in the game;
  there was no in-game credit. One small line under the URL: "Built on
  Sakura Crossing (MIT)". A credit, not a place name.
- Left for the owner of world/lawson.js: its experience is still named
  "The Nippon Fuji view" / ニッポン富士 (shown where experiences are listed).

## The keys
- **Move: the arrow keys**, drawn as four caps. WASD still walks (it always
  did); not shown anywhere, as asked. Arrows also have their default
  prevented while playing, like WASD.
- **R: "Back to the start"** (was H). It puts you on the famous view at the
  time of day you are in; "Restart" would suggest progress is lost, and it
  isn't. The dev-only reference overlay moved from R to ` (Backquote),
  still dev-only.
- **E: Interact**, everywhere (the corner panel said "Take / open").
- **1 2 3: Time of day**, digits as caps.
- One list, data/strings.js CONTROLS: the cards list all of it in order; the
  corner panel (main.js controlRows, ui/controls.js) takes its rows by name
  from the same list, so the words and caps can't drift apart. On the
  famous view the corner shows Move (was "WASD Look around") and Time of day.

## The cards
- One card, two modes (core/hud.js): the key art full width with the name in
  the clear sky right of Fuji's peak (dark ink on the lavender, a serif
  title from the system's book faces: Iowan/Palatino/Georgia, no font
  download); a sakura-pink rule; below, the tagline, the nine keys in a 3x3
  grid of key caps, and Start. Paused: a PAUSED chip on the art, the volume
  above Resume. The game keeps drawing, blurred, behind.
- Sized to the window, never scrolled: width min(66vw, (100vh - 236px) *
  16/9, 1500px); type in container units with floors (12-14 px at 1280x720).
  Checked at 1280x720, 1440x900, 1920x1080, 2560x1440 (scripts/_cards.mjs).

## The key art
- 2026-09-30: replaced by the ?poster diorama (DECISIONS.md, "The key art: a
  diorama of the town"); what follows is the first key art's story.
- Baked from our own renderer (AGENTS.md: visuals built in code):
  scripts/keyart.mjs renders a staged `__shot` at 1600x900, 2x internal,
  and writes public/keyart.webp (Chrome's WebP encoder, q0.90, 154 KB).
- Tried: the famous view itself (lovely, but it is already the first thing
  you see behind the card), high over the town (Fuji and rooftops; the
  store too small, the haze flat), across the road at eye height (store and
  Fuji, no story). Chosen: from behind Han's RX-7 in its bay, golden hour,
  Han leaning on it and the shiba beside him, both looking where you look,
  NIPPON across the road under Fuji, the sakura along the lane, ドンペン堂
  lit, petals in the air. The engagement highlights are hidden for the shot
  (`clean`), the pup staged with the guide's own dev pose (`guideFrom`), 9 m out, looking at the view.
- Not in it: the train and station. They are 150 m beyond the store, under
  the haze, from anywhere the store and Fuji read well together.
- New dev-only `__shot` options for this: `vfov`, `clean`, `guideFrom`,
  `guideD`.
- Cost: +154 KB to the first visit (preloaded; the card shows it at once).
  At 2560x1440 on a 2x screen the art is upscaled about 1.9x: soft, not
  blurry. A 2400-wide bake would be roughly twice the bytes; the whole
  game is at 4.86 MB of 5 (was 4.71), so no.
