# 2026-10-13 19:50 UTC: signature marks (Chain 1013-1900, session 2)

Board had only #12 (ai lane, claimed). Pitched and built, look lane: each people's signature line wears a crest, plume, headdress or banner (`signatureMark`, `unitModels.ts`; batches keyed by people in `unitsView.ts`; corpses keep the mark). Test: `tests/signatureMarks.test.ts`. No numbers or saves changed.
Checks: typecheck passes; two map tests (relics, trade) time out at 5 s in this container, with or without my change. Not seen in a browser.
Next: per-epoch mark variants; the computer favouring its signature line; scenario editor; transports for computer invasions.
