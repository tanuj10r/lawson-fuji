/* The key art (start and pause cards, og:image): one staged frame from our
 * own renderer, baked to public/keyart.webp.  AGENTS.md: visuals are built
 * in code, so the picture on the title card is the game itself.
 *
 *   node scripts/keyart.mjs                 render SHOT, write public/keyart.webp
 *   node scripts/keyart.mjs --try           render every CANDIDATES frame to .shots/keyart/ (PNG)
 *   node scripts/keyart.mjs --try a,b       only these candidates
 *
 * Headless system Chrome and its own dev server, like shots.mjs, on the
 * same lock (one Chrome at a time); both are closed however the run ends.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const tryIdx = args.indexOf('--try');
const trying = tryIdx >= 0;
const only = trying && args[tryIdx + 1] && !args[tryIdx + 1].startsWith('--') ? args[tryIdx + 1].split(',') : null;

/* The frame (world coordinates, `__shot` options).  Out: ~1600 x 900 WebP,
 * at most MAX_BYTES; rendered at 2x and let the pipeline's FXAA settle it. */
const OUT = { w: 1600, h: 900, scale: 2, maxBytes: 180 * 1024, file: path.join(ROOT, 'public', 'keyart.webp') };

/* Looked at side by side before choosing (2026-09-28; docs/decisions/start-screens.md):
 * high over the town (Fuji and the rooftops, the store too small), across the
 * road at eye height (the store and Fuji, no story), and from behind Han's
 * RX-7 in its bay: Han leaning on it, the shiba beside him, both looking where
 * you look -- NIPPON under Fuji, the sakura along the lane, ドンペン堂 lit up. */
const FROM_THE_BAY = { look: 'golden', pos: [-26, 0, 33.5], yaw: -0.42, pitch: 0.06, lift: 0.6, vfov: 36, clean: true };
const CANDIDATES = {
  // the famous view itself (the opening shot)
  hero: { look: 'golden', pos: [0, 0, 16.5], yaw: 0, pitch: 0.16 },
  // over the town, Fuji behind
  town: { look: 'golden', pos: [-10, 0, 45], yaw: -0.15, pitch: -0.05, lift: 12, clean: true },
  // behind Han and the RX-7, the shiba beside him looking at the view (the key art)
  bay: { ...FROM_THE_BAY, guide: 'look', guideFrom: { pos: { x: -26, z: 33.5 }, yaw: -0.58 }, guideD: 11 },
  'bay-alone': FROM_THE_BAY,
};
const SHOT = 'bay';

/* ---- one run at a time on this machine (the shots.mjs lock) ---- */
const LOCK = path.join(os.tmpdir(), 'lawson-fuji-shots.lock');
for (;;) {
  try { fs.mkdirSync(LOCK); fs.writeFileSync(path.join(LOCK, 'pid'), String(process.pid)); break; } catch {
    let pid = 0;
    try { pid = +fs.readFileSync(path.join(LOCK, 'pid'), 'utf8'); } catch {}
    let alive = false;
    try { if (pid) { process.kill(pid, 0); alive = true; } } catch {}
    if (!alive) { fs.rmSync(LOCK, { recursive: true, force: true }); continue; }
    console.log(`  waiting for another shots run (pid ${pid})`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
const unlock = () => { try { if (+fs.readFileSync(path.join(LOCK, 'pid'), 'utf8') === process.pid) fs.rmSync(LOCK, { recursive: true, force: true }); } catch {} };
process.on('exit', unlock);

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5191, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const base = server.resolvedUrls.local[0];
const launchArgs = ['--use-angle=metal', '--ignore-gpu-blocklist'];
let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: true, args: launchArgs }); } catch { browser = await chromium.launch({ headless: true, args: launchArgs }); }
const done = async () => {
  await Promise.race([Promise.all([browser.close(), server.close()]), new Promise((r) => setTimeout(r, 5000))]).catch(() => {});
};
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await done(); process.exit(130); });

try {
  const page = await browser.newPage({ viewport: { width: OUT.w, height: OUT.h } });
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => console.log('  [page error]', e.message));
  await page.goto(`${base}?shots`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000, polling: 250 });

  const render = (o) => page.evaluate(([w, h, opts]) => window.__shot('keyart', w, h, opts),
    [OUT.w, OUT.h, { ...o, png: true, returnData: true, scale: o.scale ?? OUT.scale }]);
  const write = (file, dataUrl) => fs.writeFileSync(file, Buffer.from(dataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64'));

  if (trying) {
    const dir = path.join(ROOT, '.shots', 'keyart');
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, o] of Object.entries(CANDIDATES)) {
      if (only && !only.includes(name)) continue;
      const r = await render(o);
      write(path.join(dir, `${name}.png`), r.data);
      console.log(`  ${name.padEnd(18)} calls ${r.calls}  tris ${Math.round(r.triangles / 1000)}k`);
    }
    console.log(`saved to ${path.relative(ROOT, dir)}/`);
  } else {
    const r = await render(CANDIDATES[SHOT]);
    // the smallest WebP quality step that keeps it good, under the budget
    const { data, q, bytes } = await page.evaluate(async ([src, max]) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      let out = null;
      for (let q = 0.9; q >= 0.5; q -= 0.04) {
        const d = c.toDataURL('image/webp', q);
        const bytes = Math.round(((d.length - d.indexOf(',') - 1) * 3) / 4);
        out = { data: d, q: +q.toFixed(2), bytes };
        if (bytes <= max) break;
      }
      return out;
    }, [r.data, OUT.maxBytes]);
    write(OUT.file, data);
    write(path.join(ROOT, '.shots', 'keyart-full.png'), r.data);
    console.log(`KEYART ${SHOT}: ${OUT.w}x${OUT.h} WebP q${q}, ${(bytes / 1024).toFixed(0)} KB -> ${path.relative(ROOT, OUT.file)}`);
  }
} finally {
  await done();
}
