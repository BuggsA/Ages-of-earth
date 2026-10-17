/**
 * Goal 1's measure (#463): two computer players on one seed, each held to a different Way, played side by
 * side, so the first minutes of their openings can be set next to each other.
 *   npx tsx scripts/opening.ts [seed] [wayA] [wayB] [minutes] [size] [homeland]
 *   npx tsx scripts/opening.ts 3 hunt hearth 15
 *   npx tsx scripts/opening.ts 3 hunt hunt 15 medium shore   (one homeland, #473; 'random' rolls the seed's)
 *   npx tsx scripts/opening.ts 3 hunt hunt:feast 15 medium herds   (`:feast`: that town hunts its own herds out, #481)
 * Prints a row a minute (citizens, soldiers, buildings, stockpile, the meat and gathering so far, kills) and,
 * after it, when each kind of building first stood (`first`), where each town's food came from (`food`) and
 * what its people spent their time at (`work`), so two openings that only differ in numbers look the same and
 * two that differ in what the people do do not. Ways are those in `WAYS` (`data.ts`).
 *
 * The proof that openings part ways (#481, `tests/slow/openings-part.test.ts`) runs `playOpening` and `parting`.
 */
import { pathToFileURL } from 'node:url';
import { AGES, HOMELANDS, WAYS, WAY_IDS } from '../src/sim/data';
import { ageOf } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';
import { takeWay } from '../src/sim/ways';
import { R_BERRY, R_MEAT } from '../src/sim/types';
import type { Command, GameState, HomelandId, Unit, WayId } from '../src/sim/types';

/** Where a load of food came from. */
export const FOODS = ['berries', 'meat', 'fish', 'fields', 'snares', 'milk', 'other'] as const;
export type Food = (typeof FOODS)[number];
/** What a citizen (or fishing boat) is at. */
export const JOBS = ['berries', 'meat', 'fish', 'fields', 'snares', 'milk', 'wood', 'stone', 'gold', 'build', 'idle', 'other'] as const;
export type Job = (typeof JOBS)[number];

/** One side of an opening: `way`, and with `feast` the town hunts its own home herds out instead of sparing them. */
export interface Pick {
  way: WayId;
  feast?: boolean;
}

export interface OpeningSetup {
  seed: number;
  picks: [Pick, Pick];
  minutes: number;
  size?: 'small' | 'medium' | 'large';
  homeland?: HomelandId | 'random';
  /** Called with each minute's row, for the printout. */
  row?: (minute: number, s: GameState) => void;
}

/** One town's first minutes. */
export interface Opening {
  name: string;
  pick: Pick;
  /** Building types in the order each first stood (the Town Center left out), and the minute. */
  first: [string, number][];
  /** Food carried home, by where it came from; `raided` is food the town's soldiers carried off from rivals. */
  food: Record<Food, number>;
  raided: number;
  /** Citizen-seconds (and fishing-boat seconds) spent at each job. */
  work: Record<Job, number>;
  /** The same, minute by minute (index 0 is the first minute); raids are in `food.other` here. */
  foodBy: Record<Food, number>[];
  workBy: Record<Job, number>[];
  /** Mean distance from home of the town's food workers, in tiles, sampled each second. */
  reach: number;
  /** Kin called at the Town Center (the Hearth's verb). */
  kin: number;
  /** Per minute (index 0 is the start): meat butchered so far, and the town's own home-herd deer alive. */
  hunted: number[];
  herd: number[];
  /** Ages reached: `Stone@0m`, `Bronze@8.8m`… */
  ages: string[];
}

export interface OpeningRun {
  homeland: HomelandId;
  towns: [Opening, Opening];
}

const zero = <K extends string>(keys: readonly K[]): Record<K, number> => Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

/** What a unit is at now, read off its order and the tile it works. */
function jobOf(s: GameState, u: Unit): Job {
  const o = u.order;
  if (u.type === 'fisher') return o.k === 'gather' ? 'fish' : 'idle';
  switch (o.k) {
    case 'idle':
      return 'idle';
    case 'hunt':
      return 'meat';
    case 'farm':
      return 'fields';
    case 'snare':
      return 'snares';
    case 'milk':
      return 'milk';
    case 'build':
      return 'build';
    case 'gather':
      if (o.res === 'food') return o.meat || s.res[o.tile] === R_MEAT ? 'meat' : s.res[o.tile] === R_BERRY ? 'berries' : 'other';
      return o.res;
    default:
      return 'other';
  }
}

