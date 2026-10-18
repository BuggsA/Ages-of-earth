import { AURA, RALLY, BONUS, BLOOD_TOWER, BUILDINGS, DEER, LIGHTNING, VETERANCY, TICK_HZ, domainOf, secs, HEART, type UnitStats } from './data';
import { hasCoils } from './ages';
import { bleeds, curseTaken, drawBlood, hemoBlow, hemoTaken } from './blood';
import { fairPurse } from './fair';
import { raidBlow, raidSlain } from './ways';
import { takeCaptive } from './thralls';
import { prizeOf } from './convoy';
import { looted, pack } from './spoils';
import { raided } from './household';
import { distToRect } from './grid';
import type { Spatial } from './spatial';
import { modsOf, statsFor } from './stats';
import type { Animal, Building, Ent, GameState, Shot, Unit } from './types';
import { canHit, isEnemy, radiusOf, statsOf } from './world';

/** Blows, shots, towers, the damage triangle, splash and the hunt. */

const SHOT_SPEED: Record<Shot['kind'], number> = { stone: 10, arrow: 13, bolt: 15, bullet: 32, spear: 9, boulder: 8, ball: 20, bomb: 6 };

/** Whether a peace treaty still holds (no fighting between players). */
export const peace = (s: GameState) => s.tick < s.peaceUntil;

/** A unit's veteran rank: 0 for none, up to 3. */
export function rankOf(u: Unit): number {
  const k = u.vet ?? 0;
  let r = 0;
  for (let i = 0; i < VETERANCY.kills.length; i++) if (k >= VETERANCY.kills[i]) r = i + 1;
  return r;
}

/** Whether a Rallying Cry is still stirring a unit. */
export function stirred(s: GameState, u: Unit): boolean {
  return u.cry !== undefined && s.tick < u.cry;
}

/** Damage of one blow or shot after the counter bonus, a hero's inspiration and armor. */
export function damageOf(s: GameState, attacker: Unit | null, st: UnitStats, target: Ent, ranged: boolean): number {
  const inspired = (attacker && s.tick - attacker.aura < 5 ? AURA.attack : 1) * (attacker && rankOf(attacker) ? VETERANCY.attack[rankOf(attacker) - 1] : 1) * (attacker && stirred(s, attacker) ? RALLY.attack : 1) * hemoBlow(s, attacker);
  if (target.kind === 'building') {
    // Walls shrug off all but siege and heavy blows.
    const wall = target.type === 'wall' || target.type === 'gate' ? (st.cls === 'siege' ? 1.2 : st.cls === 'infantry' || st.cls === 'hero' ? 0.5 : 0.15) : 1;
    return Math.max(1, st.attack * BONUS[st.cls].building * inspired * wall);
  }
  const ts = statsOf(s, target);
  const rank = target.kind === 'unit' ? rankOf(target) : 0;
  const armor = (ranged ? ts.parmor : ts.armor) + (rank ? VETERANCY.armor[rank - 1] : 0) + (target.kind === 'unit' && stirred(s, target) ? RALLY.armor : 0);
  return Math.max(1, st.attack * BONUS[st.cls][ts.cls] * inspired * hemoTaken(s, target, st.cls) - armor);
}

/** Edge-to-edge distance between a unit and anything. */
export function gap(s: GameState, u: Unit, t: Ent): number {
  const r = statsOf(s, u).radius;
  if (t.kind === 'building') return distToRect(u.x, u.y, t) - r;
  const dx = t.x - u.x;
  const dy = t.y - u.y;
  return Math.sqrt(dx * dx + dy * dy) - r - radiusOf(s, t);
}

