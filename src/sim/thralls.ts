import { THRALL } from './data';
import { ageDef } from './ages';
import { autoWork, freeFarm, setOrder } from './units';
import { statsFor } from './stats';
import { isEnemy, spawnUnit } from './world';
import type { GameState, Unit } from './types';

/**
 * A rival citizen fell to a people in the Age of the Warband (#502): a thrall of the slayer rises where it fell, with
 * `THRALL.hp` of a citizen's health, and goes to work nearby. None if the people already hold `THRALL.max`, or have no room.
 */
export function takeCaptive(s: GameState, target: Unit, by: number): void {
  if (target.type !== 'citizen' || !isEnemy(s, by, target.owner)) return;
  const p = s.players[by];
  if (!ageDef(p).thralls || p.pop >= p.cap) return;
  let held = 0;
  for (const e of s.ents) if (e.kind === 'unit' && e.owner === by && e.thrall && e.hp > 0) held++;
  if (held >= THRALL.max) return;
  const u = spawnUnit(s, by, 'citizen', target.x, target.y);
  u.thrall = true;
  u.hp = Math.max(1, Math.floor(statsFor(s, by, 'citizen').hp * THRALL.hp));
  p.pop++;
  const farm = freeFarm(s, by, u.x, u.y, THRALL.reach);
  if (farm) setOrder(u, { k: 'farm', target: farm.id, phase: 'go' });
  else if (!autoWork(s, u, u.x, u.y, THRALL.reach)) setOrder(u, { k: 'idle' });
  s.events.push({ k: 'thrall', owner: by, from: target.owner, x: target.x, y: target.y });
}
