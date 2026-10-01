/* Made by Tan (ui/maker.js): the chip on the cards, the row on the phone card,
 * the postcard at the end of Hachi's tour.  Screenshots and checks:
 *   - the chip on the start and pause cards (1280x720, 1600x900), the row on the phone card (390x844)
 *   - every link: a new tab, rel=noopener, a DataFast goal; a click on the chip never starts the game
 *   - the postcard: shows once, holds the pause card back while up; a click takes the pointer back (or,
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
        check(`${w}x${h} ${m}: the chip on the art, the card fits, coffee first, goal label`, r.inArt && r.fits && r.first === 'maker_coffee'
          && r.where.length === 1 && r.where[0] === (m === 'paused' ? 'pause_card' : 'start_card'), r);
        await shot(page, `A-${m}-${w}x${h}`);
      }
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    await mode('paused');

    // links: new tab, noopener, a goal; clicking them (or anything on the card but Resume) never resumes
    const ls = await linksOk(page, '.overlay:not(.boot) .mk-chip a');
    check('chip links: 4, new tab, noopener, goals', ls.length === 4 && ls.every((l) => l.ok)
      && ls[0].href === 'https://buymeacoffee.com/tanuj10r0', ls.map((l) => l.href));
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
    check('pause card: no little postcard before the tour is over', await page.evaluate(() => document.querySelector('.menu-postcard').hidden));

    /* the postcard: as play would bring it (player.locked and onLockChange played by hand, what pointerlockchange does) */
    const lockAs = (on) => page.evaluate((on) => { const { player } = window.__scene; player.locked = on; player.onLockChange(on); }, on);
    await lockAs(true);
    const pc = () => page.evaluate(() => {
      const el = document.querySelector('.mk-post-scrim');
      const card = document.querySelector('.overlay:not(.boot)');
      const mini = document.querySelector('.menu-postcard');
      return { open: !!window.__postcard.card?.open, visible: !!el && getComputedStyle(el).display !== 'none',
        card: !card.classList.contains('hidden'), hold: window.__scene.hud.holdCard, mini: !mini.hidden, glow: mini.classList.contains('glow') };
    });
    await page.evaluate(() => window.__postcard.nap());
    await page.waitForFunction(() => window.__postcard.pending() > 0 || window.__postcard.card?.open, null, { timeout: 10000 }).catch(() => {});
    check("postcard: Hachi's nap loads it and sets it due", await page.evaluate(() => !!window.__postcard.card));
    await page.waitForFunction(() => window.__postcard.card?.open, null, { timeout: 15000 }).catch(() => {});
    await lockAs(false);                 // what document.exitPointerLock brings
    await page.waitForTimeout(700);
    let s = await pc();
    check('postcard: shows, the pause card waits behind it', s.open && s.visible && !s.card && s.hold, s);
    await shot(page, 'B-postcard-1280x720');
    await page.setViewportSize({ width: 1600, height: 900 });
    await shot(page, 'B-postcard-1600x900');
    await page.setViewportSize({ width: 1280, height: 720 });
    const pl = await linksOk(page, '.mk-post a');
    check('postcard links: new tab, noopener, goals; Share, Copy have goals; Back is there', pl.length === 5 && pl.every((l) => l.ok)
      && await page.evaluate(() => [...document.querySelectorAll('.mk-post [data-pc=share], .mk-post [data-pc=copy]')].every((b) => !!b.dataset.fastGoal)
        && !!document.querySelector('.mk-post .pc-back')), pl.map((l) => l.href));
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
    check('pause card: the little postcard is there and glows the first time', s.mini && s.glow, s);
    await shot(page, 'A-paused-postcard-glow-1280x720');
    // the little postcard opens it again; Back returns to the pause card, quiet now
    await page.click('.menu-postcard');
    s = await pc();
    check('pause card: the little postcard opens the postcard again', s.open && !s.card && s.hold, s);
    await page.click('.mk-post .pc-back');
    s = await pc();
    check('postcard: Back returns to the pause card; the little postcard quiet now', !s.open && s.card && s.mini && !s.glow, s);
    for (const [w, h] of [[1280, 720], [1600, 900]]) { await page.setViewportSize({ width: w, height: h }); await shot(page, `A-paused-postcard-${w}x${h}`); }
    await page.setViewportSize({ width: 1280, height: 720 });
    check('the little postcard: its goal', await page.evaluate(() => document.querySelector('.menu-postcard').dataset.fastGoal) === 'postcard_reopen');
    // once a page load: Hachi's nap again (a reset tour) brings nothing
    await lockAs(true);
    check('postcard: once a page load', await page.evaluate(async () => { window.__postcard.nap(); await new Promise((r) => setTimeout(r, 300)); return window.__postcard.pending(); }) === -1);
    await lockAs(false);
    // Esc: the pause card
    await page.click('.menu-postcard');
    await page.keyboard.press('Escape');
    s = await pc();
    check('postcard: Esc puts it away for the pause card', !s.open && s.card && !s.hold, s);
    // Space, granted: the walk goes on, the card stays down
    await page.evaluate(() => { window.__lockMode = 'pending'; });
    await page.click('.menu-postcard');
    const t3 = await tries();
    await page.keyboard.press('Space');
    await lockAs(true);                                  // granted
    s = await pc();
    check('postcard: Space takes the pointer back and puts it away, the card stays down', !s.open && !s.card && !s.hold && await tries() === t3 + 1, s);
    // Space, refused: back to the pause card, which says press Resume
    await lockAs(false);
    await page.evaluate(() => { window.__lockMode = 'refuse'; });
    await page.click('.menu-postcard');
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
    await page.waitForFunction(() => document.documentElement.classList.contains('gate-phone'));
    const ls = await linksOk(page, '.gate .mk-row a');
    const fits = await page.evaluate(() => { const r = document.querySelector('.gate-card').getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.right <= innerWidth
      && [...document.querySelectorAll('.gate .mk-row a')].every((a) => a.getBoundingClientRect().right <= r.right - 12); });
    check('phone card: the row, 4 links, coffee button, new tab, goals; no scroll', ls.length === 4 && ls.every((l) => l.ok) && fits, ls.map((l) => l.href));
    check('phone card: no page errors, no game code', errs.length === 0 && !(await page.evaluate(() => !!window.__scene)), errs);
    await shot(page, 'A-phone-card-390x844');
    await ctx.close();
  }
} finally {
  await done();
}
console.log(bad ? `${bad} FAILED` : 'all pass');
if (bad) process.exitCode = 1;
