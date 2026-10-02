import '../core/fonts.js';     // first: the sign fonts are ready before the town paints its signs
import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { Pipeline } from '../core/post.js';
import { buildSky } from '../core/sky.js';
import { setOutlineResolution } from '../core/outline.js';
import { createSound } from '../core/sound.js';
import { soundBus } from '../core/soundBus.js';
import { WALK_SIGNALS } from '../world/signals.js';
import { createMinimap } from '../ui/minimap.js';
import { trainWaitLabel } from '../ui/trainWait.js';
import { STRINGS, MOBILE_STRINGS as M } from '../data/strings.js';
import { PRODUCT } from '../data/catalog.js';
import { hanShow } from '../world/han/index.js';
import { GUIDE } from '../world/animals/guide.js';
import { PETTAN } from '../world/mochi/index.js';
import { storePages } from '../world/store/pages.js';
import { tagReflections } from '../world/land/mirror.js';
import {
  PLAYER_VFOV, HERO_VIEWS, LOOKS, SPAWN, FUJI, LAWSON, VOLUME_STEPS, DEFAULT_VOLUME, volumeGain, HAN_WATCH, ANIMALS, MOBILE,
} from '../config.js';
import { buildTown } from './town.js';
import { liteConfig, liteScene, liteFuji, makeCuller, census, shrinkCanvases } from './lite.js';
import { TouchPlayer } from './player.js';
import { createTouch } from './touch.js';
import { createMobileHud } from './hud.js';
import { watchMediaElements, unlockAudio, audioState } from './audio.js';
import { gpuMeter, createDiag } from './diag.js';
import { attachPocketControls } from './pocket/controls/index.js';

/* ------------------------------------------------------------------ *
 * Take Me Back to Japan, the phone build (docs/decisions/mobile-lite.md).
 *
 * src/main.js's game -- the same town, builders, look, sound engine and
 * experiences -- made light enough for a phone (lite.js), played by touch
 * (touch.js, player.js, hud.js), with iOS's audio rules met (audio.js).
 * What the desktop's main.js does is kept in the same order here, with its
 * dev tools left out; keep the two in step.
 * ------------------------------------------------------------------ */

const canvas = document.getElementById('view');
const boot = document.getElementById('boot');
const bootLine = boot?.querySelector('.line');
function bootStage(text, progress) {
  if (!boot) return;
  if (bootLine) bootLine.textContent = text;
  boot.style.setProperty('--p', progress);
}
const nextPaint = () => new Promise((r) => { requestAnimationFrame(() => setTimeout(r, 0)); setTimeout(r, 150); });
const showGate = (kind) => document.documentElement.classList.add(`gate-${kind}`);
let contextLost = false;
let sound = null, touch = null;
const T0 = performance.now();
const marks = {};
const mark = (k) => { marks[k] = Math.round(performance.now() - T0); };

const params = new URLSearchParams(location.search);
const diag = createDiag({ on: params.has('diag') });

/* The tier (config.js MOBILE.tiers), from what Tan's phones showed
 * (2026-09-30): Safari on an iPhone 15 plays the full tier; Chrome for iOS
 * (WebKit inside another app, a tighter memory budget) lost the context or
 * never loaded.  So the light tier for: any browser on iOS that is not
 * Safari itself (Chrome, Firefox, Edge, and the in-app browsers social links
 * open in: Instagram, Facebook, LinkedIn, LINE, X...), iPhones older or
 * smaller than the 14 Pro/15 (the 4 GB ones), Android in-app browsers and
 * phones that report 4 GB or less, and any device that lost the context
 * here before (remembered).  ?tier=light / ?tier=full picks by hand. */
