import '../core/fonts.js';     // first: the sign fonts are ready before the town paints its signs
import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { Pipeline } from '../core/post.js';
import { buildSky } from '../core/sky.js';
import { setOutlineResolution } from '../core/outline.js';
import { WALK_SIGNALS } from '../world/signals.js';
import { buildTown } from '../world/town.js';             // WORLD: the phone's own town goes here (the world build's)
import { tagReflections } from '../world/land/mirror.js';
import { STRINGS, MOBILE_STRINGS as M } from '../data/strings.js';
import { PRODUCT } from '../data/catalog.js';
import { hanShow } from '../world/han/index.js';
import { GUIDE } from '../world/animals/guide.js';
import { PETTAN } from '../world/mochi/index.js';
import { PLAYER_VFOV, HERO_VIEWS, LOOKS, SPAWN, FUJI, LAWSON, HAN_WATCH, ANIMALS, MOBILE } from '../config.js';
import { bootStage, createShell } from './shell.js';
import { gpuMeter, createDiag } from './diag.js';

/* ------------------------------------------------------------------ *
 * Take Me Back to Japan, the phone build (docs/decisions/mobile-lite.md).
 *
 * Two halves:
 *   the shell   everything the player touches and reads (shell.js: the
 *               walker, touch, the HUD and cards, the map, the sound's
 *               waking and labels, Hachi's buttons, the postcard)
 *   the world   the town, its look and its loop: this file.  "Mobile v3:
 *               UI" was built and tested against the desktop's own town
 *               (world/town.js) here; the phone's mini town replaces the
 *               lines marked WORLD and keeps the lines marked SHELL.
 *
 * What the desktop's main.js does is kept in the same order, with its dev
 * tools left out; keep the two in step.
 * ------------------------------------------------------------------ */

const canvas = document.getElementById('view');
const nextPaint = () => new Promise((r) => { requestAnimationFrame(() => setTimeout(r, 0)); setTimeout(r, 150); });
const showGate = (kind) => document.documentElement.classList.add(`gate-${kind}`);
let contextLost = false;
const T0 = performance.now();
const marks = {};
const mark = (k) => { marks[k] = Math.round(performance.now() - T0); };
const params = new URLSearchParams(location.search);
const diag = createDiag({ on: params.has('diag') });

/* Our own context, so every GPU allocation is counted (diag.js). */
let renderer, meter = null, shell = null;
try {
  const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance', stencil: false, depth: true, alpha: false, premultipliedAlpha: true, preserveDrawingBuffer: false });
  if (!gl) throw new Error('no webgl2 context');
  meter = gpuMeter(gl);
  renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false, stencil: false });
} catch (err) {
  console.warn('No WebGL 2:', err?.message ?? err);
  showGate('nogl');
  await new Promise(() => {});
}
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.setClearColor(new THREE.Color(PAL.fog), 1);
diag.source({ renderer, meter, canvas, extra: () => `scale ${renderScale?.toFixed?.(2)}` });
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  contextLost = true;
  diag.stage(`CONTEXT LOST (at ${diag.stageName})`);
  shell?.setLost(true);                                   // SHELL: hush, pause, no waking
  showGate('lost');
});

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PAL.fog, 44, 205);
const camera = new THREE.PerspectiveCamera(PLAYER_VFOV, 1, 0.25, 3200);
camera.rotation.order = 'YXZ';

/* --------------------------------- light --------------------------------- */
const sun = new THREE.DirectionalLight(PAL.sun, 2.25);
sun.position.set(-52, 62, 56);
sun.castShadow = true;
const SH = MOBILE.shadow ?? { size: 1536, half: 32, every: 2 };
sun.shadow.mapSize.set(SH.size, SH.size);
sun.shadow.camera.left = -SH.half;
sun.shadow.camera.right = SH.half;
sun.shadow.camera.top = SH.half;
sun.shadow.camera.bottom = -SH.half;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 200;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(PAL.fill, 1.08);
fill.position.set(48, 26, -44);
scene.add(fill, fill.target);
const bounce = new THREE.DirectionalLight(0xd8cbe8, 0.34);
bounce.position.set(10, -18, 40);
scene.add(bounce, bounce.target);
const hemi = new THREE.HemisphereLight(PAL.hemiSky, PAL.hemiGround, 1.12);
scene.add(hemi);

