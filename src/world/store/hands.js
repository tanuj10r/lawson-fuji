import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { easeBack, ease, clamp01 } from './figure.js';

/* ------------------------------------------------------------------ *
 * Your hand (Tan's konbini; remade for ぺったん堂, 2026-10-01: the first one
 * "looks very fake" -- its fingers stood stiff behind whatever it held).
 *
 * A right hand that HOLDS things.  It lives in the camera's frame: `view`
 * (shop.js) follows the camera, and the hand is a pivot at the palm whose
 * offset and turn the choreography (rise, pay, eat) drives, as before.
 *
 *   the grip    carried, the fingers wrap the thing's far side and the thumb
 *               closes on the near one; eaten, the palm turns to you and the
 *               food is pinched between the thumb in front and the fingers
 *               behind.
 *               Nothing is posed by hand: every frame each digit closes
 *               from open until it touches what is in the anchor (its
 *               bounding box, or the cylinder in it if it is round), so
 *               the fingers wrap a can, lie flat behind a sandwich, cup a
 *               mochi, pinch a card, and follow the food as it is bitten
 *               away.  The palm is seated against the thing too.
 *   the joints  a thumb and four fingers, three joints each, bent in the
 *               vertex shader (each vertex knows its digit and segment), so
 *               closing costs fifteen numbers a frame, no geometry
 *   the look    painted, like everything you hold (store/figure.js): soft
 *               toon bands with a warm shade for skin, a blush along the
 *               terminator, a pale rim light; nails, knuckles, the palm's
 *               lines and the finger creases are modelled or painted in;
 *               a shirt cuff and the jacket's sleeve at the wrist
 *   alive       the digits ease to their touch (never snap), breathe a
 *               little, and the wrist sways
 *
 * Hand frame: the palm at the origin, fingers +y, palm facing +z, a right
 * hand's thumb on +x.  `api` is what it was (shop.js, eat.js, world/mochi/).
 * ------------------------------------------------------------------ */

const SKIN = 0xf7cdb0, SKIN_D = 0xe9b08f, NAIL = 0xfbe3d8, NAIL_TIP = 0xfff4ee, CREASE = 0xdfa285, SLEEVE = 0x4b5d95, CUFF = 0xf0ece4, BUTTON = 0xd8d2c4;
const v = (x, y, z) => new THREE.Vector3(x, y, z);

/* The digits: 1 index .. 4 little, 5 the thumb.  `at` the first joint, `dir` the way it points when straight, `ax`
 * the axis its joints bend about (a positive curl closes it on the palm), `len` its three bones, `r` its radii
 * (joint to joint), `flex` how far each joint can close (rad), `open` the curl it starts from. */
const fan = (a) => ({ dir: v(Math.sin(a), Math.cos(a), 0), ax: v(Math.cos(a), -Math.sin(a), 0) });
const thumbDir = v(0.72, 0.5, 0.48).normalize(), thumbTo = v(-0.78, 0.22, 0.58).normalize();
const DIGITS = [
  null,
  { at: v(0.0285, 0.046, 0.002), ...fan(0.1), len: [0.039, 0.024, 0.02], r: [0.0092, 0.0084, 0.0076, 0.0066], flex: [1.35, 1.65, 1.0], relax: 0.34 },
  { at: v(0.0095, 0.05, 0.001), ...fan(0.02), len: [0.043, 0.027, 0.021], r: [0.0094, 0.0086, 0.0078, 0.0067], flex: [1.35, 1.65, 1.0], relax: 0.41 },
  { at: v(-0.0095, 0.048, 0.001), ...fan(-0.06), len: [0.04, 0.025, 0.02], r: [0.0088, 0.0081, 0.0073, 0.0063], flex: [1.35, 1.65, 1.0], relax: 0.47 },
  { at: v(-0.0275, 0.04, 0.003), ...fan(-0.17), len: [0.031, 0.019, 0.017], r: [0.0078, 0.0071, 0.0064, 0.0056], flex: [1.35, 1.65, 1.0], relax: 0.56 },
  { at: v(0.026, -0.03, 0.012), dir: thumbDir, ax: thumbDir.clone().cross(thumbTo).normalize(), len: [0.043, 0.032, 0.027], r: [0.0135, 0.0116, 0.0102, 0.0086], flex: [0.75, 0.75, 1.0], relax: 0.62 },
];

