import { AGES, BUILDINGS, CIVS, GUNS, GROVE, HIVE, TOWER_LEVELS, WAYS, WORKS, SIGNATURES, EPOCHS, FLOOD, NO_MODS, PATHS, RARE, TECHS, WARCAMP, buildingCost, buildingHp, unitStats, type Mods, type UnitStats } from './data';
import { fairLevy } from './fair';
import { flooded } from './flood';
import { ageDef, ageOf, hasWalked, isHire, isSuspended, pathCarry, threadsOf } from './ages';
import type { AgeId, Building, BuildingType, Cost, GameState, Player, TechId, UnitType } from './types';
import { RES } from './types';

/**
 * What a player's units and buildings are really like: the epoch's base numbers, changed by the
 * player's civilization and the technologies they have researched. Worked out once and kept until
 * the epoch or the technologies change.
 */

interface Cache {
  version: number;
  epoch: number;
  mods: Mods;
  units: Partial<Record<UnitType, UnitStats>>;
}

const caches = new WeakMap<Player, Cache>();

function cacheOf(p: Player): Cache {
  let c = caches.get(p);
  if (!c || c.version !== p.statsVersion || c.epoch !== p.epoch) {
    c = { version: p.statsVersion, epoch: p.epoch, mods: computeMods(p), units: {} };
    caches.set(p, c);
  }
  return c;
}

function apply(m: Mods, add?: Partial<Mods>, mul?: Partial<Mods>): void {
  if (add) for (const k of Object.keys(add) as (keyof Mods)[]) m[k] += add[k]!;
  if (mul) for (const k of Object.keys(mul) as (keyof Mods)[]) m[k] *= mul[k]!;
}

/** How many forge steps a player's bog iron dug has reached. */
export const ironSteps = (p: Player, f: { base: number; per: number; most: number }): number => Math.min(f.most, Math.max(0, Math.floor(((p.stats.iron ?? 0) - f.base) / f.per)));

export function computeMods(p: Player): Mods {
  const m: Mods = { ...NO_MODS };
  const civ = CIVS[p.civ];
  apply(m, civ.add, civ.mul);
  if (p.way) {
    apply(m, WAYS[p.way].add, WAYS[p.way].mul);
    if (p.deep) apply(m, WAYS[p.way].deep.add, WAYS[p.way].deep.mul);
  }
  const age = ageDef(p);
  for (const t of p.techs) if (!TECHS[t].only || TECHS[t].only === ageOf(p)) apply(m, TECHS[t].add, TECHS[t].mul);
  apply(m, age.add, age.mul);
  // A Golden Age (#703) carries every thread's forge: the Iron Age's spearmen and the Chariots' riders both.
  for (const f of age.golden ? threadsOf(p).map((a) => AGES[a].forge).filter((x) => !!x) : age.forge ? [age.forge] : []) m[f!.riders ? 'cavalryAttack' : 'infantryAttack'] += f!.attack * ironSteps(p, f!);
  const carry = pathCarry(p);
  if (carry) for (let i = 0; i < carry.times; i++) apply(m, PATHS[carry.path].carry);
  if (p.workEnd !== undefined) apply(m, WORKS[p.civ].add, WORKS[p.civ].mul);
  return m;
}

export function modsOf(s: GameState, owner: number): Mods {
  return cacheOf(s.players[owner]).mods;
}

