import { BUILDINGS, EPOCHS, LAST_EPOCH, RES_LABEL, UNITS, unitEpoch, unitStats } from './data';
import { placeProblem, walkable } from './grid';
import type { Building, Command, Cost, GameState, Player, Unit } from './types';
import { RES, R_NONE } from './types';
import { RES_OF_TILE, freeFarm, goTo, setOrder } from './units';
import { goalForPoint, isEnemy, pay, placeBuilding, refund } from './world';

/**
 * Everything a player can do, as plain data. A person's clicks and the computer opponent both go
 * through here, and each command is checked (it must be your unit, you must afford it) before it
 * changes anything, so the same list of commands always plays out the same way.
 */

export const MAX_QUEUE = 6;

function refuse(s: GameState, p: number, why: string): void {
  s.events.push({ k: 'refused', owner: p, why });
}

/** What's missing to pay a cost, in words ("Need 40 more wood"), or null when it can be paid. */
export function shortfall(p: Player, cost: Cost): string | null {
  for (const r of RES) {
    const need = (cost[r] ?? 0) - p.res[r];
    if (need > 0) return `Need ${Math.ceil(need)} more ${RES_LABEL[r].toLowerCase()}`;
  }
  return null;
}

function myUnits(s: GameState, p: number, ids: number[]): Unit[] {
  const out: Unit[] = [];
  const seen = new Set<number>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const e = s.byId.get(id);
    if (e && e.kind === 'unit' && e.owner === p && e.hp > 0) out.push(e);
  }
  return out;
}

function myBuilding(s: GameState, p: number, id: number): Building | null {
  const e = s.byId.get(id);
  return e && e.kind === 'building' && e.owner === p && e.hp > 0 ? e : null;
}

/**
 * Spots for a group around a point: rows facing the way they walk, the front row going to the units
 * already furthest along, so nobody has to cross through the others.
 */
export function formation(s: GameState, units: Unit[], x: number, y: number): { u: Unit; x: number; y: number }[] {
  if (units.length === 1) return [{ u: units[0], x, y }];
  let cx = 0;
  let cy = 0;
  let spacing = 0;
  for (const u of units) {
    cx += u.x;
    cy += u.y;
    spacing = Math.max(spacing, unitStats(u.type, s.players[u.owner].epoch).radius * 2 + 0.18);
  }
  cx /= units.length;
  cy /= units.length;
  let fx = x - cx;
  let fy = y - cy;
  const fl = Math.sqrt(fx * fx + fy * fy);
  if (fl < 1e-3) {
    fx = 0;
    fy = 1;
  } else {
    fx /= fl;
    fy /= fl;
  }
  const px = -fy;
  const py = fx;
  const n = units.length;
  const cols = Math.ceil(Math.sqrt(n * 1.6));
  const rows = Math.ceil(n / cols);
  const ahead = (u: Unit) => (u.x - cx) * fx + (u.y - cy) * fy;
  const side = (u: Unit) => (u.x - cx) * px + (u.y - cy) * py;
  const sorted = [...units].sort((a, b) => ahead(b) - ahead(a) || a.id - b.id);
  const out: { u: Unit; x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    const row = sorted.slice(r * cols, r * cols + cols).sort((a, b) => side(a) - side(b) || a.id - b.id);
    const width = row.length;
    for (let c = 0; c < width; c++) {
      const off = (c - (width - 1) / 2) * spacing;
      const back = (r - (rows - 1) / 2) * spacing;
      out.push({ u: row[c], x: x + px * off - fx * back, y: y + py * off - fy * back });
    }
  }
  return out;
}

