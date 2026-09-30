import { MOBILE } from '../config.js';

/* ------------------------------------------------------------------ *
 * Touch (docs/decisions/mobile-lite.md): the left thumb walks, anything
 * else drags the view.
 *
 *   stick  a touch that lands in the left 40% of the screen (lower 75%)
 *          sets the joystick's centre there; the knob follows the thumb
 *          up to MOBILE.stick.radius, the push is the walking pace
 *   look   any other touch drags the view (several at once add up)
 *
 * Pointer events, so a mouse on a computer drags the view too.  The page
 * never scrolls, zooms or selects under the game: touch-action none (m.html),
 * and iOS's own pinch (gesturestart) and double-tap zoom are stopped here.
 * ------------------------------------------------------------------ */

export function createTouch(player, { surface = document.body, isPlaying = () => true } = {}) {
  const S = MOBILE.stick;
  const base = document.createElement('div');
  const knob = document.createElement('div');
  const style = document.createElement('style');
  style.textContent = `
    .stick { position: fixed; z-index: 5; width: ${S.radius * 2}px; height: ${S.radius * 2}px; margin: -${S.radius}px 0 0 -${S.radius}px;
      border-radius: 50%; pointer-events: none; border: 2px solid rgba(255,255,255,.55);
      background: radial-gradient(circle, rgba(43,37,66,.10), rgba(43,37,66,.26)); opacity: 0; transition: opacity .25s; }
    .stick.on { opacity: 1; transition: none; }
    .stick.rest { opacity: .42; }
    .knob { position: fixed; z-index: 5; width: 54px; height: 54px; margin: -27px 0 0 -27px; border-radius: 50%; pointer-events: none;
      background: rgba(252,250,252,.9); box-shadow: 0 3px 12px rgba(20,12,40,.35); opacity: 0; transition: opacity .25s; }
    .knob.on { opacity: .95; transition: none; }
    .knob.rest { opacity: .5; }
  `;
  document.head.appendChild(style);
  base.className = 'stick';
  knob.className = 'knob';
  document.body.append(base, knob);

  let stickId = null, cx = 0, cy = 0;
  const looks = new Map();          // pointerId -> last { x, y }
  // where the stick rests when no thumb is on it (a hint, bottom left)
  const rest = () => {
    const x = Math.max(92, 30 + S.radius + (window.visualViewport?.offsetLeft ?? 0) + safe('left'));
    const y = window.innerHeight - Math.max(92, 30 + S.radius + safe('bottom'));
    return [x, y];
  };
  const place = (el, x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; };
  const showRest = (on) => {
    const [x, y] = rest();
    place(base, x, y); place(knob, x, y);
    base.classList.toggle('rest', on); knob.classList.toggle('rest', on);
  };

  function inStickZone(x, y) {
    return x < window.innerWidth * 0.4 && y > window.innerHeight * 0.25;
  }

  surface.addEventListener('pointerdown', (e) => {
    if (!isPlaying()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (stickId === null && e.pointerType !== 'mouse' && inStickZone(e.clientX, e.clientY)) {
      stickId = e.pointerId; cx = e.clientX; cy = e.clientY;
      place(base, cx, cy); place(knob, cx, cy);
      base.classList.add('on'); knob.classList.add('on');
      base.classList.remove('rest'); knob.classList.remove('rest');
    } else {
      looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    surface.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });
  surface.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) {
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy), R = S.radius;
      if (d > R) { dx *= R / d; dy *= R / d; }
      place(knob, cx + dx, cy + dy);
      const k = Math.min(1, d / R);
      // the dead zone, then the rest of the push as the pace
      const push = k < S.dead ? 0 : (k - S.dead) / (1 - S.dead);
      const a = Math.atan2(dy, dx);
      player.stick.x = Math.cos(a) * push;
      player.stick.y = Math.sin(a) * push;
      return;
    }
    const l = looks.get(e.pointerId);
    if (!l) return;
    // coalesced events: every step of the finger, not only the last of the frame
    const dx = e.clientX - l.x, dy = e.clientY - l.y;
    l.x = e.clientX; l.y = e.clientY;
    if (dx || dy) player.look(dx, dy);
  });
  const end = (e) => {
    if (e.pointerId === stickId) {
      stickId = null;
      player.stick.x = player.stick.y = 0;
      base.classList.remove('on'); knob.classList.remove('on');
      if (isPlaying()) showRest(true);
    }
    looks.delete(e.pointerId);
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);
  surface.addEventListener('lostpointercapture', end);

  // iOS: no pinch, no double-tap zoom, no rubber-band scroll
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    /** Playing or not: the resting stick shows only in play; a pause lets go of everything. */
    setPlaying(on) {
      if (!on) {
        stickId = null; looks.clear();
        player.stick.x = player.stick.y = 0;
        base.classList.remove('on', 'rest'); knob.classList.remove('on', 'rest');
      } else showRest(true);
    },
    resize() { if (stickId === null && isPlaying()) showRest(true); },
  };
}

/** A safe-area inset in px (m.html sets them as CSS variables). */
function safe(side) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--safe-${side[0]}`);
  return parseFloat(v) || 0;
}
