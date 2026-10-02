// dev helper: the z-fighting detector on the phone page (scripts/_zfight.mjs --phone; docs/decisions/mobile-lite.md,
// "Mobile v3: budget").  The phone's town is batched its own way (mobile/town.js, lite.js: other cells, other
// atlases, folded groups), so its seams are checked on its own page: every stop of Hachi's tour over the mini
// town and the places round them, each drawn 12 times with the near plane nudged between (no edge moves: only
// faces that share a plane change), the pixels that flip back and forth counted in 2 x 2 blocks.
//
//   node scripts/_zfight.mjs --phone [outdir] [--url http://127.0.0.1:5195] [--poses tour,plaza] [--max 12] [--list]
//
// Out: <outdir>/report.json, and for every pose over the limit <pose>.jpg and <pose>-mask.png (magenta: flickers),
// with what a ray through the worst patch hits (two faces a few mm apart are the pair).  Without --url it starts
// its own dev server (PORT, default 5195) in the phone build's mode and closes it.  One browser at a time.
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import '../src/mobile/plan.js';                       // the mini town's plan: the tour below is the phone's
import { ANIMALS } from '../src/config.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2).filter((a) => a !== '--phone');
const flag = (k) => args.includes(`--${k}`);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const valued = new Set(["poses", "max", "url", "frames", "thr", "q"]);
const out = path.resolve(args.find((a, i) => !a.startsWith('--') && !valued.has((args[i - 1] ?? '').slice(2))) ?? path.join(ROOT, '.shots', 'zfight-phone'));
const only = opt('poses', '').split(',').filter(Boolean);
const MAX = +opt('max', 12);
/* What is left on the phone page (2026-10-02), a little over what each measures: far shopfronts and roofs, as on the
 * desktop (scripts/_zfight.mjs KNOWN). */
const KNOWN = {
  'tour-crossing': 45,   // (a roof's edge on a house beyond the line, 19 m off: the desktop's own allowance)
  'tour-walk0': 90,      // (the far pavement's kerb where the bridge road cuts it, a 4 cm strip 11 m off: 78; 4 on the desktop)
};

const POSES = [];
const stand = (name, [x, z], [tx, tz], { pitch = -0.1, train } = {}) => POSES.push({ name, x, z, yaw: Math.atan2(-(tx - x), -(tz - z)), pitch, train });
const at = (name, x, z, yaw, pitch, train) => POSES.push({ name, x, z, yaw, pitch, train });
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
for (const p of [
  ['famous-view', 0, 16.5, 0, 0.16], ['turned-round', 0, 16.5, 3.1416, 0.03], ['konbini-door', -2.3, 2.3, 0, 0], ['zebra', -35, 20, 0.2, 0.05], ['han-bay', -14, 21.5, 1.9, -0.02],
  ['mochi', 39.2, 12.5, 3.1416, 0.05], ['mochi-close', 39.2, 18.6, 3.1416, 0], ['spine-mouth', 46.2, 4.2, 0, 0.03], ['spine-mid', 46.6, -34.3, -0.94, 0.02], ['donpen', 46.2, -39.4, -1.5708, 0.08],
  ['spine-back', 50, -60, 3.1416, 0.03], ['plaza', 50, -65.8, 0, 0.05], ['plaza-clock', 50, -74.3, -0.94, 0.08], ['station-entrance', 41.8, -76.8, -0.32, 0.1], ['plaza-back', 50, -84, 3.1416, 0.04],
  ['platform', 29, -97.5, -1.5708, 0.03, 'platform'], ['platform-train', 28, -107.1, -1.94, 0.03, 'platform'], ['platform-canopy', 56, -107.5, 1.5708, 0.06, 'platform'],
  ['crossing', 80.6, -90.3, 0, 0.03, 'crossing'], ['crossing-west', 80, -96.6, -1.2, 0.02, 'crossing'], ['crossing-east', 80, -96.6, 1.2, 0.02, 'approach'], ['over-crossing', 80, -108, 0, 0],
  ['crossing-lane', 80, -80, 3.1416, 0.03], ['hachi-gate', 80, -111.5, 0, -0.05], ['shrine', -13, -49.8, 0, 0.09], ['shrine-tunnel', -13, -60.5, 0, 0.05], ['shrine-hall', -7.4, -63, 0.79, 0.13],
  ['shrine-out', -13.1, -64.5, 3.18, 0.03], ['lane-shrine', 20, -51.7, 1.5708, 0.03], ['bench', -73, -42.3, -0.01, 0.11], ['bench-behind', -74, -36, 0.1, -0.03], ['pond-gate', -50, -52.3, 1.5708, 0.03],
  ['pond', -62, -70.3, 0.6, 0.02], ['paddies', -50, -17.3, 1.5708, 0], ['lane-behind-konbini', 25.6, -34.3, 0, 0.02], ['lane-houses', -52, -51.7, -1.5708, 0.04],
  ['lane-112-east', -40, -84.3, 1.5708, 0.02], ['lane-112-west', 10, -84.3, -1.5708, 0.02], ['lane-0-end', 0, -70, 0, 0.02], ['west-fence', 90, -52.3, -1.5708, 0.02],
  ['river', 0, 37.5, 3.1416, 0], ['junction', -30, 6, 3.1416, 0.03], ['bridge', -30, 46, 3.1416, 0], ['deer-gate', -30, 60, 3.1416, 0.03], ['main-east-end', 112, 13.85, -1.5708, 0.02], ['main-west-end', -112, 13.85, 1.5708, 0.02],
]) at(...p);
if (flag('list')) { for (const p of POSES) console.log(p.name); process.exit(0); }
const poses = POSES.filter((p) => !only.length || only.some((k) => p.name === k || p.name.startsWith(k)));
if (!poses.length) { console.error('no pose matches'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });

