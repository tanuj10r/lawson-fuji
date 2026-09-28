// dev check: Han's drive keeps to the roads (Tan: "How can somebody drive a
// car over the footpath like that?").  Samples the drive every 1/120 s and
// tests the car's four corners (its body as drawn: heading plus drift)
// against where a car may be, in the town frame:
//   the car park and the east mouth of its aisle;
//   the bridge road (x 30, its asphalt), south of the main road;
//   the main road's carriageway, kerb to kerb;
//   the bridge road's lane on through the junction (x 30), both ways;
//   NIPPON's forecourt (it meets the road with no kerb), clear of its wheel stops.
// Anything else (the footpaths, the verges, the store's side) is a fail.
//   node scripts/_han-route.mjs
import { buildDrive, driveAt, T_DRIVE } from '../src/world/han/drive.js';
import { TOWN, ROADS, STREET } from '../src/config.js';

const BAY = { x: 24.15, z: 4.7 };                        // han/index.js HAN_BAY (kept in step by hand)
const HALF = { L: 4.36 / 2, W: 1.98 / 2 };                // han/rx7.js RX7
const [px0, pz0, px1, pz1] = TOWN.land.parking;
const laneX = TOWN.land.track.x, laneW = ROADS.lane.asphalt;
const main = TOWN.grid.main;
const road = { z0: 2 * main - STREET.roadZ, z1: 2 * main - STREET.forecourtZ };   // the carriageway, turned into the town frame
const ok = (x, z) =>
  (x >= px0 && x <= px1 && z >= pz0 && z <= pz1)                                   // the car park
  || (x >= px1 - 0.1 && x <= laneX && z >= -2.6 && z <= 2.6)                       // its mouth
  || (Math.abs(x - laneX) <= laneW / 2)                                            // the bridge road and the lane it runs on into
  || (z >= road.z0 - 0.01 && z <= road.z1 + 0.01)                                  // the main road
  || (Math.abs(x) <= STREET.x1 && z >= road.z1 && z <= 2 * main - (STREET.stopZ + 0.6));   // the forecourt, short of the wheel stops

// what stands on those surfaces: the kei cars in the store's outer bays (town-edge.js), 3.4 x 1.48 nosed in
const keis = [-12.85, -15.55, 14.15, 16.85].map((wx) => ({ x: -wx, z: 2 * main - (STREET.stopZ + 0.08 + 0.275 + 1.16), hx: 0.74 + 0.1, hz: 1.7 + 0.1 }));
const clear = (x, z) => !keis.some((k) => Math.abs(x - k.x) < k.hx && Math.abs(z - k.z) < k.hz);
const D = buildDrive(BAY);
const bad = [];
const p = {};
for (let t = 0; t <= T_DRIVE; t += 1 / 120) {
  driveAt(D, t, p);
  const psi = p.th + p.drift, c = Math.cos(psi), s = Math.sin(psi);
  for (const [a, b] of [[HALF.L, HALF.W], [HALF.L, -HALF.W], [-HALF.L, HALF.W], [-HALF.L, -HALF.W]]) {
    const x = p.x + c * a - s * b, z = p.z + s * a + c * b;
    if (!ok(x, z) || !clear(x, z)) bad.push({ t: +t.toFixed(2), x: +x.toFixed(2), z: +z.toFixed(2) });
  }
}
driveAt(D, T_DRIVE, p);
const home = Math.hypot(p.x - BAY.x, p.z - BAY.z) < 0.05 && Math.abs(Math.sin(p.th - Math.PI / 2)) < 0.02;
console.log(`road: main z ${road.z0}..${road.z1}, bridge road x ${laneX}±${laneW / 2}, car park x ${px0}..${px1} z ${pz0}..${pz1}`);
console.log(`off the road: ${bad.length} corner samples${bad.length ? ', first ' + JSON.stringify(bad.slice(0, 4)) + ', last ' + JSON.stringify(bad[bad.length - 1]) : ''}`);
console.log(`back in the bay, nose out: ${home} (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
console.log(bad.length === 0 && home ? 'HAN ROUTE pass' : 'HAN ROUTE FAIL');
if (bad.length || !home) process.exitCode = 1;
