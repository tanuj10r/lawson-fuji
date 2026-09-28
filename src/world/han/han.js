import * as THREE from 'three';
import { cel } from '../../core/toon.js';

/* ------------------------------------------------------------------ *
 * Han, as in the Tokyo Drift still Tan gave as the reference (2026-09-28):
 * a slim man of 1.78 m leaning back against the car's flank ahead of the
 * rear wheel, his weight on the car, legs out and crossed at the ankle,
 * arms folded low across his stomach, head a little forward; long dark
 * layered hair to the collar parted in the middle and framing a long,
 * high-cheekboned face; a dark navy zip jacket open over a grey-green
 * top, a thin pendant chain, loose olive cargo trousers bunched over
 * dark shoes.  Built in code, no photo; cel-shaded like the town but at
 * real proportions: the aim is a person, not a mannequin.
 *
 * Bone-free: a tree of pivots (pelvis, spine, chest, neck, head, the
 * arms and legs), each part a mesh hung from its pivot.  A pose is a
 * table of joint angles (POSES); han/index.js blends between them and
 * lays the small motions on top (breathing, the head turn, the nod).  He
 * faces +z in his own frame; his left is +x.
 *
 * Draws: parts are gathered per joint and kind (skin / cloth / hair) and
 * merged, colours per vertex: about 20 draws for the whole man.
 * ------------------------------------------------------------------ */

const C = {
  skin: 0xc48e68,
  skinShade: 0xac7856,
  hair: 0x1c1517,
  jacket: 0x252d48,
  jacketDark: 0x1c2238,
  tee: 0x7f8672,
  khaki: 0x8e8468,
  khakiDark: 0x7a7058,
  shoe: 0x2a2724,
  sole: 0x9c968a,
  chain: 0xd9dbe0,
  lip: 0xb07868,
};

/* Joint angles, radians.  L = his left (+x). */
export const POSES = {
  /* the still: hips on the car, legs out and crossed at the ankle, arms folded low */
  lean: {
    pelvisY: 0.865, pelvisX: -0.14, pelvisZ: 0.03, spineX: -0.1, chestX: -0.02, chestZ: 0.0, neckX: 0.16, headX: 0.12, headZ: 0.07,
    lShX: -0.14, lShZ: 0.16, lShY: 0.0, lElX: -1.62, lElY: -1.45, lHand: 1.1,
    rShX: -0.36, rShZ: -0.16, rShY: 0.0, rElX: -1.72, rElY: 1.45, rHand: 1.1,
    lHipX: -0.54, lHipZ: -0.19, lKnee: 0.02, lFoot: 0.5, lFootY: 0.35,
    rHipX: -0.48, rHipZ: 0.12, rKnee: 0.04, rFoot: 0.45, rFootY: -0.55,
  },
  /* standing, weight even, arms down */
  stand: {
    pelvisY: 0.97, pelvisX: 0, pelvisZ: 0, spineX: 0, chestX: 0.02, chestZ: 0, neckX: 0.02, headX: 0.04, headZ: 0,
    lShX: 0.05, lShZ: 0.1, lShY: 0, lElX: -0.25, lElY: 0, lHand: 0.1,
    rShX: 0.05, rShZ: -0.1, rShY: 0, rElX: -0.25, rElY: 0, rHand: 0.1,
    lHipX: 0, lHipZ: 0.03, lKnee: 0, lFoot: 0, lFootY: 0.1,
    rHipX: 0, rHipZ: -0.03, rKnee: 0, rFoot: 0, rFootY: -0.1,
  },
  /* in the driver's seat, hands on the wheel */
  seat: {
    pelvisY: 0.08, pelvisX: -0.1, pelvisZ: 0, spineX: -0.2, chestX: 0.02, chestZ: 0, neckX: 0.12, headX: 0.1, headZ: 0,
    lShX: -1.0, lShZ: 0.18, lShY: 0, lElX: -0.55, lElY: -0.3, lHand: 0.2,
    rShX: -1.0, rShZ: -0.18, rShY: 0, rElX: -0.55, rElY: 0.3, rHand: 0.2,
    lHipX: -1.45, lHipZ: 0.08, lKnee: 1.35, lFoot: -0.2, lFootY: 0,
    rHipX: -1.45, rHipZ: -0.08, rKnee: 1.35, rFoot: -0.2, rFootY: 0,
  },
};

