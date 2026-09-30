import { STRINGS } from '../data/strings.js';
import { PRODUCT } from '../data/catalog.js';
import { STORE } from '../config.js';

/* ------------------------------------------------------------------ *
 * The konbini on screen (Tan's experience, made a scene: 2026-09-28).
 *
 * The choice: standing on the highlighted spot at the door, a small card lists
 * what you can have, one number key each.
 * ------------------------------------------------------------------ */

const yen = (n) => '¥' + n.toLocaleString('en');
const S = STRINGS.store;

export function createHandsHud() {
  const style = document.createElement('style');
  style.textContent = `
    .kmenu { position: fixed; left: 50%; bottom: 17%; z-index: 6; width: 400px; padding: 14px 16px 12px;
      transform: translate(-50%, 8px); border-radius: 16px; background: rgba(252,250,252,.92); backdrop-filter: blur(6px);
      border: 1.5px solid rgba(31,95,174,.45); box-shadow: 0 8px 28px rgba(40,30,60,.2); color: #3a3350;
      opacity: 0; transition: opacity .25s, transform .25s; pointer-events: none; font-variant-numeric: tabular-nums; }
    .kmenu.on { opacity: 1; transform: translate(-50%, 0); }
    .kmenu h3 { margin: 0 0 8px; font-size: 15px; font-weight: 700; display: flex; justify-content: space-between; align-items: baseline; }
    .kmenu h3 span { font-size: 12px; font-weight: 500; color: #7a7394; }
    .kmenu ol { list-style: none; margin: 0; padding: 0; }
    .kmenu li { display: grid; grid-template-columns: 26px 1fr auto auto; align-items: center; gap: 8px; padding: 5px 0;
      border-top: 1px solid rgba(58,51,80,.1); font-size: 15px; }
    .kmenu li:first-child { border-top: 0; }
    .kmenu kbd { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; font: 700 13px system-ui, sans-serif;
      background: #1f5fae; color: #fff; }
    .kmenu .jp { display: block; font-size: 11px; color: #8f88a8; }
    .kmenu .p { font-size: 13px; color: #6a6384; }
    .kmenu li > span:nth-of-type(1) { white-space: nowrap; }
    .kmenu .note { font-size: 11px; color: #b07a10; font-weight: 600; margin-left: 6px; white-space: nowrap; }
    /* the shop's recommendation: a red ink stamp, set down a little crooked */
    .kmenu .stamp { transform: rotate(-9deg);
      padding: 1px 6px 2px; border: 2px solid #d23a2a; border-radius: 5px; color: #d23a2a;
      font: 800 10px/1.2 system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase;
      background: rgba(255,245,240,.7); box-shadow: inset 0 0 0 1px rgba(210,58,42,.25); opacity: .92; }
  `;
  document.head.appendChild(style);
  const menu = document.createElement('aside');
  menu.className = 'kmenu';
  menu.setAttribute('aria-live', 'polite');
  document.body.appendChild(menu);

  let locked = true, open = false, filled = '';
  const render = () => menu.classList.toggle('on', open && locked);
  return {
    /** The pointer lock: the card hides with the rest of the HUD on the pause card. */
    setLocked(v) { locked = v; render(); },
    get open() { return open; },
    /** Show (ids: catalogue ids, one per number key) or hide the choice. */
    menu(ids) {
      open = !!ids;
      if (ids && filled !== ids.join()) {
        filled = ids.join();
        const rows = ids.map((id, i) => {
          const p = PRODUCT[id];
          const rec = id === STORE.recommended;
          const note = S.menuNotes[id] ? `<span class="note">${S.menuNotes[id]}</span>` : '';
          return `<li><kbd>${i + 1}</kbd><span>${S.menuNames[id] ?? p.nameEn}${note}<span class="jp">${p.nameJa}</span></span><span>${rec ? `<span class="stamp">${S.recommended}</span>` : ''}</span><span class="p">${yen(p.priceYen)}</span></li>`;
        }).join('');
        menu.innerHTML = `<h3>${S.menuTitle}<span>${S.menuHint}</span></h3><ol>${rows}</ol>`;
      }
      render();
    },
  };
}
