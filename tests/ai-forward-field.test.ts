import { describe, expect, it } from 'vitest';
import { AI_SORTIE, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { forwardFieldSpot } from '../src/sim/ai';
import type { Building } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The computer and sorties (#379): it raises an Airfield toward an enemy its aircraft could not reach and return from. */
function setup() {
  const s = createGame({ seed: 7, size: 'large', startEpoch: 4, peaceMinutes: 30, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'hard', civ: 'greeks' }] });
  const p = s.players[1];
  restat(s, p, () => { p.age = 'aeronaut'; });
  p.seen.fill(1);
  for (const r of ['food', 'wood', 'gold', 'stone'] as const) p.res[r] = 9000;
  const home = placeBuilding(s, 1, 'airfield', p.startX + 8, p.startY + 8, true);
  const view = () => ({ p, buildings: s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 1) }) as never;
  return { s, p, home, view };
}
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('the computer builds a forward Airfield', () => {
  it('picks a spot nearer the enemy when its target is out of reach, none when in reach or at the cap', () => {
    const { s, home, view } = setup();
    const enemy = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    expect(dist(home, enemy)).toBeGreaterThan(AI_SORTIE.gap);
    const spot = forwardFieldSpot(s, view())!;
    expect(spot).not.toBeNull();
    expect(dist({ x: spot.tx + 2, y: spot.ty + 2 }, enemy)).toBeLessThan(dist(home, enemy) - 8);
    enemy.x = home.x + 10; enemy.y = home.y;
    expect(forwardFieldSpot(s, view())).toBeNull();
  });

  it('orders one while playing, and none before the Age of Aeronauts', () => {
    const { s, p, view } = setup();
    for (let i = 0; i < 24; i++) spawnUnit(s, 1, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
    const fields = () => s.ents.filter((e) => e.kind === 'building' && e.owner === 1 && e.type === 'airfield').length;
    s.peaceUntil = 1e9;
    for (let i = 0; i < secs(30); i++) step(s);
    expect(fields()).toBe(2);
    p.age = 'industrial';
    expect(forwardFieldSpot(s, view())).toBeNull();
  });
});
