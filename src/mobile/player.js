import { Player } from '../core/player.js';
import { clamp } from '../core/util.js';
import { MOBILE } from '../config.js';

/* ------------------------------------------------------------------ *
 * The walker on a phone (docs/decisions/mobile-lite.md): core/player.js's
 * walker, its collisions, seat and camera, with touch in place of the
 * pointer lock.
 *
 *   locked   means "playing" here (no pointer lock on phones): lock() and
 *            unlock() set it, and onLockChange fires as on desktop, so the
 *            world's code that asks `player.locked` works unchanged
 *   stick    the left thumb's joystick, { x, y } in -1..1 (touch.js): the
 *            push sets the pace, past MOBILE.stick.run it runs
 *   look()   a drag's movement, CSS px (touch.js)
 *
 * The arrow keys, WASD, Shift and E still work (a keyboard, or testing on
 * a computer), and a drag with the mouse looks.
 * ------------------------------------------------------------------ */

const MOVE = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);

export class TouchPlayer extends Player {
  constructor(camera, domElement, world, opts) {
    super(camera, domElement, world, opts);
    this.sensitivity = MOBILE.look;
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

  /** The stick's push, 0..1 (keys count as a full push). */
  get push() {
    return Math.min(1, Math.hypot(this.stick.x, this.stick.y));
  }

  update(dt) {
    // seated, a push on the stick stands you up (the walking keys do on desktop)
    if (this.seat) {
      if (this.locked && this.seat.dir > 0 && this.push > 0.5) this.stand();
      this._seatUpdate(dt);
      return;
    }
    const k = this.keys;
    let fwd = 0, side = 0, pace = 0;
    if (this.locked && !this.suspended) {
      // the stick: analog, up is forward
      fwd = -this.stick.y; side = this.stick.x;
      pace = this.push;
      // or the keys, a full push
      let kf = 0, ks = 0;
      if (k.has('KeyW') || k.has('ArrowUp')) kf += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) kf -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) ks += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) ks -= 1;
      if (kf || ks) { fwd = kf; side = ks; pace = k.has('ShiftLeft') || k.has('ShiftRight') ? 1 : MOBILE.stick.run - 0.01; }
    }
    const run = pace >= MOBILE.stick.run;
    // below the run threshold, the pace scales from a stroll to a walk
    const speed = run ? this.runSpeed : this.walkSpeed * Math.min(1, 0.35 + 0.65 * pace / MOBILE.stick.run);

    this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this._wish.copy(this._forward).multiplyScalar(fwd).addScaledVector(this._right, side);
    if (this._wish.lengthSq() > 1e-6) this._wish.normalize().multiplyScalar(speed);

    const accel = this._wish.lengthSq() > 1e-6 ? 13 : 16;
    const a = 1 - Math.exp(-accel * dt);
    this.vel.x += (this._wish.x - this.vel.x) * a;
    this.vel.z += (this._wish.z - this.vel.z) * a;

    const feetY = this.world.heightAt(this.pos.x, this.pos.z);
    const colliders = this.world.colliders;
    const stepX = this.vel.x * dt, stepZ = this.vel.z * dt;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(stepX), Math.abs(stepZ)) / 0.18));
    for (let i = 0; i < n; i++) {
      this.pos.x += stepX / n;
      this._resolve(colliders, feetY);
      this.pos.z += stepZ / n;
      this._resolve(colliders, feetY);
    }
    const b = this.world.bounds;
    this.pos.x = clamp(this.pos.x, b.x0, b.x1);
    this.pos.z = clamp(this.pos.z, b.z0, b.z1);
    const targetY = this.world.heightAt(this.pos.x, this.pos.z, this.pos.y);
    this.pos.y += (targetY - this.pos.y) * (1 - Math.exp(-18 * dt));

    const moving = Math.hypot(this.vel.x, this.vel.z);
    this.bob += dt * moving * (run ? 8.2 : 6.4);
    this.applyCamera(moving);
  }
}
