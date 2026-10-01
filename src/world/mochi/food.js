import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ *
 * What ぺったん堂 sells, and what Hachi gets instead.
 *
 * 抹茶いちご餅: a soft matcha-green mochi, a little flattened, dusted with
 * kinako (roasted soybean flour: tan freckles over its top), a whole
 * strawberry pressed into it tip-down: deep red, pale at the shoulders,
 * tiny seeds, the green calyx and its stem on top, and a toon highlight
 * (a white streak and a dot, modelled, so it is crisp at any light).
 * About 6.5 cm across and 7 cm tall.
 *
 * One geometry carries the colour twice, as `color` (the town's cel
 * material, on the stand) and as `paint` (the hand's painted material,
 * store/figure.js, when you hold and eat it), so both draw it.
 *
 * Eaten (store/eat.js RECIPE.mochi): each bite is a ball pressed into the
 * surface: what it touches is pushed back onto the ball and shows the
 * inside -- the mochi's pale skin at the rim, the red-bean paste deeper,
 * the strawberry's pink flesh and white heart.
 * ------------------------------------------------------------------ */

const MATCHA = 0xb4cc7c, MATCHA_D = 0x9dba62, KINAKO = 0xe3c489, SKIN_IN = 0xe6edc8, ANKO = 0x5b2c36;
const BERRY = 0xdc2238, BERRY_D = 0xb81830, BERRY_PALE = 0xf0a08c, FLESH = 0xf6b0ac, HEART = 0xfff2ec, SEED = 0xf8e08e, LEAF = 0x62b24a, LEAF_D = 0x4a9a3c;
const R = 0.033, RY = 0.024;                 // the mochi's half width and half height
const MOCHI_MID = [0, RY * 0.86, 0], BERRY_MID = [0.002, RY * 1.72 + 0.015, 0.006];
const _c = new THREE.Color();

/** A deterministic freckle in 0..1 from a point. */
const hash = (x, y, z) => { const s = Math.sin(x * 12989.8 + y * 78233.1 + z * 37719.3) * 43758.5453; return s - Math.floor(s); };

function part(geo, color, matrix = null, kind = 'mochi') {
  const g = geo;
  g.computeVertexNormals();                  // smooth, on the indexed primitive (after any shaping)
  if (matrix) g.applyMatrix4(matrix);
  g.userData.kind = kind;
  g.userData.color = color;
  return g;
}
const ball = (rx, ry, rz, w, h) => new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz);
const M = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));

/**
 * The mochi, its base on y 0.  `bites`: [[x, y, z, r], ...] balls bitten out of it.
 * `detail`: 1 for the one in your hand, less for the ones on the tray (`plain`: no seeds either).
 */
