import * as THREE from 'three';
import { figureMaterial, onTopClamped, parts, mirrorX, ellipsoid, limb, easeBack, ease, clamp01 } from './figure.js';

/* ------------------------------------------------------------------ *
 * Your hands (Tan's konbini): two cartoon hands that rise from the bottom
 * of the view as you walk into the store.  The left holds your folded
 * ¥1,000 note; the right takes what you pick.  A second item goes to the
 * left hand, the note tucked under its thumb, so two full hands read as
 * "that's your two".  After paying, the change sits in the left palm.
 *
 * Painted like the cashier (store/figure.js), drawn on top of the world
 * and near-clamped.  They live in the camera's frame: `view` (shop.js)
 * follows the camera, and each hand is a pivot at the wrist whose offset
 * and turn the choreography (rise, pay, eat) drives.
 *
 * Hand frame: the palm at the origin, fingers +y, palm facing +z, a right
 * hand's thumb on +x.
 * ------------------------------------------------------------------ */

const SKIN = 0xf8d3b8, SKIN_LINE = 0xeab89c, SLEEVE = 0x4b5d95, CUFF = 0xeae6de;
const v = (x, y, z) => new THREE.Vector3(x, y, z);

/** A right hand in a loose grip, and its sleeve. */
function rightHandGeometry() {
  const p = parts();
  p.add(ellipsoid(0.043, 0.05, 0.02), SKIN);                       // the palm
  p.add(ellipsoid(0.03, 0.02, 0.018), SKIN, new THREE.Matrix4().makeTranslation(0.012, -0.03, 0.006));   // the heel of the thumb
  // four fingers, each two segments curling round toward +z (the grip)
  const fingers = [[0.027, 0.03, 0.0095], [0.009, 0.034, 0.0098], [-0.009, 0.031, 0.0095], [-0.026, 0.024, 0.0085]];
  for (const [x, len, r] of fingers) {
    const b = v(x, 0.04, 0.004), j = v(x * 1.04, 0.04 + len, 0.016), tip = v(x * 1.06, 0.045 + len + 0.004, 0.044);
    p.add(limb(b, j, r), SKIN);
    p.add(limb(j, tip, r * 0.95), SKIN);
    p.add(ellipsoid(r * 0.8, r * 0.5, r * 0.4), SKIN_LINE, new THREE.Matrix4().makeTranslation(j.x, j.y, j.z - r * 0.7));   // the knuckle crease
  }
  // the thumb, from the heel of the hand, round the object to meet the fingers
  p.add(limb(v(0.036, -0.018, 0.008), v(0.055, 0.012, 0.028), 0.0115), SKIN);
  p.add(limb(v(0.055, 0.012, 0.028), v(0.046, 0.034, 0.05), 0.0105), SKIN);
  // the wrist and forearm, running back and down out of view
  p.add(limb(v(0, -0.04, -0.002), v(0.004, -0.26, -0.02), 0.027), SKIN);
  // a sleeve with a white cuff peeking out
  const sleeve = new THREE.CylinderGeometry(0.042, 0.05, 0.36, 16, 1, false);     // closed: a hand tipped up shows the sleeve's end
  p.add(sleeve, SLEEVE, new THREE.Matrix4().makeTranslation(0.004, -0.29, -0.02));
  p.add(new THREE.CylinderGeometry(0.036, 0.036, 0.02, 16), CUFF, new THREE.Matrix4().makeTranslation(0.004, -0.115, -0.014));
  p.add(new THREE.TorusGeometry(0.044, 0.006, 6, 18).rotateX(Math.PI / 2), SLEEVE, new THREE.Matrix4().makeTranslation(0.004, -0.112, -0.016));
  return p.build();
}

