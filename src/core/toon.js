import * as THREE from 'three';
import { PAL } from './palette.js';

/* ------------------------------------------------------------------ *
 * Cel shading
 *
 * Everything in the scene uses MeshToonMaterial with a hand-authored
 * gradient ramp, so direct sunlight is quantised into 2-4 flat bands
 * instead of a smooth falloff.  On top of that we patch the toon BRDF so
 * the darker bands are *tinted* toward a cool violet rather than simply
 * being a darker version of the base colour -- that hue shift in shadow
 * is most of what separates "anime cel" from "low-poly 3D".
 * ------------------------------------------------------------------ */

const RAMPS = {
  2: [96, 255],
  3: [92, 178, 255],
  4: [80, 142, 202, 255],
  5: [74, 124, 172, 214, 255],
  // high-key ramps: for blossom and other pale masses that must stay light
  // even on the shadow side
  soft: [180, 255],
  soft3: [172, 214, 255],
  // painted blossom: three close steps, so a clump turns gently (M2e)
  blossom: [202, 230, 255],
};

const rampCache = new Map();

export function gradientMap(bands = 3) {
  const key = bands;
  if (rampCache.has(key)) return rampCache.get(key);
  const stops = RAMPS[bands] || RAMPS[3];
  const data = new Uint8Array(stops.length * 4);
  for (let i = 0; i < stops.length; i++) {
    data[i * 4 + 0] = stops[i];
    data[i * 4 + 1] = stops[i];
    data[i * 4 + 2] = stops[i];
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, stops.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  tex.userData.bands = key;   // lets batching rebuild an equivalent material
  rampCache.set(key, tex);
  return tex;
}

const TOON_CHUNK = 'lights_toon_pars_fragment';
const TOON_LINE =
  'vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;';
const TOON_PATCH = `
	vec3 celBand = getGradientIrradiance( geometryNormal, directLight.direction );
	vec3 irradiance = celBand * mix( uShadowTint, vec3( 1.0 ), celBand ) * directLight.color;`;

let patchAvailable = false;
let patchedChunk = '';
let patchedChunkAttr = '';
{
  const src = THREE.ShaderChunk[TOON_CHUNK];
  if (src && src.includes(TOON_LINE)) {
    patchedChunk = 'uniform vec3 uShadowTint;\n' + src.replace(TOON_LINE, TOON_PATCH);
    // the same, with the tint per vertex (static batching, world/merge.js)
    patchedChunkAttr = 'varying vec3 vTint;\n'
      + src.replace(TOON_LINE, TOON_PATCH.replace('uShadowTint', 'vTint'));
    patchAvailable = true;
  }
}

/* Wear (M2e): a painted layer of dirt, streaks and stains that darkens a
 * surface the way years of weather do.  One shared atlas holds every
 * variant (kit/paint.js wearAtlas); a mesh carries, per vertex, where in
 * the atlas it reads and how strongly (`aWear`: u, v, strength), so worn
 * walls of any colour still batch together. */
const wearTex = { value: null };
/** Set the shared wear atlas (once, before the first frame). */
export function setWearTexture(tex) { wearTex.value = tex; }

function addWear(shader) {
  shader.uniforms.uWearTex = wearTex;
  shader.vertexShader = 'attribute vec3 aWear;\nvarying vec3 vWear;\n'
    + shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvWear = aWear;');
  shader.fragmentShader = 'uniform sampler2D uWearTex;\nvarying vec3 vWear;\n'
    // after lighting: a sunlit pale wall is already past white, and dirt on
    // its base colour would clip away to nothing
    + shader.fragmentShader.replace('#include <opaque_fragment>',
      // and pale lit walls take it harder: the grade compresses highlights,
      // so the same dirt that reads on a shaded wall would vanish on a lit one
      '\toutgoingLight = min( outgoingLight, vec3( 1.0 ) );\n'
      + '\tfloat wearK = vWear.z * ( 0.8 + 0.5 * dot( outgoingLight, vec3( 0.3, 0.59, 0.11 ) ) );\n'
      + '\toutgoingLight *= max( mix( vec3( 1.0 ), texture2D( uWearTex, vWear.xy ).rgb, wearK ), vec3( 0.35 ) );\n#include <opaque_fragment>');
}

/** Shadow tint read from a per-vertex `aTint` attribute instead of a uniform,
 * so batched geometry from many parts can keep each part's tint. */
function applyTintAttribute(mat) {
  if (!patchAvailable) return mat;
  const wear = !!mat.userData.wear;
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute vec3 aTint;\nvarying vec3 vTint;\n'
      + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvTint = aTint;');
    shader.fragmentShader = shader.fragmentShader.replace(`#include <${TOON_CHUNK}>`, patchedChunkAttr);
    if (wear) addWear(shader);
  };
  mat.customProgramCacheKey = () => 'celTintAttr' + (wear ? 'W' : '');
  mat.userData.tintAttr = true;
  return mat;
}

