import * as THREE from 'three';
import { cel } from '../../core/toon.js';

/* ------------------------------------------------------------------ *
 * Han, as in Tokyo Drift (Tan: recognisably him, in our cel style,
 * built in code, no photo): a long oval face with high cheekbones,
 * narrow calm eyes under straight brows, light stubble and a goatee,
 * the half-smile; shoulder-length shaggy dark hair with a side part
 * falling round the face; a dark navy jacket open over a grey-olive
 * crew-neck, a chain, loose khaki cargo trousers, dark trainers.
 *
 * Bone-free: a tree of pivots (pelvis, spine, chest, neck, head, the
 * arms and legs), each limb a mesh hung from its pivot.  A pose is a
 * table of joint angles (POSES); han/index.js blends between them and
 * lays the small motions on top (breathing, the head turn, the nod, a
 * walk cycle).  He faces +z in his own frame; his left is +x.
 * ------------------------------------------------------------------ */

const C = {
  skin: 0xe6b48f,
  hair: 0x2a2229,
  jacket: 0x2d3552,
  tee: 0x8c8c78,
  khaki: 0xc3ab80,
  shoe: 0x2c2b33,
  sole: 0xe9e4d8,
  chain: 0xdfe2ea,
};

/* Joint angles, radians.  L = his left (+x). */
export const POSES = {
  /* leaning back on the car's rear quarter, arms crossed, ankles crossed */
  lean: {
    pelvisY: 0.82, pelvisZ: 0.02, pelvisX: 0, spineX: -0.3, chestX: 0.08, headX: 0.16, headZ: 0.05,
    lShX: -0.3, lShZ: 0.2, lElX: -1.95, lElY: -1.18, rShX: -0.36, rShZ: -0.2, rElX: -2.0, rElY: 1.22,
    lHipX: -0.5, lHipZ: -0.17, lKnee: 0.04, lFoot: 0.5, rHipX: -0.42, rHipZ: 0.09, rKnee: 0.1, rFoot: 0.4,
  },
  /* standing, weight even, arms down */
  stand: {
    pelvisY: 0.93, pelvisZ: 0, pelvisX: 0, spineX: 0, chestX: 0.02, headX: 0.04, headZ: 0,
    lShX: 0.05, lShZ: 0.1, lElX: -0.2, lElY: 0, rShX: 0.05, rShZ: -0.1, rElX: -0.2, rElY: 0,
    lHipX: 0, lHipZ: 0.02, lKnee: 0, lFoot: 0, rHipX: 0, rHipZ: -0.02, rKnee: 0, rFoot: 0,
  },
  /* in the driver's seat, hands on the wheel */
  seat: {
    pelvisY: 0.0, pelvisZ: 0, pelvisX: 0, spineX: -0.3, chestX: 0.05, headX: 0.22, headZ: 0,
    lShX: -1.0, lShZ: 0.18, lElX: -0.55, lElY: -0.3, rShX: -1.0, rShZ: -0.18, rElX: -0.55, rElY: 0.3,
    lHipX: -1.45, lHipZ: 0.08, lKnee: 1.35, lFoot: -0.2, rHipX: -1.45, rHipZ: -0.08, rKnee: 1.35, rFoot: -0.2,
  },
};

