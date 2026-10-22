import { aiStep } from './ai';
import { workStep } from './works';
import { beaconStep } from './beacon';
import { warCampStep } from './warcamp';
import { spoilsStep } from './spoils';
import { raiseCamps } from './steppe';
import { giftFlock, sheepStep } from './flocks';
import { faithStep } from './consecrate';
import { turnSeason } from './seasons';
import { markHomeHerds, turnYear } from './year';
import { fillSnares } from './snares';
import { hitAnimal, spawnAnimal, updateAnimals } from './animals';
import { markGoals, scenarioStep, startScenario } from './campaign';
import { buildingGuns, updateShots } from './combat';
import { applyCommand } from './commands';
import { AGES, AURA, AUTO_WORK, unitEpoch, CIV_IDS, HEART, LANDMARKS, RAIDER, RELIC, DEATHMATCH_RES, EPOCHS, domainOf, EPOCH_START_RES, MARKET, MILITARY, PLAYER_COLORS, START_CITIZENS, START_RES, TECHS, WONDER_SECONDS, secs } from './data';
import { AIR, NAVAL, stampBuilding } from './grid';
import { denWolves, generateMap } from './mapgen';
import { Spatial } from './spatial';
import { updateRelics } from './relics';
import { elmoStep } from './elmo';
import { galvanicStep } from './galvanic';
import { hemoStep } from './hemo';
import { forkStep } from './fork';
import { bloodStep, freeCaptives } from './blood';
import { reclaimStep, remember } from './reclaim';
import { leaveRubble, salvageStep } from './salvage';
import { cacheStep, dropOre, spillStore } from './caches';
import { kegStep, millStep } from './powder';
import { stockPosts } from './oretrade';
import { sortieStep } from './sortie';
import { fairStep } from './fair';
import { landmarkStep } from './landmarks';
import { tidingStep } from './tidings';
import { atPost } from './trade';
import { modsOf, trainTimeFor } from './stats';
import { attrition } from './borders';
import { tributeStep } from './tribute';
import { householdStep } from './household';
import { sickStep } from './sickness';
import { seraiStep, tollStep } from './passage';
import { mercStep } from './merc';
import { KIN, NOMAD } from './data';
import { ageOf, chartLand, isHire, barred, journeyOf, markKeepsake, noteWalked, trainsAt, workSteps } from './ages';
import type { AgeId, Building, CivId, Command, Difficulty, GameMode, GameState, HomelandId, MapSize, MapType, Player, UnitType } from './types';
import { RARES, RES, R_FISH, R_NONE } from './types';
import { legionKind, legionary } from './legion';
import { mineable } from './household';
import { isNomad } from './nomad';
import { RES_OF_TILE, autoWork, rallyNode, carryCargo, checkStuck, collide, findResource, routeUnits, separate, setOrder, think, ungarrison, walk } from './units';
import { updateVision } from './vision';
import { countPop, exitSpot, maxHp, placeBuilding, refund, restat, spawnUnit } from './world';

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
  /**
   * The homeland (#473): 'random' rolls it from the seed (a match from the menu or an online room), or one
   * named. Left out, it is the Glade, so a setup from before homelands draws the world it always did.
   */
  homeland?: HomelandId | 'random';
}

const spatials = new WeakMap<GameState, Spatial>();

