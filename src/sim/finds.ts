import { FINDS, domainOf } from './data';
import { keyAt, led } from './ages';
import type { Find, FindKind, GameState, KeyId, Lead } from './types';

/**
 * Finds (#588, `docs/age-roads.md` rule 5): a nailed wreck, a battlefield cairn, a salt lick, a fallen star or a hermit's
 * shrine stands near every town, the same distance out for each. Whoever's land unit first stands on one takes a small
 * reward and learns that this world holds the key resource it speaks of, with a mark on the minimap at the nearest of it:
 * a lead to chase (a road to take) or to leave alone (the plain road is always there). A world only ever speaks of what it holds.
 */

export const findAt = (s: GameState, id: number): Find | undefined => s.finds?.find((f) => f.id === id);

/** Where the nearest of a key resource lies to a point, or null when none is left (a vein dug out, or ruins all dug). */
export function nearestOf(s: GameState, key: KeyId, x: number, y: number): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  const take = (px: number, py: number) => {
    const d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < bestD) {
      bestD = d;
      best = { x: px, y: py };
    }
  };
  if (key === 'ruin') {
    for (const r of s.ruins ?? []) if (r.by < 0) take(r.x, r.y);
    return best;
  }
  for (let i = 0; i < s.res.length; i++) if (keyAt(s, i) === key) take((i % s.w) + 0.5, Math.floor(i / s.w) + 0.5);
  return best;
}

/** What a find has taught a people about a key resource, or undefined. */
export const leadOf = (p: { leads?: Lead[] }, key: KeyId): Lead | undefined => p.leads?.find((l) => l.key === key);

/** The first land unit (in id order) within reach of a find, or null. */
function finder(s: GameState, f: Find): number {
  const r2 = FINDS.reach * FINDS.reach;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || e.type === 'trader' || domainOf(e.type) !== 'land') continue;
    const dx = e.x - f.x;
    const dy = e.y - f.y;
    if (dx * dx + dy * dy <= r2) return e.owner;
  }
  return -1;
}

/** Every few ticks: a find nobody has claimed goes to the first people to stand on it. */
export function findStep(s: GameState): void {
  if (!s.finds || s.tick % 5 !== 0) return;
  for (const f of s.finds) {
    if (f.by >= 0) continue;
    const owner = finder(s, f);
    if (owner < 0) continue;
    f.by = owner;
    const p = s.players[owner];
    const kind = FINDS.kinds[f.kind as FindKind];
    for (const [r, n] of Object.entries(kind.reward) as ['food' | 'wood' | 'stone' | 'gold', number][]) {
      p.res[r] += n;
      p.stats.gathered += n;
    }
    if (f.key && !led(p, f.key)) (p.leads ??= []).push({ key: f.key, at: nearestOf(s, f.key, f.x, f.y) });
    s.events.push({ k: 'find', id: f.id, owner, kind: f.kind, key: f.key, x: f.x, y: f.y, reward: kind.reward });
  }
}
