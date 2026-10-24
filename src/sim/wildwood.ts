import { AMOUNT, FIRE, GROVE, SEASON, TICK_HZ, WILDWOOD, domainOf, secs } from './data';
import { ageOf, hasWalked } from './ages';
import { roll } from './animals';
import { landOwnerAt } from './borders';
import { clearResource, walkable } from './grid';
import { seasonAt } from './seasons';
import { statsFor } from './stats';
import { inWood } from './hive';
import { isEnemy, maxHp, spawnUnit } from './world';
import type { Building, GameState, Player, Unit } from './types';
import { B_RES, R_NONE, R_TREE } from './types';

/**
 * The Age of the Wildwood (`docs/wild-road.md` §4): the Wild route's fourth age, where the forest itself walks to war.
 * - One Heart Tree to a people. At it an Ent (`warden`) is woken from the standing tree nearest it within `WILDWOOD.wake` tiles:
 *   the training ends with the tree giving way to the Ent (`wakeTree`).
 * - An Ent roots on bare ground (`rootEnt`): it is a real tree on that tile (`GameState.wardens` remembers whose, and its health),
 *   mending while it stands, and it wakes when a rival on the ground comes within `WILDWOOD.rouse` tiles or its tree is cut into.
 *   Fell or burn the tree and the Ent is gone. While its people has no Heart Tree, every Ent roots where it stands and none wakes.
 * - The Spreading: early each spring the bare ground beside the woods round each Heart Tree takes seedlings (`Stool`s that grow as
 *   the coppice's do), in its people's land only, and its people's Thornwalls grow a stage.
 * - While a people stands in the age: its units walk faster in the woods round its Heart Tree and a rival's slower (`woodPace`),
 *   and fire burns its living buildings and scorches its people twice as hard (`fireMul`).
 * Heart Trees and Ents belong to any people that has walked the Wildwood, in every age after (`buildBarred`, `barred`).
 */

/** Whether a people keeps what the Wildwood gave it: it stands in the Wildwood, or has stood there. */
export const wakesForest = (p: Player): boolean => hasWalked(p, 'wildwood');

/** A people's standing Heart Tree, finished, or null. */
export function heartOf(s: GameState, owner: number): Building | null {
  for (const e of s.ents) if (e.kind === 'building' && e.type === 'heart' && e.owner === owner && e.built && e.hp > 0) return e;
  return null;
}

/** Why a people can't plant another Heart Tree, or null: it is one to a people, a site counting. */
export function heartBarred(s: GameState, owner: number, type: string): string | null {
  if (type !== 'heart') return null;
  for (const e of s.ents) if (e.kind === 'building' && e.type === 'heart' && e.owner === owner && e.hp > 0) return 'Your people has its Heart Tree: one to a people';
  return null;
}

/** Whether a tile is a rooted Ent's tree. */
export const rootedAt = (s: GameState, tile: number): boolean => !!s.wardens?.some((w) => w.tile === tile);

/** Whether a tree burns on this tile. */
const burning = (s: GameState, tile: number): boolean => !!s.fires?.some((f) => f.b === undefined && f.tile === tile);

