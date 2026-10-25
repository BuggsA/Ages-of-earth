# The Wild route: a people that grows its power

**Status: the owner's idea (2026-10-24), fleshed out here; steps 1, 2, 3 (fire), 4 (the Hive), 5 (the Wildwood), 6 (the Bloom), 7 (Leviathans) and 7b (the Kraken and Reef Ships) built.** The owner: "start a new main branch of ages. Completely new. I was thinking like nature/plant tech. Where you use nature and animals to your advantage." Then: "There should be a way to produce them too, maybe forest wall or tree walls of some kind. Maybe ents later on." "Maybe farms that also yield way more food. Or maybe just more food dense so less area. Be very uniquely creative to fill the gaps, especially the future ages." And: "this goes to 7." Umbrella: #706. Build on it; change it with the reason on the umbrella.

## The idea in one line

Every other route takes from the land: it fells it, digs it and fences it. The Wild route **keeps** it. The wolves by the den become your army, the trees you spare become your wall, your food grows dense in a garden instead of wide in a field, and in the end the forest itself walks to war. Its price is time and ground: what grows can't be rushed, and a rival who burns or fells your woods hurts you more than anyone.

## Seven ages

The trunk runs six epochs, Stone to Atomic, so a single line can climb five tiers. The Wild route climbs all five and then **splits at the top**, as the Path of Blood does (Hemocraft or the Blood-rite). It also has a **rare age** that only some maps open, and a **crossing** with the Steppe.

```
Stone ─┬─ 1 Wild ── 2 Grove ──── 3 Hive ── 4 Wildwood ─┬─ 5a Leviathans  (the beasts' end)
       │             └─ R Mycelium (rare) ───────────────┴─ 5b Bloom       (the plants' end)
       └─ (Wild + Steppe walked) ── X Wild Hunt (crossing)
```

| # | Tier | Age | After it, I now… (verb) | It shuts… (door) | Good at |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | **Wild** (built) | tame wolves, boars and mammoths; breed the tamed kinds at a Beast Den; my Hunting Camps call the wild in | no Stables, no Siege Workshop | an early army that costs food, not gold |
| 2 | 2 | **Grove** (built) | plant walls that grow; grow dense food in Kitchen Gardens fed by the Den's dung | no stone walls, gates or Watch Towers | a town shut in green on half the ground |
| 3 | 3 | **Hive** (built) | keep Hives that swarm whoever walks my woods; tip darts in venom; breed dire beasts | no guns or cannon | woods a rival can't walk through |
| 4 | 4 | **Wildwood** (built) | wake old trees as Ents that walk, crush and root again; let my woods spread each spring | no factories or machines; fire hits living things twice as hard | an army that is also the forest |
| 5a | 5 | **Leviathans** (built) | breed giants: Skywhales that carry troops over walls, a Kraken in the deep, a Behemoth with my town on its back | the Heart Tree sleeps: no Ents, no spreading | reach: over walls, under the sea, a capital that walks |
| 5b | 5 | **Bloom** (built) | fire a Bloom Seed that turns a rival's town to forest; win by the Greening | the Dens go quiet: no new beasts | a second way to win, and a warhead that grows |
| R | 2 | **Mycelium** (rare) | grow a fungus web under my town: every building on it takes in every stock, my units in it are hidden, rival wood rots on it | soldiers cost a quarter more; fire burns the web | a town that can't be starved; the short road to the Bloom |
| X | 1½ | **Wild Hunt** (crossing) | ride with wolf packs at heel and hawks overhead; my beasts follow the camp's wagons | no walls, no fields (the steppe's) | raids that see everything and outrun everything |

Every age has a cheap road back and a road to the trunk, like every side age. Deeper ages ask that the one before was walked (`walked` on `Road`), as the Horde asks for the Steppe. The rare Mycelium is a **gateway** (`docs/age-roads.md` rule 3): weak alone, but a road from it goes straight to the Bloom at tier 5, skipping the Hive and the Wildwood.

## Each age, fleshed out

### 1. The Age of the Wild (built, step 1)

