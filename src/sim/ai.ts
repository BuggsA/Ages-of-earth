import { applyCommand, heroBusy, MAX_QUEUE } from './commands';
import { AI_LEVELS, BUILDINGS, COUNTER, EPOCHS, LAST_EPOCH, MARKET, POP_MAX, TECHS, secs, unitEpoch, unitStats } from './data';
import { distToRect, placeProblem, walkable } from './grid';
import { buildingCostFor, techCostFor, techProblem } from './stats';
import type { AiMemory, Animal, Building, BuildingType, Command, Cost, GameState, Player, Res, TechId, Unit, UnitType } from './types';
import { RES, R_BERRY, R_GOLD, R_MEAT, R_NONE, R_STONE, R_TREE } from './types';
import { findResource, freeFarm } from './units';
import { isEnemy } from './world';

/**
 * The computer opponent. It plays by the same rules and through the same commands as a person: it
 * grows its people, hunts, spreads them over food, wood, gold and stone, builds houses before it runs
 * out of room, raises barracks, ranges, stables, a forge, a temple and a siege workshop, researches
 * better tools and weapons, trades at the market, advances through the epochs, trains a hero and an
 * army that counters what it sees, brings priests to heal and convert and siege to break walls,
 * rings the town bell when overrun, defends its town and attacks in waves that grow over time, and
 * builds a wonder when it is rich (and goes all out against yours). Difficulty sets how fast it
 * gathers, how many citizens it keeps, when and how hard it attacks and how many tricks it knows.
 *
 * It decides from the match state alone and its memory (kept in the state, so a saved match plays on
 * the same), with the match's own seeded dice, so it plays the same way in every browser.
 */

function memory(s: GameState, id: number): AiMemory {
  let mem = s.ai[id];
  if (!mem) {
    mem = { next: 10 + id * 7, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: id, bell: -1 };
    s.ai[id] = mem;
  }
  return mem;
}

