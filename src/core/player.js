import * as THREE from 'three';
import { clamp } from './util.js';
import { SPAWN, HERO } from '../config.js';

/* ------------------------------------------------------------------ *
 * First-person walker.
 *
 * Pointer-lock look, accelerated WASD movement, axis-separated AABB
 * collision against the street's colliders, and a terrain height query so
 * the player steps up onto kerbs and follows the slope beyond the
 * crossing.  Deliberately no jump, no crouch, no third person.
 *
 * The world is flat: +Y is up everywhere, and the camera sits straight
 * above the player's feet.
 * ------------------------------------------------------------------ */

const EYE = HERO.eye;
const RADIUS = 0.34;
const STEP = 0.38;

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

    this._bind();
    this.applyCamera(0);
  }

  _bind() {
    const onMove = (e) => {
      if (!this.locked) return;
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
      if (c === 'KeyE' && this.locked) this.onInteract?.(this.hovered);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(c) && this.locked) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  lock() {
    this.dom.requestPointerLock?.();
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
    const k = this.keys;
    const sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    const speed = sprint ? this.runSpeed : this.walkSpeed;

    let fwd = 0, side = 0;
    if (this.locked) {
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
