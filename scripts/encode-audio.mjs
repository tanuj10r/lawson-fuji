/* ------------------------------------------------------------------ *
 * npm run audio (M4): assets/audio/*.mp3 -> public/audio/*.m4a
 *
 * Cut, loop, level and encode each sound for the web, as scripts/
 * audio-cuts.json says, and write public/audio/manifest.json (each file's
 * length and loop).  Uses macOS's built-in afconvert, nothing to install:
 * it decodes to 16-bit mono WAV, this script cuts it, and afconvert
 * encodes AAC.  Neither folder is ever committed (AGENTS.md).
 * Fails if the whole set passes 3 MB (SPEC M4: 2-3 MB).
 * ------------------------------------------------------------------ */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = path.join(ROOT, 'assets/audio'), OUT = path.join(ROOT, 'public/audio');
const BUDGET = 4.5 * 1024 * 1024, SR = 44100;   // 3 MB until Tan's experiences (2026-09-28)
const { files } = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/audio-cuts.json'), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-'));
fs.mkdirSync(OUT, { recursive: true });

function readWav(file) {
  const b = fs.readFileSync(file);
  let o = 12;
  while (o < b.length) {
    const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4);
    if (id === 'data') {
      const s = new Int16Array(b.buffer.slice(b.byteOffset + o + 8, b.byteOffset + o + 8 + n));
      return Float32Array.from(s, (v) => v / 32768);
    }
    o += 8 + n + (n & 1);
  }
  throw new Error('no data chunk in ' + file);
}
function writeWav(file, x, ch = 1) {
  const n = x.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2 * ch, 28); b.writeUInt16LE(2 * ch, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(file, b);
}
/** Level per 20 ms window. */
function envelope(x, win = Math.round(SR * 0.02)) {
  const r = [];
  for (let i = 0; i + win <= x.length; i += win) { let a = 0; for (let k = 0; k < win; k++) a += x[i + k] ** 2; r.push(Math.sqrt(a / win)); }
  return r;
}
/** The bell's period (s), from the envelope's autocorrelation between 0.2 and 1.2 s. */
function period(x) {
  const r = envelope(x.subarray(0, SR * 6), Math.round(SR * 0.005)), m = r.reduce((a, b) => a + b) / r.length;
  const d = r.map((v) => v - m);
  let best = 0, lag = 0;
  for (let L = 40; L < 240; L++) { let s = 0; for (let i = 0; i + L < d.length; i++) s += d[i] * d[i + L]; if (s > best) { best = s; lag = L; } }
  return lag * 0.005;
}

