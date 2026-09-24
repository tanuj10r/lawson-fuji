import * as THREE from 'three';
import { PAL } from './palette.js';
import { flat } from './toon.js';
import { cloudTex } from './textures.js';
import { rngKit } from './util.js';
import { mergeStatic } from '../world/merge.js';

/**
 * A three-stop painted gradient dome plus a handful of flat cel clouds.
 * Slight banding is intentional -- it reads as airbrushed background art
 * rather than a physical sky.
 *
 * Lawson Fuji: the dome sits behind Mt. Fuji (which is drawn ~1.4 km out),
 * takes its colours from a look (config.js LOOKS), and carries a low glow
 * band toward one bearing -- the bright sky behind Fuji at golden hour.
 * Clouds sit beyond the mountain so it always occludes them, and never in the
 * low sky around its bearing.
 */
export function buildSky(scene, radius = 2900, { avoidYaw = 0 } = {}) {
  const geo = new THREE.SphereGeometry(radius, 48, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: true,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(PAL.skyTop) },
      uMid: { value: new THREE.Color(PAL.skyMid) },
      uHaze: { value: new THREE.Color(PAL.skyHaze) },
      uGlow: { value: new THREE.Color(0xffffff) },
      uGlowAmount: { value: 0 },
      uGlowDir: { value: new THREE.Vector2(0, -1) },
      uBands: { value: 26.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vWorld = wp.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uMid, uHaze, uGlow;
      uniform float uBands, uGlowAmount;
      uniform vec2 uGlowDir;
      varying vec3 vWorld;

      void main() {
        vec3 dir = normalize( vWorld );
        float h = dir.y;
        // soft quantisation: mostly smooth, with a faint painted step
        float t = clamp( h * 1.15 + 0.02, 0.0, 1.0 );
        float q = floor( t * uBands ) / uBands;
        t = mix( t, q, 0.35 );

        vec3 col = mix( uHaze, uMid, smoothstep( 0.0, 0.30, t ) );
        col = mix( col, uTop, smoothstep( 0.26, 0.92, t ) );

        // a touch of warmth low in the sky, opposite the sun
        col = mix( col, uHaze, smoothstep( 0.12, -0.05, h ) * 0.6 );

        // the glow band: low, wide, brightest toward its bearing
        float toward = dot( normalize( dir.xz + 1e-5 ), uGlowDir ) * 0.5 + 0.5;
        float band = smoothstep( 0.32, 0.0, h ) * mix( 0.35, 1.0, toward * toward );
        col = mix( col, uGlow, clamp( band * uGlowAmount, 0.0, 1.0 ) );
        gl_FragColor = vec4( col, 1.0 );
      }
    `,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);

  // --- flat clouds: two rings of billboarded puffs, no depth writes ---
  const tex = cloudTex();
  const rng = rngKit(7781);
  const clouds = new THREE.Group();
  const matA = flat({ color: PAL.cloud, map: tex, transparent: true, opacity: 0.62, depthWrite: false, fog: false, cache: false });
  const matB = flat({ color: PAL.cloudShade, map: tex, transparent: true, opacity: 0.34, depthWrite: false, fog: false, cache: false });
  matA.map.wrapS = matA.map.wrapT = THREE.ClampToEdgeWrapping;

  /* Same seeded draws as Sakura Crossing's ring, pushed out 7.5x (same angular
   * size) to sit behind Fuji.  A cloud low in Fuji's sector is lifted clear
   * of the peak instead of dropped, so the rest of the ring is unchanged. */
  const far = radius * 0.82 / 350;
  /* ...but drawn at 0.55 of that width: the hero lens is ~3x the old one, and
   * at full size a single cloud filled the frame as one smooth band. */
  const size = far * 0.55;
  for (let i = 0; i < 22; i++) {
    const r = rng.range(220, 350) * far;
    const a = rng.range(0, Math.PI * 2);
    const w = rng.range(90, 210) * size;
    const h = w * rng.range(0.24, 0.34);
    let y = rng.range(46, 140) * far;
    // bearing of this cloud measured like FUJI.bearing: degrees right of -Z
    const yaw = THREE.MathUtils.radToDeg(Math.atan2(Math.cos(a), -Math.sin(a)));
    const off = Math.abs(((yaw - avoidYaw + 540) % 360) - 180);
    if (off < 30) y = Math.max(y, r * 0.42);
    const g = new THREE.Group();
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matB);
    back.position.set(2 * size, -h * 0.1, -1.5 * size);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matA);
    g.add(back, front);
    g.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    g.lookAt(0, y * 0.55, 0);
    g.renderOrder = -9;
    clouds.add(g);
  }
  clouds.frustumCulled = false;
  scene.add(clouds);
  // the ring moves as one (it trails the camera), so it batches to two draws
  mergeStatic(clouds);
  clouds.traverse((o) => { o.frustumCulled = false; });

  return {
    dome,
    clouds,
    /** Apply a look from config.js LOOKS. */
    setLook(look) {
      const u = mat.uniforms;
      u.uTop.value.set(look.sky.top);
      u.uMid.value.set(look.sky.mid);
      u.uHaze.value.set(look.sky.haze);
      u.uGlow.value.set(look.sky.glow);
      u.uGlowAmount.value = look.sky.glowAmount;
      const gy = THREE.MathUtils.degToRad(look.sky.glowYaw);
      u.uGlowDir.value.set(Math.sin(gy), -Math.cos(gy));
      matA.color.set(look.clouds.light);
      matB.color.set(look.clouds.shade);
      matA.opacity = 0.62 * look.clouds.opacity;
      matB.opacity = 0.34 * look.clouds.opacity;
      clouds.visible = look.clouds.opacity > 0;
    },
  };
}

/**
 * Pale layered ridge lines on the horizon.  Pure silhouette, unlit, so they
 * read as painted background flats.
 */
export function buildDistantHills(scene) {
  const group = new THREE.Group();
  const rng = rngKit(4242);

  const layers = [
    { z: -330, h: 46, color: PAL.hillFar, width: 900, bumps: 9, y: -6 },
    { z: -250, h: 34, color: PAL.hill, width: 760, bumps: 7, y: -4 },
  ];

  for (const L of layers) {
    const pts = [];
    const n = 90;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = (t - 0.5) * L.width;
      let y = 0;
      for (let b = 1; b <= L.bumps; b++) {
        y += Math.sin(t * Math.PI * b * 1.7 + b * 2.1) * (L.h / (b * 1.25));
      }
      pts.push(new THREE.Vector2(x, Math.max(2, y * 0.55 + L.h * 0.55)));
    }
    const shape = new THREE.Shape();
    shape.moveTo(pts[0].x, -60);
    pts.forEach((p) => shape.lineTo(p.x, p.y));
    shape.lineTo(pts[pts.length - 1].x, -60);
    shape.closePath();
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      flat({ color: L.color, fog: false })
    );
    mesh.position.set(rng.range(-30, 30), L.y, L.z);
    mesh.renderOrder = -8;
    group.add(mesh);

    // mirror a copy behind the camera so turning around still reads as a valley
    const back = mesh.clone();
    back.position.set(rng.range(-40, 40), L.y, -L.z * 1.15);
    back.rotation.y = Math.PI;
    group.add(back);
  }
  scene.add(group);
  return group;
}
