/* ------------------------------------------------------------------ *
 * The sound of the town and the store (M4; SPEC section 9).
 *
 * One AudioContext, made on the first click (browsers start no audio
 * before a gesture).  The graph:
 *
 *   sfx bus  ──┬─────────────────────────▶ master ─▶ compressor ─▶ out
 *              └─▶ reverb (made in code) ──┘
 *   outdoor  ───▶ lowpass ─▶ gain ────────▶ master     (muffled indoors)
 *   indoor   ───▶ gain ───────────────────▶ master     (hum, fridge; up indoors)
 *   music    ───▶ gain ───────────────────▶ master     (the store's music)
 *
 * Files are public/audio/*.m4a (npm run audio), fetched after the game has
 * started and decoded on first need; a missing one falls back to its
 * procedural recipe, so a fresh clone still makes every sound.
 *
 * Every placed sound is local (config.js SOUND): full within `near`, eased
 * to nothing at `far`, and not played at all beyond it.  Only the ambience
 * beds and the store's own music are heard wherever they apply.
 * ------------------------------------------------------------------ */

import { Vector3 } from 'three';
import { SOUND } from '../config.js';

/** 1 within `near`, easing to 0 at `far`. */
export function falloff(d, { near, far }) {
  if (d <= near) return 1;
  if (d >= far) return 0;
  const t = 1 - (d - near) / (far - near);
  return t * t * (3 - 2 * t);
}

// the beds, quiet (Tan: another 10-15% down, M4 review)
const BEDS = { wind: 0.14, birds: 0.26, crows: 0.23, 'night-insects': 0.21 };
const BED_OF_LOOK = { day: 'birds', golden: 'crows', blue: 'night-insects' };

