import * as THREE from 'three';
import { FUJI } from '../config.js';

/* ------------------------------------------------------------------ *
 * Mt. Fuji, from GSI elevation data (scripts/fetch-fuji-dem.mjs).
 *
 * The baked grid is real metres around the summit.  It is turned so the
 * line from the real Lawson to the summit points along FUJI.bearing, and
 * scaled so the mountain subtends exactly the angle it does from the real
 * Lawson.  It then rides along with the camera like the sky: at 16 km the
 * real Fuji does not shift as you walk across a small town.
 *
 * `magnify(k)` gives the gameplay lens the hero photo's telephoto look: it
 * widens and raises the mountain k times without bringing it any closer, so
 * Fuji keeps its famous-view size on screen wherever the player walks.
 *
 * Shading is Sakura Crossing's anime idiom done by hand: two flat light
 * bands (no outline), a posterised snow line that runs further down the
 * gullies, alpenglow on the snow at golden and blue hour, and haze that
 * swallows the base.
 * ------------------------------------------------------------------ */

const DEM_URL = new URL('../data/fuji-dem.bin', import.meta.url);

function parseDem(buf) {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'FUJI') throw new Error('fuji-dem.bin: bad header');
  const n = dv.getUint32(8, true);
  const h = new Float32Array(n * n);
  const raw = new Uint16Array(buf, 32, n * n);
  for (let i = 0; i < h.length; i++) h[i] = raw[i] * 0.1;
  return {
    n,
    cell: dv.getFloat32(12, true),
    obsEast: dv.getFloat32(16, true),
    obsNorth: dv.getFloat32(20, true),
    obsElev: dv.getFloat32(24, true),
    peak: dv.getFloat32(28, true),
    h,
  };
}

