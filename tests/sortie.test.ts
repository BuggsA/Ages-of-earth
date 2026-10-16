import { describe, expect, it } from 'vitest';
import { SORTIE } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import { findSpot } from '../src/sim/ai';
import type { Unit } from '../src/sim/types';

/** Sorties (#356 audit): Aeronauts' aircraft fly on fuel from the Airfield. */
function setup(age: 'aeronaut' | 'industrial') {
  const s = createGame({ seed: 5, size: 'medium', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  const p = s.players[0];
  p.epoch = 4;
  p.age = age;
  const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
  const spot = findSpot(s, 'airfield', tc.x, tc.y, 4, 14)!;
  const field = placeBuilding(s, 0, 'airfield', spot.tx, spot.ty, true);
  return { s, field };
}
const plane = (s: ReturnType<typeof setup>['s'], x: number, y: number): Unit => {
  const u = spawnUnit(s, 0, 'fighter', x, y);
  u.hp = 70;
  return u;
};
const run = (s: ReturnType<typeof setup>['s'], sec: number) => { for (let i = 0; i < sec * 20; i++) step(s, []); };

describe('Sorties', () => {
  it('rearm and mend aircraft sitting at an Airfield', () => {
    const { s, field } = setup('aeronaut');
    const u = plane(s, field.x + 1, field.y);
    run(s, 3);
    expect(u.hp).toBeGreaterThan(70);
  });
  it('turn aircraft for home past the turning range and burn them past reach', () => {
    const { s, field } = setup('aeronaut');
    const dir = field.x > s.w / 2 ? -1 : 1;
    const u = plane(s, field.x + dir * (SORTIE.turn + 2), field.y);
    u.order = { k: 'idle' };
    run(s, 1.2);
    const o = u.order as { k: string; x?: number };
    expect(o.k).toBe('move');
    expect(Math.abs((o.x ?? 1e9) - field.x)).toBeLessThan(1);
    u.x = field.x + dir * (SORTIE.reach + 10);
    const before = u.hp;
    run(s, 1);
    expect(u.hp).toBeLessThan(before);
  });
  it('leave other ages alone', () => {
    const { s, field } = setup('industrial');
    const u = plane(s, field.x + 1, field.y);
    run(s, 3);
    expect(u.hp).toBe(70);
  });
  it('burn aircraft with no Airfield left', () => {
    const { s, field } = setup('aeronaut');
    const u = plane(s, field.x + 1, field.y);
    field.hp = 0;
    run(s, 2);
    expect(u.hp).toBeLessThan(70);
  });
});
