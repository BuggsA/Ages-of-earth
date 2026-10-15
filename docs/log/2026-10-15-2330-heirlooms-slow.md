# Move ai-rival-heirlooms to the slow tier

`tests/ai-rival-heirlooms.test.ts` took ~14 s of its 15 s limit and timed out once under load. Moved unchanged to `tests/slow/` (import paths `../src` → `../../src` only). Nothing in the rules changed; no numbers changed.
