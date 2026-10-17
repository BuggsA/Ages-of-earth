import { describe, expect, it } from 'vitest';
import { GOD_STOCK, grantAll, topUp } from '../src/sim/god';
import { LAST_EPOCH, TECHS } from '../src/sim/data';
import { RES } from '../src/sim/types';
import { createGame } from '../src/sim/game';

describe('god mode (#399)', () => {
  const make = () => createGame({ seed: 1, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'easy', civ: 'romans' }] });
  it('grants the last epoch, the techs and a full treasury', () => {
    const s = make();
    grantAll(s, 0);
    const p = s.players[0];
    expect(p.epoch).toBe(LAST_EPOCH);
    for (const r of RES) expect(p.res[r]).toBe(GOD_STOCK);
    expect(p.techs.length).toBeGreaterThan(10);
    for (const id of p.techs) expect(TECHS[id].only).toBeUndefined();
    expect(s.players[1].epoch).toBe(0);
  });
  it('tops the treasury back up', () => {
    const s = make();
    s.players[0].res.gold = 5;
    topUp(s, 0);
    expect(s.players[0].res.gold).toBe(GOD_STOCK);
  });
});