const FOOD_JOBS = new Set<Job>(['berries', 'meat', 'fish', 'fields', 'snares', 'milk']);

/**
 * A town that feasts (#481): every two seconds, while any deer of its own home herds live, it keeps two citizens
 * hunting them, taken from the berries or the woods: a player who hunts the herd out instead of sparing it.
 */
function feast(s: GameState, owner: number): Command[] {
  const herd = s.animals.filter((a) => a.kind === 'deer' && a.town === owner && a.hp > 0);
  if (!herd.length) return [];
  const ids = new Set(herd.map((a) => a.id));
  const mine = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === owner && e.type === 'citizen');
  const on = mine.filter((u) => u.order.k === 'hunt' && ids.has(u.order.target)).length;
  const free = mine.filter((u) => jobOf(s, u) === 'berries').concat(mine.filter((u) => jobOf(s, u) === 'wood'));
  const out: Command[] = [];
  for (let k = on; k < 2 && free.length; k++) {
    const u = free.shift()!;
    let best = herd[0];
    for (const a of herd) if ((a.x - u.x) * (a.x - u.x) + (a.y - u.y) * (a.y - u.y) < (best.x - u.x) * (best.x - u.x) + (best.y - u.y) * (best.y - u.y)) best = a;
    out.push({ t: 'hunt', p: owner, ids: [u.id], target: best.id });
  }
  return out;
}

/** Play two hard computers on one seed, each held to its pick, for `minutes`, and read off what each town did. */
export function playOpening(o: OpeningSetup): OpeningRun {
  const { seed, picks, minutes } = o;
  const same = picks[0].way === picks[1].way && !!picks[0].feast === !!picks[1].feast;
  const s = createGame({ seed, size: o.size ?? 'medium', homeland: o.homeland ?? 'glade', players: picks.map((pk, i) => ({ name: WAYS[pk.way].name + (pk.feast ? ', feasting' : '') + (same ? ` ${i + 1}` : ''), ai: 'hard' })) });
  s.players.forEach((p, i) => takeWay(s, p, picks[i].way));
  const towns = s.players.map((p, i): Opening => ({ name: p.name, pick: picks[i], first: [], food: zero(FOODS), raided: 0, work: zero(JOBS), foodBy: [zero(FOODS)], workBy: [zero(JOBS)], reach: 0, kin: 0, hunted: [0], herd: [], ages: [`${AGES[ageOf(p)].short}@0m`] }));
  const seen = s.players.map(() => new Set<string>(['towncenter']));
  const at = s.players.map((p) => ageOf(p));
  const lastFood = new Map<number, Food>();
  const carry = new Map<number, number>();
  const kinSeen = new WeakSet<object>();
  const reach = s.players.map(() => ({ sum: 0, n: 0 }));
  const raidedAt = s.players.map(() => 0);
  const home = s.players.map((p) => s.ents.find((e) => e.kind === 'building' && e.type === 'towncenter' && e.owner === p.id)!);
  const herdOf = (id: number) => s.animals.filter((a) => a.kind === 'deer' && a.town === id && a.hp > 0).length;
  towns.forEach((t, i) => t.herd.push(herdOf(i)));
  o.row?.(0, s);
  const end = minutes * 60 * 20;
  for (let i = 1; i <= end && !s.over; i++) {
    const cmds = i % 40 ? [] : picks.flatMap((pk, k) => (pk.feast ? feast(s, k) : []));
    step(s, cmds);
    const m = s.tick / 1200;
    // Loads carried home this tick: a unit whose basket emptied as its people were paid food.
    const paid = s.players.map(() => [] as number[]);
    for (const e of s.events) if (e.k === 'deliver' && e.res === 'food') paid[e.owner].push(e.amount);
    for (const e of s.ents) {
      if (e.kind === 'building') {
        if (e.built && e.owner >= 0 && e.owner < towns.length && !seen[e.owner].has(e.type)) {
          seen[e.owner].add(e.type);
          towns[e.owner].first.push([e.type, Math.round(m * 10) / 10]);
        }
        if (e.type === 'towncenter' && e.owner >= 0 && e.owner < towns.length) for (const q of e.queue) if (q.kin && !kinSeen.has(q)) { kinSeen.add(q); towns[e.owner].kin += q.kin; }
        continue;
      }
      if (e.owner < 0 || e.owner >= towns.length || (e.type !== 'citizen' && e.type !== 'fisher')) continue;
      const before = carry.get(e.id) ?? 0;
      if (before > 0 && e.carry === 0) {
        const k = Math.max(0, paid[e.owner].indexOf(before));
        if (paid[e.owner].length) {
          const n = paid[e.owner].splice(k, 1)[0];
          const t = towns[e.owner];
          t.food[lastFood.get(e.id) ?? 'other'] += n;
          t.foodBy[t.foodBy.length - 1][lastFood.get(e.id) ?? 'other'] += n;
        }
      }
      carry.set(e.id, e.carryRes === 'food' ? e.carry : 0);
      const job = jobOf(s, e);
      if (FOOD_JOBS.has(job)) lastFood.set(e.id, job as Food);
      if (i % 20) continue;
      towns[e.owner].work[job]++;
      towns[e.owner].workBy[towns[e.owner].workBy.length - 1][job]++;
      if (FOOD_JOBS.has(job) && home[e.owner]) {
        const h = home[e.owner];
        reach[e.owner].sum += Math.sqrt((e.x - h.x) * (e.x - h.x) + (e.y - h.y) * (e.y - h.y));
        reach[e.owner].n++;
      }
    }
    for (const p of s.players) if (ageOf(p) !== at[p.id]) { at[p.id] = ageOf(p); towns[p.id].ages.push(`${AGES[at[p.id]].short}@${m.toFixed(1)}m`); }
    if (i % 1200) continue;
    towns.forEach((t, k) => {
      t.hunted.push(Math.floor(s.players[k].stats.hunted ?? 0));
      t.herd.push(herdOf(k));
      const raided = Math.floor(s.players[k].stats.raided ?? 0);
      t.foodBy[t.foodBy.length - 1].other += raided - raidedAt[k];
      raidedAt[k] = raided;
      if (i < end) {
        t.foodBy.push(zero(FOODS));
        t.workBy.push(zero(JOBS));
      }
    });
    o.row?.(i / 1200, s);
  }
  towns.forEach((t, k) => {
    t.raided = Math.floor(s.players[k].stats.raided ?? 0);
    t.reach = reach[k].n ? reach[k].sum / reach[k].n : 0;
    for (const f of FOODS) t.food[f] = Math.floor(t.food[f]);
  });
  return { homeland: s.homeland ?? 'glade', towns: towns as [Opening, Opening] };
}

