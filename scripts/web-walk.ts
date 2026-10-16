/**
 * Which roads computer opponents take through the web of ages (#50): plays headless matches and prints
 * each side's road, with the deeds that open side roads, and who won.
 *   npx tsx scripts/web-walk.ts [first seed] [seeds] [small|medium|large] [minutes] [normal|hard] [web|duel]
 * `duel` plays each seed twice, a web walker against a computer kept to the trunk, once from each seat,
 * and counts the walker's wins: is the web worth walking? An undecided match is read for who leads at the
 * end, by the age reached and then by kills less losses (#79). It also weighs gathering (#113): the walker's
 * over its rival's in the same match, and over its trunk twin's (the same people, seat and seed, kept to
 * the trunk in the seed's other match), each as a geometric mean, overall and by people. A ninth
 * argument, a people (`greeks`), sets the first seat's people, so one people's walk can be judged alone.
 * Each match also prints a `match {…}` line, for totting up runs played side by side.
 */
import { AGES, CIV_IDS } from '../src/sim/data';
import type { CivId } from '../src/sim/types';
import { createGame, step } from '../src/sim/game';
import { ageOf } from '../src/sim/ages';

const first = Number(process.argv[2] ?? 1);
const seeds = Number(process.argv[3] ?? 6);
const size = (process.argv[4] ?? 'medium') as 'small' | 'medium' | 'large';
const minutes = Number(process.argv[5] ?? 30);
const level = (process.argv[6] ?? 'hard') as 'normal' | 'hard';
const duel = process.argv[7] === 'duel';
const civ = process.argv[8] as CivId | undefined;
if (civ && !CIV_IDS.includes(civ)) throw new Error(`no people called ${civ}: ${CIV_IDS.join(', ')}`);
const wins = [0, 0];
const walker = { won: 0, lost: 0, ahead: 0, behind: 0 };
/** Log-ratios of the walker's gathering, over its rival's and over its trunk twin's, by people. */
const vsRival: Record<string, number[]> = {};
const vsTwin: Record<string, number[]> = {};
/** Each seat's gathering in the seed's previous match, to pair twins. */
let last: number[] = [];
const geo = (xs: number[]) => Math.exp(xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length));
for (let game = 0; game < seeds * (duel ? 2 : 1); game++) {
  const seed = first + (duel ? game >> 1 : game);
  // In a duel, the trunk seat: one that has passed every side road by.
  const trunk = duel ? 1 - (game & 1) : -1;
  const s = createGame({ seed, size, players: [{ name: 'A', ai: level, civ }, { name: 'B', ai: level }] });
  if (trunk >= 0) {
    step(s);
    s.ai[trunk].roads = { iron: false, merchant: false, pilgrim: false, fair: false, warband: false, ironblood: false, steppe: false, horde: false };
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
  let lead = '';
  if (trunk >= 0 && s.winner < 0) {
    const w = s.players[1 - trunk];
    const t = s.players[trunk];
    const margin = w.epoch - t.epoch || w.stats.kills - w.stats.losses - (t.stats.kills - t.stats.losses);
    walker[margin > 0 ? 'ahead' : 'behind']++;
    lead = `, the walker ${margin > 0 ? 'ahead' : 'behind'}`;
  }
  const gathered = s.players.map((p) => p.stats.gathered);
  if (trunk >= 0) {
    const w = s.players[1 - trunk];
    (vsRival[w.civ] ??= []).push(Math.log(gathered[w.id] / gathered[trunk]));
    // The seed's second match: the walker's twin was the trunk seat in the first, and the other way round.
    if (game & 1) {
      (vsTwin[w.civ] ??= []).push(Math.log(gathered[w.id] / last[w.id]));
      const t = s.players[trunk];
      (vsTwin[t.civ] ??= []).push(Math.log(last[t.id] / gathered[t.id]));
    }
    last = gathered;
    const margin = w.epoch - s.players[trunk].epoch || w.stats.kills - w.stats.losses - (s.players[trunk].stats.kills - s.players[trunk].stats.losses);
    const roadsTaken = roads[w.id].slice(1).map((r) => r.split('@')[0]);
    console.log(`match ${JSON.stringify({ seed, walker: w.civ, rival: s.players[trunk].civ, seat: w.id, won: s.winner < 0 ? null : s.winner !== trunk, margin, gw: Math.round(gathered[w.id]), gt: Math.round(gathered[trunk]), roads: roadsTaken })}`);
  }
  const line = s.players.map((p) => `${p.id === trunk ? '(trunk) ' : ''}${p.civ}: ${roads[p.id].join('→')} gathered ${Math.floor(p.stats.gathered)} traded ${Math.floor(p.stats.traded)} relic ${Math.floor(p.stats.relicGold ?? 0)} iron ${Math.floor(p.stats.iron ?? 0)} minded ${JSON.stringify(s.ai[p.id]?.roads ?? {})}`);
  console.log(`seed ${seed}${s.bogIron ? ' bog' : ''}${s.posts.length ? ` posts ${s.posts.length}` : ''}: ${line.join(' | ')} → ${s.winner >= 0 ? `team ${s.winner} won at ${(s.tick / 1200).toFixed(1)}m` : `no winner${lead}`}`);
}
console.log(`wins: A ${wins[0]}, B ${wins[1]} of ${seeds * (duel ? 2 : 1)}`);
if (duel) console.log(`the web walker won ${walker.won}, lost ${walker.lost}; of ${seeds * 2 - walker.won - walker.lost} undecided, ahead in ${walker.ahead}, behind in ${walker.behind}`);
if (duel) {
  const all = (by: Record<string, number[]>) => Object.values(by).flat();
  console.log(`the walker gathered ×${geo(all(vsRival)).toFixed(3)} of its rival, ×${geo(all(vsTwin)).toFixed(3)} of its trunk twin`);
  for (const c of Object.keys(vsTwin).sort()) console.log(`  ${c}: ×${geo(vsRival[c] ?? []).toFixed(3)} of the rival over ${vsRival[c]?.length ?? 0}, ×${geo(vsTwin[c]).toFixed(3)} of the twin over ${vsTwin[c].length}`);
}
