/* Made by Tan (ui/maker.js): the chip on the cards, the row on the phone card,
 * the postcard at the end of Hachi's tour.  Screenshots and checks:
 *   - the chip on the start and pause cards (1280x720, 1600x900), the row on the phone card (390x844)
 *   - every link: a new tab, rel=noopener, a DataFast goal; a click on the chip never starts the game
 *   - the postcard: shows once, holds the pause card back while up; a click takes the pointer back (or,
 *     refused, the pause card comes); Esc shows the pause card; Space (the pointer back) closes it
 *   - no page errors
 *   node scripts/_maker.mjs [out-dir]     PORT (default 5187)
 * Its own dev server and one headless Chrome (on /tmp/lawson-browser.lock); both closed however it ends.
 * Other sites are never contacted: their requests are aborted, the new tab's address is what is checked. */
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
const local = (ctx) => ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
/** every link out on the page: target, rel, goal */
const linksOk = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((a) => ({
  href: a.href, ok: a.target === '_blank' && /noopener/.test(a.rel) && !!a.dataset.fastGoal,
})), sel);

try {
  server = await createServer({ root: ROOT, logLevel: 'error', server: { port: PORT, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  const base = `http://127.0.0.1:${PORT}/`;
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });

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
    await page.evaluate(() => { const o = document.querySelector('.overlay:not(.boot)'); o.dataset.mode = 'start'; o.classList.remove('hidden'); });

    // links: new tab, noopener, a goal; clicking them never starts the game
    const ls = await linksOk(page, '.overlay:not(.boot) .mk-chip a');
    check('chip links: 4, new tab, noopener, goals', ls.length === 4 && ls.every((l) => l.ok)
      && ls[0].href === 'https://buymeacoffee.com/tanuj10r0', ls.map((l) => l.href));
    await page.evaluate(() => { window.__starts = 0; window.__scene.hud.onStart = () => { window.__starts++; }; });
    const opened = [];
    for (const sel of ['.mk-coffee', '.mk-i:nth-of-type(2)', '.mk-chip .mk-who', '.mk-chip .mk-face']) {
      const pop = sel.startsWith('.mk-chip .mk-') ? null : ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
      await page.click(`.overlay:not(.boot) ${sel.startsWith('.mk-chip') ? sel : '.mk-chip ' + sel}`);
      const p = pop && await pop;
      if (p) { opened.push(p.url() === 'about:blank' ? (await p.waitForEvent('framenavigated').catch(() => null), p.url()) : p.url()); await p.close(); }
    }
    const starts = await page.evaluate(() => window.__starts);
    check('chip clicks open tabs, never start the game', starts === 0 && opened.length === 2, { starts, opened });
    await page.click('.overlay:not(.boot) .menu-tagline');
    check('a click elsewhere on the card still starts', await page.evaluate(() => window.__starts) === 1);

    /* the postcard: as play would bring it.  No pointer lock headless: the lock is played by hand
     * (player.locked and onLockChange, what pointerlockchange does). */
    const lockAs = (on) => page.evaluate((on) => { const { player } = window.__scene; player.locked = on; player.onLockChange(on); }, on);
    await lockAs(true);
    await page.evaluate(() => { window.__lockTries = 0; const { player } = window.__scene; player.lock = () => { window.__lockTries++; }; });
    const pc = () => page.evaluate(() => {
      const el = document.querySelector('.mk-post-scrim');
      const card = document.querySelector('.overlay:not(.boot)');
      return { open: window.__postcard.card?.open, shown: window.__postcard.card.shown, visible: !!el && getComputedStyle(el).display !== 'none',
        card: !card.classList.contains('hidden'), hold: window.__scene.hud.holdCard };
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
    check('postcard links: new tab, noopener, goals; buttons have goals', pl.length === 5 && pl.every((l) => l.ok)
      && await page.evaluate(() => [...document.querySelectorAll('.mk-post button')].every((b) => !!b.dataset.fastGoal)), pl.map((l) => l.href));
    // its links and buttons keep it up
    const pop = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
    await page.click('.mk-post .mk-coffee');
    const p = await pop; if (p) await p.close();
    await page.click('.mk-post [data-pc=copy]');
    s = await pc();
    check('postcard: its links and Copy link keep it up, no pointer asked for', s.open && await page.evaluate(() => window.__lockTries) === 0, s);
    // a click off the buttons: the pointer is asked for; refused (headless), the pause card comes
    await page.mouse.click(30, 30);
    s = await pc();
    const tries = await page.evaluate(() => window.__lockTries);
    check('postcard: a click elsewhere puts it away and asks for the pointer', !s.open && !s.visible && tries === 1 && !s.hold, { ...s, tries });
    await page.waitForTimeout(1100);
    s = await pc();
    check('postcard: the pointer refused, the pause card comes', s.card, s);
    // once a page load: Hachi's nap again (a reset tour) brings nothing
    await lockAs(true);
    check('postcard: once a page load', await page.evaluate(async () => { window.__postcard.nap(); await new Promise((r) => setTimeout(r, 300)); return window.__postcard.pending(); }) === -1);
    // the Esc way and the Space way (forced again, as dev can)
    await page.evaluate(() => window.__postcard.due(0.05).then(() => {}));
    await page.waitForFunction(() => window.__postcard.card?.open, null, { timeout: 5000 }).catch(() => {});
    await lockAs(false);
    await page.keyboard.press('Escape');
    s = await pc();
    check('postcard: Esc puts it away for the pause card', !s.open && s.card && !s.hold, s);
    await lockAs(true);
    await page.evaluate(() => window.__postcard.due(0.05).then(() => {}));
    await page.waitForFunction(() => window.__postcard.card?.open, null, { timeout: 5000 }).catch(() => {});
    await lockAs(false);
    await page.keyboard.press('Space');                 // the game's own Space: asks for the pointer
    await lockAs(true);                                 // granted
    s = await pc();
    check('postcard: Space takes the pointer back and puts it away, the card stays down', !s.open && !s.card && !s.hold && await page.evaluate(() => window.__lockTries) === 2, s);
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
