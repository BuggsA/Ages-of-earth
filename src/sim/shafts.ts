/**
 * Mine Shafts (#681): stone and gold dug from the ground once the open deposits are gone. What the ground round a shaft holds
 * (old workings, mountain rock or plain earth) sets which seams it may dig and how fast; the numbers are `SHAFT` in `data.ts`.
 */
import { SHAFT } from './data';
import { mineable } from './household';
import type { Building, GameState, Res, SeamId } from './types';
import { R_BLOODIRON, R_GLOWCAP, R_GOLD, R_SALT, R_SALTPETRE, R_STONE, T_ROCK } from './types';

export type Grade = keyof typeof SHAFT.grade;

/** Every seam, in the order its buttons show. */
export const SEAMS = Object.keys(SHAFT.seams) as SeamId[];

/** The tile kind a seam is dug as (its pace and its mining technologies are that deposit's). */
export const TILE_OF_SEAM: Record<SeamId, number> = { stone: R_STONE, gold: R_GOLD, salt: R_SALT, saltpetre: R_SALTPETRE, bloodiron: R_BLOODIRON, glowcap: R_GLOWCAP };

/** The stock a seam pays into: a rare ore is carried as stone and kept apart at the drop, as from its vein. */
export const resOfSeam = (seam: SeamId): Res => (seam === 'gold' ? 'gold' : 'stone');

/** The tiles round a shaft's footprint (it too) that its ground is read from, `SHAFT.near` out. */
function around(s: GameState, b: { tx: number; ty: number; size: number }, see: (i: number) => void): void {
  const n = SHAFT.near;
  for (let y = Math.max(0, b.ty - n); y < Math.min(s.h, b.ty + b.size + n); y++) {
    for (let x = Math.max(0, b.tx - n); x < Math.min(s.w, b.tx + b.size + n); x++) see(y * s.w + x);
  }
}

/** What each seam's ground is at a shaft (or a site for one): its grade, or null where it can't be dug at all. */
export function groundAt(s: GameState, b: { tx: number; ty: number; size: number }): Record<SeamId, Grade | null> {
  const old = new Set<number>();
  let rock = false;
  around(s, b, (i) => {
    if (s.spent?.[i]) old.add(s.spent[i]);
    if (s.terrain[i] === T_ROCK) rock = true;
  });
  const out = {} as Record<SeamId, Grade | null>;
  for (const seam of SEAMS) {
    out[seam] = old.has(TILE_OF_SEAM[seam]) ? 'old' : SHAFT.seams[seam].old ? null : rock ? 'hill' : 'open';
  }
  return out;
}

/** The seams a shaft here may dig for its people: held by the ground, and worked by that people (a household mines no gold, a nomad camp quarries no stone, #501). */
export function seamsAt(s: GameState, b: { tx: number; ty: number; size: number; owner: number }): SeamId[] {
  const g = groundAt(s, b);
  const p = s.players[b.owner];
  return SEAMS.filter((m) => g[m] && mineable(p, TILE_OF_SEAM[m]));
}

const RANK: Record<Grade, number> = { old: 3, hill: 2, open: 1 };

/** The seam a new shaft starts on: the best its ground holds of what its people digs, gold on a tie, a rare ore last; null if none. */
export function bestSeam(s: GameState, b: { tx: number; ty: number; size: number; owner: number }): SeamId | null {
  const g = groundAt(s, b);
  const can = seamsAt(s, b);
  let best: SeamId | null = null;
  for (const m of ['gold', 'stone', ...SEAMS.filter((x) => x !== 'gold' && x !== 'stone')] as SeamId[]) {
    if (can.includes(m) && (!best || RANK[g[m]!] > RANK[g[best]!])) best = m;
  }
  return best;
}

/** The seam a shaft digs now: its own choice while that still holds, else the best there (null: none its people may dig). */
export function seamOf(s: GameState, b: Building): SeamId | null {
  return b.seam && seamsAt(s, b).includes(b.seam) ? b.seam : bestSeam(s, b);
}

/** The share of an open deposit's pace a shaft digs a seam at. */
export function shaftShare(s: GameState, b: { tx: number; ty: number; size: number }, seam: SeamId): number {
  const g = groundAt(s, b)[seam];
  return g ? SHAFT.grade[g] : 0;
}

/** Why a shaft can't be set to dig this seam, or null. */
export function seamProblem(s: GameState, b: Building, seam: SeamId): string | null {
  if (!(seam in SHAFT.seams)) return 'No such seam';
  if (!groundAt(s, b)[seam]) return `${SHAFT.seams[seam].name} is dug only where a vein of it was worked out`;
  if (!mineable(s.players[b.owner], TILE_OF_SEAM[seam])) return seam === 'gold' ? 'Your people mines no gold' : 'Your people quarries no stone';
  return null;
}

/** Which of the ground's grades a site has at its best, for the placement hint and the computer's choice of spot. */
export function siteGrade(s: GameState, b: { tx: number; ty: number; size: number }): Grade {
  const g = groundAt(s, b);
  return g.stone === 'old' || g.gold === 'old' ? 'old' : g.stone!;
}