/** The match's own dice, so the opponent's choices are the same everywhere. */
function roll(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const SHARE: Record<Res, number>[] = [
  { food: 0.5, wood: 0.4, gold: 0.05, stone: 0.05 },
  { food: 0.42, wood: 0.34, gold: 0.15, stone: 0.09 },
  { food: 0.4, wood: 0.3, gold: 0.23, stone: 0.07 },
  { food: 0.38, wood: 0.3, gold: 0.26, stone: 0.06 },
];
/** Citizens wanted before advancing out of each epoch. */
const ADVANCE_AT = [11, 17, 22];
const TILE_OF: Record<Res, number> = { food: R_BERRY, wood: R_TREE, stone: R_STONE, gold: R_GOLD };
/** Technologies in the order the opponent wants them (economy first). */
const TECH_ORDER: TechId[] = [
  'plow', 'axes', 'wheelbarrow', 'picks', 'forging', 'scaleArmor', 'fletching', 'husbandry', 'irrigation', 'saws', 'shafts', 'handcart',
  'ironCasting', 'chainMail', 'bodkin', 'masonry', 'theology', 'conscription', 'blastFurnace', 'plateArmor', 'chemistry',
];
const ECONOMY: TechId[] = ['plow', 'axes', 'wheelbarrow', 'picks', 'irrigation', 'saws', 'shafts', 'handcart'];

export function aiStep(s: GameState): void {
  for (const p of s.players) {
    if (!p.ai || p.defeated) continue;
    const mem = memory(s, p.id);
    if (s.tick < mem.next) continue;
    mem.next = s.tick + secs(AI_LEVELS[p.ai].think);
    think(s, p, mem);
  }
}

interface View {
  p: Player;
  citizens: Unit[];
  army: Unit[];
  priests: Unit[];
  buildings: Building[];
  home: { x: number; y: number };
  tc: Building | null;
  /** Spendable after setting aside what the next epoch costs. */
  budget: Record<Res, number>;
}

function afford(v: View, cost: Cost): boolean {
  return RES.every((r) => !cost[r] || v.budget[r] >= cost[r]);
}

function spend(v: View, cost: Cost): void {
  for (const r of RES) v.budget[r] -= cost[r] ?? 0;
}

function think(s: GameState, p: Player, mem: AiMemory): void {
  const L = AI_LEVELS[p.ai!];
  const citizens: Unit[] = [];
  const army: Unit[] = [];
  const priests: Unit[] = [];
  const buildings: Building[] = [];
  let king: Unit | null = null;
  for (const e of s.ents) {
    if (e.owner !== p.id || e.hp <= 0) continue;
    if (e.kind === 'unit' && s.kings[p.id] === e.id) king = e;
    else if (e.kind === 'unit') (e.type === 'citizen' ? citizens : e.type === 'priest' ? priests : army).push(e);
    else buildings.push(e);
  }
  const tc = buildings.find((b) => b.type === 'towncenter' && b.built) ?? null;
  // A King stays out of harm's way, sheltered in the Town Center.
  if (king && tc && !king.inside && king.order.k !== 'garrison') applyCommand(s, { t: 'garrison', p: p.id, ids: [king.id], target: tc.id });
  const home = tc ? { x: tc.x, y: tc.y } : { x: p.startX, y: p.startY };
  const v: View = { p, citizens, army, priests, buildings, home, tc, budget: { ...p.res } };
  const issue = (c: Command) => applyCommand(s, c);

  // People first: a growing town pays for everything else.
  const advancing = buildings.some((b) => b.advance >= 0);
  const queuedCitizens = buildings.reduce((n, b) => n + b.queue.filter((q) => q.unit === 'citizen').length, 0);
  const wantCitizens = Math.min(L.citizens + p.epoch * 3, 60);
  if (tc && !advancing && citizens.length + queuedCitizens < wantCitizens && tc.queue.length < 2) {
    const cost = unitStats('citizen', p.epoch).cost;
    if (afford(v, cost)) {
      issue({ t: 'train', p: p.id, building: tc.id, unit: 'citizen' });
      spend(v, cost);
    }
  }

  // Epochs: once there are enough people, set the cost aside (so the army doesn't eat it) and advance;
  // but when an attack is due and the army is short of it, soldiers come first.
  const waveSize = L.wave + mem.wave * L.waveGrowth;
  const armyFirst = s.tick > secs(L.firstAttack - 150) && army.length < waveSize && !mem.attacking;
  const wantEpoch = p.epoch < LAST_EPOCH && !advancing && !armyFirst && citizens.length >= ADVANCE_AT[p.epoch] && s.tick > secs(150 + p.epoch * 150);
  if (wantEpoch) {
    const cost = EPOCHS[p.epoch + 1].cost;
    if (tc && tc.queue.length === 0 && afford(v, cost)) issue({ t: 'advance', p: p.id, building: tc.id });
    spend(v, cost);
  }

  townBell(s, v, mem, issue);
  research(s, v, citizens.length >= wantCitizens - 2, issue);
  trade(s, v, issue);
  planBuildings(s, v, mem, issue);
  assignCitizens(s, v, issue);
  military(s, v, mem, issue);
  priestly(s, v, mem, issue);
}

// ---- Research and trade ----------------------------------------------------------------------------

function research(s: GameState, v: View, peopleEnough: boolean, issue: (c: Command) => void): void {
  const { p } = v;
  const L = AI_LEVELS[p.ai!];
  const order = L.clever ? TECH_ORDER : ECONOMY;
  for (const tech of order) {
    if (techProblem(s, p.id, tech)) continue;
    const at = v.buildings.find((b) => b.type === TECHS[tech].at && b.built && b.queue.length === 0 && b.advance < 0);
    if (!at) continue;
    // The Town Center trains citizens first.
    if (at.type === 'towncenter' && !peopleEnough && v.citizens.length < 12) continue;
    const cost = techCostFor(s, p.id, tech);
    // Keep something back for soldiers and the next epoch.
    const keep: Cost = { food: 100, wood: 100, gold: 50 };
    if (!RES.every((r) => !cost[r] || v.budget[r] >= cost[r]! + (keep[r] ?? 0))) continue;
    issue({ t: 'research', p: p.id, building: at.id, tech });
    spend(v, cost);
    return;
  }
}

function trade(s: GameState, v: View, issue: (c: Command) => void): void {
  const { p } = v;
  if (!AI_LEVELS[p.ai!].clever || !v.buildings.some((b) => b.type === 'market' && b.built)) return;
  // Sell what piles up for gold; buy what is short when gold piles up.
  for (const r of ['food', 'wood', 'stone'] as const) {
    if (p.res[r] > 1500 && p.res.gold < 400 && s.market[r] > MARKET.min + 10) {
      issue({ t: 'trade', p: p.id, res: r, buy: false });
      return;
    }
  }
  for (const r of ['food', 'wood'] as const) {
    if (p.res[r] < 100 && p.res.gold > 1200 && s.market[r] < 250) {
      issue({ t: 'trade', p: p.id, res: r, buy: true });
      return;
    }
  }
}

// ---- Building --------------------------------------------------------------------------------------

/** A free spot for a building near a point, keeping a lane open around it. */
export function findSpot(s: GameState, type: BuildingType, x: number, y: number, minR: number, maxR: number, margin = 1): { tx: number; ty: number } | null {
  const n = BUILDINGS[type].size;
  const cx = Math.floor(x - n / 2);
  const cy = Math.floor(y - n / 2);
  for (let r = minR; r <= maxR; r++) {
    // Start each ring at a different side, so buildings don't all line up.
    const start = Math.floor(roll(s) * 8 * Math.max(1, r));
    const ring: [number, number][] = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) ring.push([dx, dy]);
    for (let k = 0; k < ring.length; k++) {
      const [dx, dy] = ring[(k + start) % ring.length];
      const tx = cx + dx;
      const ty = cy + dy;
      if (placeProblem(s, type, tx, ty)) continue;
      if (margin && !laneClear(s, tx, ty, n, type === 'farm')) continue;
      return { tx, ty };
    }
  }
  return null;
}

