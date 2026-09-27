import * as THREE from 'three';
import { STORE, LAWSON } from '../../config.js';
import { PRODUCT, FEATURED } from '../../data/catalog.js';
import { STRINGS } from '../../data/strings.js';
import { soundBus } from '../../core/soundBus.js';
import { productGeometry, placeUnit, unitMatrix } from './products.js';
import { onTopClamped, ease, easeOut, clamp01 } from './figure.js';
import { makeHands, coinGeometry } from './hands.js';
import { makeCashier } from './cashier.js';
import { makeEating } from './eat.js';

/* ------------------------------------------------------------------ *
 * The Nippon Konbini (Tan's experience; SPEC 6 made simple).
 *
 * Everybody has ¥1,000.  Walk in to the chime and "irasshaimase", and your
 * two hands rise into view: the left holds the folded note, the right
 * takes what you pick.  Four things glow: the sando case (an egg sando and
 * a fruit sando side by side), the onigiri, the Strong Nine in the chu-hi
 * fridge and the Choco Wafer Jumbo in the ice case.  Take up to two (E);
 * X puts the last one back.  Everything else on the shelves is scenery.
 *
 * At the till (E) the cashier scans each one, says the total, your left
 * hand pays, the change comes back into it, "arigatou gozaimasu".  You
 * can't walk out with anything unpaid: the door stays shut and says so.
 * Outside you eat it all, first person.  Then the spot by the door is
 * marked done, and you can go in again: a fresh ¥1,000 each visit.
 *
 * Aiming is boxes, not meshes (M3c): the featured facings, and the till.
 * Only indoors.  The hands, what they hold and the flights are drawn on
 * top of the world (store/figure.js).
 * ------------------------------------------------------------------ */

const hw = LAWSON.width / 2;
const S = STRINGS.store;
const Q = Math.PI / 2;
/* every total two of the featured things can come to: each has its own
 * spoken line (scripts/gen-voices.mjs makes the same list) */
const PRICES = FEATURED.flatMap((f) => f.ids).map((id) => PRODUCT[id].priceYen);
export const TOTALS = new Set(PRICES.flatMap((a, i) => [a, ...PRICES.slice(i).map((b) => a + b)]));
/* the till: the register the cashier stands at, and what is on its counter (store frame) */
const REG_Z = STORE.till.z;
const TILL = {
  cashier: new THREE.Vector3(STORE.till.x, 0.02, REG_Z),
  box: new THREE.Box3(new THREE.Vector3(5.95, 0.85, REG_Z - 0.62), new THREE.Vector3(7.9, 1.95, REG_Z + 0.62)),
  // either side of the customer display's post, on the counter in front of the register
  put: [new THREE.Vector3(6.3, 0.975, REG_Z - 0.23), new THREE.Vector3(6.3, 0.975, REG_Z + 0.21)],
  scan: new THREE.Vector3(6.6, 1.26, REG_Z - 0.05),              // lifted over the register's scanner
  bag: [new THREE.Vector3(6.62, 0.975, REG_Z + 0.38), new THREE.Vector3(6.6, 0.975, REG_Z + 0.52)],
  tray: new THREE.Vector3(6.18, 0.995, REG_Z - 0.38),
  // where you stand to pay, and where you look
  stand: new THREE.Vector3(5.3, 0, REG_Z - 0.05),
  look: new THREE.Vector3(6.9, 1.3, REG_Z - 0.02),
};

