import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { rngKit } from '../../core/util.js';
import { TOWN } from '../../config.js';
import { RIVER } from '../../data/town.js';
import { makeBench } from '../props.js';
import { sheetGeo, quadGeo, boxGeo, makeParts } from './geo.js';
import { TILE, postPlateTex, riverSignTex, pondWobbleTex } from './tex.js';
import { makeMirror, REFLECT } from './mirror.js';

/* ------------------------------------------------------------------ *
 * The river 桜川 in its sunken channel (Tan's layout, wave 2c), in the
 * town's frame (north is -z).  Behind the spawn you come to a railing on
 * the river walk; below it the channel runs the width of the land and out
 * to the hills:
 *
 *   revetments  masonry (間知石) from the street down to the lower walks
 *   lower walks 河川敷 both sides: grass, a paved path, sakura, benches
 *   river       15 m of water a hand below the walks, stones and reeds
 *   stairs      stone stairs down from the town side, up on the far side
 *   stones      飛び石 across the water on the spawn's axis
 *   bridge      富士見橋 carries the farm track over at street level; the
 *               lower walks run under it
 *
 * ctx.sink lowers the base ground over the channel (town.js leaves the
 * ground plane open there): everything down here is floored and walled
 * by this file.  Walking: the walks stand on the sink, the stairs and
 * stones are platforms, and the revetments, the water, the stair walls and
 * the railings are colliders, so the drop is never walkable but by stairs.
 * ------------------------------------------------------------------ */

const WALK_X = [-122, 122];          // the town's bounds: the player never goes past

export function channelMats(tex) {
  return {
    masonry: cel({ color: 0xffffff, bands: 3, tint: 0x6a6490, map: tex.masonry }),
    slab: cel({ color: 0xffffff, bands: 3, tint: 0x6a6490, map: tex.slab }),
    grass: cel({ color: 0xffffff, bands: 3, tint: 0x5b6f8c, map: tex.grass }),
    track: cel({ color: 0x8a8ea0, bands: 3, tint: 0x5a5480, map: tex.track }),   // the bridge road's asphalt
    granite: cel({ color: 0xc9c5bb, bands: 3, tint: 0x6a6490 }),
    graniteDark: cel({ color: 0xa6a298, bands: 3, tint: 0x5f5880 }),
    nosing: cel({ color: 0x7e7a74, bands: 3, tint: 0x4f4a6c }),
    railWood: cel({ color: 0x8a6a50, bands: 3, tint: 0x5a4a68 }),
    deck: cel({ color: 0x8e8c94, bands: 3, tint: 0x5a5480 }),
    bridge: cel({ color: 0xd6d2c8, bands: 3, tint: 0x6f6790 }),
    bridgeDark: cel({ color: 0xaeaaa0, bands: 3, tint: 0x5f5880 }),
    rail: cel({ color: 0x8fb2c0, bands: 3, tint: 0x4f5a88 }),
    post: cel({ color: 0x6f6e74, bands: 3, tint: 0x4f4a70 }),
    lampHead: cel({ color: 0xf6efdc, bands: 'soft', tint: 0xb8a8b8 }),
  };
}

/** The channel's cross-section, from the street down and up again. */
export function channelProfile() {
  const L = TOWN.land, S = L.sunk;
  return {
    top: S.z1, farTop: S.z0, walk: S.walk,
    townFoot: L.walks.town[1], farFoot: L.walks.far[0],     // where each revetment meets its walk
    townEdge: L.walks.town[0], farEdge: L.walks.far[1],      // each walk's edge at the water
    river: L.river,
  };
}

/** Is x inside an opening (a stair head, the bridge) on this side? */
function openings(side) {
  const L = TOWN.land;
  const out = L.stairs.filter((s) => s.side === side).map((s) => [s.x - s.w / 2 - 0.35, s.x + s.w / 2 + 0.35]);
  out.push([L.bridge.x - L.bridge.w / 2 - 0.2, L.bridge.x + L.bridge.w / 2 + 0.2]);
  return out.sort((a, b) => a[0] - b[0]);
}
/** [a, b] minus the openings: the runs of wall or railing between them. */
function runs(a, b, gaps) {
  const out = [];
  let x = a;
  for (const [g0, g1] of gaps) {
    if (g1 <= x || g0 >= b) continue;
    if (g0 > x) out.push([x, g0]);
    x = Math.max(x, g1);
  }
  if (x < b) out.push([x, b]);
  return out;
}

