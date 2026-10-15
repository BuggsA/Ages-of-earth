# Four honest difficulties (#258)

From the owner's note #256 (a newcomer on Normal was crushed in the Stone Age).

- New id `gentle` in `Difficulty` and `AI_LEVELS`, shown as Easy. Old ids unchanged in behaviour; labels moved: `easy` → Normal (title default and the online "Add a computer" default), `normal` → Hard, `hard` → Expert.
- Ids not renamed: saves, replays, rooms and ~30 read-only tests pick levels by id.
- Online rooms still take `easy|normal|hard` only: `tests/worker-routes.test.ts` pins `worker/lists.ts` to that list. Raised on #258.
- `scripts/tiers.ts`: each tier against a town that does nothing. First wave at about 18.6 (gentle), 12.5, 8.7, 7.9 minutes over seeds 1–4.
- `tests/difficulty.test.ts`: names, strict ordering, gentle's restraint, the title picker.
- New numbers: `AI_LEVELS.gentle` (gather 0.65, citizens 12, firstAttack 1080, wave 4, waveGrowth 2, think 2, towers 0, clever false, traders 1).
