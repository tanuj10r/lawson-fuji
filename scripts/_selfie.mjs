/* The selfie postcard (ui/postcardSelfie.js), with Chrome's fake camera:
 *   - "Add your selfie with Hachi" is the postcard's first, widest button; nothing of the selfie loads, and the camera
 *     is not asked for, before it is clicked
 *   - the live view: the picture shows only the art, the polaroid and Hachi; the words, the buttons and the privacy
 *     line are on the writing side, none of them over the picture
 *   - Space on the shutter takes the photo and does not walk on; the camera stops at once; Save image (a 1600x1000
 *     JPEG); Retake; Remove
 *   - the postcard put away with the camera on: the camera stops
 *   - camera only: refused, the words say how to allow it, Try again; no camera, the words say so; no file input
 *   - nothing is sent anywhere: only GETs to this host, no page errors
 *   node scripts/_selfie.mjs [out-dir]     PORT (default 5187)
 * Screenshots of each state at 1280x720 and 1600x900 and two saved pictures, `v2-` first.
 * Its own dev server and one headless Chrome (on /tmp/lawson-browser.lock); both closed however it ends. */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, '.shots', 'selfie'));
fs.mkdirSync(OUT, { recursive: true });
const PORT = +process.env.PORT || 5187;

const LOCK = '/tmp/lawson-browser.lock';
for (;;) { try { fs.mkdirSync(LOCK); break; } catch { console.log('  waiting for the browser lock'); await new Promise((r) => setTimeout(r, 10000)); } }
let server, browser;
const done = async () => {
  await Promise.race([Promise.all([browser?.close(), server?.close()]), new Promise((r) => setTimeout(r, 6000))]).catch(() => {});
  try { fs.rmdirSync(LOCK); } catch {}
};
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await done(); process.exit(130); });

