import { EPOCHS, FIRE, TICK_HZ, domainOf, secs } from './data';
import { roll } from './animals';
import { hurt, peace } from './combat';
import { clearResource, distToRect, distToTile } from './grid';
import { seasonAt } from './seasons';
import { isEnemy, maxHp } from './world';
import { fireMul } from './wildwood';
import type { Building, Fire, GameState, Unit } from './types';
import { R_TREE } from './types';

/**
 * Fire (`docs/wild-road.md`, the Wild route's step 3): the answer to a living town, and a tool for every people from the Bronze Age.
 * Citizens and foot soldiers carry torches to a tree, a Thornwall's root, or a rival's living building (`FIRE.burns`: Thornwalls,
 * Kitchen Gardens, Orchards, Saplings, Hives, Heart Trees) and stand a moment to set it alight. A burning tree falls to ash that grows back slowly (a
 * `Stool` with `ash`); a burning building loses hit points every second until it falls (a Thornwall burnt down leaves no root) or its
 * own people beat it out. Once a second every fire may light each living neighbour, on a roll of the match's own dice (`roll`),
 * further in a dry summer than a wet spring, but never more than `FIRE.run` tiles from the torch. Fires act in the order they were
 * lit and their neighbours in a fixed order, so every machine burns the same wood. The numbers are `FIRE`.
 */

/** A unit that may carry a torch: a citizen or a foot soldier. */
export const carriesTorch = (u: Unit): boolean => u.type === 'citizen' || u.type === 'infantry';

/** Whether fire takes this kind of building: only what grows. */
export const burns = (b: Building): boolean => FIRE.burns.includes(b.type);

/** The fire on a building, if it burns. */
export const fireOn = (s: GameState, b: Building): Fire | undefined => s.fires?.find((f) => f.b === b.id);
export const onFire = (s: GameState, b: Building): boolean => !!fireOn(s, b);

/** Whether a tree burns on this tile. */
const treeBurning = (s: GameState, tile: number): boolean => !!s.fires?.some((f) => f.b === undefined && f.tile === tile);

/** Where a Thornwall's root waits on this tile, or -1. */
const rootAt = (s: GameState, tile: number): number => s.roots?.findIndex((r) => r.tile === tile) ?? -1;

/** The building standing on a tile, if any. */
function buildingAt(s: GameState, tile: number): Building | null {
  const id = s.bldAt[tile];
  const e = id ? s.byId.get(id) : undefined;
  return e && e.kind === 'building' && e.hp > 0 ? e : null;
}

/** Whether a tile holds something fire can take now: a tree, a living building, or a root, not already burning. */
function catchable(s: GameState, tile: number): boolean {
  if (s.res[tile] === R_TREE) return !treeBurning(s, tile);
  const b = buildingAt(s, tile);
  if (b) return burns(b) && !onFire(s, b);
  return rootAt(s, tile) >= 0;
}

/** Why a people can't set this alight (a building by id, or a tree or root by tile), or null. */
export function torchProblem(s: GameState, owner: number, at: { target?: number; tile?: number }): string | null {
  const p = s.players[owner];
  if (p.epoch < FIRE.epoch) return `Torches are carried from the ${EPOCHS[FIRE.epoch].name}`;
  if (peace(s)) return 'Not while the peace holds';
  const pick = "Pick a tree, a rival's Thornwall root, or a rival's living building";
  if (at.target !== undefined) {
    const b = s.byId.get(at.target);
    if (!b || b.kind !== 'building' || b.hp <= 0) return pick;
    if (!isEnemy(s, owner, b.owner)) return "Fire is set only to a rival's buildings";
    if (!burns(b)) return 'Fire takes only what grows: Thornwalls, Kitchen Gardens, Orchards, Saplings, Hives and Heart Trees';
    return onFire(s, b) ? 'It is already burning' : null;
  }
  const tile = at.tile ?? -1;
  if (tile < 0 || tile >= s.w * s.h) return pick;
  if (s.res[tile] === R_TREE) return treeBurning(s, tile) ? 'It is already burning' : null;
  const r = rootAt(s, tile);
  if (r >= 0 && isEnemy(s, owner, s.roots![r].owner)) return null;
  return pick;
}

