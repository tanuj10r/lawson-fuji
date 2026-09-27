import { TOWN } from '../../config.js';
import { RIDE } from '../../data/town.js';
import { soundBus } from '../../core/soundBus.js';
import { SERVICE } from './service.js';
import { TRACK_Z } from './track.js';
import { CAR_W, FLOOR, DOORS, DOOR_W, PITCH, CAR_L, carColliders } from './emu.js';

/* ------------------------------------------------------------------ *
 * Boarding the train at platform 1 (Tan: "the player can walk in").
 *
 * While the eastbound set stands at platform 1 with its doors open, the
 * platform edge opens at each door and the car is a room: a floor, its
 * seats and walls as colliders.  Step in and the in-train announcement
 * plays once ("Next stop is Shibuya"), heard inside.  At the chime the
 * subtitle asks you to step off; if you're still aboard the screen dips
 * for a moment and you're standing on the platform by the door.  The
 * train never carries you away and never shuts you in: whenever it is not
 * standing at the platform, anyone found inside is put back on it.
 *
 * The world has no hook to the player or the HUD, so this reaches them
 * through window.__scene (main.js sets it on every build).  HOOK WANTED:
 * ctx.player / ctx.say (see the report).  Everything here degrades to
 * nothing if they are missing.
 * ------------------------------------------------------------------ */

const STOP_X = TOWN.station.stopX;
const Z = TRACK_Z[0];                                 // track 1: the eastbound set stands here
const HALF = PITCH / 2 + CAR_L / 2;                   // the set's half length (two cars)
const BERTH_PHASES = new Set(['opening', 'dwell', 'chime', 'closing', 'hold']);

export const host = () => (typeof window !== 'undefined' ? window.__scene ?? null : null);
/** A subtitle: the HUD's centre note. */
export function say(text, ms = 3600) { host()?.hud?.flash?.(text, ms); }

/* a black veil for the step off (made on first use) */
let veil = null;
function setVeil(k) {
  if (typeof document === 'undefined') return;
  if (!veil) {
    veil = document.createElement('div');
    Object.assign(veil.style, { position: 'fixed', inset: '0', background: '#0b0a12', opacity: '0', pointerEvents: 'none', zIndex: '40' });
    document.body.appendChild(veil);
  }
  veil.style.opacity = String(k);
}

/**
 * @param ctx      the town's frame
 * @param service  line/service.js
 * @param P        platform 1 { edge, face, z0, z1 }
 * @param PH       platform height
 */
