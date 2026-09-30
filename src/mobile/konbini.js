import * as THREE from 'three';
import { labelAtlas, tagAtlas, cellRect, WHITE } from '../world/store/labels.js';
import { productGeometry } from '../world/store/products.js';
import { CATALOG, FEATURED } from '../data/catalog.js';
import { MOBILE } from '../config.js';
import { LABEL_PX, TAG_PX, LABEL_LV, TAG_LV } from './konbini-seen.js';

/* ------------------------------------------------------------------ *
 * The konbini's painted pages at the size they are seen (the pocket
 * edition, docs/decisions/mobile-lite.md).
 *
 * The desktop paints every product's label into a 192 px cell on two 3072
 * pages (96 MB on the GPU with mipmaps) and every price tag into a 256 x 96
 * cell on one 2048 x 5472 page (57 MB).  The store is a scene now, not a
 * place to roam (Tan): you choose at the door and the visit walks you
 * through, so what is ever seen, and how big, is known.
 * scripts/_mobile-seen.mjs plays the five visits, the famous views and the
 * forecourt and its approach, and writes the most each label, tag and
 * painted quad is ever drawn at on a phone, per kind of pose
 * (konbini-seen.js): in each visit, outside near the store, outside far
 * from it.  A texture's mipmaps never sample finer than the screen asks, so
 * a cell no bigger than its largest sighting (plus a margin) looks the same
 * as the desktop's.
 *
 * Levels.  One master page each (labels, tags; the quads in lite.js), at
 * the most any pose needs, is painted once from the desktop's own painting
 * and kept on the CPU only.  What the GPU holds is one level at a time,
 * packed from the master at that level's sizes: `visit:<id>` while that
 * visit plays (what it hands you at the whole cell), `near` outside within
 * MOBILE.store.near of the store's middle, `far` beyond (the famous views).
 * A level has its own layout, so every surface that shows the page has its
 * uvs rewritten from the master's on a change (a few milliseconds; it
 * happens at the door and on the way out).
 * ------------------------------------------------------------------ */

const PAD = 2;

/**
 * POCKET: a mesh's positions as 16-bit integers over its own box
 * (normalised: -1..1 across it), the box's middle and half size moved into
 * the mesh's position and scale: 12 -> 6 bytes a vertex.  A 64 m cell is
 * then drawn to 1 mm, its height to a fraction of that; the shaders never
 * read the raw attribute (the toon, wear and tint patches read their own).
 * Only for a mesh at the identity whose attributes are the plain ones (the
 * swaying batches offset their positions in the shader, in metres).
 * Returns the new byte size, or 0 when left alone.
 */
