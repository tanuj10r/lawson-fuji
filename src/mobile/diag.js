/* ------------------------------------------------------------------ *
 * GPU memory, counted at the source, and the ?diag readout
 * (docs/decisions/mobile-lite.md; Tan's iPhone lost the WebGL context).
 *
 * gpuMeter(gl) wraps the context's allocating calls (texImage2D,
 * texStorage2D, bufferData, renderbufferStorage and the deletes) and keeps
 * a running total per kind: what the page has asked the GPU to hold.  It
 * is an estimate (a driver pads and aligns), but it moves with every
 * upload and free, so it shows where the memory goes and when.
 *
 * ?diag shows a small panel: the load stage reached, renderer.info, the
 * meter, the JS heap (Chrome), the device pixel ratio and canvas size.
 * It lives outside the canvas, so it stays up over the "town was put away"
 * card; and the last reading is kept in localStorage, so after iOS reloads
 * a crashed tab the next ?diag load shows what the last one reached.
 * ------------------------------------------------------------------ */

const BPP = (gl, internal, format, type) => {
  // bytes per texel for the formats three uses
  const map = {
    [gl.RGBA8]: 4, [gl.SRGB8_ALPHA8]: 4, [gl.RGBA16F]: 8, [gl.RGBA32F]: 16, [gl.RGB8]: 4, [gl.R8]: 1, [gl.RG8]: 2,
    [gl.DEPTH_COMPONENT24]: 4, [gl.DEPTH_COMPONENT32F]: 4, [gl.DEPTH_COMPONENT16]: 2, [gl.DEPTH24_STENCIL8]: 4,
  };
  if (map[internal]) return map[internal];
  if (type === gl.HALF_FLOAT) return 8;
  if (type === gl.FLOAT) return 16;
  return 4;
};

export function gpuMeter(gl) {
  const m = { textures: 0, buffers: 0, renderbuffers: 0, peak: 0, get total() { return this.textures + this.buffers + this.renderbuffers; } };
  const tex = new Map(), buf = new Map(), rb = new Map();
  let curTex = new Map(), curBuf = new Map(), curRb = null;
  const bump = () => { m.peak = Math.max(m.peak, m.total); };
  const wrap = (name, fn) => { const f = gl[name].bind(gl); gl[name] = function (...a) { fn(...a); return f(...a); }; };
  const setTex = (t, bytes, add = false) => {
    if (!t) return;
    const old = tex.get(t) ?? 0, v = add ? old + bytes : bytes;
    tex.set(t, v); m.textures += v - old; bump();
  };
  wrap('bindTexture', (target, t) => curTex.set(target, t));
  wrap('bindBuffer', (target, b) => curBuf.set(target, b));
  wrap('bindRenderbuffer', (target, r) => { curRb = r; });
  wrap('texStorage2D', (target, levels, internal, w, h) => {
    setTex(curTex.get(target), w * h * BPP(gl, internal) * (levels > 1 ? 4 / 3 : 1));
  });
  wrap('texStorage3D', (target, levels, internal, w, h, d) => setTex(curTex.get(target), w * h * d * BPP(gl, internal)));
  wrap('texImage2D', (target, level, internal, ...rest) => {
    // (target, level, internal, w, h, border, format, type, src) or (target, level, internal, format, type, source)
    let w, h, format, type;
    if (rest.length >= 5) { [w, h, , format, type] = rest; } else { const s = rest[2]; [format, type] = rest; w = s?.width ?? s?.videoWidth ?? 0; h = s?.height ?? s?.videoHeight ?? 0; }
    const t = curTex.get(target === gl.TEXTURE_2D ? gl.TEXTURE_2D : gl.TEXTURE_CUBE_MAP);
    const bytes = w * h * BPP(gl, internal, format, type);
    if (level === 0 && target === gl.TEXTURE_2D) setTex(t, bytes);
    else setTex(t, bytes, true);
  });
  wrap('deleteTexture', (t) => { const v = tex.get(t) ?? 0; m.textures -= v; tex.delete(t); });
  wrap('bufferData', (target, data) => {
    const b = curBuf.get(target);
    if (!b) return;
    const bytes = typeof data === 'number' ? data : data?.byteLength ?? 0;
    const old = buf.get(b) ?? 0;
    buf.set(b, bytes); m.buffers += bytes - old; bump();
  });
  wrap('deleteBuffer', (b) => { const v = buf.get(b) ?? 0; m.buffers -= v; buf.delete(b); });
  wrap('renderbufferStorage', (target, internal, w, h) => {
    if (!curRb) return;
    const bytes = w * h * BPP(gl, internal), old = rb.get(curRb) ?? 0;
    rb.set(curRb, bytes); m.renderbuffers += bytes - old; bump();
  });
  wrap('renderbufferStorageMultisample', (target, samples, internal, w, h) => {
    if (!curRb) return;
    const bytes = w * h * BPP(gl, internal) * Math.max(1, samples), old = rb.get(curRb) ?? 0;
    rb.set(curRb, bytes); m.renderbuffers += bytes - old; bump();
  });
  wrap('deleteRenderbuffer', (r) => { const v = rb.get(r) ?? 0; m.renderbuffers -= v; rb.delete(r); });
  /** Every live texture and its bytes (a GL handle each): for finding who holds what. */
  m.textureList = () => [...tex];
  /** A lost context has freed everything: start from zero. */
  m.reset = () => { tex.clear(); buf.clear(); rb.clear(); m.textures = m.buffers = m.renderbuffers = 0; curTex = new Map(); curBuf = new Map(); curRb = null; };
  return m;
}