export function hurt(s: GameState, target: Ent, damage: number, by: number, attacker: Unit | null, credit: Unit | null = attacker): void {
  if (target.hp <= 0) return;
  damage *= curseTaken(s, target);
  target.hp -= damage;
  target.hurt = s.tick;
  s.events.push({ k: 'hit', target: target.id, x: target.x, y: target.y, damage, owner: target.owner, building: target.kind === 'building' });
  const p = s.players[target.owner];
  if (by !== target.owner && target.kind === 'building' && target.type === 'towncenter' && s.tick - (p.tcAlert ?? -9999) > secs(HEART.alert)) {
    p.tcAlert = s.tick;
    p.alert = s.tick;
    s.events.push({ k: 'alert', owner: target.owner, x: target.x, y: target.y, building: true, heart: true });
  } else if (by !== target.owner && s.tick - p.alert > secs(12)) {
    p.alert = s.tick;
    s.events.push({ k: 'alert', owner: target.owner, x: target.x, y: target.y, building: target.kind === 'building', ...(target.kind === 'unit' && target.order.k === 'hunt' ? { hunter: true } : {}) });
  }
  if (target.hp <= 0) {
    s.players[by].stats.kills++;
    if (target.kind === 'unit' && by !== target.owner) plunder(s, target, by, credit);
    if (target.kind === 'building') {
      s.players[by].stats.razed++;
      const purse = by !== target.owner ? fairPurse(s, target) : 0;
      // A household people's house razed by a rival takes the raid from the treasury (#501).
      const levy = by !== target.owner ? raided(s, target) : 0;
      if (levy > 0) {
        s.players[target.owner].res.gold -= levy;
        s.players[by].res.gold += levy;
        s.players[by].stats.plunder = (s.players[by].stats.plunder ?? 0) + levy;
        s.events.push({ k: 'plunder', owner: by, x: target.x, y: target.y, gold: levy });
      }
      if (purse > 0) {
        s.players[by].res.gold += purse;
        s.players[by].stats.plunder = (s.players[by].stats.plunder ?? 0) + purse;
        s.events.push({ k: 'plunder', owner: by, x: target.x, y: target.y, gold: purse });
      }
    } else if (credit && credit.hp > 0 && credit.owner === by && statsOf(s, target).cls !== 'citizen') {
      const before = rankOf(credit);
      credit.vet = (credit.vet ?? 0) + 1;
      const after = rankOf(credit);
      if (after > before) s.events.push({ k: 'rank', id: credit.id, owner: credit.owner, x: credit.x, y: credit.y, rank: after });
    }
    return;
  }
  // Soldiers standing about answer whoever hits them (if their stance lets them move).
  if (attacker && target.kind === 'unit' && target.type !== 'citizen' && target.type !== 'priest' && target.order.k === 'idle' && attacker.hp > 0 && target.stance !== 'stand' && target.stance !== 'run' && canHit(s, target, attacker)) {
    target.order = { k: 'attack', target: attacker.id, auto: true, then: null };
  }
  // The Warband feeds on the raid (#463 s1): blows on a rival's food buildings carry off its food.
  if (target.kind === 'building') raidBlow(s, target, damage, by, attacker);
}

/**
 * An enemy unit has fallen to `by`'s people (#299): it counts toward the Path of Blood's deeds, and a
 * people with a `plunder` share takes that much of the fallen unit's price as gold.
 */
function plunder(s: GameState, target: Unit, by: number, credit: Unit | null): void {
  const p = s.players[by];
  p.stats.slain = (p.stats.slain ?? 0) + 1;
  drawBlood(s, target, by, credit);
  raidSlain(s, target, by);
  takeCaptive(s, target, by);
  // A laden Warband soldier's pack goes to whoever fells it (#502).
  const pack0 = looted(target, by);
  if (pack0 > 0) {
    p.res.gold += pack0;
    p.stats.plunder = (p.stats.plunder ?? 0) + pack0;
    s.events.push({ k: 'plunder', owner: by, x: target.x, y: target.y, gold: pack0 });
    delete target.spoils;
  }
  const prize = prizeOf(s, target, by);
  if (prize > 0) {
    p.res.gold += prize;
    p.stats.plunder = (p.stats.plunder ?? 0) + prize;
    s.events.push({ k: 'plunder', owner: by, x: target.x, y: target.y, gold: prize });
  }
  const share = modsOf(s, by).plunder;
  if (share <= 0) return;
  const c = statsOf(s, target).cost;
  const gold = Math.floor(((c.food ?? 0) + (c.wood ?? 0) + (c.gold ?? 0) + (c.stone ?? 0)) * share);
  if (gold <= 0) return;
  if (pack(s, credit, by, gold)) return;
  p.res.gold += gold;
  p.stats.plunder = (p.stats.plunder ?? 0) + gold;
  s.events.push({ k: 'plunder', owner: by, x: target.x, y: target.y, gold });
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
      // A bomb takes a while to fall, however close it is dropped.
      dur: Math.max(st.shot === 'bomb' ? 16 : 2, Math.ceil((d / SHOT_SPEED[st.shot]) * TICK_HZ)),
      damage: damageOf(s, u, st, t, true),
      splash: st.splash ?? 0,
      from: u.type,
      animal: false,
      fromAir: domainOf(u.type) === 'air',
      src: u.id,
    });
    s.events.push({ k: 'swing', id: u.id, target: t.id, x: u.x, y: u.y, owner: u.owner, ranged: true, type: u.type });
    s.events.push({ k: 'shot', owner: u.owner, kind: st.shot, x: u.x, y: u.y, air: domainOf(u.type) === 'air' });
    return;
  }
  s.events.push({ k: 'swing', id: u.id, target: t.id, x: u.x, y: u.y, owner: u.owner, ranged: false, type: u.type });
  hurt(s, t, damageOf(s, u, st, t, false), u.owner, u);
}

