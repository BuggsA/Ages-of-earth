import { BUILDINGS, EPOCHS, MARKET, RES_LABEL, TECHS, UNITS, domainOf, stepBackCost, unitEpoch, unitStats } from './data';
import { peace } from './combat';
import { placeProblem, stampBuilding, walkable } from './grid';
import { buildingCostFor, techCostFor, techProblem, trainCostFor } from './stats';
import { backProblem, backTo, barred, journeyOf, roadProblem, roadTo, trainsAt } from './ages';
import type { Building, BuildingType, Command, Cost, GameState, Order, Player, Unit } from './types';
import { RES, R_FISH, R_NONE } from './types';
import { RES_OF_TILE, cargoRoom, freeFarm, garrisonRoom, giveOrder, landing, setOrder, ungarrison } from './units';
import { carriedBy, letGo, relicAt } from './relics';
import { homeMarket, marketOf, postAt } from './trade';
import { canHit, isEnemy, maxHp, pay, placeBuilding, refund } from './world';

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
    if (e && e.kind === 'unit' && e.owner === p && e.hp > 0 && !e.inside) out.push(e);
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

/** The tiles of a wall line from one tile to another: straight steps that never cut a corner. */
export function wallLine(x0: number, y0: number, x1: number, y1: number, max = 40): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x1 > x0 ? 1 : -1;
  const sy = y1 > y0 ? 1 : -1;
  let err = dx - dy;
  out.push({ x, y });
  while ((x !== x1 || y !== y1) && out.length < max) {
    // One axis at a time, so the wall is unbroken.
    if (err * 2 > -dy && x !== x1) {
      err -= dy;
      x += sx;
    } else {
      err += dx;
      y += sy;
    }
    out.push({ x, y });
  }
  return out;
}

/** Place a building site for a player if it fits and they can pay. */
function placeSite(s: GameState, p: number, type: BuildingType, tx: number, ty: number, quiet = false): Building | null {
  const def = BUILDINGS[type];
  const player = s.players[p];
  if (def.epoch > player.epoch) {
    if (!quiet) refuse(s, p, `Needs the ${EPOCHS[def.epoch].name}`);
    return null;
  }
  const problem = placeProblem(s, type, tx, ty, true, p);
  if (problem) {
    if (!quiet) refuse(s, p, problem === 'slope' ? 'Too steep to build there' : "Can't build there");
    return null;
  }
  const cost = buildingCostFor(s, p, type);
  const short = shortfall(player, cost);
  if (short) {
    if (!quiet) refuse(s, p, short);
    return null;
  }
  pay(player, cost);
  if (type === 'gate') {
    // Wall pieces under a new gate come down to make way for it.
    const gone = new Set<number>();
    for (let y = ty; y < ty + def.size; y++) for (let x = tx; x < tx + def.size; x++) if (s.bldAt[y * s.w + x]) gone.add(s.bldAt[y * s.w + x]);
    for (const id of gone) {
      const w = s.byId.get(id)!;
      if (w.kind !== 'building') continue;
      stampBuilding(s, w, false);
      s.byId.delete(id);
    }
    if (gone.size) s.ents = s.ents.filter((e) => !gone.has(e.id));
  }
  const b = placeBuilding(s, p, type, tx, ty, false);
  s.events.push({ k: 'placed', id: b.id, owner: p, type });
  return b;
}

/** Send citizens to build, remembering the work they were doing to go back to it after. */
function assignBuilders(units: Unit[], b: Building, queue: boolean): void {
  for (const u of units) {
    if (u.type !== 'citizen') continue;
    const o = u.order;
    const back: Order | null = o.k === 'gather' ? { ...o, phase: 'go' } : o.k === 'farm' ? { ...o, phase: 'go' } : o.k === 'build' ? u.resume : null;
    giveOrder(u, { k: 'build', target: b.id }, queue);
    if (!queue || u.order.k === 'build') u.resume = back ?? u.resume;
  }
}

