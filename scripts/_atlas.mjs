import { chromium } from 'playwright';
import fs from 'node:fs';
const [out] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:5178/?shots');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const url = await page.evaluate(async () => {
  const m = await import('/src/world/kit/paint.js');
  const t = m.wearAtlas();
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
  const c = cv.getContext('2d'); c.fillStyle = '#e8e2d0'; c.fillRect(0, 0, 1024, 1024);
  c.globalCompositeOperation = 'multiply'; c.drawImage(t.image, 0, 0, 1024, 1024);
  return cv.toDataURL('image/png');
});
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
await browser.close();
