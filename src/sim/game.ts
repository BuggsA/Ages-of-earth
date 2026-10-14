import { aiStep } from './ai';
import { hitAnimal, spawnAnimal, updateAnimals } from './animals';
import { markGoals, scenarioStep, startScenario } from './campaign';
import { buildingGuns, updateShots } from './combat';
import { applyCommand } from './commands';
import { AGES, AURA, CIV_IDS, RELIC, DEATHMATCH_RES, EPOCHS, domainOf, EPOCH_START_RES, MARKET, MILITARY, PLAYER_COLORS, START_CITIZENS, START_RES, TECHS, WONDER_SECONDS, secs } from './data';
import { AIR, NAVAL, stampBuilding } from './grid';
import { generateMap } from './mapgen';
import { Spatial } from './spatial';
import { updateRelics } from './relics';
import { atPost } from './trade';
import { modsOf, trainTimeFor } from './stats';
import { roadTo, surveyFinds } from './ages';
import type { AgeId, Building, CivId, Command, Difficulty, GameMode, GameState, MapSize, MapType, Player } from './types';
import { RES, R_FISH, R_NONE } from './types';
import { RES_OF_TILE, carryCargo, checkStuck, collide, findResource, routeUnits, separate, setOrder, think, ungarrison, walk } from './units';
import { updateVision } from './vision';
import { countPop, exitSpot, maxHp, placeBuilding, spawnUnit } from './world';

/**
 * The match: made from a seed and a list of players, then advanced one fixed tick at a time with the
 * commands given for that tick. Nothing here reads the clock or Math.random, and no sine or arctangent
 * (which can differ between browsers) is used, so every browser that is given the same commands plays
 * out the same match.
 */

export interface PlayerSetup {
  name: string;
  color?: string;
  ai: Difficulty | null;
  team?: number;
  /** A civilization, or left out for one picked by the seed. */
  civ?: CivId;
}

export interface GameSetup {
  seed: number;
  size: MapSize;
  players: PlayerSetup[];
  mapType?: MapType;
  /** The epoch everyone starts in (with more resources the later it is). */
  startEpoch?: number;
  /** Minutes of peace before anyone may fight. */
  peaceMinutes?: number;
  mode?: GameMode;
  /** Seconds a finished wonder must stand to win. */
  wonderSeconds?: number;
  /** A campaign scenario's id: adds its goals, raids and gifts. */
  scenario?: string;
}

const spatials = new WeakMap<GameState, Spatial>();