/* ------------------------------ building ------------------------------ */
function ring(n, a, b, y, e = 2, cx = 0, cz = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    pts.push(v(cx + a * Math.sign(c) * Math.abs(c) ** (2 / e), y, cz + b * Math.sign(s) * Math.abs(s) ** (2 / e)));
  }
  return pts;
}
/** Skin a stack of rings into one smooth closed surface, the ends fanned shut. */
function loft(rings) {
  const n = rings[0].length, m = rings.length;
  const pos = [], idx = [];
  for (const r of rings) for (const p of r) pos.push(p.x, p.y, p.z);
  for (let i = 0; i < m - 1; i++) for (let j = 0; j < n; j++) {
    const j1 = (j + 1) % n, a = i * n + j, b = (i + 1) * n + j, c = (i + 1) * n + j1, d = i * n + j1;
    idx.push(a, b, d, b, c, d);
  }
  for (const [i, flip] of [[0, true], [m - 1, false]]) {
    const ci = pos.length / 3;
    let cx = 0, cy = 0, cz = 0;
    for (const p of rings[i]) { cx += p.x; cy += p.y; cz += p.z; }
    pos.push(cx / n, cy / n, cz / n);
    for (let j = 0; j < n; j++) { const j1 = (j + 1) % n; idx.push(ci, flip ? i * n + j : i * n + j1, flip ? i * n + j1 : i * n + j); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const ellipsoid = (rx, ry, rz, w = 12, h = 9) => new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz);
/** A matrix placing a part at p in the frame (x across, y along, z toward the palm). */
const frameAt = (x, y, z, p) => new THREE.Matrix4().makeBasis(x, y, z).setPosition(p);

/** The painted parts, each tagged with the digit and segment that bends it. */
function builder() {
  const list = [], col = new THREE.Color();
  return {
    add(geometry, color, matrix = null, bone = [0, 0]) {
      const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      if (!g.attributes.normal) g.computeVertexNormals();
      if (matrix) g.applyMatrix4(matrix);
      const n = g.attributes.position.count, c = new Float32Array(n * 3), b = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        col.set(typeof color === 'function' ? color(i, g) : color);
        c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
        b[i * 2] = bone[0]; b[i * 2 + 1] = bone[1];
      }
      g.setAttribute('paint', new THREE.BufferAttribute(c, 3));
      g.setAttribute('aBone', new THREE.BufferAttribute(b, 2));
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'paint', 'aBone'].includes(k)) g.deleteAttribute(k);
      list.push(g);
      return this;
    },
    build() { const g = mergeGeometries(list, false); g.computeBoundingSphere(); return g; },
  };
}

