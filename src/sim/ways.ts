import { BUILDINGS, KILL_CAMP, KIN, RAID, WAY, WAYS, WAY_IDS, WAY_LEAN, secs } from './data';
import { seasonAt } from './seasons';
import { canAfford, isEnemy, pay, restat, townCenters } from './world';
import { RES, R_BERRY, R_MEAT } from './types';
import type { Building, BuildingType, GameState, Player, Unit, WayId } from './types';

/** Ways (#336): why a people can't take this one now, or null if they can. */
export function wayProblem(s: GameState, p: Player, way: WayId): string | null {
  if (!WAYS[way]) return 'No such Way';
  if (p.way) return `Your people already live by ${WAYS[p.way].name}`;
  if (p.epoch > WAY.until) return 'A Way is chosen in the Stone Age; the moment has passed';
  if (!townCenters(s, p.id).some((b) => b.built)) return 'A Way is chosen at a Town Center';
  return null;
}

/** Take a Way: its numbers apply to the people from now on, and everyone is told which one. */
export function takeWay(s: GameState, p: Player, way: WayId): void {
  restat(s, p, () => {
    p.way = way;
  });
  s.events.push({ k: 'way', owner: p.id, way });
}

/**
 * Which Way suits a computer's home (#463 s1): the game within `WAY.far` feeds the Hunters, the berry patches within
 * `WAY.near` the Hearth, a rival town within `WAY.foe` the Warband (which can always raid: `WAY.raid`); and each people
 * leans to one Way of its own (`WAY_LEAN`). Ties go in `WAY_IDS` order, so the choice is the same every run.
 */
export function wayFor(s: GameState, p: Player): WayId {
  const tc = townCenters(s, p.id)[0];
  if (!tc) return 'hearth';
  const far = WAY.far * WAY.far;
  let game = 0;
  for (const a of s.animals) {
    if (a.hp <= 0 || (a.x - tc.x) * (a.x - tc.x) + (a.y - tc.y) * (a.y - tc.y) > far) continue;
    if (a.kind === 'deer' || a.kind === 'boar' || a.kind === 'mammoth') game++;
  }
  const r2 = WAY.near * WAY.near;
  let berries = 0;
  const reach = Math.ceil(WAY.near);
  for (let y = Math.max(0, Math.floor(tc.y) - reach); y <= Math.min(s.h - 1, Math.floor(tc.y) + reach); y++) {
    for (let x = Math.max(0, Math.floor(tc.x) - reach); x <= Math.min(s.w - 1, Math.floor(tc.x) + reach); x++) {
      if (s.res[y * s.w + x] === R_BERRY && (x + 0.5 - tc.x) * (x + 0.5 - tc.x) + (y + 0.5 - tc.y) * (y + 0.5 - tc.y) <= r2) berries++;
    }
  }
  let foe = Infinity;
  for (const q of s.players) {
    if (q.defeated || !isEnemy(s, p.id, q.id)) continue;
    for (const b of townCenters(s, q.id)) foe = Math.min(foe, Math.sqrt((b.x - tc.x) * (b.x - tc.x) + (b.y - tc.y) * (b.y - tc.y)));
  }
  const lean = WAY_LEAN[p.civ];
  const score: Record<WayId, number> = {
    hunt: game * 0.75 + (lean === 'hunt' ? WAY.lean : 0),
    hearth: berries / 1.4 + (lean === 'hearth' ? WAY.lean : 0),
    warband: WAY.raid + (foe < WAY.foe ? (WAY.foe - foe) / 3 : 0) + (lean === 'warband' ? WAY.lean : 0),
  };
  let best: WayId = WAY_IDS[0];
  for (const w of WAY_IDS) if (score[w] > score[best]) best = w;
  return best;
}

/** The computer's turn: a clever one picks once its first minute is out, while still in the Stone Age. */
export function aiWay(s: GameState, p: Player): WayId | null {
  if (s.tick < secs(WAY.aiAfter)) return null;
  const way = wayFor(s, p);
  return wayProblem(s, p, way) ? null : way;
}