const ua = navigator.userAgent;
const ios = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inApp = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|Instagram|FBAN|FBAV|FB_IAB|FBIOS|LinkedInApp|\bLine\/|Twitter|MicroMessenger|Snapchat|Pinterest|musical_ly|TikTok|; wv\)/i.test(ua)
  || (ios && !/Safari\//.test(ua));                  // an iOS web view without Safari's own token
const bigIphone = Math.max(screen.width, screen.height) >= 852;    // 14 Pro, 15, 16 and up (and every iPad)
/* Saved settings took the working title's names ('lawson-fuji-*'): each is
 * read once, moved to its takemebacktojapan-* key, and the old one dropped,
 * so nobody's volume or light tier resets. */
try {
  for (const k of ['lost', 'volume']) {
    const old = localStorage.getItem(`lawson-fuji-${k}`);
    if (old === null) continue;
    if (localStorage.getItem(`takemebacktojapan-${k}`) === null) localStorage.setItem(`takemebacktojapan-${k}`, old);
    localStorage.removeItem(`lawson-fuji-${k}`);
  }
} catch { /* optional */ }
let lostBefore = false;
try { lostBefore = localStorage.getItem('takemebacktojapan-lost') === '1'; } catch { /* optional */ }
const tier = params.get('tier') ?? (lostBefore || inApp || (ios ? !bigIphone : (navigator.deviceMemory ?? 8) <= 4) ? 'light' : 'full');
if (MOBILE.tiers[tier]) Object.assign(MOBILE, MOBILE.tiers[tier]);
// dev: ?set=key:json,key:json overrides MOBILE tunables (measuring)
if ((import.meta.env?.DEV || params.has('stats')) && params.get('set')) for (const kv of params.get('set').split(';')) { const i = kv.indexOf(':'); MOBILE[kv.slice(0, i)] = JSON.parse(kv.slice(i + 1)); }
diag.stage(`tier ${tier}`);

/* Our own context, so every GPU allocation is counted (diag.js). */
let renderer, meter = null;
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
renderer.shadowMap.enabled = !!MOBILE.shadow;           // the light tier draws no shadow map at all
renderer.shadowMap.type = THREE.PCFShadowMap;        // LITE: plain PCF (desktop: soft)
renderer.shadowMap.autoUpdate = false;
renderer.setClearColor(new THREE.Color(PAL.fog), 1);
diag.source({ renderer, meter, canvas, extra: () => `tier ${tier}  scale ${renderScale?.toFixed?.(2)}  rt ${leanTargets ? '32' : '64'}  ${world ? `streamed out ${culler?.out ?? 0}` : ''}` });
/* A lost context (how a phone takes GPU memory back): stop drawing, hush,
 * and show the card.  If the phone gives the context back, and the tier
 * kept its CPU copies (MOBILE.keepCpu), three uploads everything again and
 * the walk goes on; else the card's Reload. */
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  contextLost = true;
  diag.stage(`CONTEXT LOST (at ${diag.stageName})`);
  // this device lost it once: from the next load on, the light tier
  try { localStorage.setItem('takemebacktojapan-lost', '1'); } catch { /* optional */ }
  sound?.setAwake(false);
  showGate('lost');
});
canvas.addEventListener('webglcontextrestored', () => {
  meter?.reset();
  diag.stage('context restored');
  if (!MOBILE.keepCpu || !world) return;                  // the pictures were let go: only a reload brings them back
  contextLost = false;
  document.documentElement.classList.remove('gate-lost');
  shadowAt = null;
  viewW = 0; resize();
  if (!document.hidden) sound?.setAwake(true);
  frame();
});

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PAL.fog, 44, 205);
const camera = new THREE.PerspectiveCamera(PLAYER_VFOV, 1, 0.25, 3200);
camera.rotation.order = 'YXZ';

/* --------------------------------- light --------------------------------- */
const sun = new THREE.DirectionalLight(PAL.sun, 2.25);
sun.position.set(-52, 62, 56);
sun.castShadow = true;
const SH = MOBILE.shadow ?? { size: 512, half: 34, every: 1e9 };
sun.castShadow = !!MOBILE.shadow;
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
bootStage(M.building, '40%');
await nextPaint();
mark('building');
diag.stage('building');
// Hachi and the konbini speak of taps, not keys
STRINGS.hachi.line = M.hachiLine;
STRINGS.store.menuHint = M.menuHint;
STRINGS.map.close = M.closeMap;
liteConfig();
const sky = buildSky(scene, 2900, { avoidYaw: FUJI.bearing });
let culler = null, renderScale = 1, viewW = 0, viewH = 0;
const world = buildTown(scene, {
  cell: MOBILE.cell, bulkCell: MOBILE.bulkCell, detailCell: MOBILE.detailCell, stage: (n) => diag.stage(n),
  shrink: (root, store) => shrinkCanvases(root, { store, real: renderer.capabilities.maxTextureSize }),
});
mark('built');
diag.stage('built');
/* the konbini's label and price-tag pages (world/store/pages.js): a mipmap level or so smaller than the desktop
 * holds them, away and at the store (config.js MOBILE.storePages; set before the first frame, as its levels are) */
