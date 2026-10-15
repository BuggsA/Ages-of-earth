# Hunters hunted (#260)

Own pitch, lane ai, toward "Richness" (the owner, 2026-10-14): a far hunt should be a gamble, not only against wolves.

- `prowl`, `prey`, `rivalCamp` in `src/sim/ai.ts`; called from `military` between waves, clever levels only, not while a chapter holds, never in a peace treaty. The band is dropped from memory when a wave marches (it marches with it).
- New numbers: `AI_PROWL = { band: 2, most: 3, reach: 40, safe: 12, guard: 7, odds: 2, chase: 8, look: 10, time: 45, every: 75 }`.
- New memory fields (optional): `AiMemory.prowl`, `.prowled`. No save bump: older saves load without them.
- Fog: prey must be in the computer's sight (`vis`); a camp only once seen (`seen`).
- Frequency, two Hard computers, small map, seeds 1–6, 20 minutes: 0, 1, 1, 2, 2, 0 forays.
