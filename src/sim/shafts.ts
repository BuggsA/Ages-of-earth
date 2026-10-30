/**
 * Mine Shafts (#681): stone and gold dug from the ground once the open deposits are gone. What the ground round a shaft holds
 * (old workings, mountain rock or plain earth) sets which seams it may dig and how fast; the numbers are `SHAFT` in `data.ts`.
 *
 * The deep mine (#924 m1, `docs/deep-mine.md`): a shaft is sunk down through the layers of `STRATA`. Each layer holds finite
 * veins, richer the deeper, and room for a few miners; a spent vein is still dug at the ground's plain grade, so a shaft is
 * never worse than it was before it had layers.
 *
 * Props, cave-ins and blasting (#924 m2): a layer below the first is shored with timber, or dug unshored, faster, with a chance
 * on the match's dice of a cave-in on every full basket. From the Gunpowder Age a layer is blasted open at once, with a chance of
 * firedamp above. A pithead that falls strands the miners below it.
 */
import { MEGALITH, SHAFT, STRATA, EPOCHS, secs } from './data';
import { roll } from './animals';
import { deepQuarry } from './henge';
import { mineable } from './household';
import { maxHp } from './world';
import type { Building, GameState, Order, Res, SeamId, Unit } from './types';
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
  // A people building in stone (#877) starts a shaft on stone on a tie: it is what the town waits on.
  const first: SeamId[] = deepQuarry(s, b.owner) ? ['stone', 'gold'] : ['gold', 'stone'];
  for (const m of [...first, ...SEAMS.filter((x) => x !== 'gold' && x !== 'stone')] as SeamId[]) {
    if (can.includes(m) && (!best || RANK[g[m]!] > RANK[g[best]!])) best = m;
  }
  return best;
}

/** The seam a shaft digs now: its own choice while that still holds, else the best there (null: none its people may dig). */
export function seamOf(s: GameState, b: Building): SeamId | null {
  return b.seam && seamsAt(s, b).includes(b.seam) ? b.seam : bestSeam(s, b);
}

