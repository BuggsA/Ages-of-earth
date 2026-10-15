import type { SoundName } from '../audio/sound';
import { statsFor } from '../sim/stats';
import type { GameState, Unit } from '../sim/types';
import { heightAt } from './terrain';
import { WATER_Y } from './water';

/**
 * Where the land's own voices belong: crickets and songbirds away from water, frogs and gulls at it,
 * and the small creatures hush when an army is near. Pure questions about the state and the view's
 * centre, so the view asks them and the tests can too.
 */

export type CreatureVoice = Extract<SoundName, 'cricket' | 'frog' | 'gull' | 'birdsong'>;

/** Whether a map point is open water. */
export function wet(s: GameState, x: number, y: number): boolean {
  return heightAt(s, x, y) < WATER_Y - 0.05;
}

/** Whether open water lies within a few tiles of the view's centre (a coast, a lake, the sea). */
export function nearWater(s: GameState, x: number, z: number, distance: number): boolean {
  const r = Math.max(6, distance * 0.5);
  for (let i = 0; i < 8; i++) {
    const a = i * 0.785;
    if (wet(s, x + Math.cos(a) * r, z + Math.sin(a) * r) || wet(s, x + Math.cos(a) * r * 0.5, z + Math.sin(a) * r * 0.5)) return true;
  }
  return wet(s, x, z);
}

/** Whether a column of soldiers (five or more, seen) marches within a dozen tiles of the view's centre. */
export function armyNear(s: GameState, x: number, z: number, visible: (u: Unit) => boolean): boolean {
  let n = 0;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || Math.abs(e.x - x) > 12 || Math.abs(e.y - z) > 12 || !visible(e)) continue;
    const c = statsFor(s, e.owner, e.type).cls;
    if ((c === 'infantry' || c === 'ranged' || c === 'cavalry' || c === 'siege') && ++n >= 5) return true;
  }
  return false;
}

/** Whether a creature sings here: by the water or away from it, and (but for gulls) only with no army near. */
export function voiceFits(voice: CreatureVoice, water: boolean, army: boolean, season = 0): boolean {
  // Winter (season 3) hushes the land: crickets, songbirds and frogs sleep; only the gulls stay.
  if (season === 3 && voice !== 'gull') return false;
  switch (voice) {
    case 'cricket':
    case 'birdsong':
      return !water && !army;
    case 'frog':
      return water && !army;
    case 'gull':
      return water;
  }
}
