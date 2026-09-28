import { paintMap, drawIcon, drawGem, JP } from './mapArt.js';
import { STRINGS } from '../data/strings.js';

/* ------------------------------------------------------------------ *
 * The minimap and the full map (SPEC M2f; map 2.0).
 *
 *   corner   a round map in the bottom-right, turned so the way you face
 *            is up, your arrow in the middle, a compass ring with N, the
 *            places' pictograms upright; the Nippon always shown, pinned
 *            to the rim when it is out of range
 *   full     M: the whole town north-up on its sheet, every place's
 *            pictogram and label (English, the Japanese small beside it),
 *            the experiences' diamonds, where you are, a title cartouche,
 *            a compass rose and a scale bar
 *
 * The map itself is painted once (mapArt.js); a frame only copies it,
 * turned, into a small canvas -- and only when you have moved or turned.
 * The full map is drawn when it opens.
 * ------------------------------------------------------------------ */

const SIZE = 196;             // corner map, CSS px
const RANGE = 60;             // metres from the centre to the rim
const INK = '#2e2a3a', INK_SOFT = '#6a6378', CREAM = 'rgba(255,251,242,0.95)', LINE = 'rgba(70,62,86,0.28)';

export function createMinimap(world) {
  const art = paintMap(world);
  if (import.meta.env?.DEV) window.__mapArt = art;
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  /* ---- DOM ---- */
  const style = document.createElement('style');
  style.textContent = `
    .minimap { position: fixed; right: 22px; bottom: 22px; width: ${SIZE}px; height: ${SIZE}px;
      border-radius: 50%; pointer-events: none; z-index: 5; transition: opacity 0.6s;
      filter: drop-shadow(0 3px 8px rgba(40,30,60,0.35)); }
    .minimap.hidden { opacity: 0; }
    .fullmap { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
      background: rgba(30,26,44,0.55); z-index: 20; transition: opacity 0.25s; }
    .fullmap.hidden { opacity: 0; pointer-events: none; }
    .fullmap canvas { max-width: 92vw; max-height: 92vh; border-radius: 10px;
      box-shadow: 0 12px 44px rgba(20,14,34,0.45); }
  `;
  document.head.appendChild(style);
  const corner = document.createElement('canvas');
  corner.className = 'minimap hidden';
  corner.width = corner.height = SIZE * dpr;
  corner.style.width = corner.style.height = SIZE + 'px';
  document.body.appendChild(corner);
  const fullWrap = document.createElement('div');
  fullWrap.className = 'fullmap hidden';
  const full = document.createElement('canvas');
  fullWrap.appendChild(full);
  document.body.appendChild(fullWrap);
  const cc = corner.getContext('2d');

  const lawson = art.places.find((p) => p.id === 'lawson');
  // the experiences (Tan's things to do): the soft yellow of their glow in town
  const spots = () => [...(world.experiences?.list ?? []), ...(world.lawson?.experiences?.list ?? [])];
  /* Where each diamond goes: on its spot, unless it belongs to a place (or
   * a place's icon is there), when it sits on that icon's corner as a
   * badge; two that land together draw once. */
  const placeGems = (list, at, icons, gr) => {
    const outp = [];
    for (const e of list) {
      let [x, y, d] = at(e.x, e.z);
      if (d !== undefined && d > RANGE * 0.95) continue;
      const ic = icons.find((q) => q.exp === e.id) ?? icons.find((q) => Math.hypot(q.x - x, q.y - y) < q.r + gr * 0.6);
      if (ic) { x = ic.x + ic.r * 0.85; y = ic.y - ic.r * 0.85; }
      if (!outp.some(([a, b]) => Math.hypot(a - x, b - y) < gr * 1.2)) outp.push([x, y]);
    }
    return outp;
  };
  let last = { x: NaN, z: NaN, yaw: NaN };

  /* ---- the corner map ---- */
  function drawCorner(pos, yaw) {
    const S = SIZE * dpr, R = S / 2, k = (R - 10 * dpr) / RANGE;   // px per metre
    cc.clearRect(0, 0, S, S);
    cc.save();
    cc.beginPath(); cc.arc(R, R, R - 4 * dpr, 0, Math.PI * 2); cc.clip();
    cc.fillStyle = '#f1ebdd'; cc.fillRect(0, 0, S, S);
    cc.translate(R, R);
    cc.rotate(yaw);                               // the way you face is up
    const [px, pz] = art.toPx(pos.x, pos.z);
    const sc = k / art.ppm;
    cc.scale(sc, sc);
    cc.imageSmoothingQuality = 'high';
    cc.drawImage(art.canvas, -px, -pz);
    cc.restore();

    // places, upright, where they fall once turned
    const at = (x, z) => {
      const dx = x - pos.x, dz = z - pos.z;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      return [R + (dx * c - dz * s) * k, R + (dx * s + dz * c) * k, Math.hypot(dx, dz)];
    };
    const shown = [];
    const ir = 9 * dpr;
    for (const p of art.places) {
      if (p.id === 'lawson') continue;
      const [x, y, d] = at(p.w.x, p.w.z);
      if (d < RANGE * 0.95) { drawIcon(cc, p.kind, x, y, ir); shown.push({ x, y, r: ir, exp: p.exp }); }
    }
    // the Nippon: always shown, on the rim when it is out of range
    {
      let [x, y] = at(lawson.w.x, lawson.w.z);
      const rim = R - 16 * dpr;
      if (Math.hypot(x - R, y - R) > rim) {
        const a = Math.atan2(y - R, x - R);
        x = R + Math.cos(a) * rim; y = R + Math.sin(a) * rim;
      }
      drawIcon(cc, 'konbini', x, y, 10 * dpr);
      shown.push({ x, y, r: 10 * dpr, exp: lawson.exp });
    }
    // the experiences' diamonds, over the icons
    for (const [x, y] of placeGems(spots(), at, shown, 7 * dpr)) drawGem(cc, x, y, 7 * dpr);

    // the compass ring, turning with the map, N at north
    cc.lineWidth = 5 * dpr; cc.strokeStyle = '#fffaf0';
    cc.beginPath(); cc.arc(R, R, R - 4 * dpr, 0, Math.PI * 2); cc.stroke();
    cc.lineWidth = 1.5 * dpr; cc.strokeStyle = 'rgba(70,62,86,0.6)';
    cc.beginPath(); cc.arc(R, R, R - 7 * dpr, 0, Math.PI * 2); cc.stroke();
    for (const [lab, ang, col] of [[STRINGS.map.north, 0, '#c0392b'], ['E', Math.PI / 2, '#555064'], ['S', Math.PI, '#555064'], ['W', -Math.PI / 2, '#555064']]) {
      // north is -z: at screen angle (yaw + ang) from straight up
      const a = yaw + ang - Math.PI / 2;
      const x = R + Math.cos(a) * (R - 5 * dpr), y = R + Math.sin(a) * (R - 5 * dpr);
      const big = ang === 0;
      cc.beginPath(); cc.arc(x, y, (big ? 10 : 7.5) * dpr, 0, Math.PI * 2);
      cc.fillStyle = '#fffaf0'; cc.fill();
      cc.fillStyle = col; cc.font = `bold ${(big ? 12 : 9) * dpr}px ${JP}`;
      cc.textAlign = 'center'; cc.textBaseline = 'middle';
      cc.fillText(lab, x, y + 0.5 * dpr);
    }

    // you: an arrow pointing up
    cc.save();
    cc.translate(R, R);
    cc.beginPath();
    cc.moveTo(0, -11 * dpr); cc.lineTo(8 * dpr, 8 * dpr); cc.lineTo(0, 4 * dpr); cc.lineTo(-8 * dpr, 8 * dpr); cc.closePath();
    cc.fillStyle = '#e8453f'; cc.fill();
    cc.lineWidth = 2 * dpr; cc.strokeStyle = '#fffaf0'; cc.stroke();
    cc.restore();
  }

  /* ---- the full map ---- */
  function drawFull(pos, yaw) {
    const src = art.canvas;
    const scale = Math.min((window.innerWidth * 0.92) / src.width, (window.innerHeight * 0.92) / src.height) * dpr;
    const W = Math.round(src.width * scale), H = Math.round(src.height * scale);
    full.width = W; full.height = H;
    full.style.width = W / dpr + 'px'; full.style.height = H / dpr + 'px';
    const c = full.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(src, 0, 0, W, H);
    const u = dpr * Math.max(0.8, Math.min(1.15, H / dpr / 900));   // one CSS px, a touch larger on a big screen
    const P = (x, z) => { const [a, b] = art.toPx(x, z); return [a * scale, b * scale]; };

    // the sheet's border: a double ink rule inside the edge
    c.strokeStyle = 'rgba(70,62,86,0.55)'; c.lineWidth = 1.6 * u;
    c.strokeRect(9 * u, 9 * u, W - 18 * u, H - 18 * u);
    c.lineWidth = 0.7 * u; c.strokeStyle = 'rgba(70,62,86,0.35)';
    c.strokeRect(13 * u, 13 * u, W - 26 * u, H - 26 * u);

    const r = 12 * u;
    const [ux, uy] = P(pos.x, pos.z);
    // the furniture first, so labels keep clear of it
    const cart = cartouche(c, u, 24 * u, 24 * u);
    const rose = { x: W - 62 * u, y: 70 * u, R: 36 * u };
    const foot = footer(c, u, 24 * u, H - 24 * u, scale * art.ppm, true);
    const taken = [cart, [rose.x - rose.R - 6 * u, rose.y - rose.R - 22 * u, rose.x + rose.R + 6 * u, rose.y + rose.R + 6 * u], foot];
    taken.push([ux - 34 * u, uy - 44 * u, ux + 34 * u, uy + 16 * u]);
    const hits = (b) => taken.some((t) => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]);
    const icons = art.places.map((p) => { const [x, y] = P(p.w.x, p.w.z); taken.push([x - r, y - r, x + r, y + r]); return { p, x, y, r, exp: p.exp }; });
    // the diamonds: placed first so no label covers them, drawn last, on top
    const gr = 8 * u;
    const gems = placeGems(spots(), (x, z) => P(x, z), icons, gr);
    for (const [x, y] of gems) taken.push([x - gr, y - gr, x + gr, y + gr]);
    const enF = `bold ${13 * u}px ${JP}`, jpF = `${10.5 * u}px ${JP}`;
    for (const { p, x, y } of icons) {
      c.font = enF; const w1 = c.measureText(p.en).width;
      c.font = jpF; const w2 = c.measureText(p.jp).width;
      const bw = Math.max(w1, w2) + 14 * u, bh = 33 * u, g = 5 * u;
      const tries = [
        [x + r + g, y - bh / 2], [x - r - g - bw, y - bh / 2],
        [x - bw / 2, y + r + g], [x - bw / 2, y - r - g - bh],
        [x + r + g, y + r * 0.4], [x - r - g - bw, y + r * 0.4],
        [x + r + g, y - bh - r * 0.4], [x - r - g - bw, y - bh - r * 0.4],
      ];
      // the first clear place; failing that, the one that covers least
      const over = ([a, b]) => taken.reduce((sum, t) => sum + Math.max(0, Math.min(a + bw, t[2]) - Math.max(a, t[0])) * Math.max(0, Math.min(b + bh, t[3]) - Math.max(b, t[1])), 0);
      const [bx, by] = tries.find(([a, b]) => !hits([a, b, a + bw, b + bh])) ?? tries.reduce((best, t) => (over(t) < over(best) ? t : best));
      taken.push([bx, by, bx + bw, by + bh]);
      chip(c, u, bx, by, bw, bh);
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillStyle = INK; c.font = enF; c.fillText(p.en, bx + 7 * u, by + 11.5 * u);
      c.fillStyle = INK_SOFT; c.font = jpF; c.fillText(p.jp, bx + 7 * u, by + 24 * u);
    }
    for (const { p, x, y } of icons) drawIcon(c, p.kind, x, y, r);
    for (const [x, y] of gems) drawGem(c, x, y, gr);

    // you are here
    c.save(); c.translate(ux, uy); c.rotate(-yaw);
    c.beginPath(); c.moveTo(0, -15 * u); c.lineTo(10 * u, 10 * u); c.lineTo(0, 5 * u); c.lineTo(-10 * u, 10 * u); c.closePath();
    c.fillStyle = '#e8453f'; c.fill(); c.lineWidth = 2.5 * u; c.strokeStyle = '#fffaf0'; c.stroke();
    c.restore();
    c.font = `bold ${12 * u}px ${JP}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const hw = c.measureText(STRINGS.map.here).width / 2 + 7 * u;
    c.fillStyle = '#e8453f';
    c.beginPath(); c.roundRect(ux - hw, uy - 40 * u, hw * 2, 19 * u, 9.5 * u); c.fill();
    c.fillStyle = '#ffffff'; c.fillText(STRINGS.map.here, ux, uy - 30 * u);

    compass(c, u, rose.x, rose.y, rose.R);
    cartouche(c, u, 24 * u, 24 * u, true);
    footer(c, u, 24 * u, H - 24 * u, scale * art.ppm);
    // the key to close, bottom right
    c.font = `${11 * u}px ${JP}`; c.textAlign = 'right'; c.textBaseline = 'middle';
    const cw = c.measureText(STRINGS.map.close).width + 16 * u;
    chip(c, u, W - 24 * u - cw, H - 24 * u - 22 * u, cw, 22 * u);
    c.fillStyle = INK_SOFT; c.fillText(STRINGS.map.close, W - 32 * u, H - 24 * u - 11 * u);
  }

  /** A label's plate: cream, a hairline, a soft drop. */
  function chip(c, u, x, y, w, h) {
    c.save();
    c.shadowColor = 'rgba(40,30,60,0.22)'; c.shadowBlur = 5 * u; c.shadowOffsetY = 1.5 * u;
    c.fillStyle = CREAM;
    c.beginPath(); c.roundRect(x, y, w, h, 6 * u); c.fill();
    c.restore();
    c.strokeStyle = LINE; c.lineWidth = 0.8 * u;
    c.beginPath(); c.roundRect(x + 0.4 * u, y + 0.4 * u, w - 0.8 * u, h - 0.8 * u, 6 * u); c.stroke();
  }

  /** The title cartouche: a plate with a double rule, the town's name. Returns its box. */
  function cartouche(c, u, x, y, draw = false) {
    c.font = `bold ${21 * u}px ${JP}`; const w1 = c.measureText(STRINGS.map.title).width;
    c.font = `${12 * u}px ${JP}`; const w2 = c.measureText(STRINGS.map.titleJp).width;
    const w = Math.max(w1 + 30 * u, w2) + 34 * u, h = 62 * u;
    if (!draw) return [x, y, x + w, y + h];
    chip(c, u, x, y, w, h);
    c.strokeStyle = 'rgba(70,62,86,0.35)'; c.lineWidth = 0.7 * u;
    c.beginPath(); c.roundRect(x + 4 * u, y + 4 * u, w - 8 * u, h - 8 * u, 4 * u); c.stroke();
    // a little Fuji on the plate: the town's own mountain
    const fx = x + 17 * u, fy = y + 28 * u;
    c.fillStyle = '#8fa6c8';
    c.beginPath(); c.moveTo(fx - 9 * u, fy + 6 * u); c.lineTo(fx - 2.5 * u, fy - 6 * u); c.lineTo(fx + 2.5 * u, fy - 6 * u); c.lineTo(fx + 9 * u, fy + 6 * u); c.closePath(); c.fill();
    c.fillStyle = '#fbfbff';
    c.beginPath(); c.moveTo(fx - 4.6 * u, fy - 1.7 * u); c.lineTo(fx - 2.5 * u, fy - 6 * u); c.lineTo(fx + 2.5 * u, fy - 6 * u); c.lineTo(fx + 4.6 * u, fy - 1.7 * u); c.lineTo(fx + 2 * u, fy - 3 * u); c.lineTo(fx, fy - 1.4 * u); c.lineTo(fx - 2 * u, fy - 3 * u); c.closePath(); c.fill();
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = INK; c.font = `bold ${21 * u}px ${JP}`; c.fillText(STRINGS.map.title, x + 32 * u, y + 24 * u);
    c.fillStyle = INK_SOFT; c.font = `${12 * u}px ${JP}`; c.fillText(STRINGS.map.titleJp, x + 32 * u, y + 45 * u);
    return [x, y, x + w, y + h];
  }

  /** A compass rose: four long points and four short, shaded on one side, N in red. */
  function compass(c, u, x, y, R) {
    c.save();
    c.translate(x, y);
    c.fillStyle = 'rgba(255,251,242,0.8)';
    c.beginPath(); c.arc(0, 0, R * 0.78, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(70,62,86,0.45)'; c.lineWidth = 0.8 * u;
    c.beginPath(); c.arc(0, 0, R * 0.78, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(0, 0, R * 0.7, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 32; i++) {
      const a = (i * Math.PI) / 16, l = i % 4 ? 0.04 : 0.08;
      c.beginPath(); c.moveTo(Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7); c.lineTo(Math.cos(a) * R * (0.7 - l), Math.sin(a) * R * (0.7 - l)); c.stroke();
    }
    const point = (a, len, wid, dark, light) => {
      const ca = Math.cos(a), sa = Math.sin(a), cp = Math.cos(a + Math.PI / 2), sp = Math.sin(a + Math.PI / 2);
      c.fillStyle = dark;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(ca * len, sa * len); c.lineTo(cp * wid, sp * wid); c.closePath(); c.fill();
      c.fillStyle = light;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(ca * len, sa * len); c.lineTo(-cp * wid, -sp * wid); c.closePath(); c.fill();
    };
    for (let i = 0; i < 4; i++) point(Math.PI / 4 + (i * Math.PI) / 2, R * 0.5, R * 0.1, '#8a8298', '#d9d3e0');
    for (let i = 0; i < 4; i++) point(-Math.PI / 2 + (i * Math.PI) / 2, R * (i === 0 ? 0.95 : 0.82), R * 0.15, i === 0 ? '#b8392e' : '#4a4460', i === 0 ? '#e8766a' : '#a49db4');
    c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(0, 0, R * 0.06, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#b8392e'; c.font = `bold ${15 * u}px ${JP}`; c.textAlign = 'center'; c.textBaseline = 'bottom';
    c.fillText(STRINGS.map.north, 0, -R * 0.98);
    c.restore();
  }

  /** The foot of the sheet: a scale bar and the diamonds' key.  Returns its box. */
  function footer(c, u, x, yb, pxPerM, measureOnly = false) {
    const m = 50, seg = (m / 2) * pxPerM;
    c.font = `${10.5 * u}px ${JP}`;
    const kw = c.measureText(STRINGS.map.todo).width;
    const w = seg * 2 + 38 * u + 22 * u + kw + 26 * u, h = 34 * u, y = yb - h;
    if (measureOnly) return [x, y, x + w, y + h];
    chip(c, u, x, y, w, h);
    const bx = x + 12 * u, by = y + 12 * u;
    for (let i = 0; i < 2; i++) {
      c.fillStyle = i ? '#fbf9f3' : '#4a4460';
      c.fillRect(bx + i * seg, by, seg, 5 * u);
    }
    c.strokeStyle = '#4a4460'; c.lineWidth = 0.9 * u; c.strokeRect(bx, by, seg * 2, 5 * u);
    c.fillStyle = INK_SOFT; c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillText('0', bx, by + 8 * u); c.fillText(String(m / 2), bx + seg, by + 8 * u);
    c.textAlign = 'left'; c.fillText(STRINGS.map.scale(m), bx + seg * 2 - 6 * u, by + 8 * u);
    const gx = bx + seg * 2 + 40 * u;
    drawGem(c, gx, y + h / 2, 7 * u);
    c.fillStyle = INK; c.textBaseline = 'middle'; c.fillText(STRINGS.map.todo, gx + 12 * u, y + h / 2 + 0.5 * u);
    return [x, y, x + w, y + h];
  }

  let visible = false, fullOpen = false;
  if (import.meta.env?.DEV) window.__minimapDraw = () => drawCorner(window.__scene.player.pos, window.__scene.player.yaw);
  return {
    /** Each frame: redraw the corner map only if you moved or turned. */
    update(pos, yaw) {
      if (!visible) return;
      if (Math.abs(pos.x - last.x) < 0.05 && Math.abs(pos.z - last.z) < 0.05 && Math.abs(yaw - last.yaw) < 0.002) return;
      last = { x: pos.x, z: pos.z, yaw };
      drawCorner(pos, yaw);
    },
    setVisible(v) {
      if (v === visible) return;
      visible = v;
      corner.classList.toggle('hidden', !v);
      last = { x: NaN, z: NaN, yaw: NaN };
    },
    get fullOpen() { return fullOpen; },
    setFull(open, pos, yaw) {
      fullOpen = open;
      if (open) drawFull(pos, yaw);
      corner.style.visibility = open ? 'hidden' : '';
      fullWrap.classList.toggle('hidden', !open);
    },
  };
}
