/* ------------------------------------------------------------------ *
 * Hachi's reactions (Tan, 2026-10-01: "more reactions = more fun"): the
 * cute little performances that began in Director Mode, here for play.
 *
 * guide.js works out where the pup is and how it stands (its base pose);
 * this lays a face and a reaction over that, the frame it is drawn:
 *
 *   the face      a mood the guide asks for each frame (ears back at a
 *                 gallop, a squint and a smile on its back, eyes shut
 *                 asleep), eased in and out
 *   a reaction    a timed bit (a head tilt, a yawn, a startle, tippy taps,
 *                 the konbini bits), blended in and out over the base, with
 *                 its sounds on their beats; several may run, one after
 *                 another (`chain`)
 *   blinks        every few seconds, sometimes two
 *
 * Nothing playing and no face asked: the base pose goes through unchanged
 * and every expression channel is 0 (the rig then draws what it always
 * drew).  One pup, one draw call; nothing here touches the scene.
 *
 * The rig (shiba.js): aPose3 [ears back, one ear up, lids, big eyes],
 * aPose4 [mouth, tail tucked, crouch, one paw], aPose5 [hips, squish, both
 * paws].
 * ------------------------------------------------------------------ */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const ease5 = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
/** 0 before a, 1 after b, eased between */
const seg = (t, a, b) => ease5((t - a) / (b - a));
/** up over [a, a+i], held, down over [b-o, b] */
const bell = (t, a, b, i = 0.2, o = i) => Math.min(seg(t, a, a + i), 1 - seg(t, b - o, b));
const wave = (t, hz) => Math.sin(t * Math.PI * 2 * hz);
/** a quick pulse at t0 (s), `d` long: up fast, down slower */
const pulse = (t, t0, d = 0.3) => { const x = (t - t0) / d; return x <= 0 || x >= 1 ? 0 : x < 0.3 ? ease(x / 0.3) : 1 - ease((x - 0.3) / 0.7); };

/** A damped spring toward a target, in fixed steps (the ears' follow-through). */
class Spring {
  constructor(v = 0, k = 120, c = 14) { this.v = 0; this.x = v; this.k = k; this.c = c; this.acc = 0; }
  step(target, dt) {
    this.acc = Math.min(0.1, this.acc + dt);
    const h = 1 / 240;
    while (this.acc >= h) { this.acc -= h; this.v += (-this.k * (this.x - target) - this.c * this.v) * h; this.x += this.v * h; }
    return this.x;
  }
}

/** The expression channels (all 0: the pup as it always was) and the body's extras a reaction may add. */
const FACE = ['earsBack', 'earAsym', 'lids', 'big', 'mouth', 'tuck', 'crouch', 'paw', 'paws', 'hips', 'squish'];
const EXTRA = ['dy', 'pitch', 'roll', 'dyaw', 'fwd', 'side', 'tremble', 'shake', 'eye', 'phRate'];
const BASE = ['look', 'nod', 'tilt', 'posture', 'perk', 'wagAmp', 'wagRate', 'amp'];
const KEYS = [...BASE, ...FACE, ...EXTRA, 'blink'];

/* ---------------------------------------------------------------------------------------------------------------
 * The library.  Each: its natural length (s), its blend in and out (s), and a function of u (0..1 across it), its
 * own seconds t, its length D and its options o, writing over the pose R (already the base).  `snd`: its sounds,
 * [u, name, gain].  `hold`: the pup stands where it is while it plays (it is not one for a pup on the move).
 * ------------------------------------------------------------------------------------------------------------- */
