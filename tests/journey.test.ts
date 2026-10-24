import { describe, expect, it } from 'vitest';
import { AGES, STEP_BACK, TICK_HZ } from '../src/sim/data';
import { createGame, enterAge, step } from '../src/sim/game';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import { journeyHtml, keepsakesCarried, roadLine, staysOf } from '../src/ui/journeyReport';

// Your road at the end (#743): the journey the rules keep, and the end screen drawn from it.
const game = () => createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });

describe('the journey', () => {
  it('logs every change of age in order, step backs marked', () => {
    const s = game();
    const p = s.players[0];
    expect(p.journey).toBeUndefined();
    s.tick = 100;
    enterAge(s, p, 'bronze');
    s.tick = 300;
    enterAge(s, p, 'stone', true);
    expect(p.journey).toEqual([
      { tick: 100, from: 'stone', to: 'bronze' },
      { tick: 300, from: 'bronze', to: 'stone', back: true },
    ]);
  });

  it('counts losses inside the weak window after a step back, and none after it', () => {
    const s = game();
    const p = s.players[0];
    enterAge(s, p, 'bronze');
    enterAge(s, p, 'stone', true);
    spawnUnit(s, 0, 'citizen', 10, 10).hp = 0;
    step(s);
    expect(p.journey!.at(-1)!.lost).toBe(1);
    s.tick += STEP_BACK.time * TICK_HZ;
    spawnUnit(s, 0, 'citizen', 10, 10).hp = 0;
    step(s);
    expect(p.journey!.at(-1)!.lost).toBe(1);
  });

  it('counts no window on a climb', () => {
    const s = game();
    enterAge(s, s.players[0], 'bronze');
    spawnUnit(s, 0, 'citizen', 10, 10).hp = 0;
    step(s);
    expect(s.players[0].journey![0].lost).toBeUndefined();
  });
});

describe('the end screen road', () => {
  it('turns the journey into stays, a save without one starting where it stands', () => {
    const s = game();
    const p = s.players[0];
    expect(staysOf(p, 500)).toEqual([{ age: 'stone', from: 0, to: 500, back: false, lost: 0 }]);
    s.tick = 60 * TICK_HZ;
    enterAge(s, p, 'bronze');
    s.tick = 120 * TICK_HZ;
    enterAge(s, p, 'stone', true);
    p.journey!.at(-1)!.lost = 3;
    const stays = staysOf(p, 150 * TICK_HZ);
    expect(stays.map((x) => [x.age, x.from, x.to, x.back])).toEqual([
      ['stone', 0, 60 * TICK_HZ, false],
      ['bronze', 60 * TICK_HZ, 120 * TICK_HZ, false],
      ['stone', 120 * TICK_HZ, 150 * TICK_HZ, true],
    ]);
    expect(roadLine(p, 150 * TICK_HZ)).toContain('(window struck: lost 3)');
  });

  it('names a keepsake still standing, and draws a line for each leg, dashed when back', () => {
    const s = game();
    const p = s.players[0];
    placeBuilding(s, 0, 'forge', 20, 20, true).keep = 'iron';
    expect(keepsakesCarried(s, p)).toEqual(['iron']);
    enterAge(s, p, 'bronze');
    enterAge(s, p, 'stone', true);
    const html = journeyHtml(s, 0, s.tick);
    expect(html.match(/class="jr-leg/g)).toHaveLength(2);
    expect(html.match(/class="jr-leg back"/g)).toHaveLength(1);
    expect(html).toContain(`Keepsakes carried: ${AGES.iron.name}`);
  });

  it('escapes player names', () => {
    const s = game();
    s.players[1].name = '<b>x</b>';
    expect(journeyHtml(s, 0, s.tick)).not.toContain('<b>x</b>');
  });
});