/** One digit, built straight along its `dir`: three tapering bones, a ball at each joint, the pad and the nail. */
function digit(p, id) {
  const D = DIGITS[id], thumb = id === 5;
  const along = D.dir, ax = D.ax, palm = ax.clone().cross(along).normalize();     // toward what it closes on
  let P = D.at.clone();
  for (let k = 0; k < 3; k++) {
    const Q = P.clone().addScaledVector(along, D.len[k]);
    const bone = [id, k];
    // the bone: a touch fuller on the pad's side
    const len = D.len[k], seg = new THREE.CylinderGeometry(D.r[k + 1], D.r[k], len, 12, 1, true).translate(0, len / 2, 0);
    p.add(seg, SKIN, frameAt(ax, along, palm, P), bone);
    // the joint: the knuckle stands proud of the back of the hand, the middle joint is the knobbly one
    const jr = D.r[k] * (k === 0 ? 1.1 : k === 1 ? 1.08 : 1.04);
    p.add(ellipsoid(jr, jr * 0.96, jr, 12, 9), SKIN, frameAt(ax, along, palm, P.clone().addScaledVector(palm, k === 0 ? -D.r[0] * 0.12 : 0)), bone);
    // a crease across the pad's side of each joint
    if (k > 0) p.add(ellipsoid(D.r[k] * 0.8, 0.0011, D.r[k] * 0.4, 8, 4), CREASE, frameAt(ax, along, palm, P.clone().addScaledVector(palm, D.r[k] * 0.7)), bone);
    // and two faint lines over the knuckle's back
    if (k === 1) for (const s of [-1, 1]) p.add(ellipsoid(D.r[k] * 0.7, 0.0009, D.r[k] * 0.3, 8, 4), SKIN_D, frameAt(ax, along, palm, P.clone().addScaledVector(palm, -D.r[k] * 0.82).addScaledVector(along, s * 0.0022)), bone);
    if (k === 2) {
      // the tip: a pad, fuller toward what it holds; the nail on its back, a paler free edge
      p.add(ellipsoid(D.r[3] * 1.0, D.r[3] * 1.18, D.r[3] * 1.0, 12, 9), SKIN, frameAt(ax, along, palm, Q.clone().addScaledVector(along, -D.r[3] * 0.18)), bone);
      const tilt = new THREE.Quaternion().setFromAxisAngle(ax, 0.2);
      const nd = along.clone().applyQuaternion(tilt), np = palm.clone().applyQuaternion(tilt);
      const nailAt = P.clone().addScaledVector(along, len * 0.62).addScaledVector(palm, -D.r[3] * (thumb ? 0.86 : 0.84));
      p.add(ellipsoid(D.r[3] * 0.76, len * 0.4, D.r[3] * 0.32, 12, 8), (i, g) => (g.attributes.position.getY(i) > len * 0.24 ? NAIL_TIP : NAIL), frameAt(ax, nd, np, nailAt), bone);
    }
    P = Q;
  }
}