export function applyCommand(s: GameState, c: Command): void {
  const p = s.players[c.p];
  if (!p || p.defeated || s.over) return;
  switch (c.t) {
    case 'move': {
      const units = myUnits(s, c.p, c.ids);
      // Soldiers, ships and aircraft each keep their own formation.
      for (const dom of ['land', 'water', 'air'] as const) {
        const group = units.filter((u) => domainOf(u.type) === dom);
        if (!group.length) continue;
        for (const spot of formation(s, group, c.x, c.y)) {
          giveOrder(spot.u, { k: 'move', x: spot.x, y: spot.y, amove: !!c.amove && !peace(s), started: false }, c.queue);
        }
      }
      break;
    }
    case 'attack': {
      const t = s.byId.get(c.target);
      if (!t || t.hp <= 0 || (t.kind === 'unit' && t.inside)) return;
      const units = myUnits(s, c.p, c.ids);
      if (!isEnemy(s, c.p, t.owner)) {
        // Not a foe: just walk over there.
        applyCommand(s, { t: 'move', p: c.p, ids: units.map((u) => u.id), x: t.x, y: t.y, queue: c.queue });
        return;
      }
      if (peace(s)) return refuse(s, c.p, `The peace treaty holds for ${Math.ceil((s.peaceUntil - s.tick) / 20)} more seconds`);
      for (const u of units) {
        if (u.type === 'priest') {
          if (t.kind === 'unit' && domainOf(t.type) === 'land' && !carriedBy(s, u)) giveOrder(u, { k: 'convert', target: t.id, done: 0 }, c.queue);
          continue;
        }
        // Swords can't reach a ship or an aircraft, nor a ram a soldier.
        if (!canHit(s, u, t)) continue;
        giveOrder(u, { k: 'attack', target: t.id, auto: false, then: null }, c.queue);
      }
      break;
    }
    case 'gather': {
      const kind = s.res[c.tile];
      if (c.tile < 0 || c.tile >= s.w * s.h || kind === R_NONE) return;
      const units = myUnits(s, c.p, c.ids);
      // Citizens work the land; fishing boats fish.
      const workers = units.filter((u) => (kind === R_FISH ? u.type === 'fisher' : u.type === 'citizen'));
      for (const u of workers) giveOrder(u, { k: 'gather', tile: c.tile, res: RES_OF_TILE[kind], phase: 'go' }, c.queue);
      const others = units.filter((u) => !workers.includes(u));
      if (others.length) applyCommand(s, { t: 'move', p: c.p, ids: others.map((u) => u.id), x: (c.tile % s.w) + 0.5, y: Math.floor(c.tile / s.w) + 0.5, queue: c.queue });
      break;
    }
    case 'hunt': {
      const a = s.animals.find((x) => x.id === c.target);
      if (!a) return;
      const units = myUnits(s, c.p, c.ids);
      for (const u of units.filter((x) => x.type === 'citizen')) giveOrder(u, { k: 'hunt', target: a.id }, c.queue);
      const others = units.filter((u) => u.type !== 'citizen');
      if (others.length) applyCommand(s, { t: 'move', p: c.p, ids: others.map((u) => u.id), x: a.x, y: a.y, queue: c.queue });
      break;
    }
    case 'convert': {
      const t = s.byId.get(c.target);
      if (!t || t.kind !== 'unit' || !isEnemy(s, c.p, t.owner)) return;
      if (peace(s)) return refuse(s, c.p, 'Not while the peace treaty holds');
      for (const u of myUnits(s, c.p, c.ids)) if (u.type === 'priest' && !carriedBy(s, u)) giveOrder(u, { k: 'convert', target: t.id, done: 0 }, c.queue);
      break;
    }
    case 'relic': {
      const r = relicAt(s, c.target);
      if (!r || r.temple || r.carrier) return;
      const units = myUnits(s, c.p, c.ids);
      // The nearest priest with free hands goes for it; the others walk over with them.
      let best: Unit | null = null;
      let bestD = Infinity;
      for (const u of units) {
        if (u.type !== 'priest' || carriedBy(s, u)) continue;
        const d = (u.x - r.x) * (u.x - r.x) + (u.y - r.y) * (u.y - r.y);
        if (d < bestD) {
          bestD = d;
          best = u;
        }
      }
      if (best) giveOrder(best, { k: 'relic', target: r.id, temple: 0 }, c.queue);
      else if (units.some((u) => u.type === 'priest')) refuse(s, c.p, 'Only a priest with free hands can carry a relic');
      const others = units.filter((u) => u !== best);
      if (others.length) applyCommand(s, { t: 'move', p: c.p, ids: others.map((u) => u.id), x: r.x, y: r.y, queue: c.queue });
      break;
    }
    case 'route': {
      const post = postAt(s, c.post);
      if (!post) return;
      const units = myUnits(s, c.p, c.ids);
      const traders = units.filter((u) => u.type === 'trader');
      if (traders.length && !homeMarket(s, c.p, post.x, post.y)) refuse(s, c.p, 'Build a Market to trade from');
      else {
        for (const u of traders) {
          // Each trades from the Market nearest it; one already carrying gold takes it home first.
          const m = (u.order.k === 'trade' ? marketOf(s, c.p, u.order.market) : null) ?? homeMarket(s, c.p, u.x, u.y);
          giveOrder(u, { k: 'trade', post: post.id, market: m ? m.id : 0, phase: u.carry > 0 ? 'back' : 'go' }, c.queue);
        }
      }
      const others = units.filter((u) => u.type !== 'trader');
      if (others.length) applyCommand(s, { t: 'move', p: c.p, ids: others.map((u) => u.id), x: post.x, y: post.y, queue: c.queue });
      break;
    }
    case 'dropRelic':
      for (const u of myUnits(s, c.p, c.ids)) {
        const r = carriedBy(s, u);
        if (!r) continue;
        letGo(s, r, u.x, u.y, c.p);
        if (u.order.k === 'relic') setOrder(u, { k: 'idle' });
      }
      break;
    case 'work': {
      const b = myBuilding(s, c.p, c.target);
      if (!b) return;
      const units = myUnits(s, c.p, c.ids);
      let farmTaken = false;
      const shelters = !!BUILDINGS[b.type].garrison && b.built;
      const movers: Unit[] = [];
      for (const u of units) {
        // A priest bringing a relic home.
        const relic = u.type === 'priest' && b.type === 'temple' && b.built ? carriedBy(s, u) : undefined;
        if (relic) {
          giveOrder(u, { k: 'relic', target: relic.id, temple: b.id }, c.queue);
          continue;
        }
        // A trader: home to this Market (with what it carries), and its road starts here from now on.
        if (u.type === 'trader' && b.type === 'market' && b.built) {
          const post = u.order.k === 'trade' ? u.order.post : 0;
          if (u.carry > 0 || post) {
            giveOrder(u, { k: 'trade', post, market: b.id, phase: u.carry > 0 ? 'back' : 'go' }, c.queue);
            continue;
          }
        }
        if (u.type === 'fisher' && b.type === 'dock' && b.built && u.carry > 0) {
          giveOrder(u, { k: 'deliver' }, c.queue);
          continue;
        }
        if (u.type === 'citizen') {
          if (!b.built || b.hp < maxHp(s, b)) {
            assignBuilders([u], b, !!c.queue);
            continue;
          }
          if (b.type === 'farm') {
            // One farmer per field; the rest look for free fields nearby.
            const field = farmTaken ? freeFarm(s, c.p, b.x, b.y, 12) : b;
            farmTaken = true;
            if (field) giveOrder(u, { k: 'farm', target: field.id, phase: 'go' }, c.queue);
            continue;
          }
          if (BUILDINGS[b.type].drop.length && u.carry > 0) {
            giveOrder(u, { k: 'deliver' }, c.queue);
            continue;
          }
        }
        if (shelters && u.type !== 'siege' && domainOf(u.type) === 'land' && garrisonRoom(b) > 0) giveOrder(u, { k: 'garrison', target: b.id }, c.queue);
        else movers.push(u);
      }
      if (movers.length) applyCommand(s, { t: 'move', p: c.p, ids: movers.map((u) => u.id), x: b.x, y: b.y + b.size / 2 + 1, queue: c.queue });
      break;
    }
    case 'garrison': {
      const b = myBuilding(s, c.p, c.target);
      if (!b || !b.built || !BUILDINGS[b.type].garrison) return;
      for (const u of myUnits(s, c.p, c.ids)) if (u.type !== 'siege' && domainOf(u.type) === 'land') giveOrder(u, { k: 'garrison', target: b.id }, c.queue);
      break;
    }
    case 'board': {
      const ship = s.byId.get(c.target);
      if (!ship || ship.kind !== 'unit' || ship.owner !== c.p || ship.type !== 'transport' || ship.hp <= 0) return;
      const riders = myUnits(s, c.p, c.ids).filter((u) => domainOf(u.type) === 'land');
      if (!riders.length) return;
      if (cargoRoom(s, ship) < riders.length) refuse(s, c.p, `Room aboard for ${Math.max(0, cargoRoom(s, ship))} more`);
      // They meet on the shore nearest them that the ship can sail to; an idle ship comes in to it.
      let cx = 0;
      let cy = 0;
      for (const u of riders) {
        cx += u.x;
        cy += u.y;
      }
      const meet = landing(s, ship, cx / riders.length, cy / riders.length, s.players[c.p].team) ?? undefined;
      for (const u of riders.slice(0, Math.max(0, cargoRoom(s, ship)))) giveOrder(u, { k: 'board', target: ship.id, meet }, c.queue);
      if (ship.order.k === 'idle' && meet) setOrder(ship, { k: 'move', x: meet.wx, y: meet.wy, amove: false, started: false });
      break;
    }
    case 'unload':
      for (const u of myUnits(s, c.p, c.ids)) if (u.type === 'transport' && u.cargo.length) giveOrder(u, { k: 'unload', x: c.x, y: c.y }, c.queue);
      break;
    case 'ungarrison': {
      const b = myBuilding(s, c.p, c.building);
      if (b) ungarrison(s, b);
      break;
    }
    case 'bell': {
      if (c.ring) {
        // Every citizen to the nearest shelter with room, remembering their work.
        const shelters = s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === c.p && e.built && e.hp > 0 && !!BUILDINGS[e.type].garrison);
        const room = new Map(shelters.map((b) => [b.id, garrisonRoom(b)]));
        for (const u of s.ents) {
          if (u.kind !== 'unit' || u.owner !== c.p || u.type !== 'citizen' || u.inside || u.hp <= 0) continue;
          let best: Building | null = null;
          let bestD = 40 * 40;
          for (const b of shelters) {
            if ((room.get(b.id) ?? 0) <= 0) continue;
            const dx = b.x - u.x;
            const dy = b.y - u.y;
            const d = dx * dx + dy * dy;
            if (d < bestD) {
              bestD = d;
              best = b;
            }
          }
          if (!best) continue;
          room.set(best.id, room.get(best.id)! - 1);
          const o = u.order;
          u.resume = o.k === 'gather' || o.k === 'farm' ? { ...o, phase: 'go' } : o.k === 'build' ? o : null;
          u.queue = [];
          setOrder(u, { k: 'garrison', target: best.id });
        }
      } else {
        for (const e of s.ents) if (e.kind === 'building' && e.owner === c.p && e.garrison.length) ungarrison(s, e);
        // Those still on their way go back to work too.
        for (const u of s.ents) {
          if (u.kind !== 'unit' || u.owner !== c.p || u.order.k !== 'garrison' || !u.resume) continue;
          const back = u.resume;
          u.resume = null;
          setOrder(u, back);
        }
      }
      s.events.push({ k: 'bell', owner: c.p, ring: c.ring });
      break;
    }
    case 'stance':
      for (const u of myUnits(s, c.p, c.ids)) {
        u.stance = c.stance;
        u.guardX = u.x;
        u.guardY = u.y;
      }
      break;
    case 'build': {
      if (c.type === 'wall') return applyCommand(s, { t: 'wall', p: c.p, ids: c.ids, x0: c.tx, y0: c.ty, x1: c.tx, y1: c.ty, queue: c.queue });
      const b = placeSite(s, c.p, c.type, c.tx, c.ty);
      if (!b) return;
      if (c.type === 'gate') {
        // Gates face along the wall they sit in.
        const w = s.bldAt[c.ty * s.w + c.tx - 1] || s.bldAt[c.ty * s.w + c.tx + 2];
        b.dir = w ? 0 : 1;
      }
      assignBuilders(myUnits(s, c.p, c.ids), b, !!c.queue);
      break;
    }
    case 'wall': {
      const tiles = wallLine(c.x0, c.y0, c.x1, c.y1);
      const placed: Building[] = [];
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        if (placeProblem(s, 'wall', t.x, t.y)) continue;
        const b = placeSite(s, c.p, 'wall', t.x, t.y, placed.length > 0);
        if (!b) break;
        // Which way the line runs here, for the model.
        const next = tiles[i + 1] ?? tiles[i - 1];
        b.dir = next && next.y !== t.y ? 1 : 0;
        placed.push(b);
      }
      if (!placed.length) return;
      const units = myUnits(s, c.p, c.ids);
      // Builders start from the near end.
      assignBuilders(units, placed[0], !!c.queue);
      break;
    }
    case 'train': {
      const b = myBuilding(s, c.p, c.building);
      if (!b || !b.built) return;
      if (!trainsAt(p, b.type).includes(c.unit) || !UNITS[c.unit]) return;
      if (unitEpoch(c.unit) > p.epoch) return refuse(s, c.p, `Needs the ${EPOCHS[unitEpoch(c.unit)].name}`);
      const no = barred(p, c.unit);
      if (no) return refuse(s, c.p, no);
      if (b.queue.length >= MAX_QUEUE) return refuse(s, c.p, 'The queue is full');
      if (c.unit === 'hero' && heroBusy(s, c.p)) return refuse(s, c.p, 'You can lead with one hero at a time');
      const cost = trainCostFor(s, c.p, c.unit, b.type);
      const short = shortfall(p, cost);
      if (short) return refuse(s, c.p, short);
      pay(p, cost);
      b.queue.push({ unit: c.unit, done: 0, paid: { ...cost } });
      break;
    }
    case 'research': {
      const b = myBuilding(s, c.p, c.building);
      const t = TECHS[c.tech];
      if (!b || !b.built || !t || t.at !== b.type) return;
      const problem = techProblem(s, c.p, c.tech);
      if (problem) return refuse(s, c.p, problem);
      if (b.queue.length >= MAX_QUEUE) return refuse(s, c.p, 'The queue is full');
      const cost = techCostFor(s, c.p, c.tech);
      const short = shortfall(p, cost);
      if (short) return refuse(s, c.p, short);
      pay(p, cost);
      b.queue.push({ tech: c.tech, done: 0, paid: { ...cost } });
      break;
    }
    case 'cancel': {
      const b = myBuilding(s, c.p, c.building);
      if (!b) return;
      if (c.index === -1 && b.advance >= 0) {
        const road = journeyOf(p, b);
        if (road) refund(p, road.cost);
        b.advance = -1;
        delete b.advanceTo;
        delete b.back;
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
      const road = roadTo(p, c.to);
      if (!road) return;
      if (s.ents.some((e) => e.kind === 'building' && e.owner === c.p && e.advance >= 0)) return refuse(s, c.p, 'Already advancing');
      const problem = roadProblem(s, p, road);
      if (problem) return refuse(s, c.p, problem);
      const cost = road.cost;
      const short = shortfall(p, cost);
      if (short) return refuse(s, c.p, short);
      pay(p, cost);
      b.advance = 0;
      // Without a target the Town Center follows the main road, and saves as it always has.
      if (c.to) b.advanceTo = road.to;
      break;
    }
    case 'stepBack': {
      const b = myBuilding(s, c.p, c.building);
      if (!b || !b.built || b.type !== 'towncenter' || !backTo(p)) return;
      if (s.ents.some((e) => e.kind === 'building' && e.owner === c.p && e.advance >= 0)) return refuse(s, c.p, 'Already advancing');
      const problem = backProblem(s, p);
      if (problem) return refuse(s, c.p, problem);
      const cost = stepBackCost(p.epoch);
      const short = shortfall(p, cost);
      if (short) return refuse(s, c.p, short);
      pay(p, cost);
      b.advance = 0;
      b.back = true;
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
    case 'trade': {
      if (!s.ents.some((e) => e.kind === 'building' && e.owner === c.p && e.type === 'market' && e.built && e.hp > 0)) return refuse(s, c.p, 'Needs a Market');
      const price = s.market[c.res];
      if (c.buy) {
        if (p.res.gold < price) return refuse(s, c.p, `Need ${Math.ceil(price - p.res.gold)} more gold`);
        p.res.gold -= price;
        p.res[c.res] += MARKET.lot;
        s.market[c.res] = Math.min(MARKET.max, price + MARKET.step);
      } else {
        if (p.res[c.res] < MARKET.lot) return refuse(s, c.p, `Need ${MARKET.lot} ${RES_LABEL[c.res].toLowerCase()} to sell`);
        p.res[c.res] -= MARKET.lot;
        p.res.gold += Math.floor(price * MARKET.sellRate);
        s.market[c.res] = Math.max(MARKET.min, price - MARKET.step);
      }
      s.events.push({ k: 'trade', owner: c.p, res: c.res, buy: c.buy });
      break;
    }
    case 'stop':
      for (const u of myUnits(s, c.p, c.ids)) {
        u.queue = [];
        setOrder(u, { k: 'idle' });
      }
      break;
    case 'delete':
      for (const id of c.ids) {
        const e = s.byId.get(id);
        if (!e || e.owner !== c.p || e.hp <= 0) continue;
        if (e.kind === 'building' && !e.built && e.progress === 0) refund(p, buildingCostFor(s, c.p, e.type));
        e.hp = 0;
      }
      break;
    case 'resign':
      for (const e of s.ents) if (e.owner === c.p) e.hp = 0;
      break;
    case 'leave':
      if (!p.ai && !p.defeated) {
        p.ai = 'normal';
        s.events.push({ k: 'left', owner: c.p });
      }
      break;
  }
}

/** Whether a player already has a hero, alive or in training. */
export function heroBusy(s: GameState, p: number): boolean {
  return s.ents.some((e) => e.owner === p && ((e.kind === 'unit' && e.type === 'hero' && e.hp > 0 && !s.kings.includes(e.id)) || (e.kind === 'building' && e.queue.some((q) => q.unit === 'hero'))));
}

/** Whether a spot is somewhere a unit could stand (for rally points and moves). */
export const standable = (s: GameState, x: number, y: number) => walkable(s, Math.floor(x), Math.floor(y));