/* --------------------------------- world --------------------------------- */
bootStage(M.building, '40%');                              // SHELL: the loading card's line and bar
await nextPaint();
mark('building');
diag.stage('building');
const sky = buildSky(scene, 2900, { avoidYaw: FUJI.bearing });
let renderScale = 1, viewW = 0, viewH = 0;
const world = buildTown(scene);                            // WORLD
mark('built');
diag.stage('built');
bootStage(M.ready, '75%');
await nextPaint();
let famousView = { x: SPAWN.pos[0], z: SPAWN.pos[2] };

const shadowOnly = [];
scene.traverse((o) => { if (o.userData.shadowOnly) { o.visible = false; shadowOnly.push(o); } });
if (shadowOnly.length) {
  const drawShadows = renderer.shadowMap.render;
  renderer.shadowMap.render = function (...args) {
    for (const o of shadowOnly) o.visible = !o.userData.shadowEmpty;
    drawShadows.apply(this, args);
    for (const o of shadowOnly) o.visible = false;
  };
}

/* SHELL: the walker, the touch controls, the HUD and cards, the map, the sound (made, labelled and attached to the
 * soundBus here), Hachi's buttons, the postcard.  main.js tells it what holds the view and answers two buttons. */
const TIMES = ['golden', 'night', 'morning'];
shell = createShell({
  canvas, camera, world,
  held: () => !!gliding || watch.on,
  famous: () => !!famousView,
  onTime: () => { if (!fade) setTime(TIMES[(TIMES.indexOf(lastView) + 1) % TIMES.length]); },
  onRestart: () => enterHero(lastView),
});
const { player, hud, sound } = shell;

const shop = world.lawson?.shop ?? null;
if (shop) {
  scene.add(shop.view, shop.fx);
  shop.player = player;
  PETTAN.attach({ hands: shop.hands });      // ぺったん堂 borrows your hand for its mochi (world/mochi/)
  world.interactables.push(...(world.lawson.interactables ?? []));
  // the Strong Nine: ten seconds a little tipsy
  shop.onTipsy = () => { tipsy = 0; hud.flash(STRINGS.store.tipsy, 3200); };
}

/* The sound's places (the engine is the shell's: every file and every place's sound, the desktop's mix). */
world.line?.onEvent((name, run) => {
  if (name === 'chime') sound.chime(Math.hypot(camera.position.x - run.x, camera.position.z - run.z));
});
const _v = new THREE.Vector3();
let lastStride = 0;
const DOOR_AT = { x: LAWSON.x + LAWSON.doorX, y: 2.2, z: LAWSON.frontZ };
const CHIME_AT = { x: LAWSON.x + LAWSON.doorX, y: 2.7, z: LAWSON.frontZ - 1.2 };
scene.updateMatrixWorld(true);
const walkAt = WALK_SIGNALS.map((w) => ({ w, p: w.marker.getWorldPosition(new THREE.Vector3()) }));
const walkList = walkAt.map(({ w, p }) => ({ x: p.x, z: p.z, on: false, sound: w.sound }));
if (shop) {
  shop.onEnter = () => sound.storeChime(CHIME_AT);
  shop.onExit = () => sound.storeChime(CHIME_AT);
  shop.doors.onSound = (door, opening) => sound.fridgeDoor({ x: door.box.getCenter(_v).x, y: 1.2, z: _v.z }, opening);
  shop.onSound = (kind, u) => {
    if (kind === 'take') sound.item(PRODUCT[u.id].sound, shop.unitAt(u));
  };
}
if (world.lawson?.door) world.lawson.door.onMove = (opening) => sound.autoDoor(DOOR_AT, opening);

/* ------------------------------- pipeline ------------------------------- *
 * The desktop's ink and grade passes (the look), no FXAA pass, at a phone's
 * pixel budget; the scale steps down when frames run long (adapt, below). */
const R = MOBILE.render ?? { pixels: 2.2e6, scale: 2, start: 2, minScale: 1, fpsLow: 26, fpsHigh: 45 };
const pipeline = new Pipeline(renderer, scene, camera, { pixelBudget: R.pixels });
pipeline.enabled.fxaa = false;
const dpr = Math.min(window.devicePixelRatio || 1, 3);
renderScale = Math.min(R.start ?? R.scale, Math.max(1, dpr));
pipeline.forceScale = renderScale;

