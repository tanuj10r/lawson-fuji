import { STRINGS } from '../data/strings.js';
import { VOLUME_STEPS } from '../config.js';
import { TOWN_NAME } from '../data/town.js';

/* ------------------------------------------------------------------ *
 * Minimal HUD: the start and pause card, a small crosshair and an
 * interaction prompt.  Nothing else -- the frame is the point.
 * ------------------------------------------------------------------ */

export function createHud({ volume = 50 } = {}) {
  const el = (tag, cls, parent, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    (parent || document.body).appendChild(n);
    return n;
  };

  const root = el('div', 'hud');

  const crosshair = el('div', 'crosshair', root);
  const prompt = el('div', 'prompt', root, '');
  const toast = el('div', 'toast', root, '');
  /* Coordinate readout, off by default and toggled with C.
   *
   * It reports world coordinates, the same ones every builder, collider and
   * camera call uses.  The third line is a ready-made `__shot` argument, so a spot can be
   * quoted straight into a camera call or a bug report. */
  const coords = el('div', 'coords', root, '');
  let lastLine = '';

  /* The start and pause cards (Tan, 2026-09-28): one card, two modes.  The
   * key art (public/keyart.webp, baked from the game by scripts/keyart.mjs)
   * with the name over its sky; below it every key, and Start or, paused,
   * the volume and Resume.  The list of keys is STRINGS.controls, the same
   * one the corner panel reads.  UI in English; Japanese marked lang="ja". */
  const overlay = el('div', 'overlay', root);
  overlay.dataset.mode = 'start';
  const caps = (keys) => keys.map((k) => `<kbd class="${k.length > 1 ? 'wide' : ''}">${k}</kbd>`).join('');
  const controls = STRINGS.controls
    .map(({ keys, what }) => `<li><span class="caps">${caps(keys)}</span><span class="what">${what}</span></li>`).join('');
  overlay.innerHTML = `
    <section class="menu" role="dialog" aria-modal="true" aria-labelledby="menu-title">
      <figure class="menu-art">
        <img src="keyart.webp" width="1600" height="900" alt="${STRINGS.artAlt}" decoding="async" fetchpriority="high" />
        <figcaption class="menu-name">
          <p class="menu-place">${TOWN_NAME.en}<span class="dot">·</span><span lang="ja">${TOWN_NAME.jp}</span></p>
          <h1 id="menu-title">${STRINGS.title}</h1>
          <p class="menu-jp" lang="ja">${STRINGS.titleJp}</p>
        </figcaption>
        <span class="menu-paused pause-only">${STRINGS.paused}</span>
      </figure>
      <div class="menu-body">
        <div class="menu-left">
          <p class="menu-tagline">${STRINGS.tagline}</p>
          <ul class="menu-keys" aria-label="${STRINGS.controlsTitle}">${controls}</ul>
        </div>
        <div class="menu-right">
          <label class="audio-control pause-only">
            <span class="audio-head">
              <span>${STRINGS.volume}</span>
              <output for="music-volume">50%</output>
            </span>
            <input id="music-volume" class="volume-slider" type="range"
              min="0" max="100" step="25" value="50" list="volume-steps" aria-label="${STRINGS.volumeAria}" />
            <datalist id="volume-steps">${VOLUME_STEPS.map((v) => `<option value="${v}"></option>`).join('')}</datalist>
          </label>
          <button class="menu-action" type="button">
            <span class="start-only">${STRINGS.start}</span>
            <span class="pause-only">${STRINGS.resume}</span>
          </button>
          <p class="menu-url">${STRINGS.url}<span class="menu-credit">${STRINGS.credit} · <a href="credits.html" target="_blank" rel="noopener">${STRINGS.credits}</a></span></p>
        </div>
      </div>
    </section>`;

  const actionButton = overlay.querySelector('.menu-action');
  const audioControl = overlay.querySelector('.audio-control');
  const volumeSlider = overlay.querySelector('.volume-slider');
  const volumeOutput = overlay.querySelector('.audio-head output');
  /* Five settings, not a free slider (M4, Tan): the value is the setting
   * itself (0, 25, 50, 75, 100), and config's volumeGain turns it into gain. */
  const setVolumeReadout = (value) => {
    const percent = VOLUME_STEPS.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a));
    volumeSlider.value = String(percent);
    volumeSlider.style.setProperty('--volume', `${percent}%`);
    volumeOutput.value = `${percent}%`;
    volumeOutput.textContent = `${percent}%`;
    volumeSlider.setAttribute('aria-valuetext', `${percent}%`);
  };
  setVolumeReadout(volume);

  let toastTimer = null;
  let coordsOn = false;
  let coordsAcc = 0;
  let startedOnce = false;

  const api = {
    root,
    overlay,
    onStart: null,
    onVolumeChange: null,
    /** Brief centre-screen note that fades itself out. */
    flash(text, ms = 1400, error = false) {
      toast.textContent = text;
      toast.classList.toggle('err', error);
      toast.classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('on'), ms);
    },
    setPrompt(text) {
      if (text) {
        prompt.textContent = text;
        prompt.classList.add('on');
      } else {
        prompt.classList.remove('on');
      }
    },
    setLocked(locked) {
      if (locked) startedOnce = true;
      overlay.dataset.mode = startedOnce ? 'paused' : 'start';
      overlay.classList.toggle('hidden', locked);
      overlay.setAttribute('aria-hidden', locked ? 'true' : 'false');
      crosshair.classList.toggle('on', locked);
      if (!locked) requestAnimationFrame(() => actionButton.focus({ preventScroll: true }));
    },
    setVolume(value) {
      setVolumeReadout(value);
    },
    setMuted(muted) {
      audioControl.classList.toggle('muted', muted);
    },
    toggleCoords() {
      coordsOn = !coordsOn;
      coords.classList.toggle('on', coordsOn);
      coordsAcc = 1e9;
      return coordsOn;
    },
    get coordsVisible() { return coordsOn; },
    /**
     * @param p  the player's flat position (x, y = ground/feet height, z)
     * @param yaw,pitch  the look direction, in the same units `__shot` takes
     */
    setCoords(p, yaw, pitch, dt = 0) {
      if (!coordsOn) return;
      // ten updates a second: at frame rate the digits are unreadable
      coordsAcc += dt;
      if (coordsAcc < 0.1) return;
      coordsAcc = 0;
      const n = (v, d = 2) => v.toFixed(d);
      // fold the yaw into (-PI, PI] so it matches what the camera calls use
      let y = yaw % (Math.PI * 2);
      if (y > Math.PI) y -= Math.PI * 2;
      if (y <= -Math.PI) y += Math.PI * 2;
      /* Which way that yaw is actually looking.
       *
       * `forward = (-sin yaw, 0, -cos yaw)`, so yaw 0 faces -z and yaw grows
       * *clockwise* through -x: the index has to count down the table, not up.
       * Counting up gets every direction except north and south exactly
       * mirrored, which is worse than having no compass at all. */
      const DIRS = ['north +z', 'north-west', 'west -x', 'south-west',
        'south -z', 'south-east', 'east +x', 'north-east'];
      const compass = DIRS[(((4 - Math.round((y / (Math.PI * 2)) * 8)) % 8) + 8) % 8];
      lastLine = `{ pos: [${n(p.x, 1)}, 0, ${n(p.z, 1)}], yaw: ${n(y)}, pitch: ${n(pitch)} }`;
      coords.innerHTML =
        `<span class="k">x</span>${n(p.x)} <span class="k">z</span>${n(p.z)} `
        + `<span class="k">y</span>${n(p.y)}<br>`
        + `<span class="k">yaw</span>${n(y)} <span class="k">pitch</span>${n(pitch)}`
        + ` <span class="d">${compass}</span><br>`
        + `<span class="s">${lastLine}</span>`
        + `<br><span class="d">click or Shift+C to copy</span>`;
    },
    /**
     * Copy the current position to the clipboard.
     *
     * Two routes because neither is reliable on its own: `navigator.clipboard`
     * needs a secure context and a user gesture, and a pointer-locked canvas
     * swallows the click.  The textarea fallback works in both cases.
     */
    copyCoords() {
      if (!lastLine) return false;
      const done = () => { api.flash(`${STRINGS.copied}  ·  ${lastLine}`, 2200); return true; };
      try {
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(lastLine).then(done, () => api.copyFallback(lastLine));
          return true;
        }
      } catch { /* fall through to the textarea */ }
      return api.copyFallback(lastLine) ? done() : false;
    },
    copyFallback(text) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
      return ok;
    },
  };

  actionButton.addEventListener('click', (e) => {
    e.stopPropagation();
    api.onStart?.();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('.audio-control, a')) return;   // the Credits link opens its page, not the game
    api.onStart?.();
  });
  for (const event of ['click', 'pointerdown', 'pointerup']) {
    audioControl.addEventListener(event, (e) => e.stopPropagation());
  }
  volumeSlider.addEventListener('input', () => {
    const next = VOLUME_STEPS.reduce((a, b) => (Math.abs(b - Number(volumeSlider.value)) < Math.abs(a - Number(volumeSlider.value)) ? b : a));
    setVolumeReadout(next);
    api.onVolumeChange?.(next);
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyC') {
      // Shift+C copies the position; plain C toggles the readout
      if (e.shiftKey) {
        if (coordsOn) api.copyCoords();
      } else {
        api.flash(api.toggleCoords() ? STRINGS.coordsOn : STRINGS.coordsOff, 900);
      }
    }
  });

  // the readout is clickable too, for when the pointer is not locked
  coords.style.pointerEvents = 'auto';
  coords.style.cursor = 'copy';
  coords.addEventListener('click', (e) => {
    e.stopPropagation();
    api.copyCoords();
  });

  return api;
}
