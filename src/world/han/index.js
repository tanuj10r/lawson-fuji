import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { soundBus } from '../../core/soundBus.js';
import { TOWN } from '../../config.js';
import { makeRX7, RX7 } from './rx7.js';
import { makeHan, POSES, blendPose } from './han.js';

/* ------------------------------------------------------------------ *
 * Han and the RX-7 (Tan's experience 2, docs/EXPERIENCES.md).
 *
 * In the car park across the road from the spawn, in the bay nearest the
 * main road and the bridge road, Han leans on the orange-and-black RX-7.
 * Nothing plays as you walk up (Tan, 2026-09-28: the glow ring says where
 * the engagement is).  Step into the glow in front of him and the Tokyo
 * Drift track starts with the show: he nods, gets in, pulls out onto the
 * main road, runs east, flicks the car round, comes back and drifts it
 * round through the master junction in a cloud of smoke, reverses into
 * the bay, gets out and leans again: all of it on the song's 17.7 s.  The
 * camera is never taken.  The track is a placed one-shot (near 6 m, far
 * 24 m): heard at the car park, not across town.
 *
 * Town frame (TOWN.land; world = (-x, 2*main - z)).  The car park's road
 * row is z 2.2-7.2; the main road z 10.5-17.2; the master junction x 30.
 * If the player stands in the car's way it waits (the song plays on).
 *
 * Cost: the car ~30k triangles in about 14 draws, Han ~7k in about 25
 * (tiny ones), the smoke one instanced draw.  Nothing updates beyond
 * 60 m unless the drive is on.
 * ------------------------------------------------------------------ */

/** The bay Han's car stands in (town frame): parking.js keeps it and its
 * neighbours free of parked cars. */
export const HAN_BAY = { x: 24.15, z: 4.7, keep: 5.1 };   // the car park's reserved bay (land/parking.js: the road row's east end)
/** The glow Han waits by: step in and he goes. */
export const HAN_SPOT = { x: HAN_BAY.x - 2.45, z: 4.2, r: 0.85 };

const SONG = 17.74;            // han-drift's length
const T_IN = 2.8;              // Han is in and the door shut: the drive starts
const T_DRIVE = 12.6;          // the drive, out and back to the bay
const T_END = T_IN + T_DRIVE + 2.3;
const NEAR = 60;               // beyond this nothing updates (the drive aside)

/* ------------------------------ the drive ------------------------------ */
/* A turtle path in the town frame: straights and arcs, forward or in
 * reverse, each with a speed at its start and end (so its time follows),
 * and a drift angle for the two slides.  Heading th: forward = (cos, sin). */
function buildDrive() {
  const segs = [];
  let x = HAN_BAY.x, z = HAN_BAY.z, th = Math.PI / 2;
  const add = (o) => {
    const { len = 0, R = 0, turn = 0, rev = false, v0 = 0, v1 = 0, hold = 0, drift = 0 } = o;
    const pts = [{ s: 0, x, z, th }];
    const n = Math.max(1, Math.ceil(len / 0.02));
    const ds = len / n;
    for (let i = 1; i <= n && len > 0; i++) {
      const dir = rev ? -1 : 1;
      if (R) {
        const dth = turn * ds / R;
        const mid = th + dth / 2;
        x += dir * Math.cos(mid) * ds; z += dir * Math.sin(mid) * ds;
        th += dth;
      } else {
        x += dir * Math.cos(th) * ds; z += dir * Math.sin(th) * ds;
      }
      pts.push({ s: i * ds, x, z, th });
    }
    const T = hold || (2 * len) / Math.max(0.01, v0 + v1);
    segs.push({ len, R, turn, rev, v0, v1, T, drift, pts });
  };
  add({ len: 1.5, v0: 0, v1: 3 });                                  // out of the bay
  add({ len: 4.8 * Math.PI / 2, R: 4.8, turn: -1, v0: 3, v1: 6 });  // onto the main road, east
  add({ len: 28, v0: 6, v1: 18 });                                   // flat out
  add({ len: 6.25, v0: 18, v1: 11 });                                // brake
  add({ len: 2.6 * Math.PI, R: 2.6, turn: 1, v0: 11, v1: 7, drift: 0.62 });   // flick it round
  add({ len: 25.25, v0: 7, v1: 17 });                                // back west
  add({ len: 7, v0: 17, v1: 11 });
  add({ len: 2.6 * Math.PI, R: 2.6, turn: 1, v0: 11, v1: 5, drift: 0.7 });    // round through the master junction
  add({ len: 0.8, v0: 5, v1: 0 });
  add({ hold: 0.35 });                                               // into reverse
  add({ len: 2.8, rev: true, v0: 0, v1: 3 });
  add({ len: 4.8 * Math.PI / 2, R: 4.8, turn: 1, rev: true, v0: 3, v1: 2.5 });   // back into the bay
  add({ len: 1.5, rev: true, v0: 2.5, v1: 0 });
  // fit it to the music: every segment's time scaled alike
  const total = segs.reduce((a, s) => a + s.T, 0);
  let t = 0, dist = 0;
  for (const s of segs) { s.T *= T_DRIVE / total; s.t0 = t; t += s.T; s.d0 = dist; dist += s.len; }
  return { segs, total: T_DRIVE, dist };
}

