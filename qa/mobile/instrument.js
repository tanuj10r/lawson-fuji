/* Injected before the page's own scripts (page.addInitScript) by the mobile
 * study.  It changes nothing in the game: it only watches.
 *   window.__qa.acs        every AudioContext made, to read its state
 *   window.__qa.plays      every <audio>.play(): resolved or refused
 *   window.__qa.marks      when the start card appeared, when __scene did
 *   window.__qa.longTasks  main-thread blocks over 50 ms (Chromium only)
 *   window.__qa.frames     rAF timestamps while recording (fps)
 * With window.__QA_PHONE_APIS (set by the test first), requestPointerLock is
 * removed, as it is absent on iPhone Safari and Android Chrome. */
(() => {
  const qa = (window.__qa = { acs: [], plays: [], marks: {}, longTasks: [], frames: null });
  const t = () => Math.round(performance.now());
  for (const k of ['AudioContext', 'webkitAudioContext']) {
    const AC = window[k];
    if (!AC) continue;
    window[k] = class extends AC {
      constructor(...a) { super(...a); qa.acs.push({ ac: this, at: t(), state0: this.state }); }
    };
  }
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) {
    const rec = { src: (this.currentSrc || this.src || '').split('/').pop(), at: t(), result: 'pending' };
    qa.plays.push(rec);
    const p = play.apply(this, a);
    p?.then?.(() => { rec.result = 'playing'; }, (e) => { rec.result = 'refused: ' + (e?.name ?? e); });
    return p;
  };
  if (window.__QA_PHONE_APIS) {
    delete Element.prototype.requestPointerLock;
    delete HTMLCanvasElement.prototype.requestPointerLock;
  }
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) qa.longTasks.push([Math.round(e.startTime), Math.round(e.duration)]); })
      .observe({ type: 'longtask', buffered: true });
  } catch { /* WebKit: no long tasks */ }
  const mo = new MutationObserver(() => {
    if (!qa.marks.card && document.querySelector('.overlay')) qa.marks.card = t();
  });
  document.addEventListener('DOMContentLoaded', () => {
    qa.marks.dcl = t();
    mo.observe(document.body, { childList: true, subtree: true });
  });
  const poll = () => {
    if (window.__scene && !qa.marks.scene) {
      qa.marks.scene = t();
      window.__scene.world.fuji.ready.then(() => { qa.marks.fuji = t(); requestAnimationFrame(() => requestAnimationFrame(() => { qa.marks.fujiFrame = t(); })); });
      requestAnimationFrame(() => { qa.marks.firstFrame = t(); });
      return;
    }
    setTimeout(poll, 50);
  };
  poll();
  const tick = (now) => { if (qa.frames) qa.frames.push(now); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  qa.acState = () => qa.acs.map((a) => a.state0 + '->' + a.ac.state);
})();
