import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { rngKit, box, cyl, bake, trs } from '../../core/util.js';
import { makeGasMeter } from '../streetprops.js';
import { makeShop, makeMenuBoard, makeShopFlag, makeFreezer, makeProduceStack, makePaperLantern } from '../shops.js';
import {
  makeCrates, makeMilkCrate, makePlanter, makeBench, makeBicycle, makeBucket, makeFlowerBed, makeVendBin, makeAircon,
} from '../props.js';
import { addVending } from '../vending.js';
import { hangLaundry, sideWindows } from './houses.js';
import { ROADS } from '../../config.js';
import { shopBackTex, barberTex } from './tex.js';
import { noticeTex, forRentTex } from './paint.js';
import { SHOP_NOTICES, FOR_RENT } from '../../data/town.js';

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
    wood: cel({ color: 0xa88460, bands: 3, tint: 0x7a6a88, emissive: 0xfff0d8, emissiveIntensity: 0.35 }),
    counter: cel({ color: 0xd8cfc0, bands: 3, tint: 0x8a7a98, emissive: 0xfff0d8, emissiveIntensity: 0.45 }),
    shelf: cel({ color: 0xd8cfbe, bands: 3, tint: 0x8a7a98, emissive: 0xfff0d8, emissiveIntensity: 0.45 }),
    white: cel({ color: 0xeef0f4, bands: 3, tint: 0x8a7a98, emissive: 0xfff0d8, emissiveIntensity: 0.45 }),
    dark: cel({ color: 0x3c3a48, bands: 2, tint: 0x4b4560 }),
    chair: cel({ color: 0x7a4a4a, bands: 3, tint: 0x7a6a88, emissive: 0xfff0d8, emissiveIntensity: 0.3 }),
    light: flat({ color: 0xfff8e6 }),
  };
  return M;
}

/* ------------------------------------------------------------------ *
 * Inside the shop (M2e): furniture you read through the glass.  Goods are
 * baked per colour, so a shop's whole stock is a handful of draws.
 * ------------------------------------------------------------------ */
const GOODS = {
  general: [0xd8504a, 0xf2c23c, 0x4f8fd0, 0x6fb86a, 0xf2f2f2, 0xe8864a],
  bakery: [0xd8a060, 0xc07a3a, 0xf0d09a, 0xe8b878],
  florist: [0xf28cb0, 0xf2d24a, 0xe85a5a, 0x9fd07a, 0xc090e0],
  books: [0x4a6fa8, 0xc84a4a, 0xe8d8b0, 0x5a8a5a, 0x8a6aa0, 0xf2f2ea],
  hardware: [0xc84a4a, 0x5a6a7a, 0xf2c23c, 0x4a8ac8, 0x8a8a8a],
  greengrocer: [0x6fb86a, 0xe8453f, 0xf2a03c, 0xf2d24a, 0x8a5a9a],
  wagashi: [0xf4d8e0, 0x9fc07a, 0xf2f2ea, 0x8a5a4a],
};
const goodsMats = new Map();
/* A lit shop seen from the street is brighter and warmer than the shade
 * under its awning: its stock and fittings take a little warm light of
 * their own. */
const LIT = { emissive: 0xfff0d8, emissiveIntensity: 0.45 };
const goodsMat = (c) => goodsMats.get(c) ?? goodsMats.set(c, cel({ color: c, bands: 3, tint: 0x8a7a98, ...LIT })).get(c);

