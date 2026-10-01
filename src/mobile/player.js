import { Player } from '../core/player.js';
import { clamp } from '../core/util.js';
import { TUNE, stickPace, smoothstep } from './pocket/controls/tune.js';

const RADIUS = 0.34, STEP = 0.38;      // core/player.js's body and step

/* ------------------------------------------------------------------ *
 * The walker on a phone (docs/decisions/mobile-lite.md): core/player.js's
 * walker, its collisions, seat and camera, with touch in place of the
 * pointer lock.
 *
 *   locked   means "playing" here (no pointer lock on phones): lock() and
 *            unlock() set it, and onLockChange fires as on desktop, so the
 *            world's code that asks `player.locked` works unchanged
 *   stick    the left thumb's joystick, { x, y } in -1..1 (touch.js): a
 *            small push strolls, a full one walks (tune.js stickPace), and
 *            held at the edge for TUNE.stick.runAfter s it breaks into a
 *            run, eased in (pocket diorama, builder 5)
 *   look()   a drag's movement, CSS px already through the look's curve
 *            (touch.js); walking with no look for a moment, the pitch
 *            settles softly back toward level
 *   walls    the body is a circle against the colliders' boxes, so it
 *            glides along a wall or round a corner instead of stopping;
 *            pushing at a wall at a slant keeps most of the pace
 *
 * The arrow keys, WASD, Shift and E still work (a keyboard, or testing on
 * a computer), and a drag with the mouse looks.
 * ------------------------------------------------------------------ */

const MOVE = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);

export class TouchPlayer extends Player {
  constructor(camera, domElement, world, opts) {
    super(camera, domElement, world, opts);
    this.sensitivity = TUNE.look.base;
    this.running = false;
    this.onRun = null;              // (running) => {} when it changes (touch.js lights the stick's ring)
    this._edgeT = 0;                // s the stick has been held at the edge
    this._runK = 0;                 // 0 walk .. 1 run, eased
    this._lookAt = 0;               // performance.now() of the last look
    this._normal = { x: 0, z: 0, hit: false };
  }

