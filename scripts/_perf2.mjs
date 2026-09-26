import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5178/?shots', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
console.log(await page.evaluate(async () => {
  const { scene } = window.__scene;
  const t = async (label) => {
    const r = await window.__shot('p', 2560, 1440, { hero: 'morning', look: 'day', returnData: false, png: false, scale: 1.5, time: 30 });
    return `${label}: ${r.ms.toFixed(1)} ms, calls ${r.calls}, tris ${Math.round(r.triangles / 1000)}k`;
  };
  const out = [await t('warm'), await t('all')];
  const inside = scene.getObjectByName('lawson-interior');
  inside.visible = false; out.push(await t('no interior')); inside.visible = true;
  out.push(await t('all again'));
  return out.join('\n');
}));
await browser.close();
