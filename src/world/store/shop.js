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
 * The Nippon Konbini (Tan's experience, made a scene: 2026-09-28).
 *
 * Tan: "very simple ... just experience the nostalgia that a konbini
 * carries".  You don't roam the store.  Stand on the highlighted spot at the
 * door and choose one thing (main.js shows the choice); then it plays out
 * in first person, no skipping: you walk to the door, it slides open to
 * the chime, "irasshaimase"; down the aisle to the shelf, your hand takes
 * it; to the till, where the cashier scans it (the beep), says the total,
 * your note goes on the tray, the drawer, the coins, "arigatou
 * gozaimasu"; out through the door (the chime again, "arigatou
 * gozaimashita") and you eat or drink it outside.  Then you are yours
 * again.  The Strong Nine leaves you a little tipsy (main.js).
 *
 * The walk is planned on the store's own colliders (a small grid search),
 * so it keeps to the aisles whatever the planogram does.  The hands, what
 * they hold and the flights are drawn on top of the world (store/figure.js).
 * ------------------------------------------------------------------ */

const hw = LAWSON.width / 2;
/** The highlighted spot outside the door (store frame): where you choose, and where you eat. */
export const SPOT = { x: LAWSON.doorX, z: 2.3, r: 1.2 };
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

export function makeShop(inside, { doors, lit, colliders = [], entrance = null }) {
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
  let primed = false;
  const api = {
    view, fx, hands, cashier,
    get held() { return held; },
    get phase() { return phase; },
    get wallet() { return wallet; },
    get busy() { return visit.active || phase === 'till'; },
    /** Scripted: the visit is playing (main.js leaves the player alone). */
    get visiting() { return visit.active; },
    /** Standing on the highlighted spot at the door, free to choose. */
    atSpot: false,
    /** What you can choose (catalogue ids), in the order main.js lists them. */
    menu: FEATURED.flatMap((f) => f.ids),
    onTipsy: null,             // main.js: after the Strong Nine
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
    show: false,
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
    for (const n of ['v-irasshaimase', 'v-oazukari', 'v-arigatou', 'v-arigatou-mashita', 'v-total', 'till-beep', 'cashier-checkout', 'register-drawer', 'bite', 'munch', 'gulp', 'can-open', 'wrapper']) soundBus.oneShot(n, { gain: 0 });
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
    T(0, () => { cashier.lookAt = null; say('oazukari'); cashier.pose({ headX: 0.2, headY: 0 }); tillSound('cashier-checkout', 'ui-tap', STORE.checkoutGain); });
    items.forEach((h, i) => {
      // each goes onto the counter
      T(0.1 + i * 0.15, () => {
        const f = worldOf(h.mesh).clone();
        h.mesh.removeFromParent();
        hands[h.hand ? 'L' : 'R'].item = null;
        hands.raise(false);                    // an empty hand has nothing to do in view
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
    // paying is out of view (no wallet, no note: Tan); the drawer, and the receipt on the display
    T(tn + 2.2, () => { tillSound('register-drawer', 'box'); display.show('お預り', sum); cashier.pose({ lShX: -0.95, lShZ: 0.05, lElX: -0.5, twist: 0.1 }); });
    T(tn + 2.9, () => { cashier.pose({ lShX: -0.3, lElX: -1.2 }); display.show('ありがとう', sum); });
    // your thing comes back to your hand, and her thanks with a bow
    T(tn + 3.4, () => {
      cashier.rest();
      hands.raise(true);
      items.forEach((h, i) => {
        h.paid = true;
        h.hand = i;
        fly(h.mesh, counterMatrix(TILL.bag[i], -Q), anchorMatrix(i, h.mesh), { dur: 0.45, done: () => { h.where = 'hand'; holdIn(h.mesh, hands.anchor(i)); hands[i ? 'L' : 'R'].item = h; changed(); } });
      });
    });
    T(tn + 3.7, () => { say('arigatou'); cashier.bow(1, 0.9); });
    T(tn + 4.7, () => {
      phase = 'paid';
      wallet = STORE.wallet - sum;
      if (api.player) api.player.suspended = false;
      cashier.lookAt = lookTarget;
      changed();
    });
    checkout = { ev, t: 0, from, sum };
    changed();
  }
  let reachR = null;               // the right hand's reach to the shelf (0..1 out, -1 back)
  function abortCheckout() {
    checkout = null;
    for (const f of [...flights]) { flights.splice(flights.indexOf(f), 1); f.mesh.removeFromParent(); }
    for (const h of held) { h.mesh.removeFromParent(); h.u.count++; refreshSlot(h.u); }
    held.length = 0;
    hands.R.item = hands.L.item = null;
    hands.R.off.set(0, 0, 0); reachR = null;
    hands.setChange(0); change = 0;
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
    changed();
  }

  const inv = new THREE.Matrix4();
  /* ------------------------------ the visit ------------------------------ */
  const visit = { active: false, id: null, eat: false, queue: [], cur: null, armed: true };
  const WALK = 2.0;                         // m/s, a brisk konbini pace (Tan: +33%)

  /* Where you can stand: the store's floor and the forecourt on a 10 cm
   * grid, clear of every collider (the entrance's own leaves excepted: they
   * open for you).  Two clearances: the walk is planned keeping a good
   * half metre off every shelf (a shopper, not a ghost brushing the
   * stock), and only where an aisle is narrower than that does it fall back
   * to the body's own width. */
  let grids = null;
  function makeGrid(R) {
    const C = 0.1;
    const X0 = -hw + 0.1, X1 = hw - 0.1, Z0 = -LAWSON.depth + 0.1, Z1 = 3.4;
    const nx = Math.ceil((X1 - X0) / C), nz = Math.ceil((Z1 - Z0) / C);
    const solid = colliders.filter((c) => !(c.top !== undefined && c.top <= 0.38)
      && !(entrance && c.x0 === entrance.d0 && c.x1 === entrance.d1));
    const free = new Uint8Array(nx * nz);
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const x = X0 + (ix + 0.5) * C, z = Z0 + (iz + 0.5) * C;
      free[iz * nx + ix] = solid.some((c) => x > c.x0 - R && x < c.x1 + R && z > c.z0 - R && z < c.z1 + R) ? 0 : 1;
    }
    const ok = (x, z) => { const ix = Math.floor((x - X0) / C), iz = Math.floor((z - Z0) / C); return ix >= 0 && iz >= 0 && ix < nx && iz < nz && free[iz * nx + ix] === 1; };
    return { C, X0, Z0, nx, nz, free, ok,
      cell: (x, z) => [Math.floor((x - X0) / C), Math.floor((z - Z0) / C)],
      at: (ix, iz) => new THREE.Vector2(X0 + (ix + 0.5) * C, Z0 + (iz + 0.5) * C),
      /** Nothing in the way along a straight line from p to q. */
      sight: (p, q) => { const n = Math.ceil(p.distanceTo(q) / 0.04); for (let i = 1; i < n; i++) { const t2 = i / n; if (!ok(p.x + (q.x - p.x) * t2, p.y + (q.y - p.y) * t2)) return false; } return true; } };
  }
  const getGrids = () => (grids ??= { wide: makeGrid(0.55), body: makeGrid(0.38) });
  /** The free cell nearest (x, z). */
  function nearestFree(g, x, z) {
    let [cx, cz] = g.cell(x, z), best = null, bd = Infinity;
    for (let r = 0; r < 30 && !best; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const ix = cx + dx, iz = cz + dz;
      if (ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz || !g.free[iz * g.nx + ix]) continue;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = [ix, iz]; }
    }
    return best;
  }
  /** The shortest way on grid `g` (A*, eight ways, true distances), as cell centres; null if none. */
  function search(g, a, b) {
    const N = g.nx * g.nz, cost = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), shut = new Uint8Array(N);
    const start = a[1] * g.nx + a[0], goal = b[1] * g.nx + b[0];
    const hx = (c) => Math.hypot((c % g.nx) - b[0], ((c / g.nx) | 0) - b[1]);
    // a small binary heap of [f, cell]
    const heap = [];
    const push = (f, c) => { heap.push([f, c]); let i = heap.length - 1; while (i > 0) { const p2 = (i - 1) >> 1; if (heap[p2][0] <= heap[i][0]) break; [heap[p2], heap[i]] = [heap[i], heap[p2]]; i = p2; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    cost[start] = 0; push(hx(start), start);
    while (heap.length) {
      const [, c] = pop();
      if (shut[c]) continue;
      shut[c] = 1;
      if (c === goal) break;
      const cx = c % g.nx, cz = (c / g.nx) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const ix = cx + dx, iz = cz + dz, n = iz * g.nx + ix;
        if ((!dx && !dz) || ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz || !g.free[n] || shut[n]) continue;
        if (dx && dz && (!g.free[cz * g.nx + ix] || !g.free[iz * g.nx + cx])) continue;    // no corner cutting
        const nc = cost[c] + (dx && dz ? Math.SQRT2 : 1);
        if (nc < cost[n]) { cost[n] = nc; prev[n] = c; push(nc + hx(n), n); }
      }
    }
    if (prev[goal] < 0 && goal !== start) return null;
    const cells = [];
    for (let c = goal; ; c = prev[c]) { cells.push(g.at(c % g.nx, (c / g.nx) | 0)); if (c === start) break; }
    return cells.reverse();
  }
  /** A walk from `from` to `to`: the shortest way, pulled taut, its corners rounded where that stays clear. */
  function plan(from, to) {
    const { wide, body } = getGrids();
    let g = wide, cells = null;
    for (const gg of [wide, body]) {
      const a = nearestFree(gg, from.x, from.y), b = nearestFree(gg, to.x, to.y);
      if (a && b && (cells = search(gg, a, b))) { g = gg; break; }
    }
    if (!cells) return [from.clone(), to.clone()];
    // pulled taut: from each point, the farthest one still in plain sight
    const all = [from.clone(), ...cells, to.clone()];
    let pts = [all[0]];
    for (let i = 0; i < all.length - 1;) {
      let j = all.length - 1;
      while (j > i + 1 && !g.sight(all[i], all[j])) j--;
      pts.push(all[j].clone());
      i = j;
    }
    // each corner rounded (a short curve from 0.6 m before it to 0.6 m after), if that curve is clear
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], c = pts[i], b = pts[i + 1];
      const ra = Math.min(0.6, a.distanceTo(c) / 2), rb = Math.min(0.6, b.distanceTo(c) / 2);
      const p0 = c.clone().add(a.clone().sub(c).setLength(ra)), p1 = c.clone().add(b.clone().sub(c).setLength(rb));
      const curve = [];
      for (let k = 0; k <= 6; k++) {
        const t2 = k / 6;
        curve.push(p0.clone().multiplyScalar((1 - t2) * (1 - t2)).add(c.clone().multiplyScalar(2 * t2 * (1 - t2))).add(p1.clone().multiplyScalar(t2 * t2)));
      }
      if (curve.every((q, k) => k === 0 || body.sight(curve[k - 1], q))) out.push(...curve);
      else out.push(c);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  const P2 = (x, z) => new THREE.Vector2(x, z);
  /** Where to stand to take from `u`: in the aisle in front of it. */
  function standFor(u) {
    const s = u.slot, c = u.centre;
    if (s.zone === 'chilled') return P2(s.rail + 0.95, c.z);
    if (s.zone === 'drinks') return P2(c.x, s.rail + 0.95);
    return P2(c.x, -3.0 + 0.62);                    // the ice case's front rim
  }
  /** Turn to look at `p` (store frame, a Vector3). */
  function lookAngles(p, camera) {
    const w = at(p).sub(camera.position);
    return { yaw: Math.atan2(-w.x, -w.z), pitch: Math.atan2(w.y, Math.hypot(w.x, w.z)) };
  }
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  /* The scene, as a queue of steps; each is { kind, ... } and runs until done. */
  const walkTo = (to) => ({ kind: 'walk', to });
  const face = (p, dur = 0.7) => ({ kind: 'face', p, dur });
  const act = (fn) => ({ kind: 'do', fn });
  const until = (cond) => ({ kind: 'wait', cond });
  const pause = (sec) => ({ kind: 'pause', sec });

  /** Play the visit for catalogue id `id` (one of api.menu). */
  api.play = (id) => {
    if (visit.active || !api.player) return false;
    const u = pickable.filter((x) => x.id === id && x.count > 0)[0];
    if (!u) return false;
    const p = api.player;
    visit.active = true; visit.id = id; visit.eat = false;
    p.scripted = true; p.suspended = true;
    p.vel.set(0, 0, 0);
    const street = new THREE.Vector3(SPOT.x + 0.6, 1.45, SPOT.z + 12);
    visit.queue = [
      walkTo(standFor(u)),
      face(u.centre.clone(), 0.8),
      act(() => { hands.raise(true); reachR = 0; }),
      pause(0.35),
      act(() => take(u)),
      until(() => held.some((h) => h.where === 'hand') && !flights.length && !pendingTakes.length),
      act(() => { reachR = -1; }),
      pause(0.5),
      walkTo(P2(TILL.stand.x, TILL.stand.z)),
      face(TILL.look, 0.6),
      act(() => startCheckout()),
      until(() => phase === 'paid'),
      pause(0.4),
      walkTo(P2(SPOT.x, SPOT.z + 0.1)),
      face(street, 0.9),
      act(() => { visit.eat = true; }),
      until(() => phase === 'out' || phase === 'shop'),
      pause(0.6),
    ];
    visit.cur = null;
    return true;
  };
  function endVisit() {
    const p = api.player;
    visit.active = false; visit.eat = false; visit.armed = false;
    p.scripted = false; p.suspended = false;
    p.vel.set(0, 0, 0);
    api.flash?.(S.ate, 4200);
    if (visit.id === 'strong_nine') api.onTipsy?.();
  }
  const _l = new THREE.Vector3();
  function stepVisit(dt, camera) {
    const p = api.player;
    let moving = 0;
    for (let guard = 0; guard < 4; guard++) {
      if (!visit.cur) {
        visit.cur = visit.queue.shift() ?? null;
        if (!visit.cur) { endVisit(); break; }
        const c = visit.cur;
        c.t = 0;
        if (c.kind === 'walk') {
          _l.copy(p.pos).applyMatrix4(inv.copy(inside.matrixWorld).invert());
          c.path = plan(P2(_l.x, _l.z), c.to);
          c.len = [0];
          for (let i = 1; i < c.path.length; i++) c.len.push(c.len[i - 1] + c.path[i].distanceTo(c.path[i - 1]));
          c.s = 0;
        }
        if (c.kind === 'face') { c.from = { yaw: p.yaw, pitch: p.pitch }; c.goal = lookAngles(c.p, camera); }
        if (c.kind === 'do') { c.fn(); visit.cur = null; continue; }
      }
      const c = visit.cur;
      c.t += dt;
      if (c.kind === 'walk') {
        const L = c.len[c.len.length - 1];
        const pt = (s) => {
          s = Math.max(0, Math.min(L, s));
          let i = 1;
          while (i < c.len.length - 1 && c.len[i] < s) i++;
          const k = (s - c.len[i - 1]) / Math.max(1e-6, c.len[i] - c.len[i - 1]);
          return c.path[i - 1].clone().lerp(c.path[i], k);
        };
        // ease in and out over the first and last half metre
        const v = WALK * Math.min(1, 0.35 + c.s / 0.6, 0.35 + (L - c.s) / 0.6);
        let next = c.s + v * dt;
        // the automatic door: wait for it to open
        const q = pt(next);
        if (entrance && q.y > -0.45 && q.y < 0.6 && Math.abs(q.x - LAWSON.doorX) < LAWSON.doorWidth && entrance.open < 0.8) next = c.s;
        moving = (next - c.s) / Math.max(dt, 1e-6);
        c.s = next;
        const here = pt(c.s), ahead = pt(c.s + 0.9);
        const w = inside.localToWorld(new THREE.Vector3(here.x, 0, here.y));
        p.pos.x = w.x; p.pos.z = w.z;
        p.pos.y += (p.world.heightAt(w.x, w.z, p.pos.y) - p.pos.y) * Math.min(1, dt * 18);
        const d = ahead.sub(here);
        if (d.lengthSq() > 1e-4) {
          const wd = new THREE.Vector3(d.x, 0, d.y).transformDirection(inside.matrixWorld);
          const yaw = Math.atan2(-wd.x, -wd.z);
          p.yaw += wrap(yaw - p.yaw) * Math.min(1, dt * 4.5);
        }
        p.pitch += (-0.06 - p.pitch) * Math.min(1, dt * 3);
        if (c.s >= L - 1e-3) visit.cur = null;
      } else if (c.kind === 'face') {
        const k = ease(clamp01(c.t / c.dur));
        p.yaw = c.from.yaw + wrap(c.goal.yaw - c.from.yaw) * k;
        p.pitch = c.from.pitch + (c.goal.pitch - c.from.pitch) * k;
        if (c.t >= c.dur) visit.cur = null;
      } else if (c.kind === 'pause') {
        if (c.t >= c.sec) visit.cur = null;
      } else if (c.kind === 'wait') {
        if (c.cond()) visit.cur = null;
      }
      break;
    }
    p.bob += dt * moving * 6.4;
    p.applyCamera(moving);
  }

  /* ------------------------------- frame ------------------------------- */
  const local = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  /** Is `camera` inside the store? */
  api.inside = (camera) => {
    local.copy(camera.position).applyMatrix4(inv.copy(inside.matrixWorld).invert());
    return local.x > -hw && local.x < hw && local.z < 0 && local.z > -LAWSON.depth;
  };
  api.pick = () => null;
  api.clearAim = () => {};
  api.stats = inside.userData.stockStats;
  api.unitAt = (u) => inside.localToWorld(new THREE.Vector3(u.x, u.y, u.z));
  api.coolerAt = inside.localToWorld(new THREE.Vector3(-2.4, 1, -12.3));
  api.doors = doors;
  api.total = total;
  api.nearDoor = () => false;
  /** The automatic door opens for the visit only (you don't roam the store); anyone inside is let out. */
  api.holdDoor = (p) => !visit.active && p.z > -0.15;

  let t = 0;
  const _e = new THREE.Vector3();
  api.update = (dt, camera, bob = 0) => {
    t += dt;
    if (visit.active) stepVisit(dt, camera);
    camera.updateMatrixWorld();
    view.matrix.copy(camera.matrixWorld);
    view.matrixWorldNeedsUpdate = true;
    const inNow = api.inside(camera);
    const dDoor = Math.hypot(local.x - LAWSON.doorX, local.z);
    if (dDoor < 30) prime();

    /* coming in, going out */
    if (inNow && !wasInside) {
      if (phase === 'out') { phase = 'shop'; wallet = STORE.wallet; change = 0; hands.setChange(0); }
      if (phase === 'eat') { eating.stop(); finishEating(); phase = 'shop'; wallet = STORE.wallet; }
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
    if (phase === 'paid' && !inNow && local.z > 1.4 && (!visit.active || visit.eat)) startEating();
    // the choice shows on the spot; after a visit, only once you have stepped off and back on
    const dSpot = Math.hypot(local.x - SPOT.x, local.z - SPOT.z);
    if (dSpot > SPOT.r + 0.3) visit.armed = true;
    api.atSpot = visit.armed && !visit.active && !inNow && dSpot < SPOT.r;
    if (phase === 'eat') { eating.update(dt); if (eating.done) finishEating(); }


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
    // the right hand's reach to the shelf and back
    if (reachR !== null) {
      if (reachR >= 0) { reachR = Math.min(1, reachR + dt / 0.4); hands.R.off.set(-0.03, 0.09, -0.22).multiplyScalar(easeOut(reachR)); }
      else { hands.R.off.multiplyScalar(Math.max(0, 1 - dt * 5)); if (hands.R.off.length() < 0.002) { hands.R.off.set(0, 0, 0); reachR = null; } }
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
    // she exists only near (from the famous views she is unseen behind the glass: nothing drawn)
    cashier.root.visible = dDoor < 24 && !api.isFamousView();
    if (dDoor < 24) {
      lookTarget.copy(camera.position);
      if (phase !== 'till' && !cashier.lookAt) cashier.lookAt = lookTarget;
      cashier.update(dt);
    }
    doors.update(dt, local);

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
      pickable, take, startCheckout, visit: () => visit,
      /** The walkable floor and the walk for `id`, as text (dev): '#' blocked, '.' free, '*' the path. */
      pathMap(id) {
        const g = getGrids().wide, u = pickable.find((x) => x.id === id);
        const legs = [plan(P2(SPOT.x, SPOT.z), standFor(u)), plan(standFor(u), P2(TILL.stand.x, TILL.stand.z)), plan(P2(TILL.stand.x, TILL.stand.z), P2(SPOT.x, SPOT.z + 0.1))];
        const rows = [];
        for (let iz = 0; iz < g.nz; iz += 2) {
          let r = '';
          for (let ix = 0; ix < g.nx; ix++) r += g.free[iz * g.nx + ix] ? '.' : '#';
          rows.push(r.split(''));
        }
        for (const leg of legs) for (let i = 1; i < leg.length; i++) {
          const a = leg[i - 1], b = leg[i], n = Math.ceil(a.distanceTo(b) / 0.1);
          for (let k = 0; k <= n; k++) {
            const x = a.x + (b.x - a.x) * k / n, z = a.y + (b.y - a.y) * k / n;
            const [ix, iz] = g.cell(x, z);
            if (rows[iz >> 1]?.[ix] !== undefined) rows[iz >> 1][ix] = rows[iz >> 1][ix] === '#' ? 'X' : '*';
          }
        }
        return rows.map((r) => r.join('')).join('\n');
      },
      /** Stop the scene where it is (dev tests): everything put back, the player freed. */
      cancel() {
        if (!visit.active) return;
        visit.queue = []; visit.cur = null;
        if (phase === 'till') abortCheckout();
        if (phase === 'eat') eating.stop();
        for (const h of held) h.mesh.removeFromParent();
        held.length = 0; hands.R.item = hands.L.item = null; hands.raise(false);
        phase = 'out';
        endVisit();
      }, productGeometry, TILL,
      get flights() { return flights; }, get checkout() { return checkout; }, eating,
      /** Everything as it is when you walk in (dev shots): hands up, the greeting done. */
      reset() { returnUnpaid(); phase = wasInside ? 'shop' : 'out'; hands.snap(wasInside); },
    };
  }
  return api;
}
