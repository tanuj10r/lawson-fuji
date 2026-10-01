/* ------------------------------------------------------------------ *
 * The sound on a phone (docs/decisions/mobile-lite.md): core/sound.js's
 * engine, untouched, with what iOS and Android need around it.
 *
 *   the gesture   Every start or resume happens inside a real gesture
 *                 (touchend or click, not pointerdown: a touch's pointerdown
 *                 is not a user activation).  The first one makes the one
 *                 AudioContext (sound.start()).
 *   silent switch navigator.audioSession.type = 'playback' before that, so
 *                 an iPhone on silent still plays the town (Safari 16.4+).
 *   the streams   The engine streams the store's music and the title song
 *                 through <audio> elements it makes after an await, out of
 *                 the gesture, so iOS may refuse their play().  Every
 *                 element it makes is noted here, and each later gesture
 *                 plays (and, if the engine had paused it, pauses again)
 *                 any element not yet unlocked, or wanted and refused.
 *   interruptions A call, Siri, the lock screen: the context is 'suspended'
 *                 or 'interrupted'.  resume() on return; if the phone
 *                 refuses it outside a gesture, the HUD asks for a tap.
 * ------------------------------------------------------------------ */

const elements = [];

/** Before sound.start(): note every <audio> the engine makes, and whether it wants to be playing. */
export function watchMediaElements() {
  const Native = window.Audio;
  if (!Native || Native.__watched) return;
  function Watched(src) {
    const el = new Native(src);
    el.playsInline = true;
    el.setAttribute('playsinline', '');
    const play = el.play.bind(el), pause = el.pause.bind(el);
    const w = { el, want: false, unlocked: false, play, pause };
    el.play = () => { w.want = true; return play().then(() => { w.unlocked = true; }); };
    el.pause = () => { w.want = false; return pause(); };
    elements.push(w);
    return el;
  }
  Watched.prototype = Native.prototype;
  Watched.__watched = true;
  window.Audio = Watched;
}

/** iOS: play through the silent switch (a no-op where the API is missing). */
export function playbackSession() {
  try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch { /* optional */ }
}

/**
 * Inside a gesture (touchend / click / keydown): start or wake the sound.
 * Cheap enough to call on every tap.  Returns the context's state.
 */
export function unlockAudio(sound) {
  playbackSession();
  sound.start();                                   // the first time: makes the context, in the gesture
  const ac = sound.graph()?.ac;
  if (ac && ac.state !== 'running' && ac.state !== 'closed') ac.resume().catch(() => {});
  for (const w of elements) {
    if (w.unlocked && (!w.want || !w.el.paused)) continue;
    const wanted = w.want;
    w.play().then(() => {
      w.unlocked = true;
      if (!wanted && !w.want) w.pause();          // only unlocking: the engine had it paused
    }, () => {});
  }
  return ac?.state ?? 'none';
}

/** The context's state, or 'none' before the first tap. */
export function audioState(sound) {
  return sound.graph()?.ac?.state ?? 'none';
}

/**
 * The start card's sound check (pocket diorama, builder 5): inside the tap,
 * wake the sound (unlockAudio: the one context, the audio session, the
 * streams) and play a short, soft chime of our own, two bell notes, at the
 * game's volume.  Returns the context's state.
 */
export function soundCheck(sound, volume = sound.volume) {
  const state = unlockAudio(sound);
  const ac = sound.graph()?.ac;
  if (!ac) return state;
  const t = ac.currentTime + 0.03;
  const out = ac.createGain();
  out.gain.value = 0.32 * Math.max(0.3, Math.min(1, volume || 0));
  out.connect(ac.destination);
  for (const [f, at] of [[1318.5, 0], [1760, 0.18]]) {          // E6, A6: a small "ding-dong", up
    for (const [mult, lvl, dur] of [[1, 0.5, 1.4], [2.76, 0.08, 0.5], [5.4, 0.03, 0.25]]) {   // a bell's partials
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f * mult;
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(lvl, t + at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      o.connect(g).connect(out);
      o.start(t + at); o.stop(t + at + dur + 0.05);
    }
  }
  setTimeout(() => out.disconnect(), 2200);
  return state;
}

/**
 * Interruptions while the page is in view (a call, Siri, an alarm, another
 * app's audio): the context goes 'interrupted' or 'suspended' without the
 * page hiding.  Try to resume; if the phone wants a tap for it,
 * `needTap(true)` (the HUD's "Tap to bring the sound back"); running again,
 * `needTap(false)`.  Returns attach(): call it after any tap (cheap; it
 * hooks the one context once, when it exists).
 */
export function watchInterruptions(sound, needTap) {
  let seen = null, timer = 0;
  const check = () => {
    const ac = sound.graph()?.ac;
    if (!ac || document.hidden) return;              // hidden: main.js suspends on purpose
    if (ac.state === 'running') { clearTimeout(timer); needTap(false); return; }
    if (ac.state === 'closed') return;
    ac.resume().then(() => { if (ac.state === 'running') needTap(false); }, () => {});
    clearTimeout(timer);
    timer = setTimeout(() => { if (!document.hidden && ac.state !== 'running') needTap(true); }, 700);
  };
  return function attach() {
    const ac = sound.graph()?.ac;
    if (!ac || ac === seen) return;
    seen = ac;
    ac.addEventListener('statechange', check);
  };
}
