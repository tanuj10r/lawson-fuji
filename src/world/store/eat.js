import * as THREE from 'three';
import { bake } from '../../core/util.js';
import { ease, easeOut, clamp01 } from './figure.js';
import { mochiStages } from '../mochi/food.js';

/* ------------------------------------------------------------------ *
 * Eating outside (Tan's konbini): first person, just the hands.
 *
 * What you bought is eaten in about three and a half seconds: the hand
 * brings it up, it comes out of its wrapper (the can
 * pops), two bites -- each leaving a scalloped bite in it, the filling
 * showing -- and a last one that gobbles the rest; the can is tipped up
 * for two gulps instead.  Then the hand dips and comes back empty.
 *
 * The unwrapped food is built here, painted like the hands (one material,
 * the hands' own), each a few bite stages cut from its outline.
 * ------------------------------------------------------------------ */

const V2 = THREE.Vector2;

/* ------------------------------- bites ------------------------------- */
/** Is `p` inside the polygon `pts`? */
function inPoly(pts, p) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
/** Where segment a-b crosses the circle (c, r), as t in [0, 1] (the first). */
function cross(a, b, c, r) {
  const dx = b.x - a.x, dy = b.y - a.y, fx = a.x - c.x, fy = a.y - c.y;
  const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r;
  const D = Math.sqrt(Math.max(0, B * B - 4 * A * C));
  const t1 = (-B - D) / (2 * A), t2 = (-B + D) / (2 * A);
  const t = t1 >= 0 && t1 <= 1 ? t1 : t2;
  return new V2(a.x + dx * t, a.y + dy * t);
}
/** Take a round bite (c, r) out of the outline `pts`: the run inside the circle becomes its arc. */
function biteOut(pts, c, r) {
  const ins = pts.map((p) => p.distanceTo(c) < r);
  if (!ins.some(Boolean) || ins.every(Boolean)) return pts;
  // start from a point outside, so the inside run is contiguous in the array
  const k = ins.indexOf(false);
  const P = [...pts.slice(k), ...pts.slice(0, k)], I = [...ins.slice(k), ...ins.slice(0, k)];
  const a = I.indexOf(true);
  let b = a;
  while (b + 1 < P.length && I[b + 1]) b++;
  const entry = cross(P[a - 1], P[a], c, r), exit = cross(P[b], P[(b + 1) % P.length], c, r);
  let a0 = Math.atan2(entry.y - c.y, entry.x - c.x), a1 = Math.atan2(exit.y - c.y, exit.x - c.x);
  // go round the way that stays inside the food
  let d = a1 - a0;
  if (d <= 0) d += Math.PI * 2;
  const midA = a0 + d / 2;
  if (!inPoly(pts, new V2(c.x + Math.cos(midA) * r * 0.98, c.y + Math.sin(midA) * r * 0.98))) d -= Math.PI * 2;
  const arc = [];
  const n = Math.max(4, Math.ceil(Math.abs(d) / 0.18));
  for (let i = 1; i < n; i++) { const t = a0 + (d * i) / n; arc.push(new V2(c.x + Math.cos(t) * r, c.y + Math.sin(t) * r)); }
  return [...P.slice(0, a), entry, ...arc, exit, ...P.slice(b + 1)];
}
const bitten = (outline, bites) => bites.reduce((pts, [x, y, r]) => biteOut(pts, new V2(x, y), r), outline);

/** A rounded triangle outline, base on y 0, apex up, `n` points. */
function roundTri(w, h, r, n = 90) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, 0); s.lineTo(w / 2 - r, 0); s.quadraticCurveTo(w / 2, 0, w / 2 - r * 0.6, r * 0.9);
  s.lineTo(r * 0.6, h - r * 0.9); s.quadraticCurveTo(0, h, -r * 0.6, h - r * 0.9);
  s.lineTo(-w / 2 + r * 0.6, r * 0.9); s.quadraticCurveTo(-w / 2, 0, -w / 2 + r, 0);
  return s.getSpacedPoints(n).slice(0, -1);
}
function rect(w, h, n = 80) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.closePath();
  return s.getSpacedPoints(n).slice(0, -1);
}