export const REACTIONS = {
  headTilt: {
    dur: 1.9, blend: [0.12, 0.25], snd: [[0.08, 'dog-hmm', 0.7]],
    f(R, u, t, D, o) {
      // one way, hold, then the other way (the double tilt); the ears go asymmetric with it.  `ask`: chin up, big
      // eyes on you, as if asking what that was
      const s = o.side ?? 1;
      const a = seg(u, 0.0, 0.18) * (o.hold ? 1 : 1 - seg(u, 0.5, 0.62)), b = o.hold ? 0 : seg(u, 0.52, 0.66);
      R.tilt = s * (0.5 * a - 0.5 * b);
      R.earAsym = s * (0.85 * a - 0.85 * b);
      R.perk = 1.1; R.big = 0.3; R.eye = 1; R.nod -= 0.05;
      if (o.ask) { R.big = 0.85 * seg(u, 0.1, 0.35); R.nod -= 0.12 * seg(u, 0.1, 0.35); R.perk = 0.95; }
    },
  },
  sniff: {
    dur: 1.5, blend: [0.15, 0.2], hold: true, snd: [[0.15, 'dog-sniff', 0.7], [0.55, 'dog-sniff', 0.6]],
    // nose down at the ground, working
    f(R, u, t) { R.nod = 0.42 + 0.05 * wave(t, 7) * bell(u, 0.1, 0.9, 0.1, 0.1); R.look = 0.3 * wave(t, 0.55); R.perk = 1.0; R.lids = 0.2; R.eye = 0; R.wagAmp = 0.3; R.wagRate = 9; },
  },
  petal: {
    dur: 2.9, blend: [0.2, 0.25], hold: true, snd: [[0.12, 'dog-sniff', 0.6], [0.64, 'dog-sneeze', 0.9], [0.74, 'dog-shake', 0.5]],
    f(R, u, t) {
      // a petal comes down: the nose goes up after it, the eyes big on it as it lands on the nose... the wind-up,
      // the sneeze, and a shake of the head with one ear flopped
      const up = bell(u, 0.04, 0.52, 0.12, 0.06), wind = bell(u, 0.5, 0.64, 0.08, 0.01), snap = u >= 0.64 ? 1 - seg(u, 0.64, 0.82) : 0;
      R.nod = -0.38 * up - 0.3 * wind + 0.5 * snap + 0.08 * (1 - up) * (1 - snap);
      R.look = 0.22 * wave(t, 0.7) * up * (1 - seg(u, 0.3, 0.45));
      R.big = 0.7 * up; R.perk = 1.05; R.earAsym = 0.4 * seg(u, 0.1, 0.2) * (1 - seg(u, 0.4, 0.5));
      R.lids = Math.max(0.6 * wind, u > 0.62 && u < 0.72 ? 1 : 0);
      R.mouth = 0.4 * wind;
      R.shake = bell(u, 0.74, 0.96, 0.03, 0.08);
      if (u > 0.78) R.earAsym = -0.7 * (1 - seg(u, 0.9, 1));
      R.blink = 0; R.eye = 0;
    },
  },
  sneeze: {
    dur: 1.4, blend: [0.08, 0.25], hold: true, snd: [[0.36, 'dog-sneeze', 0.9]],
    f(R, u) {
      R.nod = u < 0.36 ? -0.38 * seg(u, 0, 0.34) : 0.4 * (1 - seg(u, 0.36, 0.55));
      R.lids = u < 0.34 ? 0.55 * seg(u, 0.05, 0.3) : u < 0.44 ? 1 : 0;
      R.mouth = 0.4 * bell(u, 0.2, 0.36, 0.05, 0.02);
      R.shake = bell(u, 0.5, 0.78, 0.03, 0.08);
      R.earAsym = -0.8 * seg(u, 0.6, 0.72) * (1 - seg(u, 0.9, 1));
      R.blink = 0;
    },
  },
  shakeOff: {
    dur: 1.2, blend: [0.1, 0.25], hold: true, snd: [[0.1, 'dog-shake', 0.9]],
    f(R, u, t) {
      // head to tail: the head first, the body after, ears flapping
      const k = bell(u, 0.05, 0.85, 0.08, 0.15);
      R.shake = k;
      R.roll = 0.2 * k * wave(t, 8.5);
      R.look += 0.3 * k * wave(t + 0.03, 8.5);
      R.perk = 0.7 + 0.3 * k * wave(t, 17);
      R.lids = 0.7 * k; R.blink = 0;
      R.hips = 0.2 * k * wave(t - 0.04, 8.5);
    },
  },
  tippyTaps: {
    dur: 1.9, blend: [0.12, 0.2], hold: true, snd: [[0.05, 'dog-giggle', 0.8], [0.2, 'dog-tip', 0.6], [0.45, 'dog-tip', 0.6], [0.7, 'dog-tip', 0.6]],
    f(R, u, t) {
      // the front paws patter, the hips going, a happy squint
      const k = bell(u, 0.02, 0.95, 0.05, 0.1);
      R.posture = 0;
      R.paw = k * (wave(t, 3.2) > 0 ? 0.55 : -0.55) * Math.min(1, Math.abs(wave(t, 3.2)) * 3);
      R.hips = 0.22 * k * wave(t, 3.2);
      R.perk = 1.35; R.mouth = 0.3; R.wagAmp = 0.9; R.wagRate = 18; R.lids = 0.25; R.eye = 1; R.nod -= 0.06;
      R.dy = 0.012 * Math.abs(wave(t, 6.4)) * k;
    },
  },
  puppyEyes: {
    dur: 2.4, blend: [0.25, 0.3], hold: true, snd: [[0.3, 'dog-whine', 0.35]],
    f(R, u) {
      // sat, the eyes as big as they go, a slow blink, a paw coming up
      R.posture = 1; R.big = 1; R.eye = 1; R.perk = 0.85; R.earsBack = 0.2; R.tilt = 0.18 * seg(u, 0.1, 0.3);
      R.lids = bell(u, 0.45, 0.72, 0.12, 0.14) * 0.9; R.blink = 0;
      R.paw = 0.75 * bell(u, 0.55, 0.98, 0.1, 0.1); R.wagAmp = 0.2;
    },
  },
  beg: {
    dur: 2.0, blend: [0.2, 0.25], hold: true, snd: [[0.2, 'dog-giggle', 0.7]],
    f(R, u, t) {
      // sat, a paw up and pawing at the air, the head on one side, a lick of the lips at the end
      R.posture = 1; R.eye = 1; R.big = 0.5; R.perk = 1.2;
      R.paw = 0.55 + 0.4 * wave(t, 2.6) * bell(u, 0.05, 0.75, 0.1, 0.1);
      R.tilt = 0.3 * bell(u, 0.3, 0.8, 0.1, 0.15);
      R.mouth = 0.35 * bell(u, 0.78, 0.92, 0.03, 0.04);
      R.wagAmp = 0.7; R.wagRate = 15;
    },
  },
  happyWiggle: {
    dur: 1.8, blend: [0.08, 0.25], hold: true, snd: [[0.02, 'dog-yip', 0.9], [0.45, 'dog-giggle', 0.9]],
    f(R, u, t, D, o) {
      // the whole back end going, a spin on the spot (sat: a bounce on the front paws instead), a squint and a smile
      const k = bell(u, 0.02, 0.95, 0.05, 0.12);
      R.hips = 0.38 * k * wave(t, 3.6);
      if (o.seated) { R.posture = 1; R.paws = 0.35 * k * Math.max(0, wave(t, 3.6)); }
      else { R.posture = 0; R.dyaw = u < 0.45 ? (o.s ?? 1) * 2 * Math.PI * seg(u, 0.12, 0.45) : 0; R.amp = 0.4 * bell(u, 0.12, 0.45, 0.05, 0.05); R.phRate = 13; }
      R.mouth = 0.4; R.lids = 0.62; R.blink = 0; R.perk = 1.3; R.wagAmp = 1; R.wagRate = 22; R.eye = seg(u, 0.45, 0.55);
      R.dy = 0.02 * Math.abs(wave(t, 3.6)) * k;
    },
  },
  slowBlink: {
    dur: 1.6, blend: [0.15, 0.2],
    f(R, u) { R.lids = Math.max(R.lids, bell(u, 0.2, 0.85, 0.25, 0.3) * 0.95); R.blink = 0; R.eye = 1; R.perk = Math.min(R.perk, 0.75); R.earsBack = 0.1; },
  },
  yawn: {
    dur: 1.7, blend: [0.12, 0.25], hold: true, snd: [[0.1, 'dog-yawn', 0.8]],
    // a big squeaky one: the mouth as wide as it goes, the head back, the eyes shut tight
    f(R, u) { const k = bell(u, 0.08, 0.8, 0.14, 0.15); R.mouth = k; R.nod -= 0.3 * k; R.lids = 0.9 * bell(u, 0.1, 0.8, 0.1, 0.1); R.blink = 0; R.perk = 0.6; R.earsBack = 0.25 * k; R.eye = 0; },
  },
  headShake: {
    dur: 0.7, blend: [0.03, 0.1], snd: [[0.05, 'dog-shake', 0.5]],
    f(R, u) { R.shake = bell(u, 0, 1, 0.08, 0.2); R.lids = 0.7 * R.shake; R.blink = 0; },
  },
  freeze: {
    dur: 1.3, blend: [0.03, 0.25], hold: true,
    // mid-step, a paw in the air, ears up, eyes wide: what was that?
    f(R) { R.perk = 1.0; R.big = 1; R.lids = 0; R.blink = 0; R.wagAmp = 0; R.paw = 0.7; R.nod -= 0.08; R.posture = Math.min(R.posture, 1); },
  },
  startle: {
    dur: 0.85, blend: [0.02, 0.2], hold: true, snd: [[0.0, 'dog-yelp', 0.9]],
    f(R, u, t, D, o) {
      // straight up on all four, eyes wide, ears back; lands low (sat: a little hop where it sits)
      const air = u < 0.42 ? Math.sin(Math.PI * u / 0.42) : 0;
      R.big = 1; R.lids = 0; R.blink = 0;
      R.earsBack = 0.95; R.perk = 0.4;
      R.tuck = 0.5 * seg(u, 0.3, 0.6);
      R.wagAmp = 0;
      if (o.seated) { R.posture = 1; R.dy = 0.045 * air; R.nod += 0.1 * seg(u, 0.4, 0.55); R.pitch = -0.06 * air; return; }
      R.dy = 0.085 * air;
      R.posture = 0;
      R.crouch = 0.25 * air + 0.55 * seg(u, 0.4, 0.55);
      R.pitch = -0.1 * air;
    },
  },
  scared: {
    dur: 1.6, blend: [0.15, 0.35], hold: true, snd: [[0.1, 'dog-whine', 0.5]],
    f(R, u, t, D, o) {
      // low, ears flat, tail under, trembling, the eyes big on whatever it was
      R.earsBack = 1; R.perk = 0.2; R.tuck = 1; R.tremble = 1; R.big = 0.85; R.lids = 0; R.wagAmp = 0; R.blink = 0;
      if (o.seated) { R.posture = 1; R.nod += 0.15; R.pitch = 0.05; return; }
      R.posture = 0; R.crouch = 0.75; R.nod += 0.1; R.pitch = 0.04;
    },
  },
  brave: {
    dur: 1.9, blend: [0.25, 0.4], hold: true, snd: [[0.3, 'dog-boof', 0.85]],
    // and then: chest out, head high, ears up, one firm little woof at it.  Not scared at all
    f(R, u) { const k = bell(u, 0, 1, 0.2, 0.3); R.posture = Math.min(R.posture, 1); R.nod = -0.26 * k; R.pitch = -0.07 * k; R.perk = 1.2; R.lids = 0.3; R.mouth = 0.5 * pulse(u, 0.3, 0.12); R.wagAmp = 0.55; R.wagRate = 6; R.dy = 0.02 * pulse(u, 0.3, 0.14); R.eye = seg(u, 0.6, 0.8); },
  },
  proudStrut: {
    dur: 2.6, blend: [0.3, 0.4],
    // leading you somewhere good: the head high, the tail a slow proud flag, the eyes half shut
    f(R, u, t) { R.nod = -0.2; R.perk = 1.12; R.wagAmp = 0.5; R.wagRate = 5; R.pitch = -0.05; R.lids = 0.3; R.blink = 0; R.tilt = 0.05 * wave(t, 1.1); R.hips = 0.1 * wave(t, 1.6); },
  },
  bigSmile: {
    dur: 2, blend: [0.2, 0.3],
    f(R) { R.mouth = 0.45; R.lids = 0.66; R.blink = 0; R.perk = 1.3; R.earsBack = 0.15; R.tilt = 0.1; R.wagAmp = 0.9; R.wagRate = 20; R.eye = 1; R.nod -= 0.1; },
  },
  lick: {
    dur: 1.5, blend: [0.12, 0.2], snd: [[0.1, 'dog-lick', 0.7], [0.5, 'dog-lick', 0.6]],
    // a lick of the lips, one side then the other
    f(R, u, t) { const k = bell(u, 0.05, 0.95, 0.08, 0.1); R.mouth = 0.22 * k * (0.6 + 0.4 * Math.abs(wave(t, 2.2))); R.perk = 1.3; R.tilt = 0.16 * k * wave(t, 1.1); R.lids = 0.45 * k; R.blink = 0; R.wagAmp = 0.7; R.wagRate = 14; R.eye = 1; },
  },
  hopSpin: {
    dur: 1.3, blend: [0.06, 0.2], hold: true, snd: [[0.05, 'dog-yip', 0.9]],
    // up, once round in the air, down: all joy
    f(R, u, t, D, o) {
      const air = Math.sin(Math.PI * clamp(u / 0.7, 0, 1));
      R.posture = 0; R.dy = 0.11 * air; R.dyaw = (o.s ?? 1) * 2 * Math.PI * seg(u, 0.05, 0.68); R.pitch = -0.12 * air;
      R.mouth = 0.4; R.lids = 0.6; R.blink = 0; R.perk = 1.3; R.earsBack = 0.3 * air; R.wagAmp = 1; R.wagRate = 22; R.paws = 0.4 * air;
      R.crouch = 0.4 * (1 - seg(u, 0, 0.08)) + 0.35 * bell(u, 0.7, 0.9, 0.05, 0.12);
    },
  },
  /* the pigeons scattered: skids to a stop, looks up after them, tongue out, very pleased with itself */
  pleased: {
    dur: 2.2, blend: [0.15, 0.4], hold: true, snd: [[0.1, 'dog-pant', 0.5], [0.55, 'dog-boof', 0.8]],
    f(R, u, t) { R.posture = 0; R.nod = -0.42 * bell(u, 0.05, 0.6, 0.12, 0.2) - 0.1; R.look = 0.35 * wave(t, 0.5) * (1 - seg(u, 0.55, 0.7)); R.mouth = 0.45; R.perk = 1.3; R.lids = 0.3 * seg(u, 0.6, 0.8); R.wagAmp = 1; R.wagRate = 20; R.hips = 0.15 * wave(t, 3); R.eye = seg(u, 0.62, 0.8); R.pitch = -0.06; },
  },
  /* asleep, a dream: an ear twitches, a paw goes */
  dream: {
    dur: 1.6, blend: [0.1, 0.3],
    f(R, u, t) { R.earAsym = 0.7 * pulse(u, 0.1, 0.2) - 0.6 * pulse(u, 0.5, 0.2); R.paw = 0.25 * bell(u, 0.3, 0.8, 0.1, 0.1) * Math.max(0, wave(t, 5)); R.blink = 0; },
  },
};

