import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { rngKit, box, cyl } from '../../core/util.js';
import { makeGasMeter } from '../streetprops.js';
import { makeShop, makeMenuBoard, makeShopFlag, makeFreezer, makeProduceStack, makePaperLantern } from '../shops.js';
import {
  makeCrates, makeMilkCrate, makePlanter, makeBench, makeBicycle, makeBucket, makeFlowerBed, makeVendBin, makeAircon,
} from '../props.js';
import { addVending } from '../vending.js';
import { hangLaundry, sideWindows } from './houses.js';
import { ROADS } from '../../config.js';
import { shopBackTex, barberTex } from './tex.js';

/* ------------------------------------------------------------------ *
 * The shopfront generator (SPEC section 3, buildings).
 *
 * A shop below, a home above, on the library's shop unit (shops.js
 * makeShop).  One table row per trade: fascia and blade art (names in
 * data/town.js), awning or noren, what stands inside the deeper recess --
 * a counter, shelves, a lit ceiling panel, washing machines -- and what
 * stands outside on the pavement.
 * ------------------------------------------------------------------ */

export const TRADES = {
  ramen: { noren: 'ramen', blade: 'ramen', lanterns: true, inside: 'counter', outside: ['menu', 'bench', 'flag'] },
  cafe: { awning: 3, blade: 'cafe', inside: 'tables', outside: ['menu', 'planter', 'planter'] },
  bakery: { awning: 1, inside: 'shelves', outside: ['menu', 'flag', 'planter'] },
  florist: { awning: 0, inside: 'shelves', outside: ['flowers', 'flowers', 'bucket', 'bucket'] },
  wagashi: { noren: 'wagashi', inside: 'counter', outside: ['flag', 'flag', 'bench'] },
  general: { awning: 2, inside: 'shelves', outside: ['crates', 'vending', 'freezer', 'flag'] },
  barber: { inside: 'chairs', outside: ['barberPole', 'planter'] },
  laundry: { awning: 3, inside: 'machines', outside: ['bench', 'bikes'] },
  dentist: { inside: 'counter', outside: ['planter', 'planter'] },
  books: { awning: 0, inside: 'shelves', outside: ['crates', 'bikes'] },
  greengrocer: { awning: 4, inside: 'shelves', outside: ['produce', 'produce', 'crates'] },
  soba: { noren: 'soba', blade: 'soba', inside: 'counter', outside: ['menu', 'planter'] },
  hardware: { awning: 2, inside: 'shelves', outside: ['crates', 'bucket', 'bikes'] },
  closed: { shutter: 1, inside: 'none', outside: ['bikes', 'crates'] },
};
export const TRADE_KEYS = Object.keys(TRADES);

let M = null;
function mats() {
  if (M) return M;
  M = {
    wood: cel({ color: 0xa88460, bands: 3, tint: 0x5c5680 }),
    counter: cel({ color: 0xd8cfc0, bands: 3, tint: 0x6a6288 }),
    shelf: cel({ color: 0xc9bfae, bands: 3, tint: 0x6a6288 }),
    white: cel({ color: 0xeef0f4, bands: 3, tint: 0x6a6288 }),
    dark: cel({ color: 0x3c3a48, bands: 2, tint: 0x4b4560 }),
    chair: cel({ color: 0x7a4a4a, bands: 3, tint: 0x5c5680 }),
    light: flat({ color: 0xfff8e6 }),
  };
  return M;
}

/**
 * Build a shop-house on a lot.
 * @param trade   key into TRADES
 */
