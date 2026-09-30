/* The page's icons and share images (QA-005), baked into public/ from the
 * game itself: the famous view rendered by our own renderer (`?shots`), the
 * title and the emblem (public/favicon.svg, the town's Fuji manhole lid with
 * the konbini under the mountain) laid over it with Canvas2D.  No downloaded
 * images; the Japanese line uses the game's own sign font (NF Round).
 *
 *   node scripts/share-art.mjs          write every file below
 *   node scripts/share-art.mjs --raw    only the bare renders, to .shots/share/
 *
 * Out (public/): favicon.ico (16/32/48), favicon-32.png, apple-touch-icon.png
 * (180), icon-192.png, icon-512.png, og.jpg (1200x630), og-square.jpg (1200).
 * One headless Chrome and its own dev server (port 5193), under the shared
 * browser lock; both are closed however the run ends.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PUB = path.join(ROOT, 'public');
const RAW = process.argv.includes('--raw');

/* the opening shot (scripts/keyart.mjs CANDIDATES.hero), highlights off */
const HERO = { look: 'golden', pos: [0, 0, 16.5], yaw: 0, pitch: 0.16, clean: true };
const SHARE = [
  { file: 'og.jpg', w: 1200, h: 630, shot: HERO, q: 0.8 },
  { file: 'og-square.jpg', w: 1200, h: 1200, shot: { ...HERO, pitch: 0.2, vfov: 62 }, q: 0.72 },
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

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5193, strictPort: true, host: '127.0.0.1' } });
await server.listen();
const base = server.resolvedUrls.local[0];
let browser;
const done = async () => {
  await Promise.race([Promise.all([browser?.close(), server.close()]), new Promise((r) => setTimeout(r, 5000))]).catch(() => {});
  unlock();
};
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await done(); process.exit(130); });