export function mochiGeometry({ bites = [], detail = 1, plain = false } = {}) {
  const seg = (n) => Math.max(6, Math.round(n * detail));
  const parts = [];
  // the mochi: a soft flattened ball, a touch wider at the foot, dimpled where the strawberry sits
  {
    const g = ball(R, RY, R, seg(26), seg(16));
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), u = y / RY;
      const k = 1 + 0.1 * Math.max(0, -u) - 0.04 * u * u;
      const dimple = 0.004 * Math.exp(-((x * x + z * z) / (0.014 * 0.014))) * Math.max(0, u);
      P.setXYZ(i, x * k, Math.max(-RY * 0.86, y) - dimple, z * k);
    }
    g.translate(0, RY * 0.86, 0);
    parts.push(part(g, (p, n) => {
      // kinako: thick on top, freckled down the shoulders, none underneath
      // a cap of it over the top, its edge broken into freckles
      const f = hash(Math.round(p.x * 700), Math.round(p.y * 700), Math.round(p.z * 700));
      const cap = n.y - 0.52 + (f - 0.5) * 0.34;
      if (cap > 0) return cap > 0.3 && f > 0.6 ? 0xf0dcae : KINAKO;
      return n.y < -0.25 ? MATCHA_D : MATCHA;
    }));
  }
  /* the strawberry: tip down in the dimple, leaning a little, shoulders up */
  const lean = M(0.002, RY * 1.72 - 0.004, 0.001, 0.3, 0, -0.16);
  const SH = 0.039, SR = 0.0195;             // its height and widest radius
  const prof = (t) => SR * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + t * 0.86) * 0.5), 0.8) * (t > 0.86 ? Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2)) : 1);
  {
    const g = new THREE.SphereGeometry(1, seg(20), seg(14));
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const t = (P.getY(i) + 1) / 2;         // 0 at the tip (down) .. 1 at the shoulders
      const r = prof(t), a = Math.atan2(P.getZ(i), P.getX(i));
      P.setXYZ(i, Math.cos(a) * r, t * SH, Math.sin(a) * r);
    }
    parts.push(part(g, (p, n, l) => {
      const t = l.y / SH;
      return t > 0.93 ? BERRY_PALE : t > 0.84 ? 0xe45a50 : n.y < -0.55 ? BERRY_D : BERRY;
    }, lean, 'berry'));
    // seeds: tiny pale-gold drops in a spiral, set into the skin
    const seeds = plain ? 0 : Math.round(20 * detail);
    for (let i = 0; i < seeds; i++) {
      const t = 0.16 + 0.66 * (i + 0.5) / seeds, a = i * 2.39996;
      const r = prof(t) + 0.0002;
      const m = M(Math.cos(a) * r, t * SH, Math.sin(a) * r, 0, -a, 0).premultiply(lean);
      parts.push(part(ball(0.00045, 0.0016, 0.001, 5, 3), SEED, m, 'seed'));
    }
    // the highlight: a white streak down the lit shoulder and a dot under it (toon gloss)
    for (const [t, a, w, h] of [[0.66, 2.25, 0.0034, 0.0086], [0.42, 2.38, 0.0018, 0.0022]]) {
      const r = prof(t) + 0.0003;
      const m = M(Math.cos(a) * r, t * SH, Math.sin(a) * r, 0, Math.PI / 2 - a, 0).premultiply(lean);
      parts.push(part(ball(w, h, 0.0006, 10, 6), 0xffffff, m, 'gloss'));
    }
    // the calyx: six pointed leaves folded back over the shoulders, a short stem
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      // (laid over the dome of the shoulders, their tips out past it and drooping)
      const leaf = new THREE.ConeGeometry(0.0062, 0.023, 4, 1).scale(1, 1, 0.2).rotateX(Math.PI / 2).translate(0, 0, 0.0115);
      const m = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationX(0.2 + (i % 2) * 0.12)).setPosition(0, SH + 0.0012, 0).premultiply(lean);
      parts.push(part(leaf, i % 2 ? LEAF : LEAF_D, m, 'leaf'));
    }
    parts.push(part(new THREE.CylinderGeometry(0.0011, 0.0016, 0.008, 5), LEAF_D, M(0, SH + 0.003, 0, 0.2, 0, 0.25).premultiply(lean), 'leaf'));
  }
  // a soft sheen on the mochi's shoulder
  parts.push(part(ball(0.0075, 0.0026, 0.0007, 10, 5), 0xf6fae6, M(-0.017, RY * 1.22, 0.0262, -0.62, -0.55, 0.2), 'gloss'));

  /* paint, then bite */
  const out = [];
  for (const g of parts) {
    const P = g.attributes.position, N = g.attributes.normal, col = new Float32Array(P.count * 3);
    const kind = g.userData.kind, color = g.userData.color;
    const p = new THREE.Vector3(), n = new THREE.Vector3(), l = new THREE.Vector3(), inv = kind === 'berry' ? lean.clone().invert() : null;
    let gone = 0;
    for (let i = 0; i < P.count; i++) {
      p.fromBufferAttribute(P, i); n.fromBufferAttribute(N, i);
      if (inv) l.copy(p).applyMatrix4(inv);
      _c.set(typeof color === 'function' ? color(p, n, l) : color);
      for (const [bx, by, bz, br] of bites) {
        const dx = p.x - bx, dy = p.y - by, dz = p.z - bz, d = Math.hypot(dx, dy, dz);
        if (d >= br) continue;
        gone++;
        // pressed in, toward the middle of what it is part of, until it is out of the bite's ball: a hollow, and
        // what shows there is the inside
        const mid = kind === 'berry' ? BERRY_MID : MOCHI_MID;
        let ix = mid[0] - p.x, iy = mid[1] - p.y, iz = mid[2] - p.z;
        const il = Math.hypot(ix, iy, iz) || 1;
        ix /= il; iy /= il; iz /= il;
        const bb = dx * ix + dy * iy + dz * iz, t = Math.min(il, -bb + Math.sqrt(Math.max(0, bb * bb - (d * d - br * br))));
        const deep = t;
        p.set(p.x + ix * t, p.y + iy * t, p.z + iz * t);
        if (kind === 'berry') _c.set(deep < 0.0016 ? BERRY : deep > 0.009 ? HEART : FLESH);
        else if (kind === 'mochi') _c.set(deep < 0.0055 ? SKIN_IN : ANKO);
        P.setXYZ(i, p.x, p.y, p.z);
        N.setXYZ(i, (bx - p.x) / br, (by - p.y) / br, (bz - p.z) / br);   // the hollow faces its ball's middle
      }
      col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    }
    // small things wholly inside a bite went with it
    if ((kind === 'seed' || kind === 'gloss' || kind === 'leaf') && gone > P.count * 0.5) continue;
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('paint', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    out.push(g);
  }
  const geo = mergeGeometries(out, false);
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  return geo;
}

