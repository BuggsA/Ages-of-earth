# The age deck

**Status: the owner's direction (2026-10-22, `docs/rulings.md`), still being fleshed out.** Umbrella: see `docs/goals.md`, Goal 2. The owner: "Some of it still needs to be fleshed out." Agents flesh it out by building, and note what they decided here.

## The idea, in the owner's words

"Pick your strategy and explore it to best your opponent. Building out your strat should be as fun as destroying your opponent. I think that is why I would like lots of ages. Similar but very different than a build your deck where you can pick the things you want. Certain ages really are better than others at certain things. Some ages really are inferior but maybe lead you to some really good ones."

On finding them: ages "should all be available if the resource was available but they should be hard to find but make sense. The map seed allows for some resources. There should be something that you can build or purchase somewhat early that you can see what resources are on the map. Then maybe as you level it up where they are or who took them and you can reclaim them from destroying and picking up the resources and bringing them back. No resources should be crazy hard to find. But the ages should be complex enough where it makes sense for players to build wikis showing different ages, how to unlock them, the benefits, which ones are obscure and hard to get to."

And then: "Ages shouldn't be remember across matches with the exception of seeing them in the main menu screen. maybe some elsewhere. But they shouldn't be blocked by a new player. They just may not know how to get there, know that it exsists or maybe the map seed doesn't have the resources."

On the simple routes (same chat): "you should be able to follow some basic branches. It should be fun if you don't want to explore the ages just build an army or build a navy, build an economy to crush the opponent. It shouldn't feel forced if someone wants they can find their one play style and stick to it."

## What it means for building

0. **Clear basic routes, always open, always fun.** On every map, with no prospecting and no rare resources, a player can pick a plain style (an army, a navy, an economy) and follow it to a win: ages with a clear name and purpose, readable from the age-up buttons. Exploring the deck is an invitation, never a toll. A player who finds one style and sticks to it every game must stay competitive; rare routes are different, not strictly stronger. The computer plays these routes too.
1. **The deck is drafted during the match.** Each age-up is a pick from what this map and your route offer, not a plan made in a menu.
2. **Every age is good at something and bad at something.** Say what it's for in one line ("the trade age", "the age that can't wall"). An age good at everything is a must-pick (`docs/verbs.md`).
3. **Gateway ages are allowed to be weak.** An age may be poor on its own if it is the only road to a strong one. The weakness is the price, and a rival who scouts it gets a window to punish it. Say on its button where it leads, once known.
4. **Ages are gated by what the land holds.** An age needs a key resource (an ore, a creature, a ruin, a landmark) that only some seeds place. If the seed has it, the age can be reached; if not, it can't, and the player can learn that early.
5. **Finding out is a building you grow.** Bought or built early, it tells you which key resources this world holds (yes or no). Upgraded, it shows where they lie. Upgraded again, who holds them and how much they've taken. Never "crazy hard": every placed resource can be found by a player who invests in looking.
6. **What a rival took can be taken back.** Destroy what holds it (a mine camp, a storehouse, a caravan) and carry the dropped resource home.
7. **Wiki-worthy, not hidden.** Recipes should make sense from the fiction (salt for caravans, saltpetre for powder), be learnable over many matches, and reward knowing them. A route few players know about is the goal; one nobody can find is a bug.
8. **Never locked, only unknown.** A new player can reach any age in their first match: nothing carries over between matches to unlock it. What stands in the way is knowing it exists, knowing how to get there, and whether this map holds its resource. Ages a player has reached are remembered only for display: the main menu's web of ages (and maybe other places, like a match's end report), never as a gate.

## Built already (extend these; don't start over)

- Rare ores only some seeds hold: bog iron, salt, saltpetre, blood-iron, in caves (`R_BOG`, `RARES` in `src/sim/types.ts`, #39, #356).
- Ages and techs that need them (`ore` on ages and techs in `src/sim/data.ts`); roads hidden until a clue building, a ruin or a survey (`clue`, `ruin`, `found` on `Road`).
- A one-question survey: "Survey the Land" answers yes or no for bog iron only (`TECHS.survey`).
- The age web: about 20 ages and 28 roads, every side age with a verb (`VERB_GAPS.ages` is empty).

## The spine (fixed 2026-10-22; build on it, change it only with the reason on #555)

The four foundations every step hangs on, worked out from the ages and roads in `src/sim/data.ts` as they stand. Numbers marked *start* are first guesses for the builder to tune.

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

### 2. The age card (s4)

What an age's button and tooltip say, and where it lives. Four lines, one source each:

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
| Bog iron (`BOG_IRON`) | 50% | the **Iron** age (Stone → Iron), via Survey the Land | the **only** road: Iron is today's one rare age |
| Salt (`RARE.salt`) | 70% | Merchant (shortcut past its deeds); Salt Curing | shortcut |
| Saltpetre (`RARE.saltpetre`) | 50% | Black Powder (tech) | **opens no age yet**: a free slot for a gateway or rare age |
| Blood-iron (`RARE.bloodiron`) | 35% | Iron & Blood (shortcut); Blood-Forged Blades | shortcut |
| An ancient ruin (`RUINS`) | every map (2–4 by size) | **Reclaimers** (only to the people who dug it) | the only road, but a race, not a roll: whoever digs first |

Rules for new ones: a key resource is placed on at least about a third of seeds (never "crazy hard"), and when placed, every player can reach some of it; it makes sense in the fiction; it is one of three kinds of door: **only road** (a rare age), **shortcut** (skips a basic age's deeds), or **tech** (a stronger version of something). Basic-route ages are never "only road". New kinds beyond ores are welcome: a creature, a landmark, a ruin type.

### 4. The prospector (s1–s3)

A building, **the Prospector's Lodge**, that replaces the Survey the Land technology. Raised by citizens in the Stone Age; levelled up like a technology at the lodge. Numbers live in `data.ts` as `PROSPECTOR`.

| Level | When | *Start* cost | Shows |
| --- | --- | --- | --- |
| 1: **Prospect** (built) | Stone | food 50, wood 75 | yes or no for every key resource this world holds (§3), ruins included. The road panel greys out ages whose resource this world lacks, with the reason |
| 2: **Chart** | Bronze | food 150, gold 100 | where: each vein, cave and ruin as a minimap mark, even under fog (a mark, not sight) |
| 3: **Assay** | Medieval | gold 200, stone 100 | who: which people mines each vein, and how much of each key resource every people holds |

The computer raises the lodge in its first minutes, reads level 1 to choose its route, and charts (level 2) when it means to take a rare road. A player who never builds one loses nothing on the basic routes. Mined key resources sit in a stock a rival can see at level 3 and take back (s3: destroying the building that holds it drops a share to be carried home; how much and which building is the s3 builder's call).

## Still open (decide by building, then note it here)

- Which current ages become gateways, and what saltpetre opens.
- How the player sees an age's strengths, weaknesses and where it leads, without a wiki.
- How the computer drafts its deck from what its survey finds.
- How the age-up buttons point a player along a route (the data is §1–2; the look is open).
- How taking resources back plays (s3).
