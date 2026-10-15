import { landOwnerAt } from './borders';
import { AMOUNT, BOAR, DEER, DT, MAMMOTH, ROT, TICK_HZ, WOLF, domainOf, secs } from './data';
import { clearResource, walkable } from './grid';
import type { Spatial } from './spatial';
import type { Animal, GameState, Order, Unit } from './types';
import { B_RES, R_MEAT, R_NONE } from './types';
import { modsOf } from './stats';
import { statsOf } from './world';

/**
 * The wild (#171): mammoths and wolves don't run. A speared mammoth turns on its hunters; a wolf pack
 * falls on whoever comes near its den. See `MAMMOTH` and `WOLF` in `data.ts`.
 *
 * Deer: small herds that graze and wander near home, bolt when hit, and fall to a hunter's spears,
 * leaving a carcass to butcher for food (faster than berries). Their dice are the match's own, so they
 * wander the same way in every browser.
 */

function roll(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Eight directions, as unit vectors (no trigonometry in the rules). */
const DIRS = [
  [1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071], [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071],
] as const;

const HP: Record<Animal['kind'], number> = { deer: DEER.hp, mammoth: MAMMOTH.hp, wolf: WOLF.hp, boar: BOAR.hp };

export function spawnAnimal(s: GameState, x: number, y: number, kind: Animal['kind'] = 'deer'): Animal {
  const a: Animal = { id: s.nextId++, kind, x, y, px: x, py: y, fx: 0, fy: 1, hp: HP[kind], state: 'graze', t: secs(2) + (s.nextId % 40), tx: x, ty: y, homeX: x, homeY: y, hurt: -999 };
  if (kind !== 'deer') a.cool = 0;
  else {
    const mate = s.animals.find((b) => b.kind === 'deer' && (b.x - x) * (b.x - x) + (b.y - y) * (b.y - y) <= DEER.herd * DEER.herd);
    a.herd = mate ? (mate.herd ?? mate.id) : a.id;
    a.origX = mate ? (mate.origX ?? mate.homeX) : x;
    a.origY = mate ? (mate.origY ?? mate.homeY) : y;
  }
  s.animals.push(a);
  return a;
}

/** How wide an animal is, from its middle. */
export function animalRadius(a: Animal): number {
  return a.kind === 'mammoth' ? MAMMOTH.radius : a.kind === 'wolf' ? WOLF.radius : a.kind === 'boar' ? BOAR.radius : 0.2;
}

/** Who can stand up to a beast: citizens with their spears, and soldiers on foot or horse. */
export function fightsBeasts(u: Unit): boolean {
  return u.type === 'citizen' || u.type === 'infantry' || u.type === 'ranged' || u.type === 'cavalry' || u.type === 'hero';
}

/** Whom a beast can reach: anyone on land, out in the open. */
function prey(u: Unit): boolean {
  return u.hp > 0 && !u.inside && domainOf(u.type) === 'land';
}

function nearestPrey(s: GameState, sp: Spatial | undefined, x: number, y: number, r: number, leash?: { x: number; y: number; r: number }): Unit | null {
  let best: Unit | null = null;
  let bestD = r * r;
  const look = (u: Unit) => {
    if (!prey(u)) return;
    const d = (u.x - x) * (u.x - x) + (u.y - y) * (u.y - y);
    if (d >= bestD) return;
    if (leash && (u.x - leash.x) * (u.x - leash.x) + (u.y - leash.y) * (u.y - leash.y) > leash.r * leash.r) return;
    best = u;
    bestD = d;
  };
  if (sp) sp.near(x, y, r, look);
  else for (const e of s.ents) if (e.kind === 'unit') look(e);
  return best;
}

function stepToward(s: GameState, a: Animal, tx: number, ty: number, speed: number): boolean {
  const dx = tx - a.x;
  const dy = ty - a.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.05) return true;
  const step = Math.min(d, speed * DT);
  const nx = a.x + (dx / d) * step;
  const ny = a.y + (dy / d) * step;
  a.fx = dx / d;
  a.fy = dy / d;
  if (!walkable(s, Math.floor(nx), Math.floor(ny))) return true;
  a.x = nx;
  a.y = ny;
  return d <= step;
}

/** Fallen meat spoils once a second after its grace, slower on land whose holder has Drying Racks. */
function rot(s: GameState): void {
  const list = s.carcasses;
  if (!list || !list.length) return;
  const tick = s.tick % TICK_HZ === 0;
  s.carcasses = list.filter((c) => {
    if (s.res[c.tile] !== R_MEAT || s.amount[c.tile] <= 0) return false;
    if (!tick || s.tick - c.born < secs(ROT.grace)) return true;
    const x = c.tile % s.w;
    const y = Math.floor(c.tile / s.w);
    const owner = landOwnerAt(s, x, y);
    const slow = owner >= 0 ? modsOf(s, owner).rot : 1;
    // Round up so a small carcass still shrinks.
    s.amount[c.tile] -= Math.max(1, Math.ceil(c.full * ROT.rate * slow));
    if (s.amount[c.tile] > 0) return true;
    clearResource(s, c.tile);
    s.events.push({ k: 'depleted', tile: c.tile });
    return false;
  });
}

