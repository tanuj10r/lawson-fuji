import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { rngKit } from '../../core/util.js';
import { soundBus } from '../../core/soundBus.js';
import { TOWN, SLOWLIFE } from '../../config.js';
import { makeParts } from './geo.js';
import { pondShore } from './pond.js';

/* ------------------------------------------------------------------ *
 * ひと休み, the slow-life spot (Tan's experiences, 2026-09-28): where the
 * paddies meet 鏡池's lawn, a weathered wooden bench under one old
 * sakura, a stone jizo in a red bib and cap keeping it company, a small
 * stone lantern toward the water.  The paddies' water behind, the pond
 * ahead, and beyond the railway, Fuji.  Tan's afternoon on a bench by a
 * pond outside Nara, reading for hours.
 *
 * `E` at the bench sits you down (core/player.js sit()): the eye lowers,
 * the view turns to the water and Fuji, the flute (rural-flute) rises,
 * and time slows: the petals round the bench drift slower, the two
 * cabbage whites flutter lazier, the pond glints.  Any key stands you up.
 *
 * Cost: the stone and the wood are static (they fold into the town's
 * batches); three small InstancedMeshes move (petals, butterflies, the
 * water's glints), only within `near` of the bench.  The tree is one more
 * town sakura (kit/sakura.js batch).  Laid out by config.js SLOWLIFE, in
 * the town's (turned) frame.
 * ------------------------------------------------------------------ */

/** The bench's own wood: silvered by years of weather, not park-new. */
function mats() {
  return {
    oldWood: cel({ color: 0xbea488, bands: 3, tint: 0x76606e }),
    oldWoodDark: cel({ color: 0x8e765f, bands: 3, tint: 0x5a4860 }),
    jizoStone: cel({ color: 0xb9b6ac, bands: 3, tint: 0x5e5a78 }),
    moss: cel({ color: 0x8fa86a, bands: 3, tint: 0x4f6a60 }),
    bib: cel({ color: 0xd8403a, bands: 3, tint: 0x80304e }),
    lanternStone: cel({ color: 0xaaa69c, bands: 3, tint: 0x5a5676 }),
    lanternLight: flat({ color: 0xfff1d6 }),
  };
}

/** A geometry placed: rotated about y by `ry`, then moved to (x, y, z). */
function put(g, x, y, z, ry = 0) {
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}
/** A box in an object's own frame (centre cx, cy, cz), then placed. */
function lbox(w, h, d, cx, cy, cz, at, tilt = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (tilt) g.rotateX(tilt);
  g.translate(cx, cy, cz);
  return put(g, at.x, 0, at.z, at.ry);
}

/** The bench: two old planks on sawn trestles, a backrest on leaning posts. */
function bench(parts, at) {
  const L = 1.9;
  // the seat: two thick planks, a finger's gap, one a little warped
  parts.add('oldWood', lbox(L, 0.055, 0.2, 0, 0.445, 0.11, at));
  parts.add('oldWood', lbox(L - 0.04, 0.055, 0.2, 0.01, 0.44, -0.11, at, 0.02));
  // the trestles: a thick block each end, a rail under
  for (const s of [-1, 1]) {
    parts.add('oldWoodDark', lbox(0.1, 0.42, 0.44, s * 0.72, 0.21, 0, at));
    parts.add('oldWoodDark', lbox(0.14, 0.06, 0.5, s * 0.72, 0.03, 0, at));
    // the backrest's posts, leaning back
    parts.add('oldWoodDark', lbox(0.07, 0.55, 0.07, s * 0.72, 0.7, -0.26, at, -0.14));
  }
  parts.add('oldWoodDark', lbox(1.44, 0.05, 0.06, 0, 0.14, 0, at));
  // the backrest: one wide board and a thin one
  parts.add('oldWood', lbox(L - 0.1, 0.16, 0.045, 0, 0.84, -0.3, at, -0.14));
  parts.add('oldWood', lbox(L - 0.2, 0.08, 0.04, 0, 0.64, -0.28, at, -0.14));
}

/** A stone jizo (地蔵) on a plinth: a small round-headed monk in a red
 * bib and knitted cap, hands together, an offering at his feet. */
