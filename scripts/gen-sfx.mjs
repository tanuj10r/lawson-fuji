/* The konbini's small sounds, synthesised (Tan's konbini): the scanner's
 * beep, and eating -- a bite, munching, a gulp, a can popping, a wrapper.
 *
 *   node scripts/gen-sfx.mjs        then   npm run audio
 *
 * Writes assets/audio/<name>.wav (never committed) and their cuts in
 * scripts/audio-cuts.json.  Seeded, so every run makes the same files.
 * Without them the engine plays its nearest recipe (store/shop.js says which).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'assets', 'audio');
const SR = 44100;

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const noise = () => rnd() * 2 - 1;
/** A one-pole filter state: lowpass `lp(x, k)` (k 0..1), highpass as x - lowpass. */
const pole = () => { let y = 0; return (x, k) => (y += k * (x - y)); };
const kOf = (hz) => 1 - Math.exp((-2 * Math.PI * hz) / SR);

function buf(sec) { return new Float32Array(Math.round(sec * SR)); }
/** Add a band of noise from t0 lasting `dur`, between lo and hi Hz, decaying. */
function band(y, t0, dur, lo, hi, level, { attack = 0.002, curve = 3 } = {}) {
  const a = pole(), b = pole(), i0 = Math.round(t0 * SR), n = Math.round(dur * SR);
  for (let i = 0; i < n && i0 + i < y.length; i++) {
    const x = noise(), l = a(x, kOf(hi)), bp = l - b(l, kOf(lo));
    const t = i / n, env = Math.min(1, i / (attack * SR)) * (1 - t) ** curve;
    y[i0 + i] += bp * env * level;
  }
}
/** A tone from f0 to f1 Hz. */
function tone(y, t0, dur, f0, f1, level, { attack = 0.003, curve = 2, square = 0 } = {}) {
  const i0 = Math.round(t0 * SR), n = Math.round(dur * SR);
  let ph = 0;
  for (let i = 0; i < n && i0 + i < y.length; i++) {
    const t = i / n, f = f0 + (f1 - f0) * t;
    ph += (2 * Math.PI * f) / SR;
    const s = Math.sin(ph), sq = Math.tanh(s * 4) * 0.8;
    const env = Math.min(1, i / (attack * SR)) * (1 - t) ** curve;
    y[i0 + i] += (s * (1 - square) + sq * square) * env * level;
  }
}

const SOUNDS = {
  // the scanner: one bright "pi", a little squared off like a real one
  'till-beep': () => { const y = buf(0.2); tone(y, 0.005, 0.13, 2750, 2750, 0.6, { attack: 0.002, curve: 0.4, square: 0.35 }); return y; },
  // a bite: the crisp break of bread or wafer, and the jaw closing
  bite: () => {
    const y = buf(0.28);
    for (let k = 0; k < 7; k++) band(y, 0.004 + rnd() * 0.05, 0.03 + rnd() * 0.03, 1500, 5200, 0.5 + rnd() * 0.3, { curve: 4 });
    band(y, 0.0, 0.12, 300, 1400, 0.5, { curve: 2 });
    tone(y, 0.045, 0.07, 140, 90, 0.35);
    return y;
  },
  // munching: three soft chews, mouth closed
  munch: () => {
    const y = buf(0.62);
    for (let k = 0; k < 3; k++) {
      const t = 0.02 + k * 0.19 + rnd() * 0.02;
      band(y, t, 0.13, 180, 900, 0.8, { attack: 0.02, curve: 2 });
      band(y, t + 0.02, 0.05, 1200, 3000, 0.18, { curve: 4 });
    }
    return y;
  },
  // a gulp: a quick falling "glk" and the swallow under it
  gulp: () => {
    const y = buf(0.36);
    tone(y, 0.0, 0.16, 520, 170, 0.55, { attack: 0.01, curve: 1.5 });
    band(y, 0.0, 0.05, 600, 2400, 0.25, { curve: 3 });
    tone(y, 0.14, 0.18, 240, 110, 0.35, { attack: 0.02, curve: 2 });
    return y;
  },
  // a can popping: the tab's click, then the fizz
  'can-open': () => {
    const y = buf(0.65);
    band(y, 0.0, 0.012, 2000, 9000, 1.0, { attack: 0.0005, curve: 1 });
    tone(y, 0.0, 0.03, 1900, 1400, 0.3, { attack: 0.0005 });
    band(y, 0.01, 0.6, 4000, 11000, 0.55, { attack: 0.01, curve: 2.2 });
    return y;
  },
  // a wrapper coming off: plastic crinkles
  wrapper: () => {
    const y = buf(0.45);
    for (let k = 0; k < 26; k++) band(y, rnd() * 0.38, 0.012 + rnd() * 0.03, 2500, 7500, 0.25 + rnd() * 0.35, { curve: 3 });
    return y;
  },
};

function writeWav(file, y) {
  let pk = 0;
  for (const v of y) pk = Math.max(pk, Math.abs(v));
  const g = pk > 0 ? 0.9 / pk : 1;
  const b = Buffer.alloc(44 + y.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + y.length * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(y.length * 2, 40);
  y.forEach((v, i) => b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * g * 32767))), 44 + i * 2));
  fs.writeFileSync(file, b);
}

fs.mkdirSync(OUT, { recursive: true });
const { files } = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'audio-cuts.json'), 'utf8'));
const missing = [];
for (const [name, make] of Object.entries(SOUNDS)) {
  const y = make();
  writeWav(path.join(OUT, name + '.wav'), y);
  if (!files[name]) missing.push(name);
  console.log(`  ${name.padEnd(12)} ${(y.length / SR).toFixed(2)} s`);
}
console.log(`${Object.keys(SOUNDS).length} sounds in ${path.relative(ROOT, OUT)}/; now npm run audio`);
if (missing.length) console.log(`MISSING in scripts/audio-cuts.json: ${missing.join(', ')}`);
