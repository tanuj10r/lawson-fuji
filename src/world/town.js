import * as THREE from 'three';
import { cel } from '../core/toon.js';
import { WORLD, TOWN } from '../config.js';
import { makeCtx } from './ctx.js';
import { buildLawson } from './lawson.js';
import { buildFuji } from './fuji.js';
import { buildBlocks } from './town-blocks.js';
import { buildRail } from './town-rail.js';
import { buildPetals } from './petals.js';
import { mergeStatic } from './merge.js';

/* ------------------------------------------------------------------ *
 * The town (SPEC section 3).
 *
 * Places everything in the world: the Lawson and its road (M1), and round
 * them the compact town (M2) -- main road, railway with its level crossing
 * and station, shopping street, residential lane, park, sakura, poles and
 * wires -- then batches the static geometry by material.  Sakura Crossing's
 * modules are used as parts, placed in our layout with our own signs.
 * ------------------------------------------------------------------ */

export function buildTown(scene) {
  const root = new THREE.Group();
  root.name = 'town';
  scene.add(root);
  const ctx = makeCtx(scene, root);

  /* --- ground --- */
  const groundMat = cel({ color: WORLD.groundColor, bands: 3, tint: 0x7a7396, cache: false });
  groundMat.userData.live = true;
  {
    const size = WORLD.groundHalf * 2;
    const g = new THREE.PlaneGeometry(size, size, 1, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, groundMat);
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.userData.keep = true;
    m.name = 'ground';
    root.add(m);
  }

  /* --- the Lawson and the road in front of it (M1) --- */
  const lawson = buildLawson(root);
  ctx.colliders.push(...lawson.colliders);
  ctx.platforms.push(...lawson.platforms);

  /* --- the town (M2) --- */
  buildBlocks(ctx);
  const rail = buildRail(ctx);
  // bottles behind a vending machine's glass shadow only its own insides
  root.traverse((o) => {
    if (o.isInstancedMesh && o.parent?.name === 'vending') o.castShadow = false;
  });


  const camPos = new THREE.Vector3(0, 0, 16.5);
  const petals = buildPetals(ctx, {
    count: TOWN.petals, half: 24, trackZ: TOWN.rail.z, follow: () => camPos,
  });
  for (const m of petals.meshes) m.userData.dynamic = true;

  // batched per 128 m cell, so the camera and the shadow map can cull
  const batching = mergeStatic(root, { cell: 128 });

  /* --- Mt. Fuji, riding with the camera like the sky --- */
  const fuji = buildFuji(scene);

  return {
    root,
    colliders: ctx.colliders,
    interactables: ctx.interactables,
    bounds: WORLD.bounds,
    lawson,
    fuji,
    rail,
    batching,
    /** Ground height at (x, z); see ctx.heightAt for `fromY`. */
    heightAt: ctx.heightAt,
    setLook(look) {
      groundMat.color.set(look.ground);
      lawson.setLook(look);
      fuji.setLook(look);
    },
    update(dt, camera) {
      if (camera) camPos.copy(camera.position);
      for (const fn of ctx.updaters) fn(dt);
      petals.update(dt, rail.train.gust, rail.train.dir);
      if (camera) fuji.follow(camera);
    },
  };
}
