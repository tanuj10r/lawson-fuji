import { MOBILE_STRINGS as M } from '../../../data/strings.js';
import { soundCheck, watchInterruptions, audioState } from '../../audio.js';
import { watchSoundLabels, createSoundLabel } from './labels.js';
import { spotHere, spotTapped } from './spots.js';

export { spotHere, spotTapped } from './spots.js';
export { TUNE, stickPace, lookGain } from './tune.js';
export { lookSetting } from './settings.js';

/* ------------------------------------------------------------------ *
 * The pocket town's controls and screen, in one call for main.js
 * (docs/pocket-diorama.md, builder 5).  createTouch (touch.js),
 * TouchPlayer (player.js) and createMobileHud (hud.js) are made as before;
 * this adds what sits between them and the sound:
 *
 *   labels       the sound name pills (labels.js): wraps the engine in
 *                place, so call this BEFORE soundBus.attach(sound)
 *   sound check  the start card's #sound-check button: a soft chime inside
 *                the tap, which also unlocks the sound; it does not start
 *                the game (its tap stops at the button)
 *   interruptions the context's statechange (a call, Siri) while in view:
 *                resumed, else the HUD's "Tap to bring the sound back"
 *   spots        action(spots, player, camera): the spot you stand in for
 *                the context button (null hides it), and tap(x, y, ...)
 *                for a tap on the thing itself
 * ------------------------------------------------------------------ */

export function attachPocketControls({ sound, hud, isPlaying = () => true }) {
  const show = createSoundLabel();
  const labels = watchSoundLabels(sound, { isPlaying, show });

  const interruptions = watchInterruptions(sound, (on) => hud?.askForSound(on));
  const hook = () => interruptions();
  document.addEventListener('touchend', hook, { passive: true });
  document.addEventListener('click', hook);

  // the start card's sound check
  const btn = document.getElementById('sound-check');
  if (btn) {
    let last = 0;
    const check = (e) => {
      e.stopPropagation();                    // (the card's own tap starts the game: not this one)
      e.preventDefault();
      if (e.type === 'click' && performance.now() - last < 700) return;   // (the lift already played it)
      if (e.type === 'pointerup' && e.pointerType === 'mouse') return;     // (a mouse clicks)
      last = performance.now();
      soundCheck(sound);
      interruptions();
      btn.classList.add('done');
      btn.querySelector('span').textContent = M.soundCheckDone;
    };
    btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    btn.addEventListener('pointerup', check);
    btn.addEventListener('click', check);
  }

  return {
    labels,
    /** The spot you stand in (main loop): its label for hud.setAction, and the spot to use on 'act'. */
    action(spots, player) {
      if (!player.locked || player.seat || player.suspended || player.scripted) return null;
      return spotHere(spots, player.pos, player.yaw);
    },
    /** A tap on the view (createTouch's onTap): the spot tapped, if any. */
    tap(x, y, spots, camera) { return spotTapped(spots, camera, x, y); },
    get audio() { return audioState(sound); },
  };
}
