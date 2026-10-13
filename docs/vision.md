# Ages of Earth: game vision

**Status: an idea the owner likes, for inspiration (2026-10-13).** It isn't a rule, a plan or a roadmap. Read it now and then, build toward it where it sparks something you'd love to make, take one corner of it, or leave it alone: the project keeps its creative freedom (`AGENTS.md` §2, `docs/rulings.md`). Where it and `docs/design-notes.md` disagree, neither wins by default; pick what makes the better game and say why.

*How it got here:* an earlier session wrote this with the owner on 2026-10-13, but it never reached the repository. The owner pasted it back and said: "I think it should just be a thought. Agents should see it from time to time and build to it. But There should be a lot of freedom to the project. I just personally liked the idea." The text below is as the owner gave it, with its headings and table restored and its status line replaced by the one above. The original line read: "Status: guiding design direction, established with the project owner on 2026-10-13. This document describes the intended game, not a list of finished features. It supersedes the original linear-age direction in design-notes.md where they conflict."

---

## The promise

Easy to start and enjoy; deeply complex if you want it to be. A reliable simple build on every map, with a web of discoverable civilizations and strategies beyond it.

A player should be able to enjoy their first match without a guide and still encounter something unfamiliar after a hundred matches. Another player might arrive with a civilization that makes them ask: "How did you get to that age? I didn't even know that was a thing."

The inspiration from RuneScape is breadth of worthwhile activities, discovery, specialization, and community knowledge—not a requirement to copy its skills or progression grind. Players should find satisfying ways to pursue wealth, production, exploration, unusual capabilities, optimal builds, or military power. Unlike a safe progression sandbox, this world remains contested: opponents can disrupt your plans and wipe your civilization off the map.

Mechanics take priority over an art overhaul. "A modern version" means richer possibilities, creative interactions, accessibility, and better decisions—not simply more expensive graphics.

## Principles established with the owner

### 1. A simple option must always work

Every seed supports a clear, dependable development path. Establish a settlement, gather familiar resources, improve production, defend yourself, advance, and field an army. Ordinary buildings, equipment and armies stay useful.

This is a legitimate way to play and win, not a beginner trap or a temporary tutorial before mandatory complexity. Optional mechanics must not force every player to manage crafting, trade, biology, diplomacy, and logistics at once. Recommended actions, clear tooltips, and automation should handle routine repetition while leaving meaningful choices to the player.

The current historical ages can serve as the familiar route during development. Preserving a simple route does not mean that every future civilization must pass through those exact historical ages.

### 2. Ages form a web, not a universal ladder

The long-term structure is not Stone → Bronze → Medieval → Industrial → increasingly larger numbers for everyone. An age is a meaningful transformation in what a civilization can do and how it functions.

Multiple routes can diverge, reconnect, substitute for prerequisites, and combine where their rules allow. A web must create more freedom than choosing one of three permanent classes. Some choices may exclude each other for a clear mechanical reason; others should support hybrids.

A civilization might develop sophisticated biology with limited metallurgy. Another might combine cavalry with recovered machinery. Different capabilities can produce comparable power without identical technology or a shared chronological position.

Capabilities such as metallurgy, domestication, engineering, energy, biology, and restoration are illustrative building blocks, not a finalized tech tree. Likewise, "Living City," aerial civilizations, mobile settlements, and restored-machine societies are candidate transformations, not promises that they are implemented.

### 3. The seed changes what is possible

Map generation determines more than resource positions. It can determine whether certain materials, organisms, creatures, ruins, energy sources, environments, and combinations exist at all.

Some builds or ages are genuinely impossible on some seeds. Other paths exist in the world but are difficult for a particular player to access. Keep those cases distinct:

| Situation | Strategic meaning |
| --- | --- |
| A prerequisite never exists in this world | Its dependent path is unavailable; pursue another strategy |
| A prerequisite exists far away or under enemy control | Explore, expand, trade, steal, negotiate, or conquer, where supported |
| An alternative prerequisite exists | Invent a different route to the capability |
| Two unusual conditions coexist | A rare hybrid or transformation may become possible |

The simple path remains available in every case. Missing rare content must not turn a seed into an empty or strategically inferior world. Generation needs viable ordinary starts and counterplay; rare access is not an automatic win.

Seeds should be reproducible and shareable. Reproduction also depends on map settings and game version. Players should be able to exchange worlds with unusual combinations and develop strategies for their conditions.

### 4. Discovery can reveal possibilities the player did not know existed

Do not expose every hidden age as a greyed-out entry in a global checklist. Discovery should progressively reveal clues, useful properties, experiments, and eventually transformations.

The destination can be surprising; the steps should be understandable. Avoid arbitrary secret click sequences and unhinted recipes that require an external wiki to make any progress. Explain known prerequisites, costs, effects, and failure conditions once a player has a reason to know them.