export function updateAnimals(s: GameState, sp?: Spatial): void {
  rot(s);
  for (const a of s.animals) {
    a.px = a.x;
    a.py = a.y;
    a.t--;
    if (a.kind !== 'deer') {
      beastStep(s, sp, a);
      continue;
    }
    if (a.state !== 'flee') drift(s, a);
    if (a.state === 'graze') {
      if (a.t <= 0) {
        // Wander a little way from home.
        const d = DIRS[Math.floor(roll(s) * 8)];
        const r = 1 + roll(s) * 2.5;
        a.tx = a.homeX + d[0] * r;
        a.ty = a.homeY + d[1] * r;
        a.state = 'walk';
        a.t = secs(6);
      }
    } else if (a.state === 'walk') {
      if (stepToward(s, a, a.tx, a.ty, DEER.walk) || a.t <= 0) {
        a.state = 'graze';
        a.t = secs(3) + Math.floor(roll(s) * secs(6));
      }
    } else {
      // Running: straight on, turning aside from what's in the way.
      const nx = a.x + a.fx * DEER.flee * DT;
      const ny = a.y + a.fy * DEER.flee * DT;
      if (walkable(s, Math.floor(nx), Math.floor(ny))) {
        a.x = nx;
        a.y = ny;
      } else {
        const d = DIRS[Math.floor(roll(s) * 8)];
        a.fx = d[0];
        a.fy = d[1];
      }
      if (a.t <= 0) {
        a.state = 'graze';
        a.t = secs(2);
        a.homeX = a.x;
        a.homeY = a.y;
      }
    }
  }
}

/** A hash of whole numbers (the rules keep no trigonometry): the same herd and season give the same answer everywhere. */
function mixInt(a: number, b: number): number {
  let h = Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 13;
  return h >>> 0;
}

/** Once a season the herd moves on to fresh ground, away from towns. All its deer pick the same move. */
function drift(s: GameState, a: Animal): void {
  const herd = a.herd ?? a.id;
  const every = secs(DEER.every);
  if ((s.tick + (herd % 97) * 31) % every !== 0 || s.tick === 0) return;
  const season = Math.floor((s.tick + (herd % 97) * 31) / every);
  const h = mixInt(herd, season);
  const ox = a.origX ?? a.homeX;
  const oy = a.origY ?? a.homeY;
  const dist = DEER.min + (h % 1000) / 1000 * (DEER.max - DEER.min);
  for (let k = 0; k < 8; k++) {
    const d = DIRS[((h >>> 10) + k) % 8];
    let x = a.homeX + d[0] * dist;
    let y = a.homeY + d[1] * dist;
    // Too far from where the herd began: turn back toward it.
    if ((x - ox) * (x - ox) + (y - oy) * (y - oy) > DEER.range * DEER.range) {
      x = a.homeX - d[0] * dist;
      y = a.homeY - d[1] * dist;
    }
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < 3 || ty < 3 || tx >= s.w - 3 || ty >= s.h - 3 || !walkable(s, tx, ty) || landOwnerAt(s, tx, ty) >= 0) continue;
    a.homeX = x;
    a.homeY = y;
    a.tx = x;
    a.ty = y;
    a.state = 'walk';
    a.t = secs(40);
    return;
  }
}

// ---- Mammoths and wolves ----------------------------------------------------------------------------

