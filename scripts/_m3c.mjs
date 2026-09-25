// dev helper (M3c, M3d): a scripted shopping trip through the real aiming
// code, checking counts, the wallet, the doors and the petals, with a
// screenshot at each step.   usage: node scripts/_m3c.mjs <outdir>
import { chromium } from 'playwright';
import fs from 'node:fs';
const out = process.argv[2] ?? '.';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://localhost:5178/?shots', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });

await page.evaluate(() => {
  const S = window.__store.shop, cam = window.__scene.camera;
  window.__toasts = [];
  S.flash = (t, err) => window.__toasts.push((err ? 'ERR ' : '') + t);
  window.__look = (px, pz, t) => {
    const dx = t.x - px, dz = t.z - pz;
    return { pos: [px, 0, pz], yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(t.y - 1.62, Math.hypot(dx, dz)) };
  };
  window.__aimShot = async (name, o, extra = {}) => {
    const r = await window.__shot(name, 1600, 900, { png: true, returnData: true, look: 'day', ...o, ...extra });
    const t = S.pick(cam);
    return { data: r.data, label: t?.label ?? null, t };
  };
  window.__find = (f) => S.debug.pickable.find(f);
  window.__state = (u) => ({ count: u.count, full: u.full });
  window.__price = window.__store.price;
});

