# Design notes: what people love about historical RTS games

Before adding features, I looked at what players keep praising in the games this one follows: **Empire Earth** (2001), **Age of Empires II: Definitive Edition**, **Age of Mythology**, **Rise of Nations** and **Age of Empires IV**. The same few things come up again and again, in reviews, community wishlists and the features the remasters chose to add. Below, each one and what Ages of Earth does about it.

## 1. Watching your people grow through history

*Empire Earth's* hook was its sweep across the ages; every Age game makes "aging up" a moment, with new units and a town that changes its look.

- Five epochs, from the Stone Age to the Industrial Age, each with its own unit models and building style. Advancing gets a fanfare, a burst of light at the Town Center, a banner, and a change of music.
- Every unit re-arms and every building is rebuilt in the new style the moment you advance (EE's upgrade lines, without the busywork).

## 2. Peoples that feel different

AoE2's civilization bonuses and AoE4's asymmetric civs are the most-discussed part of those games.

- Six peoples, each with a bonus that changes how you play: Egyptian farms and cheap wonders, Greek hoplites, Roman builders, Mongol riders and hunters, a bigger Chinese start and cheaper research, British longbows.
- Kept light on purpose: bonuses rather than separate tech trees, so the game stays easy to learn. Unique units are a natural next step.

## 3. Counters that reward a mixed army

Rock-paper-scissors is the backbone of every one of these games.

- Infantry beat cavalry, archers beat infantry, cavalry beat archers, priests and siege; siege smashes buildings; rams shrug off arrows but die to swords. The tests check every counter wins its duel in every epoch.
- Stances (aggressive, defensive, stand ground) and attack-move, as in AoE2.

## 4. An economy you can shape

Build orders and a busy, readable economy are what keep people playing AoE2 for decades.

- Four resources, berries, deer hunting (with bolting deer), woods, mines and endless farms, storehouses to shorten the walk.
- Gathering technologies (axes, picks, wheelbarrow, plow, irrigation...) at the Town Center and Storehouse.
- A market with moving prices, for when you have too much of one thing.
- Quality of life players asked for in the remasters: rally points on resources (new citizens go straight to work), builders return to what they were doing, idle-citizen key, shift-queued orders.

## 5. Ways to defend

Walls, gates, towers and AoE2's town bell are beloved because they let a weaker player survive a raid.

- Drag-to-place walls that join up, gates set into them that only let your side through, watch towers.
- Garrisoning: units shelter in Town Centers and towers, which shoot an extra arrow for each one inside. The town bell sends every citizen to shelter and back to work after.

## 6. Heroes, priests and the unexpected

EE's heroes and prophets, AoE's monks ("wololo") and AoM's myth units give battles stories.

- One hero at a time inspires nearby soldiers (more damage, slow healing), from a Chieftain to a mounted General.
- Priests heal the wounded and convert enemy soldiers with a chant; kings can't be converted.
- Siege engines with their own animations: rams swing, catapult arms fling boulders that hit groups, bombards boom.

## 7. More than one way to win

Wonder victories and modes like Regicide and Deathmatch are some of AoE2's most-played lobbies.

- Conquest, or build a Wonder and keep it standing through its countdown (everyone sees the timer).
- Game modes: Regicide (protect your King) and Deathmatch (start rich and fight).
- Peace treaties for players who want time to build.

## 8. Playing with friends

LAN and online play are what people remember most fondly, and AoE2 DE's lobbies, spectating and recorded games kept it alive.

- Online rooms with a shareable code or link, up to four seats of people and computer players, teams, chat, pause, and rejoining after a dropped connection. Allies share vision.
- Every match is recorded; watch replays at up to 8× from anyone's point of view, or download them.

## 9. Knowing how it went

AoE2's post-game timeline and achievements screen are a favourite.

- The end screen charts score, population, army size and gathering over the match, marking when each player reached a new epoch, with a full stats table.

## 10. Sound and music with character

From AoE's villager chatter to EE's soundtrack, audio gives these games their personality.

- Every sound is synthesized live: steel, bowstrings, catapults, cannon, chants, the town bell.
- Units answer in made-up voices when picked and ordered, each with their own pitch.
- Music composed as it plays, one style per epoch, with drums that swell when a battle starts.

## 11. Easy to start

The remasters added better tutorials because the genre is daunting.

- Tooltips on everything, hotkeys shown on every button, first-game tips that react to what is happening (out of room, an idle citizen, the next epoch affordable, under attack).

## 12. Navies, fishing and the air

Every one of these games has a navy, and the water maps are many players' favourites; Empire Earth went further and put aircraft in the sky, which players still remember it for.

- Docks on the shore, fishing boats on shoals that last a long time (a second food economy that's worth defending), warships from triremes to ironclads, and transports that carry an army across the sea.
- Boarding is the part players complain about most in the classics (units milling on the beach while the ship waits round the headland), so soldiers and ship agree on a meeting place on a shore both can reach, the crowd boards from the beach, and landed troops march on to where you clicked.
- In the Industrial Age, an airfield with fighters and bombers. Aircraft ignore terrain and walls, so the counters matter: only missiles reach them, fighters hunt them, and bombers are slow and costly. An **Inland Sea** map makes the water the middle of the game.

## Not yet, and worth doing

For a bigger idea of where the game could go, see `docs/vision.md`: an idea the owner likes, offered as inspiration rather than a plan.

Ideas not yet built now live as `seed` issues, where any agent or the Muse can grow them (`docs/team.md`, "Seeds"). This list moved there on 2026-10-14 (#131): borders and supply (#132), a people's great work (#133), watching live matches (#134), a scenario editor (#135), an age past the Industrial (#136). Already built since it was written: trade ships, sea landings, relics, signature soldiers. Not carried over: more campaign chapters and ranked matchmaking; plant them as seeds if they spark something.

## Designers' notes

Agents design this game as well as build it (`AGENTS.md` §2). When you add something, sign it here in a few lines: what you built, why you love it, and what you'd do next, so the next agent can carry it further. Newest last.

### Relics (#4), 2026-10-13

**Built:** gilded relics on every map, one at the same distance from each town and a few more out where the land is as far from the two nearest towns. A priest carries one home to a Temple, where it brings in 30 gold a minute; a carrier can't heal or convert, drops it when they fall (or with **D**), and a fallen Temple spills its relics. Keeping every relic for a wonder's countdown wins. The computer builds its Temple early when relics lie loose, sends a priest for each (never from under a rival's walls), and treats a rival's relic countdown like a rival wonder: it goes for the temples that hold them. The relic is a casket on a mossy plinth that glitters, held high over a carrying priest, and kept relics circle above their Temple's roof, one casket each, so you can count a rival's from across the map. The minimap marks loose relics as gold diamonds; picking one up and enshrining it have their own chimes and choir.

**Why I love it:** priests only healed and converted, and temples were a building the computer barely bothered with. Relics give the first minutes a reason to scout, the middle a reason to raid (a Temple full of relics is worth a ram), and a third road to victory beside the sword and the Wonder. Cavalry already run down priests, so a relic run wants an escort: the counter triangle on a new errand.

**Next, if you pick it up:** priests aren't treated as soldiers on the command card (they get stances and attack-move today, which is older behaviour); a "sacred site" variant for later epochs (AoE4) that any unit can hold; a technology at the Temple that raises relic gold; the computer escorting its relic carriers; a lobby option to switch relic victory off. On wooded maps where the towns aren't joined without cutting trees, fewer contested relics are placed (only ground every town can walk to counts as fair); a map-generation change that guarantees open roads would fix both.

### Trade (#6), 2026-10-13

**Built:** neutral trading posts (a caravanserai plaza with pavilions, a well, a camel and pennants) stand near the edge of every map, about as far from their two nearest towns and well away from all of them, two on small and medium maps and up to three on large. A Market trains traders from the Bronze Age (pack donkey, ox cart, covered wagon, traction engine); right-clicked onto a post, they run the road between it and their Market by themselves. A trip pays `TRADE.gold` × the squared distance from the Market to the post, a little more each epoch, at most 180, and only once the trader is home with it. Two Market technologies, Caravans (faster) and Banking (+20% pay). Cavalry deal two and a half times their damage to traders. The computer saves for a Market when there are posts, trains a few traders ahead of its epoch savings, sends each down the best-paying road that doesn't pass a rival's town, and between waves sends riders after rival traders near home. A Market's rally point on a post sends new traders straight onto the road.

**Why I love it:** gold came only from mines, relics and the market's poor rates, and none of them gave a match a shape. A trade road is a line across the map: the long one pays best and is the hardest to guard, so where you put your Market becomes a real decision, and cavalry, towers and walls get a new job. It also gives the late game an income that doesn't run dry when the mines do.

**Next, if you pick it up:** trade cogs between docks and coastal posts; trading with an ally's Market (AoE2's way, so team games pay the player at the far end too); the computer escorting its caravans and building a tower on its road; a ruin variant of the post for Stone Age starts. Balance is a first pass from four 30-minute headless matches on small maps (Normal against Hard): counted over a trader's whole life from the moment it's trained, trade paid 11–18 gold a minute a trader for Normal and 11–44 for Hard (whose roads ran longest), against 33 a minute for a citizen mining gold before the walk to drop it off (`GATHER.gold`). Hard's 6,000 gold in one match may be too much; human play will tell.


### The Long Road, the campaign (#9), 2026-10-13

**Built** by an earlier session (`session_01CZ8aAxEdgGMWbw3eA2hqRe`, branch `claude/friendly-darwin-ik01ye`), which wrote all six chapters, the goals panel, raids, gifts, stars and the chapter screen but never opened a pull request. Chain 1013-1734's third session brought it up to date with relics and trade and merged it. The one design call in the merge: **in a chapter, keeping every relic starts no countdown and wins nothing.** Relics still pay their gold, so a chapter's Temple is still worth a priest, but a chapter is decided by its goals, and nobody loses The Wall to a relic hoard the briefing never mentioned. A Wonder still wins a chapter, as the original author left it.

**Why it matters:** a campaign is how most people first meet an RTS, and these chapters teach the game in order: gathering and houses, then a market and a raid, then walls and towers, then siege, then the sea, then the air.

**Next, if you pick it up:** the computer in `scripts/campaign.ts` only wins chapters 1 and 2, because it doesn't play toward scripted goals (it never builds walls). Teaching it to (a goal-aware mode in `ai.ts`) would prove every chapter winnable and give a "watch the computer play it" button. Chapters for relics and trade (a pilgrim road, a caravan city) would show off the newest systems. Starting relics and posts per chapter are wherever the map generator puts them; a chapter could choose to have none.

### Signal beacons (own pitch), 2026-10-14

**Built:** a Watch Tower can light a beacon (**F**): +7 sight for 45 s, and every rival sees the ground around the tower while it burns (`BEACON` in `src/sim/data.ts`, `src/sim/beacon.ts`). Flames and smoke on the roof, a horn-and-whoosh sound, a toast for you and an alert for rivals; the clever computer lights one when three soldiers close on a tower. **Why I love it:** towers only ever shot; now they are also a choice between seeing and being seen, which suits raids and the borders work (a forward Tower is a lookout too). **Relay (added, same day):** a lit beacon passes its flame free to the owner's other finished, rested towers within 14 tiles and on down a chain, 25 s each (`BEACON.relay`, `.relayDuration`); a line of towers carries warning across your land but shows rivals every tower. **Next:** have the relay alert the town centre, give allies a shared flare, and have the computer read rival beacons as raid targets or bait. Browser unverified; the sound wants an ear.

## Designers' notes: signature soldiers (2026-10-13, Chain 1013-1900)

Built: each of the six peoples has one unit line with its own names per epoch and a trade-off (`SIGNATURES` in `src/sim/data.ts`, applied in `statsFor`). Why I love it: it was the "unique units" idea in the notes above, done so a Mongol army *reads* differently (Mangudai: hit harder, die faster) without new models or UI. The tooltip on the people's name in the top bar lists it. Numbers changed: all new, none of the existing ones. Not seen in a browser; unit-tested only.
Next: give each its own model tint or silhouette in `unitModels.ts`; let the computer pick its people's signature line more often; a second, epoch-locked signature (a Roman ram, a Greek hero).

### Signature marks (2026-10-13, Chain 1013-1900)

Built: a signature line now wears its people's mark on the field: Egyptian gold headdress and lapis collar, Greek horsehair crest, Roman cross-crest, Mongol horsetail standard, Chinese red-and-gold banner, British white plume (`signatureMark` in `src/render/unitModels.ts`; its own instanced batch per people, so no extra cost for other units). Why: the rules gave each people a different army; now you can see whose it is across the map. Not seen in a browser (headless geometry test only), so sizes and heights of marks, especially on riders and siege, may want tuning. Next: per-epoch variants of each mark, tinted cloaks, marks in the portraits.

### Veterancy (2026-10-13, Chain 1013-1900)

Built: soldiers who defeat enemy soldiers (citizens and buildings don't count; shooters are credited through `Shot.src`) earn Veteran, Elite and Champion ranks (`VETERANCY` in `src/sim/data.ts`: 3/8/15 kills, blows x1.1/1.2/1.3, armor +0/1/2). The selection panel shows the rank and a gold ping marks a rank-up. Why I love it: it makes a surviving army precious, so retreating and healing with priests matter, and it stacks with heroes and signature lines. Numbers are all new. Not seen in a browser; unit-tested only. Next: chevrons over veterans in `unitModels.ts`, a rank-up chime, the computer pulling back wounded veterans, priests' healing favouring them. No save bump: `vet` is optional.

Chevrons and chime (2026-10-13, Chain 1013-1900, session 4): veterans now wear one to three gold unlit chevrons over their heads (`chevronGeometry` in `src/render/unitsView.ts`, one instanced mesh per rank, turned to face the camera), and a rank-up plays a new synthesized `rankUp` fanfare with a small sparkle. Look only, no rule or save change. Not seen in a browser (typecheck and tests only); the chevron height (1.5 above the ground, 1.75 mounted) is a guess to check. Next: the computer favouring its signature line, transports in computer invasions.

### The computer favours its signature line (pitch, no issue), 2026-10-13, Chain 1013-1900 session 5

Built: when the computer isn't countering what it sees, it now trains its people's signature line (`SIGNATURES`) about half the time wherever the building trains it, so a Mongol computer rides, a Greek one forms a shield wall. Siege and priests keep their own rules. Lane ai, `src/sim/ai.ts` only; no number or save change. Verified by a 20-minute headless match only, not balance-swept. Next: transports in computer invasions, a scenario editor.

### The computer lands by sea (pitch, no issue), 2026-10-13, Chain 1013-1900 session 6

Built: on `sea` maps the clever computer trains a transport, loads up to half its idle home army, sails across the great sea and lands them by the enemy's town (`seaLanding`, `src/sim/ai.ts`). Lane ai, no number or save change. Only lightly tried: one landing completed in three headless matches; no test, no browser. Next: a test that forces a landing, escorting with warships, invasions on island maps if one is ever added, a scenario editor.
### The computer plays the campaign (#12), 2026-10-13, Chain 1013-1734 session 4

Built: when a computer sits in a chapter's own seat, `chapterGoals` in `src/sim/ai.ts` plays toward the goals. It lays a wall line across the rival's approach and towers beside it, raises the buildings and trains the units the goals count (keeping one spare), holds at home while a goal says survive, and when the rival town must fall, sends early waves at the nearest rival Town Center with siege, sells spare stone for gold, and goes all in as the clock runs down. Rivals and ordinary matches never use it. A Normal seat now wins chapters 1–5 (`tests/slow/campaign-proof.test.ts`). Design call: "Destroy the rival town" became "Burn the rival Town Center", and a burned one stays counted if they rebuild. Hunting the last house and citizen across a lake map ate the clock and read badly on screen. Why I care: a campaign nobody can show is beatable may be broken, and now the check runs every day. Not done: Wings over the Steppe (#24: gold runs dry, the Kaiser snowballs). Wins are fragile: merging other agents' AI and veterancy work flipped Sea Lords between Normal and Hard, so the test accepts either. Next: a "watch it played" button in the chapter list, and Wings.

**Pilgrimage (2026-10-13, Chain 1013-1900, session 8).** Built: a Temple technology (Bronze Age, 200 food and 150 gold) that doubles the gold each kept relic pays (`relicGold` in `Mods`, `src/sim/relics.ts`); the computer researches it last. Why: it gives a Temple town a reason to hold relics beyond the score, and a reason to raid them. Numbers: all new (`TECHS.pilgrimage`). Unit-tested only, not seen in a browser. Next: the computer escorting its relic carriers; a lobby option to switch relic victory off.

### Market prices recover (pitch, no issue), 2026-10-14, session claude/confident-goodall-h0mtc1

Built: each Market price moves one point back toward its starting value every 10 seconds (`MARKET.recover`, `MARKET.every` in `src/sim/data.ts`; `driftMarket` in `src/sim/game.ts`). Before, selling pushed a price down for good, so a lopsided economy (#24: thousands of spare food and wood, no gold) could only convert at worsening rates. Why I like it: the Market now has a rhythm. Sell in bursts and let it breathe, or watch a rival's glut and trade into it. Numbers: all new; a trade is 4 points, so one trade heals in 40 seconds. Rules change that touches every match; no state shape change, no save bump. Checked: new unit test, quick tier, and the slow campaign proof (chapters 1-5 still win). Not seen in a browser. Next: show the price trend arrow on the Market card, per-team prices so allies share a glut, the computer timing its sales to a recovered price. Doesn't fix #24 alone.

### Reading the market (#30), 2026-10-14, Codex

Built: the Market selection panel shows ↑ when a quote will recover upward, ↓ when it will recover downward, and → at baseline. Buy/sell tooltips include the starting quote, recovery rate, and the fact that every player shares the price. This extends #31's recovery mechanic without adding another price loop or changing any balance values. Why I like it: players can see why waiting or selling another resource helps, instead of needing to discover an invisible timer. Added regression coverage for save/load timing, shared trade shocks, equilibrium, ended matches and immediate round-trip losses. Browser appearance remains unverified in this environment. Next: playtest whether arrows remain clear with traders and training queues in the panel.

### Ages as a web, s1: the Age of Merchants (#37, #38), 2026-10-14, chain 1014-0030 session 1

Built: ages and the roads between them as data (`AGES`, `ROADS`, `TRUNK` in `src/sim/data.ts`; `src/sim/ages.ts`). An age has a tier, which is what `p.epoch` now means, so every epoch-based system (unit versions, building styles, technologies, walls, campaign goals, the score, the music) works unchanged in a side age. The trunk roads are generated from `EPOCHS`, so their costs can't drift apart. The first side age is the **Age of Merchants** (tier 2): only from the Bronze Age, shown once a Market stands, open once traders have brought home 400 gold. It hires the current foot, bow and horse lines at the Market for gold alone (1.2 gold per point of their usual price, half the time), trade pays 25% more, and levies cost 20% more. Roads out: Gunpowder (food 800, gold 900, stone 100) or sideways onto the Middle Ages (food 300, stone 150).

Why I love it: it turns trade from a side income into a road. A merchant people fights with money: it can raise an army in seconds at a Market far from its barracks, but its strength is a line of ox carts and a gold pile, and a rival who reads "Age of Merchants" on the scoreboard knows to ride down the caravans. It's the smallest step that makes the web real: a fork, a window that closes, a deed instead of a price, and two ways back.

Not done, by design: the computer still walks the trunk only (lane ai is claimed; it's #37 s4). No new models or music: a merchant town looks medieval (s7). An age's traits last only while you're in it; what carries over when you leave is an open question in `docs/vision.md`, and I'd answer it in s3 with the step back. Next, the Iron Age (s2): a deposit only some seeds have, a survey that says yes or no.

### One live connection per player (#41), 2026-10-14 — Codex

Built: replacing or closing an online connection cancels its pending reconnect; old socket events cannot clear the replacement's heartbeat or deliver stale messages. A tab replaced elsewhere stops retrying instead of fighting for the seat. A recoverable lobby error no longer disables reconnection after a later network drop. The room rejects every message from a connection it has already removed, including queued messages arriving before the socket finishes closing.

Why I care: a long match should survive a flaky connection without two tabs competing for the same people. This strengthens the existing reconnect and seat-ownership rules without changing the match itself. Next: test the complete drop/rejoin/catchup sequence with two real browsers and a Worker. Socket behaviour is covered with controlled event and timer tests here; browser play remains unverified.

### Wings over the Steppe, shown winnable (#24), 2026-10-14, Chain 1013-1734 session 5

What shipped is small: Wings joins the daily campaign proof, because on today's `main` (with market prices that recover, from another session's pitch) a Hard computer in your seat wins it at 38.7 minutes. What I learned is bigger. **Computer traders were judged safe on the straight line from Market to post**; where the real road bends around water it ran through a rival's town, and in Wings nobody traded a coin (my seat lost 21 traders, 1,260 gold, in 20 minutes). The fix (road safety along the path walked, gold per tile, a road shunned for four minutes after a loss) is built on `claude/42-trade-roads`, but it can't merge yet: any AI or rules change reshuffles the proof's close chapters, and with it Sea Lords loses (#43). I also built chapter-seat tactics for breaking Town Centers: an escorted bomber wing (an unescorted one died to two fighters in eight seconds), Fusiliers when gold is short (they hit buildings about nine times harder than Riflemen), soldiers idle by the target turning on the building, the strongest rival first, all-in reinforcements in sixes, and a home defence that doesn't recall the whole army from the enemy's gates. I also tried the Tsar on Easy. Over six seeds these took Wings from 1 to 4 wins in 12 on yesterday's build, but on today's they lost the chapter's own seed, so they didn't ship; the code is in commit a6ea7b9 and the numbers are in #36. Why I care: the last chapter is the one a player remembers. Lesson for the next agent: judge an AI change by a sweep over seeds, never by one match; one match is a coin toss. Next: #43 (a sturdier proof), then #42, then #36.

### Ages as a web, s2: bog iron and the Iron Age (#37, #39), 2026-10-14, chain 1014-0030 session 2

Built: the first thing the seed decides. On about half of all worlds (`BOG_IRON.chance`), `placeBogIron` in `mapgen.ts` lays a five-tile patch of **bog iron** (`R_BOG`) for every town, about 22 tiles out, square to the line to the middle (off to the side, not on the road to a rival), nearer that town than any other and walkable from it; if any town can't have one, none does. It rolls its own dice and only touches empty ground, so a world without it is exactly the map it was before (a test checks this tile by tile), and campaign maps never get it. Citizens dig it like gold, a little slower (0.45 a second), and it's paid in as gold. A Storehouse technology, **Survey the Land** (50 food, 50 wood, 15 s), answers yes or no with a banner. The **Iron Age** (tier 1) opens from the Stone Age only, after a yes and 150 bog iron dug: infantry a quarter cheaper and +1 attack, farms and wood +10%, and no cavalry (a greyed button that says why). One road out: the Middle Ages at the trunk's price. New on `Road`: `found` (a survey that must have found the deposit). New on `Age`: `price` (cost by unit class) and `no` (lines it can't train). New mod: `infantryAttack`.

Why I love it: it's the first time the map changes what's possible rather than just where things are. Two players on the same settings can face different questions: on a bog world, do you spend the early minutes walking out to the marsh, betting on a cheap infantry rush with no horse to answer archers? On a dry one, the survey's "no" is information too: your rival can't go that way either. And it gives the opening a real, readable fork: a rival whose chip says "Iron" has no cavalry, so mass archers and raid with horse.

Honest about absence (`docs/vision.md` §3–4): the survey tells the truth both ways, and after a no the road never shows. Not done: the computer never surveys or takes the road (s4, lane ai). The bog model is new but has no sound of its own beyond the mining clink. Next I'd do s3, stepping back, and I'd like a second seed deposit later that opens something in a later age, so the survey becomes a habit rather than a one-off.

### Ages as a web, s3: windows and stepping back (#37, #47), 2026-10-14, chain 1014-0030 session 3

Built: a Town Center action, **Step back** (Z), down to the trunk age one tier below whatever road led here: 100 food and 50 gold per tier given up, 25 s, cancellable for a full refund, then a 5-minute cooldown before the next step back (climbing is never held back). It lands through `enterAge`, so units and buildings restat in their older forms with their share of health. Technologies above the new tier move from `p.techs` to `p.suspended` and come back, unpaid, on any later change of age that reaches their tier; queues are cleaned on every age change (what the new age can't train or research is refunded, so a merchant Market's queued mercenaries come back as gold). **Windows** are explicit: a road into a side age opens only from its `from` age, and the Town Center shows a known side road you're outside of as a greyed 🔒 button that says where it opens, and the step-back button says which roads it reopens. New: `STEP_BACK`/`stepBackCost` in `data.ts`; `backTo`, `backProblem`, `journeyOf`, `shutRoads`, `isSideRoad`, `suspendedTechs` in `ages.ts`; the `stepBack` command; optional `Player.backAt`, `Player.suspended`, `Building.back`; `back` on the `epoch` event (dusk-blue ring, a falling fanfare, a "Back to the …" banner).

Why I chose this shape: suspension as a separate list rather than "a tech above your tier stops counting" keeps `p.techs` meaning "what's working now", so nothing else in the code (the computer, the Pilgrimage test, the HUD) has to learn a new rule. Stepping back always lands on the trunk, so no age is a dead end and the cost is legible: what you lose is the climb. The step itself is cheap on purpose; the real price is paying for the climb again, and the cooldown stops a people flickering between forms to dodge a counter.

Not done: the computer never steps back (s4, lane ai). Nobody has played whether 25 s and 100 food + 50 gold per tier is right, or whether 5 minutes is too long. Next I'd let a side age choose its own step-back target (`Age.back`), for ages that sit between two others, and I'd like a "memory" bonus: a people that has been somewhere before climbs back faster.

### Ages as a web, s5: pilgrims, fairs, and crossing chains (#37, #49), 2026-10-14, chain 1014-0030 session 4

Built: two ages that tie the web to other systems. The **Age of Pilgrims** is a *turn* off the Middle Ages (tier 2 to tier 2, "Turn to" on the Town Center), opened by relics: a Temple as the clue, 120 gold from kept relics as the deed (a new tally, `PlayerStats.relicGold`, counted in `relics.ts`). Relics pay double, priests cost half and work a quarter faster; it plays against walls and towers, because a pilgrim people builds no siege engines, and against raiders, because its income sits in Temples that spill their relics when they burn. The **Age of Fairs** is the hybrid: tier 3, instead of Gunpowder, from the merchants *or* the pilgrims, needing 800 traded gold *and* 200 relic gold. Its own mechanic couples the two systems: every relic kept multiplies each trade trip by +10% (up to five relics, `Age.relicTrade`, applied in `tripGold`). It gives up building strength (×0.85), so it plays against raids on the roads and Temples and against siege. Roads out of each: forward on the trunk for a richer-in-gold price, or sideways back onto it; a step back lands on the trunk as before (Bronze, Middle).

Why this shape: a road's second condition is a list of deeds (`Road.also`), not a new kind of condition, because every system already keeps its tally in `PlayerStats`; a crossing costs one stat and one line of data, and the HUD and `roadProblem` read any number of them the same way (✔/… lines in the tooltip). `deed` stays as the first entry so the old roads and their tests are untouched. Pilgrims turn off the Middle Ages rather than fork from Bronze partly because the s3 tests fix the Bronze Age's roads at two, and mostly because the great pilgrimages are medieval. Both roads into the Fairs take a Temple as their clue: the relics are what a merchant people hears of last.

Not done: the computer takes neither road (s4, lane ai). No look or sound of their own (s7). Nobody has played the numbers: relic gold ×2 stacks with Pilgrimage to ×4, which may be too rich on maps with many relics. Next I'd give pilgrims something to *do* beyond income: pilgrims walking the roads between Temples, who can be escorted or robbed, would make the faith a third road system beside trade.

## Designers' notes: the web map (2026-10-14, chain 1014-0030, s6 of #37)

Built: a title-screen map of the web of ages that fills in across matches (`src/ui/webMap.ts`, discovery in local storage, recorded from `main.ts` every 20 ticks, never in the sim). Why I love it: finding the Age of Fairs becomes something you remember and want to show a friend, not a list of buttons. Next: s4 (the computer walks the web, lane ai); a flourish when a new age is first discovered mid-match; a drawn road between same-tier ages that doesn't pass behind another box.

## Designers' notes: ages that look and sound like themselves (2026-10-14, chain 1014-0030, s7 of #37)

Built: each side age dresses its buildings and has its own music, read through `ageOf` with no rule changes. Merchants: striped awnings over Markets, houses and Town Centers. Iron: a glowing furnace mouth and rust-brown skirts, dark smithy smoke and sparks. Pilgrims: pale stone courses, banners, lamps and incense over Temples. Fairs: red-and-white stalls and bunting round the Market, confetti over it. The touches are baked into the building's own vertices (`ageTouches` in `buildingModels.ts`), cached per age, so no extra draws. Music (`SIDE_STYLES` in `music.ts`): bright Mixolydian on lute and bells for merchants; a slow minor-pentatonic drone with an anvil keeping time for iron; a Phrygian bell-and-strings chant for pilgrims; a quick major oom-pah and recorder for fairs. Why I love it: a rival's town tells you which road they took before you read the scoreboard. Next: dress units and the Wonder in each age, give the merchant age its own ambient (coin chime), and tint the minimap blip.

**Side-age Wonders and minimap rings (2026-10-14, Chain 1014-0030, session 7).** Built: the Wonder wears each side age's dress, and the minimap outlines a side-age owner's buildings in gold (merchants), orange (iron), white (pilgrims) or red (fairs). Why: a rival's road should show on the map before you scout it. Not seen in a browser. Next: dress units in each age, a coin-chime ambient for merchants.

**A line when you find a new age (2026-10-14, Chain 1014-0030, session 8).** Built: the first time ever that your people stand in a side age, a toast says it is now on your web map (`recordDiscovery`, `src/main.ts`; outside the sim, no save change). Why: finding the Age of Fairs should feel like a discovery, not a silent unlock. Not seen in a browser. Next: a chime for it, and a pulse on the title-screen map's new box.

## Designers' notes: trade roads the computer can read (2026-10-14, Chain 1013-1734)

Built: the computer judges a trade road by the path its traders actually walk, not the straight line, keeps off a road that has just cost it a trader, and trains none when every road runs through a rival town (#42). Why I love it: trade was the one part of the economy the computer did badly in a way you could watch, wagons queuing to die in a rival's town for 20 minutes. Now trade is a real pillar for every seat, which makes raiding a caravan road matter. Next: let the computer escort its traders or wall the road's worst stretch, and teach its riders to hunt the rival road that pays the rival best; and Wings, one against two traders, needs your side to fight two fronts (#36).

### Allied trade, 2026-10-14

**Built:** when a trader pays in, each ally who has a finished Market takes `TRADE.ally` (a quarter) of the trip as gold, with a coin chime and sparkle at the paying Market. Rivals and Market-less allies get nothing; the trader's owner is paid in full, so nothing is taken from anyone.

**Why I love it:** team games had no reason to trade side by side; now a Market is worth building even for the partner whose posts are far, and a raid on one trader costs the whole team. It is the "trade with an ally's Market" idea in the trade notes, in its smallest form.

**Next:** let a trader choose an ally's Market as its home (AoE2's way, so far allies' roads pay by distance); the computer ally building a Market when a teammate trades. Number added: `TRADE.ally = 0.25` in `data.ts`. Unit-tested only; not seen in a browser.

**Follow-up, same day:** a player with no Market of their own can now route traders from an ally's (`homeMarket` in `trade.ts`): the trader's owner is paid in full by distance from that Market and its owner takes the usual quarter. So a Market-less partner can still join the trade, and the player with the Market becomes worth protecting. Still open: the computer ally building a Market (lane ai is held until #36). Unit-tested only.

**Allied trade looks and sounds like itself (same day):** when an ally takes their share, the paying Market gets a pale-blue ring and slow silver-gold coins rather than your own gold burst, with a lighter four-coin spill and one bell (`tradeShare`), so you can tell a partner's caravan from your own across the town. The event carries `share: true`. Not seen or heard by a person; the sound's level is a guess and wants an ear.

## Designers' notes: idle citizens together (2026-10-14, Codex)

A spent berry patch should be a reason to choose the next food source, not to find the same group one citizen at a time. Shift + . or Shift-click Idle now selects every available idle citizen. Plain . still cycles and looks at one; selecting the whole group keeps the camera where it is, like the whole-army shortcut. The counter, finder and first-game tip share one definition: living citizens of your seat, outside shelter, idle, without queued work. That keeps a ship's passengers and the town bell's refugees out of an economic shortcut. Next: a breakdown of citizens by job could help players judge where their economy needs hands. — Codex

## Designers' notes: quarter marks on health bars (2026-10-14, Codex)

I like battles where a glance tells you who can hold and who needs to retreat. Three fine quarter marks on the existing health bars let shape support color, without more HUD text. They face the camera and stay in place as health falls; one instanced draw covers all marks. No rules, balance or sound changes. Next I would ask the owner whether these remain legible at the farthest zoom before adding more indicators.

### Ancient ruins (#64), 2026-10-14, session claude/upbeat-cori-rc8bef

Ruins between the towns, dug once by citizens for a find the seed decides: a hoard, lost knowledge (a free technology), an old map, or a relic. I wanted the first ten minutes to have something worth a gamble far from home: citizens off the economy, walking out where cavalry hunt, for a reward you can't see. It's a small corner of `docs/vision.md`'s "the seed changes what's possible" and "discovery": two maps with the same layout play differently because of what's under the stones, and the relic find feeds the pilgrims' road. The work is shared, so a rival who walks up late can steal the last spade: escort your diggers. Next, if you'd like it: finds that only some seeds hold (a ruin with a lost machine that opens a side age, as the vision's "restored-machine societies"), ruins in a campaign chapter, and the computer escorting its diggers rather than fleeing.

## Designers' notes: the two-front war (2026-10-14, Chain 1013-1734 session 8)

Built: in Wings over the Steppe the Tsar now plays Easy, and a computer in a chapter seat that must burn Town Centers goes for a rival's wonder first (#36). Over 16 maps the computer in your seat now wins 8 (it was 4), and a Normal seat wins the chapter's own map. Why I care: the last chapter should feel like a war on two fronts that you can win, not a coin toss. The Tsar still marches on you at minute 15 and the Kaiser is as strong as ever, so it's still the hardest chapter. The most telling thing I found: the seat could be killing three for every one it lost and still lose, because it marched past the Tsar's wonder to reach a Town Center. Tried and dropped (numbers in `docs/log/2026-10-14-0505-two-fronts.md`): a home defence that doesn't recall the whole army, soldiers striking the Town Center rather than the houses on the way, towers facing both rivals, more citizens, and a shorter town bell. None moved the win rate over 32 matches; towers made it worse. Next: under steady pressure the computer's town bell stays rung for many minutes (25 of 44 citizens indoors), which starves a town; a smarter bell needs a defence that can hold the town while the people work, so the two go together.

## Designers' notes: four camera bookmarks (#76, 2026-10-14, GPT-6)

Built: four views you can store with Ctrl+Shift+1–4 and visit with Shift+1–4. The camera glides back without touching selections or orders; each match starts clean. I love maps with several stories unfolding at once: a trade route, a vulnerable dock, a far scouting patrol. Fighting the camera should not be the challenge. I kept the view memory local to the UI, so it doesn't add replay commands or make online lockstep heavier. Next I'd draw temporary, subtle numbered pins on the minimap when holding Shift, to make bookmarked territory legible without permanent HUD clutter. Browser visuals remain unverified in this session.
### Weather (pitched on the board's quiet day), 2026-10-14

**Built:** a day for every match, picked from the seed and the map type (`weatherFor` in `src/render/weather.ts`): clear, rain, snow or mist, with a strength from light to a storm. Rain and snow are one draw call each, animated in the vertex shader inside a box that follows the camera; the sky greys, the sun dims and the haze closes in. Rain adds a hiss to the ambience (birds fall quiet), a storm throws lightning (the light flashes twice) and rolls thunder in after it, the way sound lags light. All of it is look and sound: nothing in `src/sim/` reads it, so no save, replay or online room can disagree about it.

**Why I love it:** the land was always the same bright noon. A grey day makes a town feel lived in, and a storm over a battle is the screenshot you remember. It is also the cheapest way to make two matches on the same map feel like different afternoons.

**Next, if you pick it up:** a weather that changes in the middle of a match (a front rolling in; needs a tick-driven schedule kept in the state if the rules are to see it); then the rules hooks that would make it deep: rain slowing fire and gunpowder, snow slowing marches, mist trimming sight, a granary tech that keeps farms working in winter, and the computer reading the day. Those change balance and the campaign proof, so each is its own pitch. Lightning could strike a tall building. Dust and heat haze for plains, an aurora for snow nights. Browser-checked here only in headless Chromium on the title screen (rain, snow and mist drawn, no console errors); the loudness of the rain and thunder wants an ear.

## Designers' notes: a workforce ledger (2026-10-14, GPT-6)

Built: a top-bar Workers panel that counts living citizens by what their current order says, including workers in shelter, and selects that job's group with one click. Why I love it: the shape of a town's economy should be visible before its citizens are lost in the buildings. This extends the idle-citizen shortcut without disturbing any orders, rules or saves. Next: a gathered-per-minute history might let players tell a wood shortage from a slow road. Browser appearance unverified in this environment. — GPT-6

## Designers' notes: the computer walks the web (2026-10-14, chain 1014-0320 session 2, s4 of #37)

Built: Normal and Hard opponents now take side roads (#50). Each one judges a side age by its own rules against its people's signature line: an age that makes that line cheaper (Greek and Roman foot in the Iron Age, Egyptian priests among the pilgrims) it always takes when it qualifies; one that bars it (Mongol riders in the Iron Age, Chinese siege among the pilgrims) it never takes; any other with a 60% chance, decided once (`AI_WEB` in `data.ts`, `fit` and `wants` in `ai.ts`). So a new age gets judged without anyone keeping a table. Then it works for the road: it surveys first thing (in the Stone Age every scrap of food goes on citizens otherwise), keeps three citizens digging, raises its Market early in the Bronze Age on a map with posts, and holds its Town Center for a deed that's under way, for 90 seconds at most. In a side age it uses what it got: hires at the Market, skips the Stable in the Iron Age. It turns back onto the Middle Ages if its relics are taken. And it reads you: against an Iron people it trains other lines only while they number under half its archers and builds a second range; against merchants, a band of riders lies in wait by the trading post nearest your town and strikes only the traders it can see. Why I love it: the web was a player's toy until now; a rival on a different road makes it a conversation. When the scoreboard says "Iron", the archers that come next mean something. Next: `docs/log/2026-10-14-1100-computer-web.md` has the head-to-head numbers: a walker loses more often than it wins against a computer kept to the trunk that reads it (3–10 over 48 matches, 35 undecided), mostly in matches where it prepared for a road and didn't take it. Make that preparation cheaper and smarter: survey only when the town is safe, and drop a road the moment the trunk is ready first. Holding for the merchant deed can run into the army-first window (an attack due) and stretch the Bronze Age by minutes, and the iron dig costs tempo; both want a smarter sense of when a road is worth its delay. The Step Back (Z) is never used: the iron road falls back to the Stone Age, which is never worth it for the computer, and the merchants' and pilgrims' own roads back onto the Middle Ages are the better retreat.

## Designers' notes: the seed atlas (2026-10-14, chain 1014-1135, #80)

Built `scripts/seed-atlas.ts`: scans seeds through `generateMap` and lists those with bog iron, enough trading posts, relics, or particular ruin finds, by size, type and players (`--json` for other tools). Why I love it: the game promises that the seed changes what's possible, and now a tester or world-builder can go and find those worlds instead of hoping. Not seen in a browser (it's a terminal tool). Next: a `--share` flag that prints a ready-to-paste match setup, filters for start-to-start distance or water, and a "rarest worlds" survey of how often each feature occurs per map type.

Seed atlas, second pass (chain 1014-1135, session 2): `--survey` counts how often bog iron, trading posts, relics and each ruin find occur on every map type. Over 100 small seeds bog iron is about 48% on every type, so the map type doesn't steer it; the seed alone does. Left out: `--share`, because the game has no seed address parameter yet. Next: a `?seed=` address so a found world can be opened in one click, then a filter for start-to-start distance.

Seed atlas, third pass (chain 1014-1135, session 3): the game now reads `?seed=N&size=&map=&foes=` and opens its title screen on that world; `seed-atlas.ts --share` prints those addresses for its hits. Ignores bad values rather than failing. Not seen in a browser (Chromium unused); the title code is a few lines and falls back to the usual random seed. Next: a start-to-start distance filter, and a one-click "Copy world link" button on the title screen.

## Designers' notes: Scout Flags (2026-10-14, GPT-6, #85)

Built: gold planning pennants and red danger pennants on both the 3D land and the minimap. Ctrl+right-click explored ground to plant one; Shift makes it red. Repeating removes one, or changes its kind. Six stand at once; the oldest makes room for the seventh. Why I love it: an RTS map is a place to think, not just a place to march. Mark a ruin to revisit, a crossing the rival holds, or a shore to land an army. These notes are private to the browser and never reveal fog, issue commands, affect AI or get saved/transmitted. Browser appearance remains unverified here. Next: optional shared allied notes, but only with authorization checks on every network message.

### The hours of the day (own pitch), 2026-10-14

**Built:** `src/render/daylight.ts`: one day lasts an hour of play (`DAY_SECONDS`), a match opens between 07:30 and 10:30 by seed, and a table of hours (dawn, morning, noon, golden hour, sunset, dusk, night) gives the sun's colour and strength, the sky and horizon colours and the fill light, blended smoothly. The sun climbs from the east and sinks into the west, and a higher, bluer moon carries the light on without a jump. The view relights only when the hour has moved. Weather (`moodOf`) greys whatever hour it is, so rain at dusk is dark. `?hour=` holds the clock for trying it out. Pure render: it reads `s.tick` and `s.seed` and writes nothing back.

**Why I love it:** a match used to be one frozen noon. Now a long game has a shape you can feel: the opening bright morning, long gold shadows over the first armies, and a night that arrives just as a siege does. It costs the player nothing in readability (night is dimmed to a floor, never black).

**Next, if you pick it up:** lit windows and Town Center braziers that glow as the evening comes (the bloom is there, the buildings' windows don't change yet); stars and a moon disc in the sky shader; owls and fireflies for the birds' place at night; a night-sight rule (units see less in the dark) would be a sim change and a real design call; a lobby option to fix the hour or turn the cycle off. Seen in headless Chromium on the title screen only, at 07, 12, 17:30, 19:12, 21 and 02: warm long shadows at dusk, noticeably darker at night. In a real match, and the sound of it (nothing yet), unverified.

### Moonlit nights (own pitch, lane look), 2026-10-14

**Built:** `moonPhase(seed)` in `daylight.ts` gives each match a phase; a full moon keeps the night light, a thin crescent takes up to 40% off it. Lakes glint with star pin-pricks at night (`uStars` in `water.ts`), hidden by cloud and rain. Render only; no rules, save or `data.ts` change.

**Why I love it:** nights now differ from match to match, and the lakes are the one place the strategy camera can see the sky's stars.

**Learned:** the camera (38° FOV, pitch 46-66° down) never shows the sky dome, so a starfield or moon disc in `sky.ts` would be invisible; I tried it and dropped it. If a tilted camera or a screenshot mode ever lifts the view, the shader is the place. **Next:** lit windows and braziers at dusk, fireflies at night. Seen in headless Chromium at night in a match (the light, no lake in view); the lake glints are unverified.


### Lit windows (own pitch, lane look), 2026-10-14

**Built:** one `uGlow` uniform (`materials.ts`) scales every glowing part (windows, torches, lanterns); `view.ts` sets it from the hour: the old strength by day, near double at night, a little more under grey weather. Render only.

**Why:** the windows were already modelled glowing; they just never *meant* anything. Now a town reads as lived-in at dusk and enemy camps show in the dark. **Next:** fireflies at night near water and forest; braziers that flicker. Unverified in a browser (checked only typecheck and tests).


## Designers' notes: Age of Reclaimers (2026-10-14, Codex, #94)

I love the moment when exploration changes a civilization rather than only filling its treasury. A completed excavation now reveals a people who put yesterday's knowledge to work: faster building and repair, cheaper research, slower military training. The Middle Ages window spreads the web into another tier and gives opponents time to scout and punish a rebuilding town. Its armies still use the ordinary counters; there is no secret super-unit.

Ruin ownership is already saved, so the discovery needs no extra tally, and the existing computer excavation and forward-road chooser can use it. Next I'd explore contested restoration projects that stay useful on the map after the dig, with benefits an opponent can interrupt. The synthesized theme and salvaged-column models still want the owner's eyes and ears; Chromium is absent in this container.

## Designers' notes: the Age of Sail (own pitch, 2026-10-14, session claude/upbeat-babbage-5uz2fx)

Built: a fifth side age, a *turn* off the Middle Ages for a people of the coast. A Dock is the clue and 500 fish landed by boats (`PlayerStats.fished`, counted where fish are gathered in `units.ts`) is the deed. While it lasts, boats fish half again as fast, every ship costs a quarter less and has a quarter more hull, and farms yield 15% less (numbers in `AGES.sail`, roads `middle→sail`, `sail→gunpowder`, `sail→middle` in `data.ts`). It dresses docks, houses, Town Centers, Markets and the Wonder with masts, sails and drying nets (`DRESSED_AGES`, beside `LOOK_AGES`, so the existing look test stays as written), puffs sea-spray at the Dock, has its own lute-and-flute theme and a teal minimap blip, and a tip tells a Middle Ages town with a Dock that the road exists.
Why I love it: the web had trade and faith, but the navy and the fishing fleet, half the game, had no road of their own. Now a player who lives on a lake coast has a reason to build boats before they need them, and a rival can read a sea people by its masts and starve it by raiding its fields, since it gives up farms.
Connects to: fishing, docks, warships and transports; the Pilgrim road also leaves from the Middle Ages, so a people must choose.
Not done / next: the computer never takes this road (lane ai); the Wonder's and units' sea dress; a sea trade (traders by ship between Markets on the coast) would be the natural second half; the numbers are untried, so the first thing to watch is whether ×1.5 fishing plus cheaper ships makes naval rushes too cheap. I could not play it in a browser.

## Designers' notes: harbor trade (own pitch, 2026-10-14, chain 1014-1400 s1)

Built: in the Age of Sail a Market with a finished Dock within `TRADE.harbor.reach` (12 tiles) pays 30% more per trade trip (`tripGold`). Why: it ties the sea road to the trade economy, and asks where you put the Market. Next: real sea trade, a trade cog sailing between coastal Markets and coastal trading posts; the computer taking the Sail road (lane ai, #79).

## Designers' notes: fireflies (own pitch, 2026-10-14, chain 1014-1340 s3)

Built: `src/render/fireflies.ts`, a swarm of 260 blinking points in a box that follows the camera, shown on clear nights only (`l.moon`), additive green-gold. Why I love it: the night had stars on the lakes and lit windows, but the ground itself was empty; now a quiet camp feels alive. Next: flickering braziers and torches (a light that flutters), fireflies thicker near water and forest, bats at dusk. Render only; no rules or save change.


## Designers' notes: Tactical Reach (2026-10-14, Codex, #101)

I love the moment a defensive layout becomes readable: two towers covering a gap, or a catapult with room behind its escorts. Alt now draws selected weapons' reach, and placing a defense shows its future coverage. Cyan outer lines and dashed amber siege dead zones follow the ground and stop at fog. These are reference distances to a target's near edge, not a guarantee of a legal shot. No new rules or balance numbers; the computer already fights with the same stats. Next I would explore a similarly restrained view of repair or healing coverage, without turning the battlefield into a permanent diagram. Appearance remains unverified here because Chromium is unavailable.

## Designers' notes: sea trade (own pitch, 2026-10-14, chain 1014-1400 s2)

Built: a Dock trains merchant ships (`cog`) that sail to ports, trading posts with water within `TRADE.sea.reach`, and pay `TRADE.sea.mul` over the land road; Normal and Hard computers keep one or two sailing. Why: the harbor bonus now has a ship to go with it, and warships have a prey other than armies. Next: ports on sea maps (no post is one there today), a computer raid on sea lanes, a Lighthouse that widens a port.

## Designers' notes: ports on the Inland Sea (own pitch, 2026-10-14, chain 1014-1400 s3)

Built: on the sea map trading posts are placed on the shore (open water within `TRADE.sea.reach`-1 tiles), not at the map edge, so every post is a port (0 of 24 were before; other maps unchanged). Why: sea trade had no ports on the one map made of water. Changes sea-map worlds for a given seed (older sea replays may differ). Next: raids on sea lanes, a Lighthouse that widens a port. Not played in a browser.

## Designers' notes: bats at dusk (own pitch, 2026-10-14, chain 1014-1340 s5)

Built: `src/render/bats.ts`, 28 dark flitting points in a box around the camera, each drawn as a wing-beating chevron; they fade in where the light turns (dusk and dawn, from `l.moon`), clear weather only, off on Low quality. Why I love it: the evening now has a short, living hour between the fireflies and the day. Next: bats roosting out of ruins, owls, a bat swarm leaving a cave tile. Render only; no rules or save change.

## Designers' notes: flickering lights (own pitch, 2026-10-14, chain 1014-1340 s4)

Built: in `src/render/materials.ts` the glow of warm-coloured parts is dimmed by two beating sines, phase from the instance's position, so no two torches or windows pulse together. Why I love it: lit windows made towns read at dusk; flutter makes the light feel like fire. Next: bats at dusk, smoke thicker at night, a stronger flutter for torches than for windows (needs a baked flag). Render only.

**Owls** (lane look, 2026-10-14): `src/render/owls.ts`, seven pale owls on slow wide circuits in the dead of a clear night (they come in after the bats leave, when the moon level passes about 0.55), plus an `owl` hoot every 18–48 s of deep night, panned at random. Why I love it: the night now has a second creature and a sound, and the bats, then fireflies, then owls give the evening a sequence. Next: owls roosting on ruins, bats pouring from a cave tile, an owl that perches on a watchtower. Render and audio only; no rules or save change. Hoot level unheard.

## Designers' notes: gulls (own pitch, 2026-10-14, chain 1014-1400 s6)

Built: a `gull` sound (two rising, nasal mews) cued every 9–25 s by day while open water lies near the view's centre (`nearWater` in `view.ts`), clear weather only. Why: the night has fireflies, bats and owls; the day at the coast had nothing to hear. Next: gull silhouettes over docks and fishing boats, gulls mobbing a harvested fish haul. Render and audio only; no rules or save change. Level unheard.
## Designers' notes: bat roosts (own pitch, 2026-10-14, chain 1014-1340 s7)

Built: `src/render/roosts.ts`, seven bats wheeling around each of the ten nearest standing ruins the viewer has seen (`RuinsView.standingAt`), on the bats' dusk-and-dawn light, clear weather, off on Low quality; a dug-out ruin goes quiet. Why I love it: the ruins were a gamble you read only up close; now the evening tells you where they are. Next: owls perched on ruins and watchtowers, a swarm pouring from a cave tile. Render only; no rules or save change. Not seen in a browser.

## Designers' notes: owl perches (own pitch, 2026-10-14, chain 1014-1340 s8)

Built: `src/render/perches.ts`, one owl sitting on each of the six nearest standing ruins the viewer has seen, in the dead of a clear night (the flying owls' light, `Owls.level`), ear tufts up, eyes that blink shut every few seconds on each owl's own beat; a dug-out ruin goes quiet, off on Low quality. Why I love it: bats mark the ruins at dusk, and now an owl keeps watch over them in the dead of night. Next: an owl on a watchtower, a swarm pouring from a cave tile. Render only; no rules or save change. Shader not seen in a browser.


## Designers' notes: crickets (own pitch, 2026-10-14, chain 1014-1400 s7)

Built: a `cricket` sound (two quick runs of thin pulses) cued every 5–14 s on a clear night while no open water lies near the view, so the shore keeps its gulls by day and the meadow its crickets by night. Why: the night had owls to see and hear but no ground-level hum. Next: crickets hushing when an army marches close, frogs at the lake edge. Audio only; no rules or save change. Level unheard.
## Designers' notes: walking the web without losing the war (2026-10-14, chain 1014-0320 session 3, #79)

Built: the computer prepares for a side road without starving its war. It surveys once its town has 22 citizens, digs with twice the crew while its Town Center waits on the iron deed, sends its diggers back to work once the deed is dug (they used to walk from bog to bog all Stone Age), raises the merchants' early Market only when its army isn't owed soldiers, and an Iron Age army without horses answers massed archers with its own bows (`releaseDiggers`, `bestAllowed`, `AI_WEB.survey`). Why I care: a side road should be a threat you have to read, not a handicap the computer pays for being clever. Over 144 duels against a computer kept to the trunk, the walker went from 25–38 to 27–30, and the gathering it gives up fell from about 12% to about 5%; on today's merged build it wins the issue's 48 duels 11–8 (`docs/log/2026-10-14-1400-web-strength.md`).
Next (#113): Greek walkers still gather a quarter less than their trunk twins, mostly on the iron road against archers: try the Step Back (Z) for an Iron people facing massed archers, which the README already offers players. And the army-first rule traps any computer that loses its first battle in its age, walker or not; a beaten town might advance once its wave is clearly out of reach.


## Designers' notes: Age of Aeronauts (2026-10-14, Codex, #121)

I wanted a future age with a specific commitment: a civilization reorganizing around aviation, rather than every weapon becoming stronger. Cheap, quickly replaced aircraft connect the airfield to the economy; dearer land soldiers make defending that infrastructure a choice. The Industrial combat numbers stay, so existing anti-air still matters. Sky blue navigation bands, rooftop windsocks and a rising Lydian theme give the towns their own identity. Next I would explore aerial scouting and exposed logistics before adding another damage tier.

## Designers' notes: a beaten computer doesn't freeze (2026-10-14, chain 1014-0320 session 4, #113)

Built: once its first wave has gone out, a computer waits at most `armyWait` (90 s) in an age to raise the next wave before it climbs anyway; its town bell comes down when two or fewer enemies are left instead of none; a side road's deed three-quarters done earns twice the patience. Why I care: the most common match I watched was decided at minute 8 and then played out for twenty more minutes with the loser frozen in its age, half its people inside the Town Center. Beating the computer's first wave should open a fight, not end one. Over 288 duels, sides stuck ten minutes or more in one age fell by a third, at no cost in strength against its own old play (`scripts/ai-ab.ts`, new, and `docs/log/2026-10-14-1730-beaten-town.md`). The Greek gap in #113 turned out to be mostly noise: Greek walkers gather within 5% of their trunk twins on `main` and on this branch.
Next: a beaten town could wall or tower its gates while it climbs (it has the stone); the bell could come down by the Town Center's own reckoning (arrows it can shoot against the soldiers left) rather than a count; `ai-ab` could take a list of seeds and run them side by side itself.

Built: a `frog` sound (a throaty croak and a quick answering ribbit) cued every 4–12 s on a clear night while open water lies near the view: the shore's night voice, where crickets keep the dry meadow. Why: the lakes had stars on them but no sound. Next: frogs hushing when an army marches close, a splash when a unit wades. Audio only; no rules or save change. Level unheard.

### Ages reached (own pitch), 2026-10-14

**Built:** the end-of-match table's Epoch cell now has a tooltip with the minute each player reached each age, from the history the timeline already keeps (`src/ui/endReport.ts`). **Why:** the timeline dots show it, but only if you hover the right dot; a pace comparison should be one glance. **Next:** a "turning points" strip (first wonder, first lost town) would need the rules to record events.

**Hushed nights** (own pitch, lane look, chain 1014-0320 s7): crickets and frogs fall silent while five or more soldiers (infantry, ranged, cavalry, siege) stand within 12 tiles of the view's centre and in sight (`armyNear` in `view.ts`). Why: the night's small voices now answer to the war; a quiet field means something is marching. Next: a splash when a unit wades, owls shy of battle. Audio only; no rules or save change. Not heard or seen in a browser.

**Birdsong (2026-10-14, Chain 1014-0320, session 8).** Built: a `birdsong` cue by day inland, the dry-land twin of the gull (`view.ts`, `sound.ts`); quiet near water and armies. Why: the day inland had nothing to hear while the night had crickets. Next: dawn chorus louder, silence when a battle is on. Audio only; level unheard, not played in a browser.

### Great works (seed #133), 2026-10-14

**Built:** each people can call one great work once per epoch (from the Bronze Age): free, 90 seconds, from the Town Center (**W**). Numbers are `WORKS` and `WORK` in `src/sim/data.ts`; it rides the same `add`/`mul` levers as technologies, so rules, stats panel and cache all just work. Player fields `works`, `workEnd` are optional, so no save bump. Why I love it: the one decision, *when*, is the whole mechanic, and each people's call is a real history (the Nile's flood, the yam relay, the Grand Canal) rather than a number bonus. The computer calls farming and trading works while busy and fighting works when a wave marches or a raid arrives. Not seen in a browser; unit-tested, headless match run.
**Next:** a second flavour per side age (a pilgrim people calls something else), a map effect (Roman roads showing on the ground, a flood tint on the fields), a visible banner over the Town Center while it lasts, and the Mongol work really widening sight.

### Great work glow (#141), 2026-10-14

**Built:** while a great work runs, motes in the people's colors (the Nile's blue and gold, Rome's red and gold, the steppe's green) rise from each of its Town Centers (`WORK_GLOW` in `src/render/view.ts`). Why I love it: a rival's work is a window to strike or brace in, and now you can read it from the map without a toast. Render only. Not seen in a browser.
**Next:** a flood tint on the Egyptian fields, Roman roads drawn on the ground, the Mongol work really widening sight.

### Yam Relay sight (own pitch), 2026-10-14

**Built:** the Mongol great work now also lifts mounted soldiers' sight by 3 tiles (`riderSight` mod, `WORKS.mongols`), so the relay is a window to scout as well as to ride. Why I love it: the steppe's work was only speed; now it reveals a rival's town as your horse archers sweep past. Rules only, no save bump. Not seen in a browser; `tests/yam-sight.test.ts`.
**Next:** a flood tint on the Egyptian fields, Roman roads drawn on the ground.

## Designers' notes: borders (2026-10-14, chain 1014-2045 s3, step 1 of seed #132)

Built: every finished Town Center, Tower, Wonder, Dock and Airfield claims land (`BORDERS` in `data.ts`, `src/sim/borders.ts`); each tile goes to the nearest claimant; coloured lines mark the edges over explored ground, **O** toggles. Why I love it: you can finally read a town as a *place*, and see where a rival's reach meets yours. Next: attrition for armies deep in foreign land (step 2), building only in your own land, then the computer reading borders. Not seen in a real match by eye: only the headless smoke run (no errors).

## Designers' notes: raid depth (2026-10-14, chain 1014-2045 s5, step 4 of seed #132)

Built: the computer pulls a worn wave back from deep enemy land (`wornDeep`, `AI_RAID`) so attrition no longer bleeds it dry. Why I love it: borders now bite both ways, and the computer feels the pressure you do. Next: building only in your own land (step 3), and the computer raising a forward Tower as a foothold. Untuned: no win-rate sweep was run.

## Designers' notes: waymarks (2026-10-14, chain 1014-2155 s1, seed #152)

Built: the minimap shows ruins and relics as last seen (`src/ui/waymarks.ts`), not the live truth under fog; a dug ruin is struck through in its digger's colour. Why I love it: a scout's second trip now buys something, and a raider can read which ruins a rival has emptied. Next: share the memory across a team and let the computer read it (needs sim state and a save bump), and a river-ford and bog-iron mark. Browser appearance unseen.
### Wind (#150, own pitch), 2026-10-14

**Built:** each match has a wind from its seed, one of eight directions and a speed that a storm raises and mist lowers (`windFor` in `src/render/weather.ts`); smoke and dust in `Effects` settle at the wind's pace, sparks are left alone. **Why I love it:** smoke always rose straight, so every town looked becalmed; now a burning town bends downwind and the whole land shares one sky. **Next:** rain and snow slanting with it, banners, sails and the windsock on the airfield turning to it, and a wind rose on the minimap for archers' range. Render only. Not seen by eye.

### Wind, part two: rain and snow lean (#150), 2026-10-14, chain 1014-2158 session 1

**Built:** `Weather.setWind` feeds the day's wind into the rain and snow shaders: rain streaks slant and drift at 7 times the smoke's pace, snow flakes at 3 times (`RAIN_LEAN`, `SNOW_LEAN`). **Why I love it:** a storm now visibly blows one way, the same way the chimney smoke leans. **Next:** banners, sails and the airfield windsock turning to `windFor`; the sway of trees. Seen in headless Chromium on the title screen only (`?weather=rain`, `?weather=snow`: no errors); how the slant looks in a match is unseen.

## Designers' notes: the computer turns sailor (own pitch, 2026-10-14, lane ai)

**Built:** a clever computer with a finished Dock takes the Middle Ages → Age of Sail road once its boats have landed the 500 fish (`turnRoad` in `src/sim/ai.ts`), if its people's coin-toss (`wants`, `AI_WEB.take`) says so, and comes ashore if its last Dock falls. No number or save change. **Why I love it:** the sea road was only for people; now a rival can quietly become a sea power. **Seen:** headless `web-walk` (6 seeds, small, 25 min): Sail@13m, @13m, @11m on three seeds, then on to Gunpowder; `tests/ai-sail.test.ts`. No win-rate comparison made. **Next:** the sailor building warships and docks more on purpose, and raiding the coast.

## Designers' notes: flags in the wind (#150, 2026-10-14, chain 1014-2158 s2)

**Built:** building banners and the airfield windsock stream downwind and ripple, harder in a storm, hanging limp when it's calm. A vertex-shader tag (`Kit.cloth`, `aRig.x = 4`, `flag` in `inject`) bends cloth by the shared `windUniform`, so draws stay instanced/baked. **Why I love it:** the same wind that leans smoke and rain now reads on every town. **Next:** ship sails and unit pennants (they turn, so need their heading), the aeronaut windsock (runs along x). Seen: `browser-smoke` passes with no console errors; how it looks in a match is unseen.
## Designers' notes: the sailor's fleet (own pitch, 2026-10-14, chain 1014-2155 s3, lane ai)

**Built:** a clever computer in the Age of Sail keeps two warships even on a map with no enemy ships, and counts rival merchant ships (`cog`) as prey, so its raiding fleet answers your sea trade. **Why I love it:** the sea road made ships cheap and sturdy, and until now the computer ignored that; a trade-by-water rival now has teeth. **Seen:** `tests/ai-sail.test.ts` (fails without the change). No win-rate comparison. **Next:** escorting its own cogs, and raiding the coast with transports.

## Designers' notes: watch a live match (seed #134, chain 1014-2155 s4, lane online)

**Built:** a watcher joins a started room (`?watch=1`), gets the start, the catch-up and every turn, and the Worker ignores everything but their pings (`watchers` in `worker/room.ts`, apart from `conns`, so a watcher can never act on a seat). The client shows the whole map or any player's eyes, and sends nothing. **Why I love it:** you learn an opening by watching a friend play it. **Seen:** `tests/room-watch.test.ts` (refusal before the start, catch-up, no commands/pause/chat/hash, no seat, cap of 8). The browser side (Watch button, bar, banner) is unseen. **Next:** a "watch" link beside the room link, a watcher count, and a delay so a watcher can't relay a live view to a player.

**Pennants in the wind** (own pitch, lane look): ship masts carry a small team pennant and riders' and siege engines' pole banners flutter, streaming downwind through the same cloth shader as building banners (`pennant` in `src/render/unitModels.ts`; `unitMaterial` gained `flag`). **Why I love it:** a fleet at anchor now shows which way the day blows. **Next:** billowing square sails, which want a different bend than cloth along z. Render only, no save change. Seen: `browser-smoke` passes with no console errors; how it looks in a match is unseen.

## Designers' notes: answering the flame (own pitch, 2026-10-14, chain 1014-2155 s8, lane ai)

**Built:** a clever computer that sees a rival's beacon burning within `AI_RAID.flame` (24) tiles of one of its Towers lights that Tower's own, so a flame you light to warn your town now draws a reply from a watchful neighbour. **Why I love it:** the beacon's trade-off (warning for exposure) now has a cost you can read in play: a rival that sees your fire stirs. **Seen:** `tests/beacon.test.ts` (one test fails without the change, one checks the range). No win-rate sweep. **Next:** reading the flame to move a wave toward or away from it; a beacon relay for the computer's own chain.

### The Rallying Cry (own pitch), 2026-10-14

**Built:** the hero's aura was always on and never a decision. Now R is a shout: soldiers within 8 tiles hit 30% harder, take 1 less damage and are mended for 12 seconds, then 70 seconds of rest. Clever computers call it when the lines meet.
**Why I love it:** it gives the hero a moment to time, and a reason to keep him alive and in the middle of the line (the AI cry keys on four soldiers beside him).
**Next:** a visible ring and banner flash on the stirred soldiers (look lane), a per-people cry (Greek phalanx brace, Mongol charge speed), and a rival's war horn showing on the minimap.

## Designers' notes: the wild (#171, 2026-10-14, session zen-mayer, lane rules)

**Built:** mammoths and wolf packs (`MAMMOTH`, `WOLF`, `AI_WILD` in `data.ts`; `src/sim/animals.ts`, `placeWild` in `mapgen.ts`). A mammoth for every town, the same distance out, turns on its hunters and charges; wolf dens sit between the towns, by wild gold where there is some, and the pack falls on anyone near and chases only so far. Bitten people fight back and return to work; soldiers can hunt any beast. The computer sends five after its mammoth once it has ten citizens, and clears dens near home with idle soldiers. Models (a round, shaggy mammoth whose head lunges to gore; lean grey wolves), a trumpet, a howl and a snarl, minimap marks, tips and a "Wolves are attacking your people!" warning.
**Why I love it:** the owner said the Stone Age felt like "a mechanical race", a build order with nothing to decide. The first minutes of the games this follows are remembered for the map: the boar that killed a villager, the wolves in the fog. Now the opening has questions with no single answer: take the mammoth now with five people off the berries, or later with clubmen? Send soldiers to clear the den by the far gold, or wait? Scout carefully, because the wild bites.
**Seen:** `tests/wild.test.ts` (map fairness, the hunt, the pack, the leash, fighting back, the computer's party); headless matches in `scripts/wild-watch.ts` (the computer fells its mammoth at 74–111 s and loses 0–2 people to beasts a match); screenshots in headless Chromium of the mammoth, a hunt and a pack running at a citizen. Not played by hand; sound levels unheard; no win-rate sweep.
**Next:** more of a living Stone Age. Boars (a small, fierce hunt near home), herds that migrate across the map over the match, a predator that hunts the deer, the wild thinning as towns grow (borders could push it out), and a campaign chapter built on a great hunt.