export function createGame(setup: GameSetup): GameState {
  const mapType = setup.mapType ?? 'continental';
  // Campaign maps are drawn as they always were: no deposits that only some seeds hold.
  const map = generateMap(setup.seed, setup.size, setup.players.length, mapType, !setup.scenario, !setup.scenario, setup.homeland === 'random' ? undefined : (setup.homeland ?? 'glade'));
  const n = map.w * map.h;
  const startEpoch = Math.max(0, Math.min(EPOCHS.length - 1, setup.startEpoch ?? 0));
  const mode = setup.mode ?? 'conquest';
  const s: GameState = {
    tick: 0,
    seed: setup.seed,
    size: setup.size,
    mapType,
    homeland: map.homeland,
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
    landTeam: -1,
    landTimer: -1,
    posts: [],
    bogIron: map.bogIron,
    rares: map.rares,
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
      stats: { gathered: 0, trained: 0, kills: 0, losses: 0, built: 0, razed: 0, converted: 0, techs: 0, traded: 0, iron: 0, relicGold: 0, fished: 0, hunted: 0 },
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
  if (!setup.scenario) stockPosts(s);
  if (map.ruins.length) s.ruins = map.ruins.map((r) => ({ id: s.nextId++, x: r.x, y: r.y, find: r.find, dug: 0, by: -1 }));
  for (const b of map.wild) spawnAnimal(s, b.x, b.y, b.kind);
  markHomeHerds(s);
  if (map.caves.length) s.caves = map.caves.map((c) => ({ ...c }));
  if (map.landmarks.length) s.landmarks = map.landmarks.map((m) => ({ id: s.nextId++, x: m.x, y: m.y, kind: m.kind, owner: -1, claim: 0, by: -1 }));
  for (const c of map.caves) if (c.den) for (const p of denWolves(c.tile, map.w)) spawnAnimal(s, p.x, p.y, 'wolf');
  // Each raider camp's band keeps its fire as home (what ties them together).
  // Their ids come from a range of their own, so a camp on the map renumbers nothing else.
  let band = 0;
  for (const c of map.camps) {
    for (let k = 0; k < RAIDER.guards; k++) {
      const a = spawnAnimal(s, c.x + (k - 1) * 0.6, c.y + (k === 1 ? 0.5 : 0), 'raider');
      s.nextId--;
      a.id = RAIDER.idBase + band++;
      a.homeX = c.x;
      a.homeY = c.y;
    }
  }
  // Born on the move (#501): a nomad people starts with its flock about the camp.
  for (const p of s.players) if (isNomad(p)) giftFlock(s, p, NOMAD.start);
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


/**
 * Into another age (#37): every unit re-arms to the age's tier and every building is rebuilt in its
 * style. On a step back (#47) they fall back to the older forms, and whatever the new age can't train
 * or research is taken off the queues and refunded.
 */
export function enterAge(s: GameState, p: Player, to: AgeId, back = false): void {
  const tier = AGES[to].tier;
  const from = ageOf(p);
  // The first steps onto the steppe bring the herds (#308).
  const herds = !!AGES[to].mobile && !p.walked?.includes(to);
  restat(s, p, () => {
    p.epoch = tier;
    p.age = to;
    // The age left counts as walked for good, even one the people began in (#555 s11: the step-back plan says so).
    noteWalked(p, from);
    noteWalked(p, to);
    // A step back suspends what lies above the new tier; any change of age brings back what fits.
    const off = back ? p.techs.filter((t) => TECHS[t].epoch > tier) : [];
    const on = (p.suspended ?? []).filter((t) => TECHS[t].epoch <= tier);
    if (!off.length && !on.length) return;
    const still = [...(p.suspended ?? []).filter((t) => TECHS[t].epoch > tier), ...off];
    p.techs = [...p.techs.filter((t) => !off.includes(t)), ...on];
    if (still.length) p.suspended = still;
    else delete p.suspended;
  });
  if (back) p.backAt = s.tick;
  if (herds) giftFlock(s, p);
  // The age left keeps one building at its work (#555 s11).
  if (from !== to) {
    const kept = markKeepsake(s, p, from);
    if (kept) s.events.push({ k: 'keepsake', owner: p.id, id: kept.id, age: from, x: kept.x, y: kept.y });
  }
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== p.id || !e.queue.length) continue;
    const keep = e.queue.filter((q) =>
      q.tech ? TECHS[q.tech].epoch <= p.epoch : trainsAt(p, e.type).includes(q.unit!) && unitEpoch(q.unit!) <= p.epoch && !barred(p, q.unit!),
    );
    if (keep.length === e.queue.length) continue;
    for (const q of e.queue) if (!keep.includes(q)) refund(p, q.paid);
    e.queue = keep;
  }
  s.events.push({ k: 'epoch', owner: p.id, epoch: p.epoch, age: to, ...(back ? { back: true } : {}) });
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
    const road = journeyOf(p, b);
    if (!road) {
      // The road is gone (the age changed under it): stand down.
      b.advance = -1;
      delete b.advanceTo;
      delete b.back;
      return;
    }
    b.advance++;
    if (b.advance >= secs(road.time)) {
      b.advance = -1;
      delete b.advanceTo;
      delete b.back;
      enterAge(s, p, road.to, road.back);
    }
    return;
  }
  const item = b.queue[0];
  if (!item) return;
  // In the Age of Lightning a coil's field speeds the work and the dark slows it (#231); elsewhere one step a tick.
  const steps = workSteps(s, b);
  if (item.tech) {
    item.done += steps;
    if (item.done < secs(TECHS[item.tech].time)) return;
    b.queue.shift();
    const tech = item.tech;
    restat(s, p, () => p.techs.push(tech));
    p.stats.techs++;
    s.events.push({ k: 'researched', owner: p.id, tech });
    if (tech === 'chart') chartLand(s, p);
    return;
  }
  const unit = item.unit!;
  // The Hearth's kin (#463 s1) come together, after their own time, and need room for all of them.
  const kin = item.kin ?? 1;
  const need = secs(item.kin ? KIN.time : trainTimeFor(s, p.id, unit, b.type));
  if (item.done < need) {
    item.done = Math.min(need, item.done + steps);
    if (item.done < need) return;
  }
  if (p.pop + kin > p.cap) {
    if (item.done === need) {
      item.done = need + 1;
      s.events.push({ k: 'refused', owner: p.id, why: 'Build more houses' });
    }
    return;
  }
  b.queue.shift();
  for (let i = 0; i < kin; i++) bringOut(s, p, b, unit);
  if (item.kin) s.events.push({ k: 'kin', owner: p.id, n: kin, x: b.x, y: b.y });
}

