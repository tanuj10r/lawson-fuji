import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { rngKit, bake, trs } from '../../core/util.js';
import { LAYER } from './decals.js';

/* ------------------------------------------------------------------ *
 * Painted trees (M2d sakura; generalised in M2e Phase 4).
 *
 * One builder for every species in the town: a wooden skeleton (trunk,
 * bending limbs, forks, fine twigs), a canopy of flattened cushions carrying
 * a painted skin (florets, leaves or needles), lacy alpha-cut sprays at the
 * rim, and the ground under it.  A species is a *look* (kit/green.js,
 * kit/sakura.js): its form, tones, skin and cards.
 *
 * Each call builds every tree of one look in one go: one wood mesh, and per
 * tone three instanced draws (near clumps, far clumps, rim cards), sorted
 * with the view when the player moves or turns; shadows come from stand-ins
 * drawn only into the shadow map (main.js).
 *
 * A spot: { x, z, y, scale, seed, collide }.
 * ------------------------------------------------------------------ */

export function buildCanopyTrees(ctx, spots, look, { decals, name = look.name } = {}) {
  if (!spots.length) return null;
  const F = look.form;
  let wood = [];
  let woodTrees = [];            // layered crowns: each tree's wood, near and far
  let blobs = [[], [], []];
  let cards = [[], [], []];
  let dry = false;               // a dry run: grow a crown only to see where it reaches (clearOfBuildings)
  const trunkGeo = new THREE.CylinderGeometry(0.7, 1.0, 1, 8, 1);
  const limbGeo = new THREE.CylinderGeometry(0.3, 0.6, 1, 6, 1);
  const twigGeo = new THREE.CylinderGeometry(0.14, 0.32, 1, 5, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const emitters = [];
  const fallen = [];            // where petals lie (world/petals.js buildFallen)

  /** A tapered piece of wood from a to b, radius r at its base. */
  const branch = (geo, a, b, r) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-3) return;
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize());
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    wood.push({ geometry: geo, matrix: new THREE.Matrix4().compose(mid, q, new THREE.Vector3(r, len, r)) });
  };

  /* Grow one tree.  Each tree is its seed's alone, so a dry run gives the
   * very crown the real one will have. */
  function growOne(spot) {
    const r = rngKit(spot.seed ?? 1);
    const S = spot.scale ?? 1;
    const base = new THREE.Vector3(spot.x, spot.y ?? 0, spot.z);
    const hero = S >= 1.4;

    if (F.lobes) {
      // the layered crown (kit/sakura.js SAKURA): limbs in three bends, the
      // blossom in lobes at their ends, each lit on top and shaded below
      const g = growLobed(F, look, r, S, base, hero, blobs, cards);
      woodTrees.push({ hi: g.wood, lo: g.woodLo, x: base.x, z: base.z });
      settle(spot, r, S, base, hero, g.trunkH, g.top, g.reach, g.crownY);
      return;
    }

    // trunk: two lengths with a kink, flared at the foot; big trees spread
    // more than they grow, so the trunk scales slower than the crown
    const trunkH = F.trunkH * Math.pow(S, 0.6) * r.range(0.9, 1.1);
    const lean = new THREE.Vector3(r.range(-1, 1), 0, r.range(-1, 1)).multiplyScalar(F.lean * S);
    const knee = base.clone().add(new THREE.Vector3(lean.x * 0.4, trunkH * 0.55, lean.z * 0.4));
    const top = base.clone().add(new THREE.Vector3(lean.x, trunkH, lean.z));
    branch(trunkGeo, base, knee, F.girth * S);
    branch(trunkGeo, knee, top, F.girth * 0.83 * S);
    wood.push({ geometry: trunkGeo, matrix: trs(base.x, base.y + 0.15 * S, base.z, 0, 0, 0, F.girth * 1.4 * S, 0.3 * S, F.girth * 1.4 * S) });

    // limbs, each bending and forking; cushion centres at the ends
    const centres = [];
    const [l0, l1] = hero ? F.heroLimbs : F.limbs;
    const limbs = r.int(l0, l1);
    for (let i = 0; i < limbs; i++) {
      const a = (i / limbs) * Math.PI * 2 + r.range(-0.35, 0.35);
      const tilt = r.range(...(hero ? F.heroTilt : F.tilt));
      const len = (hero ? F.heroLen : F.len) * S * r.range(0.85, 1.2);
      const end = top.clone().add(new THREE.Vector3(Math.cos(a) * Math.sin(tilt) * len, Math.cos(tilt) * len, Math.sin(a) * Math.sin(tilt) * len));
      const knee2 = top.clone().lerp(end, r.range(0.4, 0.55)).add(new THREE.Vector3(r.range(-0.3, 0.3) * S, r.range(0.25, 0.6) * S * F.rise, r.range(-0.3, 0.3) * S));
      branch(limbGeo, top, knee2, 0.12 * S * F.girth / 0.24);
      branch(twigGeo, knee2, end, 0.2 * S * F.girth / 0.24);
      centres.push({ p: end, w: 1 });
      if (!F.padsOnly) centres.push({ p: top.clone().lerp(end, 0.55).add(new THREE.Vector3(0, 0.5 * S, 0)), w: 0.6 });
      for (let k = 0; k < F.forks; k++) {
        const b = r.range(-0.9, 0.9);
        const l2 = len * r.range(0.45, 0.75);
        const d2 = new THREE.Vector3(Math.cos(a + b) * 0.8, r.range(0.05, 0.5) * F.rise, Math.sin(a + b) * 0.8).normalize();
        const e2 = end.clone().addScaledVector(d2, l2);
        branch(twigGeo, end, e2, 0.08 * S);
        centres.push({ p: e2, w: 1 });
        for (let t = 0; t < F.fineTwigs; t++) {
          const d3 = new THREE.Vector3(d2.x + r.range(-0.6, 0.6), d2.y + r.range(-0.2, 0.5), d2.z + r.range(-0.6, 0.6)).normalize();
          branch(twigGeo, e2, e2.clone().addScaledVector(d3, S * r.range(0.9, 1.6) * F.fineLen), 0.028 * S);
        }
      }
    }

    // the canopy: cushions round every centre, the outer ones drooping,
    // tone by height (light on top, deep below)
    const perTree = Math.round((hero ? F.perTree[1] : F.perTree[0]) * Math.min(1.3, S) * r.range(0.9, 1.1));
    let yMin = Infinity, yMax = -Infinity;
    for (const c of centres) { yMin = Math.min(yMin, c.p.y); yMax = Math.max(yMax, c.p.y); }
    const reach = centres.reduce((m, c) => Math.max(m, Math.hypot(c.p.x - top.x, c.p.z - top.z)), 0.1);
    const count = F.padsOnly ? centres.length : perTree;
    for (let i = 0; i < count; i++) {
      const c = F.padsOnly ? centres[i].p : centres[Math.floor(r.next() * centres.length)].p;
      const rad = F.cushion * Math.sqrt(S) * r.range(0.7, 1.25);
      const sp = F.padsOnly ? 0.15 : F.spread;
      const px = c.x + r.range(-1.1, 1.1) * S * sp;
      const pz = c.z + r.range(-1.1, 1.1) * S * sp;
      const out = Math.hypot(px - top.x, pz - top.z) / reach;
      const py = c.y + (F.padsOnly ? r.range(0, 0.2) : r.range(-0.55, 0.75)) * S - Math.max(0, out - 0.7) * F.droop * S;
      const hi = (py - yMin) / Math.max(0.5, yMax + S - yMin);
      let tone = hi > 0.6 ? 0 : hi < 0.25 ? 2 : 1;
      if (r.next() < 0.2) tone = (tone + 1) % 3;
      const [f0, f1] = F.flatten;
      const tiltMax = F.padsOnly ? 0.08 : 0.35;
      blobs[tone].push({
        m: trs(px, py, pz, r.range(-tiltMax, tiltMax), r.range(0, 3), r.range(-tiltMax, tiltMax), rad * F.wide, rad * r.range(f0, f1), rad * F.wide),
        x: base.x, z: base.z, px, py, pz,
      });
      // the rim: lacy sprays standing out past the outer cushions
      if (look.card && (out > F.rimFrom || py > yMax + 0.2 * S)) {
        const h = Math.max(0.1, Math.hypot(px - top.x, pz - top.z));
        const ox = (px - top.x) / h, oz = (pz - top.z) / h;
        const cs = rad * r.range(1.5, 2.2);
        cards[tone].push({
          m: trs(px + ox * rad * 0.7, py + r.range(-0.2, 0.3) * rad, pz + oz * rad * 0.7, r.range(-0.3, 0.3), Math.atan2(ox, oz) + r.range(-0.7, 0.7), r.range(-0.4, 0.4), cs, cs, cs),
          x: base.x, z: base.z, px, py, pz,
        });
      }
    }

    settle(spot, r, S, base, hero, trunkH, top, null);
  }

  /* No crown through a building (Tan, 2026-09-28: a tree "protruding through
   * a building" by the shrine; 40 trees in town did).  Each tree is grown dry,
   * its crown's cushions tested against every building (world.colliders tall
   * and wide enough to be one); one that cuts in slides away from what it
   * hits, a little at a time, and failing that grows smaller.  The town's
   * colliders are all in before the trees are built. */
  const buildings = (ctx.colliders ?? []).filter((c) => (c.top ?? 0) >= 2.5 && c.x1 - c.x0 > 1.2 && c.z1 - c.z0 > 1.2 && (c.x1 - c.x0) * (c.z1 - c.z0) >= 6);
  const toW = (x, z) => (ctx.toWorld ? ctx.toWorld({ x, z }) : { x, z });
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  /** The building the tree at `spot` cuts into (and by how much), or null. */
  function clash(spot) {
    const keep = [wood, woodTrees, blobs, cards];
    wood = []; woodTrees = []; blobs = [[], [], []]; cards = [[], [], []]; dry = true;
    growOne(spot);
    const crown = blobs.flat();
    [wood, woodTrees, blobs, cards] = keep; dry = false;
    let worst = null;
    for (const b of crown) {
      b.m.decompose(_p, _q, _s);
      const rad = 0.8 * Math.max(_s.x, _s.z) * 0.8;
      const w = toW(b.px, b.pz);
      for (const c of buildings) {
        if (b.py - rad > c.top - 0.2 || b.py + rad < (c.bottom ?? 0) + 0.5) continue;
        const dx = Math.max(c.x0 - w.x, 0, w.x - c.x1), dz = Math.max(c.z0 - w.z, 0, w.z - c.z1);
        const cut = rad * 0.6 - Math.hypot(dx, dz);
        if (cut > 0 && (!worst || cut > worst.cut)) worst = { c, cut };
      }
    }
    return worst;
  }
  function clearOfBuildings(spot) {
    if (!buildings.length || spot.clear === false) return;
    // never into a road (ctx.onRoad, the town's carriageways): a slide that would land the trunk on one is not made
    const road = (x, z) => !!ctx.onRoad?.(x, z) && !ctx.onRoad(spot._x0 ?? x, spot._z0 ?? z);
    spot._x0 = spot.x; spot._z0 = spot.z;
    let stuck = false;
    for (let k = 0; k < 14; k++) {
      const hit = clash(spot);
      if (!hit) return;
      if (k === 13) { spot.drop = true; return; }                       // no room anywhere: not planted
      if (k >= 8 || stuck) { spot.scale = (spot.scale ?? 1) * 0.88; continue; }     // no room to move: smaller
      // away from the building's nearest face, in the tree's own frame
      const w = toW(spot.x, spot.z), c = hit.c;
      const cx = Math.max(c.x0, Math.min(c.x1, w.x)), cz = Math.max(c.z0, Math.min(c.z1, w.z));
      let ax = w.x - cx, az = w.z - cz;
      if (Math.hypot(ax, az) < 1e-3) { const mx = (c.x0 + c.x1) / 2, mz = (c.z0 + c.z1) / 2; ax = w.x - mx; az = w.z - mz; }
      const n = Math.hypot(ax, az) || 1, step = Math.min(1.2, hit.cut + 0.3);
      const a = toW(0, 0), b = toW(1, 0), d = toW(0, 1);               // the frame's axes in the world
      const ux = { x: b.x - a.x, z: b.z - a.z }, uz = { x: d.x - a.x, z: d.z - a.z };
      // straight away from it, or else along the street either way (a tree between a lane and a house)
      const dx = (ax * ux.x + az * ux.z) / n, dz = (ax * uz.x + az * uz.z) / n;
      const way = [[dx, dz], [-dz, dx], [dz, -dx]].find(([sx, sz]) => !road(spot.x + sx * step, spot.z + sz * step));
      if (!way) { stuck = true; continue; }
      spot.x += way[0] * step; spot.z += way[1] * step;
    }
  }

  for (const spot of spots) {
    const x0 = spot.x, z0 = spot.z;
    clearOfBuildings(spot);
    if (import.meta.env?.DEV) (window.__trees ??= []).push({ w: toW(spot.x, spot.z), w0: toW(x0, z0), moved: +Math.hypot(spot.x - x0, spot.z - z0).toFixed(2), dropped: !!spot.drop });
    if (spot.drop) continue;
    growOne(spot);
  }

  /** What every tree leaves round it: its petal fall, its collider, its
   * registry entry and the ground under it. */
  function settle(spot, r, S, base, hero, trunkH, top, reach, crownY) {
    if (dry) return;
    if (look.emit) emitters.push({ x: top.x, y: crownY ?? top.y + 0.8 * S, z: top.z, r: reach ? reach * 0.85 : 2.6 * S });
    if (spot.collide !== false) ctx.collide(base.x - F.girth * 1.2 * S, base.z - F.girth * 1.2 * S, base.x + F.girth * 1.2 * S, base.z + F.girth * 1.2 * S, base.y + trunkH);
    ctx.registry?.push({ kind: 'prop', x: base.x, z: base.z });

    // the ground under it
    if (decals && look.ground) {
      const G = look.ground;
      if (G.carpet) {
        const cr = (hero ? 4.2 : 3.0) * S * (G.carpetScale ?? 1);
        decals.add(G.carpet, base.x + r.range(-0.5, 0.5), base.z + r.range(-0.5, 0.5), cr * 2, cr * 2, { x: r.range(-1, 1), z: 1 }, spot.y ?? 0, LAYER.petals);
      }
      if (G.drift) {
        const n = hero ? 16 : 8;
        for (let k = 0; k < n; k++) {
          const a = r.range(0, Math.PI * 2), d = r.range(0.6, 2.8) * S;
          decals.add(G.drift, base.x + Math.cos(a) * d, base.z + Math.sin(a) * d, r.range(0.8, 1.6) * S, r.range(1.2, 2.6) * S,
            { x: Math.cos(a + 1.3), z: Math.sin(a + 1.3) }, spot.y ?? 0, LAYER.petals);
        }
      }
    }
    if (look.fallen) fallen.push({ x: base.x, z: base.z, y: spot.y ?? 0, r: reach ?? 2.6 * S, top: top.y, seed: spot.seed ?? 1 });
  }

  const woodMat = cel({ color: look.wood ?? 0x5e4a52, bands: look.woodBands ?? 3, tint: look.woodTint ?? 0x3e3448, flat: !F.lobes, ...(look.woodGlow ? { emissive: look.wood, emissiveIntensity: 0, cache: false } : {}) });
  // after dark the bark keeps a little of its brown, so a limb never goes to a black cut-out
  if (look.woodGlow) ctx.night?.glowing(woodMat, look.wood, look.woodGlow);
  let woodMesh = null, woodSwap = null;
  if (wood.length) {
    woodMesh = new THREE.Mesh(bake(wood), woodMat);
    woodMesh.castShadow = woodMesh.receiveShadow = true;
    woodMesh.name = name + 'Wood';
    ctx.add(woodMesh);
  }
  if (woodTrees.length) {
    /* The layered crowns' wood: smooth-shaded and round near the player, a
     * coarse copy past NEAR, switched per tree in one batched draw.  It takes
     * no shadow: the limbs sit in their own blossom's shadow, which left them
     * flat ambient, near black (like the blossom, which takes none either). */
    const geos = woodTrees.map((t) => [bake(t.hi), bake(t.lo)]);
    let nv = 0, ni = 0;
    for (const pair of geos) for (const g of pair) { nv += g.attributes.position.count; ni += g.index ? g.index.count : 0; }
    const bm = new THREE.BatchedMesh(geos.length * 2, nv, ni, woodMat);
    const ids = geos.map(([hi, lo]) => {
      const h = bm.addInstance(bm.addGeometry(hi));
      const l = bm.addInstance(bm.addGeometry(lo));
      bm.setVisibleAt(h, false);
      hi.dispose(); lo.dispose();
      return [h, l];
    });
    bm.castShadow = true;
    bm.receiveShadow = false;
    bm.name = name + 'Wood';
    bm.userData.dynamic = true;          // switched at run time: not for the cell merge
    ctx.add(bm);
    woodMesh ??= bm;
    const near = new Uint8Array(woodTrees.length);
    woodSwap = (p) => {
      woodTrees.forEach((t, i) => {
        const n = Math.hypot(t.x - p.x, t.z - p.z) < 32 ? 1 : 0;
        if (n === near[i]) return;
        near[i] = n;
        bm.setVisibleAt(ids[i][0], !!n);
        bm.setVisibleAt(ids[i][1], !n);
      });
    };
  }

  /* The canopy, with distance-based detail (SPEC 11): near the player a
   * cushion is six little balls merged, each shaded round (radial normals),
   * which gives the scalloped edge painted foliage has; past NEAR metres,
   * one low ball.  Only what is in (or just outside) the view is drawn. */
  const nearGeo = clumpGeometry(1), farGeo = clumpGeometry(0, true);
  const make = (geo, mat, nm, n) => {
    const inst = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    inst.castShadow = false;
    inst.receiveShadow = false;         // foliage stays high-key (see trees.js)
    inst.frustumCulled = false;         // the instances move between the sets
    inst.name = nm;
    ctx.add(inst);
    return inst;
  };
  const skin = look.skin().clone();
  skin.repeat.set(...(look.skinRepeat ?? [2, 1]));
  skin.needsUpdate = true;
  const cardGeo = new THREE.PlaneGeometry(1, 1);
  {
    // cards take light as if they faced up and out, so both sides shade alike
    const nr = cardGeo.attributes.normal;
    for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 0.8, 0.6);
  }
  const glow = look.glow ?? 0;
  const sets = blobs.map((list, i) => {
    const tone = look.tones[i], tint = look.tints[i];
    const mat = cel({ color: tone, map: skin, bands: look.bands ?? 'blossom', tint, flat: false, emissive: tone, emissiveIntensity: 0, cache: false });
    if (glow) ctx.night?.glowing(mat, tone, glow);
    let cardList = [], cardMesh = null;
    if (look.card) {
      const cardMat = cel({ color: tone, map: look.card(), bands: look.bands ?? 'blossom', tint, alphaTest: 0.5, side: THREE.DoubleSide, emissive: tone, emissiveIntensity: 0, cache: false });
      if (glow) ctx.night?.glowing(cardMat, tone, glow);
      cardList = cards[i];
      cardMesh = make(cardGeo, cardMat, name + 'Cards' + i, cards[i].length);
    }
    return { list, near: make(nearGeo, mat, name + 'Near' + i, list.length), far: make(farGeo, mat, name + 'Far' + i, list.length), cardList, cards: cardMesh };
  });
  const all = blobs.flat();
  const shadeMat = cel({ color: look.tones[1] });
  const shades = [nearGeo, clumpGeometry(1, true)].map((geo, i) => {
    const m = make(geo, shadeMat, name + 'Shadow' + i, all.length);
    m.castShadow = true;
    m.userData.shadowOnly = true;     // main.js shows it to the shadow pass only
    return m;
  });

  const NEAR = 40, SHADE = 68, SHADE_NEAR = 30;   // SHADE: the box diagonal, a tall crown's lean, a turn
  const last = { x: Infinity, z: Infinity, fwd: new THREE.Vector3() };
  const fwd = new THREE.Vector3(), to = new THREE.Vector3();
  const inView = (b, p, cone) => {
    if (cone <= -1 || Math.hypot(b.px - p.x, b.pz - p.z) <= 8) return true;
    to.set(b.px - p.x, b.py - p.y, b.pz - p.z).normalize();
    return to.dot(fwd) >= cone;
  };
  function update(cam) {
    const p = cam.position ?? cam;
    const hasView = !!cam.isCamera;
    if (hasView) cam.getWorldDirection(fwd); else fwd.set(0, 0, 0);
    if (Math.hypot(p.x - last.x, p.z - last.z) < 2 && fwd.angleTo(last.fwd) < 0.15) return;
    last.x = p.x; last.z = p.z; last.fwd.copy(fwd);
    woodSwap?.(p);
    // the view's half-diagonal, plus a margin for the turn before the next sort
    const cone = hasView
      ? Math.cos(Math.min(Math.PI, Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * Math.hypot(1, cam.aspect)) + 0.45))
      : -2;
    for (const set of sets) {
      let n = 0, f = 0;
      for (const b of set.list) {
        if (!inView(b, p, cone)) continue;
        // a whole tree is near or far, never half of one
        if (Math.hypot(b.x - p.x, b.z - p.z) < NEAR) set.near.setMatrixAt(n++, b.m);
        else set.far.setMatrixAt(f++, b.m);
      }
      set.near.count = n; set.far.count = f;
      // an empty set draws nothing: skip its call altogether
      set.near.visible = n > 0; set.far.visible = f > 0;
      set.near.instanceMatrix.needsUpdate = true;
      set.far.instanceMatrix.needsUpdate = true;
      if (set.cards) {
        let c = 0;
        for (const b of set.cardList) if (inView(b, p, cone)) set.cards.setMatrixAt(c++, b.m);
        set.cards.count = c;
        set.cards.visible = c > 0;
        set.cards.instanceMatrix.needsUpdate = true;
      }
    }
    // shadow stand-ins: only what can fall inside the sun's shadow box
    // (main.js: +-40 m round a point 16 m ahead of the player)
    const h = Math.hypot(fwd.x, fwd.z) || 1;
    const tx = p.x + (fwd.x / h) * 16 * (hasView ? 1 : 0), tz = p.z + (fwd.z / h) * 16 * (hasView ? 1 : 0);
    const k = [0, 0];
    for (const b of all) {
      if (Math.hypot(b.px - tx, b.pz - tz) > SHADE) continue;
      const i = Math.hypot(b.px - p.x, b.pz - p.z) < SHADE_NEAR ? 0 : 1;
      shades[i].setMatrixAt(k[i]++, b.m);
    }
    shades.forEach((m, i) => { m.count = k[i]; m.instanceMatrix.needsUpdate = true; m.userData.shadowEmpty = k[i] === 0; });
  }
  update({ x: 0, y: 1.6, z: 16.5 });
  [trunkGeo, limbGeo, twigGeo].forEach((g) => g.dispose());
  return { wood: woodMesh, update, emitters, fallen, blobs: all.length };
}