export function buildChannel(ctx, staticParts, scatter, water) {
  const L = TOWN.land, S = L.sunk, R = L.river;
  const P = channelProfile();
  const W = S.walk;
  const r = rngKit(5301);

  /* The channel's pieces are batched into the town's 128 m cells as ever
   * (so the town's culling stays as it was).  The river's mirror cannot see
   * a merged cell (it would draw whole cells of the town again), so every
   * piece standing along the mirrored stretch is also kept as a copy on the
   * REFLECT layer alone: drawn only by the mirror's camera, no shadows, and
   * the main pass never sees it. */
  const [mx0, mx1] = L.riverMirror ?? [0, 0];
  const rparts = makeParts(staticParts.mats);
  const bb = new THREE.Box3();
  const parts = {
    mats: staticParts.mats,
    add(name, geo) {
      staticParts.add(name, geo);
      if (mx1 > mx0) {
        geo.computeBoundingBox();
        bb.copy(geo.boundingBox);
        if (bb.max.x > mx0 - 6 && bb.min.x < mx1 + 6 && bb.max.y > R.water + 0.05) rparts.add(name, geo.clone());
      }
      return geo;
    },
    box(name, x0, x1, y0, y1, z0, z1) { return this.add(name, boxGeo(x0, x1, y0, y1, z0, z1)); },
  };

  /* ---- one sink at the river's bed (one hole in the ground plane); the
   * walks stand on platforms at W ---- */
  ctx.sink(S.x0, S.z0, S.x1, S.z1, R.bed);
  ctx.platform({ x0: S.x0, x1: S.x1, z0: P.townEdge, z1: P.top, top: W });
  ctx.platform({ x0: S.x0, x1: S.x1, z0: P.farTop, z1: P.farEdge, top: W });

  /* ================= revetments, copings, railings ================= */
  const MT = TILE.masonry ?? 3;
  const wall = (side) => {
    const town = side === 'town';
    const gaps = L.stairs.filter((s) => s.side === side).map((s) => [s.x - s.w / 2 - 0.3, s.x + s.w / 2 + 0.3]);
    for (const [a, b] of runs(S.x0, S.x1, gaps.sort((p, q) => p[0] - q[0]))) {
      // the masonry face: v = 0 at the foot
      const g = town
        ? quadGeo([a, 0, P.top], [b, 0, P.top], [b, W, P.townFoot], [a, W, P.townFoot], [a / MT, 1, b / MT, 1, b / MT, 0, a / MT, 0])
        : quadGeo([a, W, P.farFoot], [b, W, P.farFoot], [b, 0, P.farTop], [a, 0, P.farTop], [a / MT, 0, b / MT, 0, b / MT, 1, a / MT, 1]);
      parts.add('masonry', g);
    }
    // the coping along the top edge, open at stair heads and the bridge
    const zc = town ? P.top : P.farTop;
    for (const [a, b] of runs(S.x0, S.x1, openings(side))) {
      parts.box('granite', a, b, -0.3, 0.1, town ? zc - 0.05 : zc - 0.3, town ? zc + 0.3 : zc + 0.05);
    }
    // the railing (親水 style: granite posts, two timber rails), within the town
    const zr = town ? zc + 0.12 : zc - 0.12;
    for (const [a, b] of runs(WALK_X[0] - 2, WALK_X[1] + 2, openings(side))) {
      const n = Math.max(1, Math.round((b - a) / 2.4));
      for (let k = 0; k <= n; k++) {
        const x = a + ((b - a) * k) / n;
        parts.box('granite', x - 0.09, x + 0.09, 0.1, 0.95, zr - 0.09, zr + 0.09);
      }
      parts.box('railWood', a, b, 0.84, 0.94, zr - 0.06, zr + 0.06);
      parts.box('railWood', a, b, 0.46, 0.53, zr - 0.04, zr + 0.04);
      // shut: the drop is walkable only by the stairs
      ctx.collide(a, town ? P.townFoot : zc - 0.2, b, town ? zc + 0.25 : P.farFoot, 1.0);
    }
    // under the bridge the revetment is the abutment's: shut to the walk below
    const bx0 = L.bridge.x - L.bridge.w / 2 - 0.2, bx1 = L.bridge.x + L.bridge.w / 2 + 0.2;
    ctx.collide(bx0, town ? P.townFoot : zc, bx1, town ? zc : P.farFoot, L.bridge.deck - 0.35);
  };
  wall('town');
  wall('far');

  /* ================= the lower walks ================= */
  const walk = (side) => {
    const town = side === 'town';
    const [z0, z1] = town ? [P.townEdge, P.townFoot] : [P.farFoot, P.farEdge];
    // from the wall: a grass strip (the sakura, the benches), the path, a
    // grass verge to the kerb, all within the walk (it is 3.2 m: bands that
    // overran it lay over the water; quality pass)
    const wz = (d) => (town ? z1 - d : z0 + d);
    const wide = z1 - z0;
    const bands = [[0, 1.05, 'grass'], [1.05, wide - 0.55, 'slab'], [wide - 0.55, wide, 'grass']];
    for (const [a, b, mat] of bands) {
      const za = wz(a), zb = wz(b);
      parts.add(mat, sheetGeo(S.x0, S.x1, Math.min(za, zb), Math.max(za, zb), W + (mat === 'slab' ? 0.015 : 0), mat === 'slab' ? 4 : TILE.grass));
    }
    // the water's edge: a granite kerb, its face down to the water
    const ze = town ? P.townEdge : P.farEdge;
    parts.box('granite', S.x0, S.x1, R.bed - 0.05, W + 0.04, town ? ze : ze - 0.3, town ? ze + 0.3 : ze);
    // tufts and flowers in the grass
    for (let k = 0; k < 520; k++) {
      const x = r.range(-160, 160);
      const inner = r.chance(0.5);
      const d = inner ? r.range(0.1, 0.95) : r.range(wide - 0.5, wide - 0.15);
      const h = r.range(0.12, 0.28);
      scatter.put('tuft', x, W - 0.02, wz(d), h, h, h, r.range(0, 6.3), r.pick([0x86ad62, 0x94b86a, 0x7a9e5a]));
      if (r.chance(0.2)) scatter.put('head', x, W + h * 0.8, wz(d), 0.045, 0.03, 0.045, 0, r.pick([0xf4cf3a, 0xfbfaf0, 0xf4cf3a]));
    }
  };
  walk('town');
  walk('far');

  /* ================= the river ================= */
  {
    const bands = [[0, 0.1, 0.78], [0.1, 0.24, 0.9], [0.24, 0.8, 1.0], [0.8, 0.9, 0.9], [0.9, 1, 0.8]];
    const U = 12, V = 7;
    const w = R.z1 - R.z0;
    const riverGeo = (x0, x1) => {
      const pos = [], col = [], idx = [], uv = [];
      for (const [a, b, k] of bands) {
        const za = R.z1 - a * w, zb = R.z1 - b * w;
        const v = pos.length / 3;
        pos.push(x0, R.water, za, x1, R.water, za, x1, R.water, zb, x0, R.water, zb);
        uv.push(x0 / U, za / V, x1 / U, za / V, x1 / U, zb / V, x0 / U, zb / V);
        for (let j = 0; j < 4; j++) col.push(k, k, k);
        idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
      g.setIndex(idx);
      return g;
    };
    // the painted water: the stretch through the town, and the two reaches beyond it
    const [mx0, mx1] = L.riverMirror ?? [S.x0, S.x0];
    const reaches = [[S.x0, mx0], [mx1, S.x1]].filter(([a, b]) => b > a);
    let near = null;
    for (const [a, b] of [[mx0, mx1], ...reaches]) {
      if (b <= a) continue;
      const m = new THREE.Mesh(riverGeo(a, b), water.river);
      m.name = 'land-river';
      m.userData.dynamic = true;
      m.userData.ground = true;
      ctx.add(m);
      water.watch(m, [a, R.z0, b, R.z1], 'river');
      if (a === mx0 && b === mx1) near = m;
    }
    /* The stretch through the town is a true mirror while you are near it
     * (land/mirror.js, as the pond's): the revetments, the bridge, the
     * sakura and the sky upside down in a moving river, in the river's own
     * teal.  Only what the pond's tagging puts on the REFLECT layer is drawn
     * again (the channel's own pieces, the trees, the sky, the animals). */
    if (near) {
      const mirror = makeMirror(near.geometry, R.water, pondWobbleTex(), { size: 512, base: 0x4b8fa4, deep: 0x2f6a80, name: 'land-river-mirror' });
      mirror.camera.layers.set(REFLECT);
      mirror.visible = false;
      ctx.add(mirror);
      /* A 260 m strip's bounding sphere reaches the spawn, so three's culling
       * would run the reflection pass with the river behind you (the famous
       * view).  The pass runs only when the strip's own box is in the frustum. */
      {
        const a = ctx.toWorld({ x: mx0, z: R.z0 }), b = ctx.toWorld({ x: mx1, z: R.z1 });
        const box = new THREE.Box3(new THREE.Vector3(Math.min(a.x, b.x), R.water - 0.5, Math.min(a.z, b.z)), new THREE.Vector3(Math.max(a.x, b.x), R.water + 0.5, Math.max(a.z, b.z)));
        const frustum = new THREE.Frustum(), pv = new THREE.Matrix4();
        const render = mirror.onBeforeRender;
        mirror.onBeforeRender = function (renderer, scene, camera, ...rest) {
          pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
          if (!frustum.setFromProjectionMatrix(pv).intersectsBox(box)) return;
          render.call(this, renderer, scene, camera, ...rest);
        };
      }
      const NEAR = 45;            // the walks, the stairs, the bridge and the spawn's turn-round: not the town beyond
      let t = 0;
      ctx.update((dt, cam) => {
        if (!cam) return;
        const p = ctx.toLocal({ x: cam.x, z: cam.z });
        const d = Math.hypot(Math.max(mx0 - p.x, 0, p.x - mx1), Math.max(R.z0 - p.z, 0, p.z - R.z1));
        mirror.visible = d < NEAR;
        near.visible = !mirror.visible;
        if (mirror.visible) {
          t += dt;
          const fog = ctx.scene.fog;
          if (fog) mirror.material.uniforms.light.value = THREE.MathUtils.clamp((fog.color.r * 0.3 + fog.color.g * 0.55 + fog.color.b * 0.15) * 1.7, 0.22, 1);
          // downstream is +x: the chop drifts along the river
          mirror.material.uniforms.chopOff.value.set(t * 0.035, Math.sin(t * 0.3) * 0.006);
        }
      });
    }
    // the water is not for walking, but for the stepping stones' line
    const sx = L.stones.x;
    for (const [a, b] of [[S.x0, sx - 0.62], [sx + 0.62, S.x1]]) ctx.collide(a, R.z0, b, R.z1, W + 0.5);
  }

  // riprap and reed beds along both waterlines, stones in the shallows
  for (const [ze, dir] of [[R.z1, -1], [R.z0, 1]]) {
    for (let x = -170; x < 170; x += r.range(0.9, 2.4)) {
      if (Math.abs(x - L.stones.x) < 1.6) continue;
      const s = r.range(0.18, 0.42);
      scatter.put('stone', x, R.water - 0.03, ze + dir * r.range(0.1, 0.8), s * 1.3, s * 1.1, s * 1.1, r.range(0, 6.3), r.pick([0xa8a49a, 0x96938c, 0xb8b2a4, 0x8c8a84]));
    }
    for (let k = 0; k < 10; k++) {
      const xc = r.range(-150, 150);
      if (Math.abs(xc - L.stones.x) < 10 || Math.abs(xc - L.bridge.x) < 8) continue;
      const len = r.range(5, 14);
      for (let x = xc - len / 2; x < xc + len / 2; x += r.range(0.35, 0.8)) {
        scatter.put('reed', x, R.water, ze + dir * r.range(0.2, 1.5), r.range(0.8, 1.2), r.range(0.8, 1.4), r.range(0.8, 1.2), r.range(0, 6.3), r.pick([0xd8c49a, 0xcbb98f, 0xb9c486, 0x9fbe74]));
      }
    }
  }

  /* ================= the stepping stones (飛び石) ================= */
  {
    const sx = L.stones.x, top = L.stones.top;
    const n = Math.round((R.z1 - R.z0) / 0.9);
    const step = (R.z1 - R.z0) / n;
    const disc = new THREE.CylinderGeometry(1, 1.08, 1, 12, 1);
    for (let i = 0; i < n; i++) {
      const z = R.z1 - step * (i + 0.5);
      const x = sx + Math.sin(i * 1.3) * 0.16;
      const g = disc.clone();
      g.scale(0.44 + (i % 3) * 0.03, top - R.bed + 0.1, 0.36 + (i % 2) * 0.03);
      g.rotateY(i * 0.7);
      g.translate(x, (top + R.bed - 0.1) / 2, z);
      parts.add('granite', g);
      ctx.platform({ x0: x - 0.46, x1: x + 0.46, z0: z - step / 2 - 0.02, z1: z + step / 2 + 0.02, top });
    }
  }

  /* ================= the stairs ================= */
  for (const s of L.stairs) stair(ctx, parts, s, P);

  /* ================= the bridge (富士見橋), at street level ================= */
  bridge(ctx, parts, P);

  /* ================= the river walks on top, lamps, sakura, benches ================= */
  {
    // the town side: pavers from the far-side row's backs to the railing
    parts.add('slab', sheetGeo(-130, 130, P.top, L.top.z1, 0.012, 4));
    // the far side's walk, the paddies and the pond beyond it
    parts.add('slab', sheetGeo(-130, 130, L.farTop.z0, P.farTop, 0.012, 4));
    // lamps along both walks: warm pools after dark
    const zt = P.top + 0.8, zf = P.farTop - 1.6;
    for (const [x, z] of [[-96, zt], [-40, zt], [18, zt], [70, zt], [-100, zf], [-30, zf], [60, zf]]) {
      parts.box('post', x - 0.06, x + 0.06, 0, 3.4, z - 0.06, z + 0.06);
      parts.box('post', x - 0.05, x + 0.05, 3.3, 3.38, z - 0.5, z + 0.05);
      parts.box('lampHead', x - 0.16, x + 0.16, 3.0, 3.3, z - 0.62, z - 0.3);
      ctx.collide(x - 0.14, z - 0.14, x + 0.14, z + 0.14, 3.4);
      ctx.night?.pool(x, z - 0.45, 5.0, { strength: 1.1 });
    }
    // sakura on the lower walks, rising past the railings; none at the stairs,
    // the stones or the bridge
    const benches = [[-22, 'town'], [14, 'town'], [52, 'town'], [-40, 'far'], [30, 'far']];
    const clear = (x, side) => Math.abs(x - L.bridge.x) < 6 || Math.abs(x - L.stones.x) < 5
      || L.stairs.some((s) => s.side === side && Math.abs(x - s.x) < s.w / 2 + 2.5)
      || benches.some(([bx, bs]) => bs === side && Math.abs(x - bx) < 2.4);
    let seed = 5401;
    for (const [side, z, x0, x1, gap] of [['town', P.townFoot - 0.75, -104, 104, [11, 14]], ['far', P.farFoot + 0.75, -104, 104, [14, 19]]]) {
      for (let x = x0 + r.range(0, 4); x <= x1; x += r.range(...gap)) {
        if (clear(x, side)) continue;
        ctx.sakura.push({ x, z: z + r.range(-0.15, 0.15), y: W, scale: r.range(0.95, 1.15), seed: seed++, lean: r.range(0.06, 0.16), leanDir: side === 'town' ? r.range(3.6, 5.8) : r.range(0.5, 2.6) });
      }
    }
    // benches on the lower walks, backs to the wall, facing the water
    for (const [x, side] of benches) {
      const town = side === 'town';
      const z = town ? P.townFoot - 0.55 : P.farFoot + 0.55;
      ctx.add(makeBench({ x, z, y: W, ry: town ? Math.PI : 0, len: 1.6 }));
      ctx.collide(x - 0.82, z - 0.24, x + 0.82, z + 0.24, W + 0.9);
    }
    // 一級河川 桜川, on the town rail by the bridge, facing the street
    const sx = L.bridge.x - L.bridge.w / 2 - 3.4, sz = P.top + 0.5;
    for (const dx of [-0.62, 0.62]) parts.box('post', sx + dx - 0.04, sx + dx + 0.04, 0, 2.0, sz - 0.04, sz + 0.04);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), flat({ map: riverSignTex(RIVER) }));
    board.position.set(sx, 1.65, sz + 0.05);
    board.userData.detail = true;
    ctx.add(board);
    parts.box('post', sx - 0.78, sx + 0.78, 1.38, 1.92, sz - 0.02, sz + 0.03);
    ctx.collide(sx - 0.72, sz - 0.1, sx + 0.72, sz + 0.1, 2);
  }

  /* the reflection-only copy of the mirrored stretch (see the top) */
  if (mx1 > mx0) {
    const rg = new THREE.Group();
    rg.name = 'land-channel-reflect';
    rg.userData.dynamic = true;
    rparts.build(rg);
    rg.traverse((o) => {
      if (!o.isMesh) return;
      o.layers.set(REFLECT);
      o.castShadow = o.receiveShadow = false;
      o.userData.noOutline = true;
    });
    ctx.add(rg);
  }
}

