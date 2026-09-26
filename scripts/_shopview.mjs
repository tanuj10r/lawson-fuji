// dev helper: stand in front of the first shop of each trade and look in
import { chromium } from 'playwright';
import fs from 'node:fs';
const [out, ...trades] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5178/?shots', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
for (const t of trades) {
  const spot = await page.evaluate((t) => {
    const { scene, THREE } = window.__scene;
    let found = null;
    scene.traverse((o) => { if (!found && o.name === 'shop-' + t) found = o; });
    if (!found) return null;
    const p = found.getWorldPosition(new THREE.Vector3());
    const q = found.getWorldQuaternion(new THREE.Quaternion());
    // the group faces its local +z (front at d/2 via makeShop's face)... find front by the first child mesh
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    return { x: p.x, z: p.z, fx: f.x, fz: f.z };
  }, t);
  if (!spot) { console.log('no', t); continue; }
  const d = 9;
  const pos = [spot.x + spot.fx * d, 0, spot.z + spot.fz * d];
  const yaw = Math.atan2(spot.fx, spot.fz);
  const r = await page.evaluate(([n, o]) => window.__shot(n, 1600, 900, { png: true, returnData: true, ...o }), [t, { look: 'day', pos, yaw, pitch: 0.02 }]);
  fs.writeFileSync(`${out}/shop-${t}.png`, Buffer.from(r.data.split(',')[1], 'base64'));
}
await browser.close();
