# Goals

What the team is steering toward now, set by the owner on 2026-10-17 (`docs/rulings.md`). Read it when choosing work. It changes when the owner resets it; agents keep "Progress" current.

## The problem

The owner, played: "a bit procedural, almost a mechanical race that is a bit more fun." The research behind these goals (#461) finds one root cause: **branches change numbers, not verbs.** A run feels different when a choice changes what the player *does* (how they gather, build, move, fight or win), not when it moves a percentage. Most of the game's variety also lives late (the Path of Blood from the Middle Ages, Hemocraft past Total War), while every run's first fifteen minutes play alike.

## Goal 1: branch the opening (the top goal)

Two good Stone Age openings should look different by minute 3 and play differently through minute 15, because of choices that change what the player does.

- **Where to start:** the Ways (`src/sim/data.ts`, `WAYS`) are three percentage bundles, the "high jump or tall leap" trap. Give each a verb of its own (illustration, not a spec: hunters who make camp where the kill falls; a hearth that stores and preserves; a warband that raids for its food). Rework with the reason on the issue (`AGENTS.md` §2).
- **Also fair game:** starts whose land rewrites the first economy (no berries but a shoal; mammoth plains; stone-poor woods); an opening fork that closes a door; a dilemma that comes back (seasons, herds that move).
- **Each step ships whole:** the computer uses it, tips explain it, tests cover it.
- **Done when:** two computer players on the same seed with different opening choices show visibly different first-15-minute timelines (`scripts/sim.ts`), and the owner says the Stone Age no longer feels like a race.

Umbrella: [#463](https://github.com/BuggsA/Ages-of-earth/issues/463).

## Goal 1b: different economies at the core (the owner, 2026-10-17)

The owner: the main problem is that "every people gathers the same four resources with citizens, builds the same buildings and trains from the same queues … makes it feel procedural." So each people gets a different core loop: who works, how resources come in, how soldiers are made (`docs/verbs.md`, lever 1). Not a twist on the shared loop. Umbrella: [#501](https://github.com/BuggsA/Ages-of-earth/issues/501). Prefer depth (one people done fully, the computer playing it) over six thin ones.

## Goal 2: deepen, don't widen

- **No new ages** (main-road or side) until the existing ones pass the verbs test (`docs/verbs.md`). Exception: the owner's own ask #391 (6–7 epochs), which should pass the test too.
- Deepening an existing age into a different verb is the best work after Goal 1. The weakest by the audit on #500: the six peoples (#501), the Age of the Warband (#502), Reclaimers (#503), then Sail. The Steppe and Hemocraft are the models.

## Goal 3: every change gives a decision

Every pull request says, in one line under its summary, **what new decision it gives the player** (or "none: look/sound/fix"). Look-only and polish work stays welcome, but not as a chain's main output while Goal 1 is open.

## The verbs test

Its one copy, with the levers and anti-patterns: **`docs/verbs.md`**. Ask it of any age, path, Way, people or feature, new or existing.

## Owner asks, in order after Goal 1

#454 (patrol and auto-explore), #391 (6–7 epochs), #344 (people management). Open owner notes without the `owner-ask` label (#452, #364) are the owner's thoughts for later, not tasks yet.

## Progress

- 2026-10-17: goals set. Goal 1 umbrella opened (#463); #454 and #391 labelled `owner-ask`.
- 2026-10-17: `npx tsx scripts/opening.ts <seed> <wayA> <wayB> 15` prints two openings side by side, the check for Goal 1's "done when". Seed 3, hunt vs hearth: alike until minute 8, so today the Ways differ in pace only.
- 2026-10-17: s2, Homelands (#473): the seed rolls the Glade, the Shore, the Herd Plains or the Deep Wood; the computer's opening and Way now vary by map. s1 (#467) is in progress on another chain.
- 2026-10-17: s1 (#467): each Way gives a verb and shuts a door (kill camps / the kin / the raid; no fields while the home herd lives / no camps / no bell); the computer picks by people and land and plays each.
- 2026-10-17: s3, the turning year (#479): each homeland's staple has a lean season and a fat one (the Plains' herds trek out in autumn, the Shore's mere ices in winter, deer yard in the Deep Wood in winter). The mere spawns (#482): Shore shoals grow back each spring by what was spared.
- 2026-10-17: snares in the wood (#485): the Deep Wood's own verb, a trap line among trees you keep standing. On seed 3 (medium, Deep Wood) both computers lay one at 10.3 minutes.
- 2026-10-17: re-measured after s1–s3 (`opening.ts 3 hunt warband 15`, medium Glade): Warband has 2 soldiers at minute 1 and 11 kills by minute 12 against the Hunters' 3, with a Hunting Camp at 0.3 min against 5.5, and the Steppe at 12.5 min. The timelines now differ from minute 1, not minute 8. Still unseen by the owner: "done when" waits on their play.
- 2026-10-17: the verbs rubric (`docs/verbs.md`, #500) and an audit of the existing game against it (#500): peoples #501, Warband #502, Reclaimers #503, road victories seed #504.
- 2026-10-17: the owner names the shared core loop as the main problem (Goal 1b); #501 reshaped into six economies. s1, the Egyptians' Nile flood, merged in #516.
- 2026-10-18: the Romans' legion (#501): few citizens, foot soldiers who fell, quarry and build. Greeks (#522) and Romans are the two peoples with a different core loop.
- 2026-10-18: the Chinese household tax (#501): no gold mines, houses pay it by the street. Greeks, Romans and Chinese now have a different core loop.
- 2026-10-18: the Mongols, born on the move (#501): the camp on wagons from minute 1, the flock as the farm, no fields, walls, stone or gold mines, tribute from riders. Greeks, Romans, Chinese and Mongols now have a different core loop.
