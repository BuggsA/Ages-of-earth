# Hemocraft s3: Blood Towers and grafted soldiers (#355)

- Blood is spent: the Blood Tower (Iron and Blood, Total War; 60 blood once, no upkeep; 3× a Watch Tower against the living, 0.15× against the bloodless) and the Transfusion Station (Total War; grafts sheltered soldiers, 40 blood and 4 s each).
- A graft (`Unit.hemo`): +20% blows, +15% pace, mends 1.5/s, no conversion; flesh blows ×0.6, machines ×1.5, Blood Tower ×1; fed within 10 tiles of a Station, runs dry 150 s away and crashes for a third of full health.
- No new `Command`, no new `UnitType`, no save bump. `scripts/sim.ts 3 medium 30` checksum unchanged (2804626271): the computer builds neither yet (s5).
- s3 before s2: blood had no use, and there is no tier 5 to fork into yet. Reasons on the issue.
