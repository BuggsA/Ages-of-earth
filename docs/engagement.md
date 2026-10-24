# Engagement: seeing the road, reading the rival, wanting the next match

The owner's chat with Claude Code, 2026-10-24 (session `session_01Lj8tw7uVgg1gJ7n23WG3pn`): "help plan out meaningful engagement improvements". Then, on the plan: "I like phase 1, but you should be able to go back ages. So consider that in the plan." Dilemma cards: "I don't think they add a ton of value even if advanced … I am happy to just have research to it." "The campaign is on pause for right now. I think most people play computer or with friends."

## The diagnosis

The game isn't short of depth: six core loops, a web of ages with crossings, paths and going back, the Water Road under way. What's thin is what lies around that depth:

1. **The player can't see the web while playing.** The computer plans multi-step journeys with going back (`crossBound` and `seaTurn` in `src/sim/ai.ts`); a person sees only one step at a time, in tooltips (`planLines`, `src/ui/hud.ts`).
2. **The rival's road is a toast.** "X has stepped back to the Stone Age" (`src/main.ts`, `case 'epoch'`) is public already, but nothing says what it means or that it opens a window.
3. **Nothing carries one match into the next.** The end screen charts numbers; "Play again" rolls a new map.

## Rules for this work

- **Going back is a first-class move everywhere.** Every road view shows the step back and the roads back as well as the climbs, with their price (time, `STEP_BACK`, what sleeps, the weak window) and what they open (crossings, keepsakes).
- **Show only what the player knows.** Roads follow `roadKnown`; a rival's road is read only from what is already public (their age changes) or what your eyes have seen (their buildings under fog rules).
- **For play against the computer and with friends.** The campaign is paused; nothing here depends on it.
- **No sim changes where the UI can read the state;** where the state must remember (a journey log), the field is optional and absent in older saves.
- Each step passes `docs/verbs.md` or says "none: look/fix".

## Phase 1: the road, both ways

**1. The road planner.** An always-open panel (toggled, remembered per browser) beside the age button:
- every known road from where you stand: climbs, roads back, and the step back, each with its price and `leaving()`'s keep / sleep / wake / lose lines;
- **pin a goal age** (from the panel or the web map; only ages you have seen). The planner searches the known roads plus step-back edges for the shortest route by time and shows it as steps: "Warband ✓ → step back (200f 100g, 25 s, Drain Rigs sleep) → Sail → Sea-Raiders";
- half-walked crossings as standing goals, and a warning when you are about to leave an age without its keepsake;
- what is still missing on each step (a deed, an ore, a clue), in the words `roadProblem` already uses.
- *Decision:* push on, detour back for a crossing, or recover, with the price in sight.
- *Code:* a pure `routeTo(s, p, goal)` beside `roadsFrom` / `roadKnown` in `src/sim/ages.ts` (no rendering, so tests and the computer can share it); the panel in `src/ui/`.

**2. Reading the rival.** When a rival changes age, the toast becomes a card the player can open:
- what that age is good at and shuts (its `verb` and `door`), the roads it walked before (built from the public age changes), and any crossing it is now half-way to;
- after a **step back**: the weak window (`STEP_BACK.time`, its units fallen back to their older form) with a countdown, and "a chance to strike";
- a rival's **keepsake** you have seen (a smithy in a Stone Age town) is marked on the minimap and named: "they have walked the Iron Age".
- *Decision:* punish the window or race them to the crossing; going back now has a cost a rival can make you pay.

**3. Your road, at the end.** The end screen draws each player's journey on the web map: the climbs and the loops back, time in each age, keepsakes carried, crossings completed, each weak window and whether it was struck. Under it, the roads this seed offered that nobody walked (only ages the viewer saw).
- **Play this seed again**, and in an online room **Rematch** with the same seats.
- *Code:* a `journey` list on `Player` (`[tick, age, back]`, pushed in `enterAge`, `src/sim/game.ts`), optional so older saves load.

## Phase 2: the computer and friends

**4. Rivals with a temperament.** Each computer seat gets a name and a leaning: the road it favours and a habit with going back (hoards crossings, never retreats, steps back to bait you onto its walls). It plays to it consistently, so a player learns to scout it and answer it. It also strikes a rival's step-back window when it sees one.

**5. Friends of mixed skill.** A per-player handicap (gathering rate or a starting stock) in the room's seat list, and computer allies on a team; the Rematch from step 3. "none: fix".

## Phase 3: a reason to come back

**6. The seed of the week:** one seed and a road challenge ("complete a crossing", "win from the Water Road after one step back"), records kept in the browser.

**7. A codex of roads:** each age, crossing and core loop you have played, filling in like the web map's discovery. Knowledge, not unlocks: the basic routes stay first-class.

## Research only

- **What keeps the middle and late game rich** against the computer and with friends? The dilemma-card idea (a seeded event per age) was set aside by the owner; the research may find something better, or confirm that rival-reading and going back are the answer. A research issue, no build.

## Measures

- Road decisions a match (`docs/age-roads.md`'s proposed 4–6, the first by minute 5) over many seeds, headless.
- Distinct journeys the computer walks across seeds, and how many include a step back.
- The owner's play: does the next match feel different from the last?

## Order

1 → 2 → 3 (2 and 3 reuse 1's route search), then 4, 5, 6, 7. The research issue can go to anyone, any time.
