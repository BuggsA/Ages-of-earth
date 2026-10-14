/**
 * Seed atlas (#80): finds the seeds whose worlds hold what you're looking for, without playing a match.
 *   npx tsx scripts/seed-atlas.ts [--from 1] [--count 200] [--size small|medium|large] [--type continental|…]
 *     [--players 2] [--bog] [--no-bog] [--posts 2] [--ruin hoard,lore,map,relic] [--ruins 3] [--relics 3]
 *     [--limit 20] [--json]
 * Every filter must hold. `--posts`, `--ruins` and `--relics` mean "at least"; `--ruin` lists finds that must all lie
 * under some ruin. It reads `generateMap` only, so nothing here touches the rules or a save.
 */
import { pathToFileURL } from 'node:url';
import { MAP_SIZES, MAP_TYPES } from '../src/sim/data';
import { generateMap } from '../src/sim/mapgen';
import type { MapSize, MapType, RuinFind } from '../src/sim/types';

const FINDS: RuinFind[] = ['hoard', 'lore', 'map', 'relic'];

export interface Query {
  from: number;
  count: number;
  size: MapSize;
  type: MapType;
  players: number;
  bog?: boolean;
  posts: number;
  ruins: number;
  relics: number;
  finds: RuinFind[];
  limit: number;
  json: boolean;
}

export interface Hit {
  seed: number;
  bog: boolean;
  posts: number;
  relics: number;
  ruins: number;
  finds: Record<RuinFind, number>;
}

const FLAGS = new Set(['--from', '--count', '--size', '--type', '--players', '--posts', '--ruin', '--ruins', '--relics', '--limit']);

/** Reads the command line; throws an Error with a plain message for anything it can't use. */
export function parseArgs(argv: string[]): Query {
  const q: Query = { from: 1, count: 200, size: 'medium', type: 'continental', players: 2, posts: 0, ruins: 0, relics: 0, finds: [], limit: 20, json: false };
  const int = (name: string, v: string, min: number, max: number): number => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be a whole number from ${min} to ${max}, not "${v}"`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--bog') q.bog = true;
    else if (a === '--no-bog') q.bog = false;
    else if (a === '--json') q.json = true;
    else if (FLAGS.has(a)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      if (a === '--from') q.from = int(a, v, 0, 2 ** 31 - 1);
      else if (a === '--count') q.count = int(a, v, 1, 100000);
      else if (a === '--players') q.players = int(a, v, 2, 4);
      else if (a === '--posts') q.posts = int(a, v, 0, 99);
      else if (a === '--ruins') q.ruins = int(a, v, 0, 99);
      else if (a === '--relics') q.relics = int(a, v, 0, 99);
      else if (a === '--limit') q.limit = int(a, v, 1, 1000);
      else if (a === '--size') {
        if (!(v in MAP_SIZES)) throw new Error(`--size must be one of ${Object.keys(MAP_SIZES).join(', ')}, not "${v}"`);
        q.size = v as MapSize;
      } else if (a === '--type') {
        if (!(v in MAP_TYPES)) throw new Error(`--type must be one of ${Object.keys(MAP_TYPES).join(', ')}, not "${v}"`);
        q.type = v as MapType;
      } else {
        for (const f of v.split(',')) {
          if (!FINDS.includes(f as RuinFind)) throw new Error(`--ruin finds are ${FINDS.join(', ')}, not "${f}"`);
          if (!q.finds.includes(f as RuinFind)) q.finds.push(f as RuinFind);
        }
      }
    } else throw new Error(`unknown option "${a}"`);
  }
  return q;
}

/** Describes one seed's world. */
export function inspect(seed: number, q: Pick<Query, 'size' | 'type' | 'players'>): Hit {
  const m = generateMap(seed, q.size, q.players, q.type);
  const finds = { hoard: 0, lore: 0, map: 0, relic: 0 };
  for (const r of m.ruins) finds[r.find]++;
  return { seed, bog: m.bogIron, posts: m.posts.length, relics: m.relics.length, ruins: m.ruins.length, finds };
}

export function matches(h: Hit, q: Query): boolean {
  return (
    (q.bog === undefined || h.bog === q.bog) &&
    h.posts >= q.posts &&
    h.ruins >= q.ruins &&
    h.relics >= q.relics &&
    q.finds.every((f) => h.finds[f] > 0)
  );
}

/** Scans `count` seeds from `from`, returning up to `limit` that meet every filter, and how many were looked at. */
export function scan(q: Query): { hits: Hit[]; looked: number } {
  const hits: Hit[] = [];
  let looked = 0;
  for (let seed = q.from; seed < q.from + q.count && hits.length < q.limit; seed++) {
    looked++;
    const h = inspect(seed, q);
    if (matches(h, q)) hits.push(h);
  }
  return { hits, looked };
}

export function table(hits: Hit[]): string {
  const head = 'seed       bog  posts relics ruins (hoard lore map relic)';
  const rows = hits.map(
    (h) => `${String(h.seed).padEnd(10)} ${(h.bog ? 'yes' : 'no').padEnd(4)} ${String(h.posts).padEnd(5)} ${String(h.relics).padEnd(6)} ${String(h.ruins).padEnd(5)} (${h.finds.hoard} ${h.finds.lore} ${h.finds.map} ${h.finds.relic})`,
  );
  return [head, ...rows].join('\n');
}

function main(): void {
  let q: Query;
  try {
    q = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`seed-atlas: ${(e as Error).message}`);
    console.error('usage: npx tsx scripts/seed-atlas.ts [--from N] [--count N] [--size S] [--type T] [--players 2-4] [--bog|--no-bog] [--posts N] [--ruin hoard,lore,map,relic] [--ruins N] [--relics N] [--limit N] [--json]');
    process.exit(1);
  }
  const { hits, looked } = scan(q);
  if (q.json) console.log(JSON.stringify({ query: q, looked, hits }, null, 2));
  else {
    console.log(`${q.size} ${q.type}, ${q.players} players: ${hits.length} of ${looked} seeds from ${q.from} match`);
    if (hits.length) console.log(table(hits));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
