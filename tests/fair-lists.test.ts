import { describe, expect, it } from 'vitest';
import { FAIR, secs } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { fairStep } from '../src/sim/fair';
import { maxHp, placeBuilding, spawnUnit } from '../src/sim/world';

/** The lists (#379): a hero at the fairground when a feast closes is healed and paid. */
function setup(heroAt: number, rival: boolean) {
  const s = createGame({ seed: 5, size: 'medium', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  s.players[0].epoch = 3;
  s.players[0].age = 'fair';
  placeBuilding(s, 0, 'market', 40, 40, true);
  const t = placeBuilding(s, 0, 'temple', 44, 40, true);
  s.relics.push({ id: s.nextId++, x: t.x, y: t.y, carrier: 0, temple: t.id });
  const hero = spawnUnit(s, 0, 'hero', heroAt, 40);
  hero.hp = 10;
  if (rival) spawnUnit(s, 1, 'infantry', 41, 42);
  s.tick = secs(FAIR.every) + secs(FAIR.open);
  return { s, hero };
}

describe('The lists', () => {
  it('heals a hero at the fairground and pays the crowd when the feast closes', () => {
    const { s, hero } = setup(42, false);
    const before = s.players[0].res.gold;
    fairStep(s);
    expect(s.players[0].res.gold - before).toBe(FAIR.lists);
    expect(hero.hp).toBe(maxHp(s, hero));
    expect(s.events.some((e) => e.k === 'joust' && e.owner === 0)).toBe(true);
  });
  it('pays nothing for a hero away, or with a rival soldier at the stalls', () => {
    for (const [at, rival] of [[10, false], [42, true]] as const) {
      const { s, hero } = setup(at, rival);
      const before = s.players[0].res.gold;
      fairStep(s);
      expect(s.players[0].res.gold).toBe(before);
      expect(hero.hp).toBe(10);
    }
  });
});
