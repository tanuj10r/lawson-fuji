import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { rngKit, cyl } from '../../core/util.js';
import { makePole, makeWires } from '../props.js';
import { POLES, ROADS } from '../../config.js';
import { POLE_ADS, AREA } from '../../data/town.js';
import { plateTex } from './tex.js';
import { LAYER } from './decals.js';

/* ------------------------------------------------------------------ *
 * Poles and wires (SPEC section 3).
 *
 * A concrete pole every 20-30 m down one side of every street, with
 * crossarms, a transformer every few poles, street lamps, yellow-and-black
 * foot guards and strapped-on plates: clinic and estate-agent ads, the
 * block address, 消火栓.  Then one continuous web of cable: 5 power lines
 * and 2 telecom lines along each street, spans across every junction, and
 * service drops to buildings (`serviceDrop`, called by whoever builds them).
 * ------------------------------------------------------------------ */

const WY = ROADS.asphaltY + ROADS.kerbH;

let lampMats = null;
/** Street-lamp bulbs share one material, so the look can light them. */
export function lampMaterial() {
  if (!lampMats) {
    lampMats = flat({ color: 0xfff2d0, cache: false });
    lampMats.userData.live = true;
  }
  return lampMats;
}

function streetLamp(pole, H, side) {
  // an arm reaching over the road from the pole, in the pole's frame
  const g = new THREE.Group();
  const metal = cel({ color: 0xb8bcc6, bands: 3, tint: 0x666090 });
  const y = H - 3.6;
  const arm = cyl(0.04, 0.04, 1.5, 6, metal, 0, y, -side * 0.75);
  arm.rotation.x = Math.PI / 2;
  g.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.7), metal);
  head.position.set(0, y - 0.02, -side * 1.6);
  head.castShadow = true;
  g.add(head);
  // the diffuser hangs a little below the housing, so it reads from the side
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.6), lampMaterial());
  bulb.position.set(0, y - 0.12, -side * 1.6);
  g.add(bulb);
  pole.add(g);
}