/** The share of an open deposit's pace a shaft digs a seam at. */
export function shaftShare(s: GameState, b: { tx: number; ty: number; size: number; owner?: number }, seam: SeamId): number {
  const g = groundAt(s, b)[seam];
  if (!g) return 0;
  // The Age of Megaliths (#877) digs stone from any ground at `MEGALITH.grade` at the least: the road's stone never runs out.
  if (seam === 'stone' && b.owner !== undefined && b.owner >= 0 && deepQuarry(s, b.owner)) return Math.max(SHAFT.grade[g], MEGALITH.grade);
  return SHAFT.grade[g];
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

// ---- The deep mine (#924 m1) --------------------------------------------------------------------------------------

/** The deepest layer a shaft reaches (0: the first). A shaft from an older save stands in the first. */
export const depthOf = (b: Building): number => Math.min(b.depth ?? 0, STRATA.length - 1);

/** How much of a seam's vein is left to dig in a layer of this shaft (0 where the layer holds none, or it is spent). */
export function veinLeft(b: Building, layer: number, seam: SeamId): number {
  const full = STRATA[layer]?.veins[seam] ?? 0;
  return Math.max(0, full - (b.worked?.[layer]?.[seam] ?? 0));
}

/** Take one load's worth from a layer's vein. */
function takeVein(b: Building, layer: number, seam: SeamId): void {
  b.worked ??= [];
  while (b.worked.length <= layer) b.worked.push({});
  const row = (b.worked[layer] ??= {});
  row[seam] = (row[seam] ?? 0) + 1;
}

/**
 * The share of an open deposit's pace a miner in this layer digs a seam at: the plain grade, more while the layer's vein lasts,
 * and more again where the layer is dug unshored (#924 m2). Never less than the plain grade (rule 1).
 */
export function digShare(s: GameState, b: Building, seam: SeamId, layer: number): number {
  const floor = shaftShare(s, b, seam);
  if (!floor) return 0;
  const rush = safeAt(b, layer) ? 0 : STRATA[layer].rush;
  if (veinLeft(b, layer, seam) <= 0) return floor + rush;
  return Math.max(floor, SHAFT.grade[groundAt(s, b)[seam]!] + STRATA[layer].add) + rush;
}

// ---- Props, cave-ins and blasting (#924 m2) ----------------------------------------------------------------------

/** Whether a layer is safe to dig: it never falls in (the first), or it is shored with props. */
export const safeAt = (b: Building, layer: number): boolean => !(STRATA[layer]?.fall > 0) || !!b.propped?.[layer];

/** Whether a layer is shut by a cave-in's rubble now. */
export const shutAt = (s: GameState, b: Building, layer: number): boolean => (b.shut?.[layer] ?? 0) > s.tick;

/** Seconds until a caved-in layer is cleared, or 0. */
export const shutLeft = (s: GameState, b: Building, layer: number): number => (shutAt(s, b, layer) ? Math.ceil((b.shut![layer] - s.tick) / secs(1)) : 0);

/** Why a layer of a shaft can't be shored now, or null. Its cost is checked where it is paid. */
export function propProblem(b: Building, layer: number): string | null {
  if (b.type !== 'shaft') return 'Only a Mine Shaft is shored';
  if (!b.built) return 'Finish the shaft first';
  if (!STRATA[layer] || layer > depthOf(b)) return 'The shaft is not sunk that deep yet';
  if (!(STRATA[layer].fall > 0)) return `${STRATA[layer].name} stands without props`;
  if (b.propped?.[layer]) return `${STRATA[layer].name} is shored already`;
  return null;
}

/** The layer a shaft's Shore button props: the deepest it reaches that still wants props, or -1. */
export function toShore(b: Building): number {
  for (let l = depthOf(b); l > 0; l--) if (!safeAt(b, l)) return l;
  return -1;
}

/** Shore a layer with props (paid by the caller): safe from now on, and a cave-in's rubble there is cleared at once. */
export function prop(b: Building, layer: number): void {
  b.propped ??= [];
  while (b.propped.length <= layer) b.propped.push(false);
  b.propped[layer] = true;
  if (b.shut?.[layer]) b.shut[layer] = 0;
}

/** A layer falls in: the miners at its face die, in id order, and it is shut `SHAFT.shut` seconds. Returns how many died. */
export function caveIn(s: GameState, b: Building, layer: number, why: 'fall' | 'firedamp'): number {
  let dead = 0;
  for (const e of s.ents) {
    if (!crewman(e, b) || e.order.layer !== layer || e.order.phase !== 'work') continue;
    e.hp = 0;
    dead++;
  }
  b.shut ??= [];
  while (b.shut.length <= layer) b.shut.push(0);
  b.shut[layer] = s.tick + secs(SHAFT.shut);
  s.events.push({ k: 'caveIn', owner: b.owner, id: b.id, x: b.x, y: b.y, layer, dead, why });
  return dead;
}

/** A full basket dug in an unshored layer: a roll of the match's dice whether the layer falls in. True if it did. */
export function riskLoad(s: GameState, b: Building, layer: number): boolean {
  if (safeAt(b, layer)) return false;
  if (roll(s) >= STRATA[layer].fall) return false;
  caveIn(s, b, layer, 'fall');
  return true;
}

/** Why a shaft can't be blasted a layer deeper now, or null. Its charge is checked where it is paid. */
export function blastProblem(s: GameState, b: Building): string | null {
  const why = deepenProblem(s, b);
  if (why) return why;
  if (s.players[b.owner].epoch < SHAFT.blastAge) return `Blasting comes with the ${EPOCHS[SHAFT.blastAge].name}`;
  return null;
}

/** Blast a shaft a layer deeper at once (paid by the caller), with a roll for firedamp in the layer above. */
export function blast(s: GameState, b: Building): void {
  const above = depthOf(b);
  b.depth = above + 1;
  s.events.push({ k: 'blast', owner: b.owner, id: b.id, x: b.x, y: b.y, layer: b.depth });
  const chance = safeAt(b, above) && STRATA[above].fall > 0 ? SHAFT.firedampShored : SHAFT.firedamp;
  if (roll(s) < chance) caveIn(s, b, above, 'firedamp');
}

/** A shaft's winch is hurt: one sunk `SHAFT.winchDepth` layers down, under `SHAFT.winchHurt` of its health. */
export const winchHurt = (s: GameState, b: Building): boolean => depthOf(b) >= SHAFT.winchDepth && b.hp < maxHp(s, b) * SHAFT.winchHurt;

/**
 * A pithead has fallen (#924 m2): the miners at its faces are stranded. Those below the first layer die with the winch; those in
 * the first climb out hurt, off the face, so a second call passes them by. Their next step finds the shaft gone and sends them on.
 * Called by the first of its miners to find it fallen, and as it is cleared away, whichever comes first.
 */
export function strand(s: GameState, b: Building): void {
  let dead = 0;
  for (const e of s.ents) {
    if (!crewman(e, b) || e.order.phase !== 'work') continue;
    if ((e.order.layer ?? 0) > 0) {
      e.hp = 0;
      dead++;
    } else {
      e.hp = Math.max(1, Math.floor(e.hp * SHAFT.strandHurt));
      e.order.phase = 'go';
    }
  }
  if (dead) s.events.push({ k: 'caveIn', owner: b.owner, id: b.id, x: b.x, y: b.y, layer: depthOf(b), dead, why: 'stranded' });
}

/** Whether a unit works this shaft (on its way to it, at it, or hauling from it). */
const crewman = (e: GameState['ents'][number], b: Building): e is Unit & { order: Extract<Order, { k: 'shaft' }> } =>
  e.kind === 'unit' && e.hp > 0 && e.owner === b.owner && e.order.k === 'shaft' && e.order.target === b.id;

/** A shaft's crew: how many hold a place in each layer it reaches, and how many are on their way without one. */
export function crewOf(s: GameState, b: Building, skip?: Unit): { at: number[]; coming: number } {
  const at = STRATA.map(() => 0);
  let coming = 0;
  for (const e of s.ents) {
    if (e === skip || !crewman(e, b)) continue;
    const l = e.order.layer;
    if (l === undefined || l > depthOf(b)) coming++;
    else at[l]++;
  }
  return { at, coming };
}

/** How many miners a shaft has room for, in all the layers it reaches. */
export function roomOf(b: Building): number {
  let n = 0;
  for (let l = 0; l <= depthOf(b); l++) n += STRATA[l].room;
  return n;
}

/** How many more miners a shaft takes: its room less its crew, those on their way too. */
export function roomLeft(s: GameState, b: Building): number {
  const c = crewOf(s, b);
  return roomOf(b) - c.coming - c.at.reduce((a, n) => a + n, 0);
}

/**
 * The layer a miner arriving at a shaft takes: its own while that still has a vein of the seam, else the deepest with room
 * and a vein, else its own, else the deepest with room (dug at the plain grade). -1: no room at all.
 */
export function placeFor(s: GameState, b: Building, u: Unit, seam: SeamId, want?: number): number {
  const { at } = crewOf(s, b, u);
  const open = (l: number) => l >= 0 && l <= depthOf(b) && at[l] < STRATA[l].room && !shutAt(s, b, l);
  if (want !== undefined && open(want) && veinLeft(b, want, seam) > 0) return want;
  for (let l = depthOf(b); l >= 0; l--) if (open(l) && veinLeft(b, l, seam) > 0) return l;
  if (want !== undefined && open(want)) return want;
  for (let l = depthOf(b); l >= 0; l--) if (open(l)) return l;
  return -1;
}

/** One miner's stroke at the face: what it digs in a tick, and the vein it takes from while that lasts. */
export function digAt(s: GameState, b: Building, seam: SeamId, layer: number, rate: number, u: Unit): void {
  const vein = veinLeft(b, layer, seam) > 0;
  // A hurt winch (#924 m2) hauls slowly from below the first layer.
  u.frac += rate * digShare(s, b, seam, layer) * (layer > 0 && winchHurt(s, b) ? SHAFT.winchSlow : 1);
  while (u.frac >= 1) {
    u.frac -= 1;
    u.carry++;
    if (vein && veinLeft(b, layer, seam) > 0) takeVein(b, layer, seam);
  }
}

/** Whether every layer a shaft reaches has its vein of this seam dug out (a seam no layer holds counts as spent). */
export function spentAt(b: Building, seam: SeamId): boolean {
  for (let l = 0; l <= depthOf(b); l++) if (veinLeft(b, l, seam) > 0) return false;
  return true;
}

/** Why a shaft can't be sunk a layer deeper now, or null. Its cost is checked where it is paid. */
export function deepenProblem(s: GameState, b: Building): string | null {
  if (b.type !== 'shaft') return 'Only a Mine Shaft is sunk';
  if (!b.built) return 'Finish the shaft first';
  if (b.deepening !== undefined) return 'Already sinking';
  const next = STRATA[depthOf(b) + 1];
  if (!next) return 'The shaft is as deep as it goes';
  if (s.players[b.owner].epoch < next.epoch) return `${next.name} is reached from the ${EPOCHS[next.epoch].name}`;
  return null;
}

/** Start sinking a shaft a layer deeper (paid by the caller). */
export function deepen(s: GameState, b: Building): void {
  b.deepening = s.tick + secs(STRATA[depthOf(b) + 1].time);
}

/** Seconds until a shaft being sunk reaches its next layer, or 0. */
export const deepeningLeft = (s: GameState, b: Building): number => (b.deepening === undefined ? 0 : Math.max(0, Math.ceil((b.deepening - s.tick) / secs(1))));

/** Each tick: shafts being sunk reach their next layer. */
export function deepenStep(s: GameState): void {
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'shaft' || e.deepening === undefined || s.tick < e.deepening) continue;
    e.depth = depthOf(e) + 1;
    delete e.deepening;
  }
}
