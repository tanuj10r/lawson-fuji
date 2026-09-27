import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { rngKit, cyl } from '../../core/util.js';
import { makeGasMeter } from '../streetprops.js';
import { makeShop, AWNINGS, makeMenuBoard, makeShopFlag, makeFreezer, makeProduceStack, makePaperLantern } from '../shops.js';
import {
  makeCrates, makeMilkCrate, makePlanter, makeBench, makeBicycle, makeBucket, makeFlowerBed, makeVendBin, makeAircon,
} from '../props.js';
import { addVending } from '../vending.js';
import { hangLaundry, sideWindows } from './houses.js';
import { ROADS } from '../../config.js';
import { barberTex } from './tex.js';
import { fasciaTex, bladeTex, valanceTex, roomTex, counterTex } from './facade/signs.js';
import { flowerBox } from './facade/dress.js';
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
  M ??= {
    light: flat({ color: 0xfff8e6 }),
    side: flat({ color: 0xcfc6b8 }),
    // the painted room: a touch darker than the street, so the glass reads as glass
    back: flat({ color: 0xc4bccb, map: null }),
  };
  return M;
}
/** Board-clad upper storeys over a shop: the house generator's own tones. */
const UPPER_SIDING = [0xe9e4d6, 0xc9d8cc, 0xcad6e4, 0xe6d8c4];
/** Glazed facing tile: biscuit, brick brown, and the pale green of the 1970s. */
const UPPER_TILE = [0xd8c0a0, 0xb88a6a, 0xc8d4c0];

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
  // (town pass) a shallow room: two painted cards stand in for its furniture
  const REC = 1.7;
  const floors = o.maxFloors === 1 ? 1 : 2;
  const balcony = floors === 2 && r.chance(0.5);

  /* (town pass) the facade's finish, from its own draw so the layout never
   * shifts: signs in the trade's own hand, a shutter box, a canopy, boards
   * upstairs */
  const f = rngKit(lot.seed + 9191);
  const look = {
    fasciaMap: fasciaTex(trade, (w - 0.2) / 0.72),
    bladeMap: bladeTex(trade),
    valanceMap: T.awning !== undefined ? valanceTex(trade, AWNINGS[T.awning % AWNINGS.length], w / 0.3) : null,
    shutterBox: trade === 'closed' || f.chance(0.65),
    canopy: !T.noren && f.chance(0.7),
    upperSiding: f.chance(0.35) ? f.pick(UPPER_SIDING) : undefined,
    upperTile: f.chance(0.3) ? f.pick(UPPER_TILE) : undefined,
    interiorTint: 0xc4bccb,
    doorX: f.pick([0, 0, -1, 1]) * Math.max(0, w / 2 - 1.8),
  };
  if (trade === 'closed') look.shutter = 1;
  look.norenX = look.doorX;          // the curtain hangs in the doorway
  const g = makeShop(ctx, {
    x: c.x, y: 0, z: c.z, w, d, face: F.faceKey, kind: trade, floors, seed: lot.seed,
    roofKind: r.pick(['flat', 'gable', 'flat']), awning: T.awning ?? false,
    blade: T.blade ?? (r.chance(0.4) ? trade : false), bladeSide: r.sign(),
    noren: T.noren, shutter: T.shutter ?? (r.chance(0.1) ? 0.35 : 0), lit: true,
    balcony, recess: REC,
    interiorMap: T.inside === 'none' ? null : roomTex(trade, T.inside),
    wall: r.int(0, 5), roof: r.int(0, 3),
    ...look,
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
  // (town pass) the back: the kitchen below, the home above, seen where a block opens
  sideWindows(g, { hw: w / 2, hd: d / 2, floors, fh: 3.0, sideX: false, glass: ctx.night?.glass(f.chance(0.6)), seed: lot.seed + 7, sides: [-1] });

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
    /* a room you can read through the glass: the back wall is makeShop's
     * card (kit/facade/signs.js roomTex); a metre in front of it the cut-out
     * of the counter, shelf ends or chairs (counterTex), the side walls
     * pale as a lit room's, and the ceiling's fluorescent strips */
    const cw = openW - 0.2, ch = 1.3;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch),
      flat({ color: 0xd8d0dc, map: counterTex(trade, T.inside, cw / ch), alphaTest: 0.5, cache: false }));
    card.position.set(0, 0.12 + ch / 2, back + REC * 0.42);
    card.userData.noOutline = true;
    inner.add(card);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(REC - 0.1, 2.4), m.side);
      side.position.set(s * (openW / 2 - 0.01), 1.3, back + (REC - 0.1) / 2);
      side.rotation.y = -s * Math.PI / 2;
      side.userData.noOutline = true;
      inner.add(side);
    }
    for (const z of [back + 0.45, front - 0.55]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(openW * 0.55, 0.03, 0.16), m.light);
      strip.position.set(0, 2.43, z);
      strip.userData.noOutline = true;
      inner.add(strip);
    }
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
  /* (town quality pass) the bicycle stands along the shop front, at the end
   * away from the door (Tan: they stood across the walk, half in the shop),
   * and nothing else is put down where it stands.  The door's u: makeShop's
   * local x, turned by its face, against the frame's own along (a custom
   * frame, the station's cafe, runs u the other way). */
  const localX = { 'z+': [1, 0], 'z-': [-1, 0], 'x+': [0, -1], 'x-': [0, 1] }[F.faceKey];
  const f0 = F.at(0, 0), f1 = F.at(1, 0);
  const doorU = look.doorX * Math.sign(localX[0] * (f1.x - f0.x) + localX[1] * (f1.z - f0.z) || 1);
  const bikeAt = (i) => {
    const s = doorU !== 0 ? -Math.sign(doorU) : Math.sign(slots[i % slots.length]);
    return s * (w / 2 - 0.95);
  };
  const bikeI = T.outside.indexOf('bikes');
  const bikeU = bikeI >= 0 ? bikeAt(bikeI) : null;
  T.outside.forEach((item, i) => {
    const u = slots[i % slots.length] + r.range(-0.15, 0.15);
    const seed = lot.seed + i * 13;
    if (item !== 'bikes' && bikeU !== null && Math.abs(u - bikeU) < 1.3) return;
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
        // along the front, 0.35 m off it: the walk keeps its width
        const v = walk ? -0.38 : 0.45;
        const p = F.at(bikeU, v);
        const flip = bikeU > 0 ? 0 : Math.PI;   // the front wheel toward the shop's end
        const bike = makeBicycle({ x: p.x, y: yOut, z: p.z, ry: ry + flip + r.range(-0.2, 0.2) * 0.15, lean: 0.07, color: r.pick([0x3f6f9c, 0xd8a03c, 0xe8e2d4]) });
        bike.userData.detail = true;
        ctx.add(bike);
        const a = F.at(bikeU - 0.92, v - 0.3), b = F.at(bikeU + 0.92, v + 0.3);
        ctx.collide(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z), yOut + 1.0);
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
  if (balcony && r.chance(0.6)) hangLaundry(ctx, F.at(0, setback - 0.3), ry + Math.PI / 2, r, 4.95);

  /* (town pass) on a corner, the name again flat on the flank up high, for
   * the cross street (the blade's own art: no new texture) */
  if (lot.corner && floors === 2) {
    for (const s of [-1, 1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 2.26), flat({ color: 0xffffff, map: bladeTex(trade), cache: false }));
      pl.position.set(s * (w / 2 + 0.04), 3.2 + 1.35, front - 1.0);
      pl.rotation.y = s * Math.PI / 2;
      pl.userData.noOutline = true;
      g.add(pl);
      // the board's case, its face a clear 2 cm behind the sign (no z-fight)
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.36, 0.72), m.side);
      rim.position.set(s * (w / 2 + 0.005), 3.2 + 1.35, front - 1.0);
      g.add(rim);
    }
  }

  /* (town pass) upstairs, where there is no balcony: the room's air
   * conditioner hung on the wall by a window, a window box of flowers */
  if (floors === 2 && !balcony) {
    const H1 = 3.2, wallZ = front - 0.4;
    if (f.chance(0.6)) {
      const ac = makeAircon({ x: f.sign() * (w / 2 - 0.58), y: H1 + 0.62, z: wallZ + 0.24, feet: false, standoff: 0.09 });
      ac.userData.detail = true;
      g.add(ac);
    }
    if (f.chance(0.45)) {
      const cols = Math.max(1, Math.floor((w - 0.8) / 1.9));
      const i = f.int(0, cols - 1);
      const fb = flowerBox(1.3, lot.seed + 31);
      fb.position.set(-w / 2 + (w * (i + 1)) / (cols + 1), H1 + 0.77, front - 0.02);
      g.add(fb);
    }
  }

  return { group: g, trade };
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