export function buildPoles(ctx, net, decals) {
  const guard = plateTex('guard').face;
  const all = [];               // { g, e, s, side }
  const byEdge = new Map();
  let n = 0;

  for (const e of net.edges) {
    if (e.len < 12 || e.opts.poles === 0) continue;
    const r = rngKit(e.seed + 31);
    const side = e.opts.poles ?? (r.chance(0.5) ? -1 : 1);
    const onWalk = e.spec.walk > 0;
    // on a pavement the pole stands at the kerb, leaving the walk clear
    const off = side * (e.a + (onWalk ? 0.35 : 0.32));
    const y = onWalk ? WY : 0;
    // keep clear of zebras and bus stops
    const busy = [
      ...net.crossings.filter((c) => c.e === e).map((c) => [c.at - 3.5, c.at + 3.5]),
      ...net.busStops.filter((b) => b.e === e).map((b) => [b.at - 7.5, b.at + 7.5]),
    ];
    const clear = (s) => !busy.some(([a, b]) => s > a && s < b);

    const spots = [];
    const [sp0, sp1] = POLES.spacing;
    let s = e.a0 + r.range(1.5, 4);
    while (s < e.a1 - 1.5) {
      if (clear(s)) spots.push(s);
      else s += 4;
      s += r.range(sp0, sp1);
    }
    if (spots.length && e.a1 - spots[spots.length - 1] > sp0 * 0.7 && clear(e.a1 - 2)) spots.push(e.a1 - 2);

    const list = [];
    for (const s of spots) {
      const p = net.at(e, s, off);
      if (net.quiet(p.x, p.z)) continue;
      n++;
      const H = r.range(...POLES.height);
      const face = side > 0 ? Math.PI : 0;
      const plates = [];
      let warning = true;
      const hydrant = n % POLES.hydrantEvery === 1;
      if (hydrant) {
        plates.push({ map: plateTex('hydrant').face, y: 3.0, h: 0.95, arc: 1.5 });
        const q = net.at(e, s + 1.2, side * (e.a - 0.8 - (e.spec.gutter || 0)));
        decals.add('mhFire', q.x, q.z, 0.62, 0.62, net.along(e, 1), ROADS.asphaltY, LAYER.lid);
      } else if (r.chance(POLES.adChance)) {
        const ad = r.pick(POLE_ADS);
        plates.push({ map: plateTex('poleAd', ad).face, y: 3.05, h: 1.9, arc: 1.55 });
        warning = false;
      }
      // the block address, high on every other pole
      if (n % 2 === 0) {
        const chome = AREA.chome[(e.i + Math.floor(s / 60)) % AREA.chome.length];
        plates.push({ map: plateTex('address', { t: `${AREA.name}${chome}` }).face, y: 4.55, h: 0.85, arc: 1.2 });
      }
      const g = makePole({
        x: p.x, y, z: p.z, h: H, seed: e.seed + n,
        transformer: n % POLES.transformerEvery === 0,
        plateFace: face, warning, plates, guard, telecom: true, litPlates: true,
      });
      if (e.axis === 'z') g.rotation.y = Math.PI / 2;
      // rotated a quarter, the pole's local z is world x: `side` holds on both axes
      if (n % POLES.lampEvery === 0) streetLamp(g, H, side);
      g.name = 'pole';
      ctx.add(g);
      g.updateMatrixWorld(true);
      ctx.collide(p.x - 0.24, p.z - 0.24, p.x + 0.24, p.z + 0.24, y + H);
      ctx.registry?.push({ kind: 'pole', x: p.x, z: p.z });
      const rec = { g, e, s, side, x: p.x, z: p.z, H };
      list.push(rec);
      all.push(rec);
    }
    byEdge.set(e, list);
  }

  /* ---- the cable web ---- */
  const world = (rec, k) => rec.g.userData.anchors[k].clone().applyMatrix4(rec.g.matrixWorld);
  const POWER = [0, 1, 2, 3, 4], TEL = [5, 6];
  const runs = [];
  const tel = [];
  for (const list of byEdge.values()) {
    if (list.length < 2) continue;
    for (const k of POWER) runs.push({ points: list.map((p) => world(p, k)), sag: POLES.sag, r: POLES.wireR });
    for (const k of TEL) tel.push({ points: list.map((p) => world(p, k)), sag: POLES.sag * 1.5, r: POLES.wireR * 1.7 });
  }
  /* Across junctions: end poles of neighbouring streets join up.  Straight
   * on, every line carries through; round a corner, the top three and one
   * telecom line do. */
  for (const node of Object.values(net.nodes)) {
    const ends = [];
    for (const e of node.edges) {
      const list = byEdge.get(e);
      if (!list?.length) continue;
      ends.push({ e, p: e.hi === node ? list[list.length - 1] : list[0] });
    }
    for (let i = 0; i < ends.length; i++) {
      for (let j = i + 1; j < ends.length; j++) {
        const a = ends[i], b = ends[j];
        if (a.p.g.position.distanceTo(b.p.g.position) > 45) continue;
        const straight = a.e.axis === b.e.axis;
        const ks = straight ? POWER : [0, 1, 2];
        for (const k of ks) runs.push({ points: [world(a.p, k), world(b.p, k)], sag: POLES.sag, r: POLES.wireR });
        tel.push({ points: [world(a.p, 5), world(b.p, 5)], sag: POLES.sag * 1.5, r: POLES.wireR * 1.7 });
      }
    }
  }

  const drops = [];
  return {
    list: all,
    /** One more pole, off the street grid (a park light): lamp, plates,
     *  and three lines to the nearest pole. */
    standPole(x, z, y = 0) {
      const g = makePole({ x, y, z, h: 8.6, seed: 9000 + all.length, transformer: false, guard, telecom: true, litPlates: true, lamp: true });
      g.name = 'pole';
      ctx.add(g);
      g.updateMatrixWorld(true);
      ctx.collide(x - 0.24, z - 0.24, x + 0.24, z + 0.24, y + 8.6);
      ctx.registry?.push({ kind: 'pole', x, z });
      let best = null, bd = 45;
      for (const p of all) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < bd) { bd = d; best = p; }
      }
      const rec = { g, x, z, H: 8.6 };
      if (best) for (const k of [0, 1, 5]) runs.push({ points: [world(best, k), world(rec, k)], sag: POLES.sag, r: POLES.wireR });
      all.push(rec);
      return rec;
    },
    /** A service drop from the nearest pole to `point` (a Vector3 on a facade). */
    serviceDrop(point, reach = 32) {
      let best = null, bd = reach;
      for (const p of all) {
        const d = Math.hypot(p.x - point.x, p.z - point.z);
        if (d < bd) { bd = d; best = p; }
      }
      if (!best) return false;
      const from = best.g.userData.drop.clone().applyMatrix4(best.g.matrixWorld);
      drops.push({ points: [from, point.clone()], sag: 0.35, r: POLES.dropR });
      return true;
    },
    /** Build the wires (after every service drop has been asked for). */
    finish() {
      const lite = { seg: 8, radial: 3 };
      const a = makeWires(ctx, runs, lite);
      const b = makeWires(ctx, tel, lite);
      const c = makeWires(ctx, drops, { seg: 6, radial: 3 });
      return [a, b, c].filter(Boolean);
    },
  };
}