/** One stone stair between the street and a lower walk: 9 steps, granite
 * side walls that step down with it. */
function stair(ctx, parts, s, P) {
  const town = s.side === 'town';
  const W = P.walk;
  const n = 9, rise = -W / n, tread = 0.3;
  const z0 = town ? P.top : P.farTop;
  const dir = town ? -1 : 1;                 // the way down
  const x0 = s.x - s.w / 2, x1 = s.x + s.w / 2;
  for (let i = 0; i < n; i++) {
    const za = z0 + dir * tread * i, zb = z0 + dir * tread * (i + 1);
    const lo = Math.min(za, zb), hi = Math.max(za, zb);
    const y = -rise * (i + 1);
    parts.box('granite', x0, x1, W - 0.05, y, lo, hi);
    // the nosing: a worn dark lip along each tread's edge, deep enough to read
    // from the top of the flight (cel-flat treads merged into one slab; quality pass)
    // (it stands 6 mm proud of the riser, as it does of the tread: its face lay in the riser's, and the whole
    // flight's edges flickered; Tan, "it pixelates and acts up")
    parts.box('nosing', x0, x1, y - 0.04, y + 0.006, dir < 0 ? lo - 0.006 : hi - 0.11, dir < 0 ? lo + 0.11 : hi + 0.006);
    ctx.platform({ x0, x1, z0: lo, z1: hi, top: y });
    // the side walls, a parapet stepping down beside the treads
    for (const [a, b] of [[x0 - 0.3, x0], [x1, x1 + 0.3]]) {
      parts.box('granite', a, b, W - 0.05, y + 0.85, lo, hi);
      ctx.collide(a - 0.02, lo, b + 0.02, hi, y + 0.95);
    }
  }
  // the foot: walls end in a post either side
  const zf = z0 + dir * tread * n;
  // (2 cm past the walls' ends: its face lay in theirs)
  for (const x of [x0 - 0.15, x1 + 0.15]) parts.box('graniteDark', x - 0.2, x + 0.2, W - 0.05, W + 0.95, Math.min(zf + dir * 0.02, zf - dir * 0.4), Math.max(zf + dir * 0.02, zf - dir * 0.4));
  // a handrail down the middle of the wide ones
  if (s.w > 3) {
    const len = Math.hypot(tread * n, -W);
    const g = new THREE.CylinderGeometry(0.035, 0.035, len, 6);
    g.rotateX(Math.PI / 2);
    g.rotateX(dir * Math.atan2(-W, tread * n));
    g.translate(s.x, W / 2 + 0.9, z0 + dir * (tread * n) / 2);
    parts.add('rail', g);
    for (const t of [0.05, 0.5, 0.95]) {
      const z = z0 + dir * tread * n * t, y = -rise * n * t;
      parts.box('rail', s.x - 0.03, s.x + 0.03, y - 0.1, y + 0.9, z - 0.03, z + 0.03);
    }
    ctx.collide(s.x - 0.06, Math.min(z0, zf) + 0.2, s.x + 0.06, Math.max(z0, zf) - 0.2, 1.0);
  }
}

