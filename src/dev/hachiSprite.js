import * as THREE from 'three';
import { shibaGeometry, RIG } from '../world/animals/shiba.js';
import { animalMaterial, Herd } from '../world/animals/shade.js';

/* Dev only (scripts/hachi-sprite.mjs): Hachi alone, on nothing, for the
 * selfie postcard (ui/postcardSelfie.js).  The game's own pup as he is in
 * play (its geometry, its rig with every expression at rest, its cel
 * material) lying with his forepaws out, seen from the front: paws over
 * an edge, head tilted, tongue out.  The ink line is drawn here in 2D
 * (the game's is a screen pass). */
export function renderHachi({
  size = 1050, posture = 2, nod = -0.85, tilt = 0.3, look = 0, ears = 1.25, yaw = 0,
  cam = [0.12, 0.2, 1.6], at = [0, 0.15, 0.12], fov = 15, ink = '#3a2a3c', inkPx = 6,
  sun = [-0.6, 1.2, 1.0], sunI = 2.6, ambI = 1.5,
} = {}) {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size * 2, size * 2, false);       // drawn at twice the size, then brought down: a clean edge
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xfff0f4, ambI));
  const d = new THREE.DirectionalLight(0xfff4e6, sunI);
  d.position.set(...sun);
  scene.add(d);
  const herd = new Herd({ add: (m) => scene.add(m) }, shibaGeometry(), animalMaterial({ key: 'shibaSprite', rig: RIG, tint: 0x7a6488, bands: 4 }), 1, 'shiba', { extra: 3 });
  herd.mesh.receiveShadow = false;
  herd.set(0, 0, 0, 0, yaw);
  herd.setPose(0, 0, 0, look, nod);
  herd.setPose2(0, posture, 0, ears, tilt);
  herd.flush();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 10);
  camera.position.set(...cam);
  camera.lookAt(...at);
  renderer.render(scene, camera);

  // down to size, with the ink line round it
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const x = out.getContext('2d');
  x.imageSmoothingQuality = 'high';
  const sil = document.createElement('canvas');
  sil.width = sil.height = size;
  const s = sil.getContext('2d');
  s.imageSmoothingQuality = 'high';
  s.drawImage(canvas, 0, 0, size, size);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = ink;
  s.fillRect(0, 0, size, size);
  for (let i = 0; i < 24; i++) x.drawImage(sil, Math.cos(i * Math.PI / 12) * inkPx, Math.sin(i * Math.PI / 12) * inkPx);
  x.drawImage(canvas, 0, 0, size, size);
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}

/** Cut to what is drawn (plus `pad`), as a WebP with alpha: the best quality under `max` bytes. */
export function hachiSprite(opts = {}, { pad = 8, type = 'image/webp', max = 46000 } = {}) {
  const c = renderHachi(opts);
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(c.width - 1, x1 + pad); y1 = Math.min(c.height - 1, y1 + pad);
  const o = document.createElement('canvas');
  o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
  o.getContext('2d').drawImage(c, -x0, -y0);
  let best = null;
  for (let q = 0.92; q >= 0.5; q -= 0.04) {
    const data = o.toDataURL(type, q);
    best = { w: o.width, h: o.height, data, q: +q.toFixed(2), bytes: Math.round(((data.length - data.indexOf(',') - 1) * 3) / 4) };
    if (best.bytes <= max || type === 'image/png') break;
  }
  return best;
}
