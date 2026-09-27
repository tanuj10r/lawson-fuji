import * as THREE from 'three';
import { rngKit } from '../../core/util.js';
import { TOWN, ANIMALS } from '../../config.js';
import { Body, loft, sheet, blob, at } from './shapes.js';
import { animalMaterial, Herd, ease, turn } from './shade.js';

/* ------------------------------------------------------------------ *
 * 鏡池's koi.  Seen from the promenade, through olive water: soft
 * shapes of red-and-white, orange, gold and white, lazily circling a
 * hand under the surface.  They drift to where someone stands at the
 * edge (koi expect bread) and now and then one comes up, head out,
 * mouth working, and leaves a ring.
 *
 * The pond's water is a mirror drawn opaque, so a koi can't be under it:
 * each is drawn just on it, pressed flat, tinted by the water and faded
 * at a glancing look (the mirror wins there, as on real water).  Only a
 * surfacing head is drawn full height, in its own colours.
 * ------------------------------------------------------------------ */

/* part ids: 0 body (patterned), 1 eyes, 2 pectoral fins, 3 tail fin, 4 mouth, 5 dorsal fin */
function koiGeometry() {
  const b = new Body();
  // the body, nose (+z) to the tail's root; a koi is deep-bellied and
  // broad-backed, widest a third back from the head
  const S = [
    [0.5, 0.0, 0.0, 0.0],
    [0.49, 0.03, 0.025, -0.005],
    [0.46, 0.058, 0.05, -0.005],
    [0.41, 0.083, 0.072, 0.0],
    [0.33, 0.103, 0.092, 0.004],
    [0.22, 0.116, 0.104, 0.006],
    [0.1, 0.118, 0.104, 0.006],
    [-0.02, 0.108, 0.094, 0.004],
    [-0.14, 0.088, 0.077, 0.002],
    [-0.25, 0.064, 0.056, 0.0],
    [-0.34, 0.042, 0.038, 0.0],
    [-0.4, 0.028, 0.027, 0.0],
    [-0.43, 0.024, 0.022, 0.0],
    [-0.45, 0.0, 0.0, 0.0],
  ];
  b.add(loft(S.map(([z, rx, ry, y]) => ({ p: [0, y, z], rx: rx * 1.32, ry: ry * 1.1 })).reverse(), 12, [0, 1, 0]), { color: 0xffffff, part: 0 });
  // eyes, high on the sides of the head
  for (const s of [-1, 1]) b.add(blob(0.012, 0.012, 0.012, 6, 4), { matrix: at(s * 0.052, 0.022, 0.41), color: 0x1c1a1e, part: 1 });
  // the mouth: a dark rim at the nose, seen when it gulps
  b.add(blob(0.018, 0.012, 0.01, 8, 4), { matrix: at(0, 0.0, 0.497), color: 0x3a2a2a, part: 4 });
  // pectoral fins: broad fans behind the head, spread out to the sides
  for (const s of [-1, 1]) {
    const g = sheet([[0, 0.03], [0.07, 0.02], [0.13, -0.03], [0.14, -0.07], [0.1, -0.09], [0.04, -0.05], [0, -0.02]], 0.004);
    if (s < 0) g.scale(-1, 1, 1);
    b.add(g, { matrix: at(s * 0.085, -0.035, 0.28, 0, 0, s * -0.25), color: 0xffffff, part: 2, pivot: [s * 0.085, -0.035, 0.28] });
  }
  // the tail: a broad forked fan (drawn flat: seen from above, it spreads)
  {
    const g = sheet([[0, 0.02], [0.05, -0.02], [0.12, -0.14], [0.1, -0.19], [0.05, -0.15], [0.0, -0.12], [-0.05, -0.15], [-0.1, -0.19], [-0.12, -0.14], [-0.05, -0.02]], 0.005);
    b.add(g, { matrix: at(0, 0.0, -0.42), color: 0xffffff, part: 3, pivot: [0, 0, -0.42] });
  }
  // the dorsal fin: a low crest along the back
  {
    const g = sheet([[0, 0.14], [0.05, 0.1], [0.055, -0.12], [0, -0.16]], 0.004);
    b.add(g, { matrix: at(0, 0.098, 0.02, 0, 0, Math.PI / 2), color: 0xffffff, part: 5 });
  }
  return b.build();
}

