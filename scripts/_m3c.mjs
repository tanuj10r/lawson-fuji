// dev helper (M3c): a scripted shopping trip through the real aiming code,
// checking counts and instances, with a screenshot at each step.
// usage: node scripts/_m3c.mjs <outdir>
import { chromium } from 'playwright';
import fs from 'node:fs';
const out = process.argv[2] ?? '.';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:5178/?shots', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });

await page.evaluate(() => {
  const S = window.__store.shop, D = S.debug, cam = window.__scene.camera;
  /** Stand at (px, pz) and look at a point; returns the __shot options. */
  window.__look = (px, pz, t) => {
    const dx = t.x - px, dz = t.z - pz;
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.atan2(t.y - 1.62, Math.hypot(dx, dz));
    return { pos: [px, 0, pz], yaw, pitch };
  };
  window.__aimShot = async (name, o, extra = {}) => {
    const r = await window.__shot(name, 1600, 900, { png: true, returnData: true, look: 'day', ...o, ...extra });
    const t = S.pick(cam);
    return { data: r.data, label: t?.label ?? null, t };
  };
  window.__find = (f) => D.pickable.find(f);
  window.__state = (u) => ({ count: u.count, full: u.full, hidden: [u, ...u.backs].map((v) => { const m = new window.__scene.THREE.Matrix4(); v.mesh.getMatrixAt(v.index, m); return m.elements[0] === 0; }) });
});

