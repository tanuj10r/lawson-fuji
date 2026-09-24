import * as THREE from 'three';
import { cel, flat } from '../core/toon.js';
import { box } from '../core/util.js';
import { buildRailway } from './railway.js';
import { buildTrain } from './train.js';
import { ROAD_HALF, GATE_Z } from './street.js';
import { TOWN } from '../config.js';
import { noEntryPlate } from './town-tex.js';
import { buildGrove } from './trees.js';
import { mergeStatic } from './merge.js';

/* ------------------------------------------------------------------ *
 * The railway (SPEC section 3): Sakura Crossing's line, crossing and
 * platform, placed as one part with its level crossing on our side road,
 * straight across town ~60 m behind the hero spot, into a tree-lined
 * cutting at each end.  A green-and-cream two-car local every 3 minutes;
 * bells, lamps and barriers come first, driven by where the train is.
 * ------------------------------------------------------------------ */

export function buildRail(ctx) {
  const R = TOWN.rail;
  const rctx = ctx.offset(R.crossX, R.z, 'railway-part');

  const crossing = buildRailway(rctx);
  const train = buildTrain(rctx, {
    cars: 2,
    interval: R.interval,
    livery: { body: 0x3f8f5e, band: 0xf2ead2, stripe: 0xf2ead2, door: 0x3f8f5e },
  });
  // what moves stays out of the town's batching; the train batches inside itself
  for (const a of crossing.arms) a.pivot.userData.dynamic = true;
  for (const w of train.wheels) w.userData.dynamic = true;
  mergeStatic(train.group);
  for (const w of train.wheels) w.userData.dynamic = false;
  train.group.userData.dynamic = true;

  // the deck across the side road is walkable (top of the concrete panels)
  ctx.platform({ x0: R.crossX - 5.2, x1: R.crossX + 5.2, z0: R.z - 2.4, z1: R.z + 2.4, top: 0.32 });

  /* Keep the player off the track itself: the lineside fences close the
   * sides; these close the ends of the crossing deck along the rails. */
  for (const sx of [-1, 1]) {
    ctx.collide(R.crossX + sx * 5.2 - 0.1, R.z - 2.2, R.crossX + sx * 5.2 + 0.1, R.z + 2.2, 1.2);
  }

  /* ---------------------- the cutting at each end ---------------------- *
   * Earth banks either side of the line from the town edge outward, planted
   * along the crest; the train comes out of the trees.  The banks and a
   * fence across the right-of-way are the town edge here. */
  {
    const bank = cel({ color: 0x86ab84, bands: 3, tint: 0x5b6f8c });
    const spots = [];
    for (const [x0, x1] of [[-420, TOWN.bounds.x0 + 12], [TOWN.bounds.x1 - 12, 460]]) {
      for (const s of [-1, 1]) {
        // profile drawn in (-z, y): the quarter turn below maps -u onto +z
        const shape = new THREE.Shape();
        const u = (v) => -s * v;
        shape.moveTo(u(5.4), 0);
        shape.lineTo(u(24), 0);
        shape.lineTo(u(20), 5.2);
        shape.lineTo(u(12), 5.2);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false });
        geo.rotateY(Math.PI / 2);
        const m = new THREE.Mesh(geo, bank);
        m.position.set(x0, 0, R.z);
        m.receiveShadow = true;
        m.castShadow = true;
        m.userData.noOutline = true;
        ctx.add(m);
        // inside the town the bank is solid
        const inside = x0 < 0 ? [TOWN.bounds.x0 - 1, x1] : [x0, TOWN.bounds.x1 + 1];
        ctx.collide(inside[0], R.z + s * 6.5, inside[1], R.z + s * 24, 5.2);
        for (let x = x0 + 4; x < x1; x += 11) {
          spots.push({ x, z: R.z + s * (15 + ((x * 7) % 5)), y: 5.2, scale: 1.1 + ((x * 13) % 7) / 14, seed: 900 + spots.length });
        }
      }
    }
    // one grove per bank, so each can be culled on its own
    for (const west of [true, false]) {
      for (const s of [-1, 1]) {
        const bank = spots.filter((p) => Math.abs(p.x) < 220 && (p.x < 0) === west && Math.sign(p.z - R.z) === s);
        buildGrove(ctx, bank, { far: true });
      }
    }

    // fences across the right-of-way where it leaves town, with the plate
    const post = cel({ color: 0xb8bcc6, bands: 3, tint: 0x666090 });
    for (const ex of [TOWN.bounds.x0 + 2, TOWN.bounds.x1 - 2]) {
      for (const s of [-1, 1]) {
        ctx.add(box(0.12, 1.3, 7.5, post, ex, 0.65, R.z + s * 7.2));
        ctx.collide(ex - 0.2, R.z + s * 3.2, ex + 0.2, R.z + s * 11, 1.3);
      }
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.0),
        flat({ map: noEntryPlate(), side: THREE.DoubleSide, cache: false }));
      plate.position.set(ex, 1.4, R.z - 3.6);
      plate.rotation.y = Math.PI / 2;
      ctx.add(plate);
      // the gap between the banks is the right-of-way: no walking down it
      ctx.collide(ex - 0.2, R.z - 3.4, ex + 0.2, R.z + 3.4, 2.0);
    }
  }

  /* ------------------------------ sequence ------------------------------ *
   * Sakura Crossing's: the gates follow the train's distance, not a clock. */
  const APPROACH = 165;
  const CLEAR = 62;
  const seq = { blink: 0, armT: 0 };
  crossing.request = () => { train.x = -(APPROACH - 12) * train.dir; };
  const boomBlocks = [1, -1].map((sz) => {
    const c = {
      x0: R.crossX - ROAD_HALF - 0.6, x1: R.crossX + ROAD_HALF + 0.6,
      z0: R.z + sz * GATE_Z - 0.16, z1: R.z + sz * GATE_Z + 0.16, top: -1,
    };
    ctx.colliders.push(c);
    return c;
  });

  ctx.update((dt) => {
    train.update(dt);
    seq.blink = (seq.blink + dt * 1.6) % 1;
    const ahead = -train.offset * train.dir;
    const closing = train.group.visible && ahead < APPROACH && ahead > -CLEAR;
    const rate = dt / (closing ? 3.4 : 3.0);
    seq.armT = Math.max(0, Math.min(1, seq.armT + (closing ? rate : -rate)));
    crossing.setArms(seq.armT);
    crossing.setLamps(closing || seq.armT > 0.02, seq.blink);
    const down = seq.armT > 0.55 ? 1.25 : -1;
    boomBlocks[0].top = down;
    boomBlocks[1].top = down;
  });

  return { train, crossing, seq };
}
