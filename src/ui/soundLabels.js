import { SOUND, SOUND_LABELS } from '../config.js';

/* ------------------------------------------------------------------ *
 * Sound name labels (Tan, 2026-10-01: "the phone names each sound as you
 * hear it; the same on the computer, top left"): when a named sound
 * starts near you, a small paper pill fades in with its name, Japanese ·
 * English, and a few words about it (ぴよぴよ · crosswalk chick, the walk
 * signal's "go" sound), then fades out.
 *
 * The engine (core/sound.js) stays untouched: watchSoundLabels wraps the
 * one engine object in place, so every way a sound starts is seen -- the
 * zones (soundBus.zone), one-shots, the konbini's chime and music, the
 * crossing's bells, the walk signals, the train's door chime, the beds of
 * the time of day.  Call it before soundBus.attach(sound), so the zones
 * the world queued pass through the wrapped zone().
 *
 *   near you   inside the sound's near..far by `near` (a zone's far edge,
 *              where it is a whisper, does not count); a one-shot, which
 *              starts once and is not walked up to, by `shot`
 *   once       a name at most once per `cooldown` s, and a zone again only
 *              after you have left its `far`; the beds (wind, birds, night
 *              insects, crows) once a visit
 *   heard      only in play (no card up), the sound running and not muted
 *
 * The words are `names` (STRINGS.soundNames), keyed by the engine's names:
 * [japanese, english, a few words more].  A name not in the table shows
 * nothing (Hachi's sounds, footsteps, doors).
 *
 * Nothing here knows the desktop: the phone build can use the watcher as
 * it is, watchSoundLabels(sound, { names: MOBILE_STRINGS.soundNames,
 * tune: TUNE.label, isPlaying, show }), with its own pill.
 * ------------------------------------------------------------------ */

export function watchSoundLabels(sound, { names = {}, tune = SOUND_LABELS, isPlaying = () => true, show } = {}) {
  if (!sound || sound.__labels) return sound?.__labels;
  const T = { ...SOUND_LABELS, ...tune };
  const listener = { x: 0, z: 0, known: false };
  const lastShown = new Map();             // name -> performance.now()
  const zones = [];                         // { name, o, inside }
  let lastAny = -1e9;

  const reach = (r, k = T.near) => r.near + (r.far - r.near) * k;
  const heard = () => {
    if (!isPlaying() || sound.muted || !sound.ready) return false;
    const ac = sound.graph()?.ac;
    return !ac || ac.state === 'running';
  };
  function announce(name) {
    const words = names[name];
    if (!words || !heard()) return false;
    const now = performance.now(), last = lastShown.get(name);
    if (last !== undefined && (T.once.includes(name) || now - last < T.cooldown * 1000)) return false;
    lastShown.set(name, now);
    lastAny = now;
    show?.(words, name);
    return true;
  }
  const near = (x, z, r, k) => listener.known && Math.hypot(x - listener.x, z - listener.z) < reach(r, k);

  const wrap = (key, fn) => { const orig = sound[key]?.bind(sound); if (orig) sound[key] = (...a) => fn(orig, ...a); };

  // zones: entered (near you) each frame, in update
  wrap('zone', (orig, name, o = {}) => {
    const z = { name, o: { near: 8, far: 30, x: 0, z: 0, ...o }, inside: false };
    zones.push(z);
    const h = orig(name, o);
    return { ...h, set: (p) => { Object.assign(z.o, p); return h.set(p); } };
  });
  wrap('oneShot', (orig, name, o = {}) => {
    const h = orig(name, o);
    if (o.x === undefined || near(o.x, o.z, { near: o.near ?? 6, far: o.far ?? 40 }, T.shot)) announce(name);
    return h;
  });
  wrap('storeChime', (orig, at) => {
    if (at && near(at.x, at.z, SOUND.storeChime)) announce('store-chime');
    return orig(at);
  });
  wrap('chime', (orig, distance) => {
    if (distance < reach(SOUND.doorChime)) announce('train-chime');
    return orig(distance);
  });
  // the bells and the walk signals: named as you come near one that is sounding, once each time it sounds
  let bellsOn = false;
  wrap('bells', (orig, on, distance) => {
    const close = !!on && distance < reach(SOUND.crossingBells);
    if (close && !bellsOn) announce('railway-bells');
    bellsOn = close;
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
  /* the beds of the time of day (core/sound.js BED_OF_LOOK; golden hour's crows): no place to walk up to, so each is
   * named once, a little after it begins, and the wind later, in a quiet moment */
  const BED = { day: 'birds', blue: 'night-insects', golden: 'crows' };
  let look = null, lookT = 0, played = 0, wasInside = false;
  wrap('update', (orig, dt, o) => {
    const c = o?.camera?.position;
    if (c) { listener.x = c.x; listener.z = c.z; listener.known = true; }
    const ok = heard();
    for (const z of zones) {
      const d = Math.hypot(z.o.x - listener.x, z.o.z - listener.z);
      if (d >= z.o.far) { z.inside = false; continue; }          // left it: next time it is new again
      if (!z.inside && d < reach(z.o) && (!z.o.indoor || o?.inside) && ok) { z.inside = true; announce(z.name); }
    }
    if (ok && dt > 0) {
      const inside = !!o?.inside;
      if (inside && !wasInside) announce('store-music');
      wasInside = inside;
      if (o?.look !== look) { look = o?.look; lookT = 0; }
      lookT += dt; played += dt;
      const quiet = performance.now() - lastAny > T.ambient.quiet * 1000;
      if (!inside && quiet) void ((lookT > T.ambient.bed && BED[look] && announce(BED[look])) || (played > T.ambient.wind && announce('wind')));
    }
    return orig(dt, o);
  });

  const api = {
    announce,
    /** A sound made outside the engine (the trains, line/sfx.js): named if it is near you. */
    at(name, x, z, range) { return near(x, z, range) && announce(name); },
    get zones() { return zones.length; },
  };
  sound.__labels = api;
  return api;
}

/** The pills, top left: each fades in, stays `ms`, fades out (CSS, index.html `.snd`; no timers per frame). */
export function createSoundLabels(parent = document.body, { ms = SOUND_LABELS.ms, max = SOUND_LABELS.max } = {}) {
  const box = document.createElement('div');
  box.className = 'snd';
  box.setAttribute('aria-live', 'polite');
  box.style.setProperty('--snd-ms', `${ms}ms`);
  parent.appendChild(box);
  const NOTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
  return function show([ja, en, note]) {
    while (box.children.length >= max) box.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = 'snd-pill';
    el.innerHTML = `${NOTE}<p><b lang="ja"></b><i>·</i><em></em></p>`;      // (the name alone: no context line, Tan)
    el.querySelector('b').textContent = ja;
    el.querySelector('em').textContent = en;
    el.addEventListener('animationend', () => el.remove());
    box.appendChild(el);
    return el;
  };
}
