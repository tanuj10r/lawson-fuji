import * as THREE from 'three';
import { painted } from './shade.js';
import { Body, loft, blob, limb, at } from './shapes.js';

/* ------------------------------------------------------------------ *
 * The town's cats, sat at their front gates (kit/dress.js places them;
 * kit/life.js swishes their tails).  A sitting cat is a pear: haunches
 * wide on the ground, the chest up, forelegs straight, the head round
 * with the ears up; the tail sweeps the ground behind.  Four coats seen
 * on any Japanese street: 茶トラ, 三毛, ハチワレ, サバトラ.
 * ------------------------------------------------------------------ */

const COATS = [
  { base: 0xe29a52, dark: 0xb86b32, white: 0xf6efe4, stripes: true },           // orange tabby
  { base: 0xf6f1e8, patch: [0xd98a3c, 0x2e2a2a], white: 0xf6f1e8 },              // calico
  { base: 0x2c2a2e, white: 0xf4f1ea, bib: true },                                 // black and white
  { base: 0x9a9aa2, dark: 0x5c5d66, white: 0xf2f0ea, stripes: true },            // grey tabby
];

const catMat = () => painted();

/** The coat's colour at a point of the body (x across, y up, z forward). */
function coat(c, seed) {
  return (p, part) => {
    const ax = Math.abs(p.x);
    // white: chest, muzzle, paws (and more on the bicolour)
    if (part === 'paw') return c.white;
    if (part === 'muzzle') return c.white;
    if (part === 'chest' || (c.bib && p.z > 0.03 && p.y < 0.24 && ax < 0.05)) return c.white;
    if (c.bib && part === 'head' && p.y < 0.268 && p.z > 0.07) return c.white;      // the ハチワレ's split face
    if (c.patch) {
      const n = Math.sin(p.x * 31 + seed) * Math.sin(p.z * 23 - seed) + Math.sin(p.y * 19 + seed * 2);
      if (n > 0.55) return c.patch[0];
      if (n < -0.75) return c.patch[1];
      return c.base;
    }
    if (c.stripes && part !== 'head') return Math.sin(p.y * 70 + Math.sin(p.z * 20) * 2) > 0.35 ? c.dark : c.base;
    if (c.stripes && part === 'head' && p.y > 0.29 && Math.sin(p.x * 120) > 0.2) return c.dark;   // the M on the brow
    return c.base;
  };
}

/** A sitting cat's body (no tail) and its tail (swished about its root). */
export function catGeometry(coatIndex) {
  const c = COATS[coatIndex % COATS.length];
  const paint = coat(c, coatIndex * 1.7);
  const b = new Body();
  // the body, a pear from the haunches up to the shoulders
  b.add(loft([
    { p: [0, 0.0, -0.05], rx: 0.0, ry: 0.0 },
    { p: [0, 0.01, -0.05], rx: 0.07, ry: 0.08 },
    { p: [0, 0.06, -0.045], rx: 0.09, ry: 0.095 },
    { p: [0, 0.13, -0.02], rx: 0.075, ry: 0.075 },
    { p: [0, 0.19, 0.02], rx: 0.058, ry: 0.058 },
    { p: [0, 0.23, 0.045], rx: 0.045, ry: 0.045 },
    { p: [0, 0.25, 0.05], rx: 0.0, ry: 0.0 },
  ], 12, [0, 0, 1], 2), { color: (p) => paint(p, p.z > 0.04 && p.y < 0.2 && p.y > 0.08 ? 'chest' : 'body') });
  // the haunches
  for (const s of [-1, 1]) b.add(blob(0.045, 0.055, 0.08, 10, 6), { matrix: at(s * 0.06, 0.05, -0.02, 0.2, 0, 0), color: (p) => paint(p, 'body') });
  // forelegs, straight down, paws together
  for (const s of [-1, 1]) {
    b.add(limb([s * 0.028, 0.17, 0.05], [s * 0.028, 0.02, 0.075], 0.019, 0.016, 6), { color: (p) => paint(p, p.y < 0.05 ? 'paw' : 'chest') });
    b.add(blob(0.02, 0.013, 0.026, 8, 6), { matrix: at(s * 0.028, 0.012, 0.085), color: c.white });
  }
  // the head: round, a white muzzle, ears up, eyes
  const hy = 0.28, hz = 0.07;
  b.add(blob(0.058, 0.052, 0.052, 12, 9), { matrix: at(0, hy, hz), color: (p) => paint(p, 'head') });
  for (const s of [-1, 1]) b.add(blob(0.022, 0.018, 0.018, 8, 5), { matrix: at(s * 0.016, hy - 0.018, hz + 0.042), color: c.white });
  b.add(blob(0.007, 0.005, 0.005, 6, 4), { matrix: at(0, hy - 0.006, hz + 0.056), color: 0xd88a92 });
  for (const s of [-1, 1]) {
    // ears: triangles, pink inside
    const e = new THREE.ConeGeometry(0.024, 0.05, 4, 1);
    e.scale(1, 1, 0.5);
    b.add(e, { matrix: at(s * 0.034, hy + 0.05, hz - 0.006, 0, 0, -s * 0.28), color: (p) => (p.z > hz - 0.004 && p.y < hy + 0.065 ? 0xe2a2a8 : paint(p, 'head')) });
    // eyes: a gold-green iris, a dark slit
    b.add(blob(0.011, 0.012, 0.005, 10, 7), { matrix: at(s * 0.022, hy + 0.008, hz + 0.047, 0, s * 0.35, 0), color: 0xb8c24a });
    b.add(blob(0.003, 0.009, 0.004, 6, 5), { matrix: at(s * 0.0225, hy + 0.008, hz + 0.051, 0, s * 0.35, 0), color: 0x141214 });
  }
  const body = b.build();
  // the tail: out behind along the ground, curling round to one side
  const t = new Body();
  t.add(loft([
    { p: [0, 0.03, 0.0], rx: 0.02, ry: 0.02 },
    { p: [0.02, 0.018, -0.08], rx: 0.019, ry: 0.017 },
    { p: [0.08, 0.016, -0.13], rx: 0.018, ry: 0.016 },
    { p: [0.15, 0.016, -0.1], rx: 0.017, ry: 0.015 },
    { p: [0.18, 0.02, -0.03], rx: 0.015, ry: 0.014 },
    { p: [0.185, 0.022, -0.005], rx: 0.0, ry: 0.0 },
  ], 8, [0, 1, 0], 3), { color: (p) => (c.stripes ? (Math.sin(Math.hypot(p.x, p.z) * 90) > 0.2 ? c.dark : c.base) : c.patch ? (p.x > 0.12 ? c.patch[1] : c.patch[0]) : c.base) });
  return { body, tail: t.build(), material: catMat() };
}

/** Replace a kit/dress.js cat's insides with the proper cat (same group, same tail handle). */
export function dressCat(group, index) {
  const { body, tail, material } = catGeometry(index);
  for (const ch of [...group.children]) group.remove(ch);
  const m = new THREE.Mesh(body, material);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  const tg = new THREE.Group();
  tg.position.set(0, 0, -0.07);
  const tm = new THREE.Mesh(tail, material);
  tm.castShadow = true;
  tg.add(tm);
  tg.userData.dynamic = true;
  group.add(tg);
  group.userData.tail = tg;
  group.userData.head = null;
  return group;
}
