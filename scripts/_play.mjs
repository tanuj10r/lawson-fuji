// dev helper: the whole merged game, played headless, experience by experience.
//
//   node scripts/_play.mjs [outdir]
//
// The real loop runs (not the frozen shots mode): the player is marked as
// locked, stood near each experience's spot facing it, and E is pressed
// through the game's own key handler.  Checks: runtime errors, the prompt
// and every toast in English, each experience doing its thing, the sound
// zones (which play where, and where two tracks overlap), the minimap's
// diamonds on both maps.  Frames of each go to outdir.
//
// Starts its own dev server and Chrome (queued on the shots lock) and closes
// both however it ends.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const out = path.resolve(args.find((a) => !a.startsWith('--')) ?? path.join(ROOT, '.shots', 'play'));
fs.mkdirSync(out, { recursive: true });

const LOCK = path.join(os.tmpdir(), 'lawson-fuji-shots.lock');
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

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5193, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const base = server.resolvedUrls.local[0];
const flags = ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: true, args: flags }); }
catch { browser = await chromium.launch({ headless: true, args: flags }); }
const close = async () => { await Promise.race([browser.close().then(() => server.close()), new Promise((r) => setTimeout(r, 8000))]).catch(() => {}); };
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await close(); process.exit(130); });

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(180000);
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });

let bad = 0;
const save = (name, data) => { if (data) fs.writeFileSync(path.join(out, name + '.jpg'), Buffer.from(data.split(',')[1], 'base64')); };
async function step(name, fn, check, arg) {
  let r;
  try { r = await page.evaluate(fn, arg); } catch (e) { r = { error: String(e).slice(0, 400) }; }
  for (const [k, v] of Object.entries(r ?? {})) if (typeof v === 'string' && v.startsWith('data:image')) { save(`${name}-${k}`, v); delete r[k]; }
  const ok = !r?.error && (check ? !!check(r) : true);
  if (!ok) bad++;
  console.log(ok ? 'pass' : 'FAIL', name, JSON.stringify(r));
  return r;
}
const english = (x) => !!x && !/[぀-ヿ一-鿿]/.test(x);

