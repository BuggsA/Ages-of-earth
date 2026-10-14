import { ageOf, relicTradeShare } from './ages';
import { LAST_EPOCH, TRADE } from './data';
import { distToRect } from './grid';
import { modsOf } from './stats';
import type { Building, GameState, Goal, TradePost } from './types';

/**
 * Trade: traders from a Market run the road to a neutral trading post out on the map and bring back
 * gold. A trip pays by the square of the distance from the Market to the post, so a long road pays
 * more for the time it takes, and leaves more road to guard. Nothing is paid until the trader is home.
 */

export function postAt(s: GameState, id: number): TradePost | undefined {
  return s.posts.find((p) => p.id === id);
}

/** The plaza's tiles, to walk to. */
export function goalForPost(p: TradePost): Goal {
  const cx = Math.floor(p.x);
  const cy = Math.floor(p.y);
  const r = TRADE.plaza;
  return { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r, px: p.x, py: p.y };
}

/** Whether a point is close enough to a post's middle to trade there. */
export function atPost(p: TradePost, x: number, y: number): boolean {
  const dx = p.x - x;
  const dy = p.y - y;
  return dx * dx + dy * dy <= TRADE.reach * TRADE.reach;
}

const usable = (b: Building, owner: number) => b.type === 'market' && b.owner === owner && b.built && b.hp > 0;

/** A player's finished Market by this id, if it still stands. */
export function marketOf(s: GameState, owner: number, id: number): Building | null {
  const b = id ? s.byId.get(id) : undefined;
  return b && b.kind === 'building' && (usable(b, owner) || usableByTeam(s, b, owner)) ? b : null;
}

/** A finished Market of an ally's, which a trader with none of its own may trade from. */
const usableByTeam = (s: GameState, b: Building, owner: number) => b.type === 'market' && b.built && b.hp > 0 && b.owner !== owner && s.players[b.owner].team === s.players[owner].team && !s.players[b.owner].defeated;

/**
 * Where a player's trader sets out from and comes home to: their own nearest Market, or with none
 * standing, an ally's (the ally takes its share, `TRADE.ally`, as ever).
 */
export function homeMarket(s: GameState, owner: number, x: number, y: number): Building | null {
  const own = nearestMarket(s, owner, x, y);
  if (own) return own;
  let best: Building | null = null;
  let bestD = Infinity;
  for (const e of s.ents) {
    if (e.kind !== 'building' || !usableByTeam(s, e, owner)) continue;
    const d = distToRect(x, y, e);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** The nearest finished Market of a player's to a point, or null. */
export function nearestMarket(s: GameState, owner: number, x: number, y: number): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  for (const e of s.ents) {
    if (e.kind !== 'building' || !usable(e, owner)) continue;
    const d = distToRect(x, y, e);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** Whether a finished Dock of the owner's stands near a Market, so the Age of Sail ships its goods by water. */
export function harborNear(s: GameState, owner: number, market: { x: number; y: number }): boolean {
  if (ageOf(s.players[owner]) !== 'sail') return false;
  const r = TRADE.harbor.reach;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== owner || e.type !== 'dock' || !e.built || e.hp <= 0) continue;
    const dx = e.x - market.x;
    const dy = e.y - market.y;
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

/** What one trip between a Market and a post pays its owner now. */
export function tripGold(s: GameState, owner: number, market: { x: number; y: number }, post: TradePost): number {
  const dx = market.x - post.x;
  const dy = market.y - post.y;
  const epoch = Math.min(LAST_EPOCH, s.players[owner].epoch);
  const k = TRADE.gold * (1 + Math.max(0, epoch - 1) * TRADE.epoch) * modsOf(s, owner).tradeGold * relicTradeShare(s, owner) * (harborNear(s, owner, market) ? TRADE.harbor.mul : 1);
  return Math.max(1, Math.min(TRADE.max, Math.floor((dx * dx + dy * dy) * k)));
}
