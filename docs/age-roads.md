# The age road: your empire, built through the ages

**Status: the owner's direction (2026-10-22, `docs/rulings.md`), still being fleshed out.** Umbrella: see `docs/goals.md`, Goal 2. The owner: "Some of it still needs to be fleshed out." Agents flesh it out by building, and note what they decided here.

## The idea, in the owner's words

"Pick your strategy and explore it to best your opponent. Building out your strat should be as fun as destroying your opponent. I think that is why I would like lots of ages. Similar but very different than a build your deck where you can pick the things you want. Certain ages really are better than others at certain things. Some ages really are inferior but maybe lead you to some really good ones."

On finding them: ages "should all be available if the resource was available but they should be hard to find but make sense. The map seed allows for some resources. There should be something that you can build or purchase somewhat early that you can see what resources are on the map. Then maybe as you level it up where they are or who took them and you can reclaim them from destroying and picking up the resources and bringing them back. No resources should be crazy hard to find. But the ages should be complex enough where it makes sense for players to build wikis showing different ages, how to unlock them, the benefits, which ones are obscure and hard to get to."

And then: "Ages shouldn't be remember across matches with the exception of seeing them in the main menu screen. maybe some elsewhere. But they shouldn't be blocked by a new player. They just may not know how to get there, know that it exsists or maybe the map seed doesn't have the resources."

On how it should feel, and going back (same chat): "The ages shouldn't be literal cards. Just something you build your empire/city too. Maybe you can add that imagery in but it shouldn't feel like you picked a card. You should also be able to go back ages if it helps. Maybe for some niche ages it is required. Get something maybe build, tech or something then go back to so some other age and other path. Lets flesh this out more"

On the simple routes (same chat): "you should be able to follow some basic branches. It should be fun if you don't want to explore the ages just build an army or build a navy, build an economy to crush the opponent. It shouldn't feel forced if someone wants they can find their one play style and stick to it."

## What it means for building

0. **Clear basic routes, always open, always fun.** On every map, with no prospecting and no rare resources, a player can pick a plain style (an army, a navy, an economy) and follow it to a win: ages with a clear name and purpose, readable from the age-up buttons. Exploring the web is an invitation, never a toll. A player who finds one style and sticks to it every game must stay competitive; rare routes are different, not strictly stronger. The computer plays these routes too.
1. **Your road is built during the match, and it is your town that changes, not a hand of cards.** Each age is something your empire *becomes*: its buildings, its people, what they do and how the town looks and sounds. The choice is made at the Town Center from the roads this map and your past offer, and it shows in the world. The deck is only the owner's comparison for "pick what you want": never cards, hands, draws or decks in the game's words or screens. Card-like imagery is allowed in small doses (a chronicle page, a banner), as long as taking an age feels like turning your town, not playing a card.
2. **Every age is good at something and bad at something.** Say what it's for in one line ("the trade age", "the age that can't wall"). An age good at everything is a must-pick (`docs/verbs.md`).
3. **Gateway ages are allowed to be weak.** An age may be poor on its own if it is the only road to a strong one. The weakness is the price, and a rival who scouts it gets a window to punish it. Say on its button where it leads, once known.
4. **Ages are gated by what the land holds.** An age needs a key resource (an ore, a creature, a ruin, a landmark) that only some seeds place. If the seed has it, the age can be reached; if not, it can't, and the player can learn that early.
5. **Finding out is a building you grow.** Bought or built early, it tells you which key resources this world holds (yes or no). Upgraded, it shows where they lie. Upgraded again, who holds them and how much they've taken. Never "crazy hard": every placed resource can be found by a player who invests in looking.
6. **What a rival took can be taken back.** Destroy what holds it (a mine camp, a storehouse, a caravan) and carry the dropped resource home.
7. **Wiki-worthy, not hidden.** Recipes should make sense from the fiction (salt for caravans, saltpetre for powder), be learnable over many matches, and reward knowing them. A route few players know about is the goal; one nobody can find is a bug.
8. **Never locked, only unknown.** A new player can reach any age in their first match: nothing carries over between matches to unlock it. What stands in the way is knowing it exists, knowing how to get there, and whether this map holds its resource. Ages a player has reached are remembered only for display: the main menu's web of ages (and maybe other places, like a match's end report), never as a gate.
9. **Going back is a move, not a mistake.** A people can go back an age (§5) to undo a turn that went wrong, to pick up a road it passed, or to carry something from one branch into another. Some niche ages *need* it: they open only to a people that has walked two branches that leave from the same age, so it must turn, earn something, come back and turn again. Going back costs time and leaves a window a rival can punish.
10. **Trade bridges what your land lacks.** A key resource missing from your map closes no age for good: it can be bought, dear and rising in price, at a trading post that holds it, or traded for, raided off a rival's caravans, or taken from their mine. Trade's new job is moving the materials of the road, not more gold.

