# Spread overflow and storehouse builders (#266 leftovers), 2026-10-16

Owner's note: a group sent to gather all goes after one tree or bush. #266 fanned bulk orders over nearby nodes; two piles were left.

- `commands.ts`: when every node near the click was already full (`SPREAD.perNode`), the extras all fell back to the clicked tile. They now take the least crowded node.
- `units.ts`: citizens who finish a Storehouse all took the nearest tree, mine or bush. The player's builders now skip nodes already worked by `SPREAD.perNode` of their own people. The computer is unchanged.

Tested: `tests/spread-overflow.test.ts`, `npm run check` (596 pass). Browser: not tried. No numbers changed; no save bump.
