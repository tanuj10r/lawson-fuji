// dev helper: what of the konbini is ever seen, written to src/world/store/seen-data.js.
//
//   node scripts/_store-seen.mjs [--near 15] [--json out.json] [--from out.json]
//
// Run it again whenever the planogram, the catalogue or the store's room changes (until then the game
// builds the store whole: store/seen.js checks the counts).  It opens the game with the store built
// whole (?shots&storewhole), plays the five visits and looks from every pose a player can have
// (src/dev/store-seen.js says which), then decides:
//   - which sides of which stock units, which painted quads and which solid parts are never seen
//   - how far from the glass (`near`, metres) the label pages can be their smaller mipmaps, and which
//     (the sharpest ever sampled from further off, with a margin: store/pages.js)
// --json keeps the raw measurement; --from decides again from one (no browser).
//
// Its own dev server (PORT, default 5184) and one headless Chrome, on /tmp/lawson-browser.lock; both are
// closed however it ends.  About ten minutes.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const PORT = +process.env.PORT || 5184;
const BANDS = [0, 3, 5, 7, 9, 11, 13, 15, 18, 21, 25, 30, 36, Infinity];
const MARGIN = 1.15;            // a texel is kept a little under a pixel: the sampler's level is not exact to the bit
const LOAD = 6;                 // metres walked while the paintings are painted and uploaded again (about 2 s at a walk)