/** The ring of tiles around a footprint has no buildings or resources on it (so nothing gets walled in). */
function laneClear(s: GameState, tx: number, ty: number, n: number, farm: boolean): boolean {
  for (let y = ty - 1; y <= ty + n; y++) {
    for (let x = tx - 1; x <= tx + n; x++) {
      if (x >= tx && x < tx + n && y >= ty && y < ty + n) continue;
      if (x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
      const i = y * s.w + x;
      const b = s.bldAt[i];
      if (b && !(farm && (s.byId.get(b) as Building | undefined)?.type === 'farm')) return false;
      if (s.res[i] !== R_NONE && !farm) return false;
      if (!walkable(s, x, y) && !b) return false;
    }
  }
  return true;
}

/** Order a building with a few citizens pulled off other work (wood first, farmers last). */
function construct(s: GameState, v: View, mem: AiMemory, type: BuildingType, spot: { tx: number; ty: number }, builders: number, issue: (c: Command) => void): boolean {
  const cost = buildingCostFor(s, v.p.id, type);
  if (!afford(v, cost)) return false;
  const cx = spot.tx + BUILDINGS[type].size / 2;
  const cy = spot.ty + BUILDINGS[type].size / 2;
  const rank = (u: Unit) => {
    const o = u.order;
    const job = o.k === 'idle' ? 0 : o.k === 'gather' && o.res === 'wood' ? 1 : o.k === 'gather' ? 2 : o.k === 'build' ? 4 : 3;
    const dx = u.x - cx;
    const dy = u.y - cy;
    return job * 1000 + Math.sqrt(dx * dx + dy * dy);
  };
  const crew = v.citizens
    .filter((u) => !(u.order.k === 'farm' && u.order.phase === 'work') && u.order.k !== 'build' && !u.inside)
    .sort((a, b) => rank(a) - rank(b) || a.id - b.id)
    .slice(0, builders);
  if (!crew.length) return false;
  issue({ t: 'build', p: v.p.id, ids: crew.map((u) => u.id), type, tx: spot.tx, ty: spot.ty });
  spend(v, cost);
  mem.ordered[type] = s.tick;
  return true;
}

function count(v: View, type: BuildingType, builtOnly = false): number {
  return v.buildings.filter((b) => b.type === type && (!builtOnly || b.built)).length;
}

function planBuildings(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p, home } = v;
  const L = AI_LEVELS[p.ai!];
  const pending = v.buildings.filter((b) => !b.built);
  const recently = (type: BuildingType, sec = 20) => s.tick - (mem.ordered[type] ?? -99999) < secs(sec);
  const enemy = enemyHome(s, p);
  const towardEnemy = (d: number) => {
    const dx = enemy.x - home.x;
    const dy = enemy.y - home.y;
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: home.x + (dx / l) * d, y: home.y + (dy / l) * d };
  };

  // Lost the Town Center: rebuilding it comes first.
  if (!v.tc && !v.buildings.some((b) => b.type === 'towncenter') && v.citizens.length && !recently('towncenter', 30)) {
    const spot = findSpot(s, 'towncenter', home.x, home.y, 0, 14);
    if (spot) construct(s, v, mem, 'towncenter', spot, 4, issue);
    return;
  }

  // Houses ahead of need (two at once later on).
  const housesBuilding = pending.filter((b) => b.type === 'house').length;
  const room = p.cap - p.pop;
  if (p.cap < POP_MAX && room <= 3 + p.epoch * 2 && housesBuilding < (p.pop > 40 ? 2 : 1) && !recently('house', 4)) {
    const spot = findSpot(s, 'house', home.x, home.y, 5, 22);
    if (spot) construct(s, v, mem, 'house', spot, 1, issue);
  }
  if (pending.length > 2) return;

  // Drop sites by the woods and mines being worked far from any.
  for (const res of ['wood', 'gold', 'stone'] as Res[]) {
    const workers = v.citizens.filter((u) => u.order.k === 'gather' && u.order.res === res);
    if (workers.length < 3 || count(v, 'storehouse') >= 5 || recently('storehouse', 30)) continue;
    const far = workers.filter((u) => {
      const o = u.order as Extract<Unit['order'], { k: 'gather' }>;
      const tx = (o.tile % s.w) + 0.5;
      const ty = Math.floor(o.tile / s.w) + 0.5;
      return !v.buildings.some((b) => b.built && BUILDINGS[b.type].drop.includes(res) && distToRect(tx, ty, b) < 7);
    });
    if (far.length >= 3) {
      const o = far[0].order as Extract<Unit['order'], { k: 'gather' }>;
      const spot = findSpot(s, 'storehouse', (o.tile % s.w) + 0.5, Math.floor(o.tile / s.w) + 0.5, 2, 6);
      if (spot && construct(s, v, mem, 'storehouse', spot, 2, issue)) return;
    }
  }

  // Fields once the berries near home run short of feeding everyone who should be on food.
  const berries = findResource(s, R_BERRY, home.x, home.y, 14);
  const farms = count(v, 'farm');
  const freeFields = v.buildings.filter((b) => b.type === 'farm' && !v.citizens.some((u) => u.order.k === 'farm' && u.order.target === b.id)).length;
  const foodWanted = Math.round(wanted(v).food) - (berries >= 0 ? 6 : 0);
  if (farms < foodWanted && freeFields < 2 && !recently('farm', 2)) {
    const spot = findSpot(s, 'farm', home.x, home.y, 3, 16);
    if (spot && construct(s, v, mem, 'farm', spot, 1, issue)) return;
  }

  const n = v.citizens.length;
  const clever = L.clever;
  const want: [BuildingType, boolean][] = [
    ['barracks', n >= 8 && count(v, 'barracks') === 0],
    ['range', n >= 12 && count(v, 'range') === 0],
    ['stable', p.epoch >= 1 && n >= 14 && count(v, 'stable') === 0],
    ['forge', p.epoch >= 1 && n >= 16 && count(v, 'forge') === 0],
    ['tower', p.epoch >= 1 && count(v, 'tower') < L.towers && n >= 16],
    ['market', clever && p.epoch >= 1 && n >= 20 && count(v, 'market') === 0],
    ['workshop', clever && p.epoch >= 2 && n >= 20 && count(v, 'workshop') === 0],
    ['temple', clever && p.epoch >= 2 && n >= 22 && count(v, 'temple') === 0],
    ['barracks', p.epoch >= 2 && n >= 22 && count(v, 'barracks') < 2],
    ['range', p.epoch >= 2 && n >= 24 && count(v, 'range') < 2],
    ['stable', p.epoch >= 3 && n >= 26 && count(v, 'stable') < 2],
  ];
  for (const [type, ok] of want) {
    if (!ok || recently(type, 25) || BUILDINGS[type].epoch > p.epoch) continue;
    const at = type === 'tower' ? towardEnemy(9) : type === 'market' || type === 'temple' ? home : towardEnemy(6);
    const spot = findSpot(s, type, at.x, at.y, type === 'market' || type === 'temple' ? 6 : 0, 18);
    if (spot && construct(s, v, mem, type, spot, type === 'tower' ? 2 : 3, issue)) return;
  }

  // A wonder, when rich in the last epoch.
  if (clever && p.epoch >= LAST_EPOCH && count(v, 'wonder') === 0 && !recently('wonder', 60)) {
    const cost = buildingCostFor(s, p.id, 'wonder');
    if (RES.every((r) => !cost[r] || v.budget[r] >= cost[r]! + 200)) {
      const spot = findSpot(s, 'wonder', home.x, home.y, 6, 20);
      if (spot) construct(s, v, mem, 'wonder', spot, 8, issue);
    }
  }
}

