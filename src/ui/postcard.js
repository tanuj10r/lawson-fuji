import { STRINGS } from '../data/strings.js';
import { MAKER } from '../config.js';
import { TOWN_NAME } from '../data/town.js';
import { ICON, STAMP, esc, face, coffee, icons } from './maker.js';

/* The postcard (Tan, 2026-10-01; DECISIONS.md "Made by Tan"): from the
 * pause card's little postcard on any pause, and by itself once, when
 * Hachi's tour is over and he naps by the gate.  Share the town (the
 * system's share sheet where there is one, the link, a post on X) and
 * follow the maker.  Its own chunk: loaded when first wanted, never before. */

const S = STRINGS.maker;
const P = STRINGS.postcard;

const POSTCARD_CSS = `
  .mk-post-scrim { position: fixed; inset: 0; z-index: 8; display: grid; place-items: center; padding: 16px; cursor: pointer;
    background: radial-gradient(ellipse at 50% 45%, rgba(40,30,62,.28), rgba(18,14,32,.62));
    opacity: 0; transition: opacity .45s ease; }
  .mk-post-scrim.on { opacity: 1; }
  .mk-post { container-type: inline-size; position: relative; width: min(860px, 72vw, calc((100vh - 80px) * 1.62)); aspect-ratio: 1.62;
    display: grid; grid-template-columns: 1.08fr 1fr; border-radius: 10px; cursor: default;
    background: #fdf8ef; color: #2b2542; transform: rotate(-1.2deg) translateY(12px); transition: transform .5s ease;
    box-shadow: 0 40px 90px -30px rgba(8,4,24,.8), 0 0 0 1px rgba(255,255,255,.1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }
  .mk-post-scrim.on .mk-post { transform: rotate(-1.2deg); }
  .mk-post [lang='ja'] { font-family: 'Hiragino Maru Gothic ProN', 'Hiragino Sans', 'Yu Gothic UI', 'Yu Gothic', Meiryo, sans-serif; }
  .mk-post .pic { position: relative; margin: 2.4cqw 0 2.4cqw 2.4cqw; border-radius: 4px; overflow: hidden; background: #b98ab4; }
  .mk-post .pic img { width: 100%; height: 100%; object-fit: cover; object-position: 38% 40%; display: block; }
  .mk-post .pic figcaption { position: absolute; left: 1.4cqw; bottom: 1.2cqw; padding: .5cqw 1.1cqw; border-radius: 999px;
    background: rgba(251,246,240,.9); font-size: max(10px, 1.2cqw); font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
  .mk-post .pic figcaption span { letter-spacing: .06em; }
  .mk-post .pc-back { position: absolute; left: 3.4cqw; top: 3.4cqw; z-index: 2; padding: .55cqw 1.3cqw .55cqw 1cqw; border: 0; border-radius: 999px;
    background: rgba(251,246,240,.94); color: #2b2542; box-shadow: 0 4px 14px -6px rgba(20,10,40,.5);
    font: inherit; font-size: max(12px, 1.35cqw); font-weight: 700; letter-spacing: .02em; cursor: pointer; }
  .mk-post .pc-back:hover { background: #fff; transform: translateX(-1px); }
  /* Add your selfie: the postcard's first, plain-to-see button, over the share row (ui/postcardSelfie.js, loaded on
   * its click).  While the selfie is on, its words and buttons take the place of the message and the address lines. */
  .mk-post .pc-add { display: flex; align-items: center; justify-content: center; gap: .8cqw; width: 100%; margin: 1.4cqw 0 0; padding: 1.45cqw 1cqw;
    border: 0; border-radius: .9cqw; background: #3b3263; color: #fff; box-shadow: 0 .9cqw 1.8cqw -1cqw rgba(40,25,80,.9), inset 0 -2px 0 rgba(0,0,0,.18);
    font: inherit; font-size: max(14px, 1.75cqw); font-weight: 700; line-height: 1.2; white-space: nowrap; cursor: pointer; }
  .mk-post .pc-add svg { width: 1.3em; height: 1.3em; flex: none; }
  .mk-post .pc-add:hover { background: #4a3f7a; transform: translateY(-1px); }
  .mk-post .pc-add:focus-visible { outline: 3px solid #e59bb0; outline-offset: 2px; }
  .mk-post .pc-add + .share { margin-top: 0; padding-top: .9cqw; }
  .mk-post.sf-on figcaption, .mk-post.sf-on .msg, .mk-post.sf-on .to, .mk-post.sf-on .pc-add { display: none; }
  .mk-post.sf-on .share { margin-top: 0; padding-top: .9cqw; }
  .mk-post .pc-back:focus-visible { outline: 3px solid #e59bb0; outline-offset: 2px; }
  .mk-post .back { position: relative; padding: 2.8cqw 3cqw 2.4cqw 3.2cqw; display: flex; flex-direction: column; min-width: 0; }
  .mk-post .back::before { content: ''; position: absolute; left: 0; top: 3.2cqw; bottom: 3.2cqw; border-left: 1.5px solid #e2d6d0; }
  .mk-post .stamp { position: absolute; right: 2.6cqw; top: 2.4cqw; width: 8.6cqw; aspect-ratio: .82; padding: .5cqw;
    background: #fff; border: 1.5px dashed #d9c9c4; transform: rotate(4deg); }
  .mk-post .stamp svg { width: 100%; height: 100%; display: block; }
  .mk-post .mark { position: absolute; right: 7.4cqw; top: 6.6cqw; width: 7.4cqw; height: 7.4cqw; border-radius: 50%;
    border: 2px solid rgba(208,58,70,.5); color: rgba(208,58,70,.68); display: grid; place-items: center; text-align: center;
    font-size: max(8px, .95cqw); font-weight: 700; line-height: 1.25; transform: rotate(-12deg); pointer-events: none; }
  .mk-post h2 { margin: 0 13cqw 1.1cqw 0; font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
    font-size: max(17px, 2.9cqw); line-height: 1.1; font-weight: 600; color: #2a2140; }
  .mk-post .msg { margin: 0 12.5cqw 0 0; font-size: max(12px, 1.5cqw); line-height: 1.5; color: #6c6482; }
  /* the address side's ruled lines, the first written on, filling what the words leave */
  .mk-post .to { flex: 1; min-height: 3.6cqw; margin: 1.4cqw 0 0; padding: 0 0 0 .3cqw; overflow: hidden;
    background: repeating-linear-gradient(transparent 0 calc(3.6cqw - 1px), #e6dad4 calc(3.6cqw - 1px) 3.6cqw);
    font: italic 500 max(13px, 1.8cqw)/3.6cqw 'Bradley Hand', 'Segoe Print', 'Segoe Script', cursive; color: #5a4f7a; }
  .mk-post .share { display: flex; gap: .9cqw; margin: auto 0 0; padding-top: 1.6cqw; }
  .mk-post .share > * { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: .6cqw; min-width: 0;
    padding: 1.05cqw .8cqw; border-radius: .9cqw; border: 1.5px solid #3b3263; background: #fff; color: #3b3263; text-decoration: none;
    font: inherit; font-size: max(12px, 1.45cqw); line-height: 1.2; font-weight: 700; white-space: nowrap; cursor: pointer; }
  .mk-post .share > .primary { background: #3b3263; color: #fff; }
  .mk-post .share > :hover { transform: translateY(-1px); }
  .mk-post .share > :focus-visible { outline: 3px solid #e59bb0; outline-offset: 2px; }
  .mk-post .share svg { width: 1.2em; height: 1.2em; flex: none; }
  .mk-post .share .no-share { display: none; }
  .mk-post .maker { display: grid; grid-template-columns: auto 1fr; align-items: center; column-gap: 1.2cqw; row-gap: .5cqw;
    margin-top: 1.6cqw; padding-top: 1.5cqw; border-top: 1px dashed #e3d6da; font-size: max(11px, 1.3cqw); }
  .mk-post .maker .mk-face { grid-row: span 2; width: max(36px, 5cqw); height: max(36px, 5cqw); }
  .mk-post .maker .mk-links { gap: max(5px, .6cqw); }
  .mk-post .maker .mk-i { width: max(26px, 3.1cqw); height: max(26px, 3.1cqw); padding: max(6px, .7cqw); }
  .mk-post .maker .mk-coffee { padding: max(4px, .55cqw) max(10px, 1.2cqw) max(4px, .55cqw) max(8px, .9cqw); font-size: .95em; }
  .mk-post .note { position: absolute; left: 0; right: 0; bottom: -2.6em; margin: 0; text-align: center; white-space: pre;
    color: rgba(255,246,236,.88); font-size: 13px; font-weight: 600; letter-spacing: .03em; pointer-events: none; }
  /* a phone held upright: the picture over the words */
  @media (max-width: 700px) and (orientation: portrait) {
    .mk-post { width: min(100%, 420px); aspect-ratio: auto; grid-template-columns: 1fr; transform: rotate(-.8deg) translateY(12px); }
    .mk-post-scrim.on .mk-post { transform: rotate(-.8deg); }
    .mk-post .pic { margin: 12px 12px 0; aspect-ratio: 16 / 10; }
    .mk-post .pc-back { left: 20px; top: 20px; padding: 7px 14px 7px 11px; font-size: 14px; }
    .mk-post .back { padding: 16px 18px 16px; }
    .mk-post .back::before, .mk-post .mark, .mk-post .to { display: none; }
    .mk-post .stamp { top: 14px; right: 14px; width: 50px; padding: 3px; }
    .mk-post h2 { font-size: 22px; margin: 0 62px 6px 0; }
    .mk-post .msg { font-size: 14px; margin: 0 62px 0 0; }
    .mk-post .share { gap: 8px; padding-top: 14px; }
    .mk-post .pc-add { margin: 14px 0 0; padding: 13px 8px; border-radius: 9px; font-size: 16px; gap: 8px; }
    .mk-post .pc-add + .share, .mk-post.sf-on .share { padding-top: 8px; }
    .mk-post .share > * { padding: 10px 6px; border-radius: 9px; font-size: 14px; gap: 6px; }
    .mk-post .maker { column-gap: 12px; margin-top: 14px; padding-top: 12px; font-size: 13.5px; }
    .mk-post .maker .mk-face { width: 44px; height: 44px; }
    .mk-post .maker .mk-i { width: 34px; height: 34px; padding: 8px; }
    .mk-post .maker .mk-coffee { min-height: 34px; padding: 6px 13px 6px 10px; }
    .mk-post .note { position: static; padding: 0 0 14px; color: #6c6482; white-space: normal; }
  }
  /* a phone on its side: everything a size down to fit the short screen */
  @media (orientation: landscape) and (max-height: 540px) {
    .mk-post { width: min(92vw, calc((100vh - 24px) * 1.62)); }
    .mk-post .note, .mk-post .mark { display: none; }
    .mk-post .share > * { font-size: 12.5px; padding: 7px 5px; }
    .mk-post .maker { font-size: 12px; }
    .mk-post .maker .mk-face { width: 34px; height: 34px; }
  }
  @media (prefers-reduced-motion: reduce) { .mk-post-scrim, .mk-post { transition: none; } }
`;

