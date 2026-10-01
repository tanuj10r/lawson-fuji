/* The selfie postcard (ui/postcardSelfie.js; EXPERIMENT), with Chrome's fake camera:
 *   - nothing of it loads, and the camera is not asked for, before "Add your selfie" is clicked
 *   - the live view, the shot (the camera stops at once), Save image (a 1600x1000 JPEG), Retake
 *   - the postcard put away with the camera on: the camera stops
 *   - no camera (refused): the words, Choose a photo, the same picture from a file
 *   - nothing is sent anywhere: only GETs to this host, no page errors
 *   node scripts/_selfie.mjs [out-dir]     PORT (default 5187)
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
    const md = navigator.mediaDevices, real = md.getUserMedia.bind(md);
    md.getUserMedia = (c) => { window.__gum++; window.__gumAsked = c; return window.__gumRefuse ? Promise.reject(new DOMException('no', 'NotAllowedError')) : real(c); };
  });
  const shot = async (name, clip) => {
    await page.waitForTimeout(500);
    const f = path.join(OUT, name + '.png');
    await page.screenshot({ path: f, ...(clip ? { clip } : {}) });
    console.log('  ' + f);
  };
  const saveResult = async (name) => {
    const r = await page.evaluate(async () => {
      const a = document.querySelector('.sf [data-sf=save]');
      const blob = await (await fetch(a.href)).blob();
      const bmp = await createImageBitmap(blob);
      const b64 = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
      return { w: bmp.width, h: bmp.height, type: blob.type, bytes: blob.size, download: a.download, b64 };
    });
    const f = path.join(OUT, name + '.jpg');
    fs.writeFileSync(f, Buffer.from(r.b64, 'base64'));
    console.log('  ' + f);
    delete r.b64;
    return r;
  };
  const st = () => page.evaluate(() => { const s = window.__postcard.card?.selfie; return { state: s?.state ?? null, live: !!s?.live, file: !!s?.file, open: !!window.__postcard.card?.open }; });
  const until = (state) => page.waitForFunction((state) => window.__postcard.card?.selfie?.state === state, state, { timeout: 20000 }).catch(() => {});
  const openPostcard = async () => { await page.click('.menu-postcard'); await page.waitForFunction(() => window.__postcard.card?.open, null, { timeout: 15000 }); await page.waitForTimeout(600); };

  await page.goto(base);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000, polling: 500 });
  await page.evaluate(() => { const { hud } = window.__scene; hud.setLocked(true); hud.setLocked(false); });
  await openPostcard();
  check('the postcard offers "Add your selfie"; nothing of it loaded, the camera not asked for',
    await page.evaluate(() => document.querySelector('.mk-post .pc-selfie')?.textContent) === 'Add your selfie 📷'
    && !reqs.some((r) => /postcardSelfie|hachi-peek/.test(r.url)) && await page.evaluate(() => window.__gum) === 0);
  await shot('1-postcard-offer');

  await page.click('.mk-post .pc-selfie');
  await until('live');
  let s = await st();
  const asked = await page.evaluate(() => window.__gumAsked);
  check('a click: the camera is asked for (video only, the front one), the live view shows', s.state === 'live' && s.live && asked.audio === false && asked.video.facingMode === 'user', { ...s, asked });
  check('the live view: playsinline, muted; "Your photo stays on your device"', await page.evaluate(() => { const v = document.querySelector('.sf video');
    return v.playsInline && v.muted && v.videoWidth > 0 && /stays on your device/.test(document.querySelector('.sf-note').textContent); }));
  await shot('2-live');

  await page.click('.sf [data-sf=shot]');
  await until('done');
  s = await st();
  check('the shot: the picture is made and the camera stops at once', s.state === 'done' && !s.live && s.file, s);
  let r = await saveResult('result-1-fake-camera');
  check('Save image: a 1600x1000 JPEG download', r.w === 1600 && r.h === 1000 && r.type === 'image/jpeg' && /\.jpg$/.test(r.download), r);
  await shot('3-done');

  await page.click('.sf [data-sf=retake]');
  await until('live');
  s = await st();
  check('Retake: the camera again', s.state === 'live' && s.live, s);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  s = await st();
  check('the postcard put away (Esc) with the camera on: the camera stops, the selfie is put away', !s.open && !s.live && s.state === 'off', s);

  // no camera: refused
  await page.evaluate(() => { window.__gumRefuse = true; });
  await openPostcard();
  await page.click('.mk-post .pc-selfie');
  await until('none');
  s = await st();
  check('the camera refused: the words and Choose a photo', s.state === 'none' && !s.live
    && await page.evaluate(() => /Choose a photo/.test(document.querySelector('.sf-msg').textContent) && !document.querySelector('.sf [data-sf=choose]').hidden), s);
  await shot('4-no-camera');
  for (const [i, f] of [[2, 'og-square.jpg'], [3, 'keyart-portrait.webp']]) {
    await page.setInputFiles('.sf input[type=file]', path.join(ROOT, 'public', f));
    await until('done');
    r = await saveResult(`result-${i}-chosen-photo`);
    check(`a chosen photo (${f}): the same picture`, r.w === 1600 && r.h === 1000, r);
    if (i === 2) { await shot('5-done-chosen-photo'); await page.click('.sf [data-sf=retake]'); await until('none'); }
  }
  // Back and again: the picture is kept; Cancel-less "done" has Retake and Save
  await page.click('.mk-post .pc-back');
  await openPostcard();
  s = await st();
  check('Back and the postcard again: the picture is still there, the camera off', s.state === 'done' && !s.live && s.file, s);

  const sent = reqs.filter((q) => q.method !== 'GET' || !(q.url.startsWith(base) || /^(blob|data):/.test(q.url)));
  check('nothing sent anywhere: only GETs to this host', sent.length === 0, sent.slice(0, 5));
  check('the camera was asked for only on clicks', await page.evaluate(() => window.__gum) === 4, await page.evaluate(() => window.__gum));
  check('no page errors', errs.length === 0, errs.slice(0, 5));
  await ctx.close();
} finally {
  await done();
}
console.log(bad ? `${bad} FAILED` : 'all pass');
if (bad) process.exitCode = 1;
