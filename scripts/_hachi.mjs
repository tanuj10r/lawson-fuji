// dev check: Hachi's reactions (animals/reactions.js), seen.  Contact sheets, a close lens on the pup:
//
//   node scripts/_hachi.mjs [outdir] [--only reactions,konbini,pigeons,after,roll,rest]
//
//     reactions  each reaction of the library, played where the pup stands in front of you: six frames across it
//     rest       the pup with nothing playing, standing, sat and lying: every expression channel at 0 (as before)
//     roll       the idle roll and each konbini bit, with the pup's lowest drawn point over the ground (the surface)
//     konbini    the real visit for each of the five things you can have: your view (top) and a close lens on the
//                pup (bottom) from the till to the end of its bit
//     pigeons    leading you down the shopping street: the bow, the charge, the lap, the birds going up
//     after      the tour over: whistled off its bench, at your side, the "Take the tour again" prompt, the tour again
//
// Starts its own dev server and Chrome (one browser at a time on this machine: the shots lock, and
// /tmp/lawson-browser.lock) and closes both however it ends.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : null; };
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--only') ?? path.join(ROOT, '.shots', 'hachi'));
const ONLY = opt('only')?.split(',') ?? null;
const want = (k) => !ONLY || ONLY.includes(k);
fs.mkdirSync(out, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// one browser at a time on the shared laptop (taken first: a run that holds it may be queued on the shots lock)
const BLOCK = '/tmp/lawson-browser.lock';
let mineB = false;
for (let k = 0; ; k++) {
  try { fs.mkdirSync(BLOCK); mineB = true; break; } catch { if (k % 6 === 0) console.log('  waiting for the browser lock'); await sleep(10000); }
}
const LOCK = path.join(os.tmpdir(), 'takemebacktojapan-shots.lock');
for (;;) {
  try { fs.mkdirSync(LOCK); fs.writeFileSync(path.join(LOCK, 'pid'), String(process.pid)); break; } catch {
    let pid = 0, alive = false;
    try { pid = +fs.readFileSync(path.join(LOCK, 'pid'), 'utf8'); } catch {}
    try { if (pid) { process.kill(pid, 0); alive = true; } } catch {}
    if (!alive) { fs.rmSync(LOCK, { recursive: true, force: true }); continue; }
    console.log(`  waiting for another run (pid ${pid})`);
    await sleep(5000);
  }
}
const unlock = () => {
  try { if (+fs.readFileSync(path.join(LOCK, 'pid'), 'utf8') === process.pid) fs.rmSync(LOCK, { recursive: true, force: true }); } catch {}
  if (mineB) { try { fs.rmdirSync(BLOCK); } catch {} mineB = false; }
};
process.on('exit', unlock);

const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), logLevel: 'error', server: { port: +process.env.PORT || 5189, strictPort: true, host: '127.0.0.1' } });
await server.listen();
const base = server.resolvedUrls.local[0];
const flags = ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: flags });
const close = async () => { await Promise.race([browser.close().then(() => server.close()), sleep(8000)]).catch(() => {}); };
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await close(); process.exit(130); });

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(180000);
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });

