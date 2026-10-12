import { BONUS, BUILDINGS, TICK_HZ, secs, unitStats, type UnitStats } from './data';
import { distToRect } from './grid';
import type { Spatial } from './spatial';
import type { Building, Ent, GameState, Shot, Unit } from './types';
import { isEnemy, radiusOf, statsOf } from './world';

/** Blows, shots, towers and the damage triangle. */

const SHOT_SPEED: Record<Shot['kind'], number> = { stone: 10, arrow: 13, bolt: 15, bullet: 32 };

/** Damage of one blow or shot after the counter bonus and armor. */
export function damageOf(st: UnitStats, target: Ent, s: GameState, ranged: boolean): number {
  if (target.kind === 'building') return Math.max(1, st.attack * BONUS[st.cls].building);
  const ts = statsOf(s, target);
  const armor = ranged ? ts.parmor : ts.armor;
  return Math.max(1, st.attack * BONUS[st.cls][ts.cls] - armor);
}

/** Edge-to-edge distance between a unit and anything. */
export function gap(s: GameState, u: Unit, t: Ent): number {
  const r = statsOf(s, u).radius;
  if (t.kind === 'building') return distToRect(u.x, u.y, t) - r;
  const dx = t.x - u.x;
  const dy = t.y - u.y;
  return Math.sqrt(dx * dx + dy * dy) - r - radiusOf(s, t);
}

export function hurt(s: GameState, target: Ent, damage: number, by: number, attacker: Unit | null): void {
  if (target.hp <= 0) return;
  target.hp -= damage;
  target.hurt = s.tick;
  s.events.push({ k: 'hit', target: target.id, x: target.x, y: target.y, damage, owner: target.owner, building: target.kind === 'building' });
  const p = s.players[target.owner];
  if (by !== target.owner && s.tick - p.alert > secs(12)) {
    p.alert = s.tick;
    s.events.push({ k: 'alert', owner: target.owner, x: target.x, y: target.y, building: target.kind === 'building' });
  }
  if (target.hp <= 0) {
    s.players[by].stats.kills++;
    if (target.kind === 'building') s.players[by].stats.razed++;
    return;
  }
  // Soldiers standing about answer whoever hits them.
  if (attacker && target.kind === 'unit' && target.type !== 'citizen' && target.order.k === 'idle' && attacker.hp > 0) {
    target.order = { k: 'attack', target: attacker.id, auto: true, then: null };
  }
}

/** Swing at or shoot a target that is in reach. */
export function strike(s: GameState, u: Unit, t: Ent): void {
  const st = statsOf(s, u);
  u.swing = s.tick;
  if (st.range > 0 && st.shot) {
    const dx = t.x - u.x;
    const dy = t.y - u.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    s.shots.push({
      id: s.nextId++,
      owner: u.owner,
      kind: st.shot,
      x0: u.x,
      y0: u.y,
      target: t.id,
      tx: t.x,
      ty: t.y,
      t: 0,
      dur: Math.max(2, Math.ceil((d / SHOT_SPEED[st.shot]) * TICK_HZ)),
      damage: damageOf(st, t, s, true),
    });
    s.events.push({ k: 'swing', id: u.id, target: t.id, x: u.x, y: u.y, owner: u.owner, ranged: true, type: u.type });
    s.events.push({ k: 'shot', owner: u.owner, kind: st.shot, x: u.x, y: u.y });
    return;
  }
  s.events.push({ k: 'swing', id: u.id, target: t.id, x: u.x, y: u.y, owner: u.owner, ranged: false, type: u.type });
  hurt(s, t, damageOf(st, t, s, false), u.owner, u);
}

/** Move shots along; those that arrive hit their target if it still stands. */
export function updateShots(s: GameState): void {
  const keep: Shot[] = [];
  for (const sh of s.shots) {
    sh.t++;
    const t = s.byId.get(sh.target);
    if (t && t.hp > 0) {
      sh.tx = t.x;
      sh.ty = t.y;
    }
    if (sh.t < sh.dur) {
      keep.push(sh);
      continue;
    }
    if (t && t.hp > 0) hurt(s, t, sh.damage, sh.owner, null);
  }
  s.shots = keep;
}

/** The nearest enemy unit within a radius of a point, or null. */
export function nearestEnemyUnit(s: GameState, sp: Spatial, owner: number, x: number, y: number, r: number): Unit | null {
  let best: Unit | null = null;
  let bestD = r * r;
  sp.near(x, y, r, (o) => {
    if (o.hp <= 0 || !isEnemy(s, owner, o.owner)) return;
    const dx = o.x - x;
    const dy = o.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD || (d === bestD && best && o.id < best.id)) {
      bestD = d;
      best = o;
    }
  });
  return best;
}

/** Town Centers and towers shoot at the nearest enemy in range. */
export function buildingGuns(s: GameState, sp: Spatial, b: Building): void {
  const g = BUILDINGS[b.type].guns;
  if (!g || !b.built) return;
  if (b.cool > 0) {
    b.cool--;
    return;
  }
  const epoch = s.players[b.owner].epoch;
  const reach = g.range + b.size / 2;
  const t = nearestEnemyUnit(s, sp, b.owner, b.x, b.y, reach);
  if (!t) return;
  const ts = unitStats(t.type, s.players[t.owner].epoch);
  const dx = t.x - b.x;
  const dy = t.y - b.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  b.cool = secs(g.reload);
  s.shots.push({
    id: s.nextId++,
    owner: b.owner,
    kind: 'arrow',
    x0: b.x,
    y0: b.y,
    target: t.id,
    tx: t.x,
    ty: t.y,
    t: 0,
    dur: Math.max(2, Math.ceil((d / SHOT_SPEED.arrow) * TICK_HZ)),
    damage: Math.max(1, g.damage * (1 + epoch * 0.2) - ts.parmor),
  });
  s.events.push({ k: 'shot', owner: b.owner, kind: 'arrow', x: b.x, y: b.y });
}