- **Tame.** A citizen right-clicked onto a wild wolf, boar or mammoth sings it calm (`TAME`): 6 s for a wolf, 10 for a boar, 24 for a mammoth. The beast stands still for its tamer from the moment the tamer sets out, but its pack doesn't. A beast hurt within the last 8 s won't take the hand, and a wound breaks the song.
- **The beasts.** War Wolf (cavalry class: runs down archers, broken by spears), Tusker (infantry class: holds a line, breaks riders, thinned by archers), War Mammoth (siege class: tramples walls like a ram and gores soldiers, swarmed by spears and riders). Beasts don't re-arm with the epochs.
- **Breed.** The **Beast Den** breeds only the kinds your people has tamed, for food (a mammoth also costs gold). It is raised only once a beast is tamed, and keeps breeding in any later age: a town's history shows in its Dens.
- **The call of the wild.** Twenty seconds into each season, every Hunting Camp of a Wild people draws a wild beast to it from seven tiles out: a boar in spring and summer, a lone wolf in autumn and winter, up to two near each camp. The wild never runs dry for a Wild town, and what comes to the door must be tamed or fought.
- **Door:** no Stables and no Siege Workshop while you stay.
- **Clue and deed:** a Hunting Camp shows the road; foraging 250 food from wild bushes opens it.

### 2. The Age of the Grove: tree walls and dense food (built, step 2)

- **As built** (`src/sim/grove.ts`, `GROVE`): clue a Beast Den, deed 5 beasts reared at Dens (a new `bred` stat); roads on to the Gunpowder Age and back to the Middle Ages. Two changes from the sketch below, both to keep it simple and readable: the **Thornwall parts for its own team as a gate does**, so there is no Hollow Oak gate (the Grove raises no gates); and there is no **Rain Barrel** yet, only water within 3 tiles. A **Den feeds its 6 oldest gardens** in reach, so a town needs a Den for every half-dozen gardens and a raid on one starves exactly those. Grubbing a stump out is the owner's delete for now; a rival's answer is to build on the root or, in step 3, burn it.

- **Thornwall (the tree wall).** Planted like a wall line, for wood alone. Each piece grows through four stages over about two minutes: seedling (weak, but already blocks), bramble, thicket, then **living oak** (tougher than stone, and it mends itself slowly). It grows faster in spring. A piece cut down regrows from its root unless a citizen grubs the stump out or fire takes it. A **Hollow Oak** gate lets your people through. So a green wall can't go up in a hurry, but once grown it's the toughest, cheapest wall in the game, and it heals.
- **Kitchen Gardens (dense food).** A one-tile plot (a Farm takes nine) of the Three Sisters: maize, beans and squash grown together. With a gardener tending it, a Garden yields about three times a Farm's food per worker, from a ninth of the ground. Its catch: it needs **feeding**. A Garden within reach of a Den grows on its dung; one beside a stream or a Rain Barrel grows on water; one with neither withers to a Farm's pace. Dens, Gardens and water then pull the town into a tight, rich heart, and a raid on the Den starves the gardens.
- **Orchards.** Fruit trees planted near a store, bearing in summer and autumn: slow to start, free food for years, and good wood if felled in a famine.
- **Door:** no stone walls, gates or Watch Towers. The town's defence is what it grew.
- **Two ways to play:** turtle behind Thornwalls and out-eat the rival from a tiny footprint, or boom on Gardens and pour beasts out of the Dens.

### 3. The Age of the Hive: venom and swarms (built, step 4)

