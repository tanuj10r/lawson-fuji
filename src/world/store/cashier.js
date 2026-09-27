import * as THREE from 'three';
import { figureMaterial, parts, ellipsoid, limb } from './figure.js';

/* ------------------------------------------------------------------ *
 * The cashier (Tan's konbini; SPEC 8): the only person in the store.
 *
 * Built in code in the town's painted cartoon look (store/figure.js):
 * anime proportions at 1.6 m, a dark-brown bob with bangs and a shine
 * band, big eyes painted on a face texture that blinks and talks, the
 * store's blue-and-white striped shirt with short sleeves, a NIPPON name
 * tag, navy trousers.  No bones: pivots at the waist, neck, shoulders and
 * elbows, eased toward target poses every frame, so she never snaps:
 * breathing, a look that follows you, bows, the reach to scan, the hand
 * held out with your change.
 *
 * Her own frame faces +z, the origin on the floor between her feet;
 * shop.js stands her behind the till, facing the shop.
 * ------------------------------------------------------------------ */

const SKIN = 0xf8d6be, HAIR = 0x3b2628, HAIR_SHINE = 0x6e4a48, TROUSERS = 0x2e3448, SHOE = 0x2a2a30, WHITE = 0xffffff;
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const M = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)).setPosition(x, y, z);

/* ------------------------------- textures ------------------------------- */
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
/** The face, three ways: eyes open, shut (a blink), and talking. */
function faceTexture(kind) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#f8d6be'; g.fillRect(0, 0, 256, 256);
  // blush
  g.fillStyle = 'rgba(240,140,140,0.32)';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * 58, 176, 20, 10, 0, 0, 7); g.fill(); }
  // brows
  g.strokeStyle = '#4a2a28'; g.lineWidth = 4; g.lineCap = 'round';
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(128 + s * 30, 104); g.quadraticCurveTo(128 + s * 46, 96, 128 + s * 62, 104); g.stroke(); }
  for (const s of [-1, 1]) {
    const x = 128 + s * 44, y = 146;
    if (kind === 'shut') {
      // a closed eye: a soft downward arc with a lash flick
      g.strokeStyle = '#2a1a1c'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(x - 17, y - 2); g.quadraticCurveTo(x, y + 9, x + 17, y - 2); g.stroke();
      g.beginPath(); g.moveTo(x + s * 17, y - 2); g.lineTo(x + s * 23, y - 7); g.stroke();
      continue;
    }
    // the white, the big iris with its gradient, the pupil, two highlights
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, y, 17, 21, 0, 0, 7); g.fill();
    const gr = g.createLinearGradient(0, y - 18, 0, y + 18);
    gr.addColorStop(0, '#3a2220'); gr.addColorStop(0.55, '#6a3a30'); gr.addColorStop(1, '#b0704e');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x + s * 1, y + 2, 13, 18, 0, 0, 7); g.fill();
    g.fillStyle = '#1e1214'; g.beginPath(); g.ellipse(x + s * 1, y + 2, 6, 9, 0, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x - 5, y - 8, 5, 6, -0.4, 0, 7); g.fill();
    g.beginPath(); g.arc(x + 5, y + 9, 2.5, 0, 7); g.fill();
    // the upper lash line, heavy and winged; a light lower line
    g.strokeStyle = '#2a1a1c'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(x - 19, y - 12); g.quadraticCurveTo(x, y - 28, x + 19, y - 12); g.stroke();
    g.beginPath(); g.moveTo(x + s * 18, y - 13); g.lineTo(x + s * 25, y - 19); g.stroke();
    g.strokeStyle = 'rgba(80,40,40,0.5)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x - 10, y + 21); g.quadraticCurveTo(x, y + 24, x + 10, y + 21); g.stroke();
  }
  // a small nose, just a shadow
  g.fillStyle = 'rgba(210,140,120,0.7)'; g.beginPath(); g.ellipse(129, 176, 3, 2, 0, 0, 7); g.fill();
  // the mouth: a small smile, or open mid-word
  if (kind === 'talk') {
    g.fillStyle = '#8a2e34'; g.beginPath(); g.ellipse(128, 200, 10, 8, 0, 0, 7); g.fill();
    g.fillStyle = '#e8787a'; g.beginPath(); g.ellipse(128, 204, 6, 3.5, 0, 0, 7); g.fill();
  } else {
    g.strokeStyle = '#8a3a3a'; g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(118, 197); g.quadraticCurveTo(128, 205, 138, 197); g.stroke();
  }
  return tex(c);
}
/** The uniform's stripes: light blue on white, repeated round the shirt. */
function stripeTexture() {
  const [c, g] = canvas(32, 8);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 32, 8);
  g.fillStyle = '#6ea4dc'; g.fillRect(0, 0, 13, 8);
  return tex(c, true);
}
/** The name tag: the store's band, and her name. */
function tagTexture() {
  const [c, g] = canvas(128, 64);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#1f5fae'; g.fillRect(0, 0, 128, 20);
  g.fillStyle = '#ffffff'; g.font = 'bold 15px ui-sans-serif, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('NIPPON', 64, 11);
  g.fillStyle = '#2a2a30'; g.font = 'bold 26px "Hiragino Kaku Gothic ProN", sans-serif';
  g.fillText('やまだ', 64, 43);
  return tex(c);
}