/** Six small balls round a centre, merged, each with its own radial normals
 *  (`detail` 1 near); or, far, one ball the size of the whole clump. */
function clumpGeometry(detail, single = false) {
  if (single) {
    const g = new THREE.IcosahedronGeometry(0.78, detail);
    const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
    return g;
  }
  const r = rngKit(515);
  const parts = [];
  const offsets = [[0, 0.15, 0], [0.45, 0, 0.1], [-0.4, 0.05, 0.2], [0.1, -0.05, 0.45], [-0.05, 0.1, -0.45], [0.05, 0.45, 0]];
  for (const [x, y, z] of offsets) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
    const s = r.range(0.42, 0.55);
    parts.push({ geometry: g, matrix: trs(x, y, z, 0, 0, 0, s, s, s) });
  }
  return bake(parts);
}

/* ------------------------------------------------------------------ *
 * The layered crown (sakura pass).
 *
 * A cherry is read by its limbs as much as its blossom: a short thick
 * trunk that splits low into a few heavy limbs, each rising, then bending
 * out and down in three lengths, forking at the bends.  The blossom sits in
 * lobes on the limbs' ends and forks, the wood running into each lobe from
 * below, so looking up you see dark limbs against shaded blossom and from
 * the street a dome of big lobes with sky and limbs between them.
 *
 * Each lobe is a packed half-dome of cushions, toned by where a cushion
 * sits on its own lobe (lit on top, deep underneath) as well as by the
 * lobe's height in the tree, which gives every lobe a light and a shadow
 * side the way a painter blocks them in.  Returns the wood parts and the
 * numbers the caller needs.
 * ------------------------------------------------------------------ */
