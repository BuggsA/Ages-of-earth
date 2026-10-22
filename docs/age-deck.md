# The age deck

**Status: the owner's direction (2026-10-22, `docs/rulings.md`), still being fleshed out.** Umbrella: see `docs/goals.md`, Goal 2. The owner: "Some of it still needs to be fleshed out." Agents flesh it out by building, and note what they decided here.

## The idea, in the owner's words

"Pick your strategy and explore it to best your opponent. Building out your strat should be as fun as destroying your opponent. I think that is why I would like lots of ages. Similar but very different than a build your deck where you can pick the things you want. Certain ages really are better than others at certain things. Some ages really are inferior but maybe lead you to some really good ones."

On finding them: ages "should all be available if the resource was available but they should be hard to find but make sense. The map seed allows for some resources. There should be something that you can build or purchase somewhat early that you can see what resources are on the map. Then maybe as you level it up where they are or who took them and you can reclaim them from destroying and picking up the resources and bringing them back. No resources should be crazy hard to find. But the ages should be complex enough where it makes sense for players to build wikis showing different ages, how to unlock them, the benefits, which ones are obscure and hard to get to."

## What it means for building

1. **The deck is drafted during the match.** Each age-up is a pick from what this map and your route offer, not a plan made in a menu.
2. **Every age is good at something and bad at something.** Say what it's for in one line ("the trade age", "the age that can't wall"). An age good at everything is a must-pick (`docs/verbs.md`).
3. **Gateway ages are allowed to be weak.** An age may be poor on its own if it is the only road to a strong one. The weakness is the price, and a rival who scouts it gets a window to punish it. Say on its button where it leads, once known.
4. **Ages are gated by what the land holds.** An age needs a key resource (an ore, a creature, a ruin, a landmark) that only some seeds place. If the seed has it, the age can be reached; if not, it can't, and the player can learn that early.
5. **Finding out is a building you grow.** Bought or built early, it tells you which key resources this world holds (yes or no). Upgraded, it shows where they lie. Upgraded again, who holds them and how much they've taken. Never "crazy hard": every placed resource can be found by a player who invests in looking.
6. **What a rival took can be taken back.** Destroy what holds it (a mine camp, a storehouse, a caravan) and carry the dropped resource home.
7. **Wiki-worthy, not hidden.** Recipes should make sense from the fiction (salt for caravans, saltpetre for powder), be learnable over many matches, and reward knowing them. A route few players know about is the goal; one nobody can find is a bug.
8. **Unlocked over time.** Ages a player has reached are remembered across matches (the title-screen web already records found side ages) and show on their web.

## Built already (extend these; don't start over)

- Rare ores only some seeds hold: bog iron, salt, saltpetre, blood-iron, in caves (`R_BOG`, `RARES` in `src/sim/types.ts`, #39, #356).
- Ages and techs that need them (`ore` on ages and techs in `src/sim/data.ts`); roads hidden until a clue building, a ruin or a survey (`clue`, `ruin`, `found` on `Road`).
- A one-question survey: "Survey the Land" answers yes or no for bog iron only (`TECHS.survey`).
- The age web: about 20 ages and 28 roads, every side age with a verb (`VERB_GAPS.ages` is empty).

## Still open (decide by building, then note it here)

- What the prospecting building is, what it costs, and its levels.
- Which ages each key resource opens, and which current ages become gateways.
- How the player sees an age's strengths, weaknesses and where it leads, without a wiki.
- How the computer drafts its deck from what its survey finds.
