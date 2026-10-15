import { DT, FLOCK, TICK_HZ, domainOf, secs } from './data';
import { DIRS, roll, spawnAnimal } from './animals';
import { walkable } from './grid';
import { seasonOf } from './seasons';
import { isMobile } from './steppe';
import type { Spatial } from './spatial';
import type { Animal, Building, GameState, Player, Unit } from './types';
import { R_NONE, T_GRASS } from './types';
import { canAfford, exitSpot, isEnemy, pay } from './world';

/**
 * Flocks (#308): the steppe's food that walks. Sheep belong to a people, graze the grass about its camp
 * (the nearest Town Center, standing or packed on a wagon) and trot after it when camp is struck. Each bite
 * crops a tile bare for a while, so a flock grazes its ground out and must move on. Bites fill the udder,
 * which citizens milk; a full udder turns bites into fat, and fat into lambs. The numbers are `FLOCK` in
 * `data.ts`.
 */

export const isSheep = (a: Animal): boolean => a.kind === 'sheep';

/** Whether this tile has grass to crop now: open grassland, nothing on it, not cropped bare. */
export function grassy(s: GameState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
  const i = y * s.w + x;
  return s.terrain[i] === T_GRASS && s.res[i] === R_NONE && s.bldAt[i] === 0 && (!s.grazed || s.grazed[i] <= s.tick) && walkable(s, x, y);
}

/** A people's sheep and lambs. */
export function flockOf(s: GameState, owner: number): number {
  let n = 0;
  for (const a of s.animals) if (a.kind === 'sheep' && a.owner === owner && a.hp > 0) n++;
  return n;
}

/** How many sheep a people can keep: `FLOCK.cap` for each Town Center, standing or on a wagon. */
export function flockCap(s: GameState, owner: number): number {
  let n = 0;
  for (const e of s.ents) {
    if (e.owner !== owner || e.hp <= 0) continue;
    if (e.kind === 'building' ? e.type === 'towncenter' : e.type === 'wagon' && e.packed === 'towncenter') n++;
  }
  return n * FLOCK.cap;
}

/** A flock's camp: the nearest Town Center of its people, standing or packed on a wagon, within `FLOCK.follow` tiles. */
export function campOf(s: GameState, owner: number, x: number, y: number): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = FLOCK.follow * FLOCK.follow;
  for (const e of s.ents) {
    if (e.owner !== owner || e.hp <= 0) continue;
    if (e.kind === 'building' ? e.type !== 'towncenter' : e.type !== 'wagon' || e.packed !== 'towncenter' || e.inside) continue;
    const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

/** A new sheep (or lamb) of a people's flock where it stands. */
export function addSheep(s: GameState, owner: number, x: number, y: number, lamb: boolean): Animal {
  s.grazed ??= new Int32Array(s.w * s.h);
  const a = spawnAnimal(s, x, y, 'sheep');
  a.owner = owner;
  a.milk = 0;
  a.fat = 0;
  a.bite = secs(FLOCK.bite) + (a.id % secs(FLOCK.bite));
  delete a.cool;
  if (lamb) {
    a.lamb = s.tick + secs(FLOCK.lamb);
    a.hp = FLOCK.lambHp;
  }
  return a;
}

/** Why this Town Center can't raise a lamb now, or null. */
export function lambProblem(s: GameState, p: Player, b: Building): string | null {
  if (!isMobile(p)) return 'Only a steppe people raises flocks';
  if (b.type !== 'towncenter') return 'Lambs are raised at a Town Center';
  if (!b.built || b.hp <= 0) return 'It must stand finished first';
  if (flockOf(s, p.id) >= flockCap(s, p.id)) return `The flock is full: ${FLOCK.cap} sheep for each Town Center`;
  if (!canAfford(p, FLOCK.cost)) return 'Not enough food';
  return null;
}

/** The Town Center raises a lamb, which steps out toward its rally point. */
export function raiseLamb(s: GameState, b: Building): Animal {
  pay(s.players[b.owner], FLOCK.cost);
  const toward = b.rally ?? { x: b.x, y: b.y + 4 };
  const spot = exitSpot(s, b, toward.x, toward.y);
  const a = addSheep(s, b.owner, spot.x, spot.y, true);
  s.events.push({ k: 'flock', owner: b.owner, what: 'raised', x: a.x, y: a.y });
  return a;
}

/** A people new to the steppe drives its first sheep in: `FLOCK.start` beside each of its Town Centers. */
export function giftFlock(s: GameState, p: Player): void {
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== p.id || e.type !== 'towncenter' || !e.built || e.hp <= 0) continue;
    for (let k = 0; k < FLOCK.start; k++) {
      const spot = exitSpot(s, e, e.x + (k ? 3 : -3), e.y + 4);
      addSheep(s, p.id, spot.x, spot.y, false);
    }
  }
}

