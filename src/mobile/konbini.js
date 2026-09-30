import * as THREE from 'three';
import { labelAtlas, tagAtlas, cellRect, WHITE } from '../world/store/labels.js';
import { productGeometry } from '../world/store/products.js';
import { CATALOG, FEATURED } from '../data/catalog.js';
import { MOBILE } from '../config.js';
import { LABEL_PX, TAG_PX } from './konbini-seen.js';

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
 * forecourt up to the glass, and writes the most each label and tag is ever
 * drawn at on a phone (konbini-seen.js).  Here each one is redrawn at that
 * size, from the desktop's own painting, into one page for the labels and
 * one for the tags.  A texture's mipmaps never sample finer than the screen
 * asks, so a cell no bigger than its largest sighting (plus a margin) looks
 * the same as the desktop's; what is handed to you (the five choices) keeps
 * the whole cell.  About 60 MB instead of 153.
 *
 * In, near and far: the pages are whole only in the store (the visit walks
 * you in); outside near it, at the door's spot, a half (what the glass
 * shows from there); farther (the famous views stand ~23 m off) a quarter
 * (the second mip level, which is all a label seen through the glass from
 * there samples).  The pages not shown give their GPU memory back until
 * they are needed again.
 * ------------------------------------------------------------------ */

const PAD = 2;

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
 * A page at levels: [1, ...ks] of its size, each drawn from the whole one
 * (the same picture as the matching mip level, which is all a surface seen
 * that small samples).  set(i) shows level i on the materials; the levels
 * not shown give their GPU memory back (uploaded again when next drawn).
 */
export function pageLevels(mats, full, ks) {
  const img = full.image;
  const levels = [full, ...ks.map((k) => {
    if (k >= 1) return full;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.width * k)); cv.height = Math.max(1, Math.round(img.height * k));
    const c = cv.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, 0, 0, cv.width, cv.height);
    const t = canvasTexture(cv, full);
    t.name = `${full.name || 'page'}-${k}`;
    return t;
  })];
  let at = 0;
  return {
    levels,
    set(i) {
      if (i === at) return;
      const was = levels[at];
      at = i;
      for (const m of mats) m.map = levels[i];
      if (was !== levels[i]) was.dispose();
    },
  };
}