try {
  await page.goto(base);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 150000, polling: 250 });

  /* the harness, in the page */
  await page.evaluate(() => {
    const { player, hud, sound, world, camera } = window.__scene;
    window.__toasts = [];
    const flash = hud.flash.bind(hud);
    hud.flash = (t, ...a) => { window.__toasts.push(t); return flash(t, ...a); };
    sound.start();
    player.locked = true;          // no pointer lock headless: the loop runs as if we had it
    window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__prompt = () => { const p = document.querySelector('.hud .prompt'); return p?.classList.contains('on') ? p.textContent : ''; };
    /** stand `d` m from a world spot, facing it, somewhere not inside a collider */
    window.__standBy = (sx, sz, d = 2.0, aimY = 1.0, prefer = null) => {
      const R = 0.34;
      const blocked = (x, z) => world.colliders.some((c) => c.top > world.heightAt(x, z) + 0.45
        && x > c.x0 - R && x < c.x1 + R && z > c.z0 - R && z < c.z1 + R);
      const angs = [];
      for (let k = 0; k < 16; k++) angs.push((k / 16) * Math.PI * 2);
      if (prefer !== null) angs.unshift(prefer);
      for (const a of angs) {
        const x = sx + Math.sin(a) * d, z = sz + Math.cos(a) * d;
        if (blocked(x, z)) continue;
        player.pos.set(x, world.heightAt(x, z), z);
        player.vel.set(0, 0, 0);
        const dx = sx - x, dz = sz - z;
        player.yaw = Math.atan2(-dx, -dz);
        const eye = player.pos.y + 1.6;
        player.pitch = Math.atan2(world.heightAt(sx, sz) + aimY - eye, d);
        return { x: +x.toFixed(2), z: +z.toFixed(2) };
      }
      return null;
    };
    window.__press = (code) => {
      // on the document: it bubbles to the window, so both listeners hear it once
      document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    };
    window.__frame = async (W = 1280, H = 720) => {
      const r = await window.__shot('p', W, H, { returnData: true, png: false, quality: 0.85 });
      return r.data;
    };
    /** what's drawn at a pixel of a 1280x720 frame (the camera as the last frame left it) */
    window.__what = (px, py) => {
      const { scene, THREE } = window.__scene;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(px / 640 - 1, 1 - py / 360), camera);
      return ray.intersectObjects(scene.children, true).slice(0, 3).map((h) => {
        const chain = []; let q = h.object; while (q && chain.length < 4) { chain.push(q.name || q.type); q = q.parent; }
        return `${chain.join('<')} d${h.distance.toFixed(1)}${h.instanceId !== undefined ? ' #' + h.instanceId : ''}`;
      });
    };
    window.__spotOf = (id) => world.experiences.list.find((e) => e.id === id) ?? world.lawson.experiences.list.find((e) => e.id === id);
    window.__audible = () => (window.__soundZones ?? []).map((z) => {
      const d = Math.hypot(z.x - camera.position.x, z.z - camera.position.z);
      return { name: z.name, d: +d.toFixed(1), on: d < z.far };
    }).filter((z) => z.on).map((z) => `${z.name}@${z.d}`);
  });
  // the key handler for E sits on the document in core/player.js; check it's there
  await step('00-list', () => ({
    spots: [...window.__scene.world.experiences.list, ...window.__scene.world.lawson.experiences.list].map((e) => `${e.id}(${e.x.toFixed(1)},${e.z.toFixed(1)})`),
    zones: (window.__soundZones ?? []).map((z) => `${z.name}(${z.x.toFixed(1)},${z.z.toFixed(1)}) near ${z.near} far ${z.far} lvl ${z.level}`),
  }), (r) => r.spots.length >= 7 && r.zones.length >= 5);

  /* ---- sound: where do two zones' tracks play at once? ---- */
  await step('01-sound-overlap', () => {
    const Z = window.__soundZones, W = window.__scene.world;
    const music = new Set(['han-drift', 'donki-theme', 'rural-flute']);
    const pairs = {};
    const b = W.bounds;
    for (let x = b.x0; x < b.x1; x += 2) {
      for (let z = b.z0; z < b.z1; z += 2) {
        const on = Z.filter((q) => Math.hypot(q.x - x, q.z - z) < q.far);
        for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) {
          const k = [on[i].name, on[j].name].sort().join(' + ');
          pairs[k] = (pairs[k] ?? 0) + 4;
        }
      }
    }
    const musicPairs = Object.entries(pairs).filter(([k]) => k.split(' + ').every((n) => music.has(n)));
    // at the famous views, and inside the store
    const at = (x, z) => Z.filter((q) => Math.hypot(q.x - x, q.z - z) < q.far).map((q) => `${q.name}@${Math.hypot(q.x - x, q.z - z).toFixed(1)}`);
    return { pairsM2: pairs, musicOverlapM2: Object.fromEntries(musicPairs), famous: at(0, 16.5), door: at(-2.3, 1), counter: at(3.4, -2.2) };
  }, (r) => Object.keys(r.musicOverlapM2).length === 0);

  /* ---- the famous view first: the opening shot ---- */
  await step('02-spawn', async () => {
    window.__scene.enterHero('morning');
    await window.__wait(600);
    return { prompt: window.__prompt(), audible: window.__audible(), frame: await window.__frame() };
  }, (r) => r.prompt === '');

  /* ---- each experience: stand by it, check the prompt, press E ---- */
  const visit = async (id, opts = {}) => page.evaluate(async ({ id, opts }) => {
    const { player } = window.__scene;
    const s = window.__spotOf(id);
    if (!s) return { error: `no spot ${id}` };
    const stood = window.__standBy(s.x, s.z, opts.d ?? 2.2, opts.aimY ?? 0.9, opts.prefer ?? null);
    await window.__wait(500);
    const prompt = window.__prompt();
    const hovered = player.hovered?.label ?? null;
    window.__toasts.length = 0;
    return { stood, prompt, hovered, audible: window.__audible() };
  }, { id, opts });

  for (const id of ['konbini', 'han', 'shrine', 'station', 'train', 'donki', 'slowlife']) {
    const r = await visit(id, id === 'han' ? { d: 1.9 } : {});
    const ok = r && !r.error && /^E  ·  /.test(r.prompt) && english(r.prompt);
    if (!ok) bad++;
    console.log(ok ? 'pass' : 'FAIL', `10-prompt-${id}`, JSON.stringify(r));
  }

  // the konbini's spot: says what's inside
  await step('20-konbini', async () => {
    const { player } = window.__scene;
    const s = window.__spotOf('konbini');
    window.__standBy(s.x, s.z, 2.2, 0.9, 0);
    await window.__wait(400);
    window.__press('KeyE');
    await window.__wait(300);
    return { toasts: window.__toasts.slice(), prompt: window.__prompt(), frame: await window.__frame() };
  }, (r) => r.toasts.length && r.toasts.every(english));

  // Han: E starts the show; the car leaves the bay and comes back
  await step('21-han', async () => {
    const s = window.__spotOf('han');
    window.__standBy(s.x, s.z, 2.0, 0.9);
    await window.__wait(400);
    const st0 = window.__han.state();
    window.__press('KeyE');
    await window.__wait(1500);
    const st1 = window.__han.state();
    await window.__wait(5500);
    const st2 = window.__han.state();
    const audible = window.__audible();
    const mid = await window.__frame();
    await window.__wait(12500);
    const st3 = window.__han.state();
    return { st0, st1, st2, st3, audible, toasts: window.__toasts.slice(), mid };
  }, (r) => r.st1.run && Math.hypot(r.st2.x - r.st0.x, r.st2.z - r.st0.z) > 3 && Math.hypot(r.st3.x - r.st0.x, r.st3.z - r.st0.z) < 0.3 && !r.st3.run);

  // the shrine: E, a bow and a prayer, then the view is handed back
  await step('22-shrine', async () => {
    const { player } = window.__scene;
    const s = window.__spotOf('shrine');
    window.__standBy(s.x, s.z, 2.0, 0.9);
    await window.__wait(400);
    const before = { yaw: player.yaw, pitch: player.pitch };
    window.__press('KeyE');
    await window.__wait(1200);
    const during = { suspended: player.suspended, pitch: +player.pitch.toFixed(2) };
    const frame = await window.__frame();
    await window.__wait(14000);
    const after = { suspended: player.suspended, pitch: +player.pitch.toFixed(2) };
    return { before, during, after, toasts: window.__toasts.slice(), frame };
  }, (r) => r.during.suspended && !r.after.suspended && r.toasts.every(english));

  // the station: the master bows and says welcome
  await step('23-station', async () => {
    const s = window.__spotOf('station');
    window.__standBy(s.x, s.z, 2.0, 0.9);
    await window.__wait(400);
    window.__press('KeyE');
    await window.__wait(800);
    return { toasts: window.__toasts.slice(), frame: await window.__frame() };
  }, (r) => r.toasts.some((t) => /Station master/.test(t)) && r.toasts.every(english));

  // the train: no train -> the note; a train in -> aboard; the chime -> put back on the platform
  await step('24-train', async () => {
    const { player, world } = window.__scene;
    const s = window.__spotOf('train');
    const L = world.line;
    const svc = L.service ?? L.local?.service;
    svc.stage('idle');
    window.__standBy(s.x, s.z, 2.0, 0.9);
    await window.__wait(400);
    window.__press('KeyE');
    await window.__wait(300);
    const noTrain = window.__toasts.slice();
    svc.stage('platform');
    await window.__wait(1500);
    window.__standBy(s.x, s.z, 2.0, 0.9);
    await window.__wait(400);
    const prompt = window.__prompt();
    window.__toasts.length = 0;
    window.__press('KeyE');
    await window.__wait(1500);
    const aboard = { x: +player.pos.x.toFixed(2), z: +player.pos.z.toFixed(2) };
    const frame = await window.__frame();
    // wait for the chime and the step-off
    let t = 0;
    const r0 = svc.runs[0];
    while (t < 40000 && r0.phase === 'dwell') { await window.__wait(500); t += 500; }
    await window.__wait(3000);
    const after = { x: +player.pos.x.toFixed(2), z: +player.pos.z.toFixed(2), phase: r0.phase };
    return { noTrain, prompt, aboard, after, toasts: window.__toasts.slice(), waited: t };
  }, (r) => r.noTrain.length && /Board the train/.test(r.prompt) && (Math.abs(r.aboard.z - r.after.z) > 1) && r.toasts.every(english));

  // the megastore: E, Pen-chan dances and the confetti falls
  await step('25-donki', async () => {
    const s = window.__spotOf('donki');
    window.__standBy(s.x, s.z, 2.4, 1.2);
    await window.__wait(400);
    window.__press('KeyE');
    await window.__wait(1200);
    const frame = await window.__frame();
    return { toasts: window.__toasts.slice(), audible: window.__audible(), frame };
  });

  // slow life: sit, the flute comes up; any key stands you up
  await step('26-slowlife', async () => {
    const { player } = window.__scene;
    const s = window.__spotOf('slowlife');
    window.__standBy(s.x, s.z, 2.0, 0.5);
    await window.__wait(400);
    window.__press('KeyE');
    await window.__wait(2500);
    const seated = player.seated;
    const frame = await window.__frame();
    const what = { a: window.__what(420, 200), b: window.__what(1110, 60), c: window.__what(560, 420) };
    window.__press('KeyW');
    await window.__wait(2500);
    return { what, seated, standing: !player.seat, toasts: window.__toasts.slice(), audible: window.__audible(), frame };
  }, (r) => r.seated && r.standing && r.toasts.every(english));

  // the Osaka posters are framed by shots.mjs (poster-station, poster-gate)

  // every spot's glow and marker from 4.5 m: nothing under things, in walls or overlapping
  await step('28-rings', async () => {
    const { world } = window.__scene;
    const out = {};
    for (const e of [...world.experiences.list, ...world.lawson.experiences.list]) {
      window.__standBy(e.x, e.z, 4.5, 0.6);
      await window.__wait(250);
      out[e.id] = await window.__frame();
    }
    return out;
  });

  /* ---- the minimap: diamonds where the spots are ---- */
  await step('30-minimap', async () => {
    const { player, world } = window.__scene;
    const list = world.experiences.list;
    const res = {};
    const corner = document.querySelector('canvas.minimap');
    for (const e of list) {
      window.__standBy(e.x, e.z, 12, 1.0);
      player.yaw = 0;               // north up: the spot is straight ahead or behind
      window.__minimapDraw();
      // where the diamond should be: (dx, dz) turned by yaw 0
      const S = corner.width, R = S / 2, dpr = S / 196, k = (R - 10 * dpr) / 60;
      const px = R + (e.x - player.pos.x) * k, py = R + (e.z - player.pos.z) * k;
      const d = corner.getContext('2d').getImageData(Math.round(px) - 16, Math.round(py) - 16, 33, 33).data;   // on the spot, or a badge on its icon
      let yellow = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 230 && d[i + 1] > 190 && d[i + 2] < 150) yellow++;
      res[e.id] = yellow;
    }
    // and the full map (M)
    window.__press('KeyM');
    await window.__wait(300);
    const full = document.querySelector('.fullmap canvas');
    const data = full.toDataURL('image/jpeg', 0.9);
    window.__press('KeyM');
    await window.__wait(200);
    const cornerData = corner.toDataURL('image/png');
    return { res, full: data, corner: cornerData };
  }, (r) => Object.values(r.res).every((n) => n > 0));
} finally {
  if (errs.length) { console.log('page errors:'); for (const e of errs.slice(0, 20)) console.log('  ', e); }
  await close();
}
if (bad || errs.length) process.exitCode = 1;
