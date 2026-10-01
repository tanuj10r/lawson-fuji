import * as THREE from 'three';
import { clamp } from './util.js';
import { SPAWN, PLAYER } from '../config.js';

/* ------------------------------------------------------------------ *
 * First-person walker.
 *
 * Pointer-lock look, accelerated movement on the arrow keys (WASD too), axis-separated AABB
 * collision against the street's colliders, and a terrain height query so
 * the player steps up onto kerbs and follows the slope beyond the
 * crossing.  Deliberately no jump, no crouch, no third person.
 *
 * The world is flat: +Y is up everywhere, and the camera sits straight
 * above the player's feet.
 * ------------------------------------------------------------------ */

const EYE = PLAYER.eye;
const RADIUS = 0.34;
const STEP = 0.38;
/** The walking keys: the arrows (shown), WASD (still works, not shown); Space pauses. */
const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space']);
/* seated, only a walking key stands you up (Tan: the mouse looks around; the arrows get you up) */
const STAND_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);

export class Player {
  constructor(camera, domElement, world, opts = {}) {
    this.camera = camera;
    this.dom = domElement;
    this.world = world;

    this.pos = new THREE.Vector3(...(opts.pos ?? SPAWN.pos));
    this.yaw = opts.yaw ?? SPAWN.yaw;
    this.pitch = opts.pitch ?? SPAWN.pitch;
    this.vel = new THREE.Vector3();
    this.bob = 0;
    this.locked = false;
    this.keys = new Set();
    this.walkSpeed = 2.55;
    this.runSpeed = 5.1;
    this.sensitivity = 0.0022;

    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 3.0;
    this.hovered = null;
    this.onInteract = null;
    this.onLockChange = null;
    /* While `holdLook` is set (a hero camera is framed), small mouse motion is
     * ignored, so taking the pointer lock does not knock the framing.  A
     * deliberate look clears it and calls `onReleaseLook`. */
    this.holdLook = false;
    this.onReleaseLook = null;
    this.looked = 0;
    this._slack = 0;
    /* Seated (Tan's experiences): see sit() / stand().  null when walking. */
    this.seat = null;

    this._bind();
    this.applyCamera(0);
  }

