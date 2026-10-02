/* Dev only: the z-fighting detector's half in the page (scripts/_zfight.mjs).
 *
 * Two faces in one plane (or nearly) win pixel by pixel by rounding, and
 * which one wins changes with the least camera movement: the surface
 * flickers, "pixelated".  So: stand the camera in a pose with time frozen
 * (?shots), draw the same frame N times with the camera moved a fifth of a
 * millimetre between each, and count the pixels that change.  A real edge
 * moves a few hundredths of a pixel over the whole run and a pixel on it
 * changes at most once; a z-fighting patch flips back and forth.
 *
 *   changed   pixels that differed between any two consecutive frames
 *   flicker   pixels that did so twice or more (the flip-flop: the signal)
 *   solid     flickering pixels in a 2 x 2 block of them: an area that fights, not the one row of pixels
 *             that flips where two surfaces meet along a line (the check's pass or fail)
 *   perFrame  [min, max] changed pixels between consecutive frames
 *   boxes     where: connected regions, biggest first, each with what a ray
 *             through its worst pixel hits (two hits a few mm apart = the pair)
 *
 * `mode: 'near'` moves nothing: it nudges the near plane instead, which
 * re-rounds every depth and leaves every edge where it was (the pure signal,
 * for hunting; the default is the camera jitter, what a player's eye does).
 */
import * as THREE from 'three';

const CELL = 8;

/**
 * @param g     { scene, camera, renderer, pipeline, world, sky, canvas }
 * @param pose  { shot: options for window.__shot, car?: { i, at: [x, h, z], to: [x, h, z] } (in a staged train's car:
 *                x along the car, h above its floor, z across), eye?: [x, y, z], look?: [x, y, z] (world) }
 * @param o     { frames, step (m), thr, W, H, mode, probe }
 */
