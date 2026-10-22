import { ORE_POST, ORE_TRADE, RARE } from './data';
import type { GameState, RareId, TradePost, Unit } from './types';

/**
 * Posts that sell what the map lacks (#573, the age road s13): "this world has none" means a dearer road, not a closed one.
 * On a world without the ore a road's door asks for (`ORE_POST.ores`), a trading post sells it. A trader told to buy pays
 * gold at the post for a load, carries it home as `Unit.ore` (so it spills where the trader falls, and anyone may carry it
 * off, `caches.ts`) and banks it at its Market, where it counts toward the road's ore door as mined ore does (`oreDone`).
 * Every load anyone buys makes the next one dearer.
 */

/** At the start of a match (not a campaign chapter): each road's ore this world lacks is sold at a post, one ore to a post in post order. */
export function stockPosts(s: GameState): void {
  if (!s.posts.length) return;
  ORE_POST.ores.filter((r) => !s.rares?.includes(r)).forEach((ore, i) => (s.posts[i % s.posts.length].sells ??= []).push(ore));
}

/** Gold a load of this ore costs at a post now. */
export const loadPrice = (s: GameState, ore: RareId): number =>
  Math.round(ORE_POST.lot * (ORE_TRADE.gold[ore] / ORE_TRADE.lot) * ORE_POST.markup * (1 + ORE_POST.rise * (s.oreSold?.[ore] ?? 0)));

/** The post selling this ore nearest a point, if any. */
export function sellerNear(s: GameState, ore: RareId, x: number, y: number): TradePost | null {
  let best: TradePost | null = null;
  let bestD = Infinity;
  for (const t of s.posts) {
    if (!t.sells?.includes(ore)) continue;
    const d = (t.x - x) * (t.x - x) + (t.y - y) * (t.y - y);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

/** A trader at the post buys a load: why it can't, or null once it has paid and taken it up. */
export function buyLoad(s: GameState, u: Unit, post: TradePost, ore: RareId): string | null {
  const name = RARE[ore].name.toLowerCase();
  if (!post.sells?.includes(ore)) return `This post sells no ${name}`;
  const gold = loadPrice(s, ore);
  const p = s.players[u.owner];
  if (p.res.gold < gold) return `Not enough gold to buy ${name}: a load of ${ORE_POST.lot} costs ${gold}`;
  p.res.gold -= gold;
  (s.oreSold ??= {})[ore] = (s.oreSold[ore] ?? 0) + 1;
  p.stats.bought = (p.stats.bought ?? 0) + ORE_POST.lot;
  u.ore = { id: ore, n: ORE_POST.lot, from: u.owner };
  s.events.push({ k: 'oreBuy', owner: u.owner, ore, n: ORE_POST.lot, gold, x: post.x, y: post.y });
  return null;
}