/**
 * Vows (#338): in the Bronze Age a people may deepen its Way (`way` unset) or turn to another, once.
 * Why it can't be done now, or null.
 */
export function vowProblem(s: GameState, p: Player, way?: WayId): string | null {
  if (!p.way) return 'Your people live by no Way';
  if (p.vowed) return 'Your people have made their vow';
  if (p.epoch !== WAY.vow) return 'A vow is made in the Bronze Age';
  if (!townCenters(s, p.id).some((b) => b.built)) return 'A vow is made at a Town Center';
  if (way) {
    if (!WAYS[way]) return 'No such Way';
    if (way === p.way) return 'Your people already live by that Way';
  }
  const cost = way ? WAY.turnCost : WAY.deepenCost;
  return canAfford(p, cost) ? null : 'Not enough resources';
}

/** Deepen the Way, or turn from it; either way the vow is spent. */
export function takeVow(s: GameState, p: Player, way?: WayId): void {
  pay(p, way ? WAY.turnCost : WAY.deepenCost);
  restat(s, p, () => {
    p.vowed = true;
    if (way) {
      p.way = way;
      p.deep = false;
    } else p.deep = true;
  });
  s.events.push({ k: 'way', owner: p.id, way: p.way!, deep: !way, turned: !!way });
}

/** A clever computer deepens its Way once it can pay and still keep a stock for the age after. */
export function aiVow(s: GameState, p: Player): boolean {
  return !vowProblem(s, p) && p.res.food >= WAY.deepenCost.food! + 150 && p.res.wood >= WAY.deepenCost.wood! + 100;
}

/**
 * The Hunters' kill camp (#463 s1): would a Hunting Camp of `owner`'s with its corner at (tx, ty) stand within
 * `KILL_CAMP.near` tiles of living game or a carcass? Then it costs nothing and goes up fast.
 */
export function killCamp(s: GameState, owner: number, type: BuildingType, tx: number, ty: number): boolean {
  if (type !== 'huntcamp' || s.players[owner]?.way !== 'hunt') return false;
  const half = BUILDINGS.huntcamp.size / 2;
  const cx = tx + half;
  const cy = ty + half;
  const r = KILL_CAMP.near;
  for (const a of s.animals) {
    if (a.hp <= 0 || (a.kind !== 'deer' && a.kind !== 'boar' && a.kind !== 'mammoth')) continue;
    if ((a.x - cx) * (a.x - cx) + (a.y - cy) * (a.y - cy) <= r * r) return true;
  }
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(s.h - 1, Math.floor(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(s.w - 1, Math.floor(cx + r)); x++) {
      if (s.res[y * s.w + x] === R_MEAT && s.amount[y * s.w + x] > 0 && (x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy) <= r * r) return true;
    }
  }
  return false;
}

/** As long as a Town Center's queue may grow (`MAX_QUEUE` in `commands.ts`). */
const KIN_QUEUE = 6;

/** Game (deer, boars, mammoths) living within `KILL_CAMP.home` tiles of one of `owner`'s Town Centers. */
export function herdAtHome(s: GameState, owner: number): number {
  const r2 = KILL_CAMP.home * KILL_CAMP.home;
  const tcs = townCenters(s, owner);
  let n = 0;
  for (const a of s.animals) {
    if (a.hp <= 0 || (a.kind !== 'deer' && a.kind !== 'boar' && a.kind !== 'mammoth')) continue;
    if (tcs.some((b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) <= r2)) n++;
  }
  return n;
}

/**
 * The Hunters' fields wait on the herd (#463 s1): why a Way bars this building now, from the state of the land, or null.
 * (What a Way bars outright, whatever the land, is in `buildBarred`.)
 */
