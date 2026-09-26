// dev helper: frame time at the famous view with parts switched off
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5178/?shots', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const out = await page.evaluate(async () => {
  const { scene, renderer, world } = window.__scene;
  const spot = { look: 'day', pos: [14.5, 0, 110.6], yaw: 3.1416, pitch: 0.02, frame: 'core' };
  const t = async (label) => {
    const r = await window.__shot('p', 2560, 1440, { ...spot, returnData: false, png: false, scale: 1.5, time: 20 });
    return `${label}: ${r.ms.toFixed(1)} ms, calls ${r.calls}`;
  };
  const res = [await t('all')];
  const groups = {};
  scene.traverse((o) => { if (o.isMesh && o.visible) { const k = (o.name || o.parent?.name || 'anon').replace(/[0-9]+/g, '#'); (groups[k] ??= []).push(o); } });
  for (const [k, list] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length).slice(0, 14)) {
    list.forEach((o) => (o.visible = false));
    res.push(await t(`hide ${k} (${list.length})`));
    list.forEach((o) => (o.visible = true));
  }
  renderer.shadowMap.enabled = false; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  res.push(await t('no shadows'));
  return res;
});
console.log(out.join('\n'));
await browser.close();
