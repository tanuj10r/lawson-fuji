import * as THREE from 'three';
import { PAL } from './core/palette.js';
import { Pipeline } from './core/post.js';
import { buildSky } from './core/sky.js';
import { setOutlineResolution } from './core/outline.js';
import { Player } from './core/player.js';
import { createHud } from './core/hud.js';
import { createMusic } from './core/audio.js';
import { buildTown } from './world/town.js';
import { STRINGS } from './data/strings.js';

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

const camera = new THREE.PerspectiveCamera(46, 1, 0.25, 600);
camera.rotation.order = 'YXZ';

/* --------------------------------- light --------------------------------- */
const sun = new THREE.DirectionalLight(PAL.sun, 2.25);
sun.position.set(-52, 62, 56);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -34;
sun.shadow.camera.right = 34;
sun.shadow.camera.top = 34;
sun.shadow.camera.bottom = -34;
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
const sky = buildSky(scene, 500);
const world = buildTown(scene);

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

hud.onVolumeChange = (value) => {
  hud.setMuted(music.setVolume(value));
  rememberVolume();
};

// Autoplay needs a user gesture, so the music starts on the same click that
// takes the pointer lock rather than on load.
hud.onStart = () => {
  music.start();
  player.lock();
};
player.onLockChange = (locked) => hud.setLocked(locked);
canvas.addEventListener('click', () => {
  music.start();
  if (!player.locked) player.lock();
});

player.onInteract = (target) => {
  if (target) target.action?.();
};

/* ------------------------------- pipeline ------------------------------- */
const pipeline = new Pipeline(renderer, scene, camera);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  pipeline.setSize(w, h);
  setOutlineResolution(pipeline.size.x, pipeline.size.y);
}
window.addEventListener('resize', resize);
resize();

/* --------------------------------- loop --------------------------------- */
const clock = new THREE.Clock();
const shadowTarget = new THREE.Vector3();
/** Light directions, fixed in world space: the world is flat. */
const SUN_DIR = new THREE.Vector3(-52, 62, 56);
const FILL_DIR = new THREE.Vector3(48, 26, -44);
const BOUNCE_DIR = new THREE.Vector3(10, -18, 40);

/** Aim a light at `origin` from a fixed direction. */
function seatLight(light, dir, origin) {
  light.target.position.copy(origin);
  light.position.copy(origin).add(dir);
}

/* The shadow camera follows the player so cast shadows stay crisp near them. */
function seatLights() {
  shadowTarget.set(player.pos.x, 0, player.pos.z);
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
});

function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20);

  player.update(dt);
  world.update(dt);
  seatLights();

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
frame();

// expose a little for tuning from the console
window.__scene = { scene, camera, renderer, pipeline, world, player, music, hud, sun, fill, bounce, hemi, THREE };
window.__setOutlineRes = setOutlineResolution;

if (import.meta.env?.DEV) {
  /**
   * Dev capture: render one frame at a fixed size and post it to the dev
   * server, so framing and colour can be reviewed outside the browser.
   */
  window.__shot = async (name = 'shot', W = 1600, H = 900, opts = {}) => {
    if (opts.pos) player.pos.set(opts.pos[0], player.pos.y, opts.pos[2]);
    if (opts.y !== undefined) player.pos.y = opts.y;
    if (opts.yaw !== undefined) player.yaw = opts.yaw;
    if (opts.pitch !== undefined) player.pitch = opts.pitch;
    // always resync the camera: the rAF loop is throttled when the page is
    // not compositing, so the camera cannot be assumed to match the player
    player.pos.y = world.heightAt(player.pos.x, player.pos.z);
    player.bob = 0;
    player.applyCamera(0);
    if (opts.ink !== undefined) pipeline.enabled.ink = opts.ink;
    if (opts.grade !== undefined) pipeline.enabled.grade = opts.grade;
    pipeline.forceScale = opts.scale || 1;

    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    pipeline.setSize(W, H);
    setOutlineResolution(pipeline.size.x, pipeline.size.y);
    seatLights();
    sky.dome.position.copy(camera.position);
    sky.clouds.position.copy(camera.position);
    pipeline.render();

    const off = document.createElement('canvas');
    const outW = opts.outW || W;
    off.width = outW;
    off.height = Math.round((outW * H) / W);
    off.getContext('2d').drawImage(canvas, 0, 0, off.width, off.height);
    const data = off.toDataURL('image/jpeg', opts.quality || 0.86);
    const r = await fetch('/__shot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, data }),
    });
    return r.json();
  };
}
