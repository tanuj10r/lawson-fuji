// dev helper: the z-fighting detector.  Flickering, "pixelated" surfaces are two
// faces in one plane (or nearly): which wins each pixel changes with the least
// camera movement.  For every pose below the same frame is drawn 12 times with
// the camera moved 0.2 mm between each (time frozen: ?shots), and the pixels
// that change are counted (src/dev/zfight.js).  A regression check: it fails
// when any pose flickers more than --max pixels.
//
//   node scripts/_zfight.mjs [outdir]            every pose
//   node scripts/_zfight.mjs --poses train,hero  names or name prefixes
//   node scripts/_zfight.mjs --list              the poses' names
//   --frames 12 --step 0.0002 --thr 16           the jitter and the threshold (a channel's change, of 255)
//   --near            nudge the near plane instead of moving (no edge moves at all: for hunting)
//   --max 12          a pose fails over this many solid flickering pixels (in a 2 x 2 block: an area, not a line)
//   --masks all       save every pose's still and mask (default: only poses that changed)
//   --compare a.json  print this run beside an earlier report.json (before / after)
//
// Out: <outdir>/report.json, <pose>.jpg (the still), <pose>-mask.png (the frame
// dimmed; amber = changed once, magenta = flickered).  Starts its own dev
// server and Chrome (queued on the browser lock) and closes both however it ends.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { SHOT_SPOTS, ANIMALS } from '../src/config.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const flag = (k) => args.includes(`--${k}`);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const valued = new Set(['poses', 'frames', 'step', 'thr', 'max', 'masks', 'compare']);
const out = path.resolve(args.find((a, i) => !a.startsWith('--') && !valued.has((args[i - 1] ?? '').slice(2))) ?? path.join(ROOT, '.shots', 'zfight'));
const only = opt('poses', '').split(',').filter(Boolean);
const O = { frames: +opt('frames', 12), step: +opt('step', 0.0002), thr: +opt('thr', 16), mode: flag('move') ? 'move' : 'near' };
const MAX = +opt('max', 12);

/* ---------------------------------------------------------------- the poses */
const POSES = [];
/** A camera spot of src/config.js SHOT_SPOTS, at one of its looks (no staged pup). */
const spot = (name, look, as = null, over = {}) => {
  const s = SHOT_SPOTS.find((x) => x.name === name);
  if (!s) throw new Error(`no shot spot ${name}`);
  POSES.push({ name: as ?? name, shot: { hero: s.hero, look: look ?? s.looks[0], pos: s.pos, yaw: s.yaw, pitch: s.pitch, lift: s.lift, train: s.train, frame: s.frame, ...over } });
};
/** Standing at (x, z) in the world, looking toward (tx, tz). */
const stand = (name, [x, z], [tx, tz], { pitch = -0.1, look = 'day', frame = 'world', ...rest } = {}) =>
  POSES.push({ name, shot: { pos: [x, 0, z], yaw: Math.atan2(-(tx - x), -(tz - z)), pitch, look, frame, ...rest } });

// the famous views
spot('hero-1'); spot('hero-2'); spot('hero-3');

// the konbini: outside, and inside along a visit (door, aisle, shelves, coolers, the counter)
for (const n of ['close-lawson-front', 'close-lawson-side', 'close-forecourt', 'close-lawson-highlights', 'land-spawn-back',
  'store-door', 'store-aisle', 'store-shelf', 'store-onigiri', 'store-cooler', 'store-drinks', 'store-icecase', 'store-selfserve', 'store-counter', 'store-back', 'store-left']) spot(n);
spot('close-lawson-highlights', 'blue', 'close-lawson-highlights-blue');

// every stop of Hachi's tour: where it waits, the places it visits, the sounds it passes, looking on down the route
{
  const T = ANIMALS.guide.tour, seen = new Map();
  T.forEach((w, i) => {
    const key = w.id ?? w.visit ?? w.hear ?? (w.cross ? 'barrier' : null);
    if (!key) return;
    const k = seen.get(key) ?? 0;
    seen.set(key, k + 1);
    let j = i + 1;
    while (T[j] && Math.hypot(T[j].x - w.x, T[j].z - w.z) < 1) j++;
    const to = T[j] ?? T[i - 1];
    stand(`tour-${key}${k ? '-' + (k + 1) : ''}`, [w.x, w.z], [to.x, to.z], { pitch: -0.14 });
  });
}

