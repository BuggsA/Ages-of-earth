import { AGES, BUILDINGS, CIVS, LIGHTNING, PATHS, ROADS, STEP_BACK, TECHS, TICK_HZ, TRUNK, WAYS, secs, stepBackCost, type Age, type Deed, type Road } from './data';
import { KEYS, R_BLOODIRON, R_BOG, R_SALT, R_SALTPETRE, type AgeId, type CivId, type PathId, type RareId, type Building, type BuildingType, type Cost, type GameState, type KeyId, type Player, type TechId, type UnitType } from './types';

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
 * Whether the people knows what a Prospector's Lodge finds (#562): it raised one (a finished lodge marks Survey the
 * Land as known), or, in an older save or replay, surveyed at a Storehouse.
 */
export const prospected = (p: Player): boolean => p.techs.includes('survey');

/** Whether this world holds a key resource (#562): bog iron and the rare ores by the seed, ruins wherever any were placed. */
export function holds(s: GameState, k: KeyId): boolean {
  if (k === 'bogIron') return s.bogIron === true;
  if (k === 'ruin') return !!s.ruins?.length;
  return !!s.rares?.includes(k);
}

/**
 * A Prospector's Lodge stands finished (#562): its people learns what this world holds, once (a second lodge adds
 * nothing until levels 2 and 3 come). Kept as Survey the Land among its technologies, so saves and the iron road read it.
 */
export function prospect(s: GameState, owner: number): void {
  const p = s.players[owner];
  if (prospected(p)) return;
  p.techs.push('survey');
  p.statsVersion++;
  s.events.push({ k: 'prospect', owner, finds: findsOf(s) });
}

/** The key resource a tile holds (#565), or null: bog iron and the rare ores. Ruins aren't tiles; the chart reads `s.ruins`. */
export function keyAt(s: GameState, tile: number): KeyId | null {
  const r = s.res[tile];
  return r === R_BOG ? 'bogIron' : r === R_SALT ? 'salt' : r === R_SALTPETRE ? 'saltpetre' : r === R_BLOODIRON ? 'bloodiron' : null;
}

/** Whether the people has charted the land (#565): Chart the Veins learned at its Prospector's Lodge. */
export const charted = (p: Player): boolean => !!p.chart;

/**
 * Chart the Veins is learned (#565): the people keeps a picture of every key-resource tile in the world as it is now,
 * in tile order. Kept if the lodge falls or the people steps back: what was drawn stays drawn.
 */
export function chartLand(s: GameState, p: Player): void {
  const out: { tile: number; key: KeyId }[] = [];
  for (let i = 0; i < s.res.length; i++) {
    const key = keyAt(s, i);
    if (key) out.push({ tile: i, key });
  }
  p.chart = out;
}

/** Whether the people has assayed the holdings (#568): Assay the Holdings learned at its Prospector's Lodge. */
export const assayed = (p: Player): boolean => p.techs.includes('assay');

/**
 * Who digs each key-resource tile now (#568): tile to the people of the first living citizen (in id order) working
 * it or walking to it. Live, unlike the chart: this is what the third level shows.
 */
export function diggersAt(s: GameState): Map<number, number> {
  const out = new Map<number, number>();
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.order.k !== 'gather' || out.has(e.order.tile) || !keyAt(s, e.order.tile)) continue;
    out.set(e.order.tile, e.owner);
  }
  return out;
}

/** What a people holds of each key resource (#568): its stock of each rare ore, and the bog iron it has dug (paid in as gold). */
export function holdingsOf(p: Player): Record<Exclude<KeyId, 'ruin'>, number> {
  return { bogIron: Math.floor(p.stats.iron ?? 0), salt: Math.floor(p.rare?.salt ?? 0), saltpetre: Math.floor(p.rare?.saltpetre ?? 0), bloodiron: Math.floor(p.rare?.bloodiron ?? 0) };
}

/** The key resources this world holds, in the lodge's order: what a lodge reports when it is raised. */
export const findsOf = (s: GameState): KeyId[] => KEYS.filter((k) => holds(s, k));

/**
 * The key resource a road wants, and the kind of door it is (spine §3): `only` when nothing else opens the road (a
 * survey's find, a ruin), else a shortcut past its deeds (an ore door). Null for a road that wants none.
 */
