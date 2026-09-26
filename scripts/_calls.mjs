// dev helper: what draws at a view, by name (frustum-tested, visible only)
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5178/?shots', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const out = await page.evaluate(async () => {
  await window.__shot('x', 1600, 900, { hero: 'morning', look: 'day', returnData: false });
  const { scene, camera, THREE } = window.__scene;
  const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const by = new Map();
  scene.traverseVisible((o) => {
    if (!o.isMesh) return;
    if (o.frustumCulled && !fr.intersectsObject(o)) return;
    const k = (o.name || o.parent?.name || 'anon').replace(/[0-9]+/g, '#') + ' ' + o.material.type;
    by.set(k, (by.get(k) ?? 0) + 1);
  });
  return [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, n]) => `${String(n).padStart(4)} ${k}`);
});
console.log(out.join('\n'));
await browser.close();