/** The nearest grown sheep of a people with milk to give, within `r` tiles. */
export function milkable(s: GameState, owner: number, x: number, y: number, r: number, skip?: number): Animal | null {
  let best: Animal | null = null;
  let bestD = r * r;
  for (const a of s.animals) {
    if (a.kind !== 'sheep' || a.owner !== owner || a.hp <= 0 || a.lamb !== undefined || (a.milk ?? 0) < 1 || a.id === skip) continue;
    const d = (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y);
    if (d < bestD) {
      best = a;
      bestD = d;
    }
  }
  return best;
}

/**
 * A step toward a point at `speed` tiles a second, turning aside 45° and then 90° (either way) when the way
 * is blocked. True once there, or stuck fast.
 */
function amble(s: GameState, a: Animal, tx: number, ty: number, speed: number): boolean {
  const dx = tx - a.x;
  const dy = ty - a.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.08) return true;
  const step = Math.min(d, speed * DT);
  const ux = dx / d;
  const uy = dy / d;
  const r = 0.7071;
  const tries = [
    [ux, uy],
    [(ux - uy) * r, (ux + uy) * r],
    [(ux + uy) * r, (uy - ux) * r],
    [-uy, ux],
    [uy, -ux],
  ];
  // A sheep caught where a camp was pitched over it may always walk out.
  const free = !walkable(s, Math.floor(a.x), Math.floor(a.y));
  for (const [vx, vy] of tries) {
    const nx = a.x + vx * step;
    const ny = a.y + vy * step;
    if (!free && !walkable(s, Math.floor(nx), Math.floor(ny))) continue;
    a.x = nx;
    a.y = ny;
    a.fx = vx;
    a.fy = vy;
    return d <= step;
  }
  return true;
}

/** The eight tiles around one, going round. */
const RING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;

