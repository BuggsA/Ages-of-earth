import { BUILDINGS, CIVS, SIGNATURES, EPOCHS, NO_MODS, TECHS, buildingCost, buildingHp, unitStats, type Mods, type UnitStats } from './data';
import { ageDef, isHire } from './ages';
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

export function computeMods(p: Player): Mods {
  const m: Mods = { ...NO_MODS };
  const civ = CIVS[p.civ];
  apply(m, civ.add, civ.mul);
  for (const t of p.techs) apply(m, TECHS[t].add, TECHS[t].mul);
  const age = ageDef(p);
  apply(m, age.add, age.mul);
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
  }
  if (base.cls === 'cavalry' || (base.cls === 'hero' && base.mounted)) st.speed *= m.cavalrySpeed;
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
  if (base.cls === 'trader') st.speed *= m.traderSpeed;
  if (base.cls !== 'citizen' && base.cls !== 'priest' && base.cls !== 'trader' && type !== 'fisher') {
    st.time *= m.militaryTrain;
    if (base.cls === 'ranged') st.time *= m.rangedTrain;
  }
  c.units[type] = st;
  return st;
}

const LEVIED = new Set(['infantry', 'ranged', 'cavalry']);

/**
 * What training a unit at a building costs a player now: its usual price, all in gold when their
 * age hires it there, or dearer where their age makes levies cost more (#37).
 */
export function trainCostFor(s: GameState, owner: number, type: UnitType, at: BuildingType): Cost {
  const p = s.players[owner];
  const base = unitStats(type, p.epoch).cost;
  const age = ageDef(p);
  if (age.hire && isHire(p, at, type)) {
    let sum = 0;
    for (const r of RES) sum += base[r] ?? 0;
    return { gold: Math.round((sum * age.hire.gold) / 5) * 5 };
  }
  if (age.levy && LEVIED.has(unitStats(type, p.epoch).cls)) return scale(base, age.levy);
  return base;
}

/** Seconds to train a unit at a building (hired soldiers come faster). */
export function trainTimeFor(s: GameState, owner: number, type: UnitType, at: BuildingType): number {
  const p = s.players[owner];
  const t = statsFor(s, owner, type).time;
  const hire = ageDef(p).hire;
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
  if (t.epoch > p.epoch) return `Needs the ${EPOCHS[t.epoch].name}`;
  if (t.needs && !p.techs.includes(t.needs)) return `Needs ${TECHS[t.needs].name} first`;
  for (const e of s.ents) if (e.kind === 'building' && e.owner === owner && e.queue.some((q) => q.tech === tech)) return 'Already being researched';
  return null;
}

/** Seconds a building takes to go up for one citizen (some civilizations build faster). */
export function buildTimeFor(s: GameState, owner: number, type: BuildingType): number {
  return BUILDINGS[type].time / modsOf(s, owner).buildSpeed;
}
