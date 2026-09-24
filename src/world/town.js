import * as THREE from 'three';
import { cel } from '../core/toon.js';
import { WORLD } from '../config.js';

/* ------------------------------------------------------------------ *
 * The town.
 *
 * Places everything in the world.  Until the Lawson (M1) and the compact
 * town (M2) go in, that is only a flat ground plane under the sky.  The
 * Sakura Crossing modules elsewhere in src/world are a parts library and
 * are not placed from here until SPEC.md calls for them.
 * ------------------------------------------------------------------ */

export function buildTown(scene) {
  const root = new THREE.Group();
  root.name = 'town';
  scene.add(root);

  const colliders = [];
  const interactables = [];
  const updaters = [];

  /* --- ground --- */
  {
    const size = WORLD.groundHalf * 2;
    const g = new THREE.PlaneGeometry(size, size, 1, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, cel({ color: WORLD.groundColor, bands: 3, tint: 0x7a7396 }));
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.name = 'ground';
    root.add(m);
  }

  return {
    root,
    colliders,
    interactables,
    bounds: WORLD.bounds,
    /** Ground height at (x, z).  Flat everywhere for now. */
    heightAt() {
      return 0;
    },
    update(dt) {
      for (const fn of updaters) fn(dt);
    },
  };
}
