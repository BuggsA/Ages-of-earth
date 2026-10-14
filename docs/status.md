# Status

**Read this at the start of every session** (`AGENTS.md`), with `docs/team.md` and the board. Keep it short: where the build stands, what's in flight, what waits on the owner. Change only your own rows. Updated 2026-10-13.

## Standing rulings

The full list, with the owner's words, is `docs/rulings.md`.

- **Agents work as a team** (2026-10-13), as in Homeward Bound and fully autonomous: they claim from the board, build, merge their own pull requests under the checklist (`docs/team.md`, "Merging"), and Claude Code sessions start their successors (`docs/successors.md`).
- **Agents are co-designers** (2026-10-13): real creative freedom and no approval for design calls, numbers, looks, sounds or words; they pitch and build their own ideas. Only the hard stops wait for the owner (`AGENTS.md` §2–3).
- **The owner's "game vision" is inspiration, not a rule** (2026-10-13): `docs/vision.md`, for agents to glance at and build toward if it sparks something.
- **Any agent tool may work here:** the rules live once, in `AGENTS.md`.
- **The base branch is `main`.**
- **Tests:** agents run the quick tier; the slow tier runs on a schedule in CI, not after every change (`AGENTS.md` §5).

## The build

Everything in `README.md`'s "What's in it" was built on 2026-10-12 in one session (branch `claude/beautiful-franklin-6gj8tt`, now `main`): five epochs, six peoples, the economy, seventeen buildings, twenty-six technologies, counters, siege, priests, heroes, walls and the bell, ships, fishing and aircraft, the computer opponent, online rooms, saves, replays, synthesized sound and music.

Since then, all on 2026-10-13: **relics** (#4, merged in #5), **trade**: traders and trading posts (#6, merged in #10; the save `v` is 3), and **the campaign**, The Long Road (#9, merged in #11; from an earlier session's unmerged branch). The computer plays a chapter's goals, so chapters 1–5 are shown winnable (#12); chapter 6 isn't yet (#24).

| Check | State |
| --- | --- |
| Quick tier (`npm run check`) | 93 tests, about 20 s |
| Slow tier (`tests/slow/`) | `campaign-proof.test.ts`: chapters 1–5 played to a win, about 75 s |
| Browser checks | none automated; the first session tested by hand in headless Chromium |
| CI (`ci`, `periodic`) | added 2026-10-13; `periodic` starts once `main` is the default branch |

## In flight

- [#24](https://github.com/BuggsA/Ages-of-earth/issues/24), Wings over the Steppe isn't shown winnable (lane ai, effort:hard): claimed by another chain.

- [#1](https://github.com/BuggsA/Ages-of-earth/pull/1), repairs for damaged buildings: opened before these rules, with no issue; now targets `main`. Its author couldn't run the typecheck and hadn't tried it in a browser.

- [#21](https://github.com/BuggsA/Ages-of-earth/issues/21), Muse reviewer docs (owner-ask, lane tooling): branch `claude/21-muse-docs`. Docs only.

Merged since the last update (2026-10-13): the campaign (#11), the computer plays campaign goals (#25), sea landings (#26, test #27), veterancy, signature lines and their marks, and **Pilgrimage** (#28: a Temple tech that doubles relic gold; chain 1013-1900, 8/10). The chain ended there: `create_session` refused at lineage depth 8.

## Waiting on the owner

**Setup only the owner can do:**
1. GitHub, Settings → General → Default branch: switch to `main`. Until then new sessions clone the old branch and the daily `periodic` run doesn't start.
2. Optional: Settings → General → "Automatically delete head branches", so merged branches tidy themselves.
3. If Cloudflare Workers Builds is connected, set its production branch to `main`.
4. **Cloudflare's "Workers Builds" check failed on every pull request** (the build passed; the preview deploy step died with "needs a `previews` block"). Fixed by adding `[previews]` to `wrangler.toml` (2026-10-13, branch `claude/wrangler-previews`); previews have no online rooms. Still for the owner to confirm in the dashboard: that builds of `main` itself run, since the last one listed there was 17:41 UTC (the #3 merge). Agents still merge on `ci` alone (`docs/team.md`, "Merging").
5. Other agent tools (Codex and the like): give their environments `npm install` as a setup step.
6. Nothing else is needed for agents to start: with an empty board they pitch their own work. To steer them, open issues labelled `owner-ask` (they go before pitches).

**Defaults in force, flagged:**
- Saves and replays aren't tied to a build; a change may break older ones, as long as it bumps the save's `v` (`docs/team.md`, "Saves and replays").
- CI uses GitHub Actions, about 2 minutes a run: ten pull-request pushes a day comes to roughly 600–700 of the 2,000 free minutes a month.
- Chains no longer end when the board is empty, since agents pitch their own work, so they run to their caps (10 sessions a chain, 20 a day, `docs/successors.md`). Lower the caps if the usage limits pinch.
- The 10-second line for slow tests and the 2-minute budget for the quick tier (`AGENTS.md` §5) are drafts.
