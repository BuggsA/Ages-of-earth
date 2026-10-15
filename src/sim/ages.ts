import { AGES, BUILDINGS, ROADS, STEP_BACK, TECHS, TICK_HZ, TRUNK, secs, stepBackCost, type Age, type Deed, type Road } from './data';
import type { AgeId, Building, BuildingType, Cost, GameState, Player, TechId, UnitType } from './types';

/**
 * Ages as a web (#37): which age a people is in, the roads out of it, and what that age lets them
 * train where. The numbers live in `AGES` and `ROADS` in `data.ts`.
 */

/** The age a player is in. Anything that sets the epoch alone (older saves, tests) lands on the trunk. */
export function ageOf(p: Player): AgeId {
  return p.age && AGES[p.age] && AGES[p.age].tier === p.epoch ? p.age : TRUNK[Math.min(p.epoch, TRUNK.length - 1)];
}

export const ageDef = (p: Player): Age => AGES[ageOf(p)];

/** Whether the people has stood in this age at some time in the match, or stands in it now (heirlooms, #224). */
export function hasWalked(p: Player, age: AgeId): boolean {
  return ageOf(p) === age || !!p.walked?.includes(age);
}

/** Records the side age a people has just entered; the trunk ages are everyone's and aren't kept. */
export function noteWalked(p: Player, age: AgeId): void {
  if (TRUNK.includes(age) || p.walked?.includes(age)) return;
  p.walked = [...(p.walked ?? []), age];
}

/** The heirlooms whose ages the people has both walked, in tech order: what entering `age` just opened. */
export function heirloomsOpened(p: Player, age: AgeId): TechId[] {
  const out: TechId[] = [];
  for (const id of Object.keys(TECHS) as TechId[]) {
    const pair = TECHS[id].walked;
    if (pair && pair.includes(age) && pair.every((a) => hasWalked(p, a))) out.push(id);
  }
  return out;
}

/** Every road out of the player's age, known or not. */
export function roadsFrom(p: Player): Road[] {
  const here = ageOf(p);
  return ROADS.filter((r) => r.from === here);
}

/** The road `advance` takes without a target: forward onto the trunk. */
export function mainRoad(p: Player): Road | undefined {
  const out = roadsFrom(p);
  return out.find((r) => TRUNK.includes(r.to) && AGES[r.to].tier > p.epoch) ?? out.find((r) => AGES[r.to].tier > p.epoch);
}

/** The road to an age (or the main road), if one leads there from the player's age; also the road a Town Center is on, from its `advanceTo`. */
export function roadTo(p: Player, to?: AgeId): Road | undefined {
  return to ? roadsFrom(p).find((r) => r.to === to) : mainRoad(p);
}

/** What a survey (#39) found in this world: whether the deposit it looks for is anywhere at all. */
export function surveyFinds(s: GameState, tech: TechId): boolean {
  const what = TECHS[tech].survey;
  return !!what && s[what] === true;
}

/**
 * Whether the player has a reason to know the road is there: its clue stands in their town, and its
 * survey has been made and found what the road needs. A survey that finds nothing hides it for good.
 */
export function roadKnown(s: GameState, p: Player, r: Road): boolean {
  if (r.ruin && !s.ruins?.some((ruin) => ruin.by === p.id)) return false;
  if (r.found && !(p.techs.includes(r.found) && surveyFinds(s, r.found))) return false;
  return !r.clue || s.ents.some((e) => e.kind === 'building' && e.owner === p.id && e.type === r.clue && e.built);
}

/** Every deed a road needs: its own, then any it asks for `also` (#49). */
export const deedsOf = (r: Road): Deed[] => (r.deed ? (r.also ? [r.deed, ...r.also] : [r.deed]) : (r.also ?? []));

export interface DeedProgress {
  deed: Deed;
  have: number;
  need: number;
}

/** How far along each of a road's deeds is (empty if it needs none). */
export const deedsProgress = (p: Player, r: Road): DeedProgress[] => deedsOf(r).map((deed) => ({ deed, have: Math.floor(p.stats[deed.stat] ?? 0), need: deed.n }));

/** How far along a road's first deed is, or null if it has none. */
export function deedProgress(p: Player, r: Road): { have: number; need: number } | null {
  const d = deedsProgress(p, r)[0];
  return d ? { have: d.have, need: d.need } : null;
}

/** Whether every deed a road asks for is done. */
export const deedsDone = (p: Player, r: Road): boolean => deedsProgress(p, r).every((d) => d.have >= d.need);

/** What, besides its price, keeps a player off a road, or null. */
export function roadProblem(s: GameState, p: Player, r: Road): string | null {
  if (!roadKnown(s, p, r)) {
    if (r.ruin) return 'Your citizens must finish excavating an ancient ruin';
    if (r.found && !p.techs.includes(r.found)) return `Needs ${TECHS[r.found].name}`;
    if (r.found && !surveyFinds(s, r.found)) return 'There is none in this world';
    return `Needs a ${BUILDINGS[r.clue!].name}`;
  }
  const left = deedsProgress(p, r).filter((d) => d.have < d.need);
  return left.length ? left.map((d) => `${d.deed.text} (${d.have}/${d.need})`).join('; ') : null;
}

