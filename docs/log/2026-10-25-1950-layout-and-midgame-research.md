# Research for #729: a layout rule for each people, and what keeps the mid-game rich

Research only; no code. Sources: the repo (`src/sim/household.ts`, `docs/verbs.md`, `docs/engagement.md`) and what the designers of the games named are publicly known for. A web search this session found little beyond Manor Lords layout guides ([VideoGamer](https://videogamer.com/guides/manor-lords-best-layout-settlement), [Siliconera](https://www.siliconera.com/?p=1024606)) and nothing on Against the Storm or Northgard, so those two rest on my memory of the games, **unverified**.

## 1. A layout rule for each people

**What makes the Chinese streets work** (`household.ts`): the rule reads *where* a house stands (its neighbours within `HOUSEHOLD.reach`, a Market counting extra) and pays gold for it, so a gold seam is replaced by a town plan. Layout is the economy.

**What other games do:**
- *Anno:* a building's output depends on the services reaching it (a market's radius), so a district is planned around a hub. The rule is a *reach*, as here.
- *Manor Lords:* worker travel time; a settlement is kept compact, and storehouses, granaries and markets serve everywhere (per the guides above). The rule is *distance to work*.
- *Against the Storm (from memory):* buildings gain from nearby resource nodes and from a short list of chosen neighbours. The rule is *what stands beside what*, with a restricted tool pool.
- *Northgard (from memory):* territory, not layout: each tile a clan holds has its own use.

**A test for a rule here** (`docs/verbs.md`): "After taking it, I now **place** ___ so that ___", never "+X% near Y". It must close a door (a plan that is good in one place is poor in another) and be legible to a rival from a screenshot.

**Proposals, one per people, in the order I'd build them:**
1. **Egyptians, the flood line.** Fields on the river's reach flood and fertilise on a cycle; a farm placed beyond it must be watered by hand. Verb: *place farms by the river and move with the flood*. Door: the town is bound to the water, so it is raided where it is easy to find. Connects to `dykes` and the Water Road.
2. **Romans, the forum and its roads.** A Forum is a hub; roads built from it carry units at speed and buildings along a road count as one district for garrison and supply. Verb: *lay a road, then build along it*. Door: roads are slow to lay and a cut road isolates its district.
3. **Mongols, a camp that moves.** Buildings pack onto wagons (the Steppe Road already has a town on wagons); a camp placed on fresh grass pays, a camp left in one place does not. Verb: *move the town*. Door: movement costs a minute of no production. Best built on the Steppe Road, not as a second copy.
4. **Greeks, the agora.** Open space *kept empty* beside a Market draws trade, so the player decides what not to build. Verb: *leave a square empty*. Door: land given up. Cheapest to build (a rule on one tile pattern).

Recommend **Greeks first** as a small, safe step (one rule like `street`, no new units, deterministic and cheap), then Mongols (reuses the wagon town), then Egyptians, then Romans (roads need pathing work, the largest).

## 2. What keeps the mid and late game rich

**My answer: Phase 1 plus distance-is-difference is the right core; add one thing the plan lacks, a *reason to contest the map after minute 15*.** The owner has ruled against dilemma cards. What remains thin (from reading `docs/engagement.md`) is that the road is a *private* decision plus a public toast, and the middle game has no shared objective.

Ideas, each answering the verbs test, none built:
- **Contested sites.** A few neutral places per map (the Locks' lake, a clue site, an ore field) that open a crossing or a keepsake only to whoever holds them. Verb: *send an army to hold a place for a purpose, not just to kill*. Door: army away from home. Answer: a rival sees it holding.
- **Readable windows.** Phase 1's step-back window already does this; extend it so *every* age change shows a short, public weakness (a unit line still in its old form). Makes scouting pay.
- **Comeback that costs.** Per the Warhammer note above, a catch-up mechanic must not make defending worthless. The existing step-back (go back, regain a crossing) already is one; avoid adding a second.
- **Late-game powers per road** (already #756) are the right lever for the end; this note adds nothing to it.

**What I'd not do:** more content per age (`docs/verbs.md`: "too much stuff"), or timers that fire regardless of play.

## Not verified
Nothing here was played or measured. The Greek and Mongol rules are untested designs; the numbers are for the builder to find.