- **As built** (`src/sim/hive.ts`, `HIVE`): clue a Kitchen Garden, deed 600 food brought in from Gardens (a new `gardened` stat); roads on to the Industrial Age and back to the Gunpowder Age. Three new things, as the engagement rule asks: the **Hive** (its own building), the **Blowpipe Hunter** (a swap: it takes the musket's place, the door), and the **Cave Bear**; the War Wolf growing **dire** rides along as a rename and a lift, not a new unit. "Inside a wood" is read as **2 trees in the 3-by-3 round a unit**; a Hive needs **8 trees within 3 tiles** to be set and to keep working, so felling or burning its wood sends the bees away. Swarms don't stack: one sting a second, however many Hives. **Mead is chosen by layout, not a button:** a Hive within 10 tiles of a Market of yours pays gold instead of food. **Smoke** is any fire within 4 tiles (`smokeNear` in `fire.ts`); a smoked Hive sleeps 40 s after the last smoke. Blowpipe venom stacks to 5 doses on a target, however many shooters, so darts want to spread their aim.

- **Hives** set among your trees. Bees swarm any rival unit inside a wood near a Hive: damage over time that ignores armour, and a slow. A Hive yields honey (a trickle of food, or mead sold at a Market for gold). Bees sleep in winter, so the right time to raid a Hive town is the cold.
- **Pollination:** a Hive beside Gardens doubles their summer yield. The second loop of the green economy.
- **Venom darts:** your ranged line becomes Blowpipe Hunters. Short range, but poison stacks, ignores armour and slows: death to heavy riders and mammoths.
- **Dire beasts:** the Den breeds Dire Wolves and **Cave Bears** (a new beast, a slow wall of fur that shrugs off arrows).
- **Door:** no guns or cannon. **The answer:** fire and smoke. A rival's torchbearers smoke Hives quiet and burn the woods they sit in.

### 4. The Age of the Wildwood: the forest wakes (built, step 5)

- **As built** (`src/sim/wildwood.ts`, `WILDWOOD`): clue a Hive, deed 250 honey or mead (the `honey` stat); roads on to the Atomic Age and back to the Industrial Age. Three new things: the **Heart Tree** (its own building, one to a people, claims 8 tiles of land), the **Ent** (`warden`, siege class: it takes the field gun's place, the door), and **the Spreading**; woodland ways and the doubled fire are rules of the age, not things to build. An Ent is **trained at the Heart Tree**, and when it is done the standing tree nearest the Heart Tree (within 8 tiles) gives way to it; with no tree left the training waits. **Rooting** removes the unit and stands a real tree on its tile (`GameState.wardens` keeps whose and its health; it still takes room in the town). It wakes for a rival on the ground within 3 tiles, or for any axe that bites its tree (its own people's too: don't cut your Ents). The Spreading is seedlings planted as `Stool`s, so they grow as the coppice's do and wait for whoever stands on them; never beside a building, only in its people's land (`landOwnerAt`). **Woodland ways** count "a wood" as the Hive does (2 trees in the 3-by-3) within 14 tiles of the Heart Tree. **Fire twice as hard**: a Wildwood people's burning buildings lose `FIRE.bld` twice over, and its units in the flames are scorched twice over (`fireMul` in `fireStep`).

- **The Heart Tree,** planted once like a Wonder: a vast old tree that is the town's soul. Around it, old trees in your land can be **woken as Ents** (Wardens) for food, wood and a long time. An Ent walks slowly, crushes buildings and siege, flings boulders torn from the ground, and can **root**: it becomes a tree again, heals, can be felled for wood by a rival who doesn't know, and wakes when an enemy passes. A forest you can't trust.
- **The Spreading:** each spring your woods seed outward into your own land (never onto buildings, fields or roads), regrowing timber, thickening Thornwalls and making new Hive ground.
- **Woodland ways:** your units move faster through your own woods; a rival's are slowed by the undergrowth.
- **Door:** no factories, rails or machines; fire hits living things twice as hard. An Industrial rival's field guns and fire are the answer, and the war is green against iron.
- If the Heart Tree falls, every Ent roots where it stands.

### 5a. The Age of Leviathans: the beasts' end (built, step 7)

- **As built** (`src/sim/leviathans.ts`, `LEVIATHANS`): clue a Beast Den, deed 20 beasts reared at Dens (the Grove's `bred` stat); roads on to the Atomic Age (cheap, sideways at tier 5) and back to the Wildwood. **It and the Bloom shut each other** (`shuns`, as Hemocraft and the Blood-rite): the fork is who your people becomes, beasts or plants, not a detour to take both; it also keeps a Seed Spire and seed-bombing whales out of one town. Three new things: the **Great Den** (its own building), the **Skywhale** and the **Behemoth**. **The Kraken waits for a later step** (with its Tidal Den and Reef Ships it would be a fourth and fifth thing). The door is the Heart Tree asleep (`heartSleeps` in `wildwood.ts`: no Ent wakes or is woken, walking Ents root, no Spreading) **and the Wildwood's machines door kept**: no rifles, field guns, aircraft, Airfield or Silo, so the giants are this road's air and siege. How each part reads:
  - The Skywhale is an air unit (`domainOf`) with no weapon, of the bomber class, so fighters, riflemen and towers are its counters. It carries `capacity` people on foot as a transport does (`isCarrier` in `units.ts`): they walk to where it hovers and it comes down over them; it sets them down on any ground within 2 tiles of where it is sent, walls and woods between being nothing to it.
  - A seed-bomb (B, 60 wood, one a whale every 30 s) sprouts 3 Thornwall seedlings of the whale's people on the open tiles nearest beneath it, in anyone's land: a rival's street becomes a wall that grows to living oak unless it is cut or burnt young, and regrows from its root like any Thornwall.
  - The Behemoth is bred carrying a Town Center (`Unit.packed`, so the heart rule counts it as the Steppe's wagons are counted), one to a people, a queued one counting. It kneels (`pitch`) where a wagon would pitch but within 6 tiles, never in a rival's land: its Town Center stands **at once, finished**, with the share of health the titan had, and works. That Town Center rises (`pack`) in any age, its queue empty. While it walks it gives no room and takes in nothing, as a wagon; unlike a wagon it fights (siege class: it tramples buildings, spears and riders swarm it) and needs no Steppe age.
  - **No priest turns a giant**, and no priest turns a carrier with people aboard (a transport too: before this, a converted transport carried its old owner's soldiers).
  - **The computer:** takes the fork on one coin of its own (`LEVIATHANS.aiTake`, half), a Wild-leaning seat included; stays 600 s; raises a Great Den by home, breeds its Behemoth first and kneels it by the nearest gold or stone at least 14 tiles out with no drop site of its own near, a forward capital; then up to 3 whales: the first waits at home for 4 idle soldiers, carries them to the rival building it has seen nearest home and sets them down; the others fly alone over a rival's streets whenever their seed-bomb is ready, and home again. Every whale drops its seed-bomb over a rival's buildings.
- **At sea, as built (step 7b, #789):** two new things, the **Kraken** and the **Reef Ship**, and no new building. The sketch's **Tidal Den** is the Great Den raised by the sea: the Dock is wired into fishing, cogs, the tide, trade and boarding (15 rules), so a building to replace it would copy them or leave a Leviathan people half a harbour, and a fourth building would break the three-things cap. So the Kraken lives in the Great Den's line, and where the Den stands is the choice: within `LEVIATHANS.sea` (5) tiles of navigable water (`seaBy`), or no Kraken. The **coral beds** are the Reef Ships themselves: they grow on the water instead of on a bed by the shore. How each part reads:
  - The **Kraken** (`kraken`, a giant: no priest turns it, no Shipwright reaches it) is a sea beast of the ship class, 2 to a people (a queued one counting, `krakenProblem`), with arms that reach 1.5 tiles: melee, so a soldier on foot can't strike it, but archers, ships and towers can. Every blow on a ship **grips** it for `grip` (2) seconds (`Unit.gripped`, `seaPace` 0: it can't move, though it still shoots). Once a second each Kraken **shoves** its own people's other ships within `shove` (4) tiles, `shoveMul` (1.33) as fast (`seaStep`). Its Den's sea drained or dyked off, a Kraken in training waits.
  - The **Reef Ship** (`reefship`) takes the warship's place at a Dock **while the people stands in the age** (`trainsAt` swaps it in; the warship joins the age's `no`): 140 food and 60 wood, no gold, launched at `reefBorn` (40%) of its health, growing `reefMend` (3) a second on the water, and mending the same way once `reefCalm` (8) seconds pass without a blow. Weaker than an Ironclad (420 hp, range 6), but a fleet that grows back between fights. After the age, warships return and Reef Ships already afloat stay.
  - **The computer:** raises its Great Den on a shore spot within `aiShore` (16) tiles of home if there is one; breeds `aiKrakens` (1) Kraken once its Behemoth is bred, on a sea map or while a rival ship is in sight; and trains Reef Ships where it would train warships. Its Krakens sail with its warships. The general army code no longer trains at the Great Den (it had bred whales past `aiWhales` by turns).

- **Skywhales:** gas-bladdered giants bred at a Great Den. Living airships that drift over walls carrying ten soldiers, and drop **seed-bombs**: a Thornwall that sprouts in a rival's streets, cutting their town into pieces. Fighters and guns bring them down.
- **The Kraken:** tamed in deep water from a Tidal Den. It drags ships under and shoves your boats along; living **Reef Ships** grow from coral beds you seed by the shore. The navy route's green twin.
- **The Behemoth:** one titan turtle per people, carrying a Town Center on its back: a capital that walks (the Steppe's wagons, at the scale of a mountain). Lose it and you lose a Town Center.
- **Door:** the Heart Tree sleeps. No new Ents, no Spreading.

### 5b. The Age of the Bloom: the plants' end (built, step 6)

- **As built** (`src/sim/bloom.ts`, `BLOOM`): clue a Heart Tree, deed 12 seedlings from the Spreading (a new `spread` stat); roads on to the Atomic Age (cheap, sideways at tier 5) and back to the Wildwood. Three new things: the **Seed Spire** (its own building, one to a people, alive so fire takes it), the **Bloom Seed** (slung with Sling, G) and **the Greening** (a win). Pollen storms and the Spreading every season are rules of the age. The door is the Dens gone quiet (no War Wolf, Tusker, Mammoth or Cave Bear) **and no Missile Silo**: the Seed is this road's warhead, so a Bloom people can't hold both. How each part reads:
  - The Spire ripens one Seed every 150 s, **only while the Heart Tree stands** (the clock waits while it is down), so felling the Heart Tree stops both the Seeds and the Greening. Slinging costs 300 food, 300 wood and 200 gold.
  - The Seed is **public from the moment it is slung**: 10 s in the air (a green ring where it will fall), then it roots on the open tile nearest its point (within 6; none, and it withers). Rooted, a yellow ring marks the **heart-root**: each rival citizen within 1.6 tiles hacks a stroke a second, and 90 strokes cut it out. Only citizens hack, so stopping it costs workers, and the Bloom side's soldiers can cut them down. Uncut after 60 s, every rival building whose nearest edge lies within 6 tiles is destroyed, its footprint planted with seedlings that are trees 8 s later. A rooted Seed is heard growing on every screen.
  - **The Greening counts a people's own land**, not the world: the forest share of the world at the start is 26–27% on every map size (measured, seeds 1–3), so a world count would turn on the map, not the player. Green tiles are standing trees, Orchards, the Heart Tree and Thornwalls grown to living oak, in its land; the share is over its land's open tiles, counted as at least 1,000 (so a tiny land can't win it). At **35%** (40% in the sketch: the computer's land peaked at 18–32% in trials, and a person with Thornwall gets there faster) with the Heart Tree standing, a 180 s clock starts on every screen; it fades if the share drops or the Heart Tree falls. Measured once a second, with one `borderMap`, only while someone stands in the Bloom.
  - **Pollen:** the first 30 s of each season, rival land units and Watch Towers within 14 tiles of a Bloom people's Heart Tree see half as far (`pollenMul` in `vision.ts`). Read as "in your land" near the Heart Tree, as the woodland ways are.
  - **The computer:** goes on from the Wildwood and stays 600 s; raises its Spire, keeps the fuel back as the Seed comes ripe (as the silo's), slings at the rival building it has seen whose ring cracks the most (else the rival's home Town Center), and sends its army to stand over the root. Short of green it plants Orchards and lines of Thornwall round home. **Every** computer, whatever its road, sends up to 7 citizens to hack a rival Seed falling near its buildings, and while a rival holds the Greening its army goes for that Heart Tree with a torch.

- **The Bloom Seed:** the green answer to the Atomic Age's warhead. Raised in a **Seed Spire** and slung across the map, it roots in a rival's town and, over sixty seconds, cracks every building in its ring into forest. The rival's counter is a race: citizens who reach the **heart-root** in time and hack it out stop the Bloom. The whole map hears it growing.
- **The Greening (a second way to win):** hold the Heart Tree while your woods cover 40% of the land for three minutes. It turns a match from "destroy them" into "outgrow them", and gives the rival a new job: fell and burn.
- **Pollen storms:** once a season, your woods breathe out pollen that halves the sight of every rival tower and soldier in your land.
- **Door:** the Dens go quiet. No new beasts.

### R. The Age of the Mycelium (rare gateway)

- **Key resource:** the **Glowcap hollow**, a fungus cave on about 40% of seeds, found by the Prospector's Lodge like every key resource and bought at a post where a map lacks it.
- **The web:** pale threads spread underground from your buildings. Every building on the web takes in every stock (no walk home), and stock dropped anywhere on it counts at once. A town that can't be starved, and can't be cut off.
- **Spores:** your units standing on the web are hidden from rival sight unless an enemy is right beside them.
- **Rot:** a rival building touching your web slowly rots (wood twice as fast as stone).
- **Door:** soldiers cost a quarter more, and fire burns the web back.
- **Gateway:** weak in a fight, but it holds the only road straight to the Bloom from tier 2. A rival who scouts glowing threads knows the Bloom is coming early.

### X. The Age of the Wild Hunt (crossing, Wild + Steppe)

- **Packs at heel:** riders trained at a camp come with a War Wolf running beside them, and wolves follow the wagons when the camp moves.
- **Hawks:** a cheap scouting bird, the first living flyer, that sees far and can't fight.
- **Door:** no walls and no fields, the steppe's door.

## How it hooks into what's there

- **The wild on every map** (`animals.ts`): wolf packs by their dens, a boar by each second berry patch, mammoths in the open. Taming turns that wildlife into a race for the wild ground.
- **Saplings and coppice** (`coppice.ts`, the Britons): the Thornwall and the Spreading grow from the same rules. The Britons' woodcraft makes them natural Grove keepers.
- **Seasons** (`seasons.ts`): the call of the wild changes kind with the season, Thornwalls grow fastest in spring, bees sleep in winter, Orchards bear in summer and autumn, the Spreading comes each spring.
- **The counter triangle** (`BONUS`): war wolves are cavalry, tuskers are foot, mammoths are siege. Nothing new to learn to fight them.
- **Fire is the answer** to the whole route (`src/sim/fire.ts`, `FIRE`, built): see "How fire works" below.
- **The verbs rubric** (`docs/verbs.md`): every age above changes what the player does (tame, plant, swarm, wake, breed giants, bloom, grow a web), closes a door, plays two ways, and is answered by something a rival can see and do.

## How fire works (step 3, built)

- **Torches, for every people from the Bronze Age.** Citizens and foot soldiers carry one (F, then click) to a tree, a rival's Thornwall root, or a rival's living building (Thornwall, Kitchen Garden, Orchard, Sapling: `FIRE.burns`), and stand `light` seconds there to set it alight. A root burns away at once. Only what grows burns: stone and timber halls don't, so the trunk's balance is untouched and green against iron is a real fight.
- **Burning.** A tree burns `tree` seconds and falls to ash (a `Stool` with `ash`), which grows a tree again after `ash` seconds. A living building loses `bld` of its strength a second until it falls (a Thornwall burnt down leaves no root, `Building.burnt`) or is beaten out: each citizen or foot soldier of its own team within `beatReach` beats a second of fire a second, `beat` put it out. One sent to mend it beats first; a gardener at work beats already.
- **Spreading, deterministic.** Once a second, fires in the order they were lit, each may light each living neighbour (a tree's four sides, a building's edges) on a roll of the match's dice (`roll`, `s.rng`) against `spread[season]`, no more than `run[season]` tiles from the torch: a summer fire takes most of a wood (about 80 trees of a big one), a spring or winter one a handful. Fires lit this second act next second. Whoever stands in the flames is scorched.
- **The computer** torches a rival's growth with soldiers out on campaign (`torchGrowth`) and sends a citizen to beat out its own (`beatFires`).
- **Smoke quiets Hives** (step 4, built): a Hive with a fire within `HIVE.smoke` tiles, or burning itself, sleeps `HIVE.quiet` seconds.
- **The Wildwood's door** (step 5, built): a people standing in it burns twice as hard (`FIRE.wild`, `fireMul`); a rooted Ent burns with its tree.
- **The Bloom** (step 6, built): the Seed Spire is alive and burns; burning a Bloom people's woods is how a rival stops the Greening.
- **Leviathans** (step 7, built): the Great Den is alive and burns; a seed-bomb's Thornwall is answered by fire while it is young.
- **Still to come:** beasts that fear fire.

## Steps (each one playable)

1. **Wild** (built): taming, the Den, the call of the wild, the computer using it.
2. **Grove** (built): Thornwall, Kitchen Gardens fed by Den dung or water, Orchards.
3. **Fire** (built, shared rule, needed by everything after): torchbearers, burning woods and buildings. Smoke waits for the Hive.
4. **Hive** (built): Hives, pollination, venom darts, dire beasts and the Cave Bear.
5. **Wildwood** (built): the Heart Tree, Ents that root, the Spreading, woodland ways.
6. **Bloom** (built): the Seed Spire and the Bloom Seed, the Greening victory, pollen storms.
7. **Leviathans** (built): the Great Den, Skywhales and seed-bombs, the Behemoth. **7b** (built): the Kraken, bred at a Great Den by the sea, and Reef Ships.
8. **Mycelium** (with the Glowcap hollow key resource) and the **Wild Hunt** crossing.
9. **The computer plays the whole route**, and campaign sweeps show it can win on any map (rule 0).

## Still open (decide by building, then note it here)

- Whether a rival can tame your beasts back (step 1 tames only wild ones).
- The computer is weak in the Wild on Normal: it tames and raises a Den, but its economy is thin while it stays (seed 8 at 25 minutes, still in the Wild, its Den lost). Gardens help only once it reaches the Grove; the Wild itself may want an earlier Den or a cheaper one.
