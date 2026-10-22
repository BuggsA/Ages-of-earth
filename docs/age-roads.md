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
- Routes and the age panel (#560, s0+s4): `Age.routes` (`ROUTES`), `Age.good`, `Age.gateway`, and `leadsOn`/`leadsTo` in `src/sim/ages.ts`. The Town Center's age-up buttons name the route and show the four lines; `tests/age-panel.test.ts` holds every route reachable with no rare find. Not yet: s0's sweeps, the computer picking a route, the web map's panel.
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

Roads deeper in a route ask that its earlier ages were walked (`walked` on `Road`): Iron & Blood needs the Warband, Total War needs Iron & Blood, the blood fork needs Total War. Rules: a route may cross the plain road between its own ages; each route must be able to win on the maps it names (s0 checks it with sweeps, `scripts/campaign.ts` style, against the computer's mix); the computer must be able to play each one start to finish.

### 2. The age panel (s4)

What an age's road shows at the Town Center and on the web map (a panel about your town, not a card), and where it lives. Four lines, one source each:

| Line | Field on `Age` in `data.ts` | Exists? |
| --- | --- | --- |
| **You now…** (what you do) | `verb` | yes, every side age |
| **Good at…** (one line, the reason to pick it) | `good` | new |
| **It shuts…** (the price) | `door` | yes |
| **Leads to…** | derived from `ROADS`, shown only for roads the player can see or has walked | derived, no field |

Plus `routes: RouteId[]` (`'plain' | 'army' | 'navy' | 'economy' | 'horse' | 'faith'`, empty for a rare age) and, for a gateway, `gateway: true` (the button then says "weak on its own; the road on is why you come"). A test like `tests/verbs.test.ts` fails a side age without `good` and `routes`. The trunk ages get `good` too.

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

Rules: a crossing age turns off the age its siblings share, keeps the `walked` gate for both (extend `Road.walked` to a pair, as heirlooms do), says on its panel which two roads it needs once the player has walked one of them, and the computer plans it the way it plans heirlooms (walk one, go back, walk the other). No crossing age sits on a basic route.

### 6. Trade carries the road's materials (rule 10, the owner 2026-10-22)

Trade today is one verb with many bonuses: traders walk to a trading post and come home with gold. Its new job is to carry key resources, so the economy route supplies (or starves) the rare roads.

- **Posts that sell what the map lacks (first step).** On a world without a key resource, one or two neutral trading posts sell it: a trader who loads there brings it home instead of gold, paying in gold at the post. The price starts dear and rises with every load anyone buys (*start*: 3 gold a unit, +10% a load), so a rival can bid it up on you. A world that holds the resource has no such post.
- **The road can be cut.** A trader carrying a key resource drops it when it falls, and a rival may carry it home (rule 6). Patrols on the trade road (#454), convoys at sea and Caravanserai tolls apply as they do to gold.
- **The lodge shows the market.** Prospector level 1 names which posts sell what; level 3 shows who has been buying.
- **The computer buys too,** for the road it has planned, and raids a rival's resource caravans.
- **Later, if the first step plays well:** trade between players (offers and acceptance, which needs its own screen, so not first) and a people's Market selling its own mined surplus to others.

## Still open (decide by building, then note it here)

- Which current ages become gateways, and what saltpetre opens.
- How the player sees an age's strengths, weaknesses and where it leads, without a wiki.
- How the computer chooses its road from what its prospector finds. (s1: it raises a lodge when the Iron Age suits its people, as it once surveyed, and digs only after a yes; its reading of salt and blood-iron for shortcuts still looks at the world directly.)
- How the age-up buttons point a player along a route (the data is §1–2; the look is open).
- How taking resources back plays (s3).
- Which building each side age keeps, and which crossing ages to build first.
- A measure to aim for, proposed (2026-10-22, not ruled): four to six real road decisions a match, the first by minute 5; one headless match had the first at minute 21. Going back and crossing ages count.
