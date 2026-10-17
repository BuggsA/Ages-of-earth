# The fork: Hemocraft or the Blood-rite (#355 s2)

Chain 1017-0106, session 7. Branch `claude/355-hemocraft-fork`.

- Two tier-4 side ages, `hemocraft` and `bloodrite`, each a branch path (`Path.branch = 'blood'`, `pathLine`), turning off the Industrial Age for a people that walked Total War. Each road `shuns` the other (`roadProblem`).
- Hemocraft: Drain Rigs bleed living enemies near them each second (`HEMOCRAFT`, `fork.ts`); grafts cheaper and fed farther (`graftCost`, `feedReach` in `hemo.ts`). No priests or traders.
- Blood-rite: Temples draw blood like rigs (`drawBlood`) and mend the people's own living from the store (`RITE`). No Station; siege dearer.
- HUD lines, tips (`fork`, `hemocraft`, `bloodrite`), drain mist and sound, music, minimap colours, town dressing, web-map row 5.
- Why not a real tier 5: `epoch` indexes arrays in ~165 places; a read-only test keeps Total War's single road out; another keeps one age per tier on a path.
- The computer ignores the fork (no `ai.ts` change): s5.
- Browser unseen.
