# Station and train: decisions

- **The train is an E231/E233-style stainless EMU in our own livery.**
  Silver skin with bead lines and seams, the Fujimi Line's green band under
  the windows with a sakura-pink pinstripe, a thin green line over them.
  Car numbers are our own (クハ 2104 / クモハ 2204), not a real series'.
  The cab is a non-through front (black mask, two big panes, LED
  destination and run number, lights low on the corners, snowplough). One
  single-arm pantograph, on the motor car.
- **Track 1 runs through to Shibuya.** RIDE.dest (data/town.js) replaces
  LINE.dest for the train, the boards and the signs: track 1 is 快速 渋谷
  (via 大月 and the JR line, drawn dashed on the fare map, "Through service
  to Shibuya"), track 2 各停 河口湖. LINE itself is untouched.
- **No passengers.** The old silhouettes are gone (tonight's people rule).
- **Wheels are baked in.** A plain turning disc looks the same as a still
  one, and the 32 wheel meshes per set were most of its draw calls. The
  set is 31 draws (was 44), 49k triangles (was 12k): the interior is real.
- **Straps: one InstancedMesh per set**, 180-odd straps, their matrices
  rewritten only while the camera is within 45 m of a set that is out.
  They lean back as it pulls away and forward as it brakes.
- **Boarding is platform 1 only** (the brief), and never traps you. The
  cars' floor is a permanent platform over track 1 at stop; the platform
  edge's collider has gaps at the eight doors that open only while the
  doors are fully open; seats, walls, the cab walls and the car's own side
  are colliders that exist only while the set stands there. At the chime
  you get "Doors closing — please step off" and, if aboard, a 0.3 s dip to
  black and you're on the platform by the door. Any time the set isn't at
  the platform and you're found inside, you're put out (never carried).
- **E on the train's spot boards you** (the same dip) while the doors are
  open; otherwise it says the next one is due.
- **World code reaches the player and the HUD through window.__scene.**
  There is no hook for either; boarding.js's `host()`/`say()` are the one
  place to change when one exists (ctx.player / ctx.say wanted). The
  subtitle strings live with the line's text in data/town.js (RIDE.say):
  they could move to strings.js, which I don't own.
- **The procedural sounds run on their own small audio graph** (sfx.js):
  the engine only plays named files and its own recipes, and I can't touch
  core/. It's made only after the first click (soundBus.ready), follows
  the engine's volume and mute, and suspends with a hidden tab. A
  soundBus hook to the engine's context and sfx bus would fold it in.
- **The announcement's file is fetched on approach.** The engine plays a
  file only from its second asking (the first plays a fallback tap while
  it loads), so boarding.js asks once, silently, when you come within
  80 m of the station.
- **The whistle is procedural**, a trilled 2.95 kHz pea whistle; the
  master blows it when the doors have closed (3 s before it pulls away),
  then holds his arm up until it goes.
- **The Deer Park gate's poster** is a board on two posts beside the gate,
  turned toward the bridge road (gate.js: the one edit there).

## The entrance blockers and the train's doors (2026-09-29, Tan's review)

- **The "green strip" was the front plinth.** station.js drew the trim
  band (y0..y0+0.5, the green-grey `trim` material) the whole width of the
  front, doorway included: from the foot of the steps it stood across the
  entrance at gate height. A raycast from the eye at the steps hit it at
  y 1.58, z = B.z0 - 0.04 in the static batch. It is now two pieces, either
  side of the entrance.
- **The "glass layer" was the night glow.** `ctx.night.glow` put an
  additive warm panel (opacity 0 by day, 0.14 at golden, more at blue) the
  size of the doorway 0.3 m inside it, the shop-window recipe. Over an open
  doorway it read as a pale pinkish pane over the gates from dusk on. It is
  gone: the doorway shows the lit concourse itself (the night pools and the
  ceiling strips stay). The two front windows keep their panels.
- **Every other opening checked** by the same raycasts: the back wall over
  the gates, the office window (real glass, meant), the waiting room and
  kiosk fronts (opaque glazing on a facade, meant), the bus shelter. Nothing
  else stands in a doorway.
- **Car numbers moved to the end panels** (x = ±(CAR_L/2 - 0.95), below the
  window), where nothing slides: a leaf's pocket reaches 0.63 m past its
  jamb (x 8.29 from the car's centre) and the number starts at 8.44. The
  old spot (CAR_L/2 - 2.2) was inside door 4's opening, floating across it
  when open and over the leaf when shut. The number is painted straight on
  the stainless now (transparent texture, no grey plate).
- **Pocket seams only on solid skin.** The panel seam 0.3 m past each door
  used to run straight through the window bay beside it.
- **A shut leaf receives shadows** like the body: without it a shut door
  read cream on a lavender car in the canopy's shade.
- **Livery:** the band is 0.28 m under the sill with the pinstripe under
  it (was 0.18 m), three bead lines below (was two), steel a touch lighter
  and its shade less purple (0x6e7292). The cab front gets the emergency
  door's seams and handle and a rain gutter over the mask. The door-caution
  sticker is a vertex-coloured yellow strip on the leaf's glass by the
  meeting edge (no texture; it rides with the leaf). Car 2 is the 弱冷房車:
  one 192x64 sticker on its end window.
- **Shots:** `platform-shut` stage (doors shut at the platform) and three
  spots: station-approach (Tan's 17.webp), train-beside-open/shut.
