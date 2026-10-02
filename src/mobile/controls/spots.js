import * as THREE from 'three';
import { TUNE } from './tune.js';

/* ------------------------------------------------------------------ *
 * What the one context button offers (docs/decisions/mobile-lite.md,
 * "Mobile v3: UI"): the town's own interactables (world.interactables:
 * { hitbox, label, action }), found the desktop's way first, then a
 * thumb's way.
 *
 *   aimed      what the crosshair is on within 3 m (player.pick: the
 *              desktop's ray)
 *   assisted   else the nearest thing to do within TUNE.aim.reach m that
 *              is ahead of you (within TUNE.aim.cone), or whose ring you
 *              stand in whichever way you face: a thumb is a looser aim
 *              than a mouse, and the button says what it found
 *
 * The camera is never turned for you.  No allocations per frame.
 * ------------------------------------------------------------------ */

const _at = new THREE.Vector3(), _fwd = new THREE.Vector3();

/** The nearest interactable in reach and ahead (or whose ring you stand in), or null. */
export function aimAssist(list, camera, A = TUNE.aim) {
  let best = null, bestD = Infinity;
  camera.getWorldDirection(_fwd);
  const fl = Math.hypot(_fwd.x, _fwd.z) || 1;
  for (const it of list) {
    if (!it.hitbox?.parent || it.hitbox.visible === false) continue;
    it.hitbox.getWorldPosition(_at);
    const dx = _at.x - camera.position.x, dz = _at.z - camera.position.z, d = Math.hypot(dx, dz);
    if (d > A.reach || d >= bestD) continue;
    const ang = Math.acos(Math.min(1, Math.max(-1, (dx * _fwd.x + dz * _fwd.z) / (d * fl || 1))));
    const p = it.hitbox.geometry?.parameters;
    const inRing = d < (p?.width ?? (p?.radiusTop ?? p?.radius ?? 0) * 2) / 2;
    if (!inRing && ang > A.cone) continue;
    best = it; bestD = d;
  }
  return best;
}

/** What the context button acts on: the crosshair's own hit, else the assisted one. */
export function pickAction(player, list, camera) {
  if (!list?.length) return null;
  return player.pick(list) ?? aimAssist(list, camera);
}

/** A label for the button: the words after the place's name ("もちつき  ·  Order a mochi ¥200" -> "Order a mochi ¥200"). */
export const actionWords = (label) => String(label ?? '').replace(/^.*?·\s*/, '').replace(/\s{2,}/g, ' ');