/** Shares of a tally, summing to 1 (all 0 when the tally is empty). */
export function shares<K extends string>(t: Record<K, number>, keys: readonly K[]): Record<K, number> {
  const sum = keys.reduce((a, k) => a + t[k], 0);
  return Object.fromEntries(keys.map((k) => [k, sum ? t[k] / sum : 0])) as Record<K, number>;
}

/** How far apart two tallies lie, from 0 (the same mix) to 1 (nothing in common): half the summed gaps between their shares. */
export function apart<K extends string>(a: Record<K, number>, b: Record<K, number>, keys: readonly K[]): number {
  const x = shares(a, keys);
  const y = shares(b, keys);
  return keys.reduce((d, k) => d + Math.abs(x[k] - y[k]), 0) / 2;
}

/** The first `n` buildings a town raised, in order. */
export const firstBuilt = (t: Opening, n = 4) => t.first.slice(0, n).map(([b]) => b);

/** Sum the minutes `from` (inclusive) to `to` (exclusive) of a minute-by-minute tally. */
export function over<K extends string>(by: Record<K, number>[], keys: readonly K[], from: number, to: number): Record<K, number> {
  const t = zero(keys);
  for (const m of by.slice(from, to)) for (const k of keys) t[k] += m[k];
  return t;
}

/**
 * How two openings part (#481), over the minutes `from`..`to`: the gap between their food mixes (raids counted
 * as food) and their work mixes (0..1 each), and how many of the first four buildings stood in a different place
 * in the order.
 */
