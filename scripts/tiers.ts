/**
 * How hard each difficulty presses a town that does nothing (#258): when its rival climbs, when its first
 * wave reaches the Town Center, and when that falls. For judging difficulty, not a balance proof.
 *   npx tsx scripts/tiers.ts [gentle,easy,normal,hard] [1,2,3,4]
 */
import { createGame, step } from '../src/sim/game';
import type { Difficulty } from '../src/sim/types';
const levels = (process.argv[2] ?? 'gentle,easy,normal,hard').split(',') as Difficulty[];
const seeds = (process.argv[3] ?? '1,2,3,4').split(',').map(Number);
for (const L of levels) for (const seed of seeds) {
  const s = createGame({ seed, size: 'small', players: [{ name: 'You', ai: null }, { name: 'Rival', ai: L }] });
  const tc = s.ents.find((e) => e.owner === 0 && e.kind === 'building' && (e as any).type === 'towncenter')! as any;
  const ages: string[] = []; let ep = s.players[1].epoch; let wave = ''; let fell = '';
  for (let i = 0; i < 25 * 1200 && !s.over; i++) {
    step(s);
    const p = s.players[1];
    if (p.epoch !== ep) { ep = p.epoch; ages.push(`e${ep}@${(s.tick / 1200).toFixed(1)}`); }
    if (!wave && i % 20 === 0) {
      const near = s.ents.filter((e: any) => e.owner === 1 && e.kind === 'unit' && e.type !== 'citizen' && e.type !== 'trader' && (e.x - tc.x) ** 2 + (e.y - tc.y) ** 2 < 18 * 18);
      if (near.length >= 2) wave = `${near.length} soldiers@${(s.tick / 1200).toFixed(1)}`;
    }
    if (!fell && !s.byId.get(tc.id)) fell = `TC fell@${(s.tick / 1200).toFixed(1)}`;
  }
  const cit = s.ents.filter((e: any) => e.owner === 1 && e.type === 'citizen').length;
  console.log(`${L.padEnd(6)} seed ${seed}: ages ${ages.join(' ') || '-'} | first wave ${wave || 'none'} | ${fell || 'TC stands'} | ${cit} citizens at end`);
}
