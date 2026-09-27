# Inari shrine (experience 3), 2026-09-28

- **Lot deepened, not widened.** SPECIALS shrine z1 97 -> 101.5 (x 6..20 kept). The
  back-row lots on lane z 112 still fit (7 m minimum); nothing was moved by hand.
  Hero guard passes (0.27 / 0.37 / 0.16 %).
- **Layout, lane to back:** stone fence (玉垣) and name pillar; the Inari torii with
  its 台輪 rings, plaque and shimenawa; foxes (key right, jewel left, facing the
  path) and a pair of lanterns; the water pavilion on the right, the prayer notice
  on the left; 12 tunnel torii (z 4.3-9.8 in the lot); ema and omikuji racks and a
  second pair of lanterns; haiden (nagare-zukuri, 向拝 front posts with the bell);
  honden in its vermilion fence; the camphor (神木, roped) and the hero sakura.
- **Roof colour:** weathered copper green (緑青) with vermilion eaves and white
  bargeboards: it reads against the vermilion and the blossom. Nagare-zukuri, not
  irimoya: the long concave front slope is the shape that says "shrine" at this
  size.
- **Tunnel:** two InstancedMeshes (vermilion, black) plus one merged mesh of
  inscriptions (per-pillar atlas UVs can't be instanced without a custom shader).
  Donors on the left pillar, dates on the right, facing the hall (read walking
  out, as at Fushimi). Sizes vary +/-5 %.
- **Golden hour:** the sun (town frame, low from -x -z) is mostly blocked by the
  houses across lane z 80, so the tunnel is in warm shade with light spilling on
  the grounds beside it. The golden spot looks back through the tunnel at the
  inscriptions and the pink sky; that is the frame that works.
- **Prayer camera:** main.js now calls `target.action?.({ player, hud })` (added
  by the slow-life builder); the prayer bows the view through it, tested through
  `player.onInteract`. Without it the prayer still plays, toast and all.
- **Foxes** are smooth-shaded ('foxStone', flat: false; its own batch): slim chest,
  long neck, narrow muzzle, tall ears, a bushy tail with flame licks.
- **Nobori** use the shrine's own texture (kit/shrine/tex.js), measured to fit;
  every brush column now shrinks to its cell's width as well as its height.
- **Prayer text** lives in data/town.js (SHRINE_PRAYER), the file this builder
  owns; it could move to strings.js.
- **Sounds:** clap and bell are synthesised by scripts/make-shrine-sounds.mjs into
  assets/audio/*.wav (not committed), with cuts in audio-cuts.json (18 KB
  encoded). Fallback recipes: 'box' (clap), 'can' (bell). The coin reuses 'coins'.
- **Wind chimes zone** at the lot's centre, near 6, far 26, level 0.5; two glass
  風鈴 sway under the hall's eaves to match.