Unknown content need not be spoiled at startup. However, revealed pursuits should not send players on hours of fruitless searching for a prerequisite that cannot exist on that seed. How to communicate world-level absence without revealing all secrets remains a design problem to solve.

### 5. Richness comes from interacting systems

A thousand isolated upgrades are not the goal. A smaller set of consistent, reusable systems can produce many interesting combinations.

Potential activities include resource processing, professions, crafting, trade, exploration, creature use, infrastructure, and combat. Add each system because it creates decisions and interacts with others—not simply to make the feature list longer.

An illustrative chain: an unusual deposit supports specialist smiths, who produce distinctive armor. A player can equip a small elite force, sell equipment to fund another strategy, or supply an ally in exchange for protection. Rivals can disrupt the production chain instead of matching the army directly.

Another illustrative combination is a creature carrying a settlement, supplied through an underground route and defended with recovered machinery. This is a design example, not current functionality. The aim is for players to assemble surprising combinations from understandable rules.

Wiki-worthy questions include: Can this process fuel another? Can that creature carry this structure? Is this material worth an expedition? Can I win without relying on the usual resource? Which combinations work on this seed?

### 6. Specialization has strengths, costs, and answers

Unusual does not mean strictly superior. Every extraordinary strategy needs understandable requirements, opportunities to interfere, and viable conventional counters.

A living settlement might regenerate but rely on food and vulnerable connections. A mobile fortress might require handlers and enormous provisions. Advanced production might concentrate value in exposed infrastructure. These are examples of meaningful tradeoffs, not fixed balance specifications.

Players should get useful benefits along the way, rather than investing an entire match before their specialty becomes relevant. Defeat and destruction must still matter. Whether knowledge, workers, discoveries, or other investments can be rescued or rebuilt is a deliberate design choice; permanent account power is not an established requirement.

Encourage clever optimization and unexpected combinations within the game's rules. Accidental duplication, desynchronization, and infinite-resource bugs are not the intended source of depth.

## Implementation direction

Build complete, testable gameplay loops before expanding the content catalog. A new path should include discovery, understandable prerequisites, player controls, meaningful effects, costs, counterplay, save/replay behavior, and multiplayer determinism.

Evaluate new work against these questions:

- Can a new player ignore it and still enjoy a viable ordinary match?
- Does it change decisions, geography, timing, or interaction rather than only adding a percentage bonus?
- Can it combine with another system in more than one useful way?
- Does seed variation change strategy without deciding the winner at generation?
- Can an opponent recognize its effects and learn to counter it?
- Can someone discover it through play, then teach or document what they learned?

---

## More of the owner's thinking: the web in detail

*Added 2026-10-13 from the owner's chat with Claude Code, condensed and reworded. In the owner's words it is "Not a hard rule just an idea or inspiration." Take what sparks something.*

- **Surveying.** Players can survey the land for resources. A basic survey only says whether a resource exists on this map: yes or no, with no place and no amount. A better survey, unlocked later, gives amounts, how much is left, and who holds or has mined it. Skipping surveys is a fair choice, but it risks missing the materials a unique build needs. The simple route needs no surveying at all.
- **Scrapping.** Rare things can be salvaged into some generic value. It takes time and can't be undone. It gives a way out of a build you can't finish, and a way to deny an enemy what you can't hold.
- **Stepping back an epoch.** A people can go back to an earlier epoch to take a fork they passed, or to collect something only that epoch offers. It costs time and resources with no refund, and advancing again costs full price after a cooldown. Units drop to their older form or are scrapped, buildings change style or go dormant, and technologies above the epoch are suspended, not lost. The computer has to learn to do this too.
- **Crossing chains.** Doing something in one chain can open an epoch in another (a religious act might unlock an epoch elsewhere). This is an extra way in, never the only one, and the first chain has to be worth playing for itself.
- **Windows, not just minimums.** Some requirements are open only during certain epochs. Example: farms that grow living parts instead of food need an off-route building that only the Bronze Age can raise. Rush past that window and you have to step back to get it.
- **Hidden builds.** Some niche builds are hidden and may not even pay off, and that obscurity is part of the appeal. Players will write the wiki. So experiments must be cheap, the simulation must be honest about what happened, and seeds must be shareable so others can reproduce a find.
- **The mainstream path always works.** On every seed there is an ordinary way to win that needs nothing hidden. Hidden content is extra upside, never a fee you must pay to compete.
- **The web's shape.** Branches can dead-end, loop back, or rejoin further ahead (a shortcut that merges past steps you skipped). Leaving the main web can be a mistake you regret. Still open: what carries over when you branch back.
- **No true dead ends.** From any node there is always at least one way out: back, forward or sideways, even if that exit is slow or costly. Some side exits lead into a whole other web, which is where hybrids come from.
- **How much the player sees.** The web shouldn't be obvious. A screen outside the match keeps the parts of the web the player has found. Main branches show greyed out: visible but locked. Secret branches don't show at all until reached, and each is a web of its own, not a single shoot. Some parts may never be found.