/* ---------------------------------------------------------------------------------------------------------------
 * The konbini (Tan, 2026-10-01: "Hachi jumps around and imitates the player ... a distinct short bit per product").
 * You eat on the spot outside the door; it sits a few metres out in front of you, in your view.  Each product: what
 * it does while you eat (`eat`, on your clock: store/eat.js opens the wrapper at 0.45 s, bites at 1.0, 1.7 and 2.45
 * s, or two gulps at 1.45 and 2.05 s; gone by 3.5 s), and what it does after (`after`).  All of it on its feet, its
 * haunches or its back ON the ground (guide.js rests it there whatever way up it is).
 * ------------------------------------------------------------------------------------------------------------- */
const BITES = [1.01, 1.73, 2.45];
/** the head ducks to an imaginary bite and the jaw snaps: 0..1 */
const chomp = (t, k = 1) => BITES.reduce((a, b) => Math.max(a, pulse(t, b - 0.04, 0.3)), 0) * k;
/** chewing after each bite */
const chew = (t) => BITES.reduce((a, b) => Math.max(a, bell(t, b + 0.2, b + 0.68, 0.06, 0.1)), 0);
const biteSnd = (D, name = 'dog-munch', g = 0.75) => BITES.map((b) => [(b + 0.12) / D, name, g]);

