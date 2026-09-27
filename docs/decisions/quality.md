# Town quality: findings and decisions (2026-09-28, the night before launch)

How the town was walked: a placement probe (every parked bicycle and car
against buildings, walls, walks and each other; every walk sampled every
0.25 m for its clear width; every collider against what is drawn there and
every standing thing against the colliders), then 84 eye-level frames down
every street both ways, the plaza, the station forecourt, the river's three
walks, the paddies, the pond's grounds and both car parks, then close-ups
of whatever either turned up. Coordinates are the town's own frame
(`town x,z`) unless marked `world`.

Counts, by kind of fault: **28 found, 20 fixed, 4 handed over** to the
builders who own the files, **4 left** (2 on purpose: the famous views'
two sakura and the road ends' barricades; 2 noted for their owners: the
pond house and the canopy facets). By instance: 49 bicycles moved (1 more
handed over), 12 cars, 14 walk faults, kerbs dropped at 5 zebra landings,
2 car parks given a way in, 3 rubbish stations and 12 sakura out of houses
(the hidden post boxes and half-buried benches with them), 41 colliders
added. The count of
instances is in brackets below.

## Tan's four findings

1. **Bicycles** (fixed, 5 kinds)
   - (3) In the store's onigiri aisle: the staff's 8-bike rack at the store's
     left wall was turned across the wall, three bikes inside. Now a 4-bike
     rack along the wall, front wheels to it (town-edge.js).
   - (31) House bikes stood across the frontage, 0.1-0.5 m into the house
     wall. Now along the frontage in the yard, clear of the gate, the pots
     and the wall (kit/houses.js); the yard's pot crowd keeps to the other
     side.
   - (6) Shop-front bikes stood across the walk, half in the shop by its
     door. Now along the front at the end away from the door, on the walk's
     back 0.6 m (kit/shopfronts.js).
   - (3 racks, 9 bikes) The spine corners' racks stood in the corner shops,
     through a planter and across the walk. Now three bikes along the kerb
     just past the corner, where the walk keeps 1.2 m (kit/dress.js).
   - Kerbside bikes landed on a street tree's pit: the main road's trees are
     planted before the dressing and the clutter keeps off them
     (town-core.js, kit/street/walks.js).
2. **Cars** (fixed, 2 kinds). A car is long along its x, so `ry: 0` laid
   every forecourt and car park car across its 2.5-2.7 m bay, 0.7-1.4 m into
   the next car (4 forecourt keis, 8 car park cars). Forecourt keis are
   nosed in, front wheels at the wheel stops (town-edge.js); the car park's
   are backed in to their stops, fronts to the aisle, as in Japan
   (land/parking.js, `vehicleWheels` in vehicles.js). Probe: 14 cars, none
   overlapping, all on the ground.
3. **The car park across the road had no way in** (fixed, 4 kinds)
   - Now one-way: in off the main road at its west end over a dropped kerb
     in the far walk (config `DRIVEWAYS.far`, lawson.js), an arrow in, arrows
     down a 4.9 m aisle, out at the east end onto the bridge road past a stop
     line and 止まれ, 2.5 x 4.85 m bays, the walkway to the stairs zebra-striped
     across the aisle, 月極駐車場 + 入口 at the way in, 出口 at the way out.
   - The street dressing counted the car park as an empty gap on the bridge
     road and planted a sakura in its way out (kit/dress.js), and a strip of
     verge ran across the exit (now paved to the lane).
   - Han's bay: the road row's east bay, nearest the main road and the bridge
     road, is painted and left empty; the lot's board moved out of it to the
     way in. Bay centre town (24.15, 4.83), world (-24.15, 22.87); its wheel
     stop at town z 6.6; the RX-7 backs in facing -z (town).
   - The coin parking had no way in either: the store side's walk ran
     unbroken along it. Dropped kerb at world x -56.8..-51.6 (config
     `DRIVEWAYS.north`, town-edge.js); poles and kerb clutter keep off it.
     The store's forecourt was fine: it meets the road with no kerb.
4. **Walks** (fixed, 4 kinds; one left on purpose)
   - (2) Where the spine's walks meet the plaza, three bollards 0.64 m apart
     (narrower than the player) closed both walks. Two now, 1.3 m apart.
   - (12) Walks pinched below 1.2 m (0.64-1.18 m) where a kerb item (bike,
     A-board, crates, pole, sign) faced a back-edge item (shop flag, vending
     pair, bench). Every walk placer now asks `walkRoom` (street/walks.js)
     and keeps 1.2 m clear. Probe: no pinches left on any walk.
   - (5) Kerbs did not drop at zebras: the spine's two zebras, both sides,
     and the main road's zebra at the far walk. The kerb-side 0.9 m now
     drops to a finger's height with a ramp each way; the back of the walk
     keeps its level, so shop thresholds and the guide line stay put, and
     the warning pads sit on the lowered band (kit/roads.js, markings.js,
     lawson.js; `droppedKerb` in streetprops.js does both axes).
   - Left: the main road's two ends are barricaded across road and walks.
     That is the town's edge, and the player is clamped there anyway.
   - Walk routes: stuck 0 on all six (stairs, stepping stones and the
     bridge included).

