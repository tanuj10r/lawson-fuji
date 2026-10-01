/* Tan's avatar for the cards: their own portrait (tanuj-fyi/public/tanuj.png),
 * the head cropped to a circle, the black backdrop tinted to the cards' ink,
 * written as a small webp by Chrome's own encoder.
 *   node scripts/_avatar.mjs <src.png> [out-dir]    (default: public/, writes tan.webp, 96 px: 48 CSS px at 2x)
 * Headless Chrome on /tmp/lawson-browser.lock; closed at the end. */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [src, outDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'public')] = process.argv.slice(2);
const LOCK = '/tmp/lawson-browser.lock';
for (;;) { try { fs.mkdirSync(LOCK); break; } catch { console.log('  waiting for the browser lock'); await new Promise((r) => setTimeout(r, 10000)); } }
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const data = 'data:image/png;base64,' + fs.readFileSync(src).toString('base64');
  const out = await page.evaluate(async (data) => {
    const img = new Image(); img.src = data; await img.decode();
    const res = {};
    for (const [size, q] of [[96, 0.82]]) {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const g = c.getContext('2d');
      // the head and collar: a square around the face
      const cx = 492, cy = 285, half = 268;
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, cx - half, cy - half, half * 2, half * 2, 0, 0, size, size);
      const d = g.getImageData(0, 0, size, size), p = d.data;
      // the dark lifted toward the cards' ink (#3b3263), the skin and shirt kept
      const ink = [59, 50, 99];
      for (let i = 0; i < p.length; i += 4) {
        const L = (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 255;
        const k = Math.pow(1 - L, 4) * 0.9;
        for (let j = 0; j < 3; j++) p[i + j] = Math.min(255, p[i + j] + ink[j] * k);
      }
      g.putImageData(d, 0, 0);
      // round: outside the circle transparent (the card draws its own ring)
      g.globalCompositeOperation = 'destination-in';
      g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.fill();
      res[size] = c.toDataURL('image/webp', q);
    }
    return res;
  }, data);
  for (const [size, url] of Object.entries(out)) {
    const buf = Buffer.from(url.split(',')[1], 'base64');
    const f = path.join(outDir, 'tan.webp');
    fs.writeFileSync(f, buf);
    console.log(f, buf.length, 'bytes');
  }
} finally {
  await browser?.close().catch(() => {});
  fs.rmdirSync(LOCK);
}
