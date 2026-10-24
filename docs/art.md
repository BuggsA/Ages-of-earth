# Art direction (#617)

The owner, 2026-10-23: "the game looks mushy. Hard to tell things apart … I don't think people would play because it looks good." High priority (`docs/rulings.md`). This file is how several agents fix it at once and still make one game.

## The bar

At a glance, at the default zoom, a player can tell: ground from objects; a unit from a building from a tree; their own people from a rival's; a soldier from a citizen, and one line of soldiers from another; what is hurt, selected or under attack. And it looks good enough that a stranger would want to play.

**Keep** (`AGENTS.md` §2): low-poly; colours baked into the vertices; a style for each epoch; instanced draws, so big armies stay cheap; the frame rate on the Low setting. Everything else about the look is open.

## Areas: five chains at once

The art is split into areas with their own hot files, so up to five agents work side by side, one claim and one chain per area (`docs/team.md`, "Lanes"). Each area has its own issue under #617.

| Area | Its hot files (`src/render/` unless said) | What it answers for |
| --- | --- | --- |
| `area:light` | `daylight.ts`, `sky.ts`, `weather.ts`, `post.ts`, `materials.ts`, `camera.ts`, the lights in `view.ts` | light, shadow, sky, haze, rain, tone and colour grading, the camera's angle; **the palette below** |
| `area:ground` | `terrain.ts`, `water.ts`, `natureModels.ts`, `resourcesView.ts`, `seasonLook.ts`, `grazeView.ts`, `borderView.ts` | ground, water, trees, bushes, mines, borders: the stage everything stands on |
| `area:units` | `unitModels.ts`, `unitsView.ts`, `kit.ts` | silhouettes and scale of every unit, team colour on units, telling lines apart |
| `area:buildings` | `buildingModels.ts`, `buildingsView.ts`, `foundationView.ts`, `rubbleView.ts`, the small `*View.ts` props (ruins, landmarks, relics, posts, finds, caches, kegs) | silhouettes of buildings by type and epoch, team colour on buildings |
| `area:overlays` | `overlays.ts`, `rangeGuides.ts`, `effects.ts`, `src/ui/minimap.ts`, `src/ui/style.css` (in-world readability only) | selection, health bars, hit and death effects, the minimap's colours |

- **Shared files** (`view.ts`, `kit.ts`, `materials.ts`): add, don't restructure. A change another area depends on goes in its own small pull request, merged first.
- **Not in this split:** the ambient life (`birds`, `bats`, `owls`, `crows`, `fireflies`), the HUD's layout and icons. Take them as a sixth step once the five have landed.

## The palette (owned by `area:light`; everyone builds to it)

Readability comes mostly from *value* (light against dark), then saturation, then hue. Until `area:light` replaces them with measured numbers, the working targets are:

- **Ground** is the quietest thing on screen: mid-to-low value, low saturation. Woods a step darker than open ground, so a clearing reads.
- **Objects stand off the ground** by value: units and buildings clearly lighter or darker than what they stand on, with a readable edge (shadow, rim or outline: `area:light` and `area:units` choose).
- **Team colour** is the most saturated colour on a unit, big enough to read at the default zoom, and never used by the land.
- **Weather and haze** never hide the play area at the default zoom; they colour it.

Write the measured palette here (values for ground, woods, water, each team colour) when it lands.

## How each step works

1. **Research first, if you like** (the owner invites it): how the genre's best stay readable (AoE II DE and IV, Northgard, Against the Storm, Bad North, Townscaper, Kingdom Two Crowns). Short findings on your area's issue, and anything every area needs goes in this file.
2. **Before and after, every time:** `npx vite build && (npx vite preview --port 5199 --strictPort &)`, then `node scripts/look/shots.mjs <dir>` takes the same three scenes (`stone-start`, `battle`, `town`) for everyone. Put both sets in the pull request, or describe them if you can't attach images. Add a scene to the script if your area needs one.
3. **Merge `main` often:** the other areas change what yours looks like. Re-take your shots after merging.
4. **Checks:** `npx vitest run tests/models.test.ts` builds every model; `npm run check` before merging. The pull request says "Decision it gives the player: none: look" and what reads better now.
5. **Designers' notes** as usual, and the area's issue keeps a checklist of its steps.
