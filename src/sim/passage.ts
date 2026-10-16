import { SERAI, TOLL, secs } from './data';
import { borderMap } from './borders';
import { modsOf } from './stats';
import { isEnemy, maxHp } from './world';
import type { Building, GameState, Unit } from './types';

/**
 * The Silk Road's roads (#334). Caravanserais rest the caravans that pass them, and a caravan people takes a
 * toll from rival traders crossing its land: safe passage, what tribute becomes for a people that lives by
 * the roads. The numbers are `SERAI` and `TOLL` in `data.ts`.
 */

/** Whether this unit is a trader heading home with gold, which owes the tolls of the land it crosses. */
export const laden = (u: Unit): boolean => u.type === 'trader' && u.hp > 0 && !u.inside && u.carry > 0 && u.order.k === 'trade' && u.order.phase === 'back';

/** Whether a laden trader of `u.owner`'s standing on `landOwner`'s land owes it a toll now. */
export function owesToll(s: GameState, u: Unit, landOwner: number): boolean {
  return landOwner >= 0 && laden(u) && isEnemy(s, u.owner, landOwner) && !s.players[landOwner].defeated && modsOf(s, landOwner).toll > 0 && ((u.tolled ?? 0) & (1 << landOwner)) === 0;
}

/** What a toll takes from a load: the land owner's `toll` share, in whole gold. */
export const tollOf = (s: GameState, landOwner: number, carry: number): number => Math.floor(carry * modsOf(s, landOwner).toll);

/** Every `TOLL.every` seconds outside the peace: laden rival traders pay the tolls of the land they stand on. */
export function tollStep(s: GameState): void {
  if (s.tick === 0 || s.tick < s.peaceUntil || s.tick % secs(TOLL.every) !== 0) return;
  // Nothing is read or built unless some people takes a toll, so a match without a caravan people runs as it always did.
  if (!s.players.some((p) => !p.defeated && modsOf(s, p.id).toll > 0)) return;
  let own: Int8Array | null = null;
  for (const u of s.ents) {
    if (u.kind !== 'unit' || !laden(u)) continue;
    const x = Math.floor(u.x), y = Math.floor(u.y);
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
    own ??= borderMap(s);
    const here = own[y * s.w + x];
    if (!owesToll(s, u, here)) continue;
    // Paid or not (a load too small to share), this land is behind it now.
    u.tolled = (u.tolled ?? 0) | (1 << here);
    const gold = tollOf(s, here, u.carry);
    if (gold <= 0) continue;
    u.carry -= gold;
    const p = s.players[here];
    p.res.gold += gold;
    p.stats.gathered += gold;
    p.stats.toll = (p.stats.toll ?? 0) + gold;
    s.events.push({ k: 'toll', owner: here, from: u.owner, gold, id: u.id, x: u.x, y: u.y });
  }
}

/** A player's finished Caravanserais, in id order. */
const serais = (s: GameState): Building[] => s.ents.filter((e): e is Building => e.kind === 'building' && e.type === 'caravanserai' && e.built && e.hp > 0);

/** Whether a unit rests at a Caravanserai: a trader or wagon of its owner's or an ally's, hurt, within `SERAI.rest` tiles. */
export function restsAt(s: GameState, u: Unit, b: Building): boolean {
  if (u.hp <= 0 || u.inside || (u.type !== 'trader' && u.type !== 'wagon') || s.players[u.owner].team !== s.players[b.owner].team) return false;
  const dx = u.x - b.x, dy = u.y - b.y;
  return dx * dx + dy * dy <= SERAI.rest * SERAI.rest;
}

/** Every `SERAI.every` seconds: traders and wagons by a Caravanserai mend `SERAI.heal` a second. */
export function seraiStep(s: GameState): void {
  if (s.tick === 0 || s.tick % secs(SERAI.every) !== 0) return;
  const inns = serais(s);
  if (!inns.length) return;
  for (const u of s.ents) {
    if (u.kind !== 'unit' || (u.type !== 'trader' && u.type !== 'wagon')) continue;
    const top = maxHp(s, u);
    if (u.hp <= 0 || u.hp >= top) continue;
    if (inns.some((b) => restsAt(s, u, b))) u.hp = Math.min(top, u.hp + SERAI.heal * SERAI.every);
  }
}
