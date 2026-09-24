import * as THREE from 'three';
import { cel } from '../core/toon.js';
import { WORLD } from '../config.js';
import { buildLawson } from './lawson.js';
import { buildFuji } from './fuji.js';

/* ------------------------------------------------------------------ *
 * The town.
 *
 * Places everything in the world.  M1 places the Lawson, its forecourt and
 * the road in front of it, with Mt. Fuji beyond, on a flat ground plane.
 * The compact town around them is M2.  The Sakura Crossing modules
 * elsewhere in src/world are a parts library and are not placed from here
 * until SPEC.md calls for them.
 * ------------------------------------------------------------------ */

export function buildTown(scene) {
  const root = new THREE.Group();
  root.name = 'town';
  scene.add(root);

  const colliders = [];
  const interactables = [];
  const updaters = [];

  /* --- ground --- */
  const groundMat = cel({ color: WORLD.groundColor, bands: 3, tint: 0x7a7396, cache: false });
  {
    const size = WORLD.groundHalf * 2;
    const g = new THREE.PlaneGeometry(size, size, 1, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, groundMat);
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.name = 'ground';
    root.add(m);
  }

  /* --- the Lawson and the road in front of it --- */
  const lawson = buildLawson(root);
  colliders.push(...lawson.colliders);

  /* --- Mt. Fuji, riding with the camera like the sky --- */
  const fuji = buildFuji(scene);

  return {
    root,
    colliders,
    interactables,
    bounds: WORLD.bounds,
    lawson,
    fuji,
    /** Ground height at (x, z): flat, bar the far sidewalk's kerb. */
    heightAt(x, z) {
      return lawson.heightAt(x, z);
    },
    setLook(look) {
      groundMat.color.set(look.ground);
      lawson.setLook(look);
      fuji.setLook(look);
    },
    update(dt, camera) {
      for (const fn of updaters) fn(dt);
      if (camera) fuji.follow(camera);
    },
  };
}
