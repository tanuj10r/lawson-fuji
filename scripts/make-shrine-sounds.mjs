/* The shrine's two short sounds, made in code (experience 3):
 *
 *   shrine-clap   one hand clap (柏手) in an open courtyard: a sharp,
 *                 mid-bright burst, a body thump, two soft reflections
 *   shrine-bell   the bell cluster (鈴) shaken on its rope: three small
 *                 pellet bells, inharmonic partials, struck again and again
 *                 as the rope swings, dying away
 *
 *   node scripts/make-shrine-sounds.mjs      -> assets/audio/shrine-*.wav
 *   npm run audio                            (encodes them with the rest)
 *
 * The files are sources like any other in assets/audio/ (never committed);
 * the game falls back to its procedural recipes when they are missing.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'assets', 'audio');
const SR = 44100;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function writeWav(file, x) {
  const n = x.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  let pk = 0;
  for (const v of x) pk = Math.max(pk, Math.abs(v));
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round((x[i] / pk) * 0.9 * 32767), 44 + i * 2);
  fs.writeFileSync(file, b);
}

/** A two-pole band-pass (RBJ) over a signal. */
function bandpass(x, f, q) {
  const w = (2 * Math.PI * f) / SR, al = Math.sin(w) / (2 * q), c = Math.cos(w);
  const b0 = al, b2 = -al, a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

function clap() {
  const r = rng(11);
  const n = Math.round(SR * 0.6), x = new Float32Array(n);
  const noise = new Float32Array(n).map(() => r() * 2 - 1);
  // the slap: two quick bursts a few ms apart (the palms meet unevenly)
  const burst = new Float32Array(n);
  for (const [t0, a, tau] of [[0, 1, 0.009], [0.004, 0.7, 0.022]]) {
    const i0 = Math.round(t0 * SR);
    for (let i = i0; i < n; i++) burst[i] += noise[i] * a * Math.exp(-(i - i0) / (tau * SR));
  }
  const bright = bandpass(burst, 1500, 0.9), air = bandpass(burst, 3600, 1.2);
  for (let i = 0; i < n; i++) x[i] = bright[i] + 0.45 * air[i];
  // the body: a short low thump
  for (let i = 0; i < SR * 0.05; i++) x[i] += 0.35 * Math.sin((2 * Math.PI * 210 * i) / SR) * Math.exp(-i / (0.012 * SR));
  // the courtyard: two soft, darker reflections and a little tail
  const refl = bandpass(x, 1100, 0.7);
  for (const [d, g] of [[0.043, 0.28], [0.078, 0.16], [0.12, 0.08]]) {
    const k = Math.round(d * SR);
    for (let i = n - 1; i >= k; i--) x[i] += refl[i - k] * g;
  }
  return x;
}

function bell() {
  const r = rng(29);
  const n = Math.round(SR * 2.4), x = new Float32Array(n);
  // three bells, each with a few inharmonic partials (a small brass suzu)
  const bells = [
    { f: [2680, 4490, 6320, 8150], d: [0.55, 0.34, 0.22, 0.14], a: [1, 0.55, 0.32, 0.18] },
    { f: [3110, 5240, 7410], d: [0.45, 0.28, 0.18], a: [0.8, 0.45, 0.22] },
    { f: [2310, 3930, 5610, 7300], d: [0.6, 0.36, 0.24, 0.15], a: [0.9, 0.5, 0.3, 0.16] },
  ];
  // the strikes: the rope is shaken, the pellets rattle, thinning as it swings down
  const strikes = [];
  let t = 0.005;
  while (t < 1.25) {
    const k = Math.exp(-t / 0.55);
    strikes.push({ t, b: Math.floor(r() * 3), a: (0.35 + 0.65 * r()) * k });
    if (r() < 0.3) strikes.push({ t: t + 0.008 + r() * 0.01, b: Math.floor(r() * 3), a: 0.5 * k * r() });
    t += 0.022 + r() * 0.05 + (1 - k) * 0.06;
  }
  for (const s of strikes) {
    const B = bells[s.b], i0 = Math.round(s.t * SR);
    const ph = B.f.map(() => r() * Math.PI * 2);
    for (let p = 0; p < B.f.length; p++) {
      const w = (2 * Math.PI * B.f[p] * (1 + (r() - 0.5) * 0.004)) / SR, tau = B.d[p] * SR, a = B.a[p] * s.a;
      const end = Math.min(n, i0 + Math.round(tau * 6));
      for (let i = i0; i < end; i++) x[i] += a * Math.sin(w * (i - i0) + ph[p]) * Math.exp(-(i - i0) / tau);
    }
    // the pellet's tick
    for (let i = i0; i < Math.min(n, i0 + 300); i++) x[i] += 0.12 * s.a * (r() * 2 - 1) * Math.exp(-(i - i0) / 60);
  }
  // soften the very top a touch (a one-pole low-pass)
  let y = 0;
  for (let i = 0; i < n; i++) { y += 0.55 * (x[i] - y); x[i] = y; }
  return x;
}

fs.mkdirSync(OUT, { recursive: true });
writeWav(path.join(OUT, 'shrine-clap.wav'), clap());
writeWav(path.join(OUT, 'shrine-bell.wav'), bell());
console.log('wrote assets/audio/shrine-clap.wav, shrine-bell.wav');
