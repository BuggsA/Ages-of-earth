import { describe, expect, it } from 'vitest';
import { secs } from '../src/sim/data';
import { inField } from '../src/sim/ages';
import { aiStep } from '../src/sim/ai';
import { createGame, step } from '../src/sim/game';
import { restat } from '../src/sim/world';
import type { Building } from '../src/sim/types';

describe('the computer lays its town out in its coil fields (#231 s4)', () => {
  it('raises new buildings inside a field once it has a coil', () => {
    const s = createGame({ seed: 11, size: 'small', startEpoch: 4, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'hard', civ: 'romans' }] });
    const p = s.players[1];
    restat(s, p, () => { p.age = 'lightning'; });
    const mine = () => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 1);
    const old = new Set(mine().map((b) => b.id));
    for (let i = 0; i < secs(400); i++) {
      for (const r of ['food', 'wood', 'stone', 'gold'] as const) p.res[r] = Math.max(p.res[r], 3000);
      step(s);
      aiStep(s);
    }
    const added = mine().filter((b) => !old.has(b.id) && b.built && b.type !== 'tower' && b.type !== 'farm' && b.type !== 'house');
    const coils = mine().filter((b) => b.type === 'tower' && b.built);
    expect(coils.length).toBeGreaterThan(0);
    expect(added.length).toBeGreaterThan(0);
    const lit = added.filter((b) => inField(s, b));
    expect(lit.length).toBe(added.length);
  });
});