/** The nearest fresh grass to a sheep that lies within `FLOCK.range` of its camp, ring by ring, or null. */
function freshGrass(s: GameState, a: Animal): { x: number; y: number } | null {
  const cx = Math.floor(a.x);
  const cy = Math.floor(a.y);
  const reach = FLOCK.range + 0.5;
  const most = FLOCK.range * 2 + 1;
  const near = (x: number, y: number) => {
    const hx = x + 0.5 - a.homeX;
    const hy = y + 0.5 - a.homeY;
    return hx * hx + hy * hy <= reach * reach && grassy(s, x, y);
  };
  // The next tile over first, from a dice-picked side, so a flock wanders its pasture instead of marching one way.
  const k0 = Math.floor(roll(s) * 8);
  for (let k = 0; k < 8; k++) {
    const [dx, dy] = RING[(k0 + k) % 8];
    if (near(cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
  }
  for (let r = 2; r <= most; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (near(cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
      }
    }
  }
  return null;
}

/** Whether a rival can't take this sheep: one of its people stands within `FLOCK.guard` tiles, or its camp does. */
function watched(s: GameState, sp: Spatial | undefined, a: Animal, camp: { x: number; y: number } | null): boolean {
  const g = FLOCK.guard;
  if (camp && (camp.x - a.x) * (camp.x - a.x) + (camp.y - a.y) * (camp.y - a.y) <= (g + 2) * (g + 2)) return true;
  let seen = false;
  const look = (u: Unit) => {
    if (seen || u.hp <= 0 || u.inside || domainOf(u.type) !== 'land' || isEnemy(s, a.owner!, u.owner)) return;
    if ((u.x - a.x) * (u.x - a.x) + (u.y - a.y) * (u.y - a.y) <= g * g) seen = true;
  };
  if (sp) sp.near(a.x, a.y, g, look);
  else for (const e of s.ents) if (e.kind === 'unit') look(e);
  return seen;
}

/** Who may drive off a sheep: a rival on foot or horse (citizens, soldiers, heroes) standing right by it. */
function rustler(s: GameState, sp: Spatial | undefined, a: Animal): Unit | null {
  let best: Unit | null = null;
  let bestD = FLOCK.steal * FLOCK.steal;
  const look = (u: Unit) => {
    if (u.hp <= 0 || u.inside || !isEnemy(s, a.owner!, u.owner)) return;
    if (u.type !== 'citizen' && u.type !== 'infantry' && u.type !== 'ranged' && u.type !== 'cavalry' && u.type !== 'hero') return;
    const d = (u.x - a.x) * (u.x - a.x) + (u.y - a.y) * (u.y - a.y);
    if (d < bestD || (d === bestD && best && u.id < best.id)) {
      best = u;
      bestD = d;
    }
  };
  if (sp) sp.near(a.x, a.y, FLOCK.steal, look);
  else for (const e of s.ents) if (e.kind === 'unit') look(e);
  return best;
}

/** Once a second: the camp it keeps to (or the rustler leading it), and whether a rival drives it off. */
function lookAbout(s: GameState, sp: Spatial | undefined, a: Animal): void {
  const owner = a.owner!;
  let camp = campOf(s, owner, a.x, a.y);
  if (s.tick >= s.peaceUntil && !watched(s, sp, a, camp)) {
    const u = rustler(s, sp, a);
    if (u) {
      s.events.push({ k: 'flock', owner, what: 'rustled', x: a.x, y: a.y, by: u.owner });
      a.owner = u.owner;
      a.lead = u.id;
      a.state = 'graze';
      camp = campOf(s, u.owner, a.x, a.y);
    }
  }
  if (a.lead !== undefined) {
    const u = s.byId.get(a.lead);
    const near = camp && (camp.x - a.x) * (camp.x - a.x) + (camp.y - a.y) * (camp.y - a.y) <= FLOCK.range * FLOCK.range;
    if (near || !u || u.kind !== 'unit' || u.hp <= 0 || u.inside || u.owner !== a.owner) delete a.lead;
    else {
      a.homeX = u.x;
      a.homeY = u.y;
      return;
    }
  }
  if (camp) {
    a.homeX = camp.x;
    a.homeY = camp.y;
  }
}

/** A bite of the grass underfoot: milk, then fat, then a lamb. False when the ground is bare. */
function crop(s: GameState, a: Animal): boolean {
  const x = Math.floor(a.x);
  const y = Math.floor(a.y);
  if (!grassy(s, x, y)) return false;
  s.grazed ??= new Int32Array(s.w * s.h);
  s.grazed[y * s.w + x] = s.tick + secs(FLOCK.regrow / seasonOf(s).grass);
  if (a.lamb !== undefined) return true;
  if ((a.milk ?? 0) < FLOCK.udder) {
    a.milk = Math.min(FLOCK.udder, (a.milk ?? 0) + FLOCK.milk);
    return true;
  }
  a.fat = Math.min(FLOCK.breed, (a.fat ?? 0) + FLOCK.fat);
  const owner = a.owner!;
  if (a.fat >= FLOCK.breed && isMobile(s.players[owner]) && flockOf(s, owner) < flockCap(s, owner)) {
    a.fat = 0;
    const lamb = addSheep(s, owner, a.x, a.y, true);
    lamb.homeX = a.homeX;
    lamb.homeY = a.homeY;
    s.events.push({ k: 'flock', owner, what: 'born', x: a.x, y: a.y });
  }
  return true;
}

/** One tick of a sheep: grow, keep to the camp, crop the grass, and amble on to fresh grass. */
export function sheepStep(s: GameState, sp: Spatial | undefined, a: Animal): void {
  if (a.lamb !== undefined && s.tick >= a.lamb) {
    delete a.lamb;
    a.hp += FLOCK.hp - FLOCK.lambHp;
  }
  if ((s.tick + a.id) % TICK_HZ === 0) lookAbout(s, sp, a);
  if (a.state === 'flee') {
    amble(s, a, a.x + a.fx * 2, a.y + a.fy * 2, FLOCK.flee);
    if (a.t <= 0) a.state = 'graze';
    return;
  }
  const held = a.held !== undefined && s.tick - a.held <= 1;
  const hx = a.homeX - a.x;
  const hy = a.homeY - a.y;
  const keep = a.lead !== undefined ? 1.5 : FLOCK.range + 1;
  if (!held && hx * hx + hy * hy > keep * keep) {
    // Left behind: trot after the camp (or the rustler) before grazing again.
    a.state = 'walk';
    a.tx = a.homeX;
    a.ty = a.homeY;
    amble(s, a, a.homeX, a.homeY, a.lead !== undefined ? FLOCK.walk * 1.4 : FLOCK.walk);
    return;
  }
  if (a.state === 'walk' && !held && (amble(s, a, a.tx, a.ty, FLOCK.walk * 0.6) || a.t <= 0)) a.state = 'graze';
  a.bite = (a.bite ?? secs(FLOCK.bite)) - 1;
  if (a.bite > 0) return;
  a.bite = secs(FLOCK.bite);
  const ate = crop(s, a);
  if (ate) a.hungry = false;
  else {
    a.fat = Math.max(0, (a.fat ?? 0) - FLOCK.fat);
    if (!a.hungry) s.events.push({ k: 'flock', owner: a.owner!, what: 'hungry', x: a.x, y: a.y });
    a.hungry = true;
  }
  if (held || grassy(s, Math.floor(a.x), Math.floor(a.y))) return;
  const g = freshGrass(s, a);
  if (!g) return;
  // Amble to somewhere on that tile (not all to its middle), the flock spreading as it goes.
  const d = DIRS[a.id % 8];
  a.tx = g.x + 0.5 + d[0] * 0.25;
  a.ty = g.y + 0.5 + d[1] * 0.25;
  a.state = 'walk';
  a.t = secs(FLOCK.bite * 3);
}
