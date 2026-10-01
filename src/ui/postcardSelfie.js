import { STRINGS } from '../data/strings.js';
import { MAKER } from '../config.js';
import { esc } from './maker.js';
import hachiUrl from '../assets/hachi-peek.webp';

/* The selfie postcard (EXPERIMENT, Tan's item 8, 2026-10-01; DECISIONS.md).
 * Asked for on the postcard ("Add your selfie"), never by itself: the
 * postcard's picture becomes the key art with your photo as a polaroid
 * standing in the town, Hachi (scripts/hachi-sprite.mjs: the game's own
 * pup, pre-rendered) over its corner.  Then Save image, or the postcard's
 * Share with the picture.
 *
 *   - The photo never leaves the device: it is drawn into a canvas here
 *     and nowhere else; nothing is uploaded, nothing is stored.
 *   - The camera runs only while the live view shows: it stops at the
 *     shot, at Cancel, and when the postcard is put away.
 *   - No camera (none, refused, an old browser): choose a photo instead.
 *   - Its own chunk, loaded on the click; no frame loop of its own (the
 *     live view is a <video> under a canvas drawn once, with a hole).
 * ------------------------------------------------------------------ */

const S = STRINGS.postcard.selfie;

/* the picture: 1600 x 1000, everything below in its pixels */
const W = 1600, H = 1000;
const POL = { cx: 566, cy: 690, w: 440, h: 540, m: 22, lip: 96, rot: -0.085 };   // the polaroid: centre, paper, margin, the lip under the photo
const WIN = { x: -POL.w / 2 + POL.m, y: -POL.h / 2 + POL.m, w: POL.w - 2 * POL.m, h: POL.h - POL.m - POL.lip };
const DOG = { w: 250, over: 0.43, right: 0.14, rot: 0.1 };                       // Hachi: width, how much of him is over the paper, past its right edge
const INK = '#2a2140';

const CSS = `
  .sf button:focus-visible, .sf a:focus-visible { outline: 3px solid #e59bb0; outline-offset: 2px; }
  .sf { position: absolute; inset: 0; container-type: size; overflow: hidden; background: #b98ab4; }
  .sf[hidden] { display: none; }
  /* the whole picture, as tall as the frame, slid so the polaroid is in the middle */
  .sf-stage { position: absolute; top: 0; height: 100cqh; width: 160cqh; left: clamp(100cqw - 160cqh, 50cqw - ${(POL.cx / W * 160).toFixed(2)}cqh, 0px); }
  .sf-stage video { position: absolute; object-fit: cover; background: #2b2542; }
  .sf-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .sf-note { position: absolute; left: 50%; bottom: 15cqh; transform: translateX(-50%); margin: 0; padding: .3em .9em; border-radius: 999px; white-space: nowrap;
    background: rgba(43,37,66,.78); color: #fff; font-size: max(10.5px, 2.5cqw); font-weight: 600; letter-spacing: .01em; }
  .sf-msg { position: absolute; left: 6cqw; right: 6cqw; top: 13cqh; margin: 0; padding: .8em 1em; border-radius: 10px; text-align: center;
    background: rgba(251,246,240,.95); color: #2b2542; font-size: max(12px, 3.2cqw); font-weight: 600; line-height: 1.35; }
  .sf-msg:empty { display: none; }
  .sf-bar { position: absolute; left: 0; right: 0; bottom: 3.5cqh; display: flex; justify-content: center; align-items: center; gap: 2.2cqw; }
  .sf-bar > * { display: inline-flex; align-items: center; justify-content: center; padding: .55em 1.1em; border: 0; border-radius: 999px;
    background: rgba(251,246,240,.95); color: #2b2542; box-shadow: 0 4px 14px -6px rgba(20,10,40,.6); text-decoration: none;
    font: inherit; font-size: max(12px, 3cqw); font-weight: 700; white-space: nowrap; cursor: pointer; }
  .sf-bar > .primary { background: #3b3263; color: #fff; }
  .sf-bar > :hover { transform: translateY(-1px); }
  .sf-bar > [hidden] { display: none; }
  .sf-bar .sf-shutter { width: 11cqh; height: 11cqh; min-width: 44px; min-height: 44px; padding: 0; background: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,.55), 0 6px 16px -6px rgba(20,10,40,.7); }
  .sf-bar .sf-shutter::after { content: ''; width: 72%; height: 72%; border-radius: 50%; background: #e0566b; }
  .sf input[type=file] { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
`;

const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });

/** `src` (a video, an image) drawn to cover w x h about the origin's rect, mirrored for the front camera. */
function cover(x, src, sw, sh, dx, dy, dw, dh, mirror) {
  const k = Math.max(dw / sw, dh / sh), cw = dw / k, ch = dh / k;
  x.save();
  x.beginPath(); x.rect(dx, dy, dw, dh); x.clip();
  if (mirror) { x.translate(dx * 2 + dw, 0); x.scale(-1, 1); }
  x.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, dx, dy, dw, dh);
  x.restore();
}

