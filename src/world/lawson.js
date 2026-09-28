import * as THREE from 'three';
import { cel, flat } from '../core/toon.js';
import { hullOutlineTree } from '../core/outline.js';
import { tactileTex } from '../core/textures.js';
import { bake, trs, shadowify } from '../core/util.js';
import { LAWSON, STREET, TOWN, ROADS, DRIVEWAYS, HERO_VIEWS, mainRoadGaps } from '../config.js';
import { droppedKerb, slopeQuad } from './streetprops.js';
import {
  signBand, sideBand, logoPlate, nobori, tileTex,
  glassShine, spillTex, redNotice, foodPoster, campaignBanner,
} from './lawson-tex.js';
import { dressLawson, wearLawson } from './lawson-dress.js';
import { buildInterior, buildDoor } from './store/interior.js';
import { buildFridgeDoors } from './store/doors.js';
import { makeShop, SPOT } from './store/shop.js';
import { makeExperiences } from './experiences.js';
import { asphaltTex, ASPHALT_TILE } from './kit/tex.js';
import { chipTex, CHIP_TILE } from './kit/paint.js';

/* ------------------------------------------------------------------ *
 * The Lawson: storefront, forecourt and the road in front of it.
 *
 * Laid out from the two real hero photos (config.js): a long, low,
 * flat-roofed box with a pale cap, the blue sign band, full-height glass
 * split by aluminium mullions, the entrance left of centre behind a zebra
 * walk, and a tiled wall section at the right end.  The interior is a
 * painted card for now (M3 builds the real one).
 * ------------------------------------------------------------------ */

const WHITE = 0xf5f6f8;
const CAP = 0xdfe3ea;
const SOFFIT = 0xc9ced8;
const ALU = 0xd4d9e1;
const ALU_DARK = 0x9aa1ae;
const ASPHALT = 0x4a4e63;     // SPEC palette anchor
const ROAD = 0x43475b;
const LOT = 0x575b6e;
const APRON = 0xc4c6ce;
const PAVING = 0xb6b8c4;
const PAINT = 0xf2f2f5;
const BOLLARD = 0xf2c230;

/** A box mesh from min/max corners. */
function slab(x0, x1, y0, y1, z0, z1, mat) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  const m = new THREE.Mesh(g, mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return m;
}

/** A flat ground quad from min/max x and z, at height y. */
function patch(x0, x1, z0, z1, y, mat) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  return m;
}

/** Lay a mesh's UVs out in world metres over the ground (tile `t`). */
function worldUV(mesh, t) {
  mesh.updateMatrix();
  const pos = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrix);
    uv.setXY(i, v.x / t, -v.z / t);
  }
  uv.needsUpdate = true;
  return mesh;
}

/** An upright quad facing +Z, from min/max x and y. */
function face(x0, x1, y0, y1, z, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
  return m;
}

