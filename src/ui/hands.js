import { STRINGS } from '../data/strings.js';
import { PRODUCT } from '../data/catalog.js';

/* ------------------------------------------------------------------ *
 * The konbini on screen (Tan's experience, made a scene: 2026-09-28).
 *
 * The choice: standing on the highlighted spot at the door, a small card lists
 * what you can have, one number key each.  And the subtitles: what the
 * cashier says, in English, with the Japanese she said small above it.
 * ------------------------------------------------------------------ */

const yen = (n) => '¥' + n.toLocaleString('en');
const S = STRINGS.store;

export function createHandsHud() {
  const style = document.createElement('style');
  style.textContent = `
    .kmenu { position: fixed; left: 50%; bottom: 17%; z-index: 6; width: 340px; padding: 14px 16px 12px;
      transform: translate(-50%, 8px); border-radius: 16px; background: rgba(252,250,252,.92); backdrop-filter: blur(6px);
      border: 1.5px solid rgba(31,95,174,.45); box-shadow: 0 8px 28px rgba(40,30,60,.2); color: #3a3350;
      opacity: 0; transition: opacity .25s, transform .25s; pointer-events: none; font-variant-numeric: tabular-nums; }
    .kmenu.on { opacity: 1; transform: translate(-50%, 0); }
    .kmenu h3 { margin: 0 0 8px; font-size: 15px; font-weight: 700; display: flex; justify-content: space-between; align-items: baseline; }
    .kmenu h3 span { font-size: 12px; font-weight: 500; color: #7a7394; }
    .kmenu ol { list-style: none; margin: 0; padding: 0; }
    .kmenu li { display: grid; grid-template-columns: 26px 1fr auto; align-items: center; gap: 8px; padding: 5px 0;
      border-top: 1px solid rgba(58,51,80,.1); font-size: 15px; }
    .kmenu li:first-child { border-top: 0; }
    .kmenu kbd { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; font: 700 13px system-ui, sans-serif;
      background: #1f5fae; color: #fff; }
    .kmenu .jp { display: block; font-size: 11px; color: #8f88a8; }
    .kmenu .p { font-size: 13px; color: #6a6384; }
    .ksub { position: fixed; left: 50%; bottom: 23%; z-index: 6; transform: translate(-50%, 6px);
      text-align: center; pointer-events: none; opacity: 0; transition: opacity .2s, transform .2s; }
    .ksub.on { opacity: 1; transform: translate(-50%, 0); }
    .ksub .jp { font-size: 13px; color: rgba(255,255,255,.9); text-shadow: 0 1px 3px rgba(20,16,40,.8); letter-spacing: .04em; }
    .ksub .en { display: inline-block; margin-top: 3px; padding: 5px 14px; border-radius: 10px; font-size: 18px; font-weight: 600;
      background: rgba(20,18,34,.62); color: #fff; letter-spacing: .01em; }
  `;
  document.head.appendChild(style);
  const menu = document.createElement('aside');
  menu.className = 'kmenu';
  menu.setAttribute('aria-live', 'polite');
  document.body.appendChild(menu);
  const sub = document.createElement('div');
  sub.className = 'ksub';
  sub.setAttribute('aria-live', 'polite');
  document.body.appendChild(sub);

  let subTimer = null, locked = true, open = false, filled = '';
  const render = () => menu.classList.toggle('on', open && locked);
  return {
    /** Kept for shop.onChange; the scene needs no card of what you hold. */
    update() {},
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
          return `<li><kbd>${i + 1}</kbd><span>${p.nameEn}<span class="jp">${p.nameJa}</span></span><span class="p">${yen(p.priceYen)}</span></li>`;
        }).join('');
        menu.innerHTML = `<h3>${S.menuTitle}<span>${S.menuHint}</span></h3><ol>${rows}</ol>`;
      }
      render();
    },
    /** A line said: { jp, en, dur }. */
    say(line) {
      sub.innerHTML = `<div class="jp">${line.jp}</div><div class="en">${line.en}</div>`;
      sub.classList.add('on');
      clearTimeout(subTimer);
      subTimer = setTimeout(() => sub.classList.remove('on'), (line.dur ?? 1.5) * 1000 + 1100);
    },
  };
}