// the three trains, standing at platform 1: inside each car, and outside along it
const INSIDE = { frame: 'core', pos: [-44.65, 0, 160.75], yaw: 0.62, pitch: 0 };
for (const t of ['poke', 'box', 'jr']) {
  const car = (name, i, at, to, look = 'day', doors = 'platform') =>
    POSES.push({ name: `train-${t}-${name}`, shot: { ...INSIDE, look, train: `${doors}:${t}` }, car: { i, at, to } });
  car('in-endwall', 0, [-5.5, 1.5, 0.2], [-9.7, 1.2, -0.3]);             // the wall between the cars, from the aisle
  car('in-endwall-close', 0, [-8.3, 1.5, 0.5], [-9.7, 1.3, -0.9]);      // its corner, at arm's length
  car('in-endwall-blue', 0, [-6.5, 1.5, -0.3], [-9.7, 1.4, 0.5], 'blue');
  car('in-gangway', 0, [-9.2, 1.5, 0], [-14, 1.2, 0.3]);               // through the bellows into the next car
  car('in-gangway-floor', 0, [-8.9, 1.5, 0.1], [-10.2, 0, 0]);         // the plate between the cars
  car('in-car2-endwall', 1, [5.5, 1.5, -0.2], [9.7, 1.2, 0.4]);
  car('in-car2-long', 1, [8.6, 1.5, 0.1], [-9, 1.2, 0]);
  car('in-cab-wall', 0, [4.6, 1.5, 0.1], [7.95, 1.3, -0.2]);           // the cab's back wall
  car('in-cab-close', 0, [6.6, 1.5, -0.4], [7.95, 1.4, 0.7]);
  car('in-side', 0, [0, 1.5, 0.4], [3, 1.0, -1.43]);                   // doors, windows, seats, at an angle
  car('in-side-shut', 0, [-0.4, 1.5, 0.5], [-3.4, 1.1, -1.43], 'day', 'platform-shut');
  car('in-far-side', 0, [1.2, 1.5, -0.4], [-2.4, 1.2, 1.43]);
  car('in-long', 0, [6.5, 1.5, 0], [-9.7, 1.3, 0]);                    // the whole car
  car('in-ceiling', 0, [1, 1.4, 0], [-4, 2.5, 0.3]);
  car('in-floor', 0, [1, 1.5, 0], [-2, 0, 0.5]);
  car('in-door-floor', 0, [2.4, 1.5, 0.2], [2.4, 0, -1.3]);            // the sill and the yellow line
  car('out-gap', 0, [-8.4, 1.6, -3.0], [-10.05, 1.2, -1.0]);           // the gap between the cars, from the platform
  car('out-gap-close', 0, [-10.05, 1.6, -2.4], [-10.05, 1.5, 0]);
  car('out-corner', 0, [-7.4, 1.6, -2.6], [-9.7, 1.5, -1.43]);
  car('out-door', 0, [1.2, 1.6, -3.2], [2.4, 1.0, -1.43], 'day', 'platform-shut');
  car('out-window', 0, [-1.4, 1.6, -2.8], [0.4, 1.6, -1.43]);
  car('out-cab-side', 0, [7.4, 1.6, -3.4], [9.2, 1.5, -1.43]);
  car('out-far-end', 1, [-6.5, 1.6, -2.7], [-9.7, 1.5, -1.0]);         // the tail car's cab, from the platform
  for (const n of ['beside-open', 'beside-shut', 'front', 'side', 'crossing', 'listen']) {
    const s = SHOT_SPOTS.find((x) => x.name === `train-jr-${n}`);
    POSES.push({ name: `train-${t}-${n}`, shot: { look: s.looks[0], pos: s.pos, yaw: s.yaw, pitch: s.pitch, frame: s.frame, train: s.train.replace('jr', t) } });
  }
}
spot('train-under');

// the platforms and the station
for (const n of ['platform-departures', 'platform-canopy', 'train-at-platform', 'crossing-path', 'station-concourse', 'station-gates', 'station-to-platform',
  'station-entrance', 'station-approach', 'station-plaza-clock', 'poster-station', 'town-plaza']) spot(n);
