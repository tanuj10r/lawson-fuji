/* Tunables (AGENTS.md).  Units are metres unless noted; +Y is up.
 *
 * World frame (SPEC section 3): the Lawson's front faces +Z toward the main
 * road and Fuji lies far behind it to -Z.  The storefront is centred on x = 0
 * with its glass at z = 0.
 *
 * Sizes below are measured off reference/real-day.png and
 * reference/real-bluehour.png (see DECISIONS.md, M1), where the photos win
 * over SPEC's starting numbers. */

export const PLAYER = {
  eye: 1.6,
  /* Gameplay FOV, degrees, measured across a 16:9 frame (SPEC section 5's
   * 70°).  The vertical angle this gives (~43°) is held at every aspect. */
  hfov: 70,
};
export const PLAYER_VFOV =
  2 * Math.atan(Math.tan((PLAYER.hfov * Math.PI) / 360) / (16 / 9)) * (180 / Math.PI);

export const LAWSON = {
  x: 0,
  frontZ: 0,       // storefront glass line
  width: 17,       // main box; the real store is long and low
  depth: 10,       // back wall at frontZ - depth
  height: 4.0,     // ground to top of the parapet
  signBand: 0.62,  // blue band height
  coping: 0.42,    // pale cap above the band
  doorX: -2.3,     // entrance centre: left of centre, as in both photos
  doorWidth: 2.0,
  wingWidth: 2.6,  // tiled wall section at the right end
};

/* Ground plan in front of the store, as z lines (the store glass is z = 0). */
export const STREET = {
  apron: 1.6,      // concrete walk along the glass
  stopZ: 2.5,      // wheel stops
  bayZ0: 2.9,      // painted bay lines start ...
  bayZ1: 8.2,      // ... and end
  bayWidth: 2.7,
  bayFirstX: -6.1, // one divider line; the rest repeat every bayWidth
  forecourtZ: 10.5,// forecourt meets the road
  roadZ: 17.2,     // far kerb
  tactileZ: 17.55, // centre of the yellow tactile strip
  sidewalkZ: 20.5, // far sidewalk ends, a paved lot begins
  lotZ: 36,
  x0: -40,         // forecourt
  x1: 40,
  roadX0: -125,    // the main road runs the width of the town (M2)
  roadX1: 125,
  lotX0: -40,      // the paved lot where the photographers stand
  lotX1: 24,
  bayX0: -20,      // painted bays and wheel stops, out past the hero frame
  bayX1: 22,
  gap: [25.3, 34.7], // the far sidewalk breaks for the side road
};

/* Hero views (SPEC section 1).
 *
 *   play   where keys 1, 2, 3 and the spawn put you, in the ordinary gameplay
 *          lens: the spot where the store fills the frame as it does in the
 *          photo.  Fuji is magnified in play to match (FUJI.gameplaySize), so
 *          the view reads as the photo and walking off never zooms.
 *
 * The rest is the exact camera of the reference photo, used only under the
 * dev R overlay, reconstructed from the store's size in it:
 *   vfov   vertical field of view, degrees
 *   shift  lens shift [x, y] in units of half the frame height.  The photos
 *          keep verticals straight with the horizon well below centre, so the
 *          camera stays level and the lens shifts instead of tilting.
 * The composition then holds at any window aspect: the frame is matched on
 * its height, and the R overlay fits the reference by height too. */
