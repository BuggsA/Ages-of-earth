import { ageDef, ageOf, ironTradeShare, relicTradeShare } from './ages';
import { LAST_EPOCH, SERAI, SILK, TRADE } from './data';
import { NAVAL, distToRect, nearestWalkable } from './grid';
import { modsOf } from './stats';
import type { Building, GameState, Goal, TradePost, Unit } from './types';

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

/**
 * Where a ship tied up at a post's coast lies: the nearest open water within `TRADE.sea.reach` tiles of
 * it, or null when the post is inland (not a port).
 */
export function portSpot(s: GameState, post: TradePost, owner = -1): { x: number; y: number } | null {
  const reach = TRADE.sea.reach + (owner >= 0 ? modsOf(s, owner).portReach : 0);
  const t = nearestWalkable(s, post.x, post.y, reach, NAVAL);
  if (t < 0) return null;
  const x = (t % s.w) + 0.5;
  const y = Math.floor(t / s.w) + 0.5;
  const dx = x - post.x;
  const dy = y - post.y;
  return dx * dx + dy * dy <= reach * reach ? { x, y } : null;
}

const usableDock = (b: Building, owner: number) => b.type === 'dock' && b.owner === owner && b.built && b.hp > 0;

/** A player's finished Dock by this id, if it still stands. */
export function dockOf(s: GameState, owner: number, id: number): Building | null {
  const b = id ? s.byId.get(id) : undefined;
  return b && b.kind === 'building' && usableDock(b, owner) ? b : null;
}

/** The nearest finished Dock of a player's to a point, or null. */
export function nearestDock(s: GameState, owner: number, x: number, y: number): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  for (const e of s.ents) {
    if (e.kind !== 'building' || !usableDock(e, owner)) continue;
    const d = distToRect(x, y, e);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** What one trip between a Market (or, by sea, a Dock) and a post pays its owner now. */
export function tripGold(s: GameState, owner: number, market: { x: number; y: number }, post: TradePost, sea = false): number {
  const dx = market.x - post.x;
  const dy = market.y - post.y;
  const epoch = Math.min(LAST_EPOCH, s.players[owner].epoch);
  const k = TRADE.gold * (1 + Math.max(0, epoch - 1) * TRADE.epoch) * modsOf(s, owner).tradeGold * relicTradeShare(s, owner) * ironTradeShare(s, owner) * (sea ? TRADE.sea.mul : harborNear(s, owner, market) ? TRADE.harbor.mul : 1) * (!sea && seraiNear(s, owner, post) ? SERAI.pay : 1);
  return Math.max(1, Math.min(TRADE.max, Math.floor((dx * dx + dy * dy) * k)));
}

/**
 * A Market on the move (the Silk Road, #326): a player's wagon carrying a Market, or a Market being pitched
 * from one. A trader whose Market is on the road comes home to it there.
 */
const rolling = (e: Building | Unit, owner: number): boolean =>
  e.owner === owner && e.hp > 0 && (e.kind === 'unit' ? e.type === 'wagon' && e.packed === 'market' && !e.inside : e.type === 'market' && !e.built && e.pitch !== undefined);

/** A player's rolling Market by this id, if it still rolls (or is being pitched). */
export function caravanOf(s: GameState, owner: number, id: number): Building | Unit | null {
  const e = id ? s.byId.get(id) : undefined;
  return e && rolling(e, owner) ? e : null;
}

/** The nearest of a player's rolling Markets to a point, in id order on a tie, or null. */
export function nearestCaravan(s: GameState, owner: number, x: number, y: number): Building | Unit | null {
  let best: Building | Unit | null = null;
  let bestD = Infinity;
  for (const e of s.ents) {
    if (!rolling(e, owner)) continue;
    const dx = e.x - x, dy = e.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/**
 * What the Silk Road's caravans add to a trip (#326): `SILK.each` of its gold for every tile between where
 * the trader's Market stood when it set out and where it is paid in, at most `SILK.most` tiles. Whole
 * gold, and nothing outside an age with caravans or for a trip with no starting point.
 */
export function caravanBonus(s: GameState, owner: number, carry: number, from: { x: number; y: number } | undefined, home: { x: number; y: number }): { moved: number; bonus: number } {
  if (!from || carry <= 0 || !ageDef(s.players[owner]).caravans) return { moved: 0, bonus: 0 };
  const dx = home.x - from.x, dy = home.y - from.y;
  const moved = Math.floor(Math.sqrt(dx * dx + dy * dy));
  return { moved, bonus: Math.floor(carry * SILK.each * Math.min(SILK.most, moved)) };
}

/**
 * A finished Caravanserai of the owner's whose middle lies within `SERAI.near` tiles of the post (#334), the
 * first in id order, or null. Its land trips to that post pay `SERAI.pay` times as much.
 */
export function seraiNear(s: GameState, owner: number, post: { x: number; y: number }): Building | null {
  const r = SERAI.near;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'caravanserai' || e.owner !== owner || !e.built || e.hp <= 0) continue;
    const dx = e.x - post.x, dy = e.y - post.y;
    if (dx * dx + dy * dy <= r * r) return e;
  }
  return null;
}
