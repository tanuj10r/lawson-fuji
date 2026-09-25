import * as THREE from 'three';
import { PAL } from './core/palette.js';
import { Pipeline } from './core/post.js';
import { buildSky } from './core/sky.js';
import { setOutlineResolution } from './core/outline.js';
import { Player } from './core/player.js';
import { createHud } from './core/hud.js';
import { createMusic } from './core/audio.js';
import { createSfx } from './core/sfx.js';
import { buildTown } from './world/town.js';
import { buildKitTest } from './world/kit-test.js';
import { atSpot, bareStretches } from './world/kit/density.js';
import { STRINGS } from './data/strings.js';
import { PLAYER, PLAYER_VFOV, HERO_VIEWS, LOOKS, SPAWN, FUJI } from './config.js';

/* ------------------------------------------------------------------ *
 * Lawson Fuji -- entry point.  Rendering is inherited from Sakura Crossing (MIT).
 *
 * Lighting is the classic two-light anime setup: one warm quantised key
 * for the sun, one cool bounce fill from the opposite side, and a
 * hemisphere with a violet ground colour so nothing in shadow ever goes
 * black.  The shadow camera follows the player on a snapped grid to keep
 * cast shadows crisp without shimmering.
 * ------------------------------------------------------------------ */

const canvas = document.getElementById('view');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(new THREE.Color(PAL.fog), 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PAL.fog, 44, 205);

// far enough for Mt. Fuji (drawn ~1.4 km out) and the sky dome behind it
const camera = new THREE.PerspectiveCamera(PLAYER_VFOV, 1, 0.25, 3200);
camera.rotation.order = 'YXZ';

/* --------------------------------- light --------------------------------- */
const sun = new THREE.DirectionalLight(PAL.sun, 2.25);
sun.position.set(-52, 62, 56);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 200;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.035;
scene.add(sun);
scene.add(sun.target);

// Cool bounce from the opposite quarter.  This carries most of the shadow
// side of every surface, so it is deliberately strong: an anime background
// has *coloured* shadows, not dark ones.
const fill = new THREE.DirectionalLight(PAL.fill, 1.08);
fill.position.set(48, 26, -44);
scene.add(fill);
scene.add(fill.target);

// a second, weaker bounce from below-front stops undersides going flat black
const bounce = new THREE.DirectionalLight(0xd8cbe8, 0.34);
bounce.position.set(10, -18, 40);
scene.add(bounce);
scene.add(bounce.target);

const hemi = new THREE.HemisphereLight(PAL.hemiSky, PAL.hemiGround, 1.12);
scene.add(hemi);

/* --------------------------------- world --------------------------------- */
const sky = buildSky(scene, 2900, { avoidYaw: FUJI.bearing });
/* Dev only: ?kit swaps the town for the M2a kit test street, and ?shots
 * (scripts/shots.mjs) freezes time so every frame it takes repeats exactly. */
const devParams = new URLSearchParams(location.search);
const KIT = import.meta.env.DEV && devParams.has('kit');
const FROZEN = import.meta.env.DEV && devParams.has('shots');
const world = KIT ? buildKitTest(scene) : buildTown(scene);

/* Shadow stand-ins (userData.shadowOnly): cheap shapes that cast a shadow
 * for something drawn in full detail on screen, the town's blossom.  They
 * are hidden, and shown only while the shadow map is drawn. */
const shadowOnly = [];
scene.traverse((o) => { if (o.userData.shadowOnly) { o.visible = false; shadowOnly.push(o); } });
if (shadowOnly.length) {
  const drawShadows = renderer.shadowMap.render;
  renderer.shadowMap.render = function (...args) {
    for (const o of shadowOnly) o.visible = true;
    drawShadows.apply(this, args);
    for (const o of shadowOnly) o.visible = false;
  };
}