export function keyOf(r: Road): { key: KeyId; only: boolean } | null {
  if (r.found && TECHS[r.found].survey) return { key: TECHS[r.found].survey!, only: true };
  if (r.ruin) return { key: 'ruin', only: true };
  if (r.vein) return { key: r.vein.id, only: true };
  if (r.ore) return { key: r.ore.id, only: false };
  return null;
}

/** What a key resource opens: ages it is the only road to, ages it is a shortcut to, and technologies that need it. */
export function opensOf(k: KeyId): { only: AgeId[]; shortcut: AgeId[]; techs: TechId[] } {
  const only: AgeId[] = [];
  const shortcut: AgeId[] = [];
  for (const r of ROADS) {
    const door = keyOf(r);
    if (door?.key !== k) continue;
    const list = door.only ? only : shortcut;
    if (!list.includes(r.to)) list.push(r.to);
  }
  const techs = (Object.keys(TECHS) as TechId[]).filter((t) => TECHS[t].ore?.id === k);
  return { only, shortcut, techs };
}

/**
 * The key resources this world lacks that a road into `age` wants (#562), once the people has prospected (before, it
 * doesn't know): `only` when that shuts the road, else the shortcut is gone and the deeds remain.
 */
export function lacking(s: GameState, p: Player, age: AgeId): { key: KeyId; only: boolean }[] {
  if (!prospected(p)) return [];
  const out: { key: KeyId; only: boolean }[] = [];
  for (const r of ROADS) {
    if (r.to !== age) continue;
    const door = keyOf(r);
    if (door && !holds(s, door.key) && !out.some((d) => d.key === door.key)) out.push(door);
  }
  return out;
}

/**
 * Whether the player has a reason to know the road is there: its clue stands in their town, and its
 * survey has been made and found what the road needs. A survey that finds nothing hides it for good.
 */