/* --------------------------------- looks --------------------------------- */
const SUN_DIR = new THREE.Vector3(-52, 62, 56);
const FILL_DIR = new THREE.Vector3(48, 26, -44);
const BOUNCE_DIR = new THREE.Vector3(10, -18, 40);
let lookName = null;
function applyLook(name) {
  const look = LOOKS[name];
  lookName = name;
  sky.setLook(look);
  world.setLook(look);
  scene.fog.color.set(look.fog.color);
  scene.fog.near = look.fog.near;
  scene.fog.far = look.fog.far;
  renderer.setClearColor(look.fog.color, 1);
  sun.color.set(look.sun.color);
  sun.intensity = look.sun.intensity;
  SUN_DIR.set(...look.sun.dir);
  fill.color.set(look.fill.color);
  fill.intensity = look.fill.intensity;
  bounce.intensity = look.bounce;
  hemi.color.set(look.hemi.sky);
  hemi.groundColor.set(look.hemi.ground);
  hemi.intensity = look.hemi.intensity;
  const g = pipeline.grade.mat.uniforms;
  g.uShadowTint.value.set(look.grade.shadow);
  g.uLightTint.value.set(look.grade.light);
  g.uSaturation.value = look.grade.saturation;
  g.uLift.value = look.grade.lift;
  g.uVignette.value = look.grade.vignette;
  g.uWarmth.value = look.grade.warmth;
  shadowAt = null;                       // the light moved: draw the shadows again
}

/* ------------------------------ hero views ------------------------------ */
const HERO_DAY = HERO_VIEWS.morning;
const FUJI_GAMEPLAY = FUJI.gameplaySize
  * Math.tan(THREE.MathUtils.degToRad(PLAYER_VFOV / 2))
  / Math.tan(THREE.MathUtils.degToRad(HERO_DAY.vfov / 2));
if (shop) shop.isFamousView = () => !!famousView;
let lastView = SPAWN.view;

/* The lens: the desktop's vertical field of view in landscape.  In portrait
 * that is a slit (about 20° across), so there the view widens, up to
 * PORTRAIT_VFOV, to keep ~40° across; Fuji keeps its angular size (it is
 * the frame round it that grows). */
const PORTRAIT_VFOV = 80, MIN_HFOV = 52;
function lensVfov(aspect) {
  const want = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(MIN_HFOV / 2)) / aspect) * 180 / Math.PI;
  return Math.min(PORTRAIT_VFOV, Math.max(PLAYER_VFOV, want));
}
function updateProjection() {
  camera.fov = lensVfov(camera.aspect);
  camera.updateProjectionMatrix();
  world.fuji.magnify(FUJI_GAMEPLAY);
}

function enterHero(name) {
  const v = HERO_VIEWS[name];
  lastView = name;
  applyLook(v.look);
  shell.setTime(name);                                     // SHELL: the time tile's icon and word
  const spot = v.play;
  player.pos.set(spot.pos[0], world.heightAt(spot.pos[0], spot.pos[2]), spot.pos[2]);
  player.vel.set(0, 0, 0);
  player.yaw = spot.yaw;
  player.pitch = spot.pitch;
  player.bob = 0;
  player.holdLook = false;
  famousView = { x: player.pos.x, z: player.pos.z };
  player.applyCamera(0);
  updateProjection();
}

/* The time of day: a short dip to dark hides the switch (desktop's setTime). */
const fadeEl = document.createElement('div');
fadeEl.style.cssText = 'position:fixed;inset:0;background:#0c0a14;opacity:0;pointer-events:none;z-index:4';
document.body.appendChild(fadeEl);
let fade = null;
function setTime(name) {
  if (fade || name === lastView) return;
  fade = { t: 0, name, done: false };
}
function timeFade(dt) {
  if (!fade) return;
  fade.t += Math.min(dt, 1 / 30) || 1 / 60;
  const IN = 0.22, HOLD = 0.08, OUT = 0.4;
  if (!fade.done && fade.t >= IN) {
    fade.done = true;
    lastView = fade.name;
    applyLook(HERO_VIEWS[fade.name].look);
    shell.setTime(fade.name, true);                        // SHELL: the tile, and a toast naming the time
  }
  fadeEl.style.opacity = String(fade.t < IN ? fade.t / IN : Math.max(0, 1 - (fade.t - IN - HOLD) / OUT));
  if (fade.t > IN + HOLD + OUT) { fade = null; fadeEl.style.opacity = '0'; }
}

