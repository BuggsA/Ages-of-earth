/**
 * Does the ore gate (#356) strand the computer? Plays ordinary Normal-vs-Hard matches, one line a seed: which ores the
 * world holds, the ages each side reached (with minutes), and who won. Run it on two trees and diff the lines.
 *   npx tsx scripts/ore-sweep.ts <first seed> <seeds> <minutes> [small|medium]
 */
import { AGES } from '../src/sim/data';
import { ageOf } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';

const first = Number(process.argv[2] ?? 1);
const seeds = Number(process.argv[3] ?? 8);
const minutes = Number(process.argv[4] ?? 25);
const size = (process.argv[5] ?? 'medium') as 'small' | 'medium';
for (let seed = first; seed < first + seeds; seed++) {
  const s = createGame({ seed, size, players: [{ name: 'N', ai: 'normal' }, { name: 'H', ai: 'hard' }] });
  const at = s.players.map((p) => ageOf(p));
  const path = s.players.map((p) => [AGES[ageOf(p)].short]);
  for (let i = 0; i < minutes * 1200 && !s.over; i++) {
    step(s);
    if (i % 20) continue;
    for (const p of s.players) {
      const a = ageOf(p);
      if (a === at[p.id]) continue;
      at[p.id] = a;
      path[p.id].push(`${AGES[a].short}@${Math.round(s.tick / 1200)}`);
    }
  }
  const rares = (s.rares ?? []).join(',') || '-';
  const mined = s.players.map((p) => Object.entries(p.rare ?? {}).map(([k, v]) => `${k}${Math.floor(v as number)}`).join('+') || '0').join('|');
  console.log(`seed ${seed} rares[${rares}] mined[${mined}] winner ${s.winner >= 0 ? s.players[s.winner].name : '-'} :: N ${path[0].join('>')} :: H ${path[1].join('>')}`);
}
