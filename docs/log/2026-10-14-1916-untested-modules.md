# Tests for untested modules

#129, at the owner's request ("There are some untested things in the repo"). New tests: `tests/rng.test.ts`, `spatial.test.ts`, `vision.test.ts`, `animals.test.ts`, `worker-routes.test.ts`, `ambience.test.ts` (31 tests, about 2 s together). The creature-voice rules moved from private `View` methods into `src/render/ambience.ts` (`nearWater`, `armyNear`, `wet`, `voiceFits`), same behaviour; the view only counts soldiers when the shore side already fits. No rules, numbers or save change.

Still untested directly: rendering classes, sound and music synthesis, HUD, lobby, minimap, tips and `main.ts` (they need WebGL, Web Audio or the DOM; the browser smoke test covers them loosely).
