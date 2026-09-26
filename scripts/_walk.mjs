import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5178/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
console.log(await page.evaluate(async () => {
  const { player, hud, world } = window.__scene;
  const door = world.lawson.root.userData.door;
  player.locked = true; hud.setLocked(true);
  const log = [];
  const walk = async (x, z, yaw, secs, label) => {
    player.pos.set(x, 0, z); player.yaw = yaw; player.keys.add('KeyW');
    const t0 = performance.now();
    while (performance.now() - t0 < secs * 1000) await new Promise((r) => requestAnimationFrame(r));
    player.keys.delete('KeyW');
    log.push(`${label}: ended at (${player.pos.x.toFixed(2)}, ${player.pos.z.toFixed(2)}), door ${door.open.toFixed(2)}`);
  };
  await walk(-2.3, 4, 0, 3.5, 'walk in through the door');
  await walk(-2.3, -1.5, 0, 3.5, 'on up the aisle to the drinks');
  await walk(-6.0, 4, 0, 3, 'into the glass left of the door');
  await walk(-2.3, -1.5, Math.PI, 5, 'back out');
  const t0 = performance.now(); while (performance.now() - t0 < 3500) await new Promise((r) => requestAnimationFrame(r));
  log.push(`3.5 s after leaving: door ${door.open.toFixed(2)}`);
  return log.join('\n');
}));
await browser.close();