stand('platform-edge', [-40, 157.6], [-60, 158.6], { frame: 'core', pitch: -0.3, train: 'quiet' });      // the edge tiles and tactile strip, no train
stand('platform-edge-close', [-36, 157.2], [-38.5, 158.9], { frame: 'core', pitch: -0.7, train: 'quiet' });
stand('platform-track', [-52, 157.9], [-70, 161], { frame: 'core', pitch: -0.25, train: 'quiet' });      // the rails and sleepers from the edge

// the level crossing
for (const n of ['crossing-train', 'crossing-fence']) spot(n);
stand('crossing-ramp', [80, -128.6], [80, -141], { pitch: -0.42 });            // standing on the ramp (the deck and the rails)
stand('crossing-deck', [80.4, -133], [79, -137.5], { pitch: -0.7 });
stand('crossing-back', [80, -140.4], [80, -128], { pitch: -0.3 });

// the shopping street, ドンペン堂, the shrine
for (const n of ['town-spine-north', 'town-spine-shops', 'town-spine-night', 'close-street-spine', 'close-street-kerb', 'close-street-pole', 'close-facade-shop', 'close-facade-house',
  'donki-front', 'donki-entrance', 'donki-mascot', 'donki-goods', 'donki-street', 'donki-night',
  'shrine-approach', 'shrine-tunnel', 'shrine-hall', 'shrine-fox', 'shrine-back', 'town-shrine']) spot(n);

// Hachi's home, the mochi shop
for (const n of ['hachi-home', 'close-hachi-home']) spot(n);
stand('home-inside', [79.4, -146.6], [78.6, -150.5], { pitch: -0.3 });
stand('mochi-front', [39.2, 17.6], [39.2, 22.0], { pitch: -0.05 });
stand('mochi-close', [38.0, 19.6], [39.6, 22.4], { pitch: -0.2 });
stand('mochi-side', [43.5, 18.8], [39.6, 22.5], { pitch: 0.0 });

// the bench, the pond, the ryokan
for (const n of ['pond-bench', 'pond-fuji', 'pond-teahouse', 'slowlife-spot', 'slowlife-seated', 'qp-ryokan-lane', 'qp-ryokan-gate', 'qp-ryokan-engawa', 'qp-kominka', 'pond-rail']) spot(n);

// roads, car parks, the land
for (const n of ['town-main-west', 'town-main-east', 'town-lane-houses', 'town-lane-junction', 'town-coin-parking', 'town-apartment', 'town-park', 'close-house-wall',
  'junction-east', 'junction-north', 'junction-south', 'junction-walk', 'junction-tan', 'han-wide', 'land-track', 'land-gate', 'poster-gate',
  'close-land-bridge', 'close-land-stairs', 'qa-stairs-a', 'land-walk', 'land-river', 'paddy-lane', 'qp-walk-3']) spot(n);
stand('carpark-paint', [-21.7, 21.5], [-14, 26.5], { pitch: -0.35 });          // the car park's bays
stand('zebra-main', [-35, 9.2], [-35, 19], { pitch: -0.4 });                   // the main road's zebra underfoot
stand('zebra-spine', [50, -1.2], [50.6, -8], { pitch: -0.45 });
stand('main-shops-west', [-56, 15.5], [-58.4, 20.7], { pitch: 0.3 });           // the main road's shopfronts, from the kerb
stand('spine-signs', [50.5, -19], [46.4, -24.6], { pitch: 0.12 });              // the signposts at the megastore's corner

if (flag('list')) { for (const p of POSES) console.log(p.name); process.exit(0); }
const poses = POSES.filter((p) => !only.length || only.some((k) => p.name === k || p.name.startsWith(k)));
if (!poses.length) { console.error('no pose matches'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });

