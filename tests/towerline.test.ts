import { describe, expect, it } from 'vitest';
import { TECHS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { buildingMaxHp, gunPower, gunRange, techProblem } from '../src/sim/stats';
import { placeBuilding } from '../src/sim/world';
import type { GameState } from '../src/sim/types';

const game = (startEpoch: number) => createGame({ seed: 7, size: 'small', startEpoch, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };

describe('the tower line (Guard Tower, Keep, Bastion)', () => {
  it('a raw Watch Tower is weaker than a Town Center, and grows with each step researched at a tower', () => {
    const s = game(3); const p = s.players[0];
    p.res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
    const tower = placeBuilding(s, 0, 'tower', p.startX + 8, p.startY + 8, true);
    const raw = { power: gunPower(s, 0, 'tower'), range: gunRange(s, 0, 'tower'), hp: buildingMaxHp(s, 0, 'tower') };
    expect(raw.power).toBeLessThan(gunPower(s, 0, 'towncenter'));
    let last = raw;
    for (const tech of ['guardTower', 'keep', 'bastion'] as const) {
      expect(TECHS[tech].at).toBe('tower');
      expect(techProblem(s, 0, tech)).toBeNull();
      step(s, [{ t: 'research', p: 0, building: tower.id, tech }]);
      run(s, TECHS[tech].time + 1);
      expect(p.techs).toContain(tech);
      const now = { power: gunPower(s, 0, 'tower'), range: gunRange(s, 0, 'tower'), hp: buildingMaxHp(s, 0, 'tower') };
      expect(now.power).toBeGreaterThan(last.power);
      expect(now.hp).toBeGreaterThan(last.hp);
      expect(now.range).toBeGreaterThanOrEqual(last.range);
      last = now;
    }
    // The standing tower's health grew with its walls.
    expect(tower.hp).toBe(last.hp);
  });

  it('the Keep waits for the Guard Tower, and the Bastion for the Gunpowder Age', () => {
    const s = game(2);
    expect(techProblem(s, 0, 'keep')).not.toBeNull();
    expect(techProblem(s, 0, 'bastion')).not.toBeNull();
  });
});
