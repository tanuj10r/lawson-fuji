import * as THREE from 'three';
import { shibaGeometry, RIG } from '../world/animals/shiba.js';
import { animalMaterial, Herd } from '../world/animals/shade.js';

/* Dev only (scripts/hachi-sprite.mjs): Hachi alone, on nothing, for the
 * selfie postcard (ui/postcardSelfie.js).  The game's own pup (its
 * geometry, its rig with the expressions, its cel material), seen from
 * the front with both front paws up, head tilted, big eyes, tongue out.
 * Two pictures of the same view: all of him, and his forelegs alone, so
 * the postcard can stand him behind the polaroid with his paws over its
 * edge.  The ink line is drawn here in 2D (the game's is a screen pass). */
export function renderHachi({
  size = 1100, posture = 0, nod = 0, tilt = 0.28, look = 0, ears = 1.25, yaw = 0, wag = 0,
  face = [0, 0, 0, 1], body = [0.7, 0, 0, 0], more = [0, 0, 1, 0],        // aPose3, aPose4, aPose5 (shiba.js)
  cam = [0, 0.3, 1.6], at = [0, 0.2, 0.1], fov = 15, ink = '#3a2a3c', inkPx = 5,
  sun = [-0.6, 1.2, 1.0], sunI = 2.6, ambI = 1.5, only = null,
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
  // `only: 'paws'`: the forelegs alone (parts 3 and 4)
  const mat = animalMaterial({ key: 'shibaSprite' + (only ?? ''), rig: RIG, tint: 0x7a6488, bands: 4, frag: only === 'paws' ? 'if (vPart < 2.5 || vPart > 4.5) discard;' : '' });
  const herd = new Herd({ add: (m) => scene.add(m) }, shibaGeometry(), mat, 1, 'shiba', { extra: 3 });
  if (!herd.more?.length) throw new Error('hachiSprite: this shiba.js has no expressions (aPose3..5); run with --rig <ref>');
  herd.mesh.receiveShadow = false;
  herd.set(0, 0, 0, 0, yaw);
  herd.setPose(0, 0, 0, look, nod);
  herd.setPose2(0, posture, wag, ears, tilt);
  herd.setPoseN(0, 0, ...face); herd.setPoseN(1, 0, ...body); herd.setPoseN(2, 0, ...more);
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

const bounds = (c) => {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
};
const cut = (c, r) => { const o = document.createElement('canvas'); o.width = r.x1 - r.x0 + 1; o.height = r.y1 - r.y0 + 1; o.getContext('2d').drawImage(c, -r.x0, -r.y0); return o; };
/** The best quality under `max` bytes. */
const encode = (c, type, max) => {
  let best = null;
  for (let q = 0.92; q >= 0.4; q -= 0.04) {
    const d = c.toDataURL(type, q);
    best = { data: d, q: +q.toFixed(2), bytes: Math.round(((d.length - d.indexOf(',') - 1) * 3) / 4) };
    if (best.bytes <= max || type === 'image/png') break;
  }
  return best;
};

/**
 * The two pictures, cut to the same frame: him down to just under his paws (the polaroid hides the rest), and
 * his forelegs.  `pawsTop`, `pawsBottom`: where his forelegs are, as fractions of the frame's height (the
 * polaroid's top edge goes between them).
 */
export function hachiSprites(opts = {}, { pad = 6, type = 'image/webp', max = [46000, 12000] } = {}) {
  const all = renderHachi(opts), legs = renderHachi({ ...opts, only: 'paws' });
  const a = bounds(all), l = bounds(legs);
  const r = { x0: Math.max(0, a.x0 - pad), y0: Math.max(0, a.y0 - pad), x1: Math.min(all.width - 1, a.x1 + pad), y1: Math.min(all.height - 1, l.y1 + pad) };
  const A = cut(all, r), L = cut(legs, r);
  return { w: A.width, h: A.height, pawsTop: (l.y0 - r.y0) / A.height, pawsBottom: (l.y1 - r.y0) / A.height, body: encode(A, type, max[0]), paws: encode(L, type, max[1]) };
}