/* ------------------------------------------------- one browser at a time */
const BLOCK = '/tmp/lawson-browser.lock';
let mineB = false;
for (let k = 0; ; k++) { try { fs.mkdirSync(BLOCK); mineB = true; break; } catch { if (k % 6 === 0) console.log('  waiting for the browser lock'); await new Promise((r) => setTimeout(r, 10000)); } }
process.on('exit', () => { if (mineB) { try { fs.rmdirSync(BLOCK); } catch {} mineB = false; } });
const LOCK = path.join(os.tmpdir(), 'takemebacktojapan-shots.lock');
for (;;) {
  try { fs.mkdirSync(LOCK); fs.writeFileSync(path.join(LOCK, 'pid'), String(process.pid)); break; } catch {
    let pid = 0, alive = false;
    try { pid = +fs.readFileSync(path.join(LOCK, 'pid'), 'utf8'); } catch {}
    try { if (pid) { process.kill(pid, 0); alive = true; } } catch {}
    if (!alive) { fs.rmSync(LOCK, { recursive: true, force: true }); continue; }
    console.log(`  waiting for another run (pid ${pid})`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
const unlock = () => { try { if (+fs.readFileSync(path.join(LOCK, 'pid'), 'utf8') === process.pid) fs.rmSync(LOCK, { recursive: true, force: true }); } catch {} };
process.on('exit', unlock);

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: +process.env.PORT || 5194, strictPort: !!process.env.PORT, host: '127.0.0.1' } });
await server.listen();
const base = server.resolvedUrls.local[0];
const launch = ['--use-angle=metal', '--ignore-gpu-blocklist'];
let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: true, args: launch }); }
catch { browser = await chromium.launch({ headless: true, args: launch }); }
const close = async () => { await Promise.race([browser.close().then(() => server.close()), new Promise((r) => setTimeout(r, 8000))]).catch(() => {}); };
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await close(); process.exit(130); });

const report = { options: O, poses: {} };
let bad = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => console.log('  [page error]', e.message));
  await page.goto(`${base}?shots`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 150000, polling: 250 });
  const save = (file, data) => fs.writeFileSync(path.join(out, file), Buffer.from(data.split(',')[1], 'base64'));
  for (const p of poses) {
    let r;
    try { r = await page.evaluate(([pose, o]) => window.__zfight(pose, o), [p, O]); } catch (e) { r = { error: String(e).slice(0, 300) }; }
    if (r.error) { bad++; console.log(`FAIL ${p.name}: ${r.error}`); report.poses[p.name] = r; continue; }
    const { mask, still, ...row } = r;
    if (mask || opt('masks') === 'all') save(`${p.name}.jpg`, still);
    if (mask) save(`${p.name}-mask.png`, mask);
    else for (const f of [`${p.name}-mask.png`]) fs.rmSync(path.join(out, f), { force: true });
    report.poses[p.name] = row;
    const over = row.solid > MAX;
    if (over) bad++;
    console.log(`${over ? 'FAIL' : 'pass'} ${p.name.padEnd(30)} solid ${String(row.solid).padStart(6)}  flicker ${String(row.flicker).padStart(6)}  changed ${String(row.changed).padStart(6)}  per frame ${row.perFrame[0]}-${row.perFrame[1]}  regions ${row.regions}`);
    if (flag('verbose') || over) for (const b of row.boxes.slice(0, 3)) {
      if (!b.solid && !flag('verbose')) continue;
      console.log(`       box ${b.box.join(',')}  solid ${b.solid} flicker ${b.flicker} changed ${b.changed}`);
      for (const h of b.hits ?? []) console.log(`         ${h.d.toFixed(3)} m  ${h.what}  [${h.mat}]  at ${h.at.join(', ')}  n ${h.n?.join(',')}`);
    }
  }
} finally {
  await close();
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));

const cmp = opt('compare');
if (cmp) {
  const before = JSON.parse(fs.readFileSync(cmp, 'utf8')).poses;
  console.log('\n| pose | flicker before | after | solid before | after |\n|---|---:|---:|---:|---:|');
  for (const [name, a] of Object.entries(report.poses)) {
    const b = before[name];
    if (!b || a.error || b.error) continue;
    if (b.flicker || a.flicker) console.log(`| ${name} | ${b.flicker} | ${a.flicker} | ${b.solid ?? ''} | ${a.solid} |`);
  }
}
const rows = Object.values(report.poses).filter((r) => !r.error);
console.log(`\n${rows.length} poses: ${rows.reduce((s, r) => s + r.solid, 0)} solid, ${rows.reduce((s, r) => s + r.flicker, 0)} flickering pixels, ${rows.reduce((s, r) => s + r.changed, 0)} changed; ${bad} over the limit (${MAX} solid).  Saved to ${path.relative(ROOT, out) || out}/`);
process.exit(bad ? 1 : 0);