export function buildShop(ctx, net, kit, lot, F, trade, o = {}) {
  const r = rngKit(lot.seed + 17);
  const T = TRADES[trade];
  const reg = (kind, p) => ctx.registry?.push({ kind, x: p.x, z: p.z });
  const walk = lot.e.spec.walk > 0;
  const setback = walk ? 0.1 : 0.9;
  const w = Math.max(5.6, lot.w - r.range(0.2, 0.6));
  const d = Math.min(lot.depth - setback - 0.4, r.range(8.5, 11));
  const c = F.at(r.range(-0.2, 0.2), setback + d / 2);
  const REC = 1.9;
  const floors = o.maxFloors === 1 ? 1 : 2;
  const balcony = floors === 2 && r.chance(0.5);

  const g = makeShop(ctx, {
    x: c.x, y: 0, z: c.z, w, d, face: F.faceKey, kind: trade, floors, seed: lot.seed,
    roofKind: r.pick(['flat', 'gable', 'flat']), awning: T.awning ?? false,
    blade: T.blade ?? (r.chance(0.4) ? trade : false), bladeSide: r.sign(),
    noren: T.noren, shutter: T.shutter ?? (r.chance(0.1) ? 0.35 : 0), lit: true,
    balcony, recess: REC,
    interiorMap: shopBackTex(T.inside === 'shelves' ? tradeGoods(trade) : trade),
    wall: r.int(0, 5), roof: r.int(0, 3),
  });
  g.name = `shop-${trade}`;
  {
    const sw = F.faceKey[0] === 'z';
    const hx = (sw ? w : d) / 2, hz = (sw ? d : w) / 2;
    ctx.registry?.push({ kind: 'building', x: c.x, z: c.z, rect: [c.x - hx, c.z - hz, c.x + hx, c.z + hz] });
  }
  const dp = F.at(w * 0.3, setback + 0.05);
  kit.serviceDrop(new THREE.Vector3(dp.x, floors === 2 ? 5.4 : 3.0, dp.z));

  // windows down the flanks: the home upstairs, the back room below
  sideWindows(g, { hw: w / 2, hd: d / 2 - 0.6, floors, fh: 3.0, sideX: true, glass: ctx.night?.glass(r.chance(0.7)), seed: lot.seed });

  // the flank: the outdoor unit of the shop's air conditioning, and the gas meter
  {
    const s = r.chance(0.5) ? 1 : -1;
    const ac = makeAircon({ x: 0, y: 0, z: 0 });
    ac.position.set(s * (w / 2 + 0.35), 0, 0.5);
    ac.rotation.y = s * Math.PI / 2;
    ac.userData.detail = true;
    g.add(ac);
    const gm = makeGasMeter({ x: 0, y: 0, z: 0 });
    gm.position.set(s * (w / 2 + 0.02), 0, -1.2);
    gm.rotation.y = s * Math.PI / 2;
    g.add(gm);
    g.updateMatrixWorld(true);
    // in the town's own frame (it is built turned, M2e.3), not the world's
    ctx.root.updateWorldMatrix(true, false);
    const acAt = ctx.root.worldToLocal(ac.getWorldPosition(new THREE.Vector3()));
    ctx.registry?.push({ kind: 'prop', x: acAt.x, z: acAt.z });
  }

  /* ---- inside the recess, in the unit's own frame (front at d/2) ---- */
  const m = mats();
  const front = d / 2;
  const back = front - REC + 0.05;
  const inner = new THREE.Group();
  g.add(inner);
  const openW = w - 1.0;
  if (T.inside !== 'none' && !T.shutter) {
    // a lit panel under the soffit
    inner.add(box(openW * 0.6, 0.03, 0.4, m.light, 0, 2.43, back + REC * 0.45));
    if (T.inside === 'shelves') {
      for (const s of [-1, 1]) {
        const sh = box(0.45, 1.6, REC * 0.7, m.shelf, s * (openW / 2 - 0.35), 0.8, back + REC * 0.4);
        inner.add(sh);
        for (let k = 0; k < 3; k++) {
          inner.add(box(0.46, 0.2, REC * 0.66, cel({ color: r.pick([0xd8504a, 0xf2c23c, 0x4f8fd0, 0x6fb86a, 0xe8864a]), bands: 3 }),
            s * (openW / 2 - 0.35), 0.45 + k * 0.5, back + REC * 0.4));
        }
      }
      inner.add(box(openW * 0.35, 0.95, 0.5, m.counter, openW * 0.15, 0.48, back + 0.4));
    } else if (T.inside === 'counter') {
      inner.add(box(openW * 0.8, 1.0, 0.45, m.wood, 0, 0.5, back + 0.55));
      for (let k = 0; k < 4; k++) inner.add(cyl(0.16, 0.16, 0.08, 10, m.chair, -openW * 0.3 + k * openW * 0.2, 0.7, back + 1.05));
    } else if (T.inside === 'tables') {
      for (const s of [-1, 1]) {
        inner.add(box(0.7, 0.06, 0.7, m.wood, s * openW * 0.25, 0.74, back + REC * 0.55));
        inner.add(cyl(0.05, 0.05, 0.72, 6, m.dark, s * openW * 0.25, 0.37, back + REC * 0.55));
      }
    } else if (T.inside === 'machines') {
      const n = Math.max(2, Math.floor(openW / 0.75));
      for (let k = 0; k < n; k++) {
        const x = -openW / 2 + 0.4 + k * ((openW - 0.8) / (n - 1));
        inner.add(box(0.68, 0.9, 0.65, m.white, x, 0.45, back + 0.35));
        const door = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), m.dark);
        door.position.set(x, 0.5, back + 0.68);
        inner.add(door);
        inner.add(box(0.68, 0.7, 0.65, m.white, x, 1.25, back + 0.35));
      }
    } else if (T.inside === 'chairs') {
      for (let k = 0; k < 2; k++) {
        const x = -openW * 0.2 + k * openW * 0.4;
        inner.add(box(0.6, 0.5, 0.6, m.chair, x, 0.55, back + 0.6));
        inner.add(box(0.6, 0.7, 0.12, m.chair, x, 1.0, back + 0.35));
        inner.add(box(0.8, 1.0, 0.04, cel({ color: 0xc8dcec, bands: 2 }), x, 1.5, back + 0.08));
      }
    }
    inner.traverse((n) => { if (n.isMesh) n.userData.noOutline = true; });
    // at night the shop is lit from inside: a warm glow just behind the glass
    ctx.night?.glow(g, openW - 0.1, 2.3, 0, 1.35, front - 0.14);
  }

  /* ---- the shop's light on the pavement at night ---- */
  if (!T.shutter) {
    const lp = F.at(0, -0.6);
    ctx.night?.pool(lp.x, lp.z, Math.min(w * 0.55, 3.4), { y: walk ? 0.17 : 0, strength: 1.0 });
  }

  /* ---- the pavement outside ---- */
  // tight to the building on a pavement, so the walk stays clear
  const vOut = walk ? -0.35 : 0.45;
  const yOut = walk ? ROADS.asphaltY + ROADS.kerbH : 0;   // on the pavement, not in it
  const ry = F.ry;
  const put = (obj, u, col = 0.3, h = 1.0) => {
    const p = F.at(u, vOut);
    obj.position.set(p.x, yOut, p.z);
    obj.rotation.y = ry;
    obj.userData.detail = true;
    ctx.add(obj);
    reg('prop', p);
    const c = walk ? Math.min(col, 0.3) : col;
    if (c > 0) ctx.collide(p.x - c, p.z - c, p.x + c, p.z + c, h);
    return p;
  };
  const slots = [-w / 2 + 0.6, w / 2 - 0.6, -w / 2 + 1.6, w / 2 - 1.6, -w / 2 + 2.6];
  T.outside.forEach((item, i) => {
    const u = slots[i % slots.length] + r.range(-0.15, 0.15);
    const seed = lot.seed + i * 13;
    switch (item) {
      case 'menu': put(makeMenuBoard({ x: 0, y: 0, z: 0, ry }), u, 0.3, 1.0); break;
      case 'flag': put(makeShopFlag({ x: 0, y: 0, z: 0, ry, variant: seed % 4 }), u, 0.15, 1.9); break;
      case 'bench': put(makeBench({ x: 0, y: 0, z: 0, ry, len: 1.5, wood: true }), u, 0.7, 0.8); break;
      case 'planter': put(makePlanter({ x: 0, y: 0, z: 0, r: 0.28, flower: true, seed, n: 6 }), u, 0.3, 0.8); break;
      case 'flowers': put(makeFlowerBed({ x: 0, y: 0, z: 0, ry, w: 1.0, d: 0.5, n: 7, seed }), u, 0.5, 0.8); break;
      case 'bucket': put(makeBucket({ x: 0, y: 0, z: 0, ry, color: r.pick([0x5aa0c8, 0xd8504a, 0xf2c23c]), water: true }), u, 0.2, 0.5); break;
      case 'crates':
        put(r.chance(0.5) ? makeCrates({ x: 0, y: 0, z: 0, ry, n: r.int(2, 4), seed })
          : makeMilkCrate({ x: 0, y: 0, z: 0, ry, n: r.int(2, 3), color: r.pick([0xd8504a, 0xf2c23c, 0x3a8ad0]) }), u, 0.4, 0.9);
        break;
      case 'produce': put(makeProduceStack({ x: 0, y: 0, z: 0, ry, seed }), u, 0.5, 0.9); break;
      case 'freezer': put(makeFreezer({ x: 0, y: 0, z: 0, ry }), u, 0.6, 0.9); break;
      case 'vending': {
        const p = F.at(u, vOut - 0.1);
        addVending(ctx, { detail: true, x: p.x, y: yOut, z: p.z, ry, variant: seed % 3, seed });
        ctx.night?.pool(p.x, p.z, 1.8, { y: yOut, color: 0xe8f0ff, strength: 0.8 });
        const b = F.at(u + 0.9, vOut);
        ctx.add(makeVendBin({ x: b.x, y: yOut, z: b.z, ry }));
        reg('prop', p); reg('prop', b);
        break;
      }
      case 'bikes': {
        const p = F.at(u, vOut);
        const bike = makeBicycle({ x: p.x, y: yOut, z: p.z, ry: ry + Math.PI / 2 + r.range(-0.2, 0.2), lean: 0.07, color: r.pick([0x3f6f9c, 0xd8a03c, 0xe8e2d4]) });
        bike.userData.detail = true;
        ctx.add(bike);
        ctx.collide(p.x - 0.3, p.z - 0.3, p.x + 0.3, p.z + 0.3, 1.0);
        reg('prop', p);
        break;
      }
      case 'barberPole': {
        const p = F.at(-w / 2 + 0.45, 0.25 + (walk ? 0.1 : 0.9));
        ctx.add(barberPole(p.x, p.z));
        reg('prop', p);
        break;
      }
      default: break;
    }
  });
  // paper lanterns either side of the door for the noodle shops
  if (T.lanterns) {
    for (const s of [-1, 1]) {
      const p = F.at(s * (openW / 2 - 0.2), setback + 0.25);
      ctx.add(makePaperLantern({ x: p.x, z: p.z, y: 2.45, variant: 1 + (s > 0 ? 1 : 0), lit: true, drop: 0.1 }));
    }
  }
  // the family's washing out on the balcony, now and then
  if (balcony && r.chance(0.6)) hangLaundry(ctx, F.at(0, setback - 0.3), ry + Math.PI / 2, r, 4.55);

  return { group: g, trade };
}

/** Which goods a shelved shop's back wall shows. */
function tradeGoods(trade) {
  return { bakery: 'bakery', florist: 'florist', books: 'books', greengrocer: 'general', hardware: 'general' }[trade] ?? 'general';
}

/** The barber's pole: a striped drum in a glass case on the wall. */
function barberPole(x, z) {
  const g = new THREE.Group();
  const stripe = cel({ color: 0xffffff, map: barberTex(), bands: 2, tint: 0x6a6288, cache: false });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 16), stripe);
  drum.position.y = 1.9;
  drum.castShadow = true;
  g.add(drum);
  const capMat = cel({ color: 0xd8dce4, bands: 3, tint: 0x666090 });
  g.add(cyl(0.13, 0.13, 0.12, 16, capMat, 0, 2.36, 0));
  g.add(cyl(0.13, 0.13, 0.12, 16, capMat, 0, 1.44, 0));
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.8, 16, 1, true),
    flat({ color: 0xe8f2ff, transparent: true, opacity: 0.25, depthWrite: false, cache: false }));
  glass.position.y = 1.9;
  glass.userData.noOutline = true;
  g.add(glass);
  g.position.set(x, 0, z);
  return g;
}