/** A hunter's spear at an animal (or a soldier's arrow, stone or shot, with its own `kind` and `damage`). */
export function throwSpear(s: GameState, u: Unit, a: Animal, kind: Shot['kind'] = 'spear', damage: number = DEER.spearDamage): void {
  u.swing = s.tick;
  const dx = a.x - u.x;
  const dy = a.y - u.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  s.shots.push({
    id: s.nextId++,
    owner: u.owner,
    kind,
    x0: u.x,
    y0: u.y,
    target: a.id,
    tx: a.x,
    ty: a.y,
    t: 0,
    dur: Math.max(2, Math.ceil((d / SHOT_SPEED[kind]) * TICK_HZ)),
    damage,
    splash: 0,
    from: u.type,
    animal: true,
  });
  s.events.push({ k: 'shot', owner: u.owner, kind, x: u.x, y: u.y });
}

/** Move shots along; those that arrive hit their target if it still stands, and splash around. */
export function updateShots(s: GameState, sp: Spatial, hitAnimal: (a: Animal, damage: number, fromX: number, fromY: number) => void): void {
  const keep: Shot[] = [];
  for (const sh of s.shots) {
    sh.t++;
    const t = sh.animal ? undefined : s.byId.get(sh.target);
    const a = sh.animal ? s.animals.find((x) => x.id === sh.target) : undefined;
    if (t && t.hp > 0) {
      sh.tx = t.x;
      sh.ty = t.y;
    } else if (a && a.hp > 0) {
      sh.tx = a.x;
      sh.ty = a.y;
    }
    if (sh.t < sh.dur) {
      keep.push(sh);
      continue;
    }
    if (a && a.hp > 0) {
      hitAnimal(a, sh.damage, sh.x0, sh.y0);
      continue;
    }
    const shooter = sh.src ? s.byId.get(sh.src) : undefined;
    if (t && t.hp > 0) hurt(s, t, sh.damage, sh.owner, null, shooter && shooter.kind === 'unit' ? shooter : null);
    if (sh.splash > 0) {
      s.events.push({ k: 'splash', x: sh.tx, y: sh.ty, owner: sh.owner, kind: sh.kind });
      const st = sh.from ? statsFor(s, sh.owner, sh.from) : null;
      sp.near(sh.tx, sh.ty, sh.splash + 0.5, (o) => {
        // Blasts on the ground don't reach aircraft.
        if (o === t || o.hp <= 0 || !isEnemy(s, sh.owner, o.owner) || domainOf(o.type) === 'air') return;
        const dx = o.x - sh.tx;
        const dy = o.y - sh.ty;
        if (dx * dx + dy * dy > sh.splash * sh.splash) return;
        hurt(s, o, st ? damageOf(s, null, st, o, true) * 0.6 : sh.damage * 0.5, sh.owner, null);
      });
    }
  }
  s.shots = keep;
}

