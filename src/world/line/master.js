import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { Body, loft, blob, limb, at } from '../animals/shapes.js';

/* ------------------------------------------------------------------ *
 * The station master (駅長): the only person at the station.  Stylised,
 * anime-proportioned: navy uniform with gold buttons and cuff stripes,
 * white gloves, the peaked cap with its gold band and badge, a grey
 * moustache and rosy cheeks.
 *
 * No bones: seven rigid parts (legs, body, head, two upper arms, two
 * forearms), each one vertex-coloured mesh, on pivots.  What he does:
 *
 *   idle     breathes, looks about, watches you when you're near
 *   bow      a proper お辞儀 as you come through the gates (and on E)
 *   point    turns to the arriving train: the white-gloved point (指差喚呼),
 *            then a wave
 *   whistle  before it leaves: the whistle to his lips, one long blast,
 *            then his arm held high until it pulls away
 *
 * He faces +z in his own frame; `yaw` turns him.  Updates only when near.
 * ------------------------------------------------------------------ */

const NAVY = 0x1f2a4c, NAVY_D = 0x18203c, GOLD = 0xd9b24a, WHITE = 0xf8f6f0, SKIN = 0xf6d6bf, HAIR = 0x9c9ca8;
const SHOE = 0x1a1a20, TIE = 0x9a2a36, BLUSH = 0xf0a0a0, INK = 0x1c1a22, VISOR = 0x15151c;

const HIP = [0, 0.86, 0], NECK = [0, 1.43, 0];
const SHOULDER = [[-0.2, 1.335, 0], [0.2, 1.335, 0]];          // [right, left]: he faces +z, so his right is -x
const ELBOW = [[-0.225, 1.075, 0.0], [0.225, 1.075, 0.0]];

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }

/** Build a part in the figure's frame, then move it so its pivot is the origin. */
function part(fill, pivot) {
  const b = new Body();
  fill(b);
  const g = b.build();
  g.translate(-pivot[0], -pivot[1], -pivot[2]);
  g.deleteAttribute('aJoint');
  g.deleteAttribute('aMorph');
  return g;
}

