import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { Waymarks } from '../src/ui/waymarks';

const world = () => {
  const s = createGame({ seed: 7, size: 'small' as const, startEpoch: 1, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.ruins = [{ id: 9001, x: 10.5, y: 10.5, find: 'hoard', dug: 0, by: -1 }];
  s.relics.push({ id: 9002, x: 20.5, y: 20.5, carrier: 0, temple: 0 });
  const p = s.players[0];
  p.vis.fill(0);
  p.seen.fill(0);
  return s;
};
const tile = (s: ReturnType<typeof world>, x: number, y: number) => Math.floor(y) * s.w + Math.floor(x);

describe('waymarks', () => {
  it('knows nothing of ground never seen', () => {
    const s = world();
    const w = new Waymarks();
    w.update(s, 0);
    expect(w.ruins.size).toBe(0);
    expect(w.relics.has(9002)).toBe(false);
  });

  it('keeps a ruin as last seen while the live truth changes under fog', () => {
    const s = world();
    const w = new Waymarks();
    const i = tile(s, 10.5, 10.5);
    s.players[0].vis[i] = 1;
    s.players[0].seen[i] = 1;
    w.update(s, 0);
    expect(w.ruins.get(9001)).toBe(-1);
    s.players[0].vis[i] = 0;
    s.ruins![0].by = 1;
    w.update(s, 0);
    expect(w.ruins.get(9001)).toBe(-1);
    s.players[0].vis[i] = 1;
    w.update(s, 0);
    expect(w.ruins.get(9001)).toBe(1);
  });

  it('remembers where a relic was last seen, and resets', () => {
    const s = world();
    const w = new Waymarks();
    const i = tile(s, 20.5, 20.5);
    s.players[0].vis[i] = 1;
    s.players[0].seen[i] = 1;
    w.update(s, 0);
    s.players[0].vis[i] = 0;
    s.relics[s.relics.length - 1].x = 40.5;
    w.update(s, 0);
    expect(w.relics.get(9002)).toEqual({ x: 20.5, y: 20.5, hidden: false });
    w.reset();
    expect(w.relics.size + w.ruins.size).toBe(0);
  });

  it('learns explored ground it never watched (an old map) as it is', () => {
    const s = world();
    const w = new Waymarks();
    s.players[0].seen.fill(1);
    w.update(s, 0);
    expect(w.ruins.get(9001)).toBe(-1);
    expect(w.relics.has(9002)).toBe(true);
  });
});