  /* core/player.js binds the mouse and the pointer lock here: a phone has
   * neither (and a tap's compatibility mousemove would jerk the view). */
  _bind() {
    this.stick = { x: 0, y: 0 };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (!this.locked) return;
      if (this.seat) { if (MOVE.has(e.code) && this.seat.dir > 0) this.stand(); return; }
      if (e.code === 'KeyE') this.onInteract?.(this.hovered);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.stick.x = this.stick.y = 0; });
  }

  lock() {
    if (this.locked) return;
    this.locked = true;
    this.onLockChange?.(true);
  }

  unlock() {
    if (!this.locked) return;
    this.locked = false;
    this.keys.clear();
    this.stick.x = this.stick.y = 0;
    this.onLockChange?.(false);
  }

  /** A drag: dx, dy in CSS px (as the mouse's movementX/Y on desktop). */
  look(dx, dy) {
    if (!this.locked || this.suspended) return;
    this.looked += Math.abs(dx) + Math.abs(dy);
    this._lookAt = performance.now();
    const s = this.sensitivity;
    if (this.seat) {
      if (this.seat.dir > 0 && this.seat.k > 0.98) {
        const L = this.seat.look;
        L.yaw = clamp(L.yaw - dx * s, -1.9, 1.9);
        L.pitch = clamp(L.pitch - dy * s, -0.9, 0.8);
      }
      return;
    }
    if (this.holdLook) {
      this._slack += Math.abs(dx) + Math.abs(dy);
      if (this._slack < 24) return;
      this.holdLook = false;
      this.onReleaseLook?.();
    }
    this.yaw -= dx * s;
    this.pitch = clamp(this.pitch - dy * s, -1.15, 1.05);
  }

  /* The body against the colliders: a circle (RADIUS) against each box,
   * pushed out along the nearest way (round a corner, the corner's own
   * direction), so it slides along walls and rounds corners smoothly
   * instead of snagging; the push's direction is kept (the wall's normal)
   * for the slide (update).  core/player.js's step-up rule: a box whose
   * top is within STEP of the feet is walked onto, not into. */
  _resolve(colliders, feetY) {
    const p = this.pos, r = RADIUS, N = this._normal;
    for (const c of colliders) {
      if (c.top !== undefined && c.top <= feetY + STEP) continue;
      if (c.bottom !== undefined && c.bottom > feetY + 1.9) continue;
      if (p.x <= c.x0 - r || p.x >= c.x1 + r || p.z <= c.z0 - r || p.z >= c.z1 + r) continue;
      const qx = clamp(p.x, c.x0, c.x1), qz = clamp(p.z, c.z0, c.z1);
      let nx = p.x - qx, nz = p.z - qz;
      const d2 = nx * nx + nz * nz;
      if (d2 >= r * r) continue;                       // the box's corner, rounded: clear of it
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        nx /= d; nz /= d;
        p.x = qx + nx * r; p.z = qz + nz * r;
      } else {
        // the centre inside the box (a spawn or a teleport): out the nearest side
        const dxL = p.x - c.x0, dxR = c.x1 - p.x, dzL = p.z - c.z0, dzR = c.z1 - p.z;
        const m = Math.min(dxL, dxR, dzL, dzR);
        nx = 0; nz = 0;
        if (m === dxL) { p.x = c.x0 - r; nx = -1; } else if (m === dxR) { p.x = c.x1 + r; nx = 1; } else if (m === dzL) { p.z = c.z0 - r; nz = -1; } else { p.z = c.z1 + r; nz = 1; }
      }
      N.x += nx; N.z += nz; N.hit = true;
    }
  }

  /** The stick's push, 0..1 (keys count as a full push). */
  get push() {
    return Math.min(1, Math.hypot(this.stick.x, this.stick.y));
  }

  update(dt) {
    // seated, a push on the stick stands you up (the walking keys do on desktop)
    if (this.seat) {
      if (this.locked && this.seat.dir > 0 && this.push > 0.5) this.stand();
      this._seatUpdate(dt);
      this._setRun(false);
      return;
    }
    const S = TUNE.stick, k = this.keys;
    let fwd = 0, side = 0, push = 0, keyRun = false, keyed = false;
    if (this.locked && !this.suspended) {
      // the stick: analog, up is forward
      fwd = -this.stick.y; side = this.stick.x;
      push = this.push;
      // or the keys, a full push (Shift runs)
      let kf = 0, ks = 0;
      if (k.has('KeyW') || k.has('ArrowUp')) kf += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) kf -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) ks += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) ks -= 1;
      if (kf || ks) { fwd = kf; side = ks; push = 1; keyed = true; keyRun = k.has('ShiftLeft') || k.has('ShiftRight'); }
    }
    // held at the edge a moment, it breaks into a run; the run lasts while the push stays high
    if (keyed) { this._edgeT = 0; this._setRun(keyRun); }
    else {
      this._edgeT = push >= S.edge ? this._edgeT + dt : 0;
      if (!this.running && this._edgeT >= S.runAfter) this._setRun(true);
      else if (this.running && push < S.runHold) this._setRun(false);
    }
    this._runK += ((this.running ? 1 : 0) - this._runK) * (1 - Math.exp(-dt / Math.max(0.05, S.runBlend / 3)));
    const walk = this.walkSpeed * stickPace(push);
    const speed = push > 0 ? walk + (this.runSpeed - walk) * this._runK : 0;

    this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this._wish.copy(this._forward).multiplyScalar(fwd).addScaledVector(this._right, side);
    if (this._wish.lengthSq() > 1e-6) this._wish.normalize().multiplyScalar(speed);

    /* Wall sliding: against the wall touched last frame, the wish loses only
     * its part into the wall; at a slant the rest is kept near the full
     * pace, so a thumb that is roughly right glides along. */
    const N = this._normal;
    if (N.hit) {
      const nl = Math.hypot(N.x, N.z) || 1, nx = N.x / nl, nz = N.z / nl;
      const into = this._wish.x * nx + this._wish.z * nz;
      if (into < 0) {
        const w = this._wish.length();
        this._wish.x -= nx * into; this._wish.z -= nz * into;
        const t = this._wish.length();
        // the share left along the wall, lifted toward the whole pace the more it slants (smoothly: no step)
        if (t > 1e-4) {
          const u = t / w, f = smoothstep(0.08, 0.5, u);
          this._wish.multiplyScalar((t + (w * (0.55 + 0.45 * u) - t) * f) / t);
        }
      }
      const vin = this.vel.x * nx + this.vel.z * nz;
      if (vin < 0) { this.vel.x -= nx * vin; this.vel.z -= nz * vin; }
    }

    const accel = this._wish.lengthSq() > 1e-6 ? 11 : 15;
    const a = 1 - Math.exp(-accel * dt);
    this.vel.x += (this._wish.x - this.vel.x) * a;
    this.vel.z += (this._wish.z - this.vel.z) * a;

    const feetY = this.world.heightAt(this.pos.x, this.pos.z);
    const colliders = this.world.colliders;
    const stepX = this.vel.x * dt, stepZ = this.vel.z * dt;
    const n = Math.max(1, Math.ceil(Math.hypot(stepX, stepZ) / 0.15));
    N.x = N.z = 0; N.hit = false;
    for (let i = 0; i < n; i++) {
      this.pos.x += stepX / n;
      this.pos.z += stepZ / n;
      this._resolve(colliders, feetY);
    }
    const b = this.world.bounds;
    if (b) {
      if (this.pos.x < b.x0 || this.pos.x > b.x1) { N.x += this.pos.x < b.x0 ? 1 : -1; N.hit = true; }
      if (this.pos.z < b.z0 || this.pos.z > b.z1) { N.z += this.pos.z < b.z0 ? 1 : -1; N.hit = true; }
      this.pos.x = clamp(this.pos.x, b.x0, b.x1);
      this.pos.z = clamp(this.pos.z, b.z0, b.z1);
    }
    const targetY = this.world.heightAt(this.pos.x, this.pos.z, this.pos.y);
    this.pos.y += (targetY - this.pos.y) * (1 - Math.exp(-18 * dt));

    const moving = Math.hypot(this.vel.x, this.vel.z);
    /* walking with no look for a moment: the view settles softly back toward level (a phone
     * held in a hand drifts; standing still, where you looked stays) */
    const L = TUNE.look;
    if (moving > 0.6 && !this.holdLook && dt > 0 && performance.now() - this._lookAt > L.settleAfter * 1000) {
      this.pitch += (L.settleTo - this.pitch) * (1 - Math.exp(-L.settleRate * dt * Math.min(1, moving / this.walkSpeed)));
    }
    this.bob += dt * moving * (this._runK > 0.5 ? 8.2 : 6.4);
    this.applyCamera(moving);
  }

  _setRun(on) {
    if (on === this.running) return;
    this.running = on;
    this.onRun?.(on);
  }

  /** For tests and ?diag: the walk as numbers. */
  get gait() {
    return { push: +this.push.toFixed(3), speed: +Math.hypot(this.vel.x, this.vel.z).toFixed(3), running: this.running, runK: +this._runK.toFixed(2), edgeT: +this._edgeT.toFixed(2) };
  }
}