const player = new Player(camera, canvas, world);
const VOLUME_STORAGE_KEY = 'lawson-fuji-volume';
let initialVolume = 0.34;
try {
  const savedValue = localStorage.getItem(VOLUME_STORAGE_KEY);
  if (savedValue !== null) {
    const savedVolume = Number(savedValue);
    if (Number.isFinite(savedVolume)) initialVolume = Math.max(0, Math.min(1, savedVolume));
  }
} catch { /* storage is optional; the game works without it */ }

const hud = createHud({ volume: initialVolume });
const music = createMusic({ volume: initialVolume, fadeIn: 3.0 });
hud.setMuted(music.muted);
const rememberVolume = () => {
  try { localStorage.setItem(VOLUME_STORAGE_KEY, String(music.volume)); } catch { /* optional */ }
};

/* Positional effects (M2c: the crossing bells and the train's door chime),
 * started by the same first click as the music. */
const sfx = createSfx({ volume: initialVolume });
world.line?.onEvent((name, run) => {
  if (name === 'chime') sfx.chime(Math.hypot(camera.position.x - run.x, camera.position.z - run.z));
});

hud.onVolumeChange = (value) => {
  sfx.setVolume(value);
  hud.setMuted(music.setVolume(value));
  rememberVolume();
};

// Autoplay needs a user gesture, so the music starts on the same click that
// takes the pointer lock rather than on load.
hud.onStart = () => {
  music.start();
  sfx.start();
  player.lock();
};
player.onLockChange = (locked) => hud.setLocked(locked);
canvas.addEventListener('click', () => {
  music.start();
  sfx.start();
  if (!player.locked) player.lock();
});

player.onInteract = (target) => {
  if (target) target.action?.();
};

/* ------------------------------- pipeline ------------------------------- */
const pipeline = new Pipeline(renderer, scene, camera);

/* --------------------------------- looks --------------------------------- *
 * One look per time of day (config.js LOOKS): sky, fog, lights, grade, Fuji
 * and the store's glow.  M6 blends between them; M1 switches. */
/** Light directions, fixed in world space: the world is flat. */
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
}

/* ------------------------------ hero views ------------------------------ *
 * Keys 1, 2, 3 (and the spawn) stand the player on a famous view
 * (config.js HERO_VIEWS[].play) in the ordinary gameplay lens, and set its
 * look.  Fuji is magnified in that lens to keep hero camera 1's on-screen
 * size (FUJI.gameplaySize), so the view reads as the photo and walking off
 * it changes nothing but where you stand: no lens change, no zoom.
 *
 * Dev only: with the R overlay on, the view uses the exact photo camera
 * instead (narrow, shifted lens, true-size Fuji) so the composition can be
 * checked against the photo.  Moving off it eases back to the gameplay lens. */
const HERO_DAY = HERO_VIEWS.morning;
const FUJI_GAMEPLAY = FUJI.gameplaySize
  * Math.tan(THREE.MathUtils.degToRad(PLAYER_VFOV / 2))
  / Math.tan(THREE.MathUtils.degToRad(HERO_DAY.vfov / 2));
let hero = null;          // the photo camera, while it holds (dev overlay)
let lastView = SPAWN.view;
let heroBlend = 0;        // 1 = photo lens, 0 = gameplay lens
const heroAt = { x: 0, z: 0, yaw: 0, pitch: 0 };