/**
 * Set a tile alight: a tree burns, a living building burns, a root burns away at once. `gen` is how many tiles from the torch;
 * `by` who set the first flame. Returns whether anything caught.
 */
export function ignite(s: GameState, tile: number, gen: number, by: number, torch = false): boolean {
  if (!catchable(s, tile)) return false;
  const x = (tile % s.w) + 0.5;
  const y = Math.floor(tile / s.w) + 0.5;
  const lit = torch ? { torch: true } : {};
  if (s.res[tile] === R_TREE) {
    (s.fires ??= []).push({ tile, gen, by, end: s.tick + secs(FIRE.tree) });
    s.events.push({ k: 'fire', what: 'lit', x, y, by, tree: true, ...lit });
    return true;
  }
  const b = buildingAt(s, tile);
  if (b) {
    (s.fires ??= []).push({ tile: b.ty * s.w + b.tx, b: b.id, gen, by, out: 0 });
    s.events.push({ k: 'fire', what: 'lit', x: b.x, y: b.y, by, owner: b.owner, ...lit });
    return true;
  }
  const r = rootAt(s, tile);
  const owner = s.roots![r].owner;
  s.roots!.splice(r, 1);
  s.events.push({ k: 'fire', what: 'root', x, y, by, owner });
  return true;
}

/** The tiles a fire may leap to, in a fixed order: a tree's four neighbours, or the tiles along a building's sides. */
function around(s: GameState, f: Fire, b: Building | null): number[] {
  const x0 = b ? b.tx : f.tile % s.w;
  const y0 = b ? b.ty : Math.floor(f.tile / s.w);
  const n = b ? b.size : 1;
  const out: number[] = [];
  const add = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < s.w && y < s.h) out.push(y * s.w + x);
  };
  for (let i = 0; i < n; i++) add(x0 + i, y0 - 1);
  for (let i = 0; i < n; i++) add(x0 - 1, y0 + i);
  for (let i = 0; i < n; i++) add(x0 + n, y0 + i);
  for (let i = 0; i < n; i++) add(x0 + i, y0 + n);
  return out;
}

/**
 * Smoke (the Age of the Hive, `hive.ts`): whether any fire burns within `r` tiles of a building, a burning tree or a burning
 * building's edge counted alike. A Hive in the smoke goes quiet.
 */
export function smokeNear(s: GameState, b: Building, r: number): boolean {
  for (const f of s.fires ?? []) {
    const fx = f.tile % s.w;
    const fy = Math.floor(f.tile / s.w);
    const e = f.b !== undefined ? s.byId.get(f.b) : undefined;
    const n = e && e.kind === 'building' ? e.size : 1;
    const dx = Math.max(0, fx - (b.tx + b.size - 1), b.tx - (fx + n - 1));
    const dy = Math.max(0, fy - (b.ty + b.size - 1), b.ty - (fy + n - 1));
    if (Math.max(dx, dy) <= r) return true;
  }
  return false;
}

/** Citizens and foot soldiers of a building's own team standing close enough to beat at its flames. */
export function beatersAt(s: GameState, b: Building): number {
  let n = 0;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || !carriesTorch(e) || isEnemy(s, b.owner, e.owner)) continue;
    if (distToRect(e.x, e.y, b) <= FIRE.beatReach) n++;
  }
  return n;
}

