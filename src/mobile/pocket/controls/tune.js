import { MOBILE } from '../../../config.js';

/* ------------------------------------------------------------------ *
 * The pocket town's controls, as numbers (docs/pocket-diorama.md,
 * builder 5).  Defaults here; config.js MOBILE.pocket.controls (the
 * lead's) overrides any of them, key by key, so the feel can be tuned in
 * one place without touching this code.
 * ------------------------------------------------------------------ */

const DEFAULTS = {
  stick: {
    zone: 0.45,          // the left part of the screen a thumb can land in to walk (0..1 of the width)
    top: 0.22,           // ... below this part of the height (the top is for the screen's own corner)
    radius: MOBILE.stick?.radius ?? 56,   // px: a full push
    dead: 0.1,           // of the radius: no walking within it
    follow: 1.2,         // past this many radii the stick's centre trails the thumb (it never runs away from you)
    stroll: 0.3,         // the slowest pace, of the walk (a small push)
    curve: 1.35,         // the push to pace curve (1 linear; more is gentler at first)
    edge: 0.93,          // a push at least this far counts as "at the edge" ...
    runAfter: 0.4,       // ... and held there this long (s) breaks into a run
    runHold: 0.78,       // a run lasts while the push stays over this
    runBlend: 0.35,      // s: walk to run, eased
  },
  look: {
    base: MOBILE.look ?? 0.0052,   // rad per CSS px at gain 1
    slow: 0.75,          // the gain for a slow, careful drag ...
    fast: 2.4,           // ... and for a flick
    v0: 0.15, v1: 1.9,   // px/ms: where the curve starts and where it tops out
    smooth: 0.35,        // the speed's smoothing over the finger's samples (0 none .. 1 frozen)
    settleAfter: 0.9,    // s with no look while walking before the pitch eases back level ...
    settleRate: 0.7,     // ... at this rate (1/s)
    settleTo: -0.03,     // ... to here (rad, a touch below the horizon)
  },
  tap: { ms: 260, px: 12, reach: 7, radius: 70 },   // a tap on a thing: quick, still; within reach (m) and this close on screen (px)
  label: { ms: 3200, cooldown: 45, near: 0.55, max: 2 },   // the sound labels: shown for ms, once per cooldown s per name, within near of a sound's near..far, at most max at once
};

const over = MOBILE.pocket?.controls ?? {};
export const TUNE = Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, { ...v, ...(over[k] ?? {}) }]));

export const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The stick's push (0..1, past the dead zone already taken out) to a pace, of the walk: a stroll to a walk. */
export function stickPace(push, S = TUNE.stick) {
  if (push <= 0) return 0;
  return S.stroll + (1 - S.stroll) * Math.pow(Math.min(1, push), S.curve);
}

/** A drag's speed (px/ms) to the look's gain: slow is precise, a flick turns fast. */
export function lookGain(v, L = TUNE.look) {
  return L.slow + (L.fast - L.slow) * smoothstep(L.v0, L.v1, v);
}