export function buildLawson(parent) {
  const root = new THREE.Group();
  root.name = 'lawson';
  root.position.set(LAWSON.x, 0, LAWSON.frontZ);
  parent.add(root);

  const L = LAWSON;
  const hw = L.width / 2;
  const glassTop = L.height - L.coping - L.signBand;    // 2.96
  const bandTop = L.height - L.coping;
  const back = -L.depth;
  const wingX1 = hw + L.wingWidth;

  const colliders = [];
  const lit = [];      // flat materials brightened by the look (interior, sign)

  /* ------------------------------ the shell ------------------------------ */
  const shell = new THREE.Group();
  shell.name = 'lawson-shell';
  root.add(shell);
  const white = cel({ color: WHITE, bands: 3, tint: 0x8a86b0 });
  const cap = cel({ color: CAP, bands: 3, tint: 0x8a86b0 });
  const soffit = cel({ color: SOFFIT, bands: 2, tint: 0x7a76a0 });
  const alu = cel({ color: ALU, bands: 3, tint: 0x8a86b0 });

  // walls, roof and parapet (the front is glass)
  shell.add(slab(-hw, -hw + 0.28, 0, bandTop, back, -0.3, white));
  shell.add(slab(-hw, hw, 0, bandTop, back, back + 0.28, white));
  shell.add(slab(-hw, hw, glassTop + 0.02, glassTop + 0.3, back, -0.3, white));
  shell.add(slab(-hw, -hw + 0.22, bandTop, L.height, back, -0.3, cap));
  shell.add(slab(-hw, hw, bandTop, L.height, back, back + 0.22, cap));
  // end pillars framing the glass
  shell.add(slab(-hw, -hw + 0.45, 0, glassTop, -0.3, 0.06, white));
  shell.add(slab(hw - 0.45, hw, 0, glassTop, -0.3, 0.06, white));
  // the fascia box behind the band, its underside, and the pale cap
  shell.add(slab(-hw - 0.05, hw, glassTop, bandTop, -0.3, 0.26, soffit));
  shell.add(slab(-hw - 0.1, hw + 0.02, bandTop, L.height, -0.36, 0.34, cap));

  // tiled wall section at the right end, full height
  {
    const tiles = cel({ color: 0xffffff, bands: 3, tint: 0x8a86b0, map: tileTex(L.wingWidth / 0.22, L.height / 0.22) });
    const g = new THREE.BoxGeometry(L.wingWidth, L.height - 0.02, L.depth);
    const wing = new THREE.Mesh(g, [white, white, cap, white, tiles, white]);
    wing.position.set(hw + L.wingWidth / 2, (L.height - 0.02) / 2, back / 2 + 0.12);
    shell.add(wing);
    const notice = face(hw + 0.35, hw + 0.8, 0.95, 1.85, 0.13, cel({ map: redNotice(), bands: 3 }));
    notice.userData.noOutline = true;
    root.add(notice);
  }

  /* ------------------------------ glazing ------------------------------ */
  const gx0 = -hw + 0.45, gx1 = hw - 0.45;
  {
    const frame = new THREE.Group();
    frame.name = 'lawson-frame';
    // (the entrance's middle mullion is the two door leaves meeting: store/interior.js)
    const mullions = [-6.1, -4.2, -3.3, -1.3, -0.4, 1.55, 3.5, 5.4, 7.3];
    for (const x of mullions) frame.add(slab(x - 0.04, x + 0.04, 0.08, glassTop, -0.06, 0.06, alu));
    frame.add(slab(gx0, gx1, 0, 0.1, -0.08, 0.08, cel({ color: ALU_DARK, bands: 2 })));
    frame.add(slab(gx0, gx1, glassTop - 0.08, glassTop, -0.08, 0.08, alu));
    // the entrance: a transom over the two sliding leaves
    const d0 = L.doorX - L.doorWidth / 2, d1 = L.doorX + L.doorWidth / 2;
    frame.add(slab(d0, d1, 2.16, 2.24, -0.08, 0.08, alu));
    shell.add(frame);

    const glassMat = flat({ color: 0x9fbcd2, transparent: true, opacity: 0.3, depthWrite: false, cache: false });
    // the fixed glass either side of the entrance, and over it; the door has its own
    const glass = new THREE.Group();
    for (const [a, b, y0, y1] of [[gx0, d0, 0.1, glassTop - 0.08], [d1, gx1, 0.1, glassTop - 0.08], [d0, d1, 2.24, glassTop - 0.08]]) {
      const f = face(a, b, y0, y1, 0.0, glassMat);
      f.userData.noOutline = true;
      f.renderOrder = 2;
      glass.add(f);
    }
    glass.material = glassMat;
    root.add(glass);
    const shineTex = glassShine();
    shineTex.wrapS = THREE.RepeatWrapping;
    shineTex.repeat.set(3, 1);
    const shineMat = flat({ map: shineTex, transparent: true, opacity: 0.4, depthWrite: false, cache: false });
    const shine = new THREE.Group();
    for (const [a, b] of [[gx0, d0], [d1, gx1]]) {
      const f = face(a, b, 0.1, glassTop - 0.08, 0.012, shineMat);
      f.userData.noOutline = true;
      f.renderOrder = 3;
      shine.add(f);
    }
    shine.material = shineMat;
    root.add(shine);
    root.userData.glass = glass.material;
    root.userData.shine = shine.material;
    // setLook changes their opacity: keep them out of static batching
    glass.material.userData.live = shine.material.userData.live = true;
    // the automatic door (M3a), its leaves in the same glass
    root.userData.door = buildDoor(root, { alu, glassMat, colliders });
  }

  /* --------------------- the interior (M3a, store/interior.js) --------------------- */
  {
    const inside = new THREE.Group();
    inside.name = 'lawson-interior';
    root.add(inside);
    buildInterior(inside, { lit, colliders });
    // the cooler's and the freezers' glass doors, hung on their hinges (M3c)
    // clear, barely tinted: at 0.18 the open leaves laid a milky glare over the drinks (Tan)
    const coolGlass = flat({ color: 0xcfe0ec, transparent: true, opacity: 0.08, depthWrite: false, cache: false });
    const fridge = buildFridgeDoors(inside, inside.userData.doors, { glassMat: coolGlass, lit });
    // the konbini (Tan's experience): the hand, the featured things, the self-checkout
    const shop = makeShop(inside, { doors: fridge, lit, colliders, entrance: root.userData.door });
    root.userData.shop = shop;
    // the automatic door stays shut on anyone carrying something unpaid
    root.userData.door.hold = (p) => shop.holdDoor(p);
    /* The konbini's experience spot, at the entrance: the town's glow ring and
     * marker (experiences.js) in the store's frame, which is the world's.
     * Kept out of the famous views, which are the opening shot. */
    const spotObjs = [], spotUpd = [];
    root.userData.interactables = [];
    const exp = makeExperiences({
      add: (o) => { root.add(o); spotObjs.push(o); },
      interact: (item) => root.userData.interactables.push(item),
      update: (fn) => spotUpd.push(fn),
    });
    shop.spot = exp.add({ id: 'konbini', name: 'Nippon Mart', jp: 'ニッポン', x: SPOT.x, z: SPOT.z, r: SPOT.r, h: 2.2 });
    // the famous view itself (Tan): where the photo was taken; stepping on it frames the shot (main.js)
    const hv = HERO_VIEWS.morning.play.pos;
    exp.add({ id: 'view', name: 'Nippon Mart viewpoint', jp: '富士山ビュー', x: hv[0], z: hv[2], r: 1.0, h: 1.6 });
    root.userData.spot = { list: exp.list, update(dt, p) {
      for (const fn of spotUpd) fn(dt, p);
      if (shop.quietView()) for (const o of spotObjs) if (o.material?.visible !== false) o.visible = false;
    } };

    // posters and the banner hung just inside the glass
    const inner = -0.05;
    const hang = (tex, cx, cy, w2, h2) => {
      const m = face(cx - w2 / 2, cx + w2 / 2, cy - h2 / 2, cy + h2 / 2, inner, flat({ map: tex }));
      m.userData.noOutline = true;
      root.add(m);
      lit.push(m.material);
    };
    // food posters papering the glass, as on the real store (M2e)
    hang(foodPoster('karaage'), -7.35, 1.36, 0.66, 0.9);
    hang(foodPoster('onigiri'), -5.15, 1.42, 0.66, 0.9);
    hang(foodPoster('bento'), 0.5, 1.36, 0.66, 0.9);
    hang(foodPoster('latte'), 2.55, 1.46, 0.66, 0.9);
    hang(foodPoster('sandwich'), 4.45, 1.36, 0.66, 0.9);
    hang(foodPoster('nikuman'), 6.35, 1.42, 0.66, 0.9);
    hang(campaignBanner(), -2.05, 2.45, 2.3, 0.36);
    hang(logoPlate(), -3.78, 2.5, 0.42, 0.42);
  }

  /* ------------------------------ the sign ------------------------------ */
  {
    // panel positions in metres from the band's left end (measured off real-day.png)
    const panels = {
      blueEnd: hw + 7.4,
      segment: 1.4,
      wordmark: [hw - 3.5, hw - 1.2],
      yasai: [hw + 0.3, hw + 1.6],
      kudamono: [hw + 1.7, hw + 3.1],
    };
    const bandMat = flat({ map: signBand(L.width, L.signBand, panels) });
    const band = face(-hw, hw, glassTop, bandTop, 0.265, bandMat);
    band.userData.noOutline = true;
    root.add(band);
    const sideMat = flat({ map: sideBand(L.depth, L.signBand) });
    const side = new THREE.Mesh(new THREE.PlaneGeometry(L.depth, L.signBand), sideMat);
    side.rotation.y = -Math.PI / 2;
    side.position.set(-hw - 0.06, (glassTop + bandTop) / 2, back / 2);
    side.userData.noOutline = true;
    root.add(side);
    lit.push(bandMat, sideMat);
    for (const m of lit) m.userData.live = true;   // setLook drives all of these
    root.userData.sign = [bandMat, sideMat];
  }

  /* --------------- lived in: pipes, delivery corner, bins (M2e) --------------- */
  dressLawson(root, { lit, colliders });

  /* ------------------------ forecourt furniture ------------------------ */
  const props = new THREE.Group();
  props.name = 'lawson-props';
  root.add(props);
  {
    // yellow U bollards
    const yellow = cel({ color: BOLLARD, bands: 3 });
    for (const x of [-8.3, -5.0]) {
      const w = 0.72, h = 0.78, r = 0.16;
      const path = new THREE.CurvePath();
      path.add(new THREE.LineCurve3(new THREE.Vector3(-w / 2, 0, 0), new THREE.Vector3(-w / 2, h - r, 0)));
      path.add(new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-w / 2, h - r, 0), new THREE.Vector3(-w / 2, h, 0), new THREE.Vector3(-w / 2 + r, h, 0)));
      path.add(new THREE.LineCurve3(new THREE.Vector3(-w / 2 + r, h, 0), new THREE.Vector3(w / 2 - r, h, 0)));
      path.add(new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(w / 2 - r, h, 0), new THREE.Vector3(w / 2, h, 0), new THREE.Vector3(w / 2, h - r, 0)));
      path.add(new THREE.LineCurve3(new THREE.Vector3(w / 2, h - r, 0), new THREE.Vector3(w / 2, 0, 0)));
      const m = new THREE.Mesh(new THREE.TubeGeometry(path, 40, 0.035, 8, false), yellow);
      m.position.set(x, 0, 0.95);
      props.add(m);
      colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: 0.9, z1: 1.0 });
    }

    // のぼり flags on white weighted bases
    const pole = cel({ color: 0xe8eaee, bands: 2 });
    const base = cel({ color: 0xf2f3f5, bands: 3 });
    [-6.25, -4.95, -0.8, 2.05].forEach((x, i) => {
      const g = new THREE.Group();
      g.position.set(x, 0, 0.55);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.45, 6), pole);
      p.position.set(-0.24, 1.225, 0);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.48, 5), pole);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 2.3, 0);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.2, 14), base);
      b.position.set(-0.24, 0.1, 0);
      const flag = face(-0.23, 0.23, 0.48, 2.3, 0, cel({ map: nobori(i), side: THREE.DoubleSide, bands: 3 }));
      flag.userData.noOutline = true;
      g.add(p, bar, b, flag);
      props.add(g);
      colliders.push({ x0: x - 0.46, x1: x - 0.02, z0: 0.33, z1: 0.77 });
    });
  }

  /* ------------------------------ the ground ------------------------------ */
  const ground = new THREE.Group();
  ground.name = 'lawson-ground';
  parent.add(ground);
  const S = STREET;
  // the town's asphalt skin, world-mapped: tone drift and aggregate (M2e)
  const asphalt = cel({ color: ASPHALT, bands: 3, tint: 0x5a5480, map: asphaltTex(), cache: false });
  const road = cel({ color: ROAD, bands: 3, tint: 0x5a5480, map: asphaltTex(), cache: false });
  const lot = cel({ color: LOT, bands: 3, tint: 0x5a5480, map: asphaltTex(), cache: false });
  const apron = cel({ color: APRON, bands: 3 });
  const paving = cel({ color: PAVING, bands: 3 });
  const kerbH = 0.15;

  ground.add(worldUV(patch(S.x0, S.x1, 0, S.forecourtZ, 0.004, asphalt), ASPHALT_TILE));
  ground.add(patch(-hw - 0.6, wingX1 + 0.2, 0, S.apron, 0.008, apron));
  ground.add(worldUV(patch(S.roadX0, S.roadX1, S.forecourtZ, S.roadZ, 0.004, road), ASPHALT_TILE));
  ground.add(worldUV(patch(S.lotX0, S.lotX1, S.sidewalkZ, S.lotZ, 0.004, lot), ASPHALT_TILE));
  // the far sidewalk, raised on its kerb, with the tactile strip along it;
  // it breaks for the side road to the level crossing, whose asphalt runs on
  const platforms = [];
  // it breaks where a lane crosses the main road and runs on this side (Tan's
  // bridge road, lane x 30 through the master junction); the north walk
  // breaks for the town's lanes (town-edge.js)
  const gaps = TOWN.grid.ns.filter((r) => r.z0 !== undefined && r.z0 < TOWN.grid.main)
    .map((r) => [-r.x - ROADS[r.cls].asphalt / 2, -r.x + ROADS[r.cls].asphalt / 2]).sort((a, b) => a[0] - b[0]);
  const splitRuns = (cuts) => {
    const out = [];
    let at = S.roadX0;
    for (const [g0, g1] of [...cuts].sort((a, b) => a[0] - b[0])) { if (g0 > at) out.push([at, g0]); at = Math.max(at, g1); }
    if (S.roadX1 > at) out.push([at, S.roadX1]);
    return out;
  };
  // `runs` (the road's edge line) break only for the lanes; the walk also
  // breaks where a driveway's dropped kerb crosses it (town quality pass)
  const runs = splitRuns(gaps);
  const D = DRIVEWAYS;
  /* the main road's zebra lands on this walk too (town-edge.js signals):
   * lowered from its west edge to the bridge road's corner, a ramp on the
   * west side only (a lowered stretch that meets a gap needs none) */
  const zw = [TOWN.crosswalk.x - TOWN.crosswalk.width / 2 - 0.1, TOWN.crosswalk.x + TOWN.crosswalk.width / 2 + 0.1];
  const zGap = gaps.find(([g0]) => g0 >= zw[1] - 0.01 && g0 - zw[1] < D.ramp + 0.5);
  const zebraDrop = { x0: zw[0], x1: zGap ? zGap[0] : zw[1], rampHi: !zGap };
  const walkRuns = splitRuns([...gaps, ...D.far.map(([a, b]) => [a - D.ramp, b + D.ramp]),
    [zebraDrop.x0 - D.ramp, zebraDrop.x1 + (zebraDrop.rampHi ? D.ramp : 0)]]);
  const kerbMat = cel({ color: 0xd2d3da, bands: 3 });
  const tactileMat = (len) => {
    const t = tactileTex(false).clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(len / 0.3, 1);
    t.needsUpdate = true;
    return cel({ color: 0xffffff, bands: 3, map: t });
  };
  for (const [x0, x1] of walkRuns) {
    ground.add(shadowify(slab(x0, x1, 0, kerbH, S.roadZ, S.sidewalkZ, paving), false, true));
    ground.add(shadowify(slab(x0, x1, 0, kerbH + 0.01, S.roadZ - 0.02, S.roadZ + 0.14, kerbMat), false, true));
    platforms.push({ x0, x1, z0: S.roadZ, z1: S.sidewalkZ, top: kerbH });
    ground.add(patch(x0, x1, S.tactileZ - 0.15, S.tactileZ + 0.15, kerbH + 0.004, tactileMat(x1 - x0)));
  }
  for (const [x0, x1, rampHi = true, band = null] of [...D.far, [zebraDrop.x0, zebraDrop.x1, zebraDrop.rampHi, D.zebraBand]]) {
    const k = droppedKerb({ x0, x1, z0: S.roadZ, z1: S.sidewalkZ, roadZ: S.roadZ, k: kerbH, drop: D.drop, ramp: D.ramp, walkMat: paving, kerbMat, rampHi, band });
    for (const m of k.meshes) ground.add(m);
    platforms.push(...k.platforms);
    // the guide strip runs on across the driveway, down its ramps and back up
    const tz0 = S.tactileZ - 0.15, tz1 = S.tactileZ + 0.15, ty = 0.004;
    for (const [a, b, h0, h1] of [[x0 - D.ramp, x0, kerbH, D.drop], [x0, x1, D.drop, D.drop], ...(rampHi ? [[x1, x1 + D.ramp, D.drop, kerbH]] : [])]) {
      const m = new THREE.Mesh(slopeQuad(a, b, tz0, tz1, h0 + ty, h1 + ty), tactileMat(b - a));
      m.receiveShadow = true;
      ground.add(m);
    }
  }

  // painted lines, baked into one mesh
  {
    const parts = [];
    const line = (x0, x1, z0, z1) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      g.rotateX(-Math.PI / 2);
      parts.push({ geometry: g, matrix: trs((x0 + x1) / 2, 0.012, (z0 + z1) / 2) });
    };
    const lw = 0.2;       // wide enough to hold at the hero cameras' grazing angle
    const zebra = [L.doorX - 1.15, L.doorX + 1.15];
    // bay dividers: narrow double lines closed at the store end
    const firstBay = S.bayFirstX - Math.floor((S.bayFirstX - S.bayX0) / S.bayWidth) * S.bayWidth;
    for (let x = firstBay; x <= S.bayX1; x += S.bayWidth) {
      if (x > zebra[0] - 0.4 && x < zebra[1] + 0.4) continue;
      line(x - 0.17 - lw / 2, x - 0.17 + lw / 2, S.bayZ0, S.bayZ1);
      line(x + 0.17 - lw / 2, x + 0.17 + lw / 2, S.bayZ0, S.bayZ1);
      line(x - 0.17 - lw / 2, x + 0.17 + lw / 2, S.bayZ0, S.bayZ0 + lw);
    }
    // the zebra walk from the door out to the road
    for (let z = S.apron + 0.2; z < S.forecourtZ - 0.3; z += 0.95) line(zebra[0], zebra[1], z, z + 0.55);
    // road: edge lines and a dashed centre line.  The edge lines break at
    // every side road's mouth, both sides (Tan: they ran across the lanes)
    const town = mainRoadGaps().sort((a, b) => a[0] - b[0]);
    let from = S.roadX0;
    for (const [g0, g1] of town) {
      if (g0 - 1 > from) line(from, g0 - 1, S.forecourtZ + 0.3, S.forecourtZ + 0.3 + lw);
      from = Math.max(from, g1 + 1);
    }
    if (S.roadX1 > from) line(from, S.roadX1, S.forecourtZ + 0.3, S.forecourtZ + 0.3 + lw);
    for (const [x0, x1] of runs) line(x0 + (x0 > S.roadX0 ? 1 : 0), x1 - (x1 < S.roadX1 ? 1 : 0), S.roadZ - 0.5, S.roadZ - 0.5 + lw);
    // the centre line stops at the master junction: from the eastbound stop
    // line before its zebra to the westbound one past the junction (signals
    // run it; a centre line through a junction is what felt wrong)
    const W = TOWN.crosswalk.width, lane = ROADS.lane.asphalt / 2;
    const junctionX = -TOWN.grid.ns.find((r) => r.z0 !== undefined && r.z0 < TOWN.grid.main).x;
    const noCentre = [TOWN.crosswalk.x - W / 2 - 2.6, junctionX + lane + 2.6];
    const mid = (S.forecourtZ + S.roadZ) / 2;
    for (let x = S.roadX0; x < S.roadX1; x += 10) {
      const a = Math.max(x, x < noCentre[0] ? x : noCentre[1]), b = Math.min(x + 5, x + 5 > noCentre[0] && x < noCentre[1] ? noCentre[0] : x + 5);
      if (b - a > 0.8 && !(a >= noCentre[0] && b <= noCentre[1])) line(a, b, mid - lw / 2, mid + lw / 2);
    }
    // worn: chips and tyre-thinned bands (world-mapped)
    const paint = new THREE.Mesh(bake(parts), cel({ color: PAINT, bands: 3, map: chipTex(), cache: false }));
    worldUV(paint, CHIP_TILE);
    paint.receiveShadow = true;
    paint.name = 'lawson-paint';
    ground.add(paint);
  }

  // concrete wheel stops in each bay but the zebra
  {
    const stopMat = cel({ color: 0xc8cad2, bands: 3, tint: 0x6a6690 });   // plain precast concrete
    const firstBay = S.bayFirstX - Math.floor((S.bayFirstX - S.bayX0) / S.bayWidth) * S.bayWidth;
    for (let x = firstBay; x + S.bayWidth <= S.bayX1 + 0.01; x += S.bayWidth) {
      const cx = x + S.bayWidth / 2;
      if (Math.abs(cx - L.doorX) < 1.0) continue;
      // the stop at -10.15 would edge into the famous view's bottom-left corner
      if (cx > -11 && cx < -9) continue;
      ground.add(slab(cx - 0.8, cx + 0.8, 0, 0.13, S.stopZ - 0.08, S.stopZ + 0.08, stopMat));
    }
  }

  // the painted pool of window light on the forecourt (dusk and night)
  const spillMat = flat({
    color: 0xfff3d6,
    map: spillTex([[0.0, 0.12], [0.12, 0.24], [0.33, 0.44], [0.47, 0.6], [0.6, 0.72], [0.72, 0.84], [0.84, 1.0]]),
    transparent: true, opacity: 0, depthWrite: false, cache: false,
  });
  spillMat.userData.live = true;
  const spill = patch(gx0, gx1, 0.02, 6.5, 0.016, spillMat);
  spill.receiveShadow = false;
  spill.renderOrder = 1;
  ground.add(spill);

  /* ------------------------------ finishing ------------------------------ */
  wearLawson(shell);
  shadowify(shell);
  shadowify(props);
  hullOutlineTree(shell, { thickness: 0.0032 });
  hullOutlineTree(props, { thickness: 0.003 });

  // the store's walls (M3a: you can go in): left, back, the tiled wing on the
  // right, and the front glass either side of the door (the door is its own)
  colliders.push({ x0: -hw - 0.2, x1: -hw + 0.28, z0: back, z1: 0.35 });
  colliders.push({ x0: -hw, x1: wingX1, z0: back - 0.2, z1: back + 0.28 });
  colliders.push({ x0: hw, x1: wingX1, z0: back, z1: 0.35 });
  const dr = root.userData.door;
  colliders.push({ x0: -hw, x1: dr.d0, z0: -0.2, z1: 0.35 });
  colliders.push({ x0: dr.d1, x1: hw, z0: -0.2, z1: 0.35 });

  return {
    root,
    ground,
    colliders,
    /** Raised walkable surfaces: the far sidewalk stands on its kerb. */
    platforms,
    /** The door, each frame: `p` the player's position. */
    update(dt, p) { root.userData.door.update(dt, p); root.userData.spot.update(dt, p); },
    /** The konbini inside (Tan's experience): the hand, the featured things, the self-checkout. */
    get shop() { return root.userData.shop; },
    /** What the player can aim at outside (the konbini's spot), and the spot for a map. */
    get interactables() { return root.userData.interactables; },
    get experiences() { return root.userData.spot; },
    /** The automatic door (its onMove drives its sound, M4). */
    get door() { return root.userData.door; },
    setLook(look) {
      const s = look.store;
      for (const m of lit) m.color.setScalar(s.interior);
      for (const m of root.userData.sign) m.color.setScalar(s.sign);
      root.userData.glass.opacity = s.glass;
      root.userData.shine.opacity = 0.2 + s.glass;
      spillMat.opacity = s.spill;
    },
  };
}
