import { describe, expect, it } from 'vitest';
import { AGES, AI_FLOAT, FLOAT, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { raisesCitizens } from '../src/sim/floating';
import type { AgeId, Building, GameState } from '../src/sim/types';
import { placeBuilding, restat } from '../src/sim/world';

/** The computer in the Age of Floating Cities (#770): it moors a linked town off its shore, and tows a district out of a warhead's way. */

const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec) && !s.over; i++) step(s);
};
const enter = (s: GameState, o: number, age: AgeId) => {
  const p = s.players[o];
  restat(s, p, () => {
    p.epoch = AGES[age].tier;
    p.age = age;
  });
};

function game(): GameState {
  const s = createGame({ seed: 1, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: null }] });
  s.peaceUntil = 1e9;
  s.animals = [];
  enter(s, 0, 'floating');
  s.players[0].res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
  return s;
}

const pontoons = (s: GameState) => s.ents.filter((e): e is Building => e.kind === 'building' && e.type === 'pontoon' && e.owner === 0);

describe('the computer in the Age of Floating Cities', () => {
  it('moors a floating town off its shore, linked, that raises citizens', () => {
    const s = game();
    run(s, 150);
    const town = pontoons(s).filter((b) => b.built);
    expect(town.length).toBeGreaterThanOrEqual(FLOAT.city);
    expect(town.some((b) => raisesCitizens(s, b))).toBe(true);
    // No House goes up on land while it floats.
    expect(s.ents.some((e) => e.kind === 'building' && e.type === 'house' && e.owner === 0 && !e.built)).toBe(false);
  });

  it('casts a district off and tows it away when a rival\'s warhead is aimed at it', () => {
    const s = game();
    for (let i = 0; i < secs(240) && !pontoons(s).some((b) => b.built); i++) step(s);
    const b = pontoons(s).find((x) => x.built)!;
    expect(b).toBeDefined();
    const at = { x: b.x, y: b.y };
    // A warhead of the rival's on its way from its silo, the true point shown (no decoy rings), landing long after the test is done.
    const silo = placeBuilding(s, 1, 'silo', s.players[1].startX + 4, s.players[1].startY + 4, true);
    (s.launches ??= []).push({ id: 99999, owner: 1, silo: silo.id, x: at.x, y: at.y, at: s.tick + secs(600) });
    run(s, 2);
    expect(s.byId.has(b.id)).toBe(false);
    const tow = s.ents.find((e) => e.kind === 'unit' && e.type === 'tow' && e.owner === 0);
    expect(tow).toBeDefined();
    run(s, 40);
    // Moored again, out of the blast.
    const moved = pontoons(s).filter((x) => (x.x - at.x) * (x.x - at.x) + (x.y - at.y) * (x.y - at.y) > (AI_FLOAT.flee / 2) * (AI_FLOAT.flee / 2));
    expect(moved.length).toBeGreaterThan(0);
  });
});