/** A right hand, its digits straight (the shader closes them), and its sleeve. */
function rightHandGeometry() {
  const p = builder();
  const N = 28;
  /* the palm: from the wrist to the knuckle line, flatter on the back, fuller toward the fingers; the four
   * metacarpal ridges rise to the knuckles; the hollow of the palm */
  {
    const st = [[-0.06, 0.0262, 0.0142, 2.2], [-0.048, 0.0298, 0.0153, 2.3], [-0.034, 0.0346, 0.016, 2.4], [-0.018, 0.0386, 0.0158, 2.5],
      [0.002, 0.041, 0.015, 2.6], [0.02, 0.042, 0.014, 2.7], [0.034, 0.041, 0.0126, 2.7], [0.044, 0.0365, 0.0106, 2.6], [0.05, 0.0295, 0.0078, 2.4]];
    const g = loft(st.map(([y, a, b, e]) => ring(N, a, b, y, e, 0.001, 0.001)));
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (z < -0.003 && y > -0.012) {
        const k = clamp01((y + 0.012) / 0.05);
        let bump = 0;
        for (const fx of [0.0285, 0.0095, -0.0095, -0.0275]) bump += Math.exp(-(((x - fx) / 0.0068) ** 2));
        pos.setZ(i, z - 0.0026 * k * k * bump);
      } else if (z > 0.004 && y > -0.024 && y < 0.032) {
        pos.setZ(i, z - 0.003 * Math.exp(-((x / 0.02) ** 2)) * Math.exp(-(((y - 0.004) / 0.03) ** 2)));
      }
    }
    g.computeVertexNormals();
    p.add(g, SKIN);
    // the pads: the thenar under the thumb, the hypothenar along the little finger's side, the row under the fingers
    p.add(ellipsoid(0.019, 0.031, 0.0135, 14, 10), SKIN, new THREE.Matrix4().makeRotationZ(-0.55).setPosition(0.023, -0.02, 0.0108));
    p.add(ellipsoid(0.0122, 0.03, 0.0102, 12, 9), SKIN, new THREE.Matrix4().makeRotationZ(0.12).setPosition(-0.027, -0.018, 0.0088));
    for (const D of DIGITS.slice(1, 5)) p.add(ellipsoid(0.0092, 0.0085, 0.006, 10, 7), SKIN, new THREE.Matrix4().makeTranslation(D.at.x, D.at.y - 0.011, 0.0095));
    // the palm's lines: the two across it and the one round the thumb's pad, painted a shade deeper
    const line = (x, y, rz, len) => p.add(ellipsoid(len, 0.001, 0.0012, 10, 4), CREASE, new THREE.Matrix4().makeRotationZ(rz).setPosition(x, y, 0.0142));
    line(-0.004, 0.026, 0.16, 0.026); line(0.002, 0.011, 0.3, 0.025); line(0.012, -0.014, 1.15, 0.022);
    // the web of skin from the thumb to the index finger
    p.add(ellipsoid(0.017, 0.021, 0.0056, 12, 9), SKIN, new THREE.Matrix4().makeRotationZ(-0.9).setPosition(0.039, 0.016, 0.0105));
  }
  for (let id = 1; id <= 5; id++) digit(p, id);

  /* the wrist and forearm: oval, widening away from the hand; the ulnar bump on the little finger's side */
  const lean = (y) => 0.09 * (y + 0.06), sway = (y) => 0.001 - 0.02 * (y + 0.06);
  {
    const st = [[-0.06, 0.026, 0.0142], [-0.075, 0.0262, 0.0162], [-0.1, 0.0275, 0.0186], [-0.16, 0.0325, 0.0255], [-0.3, 0.04, 0.034]];
    p.add(loft(st.map(([y, a, b]) => ring(N, a, b, y, 2, sway(y), lean(y)))), SKIN);
    p.add(ellipsoid(0.0068, 0.009, 0.0058, 10, 8), SKIN, new THREE.Matrix4().makeTranslation(-0.0255, -0.068, -0.0075));
    // the two cords of the wrist, faint, on the palm's side
    for (const x of [-0.004, 0.006]) p.add(ellipsoid(0.0022, 0.016, 0.0018, 8, 5), SKIN_D, new THREE.Matrix4().makeTranslation(x, -0.07, 0.0152));
  }
  /* the shirt cuff at the wrist, its button on the back, and the jacket sleeve over it with a turned hem */
  p.add(loft([[-0.08, 0.0305, 0.021], [-0.084, 0.0318, 0.0222], [-0.118, 0.032, 0.0225]].map(([y, a, b]) => ring(N, a, b, y, 2.2, sway(y), lean(y)))), CUFF);
  p.add(new THREE.CylinderGeometry(0.0046, 0.0046, 0.0024, 12).rotateX(Math.PI / 2), BUTTON, new THREE.Matrix4().makeTranslation(-0.019, -0.099, lean(-0.099) - 0.021));
  p.add(loft([[-0.106, 0.0365, 0.028], [-0.11, 0.0388, 0.0302], [-0.118, 0.037, 0.0285], [-0.2, 0.041, 0.033], [-0.44, 0.051, 0.043]].map(([y, a, b]) => ring(N, a, b, y, 2.2, sway(y), lean(y)))), SLEEVE);
  return p.build();
}

