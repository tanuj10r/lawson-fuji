import * as THREE from 'three';
import { bake } from '../../core/util.js';

/* ------------------------------------------------------------------ *
 * Figures, painted (Tan's konbini): the player's hands and the cashier.
 *
 * The store is painted, not sun-lit (store/painter.js), and so are the
 * people in it: an unlit material whose colour comes from each part's
 * paint, cut into two cel bands by a key light of our own, the shadow
 * band tinted violet as core/toon.js tints the town's.  So a figure reads
 * the same inside the evenly lit store, outside at noon or at blue hour,
 * and never picks up the sun's shadow through the roof.  Its brightness
 * joins the store's `lit` list (`.color`), so the look scales it with the
 * room.  The ink pass outlines it from depth like everything else.
 *
 * `onTop`: drawn over the world, the depth squeezed into the nearest
 * sliver of the range (store/basket.js), and clamped there, so a hand
 * brought to your mouth is never cut by the camera's near plane.
 * ------------------------------------------------------------------ */

const VERT = /* glsl */ `
  attribute vec3 paint;
  varying vec3 vPaint;
  varying vec3 vN;
  #ifdef USE_MAP
    varying vec2 vUv;
  #endif
  void main() {
    vPaint = paint;
    vN = normalize( mat3( modelMatrix ) * normal );
    #ifdef USE_MAP
      vUv = uv;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    #ifdef ON_TOP
      gl_Position.z = -gl_Position.w + 0.02 * max( gl_Position.z + gl_Position.w, 0.0001 * gl_Position.w );
    #endif
  }
`;
const FRAG = /* glsl */ `
  uniform vec3 uLight;
  uniform vec3 uBright;
  uniform vec3 uTint;
  varying vec3 vPaint;
  varying vec3 vN;
  #ifdef USE_MAP
    uniform sampler2D uMap;
    varying vec2 vUv;
  #endif
  void main() {
    vec3 base = vPaint;
    #ifdef USE_MAP
      vec4 t = texture2D( uMap, vUv );
      base *= t.rgb;
    #endif
    float d = dot( normalize( vN ), uLight );
    // two bands and a soft third on the far side: the town's cel ramp, painted
    float band = d > 0.18 ? 1.0 : d > -0.45 ? 0.8 : 0.68;
    vec3 c = base * mix( uTint, vec3( 1.0 ), band ) * uBright;
    gl_FragColor = vec4( c, 1.0 );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const TINT = new THREE.Color(0x6c5f8c);

/**
 * The painted-figure material.  `light` a world direction (a figure in the
 * room) that the owner may update each frame (the hands turn with you);
 * `map` an optional texture multiplied in (the face, the shirt's stripes).
 */
export function figureMaterial({ onTop = false, map = null, light = new THREE.Vector3(-0.35, 0.85, 0.4) } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uLight: { value: light.clone().normalize() },
      uBright: { value: new THREE.Color(1, 1, 1) },
      uTint: { value: TINT },
      uMap: { value: map },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: { ...(onTop ? { ON_TOP: 1 } : {}), ...(map ? { USE_MAP: 1 } : {}) },
  });
  // the store's look scales `.color` of everything on its `lit` list
  m.color = m.uniforms.uBright.value;
  return m;
}

/** Make a basic (textured) material draw on top, near-clamped, as the figures do. */
export function onTopClamped(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include project_vertex',
      '#include project_vertex\n  gl_Position.z = -gl_Position.w + 0.02 * max( gl_Position.z + gl_Position.w, 0.0001 * gl_Position.w );');
  };
  mat.customProgramCacheKey = () => 'onTopClamped';
  return mat;
}

/**
 * A figure part list: `add(geometry, color, matrix)` paints each part (the
 * colour into its `paint` attribute); `build()` bakes them into one
 * geometry for one mesh.  Parts keep their UVs for a map.
 */
export function parts() {
  const list = [];
  const col = new THREE.Color();
  return {
    add(geometry, color, matrix = null) {
      const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      col.set(color);
      const n = g.attributes.position.count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
      g.setAttribute('paint', new THREE.BufferAttribute(c, 3));
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'paint'].includes(k)) g.deleteAttribute(k);
      list.push({ geometry: g, matrix });
      return this;
    },
    get length() { return list.length; },
    build() {
      const g = bake(list);
      g.computeBoundingSphere();
      return g;
    },
  };
}

/** The same geometry mirrored across x (a left hand from a right), faces kept outward. */
export function mirrorX(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { p.setX(i, -p.getX(i)); if (n) n.setX(i, -n.getX(i)); }
  // reverse each triangle's winding
  for (const a of Object.values(g.attributes)) {
    const s = a.itemSize, arr = a.array;
    for (let t = 0; t < a.count; t += 3) {
      for (let k = 0; k < s; k++) { const i1 = (t + 1) * s + k, i2 = (t + 2) * s + k; const v = arr[i1]; arr[i1] = arr[i2]; arr[i2] = v; }
    }
    a.needsUpdate = true;
  }
  g.computeBoundingSphere();
  return g;
}

/** An ellipsoid of radii (rx, ry, rz). */
export function ellipsoid(rx, ry, rz, ws = 16, hs = 12) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  return g;
}

/** A capsule from `a` to `b` (Vector3s), radius r. */
export function limb(a, b, r, seg = 10) {
  const len = a.distanceTo(b);
  const g = new THREE.CapsuleGeometry(r, Math.max(0.0001, len), 4, seg);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

export const ease = (t) => t * t * (3 - 2 * t);
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
/** An overshoot, for things that pop into place (a hand rising). */
export const easeBack = (t) => { const c = 1.5; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
