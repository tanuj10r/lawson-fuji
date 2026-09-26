import { STRINGS } from '../data/strings.js';

/* ------------------------------------------------------------------ *
 * The controls on screen (M4, Tan): only the keys that do something
 * where the player is standing right now.
 *
 * Walking the town it is moving, the map, sound and pause; inside the
 * store it is what E does here and the basket; with the basket panel
 * open it is that panel's own keys.  A key that belongs to the place but
 * cannot be used this second (E with nothing under the crosshair) is
 * shown dimmed rather than taken away, so the list does not jump about.
 *
 * `set(rows)` takes [key, what it does, usable] and only touches the DOM
 * when the list really changes.
 * ------------------------------------------------------------------ */

export function createControls() {
  const style = document.createElement('style');
  style.textContent = `
    .controls { position: fixed; left: 16px; bottom: 16px; z-index: 6;
      display: grid; grid-template-columns: auto 1fr; gap: 5px 9px; align-items: center;
      padding: 11px 14px; border-radius: 12px; max-width: 290px;
      background: rgba(252,250,252,.82); backdrop-filter: blur(6px);
      border: 1.5px solid rgba(58,51,80,.22); box-shadow: 0 5px 18px rgba(40,30,60,.14);
      color: #3a3350; font-size: 13px; line-height: 1.25;
      opacity: 0; visibility: hidden; transform: translateY(6px);
      transition: opacity .25s, transform .25s, visibility .25s;
      pointer-events: none; }
    .controls.on { opacity: 1; visibility: visible; transform: none; }
    .controls kbd { font: 700 11px ui-monospace, SFMono-Regular, Consolas, monospace;
      padding: 3px 7px; border-radius: 5px; min-width: 24px; text-align: center; white-space: nowrap;
      background: #fff; border: 1.5px solid rgba(58,51,80,.38); color: #3a3350; }
    .controls .off { opacity: .34; }
  `;
  document.head.appendChild(style);

  const el = document.createElement('aside');
  el.className = 'controls';
  el.setAttribute('aria-label', STRINGS.controlsTitle);
  document.body.appendChild(el);

  let last = '';
  return {
    /** `rows`: [key, what it does, usable]; an empty list hides the panel. */
    set(rows) {
      const key = rows.map((r) => r.join('\u0001')).join('\u0002');
      if (key === last) return;
      last = key;
      el.classList.toggle('on', rows.length > 0);
      el.setAttribute('aria-hidden', rows.length ? 'false' : 'true');
      if (!rows.length) return;
      el.innerHTML = rows.map(([k, what, on = true]) =>
        `<kbd class="${on ? '' : 'off'}">${k}</kbd><span class="${on ? '' : 'off'}">${what}</span>`).join('');
    },
  };
}
