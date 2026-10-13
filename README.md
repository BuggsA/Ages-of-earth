# Ages of Earth

A real-time strategy game in the browser, in the spirit of Empire Earth and Age of Empires: lead your people from the Stone Age through the Bronze Age, the Middle Ages and the Gunpowder Age to the Industrial Age, gather food, wood, stone and gold, fish the seas, build a town, raise an army and a navy, take to the air and conquer your rivals, alone against the computer or online with friends. It is built with TypeScript and Three.js, the same stack and low-poly look as Tideborn, and deploys the same way: a Cloudflare Worker serving static files, ready for a subdomain of your own domain.

What players love most about the classics, and where to find it here, is written up in [docs/design-notes.md](docs/design-notes.md).

| | |
|---|---|
| ![A Bronze Age town with a ziggurat wonder](docs/screenshots/town-bronze.jpg) | ![The same town in the Gunpowder Age](docs/screenshots/town-gunpowder.jpg) |
| ![A Middle Ages town: cathedral wonder, church, market, forge, walls](docs/screenshots/town-middle-ages.jpg) | ![Two armies clash; a catapult's boulder lands](docs/screenshots/battle.jpg) |
| ![Dragging out a palisade](docs/screenshots/walls.jpg) | ![An online room](docs/screenshots/online-lobby.jpg) |
| ![Fishing boats work the shoals off a Gunpowder Age dock](docs/screenshots/fishing.jpg) | ![Galleons trade broadsides](docs/screenshots/sea-battle.jpg) |
| ![Bombers and fighters over an Industrial Age town; riflemen fire back](docs/screenshots/air-raid.jpg) | ![An Industrial Age town with its airfield](docs/screenshots/town-industrial.jpg) |

## What's in it

- **Five epochs.** Stone, Bronze, Middle Ages, Gunpowder and Industrial. Advancing costs food, wood, gold and stone and takes time at the Town Center. When you advance, every unit re-arms (clubman to spearman to pikeman to halberdier to bayonet-armed fusilier) and every building is rebuilt in the new style, keeping its share of health. The Industrial Age brings riflemen, hussars, field guns, a Field Marshal, red-brick towns with smokestacks, ironclads, paddle steamers and aircraft.
- **Ships and fishing.** Build a **Dock** on the shore. **Fishing boats** (from dugout canoes to steam trawlers) work the fish shoals and bring the catch back to the dock. **Warships** (triremes, war cogs, galleons, ironclads) fight on the water and shell the coast; only missiles can reach them from land. **Transports** carry up to 8–12 soldiers or citizens: right-click your transport with troops selected and they meet it at the nearest shore both can reach; right-click a far shore (or press **U**) and they land and march on to the spot. If a transport sinks, everyone aboard goes down with it.
- **Aircraft.** In the Industrial Age an **Airfield** trains biplane **fighters** and twin-engined **bombers**. They fly straight over water, woods and walls, circle while they wait, and come down in flames. Bombers wreck buildings with bombs that blast everything nearby; fighters hunt aircraft. Only missiles reach them: archers to riflemen, towers and Town Centers, and warships can shoot back, while swords, spears, horsemen and siege can't.
- **Six peoples, each with a bonus:** Egyptians (faster farms, cheaper wonders), Greeks (tougher foot soldiers), Romans (sturdier buildings that go up faster), Mongols (faster cavalry and hunters), Chinese (two more citizens, cheaper technologies) and Britons (longbows: archers reach farther and train faster).
- **An economy.** Citizens gather berries, wood, stone and gold, hunt deer (they bolt when speared) and butcher the carcasses, and carry it all to a Town Center or a Storehouse. Farms never run out. Houses make room for 5 more people (up to 150). A **Market** trades food, wood and stone for gold, with prices that move as people buy and sell.
- **Seventeen buildings:** Town Center, House, Farm, Storehouse, Market, Temple, Wonder, Wall, Gate, Barracks, Archery Range, Stable, Forge, Siege Workshop, Watch Tower, Dock and Airfield. Drag to lay out a wall (log palisades in the Stone Age, stone after); set gates into your walls, which open for you and your allies only.
- **Twenty-eight technologies** at the Town Center, Storehouse, Forge, Barracks, Stable, Temple, Workshop, Dock, Airfield and Market: better tools, wheelbarrows and handcarts, the plow and irrigation, masonry, weapon and armor lines, conscription, theology, chemistry, gill nets, shipwrights, rifling, the steam engine, aviation, caravans and banking.
- **The counter triangle and more.** Infantry beat cavalry, archers beat infantry, cavalry beat archers, priests and siege. **Siege engines** (battering rams, catapults that crush groups, bombards) break walls and towns. **Priests** heal your wounded and convert enemy soldiers. One **hero** at a time inspires the soldiers around them to hit harder and heal.
- **Relics.** A few gilded relics lie out on every map: one at the same distance from each town, more out between the towns. From the Bronze Age a **priest** can carry one home to a **Temple**, where it brings in 30 gold a minute for as long as the Temple stands. Hands full, the priest can't heal or convert (**D** sets it down); if they fall, the relic drops where they stood, and a fallen Temple spills its relics. Keep **every relic** on the map in your side's temples as long as a wonder must stand, and you win.
- **Trade.** Two or three neutral **trading posts** stand out near the edge of every map, as far from one town as from the next. From the Bronze Age a **Market** trains **traders** (a pack donkey, then an ox cart, a covered wagon and a steam traction engine). Right-click a post and they run the road on their own: goods out, a chest of gold home. A trip pays by the square of the distance from the Market to the post (a Market far from the post pays far more), but nothing is paid until the trader is home, and cavalry ride traders down. **Caravans** and **Banking** at the Market speed them up and raise the pay. A Market's rally point on a post sends new traders straight onto the road.
- **Shelter.** Ring the **town bell** and every citizen runs into the nearest Town Center or tower, which shoot more arrows for each one inside; the all-clear sends them back to the work they left.
- **Control.** Queue orders with Shift, stances (aggressive, defensive, stand ground), attack-move, formations, control groups, rally points (on a resource, new citizens start gathering), idle-citizen and whole-army hotkeys.
- **A computer opponent** (Easy, Normal or Hard) that plays through the same commands you do: it balances its economy, hunts, farms, fishes, researches, trades at the market, builds walls of soldiers, rings its bell when raided, brings priests, heroes and siege, counters what you field and attacks in growing waves. On the water it builds warships; in the Industrial Age it flies fighters over its town and sends bombers against yours. It races for a wonder when it can. It saves for a Market when there are trading posts, keeps traders on the road that pays best without passing a rival town, and its riders cut rival trade roads near home.
- **Match options:** your people and colour, up to three rivals, a computer ally, six map types (Continental, Highlands, Lakes, Forest, Plains and the Inland Sea, a ring of land round a sea full of fish), three sizes, the starting epoch, a peace treaty, and three ways to play: **Conquest**, **Regicide** (each people has a King; lose them and you lose) and **Deathmatch** (everyone starts rich). Win by destroying every rival town, by keeping a **Wonder** standing until its countdown ends, or by keeping every relic as long.
- **Online play.** Make a room, share its code or link, and play with up to three friends and computer players, in teams or every one for themselves, with chat. If someone's connection drops they can reload and rejoin; if they leave, the computer takes over their people.
- **Saves and replays.** Matches save in the browser (and when you leave the page) and can be continued. Every match is recorded: watch it back at up to 8× speed through anyone's eyes, or download the replay to share.
- **After the match,** a timeline charts everyone's score, population, army and gathering, with the moment each reached a new epoch.
- **Tips for a first game** point the way, one at a time, and can be turned off.
- **Fog of war** shared by allies; enemy buildings stay as you last saw them until you look again.

## Graphics and sound

- **Faceted terrain.** Rolling meadows in soft colour patches, beaches, rock ridges and slopes that turn to cliff, with grass tufts, flowers and pebbles.
- **Lakes and seas** with turquoise shallows, foam along the shore, waves rolling in and sun glints. Fish shoals glitter at the surface, a fish leaping now and then.
- **Ships** ride the swell and roll, oars sweep, paddle wheels churn, nets dip; they leave a foam wake, steamers trail coal smoke, and a lost ship lists and goes down in spray and splinters. **Aircraft** fly high with their shadows racing over the ground, bank into turns and circle; hit, they spin down trailing smoke and crash.
- **Woods** of pines, broadleaves, birches and palms sway in the wind; trees being cut lie felled beside their stumps. Deer graze, wander and run.
- **Unit models for every line in every epoch,** each in its player's colour: clubmen in furs to halberdiers in morions, slingers to musketeers, horsemen to cuirassiers, rams, catapults and bombards, priests and monks, heroes from a feather-crowned Chieftain to a mounted Field Marshal, and every boat, warship, transport and plane. Legs walk, arms strike and shoot, rams swing, catapult arms fling, priests chant with raised staffs. All of it runs in one instanced draw per model, so big armies stay cheap.
- **Every building in five styles:** thatch and hide; mudbrick and terracotta; stone, timber and slate; brick and white trim; red brick, iron and smokestacks. Wonders go from a stone henge to a ziggurat, a cathedral with twin spires, a domed palace and an iron tower. Docks grow from a reed jetty to a steam crane; the airfield has a hangar, a control tower and a windsock. Buildings rise out of scaffolding, smoke from their chimneys, burn when damaged and collapse into rubble.
- **Effects:** arrows, bolts, spears and sling stones in flight, boulders and cannonballs that burst on landing, bombs that fall and explode in fire and black smoke, shells that throw up spray, musket smoke, the glow of a conversion, a wonder's glitter.
- **Lighting:** sun shadows that follow the camera, bloom on lit windows and gold, a sky dome, distance haze and circling birds.
- **Synthesized sound and music.** Every sound is made live with the Web Audio API (no audio files): steel on steel, bowstrings, catapults, cannon, axes, picks, hammers, the town bell, chants, war horns, fanfares, ship's bells, droning engines, machine guns, falling bombs and explosions, splashes. Units answer in made-up voices when picked and ordered. **Music** is composed as it plays, one style per epoch (drone and bone flute, lyre and frame drum, recorder and lute, harpsichord and strings, a brass band with oom-pah bass and snare), and the drums come in harder when a battle starts.
- **Graphics quality:** High (shadows, bloom), Medium (shadows) or Low. If the game runs below about 30 frames per second it steps down by itself and says so.

## Playing

The title screen plays a live match between two computer opponents behind it. Choose your match and press **Play**, or **Play online**.

| | |
|---|---|
| Select | Left-click; drag a box; Shift adds or removes; double-click (or Ctrl+click) picks every unit of that kind on screen |
| Command | Right-click: ground to move, enemy to attack (priests convert), resource to gather (fishing boats on a shoal), deer to hunt, a relic to fetch it (priests), a trading post to trade there (traders), your building site to build, a farm to work it, a Town Center or tower to shelter, your transport to board. With a loaded transport, right-click land to put them ashore there. **Shift** queues orders. With a building selected, sets its rally point |
| Build | Select citizens; **B** for town buildings (House **E**, Farm **F**, Storehouse **S**, Market **M**, Temple **Y**, Dock **D**, Wall **L**, Gate **G**, Wonder **X**, Town Center **T**), **V** for military ones (Barracks **B**, Archery Range **A**, Stable **C**, Forge **R**, Siege Workshop **K**, Watch Tower **W**, Airfield **F**). Drag to lay a wall. Shift+click places several |
| Town Center | **Q** citizen, **E** hero, **W** next epoch, **A S D** technologies, **R** ring the town bell, **T** all clear, **U** let them out |
| Other buildings | **Q** (W, E) train; technologies on the next keys; Market **Q W E** buy, **A S D** sell, **T** trader, **R F** technologies |
| Army | **A** then click: attack-move. **S** stop. **G** then click: shelter or board. **Z X C** stances. **D** a priest sets down their relic. **Del** delete |
| Transport | **U** then click a shore: land everyone there. **Y** land them on the nearest shore |
| Groups | **Ctrl+1–9** makes a group, **1–9** selects it, twice looks at it; **,** selects the whole army |
| Find | **.** next idle citizen, **H** Town Center, **Space** tap looks at the last attack |
| Camera | Arrow keys, screen edges, middle-drag or Space+drag to pan; wheel to zoom; **[** **]** turn; **Backspace** straightens |
| Other | **Alt** shows all health bars, **P** pause, **+**/**-** speed, **M** mute, **Enter** chat (online), **F10** or **Esc** menu |

## Run it

Building the game, as a person or an agent? Start with [AGENTS.md](AGENTS.md): the rules, the checks and how several agents share the work.

```bash
npm install
npm run dev        # http://localhost:5173 (single player)
npm run check      # typecheck + the quick tests: what to run while building (about 20 s)
npm test           # rules, AI, saving and determinism tests (Vitest)
npm run test:slow  # the slow tests in tests/slow/, which CI runs daily
npm run build      # typecheck (game and worker) + production build into dist/
npx tsx scripts/sim.ts 3 medium 30   # a headless computer-vs-computer match, minute by minute
```

Online play needs the Worker. To try it on your machine: `npm run build && npx wrangler dev`, then open http://localhost:8787 in two browser windows (one of them private, so each has its own player id). With `npm run dev` running as well, the dev server forwards `/api` to `wrangler dev`.

## Put it online on your subdomain (Cloudflare)

The game is a Cloudflare Worker that serves the built files, the same setup as Tideborn, plus a Durable Object for online rooms (one per room; it works on the free plan).

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository** and pick `Ages-of-earth`.
2. Set the **build command** to `npm run build` and the **deploy command** to `npx wrangler deploy`.
3. Add a **build variable** `NODE_VERSION` = `22` (Vite 8 needs Node 20.19+ or 22.12+).
4. Once deployed, open the Worker's **Settings → Domains & Routes → Add → Custom domain** and enter the subdomain, for example `ages.yourdomain.com`. Your domain must use Cloudflare for DNS; Cloudflare creates the DNS record and the certificate for you.

Instead of step 4, you can put the subdomain in `wrangler.toml` (there is a commented-out `routes` entry) so it is set on every deploy. The Durable Object binding and its migration are already in `wrangler.toml`; the first deploy creates them.

## How it is built

**Why Three.js.** Before building, I compared the options:

- **Three.js** is small (about 150 KB) and gives full control. It reuses Tideborn's code and deploy setup.
- **Babylon.js** has more built in, but its physics and navigation-mesh crowds aren't deterministic, so lockstep multiplayer would still need custom systems.
- **PlayCanvas's** main draw is its commercial team editor.
- **Godot 4** only has its WebGL 2 "Compatibility" renderer on the web (no Forward+ renderer, no WebGPU yet, no C#).
- **Unity's** empty web builds are about 8–11 MB before any game.

In an RTS the hard parts (a deterministic simulation, pathfinding and lockstep networking) are custom in any engine, and the look comes from lighting, art direction and instancing, which Three.js does well. Custom shader code is kept small and in one place (`render/materials.ts`, `render/water.ts`) so a move to Three.js's WebGPU renderer stays possible later.

**A deterministic simulation.** The rules run in fixed ticks, 20 a second, and the view draws between ticks at the screen's frame rate. Everything a player does becomes a command, and the computer opponent issues the same commands. The rules use only +, −, ×, ÷ and square roots (no `Math.sin`, `atan2`, `pow`, clocks or `Math.random`; a test enforces this), seeded randomness kept in the state, and id-ordered iteration. So the same seed and commands give the same match in every browser. That one property gives three features: saved games (a test checks a saved and reloaded match plays on identically), replays (a setup and a list of commands) and online play.

**Online, lockstep.** Each room is a Durable Object that keeps the clock: every 100 ms it sends every browser the commands that arrived as one numbered turn (two ticks). Each browser plays a turn's ticks only once it has the turn, so all of them run the same match; the room never runs the rules. It stamps each command with its sender's seat (nobody can command someone else's people), keeps every turn so a player who reloads replays back in, compares checksums the browsers report to catch any drift, and hands a departed player's people to the computer after 30 seconds.

**Movement.** Short trips use A* on the tile grid (eight directions, no corner cutting), pulled taut into straight lines. Long trips walk down a distance field grown once from the destination and shared by every unit going there, built with a bucket queue (Dial's algorithm) and cached. Gates let their own side through. Units push apart, slide along walls, re-route when stuck, and groups move in formation. The route work has a budget per tick.

**Rendering.** Models are built from primitives and baked into one geometry each, with colours in the vertices. Units are instanced per model with three per-instance values for animation (leg swing, arm swing, bob). A small shader addition swings tagged limbs about their joints, tints team-coloured parts and applies the fog of war, which is a texture every material reads.

## Code layout

- `src/sim/`: the rules, pure TypeScript with no rendering, so they run headless in tests.
  - `data.ts` every number (epochs, units, buildings, technologies, peoples, counters, costs, gathering rates, AI levels)
  - `types.ts` the state, orders, events and commands
  - `stats.ts` unit and building stats with technologies and the people's bonus applied
  - `mapgen.ts` the six map types: fair starts for 2 to 4 players, lakes and seas, ridges, woods, mines, deer, fish shoals, guaranteed connections
  - `path.ts` A* and shared distance fields; `grid.ts` tile helpers; `spatial.ts` the neighbour grid
  - `units.ts` what units do each tick (orders, gathering, hunting, fishing, building, fighting, healing, converting, sheltering, boarding and landing, walking, sailing and flying)
  - `combat.ts` blows, shots, splash, towers and the damage table; `animals.ts` deer
  - `commands.ts` every player action, checked and applied
  - `vision.ts` fog of war; `ai.ts` the computer opponent; `save.ts` saving to text and back; `relics.ts` relics carried, kept and let go; `trade.ts` trading posts, traders' roads and what a trip pays
  - `game.ts` creating a match and advancing it one tick, victory, score, the checksum
- `src/render/`: the Three.js view.
  - `view.ts` puts it together: lights, shadows, effects for game events, positional sound cues, picking
  - `unitModels.ts`, `buildingModels.ts` and `natureModels.ts` are the models; `kit.ts` the primitive kit and baking
  - `unitsView.ts` instanced, animated units, deer and corpses; `relicsView.ts` relics on the ground, carried and kept; `postsView.ts` the trading posts; `buildingsView.ts` buildings as the player knows them (walls join their neighbours); `resourcesView.ts` woods, mines and carcasses
  - `terrain.ts` the ground, decoration and fog texture; `water.ts` the lakes; `materials.ts` the shared shader additions
  - `overlays.ts` selection rings, health bars, shots, placement and wall previews, rally flag; `camera.ts`, `effects.ts`, `sky.ts`, `post.ts`
- `src/ui/`: `hud.ts` (resource bar, selection panel, command card, timers), `lobby.ts` (online rooms), `tips.ts`, `minimap.ts`, `thumbs.ts`, `icons.ts` and `style.css`.
- `src/audio/`: `sound.ts` the synthesized effects and voices, `music.ts` the generative music.
- `src/net/`: `protocol.ts` what browsers and rooms say to each other, `client.ts` the browser's connection.
- `src/main.ts`: the game loop, input, menus, saves, replays, online play and the title screen's live match.
- `worker/`: the Cloudflare Worker (`index.ts`) and the room Durable Object (`room.ts`); `wrangler.toml` their settings.
- `tests/`: 74 tests: map fairness and connectivity for every size, type and player count; gathering, hunting, building, farming, training and housing; command checks and refunds; epochs; the counter triangle in every epoch; technologies and peoples; the town bell and sheltering; priests, heroes and siege; the market; wonders; walls and gates; queued orders and stances; peace treaties; game modes; determinism, saving and the no-unsafe-math rule; full computer-vs-computer matches; the computer coming for a player who does nothing; relics placed fairly on every map, carried, kept, dropped, spilled and won with; trading posts placed fairly on every map, traders paid by the road, lost on the way home, finding another Market, rallied onto the road, ridden down by cavalry, saved and reloaded, and the computer trading; docks on the shore, fishing, sea fights and who can hit a ship, boarding and landing across the sea (wherever the ship lies), passengers lost with their ship, the Industrial Age, bombers, fighters and anti-aircraft fire, and determinism and saving with ships and planes.

## Status and next steps

- **Tested** headless with the tests above, and in headless Chromium through the real mouse and keyboard (box select, wall dragging, queued orders, stances, the bell, hunting) with no console errors. Online play was tested with two browsers against `wrangler dev`: lobby, seats, chat, start, commands crossing over, a player blocked from commanding another's town, pause, identical checksums, and rejoining after a reload. That browser renders on a software GPU, so frame rates on real laptops still need checking; the automatic quality step-down covers slow ones.
- **Balance is a first pass**, tuned with computer-vs-computer matches; human play will tell more.
- **Ideas for later:** more epochs (Atomic, Modern), trade ships between docks and coastal posts, the computer using transports for invasions, a campaign of scenarios, a map editor, ranked matchmaking.
