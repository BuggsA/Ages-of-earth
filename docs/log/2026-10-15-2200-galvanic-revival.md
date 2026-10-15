# Galvanic Revival (#240, Chain 1015-1020 s3, lane rules)

Heirloom `galvanic` (Workshop, Reclaimers + Lightning, epoch 4, 250 wood 200 gold, mod `galvanic`): repairs in a Tower's field are unpaid and 1.5× quicker (`units.ts` buildStep); dug ruins in a field pay 25 gold per 30 s (`src/sim/galvanic.ts`, `GALVANIC` in data.ts). In `TECH_ORDER`; `heirlooms.test.ts` pin extended; three tests in `tests/elmo.test.ts`. `npm run check`: 435 passed. Browser, sound, marks and the computer deliberately seeking ruin sites unseen. No save bump.
