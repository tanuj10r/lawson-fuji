import { rngKit } from '../../core/util.js';
import { makeGomiHouse } from '../streetprops.js';
import {
  makePlanter, makeBench, makePostBox, makeCat, makeVendBin, makeCrates,
} from '../props.js';
import { addVending } from '../vending.js';
import { buildShrubs } from '../trees.js';
import { ROADS, TOWN } from '../../config.js';
import { dressWalks, walkRoom, WALK_CLEAR } from './street/walks.js';

/* ------------------------------------------------------------------ *
 * Street dressing (SPEC section 3, density budget).
 *
 * After the lots are built, walk each side of every street and fill what
 * the buildings left: any gap between lots wider than 3 m gets something
 * -- a sakura, a rubbish station, a vending pair, planters, a bench, a
 * parked bicycle -- chosen by the width of the gap and the kind of street.
 * Then the corners (vending at the busy ones, post boxes), bicycles along
 * the pavements, the hedges the houses asked for, and a few cats.
 * ------------------------------------------------------------------ */

const WY = ROADS.asphaltY + ROADS.kerbH;

export function dressStreets(ctx, net, kit, lots, specials = []) {
  // a special lot dresses itself; its frontage is not a gap
  // (town quality pass) and the monthly car park is not a gap either: its
  // trees stood in its way out onto the bridge road
  const lotsOwn = [...specials, (([x0, z0, x1, z1]) => ({ x0, z0, x1, z1 }))(TOWN.land.parking)];
  const inSpecial = (p) => lotsOwn.some((q) => p.x > q.x0 - 1.5 && p.x < q.x1 + 1.5 && p.z > q.z0 - 1.5 && p.z < q.z1 + 1.5);
  const trees = [];
  const reg = (kind, p) => ctx.registry?.push({ kind, x: p.x, z: p.z });
  const byEdgeSide = new Map();
  for (const l of lots) {
    const k = `${l.e.i}:${l.side}`;
    if (!byEdgeSide.has(k)) byEdgeSide.set(k, []);
    byEdgeSide.get(k).push(l);
  }

  for (const e of net.edges) {
    if (e.opts.surface === false) continue;      // the main road: M2's own dressing and the hero window
    const r = rngKit(e.seed + 555);
    const walk = e.spec.walk > 0;
    for (const side of [-1, 1]) {
      const lotsHere = (byEdgeSide.get(`${e.i}:${side}`) ?? []).sort((a, b) => a.s0 - b.s0);
      // the frontage strip: on the pavement's back edge, or the lane's verge
      const off = side * (walk ? e.t - 0.45 : e.a + 0.45);
      const y = walk ? WY : 0;
      const ry = Math.atan2(e.axis === 'x' ? 0 : -side, e.axis === 'x' ? -side : 0);   // face the street
      /* (town quality pass) a gap on this street can be a cross street's
       * corner lot: its house stands there.  [sA, sB] along, [d0, d1] out */
      const hitsBuilding = (sA, sB, d0, d1) => {
        const q0 = net.at(e, sA, side * d0), q1 = net.at(e, sB, side * d1);
        const x0 = Math.min(q0.x, q1.x), x1 = Math.max(q0.x, q1.x), z0 = Math.min(q0.z, q1.z), z1 = Math.max(q0.z, q1.z);
        return (Array.isArray(ctx.registry) ? ctx.registry : []).some((q) => q.kind === 'building' && q.rect
          && q.rect[0] < x1 && q.rect[2] > x0 && q.rect[1] < z1 && q.rect[3] > z0);
      };
      const put = (obj, s, kind = 'prop', col = 0.35, h = 1.0) => {
        const p = net.at(e, s, off);
        if (net.quiet(p.x, p.z)) return null;
        // off a pavement, never into a house (a cross street's corner lot)
        if (!walk && hitsBuilding(s - col, s + col, Math.abs(off) - 0.3, Math.abs(off) + 0.35)) return null;
        // on a pavement, only where the walk keeps its clear way
        if (walk && walkRoom(ctx, net, e, side, s - col - 0.2, s + col + 0.2, Math.abs(off) - Math.min(col, 0.45), Math.abs(off) + 0.45) < WALK_CLEAR) return null;
        obj.position.set(p.x, y, p.z);
        obj.rotation.y = ry;
        obj.userData.detail = true;
        ctx.add(obj);
        reg(kind, p);
        // on a pavement, keep the walk passable (the player is 0.34 m round)
        const c = walk ? Math.min(col, 0.3) : col;
        if (c > 0) ctx.collide(p.x - c, p.z - c, p.x + c, p.z + c, y + h);
        return p;
      };

      // the gaps between lots (and before the first, after the last)
      const s0 = e.a0 + 1.5, s1 = e.a1 - 1.5;
      const gaps = [];
      let from = s0;
      for (const l of lotsHere) { if (l.s0 - from > 3) gaps.push([from, l.s0]); from = Math.max(from, l.s1); }
      if (s1 - from > 3) gaps.push([from, s1]);

      // split each gap where a quiet zone (hero window, railway) cuts it
      const open = [];
      for (const [a, b] of gaps) {
        let run = null;
        for (let s = a; s <= b + 1e-6; s += 0.5) {
          const q = net.at(e, s, side * (walk ? e.t + 1.2 : e.a + 1.4));
          if (net.quiet(q.x, q.z) || inSpecial(q)) { if (run && run[1] - run[0] > 3) open.push(run); run = null; }
          else if (!run) run = [s, s]; else run[1] = s;
        }
        if (run && run[1] - run[0] > 3) open.push(run);
      }
      // long gaps are filled piece by piece, about every 6 m
      const pieces = [];
      for (const [a, b] of open) {
        const n = Math.max(1, Math.round((b - a) / 6.5));
        for (let k = 0; k < n; k++) pieces.push([a + ((b - a) * k) / n, a + ((b - a) * (k + 1)) / n]);
      }
      for (const [a, b] of pieces) {
        const w = b - a;
        const mid = (a + b) / 2;
        const p = net.at(e, mid, side * (walk ? e.t + 1.2 : e.a + 1.4));
        if (net.quiet(p.x, p.z)) continue;
        const dTree = walk ? e.t + 1.2 : e.a + 1.4;
        if (w > 6 && r.chance(0.55)) {
          const scale = r.range(0.9, 1.2);           // (drawn first: a skipped tree moves nothing else)
          if (hitsBuilding(mid - 0.35, mid + 0.35, dTree - 0.35, dTree + 0.35)) continue;   // a trunk in a house
          trees.push({ x: p.x, z: p.z, y: 0, scale, seed: e.seed * 7 + Math.round(mid) });
          ctx.collide(p.x - 0.35, p.z - 0.35, p.x + 0.35, p.z + 0.35, 3);
          reg('prop', p);
          if (w > 9) put(makePlanter({ x: 0, y: 0, z: 0, r: 0.3, flower: true, seed: e.seed + Math.round(a), n: 6 }), a + 1.2, 'prop', 0.3, 0.8);
        } else if (!walk && w > 4 && r.chance(0.5)) {
          if (hitsBuilding(mid - 1.1, mid + 1.1, e.a + 0.2, e.a + 1.45)) continue;
          const g = makeGomiHouse({});
          put(g, mid, 'prop', 1.0, 1.2);
        } else if (walk && w > 4 && r.chance(0.5)) {
          const q = net.at(e, mid, off);
          const roomy = walkRoom(ctx, net, e, side, mid - 1.9, mid + 2.6, e.t - 0.95, e.t) >= WALK_CLEAR;
          const gashapon = !net.quiet(q.x, q.z) && r.chance(0.5);   // (drawn either way: nothing else moves)
          if (!net.quiet(q.x, q.z) && roomy) {
            addVending(ctx, { detail: true, x: q.x, y, z: q.z, ry, variant: Math.round(mid) % 3, seed: e.seed + Math.round(mid) });
            ctx.night?.pool(q.x, q.z, 2.4, { y, color: 0xe8f0ff, strength: 0.8 });
            const b2 = net.at(e, mid + 1.2, off);
            addVending(ctx, { detail: true, x: b2.x, y, z: b2.z, ry, variant: (Math.round(mid) + 1) % 3, seed: e.seed + Math.round(mid) + 1 });
            const vb = makeVendBin({ x: 0, y: 0, z: 0 });
            put(vb, mid + 2.2, 'prop', 0.3, 1.0);
            reg('prop', q); reg('prop', b2);
            // and, as often as not, a bank of capsule-toy machines beside them
            if (gashapon && w > 5.2) {
              const gp = net.at(e, mid - 1.3, off);
              if (!net.quiet(gp.x, gp.z)) {
                kit.clutter?.put('gashapon', gp.x, y, gp.z, ry);
                ctx.collide(gp.x - 0.5, gp.z - 0.5, gp.x + 0.5, gp.z + 0.5, y + 1.4);
                reg('prop', gp);
              }
            }
          }
        } else {
          put(makePlanter({ x: 0, y: 0, z: 0, r: 0.28, flower: r.chance(0.7), seed: e.seed + Math.round(a), n: 5 }), a + 1.0, 'prop', 0.3, 0.8);
          if (w > 4.5) put(makeBench({ x: 0, y: 0, z: 0, len: 1.4, wood: true }), mid, 'prop', 0.7, 0.8);
          else if (r.chance(0.6)) put(makeCrates({ x: 0, y: 0, z: 0, n: 2, seed: e.seed + Math.round(b) }), b - 1.0, 'prop', 0.4, 0.8);
        }
      }

    }
  }

  /* corners: a post box at one corner of every busy junction, a bike rack at the spine's */
  for (const n of Object.values(net.nodes)) {
    if (n.degree < 3 || n.external) continue;
    const r = rngKit(Math.round(n.x * 13 + n.z * 7));
    const busy = n.edges.some((e) => e.spec.walk > 0);
    /* (town quality pass) at a busy corner the post box stands on the
     * walk's back corner: 0.6 m past the walk put it inside the corner
     * shop, out of sight.  At a lane corner, on the verge, unless a house
     * stands there. */
    const cx = n.x + (r.chance(0.5) ? 1 : -1) * (busy ? n.tx - 0.45 : n.tx + 0.6);
    let cz = n.z + (r.chance(0.5) ? 1 : -1) * (n.tz + 0.6);
    if (net.quiet(cx, cz)) continue;
    const czSign = Math.sign(cz - n.z);
    if (busy) {
      // slide along the walk until the way past it stays 1.2 m clear
      const sz = Math.sign(cz - n.z), e = n.dirs[sz > 0 ? '+z' : '-z'];
      if (e && e.spec.walk > 0) {
        const side = Math.sign(cx - n.x);
        let k = 0;
        while (k < 4 && walkRoom(ctx, net, e, side, cz - 0.45, cz + 0.45, e.t - 0.8, e.t) < WALK_CLEAR) { cz += sz * 1.0; k++; }
        if (k === 4) cz = NaN;
      }
    }
    const y = busy ? WY : 0;
    const inHouse = (Array.isArray(ctx.registry) ? ctx.registry : []).some((q) => q.kind === 'building' && q.rect
      && q.rect[0] < cx + 0.35 && q.rect[2] > cx - 0.35 && q.rect[1] < cz + 0.35 && q.rect[3] > cz - 0.35);
    if ((busy || r.chance(0.35)) && !inHouse && !Number.isNaN(cz)) {
      ctx.add(makePostBox({ x: cx, y, z: cz, ry: r.range(0, Math.PI * 2) }));
      ctx.collide(cx - 0.3, cz - 0.3, cx + 0.3, cz + 0.3, y + 1.4);
      reg('prop', { x: cx, z: cz });
    }
    /* (town quality pass) the corner's bicycles: they stood in a rack across
     * the corner, in the corner shop's wall.  Now three parked along the
     * kerb of the busy street just past the corner, the walk left clear. */
    if (busy && kit.clutter) {
      const sx = -Math.sign(cx - n.x), sz = czSign;
      const e = [n.dirs[sz > 0 ? '+z' : '-z'], n.dirs[sz > 0 ? '+x' : '-x']].find((q) => q && q.spec.walk > 0 && q.axis === 'z');
      if (e) {
        const side = sx;
        const off = side * (e.a + 0.5);
        const s0 = n.z + sz * (n.tz + 1.6);
        const ry = Math.PI / 2 + (sz > 0 ? 0 : Math.PI);
        const pts = [0, 1, 2].map((k) => net.at(e, s0 + sz * k * 0.95, off));
        const poles = (ctx.registry ?? []).filter((q) => q.kind === 'pole' || q.kind === 'sign');
        // clear of anything already standing there (a board, a bench, a pole's box)
        const free = (p) => {
          const w = ctx.toWorld(p);
          return !ctx.colliders.some((c) => (c.top ?? 9) > y + 0.3 && w.x + 0.3 > c.x0 && w.x - 0.3 < c.x1 && w.z + 0.95 > c.z0 && w.z - 0.95 < c.z1);
        };
        const sA = Math.min(s0, s0 + sz * 1.9) - 0.95, sB = Math.max(s0, s0 + sz * 1.9) + 0.95;
        const roomy = walkRoom(ctx, net, e, side, sA, sB, e.a + 0.2, e.a + 0.8) >= WALK_CLEAR;
        if (roomy && pts.every((p) => !net.quiet(p.x, p.z) && free(p) && !poles.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 1.0))) {
          pts.forEach((p, k) => kit.clutter.put('bike', p.x, y, p.z, ry + (k - 1) * 0.05, { roll: 0.07 * (k % 2 ? 1 : -1), color: [0x3f6f9c, 0xd8a03c, 0xe8e2d4, 0x9c5a4a][(k + Math.round(n.z)) % 4] }));
          const a = pts[0], b = pts[2];
          ctx.collide(Math.min(a.x, b.x) - 0.3, Math.min(a.z, b.z) - 0.95, Math.max(a.x, b.x) + 0.3, Math.max(a.z, b.z) + 0.95, y + 1.0);
          for (const p of pts) reg('bikes', p);          // the walks' clutter keeps off them (street/walks.js)
        }
      }
    }
  }

  // the walks' own clutter: bicycles, boards, crates, capsule toys (town quality pass)
  if (kit.clutter) dressWalks(ctx, net, kit, lots);

  // a signalled junction's corners stay open, so drivers and walkers see each other
  const sigAt = net.crossings.filter((c) => c.signalised).map((c) => net.at(c.e, c.at, 0));
  const clearOfSignals = (t) => !sigAt.some((p) => Math.hypot(p.x - t.x, p.z - t.z) < 11);
  ctx.sakura.push(...trees.filter(clearOfSignals));   // built with the town's other sakura in one batch
  if (ctx.hedges?.length) buildShrubs(ctx, ctx.hedges);

  /* cats, sat at a front gate */
  const r = rngKit(4242);
  const catLots = lots.filter((l) => l.kind === 'house');
  for (let i = 0; i < Math.min(6, catLots.length); i++) {
    const l = catLots[Math.floor(r.next() * catLots.length)];
    const p = net.at(l.e, (l.s0 + l.s1) / 2 + r.range(-2, 2), l.front + l.side * 0.25);
    const cat = makeCat({});
    cat.position.set(p.x, 0, p.z);
    cat.rotation.y = r.range(0, Math.PI * 2);
    cat.userData.detail = true;
    if (cat.userData.tail) cat.userData.tail.userData.dynamic = true;    // it swishes (kit/life.js)
    ctx.add(cat);
    ctx.cats?.push(cat);
    ctx.collide(p.x - 0.25, p.z - 0.25, p.x + 0.25, p.z + 0.25, 0.4);
    reg('prop', p);
  }
}
