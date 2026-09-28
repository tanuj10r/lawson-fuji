# Pacing and sound (Tan, 2026-09-28)

Tan asked for three things: follow Han's car with the view, a short konbini
visit whose checkout sounds actually play, and fewer crows at golden hour.

## Han: the view follows the car
- From stepping into the glow until Han leans again, the player is held
  (`suspended`, the same hold as the prayer and the seat: no walking, the mouse
  not read) and the head turns after the car (main.js `watchCar`, config
  `HAN_WATCH`). The turn is damped (3.2/s) and capped at 1.9 rad/s, like a head
  turning rather than a camera rig. It leads the car by 0.35 s along its fixed
  route, so it never jumps when a building hides the car. Pitch stays within
  -0.3..0.22.
- The feet are held too. The car's collider is an axis-aligned box round the
  turned car, and as the car swings out of the bay that box grows past the car
  and pushed a player in the glow 0.6 m. The car still stops for anyone really
  in its way (`blocked()`).
- The hold lets go for a famous view, the konbini visit, a seat, or if
  something else moves the player more than 1 m (a teleport).
- Measured (_play 21-han): the angle between the view and the car has a median
  of 6 deg and a 90th percentile of 12 deg; the worst is 25 deg, at the
  handbrake flick.

## The konbini: why the checkout was silent
- Root cause: `shop.prime()` asked the engine for the kiosk and eating sounds
  on the first frame after the click. The audio context exists then, but
  manifest.json has not arrived. With no manifest nothing was fetched, and at
  checkout `tillSound` (which passes a recipe) played the `ui-tap` recipe,
  a 50 ms blip. So the first checkout of every session was silent, and the
  first eat used recipes too.
- Fix: `sound.preload(names)` waits for the manifest, then fetches and decodes.
  The kiosk voices are also `indoor` now (heard through the glass from outside).
- The engine's log now says how each sound played (`src: file | recipe |
  waiting | file-late`, and its level `k`). _konbini asserts that both cuts play
  from file at 0.9 and that the output level at the till doubles over the
  store's music.
- Test harness: the scripted visit is stepped inside one `page.evaluate`,
  which never gives the event loop a turn, so fetches never finished there.
  The loops now yield once per step, and `__shot` with `stepWorld` moves the
  listener with the camera.

## The konbini: the cuts (by spectrum and energy per 25-50 ms; not listened to)
- `kiosk-scan`, 16.05-17.55 s (1.5 s): a hush, then the scanner beep (a pure
  2.45 kHz tone at 16.2 s, 0.15 s into the cut), a ~1.94 kHz tone, then about
  1 s of voice-like follow-up.
- `kiosk-pay`, 26.55-30.5 s, with 29.0-29.65 s silenced (3.95 s): the card
  reader's beep (2.93 kHz at 26.8 s, 0.25 s in), a short voice, the paid beeps
  (2.63 and 3.04 kHz at 27.7 s, 1.15 s in), voice again (probably the thanks,
  28.1-28.9 s), and a closing two-tone (1.57 kHz then 1.31 kHz, 29.8-30.5 s).
- Not used: 0-3.3 s (ambience), 3.5-15 s (prompts and voice, with no clear
  single beep), and 18-24 s (quiet, rustle).
- The checkout takes 3.7 s from standing at the till to walking away, timed to
  the beeps: the item lands on the scanner on the scan beep, the card touches
  the reader on the card beep, and the screen thanks you on the paid beep. The
  thanks and the two-tone play on as you turn to go.

## The konbini: 30 s
- Walk planner: it kept the wide clearance whenever that grid had any path at
  all. The umbrella stand, 0.69 m from the end caps, closes the front aisle to
  that grid, so every walk from the till went round the back of the store
  (23.6 m where 11 m would do). There are now three clearances (0.55, 0.38 and
  a 0.28 squeeze). A tighter one is used only when it saves over 20% of the
  length. The umbrella-bag stand has no collider, so the planner is given it
  (`WALK_AROUND`).
- Kept the self-checkout at z -4.5. The nearer one at -3.3 would save about
  1 s, but its IC reader sits under the bun steamer (interior.js puts the
  steamer at z -3.3..-2.65): a modelling clash to fix separately.
- Walk speed 2.2 m/s (was 2.0). At 2.5 the visit looked rushed in first person.
- No idle pauses: the hand goes up as you turn to the shelf and comes back as
  you walk on. Turns to the shelf take 0.6 s, to the till 0.5 s, to the street
  0.6 s. Eating is unchanged at 3.5 s.
- Choosing to control back (before: 46-54 s):

  | item | door + walk in | take | to the till | checkout | out (chime) | eat | total |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | onigiri | 5.2 | 1.2 | 9.3 | 4.3 | 5.8 | 4.5 | 30.2 |
  | egg sando | 5.7 | 1.2 | 8.8 | 4.3 | 5.8 | 4.5 | 30.2 |
  | fruit sando | 5.5 | 1.2 | 9.0 | 4.3 | 5.8 | 4.5 | 30.2 |
  | Strong Nine | 7.8 | 1.5 | 3.7 | 4.3 | 5.8 | 4.4 | 27.3 |
  | choco wafer | 4.4 | 1.2 | 1.7 | 4.2 | 5.8 | 4.4 | 21.7 |

  The choco wafer is on the end cap beside the till, so it is shorter.
  _konbini asserts 18-35 s.

## Golden hour's crows
- crows.mp3 is a continuous chorus (no quiet gap in its 24 s), and it was
  looped as golden hour's bed at a steady level. Now golden hour's bed is the
  wind alone. Every 9-20 s (a third of the time answered 0.7-1.5 s later), one
  of the recording's six loudest caws is cut out and played 55-95 m away, high
  up, lowpassed at 2.6 kHz, at a level of 0.09-0.13 (config `SOUND.crows`).
  The sound's per-frame update drives it; there are no timers.
- Birds (day) are sparse chirps with a high crest, and the night insects are a
  steady chirr, which is natural. Neither sounds on top of you; both are
  unchanged.
