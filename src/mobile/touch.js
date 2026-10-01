import { TUNE, lookGain } from './pocket/controls/tune.js';
import { lookSetting } from './pocket/controls/settings.js';

/* ------------------------------------------------------------------ *
 * Touch (docs/pocket-diorama.md, builder 5): the left thumb walks, the
 * right thumb looks, and the two never get in each other's way.
 *
 *   stick  a touch landing in the left TUNE.stick.zone of the screen
 *          (below its top strip) puts the joystick's centre where it
 *          lands; the knob follows the thumb to a full push at `radius`,
 *          and past `follow` radii the centre trails the thumb, so the
 *          stick is never "lost".  player.stick gets the push, 0..1 past
 *          the dead zone; player.js turns it into a stroll, a walk and
 *          (held at the edge) a run.
 *   look   every other touch drags the view, each on its own (two at
 *          once add up).  The gain follows the finger's speed: a slow
 *          drag is precise, a flick turns fast (tune.js lookGain), times
 *          the pause card's Look speed (settings.js).
 *   tap    a quick, still touch on the view: onTap(x, y) (the thing
 *          itself can be tapped, pocket/controls/spots.js).
 *
 * The buttons (hud.js) take their own touches and stop them there, so a
 * thumb on the stick, a drag and a button tap are all independent.
 * Pointer events, so a mouse on a computer drags the view too.  The page
 * never scrolls, zooms or selects under the game: touch-action none (m.html),
 * and iOS's own pinch (gesturestart) and double-tap zoom are stopped here.
 * ------------------------------------------------------------------ */

