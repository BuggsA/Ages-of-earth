# Art direction (#617)

The owner, 2026-10-23: "the game looks mushy. Hard to tell things apart … I don't think people would play because it looks good." High priority until 2026-10-24, when the owner lowered it (`docs/rulings.md`): now ordinary `ready` work. This file is how several agents fix it at once and still make one game.

## The bar

At a glance, at the default zoom, a player can tell: ground from objects; a unit from a building from a tree; their own people from a rival's; a soldier from a citizen, and one line of soldiers from another; what is hurt, selected or under attack. And it looks good enough that a stranger would want to play.

**Keep** (`AGENTS.md` §2): low-poly; colours baked into the vertices; a style for each epoch; instanced draws, so big armies stay cheap; the frame rate on the Low setting. Everything else about the look is open.

## Areas: five chains at once

The art is split into areas with their own hot files, so up to five agents work side by side, one claim and one chain per area (`docs/team.md`, "Lanes"). Each area has its own issue under #617, with `area:<name>` in its title.

| Area | Its hot files (`src/render/` unless said) | What it answers for |
| --- | --- | --- |
| `area:light` (#622) | `daylight.ts`, `sky.ts`, `weather.ts`, `post.ts`, `materials.ts`, `camera.ts`, the lights in `view.ts` | light, shadow, sky, haze, rain, tone and colour grading, the camera's angle; **the palette below** |
| `area:ground` (#623) | `terrain.ts`, `water.ts`, `natureModels.ts`, `resourcesView.ts`, `seasonLook.ts`, `grazeView.ts`, `borderView.ts` | ground, water, trees, bushes, mines, borders: the stage everything stands on |
| `area:units` (#624) | `unitModels.ts`, `unitsView.ts`, `kit.ts` | silhouettes and scale of every unit, team colour on units, telling lines apart |
| `area:buildings` (#625) | `buildingModels.ts`, `buildingsView.ts`, `foundationView.ts`, `rubbleView.ts`, the small `*View.ts` props (ruins, landmarks, relics, posts, finds, caches, kegs) | silhouettes of buildings by type and epoch, team colour on buildings |
| `area:overlays` (#626) | `overlays.ts`, `rangeGuides.ts`, `effects.ts`, `src/ui/minimap.ts`, `src/ui/style.css` (in-world readability only) | selection, health bars, hit and death effects, the minimap's colours |

- **Shared files** (`view.ts`, `kit.ts`, `materials.ts`): add, don't restructure. A change another area depends on goes in its own small pull request, merged first.
- **Not in this split:** the ambient life (`birds`, `bats`, `owls`, `crows`, `fireflies`), the HUD's layout and icons. Take them as a sixth step once the five have landed.

## The palette (owned by `area:light`; everyone builds to it)

Readability comes mostly from *value* (light against dark), then saturation, then hue. Until `area:light` replaces them with measured numbers, the working targets are:

- **Ground** is the quietest thing on screen: mid-to-low value, low saturation. Woods a step darker than open ground, so a clearing reads.
- **Objects stand off the ground** by value: units and buildings clearly lighter or darker than what they stand on, with a readable edge (shadow, rim or outline: `area:light` and `area:units` choose).
- **Team colour** is the most saturated colour on a unit, big enough to read at the default zoom, and never used by the land.
- **Weather and haze** never hide the play area at the default zoom; they colour it.

### Measured palette (area:light, 2026-10-24)

Luminance `L` is WCAG relative luminance of the sRGB value (0 black, 1 white); `S` is HSV saturation. Measured on the 2026-10-24 build: grass `#92b45c` is L 0.40 / S 0.49, a tree canopy `#4f9a45` is about L 0.25, and a unit's brown is about L 0.2: everything sits in one band (L 0.2–0.4), which is the mush. The bands below pull the layers apart; build to them.

| Layer | L | S | Notes |
| --- | --- | --- | --- |
| Open ground (grass, dry, dirt) | 0.16–0.26 | ≤ 0.40 | Today's `GRASS` is too bright and too green by a third: aim near `#6f8a4c` (L 0.22). Sand and snow may run lighter (to 0.55) as they are rare |
| Woods floor, under trees | 0.10–0.16 | ≤ 0.40 | A clearing reads by being one step lighter than the woods |
| Water | 0.10–0.30 | 0.35–0.60 | Cooler than land (hue 190–220°) and darker than grass at the shore; foam is the only bright thing |
| Tree canopies, bushes | 0.08–0.20 | 0.40–0.55 | Darker than the ground; berries and ore are the bright spots |
| Buildings and walls | ≥ 0.42 (walls, thatch, stone) or ≤ 0.08 (roofs in shadow) | ≤ 0.45 | Lighter than the ground by ≥ 0.15 L, never green |
| Roofs (every epoch) | ≤ 0.07 or ≥ 0.37 | ≤ 0.55 | WCAG L at least 0.15 from grass `#6f8a4c` (L 0.221). Held in `STYLES` and `ROOFS` (`buildingModels.ts`); teal trade `#1a5961`, war slate `#3e4858`, storehouse gold `#e2b855` (#617) |
| Unit body (skin, cloth, armour) | ≥ 0.40 or ≤ 0.08 | ≤ 0.45 | Same rule; no mid-brown on mid-green |
| Team colour | 0.18–0.50 | ≥ 0.65 | Set by `PLAYER_COLORS` (`src/sim/data.ts`; red, gold and orange moved apart in hue): blue `#2f7fe0`, red `#d9364a`, gold `#f0c828`, green `#3aa35a`, violet `#9b59d0`, orange `#e8702a`. A test holds them ≥ 0.55 S and 20° apart in hue |
| Never in the land | | | Pure blues, reds, violets, oranges at S ≥ 0.55 (the team hues), except flowers and berries under 0.3 m wide |

**Light** (this area's own numbers, in `view.ts` and `daylight.ts`): keep the sun strong and low enough to cast a readable shadow, and let the fill and sky lights stay under the sun so shapes have a lit and a shaded side. Weather lowers contrast but must leave ground and objects ≥ 0.1 L apart.

**Checking a change:** colours are linear in the shader, so measure the *screenshot*: the ground and an object beside it should differ by 0.15 L or more at the default zoom.

## Every age has a look (#803)

The owner, 2026-10-25: "each age should have a distinct or unique look." Each age past the five trunk epochs has a palette and touches in `src/render/ageLooks.ts` (the 17 older ages keep theirs in `buildingModels.ts`, `ageTouches`). A new age adds both; `tests/age-palettes.test.ts` fails an age without them, or two ages whose house or Town Center match. Palettes keep to the bands above, and trim stays muted (≤ 0.45 S): a trunk model may lay trim over whole walls.

## How each step works

1. **Research first, if you like** (the owner invites it): how the genre's best stay readable (AoE II DE and IV, Northgard, Against the Storm, Bad North, Townscaper, Kingdom Two Crowns). Short findings on your area's issue, and anything every area needs goes in this file.
2. **Before and after, every time:** `npx vite build && (npx vite preview --port 5199 --strictPort &)`, then `node scripts/look/shots.mjs <dir>` takes the same three scenes (`stone-start`, `battle`, `town`) for everyone. Put both sets in the pull request, or describe them if you can't attach images. Add a scene to the script if your area needs one.
3. **Merge `main` often:** the other areas change what yours looks like. Re-take your shots after merging.
4. **Checks:** `npx vitest run tests/models.test.ts` builds every model; `npm run check` before merging. The pull request says "Decision it gives the player: none: look" and what reads better now.
5. **Designers' notes** as usual, and the area's issue keeps a checklist of its steps.