/* in the page: the tools every sheet uses */
const TOOLS = () => {
  const g = window.__guide, S = g.G, world = window.__scene.world, player = window.__scene.player, camera = window.__scene.camera;
  const H = (window.__hachi = {});
  H.dt = 1 / 30;
  /** the player stands at (x, z) looking at (tx, tz) */
  H.stand = (x, z, tx, tz) => { player.pos.set(x, world.heightAt(x, z), z); player.yaw = Math.atan2(-(tx - x), -(tz - z)); player.pitch = 0; player.applyCamera(0); };
  /** the world on by `secs` (the pup, the pigeons, everything), the player where it is */
  H.run = (secs, each = null) => { for (let t = 0; t < secs - 1e-6; t += H.dt) { player.applyCamera(0); world.update(H.dt, camera); each?.(t); } };
  /** a frame: the player's own view (`zoom` false), or a close lens from the player's eye on the pup */
  H.frame = async (zoom = true, W = 480, Hh = 300, vfov = 9, lift = -1.0) => {
    const keep = { yaw: player.yaw, pitch: player.pitch };
    const o = { returnData: true, look: 'day', quality: 0.8 };
    if (zoom) {
      const dx = S.x - camera.position.x, dz = S.z - camera.position.z, d = Math.hypot(dx, dz);
      o.yaw = Math.atan2(-dx, -dz); if (lift) o.lift = lift; o.pitch = Math.atan2(S.y + 0.2 - (camera.position.y + lift), d); o.vfov = Math.max(5, Math.min(40, vfov * 4.5 / Math.max(1.5, d)));   // (from knee height: its face)
    }
    const r = await window.__shot('f', W, Hh, o);
    player.yaw = keep.yaw; player.pitch = keep.pitch; player.applyCamera(0);
    return r.data;
  };
  /** a sheet: rows of [label, [dataURL...]] */
  H.sheet = async (title, rows, W = 480, Hh = 300) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; });
    // (no more than five across: a row with more wraps)
    rows = rows.flatMap(([label, fr]) => { const o = []; for (let k = 0; k < fr.length; k += 5) o.push([k ? '' : label, fr.slice(k, k + 5)]); return o; });
    const cols = Math.max(...rows.map((r) => r[1].length)), pad = 26;
    const cv = document.createElement('canvas');
    cv.width = cols * W; cv.height = 34 + rows.length * (Hh + pad);
    const c = cv.getContext('2d');
    c.fillStyle = '#15131c'; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#fff'; c.font = 'bold 20px sans-serif'; c.fillText(title, 8, 23);
    for (let k = 0; k < rows.length; k++) {
      const y = 34 + k * (Hh + pad);
      c.fillStyle = '#ffd9a0'; c.font = '15px sans-serif'; c.fillText(rows[k][0], 8, y + 17);
      for (let j = 0; j < rows[k][1].length; j++) c.drawImage(await load(rows[k][1][j]), j * W, y + pad, W, Hh);
    }
    return cv.toDataURL('image/jpeg', 0.86);
  };
  /** the pup `d` m in front of the player, facing `yawOff` off them, standing still, nothing playing; the tour parked */
  H.pup = (d = 3.2, yawOff = 0.5, state = 'staged') => {
    g.reset(); g.introMark();
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    const c = g.walk.nearest(player.pos.x + fx * d, player.pos.z + fz * d, 2), q = g.walk.at(c);
    Object.assign(S, { x: q.x, z: q.z, state, since: 10, waitT: 0, posture: 0, speed: 0, yaw: Math.atan2(player.pos.x - q.x, player.pos.z - q.z) + yawOff, idleT: -999, tiltNext: 999 });
    g.RX.lookNext = 999; g.RX.petal = 999; g.RX.yawned = 99;
    player.applyCamera(0); world.update(0, camera);
  };
};

const save = (name, data) => { const p = path.join(out, name); fs.writeFileSync(p, Buffer.from(data.split(',')[1], 'base64')); console.log('  wrote', p); };
let bad = 0;
const check = (ok, label, detail) => { if (!ok) bad++; console.log(ok ? 'pass' : 'FAIL', label, detail === undefined ? '' : JSON.stringify(detail)); };

