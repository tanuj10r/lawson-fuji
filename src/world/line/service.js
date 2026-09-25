import { TOWN } from '../../config.js';
import { LINE } from '../../data/town.js';
import { TRACK_Z } from './track.js';

/* ------------------------------------------------------------------ *
 * The service (SPEC section 3, train cycle).
 *
 * Two sets, one per track: eastbound on track 1, westbound on track 2.
 * Each run: appear 420 m out, cruise, brake to a stand at the platform,
 * open the doors, wait 60 s, sound the chime, close the doors, pull away
 * and run out into the fog.  The next run -- the other set, the other
 * way -- is timed to arrive about 60 s after this one leaves.
 *
 * The crossing is worked from where the trains actually are.  For each
 * set the service looks ahead along its own motion -- cruising, braking to
 * a stop short of the crossing, or sitting at the platform about to leave
 * over it -- and the crossing closes when the front is predicted within
 * 25 s of it, and stays closed while any part of a train is within 4 m.
 * ------------------------------------------------------------------ */

export const SERVICE = {
  cruise: 22,          // m/s
  brake: 1.0,          // m/s²
  accel: 0.9,
  dwell: 60,           // doors open, s
  doorOpen: 1.6,
  doorClose: 2.2,
  chime: 1.4,          // the chime plays before the doors close
  hold: 3,             // doors shut, before pulling away
  appear: 420,         // m from the stop where a run begins
  headway: 60,         // departure to the next arrival, s
  warn: 25,            // the crossing closes this long before a train reaches it
  margin: 4,           // and stays closed while a train is this close
  armDelay: 5,         // lamps and bells first, then the arms
  armDown: 6,
  armUp: 5,
};

const S = SERVICE;
const STOP_X = TOWN.station.stopX;
const CROSS_X = TOWN.rail.crossX;

/** One set's motion: the phase machine, steppable on its own (for prediction). */
function stepRun(r, dt, emit) {
  let t = dt;
  while (t > 0) {
    const h = Math.min(t, 0.05);
    t -= h;
    r.t += h;
    switch (r.phase) {
      case 'idle': break;
      case 'approach': {
        const d = r.dir * (STOP_X - r.x);                // to the stop
        const need = (r.v * r.v) / (2 * S.brake);
        if (d <= need + 1e-6) r.phase = 'braking';
        else { r.x += r.dir * r.v * h; break; }
      }
      // falls through
      case 'braking': {
        const d = Math.max(0, r.dir * (STOP_X - r.x));
        r.v = Math.sqrt(2 * S.brake * d);
        const move = Math.min(d, r.v * h + 0.5 * S.brake * h * h);
        r.x += r.dir * move;
        if (d - move < 0.01) { r.x = STOP_X; r.v = 0; r.phase = 'opening'; r.t = 0; emit?.('arrive', r); }
        break;
      }
      case 'opening':
        r.doors = Math.min(1, r.t / S.doorOpen);
        if (r.t >= S.doorOpen) { r.phase = 'dwell'; r.t = 0; emit?.('doorsOpen', r); }
        break;
      case 'dwell':
        if (r.t >= S.dwell) { r.phase = 'chime'; r.t = 0; emit?.('chime', r); }
        break;
      case 'chime':
        if (r.t >= S.chime) { r.phase = 'closing'; r.t = 0; }
        break;
      case 'closing':
        r.doors = Math.max(0, 1 - r.t / S.doorClose);
        if (r.t >= S.doorClose) { r.doors = 0; r.phase = 'hold'; r.t = 0; emit?.('doorsClosed', r); }
        break;
      case 'hold':
        if (r.t >= S.hold) { r.phase = 'depart'; r.t = 0; emit?.('depart', r); }
        break;
      case 'depart':
        r.v = Math.min(S.cruise, r.v + S.accel * h);
        r.x += r.dir * r.v * h;
        if (r.dir * (r.x - STOP_X) > S.appear + 40) { r.phase = 'idle'; emit?.('gone', r); }
        break;
      default: break;
    }
  }
}

/** Seconds of one run: appear -> stop. */
function approachTime() {
  const brakeDist = (S.cruise * S.cruise) / (2 * S.brake);
  return (S.appear - brakeDist) / S.cruise + S.cruise / S.brake;
}