export function createGame(setup: GameSetup): GameState {
  const mapType = setup.mapType ?? 'continental';
  // Campaign maps are drawn as they always were: no deposits that only some seeds hold.
  const map = generateMap(setup.seed, setup.size, setup.players.length, mapType, !setup.scenario);
  const n = map.w * map.h;
  const startEpoch = Math.max(0, Math.min(EPOCHS.length - 1, setup.startEpoch ?? 0));
  const mode = setup.mode ?? 'conquest';
  const s: GameState = {
    tick: 0,
    seed: setup.seed,
    size: setup.size,
    mapType,
    mode,
    kings: setup.players.map(() => 0),
    w: map.w,
    h: map.h,
    terrain: map.terrain,
    height: map.height,
    res: map.res,
    amount: map.amount,
    block: map.block,
    bldAt: new Int32Array(n),
    gateTeam: new Int8Array(n).fill(-1),
    blockVersion: 0,
    players: [],
    ents: [],
    byId: new Map(),
    animals: [],
    relics: [],
    relicTeam: -1,
    relicTimer: -1,
    posts: [],
    bogIron: map.bogIron,
    nextId: 1,
    shots: [],
    rng: setup.seed >>> 0,
    market: { ...MARKET.start },
    peaceUntil: secs((setup.peaceMinutes ?? 0) * 60),
    wonderTime: secs(setup.wonderSeconds ?? WONDER_SECONDS),
    ai: {},
    events: [],
    winner: -1,
    over: false,
    scenario: null,
  };
  if (setup.scenario) startScenario(s, setup.scenario);
  setup.players.forEach((ps, i) => {
    const start = map.starts[i];
    const extra = EPOCH_START_RES[startEpoch];
    const p: Player = {
      id: i,
      name: ps.name,
      color: ps.color ?? PLAYER_COLORS[i % PLAYER_COLORS.length],
      civ: ps.civ ?? CIV_IDS[(setup.seed + i * 7919) % CIV_IDS.length],
      ai: ps.ai,
      team: ps.team ?? i,
      res: mode === 'deathmatch' ? { ...DEATHMATCH_RES } : { food: START_RES.food + extra.food, wood: START_RES.wood + extra.wood, stone: START_RES.stone + extra.stone, gold: START_RES.gold + extra.gold },
      epoch: startEpoch,
      techs: [],
      statsVersion: 0,
      pop: 0,
      cap: 0,
      vis: new Uint8Array(n),
      seen: new Uint8Array(n),
      defeated: false,
      stats: { gathered: 0, trained: 0, kills: 0, losses: 0, built: 0, razed: 0, converted: 0, techs: 0, traded: 0, iron: 0 },
      history: [],
      startX: start.x,
      startY: start.y,
      alert: -9999,
    };
    s.players.push(p);
  });
  for (const p of s.players) {
    const tc = placeBuilding(s, p.id, 'towncenter', p.startX - 2, p.startY - 2, true);
    // Citizens stand in a little arc on the side facing the middle of the map.
    const mx = s.w / 2;
    const my = s.h / 2;
    const count = START_CITIZENS + modsOf(s, p.id).extraCitizens;
    for (let k = 0; k < count; k++) {
      const spot = exitSpot(s, tc, mx, my);
      const u = spawnUnit(s, p.id, 'citizen', spot.x, spot.y);
      u.x += ((k % 3) - 1) * 0.55;
      u.y += (Math.floor(k / 3) - 0.5) * 0.55;
      u.px = u.x;
      u.py = u.y;
      u.guardX = u.x;
      u.guardY = u.y;
    }
  }
  if (s.mode === 'regicide') {
    // Each people's King starts by the Town Center.
    for (const p of s.players) {
      const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === p.id && e.type === 'towncenter')!;
      const spot = exitSpot(s, tc, s.w - p.startX, s.h - p.startY);
      s.kings[p.id] = spawnUnit(s, p.id, 'hero', spot.x, spot.y).id;
    }
  }
  for (const d of map.deer) spawnAnimal(s, d.x, d.y);
  for (const r of map.relics) s.relics.push({ id: s.nextId++, x: r.x, y: r.y, carrier: 0, temple: 0 });
  for (const t of map.posts) s.posts.push({ id: s.nextId++, x: t.x, y: t.y });
  countPop(s);
  updateVision(s);
  // Everyone knows the lie of the land around home.
  for (const p of s.players) {
    for (let y = p.startY - 18; y <= p.startY + 18; y++) {
      for (let x = p.startX - 18; x <= p.startX + 18; x++) {
        if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
        const dx = x + 0.5 - p.startX;
        const dy = y + 0.5 - p.startY;
        if (dx * dx + dy * dy <= 18 * 18) p.seen[y * s.w + x] = 1;
      }
    }
  }
  return s;
}

function spatial(s: GameState): Spatial {
  let sp = spatials.get(s);
  if (!sp) {
    sp = new Spatial();
    spatials.set(s, sp);
  }
  return sp;
}

/** Change a player's stats (an epoch, a technology), keeping every unit's and building's share of health. */
function restat(s: GameState, p: Player, change: () => void): void {
  const before = new Map<number, number>();
  for (const e of s.ents) if (e.owner === p.id && e.hp > 0) before.set(e.id, maxHp(s, e));
  change();
  p.statsVersion++;
  for (const e of s.ents) {
    const was = before.get(e.id);
    if (!was) continue;
    e.hp = (e.hp * maxHp(s, e)) / was;
  }
}

/** Into another age (#37): every unit re-arms to the age's tier and every building is reinforced. */
function enterAge(s: GameState, p: Player, to: AgeId): void {
  restat(s, p, () => {
    p.epoch = AGES[to].tier;
    p.age = to;
  });
  s.events.push({ k: 'epoch', owner: p.id, epoch: p.epoch, age: to });
}