// ---- Citizens --------------------------------------------------------------------------------------

function jobOf(u: Unit): Res | 'build' | null {
  const o = u.order;
  if (o.k === 'gather') return o.res;
  if (o.k === 'farm' || o.k === 'hunt') return 'food';
  if (o.k === 'build') return 'build';
  return null;
}

/** How many citizens each resource should have now: the epoch's shares, leaning away from what piles up. */
function wanted(v: View): Record<Res, number> {
  const share = SHARE[v.p.epoch];
  const weight: Record<Res, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
  let total = 0;
  for (const r of RES) {
    const stock = v.p.res[r];
    const lean = stock > 1200 ? 0.15 : stock > 700 ? 0.4 : stock > 400 ? 0.7 : stock < 80 ? 1.4 : 1;
    weight[r] = share[r] * lean;
    total += weight[r];
  }
  const n = v.citizens.filter((u) => u.order.k !== 'build' && !u.inside).length;
  const out: Record<Res, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const r of RES) out[r] = (weight[r] / total) * n;
  return out;
}

function nearestDeer(s: GameState, x: number, y: number, r: number): Animal | null {
  let best: Animal | null = null;
  let bestD = r * r;
  for (const a of s.animals) {
    const dx = a.x - x;
    const dy = a.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

/** Send a citizen to gather a resource (game, berries, then free fields, for food). False if there is none to be had. */
function sendTo(s: GameState, v: View, u: Unit, res: Res, issue: (c: Command) => void): boolean {
  if (res === 'food') {
    const meat = findResource(s, R_MEAT, v.home.x, v.home.y, 14);
    if (meat >= 0) {
      issue({ t: 'gather', p: v.p.id, ids: [u.id], tile: meat });
      return true;
    }
    // A few hunters while there is game close to home.
    const hunters = v.citizens.filter((c) => c.order.k === 'hunt').length;
    const deer = hunters < 3 ? nearestDeer(s, v.home.x, v.home.y, 16) : null;
    if (deer) {
      issue({ t: 'hunt', p: v.p.id, ids: [u.id], target: deer.id });
      return true;
    }
    const berry = findResource(s, R_BERRY, v.home.x, v.home.y, 16);
    if (berry >= 0) {
      issue({ t: 'gather', p: v.p.id, ids: [u.id], tile: berry });
      return true;
    }
    const farm = freeFarm(s, v.p.id, v.home.x, v.home.y, 24);
    if (farm) {
      issue({ t: 'work', p: v.p.id, ids: [u.id], target: farm.id });
      return true;
    }
    return false;
  }
  const from = nearestDropTo(v, u);
  let tile = findResource(s, TILE_OF[res], from.x, from.y, 26);
  if (tile < 0) tile = findResource(s, TILE_OF[res], u.x, u.y, 60);
  if (tile < 0) return false;
  issue({ t: 'gather', p: v.p.id, ids: [u.id], tile });
  return true;
}

function assignCitizens(s: GameState, v: View, issue: (c: Command) => void): void {
  const want = wanted(v);
  const have: Record<Res, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const u of v.citizens) {
    const j = jobOf(u);
    if (j && j !== 'build') have[j]++;
  }
  // Foundations nobody is working on get the nearest wood cutter.
  for (const b of v.buildings) {
    if (b.built || v.citizens.some((u) => u.order.k === 'build' && u.order.target === b.id)) continue;
    const helper = v.citizens
      .filter((u) => !u.inside && (u.order.k === 'idle' || (u.order.k === 'gather' && u.order.res === 'wood')))
      .sort((a, c) => distToRect(a.x, a.y, b) - distToRect(c.x, c.y, b) || a.id - c.id)[0];
    if (helper) issue({ t: 'work', p: v.p.id, ids: [helper.id], target: b.id });
  }
  const neediest = (skip: Set<Res>) => {
    let best: Res | null = null;
    let gap = -Infinity;
    for (const r of RES) {
      if (skip.has(r)) continue;
      const g = want[r] - have[r];
      if (g > gap) {
        gap = g;
        best = r;
      }
    }
    return best;
  };
  for (const u of v.citizens.filter((c) => c.order.k === 'idle' && !c.inside && !c.queue.length)) {
    const skip = new Set<Res>();
    for (let tries = 0; tries < 4; tries++) {
      const r = neediest(skip);
      if (!r) break;
      if (sendTo(s, v, u, r, issue)) {
        have[r]++;
        break;
      }
      skip.add(r);
    }
  }
  // Rebalance: one citizen a decision moves from the most crowded resource to the most needed one.
  let over: Res | null = null;
  let under: Res | null = null;
  let most = 1.5;
  let least = 1.5;
  for (const r of RES) {
    if (have[r] - want[r] > most) {
      most = have[r] - want[r];
      over = r;
    }
    if (want[r] - have[r] > least) {
      least = want[r] - have[r];
      under = r;
    }
  }
  if (over && under) {
    const mover = v.citizens.find((u) => jobOf(u) === over && u.carry <= 2 && u.order.k !== 'farm' && u.order.k !== 'hunt' && !u.inside);
    if (mover) sendTo(s, v, mover, under, issue);
  }
}

function nearestDropTo(v: View, u: Unit): { x: number; y: number } {
  let best = v.home;
  let bestD = Infinity;
  for (const b of v.buildings) {
    if (!b.built || !BUILDINGS[b.type].drop.length) continue;
    const d = distToRect(u.x, u.y, b);
    if (d < bestD) {
      bestD = d;
      best = { x: b.x, y: b.y };
    }
  }
  return best;
}

// ---- Army ------------------------------------------------------------------------------------------

/** Where to strike: an enemy wonder first (it must fall), then a King (or where one shelters), then the nearest Town Center. */
function enemyHome(s: GameState, p: Player): { x: number; y: number } {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const id of s.kings) {
    const k = id ? s.byId.get(id) : undefined;
    if (!k || k.kind !== 'unit' || k.inside || !isEnemy(s, p.id, k.owner)) continue;
    const kx = k.x - p.startX;
    const ky = k.y - p.startY;
    const d = kx * kx + ky * ky - 5e5;
    if (d < bestD) {
      bestD = d;
      best = { x: k.x, y: k.y };
    }
  }
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.hp <= 0 || !isEnemy(s, p.id, e.owner)) continue;
    const dx = e.x - p.startX;
    const dy = e.y - p.startY;
    const shelter = s.mode === 'regicide' && e.garrison.some((id) => s.kings.includes(id));
    const d = dx * dx + dy * dy + (e.type === 'wonder' ? -1e6 : shelter ? -5e5 : e.type === 'towncenter' ? 0 : e.type === 'wall' || e.type === 'gate' ? 1e5 : 400);
    if (d < bestD) {
      bestD = d;
      best = { x: e.x, y: e.y };
    }
  }
  if (best) return best;
  const foe = s.players.find((o) => !o.defeated && isEnemy(s, p.id, o.id));
  return foe ? { x: foe.startX, y: foe.startY } : { x: s.w / 2, y: s.h / 2 };
}

