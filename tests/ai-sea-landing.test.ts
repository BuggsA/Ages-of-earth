import { describe, expect, it } from 'vitest';
import { findDockSpot } from '../src/sim/ai';
import { TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { NAVAL, walkable } from '../src/sim/grid';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer's sea landing, forced: a dock, a transport and a rich army, with the first attack due. */
describe('the computer lands troops by sea', () => {
  it('loads a transport, sails, and puts soldiers ashore', () => {
    const s = createGame({
      seed: 7,
      size: 'small',
      mapType: 'sea',
      startEpoch: 2,
      players: [
        { name: 'A', ai: 'hard', civ: 'romans' },
        { name: 'B', ai: null, civ: 'romans' },
      ],
    });
    const pl = s.players[0];
    pl.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
    const at = findDockSpot(s, pl.startX, pl.startY, 30)!;
    expect(at).toBeTruthy();
    placeBuilding(s, 0, 'dock', at.tx, at.ty, true);
    // A transport already waits in open water by the dock (one that must first be built would let the
    // land army march off on its own wave before the landing is ready).
    let sea: { x: number; y: number } | null = null;
    for (let r = 2; r < 12 && !sea; r++)
      for (let dy = -r; dy <= r && !sea; dy++)
        for (let dx = -r; dx <= r && !sea; dx++)
          if (Math.max(Math.abs(dx), Math.abs(dy)) === r && walkable(s, at.tx + dx, at.ty + dy, NAVAL)) sea = { x: at.tx + dx + 0.5, y: at.ty + dy + 0.5 };
    expect(sea).toBeTruthy();
    spawnUnit(s, 0, 'transport', sea!.x, sea!.y);
    for (let i = 0; i < 14; i++) spawnUnit(s, 0, 'infantry', pl.startX + 2 + (i % 5), pl.startY + 2 + Math.floor(i / 5));
    s.peaceUntil = 0;
    s.tick = 340 * TICK_HZ;
    let sailed = false;
    for (let i = 0; i < 600 * TICK_HZ && !s.over; i++) {
      step(s);
      if (s.ai[0]?.landing?.phase === 'sail') sailed = true;
      if (s.ai[0]?.landed) break;
    }
    expect(sailed).toBe(true);
    expect(s.ai[0].landed).toBeGreaterThan(0);
  });
});
