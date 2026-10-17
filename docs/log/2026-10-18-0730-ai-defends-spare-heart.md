# The computer defends its spare Town Center (#452 follow-up)

No rule change was needed: `threatNear` in `src/sim/ai.ts` measures enemy soldiers against every building the computer owns, so a raid on the spare Town Center already draws the army (`a-move` to the nearest threat). Added `tests/ai-defend-spare-heart.test.ts` to pin it: with its army at the first Town Center and three rival soldiers at the second, at least two defenders close on the second within 12 s. No sim numbers changed. Left alone: the town bell still reads only the main Town Center (`v.tc`).
