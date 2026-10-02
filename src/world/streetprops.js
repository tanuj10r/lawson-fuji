import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { cel, flat } from '../core/toon.js';
import { chainLinkTex } from '../core/textures.js';
import { box, cyl, bake, trs } from '../core/util.js';
import { hullOutline } from '../core/outline.js';
import { makeBicycle } from './props.js';

/* ------------------------------------------------------------------ *
 * Furniture for the residential blocks.
 *
 * Eleven props that a lane of houses needs and `props.js` does not have: the
 * built refuse enclosure, the parcel locker, the scooter on its stand, the
 * grow box, the child's bicycle, the airer, the ball crate, a parking bay's
 * wheel stops, the gas meter, the water meter lid and the chalk on the
 * paving.
 *
 * All of it is seen from two metres in a 3 m lane, which is what sets the
 * detail level: at that range a prop is read from its joints and its
 * silhouette, not from its surface.  And -- as everywhere else in this world
 * -- the story is told by what has been parked, planted, hung out or left
 * behind.  There is nobody in any of it, including the chalk.
 * ------------------------------------------------------------------ */

const M = {};
function mats() {
  if (M.concrete) return M;
  M.concrete = cel({ color: PAL.concrete, bands: 3, tint: 0x6f6790 });
  M.concreteMid = cel({ color: PAL.concreteMid, bands: 3, tint: 0x6a6288 });
  M.metal = cel({ color: PAL.metal, bands: 3, tint: 0x666090 });
  M.metalDark = cel({ color: PAL.metalDark, bands: 3, tint: 0x5c5680 });
  M.dark = cel({ color: PAL.black, bands: 2, tint: 0x4b4560 });
  M.shell = cel({ color: 0xc4c8ce, bands: 3, tint: 0x666090 });     // pressed steel
  M.shellTrim = cel({ color: 0x9aa0a8, bands: 3, tint: 0x5c5680 });
  M.wood = cel({ color: 0x9c7f5e, bands: 3, tint: 0x5c5680 });
  M.woodDark = cel({ color: 0x7d6348, bands: 3, tint: 0x5c5680 });
  M.soil = cel({ color: 0x74624e, bands: 3, tint: 0x615a80 });
  /* Canes and twine get `flat: false`.  At that thickness you only ever see
   * one facet, and a flat-shaded facet turned away from the sun is nearly
   * black -- which is how the first canal reeds came out as a bundle of dark
   * skewers. */
  M.bamboo = cel({ color: PAL.bamboo, bands: 3, flat: false, tint: 0x5b6f8c });
  M.twine = cel({ color: PAL.rope, bands: 3, flat: false, tint: 0x6f6790 });
  M.pale = flat({ color: 0xf6f2e8 });                               // printed panels
  return M;
}

/* ------------------------------ shared helpers ------------------------------ */

const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const _up = V3(0, 1, 0);
const _unit = new Map();
function unitCyl(seg) {
  if (!_unit.has(seg)) _unit.set(seg, new THREE.CylinderGeometry(1, 1, 1, seg, 1));
  return _unit.get(seg);
}

/**
 * A round member drawn *between two points*, pushed onto a bake list.
 *
 * The scooter, the airer and the grow box's canes are all assemblies of more
 * than three connected members, which is where `props.js` puts the line: both
 * copies of the bicycle placed their tubes by eye and neither of them joined
 * up.  Drawing every member between two named joints makes a shared end
 * shared by construction, so it cannot drift.
 */
function member(arr, a, b, r, seg = 6) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 1e-4) return;
  arr.push({
    geometry: unitCyl(seg),
    matrix: new THREE.Matrix4().compose(
      new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(_up, dir.normalize()),
      V3(r, len, r)
    ),
  });
}

/**
 * Bake each bucket of `parts` into one mesh per material.
 *
 * Every prop here is a couple of dozen small members and most of them get
 * placed a dozen times down a lane, so one mesh per material is the
 * difference between a row of clutter costing forty draw calls and costing
 * four.  `noCast` is for the thin overhanging pieces -- a 40 mm coping is
 * about two shadow-map texels at this cascade size, so its own shadow lands
 * as a row of sawtooth triangles along the wall face rather than as a line.
 */