for (const p of storePages) if (p.far > 0) p.levels(p.far + MOBILE.storePages.far, Math.max(p.near, MOBILE.storePages.near));
bootStage(M.ready, '75%');
await nextPaint();
const minimap = createMinimap(world);
minimap.setVisible(false);            // no corner map on a phone: the map button opens the whole town
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

const player = new TouchPlayer(camera, canvas, world);
const shop = world.lawson?.shop ?? null;
if (shop) {
  scene.add(shop.view, shop.fx);
  shop.player = player;
  world.interactables.push(...(world.lawson.interactables ?? []));
  PETTAN.attach({ hands: shop.hands });      // ぺったん堂 borrows your hand for its mochi (world/mochi/)
}

const VOLUME_STORAGE_KEY = 'takemebacktojapan-volume';
let volumeStep = DEFAULT_VOLUME;
try {
  const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
  if (saved !== null && VOLUME_STEPS.includes(Number(saved))) volumeStep = Number(saved);
} catch { /* optional */ }
const hud = createMobileHud({ volume: volumeStep });
// "Next train · 0:25" on the station's platform (QA-010; desktop's ui/trainWait.js): bottom middle, over the sound pill
const trainWait = trainWaitLabel(hud.root, { bottom: 'max(66px, calc(var(--safe-b) + 56px))' });
if (shop) {
  shop.flash = (text, error = false) => hud.flash(text, error ? 2800 : 2200, error);
  shop.onTipsy = () => { tipsy = 0; hud.flash(STRINGS.store.tipsy, 3200); };
  // what you bought, in your hand, being eaten, gone: Hachi begs, then does its bit for it along with you (animals/guide.js)
  shop.onSnack = (phase, id) => GUIDE.snack(phase, id);
}

/* The sound: the desktop's engine, every file and every place's sound, the same mix. */
watchMediaElements();
sound = createSound({ volume: volumeGain(volumeStep) });
// POCKET (builder 5): the sound labels wrap the engine before the world's queued zones attach; the start card's sound check
const controls = attachPocketControls({ sound, hud, isPlaying: () => player.locked });
soundBus.attach(sound);
const rememberVolume = () => { try { localStorage.setItem(VOLUME_STORAGE_KEY, String(volumeStep)); } catch { /* optional */ } };
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

hud.onVolumeChange = (step) => {
  volumeStep = step;
  sound.setVolume(volumeGain(step));
  rememberVolume();
};

player.onInteract = (target) => { if (target) target.action?.({ player, hud }); };

/* ------------------------------- pipeline ------------------------------- *
 * The desktop's ink and grade passes (the look), no FXAA pass, at a phone's
 * pixel budget; the scale steps down when frames run long (adapt, below). */
const pipeline = new Pipeline(renderer, scene, camera, { pixelBudget: MOBILE.render.pixels });
pipeline.enabled.fxaa = false;
/* The frame's own targets in 32 bits a pixel instead of 64 (core/post.js makes them half-float RGBA: at a
 * phone's 3 Mpx that is 24 MB each, the scene's and the ink pass's).  R11F_G11F_B10F holds the same linear
 * light (no alpha: nothing in the passes reads it) in half the memory.  Only where the GPU can draw into it
 * (EXT_color_buffer_float), checked by drawing: else the half-float targets stay.  ?rt=half keeps them. */
let leanTargets = false;
if (params.get('rt') !== 'half' && renderer.getContext().getExtension('EXT_color_buffer_float')) {
  const gl = renderer.getContext();
  const opts = { type: THREE.UnsignedInt101111Type, format: THREE.RGBFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, stencilBuffer: false, colorSpace: THREE.NoColorSpace };
  const rtScene = new THREE.WebGLRenderTarget(2, 2, { ...opts, depthBuffer: true });
  rtScene.depthTexture = new THREE.DepthTexture(2, 2);
  rtScene.depthTexture.format = THREE.DepthFormat;
  rtScene.depthTexture.type = THREE.UnsignedIntType;
  rtScene.depthTexture.minFilter = rtScene.depthTexture.magFilter = THREE.NearestFilter;
  const rtA = new THREE.WebGLRenderTarget(2, 2, { ...opts, depthBuffer: false });
  let ok = true;
  for (const rt of [rtScene, rtA]) {
    renderer.setRenderTarget(rt);
    ok &&= gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  }
  renderer.setRenderTarget(null);
  if (ok) {
    pipeline.rtScene.depthTexture.dispose(); pipeline.rtScene.dispose(); pipeline.rtA.dispose();
    pipeline.rtScene = rtScene; pipeline.rtA = rtA;
    pipeline.ink.mat.uniforms.tDepth.value = rtScene.depthTexture;
    leanTargets = true;
  } else { rtScene.depthTexture.dispose(); rtScene.dispose(); rtA.dispose(); }
}
/* The phone's own pixels (its DPR, up to render.maxDpr): the frame is drawn 1:1 onto the screen, and steps
 * down only while frames run under render.fpsLow (adapt, below). */
