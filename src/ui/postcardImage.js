import { STRINGS } from '../data/strings.js';
import { TOWN_NAME } from '../data/town.js';
import { MAKER } from '../config.js';

/* The postcard as a picture (Tan, 2026-10-02: "aren't we supposed to share the entire thing in a postcard format?
 * ... it would be nice for somebody to send a postcard to their friend, rather than just a random image with a dog
 * and a date, which will not give them context").  What Share and Save send: one card, 1600 x 1240:
 *
 *   - the whole key art (16:9, nothing cut), the game's name in its sky;
 *   - with a selfie, the polaroid standing in the town, Hachi over its corner (ui/postcardSelfie.js takes it);
 *   - under it the writing side: the greeting, two lines that say what this is, the address lines ("To: a friend
 *     who misses Japan"), a stamp, and where to walk it yourself.
 *
 * Drawn here, in a canvas, on the device: a selfie never leaves it.  Its own chunk, loaded when the postcard shows.
 * ------------------------------------------------------------------ */

const P = STRINGS.postcard;
const W = 1600, H = 1240;
const ART = { x: 44, y: 44, w: 1512, h: 850.5 };
const INK = '#2a2140', SOFT = '#6c6482', PAPER = '#fdf8ef', RULE = '#e2d6d0', HAND = '#5a4f7a';
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";
const SCRIPT = "'Bradley Hand', 'Segoe Print', 'Segoe Script', 'Comic Sans MS', cursive";
const TITLE = "'TMBJ Title', 'Hiragino Maru Gothic ProN', 'Arial Rounded MT Bold', system-ui, sans-serif";
const JP = "'Hiragino Maru Gothic ProN', 'Hiragino Sans', 'Yu Gothic UI', 'Yu Gothic', Meiryo, sans-serif";
/* the polaroid on the art (the selfie's, a size down): centre, paper, margin, the lip under the photo */
const POL = { cx: 330, cy: 536, w: 430, h: 516, m: 20, lip: 90, rot: -0.07 };
const DOG = { w: 244, over: 0.43, right: 0.14, rot: 0.1 };

const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
let art = null, pup = null;
const arts = () => (art ??= Promise.all([load('keyart-1920.webp'), document.fonts?.load?.(`700 70px ${TITLE}`)?.catch?.(() => {})]).then(([bg]) => bg));
const pups = () => (pup ??= import('../assets/hachi-peek.webp').then((m) => load(m.default)));      // (only for a selfie: nothing of it loads before it is asked for)

