import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { STRINGS } from './src/data/strings.js';
import { TOWN_NAME } from './src/data/town.js';
import { makerChip, makerRow, MAKER_CSS } from './src/ui/maker.js';

/**
 * The cards index.html paints before any game code runs (loading, phone,
 * no WebGL, GPU reset) take their words from src/data/strings.js
 * (AGENTS.md): `%S:gate.copy%` in index.html becomes STRINGS.gate.copy.
 * An unknown key fails the build rather than ship a placeholder.
 */
function htmlStrings() {
  const table = { ...STRINGS, town: TOWN_NAME };
  const esc = (v) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return {
    name: 'html-strings',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replace(/%S:([\w.]+)%/g, (_, key) => {
        const v = key.split('.').reduce((o, k) => o?.[k], table);
        if (typeof v !== 'string') throw new Error(`index.html: no string ${key} in src/data/strings.js`);
        return esc(v);
      // Made by Tan (ui/maker.js): the chip on the loading card, the row on the gate's card, their look
      }).replace(/%MAKER:(\w+)(?::(\w+))?%/g, (_, part, where) => {
        if (part === 'css') return MAKER_CSS;
        if (part === 'chip') return makerChip(where);
        if (part === 'row') return makerRow(where);
        throw new Error(`index.html: no maker part ${part}`);
      }),
    },
  };
}

/**
 * Dev-only helper: lets the page POST a rendered frame to disk so the scene
 * can be reviewed while iterating.  Not part of the build.
 */
function frameGrabber(outDir, lookdevDir, screenshotDir) {
  return {
    name: 'frame-grabber',
    apply: 'serve',
    configureServer(server) {
      fs.mkdirSync(outDir, { recursive: true });
      fs.mkdirSync(lookdevDir, { recursive: true });
      server.middlewares.use('/__shot', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('POST only');
        }
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const name = (body.name || 'shot').replace(/[^\w.-]/g, '_');
            const data = String(body.data || '').replace(/^data:image\/\w+;base64,/, '');
            // `dir: 'lookdev'` files the look-dev screenshots (SPEC M1) in reference/lookdev
            // `dir: 'screenshots'` files the town screenshots in screenshots/
            const dir = body.dir === 'lookdev' ? lookdevDir
              : body.dir === 'screenshots' ? screenshotDir : outDir;
            fs.mkdirSync(dir, { recursive: true });
            const ext = String(body.data || '').startsWith('data:image/png') ? '.png' : '.jpg';
            const file = path.join(dir, name.endsWith(ext) ? name : name + ext);
            fs.writeFileSync(file, Buffer.from(data, 'base64'));
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: true, file, bytes: data.length }));
          } catch (e) {
            res.statusCode = 500;
            res.end(String(e));
          }
        });
      });
    },
  };
}

const SHOT_DIR = path.resolve(process.cwd(), '.shots');
const LOOKDEV_DIR = path.resolve(process.cwd(), 'reference/lookdev');
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots');

export default defineConfig({
  /* Relative asset URLs, so a build runs from any subdirectory -- opened off
   * the filesystem, served from a GitHub Pages project path, anywhere. */
  base: './',
  plugins: [htmlStrings(), frameGrabber(SHOT_DIR, LOOKDEV_DIR, SCREENSHOT_DIR)],
  server: {
    port: 5178,
    host: '127.0.0.1',
    open: false,
  },
  preview: {
    port: 5179,
    host: '127.0.0.1',
  },
  build: {
    outDir: 'dist',
    target: 'es2022',       // top-level await: the sign fonts load before the town draws (desktop browsers only)
    assetsInlineLimit: 0,
    // three.js is one big chunk on purpose, so the size warning is just noise
    chunkSizeWarningLimit: 1200,
  },
});
