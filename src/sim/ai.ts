import { applyCommand, MAX_QUEUE } from './commands';
import { AI_LEVELS, BUILDINGS, COUNTER, EPOCHS, LAST_EPOCH, POP_MAX, secs, unitEpoch, unitStats, type UnitClass } from './data';
import { distToRect, placeProblem, walkable } from './grid';
import type { Building, BuildingType, Command, Cost, GameState, Player, Res, Unit, UnitType } from './types';
import { RES, R_BERRY, R_GOLD, R_NONE, R_STONE, R_TREE } from './types';
import { findResource, freeFarm } from './units';
import { isEnemy } from './world';

/**
 * The computer opponent. It plays by the same rules and through the same commands as a person: it
 * grows its people, spreads them over food, wood, gold and stone, builds houses before it runs out of
 * room, raises barracks, ranges and stables, advances through the epochs, trains an army that counters
 * what it sees, defends its town and attacks in waves that grow over time. Difficulty sets how fast it
 * gathers, how many citizens it keeps and when and how hard it attacks.
 *
 * It decides from the match state alone and its own small memory (kept beside the state), with its own
 * seeded dice, so it plays the same way in every browser.
 */

interface Memory {
  next: number;
  wave: number;
  attacking: boolean;
  /** Where the army gathers between attacks. */
  muster: { x: number; y: number } | null;
  /** Last tick a building of each kind was ordered, so it waits for the first to go up. */
  ordered: Partial<Record<BuildingType, number>>;
  unitTurn: number;
}

const memories = new WeakMap<GameState, Map<number, Memory>>();

