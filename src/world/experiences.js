import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Experience spots (Tan, 2026-09-28): the town's things to do and to hear.
 * Two kinds (Tan, 2026-09-28):
 *   engage  a place you walk up to and do something at (step in, or E):
 *           the highlight below in town, a diamond on the map
 *   sound   a place you only hear as you pass (a walk signal's tune, the
 *           megastore's theme, the station, the level crossing, the
 *           shrine's chimes): nothing in town, a speaker on the map
 *
 * The engagements' highlight (Tan: the first glow ring and diamond "look pretty lame";
 * the lanterns that replaced them didn't say "come here"):
 *   - on the ground, a crisp painted ring in warm yellow with a gold edge,
 *     a faint fill, and a second ring that keeps rippling outward from the
 *     middle, so the spot reads as a place to step into;
 *   - a soft column of light rising out of it, brightest at the ground
 *     and gone by head height and a bit, which is what you see from across
 *     the street (it fades as you arrive, so it never wraps you);
 *   - a few warm motes drifting up inside it.
 * It shows from 60 m.  A spot you've done dims but stays.
 *
 *   const spot = experiences.add({ id, name, jp, x, z, r, h, y, action,
 *                                  label, interact, hitInside })
 *   spot.done()          // dim it (the player has had this experience)
 *   spot.setLabel(text)  // change the E prompt
 *   experiences.add({ kind: 'sound', id, name, jp, x, z })   // a sound: the map only
 *   experiences.list     // for the map: [{ id, kind, name, jp, x, z }] (world)
 *
 * `interact: false` (or no `action`) makes a walk-in spot: no E prompt.
 * Positions are in the frame of the ctx it was made with; town.js makes it
 * in the world and hands the town a turned view of it.
 * ------------------------------------------------------------------ */

const MOTES = 12;
const canvasTex = (w, h, draw) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** The ground ring: a gold edge, the warm yellow band, a faint fill. */
const ringTex = () => canvasTex(256, 256, (g) => {
  const c = 128;
  const fill = g.createRadialGradient(c, c, 0, c, c, 118);
  fill.addColorStop(0, 'rgba(255,226,120,0.10)'); fill.addColorStop(0.85, 'rgba(255,226,120,0.24)'); fill.addColorStop(1, 'rgba(255,226,120,0)');
  g.fillStyle = fill; g.beginPath(); g.arc(c, c, 118, 0, Math.PI * 2); g.fill();
  g.lineWidth = 14; g.strokeStyle = 'rgba(196,132,20,0.85)';
  g.beginPath(); g.arc(c, c, 112, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 8; g.strokeStyle = 'rgba(255,232,140,1)';
  g.beginPath(); g.arc(c, c, 112, 0, Math.PI * 2); g.stroke();
  // four short ticks inside the band: a painted target, not a halo
  g.lineWidth = 6; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,232,140,0.9)';
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    g.beginPath(); g.moveTo(c + Math.cos(a) * 88, c + Math.sin(a) * 88); g.lineTo(c + Math.cos(a) * 100, c + Math.sin(a) * 100); g.stroke();
  }
});
/** The ripple: one thin bright ring. */
const rippleTex = () => canvasTex(128, 128, (g) => {
  g.lineWidth = 4; g.strokeStyle = 'rgba(255,236,160,1)';
  g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.stroke();
});
/** The column: bright at the foot, gone at the top, faint vertical streaks. */
const beamTex = () => canvasTex(64, 128, (g, w, h) => {
  const grad = g.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, 'rgba(255,220,120,0.55)'); grad.addColorStop(0.35, 'rgba(255,220,120,0.22)'); grad.addColorStop(1, 'rgba(255,220,120,0)');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-out';
  for (let x = 0; x < w; x += 8) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 5, 0, 3, h); }
});
const moteTex = () => canvasTex(32, 32, (g) => {
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, 'rgba(255,240,190,1)'); r.addColorStop(0.4, 'rgba(255,210,120,0.6)'); r.addColorStop(1, 'rgba(255,210,120,0)');
  g.fillStyle = r; g.fillRect(0, 0, 32, 32);
});

