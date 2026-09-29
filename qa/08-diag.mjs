// Targeted diagnostics for what the scenarios turned up.
//   whistle   F from six places a player stands: does Hachi come and greet, how soon, in view?
//   pen       the walker ending inside a collider: which one, how deep
//   trainpause the trains' own sound (a second AudioContext) under the pause card
//   node qa/08-diag.mjs [--only whistle,pen,trainpause]
import { open, ready, harness, audioSpy, wait, writeJSON, ART } from './lib.mjs';
import path from 'node:path';

const name = '08-diag';
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1].split(',') : null; })();
const want = (id) => !only || only.includes(id);
const s = await open({ name, autoplay: false });
await audioSpy(s.context);
const { page } = s;
const ev = (fn, a) => page.evaluate(fn, a);
const results = {};
const save = () => writeJSON(path.join(ART, name, 'result.json'), results);
const tp = (x, z, yaw = null, pitch = null) => ev(([x, z, yaw, pitch]) => { const { player: p, world } = window.__scene; p.pos.set(x, world.heightAt(x, z), z); p.vel.set(0, 0, 0); if (yaw !== null) p.yaw = yaw; if (pitch !== null) p.pitch = pitch; p.applyCamera(0); }, [x, z, yaw, pitch]);

try {
  await page.goto(process.env.QA_BASE || 'http://127.0.0.1:5180/');
  await ready(page);
  await page.click('.overlay .menu-action');
  await wait(1500);
  await harness(page, { lockFake: false, startSound: false });
  await wait(6000);          // the hello first

  if (want('whistle')) {
    // (the last two: the same street at a level view and at the spawn's upward pitch, 0.16, which most players keep)
    const places = [['forecourt', 6, 8, 0.8, 0], ['car-park', -20, 26, 1.6, 0], ['bridge-road', -30, 30, 0, 0], ['shopping-street', 50, -30, 0, 0], ['station-plaza', 55, -100, 0, 0], ['shrine-lane', -20, -52, 1.57, 0], ['pond-promenade', -60, -84, 1.57, 0], ['lane-level', 50, -60, 0, 0], ['lane-pitch-0.16', 50, -60, 0, 0.16]];
    const out = [];
    for (const [n, x, z, yaw, pitch] of places) {
      await tp(x, z, yaw, pitch);
      await wait(2500);
      const before = await ev(() => window.__guide.state());
      const t0 = Date.now();
      await page.keyboard.press('KeyF');
      const seq = [];
      let greetAt = null, minD = 1e9, seenGreet = 0, greetN = 0;
      for (let k = 0; k < 60; k++) {
        await wait(200);
        const r = await ev(() => {
          const { camera, THREE } = window.__scene, G = window.__guide.G;
          const v = new THREE.Vector3(G.x, G.y + 0.15, G.z).project(camera);
          return { st: G.state, act: G.act?.name ?? null, d: Math.hypot(G.x - camera.position.x, G.z - camera.position.z), inView: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1, whistleAt: G.whistleAt, t: G.t };
        });
        if (!seq.length || seq[seq.length - 1] !== r.st) seq.push(r.st);
        minD = Math.min(minD, r.d);
        if (r.act === 'greet') { greetN++; if (r.inView) seenGreet++; if (greetAt === null) greetAt = (Date.now() - t0) / 1000; }
      }
      // the same at the spawn's upward pitch
      out.push({ n, at: [x, z], before: { state: before.state, target: before.target, x: before.x, z: before.z }, seq, greetAt, greetN, seenGreet, minD: +minD.toFixed(1), shot: await s.shot(`whistle-${n}`) });
      console.log(JSON.stringify(out[out.length - 1]));
    }
    results.whistle = out;
    save();
  }

  if (want('pen')) {
    results.pen = await ev(() => {
      const { player: p, world: W } = window.__scene;
      p.scripted = true;
      const R = 0.34;
      const insideAll = (x, z, y) => W.colliders.filter((c) => (c.top === undefined || c.top > y + 0.38) && (c.bottom === undefined || c.bottom <= y + 1.9) && x > c.x0 - R && x < c.x1 + R && z > c.z0 - R && z < c.z1 + R)
        .map((c) => ({ box: [c.x0, c.z0, c.x1, c.z1].map((v) => +v.toFixed(2)), top: c.top, depth: +Math.min(x - (c.x0 - R), c.x1 + R - x, z - (c.z0 - R), c.z1 + R - z).toFixed(3) }));
      const drive = (x, z, yaw, n) => { p.pos.set(x, W.heightAt(x, z), z); p.vel.set(0, 0, 0); p.yaw = yaw; p.keys.clear(); p.keys.add('KeyW'); p.keys.add('ShiftLeft'); const l = p.locked; p.locked = true; for (let i = 0; i < n; i++) p.update(1 / 60); p.keys.clear(); p.locked = l; return { x: p.pos.x, z: p.pos.z, y: p.pos.y }; };
      const cases = [[-2.9, 1.2, -3.8, 0.35], [21.4, -76.7, 22.25, -73.9], [-47.1, -118.2, -47.95, -119.05], [-45.6, -119.5, -46.6, -120.5]];
      const out = [];
      for (const [sx, sz, cx, cz] of cases) {
        const yaw = Math.atan2(-(cx - sx), -(cz - sz));
        const e = drive(sx, sz, yaw, 90);
        out.push({ from: [sx, sz], end: [+e.x.toFixed(3), +e.z.toFixed(3)], hits: insideAll(e.x, e.z, e.y) });
      }
      // a sweep: every free 0.5 m cell near a tall collider, pushed at it for 1 s sprinting from 8 directions: the deepest overlaps
      let worst = [];
      const tall = W.colliders.filter((c) => (c.top ?? 99) > 1.2);
      let n = 0;
      for (const c of tall) {
        if (c.x1 - c.x0 > 60 || c.z1 - c.z0 > 60) continue;
        const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2;
        for (let a = 0; a < 8; a++) {
          const ang = a * Math.PI / 4, rr = Math.max(c.x1 - c.x0, c.z1 - c.z0) / 2 + 1.2;
          const sx = cx + Math.sin(ang) * rr, sz = cz + Math.cos(ang) * rr;
          if (insideAll(sx, sz, W.heightAt(sx, sz)).length) continue;
          const e = drive(sx, sz, Math.atan2(-(cx - sx), -(cz - sz)) + (a % 2 ? 0.3 : -0.3), 60);
          n++;
          const h = insideAll(e.x, e.z, e.y).filter((q) => q.depth > 0.03);
          if (h.length) worst.push({ from: [+sx.toFixed(1), +sz.toFixed(1)], end: [+e.x.toFixed(2), +e.z.toFixed(2)], depth: Math.max(...h.map((q) => q.depth)), boxes: h.map((q) => q.box) });
        }
      }
      worst.sort((a, b) => b.depth - a.depth);
      p.scripted = false;
      return { cases: out, pushes: n, overlaps: worst.length, deeperThan10cm: worst.filter((w) => w.depth > 0.1).length, worst: worst.slice(0, 12) };
    });
    console.log(JSON.stringify(results.pen).slice(0, 2500));
    save();
  }

  if (want('reach')) {
    // can a walker (the game's own controller) get into each ring by walking at it from 8 directions, 6 m out?
    results.reach = await ev(() => {
      const { player: p, world: W } = window.__scene;
      p.scripted = true;
      const out = {};
      for (const id of ['konbini', 'view', 'han', 'train', 'slowlife']) {
        const e = window.__spotOf(id);
        const r = { konbini: 1.2, view: 1.0, han: 0.85, train: 1.1, slowlife: 1.1 }[id];
        const res = [];
        for (let a = 0; a < 8; a++) {
          const ang = a * Math.PI / 4, sx = e.x + Math.sin(ang) * 6, sz = e.z + Math.cos(ang) * 6;
          p.pos.set(sx, W.heightAt(sx, sz), sz); p.vel.set(0, 0, 0);
          let best = 99;
          const was = p.locked; p.locked = true; p.suspended = false;
          for (let i = 0; i < 60 * 8; i++) {
            const dx = e.x - p.pos.x, dz = e.z - p.pos.z, d = Math.hypot(dx, dz);
            best = Math.min(best, d);
            if (d < 0.15) break;
            p.yaw = Math.atan2(-dx, -dz); p.keys.clear(); p.keys.add('KeyW');
            p.update(1 / 60);
          }
          p.keys.clear(); p.locked = was;
          res.push(+best.toFixed(2));
        }
        out[id] = { r, closest: res, reachable: res.filter((b) => b < r).length };
      }
      p.scripted = false;
      return out;
    });
    console.log(JSON.stringify(results.reach));
    save();
  }

  if (want('props')) {
    // props in the density registry with no collider round them: what are they, can you walk through?
    const bare = await ev(() => {
      const W = window.__scene.world, F = W.frame;
      return (W.registry ?? []).filter((r) => r.kind !== 'building').map((r) => ({ r, w: F.toWorld({ x: r.x, z: r.z }) }))
        .filter(({ w }) => !W.colliders.some((c) => w.x > c.x0 - 0.15 && w.x < c.x1 + 0.15 && w.z > c.z0 - 0.15 && w.z < c.z1 + 0.15))
        .map(({ r, w }) => ({ kind: r.kind, x: +w.x.toFixed(1), z: +w.z.toFixed(1) }));
    });
    const out = [];
    const picks = bare.filter((_, i) => i % Math.max(1, Math.floor(bare.length / 8)) === 0).slice(0, 8);
    for (const [k, b] of picks.entries()) {
      const r = await ev(({ x, z }) => {
        const { player: p, world: W } = window.__scene;
        // stand 2.5 m off on the freest side, facing it
        for (let a = 0; a < 8; a++) {
          const ang = a * Math.PI / 4, sx = x + Math.sin(ang) * 2.5, sz = z + Math.cos(ang) * 2.5;
          const R = 0.34;
          if (W.colliders.some((c) => (c.top ?? 9) > W.heightAt(sx, sz) + 0.4 && sx > c.x0 - R && sx < c.x1 + R && sz > c.z0 - R && sz < c.z1 + R)) continue;
          p.pos.set(sx, W.heightAt(sx, sz), sz); p.yaw = Math.atan2(-(x - sx), -(z - sz)); p.pitch = -0.25; p.applyCamera(0);
          return { from: [+sx.toFixed(1), +sz.toFixed(1)] };
        }
        return null;
      }, b);
      if (!r) continue;
      await wait(700);
      const shot = await s.shot(`prop-${k}`);
      // walk through it
      const thru = await ev(({ x, z }) => {
        const { player: p, world: W } = window.__scene;
        p.scripted = true; const l = p.locked; p.locked = true; p.keys.clear(); p.keys.add('KeyW');
        for (let i = 0; i < 90; i++) p.update(1 / 60);
        p.keys.clear(); p.locked = l; p.scripted = false;
        return { end: [+p.pos.x.toFixed(2), +p.pos.z.toFixed(2)], passed: Math.hypot(p.pos.x - x, p.pos.z - z) < 0.2 || true };
      }, b);
      out.push({ ...b, ...r, ...thru, shot });
    }
    results.props = { bare: bare.length, sampled: out };
    console.log(JSON.stringify(results.props).slice(0, 1500));
    save();
  }

  if (want('trainpause')) {
    // stand on the platform while a train pulls away, pause, and listen to both contexts
    const r = {};
    await ev(() => window.__scene.world.line.local.service.stage('platform'));
    const sp = await ev(() => window.__spotOf('train'));
    await tp(sp.x + 3, sp.z, 1.57, 0);
    // run the dwell out quickly: jump the platform train to its departure
    await ev(() => { const r0 = window.__scene.world.line.local.service.runs[0]; r0.phase = 'hold'; r0.t = 2.9; r0.doors = 0; });
    await wait(6000);
    r.playing = await ev(async () => ({ run: (({ phase, v }) => ({ phase, v: +v.toFixed(1) }))(window.__scene.world.line.local.service.runs[0]), ctxs: window.__qaAudio.nContexts(), main: await window.__qaAudio.level(0, 1000), trains: await window.__qaAudio.level(1, 1000) }));
    await page.keyboard.press('Space');
    await wait(2500);
    r.paused = await ev(async () => ({ locked: window.__scene.player.locked, run: (({ phase, v }) => ({ phase, v: +v.toFixed(1) }))(window.__scene.world.line.local.service.runs[0]), main: await window.__qaAudio.level(0, 1500), trains: await window.__qaAudio.level(1, 1500) }));
    await page.click('.overlay .menu-action');
    await wait(800);
    results.trainpause = r;
    console.log(JSON.stringify(r));
    save();
  }
} catch (e) { console.error(e); results.crash = String(e.stack || e); } finally { save(); await s.close(); }
