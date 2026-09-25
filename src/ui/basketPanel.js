import { STRINGS } from '../data/strings.js';
import { PRODUCT } from '../data/catalog.js';
import { STORE } from '../config.js';

/* ------------------------------------------------------------------ *
 * The basket panel (M3c; SPEC 10): Tab slides it in from the right.
 * Rows of what you carry, grouped by product, with the subtotal against
 * your wallet.  The pointer stays locked, so it is driven by keys: W/S
 * choose a row, X puts one of it back, Tab closes.  And a small badge,
 * top right, counting what you carry.
 * ------------------------------------------------------------------ */

const yen = (n) => '¥' + n.toLocaleString('ja-JP');

export function createBasketPanel() {
  const S = STRINGS.store;
  const style = document.createElement('style');
  style.textContent = `
    .bpanel { position: fixed; top: 0; right: 0; bottom: 0; width: 360px; z-index: 15;
      display: flex; flex-direction: column; padding: 22px 20px 18px;
      background: rgba(252,250,252,.92); backdrop-filter: blur(8px);
      border-left: 3px solid #1f5fae; box-shadow: -8px 0 30px rgba(40,30,60,.18);
      transform: translateX(105%); transition: transform .22s ease; color: #3a3350; }
    .bpanel.on { transform: none; }
    .bpanel h2 { margin: 0; font-size: 21px; letter-spacing: .04em; }
    .bpanel h2 small, .bpanel .en { display: block; font-size: 12px; font-weight: 500; color: #8f88a8; letter-spacing: .02em; }
    .bpanel ul { list-style: none; margin: 16px 0 10px; padding: 0; flex: 1; overflow: hidden; }
    .bpanel li { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center;
      padding: 8px 10px; border-radius: 10px; font-size: 16px; }
    .bpanel li.sel { background: rgba(31,95,174,.12); box-shadow: inset 3px 0 0 #1f5fae; }
    .bpanel li .q { color: #6a6384; font-size: 14px; }
    .bpanel li .p { font-weight: 600; font-variant-numeric: tabular-nums; }
    .bpanel .none { padding: 10px; color: #8f88a8; }
    .bpanel .sum { border-top: 1.5px solid rgba(58,51,80,.2); padding-top: 12px; display: grid;
      grid-template-columns: 1fr auto; row-gap: 6px; font-size: 16px; }
    .bpanel .sum b { font-size: 20px; font-variant-numeric: tabular-nums; }
    .bpanel .sum .over { color: #c8342f; }
    .bpanel .keys { margin-top: 14px; font-size: 13px; color: #6a6384; }
    .bbadge { position: fixed; top: 16px; right: 18px; z-index: 6; display: none;
      align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px;
      background: rgba(252,250,252,.85); border: 1.5px solid rgba(31,95,174,.5);
      font-size: 14px; font-weight: 700; color: #1f5fae; }
    .bbadge.on { display: flex; }
    .bbadge svg { width: 18px; height: 16px; }
  `;
  document.head.appendChild(style);

  const panel = document.createElement('aside');
  panel.className = 'bpanel';
  panel.setAttribute('aria-hidden', 'true');
  document.body.appendChild(panel);
  const badge = document.createElement('div');
  badge.className = 'bbadge';
  badge.innerHTML = `<svg viewBox="0 0 18 16"><path d="M1 5h16l-2 10H3z" fill="#2f6fb6"/><path d="M5 5l3-4M13 5l-3-4" stroke="#24558e" stroke-width="1.6" fill="none"/></svg><span></span>`;
  document.body.appendChild(badge);

  let open = false, sel = 0, rows = [], last = { cart: [], basket: false };

  function group(cart) {
    const m = new Map();
    for (const c of cart) {
      const r = m.get(c.id) ?? m.set(c.id, { id: c.id, items: [] }).get(c.id);
      r.items.push(c);
    }
    return [...m.values()];
  }
  function render() {
    const { cart, basket } = last;
    rows = group(cart);
    sel = Math.max(0, Math.min(sel, rows.length - 1));
    const total = cart.reduce((s, c) => s + PRODUCT[c.id].priceYen, 0);
    panel.innerHTML = `
      <h2>${basket ? S.basketJa : S.hands}<small>${basket ? S.basket : S.handsEn}</small></h2>
      <ul>${rows.length ? rows.map((r, i) => `
        <li class="${i === sel ? 'sel' : ''}">
          <span>${PRODUCT[r.id].nameJa}<span class="en">${PRODUCT[r.id].nameEn}</span></span>
          <span class="q">× ${r.items.length}</span>
          <span class="p">${yen(PRODUCT[r.id].priceYen * r.items.length)}</span>
        </li>`).join('') : `<li class="none">${S.empty}<span class="en">${S.emptyEn}</span></li>`}</ul>
      <div class="sum">
        <span>${S.subtotal}<span class="en">${S.subtotalEn}</span></span><b class="${total > STORE.wallet ? 'over' : ''}">${yen(total)}</b>
        <span>${S.wallet}<span class="en">${S.walletEn}</span></span><span>${yen(STORE.wallet)}</span>
      </div>
      <div class="keys">${S.keys}<span class="en">${S.keysEn}</span></div>`;
    badge.querySelector('span').textContent = String(cart.length);
    badge.classList.toggle('on', basket || cart.length > 0);
  }

  return {
    get open() { return open; },
    setOpen(v) {
      open = v;
      panel.classList.toggle('on', v);
      panel.setAttribute('aria-hidden', v ? 'false' : 'true');
      if (v) render();
    },
    /** The cart changed (a take, a put-back, a landing). */
    update(cart, basket) {
      last = { cart: cart.filter((c) => !c.flying), basket };
      render();
    },
    move(d) { sel += d; render(); },
    /** The item to put back from the chosen row (the last one taken). */
    chosen() { const r = rows[sel]; return r ? r.items[r.items.length - 1] : null; },
    setBadgeVisible(v) { badge.style.visibility = v ? '' : 'hidden'; },
  };
}
