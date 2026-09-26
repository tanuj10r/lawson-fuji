import * as THREE from 'three';
import { STORE } from '../../config.js';
import { makePainter } from './painter.js';
import { smallSign } from './tex.js';

/* ------------------------------------------------------------------ *
 * The glass doors of the walk-in cooler and the freezers (M3c).
 *
 * Each door hangs on a hinge recorded by interior.js: E opens it (a quick
 * eased swing out into the aisle and a puff of cold air), a second E takes
 * what you are looking at; it stays open while you shop at it and shuts
 * when you walk off, or when you aim at the open leaf and press E.  Shut, the doors are drawn exactly where the single
 * sheet of glass used to be, so the famous views do not move.
 *
 * The leaves do not block walking: they swing through the aisle for a
 * moment only, as in a real store you step round them.
 * ------------------------------------------------------------------ */

const FRAME = 0x2c2e38, STEEL = 0xc8ccd4;

let puffTex = null;
function puffTexture() {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  r.addColorStop(0, 'rgba(255,255,255,0.9)');
  r.addColorStop(0.5, 'rgba(240,248,255,0.45)');
  r.addColorStop(1, 'rgba(240,248,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  puffTex = new THREE.CanvasTexture(c);
  puffTex.colorSpace = THREE.SRGBColorSpace;
  return puffTex;
}

/**
 * Hang the doors in `group` (the interior).  `glassMat` is the cooler glass;
 * `lit` takes the frames' materials so the look brightens them with the room.
 */
export function buildFridgeDoors(group, specs, { glassMat, lit }) {
  const doors = specs.map((d, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(d.x, 0, d.z);
    pivot.rotation.y = d.base;
    pivot.userData.dynamic = true;
    const leaf = new THREE.Group();
    pivot.add(leaf);
    group.add(pivot);

    // the leaf in its own frame: from the hinge along +x (times s), the shop at +z
    const p = makePainter();
    const s = d.s, L = d.len, x0 = Math.min(0, s * L), x1 = Math.max(0, s * L);
    const st = 0.045, t0 = -0.012, t1 = 0.012;
    p.box(x0, x0 + st, d.y0, d.y1, t0, t1, FRAME);
    p.box(x1 - st, x1, d.y0, d.y1, t0, t1, FRAME);
    p.box(x0, x1, d.y1 - 0.05, d.y1, t0, t1, FRAME);
    p.box(x0, x1, d.y0, d.y0 + 0.06, t0, t1, FRAME);
    // the handle, a tall bar near the free edge, standing off the glass
    const hx = s * (L - 0.17);
    const hy0 = Math.min(0.8, d.y0 + 0.6), hy1 = Math.min(1.7, d.y1 - 0.3);
    p.box(hx - 0.015, hx + 0.015, hy0, hy1, t1 + 0.018, t1 + 0.045, STEEL);
    for (const y of [hy0 + 0.02, hy1 - 0.02]) p.box(hx - 0.01, hx + 0.01, y - 0.015, y + 0.015, t1, t1 + 0.03, STEEL);
    if (d.sticker) p.quad(smallSign('cold'), s * 0.39, 1.95, t1 + 0.002, 0.3, 0.15);
    p.build(leaf, lit, { name: 'fridge-door' });

    const pane = new THREE.Mesh(new THREE.PlaneGeometry(L - 2 * st + 0.01, d.y1 - d.y0 - 0.1), glassMat);
    pane.position.set(s * L / 2, (d.y0 + d.y1) / 2 + 0.005, 0);
    pane.userData.noOutline = true;
    pane.renderOrder = 2;
    leaf.add(pane);

    // the closed leaf's box in the interior's frame, for aiming at it
    const local = new THREE.Box3(new THREE.Vector3(x0, d.y0, t0 - 0.01), new THREE.Vector3(x1, d.y1, t1 + 0.05));
    pivot.updateMatrix();
    const box = local.clone().applyMatrix4(pivot.matrix);
    return { i, spec: d, pivot, leaf, box, local, openBox: box.clone(), open: 0, want: 0 };
  });

  /* the cold-air puff: a few soft sprites breathing out of the opening */
  const puffs = [];
  const tex = puffTexture();
  for (let k = 0; k < 14; k++) {
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, color: 0xf4f9ff });
    const sp = new THREE.Sprite(m);
    sp.visible = false;
    sp.userData.noOutline = true;
    sp.renderOrder = 3;
    group.add(sp);
    puffs.push({ sp, age: 1, life: 0.8, v: new THREE.Vector3() });
  }
  let nextPuff = 0;
  function puff(door) {
    const d = door.spec;
    const out = new THREE.Vector3(Math.sin(d.base), 0, Math.cos(d.base));
    const along = new THREE.Vector3(Math.cos(d.base), 0, -Math.sin(d.base)).multiplyScalar(d.s);
    for (let k = 0; k < 7; k++) {
      const q = puffs[nextPuff++ % puffs.length];
      const t = 0.25 + 0.5 * Math.random();
      q.sp.position.set(d.x, 0, d.z).addScaledVector(along, t * d.len).addScaledVector(out, 0.05);
      q.sp.position.y = 0.5 + Math.random() * 1.3;
      q.v.copy(out).multiplyScalar(0.25 + Math.random() * 0.2);
      q.v.y = -0.12;
      q.age = 0; q.life = 0.7 + Math.random() * 0.3;
      q.sp.visible = true;
    }
  }

  const ease = (t) => t * t * (3 - 2 * t);
  const api = {
    list: doors,
    /** (door, opening): its sound (M4). */
    onSound: null,
    open(door) {
      if (door.want) return;
      door.want = 1;
      puff(door);
      api.onSound?.(door, true);
    },
    close(door) { if (door.want) { door.want = 0; api.onSound?.(door, false); } },
    /** Each frame, `p` the player's position in the interior's frame. */
    update(dt, p) {
      for (const d of doors) {
        // it stays open while you are at it; walk off and it swings shut
        if (d.want && Math.hypot(p.x - d.box.getCenter(_c).x, p.z - _c.z) > STORE.door.away) api.close(d);
        const to = d.want;
        if (d.open === to) continue;
        d.open = to > d.open ? Math.min(to, d.open + dt / STORE.door.ease) : Math.max(to, d.open - dt / (STORE.door.ease * 1.6));
        d.leaf.rotation.y = -d.spec.s * STORE.door.open * ease(d.open);
        // where the leaf is now, for aiming at it to shut it
        d.leaf.updateMatrix();
        d.openBox.copy(d.local).applyMatrix4(_m.multiplyMatrices(d.pivot.matrix, d.leaf.matrix));
      }
      for (const q of puffs) {
        if (!q.sp.visible) continue;
        q.age += dt;
        const k = q.age / q.life;
        if (k >= 1) { q.sp.visible = false; continue; }
        q.sp.position.addScaledVector(q.v, dt);
        q.sp.scale.setScalar(0.35 + 0.7 * k);
        q.sp.material.opacity = 0.8 * Math.sin(Math.PI * Math.min(1, k * 1.2));
      }
    },
  };
  return api;
}
const _c = new THREE.Vector3(), _m = new THREE.Matrix4();
