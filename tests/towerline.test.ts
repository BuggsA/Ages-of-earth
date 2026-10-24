import { describe, expect, it } from 'vitest';
import { TOWER_LEVELS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { buildingMaxHp, gunPower, gunRange, raiseProblem } from '../src/sim/stats';
import { placeBuilding } from '../src/sim/world';
import type { GameState } from '../src/sim/types';

const game = (startEpoch: number) => createGame({ seed: 7, size: 'small', startEpoch, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const rich = (s: GameState) => { s.players[0].res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 }; };

describe('the tower line: each Watch Tower raised on its own', () => {
  it('a raw tower is weaker than a Town Center; raising one makes that tower alone stronger, step by step', () => {
    const s = game(3); const p = s.players[0]; rich(s);
    const a = placeBuilding(s, 0, 'tower', p.startX + 8, p.startY + 8, true);
    const b = placeBuilding(s, 0, 'tower', p.startX + 14, p.startY + 8, true);
    expect(gunPower(s, 0, 'tower', a.level)).toBeLessThan(gunPower(s, 0, 'towncenter'));
    let last = { power: gunPower(s, 0, 'tower', 0), range: gunRange(s, 0, 'tower', 0), hp: buildingMaxHp(s, 0, 'tower', 0) };
    for (let i = 0; i < TOWER_LEVELS.length; i++) {
      expect(raiseProblem(s, 0, a)).toBeNull();
      step(s, [{ t: 'raiseTower', p: 0, building: a.id }]);
      run(s, TOWER_LEVELS[i].time + 1);
      expect(a.level).toBe(i + 1);
      const now = { power: gunPower(s, 0, 'tower', a.level), range: gunRange(s, 0, 'tower', a.level), hp: buildingMaxHp(s, 0, 'tower', a.level) };
      expect(now.power).toBeGreaterThan(last.power);
      expect(now.hp).toBeGreaterThan(last.hp);
      expect(now.range).toBeGreaterThanOrEqual(last.range);
      expect(a.hp).toBe(now.hp);
      last = now;
    }
    expect(raiseProblem(s, 0, a)).not.toBeNull();
    // The other tower was never raised.
    expect(b.level ?? 0).toBe(0);
    expect(b.hp).toBe(buildingMaxHp(s, 0, 'tower', 0));
    // Saves keep the level.
    expect(deserialize(serialize(s)).byId.get(a.id)).toMatchObject({ level: TOWER_LEVELS.length });
  });

  it('each step waits for its age, and a rival cannot raise your tower', () => {
    const s = game(1); const p = s.players[0]; rich(s);
    const a = placeBuilding(s, 0, 'tower', p.startX + 8, p.startY + 8, true);
    step(s, [{ t: 'raiseTower', p: 0, building: a.id }]);
    run(s, TOWER_LEVELS[0].time + 1);
    expect(a.level).toBe(1);
    expect(raiseProblem(s, 0, a)).toContain('Middle Ages');
    s.players[1].res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
    step(s, [{ t: 'raiseTower', p: 1, building: a.id }]);
    expect(a.queue.length).toBe(0);
  });
});