export function repackStore(scene) {
  const inside = scene.getObjectByName('lawson-interior');
  if (!inside?.userData.units) return null;
  const units = inside.userData.units;
  const pages = [];
  const out = { labelsFromMB: 0, labelsToMB: 0, tagsFromMB: 0, tagsToMB: 0 };
  const MB = (w, h) => +((w * h * 4 * 4 / 3) / 1048576).toFixed(1);

  /* ------------------------------ labels ------------------------------ */
  const A = labelAtlas();
  const SIZE = A.pages[0].image.width, N = 16, PX = SIZE / N;         // (labels.js: 16 x 16 cells of 192 px)
  const stocked = new Set(units.map((u) => u.id));
  /* konbini-seen.js measured at the most the build renders (2x the CSS size); a tier that renders less
   * (MOBILE.render.scale) never samples finer than its share of that */
  const k = Math.min(1, (MOBILE.render.scale ?? 2) / 2);
  const menu = new Set(FEATURED.flatMap((f) => f.ids));
  const items = [];
  for (const p of CATALOG) {
    const at = A.cellOf[p.id];
    if (!at) continue;
    // a product the tool never met keeps the desktop's cell; one not on the shelves at all is never seen
    const seen = LABEL_PX[p.id] ?? (stocked.has(p.id) ? PX : 8);
    const s = menu.has(p.id) ? PX : Math.min(PX, Math.max(8, Math.ceil(seen * k / 4) * 4));
    items.push({ id: p.id, page: at.page, cell: at.cell, w: s, h: s });
  }
  const white = { id: null, w: 8, h: 8 };
  items.push(white);
  const W = widthFor(items), H = pack(items, W);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.imageSmoothingQuality = 'high';
  for (const it of items) {
    if (!it.id) { c.fillStyle = '#ffffff'; c.fillRect(it.x - PAD, it.y - PAD, it.w + PAD * 2, it.h + PAD * 2); continue; }
    const src = A.pages[it.page].image;
    blit(c, src, (it.cell % N) * PX, Math.floor(it.cell / N) * PX, PX, PX, it);
  }
  const byId = new Map(items.filter((it) => it.id).map((it) => [it.id, it]));
  /* A uv on the old page -> the new one: a label's point keeps its place in its cell (labels.js cellRect's
   * inset scales with the cell); the white cell's centre goes to the white slot's. */
  const wr = cellRect(WHITE);
  const wu = (wr[0] + wr[2]) / 2, wv = (wr[1] + wr[3]) / 2;
  const remap = (uv, from, count, id) => {
    const it = byId.get(id), cell = A.cellOf[id].cell;
    const cx = (cell % N) * PX, cy = Math.floor(cell / N) * PX;
    const ks = it.w / PX;
    for (let i = from; i < from + count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      if (Math.abs(u - wu) < 1e-5 && Math.abs(v - wv) < 1e-5) { uv.setXY(i, (white.x + 4) / W, 1 - (white.y + 4) / H); continue; }
      const px = u * SIZE - cx, py = (1 - v) * SIZE - cy;                  // texels into its cell
      uv.setXY(i, (it.x + px * ks) / W, 1 - (it.y + py * ks) / H);
    }
    uv.needsUpdate = true;
  };
  // every product's own geometry (what the hand carries, the flights), once
  for (const it of items) {
    if (!it.id) continue;
    const g = productGeometry(it.id);
    if (g.userData.repacked) continue;
    g.userData.repacked = true;
    remap(g.attributes.uv, 0, g.attributes.uv.count, it.id);
  }
  // the stock pages' baked copies, unit by unit
  const mats = new Set();
  for (const u of units) {
    const mesh = inside.children.find((o) => o.material === u.mat && /^stock-page/.test(o.name));
    remap(mesh.geometry.attributes.uv, u.start, u.n, u.id);
    mats.add(u.mat);
  }
  const old = A.pages;
  const full = canvasTexture(cv, old[0]);
  full.name = 'store-labels';
  for (const m of mats) { m.map = full; m.needsUpdate = true; }
  pages.push(pageLevels([...mats], full, MOBILE.store.labels));
  out.labelsFromMB = old.reduce((s, t) => s + MB(t.image.width, t.image.height), 0);
  out.labelsToMB = MB(W, H);
  out.labelPage = [W, H];
  for (const t of old) drop(t);

  /* ------------------------------ price tags ------------------------------ */
  const T = tagAtlas();
  const tagMesh = [];
  inside.traverse((o) => { if (o.isMesh && o.material?.map === T.tex) tagMesh.push(o); });
  if (tagMesh.length) {
    const TW = 256, TH = 96, TC = 8, TR = Math.ceil(CATALOG.length / TC);
    const tItems = CATALOG.map((p, i) => {
      const w = Math.min(TW, Math.max(16, Math.ceil((TAG_PX[p.id] ?? TW) * k / 4) * 4));
      return { id: p.id, cell: T.cellOf[p.id] ?? i, w, h: Math.max(4, Math.round(w * TH / TW)) };
    });
    const tW = widthFor(tItems), tH = pack(tItems, tW);
    const tv = document.createElement('canvas');
    tv.width = tW; tv.height = tH;
    const tc = tv.getContext('2d');
    tc.imageSmoothingQuality = 'high';
    const src = T.tex.image, SW = src.width, SH = src.height;
    for (const it of tItems) blit(tc, src, (it.cell % TC) * TW, Math.floor(it.cell / TC) * TH, TW, TH, it);
    const byCell = new Map(tItems.map((it) => [it.cell, it]));
    for (const o of tagMesh) {
      const uv = o.geometry.attributes.uv;
      for (let i = 0; i < uv.count; i += 4) {
        let mu = 0, mv = 0;
        for (let k = 0; k < 4; k++) { mu += uv.getX(i + k) / 4; mv += uv.getY(i + k) / 4; }
        const col = Math.floor(mu * TC), row = Math.floor((1 - mv) * TR);
        const it = byCell.get(row * TC + col);
        if (!it) continue;
        const kx = it.w / TW, ky = it.h / TH;
        for (let j = i; j < i + 4; j++) {
          const px = uv.getX(j) * SW - col * TW, py = (1 - uv.getY(j)) * SH - row * TH;
          uv.setXY(j, (it.x + px * kx) / tW, 1 - (it.y + py * ky) / tH);
        }
      }
      uv.needsUpdate = true;
    }
    const tags = canvasTexture(tv, T.tex);
    tags.name = 'store-tags';
    tags.userData.alpha = T.tex.userData.alpha;
    for (const o of tagMesh) { o.material.map = tags; o.material.needsUpdate = true; }
    pages.push(pageLevels(tagMesh.map((o) => o.material), tags, MOBILE.store.tags));
    out.tagsFromMB = MB(SW, SH); out.tagsToMB = MB(tW, tH); out.tagPage = [tW, tH];
    drop(T.tex);
  }

  /* ----------------------------- in, near, far -----------------------------
   * Level 0 (the whole pages) only in the store (the visit walks you in);
   * outside within MOBILE.store.near of its middle, level 1; farther, 2. */
  const centre = new THREE.Vector3();
  new THREE.Box3().setFromObject(inside).getCenter(centre);
  out.pages = pages;
  let level = -1;
  out.update = (cam, inStore = false) => {
    const d = Math.hypot(cam.x - centre.x, cam.z - centre.z);
    let want = inStore ? 0 : level === 2 ? (d < MOBILE.store.near ? 1 : 2) : (d < MOBILE.store.far ? 1 : 2);
    if (want === level) return;
    level = want;
    for (const p of pages) p.set(level);
  };
  return out;
}