function geometries() {
  const legs = part((b) => {
    for (const s of [-1, 1]) {
      b.add(limb([s * 0.085, 0.88, 0], [s * 0.088, 0.1, 0.0], 0.078, 0.06, 10), { color: NAVY_D });
      b.add(blob(0.058, 0.045, 0.12, 10, 7), { matrix: at(s * 0.09, 0.045, 0.035), color: SHOE });
    }
  }, [0, 0, 0]);

  const body = part((b) => {
    // the jacket: a loft from the hem to the shoulders
    b.add(loft([
      { p: [0, 0.76, 0], rx: 0.0, ry: 0.0 },
      { p: [0, 0.77, 0], rx: 0.19, ry: 0.13 },
      { p: [0, 0.92, 0], rx: 0.178, ry: 0.122 },
      { p: [0, 1.06, 0], rx: 0.168, ry: 0.116 },
      { p: [0, 1.22, 0], rx: 0.186, ry: 0.122 },
      { p: [0, 1.33, 0], rx: 0.2, ry: 0.118 },
      { p: [0, 1.39, 0], rx: 0.13, ry: 0.09 },
      { p: [0, 1.41, 0], rx: 0.0, ry: 0.0 },
    ], 18, [0, 1, 0], 2), {
      color: NAVY,
    });
    // the V at the collar: shirt, tie, and the lapels' edges (their own shapes: vertex colours would smear)
    b.add(new THREE.ShapeGeometry(new THREE.Shape([[-0.068, 1.395], [0.068, 1.395], [0, 1.245]].map(([x, y]) => new THREE.Vector2(x, y - 1.32)))),
      { matrix: at(0, 1.32, 0.121, -0.2, 0, 0), color: WHITE });
    b.add(new THREE.ShapeGeometry(new THREE.Shape([[-0.013, 1.385], [0.013, 1.385], [0.016, 1.275], [0, 1.255], [-0.016, 1.275]].map(([x, y]) => new THREE.Vector2(x, y - 1.32)))),
      { matrix: at(0, 1.32, 0.1235, -0.2, 0, 0), color: TIE });
    // the collar round the neck
    b.add(new THREE.CylinderGeometry(0.056, 0.06, 0.035, 14, 1, true), { matrix: at(0, 1.395, 0.004), color: WHITE });
    // the neck
    b.add(limb([0, 1.36, 0], [0, 1.47, 0], 0.046, 0.044, 10), { color: SKIN });
    // the buttons, double-breasted, and the name plate
    for (const y of [0.93, 1.03, 1.13]) for (const x of [-0.05, 0.05]) b.add(blob(0.013, 0.013, 0.008, 8, 6), { matrix: at(x, y, 0.118), color: GOLD });
    b.add(new THREE.BoxGeometry(0.07, 0.022, 0.006), { matrix: at(0.1, 1.24, 0.118), color: WHITE });
    // gold on the shoulders (the station master's boards)
    for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.1, 0.012, 0.07), { matrix: at(s * 0.155, 1.365, 0, 0, 0, s * -0.3), color: GOLD });
  }, HIP);

  const head = part((b) => {
    const H = [0, 1.555, 0.005];
    b.add(blob(0.116, 0.12, 0.11, 20, 16), { matrix: at(...H), color: SKIN });
    b.add(blob(0.121, 0.1, 0.1, 16, 12), { matrix: at(0, 1.585, -0.026), color: HAIR });   // grey at the sides and back
    for (const s of [-1, 1]) {
      b.add(blob(0.022, 0.034, 0.016, 8, 6), { matrix: at(s * 0.116, 1.55, -0.004), color: SKIN });            // ears
      // anime eyes: tall dark ovals, a white glint in each
      b.add(blob(0.016, 0.027, 0.012, 10, 8), { matrix: at(s * 0.042, 1.566, 0.101, 0, s * 0.35, 0), color: INK });
      b.add(blob(0.0065, 0.0085, 0.005, 6, 5), { matrix: at(s * 0.038, 1.577, 0.111), color: WHITE });
      b.add(new THREE.BoxGeometry(0.036, 0.008, 0.01), { matrix: at(s * 0.045, 1.609, 0.1, 0, s * 0.35, s * -0.18), color: HAIR });   // brows
      b.add(blob(0.021, 0.012, 0.006, 8, 6), { matrix: at(s * 0.07, 1.528, 0.09, 0, s * 0.6, 0), color: BLUSH });                   // cheeks
      // the moustache, a half each side, drooping a little
      b.add(blob(0.028, 0.011, 0.014, 8, 6), { matrix: at(s * 0.022, 1.508, 0.107, 0, s * 0.25, s * -0.25), color: HAIR });
    }
    b.add(blob(0.012, 0.01, 0.012, 8, 6), { matrix: at(0, 1.537, 0.113), color: SKIN });              // nose
    b.add(blob(0.014, 0.004, 0.004, 6, 4), { matrix: at(0, 1.488, 0.104), color: 0x8a3a3a });          // mouth
    // the cap: crown, gold band, badge, black visor
    const cap = (y) => y;
    b.add(new THREE.CylinderGeometry(0.132, 0.117, 0.085, 22), { matrix: at(0, cap(1.688), -0.006, -0.08, 0, 0), color: NAVY });
    b.add(new THREE.CylinderGeometry(0.133, 0.133, 0.012, 22), { matrix: at(0, cap(1.731), -0.01, -0.08, 0, 0), color: NAVY_D });
    b.add(new THREE.CylinderGeometry(0.1205, 0.1195, 0.03, 22), { matrix: at(0, cap(1.66), -0.004), color: GOLD });
    b.add(blob(0.022, 0.024, 0.008, 10, 8), { matrix: at(0, 1.695, 0.128, -0.08, 0, 0), color: GOLD });
    const visor = new THREE.CylinderGeometry(0.118, 0.118, 0.012, 20, 1, false, -Math.PI / 2, Math.PI);
    visor.scale(1, 1, 0.62);
    b.add(visor, { matrix: at(0, 1.642, 0.03, 0.28, 0, 0), color: VISOR });
  }, NECK);

  const upper = (i) => part((b) => {
    const s = i ? 1 : -1;
    b.add(limb(SHOULDER[i], ELBOW[i], 0.056, 0.048, 10), { color: NAVY });
    b.add(blob(0.062, 0.058, 0.062, 10, 8), { matrix: at(...SHOULDER[i]), color: NAVY });
    void s;
  }, SHOULDER[i]);

  const fore = (i) => part((b) => {
    const s = i ? 1 : -1;
    const wrist = [s * 0.232, 0.84, 0.012];
    b.add(limb(ELBOW[i], wrist, 0.047, 0.04, 10), { color: NAVY });
    b.add(new THREE.CylinderGeometry(0.043, 0.043, 0.02, 12, 1, true), { matrix: at(s * 0.231, 0.872, 0.011), color: GOLD });     // the cuff's gold line
    // the white glove, and a pointing finger (reads as a flat hand at rest)
    b.add(blob(0.04, 0.056, 0.03, 10, 8), { matrix: at(s * 0.234, 0.79, 0.016), color: WHITE });
    b.add(limb([s * 0.232, 0.76, 0.03], [s * 0.232, 0.705, 0.034], 0.011, 0.009, 6), { color: WHITE });
    b.add(blob(0.012, 0.024, 0.012, 6, 5), { matrix: at(s * 0.206, 0.79, 0.03, 0, 0, s * 0.4), color: WHITE });     // thumb
  }, ELBOW[i]);

  const whistle = part((b) => {
    b.add(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 8), { matrix: at(0, 0, 0.02, Math.PI / 2, 0, 0), color: 0xc8ccd6 });
    b.add(blob(0.018, 0.018, 0.018, 8, 6), { matrix: at(0, -0.006, 0.05), color: 0xc8ccd6 });
  }, [0, 0, 0]);

  return { legs, body, head, upper: [upper(0), upper(1)], fore: [fore(0), fore(1)], whistle };
}