/** A unit line's numbers for a player now. */
export function statsFor(s: GameState, owner: number, type: UnitType): UnitStats {
  const p = s.players[owner];
  const c = cacheOf(p);
  let st = c.units[type];
  if (st) return st;
  const base = unitStats(type, p.epoch);
  const m = c.mods;
  st = { ...base };
  const sig = SIGNATURES[p.civ];
  if (sig.type === type && base.cls !== 'citizen') {
    st.name = sig.names[Math.min(p.epoch, sig.names.length - 1)];
    st.blurb = `${base.blurb} ${sig.blurb}`;
    for (const k of Object.keys(sig.add ?? {}) as (keyof NonNullable<typeof sig.add>)[]) st[k] += sig.add![k]!;
    for (const k of Object.keys(sig.mul ?? {}) as (keyof NonNullable<typeof sig.mul>)[]) st[k] = k === 'hp' ? Math.round(st[k] * sig.mul![k]!) : st[k] * sig.mul![k]!;
  }
  const rename = ageDef(p).names?.[type];
  if (rename && base.cls !== 'citizen') st.name = rename;
  // Dire Wolves (the Age of the Hive, `HIVE.dire`): a people that has walked the Hive breeds its wolves bigger, in any age after.
  if (type === 'warwolf' && hasWalked(p, 'hive')) {
    st.name = 'Dire Wolf';
    st.hp = Math.round(st.hp * HIVE.dire.hp);
    st.attack += HIVE.dire.attack;
  }
  const soldier = base.cls === 'infantry' || base.cls === 'cavalry' || base.cls === 'ranged' || base.cls === 'hero';
  if (base.cls === 'infantry' || base.cls === 'cavalry' || base.cls === 'hero') st.attack += m.meleeAttack;
  if (base.cls === 'ranged') {
    st.attack += m.rangedAttack;
    st.range += m.range;
    st.sight = Math.max(st.sight, st.range + 1);
  }
  if (soldier) {
    st.armor += m.armor;
    st.parmor += m.parmor;
  }
  if (base.cls === 'infantry') {
    st.hp = Math.round(st.hp * m.infantryHp);
    st.armor += m.infantryArmor;
    st.attack += m.infantryAttack;
  }
  if (base.cls === 'cavalry') st.attack += m.cavalryAttack;
  if (base.cls === 'cavalry' || (base.cls === 'hero' && base.mounted)) {
    st.speed *= m.cavalrySpeed;
    st.sight += m.riderSight;
  }
  if (base.cls === 'citizen') st.speed *= m.citizenSpeed;
  if (base.cls === 'siege') {
    st.attack *= m.siegeAttack;
    if (st.range > 0) st.range += m.siegeRange;
  }
  if (base.cls === 'ship') {
    st.hp = Math.round(st.hp * m.shipHp);
    if (st.range > 0) {
      st.range += m.shipRange;
      st.sight = Math.max(st.sight, st.range + 1);
    }
  }
  if (base.cls === 'fighter' || base.cls === 'bomber') {
    st.speed *= m.airSpeed;
    st.hp = Math.round(st.hp * m.airHp);
  }
  if (base.cls === 'trader' && type !== 'wagon') st.speed *= m.traderSpeed;
  if (base.cls !== 'citizen' && base.cls !== 'priest' && base.cls !== 'trader' && type !== 'fisher') {
    st.time *= m.militaryTrain;
    if (base.cls === 'ranged') st.time *= m.rangedTrain;
  }
  st.time *= ageDef(p).training?.[base.cls] ?? 1;
  c.units[type] = st;
  return st;
}

const LEVIED = new Set(['infantry', 'ranged', 'cavalry']);

/**
 * What training a unit at a building costs a player now: its usual price, all in gold when their
 * age hires it there, dearer where their age makes levies cost more (#37), and scaled by what their
 * age charges for its class (the Iron Age's cheap foot soldiers, #39).
 */
export function trainCostFor(s: GameState, owner: number, type: UnitType, at: BuildingType, where?: { x: number; y: number; keep?: AgeId }): Cost {
  const p = s.players[owner];
  const base = unitStats(type, p.epoch).cost;
  const age = ageDef(p);
  if (age.hire && isHire(p, at, type)) {
    let sum = 0;
    for (const r of RES) sum += base[r] ?? 0;
    return scale({ gold: Math.round((sum * age.hire.gold) / 5) * 5 }, fairLevy(s, owner, type, where));
  }
  const cls = unitStats(type, p.epoch).cls;
  const levied = age.levy && LEVIED.has(cls) ? scale(base, age.levy) : base;
  // A Dock kept as the Sea-Raiders' keepsake (#555 s12) still launches ships at the longship yard's price, on any road.
  const price = age.price?.[cls] ?? (at === 'dock' && where?.keep === 'searaider' ? AGES.searaider.price?.[cls] : at === 'bloomery' && where?.keep === 'iron' ? AGES.iron.price?.[cls] : undefined);
  const priced = price ? scale(levied, price) : levied;
  return scale(priced, fairLevy(s, owner, type, where));
}

/** Seconds to train a unit at a building (hired soldiers come faster). */
export function trainTimeFor(s: GameState, owner: number, type: UnitType, at: BuildingType): number {
  const p = s.players[owner];
  const t = statsFor(s, owner, type).time;
  const hire = ageDef(p).hire;
  // A War Camp's tents train slower than a Barracks' drill yard (#303).
  if (at === 'warcamp') return t * WARCAMP.train;
  return hire && isHire(p, at, type) ? t * hire.time : t;
}

/** What a Watch Tower's steps on the tower line add up to, at `level` (0 for a plain tower or any other building). */
export function towerBonus(level = 0): { attack: number; range: number; hp: number } {
  const out = { attack: 0, range: 0, hp: 1 };
  for (let i = 0; i < Math.min(level, TOWER_LEVELS.length); i++) {
    out.attack += TOWER_LEVELS[i].attack;
    out.range += TOWER_LEVELS[i].range;
    out.hp *= TOWER_LEVELS[i].hp;
  }
  return out;
}