function updateBuilding(s: GameState, sp: Spatial, b: Building): void {
  if (!b.built) return;
  buildingGuns(s, sp, b);
  const p = s.players[b.owner];
  // Shelter heals.
  if (b.garrison.length && s.tick % 20 === 0) {
    for (const id of b.garrison) {
      const u = s.byId.get(id);
      if (u && u.kind === 'unit') u.hp = Math.min(maxHp(s, u), u.hp + 2);
    }
  }
  if (b.timer > 0) b.timer--;
  if (b.advance >= 0) {
    const road = roadTo(p, b.advanceTo);
    if (!road) {
      // The road is gone (the age changed under it): stand down.
      b.advance = -1;
      delete b.advanceTo;
      return;
    }
    b.advance++;
    if (b.advance >= secs(road.time)) {
      b.advance = -1;
      delete b.advanceTo;
      enterAge(s, p, road.to);
    }
    return;
  }
  const item = b.queue[0];
  if (!item) return;
  if (item.tech) {
    if (++item.done < secs(TECHS[item.tech].time)) return;
    b.queue.shift();
    const tech = item.tech;
    restat(s, p, () => p.techs.push(tech));
    p.stats.techs++;
    s.events.push({ k: 'researched', owner: p.id, tech });
    if (TECHS[tech].survey) s.events.push({ k: 'survey', owner: p.id, tech, found: surveyFinds(s, tech) });
    return;
  }
  const unit = item.unit!;
  const need = secs(trainTimeFor(s, p.id, unit, b.type));
  if (item.done < need) {
    item.done++;
    if (item.done < need) return;
  }
  if (p.pop >= p.cap) {
    if (item.done === need) {
      item.done = need + 1;
      s.events.push({ k: 'refused', owner: p.id, why: 'Build more houses' });
    }
    return;
  }
  b.queue.shift();
  const toward = b.rally ?? { x: s.w / 2, y: s.h / 2 };
  const domain = domainOf(unit);
  // Ships put out onto the water by their dock; aircraft take off from anywhere about the field.
  const spot = exitSpot(s, b, toward.x, toward.y, domain === 'water' ? NAVAL : domain === 'air' ? AIR : undefined);
  const u = spawnUnit(s, p.id, unit, spot.x, spot.y);
  p.pop++;
  p.stats.trained++;
  s.events.push({ k: 'trained', id: u.id, owner: p.id, type: unit });
  const fishing = (t: number) => u.type === 'fisher' && t >= 0 && s.res[t] === R_FISH;
  const working = (t: number) => u.type === 'citizen' && t >= 0 && s.res[t] !== R_NONE && s.res[t] !== R_FISH;
  // A rally point on a trading post puts new traders straight on the road.
  const post = u.type === 'trader' && b.rally ? s.posts.find((t) => atPost(t, b.rally!.x, b.rally!.y)) : undefined;
  if (post) setOrder(u, { k: 'trade', post: post.id, market: b.type === 'market' ? b.id : 0, phase: 'go' });
  else if (b.rally) {
    const t = b.rally.tile;
    if (working(t) || fishing(t)) setOrder(u, { k: 'gather', tile: t, res: RES_OF_TILE[s.res[t]], phase: 'go' });
    else setOrder(u, { k: 'move', x: b.rally.x, y: b.rally.y, amove: false, started: false });
  } else if (u.type === 'fisher') {
    // Fishing boats go straight to the nearest shoal.
    const t = findResource(s, R_FISH, b.x, b.y, 16);
    if (t >= 0) setOrder(u, { k: 'gather', tile: t, res: 'food', phase: 'go' });
  }
}

/** Heroes inspire soldiers near them: they strike harder and slowly heal. */
function auras(s: GameState, sp: Spatial): void {
  if (s.tick % 5 !== 0) return;
  for (const h of s.ents) {
    if (h.kind !== 'unit' || h.type !== 'hero' || h.hp <= 0 || h.inside) continue;
    sp.near(h.x, h.y, AURA.radius, (u) => {
      if (u.owner !== h.owner || u.hp <= 0 || !MILITARY.includes(u.type)) return;
      const dx = u.x - h.x;
      const dy = u.y - h.y;
      if (dx * dx + dy * dy > AURA.radius * AURA.radius) return;
      u.aura = s.tick;
      if (s.tick % 20 === 0) u.hp = Math.min(maxHp(s, u), u.hp + AURA.heal);
    });
  }
}