  _bind() {
    const onMove = (e) => {
      if (!this.locked || this.suspended) return;     // suspended: the full map is open
      this.looked += Math.abs(e.movementX) + Math.abs(e.movementY);   // (main.js: a look of your own takes the view back from a guided one)
      if (this.seat) {
        // seated (once settled), the mouse looks around from the bench: a wide
        // turn either way, up and down; standing is the walking keys' job
        if (this.seat.dir > 0 && this.seat.k > 0.98) {
          const L = this.seat.look;
          L.yaw = clamp(L.yaw - e.movementX * this.sensitivity, -1.9, 1.9);
          L.pitch = clamp(L.pitch - e.movementY * this.sensitivity, -0.9, 0.8);
        }
        return;
      }
      if (this.holdLook) {
        this._slack += Math.abs(e.movementX) + Math.abs(e.movementY);
        if (this._slack < 60) return;
        this.holdLook = false;
        this.onReleaseLook?.();
      }
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      this.pitch = clamp(this.pitch, -1.15, 1.05);
    };
    document.addEventListener('mousemove', onMove);

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (!this.locked) this.keys.clear();
      this.onLockChange?.(this.locked);
    });

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const c = e.code;
      this.keys.add(c);
      if (this.seat) {
        // seated: a walking key stands you up; the rest do their own thing (main.js)
        if (STAND_KEYS.has(c) && this.locked && this.seat.dir > 0) this.stand();
        if (MOVE_KEYS.has(c) && this.locked) e.preventDefault();
        return;
      }
      if (c === 'KeyE' && this.locked) this.onInteract?.(this.hovered);
      if (MOVE_KEYS.has(c) && this.locked) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** Freeze the view against small mouse motion (see `holdLook`). */
  hold() {
    this.holdLook = true;
    this._slack = 0;
  }

  /**
   * Sit down (Tan's experiences; world/land/slowlife.js is the first user).
   * The view eases over ~1.4 s from where you stand to the seat: feet to
   * (x, z), the eye down to `eyeY` above the ground, the look to `yaw` /
   * `pitch` (world frame), with a small settle at the end.  Seated, the
   * view is held and nothing moves you; any key, or a deliberate mouse
   * move, stands you up again (back where you stood, facing where you
   * sat).  `onStand` is called as you start to rise.
   *
   *   player.sit({ x, z, yaw, pitch = 0, eyeY = 1.1, onStand })
   *   player.stand()
   *   player.seated     // true from sit() until you start to rise
   */
  sit({ x, z, yaw, pitch = 0, eyeY = 1.1, onStand = null } = {}) {
    if (this.seat) return;
    this.vel.set(0, 0, 0);
    this.keys.clear();
    this.holdLook = false;
    // the shortest way round to the seat's heading
    let to = yaw ?? this.yaw;
    while (to - this.yaw > Math.PI) to -= Math.PI * 2;
    while (to - this.yaw < -Math.PI) to += Math.PI * 2;
    this.seat = {
      from: { x: this.pos.x, z: this.pos.z, yaw: this.yaw, pitch: this.pitch },
      to: { x, z, yaw: to, pitch },
      eyeY, onStand, k: 0, dir: 1, slack: 0, look: { yaw: 0, pitch: 0 },
    };
  }

  /** Stand up from sit(): eases back to where you stood, facing as you sat. */
  stand() {
    const s = this.seat;
    if (!s || s.dir < 0) return;
    s.dir = -1;
    // rise facing the way you were looking, the look level
    s.from.yaw = s.to.yaw + s.look.yaw;
    s.from.pitch = 0;
    s.to.yaw += s.look.yaw;
    s.look.yaw = 0; s.look.pitch = 0;
    s.onStand?.();
  }

  get seated() { return !!this.seat && this.seat.dir > 0; }

  /** A frame of sitting down, sitting, or getting up. */
  _seatUpdate(dt) {
    const s = this.seat;
    s.k = clamp(s.k + (dt * s.dir) / (s.dir > 0 ? 1.4 : 0.8), 0, 1);
    const k = s.k;
    const e = k * k * (3 - 2 * k);                      // the move: smooth in and out
    // the eye drops a touch past the seat and comes back up (a gentle settle)
    const settle = s.dir > 0 ? Math.sin(Math.min(1, Math.max(0, (k - 0.55) / 0.45)) * Math.PI) * 0.035 : 0;
    const a = s.from, b = s.to;
    this.pos.x = a.x + (b.x - a.x) * e;
    this.pos.z = a.z + (b.z - a.z) * e;
    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z, this.pos.y);
    this.yaw = a.yaw + (b.yaw - a.yaw) * e + s.look.yaw;
    this.pitch = clamp(a.pitch + (b.pitch - a.pitch) * e + s.look.pitch, -1.15, 1.05);
    this.bob = 0;
    this.vel.set(0, 0, 0);
    const eye = this.pos.y + EYE + (s.eyeY - EYE) * e - settle;
    this.camera.position.set(this.pos.x, eye, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    if (s.dir < 0 && k === 0) this.seat = null;         // up again: walking resumes
  }

  /** Ask for the pointer; the browser's promise where it gives one (a refusal is not an error: the next try may do). */
  lock() {
    const r = this.dom.requestPointerLock?.();
    r?.catch?.(() => {});
    return r;
  }

  /** Push the player out of any collider it overlaps, one axis at a time. */
  _resolve(colliders, feetY) {
    const p = this.pos;
    const r = RADIUS;
    for (const c of colliders) {
      if (c.top !== undefined && c.top <= feetY + STEP) continue;
      if (c.bottom !== undefined && c.bottom > feetY + 1.9) continue;
      const x0 = c.x0 - r, x1 = c.x1 + r;
      const z0 = c.z0 - r, z1 = c.z1 + r;
      if (p.x <= x0 || p.x >= x1 || p.z <= z0 || p.z >= z1) continue;
      // smallest push-out wins
      const dxL = p.x - x0, dxR = x1 - p.x;
      const dzL = p.z - z0, dzR = z1 - p.z;
      const m = Math.min(dxL, dxR, dzL, dzR);
      if (m === dxL) p.x = x0;
      else if (m === dxR) p.x = x1;
      else if (m === dzL) p.z = z0;
      else p.z = z1;
    }
  }

  update(dt) {
    if (this.seat) { this._seatUpdate(dt); return; }
    const k = this.keys;
    const sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    const speed = sprint ? this.runSpeed : this.walkSpeed;

    let fwd = 0, side = 0;
    if (this.locked && !this.suspended) {
      if (k.has('KeyW') || k.has('ArrowUp')) fwd += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) fwd -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) side += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) side -= 1;
    }

    this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this._wish
      .copy(this._forward).multiplyScalar(fwd)
      .addScaledVector(this._right, side);
    if (this._wish.lengthSq() > 1e-6) this._wish.normalize().multiplyScalar(speed);

    // critically-damped approach to the wish velocity: responsive but never twitchy
    const accel = this._wish.lengthSq() > 1e-6 ? 13 : 16;
    const a = 1 - Math.exp(-accel * dt);
    this.vel.x += (this._wish.x - this.vel.x) * a;
    this.vel.z += (this._wish.z - this.vel.z) * a;

    const feetY = this.world.heightAt(this.pos.x, this.pos.z);
    const colliders = this.world.colliders;

    const stepX = this.vel.x * dt;
    const stepZ = this.vel.z * dt;
    // sub-step so fast sprinting can't tunnel through thin walls
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(stepX), Math.abs(stepZ)) / 0.18));
    for (let i = 0; i < n; i++) {
      this.pos.x += stepX / n;
      this._resolve(colliders, feetY);
      this.pos.z += stepZ / n;
      this._resolve(colliders, feetY);
    }

    const bounds = this.world.bounds;
    this.pos.x = clamp(this.pos.x, bounds.x0, bounds.x1);
    this.pos.z = clamp(this.pos.z, bounds.z0, bounds.z1);

    /* Passing the current feet height is what lets an elevated platform be
     * walked under as well as on: `heightAt` only offers a platform within a
     * step of where you already are. */
    const targetY = this.world.heightAt(this.pos.x, this.pos.z, this.pos.y);
    this.pos.y += (targetY - this.pos.y) * (1 - Math.exp(-18 * dt));

    const moving = Math.hypot(this.vel.x, this.vel.z);
    this.bob += dt * moving * (sprint ? 8.2 : 6.4);
    this.applyCamera(moving);
  }

  /** Place the camera at eye height above the player's feet. */
  applyCamera(moving) {
    const amp = Math.min(moving / this.walkSpeed, 1) * 0.014;
    const eye = this.pos.y + EYE + Math.sin(this.bob) * amp;
    this.camera.position.set(this.pos.x, eye, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bob * 0.5) * amp * 0.35, 'YXZ');
  }

  /** Ray-test the interactable list; returns the closest one in range. */
  pick(interactables) {
    if (!interactables.length) {
      this.hovered = null;
      return null;
    }
    this.raycaster.set(
      this.camera.position,
      this._forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion)
    );
    const meshes = interactables.map((i) => i.hitbox);
    const hits = this.raycaster.intersectObjects(meshes, false);
    this.hovered = hits.length ? interactables[meshes.indexOf(hits[0].object)] : null;
    return this.hovered;
  }
}
