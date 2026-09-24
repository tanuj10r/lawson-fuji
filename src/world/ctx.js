import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * The builder context every part is placed through (the shape Sakura
 * Crossing's parts expect): add, collide, platform, interact, update and
 * groundAt.  `offset(dx, dz)` gives a child context whose group, colliders,
 * platforms and ground queries are shifted, so a part authored round its
 * own origin (the railway, round its level crossing) drops into our layout
 * unchanged.
 * ------------------------------------------------------------------ */

export function makeCtx(scene, root) {
  const colliders = [];
  const platforms = [];
  const interactables = [];
  const updaters = [];

  /** Height of the walkable surface.  `fromY`: only platforms within a step
   * of it count, so something can be walked under as well as on. */
  function heightAt(x, z, fromY) {
    let h = 0;
    const reach = fromY === undefined ? Infinity : fromY + 0.55;
    for (const p of platforms) {
      if (p.top > reach) continue;
      if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1 && p.top > h) h = p.top;
    }
    return h;
  }

  function build(group, dx, dz) {
    return {
      scene,
      root: group,
      colliders,
      interactables,
      add: (obj) => { group.add(obj); return obj; },
      collide: (x0, z0, x1, z1, top, bottom) => {
        colliders.push({
          x0: Math.min(x0, x1) + dx, x1: Math.max(x0, x1) + dx,
          z0: Math.min(z0, z1) + dz, z1: Math.max(z0, z1) + dz,
          top, bottom,
        });
      },
      platform: (p) => platforms.push({ ...p, x0: p.x0 + dx, x1: p.x1 + dx, z0: p.z0 + dz, z1: p.z1 + dz }),
      cut: () => {},
      groundAt: (x, z) => heightAt(x + dx, z + dz),
      interact: (i) => interactables.push(i),
      update: (fn) => updaters.push(fn),
      /** A child context whose origin sits at (dx, dz) in this one. */
      offset(ox, oz, name = 'part') {
        const g = new THREE.Group();
        g.name = name;
        g.position.set(ox, 0, oz);
        group.add(g);
        return build(g, dx + ox, dz + oz);
      },
    };
  }

  const ctx = build(root, 0, 0);
  ctx.platforms = platforms;
  ctx.updaters = updaters;
  ctx.heightAt = heightAt;
  return ctx;
}