function emit(g, parts, matFor, o = {}) {
  const noCast = o.noCast ?? [];
  for (const key of Object.keys(parts)) {
    if (!parts[key].length) continue;
    const mesh = new THREE.Mesh(bake(parts[key]), matFor[key]);
    mesh.castShadow = !noCast.includes(key);
    mesh.receiveShadow = true;
    g.add(mesh);
    if (key === o.outline) hullOutline(mesh, { thickness: o.thickness ?? 0.0032 });
  }
  return g;
}

/** A lattice panel with genuinely transparent gaps, sized to its own extent. */
function latticePanel(w, h, cell = 0.13, color = 0xc2c8d0) {
  const tex = chainLinkTex().clone();     // clone: the map is shared with the fences
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(w / cell, h / cell);
  tex.needsUpdate = true;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    flat({
      color, map: tex, transparent: true, opacity: 0.82,
      side: THREE.DoubleSide, depthWrite: false, cache: false,
    })
  );
  panel.userData.noOutline = true;
  panel.userData.noShadow = true;
  return panel;
}

/* =================================================================== *
 * ゴミ集積所 -- the built refuse enclosure.
 * =================================================================== */

/**
 * The block-built refuse point: three low walls, a sheet roof, a mesh gate
 * and the bins behind it.  1.90 x 1.10 m in plan and 1.35 m to the front edge
 * of the roof, which is the size that reads as *built* rather than as three
 * bins with a fence round them.
 *
 * Two things worth knowing before placing one:
 *
 *  - The gate is on **+z** and stands ajar, so its leaf swings 0.6 m out of
 *    the footprint on the hinge side.  A collider sized to the walls alone
 *    leaves the leaf inside the walkable lane, and the player's `RADIUS` is
 *    added to every side of it.
 *  - The collection plate goes flat on the **left-hand wall** (looking at the
 *    gate, so local -x), not on the front: the front is a mesh leaf that
 *    swings, and a rigid notice bolted to it swings away with it.  The caller
 *    turns the whole enclosure with `ry` to put the plate on the approach.
 *    The plate is 0.42 x 0.30, i.e. 7:5, so `o.plateMap` wants drawing to
 *    that -- a map at the wrong aspect renders as an unreadable smear, not as
 *    an error.
 */