let bad = 0;
const check = (name, ok, info) => { if (!ok) bad++; console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${info === undefined ? '' : '  ' + JSON.stringify(info)}`); };

try {
  server = await createServer({ root: ROOT, logLevel: 'error', server: { port: PORT, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  const base = `http://127.0.0.1:${PORT}/`;
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist',
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  const errs = [], reqs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|404/.test(m.text())) errs.push(m.text()); });
  page.on('request', (r) => reqs.push({ url: r.url(), method: r.method() }));
  await page.addInitScript(() => {
    window.__gum = 0;
    window.__goals = []; window.datafast = (...a) => { window.__goals.push(a); };
    window.__shared = []; navigator.canShare = (d) => !!d?.files?.length; navigator.share = (d) => { window.__shared.push({ files: d.files?.length ?? 0, keys: Object.keys(d) }); return Promise.resolve(); };
    const md = navigator.mediaDevices, real = md.getUserMedia.bind(md);
    md.getUserMedia = (c) => { window.__gum++; window.__gumAsked = c; return window.__gumRefuse ? Promise.reject(new DOMException('no', window.__gumRefuse)) : real(c); };
  });
  /** a state, at both sizes */
  const shots = async (name) => {
    for (const [w, h] of [[1280, 720], [1600, 900]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(500);
      const f = path.join(OUT, `v2-${name}-${w}x${h}.png`);
      await page.screenshot({ path: f });
      console.log('  ' + f);
    }
    await page.setViewportSize({ width: 1280, height: 720 });
  };
  const saveResult = async (name) => {
    const r = await page.evaluate(async () => {
      const a = document.querySelector('.sf-panel [data-sf=save]');
      const blob = await (await fetch(a.href)).blob();
      const bmp = await createImageBitmap(blob);
      const b64 = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
      return { w: bmp.width, h: bmp.height, type: blob.type, bytes: blob.size, download: a.download, b64 };
    });
    const f = path.join(OUT, `v2-${name}.jpg`);
    fs.writeFileSync(f, Buffer.from(r.b64, 'base64'));
    console.log('  ' + f);
    delete r.b64;
    return r;
  };
  const st = () => page.evaluate(() => { const s = window.__postcard.card?.selfie; return { state: s?.state ?? null, live: !!s?.live, file: !!s?.file, open: !!window.__postcard.card?.open, tries: window.__lockTries }; });
  const until = (state) => page.waitForFunction((state) => window.__postcard.card?.selfie?.state === state, state, { timeout: 20000 }).catch(() => {});
  const openPostcard = async () => { await page.click('.menu-postcard'); await page.waitForFunction(() => window.__postcard.card?.open, null, { timeout: 15000 }); await page.waitForTimeout(600); };
  /** the picture holds only the stage; every control and word of the selfie is on the writing side, clear of the picture and inside the card */
  const layout = () => page.evaluate(() => {
    const r = (e) => e.getBoundingClientRect();
    const pic = r(document.querySelector('.mk-post .pic')), card = r(document.querySelector('.mk-post'));
    const shown = [...document.querySelectorAll('.sf-panel .sf-say, .sf-panel [data-sf]:not([hidden]), .sf-panel .sf-note, .mk-post .share > :not(.no-share), .mk-post .maker')].map(r).filter((b) => b.width > 0);
    const over = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const each = shown.some((a, i) => shown.some((b, j) => i < j && over(a, b)));
    const win = r(document.querySelector('.sf video'));
    return { n: shown.length, clearOfPicture: shown.every((b) => !over(b, pic)), inCard: shown.every((b) => b.left >= card.left - 1 && b.right <= card.right + 1 && b.top >= card.top - 1 && b.bottom <= card.bottom + 1),
      apart: !each, inPicture: [...document.querySelector('.mk-post .pic').children].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.tagName + '.' + e.className),
      liveView: Math.round(win.width) };
  });
  const layoutOk = (l) => l.clearOfPicture && l.inCard && l.apart && l.inPicture.join() === 'IMG.,DIV.sf';

  await page.goto(base);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000, polling: 500 });
  await page.evaluate(() => {
    const { hud, player } = window.__scene;
    window.__lockTries = 0;
    player.lock = () => { window.__lockTries++; const r = Promise.reject(new DOMException('no', 'NotAllowedError')); r.catch(() => {}); return r; };
    hud.setLocked(true); hud.setLocked(false);
  });
  check('the little postcard has its camera badge', await page.evaluate(() => { const c = document.querySelector('.menu-postcard .cam'); return !!c && c.getBoundingClientRect().width >= 24 && !!c.querySelector('svg'); }));
  await openPostcard();
  const offer = await page.evaluate(() => {
    const b = document.querySelector('.mk-post .pc-add'), back = document.querySelector('.mk-post .back'), share = document.querySelector('.mk-post .share');
    const r = b.getBoundingClientRect(), cs = getComputedStyle(back), inner = back.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const others = [...share.children].map((e) => e.getBoundingClientRect().height);
    return { text: b.textContent, icon: !!b.querySelector('svg'), wide: r.width / inner, tall: r.height, others: Math.max(...others), first: !!(b.compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING) && r.top < share.getBoundingClientRect().top,
      filled: getComputedStyle(b).backgroundColor, focused: document.activeElement === b };
  });
  check('"Add your selfie with Hachi": the first button, the full width, the tallest, filled, with the camera', offer.text === 'Add your selfie with Hachi' && offer.icon
    && offer.wide > 0.98 && offer.tall > offer.others && offer.first && offer.filled === 'rgb(59, 50, 99)', offer);
  check('before the click: nothing of the selfie loaded, the camera not asked for, no file input anywhere',
    !reqs.some((r) => /postcardSelfie|hachi-(peek|paws)/.test(r.url)) && await page.evaluate(() => window.__gum === 0 && !document.querySelector('input[type=file]')));
  await shots('1-offer');

  await page.click('.mk-post .pc-add');
  await until('live');
  let s = await st();
  const asked = await page.evaluate(() => window.__gumAsked);
  check('a click: the camera is asked for (video only, the front one), the live view shows', s.state === 'live' && s.live && asked.audio === false && asked.video.facingMode === 'user', { ...s, asked });
  check('the live view: playsinline, muted; "Your photo stays on your device" with the buttons', await page.evaluate(() => { const v = document.querySelector('.sf video');
    return v.playsInline && v.muted && v.videoWidth > 0 && /stays on your device/.test(document.querySelector('.sf-panel .sf-note').textContent); }));
  let l = await layout();
  check('live: the picture shows only the art, the polaroid and Hachi; the controls on the writing side, nothing over anything', layoutOk(l) && l.liveView >= 120, l);
  await shots('2-live');

  // Space on the shutter (it has the focus): the photo, not the walk
  check('the shutter has the focus', await page.evaluate(() => document.activeElement?.dataset.sf === 'shot'));
  await page.keyboard.press('Space');
  await until('done');
  s = await st();
  check('Space on the shutter takes the photo and does not walk on; the camera stops at once', s.state === 'done' && !s.live && s.file && s.open && s.tries === 0, s);
  let r = await saveResult('result-1');
  check('Save image: a 1600x1000 JPEG download', r.w === 1600 && r.h === 1000 && r.type === 'image/jpeg' && /\.jpg$/.test(r.download), r);
  l = await layout();
  check('taken: the same, Save image first', layoutOk(l) && await page.evaluate(() => document.activeElement?.dataset.sf === 'save'), l);
  await shots('3-taken');

  await page.focus('.sf-panel [data-sf=retake]');
  await page.keyboard.press('Space');
  await until('live');
  s = await st();
  check('Space on Retake: the camera again, no walking on', s.state === 'live' && s.live && s.open && s.tries === 0,
    { ...s, gum: await page.evaluate(() => window.__gum), video: await page.evaluate(() => { const v = document.querySelector('.sf video'); return [v.readyState, v.paused, !!v.srcObject, v.videoWidth]; }) });
  await page.waitForTimeout(1200);
  await page.click('.sf-panel [data-sf=shot]');
  await until('done');
  r = await saveResult('result-2');
  check('a second photo', r.w === 1600 && r.h === 1000, r);
  await page.click('.sf-panel [data-sf=retake]');
  await until('live');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  s = await st();
  check('the postcard put away (Esc) with the camera on: the camera stops, the selfie is put away', !s.open && !s.live && s.state === 'off', s);

  // camera only: refused
  await page.evaluate(() => { window.__gumRefuse = 'NotAllowedError'; });
  await openPostcard();
  await page.click('.mk-post .pc-add');
  await until('blocked');
  s = await st();
  l = await layout();
  const words = () => page.evaluate(() => document.querySelector('.sf-say').textContent);
  check('the camera refused: how to allow it, Try again; no upload', s.state === 'blocked' && !s.live && /address bar/.test(await words()) && layoutOk(l)
    && await page.evaluate(() => !document.querySelector('.sf-panel [data-sf=again]').hidden && !document.querySelector('input[type=file]') && !/choose|upload/i.test(document.querySelector('.mk-post').textContent)), { ...s, words: await words(), l });
  await shots('4-refused');
  await page.evaluate(() => { window.__gumRefuse = 'NotFoundError'; });
  await page.click('.sf-panel [data-sf=again]');
  await until('none');
  check('no camera: the words say so', (await st()).state === 'none' && /No camera/.test(await words()), await words());
  await page.evaluate(() => { window.__gumRefuse = null; });
  await page.click('.sf-panel [data-sf=again]');
  await until('live');
  check('allowed, Try again: the live view', (await st()).live);
  await page.click('.sf-panel [data-sf=shot]');
  await until('done');
  // Back and again: the picture is kept; Remove puts the postcard back as it was
  await page.click('.mk-post .pc-back');
  await openPostcard();
  s = await st();
  check('Back and the postcard again: the picture is still there, the camera off', s.state === 'done' && !s.live && s.file, s);
  await page.click('.sf-panel [data-sf=cancel]');
  s = await st();
  check('Remove: the postcard as it was, the picture gone', s.state === 'off' && !s.file
    && await page.evaluate(() => getComputedStyle(document.querySelector('.mk-post .msg')).display !== 'none' && getComputedStyle(document.querySelector('.mk-post .pc-add')).display !== 'none'), s);

  // the goals (Tan: how many take selfies): names only, each when it happens
  await page.click('.mk-post .pc-add');
  await until('live');
  await page.click('.sf-panel [data-sf=shot]');
  await until('done');
  await page.click('.mk-post [data-pc=share]');
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('.sf-panel [data-sf=save]').addEventListener('click', (e) => e.preventDefault(), { once: true }));
  await page.click('.sf-panel [data-sf=save]');
  const goals = await page.evaluate(() => window.__goals);
  const names = goals.map((g) => g[0]), n = (k) => names.filter((x) => x === k).length;
  // opened 3 times (the first, the refused one, this one); the camera came 5 times (first, retake x2, try again, this); no camera twice; 4 shots
  check('goals: selfie_open 3, selfie_camera_allowed 5, selfie_camera_refused 2, selfie_taken 4, selfie_saved 1, selfie_shared 1; a name only each time',
    n('selfie_open') === 3 && n('selfie_camera_allowed') === 5 && n('selfie_camera_refused') === 2 && n('selfie_taken') === 4 && n('selfie_saved') === 1 && n('selfie_shared') === 1
    && goals.every((g) => g.length === 1 && typeof g[0] === 'string'), names);
  check('Share with a picture: the file goes to the share sheet', await page.evaluate(() => window.__shared.length === 1 && window.__shared[0].files === 1), await page.evaluate(() => window.__shared));

  const sent = reqs.filter((q) => q.method !== 'GET' || !(q.url.startsWith(base) || /^(blob|data):/.test(q.url)));
  check('nothing sent anywhere: only GETs to this host', sent.length === 0, sent.slice(0, 5));
  check('the camera was asked for only on clicks and keys', await page.evaluate(() => window.__gum) === 7, await page.evaluate(() => window.__gum));
  check('no page errors', errs.length === 0, errs.slice(0, 5));
  await ctx.close();
} finally {
  await done();
}
console.log(bad ? `${bad} FAILED` : 'all pass');
if (bad) process.exitCode = 1;
