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
//
// And the wheels (Tan, 2026-10-02: "the tyres turn left while the car goes right"), every 1/120 s, signs as in
// drive.js (positive: toward the car's right):
//   gripping, forward: the front wheels point the way the path turns;
//   reversing: against the way the heading turns (backing swings the nose the other way);
//   sliding (slip over 17 deg): against the slip (counter-steer), the slip itself into the turn (tail out);
//   (as the tail is thrown the other way the hands get 0.1 s to follow it across);
//   the slide is held between 25 and 40 deg, and the car is straight again before the bridge road's lane.
//   node scripts/_han-route.mjs [log.txt]     (the log: time, curvature, slip, steer for every frame)
import fs from 'node:fs';
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
  || (x >= -STREET.x1 && x <= laneX + laneW / 2 && z >= road.z1 && z <= 2 * main - (STREET.stopZ + 0.6));   // the forecourt west of the lane, short of the wheel stops

// what stands on those surfaces: the kei cars in the store's outer bays (town-edge.js), 3.4 x 1.48 nosed in
const keis = [-12.85, -15.55, 14.15, 16.85].map((wx) => ({ x: -wx, z: 2 * main - (STREET.stopZ + 0.08 + 0.275 + 1.16), hx: 0.74 + 0.1, hz: 1.7 + 0.1 }));
const clear = (x, z) => !keis.some((k) => Math.abs(x - k.x) < k.hx && Math.abs(z - k.z) < k.hz);
const D = buildDrive(BAY);
const HOLD = D.route.findIndex((o) => o.handbrake);   // the long slide's segment
const bad = [];
const p = {};
for (let t = 0; t <= T_DRIVE; t += 1 / 120) {
  driveAt(D, t, p);
  const psi = p.psi, c = Math.cos(psi), s = Math.sin(psi);
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

// the wheels
const tally = { forward: [0, 0], reverse: [0, 0], slide: [0, 0] }, wrong = [], log = ['t      mode     v(m/s)  curv(1/m)  slip(deg)  steer(deg)  rule'];
let peak = 0, held = [Infinity, 0], slideT = 0, lastSlide = 0, vmax = 0, maxStep = 0, prevSteer = 0, after = 0;
let h0 = Infinity, h1 = 0;
const slips = [];
for (let n = 0; n <= Math.round(T_DRIVE * 120); n++) { driveAt(D, n / 120, p); if (p.seg === HOLD) { h0 = Math.min(h0, n / 120); h1 = Math.max(h1, n / 120); } }
for (let n = 0; n <= Math.round(T_DRIVE * 120); n++) {
  const t = n / 120;
  driveAt(D, t, p);
  const slip = slips[n] = p.drift, deg = (a) => (a * 180 / Math.PI).toFixed(1).padStart(6);
  let mode = 'still', ok = null;
  if (p.speed > 0.5) {
    if (p.rev) { mode = 'reverse'; if (Math.abs(p.kap) > 0.06) ok = Math.sign(p.steer) === -Math.sign(p.kap); }
    else if (Math.abs(slip) > 0.3 && Math.sign(slips[n - 12] ?? 0) !== Math.sign(slip)) mode = 'between';   // (thrown the other way: the hands get 0.1 s)
    else if (Math.abs(slip) > 0.3) { mode = 'slide'; ok = Math.sign(p.steer) === -Math.sign(slip) && Math.sign(slip) === Math.sign(p.kap); }
    else if (Math.abs(slip) < 0.03) { mode = 'forward'; if (Math.abs(p.kap) > 0.06) ok = Math.sign(p.steer) === Math.sign(p.kap); }
    else mode = 'between';
  }
  if (ok !== null) { tally[mode][ok ? 0 : 1]++; if (!ok) wrong.push(t.toFixed(2)); }
  if (Math.abs(slip) > 0.3) { slideT += 1 / 120; lastSlide = t; }
  peak = Math.max(peak, Math.abs(slip)); vmax = Math.max(vmax, p.speed);
  if (n) maxStep = Math.max(maxStep, Math.abs(p.steer - prevSteer) * 120);
  prevSteer = p.steer;
  if (t > lastSlide + 0.8 && lastSlide > 0) after = Math.max(after, Math.abs(slip));
  if (t > h0 + 0.7 && t < h1 - 0.3) { held[0] = Math.min(held[0], Math.abs(slip)); held[1] = Math.max(held[1], Math.abs(slip)); }
  log.push(`${t.toFixed(3)}  ${mode.padEnd(8)} ${p.v.toFixed(1).padStart(5)}   ${p.kap.toFixed(3).padStart(7)}    ${deg(slip)}     ${deg(p.steer)}    ${ok === null ? '-' : ok ? 'ok' : 'WRONG'}`);
}
if (process.argv[2]) fs.writeFileSync(process.argv[2], log.join('\n') + '\n');
const D2R = Math.PI / 180;
// (the held slide: the long arc from 0.7 s in, when the tail is out, to 0.3 s before the transition)
const heldOk = held[0] >= 25 * D2R && held[1] <= 40 * D2R && after < 3 * D2R;
const wheels = Object.values(tally).every(([g, w]) => g > 0 && w === 0);
console.log(`wheels: ${Object.entries(tally).map(([k, [g, w]]) => `${k} ${g} right ${w} wrong`).join(', ')}${wrong.length ? ' (wrong at t ' + wrong.slice(0, 6).join(', ') + ')' : ''}`);
console.log(`slide: ${slideT.toFixed(2)} s over 17 deg, peak ${(peak / D2R).toFixed(1)} deg, held ${(held[0] / D2R).toFixed(1)}..${(held[1] / D2R).toFixed(1)} deg (want 25..40), ${(after / D2R).toFixed(1)} deg left 0.8 s after the catch (want < 3): ${heldOk}; top speed ${vmax.toFixed(1)} m/s; the wheel turned at most ${(maxStep / D2R).toFixed(0)} deg/s; fitted to the song by ${(D.fit * 100 - 100).toFixed(1)} % of time`);
const pass = bad.length === 0 && home && wheels && heldOk;
console.log(pass ? 'HAN ROUTE pass' : 'HAN ROUTE FAIL');
if (!pass) process.exitCode = 1;
