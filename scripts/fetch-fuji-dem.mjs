#!/usr/bin/env node
/* ------------------------------------------------------------------ *
 * One-time bake: GSI elevation tiles -> src/data/fuji-dem.bin
 *
 *   node scripts/fetch-fuji-dem.mjs
 *
 * Downloads the Geospatial Information Authority of Japan (国土地理院)
 * `dem_png` tiles around the summit of Mt. Fuji, decodes them, resamples a
 * square grid in local metres centred on the summit, and writes it as a
 * small binary the game loads from its own origin.  The game never talks to
 * GSI at runtime (AGENTS.md).  Source: 国土地理院 標高タイル (dem_png),
 * https://maps.gsi.go.jp/development/demtile.html
 *
 * No dependencies: PNG decoding is done here with node:zlib.
 *
 * Output layout (little-endian):
 *   0   char[4]  'FUJI'
 *   4   uint32   version (1)
 *   8   uint32   N (grid is N x N)
 *   12  float32  cell size, metres
 *   16  float32  observer east of the summit, metres
 *   20  float32  observer north of the summit, metres
 *   24  float32  observer ground elevation, metres
 *   28  float32  highest sample, metres
 *   32  uint16[N*N] elevation in decimetres, row 0 = north edge, col 0 = west
 * ------------------------------------------------------------------ */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../src/data/fuji-dem.bin');

/* Kengamine, the summit of Mt. Fuji. */
const SUMMIT = { lat: 35.36063, lon: 138.72740 };
/* The famous Lawson, Fujikawaguchiko: where the real hero photos are taken. */
const OBSERVER = { lat: 35.50180, lon: 138.76830 };

const ZOOM = 12;            // ~31 m per pixel at this latitude
const N = 384;              // output grid
const HALF = 11500;         // half extent of the grid, metres
const TILE_URL = (z, x, y) => `https://cyberjapandata.gsi.go.jp/xyz/dem_png/${z}/${x}/${y}.png`;

/* ------------------------------ PNG decode ------------------------------ */

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8;
  let width = 0, height = 0, depth = 0, type = 0, palette = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const kind = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      type = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNG not supported');
    } else if (kind === 'PLTE') {
      palette = data;
    } else if (kind === 'IDAT') {
      idat.push(data);
    } else if (kind === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  if (depth !== 8) throw new Error(`bit depth ${depth} not supported`);
  const channels = { 2: 3, 6: 4, 3: 1 }[type];
  if (!channels) throw new Error(`colour type ${type} not supported`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? px[dst + i - channels] : 0;
      const b = y > 0 ? px[dst - stride + i] : 0;
      const c = i >= channels && y > 0 ? px[dst - stride + i - channels] : 0;
      let v = raw[src + i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[dst + i] = v & 255;
    }
  }

  // to RGB
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    if (type === 3) {
      const p = px[i] * 3;
      rgb[i * 3] = palette[p]; rgb[i * 3 + 1] = palette[p + 1]; rgb[i * 3 + 2] = palette[p + 2];
    } else {
      rgb[i * 3] = px[i * channels];
      rgb[i * 3 + 1] = px[i * channels + 1];
      rgb[i * 3 + 2] = px[i * channels + 2];
    }
  }
  return { width, height, rgb };
}

/* GSI dem_png: x = R*2^16 + G*2^8 + B; x < 2^23 -> 0.01x m; x = 2^23 -> no data;
 * otherwise (x - 2^24) * 0.01 m. */
function elevation(r, g, b) {
  const x = r * 65536 + g * 256 + b;
  if (x === 8388608) return NaN;
  return (x < 8388608 ? x : x - 16777216) * 0.01;
}

/* ------------------------------ tile maths ------------------------------ */

const worldPx = (lat, lon, z) => {
  const s = 256 * 2 ** z;
  const x = ((lon + 180) / 360) * s;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * s;
  return { x, y };
};

const tiles = new Map();

async function fetchTile(tx, ty) {
  const key = `${tx}/${ty}`;
  if (tiles.has(key)) return tiles.get(key);
  const url = TILE_URL(ZOOM, tx, ty);
  const res = await fetch(url);
  let tile = null;
  if (res.ok) {
    const png = decodePng(Buffer.from(await res.arrayBuffer()));
    const h = new Float32Array(256 * 256);
    for (let i = 0; i < h.length; i++) h[i] = elevation(png.rgb[i * 3], png.rgb[i * 3 + 1], png.rgb[i * 3 + 2]);
    tile = h;
  } else if (res.status !== 404) {
    throw new Error(`${url}: HTTP ${res.status}`);
  }
  tiles.set(key, tile);
  console.log(`  tile ${key} ${tile ? 'ok' : 'missing (sea / no data)'}`);
  return tile;
}

