// dev helper: tile PNGs into a labelled 2-column grid
import { chromium } from 'playwright';
import fs from 'node:fs';
const [out, ...files] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const imgs = files.map((p) => ['data:image/png;base64,' + fs.readFileSync(p).toString('base64'), p.split('/').pop()]);
const url = await page.evaluate(async (imgs) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; });
  const L = await Promise.all(imgs.map(([s]) => load(s)));
  const W = 960, H = 540, cols = 2, rows = Math.ceil(L.length / cols);
  const cv = document.createElement('canvas'); cv.width = W * cols; cv.height = H * rows;
  const c = cv.getContext('2d');
  L.forEach((im, k) => { const x = (k % cols) * W, y = Math.floor(k / cols) * H; c.drawImage(im, x, y, W, H); c.fillStyle = '#000'; c.fillRect(x, y, 200, 34); c.fillStyle = '#fff'; c.font = 'bold 24px sans-serif'; c.fillText(imgs[k][1], x + 8, y + 25); });
  return cv.toDataURL('image/jpeg', 0.85);
}, imgs);
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
await browser.close();