export function wayBarred(s: GameState, p: Player, type: BuildingType): string | null {
  const way = p.way ? WAYS[p.way] : undefined;
  if (p.epoch !== 0 || !way?.herdShuts?.includes(type)) return null;
  const n = herdAtHome(s, p.id);
  return n ? `${way.name} sows nothing where the herd grazes: ${n} ${n === 1 ? 'beast lives' : 'beasts live'} within ${KILL_CAMP.home} tiles of your Town Center` : null;
}

/** How many kin answer a call now: more in winter, when the hearth is warmest. */
export function kinCount(s: GameState): number {
  return seasonAt(s) === 3 ? KIN.winter : KIN.n;
}

/** The Hearth's call (#463 s1): why this Town Center can't call the kin now, or null. */
export function kinProblem(p: Player, b: Building): string | null {
  if (p.way !== 'hearth') return 'Only a people of the Hearth Way calls the kin';
  if (b.type !== 'towncenter' || b.owner !== p.id) return 'The kin come to a Town Center';
  if (!b.built) return 'The Town Center is not finished';
  if (b.advance >= 0) return 'The Town Center is leading your people into a new age';
  if (b.queue.length >= KIN_QUEUE) return 'The queue is full';
  return canAfford(p, KIN.cost) ? null : 'Not enough food';
}

/** Call the kin: paid now, they come out when the queue reaches them. */
export function callKin(s: GameState, p: Player, b: Building): void {
  pay(p, KIN.cost);
  b.queue.push({ unit: 'citizen', kin: kinCount(s), done: 0, paid: { ...KIN.cost } });
}

/** The computer of the Hearth calls the kin when it can pay and keep a little, has room, and its Town Center is free. */
export function aiKin(s: GameState, p: Player, b: Building, reserve: number): boolean {
  if (kinProblem(p, b) || b.queue.length > 0) return false;
  const n = kinCount(s);
  return p.cap - p.pop >= n && p.res.food >= KIN.cost.food! + reserve;
}

/**
 * The Warband's raid (#463 s1): a soldier of a Warband people struck a rival's food building for `damage`. It carries
 * off `RAID.take` food a point, as much as the rival holds.
 */
export function raidBlow(s: GameState, target: Building, damage: number, by: number, attacker: Unit | null): void {
  if (!attacker || attacker.type === 'citizen' || s.players[by]?.way !== 'warband' || !isEnemy(s, by, target.owner)) return;
  // A snare struck (#485): the raiders take the whole catch in its noose, not the rival's stores.
  if (target.type === 'snare') return carryOff(s, s.players[target.owner], by, Math.floor(target.snared ?? 0), target.x, target.y, target);
  if (!RAID.at.includes(target.type)) return;
  carryOff(s, s.players[target.owner], by, damage * RAID.take, target.x, target.y);
}

/** A rival citizen fell to a Warband people: what it carried, and `RAID.slain` food besides, come to the raiders. */
export function raidSlain(s: GameState, target: Unit, by: number): void {
  if (target.type !== 'citizen' || s.players[by]?.way !== 'warband' || !isEnemy(s, by, target.owner)) return;
  const p = s.players[by];
  const load = target.carry > 0 && target.carryRes ? Math.floor(target.carry) : 0;
  if (load > 0 && target.carryRes && RES.includes(target.carryRes)) {
    p.res[target.carryRes] += load;
    target.carry = 0;
  }
  carryOff(s, s.players[target.owner], by, RAID.slain, target.x, target.y);
}

function carryOff(s: GameState, victim: Player, by: number, amount: number, x: number, y: number, snare?: Building): void {
  const food = Math.min(snare ? (snare.snared ?? 0) : victim.res.food, amount);
  if (food <= 0) return;
  if (snare) snare.snared = (snare.snared ?? 0) - food;
  else victim.res.food -= food;
  s.players[by].res.food += food;
  const p = s.players[by];
  p.stats.raided = (p.stats.raided ?? 0) + food;
  const tell = s.tick - (victim.raidTold ?? -secs(RAID.tell)) >= secs(RAID.tell);
  if (tell) victim.raidTold = s.tick;
  s.events.push({ k: 'raided', owner: victim.id, by, food, x, y, tell });
}
