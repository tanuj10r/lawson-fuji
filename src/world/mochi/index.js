import * as THREE from 'three';
import { MOCHI, SOUND, STORE } from '../../config.js';
import { STRINGS } from '../../data/strings.js';
import { STREET } from '../../data/catalog.js';
import { soundBus } from '../../core/soundBus.js';
import { bake, trs } from '../../core/util.js';
import { animalMaterial, Herd, makeShadows, painted } from '../animals/shade.js';
import { GUIDE } from '../animals/guide.js';
import { makeEating } from '../store/eat.js';
import { figureMaterial } from '../store/figure.js';
import { rabbitGeometry, RIG, malletFace, swingFor, pawAt } from './rabbits.js';
import { mochiGeometry, potatoGeometry } from './food.js';
import { buildShopfront, Y0, USU } from './shop.js';

/* ------------------------------------------------------------------ *
 * ぺったん堂 / PETTAN-DO: the mochi-pounding shop (Tan, 2026-10-01).
 *
 * A homage to Kyoto's high-speed mochi pounders, with nobody in it: three
 * white moon rabbits at a stone mortar on the open strip before a low
 * machiya front.  Two pound in turn, the third turns the dough between the
 * strikes, to Tan's 13 s recording of the real thing.
 *
 *   the show   plays while you are within MOCHI.near of the mortar, rests
 *              two or three seconds (the turner holds a mochi up, all three
 *              bow) and plays again.  It is driven by the AUDIO clock: the
 *              one-shot's position in the file (core/sound.js `pos()`) is
 *              read each frame and the rabbits' pose is a pure function of
 *              it and the cue table (config MOCHI.cues), so a dropped frame
 *              or a pause can't pull picture and sound apart.  With no
 *              sound (muted, before the first click) it runs on the frame
 *              clock instead; with no file, on the engine's recipe.
 *   idle       nobody near: they wipe their brows, ears twitch, the turner
 *              pats the dough; beyond MOCHI.live only the steamer steams;
 *              beyond MOCHI.hide nothing is drawn or moved
 *   buying     E on the ring: your card taps the stand's reader (the
 *              konbini's ka-ching), the turner hops over with a mochi and
 *              sets it on the plate, your hand takes it (a puff of kinako)
 *              and you eat it (store/eat.js: three bites, the first a long
 *              stretchy pull)
 *   Hachi      sits at the stage's edge, bobs on every strike, hops back at
 *              the cheer, wags at the bow (animals/guide.js GUIDE.watchShow);
 *              no mochi for a dog: the turner tosses him dried sweet potato
 *              from the jar, and the kinako makes him sneeze
 *
 * Cost: one instanced mesh for the three rabbits, one for the dough and its
 * strand, one for every puff of steam, one for their shadows; the house is
 * static and batches with the town.
 * ------------------------------------------------------------------ */

/** main.js hands over what the shop borrows from the konbini: your hands (store/hands.js). */
export const PETTAN = { hands: null, attach(o) { Object.assign(PETTAN, o); } };

const SCALE = 1.3;                         // the rabbits stand a metre to the top of the head
const UP = -0.9, READY = -0.62, REST = 0.42, LEAN_HIT = 0.22, TURNED = 0.62;   // (the paws must stay before its big head: no mallet goes straight overhead)
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (u) => { u = clamp01(u); return u * u * (3 - 2 * u); };
const easeOut = (u) => { u = clamp01(u); return 1 - (1 - u) * (1 - u); };
const mix = (a, b, k) => a + (b - a) * k;
/** 0 → 1 → 0 over [0, len] (a sine hump); 0 outside. */
const hump = (x, len) => (x <= 0 || x >= len ? 0 : Math.sin((Math.PI * x) / len));
/** Up over `a` s, held, down over `b` s, `len` s in all. */
const pulse = (x, len, a = 0.25, b = 0.25) => (x <= 0 || x >= len ? 0 : Math.min(ease(x / a), ease((len - x) / b)));