export function createTouch(player, { surface = document.body, isPlaying = () => true, onTap = null } = {}) {
  const S = TUNE.stick, L = TUNE.look, TAP = TUNE.tap;
  const base = document.createElement('div');
  const knob = document.createElement('div');
  const style = document.createElement('style');
  const R = S.radius;
  style.textContent = `
    .stick { position: fixed; z-index: 5; left: 0; top: 0; width: ${R * 2}px; height: ${R * 2}px; margin: -${R}px 0 0 -${R}px;
      border-radius: 50%; pointer-events: none; border: 2px solid rgba(255,255,255,.6);
      background: radial-gradient(circle, rgba(43,37,66,.08), rgba(43,37,66,.24)); opacity: 0; transition: opacity .3s; will-change: transform; }
    .stick.on { opacity: 1; transition: opacity .08s; }
    .knob { position: fixed; z-index: 5; left: 0; top: 0; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; pointer-events: none;
      background: rgba(252,250,252,.92); box-shadow: 0 3px 12px rgba(20,12,40,.35); opacity: 0; transition: opacity .3s; will-change: transform; }
    .knob.on { opacity: .95; transition: opacity .08s; }
    .stick.run { border-color: rgba(255,214,120,.95); }
    /* idle: a faint hint where the thumb goes, which then fades away */
    @keyframes stick-rest { 0%, 55% { opacity: var(--rest-o); } 100% { opacity: 0; } }
    .stick.rest, .knob.rest { animation: stick-rest 4.5s ease forwards; transition: none; }
    .stick.rest { --rest-o: .4; } .knob.rest { --rest-o: .5; }
  `;
  document.head.appendChild(style);
  base.className = 'stick';
  knob.className = 'knob';
  document.body.append(base, knob);

  let stickId = null, cx = 0, cy = 0;
  const looks = new Map();          // pointerId -> { x, y, t, v, x0, y0, t0, moved }
  // where the stick rests when no thumb is on it (a hint, bottom left)
  const rest = () => {
    const x = Math.max(96, 34 + R + safe('left'));
    const y = window.innerHeight - Math.max(96, 34 + R + safe('bottom'));
    return [x, y];
  };
  const place = (el, x, y) => { el.style.transform = `translate3d(${x}px, ${y}px, 0)`; };
  const showRest = () => {
    const [x, y] = rest();
    place(base, x, y); place(knob, x, y);
    for (const el of [base, knob]) { el.classList.remove('rest', 'on', 'run'); void el.offsetWidth; el.classList.add('rest'); }
  };

  const inStickZone = (x, y) => x < window.innerWidth * S.zone && y > window.innerHeight * S.top;

  function stickMove(x, y) {
    let dx = x - cx, dy = y - cy;
    let d = Math.hypot(dx, dy);
    // past `follow` radii the centre comes along behind the thumb
    const F = R * S.follow;
    if (d > F) { cx += dx * (1 - F / d); cy += dy * (1 - F / d); dx = x - cx; dy = y - cy; d = F; place(base, cx, cy); }
    const k = Math.min(1, d / R);
    const kx = d > R ? dx * R / d : dx, ky = d > R ? dy * R / d : dy;
    place(knob, cx + kx, cy + ky);
    // the dead zone, then the rest of the push
    const push = k < S.dead ? 0 : (k - S.dead) / (1 - S.dead);
    const a = Math.atan2(dy, dx);
    player.stick.x = Math.cos(a) * push;
    player.stick.y = Math.sin(a) * push;
  }

  surface.addEventListener('pointerdown', (e) => {
    if (!isPlaying()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (stickId === null && e.pointerType !== 'mouse' && inStickZone(e.clientX, e.clientY)) {
      stickId = e.pointerId; cx = e.clientX; cy = e.clientY;
      place(base, cx, cy); place(knob, cx, cy);
      for (const el of [base, knob]) { el.classList.remove('rest'); el.classList.add('on'); }
      player.stick.x = player.stick.y = 0;
    } else {
      const t = e.timeStamp || performance.now();
      looks.set(e.pointerId, { x: e.clientX, y: e.clientY, t, v: 0, n: 0, x0: e.clientX, y0: e.clientY, t0: t, moved: 0 });
    }
    try { surface.setPointerCapture?.(e.pointerId); } catch { /* fine */ }
    e.preventDefault();
  });

  surface.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) { stickMove(e.clientX, e.clientY); return; }
    const l = looks.get(e.pointerId);
    if (!l) return;
    // every step of the finger, not only the last of the frame: the speed (and so the gain) is the finger's own
    const evs = e.getCoalescedEvents?.() ?? [];
    const list = evs.length ? evs : [e];
    let ax = 0, ay = 0;
    for (const p of list) {
      const dx = p.clientX - l.x, dy = p.clientY - l.y;
      if (!dx && !dy) continue;
      const t = p.timeStamp || performance.now();
      const dtm = Math.max(4, t - l.t);
      const v = Math.hypot(dx, dy) / dtm;
      l.v = l.n++ ? l.v * L.smooth + v * (1 - L.smooth) : v;     // (the first sample sets it: a short flick is only a few)
      const g = lookGain(l.v) * lookSetting.scale;
      ax += dx * g; ay += dy * g;
      l.moved += Math.abs(dx) + Math.abs(dy);
      l.x = p.clientX; l.y = p.clientY; l.t = t;
    }
    if (ax || ay) player.look(ax, ay);
  });

  const end = (e) => {
    if (e.pointerId === stickId) {
      stickId = null;
      player.stick.x = player.stick.y = 0;
      base.classList.remove('on', 'run'); knob.classList.remove('on');
      if (isPlaying()) showRest();
      return;
    }
    const l = looks.get(e.pointerId);
    if (!l) return;
    looks.delete(e.pointerId);
    // a tap: quick and still, on the view
    if (e.type === 'pointerup' && onTap && isPlaying() && (e.timeStamp || performance.now()) - l.t0 < TAP.ms
      && Math.hypot(e.clientX - l.x0, e.clientY - l.y0) < TAP.px && l.moved < TAP.px * 2) onTap(e.clientX, e.clientY);
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);
  surface.addEventListener('lostpointercapture', (e) => { if (looks.has(e.pointerId) || e.pointerId === stickId) end(e); });

  // iOS: no pinch, no double-tap zoom, no rubber-band scroll
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // the run shows on the stick's ring (player.js decides it, and says so)
  player.onRun = (run) => base.classList.toggle('run', run && stickId !== null);
  const api = {
    /** Playing or not: the resting stick shows only in play; a pause lets go of everything. */
    setPlaying(on) {
      if (!on) {
        stickId = null; looks.clear();
        player.stick.x = player.stick.y = 0;
        base.classList.remove('on', 'rest', 'run'); knob.classList.remove('on', 'rest');
      } else showRest();
    },
    resize() { if (stickId === null && isPlaying()) showRest(); },
    /** For tests and diag: how many fingers are on what. */
    get state() { return { stick: stickId !== null, looks: looks.size, push: Math.hypot(player.stick.x, player.stick.y) }; },
  };
  return api;
}

/** A safe-area inset in px (m.html sets them as CSS variables). */
function safe(side) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--safe-${side[0]}`);
  return parseFloat(v) || 0;
}
