import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

/* ------------------------------------------------------------------ *
 * 鏡池's mirror (Tan: the pond looked fake).  Still water is mostly what
 * it reflects: the far bank's trees and roofs as a dark band, the sky
 * pale in the middle, all of it broken by the chop.  So near the pond the
 * water is a real planar reflection (three's Reflector: one extra render
 * of the scene from a mirrored camera, into a small target), tinted with
 * the pond's olive, stronger at a glancing angle, shaken by the ripple
 * map and stepped into a few tones so it stays painted.
 *
 * Cost: the extra render happens only while the mirror is drawn (its
 * onBeforeRender), and the mirror is shown only within `near` metres;
 * beyond it the plain painted water (water.js) takes over.
 * ------------------------------------------------------------------ */

const SHADER = {
  name: 'PondMirror',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    base: { value: new THREE.Color(0xa29c64) },
    deep: { value: new THREE.Color(0x7a744a) },
    chop: { value: null },
    chopOff: { value: new THREE.Vector2() },
    light: { value: 1 },         // how lit the scene is (pond.js, from the look's fog)
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vProj;
    varying vec3 vWorld;
    varying vec2 vUv;
    #include <logdepthbuf_pars_vertex>
    void main() {
      vProj = textureMatrix * vec4(position, 1.0);
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      vUv = uv;
      gl_Position = projectionMatrix * viewMatrix * w;
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D chop;
    uniform vec2 chopOff;
    uniform vec3 base;
    uniform vec3 deep;
    uniform float light;
    varying vec4 vProj;
    varying vec3 vWorld;
    varying vec2 vUv;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      // the chop: two drifting samples of the ripple map, as a wobble
      vec2 w1 = texture2D(chop, vUv * 0.9 + chopOff).rg;
      vec2 w2 = texture2D(chop, vUv * 2.3 - chopOff * 1.7).rg;
      vec2 wob = (w1 + w2 - 1.0) * 0.5;
      vec4 p = vProj;
      p.xy += vec2(wob.x * 0.03, wob.y * 0.08) * p.w;     // reflections smear up and down more than across
      vec3 refl = texture2DProj(tDiffuse, p).rgb;
      // glancing water mirrors more; looking down you see into its olive
      vec3 view = normalize(cameraPosition - vWorld);
      float fres = 0.25 + 0.5 * pow(1.0 - clamp(view.y, 0.0, 1.0), 2.5);
      vec3 body = mix(deep, base, 0.55 + 0.45 * fres) * light;
      // the reflection seen through olive water: greened, a little muddied
      vec3 seen = mix(refl, vec3(dot(refl, vec3(0.3, 0.55, 0.15))), 0.3) * vec3(0.84, 0.86, 0.66);
      // lifted: a deep blue zenith seen in olive water went nearly black
      seen = seen * 0.82 + vec3(0.1, 0.1, 0.075) * light;
      vec3 col = mix(body, seen, fres);
      // painted, not photographed: step the brightness into a few tones
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      float q = floor(l * 7.0 + 0.5) / 7.0;
      col *= mix(1.0, q / max(l, 1e-3), 0.55);
      // the chop's crests catch the light
      float crest = texture2D(chop, vUv * 1.6 + chopOff * 0.6).b;
      col = mix(col, vec3(1.0), smoothstep(0.82, 0.95, crest) * 0.18);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

/**
 * A mirror for flat geometry laid in (x, z) at height `y` (in the parent's
 * frame).  `chopTex` wobbles it; returns the mesh and a per-frame drift.
 */
export function makeMirror(flatGeo, y, chopTex, { size = 768, base, deep, name = 'land-pond-mirror' } = {}) {
  // Reflector wants its plane facing +z locally: stand the pond up, then lay it down again
  const g = flatGeo.clone();
  g.translate(0, -y, 0);
  g.rotateX(Math.PI / 2);
  const m = new Reflector(g, { textureWidth: size, textureHeight: size, clipBias: 0.003, multisample: 0, shader: SHADER });
  m.rotation.x = -Math.PI / 2;
  m.position.y = y + 0.003;
  m.material.uniforms.chop.value = chopTex;
  // the water's own colour (the pond's olive by default; the paddies' mud)
  if (base !== undefined) m.material.uniforms.base.value.set(base);
  if (deep !== undefined) m.material.uniforms.deep.value.set(deep);
  /* The oblique clip that keeps what's under the water out of the mirror
   * also skews its far plane: looking steeply down, the sky dome (2.9 km
   * out) is cut and the pond went black.  So the mirror clears to the sky
   * of the current look (the dome's own colours), and a lost dome is still
   * sky. */
  const render = m.onBeforeRender;
  const keep = new THREE.Color(), clear = new THREE.Color();
  let sky = null;
  m.onBeforeRender = function (renderer, scene, camera, ...rest) {
    if (sky === null) {
      sky = false;
      scene.traverse((o) => { if (!sky && o.material?.uniforms?.uTop && o.material.uniforms.uMid) sky = o.material.uniforms; });
    }
    renderer.getClearColor(keep);
    const alpha = renderer.getClearAlpha();
    if (sky) renderer.setClearColor(clear.copy(sky.uMid.value).lerp(sky.uTop.value, 0.6), 1);
    render.call(this, renderer, scene, camera, ...rest);
    renderer.setClearColor(keep, alpha);
  };
  m.name = name;
  m.userData.dynamic = true;
  m.userData.ground = true;
  m.userData.noAtlas = true;
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

/** The layer the pond's mirror renders: what stands round the pond, and
 * the sky, clouds, Fuji and the lights.  The town beyond the river is left
 * out, so the mirror costs a fraction of a frame, not a second frame. */
export const REFLECT = 5;

/**
 * Put on the REFLECT layer every mesh whose world box touches one of
 * `rects` ([x0, z0, x1, z1], world; one rect or a list: the pond's, the
 * river's), everything outside `townRoot` (sky, clouds, Fuji), and every
 * light.  Run once, after the world is built.
 */
export function tagReflections(scene, townRoot, rects) {
  if (typeof rects[0] === 'number') rects = [rects];
  const box = new THREE.Box3();
  const inTown = new Set();
  townRoot.traverse((o) => inTown.add(o));
  // what stands tall round the water and is worth seeing upside down: trees,
  // the land's own pieces, the water's animals (not street clutter, not the
  // shadow stand-ins, not the falling petals)
  const WORTH = /sakura|pine|camphor|maple|zelkova|grove|canopy|willow|shrub|land|koi|duck|turtle|egret|heron/i;
  const SKIP = /shadow|petal|shower/i;
  const touches = () => rects.some((rect) => box.max.x > rect[0] && box.min.x < rect[2] && box.max.z > rect[1] && box.min.z < rect[3]);
  const inside = () => rects.some((rect) => box.min.x >= rect[0] && box.max.x <= rect[2] && box.min.z >= rect[1] && box.max.z <= rect[3]);
  scene.traverse((o) => {
    if (o.isLight) { o.layers.enable(REFLECT); return; }
    if (!o.isMesh && !o.isPoints && !o.isLine) return;
    if (!inTown.has(o)) { o.layers.enable(REFLECT); return; }             // sky, clouds, Fuji
    if (o.userData.shadowOnly) return;
    const name = o.name || o.parent?.name || '';
    if (SKIP.test(name)) return;
    if (o.isInstancedMesh) {
      if (!WORTH.test(name)) return;
      // where its instances stand (its geometry's box is one instance, at the origin)
      const n = o.count;
      o.count = o.instanceMatrix.count;
      o.computeBoundingBox();
      o.count = n;
      box.copy(o.boundingBox).applyMatrix4(o.matrixWorld);
      // placed each frame (the view-sorted crowns), so not yet anywhere: take it
      if ((box.max.x - box.min.x < 2 && box.max.z - box.min.z < 2) || touches()) o.layers.enable(REFLECT);
      return;
    }
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    // the land's own meshes if they touch; anything of the town's only if it
    // stands wholly by the water (a merged cell is never worth a second drawing)
    if (WORTH.test(name) ? touches() && box.max.x - box.min.x < 120 : inside()) o.layers.enable(REFLECT);
  });
}