export function buildMochi(ctx, net, kit, lot) {
  const cx = (lot.rect[0] + lot.rect[2]) / 2, fz = lot.rect[3];
  const shop = buildShopfront(ctx, { cx, fz });
  const C = MOCHI.cues, LEN = MOCHI.len;
  const [ux, uz] = MOCHI.usu, [sx, sz] = MOCHI.stand;
  const toWorld = (x, z) => ctx.toWorld({ x: cx + x, z: fz + z });
  const USU_W = toWorld(ux, uz), STAND_W = toWorld(sx, sz), SEAT_W = toWorld(MOCHI.hachi[0], MOCHI.hachi[1]);
  const WATCH = { seat: SEAT_W, at: USU_W };

  /* everything that moves, in the lot's own frame */
  const dyn = new THREE.Group();
  dyn.name = 'pettan-show';
  dyn.position.set(cx, 0, fz);
  dyn.userData.dynamic = true;
  ctx.add(dyn);
  const dctx = { add: (m) => dyn.add(m) };

  /* ---- the rabbits: two pounders on their steps either side of the mortar, the turner behind it ---- */
  const geo = rabbitGeometry();
  const mat = animalMaterial({ key: 'mochiRabbit', rig: RIG, tint: 0xc2badf, bands: 3 });
  const herd = new Herd(dctx, geo, mat, 3, 'rabbits', { bounds: [ux, 0.8, uz, 4.5] });
  const pose3 = new THREE.InstancedBufferAttribute(new Float32Array(12), 4);
  pose3.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPose3', pose3);
  // the swing that lays the mallet's face on the dough, and how far back that stands a pounder
  const feetY = Y0 + USU.step, doughTop = Y0 + USU.dough;
  const HIT = swingFor((doughTop - feetY) / SCALE, LEAN_HIT);
  const reachD = malletFace(HIT, LEAN_HIT)[1] * SCALE;
  const HOME = [
    { x: ux - reachD, y: feetY, z: uz, yaw: Math.PI / 2, role: 0 },
    { x: ux + reachD, y: feetY, z: uz, yaw: -Math.PI / 2, role: 0 },
    { x: ux, y: Y0, z: uz - 0.6, yaw: 0, role: 1 },
  ];
  /* which pounder takes which strike: turn about; and each kind's times */
  const hits = C.filter((c) => c.kind === 'hit').map((c) => c.t);
  const HITS = [hits.filter((_, i) => i % 2 === 0), hits.filter((_, i) => i % 2 === 1)];
  const TURNS = C.filter((c) => c.kind === 'turn').map((c) => c.t);
  const SHOUTS = C.filter((c) => c.kind === 'shout').map((c) => c.t);
  const BIG = C.filter((c) => c.kind === 'big').map((c) => c.t);
  const before = (list, t) => { let r = null; for (const v of list) { if (v <= t) r = v; else break; } return r; };
  const after = (list, t) => { for (const v of list) if (v > t) return v; return null; };

  const shadows = makeShadows(dctx, 4);
  const shadow = HOME.map(() => shadows.slot());

  /* ---- the dough and the strand that follows the mallet up; the mochi; Hachi's treat ---- */
  const bitGeo = new THREE.SphereGeometry(1, 12, 8);
  bitGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(bitGeo.attributes.position.count * 3).fill(1), 3));
  const bits = new THREE.InstancedMesh(bitGeo, painted(), 2);
  bits.name = 'pettan-dough';
  bits.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bits.frustumCulled = false; bits.receiveShadow = true;
  bits.userData.noAtlas = true;
  dyn.add(bits);
  const _o = new THREE.Object3D(), _hide = new THREE.Matrix4().makeScale(0, 0, 0), _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
  const DOUGH = { x: ux, y: Y0 + 0.4, z: uz, r: 0.185, h: 0.075 };

  // (painted like what you hold, store/figure.js: its own two bands and key light, so it looks as good in the eave's shade)
  const foodMat = figureMaterial();
  const served = new THREE.Mesh(mochiGeometry(), foodMat);
  served.name = 'pettan-mochi';
  served.visible = false; served.receiveShadow = true;
  dyn.add(served);
  // two on the tray, for show
  const trayGeo = bake([[-0.085, 0.01, 0.3], [0.085, -0.02, -0.5]].map(([dx, dz, ry]) => ({ geometry: mochiGeometry({ detail: 0.42, plain: true }), matrix: trs(shop.tray[0] + dx, shop.tray[1], shop.tray[2] + dz, 0, ry, 0) })));
  const tray = new THREE.Mesh(trayGeo, foodMat);
  tray.name = 'pettan-tray';
  dyn.add(tray);
  const potato = new THREE.Mesh(potatoGeometry(), painted());
  potato.name = 'pettan-treat';
  potato.visible = false;
  dyn.add(potato);

  /* ---- steam and dust: soft pale puffs that swell and thin away (one instanced mesh) ---- */
  const PUFFS = 12, SEIRO = 4;
  const puffs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.62, depthWrite: false }), PUFFS);
  puffs.name = 'pettan-steam';
  puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  puffs.frustumCulled = false;
  puffs.userData.noOutline = true; puffs.userData.noAtlas = true;
  puffs.renderOrder = 3;
  dyn.add(puffs);
  const WHITE = new THREE.Color(0xfbfaf6), KINAKO = new THREE.Color(0xe2c588);
  const puff = Array.from({ length: PUFFS }, (_, i) => ({ t: i < SEIRO ? i / SEIRO : 1, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.1, live: i < SEIRO }));
  for (let i = 0; i < PUFFS; i++) { puffs.setMatrixAt(i, _hide); puffs.setColorAt(i, WHITE); }
  let nextPuff = SEIRO;
  function burst(x, y, z, n, { r = 0.07, up = 0.7, out = 0.25, life = 0.7, color = WHITE } = {}) {
    for (let k = 0; k < n; k++) {
      const i = nextPuff; nextPuff = SEIRO + ((nextPuff - SEIRO + 1) % (PUFFS - SEIRO));
      const a = Math.random() * Math.PI * 2;
      Object.assign(puff[i], { t: 0, life: life * (0.8 + 0.4 * Math.random()), x, y, z, vx: Math.cos(a) * out, vy: up * (0.7 + 0.6 * Math.random()), vz: Math.sin(a) * out, r: r * (0.8 + 0.4 * Math.random()), live: true });
      puffs.setColorAt(i, color);
    }
    puffs.instanceColor.needsUpdate = true;
  }
  function stepPuffs(dt) {
    for (let i = 0; i < PUFFS; i++) {
      const p = puff[i];
      if (i < SEIRO) {
        // the steamer: a slow column that leans off downwind
        p.t = (p.t + dt / 2.4) % 1;
        const u = p.t;
        _o.position.set(shop.seiro[0] + Math.sin(i * 2.4 + u * 3) * 0.06 + u * u * 0.22, shop.seiro[1] + u * 1.05, shop.seiro[2] + Math.cos(i * 1.7 + u * 2.2) * 0.05);
        _o.scale.setScalar((0.07 + 0.13 * u) * Math.min(1, u * 5) * (1 - u * u));
      } else {
        if (!p.live) continue;
        p.t += dt / p.life;
        if (p.t >= 1) { p.live = false; puffs.setMatrixAt(i, _hide); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vx *= 1 - 2.5 * dt; p.vz *= 1 - 2.5 * dt; p.vy *= 1 - 1.4 * dt;
        _o.position.set(p.x, p.y, p.z);
        _o.scale.setScalar(p.r * (0.5 + 1.3 * p.t) * (1 - p.t * p.t));
      }
      _o.rotation.set(0, 0, 0);
      _o.updateMatrix();
      puffs.setMatrixAt(i, _o.matrix);
    }
    puffs.instanceMatrix.needsUpdate = true;
  }

  /* ================================ the show ================================ */
  /** One rabbit's pose: where it stands and the rig's twelve numbers. */
  const blank = () => ({ x: 0, y: 0, z: 0, yaw: 0, swing: REST, lean: 0, sq: 0, flop: 0, reach: 0, nod: 0, look: 0, flick: 0, hold: 0, wipe: 0, twitch: 0 });
  const P = HOME.map(blank), Q = HOME.map(blank);
  const lookNow = [0, 0, 0];

  /** The show at `t` seconds into the recording (and on into the rest after it), into `out`. */
  function showPose(t, out) {
    const fin = t - LEN;                                      // into the finale
    // the cheer: everyone jumps, twice
    let jump = 0, jsq = 0, flick = 0, jflop = 0, cheer = 0;
    for (const b of BIG) {
      for (const [at, h, len] of [[b, 0.3, 0.5], [b + 0.56, 0.17, 0.36]]) {
        const x = t - at;
        if (x > -0.12 && x < 0) jsq -= 0.11 * (1 + x / 0.12);
        if (x >= 0 && x < len) { const s = Math.sin((Math.PI * x) / len); jump += h * s; jsq += 0.1 * Math.cos((Math.PI * x) / len); flick = Math.max(flick, Math.pow(s, 0.6)); jflop -= 0.55 * Math.cos((Math.PI * x) / len); }
        if (x >= len && x < len + 0.2) { jsq -= 0.1 * (1 - (x - len) / 0.2); jflop += 0.5 * (1 - (x - len) / 0.2); flick = Math.max(flick, 0.5 * (1 - (x - len) / 0.2)); }
      }
      cheer = Math.max(cheer, pulse(t - b + 0.1, 1.05, 0.14, 0.2));
    }
    // the calls on the pulse: a little bob, the ears apart
    const sh = before(SHOUTS, t);
    const bob = sh === null ? 0 : hump(t - sh, 0.24);
    // the bow at the end
    const bow = fin > 0 ? pulse(fin - 1.0, 1.1, 0.3, 0.3) : 0;
    const lastHit = before(hits, t);

    for (let i = 0; i < 3; i++) {
      const o = out[i], H = HOME[i];
      Object.assign(o, { x: H.x, y: H.y + jump, z: H.z, yaw: H.yaw, reach: 0, hold: 0, wipe: 0, look: 0 });
      o.sq = jsq + 0.045 * bob; o.flick = flick; o.twitch = bob; o.flop = jflop;
      if (i < 2) {
        // a pounder: ready on the shoulder, up, down onto the dough, held a moment, back up
        const face = fin > 0 ? ease(fin / 0.5) : 0;                  // the finale: round to the street, the mallet set down
        let swing = mix(READY, REST, face), lean = 0.03;
        const prev = before(HITS[i], t), next = after(HITS[i], t);
        // between its own blows it stands turned a little aside, its mallet clear of the mortar and the turner
        const busy = Math.max(prev === null ? 0 : 1 - ease((t - prev - 0.3) / 0.3), next === null ? 0 : ease((0.8 - (next - t)) / 0.25));
        o.yaw = mix(H.yaw - Math.sign(H.yaw) * 0.9 * (1 - busy) * (1 - cheer), H.yaw * 0.1, face);
        swing = mix(swing, mix(0.22, REST, face), 1 - busy);
        if (prev !== null) {
          const x = t - prev;
          if (x < 0.07) { swing = HIT; lean = LEAN_HIT; o.sq -= 0.06 * (1 - x / 0.07); }
          else if (x < 0.5) { const u = easeOut((x - 0.07) / 0.43); swing = mix(HIT, swing, u); lean = mix(LEAN_HIT, lean, u); }
          o.flop += 0.95 * Math.exp(-x * 6) * Math.cos(x * 15);       // the ears whip forward with the blow, and swing on
        }
        if (next !== null) {
          const x = next - t;                                            // s to the blow
          if (x < 0.11) { const u = 1 - x / 0.11; swing = mix(UP, HIT, u * u); lean = mix(-0.2, LEAN_HIT, u * u); o.flop -= 0.6 * (1 - u); o.sq += 0.07 * (1 - u); }
          else if (x < 0.56) { const u = ease((0.56 - x) / 0.45); swing = mix(swing, UP, u); lean = mix(lean, -0.2, u); o.flop -= 0.6 * u; o.sq += 0.07 * u; }
        }
        // the cheer: the mallet thrown up over its head
        swing = mix(swing, UP - 0.1, cheer);
        o.swing = swing; o.lean = lean + 0.5 * bow;
        o.nod = 0.16 - 0.3 * bob * (1 - cheer) - 0.3 * cheer + 0.25 * bow;
      } else {
        // the turner: its paw darts in between the blows, flat on the dough, and out again
        let reach = 0;
        const a = before(TURNS, t), b = after(TURNS, t);
        if (a !== null) { const x = t - a; reach = x < 0.05 ? 1 : 1 - ease((x - 0.05) / 0.17); }
        if (b !== null) { const x = b - t; if (x < 0.13) reach = Math.max(reach, easeOut(1 - x / 0.13)); }
        // never under a mallet: the paw is out before every blow lands
        const nh = after(hits, t);
        if (nh !== null && nh - t < 0.1) reach = Math.min(reach, (nh - t) / 0.1);
        if (lastHit !== null && t - lastHit < 0.09) { reach = 0; o.sq -= 0.03; }
        reach *= 1 - cheer;
        o.reach = reach;
        const hold = fin > 0 ? ease((fin - 0.2) / 0.4) * (1 - ease((fin - 2.15) / 0.3)) : 0;
        o.hold = Math.max(hold, 0.42 * cheer);
        o.lean = 0.1 + 0.2 * reach + 0.22 * bow - 0.1 * cheer;
        o.nod = 0.2 - 0.25 * bob * (1 - reach) - 0.42 * o.hold + 0.3 * bow;
        o.swing = 0;
        if (fin > 0) o.y += 0.1 * hump(fin - 0.62, 0.3);                 // a hop as the mochi goes up
      }
    }
  }

  /** Nobody near: mallets on shoulders, a brow wiped now and then, ears twitching, the turner patting the dough. */
  function idlePose(T, out) {
    for (let i = 0; i < 3; i++) {
      const o = out[i], H = HOME[i];
      // (the pounders turn a little to the street and rest their mallets down before the mortar)
      Object.assign(o, { x: H.x, y: H.y, z: H.z, yaw: H.yaw - Math.sign(H.yaw) * TURNED, reach: 0, hold: 0, flick: 0, flop: 0, swing: REST, lean: 0.03 });
      o.sq = 0.012 * Math.sin(T * 1.9 + i * 2.1);
      const w = pulse(((T + i * 2.7) % (6.4 + i)) - 0.4, 1.5, 0.3, 0.3);
      o.wipe = w;
      const tw = ((T * 0.9 + i * 1.37) % 3.7) / 0.5;
      o.twitch = tw < 1 ? Math.sin(Math.PI * tw) * Math.sin(Math.PI * 6 * tw) : 0;
      o.nod = 0.06 + 0.16 * w;
      o.look = lookNow[i] * (1 - w);
      if (i === 2) {
        const r = pulse((T % 2.9) - 0.2, 1.0, 0.3, 0.35) * (1 - w);
        o.reach = 0.85 * r; o.lean = 0.1 + 0.18 * r; o.nod = 0.1 + 0.2 * r + 0.16 * w; o.swing = 0;
      }
    }
  }

  /* ---- the state ---- */
  const S = { state: 'idle', t: 0, T: 0, rest: 2.5, handle: null, waited: 0, ci: 0, w: 0, ended: false, forced: null, hold: false, cam: { x: 0, z: 0, d: 99 }, hitT: -9, turnT: -9, primed: false, shows: 0, last: null };
  function startShow() {
    S.state = 'show'; S.t = 0; S.ci = 0; S.ended = false; S.waited = 0; S.shows++;
    S.rest = MOCHI.rest[0] + Math.random() * (MOCHI.rest[1] - MOCHI.rest[0]);
    S.handle = soundBus.oneShot('mochi-pound', { x: USU_W.x, z: USU_W.z, y: 1.0, ...SOUND.mochi, gain: MOCHI.gain });
  }
  function fire(c) {
    S.last = c;
    if (c.kind === 'hit') { S.hitT = c.t; burst(DOUGH.x, DOUGH.y + 0.08, DOUGH.z, 2, { r: 0.06, up: 0.75, out: 0.3, life: 0.65 }); GUIDE.showCue?.('hit'); }
    else if (c.kind === 'turn') S.turnT = c.t;
    else if (c.kind === 'big') GUIDE.showCue?.('big');
  }

  /* ================================ buying one ================================ */
  const B = MOCHI.buy;
  const product = STREET[MOCHI.id];
  let buy = null, eating = null, held = null, cardMesh;
  const EAT_RECIPE = { bite: 'soft', munch: 'paper' };
  const mine = (name) => soundBus.oneShot(name, { gain: STORE.eatGain[name] ?? 0.8, recipe: EAT_RECIPE[name] });
  const BUY_AT = [sx + 0.36, sz + 1.2];                      // where you stand to be served: before the stand, the mortar on your right
  const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _goal = new THREE.Vector3();
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const worldOf = (p, out) => dyn.localToWorld(out.set(p[0], p[1], p[2]));
  /** The hand's offset that brings what it holds to world point `w`. */
  function reachOff(w, camera, hands, out) {
    _v.copy(w); camera.worldToLocal(_v);
    _a.copy(hands.R.anchor.position).applyQuaternion(hands.R.pivot.quaternion);
    return out.copy(_v).sub(hands.R.rest.pos).sub(_a);
  }
  function lookAt(player, w, dt, rate = 4) {
    const e = player.camera.position, dx = w.x - e.x, dy = w.y - e.y, dz = w.z - e.z;
    const k = 1 - Math.exp(-dt * rate);
    player.yaw += wrap(Math.atan2(-dx, -dz) - player.yaw) * k;
    player.pitch += (Math.atan2(dy, Math.hypot(dx, dz)) - player.pitch) * k;
  }
  const spot = ctx.experiences.add({
    id: 'mochi', name: STRINGS.mochi.name, jp: STRINGS.mochi.jp,
    x: cx + MOCHI.spot[0], z: fz + MOCHI.spot[1], r: MOCHI.spot[2], y: Y0, h: 1.9, hitInside: true,
    label: `${STRINGS.mochi.jp}  ·  ${STRINGS.mochi.buy(product.priceYen)}`,
    action: ({ player, hud } = {}) => {
      const hands = PETTAN.hands;
      if (buy || !player || !hands || player.seat) return;
      dyn.updateWorldMatrix(true, false);
      const from = { x: player.pos.x, z: player.pos.z }, to = toWorld(BUY_AT[0], BUY_AT[1]);
      buy = { t: 0, player, hud, hands, mine: !player.suspended, from, to, glide: THREE.MathUtils.clamp(Math.hypot(to.x - from.x, to.z - from.z) / 2.4, 0.35, 1.1), fired: new Set(), off: new THREE.Vector3(), treat: null, hachi: !!GUIDE.where?.()?.watching };
      player.suspended = true;
      player.vel?.set(0, 0, 0);
      spot.show(false);
      hands.raise(true);
      // the konbini's IC card rides in the same hand (store/shop.js keeps it on the anchor)
      cardMesh = hands.anchor.children.find((c) => c.geometry?.parameters?.width === 0.086) ?? null;
      if (cardMesh) cardMesh.visible = true;
      eating ??= makeEating(hands, hands.skinMat, mine);
      held ??= Object.assign(new THREE.Mesh(served.geometry, hands.skinMat), { frustumCulled: false, renderOrder: 11 });
      soundBus.preload(['ka-ching', 'bite', 'munch']);
    },
  });
  const once = (key, fn) => { if (!buy.fired.has(key)) { buy.fired.add(key); fn(); } };

  /** The turner while it serves you: over to the stand with a mochi on its paw, sets it down, bows, tosses Hachi his treat, back. */
  const SERVE_AT = (() => { const p = pawAt(1, 0.14, 0.3); return { x: shop.plate[0] - p[0] * SCALE, z: shop.plate[2] - p[2] * SCALE }; })();
  const WAY = [[HOME[2].x, HOME[2].z], [ux - 1.25, uz - 0.55], [SERVE_AT.x, SERVE_AT.z]];
  function along(u, o, back = false) {
    // three hops along the way, facing where it goes; over the last of it, round to face the street
    const n = 3, f = clamp01(u) * n, k = Math.min(n - 1, Math.floor(f)), frac = f - k;
    const s = (k + ease(frac)) / n, q = back ? 1 - s : s;       // 0 at its place by the mortar .. 1 behind the stand
    const seg = q >= 0.5 ? 1 : 0, w = q * 2 - seg;
    o.x = mix(WAY[seg][0], WAY[seg + 1][0], w); o.z = mix(WAY[seg][1], WAY[seg + 1][1], w);
    const air = u < 1 ? Math.sin(Math.PI * frac) : 0, tip = u < 1 ? Math.cos(Math.PI * frac) : 0;
    o.y = Y0 + 0.13 * air; o.sq = 0.08 * tip; o.flop = -0.5 * tip;
    const sign = back ? -1 : 1;
    const heading = Math.atan2((WAY[seg + 1][0] - WAY[seg][0]) * sign, (WAY[seg + 1][1] - WAY[seg][1]) * sign);
    o.yaw = heading * (1 - ease((u - 0.72) / 0.28));
  }
  function serverPose(tb, o) {
    const backAt = (buy.hachi ? B.treat + 0.45 : B.take + 0.35);
    Object.assign(o, { swing: 0, reach: 0, hold: 0, wipe: 0, flick: 0, twitch: 0, look: 0, nod: 0.05, lean: 0.03, sq: 0, flop: 0 });
    if (tb < B.serve) return false;
    if (tb < B.serve + 0.95) {
      along((tb - B.serve) / 0.95, o);
      o.reach = 1; o.hold = 0.3; o.nod = 0;
    } else if (tb < backAt) {
      o.x = SERVE_AT.x; o.z = SERVE_AT.z; o.y = Y0; o.yaw = 0;
      const put = ease((tb - (B.set - 0.3)) / 0.3), let_ = ease((tb - B.set) / 0.3);
      const bowK = pulse(tb - B.set - 0.15, 0.75, 0.25, 0.25);
      const toss = buy.hachi ? pulse(tb - (B.treat - 0.4), 0.75, 0.3, 0.2) : 0;
      o.reach = (1 - let_) * 1; o.hold = Math.max(0.3 * (1 - let_), toss);
      o.lean = 0.14 * put * (1 - let_) + 0.5 * bowK + 0.03;
      o.nod = 0.1 * put + 0.3 * bowK - 0.3 * toss;
      o.twitch = hump(tb - B.set - 0.1, 0.3);
      o.look = buy.hachi ? -0.7 * toss : 0;
    } else if (tb < backAt + 0.95) {
      along((tb - backAt) / 0.95, o, true);
    } else return false;
    return true;
  }

  function stepBuy(dt) {
    const { player, hands } = buy, R = hands.R, camera = player.camera;
    buy.t += dt;
    const tb = buy.t;
    player.suspended = true;
    // to the stand, a step or two
    if (tb < buy.glide + dt) { const k = ease(tb / buy.glide); player.pos.x = mix(buy.from.x, buy.to.x, k); player.pos.z = mix(buy.from.z, buy.to.z, k); }
    // your eyes: the reader, the plate as the mochi comes, then the mortar again while you eat
    if (buy.treat && !buy.fired.has('caught')) lookAt(player, worldOf([potato.position.x, potato.position.y - 0.25, potato.position.z], _goal), dt, 5);
    else if (tb > B.eat + 0.2 || buy.fired.has('caught')) lookAt(player, worldOf([ux - 0.15, Y0 + 0.62, uz + 0.35], _goal), dt, 2.2);
    else lookAt(player, worldOf(tb < B.tap + 0.3 ? shop.reader : shop.plate, _goal), dt, 4.5);

    /* the card on the reader */
    let reach = 0, goal = null;
    if (tb < B.tap + 0.6) { reach = Math.min(easeOut((tb - 0.12) / (B.tap - 0.12)), 1 - ease((tb - B.tap - 0.25) / 0.35)); goal = worldOf(shop.reader, _goal); }
    if (tb >= B.tap) once('tap', () => soundBus.oneShot('ka-ching', { x: STAND_W.x, z: STAND_W.z, y: 1.0, near: 4, far: 18, gain: STORE.checkoutGain, recipe: 'can' }));
    if (tb >= B.tap + 0.45) once('card', () => { if (cardMesh) cardMesh.visible = false; });
    /* the mochi: on the turner's paw, then on the plate, then yours */
    if (tb >= B.serve) once('serve', () => { served.visible = true; });
    if (tb >= B.serve && tb < B.set) {
      const o = P[2], p = pawAt(o.reach, o.lean, o.hold), c = Math.cos(o.yaw), s = Math.sin(o.yaw);
      const lx = p[0] * SCALE, lz = p[2] * SCALE;
      served.position.set(o.x + c * lx + s * lz, o.y + p[1] * SCALE * (1 + o.sq) + 0.05, o.z - s * lx + c * lz);
    } else if (tb >= B.set) once('set', () => served.position.set(shop.plate[0], shop.plate[1], shop.plate[2]));
    if (tb > B.take - 0.42 && tb < B.take + 0.4) { reach = Math.min(easeOut((tb - (B.take - 0.42)) / 0.42), 1 - ease((tb - B.take) / 0.4)); goal = worldOf([shop.plate[0], shop.plate[1] + 0.03, shop.plate[2]], _goal); }
    if (tb >= B.take) once('take', () => {
      served.visible = false;
      held.position.set(0, 0, 0.012); held.rotation.set(0.32, -0.28, 0); held.visible = true;   // as store/eat.js holds it (food.js mochiStages)
      hands.anchor.add(held);
      burst(shop.plate[0], shop.plate[1] + 0.03, shop.plate[2], 3, { r: 0.035, up: 0.3, out: 0.22, life: 0.6, color: KINAKO });
      soundBus.oneShot('soft', { x: STAND_W.x, z: STAND_W.z, y: 1.0, ...SOUND.shelf, gain: 0.9, recipe: 'soft' });
    });
    if (goal && reach > 0) { reachOff(goal, camera, hands, buy.off); R.off.copy(buy.off).multiplyScalar(reach); }
    else if (tb < B.eat) R.off.multiplyScalar(Math.max(0, 1 - dt * 8));

    /* Hachi's treat: out of the jar, up, and over to him */
    if (buy.hachi && tb >= B.treat - 0.4) {
      const o = P[2];
      if (tb < B.treat) {
        once('jar', () => { potato.visible = true; });
        const p = pawAt(o.reach, o.lean, o.hold);
        potato.position.set(o.x + p[0] * SCALE, o.y + p[1] * SCALE + 0.05, o.z + p[2] * SCALE);
      } else if (!buy.fired.has('caught')) {
        once('toss', () => { buy.treat = { from: potato.position.clone(), t: 0 }; GUIDE.showCue?.('treat'); });
        const h = GUIDE.where?.();
        const tr = buy.treat;
        tr.t += dt / 0.62;
        if (h) { const l = ctx.toLocal({ x: h.x, z: h.z }); _v.set(l.x - cx, h.y + 0.3, l.z - fz); } else _v.copy(tr.from);
        const u = clamp01(tr.t);
        potato.position.lerpVectors(tr.from, _v, u);
        potato.position.y += 0.5 * Math.sin(Math.PI * u);
        potato.rotation.set(u * 9, u * 5, 0);
        if (u >= 1) once('caught', () => { potato.visible = false; GUIDE.showCue?.('catch'); });
      }
    }

    /* eating */
    if (tb >= B.eat) {
      once('eat', () => { R.off.set(0, 0, 0); eating.start({ id: MOCHI.id, mesh: held, onEaten: () => {} }); });
      eating.update(dt);
      if (eating.done && (!buy.hachi || buy.fired.has('caught'))) endBuy(true);
    }
  }
  function endBuy(ate) {
    const { player, hands, hud } = buy;
    if (!ate) eating?.stop();
    held?.removeFromParent();
    served.visible = false; potato.visible = false;
    if (cardMesh) cardMesh.visible = false;
    hands.R.off.set(0, 0, 0); hands.R.turn.set(0, 0, 0); hands.R.eat = 0;
    hands.raise(false);
    if (buy.mine) player.suspended = false;
    spot.show(true);
    if (ate) { spot.done(); hud?.flash?.(STRINGS.mochi.ate, 3600); }
    buy = null;
  }

  /* ================================ each frame ================================ */
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function place() {
    for (let i = 0; i < 3; i++) {
      const o = P[i];
      herd.set(i, o.x, o.y, o.z, o.yaw, 0, 0, SCALE);
      herd.setPose(i, o.swing, o.lean, o.sq, o.flop);
      herd.setPose2(i, HOME[i].role, o.reach, o.nod, o.look);
      pose3.setXYZW(i, o.flick, o.hold, o.wipe, o.twitch);
      const air = Math.max(0, o.y - HOME[i].y);
      shadows.set(shadow[i], o.x, i < 2 ? feetY : Y0, o.z, 0.22 * (1 - air), 0.22 * (1 - air), 0);
    }
    pose3.needsUpdate = true;
    herd.flush();
  }
  function placeDough(t, inShow) {
    // squashed under the blow, springing back; a wobble when the turner folds it
    const xh = inShow ? t - S.hitT : 9, xt = inShow ? t - S.turnT : 9;
    const squash = xh >= 0 && xh < 0.5 ? 0.42 * Math.exp(-xh * 9) * Math.cos(xh * 20) : 0;
    const fold = xt >= 0 && xt < 0.35 ? 0.12 * Math.sin((Math.PI * xt) / 0.35) : 0;
    _o.position.set(DOUGH.x, DOUGH.y - DOUGH.h * squash * 0.6, DOUGH.z);
    _o.rotation.set(0, fold * 3, 0);
    _o.scale.set(DOUGH.r * (1 + 0.22 * squash + fold * 0.3), DOUGH.h * (1 - squash + fold * 0.5), DOUGH.r * (1 + 0.22 * squash - fold * 0.3));
    _o.updateMatrix();
    bits.setMatrixAt(0, _o.matrix);
    // the strand: stuck to the mallet as it lifts, thinning, gone
    let strand = false;
    if (xh > 0.07 && xh < 0.34) {
      const who = HITS[0].includes(S.hitT) ? 0 : 1, o = P[who];
      const [fy, fzz] = malletFace(o.swing, o.lean);
      const fx = o.x + Math.sin(o.yaw) * fzz * SCALE, fzw = o.z + Math.cos(o.yaw) * fzz * SCALE, fyw = o.y + fy * SCALE * (1 + o.sq);
      _d.set(fx - DOUGH.x, fyw - (DOUGH.y + DOUGH.h * 0.5), fzw - DOUGH.z);
      const len = _d.length(), u = (xh - 0.07) / 0.27;
      if (len > 0.02 && len < 0.55) {
        _o.position.set(DOUGH.x + _d.x / 2, DOUGH.y + DOUGH.h * 0.5 + _d.y / 2, DOUGH.z + _d.z / 2);
        _o.quaternion.setFromUnitVectors(_up, _d.normalize());
        const th = 0.06 * (1 - u) * (1 - u) + 0.008;
        _o.scale.set(th, len / 2 + 0.02, th);
        _o.updateMatrix();
        bits.setMatrixAt(1, _o.matrix);
        _o.rotation.set(0, 0, 0);
        strand = true;
      }
    }
    if (!strand) bits.setMatrixAt(1, _hide);
    bits.instanceMatrix.needsUpdate = true;
  }

  ctx.update((dt, cam) => {
    if (!cam) return;
    const l = ctx.toLocal({ x: cam.x, z: cam.z });
    const gx = l.x - cx, gz = l.z - fz;
    const d = Math.hypot(gx - ux, gz - uz);
    S.cam.x = gx; S.cam.z = gz; S.cam.d = d;
    const seen = d < MOCHI.hide || !!buy;
    dyn.visible = seen;
    if (!seen) { if (S.state !== 'idle') { S.state = 'idle'; S.handle = null; GUIDE.watchShow?.(null); } return; }
    S.T += dt;
    if (!S.primed && d < 40 && soundBus.ready) { S.primed = true; soundBus.preload(['mochi-pound']); }
    stepPuffs(dt);

    /* the show's clock: the recording's own, where there is one */
    const near = d < MOCHI.near;
    if (S.forced !== null) { S.state = 'show'; S.t = S.forced; S.ci = C.length; S.hitT = before(hits, S.t) ?? -9; S.turnT = before(TURNS, S.t) ?? -9; }
    else if (S.state === 'idle') { if (near && !S.hold && dt > 0) startShow(); }
    else {
      const h = S.handle;
      if (h?.pos && !h.ended) S.t = Math.max(0, h.pos() + MOCHI.sync);
      else if (h && !h.pos && !h.ended && S.waited < 3) S.waited += dt;        // its file is still coming: the rabbits wait for it
      else S.t += dt;
      while (S.ci < C.length && C[S.ci].t <= S.t) fire(C[S.ci++]);
      if (S.t >= LEN + 0.3 && !S.ended) { S.ended = true; GUIDE.showCue?.('end'); }
      if (S.t >= LEN + S.rest) { if (near && !S.hold) startShow(); else { S.state = 'idle'; S.handle = null; } }
    }
    const inShow = S.state === 'show';
    // Hachi watches while it plays and you are about
    GUIDE.watchShow?.((inShow && d < MOCHI.near + 4) || buy ? WATCH : null);

    if (d > MOCHI.live && !inShow && !buy) return;                    // far off, idle: only the steamer steams
    // idle heads follow you a little
    for (let i = 0; i < 3; i++) {
      const H = HOME[i], want = THREE.MathUtils.clamp(wrap(Math.atan2(gx - H.x, gz - H.z) - H.yaw + Math.sign(H.yaw) * TURNED), -0.8, 0.8) * (d < 12 ? 1 : 0);
      lookNow[i] += (want - lookNow[i]) * Math.min(1, dt * 2.5);
    }
    S.w += THREE.MathUtils.clamp((inShow ? 1 : 0) - S.w, -dt * 3, dt * 4);
    if (S.forced !== null) S.w = 1;
    if (S.w > 0.001) showPose(S.t, Q);
    idlePose(S.T, P);
    if (S.w > 0.001) for (let i = 0; i < 3; i++) for (const k in P[i]) P[i][k] = mix(P[i][k], Q[i][k], S.w);
    if (buy) { if (serverPose(buy.t, Q[2])) Object.assign(P[2], Q[2]); stepBuy(dt); }
    place();
    placeDough(S.t, inShow);
  });

  idlePose(0, P); place(); placeDough(0, false);

  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    window.__mochi = {
      S, P, HOME, shop, herd, spot, HIT, cues: C,
      /** Stand the show at `t` s into the recording (null: let it run); no sound. */
      stage(t) { S.forced = t; if (t === null) { S.state = 'idle'; S.handle = null; } },
      /** Keep the show from starting (dev shots of the idle), or let it. */
      hold(on) { S.hold = on; if (on && S.state !== 'idle' && S.forced === null) { S.state = 'idle'; S.handle = null; } },
      get buy() { return buy; },
      get eating() { return eating; },
      served, held: () => held, potato,
      world: { usu: USU_W, stand: STAND_W, seat: SEAT_W, buyAt: toWorld(BUY_AT[0], BUY_AT[1]), spot: toWorld(MOCHI.spot[0], MOCHI.spot[1]) },
      tris: () => ({ rabbit: geo.index.count / 3, mochi: served.geometry.index.count / 3, tray: trayGeo.index.count / 3, house: shop.tris }),
    };
  }
  return { group: shop.group, type: 'old', H: shop.H };
}