function updateProjection() {
  const v = HERO_VIEWS[lastView];
  const t = heroBlend * heroBlend * (3 - 2 * heroBlend);
  camera.fov = PLAYER_VFOV + (v.vfov - PLAYER_VFOV) * t;
  camera.updateProjectionMatrix();
  world.fuji.magnify(1 + (FUJI_GAMEPLAY - 1) * (1 - t));
  if (t > 0) {
    // lens shift: slide the frame, keep the camera level (verticals stay straight)
    const e = camera.projectionMatrix.elements;
    e[8] = (v.shift[0] * t) / camera.aspect;
    e[9] = v.shift[1] * t;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
}

/** Stand on a famous view.  `photo` uses the exact photo camera (dev overlay). */
function enterHero(name, { photo = refOn } = {}) {
  const v = HERO_VIEWS[name];
  lastView = name;
  applyLook(v.look);
  const spot = photo ? { pos: v.pos, yaw: v.yaw, pitch: 0 } : v.play;
  hero = photo ? v : null;
  heroBlend = photo ? 1 : 0;
  player.pos.set(spot.pos[0], world.heightAt(spot.pos[0], spot.pos[2]), spot.pos[2]);
  player.vel.set(0, 0, 0);
  player.yaw = spot.yaw;
  player.pitch = spot.pitch;
  player.bob = 0;
  if (photo) player.hold();
  else player.holdLook = false;
  Object.assign(heroAt, { x: player.pos.x, z: player.pos.z, yaw: player.yaw, pitch: player.pitch });
  player.applyCamera(0);
  updateProjection();
  refOverlay?.show(refOn);
}

function leaveHero() {
  hero = null;
  player.holdLook = false;
}
player.onReleaseLook = leaveHero;

/* Dev only: R lays the matching reference photo over the frame at 50%,
 * fitted by height like the photo lens, and switches to that lens.  Photos load from reference/ through
 * the dev server and never reach the build. */
let refOn = false;
const refOverlay = import.meta.env.DEV ? (() => {
  const img = document.createElement('img');
  img.className = 'ref-overlay';
  img.alt = '';
  document.body.appendChild(img);
  return {
    img,
    show(on) {
      img.src = `./reference/${HERO_VIEWS[lastView].ref}`;
      img.classList.toggle('on', on);
    },
  };
})() : null;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  updateProjection();
  pipeline.setSize(w, h);
  setOutlineResolution(pipeline.size.x, pipeline.size.y);
}
window.addEventListener('resize', resize);
resize();

/* --------------------------------- loop --------------------------------- */
const clock = new THREE.Clock();
const shadowTarget = new THREE.Vector3();

/** Aim a light at `origin` from a fixed direction. */
function seatLight(light, dir, origin) {
  light.target.position.copy(origin);
  light.position.copy(origin).add(dir);
}

/* The shadow camera follows the player so cast shadows stay crisp near them.
 * It centres a little ahead, so a hero camera's storefront 30 m out is in it. */
function seatLights() {
  shadowTarget.set(
    player.pos.x - Math.sin(player.yaw) * 16, 0, player.pos.z - Math.cos(player.yaw) * 16);
  seatLight(sun, SUN_DIR, shadowTarget);
  seatLight(fill, FILL_DIR, shadowTarget);
  seatLight(bounce, BOUNCE_DIR, shadowTarget);
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyM') {
    const off = music.toggle();
    hud.setMuted(off);
    hud.setVolume(music.volume);
    rememberVolume();
    if (music.available) hud.flash(off ? STRINGS.soundOff : STRINGS.soundOn);
  }
  // two quiet toggles, handy for seeing what the ink and grade passes do
  if (e.code === 'KeyO') pipeline.enabled.ink = !pipeline.enabled.ink;
  if (e.code === 'KeyG') pipeline.enabled.grade = !pipeline.enabled.grade;
  for (const [name, v] of Object.entries(HERO_VIEWS)) {
    if (e.code === v.key) {
      enterHero(name);
      hud.flash(STRINGS.heroViews[name]);
    }
  }
  if (e.code === 'KeyR' && refOverlay) {
    refOn = !refOn;
    enterHero(lastView);   // on: the exact photo camera; off: back to the view in play
    hud.flash(refOn ? STRINGS.refOn : STRINGS.refOff, 900);
  }
});

