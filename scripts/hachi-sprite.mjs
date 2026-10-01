/* Hachi's sprite for the selfie postcard (ui/postcardSelfie.js): the game's own pup, rendered alone with alpha
 * (src/dev/hachiSprite.js), paws over an edge, head tilted, tongue out.
 *   node scripts/hachi-sprite.mjs            -> src/assets/hachi-peek.webp
 *   node scripts/hachi-sprite.mjs --try DIR  -> a few poses as PNG in DIR, to choose from (nothing shipped)
 * Its own dev server (PORT, default 5187) and one headless Chrome under the browser lock; both closed however it ends. */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TRY = process.argv.includes('--try') ? path.resolve(process.argv[process.argv.indexOf('--try') + 1]) : null;
const PORT = +process.env.PORT || 5187;
/* the pose that ships */
export const POSE = { size: 420, posture: 2, nod: -0.85, tilt: 0.3, look: 0.0, ears: 1.25, cam: [0.12, 0.2, 1.6], at: [0, 0.15, 0.12], fov: 15, inkPx: 2.4 };
const TRIES = {
  a: POSE,
  b: { ...POSE, nod: -1.0, cam: [0.2, 0.14, 1.6] },
  c: { ...POSE, nod: -0.7, cam: [-0.25, 0.26, 1.6], look: -0.15 },
  d: { ...POSE, tilt: -0.3, look: 0.2, cam: [-0.3, 0.2, 1.6] },
};

const LOCK = '/tmp/lawson-browser.lock';
for (;;) { try { fs.mkdirSync(LOCK); break; } catch { console.log('  waiting for the browser lock'); await new Promise((r) => setTimeout(r, 10000)); } }
let server, browser;
const done = async () => {
  await Promise.race([Promise.all([browser?.close(), server?.close()]), new Promise((r) => setTimeout(r, 6000))]).catch(() => {});
  try { fs.rmdirSync(LOCK); } catch {}
};
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await done(); process.exit(130); });
const write = (file, dataUrl) => { const b = Buffer.from(dataUrl.replace(/^data:[\w/+-]+;base64,/, ''), 'base64'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, b); return b.length; };

try {
  server = await createServer({ root: ROOT, logLevel: 'error', server: { port: PORT, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [console]', m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/credits.html`);
  const render = (pose, type) => page.evaluate(async ([pose, type]) => {
    const { hachiSprite } = await import('/src/dev/hachiSprite.js');
    return hachiSprite(pose, { type });
  }, [pose, type]);
  if (TRY) {
    for (const [k, pose] of Object.entries(TRIES)) { const r = await render(pose, 'image/png'); write(path.join(TRY, `hachi-${k}.png`), r.data); console.log(`  ${k}: ${r.w}x${r.h}`); }
  } else {
    const r = await render(POSE, 'image/webp');
    const bytes = write(path.join(ROOT, 'src', 'assets', 'hachi-peek.webp'), r.data);
    console.log(`HACHI src/assets/hachi-peek.webp ${r.w}x${r.h} ${(bytes / 1024).toFixed(1)} KB`);
  }
} finally {
  await done();
}