function samplePx(px, py) {
  const tx = Math.floor(px / 256), ty = Math.floor(py / 256);
  const t = tiles.get(`${tx}/${ty}`);
  if (!t) return NaN;
  const ix = Math.min(255, Math.max(0, Math.floor(px - tx * 256)));
  const iy = Math.min(255, Math.max(0, Math.floor(py - ty * 256)));
  return t[iy * 256 + ix];
}

/** Bilinear sample in global pixel space (pixel centres at +0.5). */
function sample(px, py) {
  const x = px - 0.5, y = py - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const a = samplePx(x0 + 0.5, y0 + 0.5), b = samplePx(x0 + 1.5, y0 + 0.5);
  const c = samplePx(x0 + 0.5, y0 + 1.5), d = samplePx(x0 + 1.5, y0 + 1.5);
  const vals = [[a, (1 - fx) * (1 - fy)], [b, fx * (1 - fy)], [c, (1 - fx) * fy], [d, fx * fy]];
  let s = 0, w = 0;
  for (const [v, k] of vals) if (Number.isFinite(v)) { s += v * k; w += k; }
  return w > 0 ? s / w : NaN;
}

/* Local metres <-> lat/lon around the summit (equirectangular; fine at 12 km). */
const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LON = 111320 * Math.cos((SUMMIT.lat * Math.PI) / 180);
const toLatLon = (east, north) => ({
  lat: SUMMIT.lat + north / M_PER_DEG_LAT,
  lon: SUMMIT.lon + east / M_PER_DEG_LON,
});

/* --------------------------------- main --------------------------------- */

async function main() {
  console.log(`GSI dem_png z${ZOOM}: ${N}x${N} grid, ±${HALF} m around the summit`);

  // every tile the grid touches, plus the observer's
  const corners = [toLatLon(-HALF, HALF), toLatLon(HALF, -HALF)];
  const a = worldPx(corners[0].lat, corners[0].lon, ZOOM);
  const b = worldPx(corners[1].lat, corners[1].lon, ZOOM);
  for (let ty = Math.floor(a.y / 256); ty <= Math.floor(b.y / 256); ty++) {
    for (let tx = Math.floor(a.x / 256); tx <= Math.floor(b.x / 256); tx++) {
      await fetchTile(tx, ty);
    }
  }
  const op = worldPx(OBSERVER.lat, OBSERVER.lon, ZOOM);
  await fetchTile(Math.floor(op.x / 256), Math.floor(op.y / 256));

  const cell = (HALF * 2) / (N - 1);
  const heights = new Float32Array(N * N);
  let max = -Infinity, missing = 0;
  for (let r = 0; r < N; r++) {
    const north = HALF - r * cell;
    for (let c = 0; c < N; c++) {
      const east = -HALF + c * cell;
      const { lat, lon } = toLatLon(east, north);
      const p = worldPx(lat, lon, ZOOM);
      let h = sample(p.x, p.y);
      if (!Number.isFinite(h)) { h = 0; missing++; }
      heights[r * N + c] = h;
      if (h > max) max = h;
    }
  }

  const obsElev = sample(op.x, op.y);
  const obsEast = (OBSERVER.lon - SUMMIT.lon) * M_PER_DEG_LON;
  const obsNorth = (OBSERVER.lat - SUMMIT.lat) * M_PER_DEG_LAT;

  const buf = Buffer.alloc(32 + N * N * 2);
  buf.write('FUJI', 0, 'ascii');
  buf.writeUInt32LE(1, 4);
  buf.writeUInt32LE(N, 8);
  buf.writeFloatLE(cell, 12);
  buf.writeFloatLE(obsEast, 16);
  buf.writeFloatLE(obsNorth, 20);
  buf.writeFloatLE(obsElev, 24);
  buf.writeFloatLE(max, 28);
  for (let i = 0; i < N * N; i++) {
    buf.writeUInt16LE(Math.max(0, Math.min(65535, Math.round(heights[i] * 10))), 32 + i * 2);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buf);

  const dist = Math.hypot(obsEast, obsNorth);
  console.log(`summit ${max.toFixed(1)} m, observer ${obsElev.toFixed(1)} m at ${(dist / 1000).toFixed(2)} km,`
    + ` ${missing} missing samples`);
  console.log(`wrote ${path.relative(process.cwd(), OUT)} (${buf.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
