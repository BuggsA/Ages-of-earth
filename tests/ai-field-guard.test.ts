import { describe, expect, it } from 'vitest';
import { AI_LEVELS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { Building, Unit } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The computer guards its forward Airfield with idle fighters (#379). */
function play(guard: boolean) {
  const s = createGame({ seed: 7, size: 'large', startEpoch: 4, peaceMinutes: 30, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'hard', civ: 'greeks' }] });
  const p = s.players[1];
  restat(s, p, () => { p.age = 'aeronaut'; });
  p.seen.fill(1);
  if (!guard) AI_LEVELS.hard.fieldGuard = false;
  const home = placeBuilding(s, 1, 'airfield', p.startX + 8, p.startY + 8, true);
  const enemy = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
  const l = Math.hypot(enemy.x - home.x, enemy.y - home.y);
  const fwd = placeBuilding(s, 1, 'airfield', home.x + ((enemy.x - home.x) / l) * 30, home.y + ((enemy.y - home.y) / l) * 30, true);
  const planes = [0, 1].map((i) => spawnUnit(s, 1, 'fighter', home.x + i, home.y + 3) as Unit);
  s.peaceUntil = 1e9;
  for (let i = 0; i < secs(40); i++) step(s);
  delete AI_LEVELS.hard.fieldGuard;
  return { fwd, planes, home };
}
const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('fighters guard the forward Airfield', () => {
  it('idle fighters fly to it, and stay home when the guard is off', () => {
    const on = play(true);
    expect(on.planes.every((u) => near(u, on.fwd) < 12)).toBe(true);
    const off = play(false);
    expect(off.planes.every((u) => near(u, off.fwd) > 12)).toBe(true);
  });
});
