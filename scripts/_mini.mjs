// dev helper (the phone build's mini town; docs/decisions/mobile-lite.md "Mobile v3"): stand the phone page and
// the desktop game at the same spots, save what each draws, and lay the pairs side by side in sheets.
//
//   node scripts/_mini.mjs <out dir> <job.json> [--only=mobile,desktop,sheets,walk] [--portrait] [--force]
//                          [--url=http://127.0.0.1:5195] [--desk=http://localhost:5178] [--q=tier=light]
//
// job.json: { "shots": [{ "name": "view", "x": 0, "z": 16.5, "yaw": 0, "pitch": 0.16, "look": "golden" }, ...] }
// World frame, the phone build's positions.  The desktop game (a dev server of main, ?shots) is drawn at the
// equivalent spot: a shot marked "south": true stands `dz` m further south there (config.js MOBILE.plan.dz).
// Desktop frames are kept (drawn again only with --force or when missing).  `walk`: the camera on a grid over
// everything the player can reach, eight ways round, as a montage per look.
// One browser at a time on this laptop: /tmp/lawson-browser.lock is taken first (retried every 10 s).
import { chromium } from 'playwright';
import fs from 'node:fs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)]; }));
const [out, jobFile] = args.filter((a) => !a.startsWith('--'));
const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
const only = new Set(String(flags.only ?? 'mobile,desktop,sheets').split(','));
const DZ = 32;
const W = Number(flags.w ?? 2556), H = Number(flags.h ?? 1179);
fs.mkdirSync(out, { recursive: true });