try {
  await page.goto(`${base}?shots`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 150000, polling: 250 });
  await page.evaluate(TOOLS);

  if (want('rest')) {
    const r = await page.evaluate(async () => {
      const H = window.__hachi, g = window.__guide;
      H.stand(7.5, 19.0, 3, 19.0);
      const frames = [], vals = [], lows = [];
      for (const [posture, yaw] of [[0, 0.6], [1, 0.3], [2, 0.6]]) {
        H.pup(2.6, yaw);
        // (no blink in the frame: the rest pose itself)
        g.stage(posture === 0 ? 'stand' : posture === 1 ? 'sit' : 'lie', window.__scene.player, 2.6);
        lows.push(g.lowest().low);
        const o = g.fx.out;
        vals.push([...o.c, ...o.d, ...o.e]);
        frames.push(await H.frame(true));
      }
      return { sheet: await H.sheet('at rest: every expression channel 0 (stand, sit, lie)', [['', frames]]), vals, lows };
    });
    console.log('  lowest point at rest (stand, sit, lie):', r.lows);
    save('rest.jpg', r.sheet);
    check(r.vals.every((v) => v.every((x) => x === 0)), 'rest: all expression channels 0', r.vals);
  }

  if (ONLY?.includes('profile')) {
    // (tuning: the pup's lowest point against its roll, lying and standing, with the tables at 0: what comes out is config.js ANIMALS.guide.rollUp, negated)
    const r = await page.evaluate(() => {
      const H = window.__hachi, g = window.__guide, S = g.G, U = g.A.rollUp, keep = { stand: [...U.stand], lie: [...U.lie] };
      H.stand(7.5, 19.0, 3, 19.0);
      const out = {};
      for (const posture of [2, 0]) for (const nod of [-0.2, 0.3]) {
        U.stand.fill(0); U.lie.fill(0);
        const row = [];
        for (let roll = 0; roll <= 3.3; roll += 0.3) {
          // (ears back, as it has them on its back; the legs paddling: the lowest of four strides' phases)
          let low = 9;
          for (const ph of [0, 1.6, 3.1, 4.7]) {
            g.stage('stand', window.__scene.player, 2.6);
            Object.assign(S, { posture, roll, nod, perk: 0.4, amp: roll > 0.2 ? 0.8 : 0, ph });
            g.stage2();
            low = Math.min(low, g.lowest().low);
          }
          row.push([+roll.toFixed(1), low]);
        }
        out[`posture ${posture} nod ${nod}`] = row.map((q) => q.join(':')).join('  ');
      }
      keep.stand.forEach((v, i) => { U.stand[i] = v; }); keep.lie.forEach((v, i) => { U.lie[i] = v; });
      return out;
    });
    console.log(r);
  }

  if (ONLY?.includes('rolltrace')) {
    const r = await page.evaluate(() => {
      const H = window.__hachi, g = window.__guide, S = g.G;
      H.stand(7.5, 19.0, 3, 19.0); H.pup(4.5, 1.4, 'wait'); H.run(0.3);
      S.act = { name: 'roll', t: 0, dur: 4.2 };
      const out = [];
      for (let k = 0; k < 130; k++) { H.run(H.dt); if (k % 4 === 0) out.push(`${(k / 30).toFixed(2)} p${S.posture.toFixed(2)} r${S.roll.toFixed(2)} ${g.lowest().low}`); }
      return out;
    });
    console.log(r.join('\n'));
  }

  if (want('reactions')) {
    const list = ['headTilt', 'petal', 'sniff', 'sneeze', 'yawn', 'slowBlink', 'startle', 'scared', 'shakeOff', 'brave', 'tippyTaps', 'happyWiggle', 'hopSpin', 'puppyEyes', 'beg', 'lick', 'bigSmile', 'proudStrut', 'pleased', 'freeze', 'dream'];
    for (let part = 0; part * 7 < list.length; part++) {
      const r = await page.evaluate(async (names) => {
        const H = window.__hachi, g = window.__guide, S = g.G;
        H.stand(7.5, 19.0, 3, 19.0);
        const rows = [], lows = {};
        for (const name of names) {
          H.pup(2.8, name === 'proudStrut' ? 1.3 : 0.45);
          H.run(0.4);
          const D = g.fx.play(name, { s: 1 });
          const frames = [];
          let low = 9, t = 0;
          for (let k = 0; k < 6; k++) {
            const until = D * (k + 0.6) / 6;
            H.run(until - t, () => { const l = g.lowest(); if (l && l.low < low) low = l.low; }); t = until;
            frames.push(await H.frame(true));
          }
          lows[name] = +low.toFixed(3);
          rows.push([`${name}  (${D.toFixed(1)} s; lowest point ${low.toFixed(3)} m over the ground)`, frames]);
          H.run(0.6);
        }
        return { sheet: await H.sheet('Hachi: reactions in play (a close lens from where you stand)', rows), lows };
      }, list.slice(part * 7, part * 7 + 7));
      save(`reactions-${part + 1}.jpg`, r.sheet);
      check(Object.values(r.lows).every((v) => v > -0.02 && v < 0.2), `reactions ${part + 1}: on the surface`, r.lows);
    }
  }

  if (want('roll')) {
    const r = await page.evaluate(async () => {
      const H = window.__hachi, g = window.__guide, S = g.G;
      H.stand(7.5, 19.0, 3, 19.0);
      const rows = [], lows = {};
      // the idle roll (an act), then each konbini bit's end, the pup side-on
      const bits = [['roll (idle act)', () => { S.act = { name: 'roll', t: 0, dur: 4.2 }; return 4.2; }]];
      for (const id of ['strong_nine', 'sando_egg', 'fruit_sando', 'onigiri_tuna', 'choco_wafer_jumbo']) bits.push([`${id}: after`, () => { g.snack('done', id); return null; }]);
      for (const [label, start] of bits) {
        H.pup(4.5, 1.4, 'wait');
        H.run(0.3);
        let D = start();
        if (D === null) { for (let k = 0; k < 200 && S.snack?.bit !== 'after'; k++) H.run(H.dt); D = S.snack ? S.snack.end - S.snack.t : 3; }
        const frames = [];
        let low = 9, hi = 0, t = 0;
        for (let k = 0; k < 7; k++) {
          const until = D * (k + 0.5) / 7;
          H.run(until - t, () => { const l = g.lowest(); if (l) { if (l.low < low) low = l.low; if (l.low > hi) hi = l.low; } }); t = until;
          frames.push(await H.frame(true));
        }
        lows[label] = [+low.toFixed(3), +hi.toFixed(3)];
        rows.push([`${label}  (lowest point of the pup, over the ground: ${low.toFixed(3)} .. ${hi.toFixed(3)} m)`, frames]);
        H.run(1);
      }
      return { sheet: await H.sheet('Hachi stays on the surface: the roll, and each konbini bit\'s end', rows), lows };
    });
    save('surface.jpg', r.sheet);
    check(Object.values(r.lows).every(([lo]) => lo > -0.02), 'roll and bits: nothing under the ground (lowest point over it, min..max m)', r.lows);
  }

  if (want('konbini')) {
    for (const id of ['strong_nine', 'sando_egg', 'fruit_sando', 'onigiri_tuna', 'choco_wafer_jumbo']) {
      const r = await page.evaluate(async (id) => {
        const H = window.__hachi, g = window.__guide, S = g.G, shop = window.__store.shop, player = window.__scene.player, world = window.__scene.world;
        const SP = shop.spot?.world ?? { x: -2.3, z: 2.3 };
        // the pup waits by the ring, as on the tour; you step on the spot and choose
        H.stand(SP.x, SP.z + 0.05, SP.x + 0.6, SP.z + 12);
        g.reset(); g.introMark();
        const c = g.walk.nearest(SP.x + 2.2, SP.z + 1.4, 2), q = g.walk.at(c);
        Object.assign(S, { x: q.x, z: q.z, state: 'wait', idleT: -999 });
        H.run(0.5);
        if (!shop.play(id)) return { error: 'no visit' };
        const full = [], zoom = [], notes = [];
        let low = 9, phase = null, tPhase = 0, guard = 0, seen = 0, frames = 0;
        const marks = { hold: [0.5, 2.2], eat: [0.6, 1.25, 2.0, 2.9], done: id === 'strong_nine' ? [0.6, 1.6, 3.2, 4.6, 6.0, 7.4, 8.6] : [0.5, 1.4, 2.3, 3.2, 4.0] };
        let due = [];
        while (guard++ < 3000) {
          // the visit steps itself inside __shot (the shop's own clock); between frames, a tick at a time
          await window.__shot('s', 64, 36, { shop: 1 / 30, stepWorld: true, returnData: true, quality: 0.1 });
          const ph = S.state === 'snack' ? S.snack?.phase : null;
          if (ph !== phase) { phase = ph; tPhase = 0; due = [...(marks[ph] ?? [])]; if (ph === null && full.length) break; }
          tPhase += 1 / 30;
          if (phase === 'eat' || phase === 'done') {
            const l = g.lowest(); if (l && l.low < low) low = l.low;
            // in your view?
            frames++;
            const cam = window.__scene.camera, v = new window.__scene.THREE.Vector3(S.x, S.y + 0.15, S.z).project(cam);
            if (Math.abs(v.x) < 0.98 && Math.abs(v.y) < 0.98 && v.z < 1) seen++;
          }
          if (due.length && tPhase >= due[0]) {
            due.shift();
            notes.push(`${phase} ${tPhase.toFixed(1)}s`);
            full.push((await window.__shot('s', 480, 300, { returnData: true, quality: 0.8 })).data);
            zoom.push(await H.frame(true, 480, 300, 9, 0));
          }
        }
        const end = { state: S.state, d: +Math.hypot(S.x - player.pos.x, S.z - player.pos.z).toFixed(1) };
        return { sheet: await H.sheet(`${id}: your view, then a close lens on Hachi  [${notes.join(' | ')}]   lowest point ${low.toFixed(3)} m`, [['your view', full], ['close', zoom]]), low: +low.toFixed(3), seen: +(seen / Math.max(1, frames)).toFixed(2), end, n: full.length };
      }, id);
      if (r.error) { check(false, `konbini ${id}`, r); continue; }
      save(`konbini-${id}.jpg`, r.sheet);
      check(r.low > -0.02 && r.seen > 0.8 && r.n >= 9, `konbini ${id}: its bit, in your view, on the surface`, { low: r.low, seen: r.seen, frames: r.n, end: r.end });
      await page.evaluate(() => { const p = window.__scene.player; p.scripted = false; p.suspended = false; });
    }
  }

  if (want('pigeons')) {
    const r = await page.evaluate(async () => {
      const H = window.__hachi, g = window.__guide, S = g.G, player = window.__scene.player, world = window.__scene.world;
      const flocks = g.pigeons.flocks.map((f) => ({ ...world.frame.toWorld({ x: f.x, z: f.z }), f }));
      const out = [];
      for (const F of flocks) {
        // you follow it down the street toward the flock, 6 m behind
        const from = { x: F.x, z: F.z + 17 };
        H.stand(from.x, from.z + 6, F.x, F.z);
        g.reset(); g.introMark();
        const A = g.A, k = A.tour.findIndex((L) => Math.hypot(L.x - F.x, L.z - F.z) < 6);
        const c = g.walk.nearest(from.x, from.z, 3), q = g.walk.at(c);
        Object.assign(S, { x: q.x, z: q.z, state: 'home', leg: Math.max(1, k) });
        for (const id of ['konbini', 'han']) S.done.add(id);
        const frames = [], notes = [];
        let phase = null, t = 0, grounded0 = F.f.grounded(), minGrounded = 99, charged = false, tEnd = null, right = null;
        const marks = { wind: [0.3], run: [0.25, 0.7], lap: [0.3, 0.9, 1.6, 2.2], pleased: [0.5, 1.5] };
        let due = [], tp = 0;
        while (t < 40) {
          // walk after it
          const dx = S.x - player.pos.x, dz = S.z - player.pos.z, d = Math.hypot(dx, dz);
          player.yaw = Math.atan2(-dx, -dz);
          if (d > 5) { player.pos.x += dx / d * 2.4 * H.dt; player.pos.z += dz / d * 2.4 * H.dt; }
          H.run(H.dt); t += H.dt;
          const ph = S.state === 'charge' ? S.charge?.phase : null;
          if (ph !== phase) { phase = ph; tp = 0; due = [...(marks[ph] ?? [])]; if (ph) { charged = true; right = Math.hypot(S.charge.at.x - F.x, S.charge.at.z - F.z) < 1; } if (!ph && charged) { tEnd = t; break; } }
          tp += H.dt;
          minGrounded = Math.min(minGrounded, F.f.grounded());
          if (due.length && tp >= due[0]) { due.shift(); notes.push(`${phase} ${tp.toFixed(1)}s`); frames.push((await window.__shot('s', 480, 300, { returnData: true, quality: 0.8, pitch: -0.12 })).data); }
        }
        H.run(1.5);
        out.push({ frames, notes, grounded0, minGrounded, charged, right, after: S.state, tEnd });
        // (the birds back down for the next: they come back once you are away)
        H.stand(0, 11, 0, 0); H.run(40);
      }
      const rows = out.map((o, i) => [`flock ${i + 1}: ${o.notes.join(' | ')}   (on the ground: ${o.grounded0} -> ${o.minGrounded}; then Hachi: ${o.after})`, o.frames]);
      return { sheet: rows.length ? await H.sheet('Hachi and the pigeons (your view, following it)', rows) : null, out: out.map(({ frames, ...o }) => o) };
    });
    if (r.sheet) save('pigeons.jpg', r.sheet);
    check(r.out.length > 0 && r.out.every((o) => o.charged && o.right && o.grounded0 >= 3 && o.minGrounded === 0 && o.after === 'lead'), 'pigeons: it charges each flock, they all go up, the tour goes on', r.out);
  }

  if (want('after')) {
    const r = await page.evaluate(async () => {
      const H = window.__hachi, g = window.__guide, S = g.G, player = window.__scene.player, hud = document.querySelector('.prompt');
      g.reset(); g.introMark();
      const Bn = g.bench;
      const fx = Bn.nap.x - Bn.x, fz = Bn.nap.z - Bn.z, fl = Math.hypot(fx, fz), F = { x: fx / fl, z: fz / fl };
      H.stand(Bn.x + F.x * 4.5, Bn.z + F.z * 4.5, Bn.x, Bn.z);
      const c = g.walk.nearest(Bn.nap.x + F.x * 2, Bn.nap.z + F.z * 2, 3), q = g.walk.at(c);
      Object.assign(S, { x: q.x, z: q.z });
      g.napNow();
      const frames = [], notes = [];
      const snap = async (label, zoom = false) => { notes.push(label); frames.push(zoom ? await H.frame(true) : (await window.__shot('s', 480, 300, { returnData: true, quality: 0.8, pitch: -0.2 })).data); };
      for (let k = 0; k < 600 && S.bed?.phase !== 'sleep'; k++) H.run(H.dt);
      H.run(2);
      await snap('asleep on its bench (eyes shut)', true);
      g.whistle();
      for (let k = 0; k < 400 && S.state !== 'pal'; k++) H.run(H.dt);
      const pal = S.state;
      H.run(1.5);
      await snap('whistled: it comes and stays');
      // a walk together
      const yaw0 = player.yaw + Math.PI / 2;
      let far = 0;
      for (let k = 0; k < 150; k++) { player.pos.x += -Math.sin(yaw0) * 2.4 * H.dt; player.pos.z += -Math.cos(yaw0) * 2.4 * H.dt; player.yaw = yaw0; H.run(H.dt); far = Math.max(far, Math.hypot(S.x - player.pos.x, S.z - player.pos.z)); if (k === 110) await snap('you walk: at your side'); }
      for (let k = 0; k < 150; k++) H.run(H.dt);
      // look at it
      player.yaw = Math.atan2(-(S.x - player.pos.x), -(S.z - player.pos.z)); H.run(0.5);
      const offer = g.offer(), why = { state: S.state, act: S.act?.name ?? null, speed: S.speed, d: Math.hypot(S.x - player.pos.x, S.z - player.pos.z) };
      await snap('you stop: it sits by you (E on offer: ' + offer + ')', true);
      const ok = g.again();
      H.run(1.0);
      await snap('the tour again: a spin, and off', true);
      H.run(3);
      const st = g.state();
      await snap('leading to the first place again');
      return { sheet: await H.sheet('After the tour: ' + notes.join(' | '), [['', frames]]), pal, far: +far.toFixed(1), offer, why, ok, st: { state: st.state, target: st.target, leg: st.leg, done: st.done } };
    });
    save('after.jpg', r.sheet);
    check(r.pal === 'pal' && r.far < 9 && r.offer && r.ok && r.st.state === 'lead' && r.st.target === 'konbini', 'after the tour: yours when whistled, on offer, the tour again', { pal: r.pal, far: r.far, offer: r.offer, why: r.why, again: r.ok, st: r.st });
  }
} finally {
  if (errs.length) { console.log('page errors:'); for (const e of errs.slice(0, 10)) console.log('  ', e); }
  await close();
}
if (bad || errs.length) process.exitCode = 1;