export function roadKnown(s: GameState, p: Player, r: Road): boolean {
  if (r.walked && !hasWalked(p, r.walked)) return false;
  if (r.vein && !veinSeen(s, p, r)) return false;
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

/** Whether the people has mined enough of the ore a road's ore door asks for (#356 s3). Only a world that holds the ore lets anyone. */
export const oreDone = (p: Player, r: Road): boolean => !!r.ore && (p.stats.mined?.[r.ore.id] ?? 0) >= r.ore.n;

/**
 * A vein door (#577): the world holds the ore, and the people has learned it (a Prospector's Lodge stands, or it has dug some).
 * Where the world holds none, the road is never seen.
 */
export const veinSeen = (s: GameState, p: Player, r: Road): boolean =>
  !!r.vein && !!s.rares?.includes(r.vein.id) && (prospected(p) || (p.stats.mined?.[r.vein.id] ?? 0) > 0);

/** Whether a vein door is open (#577): enough of its ore mined. True for a road with none. */
export const veinDone = (p: Player, r: Road): boolean => !r.vein || (p.stats.mined?.[r.vein.id] ?? 0) >= r.vein.n;

/** Whether a trading post sells this rare ore (#573): only in a world that lacks it. */
export const soldAt = (s: GameState, ore: RareId): boolean => s.posts.some((t) => !!t.sells?.includes(ore));

/** The ore door a player may see: the ore is in this world and they have mined some (the clue comes by digging, not a checklist). */
export function oreClue(s: GameState, p: Player, r: Road): Road['ore'] | null {
  return r.ore && s.rares?.includes(r.ore.id) && (p.stats.mined?.[r.ore.id] ?? 0) > 0 ? r.ore : null;
}

/**
 * Whether the ore is the only door: the road carries an ore and this world holds it (#356). Where the seed has
 * none, the deeds stay the road; where it has, the deeds alone no longer open it.
 */
export const oreOnly = (s: GameState, r: Road): boolean => !!r.ore && !!s.rares?.includes(r.ore.id);

/**
 * Whether every deed a road asks for is done, or its ore door has been opened. Pass the state to let an ore the
 * world holds be the only door (the player's rules and the computer do); without it the deeds also open the road.
 */
export const deedsDone = (p: Player, r: Road, s?: GameState): boolean => veinDone(p, r) && (oreDone(p, r) || ((!s || !oreOnly(s, r)) && deedsProgress(p, r).every((d) => d.have >= d.need)));

/** What, besides its price, keeps a player off a road, or null. */
export function roadProblem(s: GameState, p: Player, r: Road): string | null {
  if (!roadKnown(s, p, r)) {
    if (r.walked && !hasWalked(p, r.walked)) return `Only a people that walked the ${AGES[r.walked].name} finds this road`;
    if (r.ruin) return 'Your citizens must finish excavating an ancient ruin';
    if (r.found && !p.techs.includes(r.found)) return `Needs ${TECHS[r.found].name}`;
    if (r.found && !surveyFinds(s, r.found)) return 'There is none in this world';
    if (r.vein && !s.rares?.includes(r.vein.id)) return `There is no ${r.vein.id} in this world`;
    if (r.vein && !veinSeen(s, p, r)) return `Raise a Prospector's Lodge, or dig ${r.vein.id}, to learn of this road`;
    return `Needs a ${BUILDINGS[r.clue!].name}`;
  }
  if (r.shuns && hasWalked(p, r.shuns)) return `Your people took the ${AGES[r.shuns].name}: this road is closed to it for good`;
  if (!veinDone(p, r)) return `${r.vein!.text} (${Math.floor(p.stats.mined?.[r.vein!.id] ?? 0)}/${r.vein!.n})`;
  if (oreDone(p, r)) return null;
  if (oreOnly(s, r)) {
    const door = oreClue(s, p, r);
    return door
      ? `${door.text} (${Math.floor(p.stats.mined?.[door.id] ?? 0)}/${door.n})`
      : 'The ground here holds what this road wants: send citizens digging, and look for veins';
  }
  const left = deedsProgress(p, r).filter((d) => d.have < d.need);
  const door = oreClue(s, p, r);
  return left.length ? left.map((d) => `${d.deed.text} (${d.have}/${d.need})`).join('; ') + (door ? `; or ${door.text.charAt(0).toLowerCase()}${door.text.slice(1)} (${Math.floor(p.stats.mined?.[door.id] ?? 0)}/${door.n})` : '') : null;
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

/** Why a player's age or people won't let them train a line (the Iron Age has no horses), at a building if given, or null. */
export function barred(p: Player, unit: UnitType, at?: BuildingType): string | null {
  // The polis (#501): a Greek city trains no foot soldiers; its citizens take up arms. It may still hire foreign foot for gold.
  if (unit === 'infantry' && CIVS[p.civ].polis && !(at && isHire(p, at, unit))) return 'A Greek city trains no foot soldiers: select citizens and take up arms (H)';
  const no = ageDef(p).no;
  return no && no.units.includes(unit) ? no.why : null;
}

/**
 * Why a player's age won't let them raise a building at all, or null: the age bars it (the steppe tills no
 * fields, #297), or the building belongs to other ages (the War Camp, only on its step of the path, #303), or the
 * people's Way shuts it (#463 s1: the Hearth keeps no Hunting Camps; the Hunters' fields wait on the herd, `wayBarred`).
 */
export function buildBarred(p: Player, type: BuildingType): string | null {
  const no = ageDef(p).noBuild;
  if (no && no.buildings.includes(type)) return no.why;
  // Born on the move (#501): a Mongol camp never tills a field, in any age.
  if (type === 'farm' && CIVS[p.civ].nomad) return 'A Mongol camp tills no fields: its food walks with the flock';
  const way = p.way ? WAYS[p.way] : undefined;
  if (way?.shuts?.includes(type)) return `${way.name} raises no ${BUILDINGS[type].name}`;
  const only = BUILDINGS[type].ages;
  return !only || only.includes(ageOf(p)) ? null : `Only in the ${only.map((a) => AGES[a].name).join(' or ')}`;
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

/**
 * The roads on from an age (#555 s4, the age panel's "Leads to"): every road out of it to a later tier, or a turn into a
 * side age at the same tier, in `ROADS` order. Roads back (to an earlier tier, or home to the trunk) are not where it leads.
 */
export const leadsOn = (from: AgeId): Road[] => ROADS.filter((r) => r.from === from && (AGES[r.to].tier > AGES[from].tier || (AGES[r.to].tier === AGES[from].tier && isSideRoad(r))));

/**
 * Where an age leads, as this player may know it: the roads on from it that they know of from here or have walked, so
 * the panel tells no more than the Town Center's buttons would.
 */
export function leadsTo(s: GameState, p: Player, from: AgeId): AgeId[] {
  const out: AgeId[] = [];
  for (const r of leadsOn(from)) if (!out.includes(r.to) && (hasWalked(p, r.to) || roadKnown(s, p, r))) out.push(r.to);
  return out;
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

/** Whether the player's age broadcasts power from coils (the Age of Lightning, #231). */
export const hasCoils = (p: Player): boolean => !!ageDef(p).coils;

/** Whether a building stands in the field of one of its owner's finished, standing Watch (Coil) Towers. */
export function inField(s: GameState, b: { x: number; y: number; owner: number }): boolean {
  const r2 = LIGHTNING.reach * LIGHTNING.reach;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'tower' || e.owner !== b.owner || !e.built || e.hp <= 0) continue;
    const dx = e.x - b.x, dy = e.y - b.y;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

/**
 * How fast a building trains and researches, in hundredths: 100 in every age but Lightning, where a building
 * in a coil's field works at `LIGHTNING.lit` and one outside every field at `LIGHTNING.dark`.
 */
export function workRate(s: GameState, b: Building): number {
  if (!hasCoils(s.players[b.owner])) return 100;
  return inField(s, b) ? LIGHTNING.lit : LIGHTNING.dark;
}

/**
 * Whole steps of work a building makes this tick at its rate, carrying what is left over in `b.spark`
 * (integer hundredths, so every machine agrees). At 100 it is always one step and `spark` is never touched.
 */
export function workSteps(s: GameState, b: Building): number {
  const rate = workRate(s, b);
  if (rate === 100 && !b.spark) return 1;
  const sum = (b.spark ?? 0) + rate;
  const n = Math.floor(sum / 100);
  b.spark = sum - n * 100;
  if (rate === 100 && b.spark === 0) delete b.spark;
  return n;
}

/** The path (#299) an age is a step of, if any. */
export const pathOf = (age: AgeId): PathId | undefined => AGES[age].path;

/** A path's ages, built so far, from its lowest tier up. */
export const pathAges = (path: PathId): AgeId[] =>
  (Object.keys(AGES) as AgeId[]).filter((a) => AGES[a].path === path).sort((a, b) => AGES[a].tier - AGES[b].tier);

/** A path's whole line (#355 s2): for a branch, the ages of the path it left come first, then its own. */
export function pathLine(path: PathId): AgeId[] {
  const from = PATHS[path].branch;
  return from ? [...pathLine(from), ...pathAges(path)] : pathAges(path);
}

/** How many of its path's ages (a branch's whole line) a people standing on a path has walked, the one it stands in counted; 0 off every path. */
export function pathDepth(p: Player): number {
  const path = pathOf(ageOf(p));
  return path ? pathLine(path).filter((a) => hasWalked(p, a)).length : 0;
}

/** Roads out of the player's age that carry on along its path: the way deeper. */
export function pathRoads(p: Player): Road[] {
  const path = pathOf(ageOf(p));
  return path ? roadsFrom(p).filter((r) => AGES[r.to].path === path) : [];
}

/** What a path adds for the ages of it already walked: `carry`, once for each earlier one (#299). */
export function pathCarry(p: Player): { path: PathId; times: number } | null {
  const path = pathOf(ageOf(p));
  const times = pathDepth(p) - 1;
  return path && PATHS[path].carry && times > 0 ? { path, times } : null;
}

/** Whether a unit may raise this building: citizens raise them all, some buildings name others (#303), and a legion's foot soldiers raise any (#501). */
export const canRaise = (unit: UnitType, type: BuildingType, civ?: CivId): boolean =>
  unit === 'citizen' || !!BUILDINGS[type].builders?.includes(unit) || (unit === 'infantry' && !!civ && !!CIVS[civ].legion);
