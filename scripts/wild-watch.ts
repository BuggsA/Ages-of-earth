/**
 * The wild (#171), watched: plays computer matches and counts mammoths felled, wolves killed, and the
 * people the beasts killed, by player. `npx tsx scripts/wild-watch.ts [seeds] [minutes] [difficulty]`
 */
import { createGame, step } from '../src/sim/game';
import { secs } from '../src/sim/data';
import type { Difficulty } from '../src/sim/types';

const lastOwner = new Map<number, number>();
const seeds = Number(process.argv[2] ?? 4);
const minutes = Number(process.argv[3] ?? 12);
const diff = (process.argv[4] ?? 'normal') as Difficulty;
for (let seed = 1; seed <= seeds; seed++) {
  const s = createGame({ seed, size: 'small', players: [{ name: 'A', ai: diff, civ: 'romans' }, { name: 'B', ai: diff, civ: 'greeks' }] });
  const beasts = new Map(s.animals.filter((a) => a.kind !== 'deer').map((a) => [a.id, a.kind]));
  const at = { mammoth: [] as number[], wolf: [] as number[] };
  const mauled: Record<number, number> = {};
  const lastBit = new Map<number, number>();
  const start = { mammoth: [...beasts.values()].filter((k) => k === 'mammoth').length, wolf: [...beasts.values()].filter((k) => k === 'wolf').length };
  for (let t = 0; t < secs(minutes * 60); t++) {

    step(s);
    for (const e of s.events) {
      if (e.k === 'animalDie' && beasts.has(e.id)) at[beasts.get(e.id) as 'mammoth' | 'wolf']?.push(Math.round(s.tick / secs(1)));
      if (e.k === 'wildStrike') lastBit.set(e.target, s.tick);
    }
    for (const [id, tick] of lastBit) {
      if (s.byId.has(id)) continue;
      if (s.tick - tick < secs(2)) {
        const owner = lastOwner.get(id) ?? -1;
        mauled[owner] = (mauled[owner] ?? 0) + 1;
      }
      lastBit.delete(id);
    }
    for (const e of s.ents) if (e.kind === 'unit') lastOwner.set(e.id, e.owner);
  }
  const pop = s.players.map((p) => `${p.name}: epoch ${p.epoch}, gathered ${Math.round(p.stats.gathered)}, lost ${p.stats.losses}`).join('; ');
  console.log(`seed ${seed}: mammoths ${at.mammoth.length}/${start.mammoth} felled at ${at.mammoth.join(',')}s; wolves ${at.wolf.length}/${start.wolf} at ${at.wolf.join(',')}s; killed by beasts ${JSON.stringify(mauled)}; ${pop}`);
}