export function makeService({ sets, crossing, onEvent }) {
  // run state per set: set 0 eastbound on track 1, set 1 westbound on track 2
  const runs = sets.map((emu, i) => ({
    i, emu, dir: i === 0 ? 1 : -1, z: TRACK_Z[i], x: 0, v: 0, doors: 0,
    phase: 'idle', t: 0, len: emu.length,
  }));
  const events = [];
  let clock = 0;
  let nextStart = { set: 0, at: 0 };        // the first run begins at once
  const cross = { closing: false, since: 0, armT: 0, blink: 0, bells: false, arrows: { east: false, west: false } };

  const emit = (name, r) => {
    events.push({ t: +clock.toFixed(2), name, set: r.i, track: r.i + 1, dir: r.dir > 0 ? 'east' : 'west' });
    if (name === 'depart') {
      // the other set arrives a headway after this one leaves
      nextStart = { set: 1 - r.i, at: clock + S.headway - approachTime() };
    }
    onEvent?.(name, r);
  };

  function begin(r) {
    r.phase = 'approach';
    r.x = STOP_X - r.dir * S.appear;
    r.v = S.cruise;
    r.t = 0;
    r.doors = 0;
    r.emu.setDest(r.dir > 0 ? 'east' : 'west');
    emit('appear', r);
  }

  /** Where the front will be relative to the crossing: seconds until it is within the margin. */
  function timeToCrossing(r) {
    if (r.phase === 'idle') return Infinity;
    const front = (x) => x + r.dir * (r.len / 2);
    const rear = (x) => x - r.dir * (r.len / 2);
    const occupies = (x) => {
      const lo = Math.min(front(x), rear(x)) - S.margin, hi = Math.max(front(x), rear(x)) + S.margin;
      return CROSS_X > lo && CROSS_X < hi;
    };
    if (occupies(r.x)) return 0;
    // passed it already?
    if (r.dir * (CROSS_X - front(r.x)) < 0) return Infinity;
    const probe = { ...r };
    for (let k = 1; k <= S.warn * 4; k++) {
      stepRun(probe, 0.25);
      if (occupies(probe.x)) return k * 0.25;
      if (probe.phase === 'idle') break;
    }
    return Infinity;
  }

  function place(r) {
    const g = r.emu.group;
    g.visible = r.phase !== 'idle';
    g.position.set(r.x, 0, r.z);
    g.rotation.y = r.dir > 0 ? 0 : Math.PI;
    r.emu.setDoors(r.doors);
  }

  const api = {
    runs, events, cross,
    get clock() { return clock; },
    update(dt) {
      clock += dt;
      if (clock >= nextStart.at && runs[nextStart.set].phase === 'idle') {
        const r = runs[nextStart.set];
        nextStart = { set: 1 - r.i, at: Infinity };
        begin(r);
      }
      for (const r of runs) {
        const x0 = r.x;
        stepRun(r, dt, emit);
        r.emu.spin(Math.abs(r.x - x0));
        place(r);
      }
      // the crossing
      let soonest = Infinity, east = false, west = false;
      for (const r of runs) {
        const tc = timeToCrossing(r);
        if (tc < S.warn) { soonest = Math.min(soonest, tc); if (r.dir > 0) east = true; else west = true; }
      }
      const closing = soonest < S.warn;
      if (closing && !cross.closing) cross.since = 0;
      cross.closing = closing;
      cross.since += dt;
      const target = closing && cross.since > S.armDelay ? 1 : closing ? cross.armT : 0;
      const rate = dt / (target > cross.armT ? S.armDown : S.armUp);
      cross.armT = target > cross.armT ? Math.min(target, cross.armT + rate) : Math.max(target, cross.armT - rate);
      cross.blink = (cross.blink + dt * 1) % 1;          // each lamp lit half of every second: ~2 flashes a second between them
      cross.bells = closing;
      cross.arrows = { east, west };
      crossing.setArms(cross.armT);
      crossing.setLamps(closing, cross.blink);
      crossing.setArrows(closing ? cross.arrows : {});
    },
    /** Rows for the departure boards: the next train each way. */
    boardRows(now = new Date()) {
      const rows = [];
      for (const r of runs) {
        let secs;
        if (r.phase === 'idle') secs = nextStart.set === r.i && Number.isFinite(nextStart.at) ? nextStart.at - clock + approachTime() + S.doorOpen + S.dwell + S.chime + S.doorClose + S.hold : 300;
        else if (r.phase === 'approach' || r.phase === 'braking') secs = 45 + S.dwell;
        else if (r.phase === 'depart') secs = 240;
        else secs = { opening: S.dwell, dwell: S.dwell - r.t, chime: 3, closing: 2, hold: 1 }[r.phase] ?? 60;
        const at = new Date(now.getTime() + Math.max(0, secs) * 1000);
        const d = r.dir > 0 ? LINE.dest.east : LINE.dest.west;
        rows.push({ secs, time: `${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')}`, kind: d.kind, dest: d.jp, track: r.i + 1 });
      }
      return rows.sort((a, b) => a.secs - b.secs);
    },
    /** Dev: stand the service in a given moment, for screenshots. */
    stage(kind) {
      for (const r of runs) { r.phase = 'idle'; r.v = 0; r.doors = 0; }
      if (kind === 'platform') {
        const r = runs[0];
        Object.assign(r, { phase: 'dwell', t: 20, x: STOP_X, doors: 1 });
        r.emu.setDest('east');
      } else if (kind === 'platform2') {
        const r = runs[1];
        Object.assign(r, { phase: 'dwell', t: 20, x: STOP_X, doors: 1 });
        r.emu.setDest('west');
      } else if (kind === 'crossing') {
        // westbound pulling out over the crossing, gates down
        const r = runs[1];
        Object.assign(r, { phase: 'depart', t: 8, v: 6, x: CROSS_X + 6, doors: 0 });
        r.emu.setDest('west');
      } else if (kind === 'approach') {
        // eastbound coming in, front 25 m short of the crossing
        const r = runs[0];
        Object.assign(r, { phase: 'approach', v: S.cruise, x: CROSS_X - 25 - r.len / 2 });
        r.emu.setDest('east');
      }
      for (const r of runs) place(r);
      nextStart = { set: 0, at: Infinity };
      // settle the crossing straight into its state
      let soonest = Infinity, east = false, west = false;
      for (const r of runs) { const tc = timeToCrossing(r); if (tc < S.warn) { soonest = Math.min(soonest, tc); if (r.dir > 0) east = true; else west = true; } }
      const closing = soonest < S.warn;
      Object.assign(cross, { closing, since: 10, armT: closing ? 1 : 0, bells: closing, arrows: { east, west } });
      crossing.setArms(cross.armT);
      crossing.setLamps(closing, 0.2);
      crossing.setArrows(closing ? cross.arrows : {});
    },
  };
  return api;
}