/** A unit trained (or come as kin) steps out of its building and goes where the rally sends it. */
function bringOut(s: GameState, p: Player, b: Building, unit: UnitType): void {
  const toward = b.rally ?? { x: s.w / 2, y: s.h / 2 };
  const domain = domainOf(unit);
  // Ships put out onto the water by their dock; aircraft take off from anywhere about the field.
  const spot = exitSpot(s, b, toward.x, toward.y, domain === 'water' ? NAVAL : domain === 'air' ? AIR : undefined);
  const u = spawnUnit(s, p.id, unit, spot.x, spot.y);
  p.pop++;
  p.stats.trained++;
  // A soldier hired for gold at the Market is a sword for hire (`MERC`): it draws wages from now on.
  if (isHire(p, b.type, unit)) u.merc = 0;
  // The deed of the Age of Total War (#313): foot soldiers trained at the front.
  if (b.type === 'warcamp') p.stats.campTrained = (p.stats.campTrained ?? 0) + 1;
  s.events.push({ k: 'trained', id: u.id, owner: p.id, type: unit });
  const fishing = (t: number) => u.type === 'fisher' && t >= 0 && s.res[t] === R_FISH;
  const working = (t: number) => t >= 0 && s.res[t] !== R_NONE && s.res[t] !== R_FISH && ((u.type === 'citizen' && mineable(p, s.res[t])) || (legionary(s, u) && legionKind(s.res[t])));
  // A rally point on a trading post puts new traders straight on the road.
  const post = u.type === 'trader' && b.rally ? s.posts.find((t) => atPost(t, b.rally!.x, b.rally!.y)) : undefined;
  if (post) setOrder(u, { k: 'trade', post: post.id, market: b.type === 'market' ? b.id : 0, phase: 'go' });
  else if (b.rally) {
    // A flag on a tree that has since been felled still means "wood here": the nearest of its kind by the flag (#344).
    const t = working(b.rally.tile) || fishing(b.rally.tile) ? b.rally.tile : rallyNode(s, u, b.rally);
    if (working(t) || fishing(t)) setOrder(u, { k: 'gather', tile: t, res: RES_OF_TILE[s.res[t]], phase: 'go' });
    else setOrder(u, { k: 'move', x: b.rally.x, y: b.rally.y, amove: false, started: false });
  } else if (u.type === 'fisher') {
    // Fishing boats go straight to the nearest shoal.
    const t = findResource(s, R_FISH, b.x, b.y, 16);
    if (t >= 0) setOrder(u, { k: 'gather', tile: t, res: 'food', phase: 'go' });
  } else autoWork(s, u, b.x, b.y, AUTO_WORK.trained);
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
      // Those inside run out before it falls, and its captives (#355) go free.
      ungarrison(s, e);
      freeCaptives(s, e);
      stampBuilding(s, e, false);
      remember(s, e);
      leaveRubble(s, e);
      spillStore(s, e);
      s.events.push({ k: 'die', id: e.id, owner: e.owner, type: e.type, x: e.x, y: e.y, building: true, size: e.size, epoch: p.epoch, fx: e.dir, fy: 1 });
    } else {
      dropOre(s, e);
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
  // And so does keeping every landmark.
  if ((s.landTeam ?? -1) >= 0 && s.landTimer === 0) {
    s.over = true;
    s.winner = s.landTeam!;
    for (const p of s.players) if (p.team !== s.winner) p.defeated = true;
    s.events.push({ k: 'over', winner: s.winner, how: 'lands' });
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
    // The heart (#452): with no Town Center standing, started or on a wagon, a people has `HEART.grace` seconds
    // to lay a new foundation. Regicide has its King, and a campaign chapter its own goals.
    if (s.mode !== 'regicide' && !s.scenario) {
      const heart = s.ents.some((e) => e.owner === p.id && e.hp > 0 && ((e.kind === 'building' && e.type === 'towncenter') || (e.kind === 'unit' && e.packed === 'towncenter')));
      if (heart) {
        if (p.heartless !== undefined) delete p.heartless;
      } else if (p.heartless === undefined) {
        p.heartless = s.tick + secs(HEART.grace);
        s.events.push({ k: 'heartless', owner: p.id, left: HEART.grace });
      } else if (s.tick >= p.heartless) {
        p.defeated = true;
        for (const e of s.ents) if (e.owner === p.id) e.hp = 0;
        s.events.push({ k: 'defeated', owner: p.id });
        continue;
      }
    }
    // Fields, snares and walls alone don't keep a people alive, nor do unarmed boats (fishing boats, merchant
    // ships): none of them can build or fight, so a people down to them can never come back, and a rival
    // at its population cap with no fleet could never sink them.
    const alive = s.ents.some((e) => e.owner === p.id && e.hp > 0 && !(e.kind === 'building' && (e.type === 'farm' || e.type === 'wall' || e.type === 'gate' || e.type === 'snare')) && !(e.kind === 'unit' && (e.type === 'fisher' || e.type === 'cog')));
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
  // Each landmark kept.
  for (const m of s.landmarks ?? []) if (m.owner === p.id) wonder += LANDMARKS.score;
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
  updateAnimals(s, sp, (a) => sheepStep(s, sp, a));
  turnSeason(s);
  turnYear(s);
  fillSnares(s);
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
  landmarkStep(s);
  elmoStep(s);
  galvanicStep(s);
  reclaimStep(s);
  salvageStep(s);
  cacheStep(s);
  millStep(s);
  kegStep(s);
  sortieStep(s);
  fairStep(s);
  attrition(s);
  tributeStep(s);
  householdStep(s);
  sickStep(s);
  tollStep(s);
  mercStep(s);
  seraiStep(s);
  workStep(s);
  beaconStep(s);
  warCampStep(s);
  spoilsStep(s);
  hemoStep(s);
  forkStep(s);
  bloodStep(s);
  raiseCamps(s);
  faithStep(s);
  tidingStep(s);
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
  for (const r of s.ruins ?? []) {
    mix(r.dug);
    mix(r.by);
  }
  for (const f of s.fallen ?? []) {
    mix(f.owner);
    mix(f.tx);
    mix(f.ty);
    mix(f.until);
  }
  for (const r of s.rubble ?? []) {
    mix(r.id);
    mix(r.done);
    mix(r.until);
  }
  for (const c of s.caches ?? []) {
    mix(c.id);
    mix(c.n);
  }
  for (const r of RARES) mix(s.oreSold?.[r] ?? 0);
  for (const k of s.kegs ?? []) {
    mix(k.id);
    mix(k.at);
  }
  for (const m of s.landmarks ?? []) {
    mix(m.owner);
    mix(m.claim);
    mix(m.by);
  }
  for (const p of s.players) {
    mix(p.taint ?? 0);
    mix(p.fever?.sev ?? 0);
    mix(p.kegs ?? 0);
    mix(p.grind ?? 0);
  }
  for (const p of s.players) for (const r of RES) mix(p.res[r]);
  for (const sh of s.shots) mix(sh.t);
  return h >>> 0;
}
