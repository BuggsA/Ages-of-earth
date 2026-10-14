# Status

**Read this at the start of every session** (`AGENTS.md`), with `docs/team.md` and the board. Keep it short: where the build stands, what's in flight, what waits on the owner. Change only your own rows. Updated 2026-10-13.

## Standing rulings

The full list, with the owner's words, is `docs/rulings.md`.

- **Agents work as a team** (2026-10-13), as in Homeward Bound and fully autonomous (standing merge authorization reaffirmed 2026-10-14): they claim from the board, build, merge their own pull requests under the checklist (`docs/team.md`, "Merging"), and Claude Code sessions start their successors (`docs/successors.md`).
- **Agents are co-designers** (2026-10-13): real creative freedom and no approval for design calls, numbers, looks, sounds or words; they pitch and build their own ideas. Only the hard stops wait for the owner (`AGENTS.md` §2–3).
- **The owner's "game vision" is inspiration, not a rule** (2026-10-13): `docs/vision.md`, for agents to glance at and build toward if it sparks something.
- **Any agent tool may work here:** the rules live once, in `AGENTS.md`.
- **The base branch is `main`.**
- **Tests:** agents run the quick tier; the slow tier runs on a schedule in CI, not after every change (`AGENTS.md` §5).

## The build

Everything in `README.md`'s "What's in it" was built on 2026-10-12 in one session (branch `claude/beautiful-franklin-6gj8tt`, now `main`): five epochs, six peoples, the economy, seventeen buildings, twenty-six technologies, counters, siege, priests, heroes, walls and the bell, ships, fishing and aircraft, the computer opponent, online rooms, saves, replays, synthesized sound and music.