const RIG = /* glsl */`
uniform float uSurface;
varying float vUp;
varying float vFres;
void rig(inout vec3 p, inout vec3 n) {
  float z = p.z;
  float ph = aPose.x, amp = aPose.y, bend = aPose.z, surf = aPose.w;
  // the swimming wave runs head to tail, the tail swinging most
  float w = 0.12 + 0.88 * smoothstep(0.3, -0.62, z);
  float wave = sin(ph - z * 6.0) * amp * 0.1 * w;
  // the body bends into a turn
  float t = 0.5 - z;
  float curve = bend * t * t * 0.42;
  // fins: the pectorals scull, the tail follows the wave
  if (isPart(2.0)) {
    float s = sign(p.x);
    float a = s * (0.35 + 0.3 * sin(ph * 0.5 + s)) * (0.4 + amp);
    vec3 q = p - aJoint.xyz;
    q = rotZ(q, a * 0.6);
    q = rotY(q, -s * (0.2 + 0.25 * sin(ph * 0.5)) );
    p = aJoint.xyz + q;
  }
  p.x += wave + curve;
  // surfacing: the head tips up through the surface
  float head = smoothstep(0.18, 0.46, z) * surf;
  // under the surface the koi is pressed flat on it (it is seen through
  // the water, not above it); a surfacing head keeps its shape
  float squash = mix(0.06, 1.0, head);
  p.y = (p.y + 0.11) * squash + head * (0.02 + (z - 0.18) * 0.28) - (1.0 - head) * 0.0;
  vUp = head;
}
`;

const FRAG_HEAD = /* glsl */`
uniform vec3 uWater;
uniform float uLight;
varying float vUp;
varying float vFres;
float kh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float kn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(kh(i), kh(i + vec2(1, 0)), f.x), mix(kh(i + vec2(0, 1)), kh(i + vec2(1, 1)), f.x), f.y);
}
`;

// the patterns: 0 kohaku, 1 gold (ogon), 2 orange, 3 platinum, 4 sanke, 5 orange-and-white
const FRAG = /* glsl */`
{
  float kind = vPose2.x, seed = vPose2.y, depth = vPose2.z;
  vec3 white = vec3(0.93, 0.91, 0.86);
  vec3 red = vec3(0.78, 0.13, 0.06);
  vec3 orange = vec3(0.93, 0.36, 0.06);
  vec3 gold = vec3(0.95, 0.62, 0.18);
  vec3 black = vec3(0.05, 0.045, 0.05);
  vec2 q = vec2(vLocal.x * 7.0 + seed * 13.1, vLocal.z * 6.0 + seed * 7.3);
  float n = kn(q) * 0.65 + kn(q * 2.3 + 4.0) * 0.35;
  vec3 c = white;
  float body = step(vPart, 0.5) + step(4.5, vPart);
  if (kind < 0.5) c = mix(white, red, step(0.46, n) * step(vLocal.z, 0.43));
  else if (kind < 1.5) c = mix(gold, vec3(1.0, 0.86, 0.52), smoothstep(0.02, 0.08, abs(vLocal.x)) * 0.35);
  else if (kind < 2.5) c = orange;
  else if (kind < 3.5) c = vec3(0.95, 0.94, 0.9);
  else if (kind < 4.5) {
    c = mix(white, red, step(0.5, n) * step(vLocal.z, 0.43));
    float m = kn(q * 3.1 + 11.0);
    c = mix(c, black, step(0.8, m) * step(vLocal.z, 0.3));
  }
  else c = mix(white, orange, step(0.42, n));
  // fins: paler, a little of the body's colour
  if (vPart > 1.5 && vPart < 3.5) c = mix(c, white, 0.45);
  if (vPart > 4.5) c = mix(c, white, 0.3);
  // eyes and mouth keep their own
  if (vPart > 0.5 && vPart < 1.5 || vPart > 3.5 && vPart < 4.5) c = diffuseColor.rgb;
  // under water: the koi's colour through a hand of olive water
  float under = 1.0 - vUp;
  vec3 seen = mix(c, uWater * uLight, (0.28 + 0.45 * depth) * under);
  diffuseColor.rgb = seen;
  float a = mix(0.82 - 0.4 * depth, 1.0, vUp);
  // fins are thin and see-through
  if (vPart > 1.5 && vPart < 3.5) a *= 0.72;
  if (vPart > 4.5) a *= 0.5;
  // a glancing look sees the mirror, not what is under it
  a *= mix(1.0, smoothstep(0.08, 0.55, vFres), under);
  diffuseColor.a *= a;
}
`;