function frame() {
  const dt = FROZEN ? 0 : Math.min(clock.getDelta(), 1 / 20);

  player.update(dt);
  // walking off the spot hands the lens back to the player
  if (hero && (Math.abs(player.pos.x - heroAt.x) > 0.01 || Math.abs(player.pos.z - heroAt.z) > 0.01)) {
    leaveHero();
  }
  if (!hero && heroBlend > 0) {
    heroBlend = Math.max(0, heroBlend - dt / 1.6);
    updateProjection();
  }
  world.update(dt, camera);
  seatLights();
  if (world.line) {
    const c = world.line.crossingPos;
    sfx.bells(world.line.service.cross.bells, Math.hypot(camera.position.x - c.x, camera.position.z - c.z));
  }

  // the sky dome is centred on the flat origin, so it has to trail the camera
  sky.dome.position.copy(camera.position);
  sky.clouds.position.copy(camera.position);

  const hovered = player.locked ? player.pick(world.interactables) : null;
  hud.setPrompt(hovered ? `E  ·  ${hovered.label.replace(/^.*?·\s*/, '')}` : '');
  // flat authoring coordinates, so what the readout says is what the code uses
  hud.setCoords(player.pos, player.yaw, player.pitch, dt);

  pipeline.render();
  requestAnimationFrame(frame);
}
enterHero(SPAWN.view);
frame();

// expose a little for tuning from the console
window.__scene = {
  scene, camera, renderer, pipeline, world, player, music, hud, sun, fill, bounce, hemi, THREE,
  applyLook, enterHero,
};
window.__setOutlineRes = setOutlineResolution;