const dpr = Math.min(window.devicePixelRatio || 1, MOBILE.render.maxDpr);
renderScale = Math.max(1, dpr);
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
  // LITE: the fog closes in before the draw distance (MOBILE.far), so its edge is never seen
  scene.fog.near = Math.min(look.fog.near, MOBILE.fog.near);
  scene.fog.far = Math.min(look.fog.far, MOBILE.fog.far);
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
const heroAt = { x: 0, z: 0 };

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
  world.fuji.magnify(FUJI_GAMEPLAY);          // the same angular size as in landscape: the wider portrait lens shows more round it
}

function enterHero(name) {
  const v = HERO_VIEWS[name];
  lastView = name;
  applyLook(v.look);
  hud.setTime(name);
  const spot = v.play;
  player.pos.set(spot.pos[0], world.heightAt(spot.pos[0], spot.pos[2]), spot.pos[2]);
  player.vel.set(0, 0, 0);
  player.yaw = spot.yaw;
  player.pitch = spot.pitch;
  player.bob = 0;
  player.holdLook = false;
  Object.assign(heroAt, { x: player.pos.x, z: player.pos.z });
  famousView = { x: player.pos.x, z: player.pos.z };
  player.applyCamera(0);
  updateProjection();
}

/* The time of day: a short dip to dark hides the switch (desktop's setTime). */
const fadeEl = document.createElement('div');
fadeEl.style.cssText = 'position:fixed;inset:0;background:#0c0a14;opacity:0;pointer-events:none;z-index:4';
document.body.appendChild(fadeEl);
let fade = null;
const TIMES = ['golden', 'night', 'morning'];
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
    hud.setTime(fade.name);
    hud.flash(M.times[fade.name] ?? fade.name, 1100);
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

/* Hachi's hello: the view eases down to the pup and back (desktop's watchPup). */
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
  /* POCKET: the canvas itself at the inside size (up to 2x), so the last
   * pass draws 1:1 onto the phone's pixels.  (core/post.js sizes the canvas
   * at CSS pixels, right for a desktop, where the supersampled frame is
   * shrunk onto it: on a 3x phone that frame was blown up threefold, which
   * is what read as pixelated on Tan's iPhone.) */
  renderer.setPixelRatio(pipeline.scale);
  renderer.setSize(w, h, true);
  setOutlineResolution(pipeline.size.x, pipeline.size.y);
  touch?.resize();
  // portrait: a gentle word about turning the phone, now and then
  if (h > w * 1.1 && player.locked) hud.flash(M.rotate, 3600);
}
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
// iOS reports the new size a little after it turns
window.addEventListener('orientationchange', () => { setTimeout(resize, 120); setTimeout(resize, 600); });

/* --------------------------------- shadows --------------------------------- *
 * The desktop's snapped shadow camera, smaller: redrawn when it lands on a
 * new square, or now and then (MOBILE.shadow.every) for what moves. */
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
  if (MOBILE.shadow && (moved || shadowAge > SH.every)) {
    shadowAt = { x: shadowTarget.x, z: shadowTarget.z };
    shadowAge = 0;
    renderer.shadowMap.needsUpdate = true;
  }
}

