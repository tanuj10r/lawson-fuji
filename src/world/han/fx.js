import * as THREE from 'three';
import { soundBus } from '../../core/soundBus.js';
import { falloff } from '../../core/sound.js';
import { HAN_FX } from '../../config.js';

/* ------------------------------------------------------------------ *
 * What the slide leaves behind (Tan, 2026-10-02: "The drift feels very
 * fake"): the rear tyres' smoke, the black they lay on the road, and the
 * sound of it.  Each is one draw (or one small audio graph) that exists
 * only while there is something of it: no puffs, no marks, no show ->
 * nothing drawn, nothing sounding.  Stepped from han/index.js's update
 * (the main loop); no clock of their own.
 * ------------------------------------------------------------------ */

/** Tyre smoke (Tan: real, not cartoon): soft translucent puffs, one Points draw, each born at a rear tyre's
 * contact patch, thrown back off the spinning tyre, dragged along a little by the car, then hanging, swelling,
 * rising and thinning to nothing. */
export function makeSmoke(ctx) {
  const F = HAN_FX.smoke, MAX = F.max;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX * 3), size = new Float32Array(MAX), alpha = new Float32Array(MAX);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,0.7)'); r.addColorStop(0.8, 'rgba(255,255,255,0.22)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.PointsMaterial({ color: 0xf4f2f0, map: tex, size: 1, sizeAttenuation: true, transparent: true, depthWrite: false });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSize;\nattribute float aAlpha;\nvarying float vAlpha;')
      .replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;\n  vAlpha = aAlpha;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAlpha;')
      .replace('#include <premultiplied_alpha_fragment>', 'gl_FragColor.a *= vAlpha;\n#include <premultiplied_alpha_fragment>');
  };
  mat.customProgramCacheKey = () => 'han-smoke';
  const mesh = new THREE.Points(geo, mat);
  mesh.name = 'han-smoke';
  mesh.userData.dynamic = true;
  mesh.userData.noOutline = true;
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 3;
  ctx.add(mesh);
  const P = [];
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const lit = new THREE.Color(0xf4f2f0);
  return {
    mesh,
    get count() { return P.length; },
    reset() { P.length = 0; geo.setDrawRange(0, 0); seed = 1; mesh.visible = false; },
    /** The light it stands in (1 by day): smoke at blue hour is not a lamp. */
    setLight(k) { mat.color.copy(lit).multiplyScalar(Math.min(1, 0.25 + 0.75 * k)); },
    /** A puff at (x, y, z), moving (vx, vz), `k` how thick (0..1). */
    emit(x, y, z, vx, vz, k = 1) {
      if (P.length >= MAX) P.shift();
      P.push({
        x: x + (rnd() - 0.5) * 0.2, y: y + rnd() * 0.3, z: z + (rnd() - 0.5) * 0.2,
        vx: vx + (rnd() - 0.5) * F.spread, vy: F.rise * (0.15 + rnd() * 1.5), vz: vz + (rnd() - 0.5) * F.spread,
        age: 0, life: F.life * (0.75 + rnd() * 0.5), s: F.size * (0.75 + rnd() * 0.5), a: F.alpha * (0.5 + 0.5 * k),
      });
    },
    update(dt) {
      if (!P.length) { if (mesh.visible) { mesh.visible = false; geo.setDrawRange(0, 0); } return; }
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        p.age += dt;
        if (p.age > p.life) { P.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const d = Math.max(0, 1 - dt * F.drag);
        p.vx *= d; p.vz *= d; p.vy *= Math.max(0, 1 - dt * 0.5);
      }
      for (let i = 0; i < P.length; i++) {
        const p = P[i], u = p.age / p.life;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        size[i] = p.s * (1 + F.swell * Math.sqrt(u));                        // billowing as it hangs
        alpha[i] = p.a * Math.min(1, u / 0.06) * (1 - u * u);             // in quickly, lingering, thinning away
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
      geo.setDrawRange(0, P.length);
      mesh.visible = P.length > 0 && mesh.userData.on !== false;   // no puffs, no draw
    },
  };
}

