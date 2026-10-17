# Seed Atlas meets Deep Veins (#395)

Codex added `--ore`, `--no-ore`, `--caves` and `--dens`; tables/JSON report ores and cave counts, and surveys report ore frequency and mean cave/den counts. Atlas enables both deposit layers exactly as ordinary matches do. Existing filters, share addresses, simulation and save format are unchanged. No balance numbers changed.

Evidence: 669 unit tests passed; the five existing slow Seed Atlas tests passed (9.05 s). New coverage checks filters, conflicts, ordinary-map agreement (including a guarded cave), scan partitions and survey values. TypeScript 5.9.3 checks of game and Worker passed as an environment fallback: the installed native compiler panics because `/proc/self/exe` is absent. The combined quick check uses the fallback temporarily; no dependency or lockfile changes are committed. GitHub CI uses the installed compiler.

CLI smoke through Node's tsx loader: medium continental, salt + bloodiron, no saltpetre, at least one cave → seeds 3 and 19, valid share addresses; guarded-cave JSON → one matching hit; one-seed survey → six map types with new columns. The tsx CLI itself cannot create its IPC socket here, so Node loaded tsx directly. No game rendering changed; no browser session or sound check performed.

Next: spoiler-light clues for worlds. No remaining implementation work on this step.
