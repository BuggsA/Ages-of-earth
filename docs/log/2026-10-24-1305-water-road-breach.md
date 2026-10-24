# The Water Road, s3: the breach (#701)

Chain 1024-2000, session 3 of 8, lane rules (hard).

- **The rule, stateless:** `floodStep` (water.ts), every `BREACH.every` s: each polder tile (no finished dyke on it) four-ways beside water that `seaAt` judges open sea (its body, through water no finished dyke holds, touches a map edge or passes `POLDER.most` tiles: the mill's own test) floods, all at once, in tile order (`floodFront`, `flood`). Nothing is stored but a counter (`GameState.flooded`, for the renderer): a fallen dyke, a deleted one, a site never finished, or a channel cut in from the sea all flood by the same rule, and closing the gap with a finished dyke stops it. Each step's water bodies are asked once (`known` map). Without polder the step returns at once.
- **A flooded tile** is sea: `T_WATER`, `B_TERRAIN`, polder cleared, corners sunk to `BREACH.bank`/`bed` (still shallow, so a dyke can be raised in it again). A building on it is drowned (hp 0, no kill credit). Land units on it are swept to the nearest dry tile within `BREACH.sweep` and hurt `BREACH.unit`, or drowned if none.
- **Pumping back:** unchanged. Once the gap holds, `basinOf` finds a closed basin again and the mill pumps it out.
- **Breaking a dyke:** a keg does `BREACH.keg`× to a dyke (one keg breaches); siege keeps its 1.2× wall multiplier. `heldBack(s, dyke)`: the polder its fall would flood (bounded search), shown on a selected dyke to both sides.
- **Mending:** a people that has walked the Age of Dykes raises dykes in any age after (`buildBarred`, like the Grove's planting).
- **The computer:** `dykeWork` marks `mem.dyke.raised` once its line stands whole; from then any gap is re-laid at once (queued builds, 6 s apart), in the age or after it while dykes may be raised. Mills only in the age. `machinesAtDykes`: on campaign, siege goes for the nearest seen rival dyke within `AI_BREACH.hunt` holding back `AI_BREACH.least`+ polder. `kegFirst`: such a dyke ranks before towers for the Sappers.
- **Fix on the way:** `drain` clears the channel flag, so a pumped-out channel tile is no longer waded at 40% pace on dry polder.
- **Look and sound:** `groan` (a dyke falling on water: bank slumps, crown cracks, the roar), `rush` (every few flooded tiles), white-water bursts per tile, a splash where a building drowns, minimap ping; terrain and minimap repaint on `s.flooded`. Toast once a flood: "The sea is in your polder!". Dev hook `ages.breach(owner)`.
- **Save:** no bump; the only new state is an optional counter (`flooded`) and an optional AI flag (`raised`), both absent in a v5 save and read as zero/false.
- **Numbers new in data.ts:** `BREACH = { every: 0.5, bank: -0.16, bed: -0.4, sweep: 16, unit: 15, keg: 2 }`, `AI_BREACH = { least: 8, hunt: 12 }`.
- **Tests:** `tests/breach.test.ts` (9), `tests/ai-breach.test.ts` (2).
- **Browser:** `npx vite`, seed 1 lakes, `ages.dykes(0)`, `ages.fast(65)`, `ages.breach(0)`: the dyke's rubble and white water running into the polder strip, the mill standing; no page errors. Swiftshader runs slow, so only 4 tiles had flooded in 7 s of real time. Sound not heard.