function beastStep(s: GameState, sp: Spatial | undefined, a: Animal): void {
  if (a.cool) a.cool--;
  if (a.state === 'fight') {
    fightStep(s, sp, a);
    return;
  }
  const wolf = a.kind === 'wolf';
  if (wolf && a.prey !== undefined && !wolfHunt(s, a)) a.prey = undefined;
  const guard = wolf || a.kind === 'boar';
  // A pack keeps watch (so does a boar by its patch): anyone who comes near is set upon.
  if (guard && (s.tick + a.id) % 4 === 0) {
    const u = nearestPrey(s, sp, a.x, a.y, wolf ? WOLF.notice : BOAR.notice, { x: a.homeX, y: a.homeY, r: wolf ? WOLF.leash : BOAR.leash });
    if (u) {
      rouse(s, a, u);
      return;
    }
  }
  if (wolf && a.prey === undefined && (s.tick + a.id) % 12 === 0) {
    // Nobody to fight: a hungry pack runs down the deer that graze near its den.
    let best: Animal | null = null;
    let bestD = WOLF.hunt * WOLF.hunt;
    for (const d of s.animals) {
      if (d.kind !== 'deer' || d.hp <= 0) continue;
      const dd = (d.x - a.homeX) * (d.x - a.homeX) + (d.y - a.homeY) * (d.y - a.homeY);
      if (dd < bestD) {
        best = d;
        bestD = dd;
      }
    }
    if (best) {
      a.prey = best.id;
      a.state = 'walk';
      a.t = secs(12);
    }
  }
  if (wolf && a.prey !== undefined) return;
  const roam = wolf ? WOLF.roam : a.kind === 'boar' ? BOAR.roam : MAMMOTH.roam;
  if (a.state === 'graze') {
    if (a.t <= 0) {
      const d = DIRS[Math.floor(roll(s) * 8)];
      const r = 0.5 + roll(s) * roam;
      a.tx = a.homeX + d[0] * r;
      a.ty = a.homeY + d[1] * r;
      a.state = 'walk';
      a.t = secs(10);
    }
  } else if (stepToward(s, a, a.tx, a.ty, wolf ? WOLF.walk : a.kind === 'boar' ? BOAR.walk : MAMMOTH.walk) || a.t <= 0) {
    a.state = 'graze';
    a.t = secs(guard ? 2 : 4) + Math.floor(roll(s) * secs(6));
  }
}

/** A wolf runs down its deer; false once the chase is over (the deer is dead, or too far from the den). */
function wolfHunt(s: GameState, a: Animal): boolean {
  const d = s.animals.find((b) => b.id === a.prey);
  if (!d || d.hp <= 0 || a.t <= 0) return false;
  if ((d.x - a.homeX) * (d.x - a.homeX) + (d.y - a.homeY) * (d.y - a.homeY) > WOLF.leash * WOLF.leash) return false;
  const dx = d.x - a.x;
  const dy = d.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.5) {
    hitAnimal(s, d, 99, a.x, a.y);
    return false;
  }
  // The herd bolts from the pack.
  if (dist < 3 && d.state !== 'flee') {
    d.state = 'flee';
    d.fx = dx / dist;
    d.fy = dy / dist;
    d.t = secs(2.5);
  }
  stepToward(s, a, d.x, d.y, WOLF.run);
  a.state = 'walk';
  return true;
}

/** Turn to fight `u`: a wolf brings its whole pack. */
function rouse(s: GameState, a: Animal, u: Unit): void {
  const pack = a.kind === 'wolf' ? s.animals.filter((b) => b.kind === 'wolf' && b.hp > 0 && b.homeX === a.homeX && b.homeY === a.homeY) : [a];
  if (a.state !== 'fight') s.events.push({ k: 'wildCry', id: a.id, kind: a.kind, x: a.x, y: a.y });
  for (const b of pack) {
    if (b.state === 'fight' && b !== a) continue;
    b.state = 'fight';
    b.foe = u.id;
    if (b.kind === 'mammoth') b.t = secs(MAMMOTH.rage);
  }
}

/** Go back home and settle down. */
function calm(a: Animal): void {
  a.state = 'walk';
  a.foe = undefined;
  a.tx = a.homeX;
  a.ty = a.homeY;
  a.t = secs(20);
}

function fightStep(s: GameState, sp: Spatial | undefined, a: Animal): void {
  const wolf = a.kind === 'wolf';
  const boar = a.kind === 'boar';
  const leash = wolf ? { x: a.homeX, y: a.homeY, r: WOLF.leash } : boar ? { x: a.homeX, y: a.homeY, r: BOAR.leash } : undefined;
  const u = a.foe !== undefined ? s.byId.get(a.foe) : undefined;
  let foe = u && u.kind === 'unit' && prey(u) ? u : null;
  if (foe && leash && (foe.x - leash.x) * (foe.x - leash.x) + (foe.y - leash.y) * (foe.y - leash.y) > leash.r * leash.r) foe = null;
  // A mammoth's rage cools some seconds after its last wound.
  if (a.kind === 'mammoth' && a.t <= 0) foe = null;
  else if (!foe) foe = nearestPrey(s, sp, a.x, a.y, wolf ? WOLF.notice : boar ? BOAR.notice : 6, leash);
  if (!foe) {
    calm(a);
    return;
  }
  a.foe = foe.id;
  const dx = foe.x - a.x;
  const dy = foe.y - a.y;
  const d = Math.sqrt(dx * dx + dy * dy) - animalRadius(a) - statsOf(s, foe).radius;
  if (d <= (wolf ? WOLF.reach : boar ? BOAR.reach : MAMMOTH.reach)) {
    const n = Math.sqrt(dx * dx + dy * dy) || 1;
    a.fx = dx / n;
    a.fy = dy / n;
    if (!a.cool) {
      maul(s, a, foe);
      a.cool = secs(wolf ? WOLF.reload : boar ? BOAR.reload : MAMMOTH.reload);
    }
    return;
  }
  stepToward(s, a, foe.x, foe.y, wolf ? WOLF.run : boar ? BOAR.run : MAMMOTH.charge);
}

