import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { makeParts, makeScatter } from './geo.js';
import { ploughTex, rengeTex, trackTex, blocksTex, bankGrassTex } from './tex.js';
import { makeWater } from './water.js';
import { planPaddies, buildPaddies, landMats } from './paddies.js';
import { buildBanks, bankMats, buildPumpShed, buildScarecrow } from './banks.js';
import { buildGate } from './gate.js';
import { buildHills } from './hills.js';

/* ------------------------------------------------------------------ *
 * The land north of the main road (town quality pass), where M2's old
 * town stood, laid out by config.js TOWN.land in the town's own (turned)
 * frame: north is -z.
 *
 *   paddies.js  the paddies in early April, their paths and channels
 *   banks.js    the levee with its sakura row, the river 桜川, the far
 *               bank, the farm track, its ramps and the bridge
 *   gate.js     the Deer Park gate (鹿公園, coming soon)
 *   hills.js    the painted far hills
 *   water.js    sky-mirror water, the river's moving lines
 *
 * Cost: every surface of a kind is one mesh (static batching then folds
 * the plain-coloured ones into the town's style batches); every small
 * thing (seedlings, flowers, reeds, stones) one InstancedMesh per kind;
 * five small tiling textures and a few plates.
 * ------------------------------------------------------------------ */

export function buildLand(ctx) {
  const group = new THREE.Group();
  group.name = 'land';
  ctx.add(group);
  const add = (o) => { group.add(o); return o; };
  const lctx = { ...ctx, add };

  const tex = { plough: ploughTex(), renge: rengeTex(), track: trackTex(), blocks: blocksTex(), grass: bankGrassTex() };
  const mats = {
    ...landMats(tex),
    ...bankMats(tex),
    shedWall: cel({ color: 0xdcd6c6, bands: 3, tint: 0x6f6790 }),
    shedRoof: cel({ color: 0x7f97a6, bands: 3, tint: 0x4f5a88 }),
    shedDoor: cel({ color: 0x6f8f7a, bands: 3, tint: 0x4a5a70 }),
    cloth: cel({ color: 0x4f6aa0, bands: 3, tint: 0x3a3a70 }),
    straw: cel({ color: 0xd8bf82, bands: 3, tint: 0x7a6478 }),
    stone: cel({ color: 0xb4b0a6, bands: 3, tint: 0x5e5a78 }),
    gateWood: cel({ color: 0xa8825f, bands: 3, tint: 0x7a6478 }),
    door: cel({ color: 0xc9a47a, bands: 3, tint: 0x86707e }),
    roof: cel({ color: 0x5c5a66, bands: 3, tint: 0x3a3858 }),
    roofDark: cel({ color: 0x46444f, bands: 3, tint: 0x302e4a }),
    iron: cel({ color: 0x3e3c44, bands: 3, tint: 0x2e2c40 }),
    rope: cel({ color: 0xd9c38e, bands: 3, tint: 0x7a6478 }),
    paper: cel({ color: 0xfff4dc, bands: 'soft', tint: 0xd8c0b0 }),
  };
  const parts = makeParts(mats);
  const scatter = makeScatter();
  const water = makeWater(lctx);

  const plan = planPaddies();
  buildPaddies(lctx, parts, scatter, water, plan);
  buildBanks(lctx, parts, scatter, water);
  buildPumpShed(lctx, parts, plan.keep[0]);
  buildScarecrow(parts, plan.trackEdge[0] - 7.5, -27.8);
  buildGate(lctx, parts);

  parts.build(group, {
    cast: ['bridge', 'bridgeDark', 'rail', 'white', 'post', 'wood', 'gateWood', 'door', 'roof', 'roofDark', 'shedWall', 'shedRoof', 'cloth', 'straw', 'stone', 'steel', 'steelBlue'],
  });
  scatter.build(group);
  /* The sprawling surfaces (paddy sheets, banks, the track: each one mesh
   * across the whole land) are ground, whose height ctx.groundAt already
   * knows from the platforms: fallen petals don't raycast them (petals.js),
   * which cost seconds of load for every levee cherry. */
  const size = new THREE.Vector3();
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    o.geometry.boundingBox.getSize(size);
    if (Math.max(size.x, size.z) > 60) o.userData.ground = true;
  });
  buildHills(lctx);
}