/** The standing tree nearest a Heart Tree within `WILDWOOD.wake` tiles of it, on a wood's edge, not burning and not an Ent already, or -1. */
export function treeToWake(s: GameState, b: Building): number {
  const r = WILDWOOD.wake;
  const cx = b.tx + b.size / 2;
  const cy = b.ty + b.size / 2;
  let best = -1;
  let bestD = Infinity;
  for (let y = Math.max(0, b.ty - r); y < Math.min(s.h, b.ty + b.size + r); y++) {
    for (let x = Math.max(0, b.tx - r); x < Math.min(s.w, b.tx + b.size + r); x++) {
      const i = y * s.w + x;
      if (s.res[i] !== R_TREE || burning(s, i) || rootedAt(s, i)) continue;
      // Only a tree on a wood's edge, with open ground beside it, so the Ent can walk out.
      if (!walkable(s, x - 1, y) && !walkable(s, x + 1, y) && !walkable(s, x, y - 1) && !walkable(s, x, y + 1)) continue;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  return best;
}

/** What a Heart Tree says when it has no tree left near it to wake. */
export const WAKE_NONE = `No old tree stands within ${WILDWOOD.wake} tiles of the Heart Tree to wake`;

/** How many standing trees lie within `r` tiles of a footprint `size` tiles across at (tx, ty): the old trees a Heart Tree there could wake. */
export function treesRound(s: GameState, tx: number, ty: number, size: number, r: number): number {
  let n = 0;
  for (let y = Math.max(0, ty - r); y < Math.min(s.h, ty + size + r); y++) for (let x = Math.max(0, tx - r); x < Math.min(s.w, tx + size + r); x++) if (s.res[y * s.w + x] === R_TREE) n++;
  return n;
}

/** Turns a tree tile into bare ground, or bare ground into a full tree, telling the renderer. */
function setTree(s: GameState, tile: number, tree: boolean): void {
  if (tree) {
    s.res[tile] = R_TREE;
    s.amount[tile] = AMOUNT.tree;
    s.block[tile] |= B_RES;
    s.events.push({ k: 'regrown', tile });
  } else {
    clearResource(s, tile);
    s.events.push({ k: 'depleted', tile });
  }
  s.blockVersion++;
}

/** An Ent finished at a Heart Tree: the tree nearest it gives way, and the Ent stands where it grew. Null if no tree is left to wake. */
export function wakeTree(s: GameState, b: Building): Unit | null {
  const tile = treeToWake(s, b);
  if (tile < 0) return null;
  setTree(s, tile, false);
  const u = spawnUnit(s, b.owner, 'warden', (tile % s.w) + 0.5, Math.floor(tile / s.w) + 0.5);
  s.events.push({ k: 'wildwood', what: 'wake', owner: b.owner, id: u.id, x: u.x, y: u.y });
  return u;
}

/** Whether a unit could stand on a tile when a tree grows there: anyone else, or a beast, within reach of its middle. */
function crowded(s: GameState, tile: number, self?: Unit): boolean {
  const cx = (tile % s.w) + 0.5;
  const cy = Math.floor(tile / s.w) + 0.5;
  const near = (x: number, y: number) => Math.abs(x - cx) < 0.9 && Math.abs(y - cy) < 0.9;
  for (const e of s.ents) if (e.kind === 'unit' && e !== self && e.hp > 0 && !e.inside && domainOf(e.type) === 'land' && near(e.x, e.y)) return true;
  for (const a of s.animals) if (a.hp > 0 && near(a.x, a.y)) return true;
  return false;
}

/** Why an Ent can't root where it stands, or null: only bare open ground, with nobody else on it, takes a tree. */
export function rootProblem(s: GameState, u: Unit): string | null {
  if (u.type !== 'warden' || u.hp <= 0 || u.inside) return 'Only an Ent roots';
  const tile = Math.floor(u.y) * s.w + Math.floor(u.x);
  if (s.res[tile] !== R_NONE || s.bldAt[tile] !== 0 || s.roots?.some((r) => r.tile === tile) || s.stools?.some((t) => t.tile === tile)) return 'Something already grows or stands here';
  if (!walkable(s, Math.floor(u.x), Math.floor(u.y))) return 'An Ent roots only on open ground';
  if (crowded(s, tile, u)) return 'Someone stands in the way: an Ent roots alone';
  return null;
}

/** An Ent roots where it stands: it leaves the field and is a tree on that tile, keeping its health. */
export function rootEnt(s: GameState, u: Unit): void {
  const tile = Math.floor(u.y) * s.w + Math.floor(u.x);
  (s.wardens ??= []).push({ tile, owner: u.owner, hp: u.hp });
  s.byId.delete(u.id);
  s.ents = s.ents.filter((e) => e !== u);
  setTree(s, tile, true);
  s.events.push({ k: 'wildwood', what: 'root', owner: u.owner, id: u.id, x: (tile % s.w) + 0.5, y: Math.floor(tile / s.w) + 0.5 });
}

/** A rooted Ent wakes: its tree gives way and it stands there with the health it kept. */
function wake(s: GameState, w: { tile: number; owner: number; hp: number }): Unit {
  setTree(s, w.tile, false);
  const u = spawnUnit(s, w.owner, 'warden', (w.tile % s.w) + 0.5, Math.floor(w.tile / s.w) + 0.5);
  u.hp = Math.max(1, Math.min(maxHp(s, u), w.hp));
  s.events.push({ k: 'wildwood', what: 'wake', owner: w.owner, id: u.id, x: u.x, y: u.y });
  return u;
}

/** Whether a rival unit on the ground stands within `WILDWOOD.rouse` tiles of a tile. */
function rivalNear(s: GameState, owner: number, tile: number): boolean {
  const cx = (tile % s.w) + 0.5;
  const cy = Math.floor(tile / s.w) + 0.5;
  const r2 = WILDWOOD.rouse * WILDWOOD.rouse;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || domainOf(e.type) !== 'land' || !isEnemy(s, owner, e.owner)) continue;
    const dx = e.x - cx;
    const dy = e.y - cy;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

/**
 * Once a second: rooted Ents mend, wake for a rival or an axe, or are lost with their tree; a people without a Heart Tree roots every
 * Ent it has; and early each spring the woods round each Heart Tree spread.
 */
export function wildwoodStep(s: GameState): void {
  if (s.tick % TICK_HZ !== 0) return;
  if (s.wardens?.length) {
    const keep: typeof s.wardens = [];
    for (const w of s.wardens) {
      if (s.res[w.tile] !== R_TREE) {
        // Its tree was felled or burnt to ash: the Ent is gone with it.
        s.events.push({ k: 'wildwood', what: 'felled', owner: w.owner, x: (w.tile % s.w) + 0.5, y: Math.floor(w.tile / s.w) + 0.5 });
        continue;
      }
      const p = s.players[w.owner];
      if (!p || p.defeated) continue;
      const most = statsFor(s, w.owner, 'warden').hp;
      w.hp = Math.min(most, w.hp + most * WILDWOOD.mend);
      if (heartOf(s, w.owner) && (s.amount[w.tile] < AMOUNT.tree || rivalNear(s, w.owner, w.tile))) wake(s, w);
      else keep.push(w);
    }
    if (keep.length) s.wardens = keep;
    else delete s.wardens;
  }
  // The Heart Tree fell: every Ent of its people roots where it can.
  let homeless: Set<number> | null = null;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.type !== 'warden' || e.hp <= 0 || e.inside) continue;
    if (!homeless) {
      homeless = new Set();
      for (const p of s.players) if (wakesForest(p) && !heartOf(s, p.id)) homeless.add(p.id);
    }
    if (homeless.has(e.owner) && !rootProblem(s, e)) rootEnt(s, e);
  }
  if (s.tick >= secs(SEASON.len) && seasonAt(s) === 0 && s.tick % secs(SEASON.len) === secs(WILDWOOD.spreadAt)) spread(s);
}

