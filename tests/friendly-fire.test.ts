import { describe, expect, it } from 'vitest';
import { SILO, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import type { Building, GameState } from '../src/sim/types';

/** A warhead hurts anyone in its blast, the launcher's own people included (the owner's ruling, 2026-10-25). */

const game = (): GameState => createGame({ seed: 5, size: 'small', startEpoch: 5, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

describe('a warhead and friendly fire', () => {
  it('hurts the launcher’s own building and soldier at the point it lands', () => {
    const s = game();
    s.players[0].res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
    const silo = placeBuilding(s, 0, 'silo', s.players[0].startX + 8, s.players[0].startY + 8, true);
    const own = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    const hp = own.hp;
    const man = spawnUnit(s, 0, 'infantry', own.x + 4, own.y);
    const mh = man.hp;
    step(s, [{ t: 'launch', p: 0, silo: silo.id, x: own.x, y: own.y }]);
    for (let i = 0; i < secs(SILO.fuse + 2); i++) step(s);
    expect(own.hp).toBeLessThan(hp);
    expect(man.hp).toBeLessThan(mh);
  });
});
