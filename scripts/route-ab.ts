/**
 * Does a basic route (#555 s0, `docs/age-roads.md` spine §1) win at a fair rate, and can the computer play it? One
 * seat is a Hard computer told to take a route's side ages (`ROUTE_ROADS`) and every other side road is shut to it; the
 * other is a Hard computer kept to the plain trunk. Each seed is played twice, seats swapped, so the map and the
 * peoples even out. Judge over many seeds (48 or more, split across cores with the first-seed argument): 32 matches
 * swing by several ages on noise alone.
 *   npx tsx scripts/route-ab.ts <army|navy|economy|faith|horde> <first seed> <seeds> <minutes>
 * Prints a `route {…}` line a match (to tot up runs side by side), then the route seat's record: wins, losses, who leads
 * the undecided (the age reached, then kills less losses), the gathering over the trunk's (geometric mean) and the
 * shares of matches in which it entered the route's first age and walked its last, which says whether the computer can play the route at all.
 */
import { AGES } from '../src/sim/data';
import type { AgeId } from '../src/sim/types';
import { createGame, step } from '../src/sim/game';
import { ageOf, hasWalked } from '../src/sim/ages';

/** The side ages of each route, in the order they are walked; the last one is the route's goal. */
const ROUTE_ROADS: Record<string, AgeId[]> = {
  army: ['warband', 'ironblood', 'totalwar'],
  navy: ['sail', 'aeronaut'],
  economy: ['merchant', 'fair', 'lightning'],
  faith: ['pilgrim', 'fair'],
  horde: ['steppe', 'horde'],
};
const SIDE: AgeId[] = ['iron', 'merchant', 'pilgrim', 'fair', 'warband', 'ironblood', 'totalwar', 'steppe', 'horde', 'sail', 'aeronaut', 'lightning', 'reclaimer'];

const route = process.argv[2] ?? 'army';
const first = Number(process.argv[3] ?? 1);
const seeds = Number(process.argv[4] ?? 6);
const minutes = Number(process.argv[5] ?? 30);
const wanted = ROUTE_ROADS[route];
if (!wanted) throw new Error(`no route called ${route}: ${Object.keys(ROUTE_ROADS).join(', ')}`);
const tally = { won: 0, lost: 0, ahead: 0, behind: 0, gather: [] as number[], ages: 0, goal: 0, entered: 0 };
for (let game = 0; game < seeds * 2; game++) {
  const seed = first + (game >> 1);
  const seat = game & 1;
  const s = createGame({ seed, size: 'medium', players: [0, 1].map((i) => ({ name: `P${i}`, ai: 'hard' as const })) });
  step(s);
  for (const p of s.players) {
    const roads: Record<string, boolean> = {};
    for (const a of SIDE) roads[a] = p.id === seat && wanted.includes(a);
    s.ai[p.id].roads = roads;
  }
  const trail: string[] = [AGES[ageOf(s.players[seat])].short];
  let at = ageOf(s.players[seat]);
  for (let i = 0; i < minutes * 60 * 20 && !s.over; i++) {
    step(s);
    if (i % 20) continue;
    const a = ageOf(s.players[seat]);
    if (a !== at) { at = a; trail.push(`${AGES[a].short}@${Math.round(s.tick / 1200)}m`); }
  }
  const n = s.players[seat];
  const o = s.players[1 - seat];
  const margin = n.epoch - o.epoch || n.stats.kills - n.stats.losses - (o.stats.kills - o.stats.losses);
  const goal = hasWalked(n, wanted[wanted.length - 1]);
  if (s.winner >= 0) tally[s.winner === seat ? 'won' : 'lost']++;
  else if (margin) tally[margin > 0 ? 'ahead' : 'behind']++;
  tally.gather.push(Math.log(n.stats.gathered / o.stats.gathered));
  tally.ages += n.epoch - o.epoch;
  tally.goal += goal ? 1 : 0;
  tally.entered += hasWalked(n, wanted[0]) ? 1 : 0;
  console.log(`route ${JSON.stringify({ route, seed, seat, civ: n.civ, won: s.winner < 0 ? null : s.winner === seat, margin, goal, trail: trail.join('→') })}`);
}
const g = tally.gather;
const mean = g.reduce((a, b) => a + b, 0) / g.length;
console.log(`${route} ${tally.won}–${tally.lost} of ${g.length}; undecided: ahead in ${tally.ahead}, behind in ${tally.behind}; gathered ×${Math.exp(mean).toFixed(3)}; ages ahead ${(tally.ages / g.length).toFixed(2)}; entered ${wanted[0]} in ${tally.entered} of ${g.length}, reached ${wanted[wanted.length - 1]} in ${tally.goal}`);
