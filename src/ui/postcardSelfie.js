import { STRINGS } from '../data/strings.js';
import { MAKER } from '../config.js';
import { ICON, esc } from './maker.js';
import hachiUrl from '../assets/hachi-peek.webp';
import pawsUrl from '../assets/hachi-paws.webp';

/* The selfie postcard (Tan's item 8, 2026-10-01; DECISIONS.md).  Asked
 * for on the postcard ("Add your selfie with Hachi"), never by itself:
 * the postcard's picture becomes the key art with your photo as a
 * polaroid standing in the town, Hachi (scripts/hachi-sprite.mjs: the
 * game's own pup, pre-rendered) behind it, his paws over its top edge.
 * Then Save image, or the postcard's Share with the picture.
 *
 *   - The picture area shows only the art, the polaroid and Hachi; the
 *     words, the buttons and the privacy line are in the postcard's
 *     writing side, in place of the message and the address lines.
 *   - The photo never leaves the device: it is drawn into a canvas here
 *     and nowhere else; nothing is uploaded, nothing is stored.
 *   - The camera runs only while the live view shows: it stops at the
 *     shot, at Cancel, and when the postcard is put away.
 *   - Camera only (Tan): refused, missing or busy, it says so and how
 *     to allow it; no upload.
 *   - Its own chunk, loaded on the click; no frame loop of its own (the
 *     live view is a <video> under a canvas drawn once, with a hole).
 * ------------------------------------------------------------------ */

const S = STRINGS.postcard.selfie;

/* the picture: 1600 x 1000, everything below in its pixels */
const W = 1600, H = 1000;
const BG_AX = 1;                                                               // the key art is wider than the picture: its right side is kept
const POL = { cx: 480, cy: 672, w: 500, h: 600, m: 24, lip: 104, rot: -0.07 };   // the polaroid: centre, paper, margin, the lip under the photo
const WIN = { x: -POL.w / 2 + POL.m, y: -POL.h / 2 + POL.m, w: POL.w - 2 * POL.m, h: POL.h - POL.m - POL.lip };
/* Hachi: his width, where his middle is across the paper, how far down his frame the paper's top edge is (his paws
 * hang over below it; scripts/hachi-sprite.mjs prints where they are), a lean of his own */
const DOG = { w: 262, x: -104, edge: 0.845, rot: -0.04 };
const INK = '#2a2140';

const CSS = `
  .sf { position: absolute; inset: 0; container-type: size; overflow: hidden; background: #b98ab4; }
  .sf[hidden] { display: none; }
  /* the whole picture, as tall as the frame, slid so the polaroid is in the middle */
  .sf-stage { position: absolute; top: 0; height: 100cqh; width: 160cqh; left: clamp(100cqw - 160cqh, 50cqw - ${(POL.cx / W * 160).toFixed(2)}cqh, 0px); }
  .sf-stage video { position: absolute; object-fit: cover; background: #2b2542; }
  .sf-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  /* the writing side while the selfie is on: the words, the buttons, the privacy line */
  .sf-panel { flex: 1; display: flex; flex-direction: column; min-height: 0; margin: 1.2cqw 0 0; }
  .sf-panel[hidden] { display: none; }
  .sf-say { margin: 0 12.5cqw 0 0; min-height: 3em; font-size: max(12px, 1.5cqw); line-height: 1.5; color: #6c6482; }
  .sf-acts { display: flex; flex-wrap: wrap; gap: .9cqw; margin: auto 0 0; padding-top: 1.2cqw; }
  .sf-acts > * { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: .6cqw; min-width: 0;
    padding: 1.05cqw .8cqw; border-radius: .9cqw; border: 1.5px solid #3b3263; background: #fff; color: #3b3263; text-decoration: none;
    font: inherit; font-size: max(12px, 1.45cqw); line-height: 1.2; font-weight: 700; white-space: nowrap; cursor: pointer; }
  .sf-acts > .primary { flex: 1 0 100%; padding: 1.45cqw .8cqw; background: #3b3263; color: #fff; font-size: max(14px, 1.75cqw); }
  .sf-acts > :hover { transform: translateY(-1px); }
  .sf-acts > [hidden] { display: none; }
  .sf-acts > :focus-visible { outline: 3px solid #e59bb0; outline-offset: 2px; }
  .sf-acts svg { width: 1.25em; height: 1.25em; flex: none; }
  .sf-acts .dot { width: 1.05em; height: 1.05em; flex: none; border-radius: 50%; background: #e0566b; box-shadow: 0 0 0 2.5px #fff; }
  .sf-note { display: flex; align-items: center; gap: .5em; margin: 1.1cqw 0 0; font-size: max(11px, 1.2cqw); font-weight: 600; color: #6c6482; }
  .sf-note svg { width: 1.15em; height: 1.15em; flex: none; }
  @media (max-width: 700px) and (orientation: portrait) {
    .sf-panel { margin: 10px 0 0; }
    .sf-say { margin: 0 62px 0 0; font-size: 14px; }
    .sf-acts { gap: 8px; padding-top: 12px; }
    .sf-acts > * { padding: 10px 6px; border-radius: 9px; font-size: 14px; }
    .sf-acts > .primary { padding: 13px 6px; font-size: 16px; }
    .sf-note { margin: 10px 0 0; font-size: 12.5px; }
  }
`;
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" class="o"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';