function jizo(parts, scatter, at) {
  const P = (g) => put(g, at.x, 0, at.z, at.ry);
  // the plinth (a rough block) and a lotus seat
  parts.add('graniteDark', lbox(0.5, 0.2, 0.44, 0, 0.1, 0, at));
  parts.add('jizoStone', P(new THREE.CylinderGeometry(0.2, 0.18, 0.08, 12).translate(0, 0.24, 0)));
  // the robe: one turned profile from the seat to the neck, sloping shoulders
  const robe = new THREE.LatheGeometry([
    [0.17, 0.28], [0.165, 0.4], [0.15, 0.56], [0.135, 0.66], [0.11, 0.72], [0.06, 0.755], [0.0, 0.76],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 14);
  parts.add('jizoStone', P(robe));
  // the head: round and a little large, as they are carved
  const head = new THREE.SphereGeometry(0.105, 12, 9);
  head.scale(1, 1.08, 0.97);
  parts.add('jizoStone', P(head.translate(0, 0.845, 0)));
  // moss where the rain sits
  const moss = new THREE.SphereGeometry(0.07, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  moss.scale(1.5, 0.45, 1.2);
  parts.add('moss', P(moss.translate(-0.08, 0.27, 0.1)));
  // the red bib (よだれかけ): a cloth apron from the neck, over the chest, round at the hem
  const bib = new THREE.CylinderGeometry(0.118, 0.172, 0.2, 14, 1, true, -Math.PI * 0.55, Math.PI * 1.1);
  parts.add('bib', P(bib.translate(0, 0.635, 0)));
  // the knitted cap on the crown
  const cap = new THREE.SphereGeometry(0.104, 12, 5, 0, Math.PI * 2, 0, Math.PI * 0.3);
  parts.add('bib', P(cap.translate(0, 0.857, 0)));
  const brim = new THREE.TorusGeometry(0.086, 0.016, 5, 14);
  brim.rotateX(Math.PI / 2);
  parts.add('bib', P(brim.translate(0, 0.9, 0)));
  // an offering cup, and wildflowers someone left
  parts.add('lanternLight', P(new THREE.CylinderGeometry(0.035, 0.028, 0.05, 8).translate(0.17, 0.225, 0.13)));
  const c = Math.cos(at.ry), s = Math.sin(at.ry);
  const loc = (lx, lz) => [at.x + lx * c + lz * s, at.z - lx * s + lz * c];
  const [fx, fz] = loc(-0.16, 0.14);
  scatter.put('tuft', fx, 0.2, fz, 0.1, 0.16, 0.1, 0.3, 0x7fa65a);
  scatter.put('head', fx + 0.02, 0.35, fz, 0.024, 0.03, 0.024, 0, 0xf2e27a);
  scatter.put('head', fx - 0.03, 0.33, fz + 0.02, 0.022, 0.03, 0.022, 0, 0xffffff);
}

/** A small stone lantern (石灯籠): base, post, fire box, roof, jewel. */
function lantern(parts, at) {
  const hex = (r0, r1, h, y) => put(new THREE.CylinderGeometry(r0, r1, h, 6).translate(0, y, 0), at.x, 0, at.z, at.ry);
  parts.add('lanternStone', hex(0.24, 0.27, 0.1, 0.05));
  parts.add('lanternStone', hex(0.2, 0.22, 0.08, 0.14));
  parts.add('lanternStone', put(new THREE.CylinderGeometry(0.075, 0.09, 0.5, 8).translate(0, 0.43, 0), at.x, 0, at.z, at.ry));
  parts.add('lanternStone', hex(0.22, 0.16, 0.1, 0.72));
  // the fire box: four corner posts round a lit paper core
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) parts.add('lanternStone', lbox(0.06, 0.24, 0.06, sx * 0.12, 0.89, sz * 0.12, at));
  parts.add('lanternLight', lbox(0.2, 0.2, 0.2, 0, 0.89, 0, at));
  parts.add('lanternStone', lbox(0.3, 0.035, 0.3, 0, 0.785, 0, at));
  // the roof: a low six-sided cap with its eaves, and the jewel
  parts.add('lanternStone', hex(0.36, 0.36, 0.04, 1.03));
  parts.add('lanternStone', put(new THREE.ConeGeometry(0.34, 0.2, 6).translate(0, 1.15, 0), at.x, 0, at.z, at.ry));
  parts.add('lanternStone', put(new THREE.SphereGeometry(0.055, 8, 6).translate(0, 1.29, 0), at.x, 0, at.z, at.ry));
  parts.add('moss', put(new THREE.CylinderGeometry(0.2, 0.3, 0.02, 6).translate(0, 1.055, 0), at.x, 0, at.z, at.ry + 0.3));
}

/* ------------------------------ moving life ------------------------------ */

/** A sakura petal: a rounded teardrop with the notch at its tip. */
function petalGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.02);
  s.bezierCurveTo(0.014, -0.012, 0.02, 0.008, 0.012, 0.02);
  s.lineTo(0, 0.013);
  s.lineTo(-0.012, 0.02);
  s.bezierCurveTo(-0.02, 0.008, -0.014, -0.012, 0, -0.02);
  return new THREE.ShapeGeometry(s, 3);
}
/** A cabbage white's wing: hinged at x 0, a rounded fore- and hindwing. */
function wingGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.004);
  s.bezierCurveTo(0.018, 0.03, 0.05, 0.034, 0.052, 0.012);
  s.bezierCurveTo(0.054, -0.006, 0.036, -0.01, 0.03, -0.012);
  s.bezierCurveTo(0.036, -0.03, 0.016, -0.04, 0, -0.012);
  s.lineTo(0, 0.004);
  const g = new THREE.ShapeGeometry(s, 3);
  g.rotateX(-Math.PI / 2);        // lies flat (x out along the wing, z along the body)
  return g;
}
/** A glint on the water: a thin diamond streak, stood up to face you. */
function glintGeo() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 0, -0.12, 0, 1, 0, 0, 0, 0.12, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

