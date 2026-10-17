import { HEMOCRAFT, RITE, TICK_HZ, secs } from './data';
import { ageDef } from './ages';
import { bleeds, bloodOf, gainBlood } from './blood';
import { hurt, peace } from './combat';
import { isEnemy, maxHp, statsOf } from './world';
import type { Building, Ent, GameState, Unit } from './types';

/**
 * The fork at the end of the Path of Blood (#355 s2). Past Total War a people takes one of two branches, and each does something
 * of its own with blood every second:
 * - Hemocraft, blood run through machines: a finished Drain Rig bleeds the living enemy standing near it into the store (`HEMOCRAFT`).
 *   Machines, ships and aircraft bleed nothing, so the answer to a town of rigs is steel.
 * - The Blood-rite, blood as a sacrament: a finished Temple is an altar that mends its people's hurt living near it, paid from the
 *   store (`RITE`). (Its altars also draw from the enemy who fall near them: `drawBlood` in `blood.ts`.) Its priests chant two more
 *   rites over an enemy that bleeds (#355 s4): sacrifice, which kills it for its blood, and a curse, which makes every blow land harder
 *   on it and the living around it. Both are `convert` orders with a `rite`, worked in `convertStep` (`units.ts`).
 */

/** Units within `reach` tiles of a building that pass `ok`, nearest first (ties in id order), at most `most`. */
function nearest(s: GameState, b: Building, reach: number, most: number, ok: (u: Unit) => boolean): Unit[] {
  const r2 = reach * reach;
  const near: { u: Unit; d: number }[] = [];
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || !ok(e)) continue;
    const d = (e.x - b.x) * (e.x - b.x) + (e.y - b.y) * (e.y - b.y);
    if (d <= r2) near.push({ u: e, d });
  }
  near.sort((a, c) => a.d - c.d || a.u.id - c.u.id);
  return near.slice(0, most).map((n) => n.u);
}

/** A Hemocraft rig bleeds the living enemy near it, and its people takes the blood. */
function drain(s: GameState, b: Building): void {
  const p = s.players[b.owner];
  for (const u of nearest(s, b, HEMOCRAFT.drain, HEMOCRAFT.most, (e) => isEnemy(s, b.owner, e.owner) && bleeds(e))) {
    const n = Math.min(u.hp, HEMOCRAFT.bleed);
    hurt(s, u, HEMOCRAFT.bleed, b.owner, null);
    gainBlood(s, p, n * HEMOCRAFT.yield, u.x, u.y, 'drain');
  }
}

/** A Blood-rite altar mends its people's hurt living near it while the store holds blood. */
function mend(s: GameState, b: Building): void {
  const p = s.players[b.owner];
  if (bloodOf(p) <= 0) return;
  const show = s.tick % secs(3) === 0;
  for (const u of nearest(s, b, RITE.reach, RITE.most, (e) => e.owner === b.owner && bleeds(e) && e.hp < maxHp(s, e))) {
    const n = Math.min(maxHp(s, u) - u.hp, RITE.mend, bloodOf(p) / RITE.price);
    if (n <= 0) break;
    u.hp += n;
    p.blood = Math.max(0, bloodOf(p) - n * RITE.price);
    p.stats.riteMended = (p.stats.riteMended ?? 0) + n;
    if (show) s.events.push({ k: 'healed', id: u.id, x: u.x, y: u.y });
  }
}

/** Once a second: every Hemocraft rig drains (not in a peace), every Blood-rite altar mends. */
export function forkStep(s: GameState): void {
  if (s.tick % TICK_HZ !== 0) return;
  const calm = peace(s);
  for (const e of s.ents) {
    if (e.kind !== 'building' || !e.built || e.hp <= 0) continue;
    if (e.type === 'drainrig') {
      if (!calm && ageDef(s.players[e.owner]).hemocraft) drain(s, e);
    } else if (e.type === 'temple' && ageDef(s.players[e.owner]).rite) mend(s, e);
  }
}

/** Why `p`'s priests can't chant this rite over `t` now, or null. Machines, ships and aircraft bleed nothing, and no King is offered. */
export function riteProblem(s: GameState, p: number, rite: 'sacrifice' | 'curse', t: Ent): string | null {
  if (!ageDef(s.players[p]).rite) return 'Only a people of the Blood-rite chants this';
  if (t.kind !== 'unit' || t.hp <= 0) return 'The rite is worked on the living, not on stone';
  if (!isEnemy(s, p, t.owner)) return 'The rite is chanted over an enemy';
  if (peace(s)) return 'Not while the peace treaty holds';
  if (!bleeds(t)) return `A ${statsOf(s, t).name} bleeds nothing: steel, ships and aircraft are beyond the rite`;
  if (rite === 'sacrifice' && s.kings.includes(t.id)) return 'A King is never offered';
  if (rite === 'curse' && bloodOf(s.players[p]) < RITE.curse) return `A curse takes ${RITE.curse} blood: ${Math.ceil(RITE.curse - bloodOf(s.players[p]))} more`;
  return null;
}

/** The blood a sacrifice pays: `RITE.offering` of the victim's price (a Hero `RITE.hero` times that), at least 1. */
export function offeringOf(s: GameState, t: Unit): number {
  const c = statsOf(s, t).cost;
  const price = (c.food ?? 0) + (c.wood ?? 0) + (c.gold ?? 0) + (c.stone ?? 0);
  return Math.max(1, Math.floor(price * RITE.offering * (t.type === 'hero' ? RITE.hero : 1)));
}

/** The priest finishes the sacrifice: the victim dies, and its people's enemy takes the blood. */
export function sacrifice(s: GameState, priest: Unit, t: Unit): void {
  const p = s.players[priest.owner];
  const n = offeringOf(s, t);
  gainBlood(s, p, n, t.x, t.y, 'sacrifice');
  p.stats.sacrificed = (p.stats.sacrificed ?? 0) + 1;
  s.events.push({ k: 'rite', how: 'sacrifice', owner: priest.owner, against: t.owner, id: t.id, x: t.x, y: t.y, n });
  hurt(s, t, t.hp, priest.owner, priest);
}

/** The priest finishes the curse: `RITE.curse` blood is spent, and `t` and the living enemies near it are cursed. Returns how many. */
export function curse(s: GameState, priest: Unit, t: Unit): number {
  const p = s.players[priest.owner];
  p.blood = Math.max(0, bloodOf(p) - RITE.curse);
  const r2 = RITE.spread * RITE.spread;
  const near = s.ents
    .filter((e): e is Unit => e.kind === 'unit' && e.hp > 0 && !e.inside && isEnemy(s, priest.owner, e.owner) && bleeds(e) && (e.x - t.x) * (e.x - t.x) + (e.y - t.y) * (e.y - t.y) <= r2)
    .map((e) => ({ e, d: (e.x - t.x) * (e.x - t.x) + (e.y - t.y) * (e.y - t.y) }))
    .sort((a, b) => a.d - b.d || a.e.id - b.e.id)
    .slice(0, RITE.curses);
  for (const n of near) n.e.cursed = s.tick + secs(RITE.last);
  p.stats.cursed = (p.stats.cursed ?? 0) + 1;
  s.events.push({ k: 'rite', how: 'curse', owner: priest.owner, against: t.owner, id: t.id, x: t.x, y: t.y, n: near.length });
  return near.length;
}