/** `text` in lines no wider than `w` (the current font). */
function wrap(x, text, w) {
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (line && x.measureText(t).width > w) { out.push(line); line = word; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

function stamp(x, sx, sy, w) {
  const h = w / 0.82;
  x.save();
  x.translate(sx + w / 2, sy + h / 2); x.rotate(0.07); x.translate(-w / 2, -h / 2);
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  x.setLineDash([7, 6]); x.strokeStyle = '#d9c9c4'; x.lineWidth = 2.5; x.strokeRect(0, 0, w, h); x.setLineDash([]);
  const m = 9, iw = w - 2 * m, ih = h - 2 * m;
  x.save(); x.beginPath(); x.rect(m, m, iw, ih); x.clip();
  x.fillStyle = '#c9a8dc'; x.fillRect(m, m, iw, ih);
  x.fillStyle = '#f2a65a'; x.beginPath(); x.arc(m + iw * 0.78, m + ih * 0.22, iw * 0.09, 0, Math.PI * 2); x.fill();
  // Fuji and its snow
  x.fillStyle = '#7c6fb0'; x.beginPath(); x.moveTo(m - 4, m + ih * 0.8); x.lineTo(m + iw * 0.5, m + ih * 0.3); x.lineTo(m + iw + 4, m + ih * 0.8); x.closePath(); x.fill();
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(m + iw * 0.5, m + ih * 0.3); x.lineTo(m + iw * 0.66, m + ih * 0.46); x.lineTo(m + iw * 0.57, m + ih * 0.42); x.lineTo(m + iw * 0.5, m + ih * 0.49); x.lineTo(m + iw * 0.43, m + ih * 0.42); x.lineTo(m + iw * 0.34, m + ih * 0.46); x.closePath(); x.fill();
  x.fillStyle = '#e59bb0'; x.fillRect(m, m + ih * 0.8, iw, ih * 0.2);
  x.restore();
  x.fillStyle = '#fff'; x.font = `700 ${Math.round(w * 0.13)}px ${SANS}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('¥120', w / 2, m + ih * 0.9);
  x.restore();
}

/** `src` drawn to cover the rect. */
function cover(x, src, sw, sh, dx, dy, dw, dh) {
  const k = Math.max(dw / sw, dh / sh), cw = dw / k, ch = dh / k;
  x.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, dx, dy, dw, dh);
}

/**
 * The postcard's picture.  `photo`: { src, w, h } (a canvas or an image: the selfie, already cut and mirrored), or
 * null for the card as it is.  Returns a JPEG File.
 */
export async function postcardImage({ photo = null } = {}) {
  const bg = await arts(), dog = photo ? await pups() : null;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(42,33,64,.14)'; x.lineWidth = 2; x.strokeRect(13, 13, W - 26, H - 26);

  /* ---- the picture side: the whole key art ---- */
  x.save();
  x.beginPath(); x.roundRect(ART.x, ART.y, ART.w, ART.h, 10); x.clip();
  x.drawImage(bg, ART.x, ART.y, ART.w, ART.h);
  // a paper wash in the sky's corner, so the name reads
  const g = x.createRadialGradient(ART.x + ART.w * 0.86, ART.y + 70, 20, ART.x + ART.w * 0.86, ART.y + 70, 560);
  g.addColorStop(0, 'rgba(251,246,240,.78)'); g.addColorStop(0.55, 'rgba(251,246,240,.36)'); g.addColorStop(1, 'rgba(251,246,240,0)');
  x.fillStyle = g; x.fillRect(ART.x, ART.y, ART.w, ART.h);
  x.textAlign = 'right'; x.textBaseline = 'alphabetic';
  x.fillStyle = HAND;
  x.font = `700 21px ${JP}`;
  if ('letterSpacing' in x) x.letterSpacing = '3px';
  x.fillText(TOWN_NAME.jp, ART.x + ART.w - 46, ART.y + 76);
  const jw = x.measureText(TOWN_NAME.jp).width;
  x.font = `700 20px ${SANS}`;
  if ('letterSpacing' in x) x.letterSpacing = '5px';
  x.fillText(`${TOWN_NAME.en.toUpperCase()}  ·`, ART.x + ART.w - 46 - jw - 16, ART.y + 76);
  if ('letterSpacing' in x) x.letterSpacing = '0px';
  x.fillStyle = INK;
  x.font = `700 70px ${TITLE}`;
  x.fillText(STRINGS.title, ART.x + ART.w - 44, ART.y + 152);
  x.restore();

  /* ---- the selfie: a polaroid standing in the town, Hachi over its corner ---- */
  if (photo) {
    x.save();
    x.translate(ART.x + POL.cx, ART.y + POL.cy); x.rotate(POL.rot);
    const top = -POL.h / 2, wx = -POL.w / 2 + POL.m, wy = top + POL.m, ww = POL.w - 2 * POL.m, wh = POL.h - POL.m - POL.lip;
    x.save();
    x.shadowColor = 'rgba(30,16,50,.55)'; x.shadowBlur = 34; x.shadowOffsetY = 14;
    x.fillStyle = '#fdfaf3'; x.beginPath(); x.roundRect(-POL.w / 2, top, POL.w, POL.h, 7); x.fill();
    x.restore();
    x.save(); x.beginPath(); x.rect(wx, wy, ww, wh); x.clip(); cover(x, photo.src, photo.w, photo.h, wx, wy, ww, wh); x.restore();
    x.strokeStyle = 'rgba(42,33,64,.18)'; x.lineWidth = 2; x.strokeRect(wx, wy, ww, wh);
    const d = new Date();
    x.fillStyle = HAND; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `italic 500 33px ${SCRIPT}`;
    x.fillText(`${P.selfie.caption}  ·  ${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`, 0, POL.h / 2 - POL.lip / 2 - 2, POL.w - 44);
    const dh = DOG.w * dog.naturalHeight / dog.naturalWidth;
    x.translate(POL.w / 2 - DOG.w * (1 - DOG.right), top - dh * (1 - DOG.over));
    x.translate(DOG.w / 2, dh); x.rotate(DOG.rot); x.translate(-DOG.w / 2, -dh);
    x.shadowColor = 'rgba(30,16,50,.4)'; x.shadowBlur = 12; x.shadowOffsetY = 5;
    x.drawImage(dog, 0, 0, DOG.w, dh);
    x.restore();
  }

  /* ---- the writing side, under the picture ---- */
  const y0 = ART.y + ART.h, L = 60, MID = 930, R = W - 60;
  x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  x.fillStyle = INK; x.font = `600 52px ${SERIF}`;
  x.fillText(P.title, L, y0 + 86, MID - L - 40);
  x.fillStyle = SOFT; x.font = `400 28px ${SANS}`;
  wrap(x, P.image.msg, MID - L - 50).slice(0, 4).forEach((line, i) => x.fillText(line, L, y0 + 140 + i * 41));
  // the divider, as on a postcard's back
  x.strokeStyle = RULE; x.lineWidth = 2;
  x.beginPath(); x.moveTo(MID, y0 + 40); x.lineTo(MID, H - 46 - 58 - 26); x.stroke();
  // the address lines, the first written on
  const ax = MID + 44;
  for (let i = 0; i < 3; i++) { const ly = y0 + 104 + i * 58; x.beginPath(); x.moveTo(ax, ly); x.lineTo(i < 2 ? R - 150 : R, ly); x.stroke(); }
  x.fillStyle = HAND; x.font = `italic 500 37px ${SCRIPT}`;
  x.fillText(P.to, ax + 6, y0 + 92, R - 160 - ax);
  x.font = `italic 500 31px ${SCRIPT}`;
  x.fillText(P.image.from, ax + 6, y0 + 150, R - 160 - ax);
  stamp(x, R - 112, y0 + 26, 112);
  // where to walk it yourself
  const url = MAKER.share.replace(/^https?:\/\//, '');
  x.font = `700 30px ${SANS}`;
  const tw = x.measureText(url).width, pw = tw + 52, ph = 58, px = R - pw, py = H - 46 - ph;
  x.fillStyle = SOFT; x.font = `600 24px ${SANS}`; x.textAlign = 'right';
  x.fillText(P.image.play, px - 18, py + 39);
  x.fillStyle = '#3b3263'; x.beginPath(); x.roundRect(px, py, pw, ph, ph / 2); x.fill();
  x.fillStyle = '#fff'; x.font = `700 30px ${SANS}`; x.textAlign = 'center';
  x.fillText(url, px + pw / 2, py + 40);

  const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.9));
  cv.width = cv.height = 0;
  return new File([blob], P.selfie.file, { type: 'image/jpeg' });
}
