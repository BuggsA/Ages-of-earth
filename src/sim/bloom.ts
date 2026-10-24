import { BLOOM, SEASON, TICK_HZ, domainOf, secs } from './data';
import { ageOf } from './ages';
import { borderMap } from './borders';
import { peace } from './combat';
import { distToRect, walkable } from './grid';
import { heartOf } from './wildwood';
import { canAfford, isEnemy, pay } from './world';
import type { BloomSeed, Building, BuildingType, Ent, GameState, Player } from './types';
import { R_NONE, R_TREE, T_GRASS, T_SAND } from './types';

/**
 * The Age of the Bloom (`docs/wild-road.md` §5b): the Wild route's plants' end, the green answer to the warhead.
 * - One Seed Spire to a people. While its Heart Tree stands, it ripens a Bloom Seed over `BLOOM.ripen` seconds, one at a time.
 * - Slung at a point (`sling`), the Seed is in the air `BLOOM.flight` seconds, every player seeing where it falls, then roots on the
 *   open tile nearest that point. Each rival citizen within `BLOOM.reach` tiles of its heart-root hacks a stroke a second; `BLOOM.root`
 *   strokes cut it out. Uncut after `BLOOM.grow` seconds, it cracks every rival building within `BLOOM.r` tiles, and their ground
 *   grows forest (`Stool`s, as the coppice's).
 * - The Greening: a people standing in the Bloom with its Heart Tree, whose land is green enough (`greenOf`) for `BLOOM.hold` seconds,
 *   wins (`checkVictory` in `game.ts`). The share is measured once a second, only while someone stands in the Bloom.
 * - Pollen storms: the first `BLOOM.storm` seconds of each season, rival land units and Watch Towers near a Bloom people's Heart Tree
 *   see half as far (`pollenMul`, read by `vision.ts`). The Spreading comes every season for a Bloom people (`wildwood.ts`).
 * Spires belong to any people that has walked the Bloom, in every age after (`buildBarred`).
 */

/** Whether a people stands in the Bloom now. */
export const inBloom = (p: Player | undefined): boolean => !!p && ageOf(p) === 'bloom';

/** A people's standing Seed Spire, finished, or null. */
export function spireOf(s: GameState, owner: number): Building | null {
  for (const e of s.ents) if (e.kind === 'building' && e.type === 'spire' && e.owner === owner && e.built && e.hp > 0) return e;
  return null;
}

/** Why a people can't raise another Seed Spire, or null: it is one to a people, a site counting. */
export function spireBarred(s: GameState, owner: number, type: BuildingType): string | null {
  if (type !== 'spire') return null;
  for (const e of s.ents) if (e.kind === 'building' && e.type === 'spire' && e.owner === owner && e.hp > 0) return 'Your people has its Seed Spire: one to a people';
  return null;
}

/** Seconds until a Spire's Seed is ripe: 0 when it is, null while the Spire is unfinished. */
export function ripeIn(s: GameState, b: Building): number | null {
  if (!b.built || b.ripe === undefined) return b.built ? BLOOM.ripen : null;
  return Math.max(0, Math.ceil((b.ripe - s.tick) / TICK_HZ));
}

/** Why this Spire can't sling its Seed at this point, or null. */
export function slingProblem(s: GameState, owner: number, b: Ent | undefined, x: number, y: number): string | null {
  if (!b || b.kind !== 'building' || b.type !== 'spire' || b.owner !== owner) return 'Pick your Seed Spire';
  if (!b.built || b.hp <= 0) return 'The Spire is not finished';
  if (peace(s)) return 'Not while the peace holds';
  const left = ripeIn(s, b);
  if (left === null || left > 0) return heartOf(s, owner) ? `The Seed ripens in ${left ?? BLOOM.ripen}s` : 'No Seed ripens while your Heart Tree is down';
  if (!(x >= 0 && y >= 0 && x < s.w && y < s.h)) return 'Pick a point on the map';
  if (!canAfford(s.players[owner], BLOOM.fuel)) return `Slinging a Seed takes ${Object.entries(BLOOM.fuel).map(([r, n]) => `${n} ${r}`).join(', ')}`;
  return null;
}

/** Sling: pay, start the Spire's next Seed, and put this one in the air for every player to see. */
export function sling(s: GameState, owner: number, b: Building, x: number, y: number): void {
  pay(s.players[owner], BLOOM.fuel);
  b.ripe = s.tick + secs(BLOOM.ripen);
  const id = s.nextId++;
  const lands = s.tick + secs(BLOOM.flight);
  (s.blooms ??= []).push({ id, owner, spire: b.id, x, y, lands, at: lands + secs(BLOOM.grow), cut: 0 });
  s.events.push({ k: 'bloom', what: 'slung', owner, x, y, id });
}

/** Whether a Seed has come down and rooted. */
export const rooted = (s: GameState, l: BloomSeed): boolean => s.tick >= l.lands;

