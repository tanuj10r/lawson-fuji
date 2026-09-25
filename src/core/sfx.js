/* ------------------------------------------------------------------ *
 * Positional sound effects, minimal (M2c), until M4's audio engine takes
 * them over (SPEC section 9).
 *
 *   bells   the level crossing: a looping file from assets/audio/ when it
 *           loads, otherwise SPEC's procedural bell (two FM tones, ~730
 *           and ~860 Hz, alternating twice a second)
 *   chime   the train's door chime: an original three-note phrase, soft
 *           bell voice.  Never a real station melody (AGENTS.md).
 *
 * Browsers only start audio from a user gesture, so nothing sounds until
 * `start()` is called from the same click that starts the music.  Volume
 * falls off with distance from the listener.
 * ------------------------------------------------------------------ */

const FILES = { bells: 'assets/audio/crossing-bells.mp3' };

export function createSfx({ volume = 0.5 } = {}) {
  let ac = null, master = null;
  const buffers = {};
  const bell = { gain: null, src: null, timer: null, procedural: false, on: false };

  async function load(name) {
    try {
      const res = await fetch(import.meta.env.BASE_URL + FILES[name]);
      if (!res.ok) return null;
      return await ac.decodeAudioData(await res.arrayBuffer());
    } catch { return null; }
  }

  /** One FM bell strike. */
  function strike(freq, when, dest, level = 0.5) {
    const car = ac.createOscillator(), mod = ac.createOscillator();
    const modGain = ac.createGain(), env = ac.createGain();
    car.frequency.value = freq;
    mod.frequency.value = freq * 1.41;
    modGain.gain.value = freq * 0.9;
    mod.connect(modGain).connect(car.frequency);
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(level, when + 0.004);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.45);
    car.connect(env).connect(dest);
    car.start(when); mod.start(when);
    car.stop(when + 0.5); mod.stop(when + 0.5);
  }

  function startBells() {
    if (bell.on || !ac) return;
    bell.on = true;
    if (buffers.bells) {
      bell.src = ac.createBufferSource();
      bell.src.buffer = buffers.bells;
      bell.src.loop = true;
      bell.src.connect(bell.gain);
      bell.src.start();
    } else {
      // procedural: alternate the two tones, four strikes a second
      let k = 0;
      const tick = () => {
        strike(k % 2 ? 860 : 730, ac.currentTime + 0.01, bell.gain, 0.35);
        k++;
      };
      tick();
      bell.timer = setInterval(tick, 250);
    }
  }
  function stopBells() {
    if (!bell.on) return;
    bell.on = false;
    if (bell.src) { try { bell.src.stop(); } catch { /* already stopped */ } bell.src = null; }
    if (bell.timer) { clearInterval(bell.timer); bell.timer = null; }
  }

  /** Distance falloff: full within 8 m, gone by `range`. */
  const falloff = (d, range) => Math.max(0, Math.min(1, 1 - (d - 8) / (range - 8)));

  return {
    get ready() { return !!ac; },
    async start() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
      } catch { return; }
      master = ac.createGain();
      master.gain.value = volume;
      master.connect(ac.destination);
      bell.gain = ac.createGain();
      bell.gain.gain.value = 0;
      bell.gain.connect(master);
      buffers.bells = await load('bells');
    },
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    /** The crossing: ringing or not, and how far the listener is. */
    bells(on, distance) {
      if (!ac) return;
      if (on) startBells(); else stopBells();
      bell.gain.gain.setTargetAtTime(on ? falloff(distance, 180) : 0, ac.currentTime, 0.1);
    },
    /** The door chime: three notes of our own, a fourth then a step down. */
    chime(distance) {
      if (!ac) return;
      const g = ac.createGain();
      g.gain.value = 0.6 * falloff(distance, 90);
      g.connect(master);
      const t = ac.currentTime + 0.02;
      [[659.3, 0], [880.0, 0.28], [784.0, 0.56]].forEach(([f, dt]) => strike(f, t + dt, g, 0.4));
    },
  };
}
