import { describe, expect, it } from 'vitest';
import { FAIR, secs } from '../src/sim/data';
import { enemyTarget, findSpot } from '../src/sim/ai';
import { createGame } from '../src/sim/game';
import { placeBuilding } from '../src/sim/world';
import type { Building } from '../src/sim/types';

/** The computer raids a rival's fairground Market on a feast day (#379). */
function setup() {
  const s = createGame({ seed: 5, size: 'medium', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  s.players[0].seen.fill(1);
  const q = s.players[1];
  q.epoch = 3;
  q.age = 'fair';
  for (const e of s.ents) if (e.kind === 'building' && e.owner === 1) e.hp = 0;
  const px = s.players[0].startX, py = s.players[0].startY;
  const decoy = placeBuilding(s, 1, 'barracks', px + 20, py, true) as Building;
  const ts = findSpot(s, 'temple', px + 24, py + 6, 0, 10)!;
  const temple = placeBuilding(s, 1, 'temple', ts.tx, ts.ty, true) as Building;
  s.relics.push({ id: s.nextId++, x: temple.x, y: temple.y, carrier: 0, temple: temple.id });
  const ms = findSpot(s, 'market', temple.x, temple.y, 2, 8)!;
  const market = placeBuilding(s, 1, 'market', ms.tx, ms.ty, true) as Building;
  return { s, decoy, market, temple };
}

describe('the computer raids the feast (#379)', () => {
  it('goes for the fairground Market on the feast, not off it', () => {
    const { s, decoy, market } = setup();
    // Put the decoy just nearer than the Market, so only the feast tips the choice.
    const dm = (market.x - s.players[0].startX) ** 2 + (market.y - s.players[0].startY) ** 2;
    decoy.x = s.players[0].startX + Math.sqrt(dm) - 3; decoy.y = s.players[0].startY;
    s.tick = secs(FAIR.every) + secs(FAIR.open) + 5;
    expect(enemyTarget(s, s.players[0])).not.toBe(market);
    s.tick = secs(FAIR.every) + 5;
    expect(enemyTarget(s, s.players[0])).toBe(market);
  });
});