export function makeGomiHouse(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  const W = o.w ?? 1.9;                  // plan, x
  const D = o.d ?? 1.1;                  // plan, z
  const H = o.h ?? 1.05;                 // block height above the slab
  const T = 0.12;                        // block thickness
  const SLAB = 0.09;
  const TOP = SLAB + H + 0.06;           // top of the coping
  const parts = { block: [], cap: [], sheet: [], metal: [], lid: [] };
  const push = (k, geo, mx) => parts[k].push({ geometry: geo, matrix: mx });

  /* ---------------------------- slab and three walls ---------------------------- */
  push('block', new THREE.BoxGeometry(W + 0.12, SLAB, D + 0.12), trs(0, SLAB / 2, 0));
  push('block', new THREE.BoxGeometry(W, H, T), trs(0, SLAB + H / 2, -(D / 2 - T / 2)));
  for (const sx of [-1, 1]) {
    push('block', new THREE.BoxGeometry(T, H, D), trs(sx * (W / 2 - T / 2), SLAB + H / 2, 0));
    push('cap', new THREE.BoxGeometry(T + 0.08, 0.06, D + 0.08), trs(sx * (W / 2 - T / 2), TOP - 0.03, 0));
  }
  push('cap', new THREE.BoxGeometry(W + 0.08, 0.06, T + 0.08), trs(0, TOP - 0.03, -(D / 2 - T / 2)));

  /* -------------------------------- the roof --------------------------------
   * One mono-pitch sheet falling to the back, so the high edge is the one you
   * stand in front of.  A box along z rotated by +t about X sends its +z end
   * *down*, so the fall to -z is a negative rotation -- the sign the
   * overbridge stringers got wrong in both directions. */
  const RAKE = -0.10;
  push('sheet', new THREE.BoxGeometry(W + 0.14, 0.05, D + 0.22), trs(0, TOP + 0.05, 0.02, RAKE, 0, 0));
  push('sheet', new THREE.BoxGeometry(W + 0.14, 0.05, 0.06), trs(0, TOP + 0.11, D / 2 + 0.11));  // front lip
  for (const sx of [-1, 1]) {                                                     // bearers
    push('metal', new THREE.BoxGeometry(0.05, 0.05, D + 0.1), trs(sx * (W / 2 - T), TOP + 0.01, 0.02, RAKE, 0, 0));
  }

  /* --------------------------------- the bins ---------------------------------
   * The same three colours the loose `makeBins` uses, so a house with an
   * enclosure and a house with a kerbside pile read as the same district. */
  [PAL.bin, 0x7fae6a, 0xd8c34a].forEach((c, i) => {
    const bx = -0.52 + i * 0.52;
    const b = box(0.44, 0.62, 0.4, cel({ color: c, bands: 3, tint: 0x6f6790 }), bx, SLAB + 0.31, -0.06);
    b.castShadow = b.receiveShadow = true;
    g.add(b);
    push('lid', new THREE.BoxGeometry(0.47, 0.05, 0.43), trs(bx, SLAB + 0.64, -0.06));
  });

  /* --------------------------------- the gate ---------------------------------
   * Hinged on the -x jamb and standing a little open.  Rotating a leaf that
   * runs out along +x by a *negative* ry swings its free end toward +z, i.e.
   * out of the enclosure; a positive one would fold it into the bins. */
  {
    const LW = W - 2 * T - 0.04;
    const LH = 0.92;
    const gate = new THREE.Group();
    gate.position.set(-(W / 2 - T), SLAB, D / 2 - 0.06);
    gate.rotation.y = o.gateOpen ?? -0.42;
    const gp = [];
    for (const t of [0.025, LW - 0.025]) {
      gp.push({ geometry: new THREE.BoxGeometry(0.05, LH, 0.05), matrix: trs(t, LH / 2, 0) });
    }
    for (const y of [0.025, LH / 2, LH - 0.025]) {
      gp.push({ geometry: new THREE.BoxGeometry(LW, 0.045, 0.045), matrix: trs(LW / 2, y, 0) });
    }
    const frame = new THREE.Mesh(bake(gp), m.metal);
    frame.castShadow = true;
    gate.add(frame);
    const panel = latticePanel(LW - 0.08, LH - 0.1, 0.11);
    panel.position.set(LW / 2, LH / 2, 0);
    gate.add(panel);
    g.add(gate);
    // the hinge knuckles it hangs on, and the keeper on the far jamb
    for (const y of [SLAB + 0.16, SLAB + LH - 0.16]) {
      push('metal', new THREE.CylinderGeometry(0.028, 0.028, 0.09, 6), trs(-(W / 2 - T), y, D / 2 - 0.06));
    }
    push('metal', new THREE.BoxGeometry(0.05, 0.1, 0.06), trs(W / 2 - T + 0.02, SLAB + 0.5, D / 2 - 0.05));
  }

  emit(g, parts, {
    block: m.concreteMid, cap: m.concrete, sheet: m.shellTrim,
    metal: m.metalDark, lid: m.dark,
  }, { outline: 'block', thickness: 0.0034, noCast: ['cap'] });

  /* The collection plate.  A box, not a plane: at 0.03 thick it inks along its
   * edge from a grazing angle, and it stands 0.015 clear of the wall face so
   * the two are not coplanar. */
  {
    const side = flat({ color: PAL.wallGray });
    const face = o.plateMap
      ? flat({ color: 0xffffff, map: o.plateMap, cache: false })
      : flat({ color: 0xf2efe4 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.42),
      [side, face, side, side, side, side]);
    plate.position.set(-(W / 2 + 0.005), SLAB + H * 0.6, 0.06);
    plate.castShadow = true;
    g.add(plate);
  }

  g.position.set(o.x, o.y ?? 0, o.z);
  g.rotation.y = o.ry ?? 0;
  // local height, the way `buildings.js` and `housing.js` report it: callers
  // add their own ground Y when they size the collider
  g.userData.top = TOP + 0.14;
  return g;
}

/* =================================================================== *
 * 宅配ロッカー -- the public parcel locker.
 * =================================================================== */

/* =================================================================== *
 * 原付 -- the 50 cc scooter.
 * =================================================================== */