/** Where the car is at drive time t: position, heading, drift, distance run. */
function driveAt(D, t, out = {}) {
  t = THREE.MathUtils.clamp(t, 0, D.total);
  let seg = D.segs[D.segs.length - 1];
  for (const s of D.segs) if (t <= s.t0 + s.T) { seg = s; break; }
  const u = seg.T > 0 ? (t - seg.t0) / seg.T : 1;
  // distance along the segment with speed going linearly v0 -> v1
  const k = seg.v0 + seg.v1 > 0 ? (seg.v0 * u + (seg.v1 - seg.v0) * u * u / 2) / ((seg.v0 + seg.v1) / 2) : 0;
  const sd = seg.len * k;
  const pts = seg.pts;
  const f = pts.length > 1 ? Math.min(pts.length - 1.001, (sd / Math.max(seg.len, 1e-6)) * (pts.length - 1)) : 0;
  const i = Math.floor(f), a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)], w = f - i;
  out.x = a.x + (b.x - a.x) * w;
  out.z = a.z + (b.z - a.z) * w;
  out.th = a.th + (b.th - a.th) * w;
  out.dist = seg.d0 + sd;
  out.speed = seg.v0 + (seg.v1 - seg.v0) * u;
  out.rev = seg.rev;
  // the slides: tail out through each drifting arc, eased in and caught after
  let drift = 0;
  for (const s of D.segs) {
    if (!s.drift) continue;
    const mid = s.t0 + s.T / 2, half = s.T / 2 + 0.45;
    const q = (t - mid) / half;
    if (Math.abs(q) < 1) drift += s.turn * s.drift * Math.cos(q * Math.PI / 2) ** 1.5 * (q > 0 ? 1 - 0.3 * q : 1);
  }
  out.drift = drift;
  out.steer = seg.R ? THREE.MathUtils.clamp(seg.turn * Math.atan(2.43 / seg.R) * (seg.rev ? -1 : 1), -0.6, 0.6) : 0;
  if (drift) out.steer = THREE.MathUtils.clamp(out.steer - drift * 1.1, -0.6, 0.6);   // counter-steer
  out.sliding = Math.abs(drift) > 0.18;
  out.launch = seg === D.segs[2] && u < 0.25;
  return out;
}

