# The deep mine

The owner, 2026-10-30, in chat with Claude Code: "towards the end game resources get sparse and people are forced to use the market. I was trying to add a more robust mining system mid to late game where you can dig underground bring more resources and hopefully a wealth of others. Now there is the mine but it doesn't seem to be great or really thought out. I can almost see a layered mine shaft like Minecraft getting all types of resources that can be added later." And: view it "in a clean way … that really looks clean and natural". It also grows the owner's Deep Veins ask (#356: "going underground may provide more opportunity", resources "that don't even show up on all seeds").

**Why the Mine Shaft falls flat today** (`src/sim/shafts.ts`, `SHAFT`): one miner, never runs out, 30–75% of an open deposit's pace, and the only choice is which seam. It never grows and never asks a question, so the Market stays the better answer once the open deposits are gone.

## The idea

A Mine Shaft is sunk **down through layers**. Each layer holds its own seams, its veins run out, and the next one down is richer and harder. What lies under a spot depends on the seed and the place, so where you sink matters. The mine becomes the late game's second economy beside the Market, and it feeds it: gems and spare rare ores sell for gold.

| Depth | Holds (first draft) | What it asks of you |
| --- | --- | --- |
| 1 Clay and gravel | stone | cheap and quick, soon spent |
| 2 Bedrock | stone, gold | timber props, or risk a cave-in |
| 3 The vein | gold and the rare ores (salt, saltpetre, blood-iron) where the ground holds them | the long haul up: a winch |
| 4 The wet deep | gems, sold at the Market | floods without a pump (Industrial); Water Road peoples pump cheaper |
| 5 The hot deep | glowcaps, crystal | heat and bad air; ties into the Deep Road's vents |

Layers live in one table, `STRATA` in `data.ts`: each layer lists its seams, weights and costs. **A later resource is one entry** (coal, iron, obsidian, amber…).

## Steps (umbrella #924; area `mine` of `lane:rules`)

- **m1, depth and layers:** `STRATA`, sinking a shaft one layer deeper (wood, time, the shaft stops working while it sinks), finite veins per layer, a working place per miner on each layer, the cut-away panel. Stone and gold only. The computer sinks deeper when a layer runs dry.
- **m2, props, cave-ins and blasting** (built, #929): shore a layer with wood, or dig unshored faster with a chance of a cave-in on the match's dice that kills its miners; from the Gunpowder Age blast a new layer open at once, with a chance of firedamp. The pithead is a target: a burnt winch strands the miners below.
- **m3, the ground below differs** (built, #931): the seed lays strata by region (rich and poor ground, rare seams under some places only); the Prospector's Lodge takes **core samples** (a striped borehole column on the map); the U key shows the underground view.
- **m4, the wet deep** (built, #937): gems, sold at the Market at a price every seller shares; water that rises in the layer from the day it is reached, with an inrush on the match's dice on a full basket; the pump (a steam engine from the Industrial Age, or a windmill pump for a people that walked the Age of Dykes), which a hurt pithead stalls. Wet ground floods faster, and a core shows it.
- **m5, the hot deep:** glowcaps and crystal, beside the Deep Road (vents, Delvings and the Undercity may tunnel into a mine).

## Rules for every step

1. **Never worse than today, never starved.** A shaft whose layers are all spent still digs at today's `SHAFT.grade`, so the simple path stands. Stone and gold in layers 1–3 lie under every town's land on every seed and map type, with a test across maps and seeds (the owner, 2026-10-29: "makes sure to not make the resources impossible to get").
2. **Deterministic** (`AGENTS.md` §4): veins, cave-ins and strata come from the match's seed and its dice, in id order.
3. **Every number in `data.ts`** (`STRATA`, `SHAFT`).
4. **The computer digs** in the same step that adds the thing it digs, props and pumps.
5. **Saves:** new fields optional so old saves load; a shaft from an old save sits at layer 1.
6. **The verbs test** (`docs/verbs.md`): "After it, I now dig down where the cores show gold, and choose between props and speed." The door: wood and miners spent underground, a pithead in the open.

## How it reads (the owner: clean and natural)

Research (2026-10-30, in chat): full 3D undergrounds are where "everything I try to make it pretty makes it less functional" ([3D Maps are Hard](https://goodgourdgames.substack.com/p/3d-maps-are-hard)); show levels ghosted rather than hidden ([Factorio forum](https://forums.factorio.com/viewtopic.php?p=628327)); one key for the underground view ([Cities: Skylines](https://www.dedoimedo.com/games/cities-skylines-underground.html)). So:

- **No 3D underground.** The world stays on the surface; the pithead (headframe, winch, spoil heap) grows as the shaft goes deeper, so a rival sees a deep mine from outside.
- **The cut-away, in the selection panel.** Select a shaft and a side-on slice slides open: layers as bands in the game's low-poly palette, seams as glints in them, tiny miners at their faces, water seeping where it floods. The layer being worked is bright; layers below are ghosted until reached; spent veins are dulled; unshored props show cracks. Clicking a layer sends the selected miners there. Text is a single line under it (seam, pace, what's left), never a table.
- **Core samples on the map:** a short striped column at the sample spot, the same banding as the cut-away, so the two read as one language.
- **U for underground:** the surface fades, pitheads and cores stand out; U again, or Esc, returns.
- **No new toasts** beyond a cave-in or flood on your own shaft. Legible at true size: screenshot the panel at 1× in the pull request.
