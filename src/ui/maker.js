import { STRINGS } from '../data/strings.js';
import { MAKER } from '../config.js';

/* ------------------------------------------------------------------ *
 * Made by Tan (Tan, 2026-10-01; DECISIONS.md "Made by Tan").
 *
 *   chip      on the start and pause cards' art, bottom right (the empty
 *             road below the RX-7): Tan's face, the name, Coffee first,
 *             then X, GitHub and the site
 *   row       the same under a phone card's words
 *   postcard  once, when Hachi's tour is over and he naps by the gate:
 *             share the town, follow the maker (ui/postcard.js, loaded
 *             only then)
 *
 * Plain links in a new tab (rel=noopener); icons drawn here as inline
 * SVG; nothing loaded from another site.  Each link and button carries a
 * DataFast goal (data-fast-goal, the desktop site only runs DataFast).
 * Pure strings at import: vite.config.js writes the chip and the row into
 * the pages' cards (`%MAKER:chip%`, `%MAKER:row%`, `%MAKER:css%`).
 * ------------------------------------------------------------------ */

const S = STRINGS.maker;
const L = MAKER.links;

export const ICON = {
  coffee: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h12.5v4.2A5.8 5.8 0 0 1 10.7 19h-.9A5.8 5.8 0 0 1 4 13.2z"/><path d="M16.3 10.3h1.4a2.4 2.4 0 0 1 0 4.8h-1.9" class="o"/><path d="M7.6 3.2c-.8 1 .8 1.6 0 2.8M11 3.2c-.8 1 .8 1.6 0 2.8" class="o"/><rect x="3" y="20" width="15" height="1.6" rx=".8"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.3 4.7H5.5z"/></svg>',
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .8a11.2 11.2 0 0 0-3.5 21.8c.56.1.76-.24.76-.54v-1.9c-3.1.68-3.77-1.33-3.77-1.33-.5-1.3-1.24-1.64-1.24-1.64-1.02-.7.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 1.71 2.62 1.22 3.26.93.1-.72.39-1.22.71-1.5-2.48-.28-5.09-1.24-5.09-5.53 0-1.22.44-2.22 1.15-3-.11-.28-.5-1.42.11-2.96 0 0 .94-.3 3.08 1.15a10.7 10.7 0 0 1 5.62 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.54.23 2.68.11 2.96.72.78 1.15 1.78 1.15 3 0 4.3-2.62 5.25-5.11 5.52.4.35.76 1.03.76 2.08v3.08c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8z"/></svg>',
  site: '<svg viewBox="0 0 24 24" aria-hidden="true" class="o"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.5-3.9 9c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true" class="o"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true" class="o"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>',
};

export const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** A link out: a new tab, no opener, its DataFast goal and where it was clicked. */
const out = (href, cls, inner, goal, where, label) =>
  `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener" data-fast-goal="${goal}" data-fast-goal-where="${where}"${label ? ` aria-label="${esc(label)}" title="${esc(label)}"` : ''}>${inner}</a>`;
export const face = (px) => `<img class="mk-face" src="${MAKER.avatar}" width="${px}" height="${px}" alt="${esc(S.avatarAlt)}" decoding="async" />`;
export const coffee = (where, label) => out(L.coffee, 'mk-coffee', `${ICON.coffee}<span>${esc(label)}</span>`, 'maker_coffee', where, label === S.coffee ? S.coffeeLong : null);
export const icons = (where) => out(L.x, 'mk-i', ICON.x, 'maker_x', where, S.x)
  + out(L.github, 'mk-i', ICON.github, 'maker_github', where, S.github)
  + out(L.site, 'mk-i', ICON.site, 'maker_site', where, S.site);

/** The postcard's Fuji stamp (the postcard, and the little postcard on the pause card). */
export const STAMP = '<svg viewBox="0 0 60 74" aria-hidden="true"><rect width="60" height="74" fill="#f6d9c8"/><rect width="60" height="44" fill="#c9a7d8"/>'
  + '<path d="M0 52 22 20l6 5 5-6 27 33v22H0z" fill="#8a7fb8"/><path d="M22 20l6 5 5-6 6 7-5-1-6 4-5-3-6 3z" fill="#fff"/>'
  + '<circle cx="47" cy="12" r="5" fill="#f4a96b"/><rect y="58" width="60" height="16" fill="#e59bb0"/>'
  + '<text x="30" y="69" font-size="8" font-weight="700" text-anchor="middle" fill="#fff" font-family="sans-serif">¥120</text></svg>';