/* The Nippon Fuji view as a place to stand (desktop's viewSpot). */
const VIEW_SPOT = HERO_VIEWS.morning.play;
let gliding = null;
function viewSpot(dt) {
  if (gliding) {
    gliding.t += dt;
    const k = THREE.MathUtils.smootherstep(gliding.t / 1.3, 0, 1);
    const f = gliding.from;
    player.pos.x = f.x + (VIEW_SPOT.pos[0] - f.x) * k;
    player.pos.z = f.z + (VIEW_SPOT.pos[2] - f.z) * k;
    player.yaw = f.yaw + Math.atan2(Math.sin(VIEW_SPOT.yaw - f.yaw), Math.cos(VIEW_SPOT.yaw - f.yaw)) * k;
    player.pitch = f.pitch + (VIEW_SPOT.pitch - f.pitch) * k;
    player.applyCamera(0);
    if (gliding.t >= 1.3) { gliding = null; player.scripted = false; enterHero(lastView); }
    return;
  }
  if (famousView || player.scripted || player.seat || !player.locked) return;
  if (Math.hypot(player.pos.x - VIEW_SPOT.pos[0], player.pos.z - VIEW_SPOT.pos[2]) < 0.8) {
    gliding = { t: 0, from: { x: player.pos.x, z: player.pos.z, yaw: player.yaw, pitch: player.pitch } };
    player.scripted = true;
    player.vel.set(0, 0, 0);
  }
}

/* Han's drive: the view follows the car (desktop's watchCar). */
const watch = { on: false, mine: false, gone: false, t: new THREE.Vector3(), at: { x: 0, z: 0 } };
function watchCar(dt) {
  if (watch.on && Math.hypot(player.pos.x - watch.at.x, player.pos.z - watch.at.z) > 1) watch.gone = true;
  if (!hanShow.running) watch.gone = false;
  const on = hanShow.running && !watch.gone && !player.scripted && !player.seat && !famousView && !gliding;
  if (on && !watch.on) {
    watch.on = true;
    watch.mine = !player.suspended;
    player.suspended = true;
    player.vel.set(0, 0, 0);
    watch.at.x = player.pos.x; watch.at.z = player.pos.z;
  } else if (!on && watch.on) {
    watch.on = false;
    if (watch.mine) player.suspended = false;
    watch.mine = false;
  }
  if (!on || dt <= 0) { watch.last = 0; return; }
  const nowMs = performance.now();
  const rdt = watch.last ? Math.min(0.25, (nowMs - watch.last) / 1000) : dt;
  watch.last = nowMs;
  dt = Math.max(dt, rdt);
  const W = HAN_WATCH, t = hanShow.target(watch.t), c = camera.position;
  const dx = t.x - c.x, dz = t.z - c.z;
  const yaw = Math.atan2(-dx, -dz);
  const pitch = THREE.MathUtils.clamp(Math.atan2(t.y - c.y, Math.hypot(dx, dz)), W.pitch[0], W.pitch[1]);
  const k = 1 - Math.exp(-W.follow * dt);
  const dy = Math.atan2(Math.sin(yaw - player.yaw), Math.cos(yaw - player.yaw));
  const turnMax = W.maxTurn * (1 + 3 * Math.max(0, Math.abs(dy) - 0.35));
  player.yaw += THREE.MathUtils.clamp(dy * k, -turnMax * dt, turnMax * dt);
  player.pitch += THREE.MathUtils.clamp((pitch - player.pitch) * k, -W.maxTurn * 0.6 * dt, W.maxTurn * 0.6 * dt);
}

/* Hachi's hello: the view eases down to the pup and back (desktop's watchPup).  A drag or a step of your own and
 * the view is yours at once. */
const pupLook = { on: false, back: false, pitch0: 0, looked: 0, at: { x: 0, z: 0 } };
function watchPup(dt) {
  if (dt <= 0) return;
  const A = ANIMALS.guide.intro;
  const free = !player.scripted && !player.seat && !player.suspended && !gliding && player.locked;
  const mine = () => player.looked - pupLook.looked > 40 || Math.hypot(player.pos.x - pupLook.at.x, player.pos.z - pupLook.at.z) > 0.3;
  const t = free ? GUIDE.greeting() : null;
  if (t && !pupLook.on && !pupLook.back) {
    pupLook.on = true; pupLook.pitch0 = player.pitch; pupLook.looked = player.looked;
    pupLook.at.x = player.pos.x; pupLook.at.z = player.pos.z;
  }
  if (!pupLook.on && !pupLook.back) return;
  if (!free || mine()) { pupLook.on = pupLook.back = false; return; }
  const k = 1 - Math.exp(-A.follow * dt);
  if (t) {
    const c = camera.position, dx = t.x - c.x, dz = t.z - c.z;
    const yaw = Math.atan2(-dx, -dz), pitch = Math.max(A.pitchMin, Math.atan2(t.y - c.y, Math.hypot(dx, dz)) + A.above);
    player.yaw += Math.atan2(Math.sin(yaw - player.yaw), Math.cos(yaw - player.yaw)) * k * 0.5;
    player.pitch += (pitch - player.pitch) * k;
  } else if (pupLook.on) { pupLook.on = false; pupLook.back = true; }
  else {
    player.pitch += (pupLook.pitch0 - player.pitch) * k * 0.6;
    if (Math.abs(pupLook.pitch0 - player.pitch) < 0.01) pupLook.back = false;
  }
}

