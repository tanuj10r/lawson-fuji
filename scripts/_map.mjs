// dev helper: a labelled top-down map of the town, rendered from the game
import { chromium } from 'playwright';
import fs from 'node:fs';
const [out] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
await page.goto('http://localhost:5178/?shots', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
await page.evaluate(() => window.__shot('m', 800, 800, { look: 'day', pos: [0, 0, 40], yaw: 0, pitch: 0, returnData: false }));
const url = await page.evaluate(async () => {
  const { scene, renderer, THREE, world } = window.__scene;
  const X0 = -135, X1 = 135, Z0 = -152, Z1 = 132;
  const W = 2160, H = Math.round(W * (Z1 - Z0) / (X1 - X0));
  const cam = new THREE.OrthographicCamera(X0, X1, -Z0, -Z1, 1, 2000);
  cam.position.set(0, 800, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  // top-down: y up the screen is -z (north, toward Fuji)
  cam.left = X0; cam.right = X1; cam.top = -Z0; cam.bottom = -Z1;
  cam.updateProjectionMatrix();
  const fog = scene.fog; scene.fog = null;
  const hidden = [];
  scene.traverse((o) => { if (o.isMesh && o.geometry?.boundingSphere?.radius > 700) { hidden.push(o); o.visible = false; } });
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const old = renderer.getRenderTarget();
  renderer.setRenderTarget(rt); renderer.setClearColor(0xc4c4b6, 1); renderer.clear(); renderer.render(scene, cam);
  const px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
  renderer.setRenderTarget(old); scene.fog = fog; hidden.forEach((o) => (o.visible = true));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H + 150;
  const c = cv.getContext('2d');
  const img = c.createImageData(W, H);
  for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
  c.putImageData(img, 0, 0);
  // wash the render lighter so labels read
  c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(0, 0, W, H);
  const P = (x, z) => [((x - X0) / (X1 - X0)) * W, ((z - Z0) / (Z1 - Z0)) * H];
  const zone = (x0, z0, x1, z1, col) => { const [a, b] = P(x0, z0), [d, e] = P(x1, z1); c.fillStyle = col; c.fillRect(a, b, d - a, e - b); c.strokeStyle = col.replace(/0\.\d+\)/, '0.9)'); c.lineWidth = 3; c.strokeRect(a, b, d - a, e - b); };
  const label = (x, z, t, sub, col = '#1b1b28', n = null) => {
    const [a, b] = P(x, z);
    c.font = 'bold 30px "Hiragino Sans", sans-serif'; const w1 = c.measureText(t).width;
    c.font = '22px "Hiragino Sans", sans-serif'; const w2 = sub ? c.measureText(sub).width : 0;
    const w = Math.max(w1, w2) + 24 + (n ? 44 : 0), h = sub ? 70 : 44;
    c.fillStyle = 'rgba(255,255,255,0.93)'; c.strokeStyle = col; c.lineWidth = 3;
    c.beginPath(); c.roundRect(a - w / 2, b - h / 2, w, h, 10); c.fill(); c.stroke();
    let tx = a - w / 2 + 12;
    if (n) { c.fillStyle = col; c.beginPath(); c.arc(tx + 16, b, 16, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(n, tx + 16, b + 1); tx += 44; }
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = col; c.font = 'bold 30px "Hiragino Sans", sans-serif'; c.fillText(t, tx, sub ? b - 14 : b);
    if (sub) { c.fillStyle = '#44445a'; c.font = '22px "Hiragino Sans", sans-serif'; c.fillText(sub, tx, b + 18); }
  };
  const cfg = await import('/src/config.js');
  const colors = { konbini: '#0068b7', view: '#0068b7', shops: '#b45a14', shrine: '#c0392b', home: '#7a5a20', lot: '#6a6a40', park: '#2f8a3a', plaza: '#c2336b', station: '#2f7a4a', crossing: '#6a5a2a', parking: '#3050a0' };
  cfg.PLACES.forEach((p, i) => {
    const w = cfg.placeAt(p);
    const [a, b] = P(w.x, w.z);
    c.fillStyle = colors[p.kind] ?? '#333';
    c.beginPath(); c.arc(a, b, 10, 0, 7); c.fill();
    label(w.x, w.z + (i % 2 ? 9 : -9), `${p.en}`, p.jp, colors[p.kind] ?? '#333', String(i + 1));
  });
  label(100, -140, '↑ North: Mt. Fuji', null, '#333');
  // legend strip
  c.fillStyle = '#1b1b28'; c.fillRect(0, H, W, 150);
  c.fillStyle = '#fff'; c.font = 'bold 40px "Hiragino Sans", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText('Lawson Fuji: the town moved between the Lawson and Fuji (M2e.3)', 30, H + 50);
  c.font = '26px "Hiragino Sans", sans-serif'; c.fillStyle = '#cfd0dc';
  c.fillText('Top-down render from the game. Up is north, toward Mt. Fuji. You start at 2 facing north: the town and the station lie ahead, past the store.', 30, H + 100);
  return cv.toDataURL('image/jpeg', 0.9);
});
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
await browser.close();
