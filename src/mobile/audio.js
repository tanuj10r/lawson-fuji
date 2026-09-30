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