/* --------------------------------- actions --------------------------------- */
function whistle() {
  if (player.locked && !shop?.visiting && !minimap.fullOpen && !player.suspended && !player.seat) GUIDE.whistle();
}
function toggleMap(open = !minimap.fullOpen) {
  if (!player.locked || shop?.busy || player.seat) return;
  if (open && player.suspended) return;
  minimap.setFull(open, player.pos, player.yaw);
  if (open) mapAt = performance.now();
  player.suspended = open;
  hud.setMapOpen(open);
  touch.setPlaying(!open);
}
function nextTime() {
  if (player.seat && fade) return;
  setTime(TIMES[(TIMES.indexOf(lastView) + 1) % TIMES.length]);
}
function restart() {
  if (shop?.visiting || gliding) return;
  if (minimap.fullOpen) toggleMap(false);
  if (player.seat) { player.seat = null; }
  player.suspended = false;
  enterHero(lastView);
  resume();
}
function pickMenu(id) {
  if (shop?.atSpot && shop.menu.includes(id)) { if (shop.play(id)) hud.menu(null); }
}
function interact() {
  if (player.hovered) player.onInteract(player.hovered);
}
function pauseGame() {
  if (!player.locked) return;
  if (minimap.fullOpen) toggleMap(false);
  player.unlock();
}
function resume() {
  unlockAudio(sound);
  player.lock();
}
hud.onButton = (b) => {
  unlockAudio(sound);                       // every tap is a gesture the sound may need
  if (Array.isArray(b)) { if (b[0] === 'pick') pickMenu(b[1]); return; }
  if (b === 'pause') pauseGame();
  else if (b === 'resume') resume();
  else if (b === 'restart') restart();
  else if (b === 'map') toggleMap();
  else if (b === 'time') nextTime();
  else if (b === 'whistle') whistle();
  else if (b === 'act') { if (spotNow) useSpot(spotNow); else interact(); }
  else if (b === 'sound') hud.askForSound(false);
};
// the full map closes with a tap anywhere on it
let mapAt = 0;
for (const ev of ['pointerup', 'click']) document.querySelector('.fullmap')?.addEventListener(ev, () => {
  if (!minimap.fullOpen || performance.now() - mapAt < 450) return;     // (not the tap that opened it)
  unlockAudio(sound); toggleMap(false);
});

// a keyboard (or a computer, testing): the desktop's keys
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space') { e.preventDefault(); if (player.locked) pauseGame(); else resume(); return; }
  if (!player.locked) return;
  unlockAudio(sound);
  if (shop?.atSpot && /^Digit[1-9]$/.test(e.code)) { const id = shop.menu[Number(e.code.slice(5)) - 1]; if (id) pickMenu(id); return; }
  if (e.code === 'KeyF') whistle();
  if (e.code === 'KeyM') toggleMap();
  if (e.code === 'KeyR') restart();
  if (e.code === 'KeyN') { const off = sound.toggle(); hud.flash(off ? STRINGS.soundOff : STRINGS.soundOn); }
  for (const [name, v] of Object.entries(HERO_VIEWS)) if (e.code === v.key) setTime(name);
});

/* Playing or paused: the card, the controls, the song (the engine's menu). */
/* POCKET (builder 5): the places' spots (docs/pocket-diorama.md); a tap on the thing itself uses it too */
/* MINI: every thing to do in the town (world.interactables: the experiences' rings, the konbini's door, the bench)
 * as a spot { id, x, z, r, y, label, enabled, use }: where it stands in the world, its words, and what using it does */
const spots = world.interactables.filter((it) => it.hitbox && it.action).map((it) => {
  const p = it.hitbox.getWorldPosition(new THREE.Vector3()), g = it.hitbox.geometry?.parameters;
  return {
    id: it.id ?? it.label, x: p.x, z: p.z, y: 1, r: Math.max(1.2, (g?.width ?? 2.4) / 2),
    get label() { return String(it.label ?? '').replace(/^.*?·\s*/, ''); },
    get enabled() { return it.hitbox.visible !== false && !!it.hitbox.parent; },
    use: (ctx) => it.action(ctx),
  };
});
world.spots = spots;
let spotNow = null;
function useSpot(s) { unlockAudio(sound); s.use?.({ player, hud, sound, soundBus, camera }); }
touch = createTouch(player, {
  surface: canvas, isPlaying: () => player.locked && !minimap.fullOpen,
  onTap: (x, y) => { const s = controls.tap(x, y, spots, camera); if (s) useSpot(s); },
});
player.onLockChange = (locked) => {
  hud.setPlaying(locked);
  touch.setPlaying(locked);
  if (!locked && minimap.fullOpen) { minimap.setFull(false); player.suspended = false; hud.setMapOpen(false); }
};