const PLAIN = new Set(['position', 'normal', 'color', 'aTint', 'uv', 'aWear']);
export function quantizePositions(o, pad = 0) {
  const g = o.geometry, a = g.attributes.position;
  if (!a || !(a.array instanceof Float32Array) || a.isInterleavedBufferAttribute || g.morphAttributes.position) return 0;
  if (Object.keys(g.attributes).some((k) => !PLAIN.has(k))) return 0;
  if (o.position.lengthSq() || o.rotation.x || o.rotation.y || o.rotation.z || o.scale.x !== 1 || o.scale.y !== 1 || o.scale.z !== 1) return 0;
  const src = a.array, n = src.length;
  if (!n) return 0;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i += 3) for (let k = 0; k < 3; k++) { const v = src[i + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
  const c = [0, 0, 0], h = [1, 1, 1];
  for (let k = 0; k < 3; k++) { c[k] = (lo[k] + hi[k]) / 2; h[k] = Math.max(1e-3, (hi[k] - lo[k]) / 2 + pad); }
  const q = new Int16Array(n);
  for (let i = 0; i < n; i += 3) for (let k = 0; k < 3; k++) q[i + k] = Math.round(Math.max(-1, Math.min(1, (src[i + k] - c[k]) / h[k])) * 32767);
  const attr = new THREE.BufferAttribute(q, 3, true);
  attr.usage = a.usage;
  g.setAttribute('position', attr);
  g.boundingBox = null; g.boundingSphere = null;
  o.position.set(c[0], c[1], c[2]);
  o.scale.set(h[0], h[1], h[2]);
  o.updateMatrix();
  o.userData.quant = { c, h };
  return q.byteLength;
}

/**
 * The store's painted quad pages (signs, POP, posters; not the price tags),
 * each with a key: its place in the order the store's meshes first use it,
 * and its size.  The store is built by code, the same every time, so the
 * key finds the same page on any browser (scripts/_mobile-seen.mjs writes
 * QUAD_K by it; lite.js mergeStoreQuads reads it).
 */
export function quadPages(inside) {
  const tags = tagAtlas().tex, keys = new Map();
  inside.traverse((o) => {
    const t = o.isMesh && /quads$/.test(o.name) ? o.material?.map : null;
    if (!t || t === tags || keys.has(t) || !t.image) return;
    keys.set(t, `${keys.size}:${t.image.width}x${t.image.height}`);
  });
  return keys;
}

/** Shelf-pack `items` ({ w, h }) into a page `width` wide; sets each item's x, y; returns the height used. */
function pack(items, width) {
  let x = 0, y = 0, shelf = 0;
  for (const it of [...items].sort((a, b) => b.h - a.h || b.w - a.w)) {
    const w = it.w + PAD * 2, h = it.h + PAD * 2;
    if (x + w > width) { x = 0; y += shelf; shelf = 0; }
    it.x = x + PAD; it.y = y + PAD;
    x += w; shelf = Math.max(shelf, h);
  }
  return y + shelf;
}
/** A width for `items` that makes a page about square. */
function widthFor(items) {
  const area = items.reduce((s, it) => s + (it.w + PAD * 2) * (it.h + PAD * 2), 0);
  const widest = Math.max(...items.map((it) => it.w + PAD * 2));
  return Math.max(widest, Math.ceil(Math.sqrt(area * 1.04) / 16) * 16);
}
/** Draw `src`'s rect (sx, sy, sw, sh) into the slot, its edge bled into the padding. */
function blit(c, src, sx, sy, sw, sh, it) {
  c.drawImage(src, sx, sy, sw, sh, it.x - PAD, it.y - PAD, it.w + PAD * 2, it.h + PAD * 2);
  c.clearRect(it.x, it.y, it.w, it.h);
  c.drawImage(src, sx, sy, sw, sh, it.x, it.y, it.w, it.h);
}
function canvasTexture(cv, like) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = like.colorSpace;
  t.anisotropy = like.anisotropy;
  return t;
}
/** Free a painted page once nothing needs it: its canvas shrinks to a pixel. */
function drop(tex) {
  tex.dispose();
  const img = tex.image;
  if (img && 'width' in img) { img.width = 1; img.height = 1; }
}

/**
 * A page at levels (see above).  `master`: the canvas every level is drawn
 * from; `items`: [{ x, y, w, h }] its rects there (px); `size(level, i)`:
 * item i's [w, h] at a level (no bigger than its master rect); `clients`:
 * the uv attributes that show the page, each { attr, src (the master uvs,
 * normalised, as the attribute stores them), idx (the item each vertex
 * shows, -1 none) }; `mats`: the materials that draw it.  set(level) packs
 * that level (cached if `keep(level)`), rewrites every client's uvs and
 * shows it; the page it replaces gives its GPU memory back.
 */
export function levelPage({ master, items, size, clients, mats, like, name, keep = () => false }) {
  const Wm = master.width, Hm = master.height;
  const cache = new Map();
  let at = null, cur = null;
  const build = (level) => {
    const slots = items.map((m, i) => { const [w, h] = size(level, i); return { w: Math.max(1, Math.min(m.w, w)), h: Math.max(1, Math.min(m.h, h)) }; });
    const W = widthFor(slots), H = pack(slots, W);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.imageSmoothingQuality = 'high';
    items.forEach((m, i) => blit(c, master, m.x, m.y, m.w, m.h, slots[i]));
    const tex = canvasTexture(cv, like);
    tex.name = `${name}-${level}`;
    return { level, tex, slots, W, H, bytes: W * H * 4 * 4 / 3 };
  };
  const remap = (L) => {
    for (const { attr, src, idx } of clients) {
      const a = attr.array, q = attr.normalized ? 65535 : 1;
      for (let v = 0; v < idx.length; v++) {
        const j = idx[v];
        if (j < 0) continue;
        const m = items[j], s = L.slots[j];
        const x = (src[v * 2] / q) * Wm, y = (1 - src[v * 2 + 1] / q) * Hm;
        const u = (s.x + (x - m.x) * s.w / m.w) / L.W, w = 1 - (s.y + (y - m.y) * s.h / m.h) / L.H;
        a[v * 2] = q === 1 ? u : Math.round(Math.min(1, Math.max(0, u)) * q);
        a[v * 2 + 1] = q === 1 ? w : Math.round(Math.min(1, Math.max(0, w)) * q);
      }
      attr.clearUpdateRanges?.();
      attr.needsUpdate = true;
    }
  };
  return {
    get level() { return at; },
    get current() { return cur; },
    /** Build a level ahead of its use (the visit's, as you choose it): its canvas waits on the CPU. */
    prepare(level) { if (!cache.has(level)) cache.set(level, build(level)); },
    set(level) {
      if (level === at) return;
      const was = cur;
      at = level;
      cur = cache.get(level) ?? build(level);
      if (keep(level)) cache.set(level, cur); else cache.delete(level);
      remap(cur);
      for (const m of mats) m.map = cur.tex;
      // the page it replaces gives its GPU memory back (its canvas too, unless it is one kept)
      if (was && was !== cur) { if (keep(was.level)) was.tex.dispose(); else drop(was.tex); }
      // a level prepared and not taken (another visit chosen after all) goes
      for (const [l, L] of cache) if (!keep(l) && L !== cur) { drop(L.tex); cache.delete(l); }
    },
  };
}

