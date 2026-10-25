import { STANDARD, TRIBUTE, secs, unitStats } from './data';
import { ageOf } from './ages';
import { borderMap } from './borders';
import { modsOf } from './stats';
import { stoneTribute } from './nomad';
import { isEnemy } from './world';
import type { Building, GameState, Unit } from './types';

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

/** Whether a Horsetail Standard draws tribute now (#727): finished and standing, in its people's Age of the Horde or kept from it. */
export const flies = (s: GameState, b: Building): boolean => b.type === 'standard' && b.built && b.hp > 0 && (ageOf(s.players[b.owner]) === 'horde' || b.keep === 'horde');

/** The rival whose land lies nearest a standard within `STANDARD.border` tiles of it (the player who owns that land), or -1 for none. */
export function standardRival(s: GameState, own: Int8Array, b: Building): number {
  const cx = b.tx + b.size / 2, cy = b.ty + b.size / 2;
  const r = STANDARD.border;
  let best = -1, bestD = Infinity;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(s.h - 1, Math.floor(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(s.w - 1, Math.floor(cx + r)); x++) {
      const o = own[y * s.w + x];
      const d = (x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy);
      if (o < 0 || d > r * r || d >= bestD || !isEnemy(s, b.owner, o)) continue;
      best = o;
      bestD = d;
    }
  }
  return best;
}

/** Every `TRIBUTE.every` seconds outside the peace: each horde's standing riders take their tribute. */
export function tributeStep(s: GameState): void {
  if (s.tick === 0 || s.tick < s.peaceUntil || s.tick % secs(TRIBUTE.every) !== 0) return;
  // Nothing is read or built unless some people takes tribute, so a match without a horde runs as it always did.
  const flags: Building[] = [];
  for (const e of s.ents) if (e.kind === 'building' && flies(s, e) && !s.players[e.owner].defeated) flags.push(e);
  if (!flags.length && !s.players.some((p) => !p.defeated && modsOf(s, p.id).tribute > 0)) return;
  const own = borderMap(s);
  // Each standard's tributary, found once: the rival nearest it with land inside its border.
  const flagRival = flags.map((b) => standardRival(s, own, b));
  const byFlag = new Set<number>();
  // Riders by (taker, rival), in the order they stand in `ents` (id order), for every machine alike.
  const riders = new Map<number, Unit[]>();
  const n = s.players.length;
  for (const u of s.ents) {
    if (u.kind !== 'unit' || s.players[u.owner].defeated) continue;
    const x = Math.floor(u.x), y = Math.floor(u.y);
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
    const here = own[y * s.w + x];
    let from = here;
    if (!exacting(s, u, here)) {
      // A rider that stands by its people's Horsetail Standard is paid as though it stood in the nearest rival's land (#727).
      from = -1;
      if (u.hp > 0 && !u.inside && isRider(u) && standing(u)) {
        for (let i = 0; i < flags.length && from < 0; i++) {
          const b = flags[i];
          if (b.owner !== u.owner || flagRival[i] < 0) continue;
          const dx = u.x - (b.tx + b.size / 2), dy = u.y - (b.ty + b.size / 2);
          if (dx * dx + dy * dy <= STANDARD.reach * STANDARD.reach) from = flagRival[i];
        }
      }
      if (from < 0) continue;
      byFlag.add(u.owner);
    }
    const key = u.owner * n + from;
    const list = riders.get(key);
    if (list) list.push(u);
    else riders.set(key, [u]);
  }
  const keys = [...riders.keys()].sort((a, b) => a - b);
  for (const key of keys) {
    const owner = Math.floor(key / n), from = key - owner * n;
    const counted = riders.get(key)!.slice(0, TRIBUTE.most);
    const due = counted.length * Math.max(modsOf(s, owner).tribute, byFlag.has(owner) ? STANDARD.rate : 0) * TRIBUTE.every;
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
