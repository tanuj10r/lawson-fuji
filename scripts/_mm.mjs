// dev helper: screenshot the page (DOM included) at spots, minimap on
import { chromium } from 'playwright';
const [out, json] = process.argv.slice(2);
const spots = JSON.parse(json);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://localhost:5178/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
for (const [name, s] of Object.entries(spots)) {
  await page.evaluate((s) => {
    const { player, hud, world } = window.__scene;
    player.locked = true; hud.setLocked(true);
    let p = s.pos ? { x: s.pos[0], z: s.pos[2] } : null, yaw = s.yaw;
    if (p && s.frame === "core") { p = world.frame.toWorld(p); yaw = world.frame.yawToWorld(yaw); }
    if (s.hero) window.__scene.enterHero(s.hero, { photo: false });
    else { player.pos.set(p.x, 0, p.z); player.yaw = yaw; player.pitch = 0.05; }
    if (s.full) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }));
  }, s);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${name}.png` });
  if (s.full) await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' })));
}
if (errs.length) console.log('ERR', errs);
await browser.close();
