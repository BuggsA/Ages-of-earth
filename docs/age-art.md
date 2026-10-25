# Age art: every age looks, and feels, like its own

The owner, 2026-10-25: "a real different look. Not a color change … the button icons for upgrades and making people should look different … iconic to the age." And, of the first pass (palettes #803, plates #814): "better, but I think it was rushed. Can each agent work it individually instead. Not one agent doing it all. One agent doing a manageable chunk, whether 1 building, person or button, or the whole age." So this is worked **by chunk, by many agents, with care**, not in one sweep. Umbrella: [#816](https://github.com/BuggsA/Ages-of-earth/issues/816) (chunks are claimed there; there is no issue per age).

## What there is now (a first pass, to be improved on)

- **Palettes and touches** for every age: `src/render/ageLooks.ts` (#803).
- **Plates** (shape + motif + glyph stamp) for the command buttons of all 45 ages: `src/ui/ageIcons.ts` (#814). Good enough to see the idea; any age's plate may be redone.
- **Pictures** on the buttons are the age's own models (`thumbs.ts` takes the age).
- **Hand-made art per age**, in one file each, `src/ui/ageArt/<age>.ts` (`AgeArt`): an **emblem** (on the age-up button that leads to the age), **glyphs** drawn in SVG in place of the emoji for research buttons (`tech:<id>`), and an optional **plate** override. Worked examples: the Bronze Age's mirror and the Stone Age's flint-bladed plow. Everything is empty until someone draws it.

## Pick a chunk

Take **one** chunk, finish it well, and say so on #816. Small is welcome: a single glyph is a whole task.

| Chunk | What you do | Where |
| --- | --- | --- |
| **A button** | Draw one research glyph, or the age's emblem, as SVG (32 by 32). | `src/ui/ageArt/<age>.ts` |
| **A plate** | Redo the age's plate shape, motif or stamp so it is unmistakably that age. | `ageArt/<age>.ts` (`plate`, `stamp`), or `AGE_ICONS` |
| **A building** | Give one building a silhouette of this age's own: not a recolour, a different shape (what would this age's people actually raise?). | `src/render/buildingModels.ts`, `ageLooks.ts` (`ageTouches`) |
| **A person** | Give one unit line a look of this age: clothes, kit, stance, silhouette. | `src/render/unitModels.ts`, `ageLooks.ts` (`ageHat`, `ageScarf`) |
| **The whole age** | All of the above for one age, if you want it to be yours. Worth doing only if you'll carry each part to the bar below. | all of the above |

Most research glyphs are shared by every age (a Farm tech looks the same in Stone and Industry). A drawn glyph in an age's file replaces the emoji **only while the player is in that age**; so a good chunk is "this age's own versions of the buttons its people press".

## Claiming

- Comment on the umbrella [#816](https://github.com/BuggsA/Ages-of-earth/issues/816): `Claiming: branch <name>, <date>. Chunk: <emblem | glyph tech:plow | plate | building farm | person archer | whole age>. Files: <list>.` Hold one claim at a time. Chunks in different ages never share a file; two chunks in one age (say a building and a glyph) don't either, unless both touch `buildingModels.ts`: then the second waits for the first to merge (`docs/team.md`, "Lanes").
- **One chunk a session.** Don't sweep several ages, or several chunk types, in one session; finish one well and hand on (`docs/successors.md`, "Continue or spawn?").
- Never edit `src/ui/ageArt/index.ts` or `types.ts` to add your art; your age's own file is all you need. If you need a new hook, make it its own small pull request first.

## The bar: what "iconic" means here

- **It is recognisable at 26 pixels,** in one glance, as a thing of that age: a silhouette, not detail. Squint. If you could swap it with another age's and nobody would notice, it isn't done.
- **Not a recolour, not a rotation.** The plate colours and the stamp are the starting point, not the work. A building or person must differ in shape.
- **From the age's own story:** its verb and door in `AGES[<age>]` (`src/sim/data.ts`), `docs/age-roads.md`, and the real history or myth it draws on. Real peoples and faiths are drawn with respect (`AGENTS.md` §2).
- **Of a piece:** low-poly, a few flat shapes, colours baked into vertices for models; SVG with `currentColor` (the age's ink) for glyphs, plus at most two or three colours of your own.
- **Honest about what you've seen.** Look at your chunk in a browser before and after (below) and put both in the pull request.

## Looking at your chunk

```
npx tsx scripts/age-sheet.ts /tmp/sheet.html <age> [<age> …]   # plates, emblem and drawn glyphs, with the game's CSS
```
Screenshot the page with the browser at `/opt/pw-browsers/chromium` (Playwright's `chromium.launch()`), or open it. To see it live: `npm run dev`, start a match, press `H` to select the Town Center, and use the dev hooks in `window.ages` (`ages.rivers(0)` and the like) to move to an age; buildings and units are seen on the map and in the button pictures.

## Done means

`npm run check` passes (`tests/age-art.test.ts` keeps drawings to inert SVG shapes and emblems distinct; `tests/age-icons.test.ts` keeps plates distinct); a before-and-after picture in the pull request; one line in the pull request on what it gives the player ("none: look" is normal); and a `docs/log/` entry. Tick your chunk on #816.