/* =================================================================== *
 * 家庭菜園 -- the raised grow box.
 * =================================================================== */

/* =================================================================== *
 * A child's bicycle.
 * =================================================================== */

/**
 * The same bicycle everything else in the world parks, scaled down inside a
 * container -- the planet bake reads world matrices, so a scaled group bakes
 * correctly and there is no reason to carry a second frame that can drift out
 * of step with the first.  That drift is exactly what made both original
 * copies of `makeBicycle` wrong.
 *
 * Scaling alone is not enough to read, though: at 0.62 it is just a bicycle
 * further away.  The stabilisers are what say *child* at eight metres, so they
 * go on the container rather than inside the lean -- a bike on stabilisers
 * stands square, which is also why `lean` defaults to nothing.
 */
export function makeKidBike(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  const k = o.scale ?? 0.62;
  const scaled = new THREE.Group();
  scaled.scale.setScalar(k);
  g.add(scaled);

  // x/z passed explicitly: `makeBicycle` writes o.x straight into position, so
  // omitting them puts the frame at NaN and it vanishes without an error
  scaled.add(makeBicycle({
    x: 0, z: 0, color: o.color ?? 0xd8563c, lean: o.lean ?? 0,
  }));

  /* Stabilisers, in the bicycle's own units so they scale with it: an arm out of
   * the rear hub and a small solid wheel on the end of each.  Baked into one
   * mesh -- four parts on every child's bike in the district is not worth four
   * draw calls.
   *
   * Held well outboard and given a real radius.  At 0.10 in bicycle units they
   * came out 0.06 m across in the world, tucked against the back tyre, and read
   * as a dark speck rather than as a wheel -- the crow's mistake -- which left
   * the bike reading as an adult one seen from further away. */
  {
    const parts = [];
    for (const s of [-1, 1]) {
      member(parts, V3(-0.52, 0.31, s * 0.06), V3(-0.44, 0.15, s * 0.3), 0.018);
      parts.push({
        geometry: new THREE.CylinderGeometry(0.15, 0.15, 0.06, 10),
        matrix: trs(-0.44, 0.14, s * 0.335, Math.PI / 2),
      });
    }
    const mesh = new THREE.Mesh(bake(parts), m.dark);
    mesh.castShadow = true;
    scaled.add(mesh);
  }

  g.position.set(o.x, o.y ?? 0, o.z);
  g.rotation.y = o.ry ?? 0;
  return g;
}

/* =================================================================== *
 * 物干しスタンド -- the folding airer.
 * =================================================================== */

/* =================================================================== *
 * The ball crate.
 * =================================================================== */

/* =================================================================== *
 * 車止め -- a parking bay's wheel stops.
 * =================================================================== */

/**
 * `o.n` bays at `o.pitch` centres: two 0.6 m concrete wheel stops per bay at
 * `o.gauge` centres, and a bay-number plate on a 0.35 m stake behind them.
 *
 * The two stops of one bay sit end to end on the *cross-bay* axis with the
 * track width between their centres, so a 1.4 m gauge leaves 0.8 m of clear
 * paving down the middle of the bay -- which is what a parking bay actually
 * looks like from the road, and the thing that goes wrong if the pair is set
 * out along the direction of travel instead.
 *
 * Authored with the bays side by side along **x** and the car nosing in from
 * **+z**, so the stake plates face the approach.
 */