const tmp = {};
export function blendPose(a, b, t, out = tmp) {
  for (const k in a) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

/* ------------------------------ geometry ------------------------------ */

const sm = THREE.MathUtils.smoothstep;
const TAU = Math.PI * 2;

/**
 * A tube of elliptical rings, top to bottom: rings [{ y, rx, rz, x, z }].
 * `fold(a, t, i)` scales the radius at angle a (0 = front, +z; rising
 * toward +x) and height fraction t: cloth folds are carved this way.
 */
function tube(rings, seg = 20, { fold = null, capTop = false, capBottom = false } = {}) {
  const pos = [], idx = [];
  const n = rings.length;
  for (let i = 0; i < n; i++) {
    const r = rings[i], t = i / (n - 1);
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * TAU;
      const k = fold ? fold(a, t, i) : 1;
      pos.push((r.x || 0) + Math.sin(a) * r.rx * k, r.y, (r.z || 0) + Math.cos(a) * r.rz * k);
    }
  }
  const W = seg + 1;
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * W + j, b = (i + 1) * W + j, c = (i + 1) * W + j + 1, d = i * W + j + 1;
    idx.push(a, b, c, a, c, d);
  }
  const cap = (i, up) => {
    const r = rings[i], ci = pos.length / 3;
    pos.push(r.x || 0, r.y, r.z || 0);
    for (let j = 0; j < seg; j++) {
      const a = i * W + j, b = i * W + j + 1;
      if (up) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  };
  if (capTop) cap(0, true);
  if (capBottom) cap(n - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A tapering tube along a polyline (hair strands): radius r0 at the root, r1 at the tip. */
function strand(pts, r0, r1, radial = 5) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.5);
  const N = Math.max(4, Math.round(pts.length * 2.5));
  const P = curve.getPoints(N);
  const pos = [], idx = [];
  const T = new THREE.Vector3(), Nn = new THREE.Vector3(), B = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(1, 0, 0);
  let prevN = null;
  for (let i = 0; i <= N; i++) {
    const p = P[i];
    T.subVectors(P[Math.min(N, i + 1)], P[Math.max(0, i - 1)]).normalize();
    if (!prevN) { Nn.crossVectors(T, Math.abs(T.y) > 0.9 ? side : up).normalize(); }
    else { Nn.copy(prevN).sub(T.clone().multiplyScalar(prevN.dot(T))).normalize(); }   // parallel transport
    prevN = Nn.clone();
    B.crossVectors(T, Nn).normalize();
    const u = i / N, r = r0 + (r1 - r0) * u;
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * TAU;
      pos.push(p.x + (Nn.x * Math.cos(a) + B.x * Math.sin(a)) * r, p.y + (Nn.y * Math.cos(a) + B.y * Math.sin(a)) * r, p.z + (Nn.z * Math.cos(a) + B.z * Math.sin(a)) * r);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < radial; j++) {
    const j1 = (j + 1) % radial;
    const a = i * radial + j, b = (i + 1) * radial + j, c = (i + 1) * radial + j1, d = i * radial + j1;
    idx.push(a, b, c, a, c, d);
  }
  // the tip closed
  const ci = pos.length / 3; pos.push(P[N].x, P[N].y, P[N].z);
  for (let j = 0; j < radial; j++) idx.push(N * radial + j, ci, N * radial + (j + 1) % radial);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------- the head ------------------------------- */
const HR = 0.098;                 // the head's base radius; shaped to 0.157 wide, 0.235 tall, 0.19 deep
/** The head's shape: long, a high wide cheekbone, a strong jaw narrowing to
 * the chin, a forehead sloping back, the skull long behind. */
function shapeHead(g, r) {
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = y / r;                                     // -1 chin .. 1 crown
    const front = sm(z, -0.2 * r, 0.5 * r);
    let sx = 0.8, sz = 0.95;
    sx *= 1 + 0.06 * Math.exp(-(((t + 0.05) / 0.2) ** 2)) * front;     // the cheekbones
    if (t < -0.1) sx *= 1 - 0.34 * ((-t - 0.1) / 0.9) ** 1.35;           // the jaw, to the chin
    if (t > 0.4) sx *= 1 - 0.1 * (t - 0.4);                              // the crown tapers
    if (t < -0.25) sz *= 1 - 0.16 * ((-t - 0.25) / 0.75) ** 1.5 * (z > 0 ? 0.6 : 1);   // the jaw under the ears
    if (z > 0 && t > 0.45) sz *= 1 - 0.12 * (t - 0.45);                  // the forehead slopes back
    if (z < 0) sz *= 1.05;                                               // the skull behind
    x *= sx; z *= sz; y *= 1.2;
    if (t < -0.6 && z > 0) z += 0.016 * (-t - 0.6) / 0.4;                // the chin comes forward
    if (z > 0 && t > -0.35 && t < 0.15) z -= 0.006 * front;              // under the cheekbone, the face is a plane
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/** Faces are lit as one plane in cel: bend the front's normals toward straight
 * ahead so the band doesn't cut across the cheek. */
function flatFace(g) {
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  const v = new THREE.Vector3(), f = new THREE.Vector3(0, 0.12, 1).normalize();
  for (let i = 0; i < n.count; i++) {
    const w = sm(p.getZ(i), -0.01, 0.06) * 0.8;
    v.set(n.getX(i), n.getY(i), n.getZ(i)).lerp(f, w).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  n.needsUpdate = true;
}

/** The face, painted over the front of the head: brows, eyes, the nose's
 * shadow, the mouth, stubble and a goatee.  Sung Kang's calm, level look. */
function faceTex() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  // phi across [PI/2 - 0.95, PI/2 + 0.95] -> x; theta [0.45, 2.45] -> y
  const X = (u) => S * u, Y = (th) => ((th - 0.45) / 2.0) * S;
  const eyeY = Y(1.56), browY = Y(1.4), noseY = Y(1.88), mouthY = Y(2.1);
  // the sockets and the bridge: soft shading that gives the face a middle
  g.fillStyle = 'rgba(120,70,60,0.14)';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(X(0.5 + s * 0.2), eyeY - 1, S * 0.085, S * 0.04, 0, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(120,70,60,0.1)';
  g.beginPath(); g.ellipse(X(0.5), Y(1.72), S * 0.028, S * 0.09, 0, 0, TAU); g.fill();
  // stubble: a shadow over the jaw and upper lip; the goatee darker under the lip
  g.fillStyle = 'rgba(70,45,45,0.16)';
  g.beginPath(); g.ellipse(X(0.5), Y(2.24), S * 0.13, S * 0.075, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(60,38,40,0.5)';
  g.beginPath(); g.moveTo(X(0.455), Y(2.16)); g.lineTo(X(0.545), Y(2.16)); g.lineTo(X(0.53), Y(2.32)); g.lineTo(X(0.47), Y(2.32)); g.closePath(); g.fill();
  g.fillStyle = 'rgba(60,38,40,0.35)';
  g.beginPath(); g.ellipse(X(0.5), Y(2.02), S * 0.065, 2.4, 0, 0, TAU); g.fill();
  // brows: thick, straight, dark, close over the eyes
  g.strokeStyle = '#1a1012'; g.lineCap = 'round'; g.lineWidth = 9;
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(X(0.5 + s * 0.08), browY + 3); g.lineTo(X(0.5 + s * 0.22), browY - 1); g.lineTo(X(0.5 + s * 0.3), browY + 2); g.stroke();
  }
  // eyes: long and narrow, a heavy upper lid, the dark iris half under it, a small light
  for (const s of [-1, 1]) {
    const cx = X(0.5 + s * 0.2), w = S * 0.082;
    g.fillStyle = '#efe6e0';
    g.save();
    g.beginPath(); g.moveTo(cx - w, eyeY + 1); g.quadraticCurveTo(cx, eyeY - 7, cx + w, eyeY - 1); g.quadraticCurveTo(cx, eyeY + 7, cx - w, eyeY + 1); g.closePath(); g.fill(); g.clip();
    g.fillStyle = '#241a1a';
    g.beginPath(); g.ellipse(cx + s * 1.5, eyeY, 7.5, 7.5, 0, 0, TAU); g.fill();
    g.fillStyle = '#000';
    g.beginPath(); g.ellipse(cx + s * 1.5, eyeY, 3, 3, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(cx + s * 1.5 - 2, eyeY - 2, 1.5, 0, TAU); g.fill();
    g.restore();
    g.strokeStyle = '#100a0c'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx - w - 2, eyeY + 1); g.quadraticCurveTo(cx, eyeY - 8, cx + w + 2, eyeY - 1); g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(60,35,35,0.7)';
    g.beginPath(); g.moveTo(cx - w * 0.8, eyeY + 5); g.quadraticCurveTo(cx, eyeY + 8, cx + w * 0.9, eyeY + 4); g.stroke();
    // the fold above the lid
    g.strokeStyle = 'rgba(110,65,60,0.35)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - w * 0.7, eyeY - 8); g.quadraticCurveTo(cx, eyeY - 13, cx + w * 0.8, eyeY - 8); g.stroke();
  }
  // the nose: its shadow down one side and under the tip (the tip itself is a mesh)
  g.strokeStyle = 'rgba(110,55,45,0.7)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(X(0.478), Y(1.62)); g.quadraticCurveTo(X(0.462), Y(1.78), X(0.47), noseY); g.stroke();
  g.fillStyle = 'rgba(110,60,50,0.4)';
  g.beginPath(); g.ellipse(X(0.5), noseY + 3, S * 0.035, 3, 0, 0, TAU); g.fill();
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(X(0.5 + s * 0.035), noseY, 3, 2.2, 0, 0, TAU); g.fill(); }
  // the mouth: level, closed, the lower lip a little fuller; a slight lift at his left
  g.strokeStyle = '#5a2e2c'; g.lineWidth = 3.2;
  g.beginPath(); g.moveTo(X(0.425), mouthY + 1); g.quadraticCurveTo(X(0.5), mouthY + 3, X(0.575), mouthY - 2); g.stroke();
  g.fillStyle = 'rgba(150,90,85,0.45)';
  g.beginPath(); g.moveTo(X(0.43), mouthY + 2); g.quadraticCurveTo(X(0.5), mouthY + 11, X(0.57), mouthY); g.quadraticCurveTo(X(0.5), mouthY + 4, X(0.43), mouthY + 2); g.fill();
  // cheek shading below the bone
  g.fillStyle = 'rgba(160,95,85,0.1)';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(X(0.5 + s * 0.27), Y(1.85), S * 0.05, S * 0.03, 0, 0, TAU); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Hair: a scalp shell cut at the hairline, and tapered strands from a
 * centre part falling over the skull, past the ears to the jaw in front
 * and the collar behind, the ends layered.  Head frame, centred on the head. */
function hairParts(r) {
  const parts = [];
  const RX = r * 0.8 * 1.06, RY = r * 1.2 * 1.05, RZ = r * 0.95 * 1.06;
  // the shell: every vertex below the hairline is pulled up onto it
  const shell = new THREE.SphereGeometry(1, 30, 20);
  const p = shell.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let th = Math.acos(THREE.MathUtils.clamp(y, -1, 1));
    const d = Math.atan2(x, z), ad = Math.abs(d);         // 0 at the front
    // the hairline: high on the forehead, down at the temples, low behind
    let hl = 0.96 + 0.3 * sm(ad, 0.4, 1.0) + 0.8 * sm(ad, 1.0, 2.3);
    hl += 0.04 * Math.sin(d * 9.0) * sm(ad, 0.1, 0.6);        // the edge breaks up into points
    if (th > hl) th = hl;
    const st = Math.sin(th), ct = Math.cos(th);
    const k = Math.hypot(x, z) || 1;
    // the centre part: a shallow groove along the top
    const part = 1 - 0.03 * Math.exp(-((x / 0.08) ** 2)) * sm(z, -0.6, 0.2) * sm(ct, 0.3, 0.9);
    p.setXYZ(i, (x / k) * st * RX * part, ct * RY * part + 0.004, (z / k) * st * RZ * part);
  }
  shell.computeVertexNormals();
  parts.push(shell);
  // strands: from the part, over the skull, down.  side s, azimuth phi of the
  // root along the part (0 front .. 1 crown), the hang length below the ear line
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const onHead = (th, az, out = 0) => [Math.sin(th) * Math.sin(az) * (RX + out), Math.cos(th) * (RY + out), Math.sin(th) * Math.cos(az) * (RZ + out)];
  const add = (s, az0, az1, len, r0, flare) => {
    const pts = [];
    // over the skull: polar angle from near the part down to the ear line, the azimuth drifting back
    for (let k = 0; k <= 5; k++) {
      const u = k / 5, th = 0.22 + u * 1.15, az = az0 + (az1 - az0) * u;
      pts.push(onHead(th, s * az, 0.004 + 0.009 * u));
    }
    // then hanging: slightly out and back, to the length
    const [ex, ey, ez] = pts[pts.length - 1];
    const dx = ex / Math.hypot(ex, ez), dz = ez / Math.hypot(ex, ez);
    for (let k = 1; k <= 3; k++) {
      const u = k / 3;
      pts.push([ex + dx * flare * u * u, ey - len * u, ez + dz * flare * u * u - 0.01 * u]);
    }
    parts.push(strand(pts, r0, r0 * 0.35));
  };
  for (const s of [-1, 1]) {
    // the front: framing the face, to the jaw
    // the fringe: from the part down over the corners of the forehead, to the cheekbone
    add(s, 0.06, 0.55, 0.05 + rnd() * 0.02, 0.012, 0.006);
    add(s, 0.1, 0.7, 0.07 + rnd() * 0.02, 0.012, 0.008);
    add(s, 0.12, 0.9, 0.1 + rnd() * 0.02, 0.013, 0.012);
    add(s, 0.18, 1.1, 0.11 + rnd() * 0.02, 0.014, 0.015);
    add(s, 0.26, 1.3, 0.12, 0.014, 0.018);
    add(s, 0.36, 1.5, 0.125, 0.013, 0.02);
    // the sides, over the ear
    for (let i = 0; i < 12; i++) {
      const a0 = 0.45 + i * 0.14 + rnd() * 0.06;
      add(s, a0, a0 + 0.9 + rnd() * 0.3, 0.12 + rnd() * 0.04, 0.011 + rnd() * 0.003, 0.014 + rnd() * 0.012);
    }
    // the back, to the collar
    for (let i = 0; i < 9; i++) {
      const a0 = 2.15 + i * 0.12 + rnd() * 0.06;
      add(s, a0, Math.min(3.1, a0 + 0.6 + rnd() * 0.4), 0.14 + rnd() * 0.04, 0.013, 0.01);
    }
  }
  return parts;
}

/* ------------------------------ the figure ------------------------------ */

export function makeHan() {
  const J = {};
  const root = new THREE.Group();
  root.name = 'han';
  const node = (name, parent, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.name = 'han-' + name;
    g.position.set(x, y, z);
    parent.add(g);
    J[name] = g;
    return g;
  };
  /* Parts are gathered per joint and kind and drawn as one mesh each,
   * their colours per vertex. */
  const buckets = new Map();
  const mesh = (parent, geo, hex, kind = 'cloth') => {
    const key = parent.uuid + kind;
    if (!buckets.has(key)) buckets.set(key, { parent, kind, list: [] });
    buckets.get(key).list.push({ geo, color: new THREE.Color(hex) });
  };
  // cloth folds: soft vertical ridges, stronger where `w(t)` says
  const ridges = (n, amp, w = () => 1, ph = 0) => (a, t) => 1 + amp * w(t) * Math.sin(a * n + ph) * (0.6 + 0.4 * Math.sin(a * (n - 1) * 0.5 + 1.3));

  const pelvis = node('pelvis', root, 0, 0.97, 0);
  /* the hips and the seat of the trousers, the waistband under the jacket */
  {
    const hips = tube([
      { y: 0.1, rx: 0.15, rz: 0.1 }, { y: 0.04, rx: 0.165, rz: 0.115 }, { y: -0.04, rx: 0.17, rz: 0.125, z: -0.008 },
      { y: -0.1, rx: 0.16, rz: 0.12 }, { y: -0.14, rx: 0.14, rz: 0.1 },
    ], 22, { capTop: true, capBottom: true, fold: ridges(7, 0.012, (t) => sm(t, 0.3, 1)) });
    mesh(pelvis, hips, C.khaki);
    const belt = new THREE.TorusGeometry(0.152, 0.012, 6, 28);
    belt.rotateX(Math.PI / 2); belt.scale(1, 1, 0.68); belt.translate(0, 0.1, 0);
    mesh(pelvis, belt, C.shoe);
  }
  const spine = node('spine', pelvis, 0, 0.08, 0);
  const chest = node('chest', spine, 0, 0.12, 0);
  {
    // the top under the open jacket: from the collarbones down over the stomach to the belt
    const tee = tube([
      { y: 0.36, rx: 0.075, rz: 0.06 }, { y: 0.33, rx: 0.13, rz: 0.085 }, { y: 0.26, rx: 0.16, rz: 0.1 }, { y: 0.14, rx: 0.155, rz: 0.1 },
      { y: 0.0, rx: 0.145, rz: 0.095 }, { y: -0.12, rx: 0.145, rz: 0.098 }, { y: -0.2, rx: 0.15, rz: 0.1 },
    ], 22, { capTop: true, capBottom: true, fold: ridges(6, 0.01, (t) => sm(t, 0.4, 1), 0.4) });
    mesh(chest, tee, C.tee);
    // the jacket: open down the front, loose over the hips, a zip placket either side
    const OPEN = 0.3;   // half-angle of the opening at the front: a hand's width of the top shows
    const jk = (() => {
      const rings = [
        { y: 0.39, rx: 0.135, rz: 0.1, z: -0.005 }, { y: 0.35, rx: 0.19, rz: 0.125 }, { y: 0.3, rx: 0.205, rz: 0.135 }, { y: 0.2, rx: 0.2, rz: 0.135 },
        { y: 0.08, rx: 0.19, rz: 0.13 }, { y: -0.05, rx: 0.185, rz: 0.13 }, { y: -0.16, rx: 0.19, rz: 0.135 }, { y: -0.24, rx: 0.195, rz: 0.14 },
      ];
      const seg = 30;
      const pos = [], idx = [];
      const n = rings.length;
      for (let i = 0; i < n; i++) {
        const r = rings[i], t = i / (n - 1);
        for (let j = 0; j <= seg; j++) {
          const a = OPEN + (TAU - 2 * OPEN) * (j / seg);              // from one edge of the opening round the back to the other
          // folds: soft ridges, gathering toward the hem; the cloth pulled at the folded arms' height
          const k = 1 + 0.018 * (0.5 + 0.5 * sm(t, 0.3, 1)) * Math.sin(a * 6 + 0.8) * (0.7 + 0.3 * Math.sin(a * 2.5 + 2.0))
            + 0.01 * Math.exp(-(((t - 0.62) / 0.12) ** 2)) * Math.sin(a * 3 + 1.5);
          pos.push((r.x || 0) + Math.sin(a) * r.rx * k, r.y, (r.z || 0) + Math.cos(a) * r.rz * k);
        }
      }
      const W = seg + 1;
      for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
        const a = i * W + j, b = (i + 1) * W + j, c = (i + 1) * W + j + 1, d = i * W + j + 1;
        idx.push(a, b, c, a, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    })();
    mesh(chest, jk, C.jacket);
    // the collar: a stand collar round the neck, open at the front
    const col = tube([{ y: 0.46, rx: 0.088, rz: 0.078, z: -0.01 }, { y: 0.38, rx: 0.1, rz: 0.088, z: -0.01 }], 22, {
      fold: (a) => (Math.abs(((a + Math.PI) % TAU) - Math.PI) < 0.55 ? 0.001 : 1),
    });
    mesh(chest, col, C.jacketDark);
    // the chain, a thin loop lying on the top, and its pendant
    const ch = new THREE.TorusGeometry(0.075, 0.004, 5, 30, Math.PI);
    ch.rotateZ(Math.PI); ch.rotateX(-1.25);
    ch.translate(0, 0.33, 0.06);
    mesh(chest, ch, C.chain, 'skin');
    const pend = new THREE.CylinderGeometry(0.006, 0.006, 0.022, 8);
    pend.translate(0, 0.255, 0.102);
    mesh(chest, pend, C.chain, 'skin');
  }
  const neck = node('neck', chest, 0, 0.345, 0.0);
  const head = node('head', neck, 0, 0.055, 0.01);
  {
    // the neck, drawn with the head (it turns with it)
    const nk = tube([{ y: 0.03, rx: 0.052, rz: 0.05 }, { y: -0.06, rx: 0.056, rz: 0.056, z: -0.004 }, { y: -0.13, rx: 0.07, rz: 0.062, z: -0.01 }], 16, { capBottom: true });
    mesh(head, nk, C.skinShade, 'skin');
    const hg = shapeHead(new THREE.SphereGeometry(HR, 28, 22), HR);
    hg.translate(0, HR * 1.05, 0);
    flatFace(hg);
    mesh(head, hg, C.skin, 'skin');
    // the face patch: the same shape a hair's breadth larger, over the front only
    const fg = shapeHead(new THREE.SphereGeometry(HR * 1.012, 24, 18, Math.PI / 2 - 0.95, 1.9, 0.45, 2.0), HR * 1.012);
    const uv = fg.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));   // the patch's phi runs from +x round to -x: flip u so the texture reads as seen
    fg.translate(0, HR * 1.05, 0);
    flatFace(fg);
    const face = new THREE.Mesh(fg, cel({ color: 0xffffff, map: faceTex(), transparent: true, bands: 'soft3', tint: 0xb07a8a, flat: false, depthWrite: false }));
    face.renderOrder = 1;
    face.userData.noOutline = true;
    head.add(face);
    // the nose: a bridge and a tip standing off the face
    const tip = new THREE.SphereGeometry(0.0135, 10, 8);
    tip.scale(1.1, 0.85, 1); tip.translate(0, HR * 1.05 - 0.018, HR * 0.95 * 0.99 + 0.006);
    mesh(head, tip, C.skin, 'skin');
    const bridge = new THREE.CapsuleGeometry(0.0075, 0.026, 3, 8);
    bridge.rotateX(-0.3); bridge.translate(0, HR * 1.05 + 0.002, HR * 0.95 * 0.99 - 0.002);
    mesh(head, bridge, C.skinShade, 'skin');
    // ears, mostly under the hair
    for (const s of [-1, 1]) {
      const e = new THREE.SphereGeometry(0.024, 10, 8);
      e.scale(0.45, 1.1, 0.8); e.translate(s * HR * 0.8 * 0.96, HR * 1.05 - 0.01, -0.012);
      mesh(head, e, C.skinShade, 'skin');
    }
    for (const h of hairParts(HR)) { h.translate(0, HR * 1.05, 0); mesh(head, h, C.hair, 'hair'); }
  }
  /* arms: the sleeves loose, a bend crease at the elbow, cuffs at the wrist, the hands */
  const arm = (side) => {
    const s = side === 'l' ? 1 : -1;
    const sh = node(side + 'Sh', chest, s * 0.2, 0.29, -0.005);
    sh.rotation.order = 'ZXY';
    const cap = new THREE.SphereGeometry(0.07, 14, 10);
    cap.scale(1.05, 0.9, 0.95); cap.translate(0, -0.01, 0);
    mesh(sh, cap, C.jacket);
    const upper = tube([{ y: -0.01, rx: 0.068, rz: 0.066 }, { y: -0.13, rx: 0.062, rz: 0.062 }, { y: -0.26, rx: 0.058, rz: 0.058 }, { y: -0.34, rx: 0.056, rz: 0.056 }], 16,
      { capBottom: true, fold: ridges(5, 0.02, (t) => sm(t, 0.4, 1), 0.7) });
    mesh(sh, upper, C.jacket);
    const el = node(side + 'El', sh, 0, -0.33, 0);
    el.rotation.order = 'YXZ';
    const fore = tube([{ y: 0.02, rx: 0.056, rz: 0.056 }, { y: -0.08, rx: 0.052, rz: 0.052 }, { y: -0.18, rx: 0.046, rz: 0.046 }, { y: -0.245, rx: 0.042, rz: 0.04 }], 14,
      { capTop: true, capBottom: true, fold: ridges(5, 0.018, (t) => 1 - 0.6 * t, 2.1) });
    mesh(el, fore, C.jacket);
    const cuff = new THREE.CylinderGeometry(0.037, 0.04, 0.03, 14);
    cuff.translate(0, -0.26, 0);
    mesh(el, cuff, C.jacketDark);
    // the hand, cupped: palm, four fingers together, the thumb
    const hand = node(side + 'Hand', el, 0, -0.275, 0);
    const palm = new THREE.SphereGeometry(0.036, 12, 8);
    palm.scale(0.95, 1.3, 0.5); palm.translate(0, -0.03, 0.004);
    mesh(hand, palm, C.skin, 'skin');
    for (let i = 0; i < 4; i++) {
      const f = new THREE.CapsuleGeometry(0.0085, 0.036 - Math.abs(i - 1.2) * 0.005, 3, 7);
      f.rotateX(0.9); f.translate(s * (-0.024 + i * 0.016), -0.072, 0.02);
      mesh(hand, f, C.skin, 'skin');
    }
    const thumb = new THREE.CapsuleGeometry(0.009, 0.032, 3, 7);
    thumb.rotateZ(s * 0.9); thumb.rotateX(0.5); thumb.translate(s * 0.035, -0.04, 0.012);
    mesh(hand, thumb, C.skin, 'skin');
  };
  arm('l'); arm('r');
  /* legs: loose cargo trousers, a pocket on each thigh, the hems bunched over the shoes */
  const leg = (side) => {
    const s = side === 'l' ? 1 : -1;
    const hip = node(side + 'Hip', pelvis, s * 0.09, -0.03, 0);
    const thigh = tube([{ y: 0.03, rx: 0.095, rz: 0.1 }, { y: -0.12, rx: 0.098, rz: 0.1 }, { y: -0.28, rx: 0.092, rz: 0.095 }, { y: -0.42, rx: 0.086, rz: 0.088 }, { y: -0.47, rx: 0.082, rz: 0.084 }], 18,
      { capTop: true, capBottom: true, fold: ridges(6, 0.02, (t) => 0.4 + 0.6 * sm(t, 0.3, 1), s * 0.9) });
    mesh(hip, thigh, C.khaki);
    // the cargo pocket, on the outside of the thigh, with its flap
    const pk = new THREE.BoxGeometry(0.03, 0.15, 0.13, 1, 2, 2);
    pk.translate(s * 0.095, -0.27, 0.01);
    mesh(hip, pk, C.khaki);
    const flap = new THREE.BoxGeometry(0.034, 0.04, 0.135);
    flap.translate(s * 0.096, -0.2, 0.01);
    mesh(hip, flap, C.khakiDark);
    const knee = node(side + 'Knee', hip, 0, -0.44, 0);
    const shin = tube([{ y: 0.03, rx: 0.084, rz: 0.086 }, { y: -0.12, rx: 0.088, rz: 0.09 }, { y: -0.26, rx: 0.09, rz: 0.094 }, { y: -0.36, rx: 0.094, rz: 0.1 }, { y: -0.42, rx: 0.1, rz: 0.105 }], 18,
      { capTop: true, capBottom: true, fold: ridges(7, 0.03, (t) => 0.3 + 0.7 * sm(t, 0.5, 1), s * 1.7) });
    mesh(knee, shin, C.khaki);
    // the hem, bunched: a heavier ring of folds sitting on the shoe
    const hem = tube([{ y: -0.4, rx: 0.098, rz: 0.104 }, { y: -0.44, rx: 0.104, rz: 0.11 }, { y: -0.47, rx: 0.098, rz: 0.104 }], 18,
      { capBottom: true, fold: ridges(8, 0.05, () => 1, s * 0.3) });
    mesh(knee, hem, C.khakiDark);
    const ankle = node(side + 'Foot', knee, 0, -0.43, 0);
    ankle.rotation.order = 'YXZ';
    // a low dark trainer: the upper a long rounded shape, a toe cap, the sole
    const shoe = new THREE.SphereGeometry(0.05, 14, 10);
    shoe.scale(0.95, 0.75, 2.5); shoe.translate(0, -0.03, 0.075);
    mesh(ankle, shoe, C.shoe);
    const heel = new THREE.SphereGeometry(0.048, 12, 8);
    heel.scale(0.9, 1.0, 0.9); heel.translate(0, -0.015, -0.02);
    mesh(ankle, heel, C.shoe);
    const sole = new THREE.BoxGeometry(0.1, 0.028, 0.29, 1, 1, 3);
    { const p = sole.getAttribute('position'); for (let i = 0; i < p.count; i++) { const z = p.getZ(i); if (z > 0.1) p.setX(i, p.getX(i) * 0.85); } }
    sole.translate(0, -0.064, 0.075);
    mesh(ankle, sole, C.sole);
  };
  leg('l'); leg('r');

  const skinMat = cel({ color: 0xffffff, bands: 'soft3', tint: 0xb07a8a, flat: false, vertexColors: true });
  const clothMat = cel({ color: 0xffffff, bands: 4, tint: 0x5a5480, flat: false, vertexColors: true, side: THREE.DoubleSide });
  const hairMat = cel({ color: 0xffffff, bands: 3, tint: 0x4a4068, flat: false, vertexColors: true, side: THREE.DoubleSide });
  for (const b of buckets.values()) {
    const geos = b.list.map(({ geo, color }) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      const n = g.getAttribute('position').count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      return g;
    });
    let n = 0;
    for (const g of geos) n += g.getAttribute('position').count;
    const out = new THREE.BufferGeometry();
    for (const [k, size] of [['position', 3], ['normal', 3], ['color', 3]]) {
      const arr = new Float32Array(n * size);
      let o = 0;
      for (const g of geos) { arr.set(g.getAttribute(k).array, o * size); o += g.getAttribute('position').count; }
      out.setAttribute(k, new THREE.BufferAttribute(arr, size));
    }
    const m = new THREE.Mesh(out, b.kind === 'skin' ? skinMat : b.kind === 'hair' ? hairMat : clothMat);
    m.castShadow = b.kind !== 'skin';       // the face and neck sit in the hair's and jacket's shadow anyway
    b.parent.add(m);
  }

  const apply = (p) => {
    J.pelvis.position.y = p.pelvisY;
    J.pelvis.rotation.set(p.pelvisX, 0, p.pelvisZ);
    J.spine.rotation.set(p.spineX, 0, 0);
    J.chest.rotation.x = p.chestX;
    J.chest.rotation.z = p.chestZ;
    J.neck.rotation.x = p.neckX;
    J.head.rotation.x = p.headX;
    J.head.rotation.z = p.headZ;
    J.lSh.rotation.set(p.lShX, p.lShY, p.lShZ);
    J.rSh.rotation.set(p.rShX, p.rShY, p.rShZ);
    J.lEl.rotation.set(p.lElX, p.lElY, 0);
    J.rEl.rotation.set(p.rElX, p.rElY, 0);
    // the wrist bends toward the body (the elbow's YXZ frame puts the body at local -x for the left arm, +x for the right)
    J.lHand.rotation.set(0, 0, -p.lHand);
    J.rHand.rotation.set(0, 0, p.rHand);
    J.lHip.rotation.set(p.lHipX, 0, p.lHipZ);
    J.rHip.rotation.set(p.rHipX, 0, p.rHipZ);
    J.lKnee.rotation.x = p.lKnee;
    J.rKnee.rotation.x = p.rKnee;
    J.lFoot.rotation.set(p.lFoot, p.lFootY, 0);
    J.rFoot.rotation.set(p.rFoot, p.rFootY, 0);
  };
  apply(POSES.lean);
  return { group: root, joints: J, apply };
}
