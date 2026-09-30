import * as THREE from 'three';
import { cel, setWearTexture } from '../core/toon.js';
import { wearAtlas } from '../world/kit/paint.js';
import { WORLD, TOWN, LAWSON } from '../config.js';
import { makeCtx } from '../world/ctx.js';
import { cutSinks } from '../world/sinkcut.js';
import { buildLawson } from '../world/lawson.js';
import { dressLawsonGround } from '../world/lawson-dress.js';
import { buildFuji } from '../world/fuji.js';
import { buildFrame, buildOldTown } from '../world/town-edge.js';
import { buildCore } from '../world/town-core.js';
import { buildPetals } from '../world/petals.js';
import { mergeStatic } from '../world/merge.js';
import { buildTownSakura } from '../world/kit/sakura.js';
import { buildLand } from '../world/land/index.js';
import { makeExperiences } from '../world/experiences.js';
import { buildAnimals } from '../world/animals/index.js';
import { makeNight } from '../world/kit/night.js';

/* ------------------------------------------------------------------ *
 * The phone build's town: world/town.js, word for word, but for what the
 * lite version changes (marked LITE; docs/decisions/mobile-lite.md).  The
 * same builders place the same town; only the static batching is cut into
 * smaller cells (so distance culling works) with the small props in their
 * own detail cells, and the two petal fields are thinner (config.js
 * MOBILE).  Keep it in step with world/town.js.
 *
 * The town (SPEC section 3).
 *
 * Places everything in the world: the Lawson and its road (M1), and round
 * them the compact town (M2) -- main road, railway with its level crossing
 * and station, shopping street, residential lane, park, sakura, poles and
 * wires -- then batches the static geometry by material.  Sakura Crossing's
 * modules are used as parts, placed in our layout with our own signs.
 * ------------------------------------------------------------------ */

/* LITE: `stage(name)` is told as each big part is done (the ?diag readout
 * keeps the last, so a phone that dies while building says where), and
 * `shrink(root, store)` makes each part's painted pages phone-sized as soon
 * as it is built, so the desktop-sized pages never all exist at once. */