export const HERO_VIEWS = {
  morning: {
    key: 'Digit1',
    look: 'day',
    play: { pos: [0, 0, 16.5], yaw: 0, pitch: 0.16 },
    pos: [0, 0, 30.4],
    yaw: 0,
    vfov: 24.1,
    shift: [0, 0.4135],
    ref: 'real-day.png',
  },
  /* Golden hour uses hero camera 1's framing; the game opens on it (SPEC 1).
   * There is no real photo at golden hour, so R shows the day photo for
   * composition. */
  golden: {
    key: 'Digit2',
    look: 'golden',
    play: { pos: [0, 0, 16.5], yaw: 0, pitch: 0.16 },
    pos: [0, 0, 30.4],
    yaw: 0,
    vfov: 24.1,
    shift: [0, 0.4135],
    ref: 'real-day.png',
  },
  /* Night stands where morning and golden hour do.  Its photo camera (dev R
   * overlay only) is the blue-hour photo's: closer and a little left, with the
   * storefront still square to the frame, so its peak sits nearer the centre. */
  night: {
    key: 'Digit3',
    look: 'blue',
    play: { pos: [0, 0, 16.5], yaw: 0, pitch: 0.16 },
    pos: [-3.36, 0, 23.4],
    yaw: 0,
    vfov: 42.6,
    shift: [0.376, 0.232],
    ref: 'real-bluehour.png',
  },
};

/* The player starts on the famous view at golden hour (SPEC section 1). */
export const SPAWN = { view: 'golden', ...HERO_VIEWS.golden.play };

/* Mt. Fuji from the baked GSI grid (scripts/fetch-fuji-dem.mjs).
 *
 * It is drawn at a fixed offset from the camera, like the sky, because at the
 * real 16 km nothing in a 250 m town moves it.  The mesh is scaled so its
 * angular size is the real one from the real Lawson. */
export const FUJI = {
  bearing: 9.8,        // peak direction, degrees right of -Z (real-day.png)
  distance: 1400,      // drawn distance to the peak, metres
  exaggeration: 1.0,   // vertical scale on top of the true shape
  radius: 11000,       // crop around the summit, real metres
  snowLine: 2450,      // real metres; jagged, and lower in the gullies
  /* Fuji's on-screen size in the gameplay lens, relative to hero camera 1
   * (1 = exactly as large as in the famous photo).  The hero cameras always
   * show the true size. */
  gameplaySize: 1.0,
};

/* Time-of-day looks for M1's three hero views.  M6's day/night cycle
 * interpolates between keyframes in this shape.  Colours are sRGB hex. */
