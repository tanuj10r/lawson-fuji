# Facades & shopfronts (town quality pass)

- **Signs in our own canvases, not core's.** core/textures.js `shopFascia`
  and `shopBlade` draw in the system gothic at 1024x224 and 192x768 and
  stretch with the board. kit/facade/signs.js redraws them in the self-hosted
  faces (brush for the old trades, rounded for the modern ones, per
  data/town.js `SHOP_LETTERING`) at 768x96 and 96x352, in a virtual canvas as
  wide as the board, so letters keep their proportions. Board ratios round to
  four buckets so shops share textures. core is untouched.
- **Three fascia makes**: a dark timber board with cream brush letters and a
  red seal (soba, wagashi, books), a painted panel with the trade's bars
  (ramen, general, greengrocer, hardware, closed), and a white panel with a
  round mark in the rounded face (bakery, florist, cafe, barber, laundry,
  dentist). Awnings now carry the name on their drop (valance).
- **Rooms behind the glass are two painted cards**, not furniture: the back
  wall (shelves, menu tags, mirrors, washers; 256x128) and, a metre in front,
  an alpha cut-out of counter/stools, shelf ends, tables or chairs (256x96),
  plus pale side walls and two light strips. The recess went from 3.4 m to
  1.7 m. Two cards give parallax through the glass that one card lacks, and
  cost fewer triangles than the baked furniture did.
- **Shutter boxes on ~65 % of shops** (and the closed shop, fully down):
  the box and guide rails over the opening are what makes a Japanese
  shopfront read at a glance. The shutter now runs in front of the glass.
- **Flat canopy (庇) on ~70 % of shops without noren**, only when there is
  no awning. Door pair with pulls, kick panel and transom on every unit.
- **Upstairs finish from its own seeded draw** (`lot.seed + 9191` for shops,
  `+1717` for house window boxes, `+71/73` for sheet roofs) so the old layout
  draws never shift: boards (35 %), glazed facing tile (30 %, new 128 px
  repeat texture), wall-hung AC and a window box where there is no balcony.
- **Houses**: main volume chamfered (7 cm) so corners take a cel band; eaves
  get fascia boards, gutters and barge boards, hips a gutter ring; gable
  vents; corner boards on siding; a real outdoor unit (hung upstairs, on the
  ground under the sills for bungalows, which before hung it across a
  window); a third of board houses get painted corrugated roofs. Textured
  roofs are now UV'd in metres down each slope (kawara was one stretched
  tile per slab).
- **Back walls get windows** (houses, shops, terrace end walls): block
  corners showed 10 m of blank wall (town-lane-junction).
- **Corner shops repeat their name flat on the flank**, reusing the blade
  art (no new texture), for the cross street.
- **Hero houses left as they are built by the generator**: the guard passes
  with the changes on (0.25/0.35/0.15 %); the diff is shadow edges on the
  store canopy and wires, not the houses, so no hero exclusion was needed.
- Two close-up spots added: `close-facade-shop`, `close-facade-house`.
- **Review fixes.** The fascia texture was never mirrored (checked by
  dumping the canvases): a shop balcony's slab stood in front of the board's
  upper half, so only the feet of the glyphs showed and the name read as
  garbled. The balcony now stands 0.45 m higher with a lower rail. The noren
  hangs from the door head under the transom (it was cut by it) and in the
  doorway. The corner flank sign z-fought its case; now 2 cm clear.
  "PayPay" in SHOP_NOTICES became "QR決済" (coordinator's OK).
- **Stepped shadow striping on house walls is not ours and not acne.** It is
  the same at close-facade-house on main before this pass; normalBias 0.08
  and 0.15 leave it unchanged; a 4096 shadow map halves it. It is the eave's
  shadow edge on a 2048 map over 80 m (3.9 cm texels) through PCF, banded by
  the toon ramp. The fix is in main.js (a tighter shadow frustum near the
  player, a larger map, or softer filtering), which facades does not own.
