import { paintMap, drawIcon, JP } from './mapArt.js';
import { STRINGS } from '../data/strings.js';

/* ------------------------------------------------------------------ *
 * The minimap and the full map (SPEC M2f).
 *
 *   corner   a round map in the bottom-right, turned so the way you face
 *            is up, your arrow in the middle, a compass ring with 北, the
 *            places' icons upright; the Lawson always shown, pinned to the
 *            rim when it is out of range
 *   full     M: the whole town north-up, every place named in Japanese and
 *            English, where you are, and a key
 *
 * The map itself is painted once (mapArt.js); a frame only copies it,
 * turned, into a small canvas -- and only when you have moved or turned.
 * ------------------------------------------------------------------ */

const SIZE = 196;             // corner map, CSS px
const RANGE = 60;             // metres from the centre to the rim

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
    .fullmap canvas { max-width: 92vw; max-height: 92vh; border-radius: 14px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.4); }
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
  let last = { x: NaN, z: NaN, yaw: NaN };

  /* ---- the corner map ---- */
  function drawCorner(pos, yaw) {
    const S = SIZE * dpr, R = S / 2, k = (R - 10 * dpr) / RANGE;   // px per metre
    cc.clearRect(0, 0, S, S);
    cc.save();
    cc.beginPath(); cc.arc(R, R, R - 4 * dpr, 0, Math.PI * 2); cc.clip();
    cc.translate(R, R);
    cc.rotate(yaw);                               // the way you face is up
    const [px, pz] = art.toPx(pos.x, pos.z);
    const sc = k / art.ppm;
    cc.scale(sc, sc);
    cc.drawImage(art.canvas, -px, -pz);
    cc.restore();

    // places, upright, where they fall once turned
    const at = (x, z) => {
      const dx = x - pos.x, dz = z - pos.z;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      return [R + (dx * c - dz * s) * k, R + (dx * s + dz * c) * k, Math.hypot(dx, dz)];
    };
    for (const p of art.places) {
      if (p.id === 'lawson') continue;
      const [x, y, d] = at(p.w.x, p.w.z);
      if (d < RANGE * 0.95) drawIcon(cc, p.kind, x, y, 10 * dpr);
    }
    // the Lawson: always shown, on the rim when it is out of range
    {
      let [x, y, d] = at(lawson.w.x, lawson.w.z);
      const rim = R - 16 * dpr;
      if (Math.hypot(x - R, y - R) > rim) {
        const a = Math.atan2(y - R, x - R);
        x = R + Math.cos(a) * rim; y = R + Math.sin(a) * rim;
      }
      drawIcon(cc, 'konbini', x, y, 11 * dpr);
    }

    // the compass ring, turning with the map, 北 at north
    cc.lineWidth = 5 * dpr; cc.strokeStyle = '#fffaf0';
    cc.beginPath(); cc.arc(R, R, R - 4 * dpr, 0, Math.PI * 2); cc.stroke();
    cc.lineWidth = 1.5 * dpr; cc.strokeStyle = 'rgba(70,62,86,0.6)';
    cc.beginPath(); cc.arc(R, R, R - 7 * dpr, 0, Math.PI * 2); cc.stroke();
    for (const [lab, ang, col] of [['北', 0, '#c0392b'], ['東', Math.PI / 2, '#555064'], ['南', Math.PI, '#555064'], ['西', -Math.PI / 2, '#555064']]) {
      // north is -z: at screen angle (yaw + ang) from straight up
      const a = yaw + ang - Math.PI / 2;
      const x = R + Math.cos(a) * (R - 5 * dpr), y = R + Math.sin(a) * (R - 5 * dpr);
      cc.beginPath(); cc.arc(x, y, (lab === '北' ? 11 : 8) * dpr, 0, Math.PI * 2);
      cc.fillStyle = '#fffaf0'; cc.fill();
      cc.fillStyle = col; cc.font = `bold ${(lab === '北' ? 13 : 10) * dpr}px ${JP}`;
      cc.textAlign = 'center'; cc.textBaseline = 'middle';
      cc.fillText(lab, x, y + dpr);
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
    const scale = Math.min((window.innerWidth * 0.9) / src.width, (window.innerHeight * 0.9) / src.height) * dpr;
    const W = Math.round(src.width * scale), H = Math.round(src.height * scale);
    full.width = W; full.height = H;
    full.style.width = W / dpr + 'px'; full.style.height = H / dpr + 'px';
    const c = full.getContext('2d');
    c.drawImage(src, 0, 0, W, H);
    const P = (x, z) => { const [a, b] = art.toPx(x, z); return [a * scale, b * scale]; };
    const r = 13 * dpr;
    // you are here (its box first, so labels keep clear of it)
    const [ux, uy] = P(pos.x, pos.z);
    const taken = [[ux - 34 * dpr, uy - 50 * dpr, ux + 34 * dpr, uy + 18 * dpr]];
    const hits = (b) => taken.some((t) => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]);
    // icons first, then labels beside them: right, left, below or above,
    // whichever is clear of the others
    const icons = art.places.map((p) => { const [x, y] = P(p.w.x, p.w.z); taken.push([x - r, y - r, x + r, y + r]); return { p, x, y }; });
    for (const { p, x, y } of icons) {
      drawIcon(c, p.kind, x, y, r);
      c.font = `bold ${15 * dpr}px ${JP}`;
      const w1 = c.measureText(p.en).width;
      c.font = `${12 * dpr}px ${JP}`;
      const bw = Math.max(w1, c.measureText(p.jp).width) + 12 * dpr, bh = 38 * dpr;
      const tries = [
        [x + r + 4 * dpr, y - bh / 2], [x - r - 4 * dpr - bw, y - bh / 2],
        [x - bw / 2, y + r + 4 * dpr], [x - bw / 2, y - r - 4 * dpr - bh],
        [x + r + 4 * dpr, y + r], [x - r - 4 * dpr - bw, y + r],
      ];
      const [bx, by] = tries.find(([a, b]) => !hits([a, b, a + bw, b + bh])) ?? tries[0];
      taken.push([bx, by, bx + bw, by + bh]);
      c.fillStyle = 'rgba(255,250,240,0.92)';
      c.beginPath(); c.roundRect(bx, by, bw, bh, 6 * dpr); c.fill();
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillStyle = '#2e2a3a'; c.font = `bold ${15 * dpr}px ${JP}`;
      c.fillText(p.en, bx + 6 * dpr, by + 12 * dpr);
      c.fillStyle = '#5a5468'; c.font = `${12 * dpr}px ${JP}`;
      c.fillText(p.jp, bx + 6 * dpr, by + 28 * dpr);
    }
    c.save(); c.translate(ux, uy); c.rotate(-yaw);
    c.beginPath(); c.moveTo(0, -16 * dpr); c.lineTo(11 * dpr, 11 * dpr); c.lineTo(0, 5 * dpr); c.lineTo(-11 * dpr, 11 * dpr); c.closePath();
    c.fillStyle = '#e8453f'; c.fill(); c.lineWidth = 3 * dpr; c.strokeStyle = '#fffaf0'; c.stroke();
    c.restore();
    c.font = `bold ${14 * dpr}px ${JP}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const hw = c.measureText(STRINGS.map.here).width / 2 + 6 * dpr;
    c.fillStyle = '#e8453f';
    c.beginPath(); c.roundRect(ux - hw, uy - 42 * dpr, hw * 2, 20 * dpr, 10 * dpr); c.fill();
    c.fillStyle = '#ffffff'; c.fillText(STRINGS.map.here, ux, uy - 32 * dpr);
    // title, north, and the key to close
    c.fillStyle = 'rgba(255,250,240,0.92)';
    c.beginPath(); c.roundRect(16 * dpr, 16 * dpr, 300 * dpr, 64 * dpr, 10 * dpr); c.fill();
    c.fillStyle = '#2e2a3a'; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.font = `bold ${22 * dpr}px ${JP}`; c.fillText(STRINGS.map.title, 30 * dpr, 38 * dpr);
    c.font = `${13 * dpr}px ${JP}`; c.fillStyle = '#5a5468'; c.fillText(STRINGS.map.titleJp + '  ·  ' + STRINGS.map.close, 30 * dpr, 62 * dpr);
    c.fillStyle = '#c0392b'; c.font = `bold ${26 * dpr}px ${JP}`; c.textAlign = 'center';
    c.fillText('北 ↑', W - 50 * dpr, 44 * dpr);
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