/* the poses: target angles for each joint */
const REST = { bow: 0, headX: 0, headY: 0, sx: [0.06, 0.06], sz: [0.08, -0.08], ex: [-0.12, -0.12], ez: [0, 0] };
const pose = (o) => ({ ...REST, ...o, sx: o.sx ?? REST.sx, sz: o.sz ?? REST.sz, ex: o.ex ?? REST.ex, ez: o.ez ?? REST.ez });

export function buildMaster(ctx, { x, z, y = 0, yaw = 0 }) {
  const G = geometries();
  const mat = cel({ color: 0xffffff, bands: 3, tint: 0x6c5f8c, flat: false, vertexColors: true, cache: false });
  const root = new THREE.Group();
  root.name = 'station-master';
  root.position.set(x, y, z);
  root.rotation.y = yaw;
  root.userData.dynamic = true;
  const mesh = (g) => { const m = new THREE.Mesh(g, mat); m.castShadow = true; return m; };
  root.add(mesh(G.legs));
  const hips = new THREE.Group(); hips.position.set(...HIP); root.add(hips);
  hips.add(mesh(G.body));
  const head = new THREE.Group(); head.position.set(...sub(NECK, HIP)); hips.add(head);
  head.add(mesh(G.head));
  const sh = [], el = [];
  for (const i of [0, 1]) {
    const s = new THREE.Group(); s.position.set(...sub(SHOULDER[i], HIP)); hips.add(s);
    s.add(mesh(G.upper[i]));
    const e = new THREE.Group(); e.position.set(...sub(ELBOW[i], SHOULDER[i])); s.add(e);
    e.add(mesh(G.fore[i]));
    sh.push(s); el.push(e);
  }
  // the whistle, in his right hand, shown only while he blows it
  const whistle = mesh(G.whistle);
  whistle.position.set(...sub([-0.232, 0.77, 0.04], ELBOW[0]));
  whistle.visible = false;
  el[0].add(whistle);
  ctx.add(root);
  ctx.collide(x - 0.3, z - 0.3, x + 0.3, z + 0.3, y + 1.8);

  const cur = pose({});
  let target = pose({});
  let yawTarget = yaw, baseYaw = yaw;
  let t = 0, act = null, bowCool = 0, lookT = 0, lookY = 0;

  /** Actions are timelines: a list of [until, pose(t), onStart]. */
  function play(name, steps, face = null) {
    act = { name, steps, t: 0, i: -1, face };
  }
  const api = {
    root,
    get busy() { return act?.name ?? null; },
    /** A bow: as you come through the gates, or when you greet him. */
    bow(force = false) {
      if (!force && (act || bowCool > 0)) return false;
      bowCool = 7;
      play('bow', [
        [0.55, () => pose({ bow: 0.55, headX: 0.18, sx: [0.22, 0.22], sz: [0.04, -0.04], ex: [-0.25, -0.25] })],
        [1.45, () => pose({ bow: 0.55, headX: 0.18, sx: [0.22, 0.22], sz: [0.04, -0.04], ex: [-0.25, -0.25] })],
        [2.1, () => pose({})],
      ]);
      return true;
    },
    /** The train is in: point at it, then wave it in. `at` where to face (his frame's parent). */
    point(atXZ) {
      play('point', [
        [0.7, () => pose({})],
        [2.6, () => pose({ sx: [-1.5, 0.1], sz: [0.12, -0.1], ex: [-0.05, -0.12], headX: -0.04 })],
        [5.2, (k) => pose({ sx: [-0.35, 0.06], sz: [-2.55, -0.08], ex: [0, -0.12], ez: [0.35 * Math.sin(k * 9), 0], headX: -0.08 })],
        [6.0, () => pose({})],
      ], atXZ);
    },
    /** Before it leaves: whistle, then the arm up until it goes. */
    whistle(atXZ, onBlow) {
      play('whistle', [
        [0.6, () => pose({ sx: [-0.95, 0.06], sz: [0.5, -0.08], ex: [-1.85, -0.12], headX: 0.05 }), () => { whistle.visible = true; }],
        [2.0, () => pose({ sx: [-0.95, 0.06], sz: [0.5, -0.08], ex: [-1.85, -0.12], headX: -0.1 }), onBlow],
        [2.5, () => pose({}), () => { whistle.visible = false; }],
        [5.5, () => pose({ sx: [0.06, -0.2], sz: [0.08, 2.75], ex: [-0.12, -0.1], headX: -0.05 })],
        [6.3, () => pose({})],
      ], atXZ);
    },
    /**
     * Each frame, when near.  `you` is the player in the same frame as his
     * position ({ x, z } or null).
     */
    update(dt, you) {
      t += dt;
      bowCool = Math.max(0, bowCool - dt);
      if (act) {
        act.t += dt;
        let i = act.steps.findIndex(([until]) => act.t < until);
        if (i < 0) { act = null; whistle.visible = false; target = pose({}); }
        else {
          if (i !== act.i) { act.i = i; act.steps[i][2]?.(); }
          target = act.steps[i][1](act.t);
        }
      }
      // where he faces: the thing he's attending to, or back to his post
      if (act?.face) yawTarget = Math.atan2(act.face.x - root.position.x, act.face.z - root.position.z);
      else yawTarget = baseYaw;
      let dy = ((yawTarget - root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      root.rotation.y += dy * Math.min(1, dt * 3.2);
      // the head: watch you when you're close, else look about now and then
      lookT -= dt;
      let headY = 0;
      if (you) {
        const d = Math.hypot(you.x - root.position.x, you.z - root.position.z);
        if (d < 9 && !act) {
          const a = Math.atan2(you.x - root.position.x, you.z - root.position.z) - root.rotation.y;
          headY = THREE.MathUtils.clamp(((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -0.9, 0.9);
        }
      }
      if (!headY && !act) {
        if (lookT < 0) { lookT = 2.5 + Math.random() * 3; lookY = (Math.random() - 0.5) * 1.1; }
        headY = lookY;
      }
      const k = Math.min(1, dt * 7);
      cur.bow += (target.bow - cur.bow) * k;
      cur.headX += (target.headX - cur.headX) * k;
      cur.headY += ((act ? 0 : headY) - cur.headY) * Math.min(1, dt * 3);
      for (const j of [0, 1]) {
        cur.sx[j] += (target.sx[j] - cur.sx[j]) * k;
        cur.sz[j] += (target.sz[j] - cur.sz[j]) * k;
        cur.ex[j] += (target.ex[j] - cur.ex[j]) * k;
        cur.ez[j] += (target.ez[j] - cur.ez[j]) * Math.min(1, dt * 14);
      }
      // breathing
      const br = Math.sin(t * 1.6) * 0.012;
      hips.rotation.x = cur.bow + br * 0.3;
      head.rotation.set(cur.headX - br, cur.headY, 0);
      for (const j of [0, 1]) {
        sh[j].rotation.set(cur.sx[j], 0, cur.sz[j] + (j ? -1 : 1) * br * 0.5);
        el[j].rotation.set(cur.ex[j], 0, cur.ez[j]);
      }
    },
    /** Snap to the current target (screenshots). */
    settle() { for (let i = 0; i < 40; i++) api.update(1 / 20, null); },
  };
  api.update(0, null);
  return api;
}