export const SNACKS = {
  /* Strong Nine: mimes the can with both paws, head tipped right back for two long gulps, a happy "paah"; then it
   * goes to its head: hiccups, a wobble on crossed paws, and over onto its back, giggling, paws going */
  strong_nine: {
    eat: {
      dur: 3.5, blend: [0.3, 0.3], snd: [[1.45 / 3.5, 'dog-lick', 0.7], [2.05 / 3.5, 'dog-lick', 0.7], [3.05 / 3.5, 'dog-pant', 0.5]],
      f(R, u, t) {
        const up = seg(t, 0.4, 0.9), tip = bell(t, 0.9, 2.95, 0.35, 0.3), paah = bell(t, 2.95, 3.5, 0.12, 0.2);
        R.posture = 1; R.paws = 0.85 * up * (1 - seg(t, 3.0, 3.4)); R.pitch = -0.16 * tip;
        R.nod = -0.1 * up - 0.5 * tip + 0.12 * paah; R.eye = 1 - tip;
        R.mouth = 0.35 * tip + 0.15 * tip * (pulse(t, 1.4, 0.3) + pulse(t, 2.0, 0.3)) + 0.7 * paah;
        R.dy = 0.01 * tip * (pulse(t, 1.45, 0.25) + pulse(t, 2.05, 0.25));
        R.lids = 0.75 * tip + 0.6 * paah; R.blink = 0; R.perk = 1.0 + 0.3 * paah; R.earsBack = 0.3 * tip; R.wagAmp = 0.5; R.wagRate = 12;
      },
    },
    after: {
      dur: 9.2, blend: [0.25, 0.5],
      snd: [[0.05, 'dog-hic', 0.9], [0.14, 'dog-hic', 0.9], [0.25, 'dog-giggle', 0.8], [0.36, 'dog-hic', 0.8], [0.5, 'dog-giggle', 0.85], [0.64, 'dog-giggle', 0.85], [0.75, 'dog-snort', 0.7], [0.87, 'dog-shake', 0.8], [0.955, 'dog-hic', 0.9]],
      f(R, u, t, D) {
        // hiccups (a little jump of the whole pup each), the wobble, the flop, the wriggle, up and a shake, one last hic
        const hic = pulse(t, 0.05 * D, 0.28) + pulse(t, 0.14 * D, 0.28) + pulse(t, 0.36 * D, 0.28) + pulse(t, 0.955 * D, 0.28);
        const wob = bell(u, 0.08, 0.44, 0.06, 0.05), over = bell(u, 0.44, 0.8, 0.07, 0.07), back = seg(u, 0.84, 0.9);
        R.posture = 2 * Math.min(1, over * 1.4);
        R.dy = 0.05 * hic;
        // the wobble: swaying on its feet, the head lolling a beat behind, stepping to catch itself, eyes half shut
        R.roll = 0.2 * wob * wave(t, 0.75) + (Math.PI - 0.3 + 0.3 * wave(t, 0.9)) * over;
        R.side = 0.16 * wob * wave(t, 0.75);
        R.tilt = 0.3 * wob * wave(t - 0.25, 0.75) + 0.2 * over * wave(t, 0.7);
        R.look = 0.35 * wob * wave(t - 0.4, 0.4) + 0.5 * over * wave(t, 0.45);
        R.amp = 0.35 * wob * Math.abs(wave(t, 0.75)) + 0.9 * seg(over, 0.85, 1); R.phRate = 9 * wob + 16 * over;
        R.hips = 0.2 * wob * wave(t + 0.2, 0.75) + 0.25 * over * wave(t, 2.2);
        R.lids = 0.5 * wob + 0.7 * over; R.blink = 0;
        R.mouth = 0.3 * wob + 0.5 * over + 0.5 * hic;
        R.big = 0.8 * Math.min(1, hic) * (1 - over);
        R.earAsym = 0.6 * wob * wave(t, 0.37);
        R.perk = 1.3 - 0.9 * over; R.nod = 0.05 * wob - 0.1 * hic + 0.15 * over;
        R.wagAmp = 0.8; R.wagRate = 10 + 8 * over;
        R.shake = bell(u, 0.86, 0.94, 0.02, 0.03);
        R.eye = Math.max(1 - seg(u, 0.4, 0.46), back);
      },
    },
  },
  /* Egg sando: munches along with you, bite for bite, cheeks going; then a long lick of the lips and a grin */
  sando_egg: {
    eat: {
      dur: 3.5, blend: [0.3, 0.25], snd: biteSnd(3.5),
      f(R, u, t) {
        const c = chomp(t), w = chew(t);
        R.posture = 1; R.eye = 1 - 0.5 * c; R.perk = 1.15;
        R.nod = -0.08 + 0.3 * c; R.fwd = 0.03 * c;
        R.mouth = 0.75 * c + 0.3 * w * Math.max(0, wave(t, 4.2));
        R.dy = 0.006 * w * Math.max(0, wave(t, 4.2));
        R.lids = 0.55 * w; R.blink = 0; R.wagAmp = 0.7; R.wagRate = 14; R.hips = 0.08 * w * wave(t, 2.1);
      },
    },
    after: {
      dur: 3.6, blend: [0.2, 0.4], snd: [[0.06, 'dog-lick', 0.8], [0.3, 'dog-lick', 0.7], [0.62, 'dog-giggle', 0.8]],
      f(R, u, t) {
        const l = bell(u, 0.02, 0.55, 0.06, 0.08), g = seg(u, 0.55, 0.66);
        R.posture = 1; R.eye = 1; R.perk = 1.3;
        R.mouth = 0.22 * l * (0.6 + 0.4 * Math.abs(wave(t, 2.2))) + 0.45 * g; R.tilt = 0.2 * l * wave(t, 1.1) + 0.1 * g;
        R.lids = 0.45 * l + 0.66 * g; R.blink = 0; R.wagAmp = 0.9; R.wagRate = 18; R.nod = -0.1;
        R.paws = 0.3 * g * Math.max(0, wave(t, 3)); R.hips = 0.3 * g * wave(t, 3);
      },
    },
  },
  /* Fruit sando: up on its haunches, both paws out, tiny dainty nibbles; then it swoons: the eyes close, it sways,
   * and melts down flat with a sigh; one eye opens */
  fruit_sando: {
    eat: {
      dur: 3.5, blend: [0.3, 0.25], snd: biteSnd(3.5, 'dog-munch', 0.5),
      f(R, u, t) {
        const up = seg(t, 0.2, 0.7), c = chomp(t), w = chew(t);
        R.posture = 1; R.paws = 0.7 * up; R.pitch = -0.2 * up; R.dy = 0.012 * up;
        R.eye = 1; R.big = 0.7 * (1 - w); R.perk = 1.1; R.tilt = 0.14 * up;
        R.nod = -0.12 + 0.16 * c; R.mouth = 0.4 * c + 0.16 * w * Math.max(0, wave(t, 5.5));
        R.lids = 0.75 * w; R.blink = 0; R.wagAmp = 0.5; R.wagRate = 16;
      },
    },
    after: {
      dur: 4.6, blend: [0.25, 0.5], snd: [[0.1, 'dog-whine', 0.3], [0.5, 'dog-snore', 0.6], [0.8, 'dog-hmm', 0.7]],
      f(R, u, t) {
        const sw = bell(u, 0.02, 0.48, 0.08, 0.08), down = bell(u, 0.4, 0.86, 0.12, 0.1), peek = bell(u, 0.62, 0.84, 0.03, 0.05);
        R.posture = 1 + down; R.eye = 1 - down + peek;
        R.lids = Math.max(0.9 * sw, down) * (1 - 0.5 * peek); R.blink = 0;
        R.earAsym = 0.8 * peek;
        R.tilt = 0.22 * sw * wave(t, 0.6); R.roll = 0.1 * sw * wave(t, 0.6) * (1 - down);
        R.nod = -0.2 * sw * (1 - down) + 0.12 * down; R.mouth = 0.25 * sw * (1 - down);
        R.perk = 0.8 - 0.4 * down; R.earsBack = 0.25 * sw; R.wagAmp = 0.35 + 0.4 * peek; R.wagRate = 5 + 10 * peek;
      },
    },
  },
  /* Tuna-mayo onigiri: tuna!  The nose goes mad, then big chomps with a shake of the head at each (worrying the
   * wrapper); a grain of rice on the nose after: cross-eyed, a sneeze, a shake, and tippy taps for more */
  onigiri_tuna: {
    eat: {
      dur: 3.5, blend: [0.25, 0.25], snd: [[0.08, 'dog-sniff', 0.8], ...biteSnd(3.5)],
      f(R, u, t) {
        const sn = bell(t, 0.1, 0.9, 0.12, 0.1), c = chomp(t), w = chew(t);
        R.posture = -0.7 * seg(t, 0.75, 1.0) * (1 - seg(t, 3.1, 3.4));      // nose up at the smell, then down on its elbows over it, rump up
        R.nod = -0.3 * sn + 0.05 * sn * wave(t, 8) + 0.25 * c + 0.1 * w; R.eye = sn;
        R.big = 0.6 * sn; R.perk = 1.2;
        R.mouth = 0.8 * c + 0.3 * w * Math.max(0, wave(t, 4.4));
        R.shake = 0.7 * BITES.reduce((a, b) => Math.max(a, bell(t, b + 0.12, b + 0.5, 0.05, 0.1)), 0);
        R.lids = 0.4 * w; R.blink = 0; R.wagAmp = 1; R.wagRate = 20; R.hips = 0.2 * w * wave(t, 2.6);
      },
    },
    after: {
      dur: 4.4, blend: [0.2, 0.4], snd: [[0.33, 'dog-sneeze', 0.9], [0.42, 'dog-shake', 0.6], [0.6, 'dog-giggle', 0.8], [0.66, 'dog-tip', 0.6], [0.78, 'dog-tip', 0.6], [0.9, 'dog-tip', 0.6]],
      f(R, u, t) {
        const look = bell(u, 0.02, 0.3, 0.06, 0.03), wind = bell(u, 0.24, 0.33, 0.05, 0.01), snap = u >= 0.33 ? 1 - seg(u, 0.33, 0.45) : 0, taps = bell(u, 0.56, 0.98, 0.06, 0.1);
        R.posture = (1 - seg(u, 0.5, 0.58));
        // the rice on its nose: the eyes big and crossing down at it, the head drawing back from it
        R.big = look; R.nod = 0.18 * look - 0.3 * wind + 0.45 * snap - 0.06 * taps; R.tilt = 0.12 * look * wave(t, 0.8);
        R.lids = Math.max(0.5 * wind, u > 0.32 && u < 0.4 ? 1 : 0, 0.25 * taps); R.mouth = 0.4 * wind + 0.3 * taps; R.blink = 0;
        R.shake = bell(u, 0.4, 0.54, 0.02, 0.05);
        R.paw = taps * (wave(t, 3.2) > 0 ? 0.55 : -0.55) * Math.min(1, Math.abs(wave(t, 3.2)) * 3);
        R.hips = 0.22 * taps * wave(t, 3.2); R.dy = 0.012 * Math.abs(wave(t, 6.4)) * taps;
        R.perk = 1.3; R.wagAmp = 0.9; R.wagRate = 18; R.eye = Math.max(0, 1 - look * 0.7);
      },
    },
  },
  /* Choco Wafer Jumbo: the biggest puppy eyes and a paw, licking the air at each of your bites; then the cold hits
   * (eyes wide, a shiver, a shake of the head), and a happy spin, up and round in the air */
  choco_wafer_jumbo: {
    eat: {
      dur: 3.5, blend: [0.3, 0.2], snd: [[0.12, 'dog-whine', 0.35], ...biteSnd(3.5, 'dog-lick', 0.7)],
      f(R, u, t) {
        const c = BITES.reduce((a, b) => Math.max(a, bell(t, b, b + 0.55, 0.08, 0.15)), 0);
        R.posture = 1; R.eye = 1; R.big = 1 - 0.5 * c; R.perk = 0.9 + 0.4 * c; R.earsBack = 0.2 * (1 - c);
        R.tilt = 0.2 * seg(t, 0.2, 0.6); R.paw = 0.7 * bell(t, 0.3, 3.3, 0.3, 0.2) * (0.75 + 0.25 * wave(t, 1.2));
        R.mouth = 0.25 * c * (0.5 + 0.5 * Math.abs(wave(t, 3.4))); R.nod = -0.1 - 0.1 * c * Math.abs(wave(t, 3.4));
        R.lids = 0.5 * c; R.blink = 0; R.wagAmp = 0.4 + 0.5 * c; R.wagRate = 14;
      },
    },
    after: {
      dur: 4.5, blend: [0.15, 0.35], snd: [[0.02, 'dog-yelp', 0.5], [0.2, 'dog-shake', 0.7], [0.42, 'dog-yip', 0.9], [0.72, 'dog-giggle', 0.85]],
      f(R, u, t, D) {
        const cold = bell(u, 0.0, 0.3, 0.03, 0.06), spin = bell(u, 0.4, 0.7, 0.02, 0.05), joy = seg(u, 0.38, 0.46);
        const us = clamp((u - 0.4) / 0.3, 0, 1), air = Math.sin(Math.PI * clamp(us / 0.75, 0, 1)) * spin;
        R.posture = 1 - seg(u, 0.3, 0.4) + seg(u, 0.74, 0.84);
        R.big = cold; R.tremble = cold * seg(u, 0.05, 0.12); R.earsBack = 0.8 * cold; R.shake = bell(u, 0.2, 0.32, 0.02, 0.04);
        R.dy = 0.11 * air; R.dyaw = spin > 0 ? 2 * Math.PI * seg(us, 0.05, 0.7) : 0; R.pitch = -0.12 * air; R.paws = 0.4 * air;
        R.mouth = 0.4 * joy; R.lids = 0.6 * joy; R.blink = 0; R.perk = 0.5 + 0.8 * joy; R.wagAmp = joy; R.wagRate = 22;
        R.hips = 0.3 * joy * wave(t, 3.4) * (1 - spin); R.eye = 1; R.nod = -0.08 * joy;
      },
    },
  },
};