/** Build the koi.  `pond`: shore polygon, water height, the benches. */
export function buildKoi(ctx, { shore, inside, water, benches, marks, look, reflect }) {
  const A = ANIMALS.koi;
  const r = rngKit(9101);
  const uniforms = { uWater: { value: new THREE.Color(0x7c7a4a) }, uLight: { value: 1 } };
  const mat = animalMaterial({
    key: 'koi', rig: RIG, frag: FRAG, fragHead: FRAG_HEAD, transparent: true, tint: 0x8a7a70, uniforms, bands: 'soft3',
  });
  // the view's slant, for the fade at a glancing look (after the instance is placed)
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, rd) => {
    prev(s, rd);
    s.vertexShader = s.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 kw = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
      vFres = normalize(cameraPosition - kw.xyz).y;`);
  };
  mat.depthWrite = false;
  const geo = koiGeometry();
  const pb = TOWN.land.pond.box;
  const herd = new Herd(ctx, geo, mat, A.count, 'koi', {
    bounds: [(pb[0] + pb[2]) / 2, water, (pb[1] + pb[3]) / 2, 60],
  });
  herd.mesh.renderOrder = 3;

  // who they are: the mix of a real pond
  const kinds = [0, 0, 0, 2, 2, 1, 3, 4, 5, 0, 2, 5];
  const cx = shore.reduce((a, p) => a + p.x, 0) / shore.length, cz = shore.reduce((a, p) => a + p.y, 0) / shore.length;
  const fish = [];
  for (let i = 0; i < A.count; i++) {
    // a few hang about the south benches, where people sit; the rest anywhere
    const home = i < 4 ? benches.at[i % 2] : null;
    let x, z;
    do {
      x = home ? home.x + r.range(-5, 5) : r.range(pb[0], pb[2]);
      z = home ? home.z + r.range(-5, 5) : r.range(pb[1], pb[3]);
    } while (!inside(x, z, 1.5));
    fish.push({
      x, z, yaw: r.range(0, Math.PI * 2), speed: r.range(0.1, 0.22), ph: r.range(0, 20), bend: 0,
      size: r.range(0.42, 0.68), kind: kinds[i % kinds.length], seed: r.range(0, 10), depth: r.range(0.1, 0.6),
      target: null, t: r.range(0, 6), surf: 0, state: 'swim', sT: 0, dBase: r.range(0.15, 0.7),
    });
    herd.setPose2(i, fish[i].kind, fish[i].seed, fish[i].depth, 0);
  }
  const place = (f, i) => {
    herd.set(i, f.x, water + 0.004, f.z, f.yaw, 0, 0, f.size);
    herd.setPose(i, f.ph, f.amp ?? 0.5, f.bend, f.surf);
    herd.setPose2(i, f.kind, f.seed, f.depth, 0);
  };
  fish.forEach(place);
  herd.flush();

  const newTarget = (f, near) => {
    for (let k = 0; k < 20; k++) {
      const x = near ? near.x + r.range(-2.5, 2.5) : r.range(pb[0], pb[2]);
      const z = near ? near.z + r.range(-2.5, 2.5) : r.range(pb[1], pb[3]);
      if (inside(x, z, near ? 0.9 : 2.2)) { f.target = { x, z }; return; }
    }
    f.target = { x: cx, z: cz };
  };

  let clock = 0;
  let watcher = null, still = 0;          // someone at the edge, and for how long
  function update(dt, cam) {
    clock += dt;
    // the water's colour through the look (as the mirror's)
    const fog = ctx.scene.fog;
    if (fog) uniforms.uLight.value = THREE.MathUtils.clamp((fog.color.r * 0.3 + fog.color.g * 0.55 + fog.color.b * 0.15) * 1.7, 0.22, 1);
    // is the player standing at the pond's edge?  koi come to people
    const edge = benches.edgeNear(cam.x, cam.z);
    if (edge && edge.d < A.watchReach) {
      still = watcher && Math.hypot(watcher.x - edge.x, watcher.z - edge.z) < 1.5 ? still + dt : 0;
      watcher = { x: edge.x, z: edge.z };
    } else { watcher = null; still = 0; }

    fish.forEach((f, i) => {
      f.t -= dt;
      const toWatch = watcher && Math.hypot(f.x - watcher.x, f.z - watcher.z) < A.gather && still > 1.5;
      if (f.state === 'swim') {
        // someone at the edge: turn for them at once (the others keep circling)
        if (toWatch && !f.called) { f.called = true; f.t = 0; }
        if (!toWatch) f.called = false;
        if (!f.target || f.t <= 0 || Math.hypot(f.target.x - f.x, f.target.z - f.z) < 0.8) {
          newTarget(f, toWatch ? watcher : null);
          f.t = toWatch ? r.range(2, 5) : r.range(6, 16);
          f.cruise = toWatch ? r.range(0.3, 0.45) : r.range(0.08, 0.2);
        }
        // steer, never faster than a koi turns
        const want = Math.atan2(f.target.x - f.x, f.target.z - f.z);
        const d = turn(f.yaw, want);
        const rate = THREE.MathUtils.clamp(d * 0.9, -0.7, 0.7);
        f.yaw += rate * dt;
        f.bend += (rate * 0.9 - f.bend) * Math.min(1, dt * 2);
        f.speed += (f.cruise - f.speed) * Math.min(1, dt * 0.6);
        const nx = f.x + Math.sin(f.yaw) * f.speed * dt, nz = f.z + Math.cos(f.yaw) * f.speed * dt;
        if (inside(nx, nz, 0.6)) { f.x = nx; f.z = nz; } else { f.target = { x: cx, z: cz }; f.t = 4; }
        f.depth += ((toWatch ? 0.08 : f.dBase + 0.2 * Math.sin(clock * 0.1 + f.seed)) - f.depth) * Math.min(1, dt * 0.4);
        // up for a gulp: by someone at the edge, or near a bench
        const nearWatch = watcher && Math.hypot(f.x - watcher.x, f.z - watcher.z) < 3.2;
        const benchy = benches.near(f.x, f.z) < 4;
        if ((nearWatch && r.chance(dt * 0.25)) || (benchy && r.chance(dt * 0.02))) { f.state = 'up'; f.sT = 0; }
      } else {
        // surfacing: slow to a stop, head up, a gulp or two, then down again
        f.sT += dt;
        f.speed += (0.02 - f.speed) * Math.min(1, dt * 2);
        f.x += Math.sin(f.yaw) * f.speed * dt; f.z += Math.cos(f.yaw) * f.speed * dt;
        f.bend *= 1 - Math.min(1, dt * 2);
        const T = A.surfaceTime;
        f.surf = f.sT < 0.7 ? ease(f.sT / 0.7) : f.sT < T - 0.8 ? 1 : ease((T - f.sT) / 0.8);
        f.depth += (0.02 - f.depth) * Math.min(1, dt * 3);
        // the gulps
        const g = Math.floor((f.sT - 0.6) / 0.9);
        if (g >= 0 && f.sT < T - 0.8 && g !== f.gulp) {
          f.gulp = g;
          const hx = f.x + Math.sin(f.yaw) * f.size * 0.45, hz = f.z + Math.cos(f.yaw) * f.size * 0.45;
          marks.ring(hx, water, hz, { r0: 0.03, r1: 0.25 + f.size * 0.3, life: 1.6, strength: 0.75 });
        }
        if (f.sT >= T) { f.state = 'swim'; f.surf = 0; f.gulp = -1; f.t = 0; }
      }
      f.amp = THREE.MathUtils.clamp(0.25 + f.speed * 3.2, 0.25, 1.0) * (1 - f.surf * 0.8);
      f.ph += dt * (2.2 + f.speed * 14);
      place(f, i);
    });
    herd.flush();
  }
  return { update, herd, fish, dbg: () => ({ watcher, still }) };
}
