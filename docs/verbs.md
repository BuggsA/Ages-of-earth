# The verbs rubric

Read before you pitch, build or rework any age, path, Way, people, homeland or mechanic. Distilled from research #461 (#500). The owner: "It should feel like a different game after" (2026-10-17).

**The verdict:** branches must change **verbs, not numbers**. A choice feels like a different game when it changes what the player *does* (how they gather, build, move, fight or win), not when it moves a percentage on the same actions.

## The test (one copy; `docs/goals.md` and the pitch template point here)

1. **Verb:** does it add, remove or change something the player **does**, or only the numbers on the same actions?
2. **Door:** does it close one (a lost option, a real cost), so it isn't a must-pick?
3. **Two players:** would two good players choose differently, depending on map, rival or nerve?
4. **Answer:** can a rival see it and answer it?

Pass all four, or say in the pull request which one fails and why that's fine. One-minute check: write the sentence "After taking it, I now ___". If the blank is a number ("gather 15% faster"), it fails 1.

## The levers, most proven first

1. **Production and income verbs differ per branch** (StarCraft's warp-in, creep and repair; Age of Mythology's favour from prayer, monuments or combat). The first minutes of a branch need different hands. *Here:* the Steppe's town on wagons, Hemocraft's drains. **Distance is difference** (the owner, 2026-10-24): the farther an age lies from the plain road, the more of this changes, until the far end is a whole new strategy (`docs/engagement.md`).
2. **Exclusive identities with powers that create a strategy** (AoM god powers, Slay the Spire relics), each paired with a door that shuts. *Here:* the Blood fork, the Ways.
3. **A restricted tool pool per run** (Against the Storm deals a few buildings a game): the "best" build can't exist when the pieces differ.
4. **Land that rewrites the economy** (no wood, only stone): variety without complexity. *Here:* Homelands.
5. **Different ways to win** per branch (Northgard: dominance, lore, fame, trade), not only different ways to fight.
6. **Dilemmas that come back:** the right answer changes by season or phase. *Here:* the turning year.

## Anti-patterns

- **The +2 attack trap:** "a high jump or a tall leap". Percentages alone feel procedural.
- **The must-pick:** right in 90% of runs; it deletes the web. Pair every power with a cost.
- **The never-pick:** too weak or too situational to take; just as dead.
- **The solved branch:** one viable build order inside it. Each branch needs two ways to play it.
- **Balanced but boring:** equal value with no difference in play gives indifference, not choice.
- **Too much stuff:** content isn't variety. A few branches that change verbs beat many that change stats.
- **Bookkeeping, not tradeoffs:** a web that only tracks progress, forcing no sacrifice.

## Where it applies

- **Pitches and pull requests** answer it in their templates (`.github/ISSUE_TEMPLATE/pitch.md`, `.github/pull_request_template.md`), so nobody has to remember this file.
- **The data holds it:** each side age, Way and homeland in `src/sim/data.ts` has `verb` and `door`, shown on its button as "You now … It shuts …"; `tests/verbs.test.ts` fails one without them. Known gaps sit in `VERB_GAPS` with their issue; strike one when it gets a verb.
- **Existing content too** (the owner on #500): the audit there lists what fails today; reworking it is good work (`docs/goals.md`, Goal 2).
- Read #461 itself only when your work is a lever above (sources, shipped examples, §5's table).
