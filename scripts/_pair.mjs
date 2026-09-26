// dev helper: before/after pairs, stacked, labelled
import { chromium } from 'playwright';
import fs from 'node:fs';
const [out, ...pairs] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const imgs = pairs.map((p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64'));
const url = await page.evaluate(async (imgs) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; });
  const L = await Promise.all(imgs.map(load));
  const W = 1280, H = Math.round(W * L[0].height / L[0].width);
  const cv = document.createElement('canvas'); cv.width = W * 2 + 20; cv.height = H * (L.length / 2) + 10 * (L.length / 2);
  const c = cv.getContext('2d'); c.fillStyle = '#111'; c.fillRect(0, 0, cv.width, cv.height);
  for (let k = 0; k < L.length; k += 2) {
    const y = (k / 2) * (H + 10);
    c.drawImage(L[k], 0, y, W, H); c.drawImage(L[k + 1], W + 20, y, W, H);
    c.font = 'bold 34px sans-serif'; c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 6;
    for (const [t, x] of [['BEFORE', 20], ['AFTER', W + 40]]) { c.strokeText(t, x, y + 46); c.fillText(t, x, y + 46); }
  }
  return cv.toDataURL('image/jpeg', 0.9);
}, imgs);
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
await browser.close();
