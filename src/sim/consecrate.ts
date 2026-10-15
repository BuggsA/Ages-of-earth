import { BUILDINGS, CONSECRATE, DT, secs } from './data';
import { peace } from './combat';
import { stampBuilding } from './grid';
import { groveBoost } from './landmarks';
import { modsOf } from './stats';
import type { Building, GameState, Unit } from './types';
import { isEnemy, maxHp, refund } from './world';

/**
 * Faith takes the walls (#209): a pilgrim people builds no siege engines, so its priests chant a rival's
 * building over instead. Every chanting priest adds to one tally on the building (`faith`, 0 to 1);
 * when it fills, the building and everything in it changes hands. The numbers live in `CONSECRATE`.
 */

/** Whether a people's priests can chant buildings over at all (the Age of Pilgrims). */
export const consecrates = (s: GameState, owner: number): boolean => modsOf(s, owner).consecrate > 0;

/** Why `owner`'s priests can't chant this building over, or null if they can. */
export function consecrateProblem(s: GameState, owner: number, b: Building): string | null {
  if (!consecrates(s, owner)) return 'Only a pilgrim people\'s priests can win over buildings';
  if (b.hp <= 0 || !isEnemy(s, owner, b.owner)) return 'Only a rival\'s buildings can be won over';
  if (CONSECRATE.never.includes(b.type)) return `A ${BUILDINGS[b.type].name} never turns`;
  if (peace(s)) return 'Not while the peace treaty holds';
  return null;
}

/** How far the chant has come on a building (0 to 1), and whose it is. */
export const faithOf = (b: Building): number => b.faith ?? 0;

/** How much the keeper's own priests, standing near in the open, slow a chant on `b` (each adds `counter.each`). */
export function counterChant(s: GameState, b: Building): number {
  const r2 = CONSECRATE.counter.range * CONSECRATE.counter.range;
  const mul = modsOf(s, b.owner).priest;
  let n = 0;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.owner !== b.owner || e.type !== 'priest' || e.hp <= 0 || e.inside) continue;
    const dx = e.x - b.x;
    const dy = e.y - b.y;
    if (dx * dx + dy * dy <= r2) n += mul;
  }
  return n * CONSECRATE.counter.each;
}

/** What one priest's chant adds to a building's tally each tick (as a share of the whole). */
export function chantShare(s: GameState, u: Unit, b: Building): number {
  const need = maxHp(s, b) * (CONSECRATE.hard[b.type] ?? 1);
  const voice = CONSECRATE.rate * modsOf(s, u.owner).priest * groveBoost(s, u);
  return (voice * DT) / (need * (1 + CONSECRATE.guard * b.garrison.length + counterChant(s, b)));
}

/**
 * One tick of a priest's chant at a building. A rival people's faith is worn away before this one's
 * builds. Returns true when the tally is full and the building should turn (the caller lets out those
 * inside, then calls `turnBuilding`).
 */
export function chant(s: GameState, u: Unit, b: Building): boolean {
  const add = chantShare(s, u, b);
  if (b.faith === undefined || b.faith <= 0) {
    b.faith = 0;
    b.faithBy = u.owner;
  }
  if (b.faithBy !== u.owner) {
    b.faith = Math.max(0, b.faith - add);
    if (b.faith === 0) b.faithBy = u.owner;
  } else b.faith = Math.min(1, b.faith + add);
  // Tell the keeper, as a blow would, once in a while.
  const keeper = s.players[b.owner];
  if (b.chant === undefined || s.tick - b.chant > secs(CONSECRATE.grace)) {
    if (s.tick - keeper.alert > secs(12)) {
      keeper.alert = s.tick;
      s.events.push({ k: 'chanting', owner: b.owner, by: u.owner, id: b.id, type: b.type, x: b.x, y: b.y });
    }
  }
  b.chant = s.tick;
  return b.faithBy === u.owner && b.faith >= 1;
}

function forget(b: Building): void {
  delete b.faith;
  delete b.faithBy;
  delete b.chant;
}

/**
 * The building changes hands, keeping its share of health. Whatever it was training or researching is
 * refunded to the people who lost it; its farmer, rally point and beacon are theirs no longer. Relics in
 * a Temple follow it, since a relic belongs to whoever holds its Temple.
 */
export function turnBuilding(s: GameState, b: Building, to: number): void {
  const from = b.owner;
  const share = b.hp / maxHp(s, b);
  for (const q of b.queue) refund(s.players[from], q.paid);
  b.queue = [];
  b.rally = null;
  b.farmer = 0;
  delete b.beacon;
  delete b.beaconReady;
  forget(b);
  // Restamped, so a gate opens for its new side and shuts on its old one.
  stampBuilding(s, b, false);
  b.owner = to;
  stampBuilding(s, b, true);
  b.hp = Math.max(1, share * maxHp(s, b));
  b.hurt = s.tick;
  s.players[to].stats.converted++;
  s.events.push({ k: 'consecrated', id: b.id, from, to, x: b.x, y: b.y, type: b.type, size: b.size });
}

/** Faith with no one chanting fades, after a breath. */
export function faithStep(s: GameState): void {
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.faith === undefined) continue;
    if (s.tick - (e.chant ?? 0) <= secs(CONSECRATE.grace)) continue;
    e.faith -= CONSECRATE.fade * DT;
    if (e.faith <= 0) forget(e);
  }
}