/** The picture.  `photo`: { src, w, h, mirror }, or null for the live view (a hole where the photo goes).
 *  `brand`: the title and the address on it (the saved picture; the postcard's frame would cut them). */
function compose(canvas, { bg, dog, photo, brand = false }) {
  canvas.width = W; canvas.height = H;
  const x = canvas.getContext('2d');
  x.imageSmoothingQuality = 'high';
  cover(x, bg, bg.naturalWidth, bg.naturalHeight, 0, 0, W, H, false);
  // a soft ground shadow where the polaroid stands
  x.save();
  x.translate(POL.cx, POL.cy); x.rotate(POL.rot);
  x.shadowColor = 'rgba(30,16,50,.55)'; x.shadowBlur = 38; x.shadowOffsetY = 16;
  x.fillStyle = '#fdfaf3';
  x.beginPath(); x.roundRect(-POL.w / 2, -POL.h / 2, POL.w, POL.h, 7); x.fill();
  x.shadowColor = 'transparent';
  if (photo) {
    cover(x, photo.src, photo.w, photo.h, WIN.x, WIN.y, WIN.w, WIN.h, photo.mirror);
    x.strokeStyle = 'rgba(42,33,64,.18)'; x.lineWidth = 2; x.strokeRect(WIN.x, WIN.y, WIN.w, WIN.h);
  } else x.clearRect(WIN.x, WIN.y, WIN.w, WIN.h);
  // the lip: written on
  const d = new Date();
  x.fillStyle = '#5a4f7a'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = "italic 500 34px 'Bradley Hand', 'Segoe Print', 'Segoe Script', 'Comic Sans MS', cursive";
  x.fillText(`${S.caption}  ·  ${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`, 0, POL.h / 2 - POL.lip / 2 - 2, POL.w - 40);
  // Hachi, over the top corner from behind: his paws on the photo
  const dh = DOG.w * dog.naturalHeight / dog.naturalWidth;
  x.translate(POL.w / 2 - DOG.w * (1 - DOG.right), -POL.h / 2 - dh * (1 - DOG.over));
  x.translate(DOG.w / 2, dh); x.rotate(DOG.rot); x.translate(-DOG.w / 2, -dh);
  x.shadowColor = 'rgba(30,16,50,.4)'; x.shadowBlur = 14; x.shadowOffsetY = 6;
  x.drawImage(dog, 0, 0, DOG.w, dh);
  x.restore();
  if (!brand) return;
  // the title, in the sky; the address, in the corner
  x.textAlign = 'right'; x.textBaseline = 'alphabetic';
  x.fillStyle = '#5a4f7a';
  x.font = "700 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
  if ('letterSpacing' in x) x.letterSpacing = '5px';
  x.fillText(STRINGS.postcard.title.toUpperCase(), W - 62, 104);
  if ('letterSpacing' in x) x.letterSpacing = '0px';
  x.fillStyle = INK;
  x.font = "600 76px 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";
  x.fillText(STRINGS.title, W - 60, 184);
  const url = MAKER.share.replace(/^https?:\/\//, '');
  x.font = "700 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
  const tw = x.measureText(url).width;
  x.fillStyle = 'rgba(251,246,240,.93)';
  x.beginPath(); x.roundRect(W - 48 - tw - 44, H - 48 - 52, tw + 44, 52, 26); x.fill();
  x.fillStyle = INK;
  x.fillText(url, W - 48 - 22, H - 48 - 16);
}

/**
 * The selfie, in the postcard's picture (`pic`, its <figure>).  `open()` asks for the camera; `stop()` lets it go
 * (the postcard calls it when it is put away); `file`: the picture once taken, for the share sheet.
 */
export function createSelfie({ pic }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = 'sf';
  root.hidden = true;
  // the photo's place in the picture (the polaroid's window, turned with it), for the live view under the canvas
  const c = Math.cos(POL.rot), s = Math.sin(POL.rot), wy = WIN.y + WIN.h / 2;
  const vx = POL.cx - s * wy, vy = POL.cy + c * wy;
  root.innerHTML = `<div class="sf-stage">
      <video playsinline muted autoplay disablepictureinpicture style="left:${(vx / W * 100).toFixed(3)}%;top:${(vy / H * 100).toFixed(3)}%;width:${((WIN.w + 6) / W * 100).toFixed(3)}%;height:${((WIN.h + 6) / H * 100).toFixed(3)}%;transform:translate(-50%,-50%) rotate(${POL.rot}rad) scaleX(-1)"></video>
      <canvas role="img" aria-label="${esc(S.alt)}"></canvas>
    </div>
    <p class="sf-msg" role="status"></p>
    <p class="sf-note">${esc(S.note)}</p>
    <div class="sf-bar">
      <button type="button" data-sf="cancel">${esc(S.cancel)}</button>
      <button type="button" data-sf="choose">${esc(S.choose)}</button>
      <button type="button" class="sf-shutter" data-sf="shot" data-fast-goal="postcard_selfie_shot" aria-label="${esc(S.shutter)}" title="${esc(S.shutter)}"></button>
      <button type="button" data-sf="retake">${esc(S.retake)}</button>
      <a class="primary" data-sf="save" data-fast-goal="postcard_selfie_save" download="${esc(S.file)}">${esc(S.save)}</a>
    </div>
    <input type="file" accept="image/*" tabindex="-1" aria-hidden="true" />`;
  pic.appendChild(root);
  const video = root.querySelector('video'), canvas = root.querySelector('canvas'), msg = root.querySelector('.sf-msg');
  const input = root.querySelector('input'), save = root.querySelector('[data-sf=save]');
  const btn = Object.fromEntries([...root.querySelectorAll('[data-sf]')].map((b) => [b.dataset.sf, b]));

  let art = null;            // the key art and Hachi, loaded once
  let stream = null, asking = 0, file = null, url = null;
  const arts = () => (art ??= Promise.all([load('keyart-1920.webp'), load(hachiUrl)]).then(([bg, dog]) => ({ bg, dog })));

  /** which buttons, which words: ask (waiting for the camera), live, none (no camera), done */
  const set = (state, text = '') => {
    root.dataset.state = state;
    msg.textContent = text;
    btn.cancel.hidden = state === 'done';
    btn.choose.hidden = state !== 'none' && state !== 'ask';
    btn.shot.hidden = state !== 'live';
    btn.retake.hidden = save.hidden = state !== 'done';
    video.style.visibility = state === 'live' ? '' : 'hidden';
  };
  const stopCamera = () => {
    asking++;                                    // a camera still being asked for is let go when it comes
    if (stream) { for (const t of stream.getTracks()) t.stop(); stream = null; }
    video.srcObject = null;
  };
  const forget = () => { if (url) URL.revokeObjectURL(url); url = null; file = null; save.removeAttribute('href'); };
  const close = () => {
    stopCamera(); forget();
    root.hidden = true; pic.classList.remove('sf-on');
    canvas.width = canvas.height = 0;            // the picture's memory back
    api.onChange?.();
  };
  const done = async (from) => {
    // the photo, cut to its window at twice the size, mirrored as it was seen; then the camera goes at once
    const shot = document.createElement('canvas');
    shot.width = WIN.w * 2; shot.height = WIN.h * 2;
    cover(shot.getContext('2d'), from.src, from.w, from.h, 0, 0, shot.width, shot.height, from.mirror);
    stopCamera();
    const photo = { src: shot, w: shot.width, h: shot.height, mirror: false };
    const a = await arts();
    compose(canvas, { ...a, photo });
    const full = document.createElement('canvas');   // the one that is saved: with the title and the address
    compose(full, { ...a, photo, brand: true });
    const blob = await new Promise((ok) => full.toBlob(ok, 'image/jpeg', 0.9));
    full.width = shot.width = 0;
    forget();
    file = new File([blob], S.file, { type: 'image/jpeg' });
    url = URL.createObjectURL(file);
    save.href = url;
    set('done');
    api.onChange?.();
    save.focus({ preventScroll: true });
  };
  const open = async () => {
    forget();
    root.hidden = false; pic.classList.add('sf-on');
    set('ask', S.asking);
    const a = await arts();
    compose(canvas, { ...a, photo: null });
    if (!navigator.mediaDevices?.getUserMedia) return set('none', S.noCamera);
    const mine = ++asking;
    try {
      const got = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (mine !== asking || root.hidden) { for (const t of got.getTracks()) t.stop(); return; }
      stream = got;
      video.srcObject = stream;
      await video.play().catch(() => {});
      set('live');
      btn.shot.focus({ preventScroll: true });
    } catch {
      if (mine === asking && !root.hidden) set('none', S.noCamera);
    }
  };
  root.addEventListener('click', (e) => {
    const what = e.target.closest('[data-sf]')?.dataset.sf;
    if (what === 'cancel') close();
    if (what === 'choose') input.click();
    if (what === 'retake') open();
    if (what === 'shot' && stream && video.videoWidth) done({ src: video, w: video.videoWidth, h: video.videoHeight, mirror: true });
  });
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const u = URL.createObjectURL(f);
    try { const img = await load(u); await done({ src: img, w: img.naturalWidth, h: img.naturalHeight, mirror: false }); }
    catch { set('none', S.badPhoto); }
    finally { URL.revokeObjectURL(u); }
  });
  window.addEventListener('pagehide', stopCamera);

  const api = {
    open,
    /** the postcard is put away: the camera goes; a picture already taken stays for next time */
    stop() { if (root.dataset.state !== 'done' && !root.hidden) close(); else stopCamera(); },
    /** the picture, once taken (a JPEG File), else null */
    get file() { return file; },
    /** the camera is on */
    get live() { return !!stream && stream.getTracks().some((t) => t.readyState === 'live'); },
    get state() { return root.hidden ? 'off' : root.dataset.state; },
    onChange: null,
  };
  return api;
}
