# Engagement: seeing the road, reading the rival, wanting the next match

The owner's chat with Claude Code, 2026-10-24 (session `session_01Lj8tw7uVgg1gJ7n23WG3pn`): "help plan out meaningful engagement improvements". Then, on the plan: "I like phase 1, but you should be able to go back ages. So consider that in the plan." Dilemma cards: "I don't think they add a ton of value even if advanced … I am happy to just have research to it." "The campaign is on pause for right now. I think most people play computer or with friends."

Umbrella: [#724](https://github.com/BuggsA/Ages-of-earth/issues/724) (steps #725 #726 road, #727 #728 town, research #729).

## The diagnosis

The game isn't short of depth: six core loops, a web of ages with crossings, paths and going back, the Water Road under way. What's thin is what lies around that depth:

1. **The player can't see the web while playing.** The computer plans multi-step journeys with going back (`crossBound` and `seaTurn` in `src/sim/ai.ts`); a person sees only one step at a time, in tooltips (`planLines`, `src/ui/hud.ts`).
2. **The rival's road is a toast.** "X has stepped back to the Stone Age" (`src/main.ts`, `case 'epoch'`) is public already, but nothing says what it means or that it opens a window.
3. **Nothing carries one match into the next.** The end screen charts numbers; "Play again" rolls a new map.
4. **Every town is built the same way, and the late ages unlock little.** The owner, same chat: "the game feels a bit similar. There should feel like there are lots of unique ways to build up your city. I also think you don't unlock enough with each age." `npx tsx scripts/unlocks.ts` (2026-10-24) agrees: 22 of the 32 buildings and 16 of the 18 kinds of unit are open by the Bronze Age; the Middle Ages and the Gunpowder Age open no building and no new kind of unit (only technologies and new forms of old units); the Industrial opens one building, the Atomic one. Seven of about 25 side ages have a building of their own (four of them the Path of Blood's shared set), and seven of the fourteen keepsakes are shared buildings (Dock, Temple, Market, Tower, Workshop). Layout matters only for the Chinese streets, snares, the coppice and dykes.

## Ages that play like a different game (the owner, 2026-10-24)

"Some ages should feel completely different gameplay to others." Then: "So get far enough away it should feel like a whole new strat."

**Distance is difference.** How different an age plays grows with how far it lies from the plain road. Neighbours are variations; far ends are other games.

- **One step off (a neighbour):** the town becomes something. At most three new things: one building that changes how the town is built, one new verb or kind of unit, one family of technologies. **Swap, don't pile on:** what an age adds retires or changes something older, so the buttons stay about as many while the town keeps changing (the owner's worry about overloading players).
- **Two or three steps out (deep in a path, a trunk or a crossing):** each step changes more of the core loop than the last: who works, how resources come in, how soldiers are made, how the town moves (`docs/verbs.md`, lever 1).
- **The far end: a whole new strategy.** What you gather, how you build, how you fight and how you win have all changed; a player arriving from the plain road has to think again. The roads already point there: the Steppe Road ends in the Silk Road, the Water Road in the Floating Cities, the Path of Blood in Hemocraft or the Blood-rite. Illustrations, not specs: a Sail people of ports and fleets whose land shrinks to a foothold; an Industrial town where rail and factories take over the hauling; the Atomic as a standoff, deterrence rather than conquest.
- **Why it's fair:** the far end costs the journey (gateways that are weak, windows a rival can punish, steps back for crossings), so the payoff is a new way to play, not just a stronger one. The basic routes stay first-class: staying near the trunk is a full strategy too.
- **The sentence test:** "In this age I mostly ___ instead of ___." A neighbour may have the same verb in both blanks; a far end must have two different ones, and the gap should widen step by step along a road.
- **Guards:** a far-end age is never forced on a basic route; its panel and the road planner say "Plays differently: …" before you take it; going back is the way out; the computer plays it; tips teach its first minute.

## Rules for this work

- **Going back is a first-class move everywhere.** Every road view shows the step back and the roads back as well as the climbs, with their price (time, `STEP_BACK`, what sleeps, the weak window) and what they open (crossings, keepsakes).
- **Show only what the player knows.** Roads follow `roadKnown`; a rival's road is read only from what is already public (their age changes) or what your eyes have seen (their buildings under fog rules).
- **For play against the computer and with friends.** The campaign is paused; nothing here depends on it.
- **No sim changes where the UI can read the state;** where the state must remember (a journey log), the field is optional and absent in older saves.
- Each step passes `docs/verbs.md` or says "none: look/fix".

## Phase 1: the road, both ways

**1. The road planner.** A panel beside the age button, opened and closed by a toggle that the browser remembers (chosen 2026-10-24: always on screen would crowd the HUD):
- every known road from where you stand: climbs, roads back, and the step back, each with its price and `leaving()`'s keep / sleep / wake / lose lines;
- **pin a goal age** (from the panel or the web map; only ages you have seen). The planner searches the known roads plus step-back edges for the shortest route by time and shows it as steps: "Warband ✓ → step back (200f 100g, 25 s, Drain Rigs sleep) → Sail → Sea-Raiders";
- half-walked crossings as standing goals, and a warning when you are about to leave an age without its keepsake;
- what is still missing on each step (a deed, an ore, a clue), in the words `roadProblem` already uses.
- *Decision:* push on, detour back for a crossing, or recover, with the price in sight.
- *Code:* a pure `routeTo(s, p, goal)` beside `roadsFrom` / `roadKnown` in `src/sim/ages.ts` (no rendering, so tests and the computer can share it); the panel in `src/ui/`.

**2. Reading the rival.** When a rival changes age, the toast becomes a card the player can open:
- what that age is good at and shuts (its `verb` and `door`), its whole walked history (chosen 2026-10-24: every age change was announced to all as it happened, so this tells nothing new, it only remembers it), and any crossing it is now half-way to;
- after a **step back**: the weak window (`STEP_BACK.time`, its units fallen back to their older form) with a countdown, and "a chance to strike";
- a rival's **keepsake** you have seen (a smithy in a Stone Age town) is marked on the minimap and named: "they have walked the Iron Age".
- *Decision:* punish the window or race them to the crossing; going back now has a cost a rival can make you pay.

**3. Your road, at the end.** The end screen draws each player's journey on the web map: the climbs and the loops back, time in each age, keepsakes carried, crossings completed, each weak window and whether it was struck. Under it, the roads this seed offered that nobody walked (only ages the viewer saw).
- **Play this seed again**, and in an online room **Rematch** with the same seats.
- *Code:* a `journey` list on `Player` (`[tick, age, back]`, pushed in `enterAge`, `src/sim/game.ts`), optional so older saves load.

## Phase 2: building up your town

**A. Every side age has a building of its own, and it is the keepsake** (first). Each side age without one gets a building only it raises, one that changes what the town does (a Bloomery for the Iron Age, a Ropewalk yard for Sail, a Hire Hall for the Merchants); it becomes the keepsake in place of a shared Dock or Temple. "Go in, build its one thing, come back" becomes the reason for a detour, and a town shows its history: a rival who sees a Bloomery in a Stone Age town knows it walked the Iron Age (step 2 reads it). The Blood path's four ages each get one that is theirs alone, not only the shared set.

**B. The main-road ages change the town** (next, the Middle Ages first: it opens nothing today and matches spend long in it). One or two buildings each for the Middle Ages, Gunpowder, Industrial and Atomic that change how you build, within the cap of three. Illustrations: a Keep whose walls make a ward that works differently inside; bastions that take over from the old towers; a Factory that changes who works and how goods come in.

**C. Building by your people's rule** (research first, then one people at a time). What the Chinese streets do, for each people: a rule for where things go that makes layout a decision (Egyptian fields on the flood line, a Roman forum and its roads, a Greek agora, a Mongol camp that moves). A rule changes what you do, not a percentage for standing near something.

- *Measure:* `scripts/unlocks.ts` before and after (own buildings per side age, buildings per main-road age, shared keepsakes); two towns of different roads at minute 40 look different in a screenshot.

## Phase 3: the computer and friends

**4. Rivals with a temperament.** Each computer seat gets a name and a leaning: the road it favours and a habit with going back (hoards crossings, never retreats, steps back to bait you onto its walls). It plays to it consistently, so a player learns to scout it and answer it. It also strikes a rival's step-back window when it sees one.

**5. Friends of mixed skill.** A per-player handicap (gathering rate or a starting stock) in the room's seat list, and computer allies on a team; the Rematch from step 3. "none: fix".

## Phase 4: a reason to come back

**6. The seed of the week:** one seed and a road challenge ("complete a crossing", "win from the Water Road after one step back"), records kept in the browser.

**7. A codex of roads:** each age, crossing and core loop you have played, filling in like the web map's discovery. Knowledge, not unlocks: the basic routes stay first-class.

## Research only

- **What keeps the middle and late game rich** against the computer and with friends? The dilemma-card idea (a seeded event per age) was set aside by the owner; the research may find something better, or confirm that rival-reading and going back are the answer. A research issue, no build.

## Measures

- Road decisions a match (`docs/age-roads.md`'s proposed 4–6, the first by minute 5) over many seeds, headless.
- Distinct journeys the computer walks across seeds, and how many include a step back.
- The owner's play: does the next match feel different from the last?

## Order

1 → 2 → 3 (2 and 3 reuse 1's route search), then A → B, then 4, 5, 6, 7. A can run beside Phase 1 on another chain (it touches `data.ts` and models, not the HUD). C and the mid-game question are research issues anyone can take, any time. Each new age, and each reworked one, says where it sits: a town that becomes something, or a different game.