const log = [];
const save = (name, data) => fs.writeFileSync(`${out}/${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
async function step(name, js) {
  const r = await page.evaluate(js);
  if (r.data) save(name, r.data);
  if (r.data2) save(name + 'b', r.data2);
  delete r.data; delete r.data2;
  log.push([name, r]);
  console.log(name, JSON.stringify(r));
  return r;
}

// 1. the basket stack by the door
await step('m3c-1-basket', async () => {
  const o = window.__look(-3.55, -1.7, { x: -4.3, y: 0.55, z: -0.9 });
  const a = await window.__aimShot('a', o);
  a.t?.action();
  const b = await window.__aimShot('b', o, { shop: 0.1 });
  return { before: a.label, after: b.label, hasBasket: window.__store.shop.hasBasket, data: b.data };
});
// 2. the cooler: door 3 (sports), the eye-level shelf
await step('m3c-2-door', async () => {
  const u = window.__find((u) => u.slot.zone === 'drinks' && u.slot.bay === 3 && u.slot.level === 3 && u.centre.x > -3.4);
  window.__u1 = u;
  const o = window.__look(u.centre.x + 0.3, -11.05, u.centre);
  const a = await window.__aimShot('a', o);
  a.t?.action();
  const b = await window.__aimShot('b', o, { shop: 0.15 });
  return { id: u.id, closed: a.label, open: b.label, data: b.data };
});
await step('m3c-3-take-drink', async () => {
  const u = window.__u1;
  const o = window.__look(u.centre.x + 0.3, -11.05, u.centre);
  const a = await window.__aimShot('a', o);
  const before = window.__state(u);
  a.t?.action();
  const mid = await window.__aimShot('mid', o, { shop: 0.17 });
  const b = await window.__aimShot('b', o, { shop: 0.4 });
  return { label: a.label, before, after: window.__state(u), cart: window.__store.shop.cart.length, data: mid.data, data2: b.data };
});
// 3. two onigiri and a fruit sando from the chilled case
await step('m3c-4-onigiri', async () => {
  const S = window.__store.shop;
  const us = window.__store.shop.debug.pickable.filter((u) => u.slot.zone === 'chilled' && u.id.startsWith('onigiri') && u.slot.level === 2).slice(0, 2);
  const f = window.__find((u) => u.slot.zone === 'chilled' && u.id === 'fruit_sando');
  window.__oni = us[0];
  const labels = [];
  let last;
  for (const u of [...us, f]) {
    const o = window.__look(-6.3, u.centre.z, u.centre);
    const a = await window.__aimShot('a', o);
    labels.push(a.label);
    a.t?.action();
    last = await window.__aimShot('b', o, { shop: 0.5 });
  }
  return { labels, cart: S.cart.map((c) => c.id), data: last.data };
});
// 4. an ice cup from the flat case
await step('m3c-5-ice', async () => {
  const u = window.__find((u) => u.slot.zone === 'icecase' && /ice_vanilla|ice_choco$/.test(u.id));
  const o = window.__look(u.centre.x + (u.slot.side > 0 ? 0.75 : -0.75), u.centre.z, u.centre);
  const a = await window.__aimShot('a', o);
  a.t?.action();
  const b = await window.__aimShot('b', o, { shop: 0.5 });
  return { label: a.label, cart: window.__store.shop.cart.length, data: b.data };
});
// 5. the panel: put an onigiri back (to its own slot)
await step('m3c-6-panel', async () => {
  const S = window.__store.shop, P = window.__store.panel;
  window.__store.setPanel(true);
  const rows = [...new Set(S.cart.map((c) => c.id))];
  P.move(rows.indexOf(window.__oni.id));
  const item = P.chosen();
  const u = item.u;
  window.__put = { u, before: window.__state(u) };
  const a = await window.__aimShot('a', window.__look(-6.3, u.centre.z + 1.2, { x: -7.4, y: 1.2, z: u.centre.z }));
  return { data: a.data };
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/m3c-6-panel-ui.png` });
await step('m3c-6-putback', async () => {
  const S = window.__store.shop, P = window.__store.panel;
  const { u, before } = window.__put;
  S.putBack(P.chosen());
  const mid = window.__state(u);
  const b = await window.__aimShot('b', window.__look(-6.3, u.centre.z + 1.2, { x: -7.4, y: 1.2, z: u.centre.z }), { shop: 0.5 });
  window.__store.setPanel(false);
  return { before, inFlight: mid, after: window.__state(u), cart: S.cart.map((c) => c.id), data: b.data };
});
// 5b. empty a facing: the gap shows, and aiming skips it
await step('m3c-6-empty', async () => {
  const S = window.__store.shop;
  const u = S.debug.pickable.find((u) => u.slot.zone === 'drinks' && u.slot.bay === 1 && u.slot.level === 3);
  const o = window.__look(u.centre.x, -11.05, u.centre);
  // the door first
  let a = await window.__aimShot('a', o);
  a.t?.action();
  await window.__aimShot('a', o, { shop: 0.4 });
  const n = u.count;
  for (let k = 0; k < n; k++) S.debug.take(u);
  const b = await window.__aimShot('b', o, { shop: 0.6 });
  return { took: n, after: window.__state(u), aimedNow: b.t?.unit === u, data: b.data };
});
// 6. walk out with it all
await step('m3c-7-leave', async () => {
  const S = window.__store.shop;
  const tracked = S.cart.map((c) => c.u);
  await window.__aimShot('a', { pos: [-2.3, 0, -0.5], yaw: 3.14, pitch: 0 });
  const b = await window.__aimShot('b', { pos: [-2.3, 0, 1.5], yaw: 3.14, pitch: 0 }, { shop: 0.1 });
  return { cart: S.cart.length, basket: S.hasBasket, restored: tracked.map((u) => u.count === u.full) };
});
// 7. without a basket: two in hand, the third refused
await step('m3c-8-hands', async () => {
  const S = window.__store.shop;
  const us = S.debug.pickable.filter((u) => u.slot.zone === 'gondola' && u.slot.gi === 1 && u.slot.side === 1 && u.slot.level === 3).slice(0, 3);
  let last;
  for (const u of us) {
    const o = window.__look(u.centre.x + 0.75, u.centre.z, u.centre);
    const a = await window.__aimShot('a', o);
    a.t?.action();
    last = await window.__aimShot('b', o, { shop: 0.5 });
  }
  return { cart: S.cart.length, data: last.data };
});

fs.writeFileSync(`${out}/m3c-log.json`, JSON.stringify(log, null, 1));
if (errs.length) console.log('PAGE ERRORS', errs);
await browser.close();
