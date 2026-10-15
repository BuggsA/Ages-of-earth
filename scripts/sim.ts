/**
 * A headless match between two computer opponents, printed minute by minute, for balancing and timing.
 *   npx tsx scripts/sim.ts [seed] [small|medium|large] [minutes]
 */
import { AGES, RUINS, secs } from '../src/sim/data';
import { ageOf } from '../src/sim/ages';
import { checksum, createGame, step } from '../src/sim/game';

const seed = Number(process.argv[2] ?? 1);
const size = (process.argv[3] ?? 'small') as 'small' | 'medium' | 'large';
const minutes = Number(process.argv[4] ?? 30);
const s = createGame({ seed, size, players: [{ name: 'Normal', ai: 'normal' }, { name: 'Hard', ai: 'hard' }] });
const t0 = performance.now();
let worst = 0;
/** Every time a landmark changed hands: when, which, and to whom. */
const marks: string[] = [];
for (let i = 0; i < minutes * 60 * 20 && !s.over; i++) {
  const a = performance.now();
  step(s);
  worst = Math.max(worst, performance.now() - a);
  for (const ev of s.events) if (ev.k === 'landmark') marks.push(`${(s.tick / 1200).toFixed(1)}m ${ev.kind} ${ev.owner >= 0 ? `to ${s.players[ev.owner].name}` : `lost by ${s.players[ev.from].name}`}`);
  if (i % (20 * 60) !== 0) continue;
  const line = s.players.map((p) => {
    const units = s.ents.filter((e) => e.owner === p.id && e.kind === 'unit');
    const cit = units.filter((u) => u.kind === 'unit' && u.type === 'citizen').length;
    const blds = s.ents.filter((e) => e.owner === p.id && e.kind === 'building').length;
    const res = Object.values(p.res).map(Math.floor).join('/');
    const relics = s.relics.filter((r) => r.temple && s.byId.get(r.temple)?.owner === p.id).length;
    const traders = units.filter((u) => u.kind === 'unit' && u.type === 'trader').length;
    // The age, not just the epoch: a side road (#50) shows by its own name.
    return `${p.name}: ${AGES[ageOf(p)].short}, ${cit} citizens, ${units.length - cit} soldiers, ${blds} buildings, ${res}, kills ${p.stats.kills}, relics ${relics}, traders ${traders} (${Math.floor(p.stats.traded)} gold)${p.stats.iron ? `, bog iron ${Math.floor(p.stats.iron)}` : ''}`;
  });
  console.log(`min ${i / 1200}  ${line.join('  |  ')}`);
}
const won = s.winner >= 0 ? s.players[s.winner].name : 'nobody yet';
console.log(`Relics: ${s.relics.length} on the map, ${s.relics.filter((r) => r.temple).length} kept, ${s.relics.filter((r) => r.carrier).length} carried.`);
if (s.ruins) console.log(`Ruins: ${s.ruins.map((r) => `${r.find} ${r.by >= 0 ? `dug by ${s.players[r.by].name}` : `${Math.round((100 * r.dug) / secs(RUINS.dig))}% dug`}`).join(', ')}.`);
if (s.landmarks) console.log(`Landmarks: ${marks.length ? marks.join(', ') : 'none taken'}.`);
console.log(`Winner: ${won} after ${(s.tick / 1200).toFixed(1)} min. ${(performance.now() - t0).toFixed(0)} ms in all, worst tick ${worst.toFixed(1)} ms, checksum ${checksum(s)}.`);
