import * as THREE from 'three';
import { bake } from '../../core/util.js';

/* ------------------------------------------------------------------ *
 * Figures, painted (Tan's konbini): the player's hand.
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
 * sliver of the range, and clamped there, so a hand
 * brought to your mouth is never cut by the camera's near plane.
 * ------------------------------------------------------------------ */

const VERT = /* glsl */ `
  attribute vec3 paint;
  varying vec3 vPaint;
  varying vec3 vN;
  void main() {
    vPaint = paint;
    vN = normalize( mat3( modelMatrix ) * normal );
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
  void main() {
    vec3 base = vPaint;
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
 * room) that the owner may update each frame (the hand turns with you).
 */
export function figureMaterial({ onTop = false, light = new THREE.Vector3(-0.35, 0.85, 0.4) } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uLight: { value: light.clone().normalize() },
      uBright: { value: new THREE.Color(1, 1, 1) },
      uTint: { value: TINT },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: onTop ? { ON_TOP: 1 } : {},
  });
  // the store's look scales `.color` of everything on its `lit` list
  m.color = m.uniforms.uBright.value;
  return m;
}

/** Make a basic (textured) material draw on top, near-clamped, as the figures do: what you carry is then in the same
 * sliver of depth as your hand, and the depth test puts it where it is, behind the thumb and in front of the fingers
 * (the hand's grips, store/hands.js, are laid out for that).  (The pattern had no angle brackets once, so nothing
 * was clamped and the hand always drew over what it held.) */
export function onTopClamped(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n  gl_Position.z = -gl_Position.w + 0.02 * max( gl_Position.z + gl_Position.w, 0.0001 * gl_Position.w );');
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

/** An ellipsoid of radii (rx, ry, rz). */
export function ellipsoid(rx, ry, rz, ws = 16, hs = 12) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  return g;
}

export const ease = (t) => t * t * (3 - 2 * t);
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
/** An overshoot, for things that pop into place (a hand rising). */
export const easeBack = (t) => { const c = 1.5; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
