# Design pass (launch day, 2026-09-28): judgement calls

The quality-and-design lead's pass over Tan's named targets (the hands, the
RX-7, Han, the river) and the town. Rules: the game's own cel look, no new
post work, no download growth, no frame-time regression, the famous views
untouched.

## The hands (store/hands.js)
- **Anatomy over blobs.** The palm is a loft of nine superellipse sections
  (wrist 5.3 cm across, knuckles 8.5 cm), with the four metacarpal ridges
  displaced into its back and a hollow in the palm; fingers are three
  tapered phalanges in 4:3:2 with the middle joint standing proudest, a
  rounded pad and a nail on the back of the last; the thumb comes from the
  heel of the hand with its thenar pad and the web to the index; the
  little-finger side has the hypothenar pad and the ulnar bump at the wrist.
  6,904 triangles a hand (was 4,436), the same one draw each.
- **The natural cascade, not a fist.** Index least curled, little most
  (0.32-0.68 rad at the knuckle), and fanned 0.1 to -0.16 rad, so from the
  back of the hand the finger lengths show. A tighter grip hid every
  fingertip behind the knuckles and read as a fist.
- **Nails you mostly won't see.** From behind a curled hand the nails face
  away; they show on the thumb and when a hand turns (eating, paying). Kept
  small and a shade paler than the skin, not outlined.
- **The wrist and cuff at the frame's edge.** The rest pose is 3.4 cm higher
  and 2.5 cm further out than before, tipped a little more toward you, so
  the wrist and the top of the shirt cuff enter the frame; the cuff itself
  is at the wrist crease (8 cm below the palm's centre) where a real one
  sits, its button on the back. Raising the hands enough to show the whole
  cuff put them in the middle of the view, so they stay low.
- **Items unchanged.** The anchors (where a held thing sits) are where they
  were, so shop.js, eat.js and the checkout choreography need nothing.

## The RX-7 (han/rx7.js)
- **The proportion was the fault, not the detail.** The belt sat at 0.74 m
  under a 1.25 m roof: a 0.5 m glasshouse on a shallow body, a balloon
  cabin on a soap bar. A real FD's belt is about 0.85 m at the door under a
  1.23 m roof. The shoulder spline is now 0.78-0.885 m (highest over the
  hips), the bonnet's centre 0.855 at the cowl falling to 0.535 at the
  nose, the roof 1.235 peaking over the seats; the windscreen is a fast,
  nearly straight run rounding only into the header, the hatch glass holds
  the roofline then sweeps to the deck.
- **A curved side.** The section's side was a vertical line to the
  shoulder, which with the taller body read as a slab with a crease. It
  now bulges: 9 cm in at the sill, fullest just above the middle, rolling
  7.5 cm in to the shoulder (less at the narrow nose), and the top curve's
  superellipse is 2.6 rather than 3 for a softer turn. The ink still finds
  the belt line; that is the FD's own character line and stays.
- **The double bubble is a roof, not a windscreen.** The two shallow
  domes (3 cm) were laid along the whole cabin; they are now windowed to
  x -1.05..0.05, over the seats.
- **Two paint bands.** The one side-projected map smeared any line on the
  bonnet or deck. The map is now 1024 x 460: a 300 px side band (as
  before) and a 160 px plan band for the tops, with the belt point doubled
  in the section so the two bands meet on a zero-width quad (their normals
  averaged, or the ink drew the seam). The plan band carries the bonnet's
  outline (wide at the nose, as the FD's is; my first pointed U read as a
  Ferrari), the bumper seams over the fender tops, the hatch's edge on the
  deck and the cowl strip. +0.6 MB of texture, no extra draw.
- **Tail, mouth, wing, glass.** Three round lamps a side (the inner one
  the reverse lamp), as the FD's; the Fortune's wide low mouth; the wing
  on swept uprights with rounded end plates; the fender gills behind the
  front wheels in the paint; the black sweep rising to 0.77 m on the rear
  quarter now the body is taller. Glass tint lightened enough that the
  seats read through it, with the sky pale in its top; the windscreen's
  streaks now run across it (its own u), so it no longer reads as an open
  cockpit from the front.

## Han (han/han.js, one line in han/index.js)
- **The head was the likeness problem.** It was wide and round under a
  helmet of hair with two thick side curtains. Now: the face 6% narrower
  and 3% longer with a finer jaw and a forehead that tapers to the crown;
  the hair shell 3.5% off the skull (was 7%), the curtain hugging the head
  and tucking in behind the ears (its cut edges stood as flat black panels
  beside the face), finer shag cones. The face map: narrower eyes, a
  fuller goatee and moustache, the faintest socket and nose-bridge shading
  so the face has a middle. Same 256 px map, same draws.
- **Arms folded, not clasped.** With the joints' order (Ry·Rx on a hanging
  arm), a horizontal inward forearm is flexion -1.5 with a twist of ∓1.6;
  the two upper arms are at different depths (-0.85 / -0.45) so the
  forearms stack rather than collide. Two earlier tries met at the sternum
  (clasped hands) and stood up like a boxer's guard.
- **Clothes with some cloth in them.** Soft vertical folds worked into the
  jacket's lathe (more toward the hem), lapels either side of the opening,
  a fuller chain with a pendant, hands with a thumb and a flatter palm,
  trainers with a heel counter, a thicker sole and a pale toe cap.
- **Leaning on a taller car.** The FD's belt is 12 cm higher now, so his
  hips (pelvis 0.86 m, was 0.82) rest on the rear quarter 11 cm out from
  the body (was 5), the legs a little less splayed to keep the feet where
  they were.