export function parting(a: Opening, b: Opening, from = 0, to = Infinity): { food: number; work: number; order: number } {
  const fa = firstBuilt(a);
  const fb = firstBuilt(b);
  let order = 0;
  for (let k = 0; k < Math.max(fa.length, fb.length); k++) if (fa[k] !== fb[k]) order++;
  return { food: apart(over(a.foodBy, FOODS, from, to), over(b.foodBy, FOODS, from, to), FOODS), work: apart(over(a.workBy, JOBS, from, to), over(b.workBy, JOBS, from, to), JOBS), order };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
/** A tally as `meat 52%, berries 30%…`, biggest first, shares under 2% left out. */
export function mix<K extends string>(t: Record<K, number>, keys: readonly K[]): string {
  const sh = shares(t, keys);
  return [...keys].sort((x, y) => sh[y] - sh[x]).filter((k) => sh[k] >= 0.02).map((k) => `${k} ${pct(sh[k])}`).join(', ');
}

/** Read `hunt`, `hearth:feast`… */
export function parsePick(arg: string): Pick {
  const [way, mod] = arg.split(':');
  if (!WAYS[way as WayId]) throw new Error(`no Way "${way}"; try ${WAY_IDS.join(', ')}`);
  if (mod && mod !== 'feast') throw new Error(`no "${mod}"; the one modifier is :feast`);
  return { way: way as WayId, feast: mod === 'feast' || undefined };
}

function main(): void {
  const seed = Number(process.argv[2] ?? 1);
  const picks = [parsePick(process.argv[3] ?? WAY_IDS[0]), parsePick(process.argv[4] ?? WAY_IDS[1])] as [Pick, Pick];
  const minutes = Number(process.argv[5] ?? 15);
  const size = (process.argv[6] ?? 'medium') as 'small' | 'medium' | 'large';
  const homeland = (process.argv[7] ?? 'glade') as HomelandId | 'random';
  if (homeland !== 'random' && !HOMELANDS[homeland]) throw new Error(`no homeland "${homeland}"; try ${Object.keys(HOMELANDS).join(', ')} or random`);
  const col = (t: string) => t.padEnd(46);
  const run = playOpening({
    seed, picks, minutes, size, homeland,
    row: (min, s) => {
      if (!min) {
        console.log(`seed ${seed}, ${size}, ${HOMELANDS[s.homeland ?? 'glade'].name}: ${s.players.map((p) => p.name).join(' vs ')}`);
        console.log(`min  ${s.players.map((p) => col(`${p.name}: cit/sol/bld  food wood stone gold  hunted kills`)).join(' ')}`);
      }
      const row = s.players.map((p) => {
        const mine = s.ents.filter((e) => e.owner === p.id);
        const cit = mine.filter((e) => e.kind === 'unit' && e.type === 'citizen').length;
        const sol = mine.filter((e) => e.kind === 'unit').length - cit;
        const bld = mine.filter((e) => e.kind === 'building').length;
        const r = p.res;
        return col(`${String(cit).padStart(3)}/${String(sol).padStart(3)}/${String(bld).padStart(3)}  ${[r.food, r.wood, r.stone, r.gold].map((v) => String(Math.floor(v)).padStart(4)).join(' ')}  ${String(Math.floor(p.stats.hunted ?? 0)).padStart(6)} ${String(p.stats.kills).padStart(5)}`);
      });
      console.log(`${String(min).padStart(3)}  ${row.join(' ')}`);
    },
  });
  for (const t of run.towns) {
    console.log(`first ${t.name}: ${t.first.map(([b, m]) => `${b} ${m}m`).join(', ')}`);
    console.log(`ages  ${t.name}: ${t.ages.join(' → ')}`);
    console.log(`food  ${t.name}: ${mix(t.food, FOODS)}${t.raided ? `; ${t.raided} raided` : ''}${t.kin ? `; ${t.kin} kin called` : ''}`);
    console.log(`work  ${t.name}: ${mix(t.work, JOBS)}; food workers ${t.reach.toFixed(1)} tiles from home`);
    if (run.homeland === 'herds') console.log(`herd  ${t.name}: ${t.herd.join(' ')} (own deer alive, by minute)`);
  }
  for (const t of run.towns) for (let m = 0; m < minutes; m += 5) console.log(`  ${m}-${m + 5}m ${t.name}: food ${mix(over(t.foodBy, FOODS, m, m + 5), FOODS)} | work ${mix(over(t.workBy, JOBS, m, m + 5), JOBS)}`);
  for (let m = 0; m < minutes; m += 5) {
    const d = parting(run.towns[0], run.towns[1], m, m + 5);
    console.log(`apart ${m}-${m + 5}m: food mix ${pct(d.food)}, work mix ${pct(d.work)}`);
  }
  const d = parting(run.towns[0], run.towns[1]);
  console.log(`apart: food mix ${pct(d.food)}, work mix ${pct(d.work)}, first four buildings ${d.order} of 4 in a different place`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
