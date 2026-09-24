import * as THREE from 'three';
import { cel, flat } from '../core/toon.js';
import { box, cyl } from '../core/util.js';
import { hullOutline } from '../core/outline.js';

/* ------------------------------------------------------------------ *
 * Traffic signals and the zebra crossing on the main road (ours: Sakura
 * Crossing has no road signals).  Japanese horizontal heads, 青 / 黄 / 赤,
 * with the green a blue-green that glows against dusk (mood reference 1),
 * plus pedestrian heads.  All heads share three lamp materials per colour,
 * so the whole junction switches by changing six colours.
 * ------------------------------------------------------------------ */

const LIT = { green: 0x3ff0c0, amber: 0xffc23a, red: 0xff4636, walk: 0x40e8b0, stop: 0xff4a3a };
const DIM = 0x39404f;

/**
 * @param o.x       crossing centre along the road
 * @param o.zNear   kerb line on the store side
 * @param o.zFar    kerb line on the far side
 * @param o.width   width of the zebra (along x)
 */
export function buildSignals(ctx, o) {
  const g = new THREE.Group();
  g.name = 'signals';
  // lamps share one material per colour, so batching keeps them switchable
  ctx.add(g);

  const pole = cel({ color: 0xb9bcc6, bands: 3, tint: 0x666090 });
  const housing = cel({ color: 0x3e4250, bands: 2, tint: 0x4b4560 });
  const lamps = {
    green: flat({ color: DIM, cache: false }),
    amber: flat({ color: DIM, cache: false }),
    red: flat({ color: DIM, cache: false }),
    walk: flat({ color: DIM, cache: false }),
    stop: flat({ color: DIM, cache: false }),
  };
  for (const m of Object.values(lamps)) m.userData.live = true;

  /* Zebra: bars 0.45 m wide, running with the traffic, 0.45 m apart.
   * `zebra: false` when the road kit paints its own (M2a). */
  if (o.zebra !== false) {
    const paint = cel({ color: 0xf2f2f5, bands: 3 });
    const w = o.width ?? 4;
    for (let z = o.zNear + 0.5; z < o.zFar - 0.5; z += 0.9) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.45), paint);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(o.x, 0.013, z + 0.225);
      bar.receiveShadow = true;
      ctx.add(bar);
    }
  }

  /** One signal post.  `side` +1 stands on the far kerb, -1 the near; the
   * arm reaches over the lane that traffic approaching from `from` uses. */
  const post = (px, pz, armDir, faceRy) => {
    const s = new THREE.Group();
    s.position.set(px, 0, pz);
    s.add(cyl(0.1, 0.13, 5.6, 8, pole, 0, 2.8, 0));
    // arm out over the lane
    const arm = box(0.1, 0.1, 3.4, pole, 0, 5.3, armDir * 1.7);
    s.add(arm);
    // horizontal head: green nearest the kerb... red over the lane, as in Japan
    const head = new THREE.Group();
    head.position.set(0, 5.3, armDir * 3.0);
    head.rotation.y = faceRy;
    const shell = box(1.25, 0.42, 0.24, housing, 0, 0, 0);
    head.add(shell);
    hullOutline(shell, { thickness: 0.0028 });
    [['green', -0.4], ['amber', 0], ['red', 0.4]].forEach(([k, lx]) => {
      const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), lamps[k]);
      lamp.position.set(lx * armDir, 0, 0.125);
      head.add(lamp);
      // visor
      const visor = box(0.34, 0.04, 0.16, housing, lx * armDir, 0.18, 0.2);
      head.add(visor);
    });
    s.add(head);
    // pedestrian head facing across the road
    const ped = new THREE.Group();
    ped.position.set(0, 2.6, 0);
    ped.rotation.y = armDir > 0 ? 0 : Math.PI;
    ped.add(box(0.36, 0.72, 0.22, housing, 0, 0, 0));
    const top = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), lamps.stop);
    top.position.set(0, 0.17, 0.12);
    const bot = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), lamps.walk);
    bot.position.set(0, -0.17, 0.12);
    ped.add(top, bot);
    s.add(ped);
    const lampMats = Object.values(lamps);
    s.traverse((n) => { if (n.isMesh && !lampMats.includes(n.material)) n.castShadow = true; });
    g.add(s);
    ctx.collide(px - 0.2, pz - 0.2, px + 0.2, pz + 0.2, 5.6);
  };
  // eastbound traffic keeps left (north lane) and meets the head west of the
  // crossing; westbound meets its head east of it
  post(o.x - (o.width ?? 4) / 2 - 1.2, o.zNear - 0.6, 1, -Math.PI / 2);
  post(o.x + (o.width ?? 4) / 2 + 1.2, o.zFar + 0.6, -1, Math.PI / 2);

  /* Cycle: cars green 24 s, amber 3 s, red 20 s (pedestrians walk 16 s of it). */
  const CYCLE = [['green', 24], ['amber', 3], ['red', 20]];
  const total = CYCLE.reduce((a, [, t]) => a + t, 0);
  let t = 0;
  const set = (m, on, key) => m.color.set(on ? LIT[key] : DIM);
  ctx.update((dt) => {
    t = (t + dt) % total;
    let acc = 0, phase = 'green';
    for (const [k, len] of CYCLE) { if (t < acc + len) { phase = k; break; } acc += len; }
    set(lamps.green, phase === 'green', 'green');
    set(lamps.amber, phase === 'amber', 'amber');
    set(lamps.red, phase === 'red', 'red');
    const walk = phase === 'red' && t - (24 + 3) > 2 && t - (24 + 3) < 18;
    set(lamps.walk, walk, 'walk');
    set(lamps.stop, !walk, 'stop');
  });
  return g;
}