## The sweep

5. (fixed, 3) Rubbish stations (ゴミステーション) stood 0.3-0.75 m into
   houses: a lane's gap can be a cross street's corner lot. The gap filler
   now checks house footprints (kit/dress.js).
6. (fixed, 12) Sakura trunks stood inside houses, same cause.
7. (not fixed, 2, on purpose) Two sakura in the famous views' sightline
   behind the store, town (7.5, 48.7) and (22.1, 48.7), have trunks against
   a house front. Taking one out moved hero-1 by 0.44% (the guard's limit
   is 0.5%), so both stay. Tan's call.
8. (fixed) Corner post boxes stood 0.6 m past the spine's walk: inside the
   corner shops, out of sight. They now stand on the walk's back corner,
   where the way stays 1.2 m clear, or at a lane corner's verge unless a
   house is there.
9. (fixed) Lane-side benches, planters and crates stood half in house walls
   (same gap cause).
10. (fixed, 41) Gas meters by house and shop walls had no collider, and
    neither did the shops' flank aircon units. Now they do.
11. (fixed) Paint and lids that would float over a dropped kerb: the
    crossing pads follow the band, and the pavement lids keep off it.
12. (checked, fine) No collider stands where nothing is drawn. Mirrored
    lettering: none (two-sided sign plates share one map; the new car park
    boards are one-sided). Signs face their readers. No floating or sunk
    props beyond wall-mounted lamps, meters and sign plates, which hang by
    design. Hero guard, audio tests, STOCK: pass.
13. (not fixed, noted) Pond: the family house at town (91.5, 103.8) faces
    +z with its front door 2.4 m from the tea-house row's blank back wall.
    Not a fault you can walk into; turning it would change the pond frames,
    which are the quality bar.
14. (not fixed, noted) At arm's length a sakura canopy's ink outline shows
    its facets as a lattice (the river's top walk, town (-45, -9.3)). Only
    under a low branch; a look question for the canopy's owner.

## Handed over (files other builders own tonight)

15. **line/station.js:571** (station builder): the police box's bicycle,
    `makeBicycle({ x: P.x0 + 5.2, ry: 0.1 })`, stands across the koban's
    front and 0.1 m into its wall. `ry: Math.PI / 2` at `x: P.x0 + 5.0`
    parks it along the front.
16. **kit/specials.js `coinParking`** (shared with the shrine and the
    megastore): its cars' colliders are 2.6 x 2.6 m for cars 3.4-4.3 m
    long, so you walk 0.4-0.9 m into a bonnet or boot. `parkVehicle` sizes
    them from the car.
17. **kit/specials.js `park`**: the terracotta planter at town (16.2, 115.5)
    has no collider.
18. **The spawn and the car park** (Tan / the store's owner): there is no
    zebra between the store and the car park; the nearest is the master
    junction's, 35 m west. A crossing there would show in the famous views,
    so none was added.

## Judgement calls

- **Cars back into the car park's bays** (後ろ向き駐車, the norm in
  Japan), and nose into the store's forecourt as the mood reference has
  them.
- **One-way car park, in from the main road, out to the bridge road.** A
  left turn in for traffic in the near lane (the town keeps left), and out
  onto the quieter road, 13 m from the master junction's signals.
- **A driveway lowers the whole walk; a zebra lowers only the kerb-side
  0.9 m.** A car crosses the whole walk; people only need the kerb gone.
- **Draws kept in order.** Where a check now skips a piece of dressing, the
  random draws it would have used are still made, so nothing else in the
  street moves. That, and leaving the two sakura in item 7, keeps the
  famous views: hero-1 0.270%, hero-2 0.467%, hero-3 0.158% (main: 0.269,
  0.365, 0.158). The 0.10% on hero-2 is the right-hand forecourt keis'
  golden-hour shadow, now that they are nosed in.
- **Fewer things.** 93 bikes became 72, and 12 sakura, 3 rubbish stations
  and the hidden post boxes are gone. Every before/after spot draws fewer
  calls (mean -6) and triangles (mean -242k).
