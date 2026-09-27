import { rngKit } from '../../core/util.js';
import { makeGomiHouse } from '../streetprops.js';
import {
  makePlanter, makeBench, makePostBox, makeCat, makeBikeRack, makeVendBin, makeCrates,
} from '../props.js';
import { addVending } from '../vending.js';
import { buildShrubs } from '../trees.js';
import { ROADS } from '../../config.js';
import { dressWalks } from './street/walks.js';

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
  const inSpecial = (p) => specials.some((q) => p.x > q.x0 - 1.5 && p.x < q.x1 + 1.5 && p.z > q.z0 - 1.5 && p.z < q.z1 + 1.5);
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
      const put = (obj, s, kind = 'prop', col = 0.35, h = 1.0) => {
        const p = net.at(e, s, off);
        if (net.quiet(p.x, p.z)) return null;
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
        if (w > 6 && r.chance(0.55)) {
          trees.push({ x: p.x, z: p.z, y: 0, scale: r.range(0.9, 1.2), seed: e.seed * 7 + Math.round(mid) });
          ctx.collide(p.x - 0.35, p.z - 0.35, p.x + 0.35, p.z + 0.35, 3);
          reg('prop', p);
          if (w > 9) put(makePlanter({ x: 0, y: 0, z: 0, r: 0.3, flower: true, seed: e.seed + Math.round(a), n: 6 }), a + 1.2, 'prop', 0.3, 0.8);
        } else if (!walk && w > 4 && r.chance(0.5)) {
          const g = makeGomiHouse({});
          put(g, mid, 'prop', 1.0, 1.2);
        } else if (walk && w > 4 && r.chance(0.5)) {
          const q = net.at(e, mid, off);
          if (!net.quiet(q.x, q.z)) {
            addVending(ctx, { detail: true, x: q.x, y, z: q.z, ry, variant: Math.round(mid) % 3, seed: e.seed + Math.round(mid) });
            ctx.night?.pool(q.x, q.z, 2.4, { y, color: 0xe8f0ff, strength: 0.8 });
            const b2 = net.at(e, mid + 1.2, off);
            addVending(ctx, { detail: true, x: b2.x, y, z: b2.z, ry, variant: (Math.round(mid) + 1) % 3, seed: e.seed + Math.round(mid) + 1 });
            const vb = makeVendBin({ x: 0, y: 0, z: 0 });
            put(vb, mid + 2.2, 'prop', 0.3, 1.0);
            reg('prop', q); reg('prop', b2);
            // and, as often as not, a bank of capsule-toy machines beside them
            if (r.chance(0.5) && w > 5.2) {
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
    const cx = n.x + (r.chance(0.5) ? 1 : -1) * (n.tx + 0.6);
    const cz = n.z + (r.chance(0.5) ? 1 : -1) * (n.tz + 0.6);
    if (net.quiet(cx, cz)) continue;
    const y = busy ? WY : 0;
    if (busy || r.chance(0.35)) {
      ctx.add(makePostBox({ x: cx, y, z: cz, ry: r.range(0, Math.PI * 2) }));
      ctx.collide(cx - 0.3, cz - 0.3, cx + 0.3, cz + 0.3, y + 1.4);
      reg('prop', { x: cx, z: cz });
    }
    if (busy) {
      const bx = n.x - Math.sign(cx - n.x) * (n.tx + 0.6), bz = cz;
      if (!net.quiet(bx, bz)) {
        const rack = makeBikeRack({ x: bx, y, z: bz, ry: 0, n: 3, seed: Math.round(bx * 3 + bz) });
        rack.userData.detail = true;
        ctx.add(rack);
        ctx.collide(bx - 1.3, bz - 0.9, bx + 1.3, bz + 0.9, y + 1.0);
        reg('prop', { x: bx, z: bz });
      }
    }
  }

  // the walks' own clutter: bicycles, boards, crates, capsule toys (town quality pass)
  if (kit.clutter) dressWalks(ctx, net, kit, lots);

  ctx.sakura.push(...trees);           // built with the town's other sakura in one batch
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
