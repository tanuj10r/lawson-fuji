/* Tunables (AGENTS.md).  Units are metres and radians; +Y is up.
 *
 * World frame (SPEC section 3): the Lawson's front faces +Z toward the main
 * road and Fuji lies far behind it to -Z.  The storefront is centred on x = 0
 * with its glass at z = 0. */

export const LAWSON = {
  x: 0,
  frontZ: 0,       // storefront glass line
  width: 14,
  depth: 10,       // back wall at frontZ - depth
};

/* The hero-view spot (SPEC section 1): across the road, straight on and
 * centred on the storefront, 35 to 45 m back, eye at 1.6 m, looking
 * perpendicular to the glass (toward -Z, where Fuji rises behind the roof).
 * 40 m is the middle of the range; M1 tunes it against the reference photos. */
export const HERO = {
  pos: [LAWSON.x, 0, LAWSON.frontZ + 40],
  yaw: 0,          // yaw 0 faces -Z
  pitch: 0,
  eye: 1.6,
};

/* The player starts on the hero spot (SPEC section 1, "Spawn"). */
export const SPAWN = { pos: HERO.pos, yaw: HERO.yaw, pitch: HERO.pitch };

/* Empty world until M1/M2 place our own town. */
export const WORLD = {
  groundHalf: 1200,          // flat ground plane, well past the fog
  groundColor: 0xc4c4b6,
  bounds: { x0: -150, x1: 150, z0: -150, z1: 150 },
};
