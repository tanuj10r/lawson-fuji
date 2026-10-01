import { TOWN, WORLD, SLOWLIFE, PLACES, ANIMALS, MOBILE } from '../config.js';

/* ------------------------------------------------------------------ *
 * The mini town's plan (docs/decisions/mobile-lite.md, "Mobile v3").
 *
 * The phone's Fujikawaguchikko is the desktop's own town generator, kit and
 * builders (world/town-core.js, kit/, land/, line/) run on a smaller plan:
 * the desktop's plan with its southern block row taken out.  On the desktop
 * the town runs main road -> lane 45 -> lane 80 -> lane 112 -> lane 144 ->
 * the railway (z 162, town frame).  Here everything south of lane 112 moves
 * `dz` (32 m) north onto it:
 *
 *   west   the shopping street ends at the station plaza at z 94 (126), the
 *          station, the line (z 130) and the level crossing follow
 *   east   lane 144 becomes lane 112; 鏡池 and the slow-life bench move up
 *          whole, and the paddies between it and the main road's shops are
 *          the shorter for it; the pocket park's row is gone
 *   north  the main road, the konbini, the famous view, the car park, the
 *          river, ぺったん堂 and everything the famous views see: untouched
 *
 * This file only sets config.js (it must run before any world module is
 * evaluated: boot.js imports it first).  Positions written into the shared
 * builders as numbers are moved by the build itself: `vite --mode mobile`
 * rewrites the `@dz` and `@mini` marks left in comments beside them
 * (vite.config.js miniPlan), so the desktop bundle, built without the
 * marks, is byte for byte what it was.
 * ------------------------------------------------------------------ */

const dz = MOBILE.plan.dz;
const S = (z) => z - dz;                    // a southern z, town frame
const W = (z) => z + dz;                    // ... and in the world (the town is built turned: world z = 2 main - z)

/* ---- the grid ---- */
TOWN.bounds.z1 = S(TOWN.bounds.z1);         // 142
TOWN.core.z1 = S(TOWN.core.z1);             // 136
TOWN.rail.z = S(TOWN.rail.z);               // 130
TOWN.grid.ns = [
  { x: -80, cls: 'lane', z1: S(172) },      // crosses the railway
  { x: -50, cls: 'shopping', z1: S(126) },  // the short shopping street, to the plaza
  { x: -25, cls: 'lane', z0: 28, z1: 112 },
  { x: 0, cls: 'lane', z0: 45, z1: 112 },
  { x: 30, cls: 'lane', z0: -11, z1: 112 },
];
TOWN.grid.ew = [
  { z: 45, x0: -80, x1: 52 },
  { z: 80, x0: -80, x1: 52 },
  { z: 112, x0: -25, x1: 52 },              // the desktop's lane 144
];
for (const k of ['z0', 'z1']) TOWN.plaza[k] = S(TOWN.plaza[k]);
for (const k of ['z0', 'z1']) TOWN.station.building[k] = S(TOWN.station.building[k]);
TOWN.quiet[1] = [-200, S(153), 200, S(171)];

/* ---- Hachi's home, across the level crossing ---- */
{
  const H = TOWN.hachiHome;
  H.z0 = S(H.z0); H.z1 = S(H.z1);
  for (const k of ['kennel', 'bed', 'ball', 'mid', 'basket', 'sand']) H[k][1] = S(H[k][1]);
  H.tunnel.z0 = S(H.tunnel.z0); H.tunnel.z1 = S(H.tunnel.z1);
  H.hoop.z = S(H.hoop.z);
}

/* ---- the land: 鏡池 moves up whole; the paddies end where it begins ---- */
{
  const P = TOWN.land.pond;
  for (const c of P.corners) c[1] = S(c[1]);
  P.box[1] = S(P.box[1]); P.box[3] = S(P.box[3]);
  P.gates = [80, 112];
  TOWN.land.paddies.box[3] = S(TOWN.land.paddies.box[3]);
}
{
  const L = SLOWLIFE;
  for (const k of ['bench', 'tree', 'jizo', 'lantern']) L[k][1] = S(L[k][1]);
  L.petals.at[1] = S(L.petals.at[1]);
  L.butterflies.at[1] = S(L.butterflies.at[1]);
  L.glints.box[1] = S(L.glints.box[1]); L.glints.box[3] = S(L.glints.box[3]);
}
for (const s of ANIMALS.turtles.stones) s[1] = S(s[1]);

