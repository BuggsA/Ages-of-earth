import { AGES, BUILDINGS, CIVS, WAYS, WORKS, SIGNATURES, EPOCHS, FLOOD, NO_MODS, PATHS, RARE, TECHS, WARCAMP, buildingCost, buildingHp, unitStats, type Mods, type UnitStats } from './data';
import { fairLevy } from './fair';
import { flooded } from './flood';
import { ageDef, ageOf, hasWalked, isHire, isSuspended, pathCarry } from './ages';
import type { BuildingType, Cost, GameState, Player, TechId, UnitType } from './types';
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
  if (age.forge) m.infantryAttack += age.forge.attack * ironSteps(p, age.forge);
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
export function trainCostFor(s: GameState, owner: number, type: UnitType, at: BuildingType, where?: { x: number; y: number }): Cost {
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
  const price = age.price?.[cls];
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

export function buildingMaxHp(s: GameState, owner: number, type: BuildingType): number {
  const p = s.players[owner];
  return Math.round(buildingHp(type, p.epoch) * cacheOf(p).mods.buildingHp);
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

