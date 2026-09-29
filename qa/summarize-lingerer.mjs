// Summarise qa/artifacts/04-lingerer/samples.json: heap, DOM, GL and audio trends over the session.
import fs from 'node:fs';
import path from 'node:path';
import { ART } from './lib.mjs';

const { samples, events } = JSON.parse(fs.readFileSync(path.join(ART, '04-lingerer', 'samples.json'), 'utf8'));
const play = samples.filter((s) => !['card'].includes(s.label));
const col = (k) => play.map((s) => s[k]).filter((v) => typeof v === 'number');
const stat = (a) => ({ min: Math.min(...a), max: Math.max(...a), first: a[0], last: a[a.length - 1] });
const half = Math.floor(play.length / 2);
const mean = (a) => +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
const out = {
  minutes: +((play[play.length - 1].t - play[0].t) / 60).toFixed(1),
  samples: play.length,
  heapMB: stat(col('heapMB')),
  heapFirstHalfMean: mean(col('heapMB').slice(0, half)), heapSecondHalfMean: mean(col('heapMB').slice(half)),
  nodes: stat(col('nodes')),
  fps: { ...stat(col('fps')), firstHalfMean: mean(col('fps').slice(0, half)), secondHalfMean: mean(col('fps').slice(half)) },
  geometries: stat(play.map((s) => s.gl.geometries)), textures: stat(play.map((s) => s.gl.textures)), programs: stat(play.map((s) => s.gl.programs)),
  audioLive: stat(play.map((s) => s.audio.live)), audioPeak: Math.max(...play.map((s) => s.audio.peak)), oscPeak: Math.max(...play.map((s) => s.audio.oscPeak)), voicesMax: Math.max(...play.map((s) => s.audio.voices)),
  labelled: samples.filter((s) => s.label).map((s) => ({ label: s.label, t: s.t, heapMB: s.heapMB, nodes: s.nodes, gl: s.gl, fps: s.fps })),
  tour: events.filter((e) => ['target', 'stall', 'konbini', 'bench', 'pressed E at'].includes(e.k)).map((e) => `${Math.round(e.t)}s ${e.k} ${typeof e.v === 'string' ? e.v : JSON.stringify(e.v)}`),
  pauses: events.filter((e) => e.k === 'paused 8 s').map((e) => e.v),
};
fs.writeFileSync(path.join(ART, '04-lingerer', 'summary.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
