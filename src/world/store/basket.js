/* ------------------------------------------------------------------ *
 * The shopping baskets (M3c): the nested stacks on their dollies by the
 * door and at the counter's end (store/interior.js paints them).
 * ------------------------------------------------------------------ */

const BLUE = 0x2f6fb6, DARK = 0x24558e, RIM = 0x5a92d6;
const BASKET = { w: 0.46, d: 0.32, h: 0.26 };

/**
 * Paint a basket into painter `p`, the middle of its floor at (ox, oy, oz),
 * long side along x.  Its sides flare out toward the rim, as a real one's
 * do, which is what lets a stack nest and show every rim.
 */
const FLARE = 0.035;
function paintBasket(p, ox = 0, oy = 0, oz = 0) {
  const { w, d, h } = BASKET;
  const shade = [0.8, 0.76, 1, 0.6, 0.86, 0.84], t = 0.012, a = Math.atan2(FLARE, h);
  // the floor, the size of the sides' foot
  p.box(ox - w / 2 + FLARE, ox + w / 2 - FLARE, oy, oy + 0.015, oz - d / 2 + FLARE, oz + d / 2 - FLARE, DARK, { shade });
  /* each side, in its own terms: `u` along it, `v` up it; a piece from
   * (u0, v0) to (u1, v1) is placed on the leaning side */
  const sides = [
    { n: [0, 1], along: [1, 0], half: w / 2, reach: d / 2, rot: { rx: a } },
    { n: [0, -1], along: [1, 0], half: w / 2, reach: d / 2, rot: { rx: -a } },
    { n: [1, 0], along: [0, 1], half: d / 2, reach: w / 2, rot: { rz: -a } },
    { n: [-1, 0], along: [0, 1], half: d / 2, reach: w / 2, rot: { rz: a } },
  ];
  for (const sd of sides) {
    const piece = (u0, u1, v0, v1, color) => {
      const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2, out = sd.reach - FLARE + (FLARE * vc) / h - t / 2;
      const cx = ox + sd.along[0] * uc + sd.n[0] * out, cz = oz + sd.along[1] * uc + sd.n[1] * out;
      const hu = (u1 - u0) / 2, hv = (v1 - v0) / 2;
      const [hx, hz] = sd.along[0] ? [hu, t / 2] : [t / 2, hu];
      p.box(cx - hx, cx + hx, oy + vc - hv, oy + vc + hv, cz - hz, cz + hz, color, { shade, ...sd.rot });
    };
    const L = sd.half - FLARE * 0.5;
    piece(-L, L, 0, 0.05, BLUE);                                // the foot
    piece(-sd.half, sd.half, h - 0.035, h, RIM);                // the rim, a lighter blue
    piece(-L, L, h * 0.55 - 0.012, h * 0.55 + 0.012, BLUE);     // the rail
    const n = Math.round((2 * L) / 0.05);
    for (let k = 1; k < n; k++) { const u = -L + (k * 2 * L) / n; piece(u - 0.007, u + 0.007, 0.05, h - 0.035, BLUE); }
  }
  // the two handles, folded down over the long sides' rims
  for (const sz of [-1, 1]) {
    const z = oz + sz * (d / 2 + 0.01);
    p.box(ox - w / 2 + 0.1, ox + w / 2 - 0.1, oy + h - 0.03, oy + h - 0.005, z - 0.008, z + 0.008, DARK, { shade });
    for (const x of [ox - w / 2 + 0.1, ox + w / 2 - 0.1]) p.box(x - 0.012, x + 0.012, oy + h - 0.04, oy + h - 0.005, z - 0.01, z + 0.01, DARK, { shade });
  }
}

/**
 * A stack of baskets on its dolly (M3d): nested, each a few centimetres
 * higher and a touch off line, so every rim and handle shows -- the way a
 * konbini's stack by the door reads at a glance.  Paints `n` into `p`.
 */
const NEST = 0.06;
export function paintBasketStack(p, x, z, n, sign) {
  // the dolly: a low grey tray on four castors
  p.box(x - 0.27, x + 0.27, 0.05, 0.075, z - 0.2, z + 0.2, 0x8a8e98);
  p.box(x - 0.27, x + 0.27, 0.075, 0.1, z - 0.2, z - 0.18, 0x6a6e78);
  p.box(x - 0.27, x + 0.27, 0.075, 0.1, z + 0.18, z + 0.2, 0x6a6e78);
  for (const [dx, dz] of [[-0.22, -0.15], [0.22, -0.15], [-0.22, 0.15], [0.22, 0.15]]) p.cyl(x + dx, 0.0, z + dz, 0.025, 0.05, 0x2a2a30, 8);
  for (let k = 0; k < n; k++) paintBasket(p, x + (k % 2 ? 0.008 : -0.004), 0.1 + k * NEST, z + (k % 2 ? -0.004 : 0.004));
  // a POP card on a stalk: お買い物かご / BASKETS
  if (sign) {
    // at the dolly's corner, the card read from the door and from the shop
    p.box(x + 0.255, x + 0.27, 0.075, 0.92, z - 0.2, z - 0.185, 0xc8ccd4);
    p.quad(sign, x + 0.262, 0.99, z - 0.18, 0.3, 0.15);
    p.quad(sign, x + 0.262, 0.99, z - 0.205, 0.3, 0.15, { ry: Math.PI });
  }
}
