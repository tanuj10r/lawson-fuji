import * as THREE from 'three';
import { figureMaterial, parts, ellipsoid, easeBack, ease, clamp01 } from './figure.js';

/* ------------------------------------------------------------------ *
 * Your hand (Tan's konbini): a cartoon right hand that rises from the
 * bottom of the view to take the thing you chose, pay and eat.
 *
 * Painted in store/figure.js's style, drawn on top of the world
 * and near-clamped.  It lives in the camera's frame: `view` (shop.js)
 * follows the camera, and the hand is a pivot at the wrist whose offset
 * and turn the choreography (rise, pay, eat) drives.
 *
 * Hand frame: the palm at the origin, fingers +y, palm facing +z, a right
 * hand's thumb on +x.
 * ------------------------------------------------------------------ */

const SKIN = 0xf8d3b8, NAIL = 0xfbe4da, SLEEVE = 0x4b5d95, CUFF = 0xeae6de, BUTTON = 0xd8d2c4;
const v = (x, y, z) => new THREE.Vector3(x, y, z);

/* ------------------------- the hand's anatomy ------------------------- *
 * Built to a real hand's proportions (a palm about 8.5 cm across and 10 cm
 * long, the middle finger 8 cm, three phalanges in 4:3:2, the thumb from
 * the heel of the hand): a lofted palm with the metacarpal ridges rising
 * to the knuckles, fingers that taper joint by joint with nails on their
 * backs, the thenar and hypothenar pads, the web of the thumb, an oval
 * wrist with the ulnar bump, and the shirt cuff at the wrist where it is
 * seen.  Cel-shaded like everything else; the form does the work.
 * ---------------------------------------------------------------------- */

/** A ring of `n` points round a superellipse (half-axes a along x, b along z, exponent e) at height y. */
function ring(n, a, b, y, e = 2, cx = 0, cz = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    pts.push(v(cx + a * Math.sign(c) * Math.abs(c) ** (2 / e), y, cz + b * Math.sign(s) * Math.abs(s) ** (2 / e)));
  }
  return pts;
}

/** Skin a stack of rings (equal counts) into one smooth closed surface, the ends fanned shut. */
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

/** A tapering segment from a to b: radius r0 at a, r1 at b, open-ended (the joints cover the ends). */
function taper(a, b, r0, r1, seg = 12) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

/** A matrix placing a part at p in the frame (x across, y along, z toward the palm). */
const frameAt = (x, y, z, p) => new THREE.Matrix4().makeBasis(x, y, z).setPosition(p);

/**
 * One finger: three phalanges from the knuckle B, fanned by `fan` about the
 * palm's normal, curling toward the palm (+z) by `curl` at each joint.  The
 * knuckle, the joints and a rounded tip are spheres; the nail lies on the
 * back of the last segment.
 */
function finger(p, B, fan, L, R, curl) {
  const ax = v(Math.cos(fan), -Math.sin(fan), 0);        // the knuckle axis, fanned with the finger
  const dir = v(Math.sin(fan), Math.cos(fan), 0);
  const q = new THREE.Quaternion();
  let P = B.clone();
  // the knuckle: a little wider than the finger and proud of the back of the hand
  const pd = () => ax.clone().cross(dir).normalize();
  p.add(ellipsoid(R[0] * 1.08, R[0] * 1.0, R[0] * 1.0, 12, 9), SKIN, frameAt(ax, dir, pd(), P.clone().addScaledVector(pd(), -R[0] * 0.1)));
  for (let k = 0; k < 3; k++) {
    dir.applyQuaternion(q.setFromAxisAngle(ax, curl[k])).normalize();
    const Q = P.clone().addScaledVector(dir, L[k]);
    p.add(taper(P, Q, R[k], R[k + 1]), SKIN);
    const palm = pd();
    if (k < 2) {
      // the joint: the middle one stands out most, as it does on a real finger
      const s = k === 0 ? 1.12 : 1.06;
      p.add(ellipsoid(R[k + 1] * s, R[k + 1] * 0.95, R[k + 1] * s, 12, 9), SKIN, frameAt(ax, dir, palm, Q));
    } else {
      // the tip: a pad, fuller toward the palm, and the nail on its back
      p.add(ellipsoid(R[3] * 0.98, R[3] * 1.15, R[3] * 0.98, 12, 9), SKIN, frameAt(ax, dir, palm, Q.clone().addScaledVector(dir, -R[3] * 0.15)));
      const nailAt = P.clone().addScaledVector(dir, L[2] * 0.62).addScaledVector(palm, -R[3] * 0.82);
      const tilt = new THREE.Quaternion().setFromAxisAngle(ax, 0.22);
      const nd = dir.clone().applyQuaternion(tilt), npd = palm.clone().applyQuaternion(tilt);
      p.add(ellipsoid(R[3] * 0.74, L[2] * 0.42, R[3] * 0.34, 12, 8), NAIL, frameAt(ax, nd, npd, nailAt));
    }
    P = Q;
  }
  return P;
}

