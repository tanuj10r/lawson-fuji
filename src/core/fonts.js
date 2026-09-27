import roundUrl from '../assets/fonts/round.woff2?url';
import brushUrl from '../assets/fonts/brush.woff2?url';

/* ------------------------------------------------------------------ *
 * The sign fonts (town quality pass): self-hosted, subset to the text the
 * game draws (scripts/subset-fonts.mjs, SIL OFL 1.1).  Canvas2D signs are
 * painted once, while the town builds, so the faces must be ready first:
 * main.js imports this module before anything else, and its top-level
 * await holds the build until they are (or have failed: the signs then
 * fall back to the system gothic, never to a blank).
 *
 *   JP_ROUND   M PLUS Rounded 1c Bold: friendly shop and street signs
 *   JP_BRUSH   Yuji Syuku: hand-lettered noren, lanterns, old boards
 *              (only the characters in src/data/town.js exist in it)
 * ------------------------------------------------------------------ */

const FACES = [
  new FontFace('NF Round', `url(${roundUrl}) format('woff2')`, { weight: '400 900' }),
  new FontFace('NF Brush', `url(${brushUrl}) format('woff2')`, { weight: '400 900' }),
];
await Promise.all(FACES.map((f) => f.load().then((ff) => document.fonts.add(ff)).catch(() => {})));
