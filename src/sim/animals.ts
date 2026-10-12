import { AMOUNT, DEER, DT, secs } from './data';
import { walkable } from './grid';
import type { Animal, GameState } from './types';
import { B_RES, R_MEAT, R_NONE } from './types';

/**
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

export function spawnAnimal(s: GameState, x: number, y: number): Animal {
  const a: Animal = { id: s.nextId++, kind: 'deer', x, y, px: x, py: y, fx: 0, fy: 1, hp: DEER.hp, state: 'graze', t: secs(2) + (s.nextId % 40), tx: x, ty: y, homeX: x, homeY: y, hurt: -999 };
  s.animals.push(a);
  return a;
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

export function updateAnimals(s: GameState): void {
  for (const a of s.animals) {
    a.px = a.x;
    a.py = a.y;
    a.t--;
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

/** A spear finds its mark: the deer bolts, or falls and leaves a carcass. */
export function hitAnimal(s: GameState, a: Animal, damage: number, fromX: number, fromY: number): void {
  if (a.hp <= 0) return;
  a.hp -= damage;
  a.hurt = s.tick;
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
  if (tile >= 0) {
    s.res[tile] = R_MEAT;
    s.amount[tile] = AMOUNT.meat;
    s.block[tile] |= B_RES;
    s.blockVersion++;
  }
  s.events.push({ k: 'animalDie', id: a.id, x: a.x, y: a.y, fx: a.fx, fy: a.fy });
  s.animals = s.animals.filter((x) => x !== a);
}
