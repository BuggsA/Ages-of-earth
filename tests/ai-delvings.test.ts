import { describe, expect, it } from 'vitest';
import { AGES, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { Building } from '../src/sim/types';
import { restat } from '../src/sim/world';

/** The computer on the Deep Road (#881): in the Age of Delvings it digs a Barrow at home and one toward its rival, and sends a wave below. */
describe('the computer in the Age of Delvings (#881)', () => {
  it('raises a forward Barrow and sends foot soldiers below to it', () => {
    const s = createGame({ seed: 4, size: 'small', players: [{ name: 'A', ai: 'hard', civ: 'greeks' }, { name: 'B', ai: null }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    restat(s, p, () => {
      p.epoch = AGES.delvings.tier;
      p.age = 'delvings';
    });
    p.walked = ['megaliths'];
    p.res = { food: 3000, wood: 2000, stone: 1500, gold: 1500 };
    for (let i = 0; i < secs(360) && !(p.stats.delved ?? 0); i++) step(s);
    const barrows = s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'barrow');
    expect(barrows.length).toBeGreaterThanOrEqual(2);
    const far = Math.max(...barrows.map((b) => Math.hypot(b.x - p.startX, b.y - p.startY)));
    expect(far).toBeGreaterThan(15);
    expect(p.stats.delved ?? 0).toBeGreaterThan(0);
  });
});
