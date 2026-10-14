import { MILITARY, RALLY, secs } from './data';
import { maxHp } from './world';
import type { Ent, GameState, Player, Unit } from './types';

/** The hero's Rallying Cry: why it can't be called now, or null if it can. */
export function rallyProblem(s: GameState, p: Player, h: Ent): string | null {
  if (h.kind !== 'unit' || h.type !== 'hero' || h.owner !== p.id || h.hp <= 0 || h.inside) return 'Only your hero in the field can rally the line';
  if (h.cryReady !== undefined && s.tick < h.cryReady) return `The hero is catching breath: ${Math.ceil((h.cryReady - s.tick) / secs(1))}s`;
  return null;
}

/** Soldiers of the hero's side within reach are stirred: tougher, harder-hitting, and mended a little. Id order. */
export function rallyCry(s: GameState, h: Unit): void {
  h.cryReady = s.tick + secs(RALLY.duration + RALLY.cooldown);
  let n = 0;
  for (const u of s.ents) {
    if (u.kind !== 'unit' || u.owner !== h.owner || u.hp <= 0 || u.inside || !MILITARY.includes(u.type)) continue;
    const dx = u.x - h.x, dy = u.y - h.y;
    if (dx * dx + dy * dy > RALLY.radius * RALLY.radius) continue;
    u.cry = s.tick + secs(RALLY.duration);
    u.hp = Math.min(maxHp(s, u), u.hp + RALLY.heal);
    n++;
  }
  s.events.push({ k: 'cry', owner: h.owner, id: h.id, x: h.x, y: h.y, n });
}
