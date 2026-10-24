import { AUTO_WORK, BUILDINGS, EPOCHS, MARKET, ORE_TRADE, RARE, PATROL, RES_LABEL, RIVERS, SNARE, HIVE, SPREAD, TECHS, TOWER_LEVELS, UNITS, WAYS, domainOf, stepBackCost, unitEpoch, unitStats } from './data';
import { peace } from './combat';
import { findSpot } from './ai';
import { placeProblem, stampBuilding, walkable } from './grid';
import { buildingCostFor, raiseProblem, techCostFor, techProblem, trainCostFor } from './stats';
import { packCamp, packProblem, pitchCamp, pitchProblem } from './steppe';
import { lambProblem, raiseLamb } from './flocks';
import { backProblem, backTo, barred, buildBarred, canRaise, chooseKeepsake, journeyOf, keepsakeProblem, roadProblem, roadTo, trainsAt } from './ages';
import type { Building, BuildingType, Command, Ent, Cost, GameState, Order, Player, Res, Unit } from './types';
import { RES, R_FISH, R_MEAT, R_NONE } from './types';
import { resOfSeam, seamOf, seamProblem } from './shafts';
import { RES_OF_TILE, cargoRoom, findResource, freeFarm, freeShaft, garrisonRoom, giveOrder, landing, setOrder, ungarrison } from './units';
import { carriedBy, letGo, relicAt } from './relics';
import { caravanOf, dockOf, homeMarket, marketOf, nearestCaravan, nearestDock, portSpot, postAt } from './trade';
import { ruinAt } from './ruins';
import { rubbleAt, salvages } from './salvage';
import { cacheAt } from './caches';
import { carriesKegs, kegProblem } from './powder';
import { carriesTorch, onFire, torchProblem } from './fire';
import { launch, launchProblem } from './silo';
import { raise, raiseCost } from './reclaim';
import { callWork, workProblem } from './works';
import { callKin, killCamp, kinProblem, takeVow, takeWay, vowProblem, wayBarred, wayProblem } from './ways';
import { beaconProblem, lightBeacon } from './beacon';
import { callUp, callUpProblem } from './warcamp';
import { arm, armProblem, disarm, disarmProblem } from './polis';
import { citizenProblem, legionKind, legionary } from './legion';
import { mineable } from './household';
import { reassign } from './labor';
import { bloodOf, bloodShort, levy, levyProblem, sworn } from './blood';
import { riteProblem } from './fork';
import { rallyCry, rallyProblem } from './rally';
import { chantedOver, consecrateProblem, consecrates } from './consecrate';
import { sees } from './vision';
import { canHit, isEnemy, maxHp, pay, placeBuilding, refund } from './world';
import { fightsBeasts } from './animals';
import { tameProblem } from './tame';
import { isField } from './grove';
import { answerTiding, tidingProblem } from './tidings';

/**
 * Everything a player can do, as plain data. A person's clicks and the computer opponent both go
 * through here, and each command is checked (it must be your unit, you must afford it) before it
 * changes anything, so the same list of commands always plays out the same way.
 */

export const MAX_QUEUE = 6;

function refuse(s: GameState, p: number, why: string): void {
  s.events.push({ k: 'refused', owner: p, why });
}

/** Every resource short of a cost, with how much, in the usual order. */
export function shortages(p: Player, cost: Cost): { res: Res; need: number }[] {
  const out: { res: Res; need: number }[] = [];
  for (const r of RES) {
    const need = Math.ceil((cost[r] ?? 0) - p.res[r]);
    if (need > 0) out.push({ res: r, need });
  }
  return out;
}

/** What's missing to pay a cost, in words ("Need 40 more wood"), or null when it can be paid. */
export function shortfall(p: Player, cost: Cost): string | null {
  for (const r of RES) {
    const need = (cost[r] ?? 0) - p.res[r];
    if (need > 0) return `Need ${Math.ceil(need)} more ${RES_LABEL[r].toLowerCase()}`;
  }
  return null;
}

