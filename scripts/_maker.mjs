/* Made by Tan (ui/maker.js): the chip on the cards, the row on the phone card,
 * the postcard at the end of Hachi's tour.  Screenshots and checks:
 *   - the chip on the start and pause cards (1280x720, 1600x900), the row on the phone card (390x844)
 *   - every link: a new tab, rel=noopener, a DataFast goal; a click on the chip never starts the game
 *   - every link out carries ?ref=takemebacktojapan (config.js MAKER.ref)
 *   - the little postcard: never on the start card, on every pause card from the first (always glowing: Tan); before
 *     Hachi's tour is over the postcard says "wish you were here", after it "you've seen the whole town"
 *   - the postcard: comes by itself once, holds the pause card back while up; a click takes the pointer back (or,
 *     refused, the pause card comes); Esc shows the pause card; Space (the pointer back) closes it
 *   - no page errors
 *   node scripts/_maker.mjs [out-dir]     PORT (default 5187)
 * Its own dev server and one headless Chrome (on /tmp/lawson-browser.lock); both closed however it ends.
 * Other sites are never contacted: Chrome resolves no host but this one (no request interception, which upsets
 * the streamed title song); a new tab's address is what is checked. */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, '.shots', 'maker'));
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
const shot = async (page, name) => {
  await page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => i.decode().catch(() => {}))));
  await page.waitForTimeout(600);
  const f = path.join(OUT, name + '.png');
  await page.screenshot({ path: f });
  console.log('  ' + f);
};
const local = async () => {};
/** every link out on the page: target, rel, goal */
const linksOk = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((a) => ({
  href: a.href, ok: a.target === '_blank' && /noopener/.test(a.rel) && !!a.dataset.fastGoal,
})), sel);

