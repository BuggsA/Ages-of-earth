# Blood heirlooms (#355 s6)

Chain 1017-1400, session 1. Branch `claude/355-blood-heirlooms`.

- **Galvanic Blood** (Workshop, Lightning + Hemocraft, `veins` mod): `hemoStep` (`hemo.ts`) feeds a graft in a Watch Tower's reach (`inField`).
- **Military Orders** (Temple, Pilgrims + Warband, `sworn` mod): `sworn()` in `blood.ts`; checked by the `convert` command, `convertStep` (a chant under way breaks), `riteProblem` (sacrifice and curse) and `curse()` (a sworn neighbour is spared); priests mend soldiers `ORDERS.mend` (1.5) times as fast (`healStep`).
- HUD: ⚜ Sworn badge; the graft tooltip names the towers once Galvanic Blood is learned. Marks: a glass blood tank wound with copper by the Workshop; a red war banner, shield and sword by the Temple.
- The computer researches both first once open (`TECH_ORDER`) and no longer picks a King, a graft or a sworn soldier to convert.
- `PATHS.blood.planned` stays non-empty (two tests read it), reworded to "more Blood heirlooms".
- `tests/heirlooms.test.ts` listed the heirlooms exactly. Asked on #355 (A/B/C); the owner: "your choice". Chose B: the line now checks the list includes the first seven, so new heirlooms never need to touch it (`docs/rulings.md`, 2026-10-17).
- Tests: `tests/blood-heirlooms.test.ts` (9).
