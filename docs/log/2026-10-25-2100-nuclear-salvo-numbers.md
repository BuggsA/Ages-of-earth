# #773: why the computer never fired a salvo

Probe (scratchpad, not committed): 3-way hard medium matches from the Atomic Age, 8 seeds × 35 min.

- Before: 87 single strikes, 0 salvos. Seats with Launch Control and 3 silos did reach the plan (`salvoPays` true, aim set, 3 warheads in store) and then waited 6+ minutes on the salvo's fuel: 2700 gold + 900 stone for a plain Atomic people (3 × 1.5 × 600/200).
- Numbers changed in `src/sim/data.ts`: `SALVO.surcharge` 0.5 → 0.2; `AI_SILO.salvo` 1.8 → 1.4; `AI_SILO.salvoPlain` 2.4 → 1.6.
- Trial of thresholds 1.1/1.2 with surcharge 0.15: 1 salvo in 8 matches (0 before). The final numbers are a notch more conservative and were not re-run.
- Not done: browser playtest of the full sequence; `WARHEADS` kill distances, `SILO.cap/refuel/blur/apart` and Launch Control's price left as they are; no campaign or win-rate comparison. Fuel and keeping three silos standing remain the limits: next, let a computer rebuild a lost silo sooner or hold singles back sooner.