/** How tall it stands, for whoever sets it down or holds it. */
export const MOCHI_H = RY * 1.72 + 0.039;

/**
 * The eating (store/eat.js): whole, after the first bite (half the strawberry and a
 * corner of the mochi), after the second.  Centred to be held about its middle.
 * `pull`: the first bite draws a strand of mochi out (its colour, and where it leaves the food).
 */
export function mochiStages() {
  const b1 = [[0.02, 0.058, 0.012, 0.03]];
  const b2 = [...b1, [-0.02, 0.05, 0.012, 0.031], [0.004, 0.036, 0.03, 0.02]];
  const st = [[], b1, b2].map((bites) => mochiGeometry({ bites, detail: bites.length ? 1.3 : 1 }).translate(0, -0.03, 0));
  st.turn = [0.32, -0.28, 0];
  st.wrapped = false;                         // nothing to unwrap: it is handed to you bare
  st.bites = [0.8, 2.05, 2.8];               // when each bite starts (s); the first is long
  st.per = 4.3;
  st.pull = { from: [0.012, 0.022, 0.012], len: 1.15 };
  return st;
}

/** A strand of mochi, a unit long up y from the origin, thick in the middle of nothing: thin, a bead where it leaves the food. */
export function strandGeometry() {
  const pts = [[0.0075, 0], [0.004, 0.1], [0.0022, 0.4], [0.0015, 0.75], [0.0018, 0.95], [0.0001, 1]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 8);
  _c.set(0xf6f3de);
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < col.length; i += 3) { col[i] = _c.r; col[i + 1] = _c.g; col[i + 2] = _c.b; }
  g.setAttribute('paint', new THREE.BufferAttribute(col, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Hachi's treat (干し芋, dried sweet potato): a flat amber strip, a little bent. */
export function potatoGeometry() {
  const g = new THREE.BoxGeometry(0.05, 0.007, 0.022, 4, 1, 1);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) P.setY(i, P.getY(i) + 0.006 * Math.cos(P.getX(i) * 50));
  g.computeVertexNormals();
  _c.set(0xd9a24a);
  const col = new Float32Array(P.count * 3);
  for (let i = 0; i < col.length; i += 3) { col[i] = _c.r; col[i + 1] = _c.g; col[i + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