/** A client of a level page: an attribute, a copy of its master uvs, and the item each vertex shows. */
function client(attr, idx) {
  return { attr, src: attr.array.slice(0, idx.length * 2), idx };
}

export function repackStore(scene) {
  const inside = scene.getObjectByName('lawson-interior');
  if (!inside?.userData.units) return null;
  const units = inside.userData.units;
  const out = { labelsFromMB: 0, tagsFromMB: 0 };
  const MB = (w, h) => +((w * h * 4 * 4 / 3) / 1048576).toFixed(1);

  /* konbini-seen.js measured at the most the build renders (2x the CSS size); a tier that renders less
   * (MOBILE.render.scale) never samples finer than its share of that */
  const k = Math.min(1, (MOBILE.render.scale ?? 2) / 2);
  const step4 = (s, max) => Math.min(max, Math.max(8, Math.ceil(s * k / 4) * 4));
  const menu = new Set(FEATURED.flatMap((f) => f.ids));
  const visits = Object.keys(LABEL_LV).filter((l) => l.startsWith('visit:'));
  /* a level's size for an item: what that level's poses saw (a visit: what it hands you, the whole
   * cell; any other visit's level, for one this build never measured); `floor` for one it never saw */
  const need = (table, level, id) => {
    if (level.startsWith('near:')) level = 'near';
    if (level.startsWith('visit:') && !table[level]) return Math.max(...visits.map((v) => table[v]?.[id] ?? 0));
    return table[level]?.[id];
  };
  // what a level hands you whole: the visit's product, in the store and as you eat it outside
  const handed = (level, id) => level === `visit:${id}` || level === `near:${id}`;

  /* ------------------------------ labels ------------------------------ */
  const A = labelAtlas();
  const SIZE = A.pages[0].image.width, N = 16, PX = SIZE / N;         // (labels.js: 16 x 16 cells of 192 px)
  const stocked = new Set(units.map((u) => u.id));
  const items = [];
  for (const p of CATALOG) {
    const at = A.cellOf[p.id];
    if (!at) continue;
    // a product the tool never met keeps the desktop's cell; one not on the shelves at all is never seen
    const seen = LABEL_PX[p.id] ?? (stocked.has(p.id) ? PX : 8);
    const s = menu.has(p.id) ? PX : step4(seen, PX);
    items.push({ id: p.id, page: at.page, cell: at.cell, w: s, h: s });
  }
  const white = { id: null, w: 8, h: 8 };
  items.push(white);
  const W = widthFor(items), H = pack(items, W);
  const cv = document.createElement('canvas');                         // the master: on the CPU only
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.imageSmoothingQuality = 'high';
  for (const it of items) {
    if (!it.id) { c.fillStyle = '#ffffff'; c.fillRect(it.x - PAD, it.y - PAD, it.w + PAD * 2, it.h + PAD * 2); continue; }
    const src = A.pages[it.page].image;
    blit(c, src, (it.cell % N) * PX, Math.floor(it.cell / N) * PX, PX, PX, it);
  }
  const itemOf = new Map(items.map((it, i) => [it.id, i]));
  const whiteI = items.length - 1;
  /* A uv on the desktop's page -> the master: a label's point keeps its place in its cell (labels.js
   * cellRect's inset scales with the cell); the white cell's centre goes to the white slot's.  Each
   * vertex's item is noted, for the levels. */
  const wr = cellRect(WHITE);
  const wu = (wr[0] + wr[2]) / 2, wv = (wr[1] + wr[3]) / 2;
  const toMaster = (uv, from, count, id, idx) => {
    const i = itemOf.get(id), it = items[i], cell = A.cellOf[id].cell;
    const cx = (cell % N) * PX, cy = Math.floor(cell / N) * PX;
    const ks = it.w / PX;
    for (let v = from; v < from + count; v++) {
      const u = uv.getX(v), w = uv.getY(v);
      if (Math.abs(u - wu) < 1e-5 && Math.abs(w - wv) < 1e-5) { uv.setXY(v, (white.x + 4) / W, 1 - (white.y + 4) / H); idx[v] = whiteI; continue; }
      const px = u * SIZE - cx, py = (1 - w) * SIZE - cy;                  // texels into its cell
      uv.setXY(v, (it.x + px * ks) / W, 1 - (it.y + py * ks) / H);
      idx[v] = i;
    }
  };
  const labelClients = [];
  // every product's own geometry (what the hand carries, the flights), once
  for (const it of items) {
    if (!it.id) continue;
    const g = productGeometry(it.id);
    if (g.userData.repacked) continue;
    g.userData.repacked = true;
    const idx = new Int16Array(g.attributes.uv.count).fill(-1);
    toMaster(g.attributes.uv, 0, g.attributes.uv.count, it.id, idx);
    labelClients.push(client(g.attributes.uv, idx));
  }
  // the stock pages' baked copies, unit by unit
  const mats = new Set(), stockIdx = new Map();
  for (const u of units) {
    const mesh = inside.children.find((o) => o.material === u.mat && /^stock-page/.test(o.name));
    const uv = mesh.geometry.attributes.uv;
    if (!stockIdx.has(mesh)) stockIdx.set(mesh, new Int16Array(uv.count).fill(-1));
    toMaster(uv, u.start, u.n, u.id, stockIdx.get(mesh));
    mats.add(u.mat);
  }
  // their uvs in 16 bits (a 3312 page needs no more): 8 -> 4 bytes a vertex, ~6 MB
  for (const [mesh, idx] of stockIdx) {
    const a = mesh.geometry.attributes.uv;
    const q = new Uint16Array(a.array.length);
    for (let i = 0; i < q.length; i++) q[i] = Math.round(Math.min(1, Math.max(0, a.array[i])) * 65535);
    const attr = new THREE.BufferAttribute(q, 2, true);
    mesh.geometry.setAttribute('uv', attr);
    labelClients.push(client(attr, idx));
  }
  /* and their positions in 16 bits over the page's box (quantizePositions): 12 -> 6 bytes a vertex.
   * products.js placeUnit rewrites a unit's range of the float positions (a unit taken, the next one
   * sliding forward): each write is carried into the 16-bit copy the GPU draws. */
  for (const mesh of stockIdx.keys()) {
    const f = mesh.geometry.attributes.position;
    if (!quantizePositions(mesh, 0.6)) continue;
    const q = mesh.geometry.attributes.position, { c, h } = mesh.userData.quant;
    Object.defineProperty(f, 'needsUpdate', {
      configurable: true,
      set(v) {
        if (v !== true) return;
        const F = f.array, Q = q.array;
        for (const r of f.updateRanges.length ? f.updateRanges : [{ start: 0, count: F.length }]) {
          for (let i = r.start; i < r.start + r.count; i++) { const k = i % 3; Q[i] = Math.round(Math.max(-1, Math.min(1, (F[i] - c[k]) / h[k])) * 32767); }
          q.addUpdateRange(r.start, r.count);
        }
        f.clearUpdateRanges();
        q.needsUpdate = true;
      },
    });
  }
  const old = A.pages;
  out.labelsFromMB = old.reduce((s, t) => s + MB(t.image.width, t.image.height), 0);
  out.labelMaster = [W, H];
  const labels = levelPage({
    master: cv, items, clients: labelClients, mats: [...mats], like: old[0], name: 'store-labels',
    keep: (l) => l === 'far' || l === 'near',
    size: (level, i) => {
      const it = items[i];
      if (!it.id) return [8, 8];
      if (handed(level, it.id)) return [it.w, it.h];                    // what the visit hands you: whole
      const s = need(LABEL_LV, level, it.id);
      const px = s ? step4(s, it.w) : level.startsWith('visit:') ? 16 : 8;
      return [px, px];
    },
  });
  for (const m of mats) m.needsUpdate = true;
  for (const t of old) drop(t);
  const pages = [labels];

  /* ------------------------------ price tags ------------------------------ */
  const T = tagAtlas();
  const tagMesh = [];
  inside.traverse((o) => { if (o.isMesh && o.material?.map === T.tex) tagMesh.push(o); });
  if (tagMesh.length) {
    const TW = 256, TH = 96, TC = 8, TR = Math.ceil(CATALOG.length / TC);
    const tw = (w) => Math.min(TW, Math.max(16, Math.ceil(w * k / 4) * 4));
    const tItems = CATALOG.map((p, i) => {
      const w = tw(TAG_PX[p.id] ?? TW);
      return { id: p.id, cell: T.cellOf[p.id] ?? i, w, h: Math.max(4, Math.round(w * TH / TW)) };
    });
    const tW = widthFor(tItems), tH = pack(tItems, tW);
    const tv = document.createElement('canvas');
    tv.width = tW; tv.height = tH;
    const tc = tv.getContext('2d');
    tc.imageSmoothingQuality = 'high';
    const src = T.tex.image, SW = src.width, SH = src.height;
    for (const it of tItems) blit(tc, src, (it.cell % TC) * TW, Math.floor(it.cell / TC) * TH, TW, TH, it);
    const byCell = new Map(tItems.map((it, i) => [it.cell, i]));
    const tagClients = [];
    for (const o of tagMesh) {
      const uv = o.geometry.attributes.uv, idx = new Int16Array(uv.count).fill(-1);
      for (let i = 0; i + 3 < uv.count; i += 4) {
        let mu = 0, mv = 0;
        for (let q = 0; q < 4; q++) { mu += uv.getX(i + q) / 4; mv += uv.getY(i + q) / 4; }
        const col = Math.floor(mu * TC), row = Math.floor((1 - mv) * TR);
        const j = byCell.get(row * TC + col);
        if (j === undefined) continue;
        const it = tItems[j], kx = it.w / TW, ky = it.h / TH;
        for (let v = i; v < i + 4; v++) {
          const px = uv.getX(v) * SW - col * TW, py = (1 - uv.getY(v)) * SH - row * TH;
          uv.setXY(v, (it.x + px * kx) / tW, 1 - (it.y + py * ky) / tH);
          idx[v] = j;
        }
      }
      tagClients.push(client(uv, idx));
    }
    const tags = levelPage({
      master: tv, items: tItems, clients: tagClients, mats: tagMesh.map((o) => o.material), like: T.tex, name: 'store-tags',
      keep: (l) => l === 'far' || l === 'near',
      size: (level, i) => {
        const it = tItems[i], s = need(TAG_LV, level, it.id);
        const w = s ? Math.min(it.w, tw(s)) : 16;
        return [w, Math.max(4, Math.round(w * TH / TW))];
      },
    });
    for (const o of tagMesh) o.material.needsUpdate = true;
    pages.push(tags);
    out.tagsFromMB = MB(SW, SH); out.tagMaster = [tW, tH];
    drop(T.tex);
  }

  /* ----------------------------- in, near, far -----------------------------
   * In the store (a visit playing), that visit's level; outside within MOBILE.store.near of its middle
   * (`far` the way back out), near; farther, far. */
  const centre = new THREE.Vector3();
  new THREE.Box3().setFromObject(inside).getCenter(centre);
  out.pages = pages;
  out.centre = centre;
  let level = null;
  /** `visit`: the id of the visit playing, else null; `inStore`: the camera is inside.  Out of the
   * store with the visit still on (you eat outside), the near level with what it gave you whole: the
   * visit's level goes as the town behind the walls comes back. */
  out.update = (cam, visit = null, inStore = false) => {
    const d = Math.hypot(cam.x - centre.x, cam.z - centre.z);
    const want = visit ? (inStore ? `visit:${visit}` : `near:${visit}`) : level === 'far' ? (d < MOBILE.store.near ? 'near' : 'far') : (d < MOBILE.store.far ? 'near' : 'far');
    if (want === level) return;
    level = want;
    for (const p of pages) p.set(level);
  };
  out.prepare = (visit) => { for (const p of pages) p.prepare(`visit:${visit}`); };
  out.level = () => level;
  return out;
}