export function makeBoarding(ctx, { service, P, PH, sets }) {
  const run = service.runs[0];
  const toggles = [];               // colliders that come and go: { c, top, kind }
  const collide = (x0, z0, x1, z1, top, kind) => {
    ctx.collide(x0, z0, x1, z1, top);
    const c = ctx.colliders[ctx.colliders.length - 1];
    if (kind) toggles.push({ c, top, kind });
    return c;
  };

  // the cars' door centres along the platform, and the car centres
  const cars = sets[0].carX.map((c) => ({ x: STOP_X + c.x, cab: c.cab }));
  const doorsX = cars.flatMap((c) => DOORS.map((d) => c.x + d)).sort((a, b) => a - b);

  /* the floor of the cars, level with the platform (it only matters when the doors let you in) */
  ctx.platform({ x0: STOP_X - HALF - 0.1, x1: STOP_X + HALF + 0.1, z0: P.edge - 0.02, z1: Z + CAR_W / 2 - 0.1, top: FLOOR });

  /* the platform edge: solid, but open at each door while the doors are */
  {
    const z0 = P.edge - 0.1, z1 = P.edge, top = PH + 1.2;
    const gaps = doorsX.map((x) => [x - DOOR_W / 2 + 0.04, x + DOOR_W / 2 - 0.04]);
    let x = TOWN.station.platforms.x0;
    for (const [a, b] of gaps) {
      collide(x, z0, a, z1, top);
      collide(a, z0, b, z1, top, 'gap');
      x = b;
    }
    collide(x, z0, TOWN.station.platforms.x1, z1, top);
  }
  /* inside: seats, walls, the cab walls, the car's own side between the doors */
  for (const car of cars) {
    for (const [x0, z0, x1, z1, top] of carColliders(car.cab)) collide(car.x + x0, Z + z0, car.x + x1, Z + z1, top, 'inside');
    const edges = [-CAR_L / 2, ...DOORS.flatMap((d) => [d - DOOR_W / 2, d + DOOR_W / 2]), CAR_L / 2];
    for (let i = 0; i + 1 < edges.length; i += 2) {
      collide(car.x + edges[i], Z - CAR_W / 2 + 0.03, car.x + edges[i + 1], Z - CAR_W / 2 + 0.13, FLOOR + 2.4, 'inside');
    }
  }
  // the gap between the cars is walled either side of the gangway, too
  collide(STOP_X - 0.4, Z - CAR_W / 2, STOP_X + 0.4, Z - 0.5, FLOOR + 2.4, 'inside');
  collide(STOP_X - 0.4, Z + 0.5, STOP_X + 0.4, Z + CAR_W / 2, FLOOR + 2.4, 'inside');

  const set = (kind, on) => { for (const t of toggles) if (t.kind === kind) t.c.top = on ? t.top : -1e3; };
  set('inside', false);

  const isInside = (p) => p && p.x > STOP_X - HALF && p.x < STOP_X + HALF && p.z > P.edge + 0.02 && p.z < Z + CAR_W / 2;
  const nearestDoor = (x) => doorsX.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));

  let announced = false, step = null, warmed = false, far = true;
  const state = { atBerth: false, open: false };

  /** Move the player (town frame) with a short dip to black: out 0.3 s, in 0.45 s. */
  function moveTo(target, after) {
    if (step) return;
    step = { t: 0, target, moved: false, after };
  }
  function playerLocal() {
    const pl = host()?.player;
    return pl ? ctx.toLocal({ x: pl.pos.x, z: pl.pos.z }) : null;
  }
  function stepOff() {
    const p = playerLocal();
    if (!p) return;
    moveTo({ x: nearestDoor(p.x), z: P.edge - 1.35 }, () => set('gap', true));
  }

  const api = {
    state,
    doorsX,
    /** E at the spot on the platform: aboard if the doors are open. */
    board() {
      if (!state.open) { say(RIDE.say.noTrain, 2600); return false; }
      const p = playerLocal();
      const x = nearestDoor(p ? p.x : STOP_X);
      moveTo({ x: x + 0.35, z: Z - 0.2 });
      return true;
    },
    /** The service's events. */
    onEvent(name, r) {
      if (r.i !== 0) return;
      if (name === 'arrive') announced = false;
      if (name === 'chime') {
        const p = playerLocal();
        if (!p) return;
        const d = Math.hypot(Math.max(0, Math.abs(p.x - STOP_X) - HALF), p.z - Z);
        if (isInside(p)) { say(RIDE.say.doorsClosing, 3000); stepOff(); }
        else if (d < 12) say(RIDE.say.doorsClosing, 2400);
      }
    },
    update(dt, camWorld) {
      const atBerth = BERTH_PHASES.has(run.phase) && Math.abs(run.x - STOP_X) < 0.05;
      const open = atBerth && (run.phase === 'dwell' || (run.phase === 'opening' && run.doors > 0.9)) && !step;
      state.atBerth = atBerth; state.open = open;
      set('inside', atBerth);
      if (!step) set('gap', !open);

      // warm the announcement's buffer as you come near the station (the engine plays a file on its second asking)
      const cam = ctx.toLocal({ x: camWorld.x, z: camWorld.z });
      const dStation = Math.hypot(cam.x - STOP_X, cam.z - Z);
      if (dStation > 110) { far = true; warmed = false; }
      if (far && dStation < 80 && !warmed && soundBus.ready) {
        warmed = true; far = false;
        soundBus.oneShot('train-nextstop', { x: camWorld.x, z: camWorld.z, gain: 0.0001, near: 1, far: 400 });   // silent: it only fetches the file
      }

      const p = playerLocal();
      if (p && isInside(p) && !step) {
        if (!atBerth || run.phase === 'closing' || run.phase === 'hold') stepOff();       // never shut in, never carried off
        else if (open && !announced) {
          announced = true;
          const w = ctx.toWorld({ x: p.x, z: Z });
          soundBus.oneShot('train-nextstop', { x: w.x, z: w.z, y: 2.2, near: 7, far: 16, gain: 1 });
        }
      }

      // the step: dip, move, lift
      if (step) {
        step.t += dt;
        if (step.t < 0.3) setVeil(step.t / 0.3);
        else if (!step.moved) {
          step.moved = true;
          const pl = host()?.player;
          if (pl) {
            const w = ctx.toWorld({ x: step.target.x, z: step.target.z });
            pl.pos.set(w.x, pl.pos.y, w.z);
            pl.vel?.set(0, 0, 0);
          }
          step.after?.();
          setVeil(1);
        } else if (step.t < 0.8) setVeil(1 - (step.t - 0.35) / 0.45);
        else { setVeil(0); step = null; }
      }
    },
  };
  return api;
}

export { SERVICE };