/* Aim: what the crosshair is on (3 m, as desktop), else the nearest thing to
 * do in front of you within reach: a thumb is a looser aim than a mouse. */
const _aim = new THREE.Vector3(), _fwd = new THREE.Vector3();
function aimAssist(list) {
  const A = MOBILE.aimAssist;
  let best = null, bestD = Infinity;
  camera.getWorldDirection(_fwd);
  for (const it of list) {
    if (!it.hitbox?.parent) continue;
    it.hitbox.getWorldPosition(_aim);
    const dx = _aim.x - camera.position.x, dz = _aim.z - camera.position.z, d = Math.hypot(dx, dz);
    if (d > A.reach || d >= bestD) continue;
    const ang = Math.acos(THREE.MathUtils.clamp((dx * _fwd.x + dz * _fwd.z) / (d * Math.hypot(_fwd.x, _fwd.z) || 1), -1, 1));
    // standing in its ring counts whichever way you face; else it must be ahead
    const inRing = d < (it.hitbox.geometry?.parameters?.width ?? 0) / 2;
    if (!inRing && ang > A.cone) continue;
    best = it; bestD = d;
  }
  return best;
}

/* The sound after a call, the lock screen or another app: resumed on
 * return, or, if the phone wants a tap for it, asked for. */
let soundCheck = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseGame();                               // back to a paused game, not one that ran on unseen
    sound.setAwake(false);
  } else if (!contextLost) {
    sound.setAwake(true);
    clearTimeout(soundCheck);
    soundCheck = setTimeout(() => { const s = audioState(sound); if (s !== 'running' && s !== 'none') hud.askForSound(true); }, 700);
  }
});
window.addEventListener('pagehide', () => sound.setAwake(false));
// any tap wakes the sound (and puts the "tap to bring the sound back" away)
const wake = () => { if (audioState(sound) === 'none') return; unlockAudio(sound); if (audioState(sound) === 'running') hud.askForSound(false); };
document.addEventListener('touchend', wake, { passive: true });
document.addEventListener('click', wake);

/* --------------------------------- loop --------------------------------- */
const clock = new THREE.Clock();
let lastDraw = 0, menuShown = null;
// adaptive resolution: the frame rate over the last couple of seconds sets the scale
const perf = { n: 0, t: 0, fps: 60 };
function adapt(rawDt) {
  perf.n++; perf.t += rawDt;
  if (perf.t < 2) return;
  perf.fps = perf.n / perf.t;
  perf.n = 0; perf.t = 0;
  const R = MOBILE.render, full = Math.max(1, dpr), least = Math.min(full, R.minScale);
  let s = renderScale;
  if (perf.fps < R.fpsLow && s > least) s = Math.max(least, s - R.step);
  else if (perf.fps > R.fpsHigh && s < full) s = Math.min(full, s + R.step);
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
  const menu = !player.locked;
  if (menu !== menuShown) { menuShown = menu; sound.setMenu(menu); document.body.classList.toggle('game-paused', menu); }
  if (menu && now - lastDraw < 100) return;
  lastDraw = now;
  const raw = clock.getDelta();
  const tick = Math.min(raw, MOBILE.dt);
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

  let hovered = null;
  if (shop) shop.update(dt, camera, player.bob);
  const choosing = !!(shop?.atSpot && player.locked && !minimap.fullOpen);
  hud.menu(choosing ? shop.menu : null);
  if (player.locked && !shop?.busy && !player.seat && !gliding && !minimap.fullOpen && !watch.on) {
    // (in the store there is nothing to aim at: the choice is made at the door)
    hovered = shop?.inside(camera) ? null : (player.pick(world.interactables) ?? aimAssist(world.interactables));
  }
  player.hovered = hovered;
  spotNow = controls.action(spots, player);
  hud.setAction(spotNow?.label ?? (hovered ? hovered.label.replace(/^.*?·\s*/, '') : null));
  trainWait.update(world.line?.station?.wait, player.locked && !minimap.fullOpen && !choosing);
  hud.setCrosshair(!choosing && !famousView);
  const inStore = !!shop?.inside(camera);
  culler.update(camera.position, 3, inStore ? MOBILE.store.behind : null);   // in the store, what is behind its walls goes
  // the konbini's quad page (lite.js packStoreQuads): whole within reach of its glass, a small copy from the street
  lite.storeQuads?.level(inStore || !!shop?.visiting || Math.hypot(camera.position.x - LAWSON.x, camera.position.z - LAWSON.frontZ + LAWSON.depth / 2) < (lite.storeQuads.near ? MOBILE.store.quadsFar : MOBILE.store.quadsNear));
  sound.update(dt, { camera, inside: inStore, look: lookName, cooler: shop?.coolerAt });
  walkAt.forEach(({ w }, i) => { walkList[i].on = w.walk(); });
  sound.walkSignals(walkList);
  const stride = Math.floor(player.bob / (2 * Math.PI));
  if (stride !== lastStride) { lastStride = stride; if (player.locked) sound.step(inStore); }

  pipeline.render();
  diag.update();
}