## Built already (extend these; don't start over)

- Rare ores only some seeds hold: bog iron, salt, saltpetre, blood-iron, in caves (`R_BOG`, `RARES` in `src/sim/types.ts`, #39, #356).
- Ages and techs that need them (`ore` on ages and techs in `src/sim/data.ts`); roads hidden until a clue building, a ruin or a survey (`clue`, `ruin`, `found` on `Road`).
- The Prospector's Lodge, level 1 (#562, s1): a building raised in the Stone Age (`BUILDINGS.prospector`, `PROSPECTOR`) answers yes or no for every key resource (`KEYS`: bog iron, salt, saltpetre, blood-iron, ruins). Finishing it marks Survey the Land as known (`prospect`, `prospected` in `src/sim/ages.ts`), so the iron road's `found: 'survey'` gate and older saves read it unchanged. `keyOf`, `opensOf` and `lacking` say what each key resource opens and what this world lacks; the age panel adds "This world lacks …" and the Town Center shows an only-road the world can't open greyed, with the reason. Survey the Land is never researched now, only granted by a finished lodge (`legacy` on `TECHS.survey`; `techProblem` refuses it); the owner allowed `tests/slow/iron-age.test.ts` to raise a lodge instead (#563).
- The age web: about 20 ages and 28 roads, every side age with a verb (`VERB_GAPS.ages` is empty).
- Going back: a Town Center **steps back** one main-road tier (`STEP_BACK`: 100 food and 50 gold a tier, 25 s, then 5 minutes before the next); units fall back to their older form, technologies above the tier are suspended, not lost. Most side ages also have a cheap **road back** to the age they left (Sail, Pilgrim, Warband, Merchant → Medieval).
- The lodge, level 2 (#565, s2): **Chart the Veins** at the lodge from the Bronze Age (`TECHS.chart`) keeps `Player.chart`, every key-resource tile as it was when charted (`chartLand`, `keyAt`), which the minimap marks under fog with the unseen ruins. A picture, not sight: a vein dug out later still shows, so it says nothing of who mines. The computer charts once its mind is made up on a road whose key this world holds (`chartRoad` in `ai.ts`). 
- The lodge, level 3 (#568): **Assay the Holdings** from the Middle Ages (`TECHS.assay`). Live, unlike the chart: `diggersAt` (who digs each key tile now) rings charted veins on the minimap in the digger's colour, and `holdingsOf` (rare ore in store, bog iron dug) fills the lodge's tip for every people. The computer assays once a rival stands in an age a key resource opens (`assayRoad`) and then sends riders at a rival's digger within `AI_ASSAY.reach` of home. Next on the umbrella: s3, taking it back.
- Taking it back (#570, s3; rule 6): key ore in store (`Player.rare`) is held by the people's **ore stores**, the land buildings that take stone in (Town Center, Storehouse: `storesOre` in `src/sim/caches.ts`). One that falls spills `CACHE.share` (half) of each ore, split across the stores standing, as an `OreCache` on the ground (`GameState.caches`); a fallen digger drops its basket and a fallen carrier its load. Any people's citizens lift `CACHE.load` at a time (the `cache` order and command) and bank it at their own store. Spilled ore comes off the loser's ore door (`stats.mined`) and banked ore counts toward the taker's. The computer carries home caches near its town with no rival soldier over them (`carryCaches`), and an assayed clever computer aims its wave at the ore store of the rival holding `AI_CACHE.worth` or more (`oreTarget`). Not yet: a trader carrying key ore (s13's trade road).
- Posts that sell what the map lacks (#573, s13; rule 10): on a world without salt or blood-iron (`ORE_POST.ores`, the ores a road's door asks for), a post sells it (`TradePost.sells`, `stockPosts` in `src/sim/oretrade.ts`; none in campaign chapters). A trader on a `trade` order with `buy` pays `loadPrice` at the post (`markup` over the Market's price for that ore, `rise` more for each load bought by anyone, `GameState.oreSold`), carries it as `Unit.ore` (it spills where the trader falls, s3) and banks it at the Market, counting as mined toward the road's ore door (`oreDone`). The ore technologies (Black Powder, Salt Curing, Blood-Forged Blades) stay open only where the world holds their ore, as `tests/black-powder.test.ts` and its siblings hold, so saltpetre (which opens no road) is not sold. The lodge's tip gives the price, its level 3 who has been buying (`stats.bought`); the minimap marks the selling post for a prospected viewer. The computer keeps `ORE_POST.traders` buying for a road it has chosen (`buyOre`) and its riders fall on rival ore carriers (`rivalDigger`). Not yet: a people's Market selling its own surplus to others.
- Routes and the age panel (#560, s0+s4): `Age.routes` (`ROUTES`), `Age.good`, `Age.gateway`, and `leadsOn`/`leadsTo` in `src/sim/ages.ts`. The Town Center's age-up buttons name the route and show the four lines; `tests/age-panel.test.ts` holds every route reachable with no rare find. Not yet: s0's sweeps, the computer picking a route, the web map's panel.
- The first gateway (#577, s5; rule 3): saltpetre's only door. A **vein door** (`vein` on `Road`, `veinSeen`/`veinDone` in `src/sim/ages.ts`) is the third kind of door made real: the road is seen once the people has prospected or dug the ore, opens on `n` mined, and is never seen on a world without it (`keyOf` reads it as `only`, so the lodge and the age panel say "shut"). It opens the **Age of Alchemy** off the Middle Ages (tier 2, `gateway: true`, no route): no siege engines and slower soldiers, while every Siege Workshop is a mill grinding saltpetre in store into kegs (`KEG`, `millStep` in `src/sim/powder.ts`). Alchemy is the only road to the **Age of Sappers** (tier 3, instead of Gunpowder; its deed is kegs ground), where citizens and foot soldiers lay kegs at a rival building (the `keg` command and order); the fuse burns `KEG.fuse` seconds, then every rival building within reach takes a heavy blow, unless a rival reaches the keg first and stamps it out. Kegs are ground only in Alchemy, so the length of the weak window is the size of the powder store: the decision. Going back works as rule 9 wants: step back from the Sappers to the Middle Ages and turn into Alchemy again to grind more. Saltpetre is still not sold at posts (#573's question), so a world without it shuts this road. The computer plays it (`powderBound`, `powderRoad`, `sapKegs` in `ai.ts`, `AI_KEG`). Not yet: kegs in a store that falls (they could blow, or spill as a cache), a keepsake (the powder mill as Alchemy's keepsake building, s11).
- The second gateway (#800, the Wild route's step 8a; rule 3): the **Age of the Mycelium**, a turn off the Wild at tier 2 behind a vein door of **glowcaps**, a fifth rare ore laid as one Glowcap hollow on about 40% of seeds. Unlike saltpetre, glowcaps are sold at a post where the world has none, and a vein door now counts a post that sells its ore as the world holding it (`veinSeen`), so the rare age is a dearer road there, not a shut one. Weak in a fight (soldiers cost a quarter more), it holds the only road from tier 2 straight to the Bloom (tier 5), opened by the stock its web banks. `docs/wild-road.md` §R, `src/sim/mycelium.ts`.
- The fifth crossing (#801, the Wild route's step 8b): the **Age of the Wild Hunt**, a turn off the Stone Age for a people that walked the Wild and the Steppe, a Hunting Camp the clue (as on both). Packs at heel, wolves that follow the wagons, and hawks, the first living flyer. `docs/wild-road.md` §X, `src/sim/hunt.ts`.
- Going back as a plan (#580, s10; rule 9): `asleep` in `src/sim/ages.ts` holds a building whose `BUILDINGS[].ages` don't include its people's age idle (guns, rigs, grafts and feeding, waystation pay and mending all check it); it wakes the moment the people stands in one of them again. `burns` marks the War Camp, which burns instead (`warcamp.ts`). `leaving(s, p, to, back)` says what a journey keeps (`walked`), suspends, puts to sleep, wakes and loses, and the HUD's `planLines` shows it on the step-back button and every road. A rival's sleeping building reads "asleep": a town's history shows.
- Keepsakes (#581, s11): `Age.keepsake` (`building`, `does`) on nine side ages; `Building.keep` marks the one kept. `keepsakeOf` picks the chosen one (the `keepsake` command, J, while in the age) or the oldest finished one; `enterAge` marks it as the people leaves (`markKeepsake`, a `keepsake` event) and notes the age left as walked. A kept building never sleeps (`asleep`), and the age's own work follows it: the old mill (`grindersOf` in `powder.ts`), vigils (`vigilGold`), the feast day (`fairShare`), the altar (`drawers` in `blood.ts`, `forkStep`), the coil's bolt and field (`buildingGuns`, `workRate`/`inKeptCoil`). Raze it and it is gone; returning and leaving again keeps the same one, or the next oldest. The computer keeps the oldest and holds its saltpetre while the old mill grinds. No keepsake yet: Iron (its forge is a stat on the whole people, so a kept forge needs the stats cache to see a building), Sail, Merchants, Aeronauts, Reclaimers, the Warband, the Steppe, the Horde, the Sappers.
- The first crossing (#585, s12; rule 9): `crossing` on `Road`, a pair of sibling ages both walked (`crossingLeft`, `crossingsAhead` in `src/sim/ages.ts`; `walked` stays one age, as read-only tests read it). The road is seen once either is walked (`roadKnown`), and `roadProblem` names the one still to walk; the HUD's plan lines say a road completes a crossing, or that leaving a sibling leaves half of one. The **Age of Sea-Raiders** turns off the Middle Ages for a people that walked the Warband and the Sail (a Dock is the clue, a hard gate, no route): plunder is packed as in the Warband but banked only by ship (`raid` on `Age`, `SEA_RAID`, `raidStep`/`holdFor` in `src/sim/spoils.ts`). A pack goes into a transport's hold within `SPOILS.bank` tiles or aboard; a ship banks its hold within `SEA_RAID.dock` of a Dock; Town Centers and Barracks bank nothing; no traders or merchant cogs. A sunk ship pays its hold to the one who sank it. The computer plans it like an heirloom (`raidBound`, `seaTurn` in `ai.ts`, `AI_SEA`): with one sibling walked and a Dock it decides once on a coin of its own, walks the other, comes back and turns; there it builds a transport, walks laden soldiers to it and sails full holds home (`raidShips`). Not yet: a keepsake, its own looks. The Age of Chariots (#555 s12, Iron + Steppe, off the Stone Age; a Forge the clue) is the third: the siblings share the Stone Age, which has no road back, so the way between them is a step back (`Journey.back` in `ai.ts`); riders are `names`d chariots, the Iron forge edges them (`CHARIOT_FORGE`, `riders`), and bows, walls and gates are shut. The Age of Missions (#555 s12, Pilgrim + Sail, a Temple the clue) is the second: priests alone raise **Missions** (`mission`, `only` on `BUILDINGS`) on shores in no rival's land; each holds land (`BORDERS`), trains priests and pays a tithe by distance from home (`MISSION`, `src/sim/missions.ts`), the farthest three counted; asleep outside the age, kept as its keepsake. The computer's crossing planner (`crossBound`, `CROSS_PLAN` in `ai.ts`) now serves both crossings, one plan at a time, and `raiseMission` sends a priest out.
- Finds in scouting range (#588, s9; rule 5): `Find` on the state (`s.finds`, `FINDS` in `data.ts`, `src/sim/finds.ts`), one near each town at `FINDS.ring` tiles (`placeFinds` in `mapgen.ts`: the same distance for every town within `FINDS.fair`, nearer its own town than any other, own dice, no tile touched; ids from `FINDS.idBase` so nothing renumbers). Each is dealt from a shuffled hand of the key resources the world holds, so a hint never points at a shut road; a world that holds none has a keyless hunters' stash that says so. The first land unit (traders aside) within `FINDS.reach` claims it (`findStep`): the `reward`, and a `Lead` on `Player.leads` (the key, and the nearest of it at that moment) that `led` reads. A lead to bog iron stands in for the lodge on the iron road (`roadKnown`); the others are information (a minimap ring, the banner). Nothing else reads leads, so older tests and saves are untouched. The computer walks one citizen out to its own find (`findWalk`, `AI_FIND`). Not yet: the lodge's panel and the age panel reading leads for the other keys, a find standing in for a lodge's yes on `lacking`, finds on the web map, tips.
- The Water Road (#701, s1 to s8): a third trunk, Stone → Rivers → Dykes → Water Line → Locks → Tides → Floating Cities, the `water` route (§1). Each age keeps one building on any road (a watered Farm, a Windmill, a Sluice, a Dam, a Tide Mill, a Pontoon; `tests/water-keepsakes.test.ts`). Its crossing, the **Age of the Sea Beggars** (#783, Dykes + Sail off the Middle Ages, a Dock the clue): ships beaten down are boarded and taken (`board` in `src/sim/beggars.ts`), and its ships cut dykes, sluices, dams and causeways as siege does; the kept Dock boards within `BEGGARS.haven` on any road. The computer plans it in `CROSS_PLAN` only where its shallows open the Dykes. Rivers' clue is a Farm or a Dock (`clueAlt`, #794), so the Britons, a camp on the move and the Hunters' Way see it at the shore. Not yet: `waterline → locks` (waits on the owner, #701), the Britons on a dry map with no shore.
- The Deep Road (#876, s1 #877): a fourth trunk, the `deep` route, `docs/deep-road.md`. Its first age, **Megaliths**, is seen once a House (or a Storehouse) stands: every town raises one in its first minutes.
- The Golden Age (#703): a turn off the Gunpowder Age for a people that has walked three side ages (`lives` on `Road`, heard of at two). `ageDef` weaves every walked side age at once (`weave`, `threadsOf`, `standsIn` in `src/sim/ages.ts`): their verbs, the best of their gifts, none of their doors. It ends on its own (`GOLDEN`, `goldenStep`), and the road shuns itself. The payoff for walking the web: every age walked is a thread woven in later.
- What two roads teach together: six **heirlooms** (`walked: [a, b]` on a technology, #224), crafts opened only to a people that walked both ages, kept for good on any road. The computer plans for them.

## The spine (fixed 2026-10-22; build on it, change it only with the reason on #555)

The foundations every step hangs on, worked out from the ages and roads in `src/sim/data.ts` as they stand. Numbers marked *start* are first guesses for the builder to tune.

### 1. The basic routes (rule 0)

No route below needs a prospector or a rare resource: every road on it opens by price and deeds alone (an ore door, where there is one, is only a shortcut). Tag each age with its routes (§2) so the age-up button can say "Army route".

| Route | Ages | What the player does | Needs |
| --- | --- | --- | --- |
| **The plain road** | Stone → Bronze → Medieval → Gunpowder → Industrial | the classic game; every route can fall back to it | nothing |
| **Army** | … Medieval → **Warband** → Gunpowder → **Iron & Blood** → Industrial → **Total War**, then the fork: **Hemocraft** or **Blood-rite** | plunder carried home; War Camps at the front; citizens called to arms; blood | any map |
| **Navy** | … Medieval → **Sail** → Gunpowder → Industrial → **Aeronauts** | convoys and prize money, the fleet is the wall; then air reach from forward Airfields | water (Great Lakes, Inland Sea, a shore homeland) |
| **Economy** | … Bronze → **Merchant** → **Fairs** → Industrial → **Lightning** | hired swords, feast-day trade, a town laid out round coils | any map |
| *Horse* (also plain) | Stone → **Steppe** → **Horde** → Gunpowder → **Silk Road** | a town on wagons, tribute from rivals' land, tolls on the trade road (the Silk Road needs the Steppe walked) | any map |
| *Faith* (also plain) | … Medieval → **Pilgrim** → **Fairs** | priests who win towers and Temples over | any map |
| **Deep road** (#876) | Stone → **Megaliths** → **Delvings** → **Undercity** → **Deep Forges** → **Faults** → **Living Earth** | a town built in stone, Henges that hold the ground and gather the people at the year's turn; then tunnels, a sunk city, the earth's heat, faults, and the land itself moved | any map: stone by every town, and Mine Shafts dig it anywhere; a vent by every town (`docs/deep-road.md`) |
| **Water road** (#701) | Stone → **Rivers** → **Dykes** → **Water Line** → (Industrial →) **Locks** → **Tides** → **Floating Cities** | dig channels and farm along them, a moat to wade; dykes, windmills and polder; sluices that drown your own fields under an army, gun-barges on the flood; canals that carry ships inland, bridges and dams; the tide's flats, mills and causeways; a town on pontoons that moors and tows | any map to the Locks (a spring by every town); Tides and Floating Cities want a shore |

**The Water Road's sweeps** (#783): a Hard computer bound to the route (its ages yes, every other side age no) against a Normal computer that walks the web freely, small maps, 40-minute cap, seeds 1 + 101k (`npx tsx scripts/routes.ts --seeds 6 water`; the plain road on the same maps and seeds for comparison).

| Map | Water road won | Plain road won | Water route ages walked (per seed) | Deepest age reached |
| --- | --- | --- | --- | --- |
| Lakes | 5/6 | 4/6 | 3/4/2/2/1/2 | Locks |
| Sea | 4/6 (one unfinished) | 6/6 | 3/5/2/3/2/1 | Tides |
| Continental | 5/6 | 5/6 | 3/3/0/2/0/1 | Water Line, then Industrial |
| All | **14/18** | **15/18** | | |

The road wins at the plain road's rate on the maps it names, and walks deep on them (Rivers → Dykes → Water Line on most seeds, Locks and Tides on the long ones). Seeds 203 and 405 seat the Britons (who never farm) and the Mongols on the Hunters' Way (no Farm standing when they climb at minute 7): a Farm was then the Age of Rivers' clue, so they never saw it, reached the Dykes off the Middle Ages instead, and on dry land gave the road up. Since #794 a Dock shows it too: on lakes and sea both seeds now walk Rivers (before: Bronze → Middle → Dykes); on the continental map, with no shore, they still don't. The same sweep before and after #783 played out identically, match for match. Seed 506 (Romans) loses on every map to an early rush; the plain road loses it on lakes and land too. **The crossing, swept** (the same harness, a Hard computer bound to the Dykes, the Sail and the Sea Beggars, 6 seeds on lakes and sea): it walked the whole crossing (Dykes, back, Sail, back, turn) on 7 of 12, by minute 22 to 25, and won 10 of 12 (2 unfinished, none lost). It boarded 12 ships on one sea seed and 1 on another; on the rest the rival kept no ships on water its fleet could reach, so the age is worth its journey only against a rival who goes to sea, as a crossing should be.

**The Deep Road's sweeps** (#906): the same harness, continental maps (the road is for any map), seeds 1 + 101k, 40-minute cap (`npx tsx scripts/routes.ts --seeds 16 deep plain army economy`), after the fixes below.

| Route | Won | Lost | Unfinished | Route ages walked (per seed) |
| --- | --- | --- | --- | --- |
| Deep road | **12/16** | 0 | 4 | 4/5/3/4/0/2/4/5/2/4/0/3/4/4/4/4 of 6 |
| Plain road | 12/16 | 2 | 2 | trunk only |
| Army route | 13/16 | 2 | 1 | |
| Economy route | 12/16 | 2 | 2 | |

The road wins at the plain road's rate: no must-pick and no never-pick, so no number on the road itself was tuned. On the first 6 seeds (`--detail`) a bound seat reaches the Megaliths by minute 7 to 11, the Undercity by 16 to 18 and the Deep Forges by 20 to 25, but the matches end by minute 22 to 38, so the Faults are reached on 2 seeds and the Living Earth on none: a Hard computer wins on the middle of the road. The two 0s are the Mongols (seed 405, who quarry no stone and take the plain road instead) and seed 1011. Before the fixes (6 seeds) it won 5/6 to the plain road's 5/6, and the Mongol seat stood in the Stone Age all match, bound to a road shut to it. **To the end, at peace** (the same seats, no war and no wonder win, 60 minutes, seeds 1, 102, 203, 304, 405, 506): before the fixes, 2 of 6 reached the Faults and none the Living Earth; after, every seat that can walk the road reached the Living Earth (5 of 5, at minutes 31, 39, 47, 31 and 58), and the Mongol seat climbed the plain road to the Atomic Age.

What held it back was the computer, not the road: (1) stone. Past the Megaliths it gave stone the epoch's share (6% of hands in the Industrial tier) while the Faults ask 1,200 and the Living Earth 1,600; by minute 45 the deposits by home were dug out and three Mine Shafts at the open-ground grade brought in about 16 a minute, beside 9,000 gold and 14,000 wood. Now a Deep Road town past the Megaliths sends three times the share to stone, sinks up to 8 shafts, and buys the next climb's stone at the Market with its spare gold (`AI_DEEP`). (2) The cap: at 150 people a citizen queued at the Town Center never trains and the advance waits on an empty queue; one seat sat 20 minutes in the Deep Forges with the Faults paid for three times over. (3) The Fault Engine cracked under rival buildings before the Living Earth's price was set aside.

Roads deeper in a route ask that its earlier ages were walked (`walked` on `Road`): Iron & Blood needs the Warband, Total War needs Iron & Blood, the blood fork needs Total War. Rules: a route may cross the plain road between its own ages; each route must be able to win on the maps it names (s0 checks it with sweeps, `scripts/campaign.ts` style, against the computer's mix); the computer must be able to play each one start to finish.

### 2. The age panel (s4)

What an age's road shows at the Town Center and on the web map (a panel about your town, not a card), and where it lives. Four lines, one source each:

| Line | Field on `Age` in `data.ts` | Exists? |
| --- | --- | --- |
| **You now…** (what you do) | `verb` | yes, every side age |
| **Good at…** (one line, the reason to pick it) | `good` | new |
| **It shuts…** (the price) | `door` | yes |
| **Leads to…** | derived from `ROADS`, shown only for roads the player can see or has walked | derived, no field |

Plus `routes: RouteId[]` (`'plain' | 'army' | 'navy' | 'economy' | 'horse' | 'faith' | 'water'`, empty for a rare age) and, for a gateway, `gateway: true` (the button then says "weak on its own; the road on is why you come"). A test like `tests/verbs.test.ts` fails a side age without `good` and `routes`. The trunk ages get `good` too.

### 3. Key resources (rule 4)

A key resource is anything only some seeds place that opens an age or a technology. What exists today, and what each opens:

| Key resource | Seeds that hold it | Opens today | Kind of door |
| --- | --- | --- | --- |
| Bog iron (`BOG_IRON`) | 50% | the **Iron** age (Stone → Iron), once a Prospector's Lodge finds it | the **only** road: Iron is today's one rare age |
| Salt (`RARE.salt`) | 70% | Merchant (shortcut past its deeds); Salt Curing | shortcut |
| Saltpetre (`RARE.saltpetre`) | 50% | Black Powder (tech) | **opens no age yet**: a free slot for a gateway or rare age |
| Blood-iron (`RARE.bloodiron`) | 35% | Iron & Blood (shortcut); Blood-Forged Blades | shortcut |
| An ancient ruin (`RUINS`) | every map (2–4 by size) | **Reclaimers** (only to the people who dug it) | the only road, but a race, not a roll: whoever digs first |

A world that lacks one can still get it by trade (rule 10, §6), so "this map has none" means a dearer road, not a closed one. Rules for new ones: a key resource is placed on at least about a third of seeds (never "crazy hard"), and when placed, every player can reach some of it; it makes sense in the fiction; it is one of three kinds of door: **only road** (a rare age), **shortcut** (skips a basic age's deeds), or **tech** (a stronger version of something). Basic-route ages are never "only road". New kinds beyond ores are welcome: a creature, a landmark, a ruin type.

### 4. The prospector (s1–s3)

A building, **the Prospector's Lodge**, that replaces the Survey the Land technology. Raised by citizens in the Stone Age; levelled up like a technology at the lodge. Numbers live in `data.ts` as `PROSPECTOR`.

| Level | When | *Start* cost | Shows |
| --- | --- | --- | --- |
| 1: **Prospect** (built) | Stone | food 50, wood 75 | yes or no for every key resource this world holds (§3), ruins included. The road panel greys out ages whose resource this world lacks, with the reason |
| 2: **Chart** | Bronze | food 150, gold 100 | where: each vein, cave and ruin as a minimap mark, even under fog (a mark, not sight) |
| 3: **Assay** | Medieval | gold 200, stone 100 | who: which people mines each vein, and how much of each key resource every people holds |

The computer raises the lodge in its first minutes, reads level 1 to choose its route, and charts (level 2) when it means to take a rare road. A player who never builds one loses nothing on the basic routes. Mined key resources sit in a stock a rival can see at level 3 and take back (s3: destroying the building that holds it drops a share to be carried home; how much and which building is the s3 builder's call).

### 5. Going back, keepsakes and crossing ages (rule 9)

**Three reasons to go back, all shown at the Town Center before you commit:** *recover* (a turn that went wrong), *pick up* (a road you passed), *carry* (take something from one branch into another). The step-back button says what you keep, what sleeps and what you lose, so going back reads as a plan.

**Keepsakes: what comes back with you.** When a people leaves an age, what it earned there falls into one of three kinds. Each side age names them in `data.ts`:

| Kind | What happens on leaving | Today |
| --- | --- | --- |
| **Kept** | stays and keeps working on any road | heirloom crafts; deeds and `walked` (the age counts as walked for good) |
| **Sleeping** | stands, but idle, until the people returns to that age | technologies above the tier (suspended); new: most side-age buildings |
| **Lost** | gone | War Camps burn on leaving the Path of Blood |

New: each side age may name **one keepsake building** that stays *kept* after you leave (a smithy from the Iron Age, a lighthouse from Sail, a shrine from the Pilgrims). That makes "go in, build one thing, come back" a real plan, and lets a rival read a town's history from its buildings.

**Crossing ages: niche ages that need going back.** A crossing age opens only to a people that has walked **two sibling ages** (two branches off the same age), so it must turn into one, earn its keepsake or deed, go back, and turn into the other. It is a hard gate (`gate: 'hard'`), rare by design, and the way back is the price: time, the step-back cost and a weak window. Illustrations for builders, not commitments (each still passes `docs/verbs.md`):

| Crossing | Siblings walked (both leave from) | You now… (the verb) |
| --- | --- | --- |
| **Age of Chariots** | Iron + Steppe (Stone) | yoke bog-iron to the herd: chariots that hit hard on open ground and can't pass woods or rough hills |
| **Age of Sea-Raiders** | Warband + Sail (Medieval) | beach longships anywhere; plunder is carried to the ship, not to a Town Center, so the raid leaves by sea |
| **Age of Missions** | Pilgrim + Sail (Medieval) | sail priests to far shores to raise mission Temples that claim land and turn coastal towns |
| **Age of the Sea Beggars** (built, #783) | Dykes + Sail (Medieval) | board a rival's ships instead of sinking them, and cut its dykes from the sea |

Rules: a crossing age turns off the age its siblings share, keeps the `walked` gate for both (extend `Road.walked` to a pair, as heirlooms do), says on its panel which two roads it needs once the player has walked one of them, and the computer plans it the way it plans heirlooms (walk one, go back, walk the other). No crossing age sits on a basic route.

### 6. Trade carries the road's materials (rule 10, the owner 2026-10-22)

Trade today is one verb with many bonuses: traders walk to a trading post and come home with gold. Its new job is to carry key resources, so the economy route supplies (or starves) the rare roads.

- **Posts that sell what the map lacks (first step).** On a world without a key resource, one or two neutral trading posts sell it: a trader who loads there brings it home instead of gold, paying in gold at the post. The price starts dear and rises with every load anyone buys (*start*: 3 gold a unit, +10% a load), so a rival can bid it up on you. A world that holds the resource has no such post.
- **The road can be cut.** A trader carrying a key resource drops it when it falls, and a rival may carry it home (rule 6). Patrols on the trade road (#454), convoys at sea and Caravanserai tolls apply as they do to gold.
- **The lodge shows the market.** Prospector level 1 names which posts sell what; level 3 shows who has been buying.
- **The computer buys too,** for the road it has planned, and raids a rival's resource caravans.
- **Later, if the first step plays well:** trade between players (offers and acceptance, which needs its own screen, so not first) and a people's Market selling its own mined surplus to others.

## Still open (decide by building, then note it here)

- Which other ages become gateways. (s5: saltpetre opens the first, Alchemy, a new age; see "Built already".)
- How the player sees an age's strengths, weaknesses and where it leads, without a wiki.
- How the computer chooses its road from what its prospector finds. (s1: it raises a lodge when the Iron Age suits its people, as it once surveyed, and digs only after a yes; its reading of salt and blood-iron for shortcuts still looks at the world directly.)
- How the age-up buttons point a player along a route (the data is §1–2; the look is open).
- How taking resources back plays (s3).
- Which crossing ages to build first. (s12: the Sea-Raiders, Warband + Sail, then the Missions, Pilgrim + Sail, then the Chariots, Iron + Steppe. Keepsakes: ten ages name one, s11 and the Sea-Raiders' Dock; the rest are listed under "Built already".)
- A measure to aim for, proposed (2026-10-22, not ruled): four to six real road decisions a match, the first by minute 5; one headless match had the first at minute 21. Going back and crossing ages count.
