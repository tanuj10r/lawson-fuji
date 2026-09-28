# Map 2.0 (the town map, M; the corner map)

Tan, 2026-09-28: the map was basic; keep only the places with something to
do, draw the paddies as fields not a rectangle, no plain grey boxes, an
upscale map that stays light.

- **Places kept** (config.js PLACES): the Nippon Mart, the Nippon Mart
  Viewpoint, Tokyo Drift (Han's RX-7), the shopping street, ドンペン堂, the
  Inari shrine, the station plaza, the station, the level crossing, 鏡池, the
  slow-life bench, the river, the Deer Park gate.  Dropped: apartment block,
  vacant lot, small park, coin parking.  The bench got a label because it is
  one of the seven experiences and stands alone; the train's diamond sits on
  the station's icon as a badge (same spot), so it has no label of its own.
- **Labels in strings.js**: `STRINGS.map.places[id]` holds each label's
  English and Japanese; PLACES keeps only id, pictogram kind, position and
  the experience it belongs to (`exp`).  scripts/_map.mjs (an old dev helper,
  not in this pass's files) still reads `p.en`/`p.jp` and will print
  `undefined` in its own labels.
- **Viewpoint**: drawn at HERO_VIEWS.morning.play.pos.  PLACES `start` has
  `exp: 'view'`, so when Tan's `view` experience lands its diamond becomes
  the viewpoint icon's badge (a diamond belonging to a place always badges
  that place's icon) and nothing is doubled.
- **Diamonds**: the konbini's experience (world.lawson.experiences) now shows
  too, as a badge on the Nippon's icon: it is one of the seven.
- **Compass letters in English**: the corner ring's 北東南西 became N E S W,
  and the full map's rose says N: UI text is English (AGENTS.md); Japanese
  stays beside place names only.
- **Where the trees are**: the canopy builder keeps no list of tree spots, so
  the map reads each species' instanced crowns (kit/canopy.js Near/Far sets,
  the groves, the pond's lily pads) at paint time.  At load every crown is
  in those sets (the builder's first update has no camera, so nothing is
  culled), and createMinimap runs before the first frame.  If the map were
  ever painted after the loop starts, only the crowns in view would show.
- **Pond houses**: the pond's tea house and houses have no registry entry;
  they are taken from tall colliders inside the pond's grounds that no
  registry footprint covers.
- **Roof kinds** come from the lot each footprint stands in
  (world.core.lots[i].kind, built[i].type): houses pitched, hipped for mortar,
  terrace and old; shops flat and pale with their awning's colour along the
  frontage; the apartment block striped; ドンペン堂 yellow with a red front;
  the station green; the Nippon blue with a white fascia (no mark).
- **Cost**: one canvas, the same size as before (1904 x 1708, 12.4 MB); no
  new files, no fonts beyond the sign faces already loaded (NF Round, falling
  back to the system gothic).  The corner map copies it with
  `imageSmoothingQuality = 'high'` so the fine lines don't shimmer; measured
  0.2 to 2 ms per redraw, as before.  The full map is drawn when it opens.
