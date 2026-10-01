import { SOUND } from '../../../config.js';
import { MOBILE_STRINGS as M } from '../../../data/strings.js';
import { TUNE } from './tune.js';

/* ------------------------------------------------------------------ *
 * Sound name labels (docs/pocket-diorama.md, builder 5): when a named
 * sound starts near you, a small pill fades in for a few seconds with its
 * name, Japanese · English (ぴよぴよ · crosswalk chick).
 *
 * The engine (core/sound.js) is the desktop's and stays untouched: this
 * wraps the one engine object of the phone build, in place, so every way
 * a sound starts is seen -- zones (soundBus.zone and a place's `sounds`),
 * one-shots, the konbini's chime, the crossing's bells, the walk signals.
 * Call it before soundBus.attach(sound), so the zones the world queued
 * pass through the wrapped zone().
 *
 *   near you   inside the sound's near..far by TUNE.label.near (a zone's
 *              far edge, where it is a whisper, does not count)
 *   once       a name is shown at most once per TUNE.label.cooldown s, and
 *              a zone again only after you have left its `far`
 *   heard      only while playing, the sound running and not muted
 *
 * The words are MOBILE_STRINGS.soundNames, keyed by the engine's names.
 * ------------------------------------------------------------------ */

export function watchSoundLabels(sound, { isPlaying = () => true, show } = {}) {
  if (!sound || sound.__labels) return sound?.__labels;
  const T = TUNE.label, NAMES = M.soundNames ?? {};
  const listener = { x: 0, z: 0, known: false };
  const lastShown = new Map();            // name -> performance.now()
  const zones = [];                        // { name, o, inside }

  const reach = (r) => r.near + (r.far - r.near) * T.near;
  const heard = () => {
    if (!isPlaying() || sound.muted || !sound.ready) return false;
    const ac = sound.graph()?.ac;
    return !ac || ac.state === 'running';
  };
  function announce(name) {
    const words = NAMES[name];
    if (!words || !heard()) return false;
    const now = performance.now(), last = lastShown.get(name) ?? -1e9;
    if (now - last < T.cooldown * 1000) return false;
    lastShown.set(name, now);
    show?.(words, name);
    return true;
  }
  const near = (x, z, r) => listener.known && Math.hypot(x - listener.x, z - listener.z) < reach(r);

  const wrap = (key, fn) => { const orig = sound[key]?.bind(sound); if (orig) sound[key] = (...a) => fn(orig, ...a); };

  // zones: kept in view here; entered (near you) each frame in update
  wrap('zone', (orig, name, o = {}) => {
    const z = { name, o: { near: 8, far: 30, x: 0, z: 0, ...o }, inside: false };
    zones.push(z);
    const h = orig(name, o);
    return { ...h, set: (p) => { Object.assign(z.o, p); return h.set(p); } };
  });
  wrap('oneShot', (orig, name, o = {}) => {
    const h = orig(name, o);
    if (o.x === undefined || near(o.x, o.z, { near: o.near ?? 6, far: o.far ?? 40 })) announce(name);
    return h;
  });
  wrap('storeChime', (orig, at) => {
    if (at && near(at.x, at.z, SOUND.storeChime)) announce('store-chime');
    return orig(at);
  });
  let bellsOn = false;
  wrap('bells', (orig, on, distance) => {
    const was = bellsOn;
    bellsOn = on && distance < SOUND.crossingBells.far;
    if (bellsOn && !was && distance < reach(SOUND.crossingBells)) announce('railway-bells');
    return orig(on, distance);
  });
  const walkOn = [];
  wrap('walkSignals', (orig, list) => {
    list.forEach((w, i) => {
      const on = !!w.on && near(w.x, w.z, SOUND.walkSignal);
      if (on && !walkOn[i]) announce('walk-' + (w.sound ?? 'piyo'));
      walkOn[i] = on;
    });
    return orig(list);
  });
  wrap('update', (orig, dt, o) => {
    const c = o?.camera?.position;
    if (c) { listener.x = c.x; listener.z = c.z; listener.known = true; }
    for (const z of zones) {
      const d = Math.hypot(z.o.x - listener.x, z.o.z - listener.z);
      if (d >= z.o.far) { z.inside = false; continue; }          // left it: next time it is new again
      if (!z.inside && d < reach(z.o) && (!z.o.indoor || o?.inside) && heard()) { z.inside = true; announce(z.name); }
    }
    return orig(dt, o);
  });

  const api = { announce, get zones() { return zones.length; } };
  sound.__labels = api;
  return api;
}

/** The pill itself: a small label, top left, that fades in and out (CSS; no timers per frame). */
export function createSoundLabel(parent = document.body) {
  const T = TUNE.label;
  const style = document.createElement('style');
  style.textContent = `
    .snd { position: fixed; z-index: 6; left: max(14px, calc(var(--safe-l) + 8px)); top: max(12px, calc(var(--safe-t) + 6px));
      display: flex; flex-direction: column; align-items: flex-start; gap: 6px; pointer-events: none; }
    .snd span { display: inline-flex; align-items: center; gap: 7px; padding: 6px 13px 6px 10px; border-radius: 999px;
      background: rgba(43,37,66,.62); color: #fff; font: 600 13px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); box-shadow: 0 3px 12px rgba(20,12,40,.25);
      animation: snd-in ${T.ms}ms ease forwards; white-space: nowrap; }
    .snd svg { width: 14px; height: 14px; flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; opacity: .85; }
    .snd [lang='ja'] { font-family: 'Hiragino Maru Gothic ProN', 'Hiragino Sans', 'Noto Sans JP', sans-serif; font-weight: 700; }
    .snd i { font-style: normal; opacity: .55; }
    @keyframes snd-in { 0% { opacity: 0; transform: translateY(-4px); } 10%, 82% { opacity: 1; transform: none; } 100% { opacity: 0; } }
    body.game-paused .snd { visibility: hidden; }
    @media (orientation: portrait) { .snd { top: max(66px, calc(var(--safe-t) + 60px)); } }
    @media (prefers-reduced-motion: reduce) { .snd span { animation-timing-function: steps(1, end); } }
  `;
  document.head.appendChild(style);
  const box = document.createElement('div');
  box.className = 'snd';
  box.setAttribute('aria-live', 'polite');
  parent.appendChild(box);
  const NOTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
  return function show([ja, en]) {
    while (box.children.length >= T.max) box.firstElementChild.remove();
    const el = document.createElement('span');
    el.innerHTML = `${NOTE}<b lang="ja"></b><i>·</i><em style="font-style:normal"></em>`;
    el.querySelector('b').textContent = ja;
    el.querySelector('em').textContent = en;
    el.addEventListener('animationend', () => el.remove());
    box.appendChild(el);
  };
}