const log = [];
let bad = 0;
const save = (name, data) => fs.writeFileSync(`${out}/${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
async function step(name, js, check) {
  const r = await page.evaluate(js);
  if (r.data) save(name, r.data);
  delete r.data;
  const ok = check ? check(r) : true;
  if (!ok) bad++;
  log.push([name, ok, r]);
  console.log(ok ? 'pass' : 'FAIL', name, JSON.stringify(r));
  return r;
}
const english = (s) => !!s && !/[぀-ヿ一-鿿]/.test(s);

await step('m3d-1-basket', async () => {
  const o = window.__look(-3.55, -1.7, { x: -4.3, y: 0.55, z: -0.9 });
  const a = await window.__aimShot('a', o);
  a.t?.action();
  const b = await window.__aimShot('b', o, { shop: 0.1 });
  return { before: a.label, after: b.label, hasBasket: window.__store.shop.hasBasket, data: b.data };
}, (r) => r.hasBasket && english(r.before) && english(r.after));

await step('m3d-2-door-stays', async () => {
  const u = window.__find((u) => u.slot.zone === 'drinks' && u.slot.bay === 3 && u.slot.level === 3);
  window.__u1 = u;
  const o = window.__look(u.centre.x + 0.3, -11.05, u.centre);
  const a = await window.__aimShot('a', o);
  a.t?.action();
  const b = await window.__aimShot('b', o, { shop: 10 });          // ten seconds at the door
  return { closed: a.label, afterTenSeconds: b.label, open: u.door.want, data: b.data };
}, (r) => r.open === 1 && /^Open/.test(r.closed) && /^Take /.test(r.afterTenSeconds));

await step('m3d-3-take-drink', async () => {
  const u = window.__u1;
  const o = window.__look(u.centre.x + 0.3, -11.05, u.centre);
  const a = await window.__aimShot('a', o);
  const before = window.__state(u);
  a.t?.action();
  const b = await window.__aimShot('b', o, { shop: 0.17 });
  return { label: a.label, before, after: window.__state(u), total: window.__store.shop.total(), data: b.data };
}, (r) => english(r.label) && r.after.count === r.before.count - 1);

await step('m3d-4-chilled', async () => {
  const S = window.__store.shop;
  const picks = [
    S.debug.pickable.find((u) => u.slot.zone === 'chilled' && u.id.startsWith('onigiri') && u.slot.level === 2),
    S.debug.pickable.find((u) => u.slot.zone === 'chilled' && u.id === 'fruit_sando'),
  ];
  window.__oni = picks[0];
  const labels = [];
  let last;
  for (const u of picks) {
    const o = window.__look(-6.3, u.centre.z, u.centre);
    const a = await window.__aimShot('a', o);
    labels.push(a.label);
    a.t?.action();
    last = await window.__aimShot('b', o, { shop: 0.5 });
  }
  return { labels, cart: S.cart.map((c) => c.id), total: S.total(), data: last.data };
}, (r) => r.labels.every(english) && r.cart.length === 3);

// the wallet: something that would take the basket over ¥1,000 stays on the shelf
await step('m3d-5-wallet', async () => {
  const S = window.__store.shop;
  const left = 1000 - S.total();
  const u = S.debug.pickable.find((u) => u.slot.zone === 'gondola' && window.__price(u.id) > left);
  const o = window.__look(u.centre.x + 0.75 * u.slot.side, u.centre.z, u.centre);
  const before = window.__state(u);
  const a = await window.__aimShot('a', o);
  window.__toasts.length = 0;
  a.t?.action();
  const b = await window.__aimShot('b', o, { shop: 0.2 });
  return { id: u.id, left, before, after: window.__state(u), cart: S.cart.length, toast: window.__toasts[0], data: b.data };
}, (r) => r.after.count === r.before.count && r.cart === 3 && /^ERR Not enough money/.test(r.toast));

await step('m3d-6-putback', async () => {
  const S = window.__store.shop, P = window.__store.panel;
  window.__store.setPanel(true);
  const rows = [...new Set(S.cart.map((c) => c.id))];
  P.move(rows.indexOf(window.__oni.id));
  const item = P.chosen(), u = item.u, before = window.__state(u);
  S.putBack(item);
  await window.__aimShot('b', window.__look(-6.3, u.centre.z + 1.2, { x: -7.4, y: 1.2, z: u.centre.z }), { shop: 0.5 });
  window.__store.setPanel(false);
  return { before, after: window.__state(u), cart: S.cart.map((c) => c.id) };
}, (r) => r.after.count === r.before.count + 1 && r.cart.length === 2);

// a door shuts when you aim at its open leaf and press E
await step('m3d-7-door-close', async () => {
  const D = window.__store.shop.debug.doors.list;
  const d = D[3];
  window.__store.shop.debug.doors.open(d);
  await window.__aimShot('x', { pos: [-2.8, 0, -10.6], yaw: 0, pitch: 0 }, { shop: 1 });
  const c = d.openBox.getCenter(new window.__scene.THREE.Vector3());
  const o = window.__look(c.x + 0.9, c.z + 0.6, { x: c.x, y: 1.2, z: c.z });
  const a = await window.__aimShot('a', o);
  a.t?.action();
  const b = await window.__aimShot('b', o, { shop: 0.6 });
  return { label: a.label, want: d.want, open: +d.open.toFixed(2), data: a.data };
}, (r) => r.label === 'Close the door' && r.want === 0 && r.open === 0);

// and when you walk off
await step('m3d-8-door-walk', async () => {
  const D = window.__store.shop.debug.doors;
  const d = D.list[1];
  D.open(d);
  await window.__aimShot('a', { pos: [d.box.getCenter(new window.__scene.THREE.Vector3()).x, 0, -11.0], yaw: 0, pitch: 0 }, { shop: 1 });
  const near = d.want;
  await window.__aimShot('b', { pos: [0, 0, -6], yaw: 0, pitch: 0 }, { shop: 1 });
  return { openWhileNear: near, openAfterWalkingOff: d.want };
}, (r) => r.openWhileNear === 1 && r.openAfterWalkingOff === 0);

await step('m3d-9-leave', async () => {
  const S = window.__store.shop;
  const tracked = S.cart.map((c) => c.u);
  await window.__aimShot('a', { pos: [-2.3, 0, -0.5], yaw: 3.14, pitch: 0 });
  window.__toasts.length = 0;
  await window.__aimShot('b', { pos: [-2.3, 0, 1.5], yaw: 3.14, pitch: 0 }, { shop: 0.1 });
  return { cart: S.cart.length, basket: S.hasBasket, restored: tracked.every((u) => u.count === u.full), toast: window.__toasts[0] };
}, (r) => r.cart === 0 && !r.basket && r.restored && english(r.toast));

// no petals inside the store, over 600 frames by the storefront
await step('m3d-10-petals', async () => {
  const { world, camera, THREE } = window.__scene;
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  camera.position.set(-2, 1.6, 3);
  let inside = 0, seen = 0;
  for (let f = 0; f < 600; f++) {
    world.update(1 / 60, camera);
    if (f % 10) continue;
    for (const mesh of world.petalMeshes) {
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, m); p.setFromMatrixPosition(m); seen++;
        if (p.x > -8.5 && p.x < 11.1 && p.z > -13 && p.z < 0 && p.y < 4 && p.y > 0) inside++;
      }
    }
  }
  return { samples: seen, inside };
}, (r) => r.inside === 0);

fs.writeFileSync(`${out}/m3d-log.json`, JSON.stringify(log, null, 1));
if (errs.length) console.log('PAGE ERRORS', errs);
console.log(bad ? `${bad} FAILED` : 'all passed');
await browser.close();