function removeDead(s: GameState): void {
  // Passengers go down with their ship.
  for (const e of s.ents) if (e.kind === 'unit' && e.hp <= 0 && e.cargo.length) for (const id of e.cargo) {
    const c = s.byId.get(id);
    if (c) c.hp = 0;
  }
  let any = false;
  for (const e of s.ents) {
    if (e.hp > 0) continue;
    any = true;
    const p = s.players[e.owner];
    p.stats.losses++;
    if (e.kind === 'building') {
      // Those inside run out before it falls.
      ungarrison(s, e);
      stampBuilding(s, e, false);
      s.events.push({ k: 'die', id: e.id, owner: e.owner, type: e.type, x: e.x, y: e.y, building: true, size: e.size, epoch: p.epoch, fx: e.dir, fy: 1 });
    } else {
      if (e.inside) {
        const b = s.byId.get(e.inside);
        if (b && b.kind === 'building') b.garrison = b.garrison.filter((id) => id !== e.id);
        else if (b && b.kind === 'unit') b.cargo = b.cargo.filter((id) => id !== e.id);
      }
      s.events.push({ k: 'die', id: e.id, owner: e.owner, type: e.type, x: e.x, y: e.y, building: false, size: 1, epoch: p.epoch, fx: e.fx, fy: e.fy });
    }
    s.byId.delete(e.id);
  }
  if (any) s.ents = s.ents.filter((e) => e.hp > 0);
}

function checkVictory(s: GameState): void {
  // A wonder that has stood long enough wins for its builder's side.
  for (const e of s.ents) {
    if (e.kind === 'building' && e.type === 'wonder' && e.built && e.hp > 0 && e.timer === 0) {
      s.over = true;
      s.winner = s.players[e.owner].team;
      for (const p of s.players) if (p.team !== s.winner) p.defeated = true;
      s.events.push({ k: 'over', winner: s.winner, how: 'wonder' });
      return;
    }
  }
  // So does keeping every relic for as long.
  if (s.relicTeam >= 0 && s.relicTimer === 0) {
    s.over = true;
    s.winner = s.relicTeam;
    for (const p of s.players) if (p.team !== s.winner) p.defeated = true;
    s.events.push({ k: 'over', winner: s.winner, how: 'relics' });
    return;
  }
  for (const p of s.players) {
    if (p.defeated) continue;
    // Regicide: a people whose King has fallen is lost.
    const king = s.kings[p.id];
    if (king && !s.byId.has(king)) {
      p.defeated = true;
      for (const e of s.ents) if (e.owner === p.id) e.hp = 0;
      s.events.push({ k: 'defeated', owner: p.id });
      continue;
    }
    // Fields and walls alone don't keep a people alive.
    const alive = s.ents.some((e) => e.owner === p.id && e.hp > 0 && !(e.kind === 'building' && (e.type === 'farm' || e.type === 'wall' || e.type === 'gate')));
    if (alive) continue;
    p.defeated = true;
    for (const e of s.ents) if (e.owner === p.id) e.hp = 0;
    s.events.push({ k: 'defeated', owner: p.id });
  }
  const teams = new Set(s.players.filter((p) => !p.defeated).map((p) => p.team));
  if (teams.size <= 1) {
    s.over = true;
    s.winner = teams.size === 1 ? [...teams][0] : -1;
    s.events.push({ k: 'over', winner: s.winner, how: 'conquest' });
  }
}

