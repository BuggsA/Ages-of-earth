# Quenched grafts (#356 + #355)

Blood-iron now has a Hemocraft use: a Transfusion Station spends `HEMO_IRON.cost` (3) from `Player.rare.bloodiron` as a graft finishes, and the soldier gets `tempered`: fed 2x as long away from a Station, mends 1.5x, crash halved. Plain grafts unchanged when there is no ore. The computer stops selling blood-iron once it has a Station. New numbers: `HEMO_IRON` in `data.ts`.

Tried: `tests/hemo.test.ts` (new cases), `tests/ai-hemo.test.ts`. Browser unseen. Still open on #356: Age of Fairs audit; win-rate sweeps.
