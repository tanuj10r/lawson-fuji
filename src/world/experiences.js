import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Experience spots (Tan, 2026-09-28): the town's seven things to do, each
 * marked so a player knows to walk up to it.  A soft warm-yellow glow ring
 * on the ground and a small floating diamond above, both fading in from
 * 60 m and out again as you arrive (so the spot is clear from afar and
 * uncluttered up close); `E` does the thing.  A spot you've done dims but
 * stays.
 *
 *   const spot = experiences.add({ id, name, jp, x, z, r, h, y, action,
 *                                  label, marker: true })
 *   spot.done()          // dim it (the player has had this experience)
 *   spot.setLabel(text)  // change the E prompt
 *   experiences.list     // for the minimap: [{ id, name, jp, x, z }] (world)
 *
 * Positions are in the frame of the ctx it was made with; town.js makes it
 * in the world and hands the town a turned view of it.
 * ------------------------------------------------------------------ */

const GLOW = 0xffd76a;

function ringTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 18, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,215,106,0)');
  grad.addColorStop(0.62, 'rgba(255,215,106,0.55)');
  grad.addColorStop(0.78, 'rgba(255,236,170,0.9)');
  grad.addColorStop(1, 'rgba(255,215,106,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeExperiences(ctx) {
  const list = [];
  const ringMat = new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const gemMat = new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, depthWrite: false, toneMapped: false });
  const gemGeo = new THREE.OctahedronGeometry(0.22, 0);
  gemGeo.scale(1, 1.5, 1);
  const spots = [];

  const api = {
    list,
    add(o) {
      const s = { r: 1.6, h: 2.2, y: 0, marker: true, ...o };
      const w = ctx.toWorld ? ctx.toWorld({ x: s.x, z: s.z }) : { x: s.x, z: s.z };
      list.push({ id: s.id, name: s.name, jp: s.jp, x: w.x, z: w.z });
      // the hitbox the player aims at (invisible)
      const hit = new THREE.Mesh(new THREE.BoxGeometry(s.r * 2, s.h, s.r * 2), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(s.x, s.y + s.h / 2, s.z);
      hit.userData.keep = true;
      hit.userData.noOutline = true;
      ctx.add(hit);
      const item = { hitbox: hit, label: s.label ?? `${s.jp}  ·  ${s.name}`, action: s.action };
      ctx.interact(item);
      // the glow
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(s.r * 2.6, s.r * 2.6), ringMat.clone());
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(s.x, s.y + 0.035, s.z);
      ring.renderOrder = 3;
      ring.userData.noOutline = true; ring.userData.dynamic = true;
      ctx.add(ring);
      let gem = null;
      if (s.marker) {
        gem = new THREE.Mesh(gemGeo, gemMat.clone());
        gem.position.set(s.x, s.y + s.h + 0.9, s.z);
        gem.userData.noOutline = true; gem.userData.dynamic = true;
        ctx.add(gem);
      }
      const spot = { s, w, ring, gem, done: false, item };
      spots.push(spot);
      return {
        done() { spot.done = true; },
        setLabel(text) { item.label = text; },
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
      // in from 60 m, and gently out as you arrive: clear from afar, quiet up close
      const far = THREE.MathUtils.smoothstep(60 - d, 0, 15);
      const near = 0.35 + 0.65 * THREE.MathUtils.smoothstep(d, 1.5, 6);
      const k = far * near * (sp.done ? 0.45 : 1);
      const pulse = 0.8 + 0.2 * Math.sin(t * 2.2 + sp.w.x);
      sp.ring.material.opacity = k * pulse;
      sp.ring.visible = k > 0.01;
      if (sp.gem) {
        // the diamond goes altogether as you arrive: from under it (seated on the
        // bench, praying at the box) its faces filled the top of the view as pale beams
        const kg = k * THREE.MathUtils.smoothstep(d, 1.2, 3.0);
        sp.gem.visible = kg > 0.01;
        sp.gem.material.opacity = kg;
        sp.gem.position.y = sp.s.y + sp.s.h + 0.9 + Math.sin(t * 1.8 + sp.w.z) * 0.12;
        sp.gem.rotation.y = t * 0.9;
      }
    }
  });
  return api;
}
