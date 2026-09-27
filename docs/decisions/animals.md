# Animals (town pass, wave 3)

Files: src/world/animals/* (index, shade, shapes, koi, turtles, ducks,
waders, pigeons, shiba, butterflies, cat), src/world/kit/life.js,
config.js `ANIMALS` and the `animals-*` / `close-animals-*` spots.

## How they are made
- **No bones.** Each kind is one geometry built from smooth lofts and
  ellipsoids, painted per vertex, every vertex tagged with a part id and a
  pivot (aJoint), plus a second pose as a morph (aMorph: wings spread,
  dog stood up, neck stretched to strike). The vertex shader turns parts
  by two per-instance pose vectors. One InstancedMesh per kind.
- **The cel look kept:** the town's toon material (core/toon.js `cel`, its
  bands and violet shade) with smooth normals, patched in onBeforeCompile;
  nothing in src/core changed. Pale birds (egret, heron) use the soft3
  ramp so white stays white on the shaded side.
- **Contact shadows** are one multiply-blended mesh of ellipses (the
  shadow map redraws on a grid, not every frame, so it can't follow a
  walking pigeon). Sparrows got the same in life.js.
- **Water marks** (gulp and plop rings, the ring round a wader's legs,
  duck wakes): two instanced meshes, pale lines fading out.

## Judgement calls
- **Koi under a mirror.** 鏡池's water is an opaque mirror, so a koi can't
  be under it. Each koi is drawn on the surface pressed flat, tinted by
  the olive water and faded at a glancing look (where the mirror wins, as
  on real water); a surfacing head keeps its full shape and colours. They
  come to whoever stands at the edge (koi expect bread), and gulp there.
- **Reflections in the painted water.** The paddies and the river are
  painted, not mirrors; egrets and the heron get a reflection drawn as a
  second instanced mesh sharing their matrices, flipped about the water,
  with each vertex's depth set to where its ray meets the water, so the
  reflection lies in the surface and anything in front hides it. +1 call
  each; the egrets in the sky-mirror paddies are where it pays.
- **Spot-billed ducks (カルガモ) everywhere,** not mallards: Japan's everyday
  duck, sexes alike, so a pair reads as a pair. One mesh for the pond pair
  and the river's two pairs. River ducks dabble and now and then upend.
- **Turtles are pond sliders** (every park pond in Japan has them). Their
  stones are my own: rounded granite boulders, widest at the waterline,
  in clusters of two or three. They slip off one by one when you come to
  the edge within 5.5 m and climb back once you are 14 m off.
- **The heron** stands in the town-side shallows (x -34), flies off at 7 m
  in slow deep beats, legs trailed, along the channel (never over the
  bridge), and lands 25-70 m on. It stays below street level in the
  channel.
- **Pigeons** walk with the real nod (the head held still in the air, then
  thrust, timed to the steps). Standing near, they keep a pace off;
  walking through them (moving faster than 0.6 m/s within 2.4 m) flushes
  the flock: the plaza's to the station's roof lip (not behind the name
  board), the spine's to the nearest wires. They drift back in ones and
  twos once you are 10 m off.
- **The shiba** is tied out by a kennel in an open-fronted lane yard (the
  nearest house to `ANIMALS.shiba.near` whose frontage has no wall, fence
  or hedge and has room: picked by colliders at build). It lies watching
  (head tracking you within a neck's reach), dozes when no one is about,
  stands and wags if you stop within 4 m. The kennel has a bowl.
- **Butterflies** are drawn after the ground and without depth writes: at a
  few pixels the ink pass turned an inked cabbage white into a black
  speck. They are white specks now, as in life.
- **Cats** (placed by kit/dress.js) were spheres; life.js now dresses each
  as a sitting cat in one of four street coats (茶トラ, 三毛, ハチワレ,
  サバトラ), keeping the tail handle it swishes.
- **Sparrows** are tree sparrows now (chestnut cap, white cheek, black
  spot and bib, streaked back, white wing bar). About 400 triangles each,
  78 birds: 31 k triangles town-wide (the old ones were about 11 k).

## Cost (headless Chrome, Tan's M2, 1440p, before -> after)
- pond bench 221 -> 235 calls, 2.68 -> 2.74 M tris, 5.63 -> 5.87 ms
- river walk 334 -> 346 calls, 2.60 -> 2.67 M, 5.57 -> 5.92 ms
- paddy close 120 -> 129 calls, 1.74 -> 1.81 M, 3.89 -> 4.11 ms
- station plaza 384 -> 388 calls, 2.70 -> 2.74 M, 6.13 -> 6.24 ms
- lane houses 711 -> 720 calls, 2.91 -> 2.95 M, 7.42 -> 7.38 ms
- famous view: 797 calls, 7.8 ms; hero guard unchanged (0.258 / 0.353 /
  0.148 %).
- No textures (vertex colours only). About 100 k triangles if every kind
  were drawn at once; each kind is hidden beyond its own distance
  (`draw`, from its nearest animal) and updated only within 60 m.
- Moves are a few dozen small matrix and pose writes a frame; take-offs
  allocate nothing.

## Not done, noted
- Birds don't avoid each other on the ground; two pigeons can share a roof
  perch point.
- The shiba's lying pose is a sphinx lie; a curled sleeping dog would be a
  second morph.
- The heron doesn't show in 鏡池's mirror (it lives on the river, out of
  the mirror's reach).
