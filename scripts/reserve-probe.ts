/**
 * Missile defence (#759 s4): computer-vs-computer Atomic starts, counting how often a silo is held in Reserve and what the missile
 * defence does. Judge the computer's Reserve rule over many seeds, never one match.
 *   npx tsx scripts/reserve-probe.ts [seeds] [minutes] [hard|normal]
 */
import { createGame, step } from '../src/sim/game';
import { held } from '../src/sim/silo';
import type { Building } from '../src/sim/types';

const seeds = Number(process.argv[2] ?? 8);
const minutes = Number(process.argv[3] ?? 25);
const level = (process.argv[4] ?? 'hard') as 'hard' | 'normal';
const tot = { held: 0, launches: 0, answered: 0, silo: 0, hit: 0, wins: [0, 0], none: 0 };
for (let seed = 1; seed <= seeds; seed++) {
  const s = createGame({ seed, size: 'small', startEpoch: 5, players: [{ name: 'A', ai: level }, { name: 'B', ai: level }] });
  let everHeld = false;
  const seen = new Set<number>();
  for (let i = 0; i < minutes * 1200 && !s.over; i++) {
    step(s);
    if (i % 20 === 0 && !everHeld) everHeld = s.ents.some((e) => e.kind === 'building' && e.type === 'silo' && held(e as Building));
    for (const l of s.launches ?? []) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      tot.launches++;
    }
    for (const l of s.launches ?? []) for (const c of l.icpt ?? []) { const k = l.id * 100 + c.shot; if (!seen.has(-k)) { seen.add(-k); tot.answered++; if (c.silo) tot.silo++; if (c.hit) tot.hit++; } }
  }
  if (everHeld) tot.held++;
  if (s.winner >= 0) tot.wins[s.winner]++; else tot.none++;
  console.log(`seed ${seed}: held ${everHeld}, winner ${s.winner}, ${(s.tick / 1200).toFixed(1)} min`);
}
console.log(JSON.stringify(tot));
