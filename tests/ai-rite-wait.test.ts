import { describe, expect, it } from 'vitest';
import { riteWork } from '../src/sim/ai';
import { AI_RITE, RITE, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { Building } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** The computer's priest waits a beat to curse a pack our foot soldiers are about to pin (#434). */
describe('the priest waits for the pin', () => {
  it('holds the curse while our soldiers close, casts once they land or when none close', () => {
    const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null }] });
    s.rares = [];
    s.peaceUntil = 0;
    const p = s.players[0];
    p.epoch = 4;
    p.age = 'bloodrite';
    p.walked = ['warband', 'ironblood', 'totalwar', 'bloodrite'];
    p.statsVersion++;
    p.blood = RITE.curse + AI_RITE.keep + 20;
    for (const e of s.ents) if (e.kind === 'unit' && e.owner === 1) ((e.x = 1.5), (e.y = 1.5));
    const home = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    const priest = spawnUnit(s, 0, 'priest', home.x + 6, home.y);
    const pack = [0, 1, 2].map((i) => spawnUnit(s, 1, 'infantry', home.x + 6, home.y + 6 + i * 0.5));
    for (const f of pack) f.stance = 'stand';
    step(s);
    expect(riteWork(s, p, priest)?.how).toBe('curse');
    const mine = spawnUnit(s, 0, 'infantry', home.x + 6, home.y + 6 + AI_RITE.closing - 2);
    mine.order = { k: 'attack', target: pack[0].id } as typeof mine.order;
    expect(riteWork(s, p, priest)).toBeNull();
    s.tick += secs(AI_RITE.patience) + 1;
    expect(riteWork(s, p, priest)?.how).toBe('curse');
    s.ai[0].riteWait = undefined;
    mine.y = home.y + 7;
    mine.x = home.x + 6 + AI_RITE.pinned / 2;
    expect(riteWork(s, p, priest)?.how).toBe('curse');
  });
});