/* ------------------------------- smoke ------------------------------- */
function makeSmoke(ctx) {
  const MAX = 64;
  const geo = new THREE.IcosahedronGeometry(0.5, 1);
  const mat = cel({ color: 0xeeeae6, bands: 'soft', tint: 0xb4a8c8, flat: false });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.name = 'han-smoke';
  mesh.userData.dynamic = true;
  mesh.userData.noOutline = true;
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.visible = false;
  ctx.add(mesh);
  const P = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const LIFE = 1.7;
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  return {
    mesh,
    reset() { P.length = 0; mesh.count = 0; seed = 1; },
    emit(x, y, z, vx, vz) {
      if (P.length >= MAX) P.shift();
      P.push({ x, y, z, vx: vx * 0.25 + (rnd() - 0.5) * 1.2, vy: 0.5 + rnd() * 0.5, vz: vz * 0.25 + (rnd() - 0.5) * 1.2, age: 0, s: 0.55 + rnd() * 0.5, r: rnd() * 6 });
    },
    update(dt) {
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        p.age += dt;
        if (p.age > LIFE) { P.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vx *= 1 - dt * 1.4; p.vz *= 1 - dt * 1.4; p.vy *= 1 - dt * 0.8;
      }
      for (let i = 0; i < P.length; i++) {
        const p = P[i], u = p.age / LIFE;
        // cartoon puffs: pop up, swell, then shrink away
        const s = p.s * (u < 0.15 ? u / 0.15 : 1) * (0.7 + 1.3 * u) * (1 - u ** 3);
        v.set(p.x, p.y, p.z); sc.set(s, s * 0.85, s);
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.r + u);
        m4.compose(v, q, sc);
        mesh.setMatrixAt(i, m4);
      }
      mesh.count = P.length;
      mesh.visible = P.length > 0 && mesh.userData.on !== false;   // no puffs, no draw
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/* ------------------------------- building ------------------------------- */

export function buildHan(ctx) {
  const D = buildDrive();
  const car = makeRX7();
  const cg = car.group;
  cg.userData.dynamic = true;             // it moves: not merged into the town's static cells
  ctx.add(cg);

  // a soft contact shadow that goes where the car goes (the sun's shadow map redraws at 4 Hz)
  {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 32;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 16, 2, 32, 16, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.9)'); grad.addColorStop(0.6, 'rgba(0,0,0,0.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 32);
    const tex = new THREE.CanvasTexture(c);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 2.25), new THREE.MeshBasicMaterial({ map: tex, color: 0x1e1a30, transparent: true, opacity: 0.45, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.012;
    blob.renderOrder = 1;
    blob.userData.noOutline = true;
    cg.add(blob);
  }

  const han = makeHan();
  cg.add(han.group);

  // where Han stands, car frame (the car's right side, +z, is the driver's)
  const HW = car.halfW(-0.55);
  const LEAN = new THREE.Vector3(-0.6, 0, HW + 0.05);    // his hips against the rear quarter, just ahead of the wheel
  const STAND = new THREE.Vector3(-0.42, 0, HW + 0.34);
  const DOOR = new THREE.Vector3(-0.08, 0, HW + 0.32);
  const SEAT = new THREE.Vector3(-0.38, 0.2, 0.37);

  /* colliders: the car's follows it (world AABB round its turned box); Han's while he stands */
  const carCol = { x0: 0, x1: 0, z0: 0, z1: 0, top: 1.15 };
  const hanCol = { x0: 1e6, x1: 1e6, z0: 1e6, z1: 1e6, top: 1.8 };
  ctx.colliders.push(carCol, hanCol);

  /* the spot and the song: the track plays only with the show (no zone on approach) */
  const spotW = ctx.toWorld({ x: HAN_SPOT.x, z: HAN_SPOT.z });
  const songLevel = 0.5;
  let trigger = () => {};
  const spot = ctx.experiences?.add({
    id: 'han', name: "Han's RX-7", jp: 'ハン', x: HAN_SPOT.x, z: HAN_SPOT.z, r: HAN_SPOT.r, h: 1.9,
    label: "ハン  ·  Han's RX-7", action: () => trigger(),
  });

  const smoke = makeSmoke(ctx);

  /* state */
  const S = { run: false, t: 0, held: 0, rate: 1, armed: true, frozen: false, songT: 0, idle: 0, look: 0, lookP: 0, groundY: 0.03, door: 0 };
  const pose = {};
  const cp = {};
  const lot = TOWN.land.parking;
  const groundAt = (x, z) => {
    const g = ctx.groundAt ? ctx.groundAt(x, z) : 0;
    const inLot = x > lot[0] && x < lot[2] && z > lot[1] && z < lot[3];
    return Math.max(g, inLot ? 0.03 : 0);
  };

  const toTown = (px, pz, lx, lz, psi, out) => {
    const c = Math.cos(psi), s = Math.sin(psi);
    out.x = px + lx * c - lz * s; out.z = pz + lx * s + lz * c;
    return out;
  };
  const tw = {}, tw2 = {};
  function setBox(col, pts) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of pts) {
      const w = ctx.toWorld(p);
      x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x); z0 = Math.min(z0, w.z); z1 = Math.max(z1, w.z);
    }
    col.x0 = x0; col.x1 = x1; col.z0 = z0; col.z1 = z1;
  }

  /** Put the car at drive time dt (0 = parked). */
  function placeCar(dtm) {
    driveAt(D, dtm, cp);
    const psi = cp.th + cp.drift;
    const gy = groundAt(cp.x, cp.z);
    S.groundY += (gy - S.groundY) * 0.35;
    cg.position.set(cp.x, S.groundY, cp.z);
    cg.rotation.y = -psi;
    car.setWheels(cp.dist / RX7.R * (cp.rev ? 1 : 1), cp.steer);
    // its collider, 6 cm in from the paint
    const hl = RX7.L / 2 - 0.08, hw = RX7.W / 2 - 0.1;
    setBox(carCol, [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw]].map(([lx, lz]) => ({ ...toTown(cp.x, cp.z, lx, lz, psi, {}) })));
    return psi;
  }

  /** Is the player (town frame) in the car's way over the next moments? */
  function blocked(e, p) {
    const dt0 = e - T_IN;
    if (dt0 < 0 || dt0 > T_DRIVE) return false;
    const f = {};
    for (const a of [0.12, 0.3, 0.5, 0.7]) {
      driveAt(D, dt0 + a, f);
      const psi = f.th + f.drift, c = Math.cos(psi), s = Math.sin(psi);
      const dx = p.x - f.x, dz = p.z - f.z;
      const lx = dx * c + dz * s, lz = -dx * s + dz * c;
      if (Math.abs(lx) < RX7.L / 2 + 0.55 && Math.abs(lz) < RX7.W / 2 + 0.55) return true;
    }
    return false;
  }

  const ease = (u) => u * u * (3 - 2 * u);
  const seg01 = (e, a, b) => THREE.MathUtils.clamp((e - a) / (b - a), 0, 1);

  /** Han and the door at experience time e (not running: e < 0). */
  function placeHan(e, dt) {
    const g = han.group;
    let base = POSES.lean, target = POSES.lean, k = 0, door = 0;
    const pos = new THREE.Vector3().copy(LEAN);
    let yaw = 0, nod = 0;
    const E = T_IN + T_DRIVE;
    if (e >= 0 && e < T_IN) {
      nod = e < 0.6 ? Math.sin((e / 0.6) * Math.PI) : 0;
      const up = ease(seg01(e, 0.5, 1.1));
      base = POSES.lean; target = POSES.stand; k = up;
      pos.lerpVectors(LEAN, STAND, up);
      yaw = 0.7 * up;
      door = 1.15 * ease(seg01(e, 1.05, 1.45)) * (1 - ease(seg01(e, 2.3, 2.7)));
      const inn = ease(seg01(e, 1.45, 2.35));
      if (inn > 0) {
        const a = Math.min(1, inn * 2), b = Math.max(0, inn * 2 - 1);
        pos.lerpVectors(STAND, DOOR, a);
        if (b > 0) pos.lerp(SEAT, b);
        base = POSES.stand; target = POSES.seat; k = b;
        yaw = 0.7 + (Math.PI / 2 - 0.7) * inn;
      }
    } else if (e >= T_IN && e < E) {
      pos.copy(SEAT); base = target = POSES.seat; yaw = Math.PI / 2;
    } else if (e >= E && e < T_END) {
      const o = e - E;
      door = 1.15 * ease(seg01(o, 0.0, 0.4)) * (1 - ease(seg01(o, 1.25, 1.65)));
      const out = ease(seg01(o, 0.35, 1.25));
      const a = Math.min(1, out * 2), b = Math.max(0, out * 2 - 1);
      pos.copy(SEAT).lerp(DOOR, a);
      if (b > 0) pos.lerp(STAND, b);
      base = POSES.seat; target = POSES.stand; k = a;
      yaw = Math.PI / 2 + (0.7 - Math.PI / 2) * out;
      const back = ease(seg01(o, 1.35, 2.2));
      if (back > 0) {
        pos.lerpVectors(STAND, LEAN, back);
        base = POSES.stand; target = POSES.lean; k = back;
        yaw = 0.7 * (1 - back);
      }
    }
    g.position.copy(pos);
    g.rotation.y = yaw;
    blendPose(base, target, k, pose);
    // breathing, the head following you, the nod
    S.idle += dt;
    const br = Math.sin(S.idle * 1.6);
    pose.chestX += br * 0.012;
    pose.lShZ += br * 0.01; pose.rShZ -= br * 0.01;
    han.apply(pose);
    han.joints.chest.scale.set(1 + br * 0.008, 1 + br * 0.006, 1 + br * 0.012);
    han.joints.head.rotation.y = S.look;
    han.joints.head.rotation.x += S.lookP + nod * 0.32;
    car.setDoor(door);
    // the door's thunk as it shuts, a softer one as it opens (the sound engine's own recipe)
    if (!S.frozen && dt > 0) {
      const at = toTown(cg.position.x, cg.position.z, 0.2, 0.9, -cg.rotation.y, {});
      const w = ctx.toWorld(at);
      if (S.door > 0.05 && door <= 0.02) soundBus.oneShot('han-door', { recipe: 'fridge-door', x: w.x, z: w.z, y: 0.8, near: 3, far: 22, gain: 0.7 });
      if (S.door <= 0.001 && door > 0.001) soundBus.oneShot('han-door', { recipe: 'fridge-door', x: w.x, z: w.z, y: 0.8, near: 3, far: 18, gain: 0.3 });
    }
    S.door = door;
    return pos;
  }

  function start() {
    if (S.run) return;
    S.run = true; S.t = 0; S.held = 0; S.rate = 1; S.songT = 0; S.armed = false;
    // from the top, with the animation; local: full to 6 m, gone by 24 m (the famous view is 22.8 m off)
    soundBus.oneShot('han-drift', { x: spotW.x, z: spotW.z, y: 1.2, near: 6, far: 24, gain: songLevel });
    spot?.done();
  }
  trigger = start;

  // the paint's sky reflections follow the light: the scene's sun (the one shadow-casting directional)
  let sun = null;
  ctx.scene?.traverse((o) => { if (!sun && o.isDirectionalLight && o.castShadow) sun = o; });
  let envK = -1;
  const pl = new THREE.Vector3(), hv = new THREE.Vector3();
  ctx.update((dt, cam) => {
    if (!cam) return;
    const p = ctx.toLocal({ x: cam.x, z: cam.z });
    const dCar = Math.hypot(p.x - cg.position.x, p.z - cg.position.z);
    if (!S.run && dCar > NEAR) return;
    if (sun) {
      const k = THREE.MathUtils.clamp(sun.intensity / 2.2, 0.22, 1.1);
      if (Math.abs(k - envK) > 0.01) { envK = k; car.setEnv(k); }
    }
    /* The show keeps the song's time, not the game's: the game slows its
     * clock when paused (10 frames a second, each capped at 1/20 s), the
     * music plays on.  A frozen capture (dt 0) stays frozen. */
    const now = performance.now();
    if (dt > 0) dt = Math.min(0.25, (now - (S.wall ?? now - dt * 1000)) / 1000);
    S.wall = now;

    // the trigger: step into the glow; it re-arms once you have stepped out again
    const dSpot = Math.hypot(p.x - HAN_SPOT.x, p.z - HAN_SPOT.z);
    if (!S.run) {
      if (dSpot > HAN_SPOT.r + 0.6) S.armed = true;
      if (S.armed && dSpot < HAN_SPOT.r && dt > 0) start();
    }

    if (S.run && !S.frozen) {
      S.songT += dt;
      const e = S.t - S.held;
      // you are in its way: it brakes to a stop and waits (the song plays on), then goes on
      const want = blocked(e + dt, p) ? 0 : 1;
      S.rate += (want - S.rate) * Math.min(1, dt * 5);
      if (!want && S.rate < 0.03) S.rate = 0;
      S.held += dt * (1 - S.rate);
      S.t += dt;
      if (S.t - S.held >= T_END) S.run = false;
    }
    const e = S.run ? S.t - S.held : -1;
    const dtm = e < T_IN ? 0 : Math.min(e - T_IN, T_DRIVE);
    const psi = placeCar(dtm);

    // Han's head: toward you when you are near and he is out of the car
    pl.set(cam.x, cam.y, cam.z);
    han.group.updateWorldMatrix(true, false);
    hv.copy(pl);
    han.group.worldToLocal(hv);
    const out = !(e >= T_IN - 0.4 && e < T_IN + T_DRIVE + 0.4);
    const dH = Math.hypot(hv.x, hv.z);
    let want = 0, wantP = 0;
    if (out && dH < 8) {
      want = THREE.MathUtils.clamp(Math.atan2(hv.x, hv.z), -1.0, 1.0);
      wantP = THREE.MathUtils.clamp(-Math.atan2(hv.y - 1.55, dH) * 0.5, -0.12, 0.2);
    }
    const kk = 1 - Math.exp(-dt * 4);
    S.look += (want - S.look) * kk;
    S.lookP += (wantP - S.lookP) * kk;
    const hp = placeHan(e, dt);

    // Han's collider while he stands by the car
    if (e < 1.3 || e > T_IN + T_DRIVE + 1.2) {
      const a = toTown(cp.x, cp.z, hp.x, hp.z, psi, tw), b = toTown(cp.x, cp.z, hp.x, hp.z + 0.3, psi, tw2);
      setBox(hanCol, [{ x: a.x - 0.25, z: a.z - 0.25 }, { x: b.x + 0.25, z: b.z + 0.25 }, { x: a.x + 0.25, z: a.z + 0.25 }, { x: b.x - 0.25, z: b.z - 0.25 }]);
    } else { hanCol.x0 = hanCol.x1 = hanCol.z0 = hanCol.z1 = 1e6; }

    // smoke from the rear wheels while it slides, and a puff or two at the launch
    if (S.run && !S.frozen && dt > 0) smokeStep(dt, psi);
    if (!S.frozen) smoke.update(dt);
  });

  let acc = 0;
  function smokeStep(dt, psi) {
    if (!(cp.sliding || cp.launch)) return;
    acc += dt * (cp.sliding ? 30 : 16);
    const vx = Math.cos(cp.th) * cp.speed, vz = Math.sin(cp.th) * cp.speed;
    while (acc >= 1) {
      acc -= 1;
      for (const sz of [-1, 1]) {
        const w = toTown(cp.x, cp.z, RX7.axle.r - 0.1, sz * 0.82, psi, {});
        smoke.emit(w.x, 0.3, w.z, -vx, -vz);
      }
    }
  }

  placeCar(0);
  S.groundY = groundAt(HAN_BAY.x, HAN_BAY.z);
  placeCar(0);
  placeHan(-1, 0);

  // dev: set the show to a moment and hold it there (shots: the spot's `train: 'han:<t>'`)
  if (import.meta.env?.DEV) {
    const set = (t) => {
      S.run = true; S.frozen = true; S.t = t; S.held = 0; S.songT = SONG;
      smoke.reset();
      // the smoke of the two seconds before
      const t0 = Math.max(0, t - 2);
      for (let u = t0; u < t; u += 1 / 60) {
        const e = u, dtm = e < T_IN ? 0 : Math.min(e - T_IN, T_DRIVE);
        const psi = placeCar(dtm);
        smokeStep(1 / 60, psi);
        smoke.update(1 / 60);
      }
    };
    // what it costs: triangles and draws, car and Han apart
    const stats = (root) => {
      let tris = 0, draws = 0;
      root.traverse((o) => {
        if (!o.isMesh || !o.visible) return;
        const g = o.geometry, n = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
        tris += n * (o.isInstancedMesh ? o.count : 1);
        draws += 1;
      });
      return { tris: Math.round(tris), draws };
    };
    window.__han = {
      set, play: () => { S.frozen = false; start(); }, stop: () => { S.run = false; S.frozen = false; smoke.reset(); },
      state: () => ({ run: S.run, t: S.t, held: S.held, armed: S.armed, x: cg.position.x, z: cg.position.z, psi: -cg.rotation.y }),
      show: (on) => { cg.visible = on; smoke.mesh.userData.on = on; smoke.mesh.visible = false; },
      stats: () => {
        const h = stats(han.group), all = stats(cg);
        return { car: { tris: all.tris - h.tris, draws: all.draws - h.draws }, han: h, smoke: stats(smoke.mesh) };
      },
    };
    const prev = Object.getOwnPropertyDescriptor(window, '__train');
    let inner = prev?.value;
    Object.defineProperty(window, '__train', {
      configurable: true,
      get: () => (k) => (typeof k === 'string' && k.startsWith('han:') ? set(+k.slice(4)) : inner?.(k)),
      set: (f) => { inner = f; },
    });
  }
  return { car, han, drive: D };
}