/** The chip on the start and pause cards' art.  `where`: the DataFast label (hud.js updates it start/pause). */
export const makerChip = (where = 'start_card') =>
  `<div class="mk mk-chip">${face(48)}<span class="mk-who">${esc(S.name)}<small>${esc(S.line)}</small></span>`
  + `<span class="mk-links">${coffee(where, S.coffee)}${icons(where)}</span></div>`;

/** The row under a phone card's words: the face and the name; under them Buy Tan a coffee, then the icons. */
export const makerRow = (where = 'phone_card') =>
  `<div class="mk mk-row"><div class="mk-row-top">${face(44)}<span class="mk-who">${esc(S.name)}<small>${esc(S.follow)}</small></span></div>`
  + `<div class="mk-links">${coffee(where, S.coffeeLong)}${icons(where)}</div></div>`;

/** The chip's and the row's look (the cards' paper, ink and sakura), for the pages' own <style>. */
export const MAKER_CSS = `
  .mk a { color: inherit; text-decoration: none; }
  .mk svg { display: block; width: 100%; height: 100%; fill: currentColor; }
  .mk svg.o, .mk svg .o { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .mk-face { display: block; flex: none; border-radius: 50%; background: #3b3263; box-shadow: 0 0 0 2px #fff, 0 0 0 3.5px #e59bb0; }
  .mk-i { display: grid; place-items: center; flex: none; border-radius: 50%; color: #3b3263; background: #fff; border: 1px solid #e3d9e0;
    transition: background .15s ease, color .15s ease, transform .15s ease; }
  .mk-i:hover { background: #3b3263; color: #fff; transform: translateY(-1px); }
  .mk-coffee { display: inline-flex; align-items: center; gap: .45em; flex: none; border-radius: 999px; font-weight: 700; white-space: nowrap;
    background: #ffdd57; color: #2b2542; box-shadow: inset 0 -2px 0 rgba(0,0,0,.08); transition: background .15s ease, transform .15s ease; }
  .mk-coffee:hover { background: #ffe57d; transform: translateY(-1px); }
  .mk-coffee svg { width: 1.25em; height: 1.25em; }
  .mk a:focus-visible { outline: 3px solid #e59bb0; outline-offset: 2px; }
  .mk-who { font-weight: 700; line-height: 1.15; white-space: nowrap; color: #2b2542; }
  .mk-who small { display: block; margin-top: .15em; font-size: .86em; font-weight: 500; color: #6c6482; }
  .mk-links { display: flex; align-items: center; }

  /* on the cards' art: the empty road below the RX-7 (cqw: the card's width) */
  .mk-chip { position: absolute; right: 1.6cqw; bottom: 1.6cqw; z-index: 2; cursor: default;
    display: grid; grid-template-columns: auto auto; align-items: center; column-gap: .9cqw; row-gap: .45cqw;
    padding: .8cqw 1.1cqw .8cqw .8cqw; border-radius: 1.3cqw;
    background: rgba(251,246,240,.93); box-shadow: 0 .8cqw 2.2cqw -.8cqw rgba(20,10,40,.55);
    font-size: max(11px, .98cqw); }
  .mk-chip .mk-face { grid-row: span 2; width: max(38px, 3.6cqw); height: max(38px, 3.6cqw); }
  .mk-chip .mk-links { gap: max(4px, .45cqw); }
  .mk-chip .mk-coffee { padding: max(3px, .3cqw) max(8px, .8cqw) max(3px, .3cqw) max(6px, .6cqw); font-size: .92em; }
  .mk-chip .mk-i { width: max(24px, 2.1cqw); height: max(24px, 2.1cqw); padding: max(5px, .45cqw); }
  @media (max-width: 800px) { .mk-chip { right: 10px; bottom: 10px; } }

  /* under a phone card's words */
  .mk-row { margin: 14px 0 0; padding: 12px 0 0; border-top: 1px dashed #e3d6da; text-align: left; }
  .mk-row-top { display: flex; align-items: center; gap: 12px; }
  .mk-row .mk-face { width: 44px; height: 44px; }
  .mk-row .mk-who { flex: 1; min-width: 0; white-space: normal; font-size: 14px; }
  .mk-row .mk-who small { margin-top: 3px; font-size: 12.5px; }
  .mk-row .mk-links { gap: 6px; margin: 10px 0 0; }
  .mk-row .mk-i { width: 38px; height: 38px; padding: 9.5px; }
  .mk-row .mk-coffee { flex: 1; min-width: 0; justify-content: center; min-height: 38px; padding: 8px 12px 8px 10px; font-size: 14.5px; }
`;
