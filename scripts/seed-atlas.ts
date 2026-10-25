/**
 * Seed atlas (#80): finds the seeds whose worlds hold what you're looking for, without playing a match.
 *   npx tsx scripts/seed-atlas.ts [--from 1] [--count 200] [--size small|medium|large] [--type continental|…]
 *     [--players 2] [--bog] [--no-bog] [--posts 2] [--ruin hoard,lore,map,relic] [--ruins 3] [--relics 3]
 *     [--ore salt,bloodiron] [--no-ore saltpetre] [--caves 1] [--dens 1]
 *     [--limit 20] [--json] [--survey] [--apart 40] [--close 60]
 * `--survey` ignores the filters except size, players, from and count, and says how often each feature occurs on each map type.
 * `--apart N` wants the two nearest starts at least N tiles apart; `--close N` wants them at most N apart.
 * Every filter must hold. `--posts`, `--ruins` and `--relics` mean "at least"; `--ruin` lists finds that must all lie
 * under some ruin. `--ore` requires every listed ore; `--no-ore` excludes them; `--caves` and `--dens` are minimum counts.
 * Rare veins and caves are enabled exactly as in ordinary matches. It reads `generateMap` only, so nothing here touches the rules or a save.
 */
import { pathToFileURL } from 'node:url';
import { MAP_SIZES, MAP_TYPES } from '../src/sim/data';
import { generateMap } from '../src/sim/mapgen';
import { RARES } from '../src/sim/types';
import type { RareId, MapSize, MapType, RuinFind } from '../src/sim/types';

const FINDS: RuinFind[] = ['hoard', 'lore', 'map', 'relic'];

export interface Query {
  from: number;
  count: number;
  size: MapSize;
  type: MapType;
  players: number;
  bog?: boolean;
  ores: RareId[];
  noOres: RareId[];
  caves: number;
  dens: number;
  posts: number;
  ruins: number;
  relics: number;
  apart: number;
  close: number;
  finds: RuinFind[];
  limit: number;
  json: boolean;
  survey: boolean;
  share: boolean;
}

export interface Hit {
  ores: RareId[];
  caves: number;
  dens: number;
  seed: number;
  bog: boolean;
  posts: number;
  relics: number;
  ruins: number;
  /** Distance in tiles between the two nearest starting positions, to the nearest tile. */
  gap: number;
  finds: Record<RuinFind, number>;
}

const FLAGS = new Set(['--from', '--count', '--size', '--type', '--players', '--posts', '--ruin', '--ruins', '--relics', '--limit', '--apart', '--close', '--ore', '--no-ore', '--caves', '--dens']);

