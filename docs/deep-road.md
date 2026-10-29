# The Deep Road (#876)

A fourth trunk the length of the game, beside the plain road, the Water Road and the Steppe: the `deep` route. The owner asked for it on 2026-10-29 (`docs/rulings.md`): "ult better than atomic, fission, or fusion by the time it gets to the end … pretty easy to get to from the beginning … uniquely creative, a good theme, and justify being better than that other trunk." Then: "makes sure to not make the resources impossible to get … keep art varied … ensure all the background stuff exists."

The game is *Ages of Earth*: on this road a people stops building **on** the land and starts building **into** it, until at the end it moves the land itself.

## The ages

| Tier | Age (instead of) | You now… | It shuts… | Look |
| --- | --- | --- | --- | --- |
| 1 | **Megaliths** (Bronze), built | build in stone, not timber; Henges hold their ring and gather the people at each turn of the year | timber paid in stone, building slower | dressed granite, peat roofs, chalk and lichen; trilithon plate, spiral motif, carved |
| 2 | **Delvings** (Middle) | barrow-mouths joined underground: in at one, out at any other | no Stable | dark earth, timber props, lantern amber |
| 3 | **Undercity** (Gunpowder) | sink buildings: unseen and out of reach of shot, surfacing to train or fight (Derinkuyu) | no walls or towers above ground | carved sandstone, rock-cut doors |
| 4 | **Deep Forges** (Industrial) | vents of the earth's heat drive the buildings round them | the town is bound to its vents | basalt and ember |
| 5 | **Faults** (Atomic) | fault engines crack chasms along a line | no Missile Silo | split rock, teal crystal |
| 5 | **Living Earth** (past Faults) | raise ridges, sink districts; the Quake rewrites the map for good; deep vaults ride out a warhead | no navy or air; quakes shake your own ground; rivals hear the tremor build | green living stone veined with gold |

**Why its end can top Fission and Fusion** (#756): a warhead burns what stands on the land, and the town rebuilds; the Living Earth changes the land itself, and a town sunk below it rides a warhead out. The price is the journey (slow, stone-bound, weak on the surface), the tremor everyone sees coming, and the quake's cost to its own ground.

## Rules for every step

1. **Never starved of its resource.** Each age's resource is laid by every town on every seed, or made from something that is, with a test across maps and seeds. Megaliths: every town has 1,200 stone within 15 tiles on every map type (`tests/megaliths.test.ts`), the Mine Shaft stays timber so it can always be sunk, and in the age it digs stone from plain earth at `MEGALITH.grade` (twice the usual). Deep Forges will lay a vent by every town, as the Water Road lays spring heads. A people that quarries no stone at all (the Mongols, `quarries` in `nomad.ts`) finds the road shut, with the reason on the button: a town in stone would wait on tribute for every wall.
2. **Easy to reach.** Stone → Megaliths has no ore, deed or coast: it is on the Town Center once the first House (or a Storehouse) stands, which every town raises in its first minutes. Later steps are climbs from the age before (`walked`), with crossings back to the plain road at every tier.
3. **Varied art.** Every age has its own palette, touches, citizen hat, ground, air, button plate and emblem; no two share a stone. Add a plate shape where none fits (`trilithon` was new for Megaliths).
4. **The computer plays it.** It decides the road on its own coin (`MEGALITH.take`), before the other turns off the Stone Age, so the road isn't starved by roads listed earlier; each age has its work (`megalithWork` in `ai.ts`) and a stay.
5. **At most three new things an age** (`docs/engagement.md`), and a keepsake each.

## Built

- **s1, the Age of Megaliths** (#877): `src/sim/henge.ts` (`inStone`, `hallowed`, `gathered`, `hengeStep`), `MEGALITH` and `HENGE` in `data.ts`, the Henge model in `src/render/deepModels.ts`, its look in `ageLooks.ts`, `ageGrounds.ts`, `ageAir.ts`, the `trilithon` plate in `src/ui/ageIcons.ts`, the emblem in `src/ui/ageArt/megaliths.ts`, the web map's eighth lane, tips, the gathering's sound (`gathering`, `solstice`).

## Next

- **s2, the Age of Delvings:** a Barrow-mouth building; units garrisoned in one leave from any other of the people's (`unload` at a chosen mouth). Counter: a mouth falls and those inside are lost; scouting a mouth shows a rival where the army can surface. Keepsake: one mouth keeps its tunnel to the Town Center.
- Then s3 to s6 as the table says; s7 the sweeps (`npx tsx scripts/routes.ts --seeds 6 deep`).