/**
 * A layer of food: the outline extruded from z0 to z1.  Its two faces take
 * `face`, its rim `rim` -- except where a bite cut it, which shows `inner`
 * (a bitten slice of bread is white inside, not crust).
 */
const _c = new THREE.Color();
function layer(pts, z0, z1, { face, rim = face, inner = face }, bites = []) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: z1 - z0, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, z0);
  const geo = g.index ? g.toNonIndexed() : g;
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, paint = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    let col = face;
    if (Math.abs(n.getZ(i)) < 0.5) {
      const x = p.getX(i), y = p.getY(i);
      col = bites.some(([bx, by, br]) => Math.abs(Math.hypot(x - bx, y - by) - br) < 0.0015) ? inner : rim;
    }
    _c.set(col);
    paint[i * 3] = _c.r; paint[i * 3 + 1] = _c.g; paint[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('paint', new THREE.BufferAttribute(paint, 3));
  return geo;
}
/** A plain painted piece (a strawberry, the nori, the wrapper). */
function piece(geo, color, m) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (m) g.applyMatrix4(m);
  g.computeVertexNormals();
  _c.set(color);
  const paint = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < paint.length; i += 3) { paint[i] = _c.r; paint[i + 1] = _c.g; paint[i + 2] = _c.b; }
  g.setAttribute('paint', new THREE.BufferAttribute(paint, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}
const bakeAll = (geos) => { const g = bake(geos.map((geometry) => ({ geometry, matrix: null }))); g.computeBoundingBox(); g.computeBoundingSphere(); return g; };

/* ---------------------------- the food, eaten ---------------------------- */
const BREAD = { face: 0xfbf5e6, rim: 0xe0b476, inner: 0xfff8ea };
/* Each recipe: its bite stages (circles cut from the outline, cumulative). */
const RECIPE = {
  /* a sando (Tan's photos): a wedge, a square cut corner to corner.
   * Its bread faces are right triangles (the back upright, the base
   * flat), the fruit set in cream up the slanted cut face; held turned so
   * you see that face, bitten from the top corner down. */
  wedge(filling, fruits = []) {
    const w = 0.07, h = 0.1;
    const s2 = new THREE.Shape();
    s2.moveTo(-w / 2, 0); s2.lineTo(w / 2, 0); s2.lineTo(-w / 2, h); s2.closePath();
    const out = s2.getSpacedPoints(90).slice(0, -1);
    const stages = [[], [[-w / 2, h, 0.026]], [[-w / 2, h, 0.026], [-w / 2 + 0.012, h - 0.04, 0.026]]];
    return stages.map((bites) => {
      const pts = bitten(out, bites);
      const g = [
        layer(pts, -0.022, -0.009, BREAD, bites),
        layer(pts, -0.009, 0.009, { face: filling, rim: filling, inner: filling }, bites),
        layer(pts, 0.009, 0.022, BREAD, bites),
      ];
      // each fruit halved by the cut: its middle on the slanted face
      fruits.forEach((col, i) => {
        const t2 = (i + 0.7) / (fruits.length + 0.4);
        const fx = w / 2 - t2 * w, fy = t2 * h;
        const nx = h / Math.hypot(w, h), ny = w / Math.hypot(w, h);
        const cx = fx - nx * 0.004, cy = fy - ny * 0.004;
        if (inPoly(pts, new V2(cx - nx * 0.006, cy - ny * 0.006))) g.push(piece(new THREE.SphereGeometry(0.0115, 10, 8), col, new THREE.Matrix4().makeScale(0.85, 1.15, 0.75).setPosition(cx, cy, 0)));
      });
      const b = bakeAll(g);
      b.rotateY(-0.75);                     // the cut face toward you
      return b;
    });
  },
  onigiri() {
    const out = roundTri(0.1, 0.092, 0.018);
    const b1 = [[-0.006, 0.096, 0.024], [0.014, 0.088, 0.02]];
    const b2 = [...b1, [0.0, 0.064, 0.026], [-0.022, 0.068, 0.02], [0.022, 0.066, 0.02]];
    return [[], b1, b2].map((bites, k) => {
      const pts = bitten(out, bites);
      const g = [layer(pts, -0.018, 0.018, { face: 0xfcfbf4, rim: 0xf2efe4, inner: 0xfcfbf4 }, bites)];
      // the nori, wrapped round the lower half
      const nori = bitten(out.filter((p) => p.y < 0.042).concat([new V2(0.1 / 2 * (1 - 0.042 / 0.092) - 0.004, 0.042), new V2(-0.1 / 2 * (1 - 0.042 / 0.092) + 0.004, 0.042)]), []);
      g.push(layer(nori.sort((a, b) => Math.atan2(a.y - 0.02, a.x) - Math.atan2(b.y - 0.02, b.x)), -0.0195, 0.0195, { face: 0x2d3b36, rim: 0x243029 }));
      // the tuna-mayo, showing once it is bitten into
      if (k > 0) for (const z of [-0.0185, 0.0185]) g.push(piece(new THREE.CircleGeometry(0.014, 14), 0xefdcaa, new THREE.Matrix4().makeRotationY(z < 0 ? Math.PI : 0).setPosition(0.002, k === 1 ? 0.062 : 0.04, z)));
      return bakeAll(g);
    });
  },
  wafer() {
    const out = rect(0.124, 0.068).map((p) => new V2(p.x, p.y));
    const b1 = [[0.064, 0.05, 0.022], [0.066, 0.022, 0.02]];
    const b2 = [...b1, [0.04, 0.056, 0.022], [0.036, 0.03, 0.024], [0.042, 0.004, 0.02]];
    const WAFER = { face: 0xd9a45e, rim: 0xc88e48, inner: 0xd9a45e };
    return [[], b1, b2].map((bites) => {
      const pts = bitten(out, bites);
      const g = [
        layer(pts, -0.014, -0.009, WAFER, bites),
        layer(pts, -0.009, -0.003, { face: 0xfaf2de, rim: 0xfaf2de }, bites),
        layer(pts, -0.003, 0.0, { face: 0x4a2a1c, rim: 0x4a2a1c }, bites),
        layer(pts, 0.0, 0.009, { face: 0xfaf2de, rim: 0xfaf2de }, bites),
        layer(pts, 0.009, 0.014, WAFER, bites),
      ];
      // the wafer's grid, pressed into both faces (where there is still wafer)
      for (let i = -2; i <= 2; i++) for (const z of [-0.0142, 0.0142]) {
        const x = i * 0.022;
        if (pts.some((p) => p.x > x + 0.006) && inPoly(pts, new V2(x, 0.034))) g.push(piece(new THREE.BoxGeometry(0.003, 0.058, 0.0012), 0xb07434, new THREE.Matrix4().makeTranslation(x, 0.034, z)));
      }
      // the wrapper, torn open and pushed back over the far end
      g.push(piece(new THREE.BoxGeometry(0.056, 0.074, 0.032), 0x4a2a1c, new THREE.Matrix4().makeTranslation(-0.042, 0.034, 0)));
      g.push(piece(new THREE.BoxGeometry(0.02, 0.074, 0.033), 0xe89a1a, new THREE.Matrix4().makeTranslation(-0.046, 0.034, 0)));
      g.push(piece(new THREE.BoxGeometry(0.008, 0.078, 0.012), 0xe89a1a, new THREE.Matrix4().makeTranslation(-0.069, 0.034, 0)));
      return bakeAll(g);
    });
  },
};
/* ぺったん堂's matcha-strawberry mochi (world/mochi/food.js builds it, whole and bitten, and what its eating shows
 * besides: `fx`): handed over in its paper cup, so nothing to unwrap; three bites, the first a long one that draws a
 * strand of mochi out until it snaps.  Its stages say where it sits (`seat`, `turn`), when each bite starts and how
 * long it takes (`bites`, `win`), how long the whole takes (`per`). */
RECIPE.mochi = () => Object.assign(mochiStages(), { centred: true });
const cache = new Map();
/** The bite stages of `id` (geometries, centred on the anchor), or null for a drink. */
export function eatStages(id) {
  if (cache.has(id)) return cache.get(id);
  let st = null;
  if (id === 'sando_egg') st = RECIPE.wedge(0xf6d45c);
  else if (id === 'fruit_sando') st = RECIPE.wedge(0xfffaf0, [0xe8455a, 0xf2a030, 0x8cc84a]);
  else if (id === 'onigiri_tuna') st = RECIPE.onigiri();
  else if (id === 'choco_wafer_jumbo') st = RECIPE.wafer();
  else if (id === 'mochi_ichigo') st = RECIPE.mochi();
  if (st && !st.centred) for (const g of st) g.translate(0, id === 'choco_wafer_jumbo' ? -0.034 : id === 'onigiri_tuna' ? -0.046 : -0.045, 0);   // held about its middle
  cache.set(id, st);
  return st;
}

/* ------------------------------ the eating ------------------------------ */
const PER = 3.5;          // seconds an item takes
const BITE_AT = [0.85, 1.57, 2.29];   // when each of the three bites starts
const AT = [0, 0.03, 0.012];          // where the food sits in the hand (the anchor's frame)
/**
 * `hands` (store/hands.js), `material` the hand's own, `sfx(name)` plays
 * a sound at you.  `start(item)` with { id, mesh, onEaten }; `update(dt)`;
 * `done` when it is eaten.
 */
export function makeEating(hands, material, sfx) {
  let cur = null, t = 0, done = true;
  const food = new THREE.Mesh(new THREE.BufferGeometry(), material);
  food.frustumCulled = false; food.renderOrder = 11;
  /* Where the food itself goes, in the camera's frame (the hand follows it):
   * held up in front, then in close under the eyes for each bite. */
  const PREP = new THREE.Vector3(0.05, -0.085, -0.38);
  const MOUTH = new THREE.Vector3(0.01, -0.07, -0.305);
  const SIP = new THREE.Vector3(0.005, -0.07, -0.31);
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _a = new THREE.Vector3(), _rest = new THREE.Vector3(), _p = new THREE.Vector3();
  /** Offset hand `h` so its anchor (what it holds) sits at `p`, turned by its current `turn`. */
  const _qr = new THREE.Quaternion();
  function place(h, p) {
    // as hands.js turns it: `turn` in the camera's terms, over the resting turn
    _q.setFromEuler(_e.set(h.turn.x, h.turn.y, h.turn.z, 'XYZ')).multiply(hands.grip(h, _qr));
    _a.copy(h.anchor.position).applyQuaternion(_q);
    h.off.copy(p).sub(h.rest.pos).sub(_a);
  }
  /** Where the anchor rests (to ease from, and back to). */
  function restAnchor(h, out) {
    _e.set(h.rest.rot.x, h.rest.rot.y, h.rest.rot.z, 'YXZ');
    return out.copy(h.anchor.position).applyQuaternion(_q.setFromEuler(_e)).add(h.rest.pos);
  }
  const TURN = { sando: [0.1, 0.38, 0], onigiri: [0.05, 0.15, 0], wafer: [0.05, 0.12, 0] };
  const fired = new Set();
  const once = (key, fn) => { if (!fired.has(key)) { fired.add(key); fn(); } };

  const h = hands.R;
  const api = {
    get done() { return done; },
    get item() { return cur; },
    start(item) {
      cur = item; t = 0; fired.clear();
      done = !item;
      if (item) cur.stages = eatStages(item.id);
    },
    update(dt) {
      if (done || !cur) return;
      t += dt;
      const drink = !cur.stages;
      const per = cur.stages?.per ?? PER, BITES = cur.stages?.bites ?? BITE_AT, fx = cur.stages?.fx ?? null;
      let biting = -1, biteX = 0, biteWin = 0;
      const off = h.off, turn = h.turn;
      restAnchor(h, _rest);
      // up to the eating height
      const up = ease(clamp01(t / 0.45));
      turn.set(0.1 * up, 0, 0);
      h.eat = drink ? 0.4 * up : up;
      _p.copy(_rest).lerp(PREP, up);
      // out of the wrapper (or the can pops)
      if (t > 0.45) once('open', () => {
        if (drink || cur.stages.wrapped !== false) sfx(drink ? 'can-open' : 'wrapper');
        if (!drink) {
          cur.mesh.visible = false;
          food.geometry = cur.stages[0]; food.scale.setScalar(1);
          const r = cur.stages.turn ?? TURN[cur.id.includes('sando') ? 'sando' : cur.id.includes('onigiri') ? 'onigiri' : 'wafer'];
          food.rotation.set(r[0], r[1], r[2]);
          const at = cur.stages.seat ?? AT;
          food.position.set(at[0], at[1], at[2]);     // up out of the fingers, the bite end free
          cur.mesh.parent.add(food);
        }
      });
      if (drink) {
        // tip it up for two long gulps
        const k = ease(clamp01((t - 0.9) / 0.35)) * (1 - ease(clamp01((t - 2.6) / 0.35)));
        _p.lerp(SIP, k);
        turn.x += 2.0 * k; turn.z += 0.12 * k;          // tipped right up: the top to your mouth, the bottom high
        if (t > 1.45) once('g1', () => sfx('gulp'));
        if (t > 2.05) once('g2', () => sfx('gulp'));
      } else {
        // three bites: in quick, a bite, back slower; the third takes the rest
        for (let b = 0; b < 3; b++) {
          const win = cur.stages.win?.[b] ?? 0.62;
          const t0 = BITES[b], x = t - t0;
          if (x < 0 || x > win) continue;
          biting = b; biteX = x; biteWin = win;
          // (a long bite, the mochi's first, comes in as quickly and goes away slowly)
          const k = x < 0.16 ? easeOut(x / 0.16) : 1 - ease(clamp01((x - 0.16) / (win - 0.16)));
          _p.lerp(MOUTH, k);
          turn.x += 0.1 * k;
          if (x >= 0.16) once('bite' + b, () => {
            sfx('bite');
            if (b < 2) food.geometry = cur.stages[b + 1];
            fx?.puff(b, { view: hands.view, food });
          });
          if (x >= 0.3) once('munch' + b, () => sfx('munch'));
          if (b === 2 && x >= 0.16) food.scale.setScalar(Math.max(0, 1 - (x - 0.16) / 0.12));
        }
      }
      // done with it: back down to rest, empty-handed
      const back = ease(clamp01((t - (per - 0.75)) / 0.3));
      _p.lerp(_rest, back);
      turn.set(turn.x * (1 - back), turn.y * (1 - back), turn.z * (1 - back));
      h.eat = Math.min(h.eat, 1 - back);
      place(h, _p);
      fx?.frame({ view: hands.view, material, food, bite: biting, x: biteX, win: biteWin, dt });
      // the empty can goes down out of sight (a bin, a bag) and the hand comes back without it
      if (drink) off.y -= 0.3 * clamp01((t - 2.95) / 0.25) * (1 - clamp01((t - 3.22) / 0.25));
      if (t > (drink ? 3.2 : per - 0.4)) once('gone', () => { cur.mesh.visible = false; food.removeFromParent(); fx?.end(); cur.onEaten?.(); });
      if (t >= per) {
        off.set(0, 0, 0); turn.set(0, 0, 0); h.eat = 0;
        cur = null; done = true;
      }
    },
    /** Stop at once (walked back into the store mid-bite, say): what was held is gone. */
    stop() {
      if (cur) { cur.mesh.visible = false; food.removeFromParent(); cur.stages?.fx?.end(); h.off.set(0, 0, 0); h.turn.set(0, 0, 0); h.eat = 0; cur.onEaten?.(); }
      cur = null; done = true;
    },
  };
  return api;
}
