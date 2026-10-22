import { FAIR, MILITARY, secs } from './data';
import { ageDef } from './ages';
import { isEnemy, maxHp } from './world';
import type { AgeId, GameState } from './types';

/** Whether a feast day is open now (the Age of Fairs): the first `open` seconds of every `every`. */
export const feastOpen = (s: GameState): boolean => s.tick % secs(FAIR.every) < secs(FAIR.open);

/** Ticks until the next feast day opens (0 while one is open). */
export const nextFeastIn = (s: GameState): number => (feastOpen(s) ? 0 : secs(FAIR.every) - (s.tick % secs(FAIR.every)));

/** Whether a Market stands within reach of a standing Temple of the owner's that keeps a relic: a fairground. */
export function fairground(s: GameState, owner: number, at: { x: number; y: number }): boolean {
  const r2 = FAIR.reach * FAIR.reach;
  for (const r of s.relics) {
    if (!r.temple) continue;
    const t = s.byId.get(r.temple);
    if (!t || t.kind !== 'building' || t.owner !== owner || t.hp <= 0 || !t.built) continue;
    if ((t.x - at.x) * (t.x - at.x) + (t.y - at.y) * (t.y - at.y) <= r2) return true;
  }
  return false;
}

/** What a trip paid at this Market is multiplied by now: `FAIR.pay` on a feast day at a fairground, else 1. */
export function fairShare(s: GameState, owner: number, market: { x: number; y: number; keep?: AgeId }): number {
  // A Market kept as the Fairs' keepsake (#555 s11) keeps its feast day on any road.
  return (ageDef(s.players[owner]).fairs || market.keep === 'fair') && feastOpen(s) && fairground(s, owner, market) ? FAIR.pay : 1;
}

/**
 * What a unit's price is multiplied by now (#356, the levy): `FAIR.levy` for a unit other than a hero queued on a
 * feast day at a building of a Fairs people that stands on its fairground (`where`), else 1. Heroes are the tournament's.
 */
export function fairLevy(s: GameState, owner: number, unit: string, where?: { x: number; y: number }): number {
  if (!where || unit === 'hero' || !ageDef(s.players[owner]).fairs || !feastOpen(s)) return 1;
  return fairground(s, owner, where) ? FAIR.levy : 1;
}

/**
 * The lists (#379): when a feast closes, a Fairs people whose hero stands within `FAIR.reach` of its fairground Market
 * has held a tournament. The hero is healed whole and the crowd pays `FAIR.lists` gold, unless a rival's soldier
 * stands there too, which spoils the day.
 */
function tournament(s: GameState): void {
  const r2 = FAIR.reach * FAIR.reach;
  for (const p of s.players) {
    if (!ageDef(p).fairs || p.defeated) continue;
    const near = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) <= r2;
    const grounds = s.ents.filter((e) => e.kind === 'building' && e.owner === p.id && e.type === 'market' && e.built && e.hp > 0 && fairground(s, p.id, e));
    if (!grounds.length) continue;
    const hero = s.ents.find((e) => e.kind === 'unit' && e.owner === p.id && e.type === 'hero' && e.hp > 0 && grounds.some((g) => near(e, g)));
    if (!hero) continue;
    const spoiled = s.ents.some((e) => e.kind === 'unit' && e.hp > 0 && MILITARY.includes(e.type as never) && isEnemy(s, p.id, e.owner) && grounds.some((g) => near(e, g)));
    if (spoiled) continue;
    hero.hp = maxHp(s, hero);
    p.res.gold += FAIR.lists;
    s.events.push({ k: 'joust', owner: p.id, x: hero.x, y: hero.y, gold: FAIR.lists });
  }
}

/** Tells each Fairs people with a fairground when a feast opens, and holds the tournament when it closes. */
export function fairStep(s: GameState): void {
  if (s.tick > 0 && s.tick % secs(FAIR.every) === secs(FAIR.open)) tournament(s);
  if (s.tick % secs(FAIR.every) !== 0 || s.tick === 0) return;
  for (const p of s.players) {
    if (!ageDef(p).fairs) continue;
    for (const e of s.ents) {
      if (e.kind === 'building' && e.owner === p.id && e.type === 'market' && e.built && e.hp > 0 && fairground(s, p.id, e)) {
        s.events.push({ k: 'fair', owner: p.id });
        break;
      }
    }
  }
}

/** The gold a rival takes for razing this Market on a feast day at its owner's fairground: `FAIR.purse`, else 0. */
export function fairPurse(s: GameState, market: { type: string; owner: number; x: number; y: number }): number {
  return market.type === 'market' && fairShare(s, market.owner, market) > 1 ? FAIR.purse : 0;
}
