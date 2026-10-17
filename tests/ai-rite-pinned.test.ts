import { describe, expect, it } from 'vitest';
import { riteWork } from '../src/sim/ai';
import { AI_RITE, RITE } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { Building, Unit } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** Whom the computer's priest curses (#434): of two packs the same size, the one held in the fight by its soldiers, which can't step back. */
describe('the curse falls on soldiers who cannot step back', () => {
  it('prefers the pack our soldiers hold in the fight', () => {
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
    const far: Unit[] = [];
    const held: Unit[] = [];
    for (let i = 0; i < 3; i++) far.push(spawnUnit(s, 1, 'infantry', home.x + 11, home.y - 1 + i * 0.5));
    for (let i = 0; i < 3; i++) held.push(spawnUnit(s, 1, 'infantry', home.x + 6, home.y + 6 + i * 0.5));
    for (const f of [...far, ...held]) f.stance = 'stand';
    step(s);
    expect(riteWork(s, p, priest)?.target.id).toBe(far[0].id);
    spawnUnit(s, 0, 'infantry', home.x + 6, home.y + 7.5 - AI_RITE.pinned / 2);
    const pick = riteWork(s, p, priest);
    expect(pick?.how).toBe('curse');
    expect(held.map((u) => u.id)).toContain(pick!.target.id);
  });
});
