import { aiStep } from './ai';
import { buildingGuns, updateShots } from './combat';
import { applyCommand } from './commands';
import { EPOCHS, PLAYER_COLORS, START_CITIZENS, START_RES, buildingHp, secs, unitStats } from './data';
import { stampBuilding } from './grid';
import { generateMap } from './mapgen';
import { Spatial } from './spatial';
import type { Building, Command, Difficulty, GameState, MapSize, Player } from './types';
import { R_NONE } from './types';
import { RES_OF_TILE, checkStuck, collide, goTo, routeUnits, separate, setOrder, think, walk } from './units';
import { updateVision } from './vision';
import { countPop, exitSpot, goalForPoint, placeBuilding, spawnUnit } from './world';

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
}

export interface GameSetup {
  seed: number;
  size: MapSize;
  players: PlayerSetup[];
}

const spatials = new WeakMap<GameState, Spatial>();

export function createGame(setup: GameSetup): GameState {
  const map = generateMap(setup.seed, setup.size, setup.players.length);
  const n = map.w * map.h;
  const s: GameState = {
    tick: 0,
    seed: setup.seed,
    size: setup.size,
    w: map.w,
    h: map.h,
    terrain: map.terrain,
    height: map.height,
    res: map.res,
    amount: map.amount,
    block: map.block,
    bldAt: new Int32Array(n),
    blockVersion: 0,
    players: [],
    ents: [],
    byId: new Map(),
    nextId: 1,
    shots: [],
    rng: setup.seed >>> 0,
    events: [],
    winner: -1,
    over: false,
  };
  setup.players.forEach((ps, i) => {
    const start = map.starts[i];
    const p: Player = {
      id: i,
      name: ps.name,
      color: ps.color ?? PLAYER_COLORS[i % PLAYER_COLORS.length],
      ai: ps.ai,
      team: ps.team ?? i,
      res: { ...START_RES },
      epoch: 0,
      pop: 0,
      cap: 0,
      vis: new Uint8Array(n),
      seen: new Uint8Array(n),
      defeated: false,
      stats: { gathered: 0, trained: 0, kills: 0, losses: 0, built: 0, razed: 0 },
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
    for (let k = 0; k < START_CITIZENS; k++) {
      const spot = exitSpot(s, tc, mx, my);
      const u = spawnUnit(s, p.id, 'citizen', spot.x, spot.y);
      u.x += ((k % 3) - 1) * 0.55;
      u.y += (Math.floor(k / 3) - 0.5) * 0.55;
      u.px = u.x;
      u.py = u.y;
    }
  }
  countPop(s);
  updateVision(s);
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

/** Into the next epoch: every unit re-arms and every building is reinforced, keeping their share of health. */
function advanceEpoch(s: GameState, p: Player): void {
  const from = p.epoch;
  const to = from + 1;
  for (const e of s.ents) {
    if (e.owner !== p.id || e.hp <= 0) continue;
    if (e.kind === 'unit') {
      const a = unitStats(e.type, from).hp;
      const b = unitStats(e.type, to).hp;
      e.hp = (e.hp * b) / a;
    } else {
      e.hp = (e.hp * buildingHp(e.type, to)) / buildingHp(e.type, from);
    }
  }
  p.epoch = to;
  s.events.push({ k: 'epoch', owner: p.id, epoch: to });
}

function updateBuilding(s: GameState, sp: Spatial, b: Building): void {
  if (!b.built) return;
  buildingGuns(s, sp, b);
  const p = s.players[b.owner];
  if (b.advance >= 0) {
    b.advance++;
    if (b.advance >= secs(EPOCHS[p.epoch + 1].time)) {
      b.advance = -1;
      advanceEpoch(s, p);
    }
    return;
  }
  const item = b.queue[0];
  if (!item) return;
  const need = secs(unitStats(item.unit, p.epoch).time);
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
  const spot = exitSpot(s, b, toward.x, toward.y);
  const u = spawnUnit(s, p.id, item.unit, spot.x, spot.y);
  p.pop++;
  p.stats.trained++;
  s.events.push({ k: 'trained', id: u.id, owner: p.id, type: item.unit });
  if (b.rally) {
    const t = b.rally.tile;
    if (t >= 0 && u.type === 'citizen' && s.res[t] !== R_NONE) setOrder(u, { k: 'gather', tile: t, res: RES_OF_TILE[s.res[t]], phase: 'go' });
    else {
      const g = goalForPoint(s, b.rally.x, b.rally.y);
      setOrder(u, { k: 'move', x: g.px, y: g.py, amove: false });
      goTo(u, g);
    }
  }
}

function removeDead(s: GameState): void {
  let any = false;
  for (const e of s.ents) {
    if (e.hp > 0) continue;
    any = true;
    const p = s.players[e.owner];
    p.stats.losses++;
    if (e.kind === 'building') {
      stampBuilding(s, e, false);
      s.events.push({ k: 'die', id: e.id, owner: e.owner, type: e.type, x: e.x, y: e.y, building: true, size: e.size, epoch: p.epoch, fx: 0, fy: 1 });
    } else {
      s.events.push({ k: 'die', id: e.id, owner: e.owner, type: e.type, x: e.x, y: e.y, building: false, size: 1, epoch: p.epoch, fx: e.fx, fy: e.fy });
    }
    s.byId.delete(e.id);
  }
  if (any) s.ents = s.ents.filter((e) => e.hp > 0);
}

function checkVictory(s: GameState): void {
  for (const p of s.players) {
    if (p.defeated) continue;
    // Fields alone don't keep a people alive.
    const alive = s.ents.some((e) => e.owner === p.id && e.hp > 0 && !(e.kind === 'building' && e.type === 'farm'));
    if (alive) continue;
    p.defeated = true;
    for (const e of s.ents) if (e.owner === p.id) e.hp = 0;
    s.events.push({ k: 'defeated', owner: p.id });
  }
  const teams = new Set(s.players.filter((p) => !p.defeated).map((p) => p.team));
  if (teams.size <= 1) {
    s.over = true;
    s.winner = teams.size === 1 ? [...teams][0] : -1;
    s.events.push({ k: 'over', winner: s.winner });
  }
}

/** Advance the match one tick, applying the commands given for it first. */
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
  for (const e of s.ents) if (e.kind === 'building' && e.hp > 0) updateBuilding(s, sp, e);
  for (const e of s.ents) if (e.kind === 'unit' && e.hp > 0) think(s, sp, e);
  routeUnits(s);
  for (const e of s.ents) if (e.kind === 'unit' && e.hp > 0) walk(s, e);
  sp.rebuild(s);
  separate(s, sp);
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0) continue;
    collide(s, e);
    checkStuck(s, e);
  }
  updateShots(s);
  removeDead(s);
  if (s.tick % 4 === 0) updateVision(s);
  if (s.tick % 20 === 0) checkVictory(s);
  s.tick++;
}

/** A fingerprint of the whole match, to check that two runs stayed identical. */
export function checksum(s: GameState): number {
  let h = 2166136261;
  const mix = (v: number) => {
    // Fold the float's exact bits in, so the tiniest difference shows.
    const f = new Float64Array([v]);
    const u = new Uint32Array(f.buffer);
    h = Math.imul(h ^ u[0], 16777619);
    h = Math.imul(h ^ u[1], 16777619);
  };
  mix(s.tick);
  for (const e of s.ents) {
    mix(e.id);
    mix(e.hp);
    mix(e.x);
    mix(e.y);
    if (e.kind === 'unit') mix(e.carry);
    else mix(e.progress);
  }
  for (const p of s.players) for (const r of ['food', 'wood', 'stone', 'gold'] as const) mix(p.res[r]);
  for (const sh of s.shots) mix(sh.t);
  return h >>> 0;
}
