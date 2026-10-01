import * as THREE from 'three';
import { PAL } from '../../core/palette.js';
import { cel, flat } from '../../core/toon.js';
import { box, cyl, bake, trs } from '../../core/util.js';
import { hullOutline } from '../../core/outline.js';
import { crossingSign } from '../../core/textures.js';
import { ROADS, TOWN } from '../../config.js';
import { TRACK_Z, deckBoards, RAIL_HEAD_TOP } from './track.js';
import { RAIL_TOP } from '../railway.js';
import { LAYER } from '../kit/decals.js';

/* ------------------------------------------------------------------ *
 * The level crossing (踏切) on the lane, double track (SPEC section 3).
 *
 * Deck panels across both tracks at rail height with short ramps; on the
 * approach from each side, on the driver's left, a crossing signal (警報機:
 * crossbuck, twin red lamps, direction arrows, the bell housing, the
 * 踏切注意 plate) and a barrier machine whose yellow-and-black arm swings
 * down across the lane.  Stop lines on both approaches.
 *
 * The crossing only shows what it is told: `setArms`, `setLamps`,
 * `setArrows`.  line/service.js decides from where the train is.
 * ------------------------------------------------------------------ */

const DECK_TOP = RAIL_HEAD_TOP;      // flush with the rails' heads, which stand in grooves between the boards (track.js deckBoards)