export function applyCommand(s: GameState, c: Command): void {
  const p = s.players[c.p];
  if (!p || p.defeated || s.over) return;
  switch (c.t) {
    case 'move': {
      const units = myUnits(s, c.p, c.ids);
      for (const spot of formation(s, units, c.x, c.y)) {
        const g = goalForPoint(s, spot.x, spot.y);
        setOrder(spot.u, { k: 'move', x: g.px, y: g.py, amove: !!c.amove });
        goTo(spot.u, g);
      }
      break;
    }
    case 'attack': {
      const t = s.byId.get(c.target);
      if (!t || t.hp <= 0) return;
      const units = myUnits(s, c.p, c.ids);
      if (!isEnemy(s, c.p, t.owner)) {
        // Not a foe: just walk over there.
        applyCommand(s, { t: 'move', p: c.p, ids: units.map((u) => u.id), x: t.x, y: t.y });
        return;
      }
      for (const u of units) setOrder(u, { k: 'attack', target: t.id, auto: false, then: null });
      break;
    }
    case 'gather': {
      const kind = s.res[c.tile];
      if (kind === R_NONE || c.tile < 0 || c.tile >= s.w * s.h) return;
      const units = myUnits(s, c.p, c.ids);
      const citizens = units.filter((u) => u.type === 'citizen');
      for (const u of citizens) setOrder(u, { k: 'gather', tile: c.tile, res: RES_OF_TILE[kind], phase: 'go' });
      const others = units.filter((u) => u.type !== 'citizen');
      if (others.length) applyCommand(s, { t: 'move', p: c.p, ids: others.map((u) => u.id), x: (c.tile % s.w) + 0.5, y: Math.floor(c.tile / s.w) + 0.5 });
      break;
    }
    case 'work': {
      const b = myBuilding(s, c.p, c.target);
      if (!b) return;
      const units = myUnits(s, c.p, c.ids);
      const citizens = units.filter((u) => u.type === 'citizen');
      let farmTaken = false;
      for (const u of citizens) {
        if (!b.built) setOrder(u, { k: 'build', target: b.id });
        else if (b.type === 'farm') {
          // One farmer per field; the rest look for free fields nearby.
          const field = farmTaken ? freeFarm(s, c.p, b.x, b.y, 12) : b;
          farmTaken = true;
          if (field) setOrder(u, { k: 'farm', target: field.id, phase: 'go' });
        } else if (BUILDINGS[b.type].drop.length && u.carry > 0) setOrder(u, { k: 'deliver' });
        else applyCommand(s, { t: 'move', p: c.p, ids: [u.id], x: b.x, y: b.y + b.size / 2 + 0.6 });
      }
      const others = units.filter((u) => u.type !== 'citizen');
      if (others.length) applyCommand(s, { t: 'move', p: c.p, ids: others.map((u) => u.id), x: b.x, y: b.y + b.size / 2 + 1 });
      break;
    }
    case 'build': {
      const def = BUILDINGS[c.type];
      if (!def) return;
      if (def.epoch > p.epoch) return refuse(s, c.p, `Needs the ${EPOCHS[def.epoch].name}`);
      const problem = placeProblem(s, c.type, c.tx, c.ty);
      if (problem) return refuse(s, c.p, problem === 'slope' ? 'Too steep to build there' : "Can't build there");
      const short = shortfall(p, def.cost);
      if (short) return refuse(s, c.p, short);
      pay(p, def.cost);
      const b = placeBuilding(s, c.p, c.type, c.tx, c.ty, false);
      s.events.push({ k: 'placed', id: b.id, owner: c.p, type: c.type });
      for (const u of myUnits(s, c.p, c.ids)) {
        if (u.type !== 'citizen') continue;
        // Remember the work they were doing, to go back to it once the building is up.
        const o = u.order;
        const back = o.k === 'gather' ? { ...o, phase: 'go' as const } : o.k === 'farm' ? { ...o, phase: 'go' as const } : o.k === 'build' ? u.resume : null;
        setOrder(u, { k: 'build', target: b.id });
        u.resume = back;
      }
      break;
    }
    case 'train': {
      const b = myBuilding(s, c.p, c.building);
      if (!b || !b.built) return;
      const def = BUILDINGS[b.type];
      if (!def.trains.includes(c.unit) || !UNITS[c.unit]) return;
      if (unitEpoch(c.unit) > p.epoch) return refuse(s, c.p, `Needs the ${EPOCHS[unitEpoch(c.unit)].name}`);
      if (b.queue.length >= MAX_QUEUE) return refuse(s, c.p, 'The queue is full');
      const cost = unitStats(c.unit, p.epoch).cost;
      const short = shortfall(p, cost);
      if (short) return refuse(s, c.p, short);
      pay(p, cost);
      b.queue.push({ unit: c.unit, done: 0, paid: { ...cost } });
      break;
    }
    case 'cancel': {
      const b = myBuilding(s, c.p, c.building);
      if (!b) return;
      if (c.index === -1 && b.advance >= 0) {
        refund(p, EPOCHS[p.epoch + 1].cost);
        b.advance = -1;
        return;
      }
      const item = b.queue[c.index];
      if (!item) return;
      refund(p, item.paid);
      b.queue.splice(c.index, 1);
      break;
    }
    case 'advance': {
      const b = myBuilding(s, c.p, c.building);
      if (!b || !b.built || b.type !== 'towncenter') return;
      if (p.epoch >= LAST_EPOCH) return;
      if (s.ents.some((e) => e.kind === 'building' && e.owner === c.p && e.advance >= 0)) return refuse(s, c.p, 'Already advancing');
      const cost = EPOCHS[p.epoch + 1].cost;
      const short = shortfall(p, cost);
      if (short) return refuse(s, c.p, short);
      pay(p, cost);
      b.advance = 0;
      break;
    }
    case 'rally': {
      const b = myBuilding(s, c.p, c.building);
      if (!b) return;
      const tx = Math.floor(c.x);
      const ty = Math.floor(c.y);
      const tile = tx >= 0 && ty >= 0 && tx < s.w && ty < s.h && s.res[ty * s.w + tx] !== R_NONE ? ty * s.w + tx : -1;
      b.rally = { x: c.x, y: c.y, tile };
      break;
    }
    case 'stop':
      for (const u of myUnits(s, c.p, c.ids)) setOrder(u, { k: 'idle' });
      break;
    case 'delete':
      for (const id of c.ids) {
        const e = s.byId.get(id);
        if (!e || e.owner !== c.p || e.hp <= 0) continue;
        if (e.kind === 'building' && !e.built && e.progress === 0) refund(p, BUILDINGS[e.type].cost);
        e.hp = 0;
      }
      break;
    case 'resign':
      for (const e of s.ents) if (e.owner === c.p) e.hp = 0;
      break;
  }
}

/** Whether a spot is somewhere a unit could stand (for rally points and moves). */
export const standable = (s: GameState, x: number, y: number) => walkable(s, Math.floor(x), Math.floor(y));
