import { MOBILE_STRINGS as M, STRINGS } from '../data/strings.js';
import { PRODUCT } from '../data/catalog.js';
import { STORE, VOLUME_STEPS } from '../config.js';

/* ------------------------------------------------------------------ *
 * The phone's HUD (docs/decisions/mobile-lite.md).  What the desktop's
 * keys do, as things to tap, where a thumb rests:
 *
 *   top right     pause, the map, the time of day, the whistle for Hachi
 *   bottom right  the hand: what E does (sit, watch Han), shown only when
 *                 there is something in front of you, with its words
 *   bottom middle the konbini's choice as chips, on its spot
 *   left          the joystick (touch.js draws it where the thumb lands)
 *   cards         the pause card (volume, back to the start, what does
 *                 what); the start card is m.html's own
 *
 * All words from src/data/strings.js (MOBILE_STRINGS).  Inline SVG icons:
 * no images are downloaded.
 * ------------------------------------------------------------------ */

const ICON = {
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>',
  map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M9 4v13.5M15 6.5V20" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></g></svg>',
  dusk: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16a7 7 0 0 1 14 0z"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 19.5h18M12 4.5v3M5.2 8.2l2 2M18.8 8.2l-2 2"/></g></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 3.5a8.5 8.5 0 1 0 5 12.5A7 7 0 0 1 15.5 3.5z"/></svg>',
  paw: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="16" rx="5" ry="4.3"/><ellipse cx="5.6" cy="10.4" rx="2.1" ry="2.6"/><ellipse cx="9.4" cy="6.4" rx="2.1" ry="2.7"/><ellipse cx="14.6" cy="6.4" rx="2.1" ry="2.7"/><ellipse cx="18.4" cy="10.4" rx="2.1" ry="2.6"/></svg>',
  hand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 11V5.2a1.5 1.5 0 0 1 3 0V10m0-1.5V3.9a1.5 1.5 0 0 1 3 0V10m0-4.4a1.5 1.5 0 0 1 3 0v7.7c0 4.1-2.6 7.2-6.3 7.2-2.7 0-4.3-1.3-5.6-3.6L3.3 12.6a1.5 1.5 0 0 1 2.4-1.7L8.5 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const TIME_ICON = { morning: ICON.sun, golden: ICON.dusk, night: ICON.moon };
const yen = (n) => '¥' + n.toLocaleString('en');

const CSS = `
  .mh { position: fixed; inset: 0; z-index: 6; pointer-events: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color: #2b2542; }
  .mh.off .mh-play { opacity: 0; visibility: hidden; }
  .mh-play { transition: opacity .3s, visibility .3s; }
  .mh button { pointer-events: auto; touch-action: manipulation; font: inherit; }
  .mh-top { position: absolute; top: max(10px, var(--safe-t)); right: max(10px, var(--safe-r)); display: flex; gap: 8px; }
  .mh-btn { width: 46px; height: 46px; border-radius: 50%; border: 1.5px solid rgba(58,51,80,.22); padding: 0;
    display: grid; place-items: center; background: rgba(252,250,252,.78); color: #3b3263;
    -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); box-shadow: 0 4px 14px rgba(40,30,60,.18); }
  .mh-btn svg { width: 22px; height: 22px; fill: currentColor; }
  .mh-btn:active { transform: scale(.94); background: rgba(236,230,244,.92); }
  .mh-btn.on { background: #3b3263; color: #fff; }
  .mh-act { position: absolute; right: max(22px, calc(var(--safe-r) + 12px)); bottom: max(26px, calc(var(--safe-b) + 14px));
    display: flex; flex-direction: column; align-items: center; gap: 6px; opacity: 0; transform: scale(.85);
    transition: opacity .2s, transform .2s; pointer-events: none; }
  .mh-act.on { opacity: 1; transform: none; }
  .mh-act.on button { pointer-events: auto; }
  .mh-act button { width: 76px; height: 76px; border-radius: 50%; border: 2px solid rgba(255,255,255,.85); padding: 0;
    display: grid; place-items: center; background: rgba(59,50,99,.86); color: #fff; box-shadow: 0 6px 22px rgba(20,12,40,.4); }
  .mh-act button svg { width: 34px; height: 34px; }
  .mh-act span { max-width: 150px; padding: 4px 10px; border-radius: 999px; background: rgba(252,250,252,.88);
    font-size: 12.5px; font-weight: 700; text-align: center; line-height: 1.2; }
  .mh-toast { position: absolute; left: 50%; top: max(14px, calc(var(--safe-t) + 6px)); transform: translate(-50%, -6px);
    max-width: min(78vw, 520px); padding: 7px 16px; border-radius: 999px; text-align: center;
    background: rgba(252,250,252,.88); border: 1.5px solid rgba(58,51,80,.25); font-size: 14px; font-weight: 600; color: #4c4568;
    opacity: 0; transition: opacity .25s, transform .25s; z-index: 7; }
  .mh-toast.on { opacity: 1; transform: translate(-50%, 0); }
  .mh-toast.err { background: rgba(255,238,236,.95); border-color: rgba(208,52,47,.6); color: #b0282a; }
  .mh-pill { position: absolute; left: 50%; bottom: max(18px, calc(var(--safe-b) + 8px)); transform: translate(-50%, 8px);
    padding: 9px 18px; border-radius: 999px; background: rgba(43,37,66,.84); color: #fff; font-size: 14px; font-weight: 600;
    white-space: nowrap; opacity: 0; transition: opacity .3s, transform .3s; }
  .mh-pill.on { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
  .mh-cross { position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%;
    background: rgba(255,255,255,.85); box-shadow: 0 0 0 1.5px rgba(58,51,80,.5); opacity: .7; }
  .mh-cross.hidden { opacity: 0; }
  /* the konbini's choice: chips along the bottom, clear of the stick and the hand */
  .mh-menu { position: absolute; left: 50%; bottom: max(14px, calc(var(--safe-b) + 6px)); transform: translate(-50%, 10px);
    width: min(calc(100vw - 250px), 560px); min-width: min(94vw, 330px); padding: 10px 10px 8px; border-radius: 16px;
    background: rgba(252,250,252,.93); border: 1.5px solid rgba(31,95,174,.45); box-shadow: 0 8px 28px rgba(40,30,60,.22);
    opacity: 0; visibility: hidden; transition: opacity .25s, transform .25s, visibility .25s; }
  .mh-menu.on { opacity: 1; visibility: visible; transform: translate(-50%, 0); }
  .mh-menu h3 { margin: 0 4px 7px; font-size: 14px; display: flex; justify-content: space-between; align-items: baseline; }
  .mh-menu h3 span { font-size: 12px; font-weight: 500; color: #7a7394; }
  .mh-menu ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 6px; }
  .mh-menu li button { position: relative; width: 100%; min-height: 58px; padding: 6px 6px 5px; border-radius: 11px; text-align: left;
    border: 1.5px solid rgba(31,95,174,.3); background: #fff; color: #2b2542; display: flex; flex-direction: column; justify-content: space-between; }
  .mh-menu li button:active { background: #e8f0fb; }
  .mh-menu b { font-size: 13px; line-height: 1.15; }
  .mh-menu .mh-jp { font-size: 10.5px; color: #8f88a8; letter-spacing: 0; }
  .mh-menu .p { font-size: 12px; color: #1f5fae; font-weight: 700; font-variant-numeric: tabular-nums; }
  .mh-menu .stamp { position: absolute; right: 4px; top: -8px; transform: rotate(-8deg); padding: 0 5px; border: 1.5px solid #d23a2a;
    border-radius: 4px; color: #d23a2a; background: #fff5f0; font: 800 9px/1.4 system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; }
  /* the pause card (m.html's .scrim/.card look) */
  .mh-pause .badge { position: static; display: inline-block; margin: 0 0 8px; box-shadow: none; background: #efe5ea; }
  .mh-pause .card { width: min(100%, 460px); }
  @media (orientation: landscape) and (max-height: 540px) {
    .mh-pause .card { width: min(100%, 700px); flex-direction: row; }
    .mh-pause .col { flex: 1; padding: 14px 16px; }
    .mh-pause .col + .col { border-left: 1.5px solid #efe5ea; }
    .mh-top { flex-direction: row; }
  }
  .mh-pause .col { padding: 14px 18px 16px; }
  .mh-pause .body { border-top: 3px solid var(--sakura); padding: 0; display: flex; flex-direction: column; }
  @media (orientation: landscape) and (max-height: 540px) { .mh-pause .body { flex-direction: row; border-top: 0; } }
  @media (orientation: portrait) {
    .mh-menu { width: min(94vw, 420px); bottom: max(118px, calc(var(--safe-b) + 108px)); }
    .mh-menu ol { grid-template-columns: repeat(3, 1fr); }
  }
`;

export function createMobileHud({ volume = 50, menu = [] } = {}) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = 'mh off';
  root.innerHTML = `
    <div class="mh-play">
      <div class="mh-cross"></div>
      <div class="mh-top">
        <button class="mh-btn" data-b="whistle" aria-label="${M.buttons.whistle}">${ICON.paw}</button>
        <button class="mh-btn" data-b="time" aria-label="${M.buttons.time}">${ICON.dusk}</button>
        <button class="mh-btn" data-b="map" aria-label="${M.buttons.map}">${ICON.map}</button>
        <button class="mh-btn" data-b="pause" aria-label="${M.buttons.pause}">${ICON.pause}</button>
      </div>
      <div class="mh-act"><button data-b="act" aria-label="${M.buttons.act}">${ICON.hand}</button><span></span></div>
      <aside class="mh-menu" aria-live="polite"></aside>
    </div>
    <div class="mh-toast" role="status"></div>
    <button class="mh-pill" data-b="sound">${M.soundBack}</button>
  `;
  document.body.appendChild(root);

  const pause = document.createElement('div');
  pause.className = 'scrim see-through mh-pause hidden';
  pause.setAttribute('role', 'dialog');
  pause.setAttribute('aria-modal', 'true');
  pause.innerHTML = `
    <section class="card">
      <div class="body">
        <div class="col">
          <span class="badge">${M.paused}</span>
          <p class="tagline" style="margin:0 0 2px;font-family:'Iowan Old Style',Palatino,Georgia,serif;font-size:22px;font-weight:600;color:#2a2140">${STRINGS.title}</p>
          <div class="vol"><span>${M.volume}</span><div class="steps">${VOLUME_STEPS.map((v) => `<button type="button" data-v="${v}" aria-pressed="false">${v}</button>`).join('')}</div></div>
          <button class="btn" type="button" data-b="resume">${M.resume}</button>
          <div class="row"><button class="btn soft" type="button" data-b="restart">${M.restart}</button></div>
        </div>
        <div class="col">
          <dl class="help">${M.help.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>
          <p class="note ios">${M.silent}</p>
          <p class="url">${STRINGS.credit} · <a href="credits.html" target="_blank" rel="noopener">${STRINGS.credits}</a></p>
        </div>
      </div>
    </section>`;
  document.body.appendChild(pause);

  const $ = (sel, r = root) => r.querySelector(sel);
  const toast = $('.mh-toast'), act = $('.mh-act'), actLabel = act.querySelector('span'), kmenu = $('.mh-menu');
  const cross = $('.mh-cross'), pill = $('.mh-pill'), timeBtn = $('[data-b="time"]'), mapBtn = $('[data-b="map"]');
  let toastTimer = null, lastAct = null, menuKey = '';

  const api = {
    root,
    /** Each tap of a button: 'pause' | 'map' | 'time' | 'whistle' | 'act' | 'resume' | 'restart' | 'sound' | ['pick', id]. */
    onButton: null,
    onVolumeChange: null,
    flash(text, ms = 1400, error = false) {
      toast.textContent = text;
      toast.classList.toggle('err', error);
      toast.classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('on'), ms);
    },
    /** Playing (the controls show) or not (the pause card, unless `card` is false: the start card is up). */
    setPlaying(on, card = true) {
      root.classList.toggle('off', !on);
      pause.classList.toggle('hidden', on || !card);
    },
    get paused() { return !pause.classList.contains('hidden'); },
    /** What the hand does here (the experience's label, "Sit · ひと休み"), or null. */
    setAction(label) {
      if (label === lastAct) return;
      lastAct = label;
      act.classList.toggle('on', !!label);
      if (label) actLabel.textContent = label;
    },
    setCrosshair(on) { cross.classList.toggle('hidden', !on); },
    setTime(name) {
      timeBtn.innerHTML = TIME_ICON[name] ?? ICON.sun;
      timeBtn.setAttribute('aria-label', `${M.buttons.time}: ${M.times[name] ?? name}`);
    },
    setMapOpen(on) { mapBtn.classList.toggle('on', on); },
    /** The konbini's choice: catalogue ids (null hides it). */
    menu(ids) {
      kmenu.classList.toggle('on', !!ids);
      if (!ids || menuKey === ids.join()) return;
      menuKey = ids.join();
      const S = STRINGS.store;
      kmenu.innerHTML = `<h3>${S.menuTitle}<span>${M.menuHint}</span></h3><ol>${ids.map((id) => {
        const p = PRODUCT[id];
        const rec = id === STORE.recommended ? `<span class="stamp">${S.recommended}</span>` : '';
        return `<li><button type="button" data-pick="${id}">${rec}<b>${S.menuNames[id] ?? p.nameEn}</b><span class="mh-jp" lang="ja">${p.nameJa}</span><span class="p">${yen(p.priceYen)}</span></button></li>`;
      }).join('')}</ol>`;
    },
    get menuOpen() { return kmenu.classList.contains('on'); },
    setVolume(step) {
      for (const b of pause.querySelectorAll('[data-v]')) b.setAttribute('aria-pressed', String(Number(b.dataset.v) === step));
    },
    /** The "tap to bring the sound back" pill (an interruption the phone won't resume without a tap). */
    askForSound(on) { pill.classList.toggle('on', on); },
  };
  api.setVolume(volume);

  const onTap = (e) => {
    const b = e.target.closest('[data-b], [data-pick], [data-v]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    if (b.dataset.pick) api.onButton?.(['pick', b.dataset.pick]);
    else if (b.dataset.v !== undefined) { const v = Number(b.dataset.v); api.setVolume(v); api.onVolumeChange?.(v); }
    else api.onButton?.(b.dataset.b);
  };
  // click, not pointerdown: a click is a user activation (the sound may start or wake in it)
  root.addEventListener('click', onTap);
  pause.addEventListener('click', onTap);
  // the buttons' touches never reach the look or the stick (touch.js listens on the page)
  for (const el of [root, pause]) el.addEventListener('pointerdown', (e) => { if (e.target.closest('button, a')) e.stopPropagation(); });
  return api;
}
