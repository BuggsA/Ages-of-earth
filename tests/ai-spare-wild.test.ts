import { describe, expect, it } from 'vitest';
import { DEER } from '../src/sim/data';
import { spared } from '../src/sim/ai';
import { createGame } from '../src/sim/game';
import type { Animal } from '../src/sim/types';

/** A clever computer leaves a breeding pair of every wild herd alive (#491). */

const game = (ai: 'gentle' | 'hard') =>
  createGame({ seed: 1, size: 'small', homeland: 'glade', players: [{ name: 'A', ai: null }, { name: 'B', ai }] });
const herdsOf = (a: Animal[]) => {
  const m = new Map<number, Animal[]>();
  for (const d of a) m.set(d.herd ?? d.id, [...(m.get(d.herd ?? d.id) ?? []), d]);
  return [...m.values()].filter((h) => h.length > DEER.pair);
};

describe('the computer spares a pair of each wild herd', () => {
  it('hunts a herd down to a pair and no further, a rival\'s herd gladly', () => {
    const s = game('hard');
    const wild = () => s.animals.filter((a) => a.kind === 'deer' && a.hp > 0 && a.town === undefined);
    const herd = herdsOf(wild())[0];
    expect(herd).toBeDefined();
    expect(spared(s, s.players[1])!(herd[0])).toBe(false);
    for (const d of herd.slice(DEER.pair)) d.hp = 0;
    expect(spared(s, s.players[1])!(herd[0])).toBe(true);
    herd[0].town = 0;
    expect(spared(s, s.players[1])?.(herd[0]) ?? false).toBe(false);
  });

  it('a gentle computer spares nothing', () => {
    const s = game('gentle');
    expect(spared(s, s.players[1])).toBeUndefined();
  });
});