/** The nearest enemy unit within a radius of a point, or null. */
export function nearestEnemyUnit(s: GameState, sp: Spatial, owner: number, x: number, y: number, r: number, filter?: (u: Unit) => boolean): Unit | null {
  let best: Unit | null = null;
  let bestD = r * r;
  sp.near(x, y, r, (o) => {
    if (o.hp <= 0 || !isEnemy(s, owner, o.owner) || (filter && !filter(o))) return;
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

/** Town Centers and towers shoot at the nearest enemies in range, one more arrow for each unit sheltering inside. */
export function buildingGuns(s: GameState, sp: Spatial, b: Building): void {
  const g = BUILDINGS[b.type].guns;
  if (!g || !b.built || peace(s)) return;
  if (b.cool > 0) {
    b.cool--;
    return;
  }
  const epoch = s.players[b.owner].epoch;
  const m = modsOf(s, b.owner);
  const reach = g.range + m.range + b.size / 2;
  // A Blood Tower (#355 s3) looks for the living first, and spends its bolts on the bloodless only when nothing else is near.
  const blood = b.type === 'bloodtower';
  const t = (blood ? nearestEnemyUnit(s, sp, b.owner, b.x, b.y, reach, bleeds) : null) ?? nearestEnemyUnit(s, sp, b.owner, b.x, b.y, reach);
  if (!t) return;
  b.cool = secs(g.reload);
  const power = (g.damage + m.rangedAttack) * (1 + epoch * 0.2);
  // A Coil Tower (the Age of Lightning, #231) looses a bolt in place of its own arrow; those sheltering inside still shoot.
  const coil = b.type === 'tower' && hasCoils(s.players[b.owner]);
  if (coil) arc(s, sp, b, t, power);
  const arrows = 1 + Math.min(10, b.garrison.length);
  // Extra arrows go to others nearby when there are any, so a volley spreads over a crowd.
  const others: Unit[] = [];
  if (arrows > 1) sp.near(b.x, b.y, reach, (o) => {
    if (o !== t && o.hp > 0 && isEnemy(s, b.owner, o.owner)) {
      const dx = o.x - b.x;
      const dy = o.y - b.y;
      if (dx * dx + dy * dy <= reach * reach) others.push(o);
    }
  });
  if (coil && arrows === 1) return;
  for (let k = coil ? 1 : 0; k < arrows; k++) {
    const target = k === 0 || !others.length ? t : others[(k - 1) % others.length];
    const ts = statsOf(s, target);
    const dx = target.x - b.x;
    const dy = target.y - b.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    s.shots.push({
      id: s.nextId++,
      owner: b.owner,
      kind: blood ? 'bolt' : 'arrow',
      x0: b.x,
      y0: b.y,
      target: target.id,
      tx: target.x,
      ty: target.y,
      t: -k,
      dur: Math.max(2, Math.ceil((d / SHOT_SPEED[blood ? 'bolt' : 'arrow']) * TICK_HZ)),
      damage: blood
        ? Math.max(1, power * (bleeds(target) ? BLOOD_TOWER.living : BLOOD_TOWER.bloodless) - ts.parmor)
        : Math.max(1, power * hemoTaken(s, target, 'arrow') - ts.parmor),
      splash: 0,
      from: null,
      animal: false,
    });
  }
  s.events.push({ k: 'shot', owner: b.owner, kind: blood ? 'bolt' : 'arrow', x: b.x, y: b.y });
}

/**
 * A Coil Tower's bolt (#231): it strikes the first enemy, then leaps to the nearest enemy within
 * `LIGHTNING.leap` of the last one struck that it hasn't struck yet, keeping `LIGHTNING.keep` of its strength
 * at each leap, up to `LIGHTNING.strikes` in all. A crowd takes it all; a spread line takes one blow.
 */
function arc(s: GameState, sp: Spatial, b: Building, first: Unit, power: number): void {
  const struck: Unit[] = [first];
  const pts = [b.x, b.y, first.x, first.y];
  let at = first;
  let damage = power;
  for (;;) {
    hurt(s, at, Math.max(1, damage * hemoTaken(s, at, 'coil') - statsOf(s, at).parmor), b.owner, null);
    if (struck.length >= LIGHTNING.strikes) break;
    const next = nearestEnemyUnit(s, sp, b.owner, at.x, at.y, LIGHTNING.leap, (o) => !struck.includes(o));
    if (!next) break;
    struck.push(next);
    pts.push(next.x, next.y);
    damage *= LIGHTNING.keep;
    at = next;
  }
  s.events.push({ k: 'arc', owner: b.owner, building: b.id, pts });
}
