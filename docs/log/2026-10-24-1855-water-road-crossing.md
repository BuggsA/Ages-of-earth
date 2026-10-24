# The Water Road, s8: the Age of the Sea Beggars, sweeps and the route table (#783, #701)

Chain 1024-2000, session 7 of 8, lane rules (hard).

- **The age:** `beggars`, tier 2, no route (a crossing stands on none), keepsake the Dock, flag `boards`. Door: no walls or gates (`noBuild`), no fishing boats (`no.units`), ships ×1.2 (`price.ship`).
- **Roads:** `middle → beggars` (400f 450w 150g, 45 s, Dock clue, hard gate, `crossing: ['dykes', 'sail']`); `beggars → middle` (200f 150w, 25 s); `beggars → gunpowder` (900f 500w 450g 150s, 65 s).
- **Boarding:** `board` in `src/sim/beggars.ts`, called from `hurt` (`combat.ts`) before a unit counts as killed: a rival water unit (not a `tow`, not a transport with cargo) beaten to 0 by a ship of a boarding people changes sides with `BEGGARS.left` (0.35) of its health, its carry and hold, its orders forgotten. Event `boarded`; stat `boarded`. `boardsAt`: in the age, a Golden Age woven with it (`VERB_KEYS`), or within `BEGGARS.haven` (12) of a Dock kept as its keepsake.
- **Splash:** a shot's splash passes its shooter as credit only when `boarder` says so (a ship of a people that boards), so splash from anyone else still credits no one, as before.
- **Cutting:** `cuts` in `beggars.ts`, read by `damageOf`: a boarding people's ship strikes a dyke, sluice, dam or causeway at `BEGGARS.cut` (1.2) instead of the wall rule's 0.15.
- **The Age of Rivers' keepsake:** a Farm (`fieldBoost`: the kept Farm, watered, works at `RIVERS.farm` on any road).
- **The computer:** `CROSS_PLAN.beggars` (salt 0xbe66, keeps a Dock, `AI_BEGGARS.take` 0.5, `stay` 120 s); `crossPlanned` now refuses a plan whose other sibling's road has a coast door the town can't open (the Dykes). It holds the age `AI_BEGGARS.hold` (300 s), hunts cogs as a sailor does, trains no barred fishing boats, sails its idle fleet to a seen rival Dock or else to the tile of its own water nearest the rival's town (`prowlFor`, a flood fill once, kept in `AiMemory.beggarSea`), and with no rival ships seen sends idle warships at the nearest rival dyke within `AI_BEGGARS.hunt` (30) of its Dock that holds back `AI_BREACH.least` polder (`dykeToCut`).
- **Look, sound, HUD:** a splash and smoke where a ship is taken (`view.ts`), the `boarded` cue (grappling irons, feet on planking, a bosun's whistle), toasts to both sides, two tips, the web map (lane 3, row 3.5). Dev hook `ages.beggars(0)`.
- **Sweeps:** `routeMaps('water')` is lakes, sea and continental. Results in `docs/age-roads.md` §1.
- **Save:** no `v` bump (new optional stat only).
- **Numbers new in data.ts:** `BEGGARS = { left: 0.35, haven: 12, cut: 1.2 }`, `AI_BEGGARS = { take: 0.5, stay: 120, hold: 300, hunt: 30 }`, the age and its three roads.
- **Tests:** `tests/beggars.test.ts` (8), `tests/ai-beggars.test.ts` (3), `tests/water-keepsakes.test.ts` (2).
