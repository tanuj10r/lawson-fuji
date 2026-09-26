import { STRINGS } from '../data/strings.js';
import { PRODUCT } from '../data/catalog.js';
import { STORE } from '../config.js';

/* ------------------------------------------------------------------ *
 * Shopping on screen (M3c; English only and the wallet card, M3d).
 *
 * The card, top left: from the moment you take a basket (or pick
 * something up by hand) it shows the wallet, what the basket comes to and
 * what is left, and the only keys that do anything in the store, each lit
 * when it can be used right now.
 *
 * The panel, Tab: slides in from the right with what you carry, grouped
 * by product.  The pointer stays locked, so it is driven by keys: W/S
 * choose a row, X puts one of it back, Tab closes.
 * ------------------------------------------------------------------ */

const yen = (n) => '¥' + n.toLocaleString('en');
const S = STRINGS.store;

export function createBasketPanel() {
  const style = document.createElement('style');
  style.textContent = `
    .bpanel { position: fixed; top: 0; right: 0; bottom: 0; width: 380px; z-index: 15;
      display: flex; flex-direction: column; padding: 22px 20px 18px;
      background: rgba(252,250,252,.94); backdrop-filter: blur(8px);
      border-left: 3px solid #1f5fae; box-shadow: -8px 0 30px rgba(40,30,60,.18);
      transform: translateX(105%); transition: transform .22s ease; color: #3a3350; }
    .bpanel.on { transform: none; }
    .bpanel h2 { margin: 0; font-size: 22px; letter-spacing: .01em; }
    .bpanel .jp { display: block; font-size: 12px; font-weight: 500; color: #8f88a8; }
    .bpanel ul { list-style: none; margin: 16px 0 10px; padding: 0; flex: 1; overflow: hidden; }
    .bpanel li { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: center;
      padding: 8px 10px; border-radius: 10px; font-size: 16px; }
    .bpanel li.sel { background: rgba(31,95,174,.12); box-shadow: inset 3px 0 0 #1f5fae; }
    .bpanel li .q { color: #6a6384; font-size: 14px; }
    .bpanel li .p { font-weight: 600; font-variant-numeric: tabular-nums; }
    .bpanel .none { display: block; padding: 10px; color: #8f88a8; }
    .money { display: grid; grid-template-columns: 1fr auto; row-gap: 5px; font-size: 15px;
      font-variant-numeric: tabular-nums; }
    .money b { font-size: 18px; }
    .money .left b { color: #2a8a4a; }
    .money .left.low b { color: #d08a1a; }
    .money .left.out b { color: #d0342f; }
    .bpanel .money { border-top: 1.5px solid rgba(58,51,80,.2); padding-top: 12px; }
    .keys { margin-top: 12px; display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; font-size: 14px; align-items: center; }
    .keys kbd { font: 700 12px ui-monospace, monospace; padding: 2px 7px; border-radius: 5px; min-width: 22px; text-align: center;
      background: #fff; border: 1.5px solid rgba(58,51,80,.35); color: #3a3350; }
    .keys .off { opacity: .35; }
    .scard { position: fixed; top: 16px; left: 16px; z-index: 6; width: 290px; padding: 14px 16px;
      border-radius: 14px; background: rgba(252,250,252,.9); backdrop-filter: blur(6px);
      border: 1.5px solid rgba(31,95,174,.45); box-shadow: 0 6px 22px rgba(40,30,60,.16); color: #3a3350;
      opacity: 0; transform: translateY(-6px); transition: opacity .25s, transform .25s; pointer-events: none; }
    .scard.on { opacity: 1; transform: none; }
    .scard .keys { border-top: 1.5px solid rgba(58,51,80,.16); padding-top: 10px; }
  `;
  document.head.appendChild(style);

  const panel = document.createElement('aside');
  panel.className = 'bpanel';
  panel.setAttribute('aria-hidden', 'true');
  document.body.appendChild(panel);
  const card = document.createElement('aside');
  card.className = 'scard';
  document.body.appendChild(card);

  let open = false, sel = 0, rows = [], last = { cart: [], basket: false };
  let ctx = { show: false, aim: null, nearDoor: false };

  function money(cart) {
    const total = cart.reduce((s, c) => s + PRODUCT[c.id].priceYen, 0), left = STORE.wallet - total;
    const cls = left <= 0 ? 'out' : left < 200 ? 'low' : '';
    return `<div class="money">
      <span>${S.wallet}</span><b>${yen(STORE.wallet)}</b>
      <span>${S.subtotal} · ${S.items(cart.length)}</span><b>${yen(total)}</b>
      <span class="left ${cls}">${S.left}</span><span class="left ${cls}"><b>${yen(left)}</b></span>
    </div>`;
  }
  const keyRows = (list) => `<div class="keys">${list.map(([k, text, on = true]) =>
    `<kbd class="${on ? '' : 'off'}">${k || '·'}</kbd><span class="${on ? '' : 'off'}">${text}</span>`).join('')}</div>`;

  function group(cart) {
    const m = new Map();
    for (const c of cart) (m.get(c.id) ?? m.set(c.id, { id: c.id, items: [] }).get(c.id)).items.push(c);
    return [...m.values()];
  }
  function renderPanel() {
    const { cart, basket } = last;
    rows = group(cart);
    sel = Math.max(0, Math.min(sel, rows.length - 1));
    panel.innerHTML = `
      <h2>${basket ? S.basket : S.hands}</h2>
      <ul>${rows.length ? rows.map((r, i) => `
        <li class="${i === sel ? 'sel' : ''}">
          <span>${PRODUCT[r.id].nameEn}<span class="jp">${PRODUCT[r.id].nameJa}</span></span>
          <span class="q">× ${r.items.length}</span>
          <span class="p">${yen(PRODUCT[r.id].priceYen * r.items.length)}</span>
        </li>`).join('') : `<li class="none">${S.empty}</li>`}</ul>
      ${money(cart)}`;        // its keys are in the corner list (ui/controls.js)
  }
  function renderCard() {
    card.classList.toggle('on', ctx.show && !open);
    if (!ctx.show) return;
    const on = {
      take: ctx.aim === 'item',
      door: ctx.aim === 'door' || ctx.nearDoor,
      tab: true,
      pay: false,                       // M5
    };
    // only what is in the basket and what is left: the keys are listed
    // by ui/controls.js, where every context's keys are shown together
    card.innerHTML = money(last.cart) + keyRows([['', S.card.find(([id]) => id === 'pay')[2], on.pay]]);
  }

  return {
    get open() { return open; },
    setOpen(v) {
      open = v;
      panel.classList.toggle('on', v);
      panel.setAttribute('aria-hidden', v ? 'false' : 'true');
      if (v) renderPanel();
      renderCard();
    },
    /** The cart changed (a take, a put-back, a landing). */
    update(cart, basket) {
      last = { cart: cart.filter((c) => !c.flying), basket };
      if (open) renderPanel();
      renderCard();
    },
    /** Each frame: is the card up, what is aimed at, is a fridge door near. */
    setContext(next) {
      if (next.show === ctx.show && next.aim === ctx.aim && next.nearDoor === ctx.nearDoor) return;
      ctx = next;
      renderCard();
    },
    move(d) { sel += d; renderPanel(); },
    /** The item to put back from the chosen row (the last one taken). */
    chosen() { const r = rows[sel]; return r ? r.items[r.items.length - 1] : null; },
  };
}
