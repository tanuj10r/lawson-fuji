import * as THREE from 'three';
import { cel } from '../core/toon.js';
import { rngKit } from '../core/util.js';
import { WORLD } from '../config.js';
import { makeCtx } from './ctx.js';
import { buildFuji } from './fuji.js';
import { buildKit } from './kit/index.js';
import { buildSignals } from './signals.js';
import { mergeStatic } from './merge.js';

/* ------------------------------------------------------------------ *
 * Dev only (?kit): the M2a kit test street.
 *
 * About 145 x 115 m of network under the town's sky and Fuji: a main road
 * with cycle lanes, a zebra with signals and a bus stop; a shopping street
 * off it; residential lanes with a T junction, a 4-way junction and a
 * corner.  Grey massing blocks stand in for lots, so frontage, service
 * drops and the density of the street furniture can be judged.  M2b
 * replaces the blocks with the house and shopfront generators.
 * ------------------------------------------------------------------ */

export const KIT_TEST = {
  nodes: {
    A: [-70, 0], B: [-20, 0], D: [30, 0], E: [75, 0],
    H: [-20, -35], F: [-20, -65],
    L: [-20, 28], G: [-20, 50],
    I: [30, -35], J: [65, -35], K: [30, -65],
    M: [45, 28],
  },
  edges: [
    ['A', 'B', 'main', { poles: -1, tactileSide: 1 }],
    ['B', 'D', 'main', { poles: -1, tactileSide: 1 }],
    ['D', 'E', 'main', { poles: -1, tactileSide: 1 }],
    ['B', 'H', 'shopping', { poles: 1 }],
    ['H', 'F', 'shopping', { poles: 1 }],
    ['B', 'L', 'lane', { school: true }],
    ['L', 'G', 'lane'],
    ['H', 'I', 'lane', { school: false, pedPriority: true, poles: -1 }],
    ['I', 'J', 'lane', { school: false, pedPriority: false }],
    ['D', 'I', 'lane', { poles: -1 }],
    ['I', 'K', 'lane'],
    ['L', 'M', 'lane', { poles: 1 }],
  ],
  crossings: [{ edge: 1, at: 5 }, { edge: 3, at: -20 }],
  busStops: [{ edge: 2, at: 52, side: -1 }],
};

export function buildKitTest(scene) {
  const root = new THREE.Group();
  root.name = 'kit-test';
  scene.add(root);
  const ctx = makeCtx(scene, root);

  const groundMat = cel({ color: WORLD.groundColor, bands: 3, tint: 0x7a7396, cache: false });
  groundMat.userData.live = true;
  {
    const g = new THREE.PlaneGeometry(WORLD.groundHalf * 2, WORLD.groundHalf * 2);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, groundMat);
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.userData.keep = true;
    m.name = 'ground';
    root.add(m);
  }

  const kit = buildKit(ctx, KIT_TEST);
  buildSignals(ctx, { x: 5, zNear: -5, zFar: 5, width: 4, zebra: false });

  /* ---- massing blocks along every frontage ---- */
  const net = kit.net;
  const taken = [];
  const pad = 0.2;
  for (const e of net.edges) taken.push(rectOf(net, e, e.s0, e.s1, -e.t, e.t));
  for (const n of Object.values(net.nodes)) taken.push([n.x - n.tx, n.z - n.tz, n.x + n.tx, n.z + n.tz]);
  const hits = (r) => taken.some((t) => r[0] < t[2] - pad && r[2] > t[0] + pad && r[1] < t[3] - pad && r[3] > t[1] + pad);

  const tones = [0xd8d4dc, 0xcfcad6, 0xe0dce2, 0xc8c4d0];
  const blockMats = tones.map((c) => cel({ color: c, bands: 3, tint: 0x6f6790 }));
  for (const e of net.edges) {
    const r = rngKit(e.seed + 99);
    for (const side of [-1, 1]) {
      const set = e.spec.walk > 0 ? e.t + 0.2 : e.a + 0.8;
      let s = e.s0 + 1;
      while (s < e.s1 - 4) {
        const w = r.range(7, 12), dpt = r.range(8, 11), h = r.pick([6.2, 6.6, 9.2]);
        const rect = rectOf(net, e, s, s + w, side * set, side * (set + dpt));
        if (!hits(rect)) {
          taken.push(rect);
          const [x0, z0, x1, z1] = rect;
          const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), r.pick(blockMats));
          b.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
          b.castShadow = b.receiveShadow = true;
          b.name = 'lot';
          ctx.add(b);
          ctx.collide(x0, z0, x1, z1, h);
          // a service drop to the facade that faces the street
          const f = net.at(e, s + w / 2, side * set);
          kit.serviceDrop(new THREE.Vector3(f.x, 5.2, f.z));
        }
        s += w + r.range(0.5, 1.5);
      }
    }
  }
  kit.finish();

  const batching = mergeStatic(root, { cell: 128 });
  const fuji = buildFuji(scene);

  return {
    root,
    colliders: ctx.colliders,
    interactables: ctx.interactables,
    bounds: { x0: -90, x1: 95, z0: -80, z1: 70 },
    lawson: null,
    fuji,
    rail: null,
    kit,
    batching,
    heightAt: ctx.heightAt,
    setLook(look) {
      groundMat.color.set(look.ground);
      fuji.setLook(look);
      kit.setLook(look);
    },
    update(dt, camera) {
      for (const fn of ctx.updaters) fn(dt);
      if (camera) fuji.follow(camera);
    },
  };
}

function rectOf(net, e, s0, s1, o0, o1) {
  const a = net.at(e, s0, o0), b = net.at(e, s1, o1);
  return [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)];
}