/* The Strong Nine: ten seconds a little tipsy (desktop's tipsyStep). */
let tipsy = -1, tipsyT = 0;
function tipsyStep(dt) {
  if (tipsy < 0) return;
  if (player.locked) tipsy += dt;
  tipsyT += dt;
  const k = Math.min(1, tipsy / 1.5) * Math.min(1, Math.max(0, (10 - tipsy) / 2));
  canvas.style.filter = k > 0.01 ? `blur(${(k * 3).toFixed(2)}px)` : '';
  if (tipsy >= 10) { tipsy = -1; canvas.style.filter = ''; return; }
  player.yaw += Math.sin(tipsyT * 0.7) * 0.22 * k * dt;
  camera.rotation.z += Math.sin(tipsyT * 1.1) * 0.05 * k;
  camera.rotation.x += Math.sin(tipsyT * 0.8 + 1) * 0.02 * k;
}

/* ------------------------------- the screen ------------------------------- */
function resize() {
  const vv = window.visualViewport;
  const w = Math.round(vv?.width ?? window.innerWidth), h = Math.round(vv?.height ?? window.innerHeight);
  if (w === viewW && h === viewH) return;
  viewW = w; viewH = h;
  camera.aspect = w / h;
  updateProjection();
  pipeline.setSize(w, h);
  pipeline.rtB.setSize(1, 1);          // (the FXAA pass is off: its target would hold a whole frame for nothing)
  // the canvas itself at the inside size, so the last pass draws 1:1 onto the phone's pixels
  renderer.setPixelRatio(pipeline.scale);
  renderer.setSize(w, h, true);
  setOutlineResolution(pipeline.size.x, pipeline.size.y);
  shell.resize();                                          // SHELL: the stick's rest, the open map, the portrait hint
}
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
// iOS reports the new size a little after it turns
window.addEventListener('orientationchange', () => { setTimeout(resize, 120); setTimeout(resize, 600); });

/* --------------------------------- shadows --------------------------------- */
const shadowTarget = new THREE.Vector3();
function seatLight(light, dir, origin) {
  light.target.position.copy(origin);
  light.position.copy(origin).add(dir);
}
const SNAP = 4;
let shadowAt = null, shadowAge = 1e9;
const _lr = new THREE.Vector3(), _lu = new THREE.Vector3(), _lf = new THREE.Vector3();
function snapToTexel(p) {
  const cam = sun.shadow.camera;
  const texel = (cam.right - cam.left) / sun.shadow.mapSize.x;
  _lf.copy(SUN_DIR).normalize();
  _lr.set(0, 1, 0).cross(_lf).normalize();
  _lu.copy(_lf).cross(_lr).normalize();
  const r = Math.round(p.dot(_lr) / texel) * texel, u = Math.round(p.dot(_lu) / texel) * texel, f = p.dot(_lf);
  p.copy(_lr).multiplyScalar(r).addScaledVector(_lu, u).addScaledVector(_lf, f);
}
function seatLights(dt = 0) {
  shadowTarget.set(player.pos.x - Math.sin(player.yaw) * 14, 0, player.pos.z - Math.cos(player.yaw) * 14);
  shadowTarget.x = Math.round(shadowTarget.x / SNAP) * SNAP;
  shadowTarget.z = Math.round(shadowTarget.z / SNAP) * SNAP;
  snapToTexel(shadowTarget);
  seatLight(sun, SUN_DIR, shadowTarget);
  seatLight(fill, FILL_DIR, shadowTarget);
  seatLight(bounce, BOUNCE_DIR, shadowTarget);
  shadowAge += dt;
  const moved = !shadowAt || shadowAt.x !== shadowTarget.x || shadowAt.z !== shadowTarget.z;
  if (moved || shadowAge > SH.every) {
    shadowAt = { x: shadowTarget.x, z: shadowTarget.z };
    shadowAge = 0;
    renderer.shadowMap.needsUpdate = true;
  }
}