function growLobed(F, look, r, S, base, hero, blobs, cards) {
  const wood = [];
  /* The wood is round at arm's length: smooth-shaded tapered pieces with
   * enough sides for a lit and a shaded flank, each piece starting at the
   * radius the last one ended on, and a knot at every bend so a joint never
   * shows as a crease.  All of it is one merged mesh (a few thousand
   * triangles a tree) near the player; past NEAR it swaps for a coarse
   * copy (five sides, no knots, no fine twigs), as the blossom does. */
  const woodLo = [];
  const up = new THREE.Vector3(0, 1, 0);
  const piece = (a, b, r0, r1) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-3 || r0 <= 0) return;
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize());
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const sides = r0 > 0.12 ? 12 : r0 > 0.05 ? 9 : 5;
    const matrix = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(r0, len, r0));
    wood.push({ geometry: taperGeo(r1 / r0, sides), matrix });
    if (r0 > 0.03) woodLo.push({ geometry: taperGeo(r1 / r0, 5), matrix });
  };
  const knot = (p, rad) => {
    if (rad < 0.045) return;
    wood.push({ geometry: knotGeo(), matrix: new THREE.Matrix4().compose(p, new THREE.Quaternion(), new THREE.Vector3(rad, rad, rad)) });
  };
  const girth = F.girth * S;

  // the trunk: short and stout, a kink, a flared foot
  const trunkH = F.trunkH * Math.pow(S, 0.55) * r.range(0.9, 1.1);
  const lean = new THREE.Vector3(r.range(-1, 1), 0, r.range(-1, 1)).multiplyScalar(F.lean * S);
  const knee = base.clone().add(new THREE.Vector3(lean.x * 0.35, trunkH * 0.5, lean.z * 0.35));
  const top = base.clone().add(new THREE.Vector3(lean.x, trunkH, lean.z));
  piece(base, knee, girth, girth * 0.86);
  knot(knee, girth * 0.86);
  piece(knee, top, girth * 0.86, girth * 0.74);
  knot(top, girth * 0.78);
  piece(base.clone().add(new THREE.Vector3(0, -0.05, 0)), base.clone().add(new THREE.Vector3(lean.x * 0.1, 0.4 * S, lean.z * 0.1)), girth * 1.5, girth * 0.98);
  // a root or two breaking the ground
  for (let k = 0; k < 3; k++) {
    const a = r.range(0, Math.PI * 2);
    const foot = base.clone().add(new THREE.Vector3(Math.cos(a) * girth * 2.4, 0.02, Math.sin(a) * girth * 2.4));
    piece(base.clone().add(new THREE.Vector3(0, 0.35 * S, 0)), foot, girth * 0.55, girth * 0.22);
  }

  // limbs: three bends each, rising steeply, then out, then over; each
  // length kinked once so no limb is a straight spoke
  const sites = [];
  const [l0, l1] = hero ? F.heroLimbs : F.limbs;
  const limbs = r.int(l0, l1);
  const len = (hero ? F.heroLen : F.len) * S;
  const a0 = r.range(0, Math.PI * 2);
  const bent = (p, q, r0, r1) => {
    const m = p.clone().lerp(q, r.range(0.4, 0.6));
    const d = p.distanceTo(q) * 0.1;
    m.x += r.range(-d, d); m.y += r.range(0, d); m.z += r.range(-d, d);
    const rm = Math.sqrt(r0 * r1);
    piece(p, m, r0, rm);
    knot(m, rm);
    piece(m, q, rm, r1);
  };
  const toward = (p, az, tilt, l) => p.clone().add(new THREE.Vector3(Math.cos(az) * Math.sin(tilt) * l, Math.cos(tilt) * l, Math.sin(az) * Math.sin(tilt) * l));
  for (let i = 0; i < limbs; i++) {
    const a = a0 + (i / limbs) * Math.PI * 2 + r.range(-0.3, 0.3);
    // limbs leave the trunk at staggered heights round its top
    const from = knee.clone().lerp(top, r.range(0.7, 1));
    let tilt = r.range(...(hero ? F.heroTilt : F.tilt));
    let p = from, rad = girth * r.range(0.52, 0.64);
    const L = len * r.range(0.85, 1.15);
    let az = a;
    for (let seg = 0; seg < 3; seg++) {
      const l = L * [0.4, 0.33, 0.27][seg];
      const q = toward(p, az, tilt, l);
      // the last length thins to a point under its lobe, not a sawn stump
      const k = seg === 2 ? 0.42 : 0.7;
      bent(p, q, rad, rad * k);
      rad *= k;
      knot(q, rad);
      // a fork at each bend, reaching sideways and a little up, blossom on its end
      if (seg >= 1 || r.next() < 0.5) {
        const faz = az + r.sign() * r.range(0.55, 1.0);
        const ft = Math.max(0.3, tilt * r.range(0.6, 0.9));
        const e = toward(q, faz, ft, L * r.range(0.22, 0.32));
        bent(q, e, rad * 0.7, rad * 0.4);
        sites.push({ p: e, w: seg === 0 ? 0.75 : 0.85 });
        twigs(e, faz, rad * 0.35);
      }
      if (seg >= 1) sites.push({ p: q, w: seg === 2 ? 1.1 : 0.95 });
      p = q;
      tilt = Math.min(1.8, tilt + r.range(...(F.bend ?? [0.3, 0.45])));      // out, and over at the end
      az += r.range(-0.25, 0.25);
    }
    twigs(p, az, rad * 0.45);
  }
  // fine twigs past the blossom: the rim's silhouette
  function twigs(at, az, rad) {
    for (let t = 0; t < F.fineTwigs; t++) {
      const d = new THREE.Vector3(Math.cos(az + r.range(-0.8, 0.8)), r.range(-0.1, 0.7), Math.sin(az + r.range(-0.8, 0.8))).normalize();
      const r0 = Math.max(0.018 * S, rad);
      piece(at, at.clone().addScaledVector(d, S * r.range(0.8, 1.4) * F.fineLen), r0, r0 * 0.35);
    }
  }
  // lobes over the crown close the dome
  for (let k = hero ? 3 : 1; k > 0; k--) {
    const a = r.range(0, Math.PI * 2), d = k > 1 ? len * r.range(0.15, 0.3) : r.range(0, 0.3) * S;
    sites.push({ p: top.clone().add(new THREE.Vector3(Math.cos(a) * d, len * r.range(0.5, 0.6), Math.sin(a) * d)), w: 1.05 });
  }

  // the lobes
  let yMin = Infinity, yMax = -Infinity;
  for (const s of sites) { yMin = Math.min(yMin, s.p.y); yMax = Math.max(yMax, s.p.y); }
  const reach = sites.reduce((m, s) => Math.max(m, Math.hypot(s.p.x - top.x, s.p.z - top.z)), 0.1) + F.lobeR * S * 0.8;
  const [f0, f1] = F.flatten;
  for (const s of sites) {
    const R = F.lobeR * Math.pow(S, 0.75) * s.w * r.range(0.85, 1.15);
    // the wood runs into the lobe's lower part
    const c = s.p.clone().add(new THREE.Vector3(0, R * 0.3, 0));
    const lh = (s.p.y - yMin) / Math.max(0.5, yMax - yMin);
    const n = Math.round(F.perLobe * s.w * s.w * Math.min(1.4, Math.sqrt(S)) * r.range(0.85, 1.15));
    for (let i = 0; i < n; i++) {
      // a half-dome: mostly above and round the side, a few hanging below
      const u = i === 0 ? 1 : r.range(-0.5, 1);
      const h = Math.sqrt(1 - u * u), az = r.range(0, Math.PI * 2);
      const d = R * r.range(0.4, 0.95);
      const px = c.x + Math.cos(az) * h * d * 1.15, pz = c.z + Math.sin(az) * h * d * 1.15;
      const out = Math.hypot(px - top.x, pz - top.z) / reach;
      const py = c.y + u * d * 0.7 - Math.max(0, out - 0.75) * F.droop * S;
      const rad = F.cushion * Math.sqrt(S) * Math.sqrt(s.w) * r.range(0.8, 1.2);
      const score = u * 0.85 + (lh - 0.5) * 0.7 + r.range(-0.18, 0.18);
      const tone = score > 0.28 ? 0 : score < -0.12 ? 2 : 1;
      blobs[tone].push({
        m: trs(px, py, pz, r.range(-0.3, 0.3), r.range(0, 3), r.range(-0.3, 0.3), rad * F.wide, rad * r.range(f0, f1), rad * F.wide),
        x: base.x, z: base.z, px, py, pz,
      });
      // sprays: hanging from a lobe's underside and standing out at the rim
      if (look.card && ((u < -0.05 && r.next() < 0.7) || (out > F.rimFrom && h > 0.6 && r.next() < 0.5))) {
        const ox = Math.cos(az), oz = Math.sin(az);
        const cs = rad * r.range(1.5, 2.2);
        const hang = u < -0.05 ? rad * 0.6 : 0;
        cards[tone].push({
          m: trs(px + ox * rad * 0.7, py - hang + r.range(-0.2, 0.2) * rad, pz + oz * rad * 0.7, r.range(-0.3, 0.3), Math.atan2(ox, oz) + r.range(-0.7, 0.7), r.range(-0.4, 0.4), cs, cs, cs),
          x: base.x, z: base.z, px, py, pz,
        });
      }
    }
  }
  return { wood, woodLo, trunkH, top, reach, crownY: (yMin + yMax) / 2 };
}

/* Wood pieces for the layered crown: an open cylinder of unit base radius
 * and length, `ratio` wide at its top (quantised, so pieces share a few
 * geometries), and a smooth knot for the bends. */
const TAPER = new Map();
function taperGeo(ratio, sides) {
  const q = Math.min(1, Math.max(0.25, Math.round(ratio * 20) / 20));
  const key = q + '|' + sides;
  if (!TAPER.has(key)) TAPER.set(key, new THREE.CylinderGeometry(q, 1, 1, sides, 1, true));
  return TAPER.get(key);
}
let KNOT = null;
function knotGeo() {
  if (!KNOT) {
    KNOT = new THREE.SphereGeometry(1, 8, 5);
  }
  return KNOT;
}
