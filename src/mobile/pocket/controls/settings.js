/* ------------------------------------------------------------------ *
 * The look's sensitivity (the pause card's "Look speed"): five steps,
 * remembered on this phone.  hud.js writes it, touch.js reads it on every
 * drag, so a change on the card is felt at once.
 * ------------------------------------------------------------------ */

const KEY = 'takemebacktojapan-look';
export const LOOK_STEPS = [1, 2, 3, 4, 5];
const SCALE = { 1: 0.6, 2: 0.8, 3: 1, 4: 1.25, 5: 1.55 };
const DEFAULT = 3;

let step = DEFAULT;
try {
  const v = Number(localStorage.getItem(KEY));
  if (LOOK_STEPS.includes(v)) step = v;
} catch { /* private mode: the default */ }

export const lookSetting = {
  get step() { return step; },
  /** The multiplier on the look's base sensitivity. */
  get scale() { return SCALE[step] ?? 1; },
  set(v) {
    if (!LOOK_STEPS.includes(v)) return;
    step = v;
    try { localStorage.setItem(KEY, String(v)); } catch { /* optional */ }
  },
};
