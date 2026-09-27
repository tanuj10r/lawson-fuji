import { STRINGS } from '../data/strings.js';
import { PRODUCT } from '../data/catalog.js';

/* ------------------------------------------------------------------ *
 * The konbini on screen (Tan's experience; replaces M3c's basket panel).
 *
 * A small card, top left, while you are in the store or holding what you
 * bought: the wallet (¥1,000 less what you hold, or your change once you
 * have paid) and your two hands, each empty or with its thing and price.
 * And the subtitles: what the cashier says, in English, with the
 * Japanese she said small above it.
 * ------------------------------------------------------------------ */

const yen = (n) => '¥' + n.toLocaleString('en');
const S = STRINGS.store;

export function createHandsHud() {
  const style = document.createElement('style');
  style.textContent = `
    .kcard { position: fixed; top: 16px; left: 16px; z-index: 6; width: 250px; padding: 12px 14px 10px;
      border-radius: 14px; background: rgba(252,250,252,.9); backdrop-filter: blur(6px);
      border: 1.5px solid rgba(31,95,174,.45); box-shadow: 0 6px 22px rgba(40,30,60,.16); color: #3a3350;
      opacity: 0; transform: translateY(-6px); transition: opacity .25s, transform .25s; pointer-events: none;
      font-variant-numeric: tabular-nums; }
    .kcard.on { opacity: 1; transform: none; }
    .kcard .w { display: flex; justify-content: space-between; align-items: baseline; }
    .kcard .w span { font-size: 13px; color: #6a6384; }
    .kcard .w b { font-size: 24px; letter-spacing: .01em; }
    .kcard .w b.low { color: #d08a1a; }
    .kcard ul { list-style: none; margin: 8px 0 0; padding: 8px 0 0; border-top: 1.5px solid rgba(58,51,80,.16); }
    .kcard li { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; padding: 4px 0; font-size: 14px; }
    .kcard li .jp { display: block; font-size: 11px; color: #8f88a8; }
    .kcard li.none { color: #9a94b0; font-style: italic; }
    .kcard li .p { font-weight: 600; }
    .kcard li .tag { font-size: 11px; font-weight: 700; color: #2a8a4a; margin-left: 6px; }
    .ksub { position: fixed; left: 50%; bottom: 23%; z-index: 6; transform: translate(-50%, 6px);
      text-align: center; pointer-events: none; opacity: 0; transition: opacity .2s, transform .2s; }
    .ksub.on { opacity: 1; transform: translate(-50%, 0); }
    .ksub .jp { font-size: 13px; color: rgba(255,255,255,.9); text-shadow: 0 1px 3px rgba(20,16,40,.8); letter-spacing: .04em; }
    .ksub .en { display: inline-block; margin-top: 3px; padding: 5px 14px; border-radius: 10px; font-size: 18px; font-weight: 600;
      background: rgba(20,18,34,.62); color: #fff; letter-spacing: .01em; }
  `;
  document.head.appendChild(style);
  const card = document.createElement('aside');
  card.className = 'kcard';
  document.body.appendChild(card);
  const sub = document.createElement('div');
  sub.className = 'ksub';
  sub.setAttribute('aria-live', 'polite');
  document.body.appendChild(sub);

  let lastKey = '', subTimer = null, locked = true;
  let state = null;
  function render() {
    const on = !!state?.show && locked;
    card.classList.toggle('on', on);
    if (!state) return;
    const key = JSON.stringify(state);
    if (key === lastKey) return;
    lastKey = key;
    const rows = state.slots.map((s) => {
      if (!s) return `<li class="none"><span>${S.empty}</span><span></span></li>`;
      const p = PRODUCT[s.id];
      return `<li><span>${p.nameEn}<span class="jp">${p.nameJa}</span></span><span class="p">${s.paid ? `<span class="tag">${S.paidTag}</span>` : yen(p.priceYen)}</span></li>`;
    }).join('');
    card.innerHTML = `<div class="w"><span>${S.wallet}</span><b class="${state.wallet < 300 ? 'low' : ''}">${yen(state.wallet)}</b></div><ul>${rows}</ul>`;
  }
  return {
    /** From shop.hud(): { wallet, slots: [{ id, paid } | null, ...], show }. */
    update(s) { state = s; render(); },
    /** The pointer lock: the card hides with the rest of the HUD on the pause card. */
    setLocked(v) { locked = v; render(); },
    /** A line said: { jp, en, dur }. */
    say(line) {
      sub.innerHTML = `<div class="jp">${line.jp}</div><div class="en">${line.en}</div>`;
      sub.classList.add('on');
      clearTimeout(subTimer);
      subTimer = setTimeout(() => sub.classList.remove('on'), (line.dur ?? 1.5) * 1000 + 1100);
    },
  };
}
