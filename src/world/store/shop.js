import * as THREE from 'three';
import { STORE, LAWSON } from '../../config.js';
import { PRODUCT } from '../../data/catalog.js';
import { STRINGS } from '../../data/strings.js';
import { productGeometry, placeUnit } from './products.js';
import { basketModel, packBasket, onTop, BASKET } from './basket.js';

/* ------------------------------------------------------------------ *
 * Shopping (M3c; SPEC 5 and 6.3).
 *
 * Aiming: inside the store the crosshair's ray is tested against plain
 * boxes -- one per shelf facing (the front unit and the rows behind it),
 * the fridge doors, the basket stack -- not against the meshes, so the
 * thousands of facings cost a fraction of a millisecond, and only indoors.
 *
 * Taking: the facing's count drops, the next one slides forward (the
 * gravity shelf, the pushed-up row), the rows behind thin out, and when
 * the last goes the gap shows.  The unit itself arcs into the basket in
 * view.  Putting back runs the same arc the other way, to its own slot.
 *
 * The basket: optional.  Without one you hold two things at most.  Walk
 * out with anything unpaid and it all goes back, with the basket.
 * ------------------------------------------------------------------ */

const ZONES = new Set(['drinks', 'chilled', 'gondola', 'endcap', 'icecase', 'freezer', 'selfserve']);
const IN_VIEW = new THREE.Vector3(-0.34, -0.45, -0.84);        // the basket, in the camera's frame
const IN_HAND = [new THREE.Vector3(0.3, -0.2, -0.64), new THREE.Vector3(0.19, -0.22, -0.68)];
const hw = LAWSON.width / 2;

