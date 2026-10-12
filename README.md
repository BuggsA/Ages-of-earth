# Ages of Earth

A real-time strategy game in the browser, in the spirit of Empire Earth: lead your people from the Stone Age through the Bronze Age and the Middle Ages to the Gunpowder Age, gather food, wood, stone and gold, build a town, raise an army and destroy your rival. It is built with TypeScript and Three.js, the same stack and low-poly look as Tideborn, and deploys the same way: a Cloudflare Worker serving static files, ready for a subdomain of your own domain.

## What's in this first slice

- **Four epochs.** Stone, Bronze, Middle Ages and Gunpowder. Advancing costs food, wood, gold and stone and takes time at the Town Center. When you advance, every unit re-arms (clubman to spearman to pikeman to halberdier) and every building is rebuilt in the new style, keeping its share of health.
- **An economy.** Citizens gather berries, wood, stone and gold and carry it to a Town Center or a Storehouse. Farms feed one citizen each and never run out. Houses make room for 5 more people (up to 150). Builders go back to what they were gathering when the building is up.
- **Eight buildings:** Town Center, House, Farm, Storehouse, Barracks, Archery Range, Stable and Watch Tower. Town Centers and towers shoot at enemies in range.
- **The counter triangle.** Infantry deal triple damage to cavalry, archers double to infantry, cavalry more than double to archers. Armor and attack differ by unit and epoch. The tests check that each counter wins its duel in every epoch.
- **A computer opponent** (Easy, Normal or Hard). It plays through the same commands you do. It grows its town, keeps its citizens spread over the four resources (shifting them as stockpiles change), builds houses before it runs out of room, puts storehouses by far woods and mines, sows farms when the berries run out and advances through the epochs. It trains an army that counters what you field, defends its town, and attacks in waves that grow over time.
- **Fog of war.** Unexplored land is hidden under deep slate, and explored land out of sight is dimmed and greyed. Enemy buildings stay as you last saw them until you look again.
- **Win by conquest:** destroy every building and unit of your rival (fields alone don't count).

## Graphics and sound

- **Faceted terrain.** Rolling meadows in soft colour patches, beaches, rock ridges, and slopes that turn to cliff. Grass tufts, flowers and pebbles are scattered over it.
- **Lakes.** Turquoise shallows, deep blue middles, foam along the shore, waves rolling in, sun glints and a sky sheen.
- **Woods.** Pines, broadleaves, birches and palms sway in the wind. Trees being cut lie felled beside their stumps. Berry bushes and mines shrink as they are worked.
- **Sixteen unit models, one per line per epoch,** each in its player's colour: clubmen in furs, spearmen with crested bronze helmets and round shields, pikemen in kettle helms and tabards, halberdiers in morions and breastplates, slingers, archers, crossbowmen, musketeers in plumed hats, horsemen, knights in caparisons and cuirassiers on black horses. Citizens change clothes with the epochs too.
- **Animated units.** Legs walk, arms strike, shoot, chop, mine, build and farm. The fallen topple over, lie a while and sink away. All of this runs in one instanced draw per model, with no skeletons, so big armies stay cheap.
- **Thirty-two building models:** eight buildings in four styles. Thatch and hide huts round a fire pit; mudbrick, terracotta and columned porches; stone keeps, timber framing and slate roofs; brick, white trim, tile roofs and a domed clock tower. Buildings rise out of scaffolding on their sites, smoke from their chimneys, burn when damaged and collapse into rubble.
- **Shots in flight.** Arrows and crossbow bolts arc, sling stones fly, and musket balls streak out of a puff of smoke.
- **Lighting.** Sun shadows that follow the camera, bloom on lit windows and gold, a sky dome, distance haze, and birds circling overhead.
- **Synthesized sound.** Every sound is made live with the Web Audio API, so there are no audio files: steel on steel, bowstrings, musket shots, axes, picks, hammers, collapsing buildings, war horns when you are attacked, an epoch fanfare. Sounds are placed left to right by where they happen and fade with distance. Wind and birdsong play underneath.
- **Graphics quality.** High (shadows, bloom), Medium (shadows) or Low. If the game runs below about 30 frames per second, it steps down by itself and tells you.

## Playing

The title screen plays a live match between two computer opponents behind it. Pick the opponent's difficulty, the map size, your colour, a map seed and the graphics quality, then press Play.

| | |
|---|---|
| Select | Left-click; drag a box; Shift adds or removes; double-click (or Ctrl+click) picks every unit of that kind on screen |
| Command | Right-click: ground to move, enemy to attack, resource to gather, your building site to build, a farm to work it; with a building selected, sets its rally point |
| Build | Select citizens, press **B**, then the building's key (House **E**, Farm **F**, Storehouse **S**, Barracks **B**, Archery Range **A**, Stable **C**, Watch Tower **W**, Town Center **T**). Shift+click places several |
| Train | Town Center: **Q** citizen, **W** advance to the next epoch. Barracks, Range, Stable: **Q** |
| Army | **A** then click: attack-move. **S** stop. **Del** delete |
| Groups | **Ctrl+1–9** makes a group, **1–9** selects it, pressing it twice looks at it |
| Find | **.** next idle citizen, **H** Town Center, **Space** tap looks at the last attack |
| Camera | Arrow keys, screen edges, middle-drag or Space+drag to pan; wheel to zoom (Shift+wheel pans); **[** **]** turn; **Backspace** straightens |
| Other | **Alt** shows all health bars, **P** pause, **+**/**-** game speed, **M** mute, **F10** or **Esc** menu |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # rules, AI and determinism tests (Vitest)
npm run build      # typecheck (game and worker) + production build into dist/
npx tsx scripts/sim.ts 3 medium 30   # a headless computer-vs-computer match, minute by minute
```

## Put it online on your subdomain (Cloudflare)

The game is a Cloudflare Worker that serves the built files, the same setup as Tideborn.

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository** and pick `Ages-of-earth`.
2. Set the **build command** to `npm run build` and the **deploy command** to `npx wrangler deploy`.
3. Add a **build variable** `NODE_VERSION` = `22` (Vite 8 needs Node 20.19+ or 22.12+).
4. Once deployed, open the Worker's **Settings → Domains & Routes → Add → Custom domain** and enter the subdomain, for example `ages.yourdomain.com`. Your domain must use Cloudflare for DNS; Cloudflare creates the DNS record and the certificate for you.

Instead of step 4, you can put the subdomain in `wrangler.toml` (there is a commented-out `routes` entry) so it is set on every deploy.

## How it is built

**Why Three.js.** Before building, I compared the options:

- **Three.js** is small (about 150 KB) and gives full control. It reuses Tideborn's code and deploy setup.
- **Babylon.js** has more built in, but its physics and navigation-mesh crowds aren't deterministic, so lockstep multiplayer would still need custom systems.
- **PlayCanvas's** main draw is its commercial team editor.
- **Godot 4** only has its WebGL 2 "Compatibility" renderer on the web (no Forward+ renderer, no WebGPU yet, no C#).
- **Unity's** empty web builds are about 8–11 MB before any game.

In an RTS the hard parts (a deterministic simulation, pathfinding and lockstep networking) are custom in any engine, and the look comes from lighting, art direction and instancing, which Three.js does well. The view uses the mature WebGL renderer. Custom shader code is kept small and in one place (`render/materials.ts`, `render/water.ts`) so a move to Three.js's WebGPU renderer stays possible later.

**A deterministic simulation.** The rules run in fixed ticks, 20 a second, and the view draws between ticks at the screen's frame rate. Everything a player does becomes a command for the next tick, and the computer opponent issues the same commands. The rules use only +, −, ×, ÷ and square roots (no `Math.sin`, `atan2`, `pow`, clocks or `Math.random`; a test enforces this), seeded randomness, and id-ordered iteration. So the same seed and commands give the same match in every browser, checked by a checksum test. That is the foundation for lockstep online play, where the server only relays each tick's commands.

**Movement.** Short trips use A* on the tile grid (eight directions, no corner cutting), pulled taut into straight lines. Long trips walk down a distance field grown once from the destination and shared by every unit going there, so an army marching across the map costs one field, not one search per soldier. Fields are built with a bucket queue (Dial's algorithm) and cached. Units push apart, slide along walls, re-route when stuck, and groups move in formation. The route work has a budget per tick.

**Rendering.** Models are built from primitives and baked into one geometry each, with colours in the vertices. Units are instanced per model with three per-instance values for animation (leg swing, arm swing, bob). A small shader addition swings tagged limbs about their joints, tints team-coloured parts and applies the fog of war, which is a texture every material reads.

## Code layout

- `src/sim/`: the rules, pure TypeScript with no rendering, so they run headless in tests.
  - `data.ts` every number (epochs, units, buildings, counters, costs, gathering rates, AI levels)
  - `types.ts` the state, orders, events and commands
  - `mapgen.ts` the world: fair starts, lakes, ridges, woods, mines, guaranteed connections
  - `path.ts` A* and shared distance fields; `grid.ts` tile helpers; `spatial.ts` the neighbour grid
  - `units.ts` what units do each tick (orders, gathering, building, fighting, walking, pushing apart)
  - `combat.ts` blows, shots, towers and the damage triangle
  - `commands.ts` every player action, checked and applied
  - `vision.ts` fog of war
  - `ai.ts` the computer opponent
  - `game.ts` creating a match and advancing it one tick, plus the checksum
- `src/render/`: the Three.js view.
  - `view.ts` puts it together: lights, shadows, effects for game events, positional sound cues, picking
  - `unitModels.ts`, `buildingModels.ts` and `natureModels.ts` are the models; `kit.ts` the primitive kit and baking
  - `unitsView.ts` instanced, animated units and corpses; `buildingsView.ts` buildings as the player knows them, sites, scaffolding, rubble; `resourcesView.ts` woods and mines
  - `terrain.ts` the ground, decoration and fog texture; `water.ts` the lakes; `materials.ts` the shared shader additions
  - `overlays.ts` selection rings, health bars, shots, placement preview, rally flag; `camera.ts` the strategy camera; `effects.ts`, `sky.ts` and `post.ts` (adapted from Tideborn)
- `src/ui/`: `hud.ts` (resource bar, selection panel, command card, tooltips, notices), `minimap.ts`, `thumbs.ts` (portraits rendered from the 3D models), `icons.ts` and `style.css`.
- `src/audio/sound.ts`: the synthesized sound engine (adapted from Tideborn).
- `src/main.ts`: the game loop, input, menus and the title screen's live match.
- `worker/index.ts`: the Cloudflare Worker; `wrangler.toml` its settings.
- `tests/sim.test.ts`: 23 tests covering:
  - map fairness and connectivity on every size;
  - gathering all four resources, building, farming, training and the housing limit;
  - command checks and refunds;
  - builders resuming their work;
  - all four epochs, and cavalry, stables and towers waiting for the Bronze Age;
  - the counter triangle in every epoch, Town Center arrows and attack-move;
  - formations and long-distance routing;
  - determinism and the no-unsafe-math rule;
  - full computer-vs-computer matches (Hard beats Easy);
  - the computer coming for a player who does nothing.

## Status and next steps

- **Tested** headless with the tests above and full computer-vs-computer matches on every map size. The worst simulation tick on the largest map is about 20 ms, the average well under 1 ms. Also played in headless Chromium through the real mouse and keyboard (box select, right-click gather, build menu and placement, training by hotkey), with no console errors. That browser renders on a software GPU, so frame rates on real laptops still need checking; the automatic quality step-down covers slow ones.
- **Balance is a first pass.** Computer-vs-computer matches (Normal against Hard) mostly end between minutes 18 and 28. Against a player who does nothing, on a medium map, the first attack comes at about minute 13 on Easy, 9 on Normal and 7½ on Hard. Human-vs-AI tuning needs real play.
- **Next, roughly in order:**
  1. Online play: a Durable Object room that relays each tick's commands to every browser (lockstep), with a lobby and room codes like Tideborn's.
  2. Walls and gates.
  3. Siege units (rams, catapults, cannons).
  4. Garrisoning in towers and Town Centers.
  5. Saving and loading.
  6. More epochs (Renaissance, Industrial).
  7. Ships and air units.
  8. Heroes.
  9. Music.
