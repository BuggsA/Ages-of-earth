# Patrol and explore, s1 (#454), 2026-10-17

Owner's note #454: patrol and auto-explore for scouts, boats, planes and troops.

- Rules: orders `patrol` (`pts`, `i`, `miss`) and `explore` (`x`, `y`, `fails`) in `types.ts`; commands `patrol` (x, y; with `queue`, appends a waypoint) and `explore`. Steps `patrolStep`, `exploreStep`, `exploreTarget`, `roundFight` in `units.ts`; the attack order gains `back`, taken up again when the fight ends.
- New numbers: `PATROL = { scan: 6, provoke: 0.5, misses: 4, points: 8 }`, `EXPLORE = { grid: 4, apart: 12, fails: 8, shun: 6 }`. No existing number changed.
- Input: Q (patrol, a click; Shift keeps the mode and adds points), E (explore), on any selection with non-citizens; the minimap click patrols too in patrol mode. Status text "Patrolling (n points)" / "Exploring".
- Validation: patrol points must be finite and are clamped to the map. Wagons can't patrol or explore. Two lines added to `tests/command-ownership.test.ts`'s every-command table (its comment asks for one per new command).
- Saves: no `v` bump (new optional order kinds). The computer doesn't use them yet, so the sim checksum holds.
- Found on the way: the dawn haze (#445) caught every click on the map. Fixed separately in #462.