/** Whether any building stands on a tile or beside it. */
function byBuilding(s: GameState, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx >= 0 && ty >= 0 && tx < s.w && ty < s.h && s.bldAt[ty * s.w + tx] !== 0) return true;
    }
  }
  return false;
}

/** The Spreading: round each standing Heart Tree, in id order, its people's woods seed the bare ground beside them; its Thornwalls thicken. */
function spread(s: GameState): void {
  const r = WILDWOOD.spread;
  for (const b of s.ents) {
    if (b.kind !== 'building' || b.type !== 'heart' || !b.built || b.hp <= 0) continue;
    const p = s.players[b.owner];
    if (!p || p.defeated || !wakesForest(p)) continue;
    let n = 0;
    for (let y = Math.max(1, b.ty - r); y < Math.min(s.h - 1, b.ty + b.size + r) && n < WILDWOOD.seeds; y++) {
      for (let x = Math.max(1, b.tx - r); x < Math.min(s.w - 1, b.tx + b.size + r) && n < WILDWOOD.seeds; x++) {
        const i = y * s.w + x;
        if (s.res[i] !== R_NONE || s.bldAt[i] !== 0 || !walkable(s, x, y)) continue;
        if (s.res[i - 1] !== R_TREE && s.res[i + 1] !== R_TREE && s.res[i - s.w] !== R_TREE && s.res[i + s.w] !== R_TREE) continue;
        if (byBuilding(s, x, y) || s.stools?.some((t) => t.tile === i) || s.roots?.some((t) => t.tile === i)) continue;
        if (landOwnerAt(s, x, y) !== b.owner || roll(s) >= WILDWOOD.seed) continue;
        (s.stools ??= []).push({ tile: i, from: s.tick, at: s.tick + secs(WILDWOOD.grow) });
        n++;
      }
    }
    for (const e of s.ents) {
      if (e.kind !== 'building' || e.type !== 'thornwall' || e.owner !== b.owner || !e.built || e.hp <= 0 || (e.level ?? 0) >= 3) continue;
      e.grown = Math.max(e.grown ?? 0, GROVE.stage * ((e.level ?? 0) + 1));
    }
    s.events.push({ k: 'wildwood', what: 'spread', owner: b.owner, x: b.x, y: b.y, n });
  }
}