export const LOOKS = {
  day: {
    sky: { top: 0x2a6ad8, mid: 0x6ba6ec, haze: 0xcbe3f6, glow: 0xe6f2ff, glowAmount: 0.15, glowYaw: 10 },
    clouds: { light: 0xffffff, shade: 0xc9d6ee, opacity: 1 },
    fog: { color: 0xc8def2, near: 70, far: 320 },
    sun: { color: 0xfff3dc, intensity: 2.2, dir: [34, 70, 62] },
    fill: { color: 0xa9bdf5, intensity: 1.0 },
    bounce: 0.3,
    hemi: { sky: 0xd6e8ff, ground: 0xb3a8c8, intensity: 1.05 },
    grade: { shadow: 0xb4b4d8, light: 0xfffaf2, saturation: 1.12, lift: 0.03, vignette: 0.12, warmth: 0.015 },
    fuji: {
      lit: 0x8ea0d4, shade: 0x5a6db4, snow: 0xf9faff, snowShade: 0xb6c4ec,
      alpen: 0xffb6cc, alpenAmount: 0.0, haze: 0xc8def2, hazeAmount: 0.16,
      light: [-0.62, 0.52, 0.58],
    },
    ground: 0xc9ccc0,
    store: { interior: 0.82, sign: 1.0, spill: 0.0, glass: 0.34 },
  },
  golden: {
    sky: { top: 0x5a55b0, mid: 0xc79ac8, haze: 0xffc49c, glow: 0xffd9a8, glowAmount: 0.75, glowYaw: 38 },
    clouds: { light: 0xffd2b8, shade: 0xb48cc0, opacity: 1 },
    fog: { color: 0xe8b8b0, near: 60, far: 300 },
    sun: { color: 0xffc896, intensity: 1.9, dir: [70, 20, 34] },
    fill: { color: 0x9aa4ee, intensity: 1.05 },
    bounce: 0.34,
    hemi: { sky: 0xe6d0ec, ground: 0xa892c0, intensity: 1.0 },
    grade: { shadow: 0xb2a2d4, light: 0xfff0e2, saturation: 1.14, lift: 0.034, vignette: 0.16, warmth: 0.06 },
    fuji: {
      lit: 0xa28cc4, shade: 0x6660aa, snow: 0xfff0f2, snowShade: 0xc0aee0,
      alpen: 0xffa2bc, alpenAmount: 0.55, haze: 0xe8b8b0, hazeAmount: 0.18,
      light: [0.8, 0.34, 0.36],
    },
    ground: 0xc8b8b4,
    store: { interior: 0.92, sign: 1.12, spill: 0.12, glass: 0.3 },
  },
  blue: {
    sky: { top: 0x123c9a, mid: 0x2e6ad2, haze: 0x7ea2e6, glow: 0xa8b8f0, glowAmount: 0.3, glowYaw: 20 },
    clouds: { light: 0x8a96d8, shade: 0x4a5aa8, opacity: 0 },
    fog: { color: 0x7488c8, near: 50, far: 260 },
    sun: { color: 0x94a8ea, intensity: 0.5, dir: [-20, 70, 40] },
    fill: { color: 0x6c84d8, intensity: 0.75 },
    bounce: 0.2,
    hemi: { sky: 0x6a82d0, ground: 0x3c3a6c, intensity: 0.95 },
    grade: { shadow: 0xa4b0dc, light: 0xf2f6ff, saturation: 1.14, lift: 0.024, vignette: 0.18, warmth: 0.0 },
    fuji: {
      lit: 0x6a6cb0, shade: 0x464a8c, snow: 0xf4c6e0, snowShade: 0xb49ad4,
      alpen: 0xff9ccc, alpenAmount: 0.45, haze: 0x7488c8, hazeAmount: 0.12,
      light: [0.75, 0.4, 0.4],
    },
    ground: 0x7a80a8,
    store: { interior: 1.1, sign: 1.5, spill: 0.34, glass: 0.12 },
  },
};

/* The compact town around the Lawson (SPEC section 3, M2).  About 245 x 190 m.
 *
 *   north (-z)  tree line; residential lane (left), the Lawson, park (right)
 *   z 10.5-17.2 the main road, barricaded where it leaves town at x ±118
 *   south (+z)  the photographers' lot, shopping street (left), side road
 *               to the level crossing and station (right), the railway at
 *               z = 60, tree line beyond */
export const TOWN = {
  bounds: { x0: -122, x1: 122, z0: -97, z1: 92 },
  rail: { crossX: 30, z: 60, interval: 180 },   // a train every 3 minutes
  sideRoad: { x: 30, z0: 17.2, z1: 86 },        // carriageway ±3.15, walks 1.55
  crosswalk: { x: -35, width: 4 },              // zebra and signals on the main road
  residential: { laneZ: -41, laneX0: -110, sideLaneX: -21.5 },
  shotengai: { laneZ: 40, x0: -108, x1: -38 },
  park: { x0: 22, x1: 70, z0: -58, z1: -12 },
  petals: 150,                                    // SPEC section 1: 150 on High
};

/* The flat ground plane under everything. */
export const WORLD = {
  groundHalf: 1200,          // flat ground plane, well past the fog
  groundColor: 0xc4c4b6,
  bounds: TOWN.bounds,
};

/* ------------------------------------------------------------------ *
 * The town kit (SPEC section 3, M2a): roads, markings, poles and wires,
 * signs.  Widths are metres across the whole road; see world/kit/.
 * ------------------------------------------------------------------ */

/** Road classes.  `asphalt` is the full paved width between kerbs (or
 * between the side gutters on a lane); `walk` is each pavement. */
