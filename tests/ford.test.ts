import { describe, expect, it } from 'vitest';
import { LANDMARKS } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { fordGeometry } from '../src/render/landmarksView';
import { LANDMARK_KINDS, fordMarch } from '../src/sim/landmarks';
import { spawnUnit } from '../src/sim/world';
import { markToTake, stagingFord } from '../src/sim/ai';

describe('Old Ford', () => {
  const s = createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  it("quickens its keeper's soldiers, not citizens, traders or rivals", () => {
    const m = s.landmarks![0];
    m.kind = 'ford';
    m.owner = 0;
    const spear = spawnUnit(s, 0, 'infantry', m.x, m.y);
    const cit = spawnUnit(s, 0, 'citizen', m.x, m.y);
    const rival = spawnUnit(s, 1, 'infantry', m.x, m.y);
    expect(fordMarch(s, spear)).toBe(LANDMARKS.ford.march);
    expect(fordMarch(s, cit)).toBe(1);
    expect(fordMarch(s, rival)).toBe(1);
    m.owner = 1;
    expect(fordMarch(s, spear)).toBe(1);
    expect(LANDMARK_KINDS.ford.name).toBe('Old Ford');
  });
  it('has a model', () => {
    expect(fordGeometry().getAttribute('position').count).toBeGreaterThan(0);
  });
});

describe('staging from the ford', () => {
  const s = createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: 'hard', civ: 'romans' }] });
  const home = { x: 20, y: 20 };
  const enemy = { x: 100, y: 20 };
  const ford = (x: number, y: number, owner: number) => {
    const m = s.landmarks![0];
    m.kind = 'ford';
    m.owner = owner;
    m.x = x;
    m.y = y;
    return m;
  };
  it('picks a kept ford on the way to the rival', () => {
    const m = ford(40, 22, 0);
    expect(stagingFord(s, 0, home, enemy)).toBe(m);
  });
  it('ignores a ford behind home, too far, rival-held or on top of the town', () => {
    ford(5, 20, 0);
    expect(stagingFord(s, 0, home, enemy)).toBeNull();
    ford(80, 20, 0);
    expect(stagingFord(s, 0, home, enemy)).toBeNull();
    ford(40, 22, 1);
    expect(stagingFord(s, 0, home, enemy)).toBeNull();
    ford(23, 20, 0);
    expect(stagingFord(s, 0, home, enemy)).toBeNull();
  });
});

describe('contesting a rival ford', () => {
  const mk = (ai: 'hard' | 'easy') => createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai, civ: 'romans' }, { name: 'B', ai: 'hard', civ: 'romans' }] });
  const pick = (s: ReturnType<typeof mk>) => {
    const home = { x: 20, y: 20 };
    const [a, b] = s.landmarks!;
    for (const m of [a, b]) { m.owner = 1; m.claim = 0; m.by = -1; }
    a.kind = 'crag'; a.x = 34; a.y = 20;
    b.kind = 'ford'; b.x = 36; b.y = 20;
    for (const m of s.landmarks!.slice(2)) m.owner = 0;
    return markToTake(s, { p: s.players[0], home } as never, false, false);
  };
  it('a clever computer goes for the rival ford before a nearer crag', () => {
    const s = mk('hard');
    expect(pick(s)!.kind).toBe('ford');
  });
  it('an easy one takes the nearer crag', () => {
    const s = mk('easy');
    expect(pick(s)!.kind).toBe('crag');
  });
});
