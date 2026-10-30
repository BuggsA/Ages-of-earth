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
4. **The computer plays it.** Megaliths is the last road off the Stone Age in `ROADS`, so the computer asks it only after passing every other turn, on its own coin (`MEGALITH.take`): it takes towns that would have gone the plain way to the Bronze Age (about one seat in ten over 20 seeds), and no other road loses a town to it, so the other roads' sweeps and proofs stand. Each age has its work (`megalithWork` in `ai.ts`) and a short stay. The `deep` route joins the computer's leanings with its sweeps (s7).
5. **At most three new things an age** (`docs/engagement.md`), and a keepsake each.

## Built

- **s1, the Age of Megaliths** (#877): `src/sim/henge.ts` (`inStone`, `hallowed`, `gathered`, `hengeStep`), `MEGALITH` and `HENGE` in `data.ts`, the Henge model in `src/render/deepModels.ts`, its look in `ageLooks.ts`, `ageGrounds.ts`, `ageAir.ts`, the `trilithon` plate in `src/ui/ageIcons.ts`, the emblem in `src/ui/ageArt/megaliths.ts`, the web map's eighth lane, tips, the gathering's sound (`gathering`, `solstice`).

- **s2, the Age of Delvings** (#881): `src/sim/delve.ts` (`isMouth`, `delveProblem`, `delve`, `delveStep`; `Unit.below`), the `delve` command, `DELVE` in `data.ts`, `ungarrison` leaving those still below until they arrive (or the mouth falls), Barrows refusing riders, the Barrow model, the `mound` plate, its emblem, palette and touches, the Delve button and its target mode, sounds `delve` and `surface`, `delveWork` in `ai.ts`.

- **s3, the Age of the Undercity** (#883): `src/sim/undercity.ts` (`sinkProblem`, `sink`, `surface`, `hiddenFrom`, `inert`, `caveIn`, `underStep`; `Building.sunk`, `sinking`, `rising`, `found`, `feel`), the `sink` command (`up` to surface), `UNDER` in `data.ts`, `Age.carries` (the Undercity raises the Delvings' Barrows awake), the sunk mound (`sunken` in `deepModels.ts`), its palette, touches, hat, ground, air, the `chimney` plate, its emblem, sounds `sinkDown`, `sinkUp`, `unearthed`, `underWork` in `ai.ts`.
  - **Hidden means hidden:** a rival's sunk building its team hasn't found is skipped by drawing and picking (`buildingsView.ts`), aiming (`canHit`), auto-targeting (`findTarget`), the attack, convert and keg commands (dropped as for an id it can't see) and the computer's targeting. Its footprint is open ground while sunk (`bldAt` keeps it, so nothing is built on it), so feet can stand on it.
  - **Warheads still burn what is sunk** until s6's deep vaults: `silo.ts` is untouched.
  - **Saves:** the new fields are optional, so older saves load as all-surface; no `v` bump.

- **s4, the Age of Deep Forges** (#884): vents laid by every town in `mapgen.ts` (`placeVents`, after the springs on dice of their own: one by every start whose 3 by 3 is open, level and in reach, and one out on the map for every two towns; `GameState.vents`, tiles, so no entity id shifts), `src/sim/forge.ts` (`ventSpot`, `forgeHot`, `ventRate` in `workRate`, `holder`, `scald`, `forgeStep`; `Building.held`, `scaldAt`, `spent`), the `scald` command, `VENT` in `data.ts`, the Vent Forge and vent models (`deepModels.ts`, `ventsView.ts`), the `anvil` plate, emblem, palette, touches, hat, ground, air, sounds `scald`, `forgeCold`, `forgeWarm`, `forgeWork` and `forgeSpot` in `ai.ts`.
  - **Never starved:** `tests/deep-forges.test.ts` raises a forge over every seat's vent on all six map types; a 324-map sweep (3 sizes, 2 to 4 players, 6 seeds) found none missing. A start with no bare ground in reach has the nearest level land cleared for its vent.
  - **No unit:** the issue allowed one at most; the age's arms are the forge's own steam instead (Scald), which answers the rival holding its vent.
  - **Seeded matches stay put:** the vents lie quiet until some people walks the Megaliths (`ventsAwake`); from then on nothing but a forge is raised on a vent or the eight tiles round it, for anyone. Keeping that ground clear from the first tick moved the computer's town layouts and broke three seeded tests (`ai-coil-layout`, `ai-hunt`, the slow `ai-floating-road`), even with only the vent tile closed. In 18 long hard-vs-hard matches with the vents awake from the start, every home vent still took a forge at the end; with them asleep throughout, 3 of 18 were built over (a forge then waits for that building to fall).

## Next
- **s5, the Age of Faults** (Atomic), **s6, the Living Earth** (past Faults), **s7** the sweeps (`npx tsx scripts/routes.ts --seeds 6 deep`) and the `deep` route joining the computer's leanings.
