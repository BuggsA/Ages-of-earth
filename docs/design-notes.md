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

## Richness: choices, not a checklist (the owner, 2026-10-14)

The owner played and said: "When I play I enter the stone age and it feels mechanical. Almost like designated steps. … I don't feel it's richness. Almost like a mechanical race." They hope agents build on this (`docs/rulings.md`).

**What it asks for.** A good opening has no single right order. At every stage the player should face choices whose answer depends on their map, their rival and their nerve, not just "train citizens, build houses, age up" a little faster than the other side.

**A test for any feature:** does it give the player a decision they could get wrong? Would two good players do it differently? Does it change from match to match? Ambience (sounds, lights, weather) makes the world beautiful but doesn't answer this. Pair it with something to decide.

**Where richness comes from:**
- **A map that pushes back and differs every time:** beasts that fight (#171: mammoths, wolves), dangers and prizes in the fog, resources worth a risk.
- **Trade-offs with no free answer:** greed vs safety, boom vs rush, a side road vs the trunk, a feast now vs a safe hunt later.
- **Reasons to fight early:** contested spots, raids worth making, scouting that pays.
- **Surprises the player answers:** events, discoveries and rival moves that break the script.
- **The computer playing the same game,** so the choices matter against it too.

**Built toward it so far:** the wild (#171); meat that spoils and Drying Racks; wolves drawn to carrion; the Hunting Camp and Hounds; contested landmarks (#182: a spring, a crag and a cairn to fight over from the first minutes). Ideas still open: boars near home, migrating herds, predators that hunt deer, the wild thinning as borders grow, Stone Age choices of custom or tradition. Add yours below in your Designers' notes, and say how your feature makes play richer.

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


## Designers' notes: boars (2026-10-15, session chain 1014-2358 #1, lane rules)

**Built:** a wild boar (`BOAR` in `data.ts`, `animals.ts`, `placeWild`) guarding a berry patch 7–15 tiles from each town. It charges anyone within 3.2 tiles and gives up past 7 tiles of its patch; leaves 260 food. Model, snarl, minimap mark, tip, warning toast, and the computer sends three citizens once it has six.
**Why I love it:** the owner called the Stone Age mechanical. Berries were free food; now the second patch has a guard, so the build order asks something: spear it with three (losing gathering time, maybe a citizen), or skip the patch? It connects to the leash too: you can pull a boar off its patch and run.
**Seen:** `tests/boar.test.ts`; `models.test.ts`; a headless match. Not seen in a browser; sound reuses the wolf's snarl; no win-rate sweep (map seeds shift: wolves and mammoths moved on some maps because placement shares a dice).
**Next:** herds that migrate, wolves that hunt deer, the wild thinning as borders grow; a boar that roots up unguarded berries.

## Designers' notes: drifting herds (2026-10-15, Chain 1014-2358, session 2)

**Built:** deer herds migrate (`DEER.every/min/max/range` in `data.ts`, `drift` in `src/sim/animals.ts`): each herd moves to fresh ground every 150 s, never onto land inside a border and never too far from where it began; deer that start together move as one, from an integer hash (deterministic). Wolves (`WOLF.hunt`) run down deer grazing near their den and leave the carcass, and the herd bolts as the pack closes.
**Why I love it:** the owner said the Stone Age felt mechanical. The meat by your first town now runs out as your borders grow, so a hunting camp is a bet on where the herd goes next, and a carcass beside a den is a dare. It touches borders, wolves and the computer's hunting (it already hunts the nearest deer, so it follows without new code).
**Seen:** `tests/herds.test.ts` and a headless match; not in a browser, not played by hand; no win-rate sweep. No save bump (new fields are optional; old deer are each their own herd).
**Next:** a lookout/scout that reads herd tracks on the minimap; seasons that also move berries' yield; mammoths that migrate too; the computer building a forward camp by the herd.


## Designers' notes: meat spoils (own pitch, 2026-10-15, Chain 1014-2358, session 3)

**Built:** carcasses rot (`ROT` in `data.ts`, `rot` in `animals.ts`, `GameState.carcasses`). A kill keeps 40 s, then loses 1/160 of its size every second (a mammoth about 4 food/s, gone in 2½ minutes). New Stone Age tech **Drying Racks** (Town Center, 60 food 60 wood, `rot` ×0.25) slows it on land inside your borders; the clever computer buys them once a boar or mammoth is down. The selection panel says "(spoiling)", and a tip explains it.
**Why I love it:** the wild gave the opening questions, but a felled mammoth was a free 600 food whenever you got round to it. Now the kill is a clock: how many hands, how far from the Town Center, and are racks worth a Stone Age tech slot before the hunt? It ties into borders (kills inside your land keep) and herds (follow the herd out and the meat rots before you carry it).
**Seen:** `tests/rot.test.ts` (grace, full rot, small carcass, racks, determinism); a headless match. Not in a browser, not played by hand; no win-rate sweep. No save bump (the list is optional; old carcasses never rot).
**Next:** a Hunting Camp drop-off near the herd; scavengers (wolves, later crows) drawn to old kills; carcass tint going green as it spoils; the computer sending bigger parties for far kills.

## Designers' notes: carrion (own pitch, 2026-10-15, Chain 1014-2358, session 4)

**Built:** a wolf pack within `WOLF.scent` (15) tiles of its den scents a carcass that has begun to turn (past `ROT.grace`) on land nobody holds, runs to it and eats `WOLF.gnaw` (3) food a second a wolf (`scav` on `Animal`, `scentCarrion`/`scavenge` in `animals.ts`). The pack's notice and leash centre on the carcass while it feeds, so butchers are bitten even beyond the den's own leash. Meat inside a border is never scented. The tip about spoiling mentions it.
**Why I love it:** meat now has two clocks: the rot, and the dens. A far mammoth is worth more and risks more; kill it near a den and you must butcher fast, bring a few spears, or clear the pack first (the old wolf-clearing choice now pays in food). It ties into borders (home meat is safe, so a Town Center's reach shields hunting), wolves, and Drying Racks (racks can't save meat off your land).
**Seen:** `tests/carrion.test.ts` (fresh meat unscented, a pack eats faster than rot, eats it all and goes home, border meat safe, out of scent range, bites butchers, determinism); `tests/rot.test.ts`, `herds.test.ts`, `wild.test.ts` unchanged and green; a headless match. Not in a browser, not played by hand; no win-rate sweep. No save bump (`scav` is optional).
**Next:** crows or vultures circling old kills (look lane: a visible tell that a carcass is turning); a Hunting Camp; the computer posting a guard at a far kill or killing the den first; wolves fighting a rival for meat.

## Designers' notes: the Hunting Camp (own pitch, 2026-10-15, Chain 1014-2358, session 5)

**Built:** `huntcamp` (45 wood, Stone Age, hotkey N, 2×2, frail): takes in food and holds a 4-tile border (`BORDERS.huntcamp`). It may go anywhere not inside a rival's land, so it is the first way to claim ground out by the herd. The clever computer raises one by a kill of 150+ food that lies 9+ tiles from any food drop and within 24 of home (`AI_WILD.camp*`), once it has 12 citizens and 120 wood. Model, tip, README line.
**Why I love it:** the wild gave the opening its questions and rot and carrion gave the hunt its clocks, but the answer to all of them was still "walk it home". A camp is the answer that costs something: wood, a builder's minutes, and a frail building out in the open. It ties together borders (meat inside is safe from wolves), Drying Racks (they now work out by the herd), herds (follow them with a camp, or let it strand) and attrition (a small supplied foothold).
**Seen:** `tests/huntcamp.test.ts` (food-only drop, claim only once built, wolves leave meat in its land, the computer builds one); the full quick tier; a headless match. Not in a browser, not played by hand; no win-rate sweep. No save bump (a new building type only).
**Next:** hunters at a camp gather meat faster, or the camp trains nothing but sells jerky for gold; wolves that gnaw a frail camp; a camp that dissolves when its herd leaves.

## Designers' notes: Hounds (own pitch, 2026-10-15, Chain 1014-2358, session 6)

**Built:** `hounds`, a Stone Age tech at the Hunting Camp (80 food, 40 wood): `hunt` x1.25 and a new mod `beastWard` x0.5 on the damage wolves, boars and mammoths do (`maul` in `animals.ts`). The clever computer buys it once big game is down and it has a camp.
**Why I love it:** the camp gave the wild a place to be fought from; hounds give it something to research. Spend food and wood on a safer, faster hunt (the mammoth party loses fewer people), or on the next age. It ties into the camp, boars, mammoths, wolf dens and Drying Racks (two hunt techs, two clocks).
**Seen:** `tests/hounds.test.ts` (a wolf's first bite halves; mods); the full quick tier. Not in a browser, not played by hand; no win-rate sweep. No save bump (new tech id only).
**Next:** a hound that walks beside a hunter as a small unit; hounds that bark at an approaching pack (a warning); wolves that fear a camp with hounds.

## Designers' notes: seasons (own pitch, 2026-10-15, Chain 1014-2358, session 7)

**Built:** a year of four seasons of `SEASON.len` (150) seconds, starting in spring (`SEASONS`, `src/sim/seasons.ts`; derived from the tick, no state). Summer: berries +25%, fields +10%, meat rots 1.5×. Winter: berries ×0.55, fields ×0.75, meat rots at half speed, wolves and boars notice from 40% further. A clock icon with the season, a toast at each turn, a tip.
**Why I love it:** the Stone Age still had one best answer in every minute. Now the answer changes with the clock: forage while it's warm, hunt and dry meat before the first winter (7½ min), and expect the pack at your door when it comes. It ties into rot, Drying Racks, Hunting Camps, wolves, farms (a reason to get them), and Hounds. Spring start so the opening is never punished, and no seed offset so tests and campaigns stay put.
**Seen:** `tests/seasons.test.ts` (turn order, one event a turn, winter meat keeps); `npm run check`. Not in a browser; no win-rate sweep (all computers lose and gain the same, but their economies feel winter's berry cut); no save bump.
**Next:** the computer planning for winter (hunt, build racks and farms in autumn); deer migrating south in winter; snow and bare trees tied to the season (look lane); a winter hardship on idle housing; a mid-campaign chapter set in the cold.

## Designers' notes: planning for winter (own pitch, 2026-10-15, Chain 1014-2358, session 8)

**Built:** from autumn (`AI_WINTER.from`) a clever computer counts no berries and wants `fields` more fields, weights food `food` (30%) higher in its job shares, hunts mammoths and boars with `hunters` (3) fewer citizens, and in winter clears wolves with `pack` (1) fewer soldiers (`coldComing` in `ai.ts`).
**Why I love it:** seasons only matter if the rivals live in them too. Now a computer's economy visibly turns with the year, so a player can read the autumn rush (fields rising, parties out after game) and strike at a town stretched thin on food, or copy it.
**Seen:** `tests/ai-winter.test.ts` (spring identical, autumn more on food); `npm run check`. No browser, no win-rate sweep; no save bump.
**Next:** racks bought in autumn before the kill; deer wintering south; the computer sending a raid at a rival's lean winter; snow and bare trees by season (look lane).


## Designers' notes: the turning year on the land (#183, own pitch, 2026-10-15, lane look)

**Built:** the seasons seen (`src/render/seasonLook.ts`; the shader is the `season` option in `materials.ts`). One uniform carries the weights of the four seasons and the snow cover. Greens on the terrain and the swaying plants are recoloured: gold summer grass, ochre autumn, frosted winter. Broadleaf crowns (vertex colours redder than blue, high in the model) turn orange, red or gold in autumn, one colour per tree, a few late, and go bare in winter. Evergreens (bluer) only darken. Snow lies on surfaces facing up: patchy on the ground, only on the flattest tops of models so stone and ore still read, and never on team-coloured or glowing parts. It fades over the last 20 s of a season, snow settles over 45 s of winter and melts over 30 s of spring. Nothing is added to the scene, there are no new draw calls, and the rules aren't touched.
**Why I love it:** the seasons already change real choices, but you only learned about them from an icon. Now the first red leaves are a warning that winter is coming, and the snow is a reminder of why you dried that meat.
**Seen:** headless Chromium on seed 7 at noon, each season held with `?season=`, with no console errors. I looked at the screenshots: autumn trees in sight go orange, red and gold; in winter the town and rocks read through patchy snow. The fades and the melt were not watched in motion. `tests/season-look.test.ts` checks the weights and the snow timing.
**Next:** a snowy weather day in summer still drops flakes on gold grass, so tie the weather to the season (rain falls as snow in winter, no snow outside it); breath puffs or a muffled winter ambience; frozen lake edges; the minimap tinted by season.

## Designers' notes: contested landmarks (#182, own pitch, 2026-10-15, session peaceful-ramanujan)

**Built:** a Sacred Spring (heals), a Lookout Crag (sight 14) and an Ancestors' Cairn (+5 room) on the fair line between the towns, one more than there are players. Stand on one alone to claim it; a rival alone pulls it down, then takes it; contested, nothing moves. A kept landmark is land (`borderMap`), so it plugs into supply, building and the wild. The computer claims free ones with a citizen and takes back held ones with soldiers. Numbers: `LANDMARKS` and `AI_MARK` in `data.ts`.
**Why I love it:** this answers the owner's "mechanical race" directly. The first two minutes now have a decision with no free answer (a citizen walking out is a citizen not gathering), the map says which choice is worth it (a cairn saves a house, a crag shows the road their army walks), and with one more landmark than players, rivals have to meet. In the headless matches, landmarks change hands five to twenty times over 20 minutes, and that's the game I wanted: small fights over places, not one big fight at minute ten.
**Seen:** `tests/landmarks.test.ts`, `tests/landmark-models.test.ts`, headless matches on small, medium and large maps (`scripts/sim.ts` now prints who took what, when), and screenshots in headless Chromium (models, the banner, borders, the panel, minimap triangles; no console errors). Not played by hand; the horn sounds are unheard; no win-rate sweep.
**Added later (Flint Scatter, same session chain):** a fourth kind, an economic one: keeper's citizens chop and mine ×`LANDMARKS.flint.tools` (1.2) anywhere. It makes the walk out a trade-off against the cairn's houses. Seen: unit test and model test only; not played, no win-rate sweep. Still open: a ford, a sacred grove, hold-them-all mode.
**Next:** more kinds that change *what* you do rather than add numbers: a flint scatter that arms citizens, a ford that only its keeper's army can cross, a sacred grove priests convert faster in. Peoples who care about a kind (the Britons' cairn). Landmarks as a match mode: keep them all for N minutes to win, like relics. A Watch Tower that sees a landmark gets the "they're taking it" alert sooner.
**Sacred Grove (session 2, chain 1015-0151):** a grove of old trees round a mossy altar; its keeper's priests chant 1.8x as fast within 10 tiles. I love it because converting is the rarely-used lever: now a priest has a *place* to go, and the rival must decide whether to contest it. Next: the computer staging priests there, a ford, peoples who favour a kind.

**Holding landmarks** (2026-10-15, lane ai, #191). Built: the computer picks landmarks by what its town needs (a Cairn when houses are full, a Spring when people are hurt, Flint) instead of nearest only, and defends one of its own that rivals are pulling down. Why: taking a computer's landmark was free. Next: a sweep of win rates with `AI_MARK.worth` off vs on; leaving a lone citizen to be driven off versus recalling it.
## Designers' notes: weather follows the year (own pitch, 2026-10-15, lane look)

**Built:** `seasonalDay` in `src/render/weather.ts` maps the match's seeded day through the current season: snow only in winter (rain/autumn-spring, thin mist in summer otherwise), winter rain becomes a blizzard. `view.ts` re-applies it when the season turns and tells the sound. `?weather=` still forces a day.
**Why I love it:** summer grass under falling snow broke the spell the new season colours had cast.
**Seen:** unit tests for the mapping and the browser smoke test; not watched in a match.
**Next:** breath puffs or a muffled winter ambience; frozen lake edges; minimap tinted by season; a banner line when the sky changes.


## Designers' notes: the minimap wears the season (own pitch #195, 2026-10-15, lane look)

**Built:** `mapTint` and `lookFor` in `src/render/seasonLook.ts`; `Minimap.draw` recolours meadow (scaled from the old green) and woods by the season weights, with snow whitening the grass (and a little the woods) in winter. Same blend, snow timing and `?season=` as the land.
**Why I love it:** the corner of the screen now says "winter is coming" before the toast does.
**Seen:** headless Chromium, seed 7, each season held with `?season=`: autumn map ochre, winter map pale, no page errors. `tests/season-look.test.ts` checks the tints. Fades not watched in motion.
**Next:** breath puffs or a muffled winter ambience; frozen lake edges (water tinted white in deep winter).

**Landmark worth, swept** (2026-10-15, lane ai). Built: `AI_LEVELS.worthy` (on by default) so `scripts/ai-ab.ts 21 4 20 '{"worthy":false}'` compares need-based landmark choice against nearest-only. Result over 32 Hard-vs-Hard matches (seeds 21–100, seats swapped): wins 1–3, undecided ahead 17 / behind 11, gathering ×~0.94 (se ~0.1): no difference seen, so the rule stays (it costs nothing measurable and reads as sensible play). Next: the lone-citizen recall question, or a sweep with the landmarks as the deciding fight.
## Designers' notes: frozen lake edges (own pitch, 2026-10-15, Chain 1015-0203 session 3, lane look)

**Built:** `uFrost` in the water shader (`src/render/water.ts`) is the season's snow cover; ice creeps from the shallows toward the deep with a ragged noisy edge, pale cracked and dull over the waves, and leaves the deep middle open. `iceCover`/`iceReach` in `seasonLook.ts` share the reach with the minimap, which whitens water by lake depth. Melts with the snow in spring. Render and UI only.
**Why I love it:** the land froze but the lakes still shimmered; now winter reaches the shore and the open middle looks like a promise (or a danger) for ships.
**Seen:** headless Chromium with `?season=winter`, seeds 3 and 7: no console errors, shader compiles; no lake was in view, so the ice itself is unseen. `tests/season-look.test.ts` checks the cover.
**Next:** ships slowed or blocked by ice (a rules change with a save bump); breath puffs or a muffled winter ambience; a banner line when the sky changes.

## Designers' notes: a hollow winter wind (own pitch, 2026-10-15, Chain 1015-0203 session 4, lane look)

**Built:** `Sound.setSeason` (`src/audio/sound.ts`): in winter a thin bandpass wind, its pitch sweeping slowly and its strength rising and falling in gusts, fades in over a few seconds on the ambience bus; the songbirds stop, and `voiceFits` (`src/render/ambience.ts`) silences crickets, birdsong and frogs, leaving gulls at the water. `View.onSeason` tells the sound when the season turns (also under `?season=`).
**Why I love it:** you now hear winter before you read it. The woods go quiet and a cold wind comes through the quiet, just as the snow settles.
**Seen:** `tests/winter-sound.test.ts`; `npm run check`. Not heard in a browser; the wind's level and colour want an ear; no save bump.
**Next:** breath puffs on citizens in winter; ships slowed by ice (a rules change with a save bump); a banner line when the season turns; wolves howling more often in winter nights.
**Kin landmarks (session 3, chain 1015-0151):** each people has a favourite landmark kind (Egyptians Flint, Greeks Spring, Mongols Crag, Chinese Grove, Britons Cairn; Romans none, since existing tests use them as the plain people) whose bonus is half again as strong for them (`LANDMARKS.kin`, `.kinMul`). I love it because the same map reads differently to each people, and a rival's favourite is the one worth stealing. Seen: unit tests only; no win-rate sweep, the computer doesn't yet prefer its own kind. Next: the computer favouring its kind (see #191), a ford, hold-them-all mode.

## Designers' notes: iron bars (2026-10-15, chain 1015-0203 session 5, #197)

Built: in the Iron Age, bog iron pays double gold (`bogGold` mod, `AGES.iron`); a computer in the Iron Age leaves its diggers on the bog. Why I love it: the owner asked that a side age change decisions at a real cost. Until now bog iron was only a deed, forgotten once dug; now the 5-tile marsh by each town is a rich, finite mine (about 3000 gold) that a rival can raid and the keeper must guard, and it makes the Iron Age's missing horse feel like a trade. Seen: tests only; no browser, no win-rate sweep. Next: an Iron-only building (a Bloomery) that turns bog iron into armour; a second branch where iron meets merchants.
**The computer favours its kin landmark** (2026-10-15, chain 1015-0206 s3, lane ai): `AI_MARK.worth.kin` makes a Greek computer walk further for a Spring, a Mongol for a Crag. I like that the same map now sends different peoples to different hills. Unit-tested only, no sweep. Next: soldiers retaking kin landmarks first; the lone-citizen recall question is still open.

**Recalling the lone walker** (2026-10-15, chain 1015-0206 s4, lane ai): the computer's landmark walker now turns home when rival soldiers it can see come within 7 tiles of the walker itself, not only of the landmark, so a citizen no longer strolls into a raiding party on the road. Settles the open recall question. Unit-tested (fails without the change); no sweep; no save bump. Next: soldiers escorting the walker to a far landmark.

## Designers' notes: iron wares (2026-10-15, chain 1015-0203 session 6, #197)

Built: bog iron dug on any road (`stats.iron`) raises each trade trip in the Merchants, Fairs and Sail ages, +8% per 75 bars to +40% (`IRON_TRADE`, `ironTradeShare`); the Market panel shows it. Why I love it: the owner wants branches to combine. Iron is a choice made ages earlier, and it now pays out in a different economy, so a people that dug the marsh early reaches the merchants richer. Seen: unit tests only; no browser, no win-rate sweep, the computer neither digs for it nor weighs it. Next: a Bloomery that turns bars into armour; a hub where iron gates something no single age gives.
**Escorting the walker** (2026-10-15, chain 1015-0206 s5, lane ai): when the computer's landmark walker is bound for a landmark more than `AI_MARK.far` (28) tiles from home, `AI_MARK.escort` (2) idle soldiers attack-move there too, beyond a home guard of `AI_MARK.party` (3), and are held until the walk is over (`escortWalker`, `src/sim/ai.ts`). Why: the lone citizen was recalled by danger but never protected; a far Spring now arrives with spears. Unit-tested (fails without the change); one headless match; no sweep; no save bump. Next: escorts that stay to hold the landmark until it is claimed, and walkers that wait for a slow escort.

**Escort lingers** (2026-10-15, chain 1015-0206 s6, lane ai): once the walker's far landmark is the computer's, its escort stays `AI_MARK.linger` (20) seconds so a passing raider can't pull the fresh claim straight down (`escortWalker`, `src/sim/ai.ts`). Also fixes the escort outliving its walk when the same citizen was sent to a second landmark: it is now keyed to the landmark as well as the citizen. Unit-tested (fails without the change); no sweep; no save bump. Next: walkers that wait for a slow escort.

**Walker waits for its escort** (2026-10-15, chain 1015-0206 s7, lane ai): a landmark walker with an escort halts when the nearest escort trails it by more than `AI_MARK.lead` (9) tiles and sets out again once they close up (`claimWalk`, `src/sim/ai.ts`), so the citizen no longer outruns its spears. Unit-tested (fails without the change); one headless match; no sweep; no save bump. Next: the escort re-routing round a fight that holds it up, or a second escort for a landmark a rival has already marked.
**Bloomery** (2026-10-15, chain 1015-0203 s7, lane rules, #197): a Forge technology only the Iron Age can learn or use (`TECHS.bloomery`, new `Tech.only`): foot soldiers +20% health and +1 armor, so the road that gave up the horse gets a real answer to massed archers. It lapses when the people leaves the Iron Age and returns on coming back (`computeMods` in `stats.ts` skips an `only` tech elsewhere; `techProblem` says why). Why: a road should own a craft, not just a multiplier; `only` is reusable for the other side ages. The computer researches it like any forge tech. Not done: no model or sound change; browser unseen; no win-rate sweep (one match not worth it). Next: an `only` tech for each other side age; a Bloomery building that makes the bars visible.

**Side-age crafts** (2026-10-15, chain 1015-0203 s8, lane rules, #197): the `only` field now carries two more crafts: the **Ropewalk** (Dock, Age of Sail only: ships +15% health, warships +1 range) and **Letters of Credit** (Market, Age of Merchants only: technologies 15% cheaper). Both lapse on leaving the road and return on coming back. Why: each road should own a craft, so choosing Sail or Merchants is a longer commitment than one multiplier. The computer researches them in `TECH_ORDER`. Seen: unit test only; no browser, no sweep, numbers unplayed (`TECHS.ropewalk`, `.credit`). Next: crafts for Fairs, Pilgrims (after #209), Reclaimers and Aeronauts; a building that shows the craft.

## Designers' notes: faith takes the walls (#209, 2026-10-15, lane rules)

**Built:** in the Age of Pilgrims (`Mods.consecrate`, given by `AGES.pilgrim.add`), priests sent at a rival's building chant it over (`src/sim/consecrate.ts`). Every voice adds to one tally on the building (`faith`, 0 to 1, with `faithBy` and `chant`), at `CONSECRATE.rate` (15) of its full health a second per priest, times priest speed (the pilgrims' ×1.25, Theology, the Sacred Grove). A Temple is half again as hard and brings its relics when it turns. Each unit sheltering inside slows the chant (`guard` 0.35 each), and they spill out to fight when it turns. Town Centers and Wonders never turn. After a second with no one chanting, the faith fades at 5% a second. A rival people's faith is worn away before yours builds. When it turns, the training queue is refunded to the loser, the farmer, rally point and beacon are dropped, and the building is restamped so a gate opens for its new side. It keeps its share of health, and the keeper is warned once when the chant begins (a `chanting` event). A pilgrim computer keeps six priests once its army numbers six, and sends those that kept up with the army at the nearest rival tower or gate it can see, in bands of three or more (`AI_FAITH`, `chantBand` in `ai.ts`). Look and sound: gold motes rise round a building being chanted over, thicker as the faith builds; when it turns, a wide ring, a fountain of gold, the building redrawn in its new colours (the owner is now in the building view's key) and a choir chord over a deep bell (`consecrate`). HUD: "✨ 81% won over" on the building panel; the convert cursor over a building that can be won; toasts for both sides; a tip once a pilgrim people has priests.

**Why I love it:** the pilgrims' road said "walls and towers must be taken by other means", and there were none. The age was a pile of gold and cheap priests. Now it's a different war: no rams, so you walk a band of chanting priests up to a tower under its arrows, with soldiers holding off the riders that come for them, and the tower turns its bow on its old masters. It answers the owner's note in #197: a route that plays as different mechanics, not a new skin. It leans on what's already there: the counter triangle (cavalry and towers kill priests), sheltering, the Sacred Grove, Theology, relics, borders and gates.

**Numbers, untuned:** five pilgrim priests take a Middle Ages Watch Tower in about 28 s and lose three to its arrows (15 s and two lost with Theology; eight priests take 13 s and lose one). A house falls to two priests in about 29 s, or to six in 10 s.

**Seen:** headless Chromium, by driving a match through `window.ages`. At 81% the panel reads "✨ 81% won over". When it turns, the tower's banner goes from red to blue, the borders around it change colour and the ring plays. No page errors. The motes' code runs in the browser, but the headless renderer reached only 1.5 s of view time in 12 s, so they never showed on screen: unseen. The sound is unheard.

**Next:** a counter-chant (the keeper's own priests slowing a rival's faith); a pilgrim computer escorting its priest band with its army instead of just shadowing it; a Temple technology that lets a pilgrim people keep a converted building's arrows or garrison loyal; and the reverse question, whether a converted Temple should count toward the Pilgrimage deed.

Built (art pass #267): epoch 4 houses are brick terraces with a flat parapet and chimney pots, and Watch Towers iron-framed lookouts with a lamp gallery, so the machine age no longer reuses the epoch 3 silhouettes. Why: a town should read its age at a glance. Unseen in a browser. Next: epoch 4 shapes for the barracks, range and stable; a title backdrop that isn't a form over a live field.
**Next:** a pilgrim computer escorting its priest band with its army instead of just shadowing it; a Temple technology that lets a pilgrim people keep a converted building's arrows or garrison loyal; and the reverse question, whether a converted Temple should count toward the Pilgrimage deed.

## Designers' notes: counter-chant (2026-10-15, lane rules)

**Built:** the keeper's own priests, standing in the open within 7 tiles of a building being chanted over, slow the chant (`CONSECRATE.counter`: each adds 0.5 times its people's priest speed to the divisor, beside the garrison's). Two defenders halve a lone chanter; five pilgrims still beat two. Sheltering priests don't count; kill or lure them. `counterChant` in `consecrate.ts`. No save bump.

**Why:** a tower under chant had one defence, hiding soldiers inside. Now priests are a trade-off for the keeper: heal at the front or guard the walls.

**Next:** the computer parking a priest by its towers when it sees rival priests; the defenders' priests actually chanting back (wearing faith down faster than they slow it); a Temple craft for the pilgrims.

## Designers' notes: priests ward the walls (2026-10-15, lane ai)

**Built:** the computer answers counter-chant. A free priest within `AI_FAITH.ward` (30) tiles of a tower, gate or Temple a rival is chanting over walks to stand within 7 tiles of it; against a pilgrim rival, a spare priest stands by the tower/gate/Temple nearest that rival's town while none of ours does. It only takes priests that are idle, after relics and before converting/following the army.

**Why:** counter-chant was a choice only a human made; now a pilgrim player meets defenders who answer, so five priests alone no longer walk through a lone tower.

**Seen:** unit tests only (`tests/ward-priests.test.ts`); no win-rate sweep, browser unseen. **Next:** defenders' priests actively chanting back; a Temple craft for pilgrims.

## Designers' notes: chanting back (2026-10-15, lane rules)

**Built:** a pilgrim keeper's priests (in the open, within 7 tiles, not resting) don't only slow a rival's chant: they sing back, wearing its tally down by `CONSECRATE.counter.answer` (0.015) a second each, with their Litany and Grove voice. Other peoples' priests still only slow. `answerChant` in `consecrate.ts`, run from `faithStep`. No save bump.

**Why:** pilgrim vs pilgrim becomes a duel of voices: whoever has more priests near, and Litany, wins the building; a lone chanter can no longer finish a tower the keeper's priests stand by.

**Seen:** unit tests only (`tests/chant-back.test.ts`); no win-rate sweep, browser unseen. **Next:** a priest order to stand and answer; an audible answering chant.

### Standing to answer (s5, chain 1015-0406)
**Built:** right-click a chanted-over building of your own with pilgrim priests: they walk up (`CONSECRATE.counter.hold` 3 tiles), stand and sing back at `1 + counter.stand` (1.5×) the strength of a priest merely nearby, with the chant sound; the order ends when the faith is gone. **Why:** a defence you steer, not just proximity. **Seen:** `tests/chant-back.test.ts`; browser and sound unseen. **Next:** the computer ordering its priests to stand; a cursor for it.

## Designers' notes: dust of the march (own pitch, 2026-10-15, chain 1015-0406 s8, lane look)
**Built:** riders and siege engines moving fast kick a puff every ~0.3 s (`unitsView.kicks`, turned into soft bursts by `View.dust`): tan dust in clear weather, white powder under snow, nothing in rain, half in mist. **Why:** a cavalry charge across the plain should be seen from the far edge of the map as a rolling cloud, and the weather already decides what the ground does. **Seen:** `npm run check` only; the look in a browser unseen. **Next:** infantry columns raising a thin haze, dust that fades to mud after rain, hoof sound.

## Designers' notes: heirlooms (#224, own pitch from the owner's note #197, 2026-10-15, lane rules)
**Built:** `Player.walked` remembers the side ages a people has stood in (`noteWalked` in `enterAge`; the age it stands in counts too, via `hasWalked`, so older saves work). A technology with `walked: [a, b]` opens only once both are walked, in either order, and unlike an `only` craft it is kept for good. Four to start: Bell Foundry (Iron + Pilgrims), Iron-Bound Hulls (Iron + Sail), Joint-Stock Company (Merchants + Sail), Masons' Lodge (Pilgrims + Reclaimers). The HUD hides an heirloom until one of its ages is walked (the clue), and says which age is missing; a toast says when one opens. The clever computer has them at the end of `TECH_ORDER`. **Why I love it:** the owner asked that "two ages together should unlock something neither gives alone", and that small links grow into routes. Before this, a side road was a place you visited and left with nothing; now the *order* you walk the web is a build, and a detour (a step back, a turn) buys something lasting. With Iron wares (Iron + Merchants) and the Fairs (Merchants + Pilgrims), six pairs of side ages now combine. **Seen:** unit tests, an end-to-end Iron → Middle → Pilgrims walk that researches the Bell Foundry and keeps it after leaving, and a headless match; browser and win rates unseen; the computer doesn't yet *plan* a second side road to earn an heirloom. **Next:** heirlooms for the pairs still empty (Pilgrims + Sail: pilgrim ships to far shrines; Iron + Reclaimers; anything + Aeronauts); a computer that picks its second road for the heirloom it wants; and an heirloom that is a *unit* or a building, not only a number, so two runs look different, not just tune differently.

**The computer reaches for an heirloom (#232, own pitch, 2026-10-15, lane ai):** `heirloomAhead(p, to)` names the heirloom a road would open with an age already walked; `wants` then takes that road at `AI_WEB.heir` (1) odds instead of `take` (0.6), unless the road bars the people's signature line. Heirlooms moved to the front of `TECH_ORDER`, and an heirloom may join a building's queue while it has room (`MAX_QUEUE`), not only when the building stands idle: in a test the Sail computer's Dock trained cogs and fishers without a pause and would never have learned Iron-Bound Hulls. **Why I love it:** the owner calls the web build-crafting; now the rival walks it like a build (Iron → Middle → Sail for the hulls), and a player watching its roads can read its plan and answer it. **Seen:** `tests/ai-heirlooms.test.ts` (fails on the old odds: seed 1 passes the Sail by), `npm run check`, a 30-minute headless match; no win-rate sweep; browser unseen. **Next:** the computer reading the *player's* walked ages and expecting their heirloom (more ships after Iron + Sail); a computer that steps back off a turn age to take the other turn (Pilgrims → Middle → Sail) when the heirloom is worth the detour; heirlooms for the empty pairs, two ideas parked on #232 (Salvagers' Forge: razing pays back; Pilgrim Ships: sea trade per relic).

## Designers' notes: Lords of the Land (own pitch, 2026-10-15, Chain 1015-0151 s4 + owner's "build as you please", lane rules)

**Lords of the Land:** a game mode ('lords', picked in the setup and the room lobby; it was first tried on in every match and a computer simply claimed the map against a passive player, which the existing tests rightly refused). A side that keeps every landmark (at least `LANDMARKS.lordsMin` 3) for `LANDMARKS.lordsSeconds` (240) wins, with a HUD countdown, banner and end-screen line like the relics' (`landTeam`/`landTimer`, optional so old saves load; `landmarkStep`). Never in campaign chapters (there are no landmarks). I love it because the landmarks stop being only bonuses and become a third way to win that the whole map fights over; it hooks into Kin (a rival's favourite is also a step to their lordship) and gives the Stone Age a real contest. A computer facing a rival's countdown sends any soldiers, not a party of three, to break the hold. Seen: unit tests (`tests/lords.test.ts`); not played in a browser, no win-rate sweep; no save bump. Next: a ford (a crossing landmark), a Roman favourite kind, the computer going for lordship itself.

**The computer goes for lordship (own pitch, 2026-10-15, Chain 1015-0151 s5, lane ai):** in a Lords of the Land match the computer's landmark reach is the whole map (`AI_MARK.lordsReach`) and a band of two (`.lordsParty`, not three) goes after a rival's landmark, so it plays for the third victory instead of only its nearest spring. Seen: unit test and a 10-minute headless match; no win-rate sweep; browser unseen. Next: a ford, a Roman favourite kind.

**The Old Ford (own pitch, 2026-10-15, Chain 1015-0151 s6, lane rules):** a sixth landmark kind: its keeper's soldiers (not citizens or traders) march `LANDMARKS.ford.march` (1.2) times as fast anywhere, kin bonus included. It takes a crag's place on about a third of the hands (own mapgen draw). I love it because it is the first landmark for the army rather than the town: holding it means your counterattack arrives first, and a rival wants it before a war. Seen: unit test and model test; not played, no win-rate sweep, browser unseen; no save bump (kind is a string). Next: a Roman favourite kind (roads fit the Ford, but existing tests use Romans as the plain people), the computer staging armies from a ford.

**Heirlooms you can see and hear (own pitch, 2026-10-15, Chain 1015-0942 s1, lane look):** a Temple whose people learned the Bell Foundry wears a bronze bell in a little timber cote; a Dock with Iron-Bound Hulls is banded and bolted in iron (baked into the model, keyed on the owner's tech, so it appears for everyone who sees it); an heirloom opening rings a slow bell peal. I love it because a craft you earned by walking two roads should be legible across the map. Next: marks for the Joint-Stock Company (ledger-clerks' stall at the Market) and Masons' Lodge (carved lintels on the Temple), and the computer's towns telling you which roads they've walked at a glance.
**Staging from the ford (own pitch, 2026-10-15, Chain 1015-0151 s7, lane ai):** a clever computer that keeps an Old Ford on the road to its rival (within `AI_RAID.stage` tiles of home) musters its waves at the ford, not 8 tiles out: the army waits forward, in land it keeps, and the rival sees it coming. I love that a landmark now shapes how the computer wages war, not only its income. Seen: unit tests on the pick and a headless match; no win-rate sweep, browser unseen. Next: the computer contesting a rival's ford before a war, or a Roman favourite kind.

**Contesting the rival's ford (own pitch, 2026-10-15, Chain 1015-0151 s8, lane ai):** a Normal or Hard computer's soldier bands weigh a rival-kept Old Ford `AI_MARK.worth.fordRival` (1.6) times more when choosing a landmark to take between waves, so it goes for the road the rival's army would strike down before a nearer crag. I love that the ford is now something both sides fight over, not only use. Seen: a unit test on the pick; no win-rate sweep, not played, browser unseen; no save bump. Next: a Roman favourite kind; an escort wave sent to the ford before a declared war.

**All four heirlooms wear a mark (own pitch, 2026-10-15, Chain 1015-0942 s2, lane look):** the Market shows a counting-house board with a gilt seal and a desk of coin stacks; the Temple, if it also holds the Masons' Lodge, gets shear-legs hoisting a dressed block and stacked ashlar beside it, alongside the Bell Foundry's bell. A building can now wear several marks (`HEIRLOOM_MORE`, `heirloomsFor`). I love that a glance at a Temple tells you which two roads its people walked. Seen: model tests only; the look in a match is unseen. Next: carved lintels at epoch-specific styles, and marks for the heirlooms still to come.

## Designers' notes: the Age of Lightning (#231, grows seed #136, 2026-10-15, chain 1015-1000 s0, lane rules)

**Built:** a side age off the Industrial (tier 4, `AGES.lightning`, `coils: true`). Road: clue a finished Watch Tower, deed `stats.beacons` ≥ 6 (lit beacons, relays counted; the tally is new and optional), 500 food / 300 stone / 900 gold, 60 s; back to the Industrial for 200 food / 300 wood. In the age every Watch Tower is a Coil Tower: `workSteps`/`workRate` in `ages.ts` run a building's training and research at `LIGHTNING.lit` (135) in a coil's field and `LIGHTNING.dark` (75) outside every field, carrying fractions in `Building.spark` as integer hundredths so every machine agrees. The tower's own arrow becomes a bolt (`arc` in `combat.ts`) that leaps to the nearest unstruck enemy within `leap`, up to `strikes`, keeping `keep` each leap; garrisoned arrows still fly. Aircraft are barred (`no`). The computer (`turnRoad`, `beaconsForLightning`, a coil by a dark workshop in `planBuildings`) lights beacons toward the deed, skips the Airfield while bound for lightning, takes the road with two towers and no aircraft, and leaves when its towers fall. Look: copper winding, lattice mast and Wardenclyffe's mushroom crown on the tower, a receiving mast on workshops (`ageTouches`); a jagged bolt with glowing nodes (`Effects.bolt`); a `zap` crackle; a whole-tone theremin theme (`SIDE_STYLES.lightning`, new `theremin` lead).

**Why I love it:** the owner asked for an age past the Industrial that isn't the usual tanks-radar-jets climb, something with the invention of a film like *The Prestige* or *Metropolis*. Here the future changes *where you build* (inside a field), *what you raid* (a coil, to darken a district), and *how you mass an army* (crowds feed the bolt), and it costs the Industrial's signature, the aeroplane. So the Industrial now forks into two futures that answer each other: Aeronauts fly over coils, Lightning fills the sky with current. And the beacon, a Bronze Age fire on a roof, becomes the seed of the Industrial's last road.

**Seen:** `tests/lightning.test.ts` (road, deed, field timing, the bolt through a crowd and a spread line, save/replay, the computer); 6 Hard-vs-Hard headless matches from the Industrial, 25 min: the computer took the road on 3 seeds, one match was Aeronauts against Lightning, coils fired 117 bolts; headless Chromium: the Coil Tower drawn in a match, a bolt held on screen through a crowd, no console errors. Unheard: the crackle's and theremin's levels. No win-rate sweep.

**St. Elmo's Fire (#240, Chain 1015-1020 s1, lane rules):** the Pilgrims + Lightning heirloom. A built Temple within `LIGHTNING.reach` of the owner's finished Watch Tower mends the owner's soldiers within `ELMO.reach` (6 tiles) 4% of full health every 2 s (`elmoStep` in `src/sim/elmo.ts`; mod `elmo`). It uses any Tower, not only coils, so it stays useful on every road once learned; it changes where the Temple goes and where an army stages. I love that the faith reads the coil's glow as a blessing. Not done: Reclaimers + Lightning (Galvanic Revival); a mark on the Temple for it; a ring showing the healing reach.

**Next (umbrella #231):** draw the field on the ground and mark dark buildings in the panel; an heirloom or hybrid (Lightning + Reclaimers: old machines woken by current?); the computer laying its town out inside its fields; a counter for coils in the Aeronauts' hands (bombers that seek coils?).

**Coil hum (own pitch, 2026-10-15, Chain 1015-0942 s5, lane look):** the Age of Lightning had a crackle for each bolt but a coil at rest was silent. A finished Coil Tower within `COIL_HUM_RANGE` (12) tiles of the view now hums, a 60 Hz saw and its octave swelling and fading, with a thin whine on top, louder the nearer (`coilDistance`, `coilHumGain` in `ambience.ts`). I love that you can hear a rival's field before you see it, as you scroll toward their quarter. Seen: unit test; level unheard, browser unseen. Next: a hum that dips when its field is dark, a corona of blue sparks on the mast at night.

## Designers' notes: reading a rival's heirlooms (#242, own pitch, 2026-10-15, chain 1015-1037 s1, lane ai)

**Built:** heirlooms are kept for good, so a rival can see what they say about you. The clever computer now reads two (`rivalHas`, `AI_WEB.lodge`): a Joint-Stock Company makes you a trade rival on any road (its riders watch your trading post, `watchPost`), and a Masons' Lodge, with its sturdier buildings, makes it keep one more siege engine. **Why I love it:** walking two side ages now costs something as well as giving something: the other side notices. **Seen:** `tests/ai-rival-heirlooms.test.ts`; no win-rate sweep. **Next:** a Bell Foundry rival's temples as a target, Iron-Bound Hulls answered by more warships, and a detour off a turn age (Pilgrims → Middle → Sail) when an heirloom is worth it.

Session 2 (lane ai): Iron-Bound Hulls answered. `fleetWanted` adds `AI_WEB.hulls` (1) warship to the fleet a clever computer already means to keep when a living rival has the heirloom: its hulls are 30% sturdier, so meeting them takes a ship more. Unit test only; no sweep. Next: a Bell Foundry rival's temples as a raid target, a detour off a turn age when an heirloom is worth it, and s4 of #231 once #240 merges.

## Designers' notes: raiding the coil (own pitch, 2026-10-15, chain 1015-1037 s6, lane ai)

**Built:** a coil that alone keeps buildings lit is now a raid target (`darkened` in `ai.ts`, `AI_LIGHTNING.raid` = 150 tiles² of pull per building it alone covers): the computer sends its waves at the tower whose fall darkens the most of a rival's quarter, the way #231's pitch says a raid on a coil should. A coil another coil also covers draws nothing. **Why I love it:** it makes the field's weakness real for the player, so a town with one coil in the middle invites a strike and two overlapping coils don't. **Seen:** `tests/ai-coil-raid.test.ts`; no win-rate sweep. **Next:** s4 of #231 (the computer lays its own town inside its fields) once #240 merges.

## Designers' notes: four honest difficulties (#258, from the owner's note #256, 2026-10-15, lane rules)

**Built:** a fourth, gentlest computer (id `gentle`, shown as **Easy**: 0.65 gathering, 12 citizens, a first wave of 4 at 18 minutes growing by 2, no tricks, no towers), and the three old levels shown one step up: `easy` is now **Normal** and the title screen's default, `normal` is **Hard**, `hard` is **Expert**. Against a town that does nothing, the first wave arrives at about 18.6 / 12.5 / 8.7 / 7.9 minutes (`npx tsx scripts/tiers.ts`).

**Why I love it:** the owner's playtest is the classic onboarding trap: nobody picks "Easy" on a first game, so Normal *is* the beginner setting, and it crushed them in the Stone Age. A first game should be the one where you learn that a Town Center trains citizens and a Barracks trains a guard, not the one where you learn to quit. Keeping the ids and moving only the names means no save, replay, room or test notices.

**Next:** let rooms offer Easy (`worker/lists.ts` plus `tests/worker-routes.test.ts`, which pins the list today). A gentler tier could also *teach*: a first wave that announces itself ("Scouts from Augustus are on the road") a minute out. And watch the wild: wolves and a mammoth can still end a first game before any rival does.

**Wireless Telegraphy (#240, Chain 1015-1020 s2, lane rules):** the Sail + Lightning heirloom. Ships and finished Docks inside a Tower's field see `TELEGRAPH.sight` (5) tiles farther (`updateVision`, mod `telegraph`). It decides where the coil goes: on the headland, so the harbour is watched. I love a lookout made of current. Not done: merchant ships reporting pirates; a Dock mark; Reclaimers + Lightning (Galvanic Revival).

**Galvanic Revival (#240, Chain 1015-1020 s3, lane rules):** the Reclaimers + Lightning heirloom, the third of #240 (closes it). In a Tower's field repairs are free and `GALVANIC.repair` (1.5×) quicker, and a ruin you dug that lies in a field pays `GALVANIC.gold` (25) every 30 s (`galvanicStep`, `units.ts` buildStep). It asks where the coil goes: at home as a free field hospital for walls and towers, or forward beside a ruin as a mine you must then defend. I love old stones coming alive. Next: a visible spark on a wired ruin, a Workshop mark, the computer building a coil beside a ruin it dug.

## Designers' notes: hunters hunted (#260, own pitch, 2026-10-15, lane ai)

**Built:** `prowl` in `ai.ts`. Between waves a clever computer (Hard and Expert) sends two or three idle soldiers at a rival citizen its own units can see, working within 40 tiles of its home, more than 12 from the rival's Town Centers and Towers, with no rival soldier within 7 and no crowd too big for the band (`prey`). The band chases on to the next one within 8, and goes home when a rival soldier comes near, the 45 s are up, or nobody's left; it sets out at most every 75 s. Seeing no one, it walks to a rival Hunting Camp it has seen (`rivalCamp`) and looks for the butchers. `AI_PROWL` in `data.ts`.

**Why I love it:** the wild, Hunting Camps, ruins and landmarks all pull citizens out between the towns, but until now only wolves made that reach a gamble. A rival that punishes an unguarded hunt makes "how far, and with whom?" a choice two good players answer differently (`docs/design-notes.md`, "Richness"): it rewards a couple of early soldiers, a tower by the camp, or the bell. It only sees what its units see, so a careful player can hide the hunt.

**Seen:** `tests/ai-prowl.test.ts`; between two Hard computers it fires about once a match over six 20-minute matches (they rarely leave citizens exposed), so its weight falls on players who greed. Not played by hand. **Next:** ~~have the band burn an unguarded Hunting Camp once the butchers flee~~ (done 2026-10-16: at the camp with nobody to chase it attacks the camp for `AI_PROWL.burn` (45) s more; `tests/ai-prowl.test.ts`, no sweep, browser unseen); a toast naming it ("Raiders fall on your hunters!") through the event the alert already sends; ~~the computer guarding its own far hunts~~ (done: see "Escorted hunt" below).

## Designers' notes: escorted hunt (own pitch, 2026-10-15, lane ai)

**Built:** a clever computer (Hard and Expert) now goes, in the first three ages, for a mammoth 22–38 tiles from home (`AI_WILD.far`), sending two idle soldiers (`.escort`) with the five citizens, if three more stay at home (`.guard`) and it sees no rival soldier within 12 tiles of the beast (`.safe`). The soldiers hunt it too, so they take the charge and the kill is quicker.

**Why I love it:** it is the other side of #260: the computer now weighs the same gamble it punishes in you. A far feast is worth the risk only with soldiers to spare.

**Seen:** `tests/wild.test.ts` (escorted with six soldiers, not with one). No win-rate sweep; browser unseen. **Next:** have the band bring a tower or Hunting Camp along. *Done 2026-10-16 (camp):* the Hunting Camp rule now reaches as far as the far hunt (`AI_WILD.campNear` 24 → 38), so a far feast gets its camp; *Done 2026-10-15 (tower):* a clever computer past the Stone Age raises a Watch Tower within `AI_WILD.towerNear` (6) tiles of a far kill whose Hunting Camp stands (50 wood, 125 stone, 12+ citizens), so the butchers have arrows and sight; `tests/huntcamp.test.ts`, no sweep, browser unseen. *Done 2026-10-16 (garrison):* idle escort soldiers near the hunt's finished Watch Tower with room shelter in it (more arrows over the butchers) while meat is left within `towerNear`+4 tiles, and are released home once it's gone; `tests/wild.test.ts`, no sweep, browser unseen. *Done 2026-10-15 (recall):* once the beast is down the escort (`mem.huntEscort`) walks home instead of standing idle at the carcass, where a raider would find it.

## Designers' notes: people crests (#267, art pass, 2026-10-16, lane look)

**Built:** `src/ui/crests.ts`: each people gets a banner crest in the player's colour on the title card, beside the blurb, redrawn when people or colour change.

**Why I love it:** the title was a form; peoples had names but no faces. A flag in your own colour is the first thing the match then shows on your buildings, so the menu and the field say the same thing.

**Seen:** headless Chromium, Mongols in red and Romans in green on the title card, no console errors. Emblems are small and plain; the Chinese and Egyptian ones want a better hand. **Next (the art pass has more to do):** the same crest on the HUD's people chip, the lobby and the end report; building models' silhouettes per epoch; a title-screen backdrop that isn't a form over a live field.

## Designers' notes: cloud saves (#290, owner-ask, 2026-10-15, lane online)

**Built:** a vault per save key on the Worker (`worker/vault.ts`, one Durable Object each), three slots of gzipped save text, and a Cloud saves panel in the Menu and on the title screen. The key is 20 of the room codes' unmistakable letters (100 bits), shown as `ABCD-EFGH-…` so it can be read off one screen and typed into another.

**Why this shape:** no accounts, no passwords, no email: a strategy game shouldn't ask for any of that to keep your match. The key is the whole identity, the same way a room code is the whole lobby. A year untouched empties a vault, so forgotten keys don't pile up on the server.

**Next:** autosave to a cloud slot on leaving the page (needs `keepalive` and a size check, since `keepalive` bodies cap at 64 KB, so probably a small "resume" pointer instead); a QR code of the key for phones; the Web of Ages discovery carried in the vault too (campaign stars now are: see below).

**Campaign stars in the vault (#292, lane online, chain 1015-1905):** `GET/PUT /api/vault/KEY/progress` keeps chapter → best stars. The vault merges by the best of old and new, so stars never go down and a stale browser can't overwrite a win. Opening the Cloud saves panel merges this browser's stars with the vault's both ways; after that first open every win is sent up on its own. I held back from syncing every player's stars silently: that would make a vault for people who never asked for one. **Seen:** tests only (routes, merge, junk refused); no browser. **Next:** Web of Ages discoveries the same way (done, below); a QR code of the key (done, #296).

**Web of Ages finds in the vault (lane online, chain 1015-1905):** `GET/PUT /api/vault/KEY/web` keeps the ages stood in and side roads known; the vault unions what it holds with what is sent, so finds only grow. Opening Cloud saves merges both ways (and toasts how many finds came across); after that first open each new find is sent up on its own, sharing the stars' opt-in flag. Cleaned by shape and capped (64 each, 4 KB). **Seen:** tests only (routes, union, junk refused); no browser. **Next:** none needed; maybe show finds on another device's title map with a flourish.


## Designers' notes: a hero's fall (#300, own pitch, 2026-10-15, chain 1015-1905 s4, lane look)

The hero is the one unit with a story, so its death gets two gold rings, rising embers and a low double toll (`heroFall`), instead of a soldier's dust puff. I love how a rival hero's fall now reads across the screen as a small triumph. Seen only by building and a green quick check; the look and the sound level want a person's eye and ear. Next: a dropped standard that lingers where the hero fell, and the king's fall in Regicide.
**Campaign stars in the vault (#292, lane online, chain 1015-1905):** `GET/PUT /api/vault/KEY/progress` keeps chapter → best stars. The vault merges by the best of old and new, so stars never go down and a stale browser can't overwrite a win. Opening the Cloud saves panel merges this browser's stars with the vault's both ways; after that first open every win is sent up on its own. I held back from syncing every player's stars silently: that would make a vault for people who never asked for one. **Seen:** tests only (routes, merge, junk refused); no browser. **Next:** Web of Ages discoveries the same way; a QR code of the key.

**Paths, and the Path of Blood's first step (#299, lane rules, 2026-10-15).** Built: the groundwork for a side road that spans several epochs, which the owner asked for directly. A **path** (`PathId`, `PATHS`, `Age.path` in `data.ts`) is a chain of side ages, one per tier. `pathAges`, `pathDepth`, `pathRoads` and `pathCarry` in `ages.ts` say where a people stands on it. `Path.carry` is added to its modifiers once for every earlier age of the path it has walked, so a path rewards staying on it; that only starts to count once a second age joins. New modifier `plunder`: the share of a slain enemy unit's price paid to the killer as gold, in `hurt()` (`combat.ts`). New tallies `stats.slain` (enemy units, not buildings) and `stats.plunder`, plus a `plunder` event. First step: the **Age of the Warband**, a turn off the Middle Ages (tier 2). Clue: a Barracks. Deed: slay 25. In the age: soldiers train 15% faster, plunder 0.25; no traders, farms 0.9. Road on: Gunpowder; back: the Middle Ages. Why a turn off the Middle Ages and not a branch off Bronze: `tests/step-back.test.ts` pins the Bronze roads, and starting at tier 2 still leaves the path three tiers (2 → 3 → 4). Why I love it: until now every side age was one tier wide and you came back to the trunk. A path makes *leaving* the trunk the commitment, and its plunder turns raiding into an economy, a real change of decisions (#197). The computer is kept off paths (`fit` returns −1 for a path age, so no dice are rolled and its play is unchanged: the same `scripts/sim.ts` checksum before and after). Not done: traders already on the road keep trading after the turn; no building touches. **Next:** s2, the Age of Iron and Blood (tier 3, warband → it, deed: `stats.plunder`), with something that is more than a number (a war camp that trains where your army stands? captives?); s3, the computer walking the path; s4, Total War (tier 4) and a Blood + X heirloom.

## Designers' notes: the Age of the Steppe, a town on wheels (#297, s1, 2026-10-15, lane rules)

**What I built.** A second road out of the Stone Age, beside the Iron Age. The clue is a Hunting Camp and the deed is 400 meat butchered, so it grows out of the wild the owner asked for. On the steppe a Town Center or House packs onto a ger cart (J) and is pitched again (P) on any ground no rival holds; it raises itself, keeps the health it was packed with, and brings its border along. No Farms, Walls or Gates. Riders come cheaper and quicker, and hunters work faster. Wagons take no room and suffer no attrition, but they are trader class, so riders hit them ×2.5. A freshly pitched camp torn down refunds nothing, which closes a free-resources loop.

**Why I love it.** The owner's note #197 asks for "a different route [that] should feel like very different game mechanics, not a new skin". Every side age so far changes numbers or adds one action; this one changes what a town *is*. Herds drift away from borders every 150 s, so a settled town's hunting thins, and a nomad town follows it. It is the Iron Age's mirror: the horse in, the plough and the wall out.

**Where it goes.** The owner chose (2026-10-15) to make it the root of a **second main path**, not a shoot: s2 flocks (sheep and horses that graze, follow the camp and draw wolves), s3 a **Horde** tier (tier 2) that keeps the moving town and adds tribute or the Yam relay, s4 a **Silk Road** crossing with the Merchants, then the computer walking it. Settling back onto the trunk stays open from every tier. Untried: whether 400 meat is the right gate, and whether a wagon at 1.2 tiles/s feels too slow on a large map. The computer doesn't take the road yet.

**The Age of Iron and Blood and its War Camps (#303, s2 of #299, lane rules, 2026-10-15, chain 1015-1948 s1).** Built: the path's tier-3 step and the first building that belongs to a path. **War Camp** (`BUILDINGS.warcamp`, `WARCAMP`): pitched by foot soldiers (`BuildingStats.builders`, so `canRaise` lets infantry build it and nothing else), raised only in Iron and Blood (`BuildingStats.ages`, `buildBarred`), allowed in enemy land like a Tower, trains infantry 1.2× slower than a Barracks, claims 3 tiles of border so the army round it is supplied. Kept by its people's land soldiers within 8 tiles; alone for 10 s it burns 5% a second (`warcamp.ts`, a `campAlone` event and toast); a people off the path can't keep one, so leaving strikes every camp. Age: plunder 0.25 + carry 0.1, soldiers train 0.85, farms 0.85, technologies 1.2, no traders. Why I love it: plunder made raiding pay; the camp makes *staying* in enemy land the plan. Where you pitch it is a real choice (close enough to strike, far enough from the Town Center's arrows), the defender gets a target that matters (kill or lure the keepers and the camp burns itself), and it reads borders and attrition (#132) from the other side. **One forced change:** the road leaves from the Gunpowder Age, not the Warband: `tests/path-of-blood.test.ts` pins the Warband's roads to Gunpowder and Middle, and `tests/ages.test.ts` needs a road in `ROADS` into every age, so a warband → Iron and Blood road can't be added without editing a test. New `Road.walked` keeps it the path's own: only a people that walked the Warband sees it, and the Warband's plunder is its deed. If the owner frees that test line, a direct climb is one entry. The web map gives the path the left column (Reclaimers to lane 2, Fairs to lane 3). **Seen:** headless Chromium (B, a click, six halberdiers raise it inside the rival's border, its pocket of land shows, it burns once they die: `docs/screenshots/war-camp.jpg`); tests; the `scripts/sim.ts` checksum unchanged. **Not seen:** a match played by hand; the march's sound. **Next:** s3, the computer walking the path (raids for plunder, a camp by its muster); s4, Total War, where camps could grow (a camp that rallies, or one that heals); a burning-camp effect of its own.


**The computer walks the Path of Blood (#307, s3 of #299, lane ai, 2026-10-15, chain 1015-1948 s2).** Built: a clever computer whose people fights with foot or riders (`fit`: infantry or cavalry signature, Romans, Greeks, Mongols) rolls `AI_BLOOD.take` (0.6) for the path, once, like any side road. Turns: Warband (Barracks, 25 slain, held for like other deeds), then it holds the climb to Gunpowder while the plunder comes in (`patience` 480 s, then gives Iron and Blood up for good), turns Iron and Blood from Gunpowder, and stays `stay` 360 s before climbing on (its camps are the point). War Camps: when its wave is within `reach` 40 tiles of the rival's home, in Iron and Blood and with no camp of its own, its foot soldiers pitch one where they stand, `clear` 11 tiles from the rival's Town Center and Towers; its trainees rally to it and `keep` 3 soldiers stay by it (they are left out of the wave's orders, so the camp doesn't burn); a burnt camp is pitched again after `again` 120 s. The answer: a rival War Camp seen within `answer` 48 tiles of home draws every idle soldier (at least `strike` 5) on an attack-move, and its keepers die, the camp burns. Why I love it: the path now has an opponent who plays it, so the player meets a camp in their land and has to decide whether to lure its keepers off or break it. **Not done / next:** the computer doesn't walk the Total War step (s4, not built); it never gives up a camp it can't keep; no balance sweep beyond the duel in the pull request; browser unseen.
**The Age of Total War and the call to arms (#313, s4 of #299, lane rules, 2026-10-15, chain 1015-1948 s3).** Built: the path's tier-4 step (`AGES.totalwar`: plunder 0.25 + carry 0.1 × 2, soldiers train 0.85, farms 0.8, technologies 1.25, no traders) and its own mechanic, the **call to arms** (`CALL_UP`, `callUp` in `warcamp.ts`, a `callUp` command and event): War Camps return, and each is a muster ground. C calls the nearest of its people's citizens within 8 tiles, V up to five; each becomes a foot soldier of the age where it stood, with its share of health, for 15 wood and 25 gold, and the camp rests 4 s for each one. The deed is soldiers trained at War Camps (`stats.campTrained`, 12), so Iron and Blood's camps are the way in. Why I love it: it is the one choice the whole path has been leading to, and it's a real one. A citizen called up is a soldier *now*, without house room or a queue, but it's a worker gone, so a town that panics wins the fight and starves after it. A camp pitched at home becomes a militia point, a camp at the front turns a column of carts into a regiment, and the defender learns to hit the citizens before they reach a camp. **Forced changes, said plainly:** the road leaves the Industrial Age with `walked: 'ironblood'` (as s2 left Gunpowder), because `tests/iron-and-blood.test.ts` pins Iron and Blood's roads to Gunpowder and Industrial, so camps are struck on the climb and come back on the turn; and the same test wants `PATHS.blood.planned` non-empty, so the Blood heirloom stays listed. `tests/command-ownership.test.ts` gets the one row for `callUp` it asks for (as `pack` and `pitch` did). Looks: the path's towns arm as they go deeper (`bloodTouches`: crimson war banners, then stakes, then sandbags); a bugle and snare (`callUp` sound); crimson dust where each soldier stands; a Total War theme (Aeolian, snare and cornet). The web map widens to five lanes (the Age of Sail sat past the old edge), Total War sits under Iron and Blood, Lightning moves to lane 3 and its road curves under the Aeronauts. **Seen:** headless Chromium (C and V at a War Camp: toast, costs, "Mustering" countdown, six soldiers where the citizens stood, no page errors; `docs/screenshots/total-war.jpg`); tests; `scripts/sim.ts` checksum equals `main`'s. **Not seen:** a match played by hand; the bugle's level; the banners up close. **Next:** the computer walks Total War (calls its citizens up when its town is struck, pitches a home camp); a Blood + X heirloom (Blood + Sail: privateers? Blood + Pilgrim: crusader orders?); maybe those called up go home as citizens when the people makes peace.

**Flocks (#308, s2 of #297, lane rules, 2026-10-15, chain 1015-1948 s5).** Built: sheep, owned animals (`Animal.owner`, `kind: 'sheep'`), not units, so they need no population, no orders and no selection, and the AI's hunting (which looks for deer, boars and mammoths by kind) never touches them. A sheep keeps to its camp, the nearest Town Center of its people within 40 tiles, standing or packed on a wagon (`campOf`), and grazes the tile under it every 4 s. A cropped tile is bare for 75 s, divided by the season's new `SEASONS[].grass` (1.2 spring, 1 summer, 0.8 autumn, 0.4 winter), so one sheep wants about 19 tiles in summer and about 47 in winter. Within 6 tiles of a camp there are about 120, so a full flock of 8 grazes its ground out and goes hungry: that's the moment to strike camp. Bites fill an udder (25); citizens milk it at 0.7 a second (`milk` order). A full udder turns bites into fat, and 18 fat is a lamb, born only while the people walks the steppe, under the cap of 8 sheep for each Town Center. So milking and breeding pull against each other, and slaughter (a hunt order on your own sheep) is the fast, final third option. Wolves (`animals.ts`) now run down sheep within 11 tiles of their den (× the season's boldness), unless Hounds and the camp are near. A sheep with none of its people or its camp within 6 tiles goes over to a rival on foot or horse within 2, then trots after that rustler (`lead`) until it reaches the rustler's camp. Grazed ground is a per-tile `Int32Array` (`GameState.grazed`), made only when the first sheep is, so ordinary matches, saves and the checksum stay as they were. **Why I love it:** the steppe now has an economy with its own shape. Food is in one place and you keep it moving: graze, milk, move on; breed in a good season, slaughter before a hard winter. It makes striking camp a decision the land forces on you, not a novelty, and it gives riders a raiding target worth a detour. **Seen:** headless Chromium (L raises lambs, the flock grazes and wears the ground, right-click milks and food rises, the flock follows a struck camp across the map: `docs/screenshots/steppe-flock.jpg`); 12 tests; `scripts/sim.ts` checksum unchanged. **Not seen:** the bleat's level by ear; balance in a real game (is 60 food a lamb right? should a hungry flock lose more than fat?). **Next:** horses (a second flock that feeds riders, maybe at the Horde tier); herding by hand (a shepherd citizen who leads a flock to new grass without moving the camp); the computer keeping a flock (s5); grass that grows richer by water.

**The Age of the Horde and tribute (#318, s3 of #297, lane rules, 2026-10-16, chain 1015-1948 s6).** Built: the Steppe is now a real path, `PATHS.steppe` (the Steppe Road, carry `cavalrySpeed` +0.05 an earlier age walked), with the Horde as its tier-2 age (`AGES.horde`: mobile, no Farms/Walls/Gates, riders 0.8 price and 0.75 training, hunt 1.15, `tribute` 0.3). Its own mechanic is **tribute** (`TRIBUTE`, `src/sim/tribute.ts`, a new `tribute` mod and `tribute` event): once a second outside the peace, every rider (cavalry class) standing still on a rival's land takes the mod in gold from that rival's treasury, at most 8 riders a rival; riders on the move take nothing and an empty treasury pays nothing. Roads: steppe → horde (Stable; deeds: 200 milked, a new `milked` stat, and 800 hunted), middle → horde for a people that rode the steppe, horde → gunpowder and horde → middle. All carry `walked: 'steppe'`, so nobody else sees them, and `fit` already gives any non-blood path -1, so the computer keeps off the whole road (checksum 1658101786 unchanged). Looks: black and white horsetail standards (`horsetail`, `hordeTouches`), a gold glint over each taking rider, a `tribute` sound, a galloping pentatonic theme, the Web of Ages' new right-hand column (lane 5, `MAP.w` 528).

**Why I love it.** Tribute is a raid that doesn't kill anything: the horde wins by *standing*, which is the thing cavalry is worst at. It turns the counters inside out (spears and towers become how you pay less), and it ties the path's three systems together: the riders need supply (attrition), so the camp pitches by the border (the wagon), and the flock walks with it. The rival gets a real choice too: drive them off, wall the border, or let them take it and outbuild them.

**Where it goes.** A deeper tier (tier 3) could make tribute a treaty: a rival pays a lump to make the riders leave. Horses as a second flock that cheapen riders. The Yam Relay tech (`riderSight`) could become a horde building that carries sight between camps. The computer: s5 should sit riders in a rival's land, and a defending computer should answer tribute (it doesn't yet react to idle riders that aren't attacking). Not seen: balance in a real match, the sound by ear, the Web of Ages layout with the Horde node on screen.
**A nomad rival: the computer on the steppe (#320, s5a of #297, lane ai, 2026-10-16, chain 1016-0017 s1).** Built: a clever computer now walks the steppe that s1 and s2 made. It decides once, like any side road (`wants`): a riding people always (the steppe's cheaper riders make `fit` 1), others at `AI_STEPPE.take` (0.35, below the web's 0.6, because the road reshapes the whole town), on a coin of their own from the match's seed (`coin`), since every clever town asks at 12 citizens and a roll from the match's dice would reshuffle every match (it flipped the 3-seed `ai-winter` slow test, which is a narrow +4 on `main`). Bound there, in the Stone Age with 12 citizens it raises a Hunting Camp by the nearest deer 8 to 30 tiles out (the road's clue, which before only a far mammoth kill ever put up) and lets 6 citizens hunt deer within 26 tiles instead of 3 within 16. On the steppe it raises a lamb whenever 100 food is spare beyond the 60 it costs, keeps a milker for every 3 grown sheep (a berry picker or woodcutter goes over), slaughters a sheep whose fat is full while it can't breed (flock at cap, or settled), and no longer lays Farms the age bars. Once 150 s have passed since it arrived or last moved, a half-hungry flock or no deer or berries within 16 tiles makes it strike camp, if no rival soldiers are near: it scores 48 spots (16 compass points, no trigonometry, at 10, 14 and 18 tiles) by fresh grass in a flock's reach, berries and deer, keeps only those no nearer the rival and where a Town Center fits, and needs a quarter better than where it stands. Then it stops training and learning at the Town Center so the queue empties, packs, drives the cart, and pitches; a cart that finds no room falls back halfway and tries again. While the cart rolls, home is the cart (so the town doesn't rebuild a Town Center it still has), and carts are never counted as soldiers. It holds the steppe 90 s before rejoining the Middle Ages (180 s held the Hard Mongols in the steppe past the point `sim.test.ts` expects epoch 2). **Why I love it:** the steppe was a road only the player walked. Now you can meet a town that moves: its Town Center trundling off to new grass with sheep trailing after, a cart your riders can catch on the road, a flock to rustle when the herders look away. It makes the second main path part of what you play against, not just what you choose. **Seen:** tests (`tests/ai-steppe.test.ts`, 6) and headless matches (`sim.test.ts`'s seed 21: Hard Mongols take the steppe at 9.1 min, strike camp at 11.6, pitch at 11.8, rejoin the Middle Ages at 12.8 and win at 13.8, against 14.1 on `main`; seed 22's Chinese pass it by on their coin and play as on `main`). **Not seen:** a browser (the cart's drive and pitch are the player's own models and sounds); win rates over many maps. **Next:** s5b, when the Horde and Silk Road exist; herding the flock away from a raid; striking camp away from a losing fight; rustling a rival's unwatched sheep on purpose.

## Designers' notes: title caption (#267, 2026-10-15, lane look)

Built: a small corner caption names the town the title screen's camera is visiting ("Azure of the Greeks / Bronze Age"), fading between towns. Why: a backdrop that says what it shows reads as a place, not wallpaper. Unseen in a browser beyond the smoke test. Next: let a click on the caption jump the camera to that town, or watch that match as a spectator.
