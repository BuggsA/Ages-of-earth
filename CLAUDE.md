# Ages of Earth: rules and tips for working in this repo

A browser RTS (TypeScript, Three.js, Vite) deployed as a Cloudflare Worker. Read `README.md` for what exists and `docs/design-notes.md` for why.

## Rules

1. **The simulation is deterministic.** Code in `src/sim/` must not read the clock, `Math.random`, `Math.sin`/`atan2` and friends, or iterate anything in an unstable order. Use the match's own dice (`s.rng`). Online play, replays and saves depend on this; `tests/sim.test.ts` has a check for it.
2. **All rules and numbers live in `src/sim/data.ts`.** Rendering (`src/render/`), UI (`src/ui/`) and audio (`src/audio/`) only read the state; they never change it. Players change the game only through `Command`s.
3. **State must serialize.** Anything added to `GameState` has to survive `serialize`/`deserialize` (`src/sim/save.ts`) and be optional if old saves lack it.
4. **Before pushing, run `npm run typecheck && npm test`.** Add a test for every new rule (see `tests/campaign.test.ts` for the style). A change that touches the AI should also run `npx tsx scripts/sim.ts`; a campaign change, `npx tsx scripts/campaign.ts`.
5. **Match the surrounding code:** comment density, naming, plain English in comments and UI text.
6. **Branches and commits:** work on the branch the session names, small commits with clear messages, push when done. Don't open a pull request unless asked.
7. **Docs travel with code.** New features get a line in the README's feature list; new tests update its test count; design reasons go in `docs/design-notes.md`.

## One task, one session

When a task is finished (tests green, committed, pushed, README updated), stop. Do not start the next task in the same session: a long session drags stale context into new work. Instead, end with a short handoff (what was done, what is next, anything fragile) and start a fresh session for the next task, passing that handoff as its prompt (the `create_session` tool does this from inside a session). One task means one outcome that could be a pull request: a feature, a fix, a balance pass.

## Tips

- `npm run dev` serves the game; `?room=CODE` joins an online room. Chromium is preinstalled for headless checks (Playwright, no browser download).
- Quick feel for balance: `npx tsx scripts/sim.ts <seed> <size> <minutes>` (computer vs computer) and `npx tsx scripts/campaign.ts [normal|hard]` (a computer plays each campaign chapter).
- To test a rule, build a small match with `createGame`, give players `rich` resources, place buildings with `placeBuilding`, and `step` it; do not drive the UI.
- Campaign chapters (`src/sim/campaign.ts`) run inside the simulation: add a chapter by adding an entry, then check it with the two scripts and a test.
- The in-game tips (`src/ui/tips.ts`) teach one thing at a time; keep new ones short and tied to something the player just did.
- The browser can't be tested for frame rate here (software GPU); don't tune graphics from headless screenshots.
