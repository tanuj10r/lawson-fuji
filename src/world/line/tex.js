import * as THREE from 'three';
import { STATION, LINE, TAXI } from '../../data/town.js';
import { JP } from '../kit/tex.js';

/* ------------------------------------------------------------------ *
 * Canvas2D art for the station and the train (AGENTS.md: drawn in code).
 * Every name comes from data/town.js.
 * ------------------------------------------------------------------ */

const cache = new Map();
function tex(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

function fit(c, str, x, y, maxW, size, color, { weight = 'bold', align = 'center' } = {}) {
  let s = size;
  do {
    c.font = `${weight} ${s}px ${JP}`;
    if (c.measureText(str).width <= maxW) break;
    s -= 1;
  } while (s > 6);
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(str, x, y);
}

const NAVY = '#1f3f7a', GREEN = '#2f7a4a', CREAM = '#f7f2e4', INK = '#23222c';
const here = LINE.stations.findIndex((s) => s.jp === STATION.jp);
const prev = LINE.stations[here - 1], next = LINE.stations[here + 1];

/** The destination board on the train's cab end. */
export const destTex = (dir) =>
  tex('dest' + dir, 512, 128, (c, w, h) => {
    const d = LINE.dest[dir];
    c.fillStyle = '#1b2030'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f2e6b0'; c.fillRect(10, 22, 110, 84);
    fit(c, d.kind, 65, 64, 96, 56, '#1b2030');
    fit(c, d.jp, w * 0.62, h / 2, w * 0.55, 78, '#f2e6b0');
  });

/** 駅名標: the station's name, the line colour band, the neighbours. */
export const nameBoardTex = () =>
  tex('nameBoard', 1024, 320, (c, w, h) => {
    c.fillStyle = CREAM; c.fillRect(0, 0, w, h);
    c.fillStyle = GREEN; c.fillRect(0, h * 0.62, w, 26);
    fit(c, STATION.jp, w / 2, h * 0.3, w * 0.6, 120, INK);
    fit(c, STATION.en, w / 2, h * 0.52, w * 0.5, 34, '#5a5a66', { weight: '600' });
    if (prev) { fit(c, `← ${prev.jp}`, 30, h * 0.82, w * 0.4, 44, INK, { align: 'left' }); fit(c, prev.en, 30, h * 0.94, w * 0.4, 20, '#6a6a74', { align: 'left', weight: '600' }); }
    if (next) { fit(c, `${next.jp} →`, w - 30, h * 0.82, w * 0.4, 44, INK, { align: 'right' }); fit(c, next.en, w - 30, h * 0.94, w * 0.4, 20, '#6a6a74', { align: 'right', weight: '600' }); }
  });

/** The station's name over the entrance. */
export const entranceTex = () =>
  tex('entrance', 1024, 256, (c, w, h) => {
    c.fillStyle = CREAM; c.fillRect(0, 0, w, h);
    c.fillStyle = GREEN; c.fillRect(0, 0, w, 22); c.fillRect(0, h - 22, w, 22);
    fit(c, `${STATION.jp}駅`, w * 0.42, h * 0.5, w * 0.62, 150, INK);
    fit(c, STATION.en, w * 0.83, h * 0.42, w * 0.3, 36, '#5a5a66', { weight: '600' });
    fit(c, LINE.name, w * 0.83, h * 0.66, w * 0.3, 32, GREEN);
  });

export const platformNumberTex = (n) =>
  tex('platNo' + n, 256, 256, (c, w, h) => {
    c.fillStyle = NAVY; c.fillRect(0, 0, w, h);
    c.fillStyle = CREAM; c.beginPath(); c.arc(w / 2, h * 0.42, 80, 0, Math.PI * 2); c.fill();
    fit(c, String(n), w / 2, h * 0.44, 120, 130, NAVY);
    fit(c, n === 1 ? `${LINE.dest.east.jp} 方面` : `${LINE.dest.west.jp} 方面`, w / 2, h * 0.86, w - 20, 34, CREAM);
  });

/** 改札口 sign over the gates, with the platforms and where they go. */
export const gateSignTex = () =>
  tex('gateSign', 1024, 192, (c, w, h) => {
    c.fillStyle = NAVY; c.fillRect(0, 0, w, h);
    fit(c, '改札口', w * 0.14, h * 0.46, w * 0.24, 80, CREAM);
    fit(c, 'Ticket Gate', w * 0.14, h * 0.82, w * 0.24, 24, '#c8d2e8', { weight: '600' });
    for (const [n, x, d] of [[1, 0.44, LINE.dest.east], [2, 0.76, LINE.dest.west]]) {
      c.fillStyle = CREAM; c.beginPath(); c.arc(w * x - 110, h / 2, 34, 0, Math.PI * 2); c.fill();
      fit(c, String(n), w * x - 110, h / 2 + 2, 50, 50, NAVY);
      fit(c, `${d.jp} 方面`, w * x + 20, h * 0.42, w * 0.22, 48, CREAM);
      fit(c, `for ${d.en}`, w * x + 20, h * 0.76, w * 0.22, 24, '#c8d2e8', { weight: '600' });
    }
  });

/** The fare map over the ticket machines: the line, fares from here. */
export const fareMapTex = () =>
  tex('fareMap', 1024, 384, (c, w, h) => {
    c.fillStyle = '#fbf8f0'; c.fillRect(0, 0, w, h);
    fit(c, `${LINE.name}  きっぷうりば  運賃表`, w / 2, 40, w - 60, 38, INK);
    const y = h * 0.56, x0 = 90, x1 = w - 90;
    c.fillStyle = GREEN; c.fillRect(x0, y - 7, x1 - x0, 14);
    LINE.stations.forEach((s, i) => {
      const x = x0 + ((x1 - x0) * i) / (LINE.stations.length - 1);
      const me = i === here;
      c.fillStyle = me ? '#d8302c' : CREAM; c.strokeStyle = GREEN; c.lineWidth = 6;
      c.beginPath(); c.arc(x, y, me ? 22 : 16, 0, Math.PI * 2); c.fill(); c.stroke();
      fit(c, s.jp, x, y - 58, 150, 34, me ? '#d8302c' : INK);
      fit(c, me ? '現在地' : `${s.fare}`, x, y + 56, 140, 36, me ? '#d8302c' : NAVY);
    });
    fit(c, 'おとな の 運賃（円）  こども は 半額', w / 2, h - 30, w - 80, 24, '#6a6a74', { weight: '600' });
  });

/** A ticket machine's touch screen. */
export const machineScreenTex = () =>
  tex('machineScreen', 256, 192, (c, w, h) => {
    c.fillStyle = '#e8f0fa'; c.fillRect(0, 0, w, h);
    c.fillStyle = NAVY; c.fillRect(0, 0, w, 34);
    fit(c, 'きっぷ ・ チャージ', w / 2, 18, w - 20, 20, CREAM);
    const fares = [160, 180, 230, 310, 520, 'IC'];
    fares.forEach((f, i) => {
      const x = 14 + (i % 3) * 78, y = 46 + Math.floor(i / 3) * 70;
      c.fillStyle = typeof f === 'string' ? '#f2c23c' : '#ffffff'; c.fillRect(x, y, 70, 60);
      c.strokeStyle = '#8fa4c8'; c.lineWidth = 2; c.strokeRect(x, y, 70, 60);
      fit(c, String(f), x + 35, y + 30, 60, 26, INK);
    });
  });

/** 窓口 over the staffed window. */
export const windowSignTex = () =>
  tex('windowSign', 512, 128, (c, w, h) => {
    c.fillStyle = CREAM; c.fillRect(0, 0, w, h);
    c.fillStyle = NAVY; c.fillRect(0, 0, 14, h);
    fit(c, '駅務室  窓口', w / 2 + 6, h * 0.42, w - 60, 54, INK);
    fit(c, 'きっぷ ・ 定期券 ・ おわすれもの', w / 2 + 6, h * 0.8, w - 60, 22, '#6a6a74', { weight: '600' });
  });

/** 時刻表: departures by hour, both ways. */
export const timetableTex = () =>
  tex('timetable', 512, 640, (c, w, h) => {
    c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, h);
    c.fillStyle = NAVY; c.fillRect(0, 0, w, 70);
    fit(c, `${STATION.jp}  時刻表`, w / 2, 36, w - 40, 38, CREAM);
    for (const [col, d] of [[0, LINE.dest.east], [1, LINE.dest.west]]) {
      fit(c, `${d.jp} 方面`, w * (0.3 + col * 0.44), 96, w * 0.4, 26, NAVY);
    }
    for (let hr = 6; hr <= 23; hr++) {
      const y = 126 + (hr - 6) * 29;
      c.fillStyle = hr % 2 ? '#f2f0ea' : '#fbfaf6'; c.fillRect(0, y - 14, w, 29);
      fit(c, String(hr), 30, y, 40, 20, INK);
      for (const col of [0, 1]) {
        const mins = [(hr * 7 + col * 3) % 12, 20 + ((hr * 3 + col) % 10), 40 + ((hr * 5 + col * 7) % 12)];
        fit(c, mins.map((m) => String(m).padStart(2, '0')).join('  '), w * (0.3 + col * 0.44), y, w * 0.38, 20, INK, { weight: '500' });
      }
    }
  });

