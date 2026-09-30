# Builder guide: the town quality pass

For the specialist agents. Read AGENTS.md first; everything there applies.
You own a few files (below). You may read anything; edit only yours. If you
need a hook in a file you don't own, stop and ask for it in your report.

## The look
Keep today's look: flat cel bands, dark ink outlines, clean colour. It is
cartoonish on purpose. No bloom, glow, haze, light leaks, vignettes,
film grain or new post passes. Detail, density and shape are the aim,
not effects. Before you change anything, shoot your area and keep the
frames: that is "the look" to match.

## The frame
The town is built in its own frame, turned half round about the main road:
world = (-x, 2*13.85 - z). Town code (town-core, kit, land) works in that
frame; `ctx.toWorld` / `toLocal` convert. The famous views stand at world
(0, 16.5) looking -z toward Fuji; the store is untouched.

## The shared API (use it; don't reinvent it)
- `ctx.add(obj)`, `ctx.collide(x0,z0,x1,z1,top)`, `ctx.platform({...})`,
  `ctx.registry.push({kind,x,z,rect})` (density), `ctx.update(fn)`
  (per-frame; never your own rAF or setInterval), `ctx.night.pool(...)`.
- Materials: `cel({color, bands, tint, map})` and `flat()` from
  core/toon.js; worn surfaces through kit/paint.js.
- Trees and pots: `plant(ctx, species, spot)` (kit/green.js), batched.
- Signs: Canvas2D through kit/tex.js. Fonts: `JP` (system gothic),
  `JP_ROUND` (M PLUS Rounded 1c) and `JP_BRUSH` (Yuji Syuku), self-hosted
  and loaded before the town builds. The fonts hold only the characters
  already in src/ (the brush face: only src/data/town.js), and the full
  fonts are not in your worktree: put new sign text in src/data/town.js,
  and I re-cut the fonts (`npm run fonts`) when I merge. Until then a
  missing character draws in the system gothic, which is fine for review.
- Static meshes are merged per 128 m cell by merge.js. Tag small props
  `userData.detail = true` (no cast shadow); moving things
  `userData.dynamic = true` (not merged).
- Many of one thing: one InstancedMesh per kind, always.

## Cost
Budgets are guides, not limits; the real test is seamless play on Tan's
M2, which is short of memory. Report, for your area, before and after:
texture MB, triangles, draw calls at its spots, and anything that grew.
- Textures are most of the memory: make each the size it is seen at
  (a shop sign is 256-512 px wide, not 2048). Reuse atlases.
- Nothing animates beyond about 60 m; nothing updates when unseen.
- Aim: your area adds under ~15 draw calls at its spots and a few MB.
  Flag anything bigger with the reason.

## The screenshot loop (mandatory, every iteration)
1. `node scripts/shots.mjs --spots <your spots> --quick --size 1280x720 --scale 1`
   for work in progress. Runs queue on a lock; one Chrome at a time.
2. Look at every frame at 1-3 m, mid range and the overview. Compare
   with reference/ (mood.png, mood-day.png, density/). Fix. Repeat.
3. Before reporting: the full-size run of your spots, then
   `node scripts/shots.mjs --spots hero --quick`. The hero guard must pass
   (< 0.5 %).
Never edit src/ while a shots run is going (the dev server reloads).
Never leave a Chrome or dev server running.

## Rules
- No people. No Sakura Crossing names. No real brands.
- Japanese in the world only; UI text in src/data/strings.js.
- Tunables in src/config.js blocks made for you (ask for new ones).
- Log judgement calls in docs/decisions/<area>.md (short entries).
- Your report: what changed, numbers, 3 frames, open questions.

## Ownership
| Area | Files |
| --- | --- |
| Streets & poles | kit/roads, kit/markings, kit/poles, kit/signs, kit/decals, kit/dress, streetprops.js |
| Facades & shopfronts | kit/buildings, kit/houses, kit/shopfronts, kit/specials (not the station), shops.js, housing.js, buildings.js |
| Sakura & greenery | kit/sakura, kit/canopy, kit/green, trees.js, petals.js |
| River & paddies | src/world/land/* (new) |
| Animals | kit/life.js, src/world/animals/* (new) |

Nobody else edits: src/core/*, main.js, config.js (except your block),
town.js, town-core.js, town-plan.js, town-edge.js, lawson*, store/*, line/*.
