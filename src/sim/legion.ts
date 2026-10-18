import { CIVS, LEGION } from './data';
import { R_BOG, R_STONE, R_TREE } from './types';
import type { GameState, Player, Unit } from './types';

/**
 * The legion (#501, the Romans): a people with few citizens whose foot soldiers are its hands. A legionary fells timber, quarries
 * stone (at `LEGION.rate` of a citizen's pace) and raises any building between wars; food and gold are left to the few citizens.
 * A legionary at work is still on watch (`sentry`): an enemy near makes him drop his tools and take it on.
 */
export const isLegion = (p: Player): boolean => !!CIVS[p.civ].legion;

/** Whether this unit is a soldier of a legion people, who may work the timber, the quarry and the trowel (not a thrall). */
export const legionary = (s: GameState, u: Unit): boolean => u.type === 'infantry' && !u.thrall && isLegion(s.players[u.owner]);

/** Whether a legionary may gather this kind of tile: timber, stone and bog iron (the iron road is walked on foot). */
export const legionKind = (kind: number): boolean => kind === R_TREE || kind === R_STONE || kind === R_BOG;

/** The most citizens a legion town keeps: `LEGION.citizens`, and `LEGION.perEpoch` more for each epoch past the first. */
export const citizenCap = (p: Player): number => LEGION.citizens + p.epoch * LEGION.perEpoch;

/** Why a legion town can train no more citizens, or null: its citizens living and in training are already as many as it keeps. */
export function citizenProblem(s: GameState, p: Player): string | null {
  if (!isLegion(p)) return null;
  let n = 0;
  for (const e of s.ents) {
    if (e.owner !== p.id || e.hp <= 0) continue;
    if (e.kind === 'unit') {
      if (e.type === 'citizen') n++;
    } else for (const q of e.queue) if (q.unit === 'citizen') n++;
  }
  return n >= citizenCap(p) ? `A Roman town keeps only ${citizenCap(p)} citizens: put the legion to work (more with each epoch)` : null;
}