/** The analogue clock face (hands are geometry). */
export const clockFaceTex = () =>
  tex('clockFace', 256, 256, (c, w, h) => {
    c.fillStyle = '#fbfaf6'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); c.fill();
    c.strokeStyle = INK; c.lineWidth = 8; c.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, r0 = i % 5 ? 104 : 92;
      c.lineWidth = i % 5 ? 3 : 8;
      c.beginPath(); c.moveTo(w / 2 + Math.sin(a) * r0, h / 2 - Math.cos(a) * r0); c.lineTo(w / 2 + Math.sin(a) * 114, h / 2 - Math.cos(a) * 114); c.stroke();
    }
  });

/** 周辺案内図: the town round the station, as a simple coloured map. */
export const areaMapTex = () =>
  tex('areaMap', 768, 512, (c, w, h) => {
    c.fillStyle = '#eef2e6'; c.fillRect(0, 0, w, h);
    c.fillStyle = NAVY; c.fillRect(0, 0, w, 60);
    fit(c, `${STATION.jp}駅  周辺案内図`, w / 2, 32, w - 40, 34, CREAM);
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) c.fillRect(80 + i * 140, 70, 16, h - 110);
    for (let j = 0; j < 4; j++) c.fillRect(20, 110 + j * 95, w - 40, 14);
    c.fillStyle = '#f2e6a0'; c.fillRect(150, 70, 26, h - 110);                  // the spine
    c.fillStyle = GREEN; c.fillRect(20, h - 44, w - 40, 12);                     // the line
    c.fillStyle = '#d8302c'; c.beginPath(); c.arc(163, h - 60, 12, 0, Math.PI * 2); c.fill();
    fit(c, '現在地', 210, h - 62, 90, 24, '#d8302c');
    const pins = [['コンビニ', 380, 96], ['富士見稲荷', 420, 250], ['ちびっこ広場', 460, 360], ['商店街', 168, 200]];
    for (const [t, x, y] of pins) { c.fillStyle = '#2458b8'; c.fillRect(x - 6, y - 6, 12, 12); fit(c, t, x + 60, y, 110, 20, INK, { align: 'center' }); }
  });