/* ------------------------------- the build ------------------------------- */
/** Scale a geometry's u so a repeating texture runs `n` times round it. */
function stripeUv(g, n) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * n); return g; }

/** The hair: a shell over the head, open for the face, a bob to the jaw. */
function hairShell() {
  const s = new THREE.SphereGeometry(1, 28, 20).toNonIndexed();
  s.scale(0.13, 0.138, 0.126);
  s.translate(0, 0.118, -0.008);
  const p = s.attributes.position, keep = [];
  const c = new THREE.Vector3();
  for (let t = 0; t < p.count; t += 3) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(v(p.getX(t + k), p.getY(t + k), p.getZ(t + k)));
    c.multiplyScalar(1 / 3);
    const top = c.y > 0.19, back = c.z < -0.02, side = Math.abs(c.x) > 0.098;
    if (top || (back && c.y > -0.03) || (side && c.y > -0.012)) keep.push(t);
  }
  const out = new Float32Array(keep.length * 9);
  keep.forEach((t, i) => { for (let k = 0; k < 9; k++) out[i * 9 + k] = p.array[t * 3 + k]; });
  // the bob swings out a little at its ends
  for (let i = 0; i < out.length; i += 3) {
    const y = out[i + 1];
    if (y < 0.09) { const k = 1 + (0.09 - y) * 0.8; out[i] *= k; out[i + 2] = (out[i + 2] + 0.008) * k - 0.008; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.computeVertexNormals();
  return g;
}

export function makeCashier(lit) {
  const root = new THREE.Group();
  root.name = 'cashier';
  const plain = figureMaterial();
  const shirtMat = figureMaterial({ map: stripeTexture() });
  const faces = { open: faceTexture('open'), shut: faceTexture('shut'), talk: faceTexture('talk') };
  const faceMat = figureMaterial({ map: faces.open });
  const tagMat = new THREE.MeshBasicMaterial({ map: tagTexture() });
  lit.push(plain, shirtMat, faceMat, tagMat);
  const mesh = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); m.name = 'cashier-' + name; m.castShadow = false; m.receiveShadow = false; m.userData.dynamic = true; return m; };

  /* the legs and hips (mostly behind the counter) */
  {
    const p = parts();
    p.add(ellipsoid(0.15, 0.1, 0.105), TROUSERS, M(0, 0.86, 0));
    for (const s of [-1, 1]) {
      p.add(limb(v(s * 0.075, 0.84, 0), v(s * 0.08, 0.1, 0.005), 0.058), TROUSERS);
      p.add(ellipsoid(0.05, 0.035, 0.1), SHOE, M(s * 0.08, 0.035, 0.035));
    }
    root.add(mesh(p.build(), plain, 'legs'));
  }
  /* the torso pivot, at the waist */
  const torso = new THREE.Group();
  torso.position.set(0, 0.88, 0);
  root.add(torso);
  {
    const shirt = parts();
    // a soft taper from the shoulders to the waist, a touch of bust
    const body = stripeUv(new THREE.CylinderGeometry(0.138, 0.118, 0.42, 24, 6, true), 16).scale(1, 1, 0.64);
    const bp = body.attributes.position;
    for (let i = 0; i < bp.count; i++) { const y = bp.getY(i), z = bp.getZ(i); if (z > 0) bp.setZ(i, z * (1 + 0.16 * Math.exp(-(((y - 0.08) / 0.07) ** 2)))); }
    body.computeVertexNormals();
    shirt.add(body, WHITE, M(0, 0.21, 0));
    shirt.add(stripeUv(new THREE.SphereGeometry(1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), 16).scale(0.138, 0.05, 0.088), WHITE, M(0, 0.42, 0));
    shirt.add(new THREE.CircleGeometry(0.118, 20).rotateX(Math.PI / 2).scale(1, 1, 0.64), WHITE, M(0, 0.0, 0));       // the hem, closed
    torso.add(mesh(shirt.build(), shirtMat, 'shirt'));
    const trim = parts();
    trim.add(limb(v(0, 0.42, 0), v(0, 0.53, 0.004), 0.034), SKIN);                     // the neck
    // the collar: a band round the neck and two soft points at the front; the placket's buttons
    trim.add(new THREE.TorusGeometry(0.046, 0.011, 6, 20).rotateX(Math.PI / 2).scale(1, 1, 0.9), WHITE, M(0, 0.45, 0.004));
    for (const s of [-1, 1]) trim.add(new THREE.BoxGeometry(0.042, 0.03, 0.006), WHITE, M(s * 0.024, 0.436, 0.052, -0.35, s * 0.35, s * 0.6));
    for (let k = 0; k < 3; k++) trim.add(new THREE.SphereGeometry(0.0055, 6, 4), 0xdfe6ee, M(0, 0.37 - k * 0.1, 0.098 - k * 0.004));
    trim.add(new THREE.BoxGeometry(0.3, 0.035, 0.2).scale(1, 1, 0.7), TROUSERS, M(0, -0.005, 0));   // the belt line
    torso.add(mesh(trim.build(), plain, 'trim'));
    // the name tag, on her left breast
    const tag = mesh(new THREE.PlaneGeometry(0.075, 0.037), tagMat, 'tag');
    tag.position.set(0.058, 0.33, 0.099);
    tag.rotation.set(-0.12, 0.28, 0);
    torso.add(tag);
  }
  /* the head, pivoting at the top of the neck */
  const head = new THREE.Group();
  head.position.set(0, 0.515, 0.004);
  torso.add(head);
  {
    const skull = parts();
    // one smooth head (a second shape for the chin would draw ink where they meet):
    // a big anime head, the jaw tapering to a soft point
    const hg = ellipsoid(0.118, 0.125, 0.112, 32, 24);
    const hp = hg.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const y = hp.getY(i);
      if (y < 0) { const k = (-y / 0.125) ** 2; hp.setX(i, hp.getX(i) * (1 - 0.3 * k)); hp.setZ(i, hp.getZ(i) * (1 - 0.1 * k) + 0.012 * k); }
    }
    hg.computeVertexNormals();
    skull.add(hg, WHITE, M(0, 0.118, 0.004));
    const g = skull.build();
    // the face is projected from the front: the painted texture lands on it squarely
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + (pos.getX(i) / 0.236) * 0.95, 0.5 + ((pos.getY(i) - 0.118) / 0.25) * 0.95);
    head.add(mesh(g, faceMat, 'head'));
    const hair = parts();
    hair.add(hairShell(), HAIR);
    // the bangs: strands over the forehead, following its curve
    [-0.078, -0.046, -0.016, 0.014, 0.044, 0.076].forEach((x, i) => {
      const a = Math.atan2(x, 0.11);
      hair.add(new THREE.ConeGeometry(0.027, 0.085, 5).rotateX(Math.PI).scale(1, 1, 0.4), HAIR,
        M(x * 1.04, 0.182 - (i % 2) * 0.012, 0.108 * Math.cos(a) + 0.008, -0.3, a, -x * 1.4));
    });
    // the shine band, and a strand that won't lie flat
    hair.add(new THREE.TorusGeometry(0.124, 0.0055, 4, 26, Math.PI * 0.8).rotateX(Math.PI / 2).rotateY(Math.PI * 0.1), HAIR_SHINE, M(0, 0.2, -0.01, -0.35, 0, 0));
    hair.add(new THREE.TorusGeometry(0.024, 0.005, 5, 10, Math.PI * 1.1), HAIR, M(0.01, 0.268, 0.0, 0, 0.3, 0.4));
    // a blue clip over her left temple
    hair.add(new THREE.BoxGeometry(0.038, 0.01, 0.008), 0x1f5fae, M(0.086, 0.18, 0.09, 0, 0.6, 0.5));
    head.add(mesh(hair.build(), plain, 'hair'));
  }
  /* the arms: shoulder and elbow pivots; short striped sleeves */
  const arms = {};
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 0.15, 0.4, 0);
    torso.add(sh);
    const upper = parts();
    upper.add(stripeUv(new THREE.CylinderGeometry(0.042, 0.048, 0.15, 14, 1, true), 7), WHITE, M(0, -0.06, 0));
    upper.add(stripeUv(new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), 7).scale(0.043, 0.04, 0.043), WHITE, M(0, 0.015, 0));
    sh.add(mesh(upper.build(), shirtMat, 'sleeve'));
    const arm = parts();
    arm.add(limb(v(0, -0.1, 0), v(0, -0.26, 0), 0.032), SKIN);
    sh.add(mesh(arm.build(), plain, 'arm'));
    const el = new THREE.Group();
    el.position.set(0, -0.26, 0);
    sh.add(el);
    const fore = parts();
    fore.add(limb(v(0, 0, 0), v(0, -0.21, 0.004), 0.029), SKIN);
    fore.add(ellipsoid(0.026, 0.044, 0.015), SKIN, M(0, -0.255, 0.006));                  // the hand, a soft mitten
    fore.add(limb(v(s * -0.018, -0.23, 0.01), v(s * -0.03, -0.265, 0.02), 0.009), SKIN);   // the thumb
    el.add(mesh(fore.build(), plain, 'forearm'));
    // where her hand holds a thing (a scanned item, your change)
    const grip = new THREE.Group();
    grip.position.set(0, -0.27, 0.03);
    el.add(grip);
    arms[s > 0 ? 'L' : 'R'] = { sh, el, grip };
  }

  /* --------------------------- poses and motion --------------------------- */
  /* Each named joint angle eases toward its target: `pose(p)` sets targets. */
  const J = {
    bow: 0, lean: 0, twist: 0, headX: 0, headY: 0, headZ: 0,
    // at rest: hands together in front of her, the way konbini staff wait at the till
    rShX: -0.18, rShZ: 0.3, rShY: 0.5, rElX: -1.3, lShX: -0.18, lShZ: -0.3, lShY: -0.5, lElX: -1.3,
  };
  const IDLE = { ...J };
  const target = { ...J };
  const cur = { ...J };
  const api = {
    root, arms, head, torso, faces,
    /** Ease toward `p` (joint angles; the rest keep their targets). */
    pose(p) { Object.assign(target, p); },
    /** Back to standing at the till, hands resting on the counter. */
    rest() { Object.assign(target, IDLE); },
    /** Where she looks: a world point (or null to look ahead). */
    lookAt: null,
    /** Talk for `s` seconds (the mouth moves). */
    talk(s) { talkFor = Math.max(talkFor, s); },
    /** Bow: `deep` 0..1, held `hold` seconds, then back up. */
    bow(deep = 1, hold = 0.7) { bowT = hold; bowDeep = deep; },
    get busy() { return bowT > 0; },
  };
  let talkFor = 0, blinkIn = 2.4, blinkT = 0, bowT = 0, bowDeep = 0, t = 0;
  const wp = new THREE.Vector3(), lp = new THREE.Vector3();
  const setFace = (k) => { if (faceMat.uniforms.uMap.value !== faces[k]) faceMat.uniforms.uMap.value = faces[k]; };

  api.update = (dt) => {
    t += dt;
    // a bow is held, then released
    if (bowT > 0) {
      bowT -= dt;
      target.bow = 0.42 * bowDeep; target.headX = 0.25 * bowDeep;
      target.rShX = -0.05; target.lShX = -0.05; target.rShZ = 0.28; target.lShZ = -0.28; target.rElX = -0.75; target.lElX = -0.75;
      if (bowT <= 0) { target.bow = 0; target.headX = 0; api.rest(); }
    }
    // her look follows you (within reason) unless she is bowing
    if (api.lookAt && bowT <= 0) {
      root.updateMatrixWorld();
      lp.copy(api.lookAt);
      head.getWorldPosition(wp);
      root.worldToLocal(lp);
      const loc = root.worldToLocal(wp.clone());
      const yaw = Math.atan2(lp.x - loc.x, lp.z - loc.z);
      const pitch = Math.atan2(lp.y - loc.y - 0.1, Math.hypot(lp.x - loc.x, lp.z - loc.z));
      target.headY = Math.max(-0.9, Math.min(0.9, yaw)) * 0.75;
      target.twist = Math.max(-0.5, Math.min(0.5, yaw)) * 0.25;
      target.headX = Math.max(-0.35, Math.min(0.3, -pitch)) * 0.8;
      target.headZ = -target.headY * 0.12;                        // a little tilt of the head as she turns: charm, not a turret
    }
    // ease every joint (about a sixth of a second to settle)
    const k = 1 - Math.exp(-dt * 9);
    for (const key of Object.keys(cur)) cur[key] += (target[key] - cur[key]) * k;
    const breathe = Math.sin(t * 1.7) * 0.012;
    torso.rotation.set(cur.bow + cur.lean + breathe * 0.4, cur.twist, Math.sin(t * 0.45) * 0.018);   // her weight shifts now and then
    torso.scale.set(1, 1 + breathe * 0.4, 1 + breathe);
    head.rotation.set(cur.headX + Math.sin(t * 0.9) * 0.015, cur.headY, cur.headZ + Math.sin(t * 0.6) * 0.02, 'YXZ');
    arms.R.sh.rotation.set(cur.rShX + breathe, cur.rShY, cur.rShZ);
    arms.L.sh.rotation.set(cur.lShX + breathe, cur.lShY, cur.lShZ);
    arms.R.el.rotation.set(cur.rElX, 0, 0);
    arms.L.el.rotation.set(cur.lElX, 0, 0);
    // blink now and then; the mouth flaps while she speaks
    blinkIn -= dt;
    if (blinkIn <= 0) { blinkT = 0.13; blinkIn = 2.2 + ((t * 7.31) % 2.6); }
    if (blinkT > 0) blinkT -= dt;
    if (talkFor > 0) talkFor -= dt;
    setFace(blinkT > 0 ? 'shut' : talkFor > 0 && Math.sin(t * 44) > -0.2 ? 'talk' : 'open');
  };
  return api;
}
