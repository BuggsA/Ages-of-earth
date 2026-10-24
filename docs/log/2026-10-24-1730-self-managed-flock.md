# Self-managed flock

Owner ask: sheep farming took too many clicks. A person's steppe people now keeps its flock on its own (`src/sim/shepherd.ts`, `SHEPHERD` in `data.ts`), once every 2 seconds:

- the Town Center raises a lamb while there is room and 80 food to spare beyond the 60 it costs;
- idle citizens within 14 tiles of a camp take to milking, a ewe each (they already walk on to the next ewe and carry the milk home);
- once the flock is full, one idle citizen slaughters a sheep fattened past breeding.

A 🧑‍🌾 button on the Town Center turns it off (`shepherd` command). It is set at the start of a game for human players (solo and online), so saves from before keep tending by hand until toggled. The computer tends its own flock in `ai.ts`, unchanged. Numbers are new, none changed.

Not seen in a browser; tests in `tests/shepherd.test.ts`.