export function buildTown(scene, { cell = 128, detailCell = 0, stage = () => {}, shrink = null } = {}) {
  const root = new THREE.Group();
  root.name = 'town';
  scene.add(root);
  const ctx = makeCtx(scene, root);
  // the shared painted weather every worn surface reads (M2e, kit/paint.js)
  setWearTexture(wearAtlas());

  /* --- the Lawson and the road in front of it (M1) --- */
  const lawson = buildLawson(root);
  shrink?.(lawson.root, true);            // LITE: the konbini's stock and wall pages, now
  stage('built: konbini');
  ctx.colliders.push(...lawson.colliders);
  ctx.platforms.push(...lawson.platforms);

  /* --- the town (M2e.3): built in its own tested frame, turned half round
   * about the main road, so it stands between the Lawson and Fuji and you
   * walk into it from the famous views.  T is that frame; the world ctx
   * keeps the Lawson, the road and what the famous views see. --- */
  const T = ctx.turned(TOWN.grid.main, 'town-turned');
  // experience spots (Tan's seven things to do): one set per frame
  const expWorld = makeExperiences(ctx), expTown = makeExperiences(T);
  ctx.experiences = expWorld;
  T.experiences = expTown;
  // the density registry lives in the town's frame, with its decals and lots
  const registry = [];
  T.registry = registry;
  const localRect = (r) => {
    const a = T.toLocal({ x: r[0], z: r[1] }), b = T.toLocal({ x: r[2], z: r[3] });
    return [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)];
  };
  ctx.registry = { push: (e) => registry.push({ ...e, ...T.toLocal(e), ...(e.rect ? { rect: localRect(e.rect) } : {}) }) };
  // the Lawson counts toward the density budget like any building
  ctx.registry.push({ kind: 'building', x: 0, z: -5, rect: [-8.5, -LAWSON.depth, 11.1, 0] });
  const frame = buildFrame(ctx);
  T.sakura = [];                 // the old town's trees join the town's batch
  buildOldTown(T);
  T.night = makeNight(T);        // before the land, so its lantern can light the ground
  buildLand(T);                  // paddies, the river, the Deer Park gate (town pass)
  stage('built: land');
  // the Lawson's lot is worn with the town's own decals (oil, scuffs,
  // patches), placed in world terms and turned into the town's frame
  T.onDecals = (decals) => dressLawsonGround({
    add: (cell, x, z, across, along, f = { x: 0, z: -1 }, y, layer) => {
      const p = T.toLocal({ x, z });
      decals.add(cell, p.x, p.z, across, along, { x: -f.x, z: -f.z }, y, layer);
    },
  });
  const core = buildCore(T);
  shrink?.(root, false);                  // LITE: the town's pages, before they are packed into the atlas
  stage('built: town core');
  // wave 3: koi, ducks, herons, pigeons... (world/animals/), and the guide shiba, which
  // reads the experiences (every frame's list, world coordinates) and where you look
  const animals = buildAnimals(T, { core, spots: () => [...expWorld.list, ...expTown.list, ...lawson.experiences.list], facing: () => camDir });

  /* The line, seen from the world: its crossing, its trains' events and
   * their gusts in world terms (`local` is the line itself, for checks
   * that run in its own frame). */
  // the two cherries framing the famous view: the town's painted tree, in
  // the world's frame (its own small batch; lit at night like the rest)
  const frameSakura = buildTownSakura({ ...ctx, night: T.night }, frame.sakura, { classic: true });   // the famous views' own trees keep their look
  const L = core.line;
  const line = Object.create(L, {
    local: { value: L },
    crossingPos: { get: () => T.toWorld(L.crossingPos) },
    onEvent: { value: (fn) => L.onEvent((name, run) => fn(name, run && run.x !== undefined ? { ...run, ...T.toWorld(run) } : run)) },
    gustAt: { value: (p) => { const a = L.gustAt(T.toLocal(p)); return { gust: a.gust, dir: -a.dir }; } },
  });
  /** The camera as the town's frame sees it (sakura culling, birds). */
  const camLocal = { isCamera: true, position: new THREE.Vector3(), fov: 50, aspect: 1, getWorldDirection: null };
  const camDir = new THREE.Vector3();
  // bottles behind a vending machine's glass shadow only its own insides
  root.traverse((o) => {
    if (o.isInstancedMesh && o.parent?.name === 'vending') o.castShadow = false;
  });


  const camPos = new THREE.Vector3(0, 0, 16.5);
  // no petals fall inside the store (M3d): its footprint under the roof
  const indoors = [{ x0: -LAWSON.width / 2 - 0.1, x1: LAWSON.width / 2 + LAWSON.wingWidth, z0: -LAWSON.depth - 0.1, z1: 0.05, top: LAWSON.height }];
  const petals = buildPetals(ctx, {
    count: TOWN.petals.air, half: 24, trackZ: T.toWorld({ x: 0, z: TOWN.rail.z }).z, follow: () => camPos, exclude: indoors,
  });
  // and the fall from the town's sakura (M2d), a separate field so the famous
  // views keep M2's petals exactly
  const railZ = T.toWorld({ x: 0, z: TOWN.rail.z }).z;
  const fall = buildPetals(ctx, {
    count: TOWN.petals.trees, half: 24, trackZ: railZ, follow: () => camPos,
    emitters: [...(core.sakura?.emitters ?? []).map((e) => T.toWorld(e)), ...(frameSakura?.emitters ?? [])], onlyTrees: true, seed: 8211, exclude: indoors,
  });
  for (const m of fall.meshes) m.userData.dynamic = true;
  for (const m of petals.meshes) m.userData.dynamic = true;

  /* --- ground: one plane, open over any sunken ground (ctx.sink: the
   * river's channel, town pass), so it is built after everything else.
   * Every other flat piece of street-level ground (the Lawson's lot, walks)
   * is cut back to the sinks' edges too, or it caps the channel from above
   * (sinkcut.js; quality pass). --- */
  cutSinks(root, ctx.sinks);
  const groundMat = cel({ color: WORLD.groundColor, bands: 3, tint: 0x7a7396, cache: false });
  groundMat.userData.live = true;
  {
    const h = WORLD.groundHalf;
    const shape = new THREE.Shape([new THREE.Vector2(-h, -h), new THREE.Vector2(h, -h), new THREE.Vector2(h, h), new THREE.Vector2(-h, h)]);
    // the shape lies in (x, -z): it is turned flat below, so y becomes -z
    for (const k of ctx.sinks) {
      const x0 = Math.max(-h + 1, k.x0), x1 = Math.min(h - 1, k.x1), z0 = Math.max(-h + 1, k.z0), z1 = Math.min(h - 1, k.z1);
      shape.holes.push(new THREE.Path([new THREE.Vector2(x0, -z1), new THREE.Vector2(x0, -z0), new THREE.Vector2(x1, -z0), new THREE.Vector2(x1, -z1)]));
    }
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, groundMat);
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.userData.keep = true;
    m.name = 'ground';
    root.add(m);
  }

  // batched per 128 m cell, so the camera and the shadow map can cull
  // the Lawson keeps its own textures: the famous view never changes
  lawson.root.userData.noAtlas = true;
  lawson.ground.userData.noAtlas = true;
  // small props (the kit's detail tag) still take shadows but cast none:
  // at their size the shadow pass pays far more than it shows (SPEC 11)
  const small = (o, on) => {
    on ||= !!o.userData.detail;
    if (on && o.isMesh) o.castShadow = false;
    for (const c of o.children) small(c, on);
  };
  small(root, false);
  /* LITE: a batch is split by its shadow flags too, so every style came in
   * up to four batches a cell.  A basic (unlit) material shows no shadow
   * whatever its flag says, and a toon one takes them: one receive flag
   * each, and a cell's batches are about halved. */
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
    if (o.material.isMeshBasicMaterial) o.receiveShadow = false;
    else if (o.material.isMeshToonMaterial) o.receiveShadow = true;
  });
  shrink?.(root, false);
  stage('batching');
  const batching = mergeStatic(root, { cell, atlas: true, detailCell });   // LITE: smaller cells, and detail cells
  stage('batched');

  /* --- Mt. Fuji, riding with the camera like the sky --- */
  const fuji = buildFuji(scene);

  // what the pond's mirror shows (world rect): its grounds and 25 m round
  // (and the paddies' mirror: the two sit side by side, so one rect holds both)
  const pb = TOWN.land.pond?.box && [
    Math.min(TOWN.land.pond.box[0], TOWN.land.paddies?.box[0] ?? Infinity), Math.min(TOWN.land.pond.box[1], TOWN.land.paddies?.box[1] ?? Infinity),
    Math.max(TOWN.land.pond.box[2], TOWN.land.paddies?.box[2] ?? -Infinity), Math.max(TOWN.land.pond.box[3], TOWN.land.paddies?.box[3] ?? -Infinity)];
  const worldRect = (r, pad) => {
    const a = T.toWorld({ x: r[0], z: r[1] }), b = T.toWorld({ x: r[2], z: r[3] });
    return [Math.min(a.x, b.x) - pad, Math.min(a.z, b.z) - pad, Math.max(a.x, b.x) + pad, Math.max(a.z, b.z) + pad];
  };
  // and the river's mirror (land/channel.js): the channel's stretch through the town, 12 m round
  const rv = TOWN.land.sunk && TOWN.land.riverMirror && [TOWN.land.riverMirror[0], TOWN.land.sunk.z0, TOWN.land.riverMirror[1], TOWN.land.sunk.z1];
  const reflectRect = pb && [worldRect(pb, 25), ...(rv ? [worldRect(rv, 12)] : [])];

  return {
    root,
    reflectRect,
    /** Every experience spot, world positions (the minimap's stars). */
    experiences: { get list() { return [...expWorld.list, ...expTown.list]; } },
    colliders: ctx.colliders,
    interactables: ctx.interactables,
    bounds: WORLD.bounds,
    lawson,
    /** The falling petals' meshes (M3d: checked to stay out of the store). */
    petalMeshes: [...petals.meshes, ...fall.meshes],
    core,
    registry,                  // in the town's frame (density checks run there)
    fuji,
    line,
    /** The town's frame (turned): toWorld / toLocal / yawToWorld. */
    frame: { toWorld: T.toWorld, toLocal: T.toLocal, yawToWorld: T.yawToWorld },
    batching,
    /** Ground height at (x, z); see ctx.heightAt for `fromY`. */
    heightAt: ctx.heightAt,
    setLook(look) {
      groundMat.color.set(look.ground);
      lawson.setLook(look);
      core.kit.setLook(look);
      core.line.setLook(look);
      core.night.setLook(look);
      fuji.setLook(look);
    },
    update(dt, camera) {
      if (camera) camPos.copy(camera.position);
      for (const fn of ctx.updaters) fn(dt, camPos);   // camPos: where the camera is, in the world
      lawson.update(dt, camPos);          // the automatic door
      const lp = T.toLocal(camPos);
      camLocal.position.set(lp.x, camPos.y, lp.z);
      if (camera) {
        camera.getWorldDirection(camDir);
        camLocal.fov = camera.fov; camLocal.aspect = camera.aspect;
        camLocal.getWorldDirection = (v) => v.set(-camDir.x, camDir.y, -camDir.z);
      }
      core.sakura?.update(camera ? camLocal : camLocal.position);
      core.green?.update(camera ? camLocal : camLocal.position);
      frameSakura?.update(camera ?? camPos);
      core.life?.update(dt, camLocal.position);
      const air = line.gustAt(camPos);
      petals.update(dt, air.gust, air.dir);
      fall.update(dt, air.gust, air.dir);
      if (camera) fuji.follow(camera);
    },
  };
}