const write = (file, dataUrl) => {
  const buf = Buffer.from(dataUrl.replace(/^data:[\w/+-]+;base64,/, ''), 'base64');
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
  const launchArgs = ['--use-angle=metal', '--ignore-gpu-blocklist'];
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: launchArgs });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => console.log('  [page error]', e.message));
  await page.goto(`${base}?shots`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000, polling: 250 });

  const renders = [];
  for (const s of SHARE) {
    const r = await page.evaluate(([w, h, o]) => window.__shot('share', w, h, o),
      [s.w, s.h, { ...s.shot, png: true, returnData: true, scale: 2 }]);
    renders.push(r.data);
    if (RAW) {
      fs.mkdirSync(path.join(ROOT, '.shots', 'share'), { recursive: true });
      write(path.join(ROOT, '.shots', 'share', s.file.replace('.jpg', '.png')), r.data);
    }
  }
  if (RAW) { console.log('raw renders in .shots/share/'); process.exitCode = 0; }
  else {
    const out = await page.evaluate(async ([share, renders, svgUrl, title, titleJp, place, url]) => {
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

      /* share images: the render, a soft wash over the sky for the type, the
       * title as on the start card (serif, the place line, the Japanese
       * line with its sakura rule), the emblem, the URL */
      for (let i = 0; i < share.length; i++) {
        const s = share[i];
        const img = await load(renders[i]);
        const [c, x] = canvas(s.w, s.h);
        x.drawImage(img, 0, 0, s.w, s.h);
        const square = s.w === s.h;
        const U = s.w / 100;             // one unit = 1% of the width
        // a light wash from the top so the ink-coloured type reads on any sky
        const g = x.createLinearGradient(0, 0, 0, s.h * (square ? 0.36 : 0.42));
        g.addColorStop(0, 'rgba(251,246,240,0.55)');
        g.addColorStop(1, 'rgba(251,246,240,0)');
        x.fillStyle = g; x.fillRect(0, 0, s.w, s.h);

        const serif = `'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif`;
        const round = `'NF Round', 'Hiragino Maru Gothic ProN', sans-serif`;
        const ink = '#2a2140';
        // the emblem, left; the words beside it
        const E = square ? 15 * U : 11.5 * U;
        const ex = square ? 50 * U - E / 2 : 4 * U, ey = square ? 5 * U : 4 * U;
        x.save();
        x.shadowColor = 'rgba(20,10,40,0.35)'; x.shadowBlur = 1.4 * U; x.shadowOffsetY = 0.4 * U;
        x.drawImage(svg, ex, ey, E, E);
        x.restore();

        const tx = square ? 50 * U : ex + E + 2.4 * U;
        x.textAlign = square ? 'center' : 'left';
        x.textBaseline = 'alphabetic';
        const spaced = (str, px, py, sp) => {
          // letter-spaced line (canvas letterSpacing where supported)
          x.letterSpacing = `${sp}px`;
          x.fillText(str, px + (square ? sp / 2 : 0), py);
          x.letterSpacing = '0px';
        };
        let y = square ? ey + E + 6 * U : ey + 2.6 * U;
        x.fillStyle = 'rgba(43,37,66,0.78)';
        x.font = `700 ${1.35 * U}px -apple-system, 'Helvetica Neue', sans-serif`;
        spaced(place.toUpperCase(), tx, y, 0.32 * U);
        y += (square ? 7.4 : 6.2) * U;
        x.fillStyle = ink;
        x.font = `600 ${(square ? 7.4 : 5.6) * U}px ${serif}`;
        x.shadowColor = 'rgba(255,236,230,0.6)'; x.shadowOffsetY = 1;
        x.fillText(title, tx, y);
        x.shadowColor = 'transparent';
        y += (square ? 5 : 3.9) * U;
        x.font = `700 ${(square ? 2.6 : 2.1) * U}px ${round}`;
        x.fillStyle = 'rgba(43,37,66,0.85)';
        const jpW = (() => { x.letterSpacing = `${0.6 * U}px`; const m = x.measureText(titleJp).width; x.letterSpacing = '0px'; return m; })();
        const ruleW = 4 * U;
        const jx = square ? tx - jpW / 2 + ruleW / 2 + 0.6 * U : tx + ruleW + 1.2 * U;
        const rg = x.createLinearGradient(jx - ruleW - 1.2 * U, 0, jx - 1.2 * U, 0);
        rg.addColorStop(0, 'rgba(229,155,176,0)'); rg.addColorStop(1, '#e59bb0');
        x.fillStyle = rg; x.fillRect(jx - ruleW - 1.2 * U, y - 0.8 * U, ruleW, 0.36 * U);
        x.fillStyle = 'rgba(43,37,66,0.85)';
        x.textAlign = 'left';
        x.letterSpacing = `${0.6 * U}px`;
        x.fillText(titleJp, jx, y);
        x.letterSpacing = '0px';

        // the address, bottom right on a paper pill
        x.font = `600 ${1.5 * U}px -apple-system, 'Helvetica Neue', sans-serif`;
        x.letterSpacing = `${0.12 * U}px`;
        const uw = x.measureText(url).width, ph = 3.2 * U, pw = uw + 3.2 * U;
        const px = s.w - pw - 2.4 * U, py = s.h - ph - 2.4 * U;
        x.fillStyle = 'rgba(251,246,240,0.9)';
        x.beginPath(); x.roundRect(px, py, pw, ph, ph / 2); x.fill();
        x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(url, px + pw / 2, py + ph / 2 + 0.1 * U);
        x.letterSpacing = '0px';
        res[s.file] = c.toDataURL('image/jpeg', s.q);
      }
      return res;
    }, [SHARE.map(({ file, w, h, q }) => ({ file, w, h, q })), renders, `${base}favicon.svg`,
      'Take Me Back to Japan', '日本へ、もう一度', 'Fujikawaguchikko · 富士川口湖町', 'takemebacktojapan.com']);

    const sizes = {};
    const put = (name, data) => { sizes[name] = write(path.join(PUB, name), data).length; };
    const bufs = {};
    for (const n of [16, 32, 48]) bufs[n] = Buffer.from(out[`icon${n}`].split(',')[1], 'base64');
    fs.writeFileSync(path.join(PUB, 'favicon.ico'), ico([16, 32, 48].map((n) => ({ size: n, buf: bufs[n] }))));
    sizes['favicon.ico'] = fs.statSync(path.join(PUB, 'favicon.ico')).size;
    put('favicon-32.png', out.icon32);
    put('apple-touch-icon.png', out.apple);
    put('icon-192.png', out.icon192);
    put('icon-512.png', out.icon512);
    for (const s of SHARE) put(s.file, out[s.file]);
    sizes['favicon.svg'] = fs.statSync(path.join(PUB, 'favicon.svg')).size;
    let total = 0;
    for (const [k, v] of Object.entries(sizes)) { total += v; console.log(`  ${k.padEnd(22)} ${(v / 1024).toFixed(1)} KB`); }
    console.log(`SHARE-ART ${(total / 1024).toFixed(0)} KB in public/`);
  }
} finally {
  await done();
}
