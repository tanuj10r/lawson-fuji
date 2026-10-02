import { SEEN } from './sakura-seen-data.js';

/* ------------------------------------------------------------------ *
 * Which of the town's cherries a famous view can see (kit/sakura.js
 * seenFromFamousViews: they keep the classic look, so the hero frames stay
 * to the pixel).  The answer is found by casting ~75 rays a tree against
 * the town built so far: a third of a second of the load, for an answer
 * that is the same on every phone.  So it is kept (sakura-seen-data.js),
 * with a key of what it was measured on: the trees' places and how many
 * meshes stood in the town.  A different town (the plan, a builder) has a
 * different key: the rays are cast again, as ever, and a dev server says
 * so and holds the new answer in window.__sakuraSeenOut to paste in.
 * ------------------------------------------------------------------ */
globalThis.__sakuraSeen = (spots, root, compute) => {
  let meshes = 0, h = 0;
  root.traverse((o) => { if (o.isMesh) meshes++; });
  for (const s of spots) h = (Math.imul(h, 31) + Math.round(s.x * 10) * 7 + Math.round(s.z * 10) * 13 + Math.round((s.scale ?? 1) * 100)) | 0;
  const key = `${spots.length}:${meshes}:${h}`;
  if (SEEN?.key === key && SEEN.bits.length === spots.length) return [...SEEN.bits].map((c) => c === '1');
  const out = compute();
  if (import.meta.env?.DEV) {
    globalThis.__sakuraSeenOut = { key, bits: out.map((b) => (b ? '1' : '0')).join('') };
    console.warn('sakura-seen-data.js is for another town: measured again', JSON.stringify(globalThis.__sakuraSeenOut));
  }
  return out;
};
