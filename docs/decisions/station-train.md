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