/** Guard a trading post's road (#454 s3): the units go back and forth between the nearest Market and the post. */
function guardRoad(s: GameState, owner: number, all: Unit[], postId: number, queue?: boolean): void {
  const post = postAt(s, postId);
  if (!post) return;
  const market = homeMarket(s, owner, post.x, post.y);
  if (!market) return refuse(s, owner, 'Build a Market first: the road runs from it');
  for (const dom of ['land', 'water', 'air'] as const) {
    const group = all.filter((u) => u.type !== 'wagon' && domainOf(u.type) === dom);
    if (!group.length) continue;
    const end = dom === 'water' ? portSpot(s, post, owner) : { x: post.x, y: post.y };
    if (!end) {
      refuse(s, owner, 'That post has no harbour');
      continue;
    }
    for (const u of group) giveOrder(u, { k: 'patrol', pts: [{ x: market.x, y: market.y }, end], i: 1, started: false, miss: 0 }, queue);
  }
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
  const no = buildBarred(player, type) ?? wayBarred(s, player, type);
  if (no) {
    if (!quiet) refuse(s, p, no);
    return null;
  }
  const problem = placeProblem(s, type, tx, ty, true, p);
  if (problem) {
    if (!quiet) refuse(s, p, problem === 'slope' ? 'Too steep to build there' : problem === 'foreign' ? "That's enemy land: only a Tower can be raised there" : problem === 'woods' ? `A snare needs ${SNARE.need} trees standing within ${SNARE.r} tiles` : problem === 'snares' ? `Too near another snare: keep them ${SNARE.apart} tiles apart` : problem === 'parched' ? `In the Age of Rivers a Farm is laid only by water: within ${RIVERS.wet} tiles of a channel, spring, lake or shore` : problem === 'bare' ? `A Hive needs ${HIVE.trees} trees standing within ${SNARE.r} tiles` : problem === 'hives' ? `Too near another Hive: keep them ${HIVE.apart} tiles apart` : "Can't build there");
    return null;
  }
  const cost = raiseCost(s, p, type, tx, ty);
  const short = shortfall(player, cost) ?? bloodShort(player, type);
  if (short) {
    if (!quiet) refuse(s, p, short);
    return null;
  }
  pay(player, cost);
  // The Blood Tower (#355 s3) is paid for once in blood too.
  if (def.blood) player.blood = bloodOf(player) - def.blood;
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
  const free = killCamp(s, p, type, tx, ty);
  const b = placeBuilding(s, p, type, tx, ty, false);
  if (free) b.kill = true;
  raise(s, b);
  s.events.push({ k: 'placed', id: b.id, owner: p, type });
  if (type === 'wonder') s.events.push({ k: 'wonderRising', owner: p, id: b.id, x: b.x, y: b.y });
  return b;
}

/** Send citizens to build, remembering the work they were doing to go back to it after. */
function assignBuilders(s: GameState, units: Unit[], b: Building, queue: boolean): void {
  for (const u of units) {
    if (u.thrall || !canRaise(u.type, b.type, s.players[u.owner].civ)) continue;
    const o = u.order;
    const back: Order | null = o.k === 'gather' ? { ...o, phase: 'go' } : o.k === 'farm' || o.k === 'snare' || o.k === 'shaft' ? { ...o, phase: 'go' } : o.k === 'build' ? u.resume : null;
    giveOrder(u, { k: 'build', target: b.id }, queue);
    if (!queue || u.order.k === 'build') u.resume = back ?? u.resume;
  }
}

/** The clicked node first, then others of its kind within `SPREAD.reach` tiles, nearest first. */
function nodesNear(s: GameState, tile: number, kind: number): number[] {
  const cx = (tile % s.w) + 0.5;
  const cy = Math.floor(tile / s.w) + 0.5;
  const out: { i: number; d: number }[] = [];
  const r = SPREAD.reach;
  for (let y = Math.max(0, Math.floor(cy) - r); y <= Math.min(s.h - 1, Math.floor(cy) + r); y++) {
    for (let x = Math.max(0, Math.floor(cx) - r); x <= Math.min(s.w - 1, Math.floor(cx) + r); x++) {
      const i = y * s.w + x;
      if (i === tile || s.res[i] !== kind || s.amount[i] <= 0) continue;
      // Skip nodes walled in on every side: findResource only returns open ones.
      if (findResource(s, kind, x + 0.5, y + 0.5, 0) !== i) continue;
      out.push({ i, d: (x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy) });
    }
  }
  out.sort((a, b) => a.d - b.d || a.i - b.i);
  return [tile, ...out.map((o) => o.i)];
}

/** Foes the player can see near the clicked one, nearest first (units only, in id order for ties). */
function foesNear(s: GameState, p: number, t: Ent): Unit[] {
  const out: { u: Unit; d: number }[] = [];
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.id === t.id || e.hp <= 0 || e.inside || !isEnemy(s, p, e.owner)) continue;
    const d = (e.x - t.x) * (e.x - t.x) + (e.y - t.y) * (e.y - t.y);
    if (d > SPREAD.foe * SPREAD.foe || !sees(s, p, e.x, e.y)) continue;
    out.push({ u: e, d });
  }
  out.sort((a, b) => a.d - b.d || a.u.id - b.u.id);
  return out.map((o) => o.u);
}

