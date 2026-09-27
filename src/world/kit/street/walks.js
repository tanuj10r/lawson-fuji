import { rngKit } from '../../../core/util.js';
import { ROADS, TOWN, DRIVEWAYS } from '../../../config.js';
import { LAYER } from '../decals.js';
import { tactilePad } from '../roads.js';
import { aBoard, walkPlate } from './boards.js';

/* ------------------------------------------------------------------ *
 * The walks' clutter (town quality pass), by rule, after the lots:
 *
 *   kerb line    on a pavement, between the poles: bicycles parked along
 *                the kerb (thickest toward the station), a shop's A-frame
 *                board standing across the walk, a stack of crates
 *   lot gaps     the slot between two shops on a busy street: a bank of
 *                capsule-toy machines, or crates
 *   lanes        a bicycle at a shop's front, a cone pair at a corner
 *   the station  bollards and warning tiles where the spine's walks meet
 *                the plaza, 駐輪禁止 on the ground and on a plate (with the
 *                bicycles parked under it), the way to the station
 *   the crossing warning tiles on both lane edges before the deck
 *
 * Small things go in the kit's instanced clutter (street/clutter.js);
 * lettered ones are plain meshes the batcher packs.
 * ------------------------------------------------------------------ */

const WY = ROADS.asphaltY + ROADS.kerbH;
const FRAMES = [0x3f6f9c, 0xd8a03c, 0xe8e2d4, 0x9c5a4a, 0x4f8f6a, 0x8f6fb5, 0xc7c2d0, 0x2f2c3a, 0xe86a8a, 0x6ab0d8];
const CRATES = [0xe8483c, 0xf2c23c, 0x3a8ad0, 0x4fae6a, 0xe8e4dc];