/** Tint the shadow side of a toon material toward a cool hue. */
function applyShadowTint(mat, tint) {
  if (!patchAvailable) return mat;
  const uni = { value: new THREE.Color(tint) };
  mat.userData.shadowTint = uni;
  const wear = !!mat.userData.wear;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uShadowTint = uni;
    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <${TOON_CHUNK}>`,
      patchedChunk
    );
    if (wear) addWear(shader);
  };
  const hex = new THREE.Color(tint).getHexString();
  mat.customProgramCacheKey = () => 'celTint_' + hex + (wear ? 'W' : '');
  return mat;
}

const matCache = new Map();

/**
 * Cel-shaded material factory.  Results are cached by parameter signature so
 * the whole street ends up sharing a few dozen shader programs.
 */
export function cel(opts = {}) {
  const {
    color = 0xffffff,
    bands = 3,
    tint = 0x6c5f8c,
    flat = true,
    map = null,
    emissive = null,
    emissiveIntensity = 1,
    transparent = false,
    opacity = 1,
    side = THREE.FrontSide,
    alphaTest = 0,
    depthWrite = null,
    fog = true,
    alphaMap = null,
    emissiveMap = null,
    vertexColors = false,
    tintAttr = false,
    wear = false,
    cache = true,
  } = opts;

  const key = cache && !map && !alphaMap
    ? [color, bands, tint, flat, emissive, emissiveIntensity, transparent,
       opacity, side, alphaTest, depthWrite, fog, vertexColors, wear].join('|')
    : null;
  if (key && matCache.has(key)) return matCache.get(key);

  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: gradientMap(bands),
    flatShading: flat,
    map,
    alphaMap,
    transparent,
    opacity,
    side,
    alphaTest,
    fog,
    vertexColors,
    emissive: emissive === null ? 0x000000 : emissive,
    emissiveIntensity,
    emissiveMap,
  });
  if (depthWrite !== null) mat.depthWrite = depthWrite;
  // worn surfaces read a per-vertex aWear (see addWear)
  if (wear) mat.userData.wear = true;
  if (tintAttr) applyTintAttribute(mat);
  else applyShadowTint(mat, tint);
  if (key) matCache.set(key, mat);
  return mat;
}

const flatCache = new Map();

/** Unlit flat colour -- for sky, distant silhouettes, glowing panels, glass. */
export function flat(opts = {}) {
  const {
    color = 0xffffff,
    map = null,
    transparent = false,
    opacity = 1,
    side = THREE.FrontSide,
    alphaTest = 0,
    depthWrite = null,
    fog = true,
    cache = true,
    toneMapped = true,
  } = opts;
  const key = cache && !map
    ? [color, transparent, opacity, side, alphaTest, depthWrite, fog, toneMapped].join('|')
    : null;
  if (key && flatCache.has(key)) return flatCache.get(key);
  const mat = new THREE.MeshBasicMaterial({
    color, map, transparent, opacity, side, alphaTest, fog, toneMapped,
  });
  if (depthWrite !== null) mat.depthWrite = depthWrite;
  if (key) flatCache.set(key, mat);
  return mat;
}

/** Shared material shorthands used all over the world builders. */
export const MAT = {
  get ink() { return flat({ color: PAL.ink, fog: false }); },
  get glassDark() { return flat({ color: PAL.glassDark }); },
};