/** A right hand in a loose grip, and its sleeve. */
function rightHandGeometry() {
  const p = parts();
  const N = 28;

  /* the palm: from the wrist to the knuckle line, flatter on the back,
   * fuller toward the fingers; the four metacarpal ridges rise to the knuckles */
  {
    const st = [[-0.06, 0.0265, 0.0145, 2.2], [-0.048, 0.03, 0.0155, 2.3], [-0.034, 0.035, 0.0162, 2.4], [-0.018, 0.039, 0.016, 2.5],
      [0.002, 0.0415, 0.0152, 2.6], [0.02, 0.0425, 0.0142, 2.7], [0.034, 0.0415, 0.0128, 2.7], [0.044, 0.037, 0.0108, 2.6], [0.05, 0.03, 0.008, 2.4]];
    const rings = st.map(([y, a, b, e]) => ring(N, a, b, y, e, 0.001, 0.001));
    const g = loft(rings);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (z < -0.003 && y > -0.012) {
        const k = clamp01((y + 0.012) / 0.05);
        let bump = 0;
        for (const fx of [0.029, 0.0098, -0.0095, -0.0285]) bump += Math.exp(-(((x - fx) / 0.0068) ** 2));
        pos.setZ(i, z - 0.0024 * k * k * bump);
      } else if (z > 0.004 && y > -0.02 && y < 0.03) {
        pos.setZ(i, z - 0.002 * Math.exp(-((x / 0.02) ** 2)));      // the hollow of the palm
      }
    }
    g.computeVertexNormals();
    p.add(g, SKIN);
    // the pads: the thenar under the thumb, the hypothenar along the little-finger side
    p.add(ellipsoid(0.019, 0.03, 0.013, 14, 10), SKIN, new THREE.Matrix4().makeRotationZ(-0.55).setPosition(0.024, -0.02, 0.011));
    p.add(ellipsoid(0.012, 0.03, 0.01, 12, 9), SKIN, new THREE.Matrix4().makeRotationZ(0.12).setPosition(-0.027, -0.018, 0.009));
  }

  /* the fingers: index, middle, ring, little, each a little more curled than
   * the last (the hand's natural cascade), fanned a little apart */
  finger(p, v(0.029, 0.045, 0.002), 0.1, [0.031, 0.021, 0.017], [0.0092, 0.0085, 0.0078, 0.0068], [0.32, 0.72, 0.3]);
  finger(p, v(0.0098, 0.049, 0.001), 0.02, [0.034, 0.024, 0.018], [0.0094, 0.0087, 0.008, 0.0069], [0.42, 0.8, 0.35]);
  finger(p, v(-0.0095, 0.047, 0.001), -0.06, [0.032, 0.022, 0.017], [0.0088, 0.0082, 0.0075, 0.0065], [0.52, 0.88, 0.4]);
  finger(p, v(-0.0285, 0.039, 0.003), -0.16, [0.025, 0.017, 0.014], [0.0078, 0.0072, 0.0066, 0.0058], [0.68, 0.98, 0.45]);

  /* the thumb: from the heel of the hand, across in front of the fingers,
   * its nail turned outward; the web of skin to the index finger */
  {
    const cmc = v(0.027, -0.03, 0.012), mcp = v(0.053, 0.0, 0.03), ip = v(0.05, 0.028, 0.05), tip = v(0.038, 0.045, 0.06);
    p.add(taper(cmc, mcp, 0.0135, 0.0118), SKIN);
    p.add(ellipsoid(0.0128, 0.0118, 0.0125, 12, 9), SKIN, new THREE.Matrix4().makeTranslation(mcp.x, mcp.y, mcp.z));
    p.add(taper(mcp, ip, 0.0118, 0.0104), SKIN);
    p.add(ellipsoid(0.0112, 0.0104, 0.011, 12, 9), SKIN, new THREE.Matrix4().makeTranslation(ip.x, ip.y, ip.z));
    p.add(taper(ip, tip, 0.0104, 0.0086), SKIN);
    const d = tip.clone().sub(ip).normalize();
    p.add(ellipsoid(0.0086, 0.0098, 0.0086, 12, 9), SKIN, frameAt(v(1, 0, 0).cross(d).normalize(), d, d.clone().cross(v(1, 0, 0).cross(d).normalize()), tip.clone().addScaledVector(d, -0.0012)));
    // the nail faces away from what the hand holds
    const mid = ip.clone().lerp(tip, 0.6), away = mid.clone().sub(v(0.006, 0.036, 0.05));
    away.addScaledVector(d, -away.dot(d)).normalize();
    const across = d.clone().cross(away).normalize();
    p.add(ellipsoid(0.0064, 0.0095, 0.003, 12, 8), NAIL, frameAt(across, d, away.clone().negate(), mid.clone().addScaledVector(away, 0.0072)));
    // the web
    p.add(ellipsoid(0.017, 0.02, 0.0055, 12, 9), SKIN, new THREE.Matrix4().makeRotationZ(-0.9).setPosition(0.04, 0.02, 0.011));
  }

  /* the wrist and forearm: oval, widening away from the hand, leaning back
   * and down out of view; the ulnar bump on the little-finger side */
  {
    const st = [[-0.06, 0.0262, 0.0145], [-0.075, 0.0265, 0.0165], [-0.1, 0.028, 0.019], [-0.16, 0.033, 0.026], [-0.3, 0.04, 0.034]];
    p.add(loft(st.map(([y, a, b]) => ring(N, a, b, y, 2, 0.001 - 0.02 * (y + 0.06), 0.09 * (y + 0.06)))), SKIN);
    p.add(ellipsoid(0.0068, 0.009, 0.0058, 10, 8), SKIN, new THREE.Matrix4().makeTranslation(-0.0255, -0.068, -0.0075));
  }

  /* the shirt cuff at the wrist, its button on the back, and the jacket
   * sleeve over it with a rolled hem */
  {
    const lean = (y) => 0.09 * (y + 0.06), sway = (y) => 0.001 - 0.02 * (y + 0.06);
    p.add(loft([[-0.08, 0.0305, 0.021], [-0.084, 0.0315, 0.022], [-0.118, 0.032, 0.0225]].map(([y, a, b]) => ring(N, a, b, y, 2.2, sway(y), lean(y)))), CUFF);
    p.add(new THREE.CylinderGeometry(0.0046, 0.0046, 0.0024, 12).rotateX(Math.PI / 2), BUTTON, new THREE.Matrix4().makeTranslation(-0.019, -0.099, lean(-0.099) - 0.021));
    p.add(loft([[-0.106, 0.0365, 0.028], [-0.11, 0.0385, 0.03], [-0.118, 0.037, 0.0285], [-0.2, 0.041, 0.033], [-0.42, 0.05, 0.042]].map(([y, a, b]) => ring(N, a, b, y, 2.2, sway(y), lean(y)))), SLEEVE);
  }
  return p.build();
}

export function makeHands(lit) {
  const view = new THREE.Group();
  view.name = 'hands';
  const skinMat = figureMaterial({ onTop: true });
  lit.push(skinMat);

  /* where the hand rests in the camera's frame, and how it is turned */
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
      // the key light for the painted hand stays over your shoulder as you turn
      if (camera) skinMat.uniforms.uLight.value.copy(_key).applyQuaternion(camera.quaternion).normalize();
    },
  };
  return api;
}
const _face = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, 0));
const _key = new THREE.Vector3(-0.45, 0.75, 0.55);
const _qr = new THREE.Quaternion(), _qe = new THREE.Quaternion(), _te = new THREE.Euler();
/* eating: the palm turned toward you, fingers up and leaning in, the food in front of it */
const EAT = new THREE.Euler(-0.2, -0.3, 0.25, 'YXZ');
