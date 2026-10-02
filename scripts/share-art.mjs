/* The page's icons and share images (QA-005), baked into public/: the emblem
 * (public/favicon.svg, the town's Fuji manhole lid with the konbini under the
 * mountain) and, for the share images, the banner's key art (the diorama with
 * Hachi on the crossing: assets/keyart/keyart-3840.png, scripts/keyart.mjs)
 * with the title, the emblem and the address laid over it with Canvas2D.  No
 * downloaded images; the Japanese line uses the game's own sign font (NF Round).
 *
 *   node scripts/share-art.mjs          write every file below
 *   node scripts/share-art.mjs --og     only the two share images
 *
 * Out (public/): favicon.ico (16/32/48), favicon-32.png, apple-touch-icon.png
 * (180), icon-192.png, icon-512.png, og.jpg (1200x630), og-square.jpg (1200),
 * each share image under 150 KB (the quality steps down until it is).
 * One headless Chrome on a blank page (no game, no server: the key art is
 * already rendered), under the shared browser lock; closed however the run ends.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PUB = path.join(ROOT, 'public');
const OG_ONLY = process.argv.includes('--og');
const MASTER = path.join(ROOT, 'assets', 'keyart', 'keyart-3840.png');
if (!fs.existsSync(MASTER)) { console.error(`missing ${MASTER}: run node scripts/keyart.mjs`); process.exit(1); }
const MAX = 150 * 1024;

/* each share image: its size, and how the key art sits in it.
 *   og         the whole width; `top`: how much of the cut comes off the top (0..1; the rest off the bottom)
 *   og-square  the art fills the lower part, a band of the cards' paper above it for the title; `x0`: the art's
 *              left edge cut (fraction of its width), `band`: the paper's height (fraction of the image's) */
const SHARE = [
  { file: 'og.jpg', w: 1200, h: 630, top: 0.67 },
  { file: 'og-square.jpg', w: 1200, h: 1200, band: 0.3, x0: 0.115 },
];

/* ---- one browser at a time across agents ---- */
const LOCK = '/tmp/lawson-browser.lock';
for (;;) {
  try { fs.mkdirSync(LOCK); break; } catch {
    console.log('  waiting for the browser lock');
    await new Promise((r) => setTimeout(r, 10000));
  }
}
let unlocked = false;
const unlock = () => { if (!unlocked) { unlocked = true; try { fs.rmdirSync(LOCK); } catch {} } };
process.on('exit', unlock);

