import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:5178/?shots', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
console.log(await page.evaluate(() => {
  const u = window.__scene.scene.getObjectByName('lawson-interior').userData.units;
  const by = {}; for (const x of u) by[x.id] = (by[x.id] ?? 0) + 1;
  return `${Object.keys(by).length} products, ${u.length} facings on show, ${u.reduce((a, x) => a + x.count, 0)} units in stock\n` + Object.entries(by).map(([k, v]) => `${k}:${v}`).join(' ');
}));
await browser.close();
