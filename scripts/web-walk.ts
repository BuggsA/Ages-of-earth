/**
 * Which roads computer opponents take through the web of ages (#50): plays headless matches and prints
 * each side's road, with the deeds that open side roads, and who won.
 *   npx tsx scripts/web-walk.ts [first seed] [seeds] [small|medium|large] [minutes] [normal|hard] [web|duel]
 * `duel` plays each seed twice, a web walker against a computer kept to the trunk, once from each seat,
 * and counts the walker's wins: is the web worth walking?
 */
import { AGES } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { ageOf } from '../src/sim/ages';

const first = Number(process.argv[2] ?? 1);
const seeds = Number(process.argv[3] ?? 6);
const size = (process.argv[4] ?? 'medium') as 'small' | 'medium' | 'large';
const minutes = Number(process.argv[5] ?? 30);
const level = (process.argv[6] ?? 'hard') as 'normal' | 'hard';
const duel = process.argv[7] === 'duel';
const wins = [0, 0];
const walker = { won: 0, lost: 0 };
for (let game = 0; game < seeds * (duel ? 2 : 1); game++) {
  const seed = first + (duel ? game >> 1 : game);
  // In a duel, the trunk seat: one that has passed every side road by.
  const trunk = duel ? 1 - (game & 1) : -1;
  const s = createGame({ seed, size, players: [{ name: 'A', ai: level }, { name: 'B', ai: level }] });
  if (trunk >= 0) {
    step(s);
    s.ai[trunk].roads = { iron: false, merchant: false, pilgrim: false, fair: false };
  }
  const roads = s.players.map((p) => [AGES[ageOf(p)].short]);
  const at = s.players.map((p) => ageOf(p));
  for (let i = 0; i < minutes * 60 * 20 && !s.over; i++) {
    step(s);
    if (i % 20) continue;
    for (const p of s.players) {
      const a = ageOf(p);
      if (at[p.id] === a) continue;
      at[p.id] = a;
      roads[p.id].push(`${AGES[a].short}@${Math.round(s.tick / 1200)}m`);
    }
  }
  if (s.winner >= 0) wins[s.winner]++;
  if (trunk >= 0 && s.winner >= 0) walker[s.winner === trunk ? 'lost' : 'won']++;
  const line = s.players.map((p) => `${p.id === trunk ? '(trunk) ' : ''}${p.civ}: ${roads[p.id].join('→')} traded ${Math.floor(p.stats.traded)} relic ${Math.floor(p.stats.relicGold ?? 0)} iron ${Math.floor(p.stats.iron ?? 0)} minded ${JSON.stringify(s.ai[p.id]?.roads ?? {})}`);
  console.log(`seed ${seed}${s.bogIron ? ' bog' : ''}${s.posts.length ? ` posts ${s.posts.length}` : ''}: ${line.join(' | ')} → ${s.winner >= 0 ? `team ${s.winner} won at ${(s.tick / 1200).toFixed(1)}m` : 'no winner'}`);
}
console.log(`wins: A ${wins[0]}, B ${wins[1]} of ${seeds * (duel ? 2 : 1)}`);
if (duel) console.log(`the web walker won ${walker.won}, lost ${walker.lost}`);