/** A wolf bites, or a mammoth gores: armor helps; the bitten fight back. */
function maul(s: GameState, a: Animal, u: Unit): void {
  const st = statsOf(s, u);
  const damage = Math.max(1, (a.kind === 'wolf' ? WOLF.bite : a.kind === 'boar' ? BOAR.bite : MAMMOTH.gore) - st.armor);
  u.hp -= damage;
  u.hurt = s.tick;
  s.events.push({ k: 'wildStrike', id: a.id, kind: a.kind, target: u.id, x: u.x, y: u.y });
  s.events.push({ k: 'hit', target: u.id, x: u.x, y: u.y, damage, owner: u.owner, building: false });
  const p = s.players[u.owner];
  if (p && s.tick - p.alert > secs(12)) {
    p.alert = s.tick;
    s.events.push({ k: 'alert', owner: u.owner, x: u.x, y: u.y, building: false, wild: a.kind });
  }
  if (u.hp > 0) fightBack(u, a);
}

/** Work an order can be set down for, and picked up again after the fight. */
const WORK: Order['k'][] = ['idle', 'gather', 'farm', 'build', 'deliver', 'dig'];

/** Someone bitten or gored at their work turns on the beast, then goes back to it. */
function fightBack(u: Unit, a: Animal): void {
  if (!fightsBeasts(u) || !WORK.includes(u.order.k)) return;
  if (u.stance === 'stand' && u.type !== 'citizen') return;
  const o = u.order;
  if (o.k !== 'idle') u.queue.unshift(o.k === 'gather' || o.k === 'farm' ? { ...o, phase: 'go' } : o);
  u.order = { k: 'hunt', target: a.id, fight: a.kind === 'wolf' };
  u.path = null;
  u.goal = null;
  u.wantPath = false;
  u.stuck = 0;
  u.miss = 0;
}

/** Whoever threw from about here (the nearest who could have). */
function thrower(s: GameState, x: number, y: number): Unit | null {
  let best: Unit | null = null;
  let bestD = 3 * 3;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || !prey(e) || !fightsBeasts(e)) continue;
    const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

/** A spear finds its mark: the deer bolts, or falls and leaves a carcass. A mammoth or wolf turns to fight. */
export function hitAnimal(s: GameState, a: Animal, damage: number, fromX: number, fromY: number): void {
  if (a.hp <= 0) return;
  a.hp -= damage;
  a.hurt = s.tick;
  if (a.hp > 0 && a.kind !== 'deer') {
    if (a.kind === 'mammoth') a.t = secs(MAMMOTH.rage);
    const u = a.state === 'fight' && a.foe !== undefined ? null : thrower(s, fromX, fromY);
    if (u) rouse(s, a, u);
    else if (a.state !== 'fight') {
      // Hurt by someone out of sight: a mammoth turns on whoever is nearest, a wolf goes home.
      a.state = 'fight';
      a.foe = undefined;
    }
    return;
  }
  if (a.hp > 0) {
    const dx = a.x - fromX;
    const dy = a.y - fromY;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    a.fx = dx / d;
    a.fy = dy / d;
    a.state = 'flee';
    a.t = secs(2.5);
    return;
  }
  // A carcass where it fell (or on the nearest open tile).
  let tile = -1;
  const cx = Math.floor(a.x);
  const cy = Math.floor(a.y);
  for (let r = 0; r <= 3 && tile < 0; r++) {
    for (let dy = -r; dy <= r && tile < 0; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (!walkable(s, x, y) || s.res[y * s.w + x] !== R_NONE) continue;
        tile = y * s.w + x;
        break;
      }
    }
  }
  // A wolf leaves nothing to eat.
  if (tile >= 0 && a.kind !== 'wolf') {
    s.res[tile] = R_MEAT;
    s.amount[tile] = a.kind === 'mammoth' ? MAMMOTH.meat : a.kind === 'boar' ? BOAR.meat : AMOUNT.meat;
    s.block[tile] |= B_RES;
    s.blockVersion++;
    (s.carcasses ??= []).push({ tile, born: s.tick, full: s.amount[tile] });
  }
  s.events.push({ k: 'animalDie', id: a.id, x: a.x, y: a.y, fx: a.fx, fy: a.fy, kind: a.kind });
  s.animals = s.animals.filter((x) => x !== a);
}
