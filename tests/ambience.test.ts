import { describe, expect, it } from 'vitest';
import { armyNear, nearWater, voiceFits, wet, type CreatureVoice } from '../src/render/ambience';
import { createGame } from '../src/sim/game';
import type { GameState, UnitType } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

const lakes = (): GameState =>
  createGame({ seed: 4, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

/** The first tile whose whole square of side 2r+1 is (or isn't) open water. */
function find(s: GameState, water: boolean, r: number): { x: number; y: number } {
  for (let y = r; y < s.h - r; y++) {
    for (let x = r; x < s.w - r; x++) {
      let ok = true;
      for (let dy = -r; dy <= r && ok; dy += 1) for (let dx = -r; dx <= r && ok; dx += 1) ok = wet(s, x + dx + 0.5, y + dy + 0.5) === water;
      if (ok) return { x: x + 0.5, y: y + 0.5 };
    }
  }
  throw new Error(water ? 'no lake' : 'no dry land');
}

describe('where the land’s voices belong', () => {
  it('sends crickets and songbirds inland, frogs and gulls to the water', () => {
    const cases: [CreatureVoice, boolean, boolean, boolean][] = [
      // voice, near water, army near, sings
      ['cricket', false, false, true],
      ['cricket', true, false, false],
      ['cricket', false, true, false],
      ['birdsong', false, false, true],
      ['birdsong', true, false, false],
      ['birdsong', false, true, false],
      ['frog', true, false, true],
      ['frog', false, false, false],
      ['frog', true, true, false],
      // Gulls don't mind soldiers.
      ['gull', true, false, true],
      ['gull', true, true, true],
      ['gull', false, false, false],
    ];
    for (const [voice, water, army, sings] of cases) expect(voiceFits(voice, water, army), `${voice} water=${water} army=${army}`).toBe(sings);
  });

  it('hears the water from a lake and from its shore, but not from far inland', () => {
    const s = lakes();
    const lake = find(s, true, 2);
    const land = find(s, false, 12);
    expect(nearWater(s, lake.x, lake.y, 10)).toBe(true);
    expect(nearWater(s, land.x, land.y, 10)).toBe(false);
  });

  it('hushes for five seen soldiers nearby, not for four, citizens, the unseen or the far off', () => {
    const s = lakes();
    s.ents = s.ents.filter((e) => e.kind !== 'unit');
    const at = find(s, false, 4);
    const all = () => true;
    const add = (type: UnitType, n: number, dx = 0) => Array.from({ length: n }, (_, i) => spawnUnit(s, 1, type, at.x + dx + (i % 3) * 0.6, at.y + Math.floor(i / 3) * 0.6));
    add('citizen', 8);
    expect(armyNear(s, at.x, at.y, all)).toBe(false);
    const four = add('infantry', 4);
    expect(armyNear(s, at.x, at.y, all)).toBe(false);
    // An army marching beyond a dozen tiles doesn't count.
    expect(armyNear(s, at.x + 20, at.y, all)).toBe(false);
    const fifth = add('cavalry', 1)[0];
    expect(armyNear(s, at.x, at.y, all)).toBe(true);
    // Soldiers hidden in the fog don't hush anything.
    expect(armyNear(s, at.x, at.y, (u) => u !== fifth)).toBe(false);
    expect(armyNear(s, at.x, at.y, (u) => !four.includes(u))).toBe(false);
    // Ranged and siege count as soldiers too.
    s.ents = s.ents.filter((e) => e.kind !== 'unit');
    add('ranged', 3);
    add('siege', 2);
    expect(armyNear(s, at.x, at.y, all)).toBe(true);
  });
});

describe('the hum of a Coil Tower', () => {
  it('is heard near a finished tower of a people in the Age of Lightning, louder the nearer', async () => {
    const { coilDistance, coilHumGain } = await import('../src/render/ambience');
    const { placeBuilding } = await import('../src/sim/world');
    const s = createGame({ seed: 4, size: 'small', mapType: 'plains', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    const t = placeBuilding(s, 0, 'tower', 20, 20, true);
    expect(coilDistance(s, 20, 20, 12)).toBe(Infinity); // an ordinary Watch Tower is silent
    s.players[0].epoch = 4;
    s.players[0].age = 'lightning';
    expect(coilDistance(s, t.x + 3, t.y, 12)).toBeCloseTo(3, 5);
    expect(coilDistance(s, t.x + 30, t.y, 12)).toBe(Infinity);
    expect(coilDistance(s, t.x + 3, t.y, 12, () => false)).toBe(Infinity); // unseen: silent
    expect(coilHumGain(0, 12)).toBeGreaterThan(coilHumGain(6, 12));
    expect(coilHumGain(12, 12)).toBe(0);
  });
});
