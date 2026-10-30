# The deep mine m1: depth, layers and the cut-away (#926, umbrella #924)

- `STRATA` in `data.ts`: three layers (Clay and gravel, Bedrock, the Vein), each with finite stone/gold veins, a pace bonus over `SHAFT.grade`, room for miners, a sinking cost and time, and the band colour.
- `shafts.ts`: depth, veins, crews and places per layer, `deepen`/`deepenStep`; a spent vein digs at `SHAFT.grade` (rule 1). `units.ts`: several miners a shaft, a place at the face on arrival, moving down when a vein is spent. Commands `deepen` and `toLayer`.
- The computer sinks a shaft when its seam is spent in every layer it reaches (`SHAFT.aiSink` spare wood).
- The cut-away (`src/ui/cutaway.ts`) in the selection portrait, one status line, a Sink button (D), a tip; the pithead model grows with depth.
- Saves: new optional fields (`depth`, `deepening`, `worked`, the order's `layer`); an old shaft loads in the first layer. No `v` bump.
- Tests: `tests/deep-mine.test.ts`. Browser: screenshots of the panel at 1× in the pull request.