/** Station posters: a festival, a hiking line, manners. */
export const posterTex = (v) =>
  tex('stPoster' + v, 256, 360, (c, w, h) => {
    const sets = [
      { bg: '#f7d8e2', fg: '#8a2f4a', t: '富士見 桜まつり', s: '4月上旬  駅前ひろば' },
      { bg: '#d8ecf6', fg: '#1f4f7a', t: '富士山麓 ハイキング', s: `${LINE.name}で いこう` },
      { bg: '#f6f0d8', fg: '#6a4a1a', t: 'かけこみ乗車は', s: 'おやめください' },
      { bg: '#e2f2dc', fg: '#2f5a2a', t: 'のりば ご案内', s: `1番線 ${LINE.dest.east.jp} ・ 2番線 ${LINE.dest.west.jp}` },
    ];
    const st = sets[v % sets.length];
    c.fillStyle = st.bg; c.fillRect(0, 0, w, h);
    c.fillStyle = st.fg; c.fillRect(0, h - 70, w, 70);
    c.beginPath(); c.arc(w / 2, h * 0.38, 70, 0, Math.PI * 2); c.globalAlpha = 0.25; c.fill(); c.globalAlpha = 1;
    fit(c, st.t, w / 2, h * 0.14, w - 24, 34, st.fg);
    fit(c, st.s, w / 2, h - 35, w - 20, 22, '#ffffff');
  });

export const taxiSignTex = () =>
  tex('taxiSign', 256, 96, (c, w, h) => {
    c.fillStyle = '#f5c428'; c.fillRect(0, 0, w, h);
    fit(c, TAXI, w / 2, h * 0.5, w - 20, 40, INK);
  });

/**
 * The departure board (発車標): a live canvas, redrawn when the service
 * changes.  rows: [{ time, kind, dest, track }]
 */
export function makeDepartureBoard(w = 768, h = 256) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  let last = '';
  return {
    texture: t,
    draw(rows) {
      const key = JSON.stringify(rows);
      if (key === last) return;
      last = key;
      c.fillStyle = '#14161e'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#24283a'; c.fillRect(0, 0, w, 50);
      fit(c, '発車時刻  Departures', w / 2, 26, w - 40, 26, '#c8d2e8', { weight: '600' });
      rows.slice(0, 2).forEach((r, i) => {
        const y = 94 + i * 80;
        fit(c, r.kind, 70, y, 100, 36, '#6ee08a');
        fit(c, r.time, 220, y, 150, 44, '#ffd560');
        fit(c, r.dest, 440, y, 230, 44, '#ffd560');
        fit(c, `${r.track}番線`, 660, y, 150, 34, '#f2f2f2');
      });
      t.needsUpdate = true;
    },
  };
}

/** A plain label: a word on a coloured plate (待合室, お手洗い, 交番). */
export const labelTex = (text, bg = CREAM, fg = INK, sub = '') =>
  tex(`label|${text}|${bg}|${fg}|${sub}`, 512, 160, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    fit(c, text, w / 2, sub ? h * 0.4 : h / 2, w - 40, 84, fg);
    if (sub) fit(c, sub, w / 2, h * 0.8, w - 40, 26, fg, { weight: '600' });
  });