export function makeShop(inside, { doors, lit }) {
  const units = inside.userData.units;
  const stackAt = inside.userData.basketStack;

  /* ---------------- the facings you can take, as boxes ---------------- */
  const pickable = [];
  const bb = new THREE.Box3(), m4 = new THREE.Matrix4();
  for (const u of units) {
    if (u.front || !ZONES.has(u.slot?.zone)) continue;
    const box = new THREE.Box3();
    for (const v of [u, ...u.backs]) {
      v.mesh.getMatrixAt(v.index, m4);
      box.union(bb.copy(productGeometry(v.id).boundingBox).applyMatrix4(m4));
    }
    u.box = box;
    u.centre = box.getCenter(new THREE.Vector3());
    u.full = u.count;
    u.depth = productGeometry(u.id).boundingBox.max.z - productGeometry(u.id).boundingBox.min.z + 0.012;
    const h = u.slot.zone;
    u.door = doors.list.find((d) => d.spec.holds.zone === h
      && u.centre[d.spec.holds.axis] >= d.spec.holds.a && u.centre[d.spec.holds.axis] < d.spec.holds.b) ?? null;
    pickable.push(u);
  }

  /* ----------------------- the basket stack, its top ----------------------- */
  const top = basketModel(lit);
  top.position.set(stackAt.x, stackAt.y, stackAt.z);
  top.userData.dynamic = true;
  inside.add(top);
  const stackBox = new THREE.Box3(
    new THREE.Vector3(stackAt.x - 0.26, 0, stackAt.z - 0.19), new THREE.Vector3(stackAt.x + 0.26, stackAt.y + BASKET.h, stackAt.z + 0.19));

  /* ----------------- what you carry, drawn over the world ----------------- */
  const view = new THREE.Group();          // follows the camera (main.js adds it to the scene)
  view.matrixAutoUpdate = false;
  view.name = 'shop-view';
  const fx = new THREE.Group();            // flights, in world terms
  fx.name = 'shop-fx';
  const held = basketModel(lit);
  held.traverse((o) => { if (o.isMesh) { onTop(o.material); o.renderOrder = 10; o.frustumCulled = false; } });
  held.visible = false;
  held.rotation.set(0.5, 0.45, 0.04);
  view.add(held);
  const pageMat = new Map();
  const topMat = (u) => {
    const src = u.mesh.material;
    if (!pageMat.has(src)) { const m = onTop(src.clone()); lit.push(m); pageMat.set(src, m); }
    return pageMat.get(src);
  };
  const itemMesh = (u) => {
    const m = new THREE.Mesh(productGeometry(u.id), topMat(u));
    m.matrixAutoUpdate = false;
    m.frustumCulled = false;
    m.renderOrder = 11;
    return m;
  };

  /* ------------------------------- state ------------------------------- */
  const cart = [];            // { id, u } in the order taken
  let hasBasket = false;
  const flights = [];
  const slides = [];
  const showing = [];         // meshes in the basket or the hands
  let wasInside = false;
  const api = {
    view, fx,
    get cart() { return cart; },
    get hasBasket() { return hasBasket; },
    onChange: null,           // main.js: the badge and the panel
    flash: null,              // main.js: hud.flash
  };

  /* ----------------------------- visuals ----------------------------- */
  function refreshSlot(u) {
    [u, ...u.backs].forEach((v, i) => placeUnit(v, 0, i >= u.count));
    u.mesh.instanceMatrix.needsUpdate = true;
  }
  function layout() {
    for (const m of showing) m.parent?.remove(m);
    showing.length = 0;
    held.visible = hasBasket;
    const landed = cart.filter((c) => !c.flying);
    if (hasBasket) {
      const mats = packBasket(landed.map((c) => c.id), STORE.basketShown);
      mats.forEach((mm, i) => {
        const m = itemMesh(landed[i].u);
        m.matrix.copy(mm);
        held.add(m); showing.push(m);
      });
    } else {
      landed.forEach((c, i) => {
        const m = itemMesh(c.u);
        m.matrixAutoUpdate = true;
        m.position.copy(IN_HAND[i] ?? IN_HAND[1]);
        m.rotation.set(0.35, -0.5, 0);
        const g = productGeometry(c.id).boundingBox;
        m.position.y -= (g.max.y - g.min.y) / 2;
        view.add(m); showing.push(m);
      });
    }
    api.onChange?.();
  }

  /** Where the i-th item sits now, in world terms (the end of a flight in). */
  const _w = new THREE.Matrix4();
  function slotWorld(i, id, out) {
    if (hasBasket) {
      const mats = packBasket([...cart.filter((c) => !c.flying).map((c) => c.id), id], STORE.basketShown);
      held.updateMatrix();
      out.copy(view.matrix).multiply(held.matrix).multiply(mats[Math.min(i, mats.length - 1)]);
    } else {
      _w.compose(IN_HAND[Math.min(i, 1)], new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, -0.5, 0)), new THREE.Vector3(1, 1, 1));
      out.copy(view.matrix).multiply(_w);
    }
    return out;
  }
  function unitWorld(u, out) {
    u.mesh.getMatrixAt(u.index, out);
    return out.premultiply(inside.matrixWorld);
  }

  /* ----------------------------- actions ----------------------------- */
  function take(u) {
    if (!hasBasket && cart.length >= STORE.carry) { api.flash?.(STRINGS.store.handsFull); return; }
    const from = unitWorld(u, new THREE.Matrix4());
    u.count--;
    const item = { id: u.id, u, flying: true };
    cart.push(item);
    const mesh = itemMesh(u);
    fx.add(mesh);
    flights.push({ item, mesh, t: 0, from, into: true });
    // the next one comes forward; the rows behind thin out; the gap shows
    refreshSlot(u);
    if (u.count > 0 && u.slot.zone !== 'icecase') slides.push({ u, t: -0.08 });
    else if (u.count <= 0) highlight(null);
    api.onChange?.();
  }
  /** Put the cart's item back (from the panel): it flies to its own slot. */
  function putBack(item) {
    const i = cart.indexOf(item);
    if (i < 0 || item.flying) return;
    const from = new THREE.Matrix4();
    const shown = showing[cart.filter((c) => !c.flying).indexOf(item)];
    if (shown) { shown.updateMatrixWorld(); from.copy(shown.matrixWorld); } else slotWorld(0, item.id, from);
    cart.splice(i, 1);
    const mesh = itemMesh(item.u);
    fx.add(mesh);
    flights.push({ item, mesh, t: 0, from, into: false });
    layout();
  }
  /** Everything unpaid goes back at once, and the basket to its stack. */
  function returnAll() {
    for (const f of flights) { fx.remove(f.mesh); if (!f.into) { f.item.u.count++; refreshSlot(f.item.u); } }
    flights.length = 0;
    for (const c of cart) { c.u.count++; refreshSlot(c.u); }
    cart.length = 0;
    hasBasket = false;
    top.visible = true;
    layout();
  }

  /* the rim on what you aim at: its own shape, a touch larger, back faces only */
  const rimMat = new THREE.MeshBasicMaterial({ color: 0x9fd0ff, side: THREE.BackSide, transparent: true, opacity: 0.85, depthWrite: false });
  const rim = new THREE.Mesh(new THREE.BufferGeometry(), rimMat);
  rim.matrixAutoUpdate = false;
  rim.visible = false;
  rim.userData.noOutline = true;
  rim.userData.dynamic = true;
  rim.renderOrder = 4;
  inside.add(rim);
  const _s = new THREE.Matrix4(), _cc = new THREE.Vector3();
  let rimOn = null;
  function highlight(u) {
    if (u === rimOn && (!u || rim.visible)) return;
    rimOn = u;
    rim.visible = !!u;
    if (!u) return;
    const g = productGeometry(u.id);
    rim.geometry = g;
    // grow about the product's own middle
    g.boundingBox.getCenter(_cc);
    const k = 1.1;
    _s.makeTranslation(_cc.x, _cc.y, _cc.z).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(new THREE.Matrix4().makeTranslation(-_cc.x, -_cc.y, -_cc.z));
    u.mesh.getMatrixAt(u.index, rim.matrix);
    rim.matrix.multiply(_s);
    rim.matrixWorldNeedsUpdate = true;
  }

  /* ----------------------------- aiming ----------------------------- */
  const ray = new THREE.Ray(), inv = new THREE.Matrix4(), hit = new THREE.Vector3(), eye = new THREE.Vector3();
  const targets = new Map();
  const target = (key, make) => targets.get(key) ?? targets.set(key, make()).get(key);
  function aim(camera) {
    inv.copy(inside.matrixWorld).invert();
    camera.getWorldPosition(ray.origin);
    camera.getWorldDirection(ray.direction);
    ray.applyMatrix4(inv);
    eye.copy(ray.origin);
    const R = STORE.reach;
    let best = null, bestT = R;
    for (const u of pickable) {
      if (u.count <= 0) continue;
      const c = u.centre;
      if (Math.abs(c.x - eye.x) > R + 0.5 || Math.abs(c.z - eye.z) > R + 0.5) continue;
      if (!ray.intersectBox(u.box, hit)) continue;
      const t = hit.distanceTo(eye);
      if (t < bestT) { bestT = t; best = u; }
    }
    // a shut door is in the way of what is behind it
    let door = null;
    for (const d of doors.list) {
      if (d.want || d.open > 0.5) continue;
      if (!ray.intersectBox(d.box, hit)) continue;
      const t = hit.distanceTo(eye);
      if (t <= bestT + 0.02 && t <= R) { door = d; bestT = t; }
    }
    if (best?.door && !best.door.want && best.door.open < 0.5) door = best.door;
    if (door) return target('door' + door.i, () => ({ label: STRINGS.store.openDoor, action: () => doors.open(door) }));
    if (ray.intersectBox(stackBox, hit) && hit.distanceTo(eye) < Math.min(bestT, R)) {
      if (!hasBasket) return target('basket', () => ({ label: STRINGS.store.takeBasket, action: takeBasket }));
      if (!cart.length) return target('unbasket', () => ({ label: STRINGS.store.returnBasket, action: dropBasket }));
    }
    if (!best) return null;
    return target(best, () => ({ label: STRINGS.store.take(PRODUCT[best.id].nameJa), action: () => take(best), unit: best }));
  }
  function takeBasket() { hasBasket = true; top.visible = false; layout(); }
  function dropBasket() { hasBasket = false; top.visible = true; layout(); }

  /* ------------------------------- frame ------------------------------- */
  const ease = (t) => t * t * (3 - 2 * t);
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), sa = new THREE.Vector3();
  const endM = new THREE.Matrix4(), local = new THREE.Vector3();
  /** Is `camera` inside the store? */
  api.inside = (camera) => {
    local.copy(camera.position).applyMatrix4(inv.copy(inside.matrixWorld).invert());
    return local.x > -hw && local.x < hw && local.z < 0 && local.z > -LAWSON.depth;
  };
  api.pick = (camera) => {
    const t = aim(camera);
    highlight(t?.unit ?? null);
    return t;
  };
  api.clearAim = () => highlight(null);
  api.putBack = putBack;
  api.returnAll = returnAll;
  api.update = (dt, camera, bob = 0) => {
    camera.updateMatrixWorld();
    view.matrix.copy(camera.matrixWorld);
    view.matrixWorldNeedsUpdate = true;
    held.position.copy(IN_VIEW);
    held.position.y += Math.sin(bob) * 0.006;
    held.position.x += Math.cos(bob * 0.5) * 0.004;

    // walking out with anything unpaid puts it all back
    const inNow = api.inside(camera);
    if (wasInside && !inNow && local.z > 0 && (cart.length || hasBasket)) {
      const had = cart.length;
      returnAll();
      if (had) api.flash?.(STRINGS.store.notOut);
    }
    wasInside = inNow;
    doors.update(dt, local);

    for (let k = slides.length - 1; k >= 0; k--) {
      const s = slides[k];
      s.t += dt / STORE.slide;
      const e = ease(Math.max(0, Math.min(1, s.t)));
      placeUnit(s.u, s.u.depth * (1 - e), s.u.count <= 0);
      s.u.mesh.instanceMatrix.needsUpdate = true;
      if (s.t >= 1) { slides.splice(k, 1); refreshSlot(s.u); }
    }

    for (let k = flights.length - 1; k >= 0; k--) {
      const f = flights[k];
      f.t += dt / STORE.flight;
      const e = ease(Math.min(1, f.t));
      if (f.into) slotWorld(cart.filter((c) => !c.flying).length, f.item.id, endM);
      else unitWorld(f.item.u, endM);
      f.from.decompose(pa, qa, sa);
      endM.decompose(pb, qb, sa);
      pa.lerp(pb, e);
      pa.y += Math.sin(Math.PI * e) * 0.12;
      qa.slerp(qb, e);
      f.mesh.matrix.compose(pa, qa, sa.set(1, 1, 1));
      f.mesh.matrixWorldNeedsUpdate = true;
      if (f.t >= 1) {
        fx.remove(f.mesh);
        flights.splice(k, 1);
        if (f.into) { f.item.flying = false; layout(); }
        else { f.item.u.count++; refreshSlot(f.item.u); api.onChange?.(); }
      }
    }
  };

  if (import.meta.env?.DEV) {
    api.debug = { pickable, doors, take, takeBasket, get slides() { return slides; }, get flights() { return flights; } };
  }
  return api;
}