/** The Heart Trees of the peoples standing in the Wildwood now, kept for one tick (`woodPace` asks for every walking unit). */
const hearts = new WeakMap<GameState, { tick: number; list: Building[] }>();
function wildHearts(s: GameState): Building[] {
  const c = hearts.get(s);
  if (c && c.tick === s.tick) return c.list;
  const list: Building[] = [];
  if (s.players.some((p) => ageOf(p) === 'wildwood')) {
    for (const e of s.ents) if (e.kind === 'building' && e.type === 'heart' && e.built && e.hp > 0 && ageOf(s.players[e.owner]) === 'wildwood') list.push(e);
  }
  hearts.set(s, { tick: s.tick, list });
  return list;
}

/**
 * Woodland ways: in a wood within `WILDWOOD.ways.reach` tiles of the Heart Tree of a people standing in the Wildwood, its own
 * people walk at `ways.own` pace and its rivals at `ways.rival`. Elsewhere, 1.
 */
export function woodPace(s: GameState, u: Unit): number {
  const list = wildHearts(s);
  if (!list.length || domainOf(u.type) !== 'land') return 1;
  const r2 = WILDWOOD.ways.reach * WILDWOOD.ways.reach;
  let near: Building | null = null;
  for (const h of list) {
    const dx = u.x - h.x;
    const dy = u.y - h.y;
    if (dx * dx + dy * dy <= r2 && (h.owner === u.owner || isEnemy(s, h.owner, u.owner))) {
      near = h;
      break;
    }
  }
  if (!near || !inWood(s, u)) return 1;
  return near.owner === u.owner ? WILDWOOD.ways.own : WILDWOOD.ways.rival;
}

/** How hard fire takes a people's living things: `FIRE.wild` times while it stands in the Wildwood (its door), else 1. */
export const fireMul = (s: GameState, owner: number): number => (s.players[owner] && ageOf(s.players[owner]) === 'wildwood' ? FIRE.wild : 1);

/** The Heart Tree's words for the HUD: its Ents awake and rooted, and whether it has a tree to wake. */
export function heartLine(s: GameState, b: Building): string {
  if (!b.built) return 'Being planted';
  let awake = 0;
  for (const e of s.ents) if (e.kind === 'unit' && e.type === 'warden' && e.owner === b.owner && e.hp > 0) awake++;
  const rooted = s.wardens?.filter((w) => w.owner === b.owner).length ?? 0;
  const tree = treeToWake(s, b) >= 0 ? `old trees stand within ${WILDWOOD.wake} tiles to wake` : `no tree stands within ${WILDWOOD.wake} tiles to wake: plant or spare some`;
  return `${awake} Ent${awake === 1 ? '' : 's'} awake, ${rooted} rooted; ${tree}`;
}
