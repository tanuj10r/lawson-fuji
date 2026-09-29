/* Desktop baseline for the mobile runs, measured the same way and back to
 * back with them (this Mac is shared; absolute times drift with its load).
 *   node qa/mobile/baseline.mjs [runs=1]
 * Chrome (Metal), 1280x720, DPR 1, no throttling, production build. */
import { chromium } from 'playwright';
import { serve } from './throttle-server.mjs';

const N = +(process.argv[2] ?? 1);
const server = await serve({ port: 5181, profile: 'none' });
let browser = null;
const cleanup = async () => { await browser?.close().catch(() => {}); await server.close(); };
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, async () => { await cleanup(); process.exit(130); });
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
  for (let i = 0; i < N; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript({ path: new URL('./instrument.js', import.meta.url).pathname });
    const page = await ctx.newPage();
    await page.goto(server.url, { waitUntil: 'domcontentloaded', timeout: 300000 });
    await page.waitForFunction(() => window.__qa.marks.fujiFrame, null, { timeout: 600000, polling: 250 });
    const r = await page.evaluate(() => ({ marks: window.__qa.marks, heap: Math.round(performance.memory.usedJSHeapSize / 1048576), longest: Math.max(0, ...window.__qa.longTasks.map((l) => l[1])) }));
    console.log('desktop 1280x720', JSON.stringify(r));
    await ctx.close();
  }
} finally {
  await cleanup();
}