let res;
if (opt('from')) res = JSON.parse(fs.readFileSync(path.resolve(opt('from')), 'utf8'));
else {
  const { createServer } = await import('vite');
  const { chromium } = await import('playwright');
  const LOCK = '/tmp/lawson-browser.lock';
  for (;;) { try { fs.mkdirSync(LOCK); break; } catch { console.log('  waiting for the browser lock'); await new Promise((r) => setTimeout(r, 10000)); } }
  let server, browser;
  const done = async () => {
    await Promise.race([Promise.all([browser?.close(), server?.close()]), new Promise((r) => setTimeout(r, 8000))]).catch(() => {});
    try { fs.rmdirSync(LOCK); } catch {}
  };
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await done(); process.exit(130); });
  try {
    server = await createServer({ root: ROOT, logLevel: 'error', server: { port: PORT, strictPort: true, host: '127.0.0.1' } });
    await server.listen();
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.setDefaultNavigationTimeout(180000);
    page.setDefaultTimeout(0);
    page.on('pageerror', (e) => console.log('  [page error]', String(e)));
    page.on('console', (m) => { if (m.text().startsWith('[seen]')) console.log(' ', m.text().slice(7)); else if (m.type() === 'error' && !/404|ERR_/.test(m.text())) console.log('  [page]', m.text()); });
    await page.goto(`http://127.0.0.1:${PORT}/?shots&storewhole`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000, polling: 250 });
    const t0 = Date.now();
    res = await page.evaluate(async () => {
      const { runSeen } = await import('/src/dev/store-seen.js');
      window.__store.shop.flash = () => {};
      return runSeen({ log: (s) => console.log('[seen] ' + s) });
    });
    console.log(`  measured in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  } finally {
    await done();
  }
  if (opt('json')) fs.writeFileSync(path.resolve(opt('json')), JSON.stringify(res));
}

/* ---------------- deciding ---------------- */
const HERO = BANDS.length - 1;
/** The sharpest mipmap ever sampled when a texel covers at most `r` of a screen pixel (0: the painting itself). */
const levelFor = (r) => (r > 0 ? Math.max(0, Math.min(4, Math.floor(Math.log2(1 / (r * MARGIN))))) : 4);
const ids = Object.keys(res.ratio);                 // catalogue order
/** A product's label from the bands at and beyond `b0`, and the famous views. */
const far = (id, b0) => { const r = res.ratio[id]; let m = r[HERO]; for (let b = b0; b < HERO; b++) if (r[b] > m) m = r[b]; return m; };
const hist = (levels) => levels.reduce((h, l) => ((h[l]++), h), [0, 0, 0, 0, 0]).join(' ');
console.log(`${res.poses} poses; ${res.counts.units} units, ${res.counts.quads} quads (${res.tagQuads} price tags), ${res.counts.solids} solid parts`);
console.log(`never seen: ${res.unseenUnits} units (${res.rawUnseenUnits} before the neighbours' margin), ${res.quadsUnseen.length} quads, ${res.solidsUnseen.length} solid parts`);
console.log('sides seen (front, back, +x, -x, top, bottom), of units: ' + res.sides.map(([raw, kept]) => `${kept} (${raw})`).join(', '));
console.log('products by the level their label can be (0 1 2 3 4), from beyond a distance of the glass:');
for (let b = 1; b < HERO; b++) console.log(`  ${String(BANDS[b]).padStart(3)} m+   ${hist(ids.map((id) => levelFor(far(id, b))))}`);
console.log(`  the famous views alone   ${hist(ids.map((id) => levelFor(res.ratio[id][HERO])))}`);
console.log(`  from anywhere   ${hist(ids.map((id) => levelFor(far(id, 0))))}`);

const near = +opt('near', 15);
// the far level is on show from `near` metres out, and for the `LOAD` metres it takes to bring the paintings back
let b0 = 0;
while (BANDS[b0 + 1] <= near - LOAD) b0++;
const featured = new Set(res.featured);
const labelLevel = ids.map((id) => (featured.has(id) ? 0 : levelFor(far(id, b0))));     // what you can take: with the sharpest
const labelNear = ids.map((id) => (featured.has(id) ? 0 : levelFor(far(id, 0))));        // at the store itself: from anywhere
const tagLevel = ids.map((id) => levelFor(res.tag[id] ?? 0));
console.log(`price tags by level, from anywhere:   ${hist(tagLevel)}`);
/* a tag from afar: it hangs under its product, so a metre of it covers the pixels a metre of the product does
 * (a third more, for the rail standing nearer than the goods), against its own finer texels */
const ppmMost = Math.max(...ids.map((id) => (res.tpm[id] ? far(id, b0) * res.tpm[id] : 0)));
const tagFar = ids.map((id) => levelFor(1.3 * (res.tpm[id] ? far(id, b0) * res.tpm[id] : ppmMost) / 2560));
console.log(`price tags by level, from afar:   ${hist(tagFar)}`);
const mask = res.mask.map((m) => String.fromCharCode(48 + m)).join('');
const file = path.join(ROOT, 'src/world/store/seen-data.js');
fs.writeFileSync(file, `/* Generated by scripts/_store-seen.mjs (store/seen.js says what it is): ${res.poses} poses, the five visits
 * frame by frame, every way you can look once you are outside again, the forecourt and the street up to the
 * glass, the famous views.  Never seen: ${res.unseenUnits} of ${res.counts.units} stock units, ${res.quadsUnseen.length} of ${res.counts.quads} painted quads,
 * ${res.solidsUnseen.length} of ${res.counts.solids} solid parts.  Do not edit: run the tool again. */
export const SEEN = {
  units: ${res.counts.units}, quads: ${res.counts.quads}, solids: ${res.counts.solids}, catalog: ${res.catalog},
  near: ${near},
  labelLevel: '${labelLevel.join('')}',
  labelNear: '${labelNear.join('')}',
  tagLevel: '${tagLevel.join('')}',
  tagFar: '${tagFar.join('')}',
  quadsUnseen: ${JSON.stringify(res.quadsUnseen)},
  solidsUnseen: ${JSON.stringify(res.solidsUnseen)},
  mask: '${mask.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',
};
`);
console.log(`near ${near} m (far: from ${BANDS[b0]} m): labels by level ${hist(labelLevel)}, at the store ${hist(labelNear)}; wrote ${path.relative(ROOT, file)}`);