/* ---- the world's bounds follow the town's (config.js WORLD) ---- */
WORLD.bounds.z0 = 2 * TOWN.grid.main - TOWN.bounds.z1;

/* ---- the map's places ---- */
{
  const at = { spine: [-50, 62], plaza: [-52.5, S(137)], station: [-51, S(151.5)], crossing: [-80, S(162)], hachiHome: [-78.4, S(176.6)], pond: [75, S(128)], slowlife: [73, S(102.2)] };
  for (const p of PLACES) if (at[p.id]) p.at = at[p.id];
}

/* ---- Hachi's tour over the mini town (world frame; the desktop's, its southern legs moved up, and the way from
 * the crossing to the shrine along lane 80 instead of lane 112) ---- */
ANIMALS.guide.tour = [
  { id: 'view', x: 0, z: 16.5 },
  { id: 'konbini', x: -2.3, z: 2.3 },
  { x: -35, z: 8.5, hear: 'walk0' },          // the main road's zebra (kakko), south end
  { x: -35, z: 19 },                          // its north end
  { id: 'han', x: -21.7, z: 23.5 },           // the car park: Han and the RX-7
  { x: -28.5, z: 20.6 },
  { x: -12, z: 19.3 },                        // east along the far pavement, behind the famous view
  { x: 20, z: 19.3 },
  { id: 'mochi', x: 39.2, z: 19.4 },          // ぺったん堂
  { x: 50, z: 17 },                           // the shopping street's mouth
  { x: 50, z: -2.3, hear: 'walk1' },          // its first zebra
  { x: 50, z: -40, hear: 'donki' },           // ドンペン堂's theme
  { x: 50, z: -60.3, hear: 'walk2' },         // the second zebra, just before the plaza
  { x: 50, z: W(-101), hear: 'station' },     // the plaza: the station's announcements
  { x: 51, z: W(-115.5) },                    // the foot of the station's steps
  { id: 'train', x: 53, z: W(-129.2) },       // platform 1: the train's listening spot
  { x: 51, z: W(-115.5) },                    // back down
  { x: 68, z: W(-110) },                      // through the station plaza
  { x: 80, z: W(-116) },                      // onto the crossing's lane
  { x: 80, z: W(-127.6), cross: true, hear: 'crossing' },   // at the barrier: he waits here while it is shut
  { x: 80, z: W(-141.0) },                    // over the line
  { visit: 'home', x: 79.4, z: W(-146.6) },   // ハチのおうち
  { x: 80, z: W(-141.0), cross: true },       // back to the barrier, from the south
  { x: 80, z: W(-127.6) },
  { x: 80, z: -52.3 },                        // up the crossing's lane to lane 80
  { x: 50, z: -52.3 },                        // east along it: over the shopping street
  { x: 25, z: -52.3 },
  { x: 0, z: -52.3 },
  { x: -13, z: -52.9, hear: 'shrine' },       // the shrine's front: its wind chimes
  { visit: 'shrine', x: -13.95, z: -58.0 },   // 富士見稲荷: through the torii, to the guardian fox
  { x: -13, z: -52.9 },
  { x: -30, z: -52.3 },                       // on east along lane 80
  { x: -53, z: -52.3 },                       // the lane's end: the pond's gate
  { id: 'slowlife', x: -73, z: W(-74.8) },    // the slow-life bench, where the paddies meet the pond
  { x: -53, z: -52.3 },
  { x: -30, z: -52.3 },
  { x: -30, z: 4, hear: 'walk3' },            // the master junction (its lane zebra: piyo)
  { x: -30, z: 36 },                          // the bridge road
  { x: -30, z: 50, hear: 'bridge' },          // 富士見橋
  { id: 'gate', x: -30, z: 65, wait: 7 },     // 鹿公園, coming soon
];
Object.assign(ANIMALS.guide.hear, {
  walk2: [50, -63, 14],
  station: [51, W(-125.5), 14],
  crossing: [80, W(-134.3), 10],
});