/** The open tile nearest (x, y) within `BLOOM.land` tiles, nearest first and then in tile order: bare, walkable ground, nothing on it. -1: none. */
function rootTile(s: GameState, x: number, y: number): number {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let best = -1;
  let bestD = Infinity;
  for (let ty = Math.max(0, cy - BLOOM.land); ty <= Math.min(s.h - 1, cy + BLOOM.land); ty++) {
    for (let tx = Math.max(0, cx - BLOOM.land); tx <= Math.min(s.w - 1, cx + BLOOM.land); tx++) {
      const i = ty * s.w + tx;
      if (s.res[i] !== R_NONE || s.bldAt[i] !== 0 || !walkable(s, tx, ty)) continue;
      const d = (tx - cx) * (tx - cx) + (ty - cy) * (ty - cy);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  return best;
}

/** Rival citizens out in the open within `BLOOM.reach` tiles of a rooted Seed's heart-root: each hacks a stroke a second. */
export function hackersAt(s: GameState, l: BloomSeed): number {
  const r2 = BLOOM.reach * BLOOM.reach;
  let n = 0;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.type !== 'citizen' || e.hp <= 0 || e.inside || !isEnemy(s, l.owner, e.owner)) continue;
    if ((e.x - l.x) * (e.x - l.x) + (e.y - l.y) * (e.y - l.y) <= r2) n++;
  }
  return n;
}

/** The ring a rooted Seed cracks: every rival building whose nearest edge lies within `BLOOM.r` tiles of its heart-root, in id order. */
export function ringOf(s: GameState, l: { owner: number; x: number; y: number }): Building[] {
  const out: Building[] = [];
  for (const e of s.ents) if (e.kind === 'building' && e.hp > 0 && isEnemy(s, l.owner, e.owner) && distToRect(l.x, l.y, e) < BLOOM.r) out.push(e);
  return out;
}

/** Plants a seedling on a tile that could hold a tree, due `after` seconds on. */
function seedling(s: GameState, tile: number, after: number): void {
  const t = s.terrain[tile];
  if ((t !== T_GRASS && t !== T_SAND) || s.res[tile] !== R_NONE) return;
  const stools = (s.stools ??= []);
  if (stools.some((x) => x.tile === tile)) return;
  stools.push({ tile, from: s.tick, at: s.tick + secs(after) });
}

/** The Bloom: every building in the ring falls, and forest grows on the ground it stood on and on the heart-root's own tile. */
function crack(s: GameState, l: BloomSeed): void {
  const ring = ringOf(s, l);
  for (const b of ring) {
    b.hp = 0;
    s.players[l.owner].stats.razed++;
    for (let ty = b.ty; ty < b.ty + b.size; ty++) for (let tx = b.tx; tx < b.tx + b.size; tx++) seedling(s, ty * s.w + tx, BLOOM.sprout);
  }
  seedling(s, Math.floor(l.y) * s.w + Math.floor(l.x), BLOOM.sprout);
  s.events.push({ k: 'bloom', what: 'cracked', owner: l.owner, x: l.x, y: l.y, id: l.id, n: ring.length });
}

/** Every tick: Spires ripen, Seeds come down, are hacked at or crack their ring; once a second, the Greening is measured. */
export function bloomStep(s: GameState): void {
  const second = s.tick % TICK_HZ === 0;
  if (second) {
    for (const e of s.ents) {
      if (e.kind !== 'building' || e.type !== 'spire' || !e.built || e.hp <= 0) continue;
      if (e.ripe === undefined) e.ripe = s.tick + secs(BLOOM.ripen);
      // No Seed ripens while its people's Heart Tree is down: the clock waits.
      else if (s.tick < e.ripe && !heartOf(s, e.owner)) e.ripe += TICK_HZ;
    }
  }
  if (s.blooms) {
    const left: BloomSeed[] = [];
    for (const l of s.blooms) {
      if (s.tick === l.lands) {
        const tile = rootTile(s, l.x, l.y);
        if (tile < 0) {
          s.events.push({ k: 'bloom', what: 'withered', owner: l.owner, x: l.x, y: l.y, id: l.id });
          continue;
        }
        l.x = (tile % s.w) + 0.5;
        l.y = Math.floor(tile / s.w) + 0.5;
        s.events.push({ k: 'bloom', what: 'rooted', owner: l.owner, x: l.x, y: l.y, id: l.id });
      }
      if (rooted(s, l) && second && s.tick > l.lands) {
        l.cut += hackersAt(s, l);
        if (l.cut >= BLOOM.root) {
          s.events.push({ k: 'bloom', what: 'hacked', owner: l.owner, x: l.x, y: l.y, id: l.id });
          continue;
        }
      }
      if (s.tick >= l.at) {
        crack(s, l);
        continue;
      }
      left.push(l);
    }
    if (left.length) s.blooms = left;
    else delete s.blooms;
  }
  if (second) greenStep(s);
}

/** Whether a building's tiles count green for its people: an Orchard, its Heart Tree, or a Thornwall grown to living oak. */
const greenBuilding = (b: Building): boolean => b.type === 'orchard' || b.type === 'heart' || (b.type === 'thornwall' && (b.level ?? 0) >= 3);

/**
 * How green each Bloom people's land is: per player, its land's open tiles (grass and sand) and the green among them (a standing tree,
 * or a tile of its own green building). Null when nobody stands in the Bloom. One `borderMap` for all.
 */
