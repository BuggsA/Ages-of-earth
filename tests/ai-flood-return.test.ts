import { describe, expect, it } from 'vitest';
import { aiStep, findSpot } from '../src/sim/ai';
import { applyCommand } from '../src/sim/commands';
import { FLOOD, SEASON, secs } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { findResource } from '../src/sim/units';
import { placeBuilding } from '../src/sim/world';
import type { Building, CivId, GameState, Unit } from '../src/sim/types';
import { R_BERRY } from '../src/sim/types';

// When the river falls, the Egyptian computer sends its berry pickers back to the fields the flood emptied (#517).
// Before, the fields stood empty all year: game and berries come before fields, and no field was raised beside an empty one.

/** A Stone Age town with three finished, empty fields and every citizen picking berries, in the given season. */
function town(civ: CivId, season: number): GameState {
  const s = createGame({ seed: 3, size: 'small', players: [{ name: 'A', ai: 'hard', civ }, { name: 'B', ai: null, civ: 'greeks' }] });
  const p = s.players[0];
  for (let i = 0; i < 3; i++) {
    const spot = findSpot(s, 'farm', p.startX, p.startY, 3, 12)!;
    placeBuilding(s, 0, 'farm', spot.tx, spot.ty, true);
  }
  const berry = findResource(s, R_BERRY, p.startX, p.startY, 16);
  expect(berry).toBeGreaterThanOrEqual(0);
  applyCommand(s, { t: 'gather', p: 0, ids: citizens(s).map((u) => u.id), tile: berry });
  s.tick = secs(SEASON.len) * season + 1;
  return s;
}
const citizens = (s: GameState) => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen');
const fields = (s: GameState) => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'farm');
/** Citizens on their way to a field or working one. */
const farmers = (s: GameState) => {
  const ids = new Set(fields(s).map((f) => f.id));
  return citizens(s).filter((u) => (u.order.k === 'farm' || u.order.k === 'move') && 'target' in u.order && ids.has(u.order.target as number)).length;
};

describe('the Egyptian computer goes back to its fields after the flood (#517)', () => {
  it('sends berry pickers to the empty fields once the river falls', () => {
    const s = town('egyptians', FLOOD.season + 1);
    expect(farmers(s)).toBe(0);
    aiStep(s);
    expect(farmers(s)).toBe(Math.min(FLOOD.back, fields(s).length));
  });

  it('sends no one to a field under the river', () => {
    const s = town('egyptians', FLOOD.season);
    aiStep(s);
    expect(farmers(s)).toBe(0);
  });

  it('leaves another people to its usual order of things', () => {
    const s = town('romans', FLOOD.season + 1);
    aiStep(s);
    expect(farmers(s)).toBe(0);
  });
});