/** The folded ¥1,000 note: generic, pale blue-green, 1000 large. */
function noteTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#cfe2da'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#b4d0c8'; g.fillRect(0, 0, 128, 14); g.fillRect(0, 114, 128, 14);
  g.strokeStyle = '#6f9a90'; g.lineWidth = 3; g.strokeRect(6, 6, 116, 116);
  g.fillStyle = 'rgba(111,154,144,0.35)'; g.beginPath(); g.arc(88, 62, 26, 0, 7); g.fill();
  g.fillStyle = '#2f5a52'; g.font = 'bold 34px ui-sans-serif, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('1000', 50, 44);
  g.font = 'bold 22px "Hiragino Kaku Gothic ProN", sans-serif';
  g.fillText('千円', 50, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Coins for `yen` of change, piled in a palm: one mesh, the way a konbini counts it back. */
const COINS = [[500, 0.0132, 0xd8c070], [100, 0.0113, 0xd6d9de], [50, 0.0105, 0xdadde2], [10, 0.0117, 0xc0804e], [5, 0.011, 0xdcb85a], [1, 0.01, 0xe8eaee]];
export function coinGeometry(yen) {
  const p = parts();
  let left = yen, k = 0;
  for (const [val, r, col] of COINS) {
    while (left >= val && k < 14) {
      left -= val;
      const a = k * 2.1, rr = 0.004 + 0.009 * ((k % 4) / 3);
      p.add(new THREE.CylinderGeometry(r, r, 0.0024, 14), col, new THREE.Matrix4().makeRotationX(0.25 * Math.sin(k)).setPosition(Math.cos(a) * rr, 0.0028 * Math.floor(k / 3), Math.sin(a) * rr));
      k++;
    }
  }
  if (!p.length) p.add(new THREE.CylinderGeometry(0.001, 0.001, 0.001, 3), COINS[1][2]);
  return p.build();
}

export function makeHands(lit) {
  const view = new THREE.Group();
  view.name = 'hands';
  const skinMat = figureMaterial({ onTop: true });
  lit.push(skinMat);
  const rightGeo = rightHandGeometry(), leftGeo = mirrorX(rightGeo);

  /* where each hand rests in the camera's frame, and how it is turned */
  const REST = {
    R: { pos: v(0.195, -0.142, -0.465), rot: new THREE.Euler(0.25, -2.3, 0.15, 'YXZ') },
    L: { pos: v(-0.205, -0.147, -0.465), rot: new THREE.Euler(0.25, 2.3, -0.15, 'YXZ') },
  };
  const make = (side, geo) => {
    const pivot = new THREE.Group();
    pivot.name = 'hand-' + side;
    const mesh = new THREE.Mesh(geo, skinMat);
    mesh.frustumCulled = false; mesh.renderOrder = 10;
    pivot.add(mesh);
    // where a held thing sits, turned to face you whatever the hand's turn
    const anchor = new THREE.Group();
    anchor.position.set(side === 'R' ? 0.006 : -0.006, 0.036, 0.05);
    pivot.add(anchor);
    view.add(pivot);
    return { side, pivot, mesh, anchor, rest: REST[side], off: v(0, 0, 0), turn: new THREE.Euler(0, 0, 0, 'XYZ'), eat: 0, item: null };
  };
  const R = make('R', rightGeo), L = make('L', leftGeo);

  // the note, folded in half and pinched in the left hand
  const noteMat = onTopClamped(new THREE.MeshBasicMaterial({ map: noteTexture(), side: THREE.DoubleSide }));
  lit.push(noteMat);
  const note = new THREE.Group();
  for (const s of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.07), noteMat);
    leaf.position.set(s * 0.034 * Math.cos(0.3), 0, s * 0.01);
    leaf.rotation.y = s * 0.3;
    leaf.frustumCulled = false; leaf.renderOrder = 11;
    note.add(leaf);
  }
  note.name = 'yen-note';
  // coins, once there is change
  const coins = new THREE.Mesh(coinGeometry(0), skinMat);
  coins.frustumCulled = false; coins.renderOrder = 11; coins.visible = false;
  L.pivot.add(coins);
  coins.position.set(-0.004, 0.012, 0.032);
  coins.rotation.set(-1.25, 0, 0);

  /* ------------------------------ state ------------------------------ */
  let up = 0, want = 0;          // 0 down out of view .. 1 raised
  let t = 0;
  const api = {
    view, R, L, note, coins, skinMat,
    get up() { return up; },
    get raised() { return want === 1; },
    /** Raise (true) or lower (false) both hands. */
    raise(on) { want = on ? 1 : 0; },
    /** Put them straight up or down (dev shots). */
    snap(on) { want = up = on ? 1 : 0; },
    /** The hand's grip turn: its rest, blended by `h.eat` to palm-toward-you (eating). */
    grip(h, out) {
      out.setFromEuler(h.rest.rot);
      if (h.eat > 0) out.slerp(_qe.setFromEuler(EAT[h.side]), h.eat);
      return out;
    },
    /** Where item `i` sits: 0 the right hand, 1 the left. */
    anchor(i) { return i === 0 ? R.anchor : L.anchor; },
    /** Show the note (in the left hand) or not; where it sits depends on what else the hand holds. */
    showNote(on) { note.visible = on; },
    /** The change, as coins in the left palm (0: none). */
    setChange(yen) {
      coins.geometry.dispose();
      coins.geometry = coinGeometry(yen);
      coins.visible = yen > 0;
    },
    update(dt, bob = 0, camera = null) {
      t += dt;
      // rising pops up with a little overshoot; lowering is quicker and plain
      if (want > up) up = Math.min(1, up + dt / 0.55); else if (want < up) up = Math.max(0, up - dt / 0.4);
      const k = want ? easeBack(clamp01(up)) : ease(clamp01(up));
      for (const h of [R, L]) {
        const sway = h === R ? 1 : -1;
        h.pivot.position.copy(h.rest.pos).add(h.off);
        h.pivot.position.y += (1 - k) * -0.42 + Math.sin(bob) * 0.006 + Math.sin(t * 1.3 + sway) * 0.0025;
        h.pivot.position.x += Math.cos(bob * 0.5) * 0.004 * sway;
        // its grip (resting, or turned palm-to-you to eat), then `turn` in the
        // camera's own terms (x tips the top toward you)
        api.grip(h, _qr);
        h.pivot.quaternion.setFromEuler(_te.set(h.turn.x, h.turn.y, h.turn.z, 'XYZ')).multiply(_qr);
        h.pivot.visible = up > 0.001;
        // what the hand holds faces you, turned only by `turn`
        h.anchor.quaternion.copy(_qr).invert().multiply(_face);
      }
      // the note: pinched in the left hand, or tucked under its thumb when the hand is full
      if (L.item) { note.position.set(-0.022, 0.03, 0.03); note.rotation.set(-0.2, 0.5, 0.35); }
      else { note.position.set(-0.008, 0.06, 0.042); note.rotation.set(-0.35, 0.2, 0.12); }
      // the key light for the painted hands stays over your shoulder as you turn
      if (camera) skinMat.uniforms.uLight.value.copy(_key).applyQuaternion(camera.quaternion).normalize();
    },
  };
  L.pivot.add(note);
  return api;
}
const _face = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, 0));
const _key = new THREE.Vector3(-0.45, 0.75, 0.55);
const _qr = new THREE.Quaternion(), _qe = new THREE.Quaternion(), _te = new THREE.Euler();
/* eating: the palm turned toward you, fingers up and leaning in, the food in front of it */
const EAT = { R: new THREE.Euler(-0.2, -0.3, 0.25, 'YXZ'), L: new THREE.Euler(-0.2, 0.3, -0.25, 'YXZ') };