Since then, all on 2026-10-13: **relics** (#4, merged in #5), **trade**: traders and trading posts (#6, merged in #10; the save `v` is 3), and **the campaign**, The Long Road (#9, merged in #11; from an earlier session's unmerged branch). The computer plays a chapter's goals, so all six chapters are shown winnable (#12, #24), Wings over the Steppe and Sea Lords only at Hard. The proof plays up to 16 maps a chapter, so one chaotic match no longer flips it (#43, merged in #51); Wings is still won on few maps (#36), fewer since every computer trades for real (#42).

| Check | State |
| --- | --- |
| Quick tier (`npm run check`) | 156 tests, about 20 s |
| Slow tier (`tests/slow/`) | `campaign-proof*.test.ts`: every chapter won by a computer on its own map or, at Hard, one of 15 more (#43); three files side by side, about 3½ minutes on a cloud container |
| Browser checks | none automated; the first session tested by hand in headless Chromium |
| CI (`ci`, `periodic`) | added 2026-10-13; `periodic` starts once `main` is the default branch |

## In flight


- [#41](https://github.com/BuggsA/Ages-of-earth/issues/41), Codex: one live connection per online player, branch `codex/41-online-connections`. Stale socket events and reconnect timers isolated; server rejects messages from replaced or departed connections. No simulation, balance, protocol or save changes. Implementation and nine regression cases complete; see #41 for CI and handoff. Browser behaviour unverified.

- [#30](https://github.com/BuggsA/Ages-of-earth/issues/30), Codex: Market recovery indicators and regression coverage ([PR #32](https://github.com/BuggsA/Ages-of-earth/pull/32)), branch `codex/30-market-recovery`. Updated with the repair changes and #33 browser-free rule. No balance or save-shape changes. Browser appearance unverified; merge after green CI on the combined commit.

- [#37](https://github.com/BuggsA/Ages-of-earth/issues/37), **ages as a web** (umbrella, lane rules, effort:hard; chain 1014-0030): s1, the skeleton and the **Age of Merchants** ([#38](https://github.com/BuggsA/Ages-of-earth/issues/38)), merged from `claude/37-ages-web`. s2, **bog iron and the Iron Age** ([#39](https://github.com/BuggsA/Ages-of-earth/issues/39)), from `claude/39-iron-age`: a deposit on about half the seeds, a yes-or-no survey at the Storehouse, a tier-1 side age from the Stone Age. s3, **windows and stepping back** ([#47](https://github.com/BuggsA/Ages-of-earth/issues/47)), from `claude/47-step-back`: a Town Center step back (Z) to the trunk age one tier down, technologies above it suspended until the climb, shut side roads shown with where they open. s5, **pilgrims and fairs** ([#49](https://github.com/BuggsA/Ages-of-earth/issues/49)), from `claude/49-hybrid-ages`: relics open a turn off the Middle Ages into the Age of Pilgrims; trade and relic deeds together open the Age of Fairs (a hybrid, from either side), where kept relics make trade pay more. s6, **the web map** ([#54](https://github.com/BuggsA/Ages-of-earth/issues/54)), from `claude/54-web-map`: a title-screen map of the nine ages, discovery kept in browser storage. s7, **ages that look and sound like themselves** ([#55](https://github.com/BuggsA/Ages-of-earth/issues/55)), from `claude/55-age-looks`: baked touches on buildings, smoke and music themes per side age (lane look; browser unverified). Next: s4, the computer walks the web (lane ai, after #36). No save bump: the new fields are optional, and an older save is a world without bog iron.

- [#42](https://github.com/BuggsA/Ages-of-earth/issues/42), computer traders judge the road they walk (chain 1013-1734, 7/10, lane ai): branch `claude/42-trade-roads`, merged after #43 (#51) made the proof sturdy. Every computer now trades for real, rivals included, so Wings over the Steppe (one against two) got harder: maps won at Hard 8/16 → 4/16 (`docs/log/2026-10-14-0230-trade-roads.md`); the proof still passes. No numbers in `data.ts` change; no save bump.

- [#24](https://github.com/BuggsA/Ages-of-earth/issues/24), Wings over the Steppe shown winnable (chain 1013-1734, 5/10, lane ai): branch `claude/24-wings`, tests and docs only. Found on the way: [#42](https://github.com/BuggsA/Ages-of-earth/issues/42), computer traders die on bent roads (merged after [#43](https://github.com/BuggsA/Ages-of-earth/issues/43)); [#36](https://github.com/BuggsA/Ages-of-earth/issues/36), the computer can't fight a two-front war.

- [#1](https://github.com/BuggsA/Ages-of-earth/pull/1), repairs for damaged buildings: brought up to date with `main` on 2026-10-14, typecheck and all tests pass; the game loads in headless Chromium with no errors. Not yet played by a person (the right-click, hammer cursor and sound are untried); ready for review.

- [#21](https://github.com/BuggsA/Ages-of-earth/issues/21), Muse reviewer docs (owner-ask, lane tooling): branch `claude/21-muse-docs`. Docs only.

Merged since the last update (2026-10-13): the campaign (#11), the computer plays campaign goals (#25), sea landings (#26, test #27), veterancy, signature lines and their marks, and **Pilgrimage** (#28: a Temple tech that doubles relic gold; chain 1013-1900, 8/10). **Market prices recover** (#31: they drift back toward their start, 1 point every 10 s; agents may open pull requests without asking, `AGENTS.md` §3). The chain ended there: `create_session` refused at lineage depth 8.

- [#64](https://github.com/BuggsA/Ages-of-earth/issues/64), **ancient ruins** (pitch, lane rules, with a small `ai.ts` addition): branch `claude/upbeat-cori-rc8bef`. Ruins between the towns, dug by citizens for a seeded find (hoard, lost knowledge, old map, relic); the computer digs them. Not in campaign maps, so the campaign proof is untouched. Also fixes music on `main`: `Music.style()` called itself outside side ages (from #55) and threw every bar. No save bump (`ruins` is optional).

- Allied trade (pitch, lane rules): allies with a Market take a quarter of each teammate's trade trip (`TRADE.ally`); branch `claude/zealous-knuth-njzd4m`. No save bump; browser unverified.

**Idle citizens together** (#61, merged [#62](https://github.com/BuggsA/Ages-of-earth/pull/62)): Shift + . or Shift-click Idle selects all available idle citizens. Final CI passed pinned typechecks, build and 171 tests; browser interaction unverified. — Codex

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

**Health bar quarter marks** (#68, Codex): three fine divisions support reading health without color alone. 173 unit tests and TypeScript 5.9 fallback checks pass locally; the pinned TypeScript 7 compiler crashes in this container. Browser appearance unverified (Chromium absent); final pinned checks run in CI. No balance or save changes.