export function makeWheelStops(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  const n = o.n ?? 2;
  const pitch = o.pitch ?? 2.5;
  const gauge = o.gauge ?? 1.4;
  const LEN = 0.6;
  const parts = { concrete: [], chamfer: [], dark: [], metal: [] };
  const push = (k, geo, mx) => parts[k].push({ geometry: geo, matrix: mx });

  for (let i = 0; i < n; i++) {
    const bx = -((n - 1) * pitch) / 2 + i * pitch;
    for (const s of [-1, 1]) {
      const sx = bx + (s * gauge) / 2;
      /* 0.16 m to the top of the chamfer.  At 0.125 the pair read as a pencil
       * line on the paving from anywhere but directly alongside -- and a real
       * one is 150 mm, so the height was wrong as well as invisible. */
      push('concrete', new THREE.BoxGeometry(LEN, 0.12, 0.16), trs(sx, 0.06, 0));
      // the chamfered top, and the two anchor pins through it
      push('chamfer', new THREE.BoxGeometry(LEN - 0.04, 0.04, 0.11), trs(sx, 0.14, 0));
      for (const t of [-0.18, 0.18]) {
        push('dark', new THREE.CylinderGeometry(0.018, 0.018, 0.03, 6), trs(sx + t, 0.165, 0));
      }
    }
    // the stake, set back out of the way of the tyre
    push('metal', new THREE.BoxGeometry(0.045, 0.35, 0.045), trs(bx, 0.175, -0.26));
    const side = cel({ color: 0xe8e4da, bands: 3, tint: 0x6f6790 });
    const map = o.plateMaps && o.plateMaps[i];
    const face = map ? flat({ color: 0xffffff, map, cache: false }) : side;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.022),
      [side, side, side, side, face, side]);
    plate.position.set(bx, 0.36, -0.24);
    plate.castShadow = true;
    g.add(plate);
    push('metal', new THREE.BoxGeometry(0.18, 0.026, 0.026), trs(bx, 0.425, -0.24));   // the painted cap rail
  }

  emit(g, parts, {
    concrete: m.concreteMid, chamfer: m.concrete, dark: m.dark, metal: m.metalDark,
  }, { noCast: ['chamfer'] });

  g.position.set(o.x, o.y ?? 0, o.z);
  g.rotation.y = o.ry ?? 0;
  g.userData.top = 0.16;
  return g;
}

/* =================================================================== *
 * The gas meter cabinet.
 * =================================================================== */

/**
 * The grey box on the flank of every house: a 0.34 x 0.46 x 0.20 m cabinet on
 * two bracket arms, with the service pipe elbowed into its underside and run
 * down the wall to a stub at the ground.
 *
 * Placed exactly the way `makeAircon` is, and for the same reasons:
 *
 *  - the door and the dial are on local **+z**, so `ry` is `atan2(nx, nz)` of
 *    the wall's *outward* normal;
 *  - the **back has to touch the wall**, so the origin belongs at
 *    `wall + (0.10 + standoff)` along that normal, at ground level.  The
 *    brackets span exactly `standoff`, which is what makes it visibly carried;
 *    left a third of a metre off, a wall box is a box hanging in the air with
 *    its own shadow behind it.
 *
 * Verify one by firing a ray out of its back.  Never verify from behind the
 * wall coming forward -- inside a house that hits an interior face and reports
 * a metre of clearance that is not there.
 */
