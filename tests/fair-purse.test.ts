import { describe, expect, it } from 'vitest';
import { FAIR, secs } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { hurt } from '../src/sim/combat';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The feast-day purse (#379): razing a fairground Market while a feast is open pays the raider. */
function setup(feast: boolean, temple: boolean) {
  const s = createGame({ seed: 5, size: 'medium', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  s.players[1].epoch = 3;
  s.players[1].age = 'fair';
  s.tick = feast ? secs(FAIR.every) + 1 : secs(FAIR.every) + secs(FAIR.open) + 5;
  const market = placeBuilding(s, 1, 'market', 40, 40, true);
  if (temple) {
    const t = placeBuilding(s, 1, 'temple', 44, 40, true);
    s.relics.push({ id: s.nextId++, x: t.x, y: t.y, carrier: 0, temple: t.id });
  }
  const raider = spawnUnit(s, 0, 'infantry', 38, 40);
  return { s, market, raider };
}

describe('Feast-day purse', () => {
  it('pays the raider for a fairground Market razed on a feast day', () => {
    const { s, market, raider } = setup(true, true);
    const before = s.players[0].res.gold;
    hurt(s, market, 99999, 0, raider);
    expect(s.players[0].res.gold - before).toBe(FAIR.purse);
  });
  it('pays nothing off the feast, or off the fairground', () => {
    for (const [feast, temple] of [[false, true], [true, false]] as const) {
      const { s, market, raider } = setup(feast, temple);
      const before = s.players[0].res.gold;
      hurt(s, market, 99999, 0, raider);
      expect(s.players[0].res.gold).toBe(before);
    }
  });
});
