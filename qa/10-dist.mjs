// Static checks on the production build (run `npx vite build` first): what ships, how big, and what should not be there.
//   node qa/10-dist.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ROOT, ART, writeJSON } from './lib.mjs';

const DIST = path.join(ROOT, 'dist');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() || (e.isSymbolicLink() && fs.statSync(path.join(d, e.name)).isDirectory())) ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(DIST).map((f) => {
  const raw = fs.statSync(f).size, ext = path.extname(f);
  const text = ['.js', '.css', '.html', '.json', '.svg', '.txt'].includes(ext);
  const buf = text ? fs.readFileSync(f) : null;
  return { file: path.relative(DIST, f), raw, gzip: text ? zlib.gzipSync(buf).length : raw, brotli: text ? zlib.brotliCompressSync(buf).length : raw };
}).sort((a, b) => b.raw - a.raw);
const js = files.filter((f) => f.file.endsWith('.js'));
const src = js.map((f) => fs.readFileSync(path.join(DIST, f.file), 'utf8')).join('\n');
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const count = (s, re) => (s.match(re) ?? []).length;
const r = {
  files: files.map((f) => ({ ...f, kB: Math.round(f.raw / 1024), gzipKB: Math.round(f.gzip / 1024), brotliKB: Math.round(f.brotli / 1024) })),
  totals: {
    rawMB: +(files.reduce((n, f) => n + f.raw, 0) / 1048576).toFixed(2),
    wireMB: +(files.reduce((n, f) => n + f.gzip, 0) / 1048576).toFixed(2),
    wireBrotliMB: +(files.reduce((n, f) => n + f.brotli, 0) / 1048576).toFixed(2),
    audioMB: +(files.filter((f) => f.file.startsWith('audio/')).reduce((n, f) => n + f.raw, 0) / 1048576).toFixed(2),
  },
  bundle: {
    jsFiles: js.length,
    localhost: count(src, /localhost|127\.0\.0\.1|:5178|:5180/g),
    shotEndpoint: count(src, /__shot/g),
    referenceDir: count(src, /reference\//g),
    consoleLog: count(src, /console\.(log|info|debug)\(/g),
    consoleWarn: count(src, /console\.warn\(/g),
    windowScene: count(src, /__scene/g),
    devHooks: ['__store', '__guide', '__han', '__train', '__soundZones', '__walkList', '__animals', '__density'].filter((k) => src.includes(k)),
    sourceMaps: files.filter((f) => f.file.endsWith('.map')).length,
    licenseComments: count(src, /@license|Copyright/g),
    threeLicense: /Three\.js Authors/.test(src),
    otherDomains: [...new Set((src.match(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []))].slice(0, 30),
  },
  html: {
    title: html.match(/<title>(.*?)<\/title>/)?.[1],
    favicon: /rel="(shortcut )?icon"/.test(html),
    appleTouch: /apple-touch-icon/.test(html),
    ogImage: html.match(/og:image" content="([^"]+)"/)?.[1],
    twitterDescription: /twitter:description/.test(html),
    themeColor: /theme-color/.test(html),
    noscript: /<noscript/.test(html),
    manifest: /rel="manifest"/.test(html),
  },
  hosting: {
    headersFile: fs.existsSync(path.join(DIST, '_headers')),
    redirectsFile: fs.existsSync(path.join(DIST, '_redirects')),
    notFoundPage: fs.existsSync(path.join(DIST, '404.html')),
    robots: fs.existsSync(path.join(DIST, 'robots.txt')),
    licenseInDist: files.some((f) => /licen[cs]e|credits|ofl/i.test(f.file)),
    faviconIco: fs.existsSync(path.join(DIST, 'favicon.ico')),
  },
};
writeJSON(path.join(ART, '10-dist', 'result.json'), r);
console.log(JSON.stringify({ totals: r.totals, bundle: r.bundle, html: r.html, hosting: r.hosting, top: r.files.slice(0, 15).map((f) => `${f.file} ${f.kB} KB (gzip ${f.gzipKB})`) }, null, 1));