const LOCK = '/tmp/lawson-browser.lock';
let mine = false;
for (let k = 0; !mine; k++) { try { fs.mkdirSync(LOCK); mine = true; } catch { if (k % 6 === 0) console.log('  waiting for the browser lock'); await new Promise((r) => setTimeout(r, 10000)); } }
const unlock = () => { if (mine) { try { fs.rmdirSync(LOCK); } catch { /* gone */ } mine = false; } };
process.on('exit', unlock);

let server = null, base = opt('url', '');
if (!base) {
  server = await createServer({ root: ROOT, mode: 'mobile', logLevel: 'error', server: { port: +process.env.PORT || 5195, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  base = server.resolvedUrls.local[0].replace(/\/$/, '');
}
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const close = async () => { await Promise.race([browser.close().then(() => server?.close()), new Promise((r) => setTimeout(r, 8000))]).catch(() => {}); unlock(); };
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await close(); process.exit(130); });

const report = { poses: {} };
let bad = 0;
try {
  // (an iPhone 15 on its side at half its pixels: a seam is a matter of geometry, and 12 readbacks of 3 Mpx a pose are not)
  const ctx = await browser.newContext({
    viewport: { width: 852, height: 393 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [page error]', e.message));
  await page.goto(`${base}/m.html?stats${opt("q", "") ? "&" + opt("q", "") : ""}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => document.getElementById('boot')?.classList.contains('ready') && window.__m, null, { timeout: 150000 });
  await page.addStyleTag({ content: '#boot, #gate, .scrim, .m-hud, #hachi-card, #hud, .hud { display: none !important; }' });
  const save = (file, data) => fs.writeFileSync(path.join(out, file), Buffer.from(data.split(',')[1], 'base64'));
  for (const p of poses) {
    const r = await page.evaluate(async ([p, O]) => {
      const M = window.__m, THREE = M.THREE, canvas = M.renderer.domElement, camera = M.camera;
      const go = { x: p.x, z: p.z, yaw: p.yaw, pitch: p.pitch, look: 'day', train: p.train };
      M.goto(go);
      await new Promise((r) => setTimeout(r, 350));
      M.goto({ ...go, train: undefined });
      const W = canvas.width, H = canvas.height, n = W * H;
      const off = document.createElement('canvas'); off.width = W; off.height = H;
      const c = off.getContext('2d', { willReadFrequently: true });
      const trans = new Uint8Array(n);
      const near0 = camera.near;
      let prev = null, first = null;
      for (let k = 0; k < O.frames; k++) {
        camera.near = near0 * (1 + k * 2e-4);
        camera.updateProjectionMatrix();
        M.pipeline.render();
        c.drawImage(canvas, 0, 0);
        const cur = c.getImageData(0, 0, W, H).data;
        if (prev) for (let q = 0, i = 0; q < n; q++, i += 4) if (Math.max(Math.abs(cur[i] - prev[i]), Math.abs(cur[i + 1] - prev[i + 1]), Math.abs(cur[i + 2] - prev[i + 2])) > O.thr) trans[q]++;
        if (!first) first = off.toDataURL('image/jpeg', 0.6);
        prev = cur;
      }
      camera.near = near0; camera.updateProjectionMatrix();
      const blk = new Uint8Array(n);
      for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
        const q = y * W + x;
        if (trans[q] >= 2 && trans[q + 1] >= 2 && trans[q + W] >= 2 && trans[q + W + 1] >= 2) blk[q] = blk[q + 1] = blk[q + W] = blk[q + W + 1] = 1;
      }
      let solid = 0, flicker = 0, sx = 0, sy = 0;
      for (let q = 0; q < n; q++) { if (trans[q] >= 2) flicker++; if (blk[q]) { solid++; sx += q % W; sy += (q / W) | 0; } }
      const row = { solid, flicker };
      if (solid > O.max) {
        // where: rays through a few of the flickering pixels, and the faces each meets within 3 cm of its first
        // (two faces a few mm apart are the pair that fights)
        const solids = [];
        for (let q = 0; q < n; q++) if (blk[q]) solids.push(q);
        const ray = new THREE.Raycaster();
        const list = [];
        M.scene.traverseVisible((o) => { if (o.isMesh && !o.isInstancedMesh && o.geometry?.attributes?.position?.array?.length) list.push(o); });
        const seen = new Set();
        row.hits = [];
        for (let k = 0; k < 7; k++) {
          const q = solids[Math.floor((k + 0.5) / 7 * solids.length)], px = q % W, py = (q / W) | 0;
          ray.setFromCamera(new THREE.Vector2((px + 0.5) / W * 2 - 1, 1 - (py + 0.5) / H * 2), camera);
          const hits = ray.intersectObjects(list, false);
          if (!hits.length) continue;
          const near = hits.filter((h) => h.distance - hits[0].distance < 0.03);
          const line = near.map((h) => {
            const chain = []; for (let a = h.object; a && chain.length < 3; a = a.parent) if (a.name) chain.push(a.name);
            const m = h.object.material, nw = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : null;
            let col = m?.color?.getHexString?.() ?? '';
            const ca = h.object.geometry.attributes.color;
            if (ca && h.face) col = new THREE.Color(ca.getX(h.face.a), ca.getY(h.face.a), ca.getZ(h.face.a)).getHexString() + ' vc';
            return `${h.distance.toFixed(3)} m ${chain.join('<')} [${m?.type?.replace(/Mesh|Material/g, '')} #${col}${m?.map ? ' map' : ''}] n ${nw ? nw.toArray().map((v) => +v.toFixed(2)).join(',') : '?'}`;
          });
          const key = line.map((l) => l.replace(/^[\d.]+ m /, '')).join(' + ') + ' @' + hits[0].point.toArray().map((v) => Math.round(v)).join(',');
          if (seen.has(key)) continue;
          seen.add(key);
          row.hits.push({ px: [px, py], p: hits[0].point.toArray().map((v) => +v.toFixed(2)), faces: line });
        }
        const img = c.getImageData(0, 0, W, H), d = img.data;
        for (let q = 0, i = 0; q < n; q++, i += 4) {
          if (blk[q]) { d[i] = 255; d[i + 1] = 0; d[i + 2] = 255; } else if (trans[q]) { d[i] = 255; d[i + 1] = 180; d[i + 2] = 0; } else { d[i] *= 0.45; d[i + 1] *= 0.45; d[i + 2] *= 0.45; }
        }
        c.putImageData(img, 0, 0);
        row.mask = off.toDataURL('image/png');
        row.still = first;
      }
      return row;
    }, [p, { frames: +opt('frames', 12), thr: +opt('thr', 16), max: Math.max(MAX, KNOWN[p.name] ?? 0) }]);
    const { mask, still, ...row } = r;
    if (mask) { save(`${p.name}.jpg`, still); save(`${p.name}-mask.png`, mask); }
    report.poses[p.name] = row;
    const over = row.solid > Math.max(MAX, KNOWN[p.name] ?? 0);
    if (over) bad++;
    console.log(`${over ? 'FAIL' : 'pass'} ${p.name.padEnd(24)} solid ${String(row.solid).padStart(6)}  flicker ${String(row.flicker).padStart(6)}`);
    if (over) for (const h of row.hits ?? []) { console.log(`       pixel ${h.px.join(',')}  at ${h.p.join(', ')}`); for (const f of h.faces) console.log(`         ${f}`); }
  }
  await ctx.close();
} finally {
  await close();
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
const rows = Object.values(report.poses);
console.log(`\n${rows.length} poses on the phone page: ${rows.reduce((s, r) => s + r.solid, 0)} solid, ${rows.reduce((s, r) => s + r.flicker, 0)} flickering pixels; ${bad} over the limit (${MAX}, or a pose's own)`);
process.exit(bad ? 1 : 0);
