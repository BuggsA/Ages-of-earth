import { CIVS, COPPICE, SNARE, secs } from './data';
import { modsOf } from './stats';
import { seasonAt } from './seasons';
import { R_TREE } from './types';
import type { Building, GameState } from './types';

/**
 * Snares in the wood (#485), the Deep Wood's own verb: a Snare set among standing trees fills with small game
 * by itself, faster the more trees stand round it and fastest in winter, up to `SNARE.cap`. A tender walks
 * the trap line (`snareStep` in `units.ts`), emptying each snare in turn. The trees you keep are food; the
 * trees you fell are wood, and a snare with its woods cut round it starves.
 */

/** Trees standing within `SNARE.r` tiles of a tile. */
export function treesNear(s: GameState, tx: number, ty: number): number {
  let n = 0;
  for (let y = ty - SNARE.r; y <= ty + SNARE.r; y++) {
    if (y < 0 || y >= s.h) continue;
    for (let x = tx - SNARE.r; x <= tx + SNARE.r; x++) {
      if (x < 0 || x >= s.w) continue;
      if (s.res[y * s.w + x] === R_TREE) n++;
    }
  }
  return n;
}

const isSnare = (e: GameState['ents'][number]): e is Building => e.kind === 'building' && e.type === 'snare' && e.hp > 0;

/** Why a Snare can't go on this tile: too few trees round it, or another snare too near (anyone's); null if it can. */
export function snareSpot(s: GameState, tx: number, ty: number): 'woods' | 'snares' | null {
  for (const e of s.ents) {
    if (!isSnare(e)) continue;
    if (Math.abs(e.tx - tx) < SNARE.apart && Math.abs(e.ty - ty) < SNARE.apart) return 'snares';
  }
  return treesNear(s, tx, ty) < SNARE.need ? 'woods' : null;
}

/** Whether a snare's people keeps a managed wood (#501, the Britons): its snares are its fields. */
const managed = (s: GameState, b: Building): boolean => !!CIVS[s.players[b.owner]?.civ]?.coppice;

/** Food a second a snare catches now: its woods, the season; a managed wood's snares (#501) catch `COPPICE.snare` times as fast, and gain as fields do from farming. */
export function snareRate(s: GameState, b: Building): number {
  const woods = Math.min(1, treesNear(s, b.tx, b.ty) / SNARE.full);
  const kept = managed(s, b) ? COPPICE.snare * modsOf(s, b.owner).farm : 1;
  return SNARE.rate * woods * kept * (seasonAt(s) === 3 ? SNARE.winter : 1);
}

/** The most food a snare holds: half again as much in a managed wood (#501). */
export const snareCap = (s: GameState, b: Building): number => SNARE.cap * (managed(s, b) ? COPPICE.cap : 1);

/** Run each tick: once a second every finished snare fills by its rate, up to its cap. */
export function fillSnares(s: GameState): void {
  if (s.tick % secs(1) !== 0) return;
  for (const e of s.ents) {
    if (!isSnare(e) || !e.built) continue;
    const had = e.snared ?? 0;
    const cap = snareCap(s, e);
    if (had >= cap) continue;
    e.snared = Math.min(cap, had + snareRate(s, e));
  }
}

/** The food in a snare, whole. */
export const catchIn = (b: Building) => Math.floor(b.snared ?? 0);

/**
 * The next snare on a tender's round: the nearest finished one of `owner`'s within `SNARE.round` tiles of a point
 * holding at least `SNARE.worth`, passing over `skip` and any another tender is already headed to. Null if none.
 */
export function nextSnare(s: GameState, owner: number, x: number, y: number, skip = 0, tender = 0): Building | null {
  const taken = new Set<number>();
  for (const e of s.ents) {
    if (e.kind === 'unit' && e.owner === owner && e.id !== tender && e.hp > 0 && e.order.k === 'snare') taken.add(e.order.target);
  }
  let best: Building | null = null;
  let bestD = SNARE.round * SNARE.round;
  for (const e of s.ents) {
    if (!isSnare(e) || !e.built || e.owner !== owner || e.id === skip || taken.has(e.id) || catchIn(e) < SNARE.worth) continue;
    const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}
