import * as THREE from 'three';
import { paddyWaterTex, riverRippleTex, pondTex } from './tex.js';

/* ------------------------------------------------------------------ *
 * The land's water, in the painted manner: no reflection pass.
 *
 * Still water mirrors the sky near the horizon, which is the colour the
 * scene's fog already carries for every look (day, golden, blue), so the
 * water takes the fog's colour each frame: a copy, not a redraw.  Flat and
 * unlit, like the sky it mirrors.
 *
 *   paddy   every flooded plot and channel: cloud lights, wind lines, still
 *   river   flat bands (dark at the banks, light mid-stream) in vertex
 *           colours under ripple lines that slide downstream
 *   pond    鏡池: calm olive water with a light chop that drifts
 * The river and the pond move only while drawn with the camera near.
 * ------------------------------------------------------------------ */

const PADDY_TINT = new THREE.Color(0.66, 0.82, 1.02);
/* the river is deeper and moving: its own teal, leaned toward the sky */
const RIVER_BASE = new THREE.Color(0x3f8ea6);
/* the pond: olive green, as the old pond in Nara is, a little sky in it */
const POND_BASE = new THREE.Color(0xa9a86a);

export function makeWater(ctx) {
  const paddy = new THREE.MeshBasicMaterial({ color: 0xc8def2, map: paddyWaterTex() });
  paddy.userData.live = true;
  const rippleMap = riverRippleTex();
  const river = new THREE.MeshBasicMaterial({ color: 0xc8def2, vertexColors: true, map: rippleMap });
  river.userData.live = true;
  const chop = pondTex();
  const pond = new THREE.MeshBasicMaterial({ color: 0x8a9058, map: chop, vertexColors: true });
  pond.userData.live = true;

  /* Moving water moves only while drawn and the camera is near it
   * (onBeforeRender runs only for a drawn mesh). */
  const seen = { river: false, pond: false };
  const watch = (mesh, rect, key = 'river', near = 60) => {
    mesh.onBeforeRender = (r, s, camera) => {
      const p = ctx.toLocal({ x: camera.position.x, z: camera.position.z });
      const dx = Math.max(rect[0] - p.x, 0, p.x - rect[2]);
      const dz = Math.max(rect[1] - p.z, 0, p.z - rect[3]);
      if (Math.hypot(dx, dz) < near) seen[key] = true;
    };
  };

  const t = { river: 0, pond: 0 };
  ctx.update((dt) => {
    const fog = ctx.scene.fog;
    if (fog) {
      paddy.color.copy(fog.color).multiply(PADDY_TINT);
      river.color.copy(RIVER_BASE).lerp(fog.color, 0.42);
      pond.color.copy(POND_BASE).lerp(fog.color, 0.3);
    }
    if (seen.river) {
      t.river += dt;
      // downstream is +x in the town's frame; a slow drift and a lazy sway
      rippleMap.offset.set(t.river * 0.018, Math.sin(t.river * 0.35) * 0.004);
    }
    if (seen.pond) {
      t.pond += dt;
      chop.offset.set(Math.sin(t.pond * 0.21) * 0.01 + t.pond * 0.003, t.pond * 0.002);
    }
    seen.river = seen.pond = false;
  });

  return { paddy, river, pond, watch };
}
