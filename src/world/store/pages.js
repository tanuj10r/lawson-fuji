import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/* ------------------------------------------------------------------ *
 * The store's big painted pages, held at the size they are seen at
 * (the lean konbini; DECISIONS.md, "The konbini, only what is seen").
 *
 * The product labels are two 3072-wide pages and the price tags a
 * 2048 x 5472 one: 150 MB on the GPU with their mipmaps, and as much
 * again in the canvases they were painted on.  They are sized for
 * standing at the shelf, which you only do during a visit.  From the
 * street the GPU never samples anything but their smaller mipmaps.
 *
 * So a page lives at a level: 0 is the painting itself, L is its
 * mipmap L and what follows it.  A level above 0 is made on the GPU,
 * texel for texel out of the painting's own mipmap (a copy of level L
 * into a texture of its own, its chain made the same way the painting's
 * was), so what is drawn is what was drawn before, to the pixel,
 * wherever the sampler would have kept to level L and up
 * (store/seen.js: measured, with a margin).
 *
 *   far    the level kept while you are away from the store (always held)
 *   near   the level on the forecourt and inside; 0 means the painting,
 *          which is painted and uploaded again as you walk up (a few
 *          cells a frame) and let go when you leave
 *
 * The canvas is given back as soon as the GPU has it.  Until the first
 * frame has gone by (there is no renderer to ask before it) a page is
 * the painting, as it always was; a page whose levels are never set
 * stays the painting for good.
 * ------------------------------------------------------------------ */

const ANISO = 8;
let copier = null;
/** A texture holding `tex`'s mipmap level `L` (and its own chain below it), texel for texel. */
function mipCopy(renderer, tex, w, h, L) {
  copier ??= new FullScreenQuad(new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { map: { value: null }, lod: { value: 0 } },
    vertexShader: 'in vec3 position; void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'precision highp float; precision highp int; uniform highp sampler2D map; uniform int lod; out highp vec4 o; void main() { o = texelFetch(map, ivec2(gl_FragCoord.xy), lod); }',
    depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
  }));
  const rt = new THREE.WebGLRenderTarget(Math.max(1, w >> L), Math.max(1, h >> L), {
    depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    colorSpace: THREE.SRGBColorSpace, anisotropy: ANISO,
  });
  rt.texture.name = tex.name + '@' + L;
  copier.material.uniforms.map.value = tex;
  copier.material.uniforms.lod.value = L;
  const was = renderer.getRenderTarget(), auto = renderer.autoClear;
  renderer.autoClear = false;
  renderer.setRenderTarget(rt);
  copier.render(renderer);
  renderer.setRenderTarget(was);
  renderer.autoClear = auto;
  copier.material.uniforms.map.value = null;
  return rt;
}

const all = [];
let order = null;
let renderer = null;
/** The renderer, from the store's first frame (store/interior.js asks for it in a mesh's onBeforeRender). */
export function pagesRenderer(r) { renderer = r; }

/**
 * A page `w` x `h`, painted by `paint(ctx, from, to)` in `steps` steps (cells).  `tex` is what the
 * materials in `mats` read; it changes with the level.  `levels(far, near)` says what to keep it at.
 */
export function makePage({ name, w, h, steps = 1, paint }) {
  let far = 0, near = 0;
  const newCanvas = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const wrap = (cv) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = ANISO;
    t.name = name;
    t.userData.size = [w, h];             // (its canvas is emptied once the GPU has it)
    return t;
  };
  // as it always began: the whole painting, uploaded by the first frame that draws it
  let canvas = newCanvas();
  paint(canvas.getContext('2d'), 0, steps);
  let master = wrap(canvas);        // level 0, while it is held
  let held = null;                  // the far level's copy (kept for good once made)
  let nearRT = null;                // the near level's copy, when near > 0
  let job = null;                   // the painting under way again: { canvas, ctx, at }
  const page = {
    name, w, h,
    tex: master,
    mats: [],
    level: 0,
    get far() { return far; }, get near() { return near; },
    /** Keep it at mipmap `f` away from the store and `n` at it (before the first frame). */
    levels(f, n = 0) { if (!held) { near = n; far = Math.max(f, n); } return page; },
    /** A material that reads this page (it follows the page's level). */
    adopt(m) { m.map = page.tex; page.mats.push(m); return m; },
    get busy() { return !!job; },
    update,
  };
  const show = (t, level) => {
    page.level = level;
    if (page.tex === t) return;
    page.tex = t;
    for (const m of page.mats) m.map = t;
  };
  const uploaded = (t) => !!renderer.properties.get(t).__webglTexture;
  const freeCanvas = (cv) => { if (cv) cv.width = cv.height = 0; };
  const dropMaster = () => { if (master) { master.dispose(); master = null; } freeCanvas(canvas); canvas = null; };
  /** The painting on the GPU again; false while it is still being painted (`budget` ms a call; Infinity: all now). */
  function repaint(budget) {
    if (master) return true;
    job ??= { canvas: newCanvas(), at: 0 };
    job.ctx ??= job.canvas.getContext('2d');
    const t0 = performance.now();
    while (job.at < steps) {
      const to = Math.min(steps, job.at + 4);
      paint(job.ctx, job.at, to);
      job.at = to;
      if (job.at < steps && performance.now() - t0 > budget) return false;
    }
    canvas = job.canvas; job = null;
    master = wrap(canvas);
    renderer.initTexture(master);
    return true;
  }
  /**
   * Each frame: `want` 'near' or 'far'; `now` does whatever it takes at once (dev captures).
   * Returns true if it did something heavy (the caller does one such a frame).
   */
  function update(want, now = false) {
    if (!renderer) return false;                              // no frame has gone by yet
    if (far === 0) {
      // a page that is always the painting: only its canvas goes, once the GPU has it
      if (canvas && uploaded(master)) { freeCanvas(canvas); canvas = null; }
      return false;
    }
    let heavy = false;
    if (!held) {
      // the first time: the far level out of the painting's own mipmaps
      if (!uploaded(master)) { if (!now) return false; renderer.initTexture(master); }
      held = mipCopy(renderer, master, w, h, far);
      if (near > 0) nearRT = near === far ? held : mipCopy(renderer, master, w, h, near);
      freeCanvas(canvas); canvas = null;
      if (near > 0) dropMaster();
      heavy = true;
    }
    if (near > 0) { show(want === 'near' ? nearRT.texture : held.texture, want === 'near' ? near : far); return heavy; }
    if (want === 'near') {
      if (master) { show(master, 0); return heavy; }
      if (!repaint(now ? Infinity : 8)) return true;
      freeCanvas(canvas); canvas = null;
      show(master, 0);
      return true;
    }
    if (job) { freeCanvas(job.canvas); job = null; }
    show(held.texture, far);
    dropMaster();
    return heavy;
  }
  all.push(page);
  return page;
}

/** Every page, each frame: `want` 'near' or 'far'.  One page's heavy step a frame, unless `now`. */
export function updatePages(want, now = false) {
  // (the page that is smallest from afar first: it has the furthest to come)
  order ??= [...all].sort((a, b) => b.far - a.far);
  for (const p of order) if (p.update(want, now) && !now) return;
}

/** Every page (dev: scripts/_store-lean.mjs). */
export const storePages = all;