export const ROADS = {
  lane: { asphalt: 4.6, walk: 0, gutter: 0.36, speed: 30, rank: 0 },
  shopping: { asphalt: 6.0, walk: 1.6, gutter: 0, speed: 30, rank: 1 },
  main: { asphalt: 10.0, carriage: 7.0, cycle: 1.5, walk: 2.0, gutter: 0, speed: 40, rank: 2 },
  kerbH: 0.15,      // pavement top above the asphalt
  asphaltY: 0.02,   // asphalt top above the ground plane
};

export const MARKINGS = {
  dash: [3, 3],             // white dashed centreline: paint, gap
  edgeInset: 0.25,          // lane edge lines, in from the gutter
  diamondAhead: [30, 50],   // ◇ before a zebra, metres
  manholeEvery: [14, 26],
  drainEvery: [8, 12],
  gutterLid: 0.6,           // lane gutter lid length
  gratingEvery: 5,          // one lid in N is a grating
  patchesPer100m: 9,
  cracksPer100m: 14,
  petalsPer100m: 7,
  schoolZoneChance: 0.5,
  pedPriorityChance: 0.5,
};

export const POLES = {
  spacing: [20, 30],
  height: [8.8, 10.2],
  transformerEvery: 3,
  lampEvery: 2,
  adChance: 0.45,
  hydrantEvery: 3,          // a 消火栓 plate on one pole in N
  sag: 0.55,
  wireR: 0.022,
  dropR: 0.016,
};

/* Named camera spots for scripts/shots.mjs (SPEC M2 working method).
 *   scene  'town' or 'kit' (the ?kit test street)
 *   hero   stand on a hero view instead of pos/yaw/pitch
 *   looks  LOOKS keys to shoot the spot in
 *   ref    the frame in reference/density/ it is judged against */
export const SHOT_SPOTS = [
  { name: 'hero-1', scene: 'town', hero: 'morning', looks: ['day'], guard: true },
  { name: 'hero-2', scene: 'town', hero: 'golden', looks: ['golden'], guard: true },
  { name: 'hero-3', scene: 'town', hero: 'night', looks: ['blue'], guard: true },
  { name: 'town-road', scene: 'town', pos: [-60, 0, 14], yaw: -1.35, pitch: 0.05, looks: ['day'], ref: '02-main-road-van-poles.png' },
  { name: 'town-shotengai', scene: 'town', pos: [-40, 0, 40], yaw: 1.57, pitch: 0.05, looks: ['golden'], ref: '05-shopping-street-petals.png' },

  { name: 'kit-main-road', scene: 'kit', pos: [-54, 0, -1.6], yaw: -1.5708, pitch: 0.02, looks: ['day', 'golden'], ref: '01-main-road-cycle-lanes.png' },
  { name: 'kit-lane-poles', scene: 'kit', pos: [31, 0, -6], yaw: 0, pitch: 0.06, looks: ['day'], ref: '03-street-shrine-house.png' },
  { name: 'kit-junction', scene: 'kit', pos: [-21, 0, -27], yaw: 3.1416, pitch: -0.02, looks: ['day'], ref: '09-konbini-corner-tomare.png' },
  { name: 'kit-zebra-cycle', scene: 'kit', pos: [-4, 0, -5.6], yaw: -1.4, pitch: -0.04, looks: ['day'], ref: '07-florist-konbini-cycle-lane.png' },
  { name: 'kit-bus-stop', scene: 'kit', pos: [40, 0, -6.1], yaw: -1.62, pitch: -0.03, looks: ['golden'], ref: '10-bus-stop-road.png' },
  { name: 'kit-lane-signs', scene: 'kit', pos: [-6, 0, -35.5], yaw: -1.5708, pitch: 0.03, looks: ['day', 'blue'], ref: '02-main-road-van-poles.png' },
  { name: 'kit-overview', scene: 'kit', pos: [0, 0, 70], yaw: 0, pitch: -0.5, lift: 60, looks: ['golden'] },
];