/* --------------------------------------------------------------------------------------------------------------- */
/**
 * The layer.  `say(name, gain)` voices a sound at the pup.
 *   play(name | {a reaction}, o)   start one now (`o.dur` another length, `o.delay` s first, `o.at` s into it); returns when it ends (s from now)
 *   chain([[name, o], ...])        one after another
 *   step(dt, base, env)            the frame: base { look, nod, tilt, posture, perk, wag, wagA, wagRate, amp },
 *                                  env { toYou, nodYou, face, asleep, now }; returns the pose to draw (`out`)
 */
export function makeReactions({ say }) {
  const live = [];
  const face = Object.fromEntries(FACE.map((k) => [k, 0]));
  const R = {}, T = {};
  const out = { look: 0, nod: 0, tilt: 0, posture: 0, perk: 1, wag: 0, amp: 0, dy: 0, pitch: 0, roll: 0, dyaw: 0, fwd: 0, side: 0, phRate: 0, c: [0, 0, 0, 0], d: [0, 0, 0, 0], e: [0, 0, 0, 0], active: false };
  const earB = new Spring(0, 260, 13);
  let clock = 0, wagPh = 0, blinkAt = 1.5 + Math.random() * 2, blinkU = -1, twice = false, last = null;

  const api = {
    out,
    play(name, o = {}) {
      const r = typeof name === 'string' ? REACTIONS[name] : name;
      if (!r) return 0;
      const D = o.dur ?? r.dur, at = o.at ?? 0;
      // (`at`: joined that far into it, e.g. the konbini bit when it arrives late: the sounds before then are not played)
      const q = { r, name: typeof name === 'string' ? name : (o.name ?? 'bit'), t: at > 0 ? at : -(o.delay ?? 0), D, o, si: 0 };
      if (at > 0 && r.snd) while (q.si < r.snd.length && r.snd[q.si][0] * D < at) q.si++;
      live.push(q);
      last = q.name;
      return D + (o.delay ?? 0);
    },
    chain(list) {
      let at = 0;
      for (const [name, o = {}] of list) at = api.play(name, { ...o, delay: at + (o.delay ?? 0) });
      return at;
    },
    /** Nothing playing, no face (a staged frame, a fresh start). */
    reset() { live.length = 0; for (const k of FACE) face[k] = 0; blinkU = -1; earB.x = 0; earB.v = 0; },
    /** Drop whatever is playing (it was moved, or something bigger began); they blend out, they don't snap. */
    stop() { for (const q of live) if (q.t < 0) q.D = -1; else q.D = Math.min(q.D, q.t + 0.2); },
    /** Anything playing (or due)? */
    get busy() { return live.length > 0; },
    /** One that keeps it where it stands playing right now? */
    get holding() { return live.some((q) => q.t >= 0 && (q.o.hold ?? q.r.hold)); },
    is(name) { return live.some((q) => q.name === name); },
    get last() { return last; },
    get names() { return live.map((q) => q.name); },
    step(dt, B, env) {
      clock += dt;
      // the base, and the mood eased over it
      for (const k of BASE) R[k] = B[k] ?? 0;
      const f = env.face, kf = Math.min(1, dt * 9);
      // (`env.now`: channels set this very frame, not eased: the crouch before a hop and the squash as it lands, guide.js)
      const now = env.now;
      for (const k of FACE) { face[k] += ((f?.[k] ?? 0) - face[k]) * kf; if (Math.abs(face[k]) < 1e-4) face[k] = 0; R[k] = face[k] + (now?.[k] ?? 0); }
      for (const k of EXTRA) R[k] = 0;
      R.blink = 1;
      // the reactions, blended over it in order; their sounds as the clock passes them
      let W = 0;
      for (let i = live.length - 1; i >= 0; i--) if (live[i].t > live[i].D) live.splice(i, 1);
      for (const q of live) {
        q.t += dt;
        if (q.t < 0 || q.t > q.D) continue;
        const [bi, bo] = q.r.blend ?? [0.2, 0.25];
        const w = Math.min(ease(q.t / Math.max(1e-3, bi)), ease((q.D - q.t) / Math.max(1e-3, bo)));
        for (const k of KEYS) T[k] = R[k];
        q.r.f(T, q.t / q.D, q.t, q.D, q.o);
        for (const k of KEYS) R[k] = lerp(R[k], T[k], w);
        W = Math.max(W, w);
        const snd = q.r.snd;
        if (snd && !q.o.mute) while (q.si < snd.length && q.t >= snd[q.si][0] * q.D) { say(snd[q.si][1], snd[q.si][2]); q.si++; }
      }
      // eye contact
      let look = R.look, nod = R.nod;
      if (R.eye > 0) { const k = Math.min(1, R.eye); look = lerp(look, env.toYou, k); nod = lerp(nod, env.nodYou + (R.nod - B.nod), k); }
      // secondary: the ears follow through, the head shakes, a tremble, blinks
      const back = earB.step(R.earsBack, dt);
      look += 0.55 * R.shake * Math.sin(clock * Math.PI * 2 * 7.5);
      const tilt = R.tilt + 0.25 * R.shake * Math.sin(clock * Math.PI * 2 * 7.5 + 1);
      let lids = R.lids;
      if (env.asleep) blinkU = -1;
      else {
        if (blinkU < 0 && (blinkAt -= dt) <= 0) { blinkU = 0; twice = !twice && Math.random() < 0.25; blinkAt = twice ? 0.26 : 2 + Math.random() * 3; }
        if (blinkU >= 0) { blinkU += dt / 0.16; if (blinkU >= 1) blinkU = -1; else if (R.blink > 0.5) lids = Math.max(lids, Math.sin(Math.PI * blinkU)); }
      }
      wagPh += dt * R.wagRate;
      out.active = W > 0;
      out.look = clamp(look, -1.5, 1.5); out.nod = nod; out.tilt = tilt; out.posture = R.posture; out.perk = R.perk;
      out.wag = W > 0 ? lerp(B.wag, Math.sin(wagPh) * R.wagAmp + R.amp * 0.08 * Math.sin(2 * (B.ph ?? 0)), W) : B.wag;
      out.amp = R.amp; out.phRate = R.phRate;
      out.dy = R.dy; out.pitch = R.pitch; out.dyaw = R.dyaw; out.fwd = R.fwd;
      out.roll = R.roll + 0.03 * R.tremble * Math.sin(clock * Math.PI * 2 * 21);
      out.side = R.side + 0.004 * R.tremble * Math.sin(clock * Math.PI * 2 * 17);
      out.c[0] = Math.max(0, back); out.c[1] = R.earAsym; out.c[2] = clamp(lids, 0, 1); out.c[3] = R.big;
      out.d[0] = R.mouth; out.d[1] = R.tuck; out.d[2] = R.crouch; out.d[3] = R.paw;
      out.e[0] = R.hips; out.e[1] = R.squish; out.e[2] = R.paws;
      return out;
    },
  };
  return api;
}
