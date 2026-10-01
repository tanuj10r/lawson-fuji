/* Hachi's sprites for the selfie postcard (ui/postcardSelfie.js): the game's own pup, rendered alone with alpha
 * (src/dev/hachiSprite.js): both front paws up, head tilted, big eyes, tongue out; all of him, and his forelegs alone
 * (the same frame), so he stands behind the polaroid with his paws over its edge.
 *   node scripts/hachi-sprite.mjs            -> src/assets/hachi-peek.webp, hachi-paws.webp
 *   node scripts/hachi-sprite.mjs --try DIR  -> a few poses as PNG in DIR, to choose from (nothing shipped)
 *   --rig REF   take src/world/animals/shiba.js and shade.js from that git ref (the expressions, aPose3..5, are
 *               on `director-mode` until they reach main; only this render reads them, nothing is written)
 * Its own dev server (PORT, default 5187) and one headless Chrome under the browser lock; both closed however it ends. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const TRY = arg('--try') && path.resolve(arg('--try'));
const RIG = arg('--rig');
const PORT = +process.env.PORT || 5187;
/* the pose that ships */
export const POSE = { size: 1100, posture: 0, nod: -0.05, tilt: 0.28, look: 0, ears: 1.25, face: [0, 0.25, 0, 1], body: [0.5, 0, 0, 0], more: [0, 0, 1, 0],
  cam: [0.05, 0.3, 1.6], at: [0, 0.2, 0.12], fov: 15, inkPx: 5 };
const TRIES = {
  a: POSE,
  b: { ...POSE, face: [0, 0, 0.55, 1], body: [1, 0, 0, 0] },
  c: { ...POSE, tilt: -0.3, posture: 1, face: [0, -0.4, 0, 1], body: [0.5, 0, 0, 0] },
};
/* `--rig REF`: the two files from that ref, in place of the working tree's, for this server only */
const rigFrom = (ref) => ({
  name: 'rig-from-ref',
  enforce: 'pre',
  load(id) {
    const m = /\/src\/world\/animals\/(shiba|shade)\.js$/.exec(id.split('?')[0]);
    return m ? execFileSync('git', ['show', `${ref}:src/world/animals/${m[1]}.js`], { cwd: ROOT, encoding: 'utf8' }) : null;
  },
});

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
  server = await createServer({ root: ROOT, logLevel: 'error', plugins: RIG ? [rigFrom(RIG)] : [], server: { port: PORT, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  [page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [console]', m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/credits.html`);
  const render = (pose, type) => page.evaluate(async ([pose, type]) => {
    const { hachiSprites } = await import('/src/dev/hachiSprite.js');
    return hachiSprites(pose, { type });
  }, [pose, type]);
  if (TRY) {
    for (const [k, pose] of Object.entries(TRIES)) {
      const r = await render(pose, 'image/png');
      write(path.join(TRY, `hachi-${k}.png`), r.body.data); write(path.join(TRY, `hachi-${k}-paws.png`), r.paws.data);
      console.log(`  ${k}: ${r.w}x${r.h} paws ${r.pawsTop.toFixed(3)}..${r.pawsBottom.toFixed(3)}`);
    }
  } else {
    const r = await render(POSE, 'image/webp');
    write(path.join(ROOT, 'src', 'assets', 'hachi-peek.webp'), r.body.data);
    write(path.join(ROOT, 'src', 'assets', 'hachi-paws.webp'), r.paws.data);
    console.log(`HACHI ${r.w}x${r.h}: hachi-peek.webp q${r.body.q} ${(r.body.bytes / 1024).toFixed(1)} KB, hachi-paws.webp q${r.paws.q} ${(r.paws.bytes / 1024).toFixed(1)} KB; paws ${r.pawsTop.toFixed(3)}..${r.pawsBottom.toFixed(3)} of the height`);
  }
} finally {
  await done();
}