function memory(s: GameState, id: number): Memory {
  let m = memories.get(s);
  if (!m) {
    m = new Map();
    memories.set(s, m);
  }
  let mem = m.get(id);
  if (!mem) {
    mem = { next: 10 + id * 7, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: id };
    m.set(id, mem);
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
  { food: 0.52, wood: 0.38, gold: 0.05, stone: 0.05 },
  { food: 0.45, wood: 0.3, gold: 0.15, stone: 0.1 },
  { food: 0.42, wood: 0.25, gold: 0.25, stone: 0.08 },
  { food: 0.42, wood: 0.22, gold: 0.29, stone: 0.07 },
];
/** Citizens wanted before advancing out of each epoch. */
const ADVANCE_AT = [11, 17, 22];
const TILE_OF: Record<Res, number> = { food: R_BERRY, wood: R_TREE, stone: R_STONE, gold: R_GOLD };

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

function think(s: GameState, p: Player, mem: Memory): void {
  const L = AI_LEVELS[p.ai!];
  const citizens: Unit[] = [];
  const army: Unit[] = [];
  const buildings: Building[] = [];
  for (const e of s.ents) {
    if (e.owner !== p.id || e.hp <= 0) continue;
    if (e.kind === 'unit') (e.type === 'citizen' ? citizens : army).push(e);
    else buildings.push(e);
  }
  const tc = buildings.find((b) => b.type === 'towncenter' && b.built) ?? null;
  const home = tc ? { x: tc.x, y: tc.y } : { x: p.startX, y: p.startY };
  const v: View = { p, citizens, army, buildings, home, tc, budget: { ...p.res } };
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

  // Epochs: once there are enough people, set the cost aside (so the army doesn't eat it) and advance.
  const wantEpoch = p.epoch < LAST_EPOCH && !advancing && citizens.length >= ADVANCE_AT[p.epoch] && s.tick > secs(150 + p.epoch * 150);
  if (wantEpoch) {
    const cost = EPOCHS[p.epoch + 1].cost;
    if (tc && tc.queue.length === 0 && afford(v, cost)) issue({ t: 'advance', p: p.id, building: tc.id });
    spend(v, cost);
  }

  planBuildings(s, v, mem, issue);
  assignCitizens(s, v, issue);
  military(s, v, mem, issue);
}

// ---- Building --------------------------------------------------------------------------------------

/** A free spot for a building near a point, keeping a lane open around it. */
export function findSpot(s: GameState, type: BuildingType, x: number, y: number, minR: number, maxR: number, margin = 1): { tx: number; ty: number } | null {
  const n = BUILDINGS[type].size;
  const cx = Math.floor(x - n / 2);
  const cy = Math.floor(y - n / 2);
  for (let r = minR; r <= maxR; r++) {
    // Start each ring at a different side, so buildings don't all line up.
    const start = Math.floor(roll(s) * 8 * r);
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
function construct(s: GameState, v: View, mem: Memory, type: BuildingType, spot: { tx: number; ty: number }, builders: number, issue: (c: Command) => void): boolean {
  const cost = BUILDINGS[type].cost;
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
    .filter((u) => !(u.order.k === 'farm' && u.order.phase === 'work') && u.order.k !== 'build')
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

function planBuildings(s: GameState, v: View, mem: Memory, issue: (c: Command) => void): void {
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
    const spot = findSpot(s, 'house', home.x, home.y, 5, 16);
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
    const spot = findSpot(s, 'farm', home.x, home.y, 3, 14);
    if (spot && construct(s, v, mem, 'farm', spot, 1, issue)) return;
  }

  const n = v.citizens.length;
  const want: [BuildingType, boolean][] = [
    ['barracks', n >= 8 && count(v, 'barracks') === 0],
    ['range', n >= 12 && count(v, 'range') === 0],
    ['stable', p.epoch >= 1 && n >= 14 && count(v, 'stable') === 0],
    ['tower', p.epoch >= 1 && count(v, 'tower') < L.towers && n >= 16],
    ['barracks', p.epoch >= 2 && n >= 22 && count(v, 'barracks') < 2],
    ['range', p.epoch >= 2 && n >= 24 && count(v, 'range') < 2],
    ['stable', p.epoch >= 3 && n >= 26 && count(v, 'stable') < 2],
  ];
  for (const [type, ok] of want) {
    if (!ok || recently(type, 25) || BUILDINGS[type].epoch > p.epoch) continue;
    const at = type === 'tower' ? towardEnemy(9) : towardEnemy(6);
    const spot = findSpot(s, type, at.x, at.y, 0, 14);
    if (spot && construct(s, v, mem, type, spot, type === 'tower' ? 2 : 3, issue)) return;
  }
}

// ---- Citizens --------------------------------------------------------------------------------------

function jobOf(u: Unit): Res | 'build' | null {
  const o = u.order;
  if (o.k === 'gather') return o.res;
  if (o.k === 'farm') return 'food';
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
  const n = v.citizens.filter((u) => u.order.k !== 'build').length;
  const out: Record<Res, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const r of RES) out[r] = (weight[r] / total) * n;
  return out;
}

/** Send a citizen to gather a resource (berries, then free fields, for food). False if there is none to be had. */
function sendTo(s: GameState, v: View, u: Unit, res: Res, issue: (c: Command) => void): boolean {
  if (res === 'food') {
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
      .filter((u) => u.order.k === 'idle' || (u.order.k === 'gather' && u.order.res === 'wood'))
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
  for (const u of v.citizens.filter((c) => c.order.k === 'idle')) {
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
    const mover = v.citizens.find((u) => jobOf(u) === over && u.carry <= 2 && !(u.order.k === 'farm'));
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

function enemyHome(s: GameState, p: Player): { x: number; y: number } {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.hp <= 0 || !isEnemy(s, p.id, e.owner)) continue;
    const dx = e.x - p.startX;
    const dy = e.y - p.startY;
    const d = dx * dx + dy * dy + (e.type === 'towncenter' ? 0 : 400);
    if (d < bestD) {
      bestD = d;
      best = { x: e.x, y: e.y };
    }
  }
  if (best) return best;
  const foe = s.players.find((o) => !o.defeated && isEnemy(s, p.id, o.id));
  return foe ? { x: foe.startX, y: foe.startY } : { x: s.w / 2, y: s.h / 2 };
}

function pickUnit(v: View, mem: Memory, building: Building): UnitType | null {
  const trains = BUILDINGS[building.type].trains.filter((t) => t !== 'citizen' && unitEpoch(t) <= v.p.epoch);
  if (!trains.length) return null;
  return trains[mem.unitTurn++ % trains.length];
}

/** What the enemy fields most of, to counter it. */
function enemyMix(s: GameState, p: Player): Record<Exclude<UnitClass, 'citizen'>, number> {
  const mix = { infantry: 0, ranged: 0, cavalry: 0 };
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.type === 'citizen' || e.hp <= 0 || !isEnemy(s, p.id, e.owner)) continue;
    mix[e.type]++;
  }
  return mix;
}

function military(s: GameState, v: View, mem: Memory, issue: (c: Command) => void): void {
  const { p } = v;
  const L = AI_LEVELS[p.ai!];
  const enemy = enemyHome(s, p);
  const dx = enemy.x - v.home.x;
  const dy = enemy.y - v.home.y;
  const dl = Math.sqrt(dx * dx + dy * dy) || 1;
  mem.muster = { x: v.home.x + (dx / dl) * 8, y: v.home.y + (dy / dl) * 8 };

  // Train: counter the enemy's main arm when there is one to see, otherwise take turns.
  const mix = enemyMix(s, p);
  const main = (Object.keys(mix) as (keyof typeof mix)[]).sort((a, b) => mix[b] - mix[a])[0];
  const counter = mix[main] >= 3 ? COUNTER[main] : null;
  const keepCitizensGrowing = v.citizens.length < 8;
  for (const b of v.buildings) {
    if (!b.built || b.queue.length >= Math.min(2, MAX_QUEUE) || keepCitizensGrowing) continue;
    const trains = BUILDINGS[b.type].trains;
    if (!trains.length || trains.includes('citizen')) continue;
    let unit = counter && trains.includes(counter) && unitEpoch(counter) <= p.epoch && roll(s) < 0.7 ? counter : pickUnit(v, mem, b);
    if (!unit) continue;
    if (unitEpoch(unit) > p.epoch) unit = pickUnit(v, mem, b);
    if (!unit) continue;
    const cost = unitStats(unit, p.epoch).cost;
    if (!afford(v, cost)) continue;
    issue({ t: 'train', p: p.id, building: b.id, unit });
    spend(v, cost);
    if (!b.rally || Math.abs(b.rally.x - mem.muster.x) > 1) issue({ t: 'rally', p: p.id, building: b.id, x: mem.muster.x, y: mem.muster.y });
  }

  // Defend: enemies near home draw the whole army.
  let threat: Unit | null = null;
  let threatD = Infinity;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || !isEnemy(s, p.id, e.owner)) continue;
    for (const b of v.buildings) {
      const d = distToRect(e.x, e.y, b);
      if (d < 12 && d < threatD) {
        threatD = d;
        threat = e;
      }
    }
  }
  if (threat) {
    const responders = v.army.filter((u) => u.order.k !== 'attack');
    if (responders.length) issue({ t: 'move', p: p.id, ids: responders.map((u) => u.id), x: threat.x, y: threat.y, amove: true });
    mem.attacking = false;
    return;
  }

  // Attack in waves once the army is big enough; between waves, gather at the muster point.
  const ready = v.army.filter((u) => u.order.k === 'idle' || (u.order.k === 'move' && !u.order.amove));
  const waveSize = L.wave + mem.wave * L.waveGrowth;
  const onAttack = v.army.filter((u) => u.order.k === 'attack' || (u.order.k === 'move' && u.order.amove));
  if (mem.attacking && onAttack.length === 0) mem.attacking = false;
  if (s.tick >= secs(L.firstAttack) && v.army.length >= waveSize && !mem.attacking) {
    issue({ t: 'move', p: p.id, ids: v.army.map((u) => u.id), x: enemy.x, y: enemy.y, amove: true });
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
