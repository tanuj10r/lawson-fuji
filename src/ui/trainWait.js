import { STRINGS } from '../data/strings.js';

/* ------------------------------------------------------------------ *
 * "Next train · 0:25" (QA-010): while you wait on the station's platform
 * for platform 1's train, a small pill above where the prompt sits, its
 * fill growing as the train nears (world/line/station.js `wait`).  One
 * element, shared by the desktop and phone HUDs; touched only when the
 * shown second or the fill's percent changes.
 *
 *   const tw = trainWaitLabel(hudRoot, { bottom: '21%' });
 *   tw.update(world.line?.station?.wait, playing)   // each frame
 * ------------------------------------------------------------------ */

export function trainWaitLabel(parent = document.body, { bottom = '21%' } = {}) {
  const el = document.createElement('div');
  el.className = 'train-wait';
  el.setAttribute('aria-live', 'off');
  el.style.cssText = `position:absolute;left:50%;bottom:${bottom};transform:translate(-50%,8px);z-index:3;pointer-events:none;`
    + 'padding:6px 16px 7px;border-radius:999px;overflow:hidden;white-space:nowrap;'
    + 'background:linear-gradient(90deg,rgba(255,222,120,.55) var(--p,0%),rgba(252,250,252,.78) var(--p,0%));'
    + 'border:1.5px solid rgba(58,51,80,.3);color:#4c4568;font-size:14px;font-weight:600;letter-spacing:.02em;'
    + 'font-variant-numeric:tabular-nums;opacity:0;transition:opacity .3s ease,transform .3s ease;';
  parent.appendChild(el);
  let on = false, secs = -1, pc = -1;
  return {
    el,
    /** `w`: { on, secs, p } or nothing; `show`: in play (no card up). */
    update(w, show = true) {
      const want = !!(w && w.on && show);
      if (want !== on) {
        on = want;
        el.style.opacity = want ? '1' : '0';
        el.style.transform = want ? 'translate(-50%,0)' : 'translate(-50%,8px)';
      }
      if (!want) return;
      if (w.secs !== secs) { secs = w.secs; el.textContent = STRINGS.nextTrain(secs); }
      const p = Math.round(w.p * 100);
      if (p !== pc) { pc = p; el.style.setProperty('--p', `${p}%`); }
    },
  };
}
