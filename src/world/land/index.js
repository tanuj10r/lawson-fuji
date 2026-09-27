import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { TOWN } from '../../config.js';
import { makeParts, makeScatter, sheetGeo } from './geo.js';
import { ploughTex, rengeTex, trackTex, bankGrassTex, masonryTex, slabTex, TILE } from './tex.js';
import { makeWater } from './water.js';
import { planPaddies, buildPaddies, buildTrack, buildPumpShed, buildNotice, buildScarecrow, landMats } from './paddies.js';
import { buildChannel, channelMats } from './channel.js';
import { buildPond, pondMats } from './pond.js';
import { buildGate } from './gate.js';
import { buildHills } from './hills.js';

/* ------------------------------------------------------------------ *
 * The land north of the main road (town quality pass; Tan's layout in
 * wave 2c), laid out by config.js TOWN.land in the town's own (turned)
 * frame: north is -z.  From the spawn you turn round to the river:
 *
 *   channel.js  the river 桜川 in its sunken channel: revetments, lower
 *               walks with sakura, stairs down and up, stepping stones,
 *               the road-level bridge 富士見橋, the river walks on top
 *   paddies.js  the paddies beyond (curving paths, early April), the
 *               farm track, the pump shed, the kei truck, the scarecrow
 *   pond.js     鏡池, the pond: promenade, lanterns, pines, a willow,
 *               lotus, the tea house and low houses, benches
 *   gate.js     the Deer Park gate (鹿公園, coming soon)
 *   hills.js    the painted far hills
 *   water.js    sky-mirror paddies, the river's moving lines, the pond
 *
 * Cost: every surface of a kind is one mesh (static batching then folds
 * the plain-coloured ones into the town's style batches); every small
 * thing (seedlings, flowers, reeds, stones, pads) one InstancedMesh per
 * kind; a few small tiling textures and plates.
 * ------------------------------------------------------------------ */

export function buildLand(ctx) {
  const group = new THREE.Group();
  group.name = 'land';
  ctx.add(group);
  const add = (o) => { group.add(o); return o; };
  ctx.green ??= {};              // the pond's pines join the town's batch (kit/green.js)
  const lctx = { ...ctx, add };
  const L = TOWN.land;

  const tex = {
    plough: ploughTex(), renge: rengeTex(), track: trackTex(), grass: bankGrassTex(),
    masonry: masonryTex(), slab: slabTex(),
  };
  const mats = {
    ...landMats(tex),
    ...channelMats(tex),
    ...pondMats(tex),
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

  buildChannel(lctx, parts, scatter, water);
  const plan = planPaddies();
  buildPaddies(lctx, parts, scatter, water, plan);
  buildTrack(lctx, parts);
  buildPumpShed(lctx, parts, plan.apron);
  buildNotice(lctx, parts, plan.trackEdge[0] - 0.4, L.farTop.z0 - 3.5);
  buildScarecrow(parts, -4, -53);
  buildPond(lctx, parts, scatter, water);
  buildGate(lctx, parts);

  // the verges: grass where no field, walk or pond reaches (the far walk's
  // edge, the tree line, the land's east end)
  const px1 = L.pond.box[2];
  parts.add('grass', sheetGeo(px1, 130, L.far[3] - 0.7, L.far[3], 0.02, TILE.grass));
  parts.add('grass', sheetGeo(px1, 130, -101, L.deerGate.z + 6.9, 0.02, TILE.grass));
  parts.add('grass', sheetGeo(L.far[2] - 0.2, 130, L.deerGate.z + 6.5, L.far[3] - 0.5, 0.02, TILE.grass));

  parts.build(group, {
    cast: ['bridge', 'bridgeDark', 'rail', 'white', 'post', 'wood', 'gateWood', 'door', 'roof', 'roofDark', 'shedWall', 'shedRoof',
      'cloth', 'straw', 'stone', 'steel', 'steelBlue', 'granite', 'graniteDark', 'railWood', 'plaster', 'timber', 'tile', 'willowWood', 'willowDeep', 'redFelt'],
  });
  scatter.build(group);
  /* The sprawling surfaces (paddy sheets, walks, the track: each one mesh
   * across the whole land) are ground, whose height ctx.groundAt already
   * knows from the sinks and platforms: fallen petals don't raycast them
   * (petals.js), which cost seconds of load. */
  const size = new THREE.Vector3();
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    o.geometry.boundingBox.getSize(size);
    if (Math.max(size.x, size.z) > 60) o.userData.ground = true;
  });
  buildHills(lctx);
}
