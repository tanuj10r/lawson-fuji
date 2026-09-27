import { soundBus } from '../../../core/soundBus.js';
import { SHRINE_PRAYER } from '../../../data/town.js';

/* ------------------------------------------------------------------ *
 * 参拝, the prayer at the hall (Tan's experience 3).
 *
 * E at the offering box: a coin in, the bell rope shaken (the bell swings
 * and rings), two deep bows, two claps, a moment with hands together, one
 * last bow; a line of English under each step.  Then the spot dims.
 *
 * The camera: main.js hands every action { player, hud }.  With the
 * player, the view turns to the hall, looks up at the bell, lowers and
 * dips for each bow, and walking is held until the end; the lines are the
 * hud's toasts.  Called without them it still plays its sounds, swings its
 * bell and shows its lines (in a toast of its own, styled as the hud's).
 * ------------------------------------------------------------------ */

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/* The script, in seconds. */
const T = {
  coin: 0.15, pull: 0.75, ring: [0.85, 1.35],
  bows: [[2.5, 1.15], [3.8, 1.15], [8.0, 1.25]],   // [start, length]
  claps: [5.25, 5.8],
  hands: [6.2, 7.8],
  captions: [[0, 0], [2.4, 1], [5.05, 2], [6.15, 3], [7.9, 4]],
  end: 9.5,
};

/** A bow's depth over its length: down, a held moment, up. */
function bowCurve(t) {
  if (t < 0 || t > 1) return 0;
  if (t < 0.38) return ease(t / 0.38);
  if (t < 0.58) return 1;
  return 1 - ease((t - 0.58) / 0.42);
}

/**
 * @param ctx     the town's ctx (the shrine is built in its frame)
 * @param o.spot  { x, z } where to stand, town frame
 * @param o.box   { x, z } the offering box, town frame (sounds)
 * @param o.bell  { swing(impulse) } the bell rope's pendulum
 * @param o.faceYaw  the yaw (town frame) that looks at the hall
 */
export function setupPrayer(ctx, o) {
  const boxW = ctx.toWorld({ x: o.box.x, z: o.box.z });
  const worldYaw = ctx.yawToWorld(o.faceYaw);
  let run = null;          // { t, io, events fired, saved }
  let ownToast = null, ownTimer = null;

  const say = (io, text, ms) => {
    if (io?.hud?.flash) { io.hud.flash(text, ms); return; }
    // no hud handed over: a toast of our own beside the hud's, in its style
    if (!ownToast) {
      const root = document.querySelector('.hud');
      if (!root) return;
      ownToast = document.createElement('div');
      ownToast.className = 'toast';
      root.appendChild(ownToast);
    }
    ownToast.textContent = text;
    ownToast.classList.add('on');
    clearTimeout(ownTimer);
    ownTimer = setTimeout(() => ownToast.classList.remove('on'), ms);
  };
  const sound = (name, gain = 1, recipe = null) => soundBus.oneShot(name, { x: boxW.x, z: boxW.z, y: 1.4, near: 5, far: 24, gain, recipe });

  const spot = ctx.experiences.add({
    id: 'shrine', name: SHRINE_PRAYER.name, jp: SHRINE_PRAYER.jp,
    x: o.spot.x, z: o.spot.z, r: 0.95, h: 2.0,
    action: (io) => {
      if (run) return;
      const p = io?.player ?? null;
      run = { t: 0, io, fired: new Set(), saved: p ? { pitch: p.pitch, yaw: p.yaw } : null };
      if (p) p.suspended = true;
    },
  });

  const once = (key, at, fn) => {
    if (run.t >= at && !run.fired.has(key)) { run.fired.add(key); fn(); }
  };

  ctx.update((dt) => {
    if (!run) return;
    run.t += dt;
    const { io, t } = run;
    once('coin', T.coin, () => sound('coins', 0.45, 'can'));
    once('pull', T.pull, () => o.bell.swing(1));
    T.ring.forEach((at, i) => once('ring' + i, at, () => { sound('shrine-bell', i ? 0.7 : 1, 'can'); if (i) o.bell.swing(0.6); }));
    T.claps.forEach((at, i) => once('clap' + i, at, () => sound('shrine-clap', 1, 'box')));
    for (const [at, k] of T.captions) once('say' + k, at, () => say(io, SHRINE_PRAYER.steps[k], k === 3 ? 1900 : 2500));

    // the body: face the hall, bow, hands together
    const p = io?.player;
    // taken away mid-prayer (a famous-view key): let go of the view at once
    if (p && Math.hypot(p.pos.x - boxW.x, p.pos.z - boxW.z) > 6) {
      p.suspended = false;
      run = null;
      return;
    }
    if (p && run.saved) {
      const turn = ease(Math.min(1, t / 0.9));
      let d = worldYaw - run.saved.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.yaw = run.saved.yaw + d * turn;
      let bow = 0;
      for (const [at, len] of T.bows) bow = Math.max(bow, bowCurve((t - at) / len));
      const hands = t > T.hands[0] && t < T.hands[1] ? Math.sin(Math.PI * (t - T.hands[0]) / (T.hands[1] - T.hands[0])) : 0;
      // look level at the hall to begin, then the bows take the head down
      // looking up at the bell while it rings, then level with the hall
      const up = 0.34 * ease((t - 0.2) / 0.5) * (1 - ease((t - 1.9) / 0.5));
      const level = (0.1 + up) * turn + run.saved.pitch * (1 - turn);
      p.pitch = level - 0.95 * bow - 0.28 * hands;
      // the eye lowers with the bow (the player sets the camera each frame; we follow it)
      if (p.camera) {
        p.camera.position.y -= 0.32 * bow + 0.05 * hands;
        p.camera.rotation.x = p.pitch;
        p.camera.rotation.y = p.yaw;
      }
    }

    if (t >= T.end) {
      if (p) {
        p.suspended = false;
        p.pitch = 0.1;
      }
      say(io, SHRINE_PRAYER.done, 4500);
      spot.done();
      run = null;
    }
  });
  return spot;
}