/* ------------------------------ the paint ------------------------------ */
const VERT = /* glsl */ `
  attribute vec3 paint;
  attribute vec2 aBone;
  uniform vec3 uCurl[6];
  uniform vec3 uAt[6];
  uniform vec3 uDir[6];
  uniform vec3 uAx[6];
  uniform vec3 uLen[6];
  varying vec3 vPaint;
  varying vec3 vN;
  varying vec3 vNv;
  vec3 turn( vec3 p, vec3 k, float a ) { float c = cos( a ), s = sin( a ); return p * c + cross( k, p ) * s + k * dot( k, p ) * ( 1.0 - c ); }
  void main() {
    vPaint = paint;
    vec3 p = position, n = normal;
    int f = int( aBone.x + 0.5 );
    if ( f > 0 ) {
      // a digit: its three joints, the far ones first
      vec3 k = uAx[ f ], d = uDir[ f ], c = uCurl[ f ];
      vec3 j0 = uAt[ f ], j1 = j0 + d * uLen[ f ].x, j2 = j1 + d * uLen[ f ].y;
      if ( aBone.y > 1.5 ) { p = j2 + turn( p - j2, k, c.z ); n = turn( n, k, c.z ); }
      if ( aBone.y > 0.5 ) { p = j1 + turn( p - j1, k, c.y ); n = turn( n, k, c.y ); }
      p = j0 + turn( p - j0, k, c.x ); n = turn( n, k, c.x );
    }
    vN = normalize( mat3( modelMatrix ) * n );
    vNv = normalize( normalMatrix * n );
    gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
    gl_Position.z = -gl_Position.w + 0.02 * max( gl_Position.z + gl_Position.w, 0.0001 * gl_Position.w );
  }
`;
const FRAG = /* glsl */ `
  uniform vec3 uLight;
  uniform vec3 uBright;
  uniform vec3 uShade;
  varying vec3 vPaint;
  varying vec3 vN;
  varying vec3 vNv;
  void main() {
    float d = dot( normalize( vN ), uLight );
    // soft toon: the lit band, a warm shade, a deeper one on the far side; their edges a few degrees soft
    float lit = smoothstep( 0.1, 0.2, d ), deep = smoothstep( -0.36, -0.5, d );
    vec3 c = vPaint * mix( mix( uShade, vec3( 1.0 ), lit ), uShade * uShade, deep * 0.55 );
    // the blush where light turns to shade (skin and food glow a little there)
    float edge = smoothstep( 0.02, 0.15, d ) * ( 1.0 - smoothstep( 0.15, 0.34, d ) );
    c += vec3( 0.07, 0.012, 0.0 ) * edge * vPaint.r;
    // a pale rim, on the lit side
    float rim = pow( 1.0 - clamp( normalize( vNv ).z, 0.0, 1.0 ), 3.2 );
    c += vec3( 0.2, 0.18, 0.16 ) * rim * ( 0.35 + 0.65 * lit );
    gl_FragColor = vec4( c * uBright, 1.0 );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
function handMaterial() {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uLight: { value: new THREE.Vector3(-0.35, 0.85, 0.4).normalize() },
      uBright: { value: new THREE.Color(1, 1, 1) },
      uShade: { value: new THREE.Color(0.86, 0.69, 0.7) },         // warm: skin in shade is rose, not violet
      uCurl: { value: DIGITS.map(() => new THREE.Vector3()) },
      uAt: { value: DIGITS.map((D) => D?.at ?? new THREE.Vector3()) },
      uDir: { value: DIGITS.map((D) => D?.dir ?? new THREE.Vector3(0, 1, 0)) },
      uAx: { value: DIGITS.map((D) => D?.ax ?? new THREE.Vector3(1, 0, 0)) },
      uLen: { value: DIGITS.map((D) => (D ? new THREE.Vector3(...D.len) : new THREE.Vector3())) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  // the store's look scales `.color` of everything on its `lit` list
  m.color = m.uniforms.uBright.value;
  return m;
}

/* ------------------------------ the grip ------------------------------ */
const _p = v(0, 0, 0), _q = v(0, 0, 0), _j = [v(0, 0, 0), v(0, 0, 0), v(0, 0, 0), v(0, 0, 0)], _m = new THREE.Matrix4(), _box = new THREE.Box3();
/** Where digit D's joints and tip are, closed by `c` (0 open .. 1 shut), into _j (hand frame). */
function reachOf(D, c) {
  const a0 = D.flex[0] * c, a1 = D.flex[1] * c, a2 = D.flex[2] * c;
  _j[0].copy(D.at);
  _p.copy(D.dir).applyAxisAngle(D.ax, a0);
  _j[1].copy(_j[0]).addScaledVector(_p, D.len[0]);
  _p.copy(D.dir).applyAxisAngle(D.ax, a0 + a1);
  _j[2].copy(_j[1]).addScaledVector(_p, D.len[1]);
  _p.copy(D.dir).applyAxisAngle(D.ax, a0 + a1 + a2);
  _j[3].copy(_j[2]).addScaledVector(_p, D.len[2]);
  return _j;
}
/** How far point p (the held thing's own frame) is outside its box, or the cylinder standing in it if it is round. */
function outside(p, b, round) {
  const cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2, cz = (b.min.z + b.max.z) / 2;
  const hx = (b.max.x - b.min.x) / 2, hy = (b.max.y - b.min.y) / 2, hz = (b.max.z - b.min.z) / 2;
  const dy = Math.abs(p.y - cy) - hy;
  if (round) {
    const dr = Math.hypot((p.x - cx) / hx, (p.z - cz) / hz) * Math.min(hx, hz) - Math.min(hx, hz);
    return Math.max(dr, dy) > 0 ? Math.hypot(Math.max(dr, 0), Math.max(dy, 0)) : Math.max(dr, dy);
  }
  const dx = Math.abs(p.x - cx) - hx, dz = Math.abs(p.z - cz) - hz;
  return Math.max(dx, dy, dz) > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0)) : Math.max(dx, dy, dz);
}

export function makeHands(lit) {
  const view = new THREE.Group();
  view.name = 'hands';
  const skinMat = handMaterial();
  lit.push(skinMat);

  /* where the hand rests in the camera's frame, and how it is turned (as it always was: the back of the hand to
   * you, what it carries beyond it; the hand is drawn over what it carries, so its fingers read as lying across
   * the thing's front) */
  const rest = { pos: v(0.2, -0.108, -0.49), rot: new THREE.Euler(0.42, -2.3, 0.15, 'YXZ') };
  const pivot = new THREE.Group();
  pivot.name = 'hand-R';
  const mesh = new THREE.Mesh(rightHandGeometry(), skinMat);
  mesh.frustumCulled = false; mesh.renderOrder = 10;
  pivot.add(mesh);
  // where a held thing sits, turned to face you whatever the hand's turn
  const anchor = new THREE.Group();
  anchor.position.set(0.006, 0.036, 0.05);
  pivot.add(anchor);
  view.add(pivot);
  const R = { pivot, mesh, anchor, rest, off: v(0, 0, 0), turn: new THREE.Euler(0, 0, 0, 'XYZ'), eat: 0 };

  /* ------------------------------ state ------------------------------ */
  let up = 0, want = 0;          // 0 down out of view .. 1 raised
  let t = 0;
  const curl = DIGITS.map((D) => (D ? D.relax : 0)), seat = { z: 0 };
  /** What the hand holds: the first thing in the anchor that is drawn. */
  function heldThing() {
    for (const c of anchor.children) if (c.visible && c.isMesh && c.geometry?.attributes?.position?.count) return c;
    return null;
  }
  const _inv = new THREE.Matrix4(), _aq = new THREE.Quaternion(), _s = v(0, 0, 0);
  /** Close every digit on what is held (or relax them), and seat the palm against it. */
  function grip(dt) {
    const thing = heldThing();
    let b = null, round = false, scale = 1;
    if (thing) {
      if (!thing.geometry.boundingBox) thing.geometry.computeBoundingBox();
      b = thing.geometry.boundingBox;
      const sx = b.max.x - b.min.x, sz = b.max.z - b.min.z;
      round = Math.abs(sx - sz) < 0.3 * Math.max(sx, sz) && sx > 0.02;
      // hand frame -> the thing's own
      thing.updateMatrix();
      _m.compose(anchor.position, anchor.quaternion, _s.set(1, 1, 1)).multiply(thing.matrix);
      _inv.copy(_m).invert();
      scale = thing.scale.x || 1;
    }
    const touch = (p, r) => outside(_q.copy(p).applyMatrix4(_inv), b, round) * scale - r;
    /* the palm seats against it: its lowest point along the palm's normal comes to the palm's skin (carrying;
     * eating, the fingers pinch it and the palm stays back) */
    let seatTo = 0;
    if (b) {
      let low = Infinity;
      for (let i = 0; i < 8; i++) { _q.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(_m); if (Math.abs(_q.x) < 0.07 && _q.z < low) low = _q.z; }
      if (low < Infinity) seatTo = THREE.MathUtils.clamp(low - 0.016, -0.02, 0.014) * (1 - 0.7 * R.eat);
    }
    seat.z += (seatTo - seat.z) * Math.min(1, dt * 10);
    mesh.position.set(0, 0, seat.z);
    for (let id = 1; id <= 5; id++) {
      const D = DIGITS[id];
      let to = D.relax;
      if (b) {
        /* closed until it lies on the thing: of every curl that keeps the digit out of the thing, the tightest at
         * which its pad, middle joint or tip touches (else the one that comes nearest, if that is near at all);
         * if the thing leaves it no room, the curl that sinks least */
        let touchC = -1, nearC = -1, nearD = Infinity, least = 0, leastPen = -Infinity;
        for (let c = 0; c <= 1.0001; c += 1 / 16) {
          const j = reachOf(D, c);
          let pen = Infinity;
          for (let k = 1; k <= 3; k++) { _p.copy(j[k]); _p.z += seat.z; const sd = touch(_p, D.r[k]); if (sd < pen) pen = sd; }
          if (pen > leastPen) { leastPen = pen; least = c; }
          if (pen < -0.0025) continue;
          if (pen <= 0.004) touchC = c;
          if (pen < nearD) { nearD = pen; nearC = c; }
        }
        to = touchC >= 0 ? touchC : nearC >= 0 ? (nearD < 0.025 ? nearC : Math.max(D.relax, 0.5)) : least;
        /* carrying, the hand is drawn over the thing, so a finger never shows sunk in it: there it keeps at least
         * its easy curl across the thing's front; eating, the food is drawn in its true place among the fingers,
         * and only the touch counts */
        to = Math.max(to, D.relax * (1 - R.eat));
      }
      to += 0.012 * Math.sin(t * 1.3 + id * 1.7);          // never quite still
      curl[id] += (to - curl[id]) * Math.min(1, dt * 12);
      skinMat.uniforms.uCurl.value[id].set(D.flex[0] * curl[id], D.flex[1] * curl[id], D.flex[2] * curl[id]);
    }
  }

  const api = {
    view, R, skinMat,
    /** Where what you hold sits. */
    anchor,
    get up() { return up; },
    /** Raise (true) or lower (false) the hand. */
    raise(on) { want = on ? 1 : 0; },
    /** Put it straight up or down (dev shots). */
    snap(on) { want = up = on ? 1 : 0; },
    /** The hand's grip turn: its rest, blended by `h.eat` to palm-toward-you (eating). */
    grip(h, out) {
      out.setFromEuler(h.rest.rot);
      if (h.eat > 0) out.slerp(_qe.setFromEuler(EAT), h.eat);
      return out;
    },
    /** dev: how closed each digit is (0 open .. 1 shut), index to thumb. */
    get curls() { return curl.slice(1); },
    update(dt, bob = 0, camera = null) {
      t += dt;
      // rising pops up with a little overshoot; lowering is quicker and plain
      if (want > up) up = Math.min(1, up + dt / 0.55); else if (want < up) up = Math.max(0, up - dt / 0.4);
      const k = want ? easeBack(clamp01(up)) : ease(clamp01(up));
      pivot.position.copy(rest.pos).add(R.off);
      pivot.position.y += (1 - k) * -0.42 + Math.sin(bob) * 0.006 + Math.sin(t * 1.3 + 1) * 0.0025;
      pivot.position.x += Math.cos(bob * 0.5) * 0.004;
      // its grip (resting, or turned palm-to-you to eat), then `turn` in the
      // camera's own terms (x tips the top toward you)
      api.grip(R, _qr);
      pivot.quaternion.setFromEuler(_te.set(R.turn.x, R.turn.y, R.turn.z, 'XYZ')).multiply(_qr);
      pivot.visible = up > 0.001;
      // what the hand holds faces you, turned only by `turn`
      anchor.quaternion.copy(_qr).invert().multiply(_face);
      // the wrist's own small sway (after the anchor is set: what you hold stays put, the hand breathes round it)
      mesh.quaternion.setFromEuler(_te.set(0.012 * Math.sin(t * 0.9), 0, 0.016 * Math.sin(t * 0.7 + 1)));
      if (pivot.visible) grip(dt);
      // the key light for the painted hand stays over your shoulder as you turn
      if (camera) skinMat.uniforms.uLight.value.copy(_key).applyQuaternion(camera.quaternion).normalize();
    },
  };
  return api;
}
const _face = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, 0));
const _key = new THREE.Vector3(-0.45, 0.75, 0.55);
const _qr = new THREE.Quaternion(), _qe = new THREE.Quaternion(), _te = new THREE.Euler();
/* eating: the palm turned toward you, fingers up and leaning in, the food pinched before it */
const EAT = new THREE.Euler(-0.2, -0.3, 0.25, 'YXZ');
