import { describe, expect, it } from 'vitest';
import { MAMMOTH, SEASON, TAME, TICK_HZ } from '../src/sim/data';
import { createGame, enterAge, step } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { callWild } from '../src/sim/tame';
import type { Command, GameState } from '../src/sim/types';
import { R_NONE } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';
import { generateMap } from '../src/sim/mapgen';

/** More of the wild (`docs/wild-road.md`): a Wild town's camps also call a mammoth each autumn, and the maps hold a fuller wild. */

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

function campGame(): { s: GameState; camp: { x: number; y: number } } {
  const s = createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  s.animals = [];
  enterAge(s, s.players[0], 'wild');
  for (let y = 8; y < s.h - 8; y++) {
    for (let x = 8; x < s.w - 8; x++) {
      if (s.players.some((p) => Math.hypot(x - p.startX, y - p.startY) < 18)) continue;
      let open = true;
      for (let dy = -5; dy <= 5 && open; dy++) for (let dx = -5; dx <= 5 && open; dx++) open = walkable(s, x + dx, y + dy) && s.res[(y + dy) * s.w + x + dx] === R_NONE;
      if (!open) continue;
      const cit = spawnUnit(s, 0, 'citizen', x + 0.5, y + 0.5);
      s.players[0].res.wood = 500;
      run(s, 1, [{ t: 'build', p: 0, ids: [cit.id], type: 'huntcamp', tx: x, ty: y }]);
      run(s, 40);
      cit.hp = 0;
      const camp = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'huntcamp');
      expect(camp && camp.kind === 'building' && camp.built).toBe(true);
      return { s, camp: { x: camp!.x, y: camp!.y } };
    }
  }
  throw new Error('no meadow');
}

describe('the call of the wild, more of it', () => {
  it('draws a mammoth in autumn only, and not while one stands in the camp\'s country', () => {
    const { s, camp } = campGame();
    const mammoths = () => s.animals.filter((a) => a.kind === 'mammoth' && a.hp > 0 && Math.hypot(a.x - camp.x, a.y - camp.y) <= TAME.mammothNear);
    const at = (season: number) => { s.tick = (SEASON.len * (season + 4)) * TICK_HZ + TAME.callAt * TICK_HZ; callWild(s); };
    at(0);
    at(1);
    expect(mammoths().length).toBe(0);
    at(2);
    expect(mammoths().length).toBe(1);
    at(2);
    expect(mammoths().length).toBe(1);
  });

  it('keeps the boars and wolves near a camp to the cap, whatever else comes', () => {
    const { s, camp } = campGame();
    for (let season = 0; season < 12; season++) { s.tick = SEASON.len * (season + 4) * TICK_HZ + TAME.callAt * TICK_HZ; callWild(s); }
    const small = s.animals.filter((a) => (a.kind === 'boar' || a.kind === 'wolf') && Math.hypot(a.x - camp.x, a.y - camp.y) <= TAME.callNear);
    expect(small.length).toBe(TAME.callCap);
  });

  it('puts a few more mammoths in the open than there were', () => {
    const m = generateMap(8, 'medium', 3);
    const mammoths = m.wild.filter((w) => w.kind === 'mammoth').length;
    expect(mammoths).toBeGreaterThanOrEqual(3 + Math.min(1, MAMMOTH.extra.medium));
  });
});
