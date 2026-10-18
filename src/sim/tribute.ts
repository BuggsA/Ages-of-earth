import { TRIBUTE, secs, unitStats } from './data';
import { borderMap } from './borders';
import { modsOf } from './stats';
import { stoneTribute } from './nomad';
import { isEnemy } from './world';
import type { GameState, Unit } from './types';

/**
 * Tribute (the Age of the Horde, #318): riders who stand their ground in a rival's land take gold from that
 * rival's treasury, the people's `tribute` mod a second each, counting at most `TRIBUTE.most` riders a rival.
 * The numbers are `TRIBUTE` in `data.ts`.
 */

/** Whether a unit is a rider that can exact tribute: a mounted soldier, not a wagon or a hero. */
export const isRider = (u: Unit): boolean => unitStats(u.type, 0).cls === 'cavalry';

/** Whether a unit stands where it is: not walking (fighting in place counts). */
export const standing = (u: Unit): boolean => u.path === null && !u.wantPath;

/** Whether this rider is exacting tribute now: its people's age takes tribute, and it stands on a rival's land. */
export function exacting(s: GameState, u: Unit, landOwner: number): boolean {
  return u.hp > 0 && !u.inside && isRider(u) && standing(u) && modsOf(s, u.owner).tribute > 0 && landOwner >= 0 && isEnemy(s, u.owner, landOwner);
}

/** Every `TRIBUTE.every` seconds outside the peace: each horde's standing riders take their tribute. */
export function tributeStep(s: GameState): void {
  if (s.tick === 0 || s.tick < s.peaceUntil || s.tick % secs(TRIBUTE.every) !== 0) return;
  // Nothing is read or built unless some people takes tribute, so a match without a horde runs as it always did.
  if (!s.players.some((p) => !p.defeated && modsOf(s, p.id).tribute > 0)) return;
  const own = borderMap(s);
  // Riders by (taker, rival), in the order they stand in `ents` (id order), for every machine alike.
  const riders = new Map<number, Unit[]>();
  const n = s.players.length;
  for (const u of s.ents) {
    if (u.kind !== 'unit' || s.players[u.owner].defeated) continue;
    const x = Math.floor(u.x), y = Math.floor(u.y);
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
    const here = own[y * s.w + x];
    if (!exacting(s, u, here)) continue;
    const key = u.owner * n + here;
    const list = riders.get(key);
    if (list) list.push(u);
    else riders.set(key, [u]);
  }
  const keys = [...riders.keys()].sort((a, b) => a - b);
  for (const key of keys) {
    const owner = Math.floor(key / n), from = key - owner * n;
    const counted = riders.get(key)!.slice(0, TRIBUTE.most);
    const due = counted.length * modsOf(s, owner).tribute * TRIBUTE.every;
    const rival = s.players[from];
    const p = s.players[owner];
    const gold = Math.min(due, Math.max(0, rival.res.gold));
    // A nomad people (#501) takes cut stone with the gold, by what was due, so a rival with an empty purse still pays in stone.
    const stone = Math.min(stoneTribute(p, due), Math.max(0, rival.res.stone));
    if (gold <= 0 && stone <= 0) continue;
    rival.res.gold -= gold;
    p.res.gold += gold;
    p.stats.tribute = (p.stats.tribute ?? 0) + gold;
    if (stone > 0) {
      rival.res.stone -= stone;
      p.res.stone += stone;
      p.stats.tributeStone = (p.stats.tributeStone ?? 0) + stone;
    }
    s.events.push({ k: 'tribute', owner, from, gold, ...(stone > 0 ? { stone } : {}), ids: counted.map((u) => u.id), x: counted[0].x, y: counted[0].y });
  }
}
