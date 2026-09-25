import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { windowAtlas } from './paint.js';

/* ------------------------------------------------------------------ *
 * The town after dark (SPEC section 3, light; M2d).
 *
 *   windows  two shared window glasses for the town's houses: by day both
 *            are dark glass; from dusk the "lit" one turns warm and the
 *            other a dim violet.  About 55% of houses get the lit one.
 *   pools    warm pools of light on the ground -- under street lamps, in
 *            front of shopfronts, round vending machines, under the
 *            station's lights -- one additive mesh, faded in by the look.
 *
 * Lamps, lanterns, shop interiors, vending panels and the trains' insides
 * glow by themselves (unlit or emissive materials).  The famous views'
 * north side is M2's and is not touched.
 * ------------------------------------------------------------------ */

const DAY_GLASS = 0x46506a, LIT = 0xffd9a0, DIM = 0x4a4a78;

export function makeNight(ctx) {
  // the glass shows what is behind it (M2e: curtains, blinds, shoji; kit/paint.js
  // windowAtlas), and at night glows through it
  const pane = { map: windowAtlas(), emissiveMap: windowAtlas() };
  const winLit = cel({ color: 0xc4cad8, ...pane, bands: 2, tint: 0x4b4560, emissive: LIT, emissiveIntensity: 0, cache: false });
  const winDim = cel({ color: 0xc4cad8, ...pane, bands: 2, tint: 0x4b4560, emissive: DIM, emissiveIntensity: 0, cache: false });
  winLit.userData.live = winDim.userData.live = true;

  const pools = [];
  // the warm glow behind shop glass and station doors: additive, shared, faded by the look
  const inside = new THREE.MeshBasicMaterial({
    color: 0xffd8a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  inside.userData.live = true;
  const blossom = [];
  return {
    /** A lit interior behind glass: a warm panel, facing out along ry. */
    glow(parent, w, h, x, y, z, ry = 0) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), inside);
      p.position.set(x, y, z);
      p.rotation.y = ry;
      p.userData.noOutline = true;
      p.renderOrder = 2;
      parent.add(p);
      return p;
    },
    /** Materials that take a faint glow of their own at night (the town's blossom). */
    glowing(mat, color, amount) { blossom.push({ mat, amount }); mat.emissive?.set(color); mat.userData.live = true; },
    /** Window glass for a house: lit at night or not. */
    glass(lit) { return lit ? winLit : winDim; },
    /** A pool of light on the ground at (x, z), radius r, at height y. */
    pool(x, z, r, { y = 0, color = 0xffc98a, strength = 1 } = {}) {
      pools.push({ x, z, r, y, color: new THREE.Color(color).multiplyScalar(strength) });
    },
    /** Build the pool mesh (after everything has asked for its light). */
    finish() {
      if (!pools.length) return null;
      const n = pools.length;
      const pos = new Float32Array(n * 12), uv = new Float32Array(n * 8), col = new Float32Array(n * 12), idx = [];
      pools.forEach((p, i) => {
        const c = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]];
        c.forEach(([dx, dz, u, v], k) => {
          const o = i * 4 + k;
          pos.set([p.x + dx * p.r, p.y + 0.035, p.z + dz * p.r], o * 3);
          uv.set([u, v], o * 2);
          col.set([p.color.r, p.color.g, p.color.b], o * 3);
        });
        const b = i * 4;
        idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeBoundingSphere();
      this.poolMat = new THREE.MeshBasicMaterial({
        map: glowTex(), vertexColors: true, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
      });
      this.poolMat.userData.live = true;
      const mesh = new THREE.Mesh(g, this.poolMat);
      mesh.name = 'nightPools';
      mesh.renderOrder = 3;
      mesh.userData.keep = true;
      mesh.userData.noOutline = true;
      mesh.visible = false;
      ctx.add(mesh);
      this.poolMesh = mesh;
      return mesh;
    },
    /** 0 by day .. 1 at blue hour, from the look. */
    setLook(look) {
      const k = Math.max(0, Math.min(1, (look.store.spill - 0.05) / 0.25));
      winLit.emissiveIntensity = 0.95 * k;
      winDim.emissiveIntensity = 0.35 * k;
      inside.opacity = 0.5 * k;
      for (const b of blossom) b.mat.emissiveIntensity = b.amount * k;
      if (this.poolMat) {
        this.poolMat.opacity = 1.0 * k;
        this.poolMesh.visible = k > 0.01;
      }
    },
    get count() { return pools.length; },
  };
}

let glow = null;
/** A soft round glow, white in the middle, gone at the rim. */
function glowTex() {
  if (glow) return glow;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  glow = new THREE.CanvasTexture(cv);
  glow.colorSpace = THREE.SRGBColorSpace;
  return glow;
}