let shared = null;
function parts() {
  if (shared) return shared;
  const light = { transparent: true, depthWrite: false, toneMapped: false };
  shared = {
    ringMat: new THREE.MeshBasicMaterial({ map: ringTex(), ...light, polygonOffset: true, polygonOffsetFactor: -2 }),
    rippleMat: new THREE.MeshBasicMaterial({ map: rippleTex(), ...light, blending: THREE.AdditiveBlending }),
    beamMat: new THREE.MeshBasicMaterial({ map: beamTex(), ...light, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    moteTex: moteTex(),
    plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  };
  return shared;
}

export function makeExperiences(ctx) {
  const list = [];
  const P = parts();
  const spots = [];

  const api = {
    list,
    add(o) {
      const s = { r: 1.6, h: 2.2, y: 0, kind: 'engage', ...o };
      const w = ctx.toWorld ? ctx.toWorld({ x: s.x, z: s.z }) : { x: s.x, z: s.z };
      // `used`: the experience was had (its own code says so, done()); `hidden`: not on offer right now (show(false))
      const entry = { id: s.id, kind: s.kind, name: s.name, jp: s.jp, x: w.x, z: w.z, used: false, hidden: false };
      list.push(entry);
      if (s.kind === 'sound') return { done() {}, setLabel() {}, get world() { return w; } };
      // the hitbox the player aims at (invisible), only for spots that E does something at
      let item = null;
      if (s.action && s.interact !== false) {
        /* `hitInside`: E works standing in the ring too (the bench, QA-009): the box stands above the eye and is
         * seen from inside (a ray from inside a box meets only its back faces) */
        const hh = s.hitInside ? Math.max(s.h, 2.4) : s.h;
        const hit = new THREE.Mesh(new THREE.BoxGeometry(s.r * 2, hh, s.r * 2),
          new THREE.MeshBasicMaterial({ visible: false, side: s.hitInside ? THREE.DoubleSide : THREE.FrontSide }));
        hit.position.set(s.x, s.y + hh / 2, s.z);
        hit.userData.keep = true;
        hit.userData.noOutline = true;
        ctx.add(hit);
        item = { hitbox: hit, label: s.label ?? `${s.jp}  ·  ${s.name}`, action: s.action };
        ctx.interact(item);
      }
      const R = s.r * 1.15;                   // the ring stands a little outside the spot itself
      const ring = new THREE.Mesh(P.plane, P.ringMat.clone());
      ring.scale.set(R * 2, 1, R * 2);
      ring.position.set(s.x, s.y + 0.03, s.z);
      ring.renderOrder = 3;
      const ripple = new THREE.Mesh(P.plane, P.rippleMat.clone());
      ripple.position.set(s.x, s.y + 0.035, s.z);
      ripple.renderOrder = 3;
      // the column: as tall as the spot's own height allows (the station's sits under its gate sign)
      const BH = s.h + 1.1;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.96, R * 0.96, BH, 36, 1, true), P.beamMat.clone());
      beam.position.set(s.x, s.y + BH / 2 + 0.02, s.z);
      beam.renderOrder = 4;
      // the motes
      const mg = new THREE.BufferGeometry();
      mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3));
      mg.boundingSphere = new THREE.Sphere(new THREE.Vector3(s.x, s.y + 1, s.z), R + 2);
      const motes = new THREE.Points(mg, new THREE.PointsMaterial({
        map: P.moteTex, size: 0.12, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      const seeds = Array.from({ length: MOTES }, (_, i) => ({ a: Math.random() * Math.PI * 2, r: (0.2 + 0.8 * Math.sqrt(Math.random())) * R * 0.85, ph: i / MOTES, top: BH * (0.6 + 0.3 * Math.random()) }));
      for (const m of [ring, ripple, beam, motes]) {
        m.userData.noOutline = true; m.userData.dynamic = true;
        m.name = 'exp-highlight';
        ctx.add(m);
      }
      const spot = { s, w, R, ring, ripple, beam, motes, seeds, done: false, item, entry };
      spots.push(spot);
      return {
        done() { spot.done = true; entry.used = true; },
        /** Offer it or not (the train's spot: only while the train stands with its doors open): no ring, no E. */
        show(on) { entry.hidden = !on; if (item) item.hitbox.visible = on; },
        setLabel(text) { if (item) item.label = text; },
        get world() { return w; },
      };
    },
  };

  let t = 0;
  ctx.update((dt, cam) => {
    t += dt;
    if (!cam) return;
    for (const sp of spots) {
      const d = Math.hypot(sp.w.x - cam.x, sp.w.z - cam.z);
      const far = THREE.MathUtils.smoothstep(60 - d, 0, 15);
      const k = sp.entry.hidden ? 0 : far * (sp.done ? 0.5 : 1);
      const on = k > 0.01;
      sp.ring.visible = sp.ripple.visible = on;
      if (!on) { sp.beam.visible = sp.motes.visible = false; continue; }
      // the ring: softer while you stand in it
      const inside = THREE.MathUtils.smoothstep(d, sp.R * 0.6, sp.R * 1.4);
      sp.ring.material.opacity = k * (0.55 + 0.45 * inside) * (0.9 + 0.1 * Math.sin(t * 2.4));
      // the ripple: out from the middle to the ring every 2.4 s
      const u = (t / 2.4 + sp.w.x * 0.37) % 1;
      const rs = sp.R * 2 * (0.25 + 0.8 * u);
      sp.ripple.scale.set(rs, 1, rs);
      sp.ripple.material.opacity = k * 0.8 * Math.sin(Math.PI * u) * (0.4 + 0.6 * inside);
      // the column: the finder from afar; gone as you step in
      const kb = k * THREE.MathUtils.smoothstep(d, 1.6, 5) * (0.85 + 0.15 * Math.sin(t * 1.7 + sp.w.z));
      sp.beam.visible = kb > 0.01;
      sp.beam.material.opacity = kb;
      // the motes: only near
      const km = k * THREE.MathUtils.smoothstep(30 - d, 0, 8);
      sp.motes.visible = km > 0.01;
      if (sp.motes.visible) {
        sp.motes.material.opacity = km * 0.9;
        const a = sp.motes.geometry.attributes.position;
        for (let i = 0; i < MOTES; i++) {
          const m = sp.seeds[i];
          const v = (t * 0.2 + m.ph) % 1;
          const ang = m.a + v * 1.4;
          a.setXYZ(i, sp.s.x + Math.cos(ang) * m.r, sp.s.y + 0.05 + v * m.top, sp.s.z + Math.sin(ang) * m.r);
        }
        a.needsUpdate = true;
      }
    }
  });
  return api;
}
