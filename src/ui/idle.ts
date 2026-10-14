import type { Ent, GameState, Unit } from '../sim/types';

/** Citizens who can be given fresh work without disturbing shelter or queued orders. */
export function isIdleCitizen(e: Ent, owner: number): e is Unit {
  return e.kind === 'unit' && e.owner === owner && e.type === 'citizen' && e.hp > 0 && !e.inside && e.order.k === 'idle' && e.queue.length === 0;
}

export function idleCitizens(s: GameState, owner: number): Unit[] {
  return s.ents.filter((e): e is Unit => isIdleCitizen(e, owner));
}

/** Cycle from the current selection, or gather the whole group in the same stable order. */
export function idleSelection(idle: readonly Unit[], current: number | undefined, all: boolean): number[] {
  if (all) return idle.map((u) => u.id);
  if (!idle.length) return [];
  const i = idle.findIndex((u) => u.id === current);
  return [idle[(i + 1) % idle.length].id];
}

/** Shift changes '.' to '>' on common keyboards; use the physical key as well. */
export function idleShortcut(e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
  return !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === '.' || e.code === 'Period');
}