function furnish(inner, kind, trade, { openW, back, front, REC, r }) {
  const m = mats();
  const byMat = new Map();
  const put = (mat, w, h, d, x, y, z, ry = 0) => {
    (byMat.get(mat) ?? byMat.set(mat, []).get(mat)).push({ geometry: new THREE.BoxGeometry(w, h, d), matrix: trs(x, y, z, 0, ry, 0) });
  };
  const cols = GOODS[trade] ?? GOODS.general;
  /** A row of goods on a shelf from x0 to x1 at height y, depth z, dz deep. */
  const stock = (x0, x1, y, z, dz, maxH = 0.28) => {
    for (let x = x0; x < x1 - 0.06;) {
      const w = r.range(0.07, 0.2), h = r.range(0.1, maxH);
      put(goodsMat(r.pick(cols)), w, h, dz * r.range(0.6, 0.9), x + w / 2, y + h / 2, z);
      x += w + r.range(0.005, 0.03);
    }
  };
  /** Shelving: a unit from x0 to x1 at depth z, `levels` shelves, stocked. */
  const shelving = (x0, x1, z, dz, h, levels) => {
    put(m.shelf, x1 - x0, h, 0.04, (x0 + x1) / 2, h / 2, z - dz / 2);
    for (let k = 0; k < levels; k++) {
      const y = 0.12 + k * ((h - 0.2) / levels);
      put(m.shelf, x1 - x0, 0.03, dz, (x0 + x1) / 2, y, z);
      stock(x0 + 0.03, x1 - 0.03, y + 0.015, z, dz, Math.min(0.3, (h - 0.2) / levels - 0.06));
      // the price rail along the shelf edge
      put(goodsMat(0xf6f2e0), x1 - x0, 0.035, 0.01, (x0 + x1) / 2, y - 0.01, z + dz / 2 + 0.005);
    }
  };
  const mid = back + REC / 2;
  if (kind === 'shelves') {
    // shelving along the back wall, and islands running back from the window
    shelving(-openW / 2 + 0.1, openW / 2 - 0.1, back + 0.25, 0.4, 1.9, 5);
    const islands = openW > 4 ? 2 : 1;
    for (let i = 0; i < islands; i++) {
      const x = islands === 1 ? -openW * 0.15 : (i === 0 ? -1 : 1) * openW * 0.2;
      for (const s of [-1, 1]) {
        // an island's two faces, low enough to see over (1.35 m)
        const zc = mid + 0.1;
        put(m.shelf, 0.04, 1.35, 1.6, x + s * 0.02, 0.68, zc);
        for (let k = 0; k < 4; k++) {
          const y = 0.12 + k * 0.3;
          put(m.shelf, 0.36, 0.03, 1.6, x + s * 0.2, y, zc);
          for (let zz = zc - 0.75; zz < zc + 0.75;) {
            const w = r.range(0.08, 0.2), h = r.range(0.1, 0.24);
            put(goodsMat(r.pick(cols)), r.range(0.18, 0.28), h, w, x + s * 0.2, y + 0.015 + h / 2, zz + w / 2);
            zz += w + 0.02;
          }
        }
      }
    }
    // the counter and register by the door side
    const cx = openW / 2 - 0.7;
    put(m.counter, 1.1, 0.95, 0.55, cx, 0.48, front - 1.1);
    put(m.dark, 0.3, 0.12, 0.25, cx - 0.1, 1.02, front - 1.1);
    put(m.dark, 0.26, 0.2, 0.03, cx - 0.1, 1.16, front - 1.2);
    // general stores keep a drinks fridge on a side wall, lit from inside
    if (trade === 'general' || trade === 'greengrocer') {
      const fx = -openW / 2 + 0.35;
      put(m.white, 0.6, 1.9, 1.2, fx, 0.95, back + 1.0);
      put(m.light, 0.02, 1.6, 1.0, fx + 0.31, 1.0, back + 1.0);
      for (let k = 0; k < 4; k++) for (let b = 0; b < 6; b++) {
        put(goodsMat(r.pick([0x4f8fd0, 0xe8453f, 0xf2c23c, 0x6fb86a, 0xf2f2f2])), 0.06, 0.2, 0.06, fx + 0.22, 0.4 + k * 0.4, back + 0.6 + b * 0.16);
      }
    }
  } else if (kind === 'counter') {
    // a long counter with stools, the kitchen shelf behind it, a dark doorway through
    put(m.wood, openW * 0.8, 1.0, 0.45, 0, 0.5, mid + 0.4);
    put(m.wood, openW * 0.84, 0.05, 0.6, 0, 1.03, mid + 0.4);
    for (let k = 0; k < 5; k++) {
      const x = -openW * 0.32 + k * openW * 0.16;
      put(m.chair, 0.34, 0.06, 0.34, x, 0.72, mid + 0.95);
      put(m.dark, 0.05, 0.7, 0.05, x, 0.36, mid + 0.95);
    }
    put(m.shelf, openW * 0.7, 0.03, 0.3, 0, 1.55, back + 0.2);
    for (let x = -openW * 0.33; x < openW * 0.33; x += 0.22) put(goodsMat(r.pick([0xf2f2ea, 0xc84a4a, 0x3a3a48, 0xe8d8b0])), 0.16, 0.12, 0.16, x, 1.63, back + 0.2);
    put(m.dark, 0.9, 1.9, 0.03, openW / 2 - 0.7, 0.95, back + 0.02);
  } else if (kind === 'tables') {
    for (let k = 0; k < (openW > 4 ? 3 : 2); k++) {
      const x = -openW * 0.3 + k * openW * 0.3, z = mid + (k % 2 ? 0.4 : -0.1);
      put(m.wood, 0.7, 0.05, 0.7, x, 0.74, z);
      put(m.dark, 0.06, 0.72, 0.06, x, 0.36, z);
      for (const s of [-1, 1]) put(m.chair, 0.4, 0.05, 0.4, x + s * 0.55, 0.45, z);
    }
    put(m.counter, openW * 0.6, 1.0, 0.5, openW * 0.1, 0.5, back + 0.45);
    put(m.dark, 0.35, 0.45, 0.35, openW * 0.25, 1.23, back + 0.45);   // the coffee machine
  } else if (kind === 'machines') {
    const n = Math.max(2, Math.floor(openW / 0.75));
    for (let k = 0; k < n; k++) {
      const x = -openW / 2 + 0.4 + k * ((openW - 0.8) / (n - 1));
      put(m.white, 0.68, 0.9, 0.65, x, 0.45, back + 0.4);
      put(m.dark, 0.36, 0.36, 0.02, x, 0.5, back + 0.73);
      put(m.white, 0.68, 0.7, 0.65, x, 1.25, back + 0.4);
      put(m.dark, 0.3, 0.3, 0.02, x, 1.3, back + 0.73);
    }
    put(m.wood, openW * 0.5, 0.05, 0.6, 0, 0.8, mid + 0.6);
    put(m.chair, openW * 0.4, 0.4, 0.35, 0, 0.2, front - 0.8);
  } else if (kind === 'chairs') {
    for (let k = 0; k < 2; k++) {
      const x = -openW * 0.2 + k * openW * 0.4;
      put(m.chair, 0.6, 0.5, 0.6, x, 0.55, back + 0.8);
      put(m.chair, 0.6, 0.7, 0.12, x, 1.0, back + 0.55);
      put(goodsMat(0xc8dcec), 0.8, 1.0, 0.04, x, 1.5, back + 0.08);
      put(m.shelf, 0.8, 0.04, 0.25, x, 1.0, back + 0.15);
    }
    put(m.chair, openW * 0.4, 0.42, 0.4, 0, 0.21, front - 0.8);          // the waiting bench
  }
  // fluorescent strips across the ceiling
  for (let z = back + 0.5; z < front - 0.4; z += 1.1) put(m.light, openW * 0.55, 0.03, 0.18, 0, 2.43, z);
  for (const [mat, parts] of byMat) {
    const mesh = new THREE.Mesh(bake(parts), mat);
    mesh.receiveShadow = true;
    mesh.userData.noOutline = true;
    inner.add(mesh);
  }
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
  const REC = 3.4;               // deep enough to read as a room (M2e; was 1.9)
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
    // a room you can read through the glass (M2e): furniture by trade,
    // fluorescent strips on the ceiling, the painted back wall behind
    furnish(inner, T.inside, trade, { openW, back, front, REC, r });
    // at night the shop is lit from inside: a warm glow just behind the glass
    ctx.night?.glow(g, openW - 0.1, 2.3, 0, 1.35, front - 0.14);
  }

  /* ---- paper on the glass (M2e): notices taped up inside it, and on a
   * closed shop the agent's board on the shutter ---- */
  {
    const q = rngKit(lot.seed + 555);
    const paper = (tex, x, y, pw, ph, z) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), flat({ color: 0xf4f2ee, map: tex, cache: false }));
      p.position.set(x, y, z);
      p.rotation.z = q.range(-0.04, 0.04);
      p.userData.noOutline = true;
      g.add(p);
    };
    if (trade === 'closed') {
      paper(forRentTex(FOR_RENT), q.range(-0.5, 0.5), 1.45, 0.8, 0.6, front - 0.12);
    } else if (T.inside !== 'none' && q.chance(0.8)) {
      const n = q.chance(0.4) ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const k = q.int(0, SHOP_NOTICES.length - 1);
        const x = (i === 0 ? -1 : 1) * q.range(0.35, openW / 2 - 0.35);
        paper(noticeTex(SHOP_NOTICES[k], 'notice' + k), x, q.range(1.1, 1.5), 0.3, 0.41, front - 0.1);
      }
    }
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