function pickUnit(v: View, mem: AiMemory, building: Building): UnitType | null {
  const trains = BUILDINGS[building.type].trains.filter((t) => t !== 'citizen' && t !== 'hero' && unitEpoch(t) <= v.p.epoch);
  if (!trains.length) return null;
  return trains[mem.unitTurn++ % trains.length];
}

/** What the enemy fields most of, to counter it. */
function enemyMix(s: GameState, p: Player): Record<'infantry' | 'ranged' | 'cavalry', number> {
  const mix = { infantry: 0, ranged: 0, cavalry: 0 };
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || !isEnemy(s, p.id, e.owner)) continue;
    if (e.type === 'infantry' || e.type === 'ranged' || e.type === 'cavalry') mix[e.type]++;
  }
  return mix;
}

/** Enemy soldiers close to home, and the nearest of them. */
function threatNear(s: GameState, v: View): { unit: Unit | null; count: number } {
  let threat: Unit | null = null;
  let threatD = Infinity;
  let n = 0;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || !isEnemy(s, v.p.id, e.owner) || e.type === 'citizen') continue;
    let near = Infinity;
    for (const b of v.buildings) near = Math.min(near, distToRect(e.x, e.y, b));
    if (near < 12) {
      n++;
      if (near < threatD) {
        threatD = near;
        threat = e;
      }
    }
  }
  return { unit: threat, count: n };
}

