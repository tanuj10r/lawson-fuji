# ドンペン堂: the goods pass (2026-09-29)

Tan: "The donkey store, from the outside, looks very, very basic ... redo
the way products are showcased." Reference: a real MEGA Don Quijote
entrance (goods spilling out under the canopy, POP cards at every height,
a wall of packages through the door).

- **Real packages, one mesh.** 95 coined products (tex.js PRODUCTS: snack
  bags, chocolate boxes, cup noodles, PET bottles, cans, cosmetics, cleaners,
  tissues, toys, candy, party goods, batteries) each get a 64 px printed
  face on a third page, PROD 768 x 512 (+2.1 MB with mips; sized for the
  1.5-3 m view on the walk). goods.js builds bodies (a pinched pillow for
  bags, boxes, bottles with neck and cap, cans, cups, tubs), wraps or fronts
  the print, bakes shading into vertex colours, and merges everything the
  front stamps into one MeshBasicMaterial mesh: every package on the store
  is one draw call. Chosen over one InstancedMesh per kind because the
  goods are static and near-only; the merged mesh is the fewest calls and
  about 1.5 MB of geometry.
- **The painted walls use the same packages.** productWall() stamps PROD
  cells instead of colour blocks, so the far walls match the near goods.
  They are drawn at 1.5x true scale (a shelf of true-size packs looked
  empty at 97 px a metre).
- **Names in the system gothic.** Package names are new text; the subset
  fonts hold only src/data/town.js, and town.js is not mine. Packaging in
  a plain gothic is right anyway. POP cards still draw from DONPEN.pop.
- **Fixtures.** Gondola shelving (five shelves, gold price rails, a printed
  back) inside; chrome shelving carts, stacked wire baskets, cut-open cases
  and dump bins on the walk; goods hung on rails under the canopy and on
  pegboards on the columns; price cards on sticks on every tier and on
  strings from the canopy. Every fixture is built in its own frame
  (frame()), so shelves face any way.
- **The walk stays clear.** Everything on the pavement is within 0.65 m of
  the frontage as before (1.55 m of the 2.2 m walk clear); hanging goods
  bottom out above 2.3 m. The walk check reads stuck 0.
- **Cost.** Draw calls unchanged at donki-front / donki-entrance (531 /
  376: the goods merge into existing batches plus one new mesh);
  +40k triangles; textures +2.1 MB; frame ms within noise.
- **Left alone.** The building, the big signs, the mascot, the theme zone,
  the night pools and the wagons' striped skirts.