/* ------------------------------ first frame ------------------------------ */
diag.stage('lite');
const lite = liteScene(scene, renderer, world);
// the water's mirrors (land/mirror.js) show what stands by them, as on the desktop
if (world.reflectRect) {
  tagReflections(scene, world.root, world.reflectRect);
  world.fuji?.ready?.then(() => tagReflections(scene, world.root, world.reflectRect));
}
culler = makeCuller(scene, world);
world.fuji.ready?.then((m) => { lite.fuji = liteFuji(m); });
enterHero(SPAWN.view);
resize();
world.update(0, camera);
culler.update(camera.position, 1, null, true);   // (and streamed at once: what is far never uploads at load, the far pages start small)
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
bootStage(M.ready, '100%');
await nextPaint();

// ready: the loading card becomes the start card; one tap starts the town and its sound
let started = false;
function start(e) {
  if (started) return;           // (a lift and its click: once)
  started = true;
  e?.preventDefault?.();
  unlockAudio(sound);                         // inside the tap: the context, the audio session, the streams
  boot.classList.add('hidden');
  setTimeout(() => boot.remove(), 600);
  player.lock();
  if (viewH > viewW * 1.1) hud.flash(M.rotate, 4200);
  clock.getDelta();
  mark('started');
  diag.stage('playing');
}
boot.classList.add('ready');
// the finger's lift starts it (a tap's click can be late or dropped on iOS), a click for a mouse
boot.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') start(e); });
boot.addEventListener('click', start);
mark('ready');
frame();