function townBell(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  if (!AI_LEVELS[v.p.ai!].clever || !v.tc) return;
  const t = threatNear(s, v);
  const defenders = v.army.filter((u) => !u.inside).length;
  if (mem.bell < 0 && t.count >= 5 && defenders < t.count / 2) {
    issue({ t: 'bell', p: v.p.id, ring: true });
    mem.bell = s.tick;
  } else if (mem.bell >= 0 && t.count === 0 && s.tick - mem.bell > secs(20)) {
    issue({ t: 'bell', p: v.p.id, ring: false });
    mem.bell = -1;
  }
}

function military(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p } = v;
  const L = AI_LEVELS[p.ai!];
  const enemy = enemyHome(s, p);
  const dx = enemy.x - v.home.x;
  const dy = enemy.y - v.home.y;
  const dl = Math.sqrt(dx * dx + dy * dy) || 1;
  mem.muster = { x: v.home.x + (dx / dl) * 8, y: v.home.y + (dy / dl) * 8 };

  // A hero to lead the army.
  if (L.clever && v.tc && v.army.length >= 6 && !heroBusy(s, p.id) && v.tc.queue.length < 2 && v.tc.advance < 0) {
    const cost = unitStats('hero', p.epoch).cost;
    if (afford(v, cost)) {
      issue({ t: 'train', p: p.id, building: v.tc.id, unit: 'hero' });
      spend(v, cost);
    }
  }

  // Train: counter the enemy's main arm when there is one to see, otherwise take turns.
  const mix = enemyMix(s, p);
  const main = (Object.keys(mix) as (keyof typeof mix)[]).sort((a, b) => mix[b] - mix[a])[0];
  const counter = mix[main] >= 3 ? COUNTER[main] : null;
  const keepCitizensGrowing = v.citizens.length < 8;
  const siege = v.army.filter((u) => u.type === 'siege').length;
  for (const b of v.buildings) {
    if (!b.built || b.queue.length >= Math.min(2, MAX_QUEUE) || keepCitizensGrowing) continue;
    const trains = BUILDINGS[b.type].trains;
    if (!trains.length || trains.includes('citizen')) continue;
    let unit: UnitType | null;
    if (b.type === 'workshop') unit = siege < (p.epoch >= 2 ? 3 : 2) && v.army.length >= 6 ? 'siege' : null;
    else if (b.type === 'temple') unit = v.priests.length < 2 && v.army.length >= 6 ? 'priest' : null;
    else {
      unit = counter && trains.includes(counter) && unitEpoch(counter) <= p.epoch && roll(s) < 0.7 ? counter : pickUnit(v, mem, b);
      if (unit && unitEpoch(unit) > p.epoch) unit = pickUnit(v, mem, b);
    }
    if (!unit || unitEpoch(unit) > p.epoch) continue;
    const cost = unitStats(unit, p.epoch).cost;
    if (!afford(v, cost)) continue;
    issue({ t: 'train', p: p.id, building: b.id, unit });
    spend(v, cost);
    if (!b.rally || Math.abs(b.rally.x - mem.muster.x) > 1) issue({ t: 'rally', p: p.id, building: b.id, x: mem.muster.x, y: mem.muster.y });
  }

  // Defend: enemies near home draw the whole army.
  const threat = threatNear(s, v).unit;
  const fighters = v.army.filter((u) => !u.inside);
  if (threat) {
    const responders = fighters.filter((u) => u.order.k !== 'attack');
    if (responders.length) issue({ t: 'move', p: p.id, ids: responders.map((u) => u.id), x: threat.x, y: threat.y, amove: true });
    mem.attacking = false;
    return;
  }

  // Attack in waves once the army is big enough (at once against a wonder); between waves, gather at the muster point.
  const ready = fighters.filter((u) => u.order.k === 'idle' || (u.order.k === 'move' && !u.order.amove));
  const waveSize = L.wave + mem.wave * L.waveGrowth;
  const onAttack = fighters.filter((u) => u.order.k === 'attack' || (u.order.k === 'move' && u.order.amove));
  if (mem.attacking && onAttack.length === 0) mem.attacking = false;
  const wonderRace = s.ents.some((e) => e.kind === 'building' && e.type === 'wonder' && e.hp > 0 && isEnemy(s, p.id, e.owner));
  const due = s.tick >= secs(L.firstAttack) && s.tick >= s.peaceUntil;
  if (due && !mem.attacking && (fighters.length >= waveSize || (wonderRace && fighters.length >= 4))) {
    issue({ t: 'move', p: p.id, ids: fighters.map((u) => u.id), x: enemy.x, y: enemy.y, amove: true });
    mem.attacking = true;
    mem.wave++;
    return;
  }
  if (mem.attacking && ready.length >= 4) {
    // Reinforcements join the attack.
    issue({ t: 'move', p: p.id, ids: ready.map((u) => u.id), x: enemy.x, y: enemy.y, amove: true });
    return;
  }
  const strays = ready.filter((u) => {
    const ox = u.x - mem.muster!.x;
    const oy = u.y - mem.muster!.y;
    return ox * ox + oy * oy > 36 && u.order.k === 'idle';
  });
  if (strays.length) issue({ t: 'move', p: p.id, ids: strays.map((u) => u.id), x: mem.muster.x, y: mem.muster.y });
}

