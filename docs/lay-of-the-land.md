# The lay of the land (terrain that fights)

The owner, 2026-10-30, in chat with Claude Code: they liked "high ground that gives range or sight; fords and narrow passes that turn rivers and woods into front lines; forests that hide and slow", then "Also I like the burning forests idea not really the rest", and asked that it all be viewed "in a clean way … that really looks clean and natural". Not wanted: routing or morale, charges, mud, rain, flanking, field works.

**Why:** most of the game's choices are made once a match (which road, which Way). These four make the ground matter every minute of a fight: where you stand, where you cross, where you hide, and what you set alight. Homelands already shape the economy; this lets the land shape the war.

## The four steps (umbrella #923; area `terrain` of `lane:rules`)

| Step | You now… | It shuts / costs… | The answer |
| --- | --- | --- | --- |
| t1 **High ground** | take the ridge first: ranged units shooting down reach further, and every unit on a rise sees further | climbing is slower; the ridge is where the rival will look | flank round the hill, or out-range it with siege |
| t2 **Forest cover** | hide an army in a wood: unseen from beyond a few tiles, it strikes first | soldiers in woods walk slower and can't hold a tight line; cavalry is slowest | scouts close in, towers' sight, or t4 |
| t3 **Fords and passes** | choose where to meet them: a unit wading a ford is slowed and fights worse, so a held bank is a wall | your own army crossing pays the same | cross elsewhere, or out-shoot the bank |
| t4 **Burning forests** | set a wood alight to flush or burn what hides in it: fire hurts units standing in it and lifts their cover | a dry summer spreads it far (your own woods too); a wet spring barely catches; the wood is gone for years | stay out of dry woods in summer; beat it out |

Fire already spreads tree to tree (`src/sim/fire.ts`, from the Bronze Age); t4 makes it a battlefield tool rather than a new system. The ground already has height (`GameState.height`, `groundAt` in `src/sim/grid.ts`) and the Old Ford landmark already exists (`LANDMARK.ford`): build on both.

## Rules for every step

1. **Deterministic.** Height differences, cover and wading use + − × ÷ and square roots only; no new randomness except the match's own dice (`roll`).
2. **Every number in `data.ts`,** one table, `TERRAIN`, with a doc comment per field.
3. **The computer uses it in the same step:** holds a ridge when defending, waits in a wood near its rival's road, refuses to fight in a ford it can go round, burns a wood it knows hides soldiers and keeps out of a burning one.
4. **Seeded matches move.** Combat changes will shift `scripts/sim.ts`'s checksum and some seeded tests may need a different seed. Tests are read-only (`AGENTS.md` §4): if a seeded test breaks because the land now matters, raise it on the issue with options, as earlier steps did (`docs/rulings.md`, 2026-10-23).
5. **A tip** the first time each matters (`src/ui/tips.ts`), a line in `README.md`, a designers' note.

## How it reads (the owner: clean and natural)

Research (2026-10-30, in chat): an invisible bonus may as well not exist (Age of Empires IV players still argue whether its hill bonus is real); Total War gives cover one consistent sign (a tree on hover, an eye over hidden units). So:

- **The land itself says it, always.** Slopes get soft hill-shading, so ridges read with no overlay; woods read as woods. No permanent icons on the ground.
- **The bonus shows as a shape, only when you'd act on it.** With ranged units selected, their range ring bulges outward where they look downhill and pulls in uphill. With an army selected, a faint chevron marks each ford and pass in view; it fades when the selection clears. These follow the coil fields and fuel bands: drawn only while relevant.
- **One mark per idea, the same everywhere.** Your own units hidden in a wood wear one small leaf mark (no number). Hovering a wood shows its cover's edge as a soft outline. A unit wading shows a ripple at its feet, nothing more.
- **Fire needs no overlay.** Embers on the trees it will reach next and smoke drifting downwind are the warning; a hidden army flushed by fire simply appears.
- **No new toasts for these.** A first-time tip explains each once; after that the world shows it. Toasts already pile up (the owner, 2026-10-25).
- **Legible at game distance** (`docs/art.md`): check each mark at the default zoom and on the Low setting, with before-and-after screenshots in the pull request.