/** Reads the command line; throws an Error with a plain message for anything it can't use. */
export function parseArgs(argv: string[]): Query {
  const q: Query = { from: 1, count: 200, size: 'medium', type: 'continental', players: 2, ores: [], noOres: [], caves: 0, dens: 0, posts: 0, ruins: 0, relics: 0, apart: 0, close: Infinity, finds: [], limit: 20, json: false, survey: false, share: false };
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
    else if (a === '--survey') q.survey = true;
    else if (a === '--share') q.share = true;
    else if (FLAGS.has(a)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      if (a === '--ore' || a === '--no-ore') {
        const list = a === '--ore' ? q.ores : q.noOres;
        for (const ore of v.split(',')) {
          if (!RARES.includes(ore as RareId)) throw new Error(`${a} ores are ${RARES.join(', ')}, not "${ore}"`);
          if (!list.includes(ore as RareId)) list.push(ore as RareId);
        }
      } else if (a === '--caves') q.caves = int(a, v, 0, 99);
      else if (a === '--dens') q.dens = int(a, v, 0, 99);
      else if (a === '--from') q.from = int(a, v, 0, 2 ** 31 - 1);
      else if (a === '--count') q.count = int(a, v, 1, 100000);
      else if (a === '--players') q.players = int(a, v, 2, 4);
      else if (a === '--posts') q.posts = int(a, v, 0, 99);
      else if (a === '--ruins') q.ruins = int(a, v, 0, 99);
      else if (a === '--relics') q.relics = int(a, v, 0, 99);
      else if (a === '--apart') q.apart = int(a, v, 0, 9999);
      else if (a === '--close') q.close = int(a, v, 0, 9999);
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
  for (const ore of q.ores) if (q.noOres.includes(ore)) throw new Error(`--ore and --no-ore conflict for ${ore}`);
  return q;
}

/** Describes one seed's world. */
export function inspect(seed: number, q: Pick<Query, 'size' | 'type' | 'players'>): Hit {
  const m = generateMap(seed, q.size, q.players, q.type, true, true);
  const finds = { hoard: 0, lore: 0, map: 0, relic: 0 };
  for (const r of m.ruins) finds[r.find]++;
  let gap = Infinity;
  for (let i = 0; i < m.starts.length; i++)
    for (let j = i + 1; j < m.starts.length; j++) gap = Math.min(gap, Math.hypot(m.starts[i].x - m.starts[j].x, m.starts[i].y - m.starts[j].y));
  return { seed, ores: m.rares, caves: m.caves.length, dens: m.caves.filter((c) => c.den).length, bog: m.bogIron, posts: m.posts.length, relics: m.relics.length, ruins: m.ruins.length, gap: Math.round(gap), finds };
}

export function matches(h: Hit, q: Query): boolean {
  return (
    (q.bog === undefined || h.bog === q.bog) &&
    q.ores.every((ore) => h.ores.includes(ore)) &&
    q.noOres.every((ore) => !h.ores.includes(ore)) &&
    h.caves >= q.caves &&
    h.dens >= q.dens &&
    h.posts >= q.posts &&
    h.ruins >= q.ruins &&
    h.relics >= q.relics &&
    h.gap >= q.apart &&
    h.gap <= q.close &&
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

/** How often each feature occurs over `count` seeds on every map type: percent of worlds with it, and mean counts. */
export function survey(q: Pick<Query, 'from' | 'count' | 'size' | 'players'>): Record<string, { bog: number; posts: number; relics: number; ruins: number; hoard: number; lore: number; map: number; relic: number; salt: number; saltpetre: number; bloodiron: number; glowcap: number; caves: number; dens: number }> {
  const out: ReturnType<typeof survey> = {};
  for (const type of Object.keys(MAP_TYPES) as MapType[]) {
    const t = { bog: 0, posts: 0, relics: 0, ruins: 0, hoard: 0, lore: 0, map: 0, relic: 0, salt: 0, saltpetre: 0, bloodiron: 0, glowcap: 0, caves: 0, dens: 0 };
    for (let seed = q.from; seed < q.from + q.count; seed++) {
      const h = inspect(seed, { size: q.size, players: q.players, type });
      if (h.bog) t.bog++;
      for (const ore of h.ores) t[ore]++;
      t.caves += h.caves;
      t.dens += h.dens;
      t.posts += h.posts;
      t.relics += h.relics;
      t.ruins += h.ruins;
      for (const f of FINDS) if (h.finds[f] > 0) t[f]++;
    }
    const pct = (n: number): number => Math.round((n * 100) / q.count);
    const avg = (n: number): number => Math.round((n * 10) / q.count) / 10;
    out[type] = { salt: pct(t.salt), saltpetre: pct(t.saltpetre), bloodiron: pct(t.bloodiron), glowcap: pct(t.glowcap), caves: avg(t.caves), dens: avg(t.dens), bog: pct(t.bog), posts: avg(t.posts), relics: avg(t.relics), ruins: avg(t.ruins), hoard: pct(t.hoard), lore: pct(t.lore), map: pct(t.map), relic: pct(t.relic) };
  }
  return out;
}

export function surveyTable(s: ReturnType<typeof survey>): string {
  const head = 'type            bog%  posts relics ruins | worlds with: hoard% lore% map% relic% | salt% saltpetre% bloodiron% caves dens';
  const rows = Object.entries(s).map(
    ([t, r]) => `${t.padEnd(15)} ${String(r.bog).padEnd(5)} ${String(r.posts).padEnd(5)} ${String(r.relics).padEnd(6)} ${String(r.ruins).padEnd(5)} |              ${String(r.hoard).padEnd(6)} ${String(r.lore).padEnd(5)} ${String(r.map).padEnd(4)} ${String(r.relic).padEnd(6)} | ${String(r.salt).padEnd(5)} ${String(r.saltpetre).padEnd(10)} ${String(r.bloodiron).padEnd(10)} ${String(r.caves).padEnd(5)} ${r.dens}`,
  );
  return [head, ...rows].join('\n');
}

/** The title-screen address of a world: open it on the game's site (or `npm run dev`) to start from these settings. */
export function shareQuery(seed: number, q: Pick<Query, 'size' | 'type' | 'players'>): string {
  return `?seed=${seed}&size=${q.size}&map=${q.type}&foes=${q.players - 1}`;
}

export function table(hits: Hit[]): string {
  const head = 'seed       bog  posts relics ruins gap (hoard lore map relic) | ores                    caves dens';
  const rows = hits.map(
    (h) => `${String(h.seed).padEnd(10)} ${(h.bog ? 'yes' : 'no').padEnd(4)} ${String(h.posts).padEnd(5)} ${String(h.relics).padEnd(6)} ${String(h.ruins).padEnd(5)} ${String(h.gap).padEnd(3)} (${h.finds.hoard} ${h.finds.lore} ${h.finds.map} ${h.finds.relic}) | ${(h.ores.join(',') || 'none').padEnd(23)} ${String(h.caves).padEnd(5)} ${h.dens}`,
  );
  return [head, ...rows].join('\n');
}

function main(): void {
  let q: Query;
  try {
    q = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`seed-atlas: ${(e as Error).message}`);
    console.error('usage: npx tsx scripts/seed-atlas.ts [--from N] [--count N] [--size S] [--type T] [--players 2-4] [--bog|--no-bog] [--ore salt,saltpetre,bloodiron] [--no-ore ORES] [--caves N] [--dens N] [--posts N] [--ruin hoard,lore,map,relic] [--ruins N] [--relics N] [--limit N] [--json] [--survey] [--share] [--apart N] [--close N]');
    process.exit(1);
  }
  if (q.survey) {
    const s = survey(q);
    if (q.json) console.log(JSON.stringify({ query: q, survey: s }, null, 2));
    else {
      console.log(`${q.size}, ${q.players} players, ${q.count} seeds from ${q.from} (posts, relics, ruins, caves, dens are means per world)`);
      console.log(surveyTable(s));
    }
    return;
  }
  const { hits, looked } = scan(q);
  if (q.json) console.log(JSON.stringify({ query: q, looked, hits }, null, 2));
  else {
    console.log(`${q.size} ${q.type}, ${q.players} players: ${hits.length} of ${looked} seeds from ${q.from} match`);
    if (hits.length) console.log(table(hits));
    if (q.share) for (const h of hits) console.log(shareQuery(h.seed, q));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