/** A burnt tree leaves ash where it stood, which grows a tree again after `FIRE.ash` seconds. */
function toAsh(s: GameState, f: Fire): void {
  clearResource(s, f.tile);
  const stools = (s.stools ??= []);
  if (!stools.some((t) => t.tile === f.tile)) stools.push({ tile: f.tile, from: s.tick, at: s.tick + secs(FIRE.ash), ash: true });
  s.events.push({ k: 'fire', what: 'ash', x: (f.tile % s.w) + 0.5, y: Math.floor(f.tile / s.w) + 0.5, by: f.by });
  s.events.push({ k: 'depleted', tile: f.tile });
}

/**
 * Once a second, in the order they were lit: each fire may leap to its living neighbours, then a tree burns on toward ash and a
 * building loses hit points, unless its people beat it out. Fires lit this second wait for the next. Then anyone standing in the
 * flames is scorched.
 */
export function fireStep(s: GameState): void {
  if (!s.fires?.length || s.tick % TICK_HZ !== 0) return;
  const season = seasonAt(s);
  const chance = FIRE.spread[season];
  const run = FIRE.run[season];
  const fires = s.fires;
  const n = fires.length;
  const gone = new Set<Fire>();
  for (let i = 0; i < n; i++) {
    const f = fires[i];
    const e = f.b !== undefined ? s.byId.get(f.b) : undefined;
    const b = e && e.kind === 'building' && e.hp > 0 ? e : null;
    if (f.b !== undefined ? !b : s.res[f.tile] !== R_TREE) {
      // The building fell to something else, or the tree was felled while it burned.
      gone.add(f);
      continue;
    }
    if (f.gen < run) for (const t of around(s, f, b)) if (catchable(s, t) && roll(s) < chance) ignite(s, t, f.gen + 1, f.by);
    if (!b) {
      if (s.tick >= f.end!) {
        toAsh(s, f);
        gone.add(f);
      }
      continue;
    }
    f.out = (f.out ?? 0) + beatersAt(s, b);
    if (f.out >= FIRE.beat) {
      s.events.push({ k: 'fire', what: 'out', x: b.x, y: b.y, by: f.by, owner: b.owner });
      gone.add(f);
      continue;
    }
    // The Wildwood's door: a people standing in it burns twice as hard.
    hurt(s, b, Math.max(1, maxHp(s, b) * FIRE.bld) * fireMul(s, b.owner), f.by, null);
    if (b.hp <= 0) {
      b.burnt = true;
      gone.add(f);
    }
  }
  const left = gone.size ? fires.filter((f) => !gone.has(f)) : fires;
  if (left.length) s.fires = left;
  else delete s.fires;
  scorch(s, left);
}

/** Anyone on the ground standing in the flames loses `FIRE.scorch` hit points, whoever's they are. */
function scorch(s: GameState, fires: Fire[]): void {
  if (!fires.length) return;
  const by = new Map<number, number>();
  for (const f of fires) {
    const e = f.b !== undefined ? s.byId.get(f.b) : undefined;
    if (e && e.kind === 'building') {
      for (let y = e.ty; y < e.ty + e.size; y++) for (let x = e.tx; x < e.tx + e.size; x++) if (!by.has(y * s.w + x)) by.set(y * s.w + x, f.by);
    } else if (!by.has(f.tile)) by.set(f.tile, f.by);
  }
  for (const u of s.ents) {
    if (u.kind !== 'unit' || u.hp <= 0 || u.inside || domainOf(u.type) !== 'land') continue;
    const tx = Math.floor(u.x);
    const ty = Math.floor(u.y);
    let who = -1;
    for (let y = ty - 1; y <= ty + 1 && who < 0; y++) {
      for (let x = tx - 1; x <= tx + 1; x++) {
        if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
        const t = y * s.w + x;
        const b = by.get(t);
        if (b !== undefined && distToTile(u.x, u.y, t, s.w) <= FIRE.scorchReach) {
          who = b;
          break;
        }
      }
    }
    if (who >= 0) hurt(s, u, FIRE.scorch * fireMul(s, u.owner), who, null);
  }
}