/** A building's full hit points for its owner now; a Watch Tower's `level` on the tower line raises them. */
export function buildingMaxHp(s: GameState, owner: number, type: BuildingType, level = 0): number {
  const p = s.players[owner];
  // A Thornwall (the Age of the Grove) is as strong as the stage it has grown to.
  const grown = type === 'thornwall' ? GROVE.hp[Math.min(3, level)] : 1;
  return Math.round(buildingHp(type, p.epoch) * cacheOf(p).mods.buildingHp * (type === 'tower' ? towerBonus(level).hp : 1) * grown);
}

/** The strength of one arrow from a building's guns (before armour), for its owner now; 0 if it has none. */
export function gunPower(s: GameState, owner: number, type: BuildingType, level = 0): number {
  const g = BUILDINGS[type].guns;
  if (!g) return 0;
  const p = s.players[owner];
  const m = cacheOf(p).mods;
  const tower = type === 'tower';
  return (g.damage + m.rangedAttack + (tower ? towerBonus(level).attack : 0)) * (1 + p.epoch * (tower ? GUNS.towerEpoch : GUNS.epoch));
}

/** How far a building's guns shoot for its owner now, from its edge (add half its size for its centre); 0 if it has none. */
export function gunRange(s: GameState, owner: number, type: BuildingType, level = 0): number {
  const g = BUILDINGS[type].guns;
  if (!g) return 0;
  return g.range + cacheOf(s.players[owner]).mods.range + (type === 'tower' ? towerBonus(level).range : 0);
}

/** Why this Watch Tower can't be raised its next step on the tower line now, or null if it can (cost aside). */
export function raiseProblem(s: GameState, owner: number, b: Building): string | null {
  if (b.type !== 'tower' || b.owner !== owner) return 'Only a Watch Tower can be raised';
  if (!b.built) return 'Finish building it first';
  const next = TOWER_LEVELS[b.level ?? 0];
  if (!next) return 'Raised as high as a tower goes';
  if (b.queue.some((q) => q.rise)) return 'Already being raised';
  if (s.players[owner].epoch < next.epoch) return `Needs the ${EPOCHS[next.epoch].name}`;
  return null;
}

/** What a building costs a player now (walls change with the epoch; some civilizations pay less for wonders). */
export function buildingCostFor(s: GameState, owner: number, type: BuildingType): Cost {
  const p = s.players[owner];
  const base = buildingCost(type, p.epoch);
  if (type !== 'wonder') return base;
  return scale(base, cacheOf(p).mods.wonderCost);
}

export function techCostFor(s: GameState, owner: number, tech: TechId): Cost {
  return scale(TECHS[tech].cost, modsOf(s, owner).techCost);
}

function scale(c: Cost, k: number): Cost {
  if (k === 1) return c;
  const out: Cost = {};
  for (const r of RES) if (c[r]) out[r] = Math.round(c[r]! * k);
  return out;
}

/** Whether a tech can be researched by a player now, and if not, why. */
export function techProblem(s: GameState, owner: number, tech: TechId): string | null {
  const p = s.players[owner];
  const t = TECHS[tech];
  if (p.techs.includes(tech)) return 'Already researched';
  if (isSuspended(p, tech)) return `Researched, but suspended until the ${EPOCHS[t.epoch].name}`;
  // Survey the Land is granted by a finished Prospector's Lodge, never researched (#562, #563).
  if (t.legacy) return "Learned when a Prospector's Lodge is raised";
  if (t.epoch > p.epoch) return `Needs the ${EPOCHS[t.epoch].name}`;
  if (t.only && ageOf(p) !== t.only) return `Only in the ${AGES[t.only].name}`;
  if (t.walked) {
    const missing = t.walked.filter((a) => !hasWalked(p, a));
    if (missing.length) return `An heirloom: walk the ${missing.map((a) => AGES[a].name).join(' and the ')} first`;
  }
  if (t.needs && !p.techs.includes(t.needs)) return `Needs ${TECHS[t.needs].name} first`;
  if (t.ore) {
    if (!s.rares?.includes(t.ore.id)) return `There is no ${RARE[t.ore.id].name.toLowerCase()} in this world`;
    const have = Math.floor(p.stats.mined?.[t.ore.id] ?? 0);
    if (have < t.ore.n) return `Mine ${t.ore.n} ${RARE[t.ore.id].name.toLowerCase()} first (${have}/${t.ore.n})`;
  }
  for (const e of s.ents) if (e.kind === 'building' && e.owner === owner && e.queue.some((q) => q.tech === tech)) return 'Already being researched';
  return null;
}

/** Seconds a building takes to go up for one citizen (some civilizations build faster, and the Nile flood's corvée faster still). */
export function buildTimeFor(s: GameState, owner: number, type: BuildingType): number {
  return BUILDINGS[type].time / modsOf(s, owner).buildSpeed / (flooded(s, owner) ? FLOOD.build : 1);
}