/** Tyre marks: the black the rear tyres lay while they slide, a ribbon along each tyre's own track (one mesh, one
 * draw, no texture: a ring of quads with a birth time each), fading over `fade` s and then not drawn at all. */
export function makeMarks(ctx) {
  const F = HAN_FX.marks, MAX = F.quads, V = MAX * 6;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(V * 3), born = new Float32Array(V).fill(-1e4), dark = new Float32Array(V);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aBorn', new THREE.BufferAttribute(born, 1));
  geo.setAttribute('aDark', new THREE.BufferAttribute(dark, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const time = { value: 0 };
  const mat = new THREE.MeshBasicMaterial({ color: 0x0c0b10, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float aBorn;\nattribute float aDark;\nuniform float uTime;\nvarying float vA;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n  vA = aDark * (1.0 - smoothstep(${F.fade[0].toFixed(1)}, ${F.fade[1].toFixed(1)}, uTime - aBorn));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vA;')
      .replace('#include <premultiplied_alpha_fragment>', 'gl_FragColor.a *= vA;\n#include <premultiplied_alpha_fragment>');
  };
  mat.customProgramCacheKey = () => 'han-marks';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'han-marks';
  mesh.userData.dynamic = true;
  mesh.userData.noOutline = true;
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 1;
  ctx.add(mesh);
  let at = 0, used = 0, newest = -1e4, dirty = false;
  const tracks = [null, null];                       // each rear tyre's last laid edge
  const put = (i, p, b, d) => { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; born[i] = b; dark[i] = d; };
  return {
    mesh,
    get quads() { return used; },
    reset() { at = used = 0; newest = -1e4; born.fill(-1e4); tracks[0] = tracks[1] = null; geo.setDrawRange(0, 0); mesh.visible = false; dirty = true; },
    /** Tyre `w` (0, 1) is at (x, z) on ground y, sliding `k` hard (0: it grips, the mark ends). */
    lay(w, x, y, z, k) {
      const tr = tracks[w];
      if (k <= 0) { tracks[w] = null; return; }
      if (!tr) { tracks[w] = { x, z, l: null, r: null, k: 0 }; return; }
      const dx = x - tr.x, dz = z - tr.z, d = Math.hypot(dx, dz);
      if (d < F.step) return;
      const nx = -dz / d * F.width / 2, nz = dx / d * F.width / 2;
      const l = { x: x + nx, y: y + F.lift, z: z + nz }, r = { x: x - nx, y: y + F.lift, z: z - nz };
      if (tr.l) {
        const i = at * 6, t = time.value, k0 = tr.k * F.dark, k1 = k * F.dark;
        put(i, tr.l, t, k0); put(i + 1, tr.r, t, k0); put(i + 2, l, t, k1);
        put(i + 3, tr.r, t, k0); put(i + 4, r, t, k1); put(i + 5, l, t, k1);
        at = (at + 1) % MAX; used = Math.min(MAX, used + 1); newest = t; dirty = true;
      }
      tr.x = x; tr.z = z; tr.l = l; tr.r = r; tr.k = k;
    },
    update(dt) {
      if (!used) return;
      time.value += dt;
      if (time.value - newest > F.fade[1]) { this.reset(); return; }          // all gone: nothing to draw
      if (dirty) {
        geo.attributes.position.needsUpdate = true; geo.attributes.aBorn.needsUpdate = true; geo.attributes.aDark.needsUpdate = true;
        geo.setDrawRange(0, used * 6); dirty = false;
      }
      mesh.visible = mesh.userData.on !== false;
    },
  };
}

/** The car's sound, made in code on the engine's own graph (as world/line/sfx.js does: its volume, mute, pause and
 * the store's walls all reach it): the rotary's buzz following the revs, and the rear tyres' howl following the
 * slide.  Local: full within `near` m of the car, nothing beyond `far`.  Built when the show starts, dropped when
 * it ends. */
export function makeVoice() {
  const F = HAN_FX.sound;
  let g = null, ac = null;
  const build = () => {
    const G = soundBus.graph();                       // null before the first click
    if (!G || !(F.engine > 0 || F.squeal > 0)) return null;
    ac = G.ac;
    const t = ac.currentTime;
    const master = ac.createGain(); master.gain.value = 0; master.connect(G.out);
    // the engine: two saws a fifth apart and a sub, through a low-pass the throttle opens
    const o1 = ac.createOscillator(); o1.type = 'sawtooth';
    const o2 = ac.createOscillator(); o2.type = 'sawtooth';
    const o3 = ac.createOscillator(); o3.type = 'square';
    const o2g = ac.createGain(); o2g.gain.value = 0.45;
    const o3g = ac.createGain(); o3g.gain.value = 0.5;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2; lp.frequency.value = 500;
    const eg = ac.createGain(); eg.gain.value = 0;
    o1.connect(lp); o2.connect(o2g).connect(lp); o3.connect(o3g).connect(lp); lp.connect(eg).connect(master);
    // the tyres: noise through two narrow bands that wander (a howl, not a hiss)
    const n = ac.sampleRate, b = ac.createBuffer(1, n * 2, n), d = b.getChannelData(0);
    let s = 7;
    for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; }
    const ns = ac.createBufferSource(); ns.buffer = b; ns.loop = true;
    const b1 = ac.createBiquadFilter(); b1.type = 'bandpass'; b1.Q.value = 9; b1.frequency.value = 1150;
    const b2 = ac.createBiquadFilter(); b2.type = 'bandpass'; b2.Q.value = 14; b2.frequency.value = 1720;
    const b2g = ac.createGain(); b2g.gain.value = 0.6;
    const lfo = ac.createOscillator(); lfo.frequency.value = 5.3;
    const lfoG = ac.createGain(); lfoG.gain.value = 70;
    lfo.connect(lfoG); lfoG.connect(b1.frequency); lfoG.connect(b2.frequency);
    const sg = ac.createGain(); sg.gain.value = 0;
    ns.connect(b1).connect(sg); ns.connect(b2).connect(b2g).connect(sg); sg.connect(master);
    const nodes = [o1, o2, o3, ns, lfo];
    for (const o of nodes) o.start(t);
    return { master, o1, o2, o3, lp, eg, b1, b2, sg, nodes };
  };
  return {
    get on() { return !!g; },
    /** Each frame of the drive: the listener's distance (m), the rear wheels' speed and the road's (m/s), how hard
     * the tyres slide (0..1), the throttle (0..1). */
    step(d, wheel, road, slide, throttle) {
      if (!g && !(g = build())) return;
      const t = ac.currentTime;
      g.master.gain.setTargetAtTime(falloff(d, F), t, 0.08);
      // the revs: up through each gear with the wheels' speed, dropping back as the next is taken
      const top = F.gears.find((v) => wheel < v) ?? F.gears.at(-1);
      const rev = Math.min(1, 0.3 + 0.7 * wheel / top);
      const f = F.hz[0] + (F.hz[1] - F.hz[0]) * rev;
      g.o1.frequency.setTargetAtTime(f, t, 0.05);
      g.o2.frequency.setTargetAtTime(f * 1.498, t, 0.05);
      g.o3.frequency.setTargetAtTime(f * 0.5, t, 0.05);
      g.lp.frequency.setTargetAtTime(350 + 2200 * throttle * rev, t, 0.06);
      g.eg.gain.setTargetAtTime(F.engine * (0.35 + 0.65 * throttle), t, 0.06);
      const k = slide * Math.min(1, road / 3);
      g.b1.frequency.setTargetAtTime(1000 + 260 * k + 14 * road, t, 0.1);
      g.b2.frequency.setTargetAtTime(1560 + 300 * k + 20 * road, t, 0.1);
      g.sg.gain.setTargetAtTime(F.squeal * k, t, 0.05);
    },
    stop() {
      if (!g) return;
      const G = g; g = null;
      G.master.gain.setTargetAtTime(0, ac.currentTime, 0.12);
      setTimeout(() => { for (const n of G.nodes) { try { n.stop(); } catch { /* stopped */ } } G.master.disconnect(); }, 700);
    },
  };
}
