/* A throttled static server for dist/ (the production build), so load times
 * can be measured the same way in Chromium and WebKit (Playwright can only
 * throttle Chromium's network, through CDP).
 *
 *   import { serve } from './throttle-server.mjs';
 *   const s = await serve({ port: 5181, profile: 'fast3g' });  ...  await s.close();
 *   s.setProfile('4g')                     // change the link between runs
 *   node qa/mobile/throttle-server.mjs 5181 fast3g   (standalone)
 *
 * The link model (Chrome DevTools' own presets, the same numbers):
 *   fast3g  1.44 Mbit/s down (1.6 x 0.9), 562.5 ms round trip
 *   4g      8.1 Mbit/s down (9 x 0.9),    165 ms round trip
 *   none    unthrottled
 * Bandwidth is ONE token bucket shared by every connection (a phone has one
 * radio link, however many sockets the browser opens).  Each response waits
 * one round trip before its first byte; the first request on a new socket
 * waits two more (TCP and TLS handshakes: the live site is HTTPS).
 * Text (html, js, json, css) is sent gzip-compressed, as a CDN would
 * (Cloudflare sends brotli, about 20% smaller for the JS).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const PROFILES = {
  fast3g: { name: 'Fast 3G', bps: (1.6e6 * 0.9) / 8, rtt: 562.5 },
  '4g': { name: '4G', bps: (9e6 * 0.9) / 8, rtt: 165 },
  none: { name: 'unthrottled', bps: Infinity, rtt: 0 },
};
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.bin': 'application/octet-stream', '.m4a': 'audio/mp4',
  '.png': 'image/png', '.jpg': 'image/jpeg',
};
const TEXT = new Set(['.html', '.js', '.json', '.css']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function serve({ port = 5181, profile = 'none', root = new URL('../../dist/', import.meta.url).pathname } = {}) {
  let P = PROFILES[profile];
  let tokens = 0, last = Date.now();
  const bytesLog = [];
  const cache = new Map();
  const load = (file) => {
    if (cache.has(file)) return cache.get(file);
    const ext = path.extname(file);
    const raw = fs.readFileSync(file);
    const body = TEXT.has(ext) ? zlib.gzipSync(raw, { level: 9 }) : raw;
    const v = { body, gz: TEXT.has(ext), type: TYPES[ext] ?? 'application/octet-stream' };
    cache.set(file, v);
    return v;
  };
  /** wait until `n` bytes may go out on the shared link */
  const take = async (n) => {
    if (P.bps === Infinity) return;
    for (;;) {
      const now = Date.now();
      // at most 50 ms of burst, but never less than the chunk asked for (else a slow link could never send one)
      tokens = Math.min(Math.max(n, P.bps * 0.05), tokens + ((now - last) / 1000) * P.bps);
      last = now;
      if (tokens >= n) { tokens -= n; return; }
      await sleep(Math.max(2, ((n - tokens) / P.bps) * 1000));
    }
  };
  const server = http.createServer(async (req, res) => {
    const fresh = !req.socket._seen;
    req.socket._seen = true;
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(root, url);
    if (url.endsWith('/')) file = path.join(file, 'index.html');
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      await sleep(P.rtt);
      res.writeHead(404); res.end(); return;
    }
    const f = load(file);
    // a round trip before the first byte; a new socket pays for its handshakes too
    await sleep(P.rtt * (fresh ? 3 : 1));
    const range = req.headers.range && /bytes=(\d+)-(\d*)/.exec(req.headers.range);
    let body = f.body, status = 200;
    const headers = { 'content-type': f.type, 'cache-control': 'no-store', 'accept-ranges': 'bytes' };
    if (f.gz) headers['content-encoding'] = 'gzip';
    if (range && !f.gz) {
      const a = +range[1], b = range[2] ? +range[2] : body.length - 1;
      headers['content-range'] = `bytes ${a}-${b}/${body.length}`;
      body = body.subarray(a, b + 1);
      status = 206;
    }
    headers['content-length'] = body.length;
    res.writeHead(status, headers);
    bytesLog.push({ t: Date.now(), url, bytes: body.length });
    const CH = 16 * 1024;
    for (let i = 0; i < body.length; i += CH) {
      if (res.destroyed) return;
      const chunk = body.subarray(i, i + CH);
      await take(chunk.length);
      if (!res.write(chunk)) await new Promise((r) => res.once('drain', r));
    }
    res.end();
  });
  server.keepAliveTimeout = 30000;
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  const sockets = new Set();
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  return {
    url: `http://127.0.0.1:${port}/`,
    setProfile(p) { P = PROFILES[p]; tokens = 0; last = Date.now(); for (const s of sockets) s.destroy(); },
    get profile() { return P; },
    bytesLog,
    close: () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(() => r()); }),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await serve({ port: +(process.argv[2] ?? 5181), profile: process.argv[3] ?? 'none' });
  console.log(`serving dist/ at ${s.url} (${s.profile.name}); Ctrl+C to stop`);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await s.close(); process.exit(0); });
}
