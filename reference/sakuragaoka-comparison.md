# Sakuragaoka Station vs our town (2026-09-26)

Kenton Wang's rebuild of Sakura Crossing, made with Opus 5.5:
https://github.com/Kenton-GMI/sakuragaoka-station (MIT). Studied for
inspiration only; nothing is copied. His screenshots are not kept here.

## How it was built

`docs/DESIGN.md` is a builder guide for about 16 parallel specialist
agents: environment, street, poles, railway, station, plaza, two shop
teams, houses, sakura, trains, crossing, props, vehicles, characters,
petals, audio. Each owns only its own files, works through one shared
`ctx` API (materials, kit, wires, physics, audio, services), has its own
triangle budget, and must verify with screenshots at 1-3 m, mid range,
the hero view and an overview, then fix and repeat. 161 files, about 3.3
MB of source. Ours: 89 files, 1.6 MB, a large part of it the store, built
by one agent milestone by milestone.

## Why it looks so good, most important first

1. **The render pipeline.** A normal + depth pre-pass feeds the outlines
   (depth Laplacian plus normal discontinuity, so creases where depth is
   continuous are inked too; line colour follows the surface). 4x MSAA in
   half-float HDR instead of FXAA. Bloom and a wide soft "film diffusion"
   glow, a light leak on the sun side, vignette, grading. Ours: depth-only
   ink, grade, FXAA, no bloom (an AGENTS.md rule).
2. **Every surface is hand-painted.** One shader patch on the shared toon
   material adds world-space noise ("paint", 0-0.15) and optional grime,
   so no wall or road is ever one flat colour.
3. **People and animals.** A salaryman, an office worker, a schoolgirl
   with a bike, a passenger in the train, cats, sparrows. We have none.
4. **Density at eye level.** Gashapon machines, crates, A-frame boards,
   bikes with baskets, tactile paving, designed manholes, address plates,
   no-parking and route signs, pole ads and gear, wires with real sag.
5. **Sakura.** Big layered canopies with dark limbs showing, and petals
   everywhere: streaks on the asphalt, drifts at kerbs, on water, benches
   and train roofs.
6. **Architecture.** Rounded and bevelled main forms, eaves, sills,
   balconies, flower boxes; eight shops with interiors behind the glass.
7. **The world beyond.** A river and levee, rice paddies, greenhouses,
   far hills with towns and pylons, layered haze. Ours ends in flat fog.
8. **Typography.** Five Japanese web fonts (sans, serif, rounded, two
   hand-written/brush) make signs feel lettered. Ours: system fonts.

## What it costs (measured on Tan's M2, 1600x900, headless Chrome)

| | Sakuragaoka | Nippon Fuji |
| --- | --- | --- |
| Frame (GPU-timed) | 20.2 ms | 3-5 ms at the famous view |
| Draw calls | 2,267 | about 750 |
| Triangles | 9.3 M | 3.4 M |
| Shader programs | 150 | far fewer |
| JS heap | 623 MB | 490 MB |
| Textures (estimated) | about 631 MB | 379 MB |
| Ready | 10-17 s | about 6 s |
| Runtime requests to other domains | three.js from jsDelivr, Google Fonts | none |

His fidelity is bought with far more memory and GPU. On a laptop that is
already swapping it would be heavier than ours. The aim is his look at
our cost, within the 300 MB budget of AGENTS.md.

## Where we are ahead

Fuji and the famous composition; time-of-day looks; a playable loop
(basket, wallet, 440 products, fridges); recorded and local sound; no
network at runtime; a fraction of the frame time.

## Worth taking (inspiration, our own execution)

In order of look gained per cost:

1. The render pipeline: normal-buffer outlines, MSAA in place of FXAA, a
   restrained diffusion glow, a light leak and vignette. Needs Tan's call
   on the "no bloom" rule. About 2-4 ms of GPU.
2. World-space paint noise in our toon material: nearly free.
3. Self-hosted Japanese fonts (a rounded one and a brush one, subset):
   a few hundred KB, no runtime request.
4. An eye-level density pass on the streets you walk: the shopping spine,
   the plaza, the crossing.
5. Sakura: bigger canopies, visible limbs, far more petals on the ground.
6. People and animals, instanced and few.
7. The world beyond the town: river, levee, paddies, far hills.

And the method: specialist agents with strict ownership, budgets in
**MB and ms as well as triangles**, and a mandatory close-up screenshot
loop.