export function makeShop(inside, { doors, lit }) {
  const units = inside.userData.units;

  /* ------------------- the featured facings, as boxes ------------------- */
  const pickable = [];
  const bb = new THREE.Box3(), m4 = new THREE.Matrix4();
  for (const u of units) {
    if (u.front || !u.feature) continue;
    const box = new THREE.Box3();
    for (const w of [u, ...u.backs]) {
      unitMatrix(w, m4);
      box.union(bb.copy(productGeometry(w.id).boundingBox).applyMatrix4(m4));
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

  /* ---- the four spots: a soft glow behind the block and on its shelf edge, a marker ----
   * Only while you are inside (the famous views never see them).  All of it is
   * userData.dynamic: the town's static merge must not bake it in place. */
  const glowTex = (radial) => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = radial ? 64 : 32;
    const g = c.getContext('2d');
    const gr = radial ? g.createRadialGradient(32, 32, 2, 32, 32, 32) : g.createLinearGradient(0, 0, 0, 32);
    if (radial) { gr.addColorStop(0, 'rgba(255,226,140,1)'); gr.addColorStop(0.55, 'rgba(255,214,110,0.55)'); gr.addColorStop(1, 'rgba(255,214,110,0)'); }
    else { gr.addColorStop(0, 'rgba(255,215,106,0)'); gr.addColorStop(0.5, 'rgba(255,236,160,1)'); gr.addColorStop(1, 'rgba(255,215,106,0)'); }
    g.fillStyle = gr; g.fillRect(0, 0, 64, c.height);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const glow = { depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 };
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex(false), ...glow });
  const haloMat = new THREE.MeshBasicMaterial({ map: glowTex(true), ...glow });
  const gemMat = new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 });
  const gemGeo = new THREE.OctahedronGeometry(0.05, 0).scale(1, 1.5, 1);
  const spots = FEATURED.map((f) => {
    const us = pickable.filter((u) => u.feature === f.key);
    const box = new THREE.Box3();
    for (const u of us) box.union(u.box);
    const s = us[0]?.slot;
    const g = new THREE.Group();
    g.name = 'spot-' + f.key;
    g.visible = false;
    g.userData.dynamic = true;
    if (s) {
      const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      const along = s.zone === 'chilled' ? sz.z : sz.x;
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(along + 0.14, 0.12), glowMat);
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(along + 0.5, s.zone === 'icecase' ? sz.z + 0.35 : 0.5), haloMat);
      const gem = new THREE.Mesh(gemGeo, gemMat);
      if (s.zone === 'chilled') {                 // the rail faces the aisle (+x); the halo on the case's back
        strip.position.set(s.rail + 0.006, s.y - 0.03, c.z); strip.rotation.y = Q;
        halo.position.set(-hw + 0.28 + 0.125, s.y + 0.14, c.z); halo.rotation.y = Q;
        gem.position.set(s.rail + 0.12, s.y + 0.22, c.z);
      } else if (s.zone === 'drinks') {           // behind the fridge door: the rail, the cooler's back; the marker out front
        strip.position.set(c.x, s.y - 0.045, s.rail + 0.004);
        halo.position.set(c.x, s.y + 0.14, -LAWSON.depth + 0.28 + 0.06);
        gem.position.set(c.x, s.y + 0.26, s.rail + 0.2);
      } else {                                    // the ice case: its front rim, and the basket's floor
        strip.position.set(c.x, 0.815, -3.0 + 0.008);
        halo.position.set(c.x, 0.605, c.z); halo.rotation.x = -Q;
        gem.position.set(c.x, 1.1, c.z);
      }
      for (const m of [strip, halo, gem]) { m.userData.noOutline = true; m.renderOrder = 5; }
      g.add(halo, strip, gem);
      g.userData.gem = gem; g.userData.y = gem.position.y;
    }
    inside.add(g);
    return { ...f, units: us, box, group: g };
  });

  /* ----------------------------- the cast ----------------------------- */
  const view = new THREE.Group();          // follows the camera (main.js adds it to the scene)
  view.matrixAutoUpdate = false;
  view.name = 'shop-view';
  const fx = new THREE.Group();            // flights, in world terms
  fx.name = 'shop-fx';
  const hands = makeHands(lit);
  view.add(hands.view);
  const cashier = makeCashier(lit);
  cashier.root.position.copy(TILL.cashier);
  cashier.root.rotation.y = -Q;            // facing the shop
  cashier.root.userData.dynamic = true;
  inside.add(cashier.root);
  cashier.update(0);                        // her resting pose, even before you come near
  // the customer display on the register: the running total, shown while you pay
  const display = (() => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), new THREE.MeshBasicMaterial({ map: t }));
    mesh.position.set(6.1 + 0.04, 1.22, REG_Z);
    mesh.rotation.y = -Q;
    mesh.visible = false;
    mesh.userData.noOutline = true;
    mesh.userData.dynamic = true;
    inside.add(mesh);
    return {
      mesh,
      show(label, amount) {
        const g = c.getContext('2d');
        g.fillStyle = '#10141a'; g.fillRect(0, 0, 128, 64);
        g.fillStyle = '#58f08a'; g.font = 'bold 30px monospace'; g.textAlign = 'right'; g.textBaseline = 'middle';
        g.fillText(String(amount), 118, 36);
        g.font = 'bold 13px "Hiragino Kaku Gothic ProN", sans-serif'; g.textAlign = 'left'; g.fillText(label, 8, 14);
        t.needsUpdate = true;
        mesh.visible = true;
      },
    };
  })();

  /* what you carry: the product's own page material, drawn on top */
  const pageMat = new Map();
  const topMat = (u) => {
    const src = u.mat;
    if (!pageMat.has(src)) { const m = onTopClamped(src.clone()); lit.push(m); pageMat.set(src, m); }
    return pageMat.get(src);
  };
  const itemMesh = (u) => {
    const m = new THREE.Mesh(productGeometry(u.id), topMat(u));
    m.frustumCulled = false;
    m.renderOrder = 11;
    return m;
  };

  /* ------------------------------- state ------------------------------- */
  const held = [];              // { id, u, mesh, hand, paid, where: 'flying' | 'hand' | 'counter' }
  const flights = [], slides = [], pendingTakes = [];
  let wasInside = false, wallet = STORE.wallet, change = 0;
  let phase = 'out';            // out | shop | till | paid | eat
  let checkout = null;          // the running checkout's timeline
  let doorHint = false, primed = false;
  const api = {
    view, fx, hands, cashier,
    get held() { return held; },
    get phase() { return phase; },
    get wallet() { return wallet; },
    get busy() { return phase === 'till'; },
    get canPutBack() { return phase === 'shop' && held.some((h) => !h.paid && h.where === 'hand'); },
    onChange: null,            // main.js: the HUD
    onSay: null,               // main.js: a line spoken, for the subtitles
    flash: null,               // main.js: hud.flash
    onSound: null,             // main.js: (kind, unit?) -> the sound engine
    onEnter: null, onExit: null,
    player: null,              // main.js: the player, held still while you pay
    isFamousView: () => false, // main.js
    spot: null,                // lawson.js: the konbini's experience spot outside
  };
  const changed = () => api.onChange?.(api.hud());
  api.hud = () => ({
    wallet: phase === 'paid' || phase === 'eat' ? wallet : STORE.wallet - total(),
    slots: [0, 1].map((i) => { const h = held.find((x) => x.hand === i && x.where !== 'gone'); return h ? { id: h.id, paid: h.paid } : null; }),
    paid: phase === 'paid' || phase === 'eat',
    change,
    show: (wasInside || phase === 'paid' || phase === 'eat') && phase !== 'out',
  });

  /* ------------------------------ sounds ------------------------------ */
  const at = (p) => inside.localToWorld(p.clone());
  const tillAt = () => at(new THREE.Vector3(6.6, 1.1, REG_Z));
  /** A sound at the till (the beep, the drawer, the coins), heard only near it. */
  const tillSound = (name, recipe, gain = 1) => { const w = tillAt(); soundBus.oneShot(name, { x: w.x, y: w.y, z: w.z, ...STORE.tillSound, gain, recipe }); };
  /** The cashier says `line` (strings.js store.lines): her voice from where she stands, the subtitle, her mouth. */
  function say(key, file = 'v-' + key, text = S.lines[key]) {
    const w = at(new THREE.Vector3(STORE.till.x, 1.5, REG_Z));
    soundBus.oneShot(file, { x: w.x, y: w.y, z: w.z, ...STORE.voice, gain: 1, recipe: 'ui-tap' });
    cashier.talk(text.dur ?? 1.2);
    api.onSay?.(text);
  }
  /** Sounds at you (eating). */
  const EAT_RECIPE = { bite: 'soft', munch: 'paper', gulp: 'bottle', 'can-open': 'can', wrapper: 'plastic' };
  const mine = (name) => soundBus.oneShot(name, { gain: STORE.eatGain[name] ?? 0.8, recipe: EAT_RECIPE[name] });
  /* The engine plays a file only once it is decoded, and a recipe until then:
   * ask for them all quietly as you come near, so the first of each is real. */
  function prime() {
    if (primed || !soundBus.ready) return;
    primed = true;
    for (const n of ['v-irasshaimase', 'v-oazukari', 'v-arigatou', 'v-arigatou-mashita', 'v-total', 'till-beep', 'coins', 'register-drawer', 'bite', 'munch', 'gulp', 'can-open', 'wrapper']) soundBus.oneShot(n, { gain: 0 });
  }

  /* ----------------------------- flights ----------------------------- */
  /** Fly `mesh` from world matrix `from` to wherever `to()` says (a world matrix), then `done()`. */
  const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _sa = new THREE.Vector3(), _sb = new THREE.Vector3();
  function fly(mesh, from, to, { dur = STORE.flight, arc = 0.12, done = null } = {}) {
    mesh.matrixAutoUpdate = false;
    fx.add(mesh);
    const f = { mesh, from: from.clone(), to, t: 0, dur, arc, done };
    flights.push(f);
    return f;
  }
  const worldOf = (obj) => { obj.updateWorldMatrix(true, false); return obj.matrixWorld; };
  /** A thing on the counter at `p` (store frame), its front toward you. */
  const counterMatrix = (p, ry = -Q) => new THREE.Matrix4().makeRotationY(ry).setPosition(at(p));
  /** Hold `mesh` in the anchor, centred and facing you. */
  function holdIn(mesh, anchor) {
    mesh.matrixAutoUpdate = true;
    const c = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
    mesh.position.copy(c).multiplyScalar(-1);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.setScalar(1);
    anchor.add(mesh);
  }
  /** Where the cashier's right hand holds `mesh` (scanning it). */
  const gripMatrix = (mesh) => () => {
    const c = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
    return new THREE.Matrix4().copy(worldOf(cashier.arms.R.grip)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
  };
  const anchorMatrix = (i, mesh) => () => {
    const a = hands.anchor(i);
    const c = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
    return new THREE.Matrix4().copy(worldOf(a)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
  };

  /* ------------------------------ taking ------------------------------ */
  const total = () => held.filter((h) => !h.paid && h.where !== 'gone').reduce((n, h) => n + PRODUCT[h.id].priceYen, 0);
  const inHands = () => held.filter((h) => h.where !== 'gone');
  function refreshSlot(u) { [u, ...u.backs].forEach((w, i) => placeUnit(w, 0, i >= u.count)); }
  function take(u, doorOpen = false) {
    if (phase !== 'shop') return;
    if (inHands().length >= STORE.carry) { api.flash?.(S.handsFull); return; }
    const price = PRODUCT[u.id].priceYen;
    if (price > STORE.wallet - total()) { api.flash?.(S.noMoney(STORE.wallet - total(), price), true); api.onSound?.('refuse', u); return; }
    // the chu-hi is behind a fridge door: it swings open first
    if (u.door && u.door.open < 0.6 && !doorOpen) { doors.open(u.door); pendingTakes.push({ u, t: 0.32 }); return; }
    const hand = held.some((h) => h.hand === 0 && h.where !== 'gone') ? 1 : 0;
    const from = unitMatrix(u, new THREE.Matrix4()).premultiply(inside.matrixWorld);
    u.count--;
    const mesh = itemMesh(u);
    const h = { id: u.id, u, mesh, hand, paid: false, where: 'flying' };
    held.push(h);
    fly(mesh, from, anchorMatrix(hand, mesh), { done: () => { h.where = 'hand'; holdIn(mesh, hands.anchor(hand)); hands[hand ? 'L' : 'R'].item = h; changed(); } });
    api.onSound?.('take', u);
    refreshSlot(u);
    if (u.count > 0 && u.slot.zone !== 'icecase') slides.push({ u, t: -0.08 });
    changed();
  }
  /** Put the last unpaid thing back on its shelf (X). */
  function putBack() {
    const h = [...held].reverse().find((x) => !x.paid && x.where === 'hand');
    if (!h || phase !== 'shop') return false;
    const from = worldOf(h.mesh).clone();
    h.where = 'gone';
    hands[h.hand ? 'L' : 'R'].item = null;
    held.splice(held.indexOf(h), 1);
    fly(h.mesh, from, () => unitMatrix(h.u, new THREE.Matrix4()).premultiply(inside.matrixWorld), {
      done: () => { fx.remove(h.mesh); h.u.count++; refreshSlot(h.u); api.onSound?.('put', h.u); },
    });
    // the other one moves to the right hand, so the right is always the first
    const other = held.find((x) => x.where === 'hand' && x.hand === 1);
    if (other && h.hand === 0) {
      other.hand = 0; hands.L.item = null; hands.R.item = other;
      holdIn(other.mesh, hands.anchor(0));
    }
    changed();
    return true;
  }
  /** Walked out with unpaid things (a famous-view key, say): they go straight back. */
  function returnUnpaid() {
    let n = 0;
    for (const h of [...held]) {
      if (h.paid) continue;
      h.mesh.removeFromParent();
      if (h.where !== 'gone') { h.u.count++; refreshSlot(h.u); n++; }
      held.splice(held.indexOf(h), 1);
    }
    hands.R.item = held.find((x) => x.hand === 0) ?? null;
    hands.L.item = held.find((x) => x.hand === 1) ?? null;
    changed();
    return n;
  }

  /* ------------------------------ paying ------------------------------ */
  /* The checkout, as a timeline of moments (seconds from pressing E). */
  function startCheckout() {
    const items = held.filter((h) => !h.paid && h.where === 'hand');
    if (phase !== 'shop' || !items.length || flights.length) return;
    phase = 'till';
    const sum = total();
    // the total line: one said for this amount, if we have it
    const totalFile = TOTALS.has(sum) ? 'v-total-' + sum : 'v-total';
    soundBus.oneShot(totalFile, { gain: 0 });
    const ev = [];
    const T = (t, fn) => ev.push({ t, fn });
    const p = api.player;
    const from = p ? { yaw: p.yaw, pitch: p.pitch } : null;
    // face the till
    if (p) p.suspended = true;
    T(0, () => { cashier.lookAt = null; say('oazukari'); cashier.pose({ headX: 0.2, headY: 0 }); });
    items.forEach((h, i) => {
      // each goes onto the counter
      T(0.1 + i * 0.15, () => {
        const f = worldOf(h.mesh).clone();
        h.mesh.removeFromParent();
        hands[h.hand ? 'L' : 'R'].item = null;
        h.where = 'flying';
        fly(h.mesh, f, () => counterMatrix(TILL.put[i]), { dur: 0.42, done: () => { h.where = 'counter'; } });
      });
      // she leans in, takes it in her right hand, passes it over the scanner (beep), and sets it down by the bag
      const t0 = 0.7 + i * 0.85;
      T(t0, () => cashier.pose({ bow: 0.22, rShX: -1.25, rShZ: 0.05, rShY: 0, rElX: -0.25, twist: -0.1, headX: 0.35, headY: 0 }));
      T(t0 + 0.28, () => fly(h.mesh, counterMatrix(TILL.put[i]), gripMatrix(h.mesh), { dur: 0.22, arc: 0.04, done: () => holdIn(h.mesh, cashier.arms.R.grip) }));
      T(t0 + 0.5, () => cashier.pose({ bow: 0.05, rShX: -1.05, rElX: -0.7, rShY: 0.2, headX: 0.25 }));
      T(t0 + 0.62, () => { tillSound('till-beep', 'ui-tap', 0.9); display.show('小計', items.slice(0, i + 1).reduce((n, x) => n + PRODUCT[x.id].priceYen, 0)); });
      T(t0 + 0.78, () => {
        const f = worldOf(h.mesh).clone();
        h.mesh.removeFromParent();
        fly(h.mesh, f, () => counterMatrix(TILL.bag[i], -Q), { dur: 0.22, arc: 0.05 });
        cashier.pose({ rShY: -0.35, rShX: -0.8, rElX: -0.9 });
      });
    });
    const tn = 0.7 + items.length * 0.85 + 0.05;
    T(tn, () => { cashier.rest(); cashier.lookAt = lookTarget; say('total', totalFile, S.lines.total(sum)); display.show('合計', sum); });
    // the left hand pays: forward to the tray, the note left in it
    T(tn + 1.0, () => { hands.L.off.set(0, 0, 0); payReach = 0; });
    T(tn + 1.3, () => {
      hands.showNote(false);
      const note = hands.note.clone();
      note.traverse((o) => { o.frustumCulled = false; });
      trayNote = note;
      fly(note, worldOf(hands.note).clone(), () => new THREE.Matrix4().makeRotationX(-Q).setPosition(at(TILL.tray)), { dur: 0.4, arc: 0.05 });
    });
    T(tn + 1.7, () => { payReach = -1; });
    T(tn + 1.8, () => { cashier.pose({ lShX: -0.95, lShZ: 0.05, lElX: -0.5, twist: 0.1 }); });
    T(tn + 2.1, () => { trayNote?.removeFromParent(); trayNote = null; tillSound('register-drawer', 'box'); display.show('お預り', STORE.wallet); cashier.pose({ lShX: -0.3, lElX: -1.2 }); });
    change = STORE.wallet - sum;
    T(tn + 2.55, () => {
      display.show('おつり', change);
      if (change <= 0) return;
      const coins = new THREE.Mesh(coinGeometry(change), hands.skinMat);
      coins.frustumCulled = false; coins.renderOrder = 11;
      fly(coins, new THREE.Matrix4().setPosition(at(TILL.tray)), () => worldOf(hands.coins).clone(), { dur: 0.45, arc: 0.1, done: () => { fx.remove(coins); hands.setChange(change); tillSound('coins', 'can', 0.7); } });
      cashier.pose({ lShX: -1.1, lElX: -0.3 });
    });
    // your things come back to you, and her thanks with a bow
    T(tn + 3.05, () => {
      cashier.rest();
      items.forEach((h, i) => {
        h.paid = true;
        const hand = i;
        h.hand = hand;
        fly(h.mesh, counterMatrix(TILL.bag[i], -Q), anchorMatrix(hand, h.mesh), { dur: 0.45, done: () => { h.where = 'hand'; holdIn(h.mesh, hands.anchor(hand)); hands[hand ? 'L' : 'R'].item = h; changed(); } });
      });
    });
    T(tn + 3.3, () => { say('arigatou'); cashier.bow(1, 0.9); });
    T(tn + 4.2, () => {
      phase = 'paid';
      wallet = change;
      if (api.player) api.player.suspended = false;
      cashier.lookAt = lookTarget;
      api.flash?.(S.paid(change), 3200);
      changed();
    });
    checkout = { ev, t: 0, from, sum };
    changed();
  }
  let payReach = null, trayNote = null;
  function abortCheckout() {
    checkout = null;
    for (const f of [...flights]) { flights.splice(flights.indexOf(f), 1); if (f.mesh !== trayNote) f.mesh.removeFromParent(); }
    trayNote?.removeFromParent(); trayNote = null;
    for (const h of held) { h.mesh.removeFromParent(); h.u.count++; refreshSlot(h.u); }
    held.length = 0;
    hands.R.item = hands.L.item = null;
    hands.L.off.set(0, 0, 0); payReach = null;
    hands.showNote(true); hands.setChange(0); change = 0;
    display.mesh.visible = false;
    cashier.rest(); cashier.lookAt = lookTarget;
    if (api.player) api.player.suspended = false;
    phase = 'out';
    hands.raise(false);
    changed();
  }

  /* ------------------------------ eating ------------------------------ */
  const eating = makeEating(hands, hands.skinMat, mine);
  function startEating() {
    phase = 'eat';
    const items = held.filter((h) => h.paid && h.where === 'hand').sort((a, b) => a.hand - b.hand);
    items.forEach((h) => { h.onEaten = () => { h.where = 'gone'; hands[h.hand ? 'L' : 'R'].item = null; changed(); }; });
    eating.start(items.map((h) => ({ id: h.id, mesh: h.mesh, hand: h.hand, get onEaten() { return h.onEaten; } })));
    changed();
  }
  function finishEating() {
    for (const h of held) h.mesh.removeFromParent();
    held.length = 0;
    hands.R.item = hands.L.item = null;
    hands.setChange(0);
    change = 0;
    display.mesh.visible = false;
    phase = wasInside ? 'shop' : 'out';
    if (!wasInside) hands.raise(false);
    api.spot?.done();
    api.flash?.(S.ate, 4200);
    changed();
  }

  /* ----------------------------- aiming ----------------------------- */
  const ray = new THREE.Ray(), inv = new THREE.Matrix4(), hit = new THREE.Vector3(), eye = new THREE.Vector3();
  const targets = new Map();
  const target = (key, make) => targets.get(key) ?? targets.set(key, make()).get(key);
  let aimed = null;
  function aim(camera) {
    inv.copy(inside.matrixWorld).invert();
    camera.getWorldPosition(ray.origin);
    camera.getWorldDirection(ray.direction);
    ray.applyMatrix4(inv);
    eye.copy(ray.origin);
    const R = STORE.reach;
    // the till: pay for what you hold
    if (ray.intersectBox(TILL.box, hit) && hit.distanceTo(eye) < R + 0.4) {
      if (phase === 'shop' && held.some((h) => !h.paid && h.where === 'hand')) {
        return target('pay' + total(), () => ({ label: S.pay(total()), action: startCheckout, kind: 'till' }));
      }
    }
    if (phase !== 'shop') return null;
    let best = null, bestT = R;
    for (const u of pickable) {
      if (u.count <= 0) continue;
      if (Math.abs(u.centre.x - eye.x) > R + 0.5 || Math.abs(u.centre.z - eye.z) > R + 0.5) continue;
      if (!ray.intersectBox(u.box, hit)) continue;
      const t = hit.distanceTo(eye);
      if (t < bestT) { bestT = t; best = u; }
    }
    if (!best) return null;
    if (inHands().length >= STORE.carry) return target('full', () => ({ label: S.handsFull, action: () => api.flash?.(S.handsFull), kind: 'full', unit: null }));
    const p = PRODUCT[best.id];
    return target(best, () => ({ label: S.take(p.nameEn, p.priceYen), action: () => take(best), unit: best, kind: 'item' }));
  }

  /* ------------------------------- frame ------------------------------- */
  const local = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  /** Is `camera` inside the store? */
  api.inside = (camera) => {
    local.copy(camera.position).applyMatrix4(inv.copy(inside.matrixWorld).invert());
    return local.x > -hw && local.x < hw && local.z < 0 && local.z > -LAWSON.depth;
  };
  api.pick = (camera) => { aimed = aim(camera); return aimed; };
  api.clearAim = () => { aimed = null; };
  api.putBack = putBack;
  api.stats = inside.userData.stockStats;
  api.unitAt = (u) => inside.localToWorld(new THREE.Vector3(u.x, u.y, u.z));
  api.coolerAt = inside.localToWorld(new THREE.Vector3(-2.4, 1, -12.3));
  api.doors = doors;
  api.total = total;
  api.nearDoor = () => false;
  /** The automatic door keeps shut on you while you hold anything unpaid (lawson.js asks). */
  api.holdDoor = (p) => p.z < -0.15 && held.some((h) => !h.paid && h.where !== 'gone');

  let t = 0;
  const _e = new THREE.Vector3();
  api.update = (dt, camera, bob = 0) => {
    t += dt;
    camera.updateMatrixWorld();
    view.matrix.copy(camera.matrixWorld);
    view.matrixWorldNeedsUpdate = true;
    const inNow = api.inside(camera);
    const dDoor = Math.hypot(local.x - LAWSON.doorX, local.z);
    if (dDoor < 30) prime();

    /* coming in, going out */
    if (inNow && !wasInside) {
      if (phase === 'out') { phase = 'shop'; wallet = STORE.wallet; change = 0; hands.setChange(0); hands.showNote(true); }
      if (phase === 'eat') { eating.stop(); finishEating(); phase = 'shop'; wallet = STORE.wallet; hands.showNote(true); }
      hands.raise(true);
      if (phase === 'shop') { say('irasshaimase'); cashier.bow(0.7, 0.6); }
      api.onEnter?.();
    }
    if (!inNow && wasInside) {
      if (returnUnpaid()) api.flash?.(S.notOut);
      if (phase === 'paid') say('arigatou-mashita', 'v-arigatou-mashita', S.lines.farewell);
      else if (phase === 'shop') { phase = 'out'; hands.raise(false); }
      api.onExit?.();
    }
    wasInside = inNow;
    // left mid-checkout (a famous-view key): it is all called off
    if (phase === 'till' && !inNow) abortCheckout();

    // outside with what you paid for, clear of the door: eat
    if (phase === 'paid' && !inNow && local.z > 1.4) startEating();
    if (phase === 'eat') { eating.update(dt); if (eating.done) finishEating(); }

    // the door won't let unpaid things out: say why, once per try
    const atDoor = inNow && dDoor < 1.9 && api.holdDoor(local);
    if (atDoor && !doorHint) api.flash?.(S.notOut, 3200);
    doorHint = atDoor;

    /* the checkout's timeline, and the view easing onto the till */
    if (checkout) {
      checkout.t += dt;
      for (const e of checkout.ev) if (!e.done && checkout.t >= e.t) { e.done = true; e.fn(); }
      const p = api.player;
      if (p && checkout.from && checkout.t < 0.8) {
        const k = ease(clamp01(checkout.t / 0.7));
        _e.copy(TILL.look).applyMatrix4(inside.matrixWorld).sub(camera.position);
        const yaw = Math.atan2(-_e.x, -_e.z), pitch = Math.atan2(_e.y, Math.hypot(_e.x, _e.z));
        let dy = yaw - checkout.from.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        p.yaw = checkout.from.yaw + dy * k;
        p.pitch = checkout.from.pitch + (pitch - checkout.from.pitch) * k;
      }
      if (checkout.ev.every((e) => e.done)) checkout = null;
    }
    // the left hand's reach to the tray and back
    if (payReach !== null) {
      if (payReach >= 0) { payReach = Math.min(1, payReach + dt / 0.35); hands.L.off.set(0.16, 0.07, -0.16).multiplyScalar(easeOut(payReach)); }
      else { hands.L.off.multiplyScalar(Math.max(0, 1 - dt * 6)); if (hands.L.off.length() < 0.002) { hands.L.off.set(0, 0, 0); payReach = null; } }
    }
    if (pendingTakes.length) {
      for (let k = pendingTakes.length - 1; k >= 0; k--) {
        const pt = pendingTakes[k];
        pt.t -= dt;
        if (pt.t <= 0) { pendingTakes.splice(k, 1); take(pt.u, true); }
      }
    }

    /* the cast: hands always (they are hidden when down); the cashier while you are near */
    hands.update(dt, bob, camera);
    view.updateMatrixWorld(true);
    if (dDoor < 24) {
      lookTarget.copy(camera.position);
      if (phase !== 'till' && !cashier.lookAt) cashier.lookAt = lookTarget;
      cashier.update(dt);
    }
    doors.update(dt, local);

    // the glows, only while you are inside; dimmed when your hands are full
    const full = inHands().length >= STORE.carry || phase !== 'shop';
    glowMat.opacity = inNow ? (full ? 0.15 : 0.7 + 0.25 * Math.sin(t * 2.6)) : 0;
    haloMat.opacity = inNow ? (full ? 0.08 : 0.3 + 0.1 * Math.sin(t * 2.6)) : 0;
    gemMat.opacity = inNow && !full ? 0.9 : 0;
    for (const sp of spots) {
      sp.group.visible = inNow && phase === 'shop';
      const gem = sp.group.userData.gem;
      if (gem) { gem.position.y = sp.group.userData.y + Math.sin(t * 1.8 + sp.box.min.x) * 0.02; gem.rotation.y = t * 1.2; }
    }

    for (let k = slides.length - 1; k >= 0; k--) {
      const s = slides[k];
      s.t += dt / STORE.slide;
      const e = ease(Math.max(0, Math.min(1, s.t)));
      placeUnit(s.u, s.u.depth * (1 - e), s.u.count <= 0);
      if (s.t >= 1) { slides.splice(k, 1); refreshSlot(s.u); }
    }
    for (let k = flights.length - 1; k >= 0; k--) {
      const f = flights[k];
      f.t += dt / f.dur;
      const e = ease(Math.min(1, f.t));
      const end = f.to();
      f.from.decompose(_pa, _qa, _sa);
      end.decompose(_pb, _qb, _sb);
      _pa.lerp(_pb, e);
      _pa.y += Math.sin(Math.PI * e) * f.arc;
      _qa.slerp(_qb, e);
      f.mesh.matrix.compose(_pa, _qa, _sa.lerp(_sb, e));
      f.mesh.matrixWorldNeedsUpdate = true;
      if (f.t >= 1) {
        // it stays where it landed (the counter, the tray) unless `done` takes it on
        flights.splice(k, 1);
        f.mesh.matrix.copy(end);
        f.done?.();
      }
    }
  };

  /** The famous views are the opening shot: nothing of ours shows there (lawson.js asks). */
  api.quietView = () => api.isFamousView();

  if (import.meta.env?.DEV) {
    api.debug = {
      pickable, spots, take, putBack, startCheckout, productGeometry, TILL,
      get flights() { return flights; }, get checkout() { return checkout; }, eating,
      /** Everything as it is when you walk in (dev shots): hands up, the greeting done. */
      reset() { returnUnpaid(); phase = wasInside ? 'shop' : 'out'; hands.snap(wasInside); },
    };
  }
  return api;
}
