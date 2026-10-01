# The Pocket Town (mobile): shared plan for the builders

Approved by Tan, 2026-10-01. Phones get a small, purpose-built diorama
instead of the desktop town: one stretch of Japan, free roaming with a
joystick, every sound, full sharpness. The desktop game does not change
(its bundle stays byte-identical to `main`'s build).

Branch: `pocket-diorama` (from `pocket-town`, which has the phone shell:
src/mobile/* touch, hud, audio unlock, diag, tiers, m.html). Each builder
branches from `pocket-diorama`, works only in its own files, and is merged
by the lead. Log judgement calls in docs/decisions/mobile-lite.md under a
"Pocket diorama" heading, one short entry per builder.

## Rules for everyone
- AGENTS.md applies, except its desktop-only rule (lifted for the phone
  build). Visuals built in code with the game's toon/ink look (src/core).
  No bloom. Brands are homages only: NIPPON (not Lawson), ドンペン堂 (not
  Don Quijote: mimic Don Quijote's look as closely as possible, never its
  name or logo).
- Sound is sacred: same files, same engine (src/core/sound.js +
  soundBus), local to its place (near/far), same mix.
- Budget (iPhone 15 Safari AND Chrome for iOS / in-app browsers, one
  tier): whole scene <= ~150 MB GPU (textures + buffers, use ?diag's
  estimate), <= ~250 draw calls in any view, <= ~0.8 M triangles in
  view, renders at the phone's full DPR (3x on iPhone 15; adaptive step
  down only if fps < 50). Builds in <= ~2 s. Textures sized to how close
  they are ever seen; nothing unseen exists.
- Reuse existing builders where they fit (src/world/lawson*.js,
  kit/megastore, kit/shrine, line/*, land/slowlife.js, land/paddies.js,
  animals/*, han/*), but place them in the pocket layout; do not build the
  desktop town (src/world/town.js / src/mobile/town.js are not used).

## Layout (pocket metres; +x east, -z north; Fuji is due north)
One street, z = 0, from x = -90 to x = +90 (2-lane, pavements both sides).
The player starts at (0, 1.6, 16) looking north: the famous view.

| Place | Where | Sounds |
|---|---|---|
| NIPPON konbini + car park (the famous view) | store front faces south at z = -10, centred x = 0, car park z -10..-1 | store door chime, store music (inside), kiosk sounds |
| Zebra crossing with walk signals | across the street at x = -24 | walk-piyo, walk-kakko |
| ドンペン堂 storefront | south side, x -48..-32, front facing north at z = +6 | donki-theme from the open door |
| 2 small shops either side of the konbini | north side, x -20..-12 and +12..+22 | (none) |
| Level crossing + tiny platform | railway runs north-south at x = +55; platform east of track, z -14..-46 | railway-bells, train run sounds (line/sfx), train-nextstop on the platform spot, station-ambience (light) |
| Lake edge + paddies + slow-life bench | north-west: paddies x -88..-56, z -8..-50; lake beyond (x -95..-50, z -50..-120); bench at (-66, -48) facing the lake and Fuji | wind, frogs/insects (night-insects at night), rural-flute at the bench |
| Shrine torii + small shrine | east end, south side, around (+78, +14), torii facing west toward the street | shrine-chimes |
| Han's RX-7 pass-by | drives the street east -> west and drifts round the corner at x -60 heading north (out of sight behind the paddies' edge) | han-drift (the song), drift track |

The horizon: Mt. Fuji (existing src/core/sky.js / world fuji builder at
its gameplay size), lake and hills painted flat beyond the edges (a
backdrop ring in flat toon colours, no texture pages). Edges of the walkable
area are kerbs, low walls, the lake shore and the railway fence.

## The place module contract
Each place is one module in `src/mobile/pocket/places/<name>.js`:

```js
export function build(P) {
  // P = { THREE, scene, root /* Group to add into */, anchor /* {x, z, ry} */,
  //       ground(x, z) /* 0 for now */, sound /* the engine */, soundBus,
  //       look() /* 'day' | 'golden' | 'blue' */, night /* kit/night.js glow helper if needed */ }
  return {
    group,                 // THREE.Group, built in local coords around the anchor
    colliders: [],         // [{ x0, x1, z0, z1, top }] in world (pocket) coords
    sounds: [],            // [{ name, x, y, z, near, far, level }] zones; or start them via P.soundBus
    spots: [],             // [{ id, x, z, r, label, use(P) }] things the action button can use
    update(dt, P) {},      // optional, hooked into the main loop
    setLook(look) {},      // optional
    stats() {},            // optional: { calls, tris, gpuMB }
  };
}
```
A dev-only harness page `p-dev.html?place=<name>` (lead provides the shell)
renders one place alone with an orbit camera and ?diag numbers, so each
builder can test in isolation.

## Builders (parallel)
1. Lead/foundation: the pocket entry (m.html switches to the pocket world
   when MOBILE.pocket is on), ground, street, kerbs, pavements, the lake,
   paddies, horizon backdrop, sky/Fuji, renderer at full DPR, the place
   loader, the dev harness, colliders, the minimap of the pocket (or none).
2. Konbini + car park + the two small shops: the scripted visit (door
   chime, store music, choose one of five, self-checkout, eat outside),
   only the front aisle and checkout built, full sharpness.
3. ドンペン堂 storefront (Don Quijote look: yellow/red/blue signage, MEGA
   board, crammed handwritten POP price cards, goods in bins on the
   pavement, the penguin mascot homage, the theme from the open door) +
   street dressing (poles/wires, vending machine, sakura near the view).
4. Level crossing + train + platform (with the "Next train" countdown
   and the announcement spot) + the shrine + the bench.
5. Controls and screen: floating joystick (left thumb anywhere on the
   left half, smooth stroll/walk/run curve, dead zone, wall sliding,
   fades when idle), right-thumb look with a gentle curve and a
   sensitivity setting, both thumbs + buttons independent, one action
   button above the right thumb near a spot, max three buttons (whistle,
   time of day, pause), sound name labels (ぴよぴよ · crosswalk chick),
   "Best with headphones" + sound check on the start card, landscape
   first with a portrait framing, iOS audio robustness, context-loss
   self-rebuild. Hachi optional (whistle leads to an unvisited place).
6. Later, on its own branch: the sound stamp book (optional; dropped if
   it costs anything real).

## Harness ready: 5da1062
`git cherry-pick 5da1062` (or merge the lead's branch) to get it. Run
`npx vite --port <yours>` and open `p-dev.html?place=<name>&diag`
(`&look=day|golden|blue`, `&world` for the lead's ground, `&cam=x,y,z,tx,ty,tz`).
Keys: 1 2 3 looks, C colliders + spots, S sound (listener at the orbit
target), P screenshot to .shots/.  Conventions (src/mobile/pocket/layout.js):
- Anchors: konbini (0, -10) ry 0; donpen (-40, 6) ry PI; crossing (55, 0)
  ry 0; shrine (78, 14) ry -PI/2; bench (-66, -48) ry PI.
- Build your group in local coords with your FRONT toward local +z; the
  loader sets group.position and rotation.y from the anchor (don't).
  Colliders, sounds and spots are world coords: `toWorld(P.anchor, x, z)`.
- The street: asphalt z -3.4..3.4, kerbs 0.15 m, pavements 2.4 m each side
  (none in front of the konbini, x -12..12: its forecourt runs to the kerb),
  zebra stripes at x = -24 (lead), ground y = 0 everywhere walkable.
- Return `stats()` if you can; the readout shows it.
