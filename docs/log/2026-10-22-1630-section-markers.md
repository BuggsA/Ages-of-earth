# Section markers in the big files

Branch `claude/gallant-planck-rjveul`. Comments only; no code or numbers changed.

- Added 29 `// ---- Name ----` markers (the style `ai.ts` and `main.ts` already used) where long stretches had none: 9 in `src/sim/ai.ts`, 20 in `src/sim/data.ts` (whose first 1,300 lines had none). `src/main.ts` was already marked every few hundred lines.
- Why: an agent can now run `grep -n "^// ---- " <file>` to see a big file's outline and read only the section it needs, rather than the whole 2,500–4,600 lines. We chose this over a separate file map: a map has to be kept up to date by hand and costs tokens every session, while a marker sits beside its code.
- Each marker goes above the doc comment of the first thing in its section.