const tmp = {};
export function blendPose(a, b, t, out = tmp) {
  for (const k in a) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

function capsule(r, len, mat, seg = 12) {
  const g = new THREE.CapsuleGeometry(r, len, 4, seg);
  g.translate(0, -len / 2 - r * 0.6, 0);        // hangs down from its pivot
  return new THREE.Mesh(g, mat);
}

/** The head's shape: a long oval with high cheekbones and a narrower jaw. */
function shapeHead(g, r) {
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = y / r;
    const cheek = 1 + 0.07 * Math.exp(-(((t + 0.05) / 0.25) ** 2));
    const jaw = t < 0 ? 1 - 0.26 * (-t) ** 1.6 : 1;
    x *= 0.93 * cheek * jaw;
    z *= 1.0 * (t < 0 ? 1 - 0.12 * (-t) ** 2 : 1);
    y *= 1.2;
    if (t < -0.55 && z > 0) z += 0.012 * (-t - 0.55);    // the chin, forward a little
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/** The face, drawn over the front of the head (eyes, brows, the smile, stubble). */
function faceTex() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  // phi across [PI/2 - 0.95, PI/2 + 0.95] -> x; theta [0.45, 2.45] -> y
  const X = (u) => S * u, Y = (th) => ((th - 0.45) / 2.0) * S;
  const eyeY = Y(1.58), browY = Y(1.4), noseY = Y(1.86), mouthY = Y(2.05);
  // stubble: the faintest shadow round the chin; a small goatee under the lip, a thin moustache
  g.fillStyle = 'rgba(90,62,62,0.1)';
  g.beginPath(); g.ellipse(X(0.5), Y(2.18), S * 0.085, S * 0.05, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(48,32,36,0.55)';
  g.beginPath(); g.moveTo(X(0.47), Y(2.12)); g.lineTo(X(0.53), Y(2.12)); g.lineTo(X(0.515), Y(2.25)); g.lineTo(X(0.485), Y(2.25)); g.closePath(); g.fill();
  g.fillStyle = 'rgba(48,32,36,0.35)';
  g.beginPath(); g.ellipse(X(0.5), Y(1.985), S * 0.055, 2.2, 0, 0, Math.PI * 2); g.fill();
  // brows: straight, dark, a little heavy
  g.strokeStyle = '#231a1e'; g.lineCap = 'round';
  for (const s of [-1, 1]) {
    g.lineWidth = 8;
    g.beginPath(); g.moveTo(X(0.5 + s * 0.07), browY + 2); g.lineTo(X(0.5 + s * 0.27), browY - 1); g.stroke();
  }
  // eyes: narrow, heavy upper lids, dark irises half hidden, one small light
  for (const s of [-1, 1]) {
    const cx = X(0.5 + s * 0.17), w = S * 0.085;
    g.fillStyle = '#f4ece6';
    g.save();
    g.beginPath(); g.ellipse(cx, eyeY + 1, w, 5.5, 0, 0, Math.PI * 2); g.fill(); g.clip();
    g.fillStyle = '#2a1c1c';
    g.beginPath(); g.ellipse(cx + s * 2, eyeY + 1, 8, 8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(cx + s * 2 - 2, eyeY - 1, 1.8, 0, Math.PI * 2); g.fill();
    g.restore();
    g.strokeStyle = '#1b1216'; g.lineWidth = 7;
    g.beginPath(); g.moveTo(cx - w - 1, eyeY + 1); g.quadraticCurveTo(cx, eyeY - 8, cx + w + 1, eyeY - 1 - s * 1.5); g.stroke();
    g.lineWidth = 1.4; g.strokeStyle = 'rgba(40,24,28,0.7)';
    g.beginPath(); g.moveTo(cx - w * 0.7, eyeY + 6); g.quadraticCurveTo(cx, eyeY + 8, cx + w * 0.8, eyeY + 5); g.stroke();
  }
  // nose: a line down one side and the tip's shadow
  g.strokeStyle = 'rgba(150,90,80,0.8)'; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(X(0.47), Y(1.66)); g.quadraticCurveTo(X(0.455), Y(1.8), X(0.47), noseY); g.stroke();
  g.beginPath(); g.moveTo(X(0.465), noseY + 1); g.lineTo(X(0.53), noseY + 1); g.stroke();
  // the half-smile: level on his right, lifted on his left
  g.strokeStyle = '#6e3a3a'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(X(0.43), mouthY + 1); g.quadraticCurveTo(X(0.5), mouthY + 3, X(0.575), mouthY - 3); g.stroke();
  g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(X(0.575), mouthY - 3); g.lineTo(X(0.585), mouthY - 6); g.stroke();
  // cheekbone shading
  g.fillStyle = 'rgba(190,120,110,0.08)';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(X(0.5 + s * 0.24), Y(1.78), S * 0.05, S * 0.02, 0, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function mergeInto(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of geos) n += g.getAttribute('position').count;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.getAttribute('position').array, o * 3);
    nrm.set(g.getAttribute('normal').array, o * 3);
    o += g.getAttribute('position').count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return out;
}

/** A triangle wave in [0, 1]: the shaggy points along a hairline. */
const tri = (x) => { const f = x - Math.floor(x); return 1 - Math.abs(2 * f - 1); };

/** Hair: a shell cut along a hairline (a side part, the fringe falling to
 * his right, down past the ears at the sides), a curtain to the shoulders
 * at the back, and a few locks over the brow and framing the face.  All in
 * the head's centred frame. */
function hairGeo(r) {
  const parts = [];
  const sm = THREE.MathUtils.smoothstep;
  // the shell: every vertex below the hairline is pulled up onto it
  const shell = new THREE.SphereGeometry(1, 32, 22);
  const p = shell.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let th = Math.acos(THREE.MathUtils.clamp(y, -1, 1));
    const d = Math.atan2(x, z);                      // 0 at the front, + toward his left
    const ad = Math.abs(d);
    let hl = 0.8 + (d < 0 ? 0.26 * sm(-d, 0.05, 0.55) : 0.06 * sm(d, 0.1, 0.4))   // the fringe to his right, the part on his left
      + 1.22 * sm(ad, 0.62, 1.5);
    hl += ad > 0.62 ? 0.16 * tri(d * 1.6) * sm(ad, 0.62, 1.0) : 0.05 * tri(d * 2.4);   // shaggy points
    if (th > hl) th = hl;
    const vol = 1.07 + 0.07 * sm(th, 1.1, 2.0);
    const st = Math.sin(th), ct = Math.cos(th);
    const k = Math.hypot(x, z) || 1;
    p.setXYZ(i, (x / k) * st * r * vol * 0.97, ct * r * vol * 1.2 + 0.006, (z / k) * st * r * vol * 1.04 - 0.004);
  }
  shell.computeVertexNormals();
  parts.push(shell);
  // the curtain behind, to the shoulders, open at the front
  const prof = [[0.1, 0.02], [0.114, -0.05], [0.13, -0.11], [0.144, -0.15]].map(([a, b]) => new THREE.Vector2(a, b));
  const cur = new THREE.LatheGeometry(prof, 30, 1.3, Math.PI * 2 - 2.6);
  const cp = cur.getAttribute('position');
  for (let i = 0; i < cp.count; i++) {
    const y = cp.getY(i);
    if (y < -0.14) cp.setY(i, y - 0.05 * tri(Math.atan2(cp.getX(i), cp.getZ(i)) * 2.6));
  }
  cur.scale(1.02, 1, 0.92);
  cur.translate(0, 0, -0.012);
  cur.computeVertexNormals();
  parts.push(cur);
  // a lock: a slim cone hanging from (x, y, z), tipped by rx (forward) and rz (sideways)
  const lock = (x, y, z, len, rad, rz, rx) => {
    const g = new THREE.ConeGeometry(rad, len, 7, 1);
    g.rotateX(Math.PI); g.translate(0, -len / 2, 0);
    g.rotateX(rx); g.rotateZ(rz);
    g.translate(x, y, z);
    parts.push(g);
  };
  // the fringe, from the part on his left, falling across to his right, to the brow
  lock(0.03, 0.1, 0.088, 0.085, 0.026, -0.75, -0.35);
  lock(0.0, 0.098, 0.095, 0.09, 0.027, -0.8, -0.35);
  lock(-0.035, 0.088, 0.097, 0.085, 0.025, -0.6, -0.3);
  lock(-0.066, 0.07, 0.088, 0.08, 0.022, -0.3, -0.25);
  // layers flaring out round the sides and back: the shag
  for (let i = 0; i < 14; i++) {
    const a = 1.25 + (i / 13) * (Math.PI * 2 - 2.5);         // round from his left, behind, to his right
    const x = Math.sin(a) * 0.112, z = Math.cos(a) * 0.104 - 0.01;
    const len = 0.1 + ((i * 7) % 4) * 0.018;
    const g = new THREE.ConeGeometry(0.036, len, 6, 1);
    g.rotateX(Math.PI); g.translate(0, -len / 2, 0);
    g.rotateX(-Math.cos(a) * 0.32); g.rotateZ(Math.sin(a) * 0.32);
    g.translate(x, -0.03 + ((i * 5) % 3) * 0.012, z);
    parts.push(g);
  }
  // framing the face: locks from the temples to the jaw
  for (const s of [-1, 1]) {
    lock(s * 0.088, 0.04, 0.05, 0.15, 0.022, s * 0.12, -0.12);
    lock(s * 0.094, 0.02, 0.02, 0.17, 0.024, s * 0.18, 0.05);
  }
  // the crown's lift at the part
  const lift = new THREE.SphereGeometry(r * 0.55, 14, 8);
  lift.scale(1.25, 0.45, 1.2); lift.translate(0.01, r * 1.08, r * 0.3);
  parts.push(lift);
  return mergeInto(parts);
}

export function makeHan() {
  const M = {
    skin: cel({ color: C.skin, bands: 'soft3', tint: 0xb07a8a, flat: false }),
    hair: cel({ color: C.hair, bands: 3, tint: 0x4a4068, flat: false, side: THREE.DoubleSide }),
    jacket: cel({ color: C.jacket, bands: 3, tint: 0x3a3a70, flat: false, side: THREE.DoubleSide }),
    tee: cel({ color: C.tee, bands: 3, tint: 0x5a5a78, flat: false }),
    khaki: cel({ color: C.khaki, bands: 3, tint: 0x7a6478, flat: false }),
    shoe: cel({ color: C.shoe, bands: 2, tint: 0x4b4560, flat: false }),
    sole: cel({ color: C.sole, bands: 2, tint: 0x8a8098 }),
    chain: cel({ color: C.chain, bands: 3, tint: 0x6a7090, flat: false }),
  };
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
  /* Parts are gathered per joint and drawn as one mesh per joint and kind
   * (skin, or everything else), their colours per vertex: about twenty
   * draws for the whole man instead of sixty. */
  const buckets = new Map();
  const mesh = (parent, geo, mat, asCloth = false) => {
    const skin = mat === M.skin && !asCloth;
    const key = parent.uuid + (skin ? 's' : 'c');
    if (!buckets.has(key)) buckets.set(key, { parent, skin, list: [] });
    buckets.get(key).list.push({ geo, color: mat.color });
  };

  const pelvis = node('pelvis', root, 0, 0.93, 0);
  // hips and seat of the trousers
  {
    const g = new THREE.SphereGeometry(0.17, 18, 12);
    g.scale(1.0, 0.72, 0.8); g.translate(0, 0.01, -0.01);
    mesh(pelvis, g, M.khaki);
    const belt = new THREE.CylinderGeometry(0.158, 0.162, 0.04, 20);
    belt.scale(1, 1, 0.8); belt.translate(0, 0.08, -0.005);
    mesh(pelvis, belt, M.shoe);
  }
  const spine = node('spine', pelvis, 0, 0.06, 0);
  const chest = node('chest', spine, 0, 0.0, 0);
  {
    // the tee under the open jacket
    const tee = new THREE.LatheGeometry([[0.001, 0.48], [0.07, 0.48], [0.13, 0.42], [0.17, 0.3], [0.16, 0.1], [0.148, 0.0]]
      .map(([r, y]) => new THREE.Vector2(r, y)), 24);
    tee.scale(1, 1, 0.66);
    mesh(chest, tee, M.tee);
    // the jacket: open at the front, loose over the hips
    const jk = new THREE.LatheGeometry([[0.165, -0.12], [0.17, 0.0], [0.184, 0.2], [0.2, 0.33], [0.215, 0.41], [0.19, 0.46], [0.1, 0.5], [0.075, 0.52]]
      .map(([r, y]) => new THREE.Vector2(r, y)), 28, 0.42, Math.PI * 2 - 0.84);
    jk.scale(1, 1, 0.7);
    jk.computeVertexNormals();
    mesh(chest, jk, M.jacket);
    // collar
    const col = new THREE.CylinderGeometry(0.074, 0.092, 0.075, 20, 1, true, 0.38, Math.PI * 2 - 0.76);
    col.scale(1, 1, 0.85);
    col.translate(0, 0.505, -0.012);
    mesh(chest, col, M.jacket);
    // the chain: a thin loop lying on the tee
    const ch = new THREE.TorusGeometry(0.075, 0.005, 4, 24, Math.PI);
    ch.rotateZ(Math.PI); ch.rotateX(-1.2);
    ch.translate(0, 0.47, 0.055);
    mesh(chest, ch, M.chain, false);
  }
  const neck = node('neck', chest, 0, 0.49, 0);
  const head = node('head', neck, 0, 0.045, 0.012);
  head.scale.setScalar(1.08);
  const HR = 0.1;
  {
    // the neck, drawn with the head (it turns with it)
    mesh(head, new THREE.CylinderGeometry(0.054, 0.06, 0.1, 14).translate(0, 0.04 - 0.045, -0.012).scale(1 / 1.08, 1 / 1.08, 1 / 1.08), M.skin);
    const hg = shapeHead(new THREE.SphereGeometry(HR, 24, 18), HR);
    hg.translate(0, HR * 1.05, 0);
    mesh(head, hg, M.skin);
    // the face: the same shape a hair's breadth larger, over the front only
    const fg = shapeHead(new THREE.SphereGeometry(HR * 1.012, 20, 16, Math.PI / 2 - 0.95, 1.9, 0.45, 2.0), HR * 1.012);
    // the patch's phi runs from +x round to -x: flip u so the texture reads as seen
    const uv = fg.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    fg.translate(0, HR * 1.05, 0);
    const face = new THREE.Mesh(fg, cel({ color: 0xffffff, map: faceTex(), transparent: true, bands: 'soft3', tint: 0xb07a8a, flat: false, depthWrite: false }));
    face.renderOrder = 1;
    face.userData.noOutline = true;
    head.add(face);
    // ears (mostly under the hair)
    for (const s of [-1, 1]) {
      const e = new THREE.SphereGeometry(0.024, 10, 8);
      e.scale(0.5, 1, 0.8); e.translate(s * HR * 0.93, HR * 1.0, -0.005);
      mesh(head, e, M.skin, false);
    }
    const hair = hairGeo(HR);
    hair.translate(0, HR * 1.05, 0);
    mesh(head, hair, M.hair);
  }
  // arms
  const arm = (side) => {
    const s = side === 'l' ? 1 : -1;
    const sh = node(side + 'Sh', chest, s * 0.2, 0.42, -0.01);
    mesh(sh, new THREE.SphereGeometry(0.068, 14, 10).scale(1, 0.9, 0.9), M.jacket);
    mesh(sh, capsule(0.058, 0.2, M.jacket).geometry, M.jacket);
    const el = node(side + 'El', sh, 0, -0.29, 0);
    el.rotation.order = 'YXZ';
    mesh(el, capsule(0.052, 0.18, M.jacket).geometry, M.jacket);
    // cuff and hand
    const cuff = new THREE.CylinderGeometry(0.054, 0.05, 0.03, 12).translate(0, -0.25, 0);
    mesh(el, cuff, M.jacket);
    const hand = new THREE.SphereGeometry(0.042, 12, 8);
    hand.scale(0.75, 1.25, 1.0); hand.translate(0, -0.3, 0.005);
    mesh(el, hand, M.skin, true);          // drawn with the sleeve: one draw per forearm
  };
  arm('l'); arm('r');
  // legs: loose cargo trousers with side pockets, trainers
  const leg = (side) => {
    const s = side === 'l' ? 1 : -1;
    const hip = node(side + 'Hip', pelvis, s * 0.09, -0.02, 0);
    mesh(hip, capsule(0.078, 0.3, M.khaki).geometry, M.khaki);
    const pocket = new THREE.BoxGeometry(0.03, 0.13, 0.11).translate(s * 0.078, -0.26, 0.005);
    mesh(hip, pocket, M.khaki);
    const knee = node(side + 'Knee', hip, 0, -0.45, 0);
    mesh(knee, capsule(0.064, 0.3, M.khaki).geometry, M.khaki);
    const hem = new THREE.CylinderGeometry(0.068, 0.074, 0.08, 14).translate(0, -0.36, 0);
    mesh(knee, hem, M.khaki);
    const ankle = node(side + 'Foot', knee, 0, -0.42, 0);
    const shoe = new THREE.CapsuleGeometry(0.048, 0.15, 4, 10);
    shoe.rotateX(Math.PI / 2); shoe.scale(1.05, 0.85, 1); shoe.translate(0, -0.012, 0.06);
    mesh(ankle, shoe, M.shoe);
    const sole = new THREE.BoxGeometry(0.1, 0.028, 0.27).translate(0, -0.05, 0.06);
    mesh(ankle, sole, M.sole);
  };
  leg('l'); leg('r');

  const skinMat = cel({ color: 0xffffff, bands: 'soft3', tint: 0xb07a8a, flat: false, vertexColors: true });
  const clothMat = cel({ color: 0xffffff, bands: 3, tint: 0x5a5480, flat: false, vertexColors: true, side: THREE.DoubleSide });
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
    const m = new THREE.Mesh(out, b.skin ? skinMat : clothMat);
    m.castShadow = !b.skin;                // the face and neck sit in the hair's and jacket's shadow anyway
    b.parent.add(m);
  }

  const apply = (p) => {
    J.pelvis.position.y = p.pelvisY;
    J.pelvis.rotation.set(p.pelvisX, 0, p.pelvisZ);
    J.spine.rotation.set(p.spineX, 0, 0);
    J.chest.rotation.x = p.chestX;
    J.head.rotation.x = p.headX;
    J.head.rotation.z = p.headZ;
    J.lSh.rotation.set(p.lShX, 0, p.lShZ);
    J.rSh.rotation.set(p.rShX, 0, p.rShZ);
    J.lEl.rotation.set(p.lElX, p.lElY, 0);
    J.rEl.rotation.set(p.rElX, p.rElY, 0);
    J.lHip.rotation.set(p.lHipX, 0, p.lHipZ);
    J.rHip.rotation.set(p.rHipX, 0, p.rHipZ);
    J.lKnee.rotation.x = p.lKnee;
    J.rKnee.rotation.x = p.rKnee;
    J.lFoot.rotation.x = p.lFoot;
    J.rFoot.rotation.x = p.rFoot;
  };
  apply(POSES.lean);
  return { group: root, joints: J, apply };
}
