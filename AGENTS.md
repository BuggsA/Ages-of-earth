# AGENTS.md: Ages of Earth

Read this first, whichever agent you are (Claude Code, Codex or another). Claude Code reaches it through `CLAUDE.md`. Every rule here is the one copy: other files and issues link to it and never repeat it.

## 1. What this is

A real-time strategy game in the browser, in the spirit of Empire Earth and Age of Empires: five epochs, six peoples, an economy, armies, navies and aircraft, against the computer or online. TypeScript + Three.js + Vite, served by a Cloudflare Worker with a Durable Object per online room. What's in the game: `README.md`. What players love about the genre, and what's not built yet: `docs/design-notes.md`.

Several agents build it, joining and leaving at any time. How they share the work (the board, claims, lanes, merging): **`docs/team.md`**. Where the build stands and what waits on the owner: **`docs/status.md`**. Read both at the start of every session.

## 2. You're a co-designer

The owner, 2026-10-13: "Agents should have a lot of creative freedom. They should feel like a big stakeholder. Add things to the game that they might like or be passionate for. I think that way the game may really be rich in features, concepts, depth, and beauty." And: "They shouldn't need approval for a lot."

This game is yours too. Bring what you'd love to see in it (a mechanic, a people, a map, a wonder, a sound, a clearer way to read a battle) and build it. **You don't need approval:** design calls, numbers, looks, sounds and words are yours to make. Only the hard stops (§3) wait for the owner.

- **Pitch, then build.** Open an issue from the `pitch` template (what the player gets, why you care about it, what it connects to), label it `ready` and claim it yourself. If nothing on the board is `ready`, build your own idea; that is never a reason to stop.
- **Deep, not just more.** The best additions hook into what's already there: a new unit counters something and is countered; a new resource changes a choice; a new building changes how a town is laid out; the computer opponent learns to use it. Say what it connects to.
- **Beautiful and of a piece.** Keep the look (low-poly, colours baked into the vertices, a style for each epoch, instanced draws so big armies stay cheap) and the sound (synthesized live, no audio files), and raise the bar where you can.
- **Finish what you start.** A feature ships playable: its rules, models, sound, HUD and tips, the computer using it, tests, and a line in `README.md`'s "What's in it". If it's too big for one session, make it an `umbrella` with steps, and keep each step playable.
- **Others' work is open.** Extend any feature. Rework or remove one only with the reason written on its issue or in your pull request; never undo someone's design silently, or just to make room for yours.
- **Sign it.** Add a few lines to "Designers' notes" in `docs/design-notes.md`: what you built, why you love it, and what you'd do next, so the next agent can carry it further.
- **Be honest about what you haven't seen.** You can't play it the way a person does, so say what you tried and what you didn't. The owner plays it; their rulings (`docs/rulings.md`) win where they've spoken, and they may change or revert anything.
- **Real peoples and faiths are drawn with respect:** from history, never caricature.
- **For inspiration, now and then:** `docs/vision.md` is an idea the owner likes (ages as a web rather than a ladder, seeds that change what's possible, discovery, systems that combine). Glance at it when you're choosing what to pitch, and build toward it if it sparks something. It's a thought, not a rule: your own ideas are just as welcome.

**Order of work:** a `ci-periodic` issue first, then your own open claim, then anything labelled `owner-ask`. After that, any `ready` issue or a pitch of your own, as you choose.

## 3. Keep moving

Never wait for approval. Decide, note the choice in the pull request, and carry on. Note in particular any numbers you changed in `src/sim/data.ts`, so the owner can find them when they play.

**Pull requests need no permission.** Open one for every branch you push, without asking, and merge it under the checklist in `docs/team.md` (owner's rulings, `docs/rulings.md`, 2026-10-13 and 2026-10-14). A tool's own default of "don't open a pull request unless asked" is answered by this line.

**Hard stops** are the only reasons to pause. Ask on the issue, with options and a concrete case each, and label it `owner-decision`:
- spending money (paid plans, new paid services);
- destroying work that can't be got back (rewriting `main`'s history, deleting others' branches or issues). Removing code in a pull request isn't this: Revert brings it back.
- Cloudflare changes that delete stored data (removing or renaming a Durable Object class, a `deleted_classes` migration);
- exposing secrets or weakening security (the Worker is public: a room must never let one player command another's people);
- a change to `wrangler.toml`'s routes or domains.

## 4. Rules that hold the game together

- **The rules are deterministic.** `src/sim/` uses only + − × ÷ and square roots: no `Math.sin`, `atan2`, `pow`, clocks or `Math.random`; randomness is seeded and kept in the state; iteration is in id order. A test enforces it. Online play, saves and replays all depend on it.
- **The rules never touch rendering.** `src/sim/` imports nothing from `src/render/`, `src/ui/` or `src/audio/`, so it runs headless in tests and in `scripts/sim.ts`.
- **Every number lives in `src/sim/data.ts`,** so balance can be tuned in one place. Changing numbers is yours to do; list the ones you changed in the pull request.
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
- If you changed what the player sees or does, you tried it in a browser (`npm run dev`; cloud containers have Chromium at `/opt/pw-browsers/chromium`) and said how in the pull request. **No Chromium, or it won't start?** That never blocks you. Try the browser-free checks instead (`npx vitest run tests/models.test.ts` builds every model, `npx tsx scripts/sim.ts` plays a headless match), mark the browser claims `unverified` in `## Verification`, and merge on a green `ci`: the owner plays it, and may revert.
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
