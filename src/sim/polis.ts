import { CIVS, POLIS } from './data';
import type { GameState, Player, Unit, UnitType } from './types';
import { canAfford, maxHp, pay, spawnUnit } from './world';

/**
 * The polis (#501, the Greeks): a people whose citizens are its foot soldiers. It trains none (`barred`); a
 * citizen takes up shield and spear where it stands, and a soldier lays them down near home to go back to
 * work. The army is the workforce, so every campaign empties the fields and every farmer can hold the line.
 */
export const isPolis = (p: Player): boolean => !!CIVS[p.civ].polis;

/** Why this unit can't take up arms now, or null. */
export function armProblem(p: Player, u: Unit): string | null {
  if (!isPolis(p)) return 'Only the citizens of a polis take up arms';
  if (u.owner !== p.id || u.hp <= 0 || u.type !== 'citizen') return 'Only citizens take up arms';
  if (u.inside) return 'Step outside first';
  if (!canAfford(p, POLIS.arm)) return 'Not enough for shield and spear';
  return null;
}

/** Why this unit can't lay down its arms now, or null: only near one of its people's Town Centers. */
export function disarmProblem(s: GameState, p: Player, u: Unit): string | null {
  if (!isPolis(p)) return 'Only the citizens of a polis lay down their arms';
  if (u.owner !== p.id || u.hp <= 0 || u.type !== 'infantry') return 'Only foot soldiers lay down their arms';
  if (u.inside) return 'Step outside first';
  return homeNear(s, p.id, u) ? null : `Arms are laid down at home: within ${POLIS.home} tiles of a Town Center`;
}

function homeNear(s: GameState, owner: number, u: Unit): boolean {
  const r2 = POLIS.home * POLIS.home;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== owner || e.type !== 'towncenter' || e.hp <= 0 || !e.built) continue;
    const dx = e.x - u.x;
    const dy = e.y - u.y;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

/** Swap a unit for one of another kind where it stands, keeping its share of health and its facing. */
function become(s: GameState, u: Unit, type: UnitType): Unit {
  const share = u.hp / maxHp(s, u);
  s.byId.delete(u.id);
  s.ents = s.ents.filter((e) => e.id !== u.id);
  const n = spawnUnit(s, u.owner, type, u.x, u.y);
  n.hp = Math.max(1, maxHp(s, n) * share);
  n.fx = u.fx;
  n.fy = u.fy;
  return n;
}

/** Citizens take up arms, each paying its own shield and spear; what they carried is dropped. Returns the new soldiers. */
export function arm(s: GameState, p: Player, units: Unit[]): Unit[] {
  const out: Unit[] = [];
  for (const u of units) {
    if (armProblem(p, u)) continue;
    pay(p, POLIS.arm);
    const h = become(s, u, 'infantry');
    h.levy = true;
    out.push(h);
  }
  if (out.length) p.stats.armed = (p.stats.armed ?? 0) + out.length;
  return out;
}

/** Foot soldiers near home lay down their arms and are citizens again (the arms are not refunded). Returns the citizens. */
export function disarm(s: GameState, p: Player, units: Unit[]): Unit[] {
  const out: Unit[] = [];
  for (const u of units) if (!disarmProblem(s, p, u)) out.push(become(s, u, 'citizen'));
  return out;
}