if (import.meta.env?.DEV) {
  /**
   * Dev capture: render one frame at a fixed size and post it to the dev
   * server, so framing and colour can be reviewed outside the browser.
   */
  window.__shot = async (name = 'shot', W = 1600, H = 900, opts = {}) => {
    refOn = false;
    if (opts.hero) enterHero(opts.hero);
    if (opts.train) window.__train?.(opts.train);
    if (opts.look) applyLook(opts.look);
    if (opts.pos) player.pos.set(opts.pos[0], player.pos.y, opts.pos[2]);
    if (opts.y !== undefined) player.pos.y = opts.y;
    if (opts.yaw !== undefined) player.yaw = opts.yaw;
    if (opts.pitch !== undefined) player.pitch = opts.pitch;
    // always resync the camera: the rAF loop is throttled when the page is
    // not compositing, so the camera cannot be assumed to match the player
    player.pos.y = world.heightAt(player.pos.x, player.pos.z);
    player.bob = 0;
    player.applyCamera(0);
    // dev: lift the camera for overview shots
    if (opts.lift) camera.position.y += opts.lift;
    if (opts.ink !== undefined) pipeline.enabled.ink = opts.ink;
    if (opts.grade !== undefined) pipeline.enabled.grade = opts.grade;
    pipeline.forceScale = opts.scale || 1;

    camera.aspect = W / H;
    updateProjection();
    pipeline.setSize(W, H);
    setOutlineResolution(pipeline.size.x, pipeline.size.y);
    world.update(0, camera);
    seatLights();
    sky.dome.position.copy(camera.position);
    sky.clouds.position.copy(camera.position);
    // count this one frame, every pass (shadow map included)
    renderer.info.autoReset = false;
    renderer.info.reset();
    pipeline.render();
    window.__frameInfo = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    // and again with the shadow map left as it is: the main pass alone
    renderer.shadowMap.autoUpdate = false;
    renderer.info.reset();
    pipeline.render();
    window.__frameInfo.mainCalls = renderer.info.render.calls;
    window.__frameInfo.mainTriangles = renderer.info.render.triangles;
    renderer.shadowMap.autoUpdate = true;
    renderer.info.autoReset = true;
    if (opts.time) {
      // average frame time over `time` frames, GPU work included (readPixels waits for it)
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const t0 = performance.now();
      for (let k = 0; k < opts.time; k++) pipeline.render();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      window.__frameInfo.ms = (performance.now() - t0) / opts.time;
      window.__frameInfo.internal = [pipeline.size.x, pipeline.size.y];
      if (!opts.returnData && !opts.dir) return window.__frameInfo;
    }

    const off = document.createElement('canvas');
    const outW = opts.outW || W;
    off.width = outW;
    off.height = Math.round((outW * H) / W);
    const ctx = off.getContext('2d');
    ctx.drawImage(canvas, 0, 0, off.width, off.height);
    if (opts.overlay) {
      // the reference photo at 50%, fitted by height as the R overlay is
      const img = new Image();
      img.src = opts.overlay;
      await img.decode();
      const h = off.height, w = (img.width * h) / img.height;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(img, (off.width - w) / 2, 0, w, h);
      ctx.globalAlpha = 1;
    }
    const data = opts.png ? off.toDataURL('image/png') : off.toDataURL('image/jpeg', opts.quality || 0.86);
    if (opts.returnData) return { data, ...window.__frameInfo };
    const r = await fetch('/__shot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, data, dir: opts.dir }),
    });
    return r.json();
  };

  /* ?lookdev: frame each hero camera once Fuji has loaded, save it to
   * reference/lookdev/, and save a copy with the reference photo laid over
   * it to .shots/ (those carry the third-party photo, so they stay local). */
  const params = devParams;
  window.__lastView = () => lastView;
  /** Stand the trains in a moment: 'platform', 'platform2', 'crossing', 'approach'. */
  window.__train = (kind) => world.line?.service.stage(kind);

  /* ?traincheck: run the service fast in fixed steps and check it (SPEC M2c).
   * Events with their times, the dwell and headway, and at every step: is
   * the crossing shut whenever a train is within the margin of it? */
  if (params.has('traincheck')) {
    world.fuji.ready.then(() => {
      const L = world.line, S = L.service;
      const dt = 1 / 20;
      const cx = L.crossingPos.x;
      let openWhileNear = 0, lampsOffWhileDown = 0, steps = 0;
      for (let t = 0; t < 1200; t += dt) {
        S.update(dt);
        steps++;
        for (const r of S.runs) {
          if (r.phase === 'idle') continue;
          const lo = Math.min(r.x - r.len / 2, r.x + r.len / 2) - 4, hi = Math.max(r.x - r.len / 2, r.x + r.len / 2) + 4;
          if (cx > lo && cx < hi && S.cross.armT < 0.999) openWhileNear++;
        }
        if (S.cross.armT >= 0.999 && !S.cross.bells) lampsOffWhileDown++;
      }
      const ev = S.events;
      const find = (name, from = 0) => ev.findIndex((e, i) => i >= from && e.name === name);
      const out = { events: ev.map((e) => `${e.t}s ${e.name} set${e.set} track${e.track} ${e.dir}`), dwell: [], headway: [], order: [] };
      for (let i = 0; i < ev.length; i++) {
        const e = ev[i];
        if (e.name === 'doorsOpen') {
          const c = find('chime', i);
          if (c >= 0) out.dwell.push(+(ev[c].t - e.t).toFixed(1));
          const cl = find('doorsClosed', i);
          if (c >= 0 && cl >= 0) out.order.push(ev[c].t < ev[cl].t ? 'chime-then-close' : 'WRONG');
        }
        if (e.name === 'depart') {
          const a = find('arrive', i);
          if (a >= 0) out.headway.push({ s: +(ev[a].t - e.t).toFixed(1), from: e.track, to: ev[a].track });
        }
      }
      out.crossing = { steps, openWhileNear, lampsOffWhileDown };
      window.__traincheck = out;
      console.log('traincheck ' + JSON.stringify(out));
      document.title = 'traincheck done';
    });
  }
  /* The density budget (SPEC section 3), from a spot and town-wide. */
  window.__density = (spot) => {
    const kit = world.core?.kit ?? world.kit;
    if (!kit || !world.registry) return null;
    const out = {};
    if (spot) out.spot = atSpot(world.registry, kit.decals, spot, PLAYER.hfov);
    else out.bare = bareStretches(kit.net, world.core?.lots ?? [], world.registry, kit.decals, world.core?.specials ?? []);
    return out;
  };
  world.fuji.ready.then(() => { window.__ready = true; });

  /* ?m2check: the M2 acceptance measurements, printed to the console.
   *   walk   the player controller driven along the town's longest routes at
   *          walking pace: seconds taken, and whether it ever got stuck
   *   fuji   share of walkable sample points with a clear line of sight from
   *          eye height to Fuji's peak
   *   perf   average frame time at 2560 x 1440, GPU work included */
  if (params.has('m2check')) {
    world.fuji.ready.then(async (fujiMesh) => {
      const log = (...a) => console.log('m2check ' + a.join(' '));
      enterHero('morning');

      /* ---- walk ---- */
      const walkRoute = (name, pts) => {
        player.pos.set(pts[0][0], world.heightAt(pts[0][0], pts[0][1]), pts[0][1]);
        player.vel.set(0, 0, 0);
        player.locked = true;
        player.keys.clear();
        player.keys.add('KeyW');
        let t = 0, i = 1, stuck = 0, lastD = Infinity, since = 0, dist = 0;
        const prev = player.pos.clone();
        while (i < pts.length && t < 600) {
          const [tx, tz] = pts[i];
          const dx = tx - player.pos.x, dz = tz - player.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.8) { i++; lastD = Infinity; since = 0; continue; }
          player.yaw = Math.atan2(-dx, -dz);
          player.update(1 / 60);
          dist += prev.distanceTo(player.pos);
          prev.copy(player.pos);
          t += 1 / 60;
          since += 1 / 60;
          if (d < lastD - 0.5) { lastD = d; since = 0; }
          if (since > 4) {
            stuck++;
            log(`walk ${name} STUCK near (${player.pos.x.toFixed(1)}, ${player.pos.z.toFixed(1)}) heading to (${tx}, ${tz})`);
            i++; since = 0; lastD = Infinity;
          }
        }
        player.keys.clear();
        player.locked = false;
        log(`walk ${name}: ${t.toFixed(0)} s, ${dist.toFixed(0)} m, stuck ${stuck}`);
      };
      // M2b: the famous view -> down the spine -> the plaza
      walkRoute('spine-to-plaza', [[0, 18.6], [-48.4, 18.6], [-48.4, 124]]);
      /* The walker steers straight at each waypoint, so pavements are checked
       * separately: at every 0.25 m along the spine's two pavements there has
       * to be a gap the player (0.34 m round) fits through. */
      {
        const R = 0.34;
        const blocked = (x, z) => world.colliders.some((c) => c.top > world.heightAt(x, z) + 0.45
          && x > c.x0 - R && x < c.x1 + R && z > c.z0 - R && z < c.z1 + R);
        for (const [name, xa, xb] of [['spine east', -47.0, -44.8], ['spine west', -55.2, -53.0]]) {
          let bad = 0;
          for (let z = 21; z < 124; z += 0.25) {
            let ok = false;
            for (let x = xa; x <= xb && !ok; x += 0.1) ok = !blocked(x, z);
            if (!ok) bad++;
          }
          log(`pavement ${name}: ${bad === 0 ? 'passable all along' : bad + ' blocked slices'}`);
        }
      }
      // a loop round the lanes of the core
      walkRoute('lanes-loop', [[-25.5, 19.5], [-25.5, 80], [92, 80], [92, 146], [0, 146], [0, 112], [-50, 112], [-50, 45], [-25.5, 45]]);
      // the north side: the residential lane behind the store
      walkRoute('north-lane', [[-21.5, 20], [-21.5, 5], [-21.5, -41], [-108, -41]]);
      // the barricade west to the barricade east, along the main road
      walkRoute('road-end-to-end', [[-116, 13.8], [116, 13.8]]);

      /* ---- fuji ---- */
      {
        const pos = fujiMesh.geometry.attributes.position;
        let top = 0;
        for (let k = 1; k < pos.count; k++) if (pos.getY(k) > pos.getY(top)) top = k;
        const peakLocal = new THREE.Vector3().fromBufferAttribute(pos, top);
        const ray = new THREE.Raycaster();
        const targets = [];
        world.root.traverse((o) => { if (o.isMesh && o.visible && o.name !== 'ground') targets.push(o); });
        const B = world.bounds;
        let n = 0, clear = 0;
        const eye = new THREE.Vector3(), peak = new THREE.Vector3(), dir = new THREE.Vector3();
        const inside = (x, z) => world.colliders.some((c) => c.top > 1.5 && x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1);
        for (let x = B.x0 + 6; x < B.x1 - 6; x += 10) {
          for (let z = B.z0 + 6; z < B.z1 - 6; z += 10) {
            if (inside(x, z)) continue;
            eye.set(x, world.heightAt(x, z) + 1.6, z);
            camera.position.copy(eye);
            world.fuji.follow(camera);
            fujiMesh.updateMatrixWorld(true);
            peak.copy(peakLocal).applyMatrix4(fujiMesh.matrixWorld);
            dir.subVectors(peak, eye).normalize();
            ray.set(eye, dir);
            ray.far = 400;
            n++;
            if (!ray.intersectObjects(targets, false).length) clear++;
          }
        }
        log(`fuji peak visible from ${clear} of ${n} walkable sample points (${Math.round((100 * clear) / n)}%)`);
      }

      /* ---- perf ---- */
      {
        const W = 2560, H = 1440;
        camera.aspect = W / H;
        pipeline.forceScale = 0;
        pipeline.setSize(W, H);
        updateProjection();
        setOutlineResolution(pipeline.size.x, pipeline.size.y);
        const gl = renderer.getContext();
        const px = new Uint8Array(4);
        const views = [['morning', null], ['spine', [-46.2, 40, Math.PI]], ['road', [-60, 14, -1.35]], ['lane', [52, 79.4, 1.5708]]];
        for (const [name, at] of views) {
          enterHero(name === 'morning' ? 'morning' : 'golden');
          if (at) { player.pos.set(at[0], world.heightAt(at[0], at[1]), at[1]); player.yaw = at[2]; player.pitch = 0.05; player.applyCamera(0); }
          world.update(0, camera);
          seatLights();
          sky.dome.position.copy(camera.position);
          sky.clouds.position.copy(camera.position);
          for (let k = 0; k < 5; k++) pipeline.render();
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const N = 60;
          const t0 = performance.now();
          for (let k = 0; k < N; k++) {
            world.update(1 / 60, camera);
            pipeline.render();
          }
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const ms = (performance.now() - t0) / N;
          log(`perf ${name}: ${ms.toFixed(2)} ms/frame at ${W}x${H} (internal ${pipeline.size.x}x${pipeline.size.y})`);
        }
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        log('gpu ' + (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown'));
      }
      log('done');
      console.log('tour done');
    });
  }

  if (params.has('lookdev')) {
    world.fuji.ready.then(async () => {
      const W = Number(params.get('w')) || 1920;
      const H = Number(params.get('h')) || 1080;
      for (const name of Object.keys(HERO_VIEWS)) {
        // what keys 1, 2, 3 show in play
        refOn = false;
        enterHero(name);
        await window.__shot(`hero-${name}`, W, H, { dir: 'lookdev', quality: 0.92 });
        // the exact photo camera, alone and under the reference photo
        refOn = true;
        enterHero(name);
        await window.__shot(`hero-${name}-photo-lens`, W, H, { dir: 'lookdev', quality: 0.92 });
        await window.__shot(`hero-${name}-vs-ref`, W, H,
          { overlay: `./reference/${HERO_VIEWS[name].ref}`, quality: 0.88 });
        // the play view under the reference photo, to judge how close it reads
        refOn = false;
        enterHero(name);
        await window.__shot(`hero-${name}-play-vs-ref`, W, H,
          { overlay: `./reference/${HERO_VIEWS[name].ref}`, quality: 0.88 });
      }
      refOverlay.show(false);
      // a few steps on from the spawn, to check nothing jumps
      enterHero('golden');
      await window.__shot('play-golden-walk', W, H, { pos: [0, 0, 13], yaw: 0, pitch: 0.16 });
      document.title = 'lookdev done';
      console.log('lookdev done');
    });
  }
}
