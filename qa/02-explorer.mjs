// Scenario 2, the explorer: the whole walkable town, by the game's own walker (player.update), in the page.
//   E1 props with no collider (the density registry against the colliders)
//   E2 sprint into every tall collider from four sides: does anyone end up inside?
//   E3 the edges: walk out of the town every way; what is seen there
//   E4 random walkers: where does a walker get stuck (pushing, not moving) or trapped?
//   E5 the ground: holes, cliffs and ledges between neighbouring free cells
//   E6 water: can you walk into the river, the pond, the paddies?
//   E7 pressed against walls: what the camera sees (near-plane clipping)
//   node qa/02-explorer.mjs [--only E1,E2]
import { open, ready, harness, wait, writeJSON, ART } from './lib.mjs';
import path from 'node:path';

const name = '02-explorer';
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1].split(',') : null; })();
const s = await open({ name, viewport: { width: 1280, height: 720 } });
const { page } = s;
const results = {};
const run = async (id, fn) => {
  if (only && !only.includes(id)) return;
  const t0 = Date.now();
  try { results[id] = await fn(); } catch (e) { results[id] = { error: String(e.stack || e).slice(0, 800) }; }
  results[id].secs = +((Date.now() - t0) / 1000).toFixed(1);
  console.log(id, JSON.stringify(results[id]).slice(0, 1500));
  writeJSON(path.join(ART, name, 'result.json'), results);
};
const ev = (fn, arg) => page.evaluate(fn, arg);

