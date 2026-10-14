import { describe, expect, it } from 'vitest';
import { RALLY, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { damageOf, stirred } from '../src/sim/combat';
import { rallyProblem } from '../src/sim/rally';
import { spawnUnit, statsOf } from '../src/sim/world';
import type { GameState, Unit } from '../src/sim/types';

function setup(): { s: GameState; hero: Unit; near: Unit; far: Unit; foe: Unit } {
  const s = createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'greeks' }] });
  const home = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
  const at = (type: 'hero' | 'infantry', o: number, dx: number) => spawnUnit(s, o, type, home.x + dx, home.y + 8) as Unit;
  return { s, hero: at('hero', 0, 0), near: at('infantry', 0, 3), far: at('infantry', 0, 20), foe: at('infantry', 1, 4) };
}

describe('the hero\'s Rallying Cry', () => {
  it('stirs soldiers within reach, not those far off, then needs a rest', () => {
    const { s, hero, near, far } = setup();
    near.hp = 1;
    step(s, [{ t: 'cry', p: 0, id: hero.id }]);
    expect(stirred(s, near)).toBe(true);
    expect(stirred(s, far)).toBe(false);
    expect(near.hp).toBeGreaterThan(1);
    expect(rallyProblem(s, s.players[0], hero)).toMatch(/breath/);
    for (let i = 0; i < secs(RALLY.duration) + 2; i++) step(s);
    expect(stirred(s, near)).toBe(false);
    for (let i = 0; i < secs(RALLY.cooldown) + 2; i++) step(s);
    expect(rallyProblem(s, s.players[0], hero)).toBeNull();
  });

  it('makes blows land harder and armor hold better, and only its owner may call it', () => {
    const { s, hero, near, foe } = setup();
    const st = statsOf(s, near);
    const before = damageOf(s, near, st, foe, false);
    const taken = damageOf(s, foe, statsOf(s, foe), near, false);
    step(s, [{ t: 'cry', p: 1, id: hero.id }]);
    expect(stirred(s, near)).toBe(false);
    step(s, [{ t: 'cry', p: 0, id: hero.id }]);
    expect(damageOf(s, near, st, foe, false)).toBeGreaterThan(before);
    expect(damageOf(s, foe, statsOf(s, foe), near, false)).toBeLessThan(taken);
  });
});
