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

- **More epochs** (Atomic and Modern, as in EE), trade ships between docks, and the computer launching seaborne invasions.
- **Unique units per people**, and AoM-style special powers.
- **A campaign** of historical scenarios, and a **scenario editor** (EE's and AoE2's editors built huge communities).
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

