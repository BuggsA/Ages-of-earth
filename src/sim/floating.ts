import { BUILDINGS, FLOAT, domainOf } from './data';
import { ageDef } from './ages';
import { nearestWalkable, placeProblem, sails, stampBuilding, walkable } from './grid';
import { setOrder } from './units';
import { maxHp, spawnUnit } from './world';
import type { Building, GameState, Player, Unit } from './types';

/**
 * The Age of Floating Cities (#770, s7 of the Water Road #701): a town on the water. A Pontoon is a district moored on open water; its own
 * people walk its deck (it is stamped as a gate, as a dyke's crown is), ships go round it. Pontoons whose sides touch link, and a district
 * of `FLOAT.city` or more raises citizens. The `pack` order casts one off into a tow that carries those on its deck; the `pitch` order
 * moors it again (`steppe.ts`, the Steppe's wagons on the water). Ships hole it fast, and when it sinks its deck-hands swim for it.
 * Everything here is tile order and id order: online play, saves and replays see the same city.
 */

/** Whether a finished, standing Pontoon lies on this tile: a deck its people walk. */
export function isDeck(s: GameState, i: number): boolean {
  const b = s.byId.get(s.bldAt[i]);
  return !!b && b.kind === 'building' && b.type === 'pontoon' && b.built && b.hp > 0;
}

/** Why a Pontoon can't be moored with its corner here, or null: every tile must be open water a ship sails. */
export function pontoonSpot(s: GameState, tx: number, ty: number, n: number): 'dry' | null {
  for (let y = ty; y < ty + n; y++) for (let x = tx; x < tx + n; x++) if (!sails(s, y * s.w + x)) return 'dry';
  return null;
}

/**
 * Whether a Pontoon here would lie adrift: no tile round it that its people could stand on to raise it (dry land, or a deck of their
 * own). A tow moors anywhere; builders need a foothold.
 */
export function adrift(s: GameState, owner: number, tx: number, ty: number, n: number): boolean {
  const team = s.players[owner]?.team ?? -1;
  for (let y = ty - 1; y <= ty + n; y++)
    for (let x = tx - 1; x <= tx + n; x++) {
      if (x >= tx && x < tx + n && y >= ty && y < ty + n) continue;
      if (walkable(s, x, y, team)) return false;
    }
  return true;
}

type Square = { tx: number; ty: number; size: number };

/** Whether two moored districts touch side to side (corners alone don't link). */
function touch(a: Square, b: Square): boolean {
  const n = a.size;
  const m = b.size;
  const side = (a.tx + n === b.tx || b.tx + m === a.tx) && a.ty < b.ty + m && b.ty < a.ty + n;
  const end = (a.ty + n === b.ty || b.ty + m === a.ty) && a.tx < b.tx + m && b.tx < a.tx + n;
  return side || end;
}

/** A people's finished, standing Pontoons, in id order. */
export function pontoonsOf(s: GameState, owner: number): Building[] {
  const out: Building[] = [];
  for (const e of s.ents) if (e.kind === 'building' && e.type === 'pontoon' && e.owner === owner && e.built && e.hp > 0) out.push(e);
  return out;
}

/** The district a finished Pontoon belongs to: it and every pontoon of its people linked to it, side to side, in id order. */
export function districtOf(s: GameState, b: Building): Building[] {
  if (b.type !== 'pontoon' || !b.built || b.hp <= 0) return [];
  const all = pontoonsOf(s, b.owner);
  const into = new Set<number>([b.id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const o of all) {
      if (into.has(o.id)) continue;
      for (const id of into) {
        if (!touch(o, s.byId.get(id) as Building)) continue;
        into.add(o.id);
        grew = true;
        break;
      }
    }
  }
  return all.filter((o) => into.has(o.id));
}

/** Whether a Pontoon raises citizens: it stands in a district of `FLOAT.city` or more. */
export const raisesCitizens = (s: GameState, b: Building): boolean => districtOf(s, b).length >= FLOAT.city;

/** Why a citizen can't be raised at this Pontoon, or null. */
export function linkProblem(s: GameState, b: Building): string | null {
  if (b.type !== 'pontoon' || raisesCitizens(s, b)) return null;
  return `Link ${FLOAT.city} pontoons side by side first: a lone district raises no citizens`;
}

/** Whether a people may cast its districts off: it stands in the Age of Floating Cities, or this Pontoon is its keepsake. */
const floats = (p: Player, b: Building): boolean => !!ageDef(p).floats || b.keep === 'floating';

/** Whether open water a tow could put out on lies beside a footprint. */
function openBeside(s: GameState, b: Building): boolean {
  for (let y = b.ty - 1; y <= b.ty + b.size; y++)
    for (let x = b.tx - 1; x <= b.tx + b.size; x++) {
      if (x < 0 || y < 0 || x >= s.w || y >= s.h || (x >= b.tx && x < b.tx + b.size && y >= b.ty && y < b.ty + b.size)) continue;
      if (sails(s, y * s.w + x)) return true;
    }
  return false;
}

/** Why this Pontoon can't be cast off now, or null. */
export function castProblem(s: GameState, p: Player, b: Building): string | null {
  if (b.type !== 'pontoon') return 'Only a Pontoon is cast off';
  if (!floats(p, b)) return 'Only a floating people casts its districts off';
  if (!b.built || b.hp <= 0) return 'It must stand finished first';
  if (b.queue.length) return 'Finish or cancel the training here first';
  // A district aground (the tide out, #739) or hemmed in by its own neighbours has no water to be towed out on.
  if (!openBeside(s, b)) return 'Aground: no open water beside it to tow it out on';
  return null;
}