export function makeGasMeter(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  const W = 0.34, HH = 0.46, D = 0.2;
  const so = o.standoff ?? 0.06;
  const Y0 = o.y0 ?? 0.72;               // underside of the cabinet
  const WALL = -(D / 2 + so);            // the wall face, in local z
  const parts = { shell: [], door: [], metal: [], dark: [], pipe: [] };
  const push = (k, geo, mx) => parts[k].push({ geometry: geo, matrix: mx });

  const body = box(W, HH, D, m.shell, 0, Y0 + HH / 2, 0);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  hullOutline(body, { thickness: 0.003 });
  push('shell', new THREE.BoxGeometry(W + 0.03, 0.035, D + 0.03), trs(0, Y0 + HH + 0.015, 0));   // drip top

  /* the door, its handle and two louvre slots */
  push('door', new THREE.BoxGeometry(W - 0.04, HH - 0.06, 0.02), trs(0, Y0 + HH / 2, D / 2 + 0.01));
  push('metal', new THREE.BoxGeometry(0.05, 0.09, 0.03), trs(W / 2 - 0.05, Y0 + HH / 2, D / 2 + 0.03));
  for (const y of [Y0 + HH - 0.07, Y0 + HH - 0.11]) {
    push('dark', new THREE.BoxGeometry(W - 0.14, 0.014, 0.016), trs(0, y, D / 2 + 0.026));
  }
  /* The dial: rim, then face, then hand, each layer clear of the last.  Two
   * sheets at the same depth are a coin toss rather than a layer, and the door
   * panel this is set on already stands 20 mm out -- so the rim starts 35 mm
   * out and the hand ends at 58 mm. */
  push('metal', new THREE.CylinderGeometry(0.062, 0.062, 0.016, 14), trs(-0.06, Y0 + 0.28, D / 2 + 0.035, Math.PI / 2));
  g.add(cyl(0.052, 0.052, 0.014, 14, m.pale, -0.06, Y0 + 0.28, D / 2 + 0.048).rotateX(Math.PI / 2));
  push('dark', new THREE.BoxGeometry(0.048, 0.006, 0.006), trs(-0.048, Y0 + 0.29, D / 2 + 0.058));
  g.add(box(0.13, 0.06, 0.008, m.pale, 0.06, Y0 + 0.11, D / 2 + 0.026));

  /* ------------------------------- the brackets -------------------------------
   * An arm under the cabinet reaching back over the standoff, a leg up the
   * wall and the bolt pad -- the same three pieces `makeAircon` hangs on. */
  for (const s of [-1, 1]) {
    const bx = (s * (W - 0.1)) / 2;
    push('metal', new THREE.BoxGeometry(0.04, 0.035, D + so), trs(bx, Y0 - 0.018, -so / 2));
    push('metal', new THREE.BoxGeometry(0.04, 0.17, 0.03), trs(bx, Y0 + 0.07, WALL + 0.015));
    push('metal', new THREE.BoxGeometry(0.07, 0.07, 0.018), trs(bx, Y0 + 0.14, WALL + 0.009));
  }

  /* --------------------------------- the pipe ---------------------------------
   * Up the wall clear of the cabinet on the -x side, two elbows across and
   * into the underside, and a fatter capped stub where it comes out of the
   * ground.  It hugs the wall (z = WALL + 0.06) rather than running down the
   * middle of the cabinet's depth, which is where a riser actually is. */
  {
    const px = -(W / 2 + 0.05);
    const pz = WALL + 0.075;             // clear of the cabinet's back plane
    const ELB = Y0 - 0.06;
    member(parts.pipe, V3(px, 0.14, pz), V3(px, ELB, pz), 0.022, 8);
    member(parts.pipe, V3(px, ELB, pz), V3(-0.08, ELB, pz), 0.022, 8);
    member(parts.pipe, V3(-0.08, ELB, pz), V3(-0.08, Y0 + 0.02, pz), 0.022, 8);
    for (const p of [V3(px, ELB, pz), V3(-0.08, ELB, pz)]) {
      push('pipe', new THREE.SphereGeometry(0.026, 8, 6), trs(p.x, p.y, p.z));
    }
    push('pipe', new THREE.CylinderGeometry(0.032, 0.032, 0.14, 8), trs(px, 0.07, pz));
    push('metal', new THREE.BoxGeometry(0.11, 0.03, 0.11), trs(px, 0.015, pz));
    push('metal', new THREE.BoxGeometry(0.05, 0.028, 0.075), trs(px, 0.46, WALL + 0.038));  // wall clip
  }

  emit(g, parts, {
    shell: m.shellTrim, door: cel({ color: 0xd2d6da, bands: 3, tint: 0x666090 }),
    metal: m.metalDark, dark: m.dark, pipe: m.metal,
  });

  g.position.set(o.x, o.y ?? 0, o.z);
  g.rotation.y = o.ry ?? 0;
  g.userData.top = Y0 + HH + 0.03;
  return g;
}

/* =================================================================== *
 * 水道メーター -- the water meter lid.
 * =================================================================== */

/**
 * The lid in the paving outside every gate: a 0.32 x 0.24 m plate in a raised
 * rim, with a lift slot and a cast panel on it.
 *
 * It stands 20 mm proud in total so its edge inks and it reads as an object
 * rather than as a stain -- and it must not cast, because the shadow of
 * something 20 mm high is a fraction of a shadow-map texel at this cascade
 * size and lands as a row of sawtooth triangles rather than as a line.
 *
 * The rim is four bars, not a slab with the lid on top: a lid *on* its frame
 * is a paving block, and a box cannot have a recess cut into it.
 */