function inside(pts, x, z) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > z) !== (b.y > z) && x < ((b.x - a.x) * (z - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

export function buildSlowLife(ctx, scatter) {
  const S = SLOWLIFE;
  const r = rngKit(9301);
  const M = mats();
  const parts = makeParts({ ...M, graniteDark: cel({ color: 0xa6a298, bands: 3, tint: 0x5f5880 }) });
  const B = { x: S.bench[0], z: S.bench[1], ry: S.bench[2] };

  /* ---- the place ---- */
  bench(parts, B);
  const J = { x: S.jizo[0], z: S.jizo[1], ry: S.jizo[2] };
  jizo(parts, scatter, J);
  const Ln = { x: S.lantern[0], z: S.lantern[1], ry: S.lantern[2] };
  lantern(parts, Ln);
  // the tree: one old sakura over the bench (the town's sakura batch; its petals fall with the town's)
  ctx.sakura.push({ x: S.tree[0], z: S.tree[1], y: 0, scale: S.tree[2], seed: 9311/*@mini , layered: true @*//*@@*/ });
  // wildflowers round the tree's foot, the jizo and the paddies' edge: dandelions, violets, clover
  for (let i = 0; i < 70; i++) {
    const a = r.range(0, Math.PI * 2), d = r.range(0.6, 3.4);
    const x = S.tree[0] + Math.cos(a) * d * 1.3, z = S.tree[1] + Math.sin(a) * d * 0.6 + 0.4;
    if (Math.hypot(x - B.x, z - B.z) < 1.3) continue;
    const h = r.range(0.08, 0.2);
    scatter.put('tuft', x, 0.01, z, h * 0.8, h, h * 0.8, r.range(0, 6.3), r.pick([0x7fa65a, 0x8db265, 0x74985a]));
    if (i % 3 === 0) scatter.put('head', x, h * 0.9, z, 0.026, 0.02, 0.026, 0, r.pick([0xf2d64a, 0xf2d64a, 0x9a86d0, 0xffffff]));
  }
  // the colliders: the bench, the jizo, the lantern (the tree makes its own)
  const c = Math.abs(Math.cos(B.ry)), s = Math.abs(Math.sin(B.ry));
  const hx = (c * 1.9 + s * 0.62) / 2, hz = (s * 1.9 + c * 0.62) / 2;
  ctx.collide(B.x - hx, B.z - 0.06 - hz, B.x + hx, B.z - 0.06 + hz, 0.9);
  ctx.collide(J.x - 0.25, J.z - 0.23, J.x + 0.25, J.z + 0.23, 0.85);
  ctx.collide(Ln.x - 0.28, Ln.z - 0.28, Ln.x + 0.28, Ln.z + 0.28, 1.3);
  ctx.night?.pool(Ln.x, Ln.z, 2.4, { strength: 0.7 });

  const group = new THREE.Group();
  group.name = 'land-slowlife';
  ctx.add(group);
  parts.build(group, { cast: ['oldWood', 'oldWoodDark', 'jizoStone', 'bib', 'lanternStone', 'graniteDark'], noShadow: [] });
  group.traverse((o) => {
    // the small stone and cloth pieces take shadows but cast none (the kit's detail rule)
    if (o.isMesh && ['land-moss', 'land-lanternLight', 'land-bib'].includes(o.name)) o.userData.detail = true;
  });

  /* ---- the moving life: petals, two cabbage whites, glints ---- */
  const live = new THREE.Group();
  live.name = 'slowlife-live';
  live.userData.dynamic = true;
  ctx.add(live);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p3 = new THREE.Vector3();

  // petals drifting across the view from the tree, on the breeze
  const P = S.petals;
  const petalMesh = new THREE.InstancedMesh(petalGeo(), flat({ color: 0xf6c4d2, side: THREE.DoubleSide }), P.count);
  petalMesh.frustumCulled = false;
  petalMesh.userData.noOutline = true;
  live.add(petalMesh);
  const petals = Array.from({ length: P.count }, () => ({
    x: r.range(-P.half[0], P.half[0]), y: r.range(0.2, P.top), z: r.range(-P.half[1], P.half[1]),
    ph: r.range(0, 6.3), spin: r.range(1.5, 3.5), fall: r.range(0.7, 1.3),
  }));

  // two cabbage whites (モンシロチョウ), wandering round the bench and the flowers
  const F = S.butterflies;
  const wingMesh = new THREE.InstancedMesh(wingGeo(), flat({ color: 0xf6f4ea, side: THREE.DoubleSide }), F.count * 2);
  wingMesh.frustumCulled = false;
  wingMesh.userData.noOutline = true;
  live.add(wingMesh);
  const flies = Array.from({ length: F.count }, (_, i) => ({
    ph: r.range(0, 6.3), f1: r.range(0.13, 0.2), f2: r.range(0.21, 0.31), beat: r.range(0, 6.3), cx: F.at[0] + (i - 0.5) * 2.2, cz: F.at[1] + r.range(-1, 1),
  }));

  // glints on the pond in the seated view: they wink in and out
  const G = S.glints;
  const shore = pondShore();
  const glintMat = flat({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, toneMapped: false, cache: false });
  glintMat.depthWrite = false;
  const glintMesh = new THREE.InstancedMesh(glintGeo(), glintMat, G.count);
  glintMesh.frustumCulled = false;
  glintMesh.userData.noOutline = true;
  glintMesh.renderOrder = 2;
  live.add(glintMesh);
  const glints = [];
  for (let n = 0; glints.length < G.count && n < 2000; n++) {
    const x = r.range(G.box[0], G.box[2]), z = r.range(G.box[1], G.box[3]);
    if (!inside(shore, x, z)) continue;
    glints.push({ x, z, ph: r.range(0, 6.3), f: r.range(0.5, 1.1), s: r.range(0.22, 0.42) });
  }
  const waterY = TOWN.land.pond.water + 0.015;

  /* ---- the sound, and sitting ---- */
  const wSeat = ctx.toWorld({ x: B.x, z: B.z });
  const flute = soundBus.zone('rural-flute', { x: wSeat.x, z: wSeat.z, y: 1.2, near: S.sound.near, far: S.sound.far, level: S.sound.level });
  let seated = false, slow = 1;
  // the seat: on the planks, a hand forward of the backrest
  const seatAt = ctx.toWorld({ x: B.x + Math.sin(B.ry) * 0.04, z: B.z + Math.cos(B.ry) * 0.04 });
  const spot = ctx.experiences.add({
    id: 'slowlife', name: 'Sit a while', jp: 'ひと休み',
    x: B.x + Math.sin(B.ry) * 0.3, z: B.z + Math.cos(B.ry) * 0.3, r: 1.1, h: 1.0, hitInside: true,
    action: ({ player, hud } = {}) => {
      if (!player?.sit || seated) return;
      seated = true;
      flute.set({ level: S.sound.seated });
      player.sit({
        x: seatAt.x, z: seatAt.z, yaw: ctx.yawToWorld(S.view.yaw), pitch: S.view.pitch, eyeY: S.view.eye,
        onStand: () => { seated = false; flute.set({ level: S.sound.level }); },
      });
      spot.done();                          // no narration toast (quality pass, Tan: text only where required)
    },
  });

  let t = 0;
  ctx.update((dt, cam) => {
    if (!cam) return;
    const lc = ctx.toLocal({ x: cam.x, z: cam.z });
    const d = Math.hypot(lc.x - B.x, lc.z - B.z);
    const on = d < S.near;
    live.visible = on;
    if (!on) return;
    // time slows while you sit: everything here eases to a third of its pace
    slow += ((seated ? S.slowTo : 1) - slow) * (1 - Math.exp(-dt * 0.8));
    const st = dt * slow;
    t += st;

    // petals: fall, flutter, drift downwind (+x), wrap round the volume
    for (let i = 0; i < petals.length; i++) {
      const o = petals[i];
      o.y -= st * 0.32 * o.fall;
      o.x += st * (0.35 + 0.2 * Math.sin(t * 0.4 + o.ph));
      o.z += st * 0.12 * Math.sin(t * 0.7 + o.ph * 2);
      if (o.y < 0.05) { o.y = P.top; o.x = r.range(-P.half[0], P.half[0]); o.z = r.range(-P.half[1], P.half[1]); }
      if (o.x > P.half[0]) o.x -= P.half[0] * 2;
      const wob = Math.sin(t * o.spin + o.ph);
      e.set(1.2 + wob * 0.9, t * 0.5 + o.ph, wob * 0.6);
      q.setFromEuler(e);
      m4.compose(p3.set(P.at[0] + o.x, o.y + 0.08 * Math.sin(t * 1.3 + o.ph), P.at[1] + o.z), q, sc.set(1, 1, 1));
      petalMesh.setMatrixAt(i, m4);
    }
    petalMesh.instanceMatrix.needsUpdate = true;

    // butterflies: a lazy looping wander, wings beating
    for (let i = 0; i < flies.length; i++) {
      const o = flies[i];
      const u = t * o.f1 * 6.28 + o.ph, v = t * o.f2 * 6.28 + o.ph * 1.7;
      const x = o.cx + Math.sin(u) * 2.4 + Math.sin(v * 0.7) * 0.8;
      const z = o.cz + Math.sin(u * 0.8 + 1) * 1.6 + Math.cos(v) * 0.5;
      const y = 0.75 + 0.45 * Math.sin(v * 0.9) + 0.12 * Math.sin(t * 9 + o.ph);
      // heading: along the path's derivative
      const dx = Math.cos(u) * 2.4 * o.f1 + Math.cos(v * 0.7) * 0.56 * o.f2, dz = Math.cos(u * 0.8 + 1) * 1.28 * o.f1 - Math.sin(v) * 0.5 * o.f2;
      const yaw = Math.atan2(dx, dz);
      o.beat += st * F.beatHz * 6.28;
      const flap = 0.25 + 0.9 * (0.5 + 0.5 * Math.sin(o.beat));
      for (const side of [1, -1]) {
        e.set(0, yaw, side * flap, 'YXZ');
        q.setFromEuler(e);
        m4.compose(p3.set(x, y, z), q, sc.set(side * F.size, F.size, F.size));
        wingMesh.setMatrixAt(i * 2 + (side > 0 ? 0 : 1), m4);
      }
    }
    wingMesh.instanceMatrix.needsUpdate = true;

    // glints: brief winks of the low sun on the water, more of them while you sit
    const fog = ctx.scene?.fog;
    const light = fog ? THREE.MathUtils.clamp((fog.color.r * 0.3 + fog.color.g * 0.55 + fog.color.b * 0.15) * 1.6, 0.15, 1) : 1;
    glintMat.opacity = 0.95 * light;
    const busy = seated ? 1 : 0.55;
    for (let i = 0; i < glints.length; i++) {
      const o = glints[i];
      const w = Math.max(0, Math.sin(t * o.f * 2.1 + o.ph) - (1 - busy * 0.5)) / (busy * 0.5);
      const k = w * w * o.s;
      // stood on the water, facing the eye (a sparkle is seen, not a shape)
      q.setFromAxisAngle(p3.set(0, 1, 0), Math.atan2(lc.x - o.x, lc.z - o.z));
      m4.compose(p3.set(o.x, waterY + 0.03, o.z), q, sc.set(k * 0.9, w * 0.35 + 0.001, 1));
      glintMesh.setMatrixAt(i, m4);
    }
    glintMesh.instanceMatrix.needsUpdate = true;
  });
}
