import { describe, expect, it } from 'vitest';
import { secs } from '../src/sim/data';
import { inField } from '../src/sim/ages';
import { aiStep } from '../src/sim/ai';
import { createGame, step } from '../src/sim/game';
import { restat } from '../src/sim/world';
import type { Building } from '../src/sim/types';

describe('the computer wires the ruins it dug (#240)', () => {
  it('raises a coil beside a dug ruin that lies outside every field, once it has Galvanic Revival', () => {
    const s = createGame({ seed: 11, size: 'small', startEpoch: 4, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'hard', civ: 'romans' }] });
    const p = s.players[1];
    restat(s, p, () => { p.age = 'lightning'; p.techs.push('galvanic'); });
    const home = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter')!;
    const ruin = { x: home.x < s.w / 2 ? home.x + 28 : home.x - 28, y: home.y, by: 1 } as NonNullable<typeof s.ruins>[number];
    s.ruins = [...(s.ruins ?? []), ruin];
    expect(inField(s, { x: ruin.x, y: ruin.y, owner: 1 })).toBe(false);
    for (let i = 0; i < secs(300); i++) {
      for (const r of ['food', 'wood', 'stone', 'gold'] as const) p.res[r] = Math.max(p.res[r], 3000);
      step(s);
      aiStep(s);
    }
    const coil = s.ents.find((e) => e.kind === 'building' && e.owner === 1 && e.type === 'tower' && Math.hypot(e.x - ruin.x, e.y - ruin.y) <= 8);
    expect(coil).toBeDefined();
  });
});