/** Those on a footprint's deck now, on foot, in id order: who goes with it, or swims, when it leaves or sinks. */
function onDeck(s: GameState, b: Building): Unit[] {
  const out: Unit[] = [];
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || domainOf(e.type) !== 'land') continue;
    const x = Math.floor(e.x);
    const y = Math.floor(e.y);
    if (x >= b.tx && x < b.tx + b.size && y >= b.ty && y < b.ty + b.size) out.push(e);
  }
  return out;
}

/** A deck-hand left in the water swims to the nearest deck or shore within `FLOAT.swim` tiles, hurt, or drowns. */
function swim(s: GameState, u: Unit): void {
  const to = nearestWalkable(s, u.x, u.y, FLOAT.swim, s.players[u.owner]?.team ?? -1);
  u.path = null;
  if (u.goal) u.wantPath = true;
  if (to < 0) {
    u.hp = 0;
    return;
  }
  u.x = (to % s.w) + 0.5;
  u.y = Math.floor(to / s.w) + 0.5;
  u.px = u.x;
  u.py = u.y;
  u.hp = Math.max(0, u.hp - FLOAT.hurt);
}

/**
 * Cast a Pontoon off: it becomes a tow where it lay, with the health it had, carrying those sheltering in it and then those of its own
 * people on its deck, up to `FLOAT.hold`; anyone else on its deck swims.
 */
export function castOff(s: GameState, b: Building): Unit {
  const people: Unit[] = [];
  for (const id of b.garrison) {
    const u = s.byId.get(id);
    if (u && u.kind === 'unit' && u.hp > 0) people.push(u);
  }
  b.garrison = [];
  const deck = onDeck(s, b);
  const share = b.hp / maxHp(s, b);
  stampBuilding(s, b, false);
  s.byId.delete(b.id);
  s.ents = s.ents.filter((e) => e !== b);
  const tow = spawnUnit(s, b.owner, 'tow', b.x, b.y);
  tow.packed = 'pontoon';
  tow.packedHp = share;
  for (const u of deck) if (u.owner === b.owner) people.push(u);
  let swum = 0;
  for (const u of people) {
    if (tow.cargo.length < FLOAT.hold) {
      u.inside = tow.id;
      u.x = tow.x;
      u.y = tow.y;
      u.px = u.x;
      u.py = u.y;
      u.path = null;
      setOrder(u, { k: 'idle' });
      tow.cargo.push(u.id);
    } else {
      u.inside = 0;
      swim(s, u);
      swum++;
    }
  }
  for (const u of deck) if (u.owner !== b.owner) {
    swim(s, u);
    swum++;
  }
  s.events.push({ k: 'pontoon', owner: b.owner, id: tow.id, x: b.x, y: b.y, act: 'cast', aboard: tow.cargo.length, swum });
  return tow;
}

/** A Pontoon has sunk (`removeDead`, after its footprint is cleared): those on its deck swim for it, or drown. */
export function sink(s: GameState, b: Building): void {
  const deck = onDeck(s, b);
  for (const u of deck) swim(s, u);
  const drowned = deck.filter((u) => u.hp <= 0).length;
  s.events.push({ k: 'pontoon', owner: b.owner, id: b.id, x: b.x, y: b.y, act: 'sink', aboard: deck.length - drowned, swum: drowned });
}

/**
 * Where a people would moor a new Pontoon near a point (the computer, and the dev hook): beside one of its own, so the town links, before
 * anywhere else; then the nearest within `reach` tiles; ties in tile order. Null where there is no open water to moor on.
 */
export function mooringSpot(s: GameState, owner: number, cx: number, cy: number, reach: number): { tx: number; ty: number } | null {
  const n = BUILDINGS.pontoon.size;
  const own = pontoonsOf(s, owner);
  let best: { tx: number; ty: number } | null = null;
  let bestScore = Infinity;
  const x0 = Math.max(1, Math.floor(cx - reach));
  const y0 = Math.max(1, Math.floor(cy - reach));
  for (let ty = y0; ty <= Math.min(s.h - n - 1, cy + reach); ty++)
    for (let tx = x0; tx <= Math.min(s.w - n - 1, cx + reach); tx++) {
      const dx = tx + n / 2 - cx;
      const dy = ty + n / 2 - cy;
      const d = dx * dx + dy * dy;
      // The best this spot could score is linked; past that, it can't win.
      if (d > reach * reach || d - reach * reach * 4 >= bestScore) continue;
      if (!sails(s, ty * s.w + tx) || placeProblem(s, 'pontoon', tx, ty, true, owner)) continue;
      const links = own.some((o) => touch(o, { tx, ty, size: n }));
      const score = links ? d - reach * reach * 4 : d;
      if (score < bestScore) {
        bestScore = score;
        best = { tx, ty };
      }
    }
  return best;
}

/** Where on a moored district its people step out: its own deck, on the side toward where they are going. */
export function deckSpot(b: Building, towardX: number, towardY: number): { x: number; y: number } {
  const x = Math.max(b.tx + 0.5, Math.min(b.tx + b.size - 0.5, towardX));
  const y = Math.max(b.ty + 0.5, Math.min(b.ty + b.size - 0.5, towardY));
  return { x, y };
}
