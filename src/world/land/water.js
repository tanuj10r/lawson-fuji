import * as THREE from 'three';
import { paddyWaterTex, riverRippleTex } from './tex.js';

/* ------------------------------------------------------------------ *
 * The land's water, in the painted manner: no reflection pass.
 *
 * Still water mirrors the sky near the horizon, which is the colour the
 * scene's fog already carries for every look (day, golden, blue), so the
 * water takes the fog's colour, a touch deeper, each frame: a copy, not a
 * redraw.  Flat and unlit, like the sky it mirrors.
 *
 *   paddy   one material for every flooded plot and channel: soft cloud
 *           lights and short wind ripples, still
 *   river   flat bands (dark at the banks, light mid-stream) in vertex
 *           colours under ripple lines and glints that slide downstream,
 *           only while the camera is near
 * ------------------------------------------------------------------ */

const PADDY_TINT = new THREE.Color(0.66, 0.82, 1.02);
/* the river is deeper and moving: its own teal, leaned toward the sky */
const RIVER_BASE = new THREE.Color(0x3f8ea6);

export function makeWater(ctx) {
  const paddy = new THREE.MeshBasicMaterial({ color: 0xc8def2, map: paddyWaterTex() });
  paddy.userData.live = true;
  const rippleMap = riverRippleTex();
  const river = new THREE.MeshBasicMaterial({ color: 0xc8def2, vertexColors: true, map: rippleMap });
  river.userData.live = true;

  /* The ripples slide only while the river is drawn and the camera is near
   * it (onBeforeRender runs only for a drawn mesh). */
  const cam = new THREE.Vector3();
  let seen = false;
  const watch = (mesh, rect, near = 60) => {
    mesh.onBeforeRender = (r, s, camera) => {
      const p = ctx.toLocal({ x: camera.position.x, z: camera.position.z });
      const dx = Math.max(rect[0] - p.x, 0, p.x - rect[2]);
      const dz = Math.max(rect[1] - p.z, 0, p.z - rect[3]);
      if (Math.hypot(dx, dz) < near) { seen = true; cam.set(p.x, camera.position.y, p.z); }
    };
  };

  let t = 0;
  ctx.update((dt) => {
    const fog = ctx.scene.fog;
    if (fog) {
      paddy.color.copy(fog.color).multiply(PADDY_TINT);
      river.color.copy(RIVER_BASE).lerp(fog.color, 0.42);
    }
    if (!seen) return;
    seen = false;
    t += dt;
    // downstream is +x in the town's frame; a slow drift and a lazy sway
    rippleMap.offset.set(t * 0.018, Math.sin(t * 0.35) * 0.004);
  });

  return { paddy, river, watch };
}
