/**
 * Which computer opponents take the Age of the Wild, and what they tame and breed there (`docs/wild-road.md`).
 *   npx tsx scripts/wild-scan.ts [seeds] [minutes]
 */
import { AGES } from '../src/sim/data';
import { ageOf, hasWalked } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';

const seeds = Number(process.argv[2] ?? 12);
const minutes = Number(process.argv[3] ?? 20);
for (let seed = 1; seed <= seeds; seed++) {
  const s = createGame({ seed, size: 'small', players: [{ name: 'Normal', ai: 'normal' }, { name: 'Hard', ai: 'hard' }] });
  for (let i = 0; i < minutes * 60 * 20 && !s.over; i++) step(s);
  const line = s.players.map((p) => {
    const beasts = s.ents.filter((e) => e.kind === 'unit' && e.owner === p.id && e.hp > 0 && (e.type === 'warwolf' || e.type === 'tusker' || e.type === 'warmammoth')).length;
    const dens = s.ents.filter((e) => e.kind === 'building' && e.owner === p.id && e.type === 'den').length;
    return `${p.name}: ${AGES[ageOf(p)].short}${hasWalked(p, 'wild') ? ' (walked the Wild)' : ''}, tamed ${p.stats.tamed ?? 0} [${(p.tamed ?? []).join(' ')}], ${beasts} beasts, ${dens} dens`;
  });
  console.log(`seed ${seed} ${(s.tick / 1200).toFixed(1)}m winner ${s.winner >= 0 ? s.players[s.winner].name : '-'}  ${line.join('  |  ')}`);
}