export function makeWaterMeter(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  const W = o.w ?? 0.32, D = o.d ?? 0.24;
  const RIM = 0.03;
  const parts = { rim: [], lid: [], panel: [] };
  const push = (k, geo, mx) => parts[k].push({ geometry: geo, matrix: mx });

  for (const sz of [-1, 1]) {
    push('rim', new THREE.BoxGeometry(W + RIM * 2, 0.026, RIM), trs(0, 0.008, sz * (D / 2 + RIM / 2)));
  }
  for (const sx of [-1, 1]) {
    push('rim', new THREE.BoxGeometry(RIM, 0.026, D), trs(sx * (W / 2 + RIM / 2), 0.008, 0));
  }
  // the lid itself, 2.5 mm shy of the rim on each side so there is a shadow gap
  push('lid', new THREE.BoxGeometry(W - 0.005, 0.022, D - 0.005), trs(0, 0.005, 0));
  for (const sz of [-1, 1]) {
    push('lid', new THREE.BoxGeometry(W - 0.08, 0.006, 0.022), trs(0, 0.018, sz * 0.05));   // cast ribs
  }
  push('lid', new THREE.BoxGeometry(0.06, 0.008, 0.024), trs(W / 2 - 0.05, 0.019, 0));      // lift slot lip
  push('panel', new THREE.BoxGeometry(0.11, 0.006, 0.042), trs(-0.05, 0.019, 0));

  const rimMesh = new THREE.Mesh(bake(parts.rim), m.concreteMid);
  const lidMesh = new THREE.Mesh(bake(parts.lid), cel({ color: 0x6f7480, bands: 3, tint: 0x5c5680 }));
  const panelMesh = new THREE.Mesh(bake(parts.panel), m.pale);
  for (const mesh of [rimMesh, lidMesh, panelMesh]) {
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  // the slot is the one dark thing on it, and it is what tells you it lifts
  g.add(box(0.05, 0.01, 0.016, m.dark, W / 2 - 0.085, 0.021, 0));

  g.position.set(o.x, o.y ?? 0, o.z);
  g.rotation.y = o.ry ?? 0;
  g.userData.top = 0.021;
  return g;
}

/* =================================================================== *
 * Chalk on the paving.
 * =================================================================== */

/* =================================================================== *
 * Dropped kerb (切り下げ, town quality pass)
 * =================================================================== */

/** A quad over the ground from x0 to x1 and z0 to z1, its height running
 * from y0 at x0 to y1 at x1 (a ramp's top, or its tactile strip). */
export function slopeQuad(x0, x1, z0, z1, y0, y1) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, z1, x1, y1, z1, x1, y1, z0, x0, y0, z0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

/**
 * Where a driveway or a zebra crosses a raised walk (axis-aligned): the walk
 * between x0 and x1 lowered to `drop`, a ramp `ramp` long each side down
 * from the kerb height `k`, and the kerb stone on the road side (`roadZ`:
 * z0 or z1) lowered with it.  Written for a walk running along x; `axis:
 * 'z'` reads every x as z and z as x (a walk running along z).  The caller
 * breaks its walk for [x0 - ramp, x1 + ramp].  `base`: the slabs' bottom.
 * `band`: lower only that much of the walk from the kerb (a zebra's
 * landing), sloping back up over `bandSlope`; the rest keeps its height,
 * so shop thresholds and the guide line stay level.  Without it the whole
 * width drops (a driveway).
 * @returns { meshes, platforms }: walkable tops in the caller's frame
 */
export function droppedKerb({
  x0, x1, z0, z1, roadZ, k = 0.15, drop = 0.04, ramp = 0.8, walkMat, kerbMat, axis = 'x', base = 0, tile = 1,
  rampLo = true, rampHi = true, band = null, bandSlope = 0.12,
}) {
  const meshes = [];
  const platforms = [];
  const swap = axis === 'z';
  const kerbSide = roadZ === z0 ? z0 : z1;
  /** 0..1: how far down the walk is across it (1 in the band, 0 past it) */
  const across = (z) => {
    if (band === null) return 1;
    const d = Math.abs(z - kerbSide);
    return d <= band + 1e-4 ? 1 : d >= band + bandSlope - 1e-4 ? 0 : 1 - (d - band) / bandSlope;
  };
  /** A slab from a to b along the walk, its top from h0 at a to h1 at b
   * (in the band; back up to `k` across the band's slope). */
  const span = (a, b, za, zb, h0, h1, mat, kTop = k) => {
    const g = new THREE.BoxGeometry(b - a, 1, zb - za);
    g.translate((a + b) / 2, 0.5, (za + zb) / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getX(i) - a) / (b - a);
      const low = h0 + (h1 - h0) * t;
      p.setY(i, p.getY(i) > 0.5 ? kTop - (kTop - low) * across(p.getZ(i)) : base);
      if (swap) { const x = p.getX(i); p.setX(i, p.getZ(i)); p.setZ(i, x); }
    }
    if (swap) {
      // a swap of axes is a mirror: turn every triangle back round
      const ix = g.index.array;
      for (let i = 0; i < ix.length; i += 3) { const q = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = q; }
    }
    g.computeVertexNormals();
    // world-mapped, like the walk it stands in (pavers keep their size)
    const n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, x / tile, -z / tile);
      else if (Math.abs(n.getX(i)) > Math.abs(n.getZ(i))) uv.setXY(i, z / tile, y / tile);
      else uv.setXY(i, x / tile, y / tile);
    }
    const m = new THREE.Mesh(g, mat);
    m.castShadow = false;
    m.receiveShadow = true;
    meshes.push(m);
  };
  // strips across the walk: the lowered band, its slope, the level rest
  const cuts = band === null ? [] : [band, band + bandSlope].map((d) => (kerbSide === z0 ? z0 + d : z1 - d)).filter((z) => z > z0 + 1e-3 && z < z1 - 1e-3);
  const zs = [z0, ...cuts.sort((a, b) => a - b), z1];
  const strips = zs.slice(1).map((z, i) => [zs[i], z]);
  // (a stretch that runs to the walk's end, at a corner, has no ramp there)
  for (const [za, zb] of strips) {
    if (rampLo) span(x0 - ramp, x0, za, zb, k, drop, walkMat);
    span(x0, x1, za, zb, drop, drop, walkMat);
    if (rampHi) span(x1, x1 + ramp, za, zb, drop, k, walkMat);
  }
  if (kerbMat) {
    // the kerb stone along the road edge, lowered with the walk (a bevelled
    // kerb: a finger's height of lip, no step for a tyre or a pram)
    const [ka, kb] = roadZ === z0 ? [z0 - 0.02, z0 + 0.14] : [z1 - 0.14, z1 + 0.02];
    if (rampLo) span(x0 - ramp, x0, ka, kb, k + 0.01, drop + 0.012, kerbMat, k + 0.01);
    span(x0, x1, ka, kb, drop + 0.012, drop + 0.012, kerbMat, k + 0.01);
    if (rampHi) span(x1, x1 + ramp, ka, kb, drop + 0.012, k + 0.01, kerbMat, k + 0.01);
  }
  // walkable: each strip's lowered stretch, and each ramp in two steps, at
  // the strip's mean height
  // (`ramp`: the slope as it is drawn, for what must rest on it to the centimetre: ctx.js surfaceAt, Hachi's paws)
  const plat = (a, b, za, zb, top, ramp = null) => platforms.push({ ...(swap ? { x0: za, x1: zb, z0: a, z1: b } : { x0: a, x1: b, z0: za, z1: zb }), top, ...(ramp ? { ramp: { axis: swap ? 'z' : 'x', ...ramp } } : null) });
  const mid = (k + drop) / 2;
  for (const [za, zb] of strips) {
    const f = across((za + zb) / 2);
    const at = (h) => k - (k - h) * f;
    plat(x0, x1, za, zb, at(drop));
    const lo = { a: x0 - ramp, b: x0, ya: k, yb: at(drop) }, hi = { a: x1, b: x1 + ramp, ya: at(drop), yb: k };
    if (rampLo) { plat(x0 - ramp, x0 - ramp / 2, za, zb, at((k + mid) / 2), lo); plat(x0 - ramp / 2, x0, za, zb, at((mid + drop) / 2), lo); }
    if (rampHi) { plat(x1, x1 + ramp / 2, za, zb, at((mid + drop) / 2), hi); plat(x1 + ramp / 2, x1 + ramp, za, zb, at((k + mid) / 2), hi); }
  }
  return { meshes, platforms };
}