const manifest = {};
let total = 0;
const rows = [];
for (const [name, c] of Object.entries(files)) {
  const mp3 = path.join(SRC, (c.src ?? name) + (c.ext ?? '.mp3'));     // `src`: the file it is cut from, if not its own name; `ext`: .aiff for voices made with `say`
  if (!fs.existsSync(mp3)) { rows.push([name, 'missing (the procedural sound is used)']); continue; }
  /* `song`: a piece of music played whole (the theme): kept in stereo, no cut or levelling, only re-encoded */
  if (c.song) {
    const m4a = path.join(OUT, name + '.m4a');
    /* `len`: only this much of it, from `start` (s), stereo; `fadeOut` s at the end, so the loop comes back round to
     * the opening cleanly (a crossfade would blur the cut's loud bar into the quiet intro) */
    let src = mp3;
    if (c.len) {
      const wav = path.join(tmp, name + '-st.wav');
      execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEI16@${SR}`, '-c', '2', mp3, wav]);
      const x = readWav(wav), s0 = Math.round((c.start ?? 0) * SR) * 2, n = Math.min(x.length - s0, Math.round(c.len * SR) * 2);
      const y = x.slice(s0, s0 + n), fr = n / 2, fi = Math.round(0.01 * SR), fo = Math.round((c.fadeOut ?? 2) * SR);
      for (let f = 0; f < fr; f++) {
        const k = Math.min(1, f / fi, (fr - 1 - f) / fo);
        const e = k < 1 && f > fi ? k * k * (3 - 2 * k) : k;       // a smooth fade out
        y[2 * f] *= e; y[2 * f + 1] *= e;
      }
      src = path.join(tmp, name + '-cut.wav');
      writeWav(src, y, 2);
    }
    // HE-AAC (`aach`) for a song: half the bytes of plain AAC for music at the same ear (every desktop browser plays it)
    execFileSync('afconvert', ['-f', 'm4af', '-d', c.he ? 'aach' : 'aac', '-b', String((c.kbps ?? 96) * 1000), ...(c.he ? [] : ['-q', '127']), src, m4a]);
    const info = execFileSync('afinfo', [m4a]).toString();
    const dur = +(info.match(/estimated duration: ([0-9.]+)/)?.[1] ?? 0);
    const size = fs.statSync(m4a).size;
    total += size;
    manifest[name] = { file: name + '.m4a', duration: +dur.toFixed(2), loop: true, song: true };
    rows.push([name, `${dur.toFixed(1)} s song, stereo${c.he ? ' HE-AAC' : ''} ${c.kbps ?? 96} kbps  ${(size / 1024).toFixed(1)} KB`]);
    continue;
  }
  const wav = path.join(tmp, name + '.wav');
  execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEI16@${SR}`, '-c', '1', mp3, wav]);
  const x = readWav(wav), dur = x.length / SR;
  const start = c.start ?? 0;
  let xf = typeof c.loop === 'number' ? c.loop : c.loop ? 0.05 : 0;
  let len = c.len || dur - start - xf;
  if (c.loop === 'period') { const p = period(x.subarray(Math.round(start * SR))); len = Math.max(1, Math.round(c.len / p)) * p; xf = 0.03; }
  len = Math.min(len, dur - start - xf);
  const n = Math.round(len * SR), s0 = Math.round(start * SR), nx = Math.round(xf * SR);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = x[s0 + i];
  // a loop: the tail past the end crossfades into the head, so it repeats seamlessly
  for (let i = 0; i < nx; i++) { const t = i / nx; y[i] = y[i] * t + x[s0 + n + i] * (1 - t); }
  /* `keep`: only these stretches of the source (seconds, absolute) sound;
   * the rest is silenced with short fades.  It splits one recording of a
   * junction calling to itself into its two separate calls. */
  if (c.keep) {
    const fade = Math.round(0.02 * SR);
    const on = new Float32Array(n);
    for (const [a0, b0] of c.keep) {
      const i0 = Math.max(0, Math.round((a0 - start) * SR)), i1 = Math.min(n, Math.round((b0 - start) * SR));
      for (let i = i0; i < i1; i++) on[i] = 1;
      for (let k = 0; k < fade; k++) {
        if (i0 + k < n) on[i0 + k] = Math.max(on[i0 + k] * (k / fade), k / fade * (i0 + k < i1 ? 1 : 0));
        if (i1 - 1 - k >= 0 && i1 - 1 - k >= i0) on[i1 - 1 - k] = Math.min(on[i1 - 1 - k], k / fade);
      }
    }
    for (let i = 0; i < n; i++) y[i] *= on[i];
  }
  // one-shots: a short fade in, and a fade out
  if (!c.loop) {
    const fi = Math.round(0.004 * SR), fo = Math.round((c.fadeOut ?? 0.05) * SR);
    for (let i = 0; i < fi && i < n; i++) y[i] *= i / fi;
    for (let i = 0; i < fo && i < n; i++) y[n - 1 - i] *= i / fo;
  }
  let pk = 0, sq = 0;
  for (const v of y) { pk = Math.max(pk, Math.abs(v)); sq += v * v; }
  /* `rms`: level by loudness, not by the loudest transient, so a recording
   * whose peaks are much louder than its body still comes out audible; the
   * `peak` then only keeps it from clipping. */
  const g = pk <= 0 ? 1
    : c.rms ? Math.min(c.rms / Math.sqrt(sq / n), (c.peak ?? 0.95) / pk)
      : (c.peak ?? 0.8) / pk;
  for (let i = 0; i < n; i++) y[i] *= g;
  const cut = path.join(tmp, name + '-cut.wav'), m4a = path.join(OUT, name + '.m4a');
  writeWav(cut, y);
  execFileSync('afconvert', ['-f', 'm4af', '-d', c.he ? 'aach' : 'aac', '-b', String((c.kbps ?? 40) * 1000), ...(c.he ? [] : ['-q', '127']), cut, m4a]);   // `he`: HE-AAC, for long music
  const size = fs.statSync(m4a).size;
  total += size;
  manifest[name] = { file: name + '.m4a', duration: +len.toFixed(4), loop: !!c.loop };
  rows.push([name, `${len.toFixed(2)} s${c.loop ? ' loop' : ''}  ${(size / 1024).toFixed(1)} KB  (from ${dur.toFixed(1)} s, gain ${g.toFixed(2)}, rms ${(Math.sqrt(sq / n) * g).toFixed(3)})`]);
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
// files from earlier cuts that are no longer made
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.m4a') && !Object.values(manifest).some((m) => m.file === f)) fs.rmSync(path.join(OUT, f));
fs.rmSync(tmp, { recursive: true, force: true });

for (const [n, r] of rows) console.log(`  ${n.padEnd(16)} ${r}`);
const ok = total <= BUDGET;
console.log(`AUDIO ${(total / 1024 / 1024).toFixed(2)} MB in ${Object.keys(manifest).length} files, budget 4.5 MB: ${ok ? 'pass' : 'FAIL'}`);
if (!ok) process.exitCode = 1;
