/* Scene census for performance work: what the batcher left as separate
 * meshes, grouped by name and material, busiest first.
 *
 *   node scripts/probe.mjs           the town
 *   node scripts/probe.mjs --kit     the kit test street
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const kit = process.argv.includes('--kit');
const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5191, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(server.resolvedUrls.local[0] + '?shots' + (kit ? '&kit' : ''));
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const out = await page.evaluate(() => {
  const { scene } = window.__scene;
  const kinds = new Map();
  let n = 0, tris = 0;
  scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    n++;
    const g = o.geometry;
    const t = ((g.index ? g.index.count : g.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1);
    tris += t;
    const m = Array.isArray(o.material) ? 'multi'
      : o.material.type + (o.material.map ? '-map' : '') + (o.material.userData.live ? '-live' : '');
    let a = o;
    while (a.parent && !a.name) a = a.parent;
    const k = `${(a.name || 'anon').replace(/[0-9]+/g, '#')} | ${m}`;
    const e = kinds.get(k) ?? { n: 0, t: 0 };
    e.n++; e.t += t;
    kinds.set(k, e);
  });
  const fmt = ([k, e]) => `${String(e.n).padStart(5)}  ${String(Math.round(e.t / 1000)).padStart(5)}k  ${k}`;
  return {
    meshes: n, triangles: Math.round(tris),
    mostMeshes: [...kinds.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 25).map(fmt),
    mostTriangles: [...kinds.entries()].sort((a, b) => b[1].t - a[1].t).slice(0, 15).map(fmt),
  };
});
console.log(`meshes ${out.meshes}, triangles ${out.triangles}`);
console.log('\nmost meshes:\n' + out.mostMeshes.join('\n'));
console.log('\nmost triangles:\n' + out.mostTriangles.join('\n'));
await browser.close();
await server.close();