if (import.meta.env?.DEV || new URLSearchParams(location.search).has('stats')) {
  window.__m = {
    scene, camera, renderer, pipeline, world, player, sound, hud, THREE, marks, lite, perf, culler, applyLook, enterHero,
    census: () => census(scene, renderer), hanShow, diag, meter, tier,
    get scale() { return renderScale; }, touch, controls, spots, minimap,
    /** dev (scripts/_mini.mjs): stand at a spot and draw it: { x, z, yaw, pitch, look, lift, steps } */
    goto(o = {}) {
      if (o.look && o.look !== lookName) applyLook(o.look);
      if (o.train) (world.line.local ?? world.line).service.stage(o.train);
      // a train anywhere on the line: [set (0 eastbound, 1 westbound), x in the town's frame]
      if (o.trainX) { const S = (world.line.local ?? world.line).service; S.stage(o.trainX[0] ? 'crossing' : 'approach'); S.runs[o.trainX[0]].x = o.trainX[1]; S.update(1e-4); }
      if (o.x !== undefined) player.pos.set(o.x, world.heightAt(o.x, o.z), o.z);
      if (o.yaw !== undefined) player.yaw = o.yaw;
      if (o.pitch !== undefined) player.pitch = o.pitch;
      player.vel.set(0, 0, 0); player.bob = 0;
      famousView = null;
      player.applyCamera(0);
      if (o.lift) camera.position.y += o.lift;
      for (let i = 0; i < (o.steps ?? 1); i++) world.update(o.dt ?? 0, camera);
      culler.update(camera.position, 1, null, true);
      shadowAt = null; seatLights();
      sky.dome.position.copy(camera.position); sky.clouds.position.copy(camera.position);
      // drawn twice: with the shadow map, then the frame alone (what most frames are: the map is redrawn on a new square)
      renderer.info.autoReset = false; renderer.info.reset();
      pipeline.render();
      const withShadow = renderer.info.render.calls;
      renderer.info.reset();
      pipeline.render();
      const MBs = (n) => Math.round(n / 1048576);
      const r = { calls: renderer.info.render.calls, withShadow, tris: renderer.info.render.triangles, gpu: meter ? MBs(meter.total) : 0, tex: meter ? MBs(meter.textures) : 0, buf: meter ? MBs(meter.buffers) : 0, rb: meter ? MBs(meter.renderbuffers) : 0, peak: meter ? MBs(meter.peak) : 0 };
      renderer.info.autoReset = true;
      return r;
    },
    /** dev (scripts/_mini.mjs --only=walk): everywhere the player can reach, on a grid `step` m apart, eight ways
     * round at each, as montages (data URLs) of `tile` px wide frames: a row a spot. */
    async walkSheet({ look = 'golden', step = 14, tile = 284, rows = 14 } = {}) {
      const B = world.bounds, cols = world.colliders, R = 0.35;
      const nx = Math.ceil(B.x1 - B.x0), nz = Math.ceil(B.z1 - B.z0);
      const free = (x, z, y) => {
        if (x < B.x0 + 0.3 || x > B.x1 - 0.3 || z < B.z0 + 0.3 || z > B.z1 - 0.3) return false;
        for (const c of cols) if (x > c.x0 - R && x < c.x1 + R && z > c.z0 - R && z < c.z1 + R && c.top > y + 0.5 && (c.bottom === undefined || c.bottom < y + 1.7)) return false;
        return true;
      };
      const seen = new Uint8Array(nx * nz), hs = new Float32Array(nx * nz);
      const id = (i, j) => j * nx + i;
      const i0 = Math.round(0 - B.x0), j0 = Math.round(16.5 - B.z0);
      const q = [[i0, j0]]; seen[id(i0, j0)] = 1; hs[id(i0, j0)] = world.heightAt(0, 16.5);
      let reach = 0;
      while (q.length) {
        const [i, j] = q.pop(); reach++;
        const y = hs[id(i, j)];
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const a = i + di, b = j + dj;
          if (a < 0 || b < 0 || a >= nx || b >= nz || seen[id(a, b)]) continue;
          const x = B.x0 + a, z = B.z0 + b, h = world.heightAt(x, z, y);
          if (Math.abs(h - y) > 0.55 || !free(x, z, h)) continue;
          seen[id(a, b)] = 1; hs[id(a, b)] = h; q.push([a, b]);
        }
      }
      const pts = [];
      for (let z = Math.ceil(B.z0 / step) * step; z < B.z1; z += step) for (let x = Math.ceil(B.x0 / step) * step; x < B.x1; x += step) {
        let best = null, bd = 4.5;
        for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) {
          const a = Math.round(x - B.x0) + di, b = Math.round(z - B.z0) + dj;
          if (a < 0 || b < 0 || a >= nx || b >= nz || !seen[id(a, b)]) continue;
          const d = Math.hypot(di, dj);
          if (d < bd) { bd = d; best = [B.x0 + a, B.z0 + b]; }
        }
        if (best) pts.push(best);
      }
      const was = renderScale;
      renderScale = tile / viewW; pipeline.forceScale = renderScale; viewW = 0; resize();
      const tw = canvas.width, th = canvas.height, label = 16;
      const sheets = [];
      let cv = null, c = null, row = 0, worst = 0;
      const flush = () => { if (cv) sheets.push(cv.toDataURL('image/jpeg', 0.8)); cv = null; };
      for (const [x, z] of pts) {
        if (!cv) { cv = document.createElement('canvas'); cv.width = tw * 8; cv.height = (th + label) * rows; c = cv.getContext('2d'); c.fillStyle = '#15131c'; c.fillRect(0, 0, cv.width, cv.height); row = 0; }
        const y = row * (th + label);
        for (let k = 0; k < 8; k++) {
          const r = this.goto({ x, z, yaw: k * Math.PI / 4, pitch: 0.02, look });
          worst = Math.max(worst, r.calls);
          c.drawImage(canvas, k * tw, y + label, tw, th);
        }
        c.fillStyle = '#fff'; c.font = 'bold 12px sans-serif';
        c.fillText(`(${x.toFixed(0)}, ${z.toFixed(0)})  yaw 0, 45 ... 315 (0 looks north to Fuji; turning left)`, 4, y + 12);
        if (++row >= rows) flush();
        await new Promise((r) => setTimeout(r, 0));
      }
      flush();
      renderScale = was; pipeline.forceScale = was; viewW = 0; resize();
      return { sheets, points: pts.length, reach, worst };
    },
  };
}