export function buildCrossing(ctx, { x, kit }) {
  const g = new THREE.Group();
  g.name = 'level-crossing';
  ctx.add(g);
  const laneHalf = ROADS.lane.asphalt / 2;
  const halfW = laneHalf + 0.7;                 // deck reaches over the gutters
  const zN = TRACK_Z[0] - 1.9, zS = TRACK_Z[1] + 1.9;

  const yellow = cel({ color: PAL.gateYellow, bands: 3, tint: 0x8f7050 });
  const black = cel({ color: PAL.gateBlack, bands: 2, tint: 0x4b4560 });
  const white = cel({ color: 0xf2f0ec, bands: 3, tint: 0x6f6790 });
  const metal = cel({ color: PAL.metal, bands: 3, tint: 0x666090 });
  const deckMat = cel({ color: 0x6d6a78, bands: 3, tint: 0x55507a });

  /* ---- the deck: panels across both tracks, ramps at each end ---- */
  {
    // boards between and beside the rails, a groove at each rail: no board lies over a rail (nor over a sleeper:
    // there are none under the deck, track.js `decks`)
    const deck = new THREE.Mesh(bake(deckBoards({ x0: x - halfW, x1: x + halfW, z0: zN, z1: zS, top: DECK_TOP, thick: 0.13, panel: 1.3 })), deckMat);
    deck.receiveShadow = true;
    g.add(deck);
    ctx.platform({ x0: x - halfW, x1: x + halfW, z0: zN, z1: zS, top: DECK_TOP });
    // ramps: three shallow steps each side, so the lane rises onto the deck
    for (const [z, dir] of [[zN, -1], [zS, 1]]) {
      for (let k = 0; k < 3; k++) {
        const top = DECK_TOP - (k + 1) * (DECK_TOP / 4);
        const za = z + dir * k * 0.5, zb = z + dir * (k + 1) * 0.5;
        const r = box(halfW * 2, top, 0.52, deckMat, x, top / 2, (za + zb) / 2);
        r.receiveShadow = true;
        g.add(r);
        ctx.platform({ x0: x - halfW, x1: x + halfW, z0: Math.min(za, zb) - 0.02, z1: Math.max(za, zb) + 0.02, top });
      }
    }
    // keep the player on the deck: no walking off it along the tracks
    for (const s of [-1, 1]) ctx.collide(x + s * (halfW + 0.05) - 0.08, zN + 0.3, x + s * (halfW + 0.05) + 0.08, zS - 0.3, 1.2);
  }

  /* ---- the stop line and 止まれ before the tracks, on the one approach traffic comes by (the north: south of the
   * line the lane is only the forecourt of Hachi's gate, below).  The word sits between the lane's edge lines. ---- */
  if (kit) {
    const z = zN - 2.6;
    kit.decals.add('white', x, z, laneHalf * 2 - 0.8, 0.45, { x: 0, z: 1 }, ROADS.asphaltY, LAYER.paint);
    kit.decals.add('tomare', x, z - 3.0, 2.1, 2.6, { x: 0, z: 1 }, ROADS.asphaltY, LAYER.symbol);
  }

  /* ---- south of the line: the lane's end, a paved forecourt up to the garden gate (Tan: a 止まれ, a stop line, warning
   * tiles and the lane's green bands ran into Hachi's gate, left from when a house stood there).  Stone setts from the
   * ramp's foot to the fence, kerbed at the sides; it lies over the lane's own paint, which ends at its edge. ---- */
  {
    const z0 = zS + 1.52, z1 = TOWN.bounds.z1 - 2 - 0.11, hw = laneHalf + 0.02, top = 0.06;
    const setts = [cel({ color: 0xd9d2c4, bands: 3, tint: 0x6f6790 }), cel({ color: 0xcbc3b6, bands: 3, tint: 0x6f6790 }), cel({ color: 0xbfb8b0, bands: 3, tint: 0x6f6790 })];
    const lots = [[], [], []];
    // a bed (the joints' colour), the setts on it in a running bond, a soldier course down each side and across the gate
    g.add(box(hw * 2, top - 0.012, z1 - z0, cel({ color: 0x8f8a92, bands: 3, tint: 0x5e5a80 }), x, (top - 0.012) / 2, (z0 + z1) / 2));
    const border = 0.24, nz = Math.round((z1 - z0 - border) / 0.46), dz = (z1 - z0 - border) / nz, nx = Math.round((hw * 2 - border * 2) / 0.62), dx = (hw * 2 - border * 2) / nx;
    for (let j = 0; j < nz; j++) for (let i = -1; i <= nx; i++) {
      const off = j % 2 ? dx / 2 : 0;
      const a = Math.max(-hw + border, -hw + border + i * dx + off), b = Math.min(hw - border, -hw + border + (i + 1) * dx + off);
      if (b - a < 0.05) continue;
      lots[(i * 7 + j * 3 + 30) % 3].push({ geometry: new THREE.BoxGeometry(b - a - 0.025, 0.02, dz - 0.025), matrix: trs(x + (a + b) / 2, top - 0.01, z0 + (j + 0.5) * dz) });
    }
    for (const s of [-1, 1]) for (let zz = z0; zz < z1 - 0.01; zz += (z1 - z0) / 15) lots[2].push({ geometry: new THREE.BoxGeometry(border - 0.025, 0.02, (z1 - z0) / 15 - 0.025), matrix: trs(x + s * (hw - border / 2), top - 0.01, zz + (z1 - z0) / 30) });
    for (let i = 0; i < 18; i++) { const w = (hw * 2 - border * 2) / 18; lots[1].push({ geometry: new THREE.BoxGeometry(w - 0.025, 0.02, border - 0.025), matrix: trs(x - hw + border + (i + 0.5) * w, top - 0.01, z1 - border / 2) }); }
    lots.forEach((parts, k) => { if (!parts.length) return; const m = new THREE.Mesh(bake(parts), setts[k]); m.receiveShadow = true; m.userData.noOutline = true; g.add(m); });
    // kerbs down the sides, from the ramp to the fence
    const kerb = cel({ color: 0xd2d3da, bands: 3 });
    for (const s of [-1, 1]) { const k = box(0.16, 0.12, z1 - z0, kerb, x + s * (hw + 0.08), 0.06, (z0 + z1) / 2); k.receiveShadow = true; g.add(k); }
    ctx.platform({ x0: x - hw, x1: x + hw, z0, z1: z1 + 0.2, top });
  }

  /* ---- signals and barriers, one set per approach, on the driver's left ---- */
  const lamps = { a: [], b: [] };
  const arrows = { east: [], west: [] };
  const arms = [];
  const lampMat = () => { const mm = flat({ color: PAL.signalOff, cache: false }); mm.userData.live = true; return mm; };
  const sign = crossingSign();

  // approach from the north heads +z: the driver's left is +x.  From the south, -x.
  const approaches = [
    { z: zN - 0.9, face: -1, side: 1 },    // faces the traffic coming down from the north
    { z: zS + 0.9, face: 1, side: -1 },
  ];
  for (const ap of approaches) {
    const sx = x + ap.side * (halfW + 0.55);
    const ry = ap.face > 0 ? 0 : Math.PI;           // plates look along +z or -z
    const sig = new THREE.Group();
    sig.position.set(sx, 0, ap.z);
    // the pole: black-and-yellow at the foot
    const pole = cyl(0.07, 0.08, 3.9, 10, white, 0, 1.95, 0);
    pole.castShadow = true;
    sig.add(pole);
    for (let k = 0; k < 4; k++) sig.add(cyl(0.085, 0.085, 0.22, 10, k % 2 ? black : yellow, 0, 0.11 + k * 0.22, 0));
    hullOutline(pole, { thickness: 0.003 });
    // crossbuck
    const buck = new THREE.Group();
    buck.position.set(0, 3.55, 0);
    for (const r of [0.62, -0.62]) {
      const bar = new THREE.Group();
      bar.rotation.z = r;
      for (let k = -2; k <= 2; k++) bar.add(box(0.18, 0.12, 0.04, k % 2 ? black : yellow, k * 0.18, 0, 0));
      buck.add(bar);
    }
    buck.rotation.y = ry;
    sig.add(buck);
    // lamp heads: two red lamps each way along the lane (the pair alternates)
    for (const f of [1, -1]) {
      const arm = box(1.1, 0.07, 0.07, black, 0, 2.95, 0);
      sig.add(arm);
      for (const [lx, which] of [[-0.42, 'a'], [0.42, 'b']]) {
        const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.14, 14, 1, true, 0, Math.PI), black);
        hood.rotation.x = Math.PI / 2;
        hood.position.set(lx, 2.95, f * 0.12);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), black);
        disc.position.set(lx, 2.95, f * 0.07);
        disc.rotation.y = f > 0 ? 0 : Math.PI;
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), lampMat());
        lens.position.set(lx, 2.95, f * 0.08);
        lens.rotation.y = f > 0 ? 0 : Math.PI;
        lens.userData.keep = true;
        sig.add(hood, disc, lens);
        lamps[which].push(lens);
      }
    }
    // direction arrows box under the lamps
    const arrowBox = box(0.6, 0.26, 0.12, black, 0, 2.45, 0);
    sig.add(arrowBox);
    for (const [ax, dirKey] of [[-0.15, 'west'], [0.15, 'east']]) {
      for (const f of [1, -1]) {
        const tri = new THREE.Mesh(new THREE.CircleGeometry(0.09, 3), lampMat());
        tri.position.set(ax * f, 2.45, f * 0.065);
        tri.rotation.set(0, f > 0 ? 0 : Math.PI, dirKey === 'east' ? 0 : Math.PI);
        tri.userData.keep = true;
        sig.add(tri);
        arrows[dirKey].push(tri);
      }
    }
    // bell housing on top
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), black);
    bell.position.set(0, 3.95, 0);
    sig.add(bell);
    // the plate
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42), flat({ color: 0xffffff, map: sign, side: THREE.DoubleSide, cache: false }));
    plate.position.set(0, 1.75, ap.face * 0.09);
    plate.rotation.y = ry;
    sig.add(plate);
    sig.traverse((n) => { if (n.isMesh && !n.userData.keep) n.castShadow = true; });
    g.add(sig);
    ctx.collide(sx - 0.2, ap.z - 0.2, sx + 0.2, ap.z + 0.2, 4);
    ctx.registry?.push({ kind: 'sign', x: sx, z: ap.z });

    // the barrier machine beside it, arm reaching across the lane
    const bx = x + ap.side * (halfW + 0.2), bz = ap.z + ap.face * 0.6;
    const machine = new THREE.Group();
    machine.position.set(bx, 0, bz);
    machine.add(box(0.36, 1.0, 0.36, yellow, 0, 0.5, 0));
    machine.add(box(0.4, 0.1, 0.4, black, 0, 1.02, 0));
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.85, 0);
    pivot.userData.dynamic = true;       // it swings
    machine.add(pivot);
    const armLen = halfW * 2 - 0.3;
    const segs = Math.round(armLen / 0.5);
    for (let k = 0; k < segs; k++) {
      const seg = box(0.5, 0.09, 0.06, k % 2 ? black : yellow, -ap.side * (0.25 + k * 0.5), 0, 0);
      seg.castShadow = true;
      pivot.add(seg);
    }
    // weight on the short end
    pivot.add(box(0.3, 0.2, 0.14, black, ap.side * 0.25, 0, 0));
    machine.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    g.add(machine);
    ctx.collide(bx - 0.25, bz - 0.25, bx + 0.25, bz + 0.25, 1.1);
    arms.push({ pivot, side: ap.side });
    // the lowered arm blocks the lane (its top is raised to 1.2 m while down)
    // (in world coordinates: the colliders are the player's, whatever frame this is built in)
    const c0 = ctx.toWorld({ x: x - halfW, z: bz - 0.12 }), c1 = ctx.toWorld({ x: x + halfW, z: bz + 0.12 });
    const block = { x0: Math.min(c0.x, c1.x), x1: Math.max(c0.x, c1.x), z0: Math.min(c0.z, c1.z), z1: Math.max(c0.z, c1.z), top: -1 };
    ctx.colliders.push(block);
    arms[arms.length - 1].block = block;
  }

  const ON = new THREE.Color(PAL.signalRed), OFF = new THREE.Color(PAL.signalOff);
  const ARROW_ON = new THREE.Color(0xffb14a);
  const api = {
    group: g, x, armT: 0,
    /** 0 raised, 1 down across the lane */
    setArms(t) {
      this.armT = t;
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      for (const a of arms) {
        // raised: arm points up; down: level across the lane
        a.pivot.rotation.z = -a.side * (1 - e) * (Math.PI / 2) * 0.98;
        a.block.top = t > 0.6 ? 1.2 : -1;
      }
    },
    /** the two lamps alternate: phase 0..1 */
    setLamps(on, phase) {
      const aOn = on && phase < 0.5, bOn = on && phase >= 0.5;
      for (const l of lamps.a) l.material.color.copy(aOn ? ON : OFF);
      for (const l of lamps.b) l.material.color.copy(bOn ? ON : OFF);
    },
    /** which way the coming train is heading */
    setArrows({ east = false, west = false } = {}) {
      for (const t of arrows.east) t.material.color.copy(east ? ARROW_ON : OFF);
      for (const t of arrows.west) t.material.color.copy(west ? ARROW_ON : OFF);
    },
  };
  api.setArms(0);
  api.setLamps(false, 0);
  api.setArrows({});
  return api;
}