let browser;
const done = async () => {
  await Promise.race([browser?.close(), new Promise((r) => setTimeout(r, 5000))]).catch(() => {});
  unlock();
};
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await done(); process.exit(130); });
const dataUrl = (file, type) => `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;

const write = (file, data) => {
  const buf = Buffer.from(data.replace(/^data:[\w/+-]+;base64,/, ''), 'base64');
  fs.writeFileSync(file, buf);
  return buf;
};

/** An .ico holding PNG images (every browser since IE Vista reads them). */
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = head.length;
  pngs.forEach(({ size, buf }, i) => {
    const e = 6 + i * 16;
    head.writeUInt8(size >= 256 ? 0 : size, e); head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(buf.length, e + 8); head.writeUInt32LE(off, e + 12);
    off += buf.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.buf)]);
}

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  page.on('pageerror', (e) => console.log('  [page error]', e.message));
  await page.setContent('<!doctype html><html><body></body></html>');
  const out = await page.evaluate(async ([share, artUrl, svgUrl, fontUrl, MAX, title, titleJp, place, url, titleFontUrl]) => {
    const font = new FontFace('NF Round', `url(${fontUrl})`);
    document.fonts.add(await font.load());
    // the title's own face (M PLUS Rounded Bold, public/title.woff2), as on the cards
    document.fonts.add(await new FontFace('TMBJ Title', `url(${titleFontUrl})`, { weight: '700' }).load());
    const load = async (src) => { const i = new Image(); i.src = src; await i.decode(); return i; };
    const svg = await load(svgUrl);
    const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
    const res = {};

    /* icons: the emblem alone; the touch icon on the cards' paper (iOS fills
     * transparency with black and rounds the corners itself) */
    const icon = (size, bg, fill = 1) => {
      const [c, x] = canvas(size, size);
      if (bg) { x.fillStyle = bg; x.fillRect(0, 0, size, size); }
      const s = size * fill, o = (size - s) / 2;
      x.imageSmoothingQuality = 'high';
      x.drawImage(svg, o, o, s, s);
      return c.toDataURL('image/png');
    };
    for (const n of [16, 32, 48, 192, 512]) res[`icon${n}`] = icon(n);
    res.apple = icon(180, '#fbf6f0', 0.86);

    /* share images: the key art, the title as on the start card (its round face, the
     * place line, the Japanese line with its sakura rule), the emblem, the URL */
    const art = await load(artUrl);
    const paper = '#fbf6f0', ink = '#2a2140';
    const round = `'NF Round', 'Hiragino Maru Gothic ProN', sans-serif`;
    for (const s of share) {
      const [c, x] = canvas(s.w, s.h);
      const square = s.w === s.h;
      const U = s.w / 100;             // one unit = 1% of the width
      x.imageSmoothingQuality = 'high';
      if (square) {
        // the art under a band of paper, the seam melted into the sky
        const by = s.h * s.band, ah = s.h - by, sw = art.height * (s.w / ah);
        x.fillStyle = paper; x.fillRect(0, 0, s.w, s.h);
        x.drawImage(art, art.width * s.x0, 0, sw, art.height, 0, by, s.w, ah);
        const g = x.createLinearGradient(0, by, 0, by + 9 * U);
        g.addColorStop(0, 'rgba(251,246,240,1)'); g.addColorStop(1, 'rgba(251,246,240,0)');
        x.fillStyle = g; x.fillRect(0, by - 1, s.w, 9 * U + 1);
      } else {
        const sh = art.width * (s.h / s.w);
        x.drawImage(art, 0, (art.height - sh) * s.top, art.width, sh, 0, 0, s.w, s.h);
        // a light wash over the sky right of the peak, where the type goes
        const g = x.createRadialGradient(74 * U, 2 * U, 4 * U, 74 * U, 2 * U, 44 * U);
        g.addColorStop(0, 'rgba(251,246,240,0.72)'); g.addColorStop(0.55, 'rgba(251,246,240,0.38)'); g.addColorStop(1, 'rgba(251,246,240,0)');
        x.fillStyle = g; x.fillRect(0, 0, s.w, s.h);
      }
      const spaced = (str, px, py, sp) => { x.letterSpacing = `${sp}px`; x.fillText(str, px, py); x.letterSpacing = '0px'; };
      const width = (str, sp) => { x.letterSpacing = `${sp}px`; const m = x.measureText(str).width; x.letterSpacing = '0px'; return m; };
      const emblem = (ex, ey, E) => {
        x.save();
        x.shadowColor = 'rgba(20,10,40,0.35)'; x.shadowBlur = 1.2 * U; x.shadowOffsetY = 0.35 * U;
        x.drawImage(svg, ex, ey, E, E);
        x.restore();
      };
      x.textBaseline = 'alphabetic';
      // the words: centred on the paper (square), or set right, over the sky beside the mountain
      const right = 96 * U, mid = 50 * U;
      x.textAlign = square ? 'center' : 'right';
      const tx = square ? mid : right;
      let y = square ? 17.6 * U : 6.2 * U;
      if (square) emblem(mid - 5.5 * U, 3.2 * U, 11 * U);
      x.fillStyle = 'rgba(43,37,66,0.8)';
      x.font = `700 ${(square ? 1.5 : 1.3) * U}px -apple-system, 'Helvetica Neue', sans-serif`;
      spaced(place.toUpperCase(), tx + (square ? 0.16 * U : 0), y, 0.32 * U);
      y += (square ? 7.2 : 5.6) * U;
      x.fillStyle = ink;
      x.font = `700 ${(square ? 6.9 : 4.8) * U}px 'TMBJ Title', ${round}`;
      x.shadowColor = 'rgba(255,240,236,0.7)'; x.shadowBlur = 0.5 * U; x.shadowOffsetY = 1;
      x.fillText(title, tx, y);
      x.shadowColor = 'transparent'; x.shadowBlur = 0;
      y += (square ? 4.4 : 3.7) * U;
      x.font = `700 ${(square ? 2.5 : 2.0) * U}px ${round}`;
      const sp = 0.6 * U, jpW = width(titleJp, sp), ruleW = 4 * U, gap = 1.2 * U;
      const jx = square ? mid - (jpW - ruleW - gap) / 2 - sp / 2 : right - jpW + sp;   // the line's left edge
      const rg = x.createLinearGradient(jx - gap - ruleW, 0, jx - gap, 0);
      rg.addColorStop(0, 'rgba(229,155,176,0)'); rg.addColorStop(1, '#e59bb0');
      x.fillStyle = rg; x.fillRect(jx - gap - ruleW, y - 0.8 * U, ruleW, 0.36 * U);
      x.fillStyle = 'rgba(43,37,66,0.88)';
      x.textAlign = 'left';
      spaced(titleJp, jx, y, sp);

      // the address, bottom right on a paper pill; on the wide one the emblem sits bottom left
      x.font = `600 ${1.5 * U}px -apple-system, 'Helvetica Neue', sans-serif`;
      const usp = 0.12 * U, uw = width(url, usp), ph = 3.2 * U, pw = uw + 3.2 * U;
      const px = s.w - pw - 2.4 * U, py = s.h - ph - 2.4 * U;
      x.fillStyle = 'rgba(251,246,240,0.92)';
      x.beginPath(); x.roundRect(px, py, pw, ph, ph / 2); x.fill();
      x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle';
      spaced(url, px + pw / 2 + usp / 2, py + ph / 2 + 0.1 * U, usp);
      if (!square) emblem(2.6 * U, s.h - 11.6 * U, 9 * U);
      // under the byte budget: the quality steps down until it is
      let q = 0.86, data;
      for (;;) { data = c.toDataURL('image/jpeg', q); if (data.length * 0.75 <= MAX || q <= 0.4) break; q -= 0.03; }
      res[s.file] = data; res[`${s.file}:q`] = +q.toFixed(2);
    }
    return res;
  }, [SHARE, dataUrl(MASTER, 'image/png'), dataUrl(path.join(PUB, 'favicon.svg'), 'image/svg+xml'),
    dataUrl(path.join(ROOT, 'src/assets/fonts/round.woff2'), 'font/woff2'), MAX,
    'Take Me Back to Japan', '日本へ、もう一度', 'Fujikawaguchikko · 富士川口湖町', 'takemebacktojapan.com',
    dataUrl(path.join(PUB, 'title.woff2'), 'font/woff2')]);

  const sizes = {};
  const put = (name, data) => { sizes[name] = write(path.join(PUB, name), data).length; };
  if (!OG_ONLY) {
    const bufs = {};
    for (const n of [16, 32, 48]) bufs[n] = Buffer.from(out[`icon${n}`].split(',')[1], 'base64');
    fs.writeFileSync(path.join(PUB, 'favicon.ico'), ico([16, 32, 48].map((n) => ({ size: n, buf: bufs[n] }))));
    sizes['favicon.ico'] = fs.statSync(path.join(PUB, 'favicon.ico')).size;
    put('favicon-32.png', out.icon32);
    put('apple-touch-icon.png', out.apple);
    put('icon-192.png', out.icon192);
    put('icon-512.png', out.icon512);
    sizes['favicon.svg'] = fs.statSync(path.join(PUB, 'favicon.svg')).size;
  }
  for (const s of SHARE) { put(s.file, out[s.file]); console.log(`  ${s.file}: JPEG quality ${out[`${s.file}:q`]}`); }
  let total = 0;
  for (const [k, v] of Object.entries(sizes)) { total += v; console.log(`  ${k.padEnd(22)} ${(v / 1024).toFixed(1)} KB`); }
  console.log(`SHARE-ART ${(total / 1024).toFixed(0)} KB in public/`);
} finally {
  await done();
}