/** A player's score: what they gathered, built, learned and won in battle (shown during and after the match). */
export function scoreOf(s: GameState, p: Player): number {
  let wonder = 0;
  for (const e of s.ents) if (e.kind === 'building' && e.owner === p.id && e.type === 'wonder' && e.built) wonder += 500;
  // Each relic kept in a Temple.
  for (const r of s.relics) if (r.temple && s.byId.get(r.temple)?.owner === p.id) wonder += RELIC.score;
  return Math.round(p.stats.gathered / 10 + p.stats.kills * 8 + p.stats.razed * 15 + p.stats.converted * 10 + p.stats.techs * 25 + p.epoch * 150 + p.stats.built * 3 + wonder);
}

/** Every 30 seconds, a note of how each player is doing, for the timeline after the match. */
function sample(s: GameState): void {
  for (const p of s.players) {
    let military = 0;
    for (const e of s.ents) if (e.kind === 'unit' && e.owner === p.id && MILITARY.includes(e.type)) military++;
    p.history.push({ tick: s.tick, pop: p.defeated ? 0 : p.pop, military, gathered: p.stats.gathered, score: scoreOf(s, p), epoch: p.epoch });
  }
}

/** Advance the match one tick, applying the commands given for it first. */
/** Prices drift back toward where they started (integers only, so it stays deterministic). */
function driftMarket(s: GameState): void {
  for (const r of ['food', 'wood', 'stone'] as const) {
    const home = MARKET.start[r];
    const d = home - s.market[r];
    s.market[r] += d > 0 ? Math.min(d, MARKET.recover) : -Math.min(-d, MARKET.recover);
  }
}

export function step(s: GameState, cmds: readonly Command[] = []): void {
  s.events = [];
  if (s.over) return;
  for (const c of cmds) applyCommand(s, c);
  aiStep(s);
  const sp = spatial(s);
  sp.rebuild(s);
  countPop(s);
  for (const e of s.ents) {
    if (e.kind !== 'unit') continue;
    e.px = e.x;
    e.py = e.y;
  }
  auras(s, sp);
  for (const e of s.ents) if (e.kind === 'building' && e.hp > 0) updateBuilding(s, sp, e);
  for (const e of s.ents) if (e.kind === 'unit' && e.hp > 0) think(s, sp, e);
  routeUnits(s);
  for (const e of s.ents) if (e.kind === 'unit' && e.hp > 0 && !e.inside) walk(s, e);
  updateAnimals(s);
  sp.rebuild(s);
  separate(s, sp);
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside) continue;
    collide(s, e);
    checkStuck(s, e);
  }
  carryCargo(s);
  updateShots(s, sp, (a, damage, x, y) => hitAnimal(s, a, damage, x, y));
  updateRelics(s);
  removeDead(s);
  if (s.tick % 4 === 0) updateVision(s);
  if (s.tick % 20 === 0) {
    scenarioStep(s);
    if (!s.over) checkVictory(s);
    if (s.scenario && s.over && !s.scenario.result) {
      markGoals(s);
      s.scenario.result = s.winner === s.players[0].team ? 'win' : 'lose';
    }
  }
  if (s.tick > 0 && s.tick % secs(MARKET.every) === 0) driftMarket(s);
  if (s.tick % secs(30) === 0) sample(s);
  s.tick++;
}

/** A fingerprint of the whole match, to check that two runs stayed identical. */
export function checksum(s: GameState): number {
  let h = 2166136261;
  const f = new Float64Array(1);
  const u = new Uint32Array(f.buffer);
  const mix = (v: number) => {
    // Fold the float's exact bits in, so the tiniest difference shows.
    f[0] = v;
    h = Math.imul(h ^ u[0], 16777619);
    h = Math.imul(h ^ u[1], 16777619);
  };
  mix(s.tick);
  for (const e of s.ents) {
    mix(e.id);
    mix(e.owner);
    mix(e.hp);
    mix(e.x);
    mix(e.y);
    if (e.kind === 'unit') mix(e.carry);
    else mix(e.progress);
  }
  for (const a of s.animals) {
    mix(a.x);
    mix(a.y);
  }
  for (const r of s.relics) {
    mix(r.x);
    mix(r.y);
    mix(r.carrier);
    mix(r.temple);
  }
  for (const p of s.players) for (const r of RES) mix(p.res[r]);
  for (const sh of s.shots) mix(sh.t);
  return h >>> 0;
}