try {
  await page.goto(process.env.QA_BASE || 'http://127.0.0.1:5180/');
  await ready(page);
  await page.click('.overlay .menu-action');
  await wait(1200);
  await harness(page, { lockFake: false, startSound: false });
  // the walker, in the page: the real loop leaves the player alone while we drive it
  await ev(() => {
    const { player: p, world } = window.__scene;
    p.scripted = true;
    window.__qaWorld = world;
    const R = 0.34;
    window.__inside = (x, z, feetY) => world.colliders.find((c) => (c.top === undefined || c.top > feetY + 0.38) && (c.bottom === undefined || c.bottom <= feetY + 1.9)
      && x > c.x0 - R + 0.02 && x < c.x1 + R - 0.02 && z > c.z0 - R + 0.02 && z < c.z1 + R - 0.02);
    /** Drive the player: yaw, keys, n steps of dt; returns the path's end. */
    window.__drive = (x, z, yaw, keys, n, dt = 1 / 60) => {
      p.pos.set(x, world.heightAt(x, z), z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = 0;
      p.keys.clear(); for (const k of keys) p.keys.add(k);
      const was = p.locked; p.locked = true; p.suspended = false;
      for (let i = 0; i < n; i++) p.update(dt);
      p.keys.clear(); p.locked = was;
      return { x: p.pos.x, z: p.pos.z, y: p.pos.y };
    };
  });

  await run('E1', () => ev(() => {
    const W = window.__qaWorld, F = W.frame, reg = W.registry ?? [];
    const kinds = {};
    const bare = [];
    for (const r of reg) {
      if (r.kind === 'building') continue;
      const w = F.toWorld({ x: r.x, z: r.z });
      const covered = W.colliders.some((c) => w.x > c.x0 - 0.15 && w.x < c.x1 + 0.15 && w.z > c.z0 - 0.15 && w.z < c.z1 + 0.15);
      const k = r.kind + (r.what ? ':' + r.what : r.type ? ':' + r.type : r.name ? ':' + r.name : '');
      kinds[k] ??= { n: 0, noCollider: 0 };
      kinds[k].n++;
      if (!covered) { kinds[k].noCollider++; if (bare.length < 400) bare.push({ k, x: +w.x.toFixed(1), z: +w.z.toFixed(1) }); }
    }
    const sample = reg.slice(0, 5).map((r) => Object.keys(r).join(','));
    return { registry: reg.length, colliders: W.colliders.length, bounds: W.bounds, kinds, sample, bare };
  }));

  await run('E2', () => ev(() => {
    const W = window.__qaWorld;
    const tall = W.colliders.filter((c) => (c.top ?? 99) > 1.2 && (c.bottom ?? 0) < 1.0 && c.x1 - c.x0 < 80 && c.z1 - c.z0 < 80);
    const B = W.bounds;
    const inB = (x, z) => x > B.x0 && x < B.x1 && z > B.z0 && z < B.z1;
    const bad = [];
    let tries = 0;
    for (const c of tall) {
      const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2;
      for (const [sx, sz] of [[c.x0 - 0.9, cz], [c.x1 + 0.9, cz], [cx, c.z0 - 0.9], [cx, c.z1 + 0.9], [c.x0 - 0.7, c.z0 - 0.7], [c.x1 + 0.7, c.z1 + 0.7]]) {
        if (!inB(sx, sz)) continue;
        const y0 = W.heightAt(sx, sz);
        if (window.__inside(sx, sz, y0)) continue;                     // start must be free
        const yaw = Math.atan2(-(cx - sx), -(cz - sz));
        tries++;
        const e = window.__drive(sx, sz, yaw, ['KeyW', 'ShiftLeft'], 90);
        const hit = window.__inside(e.x, e.z, e.y);
        if (hit) bad.push({ from: [+sx.toFixed(1), +sz.toFixed(1)], end: [+e.x.toFixed(2), +e.z.toFixed(2)], box: [c.x0, c.z0, c.x1, c.z1].map((v) => +v.toFixed(1)), top: c.top });
      }
    }
    return { tall: tall.length, tries, inside: bad.length, first: bad.slice(0, 30) };
  }));

  await run('E3', async () => {
    const edges = await ev(() => {
      const W = window.__qaWorld, B = W.bounds;
      const out = [];
      const mid = { x: (B.x0 + B.x1) / 2, z: (B.z0 + B.z1) / 2 };
      // from the middle, walk straight out in 16 directions for 90 s (clamped at the bounds or stopped by a fence)
      for (let k = 0; k < 16; k++) {
        const yaw = (k / 16) * Math.PI * 2;
        const e = window.__drive(mid.x, mid.z, yaw, ['KeyW', 'ShiftLeft'], 60 * 60);
        out.push({ yaw: +yaw.toFixed(2), end: [+e.x.toFixed(1), +e.z.toFixed(1)], atBound: Math.abs(e.x - B.x0) < 0.05 || Math.abs(e.x - B.x1) < 0.05 || Math.abs(e.z - B.z0) < 0.05 || Math.abs(e.z - B.z1) < 0.05 });
      }
      // along each bound line: every 4 m, can you stand at the very bound (a clamp, not a fence, holds you)?
      const clampOnly = [];
      for (const [ax, fixed, a0, a1] of [['z', B.z0, B.x0, B.x1], ['z', B.z1, B.x0, B.x1], ['x', B.x0, B.z0, B.z1], ['x', B.x1, B.z0, B.z1]]) {
        let n = 0, open = 0;
        for (let a = a0 + 2; a < a1 - 2; a += 4) {
          n++;
          const x = ax === 'z' ? a : fixed + (fixed === B.x0 ? 0.5 : -0.5), z = ax === 'z' ? fixed + (fixed === B.z0 ? 0.5 : -0.5) : a;
          if (!window.__inside(x, z, W.heightAt(x, z))) open++;
        }
        clampOnly.push({ edge: `${ax}=${fixed}`, samples: n, standable: open });
      }
      return { bounds: B, out, clampOnly };
    });
    // look out at each edge from a standable spot near its middle
    const B = edges.bounds;
    const views = [['north', (B.x0 + B.x1) / 2, B.z0 + 0.6, 0], ['south', (B.x0 + B.x1) / 2, B.z1 - 0.6, Math.PI], ['west', B.x0 + 0.6, (B.z0 + B.z1) / 2, Math.PI / 2], ['east', B.x1 - 0.6, (B.z0 + B.z1) / 2, -Math.PI / 2],
      ['corner-nw', B.x0 + 0.8, B.z0 + 0.8, Math.PI / 4], ['corner-se', B.x1 - 0.8, B.z1 - 0.8, Math.PI * 1.25], ['corner-ne', B.x1 - 0.8, B.z0 + 0.8, -Math.PI / 4], ['corner-sw', B.x0 + 0.8, B.z1 - 0.8, Math.PI * 0.75]];
    edges.shots = [];
    for (const [n, x, z, yaw] of views) {
      const free = await ev(([x, z, yaw]) => {
        const W = window.__qaWorld, p = window.__scene.player;
        // nearest free spot
        for (let r = 0; r < 12; r += 0.5) for (let a = 0; a < 6.28; a += 0.8) {
          const xx = x + Math.cos(a) * r, zz = z + Math.sin(a) * r;
          if (!window.__inside(xx, zz, W.heightAt(xx, zz))) { p.pos.set(xx, W.heightAt(xx, zz), zz); p.yaw = yaw; p.pitch = 0.02; p.applyCamera(0); return [+xx.toFixed(1), +zz.toFixed(1)]; }
        }
        return null;
      }, [x, z, yaw]);
      await wait(900);
      edges.shots.push({ n, at: free, shot: await s.shot(`E3-edge-${n}`) });
    }
    return edges;
  });

  await run('E4', () => ev(() => {
    const W = window.__qaWorld, B = W.bounds, p = window.__scene.player;
    let seed = 12345;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const stuck = [], trapped = [];
    let walkers = 0, simSecs = 0;
    for (let w = 0; w < 60; w++) {
      // a random free start
      let x, z;
      for (let k = 0; k < 200; k++) { x = B.x0 + rnd() * (B.x1 - B.x0); z = B.z0 + rnd() * (B.z1 - B.z0); if (!window.__inside(x, z, W.heightAt(x, z))) break; }
      p.pos.set(x, W.heightAt(x, z), z); p.vel.set(0, 0, 0);
      p.locked = true; p.suspended = false;
      walkers++;
      let yaw = rnd() * 6.28, since = 0, last = { x, z }, region = { x, z, t: 0 };
      for (let t = 0; t < 90; t += 1 / 30) {
        if (rnd() < 1 / 90) yaw = rnd() * 6.28;               // a new heading every ~3 s
        p.yaw = yaw; p.keys.clear(); p.keys.add('KeyW'); if (rnd() < 0.3) p.keys.add('ShiftLeft');
        p.update(1 / 30);
        simSecs += 1 / 30;
        const moved = Math.hypot(p.pos.x - last.x, p.pos.z - last.z);
        last = { x: p.pos.x, z: p.pos.z };
        if (moved < 0.002) {
          since += 1 / 30;
          if (since > 1.0) {
            // pushing into something: try every direction; if none moves us, we are stuck for real
            let free = false;
            for (let a = 0; a < 8 && !free; a++) {
              const sx = p.pos.x, sz = p.pos.z;
              p.yaw = a * Math.PI / 4;
              for (let i = 0; i < 20; i++) p.update(1 / 30);
              if (Math.hypot(p.pos.x - sx, p.pos.z - sz) > 0.3) free = true;
              else { p.pos.set(sx, p.pos.y, sz); p.vel.set(0, 0, 0); }
            }
            if (!free) stuck.push({ at: [+p.pos.x.toFixed(2), +p.pos.z.toFixed(2)], y: +p.pos.y.toFixed(2) });
            yaw = rnd() * 6.28; since = 0;
          }
        } else since = 0;
        if (Math.hypot(p.pos.x - region.x, p.pos.z - region.z) > 3) region = { x: p.pos.x, z: p.pos.z, t };
        else if (t - region.t > 30) { trapped.push({ at: [+p.pos.x.toFixed(1), +p.pos.z.toFixed(1)] }); region = { x: p.pos.x, z: p.pos.z, t }; }
      }
    }
    p.keys.clear();
    return { walkers, simMinutes: +(simSecs / 60).toFixed(1), stuck: stuck.length, stuckAt: stuck.slice(0, 20), trapped: trapped.length, trappedAt: trapped.slice(0, 20) };
  }));

  await run('E5', () => ev(() => {
    const W = window.__qaWorld, B = W.bounds;
    const C = 1.0, cliffs = [], holes = [], nan = [];
    const nx = Math.floor((B.x1 - B.x0) / C), nz = Math.floor((B.z1 - B.z0) / C);
    const h = new Float32Array(nx * nz).fill(NaN), free = new Uint8Array(nx * nz);
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const x = B.x0 + (ix + 0.5) * C, z = B.z0 + (iz + 0.5) * C;
      const y = W.heightAt(x, z);
      if (!Number.isFinite(y)) { nan.push([x, z]); continue; }
      h[iz * nx + ix] = y;
      free[iz * nx + ix] = window.__inside(x, z, y) ? 0 : 1;
    }
    let freeN = 0, minY = Infinity, maxY = -Infinity;
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const i = iz * nx + ix;
      if (!free[i]) continue;
      freeN++; minY = Math.min(minY, h[i]); maxY = Math.max(maxY, h[i]);
      for (const [dx, dz] of [[1, 0], [0, 1]]) {
        const j = (iz + dz) * nx + ix + dx;
        if (ix + dx >= nx || iz + dz >= nz || !free[j]) continue;
        const d = Math.abs(h[i] - h[j]);
        if (d > 0.6) cliffs.push({ a: [+(B.x0 + (ix + 0.5) * C).toFixed(1), +(B.z0 + (iz + 0.5) * C).toFixed(1)], dy: +d.toFixed(2) });
      }
    }
    return { cells: nx * nz, free: freeN, minY: +minY.toFixed(2), maxY: +maxY.toFixed(2), nan: nan.length, cliffs: cliffs.length, cliffSample: cliffs.slice(0, 25) };
  }));

  await run('E6', async () => {
    // walk into the water: the river (world z < -10 behind the spawn), 鏡池, a paddy
    const tests = await ev(() => {
      const W = window.__qaWorld, F = W.frame;
      const pond = window.__mapArt?.places?.find((p) => p.id === 'pond')?.w;
      const river = window.__mapArt?.places?.find((p) => p.id === 'river')?.w;
      const out = {};
      for (const [n, c] of [['pond', pond], ['river', river]]) {
        if (!c) { out[n] = null; continue; }
        const res = [];
        for (let a = 0; a < 8; a++) {
          const yaw = a * Math.PI / 4;
          const sx = c.x + Math.sin(yaw) * 18, sz = c.z + Math.cos(yaw) * 18;       // 18 m out, walking in
          if (window.__inside(sx, sz, W.heightAt(sx, sz))) continue;
          const e = window.__drive(sx, sz, Math.atan2(sx - c.x, sz - c.z), ['KeyW'], 60 * 12);
          res.push({ from: [+sx.toFixed(1), +sz.toFixed(1)], end: [+e.x.toFixed(1), +e.z.toFixed(1)], y: +e.y.toFixed(2), reachedMiddle: Math.hypot(e.x - c.x, e.z - c.z) < 3 });
        }
        out[n] = { centre: [+c.x.toFixed(1), +c.z.toFixed(1)], y: +W.heightAt(c.x, c.z).toFixed(2), res };
      }
      return out;
    });
    // a frame at the lowest point reached in each
    for (const [n, t] of Object.entries(tests)) {
      const deepest = t?.res?.sort((a, b) => a.y - b.y)[0];
      if (!deepest) continue;
      await ev(([x, z]) => { const p = window.__scene.player, W = window.__qaWorld; p.pos.set(x, W.heightAt(x, z), z); p.pitch = -0.2; p.applyCamera(0); }, deepest.end);
      await wait(700);
      t.shot = await s.shot(`E6-${n}-deepest`);
    }
    return tests;
  });

  await run('E7', async () => {
    // pressed against things: the store's glass, a house, a shop front, a car, a pole, a tree, a vending machine
    const spots = await ev(() => {
      const W = window.__qaWorld;
      const pick = (pred, n) => W.colliders.filter(pred).slice(0, n);
      const walls = pick((c) => (c.top ?? 0) > 2.5 && c.x1 - c.x0 > 4 && c.z1 - c.z0 > 4, 400).filter((_, i) => i % 60 === 0);
      const small = pick((c) => (c.top ?? 0) > 1.2 && c.x1 - c.x0 < 1.2 && c.z1 - c.z0 < 1.2, 2000).filter((_, i) => i % 250 === 0);
      return [...walls, ...small].map((c) => ({ c: [c.x0, c.z0, c.x1, c.z1], top: c.top }));
    });
    const out = [];
    let k = 0;
    for (const sp of spots.slice(0, 14)) {
      const r = await ev(([x0, z0, x1, z1]) => {
        const W = window.__qaWorld, p = window.__scene.player;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        for (const [sx, sz] of [[cx, z1 + 1.5], [cx, z0 - 1.5], [x0 - 1.5, cz], [x1 + 1.5, cz]]) {
          if (window.__inside(sx, sz, W.heightAt(sx, sz))) continue;
          const yaw = Math.atan2(-(cx - sx), -(cz - sz));
          const e = window.__drive(sx, sz, yaw, ['KeyW'], 120);
          p.yaw = yaw + 0.35; p.pitch = 0.05; p.applyCamera(0);
          return { from: [+sx.toFixed(1), +sz.toFixed(1)], end: [+e.x.toFixed(2), +e.z.toFixed(2)] };
        }
        return null;
      }, sp.c);
      if (!r) continue;
      await wait(700);
      out.push({ ...sp, ...r, shot: await s.shot(`E7-against-${String(k++).padStart(2, '0')}`) });
    }
    return { out };
  });
} catch (e) {
  console.error(e);
} finally {
  writeJSON(path.join(ART, name, 'result.json'), results);
  await s.close();
}