/** Priests walk with the army (healing as they go) and turn the enemy's best units. */
function priestly(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  if (!v.priests.length) return;
  const army = v.army.filter((u) => !u.inside && u.type !== 'siege');
  for (const pr of v.priests) {
    if (pr.order.k !== 'idle' || pr.cool > 0) continue;
    // Something worth converting close by?
    let best: Unit | null = null;
    let bestScore = 0;
    for (const e of s.ents) {
      if (e.kind !== 'unit' || e.hp <= 0 || e.inside || !isEnemy(s, v.p.id, e.owner)) continue;
      const dx = e.x - pr.x;
      const dy = e.y - pr.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 81) continue;
      const worth = e.type === 'hero' ? 5 : e.type === 'siege' ? 4 : e.type === 'cavalry' ? 3 : 1;
      const score = worth / (1 + d2);
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    if (best) {
      issue({ t: 'convert', p: v.p.id, ids: [pr.id], target: best.id });
      continue;
    }
    // Otherwise keep up with the army.
    if (army.length) {
      let cx = 0;
      let cy = 0;
      for (const a of army) {
        cx += a.x;
        cy += a.y;
      }
      cx /= army.length;
      cy /= army.length;
      const dx = cx - pr.x;
      const dy = cy - pr.y;
      if (dx * dx + dy * dy > 49) issue({ t: 'move', p: v.p.id, ids: [pr.id], x: cx, y: cy });
    } else if (mem.muster) issue({ t: 'move', p: v.p.id, ids: [pr.id], x: mem.muster.x, y: mem.muster.y });
  }
}
