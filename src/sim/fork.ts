import { HEMOCRAFT, RITE, TICK_HZ, secs } from './data';
import { ageDef } from './ages';
import { bleeds, bloodOf, gainBlood } from './blood';
import { hurt, peace } from './combat';
import { isEnemy, maxHp } from './world';
import type { Building, GameState, Unit } from './types';

/**
 * The fork at the end of the Path of Blood (#355 s2). Past Total War a people takes one of two branches, and each does something
 * of its own with blood every second:
 * - Hemocraft, blood run through machines: a finished Drain Rig bleeds the living enemy standing near it into the store (`HEMOCRAFT`).
 *   Machines, ships and aircraft bleed nothing, so the answer to a town of rigs is steel.
 * - The Blood-rite, blood as a sacrament: a finished Temple is an altar that mends its people's hurt living near it, paid from the
 *   store (`RITE`). (Its altars also draw from the enemy who fall near them: `drawBlood` in `blood.ts`.)
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