export function greenOf(s: GameState): { land: number[]; green: number[] } | null {
  if (!s.players.some((p) => inBloom(p) && !p.defeated)) return null;
  const own = borderMap(s);
  const land = s.players.map(() => 0);
  const green = s.players.map(() => 0);
  const counts = s.players.map((p) => inBloom(p) && !p.defeated);
  for (let i = 0; i < own.length; i++) {
    const o = own[i];
    if (o < 0 || !counts[o]) continue;
    const t = s.terrain[i];
    if (t !== T_GRASS && t !== T_SAND) continue;
    land[o]++;
    if (s.res[i] === R_TREE) green[o]++;
  }
  for (const e of s.ents) {
    if (e.kind !== 'building' || !counts[e.owner] || !e.built || e.hp <= 0 || !greenBuilding(e)) continue;
    for (let ty = e.ty; ty < e.ty + e.size; ty++) for (let tx = e.tx; tx < e.tx + e.size; tx++) if (own[ty * s.w + tx] === e.owner) green[e.owner]++;
  }
  return { land, green };
}

/** The share of a people's land that is green, in thousandths, against at least `BLOOM.least` tiles. */
export const shareOf = (green: number, land: number): number => Math.floor((green * 1000) / Math.max(land, BLOOM.least));

/** Once a second: each Bloom people's green share; a hold begins, or fades, by the Heart Tree and `BLOOM.green`. */
function greenStep(s: GameState): void {
  const g = greenOf(s);
  for (const p of s.players) {
    if (!g || !inBloom(p) || p.defeated) {
      if (p.green !== undefined) delete p.green;
      if (p.greenSince !== undefined) delete p.greenSince;
      continue;
    }
    p.green = shareOf(g.green[p.id], g.land[p.id]);
    const heart = heartOf(s, p.id);
    const holds = !!heart && p.green >= BLOOM.green * 1000;
    if (holds && p.greenSince === undefined) {
      p.greenSince = s.tick;
      s.events.push({ k: 'bloom', what: 'held', owner: p.id, x: heart!.x, y: heart!.y });
    } else if (!holds && p.greenSince !== undefined) {
      delete p.greenSince;
      s.events.push({ k: 'bloom', what: 'faded', owner: p.id, x: heart?.x ?? 0, y: heart?.y ?? 0 });
    }
  }
  // Each season opens with a pollen storm round every Bloom people's Heart Tree.
  if (s.tick % secs(SEASON.len) === 0) {
    for (const p of s.players) {
      const heart = inBloom(p) && !p.defeated ? heartOf(s, p.id) : null;
      if (heart) s.events.push({ k: 'bloom', what: 'storm', owner: p.id, x: heart.x, y: heart.y });
    }
  }
}

/** Seconds of the Greening's hold left for a people, or null when it holds none. */
export const greenLeft = (s: GameState, p: Player): number | null =>
  p.greenSince === undefined ? null : Math.max(0, Math.ceil((p.greenSince + secs(BLOOM.hold) - s.tick) / TICK_HZ));

/** Whether a pollen storm blows now: the first `BLOOM.storm` seconds of each season. */
export const storming = (s: GameState): boolean => s.tick % secs(SEASON.len) < secs(BLOOM.storm);

/** The Heart Trees a pollen storm blows round this tick (the Bloom peoples'), kept for one tick (`pollenMul` asks for everyone that sees). */
const storms = new WeakMap<GameState, { tick: number; list: Building[] }>();
export function stormHearts(s: GameState): Building[] {
  const c = storms.get(s);
  if (c && c.tick === s.tick) return c.list;
  const list: Building[] = [];
  if (storming(s)) {
    for (const p of s.players) {
      const h = inBloom(p) && !p.defeated ? heartOf(s, p.id) : null;
      if (h) list.push(h);
    }
  }
  storms.set(s, { tick: s.tick, list });
  return list;
}

/** How far a unit or building sees in a pollen storm: `BLOOM.blind` for a rival land unit or Watch Tower near a Bloom Heart Tree, else 1. */
export function pollenMul(s: GameState, e: Ent): number {
  const list = stormHearts(s);
  if (!list.length) return 1;
  if (e.kind === 'unit' ? domainOf(e.type) !== 'land' : e.type !== 'tower') return 1;
  const r2 = BLOOM.pollen * BLOOM.pollen;
  for (const h of list) {
    if (!isEnemy(s, h.owner, e.owner)) continue;
    if ((e.x - h.x) * (e.x - h.x) + (e.y - h.y) * (e.y - h.y) <= r2) return BLOOM.blind;
  }
  return 1;
}

/** The Spire's words for the HUD. */
export function spireLine(s: GameState, b: Building): string {
  if (!b.built) return 'Being raised';
  const left = ripeIn(s, b) ?? BLOOM.ripen;
  if (left > 0) return heartOf(s, b.owner) ? `Seed ripens in ${left}s` : `Seed waits (${left}s): your Heart Tree is down`;
  return 'Seed ripe: sling it (G)';
}
