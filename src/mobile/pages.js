import * as THREE from 'three';
import { MOBILE } from '../config.js';

/* ------------------------------------------------------------------ *
 * The konbini's painted pages on a phone (docs/decisions/mobile-lite.md,
 * "Mobile v3: budget").
 *
 * world/store/pages.js paints every page whole (two 3072-wide label pages
 * and the price tags: 150 MB of painting) and copies the mipmap it needs
 * out of each, a far copy and a near one, both kept for good.  On a phone
 * that is the heaviest second of the load, and 24 MB of near copies held
 * wherever you are in town.
 *
 * Here a page is painted straight at the size it is seen at: the same
 * painter (labels.js) under a scaled transform, so the letters are drawn
 * at that size rather than averaged down to it.  The far level is painted
 * once, at load (a sixteenth of the painting, or less); the near level a
 * few cells a frame as you walk up to the store, and let go when you
 * leave.  The levels are the measured ones (store/seen.js), set by
 * planogram.js and main.js exactly as before.
 *
 * world/store/pages.js makePage hands its arguments here in the phone
 * build (a mark in a comment there: vite.config.js miniPlan); the desktop
 * never sees this file.
 * ------------------------------------------------------------------ */

const ANISO = 8;

globalThis.__litePage = ({ name, w, h, steps = 1, paint }, all) => {
  let far = 0, near = 0;
  const wrap = (cv, L) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = ANISO;
    t.name = L ? `${name}@${L}` : name;
    t.userData.size = [w, h];             // (a page: mobile/lite.js packs it into nothing else)
    return t;
  };
  const canvasAt = (L) => {
    const c = document.createElement('canvas');
    // (the light tier's near and whole levels at MOBILE.texScale: what its smaller frame can show)
    const f = (L < 2 ? MOBILE.texScale ?? 1 : 1) / (1 << L);
    c.width = Math.max(1, Math.ceil(w * f)); c.height = Math.max(1, Math.ceil(h * f));
    const ctx = c.getContext('2d');
    ctx.setTransform(c.width / w, 0, 0, c.height / h, 0, 0);
    return { canvas: c, ctx };
  };
  // until the first update: a blank the materials are made with
  const blank = wrap(Object.assign(document.createElement('canvas'), { width: 2, height: 2 }), 0);
  let farTex = null, nearTex = null, job = null;
  const page = {
    name, w, h,
    tex: blank,
    mats: [],
    level: 0,
    get far() { return far; }, get near() { return near; },
    levels(f, n = 0) { if (!farTex) { near = n; far = Math.max(f, n); } return page; },
    adopt(m) { m.map = page.tex; page.mats.push(m); return m; },
    get busy() { return !!job; },
    update,
    /** A lost GPU context took every copy: painted again at the next update. */
    reset() { farTex?.dispose(); nearTex?.dispose(); farTex = nearTex = job = null; },
  };
  const show = (t, level) => {
    page.level = level;
    if (page.tex === t) return;
    page.tex = t;
    for (const m of page.mats) m.map = t;
  };
  const whole = (L) => { const { canvas, ctx } = canvasAt(L); paint(ctx, 0, steps); return wrap(canvas, L); };
  function update(want, now = false) {
    let heavy = false;
    if (!farTex) { farTex = whole(far); blank.dispose(); heavy = true; }
    // a page that is always one size (never levelled, or the same near and far)
    if (near === far) { show(farTex, far); return heavy; }
    if (want !== 'near') {
      job = null;
      show(farTex, far);
      if (nearTex) { nearTex.dispose(); nearTex.image.width = nearTex.image.height = 1; nearTex = null; }
      return heavy;
    }
    if (!nearTex) {
      job ??= { ...canvasAt(near), at: 0 };
      const t0 = performance.now();
      while (job.at < steps) {
        const to = Math.min(steps, job.at + 4);
        paint(job.ctx, job.at, to);
        job.at = to;
        if (!now && job.at < steps && performance.now() - t0 > 6) return true;
      }
      nearTex = wrap(job.canvas, near);
      job = null;
      heavy = true;
    }
    show(nearTex, near);
    return heavy;
  }
  all.push(page);
  return page;
};