/** Units a player hires at a building in their age, beyond what it usually trains. */
export function hiresAt(p: Player, at: BuildingType): UnitType[] {
  const h = ageDef(p).hire;
  return h && h.at === at ? h.units.filter((u) => !BUILDINGS[at].trains.includes(u)) : [];
}

/** Everything a player can train at a building now. */
export function trainsAt(p: Player, at: BuildingType): UnitType[] {
  const hires = hiresAt(p, at);
  return hires.length ? [...BUILDINGS[at].trains, ...hires] : BUILDINGS[at].trains;
}

export const isHire = (p: Player, at: BuildingType, unit: UnitType): boolean => hiresAt(p, at).includes(unit);

/** Why a player's age won't let them train a line at all (the Iron Age has no horses), or null. */
export function barred(p: Player, unit: UnitType): string | null {
  const no = ageDef(p).no;
  return no && no.units.includes(unit) ? no.why : null;
}

/** How many relics a player keeps in standing Temples. */
export function relicsKept(s: GameState, owner: number): number {
  let n = 0;
  for (const r of s.relics) {
    if (!r.temple) continue;
    const b = s.byId.get(r.temple);
    if (b && b.kind === 'building' && b.owner === owner && b.hp > 0) n++;
  }
  return n;
}

/** What a player's age multiplies each trade trip by for the relics it keeps (the Age of Fairs, #49); 1 elsewhere. */
export function relicTradeShare(s: GameState, owner: number): number {
  const rt = ageDef(s.players[owner]).relicTrade;
  return rt ? 1 + rt.each * Math.min(rt.most, relicsKept(s, owner)) : 1;
}

/** What a player's age multiplies each trade trip by for the bog iron its people have dug (Merchants, Fairs, Sail); 1 elsewhere. */
export function ironTradeShare(s: GameState, owner: number): number {
  const it = ageDef(s.players[owner]).ironTrade;
  return it ? 1 + it.each * Math.min(it.most, Math.floor((s.players[owner].stats.iron ?? 0) / it.per)) : 1;
}

/** A road into a side age, as against the trunk's own roads and the roads back onto it. */
export const isSideRoad = (r: Road): boolean => !TRUNK.includes(r.to);

/**
 * Side roads the player knows of but can't take from where they stand (#47): each opens only from
 * its own age, its window. The HUD shows them shut, with the way back to them.
 */
export function shutRoads(s: GameState, p: Player): Road[] {
  const here = ageOf(p);
  // An age with several ways in (the Age of Fairs, #49) shows once, by the first road the player knows;
  // and not at all while one of its roads is open from here.
  const open = new Set(roadsFrom(p).map((r) => r.to));
  const seen = new Set<AgeId>();
  return ROADS.filter((r) => {
    if (!isSideRoad(r) || r.from === here || r.to === here || open.has(r.to) || seen.has(r.to)) return false;
    if (AGES[r.from].tier > p.epoch || !roadKnown(s, p, r)) return false;
    seen.add(r.to);
    return true;
  });
}

/** Every age a shut road's destination can be reached from: its windows (#47, #49). */
export const windowsOf = (to: AgeId): AgeId[] => ROADS.filter((r) => r.to === to).map((r) => r.from);

/** The age a step back lands in (#47): the trunk age one tier down, whatever road led here. */
export function backTo(p: Player): AgeId | undefined {
  return p.epoch > 0 ? TRUNK[Math.min(p.epoch, TRUNK.length) - 1] : undefined;
}

/** Whole seconds until the player may step back again; 0 when they may. */
export function backWait(s: GameState, p: Player): number {
  if (p.backAt === undefined) return 0;
  return Math.max(0, Math.ceil((p.backAt + secs(STEP_BACK.cooldown) - s.tick) / TICK_HZ));
}

/** What, besides its price, keeps a player from stepping back, or null. */
export function backProblem(s: GameState, p: Player): string | null {
  if (!backTo(p)) return 'There is no older age to return to';
  const wait = backWait(s, p);
  return wait > 0 ? `The people need ${wait}s more before stepping back again` : null;
}

/** Whether a step back has suspended this technology: kept, idle, and back when the people climbs. */
export const isSuspended = (p: Player, tech: TechId): boolean => !!p.suspended?.includes(tech);

export const suspendedTechs = (p: Player): TechId[] => p.suspended ?? [];

/** The technologies a step back down to a tier would suspend. */
export const suspendedBelow = (p: Player, tier: number): TechId[] => p.techs.filter((t) => TECHS[t].epoch > tier);

/** Where a Town Center's advance leads: along a road, or a step back. */
export interface Journey {
  to: AgeId;
  cost: Cost;
  time: number;
  back: boolean;
}

export function journeyOf(p: Player, b: Building): Journey | undefined {
  if (b.back) {
    const to = backTo(p);
    return to ? { to, cost: stepBackCost(p.epoch), time: STEP_BACK.time, back: true } : undefined;
  }
  const r = roadTo(p, b.advanceTo);
  return r && { to: r.to, cost: r.cost, time: r.time, back: false };
}