export function createSound({ volume = 0.5 } = {}) {
  let ac = null, master, sfxBus, outBus, outLow, outGain, inGain, musicGain, reverb, wet;
  let manifest = {}, muted = volume <= 0.001, lastAudible = volume > 0.001 ? volume : 0.5;
  const buffers = new Map(), loading = new Map();
  const log = [];                    // dev: every sound started, for the audio check
  const now = () => ac.currentTime;
  const state = { inside: false, look: null, bells: false, music: false, lowpass: 20000 };
  const listener = { x: 0, y: 1.6, z: 0 };

  /* --------------------------- loading --------------------------- */
  let manifestReady = null;
  async function buffer(name) {
    if (buffers.has(name)) return buffers.get(name);
    await manifestReady;
    if (!manifest[name]) return null;
    if (!loading.has(name)) {
      loading.set(name, (async () => {
        try {
          const res = await fetch(import.meta.env.BASE_URL + 'audio/' + manifest[name].file);
          if (!res.ok) return null;
          const b = await ac.decodeAudioData(await res.arrayBuffer());
          buffers.set(name, b);
          return b;
        } catch { return null; }
      })());
    }
    return loading.get(name);
  }
  /** The loop's span inside a decoded buffer: AAC's encoder delay may pad the head. */
  function loopSpan(name, b) {
    const d = manifest[name]?.duration ?? b.duration;
    const pad = Math.min(2112 / b.sampleRate, Math.max(0, b.duration - d));
    return [pad, Math.min(b.duration, pad + d)];
  }

  /* ------------------------ the procedural sounds ------------------------ */
  const noiseBuf = () => {
    const n = ac.sampleRate, b = ac.createBuffer(1, n, n), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  };
  let noise = null;
  function tone(dest, freq, t, dur, { type = 'sine', level = 0.3, attack = 0.004 } = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function burst(dest, t, dur, { freq = 2000, q = 1, level = 0.3, type = 'bandpass' } = {}) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; s.loop = true;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  const RECIPES = {
    // an original phrase on a soft electric piano (SPEC 9), if the file is missing
    'store-chime'(d, t) { [659.3, 554.4, 440, 493.9, 659.3, 880].forEach((f, i) => { tone(d, f, t + i * 0.28, 1.2, { level: 0.22 }); tone(d, f * 2, t + i * 0.28, 0.6, { level: 0.06 }); }); },
    'auto-door'(d, t) { burst(d, t, 0.6, { freq: 900, q: 0.6, level: 0.12 }); tone(d, 60, t, 0.6, { level: 0.08 }); },
    'fridge-door'(d, t) { tone(d, 80, t, 0.08, { level: 0.35 }); burst(d, t + 0.02, 0.07, { freq: 1200, q: 2, level: 0.2 }); },
    'ui-tap'(d, t) { tone(d, 1200, t, 0.05, { level: 0.15 }); },
    stamp(d, t) { tone(d, 400, t, 0.06, { type: 'triangle', level: 0.3 }); },
    // taking and putting back, by what it is made of (catalog `sound`)
    plastic(d, t) { for (let i = 0; i < 4; i++) burst(d, t + i * 0.035 + Math.random() * 0.02, 0.05, { freq: 5000 + Math.random() * 2000, q: 1.5, level: 0.12 }); },
    soft(d, t) { burst(d, t, 0.12, { freq: 3500, q: 0.8, level: 0.1 }); burst(d, t + 0.06, 0.1, { freq: 4500, q: 1, level: 0.07 }); },
    can(d, t) { tone(d, 900, t, 0.12, { level: 0.14 }); tone(d, 2380, t, 0.08, { level: 0.05 }); },
    bottle(d, t) { tone(d, 300, t, 0.12, { level: 0.2 }); burst(d, t, 0.05, { freq: 900, q: 3, level: 0.08 }); },
    paper(d, t) { burst(d, t, 0.14, { freq: 1500, q: 0.5, level: 0.1, type: 'lowpass' }); },
    box(d, t) { tone(d, 180, t, 0.06, { level: 0.2 }); burst(d, t, 0.06, { freq: 1200, q: 0.7, level: 0.1 }); },
    basket(d, t) { for (let i = 0; i < 3; i++) { tone(d, 220 + i * 60, t + i * 0.05, 0.08, { type: 'triangle', level: 0.12 }); burst(d, t + i * 0.05, 0.05, { freq: 2600, q: 2, level: 0.08 }); } },
    refuse(d, t) { tone(d, 330, t, 0.16, { type: 'triangle', level: 0.16 }); tone(d, 247, t + 0.15, 0.22, { type: 'triangle', level: 0.16 }); },
    step(d, t, o = {}) {
      burst(d, t, o.inside ? 0.05 : 0.08, { freq: o.inside ? 2400 : 900, q: o.inside ? 1.2 : 0.7, level: o.inside ? 0.05 : 0.07 });
      tone(d, o.inside ? 140 : 90, t, 0.05, { level: 0.05 });
    },
  };

  /* ------------------------------ playing ------------------------------ */
  /**
   * A one-shot.  `file` the manifest name (else the recipe `recipe ?? file`);
   * `at` a world position (heard only inside its `range`), or none for a
   * sound at the listener; `bus` sfx (default) or outdoor.
   */
  /* Placed sounds that are still playing: their level follows the listener
   * as they move (walk out of the store and the chime fades behind you), and
   * one inside the store heard from outside comes through the glass,
   * muffled and quieter. */
  const voices = new Set();
  const voiceLevel = (v) => {
    const d = Math.hypot(v.at.x - listener.x, v.at.z - listener.z);
    const through = v.indoor && !state.inside;
    return { k: v.gain * falloff(d, v.range) * (through ? 0.4 : 1), f: through ? 1400 : 20000 };
  };
  function play(file, { at = null, range = null, recipe = null, gain = 1, rate = 1, bus = null, indoor = false, o = {} } = {}) {
    if (!ac || muted) return;
    const v = at && range ? { at, range, gain, indoor } : null;
    let k = gain, f = 20000;
    if (v) {
      if (Math.hypot(at.x - listener.x, at.z - listener.z) >= range.far) return;   // beyond its range it does not play at all
      ({ k, f } = voiceLevel(v));
    }
    const entry = { name: file ?? recipe, t: +now().toFixed(3), k: +k.toFixed(3) };
    if (!o._waited) log.push(entry);   // (a waited replay was logged when asked)
    const g = ac.createGain();
    g.gain.value = k;
    let dest = g;
    if (at) {
      const p = ac.createPanner();
      p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.rolloffFactor = 0;   // the level is ours (falloff)
      p.positionX.value = at.x; p.positionY.value = at.y ?? 1.2; p.positionZ.value = at.z;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f;
      g.connect(lp).connect(p); p.connect(bus ?? sfxBus);
      if (v) { v.g = g; v.lp = lp; voices.add(v); setTimeout(() => voices.delete(v), 8000); }
    } else g.connect(bus ?? sfxBus);
    const t = now() + 0.01;
    const b = file && buffers.get(file);
    if (b) {
      const s = ac.createBufferSource();
      s.buffer = b; s.playbackRate.value = rate;
      const [a] = loopSpan(file, b);
      s.connect(dest); s.start(t, a);
      if (o._waited) o._waited.src = 'file-late';        // it played once decoded, late
      else entry.src = 'file';
    } else if (file && manifest[file] && !recipe && !o._waited) {
      // not decoded yet: fetch it and play it then (a voice line or a track
      // must not become a tap the first time it is asked for)
      g.disconnect();
      entry.src = 'waiting';
      buffer(file).then((ok) => { if (ok) play(file, { at, range, recipe, gain, rate, bus, indoor, o: { ...o, _waited: entry } }); });
    } else {
      if (file && manifest[file]) buffer(file);            // next time
      entry.src = 'recipe';
      (RECIPES[recipe ?? file] ?? RECIPES['ui-tap'])(dest, t, o);
    }
  }

  /* ------------------------------ loops ------------------------------ */
  /**
   * A long loop that streams instead of being decoded (M4, the store's
   * music): an <audio> element through the graph, so the browser keeps only
   * a little of it in memory.  A decoded 5.6-minute track costs about 65 MB
   * of PCM; streamed it costs almost nothing.  Short loops stay decoded,
   * where a buffer's loop is seamless and a media element's is not.
   */
  function streamNode(name, dest, level) {
    const g = ac.createGain();
    g.gain.value = 0;
    g.connect(dest);
    const L = { name, g, level, on: false, el: null };
    L.arm = () => {                              // from the first click, so playback is allowed later
      if (L.el || !manifest[name]) return;
      L.el = new Audio(import.meta.env.BASE_URL + 'audio/' + manifest[name].file);
      L.el.loop = true;
      L.el.preload = 'none';
      L.el.crossOrigin = 'anonymous';
      ac.createMediaElementSource(L.el).connect(g);
    };
    L.set = (on, fade = 2) => {
      if (on === L.on) return;
      L.on = on;
      L.arm();
      if (!L.el) return;
      if (on) {
        L.el.play().then(() => log.push({ name, t: +now().toFixed(3), loop: true, stream: true }), () => {});
      } else {
        clearTimeout(L.stopT);
        L.stopT = setTimeout(() => { if (!L.on) L.el.pause(); }, fade * 1000 + 200);
      }
      g.gain.cancelScheduledValues(now());
      g.gain.setTargetAtTime(on ? L.level : 0, now(), fade / 4);
    };
    return L;
  }

  function loopNode(name, dest, level) {
    const g = ac.createGain();
    g.gain.value = 0;
    g.connect(dest);
    const L = { name, g, src: null, level, on: false };
    L.set = async (on, fade = 2) => {
      if (on === L.on) return;
      L.on = on;
      if (on && !L.src) {
        const b = await buffer(name);
        if (!b || !L.on || L.src) return;
        const s = ac.createBufferSource();
        s.buffer = b; s.loop = true;
        [s.loopStart, s.loopEnd] = loopSpan(name, b);
        s.connect(g); s.start(now(), s.loopStart + (L.offset ?? 0));
        L.src = s; L.started = now();
        log.push({ name, t: +now().toFixed(3), loop: true });
      }
      g.gain.cancelScheduledValues(now());
      g.gain.setTargetAtTime(on ? L.level : 0, now(), fade / 4);
      if (!on) {
        const s = L.src;
        clearTimeout(L.stopT);
        L.stopT = setTimeout(() => {
          if (L.on || L.src !== s || !s) return;
          const span = s.loopEnd - s.loopStart;
          L.offset = span > 0 ? ((L.offset ?? 0) + now() - L.started) % span : 0;   // pick up where it left off
          try { s.stop(); } catch { /* stopped */ }
          L.src = null;
        }, fade * 1000 + 200);
      }
    };
    return L;
  }
  let beds = {}, music = null, hum = null, fridge = null;
  /* Experience zones (Tan's experiences): a looping track heard only near a
   * place, e.g. the discount store's theme or the shrine's wind chimes.
   * Beyond `far` it does not play at all; between near and far it fades. */
  const zones = [];
  if (import.meta.env?.DEV) window.__soundZones = zones;   // dev: the final QA's sound audit
  function zoneTick(z) {
    const d = Math.hypot(z.x - listener.x, z.z - listener.z);
    const want = !muted && d < z.far ? z.level * falloff(d, z) * (z.indoor && !state.inside ? 0.35 : 1) : 0;
    if (want > 0 && !z.node) {
      z.g = ac.createGain(); z.g.gain.value = 0;
      z.p = ac.createPanner(); z.p.panningModel = 'HRTF'; z.p.rolloffFactor = 0;
      z.p.positionX.value = z.x; z.p.positionY.value = z.y; z.p.positionZ.value = z.z;
      z.g.connect(z.p).connect(z.indoor ? inGain : outBus);
      z.node = loopNode(z.name, z.g, 1);
    }
    if (!z.node) return;
    z.node.set(want > 0, 1.2);
    z.g.gain.setTargetAtTime(want, now(), 0.25);
  }
  const walks = [];
  const bell = { src: null, timer: null, gain: null, on: false };

  /* the store's own hum and the cooler's compressor, made in code */
  function makeHum() {
    const g = ac.createGain(); g.gain.value = 0; g.connect(inGain);
    for (const [f, l] of [[60, 0.02], [120, 0.012], [2000, 0.0025]]) {
      const o = ac.createOscillator(), og = ac.createGain();
      o.frequency.value = f; og.gain.value = l; o.connect(og).connect(g); o.start();
    }
    return g;
  }
  function makeFridge() {
    const g = ac.createGain(); g.gain.value = 0;
    const p = ac.createPanner(); p.panningModel = 'HRTF'; p.rolloffFactor = 0;
    g.connect(p).connect(inGain);
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 110;
    const o = ac.createOscillator(); o.frequency.value = 50; const og = ac.createGain(); og.gain.value = 0.25;
    s.connect(f).connect(g); o.connect(og).connect(g); s.start(); o.start();
    return { g, p, cycle: 0 };
  }

  /* ------------------------------ the api ------------------------------ */
  const api = {
    /**
     * A looping track that belongs to a place (Tan's experiences): heard from
     * `far` in, full from `near`, nowhere else.  { x, z, y, near, far,
     * level, indoor }.  Returns a handle: { set(opts) } to move or retune it.
     */
    zone(name, o) {
      const z = { name, x: 0, z: 0, y: 2, near: 8, far: 30, level: 0.6, indoor: false, ...o, node: null };
      zones.push(z);
      return { set: (p) => Object.assign(z, p) };
    },
    /** A placed one-off (a line said, a track played on interaction).
     * `indoor`: it belongs inside the store (heard through the glass from outside). */
    oneShot(name, { x, z, y = 1.6, near = 6, far = 40, gain = 1, recipe = null, indoor = false } = {}) {
      play(name, { at: x === undefined ? null : { x, y, z }, range: x === undefined ? null : { near, far }, gain, recipe, indoor });
    },
    /** Fetch and decode these files now, so their first play is the file and
     * not the recipe.  Waits for the list of files first: asked for before it
     * has arrived (the first click, near the store), it used to fetch nothing
     * and the self-checkout's first run was a tap (2026-09-28). */
    async preload(names) {
      if (!ac) return false;
      await manifestReady;
      const got = await Promise.all(names.map((n) => (manifest[n] ? buffer(n) : null)));
      return got.every(Boolean);
    },
    get ready() { return !!ac; },
    get muted() { return muted; },
    get volume() { return volume; },
    get available() { return true; },
    /** From the first click: make the context, the graph, and start loading. */
    async start() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
      if (ac.state === 'suspended') ac.resume();
      noise = noiseBuf();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 3;
      comp.connect(ac.destination);
      master = ac.createGain(); master.gain.value = muted ? 0 : volume; master.connect(comp);
      sfxBus = ac.createGain(); sfxBus.connect(master);
      // a small room, made in code: decaying noise (SPEC 9)
      reverb = ac.createConvolver();
      const n = Math.round(ac.sampleRate * 0.8), ir = ac.createBuffer(2, n, ac.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3; }
      reverb.buffer = ir;
      wet = ac.createGain(); wet.gain.value = 0.05;
      sfxBus.connect(wet).connect(reverb).connect(master);
      outBus = ac.createGain();
      outLow = ac.createBiquadFilter(); outLow.type = 'lowpass'; outLow.frequency.value = 20000; outLow.Q.value = 0.5;
      outGain = ac.createGain(); outGain.gain.value = 1;
      outBus.connect(outLow).connect(outGain).connect(master);
      inGain = ac.createGain(); inGain.gain.value = 0; inGain.connect(master);
      musicGain = ac.createGain(); musicGain.gain.value = 1; musicGain.connect(master);
      bell.gain = ac.createGain(); bell.gain.gain.value = 0; bell.gain.connect(outBus);
      hum = makeHum();
      fridge = makeFridge();
      // the loops exist at once (they wait for their files); the list of files comes after
      for (const [k, lvl] of Object.entries(BEDS)) beds[k] = loopNode(k, outBus, lvl);
      music = streamNode('store-bgm', musicGain, 0.2);
      manifestReady = fetch(import.meta.env.BASE_URL + 'audio/manifest.json').then((r) => r.json()).then((m) => { manifest = m; }, () => { manifest = {}; });
      await manifestReady;
      music.arm();                              // while the click that started us is still in hand
      // the short sounds are fetched now, quietly, so the first of each is ready
      for (const k of ['lawson-chime', 'door-chime', 'auto-door', 'fridge-door', 'ui-tap', 'railway-bells', 'walk-kakko', 'walk-piyo']) buffer(k);
    },
    /** The tab went away or came back: an unheard graph should not be running. */
    setAwake(awake) {
      if (!ac) return;
      if (awake) ac.resume();
      else if (ac.state === 'running') ac.suspend();
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      muted = volume <= 0.001;
      if (!muted) lastAudible = volume;
      if (master) master.gain.setTargetAtTime(muted ? 0 : volume, now(), 0.05);
      return muted;
    },
    toggle() {
      muted = !muted;
      if (!muted && volume <= 0.001) volume = lastAudible;
      if (master) master.gain.setTargetAtTime(muted ? 0 : volume, now(), 0.1);
      return muted;
    },

    /**
     * Each frame: the listener (the camera), inside the store or not, the
     * look (the ambience bed), and where the cooler is (its compressor).
     */
    update(dt, { camera, inside, look, cooler }) {
      if (!ac || !music) return;
      const t = now(), L = ac.listener;
      listener.x = camera.position.x; listener.y = camera.position.y; listener.z = camera.position.z;
      for (const z of zones) zoneTick(z);
      camera.getWorldDirection(_f);
      if (L.positionX) {
        L.positionX.setTargetAtTime(listener.x, t, 0.02); L.positionY.setTargetAtTime(listener.y, t, 0.02); L.positionZ.setTargetAtTime(listener.z, t, 0.02);
        L.forwardX.setTargetAtTime(_f.x, t, 0.02); L.forwardY.setTargetAtTime(_f.y, t, 0.02); L.forwardZ.setTargetAtTime(_f.z, t, 0.02);
      } else { L.setPosition(listener.x, listener.y, listener.z); L.setOrientation(_f.x, _f.y, _f.z, 0, 1, 0); }

      // stepping in muffles the town within a second; the store's own sound comes up
      if (inside !== state.inside) {
        state.inside = inside;
        outLow.frequency.cancelScheduledValues(t);
        outLow.frequency.setTargetAtTime(inside ? 900 : 20000, t, 0.15);
        state.lowpassTarget = inside ? 900 : 20000;      // Firefox does not report a ramping value
        outGain.gain.setTargetAtTime(inside ? 0.3 : 1, t, 0.15);
        // the store's own sound: its bed, music and hum, 15% up on the first mix (Tan, 2026-09-28)
        inGain.gain.setTargetAtTime(inside ? SOUND.storeInside : 0, t, 0.4);
        hum.gain.setTargetAtTime(inside ? SOUND.storeInside : 0, t, 0.4);
        wet.gain.setTargetAtTime(inside ? 0.22 : 0.05, t, 0.3);
        music.set(inside, 1.5);
        state.music = inside;
      }
      state.lowpass = Math.round(outLow.frequency.value);
      for (const v of voices) {
        const { k, f } = voiceLevel(v);
        v.g.gain.setTargetAtTime(k, t, 0.06);
        v.lp.frequency.setTargetAtTime(f, t, 0.06);
      }
      // the bed for the time of day, crossfaded; the wind always, low
      if (look !== state.look) {
        state.look = look;
        beds.wind.set(true, 2);
        for (const [k, name] of Object.entries(BED_OF_LOOK)) if (beds[name]) beds[name].set(k === look, 3);
      }
      // the cooler's compressor, heard near the drinks wall, cycling on and off
      if (cooler) {
        fridge.p.positionX.value = cooler.x; fridge.p.positionY.value = 1; fridge.p.positionZ.value = cooler.z;
        fridge.cycle = (fridge.cycle + dt) % 60;
        const on = fridge.cycle < 40 ? 1 : 0;
        const d = Math.hypot(cooler.x - listener.x, cooler.z - listener.z);
        fridge.g.gain.setTargetAtTime(0.05 * on * falloff(d, SOUND.fridge), t, 0.8);
      }
    },

    /* ---- the store ---- */
    /** The chime: once as you come in, once as you go out, at the door. */
    storeChime(at) {
      play(manifest['lawson-chime'] ? 'lawson-chime' : manifest['door-chime'] ? 'door-chime' : null,
        { at, range: SOUND.storeChime, recipe: 'store-chime', gain: 0.55, indoor: true });
    },
    autoDoor(at, opening) { play('auto-door', { at, range: SOUND.autoDoor, gain: opening ? 0.35 : 0.25, rate: opening ? 1 : 0.96 }); },
    fridgeDoor(at, opening) { play('fridge-door', { at, range: SOUND.fridge, gain: opening ? 0.5 : 0.3, rate: opening ? 1 : 0.85 }); },
    /** Taking or putting back: by what it is made of. */
    item(material, at) { play(null, { at, range: SOUND.shelf, recipe: RECIPES[material] ? material : 'plastic', gain: 0.9 }); },
    basket() { play(null, { recipe: 'basket', gain: 0.8 }); },
    refuse() { play(null, { recipe: 'refuse', gain: 0.8 }); },
    ui() { play('ui-tap', { gain: 0.4 }); },
    step(inside) { play(null, { recipe: 'step', gain: 0.9, o: { inside } }); },

    /* ---- the railway (M2c), now through the engine ---- */
    /** The crossing: ringing or not, and how far the listener is. */
    bells(on, distance) {
      if (!ac) return;
      const audible = on && distance < SOUND.crossingBells.far;
      state.bells = audible;
      if (audible && !bell.on) {
        bell.on = true;
        const b = buffers.get('railway-bells');
        if (b) {
          bell.src = ac.createBufferSource(); bell.src.buffer = b; bell.src.loop = true;
          [bell.src.loopStart, bell.src.loopEnd] = loopSpan('railway-bells', b);
          bell.src.connect(bell.gain); bell.src.start(now(), bell.src.loopStart);
        } else {
          let k = 0;
          const tick = () => { tone(bell.gain, k++ % 2 ? 860 : 730, now() + 0.01, 0.45, { type: 'sine', level: 0.3 }); };
          tick(); bell.timer = setInterval(tick, 250);
        }
        log.push({ name: 'railway-bells', t: +now().toFixed(3), loop: true });
      } else if (!audible && bell.on) {
        bell.on = false;
        if (bell.src) { try { bell.src.stop(); } catch { /* stopped */ } bell.src = null; }
        if (bell.timer) { clearInterval(bell.timer); bell.timer = null; }
      }
      bell.gain.gain.setTargetAtTime(audible ? falloff(distance, SOUND.crossingBells) * 0.7 : 0, now(), 0.1);
    },
    /**
     * The zebras' walk lights (M4, Tan): each plays the pedestrian signal
     * (piyo-piyo, kakko) while it is green, heard only near it.
     * `list` [{ x, z, on, sound }] in world terms, the same order every frame.
     */
    walkSignals(list) {
      if (!ac) return;
      /* One junction, one voice: crossings with the same tune within 15 m of
       * each other (the master junction's two main-road zebras) are heard as
       * one, from the nearest of them, not as two loops in unison. */
      const dist = list.map((w) => Math.hypot(w.x - listener.x, w.z - listener.z));
      const twin = list.map((w, i) => list.some((v, j) => j !== i && v.on && v.sound === w.sound
        && Math.hypot(v.x - w.x, v.z - w.z) < 15 && (dist[j] < dist[i] || (dist[j] === dist[i] && j < i))));
      list.forEach((w, i) => {
        const n = walks[i] ?? (walks[i] = { g: null, src: null, timer: null });
        const d = dist[i];
        const on = w.on && !twin[i] && d < SOUND.walkSignal.far && !muted;
        if (on && !n.g) {
          n.g = ac.createGain(); n.g.gain.value = 0;
          const p = ac.createPanner(); p.panningModel = 'HRTF'; p.rolloffFactor = 0;
          p.positionX.value = w.x; p.positionY.value = 3; p.positionZ.value = w.z;
          n.g.connect(p).connect(outBus);
        }
        if (on && !n.src && !n.timer) {
          const file = 'walk-' + (w.sound ?? 'piyo');
          const b = buffers.get(file);
          if (b) {
            n.src = ac.createBufferSource(); n.src.buffer = b; n.src.loop = true;
            [n.src.loopStart, n.src.loopEnd] = loopSpan(file, b);
            n.src.connect(n.g); n.src.start(now(), n.src.loopStart);
          } else {
            // SPEC 9's recipe: an original two-tone "pi-yo" chirp every 0.6 s
            const chirp = () => { const t0 = now() + 0.01; tone(n.g, 2800, t0, 0.08, { level: 0.25 }); tone(n.g, 3600, t0 + 0.12, 0.08, { level: 0.25 }); };
            chirp(); n.timer = setInterval(chirp, 600);
          }
          state.walk = (state.walk ?? 0) + 1;
          log.push({ name: 'walk-' + (w.sound ?? 'piyo'), t: +now().toFixed(3), loop: true, i });
        } else if (!on && (n.src || n.timer)) {
          const src = n.src, timer = n.timer;
          n.src = null; n.timer = null;
          n.g.gain.setTargetAtTime(0, now(), 0.08);
          setTimeout(() => { if (src) { try { src.stop(); } catch { /* stopped */ } } if (timer) clearInterval(timer); }, 400);
        }
        if (n.g && on) n.g.gain.setTargetAtTime(1.6 * falloff(d, SOUND.walkSignal), now(), 0.1);
      });
      state.walking = walks.filter((n) => n.src || n.timer).length;
    },

    /** The train's door chime: three notes of our own (never a station melody). */
    chime(distance) {
      if (!ac || muted || distance >= SOUND.doorChime.far) return;
      const g = ac.createGain(); g.gain.value = 0.6 * falloff(distance, SOUND.doorChime); g.connect(outBus);
      const t = now() + 0.02;
      [[659.3, 0], [880.0, 0.28], [784.0, 0.56]].forEach(([f, dt]) => tone(g, f, t + dt, 0.45, { level: 0.4 }));
      log.push({ name: 'train-chime', t: +now().toFixed(3) });
    },
  };
  if (import.meta.env?.DEV) api.debug = {
    get _voices() { return voices; },
    get _music() { return music; },
    get _beds() { return beds; },
    /** What is actually coming out: the master's level over `ms` (dev only). */
    async level(ms = 1500) {
      if (!ac) return 0;
      if (!api.debug._an) { api.debug._an = ac.createAnalyser(); api.debug._an.fftSize = 2048; master.connect(api.debug._an); }
      const an = api.debug._an, buf = new Float32Array(an.fftSize);
      let peak = 0, sum = 0, n = 0;
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        an.getFloatTimeDomainData(buf);
        for (const v of buf) { peak = Math.max(peak, Math.abs(v)); sum += v * v; n++; }
        await new Promise((r) => setTimeout(r, 30));
      }
      return { rms: +Math.sqrt(sum / n).toFixed(5), peak: +peak.toFixed(4) };
    }, voiceLevels: () => [...voices].map((v) => ({ indoor: v.indoor, ...voiceLevel(v) })), log, state, get ac() { return ac; }, get manifest() { return manifest; }, buffers };
  return api;
}
const _f = new Vector3();