/** 富士見橋: a low concrete bridge carrying the track across the whole
 * channel at street level; the walks below pass under it. */
function bridge(ctx, parts, P) {
  const L = TOWN.land, B = L.bridge, R = L.river;
  const top = B.deck, W = P.walk;
  const bx0 = B.x - B.w / 2, bx1 = B.x + B.w / 2;
  const z0 = B.z0, z1 = B.z1;
  // the deck: thin over the walks (head room), girders over the water
  parts.box('bridge', bx0, bx1, top - 0.42, top - 0.01, z0, z1);
  parts.add('deck', sheetGeo(bx0 + 0.3, bx1 - 0.3, z0, z1, top));
  for (const gx of [B.x - 1.25, B.x + 1.25]) parts.box('bridgeDark', gx - 0.28, gx + 0.28, top - 0.95, top - 0.42, R.z0 - 0.4, R.z1 + 0.4);
  // two piers in the river, cutwaters up- and downstream
  for (const pz of [R.z0 + (R.z1 - R.z0) * 0.34, R.z0 + (R.z1 - R.z0) * 0.66]) {
    parts.box('bridgeDark', bx0 + 0.4, bx1 - 0.4, R.bed - 0.1, top - 0.95, pz - 0.35, pz + 0.35);
    for (const s of [-1, 1]) {
      const c = new THREE.CylinderGeometry(0.35, 0.35, top - 0.95 - R.bed + 0.1, 10);
      c.translate(s < 0 ? bx0 + 0.4 : bx1 - 0.4, (top - 0.95 + R.bed - 0.1) / 2, pz);
      parts.add('bridgeDark', c);
    }
    parts.box('bridge', bx0 + 0.1, bx1 - 0.1, top - 1.05, top - 0.92, pz - 0.5, pz + 0.5);
  }
  // abutments against both revetments
  parts.box('bridge', bx0 - 0.2, bx1 + 0.2, W - 0.05, top - 0.42, P.townFoot, P.top);
  parts.box('bridge', bx0 - 0.2, bx1 + 0.2, W - 0.05, top - 0.42, P.farTop, P.farFoot);
  // walking on it; the railing shuts its sides to those on it, not to those below
  ctx.platform({ x0: bx0, x1: bx1, z0, z1, top });
  for (const s of [-1, 1]) {
    const xa = s < 0 ? bx0 : bx1 - 0.3, xb = xa + 0.3;
    parts.box('bridge', xa, xb, top - 0.01, top + 0.24, z0, z1);
    const xr = (xa + xb) / 2;
    const n = Math.round((z1 - z0) / 1.5);
    for (let k = 0; k <= n; k++) {
      const z = z0 + ((z1 - z0) * k) / n;
      parts.box('rail', xr - 0.04, xr + 0.04, top + 0.24, top + 1.1, z - 0.04, z + 0.04);
    }
    parts.box('rail', xr - 0.06, xr + 0.06, top + 1.05, top + 1.15, z0, z1);
    parts.box('rail', xr - 0.025, xr + 0.025, top + 0.64, top + 0.7, z0, z1);
    ctx.collide(xa - 0.05, z0, xb + 0.05, z1, top + 1.2, top - 0.1);
  }
  // the four posts (親柱) with their plates, on the street at each end
  const post = (x, z, face, text, key) => {
    parts.box('bridge', x - 0.26, x + 0.26, 0, top + 1.3, z - 0.26, z + 0.26);
    const cap = new THREE.ConeGeometry(0.37, 0.28, 4, 1);
    cap.rotateY(Math.PI / 4);
    cap.translate(x, top + 1.44, z);
    parts.add('bridge', cap);
    parts.box('bridgeDark', x - 0.3, x + 0.3, top + 1.24, top + 1.3, z - 0.3, z + 0.3);
    ctx.collide(x - 0.28, z - 0.28, x + 0.28, z + 0.28, top + 1.5);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.86), flat({ map: postPlateTex(text, key) }));
    plate.position.set(x, top + 0.72, z);
    plate.rotation.y = face;
    plate.translateZ(0.265);
    plate.userData.detail = true;
    ctx.add(plate);
  };
  const px0 = bx0 - 0.3, px1 = bx1 + 0.3;
  post(px0, z1 + 0.28, 0, RIVER.bridge, 'b');
  post(px1, z1 + 0.28, 0, RIVER.jp, 'r');
  post(px1, z0 - 0.28, Math.PI, RIVER.bridgeKana, 'bk');
  post(px0, z0 - 0.28, Math.PI, RIVER.kana, 'rk');
  const yr = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.86), flat({ map: postPlateTex(RIVER.built, 'y') }));
  yr.position.set(px0 + 0.265, top + 0.72, z1 + 0.28);
  yr.rotation.y = Math.PI / 2;
  yr.userData.detail = true;
  ctx.add(yr);
}