/** The clicked foe takes `perFoe` attackers, then the next nearest each take their share; extras pile on the clicked one. */
function spreadFoe(s: GameState, u: Unit, t: Ent, foes: Unit[], load: Map<number, number>): number {
  let pick = t;
  if ((load.get(t.id) ?? 0) >= SPREAD.perFoe) for (const f of foes) if ((load.get(f.id) ?? 0) < SPREAD.perFoe && canHit(s, u, f)) { pick = f; break; }
  load.set(pick.id, (load.get(pick.id) ?? 0) + 1);
  return pick.id;
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
      const foes = c.spread && t.kind === 'unit' && units.length > 1 ? foesNear(s, c.p, t) : [];
      const load = new Map<number, number>();
      for (const u of units) {
        if (u.type === 'priest') {
          if (t.kind === 'unit' && domainOf(t.type) === 'land' && !carriedBy(s, u)) giveOrder(u, { k: 'convert', target: t.id, done: 0 }, c.queue);
          // A pilgrim people's priests chant a building over (#209).
          else if (t.kind === 'building' && !consecrateProblem(s, c.p, t) && !carriedBy(s, u)) giveOrder(u, { k: 'convert', target: t.id, done: 0 }, c.queue);
          continue;
        }
        // Swords can't reach a ship or an aircraft, nor a ram a soldier.
        if (!canHit(s, u, t)) continue;
        giveOrder(u, { k: 'attack', target: spreadFoe(s, u, t, foes, load), auto: false, then: null }, c.queue);
      }
      break;
    }
    case 'gather': {
      const kind = s.res[c.tile];
      if (c.tile < 0 || c.tile >= s.w * s.h || kind === R_NONE) return;
      const units = myUnits(s, c.p, c.ids);
      // Citizens work the land; fishing boats fish.
      const workers = units.filter((u) => (kind === R_FISH ? u.type === 'fisher' : (u.type === 'citizen' && mineable(s.players[u.owner], kind)) || (legionary(s, u) && legionKind(kind))));
      const nodes = c.spread && kind !== R_MEAT && workers.length > 1 ? nodesNear(s, c.tile, kind) : [c.tile];
      const load = new Map<number, number>();
      for (const u of workers) {
        // The first node with room; when every node is full, the least crowded one (not the clicked one, again).
        let tile = nodes.find((n) => (load.get(n) ?? 0) < SPREAD.perNode) ?? nodes.reduce((a, n) => ((load.get(n) ?? 0) < (load.get(a) ?? 0) ? n : a), nodes[0]);
        load.set(tile, (load.get(tile) ?? 0) + 1);
        giveOrder(u, { k: 'gather', tile, res: RES_OF_TILE[kind], phase: 'go' }, c.queue);
      }
      const others = units.filter((u) => !workers.includes(u));
      if (others.length) applyCommand(s, { t: 'move', p: c.p, ids: others.map((u) => u.id), x: (c.tile % s.w) + 0.5, y: Math.floor(c.tile / s.w) + 0.5, queue: c.queue });
      break;
    }
    case 'reassign': {
      const r = reassign(s, c.p, c.from, c.to, c.n);
      // Hands sent for food where there is no bush, field, snare or ewe lay a field and raise it, rather than being refused (#344).
      let laid = 0;
      // Not while a field of theirs is still going up: another press waits for it rather than laying more.
      const raising = s.ents.some((e) => e.kind === 'building' && e.owner === c.p && e.type === 'farm' && !e.built && e.hp > 0);
      const ask = raising ? [] : r.stuck.slice(0, Math.min(AUTO_WORK.lay, Math.max(0, Math.floor(c.n)) - r.moved));
      for (const u of ask) {
        const spot = findSpot(s, 'farm', u.x, u.y, 2, AUTO_WORK.farm);
        const b = spot && placeSite(s, c.p, 'farm', spot.tx, spot.ty, laid > 0);
        if (!b) break;
        assignBuilders(s, [u], b, false);
        laid++;
      }
      if (r.why && !laid) refuse(s, c.p, r.why);
      else if (r.why && laid < ask.length) refuse(s, c.p, `Laid ${laid} ${laid === 1 ? 'field' : 'fields'}; ${r.why.toLowerCase()}`);
      break;
    }
    case 'hunt': {
      const a = s.animals.find((x) => x.id === c.target);
      if (!a) return;
      // A flock (#308): your own is slaughtered, a rival's raided; an ally's is left alone.
      if (a.owner !== undefined && a.owner !== c.p) {
        if (!isEnemy(s, c.p, a.owner)) return refuse(s, c.p, "That flock is an ally's");
        if (peace(s)) return refuse(s, c.p, 'Not while the peace treaty holds');
      }
      const units = myUnits(s, c.p, c.ids);
      // Citizens hunt; soldiers on foot or horse (#171) can bring down a beast too.
      const hunters = units.filter((x) => fightsBeasts(x));
      for (const u of hunters) giveOrder(u, { k: 'hunt', target: a.id, fight: a.kind === 'wolf' || a.kind === 'raider' }, c.queue);
      const others = units.filter((u) => !hunters.includes(u));
      if (others.length) applyCommand(s, { t: 'move', p: c.p, ids: others.map((u) => u.id), x: a.x, y: a.y, queue: c.queue });
      break;
    }
    case 'convert': {
      const t = s.byId.get(c.target);
      if (!t || !isEnemy(s, c.p, t.owner)) return;
      if (peace(s)) return refuse(s, c.p, 'Not while the peace treaty holds');
      if (c.rite) {
        // The Blood-rite's two rites (#355 s4), worked on the living that bleed.
        const why = riteProblem(s, c.p, c.rite, t);
        if (why) return refuse(s, c.p, why);
      } else if (t.kind === 'building') {
        const why = consecrateProblem(s, c.p, t);
        if (why) return refuse(s, c.p, why);
      } else if (sworn(s, t)) return refuse(s, c.p, 'Sworn to a Military Order: its priest stands by it, and it cannot be turned');
      for (const u of myUnits(s, c.p, c.ids)) if (u.type === 'priest' && !carriedBy(s, u)) giveOrder(u, { k: 'convert', target: t.id, done: 0, ...(c.rite ? { rite: c.rite } : {}) }, c.queue);
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
      if (traders.length && c.buy && !post.sells?.includes(c.buy)) refuse(s, c.p, `This post sells no ${RARE[c.buy].name.toLowerCase()}`);
      else if (traders.length && !homeMarket(s, c.p, post.x, post.y) && !nearestCaravan(s, c.p, post.x, post.y)) refuse(s, c.p, 'Build a Market to trade from');
      else {
        for (const u of traders) {
          // Each trades from the Market nearest it (on the Silk Road, the one on its wagon too, #326); one already
          // carrying gold takes it home first, and a caravan keeps where its Market stood when it set out.
          const o = u.order.k === 'trade' ? u.order : null;
          const m = (o ? (marketOf(s, c.p, o.market) ?? caravanOf(s, c.p, o.market)) : null) ?? homeMarket(s, c.p, u.x, u.y) ?? nearestCaravan(s, c.p, u.x, u.y);
          // A trader told to buy rare ore (#573) pays for it at the post and carries it home instead of gold.
          const buy = c.buy ? { buy: c.buy } : {};
          const phase = u.carry > 0 || u.ore ? 'back' : 'go';
          giveOrder(u, o?.from ? { k: 'trade', post: post.id, market: m ? m.id : 0, phase, from: o.from, ...buy } : { k: 'trade', post: post.id, market: m ? m.id : 0, phase, ...buy }, c.queue);
        }
      }
      // Merchant ships sail to a port post from their nearest Dock.
      const cogs = units.filter((u) => u.type === 'cog');
      if (cogs.length && !portSpot(s, post, c.p)) refuse(s, c.p, 'No harbor near this trading post: merchant ships need water within a few tiles');
      else if (cogs.length && !nearestDock(s, c.p, post.x, post.y)) refuse(s, c.p, 'Build a Dock to trade by sea');
      else {
        for (const u of cogs) {
          const d = (u.order.k === 'trade' ? dockOf(s, c.p, u.order.market) : null) ?? nearestDock(s, c.p, u.x, u.y);
          giveOrder(u, { k: 'trade', post: post.id, market: d ? d.id : 0, phase: u.carry > 0 ? 'back' : 'go' }, c.queue);
        }
      }
      const others = units.filter((u) => u.type !== 'trader' && u.type !== 'cog');
      if (others.length) applyCommand(s, { t: 'move', p: c.p, ids: others.map((u) => u.id), x: post.x, y: post.y, queue: c.queue });
      break;
    }
    case 'salvage': {
      const r = rubbleAt(s, c.target);
      if (!r) return;
      const units = myUnits(s, c.p, c.ids);
      if (!salvages(s, c.p)) {
        if (units.some((u) => u.type === 'citizen')) refuse(s, c.p, 'Only a people of the Age of Reclaimers strips rubble');
      } else for (const u of units) if (u.type === 'citizen') giveOrder(u, { k: 'salvage', target: r.id }, c.queue);
      const others = units.filter((u) => u.type !== 'citizen');
      if (others.length) applyCommand(s, { t: 'move', p: c.p, ids: others.map((u) => u.id), x: r.x, y: r.y, queue: c.queue });
      break;
    }
    case 'cache': {
      // Any people's citizens may carry a cache home (#570); one already carrying ore takes that home first.
      const k = cacheAt(s, c.target);
      const units = myUnits(s, c.p, c.ids);
      const hands = units.filter((u) => u.type === 'citizen' && (k || u.ore));
      for (const u of hands) giveOrder(u, { k: 'cache', target: c.target }, c.queue);
      const others = units.filter((u) => u.type !== 'citizen');
      if (k && others.length) applyCommand(s, { t: 'move', p: c.p, ids: others.map((u) => u.id), x: k.x, y: k.y, queue: c.queue });
      break;
    }
    case 'launch': {
      // The Atomic Age (#605): a Missile Silo names a point; the warhead lands after its public countdown.
      const silo = s.byId.get(c.silo);
      const why = launchProblem(s, c.p, silo as Building | undefined, c.x, c.y);
      if (why) {
        refuse(s, c.p, why);
        return;
      }
      launch(s, c.p, silo as Building, c.x, c.y);
      break;
    }
    case 'keg': {
      // The Age of Sappers (#577): citizens and foot soldiers carry a keg each to the foot of a rival building.
      const why = kegProblem(s, c.p, s.byId.get(c.target));
      const units = myUnits(s, c.p, c.ids).filter(carriesKegs);
      if (!units.length) return;
      if (why) {
        refuse(s, c.p, why);
        return;
      }
      for (const u of units) giveOrder(u, { k: 'keg', target: c.target }, c.queue);
      break;
    }
    case 'torch': {
      // Fire (`fire.ts`): citizens and foot soldiers carry torches to a tree, a root or a rival's living building.
      const at = c.target !== undefined ? { target: c.target } : { tile: c.tile };
      const units = myUnits(s, c.p, c.ids).filter(carriesTorch);
      if (!units.length) return;
      const why = torchProblem(s, c.p, at);
      if (why) {
        refuse(s, c.p, why);
        return;
      }
      for (const u of units) giveOrder(u, { k: 'torch', ...at }, c.queue);
      break;
    }
    case 'dig': {
      const r = ruinAt(s, c.target);
      if (!r) return;
      const units = myUnits(s, c.p, c.ids);
      if (r.by >= 0) {
        if (units.some((u) => u.type === 'citizen')) refuse(s, c.p, 'These ruins have been dug out already');
      } else for (const u of units) if (u.type === 'citizen') giveOrder(u, { k: 'dig', target: r.id }, c.queue);
      const others = units.filter((u) => u.type !== 'citizen');
      if (others.length) applyCommand(s, { t: 'move', p: c.p, ids: others.map((u) => u.id), x: r.x, y: r.y, queue: c.queue });
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
      const fieldsGiven = new Set<number>();
      const shelters = !!BUILDINGS[b.type].garrison && b.built;
      const movers: Unit[] = [];
      for (const u of units) {
        // A priest bringing a relic home.
        const relic = u.type === 'priest' && b.type === 'temple' && b.built ? carriedBy(s, u) : undefined;
        if (relic) {
          giveOrder(u, { k: 'relic', target: relic.id, temple: b.id }, c.queue);
          continue;
        }
        // A pilgrim priest stands by a building rivals are chanting over and sings back (#219).
        if (u.type === 'priest' && chantedOver(s, b) && consecrates(s, c.p) && !carriedBy(s, u)) {
          giveOrder(u, { k: 'answer', target: b.id }, c.queue);
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
        // A merchant ship: home to this Dock, and its sea road starts here from now on.
        if (u.type === 'cog' && b.type === 'dock' && b.built) {
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
        // Foot soldiers finish a War Camp they or others pitched (#303); a legion's raise and mend every building (#501).
        if (u.type !== 'citizen' && (!b.built || (legionary(s, u) && b.hp < maxHp(s, b))) && canRaise(u.type, b.type, p.civ)) {
          assignBuilders(s, [u], b, !!c.queue);
          continue;
        }
        if (u.type === 'citizen') {
          // A burning building is beaten out by those sent to mend it (`fire.ts`).
          if (!b.built || b.hp < maxHp(s, b) || onFire(s, b)) {
            assignBuilders(s, [u], b, !!c.queue);
            continue;
          }
          if (isField(b.type)) {
            // One farmer per field (a Kitchen Garden too); the rest look for free fields nearby.
            const field = fieldsGiven.size ? freeFarm(s, c.p, b.x, b.y, 12, fieldsGiven) : b;
            if (field) {
              fieldsGiven.add(field.id);
              giveOrder(u, { k: 'farm', target: field.id, phase: 'go' }, c.queue);
            }
            continue;
          }
          // A Mine Shaft (#681): one miner to a shaft; the rest look for free shafts nearby.
          if (b.type === 'shaft') {
            const pit = fieldsGiven.size ? freeShaft(s, c.p, b.x, b.y, 12, fieldsGiven) : b;
            const seam = pit && seamOf(s, pit);
            if (pit && seam) {
              fieldsGiven.add(pit.id);
              giveOrder(u, { k: 'shaft', target: pit.id, res: resOfSeam(seam), phase: 'go' }, c.queue);
            }
            continue;
          }
          // A snare (#485): walk the trap line from here.
          if (b.type === 'snare') {
            giveOrder(u, { k: 'snare', target: b.id, phase: 'go' }, c.queue);
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
      // A warband does not hide (#463 s1): its citizens never shelter.
      const hides = !(p.way && WAYS[p.way].noBell);
      for (const u of myUnits(s, c.p, c.ids)) if (u.type !== 'siege' && domainOf(u.type) === 'land' && (hides || u.type !== 'citizen')) giveOrder(u, { k: 'garrison', target: b.id }, c.queue);
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
      if (c.ring && p.way && WAYS[p.way].noBell) return refuse(s, c.p, `${WAYS[p.way].name} does not hide: the bell does not ring`);
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
          u.resume = o.k === 'gather' || o.k === 'farm' || o.k === 'snare' || o.k === 'shaft' ? { ...o, phase: 'go' } : o.k === 'build' ? o : null;
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
    case 'shepherd': {
      if (c.on) p.shepherd = true;
      else delete p.shepherd;
      break;
    }
    case 'flee': {
      if (!c.ids) {
        if (c.on) delete p.noFlee;
        else p.noFlee = true;
        break;
      }
      for (const u of myUnits(s, c.p, c.ids)) if (u.type === 'citizen') u.flee = c.on;
      break;
    }
    case 'seam': {
      const b = myBuilding(s, c.p, c.building);
      if (!b || b.type !== 'shaft') return;
      const why = seamProblem(s, b, c.seam);
      if (why) return refuse(s, c.p, why);
      b.seam = c.seam;
      break;
    }
    case 'beacon': {
      const b = s.byId.get(c.building);
      if (!b || b.kind !== 'building') return;
      const why = beaconProblem(s, p, b);
      if (why) return refuse(s, c.p, why);
      lightBeacon(s, p, b);
      break;
    }
    case 'callUp': {
      const b = myBuilding(s, c.p, c.building);
      if (!b) return;
      // At a Drain Rig the call is the levy (#355): the citizens near it give their blood.
      if (b.type === 'drainrig') {
        const no = levyProblem(s, p, b);
        if (no) return refuse(s, c.p, no);
        levy(s, p, b, c.n);
        break;
      }
      const why = callUpProblem(s, p, b);
      if (why) return refuse(s, c.p, why);
      callUp(s, p, b, c.n);
      break;
    }
    case 'pack': {
      const b = myBuilding(s, c.p, c.building);
      if (!b) return;
      const why = packProblem(s, p, b);
      if (why) return refuse(s, c.p, why);
      packCamp(s, b);
      break;
    }
    case 'milk': {
      const a = s.animals.find((x) => x.id === c.target);
      if (!a || a.kind !== 'sheep') return;
      if (a.owner !== c.p) return refuse(s, c.p, 'Only your own flock can be milked');
      if (a.lamb !== undefined) return refuse(s, c.p, 'A lamb gives no milk yet');
      const units = myUnits(s, c.p, c.ids);
      const milkers = units.filter((u) => u.type === 'citizen');
      for (const u of milkers) giveOrder(u, { k: 'milk', target: a.id, phase: 'go' }, c.queue);
      const others = units.filter((u) => !milkers.includes(u));
      if (others.length) applyCommand(s, { t: 'move', p: c.p, ids: others.map((u) => u.id), x: a.x, y: a.y, queue: c.queue });
      break;
    }
    case 'tame': {
      // The Age of the Wild: citizens sing a wild wolf, boar or mammoth calm and lead it home as a beast of war.
      const a = s.animals.find((x) => x.id === c.target);
      const why = tameProblem(s, p, a);
      if (why) return refuse(s, c.p, why);
      const units = myUnits(s, c.p, c.ids);
      const tamers = units.filter((u) => u.type === 'citizen');
      for (const u of tamers) giveOrder(u, { k: 'tame', target: a!.id, t: 0 }, c.queue);
      const others = units.filter((u) => !tamers.includes(u));
      if (others.length) applyCommand(s, { t: 'move', p: c.p, ids: others.map((u) => u.id), x: a!.x, y: a!.y, queue: c.queue });
      break;
    }
    case 'lamb': {
      const b = myBuilding(s, c.p, c.building);
      if (!b) return;
      const why = lambProblem(s, p, b);
      if (why) return refuse(s, c.p, why);
      raiseLamb(s, b);
      break;
    }
    case 'pitch': {
      const wagons = myUnits(s, c.p, c.ids).filter((u) => u.type === 'wagon');
      let why: string | null = null;
      for (const w of wagons) {
        why = pitchProblem(s, w);
        if (!why) pitchCamp(s, w);
      }
      if (why) refuse(s, c.p, why);
      break;
    }
    case 'cry': {
      const h = s.byId.get(c.id);
      if (!h || h.kind !== 'unit') return;
      const why = rallyProblem(s, p, h);
      if (why) return refuse(s, c.p, why);
      rallyCry(s, h);
      break;
    }
    case 'way': {
      const why = wayProblem(s, p, c.way);
      if (why) return refuse(s, c.p, why);
      takeWay(s, p, c.way);
      break;
    }
    case 'kin': {
      const b = myBuilding(s, c.p, c.building);
      if (!b) return;
      const why = kinProblem(p, b);
      if (why) return refuse(s, c.p, why);
      callKin(s, p, b);
      break;
    }
    case 'vow': {
      const why = vowProblem(s, p, c.way);
      if (why) return refuse(s, c.p, why);
      takeVow(s, p, c.way);
      break;
    }
    case 'tiding': {
      if (p.tiding?.card !== c.card) return;
      if (c.take) {
        const why = tidingProblem(s, p, c.card);
        if (why) return refuse(s, c.p, why);
      }
      answerTiding(s, p, c.card, c.take);
      break;
    }
    case 'greatWork': {
      const why = workProblem(s, p);
      if (why) return refuse(s, c.p, why);
      callWork(s, p);
      break;
    }
    case 'stance':
      for (const u of myUnits(s, c.p, c.ids)) {
        u.stance = c.stance;
        if (c.stance === 'run' && u.order.k === 'attack' && u.order.auto) setOrder(u, { k: 'idle' });
        u.guardX = u.x;
        u.guardY = u.y;
      }
      break;
    case 'build': {
      if (c.type === 'wall' || c.type === 'dyke' || c.type === 'thornwall' || c.type === 'channel') return applyCommand(s, { t: 'wall', p: c.p, ids: c.ids, x0: c.tx, y0: c.ty, x1: c.tx, y1: c.ty, queue: c.queue, dyke: c.type === 'dyke' || undefined, thorn: c.type === 'thornwall' || undefined, channel: c.type === 'channel' || undefined });
      const b = placeSite(s, c.p, c.type, c.tx, c.ty);
      if (!b) return;
      if (c.type === 'gate') {
        // Gates face along the wall they sit in.
        const w = s.bldAt[c.ty * s.w + c.tx - 1] || s.bldAt[c.ty * s.w + c.tx + 2];
        b.dir = w ? 0 : 1;
      }
      assignBuilders(s, myUnits(s, c.p, c.ids), b, !!c.queue);
      break;
    }
    case 'wall': {
      // A line of wall, or of dykes or a channel (#701) or Thornwall (the Age of the Grove), laid the same way.
      const type = c.dyke ? 'dyke' : c.thorn ? 'thornwall' : c.channel ? 'channel' : 'wall';
      const tiles = wallLine(c.x0, c.y0, c.x1, c.y1);
      const placed: Building[] = [];
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        if (placeProblem(s, type, t.x, t.y)) continue;
        const b = placeSite(s, c.p, type, t.x, t.y, placed.length > 0);
        if (!b) break;
        // Which way the line runs here, for the model.
        const next = tiles[i + 1] ?? tiles[i - 1];
        b.dir = next && next.y !== t.y ? 1 : 0;
        placed.push(b);
      }
      if (!placed.length) return;
      const units = myUnits(s, c.p, c.ids);
      // Builders start from the near end.
      assignBuilders(s, units, placed[0], !!c.queue);
      break;
    }
    case 'train': {
      const b = myBuilding(s, c.p, c.building);
      if (!b || !b.built) return;
      if (!trainsAt(p, b.type).includes(c.unit) || !UNITS[c.unit]) return;
      const struck = buildBarred(p, b.type);
      if (struck) return refuse(s, c.p, struck);
      if (unitEpoch(c.unit) > p.epoch) return refuse(s, c.p, `Needs the ${EPOCHS[unitEpoch(c.unit)].name}`);
      const no = barred(p, c.unit, b.type);
      if (no) return refuse(s, c.p, no);
      if (b.queue.length >= MAX_QUEUE) return refuse(s, c.p, 'The queue is full');
      if (c.unit === 'hero' && heroBusy(s, c.p)) return refuse(s, c.p, 'You can lead with one hero at a time');
      // The legion (#501): a Roman town keeps few citizens.
      const full = c.unit === 'citizen' ? citizenProblem(s, p) : null;
      if (full) return refuse(s, c.p, full);
      const cost = trainCostFor(s, c.p, c.unit, b.type, b);
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
    case 'raiseTower': {
      const b = myBuilding(s, c.p, c.building);
      if (!b) return;
      const problem = raiseProblem(s, c.p, b);
      if (problem) return refuse(s, c.p, problem);
      if (b.queue.length >= MAX_QUEUE) return refuse(s, c.p, 'The queue is full');
      const cost = TOWER_LEVELS[b.level ?? 0].cost;
      const short = shortfall(p, cost);
      if (short) return refuse(s, c.p, short);
      pay(p, cost);
      b.queue.push({ rise: true, done: 0, paid: { ...cost } });
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
    case 'keepsake': {
      const b = myBuilding(s, c.p, c.building);
      if (!b) return;
      const no = keepsakeProblem(p, b);
      if (no) return refuse(s, c.p, no);
      chooseKeepsake(s, p, b);
      break;
    }
    case 'rally': {
      const b = myBuilding(s, c.p, c.building);
      if (!b) return;
      const tx = Math.floor(c.x);
      const ty = Math.floor(c.y);
      const tile = tx >= 0 && ty >= 0 && tx < s.w && ty < s.h && s.res[ty * s.w + tx] !== R_NONE ? ty * s.w + tx : -1;
      b.rally = tile >= 0 ? { x: c.x, y: c.y, tile, kind: s.res[tile] } : { x: c.x, y: c.y, tile };
      break;
    }
    case 'trade': {
      if (!s.ents.some((e) => e.kind === 'building' && e.owner === c.p && e.type === 'market' && e.built && e.hp > 0)) return refuse(s, c.p, 'Needs a Market');
      if (c.res === 'salt' || c.res === 'saltpetre' || c.res === 'bloodiron') {
        const have = p.rare?.[c.res] ?? 0;
        if (c.buy || have < ORE_TRADE.lot) return refuse(s, c.p, c.buy ? `${RARE[c.res].name} cannot be bought` : `Need ${ORE_TRADE.lot} ${RARE[c.res].name.toLowerCase()} to sell`);
        p.rare![c.res] = have - ORE_TRADE.lot;
        p.res.gold += ORE_TRADE.gold[c.res];
        break;
      }
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
    case 'patrol': {
      if (c.post !== undefined) {
        guardRoad(s, c.p, myUnits(s, c.p, c.ids), c.post, c.queue);
        break;
      }
      // A point off the map or not a number is no order at all (the room is public).
      if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return;
      const x = Math.min(s.w - 0.5, Math.max(0.5, c.x));
      const y = Math.min(s.h - 0.5, Math.max(0.5, c.y));
      const units = myUnits(s, c.p, c.ids).filter((u) => u.type !== 'wagon');
      for (const dom of ['land', 'water', 'air'] as const) {
        const group = units.filter((u) => domainOf(u.type) === dom);
        if (!group.length) continue;
        // Each keeps its place in the group: it patrols between where it stands and its spot by the point.
        for (const spot of formation(s, group, x, y)) {
          const u = spot.u;
          const pt = { x: spot.x, y: spot.y };
          const on = u.order.k === 'patrol' ? u.order : u.order.k === 'attack' && u.order.back?.k === 'patrol' ? u.order.back : null;
          if (c.queue && on) {
            if (on.pts.length < PATROL.points) on.pts.push(pt);
            continue;
          }
          giveOrder(u, { k: 'patrol', pts: [{ x: u.x, y: u.y }, pt], i: 1, started: false, miss: 0 }, c.queue);
        }
      }
      break;
    }
    case 'explore':
      for (const u of myUnits(s, c.p, c.ids)) {
        if (u.type === 'wagon') continue;
        giveOrder(u, { k: 'explore', x: -1, y: -1, started: false, fails: [] }, c.queue);
      }
      break;
    case 'arm':
    case 'disarm': {
      const units = myUnits(s, c.p, c.ids);
      const done = c.t === 'arm' ? arm(s, p, units) : disarm(s, p, units);
      if (!done.length && units.length) refuse(s, c.p, (c.t === 'arm' ? armProblem(p, units[0]) : disarmProblem(s, p, units[0])) ?? 'Nobody could');
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
        if (e.kind === 'building' && !e.built && e.progress === 0 && e.pitch === undefined) {
          if (!e.kill) refund(p, buildingCostFor(s, c.p, e.type));
          if (BUILDINGS[e.type].blood) p.blood = bloodOf(p) + BUILDINGS[e.type].blood!;
        }
        // A Thornwall its own people takes down is grubbed out, root and all (`rootThorn`).
        if (e.kind === 'building' && e.type === 'thornwall') e.grub = true;
        e.hp = 0;
      }
      break;
    case 'resign':
      for (const e of s.ents) if (e.owner === c.p) e.hp = 0;
      break;
    case 'leave':
      if (c.back) {
        if (p.left) {
          p.ai = null;
          delete p.left;
        }
      } else if (!p.ai && !p.defeated) {
        p.ai = 'normal';
        p.left = true;
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
