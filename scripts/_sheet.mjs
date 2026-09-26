// dev helper: stack side-by-side images into one sheet
import { chromium } from 'playwright';
import fs from 'node:fs';
const [out, ...files] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const imgs = files.map((p) => ['data:image/jpeg;base64,' + fs.readFileSync(p).toString('base64'), p.split('/').pop().replace('-vs-ref.jpg', '')]);
const url = await page.evaluate(async (imgs) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; });
  const L = await Promise.all(imgs.map(([s]) => load(s)));
  const W = 2000, H = Math.round(W * L[0].height / L[0].width);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = (H + 40) * L.length;
  const c = cv.getContext('2d'); c.fillStyle = '#111'; c.fillRect(0, 0, cv.width, cv.height);
  L.forEach((im, k) => {
    const y = k * (H + 40);
    c.fillStyle = '#fff'; c.font = 'bold 28px sans-serif'; c.fillText(imgs[k][1] + '   (ours left, reference right)', 10, y + 30);
    c.drawImage(im, 0, y + 40, W, H);
  });
  return cv.toDataURL('image/jpeg', 0.85);
}, imgs);
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
await browser.close();