/* --------------------------------- loop --------------------------------- */
const clock = new THREE.Clock();
let lastDraw = 0;
// adaptive resolution: the frame rate over the last couple of seconds sets the scale
const perf = { n: 0, t: 0, fps: 60 };
function adapt(rawDt) {
  perf.n++; perf.t += rawDt;
  if (perf.t < 2) return;
  perf.fps = perf.n / perf.t;
  perf.n = 0; perf.t = 0;
  let s = renderScale;
  if (perf.fps < R.fpsLow && s > R.minScale) s = Math.max(R.minScale, s - 0.15);
  else if (perf.fps > R.fpsHigh + 8 && s < Math.min(R.scale, Math.max(1, dpr))) s = Math.min(R.scale, Math.max(1, dpr), s + 0.1);
  if (s !== renderScale) {
    renderScale = s;
    pipeline.forceScale = s;
    viewW = 0; resize();
  }
}

function frame(now = 0) {
  if (contextLost) return;
  requestAnimationFrame(frame);
  if (document.hidden) return;
  // paused (a card up), the game stands still and draws ten frames a second
  const menu = !player.locked;
  if (menu && now - lastDraw < 100) return;
  lastDraw = now;
  const raw = clock.getDelta();
  const tick = Math.min(raw, MOBILE.dt ?? 1 / 20);
  const dt = menu ? 0 : tick;
  if (!menu) adapt(raw);

  watchCar(dt);
  watchPup(dt);
  if (!player.scripted) player.update(dt);
  if (watch.on) { player.pos.x = watch.at.x; player.pos.z = watch.at.z; player.applyCamera(0); }
  viewSpot(dt);
  tipsyStep(dt);
  timeFade(dt);
  world.update(dt, camera);
  seatLights(dt);
  if (world.line) {
    const c = world.line.crossingPos;
    sound.bells(world.line.service.cross.bells, Math.hypot(camera.position.x - c.x, camera.position.z - c.z));
    GUIDE.bells.on = world.line.service.cross.bells; GUIDE.bells.x = c.x; GUIDE.bells.z = c.z;      // (Hachi hears them too)
  }
  sky.dome.position.copy(camera.position);
  sky.clouds.position.copy(camera.position);
  if (famousView && Math.hypot(player.pos.x - famousView.x, player.pos.z - famousView.z) >= 1.5) famousView = null;

  if (shop) shop.update(dt, camera, player.bob);
  const inStore = !!shop?.inside(camera);
  shell.update(dt, { inStore });                           // SHELL: the cards' song, the map, the context button, the chips, the countdown, the postcard
  sound.update(dt, { camera, inside: inStore, look: lookName, cooler: shop?.coolerAt });
  walkAt.forEach(({ w }, i) => { walkList[i].on = w.walk(); });
  sound.walkSignals(walkList);
  const stride = Math.floor(player.bob / (2 * Math.PI));
  if (stride !== lastStride) { lastStride = stride; if (player.locked) sound.step(inStore); }

  pipeline.render();
  diag.update();
}

/* ------------------------------ first frame ------------------------------ */
if (world.reflectRect) {
  tagReflections(scene, world.root, world.reflectRect);
  world.fuji?.ready?.then(() => tagReflections(scene, world.root, world.reflectRect));
}
enterHero(SPAWN.view);
resize();
world.update(0, camera);
seatLights();
sky.dome.position.copy(camera.position);
sky.clouds.position.copy(camera.position);
// the shaders compile and the textures upload behind the loading card, not on the first touch
diag.stage('compiling');
try { await renderer.compileAsync(scene, camera); } catch { /* compiled on first draw instead */ }
mark('compiled');
diag.stage('first frame');
pipeline.render();
mark('firstFrame');
diag.stage('ready');
await nextPaint();

// SHELL: the loading card becomes the start card; only its Start button starts the town
shell.onStart = () => { clock.getDelta(); mark('started'); diag.stage('playing'); };
shell.ready();
mark('ready');
frame();

if (import.meta.env?.DEV || params.has('stats')) {
  window.__m = {
    scene, camera, renderer, pipeline, world, player, sound, hud, shell, THREE, marks, perf, applyLook, enterHero, setTime,
    hanShow, GUIDE, diag, meter, get scale() { return renderScale; }, touch: shell.touch,
  };
}
