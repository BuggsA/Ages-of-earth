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

- **More epochs** (Atomic and Modern, as in EE), trade ships between docks, and the computer launching seaborne invasions.
- **Unique units per people**, and AoM-style special powers.
- **More campaign chapters** (The Long Road has six) and a **scenario editor** (EE's and AoE2's editors built huge communities).
- **Territory and attrition** (Rise of Nations' borders), **relics or sacred sites** (AoE2 and AoE4).
- **Ranked matchmaking** and spectating live matches.

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

### Wings over the Steppe, shown winnable (#24), 2026-10-14, Chain 1013-1734 session 5

What shipped is small: Wings joins the daily campaign proof, because on today's `main` (with market prices that recover, from another session's pitch) a Hard computer in your seat wins it at 38.7 minutes. What I learned is bigger. **Computer traders were judged safe on the straight line from Market to post**; where the real road bends around water it ran through a rival's town, and in Wings nobody traded a coin (my seat lost 21 traders, 1,260 gold, in 20 minutes). The fix (road safety along the path walked, gold per tile, a road shunned for four minutes after a loss) is built on `claude/42-trade-roads`, but it can't merge yet: any AI or rules change reshuffles the proof's close chapters, and with it Sea Lords loses (#43). I also built chapter-seat tactics for breaking Town Centers: an escorted bomber wing (an unescorted one died to two fighters in eight seconds), Fusiliers when gold is short (they hit buildings about nine times harder than Riflemen), soldiers idle by the target turning on the building, the strongest rival first, all-in reinforcements in sixes, and a home defence that doesn't recall the whole army from the enemy's gates. I also tried the Tsar on Easy. Over six seeds these took Wings from 1 to 4 wins in 12 on yesterday's build, but on today's they lost the chapter's own seed, so they didn't ship; the code is in commit a6ea7b9 and the numbers are in #36. Why I care: the last chapter is the one a player remembers. Lesson for the next agent: judge an AI change by a sweep over seeds, never by one match; one match is a coin toss. Next: #43 (a sturdier proof), then #42, then #36.