/**
 * The postcard: built the first time it shows.  `touch`: the phone's words.
 * `onMenu`: Back, Esc, or a click outside the card (Tan: walking on is only
 * ever on purpose, Space or Resume; the caller shows the pause card).  Its
 * links and buttons, and a click on the card itself, keep it up.
 */
export function createPostcard({ touch = false, onMenu = () => {} } = {}) {
  let el = null, copyLabel = null, msg = null, shown = 0;
  let selfie = null, selfieLoad = null;      // ui/postcardSelfie.js: only once asked for
  const addSelfie = () => {
    selfieLoad ??= import('./postcardSelfie.js').then(({ createSelfie }) => { selfie = createSelfie({ post: el.querySelector('.mk-post') }); });
    selfieLoad.then(() => { if (api.open) selfie.open(); }).catch(() => { selfieLoad = null; });
  };
  /* Share: with the selfie postcard's picture where the share sheet takes files, else the link */
  const share = () => {
    const f = selfie?.file;
    const withFile = f && navigator.canShare?.({ files: [f] });
    navigator.share?.(withFile ? { files: [f], title: document.title, text: `${P.shareText} ${link}` } : { title: document.title, text: P.shareText, url: link }).catch(() => {});
  };
  const link = MAKER.share;
  const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(P.shareText)}&url=${encodeURIComponent(link)}&via=${MAKER.handle}`;
  const build = () => {
    const style = document.createElement('style');
    style.textContent = POSTCARD_CSS;
    document.head.appendChild(style);
    const d = new Date();
    el = document.createElement('div');
    el.className = 'mk mk-post-scrim';
    el.innerHTML = `<article class="mk-post" role="dialog" aria-modal="true" aria-label="${esc(P.label)}">
      <button class="pc-back" type="button" data-pc="back" aria-label="${esc(P.backAria)}">‹ ${esc(P.back)}</button>
      <figure class="pic"><img src="keyart-1280.webp" alt="" decoding="async" /><figcaption>${esc(TOWN_NAME.en)} · <span lang="ja">${esc(TOWN_NAME.jp)}</span></figcaption></figure>
      <div class="back">
        <div class="stamp">${STAMP}</div>
        <div class="mark" lang="ja" aria-hidden="true">${esc(TOWN_NAME.jp.replace(/町$/, ''))}<br>${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}</div>
        <h2>${esc(P.title)}</h2>
        <p class="msg">${esc(P.msg)}</p>
        <p class="to">${esc(P.to)}</p>
        <button class="pc-add" type="button" data-pc="selfie" data-fast-goal="postcard_selfie">${ICON.camera}<span>${esc(P.selfie.add)}</span></button>
        <div class="share">
          <button class="${navigator.share ? '' : 'no-share'}" type="button" data-pc="share" data-fast-goal="postcard_share">${ICON.share}<span>${esc(P.share)}</span></button>
          <button type="button" data-pc="copy" data-fast-goal="postcard_copy">${ICON.link}<span>${esc(P.copy)}</span></button>
          <a href="${esc(intent)}" target="_blank" rel="noopener" data-fast-goal="postcard_post" aria-label="${esc(P.postAria)}">${ICON.x}<span>${esc(P.post)}</span></a>
        </div>
        <div class="maker">${face(48)}<span class="mk-who">${esc(S.name)}<small>${esc(P.follow)}</small></span>
          <span class="mk-links">${coffee('postcard', S.coffee)}${icons('postcard')}</span></div>
      </div>
      <p class="note" aria-hidden="true">${esc(touch ? P.closeTouch : P.close)}</p>
    </article>`;
    copyLabel = el.querySelector('[data-pc=copy] span');
    msg = el.querySelector('.msg');
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = e.target.closest('[data-pc], a');
      if (!b) { if (!e.target.closest('.mk-post')) onMenu(); return; }
      const what = b.getAttribute('data-pc');
      if (what === 'back') onMenu();
      if (what === 'share') share();
      if (what === 'selfie') addSelfie();
      if (what === 'copy') copy();
    });
    for (const t of ['pointerdown', 'pointerup', 'touchstart', 'touchend']) el.addEventListener(t, (e) => e.stopPropagation(), { passive: true });
    document.body.appendChild(el);
  };
  const copied = () => { copyLabel.textContent = P.copied; setTimeout(() => { copyLabel.textContent = P.copy; }, 1800); };
  const copy = () => {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = link; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
      if (ok) copied();
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(copied, fallback);
    else fallback();
  };
  const onKey = (e) => {
    if (e.code !== 'Escape' || !api.open) return;
    e.preventDefault(); e.stopImmediatePropagation();
    onMenu();
  };
  const api = {
    open: false,
    /** times it has shown (once a page load, by its caller) */
    get shown() { return shown; },
    /** `again`: opened from the pause card's little postcard (counted by its own goal, not as shown).
     *  `toured`: Hachi's tour is over (the words say so); before that, wish you were here. */
    show(again = false, toured = true) {
      if (!el) build();
      msg.textContent = toured ? P.msg : P.msgEarly;
      api.open = true; shown++;
      el.style.display = '';
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
      window.addEventListener('keydown', onKey, true);
      if (!again) try { window.datafast?.('postcard_shown'); } catch { /* analytics never in the way */ }
      requestAnimationFrame(() => el.querySelector('.mk-post:not(.sf-on) .pc-add, .share > :not(.no-share)')?.focus({ preventScroll: true }));
    },
    hide() {
      if (!api.open) return;
      api.open = false;
      selfie?.stop();                  // the camera never outlives the postcard
      el.classList.remove('on');
      el.style.display = 'none';
      window.removeEventListener('keydown', onKey, true);
    },
    get el() { return el; },
    get selfie() { return selfie; },
  };
  return api;
}