export function dressWalks(ctx, net, kit, lots) {
  const C = kit.clutter;
  const reg = (x, z) => ctx.registry?.push({ kind: 'prop', x, z });
  const fixed = () => (ctx.registry ?? []).filter((q) => q.kind === 'pole' || q.kind === 'sign' || q.kind === 'bikes' || q.kind === 'tree');
  let taken = fixed();
  // never in a junction or a lane's mouth: that is where people walk through
  const inJunction = (x, z) => Object.values(net.nodes).some((n) => Math.abs(x - n.x) < n.tx + 1.0 && Math.abs(z - n.z) < n.tz + 1.0);
  const clearOf = (x, z, d) => !inJunction(x, z) && !taken.some((q) => Math.hypot(q.x - x, q.z - z) < d);
  const occupy = (x, z) => taken.push({ x, z });
  const plazaZ = TOWN.plaza.z0;

  /** Bicycles parked in a row from `s` along `e`, at `off`. */
  const bikesAt = (e, s, off, n, r, y) => {
    const f = net.along(e, 1);
    const ry = Math.atan2(f.z, -f.x) + (r.chance(0.5) ? Math.PI : 0);
    let placed = 0;
    for (let k = 0; k < n; k++) {
      const p = net.at(e, s + k * 0.95, off + r.range(-0.05, 0.05));
      if (net.quiet(p.x, p.z) || !clearOf(p.x, p.z, 1.3)) continue;
      C.put('bike', p.x, y, p.z, ry + r.range(-0.12, 0.12), { roll: r.range(0.05, 0.1) * (r.chance(0.5) ? 1 : -1), color: r.pick(FRAMES) });
      occupy(p.x, p.z);
      reg(p.x, p.z);
      placed++;
    }
    if (placed) {
      const a = net.at(e, s, off), b = net.at(e, s + (n - 1) * 0.95, off);
      ctx.collide(Math.min(a.x, b.x) - 0.3, Math.min(a.z, b.z) - 0.3, Math.max(a.x, b.x) + 0.3, Math.max(a.z, b.z) + 0.3, y + 1.0);
    }
    return placed;
  };
  const crates = (x, y, z, ry, n, r) => {
    for (let k = 0; k < n; k++) {
      const top = k >= 2;
      C.put('crate', x + (top ? 0 : (k - 0.5) * 0.48 * Math.cos(ry)), y + (top ? 0.28 * (k - 1) : 0),
        z - (top ? 0 : (k - 0.5) * 0.48 * Math.sin(ry)), ry + r.range(-0.08, 0.08), { color: r.pick(CRATES) });
    }
    ctx.collide(x - 0.5, z - 0.5, x + 0.5, z + 0.5, y + 0.3 * Math.max(1, n - 1));
    occupy(x, z); reg(x, z);
  };

  /* ---- kerb lines of the pavements ---- */
  for (const e of net.edges) {
    if (!(e.spec.walk > 0)) continue;
    // the Lawson's road only on the town's side, and well clear of the famous views
    const hero = e.opts.surface === false;
    const y = hero ? ROADS.kerbH : WY;
    const f = net.along(e, 1);
    for (const side of hero ? [1] : [-1, 1]) {
      const r = rngKit(e.seed * 13 + side * 5 + 901);
      const w0 = net.walkEnd(e, side, 'lo') + 2, w1 = net.walkEnd(e, side, 'hi') - 2;
      const kerb = side * (e.a + (hero ? 0.8 : 0.52));
      for (let s = w0 + r.range(0, 3); s < w1 - 1; s += r.range(2.8, 5.5)) {
        const p = net.at(e, s, kerb);
        if (net.quiet(p.x, p.z) || !clearOf(p.x, p.z, 1.4)) continue;
        if (hero && p.x > -62 && p.x < 40) continue;
        if (hero && DRIVEWAYS.north.some(([a, b]) => -p.x > a - DRIVEWAYS.ramp - 1 && -p.x < b + DRIVEWAYS.ramp + 1)) continue;   // a driveway's dropped kerb
        if (net.busStops.some((b) => b.e === e && b.side === side && Math.abs(s - b.at) < 9)) continue;
        if (net.crossings.some((c) => c.e === e && s > c.at - 4 && s < c.at + 3)) continue;   // keep a zebra's mouth clear
        // toward the station the kerb fills with bicycles
        const nearStation = e.axis === 'z' && s > plazaZ - 30;
        const roll = r.next();
        if (roll < (nearStation ? 0.75 : 0.4)) {
          const n = nearStation ? r.int(2, 4) : r.int(1, 2);
          const got = bikesAt(e, s, kerb, n, r, y);
          s += got * 0.95;
        } else if (roll < (nearStation ? 0.85 : 0.72)) {
          const b = aBoard(Math.floor(r.next() * 97));
          b.position.set(p.x, y, p.z);
          b.rotation.y = Math.atan2(f.x, f.z) + (r.chance(0.5) ? Math.PI : 0) + r.range(-0.2, 0.2);
          b.userData.detail = true;
          b.name = 'a-board';
          ctx.add(b);
          ctx.collide(p.x - 0.28, p.z - 0.28, p.x + 0.28, p.z + 0.28, y + 0.8);
          occupy(p.x, p.z); reg(p.x, p.z);
        } else if (roll < 0.9) {
          crates(p.x, y, p.z, Math.atan2(-f.z, f.x), r.int(2, 4), r);
        }
      }
    }
  }

  /* ---- the gaps between shops on busy streets ---- */
  const byKey = new Map();
  for (const l of lots) {
    if (l.e.opts.surface === false) continue;
    const k = `${l.e.i}:${l.side}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(l);
  }
  for (const list of byKey.values()) {
    list.sort((a, b) => a.s0 - b.s0);
    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i], b = list[i + 1];
      if (a.kind !== 'shop' && b.kind !== 'shop') continue;
      const gap = b.s0 - a.s1;
      const e = a.e, walk = e.spec.walk > 0;
      const r = rngKit(a.seed + 77);
      const s = (a.s1 + b.s0) / 2;
      const off = a.side * (walk ? e.t - 0.3 : e.a + 0.55);
      const p = net.at(e, s, off);
      if (net.quiet(p.x, p.z) || !clearOf(p.x, p.z, 1.0)) continue;
      const ry = Math.atan2(a.face.x, a.face.z);       // facing the street
      const y = walk ? WY : 0;
      if (walk && gap >= 0.8 && r.chance(0.6)) {
        // a capsule-toy bank at the gap's mouth, half in front of the next wall
        C.put('gashapon', p.x, y, p.z, ry);
        ctx.collide(p.x - 0.5, p.z - 0.5, p.x + 0.5, p.z + 0.5, y + 1.4);
        occupy(p.x, p.z); reg(p.x, p.z);
      } else if (r.chance(0.5)) {
        crates(p.x, y, p.z, ry, r.int(2, 4), r);
      } else if (!walk && r.chance(0.6)) {
        bikesAt(e, s - 0.4, a.side * (e.a + 0.5), 1, r, 0);
      }
    }
  }

  /* ---- where the spine meets the plaza ---- */
  const spine = net.edges.find((e) => e.cls === 'shopping' && Math.abs(e.s1 - plazaZ) < 0.5);
  if (spine) {
    const r = rngKit(4711);
    const fz = net.along(spine, 1);
    for (const side of [-1, 1]) {
      // bollards across the walk's mouth, warning tiles just short of them
      for (let k = 0; k < 3; k++) {
        const p = net.at(spine, plazaZ - 0.4, side * (spine.a + 0.45 + k * 0.8));
        C.put('bollard', p.x, WY, p.z, 0);
        ctx.collide(p.x - 0.08, p.z - 0.08, p.x + 0.08, p.z + 0.08, WY + 0.9);
      }
      const q = net.at(spine, plazaZ - 1.3, side * (spine.a + spine.spec.walk * 0.5));
      tactilePad(kit.decals, q.x, q.z, fz);
      // 駐輪禁止, painted and on a plate, and the bicycles under it anyway
      const paint = net.at(spine, plazaZ - 6, side * (spine.a + 1.2));
      kit.decals.add('noBikesPaint', paint.x, paint.z, 1.4, 1.2, net.along(spine, -1), WY, LAYER.symbol);
      const pl = net.at(spine, plazaZ - 9, side * (spine.a + 0.4));
      if (clearOf(pl.x, pl.z, 0.6)) {
        const g = walkPlate('noBikes');
        g.position.set(pl.x, WY, pl.z);
        g.rotation.y = Math.PI;             // read by walkers coming down the spine
        g.userData.detail = true;
        ctx.add(g);
        ctx.collide(pl.x - 0.1, pl.z - 0.1, pl.x + 0.1, pl.z + 0.1, WY + 1.6);
        occupy(pl.x, pl.z);
      }
      bikesAt(spine, plazaZ - 13.5, side * (spine.a + 0.52), 3, r, WY);
    }
    // the town's design lid in the plaza, where everyone crosses
    kit.decals.add('mhFuji', spine.c + 3.2, plazaZ + 4.5, 0.62, 0.62, { x: 0, z: -1 }, WY, LAYER.lid);
    kit.decals.add('gasLid', spine.c - 4.1, plazaZ + 2.2, 0.26, 0.26, { x: 0, z: -1 }, WY, LAYER.lid);
  }

  /* ---- the way to the station: a plate at each spine junction ---- */
  for (const e of net.edges) {
    if (e.cls !== 'shopping' || e.s1 >= plazaZ - 0.5) continue;
    const s = e.a1 - 1.2, off = e.a + 0.42;
    const p = net.at(e, s, off);
    if (net.quiet(p.x, p.z) || !clearOf(p.x, p.z, 0.8)) continue;
    const g = walkPlate('station');
    g.position.set(p.x, WY, p.z);
    g.rotation.y = -Math.PI / 2;        // face the walk, the arrow toward the plaza (+z)
    g.userData.detail = true;
    ctx.add(g);
    ctx.collide(p.x - 0.1, p.z - 0.1, p.x + 0.1, p.z + 0.1, WY + 2.3);
    occupy(p.x, p.z); reg(p.x, p.z);
  }

  /* ---- the level crossing: warning tiles on both lane edges ---- */
  const lane = net.edges.find((e) => e.axis === 'z' && e.c === TOWN.rail.crossX && e.s1 > TOWN.rail.z);
  if (lane) {
    const inner = lane.a - lane.spec.gutter - 0.55;
    const gap = TOWN.rail.spacing / 2 + 1.9 + 2.0;
    for (const dz of [-gap, gap]) {
      for (const side of [-1, 1]) {
        const x = lane.c + side * inner, z = TOWN.rail.z + dz;
        tactilePad(kit.decals, x, z, { x: 0, z: Math.sign(dz) }, 2, ROADS.asphaltY);
      }
    }
  }

  /* ---- lane corners: on the gutter lids just round the corner, a
   * bicycle left by a house (and a crate or two), or a pair of cones ---- */
  const r = rngKit(5151);
  for (const n of Object.values(net.nodes)) {
    if (n.degree < 3 || n.edges.some((e) => e.spec.walk > 0)) continue;
    for (let k = 0; k < 2; k++) {
      const roll = r.next();
      if (roll > 0.85) continue;
      const e = r.pick(n.edges);
      const away = e.lo === n ? 1 : -1;
      const side = r.chance(0.5) ? 1 : -1;
      const sn = e.axis === 'x' ? n.x : n.z;
      const s = sn + away * ((e.axis === 'x' ? n.ax : n.az) + 2.4);
      if (s < e.a0 + 1 || s > e.a1 - 1) continue;
      const off = side * (e.a - 0.3);
      const p = net.at(e, s, off);
      if (net.quiet(p.x, p.z) || !clearOf(p.x, p.z, 1.5)) continue;
      if (roll < 0.3) {
        const q = net.at(e, s + away * 0.6, off);
        C.put('cone', p.x, ROADS.asphaltY, p.z, r.range(0, 3));
        C.put('cone', q.x, ROADS.asphaltY, q.z, r.range(0, 3));
        ctx.collide(Math.min(p.x, q.x) - 0.2, Math.min(p.z, q.z) - 0.2, Math.max(p.x, q.x) + 0.2, Math.max(p.z, q.z) + 0.2, 0.7);
      } else {
        bikesAt(e, s, off, 1, r, ROADS.asphaltY);
        if (r.chance(0.5)) {
          const q = net.at(e, s + away * 1.5, side * (e.a - 0.26));
          crates(q.x, ROADS.asphaltY, q.z, e.axis === 'x' ? 0 : Math.PI / 2, r.int(1, 3), r);
        }
      }
      occupy(p.x, p.z); reg(p.x, p.z);
    }
  }
  taken = null;
}
