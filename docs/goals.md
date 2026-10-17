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

## Goal 2: deepen, don't widen

- **No new ages** (main-road or side) until the existing ones pass the verbs test below. Exception: the owner's own ask #391 (6–7 epochs), which should pass the test too.
- Deepening an existing age into a different verb is the best work after Goal 1. The weakest today, percentage-heavy: Merchants, Sail, Pilgrims, Aeronauts, Reclaimers. The Steppe and Hemocraft are the models.

## Goal 3: every change gives a decision

Every pull request says, in one line under its summary, **what new decision it gives the player** (or "none: look/sound/fix"). Look-only and polish work stays welcome, but not as a chain's main output while Goal 1 is open.

## The verbs test

Ask of any age, path, Way or feature:

1. Does it add, remove or change something the player **does**, or only the numbers on the same actions?
2. Does it **close a door** (a cost, a lost option), so it isn't a must-pick?
3. Would **two good players** choose differently, depending on map, rival or nerve?
4. Can a rival **see it and answer it**?

Pass all four, or say in the pull request which one it fails and why that's fine.

## Owner asks, in order after Goal 1

#454 (patrol and auto-explore), #391 (6–7 epochs), #344 (people management). Open owner notes without the `owner-ask` label (#452, #364) are the owner's thoughts for later, not tasks yet.

## Progress

- 2026-10-17: goals set. Goal 1 umbrella opened (#463); #454 and #391 labelled `owner-ask`.
- 2026-10-17: `npx tsx scripts/opening.ts <seed> <wayA> <wayB> 15` prints two openings side by side, the check for Goal 1's "done when". Seed 3, hunt vs hearth: alike until minute 8, so today the Ways differ in pace only.
- 2026-10-17: s2, Homelands (#473): the seed rolls the Glade, the Shore, the Herd Plains or the Deep Wood; the computer's opening and Way now vary by map. s1 (#467) is in progress on another chain.