function buildGeometry(dem) {
  const { n, cell, h } = dem;
  const half = ((n - 1) * cell) / 2;
  const R = FUJI.radius;
  const fade = 1500;
  const buried = dem.obsElev - 60;

  /* Rotation as a complex number: grid x = east, z = south.  It takes the
   * observer -> summit direction onto -Z; the group then turns it to
   * FUJI.bearing, so magnify() can scale across and up the line of sight. */
  const vx = -dem.obsEast, vz = dem.obsNorth;
  const vl = Math.hypot(vx, vz);
  const dx = 0, dz = -1;
  const rc = (dx * vx + dz * vz) / vl;   // d * conj(v), normalised
  const rs = (dz * vx - dx * vz) / vl;
  const s = FUJI.distance / vl;
  const ex = FUJI.exaggeration;

  const idx = (r, c) => r * n + c;
  const at = (r, c) => h[idx(Math.min(n - 1, Math.max(0, r)), Math.min(n - 1, Math.max(0, c)))];

  const pos = new Float32Array(n * n * 3);
  const elev = new Float32Array(n * n);
  const curv = new Float32Array(n * n);
  const grid = new Float32Array(n * n * 2);
  const inside = new Uint8Array(n * n);

  for (let r = 0; r < n; r++) {
    const gz = -half + r * cell;            // row 0 is north, i.e. -z
    for (let c = 0; c < n; c++) {
      const gx = -half + c * cell;
      const i = idx(r, c);
      const d = Math.hypot(gx, gz);
      inside[i] = d <= R ? 1 : 0;
      // bury the crop edge below the horizon so it never shows as a cliff
      const k = THREE.MathUtils.smoothstep(d, R - fade, R);
      const e = h[i] * (1 - k) + Math.min(h[i], buried) * k;
      elev[i] = e;
      // gullies (positive) and ridges (negative), over a 2-cell radius
      curv[i] = (at(r - 2, c) + at(r + 2, c) + at(r, c - 2) + at(r, c + 2)) * 0.25 - h[i];
      grid[i * 2] = gx;
      grid[i * 2 + 1] = gz;
      pos[i * 3] = (gx * rc - gz * rs) * s;
      pos[i * 3 + 1] = (e - dem.obsElev) * s * ex;
      pos[i * 3 + 2] = (gx * rs + gz * rc) * s;
    }
  }

  const index = [];
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const a = idx(r, c), b2 = idx(r, c + 1), c2 = idx(r + 1, c), d2 = idx(r + 1, c + 1);
      if (!(inside[a] && inside[b2] && inside[c2] && inside[d2])) continue;
      index.push(a, c2, b2, b2, c2, d2);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aElev', new THREE.BufferAttribute(elev, 1));
  g.setAttribute('aCurv', new THREE.BufferAttribute(curv, 1));
  g.setAttribute('aGrid', new THREE.BufferAttribute(grid, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

const vertexShader = /* glsl */ `
  attribute float aElev;
  attribute float aCurv;
  attribute vec2 aGrid;
  varying vec3 vNormal;
  varying float vElev;
  varying float vCurv;
  varying vec2 vGrid;
  uniform vec3 uScale;
  void main() {
    // world normal under rotation R and scale S: R * S^-1 * n
    vNormal = normalize( mat3( modelMatrix ) * ( normal / ( uScale * uScale ) ) );
    vElev = aElev;
    vCurv = aCurv;
    vGrid = aGrid;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uLit, uShade, uSnow, uSnowShade, uAlpen, uHaze, uLight, uInk;
  uniform float uAlpenAmount, uHazeAmount, uSnowLine, uBase, uPeak;
  varying vec3 vNormal;
  varying float vElev;
  varying float vCurv;
  varying vec2 vGrid;

  float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float noise( vec2 p ) {
    vec2 i = floor( p ), f = fract( p );
    f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), f.x ),
                mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
  }

  void main() {
    vec3 n = normalize( vNormal );

    // two flat bands, the edge kept crisp but not aliased
    float ndl = dot( n, normalize( uLight ) );
    float lit = smoothstep( 0.1, 0.16, ndl );

    // posterised, jagged snow line: pushed down the gullies, up the ridges
    float jag = noise( vGrid * 0.0016 ) * 0.65 + noise( vGrid * 0.0062 ) * 0.35;
    float line = uSnowLine + ( jag - 0.5 ) * 520.0 - clamp( vCurv * 38.0, -260.0, 760.0 );
    float snow = step( line, vElev );

    vec3 body = mix( uShade, uLit, lit );
    vec3 white = mix( uSnowShade, uSnow, lit );
    // alpenglow: strongest on the lit snow, a violet cast on the shade side
    white = mix( white, white * uAlpen, uAlpenAmount * ( 0.55 + 0.45 * lit ) );
    vec3 col = mix( body, white, snow );

    // painted ridge lines: a thin ink stroke where the light bands meet on the
    // snow, the way the town's creases ink, only fainter at this distance
    float edge = abs( ndl - 0.13 ) / max( fwidth( ndl ), 1e-4 );
    float stroke = 1.0 - smoothstep( 0.6, 1.6, edge );
    col = mix( col, col * uInk, stroke * snow * 0.55 );

    // aerial haze: a veil over everything, thickening toward the base
    float low = 1.0 - smoothstep( uBase + 120.0, uBase + 1500.0, vElev );
    float hz = clamp( uHazeAmount + ( 1.0 - uHazeAmount ) * low * low, 0.0, 1.0 );
    col = mix( col, uHaze, hz );

    gl_FragColor = vec4( col, 1.0 );
  }
`;

/**
 * Starts loading the DEM and returns a handle at once.  The mountain appears
 * when the grid arrives; `ready` resolves then.
 */
export function buildFuji(scene) {
  const uniforms = {
    uLit: { value: new THREE.Color() },
    uShade: { value: new THREE.Color() },
    uSnow: { value: new THREE.Color() },
    uSnowShade: { value: new THREE.Color() },
    uAlpen: { value: new THREE.Color() },
    uAlpenAmount: { value: 0 },
    uHaze: { value: new THREE.Color() },
    uHazeAmount: { value: 0 },
    uLight: { value: new THREE.Vector3(0, 1, 0) },
    uInk: { value: new THREE.Color(0x8a86c0) },
    uSnowLine: { value: FUJI.snowLine },
    uBase: { value: 0 },
    uPeak: { value: 3776 },
    uScale: { value: new THREE.Vector3(1, 1, 1) },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, fog: false });

  const group = new THREE.Group();
  group.name = 'fuji';
  scene.add(group);

  const offset = new THREE.Vector3();
  /* Bearing under magnification k: a telephoto lens spreads directions as
   * tan, so the peak sits where the photo puts it on screen. */
  const aim = (k) => {
    const b = Math.atan(k * Math.tan(THREE.MathUtils.degToRad(FUJI.bearing)));
    offset.set(Math.sin(b), 0, -Math.cos(b)).multiplyScalar(FUJI.distance);
    group.rotation.y = -b;
  };
  aim(1);
  // local frame: -Z is the line of sight, so scaling x and y magnifies
  const lens = new THREE.Group();
  group.add(lens);

  const ready = fetch(DEM_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`fuji-dem.bin: HTTP ${r.status}`);
      return r.arrayBuffer();
    })
    .then((buf) => {
      const dem = parseDem(buf);
      uniforms.uBase.value = dem.obsElev;
      uniforms.uPeak.value = dem.peak;
      const mesh = new THREE.Mesh(buildGeometry(dem), material);
      mesh.frustumCulled = false;
      mesh.renderOrder = -8;
      mesh.name = 'fuji-dem';
      lens.add(mesh);
      return mesh;
    });

  return {
    group,
    ready,
    /** Keep the mountain at its fixed bearing and distance from the eye. */
    follow(camera) {
      group.position.set(camera.position.x + offset.x, 0, camera.position.z + offset.z);
    },
    /** Angular magnification, 1 = true size (the hero cameras). */
    magnify(k) {
      aim(k);
      lens.scale.set(k, k, 1);
      uniforms.uScale.value.set(k, k, 1);
    },
    setLook(look) {
      const f = look.fuji;
      uniforms.uLit.value.set(f.lit);
      uniforms.uShade.value.set(f.shade);
      uniforms.uSnow.value.set(f.snow);
      uniforms.uSnowShade.value.set(f.snowShade);
      uniforms.uAlpen.value.set(f.alpen);
      uniforms.uAlpenAmount.value = f.alpenAmount;
      uniforms.uHaze.value.set(f.haze);
      uniforms.uHazeAmount.value = f.hazeAmount;
      uniforms.uLight.value.set(...f.light).normalize();
    },
  };
}