const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });

/** `src` (a video, an image) drawn to cover the rect, mirrored for the front camera; `ax`: which part across is kept. */
function cover(x, src, sw, sh, dx, dy, dw, dh, mirror, ax = 0.5) {
  const k = Math.max(dw / sw, dh / sh), cw = dw / k, ch = dh / k;
  x.save();
  x.beginPath(); x.rect(dx, dy, dw, dh); x.clip();
  if (mirror) { x.translate(dx * 2 + dw, 0); x.scale(-1, 1); }
  x.drawImage(src, (sw - cw) * ax, (sh - ch) / 2, cw, ch, dx, dy, dw, dh);
  x.restore();
}

/** The picture.  `photo`: { src, w, h, mirror }, or null for the live view (a hole where the photo goes).
 *  `brand`: the title and the address on it (the saved picture; the postcard's frame would cut them). */
function compose(canvas, { bg, dog, paws, photo, brand = false }) {
  canvas.width = W; canvas.height = H;
  const x = canvas.getContext('2d');
  x.imageSmoothingQuality = 'high';
  cover(x, bg, bg.naturalWidth, bg.naturalHeight, 0, 0, W, H, false, BG_AX);
  x.save();
  x.translate(POL.cx, POL.cy); x.rotate(POL.rot);
  // Hachi, behind the polaroid: all of him first (the paper hides him below its edge)
  const dh = DOG.w * dog.naturalHeight / dog.naturalWidth, top = -POL.h / 2;
  const hachi = (img) => {
    x.translate(DOG.x, top); x.rotate(DOG.rot);
    x.drawImage(img, -DOG.w / 2, -dh * DOG.edge, DOG.w, dh);
  };
  x.save();
  x.shadowColor = 'rgba(30,16,50,.4)'; x.shadowBlur = 16; x.shadowOffsetY = 6;
  hachi(dog);
  x.restore();
  // the paper, the photo (or the hole the live view shows through)
  x.save();
  x.shadowColor = 'rgba(30,16,50,.55)'; x.shadowBlur = 38; x.shadowOffsetY = 16;
  x.fillStyle = '#fdfaf3';
  x.beginPath(); x.roundRect(-POL.w / 2, top, POL.w, POL.h, 7); x.fill();
  x.restore();
  if (photo) {
    cover(x, photo.src, photo.w, photo.h, WIN.x, WIN.y, WIN.w, WIN.h, photo.mirror);
    x.strokeStyle = 'rgba(42,33,64,.18)'; x.lineWidth = 2; x.strokeRect(WIN.x, WIN.y, WIN.w, WIN.h);
  } else x.clearRect(WIN.x, WIN.y, WIN.w, WIN.h);
  // the lip: written on
  const d = new Date();
  x.fillStyle = '#5a4f7a'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = "italic 500 38px 'Bradley Hand', 'Segoe Print', 'Segoe Script', 'Comic Sans MS', cursive";
  x.fillText(`${S.caption}  ·  ${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`, 0, POL.h / 2 - POL.lip / 2 - 2, POL.w - 48);
  // his paws, over the edge: the forelegs again, only below the paper's top
  x.save();
  x.beginPath(); x.rect(-POL.w, top + 1, POL.w * 2, POL.h); x.clip();
  x.shadowColor = 'rgba(30,16,50,.35)'; x.shadowBlur = 8; x.shadowOffsetY = 4;
  hachi(paws);
  x.restore();
  x.restore();
  if (!brand) return;
  // the title, in the sky; the address, in the corner
  x.textAlign = 'right'; x.textBaseline = 'alphabetic';
  x.fillStyle = '#5a4f7a';
  x.font = "700 21px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
  if ('letterSpacing' in x) x.letterSpacing = '5px';
  x.fillText(STRINGS.postcard.title.toUpperCase(), W - 58, 100);
  if ('letterSpacing' in x) x.letterSpacing = '0px';
  x.fillStyle = INK;
  x.font = "600 70px 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";
  x.fillText(STRINGS.title, W - 56, 176);
  const url = MAKER.share.replace(/^https?:\/\//, '');
  x.font = "700 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
  const tw = x.measureText(url).width;
  x.fillStyle = 'rgba(251,246,240,.93)';
  x.beginPath(); x.roundRect(W - 48 - tw - 44, H - 48 - 52, tw + 44, 52, 26); x.fill();
  x.fillStyle = INK;
  x.fillText(url, W - 48 - 22, H - 48 - 16);
}

/**
 * The selfie, on the postcard (`post`, its <article>).  `open()` asks for the camera; `stop()` lets it go (the
 * postcard calls it when it is put away); `file`: the picture once taken, for the share sheet.
 */
export function createSelfie({ post }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const pic = post.querySelector('.pic');
  const root = document.createElement('div');
  root.className = 'sf';
  root.hidden = true;
  // the photo's place in the picture (the polaroid's window, turned with it), for the live view under the canvas
  const c = Math.cos(POL.rot), s = Math.sin(POL.rot), wy = WIN.y + WIN.h / 2;
  const vx = POL.cx - s * wy, vy = POL.cy + c * wy;
  root.innerHTML = `<div class="sf-stage">
      <video playsinline muted autoplay disablepictureinpicture style="left:${(vx / W * 100).toFixed(3)}%;top:${(vy / H * 100).toFixed(3)}%;width:${((WIN.w + 6) / W * 100).toFixed(3)}%;height:${((WIN.h + 6) / H * 100).toFixed(3)}%;transform:translate(-50%,-50%) rotate(${POL.rot}rad) scaleX(-1)"></video>
      <canvas role="img" aria-label="${esc(S.alt)}"></canvas>
    </div>`;
  pic.appendChild(root);
  const panel = document.createElement('div');
  panel.className = 'sf-panel';
  panel.hidden = true;
  panel.innerHTML = `<p class="sf-say" role="status"></p>
    <div class="sf-acts">
      <button type="button" class="primary" data-sf="shot" data-fast-goal="postcard_selfie_shot"><span class="dot"></span><span>${esc(S.shutter)}</span></button>
      <a class="primary" data-sf="save" data-fast-goal="postcard_selfie_save" download="${esc(S.file)}">${ICON.share}<span>${esc(S.save)}</span></a>
      <button type="button" class="primary" data-sf="again">${ICON.camera}<span>${esc(S.again)}</span></button>
      <button type="button" data-sf="retake">${esc(S.retake)}</button>
      <button type="button" data-sf="cancel"></button>
    </div>
    <p class="sf-note">${LOCK}<span>${esc(S.note)}</span></p>`;
  post.querySelector('.back .share').before(panel);
  const video = root.querySelector('video'), canvas = root.querySelector('canvas'), say = panel.querySelector('.sf-say');
  const btn = Object.fromEntries([...panel.querySelectorAll('[data-sf]')].map((b) => [b.dataset.sf, b]));
  const save = btn.save;

  let art = null;            // the key art and Hachi, loaded once
  let stream = null, asking = 0, file = null, url = null;
  const arts = () => (art ??= Promise.all([load('keyart-1920.webp'), load(hachiUrl), load(pawsUrl)]).then(([bg, dog, paws]) => ({ bg, dog, paws })));

  /** which buttons, which words: ask (waiting for the camera), live, done, and no camera: blocked, none, busy */
  const set = (state) => {
    root.dataset.state = state;
    const no = state === 'blocked' || state === 'none' || state === 'busy';
    say.textContent = S.say[state];
    btn.shot.hidden = state !== 'live';
    btn.again.hidden = !no;
    btn.retake.hidden = save.hidden = state !== 'done';
    btn.cancel.textContent = state === 'done' ? S.remove : S.cancel;
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
    root.hidden = panel.hidden = true; post.classList.remove('sf-on');
    canvas.width = canvas.height = 0;            // the picture's memory back
    post.querySelector('.pc-add')?.focus({ preventScroll: true });
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
    save.focus({ preventScroll: true });
  };
  const open = async () => {
    forget();
    root.hidden = panel.hidden = false; post.classList.add('sf-on');
    set('ask');
    const a = await arts();
    compose(canvas, { ...a, photo: null });
    if (!navigator.mediaDevices?.getUserMedia) return set('none');
    const mine = ++asking;
    try {
      const got = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (mine !== asking || root.hidden) { for (const t of got.getTracks()) t.stop(); return; }
      stream = got;
      video.srcObject = stream;
      video.play().catch(() => {});                // (autoplay, muted, playsinline: it starts by itself; this is for a browser that waits to be told)
      // live once the first frame is in (or after 4 s, whatever came: the shutter waits for a frame anyway)
      if (video.readyState < 2) await new Promise((ok) => { video.addEventListener('loadeddata', ok, { once: true }); setTimeout(ok, 4000); });
      if (mine !== asking || root.hidden) return;
      set('live');
      btn.shot.focus({ preventScroll: true });
    } catch (e) {
      if (mine !== asking || root.hidden) return;
      set(e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' ? 'none' : e?.name === 'NotReadableError' || e?.name === 'AbortError' ? 'busy' : 'blocked');
      btn.again.focus({ preventScroll: true });
    }
  };
  panel.addEventListener('click', (e) => {
    const what = e.target.closest('[data-sf]')?.dataset.sf;
    if (what === 'cancel') close();
    if (what === 'retake' || what === 'again') open();
    if (what === 'shot' && stream && video.videoWidth) done({ src: video, w: video.videoWidth, h: video.videoHeight, mirror: true });
  });
  window.addEventListener('pagehide', stopCamera);

  return {
    open,
    /** the postcard is put away: the camera goes; a picture already taken stays for next time */
    stop() { if (root.dataset.state !== 'done' && !root.hidden) close(); else stopCamera(); },
    /** the picture, once taken (a JPEG File), else null */
    get file() { return file; },
    /** the camera is on */
    get live() { return !!stream && stream.getTracks().some((t) => t.readyState === 'live'); },
    get state() { return root.hidden ? 'off' : root.dataset.state; },
  };
}
