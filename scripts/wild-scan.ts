/**
 * Which computer opponents take the Age of the Wild, and what they tame and breed there; and of those, which go on into the Grove
 * and what they grow there (`docs/wild-road.md`).
 *   npx tsx scripts/wild-scan.ts [seeds] [minutes]
 */
import { AGES } from '../src/sim/data';
import { ageOf, hasWalked } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';
import type { Building } from '../src/sim/types';

const seeds = Number(process.argv[2] ?? 12);
const minutes = Number(process.argv[3] ?? 20);
for (let seed = 1; seed <= seeds; seed++) {
  const s = createGame({ seed, size: 'small', players: [{ name: 'Normal', ai: 'normal' }, { name: 'Hard', ai: 'hard' }] });
  for (let i = 0; i < minutes * 60 * 20 && !s.over; i++) step(s);
  const line = s.players.map((p) => {
    const beasts = s.ents.filter((e) => e.kind === 'unit' && e.owner === p.id && e.hp > 0 && (e.type === 'warwolf' || e.type === 'tusker' || e.type === 'warmammoth')).length;
    const dens = s.ents.filter((e) => e.kind === 'building' && e.owner === p.id && e.type === 'den').length;
    const of = (t: string) => s.ents.filter((e) => e.kind === 'building' && e.owner === p.id && e.type === t && e.hp > 0) as Building[];
    const grove = hasWalked(p, 'grove') ? `, Grove: ${of('garden').length} gardens (${of('garden').filter((b) => b.fed).length} fed), ${of('orchard').length} orchards, ${of('thornwall').length} thorn (${of('thornwall').filter((b) => (b.level ?? 0) >= 3).length} oak)` : '';
    return `${p.name}: ${AGES[ageOf(p)].short}${hasWalked(p, 'wild') ? ' (walked the Wild)' : ''}, tamed ${p.stats.tamed ?? 0} [${(p.tamed ?? []).join(' ')}], bred ${p.stats.bred ?? 0}, ${beasts} beasts, ${dens} dens${grove}`;
  });
  console.log(`seed ${seed} ${(s.tick / 1200).toFixed(1)}m winner ${s.winner >= 0 ? s.players[s.winner].name : '-'}  ${line.join('  |  ')}`);
}
