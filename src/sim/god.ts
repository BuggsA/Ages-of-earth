import { AGES } from './data';
import { enterAge } from './game';
import type { AgeId, GameState } from './types';
import { RES } from './types';
import { completeBuilding } from './units';
import { maxHp } from './world';

/** Stock a god-mode player is held at (#399). */
export const GOD_STOCK = 99999;

/** Work done in one go: more than any build, research, training or road takes. */
const INSTANT = 1e9;

/**
 * Testing aid (#399, #495): a sandbox. Entering changes nothing about age or progress; the player gets a
 * full treasury, instant builds and upgrades (`rush`), and may jump to any age (`jumpAge`). Solo play only,
 * and applied straight to the state, never as a command: a room must not let anyone cheat, and the cheat is
 * not part of the rules a replay would play back.
 */
export function topUp(s: GameState, owner: number): void {
  const p = s.players[owner];
  if (!p) return;
  for (const r of RES) if (p.res[r] < GOD_STOCK) p.res[r] = GOD_STOCK;
}

/** Finish, this tick, every foundation, research, training and road the player has under way. */
export function rush(s: GameState, owner: number): void {
  const p = s.players[owner];
  if (!p) return;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== owner || e.hp <= 0) continue;
    if (!e.built) {
      e.hp = maxHp(s, e);
      completeBuilding(s, e);
    }
    if (e.advance >= 0) e.advance = INSTANT;
    for (const q of e.queue) {
      if (q.tech) q.done = INSTANT;
      else if (p.pop + (q.kin ?? 1) <= p.cap) q.done = INSTANT;
    }
  }
}

/** Go to any age on demand, forward or back, as an advance or a step back would. */
export function jumpAge(s: GameState, owner: number, to: AgeId): void {
  const p = s.players[owner];
  if (!p || !AGES[to] || p.age === to) return;
  enterAge(s, p, to, AGES[to].tier < p.epoch);
}
