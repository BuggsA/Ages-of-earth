# AGENTS.md: Ages of Earth

Read this first, whichever agent you are (Claude Code, Codex or another). Claude Code reaches it through `CLAUDE.md`. Every rule here is the one copy: other files and issues link to it and never repeat it.

## 1. What this is

A real-time strategy game in the browser, in the spirit of Empire Earth and Age of Empires: five epochs, six peoples, an economy, armies, navies and aircraft, against the computer or online. TypeScript + Three.js + Vite, served by a Cloudflare Worker with a Durable Object per online room. What's in the game: `README.md`. What players love about the genre, and what's not built yet: `docs/design-notes.md`.

Several agents build it, joining and leaving at any time. How they share the work (the board, claims, lanes, merging): **`docs/team.md`**. Where the build stands and what waits on the owner: **`docs/status.md`**. Read both at the start of every session.

## 2. Who decides

1. The owner's rulings, quoted in `docs/rulings.md`.
2. This file.
3. `README.md` and `docs/design-notes.md` for what the game is.
4. Your judgment, for how to build it. Taste (what's fun, how it looks and sounds, the numbers) is the owner's: you can't play the game, so never declare a mechanic fun. Build it, keep its numbers in `src/sim/data.ts`, and flag it for the owner's playtest.

## 3. Keep moving

On a call that is the owner's, pick the default the docs favour (else the simplest), keep it cheap to change, flag it under "Flags for the owner" in the pull request and in `docs/status.md`, and carry on. Flags never block a merge.

**Hard stops** are the only reasons to pause. Ask on the issue, with options and a concrete case each, and label it `owner-decision`:
- spending money (paid plans, new paid services);
- destroying work (rewriting `main`, deleting others' branches, issues or files);
- Cloudflare changes that delete stored data (removing or renaming a Durable Object class, a `deleted_classes` migration);
- exposing secrets or weakening security (the Worker is public: a room must never let one player command another's people);
- a change to `wrangler.toml`'s routes or domains.

## 4. Rules that hold the game together

- **The rules are deterministic.** `src/sim/` uses only + − × ÷ and square roots: no `Math.sin`, `atan2`, `pow`, clocks or `Math.random`; randomness is seeded and kept in the state; iteration is in id order. A test enforces it. Online play, saves and replays all depend on it.
- **The rules never touch rendering.** `src/sim/` imports nothing from `src/render/`, `src/ui/` or `src/audio/`, so it runs headless in tests and in `scripts/sim.ts`.
- **Every number lives in `src/sim/data.ts`.** Changing an existing number is flag-and-continue; list it in the pull request.
- **Tests are read-only.** Never edit or delete a test to make it pass: fix the code, or raise the conflict on the board. Moving a test file unchanged between tiers (below) is fine.
- **API grounding.** Read the installed source or the docs for the exact version in `package.json` before using a library call. Three.js changes between versions.

## 5. Checks: three tiers

The owner, 2026-10-13: tests "can often eat a lot of the build time … each agent might do a check after each change." So agents run only the quick tier; the slow tier runs on a schedule.

| Tier | Command | Runs | Time today |
| --- | --- | --- | --- |
| Quick | `npm run check` (typecheck + unit tests in `tests/`) | by you, as often as you like while building | about 20 s |
| Merge | the `ci` workflow (build + unit tests) | by GitHub on every push to a pull request and to `main` | a minute or two |
| Full | `npm run check:full` (build, unit tests and the slow tests in `tests/slow/`) | by GitHub daily on `main` (the `periodic` workflow), or on demand | under a minute: `tests/slow/` is empty |

- **Keep the quick tier quick:** under 2 minutes in all. A new test that takes over 10 seconds goes in `tests/slow/`: browser runs, long computer-vs-computer matches, sweeps over many seeds. If the quick tier passes 2 minutes, open an issue to move the slowest tests.
- **Don't run the full tier after each change.** Before merging, run once only the slow test files that cover what you changed (`npx vitest run --mode slow tests/slow/<file>`).
- **A red `periodic` run** opens or updates an issue labelled `ci-periodic` and `ready`. It goes ahead of new features: fix it, or revert the pull request that caused it.
- **Read CI logs yourself** through the GitHub tools (`actions_list`, `get_job_logs`). Never merge past a red check you haven't read.
- The trade-off, accepted: a break only the slow tier catches can sit on `main` for up to a day. GitHub's Revert undoes it.

## 6. Done means

- `npm run check` passes and the `ci` check is green on the final commit.
- If you changed what the player sees or does, you tried it in a browser (`npm run dev`; cloud containers have Chromium at `/opt/pw-browsers/chromium`) and said how in the pull request.
- The pull request ends with `## Verification`: each claim paired with its evidence (`command → output`, or `file:line`). A claim without evidence is marked unverified. Never write "verified" for something you didn't run.
- `docs/status.md` updated (your rows only) and one new file in `docs/log/` (`YYYY-MM-DD-HHMM-<topic>.md`, UTC).

## 7. Commands

- Build (typecheck, game and Worker): `npm run build`
- Quick check: `npm run check`; tests only: `npm test`; slow tests: `npm run test:slow`
- Run the game: `npm run dev`; with online rooms: `npm run build && npx wrangler dev`
- A headless match: `npx tsx scripts/sim.ts 3 medium 30`

## 8. Saving tokens without a worse game

- Read `docs/status.md` and your issue; read older `docs/log/` entries only when the task needs their history.
- Search first, then read the lines you need. Send long output to a file and read its tail.
- GitHub tools: small pages, `minimal_output`, an issue's newest comments.
- One step per session, then hand off (`docs/team.md`).