try {
  server = await createServer({ root: ROOT, logLevel: 'error', server: { port: PORT, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  const base = `http://127.0.0.1:${PORT}/`;
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });

  /* ---- the desktop game ---- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await local(ctx);
    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(180000);
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|404/.test(m.text())) errs.push(m.text()); });
    await page.goto(base);
    // the loading card has the chip too, before any game code
    check('loading card: the chip', await page.evaluate(() => !!document.querySelector('#boot .mk-chip img[src="tan.webp"]')));
    await page.waitForFunction(() => window.__ready === true && document.querySelector('.overlay:not(.boot) .menu-art img')?.complete, null, { timeout: 240000, polling: 500 });
    const mode = (m) => page.evaluate((m) => {
      const { hud } = window.__scene;
      if (m === 'paused') { hud.setLocked(true); hud.setLocked(false); }
      const o = document.querySelector('.overlay:not(.boot)');
      o.dataset.mode = m; o.classList.remove('hidden');
      hud.setLocked(false);
    }, m);

    /* Start only on purpose (Tan): the first click on the start card wakes the title song and starts nothing.
     * The pointer is played by hand: refused (headless can't lock) or granted (lockAs). */
    await page.evaluate(() => {
      window.__lockTries = 0; window.__lockMode = 'refuse';
      const { player } = window.__scene;
      player.lock = () => { window.__lockTries++; if (window.__lockMode !== 'refuse') return new Promise(() => {}); const r = Promise.reject(new DOMException('no', 'NotAllowedError')); r.catch(() => {}); return r; };   // (as player.lock: a refusal is handled)
    });
    const tries = () => page.evaluate(() => window.__lockTries);
    const toast = () => page.evaluate(() => { const t = document.querySelector('.toast'); return t.classList.contains('on') ? t.textContent : ''; });
    const cardState = () => page.evaluate(() => { const o = document.querySelector('.overlay:not(.boot)'); return { up: !o.classList.contains('hidden'), mode: o.dataset.mode }; });
    await page.click('.overlay:not(.boot) .menu-tagline');
    const level = await page.evaluate(() => window.__scene.sound.debug.level(1500));
    let c = await cardState();
    check('start card: the first click plays the title song and starts nothing', c.up && c.mode === 'start' && await tries() === 0 && level.rms > 0.0005, { ...c, level });
    await shot(page, 'A-start-after-first-click-1280x720');
    await page.mouse.click(20, 20);                        // the dim backdrop round the card
    check('start card: a click on the backdrop starts nothing', (await cardState()).up && await tries() === 0);
    await page.keyboard.press('Space');                   // Space asks for the pointer; this one is refused
    await page.waitForTimeout(200);
    c = await cardState();
    const t1 = await toast();
    check('start card: Space asks for the pointer; refused, the card stays and says press Start', await tries() === 1 && c.up && /press Start/.test(t1), { ...c, t1 });
    await shot(page, 'A-start-space-refused-1280x720');
    await page.click('.overlay:not(.boot) .menu-action');
    check('start card: the Start button asks for the pointer', await tries() === 2);

    // the start card first at both sizes (the card never goes back to "start" once played)
    for (const m of ['start', 'paused']) {
      for (const [w, h] of [[1280, 720], [1600, 900]]) {
        await page.setViewportSize({ width: w, height: h });
        if (m === 'start') await page.evaluate(() => { const o = document.querySelector('.overlay:not(.boot)'); o.dataset.mode = 'start'; o.classList.remove('hidden'); });
        else await mode('paused');
        const r = await page.evaluate(() => {
          const chip = document.querySelector('.overlay:not(.boot) .mk-chip').getBoundingClientRect();
          const art = document.querySelector('.overlay:not(.boot) .menu-art').getBoundingClientRect();
          const menu = document.querySelector('.overlay:not(.boot) .menu').getBoundingClientRect();
          const where = [...document.querySelectorAll('.overlay:not(.boot) .mk-chip a')].map((a) => a.dataset.fastGoalWhere);
          return { inArt: chip.left >= art.left && chip.right <= art.right && chip.top >= art.top && chip.bottom <= art.bottom,
            fits: menu.top >= 0 && menu.bottom <= innerHeight, where: [...new Set(where)], first: document.querySelector('.overlay:not(.boot) .mk-chip a').dataset.fastGoal };
        });
        const mini = await page.evaluate(() => { const b = document.querySelector('.menu-postcard'); const r = b.getBoundingClientRect();
          return { shown: !b.hidden && r.width > 0, glow: b.classList.contains('glow'), onScreen: r.right <= innerWidth && r.bottom <= innerHeight }; });
        if (m === 'start') check(`${w}x${h} start: no little postcard on the start card`, !mini.shown, mini);
        else check(`${w}x${h} paused: the little postcard is there, glowing`,
          mini.shown && mini.onScreen && mini.glow, mini);
        check(`${w}x${h} ${m}: the chip on the art, the card fits, coffee first, goal label`, r.inArt && r.fits && r.first === 'maker_coffee'
          && r.where.length === 1 && r.where[0] === (m === 'paused' ? 'pause_card' : 'start_card'), r);
        await shot(page, `A-${m}-${w}x${h}${m === 'paused' && w === 1280 ? '-postcard-glow' : ''}`);
      }
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    await mode('paused');

    // links: new tab, noopener, a goal; clicking them (or anything on the card but Resume) never resumes
    const ls = await linksOk(page, '.overlay:not(.boot) .mk-chip a');
    const REF = '?ref=takemebacktojapan';
    const WANT = ['https://buymeacoffee.com/tanuj10r0', 'https://x.com/tanuj10r', 'https://github.com/tanuj10r', 'https://tanuj.fyi/'].map((u) => u + REF);
    const refs = (l) => WANT.every((u) => l.some((a) => a.href === u));
    check('chip links: 4, new tab, noopener, goals, ?ref=takemebacktojapan', ls.length === 4 && ls.every((l) => l.ok)
      && ls[0].href === WANT[0] && refs(ls), ls.map((l) => l.href));
    const t0 = await tries();
    const opened = [];
    for (const sel of ['.mk-chip .mk-coffee', '.mk-chip .mk-i:nth-of-type(2)', '.mk-chip .mk-who', '.mk-chip .mk-face', '.menu-tagline', '.menu-url']) {
      const pop = /mk-coffee|mk-i/.test(sel) ? ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null) : null;
      await page.click(`.overlay:not(.boot) ${sel}`);
      const p = pop && await pop;
      if (p) { opened.push(p.url() === 'about:blank' ? (await p.waitForEvent('framenavigated').catch(() => null), p.url()) : p.url()); await p.close(); }
    }
    check('pause card: chip links open tabs; no click but Resume resumes', await tries() === t0 && opened.length === 2 && (await cardState()).up, { opened });
    // the volume still works on the card
    await page.evaluate(() => { const v = document.querySelector('.volume-slider'); v.value = '75'; v.dispatchEvent(new Event('input', { bubbles: true })); });
    check('pause card: the volume slider still sets the volume', await page.evaluate(() => document.querySelector('.audio-head output').textContent) === '75%' && await tries() === t0);

    /* the postcard: as play would bring it (player.locked and onLockChange played by hand, what pointerlockchange does) */
    const lockAs = (on) => page.evaluate((on) => { const { player } = window.__scene; player.locked = on; player.onLockChange(on); }, on);
    const pc = () => page.evaluate(() => {
      const el = document.querySelector('.mk-post-scrim');
      const card = document.querySelector('.overlay:not(.boot)');
      const mini = document.querySelector('.menu-postcard');
      return { open: !!window.__postcard.card?.open, visible: !!el && getComputedStyle(el).display !== 'none',
        card: !card.classList.contains('hidden'), hold: window.__scene.hud.holdCard, mini: !mini.hidden, glow: mini.classList.contains('glow') };
    });
    const openMini = async () => { await page.click('.menu-postcard'); await page.waitForFunction(() => window.__postcard.card?.open, null, { timeout: 15000 }).catch(() => {}); };
    const words = () => page.evaluate(() => document.querySelector('.mk-post .msg')?.textContent ?? '');
    // before the tour is over: the little postcard opens the postcard (loaded on that click), "wish you were here"
    check('before the tour: the postcard is not loaded yet', await page.evaluate(() => !window.__postcard.card));
    await openMini();
    let s = await pc();
    check('before the tour: the little postcard opens the postcard, "Wish you were here"', s.open && s.visible && !s.card && s.hold && /^Wish you were here/.test(await words()), { ...s, words: await words() });
    await shot(page, 'B-postcard-before-tour-1280x720');
    await page.click('.mk-post .pc-back');
    s = await pc();
    check('before the tour: Back returns to the pause card, the little postcard still there', !s.open && s.card && s.mini, s);
    // seen from the pause card already: Hachi settling brings no second card, and the tour may be offered again at once
    await lockAs(true);
    check('postcard: seen from the pause card, the tour\'s end brings no second card and the tour is on offer', await page.evaluate(async () => { window.__postcard.nap(); await new Promise((r) => setTimeout(r, 300)); return window.__postcard.pending() === -1 && !window.__postcard.card.open && window.__postcard.gate(); }));
    // not seen yet (a fresh page load's state): no tour again before the card, nor while it is due
    await page.evaluate(() => window.__postcard.forget());
    check('tour again: not on offer before the postcard has been up', await page.evaluate(() => !window.__postcard.gate()));
    await page.evaluate(() => window.__postcard.nap());
    await page.waitForFunction(() => window.__postcard.pending() > 0 || window.__postcard.card?.open, null, { timeout: 10000 }).catch(() => {});
    check("postcard: Hachi settled after his bit loads it and sets it due (0.6 s); the tour is not on offer meanwhile", await page.evaluate(() => !!window.__postcard.card && !window.__postcard.gate()));
    await page.waitForFunction(() => window.__postcard.card?.open, null, { timeout: 15000 }).catch(() => {});
    await lockAs(false);                 // what document.exitPointerLock brings
    await page.waitForTimeout(700);
    s = await pc();
    check('postcard: comes by itself at the nap, the pause card waits behind it, "You’ve seen the whole town"', s.open && s.visible && !s.card && s.hold && /seen the whole town/.test(await words()), { ...s, words: await words() });
    await shot(page, 'B-postcard-1280x720');
    await page.setViewportSize({ width: 1600, height: 900 });
    await shot(page, 'B-postcard-1600x900');
    await page.setViewportSize({ width: 1280, height: 720 });
    const pl = await linksOk(page, '.mk-post a:not([data-pc="save"])');      // (Save postcard is a download of the card's own picture, not a link out)
    check('postcard links: new tab, noopener, goals; Share, Copy have goals; Back is there', pl.length === 5 && pl.every((l) => l.ok)
      && refs(pl) && /url=https%3A%2F%2Ftakemebacktojapan\.com&/.test(pl.find((l) => /intent/.test(l.href))?.href ?? '')
      && await page.evaluate(() => [...document.querySelectorAll('.mk-post [data-pc=share], .mk-post [data-pc=copy]')].every((b) => !!b.dataset.fastGoal)
        && !!document.querySelector('.mk-post .pc-back')), pl.map((l) => l.href));
    check('postcard: "Add your selfie with Hachi" is its first button, with a goal (scripts/_selfie.mjs has the rest); the little postcard has a camera badge', await page.evaluate(() => {
      const b = document.querySelector('.mk-post .pc-add');
      return !!b && !!(b.compareDocumentPosition(document.querySelector('.mk-post .share')) & Node.DOCUMENT_POSITION_FOLLOWING)
        && !!document.querySelector('.menu-postcard .cam svg'); }));
    // its links, buttons and the card itself keep it up
    const pop = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
    await page.click('.mk-post .mk-coffee');
    const p = await pop; if (p) await p.close();
    await page.click('.mk-post [data-pc=copy]');
    await page.click('.mk-post .msg');
    s = await pc();
    const t2 = await tries();
    check('postcard: its links, Copy link and the card itself keep it up', s.open && t2 === t0, s);
    // a click outside: back to the pause card (never the walk), with the little postcard, glowing
    await page.mouse.click(30, 30);
    await page.waitForTimeout(300);
    s = await pc();
    check('postcard: a click outside goes back to the pause card, not the walk', !s.open && s.card && !s.hold && await tries() === t2, s);
    check('pause card: the little postcard is there, glowing', s.mini && s.glow, s);
    check('tour again: on offer once the postcard has been up and put away', await page.evaluate(() => window.__postcard.gate()));
    // the little postcard opens it again; Back returns to the pause card
    await openMini();
    s = await pc();
    check('pause card: the little postcard opens the postcard again, the after-tour words', /seen the whole town/.test(await words()) && s.open && !s.card && s.hold, s);
    await page.click('.mk-post .pc-back');
    s = await pc();
    check('postcard: Back returns to the pause card; the little postcard glowing', !s.open && s.card && s.mini && s.glow, s);
    for (const [w, h] of [[1280, 720], [1600, 900]]) { await page.setViewportSize({ width: w, height: h }); await shot(page, `A-paused-postcard-${w}x${h}`); }
    await page.setViewportSize({ width: 1280, height: 720 });
    check('the little postcard: its goal', await page.evaluate(() => document.querySelector('.menu-postcard').dataset.fastGoal) === 'postcard_reopen');
    // once a page load: Hachi's nap again (a reset tour) brings nothing
    await lockAs(true);
    check('postcard: once a page load', await page.evaluate(async () => { window.__postcard.nap(); await new Promise((r) => setTimeout(r, 300)); return window.__postcard.pending(); }) === -1);
    await lockAs(false);
    // Esc: the pause card
    await openMini();
    await page.keyboard.press('Escape');
    s = await pc();
    check('postcard: Esc puts it away for the pause card', !s.open && s.card && !s.hold, s);
    // Space, granted: the walk goes on, the card stays down
    await page.evaluate(() => { window.__lockMode = 'pending'; });
    await openMini();
    const t3 = await tries();
    await page.keyboard.press('Space');
    await lockAs(true);                                  // granted
    s = await pc();
    check('postcard: Space takes the pointer back and puts it away, the card stays down', !s.open && !s.card && !s.hold && await tries() === t3 + 1, s);
    // Space, refused: back to the pause card, which says press Resume
    await lockAs(false);
    await page.evaluate(() => { window.__lockMode = 'refuse'; });
    await openMini();
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    s = await pc();
    const t4 = await toast();
    check('postcard: Space refused, the pause card, saying press Resume', !s.open && s.card && /press Resume/.test(t4), { ...s, t4 });
    // Resume, the button: asks for the pointer
    const t5 = await tries();
    await page.click('.overlay:not(.boot) .menu-action');
    check('pause card: Resume asks for the pointer', await tries() === t5 + 1);
    check('desktop: no page errors', errs.length === 0, errs.slice(0, 5));
    await ctx.close();
  }

  /* ---- a phone on the desktop site: the gate card ---- */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await local(ctx);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(base);
    // (Tan, 2026-10-02: the phone build is live, config.js MOBILE.route) a phone is sent on to m.html; the desktop game never loads
    await page.waitForURL(/\/m\.html/, { timeout: 30000 });
    await page.waitForSelector('#boot .sheet', { timeout: 30000 });
    check('a phone on the desktop site: sent to the phone page, no desktop game code', /\/m\.html/.test(page.url()) && !(await page.evaluate(() => !!window.__scene)), page.url());
    await shot(page, 'A-phone-card-390x844');
    await ctx.close();
  }
} finally {
  await done();
}
console.log(bad ? `${bad} FAILED` : 'all pass');
if (bad) process.exitCode = 1;