const LOCK = '/tmp/lawson-browser.lock';
let mine = false;
for (let i = 0; i < 180 && !mine; i++) {
  try { fs.mkdirSync(LOCK); mine = true; } catch { await new Promise((r) => setTimeout(r, 10000)); }
}
if (!mine) { console.error('browser lock busy'); process.exit(2); }
const unlock = () => { if (mine) { try { fs.rmdirSync(LOCK); } catch { /* gone */ } mine = false; } };
process.on('exit', unlock);
process.on('SIGINT', () => { unlock(); process.exit(130); });
process.on('SIGTERM', () => { unlock(); process.exit(143); });

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const report = { shots: {} };
const rec = (name) => (report.shots[name] ??= {});
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
try {
  /* ------------------------------ the phone page ------------------------------ */
  if (only.has('mobile') || only.has('walk') || only.has('probe') || only.has('map')) {
    const portrait = !!flags.portrait;
    const vp = portrait ? { width: 393, height: 852 } : { width: 852, height: 393 };
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: Number(flags.dpr ?? 3), isMobile: true, hasTouch: true, userAgent: IPHONE });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    const t0 = Date.now();
    await page.goto((flags.url ?? 'http://127.0.0.1:5195') + '/m.html?stats' + (flags.q ? '&' + flags.q : ''), { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForFunction(() => document.getElementById('boot')?.classList.contains('ready') && window.__m, null, { timeout: 240000 });
    report.load = await page.evaluate(() => ({ marks: window.__m.marks, stages: window.__m.diag.stages, lite: window.__lite, tier: window.__m.tier, scale: window.__m.scale, census: window.__m.census(), lots: window.__m.world.core.lots.length }));
    report.wall = Date.now() - t0;
    await page.addStyleTag({ content: '#boot, #gate, .scrim, .m-hud, #hachi-card, #hud, .hud { display: none !important; }' });
    if (only.has('mobile')) {
      const sfx = portrait ? '.p' : '.m';
      for (const s of job.shots) {
        if (s.desktopOnly) continue;
        const go = { x: s.x, z: s.z, yaw: s.yaw ?? 0, pitch: s.pitch ?? 0, look: s.look ?? 'golden', lift: s.lift, train: s.train, trainX: s.trainX };
        const first = await page.evaluate((g) => window.__m.goto(g), go);
        // (what streamed in uploads as it is drawn: a second draw a moment later shows it, and is the steady state)
        await page.waitForTimeout(150);
        const info = await page.evaluate((g) => window.__m.goto(g), go);
        await (await page.$('#view')).screenshot({ path: `${out}/${s.name}${sfx}.jpg`, type: 'jpeg', quality: 88 });
        Object.assign(rec(s.name), { [portrait ? 'portrait' : 'mobile']: info, gpuFirst: first.gpu });
      }
    }
    if (only.has('map')) {
      // the plan as the game's own town map draws it
      const u = await page.evaluate(() => { const M = window.__m; M.goto({ x: 0, z: 16.5, yaw: 0 }); (M.minimap ?? M.shell.minimap).setFull(true, M.player.pos, 0); return document.querySelector('.fullmap canvas').toDataURL('image/png'); });
      fs.writeFileSync(`${out}/plan-map.png`, Buffer.from(u.split(',')[1], 'base64'));
      await page.evaluate(() => (window.__m.minimap ?? window.__m.shell.minimap).setFull(false));
    }
    if (flags.eval) report.eval = await page.evaluate(fs.readFileSync(flags.eval, 'utf8'));
    if (only.has('walk')) {
      const looks = String(flags.looks ?? 'golden').split(',');
      for (const look of looks) {
        const r = await page.evaluate(async ([look, step, tile]) => window.__m.walkSheet({ look, step, tile }), [look, Number(flags.step ?? 14), Number(flags.tile ?? 284)]);
        r.sheets.forEach((u, i) => fs.writeFileSync(`${out}/walk-${look}-${i + 1}.jpg`, Buffer.from(u.split(',')[1], 'base64')));
        report['walk-' + look] = { points: r.points, reach: r.reach, worst: r.worst };
      }
    }
    await ctx.close();
  }
  /* ------------------------------ the desktop game ------------------------------ */
  if (only.has('desktop')) {
    const want = job.shots.filter((s) => !s.mobileOnly && (flags.force || !fs.existsSync(`${out}/${s.name}.d.jpg`)));
    if (want.length) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      page.on('pageerror', (e) => errs.push('desktop: ' + String(e)));
      await page.goto((flags.desk ?? 'http://localhost:5178') + '/?shots', { waitUntil: 'domcontentloaded', timeout: 240000 });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
      for (const s of want) {
        const o = { pos: [s.dx ?? s.x, 0, (s.dz ?? s.z) - (s.south ? DZ : 0)], yaw: s.yaw ?? 0, pitch: s.pitch ?? 0, look: s.look ?? 'golden', png: false, quality: 0.9, returnData: true, scale: 1 };
        if (s.train) o.train = s.train;
        if (s.lift) o.lift = s.lift;
        if (s.trainX) await page.evaluate(([set, x]) => { const S = window.__scene.world.line.local.service; S.stage(set ? 'crossing' : 'approach'); S.runs[set].x = x; S.update(1e-4); }, s.trainX);
        const r = await page.evaluate(([n, o, W, H]) => window.__shot(n, W, H, o), [s.name, o, W, H]);
        fs.writeFileSync(`${out}/${s.name}.d.jpg`, Buffer.from(r.data.split(',')[1], 'base64'));
        rec(s.name).desktop = await page.evaluate(() => window.__frameInfo);
      }
      await page.close();
    }
  }
  /* ------------------------------ side by side ------------------------------ */
  if (only.has('sheets')) {
    const page = await browser.newPage();
    const per = Number(flags.per ?? 3);
    const sfx = flags.portrait ? '.p' : '.m';
    const pairs = job.shots.filter((s) => fs.existsSync(`${out}/${s.name}${sfx}.jpg`));
    const b64 = (f) => (fs.existsSync(f) ? 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64') : null);
    for (let k = 0, n = 1; k < pairs.length; k += per, n++) {
      const rows = pairs.slice(k, k + per).map((s) => [s.name + (s.note ? '  ·  ' + s.note : ''), b64(`${out}/${s.name}${sfx}.jpg`), b64(`${out}/${s.name}.d.jpg`)]);
      const url = await page.evaluate(async (rows) => {
        const load = (s) => (s ? new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; }) : null);
        const L = [];
        for (const [, a, b] of rows) L.push([await load(a), await load(b)]);
        const w = 1278, h = Math.round(w * L[0][0].height / L[0][0].width), gap = 12, top = 34;
        const cv = document.createElement('canvas'); cv.width = w * 2 + gap; cv.height = (h + top) * rows.length;
        const c = cv.getContext('2d'); c.fillStyle = '#15131c'; c.fillRect(0, 0, cv.width, cv.height);
        rows.forEach(([name], i) => {
          const y = i * (h + top);
          c.fillStyle = '#fff'; c.font = 'bold 22px sans-serif';
          c.fillText(name + '    PHONE (left)', 8, y + 24); c.fillText('DESKTOP (right)', w + gap + 8, y + 24);
          c.drawImage(L[i][0], 0, y + top, w, h);
          if (L[i][1]) c.drawImage(L[i][1], w + gap, y + top, w, h);
        });
        return cv.toDataURL('image/jpeg', 0.86);
      }, rows);
      fs.writeFileSync(`${out}/${job.sheet ?? 'sheet'}${flags.portrait ? '-portrait' : ''}-${String(n).padStart(2, '0')}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
    }
    await page.close();
  }
} finally {
  await browser.close();
  unlock();
}
if (errs.length) report.errors = [...new Set(errs)].slice(0, 12);
const rf = `${out}/${job.sheet ?? 'report'}${flags.portrait ? '.p' : ''}.report.json`;
let old = {};
try { old = JSON.parse(fs.readFileSync(rf, 'utf8')); } catch { /* first */ }
fs.writeFileSync(rf, JSON.stringify({ ...old, ...report, shots: { ...(old.shots ?? {}), ...report.shots } }, null, 1));
console.log(JSON.stringify(report));