export async function zfight(g, pose, o = {}) {
  const { scene, camera, pipeline, world, sky, canvas } = g;
  const { frames = 12, step = 0.0002, thr = 16, W = 1280, H = 720, mode = 'near', probe = 4 } = o;
  const shot = { ...pose.shot, returnData: true, png: false, quality: 0.5, scale: 1 };
  // twice, a moment apart: a place that loads as you come near has loaded by the second
  await window.__shot('z', W, H, shot);
  await new Promise((r) => setTimeout(r, pose.settle ?? 120));
  const info = await window.__shot('z', W, H, shot);

  /* ---- the camera: the shot's own, or an eye and a point to look at ---- */
  let eye = pose.eye, look = pose.look;
  if (pose.car) {
    const slot = world.line?.fleet?.slots?.[pose.car.slot ?? 0] ?? world.line?.service?.runs?.[pose.car.slot ?? 0]?.emu;
    const grp = slot?.group;
    if (!grp) return { error: 'no train staged' };
    grp.updateMatrixWorld(true);
    const cx = slot.carX[pose.car.i].x, FLOOR = 1.06;
    const P = ([x, h, z]) => grp.localToWorld(new THREE.Vector3(cx + x, FLOOR + h, z)).toArray();
    eye = P(pose.car.at); look = P(pose.car.to);
  }
  if (eye) {
    camera.position.fromArray(eye);
    camera.lookAt(new THREE.Vector3().fromArray(look));
  }
  camera.updateMatrixWorld(true);
  const base = camera.position.clone();
  const near0 = camera.near;
  // the jitter's way: mostly across the view, a little up and forward
  const dir = new THREE.Vector3(0.74, 0.6, -0.3).normalize().applyQuaternion(camera.quaternion);

  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  const grab = () => { ctx.drawImage(canvas, 0, 0, W, H); return ctx.getImageData(0, 0, W, H).data; };

  const n = W * H;
  const trans = new Uint8Array(n), worst = new Uint8Array(n);
  const per = [];
  let first = null, prev = null;
  for (let k = 0; k < frames; k++) {
    if (mode === 'near') {
      camera.near = near0 * (1 + k * 2e-4);
      camera.updateProjectionMatrix();
    } else {
      camera.position.copy(base).addScaledVector(dir, k * step);
      camera.updateMatrixWorld(true);
    }
    sky.dome.position.copy(camera.position);
    sky.clouds.position.copy(camera.position);
    pipeline.render();
    const cur = grab();
    if (prev) {
      let c = 0;
      for (let p = 0, i = 0; p < n; p++, i += 4) {
        const d = Math.max(Math.abs(cur[i] - prev[i]), Math.abs(cur[i + 1] - prev[i + 1]), Math.abs(cur[i + 2] - prev[i + 2]));
        if (d > thr) { trans[p]++; c++; if (d > worst[p]) worst[p] = d; }
      }
      per.push(c);
    } else first = cur;
    prev = cur;
  }
  camera.near = near0;
  camera.updateProjectionMatrix();
  camera.position.copy(base);
  camera.updateMatrixWorld(true);

  /* ---- count, and gather the changed pixels into regions ---- */
  // `solid`: flickering pixels in a 2 x 2 block of them.  Where two surfaces meet along a line (a slat standing on
  // a plinth, a rail on its sleepers) one row of pixels flips, as any edge does; a fight covers an area.
  const blk = new Uint8Array(n);
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const p = y * W + x;
    if (trans[p] >= 2 && trans[p + 1] >= 2 && trans[p + W] >= 2 && trans[p + W + 1] >= 2) blk[p] = blk[p + 1] = blk[p + W] = blk[p + W + 1] = 1;
  }
  let solid = 0;
  for (let p = 0; p < n; p++) solid += blk[p];
  let changed = 0, flicker = 0;
  const gw = Math.ceil(W / CELL), gh = Math.ceil(H / CELL);
  const cell = new Uint16Array(gw * gh);
  for (let p = 0; p < n; p++) {
    if (!trans[p]) continue;
    changed++;
    if (trans[p] >= 2) flicker++;
    cell[((p / W | 0) / CELL | 0) * gw + ((p % W) / CELL | 0)]++;
  }
  const label = new Int32Array(gw * gh).fill(-1);
  const boxes = [];
  for (let c0 = 0; c0 < cell.length; c0++) {
    if (!cell[c0] || label[c0] >= 0) continue;
    const id = boxes.length, stack = [c0];
    const b = { x0: 1e9, y0: 1e9, x1: -1, y1: -1, cells: 0 };
    label[c0] = id;
    while (stack.length) {
      const c = stack.pop(), cx = c % gw, cy = c / gw | 0;
      b.cells++;
      b.x0 = Math.min(b.x0, cx); b.x1 = Math.max(b.x1, cx); b.y0 = Math.min(b.y0, cy); b.y1 = Math.max(b.y1, cy);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
        const q = y * gw + x;
        if (cell[q] && label[q] < 0) { label[q] = id; stack.push(q); }
      }
    }
    boxes.push(b);
  }
  for (const b of boxes) {
    b.x0 *= CELL; b.y0 *= CELL; b.x1 = Math.min(W, (b.x1 + 1) * CELL); b.y1 = Math.min(H, (b.y1 + 1) * CELL);
    b.changed = 0; b.flicker = 0; b.solid = 0;
    let best = -1, bp = 0;
    for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) {
      const p = y * W + x;
      if (!trans[p]) continue;
      b.changed++;
      if (trans[p] >= 2) b.flicker++;
      b.solid += blk[p];
      const score = blk[p] * 65536 + trans[p] * 256 + worst[p];
      if (score > best) { best = score; bp = p; }
    }
    b.at = [bp % W, bp / W | 0];
    delete b.cells;
  }
  boxes.sort((a, b) => b.solid - a.solid || b.flicker - a.flicker || b.changed - a.changed);

  /* ---- what is there: a ray through each region's worst pixel ---- */
  const ray = new THREE.Raycaster();
  const describe = (h) => {
    const chain = [];
    let q = h.object;
    while (q && chain.length < 4) { if (q.name) chain.push(q.name); q = q.parent; }
    // a batch (world/merge.js) remembers, in dev, which part each run of vertices came from
    const src = h.object.userData.src;
    if (src && h.face) { let v = h.face.a; for (const s of src) { if (v < s.n) { chain.unshift(`[${s.name}]`); break; } v -= s.n; } }
    const m = Array.isArray(h.object.material) ? h.object.material[h.face?.materialIndex ?? 0] : h.object.material;
    const col = m?.color ? '#' + m.color.getHexString() : '';
    const nrm = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld).toArray().map((v) => +v.toFixed(2)) : null;
    return {
      d: +h.distance.toFixed(4), what: chain.join('<') || h.object.type, mat: `${m?.name || m?.type || ''} ${col}${m?.map ? ' map' : ''}${m?.transparent ? ' transparent' : ''}`,
      at: h.point.toArray().map((v) => +v.toFixed(3)), n: nrm,
      local: h.object.worldToLocal(h.point.clone()).toArray().map((v) => +v.toFixed(3)),      // in the mesh's own frame (a train's: along, up, across)
    };
  };
  for (const b of boxes.slice(0, probe)) {
    ray.setFromCamera(new THREE.Vector2((b.at[0] + 0.5) / W * 2 - 1, 1 - (b.at[1] + 0.5) / H * 2), camera);
    const matOf = (h) => (Array.isArray(h.object.material) ? h.object.material[h.face?.materialIndex ?? 0] : h.object.material);
    const solid = (h) => { const m = matOf(h); return m && m.depthWrite !== false; };      // (glass and glints are looked through)
    const shown = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
    // mesh by mesh: one whose vertices were handed to the GPU and dropped cannot be probed, and is skipped
    const hits = [];
    scene.traverse((obj) => {
      if (!obj.isMesh || !shown(obj) || obj.material?.visible === false) return;
      try { hits.push(...ray.intersectObject(obj, false)); } catch { /* no CPU copy */ }
    });
    hits.sort((a, b) => a.distance - b.distance);
    // the first two faces within 4 mm of each other, up to the first solid face: the pair that fights.
    // Failing that, whatever lies within 5 cm of the first solid face.
    const s0 = hits.findIndex(solid);
    const upTo = s0 < 0 ? hits.length : hits.findIndex((h, i) => i > s0 && h.distance - hits[s0].distance > 0.004);
    const front = hits.slice(0, upTo < 0 ? hits.length : upTo);
    const p0 = front.findIndex((h, i) => front[i + 1] && front[i + 1].distance - h.distance < 0.004);
    const d0 = (p0 >= 0 ? front[p0] : hits[Math.max(0, s0)])?.distance ?? 0;
    b.hits = hits.filter((h) => h.distance >= d0 - 1e-6 && h.distance - d0 < (p0 >= 0 ? 0.004 : 0.05)).slice(0, 5).map(describe);
  }

  /* ---- the still, and the mask: the frame dimmed, once-changed pixels amber, flickering ones magenta ---- */
  const img = ctx.createImageData(W, H);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const t = trans[p];
    img.data[i] = t >= 2 ? 255 : t ? 255 : first[i] * 0.35;
    img.data[i + 1] = t >= 2 ? 0 : t ? 190 : first[i + 1] * 0.35;
    img.data[i + 2] = t >= 2 ? 255 : t ? 0 : first[i + 2] * 0.35;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const mask = changed ? off.toDataURL('image/png') : null;
  img.data.set(first);
  ctx.putImageData(img, 0, 0);
  const still = off.toDataURL('image/jpeg', 0.88);

  return {
    changed, flicker, solid, perFrame: [Math.min(...per), Math.max(...per)],
    boxes: boxes.slice(0, 8).map((b) => ({ box: [b.x0, b.y0, b.x1, b.y1], changed: b.changed, flicker: b.flicker, solid: b.solid, at: b.at, hits: b.hits })),
    regions: boxes.length, calls: info.calls, triangles: info.triangles,
    eye: base.toArray().map((v) => +v.toFixed(2)), mask, still,
  };
}