const KEY = 'takemebacktojapan-diag';
const MB = (n) => (n / 1048576).toFixed(0);

export function createDiag({ on }) {
  let last = null;
  try {
    // the working title's key, read once and moved
    const old = localStorage.getItem('lawson-fuji-diag');
    if (old !== null) { if (localStorage.getItem(KEY) === null) localStorage.setItem(KEY, old); localStorage.removeItem('lawson-fuji-diag'); }
    last = localStorage.getItem(KEY);
  } catch { /* optional */ }
  const state = { stage: 'boot', t0: performance.now(), stages: [] };
  let el = null;
  if (on) {
    el = document.createElement('pre');
    el.style.cssText = 'position:fixed;left:max(6px,env(safe-area-inset-left));top:max(6px,env(safe-area-inset-top));z-index:60;margin:0;'
      + 'padding:6px 8px;border-radius:8px;background:rgba(12,10,24,.78);color:#e8f0ff;font:10.5px/1.35 ui-monospace,Menlo,monospace;'
      + 'pointer-events:none;white-space:pre;max-width:92vw;overflow:hidden';
    document.body.appendChild(el);
    if (last) el.textContent = 'last run: ' + last;
  }
  let src = null;
  const api = {
    stage(name) {
      state.stage = name;
      const hp = performance.memory ? `,${MB(performance.memory.usedJSHeapSize)}MB` : "";
      state.stages.push(`${name}@${((performance.now() - state.t0) / 1000).toFixed(1)}s${hp}`);
      state.all = state.stages.join(" ");
      api.update(true);
    },
    /** What to read: { renderer, meter, canvas, extra() }. */
    source(s) { src = s; },
    lines() {
      const out = [`stage ${state.stage}  (${state.stages.slice(-4).join(' ')})`];
      if (src?.renderer) {
        const i = src.renderer.info;
        out.push(`geo ${i.memory.geometries}  tex ${i.memory.textures}  prog ${i.programs?.length ?? '?'}  calls ${i.render.calls}  tris ${(i.render.triangles / 1e6).toFixed(2)}M`);
      }
      if (src?.meter) {
        const m = src.meter;
        out.push(`gpu~ ${MB(m.total)} MB (tex ${MB(m.textures)} buf ${MB(m.buffers)} rb ${MB(m.renderbuffers)}) peak ${MB(m.peak)}`);
      }
      const pm = performance.memory;
      out.push(`heap ${pm ? MB(pm.usedJSHeapSize) + ' MB' : 'n/a'}  dpr ${window.devicePixelRatio}  canvas ${src?.canvas ? `${src.canvas.width}x${src.canvas.height}` : '?'}`);
      let x = null;
      try { x = src?.extra?.(); } catch { /* (not built yet) */ }
      if (x) out.push(x);
      return out;
    },
    update(force = false) {
      const now = performance.now();
      if (!force && now - (api._t ?? 0) < 1000) return;
      api._t = now;
      const text = api.lines().join('\n');
      if (el) el.textContent = text;
      try { localStorage.setItem(KEY, `${new Date().toISOString().slice(11, 19)} ${text.replace(/\n/g, ' | ')}`); } catch { /* optional */ }
    },
    get on() { return !!el; },
    get stageName() { return state.stage; },
    get stages() { return state.all; },
  };
  return api;
}
